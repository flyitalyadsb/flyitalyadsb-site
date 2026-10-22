"""End-to-end test of the `overflights` MCP tool against wrangler dev + a local
public-api (run_public_api_local.py) whose GLOBE_HISTORY_DIR and OVERFLIGHTS_INDEX_DIR
point at synthetic traces written here — never production data. The index is built
with public-api's own overflights.py, as the overflights-index CronJob does.
Usage: e2e_overflights.py <mail log> <public-api dir>
Env: GLOBE_HISTORY_DIR, OVERFLIGHTS_INDEX_DIR (the same as the local public-api's), and
FIA_E2E_PG / FIA_E2E_SITE / FIA_E2E_API_PORT as for the other e2e scripts (see the README)."""
import gzip
import hashlib
import json
import math
import os
import sys
import time
import uuid
from datetime import datetime, timezone

import psycopg

from client import api, mcp_call, ok, summary

sys.path.insert(0, sys.argv[2])
import overflights as ov  # noqa: E402  public-api's module: the same builder as the CronJob

DSN = os.environ.get("FIA_E2E_PG", "postgresql://postgres@127.0.0.1:54341/postgres") + "?options=-csearch_path%3De2e"
HIST = os.environ["GLOBE_HISTORY_DIR"]
INDEX = os.environ["OVERFLIGHTS_INDEX_DIR"]
KEY = "fia_overflights-" + uuid.uuid4().hex
EMAIL = f"overflights-{int(time.time())}@example.test"
LINATE = (45.445, 9.2767)  # LIN in src/data/airports.ts
KM = ov.KM_PER_DEG


def write_flight(icao, t_mid, lat, lon, alt, callsign, offset_km=0.4, **meta):
    """A straight east-west pass offset_km north of (lat, lon) at t_mid, points every 10 s."""
    day = datetime.fromtimestamp(t_mid, timezone.utc).date()
    ds = datetime(day.year, day.month, day.day, tzinfo=timezone.utc).timestamp()
    dlon = 8 / (KM * math.cos(math.radians(lat)))
    pts = []
    for i in range(17):
        f = i / 16
        t = t_mid - 80 + i * 10 - ds
        if not 0 <= t < 86400:
            continue
        det = {"flight": callsign.ljust(8), "type": "adsb_icao"} if i == 0 else None
        pts.append([round(t, 2), round(lat + offset_km / KM, 6), round(lon - dlon + 2 * f * dlon, 6), alt, 120.0, 90.0,
                    0, 0, det, "adsb_icao", alt, None, None, None])
    doc = {"icao": icao, "r": meta.get("r", "I-TEST"), "t": meta.get("t", "EC35"), "desc": meta.get("desc", "EC-135"),
           "dbFlags": 0, "ownOp": "Mario Rossi", "year": "2004", "timestamp": ds, "trace": pts}
    d = os.path.join(ov.day_path(HIST, day), "traces", icao[-2:])
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, f"trace_full_{icao}.json"), "wb") as f:
        f.write(gzip.compress(json.dumps(doc).encode()))
    return day


now = time.time()
days = {
    write_flight("3c66a3", now - 90 * 60, *LINATE, 1500, "HELI1"),          # 1.5 h ago over Linate, low
    write_flight("4ca7b5", now - 70 * 60, *LINATE, 9000, "RYR12AB"),        # 70 min ago over Linate, higher
    write_flight("40621d", now - 26 * 3600, 45.54, 10.22, 2500, "IAM4653"),  # yesterday over Brescia
}
for d in sorted(days):
    ov.build_day(HIST, INDEX, d, now=time.time())

with psycopg.connect(DSN, autocommit=True) as c:
    c.execute("INSERT INTO api_keys (email, name, use_case, key_prefix, key_hash, plan) VALUES (%s, 'e2e', 'tests', %s, %s, 'free')",
              (EMAIL, KEY[:12], hashlib.sha256(KEY.encode()).hexdigest()))
time.sleep(11)  # public-api reloads its key cache every 10 s


def tool(name, arguments=None, req_id=1):
    s, _, res = mcp_call(api_key=KEY, method="tools/call", params={"name": name, "arguments": arguments or {}}, req_id=req_id)
    content = (res.get("result") or {}).get("content") or [{}]
    text = content[0].get("text", "")
    try:
        return s, (res.get("result") or {}).get("isError", False), json.loads(text), text
    except json.JSONDecodeError:
        return s, (res.get("result") or {}).get("isError", False), text, text


