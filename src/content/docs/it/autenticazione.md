---
title: Autenticazione
description: "Chiave API in X-Api-Key, OAuth per gli assistenti AI e registrazione degli agenti con auth.md: come si ottiene e si gestisce un accesso all'API FlyItalyADSB."
key: authentication
order: 2
updated: 2026-10-22
---

Ci sono tre modi per accedere, e tutti valgono come lo stesso account: piano, limiti e consumo sono quelli della chiave della tua email.

| Metodo | Dove funziona | Per chi |
|---|---|---|
| Chiave in `X-Api-Key` | REST API e server MCP | il tuo codice, Claude Code, client senza OAuth |
| OAuth 2.1 | server MCP | assistenti con connettori OAuth, come claude.ai |
| Registrazione dell'agente ([auth.md](/auth.md)) | REST API e server MCP | un agente AI che conosce solo la tua email |

## Chiave API

Mandala in ogni richiesta, nell'header `X-Api-Key`:

```http
GET /v2/mil HTTP/1.1
Host: api.flyitalyadsb.com
X-Api-Key: LA_TUA_CHIAVE
```

**Per averla:**
- dal modulo di [API REST](/dati/api/#api-key);
- oppure da codice:

  ```sh
  curl -X POST https://api.flyitalyadsb.com/v2/keys \
    -H "Content-Type: application/json" \
    -d '{"email": "tu@esempio.it", "name": "La mia app", "lang": "it"}'
  ```

La risposta (`202`) non contiene mai la chiave: arriva via email un link che la mostra una volta sola ed è valido 7 giorni.

**Regole:**
- **Una chiave gratuita per casella.** Le varianti con `+tag` e, su Gmail, con i punti contano come la stessa casella.
- Le email temporanee non sono accettate.
- Se chiedi una chiave per un indirizzo che l'ha appena chiesta, la risposta è `429`: aspetta qualche minuto.

**Chiave persa:** rifai la stessa richiesta con la stessa email. La vecchia chiave funziona finché non apri il nuovo link.

**[La mia API](/dati/api/account/):** accedi con l'email e un codice. Lì vedi le chiavi, il piano e il consumo, rigeneri una chiave e scolleghi gli assistenti. Rigenerare una chiave la sostituisce subito, con lo stesso piano: quella vecchia smette di funzionare. Gli assistenti collegati restano collegati.

**Tienila al sicuro:** fuori dai repository pubblici e dai log. Una chiave dentro un'app o una pagina web si può estrarre: se ti preoccupa, usala solo dal tuo server.

## OAuth (server MCP)

Gli assistenti con connettori OAuth si collegano a `https://flyitalyadsb.com/mcp` con **Connetti**: scrivi la tua email, poi il codice di 6 cifre che ti arriva, e premi **Consenti**. Se non hai ancora una chiave, ne viene creata una gratuita. I passaggi per Claude sono in [Server MCP](/dati/api/docs/mcp/). I dettagli tecnici (discovery, PKCE, token) sono in [auth.md](/auth.md).

## Registrazione degli agenti (auth.md)

Un agente AI che conosce solo la tua email può chiedere l'accesso senza un redirect nel browser, secondo [auth.md](https://github.com/workos/auth.md):

1. l'agente si registra con la tua email;
2. ti dà un link e un codice di 6 cifre;
3. apri il link, entri con il codice che ti mandiamo per email e scrivi il codice dell'agente.

L'agente riceve un accesso che compare in La mia API come "AI agent (auth.md)" e che puoi scollegare quando vuoi. Il protocollo per chi sviluppa agenti è in [auth.md](/auth.md).
