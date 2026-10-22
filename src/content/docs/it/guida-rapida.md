---
title: Guida rapida
description: "Dalla chiave gratuita alla prima risposta dell'API FlyItalyADSB in due minuti, con curl, Python e JavaScript."
key: quickstart
order: 1
updated: 2026-10-22
---

## 1. Chiedi la chiave

Scrivi la tua email nel modulo di [API e agenti AI](/dati/api/#api-key). Ti arriva un link che mostra la chiave una volta sola ed è valido 7 giorni. La chiave è gratuita, senza approvazione, anche per uso commerciale entro i limiti del piano.

Puoi chiederla anche da codice: vedi [Autenticazione](/dati/api/docs/autenticazione/).

## 2. La prima richiesta

Tutti gli aerei entro 50 km da Roma Fiumicino:

```sh
curl -H "X-Api-Key: LA_TUA_CHIAVE" \
  https://api.flyitalyadsb.com/v2/lat/41.80/lon/12.25/dist/50
```

La risposta è JSON: `now` (secondi Unix), `count` e `ac`, l'elenco degli aerei. Ogni aereo è un record nel formato di readsb (i campi sono in [Campi e unità](/dati/api/docs/campi/)). Esempio abbreviato, con valori indicativi:

```json
{
  "now": 1761134400.1,
  "count": 37,
  "ac": [
    { "hex": "4ca7b5", "flight": "RYR42KD ", "r": "EI-ABC", "t": "B738",
      "lat": 41.83, "lon": 12.31, "alt_baro": 7225, "gs": 251.4, "track": 293.1,
      "squawk": "4361", "seen_pos": 0.6 }
  ]
}
```

### Python

```python
import requests

r = requests.get(
    "https://api.flyitalyadsb.com/v2/lat/41.80/lon/12.25/dist/50",
    headers={"X-Api-Key": "LA_TUA_CHIAVE"},
    timeout=10,
)
r.raise_for_status()
for a in r.json()["ac"]:
    print(a.get("flight", "").strip(), a.get("r"), a.get("alt_baro"))
```

### JavaScript

```js
const res = await fetch("https://api.flyitalyadsb.com/v2/lat/41.80/lon/12.25/dist/50", {
  headers: { "X-Api-Key": "LA_TUA_CHIAVE" },
});
const { ac } = await res.json();
```

L'API risponde anche da browser (CORS aperto), ma una chiave dentro una pagina web è pubblica: usala dal tuo server.

## 3. E poi

- [Endpoint](/dati/api/docs/endpoint/): un aereo per hex, nominativo o immatricolazione, traffico militare, storico.
- [Limiti ed errori](/dati/api/docs/limiti-ed-errori/): cosa succede quando superi il piano.
- [Server MCP](/dati/api/docs/mcp/): gli stessi dati in Claude, ChatGPT e altri assistenti AI.
- [Uso commerciale](/dati/api/docs/uso-commerciale/): app e dispositivi che vendi, attribuzione.
