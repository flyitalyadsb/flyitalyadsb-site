import { z } from 'zod';
import { airports, fullName, RADIUS_KM } from '../../../data/airports';
import { getAircraftNear, type AircraftRecord } from '../v2-client';

/** Resolves a free-text identifier against the curated airport list by slug,
 * IATA, or ICAO code (case-insensitive) — lets a caller say "roma-fiumicino" or
 * "FCO" instead of looking up coordinates first. */
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
      .describe('An Italian airport slug, IATA, or ICAO code (e.g. "roma-fiumicino", "FCO", "LIRF"). Use this instead of lat/lon when asking about a named airport.'),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().positive().max(500).default(RADIUS_KM),
    limit: z.number().int().positive().max(200).default(50).describe('Caps how many aircraft records come back.'),
  })
  .refine((v) => v.airport !== undefined || (v.lat !== undefined && v.lon !== undefined), {
    message: 'Provide either `airport` or both `lat` and `lon`.',
  });
export type AircraftNearInput = z.infer<typeof aircraftNearInputSchema>;

export interface AircraftNearResult {
  center: { label: string; lat: number; lon: number };
  radiusKm: number;
  now: number;
  count: number;
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
        `Unknown airport "${input.airport}" — expected an Italian airport slug, IATA, or ICAO code (e.g. "roma-fiumicino", "FCO", "LIRF").`,
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
  return {
    center: { label, lat, lon },
    radiusKm: input.radiusKm,
    now: result.now,
    count: result.count,
    aircraft: result.ac.slice(0, input.limit),
  };
}
