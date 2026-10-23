---
title: Some visitors blocked by mistake by the firewall
key: 2026-10-20-firewall-blocks
kind: incident
impact: minor
components: [site, map]
start: 2026-10-20T19:22:00Z
end: 2026-10-23T09:21:00Z
updates:
  - at: 2026-10-23T08:55:00Z
    state: investigating
    text: >-
      A visitor writes that the site blocks them with "Sorry, you have been blocked" after clicking English, and that no page opens for them since.
  - at: 2026-10-23T09:05:00Z
    state: identified
    text: >-
      We find the cause in the firewall events and reproduce it. It isn't just them: about 50 visitors a day since 20 October.
  - at: 2026-10-23T09:21:00Z
    state: resolved
    text: >-
      Fix applied and checked against every referrer that used to be blocked. Visitors who were blocked can open the site and the map again, with nothing to do on their side.
---

From the evening of 20 October, visitors arriving from a **Bing** search, a **Facebook** link or **Naver** could open the first page, but from the next one on they were blocked on the whole site and the map. The block stayed in the following days too.

The cause was a generic anti-attack firewall rule (OWASP) that read the statistics cookie set on arrival as suspicious: that cookie holds the address of the page the visitor came from, and some query strings pushed it over the rule's threshold. About 50 visitors a day were affected between 20 and 23 October. **The REST API, the MCP server and the data were not affected.**

That rule no longer applies to the pages of the site and the map, which are static; it stays on the API and on everything that receives data. We also added a daily check that tells us when the firewall blocks many more real visitors than usual, so a mistake like this one shows up for us the next day instead of in a report.

If you still see the block page, clear the site data for flyitalyadsb.com or try a private window, and [write to us](/en/contact/).
