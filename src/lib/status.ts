// Status page (/stato/, /en/status/) and its Atom feeds: the components the
// status Worker probes (status-worker/src/checks.ts, same ids and order), their
// names in both languages, and the published incidents from
// src/content/status/{it,en}/.

import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from './routes';

export const SITE = 'https://flyitalyadsb.com';

export type ComponentId = 'site' | 'map' | 'live' | 'api' | 'history' | 'mcp' | 'feeders' | 'mlat';

interface ComponentInfo {
  id: ComponentId;
  name: Record<Lang, string>;
  what: Record<Lang, string>;
  /** How the probe decides, for the "how we measure" section. */
  rule: Record<Lang, string>;
}

export const GROUPS: { title: Record<Lang, string>; ids: ComponentId[] }[] = [
  { title: { it: 'Servizi', en: 'Services' }, ids: ['site', 'map', 'api', 'mcp', 'history'] },
  { title: { it: 'Dati e rete', en: 'Data and network' }, ids: ['live', 'feeders', 'mlat'] },
];

export const COMPONENTS: Record<ComponentId, ComponentInfo> = {
  site: {
    id: 'site',
    name: { it: 'Sito web', en: 'Website' },
    what: { it: 'flyitalyadsb.com: pagine, aeroporti, documentazione, account API', en: 'flyitalyadsb.com: pages, airports, documentation, API account' },
    rule: {
      it: 'Scarichiamo un file della versione pubblicata del sito (il feed di questa pagina). Operativo se risponde correttamente entro 3 secondi.',
      en: 'We download a file of the published site (this page\'s feed). Operational if it answers correctly within 3 seconds.',
    },
  },
  map: {
    id: 'map',
    name: { it: 'Mappa live', en: 'Live map' },
    what: { it: 'mappa.flyitalyadsb.com', en: 'mappa.flyitalyadsb.com' },
    rule: {
      it: 'Apriamo la pagina della mappa. Operativa se risponde correttamente entro 3 secondi; i dati che mostra li misura «Dati in tempo reale».',
      en: 'We open the map page. Operational if it answers correctly within 3 seconds; the data it shows is measured by "Live data".',
    },
  },
  api: {
    id: 'api',
    name: { it: 'API REST', en: 'REST API' },
    what: { it: 'api.flyitalyadsb.com/v2', en: 'api.flyitalyadsb.com/v2' },
    rule: {
      it: 'Una richiesta vera con una chiave come quella dei clienti: gli aerei entro 250 km da Milano. Operativa se risponde con i dati entro 3 secondi.',
      en: 'A real request with a key like a customer\'s: the aircraft within 250 km of Milan. Operational if it answers with the data within 3 seconds.',
    },
  },
  mcp: {
    id: 'mcp',
    name: { it: 'Server MCP', en: 'MCP server' },
    what: { it: 'flyitalyadsb.com/mcp per Claude, ChatGPT e gli agenti AI', en: 'flyitalyadsb.com/mcp for Claude, ChatGPT and AI agents' },
    rule: {
      it: 'Una connessione MCP vera (initialize) con la stessa chiave. Operativo se il server risponde entro 3 secondi.',
      en: 'A real MCP connection (initialize) with the same key. Operational if the server answers within 3 seconds.',
    },
  },
  history: {
    id: 'history',
    name: { it: 'Storico', en: 'History' },
    what: { it: '/v2/history e l\'archivio delle tracce', en: '/v2/history and the trace archive' },
    rule: {
      it: 'Ogni 5 minuti chiediamo i giorni disponibili di un aereo. «Prestazioni ridotte» se l\'archivio dei giorni più vecchi non risponde.',
      en: 'Every 5 minutes we ask for an aircraft\'s available days. "Degraded" if the archive of older days doesn\'t answer.',
    },
  },
  live: {
    id: 'live',
    name: { it: 'Dati in tempo reale', en: 'Live data' },
    what: { it: 'Il flusso che alimenta mappa, API e MCP', en: 'The feed behind the map, the API and MCP' },
    rule: {
      it: 'Guardiamo l\'età dell\'ultimo aggiornamento, non solo la risposta: oltre 30 secondi «Prestazioni ridotte», oltre 3 minuti «Disservizio». Anche meno di 1.000 aerei nel mondo vuol dire che mancano dati.',
      en: 'We look at how old the latest update is, not only at the answer: over 30 seconds is "Degraded", over 3 minutes "Outage". Fewer than 1,000 aircraft worldwide also means data is missing.',
    },
  },
  feeders: {
    id: 'feeders',
    name: { it: 'Rete di ricevitori', en: 'Receiver network' },
    what: { it: 'Gli indirizzi da cui i ricevitori ci inviano dati (BEAST)', en: 'The addresses receivers send us data from (BEAST)' },
    rule: {
      it: 'Il numero di indirizzi che ci inviano dati in questo momento, confrontato con la sua mediana dei 7 giorni: sotto il 70% «Prestazioni ridotte», sotto il 30% «Disservizio». Più ricevitori dietro la stessa connessione contano una volta.',
      en: 'The number of addresses sending us data right now, against its 7-day median: below 70% is "Degraded", below 30% "Outage". Several receivers behind one connection count once.',
    },
  },
  mlat: {
    id: 'mlat',
    name: { it: 'Multilaterazione (MLAT)', en: 'Multilateration (MLAT)' },
    what: { it: 'I server MLAT e i ricevitori collegati', en: 'The MLAT servers and the connected receivers' },
    rule: {
      it: 'I ricevitori collegati ai server MLAT, contati per nome e confrontati con la loro mediana dei 7 giorni come la rete, più i 5 server MLAT: se uno non risponde, «Prestazioni ridotte».',
      en: 'The receivers connected to the MLAT servers, counted by name and compared with their 7-day median like the network, plus the 5 MLAT servers: if one doesn\'t answer, "Degraded".',
    },
  },
};

