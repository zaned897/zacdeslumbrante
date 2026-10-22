import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square, X } from 'lucide-react';
import { ChatMessage, Language, Place } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { getStoredKnowledgeBase } from '../../data/knowledgeBase';
import { ChatMessageItem } from '../ChatMessageItem';
import { streamChat } from './chatStream';

interface MapAssistantSheetProps {
  language: Language;
  place: Place;
  onClose: () => void;
}

/**
 * Asistente dentro del mapa (pantalla 6 del adelanto): hoja inferior con un chat
 * acotado al lugar seleccionado. Lo monta Map3DView; la conversación vive solo aquí.
 */
export const MapAssistantSheet: React.FC<MapAssistantSheetProps> = ({ language, place, onClose }) => {
  const t = TRANSLATIONS[language];
  const name = language === 'es' ? place.nameEs : place.name;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Otro lugar, otra conversación.
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setBusy(false);
  }, [place.id]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: q, timestamp: Date.now() };
    const aId = `a-${Date.now()}`;
    const history = messages;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: aId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true },
    ]);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const update = (patch: Partial<ChatMessage>) =>
      setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, ...patch } : m)));
    try {
      await streamChat({
        // El modelo no ve el mapa: el lugar va explícito en la pregunta.
        message: language === 'es' ? `Sobre ${place.nameEs}: ${q}` : `About ${place.name}: ${q}`,
        history,
        language,
        activeKnowledgeUrls: getStoredKnowledgeBase()
          .filter((k) => k.isEnabled)
          .map((k) => k.url),
        signal: controller.signal,
        onText: (content) => update({ content }),
        onSources: (citations) => update({ citations }),
      });
      update({ isStreaming: false });
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        // Si el flujo se cortó a medias, se conserva lo recibido y se marca el error debajo.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aId
              ? {
                  ...m,
                  content: m.content ? `${m.content}

⚠️ ${t.mapAssistantError}` : `⚠️ ${t.mapAssistantError}`,
                  isStreaming: false,
                  isError: true,
                }
              : m,
          ),
        );
      } else {
        update({ isStreaming: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [t.mapAssistantSuggest1, t.mapAssistantSuggest2, t.mapAssistantSuggest3];

  return (
    <section
      className="absolute inset-x-0 bottom-0 top-[46%] z-30 flex flex-col bg-papel rounded-t-[22px] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.3)] md:inset-x-auto md:right-4 md:bottom-4 md:top-auto md:w-96 md:h-[60%] md:rounded-[22px]"
      aria-label={t.mapAssistantAbout.replace('{name}', name)}
    >
      <span className="self-center mt-2 w-9 h-1 rounded-full bg-stone-300 md:hidden" aria-hidden="true" />
      <header className="flex items-center gap-2 px-4 pt-2 pb-2 border-b border-linea text-xs font-semibold text-stone-600">
        <span className="w-6 h-6 rounded-md shrink-0" style={{ background: place.color || '#C9826B' }} aria-hidden="true" />
        <span className="truncate">{t.mapAssistantAbout.replace('{name}', name)}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-1 rounded-md text-stone-400 hover:text-stone-700 cursor-pointer"
          aria-label={t.view3dClose}
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-3">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="px-3 py-1.5 text-xs font-semibold text-cantera bg-white border border-[#E7DCCB] rounded-full hover:bg-caliza cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m) => (
            <ChatMessageItem key={m.id} message={m} language={language} onPlaceClick={() => undefined} />
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mx-3 mt-1 mb-3 flex items-center gap-1 pl-4 pr-1.5 py-1.5 bg-white border border-[#E7DCCB] rounded-full focus-within:border-cantera"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.mapAssistantPlaceholder.replace('{name}', name)}
          className="flex-1 min-w-0 py-1.5 text-sm bg-transparent focus:outline-none placeholder:text-stone-400"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="w-8 h-8 grid place-items-center rounded-full bg-carbon text-white cursor-pointer shrink-0"
            aria-label={t.stopStreaming}
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-8 h-8 grid place-items-center rounded-full bg-cantera text-white disabled:opacity-35 cursor-pointer shrink-0"
            aria-label={t.sendButton}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
      </form>
    </section>
  );
};
