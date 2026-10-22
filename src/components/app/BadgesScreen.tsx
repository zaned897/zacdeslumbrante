import React, { useEffect, useMemo, useState } from 'react';
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
  Check,
  type LucideIcon,
} from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import { ZACATECAS_PLACES } from '../../data/places';
import { useCollection } from '../../scene3d/useCollection';
import { Sheet } from './Sheet';

const SEEN_KEY = 'zacatecas_badges_seen_v1';

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

const Medal: React.FC<{ icon: string; won: boolean; size?: 'md' | 'lg' }> = ({ icon, won, size = 'md' }) => {
  const Icon = ICONS[icon] ?? Trophy;
  const dims = size === 'lg' ? 'w-28 h-28' : 'w-16 h-16';
  return (
    <span
      className={`relative ${dims} rounded-full grid place-items-center transition-transform ${
        won
          ? 'text-white bg-[radial-gradient(circle_at_35%_30%,#FDBA74,#C2410C_70%)] shadow-[0_6px_16px_-6px_rgba(194,65,12,0.6)]'
          : 'bg-caliza text-tenue'
      }`}
    >
      <Icon className={size === 'lg' ? 'w-12 h-12' : 'w-7 h-7'} strokeWidth={1.75} />
      {!won && size === 'md' && (
        <Lock className="absolute -bottom-0.5 -right-0.5 w-5 h-5 p-1 rounded-full bg-superficie text-tenue border border-linea" />
      )}
    </span>
  );
};

