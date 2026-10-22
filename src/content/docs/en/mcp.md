---
title: MCP server
description: "FlyItalyADSB's MCP server at flyitalyadsb.com/mcp: the tools, “near me”, how to connect it to Claude, Claude Code and other clients, and how requests are counted."
key: mcp
order: 7
updated: 2026-10-22
---

The [Model Context Protocol](https://modelcontextprotocol.io) is the standard that assistants such as Claude or ChatGPT use to call external tools. Our server answers at `https://flyitalyadsb.com/mcp` (Streamable HTTP) with these tools:

| Tool | What it does |
|---|---|
| `find_aircraft` | one aircraft by ICAO hex, callsign or registration |
| `aircraft_near` | every aircraft within a radius of a point, or of an Italian airport by name |
| `special_traffic` | military, PIA or LADD traffic |
| `aircraft_history` | an aircraft's dates with history, or its track on one day |
| `aircraft_profile` | what we know about one aircraft: identity, live status, history summary, map and photo links |
| `overflights` | the aircraft that flew over a place (coordinates, an airport or your saved position) between two times |
| `notable_traffic` | notable traffic (emergencies, military) in an area over the last hours |
| `set_my_location` | saves your position on the account, for "near me" |
| `clear_my_location` | deletes it |

The [MCP and AI agents](/en/data/mcp/) page has the same steps with screenshots of the map in the chat and an example question for each tool.

## Connect it to Claude

1. On [claude.ai](https://claude.ai/customize/connectors), open **Connectors** and choose **Add custom connector**.
2. Name `FlyItalyADSB`, URL `https://flyitalyadsb.com/mcp`.
3. Press **Connect**: enter your email and the 6-digit code you receive, then press **Allow**. If you have no key, a free one is created.
4. Ask, for example: *"which aircraft are near Rome Fiumicino right now?"*

Disconnect it from [My API](/en/data/api/account/).

## Near me

No assistant passes your phone's or computer's position to the server. To ask "which aircraft are near me?" without saying where you are, save a position once:
- from [My API](/en/data/api/account/), with **Use my position**;
- or by telling the assistant: "my position is Brescia".

We store it rounded to about 1 km, one per account, and you can delete it at any time ("forget my position", or from My API). On ChatGPT, if you haven't saved one, we use the city ChatGPT attaches to the request.

## The map in the chat

In Claude (web, desktop and mobile) and ChatGPT, `aircraft_near`, `special_traffic` and `find_aircraft` also show their result on a map in the conversation: aircraft coloured by altitude, the search area, a list you can sort, and the details of the one you tap. Other clients get the same data as text.

Between updates, aircraft in flight move along their track at their speed: that is an estimate, and after a minute without new data they stop and fade. Refresh repeats the search; Live repeats it every 30 seconds for up to 10 minutes, only while the map is on screen, then pauses. Each update counts as one request: Live makes 2 a minute.

The map loads only OpenStreetMap tiles, asks for no permissions and doesn't use your location. Map © OpenStreetMap contributors; aircraft data © FlyItalyADSB, CC BY-SA 4.0.

## Claude Code and clients without OAuth

With your key in the header:

```sh
claude mcp add --transport http flyitalyadsb https://flyitalyadsb.com/mcp \
  --header "X-Api-Key: YOUR_KEY"
```

Other MCP clients with OAuth connect with Connect, as Claude does. Agents that only know your email can use [auth.md registration](/en/data/api/docs/authentication/#agent-registration-authmd).

## Limits

Each tool call is an API request and counts on your key's plan, like a direct call. The maximum radius is the plan's too.
