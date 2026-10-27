import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Footprints,
  Globe,
  Home,
  Layers,
  LocateFixed,
  MapPin,
  MessageCircle,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Trophy,
  X,
} from 'lucide-react';
import { Language, type Place } from '../types';
import type { SceneEngine, SceneLayerContext, ScenePoi, Tour } from '../types/scene3d';
import { TRANSLATIONS } from '../data/i18n';
import { SEASONAL_TOURS_3D, TOURS_3D, ZACATECAS_3D_HOME, loadTours } from '../data/tours3d';
import { activeSeason, type Season } from '../data/seasons';
import { SeasonOverlay } from '../scene3d/SeasonOverlay';
import {
  BANDERA_A_CUADROS,
  BANDERAZO,
  DESFILE_ROUTE,
  PANAMERICANA_SOURCE_URL,
  PANAMERICANA_TEXT,
  PREMIACION,
  awardSeasonBadge,
  readSeasonBadges,
} from '../data/panamericana';
import { ZACATECAS_PLACES } from '../data/places';
import { SCENE_LAYERS } from '../scene3d/layers';
import { createEngine, selectedEngineId, type EngineId } from '../scene3d/createEngine';
import { guardEngine } from '../scene3d/guardEngine';
import { SceneStats, isStatsEnabled } from '../scene3d/SceneStats';
import { distanceMeters } from '../scene3d/geo';
import { usePlayerPosition, type FallbackReason } from '../scene3d/usePlayerPosition';
import { useCollection } from '../scene3d/useCollection';
import { useAvatarControls, type AvatarAction } from '../scene3d/useAvatarControls';
import { loadPlacePhotos, type PlacePhoto } from '../scene3d/placePhotos';
import { MapAssistantSheet } from './app/MapAssistantSheet';
import { recordLegendaryFind, recordPlaceVisit } from '../pet/visits';
import { resolveMapsApiKey } from '../data/mapsApiKey';


/** Recorridos que tocan hoy: los de temporada solo en su temporada, y primero. */
function toursForSeason(all: Tour[], season: Season | null): Tour[] {
  const seasonal = all.filter((x) => x.season && x.season === season?.id);
  return [...seasonal, ...all.filter((x) => !x.season)];
}

const todayKey = () => new Date().toISOString().slice(0, 10);
const METEOR_STORAGE_KEY = 'zacatecas_meteorito';

function meteorFoundToday(): boolean {
  try {
    return localStorage.getItem(METEOR_STORAGE_KEY) === todayKey();
  } catch {
    return false;
  }
}

/** Avisa a la mascota (#65) que se encontró el meteorito en esa parada. */
function recordLegendary(placeId: string, seasonId: string): void {
  try {
    localStorage.setItem(METEOR_STORAGE_KEY, todayKey());
  } catch {
    // Sin almacenamiento: vale solo en esta visita.
  }
  recordLegendaryFind(placeId);
}

type Status = 'loading' | 'ready' | 'error';

const FLIGHT_MILLIS = 4500;
const DISCOVER_RADIUS_M = 40;
const NEAREST_HINT_M = 200;
const AVATARS = ['minero', 'danzante', 'visitante'] as const;
type AvatarId = (typeof AVATARS)[number];
const AVATAR_STORAGE_KEY = 'zacatecas_avatar';

function readAvatar(): AvatarId {
  try {
    const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
    return AVATARS.find((a) => a === stored) ?? 'minero';
  } catch {
    return 'minero';
  }
}
const UNDISCOVERED_COLOR = '#A8A29E';
const DEFAULT_LAYERS = new Set(SCENE_LAYERS.filter((l) => l.enabledByDefault).map((l) => l.id));
const TOGGLEABLE_LAYERS = SCENE_LAYERS.filter((l) => l.toggleable);
// PROTO: altitud fija del centro para la cámara que sigue al jugador; el terreno varía ±100 m.
const FOLLOW_ALTITUDE = 2450;
const SIMULATED_PATH = (TOURS_3D[0]?.stops ?? []).map((s) => ({ lat: s.camera.lat, lng: s.camera.lng }));


