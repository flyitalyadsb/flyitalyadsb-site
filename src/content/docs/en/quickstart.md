---
title: Quickstart
description: "From a free key to your first FlyItalyADSB API response in two minutes, with curl, Python and JavaScript."
key: quickstart
order: 1
updated: 2026-10-22
---

## 1. Get a key

Enter your email in the form on [REST API](/en/data/api/#api-key). You receive a link that shows the key once and is valid for 7 days. The key is free, with no approval, and allows commercial use within the plan's limits.

You can also request it from code: see [Authentication](/en/data/api/docs/authentication/).

## 2. Your first request

Every aircraft within 50 km of Rome Fiumicino:

```sh
curl -H "X-Api-Key: YOUR_KEY" \
  https://api.flyitalyadsb.com/v2/lat/41.80/lon/12.25/dist/50
```

The answer is JSON: `now` (Unix seconds), `count` and `ac`, the list of aircraft. Each aircraft is a record in readsb's format (fields in [Fields and units](/en/data/api/docs/fields/)). A shortened example, with illustrative values:

```json
{
  "now": 1761134400.1,
  "count": 37,
  "ac": [
    { "hex": "4ca7b5", "flight": "RYR42KD ", "r": "EI-ABC", "t": "B738",
      "lat": 41.83, "lon": 12.31, "alt_baro": 7225, "gs": 251.4, "track": 293.1,
      "squawk": "4361", "seen_pos": 0.6 }
  ]
}
```

### Python

```python
import requests

r = requests.get(
    "https://api.flyitalyadsb.com/v2/lat/41.80/lon/12.25/dist/50",
    headers={"X-Api-Key": "YOUR_KEY"},
    timeout=10,
)
r.raise_for_status()
for a in r.json()["ac"]:
    print(a.get("flight", "").strip(), a.get("r"), a.get("alt_baro"))
```

### JavaScript

```js
const res = await fetch("https://api.flyitalyadsb.com/v2/lat/41.80/lon/12.25/dist/50", {
  headers: { "X-Api-Key": "YOUR_KEY" },
});
const { ac } = await res.json();
```

The API also answers browsers (CORS is open), but a key inside a web page is public: use it from your server.

## 3. Next

- [Endpoints](/en/data/api/docs/endpoints/): one aircraft by hex, callsign or registration, military traffic, history.
- [Limits and errors](/en/data/api/docs/limits-and-errors/): what happens when you go over your plan.
- [MCP server](/en/data/api/docs/mcp/): the same data in Claude, ChatGPT and other AI assistants.
- [Commercial use](/en/data/api/docs/commercial-use/): apps and devices you sell, attribution.
