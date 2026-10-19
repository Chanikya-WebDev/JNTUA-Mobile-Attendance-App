# JNTUA Attendance — Native Android (Kotlin + Jetpack Compose)

Native Android port of the JNTUA Attendance scraper/dashboard app. It embeds the student portal (`jntuaceastudents.classattendance.in`) in a native `WebView`, scrapes subject-wise attendance via injected JavaScript, and renders a Material 3 dashboard highlighting attendance shortage below the 75% exam threshold.

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
- [In-App Diagnostics & Issue Reporting](#in-app-diagnostics--issue-reporting)
- [OTA Scraper Updates](#ota-scraper-updates)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- **Secure Portal Login**: Embedded WebView login; passwords and credentials are never stored or logged.
- **Automated Subject Scraping**: Scrapes all semesters/subjects in ~10 seconds: profile, per-subject present/absent/total counts, and full date-wise logs.
- **Material 3 Dashboard**: Overall attendance card, per-subject cards, skip headroom (`Skip N classes` / `Keep attending`), and catch-up calculator (`Attend N more`).
- **Visual Alert Zones**:
  - 🔴 **Shortage (< 75%)**: Exam danger zone (prompts catch-up calculation).
  - 🟡 **Buffer (75–77%)**: Dangerously close to threshold.
  - 🟢 **Safe (> 77%)**: Good standing with skippable class count.
- **Previous Attendance (Offline Cache)**: Instantly reopen previously fetched attendance without re-authenticating.
- **Resilient Overlays**: Custom Compose overlay states for Syncing, Offline, Gateway 502, Portal Layout Changes, and Inactivity Stalls.
- **Cryptographic OTA Scraper Updates**: Instant over-the-air scraper updates via ECDSA P-256 signed JavaScript bundles—no app re-install required.
- **In-App Issue Reporting & Diagnostics**: Built-in diagnostic logger (`AppLogger`) and direct Google Forms issue reporter with full device specs and scraper logs.

---

## How It Works

1. **WebView loads** the portal root (`https://jntuaceastudents.classattendance.in`). The user logs in on the official portal pages.
2. **On `studenthome.php`**: Injects `automation_scripts.js` to extract `STUDENT_INFO` (`sname`, `admissionNo`, `className`), initialize the scrape session in `sessionStorage`, and auto-submit the first semester form.
3. **On `studentsubjects.php`**: Injects `selectSubjectByIndex(targetIndex)`: posts `SUBJECT_COUNT`, skips already-fetched subjects (`SUBJECT_SKIPPED`), clicks the target subject row, or posts `SCRAPING_COMPLETE` when all subjects are parsed.
4. **On `studentcourseatt.php`** (legacy `studentsubatt.php`): Injects `parseDetailedAttendanceAndGoHome`: parses table rows, records `ATTENDANCE_ITEM`, adds `subCode` to `sessionStorage.fetchedSubjectCodes`, and returns to `studentsubjects.php` via synthetic form POST or back-navigation.
5. **On Completion**: Once all subjects are collected, the WebView is destroyed to free memory, and the native dashboard renders. The result is persisted to `previous_attendance_result.json`.

All bridge messages are runtime-validated by `BridgeValidator` — malformed or foreign payloads are ignored.

| Message | Handler Action |
| --- | --- |
| `STUDENT_INFO` | Captures student name, admission number, and class name; marks `isLoggedIn = true`. |
| `SUBJECT_COUNT` | Stores `totalSubjects`, transitions syncing overlay from "Authenticating" to progress bar. |
| `ATTENDANCE_ITEM` | Deduplicates by `subCode`, appends subject to `subjectsData`, advances `currentIndex`. |
| `SUBJECT_SKIPPED` | Advances `currentIndex` past already-fetched subjects. |
| `SCRAPE_ERROR` / `STRUCTURE_CHANGED` | Displays portal structure error overlay. |
| `SCRAPING_COMPLETE` | Finalizes scrape session, persists result, and renders dashboard. |

---

## Project Structure

```text
├── app/
│   ├── build.gradle.kts          # Android app Gradle build config (Compose, KSP, ProGuard)
│   ├── proguard-rules.pro        # ProGuard rules (keeps AttendanceBridge, models, serialization)
│   ├── release.keystore          # Keystore for release APK signing
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml   # Permissions (INTERNET, ACCESS_NETWORK_STATE), single Activity
│       │   ├── assets/
│       │   │   └── automation_scripts.js # Bundled baseline scraper automation script
│       │   ├── res/                  # Design tokens, themes, launcher icons
│       │   └── java/com/chanikya501/jntuaattendance/
│       │       ├── MainActivity.kt   # Single Activity entry point, Edge-to-Edge setup
│       │       ├── math/
│       │       │   └── AttendanceMath.kt        # 75% headroom, canSkip, classesToReach75 math
│       │       ├── model/
│       │       │   ├── AttendanceModels.kt      # StudentInfo, SubjectAttendanceData, OverallStats
│       │       │   └── BridgeMessage.kt         # Type-safe bridge messages & BridgeValidator
│       │       ├── network/
│       │       │   ├── NetworkMonitor.kt        # Reactive NetworkCallback connectivity flow
│       │       │   └── IssueReportManager.kt    # Google Forms issue report submission
│       │       ├── storage/
│       │       │   └── AttendanceStorage.kt     # Atomic JSON file persistence
│       │       ├── ui/
│       │       │   ├── AttendanceApp.kt         # Root UI composable & state-driven layer router
│       │       │   ├── components/
│       │       │   │   ├── CrabScene.kt         # Animated crab syncing graphic
│       │       │   │   ├── Spike.kt             # Decorative star/spike badge
│       │       │   │   ├── DateLogModal.kt      # Detailed date/time class record sheet
│       │       │   │   └── ReportIssueModal.kt  # Diagnostic issue report bottom sheet
│       │       │   ├── theme/                   # Material 3 colors, typography, theme tokens
│       │       │   └── views/
│       │       │       ├── DashboardView.kt     # Main attendance dashboard
│       │       │       ├── OverlayScreensView.kt # Syncing, Offline, 502, Structure, Stall overlays
│       │       │       └── WebViewScraperView.kt # Headless/interactive WebView controller
│       │       ├── util/
│       │       │   └── AppLogger.kt             # In-memory circular log buffer & clipboard exporter
│       │       └── viewmodel/
│       │           ├── AttendanceUiState.kt     # Immutable UI state & syncPct calculation
│       │           └── AttendanceViewModel.kt   # Central state orchestrator, watchdog, OTA triggers
│       └── test/java/com/chanikya501/jntuaattendance/
│           ├── AttendanceMathTest.kt
│           ├── AutomationScriptManagerTest.kt   # Cryptographic ECDSA signature verification tests
│           ├── BridgeValidatorTest.kt
│           └── IssueReportManagerTest.kt
├── scraper/
│   └── automation_scripts.js     # Live OTA scraper bundle published to GitHub/CDN
├── scripts/
│   ├── scraper_private_key.pem   # ECDSA P-256 private key (developer-only, offline)
│   ├── scraper_public_key.pem    # ECDSA P-256 public key (embedded in app)
│   └── sign_scraper.py           # Automated ECDSA signing script
├── OTA_UPDATES.md                # Comprehensive OTA Scraper Update Guide
├── build.gradle.kts
├── settings.gradle.kts
└── gradlew / gradlew.bat
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Language** | Kotlin | 1.9.22 | Type-safe native Android code |
| **UI Framework** | Jetpack Compose (BOM) | 2024.02.00 | Modern declarative reactive UI |
| **Material Design** | Material 3 | 1.2.0 | Fluid tokens, dynamic color surfaces |
| **Architecture** | AndroidX ViewModel + StateFlow | 2.7.0 | Unidirectional Data Flow (UDF) |
| **Concurrency** | Kotlin Coroutines | 1.8.0 | Asynchronous tasks, watchdog delays |
| **Cryptography** | Java Security / ECDSA NIST P-256 | Native | SHA256withECDSA digital signature verification |
| **JSON** | Kotlinx Serialization | 1.6.3 | Type-safe JSON serialization/deserialization |
| **Target Platforms** | Android 8.0+ (API 26 to 34) | SDK 34 | Phones, tablets, foldables (`arm64-v8a`, `armeabi-v7a`, `x86_64`) |

---

## Build & Requirements

### Prerequisites
- JDK 17 (or newer)
- Android SDK with `compileSdk 34` and `build-tools 34.0.0`
- Python 3 with `cryptography` library (`pip install cryptography`) for signing OTA updates

### Building from Source

```bash
# Run unit and cryptographic tests
./gradlew test

# Build Debug APK
./gradlew assembleDebug

# Build Release APK (Minified with R8, Resource-shrunk, Keystore-signed)
./gradlew assembleRelease
```

The output APK is generated at:
`app/build/outputs/apk/release/app-release.apk`

### Release Keystore Configuration
Release signing automatically reads credentials from environment variables or `local.properties`:

| Environment Variable | `local.properties` Key | Description |
|---|---|---|
| `KEYSTORE_FILE` | `keystore.file` | Absolute path to `.keystore` / `.jks` file |
| `KEYSTORE_PASSWORD` | `keystore.password` | Keystore password |
| `KEY_ALIAS` | `key.alias` | Alias name of signing key |
| `KEY_PASSWORD` | `key.password` | Password of signing key |

---

## The 75% Rule

JNTUA mandates a minimum of 75% attendance to sit for semester examinations.

```text
overallPercentage = (totalPresent / totalClasses) * 100
isShortage = overallPercentage < 75.0%
```

### Headroom & Catch-Up Calculations

```text
maxOverallSkippable = max(0, floor((4 * overallPresent - 3 * overallClasses) / 3))
canSkip(subject)    = min(max(0, floor((4 * present - 3 * total) / 3)), maxOverallSkippable)
classesNeeded       = max(0, 3 * totalClasses - 4 * overallPresent)
```

Clamping individual subject skip capacity to the overall headroom ensures skipping a subject never pulls the overall aggregate below 75%.

---

## In-App Diagnostics & Issue Reporting

The app features an integrated diagnostic logging and issue reporting engine:
- **`AppLogger`**: A thread-safe, in-memory circular ring buffer holding the most recent 250 log entries. It mirrors Android Logcat while tagging timestamps, thread levels, and scraper actions.
- **`IssueReportManager`**: Submits structured issue reports directly to the developer's secure Google Form without exposing sensitive endpoints:
  - Form Fields: Student Admission Number, Selected Issue Category, Custom Note, Scraper Version, Progress Index, Device Specs (`Model`, `Android Version`, `API Level`), and Full Diagnostic Logs.
- **Copy Logs Action**: Users can copy the complete formatted diagnostic log to their clipboard with a single tap for quick troubleshooting.

---

## OTA Scraper Updates

The app includes a zero-rebuild Over-The-Air (OTA) update system for the scraper engine:
- **Primary Endpoint**: GitHub Raw (`main/scraper/automation_scripts.js`).
- **Fallback Endpoint**: jsDelivr Edge CDN.
- **ECDSA P-256 Signature Verification**: Every downloaded script must carry a valid cryptographic signature generated by the developer's private key. Malicious, tampered, or corrupted scripts are automatically rejected.
- **HTTP Conditional GET (ETag)**: Ensures zero data waste when no update is available (HTTP 304).

📖 **For complete step-by-step developer deployment instructions, key generation, and architecture details, refer to the [OTA Scraper Update Guide (OTA_UPDATES.md)](OTA_UPDATES.md).**

---

## Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| **No Internet Overlay** | Device lost network connection. | Check Wi-Fi/Mobile data; tap **Retry**. |
| **Portal Down (502)** | JNTUA server returned HTTP 502 Bad Gateway. | Portal is undergoing server maintenance. Wait and tap **Try Again**. |
| **Portal Layout Changed** | Portal HTML structure was modified. | Developer pushes updated `automation_scripts.js` via OTA. |
| **Stuck on Syncing / Stall** | Form submission or back-navigation timed out (> 25s). | Tap **Cancel** or **Try Again**; check diagnostic log in Report Issue modal. |
| **Previous Attendance Missing** | No saved session found on disk. | Perform one successful login & scrape; cache will save automatically. |
| **Scraper Update Failed** | Network error or signature mismatch. | Script signature must be generated via `python3 scripts/sign_scraper.py`. |

---

## License

Educational and personal use only. Not affiliated with or endorsed by JNTUA or classattendance.in.
