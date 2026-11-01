export interface StudentInfo {
  name: string;
  admissionNo: string;
  className: string;
}

export interface AttendanceRecord {
  date: string;
  time: string;
  status: 'Present' | 'Absent' | 'Unknown';
}

export interface SubjectAttendanceData {
  subjectName: string;
  present: number;
  absent: number;
  total: number;
  percentage: string;
  records: AttendanceRecord[];
}

// Keep injected code as literal source: Hermes does not retain function source
// for Function.toString(). All dependencies must live inside this script.
const portalScript = String.raw`function scrapePortal(stage, index) {
  if (!stage) {
    const page = window.location.pathname.split('/').pop().toLowerCase();
    stage = page === 'studenthome.php' ? 'home'
      : page === 'studentsubjects.php' ? 'subjects'
      : /^(studentsubjectatt|studentsubatt|studentcourseatt)\.php$/.test(page) ? 'attendance' : null;
  }
  if (!stage) return;
  if (window.attendanceScraperStarted) return;
  window.attendanceScraperStarted = true;

  const post = (payload) => {
    window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
  };
  post({ type: 'SCRAPING_STARTED', stage });
  const text = (element) =>
    (element instanceof HTMLElement ? element.innerText : element?.textContent || '').trim();
  const targetsPage = (element, pages) => {
    const target = element.getAttribute('action') || element.getAttribute('href') || '';
    return pages.test(new URL(target, document.baseURI).pathname);
  };
  const diagnose = (phase) => post({ type: 'SCRAPING_DIAGNOSTIC', data: {
    phase, stage, page: window.location.pathname, readyState: document.readyState,
    rows: document.querySelectorAll('tr').length,
    clickableRows: document.querySelectorAll('tr.clickable-row').length,
    forms: Array.from(document.forms).slice(0, 12).map(form => ({
      action: new URL(form.getAttribute('action') || '', document.baseURI).pathname,
      method: form.method,
      fields: Array.from(form.elements).map(control => control.name).filter(Boolean),
    })),
    unownedFields: Array.from(document.querySelectorAll('input')).filter(input => !input.form).map(input => input.name).filter(Boolean),
    headers: Array.from(document.querySelectorAll('th')).slice(0, 20).map(text),
  } });
  const submitForm = (form) => {
    let sibling = form.nextElementSibling;
    while (sibling?.matches('input, select, textarea')) {
      const next = sibling.nextElementSibling;
      form.appendChild(sibling);
      sibling = next;
    }
    // Table markup can leave inputs beside an empty form after HTML parsing.
    // Repair only controls from its row, never another subject's hidden fields.
    const row = form.closest('tr');
    row?.querySelectorAll('input, select, textarea').forEach(control => {
      if (!control.closest('form')) form.appendChild(control);
    });
    form.removeAttribute('target');
    diagnose('submitting-form');
    HTMLFormElement.prototype.submit.call(form);
  };

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    try {
      if (attempts === 1 || attempts === 50) diagnose('reading-page');
      if (stage === 'home') {
        const form = Array.from(document.forms).find(candidate =>
          targetsPage(candidate, /\/studentsubjects\.php$/i));
        const link = Array.from(document.querySelectorAll('a[href]')).find(candidate =>
          targetsPage(candidate, /\/studentsubjects\.php$/i));
        if (form || link) {
          clearInterval(interval);
          let name = '';
          let admissionNo = '';
          document.querySelectorAll('.list-group-item, tr').forEach(item => {
            const value = text(item).replace(/\s+/g, ' ');
            const admission = value.match(/^(?:Username|Roll\s*(?:No\.?|Number)|Admission\s*(?:No\.?|Number))(?:\s*[:：]\s*|\s+)(.+)$/i);
            const studentName = value.match(/^(?:(?:Student|Full)\s+)?Name(?:\s*[:：]\s*|\s+)(.+)$/i);
            if (admission) admissionNo = admission[1].trim();
            if (studentName) name = studentName[1].trim();
            else {
              const label = item.querySelector('strong, b, label, th');
              if (label && /^(?:(?:Student|Full)\s+)?Name\s*[:：]?$/i.test(text(label))) {
                name = text(item).slice(text(label).length).replace(/^\s*[:：]?\s*/, '').replace(/\s+/g, ' ').trim();
              }
            }
          });
          const classInput = form?.querySelector('input[name="classname"]');
          post({ type: 'STUDENT_INFO', data: { name, admissionNo, className: classInput?.value.trim() || '' } });
          if (form) submitForm(form);
          else if (link) {
            link.removeAttribute('target');
            link.click();
          }
          return;
        }
      } else if (stage === 'subjects') {
        const pages = /\/(?:studentsubjectatt|studentsubatt|studentcourseatt)\.php$/i;
        const rows = Array.from(document.querySelectorAll('tr')).filter(row =>
          row.matches('.clickable-row') ||
          Array.from(row.querySelectorAll('form, a[href]')).some(element => targetsPage(element, pages)) ||
          /(?:studentsubjectatt|studentsubatt|studentcourseatt)\.php|getElementById/i.test(row.getAttribute('onclick') || ''));
        if (rows.length > 0) {
          clearInterval(interval);
          post({ type: 'SUBJECT_COUNT', count: rows.length });
          if (index >= rows.length) {
            post({ type: 'SCRAPING_COMPLETE' });
            return;
          }
          const row = rows[index];
          const match = (row.getAttribute('onclick') || '').match(/getElementById\s*\(\s*['"]([^'"]+)['"]/);
          const form = (match ? document.getElementById(match[1]) : null) || row.querySelector('form');
          if (form instanceof HTMLFormElement) submitForm(form);
          else {
            const link = Array.from(row.querySelectorAll('a[href]')).find(anchor => targetsPage(anchor, pages));
            if (link) {
              link.removeAttribute('target');
              link.click();
            } else {
              diagnose('clicking-subject-row');
              row.click();
            }
          }
          return;
        }
      } else {
        // Match column labels instead of Bootstrap classes or fixed positions.
        for (const table of Array.from(document.querySelectorAll('table'))) {
          const rows = Array.from(table.rows);
          const headerIndex = rows.findIndex(row => {
            const labels = Array.from(row.cells).map(text);
            return labels.some(label => /date/i.test(label)) &&
              labels.some(label => /attendance|status/i.test(label));
          });
          if (headerIndex < 0) continue;
          const labels = Array.from(rows[headerIndex].cells).map(text);
          const dateIndex = labels.findIndex(label => /date/i.test(label));
          const timeIndex = labels.findIndex(label => /time|period|hour/i.test(label));
          const statusIndex = labels.findIndex(label => /attendance|status/i.test(label));
          const records = [];
          let invalidStatus = false;
          rows.slice(headerIndex + 1).forEach(row => {
            const date = text(row.cells[dateIndex]);
            if (!/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/.test(date)) return;
            const raw = text(row.cells[statusIndex]);
            const status = /^(?:present|p)\b/i.test(raw) ? 'Present'
              : /^(?:absent|a)\b/i.test(raw) ? 'Absent' : 'Unknown';
            if (status === 'Unknown') invalidStatus = true;
            records.push({ date, time: timeIndex >= 0 ? text(row.cells[timeIndex]) : '', status });
          });
          const empty = /no\s+(?:attendance\s+)?(?:records?|data)(?:\s+(?:available|found))?/i.test(text(table));
          if (records.length === 0 && !empty) continue;
          clearInterval(interval);
          if (invalidStatus) {
            post({ type: 'SCRAPING_ERROR', message: 'The portal returned an unrecognized attendance status. Please open the portal and try again.' });
            return;
          }
          const headers = Array.from(document.querySelectorAll('.card-header'));
          const header = headers.find(element => /<br\s*\/?\s*>/i.test(element.innerHTML)) || headers[1] || headers[0];
          const parts = text(header).split('\n').map(part => part.trim()).filter(Boolean);
          const subjectName = parts.length >= 2 ? parts.slice(1).join(' ') : parts[0] || 'Subject ' + (index + 1);
          const present = records.filter(record => record.status === 'Present').length;
          const absent = records.length - present;
          const total = records.length;
          post({ type: 'ATTENDANCE_ITEM', index, data: {
            subjectName, present, absent, total,
            percentage: total > 0 ? ((present / total) * 100).toFixed(2) : '0.00', records,
          } });
          setTimeout(() => window.location.replace('studenthome.php'), 300);
          return;
        }
      }
      if (attempts >= 50) {
        clearInterval(interval);
        const detail = stage === 'home' ? 'semester form' : stage === 'subjects' ? 'subject list' : 'attendance table';
        post({ type: 'SCRAPING_ERROR', message: "Could not read the portal's " + detail + '. Open the portal to check your semester selection, then try again.' });
      }
    } catch {
      clearInterval(interval);
      post({ type: 'SCRAPING_ERROR', message: 'Could not read the attendance portal. Please open the portal and try again.' });
    }
  }, 200);
}`;

export const autoSubmitFirstSemesterScript = `(${portalScript})('home', 0); true;`;

export const selectSubjectByIndexScript = (targetIndex: number): string =>
  `(${portalScript})('subjects', ${targetIndex}); true;`;

export const parseDetailedAttendanceAndGoHomeScript = (targetIndex: number): string =>
  `(${portalScript})('attendance', ${targetIndex}); true;`;

export const getPortalPageScript = (targetIndex: number): string =>
  `(${portalScript})(null, ${targetIndex}); true;`;
