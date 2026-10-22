# Integrar el kit en un proyecto que ya trabaja

Para un repo que ya tiene sus flujos (CI, convenciones, quizá un `CLAUDE.md`) y donde hoy solo trabaja Claude. La meta es sumar Codex y Antigravity sin romper nada. Todo va en una rama y un PR; nada se instala directo en `main`.

Idea central: los tres agentes se coordinan **por archivos del repo**. Claude lee `CLAUDE.md`, Codex lee `AGENTS.md` y `.agents/skills/`, Antigravity lee `AGENTS.md`. Así que el trabajo es mover las reglas comunes a `AGENTS.md` y las skills a `.agents/skills/`, y dejar a cada agente un puntero a ellos.

## 0. Preparar (5 min)
```bash
# el kit (mientras #94 no esté en main, desde su rama)
git clone --depth 1 -b claude/project-thread-qmbf3s https://github.com/zaned897/zacdeslumbrante /c/dev/kit-src
cd /c/dev/mi-proyecto && git switch -c chore/kit-multiagente
bash /c/dev/kit-src/kit/install.sh . --dry-run      # solo lista: + se copiaría, = ya existe
```
Lo marcado con `=` es lo que se mezcla a mano en los pasos siguientes. Lo marcado con `+` es nuevo y no choca con nada.

## 1. Inventario de lo que ya tienes (10 min)
Anota antes de copiar, porque el kit se adapta a esto y no al revés:

| Pregunta | Dónde mirar | Qué decide |
|---|---|---|
| ¿Cómo corres lint y tests? | `package.json`, `Makefile`, CI | Lo que pones en `scripts/check.sh` |
| ¿Hay hooks de git? | `git config core.hooksPath`, `.husky/`, `.pre-commit-config.yaml` | Si usas `.githooks/` del kit o no (ver paso 5) |
| ¿Convención de ramas y commits? | historial, `CONTRIBUTING.md`, commitlint | Si quitas o ajustas `commit-msg` |
| ¿Plantillas de issue/PR? | `.github/` | Mezclar campos, no reemplazar |
| ¿Tienes `CLAUDE.md` o `.claude/skills/`? | raíz | Paso 2 y 3 |
| ¿Quién toca qué carpeta? | estructura del repo | Zonas en `AGENTS.md` |

## 2. Reglas: `AGENTS.md` común + punteros (20 min)
1. Copia `kit/template/AGENTS.md` a la raíz y rellena los `{{…}}`.
2. Si ya tienes `CLAUDE.md`, **mueve a `AGENTS.md` todo lo que no sea exclusivo de Claude** (stack, comandos, convenciones, zonas). Deja en `CLAUDE.md` solo:
   ```markdown
   @AGENTS.md

   ## Claude Code
   - (lo exclusivo de Claude: subagentes, MCP, hooks)
   ```
   La línea `@AGENTS.md` hace que Claude cargue el archivo común, así no se duplican reglas.
3. **Zonas**: decide qué carpetas son de cada agente. Ejemplo típico: backend y orquestación → Claude Code; componentes de UI → Antigravity; Codex solo revisa y toma relevos. Si tu proyecto no se divide así, empieza con una sola zona y Codex como revisor; ya es una mejora.
4. Mantén `AGENTS.md` corto (< 60 líneas): se carga en cada sesión de los tres agentes.

Codex también lee `AGENTS.md` dentro de subcarpetas; úsalo solo si una carpeta tiene reglas muy propias.

## 3. Skills compartidas (15 min)
1. Elige solo las que tu flujo necesita. Orden sugerido para un proyecto que ya funciona:

   | Skill | Cuándo sumarla |
   |---|---|
   | `relay` | Siempre: es la que conecta Claude ↔ Codex ↔ Antigravity |
   | `parallel-prs` | En cuanto haya dos agentes o hilos a la vez |
   | `pr-intake` | Si revisas PRs (propios o de otros) |
   | `orchestrate` | Para features que tocan más de una zona |
   | `design-first` | Si hay UI y quieres el artefacto tipo Figma |
   | `scout`, `radar` | Cuando quieras controlar qué herramientas y modelos usar |
   | `prototype-scope`, `gh-issues` | Si trabajas por niveles y con issues para otros |

