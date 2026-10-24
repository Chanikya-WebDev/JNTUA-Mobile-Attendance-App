package com.chanikya501.jntuaattendance

import com.chanikya501.jntuaattendance.webview.AutomationScriptManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AutomationScriptManagerTest {

    private fun loadBundledAssetScript(): String {
        val candidates = listOf(
            File("src/main/assets/automation_scripts.js"),
            File("app/src/main/assets/automation_scripts.js")
        )
        val file = candidates.firstOrNull { it.exists() }
        assertNotNull("Bundled asset automation_scripts.js should exist", file)
        return file!!.readText()
    }

    private fun loadScraperSource(): String? {
        val candidates = listOf(
            File("scraper/automation_scripts.js"),
            File("../scraper/automation_scripts.js"),
            File("app/scraper/automation_scripts.js")
        )
        return candidates.firstOrNull { it.exists() }?.readText()
    }

    @Test
    fun bundledAssetScript_hasValidSignatureAndPassesValidation() {
        val script = loadBundledAssetScript()
        assertTrue(script.isNotBlank())
        assertTrue("Script length should be > 1000", script.length > 1000)

        // Must extract valid signature
        val sig = AutomationScriptManager.extractSignature(script)
        assertNotNull("Signature header line must be present in asset", sig)
        assertTrue("Signature should be non-empty", sig!!.isNotBlank())

        // Must pass ECDSA signature verification
        assertTrue("ECDSA signature must verify successfully against embedded public key", AutomationScriptManager.verifySignature(script))

        // Full validation must pass
        assertTrue("validateScriptContent must return true for signed asset", AutomationScriptManager.validateScriptContent(script))
    }

    @Test
    fun tamperedScript_failsSignatureVerification() {
        val script = loadBundledAssetScript()
        // Tamper with a character in the body
        val tampered = script.replace("JNTUAScraper", "PWNEDScraper")

        assertFalse("Tampered script must fail ECDSA signature verification", AutomationScriptManager.verifySignature(tampered))
        assertFalse("Tampered script must fail validateScriptContent", AutomationScriptManager.validateScriptContent(tampered))
    }

    @Test
    fun scriptWithoutSignature_failsVerification() {
        val script = loadBundledAssetScript()
        val withoutSig = AutomationScriptManager.getCanonicalContent(script)

        assertFalse("Script without signature must fail verifySignature", AutomationScriptManager.verifySignature(withoutSig))
        assertFalse("Script without signature must fail validateScriptContent", AutomationScriptManager.validateScriptContent(withoutSig))
    }

    @Test
    fun compareVersions_handlesSemanticAndDateVersionFormats() {
        // Newer vs older
        assertTrue(AutomationScriptManager.compareVersions("2026.11.05.1", "2026.10.18.1") > 0)
        assertTrue(AutomationScriptManager.compareVersions("2026.10.18.2", "2026.10.18.1") > 0)
        assertTrue(AutomationScriptManager.compareVersions("2.0.0", "1.9.9") > 0)
        assertTrue(AutomationScriptManager.compareVersions("1.10.0", "1.9.0") > 0)

        // Older vs newer
        assertTrue(AutomationScriptManager.compareVersions("2026.10.18.1", "2026.11.05.1") < 0)
        assertTrue(AutomationScriptManager.compareVersions("1.0.0", "1.0.1") < 0)

        // Equal
        assertEquals(0, AutomationScriptManager.compareVersions("2026.10.18.1", "2026.10.18.1"))
        assertEquals(0, AutomationScriptManager.compareVersions("1.0.0", "1.0.0"))
    }

    @Test
    fun extractVersion_correctlyExtractsVersionString() {
        val script = loadBundledAssetScript()
        assertEquals("2026.10.24.1", AutomationScriptManager.extractVersion(script))

        val scriptWithQuotedVersion = """window.JNTUAScraper = { version: "2.4.5" };"""
        assertEquals("2.4.5", AutomationScriptManager.extractVersion(scriptWithQuotedVersion))

        val scriptWithoutVersion = "console.log('no version');"
        assertEquals("1.0.0", AutomationScriptManager.extractVersion(scriptWithoutVersion))
    }

    @Test
    fun computeSha256_isDeterministicAndAccurate() {
        val hash1 = AutomationScriptManager.computeSha256("test-script-content")
        val hash2 = AutomationScriptManager.computeSha256("test-script-content")
        assertEquals(hash1, hash2)
        assertEquals(64, hash1.length)
    }

    @Test
    fun buildPageDispatchScript_escapesSpecialCharactersProperly() {
        val dispatchScript = AutomationScriptManager.buildPageDispatchScript(
            url = "https://jntuaceastudents.classattendance.in/studenthome.php?param=\"test\"",
            targetIndex = 3,
            isLoggedIn = true,
            isScrapingActive = true
        )
        assertTrue(dispatchScript.contains("window.JNTUAScraper.handlePageLoad"))
        assertTrue(dispatchScript.contains("\\\"test\\\""))
        assertTrue(dispatchScript.contains("3"))
        assertTrue(dispatchScript.contains("true"))
    }

    // ---- Phase 8: corrected version gating (does not get discarded by init) ----

    @Test
    fun correctedVersion_isNewerThanAnyPriorBundle_soInitDoesNotDiscardOtaCache() {
        // The device's installed/committed bundle is 2026.10.18.1, and the discarded
        // working-tree attempt was 2026.10.23.1. The corrected version must be strictly
        // newer than both so init's `compareVersions(cached, bundled) > 0` keeps it.
        assertEquals("2026.10.24.1", AutomationScriptManager.extractVersion(loadBundledAssetScript()))
        assertTrue(AutomationScriptManager.compareVersions("2026.10.24.1", "2026.10.23.1") > 0)
        assertTrue(AutomationScriptManager.compareVersions("2026.10.24.1", "2026.10.18.1") > 0)
        // A reused equal marker (2026.10.23.1 cache vs 2026.10.23.1 bundle) WOULD be
        // discarded by init -- this is exactly the trap we avoided by bumping.
        assertEquals(0, AutomationScriptManager.compareVersions("2026.10.23.1", "2026.10.23.1"))
    }

    @Test
    fun otaSourceScraper_matchesBundledVersionAndHasValidSignature() {
        val scraper = loadScraperSource()
        assertNotNull("scraper/automation_scripts.js (OTA source) should exist", scraper)
        val script = scraper!!
        assertEquals("2026.10.24.1", AutomationScriptManager.extractVersion(script))
        assertTrue("OTA source must carry a valid ECDSA signature", AutomationScriptManager.verifySignature(script))
        // The OTA source and the bundled asset must be the SAME corrected version so a
        // fresh install and an upgrade both run the fix.
        assertEquals(
            0,
            AutomationScriptManager.compareVersions(
                AutomationScriptManager.extractVersion(script),
                AutomationScriptManager.extractVersion(loadBundledAssetScript())
            )
        )
    }

    @Test
    fun signedScript_isAccepted_andTamperedIsRejected() {
        val script = loadBundledAssetScript()
        assertTrue("Correctly signed script must validate", AutomationScriptManager.validateScriptContent(script))
        val tampered = script.replace("window.JNTUAScraper", "window.EvilScraper")
        assertFalse("Header-swap must fail validation", AutomationScriptManager.validateScriptContent(tampered))
        assertFalse("Header-swap must fail signature verification", AutomationScriptManager.verifySignature(tampered))
    }
}
