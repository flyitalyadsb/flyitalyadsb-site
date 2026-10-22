"""Shared by the mcp-worker end-to-end tests (e2e_mcp_oauth.py, e2e_auth_md.py):
a cookie-keeping browser against wrangler dev, the mail log written by
run_public_api_local.py, the local public-api, MCP calls, the check tally.
Ports: FIA_E2E_SITE (wrangler dev, default http://localhost:8787) and
FIA_E2E_API_PORT (the local public-api, default 8081), so several checkouts
can run their own stack side by side."""
import base64
import hashlib
import http.client
import json
import os
import re
import secrets
import sys
import time
import urllib.parse

SITE = os.environ.get("FIA_E2E_SITE", "http://localhost:8787").rstrip("/")
SITE_NETLOC = urllib.parse.urlparse(SITE).netloc
SITE_ADDR = ("127.0.0.1", urllib.parse.urlparse(SITE).port or 80)
MAIL_LOG = sys.argv[1]
API = ("127.0.0.1", int(os.environ.get("FIA_E2E_API_PORT", "8081")))
REDIRECT = "http://127.0.0.1:9999/cb"
EMAIL = "pilot@example.test"
checks = []


def ok(name, cond, detail=""):
    checks.append((name, bool(cond)))
    print(f"{'PASS' if cond else 'FAIL'}  {name}{('  -- ' + detail) if detail and not cond else ''}")
    return cond


class Browser:
    def __init__(self):
        self.cookies = {}

    def req(self, method, path, body=None, headers=None, host=SITE_ADDR):
        h = {"Host": SITE_NETLOC, "Accept-Language": "it-IT,it;q=0.9"}
        h.update(headers or {})
        if self.cookies:
            h["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        if isinstance(body, dict):
            body = urllib.parse.urlencode(body)
            h["Content-Type"] = "application/x-www-form-urlencoded"
        c = http.client.HTTPConnection(*host, timeout=20)
        c.request(method, path, body=body, headers=h)
        r = c.getresponse()
        data = r.read().decode("utf-8", "replace")
        for k, v in r.getheaders():
            if k.lower() == "set-cookie":
                name, _, rest = v.partition("=")
                value = rest.split(";", 1)[0]
                if "Max-Age=0" in v or value == "":
                    self.cookies.pop(name, None)
                else:
                    self.cookies[name] = value
        return r.status, dict((k.lower(), v) for k, v in r.getheaders()), data


def form_value(html, name):
    m = re.search(r'name="%s" value="([^"]*)"' % re.escape(name), html)
    return m.group(1) if m else None


def last_mail():
    with open(MAIL_LOG) as f:
        lines = [json.loads(l) for l in f if l.strip()]
    return lines[-1] if lines else None


def wait_mail(n):
    for _ in range(100):
        with open(MAIL_LOG) as f:
            if sum(1 for l in f if l.strip()) >= n:
                return last_mail()
        time.sleep(0.1)
    return None


def mail_count():
    with open(MAIL_LOG) as f:
        return sum(1 for l in f if l.strip())


def api(method, path, payload=None, headers=None):
    c = http.client.HTTPConnection(*API, timeout=20)
    h = {"Content-Type": "application/json", **(headers or {})}
    c.request(method, path, body=json.dumps(payload) if payload is not None else None, headers=h)
    r = c.getresponse()
    return r.status, json.loads(r.read() or b"{}")


def mcp_call(token=None, api_key=None, method="tools/list", params=None, req_id=1):
    h = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
         "MCP-Protocol-Version": "2025-06-18"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if api_key:
        h["X-Api-Key"] = api_key
    b = Browser()
    status, headers, data = b.req("POST", "/mcp", json.dumps({"jsonrpc": "2.0", "id": req_id, "method": method,
                                                              "params": params or {}}), h)
    # Streamable HTTP may answer as SSE: take the data: line.
    m = re.search(r"^data: (.*)$", data, re.M)
    try:
        payload = json.loads(m.group(1) if m else data) if data.strip() else {}
    except json.JSONDecodeError:
        payload = {"raw": data[:200]}
    return status, headers, payload


def pkce():
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def authorize_url(client_id, challenge, state):
    q = urllib.parse.urlencode({"response_type": "code", "client_id": client_id, "redirect_uri": REDIRECT,
                                "scope": "mcp offline_access", "state": state, "code_challenge": challenge,
                                "code_challenge_method": "S256", "resource": f"{SITE}/mcp"})
    return f"/authorize?{q}"


def token(body):
    b = Browser()
    status, _, data = b.req("POST", "/oauth/token", urllib.parse.urlencode(body),
                            {"Content-Type": "application/x-www-form-urlencoded"})
    return status, json.loads(data or "{}")


def summary():
    failed = [n for n, c in checks if not c]
    print(f"\n{len(checks) - len(failed)}/{len(checks)} passed")
    sys.exit(1 if failed else 0)
