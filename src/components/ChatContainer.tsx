import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { ChatMessage, Language, Place, KnowledgeBaseURL } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { ChatMessageItem } from './ChatMessageItem';
import { ZACATECAS_PLACES } from '../data/places';
import { AnimalSprite } from './pet/AnimalSprite';
import { moodOf, toPetState } from '../pet/petEngine';
import { progress } from '../progress/progressStore';

interface ChatContainerProps {
  language: Language;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  onPlaceClick: (place: Place) => void;
  onSelectPrompt: (prompt: string) => void;
  /** «Ampliar» una respuesta breve (#158). */
  onExpandMessage?: (id: string) => void;
  knowledgeBase: KnowledgeBaseURL[];
  onOpen3d?: () => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  language,
  messages,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  onPlaceClick,
  onSelectPrompt,
  onExpandMessage,
  knowledgeBase,
  onOpen3d,
}) => {
  const [input, setInput] = useState('');
  const [showAllTopics, setShowAllTopics] = useState(false);
  // La mascota adoptada saluda en el chat; sin mascota, el logo (#113).
  const [pet, setPet] = useState(() => toPetState(progress.read<unknown>('pet')));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const t = TRANSLATIONS[language];

  // Al iniciar sesión la cuenta puede traer la mascota después de abrir el chat (#113).
  useEffect(
    () =>
      progress.subscribe((key) => {
        if (key === 'pet') setPet(toPetState(progress.read<unknown>('pet')));
      }),
    [],
  );

  // Baja al final cuando llega un mensaje nuevo o mientras se escribe el último. Al «Ampliar»
  // una respuesta anterior (#158) solo crece ese globo: la vista se queda donde está.
  const messageCount = useRef(messages.length);
  useEffect(() => {
    const grew = messages.length !== messageCount.current;
    messageCount.current = messages.length;
    if (grew || messages[messages.length - 1]?.isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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

  // Los tres primeros se ven al abrir; «Más temas» suma los otros dos.
  const topics = [
    { label: t.topicUnesco, prompt: t.presetUnescoPrompt },
    { label: t.topicMining, prompt: t.presetMiningPrompt },
    { label: t.topicLegends, prompt: t.presetLegendsPrompt },
    { label: t.topicPueblos, prompt: t.presetPueblosPrompt },
    { label: t.topicFood, prompt: t.presetGastronomyPrompt },
  ];
  const visibleTopics = showAllTopics ? topics : topics.slice(0, 3);

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

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-papel overflow-hidden relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 tinte-temporada" aria-hidden="true" />
      <div className="relative flex-1 overflow-y-auto px-3 sm:px-6 py-4">
        {messages.length === 0 ? (
          <div className="max-w-lg mx-auto pt-6 pb-4 space-y-5">
            <div className="flex items-end gap-2.5 animate-sube">
              <span className="w-10 h-10 rounded-full bg-caliza grid place-items-center shrink-0 overflow-hidden" aria-hidden="true">
                {pet ? (
                  <AnimalSprite species={pet.species} design={pet.design} mood={moodOf(pet)} size={40} animate={false} />
                ) : (
                  <span className="w-8 h-8 rounded-[10px] bg-cantera text-sobre-cantera grid place-items-center font-extrabold text-base leading-none">
                    Z
                  </span>
                )}
              </span>
              <p className="px-4 py-2.5 text-[15px] font-semibold text-carbon bg-superficie border border-linea rounded-2xl rounded-bl-md">
                {t.chatGreeting}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-tenue">{t.chatStartHere}</p>
              <div className="flex flex-wrap items-center gap-2 max-w-xs">
                {visibleTopics.map(({ label, prompt }, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onSelectPrompt(prompt)}
                    style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
                    className="animate-sube px-3.5 py-2 text-sm font-semibold text-carbon bg-superficie border border-linea rounded-full hover:border-cantera active:scale-[0.98] transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera"
                  >
                    {label}
                  </button>
                ))}
                {!showAllTopics && (
                  <button
                    type="button"
                    onClick={() => setShowAllTopics(true)}
                    className="px-1 py-2 text-sm font-semibold text-terracota hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota rounded"
                  >
                    {t.chatMoreTopics}
                  </button>
                )}
              </div>
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
                onExpand={!isStreaming && onExpandMessage ? () => onExpandMessage(message.id) : undefined}
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
