import React, { useEffect, useState } from 'react';
import { CableCar, RotateCcw, Trophy } from 'lucide-react';
import type { Language } from '../../types';
import type { CabinState, SceneEngine } from '../../types/scene3d';
import { TRANSLATIONS } from '../../data/i18n';

interface LineData {
  lengthM: number;
  tripSeconds: number;
}

let lineCache: LineData | null = null;

/** Largo y duración de la línea desde `public/data/teleferico.json` (con fuente), una sola vez. */
function useCableLine(): LineData | null {
  const [line, setLine] = useState<LineData | null>(lineCache);
  useEffect(() => {
    if (lineCache) return;
    const controller = new AbortController();
    fetch('/data/teleferico.json', { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ line?: Partial<LineData> }>) : null))
      .then((data) => {
        const l = data?.line;
        if (typeof l?.lengthM === 'number' && typeof l.tripSeconds === 'number') {
          lineCache = { lengthM: l.lengthM, tripSeconds: l.tripSeconds };
          setLine(lineCache);
        }
      })
      .catch(() => {
        // Sin datos la tarjeta solo muestra el nombre de la línea.
      });
    return () => controller.abort();
  }, []);
  return line;
}

/** Tarjeta del teleférico en el menú radial (#310): datos de la línea y «Subir». */
export const CableRideCard: React.FC<{ engine: SceneEngine | null; language: Language; onDone: () => void }> = ({
  engine,
  language,
  onDone,
}) => {
  const t = TRANSLATIONS[language];
  const line = useCableLine();
  const [state, setState] = useState<CabinState>(
    () => engine?.getCableCabinState?.() ?? { status: 'unavailable', riding: false, heightM: null },
  );
  useEffect(() => {
    const read = () => setState(engine?.getCableCabinState?.() ?? { status: 'unavailable', riding: false, heightM: null });
    const timer = window.setInterval(read, 500);
    return () => window.clearInterval(timer);
  }, [engine]);
  const canRide = state.status === 'running' || state.status === 'reduced';
  const status =
    state.status === 'closed' ? t.cabinClosed : state.status === 'reduced' ? t.cabinReduced : state.status === 'running' ? t.cabinRunning : t.menuCableUnavailable;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#7C2D12]">{t.menuCableLine}</p>
      {line && (
        <h3 className="font-serif text-sm font-bold">
          {t.menuCableFacts.replace('{m}', String(line.lengthM)).replace('{min}', String(Math.round(line.tripSeconds / 60)))}
        </h3>
      )}
      <p className="text-[11px] text-stone-600">{status}</p>
      <button
        type="button"
        disabled={!canRide}
        onClick={() => {
          engine?.rideCableCabin?.(true);
          onDone();
        }}
        className="mt-1 flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#9A3412] px-3 py-2 text-xs font-bold text-white hover:bg-[#78350F] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        <CableCar className="h-4 w-4" aria-hidden="true" />
        {t.menuCableRide}
      </button>
    </div>
  );
};

/** Tarjeta de la colección en el menú radial: avance y reiniciar. */
export const CollectionCard: React.FC<{ found: number; total: number; onReset: () => void; language: Language }> = ({
  found,
  total,
  onReset,
  language,
}) => {
  const t = TRANSLATIONS[language];
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="flex items-center gap-1.5 font-semibold">
        <Trophy className="h-4 w-4 text-[#D97706]" aria-hidden="true" />
        {t.view3dCollection}: {found}/{total}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full bg-[#9A3412]" style={{ width: `${total ? (found / total) * 100 : 0}%` }} />
      </div>
      <p className="text-[11px] text-stone-600">{t.menuCollectionHint}</p>
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-1.5 self-start rounded-full px-2 py-1 font-semibold text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 cursor-pointer"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {t.view3dResetCollection}
      </button>
    </div>
  );
};
