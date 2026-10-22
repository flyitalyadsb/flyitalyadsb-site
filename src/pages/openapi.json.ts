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

// Notable-traffic events and webhooks (public-api events.py, webhooks.py).
const ALERTS_DOC = `${SITE}/en/data/api/docs/alerts/`;
const webhookIdParam = { name: 'id', in: 'path', required: true, description: 'Webhook id.', schema: { type: 'integer' } };
const webhookErrors = {
  '401': { $ref: '#/components/responses/Unauthorized' },
  '429': { $ref: '#/components/responses/TooManyRequests' },
  '503': error('Database unavailable, try again shortly.'),
};
const webhookIdErrors = { ...webhookErrors, '404': error('No webhook with this id for this account.') };
const okJson = (description: string) => ({
  description,
  content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
});
const paidOnly = error('Webhooks are for paid plans (code "paid-plan-required").');
const webhookJson = (schema: string, description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
});

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
  externalDocs: { description: 'API page: plans, endpoints, free key', url: `${SITE}/en/data/api/` },
  servers: [{ url: 'https://api.flyitalyadsb.com' }],
  security: [{ ApiKey: [] }],
  tags: [
    { name: 'live', description: 'What the network is receiving now.' },
    { name: 'history', description: 'Per-aircraft daily tracks since 2022-04-10, with gaps, and the aircraft that flew over a place (since 2026-08-17).' },
    { name: 'keys', description: 'Self-serve API keys.' },
    { name: 'account', description: 'The key\'s account: the position saved for "aircraft near me".' },
    { name: 'events', description: `Notable traffic recorded by the network: emergencies, military, "interesting". ${ALERTS_DOC}` },
    { name: 'webhooks', description: `Signed push alerts on the same events, paid plans only. ${ALERTS_DOC}` },
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
    '/v2/profile/{icao}': {
      get: {
        summary: 'Profile of one aircraft',
        description:
          'Identity (registration, ICAO type, type description, year, decoded dbFlags), live status (position, callsign ' +
          'and position source when received now) and a history summary (first and last day with a track, days in the ' +
          'last 30 UTC days, total days; the same dates as /v2/history/{icao}), plus links to the public map and to a ' +
          'public photo page. One request. Never returns owner or operator names. No photo is embedded: ' +
          "Planespotters.net's API terms forbid re-serving their photos through another API, so `photos.page` is a " +
          'link to their public page, and it is null (with `withheld`) for PIA and LADD aircraft.',
        tags: ['live', 'history'],
        parameters: [icaoParam],
        responses: {
          '200': {
            description: 'The profile.',
            headers: planHeaders,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Profile' } } },
          },
          '400': error('icao is not 6 hex characters.'),
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': error('Not received now and no recorded history for this aircraft.'),
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '503': error('Live data or the archive is briefly unavailable: retry shortly.'),
        },
      },
    },
    '/v2/overflights': {
      get: {
        summary: 'Aircraft that flew over a place in a time window',
        description:
          'Every aircraft whose recorded track passed within `dist` km of the point between `from` and `to`, one entry per ' +
          'aircraft, sorted by the time of its closest point. Tracks are interpolated between received positions (gaps over ' +
          '5 minutes are not). Covers the days since 2026-08-17; the current day lags by up to ~15 minutes, and the periods ' +
          'not searched are listed in `coverage.gaps`. One request per call. The maximum `dist` and window depend on the ' +
          `plan (Free 10 km / 6 h, Starter 25 km / 24 h, others 50 km / 24 h): ${PLANS}. ` +
          'Aircraft data only: registration, type, description and dbFlags, never the owner or operator.',
        tags: ['history'],
        parameters: [
          { name: 'lat', in: 'query', required: true, description: 'Latitude, decimal degrees.', schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', required: true, description: 'Longitude, decimal degrees.', schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'dist', in: 'query', required: true, description: 'Radius in km.', schema: { type: 'number', exclusiveMinimum: 0, maximum: 50 } },
          {
            name: 'from',
            in: 'query',
            required: true,
            description: 'Start: ISO 8601 (UTC when there is no offset) or Unix seconds.',
            schema: { type: 'string', examples: ['2026-10-21T08:00:00Z'] },
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            description: 'End, after `from`: ISO 8601 or Unix seconds. A time in the future is cut to now.',
            schema: { type: 'string', examples: ['2026-10-21T10:00:00Z'] },
          },
          {
            name: 'max_alt_ft',
            in: 'query',
            required: false,
            description: 'Only the part of each track at or below this altitude (feet); positions without altitude are left out.',
            schema: { type: 'number', minimum: 0, maximum: 100000 },
          },
          { name: 'limit', in: 'query', required: false, description: 'At most this many aircraft.', schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: {
          '200': {
            description: 'The overflights, with what was searched.',
            headers: planHeaders,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Overflights' } } },
          },
          '400': error('A parameter is missing or malformed, `to` is not after `from`, or the circle contains a pole.'),
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': error("`dist` or the window is above the plan's maximum (the body carries max_dist_km and max_window_hours)."),
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '503': error('Too many searches at once, or the index is briefly unavailable: retry shortly (Retry-After).'),
        },
      },
    },
    '/v2/me/location': {
      get: {
        summary: "The position saved on the key's account",
        description:
          'For "aircraft near me": the position the user saved (My API, or the MCP tool set_my_location), rounded to about 1 km. Not counted as a request. `location` is null when none is saved.',
        tags: ['account'],
        responses: {
          '200': {
            description: 'The saved position, or null.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationResult' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
        },
      },
      post: {
        summary: "Save the position on the key's account",
        description: 'Replaces any saved position. Stored rounded to 2 decimals (about 1 km). At most 10 changes a minute per key.',
        tags: ['account'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['lat', 'lon'],
                properties: {
                  lat: { type: 'number', minimum: -90, maximum: 90 },
                  lon: { type: 'number', minimum: -180, maximum: 180 },
                  label: { type: 'string', maxLength: 80, description: 'A short name, e.g. "Brescia".' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The saved position.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationResult' } } },
          },
          '400': error('lat or lon is missing or out of range.'),
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/v2/me/location/clear': {
      post: {
        summary: "Delete the position saved on the key's account",
        tags: ['account'],
        responses: {
          '200': {
            description: 'Deleted (location is null).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationResult' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/v2/events': {
      get: {
        summary: 'Notable traffic within a radius since a time',
        description:
          'Events recorded by the network: emergencies (squawk 7500/7600/7700 or the ADS-B emergency status, not ' +
          '"lifeguard"), military aircraft and "interesting" aircraft (dbFlags bits 0 and 1). One event per aircraft, ' +
          'kind and ~0.5° grid cell it entered, so a long flight appears once per cell; a new event for the same cell ' +
          `only after 30 (emergency) or 60 minutes away. Newest first. Counted as one request; the plan's radius applies. ${ALERTS_DOC}`,
        tags: ['events'],
        parameters: [
          { name: 'lat', in: 'query', required: true, description: 'Latitude, decimal degrees.', schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', required: true, description: 'Longitude, decimal degrees.', schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'dist', in: 'query', required: true, description: 'Radius in km.', schema: { type: 'number', exclusiveMinimum: 0, maximum: 20040 } },
          { name: 'since', in: 'query', description: 'Unix seconds or ISO 8601 (no zone = UTC). Default 24 hours ago, at most 7 days ago.', schema: { type: 'string' } },
          { name: 'until', in: 'query', description: 'Unix seconds or ISO 8601. Default now.', schema: { type: 'string' } },
          { name: 'kinds', in: 'query', description: 'Comma-separated subset of emergency, military, interesting. Default all.', schema: { type: 'string' } },
          { name: 'limit', in: 'query', description: 'At most this many events (1–500, default 100).', schema: { type: 'integer', minimum: 1, maximum: 500 } },
        ],
        responses: {
          '200': {
            description: 'Matching events.',
            headers: planHeaders,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EventList' } } },
          },
          '400': error('A parameter is missing or out of range (the error says which).'),
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': error("The radius is above the plan's maximum (the body carries max_radius_km and a link to the plans)."),
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '503': error('Database unavailable, try again shortly.'),
        },
      },
    },
    '/v2/webhooks': {
      get: {
        summary: "The account's webhooks",
        description: 'Never includes the signing secret. Not counted as a request (at most 20 webhook calls a minute per key).',
        tags: ['webhooks'],
        responses: { '200': webhookJson('WebhookList', 'The webhooks, and the maximum per account.'), ...webhookErrors },
      },
      post: {
        summary: 'Create a webhook',
        description:
          'Paid plans only, at most 5 per account. The URL must be https on port 443 or 8443 and resolve only to public ' +
          "addresses. The answer carries the signing secret, shown this once. dist is capped by the plan's radius.",
        tags: ['webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'lat', 'lon', 'dist'],
                properties: {
                  url: { type: 'string', format: 'uri', maxLength: 500 },
                  lat: { type: 'number', minimum: -90, maximum: 90 },
                  lon: { type: 'number', minimum: -180, maximum: 180 },
                  dist: { type: 'number', exclusiveMinimum: 0, maximum: 20040, description: 'Radius in km.' },
                  kinds: {
                    type: 'array',
                    items: { enum: ['emergency', 'military', 'interesting'] },
                    description: 'Default ["emergency", "military"].',
                  },
                  description: { type: 'string', maxLength: 200 },
                },
              },
            },
          },
        },
        responses: {
          '201': webhookJson('WebhookCreated', 'Created; store the secret now.'),
          '400': error('Invalid JSON, url not allowed (code "url-not-allowed"), or an area or kind out of range.'),
          '403': paidOnly,
          '409': error('The account already has the maximum number of webhooks (code "webhook-limit").'),
          ...webhookErrors,
        },
      },
    },
    '/v2/webhooks/{id}/deliveries': {
      get: {
        summary: "A webhook's last 20 deliveries",
        tags: ['webhooks'],
        parameters: [webhookIdParam],
        responses: { '200': webhookJson('DeliveryList', 'Newest first.'), ...webhookIdErrors },
      },
    },
    '/v2/webhooks/{id}/delete': {
      post: {
        summary: 'Delete a webhook',
        description: 'Allowed on any plan. Pending deliveries are cancelled.',
        tags: ['webhooks'],
        parameters: [webhookIdParam],
        responses: { '200': okJson('Deleted ({"status": "ok"}).'), ...webhookIdErrors },
      },
    },
    '/v2/webhooks/{id}/enable': {
      post: {
        summary: 'Enable a webhook again after it was disabled',
        description: 'A webhook is disabled after 15 failed attempts in a row over at least an hour. This resets the count.',
        tags: ['webhooks'],
        parameters: [webhookIdParam],
        responses: { '200': webhookJson('WebhookResult', 'Enabled.'), '403': paidOnly, ...webhookIdErrors },
      },
    },
    '/v2/webhooks/{id}/test': {
      post: {
        summary: 'Send a test delivery',
        description: 'Queues one `webhook.test` delivery, signed like the others, attempted once. See its outcome in /deliveries.',
        tags: ['webhooks'],
        parameters: [webhookIdParam],
        responses: {
          '202': okJson('Queued ({"delivery_id", "message"}).'),
          '403': paidOnly,
          '409': error('The webhook is disabled (code "disabled"): enable it first.'),
          ...webhookIdErrors,
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
  webhooks: {
    trafficEvent: {
      post: {
        summary: 'A notable-traffic event, sent to your webhook URL',
        description:
          'Signed with Standard Webhooks (https://www.standardwebhooks.com/): HMAC-SHA256 with the base64-decoded part of ' +
          'the secret after "whsec_", over "{webhook-id}.{webhook-timestamp}.{raw body}". Reject a timestamp more than 5 ' +
          'minutes away and dedupe on webhook-id, which is the same on every retry. Answer 2xx within 10 seconds; ' +
          `anything else (redirects included) is retried 6 times over about 5 hours. ${ALERTS_DOC}`,
        tags: ['webhooks'],
        security: [],
        parameters: [
          { name: 'webhook-id', in: 'header', required: true, description: 'msg_<delivery id>, the same on every retry.', schema: { type: 'string' } },
          { name: 'webhook-timestamp', in: 'header', required: true, description: 'Unix seconds of this attempt.', schema: { type: 'string' } },
          { name: 'webhook-signature', in: 'header', required: true, description: '"v1,<base64 signature>".', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookPayload' } } },
        },
        responses: { '200': { description: 'Any 2xx: delivered.' } },
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
      TrafficEvent: {
        type: 'object',
        description:
          'An event, plus the aircraft fields known at that moment with readsb\'s names (flight, r, t, desc, year, ' +
          'alt_baro, gs, track, squawk, emergency, category, dbFlags); `source` is readsb\'s position type. Never the ' +
          'owner or operator.',
        required: ['id', 'kind', 'hex', 'time', 'lat', 'lon'],
        properties: {
          id: { type: 'integer' },
          kind: { enum: ['emergency', 'military', 'interesting'] },
          reason: { enum: ['general', 'hijack', 'radio_failure', 'minimum_fuel', 'downed'], description: 'Emergencies only.' },
          hex: { type: 'string' },
          time: { type: 'string', format: 'date-time', description: 'When the aircraft was seen entering the cell.' },
          lat: { type: 'number' },
          lon: { type: 'number' },
          distance_km: { type: 'number', description: 'From the query point (or the webhook centre).' },
          source: { type: 'string', description: 'adsb_icao, mlat, …' },
          map: { type: 'string', format: 'uri', description: 'The aircraft on the live map.' },
        },
        additionalProperties: true,
      },
      EventList: {
        type: 'object',
        required: ['now', 'since', 'until', 'count', 'truncated', 'events'],
        properties: {
          now: { type: 'number' },
          since: { type: 'string', format: 'date-time' },
          until: { type: 'string', format: 'date-time' },
          center: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' } } },
          dist: { type: 'number' },
          kinds: { type: 'array', items: { type: 'string' } },
          count: { type: 'integer' },
          truncated: { type: 'boolean', description: 'More events matched than limit.' },
          events: { type: 'array', items: { $ref: '#/components/schemas/TrafficEvent' } },
        },
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          url: { type: 'string' },
          lat: { type: 'number' },
          lon: { type: 'number' },
          dist: { type: 'number' },
          kinds: { type: 'array', items: { type: 'string' } },
          description: { type: ['string', 'null'] },
          status: { enum: ['active', 'disabled', 'paused-plan'], description: 'paused-plan: the account has no paid key now.' },
          created_at: { type: 'string', format: 'date-time' },
          disabled_at: { type: ['string', 'null'], format: 'date-time' },
          disabled_reason: { type: ['string', 'null'] },
          consecutive_failures: { type: 'integer' },
          last_success_at: { type: ['string', 'null'], format: 'date-time' },
          last_failure_at: { type: ['string', 'null'], format: 'date-time' },
          pending_deliveries: { type: 'integer' },
        },
      },
      WebhookList: {
        type: 'object',
        properties: { webhooks: { type: 'array', items: { $ref: '#/components/schemas/Webhook' } }, max: { type: 'integer' } },
      },
      WebhookResult: { type: 'object', properties: { webhook: { $ref: '#/components/schemas/Webhook' } } },
      WebhookCreated: {
        type: 'object',
        properties: {
          webhook: { $ref: '#/components/schemas/Webhook' },
          secret: { type: 'string', description: 'whsec_…, shown only in this answer.' },
          message: { type: 'string' },
        },
      },
      DeliveryList: {
        type: 'object',
        properties: {
          deliveries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                type: { type: 'string', description: 'event.emergency, event.military, event.interesting, webhook.test' },
                event_id: { type: ['integer', 'null'] },
                status: { enum: ['pending', 'sending', 'delivered', 'failed', 'expired', 'dropped', 'cancelled'] },
                attempts: { type: 'integer' },
                created_at: { type: 'string', format: 'date-time' },
                next_attempt_at: { type: 'string', format: 'date-time' },
                delivered_at: { type: ['string', 'null'], format: 'date-time' },
                last_status: { type: ['integer', 'null'], description: 'HTTP status of the last attempt.' },
                last_error: { type: ['string', 'null'] },
                last_duration_ms: { type: ['integer', 'null'] },
              },
            },
          },
        },
      },
      WebhookPayload: {
        type: 'object',
        required: ['type', 'timestamp', 'data'],
        properties: {
          type: { enum: ['event.emergency', 'event.military', 'event.interesting', 'webhook.test'] },
          timestamp: { type: 'string', format: 'date-time' },
          data: {
            description: 'The event (TrafficEvent, with webhook_id and distance_km from the webhook centre), or {webhook_id, message} for a test.',
            $ref: '#/components/schemas/TrafficEvent',
          },
        },
      },
      LocationResult: {
        type: 'object',
        required: ['location'],
        properties: {
          location: {
            type: ['object', 'null'],
            properties: {
              lat: { type: 'number' },
              lon: { type: 'number' },
              label: { type: ['string', 'null'] },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
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
      Profile: {
        type: 'object',
        required: ['icao', 'identity', 'live', 'history', 'links', 'photos'],
        properties: {
          icao: { type: 'string' },
          identity: {
            type: 'object',
            properties: {
              registration: { type: ['string', 'null'] },
              icao_type: { type: ['string', 'null'], description: 'ICAO type designator, e.g. A319.' },
              type_description: { type: ['string', 'null'] },
              year: { type: ['integer', 'null'], description: 'Year of manufacture, when the aircraft database has it.' },
              db_flags: { type: 'integer', description: 'Bits: 0 military, 1 interesting, 2 PIA, 3 LADD.' },
              military: { type: 'boolean' },
              interesting: { type: 'boolean' },
              pia: { type: 'boolean' },
              ladd: { type: 'boolean' },
              trace_day: { type: ['string', 'null'], format: 'date', description: 'The day whose track supplied type_description and year.' },
            },
          },
          live: {
            type: 'object',
            required: ['seen_now'],
            description: 'When seen_now is true, also: now, callsign, source (adsb_icao, mlat, tisb_icao…) and the aircraft.json fields lat, lon, alt_baro, alt_geom, gs, track, baro_rate, squawk, emergency, category, seen, seen_pos, mlat.',
            properties: {
              seen_now: { type: 'boolean' },
              now: { type: 'number', description: 'Time of the live data, Unix seconds.' },
              callsign: { type: ['string', 'null'] },
              source: { type: ['string', 'null'], description: 'Source of the current position.' },
            },
            additionalProperties: true,
          },
          history: {
            type: 'object',
            properties: {
              first_day: { type: ['string', 'null'], format: 'date' },
              last_day: { type: ['string', 'null'], format: 'date' },
              days_last_30: { type: 'integer', description: 'Days with a track among today and the previous 29 (UTC).' },
              total_days: { type: 'integer' },
              archive_unavailable: { type: 'boolean', description: 'Present when the archive could not be listed: recent days only.' },
            },
          },
          links: {
            type: 'object',
            properties: {
              map: { type: ['string', 'null'], format: 'uri', description: 'The public map on this aircraft: live, or its last track the map can show.' },
              history: { type: 'string', format: 'uri' },
            },
          },
          photos: {
            type: 'object',
            properties: {
              page: { type: ['string', 'null'], format: 'uri', description: 'Public photo page on Planespotters.net (no image in this API).' },
              provider: { type: 'string' },
              withheld: { type: ['string', 'null'], enum: ['pia', 'ladd', null], description: 'Why there is no photo link.' },
            },
          },
        },
      },
      Overflights: {
        type: 'object',
        required: ['count', 'truncated', 'coverage', 'overflights'],
        properties: {
          lat: { type: 'number' },
          lon: { type: 'number' },
          dist_km: { type: 'number' },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
          max_alt_ft: { type: ['number', 'null'] },
          count: { type: 'integer' },
          truncated: { type: 'boolean', description: 'More passes exist than were returned.' },
          complete_until: {
            type: ['string', 'null'],
            format: 'date-time',
            description: 'When truncated: every pass whose closest_time is before this is listed. Ask again from here.',
          },
          coverage: {
            type: 'object',
            properties: {
              complete: { type: 'boolean' },
              gaps: {
                type: 'array',
                description: 'Periods NOT searched (not indexed yet, not covered, or tracks that could not be read).',
                items: {
                  type: 'object',
                  properties: { from: { type: 'string', format: 'date-time' }, to: { type: 'string', format: 'date-time' }, reason: { type: 'string' } },
                },
              },
            },
          },
          candidates: { type: 'integer', description: 'Aircraft examined.' },
          overflights: { type: 'array', items: { $ref: '#/components/schemas/Overflight' } },
        },
      },
      Overflight: {
        type: 'object',
        properties: {
          icao: { type: 'string' },
          r: { type: ['string', 'null'], description: 'Registration.' },
          t: { type: ['string', 'null'], description: 'ICAO type code.' },
          desc: { type: ['string', 'null'] },
          dbFlags: { type: 'integer' },
          callsigns: { type: 'array', items: { type: 'string' } },
          closest_time: { type: 'string', format: 'date-time' },
          closest_ts: { type: 'number', description: 'Unix seconds.' },
          closest_km: { type: 'number' },
          closest_alt_ft: { oneOf: [{ type: 'number' }, { const: 'ground' }, { type: 'null' }] },
          min_alt_ft: { oneOf: [{ type: 'number' }, { const: 'ground' }, { type: 'null' }], description: 'Lowest altitude inside the circle.' },
          entered: { type: 'string', format: 'date-time' },
          left: { type: 'string', format: 'date-time' },
          passes: { type: 'integer', description: 'Separate times it entered the circle.' },
          positions: { type: 'integer', description: 'Received positions inside the circle; 0 = interpolated between positions outside it.' },
          source: { type: 'string', enum: ['adsb', 'mlat', 'tisb', 'other'], description: 'Source of the closest position.' },
          sources: { type: 'array', items: { type: 'string' } },
          history: { type: 'array', items: { type: 'string' }, description: 'The /v2/history paths of the days read.' },
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
