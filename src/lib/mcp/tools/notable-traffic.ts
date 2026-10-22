import { z } from 'zod';
import { airports, fullName } from '../../../data/airports';
import { getMyLocation, getNotableEvents, type EventKind, type TrafficEvent } from '../v2-client';
import type { CenterSource, LocationHint } from './aircraft-near';

/** notable_traffic: the pull digest of public-api's events (/v2/events) —
 * emergencies, military and "interesting" aircraft seen in an area over the
 * last hours, grouped by aircraft so an assistant gets one line per aircraft
 * instead of one per ~50 km cell it crossed. The place is resolved like
 * aircraft_near: an Italian airport, lat/lon, or the account's saved position
 * (then ChatGPT's coarse location). */

const KINDS = ['emergency', 'military', 'interesting'] as const;

export const notableTrafficInputSchema = z
  .object({
    airport: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'A shortcut for one of FlyItalyADSB\'s curated Italian airports, by slug, IATA, or ICAO code (e.g. "milano-malpensa", "MXP", "LIMC"). For anywhere else, use `lat`/`lon`.',
      ),
    lat: z.number().min(-90).max(90).optional().describe('Latitude, anywhere in the world (together with `lon`).'),
    lon: z.number().min(-180).max(180).optional().describe('Longitude, anywhere in the world (together with `lat`).'),
    radiusKm: z
      .number()
      .positive()
      .max(500)
      .default(100)
      .describe('Radius around the place, km (default 100). The user\'s plan may allow less.'),
    sinceHours: z
      .number()
      .positive()
      .max(168)
      .default(24)
      .describe('How far back to look, in hours (default 24, at most 168 = 7 days).'),
    kinds: z
      .array(z.enum(KINDS))
      .min(1)
      .optional()
      .describe(
        'Which events: "emergency" (squawk 7500 hijack, 7600 radio failure, 7700 general emergency, or the ADS-B emergency status), "military" (military aircraft), "interesting" (government and other notable aircraft in the aircraft database). Default: all three.',
      ),
    limit: z.number().int().positive().max(100).default(30).describe('Caps how many aircraft come back.'),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: 'Give `lat` and `lon` together, or neither.',
  });
export type NotableTrafficInput = z.infer<typeof notableTrafficInputSchema>;

export interface NotableAircraft {
  kind: EventKind;
  /** Emergencies: general, hijack, radio_failure, minimum_fuel, downed. */
  reason?: string;
  hex: string;
  callsign?: string;
  registration?: string;
  type?: string;
  description?: string;
  squawk?: string;
  firstSeen: string;
  lastSeen: string;
  /** How many ~50 km cells of the area it was recorded in. */
  sightings: number;
  closest: {
    lat: number;
    lon: number;
    distanceKm?: number;
    time: string;
    altitudeFt?: number | 'ground';
    speedKt?: number;
    /** Position source: adsb_icao, mlat, ... */
    source?: string;
  };
  map?: string;
}

export interface NotableTrafficResult {
  center: { label: string; lat: number; lon: number; source: CenterSource };
  radiusKm: number;
  since: string;
  until: string;
  /** Events before grouping by aircraft. */
  totalEvents: number;
  /** The API had more events than it returned: the oldest are missing. */
  truncated: boolean;
  countsByKind: Record<EventKind, number>;
  /** Aircraft in `aircraft` below (after `limit`); `totalAircraft` is before it. */
  count: number;
  totalAircraft: number;
  aircraft: NotableAircraft[];
  note: string;
}

const NOTE =
  'Each event is recorded when the aircraft enters a ~50 km grid cell, so positions are samples, not tracks. ' +
  'Positions come from ADS-B or MLAT (`closest.source`) and can be wrong or spoofed. An emergency squawk can be a ' +
  'mistake corrected seconds later: it is what the transponder sent, not a confirmed emergency.';

const NO_LOCATION =
  'No place was given and this FlyItalyADSB account has no saved position. Ask the user where they are ' +
  '(a town, an airport or coordinates) and call notable_traffic again with lat/lon. If they want it ' +
  'remembered for next time, save it with set_my_location.';

function resolveAirport(identifier: string) {
  const needle = identifier.trim().toLowerCase();
  return airports.find((a) => a.slug === needle || a.iata.toLowerCase() === needle || a.icao.toLowerCase() === needle);
}

