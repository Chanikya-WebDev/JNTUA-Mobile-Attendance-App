# Graph Report - JNTUA-Attendance  (2026-09-23)

## Corpus Check
- 27 files · ~32,336 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 206 nodes · 307 edges · 14 communities (12 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d9c1eed3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- dependencies
- expo
- scripts
- JNTUA Attendance
- Dashboard.tsx
- tsconfig.json
- bridgeValidator.ts
- eslint.config.js
- AGENTS.md
- BUILD-RULES.md
- android
- WebViewScraper.tsx
- regression-check.sh

## God Nodes (most connected - your core abstractions)
1. `expo` - 15 edges
2. `JNTUA Attendance` - 15 edges
3. `SubjectAttendanceData` - 12 edges
4. `scripts` - 10 edges
5. `App()` - 9 edges
6. `COLORS` - 8 edges
7. `StudentInfo` - 8 edges
8. `Dashboard()` - 7 edges
9. `android` - 6 edges
10. `isBridgeMessage()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `App()` --indirect_call--> `appReducer()`  [INFERRED]
  App.tsx → reducers/appReducer.ts
- `App()` --calls--> `parseBridgeMessage()`  [EXTRACTED]
  App.tsx → utils/bridgeValidator.ts
- `App()` --calls--> `isPortalHost()`  [EXTRACTED]
  App.tsx → views/WebViewScraper.tsx
- `DateLogModalProps` --references--> `SubjectAttendanceData`  [EXTRACTED]
  components/DateLogModal.tsx → utils/automationScripts.ts
- `App()` --calls--> `selectSubjectByIndexScript()`  [EXTRACTED]
  App.tsx → utils/automationScripts.ts

## Import Cycles
- None detected.

## Communities (14 total, 2 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.11
Nodes (32): App(), styles, DateLogModal(), DateLogModalProps, STATUS_COLOR, styles, STALL_TIMEOUT_MS, AppAction (+24 more)

### Community 1 - "dependencies"
Cohesion: 0.09
Nodes (23): expo, expo-build-properties, expo-constants, expo-file-system, expo-splash-screen, expo-updates, dependencies, expo (+15 more)

### Community 2 - "expo"
Cohesion: 0.09
Nodes (21): projectId, reactCompiler, expo, experiments, extra, icon, name, newArchEnabled (+13 more)

### Community 3 - "scripts"
Cohesion: 0.08
Nodes (25): eslint, eslint-config-expo, allowScripts, unrs-resolver@1.12.2, devDependencies, eslint, eslint-config-expo, @types/react (+17 more)

### Community 4 - "JNTUA Attendance"
Cohesion: 0.11
Nodes (17): Contributing, Error Handling, Features, Getting Started, How It Works, JNTUA Attendance, License, OTA Updates (+9 more)

### Community 5 - "Dashboard.tsx"
Cohesion: 0.18
Nodes (16): CrabScene(), Spike(), COLORS, GITHUB_URL, SERIF, ATTENDANCE_THRESHOLD, calculateCanSkip(), calculateClassesToReach75() (+8 more)

### Community 6 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): expo/tsconfig.base, **/*.ts, **/*.tsx, compilerOptions, paths, strict, extends, include

### Community 7 - "bridgeValidator.ts"
Cohesion: 0.42
Nodes (8): BridgeMessage, isAttendanceRecord(), isBridgeMessage(), isRecord(), isStudentInfo(), isSubjectAttendanceData(), KNOWN_TYPES, parseBridgeMessage()

### Community 9 - "AGENTS.md"
Cohesion: 0.29
Nodes (5): 1. Project Snapshot, 2. Non-Negotiables, 3. WebView Scraping — Do Not Break, 4. State, Persistence, Errors, OTA, 5. Workflow & Release Gate

### Community 10 - "BUILD-RULES.md"
Cohesion: 0.29
Nodes (5): 1. Frozen Targets, 2. Adding Dependencies, 3. Cleanup & Lockfile, 4. Build Discipline, 5. Verify & Release

### Community 11 - "android"
Cohesion: 0.25
Nodes (8): backgroundColor, adaptiveIcon, edgeToEdgeEnabled, package, permissions, predictiveBackGestureEnabled, android, INTERNET

### Community 12 - "WebViewScraper.tsx"
Cohesion: 0.25
Nodes (7): isPortalHost(), PORTAL_BASE_URL, PORTAL_HOST, PORTAL_ORIGIN_WHITELIST, styles, WebViewScraper(), WebViewScraperProps

## Knowledge Gaps
- **101 isolated node(s):** `styles`, `name`, `slug`, `version`, `orientation` (+96 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 107 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `expo` connect `expo` to `android`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `styles`, `name`, `slug` to the rest of the system?**
  _101 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11201079622132254 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `expo` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._