# Instalación por etapas (v5)

Versión en texto del runbook. La versión con diagramas, resultados esperados y casillas de avance está en `docs/atlas.html` (ábrelo en el navegador). Cada etapa termina con una prueba: `./scripts/verify.sh <etapa>`. **No avances si aparece ✗**; el propio script dice cómo arreglarlo.

Dónde va cada comando: PowerShell solo en la etapa 1; lo demás en Warp con Git Bash, salvo lo marcado *dentro de claude*.

| # | Etapa | Tiempo | Prueba |
|---|---|---|---|
| 0 | Seguridad: rotar la llave de Maps expuesta | 5 min | manual; automática en la 3 |
| 1 | Herramientas | 20 min | `bash /c/dev/suite-v5/scripts/verify.sh 1` |
| 2 | Cuentas | 10 min | `… verify.sh 2` |
| 3 | Repositorio | 10 min | `./scripts/verify.sh 3` |
| 4 | Suite | 5 min | `./scripts/verify.sh 4` + barreras a mano |
| 5 | Agentes y MCP | 20 min | `./scripts/verify.sh 5` + 7 pruebas por agente |
| 6 | GitHub abierto a contribuciones | 10 min | `./scripts/verify.sh 6` |
| 7 | Backend Python (primera issue real) | 30–45 min | `./scripts/verify.sh 7` + curl de punta a punta |
| 8 | Ensayo general | 45–60 min | `./scripts/verify.sh` (todo, 0 ✗) |

## 0 · Seguridad
1. Google Cloud → Credenciales: crea una llave nueva restringida (referentes `http://localhost:*/*`, solo Maps JavaScript API) y desactiva la vieja (`AIzaSyCxLb…`).
2. En `.env.example`: `VITE_MAPS_API_KEY="MY_MAPS_API_KEY"`. La real solo en `.env`.

## 1 · Herramientas
1. Descomprime la suite en `C:\dev\suite-v5`.
2. PowerShell (no admin): `cd C:\dev\suite-v5; Set-ExecutionPolicy -Scope Process Bypass; .\scripts\windows-bootstrap.ps1`
3. Configuración → Sistema → Para programadores → Modo de desarrollador.
4. Instala Antigravity (antigravity.google).
5. Warp: shell por defecto Git Bash; pestañas verticales. Reinicia Warp.

## 2 · Cuentas
`claude` (login, `/exit`) · `codex login` · `gh auth login` · `git config --global user.name/user.email`.

## 3 · Repositorio
```bash
mkdir -p /c/dev && cd /c/dev && gh repo clone zaned897/zacdeslumbrante && cd zacdeslumbrante
cp -r /c/dev/suite-v5/. .
cp .env.example .env && notepad .env
bun install
```
Manual: `bun run dev` → http://localhost:3000 carga con mapa.

## 4 · Suite
```bash
./scripts/suite-init.sh --antigravity
git add -A && git commit -m "chore: suite multiagente v5" && git push
```
Manual: `git commit --allow-empty -m "prueba"` debe ser rechazado.

## 5 · Agentes y MCP
- `claude` en la raíz → aprueba Context7 y Playwright.
- *dentro de claude:* `Install this MCP server: https://github.com/DeusData/codebase-memory-mcp` → reinicia → `Index this project`.
- *dentro de claude:* `/plugin marketplace add openai/codex-plugin-cc` y `/plugin install codex@openai-codex`.
- Antigravity → Open Folder → `C:\dev\zacdeslumbrante`.
- Warp: 4 pestañas (claude · dev.sh · codex · main) guardadas.
Manual: `/mcp` (3 en verde), `/hooks`, «quiero diseñar avatares» → aviso [scout], `/codex:review` responde, Antigravity dice qué archivos puede editar.

## 6 · GitHub
`./scripts/gh-labels.sh` · crea `LICENSE` desde GitHub (MIT) · espera CI verde.
Manual: *New issue* muestra 3 plantillas.

## 7 · Backend Python
*dentro de claude:* «Con la skill gh-issues, crea una issue [poc] para levantar el servicio Python en services/api con GET /health, el proxy /api/py en server.ts, el script dev:py y la sección Python en docs/API.md.» → «sí» → «Usa orchestrate para implementar la issue #N.» → revisa y mergea el PR → `git switch main && git pull`.
Manual: `./scripts/dev.sh` y `curl localhost:3000/api/py/health` → `{"status":"ok"}`; sin Python → 503.

## 8 · Ensayo general
Issue [mock] de eventos (API + tarjeta con badge «Demo») → `./scripts/worktrees.sh mock/N-eventos-api mock/N-eventos-ui` → Claude en `-back`, Antigravity en `-front` → relevo a propósito a Codex con `relay` → reviews cruzadas, 2 PRs, CI, merge → `git worktree remove …`.
Prueba final: `./scripts/verify.sh` con **0 ✗**.
