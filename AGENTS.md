# AGENTS.md

## 1. Project Snapshot

**JNTUA Attendance** — single-screen Expo SDK 54 + React Native 0.81.5 + React 19.1.0 app.
Entry: `App.tsx` via `"main": "expo/AppEntry.js"`. No Expo Router, no `app/`, no navigation lib. All UI/state in one `useReducer` in `App.tsx`.

Module map — keep logic decoupled, do not merge:

- `App.tsx` — orchestrator only: dispatch, side-effects, message routing, render dispatch. Root is a plain `View` with `paddingTop: StatusBar.currentHeight ?? 40` (Android-only; no `SafeAreaView`, no iOS branch). OTA banner is an absolute overlay (`pointerEvents="none"`), not layout. Handlers (`onLoadStart`, `onError`, `onHttpError`, `onSelectSubject`, `onClearSelectionError`) are hoisted `useCallback`s. Injection is portal-host-gated with per-URL dedup and never runs after scrape finishes; `lastActivityRef` drives the stall poller; full Android back-press chain (modal → home → stall dismiss → double-tap exit with toast).
- `reducers/appReducer.ts` — `AppState`, `AppAction` union, `initialState`, `preserveSession`
- `views/WebViewScraper.tsx` — WebView, UA, injected scripts, refresh, Previous Attendance button. Android props only: `cacheEnabled`, `androidLayerType="hardware"`, `setSupportMultipleWindows={false}`, `mediaPlaybackRequiresUserAction` (iOS-only `allowsBackForwardNavigationGestures` removed). Human-verify note + refresh (hidden while scraping) + Previous Attendance entry point.
- `views/Dashboard.tsx` — profile, summary, subject list, skip/attend math, footer. `SubjectCard` is a `memo` component; `computeOverallStats`/header/footer memoized, stable `renderItem`, `FlatList` tuned (`initialNumToRender=8`, `maxToRenderPerBatch=8`, `windowSize=5`, `removeClippedSubviews`), keyed by `subCode` fallback `subjectName`. A11y labels on cards/reset/GitHub link.
- `views/OverlayScreens.tsx` — syncing/error overlays. Priority: offline > gateway > structure > selection > syncing (selection error is dismissible and renders above the syncing loader; syncing screen has Cancel → `RESET`). All buttons carry a11y labels.
- `components/CrabScene.tsx` — pure `Animated` loader, no extra deps
- `components/DateLogModal.tsx` — log modal (`FlatList`); `components/Spike.tsx` — decoration. Modal hoists `renderLogItem`, memoizes `records`, tunes list (`initialNumToRender=20`, `maxToRenderPerBatch=20`, `windowSize=5`, `removeClippedSubviews`), a11y label on close.
- `utils/automationScripts.ts` — scrape scripts + shared interfaces (must end with `true;`). `subCode` tracked per subject; `sessionStorage` parse guarded; subject-list timeout posts `SCRAPE_ERROR`.
- `utils/storage.ts` — persistence via `expo-file-system/legacy`. 1MB cap, strict shape guard, type-only imports.
- `utils/attendanceMath.ts` — `computeOverallStats`, `calculateCanSkip`, `calculateClassesToReach75`, `getLastAttendanceDate`, `sanitizePercentage` (pure, unit-tested; single aggregates path consumed memoized by `Dashboard`)
- `utils/bridgeValidator.ts` — `BridgeMessage` union + `parseBridgeMessage` (all bridge payloads runtime-validated; invalid payloads ignored with `__DEV__` warn)
- `utils/updateManager.ts` — sole OTA lifecycle owner
- `constants/theme.ts` — colors, `SERIF` (plain `"serif"`, Android-only, no `Platform` import), `GITHUB_URL`, `STALL_TIMEOUT_MS` (25s)

## 2. Non-Negotiables

- **SDK 54 only.** Install with `npx expo install <pkg>`. Never `npm install <pkg>@latest`.
- **Strict TS:** no `any`, no `as unknown as T`, no `@ts-ignore` / `@ts-expect-error`. Fully type props, params, returns, hooks.
- **Minimalism:** smallest working change. No wrappers, hooks, or utils for single-use code. No commented-out or unused code. No unrelated refactors. Derive values at render (e.g. `overallPercentage`); never mirror state.
- **Lint gate:** task is incomplete until `npm run lint` passes with zero errors. Never disable rules or weaken `tsconfig`/ESLint to pass. Verify with `npx tsc --noEmit`.
- **Native config (do not change without explicit ask):** `arm64-v8a` only, `enableMinifyInReleaseBuilds: true`, `enableShrinkResourcesInReleaseBuilds: true`, package `com.chanikya501.JNTUAAttendance`, `INTERNET` only, `edgeToEdgeEnabled: true`, `predictiveBackGestureEnabled: true`, `experiments.reactCompiler: true`, `newArchEnabled: true`.
- **Android-only:** no iOS code paths. `SERIF` is a plain constant, WebView props are Android-only, root layout uses `StatusBar.currentHeight` (not `SafeAreaView`). `Platform` is used only for the Android back-handler guard.
- **Dependencies:** `package.json` is source of truth (expo ~54.0.37, react-native 0.81.5, webview 13.15.0, expo-updates ~29.0.20, expo-file-system ~19.0.24, expo-constants ~18.0.14, expo-splash-screen ~31.0.13, expo-build-properties ~1.0.10). Don't remove used pkgs; remove unused ones before release. No new dep if existing APIs/TS can do it; must be SDK 54-compatible. New native module = fresh EAS build, not OTA.

