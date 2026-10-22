# Decisiones de herramientas

Lo escribe `scout`. Una línea por decisión, para no volver a evaluar lo mismo.

Formato: `fecha · necesidad · elegido / descartado · motivo`

- 2026-10-21 · docs de librerías · Context7 · gratis, sirve a los 3 agentes
- 2026-10-21 · memoria del código · codebase-memory-mcp (DeusData) · grafo local, registra Claude y Codex a la vez
- 2026-10-21 · revisor · codex-plugin-cc (oficial OpenAI) · review y review adversarial desde Claude Code
- 2026-10-21 · ahorro de tokens · Caveman descartado por ahora · ahorro real ~8–10% en trabajo agéntico
- 2026-10-21 · backend de features nuevas · Python + FastAPI + uv detrás de Express (/api/py) · sin reescribir lo existente; Pydantic espeja los tipos TS
- 2026-10-21 · alcance · solo bocetos, mocks, demos y PoCs · repo abierto a forks e issues
