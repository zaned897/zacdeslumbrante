---
name: orchestrate
description: Lleva una idea de issue a PR fusionado con varios agentes (Claude Code, Codex, Antigravity), cada uno en su zona. Úsala al empezar cualquier feature que toque más de una zona o tome más de una sesión.
---

# Orquestar: de la idea al merge

Principios: todo nace de una issue, cada entrega tiene un nivel (`prototype-scope`), especificación antes que código, cada agente en su zona y worktree, revisión por un modelo de otro proveedor, evidencia en vez de opiniones.

## 0. Encaje (2 min)
- ¿Cambia la UI? Primero `design-first`: mock aprobado en el artefacto y issue con `status:ready`. Sin eso no hay código.
- ¿Hay issue? Si no, créala con `gh-issues` (con el sí del usuario). Si es grande, issue padre + hijas.
- Nivel: sketch, mock, demo o PoC. Escríbelo.
- ¿Necesita algo fuera de `toolbox/capabilities.json`? `scout` antes de seguir.
- Modelos según `toolbox/models.md`.

## 1. Mini-spec (modelo fuerte)
En la propia issue o en `docs/specs/<issue>-<tema>.md`: objetivo de usuario, criterios de aceptación verificables, contrato (endpoints en `docs/API.md` → Propuestas), zonas, fuera de alcance. Media página para mock/sketch; una página para demo/PoC.

## 2. Revisión del plan (otro proveedor)
Solo para demo y PoC: pide a otro proveedor que ataque la spec (`/codex:adversarial-review` o `python tools/agentes/delegar.py codex --modo plan "revisa docs/specs/<archivo>"`). Una ronda, máximo dos.

## 3. Tareas
≤ ~300 líneas de diff cada una, con dueño y criterio de hecho. Dos tareas que tocan el mismo archivo no van en paralelo. Lo que un externo podría hacer solo → issue `good first issue` en lugar de hacerlo tú.

## 4. Ejecutar en paralelo
- `scripts/worktrees.sh <nivel>/<issue>-<tema-back> <nivel>/<issue>-<tema-front>`.
- Backend: Claude Code (subagentes de `.claude/agents/`). Datos mock: subagente barato.
- Frontend: el agente de frontend (p. ej. Antigravity) contra el contrato y los mocks.
- Antes de abrir PRs en paralelo, sigue `parallel-prs` (reparto de archivos, nada apilado sin plan).
- Bloqueos → `docs/HANDOFF.md`.

## 5. Verificar
Checks del nivel (`prototype-scope`): lint siempre; smoke test en demo; evidencia en PoC. Captura o gif para cualquier cambio visual.

## 6. PR y merge
PR con la plantilla (nivel, `Closes #n`, cómo correrlo, evidencia, `PROTO:`). `python tools/agentes/delegar.py review` (o `/codex:review --base main` con el plugin de Codex). Corrige altos y medios. Avisa al dueño que está listo; él revisa y fusiona con CI en verde. Después actualiza los PRs hermanos contra main (`parallel-prs`).

## 7. Cierre
- `docs/API.md`: de Propuesta a vigente.
- En el artefacto de diseño, la captura real reemplaza a la ilustración.
- Comenta en la issue y **propón** la issue del siguiente nivel (`gh-issues`, con el sí del usuario).
- Ideas nuevas que no tocan ahora → `parked` en `toolbox/capabilities.json`.

## Relacionadas
`design-first`, `prototype-scope`, `gh-issues`, `parallel-prs`, `delegar`, `relay`
