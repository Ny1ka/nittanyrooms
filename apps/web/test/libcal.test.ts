import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import {
  AvailabilityPayload,
  BOOKED_CLASS,
  LIBCAL_GRID_URL,
  SUCCESS_CACHE,
  TEMP_BROWSER_UA,
  gridRequestBody,
  handleAvailability,
  parseGrid,
} from '../api/_lib/libcal';

const DATE = '2026-11-23';
const NOW = DateTime.fromISO(`${DATE}T08:00`, { zone: 'America/New_York' }).toMillis();
const ms = (hhmm: string, date = DATE) =>
  DateTime.fromISO(`${date}T${hhmm}`, { zone: 'America/New_York' }).toMillis();

/** Build 15-minute slots like LibCal's grid. */
function slots(itemId: number, from: string, to: string, booked: string[] = []) {
  const out = [];
  let t = DateTime.fromISO(`${DATE}T${from}`);
  const end = DateTime.fromISO(`${DATE}T${to}`);
  while (t < end) {
    const n = t.plus({ minutes: 15 });
    const s = { start: t.toFormat('yyyy-MM-dd HH:mm:ss'), end: n.toFormat('yyyy-MM-dd HH:mm:ss'), itemId, checksum: 'x' };
    out.push(booked.includes(t.toFormat('HH:mm')) ? { ...s, className: BOOKED_CLASS } : s);
    t = n;
  }
  return out;
}

describe('parseGrid', () => {
  it('turns slots into merged open hours and booked intervals per room', () => {
    const raw = {
      slots: [...slots(8577, '09:00', '17:00', ['12:00', '12:15', '12:30', '12:45']), ...slots(8246, '12:00', '13:00')],
      bookings: [],
    };
    const p = parseGrid(raw, DATE, NOW);
    expect(AvailabilityPayload.parse(p)).toBeTruthy();
    expect(p.items['8577']).toEqual({ open: [[ms('09:00'), ms('17:00')]], busy: [[ms('12:00'), ms('13:00')]] });
    expect(p.items['8246']!.busy).toEqual([]);
    expect(p.complete).toBe(true);
  });

  it('drops slots from other dates and malformed times', () => {
    const raw = {
      slots: [
        { start: '2026-11-24 09:00:00', end: '2026-11-24 09:15:00', itemId: 1 },
        { start: 'nonsense', end: '2026-11-23 09:15:00', itemId: 2 },
        { start: '2026-11-23 10:00:00', end: '2026-11-23 10:15:00', itemId: 3 },
      ],
    };
    expect(Object.keys(parseGrid(raw, DATE, NOW).items)).toEqual(['3']);
  });

  it('rejects responses that are not the expected shape', () => {
    expect(() => parseGrid({ nope: true }, DATE, NOW)).toThrow();
    expect(() => parseGrid({ slots: [{ start: 1 }] }, DATE, NOW)).toThrow();
  });

  it('interprets LibCal local times in America/New_York across DST', () => {
    const raw = { slots: [{ start: '2026-11-01 01:30:00', end: '2026-11-01 01:45:00', itemId: 9 }] };
    const p = parseGrid(raw, '2026-11-01', NOW);
    expect(p.items['9']!.open[0]![1] - p.items['9']!.open[0]![0]).toBe(15 * 60_000);
  });
});

describe('gridRequestBody', () => {
  it('requests exactly one campus date (end is exclusive)', () => {
    const b = gridRequestBody(DATE);
    expect(b.get('start')).toBe('2026-11-23');
    expect(b.get('end')).toBe('2026-11-24');
    expect(b.get('lid')).toBe('428');
  });
});

describe('handleAvailability', () => {
  const ok = () => new Response(JSON.stringify({ slots: slots(8577, '09:00', '10:00') }), { status: 200 });
  const req = (q: string) => new Request(`https://x.test/api/availability${q}`);

  it('returns parsed availability with CDN cache headers', async () => {
    const fetch = vi.fn(async () => ok());
    const res = await handleAvailability(req(`?date=${DATE}`), { fetch, env: {}, now: () => NOW });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(SUCCESS_CACHE);
    const body = AvailabilityPayload.parse(await res.json());
    expect(body.items['8577']!.open).toEqual([[ms('09:00'), ms('10:00')]]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(LIBCAL_GRID_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['user-agent']).toBe(TEMP_BROWSER_UA);
  });

  it('uses LIBCAL_USER_AGENT when set', async () => {
    const fetch = vi.fn(async () => ok());
    await handleAvailability(req(`?date=${DATE}`), { fetch, env: { LIBCAL_USER_AGENT: 'NittanyRooms/0.1' }, now: () => NOW });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['user-agent']).toBe('NittanyRooms/0.1');
  });

  it('kill switch returns 503 without calling LibCal', async () => {
    const fetch = vi.fn();
    const res = await handleAvailability(req(`?date=${DATE}`), { fetch, env: { LIBCAL_LIVE: 'off' }, now: () => NOW });
    expect(res.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('validates the date and the booking horizon', async () => {
    const fetch = vi.fn();
    const deps = { fetch, env: {}, now: () => NOW };
    expect((await handleAvailability(req(''), deps)).status).toBe(400);
    expect((await handleAvailability(req('?date=2026-13-40'), deps)).status).toBe(400);
    expect((await handleAvailability(req('?date=2026-11-22'), deps)).status).toBe(400); // past
    expect((await handleAvailability(req('?date=2026-12-08'), deps)).status).toBe(400); // > 14 days
    expect((await handleAvailability(req('?date=2026-12-07'), { ...deps, fetch: vi.fn(async () => ok()) })).status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('memo serves repeat requests without calling LibCal again until it expires', async () => {
    const fetch = vi.fn(async () => ok());
    const memo = new Map();
    let t = NOW;
    const deps = { fetch, env: {}, memo, now: () => t };
    await handleAvailability(req(`?date=${DATE}`), deps);
    await handleAvailability(req(`?date=${DATE}`), deps);
    expect(fetch).toHaveBeenCalledTimes(1);
    t += 121_000;
    await handleAvailability(req(`?date=${DATE}`), deps);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('maps upstream failures to 502 with a short cache', async () => {
    const deps = (f: () => Promise<Response>) => ({ fetch: vi.fn(f), env: {}, now: () => NOW });
    const r1 = await handleAvailability(req(`?date=${DATE}`), deps(async () => new Response('', { status: 503 })));
    expect(r1.status).toBe(502);
    expect(r1.headers.get('cache-control')).toContain('s-maxage=30');
    const r2 = await handleAvailability(req(`?date=${DATE}`), deps(async () => new Response('<html>', { status: 200 })));
    expect(r2.status).toBe(502);
    const r3 = await handleAvailability(req(`?date=${DATE}`), deps(async () => { throw new Error('ECONNRESET'); }));
    expect(r3.status).toBe(502);
  });
});
