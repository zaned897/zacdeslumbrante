import React, { useEffect, useMemo, useState } from 'react';
import { Check, Footprints, Hand, Home, Lock, MapPin, Sparkles, UtensilsCrossed, Box } from 'lucide-react';
import { Language } from '../../types';
import type { Tour } from '../../types/scene3d';
import { TRANSLATIONS } from '../../data/i18n';
import { ZACATECAS_PLACES } from '../../data/places';
import { TOURS_3D, loadTours } from '../../data/tours3d';
import { usePet } from '../../pet/usePet';
import {
  FEED_COOLDOWN_MS,
  SNACKS,
  canFeed,
  canUseDesign,
  isTired,
  moodOf,
  type Design,
  type PetEvent,
  type PetState,
  type SnackId,
} from '../../pet/petEngine';
import { RESOURCES, rankOf, resourceDef, type ResourceId } from '../../pet/resources';
import { AnimalSprite, swatchOf } from './AnimalSprite';
import { PetAdopt } from './PetAdopt';

const DESIGNS: Design[] = [0, 1, 2, 3];
// Resaltar primero lo más tradicional; la piedra de río sale en todas partes y no se nombra.
const SOURCE_ORDER: ResourceId[] = ['meteorito', 'plata', 'cantera', 'cobre'];

