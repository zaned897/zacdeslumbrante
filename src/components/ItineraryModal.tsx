import React, { useEffect, useState } from 'react';
import { X, Compass, Clock, MapPin, Sparkles, Send } from 'lucide-react';
import { Language, SuggestedItinerary } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { SUGGESTED_ITINERARIES } from '../data/itineraries';

interface ItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onSelectItineraryPrompt: (prompt: string) => void;
  onHighlightPlacesOnMap: (placeIds: string[]) => void;
  initialItineraryId?: string;
}

export const ItineraryModal: React.FC<ItineraryModalProps> = ({
  isOpen,
  onClose,
  language,
  onSelectItineraryPrompt,
  onHighlightPlacesOnMap,
  initialItineraryId,
}) => {
  const [selectedItineraryId, setSelectedItineraryId] = useState<string>(SUGGESTED_ITINERARIES[0].id);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);

  // Al abrir desde Planes, arranca en el itinerario que se tocó.
  useEffect(() => {
    if (isOpen && initialItineraryId) {
      setSelectedItineraryId(initialItineraryId);
      setActiveDayIndex(0);
    }
  }, [isOpen, initialItineraryId]);

  if (!isOpen) return null;

  const t = TRANSLATIONS[language];
  const activeItinerary =
    SUGGESTED_ITINERARIES.find((it) => it.id === selectedItineraryId) || SUGGESTED_ITINERARIES[0];
  const currentDay = activeItinerary.days[activeDayIndex] || activeItinerary.days[0];

  const handleSendToChat = () => {
    const prompt =
      language === 'es'
        ? `Quiero personalizar el siguiente ${t.openDecisionTag}: "${activeItinerary.titleEs}". Por favor proporciona detalles logísticos, horarios sugeridos de inicio y alternativas gastronómicas.`
        : `I would like to customize the following ${t.openDecisionTag}: "${activeItinerary.titleEn}". Please provide logistical details, suggested start times, and culinary recommendations.`;

    const allPlaceIds = activeItinerary.days.flatMap((d) => d.stops.map((s) => s.placeId));
    onHighlightPlacesOnMap(allPlaceIds);
    onSelectItineraryPrompt(prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FBF9F5] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-stone-300 flex flex-col overflow-hidden">
        {/* Header with Explicit Tag */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-start justify-between bg-white">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-md text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-amber-700" />
              <span>{t.openDecisionTag}</span>
            </div>
            <h2 className="font-serif font-bold text-xl text-stone-900">
              {t.itineraryModalTitle}
            </h2>
            <p className="text-xs text-stone-500 max-w-2xl">
              {t.itineraryModalSubtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Itinerary Selection Tabs */}
        <div className="px-6 py-3 bg-[#F7F4EE] border-b border-stone-200 flex gap-2 overflow-x-auto">
          {SUGGESTED_ITINERARIES.map((itinerary) => {
            const isSelected = itinerary.id === selectedItineraryId;
            return (
              <button
                key={itinerary.id}
                onClick={() => {
                  setSelectedItineraryId(itinerary.id);
                  setActiveDayIndex(0);
                }}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-white text-stone-700 hover:text-stone-900 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span>{language === 'es' ? itinerary.durationLabelEs : itinerary.durationLabelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Active Itinerary Header */}
          <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-serif font-bold text-lg text-stone-900">
                {language === 'es' ? activeItinerary.titleEs : activeItinerary.titleEn}
              </h3>
              <span className="text-xs font-mono text-stone-600 bg-stone-100 px-2.5 py-1 rounded border border-stone-200">
                {language === 'es' ? activeItinerary.themeEs : activeItinerary.themeEn}
              </span>
            </div>

            {/* Day Selector if multiple days */}
            {activeItinerary.days.length > 1 && (
              <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  {language === 'es' ? 'Días:' : 'Days:'}
                </span>
                {activeItinerary.days.map((day, idx) => (
                  <button
                    key={day.dayNumber}
                    onClick={() => setActiveDayIndex(idx)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                      activeDayIndex === idx
                        ? 'bg-[#9A3412] text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    Día {day.dayNumber}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Timeline of Stops */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              {language === 'es' ? currentDay.titleEs : currentDay.titleEn}
            </h4>

            <div className="space-y-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-stone-200">
              {currentDay.stops.map((stop, index) => (
                <div key={index} className="relative flex items-start gap-4 pl-9">
                  <div className="absolute left-1.5 top-2 w-4 h-4 rounded-full bg-[#9A3412] border-2 border-white ring-1 ring-stone-300 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  <div className="flex-1 bg-white p-4 rounded-xl border border-stone-200 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-xs font-mono font-medium text-stone-600">
                          {stop.time}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#9A3412]">
                        {stop.placeName}
                      </span>
                    </div>

                    <p className="text-xs text-stone-800 leading-relaxed">
                      {language === 'es' ? stop.activityEs : stop.activityEn}
                    </p>

                    <div className="pt-2 border-t border-stone-100 flex items-center gap-2 text-[11px] text-stone-600">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{language === 'es' ? stop.tipsEs : stop.tipsEn}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-stone-500 italic">
            * {t.openDecisionTag}: Cada viajero puede adaptar paradas según disponibilidad y condiciones meteorológicas.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                const placeIds = currentDay.stops.map((s) => s.placeId);
                onHighlightPlacesOnMap(placeIds);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-[#9A3412]" />
              <span>{t.viewOnMap}</span>
            </button>

            <button
              onClick={handleSendToChat}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#9A3412] hover:bg-[#78350F] rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t.askAboutItinerary}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
