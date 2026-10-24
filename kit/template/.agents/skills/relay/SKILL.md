---
name: relay
description: Pasa una tarea en curso de un agente a otro (Claude Code, Codex, Antigravity) sin perder contexto. Úsala cuando un agente se quede sin cuota, cuando cambie el rol (implementar → revisar) o al cerrar la sesión con trabajo a medias. También al recibir una tarea de otro agente.
---
# Relevo entre agentes

Los tres agentes comparten `AGENTS.md`, las skills y el repo; lo único que no comparten es la memoria de la conversación. Este relevo la pone por escrito.

## Entregar (agente que sale)
1. Commit de lo hecho, aunque esté a medias: `proto: wip <tema> (#issue)` y `git push`.
2. Comenta en la issue (`gh issue comment <n> --body-file -`), o si no hay issue en `docs/HANDOFF.md`:
   ```
   ## Relevo <fecha> · <agente que sale> → <agente que entra>
   Rama: <rama> · último commit: <sha corto>
   Hecho: <viñetas>
   Falta: <viñetas en orden, la primera debe poder empezarse ya>
   Decisiones tomadas y por qué: <viñetas>
   Cómo verificar: <comando o URL>
   Cuidado con: <trampas, archivos frágiles>
   ```
3. Máximo ~20 líneas: es para que el siguiente no relea todo.

## Recibir (agente que entra)
1. `git fetch && git switch <rama>` (o el worktree correspondiente).
2. Lee el último relevo y la issue; no reexplores el repo completo (usa codebase-memory si hace falta).
3. Corre "Cómo verificar" antes de tocar nada.
4. Continúa con el primer punto de "Falta".

## Reglas de cuota (ajusta a tus planes en `toolbox/models.md`)
- Claude se queda sin cuota → Codex continúa el backend con este relevo; la revisión de ese tramo la hace Claude cuando vuelva (otro proveedor revisa siempre).
- El agente de frontend se queda sin cuota → el frontend pasa a Codex o espera; no lo tome Claude si está en backend al mismo tiempo.
- Nunca dos agentes en la misma rama a la vez.
