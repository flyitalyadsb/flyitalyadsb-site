import { z } from 'zod';
import { airports, fullName, RADIUS_KM } from '../../../data/airports';
import { getAircraftNear, type AircraftRecord } from '../v2-client';

/** Resolves a free-text identifier against FlyItalyADSB's own curated Italian
 * airport list (the same 28 airports its /aeroporti pages cover) by slug,
 * IATA, or ICAO code (case-insensitive) — a shortcut for those airports only.
 * The FlyItalyADSB network itself is global (3,200+ feeders worldwide, not
 * an Italy-only project), so anywhere else is reached via `lat`/`lon`
 * directly, not through this resolver. */
function resolveAirport(identifier: string) {
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
    lat: z.number().min(-90).max(90).optional().describe('Latitude, for any location worldwide — required if `airport` is omitted.'),
    lon: z.number().min(-180).max(180).optional().describe('Longitude, for any location worldwide — required if `airport` is omitted.'),
    radiusKm: z.number().positive().max(500).default(RADIUS_KM),
    limit: z.number().int().positive().max(200).default(50).describe('Caps how many aircraft records come back.'),
  })
  .refine((v) => v.airport !== undefined || (v.lat !== undefined && v.lon !== undefined), {
    message: 'Provide either `airport` (one of FlyItalyADSB\'s curated Italian airports) or both `lat` and `lon` (works anywhere in the world).',
  });
export type AircraftNearInput = z.infer<typeof aircraftNearInputSchema>;

export interface AircraftNearResult {
  center: { label: string; lat: number; lon: number };
  radiusKm: number;
  now: number;
  /** Number of records actually in `aircraft` below (i.e. `aircraft.length`) — NOT the
   * pre-limit total, so the two fields can never disagree. See `totalMatched` for that. */
  count: number;
  /** How many aircraft actually matched before `limit` truncated the list. */
  totalMatched: number;
  aircraft: AircraftRecord[];
}

export async function aircraftNear(input: AircraftNearInput, apiKey: string): Promise<AircraftNearResult> {
  let lat: number;
  let lon: number;
  let label: string;

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
  } else {
    lat = input.lat!;
    lon = input.lon!;
    label = `${lat},${lon}`;
  }

  const result = await getAircraftNear(lat, lon, input.radiusKm, apiKey);
  const aircraft = result.ac.slice(0, input.limit);
  return {
    center: { label, lat, lon },
    radiusKm: input.radiusKm,
    now: result.now,
    count: aircraft.length,
    totalMatched: result.count,
    aircraft,
  };
}
