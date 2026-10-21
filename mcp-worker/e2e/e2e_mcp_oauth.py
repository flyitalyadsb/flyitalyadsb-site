"""End-to-end test of the mcp-worker OAuth flow against wrangler dev + a local
public-api (run_public_api_local.py). Acts as an MCP client and as the
browser: DCR, PKCE, /authorize, email code, consent, token, MCP calls,
refresh, the remembered device, the link in another browser, revocation."""
import base64
import hashlib
import http.client
import json
import re
import secrets
import sys
import time
import urllib.parse

SITE = "http://localhost:8787"
MAIL_LOG = sys.argv[1]
API = ("127.0.0.1", 8081)
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

    def req(self, method, path, body=None, headers=None, host=("127.0.0.1", 8787)):
        h = {"Host": "localhost:8787", "Accept-Language": "it-IT,it;q=0.9"}
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


# --- discovery --------------------------------------------------------------------
s, h, _ = mcp_call()
ok("unauthenticated /mcp -> 401 with resource_metadata", s == 401 and "resource_metadata" in h.get("www-authenticate", ""),
   f"{s} {h.get('www-authenticate')}")
s, _, data = Browser().req("GET", "/.well-known/oauth-protected-resource/mcp")
prm = json.loads(data or "{}") if s == 200 else {}
ok("protected resource metadata", s == 200 and prm.get("resource") == f"{SITE}/mcp", f"{s} {data[:160]}")

# --- DCR --------------------------------------------------------------------------
s, _, data = Browser().req("POST", "/oauth/register", json.dumps({
    "client_name": "E2E Claude", "redirect_uris": [REDIRECT], "token_endpoint_auth_method": "none",
    "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"]}),
    {"Content-Type": "application/json"})
client = json.loads(data or "{}")
ok("dynamic client registration", s in (200, 201) and client.get("client_id"), f"{s} {data[:160]}")
client_id = client["client_id"]

# --- first authorization: email, code, consent -------------------------------------
br = Browser()
verifier, challenge = pkce()
s, h, page = br.req("GET", authorize_url(client_id, challenge, "st1"))
flow = form_value(page, "f")
ok("authorize shows the email page (IT)", s == 200 and flow and "Mandami il codice" in page, f"{s} {page[:200]}")
ok("authorize page has CSP and no framing", "frame-ancestors 'none'" in h.get("content-security-policy", "")
   and h.get("x-frame-options") == "DENY")
ok("client name escaped and unverified label", "E2E Claude" in page and "non è verificato" in page)

n = mail_count() + 1
s, _, page = br.req("POST", "/authorize", {"f": flow, "step": "email", "email": EMAIL})
mail = wait_mail(n)
code = re.search(r"^  (\d{6})$", mail["body"], re.M).group(1) if mail else None
link = re.search(r"(http\S+/authorize/email#t=\S+)", mail["body"]).group(1) if mail else None
ok("code page and email with code + link", s == 200 and "Controlla la tua email" in page and code and link,
   f"{s} {mail and mail['subject']}")
ok("email subject carries the code", mail and code in mail["subject"])

wrong = f"{(int(code) + 1) % 10**6:06d}"
s, _, page = br.req("POST", "/authorize", {"f": flow, "step": "code", "code": wrong})
ok("wrong code -> code page with error", s == 401 and "Codice sbagliato" in page, f"{s}")

s, h, page = br.req("POST", "/authorize", {"f": flow, "step": "code", "code": code})
handle = form_value(page, "handle")
ok("right code -> consent page with terms box (new user)", s == 200 and handle and "accept_terms" in page
   and "Consenti" in page, f"{s} {page[:300]}")

s, _, page = br.req("POST", "/authorize", {"f": flow, "step": "consent", "handle": handle, "decision": "approve"})
handle2 = form_value(page, "handle")
ok("approve without terms -> consent again with the error", s == 200 and "condizioni" in page and handle2, f"{s}")

s, h, _ = br.req("POST", "/authorize", {"f": flow, "step": "consent", "handle": handle2, "decision": "approve",
                                         "accept_terms": "1"})
loc = h.get("location", "")
q = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
ok("approve -> 302 to the client with code, state, iss", s == 302 and loc.startswith(REDIRECT) and q.get("code")
   and q.get("state") == ["st1"] and q.get("iss") == [SITE], f"{s} {loc}")
ok("device remembered", "__Host-fia-device" in br.cookies)

s, tok = token({"grant_type": "authorization_code", "code": q["code"][0], "redirect_uri": REDIRECT,
                "client_id": client_id, "code_verifier": verifier, "resource": f"{SITE}/mcp"})
ok("token exchange", s == 200 and tok.get("access_token") and tok.get("refresh_token"), f"{s} {tok}")

