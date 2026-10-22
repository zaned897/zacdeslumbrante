import React, { useEffect, useState } from 'react';
import { MapPin, Sparkles, MessageCircle } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../data/i18n';
import { SUGGESTED_ITINERARIES } from '../data/itineraries';
import { Sheet } from './app/Sheet';

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

  const t = TRANSLATIONS[language];
  const es = language === 'es';
  const activeItinerary =
    SUGGESTED_ITINERARIES.find((it) => it.id === selectedItineraryId) || SUGGESTED_ITINERARIES[0];
  const currentDay = activeItinerary.days[activeDayIndex] || activeItinerary.days[0];

  const handleSendToChat = () => {
    const prompt = es
      ? `Quiero personalizar el siguiente ${t.openDecisionTag}: "${activeItinerary.titleEs}". Por favor proporciona detalles logísticos, horarios sugeridos de inicio y alternativas gastronómicas.`
      : `I would like to customize the following ${t.openDecisionTag}: "${activeItinerary.titleEn}". Please provide logistical details, suggested start times, and culinary recommendations.`;
    onSelectItineraryPrompt(prompt);
    onClose();
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      closeLabel={t.closeModal}
      title={es ? activeItinerary.titleEs : activeItinerary.titleEn}
      subtitle={t.openDecisionTag}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onHighlightPlacesOnMap(currentDay.stops.map((s) => s.placeId));
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 text-sm font-semibold text-cantera bg-caliza rounded-full cursor-pointer hover:brightness-95"
          >
            <MapPin className="w-4 h-4" />
            {t.viewOnMap}
          </button>
          <button
            type="button"
            onClick={handleSendToChat}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 text-sm font-semibold text-sobre-cantera bg-cantera rounded-full cursor-pointer hover:brightness-95"
          >
            <MessageCircle className="w-4 h-4" />
            {t.itineraryAskShort}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Otros itinerarios */}
        <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1">
          {SUGGESTED_ITINERARIES.map((it) => {
            const on = it.id === activeItinerary.id;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setSelectedItineraryId(it.id);
                  setActiveDayIndex(0);
                }}
                aria-pressed={on}
                className={`px-3.5 h-8 text-xs font-semibold rounded-full whitespace-nowrap cursor-pointer transition-colors ${
                  on ? 'bg-carbon text-papel' : 'bg-caliza text-tenue hover:text-carbon'
                }`}
              >
                {es ? it.durationLabelEs : it.durationLabelEn}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-tenue">{es ? activeItinerary.themeEs : activeItinerary.themeEn}</p>

        {activeItinerary.days.length > 1 && (
          <div className="flex p-1 bg-caliza rounded-full" role="tablist">
            {activeItinerary.days.map((day, idx) => (
              <button
                key={day.dayNumber}
                type="button"
                role="tab"
                aria-selected={activeDayIndex === idx}
                onClick={() => setActiveDayIndex(idx)}
                className={`flex-1 h-8 text-xs font-bold rounded-full cursor-pointer transition-colors ${
                  activeDayIndex === idx ? 'bg-superficie text-carbon shadow-sm' : 'text-tenue'
                }`}
              >
                {es ? 'Día' : 'Day'} {day.dayNumber}
              </button>
            ))}
          </div>
        )}

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-tenue mb-3">
            {es ? currentDay.titleEs : currentDay.titleEn}
          </h3>
          <ol className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-linea">
            {currentDay.stops.map((stop, index) => (
              <li key={index} className="relative pl-7 animate-sube" style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}>
                <span className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full bg-papel border-2 border-cantera" aria-hidden="true" />
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-sm">{stop.placeName}</b>
                  <span className="font-mono text-[11px] text-tenue shrink-0">{stop.time}</span>
                </div>
                <p className="text-sm text-tenue leading-relaxed mt-0.5">{es ? stop.activityEs : stop.activityEn}</p>
                <p className="flex gap-1.5 text-xs text-carbon mt-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-terracota shrink-0 mt-px" />
                  {es ? stop.tipsEs : stop.tipsEn}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Sheet>
  );
};
