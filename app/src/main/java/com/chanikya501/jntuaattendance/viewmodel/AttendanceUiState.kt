package com.chanikya501.jntuaattendance.viewmodel

import com.chanikya501.jntuaattendance.model.PreviousAttendanceResult
import com.chanikya501.jntuaattendance.model.StudentInfo
import com.chanikya501.jntuaattendance.model.SubjectAttendanceData

enum class ScrapingState {
    IDLE,
    DISCOVERING,
    SUBMITTING,
    PARSING,
    COMPLETED,
    ERROR
}

data class AttendanceUiState(
    val webViewKey: Int = 0,
    val isLoggedIn: Boolean = false,
    val studentInfo: StudentInfo? = null,
    val currentIndex: Int = 0,
    val totalSubjects: Int? = null,
    val fetchedIndices: Set<Int> = emptySet(),
    val fetchedSubCodes: Set<String> = emptySet(),
    val subjectsData: List<SubjectAttendanceData> = emptyList(),
    val isScrapingFinished: Boolean = false,
    val selectedSubject: SubjectAttendanceData? = null,
    val hasPreviousResult: Boolean = false,
    val previousResult: PreviousAttendanceResult? = null,
    val isSelectionError: Boolean = false,
    val isStructureError: Boolean = false,
    val structureErrorMessage: String? = null,
    val isOffline: Boolean = false,
    val gatewayError: Boolean = false,
    val isCheckingForScriptUpdate: Boolean = false,
    val scriptUpdateMessage: String? = null,
    val scraperVersion: String = "1.0.0",
    val isReportSheetOpen: Boolean = false,
    val defaultReportIssue: String = "Stuck on Syncing",
    val isSubmittingReport: Boolean = false,
    val reportStatusMessage: String? = null,
    val reportSubmittedSuccess: Boolean = false,
    val scrapingState: ScrapingState = ScrapingState.IDLE,
    val sessionId: String = "",
    val retryCount: Int = 0
) {
    val syncPct: Int
        get() {
            val total = totalSubjects ?: return 0
            if (total <= 0) return 0
            return ((fetchedIndices.size.toDouble() / total.toDouble()) * 100.0).toInt().coerceIn(0, 100)
        }
}
