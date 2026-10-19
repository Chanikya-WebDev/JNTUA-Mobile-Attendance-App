package com.chanikya501.jntuaattendance.ui.views

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import com.chanikya501.jntuaattendance.util.AppLogger
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.chanikya501.jntuaattendance.ui.theme.OnDark
import com.chanikya501.jntuaattendance.ui.theme.Primary
import com.chanikya501.jntuaattendance.viewmodel.AttendanceUiState
import com.chanikya501.jntuaattendance.viewmodel.AttendanceViewModel
import com.chanikya501.jntuaattendance.webview.AttendanceBridge
import com.chanikya501.jntuaattendance.webview.AutomationScriptManager

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScraperView(
    state: AttendanceUiState,
    viewModel: AttendanceViewModel,
    modifier: Modifier = Modifier
) {
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var lastInjectedKey by remember(state.webViewKey) { mutableStateOf<String?>(null) }
    var sessionStarted by remember(state.webViewKey) { mutableStateOf(false) }

    // Drain one-shot JS commands from the ViewModel (e.g. session reset after
    // the user dismisses a stall error). Without this, stale
    // sessionStorage.fetchedSubjectCodes would make a retry instantly "skip"
    // every subject and finish with zero rows.
    LaunchedEffect(webViewInstance) {
        viewModel.jsCommands.collect { js ->
            try {
                webViewInstance?.evaluateJavascript(js, null)
            } catch (_: Exception) {
            }
        }
    }

    val isScrapingActive = state.isLoggedIn && !state.isScrapingFinished

    // When scraping finishes, completely tear down and destroy the WebView
    LaunchedEffect(state.isScrapingFinished) {
        if (state.isScrapingFinished) {
            webViewInstance?.apply {
                stopLoading()
                loadUrl("about:blank")
                clearHistory()
                clearCache(true)
                removeAllViews()
                destroy()
            }
            webViewInstance = null
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        // Native WebView: only mounted while scraping/login is active.
        // During automated scraping, visibility is set to INVISIBLE and alpha to 0f,
        // ensuring no web pages are ever visible behind the syncing screen or UI.
        if (!state.isScrapingFinished) {
            key(state.webViewKey) {
                AndroidView(
                    modifier = if (isScrapingActive) {
                        Modifier.fillMaxSize().alpha(0f)
                    } else {
                        Modifier.fillMaxSize()
                    },
                    factory = { context ->
                        WebView(context).apply {
                            resumeTimers()
                            onResume()
                            layoutParams = android.view.ViewGroup.LayoutParams(
                                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                                android.view.ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            visibility = if (isScrapingActive) View.INVISIBLE else View.VISIBLE
                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                databaseEnabled = true
                                cacheMode = WebSettings.LOAD_DEFAULT
                                userAgentString =
                                    "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                                mediaPlaybackRequiresUserGesture = true
                            }
                            try {
                                CookieManager.getInstance().setAcceptCookie(true)
                                CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                            } catch (eCookie: Exception) {
                                AppLogger.w("AttendanceScraper", "CookieManager init warning: ${eCookie.message}")
                            }
                            setLayerType(View.LAYER_TYPE_HARDWARE, null)

                            webChromeClient = object : WebChromeClient() {
                                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                                    if (consoleMessage != null) {
                                        val level = consoleMessage.messageLevel()
                                        val msg = consoleMessage.message()
                                        val src = consoleMessage.sourceId()
                                        val line = consoleMessage.lineNumber()
                                        when (level) {
                                            ConsoleMessage.MessageLevel.ERROR -> AppLogger.e("AttendanceScraperJS", "$msg ($src:$line)")
                                            ConsoleMessage.MessageLevel.WARNING -> AppLogger.w("AttendanceScraperJS", "$msg ($src:$line)")
                                            else -> AppLogger.d("AttendanceScraperJS", "[$level] $msg ($src:$line)")
                                        }
                                    }
                                    return true
                                }
                            }

                            addJavascriptInterface(
                                AttendanceBridge { raw ->
                                    viewModel.onBridgeMessage(raw)
                                },
                                "AndroidBridge"
                            )

                            webViewClient = object : WebViewClient() {
                                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                    super.onPageStarted(view, url, favicon)
                                    val currentState = viewModel.uiState.value
                                    val scrapingActive = currentState.isLoggedIn && !currentState.isScrapingFinished
                                    AppLogger.i("AttendanceScraper", "onPageStarted: url=$url, scrapingActive=$scrapingActive, index=${currentState.currentIndex}")
                                    viewModel.onPageLoadStarted()
                                }

                                override fun onPageFinished(view: WebView?, url: String?) {
                                    super.onPageFinished(view, url)
                                    if (view == null || url == null) return
                                    AppLogger.i("AttendanceScraper", "onPageFinished: url=$url")
                                    if (!AutomationScriptManager.isPortalHost(url)) return

                                    // 1. Inject latest dynamic OTA automation script bundle (which includes bridge shim and scraper)
                                    val dynamicScript = AutomationScriptManager.activeScript.value
                                    if (dynamicScript.isNotBlank()) {
                                        view.evaluateJavascript(dynamicScript, null)
                                    }

                                    val currentState = viewModel.uiState.value
                                    if (!currentState.isLoggedIn && !url.contains("student")) {
                                        view.evaluateJavascript(
                                            "if (window.JNTUAScraper && window.JNTUAScraper.injectHumanNote) { window.JNTUAScraper.injectHumanNote(); }",
                                            null
                                        )
                                    }

                                    if (currentState.isSelectionError || currentState.isStructureError || currentState.gatewayError) {
                                        AppLogger.w("AttendanceScraper", "Injection suppressed due to error state")
                                        return
                                    }
                                    if (currentState.isScrapingFinished) {
                                        AppLogger.i("AttendanceScraper", "Injection suppressed: scraping already finished")
                                        return
                                    }

                                    val cleanUrl = url.substringBefore("#")
                                    val injectKey = "$cleanUrl|${currentState.isLoggedIn}|${currentState.currentIndex}"
                                    if (lastInjectedKey == injectKey) {
                                        AppLogger.d("AttendanceScraper", "Duplicate injection ignored for key: $injectKey")
                                        return
                                    }
                                    lastInjectedKey = injectKey

                                    if (!sessionStarted) {
                                        sessionStarted = true
                                        AppLogger.i("AttendanceScraper", "Beginning scrape session in sessionStorage")
                                        view.evaluateJavascript(
                                            "if (window.JNTUAScraper && window.JNTUAScraper.beginScrapeSession) { window.JNTUAScraper.beginScrapeSession(); }",
                                            null
                                        )
                                    }

                                    // 2. Dispatch page execution via OTA script router
                                    val scrapingActive = currentState.isLoggedIn && !currentState.isScrapingFinished
                                    val dispatchScript = AutomationScriptManager.buildPageDispatchScript(
                                        cleanUrl,
                                        currentState.currentIndex,
                                        currentState.isLoggedIn,
                                        scrapingActive
                                    )
                                    view.evaluateJavascript(dispatchScript, null)
                                }

                                override fun onReceivedHttpError(
                                    view: WebView?,
                                    request: WebResourceRequest?,
                                    errorResponse: WebResourceResponse?
                                ) {
                                    super.onReceivedHttpError(view, request, errorResponse)
                                    val status = errorResponse?.statusCode ?: 0
                                    val reqUrl = request?.url?.toString().orEmpty()
                                    AppLogger.w("AttendanceScraper", "onReceivedHttpError: status=$status for url=$reqUrl")
                                    if (status == 502) {
                                        viewModel.onReceivedHttpError(502)
                                    }
                                }

                                override fun onReceivedError(
                                    view: WebView?,
                                    request: WebResourceRequest?,
                                    error: WebResourceError?
                                ) {
                                    super.onReceivedError(view, request, error)
                                    val errorDesc = error?.description?.toString().orEmpty()
                                    val errorCode = error?.errorCode ?: 0
                                    val reqUrl = request?.url?.toString().orEmpty()
                                    val isMainFrame = request?.isForMainFrame == true

                                    AppLogger.e("AttendanceScraper", "onReceivedError: code=$errorCode, desc=$errorDesc, url=$reqUrl, mainFrame=$isMainFrame")

                                    // Intercept ERR_CACHE_MISS: Chromium throws this when navigating back to POST responses.
                                    // Never terminate the flow or flag as offline. Auto-recover by loading studentsubjects.php directly.
                                    if (errorDesc.contains("ERR_CACHE_MISS", ignoreCase = true) || errorDesc.contains("CACHE_MISS", ignoreCase = true)) {
                                        AppLogger.w("AttendanceScraper", "ERR_CACHE_MISS intercepted for $reqUrl! Auto-recovering to studentsubjects.php")
                                        view?.post {
                                            view.loadUrl("${AutomationScriptManager.PORTAL_BASE_URL}/studentsubjects.php")
                                        }
                                        return
                                    }

                                    if (isMainFrame) {
                                        viewModel.onReceivedNetworkError()
                                    }
                                }

                                override fun onRenderProcessGone(
                                    view: WebView?,
                                    detail: RenderProcessGoneDetail?
                                ): Boolean {
                                    AppLogger.e("AttendanceScraper", "onRenderProcessGone: didCrash=${detail?.didCrash()}")
                                    return super.onRenderProcessGone(view, detail)
                                }
                            }

                            loadUrl("${AutomationScriptManager.PORTAL_BASE_URL}/")
                            webViewInstance = this
                        }
                    },
                    update = { webView ->
                        webViewInstance = webView
                        webView.resumeTimers()
                        webView.onResume()
                        webView.visibility = if (isScrapingActive) View.INVISIBLE else View.VISIBLE
                    },
                    onReset = { webView ->
                        webView.stopLoading()
                        webView.loadUrl("about:blank")
                        webView.clearHistory()
                        webView.clearCache(true)
                        webView.removeAllViews()
                        webView.destroy()
                    }
                )
            }
        }

        DisposableEffect(state.webViewKey) {
            lastInjectedKey = null
            sessionStarted = false
            onDispose {
                webViewInstance?.let { wv ->
                    wv.stopLoading()
                    wv.loadUrl("about:blank")
                    wv.clearHistory()
                    wv.clearCache(true)
                    wv.removeAllViews()
                    wv.destroy()
                    webViewInstance = null
                }
            }
        }

        // Floating Reload Button (visible only when not scraping)
        if (!state.isScrapingFinished && !isScrapingActive) {
            Box(
                modifier = Modifier
                    .padding(top = 14.dp, end = 14.dp)
                    .align(Alignment.TopEnd)
                    .size(48.dp)
                    .clickable(
                        role = Role.Button,
                        onClickLabel = "Reload portal"
                    ) {
                        lastInjectedKey = null
                        sessionStarted = false
                        webViewInstance?.apply {
                            resumeTimers()
                            onResume()
                            loadUrl("${AutomationScriptManager.PORTAL_BASE_URL}/")
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Primary),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "⟳",
                        color = OnDark,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Floating "Previous Attendance" Button
        if (!state.isLoggedIn && state.hasPreviousResult) {
            Box(
                modifier = Modifier
                    .padding(horizontal = 28.dp, vertical = 56.dp)
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(9999.dp))
                    .background(Primary)
                    .clickable(
                        role = Role.Button,
                        onClickLabel = "Load previous attendance"
                    ) { viewModel.handlePreviousAttendance() }
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "↺",
                        color = OnDark,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(end = 8.dp)
                    )
                    Text(
                        text = "Previous Attendance",
                        color = OnDark,
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        letterSpacing = 0.2.sp
                    )
                }
            }
        }
    }
}
