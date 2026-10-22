import type { McpServer } from '@modelcontextprotocol/server';
// Text modules, inlined by wrangler at bundle time (mcp-worker/wrangler.jsonc
// `rules`, mcp-worker/src/text-modules.d.ts). Leaflet is imported by relative
// path on purpose: wrangler applies its Text rule to relative imports only, a
// bare `leaflet/...` specifier would be bundled as code.
import template from './aircraft-map.html';
import view from './aircraft-map.view.js';
import leafletCss from '../../../../node_modules/leaflet/dist/leaflet.css';
import leafletJs from '../../../../node_modules/leaflet/dist/leaflet.js';

/**
 * The aircraft map shown inside the chat (MCP Apps, SEP-1865, stable spec
 * 2026-01-26: github.com/modelcontextprotocol/ext-apps
 * specification/2026-01-26/apps.mdx). Hosts that support MCP Apps (claude.ai,
 * Claude desktop and mobile, ChatGPT) see `_meta.ui.resourceUri` on the tools
 * that return aircraft, read this resource once, render it in a sandboxed
 * iframe and pass it the tool result over postMessage. Hosts without MCP Apps
 * ignore `_meta` and keep using the JSON text, which does not change.
 *
 * The page is self-contained: Leaflet and the widget code are inline, so the
 * only thing it loads is map tiles. It makes no fetch of its own (tool calls go
 * through the host), asks for no permission (no geolocation) and gets no
 * structuredContent: it reads the same JSON text the model reads, so ChatGPT
 * doesn't put the aircraft list in the model's context twice.
 *
 * The constants below are the spec's; @modelcontextprotocol/ext-apps defines
 * the same ones, but its server helpers are a two-line wrapper and the
 * package's required peer (@modelcontextprotocol/client) would add the whole
 * client SDK to the install for nothing the Worker runs.
 */

export const AIRCRAFT_MAP_URI = 'ui://flyitalyadsb/aircraft-map.html';
/** `RESOURCE_MIME_TYPE` in ext-apps. */
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
/** Deprecated flat key, still read by older hosts (`RESOURCE_URI_META_KEY`). */
const LEGACY_RESOURCE_URI_KEY = 'ui/resourceUri';

/**
 * Map tiles. OpenStreetMap's own servers: the same tiles mappa.flyitalyadsb.com
 * uses, no key, attribution on the map (operations.osmfoundation.org/policies/tiles).
 * CARTO's dark/light basemaps would look closer to the site but need a key
 * since 2026 (keyless requests get an "API key required" watermark): swap the
 * template here, and the CSP follows.
 */
const TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  origin: 'https://tile.openstreetmap.org',
  maxZoom: 18,
  attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
};

/** `McpUiResourceMeta` (spec "UI Resource Format"): exactly what the page loads. */
export const AIRCRAFT_MAP_UI_META = {
  csp: {
    // Tiles are <img>: img-src comes from resourceDomains. Nothing else is
    // loaded and nothing is fetched, so connectDomains stays empty.
    resourceDomains: [TILES.origin],
    connectDomains: [] as string[],
  },
  // A map reads best inside the host's own card.
  prefersBorder: true,
};

/** Tool `_meta` linking a tool's results to the map (`McpUiToolMeta`). */
export function aircraftMapToolMeta(): Record<string, unknown> {
  return { ui: { resourceUri: AIRCRAFT_MAP_URI }, [LEGACY_RESOURCE_URI_KEY]: AIRCRAFT_MAP_URI };
}

// Leaflet's stylesheet points at its marker and layer-control images; the map
// uses neither, and the CSP would block them anyway.
const css = leafletCss.replace(/url\(images\/[^)]*\)/g, 'none');
const js = leafletJs.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n');
const config = JSON.stringify({ tiles: TILES }).replace(/</g, '\\u003c');

// One pass over the template only: what goes in is never scanned again, and a
// replacer function keeps `$&` and friends in Leaflet's source literal.
const PARTS: Record<string, string> = { LEAFLET_CSS: css, LEAFLET_JS: js, WIDGET_JS: view, CONFIG: config };
export const AIRCRAFT_MAP_HTML = template.replace(
  /\/\*__(LEAFLET_CSS|LEAFLET_JS|WIDGET_JS)__\*\/|"__(CONFIG)__"/g,
  (_m, a?: string, b?: string) => PARTS[(a ?? b) as string],
);

export function registerAircraftMap(server: McpServer): void {
  server.registerResource(
    'aircraft_map',
    AIRCRAFT_MAP_URI,
    {
      title: 'FlyItalyADSB aircraft map',
      description:
        'Interactive map of the aircraft a FlyItalyADSB tool returned: altitude-coloured silhouettes, the search area, a sortable list and details per aircraft.',
      mimeType: MCP_APP_MIME_TYPE,
      _meta: { ui: AIRCRAFT_MAP_UI_META },
    },
    async () => ({
      contents: [
        { uri: AIRCRAFT_MAP_URI, mimeType: MCP_APP_MIME_TYPE, text: AIRCRAFT_MAP_HTML, _meta: { ui: AIRCRAFT_MAP_UI_META } },
      ],
    }),
  );
}