st, keys = api("GET", "/v2/account/me")  # no session: just to prove the API is up
s, _, res = mcp_call(token=tok["access_token"], method="initialize",
                     params={"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "e2e", "version": "0"}})
ok("MCP initialize with the OAuth token", s == 200 and "result" in res, f"{s} {res}")
s, _, res = mcp_call(token=tok["access_token"], method="tools/list", req_id=2)
names = sorted(t["name"] for t in res.get("result", {}).get("tools", []))
ok("tools/list", names == ["aircraft_history", "aircraft_near", "find_aircraft", "special_traffic"], f"{s} {names}")
s, _, res = mcp_call(token=tok["access_token"], method="tools/call", req_id=3,
                     params={"name": "special_traffic", "arguments": {"category": "military"}})
text = json.dumps(res)
ok("tool call reaches public-api with the connection token", s == 200 and "MM62179" in text and "isError" not in text,
   f"{s} {text[:300]}")

s, tok2 = token({"grant_type": "refresh_token", "refresh_token": tok["refresh_token"], "client_id": client_id})
ok("refresh token", s == 200 and tok2.get("access_token"), f"{s} {tok2}")

# --- second authorization in the same browser: zero clicks --------------------------
verifier3, challenge3 = pkce()
s, h, _ = br.req("GET", authorize_url(client_id, challenge3, "st2"))
loc = h.get("location", "")
ok("remembered device + consent -> straight back to the client", s == 302 and loc.startswith(REDIRECT)
   and "code=" in loc, f"{s} {loc}")
q3 = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
s, tok3 = token({"grant_type": "authorization_code", "code": q3["code"][0], "redirect_uri": REDIRECT,
                 "client_id": client_id, "code_verifier": verifier3, "resource": f"{SITE}/mcp"})
ok("token from the zero-click authorization", s == 200 and tok3.get("access_token"), f"{s} {tok3}")
s, _, _ = mcp_call(token=tok2["access_token"], method="tools/list", req_id=6)
ok("re-authorization revoked the previous grant's tokens", s == 401, f"{s}")

# --- the link from the email in another browser -----------------------------------
fresh, other = Browser(), Browser()
v4, c4 = pkce()
s, _, page = fresh.req("GET", authorize_url(client_id, c4, "st3"))
flow3 = form_value(page, "f")
time.sleep(1.1)  # local LOGIN_COOLDOWN_S
n = mail_count() + 1
fresh.req("POST", "/authorize", {"f": flow3, "step": "email", "email": EMAIL})
mail = wait_mail(n)
frag = urllib.parse.parse_qs(urllib.parse.urlparse(re.search(r"(http\S+/authorize/email#\S+)", mail["body"]).group(1)).fragment)
s, _, page = other.req("POST", "/authorize", {"step": "link", "t": frag["t"][0], "f": frag["f"][0]})
ok("link in another browser is refused", s == 400 and "browser in cui hai iniziato" in page, f"{s} {page[:200]}")
s, _, page = fresh.req("POST", "/authorize", {"step": "link", "t": frag["t"][0], "f": frag["f"][0]})
ok("the same link in the starting browser signs in (existing key: no terms box)",
   s == 200 and form_value(page, "handle") and "accept_terms" not in page, f"{s} {page[:200]}")
s, _, page = fresh.req("GET", "/authorize/email")
ok("link landing page does nothing on load (button + fragment script)", s == 200 and 'id="link"' in page)

# --- legacy X-Api-Key and revocation ----------------------------------------------
s, _, res = mcp_call(api_key="fia_not_a_real_key", method="tools/call", req_id=4,
                     params={"name": "special_traffic", "arguments": {"category": "military"}})
ok("X-Api-Key path still served (bad key -> tool error from the API)", s == 200 and "isError" in json.dumps(res), f"{s} {res}")

# revoke via the account API with a fresh session from a code
time.sleep(1.1)
n = mail_count() + 1
api("POST", "/v2/account/login", {"email": EMAIL, "purpose": "connect", "flow": "e2e_revoke_flow_0123456"})
wait_mail(n)
code = re.search(r"^  (\d{6})$", last_mail()["body"], re.M).group(1)
st, sess = api("POST", "/v2/account/session", {"email": EMAIL, "code": code})
st, me = api("GET", "/v2/account/me", headers={"Authorization": f"Bearer {sess['session']}"})
for c in me.get("connections", []):
    api("POST", "/v2/account/connections/revoke", {"id": c["id"]}, headers={"Authorization": f"Bearer {sess['session']}"})
time.sleep(0.3)
s, _, res = mcp_call(token=tok3["access_token"], method="tools/call", req_id=5,
                     params={"name": "special_traffic", "arguments": {"category": "military"}})
ok("after revocation the tools get the API's 401", "isError" in json.dumps(res), f"{s} {json.dumps(res)[:200]}")

failed = [n for n, c in checks if not c]
print(f"\n{len(checks) - len(failed)}/{len(checks)} passed")
sys.exit(1 if failed else 0)
