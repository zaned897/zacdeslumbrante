# Handoffs entre agentes

Formato: `- [ ] (de → para) archivo: qué se necesita y por qué`

- [ ] (Claude Code → Antigravity) src/App.tsx + src/components/ChatMessageItem.tsx: leer el evento SSE `{ sources }` de `/api/chat/stream` (ver `docs/API.md`) y mostrar las citas `[n]` como enlaces bajo la respuesta. Hoy el frontend lo ignora sin romperse.
- [ ] (Claude Code → Antigravity) src/components/Map3DView.tsx, src/components/Header.tsx, src/main.tsx: el mock de Ciudad 3D entró por PR desde Claude Code a pedido del usuario. Desde aquí la UI 3D es zona de Antigravity; `src/scene3d/**` y `src/types/scene3d.ts` siguen el contrato de docs/MAPA3D.md.
