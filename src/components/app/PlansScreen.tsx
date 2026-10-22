import React from 'react';
import {
  Route,
  Landmark,
  Mountain,
  Pickaxe,
  Sparkles,
  UtensilsCrossed,
  BookOpen,
  ChevronRight,
  RotateCcw,
  Download,
} from 'lucide-react';
import { Language, KnowledgeBaseURL } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { SUGGESTED_ITINERARIES } from '../../data/itineraries';

interface PlansScreenProps {
  language: Language;
  knowledgeBase: KnowledgeBaseURL[];
  onOpenItinerary: (itineraryId: string) => void;
  onAskTheme: (prompt: string) => void;
  onOpenKnowledgeModal: () => void;
  onClearChat: () => void;
  onExportChat: () => void;
  hasMessages: boolean;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="px-1 text-[11px] font-bold uppercase tracking-wider text-cantera">{children}</h2>
);

export const PlansScreen: React.FC<PlansScreenProps> = ({
  language,
  knowledgeBase,
  onOpenItinerary,
  onAskTheme,
  onOpenKnowledgeModal,
  onClearChat,
  onExportChat,
  hasMessages,
}) => {
  const t = TRANSLATIONS[language];
  const activeSources = knowledgeBase.filter((k) => k.isEnabled).length;
  const themes = [
    { icon: Landmark, title: t.presetUnescoTitle, prompt: t.presetUnescoPrompt },
    { icon: Mountain, title: t.presetPueblosTitle, prompt: t.presetPueblosPrompt },
    { icon: Pickaxe, title: t.presetMiningTitle, prompt: t.presetMiningPrompt },
    { icon: Sparkles, title: t.presetLegendsTitle, prompt: t.presetLegendsPrompt },
    { icon: UtensilsCrossed, title: t.presetGastronomyTitle, prompt: t.presetGastronomyPrompt },
  ];

  return (
    <div className="h-full overflow-y-auto bg-papel">
      <header
        className="px-4 pb-3 border-b border-linea"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif font-bold text-2xl">{t.plansTitle}</h1>
          <p className="text-xs text-stone-500">{t.plansSubtitle}</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-3 py-4 space-y-6">
        <section className="space-y-2">
          <SectionTitle>{t.plansItineraries}</SectionTitle>
          <ul className="space-y-2">
            {SUGGESTED_ITINERARIES.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onOpenItinerary(it.id)}
                  className="w-full text-left flex items-center gap-3 p-3 bg-white border border-linea rounded-2xl shadow-2xs hover:border-cantera cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
                >
                  <span className="w-10 h-10 rounded-xl bg-caliza text-cantera grid place-items-center shrink-0">
                    <Route className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block font-serif text-[15px] leading-snug">
                      {language === 'es' ? it.titleEs : it.titleEn}
                    </b>
                    <small className="block text-[11px] text-stone-500 truncate">
                      {language === 'es' ? it.durationLabelEs : it.durationLabelEn}
                    </small>
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" aria-label={t.plansOpen} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <SectionTitle>{t.plansThemes}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {themes.map(({ icon: Icon, title, prompt }) => (
              <button
                key={title}
                type="button"
                onClick={() => onAskTheme(prompt)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-cantera bg-white border border-linea rounded-full hover:bg-caliza cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
              >
                <Icon className="w-3.5 h-3.5" />
                {title}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle>{t.plansSources}</SectionTitle>
          <button
            type="button"
            onClick={onOpenKnowledgeModal}
            className="w-full text-left flex items-center gap-3 p-3 bg-white border border-linea rounded-2xl hover:border-cantera cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <span className="w-10 h-10 rounded-xl bg-caliza text-cantera grid place-items-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{t.knowledgeBaseTitle}</b>
              <small className="block text-[11px] text-stone-500">
                {t.plansSourcesBody.replace('{count}', String(activeSources))}
              </small>
            </span>
            <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
          </button>
        </section>

        <section className="space-y-2">
          <SectionTitle>{t.plansConversation}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClearChat}
              disabled={!hasMessages}
              className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-cantera bg-caliza rounded-xl disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t.clearChat}
            </button>
            <button
              type="button"
              onClick={onExportChat}
              disabled={!hasMessages}
              className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-cantera bg-caliza rounded-xl disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              {t.exportChat}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
