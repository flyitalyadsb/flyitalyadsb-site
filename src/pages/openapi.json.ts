import type { APIRoute } from 'astro';

/**
 * Serves `/openapi.json` — the OpenAPI 3.1 description of
 * api.flyitalyadsb.com/v2, linked as `service-desc` from the API catalog
 * (`/.well-known/api-catalog`) and the home page's Link headers. It lives
 * here and not on api.flyitalyadsb.com because every /v2/* path there needs
 * an X-Api-Key at the edge, and a spec has to be readable without one.
 *
 * Written from public_api.py (nesso-infra k8s/flyitalyadsb/base/public-api):
 * when a route, an error or a header changes there, change it here too.
 * Plan limits are deliberately not repeated: they live on the API page.
 */
const SITE = 'https://flyitalyadsb.com';
const PLANS = `${SITE}/en/data/api/#piani`;

const error = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const planHeaders = {
  'X-FIA-Plan': { $ref: '#/components/headers/X-FIA-Plan' },
  'X-FIA-Used-Month': { $ref: '#/components/headers/X-FIA-Used-Month' },
};

const oneAircraft = (summary: string, param: string, description: string) => ({
  get: {
    summary,
    tags: ['live'],
    parameters: [{ name: param, in: 'path', required: true, description, schema: { type: 'string' } }],
    responses: {
      '200': {
        description: 'The aircraft currently seen with this identifier.',
        headers: planHeaders,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Aircraft' } } },
      },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '404': error('No aircraft with this identifier is being received right now.'),
      '429': { $ref: '#/components/responses/TooManyRequests' },
      '503': { $ref: '#/components/responses/Unavailable' },
    },
  },
});

const aircraftList = (summary: string, description: string) => ({
  get: {
    summary,
    description,
    tags: ['live'],
    responses: {
      '200': {
        description: 'Matching aircraft.',
        headers: planHeaders,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/AircraftList' } } },
      },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '429': { $ref: '#/components/responses/TooManyRequests' },
      '503': { $ref: '#/components/responses/Unavailable' },
    },
  },
});

