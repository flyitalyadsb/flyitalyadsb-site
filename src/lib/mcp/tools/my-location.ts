import { z } from 'zod';
import { clearMyLocation, saveMyLocation } from '../v2-client';

/** set_my_location / clear_my_location: the position saved on the user's
 * account (public-api locations.py), which aircraft_near uses when the user
 * asks about aircraft near them without saying where. No assistant passes the
 * device's position to an MCP server, so the user states it once, in chat or
 * from My API. The API rounds it to ~1 km and keeps one per account. */

export const setMyLocationInputSchema = z.object({
  lat: z.number().min(-90).max(90).describe('Latitude of the place the user named; a town centre is enough.'),
  lon: z.number().min(-180).max(180).describe('Longitude of the place the user named.'),
  label: z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe('A short name the user will recognise, e.g. "Brescia" or "Home".'),
});
export type SetMyLocationInput = z.infer<typeof setMyLocationInputSchema>;

export const clearMyLocationInputSchema = z.object({});

export async function setMyLocation(input: SetMyLocationInput, apiKey: string) {
  const saved = await saveMyLocation(input.lat, input.lon, input.label || undefined, apiKey);
  return {
    saved: { label: saved.label, lat: saved.lat, lon: saved.lon },
    note:
      'Stored rounded to about 1 km, as the only position of this account. aircraft_near uses it when ' +
      'called without a place. The user can remove it with clear_my_location or from My API.',
  };
}

export async function forgetMyLocation(apiKey: string) {
  await clearMyLocation(apiKey);
  return { cleared: true };
}
