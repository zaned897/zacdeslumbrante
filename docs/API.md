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

### GET /api/py/places/{placeId}/photos  · mock · dueño: Claude Code (#23)
Fotos curadas de Wikimedia Commons (`services/api/app/fixtures/photos.json`, #22). Lugar sin fotos → `photos: []`.
```json
{
  "placeId": "catedral-zacatecas",
  "source": "Wikimedia Commons",
  "_mock": true,
  "photos": [
    {
      "id": "catedral-zacatecas-1",
      "placeId": "catedral-zacatecas",
      "url": "https://upload.wikimedia.org/...",
      "author": "…",
      "license": "CC BY-SA 3.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:…",
      "caption": { "es": "Fachada principal de la Catedral", "en": "Main façade of the Cathedral" }
    }
  ]
}
```
La UI debe mostrar `author` y `license` bajo cada foto, con enlace a `sourceUrl`.

## Propuestas pendientes
(Agrega aquí endpoints nuevos antes de implementarlos: método, ruta, body, respuesta, dueño.)
