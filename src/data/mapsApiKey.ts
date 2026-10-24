// Llave de Google Maps compartida por el panel 2D y la ciudad 3D.
// La del build (VITE_MAPS_API_KEY) manda: una llave pegada a mano y guardada en el navegador
// solo se usa cuando el build no trae ninguna, para que una llave vieja no rompa el mapa en Render.
export const MAPS_KEY_STORAGE = 'zacatecas_maps_api_key';

export const BUILD_MAPS_API_KEY: string =
  import.meta.env.VITE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function resolveMapsApiKey(): string {
  if (BUILD_MAPS_API_KEY) return BUILD_MAPS_API_KEY;
  try {
    return localStorage.getItem(MAPS_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}
