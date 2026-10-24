---
name: design-first
description: Flujo visual primero. Las propuestas visuales viven en la rama de un PR [sketch] con su propia preview y capturas antes/después; el dueño aprueba con el merge y solo entonces se crean, actualizan o cierran issues y se libera el código. Úsala con cualquier feature con UI, comentario en el artefacto, rediseño o "adelanto".
---
# Visual primero

La referencia de diseño vive en el repo: `docs/design/adelanto/index.html` (el «adelanto»). En main está lo aprobado. Orden fijo: **visual en su rama → aprobación (merge) → issues → código → captura real**. Nadie escribe código de una feature con UI cuyo visual no está aprobado.

## 1. Proponer en una rama
- Rama `sketch/<issue>-<tema>` desde main. Solo toca `docs/design/`: edita el adelanto (agrega o cambia un bloque `.block` con `id` estable, p. ej. `id="propuesta-e"`) o agrega un boceto en `docs/design/<issue>-<tema>/`. Sin código, fixtures ni configuración.
- Cada pantalla lleva su etiqueta visible: **Propuesta**, **Ilustración** o **Captura real**. Nada inventado se presenta como real; datos del mundo real con fuente citada. Si contradice una regla previa, dilo junto a la pantalla.
- PR `[sketch] …` contra main con la plantilla. Al abrirlo:
  - Render publica la preview del PR (`zacdes-diseno-pr-<n>.onrender.com`), que es el «después». Main es el «antes».
  - El workflow «Diseño · capturas» pega en el PR las capturas antes/después de cada sección que cambia y los enlaces a `comparar.html` (lado a lado).
- Comentarios: en el sitio de diseño (Render) el botón «💬 Comentar esta sección» (`docs/design/comentar.js`) abre una issue con la plantilla `diseno.yml` (`area:design`, `status:design`); en claude.ai comentan los miembros con acceso. El agente dueño convierte cada comentario en un PR `[sketch]` (con `Refs #issue`) y responde con su enlace. El sitio es estático: no guarda comentarios por sí mismo.

## 2. Iterar en la rama
Los pedidos de cambio llegan como revisión del PR («Request changes»). Se corrigen con commits en la misma rama; la preview y las capturas se actualizan solas. Nunca se toca main.

## 3. Decisión del dueño
- **Aprobado** = el dueño hace merge del PR `[sketch]`. Solo vale su decisión, no la de otro agente o contribuidor.
- **Rechazado** = el dueño cierra el PR con un comentario.

## 4. Al aprobarse (agente dueño del flujo)
1. Busca las issues relacionadas (abiertas y cerradas).
2. **Crea** las que falten (`gh-issues`) con enlace al ancla en main (`https://zacdes-diseno.onrender.com/adelanto/#<id>`), criterios verificables y `status:ready`.
3. **Actualiza** las que cambian (cuerpo, criterios, ancla) con un comentario de qué cambió; **cierra** las obsoletas con `not planned` diciendo qué las reemplaza; quita `status:design`.
4. **Avisa en el PR fusionado**: «Aprobado» y la lista de issues, asignando al autor las que va a trabajar (o `good first issue` si son para cualquiera).
5. Republica la copia del adelanto en claude.ai desde `docs/design/adelanto/index.html` de main, en el mismo enlace.
Si se rechazó: comenta en el PR cerrado el motivo y, si aplica, cierra o reetiqueta su issue.

## 5. Código
- Solo sobre issues con `status:ready`. PR de código sin issue lista → se pide primero el `[sketch]`.
- PRs pequeños contra main que enlazan el ancla y traen capturas comparables (mismo ancho, claro y oscuro).
- El merge lo hace el dueño, a mano, con CI en verde. Los agentes nunca aprueban ni fusionan.
- Al fusionar el código, la captura real reemplaza a la ilustración en el adelanto (otro PR `[sketch]` pequeño).
