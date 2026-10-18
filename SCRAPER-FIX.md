# Scraper Fix — Before → After

The attendance scrape found the subject count but stalled (or looped on one
subject) and never reached the dashboard. Root causes were found in the live
portal HTML (`studentcourseatt.php` action, foster-parented hidden inputs,
`<br>` subject header, `pushState` duplicate history entries) and confirmed
with bridge trace logs over a full 8-subject run.

Files changed: `utils/automationScripts.ts`, `App.tsx`, `README.md`
(`StudentInfo.name` → `sname` alignment with the rest of the tree).

---

## 1. Attendance page never parsed — wrong URL match

### Before (`App.tsx`)

```ts
} else if (url.includes("studentsubatt.php")) {
  webViewRef.current?.injectJavaScript(parseDetailedAttendanceAndGoHomeScript);
}
```

The subject form posts to `studentcourseatt.php`
(`action=studentcourseatt.php method=post inputs=8`). The condition never
matched, so the attendance page loaded with no script injected — no parse, no
`ATTENDANCE_ITEM`, scrape stalled after `form.submit()` returned.

### After (`App.tsx`)

```ts
} else if (url.includes("studentsubatt.php") || url.includes("studentcourseatt.php")) {
  webViewRef.current?.injectJavaScript(parseDetailedAttendanceAndGoHomeScript);
}
```

Both the current endpoint and the legacy one trigger the parser.

---

## 2. Empty POST — hidden inputs foster-parented outside the form

### Before (`selectSubjectByIndexScript`)

```js
} else {
  targetRow.click();
}
```

The portal renders each subject form as an empty element with its hidden
inputs as *siblings* after it:

```html
<form id="subject_form_2136" action="studentcourseatt.php" method="post" style="display: none;"></form>
<input type="hidden" name="subject_id" value="2136">
<input type="hidden" name="subcode" value="23A70501">
...
```

A bare submit of the empty form posts without the subject identity fields.

### After — `submitRow(row)` helper

Parses the row `onclick` for the form id, moves sibling `INPUT`s into the
form, strips `target` (`_self` — a `_blank` target is swallowed since
`setSupportMultipleWindows` is `false`), then submits via `requestSubmit()`
with `HTMLFormElement.prototype.submit` fallback (immune to shadowing by
`<input name="submit">`). A 3s watchdog falls back to `row.click()` if
navigation never happened. Falls through to `row.click()` when no form id is
found.

---

## 3. Infinite re-scrape — wrong subject header picked

### Before — attendance parser

```js
const subjectHeader = cardHeaders[1];
```

combined with the digit-test variant:

```js
if (/\d/.test(txt) && (/<br/i.test(el.innerHTML) || txt.length > 12))
```

`headers[0]` (the class card) contains `2026-2027` — has digits, length > 12
— so it matched first. Every subject parsed as
`subCode = "B.Tech (CSE) - IV Yr - I Sem"`. The reducer dedups by `subCode`:

```ts
if (subCode && state.fetchedSubCodes.includes(subCode)) return state;
```

so `currentIndex` never advanced — the trace showed `targetIndex=1`,
`fetched=1`, the same 15-row parse, forever.

### After — `<br>` + code-shape picker

Only the subject header (`23A70501 <br> Deep Learning`) contains `<br>`; the
class header never matches. The first line is then validated as code-shaped
(`isCodeLike`: 3-15 alphanumerics). `parseHeader` also gained an `innerHTML`
fallback and a regex fallback for single-line headers, and the table is
located by `<thead>` text (`/attendance/i`) instead of by position — the
Lecture Diary table on the same page no longer pollutes row counts.

---

## 4. Return navigation skipped the subjects list

### Before — attendance parser

```js
// Navigate back home safely
setTimeout(() => {
  const homeBtn = document.querySelector('a[href="studenthome.php"]');
  if (homeBtn) {
    homeBtn.click();
  }
}, 300);
```

