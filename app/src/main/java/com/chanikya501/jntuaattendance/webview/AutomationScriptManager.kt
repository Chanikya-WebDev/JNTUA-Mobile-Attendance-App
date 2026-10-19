package com.chanikya501.jntuaattendance.webview

import android.content.Context
import androidx.core.content.pm.PackageInfoCompat
import com.chanikya501.jntuaattendance.util.AppLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

sealed class ScriptUpdateResult {
    data class Success(val version: String, val isNew: Boolean) : ScriptUpdateResult()
    data class AlreadyLatest(val version: String) : ScriptUpdateResult()
    data class Failed(val error: String) : ScriptUpdateResult()
}

private sealed class DownloadResult {
    data class Success(val content: String, val etag: String?) : DownloadResult()
    object NotModified : DownloadResult()
    data class Failed(val reason: String) : DownloadResult()
}

object AutomationScriptManager {
    private const val TAG = "AutomationScriptManager"
    private const val CACHED_SCRIPT_FILENAME = "automation_scripts.js"
    private const val PREFS_NAME = "ota_scraper_prefs"
    private const val PREF_KEY_SHA256 = "cached_script_sha256"
    private const val PREF_KEY_VERSION = "cached_script_version"
    private const val PREF_KEY_ETAG = "cached_script_etag"
    private const val PREF_KEY_APP_VERSION_CODE = "cached_app_version_code"
    private const val PREF_KEY_LAST_CHECKED_MS = "last_checked_ms"
    private const val COOLDOWN_MS = 15 * 60 * 1000L // 15 minutes

    const val PORTAL_BASE_URL = "https://jntuaceastudents.classattendance.in"
    const val PORTAL_HOST = "jntuaceastudents.classattendance.in"

    const val PRIMARY_URL = "https://raw.githubusercontent.com/Chanikya-WebDev/JNTUA-Mobile-Attendance-App/main/scraper/automation_scripts.js"
    const val FALLBACK_URL = "https://cdn.jsdelivr.net/gh/Chanikya-WebDev/JNTUA-Mobile-Attendance-App@main/scraper/automation_scripts.js"

    // NIST P-256 (secp256r1) Public Key (X.509 SubjectPublicKeyInfo Base64)
    const val SCRAPER_PUBLIC_KEY_BASE64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEzxW/3K/0U1bgnW3XaXChoHTa8GmUPSzkJLKN4HLCcrFGnNHe9ZDYD4CNny0O3A3rHbeEKPVcNBeMPRC6FntQiQ=="

    fun isPortalHost(url: String?): Boolean {
        if (url == null) return false
        return try {
            val uri = android.net.Uri.parse(url)
            uri.scheme == "https" && uri.host == PORTAL_HOST
        } catch (_: Exception) {
            false
        }
    }

    private val updateMutex = Mutex()

    private val _activeScript = MutableStateFlow<String>("")
    val activeScript: StateFlow<String> = _activeScript.asStateFlow()

    private val _activeVersion = MutableStateFlow<String>("1.0.0")
    val activeVersion: StateFlow<String> = _activeVersion.asStateFlow()

    private var activeSha256: String = ""
    private var isInitialized = false

    /**
     * Initializes the script manager.
     * Prevents the "Bundled Asset Upgrade Trap":
     * 1. Purges cached scripts when the app's versionCode upgrades.
     * 2. Compares bundled asset version vs cached file version and prefers the bundled asset
     *    if its version is >= cached file version.
     */
    suspend fun init(context: Context) = withContext(Dispatchers.IO) {
        if (isInitialized && _activeScript.value.isNotBlank()) return@withContext

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val cachedFile = File(context.filesDir, CACHED_SCRIPT_FILENAME)

        // 1. Check if APK version code has upgraded
        val currentVersionCode = try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            PackageInfoCompat.getLongVersionCode(pInfo)
        } catch (_: Exception) { 1L }

