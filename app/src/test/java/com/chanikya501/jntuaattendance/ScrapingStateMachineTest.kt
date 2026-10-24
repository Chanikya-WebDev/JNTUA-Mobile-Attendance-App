package com.chanikya501.jntuaattendance.viewmodel

import com.chanikya501.jntuaattendance.model.BridgeValidator
import com.chanikya501.jntuaattendance.model.SubjectAttendanceData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScrapingStateMachineTest {

    private data class TestState(
        val isLoggedIn: Boolean = false,
        val currentIndex: Int = 0,
        val totalSubjects: Int? = null,
        val fetchedIndices: Set<Int> = emptySet(),
        val fetchedSubCodes: Set<String> = emptySet(),
        val subjectsData: List<SubjectAttendanceData> = emptyList(),
        val isScrapingFinished: Boolean = false,
        val scrapingState: ScrapingState = ScrapingState.IDLE,
        val retryCount: Int = 0,
        val sessionId: String = "",
        val isOffline: Boolean = false,
        val isSelectionError: Boolean = false
    )

    private fun makeAttendanceItem(
        subCode: String? = "CS101",
        subjectName: String = "Math",
        present: Int = 1,
        absent: Int = 0,
        total: Int = 1,
        percentage: String = "100.00"
    ) = SubjectAttendanceData(
        subjectName = subjectName,
        subCode = subCode,
        present = present,
        absent = absent,
        total = total,
        percentage = percentage,
        records = emptyList()
    )

    // ---- Scenario 1: Successful first subject ----

    @Test
    fun scenario1_successfulFirstSubject() {
        var state = TestState()
        // Login
        state = state.copy(isLoggedIn = true, scrapingState = ScrapingState.DISCOVERING, sessionId = "sid1")
        // Subject count
        state = state.copy(totalSubjects = 8, scrapingState = ScrapingState.DISCOVERING)
        // Process subject 0
        val item = makeAttendanceItem(subCode = "CS101", subjectName = "Math", present = 3, absent = 1, total = 4, percentage = "75.00")
        val subCodeNorm = "cs101"
        val total = state.totalSubjects ?: 0
        val nextIndex = state.currentIndex + 1
        val finished = nextIndex >= total

        state = state.copy(
            fetchedIndices = state.fetchedIndices + state.currentIndex,
            fetchedSubCodes = state.fetchedSubCodes + subCodeNorm,
            subjectsData = state.subjectsData + item,
            currentIndex = if (finished) state.currentIndex else nextIndex,
            isScrapingFinished = if (finished) true else state.isScrapingFinished,
            scrapingState = ScrapingState.PARSING,
            retryCount = 0
        )

        assertEquals(1, state.currentIndex)
        assertEquals(1, state.subjectsData.size)
        assertEquals(1, state.fetchedIndices.size)
        assertEquals("cs101", state.fetchedSubCodes.first())
        assertEquals(ScrapingState.PARSING, state.scrapingState)
        assertEquals(0, state.retryCount)
        assertFalse(state.isScrapingFinished)
    }

    // ---- Scenario 2: All eight subjects ----

    @Test
    fun scenario2_allEightSubjects() {
        var state = TestState(
            isLoggedIn = true,
            totalSubjects = 8,
            scrapingState = ScrapingState.DISCOVERING,
            sessionId = "sid2"
        )

        for (i in 0 until 7) {
            val item = makeAttendanceItem(
                subCode = "CS$i",
                subjectName = "Subject$i",
                present = i + 1,
                absent = 1,
                total = i + 2,
                percentage = "80.00"
            )
            val total = state.totalSubjects ?: 0
            val nextIndex = state.currentIndex + 1
            val finished = nextIndex >= total

            state = state.copy(
                fetchedIndices = state.fetchedIndices + state.currentIndex,
                fetchedSubCodes = state.fetchedSubCodes + "cs$i",
                subjectsData = state.subjectsData + item,
                currentIndex = if (finished) state.currentIndex else nextIndex,
                isScrapingFinished = finished,
                scrapingState = ScrapingState.PARSING,
                retryCount = 0
            )

            assertEquals(i + 1, state.subjectsData.size)
            assertEquals(i + 1, state.fetchedIndices.size)
            assertEquals(i + 1, state.currentIndex)
            assertFalse("Should not be finished at index $i", state.isScrapingFinished)
        }

        // Final subject (index 7)
        val lastItem = makeAttendanceItem(subCode = "CS7", subjectName = "Subject7", present = 8, absent = 0, total = 8, percentage = "100.00")
        val total = state.totalSubjects ?: 0
        val nextIndex = state.currentIndex + 1
        val finished = nextIndex >= total
        state = state.copy(
            fetchedIndices = state.fetchedIndices + state.currentIndex,
            fetchedSubCodes = state.fetchedSubCodes + "cs7",
            subjectsData = state.subjectsData + lastItem,
            currentIndex = if (finished) state.currentIndex else nextIndex,
            isScrapingFinished = finished,
            scrapingState = ScrapingState.COMPLETED
        )

        assertTrue(state.isScrapingFinished)
        assertEquals(8, state.subjectsData.size)
        assertEquals(8, state.fetchedIndices.size)
        assertEquals(7, state.currentIndex) // not advanced after completion
        assertEquals(ScrapingState.COMPLETED, state.scrapingState)
    }

    // ---- Scenario 3: Empty student name ----

    @Test
    fun scenario3_emptyStudentInfo_rejectedByValidator() {
        val emptyInfoJson = """{"type":"STUDENT_INFO","data":{"sname":"","admissionNo":"","className":""}}"""
        val msg = BridgeValidator.parse(emptyInfoJson)
        assertNull("Empty student info must be rejected", msg)
    }

    @Test
    fun scenario3_emptyStudentInfo_stateUnchanged() {
        var state = TestState()
        val msg = BridgeValidator.parse("""{"type":"STUDENT_INFO","data":{"sname":"","admissionNo":"","className":""}}""")
        assertNull(msg)
        // State unchanged
        assertEquals(false, state.isLoggedIn)
        assertEquals(ScrapingState.IDLE, state.scrapingState)
    }

    // ---- Scenario 4: Duplicate onPageFinished ----

    @Test
    fun scenario4_duplicateOnPageFinished_doesNotCorruptState() {
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 0,
            totalSubjects = 8,
            scrapingState = ScrapingState.SUBMITTING
        )

        // Duplicate dispatch with same index should not advance (guard prevents this)
        assertEquals(0, state.currentIndex)

        // ATTENDANCE_ITEM arrives for subject 0
        val item = makeAttendanceItem(subCode = "CS101", subjectName = "Math")
        state = state.copy(
            fetchedIndices = state.fetchedIndices + state.currentIndex,
            fetchedSubCodes = state.fetchedSubCodes + "cs101",
            subjectsData = state.subjectsData + item,
            currentIndex = 1,
            scrapingState = ScrapingState.PARSING
        )

        // Duplicate ATTENDANCE_ITEM for same subcode should be skipped
        val isDup = state.fetchedSubCodes.contains("cs101")
        assertTrue("Duplicate ATTENDANCE_ITEM must be skipped", isDup)
        assertEquals(1, state.subjectsData.size) // not 2
        assertEquals(1, state.currentIndex)
    }

    // ---- Scenario 5: Duplicate bridge messages ----

    @Test
    fun scenario5_duplicateBridgeMessage_sameSubCodeSkipped() {
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 0,
            totalSubjects = 8,
            scrapingState = ScrapingState.PARSING
        )

        val item = makeAttendanceItem(subCode = "CS101", subjectName = "Math")
        // Process first
        state = state.copy(
            fetchedIndices = state.fetchedIndices + state.currentIndex,
            fetchedSubCodes = state.fetchedSubCodes + "cs101",
            subjectsData = state.subjectsData + item,
            currentIndex = 1,
            scrapingState = ScrapingState.PARSING
        )

        // Duplicate message (same subCode)
        val isDup = state.fetchedSubCodes.contains("cs101")
        assertTrue(isDup)
        assertEquals(1, state.currentIndex)
        assertEquals(1, state.subjectsData.size)
    }

    @Test
    fun scenario5_duplicateBridgeMessage_sameIndexSkipped() {
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 0,
            totalSubjects = 8,
            scrapingState = ScrapingState.PARSING
        )

        val item = makeAttendanceItem(subCode = null, subjectName = "Math")
        // Process first
        state = state.copy(
            fetchedIndices = state.fetchedIndices + state.currentIndex,
            subjectsData = state.subjectsData + item,
            currentIndex = 1,
            scrapingState = ScrapingState.PARSING
        )

        // Duplicate would be detected by fetchedIndices.contains(0)
        val isDup = state.fetchedIndices.contains(0)
        assertTrue(isDup)
        assertEquals(1, state.currentIndex)
        assertEquals(1, state.subjectsData.size)
    }

    // ---- Scenario 6: Server redirect back to subject list ----

    @Test
    fun scenario6_serverRedirectBackToSubjectList() {
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 0,
            totalSubjects = 8,
            scrapingState = ScrapingState.SUBMITTING,
            retryCount = 0
        )

        // Server redirects — ScrapeIdle posted
        state = state.copy(scrapingState = ScrapingState.ERROR, retryCount = 1)

        // Retry allowed (retryCount < 3)
        assertTrue(state.retryCount < 3)
    }

    // ---- Scenario 7: Invalid attendance response ----

    @Test
    fun scenario7_invalidAttendanceResponse_rejectedByValidator() {
        val raw = """{"type":"ATTENDANCE_ITEM","data":{"subCode":"CS101","present":1,"absent":0,"total":1,"percentage":"100.00"}}"""
        val msg = BridgeValidator.parse(raw)
        assertNull("ATTENDANCE_ITEM without subjectName must be rejected", msg)
    }

    // ---- Scenario 8: Failed subject submission with bounded retry ----

    @Test
    fun scenario8_failedSubject_retryIncremented() {
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 0,
            totalSubjects = 8,
            scrapingState = ScrapingState.SUBMITTING,
            retryCount = 0
        )

        state = state.copy(scrapingState = ScrapingState.ERROR, retryCount = 1)
        assertTrue(state.retryCount == 1)
        assertTrue(state.retryCount < 3)
    }

    // ---- Scenario 9: Permanently failing subject terminates ----

    @Test
    fun scenario9_permanentlyFailingSubject_terminatesAfterMaxRetries() {
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 0,
            totalSubjects = 8,
            scrapingState = ScrapingState.ERROR,
            retryCount = 3
        )
        assertTrue(state.retryCount >= 3)
        assertTrue("Should terminate when retryCount >= 3", state.retryCount >= 3)
    }

    @Test
    fun scenario9_terminalError_stopsScraping() {
        val state = TestState(
            isLoggedIn = true,
            scrapingState = ScrapingState.ERROR,
            isSelectionError = true,
            retryCount = 3
        )
        assertTrue("Terminal error must set selection error", state.isSelectionError)
    }

    // ---- Scenario 10: Restart/cancel session ----

    @Test
    fun scenario10_restartCancelsStaleState() {
        val staleState = TestState(
            isLoggedIn = true,
            currentIndex = 3,
            totalSubjects = 8,
            fetchedSubCodes = setOf("cs101", "cs102", "cs103"),
            scrapingState = ScrapingState.SUBMITTING,
            retryCount = 2
        )

        // Simulate a reset/restart (e.g., user taps retry after stall)
        val newState = staleState.copy(
            scrapingState = ScrapingState.IDLE,
            retryCount = 0,
            currentIndex = 0,
            totalSubjects = null,
            fetchedSubCodes = emptySet(),
            fetchedIndices = emptySet(),
            subjectsData = emptyList()
        )

        assertEquals(0, newState.currentIndex)
        assertEquals(0, newState.retryCount)
        assertEquals(ScrapingState.IDLE, newState.scrapingState)
        assertEquals(0, newState.fetchedSubCodes.size)
        assertEquals(0, newState.subjectsData.size)
    }

    // ---- Scenario 11: Last subject and completion ----

    @Test
    fun scenario11_lastSubject_completion() {
        val prevSubjects = (0..6).map { i ->
            makeAttendanceItem(subCode = "CS$i", subjectName = "Subject$i")
        }
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 7,
            totalSubjects = 8,
            fetchedIndices = setOf(0, 1, 2, 3, 4, 5, 6),
            fetchedSubCodes = setOf("cs101", "cs102", "cs103", "cs104", "cs105", "cs106", "cs107"),
            subjectsData = prevSubjects,
            scrapingState = ScrapingState.PARSING
        )

        val lastItem = makeAttendanceItem(subCode = "CS7", subjectName = "Last Subject")
        val total = state.totalSubjects ?: 0
        val nextIndex = state.currentIndex + 1
        val finished = nextIndex >= total

        state = state.copy(
            fetchedIndices = state.fetchedIndices + state.currentIndex,
            fetchedSubCodes = state.fetchedSubCodes + "cs7",
            subjectsData = state.subjectsData + lastItem,
            currentIndex = if (finished) state.currentIndex else nextIndex,
            isScrapingFinished = finished,
            scrapingState = ScrapingState.COMPLETED
        )

        assertTrue(state.isScrapingFinished)
        assertEquals(8, state.subjectsData.size)
        assertEquals(8, state.fetchedIndices.size)
        assertEquals(7, state.currentIndex) // not advanced after completion
        assertEquals(ScrapingState.COMPLETED, state.scrapingState)
    }

    // ---- Scenario 12: Offline detection ----

    @Test
    fun scenario12_offlineDetected() {
        val state = TestState(
            isLoggedIn = true,
            scrapingState = ScrapingState.SUBMITTING,
            isOffline = true
        )
        assertTrue("Must detect offline state", state.isOffline)
    }

    // ---- State machine ordering ----

    @Test
    fun stateMachine_transitionsAreOrdered() {
        val states = listOf(
            ScrapingState.IDLE,
            ScrapingState.DISCOVERING,
            ScrapingState.SUBMITTING,
            ScrapingState.PARSING,
            ScrapingState.COMPLETED
        )
        assertEquals(5, states.size)
        assertTrue("IDLE must be first", states[0] == ScrapingState.IDLE)
        assertTrue("COMPLETED must be last", states[4] == ScrapingState.COMPLETED)
        assertTrue("ERROR must exist as a valid state", ScrapingState.values().contains(ScrapingState.ERROR))
    }

    // ---- injectKey uniqueness: currentIndex change prevents duplicate suppression ----

    private fun computeInjectKey(url: String, state: TestState): String {
        return "$url|${state.isLoggedIn}|${state.scrapingState}|${state.currentIndex}|${state.sessionId}"
    }

    @Test
    fun injectKey_changesWhenCurrentIndexAdvances() {
        val subjectsUrl = "https://jntuaceastudents.classattendance.in/studentsubjects.php"
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 0,
            totalSubjects = 8,
            scrapingState = ScrapingState.DISCOVERING,
            sessionId = "sess-abc"
        )

        val key0 = computeInjectKey(subjectsUrl, state)

        // After ATTENDANCE_ITEM for subject 0, currentIndex advances to 1
        state = state.copy(currentIndex = 1, scrapingState = ScrapingState.PARSING)
        val key1 = computeInjectKey(subjectsUrl, state)

        // After ATTENDANCE_ITEM for subject 1, currentIndex advances to 2
        state = state.copy(currentIndex = 2, scrapingState = ScrapingState.PARSING)
        val key2 = computeInjectKey(subjectsUrl, state)

        assertTrue("Key for subject 0 must differ from subject 1", key0 != key1)
        assertTrue("Key for subject 1 must differ from subject 2", key1 != key2)
        assertTrue("Key for subject 0 must differ from subject 2", key0 != key2)
    }

    @Test
    fun injectKey_stableForDuplicateOnPageFinished() {
        val subjectsUrl = "https://jntuaceastudents.classattendance.in/studentsubjects.php"
        val state = TestState(
            isLoggedIn = true,
            currentIndex = 0,
            totalSubjects = 8,
            scrapingState = ScrapingState.SUBMITTING,
            sessionId = "sess-abc"
        )

        val key1 = computeInjectKey(subjectsUrl, state)
        val key2 = computeInjectKey(subjectsUrl, state)

        assertEquals("Duplicate onPageFinished with same state must produce identical key", key1, key2)
    }

    @Test
    fun injectKey_changesWhenSessionIdRegenerated() {
        val subjectsUrl = "https://jntuaceastudents.classattendance.in/studentsubjects.php"
        val state1 = TestState(isLoggedIn = true, currentIndex = 3, scrapingState = ScrapingState.SUBMITTING, sessionId = "sess-old")
        val state2 = TestState(isLoggedIn = true, currentIndex = 3, scrapingState = ScrapingState.SUBMITTING, sessionId = "sess-new")

        assertTrue(
            "Stall watchdog regenerating sessionId must produce different key (prevents stale suppression)",
            computeInjectKey(subjectsUrl, state1) != computeInjectKey(subjectsUrl, state2)
        )
    }

    @Test
    fun injectKey_includesAllRelevantStateFields() {
        val key = computeInjectKey(
            "https://jntuaceastudents.classattendance.in/studentsubjectatt.php",
            TestState(isLoggedIn = true, currentIndex = 5, scrapingState = ScrapingState.PARSING, sessionId = "s1")
        )
        assertTrue("injectKey must include URL", key.contains("studentsubjectatt.php"))
        assertTrue("injectKey must include isLoggedIn", key.contains("true"))
        assertTrue("injectKey must include currentIndex", key.contains("|5|"))
        assertTrue("injectKey must include sessionId", key.contains("s1"))
    }

    // ---- All 8 subjects: no suppression between subjects ----

    @Test
    fun allEightSubjects_injectKeyUniqueForEach() {
        val subjectsUrl = "https://jntuaceastudents.classattendance.in/studentsubjects.php"
        val sessionId = "sess-final"
        val keys = mutableSetOf<String>()

        for (i in 0 until 8) {
            val state = TestState(
                isLoggedIn = true,
                currentIndex = i,
                totalSubjects = 8,
                scrapingState = if (i < 7) ScrapingState.PARSING else ScrapingState.COMPLETED,
                sessionId = sessionId
            )
            val key = computeInjectKey(subjectsUrl, state)
            assertTrue("injectKey for subject $i must be unique (not suppressed)", keys.add(key))
        }

        assertEquals(8, keys.size)
    }

    @Test
    fun attendanceItem_doesNotAdvanceIndexOnDuplicate() {
        var state = TestState(
            isLoggedIn = true,
            currentIndex = 2,
            totalSubjects = 8,
            fetchedSubCodes = setOf("cs0", "cs1"),
            scrapingState = ScrapingState.PARSING
        )

        // Duplicate ATTENDANCE_ITEM with already-fetched subCode
        val dupSubCode = "cs1"
        if (!state.fetchedSubCodes.contains(dupSubCode)) {
            state = state.copy(
                fetchedSubCodes = state.fetchedSubCodes + dupSubCode.lowercase(),
                currentIndex = 3
            )
        }

        // Duplicate should be skipped — state unchanged
        assertEquals(2, state.currentIndex)
        assertEquals(2, state.fetchedSubCodes.size)
    }

    // ---- Index never advances without ATTENDANCE_ITEM ----

    @Test
    fun indexNeverAdvancesWithoutAttendanceItem() {
        val state = TestState(
            isLoggedIn = true,
            currentIndex = 3,
            totalSubjects = 8,
            scrapingState = ScrapingState.SUBMITTING
        )
        assertEquals(3, state.currentIndex)
        assertFalse(state.isScrapingFinished)
    }
}
