package com.chanikya501.jntuaattendance.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.chanikya501.jntuaattendance.ui.components.DateLogModal
import com.chanikya501.jntuaattendance.ui.components.ReportIssueModal
import com.chanikya501.jntuaattendance.ui.theme.CanvasBg
import com.chanikya501.jntuaattendance.ui.views.DashboardView
import com.chanikya501.jntuaattendance.ui.views.OverlayScreensView
import com.chanikya501.jntuaattendance.ui.views.WebViewScraperView
import com.chanikya501.jntuaattendance.viewmodel.AttendanceViewModel

@Composable
fun AttendanceApp(
    viewModel: AttendanceViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()

    // Enable back handling only when there is an active modal, dashboard, or dismissible error.
    // At root, disabling the handler lets Android's native predictive back gesture and exit work automatically.
    val hasBackAction = state.isReportSheetOpen ||
        state.selectedSubject != null ||
        (state.isScrapingFinished && state.isLoggedIn) ||
        state.isSelectionError

    BackHandler(enabled = hasBackAction) {
        when {
            state.isReportSheetOpen -> viewModel.closeReportSheet()
            state.selectedSubject != null -> viewModel.handleSelectSubject(null)
            state.isScrapingFinished && state.isLoggedIn -> viewModel.handleReset()
            state.isSelectionError -> viewModel.handleClearSelectionError()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(CanvasBg)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Scraper / WebView layer: active only during login and automated scraping.
        // Once total results are calculated (isScrapingFinished), the WebView is completely
        // unmounted and destroyed, guaranteeing that no web pages are visible behind the UI dashboard.
        if (!state.isScrapingFinished) {
            WebViewScraperView(
                state = state,
                viewModel = viewModel
            )
        }

        // Error & Syncing Overlays
        OverlayScreensView(
            state = state,
            viewModel = viewModel
        )

        // Dashboard layer
        if (state.isLoggedIn && state.isScrapingFinished) {
            DashboardView(
                studentInfo = state.studentInfo,
                subjectsData = state.subjectsData,
                onSelectSubject = { subject -> viewModel.handleSelectSubject(subject) },
                onFullReset = { viewModel.handleReset() },
                onReportIssue = { viewModel.openReportSheet("Wrong Attendance %") }
            )
        }

        // Attendance Log Bottom Sheet Modal
        DateLogModal(
            subject = state.selectedSubject,
            onDismiss = { viewModel.handleSelectSubject(null) }
        )

        // Report Issue Bottom Sheet Modal
        ReportIssueModal(
            state = state,
            onDismiss = { viewModel.closeReportSheet() },
            onSubmit = { admissionNo, category, note ->
                viewModel.submitIssueReport(admissionNo, category, note)
            }
        )
    }
}
