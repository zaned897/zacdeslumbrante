import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Language } from '../../types';
import type { CabinState, SceneEngine } from '../../types/scene3d';
import { TRANSLATIONS } from '../../data/i18n';

// En móvil (#272), a bordo los avisos se vuelven una barra chica y el texto de la simulación se va tras INTRO_MS.
const INTRO_MS = 4000;

export function CableCabinView({ engine, language, hidden, frameContainer, onRidingChange }: {
  engine: SceneEngine | null; language: Language; hidden: boolean; frameContainer: HTMLElement | null;
  onRidingChange?: (riding: boolean) => void;
}) {
  const t = TRANSLATIONS[language];
  const [state, setState] = useState<CabinState>({ status: 'unavailable', riding: false, heightM: null });
  useEffect(() => {
    const read = () => setState(engine?.getCableCabinState?.() ?? { status: 'unavailable', riding: false, heightM: null });
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
  if (hidden || state.status === 'unavailable') return null;
  const mobileIntro = state.riding && !showIntro ? 'max-md:hidden' : '';
  return <>
    <aside aria-label={t.telefericoTitle} className={`glass rounded-2xl p-2 text-xs text-stone-900 ${state.riding ? 'max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3 max-md:gap-y-1 max-md:bg-[#FBF9F5]/90' : ''}`}>
      <p role="status" className={`font-semibold max-md:basis-full max-md:order-last ${mobileIntro}`}>{state.status === 'closed' ? t.cabinClosed : state.status === 'reduced' ? t.cabinReduced : t.cabinRunning}</p>
      <p className={`my-1 text-stone-600 max-md:basis-full max-md:order-last ${state.riding ? 'max-md:my-0' : ''} ${mobileIntro}`}>{t.cabinSimulation}</p>
      <button type="button" aria-pressed={state.riding} disabled={!state.riding && state.status !== 'running'}
        className={`rounded-full bg-[#9A3412] px-3 py-2 font-semibold text-white disabled:opacity-50 ${state.riding ? 'max-md:py-1.5' : ''}`}
        onClick={() => { engine?.rideCableCabin?.(!state.riding); setState(engine?.getCableCabinState?.() ?? state); }}>
        {state.riding ? t.cabinExit : t.cabinBoard}
      </button>
      {state.riding && <p className="mt-2 max-md:mt-0 max-md:flex-1">{t.cabinGlass} · {state.heightM === null ? t.cabinHeightUnavailable
        : t.cabinHeight.replace('{height}', String(Math.round(state.heightM)))}</p>}
    </aside>
    {state.riding && frameContainer && createPortal(
      <div aria-hidden="true" className="pointer-events-none absolute inset-[16%] z-10 rounded-3xl border-[12px] max-md:inset-[6%] max-md:border-[6px] border-[#57534E]/80 shadow-[inset_0_0_0_3px_#F5EFE6]">
        <div className="absolute inset-x-0 top-1/2 h-1 bg-[#F5EFE6]/50" />
        <div className="absolute inset-y-0 left-1/2 w-1 bg-[#F5EFE6]/50" />
      </div>, frameContainer)}
  </>;
}
