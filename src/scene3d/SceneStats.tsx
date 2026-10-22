import React, { useEffect, useState } from 'react';

/** Medidor para la PoC de motores (#11): se muestra con `?stats=1`. */
export function isStatsEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('stats') === '1';
}

export const SceneStats: React.FC<{ engine: string; mountMs: number | null; readyMs: number | null }> = ({
  engine,
  mountMs,
  readyMs,
}) => {
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let id = 0;
    const tick = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
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
    </div>
  );
};
