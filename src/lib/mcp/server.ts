import type { McpServer, ToolAnnotations } from '@modelcontextprotocol/server';
import { aircraftNear, aircraftNearInputSchema } from './tools/aircraft-near';
import { findAircraft, findAircraftInputSchema } from './tools/find-aircraft';
import { specialTraffic, specialTrafficInputSchema } from './tools/special-traffic';
import { V2ApiError } from './v2-client';

/** Single source of truth for name/title/description/schema, shared by the
 * MCP server registration and the `.well-known` discoverability routes so
 * they can never drift from what's actually registered. */
export const TOOLS = {
  find_aircraft: {
    title: 'Find a specific aircraft',
    description:
      'Look up one specific aircraft currently tracked by the FlyItalyADSB network, by its 24-bit ICAO hex address, callsign/flight number, or tail registration.',
    inputSchema: findAircraftInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    } satisfies ToolAnnotations,
  },
  aircraft_near: {
    title: 'Aircraft near a location',
    description:
      'List every aircraft the FlyItalyADSB network currently sees within a radius of an Italian airport or a lat/lon point — full live records (position, altitude, speed, type), not just a count.',
    inputSchema: aircraftNearInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    } satisfies ToolAnnotations,
  },
  special_traffic: {
    title: 'Military / privacy / LADD traffic',
    description:
      'List aircraft currently tracked network-wide that are flagged military, PIA (Privacy ICAO Address), or LADD (FAA Limiting Aircraft Data Displayed) — thanks to FlyItalyADSB\'s own MLAT, this includes aircraft without full ADS-B.',
    inputSchema: specialTrafficInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    } satisfies ToolAnnotations,
  },
} as const;

export function toolRegistry(): Array<{ name: string; title: string; description: string }> {
  return Object.entries(TOOLS).map(([name, tool]) => ({ name, title: tool.title, description: tool.description }));
}

function errorResult(err: unknown) {
  const message = err instanceof V2ApiError ? err.message : err instanceof Error ? err.message : 'Unknown error.';
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

/** Registers all three tools on a fresh `McpServer` instance. `apiKey` comes
 * from the Pages Function's `env.FLYITALYADSB_V2_API_KEY` binding — never
 * hardcoded, never echoed back in any tool response or error. */
export function initializeMcpServer(server: McpServer, apiKey: string | undefined): void {
  server.registerTool('find_aircraft', TOOLS.find_aircraft, async (args) => {
    if (!apiKey) return errorResult(new Error('The flyitalyadsb API key is not configured on this deployment.'));
    try {
      const result = await findAircraft(args, apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('aircraft_near', TOOLS.aircraft_near, async (args) => {
    if (!apiKey) return errorResult(new Error('The flyitalyadsb API key is not configured on this deployment.'));
    try {
      const result = await aircraftNear(args, apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('special_traffic', TOOLS.special_traffic, async (args) => {
    if (!apiKey) return errorResult(new Error('The flyitalyadsb API key is not configured on this deployment.'));
    try {
      const result = await specialTraffic(args, apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });
}
