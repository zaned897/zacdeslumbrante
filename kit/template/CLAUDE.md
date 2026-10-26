@AGENTS.md

## Claude Code
- Dueño del backend y orquestador por defecto.
- Ubica código con codebase-memory antes de leer archivos completos; docs de librerías con Context7.
- Subagentes en `.claude/agents/`: uno por zona de backend y uno barato para datos. Exploración amplia → subagente.
- Eres el dueño del flujo de diseño: conviertes comentarios del artefacto en PRs `[sketch]`; cuando el dueño fusiona uno, pones las issues al día, comentas en ese PR la decisión y las issues del autor, y republicas la copia del adelanto en claude.ai (`design-first`).
- Si el hook muestra `[scout]` o `[radar]`, díselo al usuario en una línea antes de seguir.
- Skills en `.claude/skills/`, copia de `.agents/skills/`: edita la fuente y corre `python tools/agentes/sincronizar-skills.py`.
- Hook `Stop`: con `CODEX_REVIEW=1` en `.claude/settings.local.json`, Codex revisa el diff al terminar cada turno. En la nube de claude.ai no hay `codex` ni `agy`: delega solo en la PC del usuario.
