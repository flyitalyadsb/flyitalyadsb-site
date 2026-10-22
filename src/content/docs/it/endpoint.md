---
title: Endpoint
description: "Tutti gli endpoint della REST API v2 di FlyItalyADSB: un aereo per hex ICAO, nominativo o immatricolazione, gli aerei in un raggio, militari, PIA, LADD, storico e il profilo di un aereo."
key: endpoints
order: 3
updated: 2026-10-22
---

**Base URL:** `https://api.flyitalyadsb.com/v2`. Tutti gli endpoint sono `GET`, rispondono in JSON e chiedono l'header `X-Api-Key`. La specifica completa, leggibile da programmi, è in [openapi.json](/openapi.json).

| Endpoint | Restituisce |
|---|---|
| `/icao/{hex}` | un aereo per indirizzo ICAO a 24 bit |
| `/callsign/{callsign}` | un aereo per nominativo (numero di volo) |
| `/reg/{reg}` | un aereo per immatricolazione |
| `/lat/{lat}/lon/{lon}/dist/{km}` | tutti gli aerei entro `km` chilometri da un punto |
| `/mil` | il traffico militare visto ora |
| `/pia` | gli aerei con indirizzo ICAO privato (PIA) |
| `/ladd` | gli aerei del programma FAA LADD |
| `/history/{icao}` | le date con una traccia per un aereo |
| `/history/{icao}/{data}` | la traccia di un aereo in un giorno |
| `/profile/{icao}` | quello che sappiamo di un aereo: identità, stato live, riepilogo dello storico |

## Un aereo

`/icao/{hex}`, `/callsign/{callsign}` e `/reg/{reg}` restituiscono il record dell'aereo, se è visto in questo momento, altrimenti `404` con `{"error": "not found"}`:
- l'hex è di 6 caratteri, maiuscole o minuscole;
- nominativo e immatricolazione non distinguono maiuscole e minuscole, e gli spazi non contano.

Non c'è una richiesta unica per più aerei: una richiesta per aereo, oppure una per raggio.

```sh
curl -H "X-Api-Key: LA_TUA_CHIAVE" https://api.flyitalyadsb.com/v2/reg/I-ABCD
```

## Gli aerei in un raggio

`/lat/{lat}/lon/{lon}/dist/{km}`, con coordinate in gradi decimali e raggio in **chilometri**, non miglia nautiche come in altre API ADS-B. Funziona ovunque nel mondo, anche a cavallo del meridiano 180°.

- Il raggio massimo dipende dal piano (vedi [Limiti ed errori](/dati/api/docs/limiti-ed-errori/)). Oltre, la risposta è `403` con `max_radius_km`.
- Pro e Business non hanno un massimo e possono chiedere tutto il mondo in una richiesta: `/lat/0/lon/0/dist/20040`.

La risposta è `{"now", "count", "ac": [...]}`, gli stessi campi per ogni aereo.

## Militari, PIA, LADD

`/mil`, `/pia` e `/ladd` restituiscono l'elenco di tutta la rete, nello stesso formato del raggio. Sono gli aerei con i bit corrispondenti di `dbFlags` (vedi [Campi e unità](/dati/api/docs/campi/)). I dati non sono filtrati: gli aerei PIA e LADD sono segnalati, non nascosti.

## Storico

`/history/{icao}` elenca le date disponibili per un aereo, `/history/{icao}/{YYYY-MM-DD}` restituisce la traccia di quel giorno. Periodi coperti e formato sono in [Storico](/dati/api/docs/storico/).

## Profilo di un aereo

`/profile/{icao}` mette insieme, in una richiesta, quello che gli altri endpoint dicono di un aereo:
- `identity`: immatricolazione, tipo ICAO (`icao_type`), `type_description`, `year` se il database degli aerei lo ha, e i bit di `dbFlags` già decodificati (`military`, `interesting`, `pia`, `ladd`);
- `live`: `seen_now`, e se lo riceviamo adesso nominativo, posizione, quota, velocità e `source`, la fonte della posizione (`adsb_icao`, `mlat`, `tisb_icao`…), con `seen_pos` in secondi;
- `history`: `first_day` e `last_day` con una traccia, `days_last_30` (oggi e i 29 giorni prima, UTC) e `total_days`, dalle stesse date di `/history/{icao}`;
- `links`: `map`, la mappa pubblica su questo aereo (live, o la sua ultima traccia che la mappa può mostrare), e `history`;
- `photos`: `page`, un link alle foto dell'aereo su Planespotters.net.

Risponde `404` se l'aereo non è ricevuto adesso e non ha storico.

```sh
curl -H "X-Api-Key: LA_TUA_CHIAVE" https://api.flyitalyadsb.com/v2/profile/3c66a3
```

Il profilo riguarda l'aereo: non restituisce mai i nomi di proprietari o operatori. Non contiene foto, perché le condizioni di Planespotters.net non permettono di servire le loro foto attraverso un'altra API: `photos.page` è un link alla loro pagina pubblica, dove ogni foto riporta il nome del fotografo, e il pannello dell'aereo sulla mappa ne mostra una allo stesso modo. Per gli aerei PIA e LADD `photos.page` è `null` e `withheld` dice perché. I loro dati restano nel profilo, segnalati, come in tutta l'API.

## Errori

Gli errori sono JSON con un campo `error` in chiaro. Codici e rimedi sono in [Limiti ed errori](/dati/api/docs/limiti-ed-errori/).
