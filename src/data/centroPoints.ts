import type { MapPoint } from '../types';
import { ZACATECAS_PLACES } from './places';

/**
 * Catálogo de puntos del Centro Histórico para el mapa (#294). Solo datos: cómo se dibujan va en
 * #295 y los filtros en #296.
 *
 * - Ubicación y nombre: OpenStreetMap (© colaboradores de OpenStreetMap, ODbL), consultado con
 *   Overpass el 2026-11-20. En callejones y plazuelas que son una línea, el punto es la mitad del
 *   trazo; en lo demás, el centro del elemento. Cuando el nombre de OSM trae una errata, `note` la
 *   dice.
 * - Museos: el directorio de datos abiertos del SIC (#85, `services/api/app/fixtures/museums.json`),
 *   con su ficha como fuente. Los que ya tienen ficha en `places.ts` no se repiten.
 * - Sin horarios, precios ni reseñas: lo que no tiene fuente no se pone.
 * - PROTO: el nivel (`tier`) es criterio del prototipo; el dueño lo ajusta.
 * - PROTO (#312): `kind` también es criterio del prototipo. Referencias: callejones chicos, fuentes y
 *   esculturas. Secretos: dos callejones reales elegidos como ejemplo; el lugar es real, que sea
 *   «secreto» no. Puntos nuevos sin fuente irían con `_mock: true`.
 */

/** El terreno de la maqueta: el mismo `bbox` que `public/data/centro-terreno.json`. */
export const CENTRO_BBOX = { west: -102.596, south: 22.756, east: -102.548, north: 22.794 } as const;

const OSM = 'https://www.openstreetmap.org';
const SIC = 'http://sic.gob.mx/ficha.php?table=museo&table_id=';

