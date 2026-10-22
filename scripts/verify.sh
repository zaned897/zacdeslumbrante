#!/usr/bin/env bash
# Pruebas del setup por etapas. Uso:
#   ./scripts/verify.sh          todas las etapas
#   ./scripts/verify.sh 3        solo la etapa 3
#   ./scripts/verify.sh 1-5      rango
# Etapas: 1 herramientas · 2 cuentas · 3 repo · 4 suite · 5 agentes y MCP · 6 GitHub · 7 Python · 8 flujo
# Guía visual con el resultado esperado de cada etapa: docs/atlas.html (o el artifact "Atlas Zacdeslumbrante")
# Resultado: ✓ pasa · ✗ falla (con arreglo) · ~ aviso/manual · – omitido. Sale con código 1 si hubo fallas.
set -uo pipefail

P=0; F=0; W=0
pass(){ printf '  \033[32m✓\033[0m %s\n' "$1"; P=$((P+1)); }
fail(){ printf '  \033[31m✗\033[0m %s\n      → %s\n' "$1" "$2"; F=$((F+1)); }
warn(){ printf '  \033[33m~\033[0m %s\n' "$1"; W=$((W+1)); }
skip(){ printf '  – %s\n' "$1"; }
has(){ command -v "$1" >/dev/null 2>&1; }
head_(){ printf '\n\033[1m[%s] %s\033[0m\n' "$1" "$2"; }

RANGE="${1:-1-8}"; FROM="${RANGE%-*}"; TO="${RANGE#*-}"
run(){ [ "$1" -ge "$FROM" ] && [ "$1" -le "$TO" ]; }
IS_WIN=0; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) IS_WIN=1;; esac
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
. "$ROOT/scripts/lib-ports.sh" 2>/dev/null || free_port(){ :; }

# ---------------------------------------------------------------- 1
if run 1; then head_ 1 "Herramientas instaladas"
  for c in git node bun uv gh claude codex; do
    if has "$c"; then pass "$c $("$c" --version 2>/dev/null | head -1 | grep -oE '[0-9]+(\.[0-9]+)+' | head -1)"
    else fail "$c no encontrado" "corre scripts/windows-bootstrap.ps1 o instálalo (WORKSTATION.md §1)"; fi
  done
  if has node; then
    NV=$(node -p 'process.versions.node.split(".")[0]')
    [ "$NV" -ge 20 ] && pass "Node ≥ 20" || fail "Node $NV es viejo" "winget upgrade OpenJS.NodeJS.LTS"
  fi
  has agy && pass "Antigravity CLI (agy)" || warn "agy no está en PATH (normal si solo usas el IDE de Antigravity)"
  has codebase-memory-mcp && pass "codebase-memory-mcp" || warn "codebase-memory-mcp aún no instalado (etapa 5)"
  { [ "$(git config --global core.longpaths)" = "true" ] || [ $IS_WIN = 0 ]; } && pass "git core.longpaths" || fail "git core.longpaths apagado" "git config --global core.longpaths true"
  if [ $IS_WIN = 1 ]; then
    reg query 'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' //v AllowDevelopmentWithoutDevLicense 2>/dev/null | grep -q 0x1 \
      && pass "Modo de desarrollador (symlinks)" || fail "Modo de desarrollador apagado" "Configuración → Sistema → Para programadores"
    [ -n "${BASH_VERSION:-}" ] && pass "corriendo en Git Bash"
  fi
fi

# ---------------------------------------------------------------- 2
if run 2; then head_ 2 "Cuentas"
  has gh && { gh auth status >/dev/null 2>&1 && pass "GitHub: $(gh api user -q .login 2>/dev/null)" || fail "gh sin sesión" "gh auth login"; }
  has codex && { codex login status >/dev/null 2>&1 && pass "Codex con sesión" || fail "Codex sin sesión" "codex login"; }
  if [ -f "$HOME/.claude/.credentials.json" ] || [ -f "$HOME/.claude.json" ]; then pass "Claude Code configurado (confirma el login abriendo 'claude')"
  else fail "Claude Code sin configurar" "abre 'claude' una vez e inicia sesión"; fi
  git config user.email >/dev/null && pass "git user.email: $(git config user.email)" || fail "git sin identidad" 'git config --global user.name "Tu Nombre" && git config --global user.email tu@correo'
