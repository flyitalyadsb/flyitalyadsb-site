// Thin fetch wrapper around the flyitalyadsb v2 REST API
// (api.flyitalyadsb.com/v2/*, adsb.lol-style — see the companion PR building
// it). Every /v2/* call requires an `X-Api-Key` header; the CF edge WAF
// blocks the request entirely if it's absent, the API itself 401s if it's
// wrong. There's no server-side key here: `apiKey` is the MCP caller's own
// header value, extracted and forwarded as-is by functions/mcp.ts — never
// hardcoded, never a shared secret.

export let V2_BASE = 'https://api.flyitalyadsb.com/v2';

/** The mcp-worker points this at a local public-api under `wrangler dev`
 * (its API_BASE var); production keeps the default. */
export function setV2Base(base: string): void {
  V2_BASE = `${base.replace(/\/+$/, '')}/v2`;
}

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

/** The error for a 401/403/429, with the API's `help` link to the FAQ answer
 * when the body has one, so the assistant can tell the user what to do.
 * `own`: use the API's own `error` text (the 403 says which radius the plan
 * allows), otherwise `message`. An edge block is HTML, not JSON: then
 * `message` alone. */
async function errorWithHelp(res: Response, message: string, own = false): Promise<V2ApiError> {
  let body: { error?: unknown; help?: unknown } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // not JSON
  }
  const text = own && typeof body.error === 'string' ? `${body.error}.` : message;
  const help = typeof body.help === 'string' ? ` What to do: ${body.help}` : '';
  return new V2ApiError(res.status, `${text}${help}`);
}

const KEY_REJECTED = 'The flyitalyadsb API rejected this API key — check that your X-Api-Key is correct.';
const RATE_LIMITED = 'Rate limit exceeded on the flyitalyadsb API — try again shortly.';

