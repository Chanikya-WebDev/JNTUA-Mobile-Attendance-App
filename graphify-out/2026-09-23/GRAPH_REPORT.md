# Graph Report - JNTUA-Attendance  (2026-09-23)

## Corpus Check
- 21 files · ~39,610 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 293 nodes · 354 edges · 16 communities (15 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `360c6778`
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
- Project Structure
- eslint.config.js
- AGENTS.md
- BUILD-RULES.md
- 9. Final Production Gate — Mandatory
- Mobile UX Features
- Production Readiness
- OTA Updates (EAS Update)
- Getting Started

## God Nodes (most connected - your core abstractions)
1. `JNTUA Attendance` - 20 edges
2. `expo` - 15 edges
3. `Project Structure` - 13 edges
4. `9. Final Production Gate — Mandatory` - 12 edges
5. `scripts` - 10 edges
6. `SubjectAttendanceData` - 10 edges
7. `COLORS` - 8 edges
8. `StudentInfo` - 8 edges
9. `Usage Guide` - 8 edges
10. `App()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `App()` --indirect_call--> `appReducer()`  [INFERRED]
  App.tsx → reducers/appReducer.ts
- `DateLogModalProps` --references--> `SubjectAttendanceData`  [EXTRACTED]
  components/DateLogModal.tsx → utils/automationScripts.ts
- `App()` --calls--> `selectSubjectByIndexScript()`  [EXTRACTED]
  App.tsx → utils/automationScripts.ts
- `App()` --calls--> `loadPreviousResult()`  [EXTRACTED]
  App.tsx → utils/storage.ts
- `App()` --calls--> `savePreviousResult()`  [EXTRACTED]
  App.tsx → utils/storage.ts

## Import Cycles
- None detected.

## Communities (16 total, 1 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.12
Nodes (30): App(), MessagePayload, styles, DateLogModal(), DateLogModalProps, STATUS_COLOR, styles, AppAction (+22 more)

### Community 1 - "dependencies"
Cohesion: 0.09
Nodes (23): expo, expo-build-properties, expo-constants, expo-file-system, expo-splash-screen, expo-updates, dependencies, expo (+15 more)

### Community 2 - "expo"
Cohesion: 0.07
Nodes (29): backgroundColor, adaptiveIcon, edgeToEdgeEnabled, package, permissions, predictiveBackGestureEnabled, projectId, reactCompiler (+21 more)

### Community 3 - "scripts"
Cohesion: 0.08
Nodes (25): eslint, eslint-config-expo, allowScripts, unrs-resolver@1.12.2, devDependencies, eslint, eslint-config-expo, @types/react (+17 more)

### Community 4 - "JNTUA Attendance"
Cohesion: 0.06
Nodes (34): 1. Gateway Error Handling (HTTP 502), 1. Log in, 2. Automatic sync, 2. Offline Error Handling, 3. Read the dashboard, 3. Structure Error Handling, 4. Inspect a subject log, 4. Selection Error (Stall Detection) (+26 more)

### Community 5 - "Dashboard.tsx"
Cohesion: 0.16
Nodes (14): CrabScene(), Spike(), COLORS, GITHUB_URL, SERIF, STALL_TIMEOUT_MS, Dashboard(), styles (+6 more)

### Community 6 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): expo/tsconfig.base, **/*.ts, **/*.tsx, compilerOptions, paths, strict, extends, include

### Community 7 - "Project Structure"
Cohesion: 0.15
Nodes (13): `App.tsx`, `components/CrabScene.tsx`, `components/DateLogModal.tsx`, `components/Spike.tsx`, `constants/theme.ts`, Project Structure, `reducers/appReducer.ts`, `utils/automationScripts.ts` (+5 more)

### Community 9 - "AGENTS.md"
Cohesion: 0.06
Nodes (32): 1. Prohibition of `@latest`, 1. Project Identity & Governance, 2. Pinned Technical Stack, 2. Standard Installation Method, 3. Dependency Pre-checks, 3. Mandatory Lint Gate, 4. Native Dependency Impact, 4. Package & Dependency Rules (+24 more)

### Community 10 - "BUILD-RULES.md"
Cohesion: 0.08
Nodes (24): 10. Required Verification Pipeline, 11. WebView Safety Rules, 12. Production Release Checklist, 13. Hard Failure Policy, 14. Agent Rule, 1. Non-Negotiable Build Targets, 2. Dependency Minimalism, 3. Mandatory Unused-Package Cleanup (+16 more)

### Community 11 - "9. Final Production Gate — Mandatory"
Cohesion: 0.17
Nodes (12): 9. Final Production Gate — Mandatory, A. Dependency Hygiene, B. Architecture Gate, C. Expo Go / Development Gate, D. Static Quality Gate, E. Configuration Gate, F. OTA Gate, G. WebView Production Gate (+4 more)

### Community 12 - "Mobile UX Features"
Cohesion: 0.29
Nodes (7): Animated Loader (CrabScene), Custom User Agent, Human-Verify Note, Mobile UX Features, OTA Update Banner, Refresh Button, Splash Screen Management

### Community 13 - "Production Readiness"
Cohesion: 0.29
Nodes (7): Before a production build, Build a preview artifact, Build for production, Expo Go build warning, Native build configuration, Production Readiness, Recommended release sequence

### Community 14 - "OTA Updates (EAS Update)"
Cohesion: 0.33
Nodes (6): Channels, Configuration, Native Build Runbook, OTA Updates (EAS Update), Publishing Runbook, What requires a new build vs. an OTA update

### Community 15 - "Getting Started"
Cohesion: 0.33
Nodes (6): Getting Started, Install, Prerequisites, Recommended development build, Run, Verify quality gates

## Knowledge Gaps
- **190 isolated node(s):** `MessagePayload`, `styles`, `name`, `slug`, `version` (+185 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 194 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JNTUA Attendance` connect `JNTUA Attendance` to `Project Structure`, `Mobile UX Features`, `Production Readiness`, `OTA Updates (EAS Update)`, `Getting Started`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `Project Structure` connect `Project Structure` to `JNTUA Attendance`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `MessagePayload`, `styles`, `name` to the rest of the system?**
  _190 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `expo` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._