import { createHash } from 'node:crypto';

/**
 * Generates each tool's `SKILL.md` content and computes its digest from the
 * SAME string — imported by both the `SKILL.md` routes and the
 * `agent-skills/index.json` route, so the advertised digest can never go
 * stale relative to what's actually served. Runs at build time only (these
 * back static Astro routes, mirrors `sitemap.xml.ts`), so `node:crypto` is
 * fine here even though this site otherwise ships to the Workers runtime.
 * Pattern mirrors nessodigitale.it's `.well-known/agent-skills` convention.
 */

const SITE = 'https://flyitalyadsb.com';
const MCP_URL = `${SITE}/mcp`;

export interface SkillDefinition {
  name: string;
  description: string;
  markdown: string;
}

function findAircraftSkillMd(): string {
  return [
    '# Find a specific aircraft',
    '',
    'Look up one aircraft currently tracked by the FlyItalyADSB network via the `find_aircraft`',
    'MCP tool, by its 24-bit ICAO hex address, callsign/flight number, or tail registration.',
    '',
    '## Requirements',
    '',
    `- Connect to the MCP server at \`${MCP_URL}\` (Streamable HTTP, stateless).`,
    '- Every request needs an `X-Api-Key` header — the same key issued for `api.flyitalyadsb.com/v2/*`.',
    '  A missing header is rejected before the MCP session even starts.',
    '- Call `find_aircraft` with `by` (`icao24` | `callsign` | `registration`) and `value`.',
    '- A `found: false` result means no aircraft with that identifier is currently tracked —',
    '  not necessarily that it does not exist.',
    '',
    '## Validate',
    '',
    '```',
    `POST ${MCP_URL}`,
    'Content-Type: application/json',
    'X-Api-Key: <your-key>',
    '',
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_aircraft","arguments":{"by":"callsign","value":"AZA1234"}}}',
    '```',
    '',
    'Check that `result.content[0].text` parses as JSON with a `found` boolean.',
    '',
  ].join('\n');
}

function aircraftNearSkillMd(): string {
  return [
    '# Aircraft near a location',
    '',
    'List every aircraft the FlyItalyADSB network currently sees within a radius of any point',
    'worldwide, via the `aircraft_near` MCP tool — full live records, not just a count. The',
    'network is global (3,200+ feeders), not limited to Italy.',
    '',
    '## Requirements',
    '',
    `- Connect to the MCP server at \`${MCP_URL}\` (Streamable HTTP, stateless).`,
    '- Every request needs an `X-Api-Key` header — the same key issued for `api.flyitalyadsb.com/v2/*`.',
    '  A missing header is rejected before the MCP session even starts.',
    '- Call `aircraft_near` with either `lat` and `lon` (anywhere in the world) or `airport` — a',
    '  shortcut for one of FlyItalyADSB\'s own curated Italian airports only, by slug, IATA, or',
    '  ICAO code (e.g. "roma-fiumicino", "FCO", "LIRF").',
    '- Optional `radiusKm` (default 80) and `limit` (default 50, max 200).',
    '',
    '## Validate',
    '',
    '```',
    `POST ${MCP_URL}`,
    'Content-Type: application/json',
    'X-Api-Key: <your-key>',
    '',
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"aircraft_near","arguments":{"airport":"roma-fiumicino","limit":5}}}',
    '```',
    '',
    'Check that `result.content[0].text` parses as JSON with:',
    '',
    '- `aircraft` — the array of full records, truncated to `limit`',
    '- `count` — always equal to `aircraft.length` (never the pre-limit total)',
    '- `totalMatched` — the real, pre-limit count; read this, not `count`, to know if more',
    '  aircraft exist than were returned',
    '- `center` (`{label, lat, lon}`), `radiusKm`, `now` (unix seconds) — echo of the query',
    '',
  ].join('\n');
}

