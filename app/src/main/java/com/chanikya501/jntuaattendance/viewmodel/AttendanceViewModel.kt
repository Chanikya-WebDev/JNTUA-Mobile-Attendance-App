package com.chanikya501.jntuaattendance.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.chanikya501.jntuaattendance.util.AppLogger
import com.chanikya501.jntuaattendance.model.BridgeMessage
import com.chanikya501.jntuaattendance.model.BridgeValidator
import com.chanikya501.jntuaattendance.model.PreviousAttendanceResult
import com.chanikya501.jntuaattendance.model.SubjectAttendanceData
import com.chanikya501.jntuaattendance.network.IssueReportManager
import com.chanikya501.jntuaattendance.network.NetworkMonitor
import com.chanikya501.jntuaattendance.network.ReportResult
import com.chanikya501.jntuaattendance.storage.AttendanceStorage
import com.chanikya501.jntuaattendance.webview.AutomationScriptManager
import com.chanikya501.jntuaattendance.webview.ScriptUpdateResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val RESET_SCRAPE_SESSION_JS =
    "(function(){try{sessionStorage.removeItem('fetchedSubjectCodes');sessionStorage.removeItem('scrapeActive');}catch(e){}})();true;"

class AttendanceViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(AttendanceUiState())
    val uiState: StateFlow<AttendanceUiState> = _uiState.asStateFlow()

    private val _jsCommands = MutableSharedFlow<String>(extraBufferCapacity = 16)
    val jsCommands: SharedFlow<String> = _jsCommands.asSharedFlow()

    private var stallJob: Job? = null
    private var persistedSignature: String? = null

    init {
        // Initialize AutomationScriptManager and load cached / bundled scraper script
        viewModelScope.launch {
            AutomationScriptManager.init(getApplication())
            _uiState.update { it.copy(scraperVersion = AutomationScriptManager.activeVersion.value) }
            checkForScriptUpdatesSilently()
        }

        // Hydrate saved previous result on startup
        viewModelScope.launch {
            val cached = AttendanceStorage.loadPreviousResult(getApplication())
            if (cached != null) {
                _uiState.update { it.copy(previousResult = cached, hasPreviousResult = true) }
            }
        }

        // Live network observer with automatic lifecycle unregistration
        viewModelScope.launch {
            NetworkMonitor.isOnlineFlow(getApplication()).collect { online ->
                _uiState.update { it.copy(isOffline = !online) }
                if (!online) {
                    stallJob?.cancel()
                } else {
                    resetStallWatchdog()
                    checkForScriptUpdatesSilently()
                }
            }
        }
    }

    private fun resetStallWatchdog() {
        stallJob?.cancel()
        val state = _uiState.value
        val isScrapingActive = state.isLoggedIn && !state.isScrapingFinished
        if (isScrapingActive && !state.isSelectionError && !state.isStructureError && !state.isOffline && !state.gatewayError) {
            AppLogger.d("AttendanceViewModel", "resetStallWatchdog: active for index ${state.currentIndex}")
            stallJob = viewModelScope.launch {
                delay(25000L)
                AppLogger.w("AttendanceViewModel", "Stall watchdog fired after 25s idle! Setting isSelectionError = true")
                _uiState.update { it.copy(isSelectionError = true) }
            }
        }
    }

    fun onPageLoadStarted() {
        AppLogger.d("AttendanceViewModel", "onPageLoadStarted: clearing offline/gateway errors")
        _uiState.update { it.copy(isOffline = false, gatewayError = false) }
        resetStallWatchdog()
    }

    fun onReceivedHttpError(statusCode: Int) {
        AppLogger.w("AttendanceViewModel", "onReceivedHttpError: status=$statusCode")
        if (statusCode == 502) {
            stallJob?.cancel()
            _uiState.update { it.copy(gatewayError = true) }
        }
    }

    fun onReceivedNetworkError() {
        AppLogger.e("AttendanceViewModel", "onReceivedNetworkError: setting isOffline = true")
        stallJob?.cancel()
        _uiState.update { it.copy(isOffline = true) }
    }

    fun handleReset() {
        AppLogger.i("AttendanceViewModel", "handleReset triggered: resetting state and bumping webViewKey")
        AppLogger.clear()
        stallJob?.cancel()
        _jsCommands.tryEmit(RESET_SCRAPE_SESSION_JS)
        try {
            android.webkit.CookieManager.getInstance().removeAllCookies(null)
            android.webkit.CookieManager.getInstance().flush()
        } catch (_: Exception) {}
        _uiState.update {
            AttendanceUiState(
                webViewKey = it.webViewKey + 1,
                hasPreviousResult = it.hasPreviousResult,
                previousResult = it.previousResult,
                scraperVersion = it.scraperVersion
            )
        }
    }

    fun handleClearSelectionError() {
        AppLogger.i("AttendanceViewModel", "handleClearSelectionError triggered")
        handleReset()
        resetStallWatchdog()
    }

    fun checkScriptUpdateManually() {
        viewModelScope.launch {
            _uiState.update { it.copy(isCheckingForScriptUpdate = true, scriptUpdateMessage = null) }
            when (val result = AutomationScriptManager.checkForUpdates(getApplication(), force = true)) {
                is ScriptUpdateResult.Success -> {
                    AppLogger.i("AttendanceViewModel", "Script updated to v${result.version}. Reloading portal...")
                    _uiState.update {
                        it.copy(
                            isCheckingForScriptUpdate = false,
                            scraperVersion = result.version,
                            scriptUpdateMessage = "Updated scraper to v${result.version}! Reloading...",
                            isStructureError = false,
                            structureErrorMessage = null
                        )
                    }
                    delay(800)
                    handleReset()
                }
                is ScriptUpdateResult.AlreadyLatest -> {
                    AppLogger.i("AttendanceViewModel", "Script is already on latest v${result.version}")
                    _uiState.update {
                        it.copy(
                            isCheckingForScriptUpdate = false,
                            scraperVersion = result.version,
                            scriptUpdateMessage = "Already on latest scraper v${result.version}"
                        )
                    }
                }
                is ScriptUpdateResult.Failed -> {
                    AppLogger.w("AttendanceViewModel", "Script update check failed: ${result.error}")
                    _uiState.update {
                        it.copy(
                            isCheckingForScriptUpdate = false,
                            scriptUpdateMessage = "Update check failed: ${result.error}"
                        )
                    }
                }
            }
        }
    }

    private fun checkForScriptUpdatesSilently() {
        viewModelScope.launch {
            try {
                when (val result = AutomationScriptManager.checkForUpdates(getApplication())) {
                    is ScriptUpdateResult.Success -> {
                        AppLogger.i("AttendanceViewModel", "Silent OTA update applied: v${result.version}")
                        _uiState.update { it.copy(scraperVersion = result.version) }
                    }
                    is ScriptUpdateResult.AlreadyLatest -> {
                        _uiState.update { it.copy(scraperVersion = result.version) }
                    }
                    is ScriptUpdateResult.Failed -> {
                        AppLogger.d("AttendanceViewModel", "Silent update check: ${result.error}")
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun openReportSheet(defaultIssue: String = "Stuck on Syncing") {
        AppLogger.i("AttendanceViewModel", "openReportSheet called with default: $defaultIssue")
        _uiState.update {
            it.copy(
                isReportSheetOpen = true,
                defaultReportIssue = defaultIssue,
                isSubmittingReport = false,
                reportStatusMessage = null,
                reportSubmittedSuccess = false
            )
        }
    }

    fun closeReportSheet() {
        AppLogger.i("AttendanceViewModel", "closeReportSheet called")
        _uiState.update {
            it.copy(
                isReportSheetOpen = false,
                isSubmittingReport = false,
                reportStatusMessage = null,
                reportSubmittedSuccess = false
            )
        }
    }

    fun submitIssueReport(admissionNo: String, selectedIssue: String, customNote: String) {
        val currentState = _uiState.value
        if (currentState.isSubmittingReport) return

        AppLogger.i("AttendanceViewModel", "Submitting issue report: issue=$selectedIssue, admission=$admissionNo")
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isSubmittingReport = true,
                    reportStatusMessage = null,
                    reportSubmittedSuccess = false
                )
            }

            val result = IssueReportManager.submitReport(
                admissionNo = admissionNo,
                selectedIssue = selectedIssue,
                customNote = customNote,
                scraperVersion = currentState.scraperVersion,
                currentIndex = currentState.currentIndex,
                totalSubjects = currentState.totalSubjects,
                logs = AppLogger.getLogs()
            )

            when (result) {
                is ReportResult.Success -> {
                    AppLogger.i("AttendanceViewModel", "Report submitted successfully")
                    _uiState.update {
                        it.copy(
                            isSubmittingReport = false,
                            reportSubmittedSuccess = true,
                            reportStatusMessage = "Report sent successfully! Thank you."
                        )
                    }
                    delay(1200)
                    closeReportSheet()
                }
                is ReportResult.Error -> {
                    AppLogger.e("AttendanceViewModel", "Report submission failed: ${result.message}")
                    _uiState.update {
                        it.copy(
                            isSubmittingReport = false,
                            reportSubmittedSuccess = false,
                            reportStatusMessage = result.message
                        )
                    }
                }
            }
        }
    }

    fun handleSelectSubject(subject: SubjectAttendanceData?) {
        _uiState.update { it.copy(selectedSubject = subject) }
    }

    fun handlePreviousAttendance() {
        val prev = _uiState.value.previousResult ?: return
        stallJob?.cancel()
        _uiState.update {
            it.copy(
                isLoggedIn = true,
                isScrapingFinished = true,
                studentInfo = prev.studentInfo,
                subjectsData = prev.subjectsData,
                currentIndex = 0,
                totalSubjects = prev.subjectsData.size,
                fetchedIndices = prev.subjectsData.indices.toSet(),
                fetchedSubCodes = prev.subjectsData.mapNotNull { s -> s.subCode?.trim()?.lowercase() }.toSet()
            )
        }
    }

    fun onBridgeMessage(raw: String) {
        viewModelScope.launch(Dispatchers.Default) {
            val message = BridgeValidator.parse(raw)
            if (message == null) {
                AppLogger.w("AttendanceViewModel", "Ignored invalid bridge message: $raw")
                return@launch
            }
            AppLogger.i("AttendanceViewModel", "Bridge message received: ${message.javaClass.simpleName}")
            when (message) {
                is BridgeMessage.StudentInfoMsg -> {
                    AppLogger.i("AttendanceViewModel", "Student logged in: ${message.data.sname} (${message.data.admissionNo})")
                    _uiState.update { it.copy(isLoggedIn = true, studentInfo = message.data) }
                    resetStallWatchdog()
                }

                is BridgeMessage.SubjectCountMsg -> {
                    AppLogger.i("AttendanceViewModel", "Subject count reported: ${message.count}")
                    _uiState.update { current ->
                        if (current.totalSubjects == message.count) current
                        else current.copy(totalSubjects = message.count)
                    }
                    resetStallWatchdog()
                }

                is BridgeMessage.AttendanceItemMsg -> {
                    val item = message.data
                    val subCode = item.subCode?.trim().orEmpty()
                    val subCodeNorm = subCode.lowercase()
                    AppLogger.i("AttendanceViewModel", "Attendance item: $subCode, pct=${item.percentage}%, present=${item.present}/${item.total}")

                    _uiState.update { current ->
                        if (subCodeNorm.isNotEmpty() && current.fetchedSubCodes.contains(subCodeNorm)) {
                            AppLogger.d("AttendanceViewModel", "Duplicate subcode skipped: $subCodeNorm")
                            return@update current
                        }
                        if (subCodeNorm.isEmpty() && current.fetchedIndices.contains(current.currentIndex)) {
                            AppLogger.d("AttendanceViewModel", "Duplicate index skipped: ${current.currentIndex}")
                            return@update current
                        }

                        val nextIndex = current.currentIndex + 1
                        val finished = current.totalSubjects != null && nextIndex >= current.totalSubjects

                        val updatedFetchedSubCodes = if (subCodeNorm.isNotEmpty()) {
                            current.fetchedSubCodes + subCodeNorm
                        } else current.fetchedSubCodes

                        val updatedSubjects = current.subjectsData + item

                        val newState = current.copy(
                            fetchedIndices = current.fetchedIndices + current.currentIndex,
                            fetchedSubCodes = updatedFetchedSubCodes,
                            subjectsData = updatedSubjects,
                            currentIndex = if (finished) current.currentIndex else nextIndex,
                            isScrapingFinished = if (finished) true else current.isScrapingFinished
                        )

                        AppLogger.i("AttendanceViewModel", "Scraping progress: ${newState.subjectsData.size}/${newState.totalSubjects ?: "?"} subjects (finished=$finished)")

                        if (newState.isScrapingFinished) {
                            AppLogger.i("AttendanceViewModel", "All subjects finished, persisting result")
                            stallJob?.cancel()
                            checkAndPersistResult(newState)
                        }

                        newState
                    }
                    resetStallWatchdog()
                }

                is BridgeMessage.SubjectSkippedMsg -> {
                    val subNorm = message.subCode.trim().lowercase()
                    AppLogger.i("AttendanceViewModel", "Subject skipped: ${message.subCode} at index ${message.index}")
                    _uiState.update { current ->
                        val skippedIdx = message.index.takeIf { it >= 0 } ?: current.currentIndex
                        val nextIndex = maxOf(skippedIdx + 1, current.currentIndex + 1)
                        val finished = current.totalSubjects != null && nextIndex >= current.totalSubjects
                        val updatedSubCodes = if (subNorm.isNotBlank()) current.fetchedSubCodes + subNorm else current.fetchedSubCodes
                        val newState = current.copy(
                            fetchedIndices = current.fetchedIndices + skippedIdx,
                            fetchedSubCodes = updatedSubCodes,
                            currentIndex = if (finished) current.currentIndex else nextIndex,
                            isScrapingFinished = if (finished) true else current.isScrapingFinished
                        )
                        if (newState.isScrapingFinished) {
                            AppLogger.i("AttendanceViewModel", "All subjects finished via skip, persisting result")
                            stallJob?.cancel()
                            checkAndPersistResult(newState)
                        }
                        newState
                    }
                    resetStallWatchdog()
                }

                is BridgeMessage.ScrapeErrorMsg -> {
                    AppLogger.e("AttendanceViewModel", "ScrapeError: ${message.message}")
                    stallJob?.cancel()
                    _uiState.update {
                        it.copy(
                            isStructureError = true,
                            structureErrorMessage = message.message
                        )
                    }
                }

                is BridgeMessage.ScrapeIdleMsg -> {
                    AppLogger.w("AttendanceViewModel", "ScrapeIdle: ${message.reason}")
                    resetStallWatchdog()
                }

                is BridgeMessage.StructureChangedMsg -> {
                    AppLogger.e("AttendanceViewModel", "StructureChanged error received")
                    stallJob?.cancel()
                    _uiState.update { it.copy(isStructureError = true) }
                }

                is BridgeMessage.ScrapingCompleteMsg -> {
                    AppLogger.i("AttendanceViewModel", "ScrapingComplete received")
                    stallJob?.cancel()
                    _uiState.update { current ->
                        val newState = current.copy(isScrapingFinished = true)
                        checkAndPersistResult(newState)
                        newState
                    }
                }
            }
        }
    }

    private fun checkAndPersistResult(state: AttendanceUiState) {
        val info = state.studentInfo ?: return
        if (state.subjectsData.isEmpty() || !state.isLoggedIn || !state.isScrapingFinished) return

        val totalClasses = state.subjectsData.sumOf { it.total }
        val present = state.subjectsData.sumOf { it.present }
        val absent = state.subjectsData.sumOf { it.absent }
        val sig = "${info.sname}|${state.subjectsData.size}|$totalClasses|$present|$absent"

        if (persistedSignature == sig) return
        persistedSignature = sig

        val result = PreviousAttendanceResult(info, state.subjectsData)
        viewModelScope.launch {
            AttendanceStorage.savePreviousResult(getApplication(), result)
            _uiState.update { it.copy(previousResult = result, hasPreviousResult = true) }
        }
    }
}
