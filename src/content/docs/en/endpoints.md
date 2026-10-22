---
title: Endpoints
description: "Every endpoint of the FlyItalyADSB REST API v2: one aircraft by ICAO hex, callsign or registration, aircraft within a radius, military, PIA, LADD and history."
key: endpoints
order: 3
updated: 2026-10-22
---

**Base URL:** `https://api.flyitalyadsb.com/v2`. Every endpoint is a `GET`, answers in JSON and needs the `X-Api-Key` header. The full machine-readable spec is [openapi.json](/openapi.json).

| Endpoint | Returns |
|---|---|
| `/icao/{hex}` | one aircraft by 24-bit ICAO address |
| `/callsign/{callsign}` | one aircraft by callsign (flight number) |
| `/reg/{reg}` | one aircraft by registration |
| `/lat/{lat}/lon/{lon}/dist/{km}` | every aircraft within `km` kilometres of a point |
| `/mil` | the military traffic seen now |
| `/pia` | aircraft with a privacy ICAO address (PIA) |
| `/ladd` | aircraft in the FAA LADD programme |
| `/history/{icao}` | the dates with a track for one aircraft |
| `/history/{icao}/{date}` | one aircraft's track on one day |

## One aircraft

`/icao/{hex}`, `/callsign/{callsign}` and `/reg/{reg}` return the aircraft's record if it is seen right now, otherwise `404` with `{"error": "not found"}`. The hex is 6 characters, either case; callsign and registration ignore case and spaces. There is no single request for several aircraft: one request per aircraft, or one per radius.

```sh
curl -H "X-Api-Key: YOUR_KEY" https://api.flyitalyadsb.com/v2/reg/I-ABCD
```

## Aircraft within a radius

`/lat/{lat}/lon/{lon}/dist/{km}`:
- coordinates in decimal degrees;
- the radius in **kilometres**, not the nautical miles some other ADS-B APIs use;
- it works anywhere on Earth, across the 180° meridian too.

The maximum radius depends on the plan (see [Limits and errors](/en/data/api/docs/limits-and-errors/)). Above it, the answer is `403` with `max_radius_km`. Pro and Business have no maximum and can ask for the whole world in one request: `/lat/0/lon/0/dist/20040`.

The answer is `{"now", "count", "ac": [...]}`, with the same fields for every aircraft.

## Military, PIA, LADD

`/mil`, `/pia` and `/ladd` return the network-wide list, in the same format as a radius. They are the aircraft with the matching `dbFlags` bits (see [Fields and units](/en/data/api/docs/fields/)). The data is unfiltered: PIA and LADD aircraft are flagged, not hidden.

## History

`/history/{icao}` lists the dates available for one aircraft, and `/history/{icao}/{YYYY-MM-DD}` returns that day's track. Coverage and format are in [History](/en/data/api/docs/history/).

## Errors

Errors are JSON with a plain-English `error` field. Codes and fixes are in [Limits and errors](/en/data/api/docs/limits-and-errors/).
