import { z } from 'zod';
import { getAircraftHistoryDates, getAircraftHistoryTrace, V2ApiError, type HistoryTrace } from '../v2-client';

export const aircraftHistoryInputSchema = z.object({
  icao24: z.string().trim().min(1).describe('24-bit ICAO hex address of the aircraft.'),
  date: z
    .string()
    .trim()
    .optional()
    .describe(
      'Date in YYYY-MM-DD to fetch that day\'s full position track. Omit to list the dates with ' +
        'available history for this aircraft instead — call once without `date` first if unsure ' +
        'what\'s available.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(2000)
    .default(200)
    .describe(
      'Max position samples to return from the day\'s track, evenly sampled across the day — a busy ' +
        'aircraft\'s full day can be 1,000+ points. Ignored when `date` is omitted.',
    ),
});
export type AircraftHistoryInput = z.infer<typeof aircraftHistoryInputSchema>;

export type AircraftHistoryResult =
  | { mode: 'dates'; icao: string; datesAvailable: string[] }
  | {
      mode: 'track';
      icao: string;
      date: string;
      found: true;
      aircraft: Omit<HistoryTrace, 'trace'>;
      /** Real point count in the day's track, before `limit` sampled it down — see `points`. */
      totalPoints: number;
      /** Evenly sampled down to `limit` when `totalPoints` exceeds it — read `sampled` to know if this happened. */
      points: unknown[];
      sampled: boolean;
    }
  | { mode: 'track'; icao: string; date: string; found: false; reason: string };

/** Evenly-spaced subsample (not just the first N) so a long day's track isn't
 * biased toward its early hours — same sampling shape a caller would want
 * from a full-day position history. */
function evenSample<T>(points: T[], limit: number): T[] {
  if (points.length <= limit) return points;
  const step = points.length / limit;
  const out: T[] = [];
  for (let i = 0; i < limit; i++) out.push(points[Math.floor(i * step)]);
  return out;
}

export async function aircraftHistory(input: AircraftHistoryInput, apiKey: string): Promise<AircraftHistoryResult> {
  const icao = input.icao24.trim().toLowerCase();

  if (!input.date) {
    const result = await getAircraftHistoryDates(icao, apiKey);
    return { mode: 'dates', icao, datesAvailable: result.dates };
  }

  try {
    const raw = await getAircraftHistoryTrace(icao, input.date, apiKey);
    const { trace, ...meta } = raw;
    const allPoints = Array.isArray(trace) ? trace : [];
    const points = evenSample(allPoints, input.limit);
    return {
      mode: 'track',
      icao,
      date: input.date,
      found: true,
      aircraft: meta,
      totalPoints: allPoints.length,
      points,
      sampled: points.length < allPoints.length,
    };
  } catch (err) {
    if (err instanceof V2ApiError && err.status === 404) {
      return { mode: 'track', icao, date: input.date, found: false, reason: err.message };
    }
    throw err;
  }
}
