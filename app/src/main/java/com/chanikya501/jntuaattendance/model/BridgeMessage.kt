package com.chanikya501.jntuaattendance.model

import org.json.JSONArray
import org.json.JSONObject

sealed interface BridgeMessage {
    data class StudentInfoMsg(val data: StudentInfo) : BridgeMessage
    data class SubjectCountMsg(val count: Int) : BridgeMessage
    data class AttendanceItemMsg(val data: SubjectAttendanceData) : BridgeMessage
    data class SubjectSkippedMsg(val subCode: String, val index: Int) : BridgeMessage
    data class ScrapeErrorMsg(val message: String) : BridgeMessage
    data class ScrapeIdleMsg(val reason: String? = null) : BridgeMessage
    data object StructureChangedMsg : BridgeMessage
    data object ScrapingCompleteMsg : BridgeMessage
}

object BridgeValidator {
    private const val MAX_PAYLOAD_LENGTH = 1_000_000

    fun parse(raw: String?): BridgeMessage? {
        if (raw == null || raw.length > MAX_PAYLOAD_LENGTH) return null
        return try {
            val json = JSONObject(raw)
            if (!json.has("type")) return null
            when (json.optString("type")) {
                "STUDENT_INFO" -> {
                    val dataObj = json.optJSONObject("data") ?: return null
                    val sname = dataObj.optString("sname", "")
                    val admissionNo = dataObj.optString("admissionNo", "")
                    val className = dataObj.optString("className", "")
                    if (sname.isEmpty() && admissionNo.isEmpty()) return null
                    BridgeMessage.StudentInfoMsg(
                        StudentInfo(
                            sname = sname,
                            admissionNo = admissionNo,
                            className = className
                        )
                    )
                }

                "SUBJECT_COUNT" -> {
                    if (!json.has("count")) return null
                    val count = json.optInt("count", -1)
                    if (count in 0..200) {
                        BridgeMessage.SubjectCountMsg(count)
                    } else null
                }

                "ATTENDANCE_ITEM" -> {
                    val dataObj = json.optJSONObject("data") ?: return null
                    val subjectName = dataObj.optString("subjectName", "")
                    if (subjectName.isEmpty()) return null
                    val subCode = if (dataObj.has("subCode") && !dataObj.isNull("subCode")) {
                        dataObj.optString("subCode").trim().ifEmpty { null }
                    } else null

                    val present = dataObj.optInt("present", 0)
                    val absent = dataObj.optInt("absent", 0)
                    val total = dataObj.optInt("total", present + absent)
                    val percentage = dataObj.optString("percentage", "0.00")

                    val recordsList = AttendanceRecord.parseRecords(dataObj.optJSONArray("records"))

                    BridgeMessage.AttendanceItemMsg(
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

                "SUBJECT_SKIPPED" -> {
                    val subCode = json.optString("subcode", "")
                    val index = json.optInt("index", -1)
                    if (index >= 0) {
                        BridgeMessage.SubjectSkippedMsg(subCode = subCode, index = index)
                    } else null
                }

                "SCRAPE_ERROR" -> {
                    val message = json.optString("message", "Scrape failed")
                    BridgeMessage.ScrapeErrorMsg(message)
                }

                "SCRAPE_IDLE" -> {
                    val reason = if (json.has("reason")) json.optString("reason") else null
                    BridgeMessage.ScrapeIdleMsg(reason)
                }

                "STRUCTURE_CHANGED" -> BridgeMessage.StructureChangedMsg
                "SCRAPING_COMPLETE" -> BridgeMessage.ScrapingCompleteMsg
                else -> null
            }
        } catch (_: Exception) {
            null
        }
    }
}
