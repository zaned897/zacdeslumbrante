import React, { useEffect, useState } from 'react';

/** Movimiento mínimo (px) para que soltar cuente como fin de arrastre y no como toque. */
const DRAG_PX = 8;
const DROP_MS = 700;

interface Drop {
  id: number;
  x: number;
  y: number;
}

/**
 * Gota tipo lente al soltar el mapa (#308): una capa DOM encima del canvas dibuja una gota y dos
 * anillos donde se levantó el dedo tras arrastrar. No toca la escena 3D ni recibe toques.
 * Con `prefers-reduced-motion` no se dibuja.
 */
export const ReleaseDrop: React.FC<{ target: HTMLElement | null }> = ({ target }) => {
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const starts = new Map<number, { x: number; y: number; moved: boolean }>();
    let next = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const down = (e: PointerEvent) => starts.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false });
    const move = (e: PointerEvent) => {
      const s = starts.get(e.pointerId);
      if (s && !s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > DRAG_PX) s.moved = true;
    };
    const up = (e: PointerEvent) => {
      const s = starts.get(e.pointerId);
      starts.delete(e.pointerId);
      // Con dos dedos (pellizco) solo el último en levantarse deja gota.
      if (!s?.moved || starts.size > 0) return;
      const rect = target.getBoundingClientRect();
      const drop = { id: next++, x: e.clientX - rect.left, y: e.clientY - rect.top };
      setDrops((list) => [...list.slice(-2), drop]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        setDrops((list) => list.filter((d) => d.id !== drop.id));
      }, DROP_MS);
      timers.add(timer);
    };
    const cancel = (e: PointerEvent) => starts.delete(e.pointerId);
    // En captura: OrbitControls captura el puntero y no deja burbujear el pointerup.
    target.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      target.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      for (const timer of timers) clearTimeout(timer);
    };
  }, [target]);

  if (!drops.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden="true">
      {drops.map((d) => (
        <span key={d.id} className="drop-lens" style={{ left: d.x, top: d.y }}>
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  );
};
