"""Local public-api for the mcp-worker end-to-end test: real handler, local
Postgres schema `e2e`, aircraft.json and a few days of globe history from temp
files, emails written to a JSONL file instead of being sent.
Usage: run_public_api_local.py <public-api dir> <mail log> <port>
FIA_E2E_PG overrides the Postgres URL (default 127.0.0.1:54341). GLOBE_HISTORY_DIR, if set, is used
instead of a temp dir (e2e_overflights.py writes its traces there), and OVERFLIGHTS_INDEX_DIR is read by
public-api's overflights.py as is.
FIA_E2E_EVENTS=1: also a 7700 near Malpensa, aircraft.json rewritten every
second with the real time like readsb does, and the events detector running
(e2e_notable_traffic.py)."""
import datetime
import gzip
import json
import os
import sys
import tempfile
import threading
import time
from http.server import ThreadingHTTPServer

src, mail_log, port = sys.argv[1], sys.argv[2], int(sys.argv[3])
dsn = os.environ.get("FIA_E2E_PG", "postgresql://postgres@127.0.0.1:54341/postgres")
events_on = os.environ.get("FIA_E2E_EVENTS") == "1"

import psycopg  # noqa: E402

with psycopg.connect(dsn, autocommit=True) as c:
    c.execute("DROP SCHEMA IF EXISTS e2e CASCADE")
    c.execute("CREATE SCHEMA e2e")

AIRCRAFT = [
    {"hex": "33ffd1", "r": "MM62179", "t": "C130", "flight": "IAM4653", "dbFlags": 1,
     "lat": 43.7, "lon": 10.6, "alt_baro": 23925},
    # A LADD business jet over New York, for aircraft_profile (far from every place the other e2e use).
    {"hex": "a1b2c3", "type": "mlat", "r": "N123AB", "t": "GLF6", "dbFlags": 8, "lat": 40.7, "lon": -74.0,
     "alt_baro": 41000, "seen": 1.0, "seen_pos": 2.0}]
if events_on:
    # A 7700 near Malpensa, for notable_traffic.
    AIRCRAFT.append({"hex": "4ca7b5", "r": "I-ABCD", "t": "A320", "flight": "ABC123", "squawk": "7700",
                     "emergency": "general", "lat": 45.66, "lon": 8.75, "alt_baro": 9800, "gs": 287.4,
                     "type": "adsb_icao", "seen": 0.5, "seen_pos": 0.5})
fd, aircraft = tempfile.mkstemp(suffix=".json")
os.close(fd)


def write_aircraft():
    # The detector needs a new snapshot each time (readsb's "now"); otherwise a fixed time.
    with open(aircraft + ".tmp", "w") as f:
        json.dump({"now": time.time() if events_on else 1761140000.0, "aircraft": AIRCRAFT}, f)
    os.replace(aircraft + ".tmp", aircraft)


write_aircraft()

# Globe history as readsb writes it (gzip, header then "trace"), for aircraft_profile: the live
# 33ffd1 on two recent days, and 4baa72, not live, seen five days ago. The owner name in
# 4baa72's header is there to prove it never comes out.
history = os.environ.get("GLOBE_HISTORY_DIR") or tempfile.mkdtemp()
today = datetime.date.today()
for icao, ago, meta in (("33ffd1", 0, {"r": "MM62179", "t": "C130", "dbFlags": 1, "desc": "LOCKHEED C-130J Hercules",
                                       "year": "2000"}),
                        ("33ffd1", 1, {"r": "MM62179", "t": "C130", "dbFlags": 1}),
                        ("4baa72", 5, {"r": "TC-JJE", "t": "B77W", "dbFlags": 0, "desc": "BOEING 777-300ER",
                                       "ownOp": "Some Private Owner", "year": "2008"})):
    day = today - datetime.timedelta(days=ago)
    d = os.path.join(history, f"{day:%Y}", f"{day:%m}", f"{day:%d}", "traces", icao[-2:])
    os.makedirs(d, exist_ok=True)
    head = '{"icao":"%s"' % icao + "".join(",\n%s:%s" % (json.dumps(k), json.dumps(v)) for k, v in meta.items())
    head += ',\n"version": "readsb e2e",\n"timestamp": %d,\n"trace":[ [0,43.7,10.6,23925,300,90,0,0,null,"adsb_icao"] ]\n}' % (
        datetime.datetime(day.year, day.month, day.day, tzinfo=datetime.timezone.utc).timestamp())
    with open(os.path.join(d, f"trace_full_{icao}.json"), "wb") as f:
        f.write(gzip.compress(head.encode()))
os.environ["DATABASE_URL"] = dsn + ("&" if "?" in dsn else "?") + "options=-csearch_path%3De2e"
os.environ["AIRCRAFT_JSON"] = aircraft
os.environ["GLOBE_HISTORY_DIR"] = history
os.environ["LOGIN_COOLDOWN_S"] = "1"  # the e2e asks for several codes in a row
if events_on:
    os.environ["CACHE_TTL"] = "0.5"
sys.path.insert(0, src)
import public_api as pa  # noqa: E402


def capture(email, subject, body):
    with open(mail_log, "a") as f:
        f.write(json.dumps({"to": email, "subject": subject, "body": body}) + "\n")
    return True


pa._send_email = capture
pa._init_schema()
pa._refresh_auth_cache(force=True)
if events_on:
    def feed():
        while True:
            time.sleep(1)
            write_aircraft()

    threading.Thread(target=feed, daemon=True).start()
    pa.events.start_detector(pa._load, pa._db, interval=1)
print(f"public-api local on 127.0.0.1:{port}", flush=True)
ThreadingHTTPServer(("127.0.0.1", port), pa.Handler).serve_forever()
