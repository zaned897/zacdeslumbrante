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
  # instala dependencias según lo que exista en el proyecto
  [ -f "$W/package.json" ] && (cd "$W" && { command -v bun >/dev/null && bun install --silent || npm install --silent; })
  [ -f "$W/pyproject.toml" ] && (cd "$W" && uv sync -q)
  true
done

echo "Listo:"
echo "  Backend  ($BACK)  → cd ../$NAME-back && claude      · ./scripts/dev.sh"
echo "  Frontend ($FRONT) → abre ../$NAME-front en Antigravity · PORT=3001 ./scripts/dev.sh"
echo "Al terminar: git worktree remove ../$NAME-back ../$NAME-front"
