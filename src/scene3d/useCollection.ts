import { useCallback, useEffect, useState } from 'react';
import { recordPlaceVisit } from '../pet/visits';

const STORAGE_KEY = 'zacatecas_collection_v1';

/** placeId → fecha ISO en que se descubrió. Solo en este navegador. */
export type Collection = Record<string, string>;

function read(): Collection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Collection) : {};
  } catch {
    return {};
  }
}

export function useCollection() {
  const [collection, setCollection] = useState<Collection>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
    } catch {
      // Sin almacenamiento (modo privado): la colección vive solo en memoria.
    }
  }, [collection]);

  const discover = useCallback((placeId: string) => {
    // La mascota cuenta cada llegada a un lugar, aunque su pantalla no esté abierta.
    recordPlaceVisit(placeId);
    setCollection((prev) =>
      prev[placeId] ? prev : { ...prev, [placeId]: new Date().toISOString() },
    );
  }, []);

  const reset = useCallback(() => setCollection({}), []);

  return { collection, discover, reset };
}
