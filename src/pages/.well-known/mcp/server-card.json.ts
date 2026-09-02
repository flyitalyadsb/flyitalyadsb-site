import type { APIRoute } from 'astro';

/**
 * Serves `/.well-known/mcp/server-card.json` — the Agent Readiness scanner's
 * `mcpServerCard` check. Shape mirrors nessodigitale.it's own (SEP-1649-era;
 * the MCP spec's server-discovery proposal is still moving, revisit if it
 * changes). Generated at build time, same "no hand-maintained static file"
 * convention as `sitemap.xml.ts`.
 */
const SITE = 'https://flyitalyadsb.com';

export const GET: APIRoute = () => {
  return Response.json({
    serverInfo: { name: 'flyitalyadsb', version: '1.0.0' },
    description:
      'MCP server for flyitalyadsb.com: read-only aircraft-tracking queries over the FlyItalyADSB open ADS-B/MLAT network — live (by identifier, by location, or by military/privacy/LADD category) and historical (a day\'s position track for one aircraft, self-serve for recent days). Requires an X-Api-Key header — same key as api.flyitalyadsb.com/v2/*.',
    url: `${SITE}/mcp`,
    transport: { type: 'streamable-http' },
    capabilities: { tools: true },
    authentication: { type: 'api-key', in: 'header', name: 'X-Api-Key' },
  });
};
