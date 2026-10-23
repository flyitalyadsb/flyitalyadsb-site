// flyitalyadsb-status: the probes behind flyitalyadsb.com/stato/ (IT) and
// /en/status/ (EN). Every minute (cron, wrangler.jsonc) it checks the site,
// the map, the live data, the REST API, the MCP server, the history archive
// and the receiver network from Cloudflare's network, outside our cluster,
// and stores the results in a Durable Object (store.ts). The pages read
// GET flyitalyadsb.com/status.json, the only route of this Worker (Terraform,
// nesso-infra terraform/cloudflare/workers-flyitalyadsb-status.tf).

import { COMPONENTS } from './checks';
import { runProbes } from './probes';
import type { StatusStore } from './store';

export { StatusStore } from './store';

interface Env {
  STATUS: DurableObjectNamespace<StatusStore>;
  SITE: string;
  MAP: string;
  API_BASE: string;
  MONITOR_API_KEY?: string;
  SITE_PROBE_URL?: string;
}

const store = (env: Env) => env.STATUS.get(env.STATUS.idFromName('status'));

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

export default {
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    const minute = Math.floor(event.scheduledTime / 60_000);
    const due = new Set(COMPONENTS.filter((c) => minute % c.every === 0).map((c) => c.id));
    const st = store(env);
    const medians = await st.medians();
    const { results, network } = await runProbes(env, due, medians);
    await st.record(Math.floor(event.scheduledTime / 1000), results, network);
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname !== '/status.json' || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return new Response('Not found', { status: 404 });
    }
    // 30 s at the edge: the data changes once a minute, and a page left open
    // by many people must not become one Durable Object call per visitor.
    const cache = caches.default;
    const key = new Request(`${url.origin}/status.json`);
    const hit = await cache.match(key);
    if (hit) return hit;
    const body = JSON.stringify(await store(env).snapshot());
    const res = new Response(body, {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30', ...CORS },
    });
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
} satisfies ExportedHandler<Env>;
