import { test as base, expect, type Page, type Route } from '@playwright/test';
import { DateTime } from 'luxon';

/** Frozen "now": Monday Nov 23 2026, 1:00 PM campus time. */
export const NOW = DateTime.fromISO('2026-11-23T13:00:00', { zone: 'America/New_York' });
export const TODAY = NOW.toISODate()!;

type Spec = { open: [string, string][]; busy?: [string, string][] };

/** LibCal space ids (eid) from data/rooms.json → schedule on any requested date. */
export const SCHEDULE: Record<string, Spec> = {
  '8577': { open: [['09:00', '17:00']] }, // Pattee W120: open all day
  '30978': { open: [['09:00', '17:00']], busy: [['09:00', '11:00'], ['14:00', '17:00']] }, // Paterno E128A: open 11–2
  '8573': { open: [['09:00', '17:00']], busy: [['12:00', '16:00']] }, // Pattee W101B: occupied until 4
  '8572': { open: [['09:00', '17:00']], busy: [['12:00', '13:30']] }, // Pattee W101A: opens 1:30
  '8251': { open: [['09:00', '15:00']] }, // Deike 105A
  // Davey rooms deliberately absent → not bookable that day
};

const ms = (date: string, hhmm: string) => DateTime.fromISO(`${date}T${hhmm}`, { zone: 'America/New_York' }).toMillis();

export function payload(date: string, opts: { retrievedAt?: DateTime } = {}) {
  const items: Record<string, { open: [number, number][]; busy: [number, number][] }> = {};
  for (const [eid, s] of Object.entries(SCHEDULE)) {
    items[eid] = {
      open: s.open.map(([a, b]) => [ms(date, a), ms(date, b)]),
      busy: (s.busy ?? []).map(([a, b]) => [ms(date, a), ms(date, b)]),
    };
  }
  return {
    provider: 'psul-libcal',
    date,
    timezone: 'America/New_York',
    retrievedAt: (opts.retrievedAt ?? NOW.minus({ minutes: 1 })).toUTC().toISO(),
    complete: true,
    items,
    source: 'https://psu.libcal.com/spaces?lid=428&gid=0',
  };
}

export type ApiMode = 'ok' | 'error' | 'disabled' | 'stale';

export async function mockApi(page: Page, mode: ApiMode = 'ok') {
  const calls: string[] = [];
  await page.route('**/api/availability?*', async (route: Route) => {
    const date = new URL(route.request().url()).searchParams.get('date')!;
    calls.push(date);
    if (mode === 'error') return route.fulfill({ status: 502, json: { error: 'upstream-status', status: 503 } });
    if (mode === 'disabled') return route.fulfill({ status: 503, json: { error: 'disabled' } });
    const body = mode === 'stale' ? payload(date, { retrievedAt: NOW.minus({ minutes: 40 }) }) : payload(date);
    return route.fulfill({ status: 200, json: body });
  });
  return calls;
}

/** Block map tiles/styles so tests never depend on OpenFreeMap. */
async function blockMap(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (r) => r.abort());
}

export const test = base.extend<{ api: string[]; apiMode: ApiMode }>({
  apiMode: ['ok', { option: true }],
  api: async ({ page, apiMode }, use) => {
    await page.clock.setFixedTime(NOW.toJSDate());
    await blockMap(page);
    const calls = await mockApi(page, apiMode);
    await use(calls);
  },
});

export { expect };
