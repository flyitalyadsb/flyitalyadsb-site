# flyitalyadsb-mcp

The Cloudflare Worker in front of `flyitalyadsb.com/mcp`: the MCP server with OAuth, so claude.ai and other assistants
connect with **Connect → email code → Allow** instead of a pasted key. Design and the account side (public-api
`connect.py`): nesso-infra `docs/FLYITALYADSB-MCP-OAUTH.md`.

| Path | |
|---|---|
| `/mcp` + `X-Api-Key` | as before: the caller's own key goes to `api.flyitalyadsb.com/v2` |
| `/mcp` + `Bearer` | OAuth (`@cloudflare/workers-oauth-provider`). The grant's props carry a public-api connection token, used as the key. |
| `/authorize`, `/authorize/email` | sign-in with a 6-digit code or the link in the same email, then consent (`src/authorize.ts`, `src/pages.ts`) |
| `/oauth/token`, `/oauth/register`, `/.well-known/oauth-*` | the library: CIMD (Claude's published identity), DCR, PKCE, RFC 8414/9728 |

The Worker runs on these paths only, through Worker routes on the zone. Everything else on `flyitalyadsb.com` is the
Pages site.

## Local

```sh
cp mcp-worker/.dev.vars.example mcp-worker/.dev.vars
# a local public-api (nesso-infra checkout, local Postgres on 54341): emails go to a file
uv run --with "psycopg[binary]==3.3.4" python mcp-worker/e2e/run_public_api_local.py <nesso-infra>/k8s/flyitalyadsb/base/public-api /tmp/mail.jsonl 8081
npm run mcp:dev                                    # http://localhost:8787
python3 mcp-worker/e2e/e2e_mcp_oauth.py /tmp/mail.jsonl   # 26 checks, the whole flow
npm run mcp:check                                  # wrangler types + tsc
```

## Deploy

Automatic: every push to `main` that touches the Worker runs `.github/workflows/mcp-worker.yml`, which deploys it
with the `mcp-worker` environment's token. Pull requests get the type check and a `--dry-run`. By hand, with your
own wrangler login, it is still `npm run mcp:deploy`.

Routes, the KV namespace and the deploy token are in nesso-infra `terraform/cloudflare`. The secrets
`CONSENT_SECRET` and `DEVICE_SECRET` are random, 32+ characters each, and their values live in Infisical.
