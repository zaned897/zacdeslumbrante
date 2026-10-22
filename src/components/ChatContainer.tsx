import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square, Sparkles, Landmark, Pickaxe, Mountain, UtensilsCrossed, Box, Route } from 'lucide-react';
import { ChatMessage, Language, Place, KnowledgeBaseURL } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { ChatMessageItem } from './ChatMessageItem';
import { ZACATECAS_PLACES } from '../data/places';

interface ChatContainerProps {
  language: Language;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  onPlaceClick: (place: Place) => void;
  onSelectPrompt: (prompt: string) => void;
  knowledgeBase: KnowledgeBaseURL[];
  onOpen3d?: () => void;
  onOpenPlans?: () => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  language,
  messages,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  onPlaceClick,
  onSelectPrompt,
  knowledgeBase,
  onOpen3d,
  onOpenPlans,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const t = TRANSLATIONS[language];

  // Auto-scroll when new messages or stream chunks arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const topics = [
    { icon: Landmark, label: language === 'es' ? 'Catedral y centro UNESCO' : 'Cathedral & UNESCO centre', prompt: t.presetUnescoPrompt },
    { icon: Pickaxe, label: language === 'es' ? 'Mina El Edén y teleférico' : 'El Edén mine & cable car', prompt: t.presetMiningPrompt },
    { icon: Mountain, label: language === 'es' ? '7 Pueblos Mágicos' : '7 Magic Towns', prompt: t.presetPueblosPrompt },
    { icon: Sparkles, label: language === 'es' ? 'Leyendas virreinales' : 'Colonial legends', prompt: t.presetLegendsPrompt },
    { icon: UtensilsCrossed, label: language === 'es' ? 'Asado de boda y mezcal' : 'Wedding stew & mezcal', prompt: t.presetGastronomyPrompt },
  ];

  // Preguntas de seguimiento bajo la última respuesta: sobre el primer lugar mencionado, o generales.
  const lastMsg = messages[messages.length - 1];
  const followUps = (() => {
    if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.isStreaming || lastMsg.isError || isStreaming) return [];
    const tagged = lastMsg.content.match(/\[LUGARES(?:_MENCIONADOS)?:\s*([^\],]+)/i)?.[1]?.trim();
    const lower = lastMsg.content.toLowerCase();
    const place =
      ZACATECAS_PLACES.find((p) => p.id === tagged) ??
      ZACATECAS_PLACES.find((p) => lower.includes(p.nameEs.toLowerCase()) || lower.includes(p.name.toLowerCase()));
    if (place) {
      const name = language === 'es' ? place.nameEs : place.name;
      return [t.followUpHowToGet, t.followUpHours, t.followUpFoodNear].map((q) => q.replace('{place}', name));
    }
    return [t.followUpItinerary, t.followUpLegend, t.followUpFood];
  })();

  const chipCls =
    'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota';

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-papel overflow-hidden relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 tinte-temporada" aria-hidden="true" />
      <div className="relative flex-1 overflow-y-auto px-3 sm:px-6 py-4">
        {messages.length === 0 ? (
          <div className="max-w-lg mx-auto pt-6 pb-4 space-y-5">
            <div className="space-y-2">
              <h1 className="font-extrabold text-[30px] leading-[1.1] text-carbon">{t.chatWelcomeTitle}</h1>
              <p className="text-sm text-tenue leading-relaxed">{t.chatWelcomeSubtitle}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {onOpen3d && (
                <button type="button" onClick={onOpen3d} className={`${chipCls} bg-cantera text-sobre-cantera border-cantera hover:brightness-95`}>
                  <Box className="w-3.5 h-3.5" />
                  {t.chatQuick3d}
                </button>
              )}
              {onOpenPlans && (
                <button type="button" onClick={onOpenPlans} className={`${chipCls} bg-superficie text-cantera border-linea hover:bg-caliza`}>
                  <Route className="w-3.5 h-3.5" />
                  {t.chatQuickPlans}
                </button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-tenue">{t.chatWelcomeTip}</p>
              <div className="flex flex-col gap-2">
                {topics.map(({ icon: Icon, label, prompt }, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onSelectPrompt(prompt)}
                    style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
                    className="animate-sube flex items-center gap-3 p-3 text-left text-sm font-semibold text-carbon bg-superficie border border-linea rounded-2xl hover:border-cantera active:scale-[0.98] transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera"
                  >
                    <span className="w-8 h-8 rounded-[10px] bg-caliza text-cantera grid place-items-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide">
              <span className="px-2 py-0.5 rounded-full border text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900">{t.tagHistory}</span>
              <span className="px-2 py-0.5 rounded-full border text-purple-800 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-900">{t.tagLegend}</span>
              <span className="px-2 py-0.5 rounded-full border text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900">{t.tagRecommendation}</span>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {messages.map((message) => (
              <ChatMessageItem
                key={message.id}
                message={message}
                language={language}
                onPlaceClick={onPlaceClick}
                onOpen3d={onOpen3d}
                knowledgeBase={knowledgeBase}
              />
            ))}
            {followUps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2 animate-sube" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
                {followUps.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onSendMessage(q)}
                    className="px-3 py-2 text-xs font-semibold text-carbon bg-superficie border border-linea rounded-full hover:border-cantera hover:text-cantera active:scale-95 transition cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="px-3 sm:px-6 pt-1 pb-2.5">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex items-end gap-1 pl-4 pr-1.5 py-1.5 bg-superficie border border-linea rounded-[26px] focus-within:border-cantera focus-within:ring-2 focus-within:ring-cantera/15 transition-shadow"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.chatPlaceholderShort}
            aria-label={t.inputPlaceholder}
            className="flex-1 py-2 text-[15px] bg-transparent resize-none focus:outline-none text-carbon placeholder:text-tenue max-h-[120px]"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              className="w-9 h-9 grid place-items-center rounded-full bg-carbon text-papel cursor-pointer shrink-0"
              title={t.stopStreaming}
              aria-label={t.stopStreaming}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-9 h-9 grid place-items-center rounded-full bg-cantera text-sobre-cantera disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shrink-0"
              title={t.sendButton}
              aria-label={t.sendButton}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </form>
        <p className="text-[10px] text-tenue text-center mt-1.5">{t.chatFootnote}</p>
      </div>
    </div>
  );
};
