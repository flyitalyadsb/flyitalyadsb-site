# FlyItalyADSB auth.md

How an AI agent or an application gets and uses a credential for the FlyItalyADSB APIs.

## Who this is for

Agents and programs that call either of these:

- the MCP server at `https://flyitalyadsb.com/mcp` (streamable HTTP), described in its [server card](https://flyitalyadsb.com/.well-known/mcp/server-card.json);
- the REST API at `https://api.flyitalyadsb.com/v2/`, described in [openapi.json](https://flyitalyadsb.com/openapi.json).

## Supported methods

| Method | Works on | For |
|---|---|---|
| **OAuth 2.1** | the MCP server | assistants with OAuth connectors, such as claude.ai |
| **Agent registration** ([auth.md](https://github.com/workos/auth.md) `service_auth`) | the MCP server and the REST API | an agent that knows the user's email and has no browser redirect |
| **API key** in `X-Api-Key` | the MCP server and the REST API | your own code, Claude Code, clients without OAuth |

Both act as the same account: the plan, limits and usage are those of the email's API key.

## OAuth (MCP server)

**Discovery:**
- An unauthenticated request to `/mcp` answers `401` with `WWW-Authenticate: Bearer resource_metadata="https://flyitalyadsb.com/.well-known/oauth-protected-resource/mcp", scope="mcp"`.
- Protected resource metadata (RFC 9728): <https://flyitalyadsb.com/.well-known/oauth-protected-resource/mcp>.
- Authorization server metadata (RFC 8414): <https://flyitalyadsb.com/.well-known/oauth-authorization-server>. The issuer is `https://flyitalyadsb.com`.

**Clients and flow:**
- **Client registration:** Client ID Metadata Documents (preferred; `client_id_metadata_document_supported: true`) or Dynamic Client Registration at `https://flyitalyadsb.com/oauth/register`.
- **Flow:** authorization code with **PKCE S256**, `resource=https://flyitalyadsb.com/mcp`. Scopes: `mcp` (required) and `offline_access`.
- **Sign-in:** on `https://flyitalyadsb.com/authorize` a person types their email, then the 6-digit code they receive (or opens the link in the same email, in the same browser), and allows access. If the email has no API key yet, a free one is created after the person accepts the terms on that page. **A person has to read the email: an agent cannot finish this alone.**

**Tokens:**
- Access tokens last 1 hour.
- Refresh tokens rotate, and the grant lasts while it is used: it expires after 90 days idle.
- Send the token as `Authorization: Bearer …` to `/mcp`.
- Authorizing the same client again replaces the previous grant.

**Revoking:** the person can disconnect an assistant from [My API](https://flyitalyadsb.com/en/data/api/account/). The API key itself is not touched.

## Agent registration (auth.md)

For an agent that has only the user's email: it registers, the user confirms in their browser, the agent polls for the credential. This follows auth.md v0.6.0, `service_auth` only.

**Discovery:**
- `GET https://flyitalyadsb.com/.well-known/oauth-protected-resource`: `resource` (`https://flyitalyadsb.com/mcp`), `resource_name`, `resource_logo_uri`, `authorization_servers`.
- `GET https://flyitalyadsb.com/.well-known/oauth-authorization-server`, block `agent_auth`:
  - `identity_endpoint`: `https://flyitalyadsb.com/oauth/agent/identity`
  - `claim_endpoint`: `https://flyitalyadsb.com/oauth/agent/identity/claim`
  - `identity_types_supported`: `["service_auth"]`
  - `grant_types_supported` lists `urn:workos:agent-auth:grant-type:claim`.
  - `register_uri`, `claim_uri` and `identity_assertion.assertion_types_supported: ["verified_email"]` are the auth.md v0.1 names of the same endpoints and method. The ceremony is v0.6's below.

**1. Register:** `POST /oauth/agent/identity`, JSON `{"type": "service_auth", "login_hint": "<user's email>"}`. Optional: `"lang": "it"` or `"en"`.
- `200` with `claim_token` (keep it in memory; it is shown once) and `claim: {user_code, verification_uri, expires_in: 600, interval: 5}`. The registration is valid for 1 hour.
- Nothing is emailed at this step.
- Errors:
  - `anonymous_not_enabled`, `issuer_not_enabled` (no anonymous or ID-JAG registration here);
  - `invalid_login_hint`;
  - `429 rate_limited` (20 registrations an hour per IP).
- The v0.1 body `{"type": "identity_assertion", "assertion_type": "verified_email", "assertion": "<email>"}` is accepted as the same thing.

**2. Hand off to the user:** show them `verification_uri` and `user_code` together. On that page they:
- ask for a code sent to that email and type it (this proves the mailbox is theirs);
- then type **your** `user_code`, accept the terms if the email has no key yet (a free key is created), and press Allow.

They can only sign in as the email you registered.

**3. Poll:** `POST https://flyitalyadsb.com/oauth/token`, form `grant_type=urn:workos:agent-auth:grant-type:claim&claim_token=<claim_token>`, every `interval` seconds.
- `authorization_pending`: wait;
- `slow_down`: you polled faster than `interval`;
- `expired_token`: the 10-minute code window closed. Call `POST /oauth/agent/identity/claim` with `{"claim_token", "email"}` for a new `claim_attempt` (`user_code` + `verification_uri`), or register again if that answers `410 claim_expired`;
- `access_denied`: the user declined.
- `200`: `{"access_token": "fiamcp_…", "token_type": "Bearer", "scope": "mcp"}`. It is handed out once; a second poll answers `invalid_grant`.

**4. Use it:**
- on the MCP server as `Authorization: Bearer fiamcp_…`;
- on the REST API as `X-Api-Key: fiamcp_…`.

It has the plan, limits and usage of the email's API key, and it doesn't expire. The user disconnects it from [My API](https://flyitalyadsb.com/en/data/api/account/) (it shows as "AI agent (auth.md)"). After that it answers `401`: register again.

## API key

**Registration:** send `POST https://api.flyitalyadsb.com/v2/keys` with a JSON body.

| Field | Required | Notes |
|---|---|---|
| `email` | yes | An address a person controls. Temporary email domains are refused (`400`, `"code": "disposable-email"`). |
| `name` | no | Up to 200 characters, for example the app, device or agent name. |
| `use_case` | no | Up to 500 characters. |
| `lang` | no | `it` or `en`: the language of the email. Default `it`. |

- **Answer:** `202` with `{"status": "ok", "message": "check your email for a link to your key"}`. It never contains the key.
- **The link:** the address receives a one-time link, valid for 7 days, that shows the key once. A person has to open it. Either ask the user for their email address, or ask them for a key they already have, and use only an address the user gave you for this.
- **Lost key:** the same request for the same address is the recovery path. The old key keeps working until the new link is used.
- **One free key per mailbox:** `+tag` and Gmail-dot variants count as the same mailbox.
- **Repeated requests:** a request for an address that just asked answers `429`. Wait a few minutes.
- **Humans** can use the form at <https://flyitalyadsb.com/en/data/api/#api-key>.

**Using the key:** send it in the `X-Api-Key` header on every request, to the REST API and to `/mcp` alike:

```http
GET /v2/mil HTTP/1.1
Host: api.flyitalyadsb.com
X-Api-Key: <your-key>
```

Keep the key out of public repositories and logs. To replace a key, request a new link for the same address.

## Errors and limits

- `401`: the credential is missing or invalid. On `/mcp` the `401` also carries the OAuth challenge.
- `429`: the per-minute limit (wait for `Retry-After`) or the plan's monthly quota.
- Responses from the REST API carry the plan in `X-FIA-Plan` and this month's usage in `X-FIA-Used-Month`.
- Plans and limits: <https://flyitalyadsb.com/en/data/api/#piani>.

## Data licence

The data is CC BY-SA 4.0: credit FlyItalyADSB.
