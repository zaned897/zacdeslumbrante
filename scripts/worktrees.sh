#!/usr/bin/env bash
# Crea un worktree para backend y otro para frontend, con ramas <nivel>/<issue>-<tema>.
# Uso: ./scripts/worktrees.sh mock/12-eventos mock/13-tarjetas-eventos
set -euo pipefail
BACK="${1:?rama backend, ej: mock/12-eventos}"
FRONT="${2:?rama frontend, ej: mock/13-tarjetas-eventos}"
ROOT="$(git rev-parse --show-toplevel)"
NAME="$(basename "$ROOT")"

git -C "$ROOT" fetch origin
git -C "$ROOT" worktree add "$ROOT/../$NAME-back"  -b "$BACK"  origin/main
git -C "$ROOT" worktree add "$ROOT/../$NAME-front" -b "$FRONT" origin/main

for d in back front; do
  W="$ROOT/../$NAME-$d"
  [ -f "$ROOT/.env" ] && cp "$ROOT/.env" "$W/.env"
  (cd "$W" && bun install --silent)
  if [ -f "$W/services/api/pyproject.toml" ]; then (cd "$W/services/api" && uv sync -q); fi
done

echo "Listo:"
echo "  Backend  ($BACK)  → cd ../$NAME-back && claude      · bun run dev + bun run dev:py"
echo "  Frontend ($FRONT) → abre ../$NAME-front en Antigravity · PORT=3001 bun run dev"
echo "Al terminar: git worktree remove ../$NAME-back ../$NAME-front"
