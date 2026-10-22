# Licencias de avatares

| Archivo | Autor | Licencia | Origen |
|---|---|---|---|
| `minero.glb` | Proyecto Zacatecas Deslumbrante | CC0 1.0 | `node scripts/gen-avatar-glb.mjs` |
| `danzante.glb` | Proyecto Zacatecas Deslumbrante | CC0 1.0 | `node scripts/gen-avatar-glb.mjs` |
| `visitante.glb` | Proyecto Zacatecas Deslumbrante | CC0 1.0 | `node scripts/gen-avatar-glb.mjs` |

Los tres comparten esqueleto (cadera, hombros, cuello) y animaciones `walk` (piernas y brazos) e `idle` (cabeza). Pasan `gltf-validator` sin errores ni advertencias.

Requisitos para sumar uno: `.glb` < 2 MB, solo PBR básico sin extensiones glTF, Y arriba, mirando a +Z, ≈1.7 m de alto, sin personajes con marca registrada. Si se hace en Blender, conservar los clips `walk` e `idle` con esos nombres.
