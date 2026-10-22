---
title: Storico
description: "Lo storico ADS-B di FlyItalyADSB via API: le date con traccia per un aereo e la traccia di un giorno, i periodi coperti dal 2022 e cosa non è disponibile."
key: history
order: 6
updated: 2026-10-22
---

Lo storico è **per aereo e per giorno**, con la stessa chiave e gli stessi limiti del resto dell'API:

```sh
# le date con una traccia
curl -H "X-Api-Key: LA_TUA_CHIAVE" https://api.flyitalyadsb.com/v2/history/4ca7b5
# la traccia di un giorno
curl -H "X-Api-Key: LA_TUA_CHIAVE" https://api.flyitalyadsb.com/v2/history/4ca7b5/2026-09-15
```

- `/history/{icao}` risponde `{"icao", "count", "dates": ["2026-08-17", …]}`.
- `/history/{icao}/{data}` restituisce la traccia di quel giorno nel formato `trace_full` di readsb: `icao`, `timestamp` e `trace`, un elenco di punti. Ogni punto ha i secondi dopo `timestamp`, latitudine, longitudine, quota (piedi o `"ground"`), velocità e rotta, più altri campi descritti nella [documentazione di readsb](https://github.com/wiedehopf/readsb/blob/dev/README-json.md).
- L'header `X-History-Source` vale `local` (giorni recenti) o `r2` (archivio). Il primo accesso a un giorno d'archivio può essere un po' più lento.

## Periodi coperti

| Periodo | Contenuto |
|---|---|
| 10/04/2022 – 04/10/2023 | solo il primo e l'ultimo punto di ogni volo |
| 25/07/2023 – 27/06/2024 | traccia completa, con lacune (206 giorni) |
| dal 17/08/2026 | traccia completa, ogni giorno |

**Dal 28/06/2024 al 16/08/2026 non c'è storico.** Il dettaglio dei giorni mancanti è nell'[archivio storico](/dati/archivio/).

## Cosa non c'è

- **Nessuna ricerca per area o aeroporto nel passato:** lo storico si chiede aereo per aereo. Per estrazioni più ampie o progetti di ricerca scrivi a [admin@flyitalyadsb.com](mailto:admin@flyitalyadsb.com).
- **Nessun dato grezzo:** i messaggi Mode-S/ADS-B così come arrivano dai ricevitori non sono distribuiti, solo i dati decodificati.
- I dati sono **CC BY-SA 4.0**: cita FlyItalyADSB, e i lavori derivati vanno sotto la stessa licenza.
