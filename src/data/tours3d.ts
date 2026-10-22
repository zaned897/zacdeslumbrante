import type { SceneCamera, Tour, TourStop } from '../types/scene3d';

// Vista inicial: el centro histórico desde el suroeste, con la Bufa al fondo.
export const ZACATECAS_3D_HOME: SceneCamera = {
  lat: 22.7754,
  lng: -102.5724,
  altitude: 2440,
  range: 1800,
  tilt: 62,
  heading: 60,
};

// PROTO: ángulos de cámara elegidos a ojo sobre las coordenadas de places.ts; afinarlos en la issue #12.
export const TOURS_3D: Tour[] = [
  {
    id: 'centro-historico-express',
    title: { es: 'Centro histórico en 2 minutos', en: 'Historic center in 2 minutes' },
    _mock: true,
    stops: [
      {
        placeId: 'cerro-de-la-bufa',
        camera: { lat: 22.7738, lng: -102.5649, altitude: 2610, range: 900, tilt: 65, heading: 250 },
        holdMillis: 2500,
        caption: {
          es: 'Cerro de la Bufa: el mirador de la ciudad y escenario de la Toma de Zacatecas (1914).',
          en: 'Cerro de la Bufa: the city lookout and site of the 1914 Battle of Zacatecas.',
        },
      },
      {
        placeId: 'catedral-zacatecas',
        camera: { lat: 22.77543, lng: -102.57242, altitude: 2440, range: 320, tilt: 70, heading: 90 },
        holdMillis: 3000,
        caption: {
          es: 'Catedral Basílica: fachada barroca labrada en cantera rosa entre 1730 y 1760.',
          en: 'Cathedral Basilica: Baroque façade carved in pink cantera stone, 1730–1760.',
        },
      },
      {
        placeId: 'teatro-calderon',
        camera: { lat: 22.7748, lng: -102.5729, altitude: 2440, range: 300, tilt: 70, heading: 30 },
        holdMillis: 2500,
        caption: {
          es: 'Teatro Calderón: joya porfiriana de estilo neorrenacentista italiano.',
          en: 'Teatro Calderón: a Porfirian gem in Italian Neo-Renaissance style.',
        },
      },
      {
        placeId: 'mina-el-eden',
        camera: { lat: 22.7778, lng: -102.5794, altitude: 2480, range: 500, tilt: 60, heading: 300 },
        holdMillis: 2500,
        caption: {
          es: 'Mina El Edén: explotada desde 1586, en pleno auge de la plata novohispana.',
          en: 'El Edén Mine: worked since 1586, at the height of New Spain’s silver boom.',
        },
      },
      {
        placeId: 'acueducto-el-cubo',
        camera: { lat: 22.7686, lng: -102.5694, altitude: 2430, range: 400, tilt: 65, heading: 200 },
        holdMillis: 2500,
        caption: {
          es: 'Acueducto El Cubo: arquería de cantera rosa que llevaba agua a la ciudad.',
          en: 'El Cubo Aqueduct: pink-stone arches that once carried water into the city.',
        },
      },
    ],
  },
  {
    id: 'ruta-de-la-plata',
    title: { es: 'Ruta de la plata', en: 'Silver route' },
    _mock: true,
    stops: [
      {
        placeId: 'mina-el-eden',
        camera: { lat: 22.7778, lng: -102.5794, altitude: 2480, range: 450, tilt: 62, heading: 300 },
        holdMillis: 3000,
        caption: {
          es: 'Mina El Edén: explotada desde 1586, durante el auge de la plata novohispana.',
          en: 'El Edén Mine: operated since 1586, during the Spanish silver boom.',
        },
      },
      {
        placeId: 'teleferico-zacatecas',
        camera: { lat: 22.7782, lng: -102.5775, altitude: 2500, range: 650, tilt: 60, heading: 120 },
        holdMillis: 2500,
        caption: {
          es: 'Teleférico: une el Cerro del Grillo con el Cerro de la Bufa en 7 minutos sobre el centro.',
          en: 'Cable car: links Cerro del Grillo and Cerro de la Bufa across 650 meters above the center.',
        },
      },
      {
        placeId: 'museo-rafael-coronel',
        camera: { lat: 22.7801, lng: -102.5714, altitude: 2460, range: 320, tilt: 68, heading: 200 },
        holdMillis: 2500,
        caption: {
          es: 'Museo Rafael Coronel: en las ruinas del ex-convento franciscano del siglo XVI.',
          en: 'Rafael Coronel Museum: inside the ruins of the 16th-century Franciscan monastery.',
        },
      },
      {
        placeId: 'museo-felguerez',
        camera: { lat: 22.7788, lng: -102.5737, altitude: 2455, range: 320, tilt: 68, heading: 160 },
        holdMillis: 2500,
        caption: {
          es: 'Museo Manuel Felguérez: arte abstracto en el antiguo Seminario Conciliar y penal del siglo XIX.',
          en: 'Manuel Felguérez Museum: abstract art in a former 19th-century seminary and penitentiary.',
        },
      },
      {
        placeId: 'museo-pedro-coronel',
        camera: { lat: 22.7765, lng: -102.5731, altitude: 2445, range: 300, tilt: 70, heading: 180 },
        holdMillis: 3000,
        caption: {
          es: 'Museo Pedro Coronel: el ex-Colegio Jesuita que guarda la colección que el artista legó a su tierra.',
          en: 'Pedro Coronel Museum: the former Jesuit College that holds the artist’s personal collection.',
        },
      },
    ],
  },
  {
    id: 'callejoneada',
    title: { es: 'Callejoneada por el centro', en: 'Callejoneada through the center' },
    _mock: true,
    stops: [
      {
        placeId: 'plaza-armas',
        camera: { lat: 22.7756, lng: -102.5723, altitude: 2440, range: 300, tilt: 70, heading: 180 },
        holdMillis: 3000,
        caption: {
          es: 'Plaza de Armas: la plaza principal, escenario de conciertos y callejoneadas tradicionales.',
          en: 'Plaza de Armas: the central square, flanked by the Cathedral and the Government Palace.',
        },
      },
      {
        placeId: 'teatro-calderon',
        camera: { lat: 22.7748, lng: -102.5729, altitude: 2440, range: 280, tilt: 70, heading: 30 },
        holdMillis: 2500,
        caption: {
          es: 'Teatro Calderón: joya porfiriana de estilo neorrenacentista italiano.',
          en: 'Teatro Calderón: a Porfirian jewel in Italian Renaissance style.',
        },
      },
      {
        placeId: 'catedral-zacatecas',
        camera: { lat: 22.77543, lng: -102.57242, altitude: 2440, range: 320, tilt: 70, heading: 90 },
        holdMillis: 3000,
        caption: {
          es: 'Catedral Basílica: su fachada es un retablo en piedra labrado en cantera rosa.',
          en: 'Cathedral Basilica: its façade is a stone altarpiece carved in pink cantera.',
        },
      },
    ],
  },
];

