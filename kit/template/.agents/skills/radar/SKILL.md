---
name: radar
description: Revisa novedades de modelos, de Claude Code, Codex y Antigravity, y de las herramientas instaladas, y actualiza toolbox/models.md. Úsala cuando el hook diga que models.md está vencido, al empezar una fase nueva del proyecto, o cuando el usuario pregunte qué hay de nuevo.
---

# Radar: mantener la suite al día

1. Lee `toolbox/models.md` (fecha de verificación) y `toolbox/capabilities.json`.
2. Busca en la web, solo desde la fecha de verificación:
   - Modelos nuevos o retirados de Anthropic, OpenAI y Google, y rankings independientes de código (agentes en terminal, frontend, contexto largo, costo por tarea). Desconfía de benchmarks reportados solo por el fabricante; anótalo.
   - Changelogs de Claude Code, Codex CLI y Antigravity: features que reemplacen algo instalado o que ahorren tokens (p. ej. carga diferida de tools, nuevos modos de esfuerzo, agentes en paralelo nativos).
   - Para cada entrada de `installed`: ¿sigue mantenida? ¿hay una opción oficial que la reemplace?
3. Reporta en máximo 10 líneas: qué cambió, qué recomiendas cambiar en el routing y qué quitar/instalar (instalar pasa por `scout`).
4. Con el sí del usuario, actualiza la tabla y la fecha `verificado:` de `toolbox/models.md` y agrega una línea a `toolbox/decisions.md`.

No cambies el routing por un solo benchmark; pide al menos dos señales o una prueba propia en este repo.

## Relacionadas
`scout`
