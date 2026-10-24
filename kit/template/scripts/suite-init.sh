#!/usr/bin/env bash
# Conecta la suite a los agentes y activa los git hooks. No instala herramientas extra (eso lo decide scout).
# Uso: ./scripts/suite-init.sh [--antigravity]
# Windows: correr en Git Bash con Modo de desarrollador activo (symlinks sin admin).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
ok(){ printf '  ✓ %s\n' "$1"; }; warn(){ printf '  ! %s\n' "$1"; }
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WIN=1; export MSYS=winsymlinks:nativestrict ;; *) WIN=0 ;; esac

link(){ rm -rf "$2"; ln -s "$1" "$2" 2>/dev/null && return 0
  cp -r "$(cd "$(dirname "$2")" && cd "$1" && pwd)" "$2"; warn "copié en vez de enlazar $2 (activa Modo de desarrollador)"; }

echo "Herramientas:"
for c in git node gh claude codex; do command -v "$c" >/dev/null && ok "$c" || warn "$c no encontrado"; done

echo "Skills compartidas (.agents/skills):"
mkdir -p .claude
[ -L .claude/skills ] || link ../.agents/skills .claude/skills
ok "Claude Code → .claude/skills"; ok "Codex → .agents/skills (lo lee directo)"
if [ "${1:-}" = "--antigravity" ]; then
  AG="$HOME/.gemini/antigravity-cli/skills"; mkdir -p "$AG"   # PROTO: ruta de la versión probada; radar la re-verifica
  for s in .agents/skills/*/; do n="$(basename "$s")"; dst="$AG/$(basename "$ROOT")-$n"
    if [ "$WIN" = 1 ]; then rm -rf "$dst"; ln -s "$ROOT/$s" "$dst" 2>/dev/null || cp -r "$ROOT/$s" "$dst"; else ln -sfn "$ROOT/$s" "$dst"; fi; done
  ok "Antigravity → $AG"
fi

echo "Git hooks:"
chmod +x .githooks/* toolbox/hooks/*.mjs scripts/*.sh 2>/dev/null || true
git config core.hooksPath .githooks
for f in scripts/*.sh .githooks/* toolbox/hooks/*.mjs; do git ls-files --error-unmatch "$f" >/dev/null 2>&1 && git update-index --chmod=+x "$f"; done
ok "pre-commit (secretos + scripts/check.sh) y commit-msg (convencional)"

node toolbox/hooks/scout-hint.mjs "prueba" >/dev/null && ok "scout-hint.mjs ejecuta"
for l in ".claude/.scout-state.json" ".claude/settings.local.json" ".claude/skills" ".env" ".env.*" "!.env.example"; do
  grep -qxF -- "$l" .gitignore 2>/dev/null || echo "$l" >> .gitignore; done
ok ".gitignore al día"
echo "Listo. Abre 'claude' y revisa /hooks y /mcp. Luego: ./scripts/gh-labels.sh"
