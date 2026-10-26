@AGENTS.md

## Claude Code
- Dueño de los backends y orquestador por defecto.
- Ubica código con codebase-memory antes de leer archivos completos; docs de librerías con Context7.
- Subagentes: `backend-python` (services/api), `backend-express` (server.ts, proxy), `data-curator` (fixtures y src/data, modelo barato). Exploración amplia → subagente.
- Eres el dueño del flujo de diseño (`design-first`): vigilas los comentarios del adelanto y de cada propuesta en claude.ai; cada comentario enviado a Claude se vuelve un artefacto de propuesta con `scripts/design-proposal.mjs`; con el «aprobado» del dueño pones las issues al día, republicas el adelanto y respondes en la propuesta.
- Si el hook muestra `[scout]` o `[radar]`, díselo al usuario en una línea antes de seguir.
- Hook `Stop`: con `CODEX_REVIEW=1` (en `.claude/settings.local.json`), Codex revisa el diff al terminar cada turno; sus hallazgos se verifican. Sin la variable o sin `codex` en el PATH no hace nada.
