# BUILD-RULES.md

> `AGENTS.md` is source of truth for SDK, ABI, native config, OTA single-path, WebView rules, and release gates. This file adds only build-execution detail. On conflict, `AGENTS.md` wins.

## 1. Frozen Targets

SDK 54, RN 0.81.5, `arm64-v8a` only, minify + shrink on, npm + `package-lock.json`, channels `staging`→preview / `production`→production, `runtimeVersion: appVersion`. Never silently change.

## 2. Adding Dependencies

Must answer before adding: exact feature? Possible with existing dep, RN/Expo-54 APIs, or plain TS? Adds native code? SDK-54 compatible? Runtime, build, or dev need? No concrete answer → do not add. Install via `npx expo install <pkg>`; never `npm install <pkg>@latest` or bulk template installs. New native code = fresh EAS build, never OTA.

## 3. Cleanup & Lockfile

Audit before every release: `cat package.json`, `npm ls --depth=0`, then grep usage. Removable only when: not imported in code, not needed by `app.json`/plugin, npm script, EAS/native config, or lint/TS tooling — and no documented reason. Check `App.tsx` AND `utils/`, `views/`, config, scripts before removing (imports may hide outside `App.tsx`). Remove with `npm uninstall <pkg>`, then `npm install && npm ci && npm ls --depth=0`. Never hand-edit `package-lock.json`; never `--force` / `--legacy-peer-deps`. `npm ci` must pass before any EAS build; on sync error run `npm install && npm ci` and commit both manifests.

## 4. Build Discipline

- Do not disable minify/shrink to force a build to pass — fix the failing dep/config instead.
- Expo Go is dev-only. Validate native with `eas build --profile development` + `npx expo start --dev-client`; staging/production must be standalone EAS artifacts. `EAS_BUILD_NO_EXPO_GO_WARNING=true` only silences the CLI warning.
- OTA-eligible: JS/TS/UI only. Native dep/config, `app.json` native keys, `expo-build-properties`, ABI, or native code → fresh build. Never OTA a native change.
- Do not log/persist credentials; keep portal HTTPS; runtime-validate WebView bridge payloads (casts are not validation).

## 5. Verify & Release

```bash
npm ci && npm run lint && npx tsc --noEmit && npx expo-doctor
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:preview  # test on physical ARM64
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:production
```

Functional checks: login, student-info extract, subject discovery, per-subject scrape, parsing, dashboard math, previous attendance, reset via button (Android back handler NOT implemented), portal-failure overlay, OTA in standalone build. Any failure = not production-ready.
