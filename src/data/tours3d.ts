import type { SceneCamera, Tour } from '../types/scene3d';

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
];
