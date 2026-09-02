// Thin fetch wrapper around the flyitalyadsb v2 REST API
// (api.flyitalyadsb.com/v2/*, adsb.lol-style — see the companion PR building
// it). Every /v2/* call requires an `X-Api-Key` header; the CF edge WAF
// blocks the request entirely if it's absent, the API itself 401s if it's
// wrong. There's no server-side key here: `apiKey` is the MCP caller's own
// header value, extracted and forwarded as-is by functions/mcp.ts — never
// hardcoded, never a shared secret.

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
  if (res.status === 401) throw new V2ApiError(401, 'The flyitalyadsb API rejected this API key — check that your X-Api-Key is correct.');
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

export interface HistoryDatesResult {
  icao: string;
  count: number;
  dates: string[];
}

/** `/v2/history/{icao}/{date}` response: readsb's own `trace_full_<icao>.json`
 * shape (icao, r, t, dbFlags, desc, year, version, timestamp, trace: [...]),
 * forwarded byte-for-byte by the API — deliberately untyped beyond `trace`
 * since it's a pass-through, not a schema this client owns. */
export interface HistoryTrace {
  trace?: unknown[];
  [key: string]: unknown;
}

/** Separate from `v2Fetch`: `/v2/history/*`'s error bodies are more specific
 * than a generic "not found" (e.g. distinguishing "never seen that day" from
 * "moved to a private R2 bucket, not yet self-serve"), and an MCP-calling
 * agent benefits from that detail — the 3 existing tools' 404s don't carry
 * anything beyond "not found", so their generic message stays as-is. */
async function v2FetchHistory<T>(path: string, apiKey: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${V2_BASE}${path}`, {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new V2ApiError(0, `Network error reaching the flyitalyadsb API: ${(err as Error).message}`);
  }
  if (res.status === 401) throw new V2ApiError(401, 'The flyitalyadsb API rejected this API key — check that your X-Api-Key is correct.');
  if (res.status === 429) throw new V2ApiError(429, 'Rate limit exceeded on the flyitalyadsb API — try again shortly.');
  if (!res.ok) {
    let detail = `flyitalyadsb API returned ${res.status}.`;
    try {
      const body = (await res.json()) as { error?: string; oldest_available_date?: string };
      if (body?.error) {
        detail = body.oldest_available_date ? `${body.error} (oldest available: ${body.oldest_available_date})` : body.error;
      }
    } catch {
      // Not JSON (or already consumed) — fall back to the generic message above.
    }
    throw new V2ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export function getAircraftHistoryDates(icao: string, apiKey: string): Promise<HistoryDatesResult> {
  return v2FetchHistory(`/history/${encodeURIComponent(icao.trim().toLowerCase())}`, apiKey);
}

export function getAircraftHistoryTrace(icao: string, dateIso: string, apiKey: string): Promise<HistoryTrace> {
  return v2FetchHistory(`/history/${encodeURIComponent(icao.trim().toLowerCase())}/${encodeURIComponent(dateIso.trim())}`, apiKey);
}