function placeName(placeId: string | undefined, language: Language): string {
  const place = ZACATECAS_PLACES.find((p) => p.id === placeId);
  return place ? (language === 'es' ? place.nameEs : place.name) : '';
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type GoogleAuthWindow = Window & { gm_authFailure?: () => void };

/** Vista 3D de la ciudad (nivel mock). Se abre en /#3d. */
export const Map3DView: React.FC = () => (
  <Map3DErrorBoundary>
    <Map3DScene />
  </Map3DErrorBoundary>
);

const Map3DScene: React.FC = () => {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem('zacatecas_lang') as Language) || 'es',
  );
  const [status, setStatus] = useState<Status>('loading');
  const [errorDetail, setErrorDetail] = useState('');
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(DEFAULT_LAYERS);
  const [layerPois, setLayerPois] = useState<Record<string, ScenePoi[]>>({});
  const [selected, setSelected] = useState<ScenePoi | null>(null);
  // Parada en curso del recorrido: alimenta la hoja con subtítulo y progreso.
  const [tourStep, setTourStep] = useState<{ tour: Tour; index: number } | null>(null);
  const [isTouring, setIsTouring] = useState(false);
  // Temporada o fiesta de hoy (#68); fechas provisionales hasta confirmarlas.
  const season = useMemo(() => activeSeason(new Date()), []);
  const [tours, setTours] = useState<Tour[]>(() => toursForSeason([...TOURS_3D, ...SEASONAL_TOURS_3D], season));
  const [meteorFound, setMeteorFound] = useState(meteorFoundToday);
  const [meteorCard, setMeteorCard] = useState(false);
  // Misión de la Carrera Panamericana (#87): llegar al banderazo da la insignia y un meteorito.
  const [raceBadgeCard, setRaceBadgeCard] = useState(false);
  const [raceMissionDone, setRaceMissionDone] = useState(() =>
    readSeasonBadges().some((b) => b.id === BANDERA_A_CUADROS.id),
  );
  const [tourId, setTourId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [askPlace, setAskPlace] = useState<Place | null>(null);
  const [nearby, setNearby] = useState<ScenePoi | null>(null);
  // Puestos ya anunciados en esta visita: el aviso sale una sola vez por puesto.
  const announcedRef = useRef(new Set<string>());
  const [isExploring, setIsExploring] = useState(false);
  const [avatar, setAvatar] = useState<AvatarId>(readAvatar);
  const [toast, setToast] = useState<string | null>(null);
  const [timings, setTimings] = useState<{ mountMs: number | null; readyMs: number | null }>({
    mountMs: null,
    readyMs: null,
  });
  const apiKey = useMemo(resolveMapsApiKey, []);
  // Si Google rechaza la llave o no hay 3D Tiles, se cae a la ciudad estilizada en vez de quedar en error.
  const [engineFallback, setEngineFallback] = useState<EngineId | null>(null);
  const [keyErrorCode, setKeyErrorCode] = useState<string | null>(null);
  const [engineFailure, setEngineFailure] = useState<string | null>(null);
  const engineId = useMemo(
    () => engineFallback ?? selectedEngineId(Boolean(apiKey)),
    [apiKey, engineFallback],
  );
  const showStats = useMemo(isStatsEnabled, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const tourRunRef = useRef(0);

  const t = TRANSLATIONS[language];

  const { position, fallbackReason, isManual, teleport, resume } = usePlayerPosition({
    enabled: isExploring,
    simulatedPath: SIMULATED_PATH,
    playArea: ZACATECAS_3D_HOME,
  });
  const { collection, discover, reset } = useCollection();
  const act = useAvatarControls(isExploring, position, teleport);
  const teleportRef = useRef<typeof teleport | null>(null);
  teleportRef.current = isExploring ? teleport : null;

  const pois = useMemo(
    () => SCENE_LAYERS.filter((l) => enabledLayers.has(l.id)).flatMap((l) => layerPois[l.id] ?? []),
    [enabledLayers, layerPois],
  );
  // Meteorito legendario (#74): en fechas especiales cae en una parada del primer recorrido, distinta cada día.
  const meteor = useMemo<ScenePoi | null>(() => {
    // En la carrera el meteorito lo da la misión del banderazo, no una parada.
    if (!season?.legendaryDrops || season.race || meteorFound) return null;
    const stops = tours[0]?.stops ?? [];
    if (!stops.length) return null;
    const day = Math.floor(Date.now() / 86_400_000);
    const stop = stops[day % stops.length];
    const place = ZACATECAS_PLACES.find((p) => p.id === stop.placeId);
    return {
      id: 'meteorito',
      kind: 'challenge',
      title: { es: TRANSLATIONS.es.view3dMeteorTitle, en: TRANSLATIONS.en.view3dMeteorTitle },
      summary: { es: TRANSLATIONS.es.view3dMeteorSummary, en: TRANSLATIONS.en.view3dMeteorSummary },
      subtitle: season.name,
      lat: (place?.lat ?? stop.camera.lat) + 0.00015,
      lng: (place?.lng ?? stop.camera.lng) + 0.00015,
      placeId: stop.placeId,
      color: '#4C1D95',
      icon: '☄️',
      isMock: true,
    };
  }, [season, meteorFound, tours]);
  const racePois = useMemo<ScenePoi[]>(() => {
    if (!season?.race) return [];
    const text = (k: 'view3dBanderazo' | 'view3dPremiacion') => ({ es: TRANSLATIONS.es[k], en: TRANSLATIONS.en[k] });
    return [
      {
        id: 'panamericana-banderazo',
        kind: 'challenge',
        title: text('view3dBanderazo'),
        subtitle: season.name,
        summary: PANAMERICANA_TEXT.mission,
        note: PANAMERICANA_TEXT.route,
        ...BANDERAZO,
        color: '#DC2626',
        icon: '🏁',
        isMock: true,
      },
      {
        id: 'panamericana-premiacion',
        kind: 'challenge',
        title: text('view3dPremiacion'),
        subtitle: season.name,
        summary: PANAMERICANA_TEXT.premiacion,
        ...PREMIACION,
        color: '#DC2626',
        icon: '🏆',
      },
    ];
  }, [season]);
  const scenePois = useMemo(
    () => [...pois, ...racePois, ...(meteor ? [meteor] : [])],
    [pois, racePois, meteor],
  );
  const placePois = useMemo(() => pois.filter((p) => p.kind === 'place' && p.placeId), [pois]);
  const discoveredCount = placePois.filter((p) => p.placeId && collection[p.placeId]).length;
  const collectedCount = Object.keys(collection).length;
  const hasPlayer = isExploring && position !== null;

  // Lo que reciben las capas al cargar; en refs para no recargar en cada paso del jugador.
  const layerContextRef = useRef<SceneLayerContext>({});
  layerContextRef.current = {
    player: hasPlayer && position ? { lat: position.lat, lng: position.lng } : undefined,
    visitedPlaceIds: Object.keys(collection),
  };
  const loadedLayersRef = useRef(new Map<string, string>());

  useEffect(() => {
    localStorage.setItem('zacatecas_lang', language);
    document.documentElement.lang = language;
  }, [language]);

  // Recorridos desde la API Python; si no responde, se quedan los de src/data/tours3d.ts.
  useEffect(() => {
    void loadTours().then((all) => setTours(toursForSeason(all, season)));
  }, [season]);

  // Montar el motor una sola vez.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const engine = guardEngine(createEngine(engineId, apiKey), (err, method) => {
      console.error(`[Map3DView] ${engineId}.${method} falló`, err);
      if (cancelled) return;
      if (engineId === 'three') {
        setErrorDetail(err instanceof Error ? err.message : String(err));
        setStatus('error');
        return;
      }
      setEngineFailure(`${method}: ${err instanceof Error ? err.message : String(err)}`);
      setEngineFallback('three');
    });
    engineRef.current = engine;
    setStatus('loading');
    // Google avisa así de una llave inválida o de un dominio no autorizado (pinta "Oops! Something went wrong").
    const authWindow = window as GoogleAuthWindow;
    const previousAuthFailure = authWindow.gm_authFailure;
    // PROTO: Map3DElement no llama gm_authFailure ni emite evento; el único aviso es el console.error de Google.
    const originalConsoleError = console.error;
    if (engineId !== 'three') {
      authWindow.gm_authFailure = () => {
        previousAuthFailure?.();
        if (!cancelled) setEngineFallback('three');
      };
      console.error = (...args: unknown[]) => {
        originalConsoleError(...args);
        const code = /Google Maps JavaScript API error: (\w+)/.exec(String(args[0]))?.[1];
        if (code && !cancelled) {
          setKeyErrorCode(code);
          setEngineFallback('three');
        }
      };
    }
    const startedAt = performance.now();

    engine
      .mount(container, ZACATECAS_3D_HOME)
      .then(() => {
        if (cancelled) return;
        setTimings((prev) => ({ ...prev, mountMs: performance.now() - startedAt }));
        void engine.ready().then(() => {
          if (!cancelled) setTimings((prev) => ({ ...prev, readyMs: performance.now() - startedAt }));
        });
        engine.onPoiClick(setSelected);
        engine.onGroundClick((at) => teleportRef.current?.(at));
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[Map3DView] el motor no cargó', engineId, err);
        if (engineId !== 'three') {
          setEngineFallback('three');
          return;
        }
        setErrorDetail(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      if (engineId !== 'three') {
        authWindow.gm_authFailure = previousAuthFailure;
        console.error = originalConsoleError;
      }
      tourRunRef.current++;
      engine.destroy();
      engineRef.current = null;
    };
  }, [engineId, apiKey]);

  useEffect(() => {
    if (status !== 'ready') return;
    engineRef.current?.setAvatar(`/models/avatars/${avatar}.glb`);
    try {
      localStorage.setItem(AVATAR_STORAGE_KEY, avatar);
    } catch {
      // Sin almacenamiento: el avatar vale solo en esta visita.
    }
  }, [avatar, status]);

  // Cargar las capas encendidas; las de recomendaciones se recargan al descubrir un lugar.
  useEffect(() => {
    if (status !== 'ready') return;
    const loaded = loadedLayersRef.current;
    for (const id of loaded.keys()) if (!enabledLayers.has(id)) loaded.delete(id);
    for (const layer of SCENE_LAYERS) {
      if (!enabledLayers.has(layer.id)) continue;
      // Con jugador en escena cambia el origen de las recomendaciones.
      const key = layer.reloadOnDiscover ? `${hasPlayer}:${collectedCount}` : '';
      if (loaded.get(layer.id) === key) continue;
      loaded.set(layer.id, key);
      void layer.load(layerContextRef.current).then((points) => {
        // Descarta respuestas viejas (capa apagada o recargada mientras tanto).
        if (loadedLayersRef.current.get(layer.id) !== key) return;
        setLayerPois((prev) => ({ ...prev, [layer.id]: points }));
      });
    }
  }, [status, enabledLayers, collectedCount, hasPlayer]);

  const toggleLayer = (id: string) =>
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // Fotos del lugar seleccionado (#23); las de la temporada activa primero (#75).
  const selectedPlaceId = selected?.placeId;
  const seasonId = season?.id;
  useEffect(() => {
    setPhotos([]);
    setPhotoIndex(0);
    if (!selectedPlaceId) return;
    let cancelled = false;
    void loadPlacePhotos(selectedPlaceId, seasonId).then((list) => {
      if (!cancelled) setPhotos(list);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPlaceId, seasonId]);

  // Repintar marcadores al cambiar puntos, idioma o colección (en exploración, lo no descubierto va en gris).
  useEffect(() => {
    if (status !== 'ready') return;
    const shown = isExploring
      ? scenePois.map((p) =>
          p.kind === 'place' && p.placeId && !collection[p.placeId] ? { ...p, color: UNDISCOVERED_COLOR } : p,
        )
      : scenePois;
    engineRef.current?.setPois(shown, language);
  }, [scenePois, language, status, isExploring, collection]);

  // Noche, pétalos y demás de la temporada. Google y Cesium no tienen noche propia: velo en SeasonOverlay.
  useEffect(() => {
    if (status !== 'ready') return;
    engineRef.current?.setSeason?.(
      season ? { night: season.night, petals: season.petals, raceRoute: season.race ? DESFILE_ROUTE : undefined } : null,
    );
  }, [season, status, engineId]);

  // PROTO: hasta que llegue el interruptor Día / Noche (#128), ?noche=1 enciende la noche del centro (#129).
  useEffect(() => {
    if (status !== 'ready') return;
    engineRef.current?.setTimeOfDay?.(new URLSearchParams(window.location.search).has('noche') ? 'night' : 'day');
  }, [status, engineId]);

  // Jugador: moverlo, seguirlo con la cámara y descubrir lugares cercanos.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || status !== 'ready') return;
    engine.setPlayer(position);
    if (!position) return;
    engine.jumpTo({
      lat: position.lat,
      lng: position.lng,
      altitude: FOLLOW_ALTITUDE,
      range: 260,
      tilt: 62,
      heading: position.heading,
    });
    const found = placePois.find(
      (p) => p.placeId && !collection[p.placeId] && distanceMeters(position, p) <= DISCOVER_RADIUS_M,
    );
    if (found?.placeId) {
      discover(found.placeId);
      setToast(t.view3dDiscovered.replace('{name}', found.title[language]));
    }
    // Regresar a un lugar ya descubierto también cuenta para los paseos de la mascota
    // (recordPlaceVisit no repite el mismo lugar en 30 min).
    const revisited = placePois.find(
      (p) => p.placeId && collection[p.placeId] && distanceMeters(position, p) <= DISCOVER_RADIUS_M,
    );
    if (revisited?.placeId) recordPlaceVisit(revisited.placeId);
    const heard = pois.find(
      (p) => p.nearbyNotice && !announcedRef.current.has(p.id) && distanceMeters(position, p) <= DISCOVER_RADIUS_M,
    );
    if (heard) {
      announcedRef.current.add(heard.id);
      setNearby(heard);
    }
    if (meteor?.placeId && season && distanceMeters(position, meteor) <= DISCOVER_RADIUS_M) {
      recordLegendary(meteor.placeId, season.id);
      setMeteorFound(true);
      setMeteorCard(true);
    }
    if (season?.race && !raceMissionDone && distanceMeters(position, BANDERAZO) <= DISCOVER_RADIUS_M) {
      setRaceMissionDone(true);
      if (awardSeasonBadge(BANDERA_A_CUADROS)) {
        recordLegendary('catedral-zacatecas', season.id);
        setRaceBadgeCard(true);
      }
    }
  }, [position, status, placePois, pois, collection, discover, t, language, meteor, season, raceMissionDone]);

  useEffect(() => {
    if (!nearby) return;
    const id = setTimeout(() => setNearby(null), 8000);
    return () => clearTimeout(id);
  }, [nearby]);

  useEffect(() => {
    if (!isExploring) setNearby(null);
  }, [isExploring]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const stopTour = useCallback(() => {
    tourRunRef.current++;
    engineRef.current?.stop();
    engineRef.current?.setRoute(null);
    setIsTouring(false);
    setTourStep(null);
  }, []);

  const playTour = useCallback(
    async (tour: Tour) => {
      const engine = engineRef.current;
      if (!engine) return;
      const run = ++tourRunRef.current;
      const isCurrent = () => tourRunRef.current === run;
      setSelected(null);
      setAskPlace(null);
      setIsTouring(true);
      engine.setRoute(tour.stops.map((s) => ({ lat: s.camera.lat, lng: s.camera.lng })));

      for (const [index, stop] of tour.stops.entries()) {
        setTourStep({ tour, index });
        await engine.flyTo(stop.camera, FLIGHT_MILLIS);
        if (!isCurrent()) return;
        await wait(stop.holdMillis);
        if (!isCurrent()) return;
      }
      const last = tour.stops[tour.stops.length - 1];
      if (last) await engine.orbit(last.camera, 8000);
      if (!isCurrent()) return;
      await engine.flyTo(ZACATECAS_3D_HOME, FLIGHT_MILLIS);
      if (!isCurrent()) return;
      engine.setRoute(null);
      setTourStep(null);
      setIsTouring(false);
    },
    [],
  );

  const toggleExplore = () => {
    stopTour();
    setSelected(null);
    setAskPlace(null);
    setIsExploring((v) => !v);
  };

  const fallbackText: Record<FallbackReason, string> = {
    denied: t.view3dFallbackDenied,
    far: t.view3dFallbackFar,
    unavailable: t.view3dFallbackUnavailable,
    forced: t.view3dFallbackForced,
  };
  const sourceText = position
    ? { gps: t.view3dSourceGps, simulated: t.view3dSourceSimulated, manual: t.view3dSourceManual }[position.source]
    : null;

  const goHome = () => {
    setIsExploring(false);
    stopTour();
    void engineRef.current?.flyTo(ZACATECAS_3D_HOME, 2500);
  };

  const selectedPlace = selected?.placeId
    ? ZACATECAS_PLACES.find((p) => p.id === selected.placeId)
    : undefined;
  const tour = tours.find((x) => x.id === tourId) ?? tours[0];
  // Pista de juego: el lugar sin descubrir más cercano, si está a menos de NEAREST_HINT_M.
  const nearestPlace = useMemo(() => {
    if (!isExploring || !position) return null;
    let best: { poi: ScenePoi; meters: number } | null = null;
    for (const poi of placePois) {
      if (!poi.placeId || collection[poi.placeId]) continue;
      const meters = distanceMeters(position, poi);
      if (meters <= NEAREST_HINT_M && (!best || meters < best.meters)) best = { poi, meters };
    }
    return best;
  }, [isExploring, position, placePois, collection]);
  const photo = photos[photoIndex];
  const stepPhoto = (delta: number) =>
    setPhotoIndex((i) => (i + delta + photos.length) % photos.length);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-stone-900 text-stone-900">
      {/* isolate: las etiquetas CSS2D de three.js traen z-index propio y no deben tapar la UI. */}
      <div ref={containerRef} className="absolute inset-0 isolate" />
      {season && status === 'ready' && <SeasonOverlay season={season} tintNight={engineId !== 'three'} />}

      {/* Chip de la temporada (#68): siempre con "fechas por confirmar" hasta tener el calendario oficial. */}
      {season && status === 'ready' && !isExploring && (
        <div className="absolute top-[7.5rem] md:top-28 inset-x-0 z-10 flex justify-center px-3 pointer-events-none">
          <p
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold text-white rounded-full shadow-lg whitespace-nowrap"
            style={{ background: season.accent }}
          >
            {season.name[language]} · {season.dateLabel[language]}
            {season.provisional && <span className="font-semibold opacity-85">({t.view3dSeasonUnconfirmed})</span>}
          </p>
        </div>
      )}

      {/* Misión de hoy en la Carrera Panamericana (#87) */}
      {season?.race && status === 'ready' && !raceMissionDone && !selected && !(isExploring && nearby) && (
        <div
          className={`absolute ${isExploring ? 'bottom-52 md:bottom-24' : 'top-[10rem] md:top-40'} inset-x-3 md:inset-x-auto md:left-4 md:w-80 z-10 bg-[#FBF9F5] border-l-4 border-[#DC2626] rounded-xl shadow-lg p-3`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">🏁 {t.view3dMissionToday}</p>
            <span className="px-1 py-px text-[9px] font-bold uppercase text-white bg-[#D97706] rounded">{t.view3dDemoBadge}</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-stone-700">{PANAMERICANA_TEXT.mission[language]}</p>
          <a href={PANAMERICANA_SOURCE_URL} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-stone-500 underline">
            {t.view3dSource}: Gobierno de Zacatecas
          </a>
        </div>
      )}

      {/* Barra superior */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between gap-2 p-3 md:p-4 pointer-events-none">
        <a
          href="#"
          className="pointer-events-auto flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-[#FBF9F5]/95 border border-stone-200 rounded-lg shadow-sm hover:bg-white"
        >
          <ArrowLeft className="w-4 h-4 text-[#9A3412]" />
          <span className="hidden sm:inline">{t.view3dBack}</span>
        </a>
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-[#FBF9F5]/95 border border-stone-200 rounded-lg shadow-sm">
          <span className="font-serif font-bold text-sm md:text-base">{t.view3d}</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-[#D97706] rounded">
            {t.view3dDemoBadge}
          </span>
        </div>
        <button
          onClick={() => setLanguage((l) => (l === 'es' ? 'en' : 'es'))}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#FBF9F5]/95 border border-stone-200 rounded-lg shadow-sm hover:bg-white cursor-pointer"
          aria-label={t.toggleLanguage}
        >
          <Globe className="w-3.5 h-3.5 text-stone-500" />
          <span className="uppercase">{language}</span>
        </button>
      </div>

      {/* Estados sin mapa */}
      {status !== 'ready' && (
        <div className="absolute inset-0 z-0 flex items-center justify-center p-6">
          <div className="max-w-sm text-center bg-[#FBF9F5] rounded-xl p-6 shadow-lg">
            {status === 'loading' && <p className="text-sm text-stone-600">{t.view3dLoading}</p>}
            {status === 'error' && (
              <>
                <h2 className="font-serif font-bold text-lg mb-2">{t.view3dErrorTitle}</h2>
                <p className="text-xs text-stone-500 font-mono break-words">{errorDetail}</p>
              </>
            )}
          </div>
        </div>
      )}

      {engineId === 'three' && status === 'ready' && !isExploring && (
        <div className="absolute top-16 inset-x-3 md:inset-x-auto md:left-4 md:max-w-xs z-10 text-[11px] text-stone-700 bg-[#FBF9F5]/90 border border-stone-200 rounded-lg px-3 py-2">
          {engineFallback ? (
            <>
              {/* Si Google avisó un error de la llave o del proyecto, esa es la causa: después de ese aviso
                  la librería ya no crea marcadores y setPois falla con "reading 'keys'" (probado con 3.66). */}
              {keyErrorCode || !engineFailure ? t.view3dKeyRejected : t.view3dEngineFailed}
              {(keyErrorCode || engineFailure) && (
                <span className="block mt-1 font-mono text-stone-500 break-words">
                  {[keyErrorCode, engineFailure].filter(Boolean).join(' · ')}
                </span>
              )}
            </>
          ) : apiKey ? (
            t.view3dStylized
          ) : (
            t.view3dNoKeyBody
          )}
        </div>
      )}

      {showStats && <SceneStats engine={engineId} mountMs={timings.mountMs} readyMs={timings.readyMs} />}

      {/* HUD de exploración */}
      {isExploring && (
        <div className="absolute top-16 inset-x-3 md:inset-x-auto md:left-4 md:w-72 z-10 bg-[#FBF9F5]/95 border border-stone-200 rounded-xl shadow-sm p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-stone-800">
              <Trophy className="w-4 h-4 text-[#D97706]" />
              {t.view3dCollection}: {discoveredCount}/{placePois.length}
            </span>
            <button
              onClick={reset}
              className="p-1 text-stone-500 hover:text-stone-900 cursor-pointer"
              title={t.view3dResetCollection}
              aria-label={t.view3dResetCollection}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <div
              className="h-full bg-[#9A3412] transition-all"
              style={{ width: `${placePois.length ? (discoveredCount / placePois.length) * 100 : 0}%` }}
            />
          </div>
          {nearestPlace && (
            <p className="mt-2 flex items-center gap-1.5 font-semibold text-[#B45309]">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {t.view3dNearestPlace
                .replace('{name}', nearestPlace.poi.title[language])
                .replace('{m}', String(Math.round(nearestPlace.meters)))}
            </p>
          )}
          <p className="mt-2 text-stone-600">
            {position?.source === 'gps' && position.accuracy !== null && (
              <span className="mr-1.5 inline-flex items-center gap-1 px-1.5 py-px text-[10px] font-bold text-green-700 bg-green-100 rounded-full">
                GPS ±{Math.round(position.accuracy)} m
              </span>
            )}
            {sourceText && <span className="font-semibold text-stone-800">{sourceText}. </span>}
            {fallbackReason && !isManual && fallbackText[fallbackReason]} {t.view3dTapToMove}
          </p>
          <div className="mt-2 flex items-center gap-1.5" role="radiogroup" aria-label={t.view3dAvatar}>
            <span className="text-stone-500">{t.view3dAvatar}:</span>
            {AVATARS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={avatar === id}
                onClick={() => setAvatar(id)}
                className={`px-2 py-0.5 rounded-full border cursor-pointer ${
                  avatar === id
                    ? 'bg-[#9A3412] border-[#9A3412] text-white'
                    : 'bg-white border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {t[`view3dAvatar_${id}`]}
              </button>
            ))}
          </div>
          {TOGGLEABLE_LAYERS.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-stone-500">
                <Layers className="w-3.5 h-3.5" />
                {t.view3dLayers}:
              </span>
              {TOGGLEABLE_LAYERS.map((layer) => (
                <button
                  key={layer.id}
                  role="switch"
                  aria-checked={enabledLayers.has(layer.id)}
                  onClick={() => toggleLayer(layer.id)}
                  className={`px-2 py-0.5 rounded-full border cursor-pointer ${
                    enabledLayers.has(layer.id)
                      ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                      : 'bg-white border-stone-300 text-stone-700 hover:border-stone-400'
                  }`}
                >
                  {layer.label[language]}
                </button>
              ))}
            </div>
          )}
          {isManual && (
            <button
              onClick={resume}
              className="mt-2 flex items-center gap-1.5 font-semibold text-[#9A3412] hover:underline cursor-pointer"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {t.view3dResume}
            </button>
          )}
        </div>
      )}

      {/* Aviso al acercarse a un puesto de la vida de calle (#51) */}
      {nearby?.nearbyNotice && isExploring && !selected && (
        <div className="absolute inset-x-3 bottom-52 md:inset-x-auto md:left-4 md:bottom-24 md:w-80 z-10 flex items-center gap-3 bg-[#FBF9F5] border-2 border-[#E4007C] rounded-xl shadow-lg p-3">
          <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[#FCE7F3] text-xl motion-safe:animate-pulse">
            {nearby.icon ?? '📍'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-stone-900">
              {t.view3dNearby.replace('{name}', nearby.title[language])}
              {nearby.isMock && (
                <span className="ml-1.5 align-middle px-1 py-px text-[9px] font-bold uppercase text-white bg-[#D97706] rounded">
                  {t.view3dDemoBadge}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] italic leading-snug text-stone-600 line-clamp-2">
              «{nearby.nearbyNotice[language]}»
            </p>
          </div>
          <button
            onClick={() => {
              setSelected(nearby);
              setNearby(null);
            }}
            className="shrink-0 px-2.5 py-1.5 text-xs font-bold text-white bg-[#E4007C] rounded-lg cursor-pointer hover:bg-[#BE0068]"
          >
            {t.view3dNearbyOpen}
          </button>
        </div>
      )}

      {/* Hallazgo del meteorito legendario (#74) */}
      {meteorCard && season && (
        <div className="absolute inset-x-3 bottom-52 md:inset-x-auto md:left-4 md:bottom-24 md:w-80 z-20 bg-[#FBF9F5] border-2 border-[#4C1D95] rounded-xl shadow-lg p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4C1D95]">{t.view3dMeteorKicker} · {season.name[language]}</p>
            <span className="px-1 py-px text-[9px] font-bold uppercase text-white bg-[#D97706] rounded">{t.view3dDemoBadge}</span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm font-bold text-stone-900">
            <span className="text-xl motion-safe:animate-bounce" aria-hidden="true">☄️</span>
            {t.view3dMeteorFound}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-stone-600">{t.view3dMeteorFoundBody}</p>
          <button
            onClick={() => setMeteorCard(false)}
            className="mt-2 w-full px-2.5 py-1.5 text-xs font-bold text-white bg-[#4C1D95] rounded-lg cursor-pointer hover:bg-[#3B1673]"
          >
            {t.view3dClose}
          </button>
        </div>
      )}

      {/* Insignia de tiempo limitado al llegar al banderazo (#87) */}
      {raceBadgeCard && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-stone-900/50 p-6">
          <div className="w-full max-w-xs bg-[#FBF9F5] rounded-2xl shadow-xl p-5 text-center">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">{t.view3dNewBadge}</p>
              <span className="px-1 py-px text-[9px] font-bold uppercase text-white bg-[#D97706] rounded">{t.view3dDemoBadge}</span>
            </div>
            <span
              className="mx-auto mt-4 block w-24 h-24 rounded-full -rotate-6 shadow-[0_0_0_5px_#DC2626,0_0_0_9px_#FECACA]"
              style={{ background: 'repeating-conic-gradient(#1C1917 0 25%, #fff 0 50%) 0 0 / 24px 24px' }}
              aria-hidden="true"
            />
            <p className="mt-4 text-lg font-extrabold text-stone-900">{BANDERA_A_CUADROS.title[language]}</p>
            <p className="mt-1 text-xs text-stone-600">{BANDERA_A_CUADROS.detail[language]}</p>
            <div className="mt-3 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] p-2 text-xs">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#7C3AED]">{t.view3dSeasonResource}</p>
              <p className="font-bold text-stone-900">☄️ {t.view3dMeteorLegendary}</p>
            </div>
            <button
              onClick={() => setRaceBadgeCard(false)}
              className="mt-4 w-full px-3 py-2 text-sm font-bold text-white bg-[#DC2626] rounded-full cursor-pointer hover:bg-[#B91C1C]"
            >
              {t.view3dClose}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute inset-x-0 top-1/3 z-20 flex justify-center px-4 pointer-events-none">
          <p className="animate-bounce text-center text-sm md:text-base font-bold text-white bg-[#9A3412] rounded-full shadow-lg px-5 py-3">
            {toast}
          </p>
        </div>
      )}

      {/* Tarjeta del lugar */}
      {selected && !isTouring && (
        <div className={`absolute inset-x-3 ${isExploring ? 'bottom-56 md:bottom-24 md:right-48' : 'bottom-20 md:right-4'} md:inset-x-auto md:w-80 z-10 max-h-[62dvh] overflow-y-auto bg-[#FBF9F5] rounded-2xl shadow-lg border border-stone-200 p-4 ${selected.kind === 'vendor' ? 'border-t-4 border-t-[#E4007C]' : ''}`}>
          {photo && (
            <figure className="-mx-4 -mt-4 mb-3">
              <div className="relative aspect-video overflow-hidden rounded-t-xl bg-stone-200">
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.caption[language]}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                  }}
                  className="h-full w-full object-cover"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => stepPhoto(-1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-stone-900/60 text-white hover:bg-stone-900/80 cursor-pointer"
                      aria-label={t.view3dPhotoPrev}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => stepPhoto(1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-stone-900/60 text-white hover:bg-stone-900/80 cursor-pointer"
                      aria-label={t.view3dPhotoNext}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 inset-x-0 flex justify-center gap-1" aria-hidden="true">
                      {photos.map((p, i) => (
                        <i key={p.id} className={`w-1.5 h-1.5 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/55'}`} />
                      ))}
                    </span>
                  </>
                )}
              </div>
              <figcaption className="px-4 pt-1.5 text-[10px] leading-snug text-stone-500">
                {photo.caption[language]} ·{' '}
                <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-stone-800">
                  {t.view3dPhotoBy.replace('{author}', photo.author).replace('{license}', photo.license)}
                </a>
                , Wikimedia Commons
              </figcaption>
            </figure>
          )}
          {(selected.subtitle || selected.kind === 'recommendation') && (
            <p className={`text-[10px] font-bold uppercase tracking-wider ${selected.kind === 'vendor' ? 'text-[#E4007C]' : 'text-[#7C3AED]'}`}>
              {selected.subtitle?.[language] ?? t.view3dRecommended}
            </p>
          )}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif font-bold text-base leading-snug text-stone-900">
              {selected.icon && <span className="mr-1">{selected.icon}</span>}
              {selected.title[language]}
              {selected.isMock && (
                <span className="ml-2 align-middle px-1.5 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider text-white bg-[#D97706] rounded">
                  {t.view3dDemoBadge}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {selected.placeId && collection[selected.placeId] && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-green-700 bg-green-100 rounded-full whitespace-nowrap">
                  <Check className="w-3 h-3" />
                  {t.view3dFound}
                </span>
              )}
              <button
                onClick={() => setSelected(null)}
                className="p-1 text-stone-500 hover:text-stone-900 cursor-pointer"
                aria-label={t.view3dClose}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {selected.summary &&
            (selected.kind === 'vendor' ? (
              <blockquote className="mt-2 pl-2 border-l-[3px] border-pink-200 font-serif italic font-semibold text-xs leading-relaxed text-stone-700">
                {selected.summary[language]}
              </blockquote>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-stone-700">{selected.summary[language]}</p>
            ))}
          {selected.note && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-500">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {selected.note[language]}
            </p>
          )}
          {selectedPlace && (
            <>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-500">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {selectedPlace.schedule}
              </p>
              <button
                onClick={() => {
                  setAskPlace(selectedPlace);
                  setSelected(null);
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-[#9A3412] rounded-full hover:bg-[#78350F] cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                {t.view3dAsk}
              </button>
            </>
          )}
        </div>
      )}

      {/* Asistente dentro del mapa (#43), acotado al lugar elegido */}
      {askPlace && (
        <MapAssistantSheet language={language} place={askPlace} onClose={() => setAskPlace(null)} />
      )}

      {/* Pad táctil del avatar (también WASD / flechas) */}
      {isExploring && status === 'ready' && (
        <div className="absolute right-3 bottom-24 z-10 grid grid-cols-3 gap-1.5 select-none">
          {(
            [
              ['forward', ArrowUp, 'col-start-2'],
              ['left', RotateCcw, 'col-start-1 row-start-2'],
              ['back', ArrowDown, 'col-start-2 row-start-2'],
              ['right', RotateCw, 'col-start-3 row-start-2'],
            ] as Array<[AvatarAction, typeof ArrowUp, string]>
          ).map(([action, Icon, place]) => (
            <PadButton key={action} className={place} onAct={() => act(action)} label={action}>
              <Icon className="w-5 h-5" />
            </PadButton>
          ))}
        </div>
      )}

      {/* Hoja del recorrido: elegir uno (#34) o seguir la parada en curso */}
      {status === 'ready' && !isExploring && !selected && !askPlace && (isTouring ? tourStep : tours.length > 1) && (
        <div className="absolute inset-x-3 bottom-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[28rem] z-10 bg-[#FBF9F5] rounded-2xl shadow-lg border border-stone-200 p-3">
          {tourStep ? (
            <>
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[#9A3412]">
                <span>
                  {tourStep.tour.title[language]} · {t.view3dStopOf.replace('{i}', String(tourStep.index + 1)).replace('{n}', String(tourStep.tour.stops.length))}
                </span>
                <span className="truncate">{placeName(tourStep.tour.stops[tourStep.index]?.placeId, language)}</span>
              </div>
              <p className="mt-1.5 text-xs md:text-sm leading-relaxed text-stone-700">
                {tourStep.tour.stops[tourStep.index]?.caption[language]}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className="h-full bg-[#9A3412] transition-all duration-700"
                  style={{ width: `${((tourStep.index + 1) / tourStep.tour.stops.length) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex gap-2 overflow-x-auto" role="radiogroup" aria-label={t.view3dTourPick}>
              {tours.map((x) => (
                <button
                  key={x.id}
                  role="radio"
                  aria-checked={x.id === tour?.id}
                  onClick={() => setTourId(x.id)}
                  className={`flex-1 min-w-[7.5rem] text-left px-2.5 py-1.5 rounded-xl border cursor-pointer ${
                    x.id === tour?.id ? 'border-[#9A3412] bg-[#FFF4EC]' : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <span className="block text-xs font-bold leading-tight text-stone-900">{x.title[language]}</span>
                  {x.season && (
                    <span className="mt-0.5 inline-block px-1 py-px text-[9px] font-bold uppercase text-white bg-[#D97706] rounded">
                      {t.view3dSeasonalTour} · {t.view3dDemoBadge}
                    </span>
                  )}
                  <span className="block text-[10px] text-stone-500">
                    {t.view3dStopsCount.replace('{n}', String(x.stops.length))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controles */}
      {status === 'ready' && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center gap-2 p-4">
          {isTouring ? (
            <button
              onClick={stopTour}
              className="flex items-center gap-2 px-3.5 py-3 text-sm font-semibold whitespace-nowrap text-white bg-stone-800 rounded-full shadow-lg hover:bg-stone-700 cursor-pointer"
            >
              <Square className="w-4 h-4" />
              {t.view3dStop}
            </button>
          ) : isExploring ? null : (
            tour && (
              <button
                onClick={() => void playTour(tour)}
                className="flex items-center gap-2 px-3.5 py-3 text-sm font-semibold whitespace-nowrap text-white bg-[#9A3412] rounded-full shadow-lg hover:bg-[#78350F] cursor-pointer"
              >
                <Play className="w-4 h-4" />
                {t.view3dTour}
              </button>
            )
          )}
          {!isTouring && (
            <button
              onClick={toggleExplore}
              className={`flex items-center gap-2 px-3.5 py-3 text-sm font-semibold whitespace-nowrap rounded-full shadow-lg cursor-pointer ${
                isExploring
                  ? 'text-white bg-stone-800 hover:bg-stone-700'
                  : 'text-white bg-[#2563EB] hover:bg-[#1D4ED8]'
              }`}
            >
              <Footprints className="w-4 h-4" />
              {isExploring ? t.view3dExploreStop : t.view3dExplore}
            </button>
          )}
          <button
            onClick={goHome}
            className="flex items-center gap-2 px-3.5 py-3 text-sm font-semibold whitespace-nowrap text-stone-800 bg-[#FBF9F5] border border-stone-200 rounded-full shadow-lg hover:bg-white cursor-pointer"
            aria-label={t.view3dHome}
          >
            <Home className="w-4 h-4 text-[#9A3412]" />
            <span className="hidden sm:inline">{t.view3dHome}</span>
          </button>
        </div>
      )}
    </div>
  );
};

/** Botón del pad: repite mientras se mantiene presionado. */
const PadButton: React.FC<{
  onAct: () => void;
  label: string;
  className: string;
  children: React.ReactNode;
}> = ({ onAct, label, className, children }) => {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <button
      aria-label={label}
      className={`${className} w-12 h-12 flex items-center justify-center rounded-xl bg-[#FBF9F5]/95 border border-stone-200 shadow-md text-stone-800 active:bg-stone-200 touch-none cursor-pointer`}
      onPointerDown={() => {
        onAct();
        stop();
        timer.current = setInterval(onAct, 150);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {children}
    </button>
  );
};

/** Si algo revienta dentro de la vista 3D, muestra un aviso con salida en vez de una pantalla en blanco. */
class Map3DErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Map3DView] error de render', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const language = (localStorage.getItem('zacatecas_lang') as Language) || 'es';
    const t = TRANSLATIONS[language];
    const retryStylized = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('engine', 'three');
      window.location.href = url.toString();
    };
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-stone-900 p-6">
        <div className="max-w-sm text-center bg-[#FBF9F5] rounded-xl p-6 shadow-lg">
          <h2 className="font-serif font-bold text-lg mb-2">{t.view3dCrashTitle}</h2>
          <p className="text-xs text-stone-500 font-mono break-words">{error.message}</p>
          {/* Primeras líneas de la pila: para que una captura baste para diagnosticar. */}
          {error.stack && (
            <pre className="mt-2 max-h-24 overflow-auto text-left text-[10px] leading-tight text-stone-400 whitespace-pre-wrap break-all">
              {error.stack.split('\n').slice(0, 4).join('\n')}
            </pre>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={retryStylized}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#9A3412] rounded-full cursor-pointer hover:bg-[#78350F]"
            >
              {t.view3dCrashRetry}
            </button>
            <a href="#" className="text-sm text-stone-600 underline">
              {t.view3dBack}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
