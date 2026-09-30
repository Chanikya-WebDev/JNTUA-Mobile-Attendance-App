declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (data: string) => void;
    };
  }
}

export interface StudentInfo {
  name: string;
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

export const autoSubmitFirstSemesterScript = `
  (function() {
    // Clear previously stored fetched subjects on fresh flow start
    sessionStorage.removeItem('fetchedSubjectCodes');

    let admissionNo = '';
    let name = '';

    const listItems = Array.from(document.querySelectorAll('.list-group-item'));
    listItems.forEach(item => {
      const text = item.textContent || '';
      if (text.includes('Username:')) {
        admissionNo = text.replace('Username:', '').trim();
      }
      if (text.includes('Name:')) {
        name = text.replace('Name:', '').trim();
      }
    });

    const firstForm = document.querySelector('form[action="studentsubjects.php"]');
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
        data: { name, admissionNo, className }
      }));
    }

    if (firstForm) {
      firstForm.submit();
    }
  })();
  true;
`;

export const selectSubjectByIndexScript = (targetIndex: number): string => `
  (function() {
    function safeParseCodes() {
      try {
        const raw = sessionStorage.getItem('fetchedSubjectCodes') || '[]';
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
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
        const fetchedCodes = safeParseCodes();

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
            targetRow.click();
          }
        } else if (rn) {
          rn.postMessage(JSON.stringify({
            type: 'SCRAPING_COMPLETE'
          }));
        }
      } else if (attempts >= 20) {
        clearInterval(interval);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SCRAPE_ERROR',
            message: 'Timed out waiting for subject list to load.'
          }));
        }
      }
    }, 200);
  })();
  true;
`;

export const parseDetailedAttendanceAndGoHomeScript = `
  (function() {
    let attempts = 0;

    // Retry/Poll mechanism to ensure DOM elements and dynamic tables are loaded
    const checkInterval = setInterval(() => {
      attempts++;
      const cardHeaders = document.querySelectorAll('.card-header');
      const tableRows = document.querySelectorAll('table.table-bordered.table-striped tbody tr');
      
      // Ensure page headers and attendance records are in DOM
      if (cardHeaders.length >= 2 && tableRows.length > 0) {
        clearInterval(checkInterval);

        const subjectHeader = cardHeaders[1];
        let subjectName = '';
        let subCode = '';

        if (subjectHeader) {
          const text = subjectHeader.innerText.trim();
          const parts = text.split('\\n').map(p => p.trim()).filter(Boolean);
          if (parts.length >= 2) {
            subCode = parts[0];
            subjectName = parts[1];
          } else {
            subjectName = text;
          }
        }

        // Track completed subject in sessionStorage to avoid re-fetching
        if (subCode) {
          try {
            const rawCodes = sessionStorage.getItem('fetchedSubjectCodes') || '[]';
            const parsedCodes = JSON.parse(rawCodes);
            const fetchedCodes = Array.isArray(parsedCodes) ? parsedCodes : [];
            if (!fetchedCodes.includes(subCode)) {
              fetchedCodes.push(subCode);
              sessionStorage.setItem('fetchedSubjectCodes', JSON.stringify(fetchedCodes));
            }
          } catch (e) {
            try { sessionStorage.setItem('fetchedSubjectCodes', JSON.stringify([subCode])); } catch (ignored) {}
          }
        }

        const records = [];
        let presentCount = 0;
        let absentCount = 0;

        tableRows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length === 3) {
            const date = cells[0].textContent.trim();
            const time = cells[1].textContent.trim();
            const badge = cells[2].querySelector('span.badge');
            const status = badge ? badge.textContent.trim() : 'Unknown';

            if (status === 'Present') presentCount++;
            if (status === 'Absent') absentCount++;

            records.push({ date, time, status });
          }
        });

        const total = presentCount + absentCount;
        const percentage = total > 0 ? ((presentCount / total) * 100).toFixed(2) : '0.00';

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ATTENDANCE_ITEM',
            data: {
              subCode,
              subjectName,
              present: presentCount,
              absent: absentCount,
              total,
              percentage,
              records
            }
          }));
        }

        // Navigate back home safely
        setTimeout(() => {
          const homeBtn = document.querySelector('a[href="studenthome.php"]');
          if (homeBtn) {
            homeBtn.click();
          }
        }, 300);

      } else if (attempts >= 25) {
        clearInterval(checkInterval);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SCRAPE_ERROR',
            message: 'Timed out waiting for attendance records table to load.'
          }));
        }
      }
    }, 200);
  })();
  true;
`;