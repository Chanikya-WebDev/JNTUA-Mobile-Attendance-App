package com.chanikya501.jntuaattendance

import com.chanikya501.jntuaattendance.webview.AutomationScriptManager
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File
import kotlin.text.RegexOption

class AutomationScriptRoutingTest {

    private fun loadBundledAssetScript(): String {
        val candidates = listOf(
            File("src/main/assets/automation_scripts.js"),
            File("app/src/main/assets/automation_scripts.js")
        )
        val file = candidates.firstOrNull { it.exists() }
        assertNotNull("Bundled asset automation_scripts.js should exist", file)
        return file!!.readText()
    }

    @Test
    fun handlePageLoad_usesActualLocationForRouting() {
        val script = loadBundledAssetScript()
        // The fixed handlePageLoad must use window.location.href for routing,
        // not the (possibly stale) url parameter from onPageFinished.
        assertTrue(
            "handlePageLoad must use window.location.href for actual page detection",
            script.contains("window.location.href")
        )
        assertTrue(
            "handlePageLoad must extract pagePath from actual location",
            script.contains("pagePath")
        )
    }

    @Test
    fun rootUrl_pagePathIsEmptyWithoutWarning() {
        val script = loadBundledAssetScript()
        // The pagePath extraction must strip the hostname before splitting,
        // so root URLs (ending with /) yield an empty pagePath. This prevents
        // the hostname fragment from appearing in routing logs.
        val pagePathLine = script.lines().firstOrNull { it.contains("var pagePath =") }
        assertNotNull("pagePath extraction must exist", pagePathLine)
        assertTrue(
            "pagePath must strip hostname (use pathOnly or location.pathname, not cleanUrl.split)",
            pagePathLine!!.contains("pathOnly") || pagePathLine.contains("location.pathname")
        )
    }

    @Test
    fun injectHumanNoteGuard_usesPathnameNotFullUrl() {
        val script = loadBundledAssetScript()
        // The guard line should contain both the isLoggedIn check and the student check
        val guardLine = script.lines().firstOrNull {
            it.contains("indexOf('student') === -1") && it.contains("isLoggedIn")
        }
        assertNotNull("injectHumanNote guard with student check must exist", guardLine)
        assertTrue(
            "Guard must use location.pathname (not cleanUrl) to avoid matching hostname",
            guardLine!!.contains("location.pathname")
        )
        assertFalse(
            "Guard must NOT use cleanUrl which contains hostname with 'student' substring",
            guardLine.contains("cleanUrl.indexOf('student')")
        )
    }

    @Test
    fun handlePageLoad_attendanceCheckBeforeHomeFormCheck() {
        val script = loadBundledAssetScript()
        val attCheckIdx = script.indexOf("studentsubjectatt.php")
        val formCheckIdx = script.indexOf("autoSubmitFirstSemester")
        assertTrue("Attendance URL check must exist", attCheckIdx > 0)
        assertTrue("autoSubmitFirstSemester call must exist", formCheckIdx > 0)
        // The attendance detail URL check (studentsubjectatt.php) must appear
        // BEFORE the autoSubmitFirstSemester routing path in the source.
        assertTrue(
            "Attendance detail check must come before autoSubmitFirstSemester routing",
            attCheckIdx < formCheckIdx
        )
    }

    @Test
    fun autoSubmitFirstSemester_requiresListGroupItem() {
        val script = loadBundledAssetScript()
        // The home page routing must check for .list-group-item elements
        // to distinguish from the attendance page (which has a form[action="studentsubjects.php"]
        // "Back to Subjects" button but no student details).
        assertTrue(
            "autoSubmitFirstSemester routing must check for .list-group-item to distinguish home page",
            script.contains(".list-group-item")
        )
        // Must NOT use the broad form[action="studentsubjects.php"] selector alone
        assertFalse(
            "Must not route to autoSubmitFirstSemester based solely on form[action=\"studentsubjects.php\"]",
            script.contains("document.querySelector('form[action=\"studentsubjects.php\"]')")
        )
    }

    @Test
    fun autoSubmitFirstSemester_doesNotSubmitWhenStudentInfoEmpty() {
        val script = loadBundledAssetScript()
        // Must check student info before submitting the form
        assertTrue(
            "autoSubmitFirstSemester must guard against empty student info",
            script.contains("!sname && !admissionNo")
        )
    }

    @Test
    fun selectSubjectByIndex_doesNotCallBeginScrapeSession() {
        val script = loadBundledAssetScript()
        // Extract the selectSubjectByIndex function body
        val match = Regex("""(?s)selectSubjectByIndex:\s*function\(targetIndex\)\s*\{(.*?)\},""").find(script)
        assertTrue("selectSubjectByIndex function must exist", match != null)
        val funcBody = match!!.groupValues[1]
        assertFalse(
            "selectSubjectByIndex must NOT call beginScrapeSession (which clears fetchedSubjectCodes)",
            funcBody.contains("beginScrapeSession")
        )
    }

