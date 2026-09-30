# JNTUA Attendance

Expo SDK 54 app that lets JNTUACEA students view portal attendance (`jntuaceastudents.classattendance.in`) as a native dashboard. It embeds the portal in a `WebView`, scrapes subject-wise attendance via injected JS, and highlights shortage below the 75% exam threshold.

No backend, no REST API — everything runs client-side through the WebView bridge (`postMessage`). No credentials are stored; login happens on the official portal pages.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [The 75% Rule](#the-75-rule)
- [Persistence](#persistence)
- [Error Handling](#error-handling)
- [OTA Updates](#ota-updates)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- Portal login inside the app (passwords never stored locally).
- Auto-scrape of all subjects: profile, per-subject present/absent/total, date-wise log.
- Dashboard with overall card, per-subject cards, skip capacity (`Skip N` / `Keep attending`) and catch-up hint (`Attend N more`).
- Red (< 75%), amber (75–77%), green (> 77%) zones.
- Previous Attendance: reopen last result without re-scraping.
- Overlays for syncing, offline, portal 502, portal layout change, and stall.
- OTA updates via EAS Update; validated by `lint` + `tsc` + unit tests (`scripts/regression-check.sh`).
- Android-only: no iOS branches — root layout uses `StatusBar.currentHeight`, `SERIF` is a plain constant, WebView props are Android-only.
- Syncing overlay has a Cancel button (`RESET`); overlay priority is offline → gateway → structure → selection → syncing.
- Dashboard subject list is memoized (`SubjectCard` + stable `renderItem` + tuned `FlatList`); log modal list is tuned; refresh/previous/close/reset buttons carry accessibility labels.

---

## How It Works

1. WebView loads the portal root. User logs in normally.
2. On `studenthome.php` → inject `autoSubmitFirstSemesterScript`: posts `STUDENT_INFO`, clears `sessionStorage.fetchedSubjectCodes`, submits the subjects form.
3. On `studentsubjects.php` → inject `selectSubjectByIndexScript(currentIndex)`: posts `SUBJECT_COUNT`, skips already-fetched codes (`SUBJECT_SKIPPED`), clicks row `currentIndex`, or posts `SCRAPING_COMPLETE` when done.
4. On `studentsubatt.php` → inject `parseDetailedAttendanceAndGoHomeScript`: posts `ATTENDANCE_ITEM`, records `subCode` in `sessionStorage`, returns home after 300ms. Posts `SCRAPE_ERROR` on table timeout (25 attempts).
5. When all subjects are collected the WebView unmounts and the dashboard renders. Result is persisted once (signature-guarded) to `previous_attendance_result.json`.

All scripts are IIFEs ending in `true;`. All bridge payloads are runtime-validated by `parseBridgeMessage` (`utils/bridgeValidator.ts`) — invalid payloads are ignored.

| Message | Handler |
| --- | --- |
| `STUDENT_INFO` | `SET_STUDENT_INFO` |
| `SUBJECT_COUNT` | `SET_SUBJECT_COUNT` |
| `ATTENDANCE_ITEM` | `ADD_ATTENDANCE_ITEM` (dedup by `subCode`, fallback `currentIndex`) |
| `SUBJECT_SKIPPED` | `ADVANCE_INDEX` |
| `SCRAPE_ERROR` / `STRUCTURE_CHANGED` | `SET_STRUCTURE_ERROR` (with message) |
| `SCRAPING_COMPLETE` | `SET_SCRAPING_FINISHED` |

Injection is driven by `onNavigationStateChange` in `App.tsx` (portal-host check via `isPortalHost`, per-URL dedup key `url|isLoggedIn|currentIndex`, no injection after scrape finishes). Root layout is a plain `View` with `paddingTop: StatusBar.currentHeight ?? 40` (Android-only — no `SafeAreaView`, no iOS branch).

---

## Project Structure

```
App.tsx                    # Orchestrator: state, injection routing, bridge handling, effects
reducers/appReducer.ts     # AppState, AppAction, preserveSession
views/WebViewScraper.tsx   # WebView, portal constants, human-verify note, refresh + previous buttons
views/OverlayScreens.tsx   # Offline / 502 / structure / syncing / stall overlays (priority order)
views/Dashboard.tsx        # Profile, overall card, subject list, footer (uses attendanceMath)
components/CrabScene.tsx   # Pure-Animated loader (no external deps)
components/DateLogModal.tsx# Date-wise log modal (FlatList)
components/Spike.tsx       # Decorative asterisk mark
utils/automationScripts.ts # 3 injection scripts + StudentInfo / SubjectAttendanceData / AttendanceRecord
utils/bridgeValidator.ts   # Runtime bridge guards + parseBridgeMessage
utils/attendanceMath.ts    # computeOverallStats, calculateCanSkip, calculateClassesToReach75
utils/storage.ts           # expo-file-system/legacy JSON persistence + validation
utils/updateManager.ts     # useUpdateManager hook + shouldCheckOnMount
constants/theme.ts         # COLORS, SERIF, GITHUB_URL, STALL_TIMEOUT_MS (25s)
__tests__/                 # Unit tests (reducer, math, bridge)
scripts/regression-check.sh# lint + tsc + compiled tests gate
```

State lives in one `useReducer`. Aggregates are derived at render — never duplicated. `RESET` / `CLEAR_SELECTION_ERROR` / `CLEAR_GATEWAY_ERROR` preserve `hasPreviousResult`, `previousResult`, `isSplashDismissed` via `preserveSession`.

---

## Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Framework | Expo SDK | `~54.0.37` |
| Runtime | React Native | `0.81.5` |
| Language | React + TypeScript (strict) | `19.1.0` / `~5.9.2` |
| WebView | react-native-webview | `13.15.0` |
| Storage | expo-file-system | `~19.0.24` (`/legacy` subpath) |
| OTA | expo-updates | `~29.0.20` |
| Constants / Splash / Build | expo-constants / expo-splash-screen / expo-build-properties | `~18.0.14` / `~31.0.13` / `~1.0.10` |
| Web compat | react-native-web | `~0.21.0` |
| Lint / Types | ESLint + eslint-config-expo / @types/react | `^9.25.0` / `~10.0.0` / `~19.1.0` |

Single-screen app, no router. Android-only `arm64-v8a`, minify + shrink enabled, package `com.chanikya501.JNTUAAttendance`. No iOS code paths: `constants/theme.ts` has no `Platform` import (`SERIF = "serif"`), `views/WebViewScraper.tsx` keeps Android-only WebView props (iOS-only `allowsBackForwardNavigationGestures` removed), and `Platform` in `App.tsx` guards only the Android back handler.

---

## Getting Started

### Prerequisites

- Node.js LTS, npm, Android device/emulator, JNTUA-CEA portal account.
- Dev build (`expo-dev-client`) for native validation; Expo Go for quick UI checks only.

```bash
git clone <repository-url>
cd JNTUA-Attendance
npm install
npm run start
```

```bash
npx expo start --dev-client   # preferred native validation
```

### Quality gates (mandatory)

```bash
npm run lint      # must pass with zero errors
npx tsc --noEmit
npx expo-doctor
bash scripts/regression-check.sh   # lint + typecheck + unit tests
```

Never disable lint rules or use `@ts-ignore` / `@ts-expect-error` to force a pass.

---

## Usage

1. **Log in** — embedded portal + human-verify note. Credentials go only to the portal.
2. **Sync** — automatic subject walk with `Processed X of Y` + `%` overlay (`Authenticating session…` before count arrives). Stall (> 25s no bridge activity) shows `Couldn't load subjects right now`.
3. **Dashboard** — profile banner, overall card (total/present/absent + skip pill + Shortage/Semester badge), subject cards with `Skip N` / `Keep attending` / `Attend N more` (memoized `SubjectCard`, `subCode`-keyed list). Tap a card for the date-wise log (`Present` / `Absent` / `Unknown`).
4. **Refresh** — ⟳ button (hidden while scraping to protect index tracking) reloads the portal.
5. **Previous Attendance** — button on the login screen when a valid saved result exists; hydrates the dashboard instantly (`HYDRATE_PREVIOUS_RESULT`, no re-auth).
6. **Reset / Back** — ↻ returns to login (`RESET`, WebView remounted via `webViewKey`). Android back: closes modal → dashboard home → dismisses stall error → double-tap exits with toast.

---

## The 75% Rule

```
overallPercentage = totalPresent / totalClasses * 100
isShortage = overallPercentage < 75
```

| Zone | Range | Meaning |
| --- | --- | --- |
| Shortage | < 75% | Red — below exam minimum |
| Buffer | 75–77% | Amber — dangerously close |
| Safe | > 77% | Green |

```
maxOverallSkippable = max(0, floor((4 * overallPresent - 3 * overallClasses) / 3))
canSkip(subject) = min(max(0, floor((4 * subjectPresent - 3 * subjectTotal) / 3)), maxOverallSkippable)
classesToReach75 = max(0, 3 * total - 4 * present)
```

Implemented in `utils/attendanceMath.ts` (`computeOverallStats`, `calculateCanSkip`, `calculateClassesToReach75`). The overall cap keeps per-subject skips from dragging the aggregate below 75%.

---

## Persistence

- Backend: `expo-file-system/legacy`, file `previous_attendance_result.json` in `documentDirectory`.
- Stores only `studentInfo` + `subjectsData`; aggregates are re-derived.
- Saves once per unique result (signature `name|count|classes|present|absent`). Best-effort — never crashes the scrape.
- Loads on mount; validates shape, `total === present + absent`, non-negative numbers, size caps (1MB file, 200 subjects, 1000 records/subject). Corrupt data returns `null`.

---

## Error Handling

Priority: offline → gateway → structure → selection → syncing (selection error surfaces above the syncing loader; syncing screen has a Cancel button wired to `RESET`).

| Overlay | Trigger | Recovery |
| --- | --- | --- |
| No Internet | WebView `onError` → `SET_OFFLINE(true)` | Next `onLoadStart` clears it; Retry resets |
| Portal down (502) | `onHttpError` 502 → `SET_GATEWAY_ERROR` | Next `onLoadStart` clears it; Try again resets |
| Portal layout changed | `SCRAPE_ERROR` timeout → `SET_STRUCTURE_ERROR(message)` | Reload Portal resets; message shown when provided |
| Stall | No bridge message for 25s (`STALL_TIMEOUT_MS`, 1s poll) → `SET_SELECTION_ERROR` | Dismiss (✕) or Try again |

---

## OTA Updates

Pure EAS Update for JS-only changes (scripts, UI). Native/config changes need a fresh build.

- `updates.checkAutomatically: "NEVER"` — single explicit path via `useUpdateManager` (30s timeout, `unknown` fallback). Skipped in `__DEV__`/Expo Go.
- `runtimeVersion.policy: "appVersion"`; `eas.json` `appVersionSource: "remote"`, production `autoIncrement: true`.
- Banner shows `Checking for updates…` / `Applying update…` as an absolute overlay (does not shift layout).

| Channel | Build profile | Purpose |
| --- | --- | --- |
| `staging` | `preview` (APK) | Validate before users |
| `production` | `production` (APK) | Live updates |

```bash
eas-cli login
npm run update:staging        # JS update → staging
npm run promote:production    # promote staging → production
npm run update:production     # direct to production
npm run build:preview         # staging APK
npm run build:production      # production APK
```

---

## Troubleshooting

| Symptom | Cause / Fix |
| --- | --- |
| No Internet overlay | Device offline — check network, tap Retry. |
| Portal-down overlay | Portal 502 — wait, tap Try again. |
| Layout-changed overlay | Portal HTML changed — app update needed. |
| Stall overlay | Portal slow/blocked — Try again. |
| Previous Attendance missing | No valid saved result yet — complete one full scrape. |
| Partial subjects | Scrape interrupted — tap ↻ and re-authenticate. |
| Unknown log entries | Portal row lacked a status badge — kept as `Unknown`. |
| Lint fails | Fix root cause; never disable rules or add `ts-ignore`. |

---

## Contributing

1. Branch, make minimal strictly-typed changes per `AGENTS.md`.
2. `npm run lint`, `npx tsc --noEmit`, `bash scripts/regression-check.sh` — all must pass.
3. Validate native behavior on a dev/preview build; test scraper changes against the live portal.
4. New deps only via `npx expo install` (SDK 54 compatible); scripts must end with `true;`.

---

## License

Educational use only. Not affiliated with JNTUA or classattendance.in — use per your institution's policies.
