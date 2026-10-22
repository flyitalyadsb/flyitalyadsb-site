"""End-to-end test of the in-chat aircraft map (MCP Apps, src/lib/mcp/apps/
aircraft-map.ts) against wrangler dev + a local public-api
(run_public_api_local.py): the ui:// resource (listed, readable, its MIME type
and CSP), the tools linked to it, and tool results that stay exactly what plain
MCP clients already get. Acts as an MCP client with an API key.
How the page itself behaves in a host: mcp-worker/preview.
Usage: e2e_map_widget.py <mail log>"""
import hashlib
import json
import os
import re
import time
import uuid

import psycopg

from client import mcp_call, ok, summary

DSN = os.environ.get("FIA_E2E_PG", "postgresql://postgres@127.0.0.1:54341/postgres") + "?options=-csearch_path%3De2e"
KEY = "fia_map-" + uuid.uuid4().hex
EMAIL = f"map-{int(time.time())}@example.test"
URI = "ui://flyitalyadsb/aircraft-map.html"
MIME = "text/html;profile=mcp-app"
TILES = "https://tile.openstreetmap.org"
LINKED = ("aircraft_near", "special_traffic", "find_aircraft")
UNLINKED = ("aircraft_history", "set_my_location", "clear_my_location")

with psycopg.connect(DSN, autocommit=True) as c:
    c.execute("INSERT INTO api_keys (email, name, use_case, key_prefix, key_hash, plan) VALUES (%s, 'e2e', 'tests', %s, %s, 'free')",
              (EMAIL, KEY[:12], hashlib.sha256(KEY.encode()).hexdigest()))
time.sleep(11)  # public-api reloads its key cache every 10 s


def result(method, params=None):
    s, _, res = mcp_call(api_key=KEY, method=method, params=params)
    return s, res.get("result") or {}, res


# A client that advertises MCP Apps (SEP-1865 "Client<>Server Capability
# Negotiation"); the server is stateless, so this only proves it still answers.
s, r, raw = result("initialize", {"protocolVersion": "2025-06-18", "clientInfo": {"name": "e2e", "version": "1"},
                                  "capabilities": {"extensions": {"io.modelcontextprotocol/ui": {"mimeTypes": [MIME]}}}})
ok("initialize with the MCP Apps extension: resources capability", s == 200 and "resources" in r.get("capabilities", {}),
   f"{s} {json.dumps(raw)[:200]}")

s, r, raw = result("resources/list")
listed = [x for x in r.get("resources", []) if x.get("uri") == URI]
ok("resources/list has the map with the MCP App MIME type", len(listed) == 1 and listed[0].get("mimeType") == MIME,
   json.dumps(raw)[:300])
ui = (listed[0].get("_meta") or {}).get("ui", {}) if listed else {}
ok("listed _meta.ui.csp: tiles only, no connect domains", ui.get("csp") == {"resourceDomains": [TILES], "connectDomains": []}, json.dumps(ui))

s, r, raw = result("resources/read", {"uri": URI})
contents = r.get("contents") or [{}]
page = contents[0]
html = page.get("text", "")
ok("resources/read: one HTML5 document at the same URI and MIME type",
   len(contents) == 1 and page.get("uri") == URI and page.get("mimeType") == MIME and html.lstrip().lower().startswith("<!doctype html>"),
   f"{s} {json.dumps(raw)[:200]}")
rui = (page.get("_meta") or {}).get("ui", {})
ok("read _meta.ui: same CSP as listed, prefersBorder set", rui.get("csp") == ui.get("csp") and rui.get("prefersBorder") is True, json.dumps(rui))
ok("no permissions requested (no geolocation, camera, microphone, clipboard)", "permissions" not in rui, json.dumps(rui))
ok("self-contained: Leaflet and the view inlined, no placeholder left",
   "Leaflet 1.9.4" in html and "ui/initialize" in html and not re.search(r"__(LEAFLET_CSS|LEAFLET_JS|WIDGET_JS|CONFIG|BRAND_MARK)__", html),
   f"{len(html)} chars")
ok("nothing loaded from elsewhere: no <script src>, <link>, @import or url(http…)",
   not re.search(r"<script[^>]+src=|<link\b|@import|url\(\s*['\"]?https?:", html, re.I))
ok("the FlyItalyADSB mark is inline (a data: image, no new origin) next to the wordmark",
   re.search(r'<img class="brand-mark"[^>]* src="data:image/webp;base64,[A-Za-z0-9+/=]{500,}"', html) and ">FlyItalyADSB</span>" in html)
