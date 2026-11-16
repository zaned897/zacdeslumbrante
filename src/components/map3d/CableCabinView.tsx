import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Language } from '../../types';
import type { SceneEngine } from '../../types/scene3d';
import type { CabinState } from '../../scene3d/cableCabins';
import { TRANSLATIONS } from '../../data/i18n';

export function CableCabinView({ engine, language, hidden, frameContainer }: {
  engine: SceneEngine | null; language: Language; hidden: boolean; frameContainer: HTMLElement | null;
}) {
  const t = TRANSLATIONS[language];
  const [state, setState] = useState<CabinState>({ status: 'unavailable', riding: false, heightM: null });
  useEffect(() => {
    const read = () => setState(engine?.getCableCabinState?.() ?? { status: 'unavailable', riding: false, heightM: null });
    read(); const timer = window.setInterval(read, 250);
    return () => { window.clearInterval(timer); engine?.rideCableCabin?.(false); };
  }, [engine]);
  useEffect(() => { if (hidden) engine?.rideCableCabin?.(false); }, [engine, hidden]);
  useEffect(() => {
    if (!state.riding) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') engine?.rideCableCabin?.(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [engine, state.riding]);
  if (hidden || state.status === 'unavailable') return null;
  return <>
    <aside className="rounded-xl border border-stone-200 bg-[#FBF9F5] p-2 text-xs text-stone-900 shadow-sm">
      <p role="status" className="font-semibold">{state.status === 'closed' ? t.cabinClosed : state.status === 'reduced' ? t.cabinReduced : t.cabinRunning}</p>
      <p className="my-1 text-stone-600">{t.cabinSimulation}</p>
      <button type="button" aria-pressed={state.riding} disabled={!state.riding && state.status !== 'running'}
        className="rounded-full bg-[#9A3412] px-3 py-2 font-semibold text-white disabled:opacity-50"
        onClick={() => { engine?.rideCableCabin?.(!state.riding); setState(engine?.getCableCabinState?.() ?? state); }}>
        {state.riding ? t.cabinExit : t.cabinBoard}
      </button>
      {state.riding && <p className="mt-2">{t.cabinGlass} · {state.heightM === null ? t.cabinHeightUnavailable
        : t.cabinHeight.replace('{height}', String(Math.round(state.heightM)))}</p>}
    </aside>
    {state.riding && frameContainer && createPortal(
      <div aria-hidden="true" className="pointer-events-none absolute inset-[16%] z-10 rounded-3xl border-[12px] border-[#57534E]/80 shadow-[inset_0_0_0_3px_#F5EFE6]">
        <div className="absolute inset-x-0 top-1/2 h-1 bg-[#F5EFE6]/50" />
        <div className="absolute inset-y-0 left-1/2 w-1 bg-[#F5EFE6]/50" />
      </div>, frameContainer)}
  </>;
}
