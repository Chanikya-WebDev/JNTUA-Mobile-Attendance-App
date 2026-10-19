package com.chanikya501.jntuaattendance.storage

import android.content.Context
import com.chanikya501.jntuaattendance.model.AttendanceRecord
import com.chanikya501.jntuaattendance.model.AttendanceStatus
import com.chanikya501.jntuaattendance.model.PreviousAttendanceResult
import com.chanikya501.jntuaattendance.model.StudentInfo
import com.chanikya501.jntuaattendance.model.SubjectAttendanceData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object AttendanceStorage {
    private const val FILE_NAME = "previous_attendance_result.json"
    private const val MAX_FILE_BYTES = 1_000_000L

    suspend fun savePreviousResult(context: Context, result: PreviousAttendanceResult) = withContext(Dispatchers.IO) {
        try {
            val root = JSONObject()
            val studentInfoObj = JSONObject().apply {
                put("sname", result.studentInfo.sname)
                put("admissionNo", result.studentInfo.admissionNo)
                put("className", result.studentInfo.className)
            }
            root.put("studentInfo", studentInfoObj)

            val subjectsArray = JSONArray()
            for (subject in result.subjectsData) {
                val subObj = JSONObject().apply {
                    put("subjectName", subject.subjectName)
                    if (subject.subCode != null) put("subCode", subject.subCode)
                    put("present", subject.present)
                    put("absent", subject.absent)
                    put("total", subject.total)
                    put("percentage", subject.percentage)

                    val recordsArray = JSONArray()
                    for (rec in subject.records) {
                        val recObj = JSONObject().apply {
                            put("date", rec.date)
                            put("time", rec.time)
                            put("status", rec.status.name)
                        }
                        recordsArray.put(recObj)
                    }
                    put("records", recordsArray)
                }
                subjectsArray.put(subObj)
            }
            root.put("subjectsData", subjectsArray)

            val file = File(context.filesDir, FILE_NAME)
            file.writeText(root.toString())
        } catch (_: Exception) {
            // Persistence is best-effort; never crash the app.
        }
    }

    suspend fun loadPreviousResult(context: Context): PreviousAttendanceResult? = withContext(Dispatchers.IO) {
        try {
            val file = File(context.filesDir, FILE_NAME)
            if (!file.exists() || file.length() > MAX_FILE_BYTES) return@withContext null
            val raw = file.readText()
            val root = JSONObject(raw)

            val studentInfoObj = root.optJSONObject("studentInfo") ?: return@withContext null
            val sname = studentInfoObj.optString("sname", "")
            val admissionNo = studentInfoObj.optString("admissionNo", "")
            val className = studentInfoObj.optString("className", "")
            if (sname.isEmpty() || admissionNo.isEmpty()) return@withContext null

            val subjectsArray = root.optJSONArray("subjectsData") ?: return@withContext null
            if (subjectsArray.length() > 200) return@withContext null

            val subjectsList = mutableListOf<SubjectAttendanceData>()
            for (i in 0 until subjectsArray.length()) {
                val subObj = subjectsArray.optJSONObject(i) ?: return@withContext null
                val subjectName = subObj.optString("subjectName", "")
                if (subjectName.isEmpty()) return@withContext null

                val subCode = if (subObj.has("subCode") && !subObj.isNull("subCode")) {
                    subObj.optString("subCode").ifEmpty { null }
                } else null

                val present = subObj.optInt("present", 0)
                val absent = subObj.optInt("absent", 0)
                val total = subObj.optInt("total", 0)
                if (present < 0 || absent < 0 || total < 0 || total != (present + absent)) {
                    return@withContext null
                }
                val percentage = subObj.optString("percentage", "0.00")

                val recordsArray = subObj.optJSONArray("records") ?: JSONArray()
                if (recordsArray.length() > 1000) return@withContext null

                val recordsList = AttendanceRecord.parseRecords(recordsArray)

                subjectsList.add(
                    SubjectAttendanceData(
                        subjectName = subjectName,
                        subCode = subCode,
                        present = present,
                        absent = absent,
                        total = total,
                        percentage = percentage,
                        records = recordsList
                    )
                )
            }

            PreviousAttendanceResult(
                studentInfo = StudentInfo(sname, admissionNo, className),
                subjectsData = subjectsList
            )
        } catch (_: Exception) {
            null
        }
    }

    suspend fun clearPreviousResult(context: Context) = withContext(Dispatchers.IO) {
        try {
            val file = File(context.filesDir, FILE_NAME)
            if (file.exists()) file.delete()
        } catch (_: Exception) {
            // ignore
        }
    }
}