function specialTrafficSkillMd(): string {
  return [
    '# Military / privacy / LADD traffic',
    '',
    'List aircraft currently tracked network-wide that are flagged military, PIA (Privacy ICAO',
    'Address), or LADD, via the `special_traffic` MCP tool — thanks to FlyItalyADSB\'s own MLAT,',
    'this includes aircraft without full ADS-B.',
    '',
    '## Requirements',
    '',
    `- Connect to the MCP server at \`${MCP_URL}\` (Streamable HTTP, stateless).`,
    '- Every request needs an `X-Api-Key` header — the same key issued for `api.flyitalyadsb.com/v2/*`.',
    '  A missing header is rejected before the MCP session even starts.',
    '- Call `special_traffic` with `category` (`military` | `privacy` | `ladd`) and an optional',
    '  `limit` (default 50, max 200).',
    '',
    '## Validate',
    '',
    '```',
    `POST ${MCP_URL}`,
    'Content-Type: application/json',
    'X-Api-Key: <your-key>',
    '',
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"special_traffic","arguments":{"category":"military","limit":5}}}',
    '```',
    '',
    'Check that `result.content[0].text` parses as JSON with:',
    '',
    '- `aircraft` — the array of full records, truncated to `limit`',
    '- `count` — always equal to `aircraft.length` (never the pre-limit total)',
    '- `totalMatched` — the real, pre-limit count; read this, not `count`, to know if more',
    '  aircraft exist than were returned',
    '- `category`, `now` (unix seconds) — echo of the query',
    '',
  ].join('\n');
}

function aircraftHistorySkillMd(): string {
  return [
    '# Historical position track for an aircraft',
    '',
    'Get one aircraft\'s historical position track for a specific day, or list which dates have',
    'history available for it, via the `aircraft_history` MCP tool. Distinct from the other three',
    'tools, which are live-only: this reads self-serve historical data — recent days only, older',
    'history is not yet self-serve.',
    '',
    '## Requirements',
    '',
    `- Connect to the MCP server at \`${MCP_URL}\` (Streamable HTTP, stateless).`,
    '- Every request needs an `X-Api-Key` header — the same key issued for `api.flyitalyadsb.com/v2/*`.',
    '  A missing header is rejected before the MCP session even starts.',
    '- Call `aircraft_history` with `icao24`. Omit `date` to list available dates first if unsure',
    '  what\'s covered; pass `date` (`YYYY-MM-DD`) to fetch that day\'s track.',
    '- Optional `limit` (default 200, max 2000) evenly samples a busy aircraft\'s day down — a full',
    '  day can be 1,000+ raw position points.',
    '',
    '## Validate',
    '',
    '```',
    `POST ${MCP_URL}`,
    'Content-Type: application/json',
    'X-Api-Key: <your-key>',
    '',
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"aircraft_history","arguments":{"icao24":"c04662"}}}',
    '```',
    '',
    'Check that `result.content[0].text` parses as JSON. With no `date`: `mode: "dates"` and a',
    '`datesAvailable` array. With `date` set: `mode: "track"` and either `found: true` with',
    '`aircraft` (metadata), `points` (sampled track), `totalPoints`, and `sampled` — or',
    '`found: false` with a `reason` (e.g. never seen that day, or older than what\'s self-serve).',
    '',
  ].join('\n');
}

export const SKILLS: Record<string, SkillDefinition> = {
  'find-aircraft': {
    name: 'find-aircraft',
    description: 'Look up one specific aircraft by ICAO hex, callsign, or registration.',
    markdown: findAircraftSkillMd(),
  },
  'aircraft-near': {
    name: 'aircraft-near',
    description: 'List live aircraft near an Italian airport or a lat/lon point, full records.',
    markdown: aircraftNearSkillMd(),
  },
  'special-traffic': {
    name: 'special-traffic',
    description: 'List currently tracked military, privacy (PIA), or LADD aircraft.',
    markdown: specialTrafficSkillMd(),
  },
  'aircraft-history': {
    name: 'aircraft-history',
    description: 'Get an aircraft\'s historical position track for a day, or list available dates.',
    markdown: aircraftHistorySkillMd(),
  },
};

export function skillDigest(markdown: string): string {
  return `sha256:${createHash('sha256').update(markdown, 'utf8').digest('hex')}`;
}
