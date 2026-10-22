import React, { useEffect, useMemo, useState } from 'react';
import { Check, Footprints, Hand, Home, MapPin, Sparkles, UtensilsCrossed, Box } from 'lucide-react';
import { Language } from '../../types';
import type { Tour } from '../../types/scene3d';
import { TRANSLATIONS } from '../../data/i18n';
import { ZACATECAS_PLACES } from '../../data/places';
import { TOURS_3D, loadTours } from '../../data/tours3d';
import { usePet } from '../../pet/usePet';
import {
  FEED_COOLDOWN_MS,
  SNACKS,
  WALK_DONE_XP,
  XP_PER_LEVEL,
  canFeed,
  isTired,
  levelOf,
  moodOf,
  type PetColor,
  type PetEvent,
  type SnackId,
} from '../../pet/petEngine';
import { PetSprite } from './PetSprite';

const COLORS: PetColor[] = ['plata', 'cantera', 'bronce'];

interface PetScreenProps {
  language: Language;
  onGoExplore: () => void;
}

const Bar: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[11px] font-semibold text-tenue">
      <span>{label}</span>
      <span className="font-mono">{Math.round(value)}</span>
    </div>
    <div className="h-2 rounded-full bg-caliza overflow-hidden" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <span className={`block h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

export const PetScreen: React.FC<PetScreenProps> = ({ language, onGoExplore }) => {
  const t = TRANSLATIONS[language];
  const { pet, events, clearEvents, adopt, feed, cuddle, startWalk, cancelWalk, simulateVisit, release } = usePet();
  const [tours, setTours] = useState<Tour[]>(TOURS_3D);
  const [name, setName] = useState('Platita');
  const [color, setColor] = useState<PetColor>('plata');
  const [toast, setToast] = useState<string | null>(null);
  const [snacksOpen, setSnacksOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void loadTours().then(setTours);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const placeName = (id: string) => {
    const p = ZACATECAS_PLACES.find((x) => x.id === id);
    return p ? (language === 'es' ? p.nameEs : p.name) : id;
  };
  const tourTitle = (id: string) => tours.find((x) => x.id === id)?.title[language] ?? id;

  // Lo que pasó mientras la pantalla estaba cerrada (o ahora) se cuenta como aviso.
  useEffect(() => {
    if (!events.length || !pet) return;
    const last: PetEvent = events.find((e) => e.type === 'walkDone') ?? events.find((e) => e.type === 'levelUp') ?? events[events.length - 1];
    const text =
      last.type === 'walkDone'
        ? `${t.petWalkDone.replace('{tour}', tourTitle(last.tourId))} +${WALK_DONE_XP} XP`
        : last.type === 'levelUp'
          ? t.petLevelUp.replace('{name}', pet.name).replace('{level}', String(last.level))
          : t.petVisitToast.replace('{name}', pet.name).replace('{place}', placeName(last.placeId));
    setToast(text);
    clearEvents();
  }, [events]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const walkTour = useMemo(() => (pet?.walk ? tours.find((x) => x.id === pet.walk?.tourId) : undefined), [pet?.walk, tours]);

  if (!pet) {
    return (
      <div className="h-full overflow-y-auto bg-papel">
        <div className="mx-auto max-w-lg px-4 py-8 space-y-5 text-center" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 0px))' }}>
          <div className="flex justify-center">
            <PetSprite color={color} mood="contento" tired={false} size={140} title={name} />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-serif font-bold text-2xl text-carbon">{t.petAdoptTitle}</h1>
            <p className="text-sm text-tenue">{t.petAdoptBody}</p>
          </div>
          <form
            className="space-y-4 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              adopt(name, color);
            }}
          >
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-tenue">{t.petNameLabel}</span>
              <input
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-linea bg-superficie px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
              />
            </label>
            <fieldset className="space-y-1">
              <legend className="text-xs font-semibold text-tenue">{t.petColorLabel}</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    onClick={() => setColor(c)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-xs font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota ${
                      color === c ? 'border-cantera bg-caliza text-cantera' : 'border-linea bg-superficie text-tenue hover:bg-caliza'
                    }`}
                  >
                    <PetSprite color={c} mood="contento" tired={false} size={44} />
                    {t[`petColor_${c}`]}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-carbon text-papel text-sm font-bold cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
            >
              {t.petAdopt}
            </button>
          </form>
          <p className="text-[11px] text-tenue">{t.petSaveHint}</p>
        </div>
      </div>
    );
  }

  const mood = moodOf(pet);
  const tired = isTired(pet);
  const level = levelOf(pet.xp);
  const xpInLevel = pet.xp % XP_PER_LEVEL;
  const feedable = canFeed(pet, new Date(now));
  const feedWaitMin = pet.lastFedAt
    ? Math.max(1, Math.ceil((Date.parse(pet.lastFedAt) + FEED_COOLDOWN_MS - now) / 60_000))
    : 0;
  const nextStop = pet.walk?.stopPlaceIds.find((id) => !pet.walk?.visited.includes(id));
  const speech = pet.walk && nextStop
    ? t.petSay_walk.replace('{place}', placeName(nextStop))
    : tired
      ? t.petSay_tired
      : t[`petSay_${mood}`];

  return (
    <div className="h-full overflow-y-auto bg-papel">
      <header
        className="px-4 pb-4 bg-gradient-to-b from-[#B4462C] to-[#7C2D12] text-white"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <div>
            <h1 className="font-serif font-bold text-xl">{pet.name}</h1>
            <p className="text-xs opacity-85">
              {t.petLevel.replace('{level}', String(level))}
              {' · '}
              {t.petWalksCount.replace('{count}', String(pet.completedWalks.length))}
            </p>
          </div>
          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-terracota rounded">{t.demoBadge}</span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-3 py-4 space-y-4">
        <section className="relative rounded-3xl bg-caliza border border-linea pt-5 pb-3 px-4 flex flex-col items-center">
          <p className="relative max-w-[85%] text-center text-sm bg-superficie border border-linea rounded-2xl px-3 py-2 shadow-sm" aria-live="polite">
            {speech}
            <span className="absolute left-1/2 -bottom-1.5 w-3 h-3 -translate-x-1/2 rotate-45 bg-superficie border-r border-b border-linea" />
          </p>
          <button type="button" onClick={cuddle} className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota" aria-label={t.petCuddle}>
            <PetSprite color={pet.color} mood={mood} tired={tired} walking={!!pet.walk} size={170} title={pet.name} />
          </button>
        </section>

        <section className="space-y-2.5 rounded-2xl bg-superficie border border-linea p-3">
          <Bar label={t.petMoodLabel} value={pet.mood} tone="bg-rosa" />
          <Bar label={t.petEnergyLabel} value={pet.energy} tone="bg-terracota" />
          <Bar label={`${t.petXpLabel} · ${t.petLevel.replace('{level}', String(level))}`} value={(xpInLevel / XP_PER_LEVEL) * 100} tone="bg-rec" />
        </section>

        <section className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSnacksOpen((v) => !v)}
            aria-expanded={snacksOpen}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-linea bg-superficie text-sm font-bold cursor-pointer hover:bg-caliza focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <UtensilsCrossed className="w-4 h-4 text-terracota" />
            {t.petFeed}
          </button>
          <button
            type="button"
            onClick={cuddle}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-linea bg-superficie text-sm font-bold cursor-pointer hover:bg-caliza focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
          >
            <Hand className="w-4 h-4 text-rosa" />
            {t.petCuddle}
          </button>
          {snacksOpen && (
            <div className="col-span-2 rounded-2xl bg-superficie border border-linea p-2 space-y-2">
              {feedable ? (
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(SNACKS) as SnackId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        feed(id);
                        setSnacksOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-full bg-caliza text-xs font-semibold cursor-pointer hover:bg-linea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
                    >
                      {t[`petSnack_${id}`]} <span className="font-mono text-tenue">+{SNACKS[id].energy}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-tenue px-1">{t.petFedWait.replace('{min}', String(feedWaitMin))}</p>
              )}
            </div>
          )}
        </section>

        {pet.walk ? (
          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                <Footprints className="w-3.5 h-3.5" />
                {t.petWalkActive.replace('{tour}', walkTour?.title[language] ?? pet.walk.tourId)}
              </span>
              <span className="font-mono text-[11px] text-violet-700 whitespace-nowrap">
                {t.petWalkProgress
                  .replace('{done}', String(pet.walk.visited.length))
                  .replace('{total}', String(pet.walk.stopPlaceIds.length))}
              </span>
            </div>
            <ol className="space-y-1.5">
              {pet.walk.stopPlaceIds.map((id) => {
                const done = pet.walk?.visited.includes(id);
                return (
                  <li key={id} className="flex items-center gap-2 text-sm">
                    <span className={`grid place-items-center w-5 h-5 rounded-full shrink-0 ${done ? 'bg-violet-600 text-white' : 'border border-violet-300 text-violet-400'}`}>
                      {done ? <Check className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                    </span>
                    <span className={`flex-1 ${done ? 'text-tenue line-through' : ''}`}>{placeName(id)}</span>
                    {!done && (
                      // PROTO: botón de demo para jugar sin ir al centro; se quita cuando haya misiones presenciales.
                      <button
                        type="button"
                        onClick={() => simulateVisit(id)}
                        className="text-[10px] font-semibold text-violet-700 underline underline-offset-2 cursor-pointer"
                      >
                        {t.petWalkSimulate}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={onGoExplore}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-carbon text-papel text-sm font-bold cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
              >
                <Box className="w-4 h-4" />
                {t.petWalkGo}
              </button>
              <button
                type="button"
                onClick={cancelWalk}
                className="flex items-center gap-1.5 px-3 rounded-xl border border-violet-200 bg-superficie text-xs font-semibold text-violet-700 cursor-pointer hover:bg-violet-100"
              >
                <Home className="w-3.5 h-3.5" />
                {t.petWalkCancel}
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-tenue">
              <Footprints className="w-3.5 h-3.5" />
              {t.petWalkTitle}
            </h2>
            <p className="text-xs text-tenue">{tired ? t.petWalkTooTired : t.petWalkPick}</p>
            <ul className="space-y-2">
              {tours.map((tour) => {
                const done = pet.completedWalks.includes(tour.id);
                return (
                  <li key={tour.id} className="flex items-center gap-3 rounded-2xl bg-superficie border border-linea p-3">
                    <div className="flex-1 min-w-0">
                      <b className="block text-sm truncate">{tour.title[language]}</b>
                      <small className="text-[11px] text-tenue">
                        {t.petWalkStops.replace('{count}', String(new Set(tour.stops.map((s) => s.placeId)).size))}
                        {done && ' · ✓'}
                      </small>
                    </div>
                    <button
                      type="button"
                      disabled={tired}
                      onClick={() => startWalk(tour.id, tour.stops.map((s) => s.placeId))}
                      className="px-4 py-2 rounded-xl bg-cantera text-sobre-cantera text-xs font-bold cursor-pointer hover:bg-cantera-2 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
                    >
                      {t.petWalkStart}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-dashed border-linea p-3 space-y-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-tenue">
            <Sparkles className="w-3.5 h-3.5" />
            {t.petFutureTitle}
          </span>
          <p className="text-xs text-tenue">{t.petFutureBody}</p>
        </section>

        <p className="text-[11px] text-tenue text-center">{t.petSaveHint}</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t.petReleaseConfirm.replace('{name}', pet.name))) release();
          }}
          className="mx-auto block text-[11px] text-tenue underline underline-offset-2 cursor-pointer hover:text-carbon"
        >
          {t.petRelease}
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-carbon text-papel text-sm font-semibold shadow-lg"
          style={{ bottom: 'calc(var(--tabbar-h) + 1rem)' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
};
