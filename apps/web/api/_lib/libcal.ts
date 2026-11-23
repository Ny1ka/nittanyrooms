/**
 * Penn State LibCal availability adapter (server-side).
 *
 * Reads the same public JSON endpoint LibCal's own "Reserve a Study Room" page
 * uses (POST /spaces/availability/grid). No credentials and no personal data:
 * the response is 15-minute slots per room, booked ones marked with a class.
 * See docs/research/LIBCAL_GRID_TEST.md.
 *
 * Self-contained on purpose (zod + luxon only) so Vercel can bundle it as a
 * function without compiling workspace TypeScript.
 */
import { DateTime } from 'luxon';
import { z } from 'zod';

export const CAMPUS_TIMEZONE = 'America/New_York';
export const LIBCAL_ORIGIN = 'https://psu.libcal.com';
export const LIBCAL_GRID_URL = `${LIBCAL_ORIGIN}/spaces/availability/grid`;
/** "University Park - Study Space" location; covers every UP library room. */
export const LIBCAL_UP_LID = '428';
/** Slot class LibCal uses for time that can't be booked (reserved). */
export const BOOKED_CLASS = 's-lc-eq-checkout';
/** How far ahead LibCal lets students book (policy UL-ADG16). */
export const BOOKING_HORIZON_DAYS = 14;

/**
 * TEMPORARY: browser-like User-Agent used while proving the route works, at the
 * project owner's request. Replace with an honest identifier, e.g.
 * "NittanyRooms/0.1 (+https://github.com/Ny1ka/nittanyrooms)", via
 * LIBCAL_USER_AGENT before public launch. See docs/research/LIBCAL_GRID_TEST.md.
 */
export const TEMP_BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// ---------- Untrusted upstream response ----------

const Slot = z.object({
  start: z.string(),
  end: z.string(),
  itemId: z.number().int(),
  className: z.string().optional(),
});
export const GridResponse = z.object({ slots: z.array(Slot) });

// ---------- Wire contract between our API and the browser ----------

const Pair = z.tuple([z.number(), z.number()]);
export const AvailabilityPayload = z.object({
  provider: z.literal('psul-libcal'),
  date: z.iso.date(),
  timezone: z.literal(CAMPUS_TIMEZONE),
  /** ISO timestamp when we fetched from LibCal. */
  retrievedAt: z.iso.datetime(),
  /** LibCal returns every bookable slot (booked ones included), so this is complete. */
  complete: z.literal(true),
  /** Keyed by LibCal space id (eid). A room absent here had no bookable slots that day. */
  items: z.record(
    z.string(),
    z.object({
      /** Bookable hours: union of all slots, [startMs, endMs) pairs. */
      open: z.array(Pair),
      /** Booked slots, merged. */
      busy: z.array(Pair),
    }),
  ),
  source: z.url(),
});
export type AvailabilityPayload = z.infer<typeof AvailabilityPayload>;

// ---------- Helpers ----------

type Interval = [number, number];

function merge(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function campusToday(now: number): string {
  return DateTime.fromMillis(now, { zone: CAMPUS_TIMEZONE }).toISODate()!;
}

export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: CAMPUS_TIMEZONE }).plus({ days }).toISODate()!;
}

/** Form body exactly as LibCal's page sends it, for one campus date. */
export function gridRequestBody(date: string): URLSearchParams {
  return new URLSearchParams({
    lid: LIBCAL_UP_LID,
    gid: '0',
    eid: '-1',
    seat: 'false',
    seatId: '0',
    zone: '0',
    start: date,
    end: addDays(date, 1), // exclusive
    pageIndex: '0',
    pageSize: '10000',
  });
}

