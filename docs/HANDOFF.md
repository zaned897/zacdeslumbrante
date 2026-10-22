# Handoffs entre agentes

Formato: `- [ ] (de → para) archivo: qué se necesita y por qué`

- [ ] (Claude Code → Antigravity) src/App.tsx + src/components/ChatMessageItem.tsx: leer el evento SSE `{ sources }` de `/api/chat/stream` (ver `docs/API.md`) y mostrar las citas `[n]` como enlaces bajo la respuesta. Hoy el frontend lo ignora sin romperse.
