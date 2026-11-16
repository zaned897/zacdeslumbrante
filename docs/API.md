# Contrato de API

Fuente de verdad entre backend (Claude Code) y frontend (Antigravity). Tipos en `src/types/index.ts`.

## GET /api/health
`{ status: "ok", hasApiKey: boolean, corpusChunks: number, lastGeminiError: { message: string, at: string } | null, time: string }`

`corpusChunks`: fragmentos del corpus cargados (0 = sin corpus, el chat no cita). `lastGeminiError`: último fallo de Gemini desde que arrancó el servidor (modelo y mensaje, sin la llave); `null` si no hubo.

## GET /api/places
`Place[]`

## POST /api/chat/stream  (Server-Sent Events)
Body:
```json
{ "message": "string (requerido)", "history": [], "language": "es | en", "activeKnowledgeUrls": [], "brief": false }
```
- `brief` (opcional, #158): con `true`, el modelo contesta en 2 o 3 líneas, sin encabezados y con la cita de su fuente. Con `false` o sin el campo, da la respuesta completa. El chat principal pregunta con `brief: true` y su enlace «Ampliar» repite la misma pregunta con `brief: false`. El respaldo sin Gemini también respeta el modo breve: muestra solo el mejor fragmento con su cita o, sin fragmentos, un lugar de ejemplo con la fuente por verificar.

Respuestas: `400` si falta `message`. Si no, flujo SSE de líneas `data: ...`:
- `{ "sources": [{ "n": 1, "title": "string", "url": "string", "fetchedAt": "YYYY-MM-DD" }] }` — opcional, llega antes del primer `chunk`. Son los fragmentos de la base de conocimientos (`services/kb`) que se usaron; la respuesta los cita como `[n]`. Solo llega si existe `services/kb/data/corpus.jsonl` (o `KB_CORPUS_PATH`) y hubo coincidencias entre las fuentes activas.
- `{ "chunk": "texto" }` — fragmentos de la respuesta, en orden
- `{ "error": "mensaje" }` — error durante la generación
- `[DONE]` — fin del flujo
- Citas en el texto (#83): `[Fuente: <nombre> · Revisado AAAA-MM-DD]`. La fecha es la `lastVerified` de la fuente en `src/data/knowledgeBase.ts`; si la fuente no está curada, es la fecha de la ingesta. En el respaldo con fragmentos la cita también lleva la URL: `[Fuente: <nombre> · Revisado AAAA-MM-DD · <url>]`.

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

### GET /api/py/places/{placeId}/photos  · mock · dueño: Claude Code (#23)
Fotos curadas de Wikimedia Commons (`services/api/app/fixtures/photos.json`, #22). Lugar sin fotos → `photos: []`.
Opcional `?season=muertos` (id de `src/data/seasons.ts`, #75): las fotos con ese `season` van primero; las demás conservan el orden. Cada foto puede traer `season` (o `null`).
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

### GET /api/py/recommendations?lat=&lng=&visited=  · mock · dueño: Claude Code (#24)
Los 3 lugares no visitados más cercanos (haversine), compatibles con `ScenePoi`. `lat` y `lng` obligatorios; `visited` son ids separados por coma. Lugares en `services/api/app/fixtures/places.json` (generado desde `src/data/places.ts`).
```json
{
  "_mock": true,
  "recommendations": [
    {
      "id": "recommendation:teatro-calderon",
      "kind": "recommendation",
      "title": { "es": "Teatro Fernando Calderón", "en": "Fernando Calderón Theater" },
      "lat": 22.7748, "lng": -102.5729,
      "placeId": "teatro-calderon",
      "isMock": true,
      "reason": { "es": "A 90 m de ti", "en": "90 m from you" },
      "distanceMeters": 90

### Cuentas y progreso · PoC · dueño: Claude Code (#53)
Supabase Auth (Google y correo/contraseña) y una tabla `user_progress` con RLS. Si faltan `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `zacdes-api`, corre en **modo demo**: cuentas y progreso en memoria (se borran al reiniciar), sin Google, respuestas con `"_mock": true`. Configuración: `docs/CUENTAS.md`. Cliente en `src/components/account/`.

Errores: `{ "detail": "mensaje en español" }` con `400` (datos), `401` (sin sesión o credenciales malas), `413` (valor > 64 KB), `429` (demasiados intentos), `501` (Google sin configurar), `503` (Supabase no respondió).

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /api/py/auth/config` | | `{ "mode": "supabase" \| "demo", "providers": ["google", "password"], "_mock": bool }` |
| `POST /api/py/auth/signup` | `{ email, password }` (8–72) | `{ "session": Session \| null, "needsConfirmation": bool }` |
| `POST /api/py/auth/login` | `{ email, password }` | `Session` |
| `POST /api/py/auth/refresh` | `{ refreshToken }` | `Session` (el refresh token anterior deja de servir) |
| `POST /api/py/auth/logout` | Bearer | `204` |
| `GET /api/py/auth/google?redirectTo=<url>` | | `{ "url": "https://<proyecto>.supabase.co/auth/v1/authorize?..." }`; al volver, los tokens llegan en el hash (`#access_token=…&refresh_token=…&expires_at=…`) |
| `GET /api/py/me` | Bearer | `AccountUser` |
| `GET /api/py/me/progress` | Bearer | `{ "pet", "visits", "collection", "updatedAt", "_mock" }` (claves sin guardar en `null`) |
| `PUT /api/py/me/progress/{pet\|visits\|collection}` | Bearer; el valor (objeto JSON) | el valor guardado |

```json
// Session
{ "accessToken": "…", "refreshToken": "…", "expiresAt": 1792656000, "_mock": false,
  "user": { "id": "uuid", "email": "ana@example.com", "name": "Ana", "avatarUrl": "https://…" } }
```
- Bearer = header `Authorization: Bearer <accessToken>`; Express lo reenvía tal cual.
- Los valores de progreso son opacos para el backend (los define `ProgressStore` del frontend). Si el valor guardado y el que llega traen `updatedAt` (ISO con zona) y el que llega es más viejo, se conserva el guardado y es el que se responde: gana el más reciente.

### GET /api/py/colaboradores?rol=  · mock · dueño: Claude Code (#115)
Personas del taller SES–COZCyT para la pestaña Equipo (#116). `rol` opcional: `diseno | codigo | contenido | datos` (otro valor → 422). Datos en `services/api/app/fixtures/collaborators.json`: **personas de ejemplo**, ninguna real.
```json
{
  "_mock": true,
  "collaborators": [
    {
      "id": "ana-ejemplo",
      "name": "Ana Ejemplo",
      "initials": "AE",
      "color": "#9A3412",
      "role": { "es": "Ciudad 3D", "en": "3D City" },
      "area": "diseno",
      "bio": { "es": "Diseña la ciudad 3D…", "en": "Designs the 3D city…" },
      "contributions": [{ "es": "3 propuestas", "en": "3 proposals" }],
      "socials": [{ "network": "instagram", "handle": "@ana.ejemplo", "url": "https://example.com/instagram/ana.ejemplo" }],
      "consent": true
    }
  ]
}
```
- Solo se devuelven personas con `consent: true`; quien no dio permiso nunca sale, con o sin filtro.
- `socials`: solo las redes que la persona eligió mostrar (puede ir vacía). `network`: `github | instagram | linkedin | x | web`.
- `color`: fondo del avatar de iniciales (hex). `contributions`: textos cortos para los chips del perfil.
- PROTO: las `url` de ejemplo van a `example.com`, porque un usuario inventado podría ser la cuenta de alguien real. Con la lista real serán las URLs de cada red.

### GET /api/py/towns?state= · GET /api/py/towns/{id}  · mock · dueño: Claude Code (#58)
Pueblos Mágicos de Zacatecas con la estructura común de `docs/design/pueblos-magicos-datos.md` (#57). Datos en `services/api/app/fixtures/towns.json`, tomados de las miniguías de Zacatecas Travel, el INAH y OpenStreetMap. Cada pueblo cita sus fuentes.

`GET /towns` devuelve las tarjetas del catálogo, del pueblo más cercano a la capital al más lejano. `state` es opcional; un estado sin pueblos devuelve una lista vacía.
```json
{
  "_mock": true,
  "towns": [
    {
      "id": "guadalupe",
      "state": "zacatecas",
      "name": { "es": "Guadalupe", "en": "Guadalupe" },
      "tagline": { "es": "Convento y arte virreinal", "en": "Convent and viceregal art" },
      "pilot": true,
      "center": { "lat": 22.7508, "lng": -102.5186 },
      "distanceKm": 7,
      "heroPhoto": null
    }
  ]
}
```

`GET /towns/{id}` devuelve la ficha completa; responde 404 si el pueblo no existe.
```json
{
  "_mock": true,
  "id": "guadalupe",
  "pilot": true,
  "howToGet": { "es": "7 km desde la capital…", "en": "7 km from the capital…", "sourceUrl": "https://zacatecastravel.com/…" },
  "timeNeeded": { "minutes": null, "note": { "es": "Por confirmar…", "en": "To be confirmed…" } },
  "circuit": [
    {
      "name": { "es": "Convento y Museo de Guadalupe", "en": "Convent and Museum of Guadalupe" },
      "note": { "es": "…", "en": "…" },
      "placeId": "guadalupe-pueblo-magico",
      "sourceUrl": "https://lugares.inah.gob.mx/…"
    }
  ],
  "food": [{ "es": "Asado de boda", "en": "Asado de boda" }],
  "accessibility": null,
  "patronalFeast": { "eventId": "feria-virgen-guadalupe", "name": { "es": "…", "en": "…" }, "when": { "es": "…", "en": "…" }, "sourceUrl": "https://…" },
  "returnTrip": { "es": "…", "en": "…", "sourceUrl": "https://…" },
  "outside": [{ "name": { "es": "Centro Platero", "en": "Silver Center" }, "note": { "es": "…", "en": "…" }, "sourceUrl": "https://…" }],
  "mainStreets": ["Colegio Militar", "1910"],
  "placeIds": ["guadalupe-pueblo-magico"],
  "radiusM": 500,
  "sources": [{ "label": "Miniguía Guadalupe, Zacatecas Travel", "url": "https://zacatecastravel.com/…" }]
}
```
- La ficha completa también trae los campos de la tarjeta: `name`, `tagline`, `center`, `distanceKm` y `heroPhoto`.
- `pilot: true` marca al pueblo piloto (Guadalupe), el que se recorre en el simulador (#180).
- Pueden ser `null`: `accessibility`, `patronalFeast`, `howToGet`, `returnTrip` y `timeNeeded.minutes`. Significa que no hay fuente o medición todavía, y la pantalla debe decir «por confirmar». Nunca se rellenan con un estimado.
- `circuit` va en el orden del recorrido a pie. Una parada sin `lat`/`lng` sale en la lista, pero no en el mapa.
- `outside`: lugares fuera del centro. Pueden traer `distanceKm`, `hours` y `placeId` cuando el lugar ya está en `src/data/places.ts` (en Villanueva, La Quemada).
- `patronalFeast.eventId` apuntará a `events.json` de #160. Hoy solo Guadalupe lo trae.
- `center`: de `places.ts` para los 4 pueblos que ya estaban; del nodo `place=town` de OSM para Villanueva, Teúl y Nochistlán.
- `heroPhoto`, cuando llegue, usa el formato de Wikimedia Commons de las fotos: `url`, `author`, `license`, `sourceUrl` y `caption`.

### GET /api/py/vendors · GET /api/py/vendors/{id}  · mock · dueño: Claude Code (#171)
Puestos y comercios **inventados** del mundo de prueba del Centro Histórico (#170). Solo salen los publicados. Datos en `services/api/app/fixtures/vendors.json`; `/vendors/{id}` responde 404 si no existe o no está publicado.
```json
{
  "_mock": true,
  "vendors": [
    {
      "_mock": true,
      "id": "gorditas-la-imaginaria",
      "name": "Gorditas La Imaginaria",
      "kind": "food",
      "specialty": { "es": "Gorditas de horno y de comal", "en": "Oven and griddle gorditas" },
      "street": "Avenida Hidalgo",
      "lat": 22.7754, "lng": -102.5726,
      "hours": [{ "days": [0, 1, 2, 3, 4, 5, 6], "open": "08:00", "close": "15:00" }],
      "priceRange": "$",
      "photoUrl": null,
      "interests": ["hambre", "comer-rapido", "tradicional", "economico"],
      "status": "published"
    }
  ]
}
```
- `kind`: `food | sweets | coffee | drinks | crafts`. `days`: 0 = lunes … 6 = domingo. `priceRange` sin montos.
- `street`: calle con nombre de OpenStreetMap sobre la que está el punto.

### GET /api/py/nearby?lat=&lng=&radius=&at=&interests=  · mock · dueño: Claude Code (#171)
Puestos publicados y lugares del catálogo a menos de `radius` metros (10–2000; por omisión, 300), con sus señales a la hora `at`. Las reglas son las de `docs/design/señales-del-agente.md` (#166).
- `at`: ISO 8601, con año entre 2000 y 2100. Sin zona, se toma la de Zacatecas (-06:00); sin `at`, la hora actual. Un valor inválido responde 422.
- `interests`: opcional, separado por comas (`hambre,para-ninos`).
```json
{
  "_mock": true,
  "at": "2026-11-10T13:30:00-06:00",
  "items": [
    {
      "id": "gorditas-la-imaginaria",
      "kind": "vendor",
      "name": { "es": "Gorditas La Imaginaria", "en": "Gorditas La Imaginaria" },
      "lat": 22.7754, "lng": -102.5726,
      "distanceM": 81,
      "open": true,
      "crowd": "alta",
      "waitMin": 20,
      "signal": "pattern",
      "promotion": { "id": "promo-01", "title": { "es": "…", "en": "…" }, "end": "2026-11-30T15:00:00-06:00" },
      "recommendations": { "count": 4, "reasons": [{ "reason": "comer-rapido", "text": { "es": "Para comer rápido", "en": "For a quick bite" }, "count": 2 }] },
      "matches": ["hambre"],
      "reason": { "es": "A 81 m · a esta hora suele haber afluencia alta · espera estimada de 20 min · 4 visitantes lo recomiendan: para comer rápido · promoción vigente (dato del puesto) hasta el 30 nov", "en": "…" }
    }
  ]
}
```
- **Orden:** por distancia en tramos de 50 m. Dentro de cada tramo van primero los que coinciden con `interests` (`matches`) y luego los más recomendados.
- **`crowd` y `waitMin`:** salen de la franja horaria del lugar a la hora `at`. Si está cerrado (`open: false`) van en `null`. `open` es `null` para los lugares del catálogo, que aún no traen horario.
- **`signal: "pattern"`:** es lo que suele pasar a esa hora; el texto lo dice como «suele». La afluencia nunca se presenta como calidad.
- **`signal: "live"`:** hay un reporte de un visitante de los últimos 45 minutos (`POST /api/py/reports`, #174). Manda sobre el patrón y el texto dice «ahora hay…».
- **`promotion`:** solo dentro de su vigencia. Es información, no cupón.
- **`recommendations`:** solo las de los últimos 90 días, contadas por visitante. `reason` las menciona a partir de 3.

### POST /api/py/vendors · GET /api/py/vendors/pending · POST /api/py/vendors/{id}/approve  · mock · dueño: Claude Code (#172)
Alta de un puesto con revisión. Un puesto dado de alta queda **pendiente** y no aparece en `/vendors` ni en `/nearby` hasta que alguien lo aprueba (regla de #153).

`POST /vendors` es público y responde 201:
```json
{
  "name": "Tortas La Solicitud",
  "kind": "food",
  "specialty": "Tortas de lomo",
  "lat": 22.7752, "lng": -102.5727,
  "street": "Avenida Hidalgo",
  "hours": [{ "days": [0, 1, 2, 3, 4, 5, 6], "open": "09:00", "close": "18:00" }],
  "priceRange": "$",
  "promotion": { "title": "Torta y agua", "start": "2026-11-01T09:00:00-06:00", "end": "2026-11-30T18:00:00-06:00" },
  "contact": { "phone": "…", "email": "…" }
}
```
→ `{ "id": "alta-1-tortas-la-solicitud", "status": "pending", "message": { "es": "…", "en": "…" } }`
- `lat`/`lng` deben caer en el Centro Histórico (22.760–22.790, -102.590 a -102.560); si no, 422. `promotion` y `contact` son opcionales.
- `promotion.start` y `promotion.end` son fecha y hora ISO 8601, con año entre 2000 y 2100; sin zona se toma la de Zacatecas. Una fecha ilegible o fuera de esos años, o un `end` anterior a `start`, responde 422.
- **Revisión**, con `Authorization: Bearer <ADMIN_TOKEN>` (variable de entorno):
  - `GET /vendors/pending` → `{ "pending": [{ "vendor": Vendor, "promotion": …, "contact": …, "receivedAt": "…" }] }`.
  - `POST /vendors/{id}/approve` → el `Vendor` publicado. Desde ese momento sale en `/vendors` y en `/nearby`, con su promoción si la trae.
- Errores: sin token o con uno incorrecto, 401. Sin `ADMIN_TOKEN` configurado, 503. Si no hay solicitud pendiente con ese id, 404.
- El contacto solo se ve en la revisión: **nunca** sale en `/vendors` ni en `/nearby`.
- PROTO: las solicitudes viven en memoria y se pierden al reiniciar la API; pasan a la base de datos de las cuentas cuando exista.

### POST /api/py/agent/plan  · mock · dueño: Claude Code (#165)
El agente arma el paseo con **reglas simples, sin LLM**. Las reglas son las de `docs/design/señales-del-agente.md` (#166).
```json
{
  "start": { "lat": 22.7756, "lng": -102.5723 },
  "minutes": 60,
  "budget": "$$",
  "interests": ["museos"],
  "mobility": "a-pie",
  "hungry": true,
  "at": "2026-11-10T13:30:00-06:00",
  "avoid": ["gorditas-la-imaginaria"]
}
```
- Solo `start` y `minutes` (15–480) son obligatorios.
- `budget`: `$`, `$$` o `$$$`, como los puestos y los visitantes.
- `mobility`: `a-pie`, `carriola` o `silla-de-ruedas`.
- `at`: ISO 8601, con año entre 2000 y 2100. Sin zona, hora de Zacatecas; sin `at`, la hora actual. Un valor inválido responde 422.
- `avoid`: ids que el visitante no quiere («hay mucha espera, dame otra opción»). Con ellos se vuelve a pedir el plan.

→
```json
{
  "_mock": true,
  "at": "2026-11-10T13:30:00-06:00",
  "stops": [
    {
      "placeId": "gorditas-la-imaginaria",
      "kind": "vendor",
      "name": { "es": "Gorditas La Imaginaria", "en": "Gorditas La Imaginaria" },
      "lat": 22.776323, "lng": -102.572223,
      "reason": { "es": "Tienes hambre y es comida abierta · a 2 min a pie · a esta hora suele haber afluencia alta · espera estimada de 20 min · 4 visitantes lo recomiendan: para comer rápido · promoción vigente (dato del puesto) hasta el 30 nov", "en": "…" },
      "arriveAt": "2026-11-10T13:32:00-06:00",
      "stayMin": 15,
      "walkMin": 2,
      "waitMin": 20,
      "signal": "pattern",
      "source": "mundo-de-prueba"
    }
  ],
  "totalMin": 54,
  "notes": [{ "es": "Gorditas La Imaginaria: hay espera larga (unos 20 min). ¿Te propongo otra opción cerca? Pide el plan con avoid: [\"gorditas-la-imaginaria\"].", "en": "…" }]
}
```
- **Candidatos:**
  - los puestos publicados del mundo de prueba (#170), más los aprobados (#172);
  - los lugares del catálogo con horario conocido, en `services/api/app/fixtures/plan_places.json`.
    - Su horario y su tarifa se transcriben de `src/data/places.ts`; un test falla si dejan de coincidir.
    - `source` es la página oficial de donde sale el horario. En los puestos dice `mundo-de-prueba`.
- **Orden de las paradas:**
  1. **Reglas duras:** abierto desde que llega hasta que se va, cabe en el tiempo que queda, dentro del presupuesto y fuera de `avoid`.
  2. **Interés:** con `hungry`, la primera parada es comida. Con `interests`, solo entran paradas que coinciden.
     - Si no cabe ninguna comida, el plan sigue sin ella y lo dice en `notes`; los `interests` se siguen respetando.
  3. **Costo de tiempo:** caminata + espera + estancia. Gana la que deja más margen.
  4. **Desempates:** una recomendación que coincide con un interés, la distancia más corta, una promoción vigente.
- La afluencia no ordena nada: solo entra como espera (`waitMin`).
- Un puesto de cada tipo por plan: no salen dos cafés ni dos comidas.
- **`notes`:** espera larga (15 min o más) con la sugerencia de `avoid`, comida que no cupo, accesibilidad sin confirmar si `mobility` no es `a-pie`, y el tiempo libre que queda.
- PROTO:
  - la caminata es la distancia directa × 1.3, a 70 m/min a pie (60 con carriola y 50 en silla de ruedas);
  - la estancia es fija por tipo de parada;
  - el presupuesto compara la tarifa de entrada: hasta $50 es `$`, hasta $150 es `$$`.

### GET /api/py/events?date=&town= · POST /api/py/events · PATCH /api/py/events/{id}  · mock · dueño: Claude Code (#160)
Temporadas, fiestas y eventos, **cargados a mano** por ahora. El modelo ya trae `origin` para cuando lleguen solos (#162). Absorbe las ediciones de la Panamericana (#137) y las fiestas patronales (#76).

`GET /events?date=2026-10-22` (sin `date`, hoy en Zacatecas) devuelve solo los eventos **publicados que caen ese día**:
```json
{
  "date": "2026-10-22",
  "town": null,
  "events": [
    {
      "id": "panamericana-2026",
      "kind": "event",
      "name": { "es": "Carrera Panamericana", "en": "Carrera Panamericana" },
      "start": "2026-10-22", "end": "2026-10-22",
      "yearly": false,
      "townId": null,
      "edition": 2026,
      "inZacatecas": true,
      "seasonId": "panamericana",
      "provisional": false,
      "sourceUrl": "https://www.zacatecas.gob.mx/…",
      "sourceNote": "Gobierno de Zacatecas, 21 de octubre de 2026: meta en Zacatecas",
      "reviewedAt": "2026-10-21",
      "origin": "manual",
      "status": "published",
      "_mock": true
    }
  ]
}
```
- `kind`: `season` (temporada base), `festival` (fiesta) o `event` (un día o una edición).
- **Fechas:**
  - `start` y `end` son inclusivas (AAAA-MM-DD).
  - Con `yearly: true` se repiten cada año en los mismos días, a partir del año de `start`. Pueden cruzar el año: Posadas y Navidad va del 16 dic al 6 ene.
- `town`:
  - sin él, salen los eventos de la capital y de todo el estado (`townId: null`);
  - con él, también los de ese pueblo (`towns.json`). La fiesta patronal de cada pueblo apunta aquí desde `patronalFeast.eventId`.
- **Orden:** evento, luego fiesta, luego temporada; gana el primero que coincide, como en `src/data/seasons.ts`. `seasonId` dice qué temporada del front viste la app.
- **Panamericana:** cada edición es un evento con su `edition`. Una edición con `inZacatecas: false` se guarda, pero nunca se activa.
- **Manual sobre automático:** si un evento `auto` cae el mismo día, en el mismo lugar (`townId`) y del mismo tipo (`kind`) que uno `manual`, solo sale el manual.
- **Fuentes:**
  - `provisional: true` hasta confirmar la fecha de ese año;
  - una fecha confirmada (`provisional: false`) exige `sourceUrl`; sin ella, 422;
  - `reviewedAt` es cuándo se revisó la fuente.

**Carga manual**, con `Authorization: Bearer <ADMIN_TOKEN>` (el mismo de #172):
- `POST /events` con los mismos campos, sin `id` si se quiere. Responde 201 con el evento.
  - Sin `id`, se arma con el nombre y la edición: `carrera-panamericana-2027`.
  - Por omisión: `origin: "manual"`, `status: "published"` y `_mock: false`.
  - Si el id ya existe, 409.
- `PATCH /events/{id}` cambia solo los campos que llegan y vuelve a validar el evento. Responde 404 si no existe y 422 si queda inválido.
- Errores de token: sin token o con uno incorrecto, 401. Sin `ADMIN_TOKEN` configurado, 503.
- PROTO: lo cargado vive en memoria encima de `services/api/app/fixtures/events.json` y se pierde al reiniciar la API.

### POST /api/py/reports  · mock · dueño: Claude Code (#174)
Un visitante reporta cuánta gente hay en un lugar o lo recomienda. Son dos señales distintas: se guardan y se muestran por separado, con las reglas de `docs/design/señales-del-agente.md` (#166).
```json
{ "placeId": "gorditas-la-imaginaria", "kind": "crowd", "value": "alta" }
```
→ 201
```json
{
  "_mock": true,
  "id": "reporte-1",
  "placeId": "gorditas-la-imaginaria",
  "kind": "crowd",
  "value": "alta",
  "at": "2026-11-10T09:00:00-06:00",
  "expiresAt": "2026-11-10T09:45:00-06:00"
}
```
- `placeId`: un lugar del catálogo (`places.json`) o un puesto publicado. Si no existe, 404.
- **`kind: "crowd"`:** `value` es `baja`, `media` o `alta`, obligatorio.
  - Vale **45 minutos**. En ese rato `/nearby` y `/agent/plan` lo usan en vez del patrón de la franja, con `signal: "live"`.
  - La espera sale de la afluencia reportada: 3, 10 o 20 minutos.
  - Si hay varios reportes vigentes, cuenta el más reciente. Un puesto cerrado sigue sin mostrar afluencia.
- **`kind: "recommend"`:** `value` es opcional y es un motivo corto: `comer-rapido`, `economico`, `para-ninos`, `tradicional`, `descanso`, `artesania` o `vista`.
  - Vale **90 días** y suma a `recommendations.count`. No lleva calificación ni estrellas.
  - Se menciona en el `reason` a partir de 3 recomendaciones.
- **Sin datos personales:** el reporte es anónimo. Cualquier otro campo (`name`, `email`…) responde 422.
- `at`: opcional, ISO 8601 con año entre 2000 y 2100; sin él, ahora. Sirve para el simulador (#175): un reporte no cuenta antes de su hora.
- Errores: `value` que no corresponde al `kind`, `kind` desconocido, o `at` ilegible o fuera de esos años → 422.
- PROTO:
  - los reportes viven en memoria (los 2000 más recientes) y se pierden al reiniciar la API;
  - como son anónimos, cada recomendación cuenta como un visitante distinto;
  - `at` lo pone quien llama. Con visitantes reales lo pondría el servidor.

## Propuestas pendientes
(Agrega aquí endpoints nuevos antes de implementarlos: método, ruta, body, respuesta, dueño.)