/** Texto oscuro o claro sobre el color del recurso. */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#1E293B' : '#FFFFFF';
}

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
  const { pet, events, clearEvents, adopt, setDesign, available, setSpecies, feed, cuddle, startWalk, cancelWalk, simulateVisit, release } = usePet();
  const [tours, setTours] = useState<Tour[]>(TOURS_3D);
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
  const resName = (id: ResourceId) => t[`petRes_${id}`];
  const listJoin = (items: string[]) =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')}${t.petSourceAnd}${items[items.length - 1]}`;
  const rankLabel = (p: PetState) => {
    const r = rankOf(p.inventory);
    return r.legendary
      ? t.petRankLegendary.replace('{resource}', resName('meteorito'))
      : t.petRank.replace('{rank}', String(r.rank)).replace('{resource}', resName(r.resource));
  };

  // Lo que pasó mientras la pantalla estaba cerrada (o ahora) se cuenta como aviso; lo más importante gana.
  useEffect(() => {
    if (!events.length || !pet) return;
    const pick = (type: PetEvent['type']) => [...events].reverse().find((e) => e.type === type);
    const last = pick('speciesEarned') ?? pick('rankUp') ?? pick('walkDone') ?? events[events.length - 1];
    const text =
      last.type === 'speciesEarned'
        ? t.petSpeciesEarnedToast.replace('{species}', t[`petSpecies_${last.species}`].toLocaleLowerCase(language))
        : last.type === 'rankUp'
        ? t.petRankUpToast.replace('{name}', pet.name).replace('{rank}', rankLabel(pet))
        : last.type === 'walkDone'
          ? `${t.petWalkDone.replace('{tour}', tourTitle(last.tourId))} ${t.petGoldToast}`
          : t.petFoundToast
              .replace('{name}', pet.name)
              .replace('{items}', listJoin(last.found.map((r) => resName(r).toLocaleLowerCase(language))))
              .replace('{place}', placeName(last.placeId));
    setToast(text);
    clearEvents();
  }, [events]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const walkTour = useMemo(() => (pet?.walk ? tours.find((x) => x.id === pet.walk?.tourId) : undefined), [pet?.walk, tours]);

  if (!pet) return <PetAdopt language={language} available={available} onAdopt={adopt} />;

  const mood = moodOf(pet);
  const tired = isTired(pet);
  const rank = rankOf(pet.inventory);
  const nextDef = rank.next ? resourceDef(rank.next) : null;
  const pillColor = resourceDef(rank.legendary ? 'meteorito' : rank.resource).color;
  // "La plata salió de la Mina El Edén; la cantera, de la Catedral y el Calderón."
  const sourceNote = SOURCE_ORDER.map((res) => {
    const places = [...new Set(pet.finds.filter((f) => f.resource === res && f.placeId).map((f) => f.placeId as string))];
    return places.length ? { res, places: places.slice(-2).map(placeName) } : null;
  })
    .filter((x): x is { res: ResourceId; places: string[] } => x !== null)
    .slice(0, 2)
    .map(({ res, places }, i) =>
      (i === 0 ? t.petSourceFirst : t.petSourceNext)
        .replace('{art}', t[`petResArt_${res}`])
        .replace('{res}', resName(res).toLocaleLowerCase(language))
        .replace('{places}', listJoin(places)),
    )
    .join('; ')
    .replace(/^./, (c) => c.toLocaleUpperCase(language));
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
        className="px-4 pb-4 bg-gradient-to-b from-[#7C2D12] to-[#9A3412] text-white"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="mx-auto max-w-lg flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <h1 className="font-extrabold text-xl">{pet.name}</h1>
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-terracota rounded">{t.demoBadge}</span>
          </div>
          <button
            type="button"
            onClick={cuddle}
            aria-label={t.petCuddle}
            className="self-center cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <AnimalSprite
              species={pet.species}
              design={pet.design}
              mood={mood}
              tired={tired}
              walking={!!pet.walk}
              upgrades={rank.unlocked}
              size={150}
              title={pet.name}
            />
          </button>
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-extrabold" style={{ background: pillColor, color: inkOn(pillColor) }}>
              {rankLabel(pet)}
            </span>
            <small className="text-[11px] opacity-85 text-right">
              {nextDef
                ? (nextDef.rank === 'legendario' ? t.petRankNextLegendary : t.petRankNext).replace('{resource}', resName(nextDef.id))
                : t.petRankMax}
            </small>
          </div>
          <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
            <span className="block h-full rounded-full bg-[#E2E8F0] transition-[width] duration-500" style={{ width: `${rank.progress * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-3 py-4 space-y-4">
        <section className="space-y-2">
          <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-cantera">{t.petResourcesTitle}</h2>
          <ul className="grid grid-cols-2 gap-1.5">
            {RESOURCES.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl border border-linea bg-superficie px-2.5 py-1.5 text-xs font-semibold min-w-0">
                <i className="w-3 h-3 rotate-45 rounded-[3px] shrink-0" style={{ background: r.color }} aria-hidden="true" />
                <span className="truncate">{resName(r.id)}</span>
                <b className="ml-auto font-mono text-[11px] text-tenue">×{pet.inventory[r.id]}</b>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-cantera">{t.petUpgradesTitle}</h2>
          <ul className="flex flex-wrap gap-1.5">
            {RESOURCES.map((r) => {
              const on = rank.unlocked.has(r.upgrade);
              return (
                <li
                  key={r.upgrade}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    on ? 'border border-cantera text-cantera bg-cita' : 'border border-dashed border-linea text-tenue'
                  }`}
                >
                  {t[`petUp_${r.upgrade}`]}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2.5 pt-1" role="radiogroup" aria-label={t.petDesignsLabel}>
            <span className="text-xs font-bold text-tenue">{t.petDesignsLabel}</span>
            {DESIGNS.map((d) => {
              const locked = !canUseDesign(pet, d);
              const on = d === pet.design;
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
                  style={{ background: swatchOf(pet.species, d) }}
                >
                  {locked && <Lock className="absolute -bottom-1 -right-1 w-3 h-3 p-px rounded-full bg-superficie text-tenue" />}
                </button>
              );
            })}
          </div>
          {available.length > 1 && (
            <div className="flex items-center gap-1.5 p-1 -mx-1 overflow-x-auto" role="radiogroup" aria-label={t.petCompanionLabel}>
              <span className="text-xs font-bold text-tenue shrink-0">{t.petCompanionLabel}</span>
              {available.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === pet.species}
                  aria-label={t[`petSpecies_${s}`]}
                  title={t[`petSpecies_${s}`]}
                  onClick={() => setSpecies(s)}
                  className={`shrink-0 rounded-full p-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota ${
                    s === pet.species ? 'bg-cita ring-2 ring-cantera' : 'hover:bg-caliza'
                  }`}
                >
                  <AnimalSprite species={s} design={pet.design} size={34} animate={false} />
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-tenue">{sourceNote ? `${sourceNote}.` : t.petSourceEmpty}</p>
        </section>

        <p className="relative text-center text-sm bg-superficie border border-linea rounded-2xl px-3 py-2" aria-live="polite">
          {speech}
        </p>

        <section className="space-y-2.5 rounded-2xl bg-superficie border border-linea p-3">
          <Bar label={t.petMoodLabel} value={pet.mood} tone="bg-rosa" />
          <Bar label={t.petEnergyLabel} value={pet.energy} tone="bg-terracota" />
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
