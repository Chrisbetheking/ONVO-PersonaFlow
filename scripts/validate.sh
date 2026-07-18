#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

printf '[1/10] Python compile\n'
python3 -m compileall -q "$ROOT/backend/app"

printf '[2/10] Backend tests\n'
(cd "$ROOT/backend" && PYTHONPATH=. python3 -m pytest -q)

printf '[3/10] Frontend dependencies\n'
(cd "$ROOT/frontend" && npm ci)

printf '[4/10] Frontend typecheck\n'
(cd "$ROOT/frontend" && npm run typecheck)

printf '[5/10] Frontend unit tests\n'
(cd "$ROOT/frontend" && npm test)

printf '[6/10] Playwright Chromium\n'
(cd "$ROOT/frontend" && npx playwright install chromium)

printf '[7/10] Playwright E2E\n'
(cd "$ROOT/frontend" && npm run test:e2e)

printf '[8/10] Frontend security audit\n'
(cd "$ROOT/frontend" && npm audit --audit-level=moderate)

printf '[9/10] Frontend production build\n'
(cd "$ROOT/frontend" && npm run build)

printf '[10/10] Release integrity\n'
(cd "$ROOT" && python3 scripts/release_integrity.py)

printf 'Validation passed.\n'
