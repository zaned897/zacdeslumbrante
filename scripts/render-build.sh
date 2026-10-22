#!/usr/bin/env bash
# Build de zacdes-web en Render (#46): front + corpus de services/kb para que el chat cite fuentes.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v bun >/dev/null || npm install -g bun
bun install --frozen-lockfile
bun run build

# PROTO: el corpus se baja en cada deploy (contenido de terceros, no se versiona).
# Si la ingesta falla, el deploy sigue y el chat responde sin citas.
if ! command -v uv >/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
if (cd services/kb && uv sync --frozen --no-dev && uv run --no-dev python -m kb.ingest); then
  echo "corpus listo: $(wc -l < services/kb/data/corpus.jsonl 2>/dev/null || echo 0) fragmentos"
else
  echo "⚠ ingesta de services/kb falló; el chat responderá sin citas"
fi
