// flyitalyadsb-status: the probes behind flyitalyadsb.com/stato/ (IT) and
// /en/status/ (EN). Every minute it checks the site, the map, the live data,
// the REST API, the MCP server, the history archive and the receiver network
// from Cloudflare's network, outside our cluster, and stores the results in a
// Durable Object (store.ts), whose alarm runs the passes (tick.ts). The pages
// read GET flyitalyadsb.com/status.json, the only route of this Worker
// (Terraform, nesso-infra terraform/cloudflare/workers-flyitalyadsb-status.tf).

import type { StatusStore } from './store';
import type { TickEnv } from './tick';

export { StatusStore } from './store';

interface Env extends TickEnv {
  STATUS: DurableObjectNamespace<StatusStore>;
}

const store = (env: Env) => env.STATUS.get(env.STATUS.idFromName('status'));

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

export default {
  /** A watchdog, not the clock: the passes run on the Durable Object's alarm.
   * This only (re)starts that loop after a deploy or if it ever stops. */
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await store(env).ensureTicking();
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
