/* Shared guard + post helper are interpolated into every script. */
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (data: string) => void;
    };
  }
}

export interface StudentInfo {
  sname: string;
  admissionNo: string;
  className: string;
}

export interface AttendanceRecord {
  date: string;
  time: string;
  status: "Present" | "Absent" | "Unknown";
}

export interface SubjectAttendanceData {
  subjectName: string;
  subCode?: string;
  present: number;
  absent: number;
  total: number;
  percentage: string;
  records: AttendanceRecord[];
}

const SCRAPE_GUARD = `
  function isScrapeActive() {
    try { return sessionStorage.getItem('scrapeActive') === '1'; }
    catch (e) { return false; }
  }
  if (!isScrapeActive()) { return; }
`;

const POST_HELPER = `
  function post(type, extra) {
    const rn = window.ReactNativeWebView;
    if (rn) rn.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
  }
`;

/** Call once from RN BEFORE the first injection. Starts a fresh run. */
export const beginScrapeSessionScript = `
  (function() {
    try {
      sessionStorage.removeItem('fetchedSubjectCodes');
      sessionStorage.setItem('scrapeActive', '1');
    } catch (e) {}
  })();
  true;
`;

/** Call from RN when the user explicitly aborts or wants a fresh start. */
export const resetScrapeSessionScript = `
  (function() {
    try {
      sessionStorage.removeItem('fetchedSubjectCodes');
      sessionStorage.removeItem('scrapeActive');
    } catch (e) {}
  })();
  true;
`;

export const autoSubmitFirstSemesterScript = `
  (function() {
    ${SCRAPE_GUARD}
    ${POST_HELPER}

    let admissionNo = '';
    let sname = '';

    document.querySelectorAll('.list-group-item').forEach(function(item) {
      const strong = item.querySelector('strong');
      if (!strong) return;
      const label = strong.textContent || '';
      const value = ((strong.nextSibling && strong.nextSibling.textContent) || '').trim();
      if (/Username|Roll No/i.test(label)) admissionNo = value;
      else if (/Full Name/i.test(label)) sname = value;
    });

    const firstForm = document.querySelector('.card.bg-light.text-primary form[action="studentsubjects.php"]');

    // Page-type guard: not on home → user-initiated nav. Do nothing.
    if (!firstForm) { return; }

    let className = '';
    if (firstForm) {
      const classInput = firstForm.querySelector('input[name="classname"]');
      if (classInput) {
        className = classInput.value.trim();
      }
    }

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'STUDENT_INFO',
        data: { sname: sname, admissionNo: admissionNo, className: className }
      }));
    }

    try {
      firstForm.submit();
    } catch (e) {
      post('SCRAPE_ERROR', {
        message: 'Home form submit failed: ' + (e && e.message ? e.message : String(e))
      });
    }
  })();
  true;
`;

export const selectSubjectByIndexScript = (targetIndex: number): string => `
  (function() {
    ${SCRAPE_GUARD}
    ${POST_HELPER}

    function readFetched() {
      try {
        const raw = sessionStorage.getItem('fetchedSubjectCodes') || '[]';
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function submitRow(row) {
      const onclick = row.getAttribute('onclick') || '';
      const m = onclick.match(/getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (m) {
        const form = document.getElementById(m[1]);
        if (form) {
          // Foster-parented hidden inputs: move them into the form.
          let sib = form.nextElementSibling;
          while (sib && sib.tagName === 'INPUT') {
            const nxt = sib.nextElementSibling;
            form.appendChild(sib);
            sib = nxt;
          }
          try { form.removeAttribute('target'); form.target = '_self'; } catch (e0) {}
          // requestSubmit runs handlers; prototype.submit is immune to
          // shadowing by <input name="submit">.
          try {
            if (typeof form.requestSubmit === 'function') {
              const btn = form.querySelector('input[type="submit"], button[type="submit"]');
              if (btn) form.requestSubmit(btn);
              else form.requestSubmit();
            } else {
              HTMLFormElement.prototype.submit.call(form);
            }
          } catch (e1) {
            HTMLFormElement.prototype.submit.call(form);
          }
          // Watchdog: form.submit() can silently no-op. Fall back to click.
          setTimeout(function() {
            if (location.pathname.indexOf('subatt') === -1
                && location.pathname.indexOf('courseatt') === -1) {
              try { row.click(); } catch (e2) {}
            }
          }, 3000);
          return;
        }
      }
      // Fallback — page's own onclick handler submits.
      row.click();
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const rows = document.querySelectorAll('tr.clickable-row');
      
      if (rows.length > 0) {
        clearInterval(interval);
        
        const rn = window.ReactNativeWebView;
        if (rn) {
          rn.postMessage(JSON.stringify({
            type: 'SUBJECT_COUNT',
            count: rows.length
          }));
        }

        // State Check: Retrieve stored list of fetched subject codes
        const fetchedCodes = readFetched();

        if (${targetIndex} < rows.length) {
          const targetRow = rows[${targetIndex}];
          const subCodeCell = targetRow.querySelector('td:first-child');
          const subCode = subCodeCell ? subCodeCell.textContent.trim() : '';

          // If subject was already fetched, notify React Native to skip it
          if (subCode && fetchedCodes.includes(subCode)) {
            if (rn) {
              rn.postMessage(JSON.stringify({
                type: 'SUBJECT_SKIPPED',
                subcode: subCode,
                index: ${targetIndex}
              }));
            }
          } else {
            submitRow(targetRow);
          }
        } else if (rn) {
          rn.postMessage(JSON.stringify({
            type: 'SCRAPING_COMPLETE'
          }));
        }
      } else if (attempts >= 20) {
        clearInterval(interval);
        // Off-script navigation (user pressed back): soft signal, not error.
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SCRAPE_IDLE',
            reason: 'No subject rows after 4s — likely off-script navigation.'
          }));
        }
      }
    }, 200);
  })();
  true;
`;

