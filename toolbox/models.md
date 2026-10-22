# Routing de modelos y agentes

verificado: 2026-10-21 · re-verificar con `radar` cuando pasen 30 días (el hook te avisa)

Los rankings cambian cada pocos meses y casi todos los benchmarks son reportados por el propio fabricante. Esta tabla es un punto de partida, no una verdad fija.

## Evidencia (octubre 2026)
| Señal | Líder | Fuente |
|---|---|---|
| Agentes en terminal (Terminal-Bench 4.0) | Claude Sonnet 5.5 70.6%, Opus 5.5 66.4% | Morph, 2026-10-10 |
| WebDev Arena | Claude Opus 5.5 | FelloAI, oct 2026 |
| Frontend Code Arena | GPT-6 Astra | Morph, 2026-10-10 |
| Contexto largo (1M) | Gemini 4 Argon, Sonnet 5.5 | FelloAI |
| Barato para subagentes | Claude Haiku 5.5, GPT-6 Luna | FelloAI / Morph |
| Imágenes | ChatGPT Images 2.5 | FelloAI |
| 3D / gráficos | **sin ranking confiable** | — |

Nota: no hay evidencia sólida de que un modelo sea "el mejor en 3D". Si llega ese momento, `scout` lo prueba con una tarea pequeña en 2 modelos antes de elegir.

## Routing inicial
| Paso | Agente | Modelo / esfuerzo | Por qué |
|---|---|---|---|
| Spec y plan | Claude Code | Opus 5.5, esfuerzo alto | Mejor razonamiento en tareas largas |
| Review del plan | Codex | modelo por defecto (GPT-6.1 Sol) | Otro proveedor = errores no correlacionados |
| Backend / multiarchivo | Claude Code | Sonnet 5.5 (default), Opus si es largo | Líder en terminal, más barato |
| Frontend / UI | Antigravity | el que ofrezca su panel; comparar con Codex GPT-6 Astra si la UI no convence | Su navegador verifica lo que construye |
| Exploración, datos, búsquedas | subagentes | Haiku 5.5 | 20–40× más barato |
| Barrido de todo el repo / docs enormes | Antigravity | Gemini (contexto 1M) | Contexto largo |
| Code review | Codex | default | Revisor independiente |
| Imágenes / iconos | (parked) | ChatGPT Images u otro, vía scout | Solo cuando se decida |

## Presupuesto con tus planes (Claude Pro · ChatGPT Plus · Antigravity gratis)
| Agente | Uso | Ajuste |
|---|---|---|
| Claude Code (Pro) | 1 sesión a la vez. Sonnet por defecto; Opus solo para specs de demo/PoC si tu plan lo ofrece (`/model`) | Subagentes con Haiku. `/clear` entre issues |
| Codex (Plus) | Revisor de diffs + relevo de backend cuando Claude se quede sin cuota | Review solo con `--base main`; sin review gate automático |
| Antigravity (gratis) | Frontend en ráfagas; límite semanal | Tareas de UI bien especificadas para no gastar en idas y vueltas |
Paralelo máximo: 2 constructores (Claude backend + Antigravity frontend) y Codex revisando. Al agotarse uno: skill `relay`.

## Reglas de ahorro
- El modelo caro planea; el barato ejecuta lo bien especificado.
- Subagentes para todo lo que sea "buscar y resumir": devuelven conclusiones, no archivos.
- Review solo sobre el diff (`--base main`), nunca sobre todo el repo.
- `/clear` al cambiar de tarea; `/compact` en tareas largas.
