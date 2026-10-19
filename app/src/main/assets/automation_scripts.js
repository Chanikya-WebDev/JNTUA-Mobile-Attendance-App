/**
 * JNTUA Attendance Automation Scripts (OTA Bundle)
 * Version: 2026.10.18.1
 * Portal: https://jntuaceastudents.classattendance.in
 */
// Signature: MEYCIQD9i83rqSH+U0l3LOzR6lm0yuPWqOzSLUdEwZHUYCXkkgIhANB4jHKZCp6TFFegcx5ubhhwDz/FRexbL0me2hKhjaK2
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
        console.log('[AttendanceScraper] goBackToSubjects called from ' + window.location.href);

        if (window.location.href.indexOf('studentsubjects.php') !== -1 ||
            window.location.pathname.indexOf('studentsubjects.php') !== -1) {
            console.log('[AttendanceScraper] Already on studentsubjects.php');
            return;
        }

        // Primary Method: Submit synthetic POST form to studentsubjects.php with class context.
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

        // Fallback: Direct window.location.replace
        try {
            console.log('[AttendanceScraper] Fallback: window.location.replace to ' + targetUrl);
            window.location.replace(targetUrl);
        } catch (eReplace) {
            console.error('[AttendanceScraper] window.location.replace fallback failed: ' + (eReplace && eReplace.message ? eReplace.message : String(eReplace)));
        }
    }

    function payloadForIndex(idx) {
        try {
            var buckets = [];
            var current = null;
            var all = document.getElementsByTagName('*');
            for (var bi = 0; bi < all.length; bi++) {
                var el = all[bi];
                if (el.tagName === 'FORM' && el.id && el.id.indexOf('subject_form_') === 0) {
                    current = {};
                    buckets.push(current);
                } else if (el.tagName === 'INPUT' && current) {
                    var nm = el.getAttribute('name');
                    if (nm) current[nm] = el.value;
                }
            }
            var rows = document.querySelectorAll('tr.clickable-row');
            var b = buckets[idx] || {};
            var subcode = b['subcode'] || '';
            var subjectId = b['subject_id'] || '';
            var fullname = b['sub_fullname'] || '';
            var csrfV = b['_csrf'] || '';
            var sidV = b['student_id'] || '';
            var cidV = b['class_id'] || '';
            var cnameV = b['classname'] || '';
            var acadV = b['acad_year'] || '';
            if (!csrfV) {
                var csrf = document.querySelector('input[name="_csrf"]');
                if (csrf) csrfV = csrf.value;
            }
            if (!sidV || !cidV) {
                try {
                    var ctx = JSON.parse(sessionStorage.getItem('subjectsCtx') || '{}');
                    if (!sidV && ctx.student_id) sidV = ctx.student_id;
                    if (!cidV && ctx.class_id) cidV = ctx.class_id;
                    if (!cnameV && ctx.classname) cnameV = ctx.classname;
                    if (!acadV && ctx.acad_year) acadV = ctx.acad_year;
                    if (!csrfV && ctx._csrf) csrfV = ctx._csrf;
                } catch (eC) {}
            }
            if ((!subcode || !fullname) && rows[idx]) {
                var tds = rows[idx].querySelectorAll('td');
                if (!subcode && tds.length >= 1) subcode = (tds[0].textContent || '').trim();
                if (!fullname && tds.length >= 2) fullname = (tds[1].textContent || '').trim();
            }
            if (!subcode && rows[idx]) { subcode = rowCode(rows[idx]); }
            return {
                _csrf: csrfV,
                subject_id: subjectId,
                subcode: subcode,
                sub_fullname: fullname,
                student_id: sidV,
                class_id: cidV,
                classname: cnameV,
                acad_year: acadV
            };
        } catch (e) { return null; }
    }

    function submitPayload(p) {
        try {
            var f = document.createElement('form');
            f.method = 'post';
            f.action = 'studentcourseatt.php';
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

        // 1. Try finding the associated form by onclick
        try {
            var onclick = row.getAttribute('onclick') || '';
            var m = onclick.match(/getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (m) {
                var form = document.getElementById(m[1]);
                if (form) {
                    var sib = form.nextElementSibling;
                    while (sib && sib.tagName === 'INPUT') {
                        var nxt = sib.nextElementSibling;
                        form.appendChild(sib);
                        sib = nxt;
                    }
                    try { form.removeAttribute('target'); form.target = '_self'; } catch (e0) {}
                    try {
                        if (form.requestSubmit) form.requestSubmit();
                        else HTMLFormElement.prototype.submit.call(form);
                        return true;
                    } catch (e1) {
                        HTMLFormElement.prototype.submit.call(form);
                        return true;
                    }
                }
            }
        } catch (eForm) {}

        // 2. Try synthesized payload form
        var p = payloadForIndex(idx);
        if (p && (p.subject_id || p.subcode)) {
            if (submitPayload(p)) return true;
        }

        // 3. Fallback: native row click
        try { row.click(); return true; } catch (e) { return false; }
    }

    // Master Scraper Object
    window.JNTUAScraper = {
        version: "2026.10.18.1",
        portalBaseUrl: "https://jntuaceastudents.classattendance.in",
        portalHost: "jntuaceastudents.classattendance.in",

        injectHumanNote: function() {
            var existing = document.getElementById('human-verify-note');
            if (location.pathname.indexOf('studenthome.php') !== -1 ||
                location.pathname.indexOf('studentsubjects.php') !== -1 ||
                location.pathname.indexOf('studentcourseatt.php') !== -1 ||
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

        beginScrapeSession: function() {
            try {
                sessionStorage.removeItem('fetchedSubjectCodes');
                sessionStorage.setItem('scrapeActive', '1');
            } catch (e) {}
        },

        resetScrapeSession: function() {
            try {
                sessionStorage.removeItem('fetchedSubjectCodes');
                sessionStorage.removeItem('scrapeActive');
            } catch (e) {}
        },

        endScrapeSession: function() {
            try {
                sessionStorage.removeItem('scrapeActive');
            } catch (e) {}
        },

        autoSubmitFirstSemester: function() {
            this.beginScrapeSession();

            var attempts = 0;
            var interval = setInterval(function() {
                attempts++;
                var firstForm = document.querySelector('.card.bg-light.text-primary form[action="studentsubjects.php"]') ||
                                document.querySelector('form[action="studentsubjects.php"]');
                if (firstForm) {
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

                    var className = '';
                    var classInput = firstForm.querySelector('input[name="classname"]');
                    if (classInput) {
                        className = classInput.value.trim();
                    }

                    try {
                        var homeInputs = {};
                        var allInps = firstForm.querySelectorAll('input');
                        allInps.forEach(function(inp) {
                            if (inp.name) homeInputs[inp.name] = inp.value;
                        });
                        sessionStorage.setItem('homeFormInputs', JSON.stringify(homeInputs));
                    } catch (eInputs) {}

                    console.log('[AttendanceScraper] autoSubmitFirstSemester: student=' + sname + ' (' + admissionNo + '), class=' + className);

                    post('STUDENT_INFO', {
                        data: { sname: sname, admissionNo: admissionNo, className: className }
                    });

                    try {
                        firstForm.submit();
                    } catch (e) {
                        console.error('[AttendanceScraper] Home form submit failed: ' + (e && e.message ? e.message : String(e)));
                        post('SCRAPE_ERROR', {
                            message: 'Home form submit failed: ' + (e && e.message ? e.message : String(e))
                        });
                    }
                } else if (attempts >= 20) {
                    clearInterval(interval);
                    console.error('[AttendanceScraper] Home form not detected after 4s');
                }
            }, 200);
        },

        selectSubjectByIndex: function(targetIndex) {
            this.beginScrapeSession();

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
                    console.log('[AttendanceScraper] Found ' + rows.length + ' subjects, targetIndex=' + targetIndex + ', alreadyFetched=' + fetchedCodes.length);

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
                        console.log('[AttendanceScraper] Skipping already fetched subject ' + rowCodes[idx] + ' at index ' + idx);
                        post('SUBJECT_SKIPPED', {
                            subcode: rowCodes[idx],
                            index: idx
                        });
                        idx++;
                    }

                    if (idx < rows.length) {
                        console.log('[AttendanceScraper] Submitting subject ' + rowCodes[idx] + ' at index ' + idx);
                        submitRowByIndex(idx);

                        (function(retryIdx) {
                            setTimeout(function() {
                                try {
                                    var stillRows = document.querySelectorAll('tr.clickable-row');
                                    if (stillRows.length > 0 && stillRows[retryIdx] &&
                                        location.href.indexOf('studentsubjects.php') !== -1) {
                                        console.warn('[AttendanceScraper] Retry onclick for index ' + retryIdx);
                                        try { stillRows[retryIdx].click(); } catch (eR) {}
                                    }
                                } catch (eR2) {}
                            }, 3500);
                        })(idx);
                    } else {
                        console.log('[AttendanceScraper] All subjects fetched! Posting SCRAPING_COMPLETE');
                        post('SCRAPING_COMPLETE');
                    }
                } else if (attempts >= 20) {
                    clearInterval(interval);
                    console.error('[AttendanceScraper] No subject rows found after 4s');
                    post('SCRAPE_IDLE', {
                        reason: 'No subject rows after 4s — likely off-script navigation.'
                    });
                }
            }, 200);
        },

        parseDetailedAttendanceAndGoHome: function() {

            var attempts = 0;
            var interval = setInterval(function() {
                attempts++;
                var headers = document.querySelectorAll('.card-header');
                var table = findAttendanceTable();

                if (headers.length < 2 || !table) {
                    if (attempts >= 25) {
                        clearInterval(interval);
                        console.error('[AttendanceScraper] Attendance page not detected after 5s (headers=' + headers.length + ', table=' + (!!table) + ')');
                        post('SCRAPE_IDLE', {
                            reason: 'Attendance page not detected after 5s (headers=' + headers.length + ', table=' + (!!table) + ').'
                        });
                    }
                    return;
                }
                clearInterval(interval);
                console.log('[AttendanceScraper] Attendance table detected. Parsing rows...');

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

                console.log('[AttendanceScraper] Parsed ' + parsed.subCode + ' (' + parsed.subjectName + '): ' + percentage + '% (' + present + '/' + total + ' classes). Posting ATTENDANCE_ITEM...');
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

                setTimeout(goBackToSubjects, 300);
            }, 200);
        },

        handlePageLoad: function(url, targetIndex, isLoggedIn, isScrapingActive) {
            var cleanUrl = (url || window.location.href).split('#')[0];
            console.log('[AttendanceScraper] handlePageLoad: url=' + cleanUrl + ', targetIndex=' + targetIndex + ', isLoggedIn=' + isLoggedIn);
            if (!isLoggedIn && cleanUrl.indexOf('student') === -1) {
                this.injectHumanNote();
                return;
            }

            // studenthome.php: student just logged in. Initialize scrape session and auto-submit first semester
            if (cleanUrl.indexOf('studenthome.php') !== -1 || document.querySelector('.card.bg-light.text-primary form[action="studentsubjects.php"]') || document.querySelector('form[action="studentsubjects.php"]')) {
                this.autoSubmitFirstSemester();
                return;
            }

            if (cleanUrl.indexOf('studentsubjects.php') !== -1 || document.querySelector('tr.clickable-row')) {
                this.selectSubjectByIndex(targetIndex);
            } else if (cleanUrl.indexOf('studentsubatt.php') !== -1 || cleanUrl.indexOf('studentcourseatt.php') !== -1 || findAttendanceTable()) {
                this.parseDetailedAttendanceAndGoHome();
            }
        }
    };
})();
true;
