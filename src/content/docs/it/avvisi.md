---
title: Avvisi e traffico notevole
description: "Il traffico notevole nell'API di FlyItalyADSB: squawk di emergenza, aerei militari e altri aerei notevoli per zona con /v2/events, e webhook firmati per gli avvisi push sui piani a pagamento, con la verifica della firma in Python e JavaScript."
key: alerts
order: 6.5
updated: 2026-10-22
---

La rete registra il **traffico notevole** come eventi. Si leggono per zona (`/v2/events`, con ogni piano) o si ricevono mentre succedono con un **webhook** (piani a pagamento).

| Tipo | Quando |
|---|---|
| `emergency` | squawk `7500` (dirottamento), `7600` (avaria radio), `7700` (emergenza generica), oppure lo stato di emergenza ADS-B (`minfuel`, `nordo`, `unlawful`, `downed`). Lo stato `lifeguard` dei voli sanitari non è un'emergenza. `reason` dice quale. |
| `military` | un aereo segnato come militare nel database degli aeromobili (`dbFlags` bit 0) |
| `interesting` | un aereo segnato come "interessante" nel database degli aeromobili (`dbFlags` bit 1), per esempio gli aerei di Stato |

Come nascono gli eventi:

- **Un evento per aereo e per cella di circa 0,5°** (circa 55 km da nord a sud). Un volo che attraversa la tua zona viene registrato dove entra in ogni cella. La posizione è un campione, non la traccia: per la traccia completa c'è lo [storico](/dati/api/docs/storico/).
- Un aereo nella stessa cella dà un nuovo evento solo dopo 30 minuti di assenza (emergenze) o 60 (gli altri).
- Una condizione deve comparire due volte di seguito, a pochi secondi di distanza: un singolo messaggio storpiato non diventa un evento.
- Uno squawk di emergenza è quello che ha trasmesso il transponder, non un'emergenza confermata: capita che un equipaggio lo imposti per sbaglio e lo corregga dopo pochi secondi. Le posizioni vengono da ADS-B o MLAT (`source`) e possono essere sbagliate o falsificate.
- Gli eventi riguardano gli aerei: non contengono mai i nomi di proprietari o operatori.

## Leggere gli eventi: `/v2/events`

```sh
curl -H "X-Api-Key: LA_TUA_CHIAVE" \
  "https://api.flyitalyadsb.com/v2/events?lat=45.54&lon=10.22&dist=100&since=2026-10-21T12:00:00Z&kinds=emergency,military"
```

| Parametro | |
|---|---|
| `lat`, `lon`, `dist` | la zona: un punto e un raggio in km, obbligatori. Vale il raggio massimo del piano, come per `/lat/…/lon/…/dist/…`. |
| `since`, `until` | secondi Unix o ISO 8601 (senza fuso orario vale UTC). Di default le ultime 24 ore. Al massimo 7 giorni indietro. |
| `kinds` | separati da virgola, di default tutti e tre |
| `limit` | fino a 500, di default 100. `truncated: true` vuol dire che ce n'erano di più. |

Ogni richiesta conta come una. La risposta elenca gli eventi dal più recente, con i campi dell'aereo noti in quel momento, con i nomi di readsb:

```json
{
  "since": "2026-10-21T12:00:00Z", "until": "2026-10-22T12:00:00Z",
  "count": 1, "truncated": false,
  "events": [{
    "id": 1842, "kind": "emergency", "reason": "general", "hex": "4ca7b5",
    "time": "2026-10-22T09:41:07Z", "lat": 45.61, "lon": 10.33, "distance_km": 11.4,
    "flight": "ABC123", "r": "I-ABCD", "t": "A320", "alt_baro": 9800, "gs": 287.4,
    "squawk": "7700", "emergency": "general", "source": "adsb_icao",
    "map": "https://mappa.flyitalyadsb.com/?icao=4ca7b5"
  }]
}
```

In un assistente AI, lo strumento MCP `notable_traffic` fa la stessa domanda ("qualcosa di insolito vicino a Malpensa oggi?") e raggruppa gli eventi per aereo.

## Webhook (piani a pagamento)

Un webhook è un tuo URL che riceve una `POST` HTTPS per ogni nuovo evento in una zona. I webhook sono dell'account, non della chiave: rigenerare la chiave non li perde.

```sh
curl -X POST https://api.flyitalyadsb.com/v2/webhooks \
  -H "X-Api-Key: LA_TUA_CHIAVE" -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/fia-hook", "lat": 45.54, "lon": 10.22, "dist": 80,
       "kinds": ["emergency", "military"], "description": "Brescia"}'
```

La risposta contiene `secret` (`whsec_…`): **si vede solo questa volta**. Salvalo dove lo legge il tuo server e usalo per verificare ogni consegna.

| Richiesta | |
|---|---|
| `POST /v2/webhooks` | crea: `url`, `lat`, `lon`, `dist` (km, entro il raggio del piano), `kinds` (di default `emergency` e `military`), `description` |
| `GET /v2/webhooks` | i webhook dell'account, con `status` (`active`, `disabled`, `paused-plan`) e i fallimenti di fila, mai il segreto |
| `GET /v2/webhooks/{id}/deliveries` | le ultime 20 consegne: stato, tentativi, codice HTTP, errore |
| `POST /v2/webhooks/{id}/test` | manda una consegna di prova (`webhook.test`), firmata come le altre |
| `POST /v2/webhooks/{id}/enable` | lo riattiva dopo che è stato disattivato |
| `POST /v2/webhooks/{id}/delete` | lo cancella |

