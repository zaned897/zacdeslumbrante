// Smoke test de #25: pregunta por la Catedral como lo hace la tarjeta 3D y revisa que el flujo SSE responda.
// Uso: con el servidor corriendo (./scripts/dev.sh), `bun scripts/smoke-ask.ts [base] [veces]`.
import { ZACATECAS_PLACES } from '../src/data/places.ts';
import { buildPlacePrompt, parseSseEvent, type ChatSource } from '../src/scene3d/askAssistant.ts';
import { INITIAL_KNOWLEDGE_BASE } from '../src/data/knowledgeBase.ts';

const base = process.argv[2] ?? 'http://localhost:3000';
const runs = Number(process.argv[3] ?? 3);
const place = ZACATECAS_PLACES.find((p) => p.id === 'catedral-zacatecas');
if (!place) throw new Error('falta catedral-zacatecas en places.ts');

async function askOnce(): Promise<{ text: string; sources: ChatSource[]; done: boolean }> {
  const res = await fetch(`${base}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: buildPlacePrompt(place!, 'es'),
      history: [],
      language: 'es',
      activeKnowledgeUrls: INITIAL_KNOWLEDGE_BASE.filter((k) => k.isEnabled).map((k) => k.url),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  let text = '';
  let sources: ChatSource[] = [];
  let done = false;
  for (const block of raw.split('\n\n')) {
    const event = parseSseEvent(block);
    if (event?.type === 'chunk') text += event.text;
    if (event?.type === 'sources') sources = event.sources;
    if (event?.type === 'error') throw new Error(event.message);
    if (event?.type === 'done') done = true;
  }
  return { text, sources, done };
}

let failed = 0;
for (let i = 1; i <= runs; i++) {
  try {
    const { text, sources, done } = await askOnce();
    const ok = done && text.trim().length > 0;
    console.log(`${ok ? '✓' : '✗'} intento ${i}: ${text.length} caracteres, ${sources.length} fuentes${sources[0] ? ` (${sources[0].url})` : ''}`);
    if (!ok) failed++;
  } catch (err) {
    failed++;
    console.log(`✗ intento ${i}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
process.exit(failed === 0 ? 0 : 1);
