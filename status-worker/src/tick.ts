// One pass of the status page: probe, record, announce. Run once a minute by
// the Durable Object's alarm (store.ts), not by the cron: on 2026-10-23
// Cloudflare skipped about one cron minute in six on this Worker and delivered
// others 15-25 minutes late and out of order. The cron (index.ts) only
// restarts the alarm loop if it ever stops.

import { downMessage, slackPayload, upMessage, type DownAlert, type UpAlert } from './alerts';
import { COMPONENTS, type Network, type Result } from './checks';
import { runProbes, type ProbeEnv } from './probes';

export interface TickEnv extends ProbeEnv {
  /** #alerts incoming webhook (the daily digest's). Secret; unset = no alerts. */
  SLACK_WEBHOOK_URL?: string;
  /** production → [PROD] tag. */
  ENVIRONMENT?: string;
}

/** What a pass needs from the store: the Durable Object itself, from its alarm. */
export interface TickStore {
  medians(): { feeders: number | null; mlat: number | null };
  record(at: number, results: Result[], network: Network | null): void;
  pendingAlerts(): { down: DownAlert[]; up: UpAlert[] };
  markAlerted(ids: number[], which: 'down' | 'up', at: number): void;
}

async function post(env: TickEnv, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(env.SLACK_WEBHOOK_URL!, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Announce new outages and recoveries; mark them only once Slack took them,
 * so a failed post is retried on the next minute. */
async function alert(env: TickEnv, st: TickStore, at: number): Promise<void> {
  const page = `${env.SITE}/stato/`;
  const { down, up } = st.pendingAlerts();
  if (down.length && await post(env, slackPayload(downMessage(down, at, page), env.ENVIRONMENT ?? '', at))) {
    st.markAlerted(down.map((d) => d.id), 'down', at);
  }
  if (up.length && await post(env, slackPayload(upMessage(up, page), env.ENVIRONMENT ?? '', at))) {
    st.markAlerted(up.map((u) => u.id), 'up', at);
  }
}

export async function tick(env: TickEnv, st: TickStore): Promise<void> {
  // Stamped with the time the probes really run, never with a scheduled time.
  const at = Math.floor(Date.now() / 1000);
  const minute = Math.floor(at / 60);
  const due = new Set(COMPONENTS.filter((c) => minute % c.every === 0).map((c) => c.id));
  const { results, network } = await runProbes(env, due, st.medians());
  st.record(at, results, network);
  if (env.SLACK_WEBHOOK_URL) await alert(env, st, at);
}