Regole:

- **Al massimo 5 webhook per account.** Creare, provare e riattivare richiedono un piano a pagamento; elencare e cancellare funzionano con ogni piano. Se il piano finisce, i webhook restano ma non ricevono nulla (`paused-plan`).
- **L'URL:** `https://`, porta 443 o 8443, un nome di dominio o un indirizzo pubblico, senza utente e password. I nomi che puntano a indirizzi privati, locali o riservati vengono rifiutati, alla creazione e a ogni consegna.
- **Ogni webhook riceve lo stesso aereo, tipo e motivo al massimo una volta l'ora**, anche se attraversa più celle della tua zona.
- Le chiamate di gestione non contano come richieste (al massimo 20 al minuto per chiave).

## Cosa mandiamo

```http
POST /fia-hook HTTP/1.1
Content-Type: application/json
User-Agent: FlyItalyADSB-Webhooks/1 (+https://flyitalyadsb.com/en/data/api/docs/alerts/)
webhook-id: msg_5170
webhook-timestamp: 1761126067
webhook-signature: v1,cZLu+GFFOqfhSUJYVrKqWHSoDrfb/KFk0VCjFa0OYMM=

{"type":"event.military","timestamp":"2026-10-22T09:41:07Z","data":{"id":1843,"kind":"military","hex":"33ffd1","time":"2026-10-22T09:41:07Z","lat":45.42,"lon":10.12,"distance_km":15.2,"flight":"IAM4653","r":"MM62179","t":"C130","alt_baro":23925,"source":"mlat","map":"https://mappa.flyitalyadsb.com/?icao=33ffd1","webhook_id":7}}
```

`type` vale `event.emergency`, `event.military`, `event.interesting` o `webhook.test`; `data` è l'evento come in `/v2/events`, con `distance_km` dal centro del webhook.

L'esempio è firmato con il segreto di prova `whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw` (non è un segreto vero): prova il tuo codice su questo, con il controllo dell'ora spento.

La consegna:

- **Rispondi con un 2xx entro 10 secondi.** Tutto il resto è un fallimento, redirect compresi (non li seguiamo). Il lavoro lento fallo dopo aver risposto.
- I fallimenti si ritentano 6 volte, dopo circa 30 s, 2 min, 10 min, 30 min, 1 h e 3 h. `webhook-id` resta uguale a ogni tentativo: usalo per scartare i doppioni.
- Al massimo 30 consegne al minuto per webhook; quelle ancora in attesa dopo 24 ore si scartano.
- Dopo 15 tentativi falliti di fila, in almeno un'ora, il webhook viene **disattivato**: lo mostra `GET /v2/webhooks`, e `POST /v2/webhooks/{id}/enable` lo riaccende.
- Gli avvisi sono "best effort", senza un tempo di consegna garantito.

## Verificare la firma

Firmiamo con [Standard Webhooks](https://www.standardwebhooks.com/), quindi vanno bene anche le sue librerie (`pip install standardwebhooks`, `npm install standardwebhooks`). A mano:

1. Prendi il **corpo grezzo**, come è arrivato, prima di leggere il JSON.
2. Calcola l'HMAC-SHA256 di `{webhook-id}.{webhook-timestamp}.{corpo}` con la chiave: la parte del segreto dopo `whsec_`, decodificata da base64.
3. Confronta il suo base64 con il valore dopo `v1,` in `webhook-signature` (possono essercene più d'uno, separati da spazi), in tempo costante.
4. Rifiuta un `webhook-timestamp` lontano più di 5 minuti da adesso.

Python:

```python
import base64, hashlib, hmac, time

def verify(secret: str, headers, body: bytes, tolerance: int = 300) -> bool:
    msg_id, ts = headers["webhook-id"], headers["webhook-timestamp"]
    if abs(time.time() - int(ts)) > tolerance:
        return False
    key = base64.b64decode(secret.removeprefix("whsec_"))
    expected = base64.b64encode(
        hmac.new(key, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()
    ).decode()
    return any(
        hmac.compare_digest(expected, sig.split(",", 1)[1])
        for sig in headers["webhook-signature"].split()
        if sig.startswith("v1,")
    )

# Flask: verify(SECRET, request.headers, request.get_data())
```

JavaScript (Node.js 18 o successivo):

```js
import crypto from 'node:crypto';

export function verify(secret, headers, rawBody, toleranceSeconds = 300) {
  const id = headers['webhook-id'];
  const ts = headers['webhook-timestamp'];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSeconds) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.`).update(rawBody).digest();
  return headers['webhook-signature'].split(' ').some((entry) => {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

// Express: app.post('/fia-hook', express.raw({ type: 'application/json' }),
//   (req, res) => verify(SECRET, req.headers, req.body) ? res.sendStatus(204) : res.sendStatus(401));
```
