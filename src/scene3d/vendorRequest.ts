import type { Localized } from '../types/scene3d';

/** Giros y rangos de precio que acepta `POST /api/py/vendors` (#172). */
export type VendorKind = 'food' | 'sweets' | 'coffee' | 'drinks' | 'crafts';
export type PriceRange = '$' | '$$' | '$$$';
export const VENDOR_KINDS: VendorKind[] = ['food', 'sweets', 'coffee', 'drinks', 'crafts'];
export const PRICE_RANGES: PriceRange[] = ['$', '$$', '$$$'];

export interface Spot {
  lat: number;
  lng: number;
}

/** Lo que lleva escrito quien da de alta su puesto (#173). La foto no va aquí: todavía no se envía. */
export interface VendorDraft {
  name: string;
  kind: VendorKind | null;
  specialty: string;
  priceRange: PriceRange | null;
  /** 0 = lunes … 6 = domingo, como en la API. */
  days: number[];
  open: string;
  close: string;
  /** Dónde está el puesto: se marca tocando la ciudad 3D. */
  spot: Spot | null;
  promoTitle: string;
  /** AAAA-MM-DD; la promoción vale hasta el final de ese día. */
  promoUntil: string;
}

export const EMPTY_DRAFT: VendorDraft = {
  name: '',
  kind: null,
  specialty: '',
  priceRange: null,
  days: [0, 1, 2, 3, 4, 5, 6],
  open: '09:00',
  close: '18:00',
  spot: null,
  promoTitle: '',
  promoUntil: '',
};

/** La caja del Centro Histórico que acepta la API (#172); fuera de ella responde 422. */
const CENTER = { latMin: 22.76, latMax: 22.79, lngMin: -102.59, lngMax: -102.56 };

export const inCenter = (at: Spot): boolean =>
  at.lat >= CENTER.latMin && at.lat <= CENTER.latMax && at.lng >= CENTER.lngMin && at.lng <= CENTER.lngMax;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DRAFT_KEY = 'zacatecas_alta_puesto_borrador';

/** El borrador guardado en este navegador, para que no se pierda lo escrito si falla el envío o se recarga. */
export function readDraft(): VendorDraft {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (typeof raw !== 'object' || raw === null) return EMPTY_DRAFT;
    const d = raw as Partial<VendorDraft>;
    const text = (v: unknown) => (typeof v === 'string' ? v : '');
    const spot =
      d.spot && typeof d.spot.lat === 'number' && typeof d.spot.lng === 'number' && inCenter(d.spot)
        ? { lat: d.spot.lat, lng: d.spot.lng }
        : null;
    return {
      name: text(d.name),
      kind: VENDOR_KINDS.includes(d.kind as VendorKind) ? (d.kind as VendorKind) : null,
      specialty: text(d.specialty),
      priceRange: PRICE_RANGES.includes(d.priceRange as PriceRange) ? (d.priceRange as PriceRange) : null,
      days: Array.isArray(d.days)
        ? [...new Set(d.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))]
        : EMPTY_DRAFT.days,
      open: HHMM.test(text(d.open)) ? text(d.open) : EMPTY_DRAFT.open,
      close: HHMM.test(text(d.close)) ? text(d.close) : EMPTY_DRAFT.close,
      spot,
      promoTitle: text(d.promoTitle),
      promoUntil: DATE.test(text(d.promoUntil)) ? text(d.promoUntil) : '',
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(draft: VendorDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Sin almacenamiento: el borrador vive mientras la página siga abierta.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nada que borrar.
  }
}

/** Hoy en Zacatecas (UTC-6 todo el año), AAAA-MM-DD. */
export function todayInZacatecas(now: Date = new Date()): string {
  return new Date(now.getTime() - 6 * 3_600_000).toISOString().slice(0, 10);
}

export type DraftProblem =
  | 'name'
  | 'kind'
  | 'specialty'
  | 'price'
  | 'days'
  | 'hours'
  | 'spot'
  | 'promoTitle'
  | 'promoUntil';

/** Lo que falta o está mal antes de enviar; las mismas reglas que valida la API. */
export function draftProblems(draft: VendorDraft, today: string): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (draft.name.trim().length < 3) problems.push('name');
  if (!draft.kind) problems.push('kind');
  if (draft.specialty.trim().length < 3) problems.push('specialty');
  if (!draft.priceRange) problems.push('price');
  if (draft.days.length === 0) problems.push('days');
  if (!HHMM.test(draft.open) || !HHMM.test(draft.close) || draft.close <= draft.open) problems.push('hours');
  if (!draft.spot || !inCenter(draft.spot)) problems.push('spot');
  // Sin texto no hay promoción: una fecha que se haya quedado puesta no estorba, y tampoco se envía.
  const title = draft.promoTitle.trim();
  if (title) {
    if (title.length < 3) problems.push('promoTitle');
    if (!DATE.test(draft.promoUntil) || draft.promoUntil < today) problems.push('promoUntil');
  }
  return problems;
}

/** Cuerpo de `POST /api/py/vendors`. Sin contacto ni foto: la hoja no pide datos personales. */
export function toRequest(draft: VendorDraft, today: string): Record<string, unknown> {
  const title = draft.promoTitle.trim();
  return {
    name: draft.name.trim(),
    kind: draft.kind,
    specialty: draft.specialty.trim(),
    lat: draft.spot?.lat,
    lng: draft.spot?.lng,
    hours: [{ days: [...draft.days].sort((a, b) => a - b), open: draft.open, close: draft.close }],
    priceRange: draft.priceRange,
    // La promoción es información con vigencia, no un cupón (regla de #153).
    ...(title
      ? { promotion: { title, start: `${today}T00:00:00-06:00`, end: `${draft.promoUntil}T23:59:00-06:00` } }
      : {}),
  };
}

export type SubmitResult =
  | { status: 'sent'; id: string; message: Localized | null }
  /** La API rechazó los datos (422). */
  | { status: 'invalid' }
  /** Sin Python o sin red: se puede reintentar; el borrador sigue guardado. */
  | { status: 'offline' };

export async function submitVendor(draft: VendorDraft, today: string): Promise<SubmitResult> {
  try {
    const res = await fetch('/api/py/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toRequest(draft, today)),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 201) {
      const body = (await res.json()) as { id?: unknown; message?: { es?: unknown; en?: unknown } };
      const m = body.message;
      const message = m && typeof m.es === 'string' && typeof m.en === 'string' ? { es: m.es, en: m.en } : null;
      return { status: 'sent', id: typeof body.id === 'string' ? body.id : '', message };
    }
    return res.status === 422 ? { status: 'invalid' } : { status: 'offline' };
  } catch {
    return { status: 'offline' };
  }
}