2. Ponlas en `.agents/skills/<nombre>/SKILL.md` (Codex las lee de ahí directo).
3. Si ya tenías skills en `.claude/skills/`, **muévelas a `.agents/skills/`** y luego corre `./scripts/suite-init.sh`, que deja `.claude/skills` como enlace a `.agents/skills`. Así Claude y Codex ven las mismas.
4. Antigravity: `./scripts/suite-init.sh --antigravity` enlaza las skills a su carpeta. Si tu versión no las detecta, basta con que `AGENTS.md` las nombre: el agente abre el `SKILL.md` cuando lo necesita.
5. Ajusta en cada skill las rutas y comandos que no apliquen (busca `docs/API.md`, `check.sh`, nombres de etiquetas).

## 4. Calidad: un solo punto (10 min)
- Edita `scripts/check.sh` para que llame a **tus** comandos actuales (por ejemplo `npm run lint && npm test`). Los agentes, el hook y la CI llaman a este script, así todos validan lo mismo.
- **CI**: si ya tienes workflows, no copies el `ci.yml` del kit. Como mucho agrega un paso `./scripts/check.sh` a tu workflow existente.

## 5. Git hooks: sin pisar los tuyos
- **Sin hooks hoy** → usa `.githooks/` del kit (`suite-init.sh` hace `git config core.hooksPath .githooks`).
- **Con husky o pre-commit** → no cambies `core.hooksPath`. Copia solo la parte de detección de secretos de `.githooks/pre-commit` a tu hook, y quita la línea `git config core.hooksPath` de `suite-init.sh`.
- **Con otra convención de commits** → edita la expresión regular de `.githooks/commit-msg` o no la uses.

## 6. Conectar los agentes (20 min, una vez por máquina)
| Agente | Pasos | Prueba |
|---|---|---|
| Claude Code | Abre `claude` en el repo, aprueba los MCP de `.mcp.json`. Instala el plugin de Codex: `/plugin marketplace add openai/codex-plugin-cc` y `/plugin install codex@openai-codex` | `/codex:review --base main` responde |
| Codex | `codex login`. Agrega Context7 en `~/.codex/config.toml` (ver `kit/mcp/README.md`) | Pregúntale «¿qué carpetas puedes editar?» y debe citar tus zonas |
| Antigravity | Abre la carpeta del repo (local, no WSL). Corre `suite-init.sh --antigravity` | La misma pregunta, debe responder su zona |

Si ya tienes un `.mcp.json`, solo agrega las entradas que falten; no lo reemplaces.

## 7. Archivos de coordinación (5 min)
- `docs/HANDOFF.md`: pedidos entre zonas, una línea cada uno.
- `toolbox/capabilities.json` y `toolbox/models.md`: anota lo que ya usa tu proyecto en `installed` y tus planes en `models.md`. Pon tu propia fecha.
- `docs/API.md` solo si hay contrato entre frontend y backend.
- `.claude/settings.json`: si ya tienes uno, **mezcla** el bloque `hooks.UserPromptSubmit` y los `deny` de `.env`; no lo reemplaces.

## 8. Probar el circuito completo (30 min)
1. Una issue pequeña y real.
2. Claude la empieza (`orchestrate`) y a la mitad haz un relevo a propósito: «usa relay para pasarle esto a Codex».
3. Codex continúa desde el relevo escrito en la issue.
4. Claude pide `/codex:review --base main` antes del PR.
5. Si hay UI, Antigravity hace su parte en otra rama (`scripts/worktrees.sh`).
6. Merge. Si algo falló, corrige la skill o `AGENTS.md`, no el agente.

## 9. Proyecto en claude.ai (5 min)
Pega `kit/project-instructions.md` (con tus datos) en las instrucciones del proyecto. Si tu proyecto ya tiene instrucciones, agrega solo las líneas de flujo, permisos y reglas que te falten.

## 10. Commit y PR
```bash
git add -A && git commit -m "chore: suite multiagente (AGENTS.md, skills compartidas, relevo)"
git push -u origin chore/kit-multiagente
```
Revisa en el PR que no se borró ni reemplazó nada tuyo (`git diff main --stat`).

## Qué no hacer
- No reemplazar tu CI, hooks o plantillas de golpe: se mezclan.
- No duplicar reglas en `CLAUDE.md` y `AGENTS.md`: una sola fuente.
- No poner dos agentes en la misma rama a la vez.
- No instalar MCP o plugins extra sin pasar por `scout`.
