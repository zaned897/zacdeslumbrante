---
name: anti-vibe-coding
description: Barandales contra el vibe coding. Busca en el código antes de escribir, trata el contrato (docs/API.md, migraciones) como fuente de verdad, trabaja en pasos atómicos con una prueba en verde y para tras tres intentos fallidos. Úsala antes de escribir una función nueva, agregar un endpoint o un campo de datos, o cuando el mismo error se repite.
---

# Anti vibe coding

## Cuándo
- Antes de escribir una función nueva: puede que ya exista.
- Al agregar un endpoint, un campo de respuesta o una columna.
- Cuando el mismo error sobrevive dos intentos.
- Antes de proponer una regla o convención: seguramente ya está escrita en `AGENTS.md` o en una skill.

## 1. Busca antes de escribir
Si el repo está indexado en `codebase-memory` (MCP; ver `kit/mcp/README.md`), consultarlo no es opcional:

| Pregunta | Herramienta |
|---|---|
| ¿Ya existe? | `search_graph(query="...")` |
| ¿Dónde se define `X`? | `search_graph(name_pattern="...")` |
| ¿Quién lo llama, qué se rompe? | `trace_path(function_name="...", mode="calls")` |

Sin índice, `grep -rn` sobre el repo. Buscar cuesta segundos; duplicar lógica cuesta el resto del proyecto. Un índice viejo miente con seguridad: refréscalo si hay cambios.

## 2. El contrato es un archivo
`docs/API.md` (o el OpenAPI del proyecto) y las migraciones se versionan. Si cambia la superficie, se actualiza en el mismo commit. Para lo que persiste datos el orden es **migración → prueba → lógica**. **Nunca inventes un campo** que no esté en el contrato o en una migración.

## 3. Atómico y con prueba en verde
Una función, una prueba, verde. No pases al siguiente módulo con el actual en rojo. Tres intentos sobre el mismo error ya no es generar código, es estar atorado: usa `desatorar`. Regenerar sin entender el error es la forma más cara de no arreglar nada: reproduce, confirma la causa de dos formas, escribe la prueba que falla y arregla la causa.

## 4. Si no lo puedes explicar, no entra
Dos minutos, en voz alta, por qué el cambio es correcto. Aplica igual al código que escribió un agente. `./scripts/check.sh` y CI no se saltan; la revisión de otro proveedor (`python tools/agentes/delegar.py review`) llega sin el contexto del autor, y por eso sirve.

## Lista
- [ ] ¿Busqué si ya existe?
- [ ] ¿Cargué la skill de lo que estoy tocando?
- [ ] Si persiste datos: ¿migración y contrato primero?
- [ ] ¿Sé qué prueba demuestra que funciona?
- [ ] ¿Está dentro del issue o lo estoy agrandando? (`prototype-scope`)

## Relacionadas
`desatorar`, `prototype-scope`
