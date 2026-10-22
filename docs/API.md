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

### GET /api/py/street-life?category=  · mock · dueño: Claude Code (#40)
Vida de calle para la ciudad 3D: puestos, artesanos y músicos **genéricos** (tipos de comercio típicos, no negocios reales), compatibles con `ScenePoi`. `category` opcional: `food | sweets | crafts | music | art`. Datos en `services/api/app/fixtures/street_life.json`.
```json
{
  "_mock": true,
  "spots": [
    {
      "id": "callejoneada-tamborazo",
      "kind": "vendor",
      "category": "music",
      "icon": "drum",
      "title": { "es": "Callejoneada con tamborazo", "en": "Callejoneada with tamborazo" },
      "cry": { "es": "Tambora, trompeta y jarrito de mezcal…", "en": "Drum, trumpet and a clay cup of mezcal…" },
      "when": { "es": "Suele salir de noche, más en fines de semana", "en": "Usually at night, mostly on weekends" },
      "nearPlaceId": "plaza-armas",
      "lat": 22.77605, "lng": -102.57265,
      "isMock": true
    }
  ]
}
```
- `cry`: el pregón del puesto; `when`: cuándo suele verse, nunca un horario exacto.
- `nearPlaceId`: id de `src/data/places.ts`; el test valida que exista y que el puesto quede a menos de ~150 m.
- Sin precios, nombres de comerciantes, contactos ni reseñas.

## Propuestas pendientes
(Agrega aquí endpoints nuevos antes de implementarlos: método, ruta, body, respuesta, dueño.)
