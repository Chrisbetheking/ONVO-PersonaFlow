#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/5] Python compile"
python3 -m compileall -q "$ROOT/backend/app"

echo "[2/5] Backend tests"
(cd "$ROOT/backend" && python3 -m pytest -q)

echo "[3/5] Frontend dependencies"
(cd "$ROOT/frontend" && npm ci)

echo "[4/5] Frontend security audit"
(cd "$ROOT/frontend" && npm audit --audit-level=moderate)

echo "[5/5] Frontend production build"
(cd "$ROOT/frontend" && npm run build)

echo "Validation passed."
