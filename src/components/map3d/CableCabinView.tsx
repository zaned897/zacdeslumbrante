import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Language } from '../../types';
import type { CabinState, CabinView, SceneEngine } from '../../types/scene3d';
import { TRANSLATIONS } from '../../data/i18n';
import { CENTRO_POINTS } from '../../data/centroPoints';
import { pointsAlongCable, type CableNearby } from '../../scene3d/cableNearby';

// En móvil (#272), a bordo los avisos se vuelven una barra chica y el texto de la simulación se va tras INTRO_MS.
const INTRO_MS = 4000;
/** Un nombre se ve mientras la cabina está a menos de esta fracción de la línea de su punto (#311). */
const NEAR_WINDOW = 0.12;
/** Por debajo de esto (m) el punto queda «abajo», no al norte ni al sur. */
const BELOW_M = 40;

const IDLE: CabinState = { status: 'unavailable', riding: false, heightM: null };

interface Station { id: string; lat: number; lng: number }
let nearbyCache: CableNearby[] | null = null;

/** Lugares del catálogo (#294) cerca de la línea, calculados una vez con las estaciones de teleferico.json. */
function useCableNearby(active: boolean): CableNearby[] {
  const [list, setList] = useState<CableNearby[]>(nearbyCache ?? []);
  useEffect(() => {
    if (!active || nearbyCache) return;
    const controller = new AbortController();
    fetch('/data/teleferico.json', { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ stations?: Station[] }>) : null))
      .then((data) => {
        const grillo = data?.stations?.find((s) => s.id === 'grillo');
        const bufa = data?.stations?.find((s) => s.id === 'bufa');
        if (!grillo || !bufa) return;
        nearbyCache = pointsAlongCable(grillo, bufa, CENTRO_POINTS);
        setList(nearbyCache);
      })
      .catch(() => {
        // Sin estaciones no hay nombres; el recorrido sigue igual.
      });
    return () => controller.abort();
  }, [active]);
  return list;
}