export const parseDetailedAttendanceAndGoHomeScript = `
  (function() {
    ${SCRAPE_GUARD}
    ${POST_HELPER}

    function parseHeader(el) {
      if (!el) return { subCode: '', subjectName: '' };
      let text = el.innerText || '';
      if (!text) {
        const tmp = document.createElement('div');
        tmp.innerHTML = el.innerHTML || '';
        text = tmp.textContent || '';
      }
      const parts = text.split(/\n+/).map(function(s) { return s.trim(); })
                        .filter(Boolean);
      if (parts.length >= 2) {
        return { subCode: parts[0], subjectName: parts.slice(1).join(' ') };
      }
      const m = text.match(/^\s*([A-Za-z0-9]+)\s+(.+)$/);
      if (m) return { subCode: m[1], subjectName: m[2] };
      return { subCode: '', subjectName: parts[0] || '' };
    }

    function findAttendanceTable() {
      const tables = document.querySelectorAll('table');
      for (let i = 0; i < tables.length; i++) {
        const head = tables[i].querySelector('thead');
        if (head && /attendance/i.test(head.textContent || '')) return tables[i];
      }
      return null;
    }

    function goBackToSubjects() {
      // history.back() proved unreliable (portal pushStates a duplicate entry
      // per page; POST-result pages do not restore in this WebView, so backs
      // land on studenthome, never subjects). Deterministic loop instead:
      // studenthome auto-submits the class form back to the subjects list,
      // then RN injects the next index (currentIndex already advanced).
      try {
        window.location.replace('studenthome.php');
      } catch (e) {}
    }

    let attempts = 0;
    const interval = setInterval(function() {
      attempts++;
      const headers = document.querySelectorAll('.card-header');
      const table = findAttendanceTable();

      if (headers.length < 2 || !table) {
        if (attempts >= 25) {
          clearInterval(interval);
          // Page never rendered the table but user may have navigated away.
          // Emit idle rather than error.
          post('SCRAPE_IDLE', {
            reason: 'Attendance page not detected after 5s '
                    + '(headers=' + headers.length + ', table=' + (!!table) + ').'
          });
        }
        return;
      }
      clearInterval(interval);

      // Pick the subject header: the card-header with a <br> ("23A70501 <br>
      // Deep Learning"). The class header (headers[0]) carries year digits
      // (2026-2027), so a digit test misfires and every item collapses to one
      // bogus subCode the reducer dedups → index stuck (infinite re-scrape).
      function isCodeLike(s) {
        if (!s || s.length < 3 || s.length > 15) return false;
        for (let ci = 0; ci < s.length; ci++) {
          const c = s.charCodeAt(ci);
          const ok = (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
          if (!ok) return false;
        }
        return true;
      }
      let subjectHeader = null;
      for (let i = 0; i < headers.length; i++) {
        const el = headers[i];
        const html = el.innerHTML || '';
        if (html.indexOf('<br') !== -1 || html.indexOf('<BR') !== -1) {
          const cand = parseHeader(el);
          if (cand.subCode && isCodeLike(cand.subCode)) { subjectHeader = el; break; }
          if (!subjectHeader) subjectHeader = el;
        }
      }
      if (!subjectHeader) subjectHeader = headers[1] || headers[0];

      const parsed = parseHeader(subjectHeader);
      const bodyRows = table.querySelectorAll('tbody tr');
      let present = 0, absent = 0;
      const records = [];

      for (let i = 0; i < bodyRows.length; i++) {
        const cells = bodyRows[i].querySelectorAll('td');
        if (cells.length !== 3) continue;
        const date = (cells[0].textContent || '').trim();
        const time = (cells[1].textContent || '').trim();
        const badge = cells[2].querySelector('span.badge');
        const raw = badge ? (badge.textContent || '').trim() : 'Unknown';
        let status = 'Unknown';
        if (/present/i.test(raw)) status = 'Present';
        else if (/absent/i.test(raw)) status = 'Absent';
        if (status === 'Present') present++;
        else if (status === 'Absent') absent++;
        records.push({ date: date, time: time, status: status });
      }

      const total = present + absent;
      const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : '0.00';

      // Persist for resume.
      if (parsed.subCode) {
        try {
          const raw = sessionStorage.getItem('fetchedSubjectCodes') || '[]';
          const p = JSON.parse(raw);
          const list = Array.isArray(p) ? p : [];
          if (list.indexOf(parsed.subCode) === -1) list.push(parsed.subCode);
          sessionStorage.setItem('fetchedSubjectCodes', JSON.stringify(list));
        } catch (e) {
          try {
            sessionStorage.setItem('fetchedSubjectCodes', JSON.stringify([parsed.subCode]));
          } catch (ignored) {}
        }
      }

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
  })();
  true;
`;

/** Call once from RN after SCRAPING_COMPLETE / on explicit user abort,
 *  to disable further script execution until the next begin. */
export const endScrapeSessionScript = `
  (function() {
    try { sessionStorage.removeItem('scrapeActive'); } catch (e) {}
  })();
  true;
`;