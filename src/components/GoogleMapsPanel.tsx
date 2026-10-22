import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  MapPin,
  Compass,
  Navigation,
  Layers,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Clock,
  Coins,
  Key,
} from 'lucide-react';
import { Place, Language } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { ZACATECAS_PLACES } from '../data/places';

interface GoogleMapsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  selectedPlace: Place | null;
  highlightedPlaceIds: string[];
  onPlaceSelect: (place: Place) => void;
  onAskAboutPlace: (place: Place) => void;
  splitRatio: '50-50' | 'full';
  onToggleSplitRatio: () => void;
}

export const GoogleMapsPanel: React.FC<GoogleMapsPanelProps> = ({
  isOpen,
  onClose,
  language,
  selectedPlace,
  highlightedPlaceIds,
  onPlaceSelect,
  onAskAboutPlace,
  splitRatio,
  onToggleSplitRatio,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeInfoWindowPlace, setActiveInfoWindowPlace] = useState<Place | null>(null);

  const t = TRANSLATIONS[language];

  // API Key priority resolution
  const [currentApiKey, setCurrentApiKey] = useState<string>(() => {
    return (
      localStorage.getItem('zacatecas_maps_api_key') ||
      import.meta.env.VITE_MAPS_API_KEY ||
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
    );
  });

  // Sin llave: se muestra la cartografía de respaldo y se pide una llave.
  const [showKeyModal, setShowKeyModal] = useState(() => !currentApiKey);
  const [customKeyInput, setCustomKeyInput] = useState('');

  // Capital coordinates
  const ZACATECAS_CENTRO = { lat: 22.7754, lng: -102.5724 };
  const ZACATECAS_STATE = { lat: 22.75, lng: -102.8 };

  // Initialize Google Maps
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!currentApiKey) {
      setMapError('Interactive Spatial Canvas Active');
      setMapLoaded(true);
      return;
    }

    let isMounted = true;

    const initMapWithGoogle = (googleMaps: typeof google.maps) => {
      if (!isMounted || !mapContainerRef.current) return;

      const customStyle = [
        { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
        { featureType: 'landscape', elementType: 'all', stylers: [{ color: '#f5efe6' }] },
        { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'simplified' }] },
        { featureType: 'road', elementType: 'all', stylers: [{ saturation: -40 }, { lightness: 20 }] },
        { featureType: 'water', elementType: 'all', stylers: [{ color: '#c9d9e8' }, { visibility: 'on' }] },
      ];

      const map = new googleMaps.Map(mapContainerRef.current, {
        center: ZACATECAS_CENTRO,
        zoom: 14,
        styles: customStyle,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new googleMaps.InfoWindow();
      setMapLoaded(true);
      setMapError(null);
    };

    // If window.google.maps is already initialized
    if (window.google?.maps) {
      initMapWithGoogle(window.google.maps);
      return;
    }

    // Check if script element already exists
    const existingScript = document.getElementById('google-maps-script') as HTMLScriptElement | null;
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval);
          initMapWithGoogle(window.google.maps);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Inject Google Maps script directly with the provided API key
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${currentApiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google?.maps) {
        initMapWithGoogle(window.google.maps);
      } else {
        setMapError('Interactive Spatial Canvas Active');
        setMapLoaded(true);
      }
    };

    script.onerror = (err) => {
      console.warn('Google Maps script tag error:', err);
      setMapError('Interactive Spatial Canvas Active');
      setMapLoaded(true);
    };

    document.head.appendChild(script);

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentApiKey]);

  // Handle marker creation and updates
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || mapError) return;

    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    const filteredPlaces = ZACATECAS_PLACES.filter((p) => {
      if (activeCategory === 'all') return true;
      if (activeCategory === 'monument' && p.category === 'monument') return true;
      if (activeCategory === 'museum' && p.category === 'museum') return true;
      if (activeCategory === 'archaeology' && p.category === 'archaeology') return true;
      if (activeCategory === 'pueblo_magico' && p.category === 'pueblo_magico') return true;
      return false;
    });

    filteredPlaces.forEach((place) => {
      const isHighlighted = highlightedPlaceIds.includes(place.id);
      const isSelected = selectedPlace?.id === place.id;

      // Custom SVG marker pin
      const pinColor = isSelected ? '#BE123C' : isHighlighted ? '#D97706' : place.color;
      const marker = new google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: map,
        title: language === 'es' ? place.nameEs : place.name,
        animation: isSelected ? google.maps.Animation.BOUNCE : undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 9 : isHighlighted ? 8 : 6,
          fillColor: pinColor,
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        onPlaceSelect(place);
        setActiveInfoWindowPlace(place);

        if (infoWindowRef.current) {
          const content = `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 6px; max-width: 260px; color: #1C1917;">
              <h3 style="font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 700; margin: 0 0 4px 0; color: #9A3412;">
                ${language === 'es' ? place.nameEs : place.name}
              </h3>
              <p style="font-size: 11px; color: #78716C; margin: 0 0 8px 0;">${place.address}</p>
              <div style="font-size: 11px; margin-bottom: 6px;">
                <strong>${t.scheduleLabel}</strong> ${place.schedule}<br/>
                <strong>${t.feeLabel}</strong> ${place.fee}
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, marker);
        }
      });

      markersRef.current.set(place.id, marker);
    });
  }, [mapLoaded, mapError, activeCategory, highlightedPlaceIds, selectedPlace, language, onPlaceSelect, t]);

  // Center map on selected place
  useEffect(() => {
    if (selectedPlace && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: selectedPlace.lat, lng: selectedPlace.lng });
      mapInstanceRef.current.setZoom(16);
      setActiveInfoWindowPlace(selectedPlace);

      const marker = markersRef.current.get(selectedPlace.id);
      if (marker && infoWindowRef.current) {
        infoWindowRef.current.open(mapInstanceRef.current, marker);
      }
    }
  }, [selectedPlace]);

  // Center capital handler
  const handleCenterCapital = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(ZACATECAS_CENTRO);
      mapInstanceRef.current.setZoom(15);
    }
  };

  // Center state handler
  const handleCenterState = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(ZACATECAS_STATE);
      mapInstanceRef.current.setZoom(8);
    }
  };

  if (!isOpen) return null;

  // Nearby attractions calculation for the currently selected place
  const nearbyPlacesList = activeInfoWindowPlace
    ? ZACATECAS_PLACES.filter((p) => activeInfoWindowPlace.nearbyPlaces.includes(p.id))
    : [];

  return (
    <div
      className={`h-[calc(100vh-61px)] flex flex-col bg-[#F7F4EE] border-l border-stone-200 transition-all duration-300 z-10 ${
        splitRatio === 'full' ? 'w-full' : 'w-full lg:w-1/2'
      }`}
    >
      {/* Map Header Toolbar */}
      <div className="px-4 py-3 bg-white border-b border-stone-200 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#9A3412]/10 text-[#9A3412] rounded-lg">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-sm text-stone-900 leading-tight">
              {t.mapTitle}
            </h2>
            <span className="text-[10px] text-stone-500 font-mono">
              {ZACATECAS_PLACES.length} {t.placesInState}
            </span>
          </div>
        </div>

        {/* Center shortcuts, API key pill & full-screen toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setCustomKeyInput(currentApiKey);
              setShowKeyModal(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors cursor-pointer"
            title="Google Maps API Key activa. Clic para cambiar"
          >
            <Key className="w-3 h-3 text-emerald-600" />
            <span>
              {currentApiKey
                ? `Key: ${currentApiKey.slice(0, 6)}...${currentApiKey.slice(-4)}`
                : language === 'es'
                  ? 'Sin llave'
                  : 'No key'}
            </span>
          </button>
          <button
            onClick={handleCenterCapital}
            className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors cursor-pointer"
            title={t.centerOnCapital}
          >
            {language === 'es' ? 'Capital' : 'Capital'}
          </button>
          <button
            onClick={handleCenterState}
            className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors cursor-pointer"
            title={t.centerOnState}
          >
            {language === 'es' ? 'Estado' : 'State'}
          </button>

          {/* 50/50 vs Full Screen Toggle */}
          <button
            onClick={onToggleSplitRatio}
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
            title={splitRatio === 'full' ? t.mapSplit50 : t.mapFullScreen}
          >
            {splitRatio === 'full' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Map */}
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
            title={t.mapClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="px-4 py-2 bg-[#FBF9F5] border-b border-stone-200 flex items-center gap-1.5 overflow-x-auto text-xs">
        {[
          { id: 'all', label: t.filterAll },
          { id: 'monument', label: t.filterMonuments },
          { id: 'museum', label: t.filterMuseums },
          { id: 'archaeology', label: t.filterArchaeology },
          { id: 'pueblo_magico', label: t.filterPueblos },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-[#9A3412] text-white shadow-2xs'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Map Viewport */}
      <div className="relative flex-1 bg-stone-200 overflow-hidden">
        {/* Google Maps Real Container */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Fallback Interactive Spatial Map when script loader notifies fallback */}
        {mapError && (
          <div className="absolute inset-0 bg-[#F5EFEB] p-4 flex flex-col justify-between overflow-y-auto">
            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-stone-300 shadow-xs mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#9A3412]" />
                <span className="text-xs font-bold text-stone-900">
                  {language === 'es' ? 'Cartografía Espacial Oficial de Zacatecas' : 'Official Zacatecas Spatial Mapping'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                GPS Coords Activas
              </span>
            </div>

            {/* Grid of Georeferenced Pins */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ZACATECAS_PLACES.filter((p) =>
                activeCategory === 'all' ? true : p.category === activeCategory
              ).map((place) => (
                <button
                  key={place.id}
                  onClick={() => {
                    onPlaceSelect(place);
                    setActiveInfoWindowPlace(place);
                  }}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    activeInfoWindowPlace?.id === place.id
                      ? 'bg-white border-[#9A3412] ring-2 ring-[#9A3412]/20 shadow-md'
                      : 'bg-white/80 hover:bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-serif font-bold text-xs text-stone-900 leading-snug">
                      {language === 'es' ? place.nameEs : place.name}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: place.color }}
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 font-mono mt-1">
                    {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                  </p>
                  <p className="text-[11px] text-stone-600 line-clamp-1 mt-1">
                    {place.fee}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Place Detail Floating Card */}
        {activeInfoWindowPlace && (
          <div className="absolute bottom-4 left-4 right-4 max-w-lg mx-auto bg-white/95 backdrop-blur-md border border-stone-300 rounded-2xl shadow-xl p-4 animate-in slide-in-from-bottom-4 duration-200 space-y-3 z-10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9A3412] bg-[#9A3412]/10 px-2 py-0.5 rounded">
                  {language === 'es'
                    ? activeInfoWindowPlace.categoryLabel.es
                    : activeInfoWindowPlace.categoryLabel.en}
                </span>
                <h3 className="font-serif font-bold text-base text-stone-900 mt-1">
                  {language === 'es'
                    ? activeInfoWindowPlace.nameEs
                    : activeInfoWindowPlace.name}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {activeInfoWindowPlace.address}
                </p>
              </div>

              <button
                onClick={() => setActiveInfoWindowPlace(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Practical Info Pill Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-stone-50 border border-stone-200 rounded-lg flex items-start gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[10px] text-stone-500 uppercase">{t.scheduleLabel}</span>
                  <span className="text-stone-800 text-[11px] leading-tight">{activeInfoWindowPlace.schedule}</span>
                </div>
              </div>

              <div className="p-2 bg-stone-50 border border-stone-200 rounded-lg flex items-start gap-1.5">
                <Coins className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[10px] text-stone-500 uppercase">{t.feeLabel}</span>
                  <span className="text-stone-800 text-[11px] leading-tight">{activeInfoWindowPlace.fee}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-stone-700 leading-relaxed">
              {language === 'es'
                ? activeInfoWindowPlace.descriptionEs
                : activeInfoWindowPlace.descriptionEn}
            </p>

            {/* Nearby Walking Cluster / Combined Circuit Highlight */}
            {nearbyPlacesList.length > 0 && (
              <div className="pt-2 border-t border-stone-200/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  {t.walkingCluster}
                </span>
                <div className="flex flex-wrap gap-1">
                  {nearbyPlacesList.map((near) => (
                    <button
                      key={near.id}
                      onClick={() => {
                        onPlaceSelect(near);
                        setActiveInfoWindowPlace(near);
                      }}
                      className="px-2 py-0.5 text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md transition-colors cursor-pointer"
                    >
                      {language === 'es' ? near.nameEs : near.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Card Actions */}
            <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between gap-2">
              <a
                href={activeInfoWindowPlace.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#9A3412] hover:underline"
              >
                <span>{language === 'es' ? 'Ficha Oficial' : 'Official Portal'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => onAskAboutPlace(activeInfoWindowPlace)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9A3412] hover:bg-[#78350F] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t.askAboutThisPlace}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Key Edit Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-2xl border border-stone-300 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#9A3412]" />
                <h3 className="font-serif font-bold text-base text-stone-900">
                  {language === 'es' ? 'Clave de Google Maps API' : 'Google Maps API Key'}
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {language === 'es'
                ? 'La clave actual cargada en la aplicación se muestra a continuación. Puedes actualizarla o verificarla.'
                : 'The current active API key is shown below. You can update or verify it.'}
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                API Key
              </label>
              <input
                type="text"
                value={customKeyInput}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const trimmed = customKeyInput.trim();
                  if (trimmed) {
                    localStorage.setItem('zacatecas_maps_api_key', trimmed);
                    setCurrentApiKey(trimmed);
                    // Remove old script so it reloads with the new key
                    const oldScript = document.getElementById('google-maps-script');
                    if (oldScript) oldScript.remove();
                    window.location.reload();
                  }
                  setShowKeyModal(false);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#9A3412] hover:bg-[#78350F] rounded-lg transition-colors cursor-pointer"
              >
                {language === 'es' ? 'Guardar y Recargar' : 'Save & Reload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
