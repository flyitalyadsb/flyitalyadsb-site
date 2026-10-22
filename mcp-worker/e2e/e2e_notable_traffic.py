"""End-to-end test of notable_traffic against wrangler dev + a local public-api
started with FIA_E2E_EVENTS=1 (run_public_api_local.py): the real events detector
sees the synthetic aircraft.json (a 7700 near Malpensa, a military C-130 near
Pisa), stores the events, and the MCP tool reads them through /v2/events.
Usage: FIA_E2E_EVENTS=1 on the public-api, then e2e_notable_traffic.py <mail log>"""
import hashlib
import json
import os
import time
import uuid

import psycopg

from client import api, mcp_call, ok, summary

DSN = os.environ.get("FIA_E2E_PG", "postgresql://postgres@127.0.0.1:54341/postgres") + "?options=-csearch_path%3De2e"
KEY = "fia_events-" + uuid.uuid4().hex
EMAIL = f"events-{int(time.time())}@example.test"

with psycopg.connect(DSN, autocommit=True) as c:
    c.execute("INSERT INTO api_keys (email, name, use_case, key_prefix, key_hash, plan) VALUES (%s, 'e2e', 'tests', %s, %s, 'free')",
              (EMAIL, KEY[:12], hashlib.sha256(KEY.encode()).hexdigest()))
time.sleep(11)  # public-api reloads its key cache every 10 s

# The detector needs two snapshots in a row: give it a few seconds.
kinds = set()
for _ in range(30):
    s, body = api("GET", "/v2/events?lat=44.5&lon=9.5&dist=300", headers={"X-Api-Key": KEY})
    kinds = {e["kind"] for e in body.get("events", [])} if s == 200 else set()
    if {"emergency", "military"} <= kinds:
        break
    time.sleep(1)
ok("the detector recorded the 7700 and the military aircraft (GET /v2/events)", {"emergency", "military"} <= kinds,
   f"{s} {str(body)[:300]}")


def tool(name, arguments=None, req_id=1):
    s, _, res = mcp_call(api_key=KEY, method="tools/call", params={"name": name, "arguments": arguments or {}},
                         req_id=req_id)
    result = res.get("result") or {}
    text = (result.get("content") or [{}])[0].get("text", "")
    try:
        return s, result.get("isError", False), json.loads(text)
    except json.JSONDecodeError:
        return s, result.get("isError", False), text or res


s, _, res = mcp_call(api_key=KEY, method="tools/list")
listed = {t["name"]: t for t in res.get("result", {}).get("tools", [])}
nt = listed.get("notable_traffic", {})
ok("tools/list has notable_traffic, read-only", nt.get("annotations", {}).get("readOnlyHint") is True
   and "sinceHours" in json.dumps(nt.get("inputSchema", {})), f"{s} {str(nt)[:200]}")

s, err, out = tool("notable_traffic", {"airport": "MXP", "radiusKm": 50})
emerg = [a for a in out.get("aircraft", [])] if isinstance(out, dict) else []
ok("near Malpensa: the 7700, as an emergency with reason and squawk",
   not err and out["center"]["source"] == "airport" and len(emerg) == 1 and emerg[0]["hex"] == "4ca7b5"
   and emerg[0]["kind"] == "emergency" and emerg[0]["reason"] == "general" and emerg[0]["squawk"] == "7700"
   and emerg[0]["callsign"] == "ABC123" and emerg[0]["closest"]["distanceKm"] < 10
   and emerg[0]["closest"]["source"] == "adsb_icao", f"{s} {str(out)[:400]}")
ok("the answer carries the caveats (samples, spoofing, squawk is not a confirmed emergency)",
   isinstance(out, dict) and "spoofed" in out.get("note", "") and "not a confirmed emergency" in out.get("note", ""),
   f"{str(out)[:200]}")

s, err, out = tool("notable_traffic", {"lat": 43.7, "lon": 10.6, "radiusKm": 30, "kinds": ["military"]})
ok("near Pisa, military only: the C-130",
   not err and [a["hex"] for a in out["aircraft"]] == ["33ffd1"] and out["aircraft"][0]["kind"] == "military"
   and out["aircraft"][0]["registration"] == "MM62179" and out["countsByKind"]["emergency"] == 0,
   f"{s} {str(out)[:300]}")

s, err, out = tool("notable_traffic", {"airport": "MXP", "radiusKm": 50, "kinds": ["military"]})
ok("Malpensa, military only: nothing", not err and out["aircraft"] == [] and out["totalEvents"] == 0, f"{s} {str(out)[:200]}")

s, err, out = tool("notable_traffic", {"lat": 45.0})
ok("lat without lon is refused", err or s != 200, f"{s} {out}")

s, err, out = tool("notable_traffic")
ok("no place and nothing saved -> asks the user where", err and "Ask the user where they are" in str(out), f"{s} {out}")

s, err, out = tool("set_my_location", {"lat": 43.70, "lon": 10.60, "label": "Pisa"})
s, err, out = tool("notable_traffic")
ok("no place -> the saved position (Pisa) and the C-130 there",
   not err and out["center"]["source"] == "saved" and any(a["hex"] == "33ffd1" for a in out["aircraft"]),
   f"{s} {str(out)[:300]}")
tool("clear_my_location")

s, err, out = tool("notable_traffic", {"airport": "XYZ"})
ok("an unknown airport says to use lat/lon", err and "lat" in str(out), f"{s} {out}")

summary()
