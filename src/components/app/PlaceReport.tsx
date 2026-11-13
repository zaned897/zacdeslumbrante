import React, { useEffect, useRef, useState } from 'react';
import { Heart, Users } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import {
  loadPlaceSignals,
  readRecommended,
  rememberRecommended,
  sendReport,
  type Crowd,
  type PlaceSignals,
} from '../../scene3d/placeSignals';

interface PlaceReportProps {
  place: { id: string; lat: number; lng: number };
  language: Language;
}

const CROWDS: Crowd[] = ['baja', 'media', 'alta'];

const PlaceReportBody: React.FC<PlaceReportProps> = ({ place, language }) => {
  const t = TRANSLATIONS[language];
  const [signals, setSignals] = useState<PlaceSignals | null>(null);
  const [sending, setSending] = useState<'crowd' | 'recommend' | null>(null);
  const [sentCrowd, setSentCrowd] = useState<Crowd | null>(null);
  const [recommended, setRecommended] = useState(() => readRecommended().includes(place.id));
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  // Solo cuenta la última lectura: una lenta, pedida antes de un reporte, no pisa la de después.
  const lastLoad = useRef(0);
  const refreshSignals = async () => {
    const mine = ++lastLoad.current;
    const fresh = await loadPlaceSignals(place);
    if (mine === lastLoad.current) setSignals(fresh);
  };

  useEffect(() => {
    void refreshSignals();
    return () => {
      // Al salir de la ficha, lo que siga en camino ya no cuenta.
      lastLoad.current += 1;
    };
  }, [place.id, place.lat, place.lng]);

  const crowdName: Record<Crowd, string> = {
    baja: t.reportCrowdLowText,
    media: t.reportCrowdMidText,
    alta: t.reportCrowdHighText,
  };
  const crowdButton: Record<Crowd, string> = {
    baja: t.reportCrowdLow,
    media: t.reportCrowdMid,
    alta: t.reportCrowdHigh,
  };

  const reportCrowd = async (value: Crowd) => {
    if (sending) return;
    setSending('crowd');
    const ok = await sendReport(place.id, 'crowd', value);
    if (ok) {
      setSentCrowd(value);
      await refreshSignals();
    }
    setNotice({ text: ok ? t.reportThanksCrowd : t.reportFailed, ok });
    setSending(null);
  };

  const recommend = async () => {
    if (sending || recommended) return;
    setSending('recommend');
    const ok = await sendReport(place.id, 'recommend');
    if (ok) {
      rememberRecommended(place.id);
      setRecommended(true);
      await refreshSignals();
    }
    setNotice({ text: ok ? t.reportThanksRecommend : t.reportFailed, ok });
    setSending(null);
  };

  const crowdLine = signals?.crowd
    ? (signals.signal === 'live' ? t.reportCrowdNow : t.reportCrowdUsual).replace('{crowd}', crowdName[signals.crowd]) +
      (signals.waitMin ? ` · ${t.reportWait.replace('{min}', String(signals.waitMin))}` : '')
    : null;
  // Las recomendaciones se mencionan a partir de 3 (#166).
  const recsLine =
    signals && signals.recommendations >= 3 ? t.reportRecsMany.replace('{n}', String(signals.recommendations)) : null;

  return (
    <section className="mt-3 pt-3 border-t border-stone-200" aria-label={t.reportTitle} data-testid="place-report">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-stone-800">
        <Users className="w-3.5 h-3.5 shrink-0" />
        {t.reportTitle}
      </p>
      <div className="mt-1.5 flex gap-1.5" role="group" aria-label={t.reportTitle}>
        {CROWDS.map((value) => (
          <button
            key={value}
            type="button"
            disabled={sending !== null}
            aria-pressed={sentCrowd === value}
            onClick={() => void reportCrowd(value)}
            className={`flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-full border cursor-pointer disabled:cursor-wait disabled:opacity-60 ${
              sentCrowd === value
                ? 'bg-[#9A3412] border-[#9A3412] text-white'
                : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500'
            }`}
          >
            {crowdButton[value]}
          </button>
        ))}
      </div>
      {crowdLine && (
        <p className="mt-1.5 text-[11px] leading-snug text-stone-600" data-testid="place-crowd">
          {crowdLine}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          disabled={sending !== null || recommended}
          onClick={() => void recommend()}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-full border ${
            recommended
              ? 'bg-[#EDE9FE] border-[#C4B5FD] text-[#5B21B6] cursor-default'
              : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500 cursor-pointer disabled:cursor-wait disabled:opacity-60'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${recommended ? 'fill-current' : ''}`} />
          {recommended ? t.reportRecommended : t.reportRecommend}
        </button>
        {recsLine && (
          <p className="min-w-0 text-[11px] leading-snug text-stone-600" data-testid="place-recs">
            {recsLine}
          </p>
        )}
      </div>

      <p
        className={`mt-2 text-[10px] leading-snug ${notice && !notice.ok ? 'text-red-700 font-semibold' : 'text-stone-500'}`}
        role="status"
        aria-live="polite"
        data-testid="place-report-notice"
      >
        {notice ? notice.text : t.reportAnonymous}
      </p>
    </section>
  );
};

/**
 * Reportar afluencia y recomendar una parada (#174), dentro de la ficha de un lugar.
 * Afluencia y recomendación van en renglones separados: mucha gente es espera, no calidad (#166).
 *
 * Cada lugar lleva su propio estado: si la ficha cambia de lugar con un envío en curso,
 * la respuesta del lugar anterior ya no toca la ficha nueva.
 */
export const PlaceReport: React.FC<PlaceReportProps> = (props) => <PlaceReportBody key={props.place.id} {...props} />;
