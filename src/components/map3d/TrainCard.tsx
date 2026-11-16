import React from 'react';
import { Clock, MessageCircle, Navigation, Ticket, X } from 'lucide-react';
import { TRANSLATIONS } from '../../data/i18n';
import { TRAINS, type TrainId, type TrainRecord } from '../../data/trains';
import type { Language } from '../../types';

export interface TrainCardProps {
  train: TrainRecord | TrainId;
  language: Language;
  onClose?: () => void;
  onAsk?: (train: TrainRecord) => void;
  onDirections?: (train: TrainRecord) => void;
  showActions?: boolean;
  className?: string;
}

export const TrainCard: React.FC<TrainCardProps> = ({
  train,
  language,
  onClose,
  onAsk,
  onDirections,
  showActions,
  className = '',
}) => {
  const t = TRANSLATIONS[language];
  const record: TrainRecord = typeof train === 'string' ? TRAINS[train] : train;
  const hasPlaceActions = showActions ?? record.id === 'trenecito-encantada';
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    record.directionsQuery ?? `${record.name.es} Zacatecas`,
  )}`;

  return (
    <div
      className={`bg-[#FBF9F5] rounded-2xl shadow-lg border border-stone-200 p-4 text-stone-900 ${className}`.trim()}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9A3412]">
        {record.subtitle[language]}
      </p>

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif font-bold text-base leading-snug text-stone-900">
          {record.name[language]}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-500 hover:text-stone-900 cursor-pointer shrink-0"
            aria-label={t.view3dClose}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-stone-700">
        {record.text[language]}
      </p>

      {record.note && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-500">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{record.note[language]}</span>
        </p>
      )}

      {record.schedule && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-600">
          <Clock className="w-3.5 h-3.5 shrink-0 text-stone-500" />
          <span>{record.schedule.label[language]}</span>
          {record.schedule._mock && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded-full">
              {record.schedule.status[language] || t.trainUnconfirmed}
            </span>
          )}
        </p>
      )}

      {record.price && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-600">
          <Ticket className="w-3.5 h-3.5 shrink-0 text-stone-500" />
          <span>
            {t.trainPriceLabel}: {record.price.label[language]}
          </span>
          {record.price._mock && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded-full">
              {record.price.status[language] || t.trainUnconfirmed}
            </span>
          )}
        </p>
      )}

      <p className="mt-2 text-[10px] leading-snug text-stone-500">
        {t.trainSourceLabel}:{' '}
        <a
          href={record.source.url}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-stone-800"
        >
          {record.source.name[language]}
        </a>
      </p>

      {hasPlaceActions && (
        <div className="mt-3 flex items-center gap-2">
          {onDirections ? (
            <button
              type="button"
              onClick={() => onDirections(record)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-stone-100 border border-stone-200 rounded-full hover:bg-stone-200 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              {t.trainDirections}
            </button>
          ) : (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-stone-100 border border-stone-200 rounded-full hover:bg-stone-200 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              {t.trainDirections}
            </a>
          )}
          <button
            type="button"
            onClick={() => onAsk?.(record)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#9A3412] rounded-full hover:bg-[#78350F] cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {t.trainAsk}
          </button>
        </div>
      )}
    </div>
  );
};

export default TrainCard;
