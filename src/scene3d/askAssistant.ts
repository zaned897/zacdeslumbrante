import { getStoredKnowledgeBase } from '../data/knowledgeBase';
import type { Language, Place } from '../types';

/** Cita que envía `/api/chat/stream` en el evento `{ sources }` (ver docs/API.md). */
export interface ChatSource {
  n: number;
  title: string;
  url: string;
  fetchedAt: string;
}

export type ChatEvent =
  | { type: 'chunk'; text: string }
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** Misma pregunta que arma `handleAskAboutPlace` en App.tsx. */
export function buildPlacePrompt(place: Place, language: Language): string {
  return language === 'es'
    ? `Cuéntame sobre ${place.nameEs}: su historia documentada, su horario actual (${place.schedule}), costo de acceso (${place.fee}) y leyendas populares asociadas.`
    : `Tell me about ${place.name}: its documented history, current schedule (${place.schedule}), admission fee (${place.fee}), and cultural legends associated with it.`;
}

/** Convierte un bloque `data: ...` del SSE en un evento. */
export function parseSseEvent(block: string): ChatEvent | null {
  const trimmed = block.trim();
  if (!trimmed.startsWith('data: ')) return null;
  const data = trimmed.slice(6);
  if (data === '[DONE]') return { type: 'done' };
  try {
    const parsed = JSON.parse(data) as { chunk?: string; error?: string; sources?: ChatSource[] };
    if (parsed.sources) return { type: 'sources', sources: parsed.sources };
    if (parsed.error) return { type: 'error', message: parsed.error };
    if (parsed.chunk) return { type: 'chunk', text: parsed.chunk };
    return null;
  } catch {
    return { type: 'chunk', text: data };
  }
}

/** Pregunta al asistente con las fuentes activas y emite cada evento del flujo. */
export async function streamChat(
  message: string,
  language: Language,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const activeKnowledgeUrls = getStoredKnowledgeBase()
    .filter((k) => k.isEnabled)
    .map((k) => k.url);
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: [], language, activeKnowledgeUrls }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Server returned ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const event = parseSseEvent(block);
      if (!event) continue;
      onEvent(event);
      if (event.type === 'done') return;
    }
  }
  onEvent({ type: 'done' });
}
