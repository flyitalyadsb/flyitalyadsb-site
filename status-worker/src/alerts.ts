// Immediate Slack alert in #alerts when a component is DOWN for at least
// DOWN_ALERT_MIN consecutive minutes, and again when it comes back. It is the
// second exception, after the API purchase alert, to flyitalyadsb's "one
// Slack message a day" rule (owner, 2026-10-23). Degraded performance and
// shorter blips go only in the daily digest's "Stato del servizio" section.
//
// The text is made of the probes' facts only (component, since when, the
// last check's reason), like public-api/billing_slack.py: no fixed sentence
// that can go stale. Same shape as nesso_notify.send_slack_message:
// [PROD]/[DEV] tag first, coloured attachment, footer "app · env · HH:MM UTC".
// It runs outside our cluster, so it still arrives when the cluster is down.
// Pure composition here (tested); the sending is in index.ts.

export const DOWN_ALERT_MIN = 3;

const NAMES: Record<string, string> = {
  site: 'Sito web', map: 'Mappa live', live: 'Dati in tempo reale', api: 'API REST',
  mcp: 'Server MCP', history: 'Storico', feeders: 'Rete di ricevitori', mlat: 'Multilaterazione (MLAT)',
};

const NOTES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^no response$/, () => 'nessuna risposta'],
  [/^HTTP (\d+)$/, (m) => `errore HTTP ${m[1]}`],
  [/^slow: (\d+) ms$/, (m) => `lento: ${m[1]} ms`],
  [/^data (\d+) s old$/, (m) => `dato vecchio di ${m[1]} s`],
  [/^no data$/, () => 'nessun dato'],
  [/^no receivers connected$/, () => 'nessun ricevitore collegato'],
  [/^(\d+) vs usual (\d+)$/, (m) => `${m[1]} contro i soliti ${m[2]}`],
  [/^no MLAT shard readable$/, () => 'nessun server MLAT raggiungibile'],
  [/^unexpected body$/, () => 'risposta inattesa'],
];

const note = (n: string | null): string => {
  if (!n) return '';
  for (const [re, f] of NOTES) {
    const m = n.match(re);
    if (m) return f(m);
  }
  return n;
};

const hhmm = (s: number) => new Date(s * 1000).toISOString().slice(11, 16);
const mins = (a: number, b: number) => Math.max(1, Math.round((b - a) / 60));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface DownAlert { id: number; component: string; started: number; note: string | null }
export interface UpAlert { id: number; component: string; started: number; ended: number; now: string | null }

export interface SlackMessage { color: string; text: string }

export function downMessage(items: DownAlert[], now: number, page: string): SlackMessage {
  const names = items.map((i) => NAMES[i.component] ?? i.component);
  const lines = items.map((i) => {
    const why = note(i.note);
    return `• *${esc(NAMES[i.component] ?? i.component)}*: giù dalle ${hhmm(i.started)} UTC (${mins(i.started, now)} min)`
      + (why ? `, ultimo controllo: ${esc(why)}` : '');
  });
  return {
    color: '#dc3545',
    text: `:red_circle: *flyitalyadsb — disservizio*: ${esc(names.join(', '))}\n${lines.join('\n')}\n<${page}|Pagina di stato>`,
  };
}

export function upMessage(items: UpAlert[], page: string): SlackMessage {
  const lines = items.map((i) => {
    const state = i.now === 'degraded' ? 'raggiungibile, con prestazioni ridotte' : 'di nuovo operativo';
    return `• *${esc(NAMES[i.component] ?? i.component)}*: ${state} dopo ${mins(i.started, i.ended)} min`
      + ` (${hhmm(i.started)}–${hhmm(i.ended)} UTC)`;
  });
  return {
    color: '#28a745',
    text: `:large_green_circle: *flyitalyadsb — risolto*\n${lines.join('\n')}\n<${page}|Pagina di stato>`,
  };
}

const TAGS: Record<string, string> = { production: 'PROD', prod: 'PROD', staging: 'STAGING', development: 'DEV', dev: 'DEV' };

/** The webhook body, in nesso_notify's attachment style. */
export function slackPayload(msg: SlackMessage, environment: string, at: number): unknown {
  const tag = TAGS[(environment || 'dev').toLowerCase()] ?? 'DEV';
  return {
    attachments: [{
      color: msg.color,
      text: `[${tag}] ${msg.text}`,
      mrkdwn_in: ['text'],
      footer: `flyitalyadsb · stato del servizio | flyitalyadsb-status · ${tag} · ${hhmm(at)} UTC`,
    }],
  };
}
