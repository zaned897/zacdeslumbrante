# PoC #11 — Google Maps 3D contra CesiumJS + 3D Tiles

Pregunta: ¿qué motor usamos para el demo de la ciudad 3D? Los dos muestran los mismos Photorealistic 3D Tiles de Google; la diferencia está en peso, costo y lo que permiten hacer.

## Cómo medir

1. `.env` con `VITE_MAPS_API_KEY`. Para Cesium la llave necesita además **Map Tiles API** habilitada.
2. `bun run dev` y abrir, en el mismo dispositivo y la misma red:
   - Google: `http://<tu-ip>:3000/?stats=1#3d`
   - Cesium: `http://<tu-ip>:3000/?engine=cesium&stats=1#3d`
3. El recuadro de `?stats=1` muestra **montaje** (librería cargada y escena creada), **primera vista** (tiles iniciales cargados) y **fps** (cuadros por segundo del navegador, promedio de 1 s).
4. Anota los valores tras 3 cargas en frío (pestaña privada) y durante el "Recorrido animado". Para el avatar: "Explorar" con `?sim=1`.

## Resultados

Medido en este repo (build de producción, `bun run build`):

| | Google Maps 3D | CesiumJS |
|---|---|---|
| JS extra en el bundle | 0 (la librería la sirve Google) | chunk `Cesium-*.js` de 4.9 MB (1.36 MB gzip), solo con `?engine=cesium` |
| Assets estáticos | ninguno | `dist/cesium/` (Workers, Assets, Widgets, ThirdParty) ≈ 7.7 MB, se piden bajo demanda |
| Animación glTF del avatar | no (`Model3DElement` es estático) | sí (`minero.glb` anima "walk" al moverse) |
| Marcadores, rutas, vuelos de cámara | nativos | entidades Cesium (implementado en `cesiumEngine.ts`) |
| Control de cámara | limitado (flyTo, flyAround) | total |
| Costo de referencia (lista de precios de Google, oct 2026) | SKU de mapas 3D de Maps JavaScript; la lista muestra "Immersive Maps (Pro)": 5,000 gratis/mes, luego US$7 por 1,000 (confirmar que es el SKU que cobra `Map3DElement`) | Map Tiles API "Photorealistic 3D Tiles": 1,000 sesiones gratis/mes, luego US$6 por 1,000 |

Pendiente de medir en dispositivos reales (llenar en el PR o en la issue):

| Dispositivo | Motor | Montaje | Primera vista | FPS quieto | FPS en recorrido |
|---|---|---|---|---|---|
| Celular gama media | Google | | | | |
| Celular gama media | Cesium | | | | |
| Laptop | Google | | | | |
| Laptop | Cesium | | | | |

## Recomendación provisional

**Mezcla**, como se decidió: Google Maps 3D por defecto (cero peso extra, arranque rápido, el costo gratuito alcanza para un demo) y CesiumJS cuando el modo juego necesite avatar animado o cámara libre. El contrato `SceneEngine` permite cambiar por URL sin tocar la UI. Si en celular Cesium no sostiene ~30 fps en el recorrido, se queda solo para escritorio.

## Riesgos

- Los 3D Tiles de Google no se pueden cachear ni descargar; la atribución debe quedar visible (ambos motores la muestran).
- La orientación del avatar en ambos motores está ajustada a ojo (`AVATAR_*` en cada motor): revisar con llave real.

Fuentes: [precios de Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing), [uso y facturación de Map Tiles API](https://developers.google.com/maps/documentation/tile/usage-and-billing).