/** Confeti con CSS: piezas que caen una vez. */
const Confetti: React.FC = () => {
  const colors = ['#E4007C', '#FACC15', '#22C55E', '#F97316', '#38BDF8', '#B4462C'];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[70]" aria-hidden="true">
      {Array.from({ length: 36 }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 w-2 h-3 rounded-[2px]"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animation: `confeti ${1.6 + (i % 5) * 0.25}s cubic-bezier(.2,.6,.4,1) ${(i % 7) * 0.08}s forwards`,
            ['--dx' as string]: `${((i % 9) - 4) * 14}px`,
          }}
        />
      ))}
    </div>
  );
};


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
  const [openId, setOpenId] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>(readSeen);

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

  const rows = useMemo(
    () =>
      (challenges ?? []).map((c) => {
        const found = c.placeIds.filter((id) => collection[id]).length;
        return { ...c, found, total: c.placeIds.length, won: found === c.placeIds.length };
      }),
    [challenges, collection],
  );
  const wonCount = rows.filter((r) => r.won).length;
  const discoveredCount = Object.keys(collection).length;
  // Siguiente: la insignia sin ganar a la que menos lugares le faltan.
  const next = rows
    .filter((r) => !r.won)
    .sort((a, b) => a.total - a.found - (b.total - b.found))[0];
  // Insignias ganadas que aún no se celebraron en este navegador.
  const fresh = rows.filter((r) => r.won && !seen.includes(r.badge.id));
  const celebrating = fresh[0];
  const markSeen = () => {
    const all = Array.from(new Set([...seen, ...fresh.map((r) => r.badge.id)]));
    setSeen(all);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(all));
    } catch {
      // Sin almacenamiento: se volverá a celebrar.
    }
  };
  const open = rows.find((r) => r.id === openId);

  return (
    <div className="h-full overflow-y-auto bg-papel">
      <header className="px-5 pb-5" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))' }}>
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold">{t.badgesTitle}</h1>
            <span className="px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-terracota border border-terracota/50 rounded-full">
              {t.demoBadge}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <p className="text-5xl font-extrabold leading-none tabular-nums">
              {wonCount}
              <span className="text-xl text-tenue font-bold"> / {rows.length || '–'}</span>
            </p>
            <p className="pb-1 text-xs text-tenue">{t.badgesPlaces.replace('{count}', String(discoveredCount))}</p>
          </div>
          <div className="mt-3 h-2 rounded-full bg-caliza overflow-hidden">
            <span
              className="block h-full rounded-full bg-cantera transition-[width] duration-700"
              style={{ width: rows.length ? `${(wonCount / rows.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pb-6 space-y-5">
        {challenges === null && (
          <div className="grid grid-cols-4 gap-3" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-full bg-caliza animate-pulse" />
            ))}
          </div>
        )}

        {offline && <p className="text-xs text-tenue bg-caliza rounded-2xl px-4 py-3">{t.badgesOffline}</p>}

        {rows.length > 0 && (
          <ul className="grid grid-cols-4 gap-x-2 gap-y-5">
            {rows.map((r, i) => (
              <li key={r.id} className="animate-sube" style={{ animationDelay: `${i * 35}ms`, animationFillMode: 'backwards' }}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="w-full flex flex-col items-center gap-1.5 text-center cursor-pointer active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera rounded-2xl"
                >
                  <Medal icon={r.badge.icon} won={r.won} />
                  <b className="text-[11px] leading-tight">{r.badge.name[language]}</b>
                  <small className="font-mono text-[10px] text-tenue">
                    {r.found}/{r.total}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}

        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => next && setOpenId(next.id)}
            className="w-full text-left rounded-3xl bg-cita p-4 space-y-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cantera">
              <Sparkles className="w-3.5 h-3.5" />
              {t.badgesNext}
            </span>
            {next ? (
              <>
                <b className="block text-[15px]">
                  {next.badge.name[language]} · {next.title[language]}
                </b>
                <p className="text-xs text-tenue">
                  {t.badgesNextBody
                    .replace('{count}', String(next.total - next.found))
                    .replace('{places}', next.placeIds.filter((id) => !collection[id]).map(placeName).join(', '))}
                </p>
              </>
            ) : (
              <b className="block text-[15px]">{t.badgesAllDone}</b>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onGoExplore}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-carbon text-papel text-sm font-bold cursor-pointer active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera"
        >
          <Footprints className="w-4 h-4" />
          {t.badgesGoExplore}
        </button>
        <p className="text-[11px] text-tenue text-center">{t.badgesHint}</p>
      </div>

      <Sheet
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        closeLabel={t.closeModal}
        title={open?.badge.name[language]}
        subtitle={open?.title[language]}
        footer={
          open && !open.won ? (
            <button
              type="button"
              onClick={() => {
                setOpenId(null);
                onGoExplore();
              }}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-cantera text-sobre-cantera text-sm font-bold cursor-pointer"
            >
              <Footprints className="w-4 h-4" />
              {t.badgesGoExplore}
            </button>
          ) : undefined
        }
      >
        {open && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-2">
              <Medal icon={open.badge.icon} won={open.won} size="lg" />
              <p className="font-mono text-sm text-tenue">
                {open.found}/{open.total}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-tenue mb-2">{t.badgeDetailPlaces}</h3>
              <ul className="divide-y divide-linea">
                {open.placeIds.map((id) => {
                  const got = Boolean(collection[id]);
                  return (
                    <li key={id} className="flex items-center gap-3 py-3">
                      <span
                        className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${
                          got ? 'bg-cantera text-sobre-cantera' : 'bg-caliza text-tenue'
                        }`}
                      >
                        {got ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                      </span>
                      <span className="flex-1 text-sm font-semibold">{placeName(id)}</span>
                      <span className={`text-[11px] font-semibold ${got ? 'text-cantera' : 'text-tenue'}`}>
                        {got ? t.badgeDetailFound : t.badgeDetailPending}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </Sheet>

      {celebrating && (
        <>
          <Confetti />
          <div className="fixed inset-0 z-[65] grid place-items-center bg-black/50 backdrop-blur-[2px] animate-aparece p-6" role="dialog" aria-modal="true" aria-label={t.badgeNewTitle}>
            <div className="w-full max-w-xs rounded-[32px] bg-papel p-6 flex flex-col items-center gap-3 text-center animate-pop">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cantera">{t.badgeNewTitle}</span>
              <Medal icon={celebrating.badge.icon} won size="lg" />
              <h2 className="text-xl font-extrabold">{celebrating.badge.name[language]}</h2>
              <p className="text-sm text-tenue">{celebrating.title[language]}</p>
              <button
                type="button"
                onClick={markSeen}
                autoFocus
                className="mt-2 w-full h-11 rounded-full bg-cantera text-sobre-cantera text-sm font-bold cursor-pointer active:scale-95 transition-transform outline-none"
              >
                {t.badgeNewCta}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
