# Routing de modelos y agentes

verificado: {{FECHA}} · re-verificar con `radar` cuando pasen 30 días (el hook te avisa)

Punto de partida, no verdad fija. Los benchmarks de fabricante valen poco: pide dos señales o una prueba propia.

## Routing
| Paso | Agente | Modelo / esfuerzo | Por qué |
|---|---|---|---|
| Diseño, spec y plan | Claude | el más fuerte, esfuerzo alto | Razonamiento en tareas largas |
| Review del plan y del diff | Codex | default | Otro proveedor = errores no correlacionados |
| Backend / multiarchivo | Claude Code | modelo medio por defecto | Buen equilibrio costo/calidad |
| Frontend / UI | {{AGENTE_FRONTEND}} | el de su panel | Verifica en su navegador |
| Explorar, buscar, datos | subagentes | el más barato | 20–40× más barato |

## Presupuesto con tus planes
| Agente | Plan | Uso |
|---|---|---|
| Claude Code | {{PLAN}} | 1 sesión a la vez; subagentes baratos; `/clear` entre issues |
| Codex | {{PLAN}} | Revisor + relevo cuando Claude se queda sin cuota |
| {{AGENTE_FRONTEND}} | {{PLAN}} | Frontend en ráfagas bien especificadas |

## Reglas de ahorro
- El modelo caro planea; el barato ejecuta lo bien especificado.
- Subagentes para "buscar y resumir": devuelven conclusiones, no archivos.
- Review solo sobre el diff (`--base main`).
