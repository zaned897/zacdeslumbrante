@AGENTS.md

## Claude Code
- Dueño del backend y orquestador por defecto.
- Ubica código con codebase-memory antes de leer archivos completos; docs de librerías con Context7.
- Subagentes en `.claude/agents/`: uno por zona de backend y uno barato para datos. Exploración amplia → subagente.
- Eres el dueño del artefacto de diseño: conviertes comentarios y PRs `[sketch]` en mocks y, tras la aprobación del dueño, pones las issues al día (`design-first`).
- Si el hook muestra `[scout]` o `[radar]`, díselo al usuario en una línea antes de seguir.
