"""End-to-end test of auth.md agent registration (src/agent.ts) against
wrangler dev + a local public-api (run_public_api_local.py): discovery,
service_auth, the claim page in a browser (email code, the agent's code,
terms), polling the claim grant, the connection token on /mcp, a fresh
user_code, the binding to the browser, refusal, too many attempts, and the
auth.md v0.1 body. Usage: e2e_auth_md.py <mail log>"""
import json
import re
import time
import urllib.parse

from client import SITE, Browser, api, form_value, last_mail, mail_count, mcp_call, ok, summary, token, wait_mail

AGENT_EMAIL = f"agent-{int(time.time())}@example.test"
CLAIM_GRANT = "urn:workos:agent-auth:grant-type:claim"


def post_json(path, payload):
    s, _, data = Browser().req("POST", path, json.dumps(payload), {"Content-Type": "application/json"})
    try:
        return s, json.loads(data or "{}")
    except json.JSONDecodeError:
        return s, {"raw": data[:200]}


def poll(claim_token):
    return token({"grant_type": CLAIM_GRANT, "claim_token": claim_token})


def open_claim(browser, verification_uri):
    """GET the link the agent gives the user; returns (status, page, flow id)."""
    path = urllib.parse.urlsplit(verification_uri)
    s, _, page = browser.req("GET", f"{path.path}?{path.query}")
    return s, page, form_value(page, "f")


def email_code(n, to):
    mail = wait_mail(n)
    if not mail or mail["to"] != to:
        return None
    m = re.search(r"^  (\d{6})$", mail["body"], re.M)
    return m.group(1) if m else None


# --- discovery ---------------------------------------------------------------------
s, _, data = Browser().req("GET", "/.well-known/oauth-protected-resource")
prm = json.loads(data or "{}") if s == 200 else {}
ok("root protected resource metadata (auth.md step 1a)",
   prm.get("resource") == f"{SITE}/mcp" and prm.get("authorization_servers") == [SITE]
   and prm.get("bearer_methods_supported") == ["header"] and prm.get("resource_name") == "FlyItalyADSB", f"{s} {data[:200]}")
s, _, data = Browser().req("GET", "/.well-known/oauth-authorization-server")
asm = json.loads(data or "{}") if s == 200 else {}
aa = asm.get("agent_auth", {})
ok("AS metadata: agent_auth block (skill, identity/claim endpoints, service_auth)",
   aa.get("skill", "").endswith("/auth.md") and aa.get("identity_endpoint") == f"{SITE}/oauth/agent/identity"
   and aa.get("claim_endpoint") == f"{SITE}/oauth/agent/identity/claim" and aa.get("identity_types_supported") == ["service_auth"],
   json.dumps(aa)[:300])
ok("AS metadata: v0.1 aliases and the claim grant",
   aa.get("register_uri") == aa.get("identity_endpoint") and aa.get("claim_uri") == aa.get("claim_endpoint")
   and CLAIM_GRANT in asm.get("grant_types_supported", []) and asm.get("issuer") == SITE, json.dumps(asm)[:300])
s, _, data = Browser().req("GET", "/.well-known/oauth-protected-resource/mcp")
ok("the /mcp protected resource metadata still comes from the library, now with a name",
   s == 200 and json.loads(data).get("resource_name") == "FlyItalyADSB", f"{s} {data[:160]}")

# --- registration ---------------------------------------------------------------------
s, r = post_json("/oauth/agent/identity", {"type": "anonymous"})
ok("anonymous -> anonymous_not_enabled", s == 400 and r.get("error") == "anonymous_not_enabled", f"{s} {r}")
s, r = post_json("/oauth/agent/identity", {"type": "identity_assertion", "assertion_type": "urn:ietf:params:oauth:token-type:id-jag", "assertion": "x"})
ok("ID-JAG -> issuer_not_enabled", s == 400 and r.get("error") == "issuer_not_enabled", f"{s} {r}")
s, r = post_json("/oauth/agent/identity", {"type": "service_auth", "login_hint": "not an email"})
ok("bad login_hint -> invalid_login_hint", s == 400 and r.get("error") == "invalid_login_hint", f"{s} {r}")

mails_before = mail_count()
s, reg = post_json("/oauth/agent/identity", {"type": "service_auth", "login_hint": AGENT_EMAIL})
claim = reg.get("claim", {})
ok("service_auth registration -> claim_token + claim block (RFC 8628 shape)",
   s == 200 and reg.get("registration_type") == "service_auth" and reg.get("claim_token", "").startswith("clm_")
   and re.fullmatch(r"\d{6}", claim.get("user_code", "")) and claim.get("verification_uri", "").startswith(f"{SITE}/authorize/agent?t=")
   and claim.get("interval") == 5 and reg.get("post_claim_scopes") == ["mcp"], f"{s} {reg}")
