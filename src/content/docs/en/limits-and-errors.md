---
title: Limits and errors
description: "FlyItalyADSB API limits per plan (requests per minute, per month, radius), how they are counted, the X-FIA-* headers, and what to do about 400, 401, 403, 404, 429 and Cloudflare blocks."
key: limits
order: 5
updated: 2026-10-22
plans: true
---

## How requests count

- **Every request counts as one**, whatever the endpoint, including those made by MCP tools.
- Limits are **per key**: requests from all your servers and devices count together, from any IP.
- The Free plan also has a limit of 100 requests per minute per IP.
- **The monthly counter resets on the 1st.**
- A request refused for a limit is not counted, and nothing is billed beyond the plan.

Every answer reports your state in its headers:

| Header | Value |
|---|---|
| `X-FIA-Plan` | the key's plan (`free`, `starter`, `pro`, `business`, `feeder`) |
| `X-FIA-Limit-Per-Min` | the plan's requests per minute |
| `X-FIA-Quota-Month` | the plan's requests per month |
| `X-FIA-Used-Month` | the ones used this month |

## Errors

The body is always JSON with an `error` field. On 401, 403 and 429 there is also `help`, the link to the answer in the [FAQ](/en/faq/).

| Code | When | What to do |
|---|---|---|
| `400` | invalid parameters (`lat/lon/dist must be numeric`, `icao must be a 6-character hex address`, `date must be YYYY-MM-DD`) | fix the request |
| `401` | `missing or invalid X-Api-Key` | check the header and the key; a regenerated key replaces the old one |
| `403` | radius above the plan's maximum, with `max_radius_km` | shrink the radius, split the area into several requests, or upgrade |
| `404` | `not found`: the aircraft isn't seen right now | try again later |
| `429` | too many requests per minute (header `Retry-After`) or the month's quota is used up (with `resets`) | wait `Retry-After` seconds; for the quota, next month or a bigger plan |
| `503` | service temporarily unavailable | retry with a growing delay |

## Blocked by Cloudflare

If you get an HTML page instead of JSON ("Sorry, you have been blocked", "Attention Required", code `1010` or `1020`), the request was stopped before the API.

1. Always send `X-Api-Key`: requests to `/v2/` without a key are refused upstream.
2. Use a User-Agent of your own, e.g. your app's name.
3. If it goes on, write to [admin@flyitalyadsb.com](mailto:admin@flyitalyadsb.com) with:
   - the **CF-Ray** ID at the bottom of the error page;
   - the date and time (UTC);
   - the endpoint.

   With those we can find the rule that stopped you.
