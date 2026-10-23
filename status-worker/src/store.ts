// The status history: one Durable Object ("status"), SQLite storage. A sample
// per component per probe, daily minute counts per status for the 90-day
// bars, the current state, and the periods a component was not up (detected
// here, not written by hand: published incidents are in the site's
// src/content/status/). Nothing is ever deleted: ~11k rows a day.

import { DurableObject } from 'cloudflare:workers';
import { COMPONENTS, median, utcDay, worst, type ComponentId, type Network, type Result, type Status } from './checks';

const DAYS = 90;
/** Shorter blips stay in the samples and the bars, not in the outage list. */
const MIN_OUTAGE_S = 120;

export interface ComponentSnapshot {
  id: ComponentId;
  status: Status | null;
  since: string | null;
  checked_at: string | null;
  latency_ms: number | null;
  value: number | null;
  note: string | null;
  uptime_90d: number | null;
  days: { day: string; up: number; degraded: number; down: number }[];
}

export interface Snapshot {
  generated_at: string;
  monitoring_since: string | null;
  overall: Status | 'unknown';
  components: ComponentSnapshot[];
  network: (Network & { data_age_s: number | null; checked_at: string }) | null;
  outages: { component: ComponentId; status: Status; started: string; ended: string | null; minutes: number }[];
}

const iso = (s: number | null | undefined): string | null => (s ? new Date(s * 1000).toISOString() : null);

