#!/usr/bin/env bash
# Conecta la suite a los agentes y activa los git hooks. No instala herramientas extra (eso lo decide scout).
# Uso: ./scripts/suite-init.sh                 (Claude Code + Codex)
#      ./scripts/suite-init.sh --antigravity   (además enlaza las skills al CLI de Antigravity)
# Windows: correr en Git Bash (Warp → pestaña Git Bash) con Modo de desarrollador activo.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
ok(){ printf '  ✓ %s\n' "$1"; }; warn(){ printf '  ! %s\n' "$1"; }

case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WIN=1; export MSYS=winsymlinks:nativestrict ;; *) WIN=0 ;; esac

# link <destino> <nombre_del_link>: symlink real; si Windows lo impide, copia y avisa
link(){
  rm -rf "$2"
  if ln -s "$1" "$2" 2>/dev/null; then return 0; fi
  cp -r "$(cd "$(dirname "$2")" && cd "$1" && pwd)" "$2"
  warn "copié en vez de enlazar $2 (activa Modo de desarrollador y vuelve a correr para evitar copias desactualizadas)"
}

echo "Herramientas:"
for c in git node bun uv gh claude codex agy; do
  command -v "$c" >/dev/null && ok "$c" || warn "$c no encontrado (ver WORKSTATION.md)"
done

echo "Skills compartidas (.agents/skills):"
[ -L .claude/skills ] || link ../.agents/skills .claude/skills
ok "Claude Code → .claude/skills"
ok "Codex → .agents/skills (lo lee directo)"
if [ "${1:-}" = "--antigravity" ]; then
  AG="$HOME/.gemini/antigravity-cli/skills"; mkdir -p "$AG"
  for s in .agents/skills/*/; do
    n="$(basename "$s")"; dst="$AG/$(basename "$ROOT")-$n"
    if [ "$WIN" = 1 ]; then rm -rf "$dst"; ln -s "$ROOT/$s" "$dst" 2>/dev/null || cp -r "$ROOT/$s" "$dst"; else ln -sfn "$ROOT/$s" "$dst"; fi
  done
  ok "Antigravity → $AG (si tu versión usa otra ruta, la skill radar la detecta)"
else
  warn "Antigravity: corre con --antigravity para enlazar skills (AGENTS.md lo lee sin hacer nada)"
fi

echo "Git hooks (calidad antes de cada commit):"
chmod +x .githooks/* toolbox/hooks/scout-hint.mjs scripts/*.sh 2>/dev/null || true
git config core.hooksPath .githooks
# en Windows git no guarda el bit de ejecución: lo marcamos para quienes clonen en Linux/macOS
for f in scripts/*.sh .githooks/* toolbox/hooks/*.mjs; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 && git update-index --chmod=+x "$f"
done
ok "pre-commit (secretos, tsc, ruff) y commit-msg (convencional)"

echo "Recordatorios scout/radar:"
node toolbox/hooks/scout-hint.mjs "prueba" >/dev/null && ok "scout-hint.mjs ejecuta"

echo "gitignore:"
for l in ".claude/.scout-state.json" ".claude/settings.local.json" ".claude/skills"; do
  grep -qxF "$l" .gitignore || echo "$l" >> .gitignore
done
ok "estado local y enlaces ignorados"
echo "Listo. Abre 'claude' y revisa /hooks y /mcp."
