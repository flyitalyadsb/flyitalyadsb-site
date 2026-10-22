---
title: Uso commerciale
description: "Usare l'API FlyItalyADSB in app e dispositivi che vendi: una chiave per prodotto, cache sul tuo server, come dimensionare il piano, attribuzione CC BY-SA 4.0 e quando serve un accordo enterprise."
key: commercial
order: 8
updated: 2026-10-22
---

L'uso commerciale è consentito con **ogni piano, Free compreso**, entro i limiti del piano. Vale anche dentro app e dispositivi che vendi, senza un accordo separato: valgono le [condizioni](/termini/).

## App e dispositivi

- **Una chiave per prodotto**, non una per dispositivo o per cliente. Le richieste di tutti i dispositivi contano insieme su quella chiave, da qualsiasi IP.
- **Un tuo server con una cache** che serve solo i tuoi dispositivi va bene: non è redistribuzione, e abbassa il numero di richieste.
- Una chiave dentro un'app o un firmware si può estrarre. Se ti preoccupa, falla usare solo dal tuo server.

## Dimensionare il piano

Moltiplica le richieste di un dispositivo per il numero di dispositivi. Per esempio, 10 dispositivi che chiedono 12 volte al minuto, giorno e notte, fanno 120 richieste al minuto e oltre 5 milioni al mese: il piano Pro. Un dispositivo solo, a 12 richieste al minuto, supera già le 300.000 al mese del piano Free.

- Chiedere ogni 15 secondi invece che ogni 5 divide il consumo per tre.
- Con una cache sul tuo server, molti dispositivi nella stessa zona costano come uno.

I piani sono in [API REST](/dati/api/#piani). La chiave che hai già passa al nuovo piano senza cambiarla.

## Attribuzione e licenza

I dati sono [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.it). Cita FlyItalyADSB con un link a flyitalyadsb.com dove l'utente lo vede: nell'app, sul dispositivo o nel manuale, sulla pagina del prodotto. Per esempio:

> Dati di volo: FlyItalyADSB (flyitalyadsb.com), CC BY-SA 4.0

I lavori derivati dai dati che pubblichi vanno sotto la stessa licenza.

## Quando serve un accordo

Un accordo enterprise serve solo per:
- rivendere i dati come API o feed per prodotti di altri;
- avere uno SLA;
- volumi oltre il piano Business.

Scrivi a [admin@flyitalyadsb.com](mailto:admin@flyitalyadsb.com).

## Il vantaggio feeder

Chi alimenta la rete con un ricevitore ha sulle sue chiavi Free i limiti del piano Pro gratis, ma **solo per uso non commerciale**: non copre prodotti che vendi. Vedi [Diventa feeder](/community/feeder/).
