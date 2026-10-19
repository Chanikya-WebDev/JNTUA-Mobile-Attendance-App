package com.chanikya501.jntuaattendance.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chanikya501.jntuaattendance.network.IssueReportManager
import com.chanikya501.jntuaattendance.ui.theme.BodyText
import com.chanikya501.jntuaattendance.ui.theme.CanvasBg
import com.chanikya501.jntuaattendance.ui.theme.CreamStrong
import com.chanikya501.jntuaattendance.ui.theme.ErrorRed
import com.chanikya501.jntuaattendance.ui.theme.Hairline
import com.chanikya501.jntuaattendance.ui.theme.HairlineSoft
import com.chanikya501.jntuaattendance.ui.theme.Ink
import com.chanikya501.jntuaattendance.ui.theme.LiveGreen
import com.chanikya501.jntuaattendance.ui.theme.Muted
import com.chanikya501.jntuaattendance.ui.theme.MutedSoft
import com.chanikya501.jntuaattendance.ui.theme.OnDark
import com.chanikya501.jntuaattendance.ui.theme.Primary
import com.chanikya501.jntuaattendance.ui.theme.SerifFamily
import com.chanikya501.jntuaattendance.ui.theme.SurfaceCard
import com.chanikya501.jntuaattendance.util.AppLogger
import com.chanikya501.jntuaattendance.viewmodel.AttendanceUiState

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ReportIssueModal(
    state: AttendanceUiState,
    onDismiss: () -> Unit,
    onSubmit: (admissionNo: String, category: String, note: String) -> Unit
) {
    if (!state.isReportSheetOpen) return

    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scrollState = rememberScrollState()

    var admissionNo by remember(state.studentInfo) {
        mutableStateOf(state.studentInfo?.admissionNo ?: "")
    }
    var selectedCategory by remember(state.defaultReportIssue) {
        mutableStateOf(state.defaultReportIssue)
    }
    var customNote by remember { mutableStateOf("") }

    val isOtherSelected = selectedCategory.trim().equals("Other", ignoreCase = true)
    val isOtherEmpty = isOtherSelected && customNote.isBlank()
    val canSubmit = !state.isSubmittingReport &&
        !state.reportSubmittedSuccess &&
        (!isOtherSelected || customNote.isNotBlank())

    val logLinesCount = remember {
        AppLogger.getLogs().lines().count { it.isNotBlank() }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CanvasBg,
        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .size(width = 36.dp, height = 4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(CreamStrong)
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
        ) {
            // Header Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                    Text(
                        text = "Report an Issue",
                        fontFamily = SerifFamily,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Normal,
                        letterSpacing = (-0.3).sp,
                        color = Ink
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Diagnostic logs and scraper version (v${state.scraperVersion}) will be attached automatically.",
                        fontSize = 12.sp,
                        color = Muted,
                        lineHeight = 16.sp
                    )
                }

                // Close Button (48dp touch target, 32dp visual circle)
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clickable(
                            role = Role.Button,
                            onClickLabel = "Close report issue"
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
                        Text(
                            text = "✕",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = BodyText
                        )
                    }
                }
            }

            HorizontalDivider(color = HairlineSoft, thickness = 1.dp)
            Spacer(modifier = Modifier.height(16.dp))

            // Admission No Input
            Text(
                text = "ROLL / ADMISSION NO",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 1.2.sp,
                color = Muted
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = admissionNo,
                onValueChange = { admissionNo = it },
                placeholder = { Text("e.g. 24005A0501", fontSize = 13.5.sp, color = MutedSoft) },
                singleLine = true,
                shape = RoundedCornerShape(8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary,
                    unfocusedBorderColor = Hairline,
                    focusedTextColor = Ink,
                    unfocusedTextColor = Ink,
                    cursorColor = Primary,
                    focusedContainerColor = SurfaceCard,
                    unfocusedContainerColor = SurfaceCard
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Category Chips
            Text(
                text = "ISSUE CATEGORY",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 1.2.sp,
                color = Muted
            )
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                IssueReportManager.PRESET_CATEGORIES.forEach { category ->
                    val isSelected = category.equals(selectedCategory, ignoreCase = true)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(9999.dp))
                            .background(if (isSelected) Primary else SurfaceCard)
                            .border(1.dp, if (isSelected) Primary else Hairline, RoundedCornerShape(9999.dp))
                            .clickable(
                                role = Role.RadioButton,
                                onClickLabel = "Select $category"
                            ) { selectedCategory = category }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = category,
                            fontSize = 12.5.sp,
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                            color = if (isSelected) OnDark else BodyText
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Custom Description Input
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "DESCRIPTION",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 1.2.sp,
                    color = Muted
                )
                if (isOtherSelected) {
                    Text(
                        text = "Required for Other",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (customNote.isBlank()) ErrorRed else MutedSoft
                    )
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = customNote,
                onValueChange = { customNote = it },
                placeholder = {
                    Text(
                        text = if (isOtherSelected) "Please describe what happened (required)..."
                        else "Describe what happened (optional)...",
                        fontSize = 13.5.sp,
                        color = MutedSoft
                    )
                },
                minLines = 3,
                maxLines = 5,
                shape = RoundedCornerShape(8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = if (isOtherEmpty) ErrorRed else Primary,
                    unfocusedBorderColor = if (isOtherEmpty) ErrorRed else Hairline,
                    focusedTextColor = Ink,
                    unfocusedTextColor = Ink,
                    cursorColor = Primary,
                    focusedContainerColor = SurfaceCard,
                    unfocusedContainerColor = SurfaceCard
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Diagnostics Logs Attached Pill
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(SurfaceCard)
                    .border(1.dp, Hairline, RoundedCornerShape(8.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "✓ Diagnostic logs attached ($logLinesCount lines) • Scraper v${state.scraperVersion}",
                        fontSize = 11.5.sp,
                        color = Muted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable(
                            role = Role.Button,
                            onClickLabel = "Copy diagnostic logs to clipboard"
                        ) { AppLogger.copyLogsToClipboard(context) }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Copy Logs",
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = Primary
                    )
                }
            }

            if (state.reportStatusMessage != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = state.reportStatusMessage,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (state.reportSubmittedSuccess) LiveGreen else ErrorRed,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Submit Button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        when {
                            state.reportSubmittedSuccess -> LiveGreen
                            canSubmit -> Primary
                            else -> MutedSoft.copy(alpha = 0.5f)
                        }
                    )
                    .clickable(
                        enabled = canSubmit,
                        role = Role.Button,
                        onClickLabel = "Send Report"
                    ) {
                        onSubmit(admissionNo, selectedCategory, customNote)
                    }
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = when {
                        state.reportSubmittedSuccess -> "Report Sent ✓"
                        state.isSubmittingReport -> "Sending Report..."
                        else -> "Send Report"
                    },
                    color = OnDark,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
