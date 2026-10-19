package com.chanikya501.jntuaattendance.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.util.Log
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedDeque

object AppLogger {
    private const val MAX_LOGS = 500
    private val logBuffer = ConcurrentLinkedDeque<String>()
    private val dateFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)

    private fun addEntry(level: String, tag: String, message: String) {
        val time = dateFormat.format(Date())
        val entry = "[$time] [$level/$tag] $message"
        logBuffer.addLast(entry)
        while (logBuffer.size > MAX_LOGS) {
            logBuffer.pollFirst()
        }
    }

    fun d(tag: String, message: String) {
        Log.d(tag, message)
        addEntry("D", tag, message)
    }

    fun i(tag: String, message: String) {
        Log.i(tag, message)
        addEntry("I", tag, message)
    }

    fun w(tag: String, message: String) {
        Log.w(tag, message)
        addEntry("W", tag, message)
    }

    fun e(tag: String, message: String, throwable: Throwable? = null) {
        val msg = if (throwable != null) "$message\n${Log.getStackTraceString(throwable)}" else message
        Log.e(tag, msg)
        addEntry("E", tag, msg)
    }

    fun getLogs(): String {
        val sb = StringBuilder()
        sb.append("=== JNTUA Attendance Diagnostic Log ===\n")
        sb.append("Device: ${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE}, API ${Build.VERSION.SDK_INT})\n")
        sb.append("Time: ${Date()}\n")
        sb.append("Total entries: ${logBuffer.size}\n")
        sb.append("========================================\n\n")
        for (entry in logBuffer) {
            sb.append(entry).append("\n")
        }
        sb.append("\n=== End of Diagnostic Log ===")
        return sb.toString()
    }

    fun copyLogsToClipboard(context: Context) {
        try {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            val logs = getLogs()
            val clip = ClipData.newPlainText("JNTUA Attendance Logs", logs)
            clipboard?.setPrimaryClip(clip)
            Toast.makeText(context, "Logs copied to clipboard (${logBuffer.size} lines)", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e("AppLogger", "Failed to copy logs to clipboard", e)
            Toast.makeText(context, "Failed to copy logs: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    fun clear() {
        logBuffer.clear()
    }
}
