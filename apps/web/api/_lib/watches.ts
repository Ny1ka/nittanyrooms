/**
 * Server-side "notify me when it opens" (Web Push).
 *
 * Stored per watch (Redis, auto-expires the day after): room/time/length and the
 * browser's push subscription (an anonymous endpoint + keys, no personal data).
 * A scheduler calls the checker every few minutes; matching watches get one push
 * and are deleted. See docs/ARCHITECTURE.md "Notifications".
 */
import { createHash, randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { addDays, BOOKING_HORIZON_DAYS, CAMPUS_TIMEZONE, campusToday, loadPayload, type AvailabilityPayload, type HandlerDeps } from './libcal.js';
import type { Redis } from './redis.js';

/** A slot counts if it starts within this long of the requested time. Keep in sync with the client. */
export const WATCH_SLACK_MINUTES = 30;
/** Abuse limit: active watches per browser subscription. */
export const MAX_WATCHES_PER_SUBSCRIPTION = 10;

const Subscription = z.object({
  endpoint: z.url().refine((u) => u.startsWith('https://'), 'push endpoint must be https'),
  keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }),
});

export const NewWatch = z.object({
  subscription: Subscription,
  roomId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  roomName: z.string().min(1).max(80),
  buildingId: z.string().regex(/^[a-z0-9-]{1,60}$/),
  /** LibCal space id. */
  eid: z.string().regex(/^\d{1,9}$/),
  date: z.iso.date(),
  after: z.number().int(),
  minMinutes: z.number().int().min(15).max(180),
});
export type NewWatch = z.infer<typeof NewWatch>;

export interface StoredWatch extends NewWatch {
  id: string;
  token: string;
  createdAt: number;
}

export interface PushSender {
  send: (sub: z.infer<typeof Subscription>, payload: string) => Promise<{ statusCode: number }>;
}

const K = {
  watch: (id: string) => `nr:watch:${id}`,
  date: (d: string) => `nr:watches:${d}`,
  dates: 'nr:watchdates',
  sub: (endpoint: string) => `nr:sub:${createHash('sha256').update(endpoint).digest('hex').slice(0, 32)}`,
};

/** Unix seconds when a watch for `date` should vanish (end of the next campus day). */
const expiresAt = (date: string) =>
  Math.floor(DateTime.fromISO(date, { zone: CAMPUS_TIMEZONE }).plus({ days: 2 }).startOf('day').toSeconds());

export async function createWatch(redis: Redis, input: unknown, now = Date.now()): Promise<{ ok: true; id: string; token: string } | { ok: false; status: number; error: string }> {
  const parsed = NewWatch.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: 'invalid-watch' };
  const w = parsed.data;
  const today = campusToday(now);
  if (w.date < today || w.date > addDays(today, BOOKING_HORIZON_DAYS)) return { ok: false, status: 400, error: 'date-out-of-range' };
  const subKey = K.sub(w.subscription.endpoint);
  const count = Number(await redis.cmd('SCARD', subKey));
  if (count >= MAX_WATCHES_PER_SUBSCRIPTION) return { ok: false, status: 429, error: 'too-many-watches' };
  const id = randomBytes(9).toString('base64url');
  const token = randomBytes(18).toString('base64url');
  const stored: StoredWatch = { ...w, id, token, createdAt: now };
  const exp = expiresAt(w.date);
  await redis.pipeline([
    ['SET', K.watch(id), JSON.stringify(stored), 'EXAT', exp],
    ['SADD', K.date(w.date), id],
    ['EXPIREAT', K.date(w.date), exp],
    ['SADD', K.dates, w.date],
    ['SADD', subKey, id],
    ['EXPIREAT', subKey, exp],
  ]);
  return { ok: true, id, token };
}

export async function deleteWatch(redis: Redis, id: string, token: string): Promise<boolean> {
  const raw = (await redis.cmd('GET', K.watch(id))) as string | null;
  if (!raw) return true; // already gone
  const w = JSON.parse(raw) as StoredWatch;
  if (w.token !== token) return false;
  await removeWatch(redis, w);
  return true;
}