s, _, res = mcp_call(api_key=KEY, method="tools/list")
tools = {t["name"]: t for t in res.get("result", {}).get("tools", [])}
t = tools.get("overflights") or {}
ok("tools/list has overflights, read-only, about aircraft not people",
   t.get("annotations", {}).get("readOnlyHint") is True and t.get("annotations", {}).get("destructiveHint") is False
   and "never people" in t.get("description", "") and t.get("title"), f"{s} {str(t)[:300]}")

s, err, out, text = tool("overflights", {"airport": "LIN", "radiusKm": 2, "lastHours": 3})
icaos = [o["icao"] for o in out.get("overflights", [])] if isinstance(out, dict) else []
ok("airport shortcut, last 3 hours: both aircraft over Linate, earliest first",
   not err and out["center"]["source"] == "airport" and icaos == ["3c66a3", "4ca7b5"], f"{s} {text[:400]}")
if icaos:
    o = out["overflights"][0]
    ok("closest point, callsign, altitude and source", abs(o["closest_km"] - 0.4) < 0.05 and o["callsigns"] == ["HELI1"]
       and o["min_alt_ft"] == 1500 and o["source"] == "adsb" and o["r"] == "I-TEST", f"{o}")
    ok("the end of today is not indexed yet: reported as a gap and in notes",
       out["coverage"]["complete"] is False and out["coverage"]["gaps"][-1]["reason"] == "recent, not indexed yet"
       and any("do not conclude" in n for n in out["notes"]), f"{out['coverage']} {out['notes']}")
ok("owner/operator never leaves the API", "ownOp" not in text and "Mario Rossi" not in text and '"year"' not in text, text[:300])

s, err, out, text = tool("overflights", {"airport": "LIN", "radiusKm": 2, "lastHours": 3, "maxAltFt": 3000})
ok("maxAltFt keeps only the low one", not err and [o["icao"] for o in out["overflights"]] == ["3c66a3"], f"{s} {text[:300]}")

yday_from = datetime.fromtimestamp(now - 27 * 3600, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
yday_to = datetime.fromtimestamp(now - 25 * 3600, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
s, err, out, text = tool("overflights", {"lat": 45.54, "lon": 10.22, "radiusKm": 1, "from": yday_from, "to": yday_to})
ok("lat/lon with from/to: yesterday's aircraft over Brescia",
   not err and [o["icao"] for o in out["overflights"]] == ["40621d"] and out["center"]["source"] == "coordinates", f"{s} {text[:300]}")

s, err, out, text = tool("overflights", {"airport": "LIN", "radiusKm": 20, "lastHours": 2})
ok("above the Free radius: the API's 403 with its help link", err and "10 km" in text and "errore-403-sorvoli" in text, f"{s} {text}")
s, err, out, text = tool("overflights", {"airport": "LIN", "radiusKm": 2, "lastHours": 12})
ok("above the Free window: 403 too", err and "6 hours" in text, f"{s} {text}")

s, err, out, text = tool("overflights", {"airport": "LIN", "lastHours": 2, "from": yday_from})
ok("lastHours together with from is refused", err or s != 200, f"{s} {text[:200]}")

s, err, out, text = tool("overflights", {"lastHours": 3})
ok("no place and nothing saved: asks the user", err and "Ask the user" in text, f"{s} {text}")
s, err, out, text = tool("set_my_location", {"lat": LINATE[0], "lon": LINATE[1], "label": "Linate"})
s, err, out, text = tool("overflights", {"radiusKm": 2, "lastHours": 3})
ok("no place: the saved position", not err and out["center"]["source"] == "saved" and out["count"] == 2, f"{s} {text[:300]}")
tool("clear_my_location")

old = datetime(2025, 1, 10, 8, tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
s, err, out, text = tool("overflights", {"airport": "LIN", "from": old, "to": "2025-01-10T12:00:00Z"})
ok("a period without an index: zero aircraft but coverage says it was not searched",
   not err and out["count"] == 0 and out["coverage"]["complete"] is False and out["coverage"]["gaps"][0]["reason"] == "not indexed",
   f"{s} {text[:300]}")

time.sleep(11)
api("GET", "/v2/me/location", headers={"X-Api-Key": KEY})  # not counted; its key check flushes the usage counts
with psycopg.connect(DSN) as c:
    (used,) = c.execute("SELECT COALESCE(SUM(request_count), 0) FROM api_key_usage_daily WHERE key_hash = %s",
                        (hashlib.sha256(KEY.encode()).hexdigest(),)).fetchone()
# 5 searches answered 200; the 403s, the refused call, the saved-position reads and writes don't count.
ok("each search counts as one request, refused ones not at all", used == 5, f"{used}")

summary()
