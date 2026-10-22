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
- `{ "chunk": "texto" }` — fragmentos de la respuesta, en orden
- `{ "error": "mensaje" }` — error durante la generación
- `[DONE]` — fin del flujo

## Python (`/api/py/*` → FastAPI :8000)
Express reenvía `/api/py/<ruta>` a `PY_API_URL/<ruta>`. Si Python no responde: `503 { "error": "python api offline" }`. Respuestas mock incluyen `"_mock": true`.

(Aún sin endpoints; se agregan aquí al implementarse.)

## Propuestas pendientes
(Agrega aquí endpoints nuevos antes de implementarlos: método, ruta, body, respuesta, dueño.)
