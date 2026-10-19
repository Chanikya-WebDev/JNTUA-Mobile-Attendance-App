package com.chanikya501.jntuaattendance

import com.chanikya501.jntuaattendance.math.AttendanceMath
import com.chanikya501.jntuaattendance.model.AttendanceRecord
import com.chanikya501.jntuaattendance.model.AttendanceStatus
import com.chanikya501.jntuaattendance.model.SubjectAttendanceData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AttendanceMathTest {

    private fun createSubject(
        subjectName: String = "Math",
        present: Int = 30,
        absent: Int = 10,
        total: Int = 40,
        percentage: String = "75.00",
        records: List<AttendanceRecord> = emptyList()
    ): SubjectAttendanceData {
        return SubjectAttendanceData(
            subjectName = subjectName,
            present = present,
            absent = absent,
            total = total,
            percentage = percentage,
            records = records
        )
    }

    @Test
    fun computesOverallStatsAnd75Headroom() {
        val stats = AttendanceMath.computeOverallStats(
            listOf(createSubject(), createSubject())
        )
        assertEquals(80, stats.overallClasses)
        assertEquals(60, stats.overallPresent)
        assertEquals("75.0", stats.overallPercentage)
        assertFalse(stats.isShortage)
        assertEquals(0, stats.maxOverallSkippable)
    }

    @Test
    fun returnsZerosForEmptyInput() {
        val stats = AttendanceMath.computeOverallStats(emptyList())
        assertEquals(0, stats.overallClasses)
        assertEquals(0.0, stats.overallPercentageVal, 0.001)
        assertTrue(stats.isShortage)
    }

    @Test
    fun calculatesSkippableClassesWithOverallClamp() {
        assertEquals(10, AttendanceMath.calculateCanSkip(40, 40, 10))
        assertEquals(1, AttendanceMath.calculateCanSkip(40, 40, 1))
        assertEquals(0, AttendanceMath.calculateCanSkip(0, 0, 5))
        assertEquals(0, AttendanceMath.calculateCanSkip(20, 40, 5))
    }

    @Test
    fun calculatesClassesNeededToReach75() {
        assertEquals(40, AttendanceMath.calculateClassesToReach75(20, 40))
        assertEquals(0, AttendanceMath.calculateClassesToReach75(30, 40))
    }

    @Test
    fun sanitizesCorruptPercentagesToZero() {
        assertEquals(0.0, AttendanceMath.sanitizePercentage("NaN"), 0.001)
        assertEquals(0.0, AttendanceMath.sanitizePercentage("abc"), 0.001)
        assertEquals(82.5, AttendanceMath.sanitizePercentage("82.50"), 0.001)
    }

    @Test
    fun getsLastAttendanceDate() {
        val records = listOf(
            AttendanceRecord("10/10/2026", "09:00", AttendanceStatus.Present),
            AttendanceRecord("12/10/2026", "10:00", AttendanceStatus.Absent)
        )
        assertEquals("12/10/2026", AttendanceMath.getLastAttendanceDate(records))
    }
}
