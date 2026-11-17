import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, MapPin } from 'lucide-react';
import { Language } from '../../types';
import type { Localized } from '../../types/scene3d';
import { TRANSLATIONS } from '../../data/i18n';
import { Sheet } from './Sheet';
import {
  PRICE_RANGES,
  VENDOR_KINDS,
  draftProblems,
  submitVendor,
  todayInZacatecas,
  type DraftProblem,
  type VendorDraft,
} from '../../scene3d/vendorRequest';

interface VendorFormSheetProps {
  open: boolean;
  onClose: () => void;
  language: Language;
  draft: VendorDraft;
  onChange: (draft: VendorDraft) => void;
  /** Esconde la hoja para marcar la ubicación tocando la ciudad 3D. */
  onPickSpot: () => void;
  /** La solicitud llegó: ya se puede borrar el borrador. */
  onSent: () => void;
}

const DAYS: Record<Language, { short: string[]; long: string[] }> = {
  es: {
    short: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    long: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  },
  en: {
    short: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    long: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
};

const field =
  'w-full px-4 py-2.5 text-sm bg-superficie text-carbon border border-linea rounded-xl focus:outline-none focus:border-cantera placeholder:text-tenue';
const label = 'block mb-1 text-xs font-bold text-carbon';
const chip = (on: boolean) =>
  `px-3 py-1.5 text-xs font-semibold rounded-full border cursor-pointer ${
    on ? 'bg-cantera border-cantera text-sobre-cantera' : 'bg-superficie border-linea text-carbon hover:border-cantera'
  }`;

/**
 * Hoja corta «Dar de alta un puesto» (#173). Manda la solicitud a `POST /api/py/vendors`,
 * donde queda pendiente de revisión (#172). No pide datos personales.
 */
export const VendorFormSheet: React.FC<VendorFormSheetProps> = ({
  open,
  onClose,
  language,
  draft,
  onChange,
  onPickSpot,
  onSent,
}) => {
  const t = TRANSLATIONS[language];
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // Tras el primer intento de envío, lo que falta se recalcula al escribir: la lista se va vaciando.
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<'invalid' | 'offline' | null>(null);
  const [sent, setSent] = useState<{ id: string; message: Localized | null } | null>(null);
  const photoRef = useRef<string | null>(null);

  // La vista previa de la foto vive solo en este navegador: se libera al cambiarla o al salir.
  useEffect(
    () => () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    },
    [],
  );

  const set = (patch: Partial<VendorDraft>) => {
    onChange({ ...draft, ...patch });
    setFailure(null);
  };
  const today = todayInZacatecas();
  const problems = tried ? draftProblems(draft, today) : [];
  const bad = (p: DraftProblem) => problems.includes(p);

  const pickPhoto = (file: File | undefined) => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    photoRef.current = file ? URL.createObjectURL(file) : null;
    setPhotoUrl(photoRef.current);
  };

  const submit = async () => {
    if (sending) return;
    setTried(true);
    setFailure(null);
    if (draftProblems(draft, today).length) return;
    setSending(true);
    const result = await submitVendor(draft, today);
    setSending(false);
    if (result.status === 'sent') {
      setSent({ id: result.id, message: result.message });
      pickPhoto(undefined);
      onSent();
    } else {
      setFailure(result.status);
    }
  };

  const close = () => {
    // Tras enviar, la siguiente vez la hoja abre en blanco.
    if (sent) {
      setSent(null);
      setTried(false);
    }
    onClose();
  };

  const kindLabel = {
    food: t.vendorFormKindFood,
    sweets: t.vendorFormKindSweets,
    coffee: t.vendorFormKindCoffee,
    drinks: t.vendorFormKindDrinks,
    crafts: t.vendorFormKindCrafts,
  };
  const priceLabel = { $: t.vendorFormPriceLow, $$: t.vendorFormPriceMid, $$$: t.vendorFormPriceHigh };
  const problemText: Record<DraftProblem, string> = {
    name: t.vendorFormNeedName,
    kind: t.vendorFormNeedKind,
    specialty: t.vendorFormNeedSpecialty,
    price: t.vendorFormNeedPrice,
    days: t.vendorFormNeedDays,
    hours: t.vendorFormNeedHours,
    spot: t.vendorFormNeedSpot,
    promoTitle: t.vendorFormNeedPromoTitle,
    promoUntil: t.vendorFormNeedPromoUntil,
  };

  if (sent) {
    return (
      <Sheet
        open={open}
        onClose={close}
        title={t.vendorFormSentTitle}
        closeLabel={t.closeModal}
        footer={
          <button
            type="button"
            onClick={close}
            className="w-full py-3 text-sm font-bold text-sobre-cantera bg-cantera rounded-full hover:brightness-95 cursor-pointer"
          >
            {t.vendorFormDone}
          </button>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center" data-testid="vendor-sent">
          <span className="grid place-items-center w-14 h-14 rounded-full bg-cita text-cantera">
            <Check className="w-7 h-7" />
          </span>
          <p className="text-sm text-carbon">{sent.message?.[language] ?? t.vendorFormSentBody}</p>
          {sent.id && (
            <p className="text-xs text-tenue">
              {t.vendorFormFolio}: <span className="font-mono">{sent.id}</span>
            </p>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t.vendorFormTitle}
      subtitle={t.vendorFormLede}
      closeLabel={t.closeModal}
      footer={
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending}
          className="w-full py-3 text-sm font-bold text-sobre-cantera bg-cantera rounded-full hover:brightness-95 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          {sending ? t.vendorFormSending : t.vendorFormSend}
        </button>
      }
    >
      <form
        className="flex flex-col gap-4"
        data-testid="vendor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label className={label} htmlFor="alta-nombre">
            {t.vendorFormName}
          </label>
          <input
            id="alta-nombre"
            type="text"
            maxLength={80}
            autoComplete="off"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={t.vendorFormNameHint}
            aria-invalid={bad('name')}
            className={field}
          />
        </div>

        <div>
          <p className={label} id="alta-giro">
            {t.vendorFormKind}
          </p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="alta-giro">
            {VENDOR_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={draft.kind === kind}
                onClick={() => set({ kind })}
                className={chip(draft.kind === kind)}
              >
                {kindLabel[kind]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={label} htmlFor="alta-especialidad">
            {t.vendorFormSpecialty}
          </label>
          <input
            id="alta-especialidad"
            type="text"
            maxLength={120}
            autoComplete="off"
            value={draft.specialty}
            onChange={(e) => set({ specialty: e.target.value })}
            placeholder={t.vendorFormSpecialtyHint}
            aria-invalid={bad('specialty')}
            className={field}
          />
        </div>

        <div>
          <p className={label} id="alta-precio">
            {t.vendorFormPrice}
          </p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="alta-precio">
            {PRICE_RANGES.map((price) => (
              <button
                key={price}
                type="button"
                role="radio"
                aria-checked={draft.priceRange === price}
                onClick={() => set({ priceRange: price })}
                className={chip(draft.priceRange === price)}
              >
                <span className="font-mono">{price}</span> · {priceLabel[price]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={label} id="alta-horario">
            {t.vendorFormHours}
          </p>
          <div className="flex gap-1" role="group" aria-labelledby="alta-horario">
            {DAYS[language].short.map((letter, day) => {
              const on = draft.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={DAYS[language].long[day]}
                  onClick={() => set({ days: on ? draft.days.filter((d) => d !== day) : [...draft.days, day] })}
                  className={`w-9 h-9 text-xs font-bold rounded-full border cursor-pointer ${
                    on ? 'bg-cantera border-cantera text-sobre-cantera' : 'bg-superficie border-linea text-tenue'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-tenue">
            <label htmlFor="alta-abre">
              {t.vendorFormOpens}
              <input
                id="alta-abre"
                type="time"
                value={draft.open}
                onChange={(e) => set({ open: e.target.value })}
                aria-invalid={bad('hours')}
                className={`${field} mt-0.5 px-3 py-2`}
              />
            </label>
            <label htmlFor="alta-cierra">
              {t.vendorFormCloses}
              <input
                id="alta-cierra"
                type="time"
                value={draft.close}
                onChange={(e) => set({ close: e.target.value })}
                aria-invalid={bad('hours')}
                className={`${field} mt-0.5 px-3 py-2`}
              />
            </label>
          </div>
        </div>

        <div>
          <p className={label}>{t.vendorFormSpot}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={onPickSpot}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap text-cantera bg-superficie border border-cantera rounded-full hover:bg-cita cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              {draft.spot ? t.vendorFormSpotChange : t.vendorFormSpotPick}
            </button>
            <p className="min-w-0 text-xs text-tenue" data-testid="vendor-spot">
              {draft.spot ? (
                <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                  <Check className="w-3.5 h-3.5" />
                  {t.vendorFormSpotSet}
                </span>
              ) : (
                t.vendorFormSpotHint
              )}
            </p>
          </div>
        </div>

        <div>
          <p className={label}>{t.vendorFormPhoto}</p>
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img src={photoUrl} alt={t.vendorFormPhotoAlt} className="w-14 h-14 rounded-xl object-cover border border-linea" />
            ) : (
              <span className="grid place-items-center w-14 h-14 rounded-xl bg-caliza text-tenue" aria-hidden="true">
                <Camera className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0">
              <label className="inline-block px-3 py-1.5 text-xs font-semibold text-carbon bg-superficie border border-linea rounded-full hover:border-cantera cursor-pointer">
                {photoUrl ? t.vendorFormPhotoChange : t.vendorFormPhotoPick}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                />
              </label>
              {/* PROTO: en este nivel la foto no sale del navegador; no hay dónde guardarla ni quién la modere. */}
              <p className="mt-1 text-[11px] leading-snug text-tenue">{t.vendorFormPhotoNote}</p>
            </div>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="alta-promo">
            {t.vendorFormPromo}
          </label>
          <input
            id="alta-promo"
            type="text"
            maxLength={120}
            autoComplete="off"
            value={draft.promoTitle}
            onChange={(e) => set({ promoTitle: e.target.value })}
            placeholder={t.vendorFormPromoHint}
            aria-invalid={bad('promoTitle')}
            className={field}
          />
          {draft.promoTitle.trim() !== '' && (
            <div className="mt-2 flex items-center gap-2 text-xs text-tenue">
              <label htmlFor="alta-promo-hasta">{t.vendorFormPromoUntil}</label>
              <input
                id="alta-promo-hasta"
                type="date"
                min={today}
                value={draft.promoUntil}
                onChange={(e) => set({ promoUntil: e.target.value })}
                aria-invalid={bad('promoUntil')}
                className={`${field} w-auto px-3 py-2`}
              />
            </div>
          )}
          <p className="mt-1 text-[11px] leading-snug text-tenue">{t.vendorFormPromoNote}</p>
        </div>

        <p className="px-4 py-3 text-xs leading-snug text-carbon bg-caliza rounded-xl">{t.vendorFormReview}</p>

        {problems.length > 0 && (
          <div className="px-4 py-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl" role="alert" data-testid="vendor-problems">
            <p className="font-bold">{t.vendorFormMissing}</p>
            <ul className="mt-1 list-disc pl-4">
              {problems.map((p) => (
                <li key={p}>{problemText[p]}</li>
              ))}
            </ul>
          </div>
        )}
        {failure && (
          <p className="px-4 py-3 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-xl" role="alert" data-testid="vendor-failure">
            {failure === 'offline' ? t.vendorFormOffline : t.vendorFormInvalid}
          </p>
        )}
      </form>
    </Sheet>
  );
};
