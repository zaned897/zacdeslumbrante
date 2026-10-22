import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Footprints,
  MessageCircle,
  Globe,
  Home,
  Layers,
  LocateFixed,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Trophy,
  X,
} from 'lucide-react';
import { Language } from '../types';
import type { SceneEngine, SceneLayerContext, ScenePoi, Tour } from '../types/scene3d';
import { TRANSLATIONS } from '../data/i18n';
import { PlaceAskPanel } from './PlaceAskPanel';
import { TOURS_3D, ZACATECAS_3D_HOME, loadTours } from '../data/tours3d';
import { ZACATECAS_PLACES } from '../data/places';
import { SCENE_LAYERS } from '../scene3d/layers';
import { createEngine, selectedEngineId, type EngineId } from '../scene3d/createEngine';
import { SceneStats, isStatsEnabled } from '../scene3d/SceneStats';
import { distanceMeters } from '../scene3d/geo';
import { usePlayerPosition, type FallbackReason } from '../scene3d/usePlayerPosition';
import { useCollection } from '../scene3d/useCollection';
import { useAvatarControls, type AvatarAction } from '../scene3d/useAvatarControls';
import { loadPlacePhotos, type PlacePhoto } from '../scene3d/placePhotos';

type Status = 'loading' | 'ready' | 'error';

const FLIGHT_MILLIS = 4500;
const DISCOVER_RADIUS_M = 40;
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

