// node --test status-worker/test/alerts.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downMessage, slackPayload, upMessage } from '../src/alerts.ts';

const T0 = Date.UTC(2026, 9, 23, 10, 41) / 1000;
const PAGE = 'https://flyitalyadsb.com/stato/';

test('down: facts only, Italian reason, every component listed', () => {
  const m = downMessage([
    { id: 1, component: 'api', started: T0, note: 'HTTP 502' },
    { id: 2, component: 'mcp', started: T0 + 60, note: null },
  ], T0 + 180, PAGE);
  assert.equal(m.color, '#dc3545');
  assert.match(m.text, /disservizio\*: API REST, Server MCP/);
  assert.match(m.text, /\*API REST\*: giù dalle 10:41 UTC \(3 min\), ultimo controllo: errore HTTP 502/);
  assert.match(m.text, /\*Server MCP\*: giù dalle 10:42 UTC \(2 min\)$/m);
  assert.match(m.text, /<https:\/\/flyitalyadsb\.com\/stato\/\|Pagina di stato>/);
});

test('up: duration and whether it is fully back', () => {
  const m = upMessage([
    { id: 1, component: 'api', started: T0, ended: T0 + 17 * 60, now: 'up' },
    { id: 2, component: 'live', started: T0, ended: T0 + 5 * 60, now: 'degraded' },
  ], PAGE);
  assert.equal(m.color, '#28a745');
  assert.match(m.text, /\*API REST\*: di nuovo operativo dopo 17 min \(10:41–10:58 UTC\)/);
  assert.match(m.text, /\*Dati in tempo reale\*: raggiungibile, con prestazioni ridotte dopo 5 min/);
});

test('payload: nesso_notify shape, env tag first, unknown env is DEV', () => {
  const p = slackPayload({ color: '#dc3545', text: 'x' }, 'production', T0) as { attachments: { text: string; footer: string; mrkdwn_in: string[] }[] };
  assert.equal(p.attachments[0].text, '[PROD] x');
  assert.deepEqual(p.attachments[0].mrkdwn_in, ['text']);
  assert.equal(p.attachments[0].footer, 'flyitalyadsb · stato del servizio | flyitalyadsb-status · PROD · 10:41 UTC');
  const d = slackPayload({ color: '#dc3545', text: 'x' }, '', T0) as { attachments: { text: string }[] };
  assert.equal(d.attachments[0].text, '[DEV] x');
});

test('a reason from the edge cannot inject Slack markup', () => {
  const m = downMessage([{ id: 1, component: 'site', started: T0, note: '<!channel> boom' }], T0 + 180, PAGE);
  assert.doesNotMatch(m.text, /<!channel>/);
});
