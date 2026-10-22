# Estación de trabajo — Windows

Decisión base: **todo en Windows nativo, nada en WSL.** Antigravity 2.x aún no ejecuta agentes sobre carpetas de WSL, y Claude Code y Codex ya funcionan bien nativos. Git Bash da la compatibilidad con los scripts.

```
            ┌──────────── Warp (Git Bash) ────────────┐
 pestaña 1  │ claude      backend Python + orquestación │──┐
 pestaña 2  │ dev.sh      web :3000 + Python :8000      │  │ mismo repo,
 pestaña 3  │ codex       revisión / relevo             │  │ AGENTS.md y skills
 pestaña 4  │ main        git, gh, merges               │  │ compartidas
            └───────────────────────────────────────────┘  │
 Antigravity (IDE) — editor + agente frontend + navegador ──┘
 GitHub — issues, PRs, CI, forks
```

## 1. Instalar (una vez, ~20 min)
PowerShell normal, en la carpeta del repo o donde tengas el zip descomprimido:
```powershell
Set-ExecutionPolicy -Scope Process Bypass; .\scripts\windows-bootstrap.ps1
```
Instala con winget: Git (con Git Bash), Node LTS, GitHub CLI, uv, Bun, Warp; luego Claude Code (instalador nativo, se actualiza solo) y Codex. Configura git (finales de línea, rutas largas, symlinks).

Manual:
- **Modo de desarrollador:** Configuración → Sistema → Para programadores → activado (symlinks sin admin).
- **Antigravity:** instalador de Windows en antigravity.google.
- Reinicia la terminal.

## 2. Warp
- Settings → Features → Session → **Default shell: Git Bash**. Así `scripts/*.sh`, los hooks y `$CLAUDE_PROJECT_DIR` funcionan igual que en Linux/macOS.
- Settings → Appearance → Tabs → **vertical tabs**.
- Notificaciones de agentes activadas (te avisa cuando Claude o Codex esperan aprobación).
- El agente propio de Warp no hace falta (plan gratis). Ignora `⌘/Ctrl+Enter`.
- Crea las 4 pestañas del diagrama y guárdalas como Tab Config o Launch Configuration para abrirlas de un clic.

## 3. Cuentas
```bash
claude          # login con Claude Pro; /exit
codex login     # ChatGPT Plus
gh auth login   # GitHub, HTTPS, con navegador
```

## 4. Repo
Ponlo en una ruta corta sin espacios ni OneDrive: `C:\dev\zacdeslumbrante`.
```bash
mkdir -p /c/dev && cd /c/dev && git clone git@github.com:zaned897/zacdeslumbrante.git && cd zacdeslumbrante
# descomprime la suite en la raíz
./scripts/suite-init.sh --antigravity   # skills enlazadas + git hooks
./scripts/gh-labels.sh
cp .env.example .env                    # tus llaves reales (rota antes la de Maps)
bun install && ./scripts/dev.sh
```
Abre `C:\dev\zacdeslumbrante` en Antigravity (abrir carpeta local, no WSL).

## 5. Conectar los agentes
Los tres se conectan por **archivos compartidos**, no por un servidor central:

| Pieza | Qué conecta |
|---|---|
| `AGENTS.md` + `.agents/skills/` | Mismas reglas y métodos para los 3 |
| `docs/API.md` | Contrato backend ↔ frontend |
| Issues de GitHub | La tarea, su nivel y el historial de relevos |
| `docs/HANDOFF.md` / skill `relay` | Pasar trabajo entre agentes sin perder contexto |
| Plugin de Codex en Claude Code | Claude pide reviews a Codex sin cambiar de pestaña |
| Git hooks + CI | Mismo filtro de calidad para agentes y personas |

Dentro de `claude` (pestaña 1), una vez: aprobar MCPs (`/mcp`), instalar codebase-memory y el plugin de Codex como dice `SETUP.md` etapa 5. Comprueba `/hooks`.

Codex nativo: usa el sandbox de Windows por defecto. Si un comando falla por permisos, en `%USERPROFILE%\.codex\config.toml`:
```toml
[features]
prefer_mxc = true
[windows]
sandbox = "elevated"
```

## 6. Un ciclo típico
1. Pestaña 4: `gh issue list` → eliges la #12 (`level:mock`).
2. Pestaña 1 (Claude): *"usa orchestrate para la issue #12"*. Crea la spec, pide review del plan a Codex, divide tareas.
3. `./scripts/worktrees.sh mock/12-eventos-api mock/12-eventos-ui` → Claude sigue en `-back`; abres `-front` en Antigravity: *"usa orchestrate, tu parte de la issue #12"*.
4. Commit → los hooks frenan secretos, TS roto, ruff y mensajes no convencionales.
5. Claude: `/codex:review --base main` → corrige → `gh pr create` con la plantilla.
6. CI en verde → merge → `git worktree remove`.
7. ¿Se acabó la cuota de Claude? *"usa relay para pasarle esto a Codex"* y sigues en la pestaña 3.

## 7. Problemas comunes en Windows
| Síntoma | Arreglo |
|---|---|
| `\r: command not found` en un script | Finales CRLF: `git add --renormalize . && git checkout -- .` (el `.gitattributes` lo previene) |
| Skills copiadas en vez de enlazadas | Activa Modo de desarrollador y vuelve a correr `suite-init.sh` |
| El hook `[scout]` no aparece | Warp debe abrir Claude desde Git Bash; revisa `/hooks` |
| Rutas largas en `node_modules` | `git config --global core.longpaths true` (el bootstrap lo hace) |
| Puerto ocupado | `PORT=3001 ./scripts/dev.sh` |
