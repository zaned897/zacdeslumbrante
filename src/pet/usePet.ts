import { useCallback, useEffect, useRef, useState } from 'react';
import { progress } from '../progress/progressStore';
import { readVisits, recordPlaceVisit } from './visits';
import {
  adoptPet,
  cancelWalk,
  cuddle,
  feed,
  isPetState,
  startWalk,
  tick,
  type PetColor,
  type PetEvent,
  type PetState,
  type SnackId,
} from './petEngine';

const TICK_EVERY_MS = 60_000;

function readPet(): PetState | null {
  const raw = progress.read<unknown>('pet');
  return isPetState(raw) ? raw : null;
}

/** Estado de la mascota guardado en el almacén de progreso, con el reloj corriendo. */
export function usePet() {
  const [pet, setPet] = useState<PetState | null>(readPet);
  const [events, setEvents] = useState<PetEvent[]>([]);
  const petRef = useRef(pet);
  petRef.current = pet;

  const save = useCallback((next: PetState | null) => {
    petRef.current = next;
    setPet(next);
    progress.write('pet', next);
  }, []);

  const runTick = useCallback(() => {
    const current = petRef.current;
    if (!current) return;
    const { state, events: fresh } = tick(current, new Date(), readVisits());
    save(state);
    if (fresh.length) setEvents((prev) => [...prev, ...fresh]);
  }, [save]);

  useEffect(() => {
    runTick();
    const id = setInterval(runTick, TICK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && runTick();
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = progress.subscribe((key) => {
      if (key === 'visits') runTick();
      if (key === 'pet') {
        // Otra pestaña o la cuenta cambiaron la mascota: tomar la versión guardada.
        const stored = readPet();
        if (stored?.updatedAt !== petRef.current?.updatedAt) {
          petRef.current = stored;
          setPet(stored);
        }
      }
    });
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [runTick]);

  const update = useCallback(
    (fn: (p: PetState, now: Date) => PetState) => {
      const current = petRef.current;
      if (current) save(fn(current, new Date()));
    },
    [save],
  );

  return {
    pet,
    events,
    clearEvents: useCallback(() => setEvents([]), []),
    adopt: useCallback((name: string, color: PetColor) => save(adoptPet(name, color, new Date())), [save]),
    feed: useCallback((snack: SnackId) => update((p, now) => feed(p, snack, now)), [update]),
    cuddle: useCallback(() => update(cuddle), [update]),
    startWalk: useCallback(
      (tourId: string, stops: string[]) => update((p, now) => startWalk(p, tourId, stops, now)),
      [update],
    ),
    cancelWalk: useCallback(() => update(cancelWalk), [update]),
    // PROTO: atajo de demo para jugar sin ir al centro; la visita real llega desde la Ciudad 3D.
    simulateVisit: useCallback((placeId: string) => recordPlaceVisit(placeId), []),
    release: useCallback(() => save(null), [save]),
  };
}