// PROTO: recorridos de temporada (#73). Solo se ofrecen en su temporada (src/data/seasons.ts)
// y no vienen de la API. Los textos no dan horarios ni lugares de altares: esos saldrían del
// programa oficial de cada año.
export const SEASONAL_TOURS_3D: Tour[] = [
  {
    id: 'altares-y-catrinas',
    title: { es: 'Altares y catrinas', en: 'Altars and catrinas' },
    season: 'muertos',
    _mock: true,
    stops: [
      {
        placeId: 'plaza-armas',
        camera: { lat: 22.7756, lng: -102.5723, altitude: 2440, range: 300, tilt: 70, heading: 180 },
        holdMillis: 3000,
        caption: {
          es: 'Demo: en Día de Muertos el centro se llena de altares y catrinas. Horarios y lugares saldrían del programa oficial del año.',
          en: 'Demo: on the Day of the Dead the center fills with altars and catrinas. Times and places would come from the official program.',
        },
      },
      {
        placeId: 'catedral-zacatecas',
        camera: { lat: 22.77543, lng: -102.57242, altitude: 2440, range: 320, tilt: 70, heading: 90 },
        holdMillis: 3000,
        caption: {
          es: 'Catedral Basílica: la cantera rosa de noche, entre papel picado y cempasúchil.',
          en: 'Cathedral Basilica: the pink cantera at night, among papel picado and marigolds.',
        },
      },
      {
        placeId: 'museo-rafael-coronel',
        camera: { lat: 22.7801, lng: -102.5714, altitude: 2460, range: 320, tilt: 68, heading: 200 },
        holdMillis: 3000,
        caption: {
          es: 'Museo Rafael Coronel: su colección de máscaras mexicanas va bien con la temporada.',
          en: 'Rafael Coronel Museum: its collection of Mexican masks suits the season.',
        },
      },
    ],
  },
];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isLocalized = (v: unknown): boolean =>
  typeof v === 'object' && v !== null && typeof (v as Tour['title']).es === 'string' && typeof (v as Tour['title']).en === 'string';

function isTourStop(v: unknown): v is TourStop {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as TourStop;
  const c = s.camera as SceneCamera | undefined;
  return (
    typeof s.placeId === 'string' &&
    isNum(s.holdMillis) &&
    isLocalized(s.caption) &&
    typeof c === 'object' && c !== null &&
    [c.lat, c.lng, c.altitude, c.range, c.tilt, c.heading].every(isNum)
  );
}

/** Valida la respuesta de la API antes de reemplazar los recorridos locales. */
function isTour(v: unknown): v is Tour {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Tour;
  return typeof t.id === 'string' && isLocalized(t.title) && Array.isArray(t.stops) && t.stops.length > 0 && t.stops.every(isTourStop);
}

/**
 * Recorridos desde la API Python (`GET /api/py/tours`, #27).
 * Si Python no está corriendo o responde algo inválido, usa TOURS_3D.
 */
export async function loadTours(): Promise<Tour[]> {
  try {
    const res = await fetch('/api/py/tours', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [...TOURS_3D, ...SEASONAL_TOURS_3D];
    const data: unknown = await res.json();
    const base = Array.isArray(data) && data.length > 0 && data.every(isTour) ? data : TOURS_3D;
    return [...base, ...SEASONAL_TOURS_3D];
  } catch {
    return [...TOURS_3D, ...SEASONAL_TOURS_3D];
  }
}
