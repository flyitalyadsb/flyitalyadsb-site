"""End-to-end test of the mcp-worker OAuth flow against wrangler dev + a local
public-api (run_public_api_local.py). Acts as an MCP client and as the
browser: DCR, PKCE, /authorize, email code, consent, token, MCP calls,
refresh, the remembered device, the link in another browser, revocation."""
import json
import re
import time
import urllib.parse

from client import (EMAIL, REDIRECT, SITE, Browser, api, authorize_url, form_value, last_mail, mail_count,  # noqa: F401
                    mcp_call, ok, pkce, summary, token, wait_mail)

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
ok("tools/list", names == ["aircraft_history", "aircraft_near", "aircraft_profile", "clear_my_location", "find_aircraft",
                         "set_my_location", "special_traffic"], f"{s} {names}")
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

summary()
