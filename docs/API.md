# Contrato de API

Fuente de verdad entre backend (Claude Code) y frontend (Antigravity). Tipos en `src/types/index.ts`.

## GET /api/health
`{ status: "ok", hasApiKey: boolean, time: string }`

## GET /api/places
`Place[]`

## POST /api/chat/stream  (Server-Sent Events)
Body:
```json
{ "message": "string (requerido)", "history": [], "language": "es | en", "activeKnowledgeUrls": [] }
```
Respuestas: `400` si falta `message`. Si no, flujo SSE de líneas `data: ...`:
- `{ "sources": [{ "n": 1, "title": "string", "url": "string", "fetchedAt": "YYYY-MM-DD" }] }` — opcional, llega antes del primer `chunk`. Son los fragmentos de la base de conocimientos (`services/kb`) que se usaron; la respuesta los cita como `[n]`. Solo llega si existe `services/kb/data/corpus.jsonl` (o `KB_CORPUS_PATH`) y hubo coincidencias entre las fuentes activas.
- `{ "chunk": "texto" }` — fragmentos de la respuesta, en orden
- `{ "error": "mensaje" }` — error durante la generación
- `[DONE]` — fin del flujo

## Python (`/api/py/*` → FastAPI :8000)
Express reenvía `/api/py/<ruta>` a `PY_API_URL/<ruta>`. Si Python no responde: `503 { "error": "python api offline" }`. Respuestas mock incluyen `"_mock": true`.

Arranque: `bun run dev:py` (o `./scripts/dev.sh` para web + Python).

### GET /api/py/health
`{ "status": "ok" }`

### GET /api/py/challenges  · mock · dueño: Claude Code (#21)
Retos e insignias para el modo juego. Datos en `services/api/app/fixtures/challenges.json`.
```json
{
  "_mock": true,
  "challenges": [
    {
      "id": "bajo-tierra",
      "title": { "es": "Bajo tierra", "en": "Underground" },
      "placeIds": ["mina-el-eden"],
      "badge": { "id": "minero-de-plata", "name": { "es": "Minero de Plata", "en": "Silver Miner" }, "icon": "pickaxe" }
    }
  ]
}
```
- `placeIds`: ids de `src/data/places.ts` (el test lo valida).
- `badge.icon`: nombre de ícono de lucide (`landmark`, `mountain`, `pickaxe`…).

### GET /api/py/tours · GET /api/py/tours/{id}  · mock · dueño: Claude Code (#27)
Recorridos 3D con el formato de `Tour` (`src/types/scene3d.ts`). Fixture en `services/api/app/fixtures/tours.json`; `/tours/{id}` responde 404 si no existe.
```json
[
  {
    "id": "centro-historico-express",
    "title": { "es": "Centro histórico en 2 minutos", "en": "Historic center in 2 minutes" },
    "_mock": true,
    "stops": [
      {
        "placeId": "cerro-de-la-bufa",
        "camera": { "lat": 22.7738, "lng": -102.5649, "altitude": 2610, "range": 900, "tilt": 65, "heading": 250 },
        "holdMillis": 2500,
        "caption": { "es": "…", "en": "…" }
      }
    ]
  }
]
```
`Map3DView` los pide con `loadTours()` (`src/data/tours3d.ts`) y, si Python no responde, usa `TOURS_3D`.

## Propuestas pendientes
(Agrega aquí endpoints nuevos antes de implementarlos: método, ruta, body, respuesta, dueño.)
