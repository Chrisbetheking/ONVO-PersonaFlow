#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$ROOT/backend"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  npm ci
fi
npm run dev -- --port 5173 &
FRONTEND_PID=$!

echo ""
echo "ONVO PersonaFlow started"
echo "Frontend: http://localhost:5173"
echo "API docs: http://localhost:8000/docs"
echo "Press Ctrl+C to stop."
wait
