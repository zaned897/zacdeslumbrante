#!/usr/bin/env bash
# Arranca todo el proyecto en local. Edita las líneas según tu stack.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
echo "Edita scripts/dev.sh con los comandos de tu proyecto (p. ej. frontend :3000 y API :8000)."
# Ejemplo con dos procesos:
# (cd services/api && uv run uvicorn app.main:app --reload --port 8000) & API=$!
# trap 'kill $API' EXIT
# bun run dev
