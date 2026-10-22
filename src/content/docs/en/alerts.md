---
title: Alerts and notable traffic
description: "Notable traffic in the FlyItalyADSB API: emergency squawks, military and other notable aircraft by area with /v2/events, and signed webhooks for push alerts on paid plans, with signature checks in Python and JavaScript."
key: alerts
order: 6.5
updated: 2026-10-22
---

The network records **notable traffic** as events. You can read them by area (`/v2/events`, every plan) or receive them as they happen with a **webhook** (paid plans).

| Kind | When |
|---|---|
| `emergency` | squawk `7500` (hijack), `7600` (radio failure), `7700` (general emergency), or the ADS-B emergency status (`minfuel`, `nordo`, `unlawful`, `downed`). The `lifeguard` status of medical flights is not an emergency. `reason` says which. |
| `military` | an aircraft marked military in the aircraft database (`dbFlags` bit 0) |
| `interesting` | an aircraft marked "interesting" in the aircraft database (`dbFlags` bit 1), such as government aircraft |

How events are recorded:

- **One event per aircraft and ~0.5° cell** (about 55 km north–south). A flight crossing your area is recorded where it enters each cell. The position is a sample, not the track: for the full track, use [History](/en/data/api/docs/history/).
- An aircraft in the same cell produces a new event only after 30 minutes away (emergencies) or 60 minutes (the others).
- A condition must be seen twice in a row, a few seconds apart, so a single garbled message does not become an event.
- An emergency squawk is what the transponder sent, not a confirmed emergency: crews sometimes set one by mistake and fix it seconds later. Positions come from ADS-B or MLAT (`source`) and can be wrong or spoofed.
- Events are about aircraft: they never carry the names of owners or operators.

## Reading events: `/v2/events`

```sh
curl -H "X-Api-Key: YOUR_KEY" \
  "https://api.flyitalyadsb.com/v2/events?lat=45.54&lon=10.22&dist=100&since=2026-10-21T12:00:00Z&kinds=emergency,military"
```

| Parameter | |
|---|---|
| `lat`, `lon`, `dist` | the area: a point and a radius in km, required. The plan's maximum radius applies, as for `/lat/…/lon/…/dist/…`. |
| `since`, `until` | Unix seconds or ISO 8601 (without a time zone, UTC). Default: the last 24 hours. At most 7 days back. |
| `kinds` | comma-separated, default all three |
| `limit` | up to 500, default 100. `truncated: true` means more events matched. |

Each request counts as one. The answer lists events newest first, with the aircraft fields known at that moment, using readsb's names:

```json
{
  "since": "2026-10-21T12:00:00Z", "until": "2026-10-22T12:00:00Z",
  "count": 1, "truncated": false,
  "events": [{
    "id": 1842, "kind": "emergency", "reason": "general", "hex": "4ca7b5",
    "time": "2026-10-22T09:41:07Z", "lat": 45.61, "lon": 10.33, "distance_km": 11.4,
    "flight": "ABC123", "r": "I-ABCD", "t": "A320", "alt_baro": 9800, "gs": 287.4,
    "squawk": "7700", "emergency": "general", "source": "adsb_icao",
    "map": "https://mappa.flyitalyadsb.com/?icao=4ca7b5"
  }]
}
```

In an AI assistant, the MCP tool `notable_traffic` asks the same thing ("anything unusual near Malpensa today?") and groups the events by aircraft.

## Webhooks (paid plans)

A webhook is a URL of yours that receives an HTTPS `POST` for every new event in an area. Webhooks belong to the account, not the key: regenerating the key keeps them.

```sh
curl -X POST https://api.flyitalyadsb.com/v2/webhooks \
  -H "X-Api-Key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/fia-hook", "lat": 45.54, "lon": 10.22, "dist": 80,
       "kinds": ["emergency", "military"], "description": "Brescia"}'
```

The answer carries `secret` (`whsec_…`): **it is shown only once**. Store it where your server reads it, and use it to check every delivery.

