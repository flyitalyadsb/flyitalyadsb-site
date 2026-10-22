---
title: History
description: "FlyItalyADSB ADS-B history through the API: the dates with a track for one aircraft, one day's track, the aircraft that flew over a place, coverage since 2022, and what is not available."
key: history
order: 6
updated: 2026-10-22
---

History is **per aircraft and per day**, with the same key and limits as the rest of the API:

```sh
# the dates with a track
curl -H "X-Api-Key: YOUR_KEY" https://api.flyitalyadsb.com/v2/history/4ca7b5
# one day's track
curl -H "X-Api-Key: YOUR_KEY" https://api.flyitalyadsb.com/v2/history/4ca7b5/2026-09-15
```

- `/history/{icao}` answers `{"icao", "count", "dates": ["2026-08-17", …]}`.
- `/history/{icao}/{date}` returns that day's track in readsb's `trace_full` format: `icao`, `timestamp` and `trace`, a list of points. Each point has the seconds after `timestamp`, latitude, longitude, altitude (feet or `"ground"`), speed and track, plus further fields described in [readsb's documentation](https://github.com/wiedehopf/readsb/blob/dev/README-json.md).
- The `X-History-Source` header is `local` (recent days) or `r2` (archive). The first request for an archived day can take a little longer.

## Coverage

| Period | Content |
|---|---|
| 10/04/2022 – 04/10/2023 | only the first and last point of each flight |
| 25/07/2023 – 27/06/2024 | full tracks, with gaps (206 days) |
| since 17/08/2026 | full tracks, every day |

**There is no history from 28/06/2024 to 16/08/2026.** The missing days are listed in the [historical archive](/en/data/archive/).

## What flew over a place

`/overflights` lists the aircraft whose track passed within `dist` km of a point between `from` and `to`:

```sh
curl -H "X-Api-Key: YOUR_KEY" "https://api.flyitalyadsb.com/v2/overflights?lat=45.4642&lon=9.19&dist=3&from=2026-10-21T08:00:00Z&to=2026-10-21T10:00:00Z"
```

- **One entry per aircraft**, sorted by `closest_time`. Each entry has:
  - `icao`, `r`, `t`, `dbFlags` and the `callsigns` seen;
  - `closest_time` and `closest_km`;
  - `min_alt_ft`: the lowest altitude in the circle, in feet or `"ground"`;
  - `source`: `adsb`, `mlat`, `tisb` or `other`;
  - `positions`: the positions received inside the circle. `0` means the pass is a straight line between two positions just outside it.
- `from` and `to` take ISO 8601 (UTC when there is no offset) or Unix seconds. `max_alt_ft` keeps only the low part of each track, `limit` caps the list (default 100, max 500).
- **Coverage:** every day since 17/08/2026. The current day isn't searchable yet: it is added after midnight UTC, by about 02:00 UTC. For what is flying now, use `/v2/lat/…`. The periods that were not searched are in `coverage.gaps`: there, "no aircraft" doesn't mean nothing flew over.
- **Limits:** radius and window depend on the plan: Free 10 km and 6 hours, Starter 25 km and 24 hours, the other plans 50 km and 24 hours. Above them the answer is `403`. Every search counts as one request, with at most 10 searches a minute per key.
- **Truncated answers:** when there are more passes than fit, `truncated` is `true`. `complete_until` says up to when the list is complete; ask again with `from` set to it for the rest.
- It is about aircraft, not people: no field says who was on board.

## Not available

- **No search by area over long periods:** `/overflights` covers at most 24 hours and 50 km per request, and only since 17/08/2026. For larger extracts or research projects, write to [admin@flyitalyadsb.com](mailto:admin@flyitalyadsb.com).
- **No raw data:** the Mode-S/ADS-B messages as they come from the receivers are not distributed, only decoded data.
- The data is **CC BY-SA 4.0**: credit FlyItalyADSB, and derived works go under the same licence.
