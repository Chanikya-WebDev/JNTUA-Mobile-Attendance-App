# JNTUA Attendance — Native Android (Kotlin + Jetpack Compose)

Native Android port of the JNTUA Attendance scraper/dashboard app. It embeds the portal (`jntuaceastudents.classattendance.in`) in a native `WebView`, scrapes subject-wise attendance via injected JavaScript, and renders a Material 3 dashboard highlighting attendance shortage below the 75% exam threshold.

No backend, no REST API — everything runs client-side through the WebView bridge (`postMessage`). No credentials are stored; login happens on the official portal pages.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Build & Requirements](#build--requirements)
- [Usage](#usage)
- [The 75% Rule](#the-75-rule)
- [Persistence](#persistence)
- [Error Handling](#error-handling)
- [OTA Scraper Updates](#ota-scraper-updates)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- Portal login inside the app (passwords never stored locally).
- Auto-scrape of all subjects: profile, per-subject present/absent/total, date-wise log.
- Dashboard with overall card, per-subject cards, skip capacity (`Skip N` / `Keep attending`) and catch-up hint (`Attend N more`).
- Red (< 75%), amber (75–77%), green (> 77%) attendance zones.
- Previous Attendance: reopen last result without re-scraping.
- Overlays for syncing, offline, portal 502, portal layout change, and stall.
- OTA scraper updates: signed ECDSA validation via GitHub raw/CDN, conditional GET with ETag, 15-minute cooldown.
- Android-only native stack: Kotlin, Jetpack Compose, `enableEdgeToEdge()`, `INTERNET` + `ACCESS_NETWORK_STATE` permissions, minify + shrink enabled in release.
- Syncing overlay has a Cancel button (`RESET`); overlay priority is offline → gateway → structure → selection → syncing.

---

## How It Works

1. **WebView loads** the portal root. User logs in normally on official portal pages.
2. On `studenthome.php` → inject automation script: posts `STUDENT_INFO`, clears `sessionStorage.fetchedSubjectCodes`, submits the subjects form.
3. On `studentsubjects.php` → inject `selectSubjectByIndexScript(currentIndex)`: posts `SUBJECT_COUNT`, skips already-fetched codes (`SUBJECT_SKIPPED`), clicks row `currentIndex`, or posts `SCRAPING_COMPLETE` when done.
4. On `studentcourseatt.php` (legacy `studentsubatt.php`) → inject `parseDetailedAttendanceAndGoHomeScript`: posts `ATTENDANCE_ITEM`, records `subCode` in `sessionStorage`, returns via `history.back()` loop until `studentsubjects.php` is reached. Emits `SCRAPE_IDLE` on table timeout.
5. When all subjects are collected the WebView is destroyed and the dashboard renders. Result is persisted once (signature-guarded) to `previous_attendance_result.json`.

All bridge payloads are runtime-validated by `BridgeValidator` — invalid payloads are ignored.

| Message | Handler |
| --- | --- |
| `STUDENT_INFO` | Login → `isLoggedIn = true`, capture `studentInfo` |
| `SUBJECT_COUNT` | Set `totalSubjects`, reset stall watchdog |
| `ATTENDANCE_ITEM` | Dedup by `subCode`/`index`, append to `subjectsData`, advance index |
| `SUBJECT_SKIPPED` | Advance index past skipped subject |
| `SCRAPE_ERROR` / `STRUCTURE_CHANGED` | Show structure error overlay |
| `SCRAPING_COMPLETE` | Mark scraping finished, persist result |

Injection is driven by `WebViewClient.onPageFinished` (portal-host check via `isPortalHost`, per-URL dedup key `url|isLoggedIn|currentIndex`, no injection after scrape finishes).

---

## Project Structure

```
android-apk/
├── app/
│   ├── build.gradle.kts          # Android app Gradle config (KSP, Compose, signing, minify)
│   ├── settings.gradle.kts
│   ├── gradle.properties
│   ├── proguard-rules.pro
│   ├── release.keystore          # Release signing keystore
│   ├── src/main/
│       ├── AndroidManifest.xml   # INTERNET + ACCESS_NETWORK_STATE, single Activity
│       ├── res/
│       │   ├── values/
│       │   │   ├── colors.xml    # Design surface tokens
│       │   │   ├── strings.xml
│       │   │   └── themes.xml
│       │   ├── xml/
│       │   │   └── network_security_config.xml
│       │   ├── mipmap-*/         # Launcher icons
│       │   └── drawable/ic_launcher_background.xml
│       └── java/com/chanikya501/jntuaattendance/
│           ├── MainActivity.kt   # Single Activity, Compose entry, edge-to-edge
│           ├── AttendanceApp.kt  # Root Composable, BackHandler, layer routing
│           ├── viewmodel/
│           │   ├── AttendanceViewModel.kt   # VM: state, bridge handling, persistence, OTA
│           │   └── AttendanceUiState.kt     # UI state data class + derived syncPct
│           ├── math/
│           │   └── AttendanceMath.kt        # computeOverallStats, canSkip, classesToReach75
│           ├── model/
│           │   ├── AttendanceModels.kt      # StudentInfo, SubjectAttendanceData, AttendanceRecord, OverallStats
│           │   └── BridgeMessage.kt         # BridgeMessage sealed interface + BridgeValidator runtime parse
│           ├── webview/
│           │   ├── WebViewScraperView.kt    # Native WebView (layer hardware, INVISIBLE during scrape)
│           │   ├── AutomationScriptManager.kt # OTA script download + ECDSA signature verification
│           │   └── AttendanceBridge.kt      # JavascriptInterface postMessage bridge shim
│           ├── storage/
│           │   └── AttendanceStorage.kt     # File-based JSON persistence
│           ├── network/
│           │   ├── NetworkMonitor.kt        # ConnectivityManager NetworkCallback flow
│           │   └── IssueReportManager.kt    # Google Forms issue report submission
│           ├── util/
│           │   └── AppLogger.kt             # In-memory diagnostic log buffer + clipboard copy
│           ├── ui/
│           │   ├── AttendanceApp.kt
│           │   ├── views/
│           │   │   ├── WebViewScraperView.kt
│           │   │   ├── DashboardView.kt     # Profile, overall card, subject list, footer
│           │   │   └── OverlayScreensView.kt # Offline / 502 / structure / syncing / stall overlays
│           │   ├── components/
│           │   │   ├── CrabScene.kt         # Pure-Animated loader (no external deps)
│           │   │   ├── Spike.kt             # Decorative asterisk mark
│           │   │   ├── DateLogModal.kt      # Date-wise log modal (LazyColumn)
│           │   │   ├── ReportIssueModal.kt  # Report issue bottom sheet
│           │   │   └── ...
│           │   └── theme/
│           │       ├── Theme.kt             # MaterialTheme + color scheme
│           │       ├── Color.kt             # Color tokens (Primary, SurfaceCard, CanvasBg, …)
│           │       └── Type.kt              # Typography tokens (Serif family)
│           └── test/
│               ├── AttendanceMathTest.kt
│               ├── AutomationScriptManagerTest.kt
│               ├── BridgeValidatorTest.kt
│               └── IssueReportManagerTest.kt
├── build.gradle.kts
├── gradlew / gradlew.bat
└── gradle/wrapper/
```

State lives in `AttendanceUiState` (single `StateFlow` in `AttendanceViewModel`). Aggregates are derived at render — never mirrored.

---

## Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Language | Kotlin | 1.9.x |
| UI | Jetpack Compose Material 3 | BOM 2024.02.00 |
| Activity | androidx.activity:activity-compose | 1.8.2 |
| Lifecycle | androidx.lifecycle:lifecycle-viewmodel-compose | 2.7.0 |
| Coroutines | kotlinx-coroutines-android | 1.8.0 |
| Core | androidx.core:core-ktx | 1.12.0 |
| Test | JUnit 4 | 4.13.2 |
| Test | org.json | 20231013 |
| Gradle | Gradle wrapper | 8.7 |
| Compile SDK | Android | 34 |
| Min SDK | Android | 26 |
| Target SDK | Android | 34 |

Single-screen app, no router. Native Android `arm64-v8a`-compatible, minify + shrink enabled in release, package `com.chanikya501.JNTUAAttendance`.

---

## Build & Requirements

### Prerequisites

- Android Studio (Iguana or newer recommended)
- JDK 17
- Android SDK with compileSdk 34, build-tools 34.x
- Android device/emulator (API 26+) for testing

### Building

```bash
cd android-apk

# Debug build
./gradlew assembleDebug

# Release build (requires keystore config in local.properties or env vars)
./gradlew assembleRelease
```

The release APK is output at:
`app/build/outputs/apk/release/app-release.apk`

### Release signing

Release signing reads from environment variables or `local.properties`:

| Source | Property |
| --- | --- |
| `KEYSTORE_FILE` / `keystore.file` | Keystore path |
| `KEYSTORE_PASSWORD` / `keystore.password` | Keystore password |
| `KEY_ALIAS` / `key.alias` | Key alias |
| `KEY_PASSWORD` / `key.password` | Key password |

If any of these are missing, release signing is skipped and the unsigned APK is produced.

---

## Usage

1. **Log in** — embedded portal + human-verify note. Credentials go only to the portal.
2. **Sync** — automatic subject walk with `Processed X of Y` + `%` overlay (`Authenticating session…` before count arrives). Stall (> 25s no bridge activity) shows `Couldn't load subjects right now`.
3. **Dashboard** — profile banner, overall card (total/present/absent + skip pill + Shortage/Semester badge), subject cards with `Skip N` / `Keep attending` / `Attend N more`. Tap a card for the date-wise log (`Present` / `Absent` / `Unknown`).
4. **Refresh** — ⟳ button (hidden while scraping to protect index tracking) reloads the portal.
5. **Previous Attendance** — button on the login screen when a valid saved result exists; hydrates the dashboard instantly (no re-auth).
6. **Reset / Back** — ↻ returns to login (`RESET`, WebView remounted via `webViewKey`). Android back: closes modal → dashboard home → dismisses stall error → exits.

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

Implemented in `AttendanceMath.kt` (`computeOverallStats`, `calculateCanSkip`, `calculateClassesToReach75`). The overall cap keeps per-subject skips from dragging the aggregate below 75%.

---

## Persistence

- Backend: `java.io.File` in `context.filesDir`, file `previous_attendance_result.json`.
- Stores only `studentInfo` + `subjectsData`; aggregates are re-derived.
- Saves once per unique result (signature `name|count|classes|present|absent`). Best-effort — never crashes the scrape.
- Loads on mount; validates shape, `total === present + absent`, non-negative numbers, size caps (1MB file, 200 subjects, 1000 records/subject). Corrupt data returns `null`.

---

## Error Handling

Priority: offline → gateway → structure → selection → syncing (selection error surfaces above the syncing loader; syncing screen has a Cancel button wired to `RESET`).

| Overlay | Trigger | Recovery |
| --- | --- | --- |
| No Internet | WebView `onReceivedError` → `isOffline = true` | Next `onPageStarted` clears it; Retry resets |
| Portal down (502) | `onReceivedHttpError` 502 → `gatewayError = true` | Next `onPageStarted` clears it; Try again resets |
| Portal layout changed | `SCRAPE_ERROR` timeout → `isStructureError = true` | Reload Portal resets; message shown when provided |
| Stall | No bridge message for 25s → `isSelectionError = true` | Dismiss (✕) or Try again |

---

## OTA Scraper Updates

Pure over-the-air scraper script updates (no app rebuild needed for scraper changes).

- The scraper script is bundled as an asset (`automation_scripts.js`) and can be updated OTA from GitHub raw / jsDelivr CDN.
- Updates use HTTP Conditional GET (If-None-Match / ETag) and a 15-minute cooldown for silent background checks.
- Every downloaded script is validated: structural markers + **cryptographic ECDSA (SHA256withECDSA, NIST P-256) signature verification** against an embedded public key. Unsigned or tampered scripts are rejected.
- App version code upgrades purge stale cached scripts (prevents the "Bundled Asset Upgrade Trap").

---

## Troubleshooting

| Symptom | Cause / Fix |
| --- | --- |
| No Internet overlay | Device offline — check network, tap Retry. |
| Portal-down overlay | Portal 502 — wait, tap Try again. |
| Layout-changed overlay | Portal HTML changed — app update needed. |
| Stall overlay | Portal slow/blocked — Try again. |
| Previous Attendance missing | No valid saved result yet — complete one full scrape. |
| Partial subjects | Scrape interrupted — tap ⟳ and re-authenticate. |
| Unknown log entries | Portal row lacked a status badge — kept as `Unknown`. |
| Scraper update failed | Network error or signature mismatch — check connectivity. |

---

## License

Educational use only. Not affiliated with JNTUA or classattendance.in

