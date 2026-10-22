# flyitalyadsb-mcp

The Cloudflare Worker in front of `flyitalyadsb.com/mcp`: the MCP server with OAuth, so claude.ai and other assistants
connect with **Connect → email code → Allow** instead of a pasted key. Design and the account side (public-api
`connect.py`): nesso-infra `docs/FLYITALYADSB-MCP-OAUTH.md`.

| Path | |
|---|---|
| `/mcp` + `X-Api-Key` | as before: the caller's own key goes to `api.flyitalyadsb.com/v2` |
| `/mcp` + `Bearer` | OAuth (`@cloudflare/workers-oauth-provider`). The grant's props carry a public-api connection token, used as the key. |
| `/authorize`, `/authorize/email` | sign-in with a 6-digit code or the link in the same email, then consent (`src/authorize.ts`, `src/pages.ts`) |
| `/oauth/agent/identity[/claim]`, `/authorize/agent`, the claim grant on `/oauth/token`, `/mcp` + `Bearer fiamcp_…` | [auth.md](https://github.com/workos/auth.md) v0.6 agent registration, `service_auth` only (`src/agent.ts`): the agent names the email, the user signs in and types the agent's code, the agent polls and receives a connection token |
| `/oauth/token`, `/oauth/register`, `/.well-known/oauth-*` | the library: CIMD (Claude's published identity), DCR, PKCE, RFC 8414/9728 |

The Worker runs on these paths only, through Worker routes on the zone. Everything else on `flyitalyadsb.com` is the
Pages site.

## In-chat map (MCP Apps)

`aircraft_near`, `special_traffic` and `find_aircraft` carry `_meta.ui.resourceUri` =
`ui://flyitalyadsb/aircraft-map.html` ([MCP Apps](https://github.com/modelcontextprotocol/ext-apps), spec
2026-01-26). Hosts that support it (claude.ai, Claude desktop and mobile, ChatGPT) read that resource and draw the
tool's result on a map in the conversation; other clients ignore `_meta` and get the same JSON text as before.

- `src/lib/mcp/apps/aircraft-map.ts`: the resource, its CSP (OpenStreetMap tiles only, nothing fetched) and the tools'
  `_meta`. `aircraft-map.html` + `aircraft-map.view.js` are the page; wrangler inlines them and Leaflet as text, and
  the brand mark (`flyitalyadsb-mark.webp`, the site's logo at 48 px) as a data: image (`rules` in
  `wrangler.jsonc`), so the page loads nothing but tiles.
- The three tools return the JSON text every client got before, plus the same object as `structuredContent`
  (`aircraftMapResult`), except for ChatGPT (an `openai/*` key in the request's `_meta`: it shows structuredContent
  to the model too) and above 60k characters. The view takes the payload from whichever field has it, and if none
  does it asks the host to run the call again (`tools/call`, once). Failing that it shows what arrived (field names,
  lengths, no data) under the notice and logs it. Hosts lose fields on the way: ext-apps#696,
  claude-ai-mcp#1158, claude-code#103809. The preview reproduces them ("What the host makes of the result").
- It talks to the host directly over postMessage (verified against the SDK's own `AppBridge`, ext-apps 2.0.3).

Preview with fake results (every state, dark/light, IT/EN, inline/fullscreen, phone width):

```sh
npm run mcp:dev        # the Worker, http://127.0.0.1:8787
npm run mcp:preview    # http://127.0.0.1:8790/ : the page comes from the Worker's resources/read
```

## Local

```sh
cp mcp-worker/.dev.vars.example mcp-worker/.dev.vars
# a local public-api (nesso-infra checkout, local Postgres on 54341): emails go to a file
uv run --with "psycopg[binary]==3.3.4" python mcp-worker/e2e/run_public_api_local.py <nesso-infra>/k8s/flyitalyadsb/base/public-api /tmp/mail.jsonl 8081
npm run mcp:dev                                    # http://localhost:8787
python3 mcp-worker/e2e/e2e_mcp_oauth.py /tmp/mail.jsonl   # 26 checks, the whole OAuth flow
python3 mcp-worker/e2e/e2e_auth_md.py /tmp/mail.jsonl     # 36 checks, auth.md agent registration
uv run --with "psycopg[binary]==3.3.4" python mcp-worker/e2e/e2e_near_me.py /tmp/mail.jsonl  # 10 checks, "aircraft near me"
uv run --with "psycopg[binary]==3.3.4" python mcp-worker/e2e/e2e_profile.py /tmp/mail.jsonl  # 13 checks, aircraft_profile
# overflights: start the local public-api with GLOBE_HISTORY_DIR and OVERFLIGHTS_INDEX_DIR set to two empty dirs;
# the test writes synthetic traces there and builds the index with public-api's own overflights.py
GLOBE_HISTORY_DIR=… OVERFLIGHTS_INDEX_DIR=… uv run --with "psycopg[binary]==3.3.4" python mcp-worker/e2e/e2e_overflights.py /tmp/mail.jsonl <nesso-infra>/k8s/flyitalyadsb/base/public-api  # 14 checks
# notable_traffic: start the public-api above with FIA_E2E_EVENTS=1 (a 7700 + a military aircraft, the events detector on)
uv run --with "psycopg[binary]==3.3.4" python mcp-worker/e2e/e2e_notable_traffic.py /tmp/mail.jsonl  # 10 checks
uv run --with "psycopg[binary]==3.3.4" python mcp-worker/e2e/e2e_map_widget.py /tmp/mail.jsonl  # 24 checks, the in-chat map
# both expect a fresh local public-api: it recreates its e2e schema at start
npm run mcp:check                                  # wrangler types + tsc
```

Other ports, to run a second stack next to this one: `FIA_E2E_PG` (Postgres URL, for run_public_api_local.py and the
e2e scripts), `FIA_E2E_API_PORT` (the local public-api), `FIA_E2E_SITE` (wrangler dev's URL; match `SITE` in
`.dev.vars` and pass the same port to `wrangler dev --port`).

## Deploy

Automatic: every push to `main` that touches the Worker runs `.github/workflows/mcp-worker.yml`, which deploys it
with the `mcp-worker` environment's token. Pull requests get the type check and a `--dry-run`. By hand, with your
own wrangler login, it is still `npm run mcp:deploy`.

Routes, the KV namespace and the deploy token are in nesso-infra `terraform/cloudflare`. The secrets
`CONSENT_SECRET` and `DEVICE_SECRET` are random, 32+ characters each, and their values live in Infisical.
