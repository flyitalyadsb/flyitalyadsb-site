import { FREE_LIMITS_FROM, freeLimitsFrom, PLANS } from './plans';

// The site's FAQ, in both languages: the /faq/ page shows all of it, the API
// page the entries marked `api`, and both publish them as FAQPage JSON-LD.
// Answers are short, and point to the docs page with the details. They come
// from what people actually write to admin@ (2026: commercial devices, Free
// limits, research data, Cloudflare blocks, feeders): keep them in step with
// the docs and with plans.ts, from which the numbers below are taken.

export type FaqCat = 'chiave' | 'piani' | 'commerciale' | 'limiti' | 'dati' | 'storico' | 'mcp' | 'feeder' | 'mappa';

export interface Faq {
  id: string;
  cat: FaqCat;
  api?: boolean;
  it: { q: string; a: string };
  en: { q: string; a: string };
}

export const FAQ_CATEGORIES: { id: FaqCat; it: string; en: string }[] = [
  { id: 'chiave', it: 'Chiave e account', en: 'Key and account' },
  { id: 'piani', it: 'Piani e pagamenti', en: 'Plans and payment' },
  { id: 'commerciale', it: 'Uso commerciale', en: 'Commercial use' },
  { id: 'limiti', it: 'Limiti ed errori', en: 'Limits and errors' },
  { id: 'dati', it: 'Dati e copertura', en: 'Data and coverage' },
  { id: 'storico', it: 'Storico', en: 'History' },
  { id: 'mcp', it: 'MCP e agenti AI', en: 'MCP and AI agents' },
  { id: 'feeder', it: 'Ricevitori (feeder)', en: 'Receivers (feeders)' },
  { id: 'mappa', it: 'Mappa', en: 'Map' },
];

const plan = (id: string) => PLANS.find((p) => p.id === id)!;
const free = plan('free');
const starter = plan('starter');
const n = (v: number, lang: 'it' | 'en') => v.toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB');

