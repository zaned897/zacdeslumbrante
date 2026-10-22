import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square, Sparkles, Landmark, Pickaxe, Mountain, UtensilsCrossed, Box, Route } from 'lucide-react';
import { ChatMessage, Language, Place, KnowledgeBaseURL } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { ChatMessageItem } from './ChatMessageItem';

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

  const chipCls =
    'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota';

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-papel overflow-hidden relative">
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
        {messages.length === 0 ? (
          <div className="max-w-lg mx-auto pt-6 pb-4 space-y-5">
            <div className="space-y-2">
              <h1 className="font-serif font-bold text-[28px] leading-tight text-carbon">{t.chatWelcomeTitle}</h1>
              <p className="text-sm text-stone-600 leading-relaxed">{t.chatWelcomeSubtitle}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {onOpen3d && (
                <button type="button" onClick={onOpen3d} className={`${chipCls} bg-cantera text-white border-cantera hover:bg-[#7C2D12]`}>
                  <Box className="w-3.5 h-3.5" />
                  {t.chatQuick3d}
                </button>
              )}
              {onOpenPlans && (
                <button type="button" onClick={onOpenPlans} className={`${chipCls} bg-white text-cantera border-[#E7DCCB] hover:bg-caliza`}>
                  <Route className="w-3.5 h-3.5" />
                  {t.chatQuickPlans}
                </button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-stone-500">{t.chatWelcomeTip}</p>
              <div className="flex flex-col gap-2">
                {topics.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onSelectPrompt(prompt)}
                    className="flex items-center gap-3 p-3 text-left text-sm font-semibold text-carbon bg-white border border-linea rounded-2xl hover:border-cantera cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
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
              <span className="px-2 py-0.5 rounded-full border text-amber-800 bg-amber-50 border-amber-200">{t.tagHistory}</span>
              <span className="px-2 py-0.5 rounded-full border text-purple-800 bg-purple-50 border-purple-200">{t.tagLegend}</span>
              <span className="px-2 py-0.5 rounded-full border text-emerald-800 bg-emerald-50 border-emerald-200">{t.tagRecommendation}</span>
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="px-3 sm:px-6 pt-1 pb-2.5">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex items-end gap-1 pl-4 pr-1.5 py-1.5 bg-white border border-[#E7DCCB] rounded-[26px] focus-within:border-cantera focus-within:ring-2 focus-within:ring-cantera/15 transition-shadow"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.chatPlaceholderShort}
            aria-label={t.inputPlaceholder}
            className="flex-1 py-2 text-[15px] bg-transparent resize-none focus:outline-none text-carbon placeholder:text-stone-400 max-h-[120px]"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              className="w-9 h-9 grid place-items-center rounded-full bg-carbon text-white cursor-pointer shrink-0"
              title={t.stopStreaming}
              aria-label={t.stopStreaming}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-9 h-9 grid place-items-center rounded-full bg-cantera text-white disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shrink-0"
              title={t.sendButton}
              aria-label={t.sendButton}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </form>
        <p className="text-[10px] text-stone-400 text-center mt-1.5">{t.chatFootnote}</p>
      </div>
    </div>
  );
};
