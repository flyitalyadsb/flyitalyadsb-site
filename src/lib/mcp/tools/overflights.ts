import { z } from 'zod';
import { fullName } from '../../../data/airports';
import { getMyLocation, getOverflights, type Overflight } from '../v2-client';
import { resolveAirport, type CenterSource, type LocationHint } from './aircraft-near';

/** overflights: which aircraft flew over a place in a past time window —
 * public-api `GET /v2/overflights` (overflights.py), backed by a per-day
 * index over the globe history. The place works like aircraft_near: an
 * airport shortcut, lat/lon, or the position saved on the account. */

export const overflightsInputSchema = z
  .object({
    airport: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'A shortcut for one of FlyItalyADSB\'s curated Italian airports, by slug, IATA, or ICAO code (e.g. "milano-linate", "LIN", "LIML"). For anywhere else, use `lat`/`lon`.',
      ),
    lat: z.number().min(-90).max(90).optional().describe('Latitude of the place, worldwide (together with `lon`).'),
    lon: z.number().min(-180).max(180).optional().describe('Longitude of the place, worldwide (together with `lat`).'),
    radiusKm: z
      .number()
      .positive()
      .max(50)
      .default(3)
      .describe('Radius around the place, in km. The maximum depends on the plan: 10 km on Free, 25 on Starter, 50 above.'),
    from: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Start of the window, ISO 8601 (e.g. "2026-10-21T08:00:00Z"; without an offset it is UTC). Use with `to`, or use `lastHours`.'),
    to: z.string().trim().min(1).optional().describe('End of the window, ISO 8601. Defaults to now.'),
    lastHours: z
      .number()
      .positive()
      .max(24)
      .optional()
      .describe('Instead of from/to: the last N hours up to now. The maximum window depends on the plan: 6 h on Free, 24 h above. Default 3.'),
    maxAltFt: z
      .number()
      .min(0)
      .max(100000)
      .optional()
      .describe('Only the part of each track at or below this altitude, in feet (e.g. 3000 for low flights). Positions without an altitude are left out when this is set.'),
    limit: z.number().int().positive().max(200).default(50).describe('Caps how many aircraft come back, earliest pass first.'),
  })
  .refine((v) => (v.lat === undefined) === (v.lon === undefined), { message: 'Give `lat` and `lon` together, or neither.' })
  .refine((v) => !(v.lastHours !== undefined && (v.from !== undefined || v.to !== undefined)), {
    message: 'Give either `lastHours` or `from`/`to`, not both.',
  });
export type OverflightsInput = z.infer<typeof overflightsInputSchema>;

const NO_LOCATION =
  'No place was given and this FlyItalyADSB account has no saved position. Ask the user which place they mean ' +
  '(a town, an address area, an airport or coordinates) and call overflights again with lat/lon.';

export interface OverflightsToolResult {
  center: { label: string; lat: number; lon: number; source: CenterSource };
  radiusKm: number;
  from: string;
  to: string;
  maxAltFt: number | null;
  /** Number of aircraft in `overflights` below. */
  count: number;
  /** True when more passes exist than were returned: see `completeUntil`. */
  truncated: boolean;
  /** When truncated: every pass with closest_time before this is listed; ask again from here for the rest. */
  completeUntil: string | null;
  coverage: { complete: boolean; gaps: Array<{ from: string; to: string; reason: string }> };
  overflights: Overflight[];
  notes: string[];
}

const isoNow = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** `hint`: the client's own location hint (ChatGPT), as for aircraft_near. */
export async function overflights(input: OverflightsInput, apiKey: string, hint?: LocationHint): Promise<OverflightsToolResult> {
  let lat: number;
  let lon: number;
  let label: string;
  let source: CenterSource;
  if (input.airport) {
    const match = resolveAirport(input.airport);
    if (!match) {
      throw new Error(
        `"${input.airport}" isn't one of FlyItalyADSB's curated Italian airports (slug, IATA, or ICAO — e.g. "milano-linate", "LIN", "LIML"). ` +
          'For any other place, call this tool again with `lat`/`lon`.',
      );
    }
    ({ lat, lon } = match);
    label = fullName(match);
    source = 'airport';
  } else if (input.lat !== undefined && input.lon !== undefined) {
    ({ lat, lon } = input);
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

  // from/to go to the API as given: it parses ISO 8601 (no offset = UTC) or
  // Unix seconds, and its 400 says what is wrong with a bad value.
  let from: string;
  let to: string;
  const now = Date.now();
  if (input.from !== undefined) {
    from = input.from;
    to = input.to ?? isoNow(now);
  } else if (input.to !== undefined) {
    throw new Error('Give `from` together with `to`, or use `lastHours`.');
  } else {
    from = isoNow(now - (input.lastHours ?? 3) * 3600_000);
    to = isoNow(now);
  }

  const res = await getOverflights(
    { lat, lon, distKm: input.radiusKm, from, to, maxAltFt: input.maxAltFt, limit: input.limit },
    apiKey,
  );
  const notes: string[] = [];
  for (const gap of res.coverage.gaps) {
    notes.push(`Not searched from ${gap.from} to ${gap.to} (${gap.reason}): do not conclude that nothing flew over then.`);
  }
  if (res.truncated && res.complete_until) {
    notes.push(`More passes exist: every pass before ${res.complete_until} is listed. Call again with from=${res.complete_until} for the rest.`);
  }
  if (res.overflights.some((o) => o.positions === 0)) {
    notes.push('positions = 0: no position was received inside the circle; the pass is a straight line between positions just outside it.');
  }
  if (res.overflights.some((o) => o.sources.includes('mlat'))) {
    notes.push('source "mlat": position computed by multilateration, less precise than ADS-B.');
  }
  return {
    center: { label, lat, lon, source },
    radiusKm: res.dist_km,
    from: res.from,
    to: res.to,
    maxAltFt: res.max_alt_ft,
    count: res.overflights.length,
    truncated: res.truncated,
    completeUntil: res.complete_until,
    coverage: res.coverage,
    overflights: res.overflights,
    notes,
  };
}