time.sleep(0.3)
ok("registering sends no email", mail_count() == mails_before)

s, r = poll(reg["claim_token"])
ok("poll before the user acts -> authorization_pending", s == 400 and r.get("error") == "authorization_pending", f"{s} {r}")
s, r = poll(reg["claim_token"])
ok("poll again at once -> slow_down", s == 400 and r.get("error") == "slow_down", f"{s} {r}")

# --- a fresh user_code ------------------------------------------------------------------
s, r = post_json("/oauth/agent/identity/claim", {"claim_token": reg["claim_token"], "email": "someone@example.test"})
ok("re-initiate with another email -> invalid_request", s == 400 and r.get("error") == "invalid_request", f"{s} {r}")
s, re1 = post_json("/oauth/agent/identity/claim", {"claim_token": reg["claim_token"], "email": AGENT_EMAIL})
ca = re1.get("claim_attempt", {})
ok("re-initiate -> a new claim_attempt", s == 200 and re1.get("status") == "initiated"
   and ca.get("verification_uri") != claim.get("verification_uri") and re.fullmatch(r"\d{6}", ca.get("user_code", "")), f"{s} {re1}")
s, page, _ = open_claim(Browser(), claim["verification_uri"])
ok("the old link no longer opens", s == 400 and "scaduto" in page, f"{s} {page[:160]}")
s, r = post_json("/oauth/agent/identity/claim", {"claim_token": "clm_nope", "email": AGENT_EMAIL})
ok("unknown claim_token -> invalid_claim_token", s == 400 and r.get("error") == "invalid_claim_token", f"{s} {r}")

# --- the claim page -------------------------------------------------------------------------
user = Browser()
s, page, flow = open_claim(user, ca["verification_uri"])
ok("claim page names the email and warns, no email field",
   s == 200 and AGENT_EMAIL in page and "Continua solo se" in page and 'type="email"' not in page and flow, f"{s} {page[:200]}")
ok("claim page has the CSP and no framing", "frame-ancestors 'none'" in json.dumps(user.req("GET", "/authorize/agent?t=x")[1]))
s, _, page = Browser().req("POST", "/authorize/agent", {"f": flow, "step": "send"})
ok("another browser can't use the flow", s == 400, f"{s} {page[:120]}")

n = mail_count() + 1
s, _, page = user.req("POST", "/authorize/agent", {"f": flow, "step": "send"})
code = email_code(n, AGENT_EMAIL)
ok("send -> email code to the agent's email, code page", s == 200 and code and "Controlla la tua email" in page, f"{s} {page[:160]}")
s, _, page = user.req("POST", "/authorize/agent", {"f": flow, "step": "code", "code": "000000" if code != "000000" else "111111"})
ok("wrong email code -> 401 on the code page", s == 401 and 'name="code"' in page, f"{s}")
s, _, page = user.req("POST", "/authorize/agent", {"f": flow, "step": "code", "code": code})
ok("right email code -> confirm page asking for the agent's code, terms box (new user)",
   s == 200 and 'name="user_code"' in page and "accept_terms" in page, f"{s} {page[:200]}")
wrong_uc = "000000" if ca["user_code"] != "000000" else "111111"
s, _, page = user.req("POST", "/authorize/agent", {"f": flow, "step": "confirm", "decision": "approve", "user_code": wrong_uc, "accept_terms": "1"})
ok("wrong agent code -> 401 with attempts left", s == 401 and "Tentativi rimasti: 4" in page, f"{s} {page[:200]}")
s, _, page = user.req("POST", "/authorize/agent", {"f": flow, "step": "confirm", "decision": "approve", "user_code": ca["user_code"]})
ok("right agent code without terms -> terms needed", s == 400 and "accettare le condizioni" in page, f"{s}")
time.sleep(4.2)  # past the slow_down window of the earlier polls
s, _, page = user.req("POST", "/authorize/agent", {"f": flow, "step": "confirm", "decision": "approve", "user_code": ca["user_code"], "accept_terms": "1"})
ok("right agent code + terms -> done", s == 200 and "l’agente è collegato" in page, f"{s} {page[:200]}")

s, tok = poll(reg["claim_token"])
ok("poll -> access_token (a connection token), Bearer, scope mcp",
   s == 200 and tok.get("access_token", "").startswith("fiamcp_") and tok.get("token_type") == "Bearer" and tok.get("scope") == "mcp", f"{s} {tok}")
