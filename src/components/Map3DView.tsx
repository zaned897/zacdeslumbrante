import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Globe, Home, Play, Square, X } from 'lucide-react';
import { Language } from '../types';
import type { SceneEngine, ScenePoi, Tour } from '../types/scene3d';
import { TRANSLATIONS } from '../data/i18n';
import { TOURS_3D, ZACATECAS_3D_HOME } from '../data/tours3d';
import { ZACATECAS_PLACES } from '../data/places';
import { SCENE_LAYERS } from '../scene3d/layers';
import { GoogleMaps3dEngine } from '../scene3d/googleMaps3dEngine';

type Status = 'loading' | 'ready' | 'nokey' | 'error';

const FLIGHT_MILLIS = 4500;

function resolveApiKey(): string {
  return (
    localStorage.getItem('zacatecas_maps_api_key') ||
    import.meta.env.VITE_MAPS_API_KEY ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Vista 3D de la ciudad (nivel mock). Se abre en /#3d. */
export const Map3DView: React.FC = () => {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem('zacatecas_lang') as Language) || 'es',
  );
  const [status, setStatus] = useState<Status>('loading');
  const [errorDetail, setErrorDetail] = useState('');
  const [pois, setPois] = useState<ScenePoi[]>([]);
  const [selected, setSelected] = useState<ScenePoi | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [isTouring, setIsTouring] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const tourRunRef = useRef(0);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    localStorage.setItem('zacatecas_lang', language);
    document.documentElement.lang = language;
  }, [language]);

  // Montar el motor una sola vez.
  useEffect(() => {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      setStatus('nokey');
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const engine = new GoogleMaps3dEngine(apiKey);
    engineRef.current = engine;
    let cancelled = false;

    engine
      .mount(container, ZACATECAS_3D_HOME)
      .then(async () => {
        if (cancelled) return;
        engine.onPoiClick(setSelected);
        const loaded = await Promise.all(
          SCENE_LAYERS.filter((l) => l.enabledByDefault).map((l) => l.load()),
        );
        if (cancelled) return;
        setPois(loaded.flat());
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorDetail(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      tourRunRef.current++;
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Repintar marcadores al cambiar puntos o idioma.
  useEffect(() => {
    if (status === 'ready') engineRef.current?.setPois(pois, language);
  }, [pois, language, status]);

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

  const goHome = () => {
    stopTour();
    void engineRef.current?.flyTo(ZACATECAS_3D_HOME, 2500);
  };

  const selectedPlace = selected?.placeId
    ? ZACATECAS_PLACES.find((p) => p.id === selected.placeId)
    : undefined;
  const tour = TOURS_3D[0];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-stone-900 text-stone-900">
      <div ref={containerRef} className="absolute inset-0" />

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
            {status === 'nokey' && (
              <>
                <h2 className="font-serif font-bold text-lg mb-2">{t.view3dNoKeyTitle}</h2>
                <p className="text-sm text-stone-600">{t.view3dNoKeyBody}</p>
              </>
            )}
            {status === 'error' && (
              <>
                <h2 className="font-serif font-bold text-lg mb-2">{t.view3dErrorTitle}</h2>
                <p className="text-xs text-stone-500 font-mono break-words">{errorDetail}</p>
              </>
            )}
          </div>
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
      {selected && !isTouring && (
        <div className="absolute inset-x-3 bottom-24 md:inset-x-auto md:right-4 md:w-80 z-10 bg-[#FBF9F5] rounded-xl shadow-lg border border-stone-200 p-4">
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
        </div>
      )}

      {/* Controles */}
      {status === 'ready' && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center gap-2 p-4">
          {isTouring ? (
            <button
              onClick={stopTour}
              className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-stone-800 rounded-full shadow-lg hover:bg-stone-700 cursor-pointer"
            >
              <Square className="w-4 h-4" />
              {t.view3dStop}
            </button>
          ) : (
            tour && (
              <button
                onClick={() => void playTour(tour)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[#9A3412] rounded-full shadow-lg hover:bg-[#78350F] cursor-pointer"
              >
                <Play className="w-4 h-4" />
                {t.view3dTour}
              </button>
            )
          )}
          <button
            onClick={goHome}
            className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-stone-800 bg-[#FBF9F5] border border-stone-200 rounded-full shadow-lg hover:bg-white cursor-pointer"
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
