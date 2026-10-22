#!/usr/bin/env bash
# Punto único de calidad: lo usan el pre-commit, CI y los agentes. Ajusta las líneas a tu stack.
# Uso: ./scripts/check.sh           todo (lint + formato + tests)
#      ./scripts/check.sh --quick   sin tests (pre-commit)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
QUICK=0; [ "${1:-}" = "--quick" ] && QUICK=1
ran=0

# JavaScript / TypeScript: usa el script "lint" (y "test") de package.json si existen
if [ -f package.json ]; then
  PM=npm; command -v bun >/dev/null && [ -f bun.lock -o -f bun.lockb ] && PM=bun
  if grep -q '"lint"' package.json; then $PM run lint; ran=1; fi
  if [ $QUICK = 0 ] && grep -q '"test"' package.json; then $PM run test; ran=1; fi
fi

# Python: ruff + pytest en cada carpeta con pyproject.toml (raíz o services/*)
for d in . services/*; do
  [ -f "$d/pyproject.toml" ] || continue
  (cd "$d" && uv run ruff check . && uv run ruff format --check .)
  if [ $QUICK = 0 ]; then (cd "$d" && { uv run pytest -q || [ $? -eq 5 ]; }); fi   # 5 = sin tests (válido en sketch/mock)
  ran=1
done

[ $ran = 1 ] && echo "✓ checks ok" || echo "~ no hay checks configurados aún (edita scripts/check.sh)"
