---
name: prototype-scope
description: Define y vigila el nivel de madurez de cada tarea (boceto, mock, demo, PoC). Úsala al empezar cualquier issue o feature, al estimar, y cuando una tarea empiece a crecer más de lo pedido.
---
# Alcance de prototipo

Este repo produce **prototipos**, no producto. Cada issue, rama y PR declara un nivel. El trabajo termina cuando cumple su nivel, no antes ni después.

## Niveles
| Nivel | Etiqueta | Qué es | Hecho cuando | Prohibido |
|---|---|---|---|---|
| Boceto | `level:sketch` | Idea visual o de flujo: markdown, diagrama, HTML estático, wireframe | Se entiende la idea en 1 minuto | Código de backend |
| Mock | `level:mock` | UI o endpoint que responde con datos fijos de `fixtures/` | Se puede navegar/llamar y devuelve datos realistas | Lógica real, servicios externos |
| Demo | `level:demo` | Flujo de punta a punta presentable, puede mezclar real y mock | Un guion de demo de 2 min funciona 3 veces seguidas | Auth, pagos, datos personales reales |
| PoC | `level:poc` | Prueba que algo técnico es viable (un modelo, una API, rendimiento) | Responde la pregunta de la issue con evidencia (números, capturas) | Pulir UI, cubrir casos borde |

## Reglas
- **Sube de nivel solo con una issue nueva.** Si al hacer un mock te dan ganas de conectar la API real, eso es otra issue.
- **Los mocks se ven como mocks:** datos en `fixtures/` (JSON), con `"_mock": true` en la respuesta o un badge "Demo" en la UI. Nunca datos inventados presentados como reales (precios, horarios, reseñas, contactos).
- **Costuras para después:** aunque sea mock, respeta el contrato de `docs/API.md` y los tipos; así el reemplazo por lo real no rompe el frontend.
- **Sin deuda oculta:** atajos permitidos, pero marcados con `# PROTO:` / `// PROTO:` y una línea de por qué.
- **Nada de secretos ni datos personales**, en ningún nivel.
- **Tests:** sketch y mock → ninguno obligatorio; demo → 1 smoke test del flujo; PoC → el script o test que produce la evidencia.

## Al cerrar
En el PR: nivel, cómo verlo/correrlo (comando o URL), evidencia (captura, gif o números), lista de `PROTO:` añadidos, y qué issue sería el siguiente nivel (propónla, no la implementes).
