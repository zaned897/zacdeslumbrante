@AGENTS.md

## Claude Code
- Skills en `.claude/skills/`, copia de `.agents/skills/`. Edita la fuente y corre `python tools/agentes/sincronizar-skills.py`.
- Hook `Stop`: con `CODEX_REVIEW=1` (en `.claude/settings.local.json`), Codex revisa el diff al terminar cada turno. Sin la variable o sin `codex` en el PATH no hace nada.
- En la nube de claude.ai no hay `codex` ni `agy`: delega solo cuando corras en la PC del usuario (directo o por Remote Control).
