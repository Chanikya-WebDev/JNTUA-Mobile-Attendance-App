package com.chanikya501.jntuaattendance

import com.chanikya501.jntuaattendance.model.BridgeMessage
import com.chanikya501.jntuaattendance.model.BridgeValidator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeValidatorTest {

    @Test
    fun acceptsAllKnownMessageTypes() {
        val studentInfoJson = """{"type":"STUDENT_INFO","data":{"sname":"A","admissionNo":"1","className":"CSE"}}"""
        val studentMsg = BridgeValidator.parse(studentInfoJson)
        assertTrue(studentMsg is BridgeMessage.StudentInfoMsg)
        assertEquals("A", (studentMsg as BridgeMessage.StudentInfoMsg).data.sname)

        val subjectCountJson = """{"type":"SUBJECT_COUNT","count":6}"""
        val countMsg = BridgeValidator.parse(subjectCountJson)
        assertTrue(countMsg is BridgeMessage.SubjectCountMsg)
        assertEquals(6, (countMsg as BridgeMessage.SubjectCountMsg).count)

        val attendanceItemJson = """{"type":"ATTENDANCE_ITEM","data":{"subjectName":"Math","present":1,"absent":0,"total":1,"percentage":"100.00","records":[{"date":"d","time":"t","status":"Present"}]}}"""
        val itemMsg = BridgeValidator.parse(attendanceItemJson)
        assertTrue(itemMsg is BridgeMessage.AttendanceItemMsg)
        assertEquals("Math", (itemMsg as BridgeMessage.AttendanceItemMsg).data.subjectName)

        val subjectSkippedJson = """{"type":"SUBJECT_SKIPPED","subcode":"CS101","index":2}"""
        val skippedMsg = BridgeValidator.parse(subjectSkippedJson)
        assertTrue(skippedMsg is BridgeMessage.SubjectSkippedMsg)
        assertEquals(2, (skippedMsg as BridgeMessage.SubjectSkippedMsg).index)

        val scrapeErrorJson = """{"type":"SCRAPE_ERROR","message":"timeout"}"""
        val errorMsg = BridgeValidator.parse(scrapeErrorJson)
        assertTrue(errorMsg is BridgeMessage.ScrapeErrorMsg)
        assertEquals("timeout", (errorMsg as BridgeMessage.ScrapeErrorMsg).message)

        val scrapeIdleJson = """{"type":"SCRAPE_IDLE","reason":"off-script"}"""
        val idleMsg = BridgeValidator.parse(scrapeIdleJson)
        assertTrue(idleMsg is BridgeMessage.ScrapeIdleMsg)

        val structureChangedJson = """{"type":"STRUCTURE_CHANGED"}"""
        val structureMsg = BridgeValidator.parse(structureChangedJson)
        assertNotNull(structureMsg)
        assertTrue(structureMsg is BridgeMessage.StructureChangedMsg)

        val scrapingCompleteJson = """{"type":"SCRAPING_COMPLETE"}"""
        val completeMsg = BridgeValidator.parse(scrapingCompleteJson)
        assertNotNull(completeMsg)
        assertTrue(completeMsg is BridgeMessage.ScrapingCompleteMsg)
    }

    @Test
    fun rejectsMalformedAndUnknownPayloads() {
        assertNull(BridgeValidator.parse("{bad"))
        assertNull(BridgeValidator.parse("""{"type":"PWNED"}"""))
        assertNull(BridgeValidator.parse("""{"type":"SUBJECT_COUNT","count":-1}"""))
        assertNull(BridgeValidator.parse("""{"type":"ATTENDANCE_ITEM","data":{"subjectName":""}}"""))
        assertNull(BridgeValidator.parse("x".repeat(1_000_001)))
    }
}
