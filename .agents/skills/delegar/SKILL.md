---
name: delegar
description: Pasa una tarea acotada de Claude Code a Codex (OpenAI) o a Antigravity (agy, Google) con tools/agentes/delegar.py, o pide a Codex una segunda opinión del diff. Úsala cuando una tarea cabe en un párrafo y se puede comprobar (build, pruebas, captura), cuando convenga otra revisión antes del PR, o cuando el usuario pida usar Codex, Antigravity, agy o Gemini.
---

# Delegar a Codex y Antigravity

Guía completa: [tools/agentes/README.md](../../../tools/agentes/README.md)

## Regla central

> Claude es dueño de la tarea y del PR. Lo que devuelven Codex o agy es un diff
> de otro: se verifica, se prueba y luego se integra o se descarta.

## Quién hace qué

| Agente | Le toca | No le toca |
|---|---|---|
| Codex | Endpoints de `services/api/` con contrato en `docs/API.md`, pruebas que faltan, scripts, refactors mecánicos. Revisión del diff | El adelanto de diseño, issues y aprobaciones, datos reales del corpus |
| Antigravity (`agy`) | Su zona de frontend (`src/components/**`, `src/App.tsx`, `src/index.css`) desde una propuesta aprobada, leer documentos largos y resumirlos. Solo edita, no corre comandos | Todo lo que necesite correr build o pruebas |
| Claude | Diseño y decisiones, backends, flujo de diseño (`design-first`), issues, integrar y abrir PRs | — |

Delega solo si la tarea cabe en un párrafo y hay forma objetiva de saber si quedó.
Si dudas, no delegues.

## Cómo

```bash
python tools/agentes/delegar.py estado            # ¿hay codex/agy en esta máquina?
python tools/agentes/delegar.py codex "<tarea>"
python tools/agentes/delegar.py agy "<tarea>"     # --modo accept-edits|auto|plan
python tools/agentes/delegar.py review            # segunda opinión de Codex contra main
python tools/agentes/delegar.py limpiar           # quita worktrees y ramas delegar/*
```

1. El script crea un worktree en `.claude/worktrees/` con rama `delegar/...`.
2. Lee el resumen en `.claude/delegaciones/` y `git -C <worktree> diff HEAD`.
3. Prueba en el worktree: `bun run lint`, y en `services/api/` `uv run ruff check . && uv run pytest`; si toca UI, captura.
4. Trae lo que sirva (`git -C <worktree> diff HEAD --binary | git apply`) y descarta el resto.
5. `python tools/agentes/delegar.py limpiar`.

Códigos: `0` terminó, `2` falta la CLI, `3` se pasó del tiempo, `4` agy no trabajó
porque el modo headless le negó un permiso. Con 2 o 4 dilo, haz la tarea tú y nunca
digas que se delegó.

Las CLIs solo existen en la PC del usuario. En una sesión en la nube de claude.ai
`estado` dirá que no hay ninguna: es lo esperado.

## Hook de revisión de Codex

Hook `Stop` en `.claude/settings.json`, activo solo con `CODEX_REVIEW=1`. Revisa cada
estado del diff una sola vez. Sus hallazgos son pistas que se verifican, no órdenes.
