// Fake tool results for the map preview: the exact shapes aircraft_near,
// special_traffic and find_aircraft return (src/lib/mcp/tools/*.ts), with
// readsb records like the v2 API's. Deterministic (seeded), positions moved by
// dead reckoning when the preview "refreshes".

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R = Math.PI / 180;
function dest(lat, lon, km, bearing) {
  const d = km / 6371, b = bearing * R, la = lat * R, lo = lon * R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [+(la2 / R).toFixed(5), +(lo2 / R).toFixed(5)];
}
function distKm(a, b, c, d) {
  const x = Math.sin(((c - a) * R) / 2) ** 2 + Math.cos(a * R) * Math.cos(c * R) * Math.sin(((d - b) * R) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

const TYPES = {
  A20N: ['A20N', 'AIRBUS A-320neo', 'A3'], A21N: ['A21N', 'AIRBUS A-321neo', 'A3'], A320: ['A320', 'AIRBUS A-320', 'A3'],
  A319: ['A319', 'AIRBUS A-319', 'A3'], B738: ['B738', 'BOEING 737-800', 'A3'], B38M: ['B38M', 'BOEING 737 MAX 8', 'A3'],
  E190: ['E190', 'EMBRAER ERJ-190', 'A3'], E195: ['E195', 'EMBRAER ERJ-195', 'A3'], CRJ9: ['CRJ9', 'BOMBARDIER CRJ-900', 'A2'],
  AT76: ['AT76', 'ATR 72-600', 'A2'], DH8D: ['DH8D', 'DE HAVILLAND DHC-8-400', 'A2'], A359: ['A359', 'AIRBUS A-350-900', 'A5'],
  B77W: ['B77W', 'BOEING 777-300ER', 'A5'], B789: ['B789', 'BOEING 787-9', 'A5'], A333: ['A333', 'AIRBUS A-330-300', 'A5'],
  B744: ['B744', 'BOEING 747-400', 'A5'], C68A: ['C68A', 'CESSNA 680A Citation Latitude', 'A2'], GLF6: ['GLF6', 'GULFSTREAM G650', 'A2'],
  PC12: ['PC12', 'PILATUS PC-12', 'A1'], C172: ['C172', 'CESSNA 172', 'A1'], P28A: ['P28A', 'PIPER PA-28', 'A1'],
  A139: ['A139', 'LEONARDO AW139', 'A7'], EC35: ['EC35', 'AIRBUS H135', 'A7'], EUFI: ['EUFI', 'EUROFIGHTER Typhoon', 'A3'],
  C30J: ['C30J', 'LOCKHEED MARTIN C-130J Hercules', ''], K35R: ['K35R', 'BOEING KC-135R Stratotanker', 'A5'],
  C17: ['C17', 'BOEING C-17A Globemaster III', 'A5'], A400: ['A400', 'AIRBUS A400M Atlas', 'A5'], P8: ['P8', 'BOEING P-8A Poseidon', 'A3'],
  E3TF: ['E3TF', 'BOEING E-3 Sentry', 'A5'], Q9: ['Q9', 'GENERAL ATOMICS MQ-9 Reaper', 'B6'], F35: ['F35', 'LOCKHEED MARTIN F-35A', ''],
  M346: ['M346', 'LEONARDO M-346', 'A6'], MRTT: ['A332', 'AIRBUS A330 MRTT', 'A5'],
};

const AIRLINES = ['ITY', 'RYR', 'WZZ', 'EZY', 'DLH', 'AFR', 'KLM', 'IBE', 'VLG', 'SWR', 'AUA', 'BAW', 'TAP', 'AEE', 'THY', 'UAE', 'QTR', 'ETD', 'DAL', 'UAL', 'AAL', 'SAS', 'LOT', 'BEL'];

function hexOf(rand, prefix = '') {
  let h = prefix;
  while (h.length < 6) h += Math.floor(rand() * 16).toString(16);
  return h;
}
function regOf(rand, country = 'I') {
  const L = 'ABCDEFGHIJKLMNOPRSTUVWXYZ';
  const pick = () => L[Math.floor(rand() * L.length)];
  if (country === 'EI') return `EI-${pick()}${pick()}${pick()}`;
  if (country === 'N') return `N${100 + Math.floor(rand() * 899)}${pick()}${pick()}`;
  if (country === 'D') return `D-A${pick()}${pick()}${pick()}`;
  return `I-${pick()}${pick()}${pick()}${pick()}`;
}

/** One readsb-style record. */
function rec(o) {
  const [t, desc, cat] = TYPES[o.t] || [o.t, undefined, undefined];
  const out = {
    hex: o.hex,
    type: o.src || 'adsb_icao',
    ...(o.flight !== undefined ? { flight: o.flight.padEnd(8, ' ') } : {}),
    ...(o.r ? { r: o.r } : {}),
    ...(t ? { t } : {}),
    ...(desc ? { desc } : {}),
    ...(o.alt !== undefined ? { alt_baro: o.alt } : {}),
    ...(typeof o.alt === 'number' ? { alt_geom: o.alt + 225 } : {}),
    ...(o.gs !== undefined ? { gs: o.gs } : {}),
    ...(o.track !== undefined ? { track: o.track } : {}),
    ...(o.vr !== undefined ? { baro_rate: o.vr } : {}),
    ...(o.squawk ? { squawk: o.squawk } : {}),
    emergency: o.emergency || 'none',
    ...((o.cat ?? cat) ? { category: o.cat ?? cat } : {}),
    ...(o.lat !== undefined ? { lat: o.lat, lon: o.lon, nic: 8, rc: 186, seen_pos: o.seenPos ?? +(0.2 + (o.seenRand ?? 0) * 4).toFixed(1) } : {}),
    version: 2,
    mlat: o.src === 'mlat' ? ['lat', 'lon', 'track', 'gs', 'baro_rate'] : [],
    tisb: [],
    messages: 1200 + Math.floor((o.seenRand ?? 0.5) * 40000),
    seen: o.seenPos !== undefined ? Math.min(o.seenPos, 1.2) : 0.4,
    rssi: -18.4,
    ...(o.flags ? { dbFlags: o.flags } : {}),
  };
  return out;
}

// ----------------------------------------------------------- scenarios
const FCO = { lat: 41.8003, lon: 12.2389, label: 'Roma Fiumicino Leonardo da Vinci' };

function fcoAircraft() {
  const rand = rng(1907);
  const list = [];
  const airline = () => AIRLINES[Math.floor(rand() * AIRLINES.length)];
  const types = ['A20N', 'A21N', 'A320', 'A319', 'B738', 'B38M', 'E190', 'E195'];
  const pickType = () => types[Math.floor(rand() * types.length)];
  // On the ground at FCO.
  const stands = [[41.7988, 12.2475], [41.8007, 12.2512], [41.7969, 12.2441], [41.8031, 12.2489], [41.7945, 12.2517], [41.7926, 12.2402], [41.8064, 12.2463], [41.8102, 12.2421], [41.7998, 12.2367]];
  stands.forEach(([lat, lon], i) => {
    const t = i === 2 ? 'B77W' : i === 5 ? 'A359' : pickType();
    const al = t === 'B77W' ? 'UAE' : t === 'A359' ? 'ITY' : airline();
    list.push(rec({ hex: hexOf(rand, '3'), flight: `${al}${100 + Math.floor(rand() * 899)}`, r: regOf(rand, al === 'RYR' ? 'EI' : 'I'), t, alt: 'ground', gs: i % 3 === 0 ? 14 : 0, track: 70 + i * 31, lat, lon, seenRand: rand() }));
  });
  list.push(rec({ hex: 'f00201', flight: 'FOLLOW2', alt: 'ground', gs: 21, track: 250, lat: 41.8021, lon: 12.2398, cat: 'C2', seenRand: rand() }));
  list.push(rec({ hex: 'f00207', flight: 'RESCUE7', alt: 'ground', gs: 0, track: 160, lat: 41.7914, lon: 12.2555, cat: 'C1', seenRand: rand() }));
  // Arrivals on the 16L/16R approach, from the north over the coast.
  for (let i = 0; i < 7; i++) {
    const km = 7 + i * 6.5;
    const [lat, lon] = dest(41.8189, 12.2302, km, 340 + (i % 2 ? 2 : -1));
    const al = airline();
    list.push(rec({ hex: hexOf(rand, '4'), flight: `${al}${200 + Math.floor(rand() * 799)}`, r: regOf(rand, al === 'RYR' ? 'EI' : al === 'DLH' ? 'D' : 'I'), t: i === 3 ? 'B789' : pickType(), alt: Math.round((1200 + km * 105) / 25) * 25, gs: 140 + Math.round(km * 1.6), track: 158 + (i % 3), vr: -700 - Math.round(rand() * 300), squawk: String(1000 + Math.floor(rand() * 6000)), lat, lon, seenRand: rand() }));
  }
  // Departures off 25, climbing out west.
  for (let i = 0; i < 5; i++) {
    const km = 5 + i * 9;
    const [lat, lon] = dest(41.7954, 12.2208, km, 245 - i * 6);
    const al = airline();
    list.push(rec({ hex: hexOf(rand, '4'), flight: `${al}${300 + Math.floor(rand() * 699)}`, r: regOf(rand, 'I'), t: i === 1 ? 'AT76' : pickType(), alt: Math.round((1800 + km * 260) / 25) * 25, gs: 170 + km * 2, track: 245 - i * 8, vr: 2400 - i * 250, squawk: String(2000 + Math.floor(rand() * 5000)), lat, lon, seenRand: rand() }));
  }
  // Overflights along the Tyrrhenian airways.
  for (let i = 0; i < 9; i++) {
    const [lat, lon] = dest(FCO.lat, FCO.lon, 8 + rand() * 40, rand() * 360);
    const t = i === 2 ? 'A359' : i === 5 ? 'B744' : i === 7 ? 'A333' : pickType();
    const al = t === 'B744' ? 'CLX' : airline();
    list.push(rec({ hex: hexOf(rand, i % 2 ? '4' : 'a'), flight: `${al}${10 + Math.floor(rand() * 989)}`, r: regOf(rand, i % 3 ? 'D' : 'N'), t, alt: Math.round((30000 + rand() * 9000) / 1000) * 1000, gs: 430 + Math.round(rand() * 70), track: [155, 335, 160, 340, 130, 320, 175, 350, 140][i], vr: 0, squawk: String(3000 + Math.floor(rand() * 4000)), lat, lon, seenRand: rand() }));
  }
  // The interesting ones.
  list.push(rec({ hex: '4ca9f2', flight: 'RYR4KP', r: 'EI-DWL', t: 'B738', alt: 7800, gs: 248, track: 302, vr: -1850, squawk: '7700', emergency: 'general', lat: 41.7012, lon: 12.5104, seenPos: 0.4 }));
  list.push(rec({ hex: '3005a1', flight: 'PS110', r: 'MM81787', t: 'A139', alt: 1500, gs: 108, track: 72, vr: 0, squawk: '7004', lat: 41.8951, lon: 12.4734, seenRand: 0.3 }));
  list.push(rec({ hex: '33ff42', flight: 'IAM1215', r: 'MM7341', t: 'EUFI', alt: 18400, gs: 410, track: 205, vr: -1200, lat: 41.6611, lon: 12.4362, flags: 1, seenRand: 0.6 }));
  list.push(rec({ hex: '33ffd1', flight: 'IAM4653', r: 'MM62179', t: 'C30J', alt: 9500, gs: 255, track: 118, vr: 600, lat: 41.6203, lon: 12.0584, flags: 1, src: 'mlat', seenPos: 2.1 }));
  list.push(rec({ hex: '3c6ed4', flight: 'DLH1HF', r: 'D-AIUK', t: 'A20N', alt: 24000, gs: 402, track: 333, vr: 1600, squawk: '4612', lat: 41.9608, lon: 12.0911, seenPos: 51 }));
  list.push(rec({ hex: 'adf7c9', t: 'GLF6', alt: 41000, gs: 488, track: 128, vr: 0, squawk: '6150', lat: 41.9905, lon: 12.4422, flags: 4, seenRand: 0.2 }));
  list.push(rec({ hex: 'a8d211', flight: 'N68LD', r: 'N68LD', t: 'C68A', alt: 4300, gs: 182, track: 96, vr: -900, squawk: '4421', lat: 41.8822, lon: 12.0011, flags: 8, seenRand: 0.4 }));
  list.push(rec({ hex: '3007b4', flight: 'IHERM', r: 'I-HERM', t: 'P28A', alt: 2300, gs: 96, track: 12, vr: 200, squawk: '7000', lat: 41.9802, lon: 12.6015, seenRand: 0.8 }));
  return list;
}

function northAircraft(n) {
  const rand = rng(4219);
  const MIL = { lat: 45.4642, lon: 9.19 };
  const airports = [[45.63, 8.723, 'MXP'], [45.445, 9.277, 'LIN'], [45.669, 9.7, 'BGY'], [45.505, 12.352, 'VCE'], [44.535, 11.289, 'BLQ'], [45.2, 7.65, 'TRN'], [44.413, 8.838, 'GOA'], [45.396, 10.889, 'VRN'], [45.83, 11.32, 'LIPH']];
  const types = ['A20N', 'A21N', 'A320', 'A319', 'B738', 'B38M', 'E190', 'E195', 'CRJ9', 'AT76', 'DH8D', 'A359', 'B77W', 'B789', 'A333', 'C68A', 'GLF6', 'PC12', 'C172'];
  const list = [];
  for (let i = 0; i < n; i++) {
    const roll = rand();
    let lat, lon, alt, gs, vr, track;
    let t = types[Math.floor(rand() * (roll < 0.2 ? 11 : types.length))];
    if (roll < 0.08) {
      const ap = airports[Math.floor(rand() * airports.length)];
      [lat, lon] = dest(ap[0], ap[1], rand() * 2, rand() * 360);
      alt = 'ground'; gs = rand() < 0.5 ? 0 : 12; track = Math.floor(rand() * 360); vr = undefined;
    } else if (roll < 0.25) {
      const ap = airports[Math.floor(rand() * airports.length)];
      const km = 5 + rand() * 40;
      track = Math.floor(rand() * 360);
      [lat, lon] = dest(ap[0], ap[1], km, track + 180);
      alt = Math.round((1500 + km * 220) / 25) * 25; gs = 160 + km * 3; vr = rand() < 0.5 ? -900 : 2200;
    } else {
      [lat, lon] = dest(MIL.lat, MIL.lon, Math.sqrt(rand()) * 248, rand() * 360);
      alt = rand() < 0.2 ? Math.round((12000 + rand() * 14000) / 100) * 100 : Math.round((30000 + rand() * 11000) / 1000) * 1000;
      gs = 380 + Math.round(rand() * 110); track = Math.floor(rand() * 360); vr = rand() < 0.75 ? 0 : rand() < 0.5 ? -1500 : 1500;
    }
    if (t === 'C172' || t === 'PC12') { alt = typeof alt === 'number' ? Math.min(alt, 9500) : alt; gs = Math.min(gs, 220); }
    const al = AIRLINES[Math.floor(rand() * AIRLINES.length)];
    const special = i === 17 ? { t: 'EC35', alt: 1800, gs: 112, cat: 'A7', flight: 'I-EMSB', r: 'I-EMSB' }
      : i === 41 ? { t: 'A139', alt: 1200, gs: 120, cat: 'A7', flight: 'GDF12', r: 'MM81880' }
      : i === 64 ? { t: 'EUFI', flags: 1, flight: 'IAM5201', r: 'MM7322', alt: 27000 }
      : i === 77 ? { t: 'K35R', flags: 1, flight: 'LAGR221', r: '62-3561', alt: 25000, src: 'mlat' }
      : i === 90 ? { t: 'C30J', flags: 1, flight: 'IAM4610', r: 'MM62183', src: 'mlat', alt: 16000 }
      : i === 133 ? { squawk: '7600', emergency: 'nordo' }
      : {};
    list.push(rec({
      hex: hexOf(rand, i % 3 ? '4' : '3'), flight: special.flight ?? `${al}${10 + Math.floor(rand() * 9989)}`.slice(0, 7), r: special.r ?? regOf(rand, ['I', 'EI', 'D', 'N'][i % 4]),
      t: special.t ?? t, alt: special.alt ?? alt, gs: special.gs ?? gs, track, vr, squawk: special.squawk ?? String(1000 + Math.floor(rand() * 6700)), emergency: special.emergency,
      cat: special.cat, lat, lon, flags: special.flags, src: special.src ?? (rand() < 0.03 ? 'mlat' : 'adsb_icao'), seenPos: rand() < 0.04 ? 40 + Math.round(rand() * 20) : undefined, seenRand: rand(),
    }));
  }
  return list.sort((a, b) => distKm(MIL.lat, MIL.lon, a.lat, a.lon) - distKm(MIL.lat, MIL.lon, b.lat, b.lon));
}

function militaryAircraft() {
  const r = [
    { hex: 'ae1460', flight: 'RCH871', r: '05-5146', t: 'C17', alt: 33000, gs: 452, track: 112, lat: 46.12, lon: 4.81 },
    { hex: 'ae0812', flight: 'LAGR221', r: '62-3561', t: 'K35R', alt: 25000, gs: 389, track: 278, lat: 44.98, lon: 12.44, src: 'mlat' },
    { hex: 'ae6857', flight: 'PELICAN1', r: '168856', t: 'P8', alt: 23000, gs: 360, track: 145, lat: 37.41, lon: 15.07 },
    { hex: '33ffd1', flight: 'IAM4653', r: 'MM62179', t: 'C30J', alt: 23925, gs: 288, track: 165, lat: 43.7, lon: 10.6, src: 'mlat' },
    { hex: '3ea2c4', flight: 'GAF684', r: '54+08', t: 'A400', alt: 28000, gs: 365, track: 190, lat: 48.33, lon: 11.03 },
    { hex: '43c6f2', flight: 'RRR6573', r: 'ZZ336', t: 'MRTT', alt: 31000, gs: 470, track: 128, lat: 50.12, lon: 1.9 },
    { hex: '4d03d0', flight: 'NATO01', r: 'LX-N90443', t: 'E3TF', alt: 30000, gs: 330, track: 60, lat: 51.55, lon: 6.1 },
    { hex: 'ae5420', flight: '', t: 'Q9', alt: 39000, gs: 175, track: 300, lat: 37.62, lon: 14.6, cat: 'B6', src: 'mlat' },
    { hex: '33ff42', flight: 'IAM1215', r: 'MM7341', t: 'EUFI', alt: 18400, gs: 410, track: 205, lat: 41.66, lon: 12.44 },
    { hex: '3b7790', flight: 'CTM2045', r: 'F-RBAM', t: 'A400', alt: 26000, gs: 372, track: 150, lat: 45.1, lon: 5.6 },
    { hex: 'ae07e1', flight: 'BOLT21', r: '17-5266', t: 'F35', alt: 22000, gs: 450, track: 300, lat: 41.15, lon: 16.8, src: 'mlat' },
    { hex: '33ff01', flight: 'IAM7108', r: 'MM55213', t: 'M346', alt: 14000, gs: 380, track: 20, lat: 45.81, lon: 13.43 },
    { hex: 'ae2b4c', flight: 'DUKE33', r: '13-8076', t: 'C17', alt: 'ground', gs: 0, track: 90, lat: 37.4, lon: 14.92 },
    { hex: '4b7f43', flight: 'SUI123', r: 'T-784', t: 'C30J', alt: 17000, gs: 280, track: 225, lat: 46.6, lon: 8.1 },
    { hex: 'ae0a3c', flight: 'RCH4027', r: '96-0003', t: 'C17' },
  ];
  return r.map((o, i) => rec({ ...o, flags: 1, vr: i % 4 === 1 ? -800 : 0, seenRand: (i * 0.37) % 1 }));
}

const NOW = () => Math.round(Date.now() / 100) / 10;

export const SCENARIOS = {
  fco: {
    title: 'aircraft_near · ~40 at Fiumicino (heli, mil jet, MLAT, 7700, stale, PIA, LADD)',
    tool: 'aircraft_near', args: { airport: 'FCO', radiusKm: 50 },
    result: () => { const ac = fcoAircraft(); return { center: { ...FCO, source: 'airport' }, radiusKm: 50, now: NOW(), count: ac.length, totalMatched: ac.length, aircraft: ac }; },
  },
  empty: {
    title: 'aircraft_near · 0 aircraft (Lampedusa, 25 km)',
    tool: 'aircraft_near', args: { lat: 35.5025, lon: 12.6181, radiusKm: 25 },
    result: () => ({ center: { label: '35.5025,12.6181', lat: 35.5025, lon: 12.6181, source: 'coordinates' }, radiusKm: 25, now: NOW(), count: 0, totalMatched: 0, aircraft: [] }),
  },
  north: {
    title: 'aircraft_near · 300 of 312 over northern Italy (250 km of Milano)',
    tool: 'aircraft_near', args: { lat: 45.4642, lon: 9.19, radiusKm: 250, limit: 300 },
    result: () => { const ac = northAircraft(300); return { center: { label: '45.4642,9.19', lat: 45.4642, lon: 9.19, source: 'coordinates' }, radiusKm: 250, now: NOW(), count: ac.length, totalMatched: 312, aircraft: ac }; },
  },
  saved: {
    title: 'aircraft_near · near me (saved position, Pisa), 6 aircraft',
    tool: 'aircraft_near', args: {},
    result: () => {
      const ac = fcoAircraft().slice(9, 15).map((a, i) => ({ ...a, lat: +(43.7 + (i - 2.5) * 0.06).toFixed(4), lon: +(10.4 + ((i * 7) % 5) * 0.05).toFixed(4) }));
      return { center: { label: "the user's saved position (Pisa)", lat: 43.7, lon: 10.4, source: 'saved' }, radiusKm: 30, now: NOW(), count: ac.length, totalMatched: ac.length, aircraft: ac };
    },
  },
  military: {
    title: 'special_traffic · 15 military, network-wide (one without position)',
    tool: 'special_traffic', args: { category: 'military' },
    result: () => { const ac = militaryAircraft(); return { category: 'military', now: NOW(), count: ac.length, totalMatched: 87, aircraft: ac }; },
  },
  find: {
    title: 'find_aircraft · found (C-130J, MLAT)',
    tool: 'find_aircraft', args: { by: 'callsign', value: 'IAM4653' },
    result: () => ({ found: true, aircraft: militaryAircraft()[3] }),
  },
  notfound: {
    title: 'find_aircraft · not found',
    tool: 'find_aircraft', args: { by: 'callsign', value: 'AZA1234' },
    result: () => ({ found: false, by: 'callsign', value: 'AZA1234' }),
  },
  error: {
    title: 'aircraft_near · tool error (no place, nothing saved)',
    tool: 'aircraft_near', args: {},
    error: 'No place was given and this FlyItalyADSB account has no saved position. Ask the user where they are (a town, an airport or coordinates) and call aircraft_near again with lat/lon. If they want it remembered for next time, save it with set_my_location.',
  },
  loading: {
    title: 'aircraft_near · still running (no result yet)',
    tool: 'aircraft_near', args: { airport: 'FCO', radiusKm: 50 },
    pending: true,
  },
};

/** The CallToolResult the server would send: JSON text, like server.ts. */
export function toolResult(name, refreshIndex = 0) {
  const sc = SCENARIOS[name];
  if (sc.error) return { content: [{ type: 'text', text: sc.error }], isError: true };
  const data = sc.result();
  if (refreshIndex && Array.isArray(data.aircraft)) {
    // Dead reckoning: everything moves on by `refreshIndex` × 20 s.
    const dt = refreshIndex * 20;
    data.aircraft = data.aircraft.map((a) => {
      if (a.lat === undefined || !a.gs || a.track === undefined) return a;
      const [lat, lon] = dest(a.lat, a.lon, (a.gs * 1.852 * dt) / 3600, a.track);
      const alt = typeof a.alt_baro === 'number' && a.baro_rate ? Math.max(0, Math.round((a.alt_baro + (a.baro_rate * dt) / 60) / 25) * 25) : a.alt_baro;
      return { ...a, lat, lon, alt_baro: alt };
    });
  }
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}
