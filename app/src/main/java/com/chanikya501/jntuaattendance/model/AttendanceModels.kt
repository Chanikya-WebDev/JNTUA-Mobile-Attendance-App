package com.chanikya501.jntuaattendance.model

import org.json.JSONArray

enum class AttendanceStatus {
    Present,
    Absent,
    Unknown;

    companion object {
        fun fromString(value: String): AttendanceStatus = when {
            value.equals("Present", ignoreCase = true) -> Present
            value.equals("Absent", ignoreCase = true) -> Absent
            else -> Unknown
        }
    }
}

data class AttendanceRecord(
    val date: String,
    val time: String,
    val status: AttendanceStatus
) {
    companion object {
        fun parseRecords(recordsArray: JSONArray?): List<AttendanceRecord> {
            if (recordsArray == null) return emptyList()
            val list = ArrayList<AttendanceRecord>(recordsArray.length())
            for (i in 0 until recordsArray.length()) {
                val obj = recordsArray.optJSONObject(i) ?: continue
                val date = obj.optString("date", "").trim()
                val time = obj.optString("time", "").trim()
                val statusStr = obj.optString("status", "Unknown")
                list.add(
                    AttendanceRecord(
                        date = date,
                        time = time,
                        status = AttendanceStatus.fromString(statusStr)
                    )
                )
            }
            return list
        }
    }
}

data class SubjectAttendanceData(
    val subjectName: String,
    val subCode: String? = null,
    val present: Int,
    val absent: Int,
    val total: Int,
    val percentage: String,
    val records: List<AttendanceRecord> = emptyList()
)

data class StudentInfo(
    val sname: String,
    val admissionNo: String,
    val className: String
)

data class OverallStats(
    val overallClasses: Int,
    val overallPresent: Int,
    val overallAbsent: Int,
    val overallPercentageVal: Double,
    val overallPercentage: String,
    val isShortage: Boolean,
    val maxOverallSkippable: Int
)

data class PreviousAttendanceResult(
    val studentInfo: StudentInfo,
    val subjectsData: List<SubjectAttendanceData>
)
