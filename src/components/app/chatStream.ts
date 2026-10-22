import { ChatMessage, Language, SourceCitation } from '../../types';

interface StreamChatOptions {
  message: string;
  history: ChatMessage[];
  language: Language;
  activeKnowledgeUrls: string[];
  signal?: AbortSignal;
  onText: (accumulated: string) => void;
  onSources: (citations: SourceCitation[]) => void;
}

/**
 * Cliente SSE de /api/chat/stream: { sources } (fragmentos citados), { chunk }, { error } y [DONE].
 * PROTO: App.tsx todavía tiene su propia copia de este bucle; unificar cuando se toque el chat principal.
 */
export async function streamChat(opts: StreamChatOptions): Promise<string> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: opts.message,
      history: opts.history.slice(-6),
      language: opts.language,
      activeKnowledgeUrls: opts.activeKnowledgeUrls,
    }),
    signal: opts.signal,
  });
  if (!response.ok || !response.body) throw new Error(`Server returned ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let text = '';
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return text;
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed.sources)) {
          opts.onSources(
            (parsed.sources as { n: number; title: string; url: string; fetchedAt: string }[])
              .sort((a, b) => a.n - b.n)
              .map((s) => ({ title: s.title, url: s.url, verificationDate: s.fetchedAt })),
          );
        } else if (parsed.chunk) {
          text += parsed.chunk;
          opts.onText(text);
        } else if (parsed.error) {
          text += `\n\n⚠️ ${parsed.error}`;
          opts.onText(text);
        }
      } catch {
        text += data;
        opts.onText(text);
      }
    }
  }
  if (buffer.trim() === 'data: [DONE]') return text;
  // Sin [DONE] el flujo se cortó: no mostrar la respuesta parcial como completa.
  throw new Error('chat stream ended before [DONE]');
}
