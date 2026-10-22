#!/usr/bin/env bash
# Levanta Express+Vite (:3000) y, si existe, la API Python (:8000) en una sola pestaña.
# Ctrl+C detiene ambos y libera los puertos (también en Windows).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
. scripts/lib-ports.sh
PORT="${PORT:-3000}"; PY_PORT="${PY_PORT:-8000}"

cleanup(){ trap - INT TERM EXIT; free_port "$PORT"; free_port "$PY_PORT"; kill $(jobs -p) 2>/dev/null; exit 0; }
trap cleanup INT TERM EXIT

free_port "$PORT"; free_port "$PY_PORT"   # por si quedó algo de una sesión anterior
if [ -f services/api/pyproject.toml ]; then
  (cd services/api && exec uv run uvicorn app.main:app --reload --port "$PY_PORT") > >(sed -u 's/^/[py]  /') 2>&1 &
fi
PY_API_URL="http://localhost:$PY_PORT" PORT="$PORT" bun run dev > >(sed -u 's/^/[web] /') 2>&1 &
echo "web → http://localhost:$PORT   py → http://localhost:$PY_PORT (si existe)   Ctrl+C para detener"
wait
