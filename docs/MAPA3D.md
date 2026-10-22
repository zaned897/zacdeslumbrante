# Ciudad 3D estilo juego — arquitectura

Objetivo: un recorrido 3D animado sobre la arquitectura real de Zacatecas, con mecánicas tipo Pokémon Go (avatar, descubrir lugares, colección), donde sea fácil enchufar recomendaciones, fotos, avatares y animaciones. Web app primero (navegador móvil); app nativa después, si el demo lo justifica.

Ábrelo en `http://localhost:3000/#3d` (o con el botón **Ciudad 3D** del encabezado). Requiere `VITE_MAPS_API_KEY` en `.env` con Maps JavaScript API habilitada.

## Capas

```
 UI (React)                 src/components/Map3DView.tsx   tarjetas, HUD, botones
   │ usa
 Contrato                   src/types/scene3d.ts           SceneEngine · SceneLayer · ScenePoi · Tour
   │ implementan
 Motor 3D                   src/scene3d/googleMaps3dEngine.ts   (mañana: cesiumEngine.ts, threeEngine.ts)
 Capas de contenido         src/scene3d/layers/*.ts        lugares, fotos, recomendaciones, retos
   │ leen
 Datos                      src/data/*.ts (mock) · /api/py/* (FastAPI, services/api)
```

- **Motor (`SceneEngine`)**: monta la escena, pinta puntos, mueve la cámara (`flyTo`, `orbit`), dibuja rutas. La UI nunca habla con Google/Cesium/Three directamente, así que cambiar de motor es escribir otra clase con la misma interfaz.
- **Capa (`SceneLayer`)**: una función `load()` que devuelve `ScenePoi[]`. Es el punto de enchufe para todo lo nuevo. Una capa puede leer `src/data/` o llamar a `/api/py/...`.
- **Recorrido (`Tour`)**: lista de paradas con cámara, pausa y subtítulo es/en. Hoy en `src/data/tours3d.ts`; luego desde `GET /api/py/tours`.

## Motor elegido para el primer mock

**Google Maps 3D** (`Map3DElement` de Maps JavaScript API, librería `maps3d`): muestra los Photorealistic 3D Tiles de la ciudad real, usa la misma llave que el mapa 2D y ya trae marcadores 3D, polilíneas, vuelos de cámara y modelos `.glb` (`Model3DElement`).

Límites conocidos, que abren issues:
- `Model3DElement` no reproduce animaciones glTF: un avatar que camina con animación necesita CesiumJS (mismos 3D Tiles de Google vía Map Tiles API) o una capa Three.js. Ver la PoC de comparación de motores.
- Cuesta por carga de mapa y necesita red; el modo sin llave usa un motor de respaldo.
- Licencia: los 3D Tiles de Google no se pueden cachear ni extraer; se muestran en vivo con atribución.

## Cómo agregar algo nuevo

**Una capa** (fotos, recomendaciones, retos):
1. Crea `src/scene3d/layers/miCapa.ts` que exporte un `SceneLayer`.
2. Devuelve `ScenePoi` con `kind` adecuado y `isMock: true` si los datos son de ejemplo.
3. Regístrala en `src/scene3d/layers/index.ts`.
4. Si los datos vienen de Python: endpoint en `services/api/` + fixture en `services/api/app/fixtures/` + contrato en `docs/API.md`.

**Un recorrido**: agrega un `Tour` en `src/data/tours3d.ts` usando `placeId` de `src/data/places.ts`. Los subtítulos deben salir de datos documentados (descripciones de `places.ts` o fuentes de la base de conocimientos), nunca inventados.

**Un avatar**: modelo `.glb` low-poly (< 2 MB, solo PBR básico, sin extensiones glTF), con licencia libre anotada, en `public/models/avatars/`.

**Un motor**: clase nueva que implemente `SceneEngine`, elegida en `Map3DView` (p. ej. por `?engine=cesium`).

## Mecánicas de juego (plan)

1. Recorrido animado de cámara (hecho en el mock).
2. Avatar en la escena, movido con teclado o joystick táctil.
3. Posición por GPS, con modo simulado para probar desde casa.
4. Descubrir lugares al entrar en un radio y guardarlos en una colección local.
5. Retos e insignias servidos desde FastAPI.
6. Desde la tarjeta de un lugar, abrir el chat RAG con ese lugar como contexto.

Detalle y orden en las épicas de GitHub: #7 (Ciudad 3D), #8 (modo juego) y #9 (contenido enchufable).
