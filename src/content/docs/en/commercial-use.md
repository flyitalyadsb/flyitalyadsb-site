---
title: Commercial use
description: "Using the FlyItalyADSB API in apps and devices you sell: one key per product, caching on your server, sizing the plan, CC BY-SA 4.0 attribution and when an enterprise agreement is needed."
key: commercial
order: 8
updated: 2026-10-22
---

Commercial use is allowed on **every plan, Free included**, within the plan's limits. That covers apps and devices you sell too, with no separate agreement: the [terms](/en/terms/) apply.

## Apps and devices

- **One key per product**, not one per device or per customer. Requests from all devices count together on that key, from any IP.
- **A server of your own with a cache** that serves only your devices is fine: it isn't redistribution, and it lowers your request count.
- A key inside an app or firmware can be extracted. If that worries you, use it only from your server.

## Sizing the plan

Multiply one device's requests by the number of devices. For example, 10 devices asking 12 times a minute, day and night, make 120 requests a minute and over 5 million a month: the Pro plan. A single device at 12 requests a minute already goes past the Free plan's 300,000 a month.

- Asking every 15 seconds instead of every 5 cuts usage by three.
- With a cache on your server, many devices in the same area cost as much as one.

The plans are on [REST API](/en/data/api/#piani). The key you already have moves to the new plan without changing.

## Attribution and licence

The data is [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Credit FlyItalyADSB with a link to flyitalyadsb.com where users see it: in the app, on the device or in the manual, on the product page. For example:

> Flight data: FlyItalyADSB (flyitalyadsb.com), CC BY-SA 4.0

Works derived from the data that you publish go under the same licence.

## When you need an agreement

An enterprise agreement is only needed for:
- reselling the data as an API or feed for other people's products;
- an SLA;
- volumes above the Business plan.

Write to [admin@flyitalyadsb.com](mailto:admin@flyitalyadsb.com).

## The feeder perk

If you feed the network with a receiver, your Free keys get the Pro plan's limits for free, but **for non-commercial use only**: it doesn't cover products you sell. See [Become a feeder](/en/community/feeder/).