export const CENTRO_POINTS: MapPoint[] = [
  // Templos
  { id: 'parroquia-santo-domingo', name: 'Parroquia de Santo Domingo', category: 'temple', tier: 1, lat: 22.77652, lng: -102.57316, source: `${OSM}/node/5982486949`, note: 'En OSM: «Parroquia De Santo Domingo».' },
  { id: 'santuario-guadalupito', name: 'Santuario Diocesano de Nuestra Señora de Guadalupe «Guadalupito»', category: 'temple', tier: 2, lat: 22.76621, lng: -102.57843, source: `${OSM}/way/584417486` },
  { id: 'parroquia-fatima', name: 'Parroquia de Nuestra Señora de Fátima', category: 'temple', tier: 2, lat: 22.77038, lng: -102.57864, source: `${OSM}/way/625860952` },
  { id: 'templo-de-jesus', name: 'Templo de Jesús', category: 'temple', tier: 3, lat: 22.78344, lng: -102.57109, source: `${OSM}/way/556158794`, note: 'En OSM: «Templo de Jesus».' },
  { id: 'templo-de-mexicapan', name: 'Templo de Mexicapan', category: 'temple', tier: 3, lat: 22.78608, lng: -102.57055, source: `${OSM}/node/3240579270` },
  { id: 'capilla-santo-cristo', name: 'Capilla del Santo Cristo', category: 'temple', tier: 3, lat: 22.77961, lng: -102.5703, source: `${OSM}/node/7573190497` },

  // Plazas, plazuelas y jardines
  { id: 'jardin-independencia', name: 'Jardín Independencia', category: 'plaza', tier: 2, lat: 22.77137, lng: -102.57362, source: `${OSM}/way/556385753` },
  { id: 'jardin-juarez', name: 'Jardín Juárez', category: 'plaza', tier: 2, lat: 22.77305, lng: -102.57494, source: `${OSM}/way/293135803` },
  { id: 'alameda-garcia-de-la-cadena', name: 'Alameda Trinidad García de la Cadena', category: 'plaza', tier: 2, lat: 22.77387, lng: -102.57768, source: `${OSM}/way/549093459` },
  { id: 'plazuela-genaro-codina', name: 'Plazuela Genaro Codina', category: 'plaza', tier: 3, lat: 22.77266, lng: -102.5735, source: `${OSM}/way/633186000` },
  { id: 'plazuela-francisco-goitia', name: 'Plazuela Francisco Goitia', category: 'plaza', tier: 3, lat: 22.77458, lng: -102.57288, source: `${OSM}/way/1499955893` },
  { id: 'plazuela-candelario-huizar', name: 'Plazuela Candelario Huízar', category: 'plaza', tier: 3, lat: 22.77527, lng: -102.57216, source: `${OSM}/way/1499955894`, note: 'En OSM: «Plazuela Candelario Huizar».' },
  { id: 'plazuela-de-garcia', name: 'Plazuela de García', category: 'plaza', tier: 3, lat: 22.78234, lng: -102.57117, source: `${OSM}/way/749893803`, note: 'En OSM: «Plaazuela de García».' },
  { id: 'plazuela-450', name: 'Plazuela 450', category: 'plaza', tier: 3, lat: 22.78014, lng: -102.5723, source: `${OSM}/way/556155326` },
  { id: 'plaza-bicentenario', name: 'Plaza Bicentenario', category: 'plaza', tier: 3, lat: 22.76961, lng: -102.57205, source: `${OSM}/way/558011732`, note: 'En OSM: «Plaza "Bicentario".»; junto está el Monumento al Bicentenario.' },
  { id: 'jardin-de-la-madre', name: 'Jardín de la Madre', category: 'plaza', tier: 3, lat: 22.77295, lng: -102.57618, source: `${OSM}/way/292394855`, note: 'En OSM: «Jardin de la Madre».' },
  { id: 'el-jardincito', name: 'El Jardincito', category: 'plaza', tier: 3, lat: 22.77839, lng: -102.57114, source: `${OSM}/way/810033246` },

  // Miradores
  { id: 'mirador-paseo-de-la-bufa', name: 'Mirador Paseo de la Bufa', category: 'viewpoint', tier: 2, lat: 22.77387, lng: -102.56382, source: `${OSM}/way/1500785069` },

  // Mercados
  { id: 'mercado-gonzalez-ortega', name: 'Mercado González Ortega', category: 'market', tier: 1, lat: 22.77504, lng: -102.5727, source: `${OSM}/way/292460923`, note: 'En OSM: «González Ortega Mercado».' },
  { id: 'mercado-genaro-codina', name: 'Mercado Genaro Codina', category: 'market', tier: 3, lat: 22.77237, lng: -102.57351, source: `${OSM}/way/292475769` },
  { id: 'mercado-roberto-del-real', name: 'Mercado Roberto del Real Carranza', category: 'market', tier: 3, lat: 22.78651, lng: -102.56915, source: `${OSM}/way/556144768` },

  // Callejones
  { id: 'callejon-de-las-campanas', name: 'Callejón de las Campanas', category: 'alley', tier: 2, lat: 22.77565, lng: -102.57162, source: `${OSM}/way/292473085` },
  { id: 'callejon-del-beso', name: 'Callejón del Beso', category: 'alley', tier: 3, lat: 22.77885, lng: -102.56988, source: `${OSM}/way/810030915` },
  { id: 'callejon-de-veyna', name: 'Callejón de Veyna', category: 'alley', tier: 3, lat: 22.77612, lng: -102.57279, source: `${OSM}/way/292510889`, note: 'En OSM: «Callejón De Veyna».', kind: 'reference' },
  { id: 'callejon-de-la-moneda', name: 'Callejón de la Moneda', category: 'alley', tier: 3, lat: 22.77534, lng: -102.57393, source: `${OSM}/way/292460925`, kind: 'reference' },
  { id: 'callejon-de-san-agustin', name: 'Callejón de San Agustín', category: 'alley', tier: 3, lat: 22.77466, lng: -102.57438, source: `${OSM}/way/292460927`, kind: 'reference' },
  { id: 'callejon-del-mono-prieto', name: 'Callejón del Mono Prieto', category: 'alley', tier: 3, lat: 22.77481, lng: -102.5712, source: `${OSM}/way/292821911`, kind: 'secret' },
  { id: 'callejon-de-nolasco', name: 'Callejón de Nolasco', category: 'alley', tier: 3, lat: 22.7744, lng: -102.57139, source: `${OSM}/way/292283531`, kind: 'reference' },
  { id: 'callejon-del-trafico', name: 'Callejón del Tráfico', category: 'alley', tier: 3, lat: 22.77234, lng: -102.57376, source: `${OSM}/way/292458965`, kind: 'reference' },
  { id: 'callejon-de-la-bordadora', name: 'Callejón de la Bordadora', category: 'alley', tier: 3, lat: 22.77295, lng: -102.57388, source: `${OSM}/way/292458968`, kind: 'secret' },

  // Monumentos y fuentes
  { id: 'indio-triste', name: 'Indio Triste', category: 'monument', tier: 3, lat: 22.77869, lng: -102.57156, source: `${OSM}/node/5321632581`, kind: 'reference' },
  { id: 'fuente-de-los-faroles', name: 'Fuente de los Faroles', category: 'monument', tier: 3, lat: 22.77326, lng: -102.5728, source: `${OSM}/node/2960113286`, kind: 'reference' },
  { id: 'fuente-de-los-conquistadores', name: 'Fuente de los Conquistadores', category: 'monument', tier: 3, lat: 22.78006, lng: -102.57123, source: `${OSM}/way/566153212`, kind: 'reference' },

  // Espacios culturales
  { id: 'ciudadela-del-arte', name: 'Ciudadela del Arte', category: 'experience', tier: 3, lat: 22.77482, lng: -102.57413, source: `${OSM}/way/556497352` },
  { id: 'casa-de-cultura-municipal', name: 'Casa de Cultura Municipal', category: 'experience', tier: 3, lat: 22.77194, lng: -102.57355, source: `${OSM}/way/292458964` },

  // Museos del SIC (#85) dentro del terreno. Pedro Coronel, Rafael Coronel, Felguérez y Goitia ya
  // tienen ficha en places.ts. Fuera: el de la Industria de Reuniones, cuyas coordenadas del SIC caen
  // en el Palacio de Gobierno aunque su dirección es Ciudad Gobierno.
  { id: 'museo-zacatecano', name: 'Museo Zacatecano', category: 'museum', tier: 2, lat: 22.7747, lng: -102.574, source: `${SIC}657` },
  { id: 'ex-templo-de-san-agustin', name: 'Ex Templo de San Agustín', category: 'museum', tier: 2, lat: 22.77439, lng: -102.57433, source: `${SIC}649` },
  { id: 'museo-toma-de-zacatecas', name: 'Museo Toma de Zacatecas', category: 'museum', tier: 2, lat: 22.77835, lng: -102.56609, source: `${SIC}637` },
  { id: 'museo-manuel-m-ponce', name: 'Museo Manuel M. Ponce', category: 'museum', tier: 3, lat: 22.77479, lng: -102.57401, source: `${SIC}1745` },
  { id: 'sala-despacho-antonio-aguilar', name: 'Sala Despacho Antonio Aguilar Barraza', category: 'museum', tier: 3, lat: 22.7749, lng: -102.57403, source: `${SIC}1976` },
  { id: 'museo-playmohistoria', name: 'Museo Temático Playmohistoria', category: 'museum', tier: 3, lat: 22.77395, lng: -102.57417, source: `${SIC}2291` },
  { id: 'museo-rocas-y-minerales', name: 'Museo de las Rocas y Minerales', category: 'museum', tier: 3, lat: 22.7764, lng: -102.57981, source: `${SIC}345` },
  { id: 'centro-interactivo-zig-zag', name: 'Centro Interactivo de Ciencias Zig Zag', category: 'museum', tier: 3, lat: 22.76114, lng: -102.57873, source: `${SIC}1571` },
  { id: 'museo-universitario-de-ciencias', name: 'Museo Universitario de Ciencias', category: 'museum', tier: 3, lat: 22.77328, lng: -102.57512, source: `${SIC}423`, note: 'Ubicación de OSM (way 556383748), junto al Jardín Juárez, su dirección en el SIC. Las coordenadas del SIC caen a 1 km.' },
];

const dentro = (lat: number, lng: number) =>
  lat >= CENTRO_BBOX.south && lat <= CENTRO_BBOX.north && lng >= CENTRO_BBOX.west && lng <= CENTRO_BBOX.east;

/** Todos los puntos del mapa del centro: los lugares con ficha que caen en el terreno y el catálogo. */
export function centroMapPoints(): MapPoint[] {
  const conFicha = ZACATECAS_PLACES.filter((p) => dentro(p.lat, p.lng)).map<MapPoint>((p) => ({
    id: p.id,
    name: p.nameEs,
    category: p.category,
    tier: p.tier,
    lat: p.lat,
    lng: p.lng,
    source: p.officialUrl,
    placeId: p.id,
  }));
  return [...conFicha, ...CENTRO_POINTS];
}
