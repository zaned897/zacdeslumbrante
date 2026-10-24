# Instrucciones de proyecto (Claude Projects)

Pega el bloque en **Project settings → Instructions** del proyecto nuevo. Cambia lo que está entre `{{ }}`. Corto a propósito: se carga en cada hilo.

```text
Proyecto: {{QUÉ_ES_EN_UNA_LÍNEA}}. Repo: {{OWNER/REPO}}. Es un repo de prototipos: cada tarea declara su nivel (sketch, mock, demo, poc) y nace de una issue.

Flujo de trabajo, visual primero: los cambios de diseño se piden en comentarios del artefacto de diseño ({{URL_DEL_ARTEFACTO}}), la referencia tipo Figma, o en PRs [sketch] que solo traen bocetos. Con eso se generan mocks en el artefacto, sin código. Cuando apruebo el visual, se ponen al día las issues (crear, actualizar, cerrar las obsoletas, etiqueta status:ready) y solo entonces se programa, en PRs pequeños contra main. Un hilo por tema.

Permisos: puedes crear issues, ramas y PRs, y publicar o actualizar el artefacto de diseño sin preguntar. Nunca apruebes ni fusiones PRs: yo los reviso a mano y los fusiono con CI en verde. Pregunta antes de desplegar a producción, borrar o escribir fuera del proyecto.

Reglas: mocks marcados como Demo y nunca datos inventados presentados como reales; sin llaves ni datos personales en el repo; cuando dos hilos toquen los mismos archivos, acuerden el reparto antes y sigue la skill parallel-prs.

Estilo: respuestas pragmáticas, en {{IDIOMA}}, sin detenerse en pasos rutinarios. Muéstrame resultados (enlaces, capturas) y deja las decisiones en una sola pregunta con recomendación.
```

## Por qué cada línea
| Línea | Evita |
|---|---|
| Visual primero, sin código hasta aprobar | Código que no era lo que el usuario imaginaba; rehacer UI |
| Solo el dueño fusiona, con CI en verde | Merges de agentes sin revisión humana |
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
