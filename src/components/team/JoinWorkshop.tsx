import React from 'react';
import { BookOpen, Lock } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';

// Guía de colaboración del repo; los pasos de abajo la resumen igual que AGENTS.md y el correo del taller.
const CONTRIBUTING_URL = 'https://github.com/zaned897/zacdeslumbrante/blob/main/CONTRIBUTING.md';

interface JoinWorkshopProps {
  language: Language;
}

/** Tarjeta «Súmate al taller» que cierra la pestaña Equipo (#117, propuesta E). La monta la pestaña de #116. */
export const JoinWorkshop: React.FC<JoinWorkshopProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const steps = [t.joinStep1, t.joinStep2, t.joinStep3, t.joinStep4];

  return (
    <section
      aria-labelledby="join-workshop-title"
      className="overflow-hidden rounded-3xl border border-linea bg-superficie"
    >
      <header className="flex flex-col gap-1 px-4 py-3 bg-gradient-to-b from-[#9A3412] to-[#7C2D12] text-white">
        <div className="flex items-center justify-between">
          <h2 id="join-workshop-title" className="text-lg font-extrabold">
            {t.joinTitle}
          </h2>
          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-terracota rounded">
            {t.demoBadge}
          </span>
        </div>
        <small className="text-xs opacity-85">{t.joinSubtitle}</small>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <ol className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <li key={step} className="flex items-start gap-2.5 rounded-2xl border border-linea bg-papel px-3 py-2.5 text-sm">
              <span
                aria-hidden="true"
                className="grid w-6 h-6 shrink-0 place-items-center rounded-full bg-cantera text-sobre-cantera text-xs font-bold"
              >
                {i + 1}
              </span>
              <span className="leading-snug">{step}</span>
            </li>
          ))}
        </ol>

        <a
          href={CONTRIBUTING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full bg-cantera px-4 py-2.5 text-sm font-bold text-sobre-cantera hover:opacity-90 active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera focus-visible:ring-offset-2"
        >
          <BookOpen className="w-4 h-4" />
          {t.joinGuide}
        </a>

        <p className="flex items-start gap-2 rounded-2xl bg-caliza px-3 py-2 text-xs text-tenue">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t.joinConsent}</span>
        </p>
      </div>
    </section>
  );
};
