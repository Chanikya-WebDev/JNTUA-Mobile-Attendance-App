package com.chanikya501.jntuaattendance.network

import com.chanikya501.jntuaattendance.util.AppLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

sealed class ReportResult {
    object Success : ReportResult()
    data class Error(val message: String) : ReportResult()
}

object IssueReportManager {
    private const val TAG = "IssueReportManager"
    const val FORM_ENDPOINT = "https://docs.google.com/forms/d/e/1FAIpQLSfzUCcDuFmpMXCDi5W9mYZeXHxJEk5JSP8F1UlNs2oA3gTehA/formResponse"

    const val ENTRY_ADMISSION_NO = "entry.2024077478"
    const val ENTRY_CATEGORY = "entry.830415231"
    const val ENTRY_CATEGORY_OTHER = "entry.830415231.other_option_response"
    const val ENTRY_DIAGNOSTICS = "entry.1047223928"

    val PRESET_CATEGORIES = listOf(
        "Stuck on Syncing",
        "Wrong Attendance %",
        "Captcha / Login Issue",
        "App Crash",
        "Network Timeout",
        "Other"
    )

    fun buildDiagnosticPayload(
        admissionNo: String,
        selectedIssue: String,
        customNote: String,
        scraperVersion: String,
        currentIndex: Int = 0,
        totalSubjects: Int? = null,
        logs: String = AppLogger.getLogs()
    ): String {
        val maxLen = 40000
        val header = buildString {
            append("Admission No: ${admissionNo.trim().ifBlank { "UNKNOWN" }}\n")
            append("Selected Issue: $selectedIssue\n")
            append("User Note: ${customNote.trim().ifBlank { "None" }}\n")
            append("Scraper Version: v$scraperVersion\n")
            append("Current Index / Total Subjects: $currentIndex / ${totalSubjects ?: "N/A"}\n\n")
        }
        val safeLogs = if (logs.length > maxLen) {
            val keepLen = maxLen - header.length - 50
            "...[logs truncated]...\n" + logs.takeLast(maxOf(keepLen, 1000))
        } else {
            logs
        }
        return header + safeLogs
    }

    fun buildRequestBody(
        admissionNo: String,
        selectedIssue: String,
        customNote: String,
        scraperVersion: String,
        currentIndex: Int = 0,
        totalSubjects: Int? = null,
        logs: String = AppLogger.getLogs()
    ): String {
        val cleanAdmissionNo = admissionNo.trim().ifBlank { "UNKNOWN" }
        val isOther = selectedIssue.trim().equals("Other", ignoreCase = true)
        val params = mutableMapOf(
            ENTRY_ADMISSION_NO to cleanAdmissionNo,
            ENTRY_CATEGORY to if (isOther) "__other_option__" else selectedIssue.trim(),
            ENTRY_DIAGNOSTICS to buildDiagnosticPayload(
                cleanAdmissionNo,
                selectedIssue,
                customNote,
                scraperVersion,
                currentIndex,
                totalSubjects,
                logs
            )
        )
        if (isOther) {
            params[ENTRY_CATEGORY_OTHER] = customNote.trim().ifBlank { "Other" }
        }

        return params.entries.joinToString("&") { (key, value) ->
            "${URLEncoder.encode(key, "UTF-8")}=${URLEncoder.encode(value, "UTF-8")}"
        }
    }

    suspend fun submitReport(
        admissionNo: String,
        selectedIssue: String,
        customNote: String,
        scraperVersion: String,
        currentIndex: Int = 0,
        totalSubjects: Int? = null,
        logs: String = AppLogger.getLogs()
    ): ReportResult = withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            val body = buildRequestBody(
                admissionNo = admissionNo,
                selectedIssue = selectedIssue,
                customNote = customNote,
                scraperVersion = scraperVersion,
                currentIndex = currentIndex,
                totalSubjects = totalSubjects,
                logs = logs
            )

            val url = URL(FORM_ENDPOINT)
            connection = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 10000
                readTimeout = 10000
                requestMethod = "POST"
                doOutput = true
                instanceFollowRedirects = true
                setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                setRequestProperty("User-Agent", "JNTUAAttendance/1.0")
            }

            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(body)
                writer.flush()
            }

            val responseCode = connection.responseCode
            AppLogger.i(TAG, "Report submission HTTP response: $responseCode")

            if (responseCode in 200..299) {
                ReportResult.Success
            } else {
                ReportResult.Error("HTTP error $responseCode from form server")
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Failed to submit issue report: ${e.message}", e)
            ReportResult.Error(e.message ?: "Failed to send report. Please check your network connection.")
        } finally {
            connection?.disconnect()
        }
    }
}