/** GET `path`, or POST `body` as JSON when one is given. */
async function v2Fetch<T>(path: string, apiKey: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${V2_BASE}${path}`, {
      ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      // Lowercase name required: this call runs inside a Cloudflare Pages
      // Function, and a Worker's fetch() to another zone on the SAME
      // Cloudflare account apparently doesn't get re-lowercased the way a
      // real internet-arriving HTTP/2 request always is (HTTP/2 mandates
      // lowercase header names in transit) — the edge WAF's exact-match
      // `http.request.headers.names[*] eq "x-api-key"` then sees the
      // mixed-case name as absent and blocks with a 403, even though the
      // header genuinely was set. A real external client (curl, a browser,
      // any HTTP library) is unaffected: their own stack lowercases the
      // name before it ever reaches Cloudflare, so this only bit our own
      // MCP server calling our own REST API. Verified live 2026-09-02.
      headers: { 'x-api-key': apiKey, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new V2ApiError(0, `Network error reaching the flyitalyadsb API: ${(err as Error).message}`);
  }
  if (res.status === 404) throw new V2ApiError(404, 'No matching aircraft found.');
  if (res.status === 401) throw await errorWithHelp(res, KEY_REJECTED);
  if (res.status === 429) throw await errorWithHelp(res, RATE_LIMITED);
  if (res.status === 403) throw await errorWithHelp(res, 'The flyitalyadsb API refused this request.', true);
  // The API says which parameter is wrong (e.g. /events' "since can be at most 7 days ago").
  if (res.status === 400) throw await errorWithHelp(res, 'The flyitalyadsb API refused these parameters.', true);
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

/** The position saved on the key's account (public-api locations.py), for
 * "aircraft near me": rounded to ~1 km, at most one per account. Reading it
 * isn't counted as a request. */
export interface SavedLocation {
  lat: number;
  lon: number;
  label: string | null;
  updated_at: string;
}

export async function getMyLocation(apiKey: string): Promise<SavedLocation | null> {
  return (await v2Fetch<{ location: SavedLocation | null }>('/me/location', apiKey)).location;
}

export async function saveMyLocation(lat: number, lon: number, label: string | undefined, apiKey: string): Promise<SavedLocation> {
  return (await v2Fetch<{ location: SavedLocation }>('/me/location', apiKey, { lat, lon, label })).location;
}

export async function clearMyLocation(apiKey: string): Promise<void> {
  await v2Fetch('/me/location/clear', apiKey, {});
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
 * than a generic "not found" (e.g. "no trace data for this icao on this date"
 * vs "archive temporarily unavailable" when the archive read fails), and an MCP-calling
 * agent benefits from that detail — the 3 existing tools' 404s don't carry
 * anything beyond "not found", so their generic message stays as-is. */
async function v2FetchHistory<T>(path: string, apiKey: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${V2_BASE}${path}`, {
      // Lowercase name required — see the comment in v2Fetch above.
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new V2ApiError(0, `Network error reaching the flyitalyadsb API: ${(err as Error).message}`);
  }
  if (res.status === 401) throw await errorWithHelp(res, KEY_REJECTED);
  if (res.status === 429) throw await errorWithHelp(res, RATE_LIMITED);
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

/** `/v2/profile/{icao}` (public-api aircraft_profile.py): one aircraft's
 * identity, live status and history summary in one counted request. Never
 * carries owner/operator names. No photo: Planespotters.net's API terms
 * forbid re-serving their data through another API, so `photos.page` is only
 * a link to their public page (null when withheld for PIA/LADD aircraft). */
export interface AircraftProfile {
  icao: string;
  identity: {
    registration: string | null;
    icao_type: string | null;
    type_description: string | null;
    year: number | null;
    db_flags: number;
    military: boolean;
    interesting: boolean;
    pia: boolean;
    ladd: boolean;
    /** The day whose recorded track supplied type_description/year, if any. */
    trace_day: string | null;
  };
  live: {
    seen_now: boolean;
    now?: number;
    callsign?: string | null;
    /** Where the current position comes from: adsb_icao, mlat, tisb_icao, adsr_icao… */
    source?: string | null;
    lat?: number;
    lon?: number;
    alt_baro?: number | 'ground';
    seen?: number;
    seen_pos?: number;
    [key: string]: unknown;
  };
  history: {
    first_day: string | null;
    last_day: string | null;
    days_last_30: number;
    total_days: number;
    archive_unavailable?: boolean;
  };
  links: { map: string | null; history: string };
  photos: { page: string | null; provider: string; withheld: 'pia' | 'ladd' | null };
}

/** Through `v2FetchHistory` for its error detail: a profile's 503 says the
 * archive is briefly down, and its 404 that there's neither live data nor
 * history for the address. */
export function getAircraftProfile(icao: string, apiKey: string): Promise<AircraftProfile> {
  return v2FetchHistory(`/profile/${encodeURIComponent(icao.trim().toLowerCase())}`, apiKey);
}

/** One aircraft whose recorded track passed through the circle — public-api
 * overflights.py. Aircraft metadata is whitelisted there (r, t, desc,
 * dbFlags): never the owner/operator. */
export interface Overflight {
  icao: string;
  r: string | null;
  t: string | null;
  desc: string | null;
  dbFlags: number;
  callsigns: string[];
  closest_time: string;
  closest_ts: number;
  closest_km: number;
  closest_alt_ft: number | 'ground' | null;
  min_alt_ft: number | 'ground' | null;
  entered: string;
  left: string;
  passes: number;
  /** Received positions inside the circle; 0 = the pass is a straight line between positions outside it. */
  positions: number;
  source: 'adsb' | 'mlat' | 'tisb' | 'other';
  sources: string[];
  history: string[];
}

export interface OverflightsResult {
  lat: number;
  lon: number;
  dist_km: number;
  from: string;
  to: string;
  max_alt_ft: number | null;
  count: number;
  truncated: boolean;
  complete_until: string | null;
  coverage: { complete: boolean; gaps: Array<{ from: string; to: string; reason: string }> };
  candidates: number;
  overflights: Overflight[];
}

export interface OverflightsQuery {
  lat: number;
  lon: number;
  distKm: number;
  from: string;
  to: string;
  maxAltFt?: number;
  limit?: number;
}

/** `/v2/overflights`. Its own fetch, not `v2Fetch`: a 400/403 here says what
 * to change (radius or window above the plan, a bad time), so the API's own
 * `error` and `help` go back to the assistant; a search can also take a few
 * seconds (up to ~4.5 s of work plus a short queue on the API side). */
export async function getOverflights(q: OverflightsQuery, apiKey: string): Promise<OverflightsResult> {
  const params = new URLSearchParams({
    lat: String(q.lat),
    lon: String(q.lon),
    dist: String(q.distKm),
    from: q.from,
    to: q.to,
  });
  if (q.maxAltFt !== undefined) params.set('max_alt_ft', String(q.maxAltFt));
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  let res: Response;
  try {
    res = await fetch(`${V2_BASE}/overflights?${params}`, {
      // Lowercase name required — see the comment in v2Fetch above.
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    throw new V2ApiError(0, `Network error reaching the flyitalyadsb API: ${(err as Error).message}`);
  }
  if (res.status === 401) throw await errorWithHelp(res, KEY_REJECTED);
  if (res.status === 429) throw await errorWithHelp(res, RATE_LIMITED);
  if (!res.ok) throw await errorWithHelp(res, `flyitalyadsb API returned ${res.status}.`, true);
  return res.json() as Promise<OverflightsResult>;
}

/** One notable-traffic event from `/v2/events` (public-api events.py): an
 * emergency (squawk 7500/7600/7700 or readsb's `emergency`), a military or an
 * "interesting" aircraft (dbFlags), recorded when it entered a ~0.5° cell.
 * Aircraft fields keep readsb's names; `source` is readsb's `type` (adsb_icao,
 * mlat, ...). */
export type EventKind = 'emergency' | 'military' | 'interesting';

export interface TrafficEvent {
  id: number;
  kind: EventKind;
  /** Emergencies only: general, hijack, radio_failure, minimum_fuel, downed. */
  reason?: string;
  hex: string;
  /** ISO 8601, UTC. */
  time: string;
  lat: number;
  lon: number;
  distance_km?: number;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  squawk?: string;
  emergency?: string;
  source?: string;
  dbFlags?: number;
  map?: string;
  [key: string]: unknown;
}

export interface EventsResult {
  now: number;
  since: string;
  until: string;
  center: { lat: number; lon: number };
  dist: number;
  kinds: EventKind[];
  count: number;
  /** More events matched than `limit` returned. */
  truncated: boolean;
  events: TrafficEvent[];
}

export interface EventsQuery {
  lat: number;
  lon: number;
  distKm: number;
  /** Unix seconds. */
  since?: number;
  kinds?: EventKind[];
  limit?: number;
}

/** Notable traffic within a radius since a time; counted as one request, the
 * plan's radius applies (403 above it). */
export function getNotableEvents(q: EventsQuery, apiKey: string): Promise<EventsResult> {
  const params = new URLSearchParams({ lat: String(q.lat), lon: String(q.lon), dist: String(q.distKm) });
  if (q.since !== undefined) params.set('since', String(Math.floor(q.since)));
  if (q.kinds?.length) params.set('kinds', q.kinds.join(','));
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  return v2Fetch(`/events?${params}`, apiKey);
}
