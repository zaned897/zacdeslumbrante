import React, { useEffect, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import type { PlacedPrize } from '../../data/placePrizes';
import { AccessoryIcon } from '../pet/AccessoryIcon';

/** Colores vivos del diseño (Propuesta O5): rosa, naranja, amarillo, verde agua, cian, violeta. */
const RAINBOW = 'conic-gradient(from 0deg, #FF4D8D, #FF8A3D, #FFE14D, #3DFFB5, #3DC9FF, #8B5CFF, #FF4D8D)';
const TOAST_MS = 3200;

const rarityLabel = (t: (typeof TRANSLATIONS)[Language], r: PlacedPrize['rarity']) =>
  r === 'legendaria' ? t.prizeLegendary : r === 'rara' ? t.prizeRare : t.prizeCommon;

/**
 * Premio menor (#313): un anillo de color sale del punto (el avatar, al centro de la vista al pasear)
 * y baja un aviso arriba con borde de degradado que gira ~3 s. No bloquea el paseo.
 */
export const PrizeToast: React.FC<{ prize: PlacedPrize; language: Language; onDone: () => void }> = ({ prize, language, onDone }) => {
  const t = TRANSLATIONS[language];
  const reduced = useReducedMotion();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current(), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 z-30" data-testid="prize-toast">
      {!reduced && (
        <motion.span
          aria-hidden="true"
          className="absolute left-1/2 top-[55%] -ml-12 -mt-12 h-24 w-24 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,225,77,0) 30%, rgba(255,138,216,.7) 45%, rgba(61,201,255,0) 62%)' }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 2.4], opacity: [1, 0] }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      )}
      <motion.div
        role="status"
        className="absolute inset-x-3 top-16 mx-auto max-w-sm overflow-hidden rounded-[20px] p-[2px] shadow-[0_10px_30px_-8px_rgba(139,92,255,.7)]"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 22 }}
      >
        {/* El borde: un degradado cónico más grande que gira detrás de la tarjeta. */}
        <motion.span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -ml-[60%] -mt-[60%] aspect-square w-[120%]"
          style={{ background: RAINBOW }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 2.4 }}
        />
        <div className="relative grid grid-cols-[44px_1fr] items-center gap-3 rounded-[18px] bg-[#140D22]/90 px-3 py-2.5 text-white backdrop-blur-md">
          <AccessoryIcon id={prize.accessory} size={44} />
          <p className="text-[11px] leading-snug text-white/85">
            <b className="block text-[13px] text-white">{t.prizeMinorTitle.replace('{name}', prize.name[language])}</b>
            {rarityLabel(t, prize.rarity)} · {prize.placeName[language]}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const SPARKS = [
  { x: '18%', y: '22%', d: 0 },
  { x: '80%', y: '18%', d: 0.4 },
  { x: '12%', y: '64%', d: 0.8 },
  { x: '86%', y: '58%', d: 0.2 },
  { x: '30%', y: '84%', d: 1.1 },
  { x: '70%', y: '80%', d: 0.6 },
];

/**
 * Premio mayor (#313): 2–3 s a pantalla completa con aura que gira lenta, anillo arcoíris con el
 * accesorio, destellos, nombre en degradado y «Ponérselo». Se cierra con el botón, un toque o Esc.
 */
export const PrizeMoment: React.FC<{ prize: PlacedPrize; language: Language; onWear: () => void; onClose: () => void }> = ({
  prize,
  language,
  onWear,
  onClose,
}) => {
  const t = TRANSLATIONS[language];
  const reduced = useReducedMotion();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handle = () => onCloseRef.current();
    dialog.addEventListener('close', handle);
    return () => {
      dialog.removeEventListener('close', handle);
      if (dialog.open) dialog.close();
    };
  }, []);
  const close = () => dialogRef.current?.close();
  const spin = (duration: number, reverse = false) =>
    reduced ? {} : { animate: { rotate: reverse ? -360 : 360 }, transition: { repeat: Infinity, ease: 'linear' as const, duration } };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={close}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-[#120B1F] p-0 text-white backdrop:bg-transparent"
      data-testid="prize-moment"
    >
      {!reduced && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[42%] -ml-[260px] -mt-[260px] h-[520px] w-[520px] rounded-full opacity-85 blur-[44px] saturate-[1.4]"
          style={{ background: RAINBOW }}
          {...spin(6)}
        />
      )}
      {!reduced &&
        SPARKS.map((s, i) => (
          <motion.i
            key={i}
            aria-hidden="true"
            className="pointer-events-none absolute block h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_#fff,0_0_20px_#FF8AD8]"
            style={{ left: s.x, top: s.y }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.6, 1.2, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.6, delay: s.d }}
          />
        ))}
      <motion.div
        className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 }}
      >
        <span className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em]">
          {rarityLabel(t, prize.rarity)} · {prize.placeName[language]}
        </span>
        <motion.div className="h-40 w-40 rounded-full p-1 shadow-[0_0_40px_rgba(255,255,255,.45)]" style={{ background: RAINBOW }} {...spin(2.4)}>
          <motion.div
            className="grid h-full w-full place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#3B2A55,#140D22)]"
            {...spin(2.4, true)}
          >
            <AccessoryIcon id={prize.accessory} size={104} />
          </motion.div>
        </motion.div>
        <h2
          id={titleId}
          className="bg-[linear-gradient(90deg,#FFE14D,#FF8AD8,#8BE9FF)] bg-clip-text font-serif text-2xl font-bold text-transparent"
        >
          {prize.name[language]}
        </h2>
        <p className="max-w-[16rem] text-sm text-white/85">{t.prizeMajorBody.replace('{place}', prize.placeName[language])}</p>
        <button
          type="button"
          autoFocus
          onClick={(e) => {
            e.stopPropagation();
            onWear();
            close();
          }}
          className="mt-1 rounded-full bg-[linear-gradient(90deg,#FFE14D,#FF8AD8,#8BE9FF)] px-5 py-2.5 text-sm font-bold text-[#120B1F] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t.prizeWear}
        </button>
        <p className="text-[11px] text-white/55">{t.prizeTapToClose}</p>
      </motion.div>
    </dialog>
  );
};
