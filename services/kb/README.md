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
`data/` no se versiona: es contenido de terceros y se regenera con `kb.ingest`.

## Qué hace
- `kb/sources.py` lee las fuentes directo del TS (una sola lista).
- `kb/ingest.py` respeta `robots.txt`, se identifica con un User-Agent propio, baja **solo la URL de cada fuente** y reporta por fuente: `ok`, `empty` (casi siempre sitios que arman el contenido con JS), `http-error` o `blocked-by-robots`.
- `kb/search.py` hace BM25 con acentos y plurales normalizados, máximo 2 fragmentos por fuente, y `prompt_context()` arma el bloque `[n] texto (Fuente: título · url · fecha)` para el prompt del chat.
- `kb/evaluate.py` cuenta aciertos@k y separa las preguntas cuya fuente no dio texto.

## Atajos `PROTO:`
- Lectura de fuentes con regex sobre el TS.
- Sin rastreo de enlaces internos: una página por fuente.
- Plural ingenuo en vez de stemmer.
- Las fuentes esperadas de `eval/questions.json` son hipótesis.

## Límites conocidos
- BM25 no cruza idiomas: una pregunta en inglés no encuentra texto en español. Si esto pesa, el siguiente paso es embeddings multilingües o traducir la consulta antes de buscar.
- Por ahora es un paquete aparte. Cuando exista `services/api/` (etapa 7 de `SETUP.md`), el servicio de chat lo importa o se mueve a `app/services/knowledge.py`.
