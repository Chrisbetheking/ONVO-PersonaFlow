#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/8] Python compile"
python3 -m compileall -q "$ROOT/backend/app"

echo "[2/8] Backend tests"
(cd "$ROOT/backend" && PYTHONPATH=. python3 -m pytest -q)

echo "[3/8] Frontend dependencies"
(cd "$ROOT/frontend" && npm ci)

echo "[4/8] Frontend typecheck"
(cd "$ROOT/frontend" && npm run typecheck)

echo "[5/8] Frontend unit tests"
(cd "$ROOT/frontend" && npm test)

echo "[6/8] Playwright E2E"
(cd "$ROOT/frontend" && npm run test:e2e)

echo "[7/8] Frontend security audit"
(cd "$ROOT/frontend" && npm audit --audit-level=moderate)

echo "[8/8] Frontend production build"
(cd "$ROOT/frontend" && npm run build)

echo "Validation passed."
