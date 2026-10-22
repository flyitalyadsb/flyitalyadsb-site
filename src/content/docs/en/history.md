---
title: History
description: "FlyItalyADSB ADS-B history through the API: the dates with a track for one aircraft and one day's track, coverage since 2022, and what is not available."
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

## Not available

- **No past search by area or airport:** history is asked aircraft by aircraft. For larger extracts or research projects, write to [admin@flyitalyadsb.com](mailto:admin@flyitalyadsb.com).
- **No raw data:** the Mode-S/ADS-B messages as they come from the receivers are not distributed, only decoded data.
- The data is **CC BY-SA 4.0**: credit FlyItalyADSB, and derived works go under the same licence.
