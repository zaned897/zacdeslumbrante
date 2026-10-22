import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { FREE_DESIGNS, SPECIES, type Design, type Species } from '../../pet/petEngine';
import { AnimalSprite, swatchOf } from './AnimalSprite';

const DESIGNS: Design[] = [0, 1, 2, 3];

interface PetAdoptProps {
  language: Language;
  onAdopt: (name: string, species: Species, design: Design) => void;
}

/** "Elige a tu compañero" (#67), como la primera pantalla de la propuesta A. */
export const PetAdopt: React.FC<PetAdoptProps> = ({ language, onAdopt }) => {
  const t = TRANSLATIONS[language];
  const [species, setSpecies] = useState<Species>('gatito');
  const [design, setDesign] = useState<Design>(0);
  const [name, setName] = useState('Canterita');

  return (
    <div className="h-full overflow-y-auto bg-papel">
      <form
        className="mx-auto max-w-lg min-h-full px-4 pb-6 flex flex-col gap-3"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))' }}
        onSubmit={(e) => {
          e.preventDefault();
          onAdopt(name, species, design);
        }}
      >
        <div className="space-y-0.5">
          <h1 className="font-extrabold text-2xl text-carbon">{t.petAdoptTitle}</h1>
          <p className="text-xs text-tenue">{t.petAdoptBody}</p>
        </div>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.petAdoptTitle}>
          {SPECIES.map((s) => {
            const on = s === species;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSpecies(s)}
                className={`min-w-0 flex flex-col items-center gap-0.5 rounded-2xl border-[1.5px] px-1 pt-1.5 pb-2 text-xs font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota ${
                  on ? 'border-cantera bg-cita text-cantera' : 'border-linea bg-superficie text-carbon hover:bg-caliza'
                }`}
              >
                <AnimalSprite species={s} design={on ? design : 0} size={64} animate={on} />
                <span className="truncate max-w-full">{t[`petSpecies_${s}`]}</span>
              </button>
            );
          })}
          <div
            className="min-w-0 flex flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-linea bg-caliza px-2 py-2 text-center text-tenue"
            aria-disabled="true"
          >
            <span className="font-extrabold text-3xl leading-none">?</span>
            <span className="text-[10px] font-bold leading-tight">{t.petSixthLocked}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5" role="radiogroup" aria-label={t.petDesignsLabel}>
          <span className="text-xs font-bold text-tenue">{t.petDesignsLabel}</span>
          {DESIGNS.map((d) => {
            const locked = d >= FREE_DESIGNS;
            const on = d === design;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={locked}
                title={locked ? t.petDesignLocked : t[`petDesign_${d}`]}
                aria-label={`${t[`petDesign_${d}`]}${locked ? ` · ${t.petDesignLocked}` : ''}`}
                onClick={() => setDesign(d)}
                className={`relative w-6 h-6 rounded-full border border-linea cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota ${
                  on ? 'ring-2 ring-offset-2 ring-offset-papel ring-cantera' : ''
                } ${locked ? 'opacity-50' : ''}`}
                style={{ background: swatchOf(species, d) }}
              >
                {locked && <Lock className="absolute -bottom-1 -right-1 w-3 h-3 p-px rounded-full bg-superficie text-tenue" />}
              </button>
            );
          })}
        </div>

        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          aria-label={t.petNameLabel}
          className="w-full rounded-xl border border-linea bg-superficie px-3 py-2.5 text-sm text-carbon focus:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
        />

        <button
          type="submit"
          className="mt-auto w-full py-3 rounded-xl bg-carbon text-papel text-sm font-extrabold cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
        >
          {t.petAdopt}
        </button>
        <p className="text-[11px] text-tenue text-center">{t.petSaveHint}</p>
      </form>
    </div>
  );
};