## 3. WebView Scraping — Do Not Break

URL-driven flow, bridge via `window.ReactNativeWebView.postMessage`:

1. `studenthome.php` → extract `STUDENT_INFO`, clear `sessionStorage.fetchedSubjectCodes`, submit form to `studentsubjects.php`
2. `studentsubjects.php` → report `SUBJECT_COUNT`, skip fetched codes (`SUBJECT_SKIPPED`), click row at `currentIndex`, post `SCRAPING_COMPLETE` when done
3. `studentsubatt.php` → parse table, post `ATTENDANCE_ITEM` (with `subCode`), track in `sessionStorage`, go home; on timeout post `SCRAPE_ERROR`

Rules: inject only via `onNavigationStateChange` + `injectJavaScript()`; scripts must end with `true;`. Portal URL stays HTTPS. Never log/persist credentials, cookies, or sensitive scrape data. Treat DOM selectors as external boundary — keep scripts scoped.

Known gaps (preserve unless task is to fix): none open — `App.tsx` now handles all bridge types (`STUDENT_INFO`, `SUBJECT_COUNT`, `ATTENDANCE_ITEM`, `SUBJECT_SKIPPED` → `ADVANCE_INDEX`, `SCRAPE_ERROR` → `SET_STRUCTURE_ERROR(message)`, `STRUCTURE_CHANGED`, `SCRAPING_COMPLETE`); stall poller (`STALL_TIMEOUT_MS`) and Android `BackHandler` chain are fully wired.

## 4. State, Persistence, Errors, OTA

- **State:** single `useReducer`. `RESET`/`CLEAR_SELECTION_ERROR`/`CLEAR_GATEWAY_ERROR` use `preserveSession` (keeps `hasPreviousResult`, `previousResult`, `isSplashDismissed`). `HYDRATE_PREVIOUS_RESULT` restores without re-scrape. State adds `fetchedSubCodes` (dedup by `subCode`, index fallback), `ADVANCE_INDEX` (skip path), `SET_STRUCTURE_ERROR(message)` (carries `structureErrorMessage`).
- **Persistence:** `previous_attendance_result.json` only, `studentInfo` + `subjectsData` only; aggregates derived at render. Guard writes with `name|subjectsCount|totalClasses|present|absent` ref; `loadPreviousResult()` returns `null` on corruption, never throws.
- **Errors:** HTTP 502 via `onHttpError` → `SET_GATEWAY_ERROR` overlay with retry (`RESET`); `onLoadStart` clears it. Stall = 25s without `postMessage` → `SET_SELECTION_ERROR` (dismissible, renders above syncing). Splash: `preventAutoHideAsync()` once (ref guard), `hideAsync()` on first `onLoadStart` only.
- **OTA (single path only):** `updates.checkAutomatically: NEVER` → `utils/updateManager.ts` → explicit check/fetch/reload. `runtimeVersion.policy: appVersion` — bumping `version` forces native build. `shouldCheckOnMount()` false in `__DEV__`/Expo Go. JS-only (`App.tsx`, `utils/*`, views, components) → `eas update`; native dep / `app.json` / manifest / ABI change → fresh build. Channels: `staging`↔`preview`, `production`↔`production`. Runbook: `npm run update:staging` → validate → `npm run promote:production` (or `npm run update:production`); builds: `npm run build:preview` / `npm run build:production`.

## 5. Workflow & Release Gate

Workflow: `Inspect → Minimal change → Lint → Typecheck → Report`.

Before claiming production-ready, all must pass — do not suppress or bypass failures:

```bash
npm ci
npm run lint
npx tsc --noEmit
npx expo-doctor
```

Plus: `arm64-v8a`-only intact, OTA single-path intact, no secrets in source/README/config, no committed `.env`, WebView login→discovery→iteration→parse→dashboard tested on real ARM64 device (preview APK first, then production). Report `PASS/FAIL` for: deps/audit, `npm ci`, lint, TS, expo-doctor, ARM64, OTA, WebView, preview build, production build. Any `FAIL` = not release-ready.