        val lastAppVersionCode = prefs.getLong(PREF_KEY_APP_VERSION_CODE, 0L)
        if (currentVersionCode > lastAppVersionCode) {
            AppLogger.i(TAG, "App upgrade detected ($lastAppVersionCode -> $currentVersionCode). Purging stale cached scraper.")
            if (cachedFile.exists()) {
                cachedFile.delete()
            }
            prefs.edit()
                .putLong(PREF_KEY_APP_VERSION_CODE, currentVersionCode)
                .remove(PREF_KEY_ETAG)
                .remove(PREF_KEY_SHA256)
                .remove(PREF_KEY_VERSION)
                .apply()
        }

        // 2. Load bundled script from assets
        var bundledScript = ""
        try {
            context.assets.open(CACHED_SCRIPT_FILENAME).use { input ->
                BufferedReader(InputStreamReader(input)).use { reader ->
                    bundledScript = reader.readText()
                }
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error loading bundled asset script: ${e.message}")
        }
        val bundledVersion = extractVersion(bundledScript)

        // 3. Inspect cached file if it exists
        var scriptToUse = bundledScript
        var versionToUse = bundledVersion

        if (cachedFile.exists() && cachedFile.length() > 500) {
            try {
                val candidate = cachedFile.readText()
                if (validateScriptContent(candidate)) {
                    val candidateVersion = extractVersion(candidate)
                    // Only use cached script if its version is strictly newer than the bundled asset
                    if (compareVersions(candidateVersion, bundledVersion) > 0) {
                        scriptToUse = candidate
                        versionToUse = candidateVersion
                        AppLogger.i(TAG, "Using newer OTA cached script v$candidateVersion over bundled asset v$bundledVersion")
                    } else {
                        AppLogger.i(TAG, "Bundled asset v$bundledVersion is >= cached script v$candidateVersion. Using bundled asset and purging older cache.")
                        cachedFile.delete()
                    }
                } else {
                    AppLogger.w(TAG, "Cached scraper script failed validation/signature. Purging.")
                    cachedFile.delete()
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Error reading cached script: ${e.message}")
            }
        }

        if (scriptToUse.isNotBlank()) {
            activeSha256 = computeSha256(scriptToUse)
            _activeScript.value = scriptToUse
            _activeVersion.value = versionToUse
            isInitialized = true
            AppLogger.i(TAG, "Initialized scraper script v$versionToUse (SHA: ${activeSha256.take(8)})")
        }
    }

    /**
     * Checks for updates from the remote repository.
     * Uses HTTP Conditional GET (If-None-Match / ETag) and a 15-minute cooldown for silent checks.
     * If force is true, cooldown is bypassed.
     */
    suspend fun checkForUpdates(context: Context, force: Boolean = false): ScriptUpdateResult = withContext(Dispatchers.IO) {
        updateMutex.withLock {
            if (!isInitialized) {
                init(context)
            }

            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val now = System.currentTimeMillis()
            val lastChecked = prefs.getLong(PREF_KEY_LAST_CHECKED_MS, 0L)

            // 15-minute cooldown for silent background checks
            if (!force && (now - lastChecked < COOLDOWN_MS) && _activeScript.value.isNotBlank()) {
                val remainingSec = (COOLDOWN_MS - (now - lastChecked)) / 1000
                AppLogger.d(TAG, "Skipping background update check: cooldown active (${remainingSec}s remaining)")
                return@withLock ScriptUpdateResult.AlreadyLatest(_activeVersion.value)
            }

            val cachedEtag = prefs.getString(PREF_KEY_ETAG, null)
            AppLogger.i(TAG, "Checking for scraper script updates (force=$force, etag=$cachedEtag)...")

            var downloadResult = downloadScriptFromUrl(PRIMARY_URL, cachedEtag)
            if (downloadResult is DownloadResult.Failed) {
                AppLogger.w(TAG, "Primary URL check failed (${downloadResult.reason}). Attempting fallback CDN...")
                downloadResult = downloadScriptFromUrl(FALLBACK_URL, cachedEtag)
            }

            when (downloadResult) {
                is DownloadResult.NotModified -> {
                    AppLogger.i(TAG, "Server returned 304 Not Modified. Scraper is up to date (0 bytes consumed).")
                    prefs.edit().putLong(PREF_KEY_LAST_CHECKED_MS, now).apply()
                    return@withLock ScriptUpdateResult.AlreadyLatest(_activeVersion.value)
                }
                is DownloadResult.Failed -> {
                    AppLogger.w(TAG, "Failed to download scraper script: ${downloadResult.reason}")
                    return@withLock ScriptUpdateResult.Failed(downloadResult.reason)
                }
                is DownloadResult.Success -> {
                    val downloadedText = downloadResult.content
                    val newEtag = downloadResult.etag

                    // Validate structural integrity AND cryptographic signature
                    if (!validateScriptContent(downloadedText)) {
                        AppLogger.e(TAG, "Downloaded script failed validation or signature check.")
                        return@withLock ScriptUpdateResult.Failed("Downloaded script failed cryptographic signature verification")
                    }

                    val newSha256 = computeSha256(downloadedText)
                    val newVersion = extractVersion(downloadedText)

                    if (!force && newSha256.equals(activeSha256, ignoreCase = true)) {
                        AppLogger.i(TAG, "Scraper script content identical to active version (v$newVersion).")
                        prefs.edit()
                            .putLong(PREF_KEY_LAST_CHECKED_MS, now)
                            .putString(PREF_KEY_ETAG, newEtag)
                            .apply()
                        return@withLock ScriptUpdateResult.AlreadyLatest(newVersion)
                    }

                    // Atomic file write
                    val targetFile = File(context.filesDir, CACHED_SCRIPT_FILENAME)
                    val tempFile = File(context.filesDir, "$CACHED_SCRIPT_FILENAME.tmp")

                    try {
                        tempFile.writeText(downloadedText)
                        if (tempFile.renameTo(targetFile) || (targetFile.delete() && tempFile.renameTo(targetFile))) {
                            activeSha256 = newSha256
                            _activeScript.value = downloadedText
                            _activeVersion.value = newVersion

                            prefs.edit()
                                .putString(PREF_KEY_SHA256, newSha256)
                                .putString(PREF_KEY_VERSION, newVersion)
                                .putString(PREF_KEY_ETAG, newEtag)
                                .putLong(PREF_KEY_LAST_CHECKED_MS, now)
                                .apply()

                            AppLogger.i(TAG, "Successfully updated scraper script to v$newVersion (SHA: ${newSha256.take(8)})")
                            return@withLock ScriptUpdateResult.Success(newVersion, isNew = true)
                        } else {
                            return@withLock ScriptUpdateResult.Failed("Failed to save script to storage")
                        }
                    } catch (e: Exception) {
                        return@withLock ScriptUpdateResult.Failed("Storage error: ${e.message}")
                    }
                }
            }
        }
    }

    private fun downloadScriptFromUrl(urlString: String, cachedEtag: String?): DownloadResult {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(urlString)
            connection = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 10000
                requestMethod = "GET"
                setRequestProperty("User-Agent", "JNTUAScraperOTA/1.0")
                setRequestProperty("Accept", "text/plain, application/javascript, */*")
                if (!cachedEtag.isNullOrBlank()) {
                    setRequestProperty("If-None-Match", cachedEtag)
                }
                instanceFollowRedirects = true
            }

            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_NOT_MODIFIED) {
                DownloadResult.NotModified
            } else if (responseCode == HttpURLConnection.HTTP_OK) {
                val content = connection.inputStream.bufferedReader().use { it.readText() }
                val etag = connection.getHeaderField("ETag")
                DownloadResult.Success(content, etag)
            } else {
                DownloadResult.Failed("HTTP $responseCode from $urlString")
            }
        } catch (e: Exception) {
            DownloadResult.Failed(e.message ?: "Connection error")
        } finally {
            connection?.disconnect()
        }
    }

    /**
     * Strips the signature header line and normalizes line endings to \n.
     */
    fun getCanonicalContent(rawContent: String): String {
        val normalized = rawContent.replace("\r\n", "\n")
        return normalized.replace(Regex("""^//\s*[Ss]ignature:.*?\n""", RegexOption.MULTILINE), "")
    }

    /**
     * Extracts the Base64 signature from the header line.
     */
    fun extractSignature(rawContent: String): String? {
        val regex = Regex("""^//\s*[Ss]ignature:\s*([A-Za-z0-9+/=_-]+)""", RegexOption.MULTILINE)
        return regex.find(rawContent.replace("\r\n", "\n"))?.groupValues?.get(1)?.trim()
    }

    /**
     * Verifies the cryptographic ECDSA signature against the embedded public key.
     */
    fun verifySignature(rawContent: String): Boolean {
        val signatureB64 = extractSignature(rawContent) ?: return false
        return try {
            val canonical = getCanonicalContent(rawContent)
            val keyBytes = Base64.getDecoder().decode(SCRAPER_PUBLIC_KEY_BASE64)
            val keySpec = X509EncodedKeySpec(keyBytes)
            val keyFactory = KeyFactory.getInstance("EC")
            val publicKey = keyFactory.generatePublic(keySpec)

            val verifier = Signature.getInstance("SHA256withECDSA")
            verifier.initVerify(publicKey)
            verifier.update(canonical.toByteArray(Charsets.UTF_8))
            val sigBytes = Base64.getDecoder().decode(signatureB64)
            verifier.verify(sigBytes)
        } catch (e: Exception) {
            AppLogger.e(TAG, "ECDSA verification error: ${e.message}")
            false
        }
    }

    /**
     * Validates both structural markers and cryptographic ECDSA signature.
     */
    fun validateScriptContent(content: String?): Boolean {
        if (content.isNullOrBlank() || content.length < 800) return false
        val requiredMarkers = listOf(
            "window.JNTUAScraper",
            "autoSubmitFirstSemester",
            "selectSubjectByIndex",
            "parseDetailedAttendanceAndGoHome",
            "sessionStorage"
        )
        val hasMarkers = requiredMarkers.all { content.contains(it) }
        if (!hasMarkers) return false

        return verifySignature(content)
    }

    fun extractVersion(content: String): String {
        val regex = Regex("""[Vv]ersion[:\s"=]+([0-9a-zA-Z._-]+)""")
        val match = regex.find(content)
        return match?.groupValues?.get(1) ?: "1.0.0"
    }

    fun compareVersions(v1: String, v2: String): Int {
        val p1 = v1.split('.', '-', '_')
        val p2 = v2.split('.', '-', '_')
        for (i in 0 until maxOf(p1.size, p2.size)) {
            val s1 = p1.getOrNull(i).orEmpty()
            val s2 = p2.getOrNull(i).orEmpty()
            val n1 = s1.toLongOrNull()
            val n2 = s2.toLongOrNull()
            val cmp = if (n1 != null && n2 != null) n1.compareTo(n2) else s1.compareTo(s2)
            if (cmp != 0) return cmp
        }
        return 0
    }

    fun computeSha256(content: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(content.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Generates JavaScript snippet to invoke the smart page loader or specific action.
     */
    fun buildPageDispatchScript(
        url: String,
        targetIndex: Int,
        isLoggedIn: Boolean,
        isScrapingActive: Boolean
    ): String {
        val escapedUrl = url.replace("\"", "\\\"").replace("'", "\\'")
        return """
            (function() {
                try {
                    if (window.JNTUAScraper && window.JNTUAScraper.handlePageLoad) {
                        window.JNTUAScraper.handlePageLoad("$escapedUrl", $targetIndex, $isLoggedIn, $isScrapingActive);
                    }
                } catch(e) {
                    console.error('[AttendanceScraper] Dispatch error:', e);
                }
            })();
            true;
        """.trimIndent()
    }
}