const icaoParam = {
  name: 'icao',
  in: 'path',
  required: true,
  description: '24-bit ICAO address, 6 hex characters.',
  schema: { type: 'string', pattern: '^[0-9a-fA-F]{6}$' },
};

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'FlyItalyADSB API',
    version: '2',
    summary: 'Live and historical aircraft positions from the FlyItalyADSB community ADS-B/MLAT network.',
    description:
      'Unfiltered aircraft data (no FAA/LADD/BARR filtering; military aircraft included, many of them via MLAT) from a ' +
      'community-run receiver network, in the style of the adsb.lol API. Every endpoint except the key signup needs an ' +
      `X-Api-Key; keys are self-serve (see /auth.md). Plans and limits: ${PLANS}. The same key works on the MCP server at ` +
      `${SITE}/mcp.`,
    termsOfService: `${SITE}/en/terms/`,
    contact: { name: 'FlyItalyADSB', email: 'info@flyitalyadsb.com', url: `${SITE}/en/contact/` },
    license: { name: 'Data: CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
  externalDocs: { description: 'API page: plans, examples, MCP setup', url: `${SITE}/en/data/api/` },
  servers: [{ url: 'https://api.flyitalyadsb.com' }],
  security: [{ ApiKey: [] }],
  tags: [
    { name: 'live', description: 'What the network is receiving now.' },
    { name: 'history', description: 'Per-aircraft daily tracks since 2022-04-10, with gaps.' },
    { name: 'keys', description: 'Self-serve API keys.' },
  ],
  paths: {
    '/v2/icao/{hex}': oneAircraft('One aircraft by ICAO address', 'hex', '24-bit ICAO address, hex (case-insensitive).'),
    '/v2/callsign/{callsign}': oneAircraft('One aircraft by callsign', 'callsign', 'Flight callsign (case-insensitive).'),
    '/v2/reg/{reg}': oneAircraft('One aircraft by registration', 'reg', 'Registration, e.g. MM62179 (case-insensitive).'),
    '/v2/lat/{lat}/lon/{lon}/dist/{dist}': {
      get: {
        summary: 'All aircraft within a radius of a point',
        description: `The radius is in kilometres (adsb.lol uses nautical miles). The maximum radius depends on the plan: ${PLANS}.`,
        tags: ['live'],
        parameters: [
          { name: 'lat', in: 'path', required: true, description: 'Latitude, decimal degrees.', schema: { type: 'number' } },
          { name: 'lon', in: 'path', required: true, description: 'Longitude, decimal degrees.', schema: { type: 'number' } },
          { name: 'dist', in: 'path', required: true, description: 'Radius in km.', schema: { type: 'number', minimum: 0 } },
        ],
        responses: {
          '200': {
            description: 'Aircraft within the radius.',
            headers: planHeaders,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AircraftList' } } },
          },
          '400': error('lat, lon or dist is not a number.'),
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': error("The radius is above the plan's maximum (the body carries max_radius_km and a link to the plans)."),
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '503': { $ref: '#/components/responses/Unavailable' },
        },
      },
    },
    '/v2/mil': aircraftList('Military aircraft', 'Aircraft whose dbFlags has the military bit (bit 0).'),
    '/v2/pia': aircraftList('PIA aircraft', 'Aircraft whose dbFlags has the PIA (Privacy ICAO Address) bit (bit 2).'),
    '/v2/ladd': aircraftList('LADD aircraft', 'Aircraft whose dbFlags has the LADD bit (bit 3).'),
    '/v2/history/{icao}': {
      get: {
        summary: 'Dates with a recorded track for one aircraft',
        tags: ['history'],
        parameters: [icaoParam],
        responses: {
          '200': {
            description: 'Sorted list of dates.',
            headers: planHeaders,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HistoryDates' } } },
          },
          '400': error('icao is not 6 hex characters.'),
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '503': { $ref: '#/components/responses/Unavailable' },
        },
      },
    },
    '/v2/history/{icao}/{date}': {
      get: {
        summary: "One aircraft's track for one day",
        description:
          "readsb's trace_full file for that aircraft and day, passed through as written. From 2022-04-10 to " +
          '2023-10-04 the archive holds imported Virtual Radar Server data: only the first and last point of each flight ' +
          '("version": "vrs-basestation-import"). The current day may answer 503 while the file is being written.',
        tags: ['history'],
        parameters: [
          icaoParam,
          { name: 'date', in: 'path', required: true, description: 'UTC day, YYYY-MM-DD, not in the future.', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'The trace.',
            headers: {
              ...planHeaders,
              'X-History-Source': {
                description: 'Where the day was read from: `local` (the server) or `r2` (the archive).',
                schema: { type: 'string', enum: ['local', 'r2'] },
              },
            },
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Trace' } } },
          },
          '400': error('icao or date is malformed, or the date is in the future.'),
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': error('No trace for this aircraft on this date.'),
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '502': error('The archived trace could not be read.'),
          '503': error('The archive is briefly unavailable, or today\'s file is being written: retry shortly.'),
        },
      },
    },
    '/v2/keys': {
      post: {
        summary: 'Request an API key by email',
        description:
          'Sends a one-time link (valid 7 days) to the address; opening it shows the key once. The key is never in ' +
          'this response or in the email. Requesting again for the same address rotates the self-serve key when the ' +
          'new link is used; until then the old key keeps working. One free key per mailbox (+tag and Gmail-dot variants ' +
          'count as the same mailbox); temporary email domains are refused.',
        tags: ['keys'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email', description: 'An address a person controls.' },
                  name: { type: 'string', maxLength: 200, description: 'App, device or agent name.' },
                  use_case: { type: 'string', maxLength: 500 },
                  lang: { type: 'string', enum: ['it', 'en'], default: 'it', description: 'Language of the email.' },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Accepted: check the mailbox.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { const: 'ok' }, message: { type: 'string' } },
                },
              },
            },
          },
          '400': error('Missing or invalid email, a temporary email domain (code "disposable-email"), or invalid JSON.'),
          '429': error('A key was requested for this address a few minutes ago.'),
          '503': error('Database unavailable, try again shortly.'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKey: { type: 'apiKey', in: 'header', name: 'X-Api-Key', description: `Self-serve: ${SITE}/en/data/api/#api-key` },
    },
    headers: {
      'X-FIA-Plan': { description: "The key's plan (free, feeder, starter, pro, business, enterprise).", schema: { type: 'string' } },
      'X-FIA-Used-Month': { description: 'Requests counted this month for the key.', schema: { type: 'integer' } },
    },
    responses: {
      Unauthorized: error('Missing or invalid X-Api-Key.'),
      TooManyRequests: {
        description: "Per-minute limit (key or, on Free, IP) or the plan's monthly quota. Per-minute answers carry Retry-After.",
        headers: { 'Retry-After': { description: 'Seconds to wait.', schema: { type: 'integer' } } },
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Unavailable: error('Live data is briefly unavailable.'),
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          help: { type: 'string', format: 'uri', description: 'On 401, 403 and 429: the FAQ answer for this error.' },
        },
        additionalProperties: true,
      },
      Aircraft: {
        type: 'object',
        description:
          "A record from readsb's aircraft.json. Which fields are present depends on what was received; only common ones are listed.",
        required: ['hex'],
        properties: {
          hex: { type: 'string', description: 'ICAO address; a leading ~ marks a non-ICAO (e.g. TIS-B) address.' },
          type: { type: 'string', description: 'Source of the current position, e.g. adsb_icao, mlat, tisb_icao.' },
          flight: { type: 'string', description: 'Callsign, space-padded.' },
          r: { type: 'string', description: 'Registration (aircraft database).' },
          t: { type: 'string', description: 'ICAO type code (aircraft database).' },
          dbFlags: { type: 'integer', description: 'Bits: 0 military, 1 interesting, 2 PIA, 3 LADD.' },
          lat: { type: 'number' },
          lon: { type: 'number' },
          alt_baro: { oneOf: [{ type: 'number' }, { const: 'ground' }], description: 'Barometric altitude in feet, or "ground".' },
          alt_geom: { type: 'number', description: 'Geometric altitude, feet.' },
          gs: { type: 'number', description: 'Ground speed, knots.' },
          track: { type: 'number', description: 'True track, degrees.' },
          baro_rate: { type: 'number', description: 'Vertical rate, ft/min.' },
          squawk: { type: 'string' },
          seen: { type: 'number', description: 'Seconds since the last message.' },
          seen_pos: { type: 'number', description: 'Seconds since the last position.' },
          mlat: { type: 'array', items: { type: 'string' }, description: 'Fields derived from MLAT.' },
        },
        additionalProperties: true,
      },
      AircraftList: {
        type: 'object',
        required: ['now', 'count', 'ac'],
        properties: {
          now: { type: 'number', description: 'Server time, Unix seconds.' },
          count: { type: 'integer' },
          ac: { type: 'array', items: { $ref: '#/components/schemas/Aircraft' } },
        },
      },
      HistoryDates: {
        type: 'object',
        required: ['icao', 'count', 'dates'],
        properties: {
          icao: { type: 'string' },
          count: { type: 'integer' },
          dates: { type: 'array', items: { type: 'string', format: 'date' } },
          archive_unavailable: { type: 'boolean', description: 'Present when the archive could not be listed: only recent days are included.' },
        },
      },
      Trace: {
        type: 'object',
        description: "readsb trace_full JSON: icao, timestamp, and trace (array of points relative to timestamp), plus aircraft metadata.",
        properties: {
          icao: { type: 'string' },
          timestamp: { type: 'number' },
          trace: { type: 'array', items: { type: 'array' } },
        },
        additionalProperties: true,
      },
    },
  },
};

export const GET: APIRoute = () => Response.json(spec);
