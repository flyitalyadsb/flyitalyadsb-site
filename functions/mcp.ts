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
 * The v2 API key is a Pages Function environment secret
 * (`FLYITALYADSB_V2_API_KEY`), never hardcoded — see `.env.example`. If it's
 * unset, tool calls return a clear `isError` result instead of crashing the
 * endpoint (see `initializeMcpServer`).
 */
interface PagesFunctionContext {
  request: Request;
  env: { FLYITALYADSB_V2_API_KEY?: string };
}

export function onRequest(context: PagesFunctionContext): Promise<Response> {
  const handler = createMcpHandler(
    (server) => initializeMcpServer(server, context.env.FLYITALYADSB_V2_API_KEY),
    { serverInfo: { name: 'flyitalyadsb', version: '1.0.0' } },
  );
  return handler(context.request);
}
