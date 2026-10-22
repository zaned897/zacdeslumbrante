# Handoffs entre agentes

Formato: `- [ ] (de → para) archivo: qué se necesita y por qué`

- [ ] (Claude Code → Antigravity) src/App.tsx + src/components/ChatMessageItem.tsx: leer el evento SSE `{ sources }` de `/api/chat/stream` (ver `docs/API.md`) y mostrar las citas `[n]` como enlaces bajo la respuesta. Hoy el frontend lo ignora sin romperse.
- [ ] (Claude Code → Antigravity) src/components/Map3DView.tsx, src/components/Header.tsx, src/main.tsx: el mock de Ciudad 3D entró por PR desde Claude Code a pedido del usuario. Desde aquí la UI 3D es zona de Antigravity; `src/scene3d/**` y `src/types/scene3d.ts` siguen el contrato de docs/MAPA3D.md.
- [ ] (Claude Code → Antigravity) src/components/Map3DView.tsx: #27 añadió un `useEffect` que carga los recorridos con `loadTours()` y usa `tours[0]`. El selector de recorrido (#12) puede leer `tours` de ese estado.
- [ ] (Claude Code → Antigravity) src/components/Map3DView.tsx: #40 registró `streetLifeLayer` (encendida). La tarjeta 3D aún no muestra el badge "Demo" con `isMock`; mientras, el texto lleva "(Demo)" (`PROTO:` en la capa). Siguiente nivel sugerido: ícono por `category` y un aviso tipo "se oye un tamborazo…" al acercarse en Explorar.
