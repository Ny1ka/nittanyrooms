import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import type { Redis, RedisCmd } from '../api/_lib/redis';
import { checkWatches, createWatch, deleteWatch, findSlot, freeIntervals, MAX_WATCHES_PER_SUBSCRIPTION } from '../api/_lib/watches';

/** In-memory stand-in for the Upstash commands we use. */
function fakeRedis(): Redis & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  const set = (k: string) => ((store.get(k) as Set<string>) ?? store.set(k, new Set<string>()).get(k)) as Set<string>;
  const run = (c: RedisCmd): unknown => {
    const [op, k, ...rest] = c.map(String) as [string, string, ...string[]];
    switch (op) {
      case 'SET': store.set(k, rest[0]); return 'OK';
      case 'GET': return (store.get(k) as string) ?? null;
      case 'DEL': return store.delete(k) ? 1 : 0;
      case 'SADD': rest.forEach((v) => set(k).add(v)); return 1;
      case 'SREM': rest.forEach((v) => set(k).delete(v)); return 1;
      case 'SMEMBERS': return [...set(k)];
      case 'SCARD': return set(k).size;
      case 'EXPIREAT': return 1;
      default: throw new Error(`unsupported ${op}`);
    }
  };
  return { store, cmd: async (...a) => run(a), pipeline: async (cs) => cs.map(run) };
}

const ms = (hhmm: string, date = '2026-11-23') => DateTime.fromISO(`${date}T${hhmm}`, { zone: 'America/New_York' }).toMillis();
const NOW = ms('13:00');
const sub = { endpoint: 'https://push.example.com/abc123', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } };
const watch = (over = {}) => ({ subscription: sub, roomId: 'pattee-w101b', roomName: 'Pattee W101B', buildingId: 'pattee-paterno', eid: '8573', date: '2026-11-23', after: NOW, minMinutes: 30, ...over });

describe('watch storage', () => {
  it('creates, enforces limits and validation, and deletes only with the token', async () => {
    const r = fakeRedis();
    const c = await createWatch(r, watch(), NOW);
    expect(c.ok).toBe(true);
    expect((await createWatch(r, watch({ date: '2026-12-31' }), NOW)).ok).toBe(false); // beyond 14-day horizon
    expect((await createWatch(r, watch({ subscription: { ...sub, endpoint: 'http://insecure' } }), NOW)).ok).toBe(false);
    expect((await createWatch(r, watch({ minMinutes: 5 }), NOW)).ok).toBe(false);
    for (let i = 1; i < MAX_WATCHES_PER_SUBSCRIPTION; i++) await createWatch(r, watch(), NOW);
    expect(await createWatch(r, watch(), NOW)).toEqual({ ok: false, status: 429, error: 'too-many-watches' });
    if (!c.ok) throw new Error();
    expect(await deleteWatch(r, c.id, 'wrong')).toBe(false);
    expect(await deleteWatch(r, c.id, c.token)).toBe(true);
    expect(r.store.has(`nr:watch:${c.id}`)).toBe(false);
  });
});

describe('slot matching', () => {
  it('subtracts bookings from bookable hours and applies the 30-min slack and length', () => {
    const free = freeIntervals({ open: [[ms('09:00'), ms('17:00')]], busy: [[ms('12:00'), ms('13:15')]] });
    expect(free).toEqual([[ms('09:00'), ms('12:00')], [ms('13:15'), ms('17:00')]]);
    expect(findSlot(free, { after: NOW, minMinutes: 30 }, NOW)).toEqual([ms('13:15'), ms('17:00')]);
    expect(findSlot([[ms('16:00'), ms('17:00')]], { after: NOW, minMinutes: 30 }, NOW)).toBeNull(); // too late
    expect(findSlot([[ms('13:00'), ms('13:20')]], { after: NOW, minMinutes: 30 }, NOW)).toBeNull(); // too short
  });
});

describe('checkWatches', () => {
  const payload = (busy: [number, number][]) => ({
    provider: 'psul-libcal', date: '2026-11-23', timezone: 'America/New_York', retrievedAt: new Date(NOW).toISOString(), complete: true,
    items: { '8573': { open: [[ms('09:00'), ms('17:00')]], busy } }, source: 'https://psu.libcal.com/spaces?lid=428&gid=0',
  });
  const deps = (busy: [number, number][]) => ({
    env: {},
    fetch: vi.fn(async () => new Response(JSON.stringify({ slots: [] }))) as unknown as typeof fetch,
    memo: new Map([['2026-11-23', { expires: NOW + 60_000, payload: payload(busy) as never }]]),
  });

  it('does nothing while the room is still busy, then pushes once and deletes when it frees up', async () => {
    const r = fakeRedis();
    await createWatch(r, watch(), NOW);
    const push = { send: vi.fn(async () => ({ statusCode: 201 })) };
    expect((await checkWatches(r, push, deps([[ms('12:00'), ms('16:00')]]), 'https://site', NOW)).sent).toBe(0);
    const res = await checkWatches(r, push, deps([[ms('12:00'), ms('13:15')]]), 'https://site', NOW);
    expect(res).toMatchObject({ sent: 1, removed: 1 });
    const body = JSON.parse((push.send.mock.calls[0] as unknown as [unknown, string])[1]);
    expect(body.title).toBe('Pattee W101B just opened up');
    expect(body.url).toBe('https://site/b/pattee-paterno?room=pattee-w101b&d=2026-11-23');
    expect((await checkWatches(r, push, deps([[ms('12:00'), ms('13:15')]]), 'https://site', NOW)).sent).toBe(0); // fired once
  });

  it('removes watches whose subscription is gone (410) and keeps them on transient errors', async () => {
    const r = fakeRedis();
    await createWatch(r, watch(), NOW);
    const gone = { send: vi.fn(async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); }) };
    expect((await checkWatches(r, gone, deps([]), 'https://site', NOW)).removed).toBe(1);
    await createWatch(r, watch(), NOW);
    const flaky = { send: vi.fn(async () => { throw Object.assign(new Error('busy'), { statusCode: 503 }); }) };
    const res = await checkWatches(r, flaky, deps([]), 'https://site', NOW);
    expect(res.removed).toBe(0);
    expect(res.errors).toContain('push 503');
  });
});
