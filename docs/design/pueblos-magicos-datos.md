# Pueblos Mágicos: catálogo y modelo de datos

> Nivel: **boceto** (#57). Sin código, endpoints ni pantallas. El visual va en la **Propuesta H** del adelanto (`docs/design/adelanto/index.html#propuesta-h`).

## Alcance

- **Entra:** los 7 Pueblos Mágicos de Zacatecas, cada uno con su miniatura, su página y el mapa de su centro.
- **Queda fuera:** la mascota, el pasaporte y las misiones (#56, #59, #60, #62, #63). Pueden usar estos datos más adelante.
- **Cambio a #57:** el estado vecino queda para después de los 7 de Zacatecas.

Los 7, en orden de distancia a la capital: Guadalupe, Jerez, Villanueva, Pinos, Sombrerete, Teúl de González Ortega y Nochistlán. Hoy `src/data/places.ts` tiene 4 (Jerez, Sombrerete, Guadalupe, Pinos) más La Quemada, y el chat ya nombra a los 7 (`presetPueblosPrompt`).

## Pueblo (`towns.json`, mock de #58)

| Campo | Tipo | Oblig. | Ejemplo / regla |
|---|---|---|---|
| `id` | string | sí | `"guadalupe"` |
| `state` | string | sí | `"zacatecas"` |
| `name` | `{ es, en }` | sí | `"Guadalupe"` |
| `tagline` | `{ es, en }` | sí | `"Convento y arte virreinal"`. Una línea para la tarjeta. |
| `center` | `{ lat, lng }` | sí | De `places.ts` o del nodo `place=town` de OSM. |
| `radiusM` | number | sí | `500`. Se queda para las misiones; esta propuesta no lo usa. |
| `distance` | `{ km, minutes?, source }` | sí | `{ "km": 7, "source": "miniguía oficial" }` |
| `heroPhoto` | `PlacePhoto \| null` | no | Mismo formato que `photos.json`: `url`, `author`, `license`, `sourceUrl`, `caption`. Con `null` va la ilustración. |
| `highlights` | `Stop[]` | sí | Imprescindibles del centro, en el orden del recorrido a pie. |
| `mainStreets` | string[] | sí | El `name` exacto de OSM, como en `scripts/gen-alumbrado.py` (#136). Se resaltan en el mapa. |
| `outside` | `Spot[]` | no | Lo que está fuera del centro, con distancia y horario si la fuente lo da. |
| `flavors` | `{ es, en }[]` | sí | `["Asado de boda", …]` |
| `festivals` | `{ name, when }[]` | no | `when` como texto: `"15 al 25 de febrero"`. |
| `placeIds` | string[] | no | Enlace a `places.ts` (`"guadalupe-pueblo-magico"`). |
| `sources` | `{ label, url }[]` | sí | Al menos una fuente oficial por pueblo. |

`Stop`: `{ name: {es,en}, note: {es,en}, lat?, lng?, placeId?, sourceUrl }`. Sin coordenadas, el lugar aparece en la lista pero no en el mapa.
`Spot`: `{ name: {es,en}, note: {es,en}, distanceKm?, hours?: {es,en}, sourceUrl }`.

El archivo lleva `"_mock": true` hasta que el dueño valide los datos.

### Reglas para no inventar
- **Lugares, sabores y fiestas:** de las miniguías oficiales de Zacatecas Travel o del INAH. Cada pueblo cita su fuente en `sources`.
- **Horarios y precios:** solo si la fuente los publica, y siempre con enlace a la ficha oficial. Nada de precios copiados sin fuente.
- **Amenidades (comer, dormir, recorridos, turismo):** salen de OSM en la caja del centro (`amenity=restaurant|cafe`, `tourism=hotel|guest_house|information`). No se capturan a mano ni se inventan comercios.
- **Fotos:** de Wikimedia Commons con licencia libre, con autor y licencia visibles. Sin foto libre, va la ilustración.

### Cómo se mantiene al día
- La lista de pueblos se revisa contra el catálogo de Pueblos Mágicos de la Secretaría de Turismo federal cuando haya nombramientos nuevos.
- Las miniguías se vuelven a leer una vez al año, o cuando alguien reporta un cambio con una issue `area:data`.

## Mapa del centro

Usa el motor de la Ciudad 3D (`src/scene3d/threeOsmEngine.ts`) con los datos de cada pueblo:
- edificios de Overture/OSM;
- calles con nombre de OSM;
- relieve de AWS (`scripts/gen-terrain.py`).

Hoy el motor tiene fijos `ORIGIN` y las rutas `/data/centro-*`. Para los pueblos hay que pasarle el origen y un prefijo de datos, por ejemplo `/data/pueblos/<id>/`. Eso va en una issue de código aparte. Desde la nube, Overpass y Overture están bloqueados: los datos se bajan desde la PC, como en #136.

## Ejemplo completo: Guadalupe

```json
{
  "id": "guadalupe",
  "state": "zacatecas",
  "name": { "es": "Guadalupe", "en": "Guadalupe" },
  "tagline": { "es": "Convento y arte virreinal", "en": "Convent and viceregal art" },
  "center": { "lat": 22.7508, "lng": -102.5186 },
  "radiusM": 500,
  "distance": { "km": 7, "source": "Miniguía Guadalupe, Zacatecas Travel" },
  "heroPhoto": null,
  "highlights": [
    { "name": { "es": "Convento y Museo de Guadalupe", "en": "Convent and Museum of Guadalupe" }, "note": { "es": "Arte virreinal · INAH", "en": "Viceregal art · INAH" }, "placeId": "guadalupe-pueblo-magico", "sourceUrl": "https://lugares.inah.gob.mx/en/museos-inah/405-museo-regional-de-guadalupe.html" },
    { "name": { "es": "Capilla de Nápoles", "en": "Capilla de Nápoles" }, "note": { "es": "Dentro del convento", "en": "Inside the convent" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "name": { "es": "Jardín Juárez", "en": "Jardín Juárez" }, "note": { "es": "Frente al convento", "en": "In front of the convent" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "name": { "es": "Calle Colegio Militar", "en": "Calle Colegio Militar" }, "note": { "es": "Calle comercial del centro", "en": "Shopping street of the center" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "name": { "es": "Mercado de Guadalupe", "en": "Guadalupe market" }, "note": { "es": "Gorditas, birria y menudo", "en": "Gorditas, birria and menudo" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" }
  ],
  "mainStreets": ["Colegio Militar", "1910"],
  "outside": [
    { "name": { "es": "Centro Platero", "en": "Silver Center" }, "note": { "es": "Ex hacienda de Bernárdez", "en": "Former Bernárdez hacienda" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" },
    { "name": { "es": "Conos de Santa Mónica", "en": "Conos de Santa Mónica" }, "note": { "es": "A 20 km de la capital", "en": "20 km from the capital" }, "sourceUrl": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" }
  ],
  "flavors": [{ "es": "Asado de boda", "en": "Asado de boda" }, { "es": "Tacos envenenados", "en": "Tacos envenenados" }],
  "festivals": [{ "name": { "es": "Festival Barroco", "en": "Baroque Festival" }, "when": { "es": "Por confirmar", "en": "To be confirmed" } }],
  "placeIds": ["guadalupe-pueblo-magico"],
  "sources": [{ "label": "Miniguía Guadalupe, Zacatecas Travel", "url": "https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf" }]
}
```

Los `mainStreets` hay que confirmarlos contra el `name` de OSM al bajar los datos.

## Los 7 pueblos

| Pueblo | Distancia | Miniatura | En el centro | Fuera del centro | Sabores | Fiesta principal | Fuente |
|---|---|---|---|---|---|---|---|
| Guadalupe | 7 km | El convento con el Jardín Juárez | Convento y Museo de Guadalupe, Capilla de Nápoles, Jardín Juárez, Plaza de las Garantías; calles Colegio Militar y 1910 | Centro Platero, Tacoaleche, Conos de Santa Mónica | Asado de boda, tacos envenenados | Festival Barroco | [miniguía](https://zacatecastravel.com/descargas/miniguiaGuadalupe.pdf) |
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
1. **Miniatura del Teúl.** Se pidió «las ruinas con el Cristo grande». Las fuentes revisadas no mencionan un Cristo monumental en el Teúl; el de 33 m que sí encontramos es el Cristo de la Paz, en Tabasco, Zacatecas. Mientras se confirma, la miniatura es el Cerro del Teúl.
2. **Miniaturas de Sombrerete y Villanueva.** ¿El paisaje (Sierra de Órganos, La Quemada) o un templo del centro?
3. **Estado vecino (#57).** ¿Cuál va después de los 7 de Zacatecas? Lo decide el dueño.