| Request | |
|---|---|
| `POST /v2/webhooks` | create: `url`, `lat`, `lon`, `dist` (km, within the plan's radius), `kinds` (default `emergency` and `military`), `description` |
| `GET /v2/webhooks` | the account's webhooks, with `status` (`active`, `disabled`, `paused-plan`) and the failures in a row, never the secret |
| `GET /v2/webhooks/{id}/deliveries` | the last 20 deliveries: status, attempts, HTTP code, error |
| `POST /v2/webhooks/{id}/test` | send a test delivery (`webhook.test`), signed like the others |
| `POST /v2/webhooks/{id}/enable` | enable it again after it was disabled |
| `POST /v2/webhooks/{id}/delete` | delete it |

Rules:

- **At most 5 webhooks per account.** Creating, testing and enabling need a paid plan; listing and deleting work on any plan. If the plan ends, the webhooks stay but receive nothing (`paused-plan`).
- **The URL:** `https://`, port 443 or 8443, a public domain name or address, no user and password. Names that point to private, local or reserved addresses are refused, when you create the webhook and on every delivery.
- **Each webhook receives the same aircraft, kind and reason at most once an hour**, even if it crosses several cells of your area.
- Management calls do not count as requests (at most 20 a minute per key).

## What we send

```http
POST /fia-hook HTTP/1.1
Content-Type: application/json
User-Agent: FlyItalyADSB-Webhooks/1 (+https://flyitalyadsb.com/en/data/api/docs/alerts/)
webhook-id: msg_5170
webhook-timestamp: 1761126067
webhook-signature: v1,cZLu+GFFOqfhSUJYVrKqWHSoDrfb/KFk0VCjFa0OYMM=

{"type":"event.military","timestamp":"2026-10-22T09:41:07Z","data":{"id":1843,"kind":"military","hex":"33ffd1","time":"2026-10-22T09:41:07Z","lat":45.42,"lon":10.12,"distance_km":15.2,"flight":"IAM4653","r":"MM62179","t":"C130","alt_baro":23925,"source":"mlat","map":"https://mappa.flyitalyadsb.com/?icao=33ffd1","webhook_id":7}}
```

`type` is `event.emergency`, `event.military`, `event.interesting` or `webhook.test`; `data` is the event as in `/v2/events`, with `distance_km` from the webhook's centre.

This example is signed with the sample secret `whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw` (not a real one): try your code on it, with the time check turned off.

Delivery:

- **Answer with a 2xx within 10 seconds.** Anything else is a failure, redirects included (they are not followed). Do the slow work after answering.
- Failures are retried 6 times, after about 30 s, 2 min, 10 min, 30 min, 1 h and 3 h. `webhook-id` stays the same on every retry: use it to ignore duplicates.
- At most 30 deliveries a minute per webhook; deliveries still waiting after 24 hours are dropped.
- After 15 failed attempts in a row, over at least an hour, the webhook is **disabled**: `GET /v2/webhooks` shows it, and `POST /v2/webhooks/{id}/enable` turns it back on.
- Alerts are best effort, with no guaranteed delivery time.

## Checking the signature

We sign with [Standard Webhooks](https://www.standardwebhooks.com/), so its libraries work too (`pip install standardwebhooks`, `npm install standardwebhooks`). By hand:

1. Take the **raw body**, as received, before parsing the JSON.
2. Compute HMAC-SHA256 of `{webhook-id}.{webhook-timestamp}.{body}` with the key: the part of the secret after `whsec_`, decoded from base64.
3. Compare its base64 with the value after `v1,` in `webhook-signature` (there can be several, separated by spaces), in constant time.
4. Refuse a `webhook-timestamp` more than 5 minutes from now.

Python:

```python
import base64, hashlib, hmac, time

def verify(secret: str, headers, body: bytes, tolerance: int = 300) -> bool:
    msg_id, ts = headers["webhook-id"], headers["webhook-timestamp"]
    if abs(time.time() - int(ts)) > tolerance:
        return False
    key = base64.b64decode(secret.removeprefix("whsec_"))
    expected = base64.b64encode(
        hmac.new(key, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()
    ).decode()
    return any(
        hmac.compare_digest(expected, sig.split(",", 1)[1])
        for sig in headers["webhook-signature"].split()
        if sig.startswith("v1,")
    )

# Flask: verify(SECRET, request.headers, request.get_data())
```

JavaScript (Node.js 18 or later):

```js
import crypto from 'node:crypto';

export function verify(secret, headers, rawBody, toleranceSeconds = 300) {
  const id = headers['webhook-id'];
  const ts = headers['webhook-timestamp'];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSeconds) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.`).update(rawBody).digest();
  return headers['webhook-signature'].split(' ').some((entry) => {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

// Express: app.post('/fia-hook', express.raw({ type: 'application/json' }),
//   (req, res) => verify(SECRET, req.headers, req.body) ? res.sendStatus(204) : res.sendStatus(401));
```
