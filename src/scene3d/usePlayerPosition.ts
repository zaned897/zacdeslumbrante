import { useCallback, useEffect, useRef, useState } from 'react';
import { bearingDegrees, distanceMeters, pointAlong, type LatLng } from './geo';

export type PlayerSource = 'gps' | 'simulated' | 'manual';

export interface PlayerPosition extends LatLng {
  heading: number;
  /** Metros; null en modo simulado o manual. */
  accuracy: number | null;
  source: PlayerSource;
}

export type FallbackReason = 'denied' | 'unavailable' | 'far' | 'forced';

interface Options {
  enabled: boolean;
  /** Ruta que sigue el modo simulado. PROTO: líneas rectas entre paradas, atraviesa manzanas. */
  simulatedPath: LatLng[];
  /** Centro del área de juego; fuera de `maxDistanceMeters` se usa el modo simulado. */
  playArea: LatLng;
  maxDistanceMeters?: number;
}

// PROTO: caminata acelerada x8 para que la simulación no tarde media hora.
const SIM_SPEED_MPS = 1.4 * 8;
const SIM_TICK_MS = 500;

/** `?sim=1` en la URL fuerza el modo simulado (p. ej. http://localhost:3000/?sim=1#3d). */
export function isSimulationForced(): boolean {
  return new URLSearchParams(window.location.search).get('sim') === '1';
}

/**
 * Posición del jugador: GPS del navegador o, si no se puede, una caminata simulada
 * sobre `simulatedPath`. La posición nunca sale del navegador.
 */
export function usePlayerPosition({
  enabled,
  simulatedPath,
  playArea,
  maxDistanceMeters = 10000,
}: Options) {
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const [fallbackReason, setFallbackReason] = useState<FallbackReason | null>(null);
  const [mode, setMode] = useState<'gps' | 'simulated'>('gps');
  const [isManual, setIsManual] = useState(false);
  const isManualRef = useRef(false);
  const lastHeading = useRef(0);

  /** Mover al jugador a mano (clic en el mapa); pausa GPS y simulación hasta `resume()`. */
  const teleport = useCallback((to: LatLng) => {
    isManualRef.current = true;
    setIsManual(true);
    setPosition((prev) => ({
      ...to,
      heading: prev ? bearingDegrees(prev, to) : 0,
      accuracy: null,
      source: 'manual',
    }));
  }, []);

  const resume = useCallback(() => {
    isManualRef.current = false;
    setIsManual(false);
  }, []);

  // Elegir la fuente al activar.
  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setFallbackReason(null);
      resume();
      return;
    }
    if (isSimulationForced() || !('geolocation' in navigator)) {
      setFallbackReason(isSimulationForced() ? 'forced' : 'unavailable');
      setMode('simulated');
      return;
    }
    setMode('gps');
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        if (isManualRef.current) return;
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (distanceMeters(here, playArea) > maxDistanceMeters) {
          navigator.geolocation.clearWatch(watchId);
          setFallbackReason('far');
          setMode('simulated');
          return;
        }
        if (p.coords.heading !== null && !Number.isNaN(p.coords.heading)) {
          lastHeading.current = p.coords.heading;
        }
        setPosition({ ...here, heading: lastHeading.current, accuracy: p.coords.accuracy, source: 'gps' });
      },
      (err) => {
        navigator.geolocation.clearWatch(watchId);
        setFallbackReason(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
        setMode('simulated');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, playArea, maxDistanceMeters, resume]);

  // Caminata simulada en bucle.
  useEffect(() => {
    if (!enabled || isManual || mode !== 'simulated' || simulatedPath.length < 2) return;
    let walked = 0;
    const id = setInterval(() => {
      walked += (SIM_SPEED_MPS * SIM_TICK_MS) / 1000;
      const step = pointAlong(simulatedPath, walked) ?? pointAlong(simulatedPath, (walked = 0));
      if (step) setPosition({ ...step.point, heading: step.heading, accuracy: null, source: 'simulated' });
    }, SIM_TICK_MS);
    return () => clearInterval(id);
  }, [enabled, isManual, mode, simulatedPath]);

  return { position, fallbackReason, isManual, teleport, resume };
}
