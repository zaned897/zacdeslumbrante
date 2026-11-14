import React, { useEffect, useState } from 'react';
import { Clock, MessageCircle, Navigation, Ticket, X } from 'lucide-react';
import { TRANSLATIONS } from '../../data/i18n';
import {
  formatTripDuration,
  isTelefericoOpen,
  loadTeleferico,
  nextOpening,
  type TelefericoData,
  type TelefericoSource,
  type TelefericoSourceId,
  type TelefericoStation,
  type TelefericoStationId,
} from '../../data/teleferico';
import type { Language } from '../../types';

export interface CableCarCardProps {
  data?: TelefericoData | null;
  stationId?: TelefericoStationId;
  now?: Date;
  language: Language;
  onClose?: () => void;
  onAsk?: (data: TelefericoData, station?: TelefericoStation) => void;
  onDirections?: (data: TelefericoData, station?: TelefericoStation) => void;
  showActions?: boolean;
  className?: string;
}

interface SourceListProps {
  ids: readonly TelefericoSourceId[];
  sources: Record<TelefericoSourceId, TelefericoSource>;
  label: string;
}

const SourceList: React.FC<SourceListProps> = ({ ids, sources, label }) => {
  const valid = ids
    .map((id) => ({ id, source: sources[id] }))
    .filter((entry): entry is { id: TelefericoSourceId; source: TelefericoSource } =>
      Boolean(entry.source),
    );

  if (!valid.length) return null;

  return (
    <span className="text-[10px] leading-snug text-stone-500">
      {label}:{' '}
      {valid.map(({ id, source }, idx) => (
        <React.Fragment key={id}>
          {idx > 0 && ' · '}
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-stone-800"
          >
            {source.name}
          </a>
        </React.Fragment>
      ))}
    </span>
  );
};