A later iteration tried `history.back()`, but the portal `pushState`s a
duplicate entry per page and POST-result pages do not restore in this
WebView — backs landed on `studenthome` (never the subjects list), or needed
two backs, routing every subject through home unpredictably.

### After — deterministic `location.replace` loop

```js
function goBackToSubjects() {
  // studenthome auto-submits the class form back to the subjects list,
  // then RN injects the next index (currentIndex already advanced).
  try {
    window.location.replace('studenthome.php');
  } catch (e) {}
}
...
setTimeout(goBackToSubjects, 300);
```

`replace` leaves no history stack to unwind: attendance → studenthome (home
script auto-submits the class form) → subjects list → RN injects the next
`currentIndex`. The per-URL dedup key in `App.tsx` also strips `#`
fragments so same-document navigations cannot alias different pages:

```ts
// Before
const injectKey = `${url}|${snapshot.isLoggedIn}|${snapshot.currentIndex}`;
// After
const injectKey = `${url.split("#")[0] ?? url}|${snapshot.isLoggedIn}|${snapshot.currentIndex}`;
```

---

## 5. Off-script navigation reported as a hard error

### Before

Subjects timeout → `SCRAPE_ERROR` ("Timed out waiting for subject list to
load."); attendance timeout → `SCRAPE_ERROR` ("Timed out waiting for
attendance records table to load.") — both surface the structure-error
overlay even when the user simply pressed the device back button onto an
off-script page.

### After

Both timeouts emit the soft signal instead (`SCRAPE_IDLE` with a reason),
which `App.tsx` handles as a no-op — no overlay, no stall-timer corruption
(every bridge message still refreshes `lastActivityRef`).

---

## 6. Session scoping — scripts self-identify their page

### Before

No guard: any injected script ran on whatever page was loaded. Pressing back
onto an off-script page could fire `SCRAPE_ERROR` mid-run.

### After

A `SCRAPE_GUARD` (checks `sessionStorage.scrapeActive`) plus a `post()`
helper are interpolated at the top of every script. RN owns the lifecycle:
`beginScrapeSessionScript` before the first injection (clears
`fetchedSubjectCodes`, sets `scrapeActive`), `resetScrapeSessionScript` on
full reset / refresh, `endScrapeSessionScript` on `SCRAPING_COMPLETE`. The
home script also gained a page-type guard (scoped selector
`.card.bg-light.text-primary form[action="studentsubjects.php"]`, silent
return when absent) and a guarded submit that posts `SCRAPE_ERROR` instead of
throwing.

---

## 7. `StudentInfo.name` → `sname`

### Before (`utils/automationScripts.ts`)

```ts
export interface StudentInfo {
  name: string;
```

`App.tsx`, `Dashboard.tsx`, `storage.ts`, and the tests all use `sname` —
`npx tsc --noEmit` failed after the file was rebuilt from `HEAD`.

### After

```ts
export interface StudentInfo {
  sname: string;
  admissionNo: string;
  className: string;
}
```

Home parser reads the `<strong>` labels (`Username / Roll No`, `Full Name`)
and posts `{ sname, admissionNo, className }`.

---

## Verification

Full 8-subject trace after the fix — every index advances exactly once:

```
targetIndex=0 → subCode=23A70501  rows=34 p=27 a=7
targetIndex=1 → subCode=23A75401c rows=15 p=13 a=2
targetIndex=2 → subCode=23A70502a rows=37 p=33 a=4
targetIndex=3 → subCode=23A70503a rows=42 p=34 a=8
targetIndex=4 → subCode=23A70506  rows=33 p=27 a=6
targetIndex=5 → subCode=23A75901  rows=19 p=13 a=6
targetIndex=6 → subCode=23A75501  rows=33 p=29 a=4
targetIndex=7 → subCode=23A75502  rows=22 p=20 a=2
```

- `npm run lint` — zero errors
- `npx tsc --noEmit` — clean
- `bash scripts/regression-check.sh` — 11/11 pass
- All injected scripts end with `true;`; no credentials, cookies, or table
  contents are logged or persisted
