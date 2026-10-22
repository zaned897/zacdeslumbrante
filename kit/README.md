# Kit de trabajo multiagente

Lo que funcionó en este repo, sin nada de Zacatecas, para copiar a otro proyecto: reglas para agentes, skills, hooks, plantillas de GitHub, CI, MCP e instrucciones de proyecto.

## El flujo en una línea
**Diseño en un artefacto → aprobación → issues por nivel → un hilo y un PR por issue → review de otro proveedor → merge → captura real en el artefacto.**

## Qué trae
| Carpeta / archivo | Qué es |
|---|---|
| `template/` | Lo que se copia a la raíz del repo nuevo (ver tabla abajo) |
| `project-instructions.md` | Bloque para pegar en las instrucciones del proyecto en claude.ai |
| `mcp/` | `.mcp.json` base y cómo dar los mismos MCP a Codex y al agente de frontend |
| `LECCIONES.md` | Lo que salió mal y qué regla lo evita |
| `INTEGRAR.md` | Pasos para sumarlo a un proyecto que ya trabaja, sin romper sus flujos |
| `install.sh` | Copia `template/` a otro repo sin pisar archivos (`--dry-run` para ver antes) |

### `template/`
| Pieza | Para qué |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | Reglas cortas comunes a Claude Code, Codex y el agente de frontend: zonas, niveles, convenciones |
| `.agents/skills/` | 9 skills compartidas: `design-first`, `orchestrate`, `prototype-scope`, `gh-issues`, `pr-intake`, `parallel-prs`, `relay`, `scout`, `radar` |
| `.claude/` | Permisos (bloquea `.env`), hook `scout-hint` y dos subagentes de ejemplo |
| `toolbox/` | `capabilities.json` (instalado y aparcado con disparadores), `models.md` (routing), `decisions.md`, hook |
| `.githooks/` | pre-commit (llaves, `.env`, `scripts/check.sh`) y commit-msg (commits convencionales) |
| `.github/` | Plantillas de issue (prototipo con enlace al diseño, idea, bug), plantilla de PR y CI |
| `scripts/` | `check.sh` (punto único de calidad), `dev.sh`, `suite-init.sh`, `gh-labels.sh`, `worktrees.sh` |
| `docs/` | `API.md` (contrato) y `HANDOFF.md` (pedidos entre zonas) |
| `render.yaml.example` | Despliegue gratis con previews por PR |

## Instalar en otro repo
```bash
bash kit/install.sh ../mi-proyecto          # no sobrescribe nada que ya exista
cd ../mi-proyecto
grep -rn '{{' . --include='*.md' --include='*.json' --include='*.yml'   # rellena los marcadores
# edita scripts/check.sh y scripts/dev.sh para tu stack
./scripts/suite-init.sh                      # enlaza skills y activa hooks
./scripts/gh-labels.sh                       # etiquetas level:/area:/type:/status:
```
Luego, en claude.ai: crea el proyecto, pega `project-instructions.md`, conecta GitHub, y pide el primer artefacto de diseño («dame un adelanto de cómo se verá la app»). Pega su URL en `AGENTS.md` (`DESIGN_URL`) y en las instrucciones del proyecto.

En GitHub, activa **Settings → General → Automatically delete head branches** (ver `parallel-prs`).

## Skills en tu cuenta vs. en el repo
- **En el repo** (`.agents/skills/`): las lee cualquier agente que abra el repo, incluidos contribuidores externos. Aquí van las reglas del proyecto.
- **En tu cuenta de Claude**: te siguen a todos los proyectos. Conviene tener ahí `design-first`, `parallel-prs` y una para montar este kit; las demás pueden vivir solo en el repo.
