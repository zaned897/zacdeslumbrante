---
name: design-first
description: Propone cada feature nueva como pantallas en el artefacto de diseño del proyecto (la referencia tipo Figma), pide aprobación y solo después escribe issues y código. Úsala cuando el usuario pida una feature con UI, un rediseño o un "adelanto" de cómo se verá la app.
---
# Diseño primero

El artefacto de diseño (una página HTML publicada, enlazada en `AGENTS.md` como `DESIGN_URL`) es la fuente de verdad visual. Flujo: **proponer → aprobar → issues → código → captura real**.

## 1. Proponer
- Antes de dibujar, lee las issues y PRs relacionados y los tokens de diseño del repo: las pantallas se basan en lo real (textos, nombres, datos del repo), no en relleno.
- Agrega la propuesta en la sección **«Propuestas por aprobar»** del mismo artefacto, con una letra (A, B, C…) y un ancla estable (`#propuesta-a`, `#temporada`, …). Nunca publiques en un enlace nuevo: republica el mismo.
- Cada pantalla lleva una etiqueta visible: **Propuesta** (morado), **Ilustración** o **Captura real**. Nada inventado se presenta como real.
- Si una propuesta contradice una regla o decisión previa, escríbelo junto a la pantalla.
- Si varios hilos editan el artefacto, uno solo es su dueño; los demás le mandan el contenido. Al republicar, conserva las secciones de otros.
- Datos del mundo real (fechas, rutas, horarios): confírmalos con una fuente pública y cítala en la propuesta.

## 2. Aprobar
- Pide la decisión en una sola pregunta con opciones (aprobar todo, aprobar parte, pedir cambios) y una recomendación.
- Los comentarios del usuario en el artefacto son pedidos de cambio: aplícalos, republica y resuelve el comentario.
- Mientras esperas, no escribas código de esa feature.

## 3. Issues
Con el sí, crea issues detalladas (skill `gh-issues`) que enlacen a `DESIGN_URL#ancla`. Épica + hijas si es grande. Etiqueta `status:design` se quita al aprobar.

## 4. Código y cierre
- Implementa en PRs pequeños (`orchestrate`, `parallel-prs`). El PR enlaza el ancla y trae capturas comparables con la ilustración (mismo ancho, claro y oscuro).
- Al fusionar, reemplaza la ilustración por la captura real en el artefacto y actualiza la tabla de estado del final («qué falta por pantalla»).

## Cuándo no usar el artefacto
Si la feature necesita servidor para verse (chat, login, datos en vivo), el artefacto muestra el diseño y la prueba real va en una preview del PR (p. ej. Render con `[render preview]` en el título).
