import type { Localized } from '../types/scene3d';
import { getPyJson } from './pyApi';

/** Foto de un lugar con su crédito, tal como la sirve `/api/py/photos` y `/api/py/places/{placeId}/photos` (#23, #232). */
export interface PlacePhoto {
  id: string;
  placeId: string;
  lat: number;
  lng: number;
  url: string;
  thumbUrl: string;
  thumbWidth: number;
  thumbHeight: number;
  author: string;
  license: string;
  sourceUrl: string;
  caption: Localized;
  /** Temporada de la foto (#75), p. ej. "muertos". */
  season?: string | null;
}

export interface PhotoProposalInput {
  placeId: string;
  url: string;
  author: string;
  license: string;
  sourceUrl: string;
  comment?: string;
}

export type PhotoProposalResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'offline' | 'invalid' };

const PROPOSE_TIMEOUT_MS = 15_000;

const cache = new Map<string, PlacePhoto[]>();
let allPhotosCache: PlacePhoto[] | null = null;

const isPhoto = (v: unknown): v is PlacePhoto => {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as PlacePhoto;
  return (
    [p.id, p.placeId, p.url, p.thumbUrl, p.author, p.license, p.sourceUrl].every((s) => typeof s === 'string') &&
    [p.lat, p.lng, p.thumbWidth, p.thumbHeight].every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    typeof p.caption?.es === 'string' &&
    typeof p.caption?.en === 'string'
  );
};

/**
 * Fotos curadas de Wikimedia Commons; con `season`, las de esa temporada primero.
 * Sin Python (tras reintentar) o sin fotos: lista vacía y la tarjeta queda sin carrusel.
 */
export async function loadPlacePhotos(placeId: string, season?: string, signal?: AbortSignal): Promise<PlacePhoto[]> {
  const key = `${placeId}|${season ?? ''}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const query = season ? `?season=${encodeURIComponent(season)}` : '';
  // Espera a que despierte la API (Render gratis) en vez de rendirse a los 3 s.
  const body = await getPyJson<{ photos?: unknown[] }>(
    `/places/${encodeURIComponent(placeId)}/photos${query}`,
    signal,
  );
  if (!body) return [];
  const photos = (body.photos ?? []).filter(isPhoto);
  cache.set(key, photos);
  return photos;
}

/** Todas las fotos publicadas para las tarjetas flotantes de la ciudad 3D (#232); sin Python devuelve `[]`. */
export async function loadAllPhotos(signal?: AbortSignal): Promise<PlacePhoto[]> {
  if (allPhotosCache) return allPhotosCache;
  const body = await getPyJson<{ photos?: unknown[] }>('/photos', signal);
  if (!body) return [];
  const photos = (body.photos ?? []).filter(isPhoto);
  allPhotosCache = photos;
  return photos;
}

/**
 * Envía una propuesta de foto para revisión (#232). Sin reintentos en el POST.
 * PROTO: las propuestas se guardan en memoria del servidor con status "pending".
 */
export async function proposePhoto(
  body: PhotoProposalInput,
  signal?: AbortSignal,
): Promise<PhotoProposalResult> {
  try {
    const timeout = AbortSignal.timeout(PROPOSE_TIMEOUT_MS);
    const res = await fetch('/api/py/photos/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (res.ok) {
      const data = (await res.json()) as { id?: unknown };
      return { ok: true, id: typeof data.id === 'string' ? data.id : '' };
    }
    if (res.status >= 400 && res.status < 500) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: false, reason: 'offline' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}