    @Test
    fun submissionGuard_present() {
        val script = loadBundledAssetScript()
        assertTrue(
            "Must have _pendingSubjectIdx submission guard",
            script.contains("_pendingSubjectIdx")
        )
    }

    @Test
    fun sessionIdGeneration_present() {
        val script = loadBundledAssetScript()
        assertTrue(
            "Must have _sessionId for traceability",
            script.contains("_sessionId")
        )
    }

    @Test
    fun boundedRetry_present() {
        val script = loadBundledAssetScript()
        assertTrue(
            "Must have bounded retry (scheduleRetry with retryCount)",
            script.contains("scheduleRetry")
        )
        assertTrue(
            "Retry must be bounded (max 3)",
            script.contains("scheduleRetry(idx, 3)")
        )
    }

    @Test
    fun resetSubmissionState_present() {
        val script = loadBundledAssetScript()
        assertTrue(
            "Must have resetSubmissionState function",
            script.contains("resetSubmissionState")
        )
    }

    @Test
    fun parseDetailedAttendance_clearsPendingState() {
        val script = loadBundledAssetScript()
        // After parsing attendance, _pendingSubjectIdx must be cleared
        val parseMatch = Regex("""(?s)parseDetailedAttendanceAndGoHome:\s*function\(\)\s*\{(.*?)\},\s*resetSubmissionState""").find(script)
        assertTrue("parseDetailedAttendanceAndGoHome must exist", parseMatch != null)
        val funcBody = parseMatch!!.groupValues[1]
        assertTrue(
            "parseDetailedAttendanceAndGoHome must clear _pendingSubjectIdx after parsing",
            funcBody.contains("_pendingSubjectIdx = -1")
        )
    }

    @Test
    fun goBackToSubjects_clearsPendingState() {
        val script = loadBundledAssetScript()
        assertTrue(
            "goBackToSubjects must clear _pendingSubjectIdx when already on subjects page",
            script.contains("_pendingSubjectIdx = -1")
        )
    }

    @Test
    fun scriptStillPassesValidation() {
        val script = loadBundledAssetScript()
        assertTrue(
            "Modified script must still pass content validation (markers + signature)",
            AutomationScriptManager.validateScriptContent(script)
        )
    }

    @Test
    fun sessionStateFieldsPresent() {
        val script = loadBundledAssetScript()
        assertTrue("_sessionId field must exist", script.contains("_sessionId: ''"))
        assertTrue("_pendingSubjectIdx field must exist", script.contains("_pendingSubjectIdx: -1"))
    }

    // ---- Phase 3: routing priority ----

    @Test
    fun detailPageWithBackToSubjectsForm_routesToParserNotHome() {
        val script = loadBundledAssetScript()
        // studentsubjectatt.php (which renders a "Back to Subjects" form) must be
        // routed to the attendance parser BEFORE the home/submit path.
        val attCallIdx = script.indexOf("this.parseDetailedAttendanceAndGoHome();")
        val homeCallIdx = script.indexOf("this.autoSubmitFirstSemester();")
        assertTrue("Attendance parser call must exist", attCallIdx >= 0)
        assertTrue("Home submit call must exist", homeCallIdx >= 0)
        assertTrue(
            "Detail page must route to the attendance parser before the home path",
            attCallIdx < homeCallIdx
        )
        // Must detect attendance via DOM (table), not only URL, so a stale URL
        // cannot misroute.
        assertTrue("Must use DOM-based findAttendanceTable() for detail detection", script.contains("findAttendanceTable()"))
        // Must NOT use the broad form[action="studentsubjects.php"] selector that
        // matches the detail page's "Back to Subjects" button.
        assertFalse(
            "Must not route via bare form[action=studentsubjects.php]",
            script.contains("document.querySelector('form[action=\"studentsubjects.php\"]')")
        )
    }

    @Test
    fun homePage_extractsStudentDetailsAndSubmitsFirstSemesterForm() {
        val script = loadBundledAssetScript()
        // First/current semester form is .card.bg-light.text-primary (not text-secondary).
        assertTrue("Home route must scope to the first semester form", script.contains(".card.bg-light.text-primary form[action=\"studentsubjects.php\"]"))
        // Reads student details from .list-group-item.
        assertTrue("Home route must read .list-group-item student details", script.contains(".list-group-item"))
        // Posts STUDENT_INFO with extracted sname/admissionNo.
        assertTrue("Home flow must post STUDENT_INFO", script.contains("STUDENT_INFO"))
        // Guards against posting empty student info (the loop root cause).
        assertTrue("Home flow must guard empty student info", script.contains("!sname && !admissionNo"))
    }

    // ---- Phase 3/7: idempotency against duplicate callbacks ----

