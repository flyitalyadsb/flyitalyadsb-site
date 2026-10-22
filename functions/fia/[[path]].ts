// PostHog through our own domain (Cloudflare Pages Function): every request
// under flyitalyadsb.com/fia/ goes to PostHog EU, static assets (/static/*,
// /array/*) to its assets host, as PostHog's self-hosted proxy reference asks.
// Blocklists know PostHog's hosts, not this path. The site
// (src/lib/analytics.ts) and the map (nesso-infra
// k8s/flyitalyadsb/base/mappa-analytics) both send here.
//
// Only /fia/* runs this Function: Pages builds _routes.json from the functions
// directory, so the static site never invokes it.

const API_HOST = 'eu.i.posthog.com';
const ASSET_HOST = 'eu-assets.i.posthog.com';
const PREFIX = '/fia';

export async function onRequest({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(PREFIX.length) || '/';
  const host = path.startsWith('/static/') || path.startsWith('/array/') ? ASSET_HOST : API_HOST;

  const headers = new Headers(request.headers);
  // Our cookies (PostHog's own included) are for the browser, not PostHog's
  // servers: posthog-js sends everything it needs in the request itself.
  headers.delete('cookie');
  // The visitor's address, for PostHog's GeoIP; without it every visitor
  // would be located at the Cloudflare data centre.
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-forwarded-for', ip);

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body;
  return fetch(`https://${host}${path}${url.search}`, { method: request.method, headers, body, redirect: 'manual' });
}
