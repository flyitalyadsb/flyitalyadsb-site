---
title: Novità
description: "Le novità dell'API e del server MCP di FlyItalyADSB, in ordine di data."
key: changelog
order: 9
updated: 2026-10-22
---

| Data | Novità |
|---|---|
| 27/10/2026 | In arrivo: entrano in vigore i limiti del piano Free per chiave (fino ad allora valeva solo il limite per IP). |
| 22/10/2026 | Una mappa in chat: su Claude e ChatGPT gli strumenti MCP che restituiscono aerei li mostrano anche su una mappa interattiva. |
| 22/10/2026 | Traffico notevole: `/v2/events` (emergenze 7500/7600/7700, militari e altri aerei notevoli per zona, fino a 7 giorni) e lo strumento MCP `notable_traffic`. Con i piani a pagamento, avvisi via webhook firmati ([Avvisi](/dati/api/docs/avvisi/)). |
| 22/10/2026 | Sorvoli: `/v2/overflights` e lo strumento MCP `overflights`, gli aerei passati sopra un luogo tra due istanti (dal 17/08/2026). |
| 22/10/2026 | Profilo di un aereo: `/v2/profile/{icao}` e lo strumento MCP `aircraft_profile`. Lo storico non contiene più i nomi di proprietari e operatori. |
| 22/10/2026 | «Vicino a me» sul server MCP: la posizione salvata sull'account (`set_my_location`, La mia API), o la città di ChatGPT. Registrazione degli agenti con [auth.md](/auth.md). Documentazione e [domande frequenti](/faq/). |
| 21/10/2026 | OAuth sul server MCP: Claude e gli altri assistenti si collegano con Connetti, senza copiare chiavi. |
| 20/10/2026 | Vantaggio feeder: i limiti del piano Pro gratis sulle chiavi Free di chi alimenta la rete, per uso non commerciale. |
| 19/10/2026 | Piani a pagamento self-service: Starter, Pro, Business. |
| 18/10/2026 | Lo storico copre anche il 2022–2024. |
| 02/09/2026 | Storico self-service: `/v2/history/{icao}` e `/v2/history/{icao}/{data}`. |
| 31/08/2026 | REST API v2 e server MCP. |
