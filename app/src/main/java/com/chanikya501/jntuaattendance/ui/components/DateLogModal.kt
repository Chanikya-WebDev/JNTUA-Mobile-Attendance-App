package com.chanikya501.jntuaattendance.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chanikya501.jntuaattendance.model.AttendanceRecord
import com.chanikya501.jntuaattendance.model.AttendanceStatus
import com.chanikya501.jntuaattendance.model.SubjectAttendanceData
import com.chanikya501.jntuaattendance.ui.theme.BadgeGreenBg
import com.chanikya501.jntuaattendance.ui.theme.BadgeGreenText
import com.chanikya501.jntuaattendance.ui.theme.BadgeRedBg
import com.chanikya501.jntuaattendance.ui.theme.BadgeRedText
import com.chanikya501.jntuaattendance.ui.theme.BodyText
import com.chanikya501.jntuaattendance.ui.theme.CanvasBg
import com.chanikya501.jntuaattendance.ui.theme.CreamStrong
import com.chanikya501.jntuaattendance.ui.theme.Hairline
import com.chanikya501.jntuaattendance.ui.theme.HairlineSoft
import com.chanikya501.jntuaattendance.ui.theme.Ink
import com.chanikya501.jntuaattendance.ui.theme.Muted
import com.chanikya501.jntuaattendance.ui.theme.MutedSoft
import com.chanikya501.jntuaattendance.ui.theme.SerifFamily
import com.chanikya501.jntuaattendance.ui.theme.SurfaceCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateLogModal(
    subject: SubjectAttendanceData?,
    onDismiss: () -> Unit
) {
    if (subject == null) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

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
                        text = subject.subjectName,
                        fontFamily = SerifFamily,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Normal,
                        letterSpacing = (-0.3).sp,
                        color = Ink,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 24.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Attendance log · ${subject.present} attended, ${subject.absent} missed",
                        fontSize = 12.sp,
                        color = Muted
                    )
                }

                // Close Button with 48dp minimum touch target
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clickable(
                            role = Role.Button,
                            onClickLabel = "Close attendance log"
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

            // Records List
            LazyColumn(
                modifier = Modifier.fillMaxWidth()
            ) {
                itemsIndexed(subject.records) { _, record ->
                    RecordRow(record)
                    HorizontalDivider(color = HairlineSoft, thickness = 1.dp)
                }
            }
        }
    }
}

@Composable
private fun RecordRow(record: AttendanceRecord) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = record.date,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = Ink
            )
            if (record.time.isNotEmpty()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = record.time,
                    fontSize = 11.5.sp,
                    color = MutedSoft
                )
            }
        }

        val (statusText, statusBg, statusColor) = when (record.status) {
            AttendanceStatus.Present -> Triple("Present", BadgeGreenBg, BadgeGreenText)
            AttendanceStatus.Absent -> Triple("Absent", BadgeRedBg, BadgeRedText)
            AttendanceStatus.Unknown -> Triple("Unknown", SurfaceCard, Muted)
        }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(9999.dp))
                .background(statusBg)
                .padding(horizontal = 12.dp, vertical = 4.dp)
        ) {
            Text(
                text = statusText,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Medium,
                color = statusColor
            )
        }
    }
}
