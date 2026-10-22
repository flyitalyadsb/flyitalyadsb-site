"""End-to-end test of "aircraft near me" (aircraft_near with no place,
set_my_location, clear_my_location) against wrangler dev + a local public-api
(run_public_api_local.py) with public-api's locations.py. Acts as an MCP
client with an API key, and as ChatGPT (its `openai/userLocation` hint).
Usage: e2e_near_me.py <mail log>"""
import hashlib
import json
import os
import time
import uuid

import psycopg

from client import mcp_call, ok, summary

DSN = os.environ.get("FIA_E2E_PG", "postgresql://postgres@127.0.0.1:54341/postgres") + "?options=-csearch_path%3De2e"
KEY = "fia_near-me-" + uuid.uuid4().hex
EMAIL = f"near-{int(time.time())}@example.test"
# The aircraft in run_public_api_local.py's aircraft.json is at 43.7, 10.6 (Pisa).
PISA = {"lat": 43.70, "lon": 10.60, "label": "Pisa"}
CHATGPT_MILANO = {"openai/userLocation": {"city": "Milano", "region": "Lombardia", "country": "IT",
                                         "timezone": "Europe/Rome", "latitude": 45.4642, "longitude": 9.19}}

with psycopg.connect(DSN, autocommit=True) as c:
    c.execute("INSERT INTO api_keys (email, name, use_case, key_prefix, key_hash, plan) VALUES (%s, 'e2e', 'tests', %s, %s, 'free')",
              (EMAIL, KEY[:12], hashlib.sha256(KEY.encode()).hexdigest()))
time.sleep(11)  # public-api reloads its key cache every 10 s


def tool(name, arguments=None, meta=None, req_id=1):
    params = {"name": name, "arguments": arguments or {}}
    if meta:
        params["_meta"] = meta
    s, _, res = mcp_call(api_key=KEY, method="tools/call", params=params, req_id=req_id)
    content = (res.get("result") or {}).get("content") or [{}]
    text = content[0].get("text", "")
    try:
        return s, (res.get("result") or {}).get("isError", False), json.loads(text)
    except json.JSONDecodeError:
        return s, (res.get("result") or {}).get("isError", False), text


s, err, out = tool("aircraft_near")
ok("near me with nothing saved -> the tool asks to get a place from the user",
   err and "Ask the user where they are" in str(out) and "set_my_location" in str(out), f"{s} {out}")

s, err, out = tool("aircraft_near", {"lat": 45.0})
ok("lat without lon is refused", err or s != 200, f"{s} {out}")

s, err, out = tool("aircraft_near", meta=CHATGPT_MILANO)
ok("near me from ChatGPT with nothing saved -> ChatGPT's city",
   not err and out["center"]["source"] == "chatgpt" and "Milano" in out["center"]["label"]
   and out["center"]["lat"] == 45.4642, f"{s} {str(out)[:200]}")

s, err, out = tool("set_my_location", {"lat": 43.70123, "lon": 10.60456, "label": "Pisa"})
ok("set_my_location saves it rounded", not err and out["saved"] == {"label": "Pisa", "lat": 43.7, "lon": 10.6},
   f"{s} {out}")

s, err, out = tool("aircraft_near")
ok("near me now uses the saved position and finds the aircraft there",
   not err and out["center"]["source"] == "saved" and "Pisa" in out["center"]["label"]
   and any(a.get("hex") == "33ffd1" for a in out["aircraft"]), f"{s} {str(out)[:240]}")

s, err, out = tool("aircraft_near", meta=CHATGPT_MILANO)
ok("the saved position wins over ChatGPT's hint", not err and out["center"]["source"] == "saved", f"{s} {str(out)[:160]}")

s, err, out = tool("aircraft_near", {"airport": "FCO"})
ok("an explicit place still wins", not err and out["center"]["source"] == "airport", f"{s} {str(out)[:160]}")

# That reading the saved position isn't counted is public-api's test_locations.py.

s, err, out = tool("clear_my_location")
ok("clear_my_location", not err and out == {"cleared": True}, f"{s} {out}")
s, err, out = tool("aircraft_near")
ok("after clearing, near me asks again", err and "Ask the user where they are" in str(out), f"{s} {out}")

with psycopg.connect(DSN) as c:
    row = c.execute("SELECT lat, lon, label, cleared_at IS NOT NULL FROM account_locations WHERE email = %s", (EMAIL,)).fetchone()
ok("in the DB the position is gone (row kept with cleared_at)", row == (None, None, None, True), f"{row}")

summary()
