import React from 'react';
import { Map } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';

interface AppHeaderProps {
  language: Language;
  onToggleLanguage: () => void;
  isMapOpen?: boolean;
  onToggleMap?: () => void;
  /** Temporada o fiesta activa: se muestra como chip junto al subtítulo. */
  season?: { name: string; accent: string };
  /** Hueco a la derecha (p. ej. el avatar de la cuenta). */
  trailing?: React.ReactNode;
}

const iconBtn =
  'h-9 min-w-9 px-2.5 grid place-items-center rounded-full text-xs font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera';

export const AppHeader: React.FC<AppHeaderProps> = ({ language, onToggleLanguage, isMapOpen, onToggleMap, season, trailing }) => {
  const t = TRANSLATIONS[language];

  return (
    <header
      className="shrink-0 flex items-center gap-2 px-4 pb-2 bg-papel/85 backdrop-blur-xl tinte-temporada"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
    >
      <div className="w-8 h-8 rounded-[10px] bg-cantera text-sobre-cantera grid place-items-center shrink-0">
        <span className="font-extrabold text-base leading-none">Z</span>
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-[15px] tracking-tight truncate">{t.appName}</span>
          <span className="px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-terracota border border-terracota/50 rounded-full shrink-0">
            {t.demoBadge}
          </span>
        </div>
        {season ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold truncate" style={{ color: season.accent }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: season.accent }} aria-hidden="true" />
            {season.name}
          </span>
        ) : (
          <span className="block text-[11px] text-tenue truncate">{t.appTagline}</span>
        )}
      </div>

      {onToggleMap && (
        <button
          type="button"
          onClick={onToggleMap}
          aria-pressed={isMapOpen}
          aria-label={t.openMap2d}
          title={t.openMap2d}
          className={`${iconBtn} ${isMapOpen ? 'bg-carbon text-papel' : 'bg-caliza text-carbon hover:brightness-95'}`}
        >
          <Map className="w-4 h-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleLanguage}
        aria-label={t.toggleLanguage}
        className={`${iconBtn} bg-caliza text-carbon hover:brightness-95 uppercase`}
      >
        {language}
      </button>
      {trailing}
    </header>
  );
};
