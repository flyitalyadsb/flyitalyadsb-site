---
title: MCP server
description: "FlyItalyADSB's MCP server at flyitalyadsb.com/mcp: the four tools, how to connect it to Claude, Claude Code and other clients, and how requests are counted."
key: mcp
order: 7
updated: 2026-10-22
---

The [Model Context Protocol](https://modelcontextprotocol.io) is the standard that assistants such as Claude or ChatGPT use to call external tools. Our server answers at `https://flyitalyadsb.com/mcp` (Streamable HTTP) with four read-only tools:

| Tool | What it does |
|---|---|
| `find_aircraft` | one aircraft by ICAO hex, callsign or registration |
| `aircraft_near` | every aircraft within a radius of a point, or of an Italian airport by name |
| `special_traffic` | military, PIA or LADD traffic |
| `aircraft_history` | an aircraft's dates with history, or its track on one day |

## Connect it to Claude

1. On [claude.ai](https://claude.ai/customize/connectors), open **Connectors** and choose **Add custom connector**.
2. Name `FlyItalyADSB`, URL `https://flyitalyadsb.com/mcp`.
3. Press **Connect**: enter your email and the 6-digit code you receive, then press **Allow**. If you have no key, a free one is created.
4. Ask, for example: *"which aircraft are near Rome Fiumicino right now?"*

Disconnect it from [My API](/en/data/api/account/).

## Claude Code and clients without OAuth

With your key in the header:

```sh
claude mcp add --transport http flyitalyadsb https://flyitalyadsb.com/mcp \
  --header "X-Api-Key: YOUR_KEY"
```

Other MCP clients with OAuth connect with Connect, as Claude does. Agents that only know your email can use [auth.md registration](/en/data/api/docs/authentication/#agent-registration-authmd).

## Limits

Each tool call is an API request and counts on your key's plan, like a direct call. The maximum radius is the plan's too.