function resolveApiKey(): string {
  return (
    localStorage.getItem('zacatecas_maps_api_key') ||
    import.meta.env.VITE_MAPS_API_KEY ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  );
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
  const [caption, setCaption] = useState<string | null>(null);
  const [isTouring, setIsTouring] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [tours, setTours] = useState<Tour[]>(TOURS_3D);
  const [tourId, setTourId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isExploring, setIsExploring] = useState(false);
  const [avatar, setAvatar] = useState<AvatarId>(readAvatar);
  const [toast, setToast] = useState<string | null>(null);
  const [timings, setTimings] = useState<{ mountMs: number | null; readyMs: number | null }>({
    mountMs: null,
    readyMs: null,
  });
  const apiKey = useMemo(resolveApiKey, []);
  // Si Google rechaza la llave o no hay 3D Tiles, se cae a la ciudad estilizada en vez de quedar en error.
  const [engineFallback, setEngineFallback] = useState<EngineId | null>(null);
  const [keyErrorCode, setKeyErrorCode] = useState<string | null>(null);
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
    void loadTours().then(setTours);
  }, []);

  // Montar el motor una sola vez.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = createEngine(engineId, apiKey);
    engineRef.current = engine;
    let cancelled = false;
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

  // Fotos del lugar seleccionado (#23).
  const selectedPlaceId = selected?.placeId;
  useEffect(() => {
    setPhotos([]);
    setPhotoIndex(0);
    if (!selectedPlaceId) return;
    let cancelled = false;
    void loadPlacePhotos(selectedPlaceId).then((list) => {
      if (!cancelled) setPhotos(list);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPlaceId]);

  // Repintar marcadores al cambiar puntos, idioma o colección (en exploración, lo no descubierto va en gris).
  useEffect(() => {
    if (status !== 'ready') return;
    const shown = isExploring
      ? pois.map((p) =>
          p.kind === 'place' && p.placeId && !collection[p.placeId] ? { ...p, color: UNDISCOVERED_COLOR } : p,
        )
      : pois;
    engineRef.current?.setPois(shown, language);
  }, [pois, language, status, isExploring, collection]);

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
  }, [position, status, placePois, collection, discover, t, language]);

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
    setCaption(null);
  }, []);

  const playTour = useCallback(
    async (tour: Tour) => {
      const engine = engineRef.current;
      if (!engine) return;
      const run = ++tourRunRef.current;
      const isCurrent = () => tourRunRef.current === run;
      setSelected(null);
      setIsTouring(true);
      engine.setRoute(tour.stops.map((s) => ({ lat: s.camera.lat, lng: s.camera.lng })));

      for (const stop of tour.stops) {
        setCaption(stop.caption[language]);
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
      setCaption(null);
      setIsTouring(false);
    },
    [language],
  );

  const toggleExplore = () => {
    stopTour();
    setSelected(null);
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

  useEffect(() => setIsAsking(false), [selected]);

  const selectedPlace = selected?.placeId
    ? ZACATECAS_PLACES.find((p) => p.id === selected.placeId)
    : undefined;
  const tour = tours.find((x) => x.id === tourId) ?? tours[0];
  const photo = photos[photoIndex];
  const stepPhoto = (delta: number) =>
    setPhotoIndex((i) => (i + delta + photos.length) % photos.length);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-stone-900 text-stone-900">
      {/* isolate: las etiquetas CSS2D de three.js traen z-index propio y no deben tapar la UI. */}
      <div ref={containerRef} className="absolute inset-0 isolate" />

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
              {t.view3dKeyRejected}
              {keyErrorCode && <span className="block mt-1 font-mono text-stone-500">{keyErrorCode}</span>}
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
          <p className="mt-2 text-stone-600">
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

      {toast && (
        <div className="absolute inset-x-0 top-1/3 z-20 flex justify-center px-4 pointer-events-none">
          <p className="animate-bounce text-center text-sm md:text-base font-bold text-white bg-[#9A3412] rounded-full shadow-lg px-5 py-3">
            {toast}
          </p>
        </div>
      )}

      {/* Subtítulo del recorrido */}
      {caption && (
        <div className="absolute inset-x-0 bottom-24 z-10 flex justify-center px-4 pointer-events-none">
          <p className="max-w-xl text-center text-sm md:text-base font-medium text-white bg-stone-900/75 rounded-lg px-4 py-3">
            {caption}
          </p>
        </div>
      )}

      {/* Tarjeta del lugar */}
      {selected && !isTouring && !isAsking && (
        <div className={`absolute inset-x-3 ${isExploring ? 'bottom-56 md:bottom-24 md:right-48' : 'bottom-32 md:right-4'} md:inset-x-auto md:w-80 z-10 max-h-[60dvh] overflow-y-auto bg-[#FBF9F5] rounded-xl shadow-lg border border-stone-200 p-4`}>
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
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] font-semibold text-white bg-stone-900/60 rounded">
                      {photoIndex + 1}/{photos.length}
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
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif font-bold text-base text-[#9A3412]">{selected.title[language]}</h3>
            <button
              onClick={() => setSelected(null)}
              className="p-1 text-stone-500 hover:text-stone-900 cursor-pointer"
              aria-label={t.view3dClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {selected.summary && (
            <p className="mt-2 text-xs leading-relaxed text-stone-700">{selected.summary[language]}</p>
          )}
          {selectedPlace && (
            <p className="mt-2 text-[11px] text-stone-500">
              <span className="font-semibold">{t.scheduleLabel}</span> {selectedPlace.schedule}
            </p>
          )}
          {selectedPlace && (
            <button
              onClick={() => setIsAsking(true)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#9A3412] rounded-lg hover:bg-[#7C2D12] cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {t.view3dAsk}
            </button>
          )}
        </div>
      )}

      {/* Chat sobre el lugar (#25) */}
      {isAsking && selectedPlace && (
        <PlaceAskPanel place={selectedPlace} language={language} onClose={() => setIsAsking(false)} />
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

      {/* Selector de recorrido (#34) */}
      {status === 'ready' && !isTouring && !isExploring && tours.length > 1 && (
        <div className="absolute inset-x-0 bottom-[4.5rem] z-10 flex justify-center px-4">
          <label className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#FBF9F5]/95 border border-stone-200 rounded-full shadow-sm">
            <span className="text-stone-500">{t.view3dTourPick}</span>
            <select
              value={tour?.id}
              onChange={(e) => setTourId(e.target.value)}
              className="max-w-[12rem] bg-transparent font-semibold text-stone-800 cursor-pointer focus:outline-none"
            >
              {tours.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title[language]}
                </option>
              ))}
            </select>
          </label>
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
