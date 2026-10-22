import { z } from 'zod';
import {
  getAircraftByCallsign,
  getAircraftByRegistration,
  getAircraftProfile,
  V2ApiError,
  type AircraftProfile,
} from '../v2-client';

export const aircraftProfileInputSchema = z.object({
  by: z
    .enum(['icao24', 'registration', 'callsign'])
    .default('icao24')
    .describe(
      'Which identifier `value` is. `icao24` (the 24-bit ICAO hex address) works for any aircraft with live data or ' +
        'recorded history. `registration` and `callsign` are resolved through the live feed, so they only work while ' +
        'the aircraft is being tracked, and cost one extra request.',
    ),
  value: z.string().trim().min(1).describe('The ICAO hex (e.g. "3c66a3"), registration (e.g. "I-ABCD") or callsign.'),
});
export type AircraftProfileInput = z.infer<typeof aircraftProfileInputSchema>;

export type AircraftProfileResult =
  | ({ found: true; resolvedFrom?: { by: 'registration' | 'callsign'; value: string }; photoNote: string } & AircraftProfile)
  | { found: false; by: AircraftProfileInput['by']; value: string; reason: string };

const HEX = /^[0-9a-f]{6}$/;

/** What the assistant should tell the user about photos. There is never an
 * image in the result: Planespotters.net's photo API terms forbid serving
 * their photos or data through another API (planespotters.net/photo/api),
 * and allow them only in public pages that credit the photographer and link
 * the photo — which the public map does, client-side. */
export function photoNote(profile: AircraftProfile): string {
  const { photos, links } = profile;
  if (photos.withheld) {
    const program = photos.withheld === 'pia' ? 'PIA (Privacy ICAO Address)' : 'FAA LADD';
    return (
      `No photo link: this aircraft is flagged ${program}, a privacy programme its owner joined, so FlyItalyADSB ` +
      'adds no third-party photos for it. Its live and history data are still included, flagged.'
    );
  }
  const map = links.map
    ? ` The map link (${links.map}) opens the aircraft on the public FlyItalyADSB map, whose aircraft panel shows a ` +
      'Planespotters.net photo with the photographer\'s name.'
    : '';
  return (
    'No photo is embedded: Planespotters.net\'s API terms don\'t allow passing their photos through another ' +
    `service. If the user wants photos, give them the link ${photos.page} (photos on ${photos.provider}, each ` +
    `credited to its photographer).${map}`
  );
}

export async function aircraftProfile(input: AircraftProfileInput, apiKey: string): Promise<AircraftProfileResult> {
  const notFound = (reason: string): AircraftProfileResult => ({ found: false, by: input.by, value: input.value, reason });
  let icao = input.value.trim().toLowerCase();
  let resolvedFrom: { by: 'registration' | 'callsign'; value: string } | undefined;

  if (input.by !== 'icao24') {
    try {
      const live =
        input.by === 'registration'
          ? await getAircraftByRegistration(input.value, apiKey)
          : await getAircraftByCallsign(input.value, apiKey);
      icao = String(live.hex ?? '').toLowerCase();
      resolvedFrom = { by: input.by, value: input.value };
    } catch (err) {
      if (err instanceof V2ApiError && err.status === 404) {
        return notFound(
          `No aircraft with this ${input.by} is being tracked right now, and ${input.by}s are resolved only through ` +
            'the live feed. For an aircraft that is not flying now, call again with its ICAO hex (by: "icao24").',
        );
      }
      throw err;
    }
    if (!HEX.test(icao)) {
      // A leading ~ marks a non-ICAO address (TIS-B, ADS-R): there is no history to profile.
      return notFound(`This ${input.by} is tracked under a non-ICAO address (${icao}), which has no profile.`);
    }
  } else if (!HEX.test(icao)) {
    return notFound('An ICAO hex address is 6 hexadecimal characters, e.g. "3c66a3".');
  }

  try {
    const profile = await getAircraftProfile(icao, apiKey);
    return { found: true, ...(resolvedFrom ? { resolvedFrom } : {}), ...profile, photoNote: photoNote(profile) };
  } catch (err) {
    if (err instanceof V2ApiError && err.status === 404) {
      return notFound('FlyItalyADSB is not receiving this aircraft now and has no recorded history for it.');
    }
    throw err;
  }
}
