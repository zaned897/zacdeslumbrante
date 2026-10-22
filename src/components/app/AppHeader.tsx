import React from 'react';
import { Globe, Map } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';

interface AppHeaderProps {
  language: Language;
  onToggleLanguage: () => void;
  isMapOpen?: boolean;
  onToggleMap?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ language, onToggleLanguage, isMapOpen, onToggleMap }) => {
  const t = TRANSLATIONS[language];

  return (
    <header
      className="shrink-0 flex items-center gap-2.5 px-4 pb-2.5 bg-papel border-b border-linea"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
    >
      <div className="w-9 h-9 rounded-[10px] bg-cantera text-white grid place-items-center shrink-0">
        <span className="font-serif font-bold text-lg leading-none">Z</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-serif font-bold text-base leading-tight truncate">{t.appName}</span>
          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white bg-terracota rounded shrink-0">
            {t.demoBadge}
          </span>
        </div>
        <span className="block text-[11px] text-stone-500 truncate">{t.appTagline}</span>
      </div>

      {onToggleMap && (
        <button
          type="button"
          onClick={onToggleMap}
          aria-pressed={isMapOpen}
          className={`h-9 px-2.5 flex items-center gap-1.5 rounded-[10px] text-xs font-bold shadow-xs border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota ${
            isMapOpen ? 'bg-cantera text-white border-cantera' : 'bg-white text-cantera border-linea hover:bg-caliza'
          }`}
        >
          <Map className="w-4 h-4" />
          <span className="hidden sm:inline">{t.openMap2d}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onToggleLanguage}
        aria-label={t.toggleLanguage}
        className="h-9 px-2.5 flex items-center gap-1 rounded-[10px] bg-white border border-linea shadow-xs text-xs font-bold cursor-pointer hover:bg-caliza focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
      >
        <Globe className="w-4 h-4 text-cantera" />
        <span className="uppercase">{language}</span>
      </button>
    </header>
  );
};