fi

# ---------------------------------------------------------------- 3
if run 3; then head_ 3 "Repositorio"
  cd "$ROOT"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 && pass "dentro de un repo git" || { fail "no es un repo git" "cd a la carpeta del clon"; }
  git remote get-url origin 2>/dev/null | grep -q zacdeslumbrante && pass "origin → $(git remote get-url origin)" || fail "origin no apunta a zacdeslumbrante" "git remote -v"
  case "$ROOT" in *OneDrive*|*" "*) fail "ruta con espacios u OneDrive: $ROOT" "mueve el repo a C:\\dev\\zacdeslumbrante";; *) pass "ruta limpia: $ROOT";; esac
  [ -f .gitattributes ] && pass ".gitattributes" || fail "falta .gitattributes" "descomprime la suite en la raíz"
  if git ls-files --eol 2>/dev/null | grep -E '\.(sh|mjs)$|githooks/' | grep -q 'w/crlf'; then fail "scripts con CRLF" "git add --renormalize . && git checkout -- ."; else pass "scripts con finales LF"; fi
  [ -f .env ] && pass ".env existe" || fail "falta .env" "cp .env.example .env y pon tus llaves"
  if grep -qE 'AIza[0-9A-Za-z_-]{35}' .env.example 2>/dev/null; then fail "llave real en .env.example" "rota la llave en Google Cloud y deja un placeholder (Fase 0)"; else pass ".env.example sin llaves reales"; fi
  git check-ignore -q .env && pass ".env ignorado por git" || fail ".env no está ignorado" "agrega .env* a .gitignore"
  [ -d node_modules ] && pass "dependencias instaladas" || fail "sin node_modules" "bun install"
  if has bun && [ -d node_modules ]; then bun run --silent lint >/dev/null 2>&1 && pass "bun run lint (tsc) en verde" || fail "tsc con errores" "bun run lint"; fi
fi

