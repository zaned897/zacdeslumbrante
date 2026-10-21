import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Sparkles, Landmark, Compass, Mountain, UtensilsCrossed } from 'lucide-react';
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
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  language,
  messages,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  onPlaceClick,
  onSelectPrompt,
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
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

  const welcomeChips = [
    {
      icon: <Landmark className="w-3.5 h-3.5 text-[#9A3412]" />,
      label: language === 'es' ? 'Catedral & Centro UNESCO' : 'Cathedral & UNESCO Centre',
      prompt: t.presetUnescoPrompt,
    },
    {
      icon: <Compass className="w-3.5 h-3.5 text-blue-700" />,
      label: language === 'es' ? 'Mina El Edén & Teleférico' : 'El Edén Mine & Cable Car',
      prompt: t.presetMiningPrompt,
    },
    {
      icon: <Mountain className="w-3.5 h-3.5 text-purple-700" />,
      label: language === 'es' ? '7 Pueblos Mágicos' : '7 Magic Towns',
      prompt: t.presetPueblosPrompt,
    },
    {
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-700" />,
      label: language === 'es' ? 'Leyendas Virreinales' : 'Colonial Legends',
      prompt: t.presetLegendsPrompt,
    },
    {
      icon: <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-700" />,
      label: language === 'es' ? 'Asado de Boda & Mezcal' : 'Traditional Wedding Stew & Mezcal',
      prompt: t.presetGastronomyPrompt,
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBF9F5] overflow-hidden relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {messages.length === 0 ? (
          /* Zero-State Curatorial Welcome Screen */
          <div className="max-w-2xl mx-auto py-8 text-center space-y-6 animate-in fade-in duration-300">
            {/* Architectural Crest */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9A3412] to-[#78350F] text-white shadow-md">
              <span className="font-serif font-bold text-3xl">Z</span>
            </div>

            <div className="space-y-2">
              <h1 className="font-serif font-bold text-2xl md:text-3xl text-stone-900 tracking-tight">
                {t.chatWelcomeTitle}
              </h1>
              <p className="text-xs md:text-sm text-stone-600 max-w-lg mx-auto leading-relaxed">
                {t.chatWelcomeSubtitle}
              </p>
            </div>

            {/* Distinction Guide Card */}
            <div className="p-4 bg-white border border-stone-200 rounded-xl shadow-2xs text-left max-w-lg mx-auto space-y-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                {language === 'es' ? 'Protocolo de Rigor y Distinción' : 'Editorial Distinction Protocol'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200">
                  <p className="font-bold text-amber-900">{t.tagHistory}</p>
                  <p className="text-[10px] text-amber-800 mt-0.5">
                    {language === 'es' ? 'Archivos INAH y UNESCO' : 'INAH & UNESCO archives'}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-purple-50/70 border border-purple-200">
                  <p className="font-bold text-purple-900">{t.tagLegend}</p>
                  <p className="text-[10px] text-purple-800 mt-0.5">
                    {language === 'es' ? 'Folclor y tradición oral' : 'Oral folklore tradition'}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
                  <p className="font-bold text-emerald-900">{t.tagRecommendation}</p>
                  <p className="text-[10px] text-emerald-800 mt-0.5">
                    {language === 'es' ? 'Logística y consejos' : 'Traveler & guide logistics'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-stone-500">
                {t.chatWelcomeTip}
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {welcomeChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectPrompt(chip.prompt)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 hover:border-stone-400 rounded-xl shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5"
                  >
                    {chip.icon}
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Conversation Thread */
          <div className="max-w-3xl mx-auto">
            {messages.map((message) => (
              <ChatMessageItem
                key={message.id}
                message={message}
                language={language}
                onPlaceClick={onPlaceClick}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Composer */}
      <div className="px-4 md:px-8 py-3 bg-white border-t border-stone-200 shadow-xs">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative bg-stone-100/90 rounded-2xl border border-stone-300 focus-within:border-[#9A3412] focus-within:ring-2 focus-within:ring-[#9A3412]/20 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.inputPlaceholder}
              className="w-full px-4 py-3 text-sm bg-transparent resize-none focus:outline-none text-stone-900 placeholder:text-stone-400 max-h-36"
            />
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={onStopStreaming}
              className="p-3 bg-stone-900 hover:bg-black text-white rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
              title={t.stopStreaming}
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-3 bg-[#9A3412] hover:bg-[#78350F] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
              title={t.sendButton}
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </form>
        <p className="text-[10px] text-stone-400 text-center mt-1.5 font-sans">
          Zacatecas Deslumbrante Prototype · Respuestas fundamentadas en portales de turismo y acervos oficiales.
        </p>
      </div>
    </div>
  );
};
