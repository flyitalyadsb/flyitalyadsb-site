// node --test status-worker/test/  (Node >= 22.6 runs the .ts directly)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCount, classifyHttp, classifyLive, median, nextPass, utcDay, worst } from '../src/checks.ts';

const net = (over: Record<string, unknown> = {}) => ({
  now: 1000, aircraft: 11000, aircraft_with_pos: 9000, messages_per_s: 9000,
  feeders_beast: 2600, feeders_mlat: 1650, mlat_shards_ok: 5, mlat_shards: 5, ...over,
});

test('http: right answer in time is up, slow is degraded, wrong or none is down', () => {
  assert.equal(classifyHttp('api', 200, true, 280).status, 'up');
  assert.equal(classifyHttp('api', 200, true, 4000).status, 'degraded');
  assert.equal(classifyHttp('api', 502, false, 40).note, 'HTTP 502');
  assert.equal(classifyHttp('api', 200, false, 40, null, 'unexpected body').status, 'down');
  assert.deepEqual(classifyHttp('site', null, false, 10_000), {
    component: 'site', status: 'down', latencyMs: null, value: null, note: 'no response' });
});

test('live: a 200 with old data is not up', () => {
  assert.equal(classifyLive(net(), 1010, 50).status, 'up');
  assert.equal(classifyLive(net(), 1060, 50).status, 'degraded');
  assert.equal(classifyLive(net(), 1400, 50).note, 'data 400 s old');
  assert.equal(classifyLive(net(), 1400, 50).status, 'down');
  assert.equal(classifyLive(net({ aircraft: 300 }), 1005, 50).status, 'degraded');
  assert.equal(classifyLive(null, 1005, null).status, 'down');
  assert.equal(classifyLive(net({ now: null }), 1005, 50).status, 'down');
});

test('feeders: judged against their own median, unknown is not zero', () => {
  assert.equal(classifyCount('feeders', 2600, 2700).status, 'up');
  assert.equal(classifyCount('feeders', 1500, 2700).status, 'degraded');
  assert.equal(classifyCount('feeders', 500, 2700).status, 'down');
  assert.equal(classifyCount('feeders', 0, null).status, 'down');
  assert.equal(classifyCount('feeders', 40, null).status, 'up');           // first day: no median yet
  assert.equal(classifyCount('feeders', null, 2700).status, 'degraded');
});

test('mlat: a missing shard degrades, none readable is down', () => {
  assert.equal(classifyCount('mlat', 1650, 1600, 5, 5).status, 'up');
  const r = classifyCount('mlat', 1300, 1600, 4, 5);
  assert.equal(r.status, 'degraded');
  assert.equal(r.note, '4/5 MLAT shards');
  assert.equal(classifyCount('mlat', null, 1600, 0, 5).status, 'down');
});

test('helpers', () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(worst('up', 'degraded'), 'degraded');
  assert.equal(worst('degraded', 'down'), 'down');
  assert.equal(utcDay(1792713600), '2026-10-23');
});

test('next pass: 2 s into the next minute, whatever the time now', () => {
  const m = Date.UTC(2026, 9, 23, 13, 40);
  assert.equal(nextPass(m), m + 62_000);
  assert.equal(nextPass(m + 1_999), m + 62_000);
  assert.equal(nextPass(m + 59_999), m + 62_000);
  // A pass that ran long into its minute still schedules the next one, not one an hour away.
  assert.equal(nextPass(m + 60_000), m + 122_000);
});
