package com.chanikya501.jntuaattendance.ui.views

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chanikya501.jntuaattendance.math.AttendanceMath
import com.chanikya501.jntuaattendance.model.StudentInfo
import com.chanikya501.jntuaattendance.model.SubjectAttendanceData
import com.chanikya501.jntuaattendance.ui.components.Spike
import com.chanikya501.jntuaattendance.ui.theme.Amber
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
import com.chanikya501.jntuaattendance.ui.theme.OnDarkSoft
import com.chanikya501.jntuaattendance.ui.theme.Primary
import com.chanikya501.jntuaattendance.ui.theme.SerifFamily
import com.chanikya501.jntuaattendance.ui.theme.Success
import com.chanikya501.jntuaattendance.ui.theme.SurfaceCard
import com.chanikya501.jntuaattendance.ui.theme.SurfaceDark

private const val GITHUB_URL = "https://github.com/Chanikya-WebDev/JNTUA-Mobile-Attendance-App"

private fun getAttendanceColor(percentage: Double): Color = when {
    percentage < AttendanceMath.ATTENDANCE_THRESHOLD -> ErrorRed
    percentage <= 77.0 -> Amber
    else -> Success
}

@Composable
fun DashboardView(
    studentInfo: StudentInfo?,
    subjectsData: List<SubjectAttendanceData>,
    onSelectSubject: (SubjectAttendanceData) -> Unit,
    onFullReset: () -> Unit,
    onReportIssue: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val stats = remember(subjectsData) { AttendanceMath.computeOverallStats(subjectsData) }
    val context = LocalContext.current

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(CanvasBg)
            .padding(horizontal = 20.dp)
    ) {
        // Top Signature Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Spike(size = 14.dp, color = Primary)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Chanikya",
                    fontFamily = SerifFamily,
                    fontStyle = FontStyle.Italic,
                    fontSize = 23.sp,
                    letterSpacing = (-0.4).sp,
                    color = Ink
                )
                Text(
                    text = "·dev",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 1.4.sp,
                    color = MutedSoft,
                    modifier = Modifier.padding(start = 7.dp, top = 3.dp)
                )
            }

            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clickable(
                        role = Role.Button,
                        onClickLabel = "Reset Attendance"
                    ) { onFullReset() },
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(CanvasBg)
                        .border(1.dp, Hairline, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "↺",
                        fontSize = 15.sp,
                        color = BodyText,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Dashboard Scrollable List
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 24.dp)
        ) {
            // Header Content
            item {
                // Profile Card
                if (studentInfo != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(SurfaceDark)
                            .padding(18.dp)
                    ) {
                        Column {
                            Text(
                                text = studentInfo.sname,
                                fontFamily = SerifFamily,
                                fontSize = 24.sp,
                                letterSpacing = (-0.5).sp,
                                color = OnDark,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(LiveGreen)
                                )
                                Spacer(modifier = Modifier.width(7.dp))
                                Text(
                                    text = "${studentInfo.admissionNo} • ${studentInfo.className}",
                                    fontSize = 12.5.sp,
                                    color = OnDarkSoft,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Overall Attendance Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceCard)
                        .padding(20.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "OVERALL ATTENDANCE",
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Medium,
                                letterSpacing = 1.5.sp,
                                color = Muted
                            )
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(9999.dp))
                                    .background(CreamStrong)
                                    .padding(horizontal = 12.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = if (stats.isShortage) "Shortage" else (studentInfo?.className?.ifBlank { null } ?: "On Track"),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Ink
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.Bottom,
                            modifier = Modifier.padding(vertical = 4.dp)
                        ) {
                            Text(
                                text = stats.overallPercentage,
                                fontFamily = SerifFamily,
                                fontSize = 52.sp,
                                letterSpacing = (-1.5).sp,
                                color = getAttendanceColor(stats.overallPercentageVal)
                            )
                            Text(
                                text = "%",
                                fontSize = 24.sp,
                                color = Muted,
                                modifier = Modifier.padding(bottom = 8.dp)
                            )
                        }

                        // Mini Stats (TOT / ATT / ABS)
                        HorizontalDivider(color = Hairline, thickness = 1.dp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "${stats.overallClasses}",
                                    fontFamily = SerifFamily,
                                    fontSize = 18.sp,
                                    color = BodyText
                                )
                                Text(
                                    text = "TOT",
                                    fontSize = 9.5.sp,
                                    fontWeight = FontWeight.Medium,
                                    letterSpacing = 1.2.sp,
                                    color = Muted
                                )
                            }
                            Box(modifier = Modifier.width(1.dp).height(24.dp).background(HairlineSoft))
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "${stats.overallPresent}",
                                    fontFamily = SerifFamily,
                                    fontSize = 18.sp,
                                    color = BodyText
                                )
                                Text(
                                    text = "ATT",
                                    fontSize = 9.5.sp,
                                    fontWeight = FontWeight.Medium,
                                    letterSpacing = 1.2.sp,
                                    color = Muted
                                )
                            }
                            Box(modifier = Modifier.width(1.dp).height(24.dp).background(HairlineSoft))
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "${stats.overallAbsent}",
                                    fontFamily = SerifFamily,
                                    fontSize = 18.sp,
                                    color = BodyText
                                )
                                Text(
                                    text = "ABS",
                                    fontSize = 9.5.sp,
                                    fontWeight = FontWeight.Medium,
                                    letterSpacing = 1.2.sp,
                                    color = Muted
                                )
                            }
                        }

                        // Skip / Shortage Recommendation Row
                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Hairline, thickness = 1.dp)
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val canSkipOverall = stats.maxOverallSkippable
                            val isShortage = stats.isShortage
                            val classesNeededOverall = AttendanceMath.calculateClassesToReach75(stats.overallPresent, stats.overallClasses)

                            Column {
                                Text(
                                    text = if (isShortage) "Attendance Shortage" else "Overall Safe to skip",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = if (isShortage) ErrorRed else BodyText
                                )
                                Text(
                                    text = if (isShortage) "Need consecutive classes for 75%" else "while staying above 75%",
                                    fontSize = 10.5.sp,
                                    color = Muted
                                )
                            }

                            val (badgeText, badgeBg, badgeColor) = when {
                                isShortage -> Triple("Attend $classesNeededOverall more", ErrorRed, OnDark)
                                canSkipOverall > 0 -> Triple("$canSkipOverall ${if (canSkipOverall == 1) "class" else "classes"}", Primary, OnDark)
                                else -> Triple("Keep attending", CreamStrong, Ink)
                            }

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(9999.dp))
                                    .background(badgeBg)
                                    .padding(horizontal = 12.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = badgeText,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    letterSpacing = 0.3.sp,
                                    color = badgeColor
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))

                // Subjects List Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp, horizontal = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "SUBJECTS",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 1.5.sp,
                        color = Muted
                    )
                    Text(
                        text = "${subjectsData.size}",
                        fontSize = 12.sp,
                        color = MutedSoft
                    )
                }
            }

            // Subject Cards
            itemsIndexed(
                items = subjectsData,
                key = { index, item -> item.subCode ?: "${item.subjectName}-$index" }
            ) { _, subject ->
                SubjectCard(
                    subject = subject,
                    maxOverallSkippable = stats.maxOverallSkippable,
                    onClick = { onSelectSubject(subject) }
                )
                Spacer(modifier = Modifier.height(10.dp))
            }

            // Footer Component
            item {
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceDark)
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Spike(size = 15.dp, color = OnDark)
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "Open to Contribute",
                            fontFamily = SerifFamily,
                            fontSize = 21.sp,
                            letterSpacing = (-0.3).sp,
                            color = OnDark
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Found a bug or have an idea?\nThis app is open source.",
                            fontSize = 12.5.sp,
                            lineHeight = 19.sp,
                            color = OnDarkSoft,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(Primary)
                                .clickable(
                                    role = Role.Button,
                                    onClickLabel = "View on GitHub"
                                ) {
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(GITHUB_URL))
                                    context.startActivity(intent)
                                }
                                .padding(vertical = 12.dp, horizontal = 20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "View on GitHub",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = OnDark
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(SurfaceCard)
                                .border(1.dp, Hairline, RoundedCornerShape(8.dp))
                                .clickable(
                                    role = Role.Button,
                                    onClickLabel = "Report Wrong Attendance or Bug"
                                ) {
                                    onReportIssue()
                                }
                                .padding(vertical = 12.dp, horizontal = 20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Report Wrong Attendance / Bug",
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = BodyText
                            )
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Crafted by ",
                                fontSize = 11.5.sp,
                                color = MutedSoft
                            )
                            Text(
                                text = "J Chanikya",
                                fontFamily = SerifFamily,
                                fontStyle = FontStyle.Italic,
                                fontSize = 13.sp,
                                color = Primary
                            )
                            Text(
                                text = " · 2026",
                                fontSize = 11.5.sp,
                                color = MutedSoft
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SubjectCard(
    subject: SubjectAttendanceData,
    maxOverallSkippable: Int,
    onClick: () -> Unit
) {
    val pVal = remember(subject.percentage) { AttendanceMath.sanitizePercentage(subject.percentage) }
    val isLow = pVal < AttendanceMath.ATTENDANCE_THRESHOLD
    val canSkip = AttendanceMath.calculateCanSkip(subject.present, subject.total, maxOverallSkippable)
    val classesToReach75 = AttendanceMath.calculateClassesToReach75(subject.present, subject.total)
    val lastDate = remember(subject.records) { AttendanceMath.getLastAttendanceDate(subject.records) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceCard)
            .border(1.dp, Hairline, RoundedCornerShape(12.dp))
            .clickable(
                role = Role.Button,
                onClickLabel = "View details for ${subject.subjectName}"
            ) { onClick() }
            .padding(16.dp)
    ) {
        Column {
            // Row 1: Subject Name + Percentage
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = subject.subjectName,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = Ink,
                    lineHeight = 20.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(end = 10.dp)
                )
                Text(
                    text = "${subject.percentage}%",
                    fontFamily = SerifFamily,
                    fontSize = 24.sp,
                    letterSpacing = (-0.5).sp,
                    color = getAttendanceColor(pVal)
                )
            }

            // Last class date if available
            if (lastDate != null) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Last class · $lastDate",
                    fontSize = 11.5.sp,
                    color = Muted
                )
            }

            // Row 2: Short stats + Recommendation badge
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Tot ${subject.total}  ·  Att ${subject.present}  ·  Abs ${subject.absent}",
                    fontSize = 11.5.sp,
                    color = Muted
                )

                val badgeText = when {
                    isLow -> "Attend $classesToReach75 more"
                    canSkip > 0 -> "Skip $canSkip ${if (canSkip == 1) "class" else "classes"}"
                    else -> "Keep attending"
                }

                val (badgeBg, badgeColor) = when {
                    isLow -> ErrorRed to OnDark
                    canSkip > 0 -> Primary to OnDark
                    else -> CreamStrong to Ink
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(9999.dp))
                        .background(badgeBg)
                        .padding(horizontal = 12.dp, vertical = 5.dp)
                ) {
                    Text(
                        text = badgeText,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.3.sp,
                        color = badgeColor
                    )
                }
            }
        }
    }
}
