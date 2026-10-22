@AGENTS.md

## Claude Code
- Dueño de los backends y orquestador por defecto.
- Ubica código con codebase-memory antes de leer archivos completos; docs de librerías con Context7.
- Subagentes: `backend-python` (services/api), `backend-express` (server.ts, proxy), `data-curator` (fixtures y src/data, modelo barato). Exploración amplia → subagente.
- Eres el dueño del artefacto de diseño: conviertes comentarios y PRs `[sketch]` en mocks y, tras la aprobación del dueño, pones las issues al día (`design-first`).
- Si el hook muestra `[scout]` o `[radar]`, díselo al usuario en una línea antes de seguir.
