import React from 'react';
import {
  BookOpen,
  Compass,
  RotateCcw,
  Download,
  Landmark,
  Mountain,
  Sparkles,
  UtensilsCrossed,
  Layers,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  PanelLeftClose,
} from 'lucide-react';
import { Language, KnowledgeBaseURL } from '../types';
import { TRANSLATIONS } from '../data/i18n';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  knowledgeBase: KnowledgeBaseURL[];
  onOpenKnowledgeModal: () => void;
  onOpenItineraryModal: () => void;
  onSelectPrompt: (prompt: string) => void;
  onClearChat: () => void;
  onExportChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  language,
  knowledgeBase,
  onOpenKnowledgeModal,
  onOpenItineraryModal,
  onSelectPrompt,
  onClearChat,
  onExportChat,
}) => {
  const t = TRANSLATIONS[language];
  const activeCount = knowledgeBase.filter((k) => k.isEnabled).length;

  const explorationThemes = [
    {
      id: 'unesco',
      icon: <Landmark className="w-4 h-4 text-[#9A3412]" />,
      title: t.presetUnescoTitle,
      prompt: t.presetUnescoPrompt,
    },
    {
      id: 'pueblos',
      icon: <Mountain className="w-4 h-4 text-purple-700" />,
      title: t.presetPueblosTitle,
      prompt: t.presetPueblosPrompt,
    },
    {
      id: 'mining',
      icon: <Layers className="w-4 h-4 text-blue-700" />,
      title: t.presetMiningTitle,
      prompt: t.presetMiningPrompt,
    },
    {
      id: 'legends',
      icon: <Sparkles className="w-4 h-4 text-amber-700" />,
      title: t.presetLegendsTitle,
      prompt: t.presetLegendsPrompt,
    },
    {
      id: 'gastronomy',
      icon: <UtensilsCrossed className="w-4 h-4 text-emerald-700" />,
      title: t.presetGastronomyTitle,
      prompt: t.presetGastronomyPrompt,
    },
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      className="w-80 md:w-84 shrink-0 flex flex-col h-[calc(100vh-61px)] bg-[#F7F4EE] border-r border-stone-200 overflow-y-auto text-stone-900 transition-all z-20"
      aria-label="Navigation & Knowledge Panel"
    >
      {/* Top Header of Sidebar */}
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#9A3412]" />
          <h2 className="font-serif font-semibold text-sm tracking-tight text-stone-900">
            {t.knowledgeBaseTitle}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 rounded-md transition-colors lg:hidden"
          title={t.collapseSidebar}
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Knowledge Base Status Card */}
        <div className="p-3.5 bg-white border border-stone-200 rounded-xl shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600 uppercase tracking-wider">
              {t.activeSources}
            </span>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{activeCount} / {knowledgeBase.length}</span>
            </div>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            {language === 'es'
              ? 'Portales de SECTUR, UNESCO, INAH, IZC y Archivos Generales vinculados para respuestas verificadas.'
              : 'Official SECTUR, UNESCO, INAH, IZC and Historical Archives active for grounded answers.'}
          </p>

          <button
            onClick={onOpenKnowledgeModal}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#9A3412] bg-[#9A3412]/5 hover:bg-[#9A3412]/10 border border-[#9A3412]/20 rounded-lg transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t.manageSources} ({activeCount})</span>
          </button>
        </div>

        {/* Suggested Itineraries Quick Action */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              {t.itineraryPlanner}
            </span>
            <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              Open Decision
            </span>
          </div>

          <button
            onClick={onOpenItineraryModal}
            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-stone-900 to-stone-800 hover:from-black hover:to-stone-900 text-white rounded-xl shadow-xs transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-amber-300 group-hover:rotate-45 transition-transform" />
              <div>
                <p className="text-xs font-bold leading-tight">
                  {t.generateItineraryBtn}
                </p>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  1-Día, 2-Días & Circuitos
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Curated Theme Presets */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            {t.themePresets}
          </span>

          <div className="space-y-1.5">
            {explorationThemes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => onSelectPrompt(theme.prompt)}
                className="w-full flex items-start gap-2.5 p-2.5 text-left text-xs text-stone-800 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-lg transition-all cursor-pointer group"
              >
                <div className="mt-0.5 shrink-0">{theme.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 group-hover:text-[#9A3412] transition-colors leading-snug">
                    {theme.title}
                  </p>
                  <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                    {theme.prompt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Distinction Legend Reference */}
        <div className="p-3 bg-stone-100/80 border border-stone-200/80 rounded-xl space-y-2">
          <p className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
            {language === 'es' ? 'Código de Verificación' : 'Verification Code'}
          </p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-stone-700">
              <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
              <span className="font-medium text-stone-800">{t.tagHistory}</span>
              <span className="text-stone-400 text-[11px]">· Archivos</span>
            </div>
            <div className="flex items-center gap-2 text-stone-700">
              <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0" />
              <span className="font-medium text-stone-800">{t.tagLegend}</span>
              <span className="text-stone-400 text-[11px]">· Folclor</span>
            </div>
            <div className="flex items-center gap-2 text-stone-700">
              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
              <span className="font-medium text-stone-800">{t.tagRecommendation}</span>
              <span className="text-stone-400 text-[11px]">· Logística</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Session Actions */}
      <div className="p-4 border-t border-stone-200 bg-[#F2ECE1] space-y-2">
        <button
          onClick={onClearChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
          <span>{t.clearChat}</span>
        </button>

        <button
          onClick={onExportChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-stone-500" />
          <span>{t.exportChat}</span>
        </button>
      </div>
    </aside>
  );
};
