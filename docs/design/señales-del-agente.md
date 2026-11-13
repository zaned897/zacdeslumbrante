# Señales del agente: afluencia, espera, promociones y recomendaciones

> Nivel: **boceto** (#166). Reglas para acordar antes de programar el agente (#165) y los reportes de visitantes (#174). Nada aquí es código.

## La idea en un minuto

El agente arma el paseo con lo que el visitante tiene y quiere: tiempo, intereses, presupuesto y si tiene hambre. Encima de eso usa señales de otras personas: cuánta gente hay, cuánto se espera, si un puesto tiene promoción, qué recomiendan otros visitantes y si alguien reportó un dato incorrecto.

Ninguna señal cambia qué es bueno. Las señales cambian **cuánto tiempo cuesta** una parada, o **desempatan** entre paradas que ya le sirven al visitante. Mucha gente es señal de **espera**, no de calidad (regla de #152).

## Las cinco señales

| Señal | Campo en la API | De dónde sale | Cuánto vale | Qué cambia en el plan |
|---|---|---|---|---|
| Afluencia | `crowd`: `baja`, `media` o `alta` | Reportes de visitantes (#174). En el mundo de prueba, `reports.json` por franja horaria (#170). | Un reporte en vivo, **45 min**. El patrón de la franja horaria («suele») sirve de respaldo y se dice como tal. | Nada por sí sola: solo alimenta la espera estimada. |
| Espera estimada | `waitMin` | Un reporte de espera en minutos. Si no hay, se deriva de la afluencia: baja 0–5, media 5–15, alta 15–30 min. | Reporte directo, **30 min**. La derivada vale lo mismo que la afluencia de la que sale. | Se suma al tiempo de la parada. Si se come el plan, el agente ofrece otra opción (`avoid[]` de #165). |
| Promoción vigente | `promotion` | El puesto, al darse de alta o al editarse; queda en revisión (#172). En el mundo de prueba, `promotions.json`. | Hasta su `end`. Fuera de vigencia no se muestra. | Solo desempata entre paradas equivalentes. Nunca sube una parada que no encaja con los intereses o el tiempo. |
| Recomendación de visitantes | `recommendations` | Visitantes que estuvieron ahí (#174), con un motivo corto («comer rápido», «para niños»). | **90 días**. | Desempata a favor de la parada si el motivo coincide con un interés del visitante. Se menciona solo con 3 o más recomendaciones distintas. |
| Reporte de dato incorrecto | `reports` (pendientes de revisión) | Visitantes: horario, precio o ubicación que no coincide. | Hasta que alguien lo revise, o **14 días**. | El dato queda «por confirmar». Con 2 o más reportes de «cerrado» en 7 días, la parada sale del plan hasta la revisión. |

### Afluencia y recomendación van separadas
- La recomendación nunca se calcula a partir de cuánta gente hay, ni la afluencia a partir de las recomendaciones.
- Un lugar lleno puede no tener ninguna recomendación, y uno vacío puede tener muchas.
- En la API son campos distintos y en la pantalla van en líneas distintas.

### Orden del plan
1. **Reglas duras:** el lugar está abierto a la hora en que se llega, cabe en el tiempo disponible y respeta `avoid[]`.
2. **Interés:** coincide con lo que el visitante pidió («hambre», «museos», «niños»).
3. **Costo de tiempo:** caminata + estancia + `waitMin`. Con poco tiempo, gana la parada que deja más margen.
4. **Desempates, en este orden:**
   - una recomendación que coincide con un interés;
   - la distancia más corta;
   - una promoción vigente.

La afluencia no aparece en esta lista: entra solo a través de la espera.

## Cómo lo dice el agente

El agente explica cada parada en una línea (`reason` en #165). Las frases dicen de dónde sale el dato y qué tan reciente es.

| Situación | Frase |
|---|---|
| Afluencia alta, reporte reciente | «Hay afluencia alta; podría haber espera.» |
| Afluencia por patrón, sin reporte | «A esta hora suele haber más gente.» |
| Espera reportada | «Espera de unos 15 min, según un reporte de hace 10 min.» |
| Espera estimada | «Espera estimada de 5 a 15 min.» |
| Espera que no cabe | «Hay espera larga. ¿Te propongo otra opción cerca?» |
| Promoción | «Tiene una promoción hasta las 18:00 (dato del puesto).» |
| Recomendación | «3 visitantes la recomiendan para comer rápido.» |
| Dato por confirmar | «Un visitante reportó que el horario cambió; confírmalo al llegar.» |

## Lo que el agente nunca hace
- Presentar «mucha gente» como prueba de calidad («¡es tan bueno que está lleno!»).
- Premiar reseñas positivas: las recompensas (#155) reconocen aportes útiles y no dependen de si el comentario es bueno o malo.
- Mostrar un ranking público de puestos o una calificación con estrellas.
- Mostrar un dato caducado como si fuera de ahora, o una espera estimada como si fuera un reporte.
- Mostrar el contacto de quien dio de alta un puesto (#172).
- Cobrar, reservar o convertir una promoción en cupón canjeable (regla de #153).
- Usar la ubicación exacta del visitante fuera del dispositivo.

## En el mundo de prueba (#170)
- Todo lleva `"_mock": true`. Los reportes de prueba son **patrones por franja horaria**, así que el agente los dice como «suele».
- La hora del escenario (`at` en #171, o el simulador #175) decide qué franja aplica: el mediodía tiene más gente que las 9:00.
- Las recomendaciones de prueba vienen de visitantes ficticios (`visitors.json`) y se ven claramente inventadas.

## Preguntas abiertas
1. ¿45 minutos es razonable para un reporte de afluencia en vivo, o conviene menos en hora pico?
2. ¿Tres recomendaciones bastan para mencionarlas, o conviene pedir más cuando haya visitantes reales?