tile_hosts = set(re.findall(r"https://([a-z0-9.-]+)/\{z\}", html))
ok("the only tile template is the declared tile origin", tile_hosts == {TILES.split("//")[1]}, str(tile_hosts))
view = html.rsplit("<script>", 1)[-1]
ok("the view reads any field the host puts the data in, and can ask the host to run the call again",
   "function payloadOf(" in view and "'tools/call'" in view and "function shapeOf(" in view)
ok("Live: off until pressed, every 30 s for at most 10 minutes, through the host's tools/call, paused when off screen",
   '"live":{"everyS":30,"maxMinutes":10}' in html and 'aria-pressed="false"' in html and "IntersectionObserver" in view
   and "visibilitychange" in view and "'tools/call'" in view)
ok("estimated motion: at most 60 s, not on the ground or below 40 kt",
   "const MAX_EST_S = 60" in view and "const MIN_EST_KT = 40" in view and "!ac.ground" in view)
ok("the view makes no network call of its own and asks for no location",
   not re.search(r"\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|geolocation", view))
ok("page fits comfortably in one resource read (< 400 kB)", len(html.encode()) < 400_000, f"{len(html.encode())} bytes")

s, r, raw = result("tools/list")
tools = {t["name"]: t for t in r.get("tools", [])}
for name in LINKED:
    meta = tools.get(name, {}).get("_meta") or {}
    ok(f"{name} links the map (_meta.ui.resourceUri + the deprecated flat key)",
       meta.get("ui", {}).get("resourceUri") == URI and meta.get("ui/resourceUri") == URI, json.dumps(meta))
for name in UNLINKED:
    ok(f"{name} has no UI", name in tools and not (tools[name].get("_meta") or {}).get("ui"), json.dumps(tools.get(name, {}).get("_meta")))


def _conversation_block(c):
    try:
        return set(json.loads(c.get("text", ""))) == {"conversation_id"}
    except (ValueError, TypeError, AttributeError):
        return False


def call(name, arguments, meta=None):
    params = {"name": name, "arguments": arguments}
    if meta:
        params["_meta"] = meta
    s, r, raw = result("tools/call", params)
    # The analytics SDK appends {"conversation_id": ...} for the model to send
    # back when MCP_INTENTS is on (mcp-worker/src/index.ts): not the tool's own.
    content = [c for c in (r.get("content") or []) if not _conversation_block(c)] or [{}]
    try:
        data = json.loads(content[0].get("text", ""))
    except json.JSONDecodeError:
        data = None
    return s, r, content, data


def same_text_and_structured(r, content, data):
    """The JSON text plain clients always got, plus the same object as structuredContent."""
    return (set(r) == {"content", "structuredContent"} and len(content) == 1 and content[0].get("type") == "text"
            and isinstance(data, dict) and r["structuredContent"] == data)


# The aircraft in run_public_api_local.py's aircraft.json: 33ffd1, a C-130 at 43.7, 10.6.
s, r, content, data = call("aircraft_near", {"lat": 43.7, "lon": 10.6, "radiusKm": 30})
ok("aircraft_near: the same JSON text as before, and the same object as structuredContent",
   same_text_and_structured(r, content, data)
   and set(data) == {"center", "radiusKm", "now", "count", "totalMatched", "aircraft"}
   and any(a.get("hex") == "33ffd1" for a in data["aircraft"]), f"{s} {json.dumps(r)[:240]}")
s, r, content, data = call("aircraft_near", {"lat": 43.7, "lon": 10.6, "radiusKm": 30}, {"openai/locale": "it-IT"})
ok("aircraft_near from ChatGPT (openai/* _meta): text only, no structuredContent (its model would read the list twice)",
   set(r) == {"content"} and isinstance(data, dict) and any(a.get("hex") == "33ffd1" for a in data.get("aircraft", [])),
   f"{s} {json.dumps(r)[:240]}")
s, r, content, data = call("find_aircraft", {"by": "icao24", "value": "33ffd1"})
ok("find_aircraft: text + the same structuredContent", same_text_and_structured(r, content, data) and data.get("found") is True
   and data["aircraft"].get("hex") == "33ffd1", f"{s} {json.dumps(r)[:240]}")
s, r, content, data = call("special_traffic", {"category": "military"})
ok("special_traffic: text + the same structuredContent", same_text_and_structured(r, content, data)
   and data.get("category") == "military" and any(a.get("hex") == "33ffd1" for a in data.get("aircraft", [])),
   f"{s} {json.dumps(r)[:240]}")
s, r, content, data = call("aircraft_history", {"icao24": "33ffd1"})
ok("tools without the map are untouched: no structuredContent", "structuredContent" not in r, f"{s} {json.dumps(r)[:200]}")

summary()
