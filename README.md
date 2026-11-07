# Zacatecas Deslumbrante

Asistente turístico y cultural para el estado de Zacatecas, pensado para turismo externo (visitantes) e interno (zacatecanos que redescubren su estado). Combina un chat con IA (Gemini), un mapa interactivo, una base de conocimientos curada e itinerarios sugeridos, en español e inglés.

> **Esto es un repo de prototipos.** Aquí se exploran ideas rápido; nada es producto final. Cada pieza avanza por niveles y los datos de ejemplo van marcados como mock ("Demo").

## Qué incluye hoy

| Pieza | Qué hace | Dónde |
|---|---|---|
| Chat con IA | Respuestas en streaming con Gemini, apoyadas en la base de conocimientos | `server.ts` (`POST /api/chat/stream`), `src/components/ChatContainer.tsx` |
| Mapa | Lugares sobre Google Maps | `src/components/GoogleMapsPanel.tsx`, `GET /api/places` |
| Base de conocimientos | Patrimonio, Centro Histórico (UNESCO), Pueblos Mágicos | `src/data/knowledgeBase.ts`, `src/data/places.ts` |
| Itinerarios | Rutas sugeridas por días o intereses | `src/data/itineraries.ts`, `src/components/ItineraryModal.tsx` |
| Idiomas | Textos de interfaz en es/en | `src/data/i18n.ts` |

En la hoja de ruta: eventos, gastronomía y apoyo al comercio local, como features nuevas sobre un backend Python.

### Niveles de avance

| Nivel | Qué es | Listo cuando |
|---|---|---|
| `sketch` | Boceto, wireframe, diagrama, HTML estático | La idea se entiende en 1 minuto |
| `mock` | UI o endpoint con datos fijos | Se puede usar y devuelve datos realistas marcados como mock |
| `demo` | Flujo de punta a punta presentable | Un guion de 2 min funciona 3 veces seguidas |
| `poc` | Prueba de viabilidad técnica | La pregunta de la issue queda respondida con evidencia |

Toda tarea nace de una issue de GitHub y declara su nivel. Detalles en [CONTRIBUTING.md](CONTRIBUTING.md).

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind 4 (`src/`).
- **Servidor:** Express 4 (`server.ts`, puerto 3000). Sirve el frontend con Vite en desarrollo y hace de puerta de entrada a la API.
- **IA:** Gemini vía `@google/genai`, llamado solo desde el servidor (la llave nunca llega al navegador).
- **Mapa:** Google Maps JavaScript API (`@googlemaps/js-api-loader`).
- **Backend Python (planeado):** FastAPI en `services/api/` (puerto 8000), detrás de Express en `/api/py/*`. Es donde van las features nuevas de backend; aún no existe en el repo, se crea con la primera issue de Python (etapa 7 de la instalación).

## Correr el proyecto