export const FAQS: Faq[] = [
  // --- from the API page (same text as before) ---
  {
    id: 'serve-chiave', cat: 'chiave', api: true,
    it: { q: "Serve una API key?",
      a: "Sì, sia per la REST API (api.flyitalyadsb.com/v2/*) sia per il server MCP (flyitalyadsb.com/mcp): stessa chiave per entrambi, passata nell'header X-Api-Key. È self-service e istantanea: basta un indirizzo email: in pochi secondi ti arriva un link per vedere la chiave, senza approvazione manuale. La chiave è gratuita; i piani a pagamento ne alzano i limiti senza cambiarla." },
    en: { q: "Do I need an API key?",
      a: "Yes, for both the REST API (api.flyitalyadsb.com/v2/*) and the MCP server (flyitalyadsb.com/mcp) — same key for both, passed in the X-Api-Key header. It's self-service and instant: just an email address: within seconds you get a link to see the key, no manual approval. The key is free; paid plans raise its limits without changing it." },
  },
  {
    id: 'uso-commerciale', cat: 'commerciale', api: true,
    it: { q: "Posso usare l'API per scopi commerciali?",
      a: "Sì, con ogni piano, free compreso, entro i limiti del piano. Oltre i limiti del free serve un piano a pagamento (Starter da 9 €/mese, Pro, Business): self-service, disdici quando vuoi, la chiave che hai già viene promossa sul posto. Puoi usarla anche dentro app e dispositivi che vendi (vedi sotto). Serve un accordo enterprise solo per rivendere i dati come API o feed per prodotti di altri, per uno SLA o per volumi oltre il Business." },
    en: { q: "Can I use the API commercially?",
      a: "Yes, on every plan, free included, within that plan's limits. Above the free limits you need a paid plan (Starter from €9/month, Pro, Business): self-serve, cancel any time, the key you already have is upgraded in place. You can use it inside apps and devices you sell too (see below). An enterprise agreement is needed only to resell the data as an API or feed for other people's products, for an SLA or for volume beyond Business." },
  },
  {
    id: 'chiave-in-app', cat: 'commerciale', api: true,
    it: { q: "Posso mettere la chiave in un'app o in un dispositivo che vendo? E usarla dal mio server?",
      a: "Sì. La chiave può stare dentro un'app o un dispositivo che distribuisci o vendi, e il tuo server può usarla, anche con una cache, per servire gli utenti del tuo prodotto. Le richieste di tutti i dispositivi e gli utenti contano insieme sul piano di quella chiave: per esempio 10 dispositivi che chiedono 12 volte al minuto, giorno e notte, fanno 120 richieste al minuto e oltre 5 milioni al mese, cioè il piano Pro. Usa una chiave per prodotto e cita nel prodotto FlyItalyADSB e flyitalyadsb.com (CC BY-SA 4.0). Una chiave dentro un'app si può estrarre: se vuoi tenerla al sicuro, falla usare solo dal tuo server. Serve un accordo enterprise solo per rivendere i dati come API o feed per prodotti di altri." },
    en: { q: "Can I put the key in an app or a device I sell? And use it from my server?",
      a: "Yes. The key can be built into an app or device you distribute or sell, and your server can use it, caching included, to serve your product's users. Requests from all the devices and users count together towards that key's plan: for example 10 devices asking 12 times a minute, day and night, make 120 requests a minute and over 5 million a month, which is the Pro plan. Use one key per product and credit FlyItalyADSB and flyitalyadsb.com in the product (CC BY-SA 4.0). A key inside an app can be extracted: to keep it safe, use it only from your server. An enterprise agreement is needed only to resell the data as an API or feed for other people's products." },
  },
  {
    id: 'vantaggio-feeder', cat: 'feeder', api: true,
    it: { q: "Ho un ricevitore che alimenta la rete: ho dei vantaggi?",
      a: "Sì: chi alimenta FlyItalyADSB ha sulle sue chiavi Free i limiti del piano Pro senza costi (300 richieste al minuto, 10 milioni al mese, raggio mondiale), per uso non commerciale. Si attiva da La mia API aprendo la pagina dalla stessa rete del ricevitore: verifichiamo che da lì arrivino dati, come nella pagina «I miei dati arrivano?». Vale finché il ricevitore alimenta la rete, con 3 giorni di tolleranza se si ferma." },
    en: { q: "I run a receiver that feeds the network: do I get anything?",
      a: "Yes: whoever feeds FlyItalyADSB gets the Pro plan limits on their Free keys at no cost (300 requests a minute, 10 million a month, worldwide radius), for non-commercial use. Turn it on in My API by opening the page from the same network as the receiver: we check that data arrives from there, as on the \"Is my data arriving?\" page. It lasts as long as the receiver feeds the network, with 3 days of grace if it stops." },
  },
  {
    id: 'pagamento-disdetta', cat: 'piani', api: true,
    it: { q: "Come funzionano pagamento e disdetta?",
      a: "Abbonamento mensile con carta o wallet, prezzi IVA esclusa: l'imposta del tuo paese si aggiunge al checkout. Puoi cambiare piano o disdire quando vuoi dai link nella ricevuta; la disdetta vale a fine periodo e la chiave torna al piano Free. I dati restano CC BY-SA 4.0: il piano paga accesso e limiti più alti, non una licenza diversa." },
    en: { q: "How do payment and cancellation work?",
      a: "A monthly subscription paid by card or wallet, prices before tax: your country's tax is added at checkout. Change plan or cancel any time from the links in your receipt; a cancellation takes effect at the end of the period and the key goes back to the Free plan. The data stays CC BY-SA 4.0: a plan pays for access and higher limits, not for a different licence." },
  },
  {
    id: 'sla', cat: 'piani', api: true,
    it: { q: "C'è uno SLA? In quanto tempo rispondete?",
      a: "Nessun piano include uno SLA o tempi di risposta garantiti, né dell'API né alle email: FlyItalyADSB è una community e i piani a pagamento coprono solo i costi di server e banda. Il servizio è best effort e rispondiamo appena possibile. Un SLA si concorda solo con un accordo enterprise." },
    en: { q: "Is there an SLA? How fast do you reply?",
      a: "No plan includes an SLA or guaranteed response times, for the API or for email: FlyItalyADSB is a community and the paid plans only cover the cost of servers and bandwidth. The service is best effort and we reply as soon as we can. An SLA can only be agreed in an enterprise agreement." },
  },
  {
    id: 'provenienza-dati', cat: 'dati', api: true,
    it: { q: "Da dove vengono i dati?",
      a: "Quasi tutto dai ricevitori della rete FlyItalyADSB, che ci mandano i dati direttamente, e dalla nostra multilaterazione (MLAT). Una piccola parte arriva da fonti esterne: ADSBHub e, per alianti e ultraleggeri, l'Open Glider Network (OGN). Gli aerei visti solo da queste fonti sono circa l'1% del totale (misura del 19 ottobre 2026): se una si ferma, il resto non cambia." },
    en: { q: "Where does the data come from?",
      a: "Almost all of it from the receivers of the FlyItalyADSB network, which send us their data first-hand, and from our own multilateration (MLAT). A small part comes from outside sources: ADSBHub and, for gliders and ultralights, the Open Glider Network (OGN). Aircraft seen only by those sources are about 1% of the total (measured on 19 October 2026): if one of them stops, the rest is unaffected." },
  },
  {
    id: 'freschezza', cat: 'dati', api: true,
    it: { q: "Quanto sono aggiornate le posizioni?",
      a: "Il server riscrive il quadro di tutti gli aerei ogni 2 secondi e l'API lo rilegge al massimo ogni 3. Ogni aereo ha il campo seen_pos, i secondi passati dall'ultima posizione ricevuta: in una misura del 19 ottobre 2026 metà delle posizioni aveva meno di un secondo e 9 su 10 meno di 7 secondi. Le posizioni più vecchie di circa 60 secondi non vengono restituite." },
    en: { q: "How fresh are the positions?",
      a: "The server rewrites the picture of every aircraft every 2 seconds and the API reloads it at most every 3. Each aircraft carries seen_pos, the seconds since its last position: in a measurement on 19 October 2026 half of the positions were under a second old and 9 in 10 under 7 seconds. Positions older than about 60 seconds are not returned." },
  },
  {
    id: 'campi-tratta', cat: 'dati', api: true,
    it: { q: "Quali campi ci sono in una risposta? C'è la tratta del volo?",
      a: "Ogni aereo è un record nel formato aircraft.json di readsb, lo stesso di tar1090 e adsb.lol: hex ICAO, nominativo (flight), immatricolazione (r) e tipo (t) per circa il 99% degli aerei, posizione, quota, velocità, direzione (track), squawk, categoria e i flag militare, PIA e LADD. Non c'è la tratta (aeroporti di partenza e di arrivo) e non ci sono foto: per quelle serve un'altra fonte." },
    en: { q: "Which fields does a response have? Is the flight route included?",
      a: "Each aircraft is a record in readsb's aircraft.json format, the same as tar1090 and adsb.lol: ICAO hex, callsign (flight), registration (r) and type (t) for about 99% of aircraft, position, altitude, speed, track, squawk, category and the military, PIA and LADD flags. There is no route (departure and arrival airports) and no photos: for those you need another source." },
  },
  {
    id: 'tutta-una-zona', cat: 'dati', api: true,
    it: { q: "Posso avere tutti gli aerei di una zona in una sola richiesta?",
      a: "Sì: /v2/lat/<lat>/lon/<lon>/dist/<km> restituisce tutti gli aerei entro il raggio. Il raggio massimo dipende dal piano: 500 km con Free, 1000 km con Starter, nessun limite con Pro e Business, che possono chiedere il mondo intero in una richiesta. Non c'è invece una richiesta unica per più aerei per hex o immatricolazione: una richiesta per aereo, oppure una per raggio." },
    en: { q: "Can I get every aircraft in an area in a single request?",
      a: "Yes: /v2/lat/<lat>/lon/<lon>/dist/<km> returns every aircraft within the radius. The maximum radius depends on the plan: 500 km on Free, 1000 km on Starter, no limit on Pro and Business, which can ask for the whole world in one request. There is no single request for several aircraft by hex or registration: one request per aircraft, or one per radius." },
  },
  {
    id: 'mcp-claude-chatgpt', cat: 'mcp',
    it: { q: "Come uso il server MCP con Claude o ChatGPT?",
      a: "Aggiungi https://flyitalyadsb.com/mcp come connettore personalizzato (su claude.ai: Connettori → Aggiungi connettore personalizzato; su ChatGPT: un'app creata in modalità sviluppatore) e premi Connetti: accedi con la tua email e un codice di 6 cifre, senza copiare chiavi. Nei client senza OAuth passa la tua chiave nell'header X-Api-Key. Poi puoi chiedere in chat cose come \"che aerei ci sono ora su Fiumicino?\" o \"c'è traffico militare sopra Roma?\" e l'agente chiamerà i tool automaticamente. I passi uno per uno sono nella pagina MCP." },
    en: { q: "How do I use the MCP server with Claude or ChatGPT?",
      a: "Add https://flyitalyadsb.com/mcp as a custom connector (on claude.ai: Connectors → Add custom connector; on ChatGPT: an app created in Developer mode) and press Connect: you sign in with your email and a 6-digit code, no key to copy. In clients without OAuth, pass your key in the X-Api-Key header. Then just ask things like \"what's flying over Fiumicino right now?\" or \"any military traffic over Rome?\" and the agent will call the tools automatically. The step-by-step guide is on the MCP page." },
  },
  {
    id: 'mcp-vs-mappa', cat: 'mcp',
    it: { q: "Cosa può fare il server MCP che la mappa non fa?",
      a: "Risponde in chat con dati strutturati: un aereo per hex ICAO, nominativo o immatricolazione, tutti gli aerei in un raggio da un punto qualsiasi, il traffico militare, PIA o LADD, il profilo di un aereo, cosa è passato sopra un luogo in una finestra di tempo, le emergenze recenti in una zona e lo storico di un aereo. Su Claude e ChatGPT mostra anche gli aerei su una mappa dentro la conversazione." },
    en: { q: "What can the MCP server do that the map can't?",
      a: "It answers in the chat with structured data: one aircraft by ICAO hex, callsign or registration, every aircraft within a radius of any point, military, PIA or LADD traffic, one aircraft's profile, what flew over a place in a time window, recent emergencies in an area and one aircraft's history. On Claude and ChatGPT it also shows the aircraft on a map inside the conversation." },
  },
  {
    id: 'solo-italia', cat: 'dati', api: true,
    it: { q: "La rete copre solo l'Italia?",
      a: "No. FlyItalyADSB è nata in Italia ma è una rete globale con oltre 3.200 feeder diretti nel mondo: sia la REST API sia l'MCP accettano coordinate ovunque sul pianeta, non solo in Italia. La copertura segue i ricevitori: è fitta in Italia, in buona parte d'Europa e in Nord America, più rada in Asia, Africa e Oceania. Per una zona precisa guarda la mappa live o prova una richiesta con la chiave Free." },
    en: { q: "Is the network limited to Italy?",
      a: "No. FlyItalyADSB was born in Italy but is a global network with 3,200+ direct feeders worldwide — both the REST API and the MCP tools accept coordinates anywhere on the planet, not just Italy. Coverage follows the receivers: dense in Italy, much of Europe and North America, thinner in Asia, Africa and Oceania. For a given area, check the live map or try a request with a Free key." },
  },
  {
    id: 'confronto', cat: 'dati', api: true,
    it: { q: "Come si confronta con altre API ADS-B aperte (adsb.fi, airplanes.live, adsb.lol...)?",
      a: "Vedi il confronto fattuale su flyitalyadsb.com/dati/confronto: rate limit, requisito feeder e uso commerciale di ciascuna, messi a confronto senza giudizi di merito." },
    en: { q: "How does this compare to other open ADS-B APIs (adsb.fi, airplanes.live, adsb.lol...)?",
      a: "See the factual comparison at flyitalyadsb.com/en/data/comparison: rate limits, feeder requirements, and commercial-use terms for each, compared without value judgments." },
  },
  // --- Chiave e account ---
  {
    id: 'email-chiave', cat: 'chiave',
    it: { q: 'Non mi arriva l’email con la chiave. Cosa faccio?',
      a: 'Controlla lo spam: il mittente è no-reply@email.nessolabs.it. Il link vale 7 giorni e mostra la chiave una volta sola. Se hai appena chiesto una chiave per la stessa email, aspetta qualche minuto prima di riprovare. Le email temporanee non sono accettate.' },
    en: { q: 'The email with my key doesn’t arrive. What should I do?',
      a: 'Check your spam folder: the sender is no-reply@email.nessolabs.it. The link is valid for 7 days and shows the key once. If you just asked for a key for the same email, wait a few minutes before trying again. Temporary email addresses are not accepted.' },
  },
  {
    id: 'chiave-persa', cat: 'chiave',
    it: { q: 'Ho perso la chiave.',
      a: 'Chiedila di nuovo con la stessa email: la vecchia funziona finché non apri il nuovo link. Oppure entra in La mia API e rigenerala: la nuova sostituisce subito la vecchia, con lo stesso piano.' },
    en: { q: 'I lost my key.',
      a: 'Ask for it again with the same email: the old one keeps working until you open the new link. Or sign in to My API and regenerate it: the new key replaces the old one at once, with the same plan.' },
  },
  {
    id: 'chiave-a-mano', cat: 'chiave',
    it: { q: 'Potete mandarmi una chiave via email o attivarla a mano?',
      a: 'Non serve: la chiave è self-service, senza approvazione. Basta l’email nel modulo della pagina API. Per sicurezza le chiavi non viaggiano più nelle email: le vedi e le rigeneri in La mia API.' },
    en: { q: 'Can you email me a key or activate one manually?',
      a: 'No need: the key is self-serve, with no approval. Just enter your email in the form on the API page. For security, keys no longer travel in emails: you see and regenerate them in My API.' },
  },
  {
    id: 'piu-chiavi', cat: 'chiave',
    it: { q: 'Posso avere più chiavi gratuite?',
      a: 'Una chiave gratuita per casella email: le varianti con +tag e, su Gmail, con i punti contano come la stessa casella. Per un prodotto basta una chiave; se ti servono più richieste, un piano a pagamento alza i limiti della stessa chiave.' },
    en: { q: 'Can I have several free keys?',
      a: 'One free key per mailbox: +tag variants and, on Gmail, dotted variants count as the same mailbox. One key is enough for a product; if you need more requests, a paid plan raises the limits of that same key.' },
  },
  // --- Piani e pagamenti ---
  {
    id: 'costi', cat: 'piani',
    it: { q: 'Quanto costa?',
      a: `Il piano Free è gratuito, anche per uso commerciale, entro ${free.perMin} richieste al minuto, ${n(free.perMonth, 'it')} al mese e ${free.maxRadiusKm} km di raggio. ${PLANS.filter((p) => p.priceEur > 0).map((p) => `${p.id.charAt(0).toUpperCase() + p.id.slice(1)} ${p.priceEur} €/mese`).join(', ')}, IVA esclusa. I limiti di ogni piano sono nella tabella dei piani.` },
    en: { q: 'How much does it cost?',
      a: `The Free plan is free, commercial use included, within ${free.perMin} requests per minute, ${n(free.perMonth, 'en')} per month and a ${free.maxRadiusKm} km radius. ${PLANS.filter((p) => p.priceEur > 0).map((p) => `${p.id.charAt(0).toUpperCase() + p.id.slice(1)} €${p.priceEur}/month`).join(', ')}, before tax. Each plan’s limits are in the plans table.` },
  },
  ...(FREE_LIMITS_FROM ? [{
    id: 'limiti-free', cat: 'piani' as const,
    it: { q: `Cosa cambia dal ${freeLimitsFrom('it')}?`,
      a: `Dal ${freeLimitsFrom('it')} il piano Free ha limiti per chiave: ${free.perMin} richieste al minuto, ${n(free.perMonth, 'it')} al mese e raggio fino a ${free.maxRadiusKm} km. Fino ad allora vale solo il limite di 100 richieste al minuto per IP. Le richieste di tutti i tuoi dispositivi contano insieme sulla stessa chiave.` },
    en: { q: `What changes on ${freeLimitsFrom('en')}?`,
      a: `From ${freeLimitsFrom('en')} the Free plan has per-key limits: ${free.perMin} requests per minute, ${n(free.perMonth, 'en')} per month and a radius up to ${free.maxRadiusKm} km. Until then only the limit of 100 requests per minute per IP applies. Requests from all your devices count together on the same key.` },
  }] : []),
  {
    id: 'oltre-i-limiti', cat: 'piani',
    it: { q: 'Se supero i limiti pago di più?',
      a: 'No. Le richieste oltre i limiti ricevono un errore (429, o 403 per un raggio troppo grande), non vengono contate e non si pagano: non c’è nulla oltre il prezzo del piano.' },
    en: { q: 'Do I pay more if I go over the limits?',
      a: 'No. Requests over the limits get an error (429, or 403 for too large a radius), are not counted and are not billed: there is nothing beyond the plan’s price.' },
  },
  {
    id: 'cambio-piano', cat: 'piani',
    it: { q: 'Se passo a un piano a pagamento devo cambiare chiave?',
      a: 'No: la chiave che hai già passa al nuovo piano, senza cambiarla nel tuo codice. Lo stesso alla disdetta, quando torna al piano Free.' },
    en: { q: 'If I move to a paid plan, do I have to change my key?',
      a: 'No: the key you already have moves to the new plan, with no change in your code. The same on cancellation, when it goes back to Free.' },
  },
  {
    id: 'webhook', cat: 'piani',
    it: { q: 'Come funzionano gli avvisi via webhook?',
      a: 'Con un piano a pagamento registri fino a 5 URL HTTPS, ognuno con una zona e i tipi di evento. Per ogni nuovo evento mandiamo una POST JSON firmata (Standard Webhooks, HMAC-SHA256): verifica la firma con il segreto che vedi una sola volta, alla creazione. Se l’URL non risponde con un 2xx ritentiamo per circa 5 ore; dopo 15 fallimenti di fila il webhook si disattiva e lo riattivi dall’API.' },
    en: { q: 'How do webhook alerts work?',
      a: 'On a paid plan you register up to 5 HTTPS URLs, each with an area and the event kinds. For every new event we send a signed JSON POST (Standard Webhooks, HMAC-SHA256): check it with the secret you see once, when you create it. If the URL doesn’t answer with a 2xx we retry for about 5 hours; after 15 failures in a row the webhook is disabled and you enable it again from the API.' },
  },
  // --- Uso commerciale ---
  {
    id: 'attribuzione', cat: 'commerciale',
    it: { q: 'Come devo citare FlyItalyADSB?',
      a: 'Con un link a flyitalyadsb.com dove chi usa il tuo prodotto lo vede (nell’app, sul dispositivo o nel manuale, sulla pagina del prodotto), per esempio: «Dati di volo: FlyItalyADSB (flyitalyadsb.com), CC BY-SA 4.0». I lavori derivati dai dati che pubblichi vanno sotto la stessa licenza.' },
    en: { q: 'How should I credit FlyItalyADSB?',
      a: 'With a link to flyitalyadsb.com where your product’s users see it (in the app, on the device or in the manual, on the product page), for example: “Flight data: FlyItalyADSB (flyitalyadsb.com), CC BY-SA 4.0”. Works derived from the data that you publish go under the same licence.' },
  },
  {
    id: 'cache', cat: 'commerciale',
    it: { q: 'Posso tenere una cache o salvare i dati?',
      a: 'Sì. Un tuo server con una cache che serve solo i tuoi utenti o dispositivi va bene, non è redistribuzione, e abbassa le richieste. Puoi anche conservare quello che hai ricavato dai dati. Non puoi rivendere i dati come API o feed per prodotti di altri senza un accordo.' },
    en: { q: 'Can I cache or store the data?',
      a: 'Yes. A server of your own with a cache serving only your users or devices is fine: it isn’t redistribution, and it lowers your requests. You can also keep what you derived from the data. Reselling the data as an API or feed for other people’s products needs an agreement.' },
  },
  {
    id: 'quale-piano', cat: 'commerciale',
    it: { q: 'Quale piano mi serve per i miei dispositivi?',
      a: 'Moltiplica le richieste al minuto di un dispositivo per i dispositivi: tutti contano sulla stessa chiave. Un dispositivo che chiede ogni 5 secondi fa circa 520.000 richieste al mese, già oltre il Free. Chiedere ogni 15 secondi divide il consumo per tre, e una cache sul tuo server lo abbassa ancora.' },
    en: { q: 'Which plan do I need for my devices?',
      a: 'Multiply one device’s requests per minute by the number of devices: they all count on the same key. One device asking every 5 seconds makes about 520,000 requests a month, already beyond Free. Asking every 15 seconds cuts usage by three, and a cache on your server lowers it further.' },
  },
  {
    id: 'enterprise', cat: 'commerciale',
    it: { q: 'Quando serve un accordo enterprise?',
      a: 'Solo per rivendere i dati come API o feed per prodotti di altri, per avere uno SLA o per volumi oltre il piano Business. Tutto il resto, anche app e dispositivi che vendi, va con i piani self-service. Per un accordo scrivi a admin@flyitalyadsb.com.' },
    en: { q: 'When do I need an enterprise agreement?',
      a: 'Only to resell the data as an API or feed for other people’s products, to get an SLA, or for volumes above the Business plan. Everything else, including apps and devices you sell, works with the self-serve plans. For an agreement, write to admin@flyitalyadsb.com.' },
  },
  // --- Limiti ed errori ---
  {
    id: 'cosa-conta', cat: 'limiti',
    it: { q: 'Cosa conta come richiesta?',
      a: 'Ogni chiamata a un endpoint conta uno, anche quelle degli strumenti MCP; non contano quelle respinte per un limite. I limiti sono per chiave, da qualsiasi IP. Il contatore mensile riparte il primo del mese, e gli header X-FIA-Used-Month e X-FIA-Quota-Month ti dicono a che punto sei.' },
    en: { q: 'What counts as a request?',
      a: 'Every call to an endpoint counts as one, MCP tool calls included; calls refused for a limit don’t count. Limits are per key, from any IP. The monthly counter resets on the 1st, and the X-FIA-Used-Month and X-FIA-Quota-Month headers tell you where you stand.' },
  },
  {
    id: 'errore-429', cat: 'limiti',
    it: { q: 'Ricevo 429. Perché?',
      a: 'Hai superato le richieste al minuto: aspetta i secondi dell’header Retry-After. Se il messaggio parla di quota mensile, il contatore riparte il primo del mese (campo resets), oppure serve un piano superiore. Sul piano Free c’è anche un limite di 100 richieste al minuto per IP.' },
    en: { q: 'I get 429. Why?',
      a: 'You went over the requests per minute: wait for the seconds in the Retry-After header. If the message is about the monthly quota, the counter resets on the 1st (field resets), or you need a bigger plan. The Free plan also has a limit of 100 requests per minute per IP.' },
  },
  {
    id: 'errore-403-raggio', cat: 'limiti',
    it: { q: 'Ricevo 403 con max_radius_km.',
      a: `Il raggio supera il massimo del tuo piano: ${free.maxRadiusKm} km con Free, ${starter.maxRadiusKm} km con Starter, nessun limite con Pro e Business. Puoi dividere l’area in più richieste più piccole, oppure passare a un piano superiore.` },
    en: { q: 'I get 403 with max_radius_km.',
      a: `The radius is above your plan’s maximum: ${free.maxRadiusKm} km on Free, ${starter.maxRadiusKm} km on Starter, no limit on Pro and Business. Split the area into several smaller requests, or upgrade.` },
  },
  {
    id: 'errore-403-sorvoli', cat: 'limiti',
    it: { q: 'Ricevo 403 su /v2/overflights.',
      a: 'Raggio o finestra superano il massimo del tuo piano per i sorvoli: 10 km e 6 ore con Free, 25 km e 24 ore con Starter, 50 km e 24 ore con Pro e Business. Riduci il raggio o dividi la ricerca in finestre più corte.' },
    en: { q: 'I get 403 on /v2/overflights.',
      a: 'The radius or the window is above your plan’s maximum for overflights: 10 km and 6 hours on Free, 25 km and 24 hours on Starter, 50 km and 24 hours on Pro and Business. Shrink the radius or split the search into shorter windows.' },
  },
  {
    id: 'bloccato-cloudflare', cat: 'limiti',
    it: { q: 'Ricevo «Sorry, you have been blocked» o un errore 1010.',
      a: 'La richiesta è stata fermata da Cloudflare prima dell’API. Manda sempre l’header X-Api-Key e un User-Agent tuo. Se continua, scrivi a admin@flyitalyadsb.com con l’ID CF-Ray della pagina di errore, data e ora (UTC) e l’endpoint.' },
    en: { q: 'I get “Sorry, you have been blocked” or error 1010.',
      a: 'Cloudflare stopped the request before it reached the API. Always send the X-Api-Key header and a User-Agent of your own. If it goes on, write to admin@flyitalyadsb.com with the CF-Ray ID from the error page, the date and time (UTC) and the endpoint.' },
  },
  {
    id: 'errore-401', cat: 'limiti',
    it: { q: 'Ricevo 401 «missing or invalid X-Api-Key».',
      a: 'La chiave manca o non è valida. Controlla il nome dell’header (X-Api-Key) e che la chiave sia intera. Se l’hai rigenerata in La mia API, la vecchia non funziona più.' },
    en: { q: 'I get 401 “missing or invalid X-Api-Key”.',
      a: 'The key is missing or invalid. Check the header name (X-Api-Key) and that the key is complete. If you regenerated it in My API, the old one no longer works.' },
  },
  {
    id: 'browser', cat: 'limiti',
    it: { q: 'Posso chiamare l’API dal browser?',
      a: 'Sì, il CORS è aperto. Ma una chiave in una pagina web la vede chiunque: per un sito pubblico chiama l’API dal tuo server e mostra i risultati.' },
    en: { q: 'Can I call the API from a browser?',
      a: 'Yes, CORS is open. But anyone can see a key inside a web page: for a public site, call the API from your server and show the results.' },
  },
  {
    id: 'streaming', cat: 'limiti',
    it: { q: 'C’è uno streaming o un WebSocket?',
      a: 'No: si interroga l’API a intervalli. I dati si aggiornano ogni 2 secondi; per un display o un’app di solito basta ogni 5–15 secondi.' },
    en: { q: 'Is there a stream or a WebSocket?',
      a: 'No: you poll the API. The data refreshes every 2 seconds; for a display or an app, every 5–15 seconds is usually enough.' },
  },
  // --- Dati e copertura ---
  {
    id: 'aereo-mancante', cat: 'dati',
    it: { q: 'Perché un aereo non c’è?',
      a: 'La copertura segue i ricevitori: dove non ce ne sono abbastanza, o a bassa quota, l’aereo non si vede. Gli aerei senza ADS-B si vedono solo con la multilaterazione, che chiede almeno quattro ricevitori in vista. Le posizioni più vecchie di circa 60 secondi non vengono restituite. I dati non sono filtrati: PIA e LADD sono segnalati, non nascosti.' },
    en: { q: 'Why is an aircraft missing?',
      a: 'Coverage follows the receivers: where there aren’t enough, or at low altitude, the aircraft isn’t seen. Aircraft without ADS-B show up only through multilateration, which needs at least four receivers in view. Positions older than about 60 seconds are not returned. The data is unfiltered: PIA and LADD aircraft are flagged, not hidden.' },
  },
  {
    id: 'adsb-mlat', cat: 'dati',
    it: { q: 'Che differenza c’è tra ADS-B e MLAT?',
      a: 'Con ADS-B è l’aereo a trasmettere la sua posizione GPS. Con MLAT la posizione la calcoliamo noi, dalla differenza dei tempi di arrivo dello stesso segnale ad almeno quattro ricevitori: serve per gli aerei senza ADS-B, molti militari compresi. Nell’API il campo type vale mlat.' },
    en: { q: 'What is the difference between ADS-B and MLAT?',
      a: 'With ADS-B the aircraft transmits its own GPS position. With MLAT we compute the position from the arrival-time differences of the same signal at four or more receivers: it covers aircraft without ADS-B, many military ones included. In the API the type field is mlat.' },
  },
  {
    id: 'unita', cat: 'dati',
    it: { q: 'In che unità sono quota, velocità e raggio?',
      a: 'Quota in piedi (alt_baro può essere la stringa "ground"), velocità in nodi, velocità verticale in piedi al minuto. Il raggio delle richieste è in chilometri, non in miglia nautiche come in altre API ADS-B.' },
    en: { q: 'What units are altitude, speed and radius in?',
      a: 'Altitude in feet (alt_baro can be the string "ground"), speed in knots, vertical rate in feet per minute. The request radius is in kilometres, not the nautical miles some other ADS-B APIs use.' },
  },
  {
    id: 'squawk', cat: 'dati',
    it: { q: 'Posso monitorare gli squawk di emergenza (7700)?',
      a: 'Sì: /v2/events elenca le emergenze (7500, 7600, 7700), i militari e gli altri aerei notevoli visti in una zona, fino a 7 giorni indietro; con i piani a pagamento li ricevi appena succedono con un webhook. Uno squawk di emergenza è quello che ha trasmesso il transponder, non un’emergenza confermata. Dettagli nella pagina Avvisi della documentazione.' },
    en: { q: 'Can I monitor emergency squawks (7700)?',
      a: 'Yes: /v2/events lists the emergencies (7500, 7600, 7700), military and other notable aircraft seen in an area, up to 7 days back; on paid plans you get them as they happen with a webhook. An emergency squawk is what the transponder sent, not a confirmed emergency. Details on the Alerts page of the docs.' },
  },
  // --- Storico ---
  {
    id: 'storico-da-quando', cat: 'storico',
    it: { q: 'Da quando c’è lo storico?',
      a: 'Dal 2022, con buchi: dal 10/04/2022 al 04/10/2023 solo il primo e l’ultimo punto di ogni volo, dal 25/07/2023 al 27/06/2024 la traccia completa con lacune, e dal 17/08/2026 la traccia completa ogni giorno. Tra il 28/06/2024 e il 16/08/2026 non c’è.' },
    en: { q: 'How far back does history go?',
      a: 'To 2022, with gaps: from 10/04/2022 to 04/10/2023 only the first and last point of each flight, from 25/07/2023 to 27/06/2024 full tracks with gaps, and since 17/08/2026 full tracks every day. There is nothing between 28/06/2024 and 16/08/2026.' },
  },
  {
    id: 'storico-zona', cat: 'storico',
    it: { q: 'Posso avere tutti gli aerei di una zona o di un aeroporto in un giorno passato?',
      a: 'Sì, per finestre brevi: /v2/overflights (o lo strumento MCP overflights) restituisce gli aerei passati entro un raggio fino a 50 km, in una finestra fino a 24 ore, dal 17/08/2026. Per estrazioni più ampie o progetti di ricerca scrivi a admin@flyitalyadsb.com.' },
    en: { q: 'Can I get every aircraft in an area or at an airport on a past day?',
      a: 'Yes, for short windows: /v2/overflights (or the overflights MCP tool) returns the aircraft that passed within a radius of up to 50 km, in a window of up to 24 hours, since 17/08/2026. For larger extracts or research projects, write to admin@flyitalyadsb.com.' },
  },
  {
    id: 'sorvoli', cat: 'storico', api: true,
    it: { q: 'Quali aerei sono passati sopra un luogo in un certo momento?',
      a: '/v2/overflights?lat=&lon=&dist=&from=&to= elenca gli aerei passati entro dist km da un punto in quella finestra, con ora e distanza del punto più vicino, quota minima e fonte (ADS-B o MLAT). Il giorno in corso arriva fino a circa 10 minuti fa, e la risposta dice sempre quale periodo copre. Riguarda gli aerei, non le persone: non sappiamo chi c’era a bordo.' },
    en: { q: 'Which aircraft flew over a place at a given time?',
      a: '/v2/overflights?lat=&lon=&dist=&from=&to= lists the aircraft that passed within dist km of a point in that window, with the time and distance of the closest point, the lowest altitude and the source (ADS-B or MLAT). The current day reaches up to about 10 minutes ago, and the response always says which period it covers. It is about aircraft, not people: we don’t know who was on board.' },
  },
  {
    id: 'dati-grezzi', cat: 'storico',
    it: { q: 'Avete i dati grezzi (messaggi Mode-S, BEAST)?',
      a: 'No: distribuiamo solo i dati decodificati. L’accesso ai dati grezzi veniva raccolto e ridistribuito altrove, e non lo offriamo più.' },
    en: { q: 'Do you have the raw data (Mode-S messages, BEAST)?',
      a: 'No: we only distribute decoded data. Raw access used to be harvested and redistributed elsewhere, so we no longer offer it.' },
  },
  // --- MCP e agenti AI ---
  {
    id: 'mcp-quota', cat: 'mcp',
    it: { q: 'Le domande all’assistente consumano richieste?',
      a: 'Sì: ogni chiamata a uno strumento MCP è una richiesta all’API e conta sul piano della tua chiave, come una chiamata diretta.' },
    en: { q: 'Do questions to the assistant use up requests?',
      a: 'Yes: each MCP tool call is an API request and counts on your key’s plan, like a direct call.' },
  },
  {
    id: 'vicino-a-me', cat: 'mcp',
    it: { q: 'Posso chiedere «che aerei ci sono vicino a me?»',
      a: 'Sì, dopo aver salvato una posizione: da La mia API con «Usa la mia posizione», oppure dicendo all’assistente «la mia posizione è Brescia». Nessun assistente passa la posizione del tuo dispositivo al server. La salviamo arrotondata a circa 1 km e la cancelli quando vuoi. Su ChatGPT, senza una posizione salvata, usiamo la città che ChatGPT allega alla richiesta.' },
    en: { q: 'Can I ask “which aircraft are near me?”',
      a: 'Yes, once you have saved a position: from My API with “Use my position”, or by telling the assistant “my position is Brescia”. No assistant passes your device’s position to the server. We store it rounded to about 1 km and you can delete it at any time. On ChatGPT, with no saved position, we use the city ChatGPT attaches to the request.' },
  },
  {
    id: 'mcp-profilo-aereo', cat: 'mcp', api: true,
    it: { q: 'Posso avere il profilo di un aereo, con la foto?',
      a: 'Sì: chiedi all’assistente di un aereo e userà aircraft_profile, o chiama /v2/profile/{icao}: identità, se lo vediamo adesso e dove, primo e ultimo giorno nello storico. La foto non è nella risposta, perché le condizioni di Planespotters.net non lo permettono: ricevi il link alla loro pagina, con il nome del fotografo, e quello della mappa. Per gli aerei PIA e LADD niente link alle foto. Mai nomi di proprietari.' },
    en: { q: 'Can I get a profile of one aircraft, with a photo?',
      a: 'Yes: ask your assistant about an aircraft and it will use aircraft_profile, or call /v2/profile/{icao}: identity, whether we see it now and where, first and last day in the history. The photo isn’t in the answer, because Planespotters.net’s terms don’t allow it: you get the link to their page, with the photographer’s name, and the map link. No photo link for PIA and LADD aircraft. Never owner names.' },
  },
  {
    id: 'mcp-mappa-chat', cat: 'mcp',
    it: { q: 'Perché in chat vedo una mappa?',
      a: 'Su Claude e ChatGPT gli strumenti che restituiscono aerei li mostrano anche su una mappa interattiva nella conversazione, colorati per quota. Carica solo le tessere di OpenStreetMap, non chiede permessi e non usa la tua posizione. Tra un aggiornamento e l’altro gli aerei in volo si muovono secondo rotta e velocità: è una stima. Aggiorna ripete la ricerca; Live la ripete ogni 30 secondi per al massimo 10 minuti, mentre la mappa è sullo schermo. Ogni aggiornamento conta come una richiesta.' },
    en: { q: 'Why do I see a map in the chat?',
      a: 'On Claude and ChatGPT, the tools that return aircraft also show them on an interactive map in the conversation, coloured by altitude. It only loads OpenStreetMap tiles, asks for no permissions and doesn’t use your location. Between updates, aircraft in flight move along their track at their speed: that is an estimate. Refresh repeats the search; Live repeats it every 30 seconds for up to 10 minutes, while the map is on screen. Each update counts as one request.' },
  },
  {
    id: 'mcp-scollegare', cat: 'mcp',
    it: { q: 'Come scollego un assistente?',
      a: 'In La mia API, sotto «Assistenti collegati», premi Scollega. La chiave non cambia.' },
    en: { q: 'How do I disconnect an assistant?',
      a: 'In My API, under “Connected assistants”, press Disconnect. Your key doesn’t change.' },
  },
  {
    id: 'agente-da-solo', cat: 'mcp',
    it: { q: 'Un agente AI può registrarsi da solo?',
      a: 'Sì, con auth.md, ma serve sempre la tua conferma: l’agente ti dà un link e un codice, tu entri con il codice che ti mandiamo per email e scrivi quello dell’agente.' },
    en: { q: 'Can an AI agent register by itself?',
      a: 'Yes, with auth.md, but it always needs your confirmation: the agent gives you a link and a code, you sign in with the code we email you and type the agent’s code.' },
  },
  // --- Ricevitori (feeder) ---
  {
    id: 'diventare-feeder', cat: 'feeder',
    it: { q: 'Come divento feeder?',
      a: 'Ti serve un ricevitore ADS-B (per esempio un Raspberry Pi con una chiavetta RTL-SDR e un’antenna) che mandi i dati in BEAST a dati.flyitalyadsb.com sulla porta 4905, e il client MLAT sulla 30100. La guida passo per passo è nella pagina Diventa feeder.' },
    en: { q: 'How do I become a feeder?',
      a: 'You need an ADS-B receiver (for example a Raspberry Pi with an RTL-SDR dongle and an antenna) that sends BEAST data to dati.flyitalyadsb.com on port 4905, and the MLAT client on port 30100. The step-by-step guide is on the Become a feeder page.' },
  },
  {
    id: 'attivazione-feed', cat: 'feeder',
    it: { q: 'Devo chiedere di attivare il mio ricevitore?',
      a: 'No: appena è configurato, i dati arrivano da soli. Per controllare, apri la pagina «I miei dati arrivano?» dalla stessa rete del ricevitore.' },
    en: { q: 'Do I need to ask you to activate my receiver?',
      a: 'No: as soon as it is configured, the data arrives on its own. To check, open the “Is my data arriving?” page from the receiver’s network.' },
  },
  {
    id: 'mlat-errore', cat: 'feeder',
    it: { q: 'Il client MLAT dà errore o non si sincronizza.',
      a: 'Controlla che la rete permetta le connessioni in uscita verso dati.flyitalyadsb.com sulla porta 30100 (un «no route to host» di solito è un firewall). Poi che latitudine, longitudine e quota dell’antenna siano esatte e che il nome MLAT sia univoco. La sincronizzazione chiede altri ricevitori in vista nella tua zona.' },
    en: { q: 'The MLAT client errors out or doesn’t sync.',
      a: 'Check that your network allows outgoing connections to dati.flyitalyadsb.com on port 30100 (a “no route to host” is usually a firewall). Then check that the antenna’s latitude, longitude and altitude are exact and the MLAT name is unique. Syncing needs other receivers in view in your area.' },
  },
  {
    id: 'feeder-licenza', cat: 'feeder',
    it: { q: 'Posso usare i dati della rete in un’app a pagamento?',
      a: 'Sì: i dati che ricevi dall’API sono CC BY-SA 4.0 e vanno bene anche in un prodotto a pagamento, citando FlyItalyADSB in modo visibile. Il vantaggio feeder però vale solo per uso non commerciale.' },
    en: { q: 'Can I use the network’s data in a paid app?',
      a: 'Yes: the data you get from the API is CC BY-SA 4.0 and is fine in a paid product too, with FlyItalyADSB credited visibly. The feeder perk, however, is for non-commercial use only.' },
  },
  // --- Mappa ---
  {
    id: 'mappa-tratta', cat: 'mappa',
    it: { q: 'La mappa mostra da dove parte e dove va un volo?',
      a: 'Puoi attivarlo dalle impostazioni della mappa, con la voce «Lookup route». La tratta viene da un servizio esterno (adsb.im) in base al nominativo e può essere sbagliata. L’API non la restituisce.' },
    en: { q: 'Does the map show where a flight departs from and goes to?',
      a: 'You can turn it on in the map settings, with “Lookup route”. The route comes from an external service (adsb.im) based on the callsign and can be wrong. The API doesn’t return it.' },
  },
  {
    id: 'mappa-tipo-sbagliato', cat: 'mappa',
    it: { q: 'Un aereo ha il tipo, l’immatricolazione o la sagoma sbagliati.',
      a: 'Tipo e immatricolazione vengono da un database di aeromobili. Per segnalare un errore scrivi a admin@flyitalyadsb.com con l’hex ICAO (o l’immatricolazione) e il dato corretto.' },
    en: { q: 'An aircraft has the wrong type, registration or silhouette.',
      a: 'Type and registration come from an aircraft database. To report a mistake, write to admin@flyitalyadsb.com with the ICAO hex (or registration) and the correct information.' },
  },
];

export const faqsFor = (filter: (f: Faq) => boolean = () => true) =>
  FAQ_CATEGORIES.flatMap((c) => FAQS.filter((f) => f.cat === c.id && filter(f)));