s, r = poll(reg["claim_token"])
ok("the token is handed out once -> invalid_grant", s == 400 and r.get("error") == "invalid_grant", f"{s} {r}")

agent_token = tok.get("access_token", "")
s, _, res = mcp_call(token=agent_token, method="initialize", params={
    "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "e2e-agent", "version": "1"}})
ok("MCP initialize with Bearer <connection token>", s == 200 and "result" in res, f"{s} {res}")
s, _, res = mcp_call(token=agent_token, method="tools/call", req_id=2, params={"name": "special_traffic", "arguments": {"category": "military"}})
ok("tool call reaches public-api with it", s == 200 and "IAM4653" in json.dumps(res), f"{s} {json.dumps(res)[:200]}")

# the account sees it as a connection it can revoke
time.sleep(1.1)
n = mail_count() + 1
api("POST", "/v2/account/login", {"email": AGENT_EMAIL, "purpose": "connect", "flow": "e2e_agent_check_0123456"})
c = email_code(n, AGENT_EMAIL)
st, sess = api("POST", "/v2/account/session", {"email": AGENT_EMAIL, "code": c})
st, me = api("GET", "/v2/account/me", headers={"Authorization": f"Bearer {sess.get('session', '')}"})
conns = me.get("connections", [])
ok("La mia API lists it as 'AI agent (auth.md)', next to the free key it created",
   any(x.get("client_name") == "AI agent (auth.md)" for x in conns) and len(me.get("keys", [])) == 1, json.dumps(me)[:300])

# --- the link in the email, then refusal ------------------------------------------------------
s, reg2 = post_json("/oauth/agent/identity", {"type": "service_auth", "login_hint": AGENT_EMAIL, "lang": "en"})
user2 = Browser()
s, page, flow2 = open_claim(user2, reg2["claim"]["verification_uri"])
time.sleep(1.1)
n = mail_count() + 1
user2.req("POST", "/authorize/agent", {"f": flow2, "step": "send"})
mail = wait_mail(n)
frag = urllib.parse.parse_qs(urllib.parse.urlparse(re.search(r"(http\S+/authorize/email#\S+)", mail["body"]).group(1)).fragment)
s, _, page = Browser().req("POST", "/authorize", {"step": "link", "t": frag["t"][0], "f": frag["f"][0]})
ok("the email link in another browser is refused", s == 400, f"{s}")
s, _, page = user2.req("POST", "/authorize", {"step": "link", "t": frag["t"][0], "f": frag["f"][0]})
ok("the email link (via /authorize) signs in to the claim flow; existing key: no terms box",
   s == 200 and 'name="user_code"' in page and "accept_terms" not in page, f"{s} {page[:200]}")
s, _, page = user2.req("POST", "/authorize/agent", {"f": flow2, "step": "confirm", "decision": "deny"})
ok("deny -> declined page (in the browser's language)", s == 200 and "Hai rifiutato" in page, f"{s} {page[:160]}")
s, r = poll(reg2["claim_token"])
ok("poll after refusal -> access_denied", s == 400 and r.get("error") == "access_denied", f"{s} {r}")

# --- too many wrong agent codes ---------------------------------------------------------------
s, reg3 = post_json("/oauth/agent/identity", {"type": "service_auth", "login_hint": AGENT_EMAIL})
user3 = Browser()
s, page, flow3 = open_claim(user3, reg3["claim"]["verification_uri"])
time.sleep(1.1)
n = mail_count() + 1
user3.req("POST", "/authorize/agent", {"f": flow3, "step": "send"})
user3.req("POST", "/authorize/agent", {"f": flow3, "step": "code", "code": email_code(n, AGENT_EMAIL)})
bad = "000000" if reg3["claim"]["user_code"] != "000000" else "111111"
statuses = [user3.req("POST", "/authorize/agent", {"f": flow3, "step": "confirm", "decision": "approve", "user_code": bad})[0] for _ in range(5)]
ok("5 wrong agent codes -> the attempt is closed", statuses[:4] == [401] * 4 and statuses[4] == 403, f"{statuses}")
s, r = poll(reg3["claim_token"])
ok("poll after that -> expired_token (ask for a new code)", s == 400 and r.get("error") == "expired_token", f"{s} {r}")

# --- auth.md v0.1 body ------------------------------------------------------------------------
s, r = post_json("/oauth/agent/identity", {"type": "identity_assertion", "assertion_type": "verified_email", "assertion": AGENT_EMAIL})
ok("v0.1 verified_email body -> the same service_auth registration", s == 200 and r.get("registration_type") == "service_auth" and "claim" in r, f"{s} {r}")

summary()
