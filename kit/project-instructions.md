# Instrucciones de proyecto (Claude Projects)

Pega el bloque en **Project settings → Instructions** del proyecto nuevo. Cambia lo que está entre `{{ }}`. Corto a propósito: se carga en cada hilo.

```text
Proyecto: {{QUÉ_ES_EN_UNA_LÍNEA}}. Repo: {{OWNER/REPO}}. Es un repo de prototipos: cada tarea declara su nivel (sketch, mock, demo, poc) y nace de una issue.

Flujo de trabajo: cada feature nueva se propone primero como diseño en el artefacto de diseño ({{URL_DEL_ARTEFACTO}}), que es la referencia tipo Figma del proyecto. Cuando lo apruebo, se crean issues detalladas en GitHub y luego el código, en PRs pequeños contra main. Un hilo por tema; si un pedido es de otro tema, va a otro hilo.

Permisos: puedes crear issues, ramas y PRs, y publicar o actualizar el artefacto de diseño sin preguntar. Pregunta antes de fusionar, desplegar a producción, borrar o escribir fuera del proyecto.

Reglas: mocks marcados como Demo y nunca datos inventados presentados como reales; sin llaves ni datos personales en el repo; cuando dos hilos toquen los mismos archivos, acuerden el reparto antes y sigue la skill parallel-prs.

Estilo: respuestas pragmáticas, en {{IDIOMA}}, sin detenerse en pasos rutinarios. Muéstrame resultados (enlaces, capturas) y deja las decisiones en una sola pregunta con recomendación.
```

## Por qué cada línea
| Línea | Evita |
|---|---|
| Diseño primero en un artefacto | Código que no era lo que el usuario imaginaba; rehacer UI |
| Issues detalladas antes del código | Trabajo que nadie más puede tomar (taller, contribuidores) |
| Un hilo por tema, PR pequeño a main | Hilos gigantes y PRs que se pisan |
| Permisos explícitos | Hilos parados horas esperando un "sí" rutinario |
| Mocks honestos | Respuestas de IA con horarios o negocios inventados en una demo |
| Reparto de archivos | Conflictos entre hilos paralelos |

## Pedidos que funcionaron bien (para copiar)
- «Dame un adelanto de cómo se verá la app al cerrar los tickets» → crea el artefacto de diseño a partir de issues y PRs reales.
- «Propón X en el adelanto» → pantallas en «Propuestas por aprobar» y una tarjeta de decisión.
- «Revisa las notas del taller en Drive y compáralas con el repo» → informe de faltantes, contradicciones e issues sugeridas.
- «Planea el despliegue en otro hilo» → plan comparativo, luego PR con el blueprint.
- «Crea listas de issues como guía del taller» → épica + hijas con `good first issue`.
