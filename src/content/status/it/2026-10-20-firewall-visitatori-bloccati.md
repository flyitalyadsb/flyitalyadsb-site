---
title: Alcuni visitatori bloccati per errore dal firewall
key: 2026-10-20-firewall-blocks
kind: incident
impact: minor
components: [site, map]
start: 2026-10-20T19:22:00Z
end: 2026-10-23T09:21:00Z
updates:
  - at: 2026-10-23T08:55:00Z
    state: investigating
    text: >-
      Un visitatore ci scrive che il sito lo blocca con la pagina «Sorry, you have been blocked» dopo aver cliccato su English, e che da quel momento non riesce più ad aprire nessuna pagina.
  - at: 2026-10-23T09:05:00Z
    state: identified
    text: >-
      Troviamo la causa negli eventi del firewall e la riproduciamo. Il blocco non riguarda solo lui, ma circa 50 visitatori al giorno dal 20 ottobre.
  - at: 2026-10-23T09:21:00Z
    state: resolved
    text: >-
      Correzione applicata e verificata con tutti i referrer che prima venivano bloccati. Chi vedeva il blocco può di nuovo aprire sito e mappa, senza fare nulla.
---

Dalla sera del 20 ottobre, chi arrivava sul sito da una ricerca su **Bing**, da un link di **Facebook** o da **Naver** riusciva ad aprire la prima pagina, ma dalla successiva veniva bloccato su tutto il sito e sulla mappa. Il blocco restava anche nei giorni seguenti.

La causa era una regola generica anti-attacco del firewall (OWASP), che leggeva come sospetto il cookie di statistica salvato all'arrivo: quel cookie contiene l'indirizzo della pagina di provenienza, e certe query string superavano la soglia della regola. Ne sono stati colpiti circa 50 visitatori al giorno, fra il 20 e il 23 ottobre. **API REST, server MCP e dati non sono stati toccati.**

Sulle pagine del sito e della mappa, che sono statiche, ora quella regola non si applica; resta attiva sulle API e su tutto ciò che riceve dati. Abbiamo anche aggiunto un controllo giornaliero che ci avvisa quando il firewall blocca molti più visitatori veri del solito, così un errore del genere lo vediamo noi il giorno dopo, invece di scoprirlo da una segnalazione.

Se vedi ancora la pagina di blocco, cancella i dati del sito per flyitalyadsb.com o prova da una finestra anonima, e [scrivici](/contatti/).
