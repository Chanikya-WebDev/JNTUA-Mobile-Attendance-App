package com.chanikya501.jntuaattendance

import com.chanikya501.jntuaattendance.model.BridgeMessage
import com.chanikya501.jntuaattendance.model.BridgeValidator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeValidatorEdgeCaseTest {

    // ---- STUDENT_INFO: empty values ----

    @Test
    fun studentInfo_withBothEmptyFields_rejected() {
        val raw = """{"type":"STUDENT_INFO","data":{"sname":"","admissionNo":"","className":"CSE"}}"""
        val msg = BridgeValidator.parse(raw)
        assertNull("STUDENT_INFO with both sname and admissionNo empty must be rejected", msg)
    }

    @Test
    fun studentInfo_withOnlySname_rejected() {
        val raw = """{"type":"STUDENT_INFO","data":{"sname":"","admissionNo":"","className":""}}"""
        val msg = BridgeValidator.parse(raw)
        assertNull("STUDENT_INFO with both fields empty must be rejected", msg)
    }

    @Test
    fun studentInfo_withOnlyAdmission_rejected() {
        val raw = """{"type":"STUDENT_INFO","data":{"sname":"","admissionNo":"12345","className":"CSE"}}"""
        val msg = BridgeValidator.parse(raw)
        // sname is empty but admissionNo is present — should NOT be rejected
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.StudentInfoMsg)
        assertEquals("12345", (msg as BridgeMessage.StudentInfoMsg).data.admissionNo)
    }

    @Test
    fun studentInfo_withOnlySname_accepted() {
        val raw = """{"type":"STUDENT_INFO","data":{"sname":"John","admissionNo":"","className":"CSE"}}"""
        val msg = BridgeValidator.parse(raw)
        assertNotNull("STUDENT_INFO with sname present should be accepted", msg)
        assertTrue(msg is BridgeMessage.StudentInfoMsg)
        assertEquals("John", (msg as BridgeMessage.StudentInfoMsg).data.sname)
    }

    // ---- ATTENDANCE_ITEM: validation ----

    @Test
    fun attendanceItem_withEmptySubjectName_rejected() {
        val raw = """{"type":"ATTENDANCE_ITEM","data":{"subjectName":"","present":0,"absent":0,"total":0,"percentage":"0.00"}}"""
        val msg = BridgeValidator.parse(raw)
        assertNull("ATTENDANCE_ITEM with empty subjectName must be rejected", msg)
    }

    @Test
    fun attendanceItem_withMissingData_rejected() {
        val raw = """{"type":"ATTENDANCE_ITEM"}"""
        val msg = BridgeValidator.parse(raw)
        assertNull("ATTENDANCE_ITEM with missing data must be rejected", msg)
    }

    @Test
    fun attendanceItem_withNullSubCode_accepted() {
        val raw = """{"type":"ATTENDANCE_ITEM","data":{"subjectName":"Math","subCode":null,"present":1,"absent":0,"total":1,"percentage":"100.00"}}"""
        val msg = BridgeValidator.parse(raw)
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.AttendanceItemMsg)
        assertNull((msg as BridgeMessage.AttendanceItemMsg).data.subCode)
    }

    @Test
    fun attendanceItem_withEmptySubCode_treatedAsNull() {
        val raw = """{"type":"ATTENDANCE_ITEM","data":{"subjectName":"Math","subCode":"","present":1,"absent":0,"total":1,"percentage":"100.00"}}"""
        val msg = BridgeValidator.parse(raw)
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.AttendanceItemMsg)
        assertNull((msg as BridgeMessage.AttendanceItemMsg).data.subCode)
    }

    @Test
    fun attendanceItem_withWhitespaceSubCode_trimsToEmpty() {
        val raw = """{"type":"ATTENDANCE_ITEM","data":{"subjectName":"Math","subCode":"   ","present":1,"absent":0,"total":1,"percentage":"100.00"}}"""
        val msg = BridgeValidator.parse(raw)
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.AttendanceItemMsg)
        assertNull((msg as BridgeMessage.AttendanceItemMsg).data.subCode)
    }

    // ---- SUBJECT_COUNT: bounds ----

    @Test
    fun subjectCount_zero_accepted() {
        val msg = BridgeValidator.parse("""{"type":"SUBJECT_COUNT","count":0}""")
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.SubjectCountMsg)
        assertEquals(0, (msg as BridgeMessage.SubjectCountMsg).count)
    }

    @Test
    fun subjectCount_negative_rejected() {
        val msg = BridgeValidator.parse("""{"type":"SUBJECT_COUNT","count":-1}""")
        assertNull(msg)
    }

    @Test
    fun subjectCount_over200_rejected() {
        val msg = BridgeValidator.parse("""{"type":"SUBJECT_COUNT","count":201}""")
        assertNull(msg)
    }

    @Test
    fun subjectCount_200_accepted() {
        val msg = BridgeValidator.parse("""{"type":"SUBJECT_COUNT","count":200}""")
        assertNotNull(msg)
        assertEquals(200, (msg as BridgeMessage.SubjectCountMsg).count)
    }

    // ---- SCRAPE_ERROR / SCRAPE_IDLE ----

    @Test
    fun scrapeError_withMessage_accepted() {
        val msg = BridgeValidator.parse("""{"type":"SCRAPE_ERROR","message":"Server redirect to login"}""")
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.ScrapeErrorMsg)
        assertEquals("Server redirect to login", (msg as BridgeMessage.ScrapeErrorMsg).message)
    }

    @Test
    fun scrapeError_withoutMessage_defaults() {
        val msg = BridgeValidator.parse("""{"type":"SCRAPE_ERROR"}""")
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.ScrapeErrorMsg)
    }

    @Test
    fun scrapeIdle_withReason_accepted() {
        val msg = BridgeValidator.parse("""{"type":"SCRAPE_IDLE","reason":"No rows found"}""")
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.ScrapeIdleMsg)
        assertEquals("No rows found", (msg as BridgeMessage.ScrapeIdleMsg).reason)
    }

    @Test
    fun scrapeIdle_withoutReason_accepted() {
        val msg = BridgeValidator.parse("""{"type":"SCRAPE_IDLE"}""")
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.ScrapeIdleMsg)
    }

    // ---- SUBJECT_SKIPPED ----

    @Test
     fun subjectSkipped_withValidIndex_accepted() {
        val msg = BridgeValidator.parse("""{"type":"SUBJECT_SKIPPED","subcode":"CS101","index":3}""")
        assertNotNull(msg)
        assertTrue(msg is BridgeMessage.SubjectSkippedMsg)
        val sm = msg as BridgeMessage.SubjectSkippedMsg
        assertEquals(3, sm.index)
        assertEquals("CS101", sm.subCode)
    }

    @Test
    fun subjectSkipped_withNegativeIndex_rejected() {
        val msg = BridgeValidator.parse("""{"type":"SUBJECT_SKIPPED","subcode":"CS101","index":-1}""")
        assertNull(msg)
    }

    // ---- Invalid payloads ----

    @Test
    fun invalidJson_rejected() {
        assertNull(BridgeValidator.parse("not json at all"))
    }

    @Test
    fun emptyString_rejected() {
        assertNull(BridgeValidator.parse(""))
    }

    @Test
    fun nullInput_rejected() {
        assertNull(BridgeValidator.parse(null))
    }

    @Test
    fun oversizedPayload_rejected() {
        val hugeSubjectName = "A".repeat(1_100_000)
        val raw = """{"type":"ATTENDANCE_ITEM","data":{"subjectName":"$hugeSubjectName"}}"""
        assertNull(BridgeValidator.parse(raw))
    }
}