    @Test
    fun repeatedPageFinished_doesNotTriggerRepeatedSubmission() {
        val script = loadBundledAssetScript()
        // JS-level re-entry guard: selectSubjectByIndex must refuse while a submission
        // is already pending for the current index.
        assertTrue("selectSubjectByIndex must guard against re-entry via _pendingSubjectIdx", script.contains("_pendingSubjectIdx >= 0"))
        // Bounded retry (max 3), never unbounded.
        assertTrue("Retry must be bounded at 3", script.contains("scheduleRetry(idx, 3)"))
        // Detail page dedup: parseDetailedAttendanceAndGoHome must not repost the same
        // page via a __attPostedKey dedup.
        assertTrue("Detail parser must dedup with __attPostedKey", script.contains("__attPostedKey"))
    }

    // ---- Phase 5: deterministic form submission ----

    @Test
    fun selectedSubjectForm_yieldsAllRequiredPostFields() {
        val script = loadBundledAssetScript()
        assertTrue("Must declare the required POST fields", script.contains("requiredAttFields"))
        val required = listOf("_csrf", "subject_id", "subcode", "sub_fullname", "student_id", "class_id", "classname", "acad_year")
        required.forEach { field ->
            assertTrue("Required field $field must be referenced in the script", script.contains(field))
        }
        // Endpoint must be the attendance detail endpoint (not the legacy studentcourseatt.php).
        assertTrue("Fallback payload must post to studentsubjectatt.php", script.contains("f.action = 'studentsubjectatt.php'"))
        // Form ID must be resolved from the row's onclick attribute.
        assertTrue("Must resolve form ID from the row onclick", script.contains("resolveFormForRow"))
    }

    // ---- Phase 6: validate detail before accepting ----

    @Test
    fun detailPage_subjectCodeMatchesSubmittedCode() {
        val script = loadBundledAssetScript()
        // The submitted subject code is stashed for the next detail page.
        assertTrue("selectSubjectByIndex must stash the submitted subject code", script.contains("sessionStorage.setItem('pendingSubjectCode', rowCodes[idx])"))
        // The detail parser compares the returned code with the pending submitted code.
        assertTrue("parseDetailedAttendanceAndGoHome must read pendingSubjectCode", script.contains("sessionStorage.getItem('pendingSubjectCode')"))
        assertTrue("parseDetailedAttendanceAndGoHome must compare codes via norm()", script.contains("norm(pendingCode) !== norm(parsed.subCode)"))
    }

    @Test
    fun malformedDetailTable_producesControlledFailure() {
        val script = loadBundledAssetScript()
        // Empty record set after a table was located must not be posted as ATTENDANCE_ITEM.
        assertTrue("Empty record set must be a controlled SCRAPE_ERROR", script.contains("records.length === 0"))
        assertTrue("Controlled failure path must emit SCRAPE_ERROR", script.contains("SCRAPE_ERROR"))
        // Missing table / headers produces a bounded SCRAPE_IDLE (not endless navigation).
        assertTrue("Missing table must produce SCRAPE_IDLE", script.contains("SCRAPE_IDLE"))
    }

    // ---- Phase 4: session idempotency & persistence ----

    @Test
    fun fetchedCodes_persistAcrossNavigation() {
        val script = loadBundledAssetScript()
        // Fetched codes live in sessionStorage (survives full document navigations that
        // re-inject the script) and are read back when choosing the next subject.
        assertTrue("readFetched must read from sessionStorage", script.contains("sessionStorage.getItem('fetchedSubjectCodes')"))
        assertTrue("Fetched codes must be written to sessionStorage", script.contains("sessionStorage.setItem('fetchedSubjectCodes'"))
    }

    @Test
    fun beginScrapeSession_doesNotClearFetchedSubjectCodes() {
        val script = loadBundledAssetScript()
        val beginMatch = Regex("""(?s)beginScrapeSession:\s*function\(\)\s*\{(.*?)\},""").find(script)
        assertTrue("beginScrapeSession must exist", beginMatch != null)
        val body = beginMatch!!.groupValues[1]
        assertFalse(
            "beginScrapeSession must NOT clear fetchedSubjectCodes (normal routing must preserve progress)",
            body.contains("removeItem('fetchedSubjectCodes')") || body.contains("removeItem(\"fetchedSubjectCodes\")")
        )
    }

    @Test
    fun newSession_clearsPreviousProgress() {
        val script = loadBundledAssetScript()
        val resetMatch = Regex("""(?s)resetScrapeSession:\s*function\(\)\s*\{(.*?)\},""").find(script)
        assertTrue("resetScrapeSession must exist", resetMatch != null)
        val body = resetMatch!!.groupValues[1]
        assertTrue("resetScrapeSession must clear fetchedSubjectCodes", body.contains("removeItem('fetchedSubjectCodes')"))
        assertTrue("resetScrapeSession must clear the session id", body.contains("removeItem('scrapeSessionId')"))
        assertTrue("resetScrapeSession must clear pendingSubjectCode", body.contains("removeItem('pendingSubjectCode')"))
    }
}
