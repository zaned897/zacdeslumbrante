---
name: desatorar
description: Qué hacer cuando el trabajo se atora. Umbrales de tiempo, la escalera de alternativas (recortar, stub ruidoso, camino alterno, spike con tiempo, escalar), lo prohibido mientras estás atorado y la plantilla para escalar. Úsala cuando el mismo error se repite, falta hardware, una credencial o una decisión, o te tienta falsear datos para pasar una prueba.
---

# Desatorar

> **Reintentar en silencio es el peor resultado.** Cambia de estrategia o entrega una alternativa.

## Umbrales
| Señal | Umbral |
|---|---|
| Mismo error tras intentos distintos | **3 intentos** |
| Un subproblema sin avance medible | **~45 min** |
| Falta algo (hardware, credencial, manual, decisión) | Inmediato |
| El arreglo cambia un contrato o infraestructura no acordada | Inmediato |
| Las pruebas solo pasan desactivando o falseando algo | Inmediato |

## Escalera de alternativas
1. **Recorta a una rebanada vertical.** Lo más delgado de punta a punta; el resto va a un issue.
2. **Stub ruidoso detrás de la interfaz.** `raise NotImplementedError("... #issue")`. Nunca un valor falso.
3. **Camino alterno.** Sin el equipo real → fixtures o captura de datos crudos; sin el servicio → mock marcado como Demo.
4. **Spike con tiempo fijo.** Pregunta concreta, tiempo explícito, sale con una recomendación escrita (nivel `poc`).
5. **Escala al usuario.** Solo decisiones o recursos que el agente no puede conseguir. Entrega antes todo lo que no dependía de la respuesta.

## Prohibido mientras estás atorado
- Falsear datos para que pase una prueba.
- `try/except` vacío para esconder el síntoma.
- Desactivar o borrar pruebas que estorban.
- Reescribir medio repo porque el primer enfoque falló.
- Cambiar el contrato de datos sin issue y migración.
- Reportar como terminado algo a medias.

## Plantilla para escalar
**Bloqueo** · **Qué se intentó** (numerado, con resultado) · **Causa o hipótesis** · **Opciones** (tabla: costo, riesgo, ¿reversible?) · **Recomendación** (una, con razón) · **Entregado mientras tanto** (lo que sí funciona y está probado).

## Relacionadas
`anti-vibe-coding`, `relay`
