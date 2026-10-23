// The probes, run from Cloudflare's network once a minute (cron in
// wrangler.jsonc): the same public URLs a visitor or a customer uses, never a
// shortcut into the cluster. A probe that fails is retried once after a short
// pause before the component is marked down, so one lost packet isn't an outage.

import {
  classifyCount, classifyHttp, classifyLive,
  type ComponentId, type Network, type Result,
} from './checks';

export interface ProbeEnv {
  SITE: string;
  MAP: string;
  API_BASE: string;
  /** Keyed (fiaent_) key of ops-status@nessolabs.it, 30/min. Secret. */
  MONITOR_API_KEY?: string;
  /** Only for a local preview against `astro dev`: what the site probe
   * downloads. Unset in production: `${SITE}/stato/feed.xml`. */
  SITE_PROBE_URL?: string;
}

const UA = 'flyitalyadsb-status/1.0 (+https://flyitalyadsb.com/stato/)';
const TIMEOUT_MS = 10_000;
/** Reference aircraft for /v2/history: any ICAO works, this one has months of days. */
const HISTORY_ICAO = 'aa3b92';
/** Milan, 250 km: always traffic, small answer. */
const API_PROBE = '/v2/lat/45.4642/lon/9.19/dist/250';

interface Timed {
  status: number | null;
  ms: number;
  body: string;
}

async function get(url: string, init: RequestInit = {}): Promise<Timed> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      // Lowercase header names on purpose: a Worker's fetch keeps the casing,
      // and the zone's WAF matches names exactly (src/lib/mcp/v2-client.ts).
      headers: { 'user-agent': UA, ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'manual',
    });
    const body = await res.text();
    return { status: res.status, ms: Date.now() - t0, body };
  } catch {
    return { status: null, ms: Date.now() - t0, body: '' };
  }
}

const keyed = (env: ProbeEnv): Record<string, string> =>
  env.MONITOR_API_KEY ? { 'x-api-key': env.MONITOR_API_KEY } : {};

async function site(env: ProbeEnv): Promise<Result> {
  // The status feed: a static file of the current Pages deployment, like
  // every page, and exempt from the zone's bot rules (it's for feed readers).
  const r = await get(env.SITE_PROBE_URL || `${env.SITE}/stato/feed.xml`);
  return classifyHttp('site', r.status, r.status === 200 && r.body.includes('<feed'), r.ms);
}

async function map(env: ProbeEnv): Promise<Result> {
  const r = await get(`${env.MAP}/`);
  return classifyHttp('map', r.status, r.status === 200 && /tar1090|<html/i.test(r.body), r.ms);
}

async function network(env: ProbeEnv): Promise<{ net: Network | null; ms: number }> {
  const r = await get(`${env.API_BASE}/api/network.json`);
  if (r.status !== 200) return { net: null, ms: r.ms };
  try {
    return { net: JSON.parse(r.body) as Network, ms: r.ms };
  } catch {
    return { net: null, ms: r.ms };
  }
}

async function api(env: ProbeEnv): Promise<Result> {
  const r = await get(`${env.API_BASE}${API_PROBE}`, { headers: keyed(env) });
  let count: number | null = null;
  let ok = false;
  if (r.status === 200) {
    try {
      const d = JSON.parse(r.body) as { ac?: unknown[] };
      ok = Array.isArray(d.ac);
      count = ok ? (d.ac as unknown[]).length : null;
    } catch {
      ok = false;
    }
  }
  if (r.status === 429) return { component: 'api', status: 'degraded', latencyMs: r.ms, value: null, note: 'HTTP 429' };
  return classifyHttp('api', r.status, ok, r.ms, count, ok ? null : r.status === 200 ? 'unexpected body' : null);
}

async function history(env: ProbeEnv): Promise<Result> {
  const r = await get(`${env.API_BASE}/v2/history/${HISTORY_ICAO}`, { headers: keyed(env) });
  if (r.status === 200) {
    try {
      const d = JSON.parse(r.body) as { count?: number; archive_unavailable?: boolean };
      if (d.archive_unavailable) {
        return { component: 'history', status: 'degraded', latencyMs: r.ms, value: d.count ?? null, note: 'archive (R2) unavailable' };
      }
      return classifyHttp('history', 200, typeof d.count === 'number', r.ms, d.count ?? null);
    } catch {
      return classifyHttp('history', 200, false, r.ms, null, 'unexpected body');
    }
  }
  return classifyHttp('history', r.status, false, r.ms);
}

async function mcp(env: ProbeEnv): Promise<Result> {
  // A real MCP handshake with the monitor key: the Worker, then the API behind it.
  const r = await get(`${env.SITE}/mcp`, {
    method: 'POST',
    headers: {
      ...keyed(env),
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'flyitalyadsb-status', version: '1.0' } },
    }),
  });
  return classifyHttp('mcp', r.status, r.status === 200 && r.body.includes('serverInfo'), r.ms);
}

/** One pass, plus one retry for whatever came back down. `due` is the set of
 * components probed this minute; medians are the feeders' 7-day medians. */
export async function runProbes(env: ProbeEnv, due: Set<ComponentId>,
                                medians: { feeders: number | null; mlat: number | null },
                                wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))):
  Promise<{ results: Result[]; network: Network | null }> {
  const once = async (): Promise<{ results: Result[]; network: Network | null }> => {
    const jobs: Promise<Result | null>[] = [];
    const needNet = due.has('live') || due.has('feeders') || due.has('mlat');
    const netP = needNet ? network(env) : Promise.resolve({ net: null, ms: 0 });
    if (due.has('site')) jobs.push(site(env));
    if (due.has('map')) jobs.push(map(env));
    if (due.has('api')) jobs.push(api(env));
    if (due.has('history')) jobs.push(history(env));
    if (due.has('mcp')) jobs.push(mcp(env));
    const { net, ms } = await netP;
    const results = (await Promise.all(jobs)).filter((x): x is Result => x !== null);
    if (due.has('live')) results.push(classifyLive(net, Date.now() / 1000, needNet ? ms : null));
    if (due.has('feeders')) {
      results.push(net ? classifyCount('feeders', net.feeders_beast, medians.feeders)
        : { component: 'feeders', status: 'degraded', latencyMs: null, value: null, note: 'count unavailable' });
    }
    if (due.has('mlat')) {
      results.push(net ? classifyCount('mlat', net.feeders_mlat, medians.mlat, net.mlat_shards_ok, net.mlat_shards)
        : { component: 'mlat', status: 'degraded', latencyMs: null, value: null, note: 'count unavailable' });
    }
    return { results, network: net };
  };

  const first = await once();
  const failed = new Set(first.results.filter((r) => r.status === 'down').map((r) => r.component));
  if (!failed.size) return first;
  await wait(3000);
  // Retrying the whole pass costs a handful of requests and keeps one code
  // path; only the verdicts of the components that failed are taken from it.
  const second = await once();
  const results = first.results.map((r) => (failed.has(r.component) ? second.results.find((x) => x.component === r.component) ?? r : r));
  return { results, network: second.network ?? first.network };
}
