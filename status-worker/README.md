# flyitalyadsb-status

The Cloudflare Worker behind the status page, [flyitalyadsb.com/stato/](https://flyitalyadsb.com/stato/) (IT) and
[/en/status/](https://flyitalyadsb.com/en/status/) (EN).

- **Every minute, on the Durable Object's alarm** (`src/tick.ts`, `src/store.ts`): probes the public URLs from
  Cloudflare's network, outside the cluster (`src/probes.ts`), classifies each component as up, degraded or down
  (`src/checks.ts`), and stores the result in that Durable Object, SQLite storage. A probe that comes back down is
  retried once after 3 s. Each pass sets the next alarm (2 s into the next minute) before it starts.
- **The cron** (`wrangler.jsonc`, every minute) is only a watchdog: it starts the alarm loop after a deploy and
  restarts it if an alarm is more than 3 minutes late. It used to run the passes. On 2026-10-23 Cloudflare skipped
  about one cron minute in six and delivered others 15–25 minutes late and out of order, and the page went
  `unknown` while everything was up.
- **`GET flyitalyadsb.com/status.json`**, the Worker's only route (Terraform, nesso-infra
  `terraform/cloudflare/workers-flyitalyadsb-status.tf`): current state, 90 days of per-day minutes, the outages the
  probes detected, and the network totals. Cached 30 s at the edge; CORS open (public data).
- The page (`src/components/StatusPage.astro`) draws the live parts from that JSON; published incidents and planned
  maintenance are Markdown in `src/content/status/{it,en}/`, also in the Atom feeds `/stato/feed.xml` and
  `/en/status/feed.xml`.

| Component | Probe | Degraded | Down |
|---|---|---|---|
| `site` | `GET /stato/feed.xml` (a file of the published Pages deployment) | ≥ 3 s | error, wrong body |
| `map` | `GET mappa.flyitalyadsb.com/` | ≥ 3 s | error |
| `live` | `api.…/api/network.json`: aircraft.json's own `now` | > 30 s old, < 1,000 aircraft | > 180 s old, no data |
| `api` | `GET /v2/lat/45.4642/lon/9.19/dist/250` with the monitor key | ≥ 3 s, 429 | error, no `ac` |
| `mcp` | `POST /mcp` `initialize` with the monitor key | ≥ 3 s | error |
| `history` | every 5 min, `GET /v2/history/aa3b92` | `archive_unavailable` (R2) | error |
| `feeders` | `network.json` `feeders_beast` vs its 7-day median | < 70 %, count unknown | < 30 %, 0 |
| `mlat` | `feeders_mlat` vs its median, shards readable | < 70 %, a shard missing | < 30 %, 0, no shard |

The monitor key is a keyed (`fiaent_`, 30/min) key of `ops-status@nessolabs.it`, id 203, created 2026-10-23 with
`manage_api_keys.py`. It's the Worker secret `MONITOR_API_KEY`, and its value is in Infisical project
`flyitalyadsb`, prod, `/status-monitor`. Its requests show up in the daily digest's usage like any key's.

Nothing in the Durable Object is ever deleted: about 11k sample rows a day.

## Alerts in #alerts

A component **down for 3 probes in a row** (3 minutes; 15 for history, which runs every 5) gets one message in
`#alerts`, and one more when it's back (`src/alerts.ts`). It's the second exception, after the API purchase alert, to
the rule "one flyitalyadsb message a day" (owner, 2026-10-23). Degraded performance and shorter blips go only in the
daily digest. The text is made of the probes' facts only, in nesso_notify's shape (`[PROD]` first, coloured
attachment, footer). It's sent from outside our cluster, so it still arrives when the cluster is down. An outage is
marked as announced only once Slack accepted the post, so a failed post is retried the next minute. The webhook is
the Worker secret `SLACK_WEBHOOK_URL`, the daily digest's (Infisical project `flyitalyadsb`, prod,
`/api-key-audit-env`). Without it, nothing is sent.

## Local

```sh
# status-worker/.dev.vars: MONITOR_API_KEY=<from Infisical>
npm run dev                                  # the site, :4321 (PUBLIC_STATUS_URL=http://127.0.0.1:8791/status.json)
npx wrangler dev -c status-worker/wrangler.jsonc --ip 127.0.0.1 --port 8791 --test-scheduled \
  --var ENVIRONMENT:development --var SITE_PROBE_URL:http://127.0.0.1:4321/stato/feed.xml
curl 'http://127.0.0.1:8791/cdn-cgi/handler/scheduled?cron=*+*+*+*+*'   # starts the alarm loop: a pass every minute
# &time=<ms> sets the event's scheduledTime (the passes ignore it, see src/tick.ts)
npm run status:test && npm run status:check
```
