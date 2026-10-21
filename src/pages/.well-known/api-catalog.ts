import type { APIRoute } from 'astro';

/**
 * Serves `/.well-known/api-catalog` — the API catalog of RFC 9727 (the Agent
 * Readiness scanner's `apiCatalog` check): a Linkset (RFC 9264) with the REST
 * API and the MCP server, each pointing at its machine-readable description
 * and its docs. The first object lists both as `item` (RFC 9727 A.2), the
 * others describe each one (A.1).
 *
 * The page is static, so the Content-Type set here only holds in `astro dev`:
 * on Cloudflare Pages it comes from public/_headers, together with the Link
 * header a HEAD request must carry (RFC 9727 section 2).
 */
const SITE = 'https://flyitalyadsb.com';
const API = 'https://api.flyitalyadsb.com/v2';
const MCP = `${SITE}/mcp`;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      linkset: [
        {
          anchor: `${SITE}/.well-known/api-catalog`,
          item: [{ href: API }, { href: MCP }],
        },
        {
          anchor: API,
          'service-desc': [{ href: `${SITE}/openapi.json`, type: 'application/json' }],
          'service-doc': [
            { href: `${SITE}/en/data/api/`, type: 'text/html', hreflang: ['en'] },
            { href: `${SITE}/dati/api/`, type: 'text/html', hreflang: ['it'] },
          ],
          'terms-of-service': [{ href: `${SITE}/en/terms/`, type: 'text/html' }],
          license: [{ href: 'https://creativecommons.org/licenses/by-sa/4.0/' }],
        },
        {
          anchor: MCP,
          'service-desc': [{ href: `${SITE}/.well-known/mcp/server-card.json`, type: 'application/json' }],
          'service-doc': [{ href: `${SITE}/en/data/api/#mcp`, type: 'text/html', hreflang: ['en'] }],
        },
      ],
    }),
    { headers: { 'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"' } },
  );
