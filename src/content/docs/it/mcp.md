---
title: Server MCP
description: "Il server MCP di FlyItalyADSB su flyitalyadsb.com/mcp: i quattro strumenti, come collegarlo a Claude, Claude Code e altri client, come si contano le richieste."
key: mcp
order: 7
updated: 2026-10-22
---

Il [Model Context Protocol](https://modelcontextprotocol.io) è lo standard con cui assistenti come Claude o ChatGPT chiamano strumenti esterni. Il nostro server risponde su `https://flyitalyadsb.com/mcp` (Streamable HTTP) con quattro strumenti in sola lettura:

| Strumento | Cosa fa |
|---|---|
| `find_aircraft` | un aereo per hex ICAO, nominativo o immatricolazione |
| `aircraft_near` | tutti gli aerei in un raggio da un punto, o da un aeroporto italiano per nome |
| `special_traffic` | traffico militare, PIA o LADD |
| `aircraft_history` | le date con storico di un aereo, o la sua traccia in un giorno |

## Collegarlo a Claude

1. Su [claude.ai](https://claude.ai/customize/connectors) apri **Connettori** e scegli **Aggiungi connettore personalizzato**.
2. Nome `FlyItalyADSB`, URL `https://flyitalyadsb.com/mcp`.
3. Premi **Connetti**: scrivi la tua email, il codice di 6 cifre che ti arriva, e premi **Consenti**. Se non hai una chiave, ne viene creata una gratuita.
4. Chiedi per esempio: *"che aerei ci sono ora vicino a Fiumicino?"*

Lo scolleghi da [La mia API](/dati/api/account/).

## Claude Code e client senza OAuth

Con la tua chiave nell'header:

```sh
claude mcp add --transport http flyitalyadsb https://flyitalyadsb.com/mcp \
  --header "X-Api-Key: LA_TUA_CHIAVE"
```

Gli altri client MCP con OAuth si collegano con Connetti, come Claude. Gli agenti che conoscono solo la tua email possono usare la [registrazione auth.md](/dati/api/docs/autenticazione/#registrazione-degli-agenti-authmd).

## Limiti

Ogni chiamata a uno strumento è una richiesta all'API e conta sul piano della tua chiave, come una chiamata diretta. Anche il raggio massimo è quello del piano.
