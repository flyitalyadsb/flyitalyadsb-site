---
title: Limiti ed errori
description: "Limiti dell'API FlyItalyADSB per piano (richieste al minuto, al mese, raggio), come si contano, gli header X-FIA-* e cosa fare con 400, 401, 403, 404, 429 e i blocchi di Cloudflare."
key: limits
order: 5
updated: 2026-10-22
plans: true
---

## Come si contano

- **Ogni richiesta conta uno**, qualunque endpoint, anche quelle fatte dagli strumenti MCP.
- I limiti sono **per chiave**: valgono le richieste di tutti i tuoi server e dispositivi insieme, da qualsiasi IP.
- Il piano Free ha anche un limite di 100 richieste al minuto per IP.
- **Il contatore mensile riparte il primo del mese.**
- Una richiesta respinta per un limite non viene contata, e non si paga nulla oltre il piano.

Ogni risposta riporta il tuo stato negli header:

| Header | Valore |
|---|---|
| `X-FIA-Plan` | il piano della chiave (`free`, `starter`, `pro`, `business`, `feeder`) |
| `X-FIA-Limit-Per-Min` | richieste al minuto del piano |
| `X-FIA-Quota-Month` | richieste al mese del piano |
| `X-FIA-Used-Month` | quelle usate questo mese |

## Errori

Il corpo è sempre JSON con un campo `error`.

| Codice | Quando | Cosa fare |
|---|---|---|
| `400` | parametri non validi (`lat/lon/dist must be numeric`, `icao must be a 6-character hex address`, `date must be YYYY-MM-DD`) | correggi la richiesta |
| `401` | `missing or invalid X-Api-Key` | controlla header e chiave; una chiave rigenerata sostituisce la vecchia |
| `403` | raggio oltre il massimo del piano: c'è `max_radius_km` | riduci il raggio, dividi l'area in più richieste o passa a un piano superiore |
| `404` | `not found`: l'aereo non è visto in questo momento | riprova più tardi |
| `429` | troppe richieste al minuto (header `Retry-After`) o quota del mese finita (c'è `resets`) | aspetta `Retry-After` secondi; per la quota, il mese dopo o un piano superiore |
| `503` | servizio momentaneamente non disponibile | riprova con un'attesa crescente |

## Bloccato da Cloudflare

Se ricevi una pagina HTML invece del JSON ("Sorry, you have been blocked", "Attention Required", codice `1010` o `1020`), la richiesta è stata fermata prima dell'API.

1. Manda sempre l'header `X-Api-Key`: le richieste a `/v2/` senza chiave sono respinte a monte.
2. Usa un User-Agent tuo, per esempio il nome della tua app.
3. Se continua, scrivi a [admin@flyitalyadsb.com](mailto:admin@flyitalyadsb.com). Indica l'ID **CF-Ray** in fondo alla pagina di errore, data e ora (UTC) e l'endpoint: con quelli troviamo la regola che ti ha fermato.
