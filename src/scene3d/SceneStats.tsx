import React, { useEffect, useState } from 'react';

/** Medidor para la PoC de motores (#11): se muestra con `?stats=1`. */
export function isStatsEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('stats') === '1';
}

/** Lo que el motor three.js dibujó en el último cuadro (solo se llena con `?stats=1`). */
type RenderStats = { calls: number; triangles: number; pixelRatio: number; tiles: number };
let latest: RenderStats | null = null;

export function publishRenderStats(info: { calls: number; triangles: number }, pixelRatio: number, tiles: number): void {
  latest = { calls: info.calls, triangles: info.triangles, pixelRatio, tiles };
}

export const SceneStats: React.FC<{ engine: string; mountMs: number | null; readyMs: number | null }> = ({
  engine,
  mountMs,
  readyMs,
}) => {
  const [fps, setFps] = useState<number | null>(null);
  // Tiempo por cuadro: mediana y percentil 95 de la última ventana de un segundo.
  const [frameMs, setFrameMs] = useState<{ p50: number; p95: number } | null>(null);
  const [render, setRender] = useState<RenderStats | null>(null);

  useEffect(() => {
    let last = performance.now();
    let prev = last;
    let id = 0;
    const deltas: number[] = [];
    const tick = (now: number) => {
      deltas.push(now - prev);
      prev = now;
      if (now - last >= 1000) {
        const sorted = [...deltas].sort((a, b) => a - b);
        const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
        setFps(Math.round((deltas.length * 1000) / (now - last)));
        setFrameMs({ p50: at(0.5), p95: at(0.95) });
        setRender(latest);
        deltas.length = 0;
        last = now;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const fmt = (ms: number | null) => (ms === null ? '…' : `${(ms / 1000).toFixed(1)} s`);
  return (
    <div className="absolute right-3 top-16 z-20 font-mono text-[11px] leading-tight text-white bg-stone-900/80 rounded-md px-2 py-1.5 pointer-events-none">
      <div>motor: {engine}</div>
      <div>montaje: {fmt(mountMs)}</div>
      <div>primera vista: {fmt(readyMs)}</div>
      <div>fps: {fps ?? '…'}</div>
      {frameMs && <div>cuadro: {frameMs.p50.toFixed(1)} ms · p95 {frameMs.p95.toFixed(1)} ms</div>}
      {render && (
        <>
          <div>draw calls: {render.calls}</div>
          <div>triángulos: {Math.round(render.triangles / 1000)} k</div>
          <div>pixel ratio: {render.pixelRatio} · mosaicos: {render.tiles}</div>
        </>
      )}
    </div>
  );
};
