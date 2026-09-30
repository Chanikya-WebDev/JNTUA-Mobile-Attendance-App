#!/bin/bash
# Zero-dependency regression gate: lint + typecheck + compiled unit tests.
set -e
cd "$(dirname "$0")/.."
npm run lint
npx tsc --noEmit
rm -rf /tmp/jntua-regression
npx tsc __tests__/attendanceMath.test.ts __tests__/bridgeValidator.test.ts __tests__/appReducer.test.ts --outDir /tmp/jntua-regression --module commonjs --target es2022 --strict --skipLibCheck --esModuleInterop
node --test /tmp/jntua-regression/__tests__/attendanceMath.test.js /tmp/jntua-regression/__tests__/bridgeValidator.test.js /tmp/jntua-regression/__tests__/appReducer.test.js
