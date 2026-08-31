import { z } from 'zod';
import {
  getAircraftByCallsign,
  getAircraftByIcao,
  getAircraftByRegistration,
  V2ApiError,
  type AircraftRecord,
} from '../v2-client';

export const findAircraftInputSchema = z.object({
  by: z
    .enum(['icao24', 'callsign', 'registration'])
    .describe('Which identifier `value` is: the 24-bit ICAO hex address, the flight/callsign, or the tail registration.'),
  value: z.string().trim().min(1),
});
export type FindAircraftInput = z.infer<typeof findAircraftInputSchema>;

export type FindAircraftResult =
  | { found: true; aircraft: AircraftRecord }
  | { found: false; by: FindAircraftInput['by']; value: string };

export async function findAircraft(input: FindAircraftInput, apiKey: string): Promise<FindAircraftResult> {
  try {
    const aircraft =
      input.by === 'icao24'
        ? await getAircraftByIcao(input.value, apiKey)
        : input.by === 'callsign'
          ? await getAircraftByCallsign(input.value, apiKey)
          : await getAircraftByRegistration(input.value, apiKey);
    return { found: true, aircraft };
  } catch (err) {
    if (err instanceof V2ApiError && err.status === 404) {
      return { found: false, by: input.by, value: input.value };
    }
    throw err;
  }
}