Requisitos: [Bun](https://bun.sh) y Node 20+. Para el backend Python, además [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/zaned897/zacdeslumbrante.git
cd zacdeslumbrante
cp .env.example .env     # y pon tus llaves en .env
bun install
bun run dev              # http://localhost:3000
```

Con el backend Python, `./scripts/dev.sh` levanta todo junto (web :3000 + Python :8000) y libera los puertos al salir con Ctrl+C.

Otros comandos:

| Comando | Para qué |
|---|---|
| `bun run lint` | Revisión de tipos (`tsc --noEmit`), la misma que corre CI |
| `bun run build` | Build de producción en `dist/` |
| `NODE_ENV=production bun run start` | Sirve el build desde Express |

Sin llaves, el chat y el mapa muestran avisos; los mocks funcionan igual.

### Variables de entorno

Se definen en `.env` (copia de `.env.example`). **`.env` nunca se sube al repo** y `.env.example` solo lleva placeholders, jamás llaves reales. El hook de pre-commit bloquea commits con patrones de llaves o archivos `.env`.

| Variable | Requerida | Para qué |
|---|---|---|
| `GEMINI_API_KEY` | Para el chat | Llave de la API de Gemini (Google AI Studio). Solo la usa el servidor. |
| `VITE_MAPS_API_KEY` | Para el mapa | Llave de Google Maps JavaScript API. Va al navegador, así que restríngela por referente (`http://localhost:*/*` en local) y solo a Maps JavaScript API. |
| `APP_URL` | No | URL pública cuando se aloja en AI Studio / Cloud Run; en local no hace falta. |
| `PORT` | No | Puerto de Express (por defecto 3000). |

### Desplegar en línea (Render)

`render.yaml` define dos servicios gratis: `zacdes-web` (Express + Vite) y `zacdes-api` (FastAPI). Para crearlos: en Render, *New → Blueprint*, elige este repo y captura `GEMINI_API_KEY` (y `VITE_MAPS_API_KEY` si quieres el mapa de Google) cuando lo pida. Cada push a `main` vuelve a desplegar.

- La URL de la web abre en el celular. Los servicios gratis se duermen tras 15 min sin visitas y tardan ~1 min en despertar.
- Si Render asigna a la API otra URL que `https://zacdes-api.onrender.com`, actualiza `PY_API_URL` en el panel de `zacdes-web`.
- Preview de un PR: agrega `[render preview]` a su título.
- El build (`scripts/render-build.sh`) baja el corpus de `services/kb` en cada deploy para que el chat cite fuentes; si la ingesta falla, el chat responde sin citas.

## Estructura

```
server.ts            Express: API, proxy y Vite en desarrollo
src/
  components/        UI React (chat, mapa, sidebar, modales)
  data/              datos curados e i18n
  server/            lógica de servidor (síntesis de grounding)
  types/             tipos compartidos
docs/
  API.md             contrato frontend ↔ backend
  HANDOFF.md         cambios pedidos entre zonas de agentes
  atlas.html         atlas visual de la suite multiagente
scripts/             dev, verificación por etapas, etiquetas, worktrees
toolbox/             capacidades, decisiones, hooks y modelos de la suite
.agents/skills/      skills compartidas por los agentes
```

## Suite multiagente (v5)

El repo se trabaja con varios agentes de IA coordinados, cada uno con su zona:

| Agente | Rol | Zona |
|---|---|---|
| Claude Code | Backends y orquestación | `services/api/**`, `server.ts`, `src/server/**`, `src/data/**` |
| Antigravity | Frontend | `src/components/**`, `src/App.tsx`, `src/index.css`, `src/main.tsx`, `index.html` |
| Codex | Revisión (solo lectura) | Reporta archivo, línea, severidad y sugerencia |

Las reglas comunes viven en [AGENTS.md](AGENTS.md) (Claude Code las lee desde [CLAUDE.md](CLAUDE.md)). Un cambio en zona ajena se pide en `docs/HANDOFF.md`. Las personas que contribuyen pueden tocar cualquier zona vía PR.

**Atlas.** [`docs/atlas.html`](docs/atlas.html) es la guía visual de la suite: arquitectura, ciclo de una feature de la issue al merge, barreras de calidad, relevo entre agentes, mapa de carpetas y dueños, y la instalación por etapas con su resultado esperado. Ábrelo en el navegador.

**Skills** (`.agents/skills/`): `orchestrate` (feature nueva), `prototype-scope` (nivel y límites), `gh-issues`, `pr-intake` (PRs, sobre todo de forks), `python-backend`, `scout` (herramientas faltantes; nunca instala sin un sí), `radar` (revisar `toolbox/models.md`), `relay` (pasar trabajo a medias entre agentes o sesiones).

**Scripts:**

| Script | Para qué |
|---|---|
| `scripts/dev.sh` | Web + Python en una pestaña |
| `scripts/verify.sh [etapa\|rango]` | Prueba cada etapa del setup (✓ / ✗ con arreglo / ~ manual) |
| `scripts/suite-init.sh [--antigravity]` | Conecta la suite a los agentes y activa los git hooks |
| `scripts/gh-labels.sh` | Crea las etiquetas de nivel y área en GitHub |
| `scripts/worktrees.sh <rama-back> <rama-front>` | Un worktree por agente para trabajar en paralelo |
| `scripts/windows-bootstrap.ps1` | Instala las herramientas en Windows |

**Etapas de instalación** (detalle en [SETUP.md](SETUP.md) y el atlas; estación Windows en [WORKSTATION.md](WORKSTATION.md)):

| # | Etapa | Prueba |
|---|---|---|
| 0 | Seguridad: rotar llaves expuestas | manual |
| 1 | Herramientas | `verify.sh 1` |
| 2 | Cuentas (claude, codex, gh, git) | `verify.sh 2` |
| 3 | Repositorio | `verify.sh 3` |
| 4 | Suite | `verify.sh 4` |
| 5 | Agentes y MCP | `verify.sh 5` |
| 6 | GitHub abierto a contribuciones | `verify.sh 6` |
| 7 | Backend Python (primera issue real) | `verify.sh 7` |
| 8 | Ensayo general | `verify.sh` |

**Barreras de calidad:** git hooks en `.githooks/` (commits convencionales, sin secretos, `tsc` y `ruff` antes de cada commit) y CI en `.github/workflows/ci.yml` (TypeScript siempre; Python cuando exista `services/api/`).

## Contribuir

**Adelanto visual:** <https://claude.ai/artifact/6hZzQuFhqKU9qJmpXsirzp> (referencia tipo Figma del proyecto; fuente en `docs/design/adelanto/`).

- Los colaboradores solo comentan sobre el adelanto, entrando a claude.ai con una cuenta que tenga acceso.
- Para que vean el ícono de comentarios, el dueño los invita por correo con acceso **Commenter** (Share → invitar → «Their access»). Con la liga sola («Anyone with the link») solo pueden ver, y un invitado externo no puede comentar si el adelanto también está compartido con «Anyone with the link»: deja «Who has access» en «Only you». Cada invitado entra a claude.ai con el mismo correo y acepta la invitación («View invitation» → «Accept and open»). Detalles: [Share artifacts](https://support.claude.com/en/articles/9547008-share-artifacts).
- El dueño envía cada comentario a Claude con «Send to Claude»; de ahí sale una propuesta de diseño, sin código.
- El orden siempre es: primero el visual, luego la issue y al final el código.

Ramas `<nivel>/<issue>-<tema>` (p. ej. `mock/12-eventos`), commits convencionales con `#issue` y PR con la plantilla. Mocks siempre marcados; nada de datos inventados presentados como reales. Guía completa en [CONTRIBUTING.md](CONTRIBUTING.md).
