# Contribuir a Zacatecas Deslumbrante

¡Gracias! Este es un repo de **prototipos** de un asistente turístico y cultural para Zacatecas: lugares, calles, eventos, gastronomía y apoyo al comercio local. Aquí se exploran ideas rápido; nada es producto final.

## Niveles de entrega
Cada issue y cada PR tiene uno:

| Nivel | Qué es | Listo cuando |
|---|---|---|
| `sketch` | Boceto, wireframe, diagrama, HTML estático | La idea se entiende en 1 minuto |
| `mock` | UI o endpoint con datos fijos (`fixtures/`) | Se puede usar y devuelve datos realistas marcados como mock |
| `demo` | Flujo de punta a punta presentable | Un guion de 2 min funciona 3 veces seguidas |
| `poc` | Prueba de viabilidad técnica | La pregunta de la issue queda respondida con evidencia |

Entrega exactamente el nivel de la issue. ¿Se te ocurre el siguiente paso? Propónlo en el PR o en una issue nueva.

## Correr el proyecto
Requisitos: [Bun](https://bun.sh), [uv](https://docs.astral.sh/uv/), Node 20+.
```bash
git clone https://github.com/<tu-usuario>/zacdeslumbrante.git && cd zacdeslumbrante
cp .env.example .env          # opcional: llaves propias de Gemini y Google Maps
bun install && bun run dev    # http://localhost:3000
# backend Python (features nuevas):
cd services/api && uv sync && cd ../.. && bun run dev:py   # http://localhost:8000
```
Sin llaves, el chat y el mapa muestran avisos; los mocks funcionan igual.

## Estructura
- `src/` frontend React + TypeScript · `server.ts` Express (puerta de entrada y proxy)
- `services/api/` backend Python (FastAPI) — **aquí van las features nuevas de backend**
- `docs/API.md` contrato entre frontend y backend

## Flujo
1. Elige una issue (empieza por `good first issue`) y comenta que la tomas.
2. Fork → rama `<nivel>/<issue>-<tema>` (p. ej. `mock/12-eventos`).
3. Commits convencionales: `feat: eventos mock (#12)`.
4. Checks: `bun run lint`; si tocas Python: `uv run ruff check . && uv run ruff format --check . && uv run pytest`.
5. PR con la plantilla: nivel, `Closes #n`, cómo verlo y evidencia (captura o gif si es visual).

## Reglas
- **Mocks honestos:** marca los datos de ejemplo (`"_mock": true` o badge "Demo"). No publiques precios, horarios, reseñas ni contactos de negocios inventados como si fueran reales.
- **Fuentes:** para contenido histórico o cultural, cita la fuente y distingue historia documentada, leyenda y recomendación local.
- **Atajos marcados:** comentarios `PROTO:` con una línea de por qué.
- **Sin secretos ni datos personales** en el código, issues o capturas.
- Textos de la interfaz en español e inglés (`src/data/i18n.ts`).

## Usar agentes de IA
Bienvenido. El repo trae `AGENTS.md` y skills en `.agents/skills/` que Claude Code, Codex y otros agentes leen solos. Tú sigues siendo responsable de revisar lo que envías.
