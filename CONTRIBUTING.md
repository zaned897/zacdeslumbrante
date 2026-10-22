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

## Flujo: visual primero, código después
Ninguna feature con interfaz se programa antes de que su visual esté aprobado.

1. **Propón el visual.** Dos caminos, los dos sin código:
   - Si tienes acceso al [adelanto](https://claude.ai/artifact/6hZzQuFhqKU9qJmpXsirzp) (la referencia de diseño), deja un comentario en la pantalla que quieres cambiar.
   - Si no, abre un PR `[sketch]` que **solo** agregue un boceto en `docs/design/<issue>-<tema>/` (HTML estático o PNG). Nada de código, datos ni configuración.
   El boceto se lleva al adelanto como «Propuesta» y se te responde con el enlace.
2. **Aprobación.** El dueño del proyecto aprueba, pide cambios o descarta.
3. **Se liberan las tareas.** Con el visual aprobado se crean o actualizan las issues (con enlace a la pantalla y la etiqueta `status:ready`) y se cierran las que quedaron obsoletas.
4. **Código.** Toma una issue `status:ready` (empieza por `good first issue`) y comenta que la tomas. Fork → rama `<nivel>/<issue>-<tema>`, commits convencionales (`feat: eventos mock (#12)`), checks (`bun run lint`; si tocas Python: `uv run ruff check . && uv run ruff format --check . && uv run pytest`) y PR con la plantilla: nivel, `Closes #n`, enlace al visual y capturas.
5. **Revisión y merge.** El dueño revisa cada PR a mano y lo fusiona solo con CI en verde. Ni contribuidores ni agentes de IA aprueban o fusionan.

Cambios sin interfaz (backend, datos, docs) saltan los pasos 1 a 3 pero igual nacen de una issue.

## Reglas
- **Mocks honestos:** marca los datos de ejemplo (`"_mock": true` o badge "Demo"). No publiques precios, horarios, reseñas ni contactos de negocios inventados como si fueran reales.
- **Fuentes:** para contenido histórico o cultural, cita la fuente y distingue historia documentada, leyenda y recomendación local.
- **Atajos marcados:** comentarios `PROTO:` con una línea de por qué.
- **Sin secretos ni datos personales** en el código, issues o capturas.
- Textos de la interfaz en español e inglés (`src/data/i18n.ts`).

## Usar agentes de IA
Bienvenido. El repo trae `AGENTS.md` y skills en `.agents/skills/` que Claude Code, Codex y otros agentes leen solos. Tú sigues siendo responsable de revisar lo que envías.

## Para el dueño: proteger `main`
Una vez, en GitHub → **Settings → Rules → Rulesets → New branch ruleset** (o *Branches → Add rule* en la vista clásica), rama `main`:
- **Require a pull request before merging**, con 1 aprobación y **Require review from Code Owners** (`.github/CODEOWNERS` te nombra a ti).
- **Require status checks to pass**: `typescript` y `python` (los jobs de `.github/workflows/ci.yml`). Si agregas CircleCI, suma su check (`ci/circleci: <job>`).
- **Block force pushes** y **Restrict deletions**.
- En **Bypass list** agrega *Repository admin* en modo *For pull requests only*. Los PRs que abren los agentes salen con tu cuenta y GitHub no deja aprobar un PR propio; así los fusionas tú tras revisarlos, siempre con CI en verde. Los de otras personas necesitan tu aprobación.
- En **Settings → General** activa **Automatically delete head branches** (evita PRs apilados perdidos).
