---
title: Authentication
description: "An API key in X-Api-Key, OAuth for AI assistants, and agent registration with auth.md: how to get and manage access to the FlyItalyADSB API."
key: authentication
order: 2
updated: 2026-10-22
---

There are three ways in, and all of them act as the same account: the plan, limits and usage are those of your email's key.

| Method | Works on | For |
|---|---|---|
| Key in `X-Api-Key` | REST API and MCP server | your own code, Claude Code, clients without OAuth |
| OAuth 2.1 | MCP server | assistants with OAuth connectors, such as claude.ai |
| Agent registration ([auth.md](/auth.md)) | REST API and MCP server | an AI agent that only knows your email |

## API key

Send it with every request, in the `X-Api-Key` header:

```http
GET /v2/mil HTTP/1.1
Host: api.flyitalyadsb.com
X-Api-Key: YOUR_KEY
```

**To get one:**
- use the form on [REST API](/en/data/api/#api-key);
- or request it from code:

  ```sh
  curl -X POST https://api.flyitalyadsb.com/v2/keys \
    -H "Content-Type: application/json" \
    -d '{"email": "you@example.com", "name": "My app", "lang": "en"}'
  ```

The answer (`202`) never contains the key. A link arrives by email; it shows the key once and is valid for 7 days.

**Rules:**
- **One free key per mailbox:** `+tag` variants and, on Gmail, dotted variants count as the same mailbox.
- Temporary email addresses are refused.
- If the address requested a key moments ago, the answer is `429`: wait a few minutes.

**Lost key:** send the same request for the same email. The old key keeps working until you open the new link.

**[My API](/en/data/api/account/):** sign in with your email and a code.
- See your keys, plan and usage.
- Regenerate a key. Regenerating replaces it at once, with the same plan, and the old one stops working. Connected assistants stay connected.
- Disconnect assistants.

**Keep it safe:** out of public repositories and logs. A key inside an app or a web page can be extracted. If that worries you, use it only from your server.

## OAuth (MCP server)

Assistants with OAuth connectors connect to `https://flyitalyadsb.com/mcp` with **Connect**: enter your email, then the 6-digit code you receive, and press **Allow**. If you have no key yet, a free one is created. The steps for Claude are in [MCP server](/en/data/api/docs/mcp/); the technical details (discovery, PKCE, tokens) are in [auth.md](/auth.md).

## Agent registration (auth.md)

An AI agent that only knows your email can ask for access without a browser redirect, following [auth.md](https://github.com/workos/auth.md):

1. The agent registers with your email.
2. It gives you a link and a 6-digit code.
3. You open the link, sign in with the code we email you, and type the agent's code.

The agent receives access that shows in My API as "AI agent (auth.md)", and you can disconnect it at any time. The protocol for agent developers is in [auth.md](/auth.md).
