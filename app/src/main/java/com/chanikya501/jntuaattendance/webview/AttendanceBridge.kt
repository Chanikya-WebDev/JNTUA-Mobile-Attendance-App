package com.chanikya501.jntuaattendance.webview

import com.chanikya501.jntuaattendance.util.AppLogger
import android.webkit.JavascriptInterface

class AttendanceBridge(
    private val onMessageReceived: (String) -> Unit
) {
    @JavascriptInterface
    fun postMessage(data: String?) {
        if (!data.isNullOrBlank()) {
            AppLogger.d("AttendanceBridge", "Bridge message: $data")
            onMessageReceived(data)
        } else {
            AppLogger.w("AttendanceBridge", "Received null or blank bridge message")
        }
    }
}
