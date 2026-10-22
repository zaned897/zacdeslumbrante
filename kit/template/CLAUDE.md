@AGENTS.md

## Claude Code
- Dueño del backend y orquestador por defecto.
- Ubica código con codebase-memory antes de leer archivos completos; docs de librerías con Context7.
- Subagentes en `.claude/agents/`: uno por zona de backend y uno barato para datos. Exploración amplia → subagente.
- Si el hook muestra `[scout]` o `[radar]`, díselo al usuario en una línea antes de seguir.