/** Parse LibCal's grid JSON into per-room open/busy intervals for `date`. Throws on bad shape. */
export function parseGrid(raw: unknown, date: string, retrievedAt: number): AvailabilityPayload {
  const { slots } = GridResponse.parse(raw);
  const open = new Map<number, Interval[]>();
  const busy = new Map<number, Interval[]>();
  for (const s of slots) {
    const start = DateTime.fromFormat(s.start, 'yyyy-MM-dd HH:mm:ss', { zone: CAMPUS_TIMEZONE });
    const end = DateTime.fromFormat(s.end, 'yyyy-MM-dd HH:mm:ss', { zone: CAMPUS_TIMEZONE });
    if (!start.isValid || !end.isValid || end <= start) continue;
    if (start.toISODate() !== date) continue; // only the requested campus date
    const pair: Interval = [start.toMillis(), end.toMillis()];
    (open.get(s.itemId) ?? open.set(s.itemId, []).get(s.itemId)!).push(pair);
    if (s.className?.split(/\s+/).includes(BOOKED_CLASS)) {
      (busy.get(s.itemId) ?? busy.set(s.itemId, []).get(s.itemId)!).push(pair);
    }
  }
  const items: AvailabilityPayload['items'] = {};
  for (const [eid, list] of open) {
    items[String(eid)] = { open: merge(list), busy: merge(busy.get(eid) ?? []) };
  }
  return {
    provider: 'psul-libcal',
    date,
    timezone: CAMPUS_TIMEZONE,
    retrievedAt: new Date(retrievedAt).toISOString(),
    complete: true,
    items,
    source: `${LIBCAL_ORIGIN}/spaces?lid=${LIBCAL_UP_LID}&gid=0`,
  };
}

// ---------- HTTP handler (Web Request/Response) ----------

export interface HandlerDeps {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  now?: () => number;
  /**
   * Optional per-instance memo (date → payload). Backs up the CDN cache so a
   * warm function instance never calls LibCal more than once per MEMO_TTL_MS.
   */
  memo?: Map<string, { expires: number; payload: AvailabilityPayload }>;
}

export const MEMO_TTL_MS = 120_000;

const json = (body: unknown, status: number, cache: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  });

/** CDN caches success for 3 min (+2 min stale) so LibCal sees ~1 request per date per few minutes. */
export const SUCCESS_CACHE = 'public, max-age=60, s-maxage=180, stale-while-revalidate=120';
const ERROR_CACHE = 'public, max-age=0, s-maxage=30';

export async function handleAvailability(request: Request, deps: HandlerDeps): Promise<Response> {
  const now = deps.now?.() ?? Date.now();
  if ((deps.env.LIBCAL_LIVE ?? 'on').toLowerCase() === 'off') {
    return json({ error: 'disabled', message: 'Live library availability is turned off.' }, 503, 'public, s-maxage=60');
  }

  const date = new URL(request.url).searchParams.get('date') ?? '';
  const today = campusToday(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !DateTime.fromISO(date).isValid) {
    return json({ error: 'bad-request', message: 'date must be YYYY-MM-DD' }, 400, 'no-store');
  }
  if (date < today || date > addDays(today, BOOKING_HORIZON_DAYS)) {
    return json(
      { error: 'out-of-range', message: `date must be between ${today} and ${addDays(today, BOOKING_HORIZON_DAYS)}` },
      400,
      'no-store',
    );
  }

  const result = await loadPayload(date, deps, now);
  if ('error' in result) {
    return json({ error: result.error, ...(result.status ? { status: result.status } : {}) }, 502, ERROR_CACHE);
  }
  return json(result.payload, 200, SUCCESS_CACHE);
}

/**
 * Fetch and parse one campus date from LibCal (memoized per instance).
 * Shared by the availability API and the notification checker.
 */
export async function loadPayload(
  date: string,
  deps: HandlerDeps,
  now = deps.now?.() ?? Date.now(),
): Promise<{ payload: AvailabilityPayload } | { error: string; status?: number }> {
  const hit = deps.memo?.get(date);
  if (hit && hit.expires > now) return { payload: hit.payload };
  let upstream: Response;
  try {
    upstream = await deps.fetch(LIBCAL_GRID_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: LIBCAL_ORIGIN,
        referer: `${LIBCAL_ORIGIN}/spaces?lid=${LIBCAL_UP_LID}&gid=0`,
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': deps.env.LIBCAL_USER_AGENT || TEMP_BROWSER_UA,
      },
      body: gridRequestBody(date),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { error: 'upstream-unreachable' };
  }
  if (!upstream.ok) return { error: 'upstream-status', status: upstream.status };
  try {
    const payload = parseGrid(await upstream.json(), date, now);
    deps.memo?.set(date, { expires: now + MEMO_TTL_MS, payload });
    return { payload };
  } catch {
    return { error: 'upstream-shape' };
  }
}
