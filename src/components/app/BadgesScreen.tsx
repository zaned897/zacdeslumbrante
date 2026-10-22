import React, { useEffect, useState } from 'react';
import {
  Landmark,
  Mountain,
  Pickaxe,
  Palette,
  Waves,
  Pyramid,
  Sparkles,
  Church,
  Trophy,
  Lock,
  Footprints,
  type LucideIcon,
} from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { ZACATECAS_PLACES } from '../../data/places';
import { useCollection } from '../../scene3d/useCollection';

// Contrato: GET /api/py/challenges (docs/API.md). Se tipa aquí para no tocar src/types (zona compartida).
interface Challenge {
  id: string;
  title: Record<Language, string>;
  placeIds: string[];
  badge: { id: string; name: Record<Language, string>; icon: string };
}

const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  mountain: Mountain,
  pickaxe: Pickaxe,
  palette: Palette,
  waves: Waves,
  pyramid: Pyramid,
  sparkles: Sparkles,
  church: Church,
};

interface BadgesScreenProps {
  language: Language;
  onGoExplore: () => void;
}

export const BadgesScreen: React.FC<BadgesScreenProps> = ({ language, onGoExplore }) => {
  const t = TRANSLATIONS[language];
  const { collection } = useCollection();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/py/challenges', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { challenges: Challenge[] }) => setChallenges(data.challenges))
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setOffline(true);
        setChallenges([]);
      });
    return () => controller.abort();
  }, []);

  const placeName = (id: string) => {
    const p = ZACATECAS_PLACES.find((x) => x.id === id);
    return p ? (language === 'es' ? p.nameEs : p.name) : id;
  };

  const rows = (challenges ?? []).map((c) => {
    const found = c.placeIds.filter((id) => collection[id]).length;
    return { ...c, found, total: c.placeIds.length, won: found === c.placeIds.length };
  });
  const wonCount = rows.filter((r) => r.won).length;
  const discoveredCount = Object.keys(collection).length;
  // Siguiente: la insignia sin ganar a la que menos lugares le faltan.
  const next = rows
    .filter((r) => !r.won)
    .sort((a, b) => a.total - a.found - (b.total - b.found))[0];

  return (
    <div className="h-full overflow-y-auto bg-papel">
      <header
        className="px-4 pb-4 bg-gradient-to-b from-cantera to-[#7C2D12] text-white"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="mx-auto max-w-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <h1 className="font-serif font-bold text-xl">{t.badgesTitle}</h1>
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-terracota rounded">
              {t.demoBadge}
            </span>
          </div>
          <p className="font-serif font-bold text-3xl">
            {wonCount}
            <span className="text-base opacity-75"> / {rows.length || '–'}</span>
          </p>
          <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
            <span
              className="block h-full rounded-full bg-amber-300 transition-[width]"
              style={{ width: rows.length ? `${(wonCount / rows.length) * 100}%` : '0%' }}
            />
          </div>
          <p className="text-xs opacity-85">
            {t.badgesProgress.replace('{won}', String(wonCount)).replace('{total}', String(rows.length))}
            {' · '}
            {t.badgesPlaces.replace('{count}', String(discoveredCount))}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-3 py-4 space-y-4">
        {challenges === null && (
          <div className="grid grid-cols-4 gap-3" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-full bg-caliza animate-pulse" />
            ))}
          </div>
        )}

        {offline && (
          <p className="text-xs text-stone-600 bg-caliza border border-linea rounded-xl px-3 py-2">{t.badgesOffline}</p>
        )}

        {rows.length > 0 && (
          <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
            {rows.map((r) => {
              const Icon = ICONS[r.badge.icon] ?? Trophy;
              return (
                <li key={r.id} className="flex flex-col items-center gap-1 text-center" title={r.title[language]}>
                  <span
                    className={`relative w-14 h-14 rounded-full grid place-items-center ${
                      r.won
                        ? 'text-white bg-[radial-gradient(circle_at_35%_30%,#FDBA74,#C2410C_70%)] ring-[3px] ring-orange-200'
                        : 'bg-caliza text-stone-400'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    {!r.won && (
                      <Lock className="absolute -bottom-0.5 -right-0.5 w-4 h-4 p-0.5 rounded-full bg-white text-stone-400" />
                    )}
                  </span>
                  <b className="text-[11px] leading-tight">{r.badge.name[language]}</b>
                  <small className="font-mono text-[10px] text-stone-500">
                    {r.found}/{r.total}
                  </small>
                </li>
              );
            })}
          </ul>
        )}

        {rows.length > 0 && (
          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-3 space-y-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
              <Sparkles className="w-3.5 h-3.5" />
              {t.badgesNext}
            </span>
            {next ? (
              <>
                <b className="block text-sm">
                  {next.badge.name[language]} · {next.title[language]}
                </b>
                <p className="text-xs text-stone-600">
                  {t.badgesNextBody
                    .replace('{count}', String(next.total - next.found))
                    .replace(
                      '{places}',
                      next.placeIds.filter((id) => !collection[id]).map(placeName).join(', '),
                    )}
                </p>
              </>
            ) : (
              <b className="block text-sm">{t.badgesAllDone}</b>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={onGoExplore}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-carbon text-white text-sm font-bold cursor-pointer hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
        >
          <Footprints className="w-4 h-4" />
          {t.badgesGoExplore}
        </button>
        <p className="text-[11px] text-stone-500 text-center">{t.badgesHint}</p>
      </div>
    </div>
  );
};
