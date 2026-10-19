package com.chanikya501.jntuaattendance.ui.views

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chanikya501.jntuaattendance.ui.components.CrabScene
import com.chanikya501.jntuaattendance.ui.theme.BodyText
import com.chanikya501.jntuaattendance.ui.theme.CanvasBg
import com.chanikya501.jntuaattendance.ui.theme.ErrorRed
import com.chanikya501.jntuaattendance.ui.theme.Hairline
import com.chanikya501.jntuaattendance.ui.theme.Ink
import com.chanikya501.jntuaattendance.ui.theme.Muted
import com.chanikya501.jntuaattendance.ui.theme.MutedSoft
import com.chanikya501.jntuaattendance.ui.theme.OnDark
import com.chanikya501.jntuaattendance.ui.theme.Primary
import com.chanikya501.jntuaattendance.ui.theme.SerifFamily
import com.chanikya501.jntuaattendance.ui.theme.SurfaceCard
import com.chanikya501.jntuaattendance.util.AppLogger
import com.chanikya501.jntuaattendance.viewmodel.AttendanceUiState
import com.chanikya501.jntuaattendance.viewmodel.AttendanceViewModel

@Composable
fun OverlayScreensView(
    state: AttendanceUiState,
    viewModel: AttendanceViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    // Priority: offline > gateway > structure > selection > syncing
    when {
        state.isOffline -> {
            FullScreenOverlay(modifier) {
                CrabScene()
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    text = "No Internet\nConnection",
                    fontFamily = SerifFamily,
                    fontSize = 26.sp,
                    color = Ink,
                    lineHeight = 31.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Please check your network settings and try again.",
                    fontSize = 12.5.sp,
                    color = Muted,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(24.dp))
                ActionButton(
                    text = "Retry",
                    color = Primary,
                    onClick = { viewModel.handleReset() }
                )
            }
        }

        state.gatewayError -> {
            FullScreenOverlay(modifier) {
                CrabScene()
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    text = "Main attendance\nwebsite is not working",
                    fontFamily = SerifFamily,
                    fontSize = 26.sp,
                    color = Ink,
                    lineHeight = 31.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "The portal is temporarily unavailable (502).",
                    fontSize = 12.5.sp,
                    color = Muted,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(24.dp))
                ActionButton(
                    text = "Try again",
                    color = ErrorRed,
                    onClick = { viewModel.handleReset() }
                )
                Spacer(modifier = Modifier.height(8.dp))
                SecondaryButton(
                    text = "Report Issue to Developer",
                    onClick = { viewModel.openReportSheet("Network Timeout") }
                )
            }
        }

        state.isStructureError -> {
            FullScreenOverlay(modifier) {
                ErrorCard(
                    title = "Portal Layout Changed",
                    description = state.structureErrorMessage
                        ?: "The original attendance website modified its internal structure. You can check for an over-the-air scraper update now.",
                    scraperVersion = state.scraperVersion,
                    scriptUpdateMessage = state.scriptUpdateMessage,
                    isCheckingForScriptUpdate = state.isCheckingForScriptUpdate,
                    onCheckUpdate = {
                        if (!state.isCheckingForScriptUpdate) viewModel.checkScriptUpdateManually()
                    },
                    onReload = { viewModel.handleReset() },
                    onReportIssue = { viewModel.openReportSheet("Stuck on Syncing") },
                    onCopyLogs = { AppLogger.copyLogsToClipboard(context) }
                )
            }
        }

        state.isSelectionError && state.isLoggedIn && !state.isScrapingFinished -> {
            FullScreenOverlay(modifier) {
                ErrorCard(
                    title = "Couldn’t load subjects right now",
                    description = "The attendance portal was recently updated, so the app can’t detect your semester or subjects at the moment. This is a temporary issue — we’re working on a fix.",
                    scraperVersion = state.scraperVersion,
                    scriptUpdateMessage = state.scriptUpdateMessage,
                    isCheckingForScriptUpdate = state.isCheckingForScriptUpdate,
                    onCheckUpdate = {
                        if (!state.isCheckingForScriptUpdate) viewModel.checkScriptUpdateManually()
                    },
                    onReload = { viewModel.handleReset() },
                    onReportIssue = { viewModel.openReportSheet("Stuck on Syncing") },
                    onCopyLogs = { AppLogger.copyLogsToClipboard(context) },
                    onDismiss = { viewModel.handleClearSelectionError() }
                )
            }
        }


        state.isLoggedIn && !state.isScrapingFinished -> {
            FullScreenOverlay(modifier) {
                CrabScene()
                Spacer(modifier = Modifier.height(20.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(9999.dp))
                        .background(SurfaceCard)
                        .border(1.dp, Hairline, RoundedCornerShape(9999.dp))
                        .padding(horizontal = 14.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "SYNCING",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 1.6.sp,
                        color = Primary
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Reading your\nsemester",
                    fontFamily = SerifFamily,
                    fontSize = 28.sp,
                    color = Ink,
                    lineHeight = 33.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (state.totalSubjects != null) {
                        "Processed ${state.fetchedIndices.size} of ${state.totalSubjects} subjects"
                    } else {
                        "Authenticating session…"
                    },
                    fontSize = 13.sp,
                    color = Muted,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = "${state.syncPct}",
                        fontFamily = SerifFamily,
                        fontSize = 56.sp,
                        letterSpacing = (-2).sp,
                        color = Primary
                    )
                    Text(
                        text = "%",
                        fontSize = 24.sp,
                        color = MutedSoft,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                }
                Spacer(modifier = Modifier.height(14.dp))
                Text(
                    text = "Secure session · jntuaceastudents.classattendance.in",
                    fontSize = 11.sp,
                    color = MutedSoft,
                    letterSpacing = 0.3.sp
                )
                Spacer(modifier = Modifier.height(24.dp))
                SecondaryButton(
                    text = "Cancel",
                    onClick = { viewModel.handleReset() }
                )
            }
        }
    }
}