async function resolveCenter(input: NotableTrafficInput, apiKey: string, hint?: LocationHint) {
  if (input.airport) {
    const match = resolveAirport(input.airport);
    if (!match) {
      throw new Error(
        `"${input.airport}" isn't one of FlyItalyADSB's curated Italian airports (slug, IATA, or ICAO — e.g. "milano-malpensa", "MXP", "LIMC"). ` +
          'For any other place in the world, call this tool again with `lat`/`lon` instead.',
      );
    }
    return { lat: match.lat, lon: match.lon, label: fullName(match), source: 'airport' as const };
  }
  if (input.lat !== undefined && input.lon !== undefined) {
    return { lat: input.lat, lon: input.lon, label: `${input.lat},${input.lon}`, source: 'coordinates' as const };
  }
  const saved = await getMyLocation(apiKey);
  if (saved) {
    const label = saved.label ? `the user's saved position (${saved.label})` : "the user's saved position";
    return { lat: saved.lat, lon: saved.lon, label, source: 'saved' as const };
  }
  if (hint) {
    return { lat: hint.lat, lon: hint.lon, label: `ChatGPT's approximate location of the user (${hint.label})`, source: 'chatgpt' as const };
  }
  throw new Error(NO_LOCATION);
}

const KIND_ORDER: Record<EventKind, number> = { emergency: 0, military: 1, interesting: 2 };

/** One entry per aircraft, kind and reason: first/last time, how many cells,
 * and the closest recorded position. Emergencies first, then most recent. */
function groupByAircraft(events: TrafficEvent[]): NotableAircraft[] {
  const groups = new Map<string, { first: TrafficEvent; last: TrafficEvent; closest: TrafficEvent; n: number }>();
  for (const e of events) {
    const key = `${e.hex}|${e.kind}|${e.reason ?? ''}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { first: e, last: e, closest: e, n: 1 });
      continue;
    }
    g.n += 1;
    if (e.time < g.first.time) g.first = e;
    if (e.time > g.last.time) g.last = e;
    if ((e.distance_km ?? Infinity) < (g.closest.distance_km ?? Infinity)) g.closest = e;
  }
  const out: NotableAircraft[] = [];
  for (const { first, last, closest, n } of groups.values()) {
    // Names from the most recent record: a callsign appears once the flight is airborne.
    const pick = <K extends keyof TrafficEvent>(k: K) => (last[k] ?? closest[k] ?? first[k]) as TrafficEvent[K];
    const entry: NotableAircraft = {
      kind: last.kind,
      hex: last.hex,
      firstSeen: first.time,
      lastSeen: last.time,
      sightings: n,
      closest: {
        lat: closest.lat,
        lon: closest.lon,
        time: closest.time,
        ...(closest.distance_km !== undefined ? { distanceKm: closest.distance_km } : {}),
        ...(closest.alt_baro !== undefined ? { altitudeFt: closest.alt_baro } : {}),
        ...(closest.gs !== undefined ? { speedKt: closest.gs } : {}),
        ...(closest.source ? { source: closest.source } : {}),
      },
    };
    if (last.reason) entry.reason = last.reason;
    const callsign = pick('flight');
    if (typeof callsign === 'string' && callsign) entry.callsign = callsign;
    for (const [field, name] of [
      ['r', 'registration'],
      ['t', 'type'],
      ['desc', 'description'],
      ['squawk', 'squawk'],
      ['map', 'map'],
    ] as const) {
      const v = pick(field);
      if (typeof v === 'string' && v) entry[name] = v;
    }
    out.push(entry);
  }
  return out.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.lastSeen < b.lastSeen ? 1 : -1));
}

export async function notableTraffic(input: NotableTrafficInput, apiKey: string, hint?: LocationHint): Promise<NotableTrafficResult> {
  const center = await resolveCenter(input, apiKey, hint);
  const result = await getNotableEvents(
    {
      lat: center.lat,
      lon: center.lon,
      distKm: input.radiusKm,
      since: Date.now() / 1000 - input.sinceHours * 3600,
      kinds: input.kinds,
      limit: 500,
    },
    apiKey,
  );
  const countsByKind: Record<EventKind, number> = { emergency: 0, military: 0, interesting: 0 };
  for (const e of result.events) countsByKind[e.kind] = (countsByKind[e.kind] ?? 0) + 1;
  const grouped = groupByAircraft(result.events);
  const aircraft = grouped.slice(0, input.limit);
  return {
    center,
    radiusKm: input.radiusKm,
    since: result.since,
    until: result.until,
    totalEvents: result.count,
    truncated: result.truncated,
    countsByKind,
    count: aircraft.length,
    totalAircraft: grouped.length,
    aircraft,
    note: NOTE,
  };
}