export const STATE_LABEL: Record<string, Record<Lang, string>> = {
  investigating: { it: 'Analisi in corso', en: 'Investigating' },
  identified: { it: 'Causa trovata', en: 'Identified' },
  monitoring: { it: 'Sotto osservazione', en: 'Monitoring' },
  resolved: { it: 'Risolto', en: 'Resolved' },
  scheduled: { it: 'Programmata', en: 'Scheduled' },
  in_progress: { it: 'In corso', en: 'In progress' },
  completed: { it: 'Completata', en: 'Completed' },
};

export type StatusEntry = CollectionEntry<'status'>;

/** Published incidents and maintenance of one language, newest first. */
export async function statusEntries(lang: Lang): Promise<StatusEntry[]> {
  const all = await getCollection('status', (e) => e.id.startsWith(`${lang}/`));
  return all.sort((a, b) => b.data.start.getTime() - a.data.start.getTime());
}

/** The page's URL for an event, so the feed and other pages can link to it. */
export const entryAnchor = (e: StatusEntry) => `evento-${e.data.key}`;
export const pagePath = (lang: Lang) => (lang === 'it' ? '/stato/' : '/en/status/');

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);

/** Atom feed of the published incidents and maintenance (IT or EN). */
export async function statusFeed(lang: Lang): Promise<Response> {
  const entries = await statusEntries(lang);
  const page = `${SITE}${pagePath(lang)}`;
  const self = `${page}feed.xml`;
  const title = lang === 'it' ? 'FlyItalyADSB — stato del servizio' : 'FlyItalyADSB — service status';
  const updated = entries.reduce((t, e) => {
    const last = Math.max(e.data.start.getTime(), e.data.end?.getTime() ?? 0, ...e.data.updates.map((u) => u.at.getTime()));
    return Math.max(t, last);
  }, Date.UTC(2026, 9, 23));
  const items = entries.map((e) => {
    const last = e.data.updates.at(-1);
    const state = last ? `${STATE_LABEL[last.state][lang]}: ` : '';
    const names = e.data.components.map((c) => COMPONENTS[c].name[lang]).join(', ');
    const upd = Math.max(e.data.start.getTime(), e.data.end?.getTime() ?? 0, ...e.data.updates.map((u) => u.at.getTime()));
    const timeline = e.data.updates.map((u) => `<p><b>${xml(STATE_LABEL[u.state][lang])}</b> — ${u.at.toISOString().slice(0, 16).replace('T', ' ')} UTC<br/>${xml(u.text)}</p>`).join('');
    const summary = `${state}${e.data.title} (${names})`;
    return `  <entry>
    <id>${page}#${entryAnchor(e)}</id>
    <title>${xml(summary)}</title>
    <link href="${page}#${entryAnchor(e)}"/>
    <published>${e.data.start.toISOString()}</published>
    <updated>${new Date(upd).toISOString()}</updated>
    <content type="html">${xml(`${timeline}${e.rendered?.html ?? ''}`)}</content>
  </entry>`;
  }).join('\n');
  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}" xml:base="${SITE}/">
  <id>${self}</id>
  <title>${xml(title)}</title>
  <link rel="self" href="${self}"/>
  <link rel="alternate" type="text/html" href="${page}"/>
  <updated>${new Date(updated).toISOString()}</updated>
  <author><name>FlyItalyADSB</name></author>
${items}
</feed>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