@Composable
private fun FullScreenOverlay(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(CanvasBg)
            .padding(horizontal = 28.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            content()
        }
    }
}

@Composable
private fun ErrorIcon() {
    Box(
        modifier = Modifier
            .size(34.dp)
            .clip(CircleShape)
            .background(ErrorRed),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "!",
            color = OnDark,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun ActionButton(
    text: String,
    color: Color,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(color)
            .clickable(
                role = Role.Button,
                onClickLabel = text
            ) { onClick() }
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = OnDark,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp
        )
    }
}

@Composable
private fun SecondaryButton(
    text: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(SurfaceCard)
            .border(1.dp, Hairline, RoundedCornerShape(8.dp))
            .clickable(
                role = Role.Button,
                onClickLabel = text
            ) { onClick() }
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = BodyText,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp
        )
    }
}

@Composable
private fun TextActionButton(
    text: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .clickable(
                role = Role.Button,
                onClickLabel = text
            ) { onClick() }
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = Muted,
            fontWeight = FontWeight.Medium,
            fontSize = 12.5.sp
        )
    }
}

@Composable
private fun ErrorCard(
    title: String,
    description: String,
    scraperVersion: String,
    scriptUpdateMessage: String?,
    isCheckingForScriptUpdate: Boolean,
    onCheckUpdate: () -> Unit,
    onReload: () -> Unit,
    onReportIssue: () -> Unit,
    onCopyLogs: () -> Unit,
    onDismiss: (() -> Unit)? = null
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CanvasBg)
            .border(1.dp, Hairline, RoundedCornerShape(12.dp))
            .padding(24.dp)
    ) {
        if (onDismiss != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(48.dp)
                    .clickable(
                        role = Role.Button,
                        onClickLabel = "Dismiss error"
                    ) { onDismiss() },
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(CanvasBg)
                        .border(1.dp, Hairline, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "✕", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = BodyText)
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = if (onDismiss != null) 8.dp else 0.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            ErrorIcon()
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = title,
                fontFamily = SerifFamily,
                fontSize = 19.sp,
                color = Ink,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = description,
                fontSize = 13.sp,
                color = Muted,
                lineHeight = 19.sp,
                textAlign = TextAlign.Center
            )
            if (scriptUpdateMessage != null) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = scriptUpdateMessage,
                    fontSize = 12.sp,
                    color = Primary,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            ActionButton(
                text = if (isCheckingForScriptUpdate) "Checking for updates…" else "Check for Scraper Update",
                color = Primary,
                onClick = onCheckUpdate
            )
            Spacer(modifier = Modifier.height(8.dp))
            SecondaryButton(
                text = "Reload Portal",
                onClick = onReload
            )
            Spacer(modifier = Modifier.height(8.dp))
            SecondaryButton(
                text = "Report Issue to Developer",
                onClick = onReportIssue
            )
            Spacer(modifier = Modifier.height(6.dp))
            TextActionButton(
                text = "Copy Diagnostic Logs",
                onClick = onCopyLogs
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "Scraper Version: v$scraperVersion",
                fontSize = 11.sp,
                color = MutedSoft
            )
        }
    }
}

