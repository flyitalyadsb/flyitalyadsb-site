"""Local public-api for the mcp-worker end-to-end test: real handler, local
Postgres schema `e2e`, aircraft.json from a temp file, emails written to a
JSONL file instead of being sent. Usage: run_public_api_local.py <public-api dir> <mail log> <port>"""
import json
import os
import sys
import tempfile
from http.server import ThreadingHTTPServer

src, mail_log, port = sys.argv[1], sys.argv[2], int(sys.argv[3])
dsn = "postgresql://postgres@127.0.0.1:54341/postgres"

import psycopg  # noqa: E402

with psycopg.connect(dsn, autocommit=True) as c:
    c.execute("DROP SCHEMA IF EXISTS e2e CASCADE")
    c.execute("CREATE SCHEMA e2e")

fd, aircraft = tempfile.mkstemp(suffix=".json")
with os.fdopen(fd, "w") as f:
    json.dump({"aircraft": [{"hex": "33ffd1", "r": "MM62179", "t": "C130", "flight": "IAM4653", "dbFlags": 1,
                             "lat": 43.7, "lon": 10.6, "alt_baro": 23925}]}, f)
os.environ["DATABASE_URL"] = dsn + "?options=-csearch_path%3De2e"
os.environ["AIRCRAFT_JSON"] = aircraft
os.environ["LOGIN_COOLDOWN_S"] = "1"  # the e2e asks for several codes in a row
sys.path.insert(0, src)
import public_api as pa  # noqa: E402


def capture(email, subject, body):
    with open(mail_log, "a") as f:
        f.write(json.dumps({"to": email, "subject": subject, "body": body}) + "\n")
    return True


pa._send_email = capture
pa._init_schema()
pa._refresh_auth_cache(force=True)
print(f"public-api local on 127.0.0.1:{port}", flush=True)
ThreadingHTTPServer(("127.0.0.1", port), pa.Handler).serve_forever()