export function CableCabinView({ engine, language, hidden, frameContainer, onRidingChange, boardButton = true }: {
  engine: SceneEngine | null; language: Language; hidden: boolean; frameContainer: HTMLElement | null;
  onRidingChange?: (riding: boolean) => void;
  /** false: el aviso solo sale a bordo; para subir se usa el menú radial (#310). */
  boardButton?: boolean;
}) {
  const t = TRANSLATIONS[language];
  const [state, setState] = useState<CabinState>(IDLE);
  useEffect(() => {
    const read = () => setState(engine?.getCableCabinState?.() ?? IDLE);
    read(); const timer = window.setInterval(read, 250);
    return () => { window.clearInterval(timer); engine?.rideCableCabin?.(false); };
  }, [engine]);
  useEffect(() => { if (hidden) engine?.rideCableCabin?.(false); }, [engine, hidden]);
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    onRidingChange?.(state.riding);
    if (!state.riding) return;
    setShowIntro(true);
    const timer = window.setTimeout(() => setShowIntro(false), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [state.riding, onRidingChange]);
  useEffect(() => () => onRidingChange?.(false), [onRidingChange]);
  useEffect(() => {
    if (!state.riding) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') engine?.rideCableCabin?.(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [engine, state.riding]);
  const nearby = useCableNearby(state.riding);
  const progress = state.progress ?? null;
  const passing = useMemo(
    () => (progress === null ? [] : nearby.filter((p) => Math.abs(p.t - progress) <= NEAR_WINDOW)),
    [nearby, progress],
  );
  if (hidden || state.status === 'unavailable' || (!boardButton && !state.riding)) return null;
  const view: CabinView = state.view ?? 'side';
  const setView = (next: CabinView) => {
    engine?.setCableCabinView?.(next);
    setState((s) => ({ ...s, view: next }));
  };
  const mobileIntro = state.riding && !showIntro ? 'max-md:hidden' : '';
  const where = (p: CableNearby) => Math.abs(p.offsetM) < BELOW_M ? t.cabinNearBelow
    : (p.offsetM > 0 ? t.cabinNearSouth : t.cabinNearNorth).replace('{m}', String(Math.round(Math.abs(p.offsetM) / 10) * 10));
  return <>
    <aside aria-label={t.telefericoTitle} className={`rounded-xl border border-stone-200 bg-[#FBF9F5] p-2 text-xs text-stone-900 shadow-sm ${state.riding ? 'max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-1 max-md:bg-[#FBF9F5]/90' : ''}`}>
      <p role="status" className={`font-semibold max-md:basis-full max-md:order-last ${mobileIntro}`}>{state.status === 'closed' ? t.cabinClosed : state.status === 'reduced' ? t.cabinReduced : t.cabinRunning}</p>
      <p className={`my-1 text-stone-600 max-md:basis-full max-md:order-last ${state.riding ? 'max-md:my-0' : ''} ${mobileIntro}`}>{t.cabinSimulation}</p>
      {state.riding && (
        // Perfil o desde arriba (#311): sustituye al piso de cristal.
        <div role="radiogroup" aria-label={t.cabinView} className="my-1.5 flex w-full rounded-full bg-stone-200/70 p-0.5 max-md:my-0 max-md:basis-full">
          {(['side', 'above'] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
              className={`flex-1 rounded-full px-2 py-1.5 font-semibold cursor-pointer ${view === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}>
              {v === 'side' ? t.cabinViewSide : t.cabinViewAbove}
            </button>
          ))}
        </div>
      )}
      <button type="button" aria-pressed={state.riding} disabled={!state.riding && state.status !== 'running'}
        className={`rounded-full bg-[#9A3412] px-3 py-2 font-semibold text-white disabled:opacity-50 ${state.riding ? 'max-md:py-1.5' : ''}`}
        onClick={() => { engine?.rideCableCabin?.(!state.riding); setState(engine?.getCableCabinState?.() ?? state); }}>
        {state.riding ? t.cabinExit : t.cabinBoard}
      </button>
      {state.riding && <p className="mt-2 max-md:mt-0 max-md:flex-1">{state.heightM === null ? t.cabinHeightUnavailable
        : t.cabinHeight.replace('{height}', String(Math.round(state.heightM)))}</p>}
    </aside>
    {state.riding && frameContainer && createPortal(
      <div className="pointer-events-none absolute inset-x-3 top-16 z-10 mx-auto flex max-w-md flex-col gap-2 md:inset-x-auto md:right-4 md:top-20 md:mx-0 md:w-80">
        <div className="rounded-full border border-stone-200 bg-[#FBF9F5]/90 px-3 py-1.5 text-[11px] font-semibold text-stone-900 shadow-sm">
          <div className="flex justify-between"><span>{t.cabinLineFrom}</span><span>{t.cabinLineTo}</span></div>
          <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-stone-900/15" role="progressbar" aria-label={t.cabinProgress}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === null ? undefined : Math.round(progress * 100)}>
            <i className="absolute inset-y-0 left-0 rounded-full bg-[#9A3412] transition-[width] duration-300" style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
        </div>
        <ul aria-label={t.cabinNearby} aria-live="polite" className="flex flex-wrap gap-1.5">
          {passing.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-[#FBF9F5]/90 py-1 pl-1 pr-2.5 text-[11px] font-bold text-stone-900 shadow-sm motion-safe:animate-[aparece_.35s_ease-out]">
              <i className={`block h-4 w-4 rounded-full ${p.offsetM > 0 ? 'bg-[#9A3412]' : 'bg-[#0E7490]'}`} aria-hidden="true" />
              {p.name} <small className="font-medium text-stone-500">· {where(p)}</small>
            </li>
          ))}
        </ul>
      </div>, frameContainer)}
  </>;
}
