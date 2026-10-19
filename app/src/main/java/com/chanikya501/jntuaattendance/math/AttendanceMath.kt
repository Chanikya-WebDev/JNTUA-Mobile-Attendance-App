package com.chanikya501.jntuaattendance.math

import com.chanikya501.jntuaattendance.model.AttendanceRecord
import com.chanikya501.jntuaattendance.model.OverallStats
import com.chanikya501.jntuaattendance.model.SubjectAttendanceData
import java.util.Locale
import kotlin.math.floor

object AttendanceMath {
    const val ATTENDANCE_THRESHOLD = 75.0

    fun computeOverallStats(subjects: List<SubjectAttendanceData>): OverallStats {
        val overallClasses = subjects.sumOf { it.total }
        val overallPresent = subjects.sumOf { it.present }
        val overallAbsent = subjects.sumOf { it.absent }
        val overallPercentageVal = if (overallClasses > 0) {
            (overallPresent.toDouble() / overallClasses.toDouble()) * 100.0
        } else {
            0.0
        }

        val maxOverallSkippable = maxOf(
            0,
            floor((4.0 * overallPresent - 3.0 * overallClasses) / 3.0).toInt()
        )

        return OverallStats(
            overallClasses = overallClasses,
            overallPresent = overallPresent,
            overallAbsent = overallAbsent,
            overallPercentageVal = overallPercentageVal,
            overallPercentage = String.format(Locale.US, "%.1f", overallPercentageVal),
            isShortage = overallPercentageVal < ATTENDANCE_THRESHOLD,
            maxOverallSkippable = maxOverallSkippable
        )
    }

    /**
     * Classes skippable while staying >= 75%. Clamped by subject and overall headroom.
     */
    fun calculateCanSkip(present: Int, total: Int, maxOverallSkippable: Int): Int {
        if (total <= 0) return 0
        val clampedPresent = present.coerceIn(0, total)
        val raw = maxOf(0, floor((4.0 * clampedPresent - 3.0 * total) / 3.0).toInt())
        return minOf(raw, maxOf(0, maxOverallSkippable))
    }

    /**
     * Extra classes needed to reach 75%.
     */
    fun calculateClassesToReach75(present: Int, total: Int): Int {
        if (total < 0) return 0
        return maxOf(0, 3 * total - 4 * maxOf(0, present))
    }

    /**
     * Returns the last recorded date for a subject; null when no dated records exist.
     */
    fun getLastAttendanceDate(records: List<AttendanceRecord>): String? {
        for (i in records.indices.reversed()) {
            val date = records[i].date.trim()
            if (date.isNotEmpty()) return date
        }
        return null
    }

    /**
     * Sanitize persisted percentage string; corrupt -> 0.0.
     */
    fun sanitizePercentage(raw: String): Double {
        val value = raw.toDoubleOrNull() ?: return 0.0
        return if (value.isFinite() && value in 0.0..100.0) value else 0.0
    }
}
