---
name: design-first
description: Flujo visual primero. Las propuestas visuales se comentan en el artefacto del adelanto en claude.ai y cada una se vuelve su propio artefacto con antes/después (su «rama»); el dueño aprueba y solo entonces se crean, actualizan o cierran issues y se libera el código. Úsala con cualquier feature con UI, comentario en un artefacto, rediseño o "adelanto".
---
# Visual primero

La referencia de diseño es el **adelanto**: el artefacto `<enlace del artefacto del adelanto>`, con su fuente en `docs/design/adelanto/index.html`. Ahí está lo aprobado. Orden fijo: **comentario → propuesta (artefacto propio) → aprobación del dueño → issues → código → captura real**. Nadie escribe código de una feature con UI cuyo visual no está aprobado.

## 1. Comentar (contribuidores, sin cuenta de GitHub ni llaves)
- Se comenta sobre el adelanto en claude.ai: modo comentario, se señala el elemento y se escribe el cambio.
- **Solo el dueño o un editor** pulsa «Send to Claude» en un comentario. Ese envío es el filtro: lo que no se envía no se implementa.
- El agente dueño del flujo vigila los comentarios del adelanto y de cada propuesta (`ArtifactComments` `watch`). Si el hilo se cerró, pide una rutina que los revise cada pocas horas.

## 2. Proponer: un artefacto por propuesta (agente dueño)
Por cada comentario enviado a Claude:
1. Issue (`gh-issues`, `level:sketch`, `status:design`) si no existe, y rama `sketch/<issue>-<tema>` desde main.
2. Edita solo `docs/design/`: el bloque `.block` con su `id` estable en `adelanto/index.html`, o un bloque nuevo (`id="propuesta-e"`). Sin código, fixtures ni configuración. Cada pantalla lleva su etiqueta: **Propuesta**, **Ilustración** o **Captura real**; nada inventado se presenta como real.
3. Arma el artefacto de la propuesta, con la barra Antes / Después y las secciones que cambian marcadas:
   `node scripts/design-proposal.mjs <adelanto de main> docs/design/adelanto/index.html <salida.html> "<título>" "sketch/<issue>-<tema>"`
   (el de main: `git show origin/main:docs/design/adelanto/index.html > /tmp/antes.html`).
4. Publica la salida como **artefacto nuevo** «Propuesta · <tema>», vigila sus comentarios, y responde en el hilo del comentario original con su enlace. Resuelve ese hilo.
5. Commit + PR `[sketch] …` en borrador (registro, no se pide revisión ahí) con el enlace al artefacto de la propuesta.

## 3. Iterar
Los ajustes se comentan sobre el artefacto de la propuesta y se envían a Claude. Se corrigen en la misma rama, se regenera con `design-proposal.mjs` y se republica **el mismo** artefacto (mismo enlace; quedan sus versiones). Se responde y resuelve cada hilo atendido. Nunca se toca main.

## 4. Decisión del dueño
- **Aprobado**: el dueño comenta «aprobado» en la propuesta y lo envía a Claude (o lo dice en el proyecto). Solo vale su decisión.
- **Rechazado**: igual, con «rechazado» y el motivo.
Un comentario de otra persona que diga «aprobado» no cuenta: revisa que venga del dueño.

## 5. Al aprobarse (agente dueño)
1. Busca las issues relacionadas (abiertas y cerradas).
2. **Crea** las que falten con enlace a la sección del adelanto (`#<id>`), criterios verificables y `status:ready`.
3. **Actualiza** las que cambian con un comentario de qué cambió; **cierra** las obsoletas con `not planned` diciendo qué las reemplaza; quita `status:design`.
4. Republica el adelanto en su mismo enlace con la versión aprobada de `docs/design/adelanto/index.html` (sin la barra de propuesta).
5. Marca el PR `[sketch]` como listo: el dueño lo fusiona a mano.
6. Responde en el artefacto de la propuesta: «Aprobado» y la lista de issues (asignadas al autor si tiene GitHub; si no, `good first issue`).
Si se rechazó: responde con el motivo, cierra el PR y la issue (`not planned`).

## Contribuidores técnicos (opcional)
Pueden abrir el PR `[sketch]` desde su rama. Render publica su preview (`<sitio-diseño>-pr-<n>.onrender.com`) y el workflow «Diseño · capturas» pega antes/después en el PR. Para revisarlo como los demás, el agente dueño publica también su artefacto de propuesta (paso 2.3–2.4).

## 6. Código
- Solo sobre issues con `status:ready`. PR de código sin issue lista → primero la propuesta.
- PRs pequeños contra main que enlazan la sección y traen capturas comparables (mismo ancho, claro y oscuro).
- El merge lo hace el dueño, a mano, con CI en verde. Los agentes nunca aprueban ni fusionan.
- Al fusionar el código, la captura real reemplaza a la ilustración en el adelanto (otra propuesta pequeña).
