---
name: scout
description: Analiza la tarea o situación actual y decide si hace falta una herramienta nueva (MCP, skill, plugin, modelo, librería). Úsala al planear una feature, cuando el hook avise de una capacidad "parked", cuando una tarea se atore por falta de herramienta, o cuando el usuario pregunte qué instalar.
---
# Scout: herramientas justo a tiempo

Objetivo: tener la herramienta correcta en el momento en que hace falta, sin instalar de más ni duplicar.

## 1. Analiza
- ¿Qué va a hacer la tarea? Dilo en una línea.
- Lee `toolbox/capabilities.json`.
  - Si algo en `installed` ya lo cubre → úsalo y termina. No busques más.
  - Si coincide con algo en `parked` → usa su `scout_query` como punto de partida.
- Lee `toolbox/decisions.md` para no reevaluar algo ya descartado (salvo que tenga más de 90 días).

## 2. Decide si de verdad hace falta
Instala solo si se cumple alguna:
- La tarea no se puede hacer bien con lo instalado.
- Ahorra claramente más tokens o tiempo de los que cuesta.
- Es un riesgo de calidad o seguridad no hacerlo (tests, secretos).
Si no, propón aplazarlo y agrégalo a `parked` con sus disparadores.

## 3. Busca (solo si pasó el paso 2)
- Busca en la web el estado actual; prioriza: oficial del proveedor > muy usado y mantenido (commits en los últimos 3 meses) > comunidad.
- Máximo 3 candidatos. Para cada uno: qué cubre, a qué agentes sirve (Claude/Codex/Antigravity), costo en tokens (¿carga muchas tools al contexto?), solapamiento con lo instalado, licencia, riesgo (scripts que ejecuta, permisos que pide).
- Prefiere: skill > MCP > plugin cuando las tres sirvan (las skills solo cargan su descripción hasta usarse).
- Si es una elección de modelo (p. ej. 3D, imágenes), propone una prueba corta con 2 opciones antes de decidir.

## 4. Recomienda y espera
Presenta al usuario: recomendación, alternativa, costo, comando exacto de instalación, cómo deshacerlo. **No instales sin un sí explícito.** Lee el código de cualquier skill o script de terceros antes de instalarlo.

## 5. Registra
Tras instalar (o descartar):
- Mueve/agrega la entrada en `toolbox/capabilities.json` (`installed` con `covers` y `cost`; quita de `parked`).
- Una línea en `toolbox/decisions.md`.
- Si es una skill, va en `.agents/skills/<nombre>/` (carpeta compartida por los 3 agentes).
- Si es MCP de proyecto para Claude, en `.mcp.json`; anota en la entrada qué hacer en Codex/Antigravity si aplica.

## Poda (cada vez que corras scout)
Si algo en `installed` no se ha usado en un mes o quedó cubierto por otra cosa, propón quitarlo.
