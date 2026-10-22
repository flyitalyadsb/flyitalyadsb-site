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
      'MCP server for flyitalyadsb.com: read-only aircraft-tracking queries over the FlyItalyADSB open ADS-B/MLAT network — live (by identifier, by location, or by military/privacy/LADD category) and historical (a day\'s position track for one aircraft, self-serve since 2022, with gaps; what flew over a place in a time window), plus a one-call aircraft profile and notable traffic (emergencies, military) by area. On MCP Apps hosts, aircraft results also render as an interactive map. Sign in with OAuth 2.1 (assistants with OAuth connectors, such as claude.ai: email and a 6-digit code, discovery from the 401) or send an X-Api-Key header — the same key as api.flyitalyadsb.com/v2/*. See /auth.md.',
    url: `${SITE}/mcp`,
    transport: { type: 'streamable-http' },
    capabilities: { tools: true, resources: true },
    authentication: { type: 'api-key', in: 'header', name: 'X-Api-Key' },
  });
};
