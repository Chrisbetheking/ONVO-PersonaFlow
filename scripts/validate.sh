#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/7] Python compile"
python3 -m compileall -q "$ROOT/backend/app"

echo "[2/7] Backend tests"
(cd "$ROOT/backend" && PYTHONPATH=. python3 -m pytest -q)

echo "[3/7] Frontend dependencies"
(cd "$ROOT/frontend" && npm ci)

echo "[4/7] Frontend typecheck"
(cd "$ROOT/frontend" && npm run typecheck)

echo "[5/7] Frontend tests"
(cd "$ROOT/frontend" && npm test)

echo "[6/7] Frontend security audit"
(cd "$ROOT/frontend" && npm audit --audit-level=moderate)

echo "[7/7] Frontend production build"
(cd "$ROOT/frontend" && npm run build)

echo "Validation passed."
