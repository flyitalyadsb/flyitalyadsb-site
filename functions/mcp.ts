import { createMcpHandler } from 'mcp-handler';
import { initializeMcpServer } from '../src/lib/mcp/server';

/**
 * `/mcp` — the Streamable HTTP endpoint for FlyItalyADSB's agent-callable
 * tools. A Cloudflare Pages Function (not an Astro page route, since this
 * site builds fully static and this one endpoint genuinely needs to run per
 * request) living alongside the static `dist/` output of the same Pages
 * project — no separate deployment needed.
 *
 * `mcp-handler` v2 serves the 2026-07-28 MCP spec's stateless model natively
 * (no sessions) with a fallback for 2025-era Streamable HTTP clients, so
 * there's no session store to stand up here — matches nessodigitale.it's
 * `/mcp` (nesso-digitale-frontend#171), same dependency versions.
 *
 * Auth: same `X-Api-Key` convention as `api.flyitalyadsb.com/v2/*`, checked
 * here — not via `mcp-handler`'s OAuth-oriented `withMcpAuth`, which assumes
 * a real authorization server behind it (DCR/CIMD discovery, WWW-Authenticate
 * challenges) that doesn't exist for a static per-caller API key. A missing
 * header is rejected before the MCP protocol even starts; a present-but-wrong
 * key is the v2 API's problem (401), not decided here. There's no shared
 * server-side secret — every caller's own key is forwarded straight through,
 * so the v2 API's own rate limit/abuse accounting stays per real caller
 * instead of being pooled behind one fixed credential.
 */
interface PagesFunctionContext {
  request: Request;
  env: Record<string, string | undefined>;
}

const MISSING_KEY_BODY = JSON.stringify({
  error: 'missing_api_key',
  message:
    'This MCP server requires an X-Api-Key header — the same key used for api.flyitalyadsb.com/v2/*. Request one the same way you would for the REST API.',
});

export function onRequest(context: PagesFunctionContext): Promise<Response> | Response {
  const apiKey = context.request.headers.get('X-Api-Key');
  if (!apiKey) {
    return new Response(MISSING_KEY_BODY, { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const handler = createMcpHandler((server) => initializeMcpServer(server, apiKey), {
    serverInfo: { name: 'flyitalyadsb', version: '1.0.0' },
  });
  return handler(context.request);
}
