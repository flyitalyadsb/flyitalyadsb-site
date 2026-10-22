---
title: Campi e unità
description: "I campi di un aereo nell'API FlyItalyADSB (formato aircraft.json di readsb) con le unità: quota in piedi o \"ground\", velocità in nodi, dbFlags, seen_pos, sorgente della posizione."
key: fields
order: 4
updated: 2026-10-22
---

Ogni aereo è un record nel formato `aircraft.json` di [readsb](https://github.com/wiedehopf/readsb/blob/dev/README-json.md), lo stesso di tar1090 e adsb.lol. I campi mancano quando l'aereo non li trasmette. Ecco i principali:

| Campo | Significato | Unità |
|---|---|---|
| `hex` | indirizzo ICAO a 24 bit. Con `~` davanti, un indirizzo non ICAO (per esempio TIS-B) | esadecimale |
| `flight` | nominativo, riempito di spazi fino a 8 caratteri: usa `trim()` | |
| `r` | immatricolazione, dal database aeromobili | |
| `t` | tipo ICAO (es. `A320`), dal database aeromobili | |
| `dbFlags` | bit: 1 militare, 2 interessante, 4 PIA, 8 LADD | maschera |
| `lat`, `lon` | posizione | gradi decimali |
| `alt_baro` | quota barometrica, oppure la stringa `"ground"` se l'aereo è a terra | piedi |
| `alt_geom` | quota geometrica (GNSS) | piedi |
| `gs` | velocità al suolo | nodi |
| `track` | rotta vera | gradi |
| `baro_rate` | velocità verticale | piedi/minuto |
| `squawk` | codice transponder, 4 cifre | |
| `category` | categoria del trasmettitore (es. `A3`) | |
| `type` | sorgente della posizione: `adsb_icao`, `mlat`, `tisb_icao`, `adsr_icao`… | |
| `seen` | secondi dall'ultimo messaggio | secondi |
| `seen_pos` | secondi dall'ultima posizione | secondi |
| `mlat` | i campi ricavati dalla multilaterazione | elenco |

Per gli altri campi (`ias`, `mach`, `nav_altitude_mcp`, `rssi`…) vale la [documentazione di readsb](https://github.com/wiedehopf/readsb/blob/dev/README-json.md).

## Da sapere

- **`alt_baro` può essere una stringa.** Controlla il tipo prima di fare conti: `"ground"` significa a terra.
- **Unità aeronautiche:** piedi, nodi e piedi al minuto. Il raggio delle richieste invece è in chilometri.
- **Freschezza:** le posizioni più vecchie di circa 60 secondi non vengono restituite. `seen_pos` dice quanto è recente quella che vedi.
- **Tempi:** `now` è in secondi Unix (UTC). `seen` e `seen_pos` sono relativi a `now`.
- **Immatricolazione e tipo** ci sono per circa il 99% degli aerei. Mancano per indirizzi nuovi o non nel database.
- **Non ci sono:** la tratta (aeroporti di partenza e arrivo), la compagnia che opera il volo e le foto.
- **`type: mlat`:** la posizione è calcolata dalla nostra multilaterazione, non trasmessa dall'aereo. Vedi [Come funziona MLAT](/community/mlat/).
