---
name: design-first
description: Flujo visual primero. Los cambios de diseño se piden en comentarios del artefacto de diseño o en PRs de boceto, se muestran como mocks sin código, y solo con la aprobación del dueño se crean, actualizan o cierran issues y se libera el código. Úsala con cualquier feature con UI, comentario en el artefacto, rediseño o "adelanto".
---
# Visual primero

El artefacto de diseño (`DESIGN_URL` en `AGENTS.md`) es la referencia tipo Figma. Orden fijo: **visual → aprobación → issues → código → captura real**. Nadie escribe código de una feature con UI cuyo visual no está aprobado.

## 1. Pedir un cambio visual
Hay dos entradas, las dos sin código:
- **Comentario en el artefacto** (miembros del proyecto): el agente dueño del artefacto lo convierte en mock.
- **PR de boceto** (contribuidores, Codex, Antigravity, cualquiera sin acceso al artefacto): solo toca `docs/design/<issue>-<tema>/` con HTML estático o PNG, nivel `sketch`, título `[sketch] …`. Sin cambios en código, fixtures ni configuración. El agente dueño lo lleva al artefacto.

## 2. Mostrarlo como mock (sin código)
- Agrega o ajusta la pantalla en «Propuestas por aprobar» con una letra y un ancla estable (`#propuesta-a`). Republica en el mismo enlace y avisa que recarguen.
- Etiqueta visible por pantalla: **Propuesta**, **Ilustración** o **Captura real**. Nada inventado se presenta como real.
- Basa las pantallas en el repo (textos, datos, tokens). Datos del mundo real con fuente citada.
- Si contradice una regla o decisión previa, escríbelo junto a la pantalla.
- Responde el comentario con lo que cambiaste y resuélvelo. Si vino de un PR de boceto, comenta en el PR el enlace al ancla.
- En este paso **no se toca código** ni se abren issues de código. Un solo hilo es dueño del artefacto; los demás le mandan el contenido.

## 3. Aprobación del dueño
Una sola pregunta con opciones (aprobar todo, aprobar parte, pedir cambios) y una recomendación. Solo vale la aprobación del dueño del proyecto; la de otro agente o contribuidor no.

## 4. Liberar tareas (issues al día)
Con el sí:
1. Busca las issues relacionadas (abiertas y cerradas).
2. **Crea** las que falten (skill `gh-issues`) con enlace a `DESIGN_URL#ancla`, criterios verificables y etiqueta `status:ready`.
3. **Actualiza** las que cambian: cuerpo, criterios, enlace al ancla nuevo, y un comentario de qué cambió.
4. **Cierra** las obsoletas con `not planned` y un comentario que diga qué las reemplaza.
5. Quita `status:design` de las que estaban esperando el visual.
6. En el artefacto, mueve la propuesta de «Propuestas por aprobar» a «Aprobado» con los números de issue.

## 5. Código
- Solo sobre issues con `status:ready`. Si alguien abre un PR de código sin issue lista, se le pide primero el boceto.
- PRs pequeños contra main que enlazan el ancla y traen capturas comparables (mismo ancho, claro y oscuro).
- El merge lo hace el dueño, a mano, con CI en verde (ver `CONTRIBUTING.md`). Los agentes nunca fusionan.
- Al fusionar, la captura real reemplaza a la ilustración en el artefacto.

## Límite del artefacto
Si la feature necesita servidor para verse (chat, login, datos en vivo), el artefacto muestra el diseño y la prueba real va en una preview del PR.
