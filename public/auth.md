# FlyItalyADSB auth.md

How an AI agent or an application gets and uses a credential for the FlyItalyADSB APIs.

## Who this is for

Agents and programs that call either of these:

- the REST API at `https://api.flyitalyadsb.com/v2/`, described in [openapi.json](https://flyitalyadsb.com/openapi.json);
- the MCP server at `https://flyitalyadsb.com/mcp` (streamable HTTP), described in its [server card](https://flyitalyadsb.com/.well-known/mcp/server-card.json).

Both take the same credential: an API key.

## Supported method

There is one method: an **API key tied to a verified email address**.

There is no OAuth authorization server, no dynamic client registration and no anonymous access. Every request needs a key, except the signup request below.

## Registration

Send `POST https://api.flyitalyadsb.com/v2/keys` with a JSON body:

| Field | Required | Notes |
|---|---|---|
| `email` | yes | An address a person controls. Temporary email domains are refused (`400`, `"code": "disposable-email"`). |
| `name` | no | Up to 200 characters, for example the app, device or agent name. |
| `use_case` | no | Up to 500 characters. |
| `lang` | no | `it` or `en`: the language of the email. Default `it`. |

The answer is `202` with `{"status": "ok", "message": "check your email for a link to your key"}`. It never contains the key.

The address receives a one-time link, valid for 7 days. The link opens a page that shows the key once, and the key is created at that moment. **A person has to open that email, so an agent cannot finish registration on its own.** Either ask the user for their email address and to open the link, or ask them for a key they already have. Use only an address the user gave you for this.

- **Lost key:** the same request for the same address is the recovery path. The old key keeps working until the new link is used.
- **One free key per mailbox:** `+tag` and Gmail-dot variants count as the same mailbox.
- **Repeated requests:** a request for an address that just asked answers `429`. Wait a few minutes.
- **Humans** can use the form at <https://flyitalyadsb.com/en/data/api/#api-key>.

## Using the credential

Send the key in the `X-Api-Key` header on every request:

```http
GET /v2/mil HTTP/1.1
Host: api.flyitalyadsb.com
X-Api-Key: <your-key>
```

For the MCP server, configure the same header in the client, for example as a custom header on a Claude connector.

- `401`: the key is missing or invalid.
- `429`: per-minute limit (wait for `Retry-After`) or the plan's monthly quota.
- Responses carry the key's plan in `X-FIA-Plan` and this month's usage in `X-FIA-Used-Month`.
- Plans and limits: <https://flyitalyadsb.com/en/data/api/#piani>.

Keep the key out of public repositories and logs. To replace a key, request a new link for the same address.

## Data licence

The data is CC BY-SA 4.0: credit FlyItalyADSB.