export class StatusStore extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    const sql = ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS samples (
      ts INTEGER NOT NULL, component TEXT NOT NULL, status TEXT NOT NULL,
      latency_ms INTEGER, value REAL, note TEXT)`);
    sql.exec('CREATE INDEX IF NOT EXISTS samples_component_ts ON samples (component, ts)');
    sql.exec(`CREATE TABLE IF NOT EXISTS daily (
      day TEXT NOT NULL, component TEXT NOT NULL,
      up INTEGER NOT NULL DEFAULT 0, degraded INTEGER NOT NULL DEFAULT 0, down INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, component))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS current (
      component TEXT PRIMARY KEY, status TEXT NOT NULL, since INTEGER NOT NULL, checked_at INTEGER NOT NULL,
      latency_ms INTEGER, value REAL, note TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS outages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, component TEXT NOT NULL, status TEXT NOT NULL,
      started INTEGER NOT NULL, ended INTEGER)`);
    sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  }

  /** 7-day medians of the feeder counts, from samples that had a count. */
  medians(): { feeders: number | null; mlat: number | null } {
    const since = Math.floor(Date.now() / 1000) - 7 * 86400;
    const vals = (c: ComponentId) => this.ctx.storage.sql
      .exec<{ value: number }>('SELECT value FROM samples WHERE component = ? AND ts >= ? AND value > 0', c, since)
      .toArray().map((r) => r.value);
    // A median from a few minutes of data would be noise: wait for a day.
    const first = this.meta('since');
    const enough = first !== null && Date.now() / 1000 - Number(first) >= 86400;
    return enough ? { feeders: median(vals('feeders')), mlat: median(vals('mlat')) } : { feeders: null, mlat: null };
  }

  record(at: number, results: Result[], network: Network | null): void {
    const sql = this.ctx.storage.sql;
    const every = new Map(COMPONENTS.map((c) => [c.id, c.every]));
    this.ctx.storage.transactionSync(() => {
      if (this.meta('since') === null) this.setMeta('since', String(at));
      for (const r of results) {
        sql.exec('INSERT INTO samples (ts, component, status, latency_ms, value, note) VALUES (?, ?, ?, ?, ?, ?)',
          at, r.component, r.status, r.latencyMs, r.value, r.note);
        // A probe run every N minutes stands for those N minutes in the bars.
        const w = every.get(r.component) ?? 1;
        sql.exec(`INSERT INTO daily (day, component, ${r.status}) VALUES (?, ?, ?)
                  ON CONFLICT (day, component) DO UPDATE SET ${r.status} = ${r.status} + excluded.${r.status}`,
          utcDay(at), r.component, w);
        const cur = sql.exec<{ status: Status; since: number }>(
          'SELECT status, since FROM current WHERE component = ?', r.component).toArray()[0];
        const since = cur && cur.status === r.status ? cur.since : at;
        sql.exec(`INSERT INTO current (component, status, since, checked_at, latency_ms, value, note)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT (component) DO UPDATE SET status = excluded.status, since = excluded.since,
                    checked_at = excluded.checked_at, latency_ms = excluded.latency_ms,
                    value = excluded.value, note = excluded.note`,
          r.component, r.status, since, at, r.latencyMs, r.value, r.note);
        if (!cur || cur.status !== r.status) {
          sql.exec('UPDATE outages SET ended = ? WHERE component = ? AND ended IS NULL', at, r.component);
          if (r.status !== 'up') {
            sql.exec('INSERT INTO outages (component, status, started) VALUES (?, ?, ?)', r.component, r.status, at);
          }
        }
      }
      if (network) this.setMeta('network', JSON.stringify({ ...network, checked_at: at }));
    });
  }

  snapshot(): Snapshot {
    const sql = this.ctx.storage.sql;
    const now = Math.floor(Date.now() / 1000);
    const firstDay = utcDay(now - (DAYS - 1) * 86400);
    const current = new Map(sql.exec<{ component: ComponentId; status: Status; since: number; checked_at: number;
      latency_ms: number | null; value: number | null; note: string | null }>('SELECT * FROM current').toArray()
      .map((r) => [r.component, r]));
    const daily = sql.exec<{ day: string; component: ComponentId; up: number; degraded: number; down: number }>(
      'SELECT day, component, up, degraded, down FROM daily WHERE day >= ? ORDER BY day', firstDay).toArray();

    let overall: Status | 'unknown' = 'unknown';
    const components: ComponentSnapshot[] = COMPONENTS.map(({ id }) => {
      const cur = current.get(id);
      // A component not checked for 10 minutes is unknown, not up: the
      // Worker itself may be the one that stopped.
      const fresh = cur && now - cur.checked_at < 600;
      const status = fresh ? cur.status : null;
      if (status) overall = overall === 'unknown' ? status : worst(overall, status);
      const days = daily.filter((d) => d.component === id).map(({ day, up, degraded, down }) => ({ day, up, degraded, down }));
      const total = days.reduce((n, d) => n + d.up + d.degraded + d.down, 0);
      const avail = days.reduce((n, d) => n + d.up + d.degraded, 0);
      return {
        id, status, since: fresh ? iso(cur.since) : null, checked_at: iso(cur?.checked_at),
        latency_ms: cur?.latency_ms ?? null, value: cur?.value ?? null, note: cur?.note ?? null,
        uptime_90d: total ? Math.round((avail / total) * 100000) / 1000 : null, days,
      };
    });

    const netRaw = this.meta('network');
    const net = netRaw ? (JSON.parse(netRaw) as Network & { checked_at: number }) : null;
    const outages = sql.exec<{ component: ComponentId; status: Status; started: number; ended: number | null }>(
      `SELECT component, status, started, ended FROM outages
       WHERE (ended IS NULL OR ended - started >= ?) AND started >= ?
       ORDER BY started DESC LIMIT 50`, MIN_OUTAGE_S, now - DAYS * 86400).toArray()
      .map((o) => ({ component: o.component, status: o.status, started: iso(o.started) as string, ended: iso(o.ended),
                     minutes: Math.max(1, Math.round(((o.ended ?? now) - o.started) / 60)) }));

    return {
      generated_at: new Date(now * 1000).toISOString(),
      monitoring_since: iso(Number(this.meta('since')) || null),
      overall,
      components,
      network: net ? { ...net, data_age_s: net.now ? Math.max(0, Math.round(net.checked_at - net.now)) : null,
                       checked_at: iso(net.checked_at) as string } : null,
      outages,
    };
  }

  private meta(k: string): string | null {
    return this.ctx.storage.sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v ?? null;
  }

  private setMeta(k: string, v: string): void {
    this.ctx.storage.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, v);
  }
}
