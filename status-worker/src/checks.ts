// What each component's probe looks at, and when it counts as up, degraded or
// down. Pure functions on purpose: test/checks.test.ts runs them with plain
// `node --test`, no Workers runtime needed. The fetching is in probes.ts.

export type Status = 'up' | 'degraded' | 'down';

export type ComponentId = 'site' | 'map' | 'live' | 'api' | 'history' | 'mcp' | 'feeders' | 'mlat';

export interface Result {
  component: ComponentId;
  status: Status;
  latencyMs: number | null;
  /** The number the page shows next to the component (aircraft, feeders…). */
  value: number | null;
  /** Short reason, in English, kept with the sample: "HTTP 502", "data 340 s old". */
  note: string | null;
}

/** Order on the page, and how often each one is probed (minutes). */
export const COMPONENTS: { id: ComponentId; every: number }[] = [
  { id: 'site', every: 1 },
  { id: 'map', every: 1 },
  { id: 'live', every: 1 },
  { id: 'api', every: 1 },
  { id: 'mcp', every: 1 },
  // /v2/history lists the aircraft's days on R2 too: every 5 minutes is
  // plenty for "is the archive answering", and keeps R2 list calls down.
  { id: 'history', every: 5 },
  { id: 'feeders', every: 1 },
  { id: 'mlat', every: 1 },
];

/** A response slower than this is "degraded", even with the right answer. */
export const SLOW_MS = 3000;
/** aircraft.json's own `now` older than these (seconds): degraded, then down. */
export const STALE_S = 30;
export const DEAD_S = 180;
/** Fewer aircraft than this worldwide means most inputs are missing. */
export const FEW_AIRCRAFT = 1000;
/** Feeders below these fractions of their 7-day median: degraded, then down. */
export const FEEDERS_LOW = 0.7;
export const FEEDERS_DOWN = 0.3;

export const worst = (a: Status, b: Status): Status =>
  a === 'down' || b === 'down' ? 'down' : a === 'degraded' || b === 'degraded' ? 'degraded' : 'up';

/** An HTTP probe that only has to answer the right thing, in time. */
export function classifyHttp(component: ComponentId, httpStatus: number | null, ok: boolean, latencyMs: number,
                             value: number | null = null, note: string | null = null): Result {
  if (httpStatus === null) return { component, status: 'down', latencyMs: null, value, note: note ?? 'no response' };
  if (!ok) return { component, status: 'down', latencyMs, value, note: note ?? `HTTP ${httpStatus}` };
  if (latencyMs >= SLOW_MS) return { component, status: 'degraded', latencyMs, value, note: note ?? `slow: ${latencyMs} ms` };
  return { component, status: 'up', latencyMs, value, note };
}

export interface Network {
  now: number | null;
  aircraft: number | null;
  aircraft_with_pos: number | null;
  messages_per_s: number | null;
  feeders_beast: number | null;
  feeders_mlat: number | null;
  mlat_shards_ok: number;
  mlat_shards: number;
}

/** Live data: aircraft.json is rewritten every 2 s, so its `now` says whether
 * the pipeline is moving. A 200 alone doesn't: stats-api keeps serving the
 * last good file when it can't read a new one. */
export function classifyLive(net: Network | null, wallClockS: number, latencyMs: number | null): Result {
  const r = (status: Status, note: string | null): Result =>
    ({ component: 'live', status, latencyMs, value: net?.aircraft ?? null, note });
  if (!net || net.now === null) return r('down', 'no data');
  const age = Math.max(0, Math.round(wallClockS - net.now));
  if (age > DEAD_S) return r('down', `data ${age} s old`);
  if (age > STALE_S) return r('degraded', `data ${age} s old`);
  if (net.aircraft !== null && net.aircraft < FEW_AIRCRAFT) return r('degraded', `${net.aircraft} aircraft`);
  return r('up', null);
}

/** Feeders against their own recent median: the count moves through the day
 * and grows over the months, so a fixed threshold would be wrong in both
 * directions. No median yet (the first day) means only zero is a problem. */
export function classifyCount(component: 'feeders' | 'mlat', value: number | null, median: number | null,
                              shardsOk = 1, shards = 1): Result {
  const r = (status: Status, note: string | null): Result => ({ component, status, latencyMs: null, value, note });
  if (component === 'mlat' && shards > 0 && shardsOk === 0) return r('down', 'no MLAT shard readable');
  if (value === null) return r('degraded', 'count unavailable');
  if (value === 0) return r('down', 'no receivers connected');
  let status: Status = 'up';
  let note: string | null = null;
  if (median !== null && median > 0) {
    if (value < FEEDERS_DOWN * median) status = 'down';
    else if (value < FEEDERS_LOW * median) status = 'degraded';
    if (status !== 'up') note = `${value} vs usual ${Math.round(median)}`;
  }
  if (component === 'mlat' && shardsOk < shards) {
    status = worst(status, 'degraded');
    note = `${shardsOk}/${shards} MLAT shards`;
  }
  return r(status, note);
}

/** Median of a list of numbers, or null if empty. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** UTC day of a timestamp in seconds: '2026-10-23'. */
export const utcDay = (ts: number): string => new Date(ts * 1000).toISOString().slice(0, 10);
