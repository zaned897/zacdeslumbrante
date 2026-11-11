# Pueblos Mágicos: pueblo piloto y modelo de datos

> Nivel: **boceto** (#57). Sin código, endpoints ni pantallas. El visual va en la **Propuesta J** del adelanto (`docs/design/adelanto/index.html#propuesta-j`).

## Alcance

Según la nota del dueño del 9 de noviembre en #56, primero va **un Pueblo Mágico de Zacatecas como piloto**, recorrido en el simulador (#154 y #180). Después se replica a los demás.

- **Entra:**
  - la elección del pueblo piloto y su modelo de datos, solo Zacatecas;
  - la ficha completa del piloto;
  - los otros 6 pueblos como referencia para replicar.
- **Queda fuera:**
  - la mascota, el pasaporte (#59, que pasó a #155) y las misiones presenciales (#60, #62 y #63, cerradas);
  - los pueblos de otros estados.

Los 7 Pueblos Mágicos de Zacatecas, por distancia a la capital: Guadalupe, Jerez, Villanueva, Pinos, Sombrerete, Teúl de González Ortega y Nochistlán.
- Hoy `src/data/places.ts` tiene 4 (Jerez, Sombrerete, Guadalupe y Pinos) más La Quemada.
- El chat ya nombra a los 7 (`presetPueblosPrompt`).

## Pueblo piloto: Guadalupe

| Criterio | Guadalupe | Jerez, la siguiente opción |
|---|---|---|
| Distancia | 7 km, unos 10 min en taxi | 60 km, unos 35 min |
| Ya está en la app | Sí: `guadalupe-pueblo-magico` en `places.ts` | Sí: `jerez-pueblo-magico` |
| Circuito a pie | Compacto, alrededor del Jardín Juárez: convento y museo, Capilla de Nápoles, jardín, calle Colegio Militar y mercado | Más largo: jardín, teatro, santuario, casa museo y portales |
| Fiesta patronal con fecha | Feria de la Virgen de Guadalupe, primera quincena de diciembre, que culmina el 12 | Feria de la Primavera, de marzo a abril |
| Fuentes oficiales | Miniguía de Zacatecas Travel e INAH (museo) | Miniguía de Zacatecas Travel |

**Por qué Guadalupe:**
- **Cerca:** el circuito real se puede comprobar en una tarde.
- **Compacto:** su circuito cabe en una pantalla del simulador.
- **Feria con fecha clara:** sirve de caso de prueba para los eventos de #160.

**Lo que falta confirmar del piloto:**
- **Horario del museo:** la ficha del INAH dice «martes a domingo» en un lugar y «lunes a domingo» en otro, de 9:00 a 18:00.
- **Accesibilidad:** ninguna fuente revisada la menciona.
- **Coordenadas de cada parada:** de OSM, al bajar los datos del centro.
- **Tiempo del circuito:** se mide al recorrerlo en el simulador (#180).

## Estructura común de un pueblo (`towns.json`, mock de #58)

| Campo | Tipo | Oblig. | Ejemplo / regla |
|---|---|---|---|
| `id` | string | sí | `"guadalupe"` |
| `state` | string | sí | `"zacatecas"` |
| `name` | `{ es, en }` | sí | `"Guadalupe"` |
| `tagline` | `{ es, en }` | sí | `"Convento y arte virreinal"`. Una línea para la tarjeta del catálogo. |
| `pilot` | boolean | no | `true` solo en el pueblo piloto. |
| `center` | `{ lat, lng }` | sí | De `places.ts` o del nodo `place=town` de OSM. |
| `distanceKm` | number | sí | `7`. Para ordenar el catálogo por cercanía. |
| `howToGet` | `Note` | sí | Cómo llegar desde la capital. |
| `timeNeeded` | `{ minutes: number \| null, note: {es,en}, sourceUrl? }` | sí | `minutes: null` mientras no haya fuente o medición. |
| `circuit` | `Stop[]` | sí | Circuito a pie, en orden. Es el que se recorre en el simulador. |
| `food` | `{ es, en }[]` | sí | Gastronomía: `["Asado de boda", …]`. |
| `accessibility` | `Note \| null` | sí | `null` = sin dato; la pantalla dice «por confirmar». |
| `patronalFeast` | `{ eventId, name: {es,en}, when: {es,en}, sourceUrl }` | sí | `eventId` apunta a `events.json` de #160 (`kind: "festival"`, `townId`). |
| `returnTrip` | `Note` | sí | Cómo regresar a la capital. |
| `outside` | `Spot[]` | no | Lo que está fuera del centro, con distancia y horario si la fuente lo da. |
| `mainStreets` | string[] | no | El `name` exacto de OSM, como en `scripts/gen-alumbrado.py` (#136). Se resaltan en el mapa. |
| `heroPhoto` | `PlacePhoto \| null` | no | Mismo formato que `photos.json`: `url`, `author`, `license`, `sourceUrl` y `caption`. Con `null` va la ilustración. |
| `placeIds` | string[] | no | Enlace a `places.ts`. |
| `radiusM` | number | no | Radio del pueblo en metros. Se guarda por si vuelven las misiones; hoy no se usa. |
| `sources` | `{ label, url }[]` | sí | Al menos una fuente oficial por pueblo. |

Tipos auxiliares:
- `Note`: `{ es, en, sourceUrl }`.
- `Stop`: `{ name: {es,en}, note: {es,en}, lat?, lng?, placeId?, sourceUrl }`. Sin coordenadas, la parada aparece en la lista pero no en el mapa.
- `Spot`: `{ name: {es,en}, note: {es,en}, distanceKm?, hours?: {es,en}, sourceUrl }`.

El archivo lleva `"_mock": true` hasta que el dueño valide los datos.

### Reglas para no inventar
- **Lugares, comida y fiestas:** de las miniguías oficiales de Zacatecas Travel o del INAH. Cada pueblo cita su fuente en `sources`, y cada nota o parada en su `sourceUrl`.
- **Horarios y precios:** solo si la fuente los publica, y con enlace a la ficha oficial. Si dos fuentes chocan, se dice «por confirmar».
- **Tiempos y accesibilidad:** sin fuente o sin medición van en `null`. La pantalla dice «por confirmar»; nunca se pone un número estimado como si fuera real.
- **Amenidades (comer, dormir, recorridos, turismo):** salen de OSM en la caja del centro (`amenity=restaurant|cafe`, `tourism=hotel|guest_house|information`). No se capturan a mano ni se inventan comercios.
- **Fotos:** de Wikimedia Commons con licencia libre, con autor y licencia visibles. Sin foto libre, va la ilustración.

### Cómo se mantiene al día
- **Lista de pueblos:** se revisa contra el catálogo de Pueblos Mágicos de la Secretaría de Turismo federal cuando haya nombramientos nuevos.
- **Miniguías:** se vuelven a leer una vez al año, o cuando alguien reporta un cambio con una issue `area:data`.
- **Fiesta patronal:** su fecha vive en `events.json` (#160), con su `reviewedAt`.

## Ejemplo completo: Guadalupe (piloto)

```json
{
  "_mock": true,
  "id": "guadalupe",
  "state": "zacatecas",
  "name": { "es": "Guadalupe", "en": "Guadalupe" },
  "tagline": { "es": "Convento y arte virreinal", "en": "Convent and viceregal art" },
  "pilot": true,
  "center": { "lat": 22.7508, "lng": -102.5186 },
  "distanceKm": 7,
  "howToGet": {
    "es": "7 km desde la capital por el bulevar Adolfo López Mateos; unos 10 minutos en taxi.",
    "en": "7 km from the capital along Bulevar Adolfo López Mateos; about 10 minutes by taxi.",
    "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf"
  },
  "timeNeeded": { "minutes": null, "note": { "es": "Se mide al recorrer el circuito en el simulador (#180).", "en": "Measured by walking the circuit in the simulator (#180)." } },
  "circuit": [
    { "name": { "es": "Convento y Museo de Guadalupe", "en": "Convent and Museum of Guadalupe" }, "note": { "es": "Museo del INAH en el Jardín Juárez Oriente", "en": "INAH museum on Jardín Juárez Oriente" }, "placeId": "guadalupe-pueblo-magico", "sourceUrl": "https://lugares.inah.gob.mx/en/museos-inah/405-museo-regional-de-guadalupe.html" },
    { "name": { "es": "Capilla de Nápoles", "en": "Capilla de Nápoles" }, "note": { "es": "Dentro del convento", "en": "Inside the convent" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "name": { "es": "Jardín Juárez", "en": "Jardín Juárez" }, "note": { "es": "Frente al convento", "en": "In front of the convent" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "name": { "es": "Calle Colegio Militar", "en": "Calle Colegio Militar" }, "note": { "es": "Calle comercial del centro", "en": "Shopping street of the center" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "name": { "es": "Mercado de Guadalupe", "en": "Guadalupe market" }, "note": { "es": "Gorditas, birria y menudo", "en": "Gorditas, birria and menudo" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" }
  ],
  "food": [{ "es": "Asado de boda", "en": "Asado de boda" }, { "es": "Tacos envenenados", "en": "Tacos envenenados" }],
  "accessibility": null,
  "patronalFeast": {
    "eventId": "feria-virgen-guadalupe",
    "name": { "es": "Feria de la Virgen de Guadalupe", "en": "Fair of the Virgin of Guadalupe" },
    "when": { "es": "Primera quincena de diciembre; culmina el 12", "en": "First half of December; peaks on the 12th" },
    "sourceUrl": "https://mexicodailypost.news/2025/12/07/the-virgins-fair-has-become-a-state-festival-for-zacatecas/"
  },
  "returnTrip": {
    "es": "El mismo camino de regreso; en taxi o con app, unos 10 minutos.",
    "en": "The same way back; by taxi or ride-hailing, about 10 minutes.",
    "sourceUrl": "https://en.wikivoyage.org/wiki/Guadalupe_(Zacatecas)"
  },
  "outside": [
    { "name": { "es": "Centro Platero", "en": "Silver Center" }, "note": { "es": "Ex hacienda de Bernárdez", "en": "Former Bernárdez hacienda" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "name": { "es": "Conos de Santa Mónica", "en": "Conos de Santa Mónica" }, "note": { "es": "A 20 km de la capital", "en": "20 km from the capital" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" }
  ],
  "mainStreets": ["Colegio Militar", "1910"],
  "heroPhoto": null,
  "placeIds": ["guadalupe-pueblo-magico"],
  "radiusM": 500,
  "sources": [
    { "label": "Miniguía Guadalupe, Zacatecas Travel", "url": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "label": "Museo de Guadalupe, INAH", "url": "https://lugares.inah.gob.mx/en/museos-inah/405-museo-regional-de-guadalupe.html" }
  ]
}
```

Notas del ejemplo:
- **Feria:** la edición de 2025 fue la 46, en el Jardín Juárez, y terminó el 14 de diciembre ([Mexico Daily Post](https://mexicodailypost.news/2025/12/07/the-virgins-fair-has-become-a-state-festival-for-zacatecas/)). Que culmina el 12 sale de [Wikivoyage](https://en.wikivoyage.org/wiki/Guadalupe_(Zacatecas)).
- **Taxi:** Wikivoyage da unos 10 min y unos $100 (precio de 2023). Por eso el precio no va en la ficha.
- **Calles:** los `mainStreets` se confirman contra el `name` de OSM al bajar los datos.

## Mapa del centro

Usa el motor de la Ciudad 3D (`src/scene3d/threeOsmEngine.ts`) con los datos de cada pueblo:
- edificios de Overture/OSM;
- calles con nombre de OSM;
- relieve de AWS (`scripts/gen-terrain.py`).

Hoy el motor tiene fijos `ORIGIN` y las rutas `/data/centro-*`. Para los pueblos hay que pasarle el origen y un prefijo de datos, por ejemplo `/data/pueblos/<id>/`. Eso va en una issue de código aparte. Desde la nube, Overpass y Overture están bloqueados: los datos se bajan desde la PC, como en #136.

## Edificios en 3D

Se combinan dos opciones, las dos en la Propuesta J:

1. **Maqueta:** un `.glb` ligero (< 2 MB, como el avatar de `public/models/avatars/`) por edificio principal, con el estilo cantera de la app. Va en su coordenada, encima de los edificios de OSM/Overture.
   - Primero el convento de Guadalupe, para el piloto.
   - Después los templos principales de cada pueblo, el Salón de las Columnas de La Quemada y el acueducto de Nochistlán.
2. **Escaneo real:** en el visor «Ver en 3D», un modelo de fotogrametría reducido para el celular, con autor y licencia visibles. Solo entra con licencia libre o con permiso escrito; si no hay, el visor muestra la maqueta.
   - Un arqueólogo zacatecano publica escaneos de Zacatecas en [Sketchfab](https://sketchfab.com/jorgecu): la torre y las fachadas de la Catedral, la Iglesia de San José de Tayahua (Villanueva) y el Templo del Calvario de Vetagrande. No muestran licencia: hay que pedir permiso.
   - Capturas propias, con fotos o dron:
     - en templos, con permiso de la parroquia;
     - en zonas arqueológicas (La Quemada, Cerro del Teúl), volar dron requiere permiso del INAH.

Campo opcional por parada: `model3d: { kind: "maqueta" | "escaneo", url, author?, license?, sourceUrl? }`.

Datos de La Quemada usados en la maqueta (de [Wikipedia](https://en.wikipedia.org/wiki/La_Quemada)):
- Salón de las Columnas: recinto de 41 × 32 m con 11 columnas. La posición de las columnas en la maqueta es aproximada.
- Pirámide Votiva: más de 10 m, muy empinada, con escalinata al sur.
- Juego de pelota: en «I», de 70 × 15 m.

## Los otros pueblos, para replicar después

| Pueblo | Distancia | Miniatura | En el centro | Fuera del centro | Comida | Fiesta principal | Fuente |
|---|---|---|---|---|---|---|---|
| Guadalupe (piloto) | 7 km | El convento con el Jardín Juárez | Convento y Museo de Guadalupe, Capilla de Nápoles, Jardín Juárez, Plaza de las Garantías; calles Colegio Militar y 1910 | Centro Platero, Tacoaleche, Conos de Santa Mónica | Asado de boda, tacos envenenados | Feria de la Virgen (diciembre) | [miniguía](https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf) |
| Jerez | 60 km · 35 min | El quiosco del Jardín Rafael Páez | Jardín Rafael Páez, Teatro Hinojosa, Santuario de la Soledad, Casa Ramón López Velarde, Edificio de la Torre, Portal de las Palomas; calles San Luis y de la Aurora | Panteón de Dolores, Sierra de Cardos, Valle de Amaya | Tostadas de cuerito, raspanieve | Feria de la Primavera (marzo-abril) | [miniguía](https://zacatecastravel.com/descargas/miniguiaJerez.pdf) |
| Villanueva | 61 km | La Quemada, Salón de las Columnas | Jardín Benito Juárez, Templo de San Judas Tadeo, Presidencia Municipal, Templo de la Merced, mercado | La Quemada y museo de sitio, Hacienda La Encarnación, Hacienda de Tayahua | Tortas de chorizo, huicholas, condoches | Feria Regional (28 de octubre) | [miniguía](https://zacatecastravel.com/descargas/miniguiaVillanueva.pdf) |
| Pinos | ≈125 km | Parroquia de San Matías | Plaza Principal, Parroquia de San Matías y Museo de Arte Sacro, Templo de San Francisco, calle y barrio de Tlaxcala | Mezcalera La Pendencia, ruta de las biznagas gigantes | Asado, tatemado, gorditas de horno, queso de tuna | Festival Regional (15 al 25 de febrero) | [miniguía](https://zacatecastravel.com/descargas/miniguiaPinos.pdf) |
| Sombrerete | 166 km · 2 h | Sierra de Órganos | Avenida Hidalgo, templos de San Francisco, Santo Domingo y la Tercera Orden, Capilla de la Santa Veracruz, Museo Villa de Llerena | Sierra de Órganos (25 km), Noria de San Pantaleón | Brujitas, rompope de las clarisas, licor de membrillo | Por confirmar | [miniguía](https://zacatecastravel.com/descargas/miniguiaSombrerete.pdf) |
| Teúl de González Ortega | 216 km · 3 h | Cerro del Teúl sobre el pueblo | Plaza de Armas y Portales Trinidad Cervantes, Parroquia de San Juan Bautista, Santuario de Guadalupe, Museo del Mezcal | Cerro del Teúl (sendero de 1 km, ma-do 9:00-17:00), Presa La Aticuata | Gorditas de horno, chamorro, mezcal | Festival Gastronómico (último domingo del mes) | [miniguía](https://zacatecastravel.com/descargas/miniguiaTeul.pdf), [INAH](https://lugares.inah.gob.mx/en/zonas-arqueologicas/zonas/17168-2019-03-01-17-39-24.html) |
| Nochistlán | 226 km · 3 h | El acueducto | Jardín Morelos, Plaza Héroes del 64, Parroquia de San Francisco de Asís, Templo de San Sebastián, Parián | El Tuiche, Presa Las Tuzas, Sierra de Nochistlán | Birria, pollo a la Valentina, jericallas, tejuino | Papaquis de San Sebastián (enero) | [miniguía](https://zacatecastravel.com/descargas/miniguiaNochistlan.pdf) |

Notas:
- **Pinos:** la miniguía no da la distancia total. Los ≈125 km son de [Uno TV](https://www.unotv.com/turismo/pinos-pueblo-magico-de-zacatecas-que-hacer/) y hay que confirmarlos.
- **Teúl:** el horario del cerro es de [Mexico News Daily](https://mexiconewsdaily.com/mexico-living/cerro-del-teul-in-zacatecas/) y hay que confirmarlo con el INAH.
- **Datos que faltan:** Teúl, Nochistlán y Villanueva (el pueblo) no tienen ficha en `places.ts`. `la-quemada` apunta a un `pueblo-magico-villanueva` que no existe.

## Preguntas abiertas
1. **¿Guadalupe como piloto?** Lo decide el dueño. Si prefiere Jerez, el modelo no cambia.
2. **Miniatura del Teúl.** Se pidió «las ruinas con el Cristo grande». Las fuentes revisadas no mencionan un Cristo monumental en el Teúl; el de 33 m que encontramos es el Cristo de la Paz, en Tabasco, Zacatecas. Mientras se confirma, la miniatura es el Cerro del Teúl.
3. **Miniaturas de Sombrerete y Villanueva.** ¿El paisaje (Sierra de Órganos, La Quemada) o un templo del centro?
