import type { Localized } from '../types/scene3d';

/** Foto de un lugar con su crédito, tal como la sirve `GET /api/py/places/{placeId}/photos` (#23). */
export interface PlacePhoto {
  id: string;
  url: string;
  author: string;
  license: string;
  sourceUrl: string;
  caption: Localized;
}

const cache = new Map<string, PlacePhoto[]>();

const isPhoto = (v: unknown): v is PlacePhoto => {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as PlacePhoto;
  return [p.id, p.url, p.author, p.license, p.sourceUrl].every((s) => typeof s === 'string') &&
    typeof p.caption?.es === 'string' && typeof p.caption?.en === 'string';
};

/** Fotos curadas de Wikimedia Commons. Sin Python o sin fotos: lista vacía y la tarjeta queda sin carrusel. */
export async function loadPlacePhotos(placeId: string): Promise<PlacePhoto[]> {
  const cached = cache.get(placeId);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/py/places/${encodeURIComponent(placeId)}/photos`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { photos?: unknown[] };
    const photos = (body.photos ?? []).filter(isPhoto);
    cache.set(placeId, photos);
    return photos;
  } catch {
    return [];
  }
}
