import { z } from 'zod';
import { getSpecialTraffic, type AircraftRecord, type SpecialCategory } from '../v2-client';

const CATEGORY_MAP: Record<'military' | 'privacy' | 'ladd', SpecialCategory> = {
  military: 'mil',
  privacy: 'pia',
  ladd: 'ladd',
};

export const specialTrafficInputSchema = z.object({
  category: z
    .enum(['military', 'privacy', 'ladd'])
    .describe(
      '"military": aircraft flagged military in the ICAO database. "privacy": PIA (Privacy ICAO Address) aircraft, which rotate their hex to avoid tracking. "ladd": aircraft in the FAA Limiting Aircraft Data Displayed program.',
    ),
  limit: z.number().int().positive().max(200).default(50),
});
export type SpecialTrafficInput = z.infer<typeof specialTrafficInputSchema>;

export interface SpecialTrafficResult {
  category: SpecialTrafficInput['category'];
  now: number;
  count: number;
  aircraft: AircraftRecord[];
}

/** Pre-filtered server-side on the `dbFlags` bits — the filtering IS the
 * endpoint, there's no client-side flag to check on a generic record. */
export async function specialTraffic(input: SpecialTrafficInput, apiKey: string): Promise<SpecialTrafficResult> {
  const result = await getSpecialTraffic(CATEGORY_MAP[input.category], apiKey);
  return {
    category: input.category,
    now: result.now,
    count: result.count,
    aircraft: result.ac.slice(0, input.limit),
  };
}
