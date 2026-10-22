---
title: Storico
description: "Lo storico ADS-B di FlyItalyADSB via API: le date con traccia per un aereo, la traccia di un giorno, gli aerei passati sopra un luogo, i periodi coperti dal 2022 e cosa non è disponibile."
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

## Cosa è passato sopra un luogo

`/overflights` elenca gli aerei la cui traccia è passata entro `dist` km da un punto tra `from` e `to`:

```sh
curl -H "X-Api-Key: LA_TUA_CHIAVE" "https://api.flyitalyadsb.com/v2/overflights?lat=45.4642&lon=9.19&dist=3&from=2026-10-21T08:00:00Z&to=2026-10-21T10:00:00Z"
```

- **Una voce per aereo**, in ordine di `closest_time`. Ogni voce ha:
  - `icao`, `r`, `t`, `dbFlags` e i nominativi visti (`callsigns`);
  - `closest_time` e `closest_km`;
  - `min_alt_ft`: la quota minima nel cerchio, in piedi o `"ground"`;
  - `source`: `adsb`, `mlat`, `tisb` o `other`;
  - `positions`: le posizioni ricevute dentro il cerchio. `0` vuol dire che il passaggio è la retta tra due posizioni appena fuori.
- `from` e `to` accettano ISO 8601 (UTC se manca il fuso) o secondi Unix. `max_alt_ft` tiene solo la parte bassa di ogni traccia, `limit` limita l'elenco (predefinito 100, massimo 500).
- **Copertura:** ogni giorno dal 17/08/2026. Il giorno in corso arriva fino a circa 40 minuti fa. I periodi non cercati sono in `coverage.gaps`: lì "nessun aereo" non vuol dire che non è passato niente.
- **Limiti:** raggio e finestra dipendono dal piano: Free 10 km e 6 ore, Starter 25 km e 24 ore, gli altri piani 50 km e 24 ore. Oltre, la risposta è `403`. Ogni ricerca conta come una richiesta, e ogni chiave ne può fare al massimo 10 al minuto.
- **Risposte troncate:** se i passaggi sono più di quelli che stanno nella risposta, `truncated` vale `true`. `complete_until` dice fino a quando l'elenco è completo; per il resto, richiedi con `from` uguale a quell'istante.
- Riguarda gli aerei, non le persone: nessun campo dice chi c'era a bordo.

## Cosa non c'è

- **Nessuna ricerca per area su periodi lunghi:** `/overflights` copre al massimo 24 ore e 50 km per richiesta, e solo dal 17/08/2026. Per estrazioni più ampie o progetti di ricerca scrivi a [admin@flyitalyadsb.com](mailto:admin@flyitalyadsb.com).
- **Nessun dato grezzo:** i messaggi Mode-S/ADS-B così come arrivano dai ricevitori non sono distribuiti, solo i dati decodificati.
- I dati sono **CC BY-SA 4.0**: cita FlyItalyADSB, e i lavori derivati vanno sotto la stessa licenza.