# ---------------------------------------------------------------- 4
if run 4; then head_ 4 "Suite"
  cd "$ROOT"
  for f in AGENTS.md CLAUDE.md .mcp.json .claude/settings.json toolbox/capabilities.json toolbox/models.md toolbox/hooks/scout-hint.mjs; do
    [ -f "$f" ] && pass "$f" || fail "falta $f" "descomprime la suite en la raíz"; done
  n=$(ls .agents/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" -ge 8 ] && pass "$n skills en .agents/skills" || fail "solo $n skills" "descomprime la suite completa"
  if [ -L .claude/skills ] && [ -f .claude/skills/scout/SKILL.md ]; then pass "Claude Code ve las skills (symlink)"
  elif [ -f .claude/skills/scout/SKILL.md ]; then warn "skills copiadas, no enlazadas: activa Modo de desarrollador y corre suite-init.sh"
  else fail "Claude Code no ve las skills" "./scripts/suite-init.sh"; fi
  nx=$(git ls-files -s scripts/*.sh .githooks/* toolbox/hooks/*.mjs 2>/dev/null | grep -c '^100644')
  [ "$nx" = 0 ] && pass "scripts ejecutables en git (Linux/macOS de contribuidores)" || fail "$nx scripts sin permiso de ejecución en git" "./scripts/suite-init.sh y luego commit"
  [ "$(git config core.hooksPath)" = ".githooks" ] && pass "git hooks activos" || fail "git hooks inactivos" "./scripts/suite-init.sh"
  T=$(mktemp); echo "agrega cosas" > "$T"
  bash .githooks/commit-msg "$T" >/dev/null 2>&1 && fail "commit-msg acepta mensajes no convencionales" "revisa .githooks/commit-msg" || pass "commit-msg rechaza 'agrega cosas'"
  echo "feat(api): eventos mock (#12)" > "$T"
  bash .githooks/commit-msg "$T" >/dev/null 2>&1 && pass "commit-msg acepta 'feat(api): eventos mock (#12)'" || fail "commit-msg rechaza un mensaje válido" "revisa .githooks/commit-msg"
  rm -f "$T"
  S=.claude/.scout-state.json; B=""; [ -f "$S" ] && B=$(cat "$S"); rm -f "$S"
  out=$(echo '{"prompt":"quiero avatares para el mapa"}' | node toolbox/hooks/scout-hint.mjs 2>&1)
  if [ -n "$B" ]; then echo "$B" > "$S"; else rm -f "$S"; fi
  echo "$out" | grep -q '\[scout\]' && pass "hook scout detecta ideas parked ('avatares')" || fail "hook scout no responde" "node toolbox/hooks/scout-hint.mjs \"avatares\""
  node -e 'JSON.parse(require("fs").readFileSync(".claude/settings.json"))' 2>/dev/null && grep -q UserPromptSubmit .claude/settings.json && pass "hook registrado en .claude/settings.json" || fail "settings.json inválido" "restaura desde la suite"
  ls "$HOME/.gemini/antigravity-cli/skills" 2>/dev/null | grep -q "$(basename "$ROOT")-scout" && pass "skills enlazadas para Antigravity" || warn "skills no enlazadas a Antigravity (./scripts/suite-init.sh --antigravity)"
fi

# ---------------------------------------------------------------- 5
if run 5; then head_ 5 "Agentes y MCP"
  cd "$ROOT"
  if has claude; then
    L=$(timeout 60 claude mcp list 2>/dev/null)
    for m in context7 playwright codebase-memory; do
      echo "$L" | grep -qi "$m" && pass "MCP $m registrado" || fail "MCP $m no registrado" "abre 'claude' en el repo y apruébalo / instálalo (etapa 5)"; done
    echo "$L" | grep -qiE 'failed|✗' && warn "algún MCP no conecta: revisa con /mcp dentro de claude"
  else skip "claude no instalado"; fi
  ls -d "$HOME"/.claude/plugins/*/*codex* "$HOME"/.claude/plugins/*codex* >/dev/null 2>&1 \
    && pass "plugin de Codex presente" || warn "no detecto el plugin de Codex: prueba /codex:review dentro de claude"
  ls "$HOME/.cache/codebase-memory-mcp" 2>/dev/null | grep -q . \
    && pass "codebase-memory tiene índice" || warn "proyecto sin indexar: dentro de claude di 'Index this project'"
  warn "manual: en 'claude' escribe 'diseña avatares' → debe aparecer el aviso [scout]"
  warn "manual: en 'claude' corre /codex:review → debe responder Codex"
fi

# ---------------------------------------------------------------- 6
if run 6; then head_ 6 "GitHub"
  cd "$ROOT"
  if has gh && gh auth status >/dev/null 2>&1; then
    gh label list --limit 100 2>/dev/null | grep -q 'level:mock' && pass "etiquetas creadas" || fail "faltan etiquetas" "./scripts/gh-labels.sh"
    if git ls-remote --exit-code origin main >/dev/null 2>&1 && git cat-file -e origin/main:.github/ISSUE_TEMPLATE/prototype.yml 2>/dev/null; then pass "plantillas de issue publicadas"
    else fail "plantillas no están en origin/main" "git push (y git fetch)"; fi
    gh workflow list 2>/dev/null | grep -q CI && pass "workflow CI registrado" || warn "CI aún no aparece (sube .github/workflows y espera el primer push)"
    R=$(gh run list --workflow CI --limit 1 --json conclusion -q '.[0].conclusion' 2>/dev/null)
    [ "$R" = "success" ] && pass "último CI en verde" || { [ -n "$R" ] && fail "último CI: $R" "gh run view --log-failed" || warn "CI sin ejecuciones aún"; }
    { [ -f LICENSE ] || git cat-file -e origin/main:LICENSE 2>/dev/null; } && pass "LICENSE" || warn "sin LICENSE: nadie puede reutilizar legalmente el código (elige una antes de invitar)"
    [ "$(gh repo view --json visibility -q .visibility 2>/dev/null)" = "PUBLIC" ] && pass "repo público (forks posibles)" || warn "repo no público"
  else skip "gh sin sesión (etapa 2)"; fi
fi

# ---------------------------------------------------------------- 7
if run 7; then head_ 7 "Backend Python"
  cd "$ROOT"
  if [ ! -f services/api/pyproject.toml ]; then skip "services/api aún no existe (se crea en la primera issue, etapa 7)"
  else
    (cd services/api && uv sync -q >/dev/null 2>&1) && pass "uv sync" || fail "uv sync falló" "cd services/api && uv sync"
    (cd services/api && uv run -q ruff check . >/dev/null 2>&1) && pass "ruff check" || fail "ruff encontró problemas" "cd services/api && uv run ruff check --fix ."
    (cd services/api && uv run -q ruff format --check . >/dev/null 2>&1) && pass "ruff format" || fail "formato pendiente" "cd services/api && uv run ruff format ."
    (cd services/api && uv run -q pytest -q >/dev/null 2>&1; s=$?; [ $s -eq 0 ] || [ $s -eq 5 ]) && pass "pytest" || fail "pytest falla" "cd services/api && uv run pytest"
    PY_PORT=8765
    (cd services/api && uv run -q uvicorn app.main:app --port $PY_PORT >/dev/null 2>&1) & UV=$!
    ok=0; for _ in $(seq 1 20); do curl -fs "localhost:$PY_PORT/health" >/dev/null 2>&1 && { ok=1; break; }; sleep 0.5; done
    [ $ok = 1 ] && pass "FastAPI responde /health" || fail "FastAPI no arranca" "cd services/api && uv run uvicorn app.main:app"
    kill $UV 2>/dev/null; free_port $PY_PORT
    grep -q '/api/py' server.ts && pass "proxy /api/py en server.ts" || fail "server.ts sin proxy /api/py" "issue de la etapa 7"
    grep -q '"dev:py"' package.json && pass "script dev:py" || fail "falta script dev:py" "ver skill python-backend"
  fi
fi

# ---------------------------------------------------------------- 8
if run 8; then head_ 8 "Flujo de trabajo"
  cd "$ROOT"
  git ls-files --error-unmatch AGENTS.md .agents/skills/scout/SKILL.md >/dev/null 2>&1 \
    && pass "suite incluida en git (los worktrees y forks la reciben)" \
    || fail "la suite no está en un commit" 'git add -A && git commit -m "chore: suite multiagente" && git push'
  WT="$(dirname "$ROOT")/.verify-wt-$$"
  if git worktree add --detach "$WT" HEAD >/dev/null 2>&1; then
    [ -f "$WT/package.json" ] && pass "worktrees funcionan" || fail "worktree incompleto" "git worktree list"
    git worktree remove --force "$WT" >/dev/null 2>&1
  else fail "no se pudo crear un worktree" "git worktree list; ¿cambios sin commit en conflicto?"; fi
  if [ -f scripts/dev.sh ] && has bun; then
    WP=3917; PORT=$WP PY_PORT=8766 timeout 40 bash scripts/dev.sh >/dev/null 2>&1 & D=$!
    ok=0; for _ in $(seq 1 40); do curl -fs "localhost:$WP/api/health" >/dev/null 2>&1 && { ok=1; break; }; sleep 0.75; done
    [ $ok = 1 ] && pass "dev.sh levanta la web (/api/health)" || fail "dev.sh no levanta la web" "./scripts/dev.sh y lee el error"
    if [ $ok = 1 ] && [ -f services/api/pyproject.toml ]; then
      sleep 2; curl -fs "localhost:$WP/api/py/health" >/dev/null 2>&1 && pass "web → proxy → Python OK" || fail "proxy /api/py no llega a Python" "revisa PY_API_URL y el proxy en server.ts"
    fi
    kill $D 2>/dev/null; wait $D 2>/dev/null; free_port $WP; free_port 8766
    sleep 1; curl -fs "localhost:$WP/api/health" >/dev/null 2>&1 && fail "el puerto $WP siguió ocupado tras detener dev.sh" "revisa scripts/lib-ports.sh" || pass "dev.sh libera los puertos al detenerse"
  fi
  B=$(git branch --show-current)
  echo "$B" | grep -qE '^(main|(sketch|mock|demo|poc)/[0-9]+-[a-z0-9-]+)$' && pass "rama con formato válido: $B" || warn "rama '$B' fuera del formato <nivel>/<issue>-<tema>"
fi

printf '\n\033[1mResultado:\033[0m %s ✓  %s ✗  %s ~\n' "$P" "$F" "$W"
[ "$F" -eq 0 ]
