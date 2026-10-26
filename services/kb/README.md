# PoC · Base de conocimientos real

**Pregunta de la PoC:** ¿las 27 fuentes oficiales de `src/data/knowledgeBase.ts` dan texto suficiente para que el chat responda citando fragmentos reales, en vez de solo nombrarlas en el prompt?

Hoy el chat de `server.ts` lista las URLs en el prompt pero nunca las lee. Esta PoC las descarga, las parte en fragmentos y las busca con BM25 (sin embeddings ni dependencias pesadas), y mide el resultado.

## Correr
```bash
cd services/kb
uv sync
uv run python -m kb.ingest      # descarga → data/corpus.jsonl + data/ingest-report.json
uv run python -m kb.search "¿Qué es el Salón de las Columnas?"
uv run python -m kb.evaluate    # acierto@3 sobre eval/questions.json
uv run pytest                   # tests sin red
```
`data/` no se versiona: se regenera con `kb.ingest`.

`snapshot/` sí se versiona (#109): es la última ingesta buena hecha desde una PC (843 fragmentos de 24/27 fuentes, 22 oct 2026). En Render, si la ingesta no deja fragmentos porque los portales bloquean la nube, `scripts/render-build.sh` copia este snapshot a `data/`. Cada fragmento conserva su URL y su fecha de consulta, y el chat los cita así. Para refrescarlo: correr `kb.ingest` en una PC y copiar `data/corpus.jsonl` y `data/ingest-report.json` a `snapshot/`.

## Qué hace
- `kb/sources.py` lee las fuentes directo del TS (una sola lista).
- `kb/ingest.py` respeta `robots.txt`, se identifica con un User-Agent propio, baja la URL de cada fuente y hasta 7 enlaces internos (profundidad 1) y reporta por fuente: `ok`, `empty` (casi siempre sitios que arman el contenido con JS), `http-error` o `blocked-by-robots`.
- `kb/search.py` hace BM25 con acentos y plurales normalizados, máximo 2 fragmentos por fuente, y `prompt_context()` arma el bloque `[n] texto (Fuente: título · url · fecha)` para el prompt del chat.
- `kb/evaluate.py` cuenta aciertos@k y separa las preguntas cuya fuente no dio texto.

## Atajos `PROTO:`
- Lectura de fuentes con regex sobre el TS.
- Rastreo de profundidad 1 con un tope de páginas por fuente (`--max-pages`, 8 por defecto).
- Plural ingenuo en vez de stemmer.
- Las fuentes esperadas de `eval/questions.json` son hipótesis.

## Límites conocidos
- BM25 no cruza idiomas: una pregunta en inglés no encuentra texto en español. Si esto pesa, el siguiente paso es embeddings multilingües o traducir la consulta antes de buscar.
- Por ahora es un paquete aparte. Cuando exista `services/api/` (etapa 7 de `SETUP.md`), el servicio de chat lo importa o se mueve a `app/services/knowledge.py`.

## Conexión con el chat
`server.ts` busca en `data/corpus.jsonl` con `src/server/knowledgeSearch.ts`, un port del BM25 de `kb/search.py`. Si encuentra fragmentos:
- manda el evento SSE `{ sources }`;
- los pone en el prompt de Gemini con su número y URL;
- si Gemini está saturado, los muestra tal cual en lugar del texto escrito a mano.

Sin corpus, el chat funciona como antes. Después de cada `kb.ingest` no hace falta reiniciar el servidor: el corpus se relee cuando cambia.
