import { useCallback, useEffect, useRef } from 'react';
import { moveMeters, type LatLng } from './geo';
import type { PlayerPosition } from './usePlayerPosition';

export type AvatarAction = 'forward' | 'back' | 'left' | 'right';

const STEP_M = 6;
const TURN_DEG = 20;
// Plaza de Armas: punto de partida si aún no hay posición.
const START: LatLng = { lat: 22.7756, lng: -102.5723 };

const KEYS: Record<string, AvatarAction> = {
  w: 'forward',
  arrowup: 'forward',
  s: 'back',
  arrowdown: 'back',
  a: 'left',
  arrowleft: 'left',
  d: 'right',
  arrowright: 'right',
};

/** Teclado (WASD / flechas) y pad táctil: avanzar, retroceder y girar al avatar. */
export function useAvatarControls(
  enabled: boolean,
  position: PlayerPosition | null,
  teleport: (to: LatLng, heading?: number) => void,
) {
  const positionRef = useRef(position);
  positionRef.current = position;

  const act = useCallback(
    (action: AvatarAction) => {
      const here = positionRef.current ?? { ...START, heading: 0 };
      switch (action) {
        case 'forward':
          teleport(moveMeters(here, here.heading, STEP_M), here.heading);
          break;
        case 'back':
          teleport(moveMeters(here, here.heading, -STEP_M), here.heading);
          break;
        case 'left':
          teleport(here, (here.heading - TURN_DEG + 360) % 360);
          break;
        case 'right':
          teleport(here, (here.heading + TURN_DEG) % 360);
          break;
      }
    },
    [teleport],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable]')) return;
      const action = KEYS[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      act(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, act]);

  return act;
}
