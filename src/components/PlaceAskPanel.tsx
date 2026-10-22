import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, MessageCircle, RotateCw, X } from 'lucide-react';
import type { Language, Place } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { buildPlacePrompt, streamChat, type ChatSource } from '../scene3d/askAssistant';

interface Props {
  place: Place;
  language: Language;
  onClose: () => void;
}

type Phase = 'loading' | 'streaming' | 'done' | 'error';

/** Chat compacto sobre un lugar dentro de la vista 3D (#25). No tapa más de ~45% de la pantalla en celular. */
export const PlaceAskPanel: React.FC<Props> = ({ place, language, onClose }) => {
  const t = TRANSLATIONS[language];
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAnswer('');
    setSources([]);
    setPhase('loading');
    streamChat(
      buildPlacePrompt(place, language),
      language,
      (event) => {
        if (event.type === 'chunk') {
          setPhase('streaming');
          setAnswer((prev) => prev + event.text);
        } else if (event.type === 'sources') {
          setSources(event.sources);
        } else if (event.type === 'error') {
          setAnswer((prev) => `${prev}\n\n⚠️ ${event.message}`);
          setPhase('error');
        } else {
          setPhase((p) => (p === 'error' ? p : 'done'));
        }
      },
      controller.signal,
    ).catch((err: unknown) => {
      if (!controller.signal.aborted) {
        console.warn('PlaceAskPanel:', err);
        setPhase('error');
      }
    });
  }, [place, language]);

  useEffect(() => {
    ask();
    return () => abortRef.current?.abort();
  }, [ask]);

  return (
    <section
      aria-label={t.view3dAskTitle}
      className="absolute inset-x-3 bottom-3 md:bottom-4 md:left-4 md:right-auto md:w-96 z-20 flex flex-col max-h-[45dvh] md:max-h-[60dvh] bg-[#FBF9F5] rounded-xl shadow-xl border border-stone-200"
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-stone-200">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 shrink-0 text-[#9A3412]" />
          <h3 className="font-serif font-bold text-sm text-stone-900 truncate">
            {language === 'es' ? place.nameEs : place.name}
          </h3>
        </div>
        <button onClick={onClose} className="p-1 text-stone-500 hover:text-stone-900 cursor-pointer" aria-label={t.view3dClose}>
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="overflow-y-auto px-4 py-3 text-xs leading-relaxed text-stone-800" aria-live="polite">
        {phase === 'loading' && <p className="text-stone-500">{t.view3dAskThinking}</p>}
        {answer && <p className="whitespace-pre-wrap">{answer}</p>}
        {phase === 'error' && !answer && <p className="text-[#9A3412]">{t.view3dAskError}</p>}

        {sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-stone-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">{t.view3dAskSources}</p>
            <ol className="space-y-1">
              {sources.map((s) => (
                <li key={s.n}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-[#9A3412] hover:underline">
                    <span className="font-semibold">[{s.n}]</span>
                    <span>{s.title}</span>
                    <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                  </a>
                  <span className="ml-1 text-[10px] text-stone-400">{s.fetchedAt}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {phase === 'error' && (
        <button onClick={ask} className="m-3 mt-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#9A3412] rounded-lg cursor-pointer">
          <RotateCw className="w-3.5 h-3.5" />
          {t.view3dAskRetry}
        </button>
      )}
    </section>
  );
};