export const CableCarCard: React.FC<CableCarCardProps> = ({
  data: initialData,
  stationId,
  now,
  language,
  onClose,
  onAsk,
  onDirections,
  showActions = true,
  className = '',
}) => {
  const t = TRANSLATIONS[language];
  const [loadedData, setLoadedData] = useState<TelefericoData | null>(initialData ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setLoadedData(initialData);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    loadTeleferico()
      .then((json) => {
        if (!cancelled) {
          setLoadedData(json);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : t.telefericoLoadError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialData, t.telefericoLoadError]);

  const data = initialData ?? loadedData;

  if (loadError && !data) {
    return (
      <div
        role="alert"
        className={`bg-[#FBF9F5] rounded-2xl shadow-lg border border-red-300 p-4 text-stone-900 ${className}`.trim()}
      >
        <p className="text-xs font-semibold text-red-800">{t.telefericoLoadError}</p>
        <p className="mt-1 text-[11px] text-red-700">{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={`bg-[#FBF9F5] rounded-2xl shadow-lg border border-stone-200 p-4 text-stone-900 ${className}`.trim()}
      >
        <p className="text-xs text-stone-600">{t.telefericoLoading}</p>
      </div>
    );
  }

  const effectiveNow = now ?? new Date();
  const selectedStation = stationId
    ? data.stations.find((s) => s.id === stationId)
    : undefined;

  const openNow = isTelefericoOpen(effectiveNow, data.schedule);
  const nextOpen = nextOpening(effectiveNow, data.schedule);
  const tripFormatted = formatTripDuration(data.line.tripSeconds);

  const queryTarget = selectedStation
    ? `${selectedStation.name.es} Zacatecas`
    : `${t.telefericoTitle} Zacatecas`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    queryTarget,
  )}`;

  return (
    <div
      className={`bg-[#FBF9F5] rounded-2xl shadow-lg border border-stone-200 p-4 text-stone-900 ${className}`.trim()}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9A3412]">
        {selectedStation ? selectedStation.name[language] : t.telefericoSubtitle}
      </p>

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif font-bold text-base leading-snug text-stone-900">
          {t.telefericoTitle}
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

      {/* Horario + estado abierto / próxima apertura + fuente */}
      <div className="mt-2 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-700">
          <Clock className="w-3.5 h-3.5 shrink-0 text-stone-500" />
          <span>
            {t.trainScheduleLabel}: {t.telefericoScheduleDays}, {data.schedule.open}–
            {data.schedule.close}
          </span>
          {data.schedule.verify && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded-full">
              {t.trainUnconfirmed}
            </span>
          )}
        </div>
        <p className="text-[11px] font-semibold text-stone-800">
          {openNow ? t.telefericoOpenNow : nextOpen.label[language]}
        </p>
        <div>
          <SourceList
            ids={data.schedule.source}
            sources={data.sources}
            label={t.trainSourceLabel}
          />
        </div>
      </div>

      {/* Tres cifras: 645 m, 96 m, 2:10 calculado de tripSeconds + fuente */}
      <div className="mt-3 rounded-xl bg-stone-100/80 border border-stone-200/80 p-2.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-serif font-bold text-sm text-stone-900">
              {data.line.lengthM} m
            </p>
            <p className="text-[10px] text-stone-600">{t.telefericoLengthLabel}</p>
          </div>
          <div>
            <p className="font-serif font-bold text-sm text-stone-900">
              {data.line.riseM} m
            </p>
            <p className="text-[10px] text-stone-600">{t.telefericoRiseLabel}</p>
          </div>
          <div>
            <p className="font-serif font-bold text-sm text-stone-900">{tripFormatted}</p>
            <p className="text-[10px] text-stone-600">{t.telefericoTripLabel}</p>
          </div>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-stone-200/70">
          <SourceList
            ids={data.line.source}
            sources={data.sources}
            label={t.trainSourceLabel}
          />
        </div>
      </div>

      {/* Tabla de tarifas: sencillo, redondo y extra piso de cristal + fuentes y por confirmar */}
      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-stone-800">
          <Ticket className="w-3.5 h-3.5 shrink-0 text-stone-500" />
          <span>
            {t.telefericoFaresTitle} ({data.fares.currency})
          </span>
          {data.fares.verify && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded-full">
              {t.trainUnconfirmed}
            </span>
          )}
        </div>

        <table className="mt-1.5 w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-stone-200 text-[10px] uppercase tracking-wider text-stone-500">
              <th className="py-1 pr-2 font-semibold">{t.telefericoFareTicket}</th>
              <th className="py-1 px-2 font-semibold text-right">{t.telefericoOneWay}</th>
              <th className="py-1 pl-2 font-semibold text-right">{t.telefericoRoundTrip}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/70">
            {data.fares.rows.map((row) => {
              const needsVerify = row.verify ?? data.fares.verify;
              const isExtraOnly =
                typeof row.extra === 'number' &&
                typeof row.oneWay !== 'number' &&
                typeof row.roundTrip !== 'number';

              return (
                <tr key={row.id} className="align-top">
                  <td className="py-1.5 pr-2 text-stone-800">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">{row.label[language]}</span>
                      {needsVerify && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 bg-amber-100 rounded-full">
                          {t.trainUnconfirmed}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5">
                      <SourceList
                        ids={row.source}
                        sources={data.sources}
                        label={t.trainSourceLabel}
                      />
                    </div>
                  </td>
                  {isExtraOnly ? (
                    <td
                      colSpan={2}
                      className="py-1.5 pl-2 text-right font-semibold text-stone-900 whitespace-nowrap"
                    >
                      +${row.extra} {data.fares.currency}
                    </td>
                  ) : (
                    <>
                      <td className="py-1.5 px-2 text-right font-semibold text-stone-900 whitespace-nowrap">
                        {typeof row.oneWay === 'number' ? `$${row.oneWay}` : '—'}
                      </td>
                      <td className="py-1.5 pl-2 text-right font-semibold text-stone-900 whitespace-nowrap">
                        {typeof row.roundTrip === 'number' ? `$${row.roundTrip}` : '—'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showActions && (
        <div className="mt-3 flex items-center gap-2">
          {onDirections ? (
            <button
              type="button"
              onClick={() => onDirections(data, selectedStation)}
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
            onClick={() => onAsk?.(data, selectedStation)}
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

export default CableCarCard;
