package com.chanikya501.jntuaattendance

import com.chanikya501.jntuaattendance.network.IssueReportManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.URLDecoder

class IssueReportManagerTest {

    @Test
    fun buildRequestBodyWithStandardCategory() {
        val body = IssueReportManager.buildRequestBody(
            admissionNo = "24005A0501",
            selectedIssue = "Stuck on Syncing",
            customNote = "Testing issue submission",
            scraperVersion = "2026.10.18.1",
            currentIndex = 2,
            totalSubjects = 6,
            logs = "[10:00:00.000] [I/Scraper] Test log line"
        )

        val pairs = body.split("&").associate {
            val parts = it.split("=")
            URLDecoder.decode(parts[0], "UTF-8") to if (parts.size > 1) URLDecoder.decode(parts[1], "UTF-8") else ""
        }

        assertEquals("24005A0501", pairs[IssueReportManager.ENTRY_ADMISSION_NO])
        assertEquals("Stuck on Syncing", pairs[IssueReportManager.ENTRY_CATEGORY])
        assertFalse("Should not include other_option_response for preset category", pairs.containsKey(IssueReportManager.ENTRY_CATEGORY_OTHER))

        val diagnostics = pairs[IssueReportManager.ENTRY_DIAGNOSTICS] ?: ""
        assertTrue(diagnostics.contains("Admission No: 24005A0501"))
        assertTrue(diagnostics.contains("Selected Issue: Stuck on Syncing"))
        assertTrue(diagnostics.contains("User Note: Testing issue submission"))
        assertTrue(diagnostics.contains("Scraper Version: v2026.10.18.1"))
        assertTrue(diagnostics.contains("Current Index / Total Subjects: 2 / 6"))
        assertTrue(diagnostics.contains("[I/Scraper] Test log line"))
    }

    @Test
    fun buildRequestBodyWithOtherCategory() {
        val body = IssueReportManager.buildRequestBody(
            admissionNo = "24005A0502",
            selectedIssue = "Other",
            customNote = "Special unexpected edge case happened",
            scraperVersion = "1.0.0",
            currentIndex = 0,
            totalSubjects = null,
            logs = "Sample logs"
        )

        val pairs = body.split("&").associate {
            val parts = it.split("=")
            URLDecoder.decode(parts[0], "UTF-8") to if (parts.size > 1) URLDecoder.decode(parts[1], "UTF-8") else ""
        }

        assertEquals("24005A0502", pairs[IssueReportManager.ENTRY_ADMISSION_NO])
        assertEquals("__other_option__", pairs[IssueReportManager.ENTRY_CATEGORY])
        assertEquals("Special unexpected edge case happened", pairs[IssueReportManager.ENTRY_CATEGORY_OTHER])
    }

    @Test
    fun buildRequestBodyWithBlankAdmissionNoDefaultsToUnknown() {
        val body = IssueReportManager.buildRequestBody(
            admissionNo = "   ",
            selectedIssue = "App Crash",
            customNote = "",
            scraperVersion = "1.0.0",
            logs = "Crash log"
        )

        val pairs = body.split("&").associate {
            val parts = it.split("=")
            URLDecoder.decode(parts[0], "UTF-8") to if (parts.size > 1) URLDecoder.decode(parts[1], "UTF-8") else ""
        }

        assertEquals("UNKNOWN", pairs[IssueReportManager.ENTRY_ADMISSION_NO])
        assertEquals("App Crash", pairs[IssueReportManager.ENTRY_CATEGORY])
    }

    @Test
    fun buildDiagnosticPayloadTruncatesLargeLogsSafely() {
        val hugeLogs = buildString {
            repeat(1000) { i ->
                append("Log entry #$i: Some lengthy diagnostic log information that accumulates over time.\n")
            }
        }
        assertTrue("Generated test log should be well over 40k chars", hugeLogs.length > 50000)

        val payload = IssueReportManager.buildDiagnosticPayload(
            admissionNo = "24005A0501",
            selectedIssue = "Stuck on Syncing",
            customNote = "Big logs test",
            scraperVersion = "1.0.0",
            logs = hugeLogs
        )

        assertTrue("Diagnostic payload should be capped around 40k chars", payload.length <= 41000)
        assertTrue("Truncation notice should be present", payload.contains("...[logs truncated]..."))
        assertTrue("Header metadata should still be intact", payload.contains("Admission No: 24005A0501"))
        assertTrue("Header user note should still be intact", payload.contains("User Note: Big logs test"))
    }
}
