"""End-to-end test of aircraft_profile against wrangler dev + a local public-api
(run_public_api_local.py: its aircraft.json and synthetic globe history), as an
MCP client with an API key. Usage: e2e_profile.py <mail log>"""
import hashlib
import json
import os
import time
import uuid

import psycopg

from client import api, mcp_call, ok, summary

DSN = os.environ.get("FIA_E2E_PG", "postgresql://postgres@127.0.0.1:54341/postgres") + "?options=-csearch_path%3De2e"
KEY = "fia_profile-" + uuid.uuid4().hex
DIGEST = hashlib.sha256(KEY.encode()).hexdigest()
EMAIL = f"profile-{int(time.time())}@example.test"

with psycopg.connect(DSN, autocommit=True) as c:
    c.execute("INSERT INTO api_keys (email, name, use_case, key_prefix, key_hash, plan) VALUES (%s, 'e2e', 'tests', %s, %s, 'free')",
              (EMAIL, KEY[:12], DIGEST))
time.sleep(11)  # public-api reloads its key cache every 10 s


def tool(arguments, req_id=1):
    s, _, res = mcp_call(api_key=KEY, method="tools/call", params={"name": "aircraft_profile", "arguments": arguments},
                         req_id=req_id)
    result = res.get("result") or {}
    text = (result.get("content") or [{}])[0].get("text", "")
    try:
        return s, result.get("isError", False), json.loads(text), text
    except json.JSONDecodeError:
        return s, result.get("isError", False), text, text


s, _, res = mcp_call(api_key=KEY, method="tools/list")
tools = {t["name"]: t for t in (res.get("result") or {}).get("tools", [])}
t = tools.get("aircraft_profile") or {}
ann = t.get("annotations") or {}
ok("tools/list has aircraft_profile, read-only", ann.get("readOnlyHint") is True and ann.get("destructiveHint") is False
   and ann.get("idempotentHint") is True and t.get("title") == "Aircraft profile", f"{s} {json.dumps(t)[:300]}")
props = (t.get("inputSchema") or {}).get("properties") or {}
ok("its input is by + value", set(props) == {"by", "value"} and props["by"].get("default") == "icao24", json.dumps(props)[:300])

s, err, out, text = tool({"value": "33FFD1"})
ok("by ICAO hex: live + history + identity", not err and out.get("found") is True
   and out["identity"]["registration"] == "MM62179" and out["identity"]["military"] is True
   and out["identity"]["type_description"] == "LOCKHEED C-130J Hercules" and out["identity"]["year"] == 2000
   and out["live"]["seen_now"] is True and out["live"]["callsign"] == "IAM4653" and out["live"]["alt_baro"] == 23925
   and out["history"]["total_days"] == 2 and out["history"]["days_last_30"] == 2
   and out["links"]["map"] == "https://mappa.flyitalyadsb.com/?icao=33ffd1", f"{s} {text[:400]}")
ok("the photo note carries the public photo page and its credit", out.get("photos", {}).get("page") ==
   "https://www.planespotters.net/hex/33FFD1" and "https://www.planespotters.net/hex/33FFD1" in out.get("photoNote", "")
   and "photographer" in out.get("photoNote", "") and "Planespotters.net" in out.get("photoNote", ""), text[:400])

s, err, out, text = tool({"by": "registration", "value": "mm62179"})
ok("by registration: resolved through the live feed", not err and out.get("found") is True
   and out.get("resolvedFrom") == {"by": "registration", "value": "mm62179"} and out.get("icao") == "33ffd1", text[:300])

s, err, out, text = tool({"by": "callsign", "value": "IAM4653"})
ok("by callsign", not err and out.get("found") is True and out.get("icao") == "33ffd1", text[:300])

s, err, out, text = tool({"value": "4baa72"})
ok("not live, history only", not err and out.get("found") is True and out["live"] == {"seen_now": False}
   and out["identity"]["registration"] == "TC-JJE" and out["history"]["total_days"] == 1
   and out["links"]["map"].endswith("icao=4baa72&showTrace=" + out["history"]["last_day"]), text[:400])
ok("no owner/operator name ever comes out", "Some Private Owner" not in text and "ownOp" not in text, text[:400])

s, err, out, text = tool({"value": "a1b2c3"})
ok("LADD: flagged, still live, no photo link and a note saying why", not err and out["identity"]["ladd"] is True
   and out["live"]["source"] == "mlat" and out["photos"]["page"] is None and out["photos"]["withheld"] == "ladd"
   and "LADD" in out["photoNote"] and "planespotters.net/hex" not in text, text[:400])

s, err, out, text = tool({"by": "registration", "value": "I-NONE"})
ok("unknown registration -> found false, suggests the hex", not err and out.get("found") is False
   and "icao24" in out.get("reason", ""), text[:300])
s, err, out, text = tool({"value": "aaaaaa"})
ok("unknown hex -> found false", not err and out.get("found") is False and "no recorded history" in out.get("reason", ""),
   text[:300])
s, err, out, text = tool({"value": "xyz"})
ok("malformed hex -> found false without calling the API", not err and out.get("found") is False, text[:300])

# Counted requests: 3 profiles by hex that reached the API + 2 resolved (lookup + profile each) + the
# unknown registration lookup + the unknown hex profile; the malformed hex never left the Worker.
time.sleep(11)  # the flush into api_key_usage_daily rides the key-cache refresh, which a request triggers:
api("GET", "/v2/me/location", headers={"X-Api-Key": KEY})  # one that is itself not counted
with psycopg.connect(DSN) as c:
    row = c.execute("SELECT coalesce(sum(request_count), 0) FROM api_key_usage_daily WHERE key_hash = %s",
                    (DIGEST,)).fetchone()
ok("one request per profile, plus one per live lookup", row[0] == 3 + 2 * 2 + 1 + 1, f"{row}")

summary()
