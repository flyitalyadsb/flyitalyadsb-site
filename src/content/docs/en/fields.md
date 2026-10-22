---
title: Fields and units
description: "The fields of an aircraft in the FlyItalyADSB API (readsb aircraft.json format) and their units: altitude in feet or \"ground\", speed in knots, dbFlags, seen_pos, position source."
key: fields
order: 4
updated: 2026-10-22
---

Each aircraft is a record in readsb's `aircraft.json` format ([readsb docs](https://github.com/wiedehopf/readsb/blob/dev/README-json.md)), the same as tar1090 and adsb.lol. Fields are missing when the aircraft doesn't transmit them. The main ones:

| Field | Meaning | Unit |
|---|---|---|
| `hex` | 24-bit ICAO address; a leading `~` marks a non-ICAO address (e.g. TIS-B) | hexadecimal |
| `flight` | callsign, padded with spaces to 8 characters: `trim()` it | |
| `r` | registration, from the aircraft database | |
| `t` | ICAO type code (e.g. `A320`), from the aircraft database | |
| `dbFlags` | bit values: 1 military, 2 interesting, 4 PIA, 8 LADD | bitmask |
| `lat`, `lon` | position | decimal degrees |
| `alt_baro` | barometric altitude, or the string `"ground"` when on the ground | feet |
| `alt_geom` | geometric (GNSS) altitude | feet |
| `gs` | ground speed | knots |
| `track` | true track | degrees |
| `baro_rate` | vertical rate | feet/minute |
| `squawk` | transponder code, 4 digits | |
| `category` | emitter category (e.g. `A3`) | |
| `type` | position source: `adsb_icao`, `mlat`, `tisb_icao`, `adsr_icao`… | |
| `seen` | seconds since the last message | seconds |
| `seen_pos` | seconds since the last position | seconds |
| `mlat` | the fields derived from multilateration | list |

For the other fields (`ias`, `mach`, `nav_altitude_mcp`, `rssi`…), see [readsb's documentation](https://github.com/wiedehopf/readsb/blob/dev/README-json.md).

## Good to know

- **`alt_baro` can be a string.** Check its type before doing maths: `"ground"` means on the ground.
- **Aviation units:** feet, knots and feet per minute. The request radius, on the other hand, is in kilometres.
- **Freshness:** positions older than about 60 seconds are not returned. `seen_pos` tells you how recent the one you see is.
- **Times:** `now` is in Unix seconds (UTC); `seen` and `seen_pos` are relative to it.
- **Registration and type** are there for about 99% of aircraft. They are missing for new addresses or ones not in the database.
- **Not included:** the route (departure and arrival airports), the operating airline and photos.
- **`type: mlat`:** the position comes from our multilateration, not from the aircraft. See [How MLAT works](/en/community/mlat/).
