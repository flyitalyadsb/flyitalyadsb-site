import type { McpServer, ToolAnnotations } from '@modelcontextprotocol/server';
import { aircraftHistory, aircraftHistoryInputSchema } from './tools/aircraft-history';
import { aircraftNear, aircraftNearInputSchema, chatgptLocationHint } from './tools/aircraft-near';
import { aircraftProfile, aircraftProfileInputSchema } from './tools/aircraft-profile';
import { findAircraft, findAircraftInputSchema } from './tools/find-aircraft';
import { clearMyLocationInputSchema, forgetMyLocation, setMyLocation, setMyLocationInputSchema } from './tools/my-location';
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
      'List every aircraft the FlyItalyADSB network currently sees within a radius of any lat/lon point worldwide — full live records (position, altitude, speed, type), not just a count. Also accepts a shortcut name for one of FlyItalyADSB\'s curated Italian airports. If the user asks about aircraft near them without saying where, call it with no airport and no lat/lon: it uses the position saved on their FlyItalyADSB account (or, in ChatGPT, the approximate location ChatGPT provides), and `center.source` says which.',
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
  aircraft_history: {
    title: 'Historical position track for an aircraft',
    description:
      'Get one aircraft\'s historical position track for a specific day (position, altitude, speed, heading over time), or list which dates have history available for it. Self-serve historical data, distinct from the live-only tools above: 2022-04 → 2023-10 (first/last point per flight only), 2023-07 → 2024-06 (full tracks, with gaps), and every day since 2026-08-17.',
    inputSchema: aircraftHistoryInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    } satisfies ToolAnnotations,
  },
  aircraft_profile: {
    title: 'Aircraft profile',
    description:
      'Everything FlyItalyADSB knows about one aircraft in a single call: identity (registration, ICAO type, type description, year, military/interesting/PIA/LADD flags), whether it is being received now (position, altitude, callsign, and the position source: ADS-B, MLAT, TIS-B…), and a summary of its recorded history (first and last day with a track, days seen in the last 30, total days), plus links to the public map and to photos. By ICAO hex, or by registration or callsign while the aircraft is live. About the aircraft, never its owner: no owner or operator names, and not a way to follow a person. No photo is embedded: pass on `photoNote` to the user.',
    inputSchema: aircraftProfileInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    } satisfies ToolAnnotations,
  },
  set_my_location: {
    title: 'Save my position',
    description:
      'Save the user\'s position on their FlyItalyADSB account, so that later questions about aircraft near them work without saying where (aircraft_near with no place). Call it only when the user tells you where they are and wants it remembered, or asks to set or change it; never with a position you guessed. Turn the place they name into approximate lat/lon yourself. Stored rounded to about 1 km; one per account.',
    inputSchema: setMyLocationInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    } satisfies ToolAnnotations,
  },
  clear_my_location: {
    title: 'Forget my position',
    description:
      'Delete the position saved on the user\'s FlyItalyADSB account, when they ask to forget or remove it.',
    inputSchema: clearMyLocationInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
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

/**
 * Registers every tool on a fresh `McpServer` instance. `apiKey` is the
 * CALLER's own `X-Api-Key` — the same key issued for `api.flyitalyadsb.com/v2/*`
 * — extracted from the request header by `functions/mcp.ts` before this runs.
 * There's no shared server-side secret: every caller brings their own key, so
 * rate limiting and abuse accountability at the v2 API happen per real caller
 * instead of being pooled behind one fixed credential. `functions/mcp.ts`
 * rejects the request before reaching here if the header is missing, so
 * `apiKey` is always a non-empty string by the time a tool actually runs —
 * whether it's a *valid* key is the v2 API's call (401 if not), not ours.
 */
export function initializeMcpServer(server: McpServer, apiKey: string): void {
  server.registerTool('find_aircraft', TOOLS.find_aircraft, async (args) => {
    try {
      const result = await findAircraft(args, apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('aircraft_near', TOOLS.aircraft_near, async (args, ctx) => {
    try {
      const result = await aircraftNear(args, apiKey, chatgptLocationHint(ctx.mcpReq._meta));
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('special_traffic', TOOLS.special_traffic, async (args) => {
    try {
      const result = await specialTraffic(args, apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('aircraft_history', TOOLS.aircraft_history, async (args) => {
    try {
      const result = await aircraftHistory(args, apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('aircraft_profile', TOOLS.aircraft_profile, async (args) => {
    try {
      const result = await aircraftProfile(args, apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('set_my_location', TOOLS.set_my_location, async (args) => {
    try {
      const result = await setMyLocation(args, apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('clear_my_location', TOOLS.clear_my_location, async () => {
    try {
      const result = await forgetMyLocation(apiKey);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return errorResult(err);
    }
  });
}
