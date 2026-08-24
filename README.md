# JNTUA Attendance

A React Native (Expo SDK 54) mobile application that lets students of
JNTUACEA view and track their academic attendance from the JNTUA-CEA
Student Portal (`jntuaceastudents.classattendance.in`). The app embeds a
WebView, authenticates against the portal, scrapes subject-wise
attendance data, and renders a native dashboard with per-subject
breakdowns and shortage warnings for attendance below the 75% threshold.

The application has been refactored from a single-file architecture into
a modular structure with cleanly separated concerns: state management,
UI rendering, WebView orchestration, scraping scripts, persistence,
and OTA updates each live in dedicated modules.

---

## Table of Contents

-   [Project Idea](#project-idea)
-   [How It Works](#how-it-works)
-   [Architecture](#architecture)
-   [Project Structure](#project-structure)
-   [Tech Stack](#tech-stack)
-   [Getting Started](#getting-started)
-   [Usage Guide](#usage-guide)
-   [Data Pipeline](#data-pipeline)
-   [The 75% Rule Logic](#the-75-rule-logic)
-   [Previous Attendance Persistence](#previous-attendance-persistence)
-   [Mobile UX Features](#mobile-ux-features)
-   [Error Handling](#error-handling)
-   [OTA Updates (EAS Update)](#ota-updates-eas-update)
-   [Troubleshooting](#troubleshooting)
-   [Contributing](#contributing)
-   [Documentation Gaps](#documentation-gaps)
-   [License](#license)

---

## Project Idea

University portals are often slow, clunky, and not designed for mobile.
Students frequently need to check whether their attendance is on track
--- especially the **75% minimum** required to sit for semester exams.

This app removes that friction by:

1.  **Reusing the existing login session** --- the student logs in
    through the official portal inside the app, so no credentials are
    stored locally.
2.  **Automating the data retrieval** --- the app drives the portal
    through a WebView and extracts attendance programmatically.
3.  **Presenting a clear dashboard** --- instead of a jumble of HTML
    tables, the student sees a summary card, per-subject cards with
    percentage badges, skip-capacity indicators, and immediate shortage
    warnings.

The core idea is a thin, well-structured wrapper around an existing web
service that turns a mediocre web UX into a purpose-built mobile one ---
without duplicating any backend logic.

---

## How It Works

The app does **not** use a REST API or scrape from a server. Instead it
runs everything client-side inside a `react-native-webview`:

1.  The WebView loads the portal's root URL
    (`https://jntuaceastudents.classattendance.in/`).
2.  The user logs in normally through the embedded portal pages.
3.  Once on the student home page (`studenthome.php`), the app injects
    JavaScript that:
    -   reads the student's profile (name, admission number, class),
    -   posts that data back to React Native via `postMessage`,
    -   submits the "Subjects" form automatically.
4.  The app cycles through each subject:
    -   a script selects a subject row by index,
    -   a script parses the detailed attendance table (date, time,
        status),
    -   a script returns to the home page for the next subject.
5.  When all subjects are collected, the WebView is **unmounted** and the dashboard is rendered from the aggregated in-memory data.

All scraping logic lives in `utils/automationScripts.ts` as
self-contained JavaScript string templates that are injected into the
page via `webViewRef.current?.injectJavaScript()`.

---

## Architecture

The application uses a modular architecture where `App.tsx` serves as
the top-level orchestrator, delegating to dedicated modules for state
management, UI rendering, and cross-cutting concerns.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         App.tsx                                      │
│  - Top-level orchestration (state, effects, message routing)        │
│  - Delegates UI to: Dashboard, OverlayScreens, DateLogModal        │
│  - Delegates WebView to: WebViewScraper                            │
│  - Delegates state to: reducers/appReducer.ts                      │
└────────────┬──────────────────┬────────────┬──────────┬───────────┘
             │                  │              │          │
             │                  │              │          │
     injectJavaScript           │              │          │
     / postMessage              │              │          │
             │                  │              │          │
┌────────────┴────────┐  ┌─────┴──────┐  ┌────┴──────┐  ┌─┴──────────┐
│ utils/automation-   │  │ reducers/  │  │ views/    │  │ components/│
│ Scripts.ts          │  │ appReducer │  │ (Dashboard│  │ (CrabScene,│
│ - 3 JS injection     │  │ ts         │  │  Overlay- │  │  Spike,    │
│   scripts            │  │ - AppState │  │  Screens, │  │  DateLog- │
│ - TS interfaces      │  │ - AppAction│  │  WebView- │  │  Modal)    │
│ - Window type decl   │  │ - preserve-│  │  Scraper) │  │            │
│                      │  │   Session()│  │            │  │            │
└────────────┬────────┘  └─────┬──────┘  └────┬──────┘  └─┬──────────┘
             │                  │              │          │
             │ save/load JSON   │              │          │
             │ to documentDir   │              │          │
┌────────────┴──────────────────┴──────────────┴──────────┴──────────┐
│ utils/storage.ts                     utils/updateManager.ts        │
│ - savePreviousResult                 - useUpdateManager() hook     │
│ - loadPreviousResult (validated)     - UpdateStatus type          │
│ - clearPreviousResult                 - shouldCheckOnMount()       │
│ - isPreviousAttendanceResult()        - CHECK_TIMEOUT_MS           │
│   type guard                          - check/fetch/reload flow     │
└────────────────────────────────────────────────────────────────────┘
             │                              │
             │                              │
┌────────────┴──────────────────────────────┴──────────────────────┐
│ constants/theme.ts                                                  │
│ - COLORS palette                                                   │
│ - SERIF font constant                                              │
│ - GITHUB_URL                                                       │
│ - STALL_TIMEOUT_MS (25_000)                                        │
└────────────────────────────────────────────────────────────────────┘
```

### Module responsibilities

| Module                          | Responsibility                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `App.tsx`                       | Top-level orchestrator: state, side-effects, message routing, render dispatch    |
| `reducers/appReducer.ts`        | Typed `AppState`, discriminated-union `AppAction`, `initialState`, `preserveSession` |
| `views/WebViewScraper.tsx`      | WebView, user-agent, injected scripts, refresh button, Previous Attendance button |
| `views/OverlayScreens.tsx`      | Full-screen overlays: syncing, gateway error, offline, structure error, selection error |
| `views/Dashboard.tsx`           | Profile banner, overall summary card, subject list, skip/attend math, GitHub footer |
| `components/CrabScene.tsx`      | Pure `Animated` API crab loader (walking, hopping, blinking, sparkle)            |
| `components/DateLogModal.tsx`   | Attendance log modal with FlatList of date/time/status rows                        |
| `components/Spike.tsx`          | Decorative spike element used in wordmark and footer                               |
| `constants/theme.ts`            | Color palette, serif font, GitHub URL, STALL_TIMEOUT_MS                            |
| `utils/automationScripts.ts`    | Three JS injection scripts + shared TypeScript interfaces + Window type declaration |
| `utils/storage.ts`              | Save/load/clear JSON to `expo-file-system` with runtime type-guard validation      |
| `utils/updateManager.ts`        | Typed `UpdateStatus` state machine wrapping `expo-updates` with 30s timeout       |

### Key design decisions

-   **`useReducer` for state** --- all dashboard state (student info,
    subject list, progress, scraping status, selected subject, persisted
    result, error flags, splash state) is consolidated in
    `reducers/appReducer.ts`. A `RESET` action returns to
    `initialState` while preserving `hasPreviousResult`,
    `previousResult`, and `isSplashDismissed`, and bumps `webViewKey`
    to re-mount the WebView --- the cleanest way to "log out" without
    storing credentials.
-   **Memoized handlers** --- the WebView's `onNavigationStateChange`,
    `onMessage`, and the reset/previous-result handlers are wrapped in
    `useCallback`, and read the latest state through a ref (`stateRef`)
    to avoid stale-closure bugs.
-   **Derived state** --- all aggregation values (`overallClasses`,
    `overallPresent`, `overallAbsent`, `overallPercentage`,
    `maxOverallSkippable`, `calculateCanSkip`,
    `calculateClassesToReach75`) are computed during render from
    `subjectsData`. Nothing is duplicated in state.
-   **Unmounted WebView** --- once the dashboard is shown, the WebView is
    unmounted (removed from the React tree) to free its DOM, JavaScript
    context, and native resources. It is remounted fresh (via a bumped
    `webViewKey`) when a new scrape starts via `RESET`.
-   **Signature-guarded persistence** --- a `useRef` signature guard
    (`name|subjectsCount|totalClasses|present`) ensures each unique
    completed result is persisted exactly once, preventing duplicate
    writes on re-renders.
-   **Hydration is atomic** --- `HYDRATE_PREVIOUS_RESULT` is a single
    reducer action that sets `isLoggedIn`, `isScrapingFinished`,
    `studentInfo`, `subjectsData`, `currentIndex`, and `fetchedIndices`
    in one pass, so the dashboard renders immediately with no partial
    state.
-   **Color-coded attendance** --- percentages below 75% are red
    (`COLORS.error`), 75--77% are amber (`COLORS.amber`) as a buffer
    zone, and above 77% are green (`COLORS.success`). This gives
    students a visual cue when they're dangerously close to the
    threshold.
-   **Skip and attend calculations** --- the app computes both how many
    classes a student can safely skip (`calculateCanSkip`) and how many
    more classes they must attend to reach 75%
    (`calculateClassesToReach75`), displayed contextually on each
    subject card based on whether attendance is above or below the
    threshold.
-   **`preserveSession` helper** --- a single function in
    `appReducer.ts` returns `initialState` while carrying forward
    `hasPreviousResult`, `previousResult`, and `isSplashDismissed`. It
    is used by `RESET`, `CLEAR_SELECTION_ERROR`, and
    `CLEAR_GATEWAY_ERROR`, ensuring the previous-result and splash
    state survive session resets.

---

## Project Structure

```
.
├── App.tsx                    # Top-level orchestrator: state, effects, render dispatch
├── app.json                   # Expo app configuration (SDK 54, build props, OTA config)
├── eas.json                   # EAS build profiles + OTA channels
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config (strict, paths: @/* → ./*)
├── eslint.config.js           # ESLint / Expo lint config
├── AGENTS.md                  # Project conventions & constraints
├── BUILD-RULES.md             # Build, dependency & release rules
├── README.md                  # This file
├── .kilo/                     # Kilo agent configuration & graphify plugin
├── constants/
│   └── theme.ts               # Color palette, SERIF font, GITHUB_URL, STALL_TIMEOUT_MS
├── components/
│   ├── Spike.tsx              # Decorative spike element
│   ├── CrabScene.tsx          # Animated crab loader (pure Animated API)
│   └── DateLogModal.tsx       # Attendance log modal with FlatList
├── reducers/
│   └── appReducer.ts          # AppState, AppAction, initialState, preserveSession
├── views/
│   ├── WebViewScraper.tsx     # WebView, user-agent, refresh, Previous Attendance button
│   ├── OverlayScreens.tsx     # Syncing/error overlays (CrabScene-based)
│   └── Dashboard.tsx          # Profile, summary card, subject list, GitHub footer
├── utils/
│   ├── automationScripts.ts   # JS injection scripts + shared TypeScript types
│   ├── storage.ts             # Local persistence helpers (expo-file-system/legacy)
│   └── updateManager.ts       # OTA update hook + status types
└── assets/
    └── images/                # App icons, splash, favicon
```

### `App.tsx`

The top-level orchestrator (entry point). It:

-   Calls `SplashScreen.preventAutoHideAsync()` once (guarded by a ref).
-   Wires `useUpdateManager()` and triggers a deferred OTA update check
    after the initial portal load is ready (fires once
    `isSplashDismissed` becomes true via the first `onLoadStart`
    callback, guarded by `shouldCheckOnMount()`).
-   Defines `MessagePayload` discriminated union for WebView messages.
-   Implements `handleNavigationStateChange` --- routes on the current
    portal page URL and injects the appropriate script when
    `!loading && !scrapingFinished`.
-   Implements `handleMessage` --- parses `postMessage` payloads (JSON)
    and dispatches reducer actions.
-   Persists results on completion (signature-guarded `useEffect`).
-   Loads previous results on mount.
-   Renders `WebViewScraper`, `OverlayScreens`, `Dashboard`, and
    `DateLogModal` based on state.
-   Shows an OTA update banner while `expo-updates` checks or applies.

### `reducers/appReducer.ts`

All dashboard state lives in a single `useReducer` with a typed
`AppState` and discriminated-union `AppAction`.

**AppState fields:**

| Field                  | Type                              | Description                                                |
| ---------------------- | --------------------------------- | --------------------------------------------------------- |
| `webViewKey`           | `number`                          | Bumped on `RESET` to re-mount the WebView                  |
| `isLoggedIn`           | `boolean`                         | Whether the portal login is detected                       |
| `studentInfo`          | `StudentInfo \| null`             | Parsed profile (name, admissionNo, className)              |
| `currentIndex`         | `number`                          | Current subject being scraped (0-based)                    |
| `totalSubjects`        | `number \| null`                  | Subject row count reported by the portal                    |
| `fetchedIndices`       | `number[]`                        | Indices already fetched (dedup guard)                      |
| `subjectsData`         | `SubjectAttendanceData[]`         | Aggregated attendance per subject                          |
| `isScrapingFinished`   | `boolean`                         | All subjects collected                                     |
| `selectedSubject`      | `SubjectAttendanceData \| null`   | Currently-open subject for the modal                       |
| `hasPreviousResult`    | `boolean`                         | Whether a persisted result exists                          |
| `previousResult`       | `PreviousAttendanceResult \| null`| Loaded/hydrated result for instant restore                 |
| `isSelectionError`     | `boolean`                         | Stall: no postMessage from portal for too long             |
| `isStructureError`     | `boolean`                         | Portal DOM structure changed unexpectedly                  |
| `isOffline`            | `boolean`                         | WebView network error detected                             |
| `isSplashDismissed`    | `boolean`                         | Splash screen hidden at least once                         |
| `gatewayError`         | `boolean`                         | HTTP 502 from portal                                       |

**Actions:**

| Action                        | Effect                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| `RESET`                       | Returns to `initialState` via `preserveSession`, bumps `webViewKey` |
| `SET_LOGGED_IN`               | `isLoggedIn = true`                                                 |
| `SET_STUDENT_INFO`            | Stores parsed student profile                                       |
| `SET_SUBJECT_COUNT`           | Stores total subject count                                          |
| `ADD_ATTENDANCE_ITEM`         | Appends item; dedups by `fetchedIndices`; advances `currentIndex`   |
| `SET_SCRAPING_FINISHED`       | `isScrapingFinished = true`                                         |
| `SET_SELECTED_SUBJECT`        | Opens/closes the attendance log modal                               |
| `SET_PREVIOUS_RESULT`         | Stores loaded/hydrated result; sets `hasPreviousResult`             |
| `HYDRATE_PREVIOUS_RESULT`     | Atomically restores dashboard from persisted data                   |
| `SET_SELECTION_ERROR`         | `isSelectionError = true` (stall)                                   |
| `CLEAR_SELECTION_ERROR`       | Resets via `preserveSession(0)`                                   |
| `SET_STRUCTURE_ERROR`         | `isStructureError = true`                                           |
| `SET_OFFLINE`                 | `isOffline = status`                                                |
| `SET_SPLASH_DISMISSED`        | `isSplashDismissed = true`                                          |
| `SET_GATEWAY_ERROR`           | `gatewayError = true` (502)                                         |
| `CLEAR_GATEWAY_ERROR`         | Resets via `preserveSession(0)`                                     |

### `views/WebViewScraper.tsx`

Renders the `WebView` with:

-   **Custom user-agent** --- Android Chrome mobile UA string for
    mobile-optimized portal rendering.
-   **Human-verify note** --- `INJECT_HUMAN_NOTE_JS` injects a
    `#efe9de` banner above the login form warning "Don't click login
    until you are verified as human". This is only injected once per
    page load via `injectedJavaScript` (runs on every page).
-   **Refresh button** --- a floating ⟳ button in the top-right corner
    calls `webViewRef.current?.reload()` for a non-nested refresh
    mechanism (no `ScrollView`/`RefreshControl` wrapper).
-   **Previous Attendance button** --- rendered as a coral pill when
    `!isLoggedIn && hasPreviousResult`, dispatches
    `HYDRATE_PREVIOUS_RESULT` on press.
-   **WebView unmounting** --- the `WebView` (and its container) is
    unmounted entirely when `isScrapingFinished` is true, freeing its DOM,
    JavaScript context, history, and native resources. It remounts fresh
    with a new `webViewKey` when a new scrape starts.

### `views/OverlayScreens.tsx`

Renders full-screen overlays (z-index 10) using `CrabScene` and/or error
cards:

-   **No Internet Connection** (`isOffline`) --- CrabScene + retry button.
-   **Gateway Error** (`gatewayError && !isOffline`) --- CrabScene +
    "Main attendance website is not working" + 502 notice + Try again.
-   **Structure Error** (`isStructureError && !isOffline`) --- error
    card with "Portal Layout Changed" message + Reload Portal button.
-   **Syncing** (`isLoggedIn && !isScrapingFinished && !errors &&
    !isOffline`) --- CrabScene + "SYNCING" eyebrow + title + progress
    text ("Processed X of Y subjects" or "Authenticating session...") +
    percentage + "Secure session · jntuaceastudents.classattendance.in" footer.
-   **Selection Error** (`isSelectionError && isLoggedIn &&
    !isScrapingFinished && !isOffline`) --- error card with
    "Couldn't load subjects right now" + Try again button + close (x).

> **Note:** `isStructureError` and `isOffline` are both wired into the
> reducer and `OverlayScreens`, but see
> [Documentation Gaps](#documentation-gaps) for an important protocol
> mismatch regarding `SCRAPE_ERROR`.

### `views/Dashboard.tsx`

Rendered when `isLoggedIn && isScrapingFinished`:

-   **Wordmark** --- "Chanikya ·dev" with a `Spike` decoration.
-   **Reset button** --- top-right circular button (↻) dispatches `RESET`.
-   **Profile card** --- dark banner with student name, admission number,
    class, and a live dot indicator.
-   **Overall summary card** --- percentage badge, TOT/ATT/ABS mini-stats,
    and an "Overall Safe to skip" pill showing `maxOverallSkippable`.
    The status badge shows "Shortage" when below 75%, "Semester 1" otherwise.
-   **Subject list** (`FlatList`) --- each card shows subject name,
    percentage badge, TOT/ATT/ABS mini-stats, and a contextual action
    pill: "Skip N classes" (above 75%), "Attend N more" (below 75%), or
    "Keep attending" (at the limit). Color-coded: red (< 75%), amber
    (75--77%), green (> 77%).
-   **Open to Contribute footer** --- links to GitHub with "Crafted by
    J Chanikya · 2026" credit.
-   **Derived values** --- all computed during render:
    `overallClasses`, `overallPresent`, `overallAbsent`,
    `overallPercentage`, `maxOverallSkippable`, `getAttendanceColor`,
    `calculateCanSkip`, `calculateClassesToReach75`.

### `components/CrabScene.tsx`

Pure `Animated` API loader with no external dependencies. Animation
components:

-   **Walking** --- horizontal translation (`walkX`) from -170 to 0 over
    1000ms with quad-out easing.
-   **Leg stepping** --- continuous loop with 4 legs in alternating
    pairs (`leg1`/`leg3` step together, `leg2`/`leg4` step together).
-   **Jumping & hammer** --- 900ms idle, then jump up (-32px) while
    swinging hammer (-52deg), fall down + downward strike (72deg),
    impact squish (0.4 scale) with sparkle ring + 3 particle sparks,
    recovery, and neutral hammer return. Looped indefinitely.
-   **Blinking** --- 3000ms interval, eye closes to 0.1 scale then
    reopens. Looped indefinitely.

### `components/Spike.tsx`

A simple decorative component rendering 4 diagonal lines at 0°, 45°, 90°,
and 135° to form an asterisk/spike pattern. Used in the wordmark and
footer.

### `components/DateLogModal.tsx`

A `Modal` with `fade` animation and transparent background that slides
up from the bottom. Renders a `FlatList` of `AttendanceRecord` entries,
each showing date, time, and a color-coded status badge (Present =
green, Absent = red, Unknown = muted).

### `constants/theme.ts`

| Export            | Value / Type                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `COLORS`          | Object of 25 named color constants (canvas, surfaceCard, error, etc.) |
| `SERIF`           | `"Georgia"` (iOS) / `"serif"` (Android)                           |
| `GITHUB_URL`      | `"https://github.com/Chanikya-WebDev/JNTUA-Mobile-Attendance-App"` |
| `STALL_TIMEOUT_MS`| `25_000` (25 seconds)                                             |

### `utils/automationScripts.ts`

Contains the three injection scripts and the data contracts shared with
the UI:

```
Export                               Role
------------------------------------ ------------------------------------------------------
`autoSubmitFirstSemesterScript`       Reads profile info from `.list-group-item` elements, posts `STUDENT_INFO`, clears `sessionStorage.fetchedSubjectCodes`, submits the form whose `action` is `studentsubjects.php`.

`selectSubjectByIndexScript(index)`   Polls for `tr.clickable-row` rows (up to 20 attempts, 200ms interval), posts `SUBJECT_COUNT`, checks `sessionStorage.fetchedSubjectCodes` to skip already-fetched subjects (posts `SUBJECT_SKIPPED`), clicks the row at the target index, or posts `SCRAPING_COMPLETE` when the index exceeds the row count.

`parseDetailedAttendanceAndGoHomeScript`  Polls for `.card-header` and `table.table-bordered.table-striped tbody tr` (up to 25 attempts, 200ms interval), posts `ATTENDANCE_ITEM` with parsed records, tracks completed subjects in `sessionStorage`, and navigates back via `a[href="studenthome.php"]` after 300ms. If the table never loads, posts `SCRAPE_ERROR` instead.

`StudentInfo`                         `{ name: string, admissionNo: string, className: string }`

`SubjectAttendanceData`               `{ subjectName, present, absent, total, percentage: string, records: AttendanceRecord[] }` (note: the script also sends `subCode` at runtime, though the interface does not declare it)

`AttendanceRecord`                    `{ date: string, time: string, status: 'Present' | 'Absent' | 'Unknown' }`
```

> **Important:** All scripts are wrapped in an IIFE and end with `true;`
> to keep the WebView bridge alive after injection.

### `utils/storage.ts`

Local persistence of the last scraped result using `expo-file-system`
via the `/legacy` subpath (required by Expo SDK 54):

```
Export                           Role
---------------------------------------- -----------------------------------------------------------------------
`PreviousAttendanceResult`       `{ studentInfo: StudentInfo, subjectsData: SubjectAttendanceData[] }`

`savePreviousResult(result)`     Writes JSON to `{documentDirectory}/previous_attendance_result.json`

`loadPreviousResult()`           Reads and shape-validates the JSON file. Returns `null` on missing/corrupt data --- never throws.

`clearPreviousResult()`          Deletes the stored file.
```

Validation is performed by the runtime type guard
`isPreviousAttendanceResult()`, which checks that `studentInfo` has
string fields and that `subjectsData` is an array where every element
has the correct types. This type guard runs on every load, so corrupted
data fails safely.

Only `studentInfo` and `subjectsData` are persisted; all aggregates are
derived at render.

### `utils/updateManager.ts`

Encapsulates all `expo-updates` logic in one typed module:

```
Export                           Role
---------------------------------------- -----------------------------------------------------------------------------
`UpdateStatus`                   Union: `"checking" | "applying" | "ready" | "upToDate" | "error" | "unknown"`

`UpdateManager`                  Interface: `{ status, checkForUpdate, lastError }`

`shouldCheckOnMount()`           Returns `false` in `__DEV__` and in Expo Go; returns `true` in production standalone builds.

`useUpdateManager()`             Hook wrapping `Updates.useUpdates()` into the `UpdateStatus` state machine with a 30-second timeout guard (`CHECK_TIMEOUT_MS = 30_000`).
```

The `checkForUpdate()` method follows the standard EAS Update flow:
`Updates.checkForUpdateAsync()` → if available,
`Updates.fetchUpdateAsync()` → `Updates.reloadAsync()`. Failures are
caught and surfaced via `lastError` without crashing the app. If a check
exceeds 30 seconds, the status falls back to `"unknown"`.

---

## Tech Stack

| Layer         | Technology                    | Version     |
| ------------- | ----------------------------- | ----------- |
| Framework     | Expo SDK                      | `~54.0.37`  |
| Runtime       | React Native                  | `0.81.5`    |
| Language      | React + TypeScript            | `19.1.0` / `~5.9.2` (strict) |
| WebView       | react-native-webview          | `13.15.0`   |
| Storage       | expo-file-system              | `~19.0.24`  |
| OTA           | expo-updates                  | `~29.0.20`  |
| Constants     | expo-constants                | `~18.0.14`  |
| Splash Screen | expo-splash-screen            | `~31.0.13`  |
| Build config  | expo-build-properties         | `~1.0.10`   |
| Web compat    | react-native-web              | `~0.21.0`   |
| Linting       | ESLint + eslint-config-expo   | `^9.25.0` / `~10.0.0` |
| Type defs     | @types/react                  | `~19.1.0`   |

No external state-management or data-fetching libraries are used --- the
app relies on React's built-in `useReducer` and the WebView bridge. No
Expo Router or navigation library is in use.

---

## Getting Started

### Prerequisites

-   Node.js LTS
-   npm
-   An Android device/emulator for native testing
-   **Recommended:** an Expo development build (`expo-dev-client`) for
    project development
-   **Optional:** Expo Go for quick UI/prototyping only
-   A valid JNTUA-CEA student portal account

### Install

```bash
git clone <repository-url>
cd JNTUA-Attendance
npm install
```

### Run

```bash
npm run start
```

Then:

-   For a quick Expo Go smoke test, run `npm run start` and open the
    project in Expo Go.
-   For production-oriented development, use the development build
    workflow below.

### Recommended development build

Expo Go is useful for rapid prototyping, but this project is intended
for a standalone production application and uses native configuration
such as `expo-build-properties`, `expo-updates`, and
`react-native-webview`. Expo recommends development builds for
production-grade Expo projects because they reproduce the app's own
native runtime instead of relying on the shared Expo Go runtime.

Install the development client once:

```bash
npx expo install expo-dev-client
```

Build and install the development client:

```bash
eas build --profile development --platform android
```

Then start Metro for the development build:

```bash
npx expo start --dev-client
```

This is the preferred workflow for validating native behavior before a
release build. Expo Go may still be used for quick JavaScript/UI checks,
but it is not the release-equivalent runtime.

### Verify quality gates

```bash
npm run lint      # mandatory — must pass with zero errors
npx tsc --noEmit  # type correctness
npx expo-doctor   # dependency health
```

---

## Usage Guide

### 1. Log in

When the app launches, the embedded portal opens at the login page.
A "Don't click login until you are verified as human" note is injected
above the form. Enter your portal credentials and sign in. The app does
not store or transmit your password anywhere except to the official
portal.

### 2. Automatic sync

After login, the app automatically:

-   Detects that you are on the student home page (`studenthome.php`).
-   Collects your profile details (name, admission number, class).
-   Walks through every subject, parsing its attendance log.

A progress screen shows `Processed X of Y subjects` with a completion
percentage, accompanied by an animated crab scene (`CrabScene`) during
sync. If no subject count has been received yet, it shows
"Authenticating session…".

### 3. Read the dashboard

Once syncing finishes, the dashboard appears with:

-   **Student profile** --- name, admission number, and class in a dark
    banner with a live dot indicator.
-   **Overall summary card** --- combined attendance across all subjects
    with total/attended/missed counts and an overall "can skip" capacity
    pill. A status badge shows "Shortage" when below 75% or "Semester 1"
    otherwise.
-   **Subject cards** --- each subject shows its name, percentage badge,
    total/attended/missed mini-stats, and a contextual action label:
    -   **Above 75%:** "Skip N classes" (how many you can safely miss)
        or "Keep attending" (if at the limit).
    -   **Below 75%:** "Attend N more" (how many you must attend to
        reach the threshold).
-   **Shortage warnings** --- any subject or the overall total below the
    75% threshold is highlighted in red with a "Shortage" badge. An
    amber zone (75--77%) provides a buffer warning before crossing below
    the threshold.
-   **Contributor footer** --- "Open to Contribute" section links to
    GitHub; footer credit: "Crafted by J Chanikya · 2026".

### 4. Inspect a subject log

Tap any subject card to open a modal listing every recorded attendance
entry (date, time, status). Entries are tagged as **Present**,
**Absent**, or **Unknown** (when the portal did not provide a clear
status badge).

### 5. Refresh

Tap the ⟳ button in the top-right corner of the WebView to reload the
portal page.

### 6. View previous attendance

When the app starts on the login screen and a previous result is stored
locally, a **Previous Attendance** button appears as a coral pill at the
bottom-right of the screen. Tapping it restores the last scraped
dashboard instantly --- no re-login or re-scrape required. The stored
result is loaded from `expo-file-system` on mount.

### 7. Reset the app

Use the **↻ button** in the top-right corner of the dashboard to return
to the login flow. This dispatches `RESET`, which restores the
initial reducer state (clearing all runtime scrape data and
`selectedSubject`) while preserving the stored previous result. It also
increments `webViewKey` to re-mount the WebView fresh from the portal
root. The login session is preserved in the hidden WebView until you
actively log out of the portal.

---

## Data Pipeline

The end-to-end flow of a single scrape cycle:

```
Portal root
    │  (user logs in through the embedded WebView)
    ▼
studenthome.php
    │  inject autoSubmitFirstSemesterScript
    │  → STUDENT_INFO postMessage, then submit "subjects" form
    │  → clears sessionStorage.fetchedSubjectCodes
    ▼
studentsubjects.php
    │  inject selectSubjectByIndexScript(currentIndex)
    │  → SUBJECT_COUNT postMessage
    │  → if subCode already in fetchedSubjectCodes: SUBJECT_SKIPPED postMessage
    │  → else: click row[currentIndex]
    │  → if currentIndex >= rows.length: SCRAPING_COMPLETE postMessage
    ▼
studentsubatt.php
    │  inject parseDetailedAttendanceAndGoHomeScript
    │  → ATTENDANCE_ITEM postMessage (subjectName, present, absent, total, percentage, records)
    │  → adds subCode to sessionStorage.fetchedSubjectCodes
    │  → navigates back to studenthome.php after 300ms
    │  → on timeout (25 attempts): SCRAPE_ERROR postMessage
    ▼
studenthome.php  (repeat for currentIndex = 0..totalSubjects-1)
    │
    ▼
Dashboard rendered from aggregated subjectsData
    │  (data persisted to previous_attendance_result.json via expo-file-system)
```

### Messaging protocol

The `MessagePayload` discriminated union in `App.tsx` defines the
message types the React Native side expects:

```
postMessage type               Payload                                   Handled by
------------------------------ ----------------------------------------- ------------------------------------------
`STUDENT_INFO`                 `{ type, data: StudentInfo }`             `autoSubmitFirstSemesterScript` on
                                                                       `studenthome.php` → SET_STUDENT_INFO

`SUBJECT_COUNT`                `{ type, count: number }`                 `selectSubjectByIndexScript` on
                                                                       `studentsubjects.php` → SET_SUBJECT_COUNT

`SUBJECT_SKIPPED`              `{ type, subcode, index }`                `selectSubjectByIndexScript` when a
                                                                       subject was already fetched.
                                                                       **NOT HANDLED** in current App.tsx.

`ATTENDANCE_ITEM`              `{ type, data: SubjectAttendanceData }`   `parseDetailedAttendanceAndGoHomeScript`
                                                                       on `studentsubatt.php` → ADD_ATTENDANCE_ITEM
                                                                       (note: script also sends `subCode` at runtime)

`SCRAPING_COMPLETE`            `{ type }`                                `selectSubjectByIndexScript` when target
                                                                       index exceeds row count → SET_SCRAPING_FINISHED

`SCRAPE_ERROR`                 `{ type, message }`                       `parseDetailedAttendanceAndGoHomeScript`
                                                                       on table-load timeout.
                                                                       **NOT HANDLED** in current App.tsx
                                                                       (handler expects `STRUCTURE_CHANGED`).

`STRUCTURE_CHANGED`            `{ type }`                                Declared in `MessagePayload` and handled
                                                                       (`SET_STRUCTURE_ERROR`), but **NEVER
                                                                       POSTED** by any script.
```

### Reducer item handling

The reducer handles each `ATTENDANCE_ITEM` by: 1. Checking if
`currentIndex` was already fetched (dedup guard via `fetchedIndices`).
2. Appending the item to `subjectsData` and recording the index in
`fetchedIndices`. 3. Advancing `currentIndex` unless the next index
would exceed `totalSubjects`, in which case `isScrapingFinished` is set
to `true`.

---

## The 75% Rule Logic

The app evaluates attendance against the standard **75% minimum**
required to sit for semester exams:

```
overallPercentage = (totalPresent / totalClasses) * 100
isShortage = overallPercentage < 75
```

This single derived value drives all overall-level warning UI (card
badge label, score color). The same threshold is applied per subject
in the subject list via:

```
subjectPercentage = (subjectPresent / subjectTotal) * 100
isLow = subjectPercentage < 75
```

Subject cards below 75% use a red score color; those at or above use a
colored score (amber for 75--77%, green for > 77%).

### Color Threshold Zones

```
Zone           Range             Color                Meaning
-------------- ----------------- -------------------- ----------------------
**Shortage**   < 75%            Red (`COLORS.error`) Below the minimum exam
                                                     threshold

**Buffer**     75% -- 77%       Amber                Above threshold but
                               (`COLORS.amber`)      dangerously close

**Safe**       > 77%            Green                Comfortably above the
                                (`COLORS.success`)   75% threshold
```

### Skip Capacity Calculation

The app also computes how many future classes a student can miss while
staying above 75%, using a dual-constraint approach:

```
maxOverallSkippable = max(0, floor((4 * overallPresent - 3 * overallClasses) / 3))
canSkip(subject) = min(
    max(0, floor((4 * subjectPresent - 3 * subjectTotal) / 3)),
    maxOverallSkippable
)
```

The overall constraint ensures the per-subject skip count cannot push
the aggregate below 75%, even if an individual subject has surplus
attendance. This value is displayed per subject as `Skip N classes` or
`Keep attending` and overall in the summary card.

### Classes to Reach 75%

For subjects below the threshold, the app calculates how many additional
classes the student must attend to reach 75%:

```
classesToReach75 = max(0, 3 * total - 4 * present)
```

This is displayed per subject as `Attend N more` when the subject is in
shortage territory.

---

## Previous Attendance Persistence

The app persists the most recently scraped result so it survives app
restarts. This feature is implemented in `utils/storage.ts` and
integrated into `App.tsx`:

**Storage backend:** `expo-file-system` writes a JSON file
(`previous_attendance_result.json`) to `FileSystem.documentDirectory`.
The import uses the `/legacy` subpath (`expo-file-system/legacy`) as
required by Expo SDK 54.

**What is persisted:** Only `studentInfo` and `subjectsData` --- all
aggregates are derived at render time, so nothing is duplicated in
storage.

**When it is saved:** Once, immediately when a scrape completes and the
data is fully in memory, guarded by a `useRef` signature
(`name|subjectsCount|totalClasses|present`) to ensure idempotent,
single-write per unique result. The persistence `useEffect` also
dispatches `SET_PREVIOUS_RESULT` so the "Previous Attendance" button
appears without requiring a fresh mount.

**When it is loaded:** On app mount via a `useEffect` that calls
`loadPreviousResult()` and dispatches `SET_PREVIOUS_RESULT`. The loader
validates the persisted shape via the `isPreviousAttendanceResult()`
type guard and returns `null` on corruption --- it never throws.

**How it is restored:** When `hasPreviousResult` is true and the user is
on the login screen (`!isLoggedIn`), a **Previous Attendance** button is
rendered overlaying the WebView. Tapping it dispatches
`HYDRATE_PREVIOUS_RESULT`, which atomically sets `isLoggedIn`,
`isScrapingFinished`, `studentInfo`, `subjectsData`, `currentIndex`,
`totalSubjects`, and `fetchedIndices`, causing the dashboard to render
immediately with zero re-scraping and no WebView re-authentication.

**Back button behavior:** The `RESET` action (triggered by the ↻ button)
returns to `initialState` via `preserveSession`, preserving
`hasPreviousResult`, `previousResult`, and `isSplashDismissed`, so the
button reappears after resetting.

---

## Mobile UX Features

### Animated Loader (CrabScene)

The `CrabScene` component renders a pure `Animated` API crab that:

-   **Walks** --- horizontal translation across the screen on load.
-   **Hops** --- vertical bounce with squash/stretch on landing.
-   **Leg movement** --- alternating leg animation for a walking gait
    (continuous loop, 4 legs in 2 pairs).
-   **Blinking** --- periodic eye closure (3s interval) for a livelier
    feel.
-   **Sparkle ring** --- a scaling ring with three particle sparks
    that appear during the hop impact phase.

No external animation libraries are used --- the entire effect is built
with `Animated.timing`, `Animated.sequence`, `Animated.parallel`, and
`Animated.loop`. The hammer swings down on each jump cycle.

`CrabScene` is used in: the syncing overlay, the gateway error overlay,
and the offline error overlay.

### Splash Screen Management

-   `SplashScreen.preventAutoHideAsync()` is called once (guarded by a
    `useRef` so it only fires on the very first render, before the first
    JSX return).
-   The splash screen is hidden (`SplashScreen.hideAsync()`) on the
    first `onLoadStart` WebView callback, gated by `isSplashDismissed`
    state so it only fires once per session.

### Custom User Agent

The WebView uses a custom Android Chrome user agent string to ensure the
portal renders the mobile-optimized version:

```
Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36
```

### Human-Verify Note

On every page load, `INJECT_HUMAN_NOTE_JS` injects a warning banner
above the login form: "⚠️ Don't click login until you are verified as
human". The injection is guarded by a DOM element ID check to prevent
duplicate injection on re-runs.

### Refresh Button

A floating ⟳ button in the top-right corner of the WebView calls
`webViewRef.current?.reload()` to reload the portal page. This replaces the
previous `ScrollView` + `RefreshControl` pull-to-refresh wrapper, avoiding
nested scroll gesture conflicts on lower-end Android devices.

### OTA Update Banner

A slim, non-blocking banner at the top of the screen shows
"Checking for updates…" or "Applying update…" while the update
lifecycle runs (status is `"checking"` or `"applying"`).

---

## Error Handling

The app implements several error-detection mechanisms to handle portal
unreliability:

### 1. Gateway Error Handling (HTTP 502)

When the portal returns a 502 Bad Gateway, `SET_GATEWAY_ERROR` is
dispatched (via the WebView's `onHttpError` callback checking
`statusCode === 502`). This displays an opaque full-screen overlay with
the `CrabScene` animation and the message "Main attendance website is
not working" with a "Try again" button. Any subsequent `onLoadStart`
call dispatches `CLEAR_GATEWAY_ERROR` to dismiss the overlay once the
page loads normally.

### 2. Offline Error Handling

When the WebView fires an `onError` event (network failure, DNS
resolution failure, etc.), `SET_OFFLINE` with `status: true` is
dispatched. This displays a full-screen overlay with the `CrabScene`
animation and "No Internet Connection" message with a "Retry" button.
The next successful `onLoadStart` clears the offline state.

### 3. Structure Error Handling

When `parseDetailedAttendanceAndGoHomeScript` times out waiting for the
attendance table (25 polling attempts over 5 seconds), it posts a
`SCRAPE_ERROR` message. **Note:** the `MessagePayload` type and
`handleMessage` switch currently expect `STRUCTURE_CHANGED`, not
`SCRAPE_ERROR`. Since the script sends `SCRAPE_ERROR` but the handler
listens for `STRUCTURE_CHANGED`, this message is currently **not
handled** --- it falls through the switch's default case silently.
The `isStructureError` flag and its overlay exist in
`OverlayScreens.tsx` but cannot currently be triggered through the
normal scraping flow.

### 4. Selection Error (Stall Detection)

The `SET_SELECTION_ERROR` action and `isSelectionError` state field
exist in the reducer and are referenced in `OverlayScreens.tsx`.
According to the design, an interval should check `lastActivityRef`
every second and dispatch `SET_SELECTION_ERROR` if no `postMessage`
arrives within `STALL_TIMEOUT_MS` (25 seconds). **However, this
interval is not currently implemented in `App.tsx`** --- the
`lastActivityRef` is updated in `handleMessage` but never polled. The
stall-detection overlay ("Couldn't load subjects right now") cannot
currently be triggered. This is a known gap (see
[Documentation Gaps](#documentation-gaps)).

### Error Dismissal

All error states are cleared by:

-   The overlay's "Try again" / "Retry" button dispatching `RESET`
    (full session reset).
-   Natural recovery: `CLEAR_GATEWAY_ERROR` on next successful page
    load (`onLoadStart`), or `SET_OFFLINE` with `false` on next
    successful load.

---

## OTA Updates (EAS Update)

The app uses **pure EAS Update** to ship scraper-script fixes and minor
UI tweaks over-the-air --- no store reinstall or native rebuild
required. The scraping logic lives in `utils/automationScripts.ts` and
the UI in `App.tsx` and `views/`, all pure JavaScript/TypeScript
bundled into the JS runtime, making them ideal OTA targets.

### Configuration

-   **Update URL:** `https://u.expo.dev/214d3218-11c5-4156-8a95-12843b24cd74`
    (set in `app.json` → `updates.url`)
-   **EAS Project ID:** `554d405b-1ed9-4bb5-bd9f-f8af967a3634`
    (set in `app.json` → `extra.eas.projectId`)
-   **Auto-check policy:** `app.json` →
    `updates.checkAutomatically: "NEVER"` --- update checks are
    controlled explicitly by `utils/updateManager.ts`; `shouldCheckOnMount()`
    returns `false` in `__DEV__` and Expo Go, `true` in production
    standalone builds.
-   **Runtime version policy:** `appVersion` --- the `version` field in
    `app.json` determines update compatibility.
-   **EAS build version source:** `eas.json` → `cli.appVersionSource: "remote"`
    --- the version is sourced from the Expo servers during build,
    enabling `autoIncrement: true` on the production profile.

### Channels

```
Channel             Build profile                   Purpose
------------------- ------------------------------- -------------------
`staging`           `preview` (APK)                 Validate a new update before reaching users
`production`        `production` (APK, version      Live updates delivered to all users
                    auto-incremented)
```

### Publishing Runbook

```bash
# 1. Authenticate with Expo (one-time)
eas-cli login

# 2. Publish a JS-only update to staging
npm run update:staging

# 3. Validate on a staging build, then promote to production
npm run promote:production

# Or publish directly to production
npm run update:production
```

### Native Build Runbook

```bash
# Staging (APK, staging channel)
npm run build:preview

# Production (APK, production channel, version auto-incremented)
npm run build:production
```

**Important:** `eas update` only ships changes to the JS bundle. Any
change to native modules, `app.json` native config, or new native
dependencies requires a fresh build (`npm run build:production`) rather
than an update. The `runtimeVersion` uses the `appVersion` policy
(`app.json`), so bumping the `version` field forces a fresh native
build.

### What requires a new build vs. an OTA update

```
Change                                            EAS Update   New production build
----------------------------------------------- ------------ ----------------------
App.tsx JavaScript/TypeScript                          Yes                     No
utils/automationScripts.ts scraper logic               Yes                     No
views/ UI changes                                        Yes                     No
constants/theme.ts changes (non-native)                 Yes                     No
Native dependency added/removed                           No                    Yes
app.json native configuration changed                     No                    Yes
expo-build-properties configuration changed               No                    Yes
Native Android/iOS code changed                           No                    Yes
Runtime compatibility changed                             No                    Yes
```

---

## Production Readiness

The production profile builds a standalone Android APK with release
optimizations enabled. `app.json` enables `arm64-v8a`, R8/minification,
and resource shrinking, while `eas.json` maps the production build to
the `production` EAS Update channel.

### Before a production build

```bash
npm ci
npm run lint
npx tsc --noEmit
npx expo-doctor
```

If `npm ci` reports that `package.json` and `package-lock.json` are out
of sync, fix the lockfile locally with `npm install`, review the
dependency changes, commit the updated lockfile, and run `npm ci` again.
Do not work around an EAS `npm ci` failure by deleting the lockfile.

### Build a preview artifact

```bash
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:preview
```

Install and test the preview artifact on a physical ARM64 Android device
before promoting to production.

### Build for production

```bash
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:production
```

The current production profile uses an APK (`buildType: "apk"`). For
Google Play distribution, change the production `android.buildType` to
`"app-bundle"` in `eas.json` before the store release.

### Expo Go build warning

EAS may print:

```text
Detected that your app uses Expo Go for development, this is not recommended when building production apps.
```

This is a **warning, not a production build failure**. The `build:production`
npm script already sets `EAS_BUILD_NO_EXPO_GO_WARNING=true`, but this
warning may still appear because it is emitted before the profile
environment variables are loaded. To suppress it explicitly in the
shell:

```bash
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:production
```

Do not add `expo-dev-client` merely to silence this warning. The correct
reason to use `expo-dev-client` is to make development/testing use your
own native runtime. The production binary itself is already a standalone
EAS build.

### Native build configuration

| Setting                          | Value                                      |
| -------------------------------- | ------------------------------------------ |
| Architecture                     | `arm64-v8a` only                           |
| Minification                     | Enabled (`enableMinifyInReleaseBuilds: true`) |
| Resource shrinking               | Enabled (`enableShrinkResourcesInReleaseBuilds: true`) |
| Android package                  | `com.chanikya501.JNTUAAttendance`          |
| Permissions                      | `INTERNET`                                 |
| Edge-to-edge                     | Enabled (`edgeToEdgeEnabled: true`)        |
| Predictive back gesture          | Enabled (`predictiveBackGestureEnabled: true`) |
| React Compiler                   | Enabled (`experiments.reactCompiler: true`) |
| New architecture                 | Enabled (`newArchEnabled: true`)           |

### Recommended release sequence

1.  Build the `preview` profile and test on a physical ARM64 Android
    device.
2.  Publish the candidate update to `staging`.
3.  Validate the actual standalone build, not only Expo Go.
4.  Promote the verified update to `production`, or publish directly to
    `production` when appropriate.
5.  For native changes, build a new production binary.

---

## Troubleshooting

```
Symptom                        Likely Cause                                  Resolution
------------------------------ ---------------------------------------- -----------------------------------------------
Stuck on "Authenticating       Portal page structure changed, or the      Wait a few seconds for the injected script
session…"                      home page loaded before DOM was ready        to retry; if persistent, tap ↻ and retry login.

"Processed 0 of 0 subjects"    The portal's subject-row selector      The portal DOM likely changed; update
or no progress                 (`tr.clickable-row`) did not match any   `selectSubjectByIndexScript` in
                               rows                                     `utils/automationScripts.ts`.

No subjects appear after       `autoSubmitFirstSemesterScript` failed   Portal structure changed; review and
login                          to find the subjects form                update the form selector
                               (`form[action="studentsubjects.php"]`)   `autoSubmitFirstSemesterScript`.

"Main attendance website is    The portal returned an HTTP 502 Bad      Tap "Try again" to reset. The overlay
not working" overlay           Gateway                                  auto-clears once the portal responds
                                                                       normally (on next onLoadStart).

"No Internet Connection"       WebView network error (DNS, no signal)   Check network settings; tap "Retry".

overlay                         

Unknown statuses in the log    Portal table lacked a status badge       Expected --- the app marks unclear entries
                               (`span.badge`) for some rows             as `Unknown` rather than dropping them.

Portal structure changed       `parseDetailedAttendanceAndGoHomeScript`   This error is posted as `SCRAPE_ERROR`, but
error" overlay appears         timed out waiting for the table            the handler currently expects
                               (25 attempts, 5 seconds)                  `STRUCTURE_CHANGED` which is not posted.
                                                                       See [Documentation Gaps](#documentation-gaps).

Previous Attendance button     No previous result was persisted, or the Complete a full scrape once to create a
missing after restart           stored JSON is corrupt                   valid stored result; the loader validates
                                                                       shape and returns `null` on corruption.

Dashboard shows partial        Scraping was interrupted mid-way          Tap ↻ and re-authenticate to restart the
subject data                    or a subject was skipped                 full scrape.

`SUBJECT_SKIPPED` message is   The script skips already-fetched subjects  Currently **unhandled** in App.tsx. The
received but not acted upon    (tracked in sessionStorage)              message is posted but no reducer action is
                                                                       dispatched in response.

Lint fails                     Code does not meet the project quality   Run `npm run lint`, read the errors, and
                               gate                                      fix the root cause --- never disable rules
                                                                       or inject `@ts-ignore`.
```

---

## Contributing

1.  Fork the repository and create a feature branch.
2.  Make minimal, strictly-typed changes following the conventions in
    `AGENTS.md`.
3.  Run `npm run lint` and ensure it passes with zero errors.
4.  Run `npx tsc --noEmit` to verify type correctness.
5.  Test JavaScript/UI changes with Expo Go if convenient, but validate
    native and release-sensitive behavior with the `development` or
    `preview` EAS build.
6.  For release changes, follow the **Production Readiness** and **OTA
    Updates** runbooks above.
7.  Submit a pull request with a clear description of the change.

**Guidelines:** Never use `@latest` for dependencies --- always use
`npx expo install` for SDK 54 compatibility. Keep logic, styling,
state management, and UI rendering cleanly decoupled. Derive
calculated values at render --- never duplicate state. Scraping
scripts must always end with `true;` to keep the WebView bridge alive.
For scraper DOM changes, test against the live portal and update
`AGENTS.md` troubleshooting if the symptom changes.

---

## Documentation Gaps

The following gaps exist between the documented architecture and the
current code. They are documented here for transparency and to guide
future work:

1.  **Stall detection not implemented:** `App.tsx` declares
    `STALL_TIMEOUT_MS = 25000` and updates `lastActivityRef` in
    `handleMessage`, but the `setInterval` that should poll
    `lastActivityRef` and dispatch `SET_SELECTION_ERROR` is **not
    present** in the current `App.tsx`. The `isSelectionError` state,
    `SET_SELECTION_ERROR` action, and the overlay in
    `OverlayScreens.tsx` exist but cannot be triggered.

2.  **Back handler not implemented:** `App.tsx` imports
    `BackHandler`, `Platform`, `Text`, and `ToastAndroid` from
    `react-native` but **does not use any of them**. There is no
    `BackHandler.addEventListener` call, no `popstate` listener on web,
    and no double-tap-to-exit logic. The hardware back button on Android
    will use the default system behavior (closing the app or popping the
    WebView navigation stack).

3.  **Messaging protocol mismatch:** The scraping scripts post
    `SUBJECT_SKIPPED` and `SCRAPE_ERROR` message types, but
    `App.tsx`'s `MessagePayload` type and `handleMessage` switch only
    handle `STUDENT_INFO`, `SUBJECT_COUNT`, `ATTENDANCE_ITEM`,
    `STRUCTURE_CHANGED`, and `SCRAPING_COMPLETE`. The `STRUCTURE_CHANGED`
    type is declared and handled but is never posted by any script
    (the script posts `SCRAPE_ERROR` on timeout instead). The
    `SUBJECT_SKIPPED` type is posted by `selectSubjectByIndexScript`
    when a subject was already fetched but is not in the
    `MessagePayload` union and has no case in the switch.

4.  **`subCode` not in interface:** The `ATTENDANCE_ITEM` message
    includes a `subCode` field at runtime, but the `SubjectAttendanceData`
    interface in `utils/automationScripts.ts` does not declare it.
    This is not a runtime error (the field is simply ignored by
    TypeScript consumers) but represents an undocumented payload field.

5.  **Hardcoded `isRefreshing`:** `Dashboard` receives
    `isRefreshing={false}` as a hardcoded prop from `App.tsx`. There is
    no refresh state management in the dashboard itself (refresh is
    handled by a standalone ⟳ button in `WebViewScraper`).

6.  **Dead imports in `App.tsx`:** `BackHandler`, `Platform`, `Text`,
    and `ToastAndroid` are imported but unused. These should be removed
    or wired up to match the documented back-handler behavior.

7.  **`constants/theme.ts` `STALL_TIMEOUT_MS` unused:** The
    `STALL_TIMEOUT_MS` export in `constants/theme.ts` is not imported or
    referenced anywhere in the codebase. The local `const` in `App.tsx`
    is used instead (though neither is actively polled due to gap #1).

8.  **`Spike` component:** The `Spike` component and its usage in the
    wordmark and footer are not mentioned in `AGENTS.md` or
    `BUILD-RULES.md`, which focus on the scraping/persistence/update
    modules.

9.  **WebViewScraper `onHttpError`:** The README documents 502 handling
    via `onHttpError`, but the `WebView` component's default
    `onHttpError` behavior (showing a platform dialog on Android) is not
    suppressed. On Android, unhandled `onHttpError` events can cause
    the system to display a "This page isn't redirecting properly"
    dialog. The handler dispatches `SET_GATEWAY_ERROR` but does not
    call `event.preventDefault()` or suppress the default behavior.

---

## License

This project is provided for educational use. It is not affiliated with
or endorsed by JNTUA or the classattendance.in portal. Use it
responsibly and in accordance with your institution's policies.
