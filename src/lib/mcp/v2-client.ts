// Thin fetch wrapper around the flyitalyadsb v2 REST API
// (api.flyitalyadsb.com/v2/*, adsb.lol-style — see the companion PR building
// it). Every /v2/* call requires an `X-Api-Key` header; the CF edge WAF
// blocks the request entirely if it's absent, the API itself 401s if it's
// wrong. The key is never hardcoded — it's read from the Pages Function's
// `env.FLYITALYADSB_V2_API_KEY` binding by the caller and passed in here.

export const V2_BASE = 'https://api.flyitalyadsb.com/v2';

/** Raw readsb-style aircraft record — field set matches dump1090/readsb's
 * aircraft.json (the same shape adsb.lol and tar1090 expose), not curated
 * down, since an agent asking for a specific aircraft wants the real data. */
export interface AircraftRecord {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  squawk?: string;
  category?: string;
  dbFlags?: number;
  [key: string]: unknown;
}

export interface RadiusResult {
  now: number;
  count: number;
  ac: AircraftRecord[];
}

export class V2ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'V2ApiError';
  }
}

async function v2Fetch<T>(path: string, apiKey: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${V2_BASE}${path}`, {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new V2ApiError(0, `Network error reaching the flyitalyadsb API: ${(err as Error).message}`);
  }
  if (res.status === 404) throw new V2ApiError(404, 'No matching aircraft found.');
  if (res.status === 401) throw new V2ApiError(401, 'The flyitalyadsb API rejected the configured API key.');
  if (res.status === 429) throw new V2ApiError(429, 'Rate limit exceeded on the flyitalyadsb API — try again shortly.');
  if (!res.ok) throw new V2ApiError(res.status, `flyitalyadsb API returned ${res.status}.`);
  return res.json() as Promise<T>;
}

export function getAircraftByIcao(hex: string, apiKey: string): Promise<AircraftRecord> {
  return v2Fetch(`/icao/${encodeURIComponent(hex.trim().toLowerCase())}`, apiKey);
}

export function getAircraftByCallsign(callsign: string, apiKey: string): Promise<AircraftRecord> {
  return v2Fetch(`/callsign/${encodeURIComponent(callsign.trim())}`, apiKey);
}

export function getAircraftByRegistration(reg: string, apiKey: string): Promise<AircraftRecord> {
  return v2Fetch(`/reg/${encodeURIComponent(reg.trim())}`, apiKey);
}

export function getAircraftNear(lat: number, lon: number, distKm: number, apiKey: string): Promise<RadiusResult> {
  return v2Fetch(`/lat/${lat}/lon/${lon}/dist/${distKm}`, apiKey);
}

export type SpecialCategory = 'mil' | 'pia' | 'ladd';

export function getSpecialTraffic(category: SpecialCategory, apiKey: string): Promise<RadiusResult> {
  return v2Fetch(`/${category}`, apiKey);
}
