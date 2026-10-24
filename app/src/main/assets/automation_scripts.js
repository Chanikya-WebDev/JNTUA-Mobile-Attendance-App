/**
 * JNTUA Attendance Automation Scripts (OTA Bundle)
 * Version: 2026.10.24.1
 * Portal: https://jntuaceastudents.classattendance.in
 */
// Signature: MEYCIQDh95gi7SLFHFyIhCSKf0mMSexaBdsKNgRCB6QC7/h0+gIhAJjaALAxrAXaxVFQAigsEKlgi3PJTeOsizRYZshZInjU
(function() {
    'use strict';

    // 1. Android / React Native WebView Bridge Shim
    if (!window.ReactNativeWebView) {
        window.ReactNativeWebView = {
            postMessage: function(data) {
                try {
                    if (window.AndroidBridge && window.AndroidBridge.postMessage) {
                        window.AndroidBridge.postMessage(typeof data === 'string' ? data : JSON.stringify(data));
                    }
                } catch(e) {}
            }
        };
    }

    // Helper: Post Bridge Message
    function post(type, extra) {
        var payload = JSON.stringify(Object.assign({ type: type }, extra || {}));
        if (window.AndroidBridge && window.AndroidBridge.postMessage) {
            window.AndroidBridge.postMessage(payload);
        } else if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(payload);
        }
    }

    // Helper: Check if scraping session is active
    function isScrapeActive() {
        try { return sessionStorage.getItem('scrapeActive') === '1'; }
        catch (e) { return false; }
    }

    function norm(s) { return (s || '').trim().toLowerCase(); }

    function readFetched() {
        try {
            var raw = sessionStorage.getItem('fetchedSubjectCodes') || '[]';
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function rowCode(row) {
        var c = row ? row.querySelector('td:first-child') : null;
        var t = c ? (c.textContent || '') : '';
        return t.trim();
    }

    function parseHeader(el) {
        if (!el) return { subCode: '', subjectName: '' };
        var text = el.innerText || '';
        if (!text) {
            var tmp = document.createElement('div');
            tmp.innerHTML = el.innerHTML || '';
            text = tmp.textContent || '';
        }
        var parts = text.split(/\n+/).map(function(s) { return s.trim(); }).filter(Boolean);
        if (parts.length >= 2) {
            return { subCode: parts[0], subjectName: parts.slice(1).join(' ') };
        }
        var m = text.match(/^\s*([A-Za-z0-9]+)\s+(.+)$/);
        if (m) return { subCode: m[1], subjectName: m[2] };
        return { subCode: '', subjectName: parts[0] || '' };
    }

    function findAttendanceTable() {
        var tables = document.querySelectorAll('table');
        for (var i = 0; i < tables.length; i++) {
            var head = tables[i].querySelector('thead');
            if (head && /attendance/i.test(head.textContent || '')) return tables[i];
        }
        return null;
    }

    function isCodeLike(s) {
        if (!s || s.length < 3 || s.length > 15) return false;
        for (var ci = 0; ci < s.length; ci++) {
            var c = s.charCodeAt(ci);
            var ok = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
            if (!ok) return false;
        }
        return true;
    }

    function goBackToSubjects() {
        var targetUrl = 'https://jntuaceastudents.classattendance.in/studentsubjects.php';
        var sid = window.JNTUAScraper && window.JNTUAScraper._sessionId ? window.JNTUAScraper._sessionId : '';
        console.log('[AttendanceScraper][SID:' + sid + '] goBackToSubjects called from ' + window.location.href);

        if (window.location.href.indexOf('studentsubjects.php') !== -1 ||
            window.location.pathname.indexOf('studentsubjects.php') !== -1) {
            console.log('[AttendanceScraper][SID:' + sid + '] Already on studentsubjects.php');
            // Clear pending submission state when we return to the subjects list
            if (window.JNTUAScraper) window.JNTUAScraper._pendingSubjectIdx = -1;
            return;
        }

        // Primary Method: Submit the existing "Back to Subjects" form that is
        // already present on the attendance detail page (studentsubjectatt.html).
        // This form carries the live _csrf, student_id, class_id, classname, and
        // acad_year values — same fields/methods as the page's own Subjects button.
        try {
            var existingForm = document.querySelector('form[action="studentsubjects.php"], form[action*="studentsubjects.php"]');
            if (existingForm) {
                console.log('[AttendanceScraper][SID:' + sid + '] Submitting existing "Back to Subjects" form found on the page');
                try { existingForm.removeAttribute('target'); existingForm.target = '_self'; } catch (e0) {}
                try {
                    if (existingForm.requestSubmit) existingForm.requestSubmit();
                    else HTMLFormElement.prototype.submit.call(existingForm);
                    return;
                } catch (e1) {
                    HTMLFormElement.prototype.submit.call(existingForm);
                    return;
                }
            }
        } catch (eExisting) {
            console.error('[AttendanceScraper] Existing "Back to Subjects" form submission failed: ' + (eExisting && eExisting.message ? eExisting.message : String(eExisting)));
        }

        // Fallback: Submit synthetic POST form to studentsubjects.php with class context
        // (used when the page doesn't yet render the in-DOM form, e.g. early load).
        try {
            var ctxRaw = sessionStorage.getItem('subjectsCtx') || sessionStorage.getItem('homeFormInputs');
            if (ctxRaw) {
                var ctx = JSON.parse(ctxRaw);
                if (ctx && (ctx.class_id || ctx.classname || ctx.student_id)) {
                    console.log('[AttendanceScraper] Submitting synthetic POST form to ' + targetUrl + ' with saved class context');
                    var form = document.createElement('form');
                    form.method = 'POST';
                    form.action = targetUrl;
                    for (var key in ctx) {
                        if (ctx.hasOwnProperty(key) && ctx[key]) {
                            var input = document.createElement('input');
                            input.type = 'hidden';
                            input.name = key;
                            input.value = ctx[key];
                            form.appendChild(input);
                        }
                    }
                    document.body.appendChild(form);
                    form.submit();
                    return;
                }
            }
        } catch (eForm) {
            console.error('[AttendanceScraper] Synthetic form submission failed: ' + (eForm && eForm.message ? eForm.message : String(eForm)));
        }

        // Last resort: Direct window.location.replace
        try {
            console.log('[AttendanceScraper] Fallback: window.location.replace to ' + targetUrl);
            window.location.replace(targetUrl);
        } catch (eReplace) {
            console.error('[AttendanceScraper] window.location.replace fallback failed: ' + (eReplace && eReplace.message ? eReplace.message : String(eReplace)));
        }
    }

    var requiredAttFields = ['_csrf', 'subject_id', 'subcode', 'sub_fullname', 'student_id', 'class_id', 'classname', 'acad_year'];

    function hasAllRequiredFields(map) {
        for (var k = 0; k < requiredAttFields.length; k++) {
            var v = map[requiredAttFields[k]];
            if (v === undefined || v === null || String(v).trim() === '') return false;
        }
        return true;
    }

    function resolveFormForRow(row) {
        try {
            var onclick = row.getAttribute('onclick') || '';
            var m = onclick.match(/getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (m) return document.getElementById(m[1]);
        } catch (e) {}
        return null;
    }

    function collectSubjectFields(idx) {
        var rows = document.querySelectorAll('tr.clickable-row');
        var row = rows[idx];
        var fields = {};
        if (!row) return fields;
        var form = resolveFormForRow(row);
        if (form) {
            var owned = form.querySelectorAll('input');
            for (var i = 0; i < owned.length; i++) {
                if (owned[i].name) fields[owned[i].name] = owned[i].value;
            }
            var sib = form.nextElementSibling;
            while (sib && sib.tagName === 'INPUT') {
                if (sib.name) fields[sib.name] = sib.value;
                sib = sib.nextElementSibling;
            }
        }
        if (!fields['subcode']) { var rc = rowCode(row); if (rc) fields['subcode'] = rc; }
        if (!fields['sub_fullname']) {
            var tds = row.querySelectorAll('td');
            if (tds.length >= 2) fields['sub_fullname'] = (tds[1].textContent || '').trim();
        }
        try {
            var ctx = JSON.parse(sessionStorage.getItem('subjectsCtx') || '{}');
            if (!fields['student_id'] && ctx.student_id) fields['student_id'] = ctx.student_id;
            if (!fields['class_id'] && ctx.class_id) fields['class_id'] = ctx.class_id;
            if (!fields['classname'] && ctx.classname) fields['classname'] = ctx.classname;
            if (!fields['acad_year'] && ctx.acad_year) fields['acad_year'] = ctx.acad_year;
            if (!fields['_csrf'] && ctx._csrf) fields['_csrf'] = ctx._csrf;
            if (!fields['_csrf']) {
                var csrfEl = document.querySelector('input[name="_csrf"]');
                if (csrfEl) fields['_csrf'] = csrfEl.value;
            }
            if (!fields['subject_id']) fields['subject_id'] = '';
        } catch (e) {}
        return fields;
    }

    function payloadForIndex(idx) {
        return collectSubjectFields(idx);
    }

    function submitPayload(p) {
        try {
            var f = document.createElement('form');
            f.method = 'post';
            f.action = 'studentsubjectatt.php';
            f.style.display = 'none';
            Object.keys(p).forEach(function(k) {
                var inp = document.createElement('input');
                inp.type = 'hidden'; inp.name = k; inp.value = p[k] || '';
                f.appendChild(inp);
            });
            document.body.appendChild(f);
            f.submit();
            return true;
        } catch (e) { return false; }
    }

    function submitRowByIndex(idx) {
        var rows = document.querySelectorAll('tr.clickable-row');
        var row = rows[idx];
        if (!row) return false;
        var sid = (window.JNTUAScraper && window.JNTUAScraper._sessionId) || '';
        var attemptedNative = false;

        try {
            var form = resolveFormForRow(row);
            if (form) {
                var sib = form.nextElementSibling;
                while (sib && sib.tagName === 'INPUT') {
                    var nxt = sib.nextElementSibling;
                    form.appendChild(sib);
                    sib = nxt;
                }
                var flds = {};
                var merged = form.querySelectorAll('input');
                for (var i = 0; i < merged.length; i++) {
                    if (merged[i].name) flds[merged[i].name] = merged[i].value;
                }
                var code = flds['subcode'] || rowCode(row);
                console.log('[AttendanceScraper][SID:' + sid + '] [state:SUBMITTING] subject=' + code + ', index=' + idx + ', payload=' + (hasAllRequiredFields(flds) ? 'complete' : 'incomplete'));
                if (hasAllRequiredFields(flds)) {
                    attemptedNative = true;
                    try { sessionStorage.setItem('pendingSubjectCode', code); } catch (e) {}
                    try { form.removeAttribute('target'); form.target = '_self'; } catch (e0) {}
                    if (form.requestSubmit) {
                        try {
                            form.requestSubmit();
                            return true;
                        } catch (e1) {
                            try { HTMLFormElement.prototype.submit.call(form); } catch (e2) {}
                            return true;
                        }
                    } else {
                        try { HTMLFormElement.prototype.submit.call(form); } catch (e3) {}
                        return true;
                    }
                }
            }
        } catch (eForm) {}

        var p = collectSubjectFields(idx);
        var pcode = p['subcode'] || rowCode(row);
        console.log('[AttendanceScraper][SID:' + sid + '] [state:SUBMITTING] fallback for subject=' + pcode + ', index=' + idx + ', payload=' + (hasAllRequiredFields(p) ? 'complete' : 'incomplete'));
        if (!attemptedNative && hasAllRequiredFields(p)) {
            try { sessionStorage.setItem('pendingSubjectCode', pcode); } catch (e) {}
            if (submitPayload(p)) return true;
        }
        try { row.click(); return true; } catch (e) { return false; }
    }

    // Master Scraper Object
    window.JNTUAScraper = {
        version: "2026.10.24.1",
        portalBaseUrl: "https://jntuaceastudents.classattendance.in",
        portalHost: "jntuaceastudents.classattendance.in",

        injectHumanNote: function() {
            var existing = document.getElementById('human-verify-note');
            if (location.pathname.indexOf('studenthome.php') !== -1 ||
                location.pathname.indexOf('studentsubjects.php') !== -1 ||
                location.pathname.indexOf('studentsubjectatt.php') !== -1 ||
                location.pathname.indexOf('studentsubatt.php') !== -1) {
                if (existing) existing.remove();
                return;
            }
            if (existing) return;
            var note = document.createElement('div');
            note.id = 'human-verify-note';
            note.textContent = "⚠️ Don't click login until you are verified as human";
            note.style.cssText = "background-color: #efe9de; color: #cc785c; padding: 10px 14px; margin: 12px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; text-align: center; border: 1px solid #e8e0d2;";
            var form = document.querySelector('form') || document.body;
            form.insertBefore(note, form.firstChild);
        },

        _sessionId: '',
        _pendingSubjectIdx: -1,
        _processedPages: {},

        beginScrapeSession: function() {
            try {
                sessionStorage.setItem('scrapeActive', '1');
                var existing = sessionStorage.getItem('scrapeSessionId');
                if (!existing) {
                    existing = Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
                    sessionStorage.setItem('scrapeSessionId', existing);
                }
                this._sessionId = existing;
            } catch (e) {}
        },

        resetScrapeSession: function() {
            try {
                sessionStorage.removeItem('fetchedSubjectCodes');
                sessionStorage.removeItem('scrapeActive');
                sessionStorage.removeItem('scrapeSessionId');
                sessionStorage.removeItem('pendingSubjectCode');
            } catch (e) {}
            this._sessionId = '';
            this._pendingSubjectIdx = -1;
        },

        endScrapeSession: function() {
            try {
                sessionStorage.removeItem('scrapeActive');
            } catch (e) {}
        },

        autoSubmitFirstSemester: function() {
            this.beginScrapeSession();
            var sid = this._sessionId || '';

            var attempts = 0;
            var interval = setInterval(function() {
                attempts++;
                // Only match the home-page navigation form, which is inside
                // .card.bg-light.text-primary AND accompanied by student details.
                var firstForm = document.querySelector('.card.bg-light.text-primary form[action="studentsubjects.php"]');
                var hasStudentDetails = !!document.querySelector('.list-group-item');

                if (firstForm && hasStudentDetails) {
                    clearInterval(interval);
                    var admissionNo = '';
                    var sname = '';

                    document.querySelectorAll('.list-group-item').forEach(function(item) {
                        var strong = item.querySelector('strong');
                        if (!strong) return;
                        var label = strong.textContent || '';
                        var value = ((strong.nextSibling && strong.nextSibling.textContent) || '').trim();
                        if (/Username|Roll No/i.test(label)) admissionNo = value;
                        else if (/Full Name/i.test(label)) sname = value;
                    });
                    sname = (sname || '').trim();
                    admissionNo = (admissionNo || '').trim();

                    var className = '';
                    var classInput = firstForm.querySelector('input[name="classname"]');
                    if (classInput) {
                        className = (classInput.value || '').trim();
                    }

                    try {
                        var homeInputs = {};
                        var allInps = firstForm.querySelectorAll('input');
                        allInps.forEach(function(inp) {
                            if (inp.name) homeInputs[inp.name] = inp.value;
                        });
                        sessionStorage.setItem('homeFormInputs', JSON.stringify(homeInputs));
                    } catch (eInputs) {}

                    console.log('[AttendanceScraper][SID:' + sid + '] [state:SUBMIT_HOME] idx=' + attempts + ', class=' + className);

                    // If student info is empty, do NOT submit the form.
                    // This prevents the loop where autoSubmitFirstSemester is
                    // called on the wrong page (e.g., the attendance page which
                    // has a "Back to Subjects" form but no .list-group-item details).
                    if (!sname && !admissionNo) {
                        console.error('[AttendanceScraper][SID:' + sid + '] [state:ERROR] Student info empty on home page — cannot proceed');
                        post('SCRAPE_ERROR', {
                            message: 'Missing student information (sname and admissionNo both empty) on home page'
                        });
                        return;
                    }

                    post('STUDENT_INFO', {
                        data: { sname: sname, admissionNo: admissionNo, className: className }
                    });

                    try {
                        firstForm.submit();
                    } catch (e) {
                        console.error('[AttendanceScraper][SID:' + sid + '] Home form submit failed: ' + (e && e.message ? e.message : String(e)));
                        post('SCRAPE_ERROR', {
                            message: 'Home form submit failed: ' + (e && e.message ? e.message : String(e))
                        });
                    }
                } else if (attempts >= 20) {
                    clearInterval(interval);
                    if (!hasStudentDetails && !firstForm) {
                        console.error('[AttendanceScraper][SID:' + sid + '] [state:ERROR] Home page not detected after 4s — possible session expiry or unexpected page');
                        post('SCRAPE_ERROR', {
                            message: 'Home page form and student details not detected — possible session expiry or unexpected redirect'
                        });
                    } else if (!hasStudentDetails) {
                        console.error('[AttendanceScraper][SID:' + sid + '] [state:ERROR] Student details (.list-group-item) not found on home page');
                        post('SCRAPE_ERROR', {
                            message: 'Student details not found on home page — possible session expiry'
                        });
                    } else {
                        console.warn('[AttendanceScraper][SID:' + sid + '] Home form not detected after 4s');
                    }
                }
            }, 200);
         },

        selectSubjectByIndex: function(targetIndex) {
            var sid = this._sessionId || '';

            // Prevent re-entry while a submission is already in progress for this target
            if (this._pendingSubjectIdx >= 0) {
                console.log('[AttendanceScraper][SID:' + sid + '] [state:SUBMITTING] selectSubjectByIndex(' + targetIndex + ') aborted — pending submission for idx=' + this._pendingSubjectIdx);
                return;
            }

            var attempts = 0;
            var interval = setInterval(function() {
                attempts++;
                var rows = document.querySelectorAll('tr.clickable-row');
                if (rows.length > 0) {
                    clearInterval(interval);
                    var fetchedCodes = readFetched();
                    var fetchedNorm = fetchedCodes.map(function(c) { return norm(c); });
                    var rowCodes = [];
                    for (var r = 0; r < rows.length; r++) rowCodes.push(rowCode(rows[r]));
                    var sidLocal = window.JNTUAScraper._sessionId || '';
                    console.log('[AttendanceScraper][SID:' + sidLocal + '] [state:DISCOVERING] Found ' + rows.length + ' subjects, targetIndex=' + targetIndex + ', alreadyFetched=' + fetchedCodes.length);

                    post('SUBJECT_COUNT', { count: rows.length });

                    var idx = targetIndex;
                    try {
                        var csrf0 = document.querySelector('input[name="_csrf"]');
                        var sid0 = document.querySelector('input[name="student_id"]');
                        var cid0 = document.querySelector('input[name="class_id"]');
                        var cname0 = document.querySelector('input[name="classname"]');
                        var acad0 = document.querySelector('input[name="acad_year"]');
                        sessionStorage.setItem('subjectsCtx', JSON.stringify({
                            _csrf: csrf0 ? csrf0.value : '',
                            student_id: sid0 ? sid0.value : '',
                            class_id: cid0 ? cid0.value : '',
                            classname: cname0 ? cname0.value : '',
                            acad_year: acad0 ? acad0.value : ''
                        }));
                    } catch (eCtx) {}

                    while (idx < rows.length && fetchedNorm.indexOf(norm(rowCodes[idx])) !== -1 && norm(rowCodes[idx]) !== '') {
                        console.log('[AttendanceScraper][SID:' + sidLocal + '] [state:SUBMITTING] Skipping already fetched subject ' + rowCodes[idx] + ' at index ' + idx);
                        post('SUBJECT_SKIPPED', {
                            subcode: rowCodes[idx],
                            index: idx
                        });
                        idx++;
                    }

                    if (idx < rows.length) {
                        console.log('[AttendanceScraper][SID:' + sidLocal + '] [state:SUBMITTING] Submitting subject ' + rowCodes[idx] + ' at index ' + idx);
                        // Mark submission as in-progress to prevent duplicates
                        window.JNTUAScraper._pendingSubjectIdx = idx;
                        try { sessionStorage.setItem('pendingSubjectCode', rowCodes[idx]); } catch (e) {}
                        submitRowByIndex(idx);

                        // Bounded retry: check at most 3 times after form submission
                        var scheduleRetry = function(retryIdx, retryCount) {
                            if (retryCount <= 0) return;
                            setTimeout(function() {
                                try {
                                    var currentPath = (window.location.pathname || '').split('/').pop() || '';
                                    var stillRows = document.querySelectorAll('tr.clickable-row');
                                    if (stillRows.length > 0 && stillRows[retryIdx] &&
                                        currentPath.indexOf('studentsubjects.php') !== -1 &&
                                        window.JNTUAScraper._pendingSubjectIdx === retryIdx) {
                                        console.warn('[AttendanceScraper][SID:' + (window.JNTUAScraper._sessionId || '') + '] [state:SUBMITTING] Retry onclick for index ' + retryIdx + ' (attempt ' + (3 - retryCount + 1) + '/3)');
                                        try { stillRows[retryIdx].click(); } catch (eR) {}
                                        scheduleRetry(retryIdx, retryCount - 1);
                                    }
                                } catch (eR2) {}
                            }, 3500);
                        };
                        scheduleRetry(idx, 3);
                    } else {
                        console.log('[AttendanceScraper][SID:' + sid + '] [state:COMPLETED] All subjects fetched! Posting SCRAPING_COMPLETE');
                        window.JNTUAScraper._pendingSubjectIdx = -1;
                        post('SCRAPING_COMPLETE');
                    }
                } else if (attempts >= 20) {
                    clearInterval(interval);
                    console.error('[AttendanceScraper][SID:' + sid + '] [state:ERROR] No subject rows found after 4s');
                    post('SCRAPE_IDLE', {
                        reason: 'No subject rows after 4s — likely off-script navigation.'
                    });
                }
            }, 200);
        },

        parseDetailedAttendanceAndGoHome: function() {
            var sid = this._sessionId || '';

            var attempts = 0;
            var interval = setInterval(function() {
                attempts++;
                var headers = document.querySelectorAll('.card-header');
                var table = findAttendanceTable();

                if (headers.length < 2 || !table) {
                    if (attempts >= 25) {
                        clearInterval(interval);
                        var errSid = window.JNTUAScraper._sessionId || '';
                        console.error('[AttendanceScraper][SID:' + errSid + '] [state:ERROR] Attendance page not detected after 5s (headers=' + headers.length + ', table=' + (!!table) + ')');
                        window.JNTUAScraper._pendingSubjectIdx = -1;
                        post('SCRAPE_IDLE', {
                            reason: 'Attendance page not detected after 5s (headers=' + headers.length + ', table=' + (!!table) + ').'
                        });
                    }
                    return;
                }
                clearInterval(interval);
                var currentSid = window.JNTUAScraper._sessionId || '';
                console.log('[AttendanceScraper][SID:' + currentSid + '] [state:PARSING] Attendance table detected. Parsing rows...');

                try {
                    var keyEl = headers[1] || headers[0];
                    var pageKey = location.href + '|' + ((keyEl && (keyEl.innerText || '')) || '');
                    if (window.__attPostedKey === pageKey) { setTimeout(goBackToSubjects, 300); return; }
                    window.__attPostedKey = pageKey;
                } catch (eK) {}

                var subjectHeader = null;
                for (var i = 0; i < headers.length; i++) {
                    var el = headers[i];
                    var html = el.innerHTML || '';
                    if (html.indexOf('<br') !== -1 || html.indexOf('<BR') !== -1) {
                        var cand = parseHeader(el);
                        if (cand.subCode && isCodeLike(cand.subCode)) { subjectHeader = el; break; }
                        if (!subjectHeader) subjectHeader = el;
                    }
                }
                if (!subjectHeader) subjectHeader = headers[1] || headers[0];

                var parsed = parseHeader(subjectHeader);
                var bodyRows = table.querySelectorAll('tbody tr');
                var present = 0, absent = 0;
                var records = [];

                for (var i = 0; i < bodyRows.length; i++) {
                    var cells = bodyRows[i].querySelectorAll('td');
                    if (cells.length !== 3) continue;
                    var date = (cells[0].textContent || '').trim();
                    var time = (cells[1].textContent || '').trim();
                    var badge = cells[2].querySelector('span.badge');
                    var raw = badge ? (badge.textContent || '').trim() : 'Unknown';
                    var status = 'Unknown';
                    if (/present/i.test(raw)) status = 'Present';
                    else if (/absent/i.test(raw)) status = 'Absent';
                    if (status === 'Present') present++;
                    else if (status === 'Absent') absent++;
                    records.push({ date: date, time: time, status: status });
                }

                var total = present + absent;
                var percentage = total > 0 ? ((present / total) * 100).toFixed(2) : '0.00';

                if (records.length === 0) {
                    console.error('[AttendanceScraper][SID:' + currentSid + '] [state:ERROR] Attendance table yielded no parseable rows — aborting to allow retry');
                    window.JNTUAScraper._pendingSubjectIdx = -1;
                    post('SCRAPE_ERROR', { message: 'Attendance table present but no parseable rows found' });
                    setTimeout(function() { window.JNTUAScraper._pendingSubjectIdx = -1; goBackToSubjects(); }, 300);
                    return;
                }

                try {
                    var pendingCode = sessionStorage.getItem('pendingSubjectCode') || '';
                    if (pendingCode && parsed.subCode && norm(pendingCode) !== norm(parsed.subCode)) {
                        console.error('[AttendanceScraper][SID:' + currentSid + '] [state:ERROR] Subject code mismatch: submitted=' + pendingCode + ' but detail page returned ' + parsed.subCode);
                        window.JNTUAScraper._pendingSubjectIdx = -1;
                        post('SCRAPE_ERROR', { message: 'Subject code mismatch: submitted ' + pendingCode + ' but detail returned ' + parsed.subCode + ' (' + parsed.subjectName + ')' });
                        setTimeout(function() { window.JNTUAScraper._pendingSubjectIdx = -1; goBackToSubjects(); }, 300);
                        return;
                    }
                } catch (e) {}

                if (parsed.subCode) {
                    try {
                        var raw = sessionStorage.getItem('fetchedSubjectCodes') || '[]';
                        var p = JSON.parse(raw);
                        var list = Array.isArray(p) ? p : [];
                        var want = norm(parsed.subCode);
                        var has = false;
                        for (var li = 0; li < list.length; li++) {
                            if (norm(list[li]) === want) { has = true; break; }
                        }
                        if (!has) list.push(parsed.subCode.trim());
                        sessionStorage.setItem('fetchedSubjectCodes', JSON.stringify(list));
                    } catch (e) {
                        try {
                            sessionStorage.setItem('fetchedSubjectCodes', JSON.stringify([parsed.subCode.trim()]));
                        } catch (ignored) {}
                    }
                }

                console.log('[AttendanceScraper][SID:' + currentSid + '] [state:PARSING] Parsed ' + parsed.subCode + ' (' + parsed.subjectName + '): ' + percentage + '% (' + present + '/' + total + ' classes). Posting ATTENDANCE_ITEM...');
                post('ATTENDANCE_ITEM', {
                    data: {
                        subCode: parsed.subCode,
                        subjectName: parsed.subjectName,
                        present: present,
                        absent: absent,
                        total: total,
                        percentage: percentage,
                        records: records
                    }
                });

                // Mark this subject as successfully parsed at the JS level
                window.JNTUAScraper._pendingSubjectIdx = -1;

                setTimeout(function() {
                    window.JNTUAScraper._pendingSubjectIdx = -1;
                    goBackToSubjects();
                }, 300);
            }, 200);
        },

        resetSubmissionState: function() {
            this._pendingSubjectIdx = -1;
        },

         handlePageLoad: function(url, targetIndex, isLoggedIn, isScrapingActive) {
             var sid = this._sessionId || '';
             // Use the ACTUAL current location for routing, not the (possibly stale)
             // url parameter from onPageFinished. This prevents a late duplicate
             // onPageFinished (e.g. from a previous navigation) from routing
             // based on the wrong URL.
             var actualHref = window.location.href || '';
             var cleanUrl = (actualHref || url || '').split('#')[0];
             // Extract pathname first so root URLs (ending with /) produce an
             // empty pagePath instead of the hostname fragment. This prevents
             // "Unhandled page" warnings for the landing/login page.
             var pathOnly = cleanUrl.replace(/^https?:\/\/[^\/]+/, '') || '/';
             var pagePath = pathOnly.split('?')[0].split('/').filter(function(p) { return p !== ''; }).pop() || '';
             console.log('[AttendanceScraper][SID:' + sid + '] [state:ROUTING] handlePageLoad: urlParam=' + (url || '') + ', actual=' + pagePath + ', targetIdx=' + targetIndex + ', loggedIn=' + isLoggedIn);
             if (!isLoggedIn && (location.pathname || '').indexOf('student') === -1) {
                 this.injectHumanNote();
                 return;
             }

            // Attendance detail page — check FIRST and ALWAYS. The attendance page
            // renders a "Back to Subjects" button (form action="studentsubjects.php")
            // which would otherwise match the broad form[action="studentsubjects.php"]
            // selector and incorrectly route to autoSubmitFirstSemester.
            // We check both URL and DOM content for robustness.
            if (pagePath.indexOf('studentsubjectatt.php') !== -1 ||
                pagePath.indexOf('studentsubatt.php') !== -1 ||
                findAttendanceTable()) {
                this.parseDetailedAttendanceAndGoHome();
                return;
            }

            // Home page (studenthome.php). Only route here when the page actually
            // contains student details (.list-group-item). This prevents the
            // attendance page's "Back to Subjects" form from being misrouted.
            var hasStudentDetails = !!document.querySelector('.list-group-item');
            if (pagePath.indexOf('studenthome.php') !== -1 || hasStudentDetails) {
                this.autoSubmitFirstSemester();
                return;
            }

            if (pagePath.indexOf('studentsubjects.php') !== -1 || document.querySelector('tr.clickable-row')) {
                this.selectSubjectByIndex(targetIndex);
            } else if (findAttendanceTable()) {
                this.parseDetailedAttendanceAndGoHome();
            } else {
                console.warn('[AttendanceScraper][SID:' + sid + '] [state:ROUTING] Unhandled page: ' + pagePath);
            }
         }
    };
})();
true;
