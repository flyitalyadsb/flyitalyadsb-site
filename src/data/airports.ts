// Curated dataset of major Italian airports.
// Powers the programmatic SEO pages under /aeroporti and /en/aeroporti.
// Coordinates are used to center the live map and to count aircraft within a
// radius (server-side, via dati.flyitalyadsb.com/api/count?lat&lon&radius).

export interface Airport {
  /** URL slug, e.g. "roma-fiumicino" → /aeroporti/roma-fiumicino */
  slug: string;
  icao: string;
  iata: string;
  /** Official name without the city prefix duplication, e.g. "Leonardo da Vinci". */
  name: string;
  city: string;
  region: string;
  lat: number;
  lon: number;
  blurbIt: string;
  blurbEn: string;
}

export const RADIUS_KM = 80;

export const airports: Airport[] = [
  {
    slug: 'roma-fiumicino', icao: 'LIRF', iata: 'FCO', name: 'Leonardo da Vinci',
    city: 'Roma', region: 'Lazio', lat: 41.8003, lon: 12.2389,
    blurbIt: "Il principale scalo italiano e hub di ITA Airways: smista la maggior parte del traffico intercontinentale del Paese, con un flusso continuo di lungo raggio sopra il litorale laziale.",
    blurbEn: "Italy's busiest airport and ITA Airways' hub: it handles most of the country's intercontinental traffic, with a steady stream of long-haul flights over the Lazio coast.",
  },
  {
    slug: 'roma-ciampino', icao: 'LIRA', iata: 'CIA', name: 'Giovan Battista Pastine',
    city: 'Roma', region: 'Lazio', lat: 41.7994, lon: 12.5949,
    blurbIt: "Lo scalo low-cost e cargo di Roma, base storica di Ryanair, è anche un punto di transito per voli di Stato e aviazione esecutiva.",
    blurbEn: "Rome's low-cost and cargo airport, a historic Ryanair base, is also a transit point for government flights and business aviation.",
  },
  {
    slug: 'milano-malpensa', icao: 'LIMC', iata: 'MXP', name: 'Malpensa',
    city: 'Milano', region: 'Lombardia', lat: 45.6306, lon: 8.7281,
    blurbIt: "Il maggiore aeroporto del Nord Italia e principale gateway cargo del Paese: intenso traffico intercontinentale e merci sopra l'alto Milanese e il Ticino.",
    blurbEn: "Northern Italy's largest airport and the country's main cargo gateway: heavy intercontinental and freight traffic over the upper Milan area and the Ticino.",
  },
  {
    slug: 'milano-linate', icao: 'LIML', iata: 'LIN', name: 'Enrico Forlanini',
    city: 'Milano', region: 'Lombardia', lat: 45.4451, lon: 9.2767,
    blurbIt: "Lo scalo cittadino di Milano, dedicato a rotte business e nazionali a corto raggio, con avvicinamenti a bassa quota sopra l'area metropolitana.",
    blurbEn: "Milan's city airport, focused on short-haul business and domestic routes, with low-altitude approaches over the metropolitan area.",
  },
  {
    slug: 'bergamo-orio-al-serio', icao: 'LIME', iata: 'BGY', name: 'Il Caravaggio',
    city: 'Bergamo', region: 'Lombardia', lat: 45.6739, lon: 9.7042,
    blurbIt: "Principale base italiana di Ryanair e uno dei maggiori hub cargo notturni d'Europa: traffico fittissimo a tutte le ore sopra la pianura bergamasca.",
    blurbEn: "Ryanair's main Italian base and one of Europe's busiest night cargo hubs: very dense traffic around the clock over the Bergamo plain.",
  },
  {
    slug: 'venezia-marco-polo', icao: 'LIPZ', iata: 'VCE', name: 'Marco Polo',
    city: 'Venezia', region: 'Veneto', lat: 45.5053, lon: 12.3519,
    blurbIt: "Il terzo scalo intercontinentale del Nord Italia, con avvicinamenti spettacolari sopra la laguna veneta e un forte traffico turistico stagionale.",
    blurbEn: "Northern Italy's third intercontinental airport, with spectacular approaches over the Venetian lagoon and strong seasonal tourist traffic.",
  },
  {
    slug: 'treviso', icao: 'LIPH', iata: 'TSF', name: 'Antonio Canova',
    city: 'Treviso', region: 'Veneto', lat: 45.6484, lon: 12.1944,
    blurbIt: "Lo scalo low-cost a servizio di Venezia, base Ryanair con traffico point-to-point europeo sopra la campagna trevigiana.",
    blurbEn: "The low-cost airport serving Venice, a Ryanair base with European point-to-point traffic over the Treviso countryside.",
  },
  {
    slug: 'verona-villafranca', icao: 'LIPX', iata: 'VRN', name: 'Valerio Catullo',
    city: 'Verona', region: 'Veneto', lat: 45.3957, lon: 10.8885,
    blurbIt: "Gateway del Lago di Garda, combina voli di linea, charter turistici e una vivace attività cargo ai piedi delle Prealpi venete.",
    blurbEn: "Gateway to Lake Garda, combining scheduled flights, tourist charters and lively cargo activity at the foot of the Venetian Prealps.",
  },
  {
    slug: 'bologna', icao: 'LIPE', iata: 'BLQ', name: 'Guglielmo Marconi',
    city: 'Bologna', region: 'Emilia-Romagna', lat: 44.5354, lon: 11.2887,
    blurbIt: "Il maggiore aeroporto dell'Emilia-Romagna, crocevia di rotte europee e collegamenti business al centro della pianura padana.",
    blurbEn: "Emilia-Romagna's largest airport, a crossroads of European routes and business links in the heart of the Po Valley.",
  },
  {
    slug: 'rimini', icao: 'LIPR', iata: 'RMI', name: 'Federico Fellini',
    city: 'Rimini', region: 'Emilia-Romagna', lat: 44.0203, lon: 12.6117,
    blurbIt: "Scalo della Riviera romagnola, con forte stagionalità estiva e voli charter dall'Est Europa lungo la costa adriatica.",
    blurbEn: "The Romagna Riviera's airport, strongly seasonal in summer with charter flights from Eastern Europe along the Adriatic coast.",
  },
  {
    slug: 'napoli-capodichino', icao: 'LIRN', iata: 'NAP', name: 'Ugo Niutta',
    city: 'Napoli', region: 'Campania', lat: 40.8860, lon: 14.2908,
    blurbIt: "Lo scalo più trafficato del Sud Italia, incastonato nel tessuto urbano partenopeo con avvicinamenti a vista sul Vesuvio e sul golfo.",
    blurbEn: "Southern Italy's busiest airport, set within Naples' urban fabric with visual approaches over Vesuvius and the bay.",
  },
  {
    slug: 'catania-fontanarossa', icao: 'LICC', iata: 'CTA', name: 'Vincenzo Bellini',
    city: 'Catania', region: 'Sicilia', lat: 37.4668, lon: 15.0664,
    blurbIt: "Il principale aeroporto della Sicilia, ai piedi dell'Etna: alto traffico turistico e di continuità territoriale verso la penisola.",
    blurbEn: "Sicily's main airport, at the foot of Mount Etna: high tourist traffic and mainland connectivity flights.",
  },
  {
    slug: 'palermo-punta-raisi', icao: 'LICJ', iata: 'PMO', name: 'Falcone-Borsellino',
    city: 'Palermo', region: 'Sicilia', lat: 38.1759, lon: 13.0910,
    blurbIt: "Scalo della Sicilia occidentale stretto tra mare e montagna a Punta Raisi, con avvicinamenti suggestivi lungo la costa tirrenica.",
    blurbEn: "Western Sicily's airport, squeezed between sea and mountain at Punta Raisi, with scenic approaches along the Tyrrhenian coast.",
  },
  {
    slug: 'trapani-birgi', icao: 'LICT', iata: 'TPS', name: 'Vincenzo Florio',
    city: 'Trapani', region: 'Sicilia', lat: 37.9114, lon: 12.4880,
    blurbIt: "Aeroporto della Sicilia estrema, a uso misto civile e militare, con voli low-cost verso l'Italia e l'Europa sopra le saline trapanesi.",
    blurbEn: "An airport in far-western Sicily, in mixed civil-military use, with low-cost flights to Italy and Europe over the Trapani salt pans.",
  },
  {
    slug: 'cagliari-elmas', icao: 'LIEE', iata: 'CAG', name: 'Mario Mameli',
    city: 'Cagliari', region: 'Sardegna', lat: 39.2515, lon: 9.0543,
    blurbIt: "Il principale scalo della Sardegna, cardine della continuità territoriale con la penisola e gateway turistico del Sud dell'isola.",
    blurbEn: "Sardinia's main airport, the cornerstone of mainland territorial continuity and the tourist gateway to the south of the island.",
  },
  {
    slug: 'olbia-costa-smeralda', icao: 'LIEO', iata: 'OLB', name: 'Costa Smeralda',
    city: 'Olbia', region: 'Sardegna', lat: 40.8987, lon: 9.5176,
    blurbIt: "Porta d'accesso alla Costa Smeralda, registra picchi estremi di aviazione privata e jet executive durante l'estate gallurese.",
    blurbEn: "The gateway to the Costa Smeralda, it sees extreme peaks of private aviation and business jets during the Gallura summer.",
  },
  {
    slug: 'alghero', icao: 'LIEA', iata: 'AHO', name: 'Riviera del Corallo',
    city: 'Alghero', region: 'Sardegna', lat: 40.6321, lon: 8.2908,
    blurbIt: "Scalo del Nord-Ovest sardo, snodo della continuità territoriale e dei voli low-cost sopra la Riviera del Corallo.",
    blurbEn: "North-western Sardinia's airport, a hub for territorial continuity and low-cost flights over the Coral Riviera.",
  },
  {
    slug: 'torino-caselle', icao: 'LIMF', iata: 'TRN', name: 'Sandro Pertini',
    city: 'Torino', region: 'Piemonte', lat: 45.2008, lon: 7.6496,
    blurbIt: "Lo scalo del capoluogo piemontese, con avvicinamenti sullo sfondo delle Alpi e traffico misto di linea, charter sciistici e aviazione generale.",
    blurbEn: "Turin's airport, with approaches against the Alpine backdrop and mixed scheduled, ski-charter and general-aviation traffic.",
  },
  {
    slug: 'genova', icao: 'LIMJ', iata: 'GOA', name: 'Cristoforo Colombo',
    city: 'Genova', region: 'Liguria', lat: 44.4133, lon: 8.8375,
    blurbIt: "Aeroporto costruito su una penisola artificiale nel mar Ligure, con una pista che si protende sull'acqua e avvicinamenti lungo il porto.",
    blurbEn: "An airport built on an artificial peninsula in the Ligurian Sea, with a runway reaching over the water and approaches along the harbour.",
  },
  {
    slug: 'pisa', icao: 'LIRP', iata: 'PSA', name: 'Galileo Galilei',
    city: 'Pisa', region: 'Toscana', lat: 43.6839, lon: 10.3927,
    blurbIt: "Il principale scalo della Toscana, a uso civile e militare, gateway per Firenze e la costa tirrenica con forte traffico low-cost.",
    blurbEn: "Tuscany's main airport, in civil-military use, a gateway to Florence and the Tyrrhenian coast with strong low-cost traffic.",
  },
  {
    slug: 'firenze-peretola', icao: 'LIRQ', iata: 'FLR', name: 'Amerigo Vespucci',
    city: 'Firenze', region: 'Toscana', lat: 43.8100, lon: 11.2051,
    blurbIt: "Lo scalo cittadino di Firenze, noto per la pista corta e gli avvicinamenti tecnici tra le colline, dedicato a rotte business europee.",
    blurbEn: "Florence's city airport, known for its short runway and technical approaches between the hills, focused on European business routes.",
  },
  {
    slug: 'bari', icao: 'LIBD', iata: 'BRI', name: 'Karol Wojtyła',
    city: 'Bari', region: 'Puglia', lat: 41.1389, lon: 16.7606,
    blurbIt: "Il maggiore aeroporto della Puglia, hub del Sud-Est adriatico con voli di linea, low-cost e collegamenti verso i Balcani.",
    blurbEn: "Puglia's largest airport, a hub for the south-eastern Adriatic with scheduled, low-cost and Balkan connections.",
  },
  {
    slug: 'brindisi', icao: 'LIBR', iata: 'BDS', name: 'Papola Casale',
    city: 'Brindisi', region: 'Puglia', lat: 40.6576, lon: 17.9470,
    blurbIt: "Scalo del Salento, a uso misto civile e militare, porta d'accesso alle coste pugliesi con forte traffico estivo.",
    blurbEn: "The Salento's airport, in mixed civil-military use, a gateway to the Apulian coast with strong summer traffic.",
  },
  {
    slug: 'lamezia-terme', icao: 'LICA', iata: 'SUF', name: 'Lamezia Terme',
    city: 'Lamezia Terme', region: 'Calabria', lat: 38.9054, lon: 16.2423,
    blurbIt: "Il principale scalo della Calabria, sull'istmo tra i due mari, snodo della continuità territoriale e del traffico turistico estivo.",
    blurbEn: "Calabria's main airport, on the isthmus between two seas, a hub for territorial continuity and summer tourist traffic.",
  },
  {
    slug: 'reggio-calabria', icao: 'LICR', iata: 'REG', name: 'Tito Minniti',
    city: 'Reggio Calabria', region: 'Calabria', lat: 38.0712, lon: 15.6516,
    blurbIt: "Aeroporto affacciato sullo Stretto di Messina, celebre per gli avvicinamenti impegnativi con vento di traverso tra mare e montagna.",
    blurbEn: "An airport overlooking the Strait of Messina, famous for its demanding crosswind approaches between sea and mountain.",
  },
  {
    slug: 'pescara', icao: 'LIBP', iata: 'PSR', name: "Abruzzo",
    city: 'Pescara', region: 'Abruzzo', lat: 42.4317, lon: 14.1811,
    blurbIt: "Il principale scalo dell'Abruzzo, sulla costa adriatica, con voli low-cost e charter sopra il litorale pescarese.",
    blurbEn: "Abruzzo's main airport, on the Adriatic coast, with low-cost and charter flights over the Pescara shoreline.",
  },
  {
    slug: 'perugia', icao: 'LIRZ', iata: 'PEG', name: "San Francesco d'Assisi",
    city: 'Perugia', region: 'Umbria', lat: 43.0959, lon: 12.5132,
    blurbIt: "Il piccolo scalo dell'Umbria nella valle del Tevere, dedicato a rotte point-to-point e al pellegrinaggio verso Assisi.",
    blurbEn: "Umbria's small airport in the Tiber valley, dedicated to point-to-point routes and pilgrimage traffic to Assisi.",
  },
  {
    slug: 'trieste', icao: 'LIPQ', iata: 'TRS', name: 'Trieste Friuli Venezia Giulia',
    city: 'Ronchi dei Legionari', region: 'Friuli-Venezia Giulia', lat: 45.8275, lon: 13.4722,
    blurbIt: "Lo scalo del Nord-Est al confine sloveno, integrato con ferrovia e porto, a servizio di Trieste, Udine e Gorizia.",
    blurbEn: "The north-east's airport near the Slovenian border, integrated with rail and port, serving Trieste, Udine and Gorizia.",
  },
];

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function fullName(a: Airport): string {
  return `${a.city} ${a.name}`;
}

export function getAirport(slug: string): Airport | undefined {
  return airports.find((a) => a.slug === slug);
}

/** Airports grouped by region, regions sorted alphabetically (IT collation). */
export function airportsByRegion(): { region: string; items: Airport[] }[] {
  const map = new Map<string, Airport[]>();
  for (const a of airports) {
    if (!map.has(a.region)) map.set(a.region, []);
    map.get(a.region)!.push(a);
  }
  return [...map.entries()]
    .sort((x, y) => x[0].localeCompare(y[0], 'it'))
    .map(([region, items]) => ({
      region,
      items: items.sort((x, y) => fullName(x).localeCompare(fullName(y), 'it')),
    }));
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** The `n` closest other airports to the given one. */
export function nearbyAirports(a: Airport, n = 4): Airport[] {
  return airports
    .filter((o) => o.slug !== a.slug)
    .map((o) => ({ o, d: haversineKm(a.lat, a.lon, o.lat, o.lon) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map((x) => x.o);
}

export { norm };
