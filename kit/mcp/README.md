# MCP, plugins y conectores

Regla: **skill > MCP > plugin** cuando las tres sirvan. Las skills solo cargan su descripción hasta usarse; un MCP carga todas sus tools al contexto. Todo lo instalado se anota en `toolbox/capabilities.json` (skill `scout`).

## Por proyecto (van en el repo)
`.mcp.json` en la raíz, para Claude Code. Sin llaves: si un servidor necesita una, se lee de una variable de entorno (`"env": {"X_API_KEY": "${X_API_KEY}"}`).

| Servidor | Para qué | Costo en contexto |
|---|---|---|
| Context7 | Docs actualizadas de librerías | bajo |
| Playwright | Navegador, capturas, verificar UI | medio |

## Por usuario (una vez por máquina, no van en el repo)
| Pieza | Cómo | Para qué |
|---|---|---|
| codebase-memory | dentro de `claude`: `Install this MCP server: https://github.com/DeusData/codebase-memory-mcp`, reinicia y `Index this project` | Mapa del código; ahorra leer archivos completos |
| Plugin de Codex | `/plugin marketplace add openai/codex-plugin-cc` y `/plugin install codex@openai-codex` | `/codex:review --base main` y review adversarial desde Claude |

## Codex
`~/.codex/config.toml`, mismo servidor de docs para que ambos agentes vean lo mismo:
```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
```
Codex lee `AGENTS.md` y `.agents/skills/` del repo sin configuración extra.

## Agente de frontend (Antigravity u otro)
Lee `AGENTS.md` solo. Las skills se enlazan con `./scripts/suite-init.sh --antigravity`. Los MCP se agregan desde su panel; la ruta exacta cambia entre versiones, así que `radar` la re-verifica.

## Conectores en claude.ai (proyectos en la nube)
Se activan en la cuenta, no en el repo: **GitHub** (issues, PRs, CI), **Google Drive** (notas y transcripciones de reuniones o talleres), **Claude Docs** (planes y memos editables). Si un hilo necesita uno que falta, lo pide con la tarjeta de conectores en vez de pedir llaves.
