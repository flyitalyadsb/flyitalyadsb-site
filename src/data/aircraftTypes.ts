// Curated dataset of common aircraft types, keyed by ICAO type designator.
// Powers the programmatic SEO pages under /aeromobili and /en/aeromobili.
// `code` matches the `t` field of the live aircraft feed, so each page can show
// how many aircraft of that type FlyItalyADSB is tracking right now.

export type CategoryKey =
  | 'airliner-narrow'
  | 'airliner-wide'
  | 'regional'
  | 'turboprop'
  | 'bizjet'
  | 'ga'
  | 'military';

export interface AircraftType {
  /** URL slug, e.g. "airbus-a320" → /aeromobili/airbus-a320 */
  slug: string;
  /** ICAO type designator, matches the `t` field of the live feed, e.g. "A320". */
  code: string;
  manufacturer: string;
  model: string;
  category: CategoryKey;
  /** e.g. "2 turbofan". */
  engines: string;
  /** Year of first flight. */
  firstFlight: number;
  /** Typical passenger seating, airliners only. */
  seats?: string;
  blurbIt: string;
  blurbEn: string;
}

export const aircraftTypes: AircraftType[] = [
  // ─── Airbus narrow-body ───
  {
    slug: 'airbus-a319', code: 'A319', manufacturer: 'Airbus', model: 'A319', category: 'airliner-narrow',
    engines: '2 turbofan', firstFlight: 1995, seats: '124–156',
    blurbIt: "Versione accorciata della famiglia A320, l'A319 è un narrow-body diffuso su rotte a corto e medio raggio in tutta Europa.",
    blurbEn: "A shortened member of the A320 family, the A319 is a narrow-body widely used on short- and medium-haul routes across Europe.",
  },
  {
    slug: 'airbus-a320', code: 'A320', manufacturer: 'Airbus', model: 'A320', category: 'airliner-narrow',
    engines: '2 turbofan', firstFlight: 1987, seats: '150–186',
    blurbIt: "Uno degli aerei di linea più venduti al mondo: l'A320 è la spina dorsale del corto-medio raggio europeo ed è onnipresente nei cieli italiani.",
    blurbEn: "One of the best-selling airliners ever: the A320 is the backbone of European short- and medium-haul flying and is ubiquitous over Italy.",
  },
  {
    slug: 'airbus-a320neo', code: 'A20N', manufacturer: 'Airbus', model: 'A320neo', category: 'airliner-narrow',
    engines: '2 turbofan (new engine option)', firstFlight: 2014, seats: '150–195',
    blurbIt: "Evoluzione 'new engine option' dell'A320, con motori più efficienti e winglet sharklet: riconoscibile dal codice A20N nei dati ADS-B.",
    blurbEn: "The 'new engine option' evolution of the A320, with more efficient engines and sharklets — recognisable by the A20N code in ADS-B data.",
  },
  {
    slug: 'airbus-a321', code: 'A321', manufacturer: 'Airbus', model: 'A321', category: 'airliner-narrow',
    engines: '2 turbofan', firstFlight: 1993, seats: '185–230',
    blurbIt: "Il membro più lungo della famiglia A320 classica, usato sulle rotte più dense e da molti vettori low-cost.",
    blurbEn: "The longest member of the classic A320 family, used on the densest routes and by many low-cost carriers.",
  },
  {
    slug: 'airbus-a321neo', code: 'A21N', manufacturer: 'Airbus', model: 'A321neo', category: 'airliner-narrow',
    engines: '2 turbofan (new engine option)', firstFlight: 2016, seats: '185–244',
    blurbIt: "Il narrow-body di maggiore capacità di Airbus: nelle versioni LR e XLR apre rotte transatlantiche con un singolo corridoio.",
    blurbEn: "Airbus' highest-capacity narrow-body: in its LR and XLR versions it opens transatlantic routes on a single aisle.",
  },
  {
    slug: 'airbus-a220-300', code: 'BCS3', manufacturer: 'Airbus', model: 'A220-300', category: 'airliner-narrow',
    engines: '2 turbofan', firstFlight: 2015, seats: '130–160',
    blurbIt: "Nato come Bombardier C Series, l'A220-300 mantiene nei dati ADS-B il codice BCS3 ed è apprezzato per efficienza e silenziosità.",
    blurbEn: "Born as the Bombardier C Series, the A220-300 still carries the BCS3 code in ADS-B data and is prized for efficiency and quietness.",
  },

  // ─── Airbus wide-body ───
  {
    slug: 'airbus-a330-200', code: 'A332', manufacturer: 'Airbus', model: 'A330-200', category: 'airliner-wide',
    engines: '2 turbofan', firstFlight: 1997, seats: '210–260',
    blurbIt: "Wide-body bimotore a lungo raggio, l'A330-200 collega l'Italia a destinazioni intercontinentali con un'autonomia elevata.",
    blurbEn: "A long-haul twin-engine wide-body, the A330-200 links Italy to intercontinental destinations with long range.",
  },
  {
    slug: 'airbus-a330-900', code: 'A339', manufacturer: 'Airbus', model: 'A330-900neo', category: 'airliner-wide',
    engines: '2 turbofan (new engine option)', firstFlight: 2017, seats: '260–300',
    blurbIt: "La versione neo dell'A330, riconoscibile dalle winglet curve: è il wide-body di punta di diversi vettori europei.",
    blurbEn: "The neo version of the A330, recognisable by its curved winglets — the flagship wide-body of several European carriers.",
  },
  {
    slug: 'airbus-a350-900', code: 'A359', manufacturer: 'Airbus', model: 'A350-900', category: 'airliner-wide',
    engines: '2 turbofan', firstFlight: 2013, seats: '300–350',
    blurbIt: "Wide-body in materiali compositi di ultima generazione, l'A350-900 è uno dei lungo raggio più moderni e silenziosi in servizio.",
    blurbEn: "A latest-generation composite wide-body, the A350-900 is one of the most modern and quiet long-haul jets in service.",
  },
  {
    slug: 'airbus-a380-800', code: 'A388', manufacturer: 'Airbus', model: 'A380-800', category: 'airliner-wide',
    engines: '4 turbofan', firstFlight: 2005, seats: '500–850',
    blurbIt: "Il più grande aereo di linea passeggeri al mondo: il quadrimotore a due ponti A380 è un evento ogni volta che sorvola l'Italia.",
    blurbEn: "The largest passenger airliner in the world: the four-engine, double-deck A380 is an event every time it flies over Italy.",
  },

  // ─── Boeing narrow-body ───
  {
    slug: 'boeing-737-700', code: 'B737', manufacturer: 'Boeing', model: '737-700', category: 'airliner-narrow',
    engines: '2 turbofan', firstFlight: 1997, seats: '126–149',
    blurbIt: "Membro della famiglia 737 Next Generation, il 737-700 è un narrow-body versatile usato anche in configurazioni executive (BBJ).",
    blurbEn: "A member of the 737 Next Generation family, the 737-700 is a versatile narrow-body also used in executive (BBJ) configurations.",
  },
  {
    slug: 'boeing-737-800', code: 'B738', manufacturer: 'Boeing', model: '737-800', category: 'airliner-narrow',
    engines: '2 turbofan', firstFlight: 1997, seats: '162–189',
    blurbIt: "Il cavallo di battaglia del corto-medio raggio per i grandi vettori low-cost: il 737-800 è tra i tipi più frequenti nei cieli italiani.",
    blurbEn: "The short- and medium-haul workhorse of major low-cost carriers: the 737-800 is among the most frequent types over Italy.",
  },
  {
    slug: 'boeing-737-900', code: 'B739', manufacturer: 'Boeing', model: '737-900', category: 'airliner-narrow',
    engines: '2 turbofan', firstFlight: 2000, seats: '178–220',
    blurbIt: "La versione più lunga della 737 Next Generation, dedicata alle rotte ad alta densità di traffico.",
    blurbEn: "The longest version of the 737 Next Generation, dedicated to high-density routes.",
  },
  {
    slug: 'boeing-737-max-8', code: 'B38M', manufacturer: 'Boeing', model: '737 MAX 8', category: 'airliner-narrow',
    engines: '2 turbofan (LEAP-1B)', firstFlight: 2016, seats: '162–210',
    blurbIt: "L'ultima generazione del 737, con motori LEAP e winglet AT: nei dati ADS-B appare con il codice B38M.",
    blurbEn: "The latest 737 generation, with LEAP engines and AT winglets — it appears as B38M in ADS-B data.",
  },

  // ─── Boeing wide-body ───
  {
    slug: 'boeing-767-300', code: 'B763', manufacturer: 'Boeing', model: '767-300', category: 'airliner-wide',
    engines: '2 turbofan', firstFlight: 1986, seats: '218–290',
    blurbIt: "Wide-body bimotore di lungo corso, oggi molto usato anche come cargo: il 767-300 è ancora frequente sui voli merci sull'Italia.",
    blurbEn: "A long-haul twin-engine wide-body, today widely used as a freighter: the 767-300 is still common on cargo flights over Italy.",
  },
  {
    slug: 'boeing-777-200', code: 'B772', manufacturer: 'Boeing', model: '777-200', category: 'airliner-wide',
    engines: '2 turbofan', firstFlight: 1994, seats: '300–350',
    blurbIt: "Wide-body bimotore a lungo raggio dalla grande capacità, impiegato sulle rotte intercontinentali più trafficate.",
    blurbEn: "A high-capacity long-haul twin-engine wide-body, used on the busiest intercontinental routes.",
  },
  {
    slug: 'boeing-777-300er', code: 'B77W', manufacturer: 'Boeing', model: '777-300ER', category: 'airliner-wide',
    engines: '2 turbofan (GE90)', firstFlight: 2003, seats: '350–400',
    blurbIt: "Uno dei bimotori più grandi al mondo, spinto dai colossali motori GE90: domina molte rotte di lungo raggio ad alta densità.",
    blurbEn: "One of the largest twinjets in the world, powered by the huge GE90 engines: it dominates many high-density long-haul routes.",
  },
  {
    slug: 'boeing-787-8', code: 'B788', manufacturer: 'Boeing', model: '787-8 Dreamliner', category: 'airliner-wide',
    engines: '2 turbofan', firstFlight: 2009, seats: '210–250',
    blurbIt: "Il primo wide-body in fibra di carbonio di Boeing: il 787-8 Dreamliner ha aperto rotte intercontinentali point-to-point più sottili.",
    blurbEn: "Boeing's first carbon-fibre wide-body: the 787-8 Dreamliner opened up thinner point-to-point intercontinental routes.",
  },
  {
    slug: 'boeing-787-9', code: 'B789', manufacturer: 'Boeing', model: '787-9 Dreamliner', category: 'airliner-wide',
    engines: '2 turbofan', firstFlight: 2013, seats: '250–290',
    blurbIt: "Versione allungata del Dreamliner, con maggiore capacità e autonomia: è il lungo raggio di riferimento di molte compagnie.",
    blurbEn: "A stretched Dreamliner with more capacity and range — the reference long-haul jet for many airlines.",
  },
  {
    slug: 'boeing-747-400', code: 'B744', manufacturer: 'Boeing', model: '747-400', category: 'airliner-wide',
    engines: '4 turbofan', firstFlight: 1988, seats: '416–524',
    blurbIt: "L'iconica 'Regina dei Cieli' a quattro motori e doppio ponte: oggi vola soprattutto come cargo, ma resta inconfondibile.",
    blurbEn: "The iconic four-engine, double-deck 'Queen of the Skies': today it flies mostly as a freighter, but stays unmistakable.",
  },
  {
    slug: 'boeing-747-8', code: 'B748', manufacturer: 'Boeing', model: '747-8', category: 'airliner-wide',
    engines: '4 turbofan', firstFlight: 2010, seats: '410–467',
    blurbIt: "L'ultima e più lunga generazione del 747, con ali ridisegnate: vola come passeggeri, cargo e in versione VIP/governativa.",
    blurbEn: "The latest and longest 747 generation, with redesigned wings: it flies as passenger, cargo and in VIP/government roles.",
  },

  // ─── Regional jets ───
  {
    slug: 'embraer-170', code: 'E170', manufacturer: 'Embraer', model: 'E170', category: 'regional',
    engines: '2 turbofan', firstFlight: 2002, seats: '70–80',
    blurbIt: "Jet regionale brasiliano della famiglia E-Jet, ideale per rotte sottili che alimentano gli hub principali.",
    blurbEn: "A Brazilian regional jet from the E-Jet family, ideal for thin routes feeding the major hubs.",
  },
  {
    slug: 'embraer-190', code: 'E190', manufacturer: 'Embraer', model: 'E190', category: 'regional',
    engines: '2 turbofan', firstFlight: 2004, seats: '96–114',
    blurbIt: "Il più diffuso degli E-Jet: l'E190 colma il divario tra regionale e narrow-body su molte rotte europee.",
    blurbEn: "The most common E-Jet: the E190 bridges the gap between regional and narrow-body on many European routes.",
  },
  {
    slug: 'embraer-195', code: 'E195', manufacturer: 'Embraer', model: 'E195', category: 'regional',
    engines: '2 turbofan', firstFlight: 2004, seats: '108–124',
    blurbIt: "La versione allungata dell'E190, e nella variante E2 uno dei jet di linea più efficienti della sua categoria.",
    blurbEn: "The stretched E190, and in its E2 variant one of the most efficient airliners in its class.",
  },
  {
    slug: 'bombardier-crj900', code: 'CRJ9', manufacturer: 'Bombardier', model: 'CRJ900', category: 'regional',
    engines: '2 turbofan', firstFlight: 2001, seats: '76–90',
    blurbIt: "Jet regionale dalla fusoliera stretta, riconoscibile dalla coda a T: usato sulle rotte di adduzione verso gli hub.",
    blurbEn: "A slim-fuselage regional jet, recognisable by its T-tail — used on feeder routes to the hubs.",
  },

  // ─── Turboprop ───
  {
    slug: 'atr-72', code: 'AT72', manufacturer: 'ATR', model: '72', category: 'turboprop',
    engines: '2 turboelica', firstFlight: 1988, seats: '68–78',
    blurbIt: "Turboelica regionale italo-francese, regina dei collegamenti con le isole minori e gli aeroporti più piccoli.",
    blurbEn: "An Italo-French regional turboprop, queen of the links to minor islands and the smallest airports.",
  },
  {
    slug: 'atr-72-600', code: 'AT76', manufacturer: 'ATR', model: '72-600', category: 'turboprop',
    engines: '2 turboelica', firstFlight: 2009, seats: '68–78',
    blurbIt: "L'ultima generazione dell'ATR 72, con avionica moderna: spina dorsale della continuità territoriale verso Sardegna e Sicilia.",
    blurbEn: "The latest ATR 72 generation, with modern avionics — the backbone of territorial continuity to Sardinia and Sicily.",
  },
  {
    slug: 'bombardier-dash-8-q400', code: 'DH8D', manufacturer: 'Bombardier', model: 'Dash 8 Q400', category: 'turboprop',
    engines: '2 turboelica', firstFlight: 1998, seats: '70–90',
    blurbIt: "Turboelica veloce ad alta capacità, riconoscibile dalla fusoliera lunga e dai grandi motori: una via di mezzo tra turboprop e jet regionale.",
    blurbEn: "A fast, high-capacity turboprop with a long fuselage and large engines — a halfway point between turboprop and regional jet.",
  },

  // ─── Business jets ───
  {
    slug: 'dassault-falcon-2000', code: 'F2TH', manufacturer: 'Dassault', model: 'Falcon 2000', category: 'bizjet',
    engines: '2 turbofan', firstFlight: 1993,
    blurbIt: "Jet executive bimotore di Dassault, frequente sugli scali turistici italiani e nei movimenti di aviazione d'affari.",
    blurbEn: "A twin-engine Dassault business jet, frequent at Italian tourist airports and in business-aviation movements.",
  },
  {
    slug: 'gulfstream-g650', code: 'GLF6', manufacturer: 'Gulfstream', model: 'G650', category: 'bizjet',
    engines: '2 turbofan', firstFlight: 2009,
    blurbIt: "Tra i jet executive a più lungo raggio al mondo: il G650 collega senza scalo destinazioni intercontinentali per l'aviazione privata di vertice.",
    blurbEn: "Among the longest-range business jets in the world: the G650 links intercontinental destinations non-stop for top-end private aviation.",
  },
  {
    slug: 'embraer-phenom-300', code: 'E55P', manufacturer: 'Embraer', model: 'Phenom 300', category: 'bizjet',
    engines: '2 turbofan', firstFlight: 2008,
    blurbIt: "Light jet executive tra i più venduti al mondo, comune nei voli charter e di aerotaxi sopra l'Italia.",
    blurbEn: "One of the best-selling light business jets in the world, common on charter and air-taxi flights over Italy.",
  },

  // ─── General aviation ───
  {
    slug: 'cessna-172', code: 'C172', manufacturer: 'Cessna', model: '172 Skyhawk', category: 'ga',
    engines: '1 a pistoni', firstFlight: 1955,
    blurbIt: "L'aereo più prodotto della storia: il Cessna 172 è il monomotore da addestramento e turismo per eccellenza, onnipresente sugli aeroclub.",
    blurbEn: "The most-produced aircraft in history: the Cessna 172 is the quintessential training and touring single, ubiquitous at flying clubs.",
  },
  {
    slug: 'piper-pa-28', code: 'P28A', manufacturer: 'Piper', model: 'PA-28 Cherokee', category: 'ga',
    engines: '1 a pistoni', firstFlight: 1960,
    blurbIt: "Monomotore ad ala bassa molto diffuso nell'aviazione generale e nelle scuole di volo italiane.",
    blurbEn: "A low-wing single very common in general aviation and Italian flight schools.",
  },
  {
    slug: 'pilatus-pc-12', code: 'PC12', manufacturer: 'Pilatus', model: 'PC-12', category: 'ga',
    engines: '1 turboelica', firstFlight: 1991,
    blurbIt: "Monomotore turboelica svizzero versatile, usato per trasporto executive, sanitario e collegamenti regionali.",
    blurbEn: "A versatile Swiss single-turboprop, used for executive, medevac and regional transport.",
  },

  // ─── Military (tracked via MLAT) ───
  {
    slug: 'eurofighter-typhoon', code: 'EUFI', manufacturer: 'Eurofighter', model: 'Typhoon', category: 'military',
    engines: '2 turbofan con postbruciatore', firstFlight: 1994,
    blurbIt: "Caccia multiruolo europeo in dotazione all'Aeronautica Militare italiana: spesso privo di ADS-B, viene tracciato grazie all'MLAT della rete.",
    blurbEn: "A European multirole fighter operated by the Italian Air Force: often without ADS-B, it is tracked thanks to the network's MLAT.",
  },
  {
    slug: 'lockheed-c-130-hercules', code: 'C130', manufacturer: 'Lockheed', model: 'C-130 Hercules', category: 'military',
    engines: '4 turboelica', firstFlight: 1954,
    blurbIt: "Quadrimotore da trasporto tattico, instancabile cavallo di battaglia delle missioni militari e umanitarie da oltre mezzo secolo.",
    blurbEn: "A four-engine tactical transport, the tireless workhorse of military and humanitarian missions for over half a century.",
  },
  {
    slug: 'airbus-a400m-atlas', code: 'A400', manufacturer: 'Airbus', model: 'A400M Atlas', category: 'military',
    engines: '4 turboelica', firstFlight: 2009,
    blurbIt: "Trasporto militare europeo di nuova generazione, riconoscibile dalle eliche controrotanti: un avvistamento sempre notevole sulla mappa.",
    blurbEn: "A new-generation European military transport, recognisable by its counter-rotating propellers — always a notable sighting on the map.",
  },
];

function kebab(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function fullName(t: AircraftType): string {
  return `${t.manufacturer} ${t.model}`;
}

export function getAircraftType(slug: string): AircraftType | undefined {
  return aircraftTypes.find((t) => t.slug === slug);
}

export const CATEGORY_ORDER: CategoryKey[] = [
  'airliner-narrow',
  'airliner-wide',
  'regional',
  'turboprop',
  'bizjet',
  'ga',
  'military',
];

/** Types grouped by category, in CATEGORY_ORDER. */
export function typesByCategory(): { category: CategoryKey; items: AircraftType[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: aircraftTypes
      .filter((t) => t.category === category)
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'it')),
  })).filter((g) => g.items.length > 0);
}

/** Other types in the same category (for internal linking). */
export function relatedTypes(t: AircraftType, n = 4): AircraftType[] {
  return aircraftTypes
    .filter((o) => o.category === t.category && o.slug !== t.slug)
    .slice(0, n);
}

export { kebab };
