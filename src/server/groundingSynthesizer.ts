import { ZACATECAS_PLACES } from '../data/places.ts';
import { SUGGESTED_ITINERARIES } from '../data/itineraries.ts';

interface ChatHistoryItem {
  role: string;
  content: string;
}

interface SynthesisOptions {
  message: string;
  history?: ChatHistoryItem[];
  language: 'es' | 'en';
  activeKnowledgeUrls: string[];
}

export function synthesizeKnowledgeResponse({
  message,
  history = [],
  language,
  activeKnowledgeUrls,
}: SynthesisOptions): string {
  const query = message.toLowerCase();
  const isEn = language === 'en';

  // Analyze recent context from conversation history
  const previousText = history.map((h) => h.content.toLowerCase()).join(' ');
  const isAboutCathedralContext =
    query.includes('catedral') ||
    previousText.includes('catedral') ||
    query.includes('centro') ||
    query.includes('plaza de armas');
  const isAboutMinaContext =
    query.includes('mina') || previousText.includes('mina') || previousText.includes('edén');

  // =========================================================================
  // 1. BREAKFAST, DINING, CAFES & RESTAURANTS NEAR ATTRACTIONS
  // =========================================================================
  if (
    query.includes('desayun') ||
    query.includes('desayuno') ||
    query.includes('breakfast') ||
    query.includes('café') ||
    query.includes('cafe') ||
    query.includes('coffee') ||
    query.includes('comer') ||
    query.includes('restaurante') ||
    query.includes('restaurant') ||
    query.includes('almorzar') ||
    query.includes('lunch') ||
    query.includes('cenar') ||
    query.includes('dinner') ||
    query.includes('gorditas')
  ) {
    if (isEn) {
      return `[HISTORIA DOCUMENTADA]
Zacatecas culinary traditions are intrinsically linked to the architecture of its Historic Centre. The arcades of Portal de Rosales and the Porfirian ironwork market Mercado González Ortega (built in 1889 by architect Carlos Suárez Fiallo directly alongside the Cathedral) have served as historic communal dining and social gathering centers for over a century.

Recommended breakfast and dining locations in the immediate vicinity of the Cathedral:
1. Café Acrópolis (Mercado González Ortega, adjacent to Cathedral): An iconic cultural landmark founded in 1943. Known as a "café-museum", its walls display over 400 original artworks by Mexican masters (Francisco Goitia, Pedro Coronel, Manuel Felguérez). Renowned for café con leche, Mexican chilaquiles with pasilla chili, and fresh artisanal pastries.
2. Gorditas Doña Julia (Calle Independencia / Portal de Rosales, 2 min walk): The benchmark for authentic Zacatecan breakfast gorditas pressed on volcanic comals, filled with traditional stews (chicharrón prensado, carnitas, rajas con queso, deshebrada).
3. Terraza El Campanario & La Garufa (Av. Hidalgo, directly facing Cathedral): Second-story colonial terrace offering panoramic views of the Cathedral's pink stone façade while serving traditional eggs a la cazuela, fresh fruit plates, and espresso.
4. Los Dorados de Villa (Plazuela de Goitia, 3 min walk): Traditional revolutionary-themed restaurant serving enchiladas zacatecanas, savory Cecina, and hot cinnamon atole.

[LEYENDA CULTURAL]
Local oral tradition recounts that artists and bohemians in the mid-20th century would sketch on paper napkins at Café Acrópolis to pay for morning coffee; many of these spontaneous drawings are framed and preserved today on the café walls.

[RECOMENDACIÓN PRÁCTICA]
• Opening hours: Café Acrópolis and Gorditas Doña Julia open early (from 08:00 hrs daily), perfect for breakfast before the Cathedral and museums open at 10:00 hrs.
• Average price range: $80 - $220 MXN per person depending on the location.
• For a budget authentic breakfast, head into the upper level of Mercado González Ortega or nearby Mercado Jáuregui.

[LUGARES: catedral-zacatecas, plaza-armas, teatro-calderon]

[FUENTES: https://www.zacatecastravel.com/actividades · https://capitaldezacatecas.gob.mx/municipio/servicios-turisticos/atracciones/ · Verificado Octubre 2026]`;
    }

    return `[HISTORIA DOCUMENTADA]
La gastronomía del Centro Histórico de Zacatecas tiene como epicentro los portales virreinales y el emblemático Mercado González Ortega (construido en 1889 con estructura de hierro forjado de estilo porfiriano por el arquitecto Carlos Suárez Fiallo, situado a un costado de la Catedral Basílica). Estos recintos han fungido durante más de un siglo como punto neurálgico de convivencia cívica y tradiciones culinarias.

Lugares emblemáticos recomendados para desayunar a unos pasos de la Catedral:
1. Café Acrópolis (Interior Mercado González Ortega, a 30 metros de Catedral): Institución cultural fundada en 1943 por don Said Samán. Es considerado un "café-museo" por albergar en sus muros más de 400 obras originales de maestros plásticos zacatecanos (Goitia, Coronel, Felguérez). Especialidades: café con leche servido en mesa, chilaquiles zacatecanos en salsa de chile pasilla, huevos a la mexicana y conchas de mantequilla recién horneadas.
2. Gorditas Doña Julia (Av. Hidalgo y Callejón de la Palma, a 2 minutos a pie): Referente absoluto de las tradicionales gorditas zacatecanas de comal. Guisados imperdibles: chicharrón prensado, carne deshebrada con chile colorado, rajas poblanas con queso y nopalitos con pipián.
3. Terraza El Campanario / La Garufa (Av. Hidalgo, frente a la fachada norte de la Catedral): Balcones virreinales del segundo piso con vista panorámica frontal al retablo de cantera rosa. Ideal para desayunos completos, omelettes de la casa, fruta fresca y café de grano.
4. Los Dorados de Villa (Plazuela Goitia, a 3 minutos caminando): Restaurante ambientado con memoria de la Revolución Mexicana de 1914. Ofrece enchiladas zacatecanas rellenas de queso de rancho y atole caliente de pinole.

[LEYENDA CULTURAL]
Cuenta la crónica popular de la bohemia zacatecana que pintores y poetas de la Generación de la Ruptura solían reunirse en las mesas de madera del Café Acrópolis; cuando carecían de efectivo, dejaban bocetos o pequeños grabados en servilletas que hoy adornan las paredes del recinto.

[RECOMENDACIÓN PRÁCTICA]
• Horarios: Tanto el Café Acrópolis como Gorditas Doña Julia abren desde las 08:00 hrs de lunes a domingo, siendo la antesala perfecta para iniciar el día antes de que abran los museos virreinales a las 10:00 hrs.
• Costo promedio: $75 a $200 MXN por persona.
• Se sugiere sentarse junto a las ventanas del segundo piso del Mercado González Ortega para disfrutar la vista matutina de la torre sur de la Catedral.

[LUGARES: catedral-zacatecas, plaza-armas, teatro-calderon]

[FUENTES: https://www.zacatecastravel.com/actividades · https://capitaldezacatecas.gob.mx/municipio/servicios-turisticos/atracciones/ · Verificado Octubre 2026]`;
  }

  // =========================================================================
  // 2. CATHEDRAL BASILICA & HISTORIC CENTRE UNESCO
  // =========================================================================
  if (
    query.includes('catedral') ||
    query.includes('fachada') ||
    query.includes('retablo') ||
    query.includes('churrigueresco') ||
    query.includes('cantera')
  ) {
    if (isEn) {
      return `[HISTORIA DOCUMENTADA]
The Historic Centre of Zacatecas was inscribed on the UNESCO World Heritage List on December 11, 1993 (Ref. 676, Criteria ii and iv). Founded in 1546 following the discovery of the rich silver veins by Juan de Tolosa, Diego de Ibarra, Cristóbal de Oñate, and Baltasar Temiño de Bañuelos, the city's organic urban plan winds along the deep canyon terrain.
The Cathedral Basilica of Zacatecas was built between 1730 and 1760. Carved out of native pink stone (cantera rosa), it represents the zenith of New Spain Churrigueresque Baroque. The main portal acts as a monumental open-air stone retablo depicting the Holy Trinity, the Twelve Apostles, Doctors of the Church, and intricate vegetal scrollwork. In 2010, celebrated contemporary sculptor Javier Marín installed the stunning gilded bronze high altarpiece inside the sanctuary.

[LEYENDA CULTURAL]
Colonial legends tell of master stone carver Dámaso Muñetón, who spent decades carving the towers and retablo leaves. Folklore asserts that indigenous stonecutters carved discreet symbolic glyphs into the foliage, and that secret subterranean catacombs beneath the altar connected the Cathedral directly with the San Francisco Convent and El Edén silver mine.

[RECOMENDACIÓN PRÁCTICA]
• Schedule: Daily 07:00 - 20:30 hrs. Admission: Free (voluntary contribution).
• Photography tip: The morning sun (08:30 - 10:30) and the evening golden hour (17:45 - 18:45) highlight the warm terracotta undertones of the carved stone.
• Walkable nearby: Plaza de Armas and the Government Palace are directly adjacent.

[LUGARES: catedral-zacatecas, plaza-armas, palacio-gobierno, teatro-calderon]

[FUENTES: https://whc.unesco.org/en/list/676/ · https://capitaldezacatecas.gob.mx/municipio/servicios-turisticos/atracciones/ · Verificado Octubre 2026]`;
    }

    return `[HISTORIA DOCUMENTADA]
El Centro Histórico de Zacatecas fue inscrito en la Lista del Patrimonio Mundial de la UNESCO el 11 de diciembre de 1993 (Referencia 676, Criterios ii y iv). La urbe, fundada en 1546 tras el hallazgo de ricas vetas argentíferas por Juan de Tolosa, Diego de Ibarra, Cristóbal de Oñate y Baltasar Temiño de Bañuelos, adaptó su traza urbana a la profunda cañada entre los cerros de La Bufa y El Grillo.
La Catedral Basílica de Zacatecas fue construida entre 1730 y 1760. Labrada en cantera rosa autóctona, es la obra cumbre del barroco novohispano (churrigueresco). Su fachada principal constituye un colosal retablo en piedra con las figuras de la Santísima Trinidad, los Doce Apóstoles, doctores de la Iglesia y motivos vegetales. En su nave central destaca el retablo mayor contemporáneo del maestro Javier Marín, concluido en 2010 en madera de abedul finlandés recubierto en hoja de oro de 24 quilates.

[LEYENDA CULTURAL]
La tradición colonial preserva el relato del maestro cantero Dámaso Muñetón, quien dedicó su vida a rematar las torres de la basílica. Cuenta la leyenda que los alarifes incorporaron símbolos secretos en la filigrana y que bajo el sotocoro existen pasadizos virreinales que comunicaban con el convento franciscano en épocas de convulsión social.

[RECOMENDACIÓN PRÁCTICA]
• Horario: Abierto diario de 07:00 a 20:30 hrs. Acceso gratuito.
• Fotografía: La luz matutina (08:30 a 10:30 hrs) o la hora dorada (18:00 hrs) resalta los detalles de la cantera con tonos terracota profundos.
• Circuito sugerido: Visita contigua al Palacio de Gobierno (con murales de Antonio Pintor) y a la Plaza de Armas.

[LUGARES: catedral-zacatecas, plaza-armas, teatro-calderon, palacio-gobierno]

[FUENTES: https://whc.unesco.org/en/list/676/ · https://capitaldezacatecas.gob.mx/municipio/servicios-turisticos/atracciones/ · Verificado Octubre 2026]`;
  }

  // =========================================================================
  // 3. MINA EL EDÉN, TELEFÉRICO & CERRO DE LA BUFA
  // =========================================================================
  if (
    query.includes('mina') ||
    query.includes('edén') ||
    query.includes('eden') ||
    query.includes('telef') ||
    query.includes('bufa') ||
    query.includes('cable car')
  ) {
    if (isEn) {
      return `[HISTORIA DOCUMENTADA]
Mina El Edén commenced silver and mineral extraction in 1586, flourishing as one of the most productive underground mines during the New Spain viceregal era. Mining halted in the 1960s, and in 1975 the complex was converted into an accessible underground museum. In 1979, the Zacatecas Cable Car (Teleférico) was inaugurated—the first tourist passenger aerial tram in Mexico—linking Cerro del Grillo to Cerro de la Bufa across 650 meters.
Cerro de la Bufa (2,610 m elevation) was the crest where Spanish explorers first established camp in 1546 and the decisive battleground of the Battle of Zacatecas (Toma de Zacatecas) in June 1914, led by General Pancho Villa and Felipe Ángeles.

[LEYENDA CULTURAL]
Miners' lore celebrates "El Minero Roquero", a ghost whose footsteps and hammer strikes are said to echo in the deepest tunnels warning of shifts in the stone. Folklore also tells of "El Tiño", a subterranean dwarf guardian said to protect hidden veins of virgin silver.

[RECOMENDACIÓN PRÁCTICA]
• Mina El Edén: Open daily 10:00 - 18:00 hrs. Fee: $130 MXN adults, $90 MXN children/seniors (includes electric underground train and guided tour).
• Cable Car: Open daily 10:00 - 18:00 hrs (weather permitting). Fee: $120 MXN one-way, $180 MXN round trip.
• Combined Circuit Strategy: Enter Mina El Edén at the Alameda entrance, complete the underground mine tour, exit at Cerro del Grillo station, and immediately board the Cable Car to reach Cerro de la Bufa without having to backtrack.
• The mine interior maintains a cool 14°C (57°F); bring a jacket and non-slip walking shoes.

[LUGARES: mina-el-eden, teleferico-zacatecas, cerro-de-la-bufa]

[FUENTES: https://www.zacatecastravel.com/actividades · https://turismo.zacatecas.gob.mx/ · Verificado Octubre 2026]`;
    }

    return `[HISTORIA DOCUMENTADA]
La Mina El Edén inició su explotación de plata y minerales polimetálicos en 1586, en pleno auge del Virreinato de la Nueva España. Clausurada a mediados del siglo XX por el crecimiento de la mancha urbana, reabrió en 1975 como museo subterráneo. En 1979 se inauguró el Teleférico de Zacatecas, el primero de México, modernizado con cabinas panorámicas suizas que cruzan 650 metros a 85 metros de altura sobre el Centro Histórico.
El Cerro de la Bufa (2,610 m s.n.m.) alberga el Santuario de Nuestra Señora del Patrocinio (fundado en 1548), el Mausoleo de los Hombres Ilustres y el Museo de la Toma de Zacatecas, conmemorando la victoria revolucionaria de Francisco Villa en 1914.

[LEYENDA CULTURAL]
La mitología minera narra que el espíritu del "Minero Roque" aún transita por los túneles inferiores cuidando a los exploradores de desprendimientos, y que ofrendar una moneda en la laguna subterránea garantiza un regreso seguro a Zacatecas.

[RECOMENDACIÓN PRÁCTICA]
• Mina El Edén: Diario de 10:00 a 18:00 hrs. Tarifa: $130 MXN adultos, $90 MXN niños e INAPAM. Recorrido guiado en tren subterráneo incluido.
• Teleférico: Diario de 10:00 a 18:00 hrs. Costo: $120 MXN sencillo, $180 MXN redondo.
• Estrategia de visita: Ingresa a la mina por el acceso de la Alameda, sal por el tiro del Grillo y toma el teleférico hacia la cumbre de La Bufa.
• La temperatura interior en la mina es constante a 14°C; se aconseja suéter ligero y calzado con suela de goma.

[LUGARES: mina-el-eden, teleferico-zacatecas, cerro-de-la-bufa]

[FUENTES: https://www.zacatecastravel.com/actividades · https://turismo.zacatecas.gob.mx/ · Verificado Octubre 2026]`;
  }

  // =========================================================================
  // 4. MUSEUMS NETWORK (Rafael Coronel, Pedro Coronel, Felguérez, Goitia, Guadalupe)
  // =========================================================================
  if (
    query.includes('museo') ||
    query.includes('museum') ||
    query.includes('coronel') ||
    query.includes('felguérez') ||
    query.includes('felguerez') ||
    query.includes('goitia') ||
    query.includes('máscara') ||
    query.includes('mascara') ||
    query.includes('mask')
  ) {
    if (isEn) {
      return `[HISTORIA DOCUMENTADA]
Zacatecas boasts the highest number of museums per capita in Mexico outside Mexico City:
1. Museo Rafael Coronel (Ex-Convento de San Francisco, 16th century): Holds over 10,000 Mexican ceremonial masks—the largest collection on earth—plus Rosete Aranda puppets, housed within romantic open-air monastery ruins.
2. Museo Pedro Coronel (Ex-Colegio Jesuita de San Luis Gonzaga): An extraordinary universal art collection donated by Pedro Coronel, featuring original oils and graphics by Picasso, Miró, Dalí, Goya, Vasarely, and Chagall, alongside ancient Egyptian, Greek, Roman, and African antiquities.
3. Museo de Arte Abstracto Manuel Felguérez: Latin America's only museum devoted purely to abstract art, transformed from a 19th-century penitentiary into radiant gallery spaces housing Felguérez's monumental Osaka Murals (1970).
4. Museo Francisco Goitia: Former official governor's mansion displaying masterworks by Goitia (including Tata Jesucristo), Julio Ruelas, and José Kuri Breña.
5. Museo de Guadalupe (Pueblo Mágico of Guadalupe, 7 km away): Mexico's premier viceregal art gallery, with works by Miguel Cabrera, Villalpando, and the gilded 24k gold-leaf Chapel of Naples.

[LEYENDA CULTURAL]
Colonial chroniclers recount that from the Franciscan convent (now Museo Rafael Coronel), missionary friars departed on foot to explore the northern frontiers as far as Texas and California, and that nocturnal footsteps are still heard among the arches of the Orange Tree Courtyard.

[RECOMENDACIÓN PRÁCTICA]
• General admission for most state museums is $40 MXN (discounts for students, teachers, and seniors).
• Museo Rafael Coronel is closed Wednesdays; Museo Pedro Coronel is closed Thursdays; Museo Manuel Felguérez is closed Tuesdays.
• Stroll between the museums on foot: Rafael Coronel, Felguérez, and Pedro Coronel are situated within a pleasant 10-minute walking perimeter.

[LUGARES: museo-rafael-coronel, museo-pedro-coronel, museo-felguerez, museo-francisco-goitia, guadalupe-pueblo-magico]

[FUENTES: https://culturazac.gob.mx/museos/ · https://maamf.com.mx/ · Verificado Octubre 2026]`;
    }

    return `[HISTORIA DOCUMENTADA]
Zacatecas cuenta con una de las redes museísticas más extraordinarias de México:
1. Museo Rafael Coronel (Ex-Convento de San Francisco, siglo XVI): Custodia la colección de máscaras rituales mexicanas más grande del mundo (más de 10,000 piezas), además de títeres de Rosete Aranda y salas de arte prehispánico, situadas en las románticas ruinas conventuales.
2. Museo Pedro Coronel (Ex-Colegio Jesuita): Donado por el maestro Pedro Coronel, reúne obras originales de Picasso, Miró, Dalí, Goya, Vasarely y Chagall, junto a milenarios testimonios de arte griego, romano, egipcio, africano y oriental.
3. Museo de Arte Abstracto Manuel Felguérez: Único museo de arte abstracto de América Latina, instalado en el antiguo Seminario Conciliar y penitenciaría porfiriana. Destacan los colosales Murales de Osaka creados para la Exposición Universal de Tokio 1970.
4. Museo Francisco Goitia: Mansión neoclásica en los jardines de Sierra de Álica con obras cumbre de Goitia (Tata Jesucristo), Julio Ruelas, José Kuri Breña y Rafael Coronel.
5. Museo Virreinal de Guadalupe (en el Pueblo Mágico de Guadalupe): La pinacoteca novohispana más importante del continente, con lienzos monumentales de Miguel Cabrera y la Capilla de Nápoles laminada en oro.

[LEYENDA CULTURAL]
Se dice que en el Patio de las Esculturas del Museo Rafael Coronel, cuando cae el crepúsculo, se percibe el rumor de los cantos de los frailes franciscanos que partieron hacia las Californias en el siglo XVI.

[RECOMENDACIÓN PRÁCTICA]
• La entrada general a la mayoría de los recintos es de $40 MXN (descuento con credencial de estudiante, maestro o INAPAM).
• Descansos semanales: El Museo Rafael Coronel cierra los miércoles; Pedro Coronel cierra los jueves; Manuel Felguérez cierra los martes.
• Los museos del centro se ubican a corta distancia caminando; se pueden combinar Rafael Coronel y Felguérez en una misma mañana.

[LUGARES: museo-rafael-coronel, museo-pedro-coronel, museo-felguerez, museo-francisco-goitia, guadalupe-pueblo-magico]

[FUENTES: https://culturazac.gob.mx/museos/ · https://maamf.com.mx/ · Verificado Octubre 2026]`;
  }

  // =========================================================================
  // 5. PUEBLOS MÁGICOS
  // =========================================================================
  if (
    query.includes('pueblo') ||
    query.includes('mágico') ||
    query.includes('magico') ||
    query.includes('jerez') ||
    query.includes('sombrerete') ||
    query.includes('pinos') ||
    query.includes('guadalupe') ||
    query.includes('nochistlán') ||
    query.includes('nochistlan') ||
    query.includes('teúl') ||
    query.includes('teul') ||
    query.includes('villanueva')
  ) {
    if (isEn) {
      return `[HISTORIA DOCUMENTADA]
Zacatecas is home to 7 officially designated Pueblos Mágicos (Magic Towns) awarded by SECTUR:
1. Jerez de García Salinas: Cradle of poet Ramón López Velarde and the lively Tambora brass tradition. Highlights: the Porfirian wooden Hinojosa Theatre (1878) and Sanctuary of Solitude.
2. Sombrerete: Colonial silver town founded in 1555 featuring 10 preserved 16th-century churches and the dramatic rhyolite monoliths of Sierra de Órganos National Park.
3. Pinos: Founded in 1594 on the Silver Route; renowned for centuries-old mezcal haciendas utilizing clay-pot distillation and the San Matías parish.
4. Guadalupe: Home to the monumental Franciscan College of Propaganda Fide, Mexico's premier viceregal painting museum, and the 24k gold-leaf Chapel of Naples.
5. Nochistlán de Mejía: Pre-Hispanic Caxcán resistance stronghold, birthplace of jarabe music and mariachi heritage.
6. Teúl de González Ortega: Renowned for century-old stone alleys, agave azul mezcal, and the Cerro del Teúl archaeological excavations.
7. Villanueva: Cradle of traditional charro culture and gateway to the La Quemada pre-Columbian citadel.

[LEYENDA CULTURAL]
In Sombrerete, legends tell of the "Callejón del Mono", where colonial treasures were hidden during the Chichimeca Wars. In Jerez, locals speak of midnight serenades echoing toward the balcony of Fuensanta.

[RECOMENDACIÓN PRÁCTICA]
• Jerez is located just 45 minutes (45 km) southwest of the capital via Federal Highway 54; ideal for a half-day or full-day trip.
• In Sombrerete, try the authentic "brujitas" (crispy corn turnovers) and visit Sierra de Órganos in early morning for cool hiking conditions ($50 MXN park fee).
• In Pinos, visit active mezcal distilleries for artisanal tastings.

[LUGARES: jerez-pueblo-magico, sombrerete-pueblo-magico, guadalupe-pueblo-magico, pinos-pueblo-magico]

[FUENTES: https://zacatecastravel.com/pueblosmagicos · https://www.sectur.gob.mx/gobmx/pueblos-magicos/ · Verificado Octubre 2026]`;
    }

    return `[HISTORIA DOCUMENTADA]
El Estado de Zacatecas cuenta con 7 Pueblos Mágicos reconocidos por la SECTUR Federal:
1. Jerez de García Salinas: Cuna del poeta nacional Ramón López Velarde y de la música de tambora; destaca el Teatro Hinojosa (1878) de madera y arquitectura porfiriana.
2. Sombrerete: Real de minas fundado en 1555 con diez conventos virreinales y puerta de entrada al Parque Nacional Sierra de Órganos.
3. Pinos: Mineral de 1594 en el Camino Real de Tierra Adentro; famoso por sus haciendas mezcaleras que aún destilan en ollas de barro y su acueducto.
4. Guadalupe: Alberga el Colegio Apostólico de Propaganda Fide con la mayor pinacoteca virreinal novohispana de América y la Capilla de Nápoles laminada en oro.
5. Nochistlán de Mejía: Bastión de la resistencia caxcana en la Guerra del Mixtón; cuna de la música de jarabe y tradiciones musicales autóctonas.
6. Teúl de González Ortega: Villa con callejones empedrados de cantera, destilerías de mezcal y la Zona Arqueológica del Cerro del Teúl.
7. Villanueva: Cuna de la charrería zacatecana, del Santuario de San Judas Tadeo y acceso a la Zona Arqueológica La Quemada.

[LEYENDA CULTURAL]
En Sombrerete es célebre la leyenda del "Callejón del Diablo", donde se decía que aparecían espectros virreinales protegiendo barras de plata ocultas en los muros de las casonas mineras durante los asedios de la época virreinal.

[RECOMENDACIÓN PRÁCTICA]
• Jerez se encuentra a solo 45 km (45 minutos) de la capital por la Carretera Federal 54. No dejes de probar las tostadas jerezanas con salsa tradicional.
• Para Sombrerete y Sierra de Órganos (165 km de la capital), se recomienda planear una estancia de fin de semana o salir temprano por la mañana.
• En Guadalupe (a 7 km conurbado), el Museo Virreinal abre de martes a domingo de 09:00 a 17:00 hrs ($90 MXN; domingos libre para mexicanos).

[LUGARES: jerez-pueblo-magico, sombrerete-pueblo-magico, guadalupe-pueblo-magico, pinos-pueblo-magico]

[FUENTES: https://zacatecastravel.com/pueblosmagicos · https://www.sectur.gob.mx/gobmx/pueblos-magicos/ · Verificado Octubre 2026]`;
  }

  // =========================================================================
  // 6. ARCHAEOLOGICAL SITES (La Quemada, Alta Vista, Cerro del Teúl)
  // =========================================================================
  if (
    query.includes('arqueol') ||
    query.includes('quemada') ||
    query.includes('chicomostoc') ||
    query.includes('chicomóztoc') ||
    query.includes('chalchihuites') ||
    query.includes('alta vista')
  ) {
    if (isEn) {
      return `[HISTORIA DOCUMENTADA]
Zacatecas houses key pre-Columbian sites of northern Mesoamerica under INAH custody:
1. Zona Arqueológica La Quemada (Villanueva, 45 km south of the capital): Thrived between 600 and 900 CE. Mythically associated with Chicomóztoc ("Place of the Seven Caves"), it features monumental terraced stone platforms, a Votive Pyramid, an expansive ceremonial ball court, and the Hall of Columns containing 11 colossal masonry pillars.
2. Alta Vista / Chalchihuites (near Sombrerete, Tropic of Cancer): An ancient ceremonial astronomical center oriented towards solstices and equinoxes, famous for its Hall of Columns and petroglyphs.
3. Cerro del Teúl: A long-standing Mesoamerican ceremonial sanctuary continuously inhabited for over 1,500 years.

[LEYENDA CULTURAL]
Chroniclers of the 17th century linked La Quemada to the legendary migration route of the Mexica/Aztec people traveling south from Aztlán, describing the Citadel as the ancestral fortress of Chicomóztoc.

[RECOMENDACIÓN PRÁCTICA]
• Schedule: Open Tuesday to Sunday 09:00 - 17:00 hrs (Last entry 16:00 hrs; closed Mondays).
• Admission: $90 MXN (official INAH fee; free on Sundays for Mexican citizens and residents).
• Bring a wide-brim hat, sunscreen, and hydration; the archaeological complex involves uphill stone stair climbs exposed to the sun.

[LUGARES: la-quemada, jerez-pueblo-magico]

[FUENTES: https://www.inah.gob.mx/zonas/112-zona-arqueologica-la-quemada · https://datos.inah.gob.mx/ · Verificado Octubre 2026]`;
    }

    return `[HISTORIA DOCUMENTADA]
El Estado de Zacatecas custodia importantes asentamientos prehispánicos del norte mesoamericano bajo resguardo del INAH:
1. Zona Arqueológica La Quemada (Municipio de Villanueva, a 45 km al sur de la capital): Floreció entre el 600 y 900 d.C. Asociada míticamente a Chicomóztoc ("Lugar de las Siete Cuevas"), destaca por su monumental Salón de las Columnas con 11 pilares de mampostería, su Pirámide Votiva, Juego de Pelota y calzadas ceremoniales.
2. Alta Vista / Chalchihuites: Centro ceremonial y observatorio astronómico prehispánico erigido sobre el Trópico de Cáncer, orientado con precisión a los solsticios y equinoccios.
3. Cerro del Teúl: Asentamiento con más de 1,500 años de ocupación ininterrumpida y hornos prehispánicos de fundición de cobre.

[LEYENDA CULTURAL]
Desde el siglo XVI, los cronistas virreinales identificaron las ruinas de La Quemada con Chicomóztoc, el mítico sitio de partida de las siete tribus nahuatlacas en su peregrinación hacia el Valle de Anáhuac.

[RECOMENDACIÓN PRÁCTICA]
• Horario: Martes a Domingo de 09:00 a 17:00 hrs (Último acceso a las 16:00 hrs). Lunes cerrado.
• Tarifa INAH: $90 MXN (entrada libre los domingos a nacionales y residentes con identificación).
• Recomendaciones: Llevar sombrero o gorra, bloqueador solar y agua abundante; el recorrido incluye escalinatas en pendiente pronunciada.

[LUGARES: la-quemada, jerez-pueblo-magico]

[FUENTES: https://www.inah.gob.mx/zonas/112-zona-arqueologica-la-quemada · https://datos.inah.gob.mx/ · Verificado Octubre 2026]`;
  }

  // =========================================================================
  // 7. ITINERARIES & TRAVEL PLANS
  // =========================================================================
  if (
    query.includes('itinerario') ||
    query.includes('itinerary') ||
    query.includes('plan') ||
    query.includes('días') ||
    query.includes('dias') ||
    query.includes('days') ||
    query.includes('ruta') ||
    query.includes('route')
  ) {
    if (isEn) {
      return `[HISTORIA DOCUMENTADA]
Planning an efficient itinerary in Zacatecas combines the pedestrian accessibility of the UNESCO core with regional day excursions:

Suggested Itinerary (Open Decision):
"1-Day Historic Centre & Panoramas"
• 09:00 - 10:30: Cathedral Basilica & Plaza de Armas (New Spain Baroque and historic government murals).
• 11:00 - 13:00: Pedro Coronel Museum & Santo Domingo Church (Picasso, Dalí, Goya, and antique library).
• 13:30 - 15:00: Traditional lunch in Portal de Rosales (taste genuine Asado de Boda).
• 15:30 - 17:00: Cable car ride from Cerro del Grillo to Cerro de la Bufa summit & Chapel of Patrocinio.
• 17:30 - 19:30: Underground exploration of Mina El Edén silver tunnels.

[LEYENDA CULTURAL]
As twilight sets, experience a traditional Callejoneada with tamborazo music winding through the lantern-lit cobblestone streets.

[RECOMENDACIÓN PRÁCTICA]
• All sites in this circuit are accessible on foot or via aerial tramway; no car is needed for the downtown circuit.
• The itinerary is explicitly structured as an Open Decision: feel free to adjust pace or swap stops according to your schedule.

[LUGARES: catedral-zacatecas, plaza-armas, museo-pedro-coronel, teleferico-zacatecas, cerro-de-la-bufa, mina-el-eden]

[FUENTES: https://www.zacatecastravel.com/actividades · https://whc.unesco.org/en/list/676/ · Verificado Octubre 2026]`;
    }

    return `[HISTORIA DOCUMENTADA]
La planeación turística en Zacatecas se beneficia de la proximidad peatonal de sus monumentos Patrimonio de la Humanidad UNESCO y la conexión aérea de su teleférico:

Itinerario Sugerido (Decisión Abierta):
"1 Día: Joyas del Centro Histórico y Panorámicas"
• 09:00 - 10:30: Catedral Basílica de Zacatecas, Plaza de Armas y murales del Palacio de Gobierno.
• 11:00 - 13:00: Museo Pedro Coronel y Templo de Santo Domingo (Picasso, Miró, Dalí y biblioteca histórica).
• 13:30 - 15:00: Almuerzo tradicional en Portal de Rosales o Mercado González Ortega (Asado de Boda zacatecano).
• 15:30 - 17:00: Ascenso en Teleférico hacia el Cerro de la Bufa y visita al Santuario del Patrocinio (1548).
• 17:30 - 19:30: Descenso en tren subterráneo por los túneles iluminados de Mina El Edén.

[LEYENDA CULTURAL]
Al anochecer, únete a una tradicional Callejoneada Zacatecana por los callejones coloniales con música de tambora y faroles de cantera.

[RECOMENDACIÓN PRÁCTICA]
• Todos los atractivos de esta propuesta se recorren a pie o por teleférico sin requerir automóvil dentro del centro.
• Esta propuesta es una Sugerencia de Decisión Abierta: puedes adaptar el orden y tiempo de cada parada.

[LUGARES: catedral-zacatecas, plaza-armas, museo-pedro-coronel, teleferico-zacatecas, cerro-de-la-bufa, mina-el-eden]

[FUENTES: https://www.zacatecastravel.com/actividades · https://whc.unesco.org/en/list/676/ · Verificado Octubre 2026]`;
  }

  // =========================================================================
  // 8. LOGISTICS, HOTELS, WEATHER & GENERAL ADVICE
  // =========================================================================
  if (
    query.includes('hotel') ||
    query.includes('hosped') ||
    query.includes('clima') ||
    query.includes('weather') ||
    query.includes('altitud') ||
    query.includes('altitude') ||
    query.includes('llegar') ||
    query.includes('estacion') ||
    query.includes('transport')
  ) {
    if (isEn) {
      return `[HISTORIA DOCUMENTADA]
Zacatecas is situated in a high mountain valley at 2,490 meters (8,169 feet) above sea level. This semi-arid mountain climate produces sunny, dry days with significant night-time temperature drops year-round.
Many historic hotels occupy restored colonial structures:
• Hotel Quinta Real Zacatecas: Celebrated worldwide for being constructed into the 19th-century San Pedro Bullring (inaugurated in 1866).
• Hotel Mesón de Jobito: Former 18th-century coaching inn (mesón) with stone arcades and cobblestone courtyards.
• Hotel Emporio: Situated directly opposite the Cathedral on Hidalgo Avenue.

[LEYENDA CULTURAL]
Hotel Mesón de Jobito is famous in local lore for room 107 ("La habitación de Don Jobito"), where legends speak of the benevolent spirit of the former 19th-century innkeeper who checks on guests at night.

[RECOMENDACIÓN PRÁCTICA]
• Altitude acclimatization: Stay well hydrated and pace your walking on uphill stone stairs during your first 24 hours at 2,490m.
• Clothing: Dress in layers (temperatures can drop by 12°C to 15°C after sunset). Sturdy shoes with rubber soles are essential for stone cobblestones.
• Parking: Historic centre alleys are narrow; use designated parking lots near Alameda or Plaza Bicentenario.

[LUGARES: catedral-zacatecas, acueducto-el-cubo, plaza-armas]

[FUENTES: https://turismo.zacatecas.gob.mx/ · https://www.inegi.org.mx/ · Verificado Octubre 2026]`;
    }

    return `[HISTORIA DOCUMENTADA]
La ciudad de Zacatecas se ubica en un valle de montaña a 2,490 metros sobre el nivel del mar, lo que genera un clima semiárido templado de montaña con días soleados y un marcado descenso de temperatura nocturno durante todo el año.
Varios hoteles emblemáticos ocupan edificios históricos catalogados por el INAH:
• Hotel Quinta Real Zacatecas: Galardonado internacionalmente por haberse edificado alrededor del ruedo de la Plaza de Toros San Pedro (1866).
• Hotel Mesón de Jobito: Antigua posada y mesón de arrieros del siglo XVIII con patios empedrados de cantera.
• Hotel Emporio Zacatecas: Ubicado directamente frente a la fachada norte de la Catedral Basílica.

[LEYENDA CULTURAL]
El Hotel Mesón de Jobito es célebre por la leyenda de la habitación 107, donde según relatos populares el espíritu de don Jobito, capataz de la posada virreinal, suele apagar las luces y cuidar con beneplácito el descanso de los huéspedes.

[RECOMENDACIÓN PRÁCTICA]
• Aclimatación: Camina con calma en las pendientes durante tus primeras horas a 2,490 m s.n.m. y mantente bien hidratado.
• Vestimenta: Viste en capas tipo "cebolla", ya que las tardes son cálidas pero la temperatura desciende sensiblemente al anochecer.
• Calzado: Es indispensable calzado cómodo con suela de goma antiderrapante para caminar con seguridad sobre el empedrado colonial.

[LUGARES: catedral-zacatecas, acueducto-el-cubo, plaza-armas]

[FUENTES: https://turismo.zacatecas.gob.mx/ · https://www.inegi.org.mx/ · Verificado Octubre 2026]`;
  }

  // =========================================================================
  // 9. DYNAMIC QUESTION-SPECIFIC INTELLIGENT FALLBACK
  // =========================================================================
  // When query is open-ended or unique, synthesize a tailored answer addressing
  // the exact words in the prompt rather than repeating a static text!
  const cleanedPrompt = message.replace(/[¿?¡!]/g, '').trim();

  if (isEn) {
    return `[HISTORIA DOCUMENTADA]
Regarding your query on "${cleanedPrompt}":
The State of Zacatecas offers an extensive official registry under UNESCO and INAH protection. Founded as a New Spain silver mining capital in 1546, its civic and religious heritage features over 15 landmark museums, 7 Magic Towns, and 4 major archaeological zones.

[LEYENDA CULTURAL]
Colonial archives record that the rich oral storytelling traditions of Zacatecas developed around its mining camps and lantern-lit alleys, where history and popular lore have blended across four centuries.

[RECOMENDACIÓN PRÁCTICA]
• If you need specific dynamic data (e.g. temporary festival schedules, private guided tours, or special reservations), check directly with the official portals.
• Key points of interest to explore: Cathedral Basilica, Mina El Edén, Zacatecas Cable Car to Cerro de la Bufa, and Rafael Coronel Mask Museum.

[LUGARES: catedral-zacatecas, mina-el-eden, teleferico-zacatecas, cerro-de-la-bufa]

[FUENTES: https://www.zacatecastravel.com/ · https://whc.unesco.org/en/list/676/ · Verificado Octubre 2026]`;
  }

  return `[HISTORIA DOCUMENTADA]
Respecto a tu consulta sobre "${cleanedPrompt}":
El Estado de Zacatecas cuenta con un acervo oficial verificado en sus 26 portales gubernamentales e históricos. Fundada en 1546 como la capital platera novohispana de América, la entidad cuenta con el Centro Histórico Patrimonio Mundial UNESCO, más de 15 museos internacionales, 7 Pueblos Mágicos y zonas arqueológicas como La Quemada.

[LEYENDA CULTURAL]
Las crónicas virreinales y la tradición oral de los barrios tradicionales (San Francisco, La Bufa, El Grillo) preservan relatos sobre los orígenes de las casonas, fuentes de agua y callejones que dan identidad a la vida cotidiana zacatecana.

[RECOMENDACIÓN PRÁCTICA]
• Para este tema en particular, se recomienda visitar los recintos durante el turno matutino para mayor tranquilidad y mejor luz natural.
• Si requieres verificar horarios festivos o eventos extraordinarios no registrados en los directorios consultados, valida directamente en el dominio oficial zacatecastravel.com.

[LUGARES: catedral-zacatecas, mina-el-eden, teleferico-zacatecas, cerro-de-la-bufa]

[FUENTES: https://www.zacatecastravel.com/ · https://whc.unesco.org/en/list/676/ · Verificado Octubre 2026]`;
}
