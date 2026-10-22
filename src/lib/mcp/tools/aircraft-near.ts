import { z } from 'zod';
import { airports, fullName, RADIUS_KM } from '../../../data/airports';
import { getAircraftNear, getMyLocation, type AircraftRecord } from '../v2-client';

/** Resolves a free-text identifier against FlyItalyADSB's own curated Italian
 * airport list (the same 28 airports its /aeroporti pages cover) by slug,
 * IATA, or ICAO code (case-insensitive) — a shortcut for those airports only.
 * The FlyItalyADSB network itself is global (3,200+ feeders worldwide, not
 * an Italy-only project), so anywhere else is reached via `lat`/`lon`
 * directly, not through this resolver. */
export function resolveAirport(identifier: string) {
  const needle = identifier.trim().toLowerCase();
  return airports.find(
    (a) => a.slug === needle || a.iata.toLowerCase() === needle || a.icao.toLowerCase() === needle,
  );
}

export const aircraftNearInputSchema = z
  .object({
    airport: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'A shortcut for one of FlyItalyADSB\'s curated Italian airports, by slug, IATA, or ICAO code (e.g. "roma-fiumicino", "FCO", "LIRF"). For anywhere else in the world, use `lat`/`lon` instead — the network and this tool are not limited to Italy.',
      ),
    lat: z.number().min(-90).max(90).optional().describe('Latitude, for any location worldwide (together with `lon`).'),
    lon: z.number().min(-180).max(180).optional().describe('Longitude, for any location worldwide (together with `lat`).'),
    radiusKm: z.number().positive().max(500).default(RADIUS_KM),
    limit: z.number().int().positive().max(200).default(50).describe('Caps how many aircraft records come back.'),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), {
    message: 'Give `lat` and `lon` together, or neither.',
  });
export type AircraftNearInput = z.infer<typeof aircraftNearInputSchema>;

/** Where the centre came from: the user's own words, their saved position,
 * or the coarse location ChatGPT attaches to tool calls. */
export type CenterSource = 'airport' | 'coordinates' | 'saved' | 'chatgpt';

export interface LocationHint {
  lat: number;
  lon: number;
  label: string;
}

/** `_meta["openai/userLocation"]` of a ChatGPT tool call ({city, region,
 * country, timezone, latitude, longitude}): a coarse hint, about city level,
 * that may be missing. Other clients send nothing of the kind. */
export function chatgptLocationHint(meta: Record<string, unknown> | undefined): LocationHint | undefined {
  const loc = meta?.['openai/userLocation'];
  if (!loc || typeof loc !== 'object') return undefined;
  const l = loc as Record<string, unknown>;
  const lat = Number(l.latitude);
  const lon = Number(l.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  const label = [l.city, l.country].filter((v) => typeof v === 'string' && v).join(', ');
  return { lat, lon, label: label || `${lat},${lon}` };
}

const NO_LOCATION =
  'No place was given and this FlyItalyADSB account has no saved position. Ask the user where they are ' +
  '(a town, an airport or coordinates) and call aircraft_near again with lat/lon. If they want it ' +
  'remembered for next time, save it with set_my_location.';

export interface AircraftNearResult {
  center: { label: string; lat: number; lon: number; source: CenterSource };
  radiusKm: number;
  now: number;
  /** Number of records actually in `aircraft` below (i.e. `aircraft.length`) — NOT the
   * pre-limit total, so the two fields can never disagree. See `totalMatched` for that. */
  count: number;
  /** How many aircraft actually matched before `limit` truncated the list. */
  totalMatched: number;
  aircraft: AircraftRecord[];
}

/** `hint`: the client's own location hint, if any (chatgptLocationHint). With
 * no `airport` and no `lat`/`lon` ("near me"), the position saved on the
 * account comes first, then the hint. */
export async function aircraftNear(input: AircraftNearInput, apiKey: string, hint?: LocationHint): Promise<AircraftNearResult> {
  let lat: number;
  let lon: number;
  let label: string;
  let source: CenterSource;

  if (input.airport) {
    const match = resolveAirport(input.airport);
    if (!match) {
      throw new Error(
        `"${input.airport}" isn't one of FlyItalyADSB's curated Italian airports (slug, IATA, or ICAO — e.g. "roma-fiumicino", "FCO", "LIRF"). ` +
          'For any other airport or location in the world, call this tool again with `lat`/`lon` instead.',
      );
    }
    lat = match.lat;
    lon = match.lon;
    label = fullName(match);
    source = 'airport';
  } else if (input.lat !== undefined && input.lon !== undefined) {
    lat = input.lat;
    lon = input.lon;
    label = `${lat},${lon}`;
    source = 'coordinates';
  } else {
    const saved = await getMyLocation(apiKey);
    if (saved) {
      ({ lat, lon } = saved);
      label = saved.label ? `the user's saved position (${saved.label})` : "the user's saved position";
      source = 'saved';
    } else if (hint) {
      ({ lat, lon } = hint);
      label = `ChatGPT's approximate location of the user (${hint.label})`;
      source = 'chatgpt';
    } else {
      throw new Error(NO_LOCATION);
    }
  }

  const result = await getAircraftNear(lat, lon, input.radiusKm, apiKey);
  const aircraft = result.ac.slice(0, input.limit);
  return {
    center: { label, lat, lon, source },
    radiusKm: input.radiusKm,
    now: result.now,
    count: aircraft.length,
    totalMatched: result.count,
    aircraft,
  };
}