async function removeWatch(redis: Redis, w: StoredWatch) {
  await redis.pipeline([
    ['DEL', K.watch(w.id)],
    ['SREM', K.date(w.date), w.id],
    ['SREM', K.sub(w.subscription.endpoint), w.id],
  ]);
}

type Pair = [number, number];

/** Free intervals = bookable hours minus booked time (both from LibCal). */
export function freeIntervals(item: { open: Pair[]; busy: Pair[] } | undefined): Pair[] {
  if (!item) return [];
  const out: Pair[] = [];
  for (const [a, b] of item.open) {
    let cursor = a;
    for (const [x, y] of [...item.busy].sort((p, q) => p[0] - q[0])) {
      if (y <= cursor || x >= b) continue;
      if (x > cursor) out.push([cursor, x]);
      cursor = Math.max(cursor, y);
    }
    if (cursor < b) out.push([cursor, b]);
  }
  return out;
}

/** The first free slot that starts within the slack of `after` and stays free long enough. */
export function findSlot(free: Pair[], w: Pick<NewWatch, 'after' | 'minMinutes'>, now: number): Pair | null {
  const from = Math.max(w.after, now);
  for (const [a, b] of free) {
    if (b <= from || a > w.after + WATCH_SLACK_MINUTES * 60_000) continue;
    if ((b - Math.max(a, from)) / 60_000 >= w.minMinutes) return [Math.max(a, from), b];
  }
  return null;
}

const fmt = (t: number) => DateTime.fromMillis(t, { zone: CAMPUS_TIMEZONE }).toFormat('h:mm a');

export interface CheckResult {
  checked: number;
  sent: number;
  removed: number;
  errors: string[];
}

/** Check every active watch; push and delete the ones whose room has opened up. */
export async function checkWatches(redis: Redis, push: PushSender, deps: HandlerDeps, siteUrl: string, now = Date.now()): Promise<CheckResult> {
  const result: CheckResult = { checked: 0, sent: 0, removed: 0, errors: [] };
  const today = campusToday(now);
  const dates = ((await redis.cmd('SMEMBERS', K.dates)) as string[] | null) ?? [];
  for (const date of dates.sort()) {
    if (date < today) {
      await redis.cmd('SREM', K.dates, date); // keys expire on their own
      continue;
    }
    const ids = ((await redis.cmd('SMEMBERS', K.date(date))) as string[] | null) ?? [];
    if (ids.length === 0) {
      await redis.cmd('SREM', K.dates, date);
      continue;
    }
    const loaded = await loadPayload(date, deps, now);
    if ('error' in loaded) {
      result.errors.push(`${date}: ${loaded.error}`);
      continue;
    }
    const payload: AvailabilityPayload = loaded.payload;
    const raws = (await redis.pipeline(ids.map((id) => ['GET', K.watch(id)]))) as (string | null)[];
    for (let i = 0; i < ids.length; i++) {
      const raw = raws[i];
      if (!raw) {
        await redis.cmd('SREM', K.date(date), ids[i]!);
        continue;
      }
      const w = JSON.parse(raw) as StoredWatch;
      result.checked++;
      const item = payload.items[w.eid] as { open: Pair[]; busy: Pair[] } | undefined;
      const slot = findSlot(freeIntervals(item), w, now);
      if (!slot) {
        if (w.after + WATCH_SLACK_MINUTES * 60_000 < now) {
          await removeWatch(redis, w); // the moment has passed
          result.removed++;
        }
        continue;
      }
      const url = `${siteUrl}/b/${w.buildingId}?${new URLSearchParams({ room: w.roomId, d: w.date })}`;
      const body = JSON.stringify({
        title: `${w.roomName} just opened up`,
        body: `${fmt(slot[0])} – ${fmt(slot[1])}${w.date === today ? ' today' : ''}. Tap to book on Penn State's site.`,
        url,
        tag: w.id,
      });
      try {
        await push.send(w.subscription, body);
        result.sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code !== 404 && code !== 410) {
          result.errors.push(`push ${code ?? 'error'}`);
          continue; // transient: try again next run
        }
      }
      await removeWatch(redis, w); // fired, or the subscription is gone
      result.removed++;
    }
  }
  return result;
}
