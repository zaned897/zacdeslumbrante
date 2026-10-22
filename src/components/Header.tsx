import React from 'react';
import { PanelLeftClose, PanelLeft, MapPin, Globe, Compass, Box } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../data/i18n';

interface HeaderProps {
  language: Language;
  onToggleLanguage: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isMapOpen: boolean;
  onToggleMap: () => void;
  onOpenItineraryModal: () => void;
  onOpenKnowledgeModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onToggleLanguage,
  isSidebarOpen,
  onToggleSidebar,
  isMapOpen,
  onToggleMap,
  onOpenItineraryModal,
  onOpenKnowledgeModal,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 md:gap-8 px-4 md:px-6 py-3.5 bg-[#FBF9F5] border-b border-stone-200">
      {/* Zone 1: Sidebar Toggle & Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
          title={isSidebarOpen ? t.collapseSidebar : t.expandSidebar}
          aria-label={isSidebarOpen ? t.collapseSidebar : t.expandSidebar}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
        </button>

        <a href="/" className="flex items-center gap-2.5 text-stone-900 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9A3412] to-[#78350F] flex items-center justify-center text-white shadow-xs">
            <span className="font-serif font-bold text-base tracking-tighter">Z</span>
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-bold text-lg leading-tight tracking-tight text-stone-900 whitespace-nowrap">
              Zacatecas Deslumbrante
            </span>
            <span className="text-[10px] uppercase font-sans tracking-widest text-stone-500 font-medium">
              Prototype · Guía Oficial
            </span>
          </div>
        </a>
      </div>

      {/* Zone 2: Navigation Links (single-line, clean) */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-600">
        <button
          onClick={onOpenItineraryModal}
          className="flex items-center gap-1.5 hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Compass className="w-4 h-4 text-[#9A3412]" />
          <span>{t.itineraryPlanner}</span>
        </button>
        <button
          onClick={onOpenKnowledgeModal}
          className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{t.knowledgeBaseTitle} (26)</span>
        </button>
      </nav>

      {/* Zone 3: Actions (Language Selector & Map Toggle) */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* 3D City (mock) */}
        <a
          href="#3d"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50 hover:border-stone-400 rounded-lg transition-colors"
          title={t.view3d}
        >
          <Box className="w-3.5 h-3.5 text-[#9A3412]" />
          <span className="hidden sm:inline whitespace-nowrap">{t.view3d}</span>
        </a>

        {/* Language Selector Toggle */}
        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg transition-colors cursor-pointer"
          title={t.toggleLanguage}
          aria-label={t.toggleLanguage}
        >
          <Globe className="w-3.5 h-3.5 text-stone-500" />
          <span className="uppercase">{language === 'es' ? 'ES' : 'EN'}</span>
          <span className="text-stone-400 font-normal">|</span>
          <span className="text-stone-500 font-normal">{language === 'es' ? 'EN' : 'ES'}</span>
        </button>

        {/* Map Toggle Button */}
        <button
          onClick={onToggleMap}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            isMapOpen
              ? 'bg-[#9A3412] text-white shadow-xs hover:bg-[#78350F]'
              : 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 hover:border-stone-400'
          }`}
          title={isMapOpen ? t.mapClose : t.mapOpen}
        >
          <MapPin className={`w-3.5 h-3.5 ${isMapOpen ? 'text-white' : 'text-[#9A3412]'}`} />
          <span className="whitespace-nowrap">{isMapOpen ? t.mapClose : t.mapOpen}</span>
        </button>
      </div>
    </header>
  );
};
