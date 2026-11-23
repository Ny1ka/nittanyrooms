import { describe, expect, it } from 'vitest';
import {
  computeDay,
  dayBounds,
  intersect,
  localTime,
  operatingWindow,
  statusAt,
  type DayInput,
  type Interval,
  type PolicyRules,
  type ProviderSnapshot,
} from '../src/index.js';

const DATE = '2026-11-23'; // Monday, EST (UTC-5)
const t = (hhmm: string, date = DATE) => localTime(date, hhmm);
const iv = (a: string, b: string, date = DATE): Interval => ({ start: t(a, date), end: t(b, date) });
const HOURS = [iv('08:00', '22:00')];

const policy: PolicyRules = {
  minDurationMinutes: 30,
  maxDurationMinutes: 180,
  startIncrementMinutes: 30,
  leadTimeMinutes: 0,
  minUsefulGapMinutes: 30,
};

function snap(busy: Interval[], over: Partial<ProviderSnapshot> = {}): ProviderSnapshot {
  return {
    roomId: 'r',
    providerId: 'p',
    coverage: dayBounds(DATE),
    complete: true,
    retrievedAt: t('07:00'),
    busy,
    ...over,
  };
}

function run(over: Partial<DayInput> & { busy?: Interval[] } = {}) {
  const { busy = [], ...rest } = over;
  return computeDay({
    date: DATE,
    openHours: HOURS,
    snapshot: snap(busy),
    policy,
    now: t('07:30'),
    staleAfterMinutes: 24 * 60,
    ...rest,
  });
}

const windows = (d: ReturnType<typeof computeDay>) =>
  d.windows.map((w) => [w.start, w.end]);
const kinds = (d: ReturnType<typeof computeDay>, kind: string) =>
  d.segments.filter((s) => s.kind === kind).map((s) => [s.start, s.end]);

describe('availability engine — basic schedules', () => {
  it('no bookings during building hours → one window for the whole open day', () => {
    const d = run();
    expect(windows(d)).toEqual([[t('08:00'), t('22:00')]]);
    expect(kinds(d, 'closed')).toEqual([
      [t('00:00'), t('08:00')],
      [t('22:00'), dayBounds(DATE).end],
    ]);
  });

  it('one booking in the middle of the day splits the window', () => {
    const d = run({ busy: [iv('12:00', '13:00')] });
    expect(windows(d)).toEqual([
      [t('08:00'), t('12:00')],
      [t('13:00'), t('22:00')],
    ]);
    expect(kinds(d, 'occupied')).toEqual([[t('12:00'), t('13:00')]]);
  });

  it('back-to-back bookings merge into one occupied block', () => {
    const d = run({ busy: [iv('10:00', '11:00'), iv('11:00', '12:00')] });
    expect(kinds(d, 'occupied')).toEqual([[t('10:00'), t('12:00')]]);
    expect(d.filtered).toEqual([]);
  });

  it('overlapping and duplicate bookings are merged', () => {
    const d = run({
      busy: [iv('10:00', '11:30'), iv('11:00', '12:00'), iv('11:00', '12:00')],
    });
    expect(kinds(d, 'occupied')).toEqual([[t('10:00'), t('12:00')]]);
  });
});

describe('availability engine — useful gap filtering', () => {
  it('filters 10, 15 and 20 minute gaps at a 30-minute threshold', () => {
    const d = run({
      busy: [
        iv('08:00', '10:00'),
        iv('10:10', '11:00'),
        iv('11:15', '12:00'),
        iv('12:20', '22:00'),
      ],
    });
    expect(d.windows).toEqual([]);
    expect(d.filtered.map((f) => f.reason)).toEqual(['too-short', 'too-short', 'too-short']);
    expect(d.filtered.map((f) => f.raw.end - f.raw.start)).toEqual([10, 15, 20].map((m) => m * 60_000));
  });

  it('keeps a gap of exactly 30 minutes', () => {
    const d = run({ busy: [iv('08:00', '10:00'), iv('10:30', '22:00')] });
    expect(windows(d)).toEqual([[t('10:00'), t('10:30')]]);
    expect(d.windows[0]!.startTimes).toEqual([t('10:00')]);
  });

  it('a 45-minute gap with 30-minute minimum yields only starts that fit', () => {
    const d = run({ busy: [iv('08:00', '10:00'), iv('10:45', '22:00')] });
    expect(windows(d)).toEqual([[t('10:00'), t('10:45')]]);
    expect(d.windows[0]!.startTimes).toEqual([t('10:00')]);
    const fine = run({
      busy: [iv('08:00', '10:00'), iv('10:45', '22:00')],
      policy: { ...policy, startIncrementMinutes: 15 },
    });
    expect(fine.windows[0]!.startTimes).toEqual([t('10:00'), t('10:15')]);
  });

  it('"show shorter openings" can lower the threshold but never below the provider minimum', () => {
    const busy = [iv('08:00', '10:00'), iv('10:15', '22:00')];
    const p15 = { ...policy, minDurationMinutes: 15, startIncrementMinutes: 15 };
    expect(run({ busy, policy: p15 }).windows).toHaveLength(0);
    expect(run({ busy, policy: p15, minUsefulGapMinutes: 15 }).windows).toHaveLength(1);
    // Provider minimum is 30, so a 15-minute override still hides it.
    expect(run({ busy, minUsefulGapMinutes: 15 }).windows).toHaveLength(0);
  });

  it('room closing before building closing clips availability', () => {
    const roomHours = [iv('08:00', '18:00')];
    const d = run({ openHours: intersect(HOURS, roomHours) });
    expect(windows(d)).toEqual([[t('08:00'), t('18:00')]]);
    expect(kinds(d, 'closed').at(-1)![0]).toBe(t('18:00'));
  });
});

describe('availability engine — time rules', () => {
  it('current time partway through a free interval moves the start to the next increment', () => {
    const d = run({ now: t('14:10') });
    expect(windows(d)).toEqual([[t('14:30'), t('22:00')]]);
    const q = run({ now: t('14:10'), policy: { ...policy, startIncrementMinutes: 15 } });
    expect(q.windows[0]!.start).toBe(t('14:15'));
  });

  it('removes intervals that are in the past', () => {
    const d = run({ busy: [iv('12:00', '13:00')], now: t('14:00') });
    expect(windows(d)).toEqual([[t('14:00'), t('22:00')]]);
    expect(d.filtered).toEqual([
      expect.objectContaining({ reason: 'past', raw: iv('08:00', '12:00') }),
    ]);
  });

  it('enforces minimum lead time', () => {
    const busy = [iv('10:00', '22:00')];
    const ok = run({ busy, now: t('08:50'), policy: { ...policy, leadTimeMinutes: 30 } });
    expect(windows(ok)).toEqual([[t('09:30'), t('10:00')]]);
    const blocked = run({ busy, now: t('08:50'), policy: { ...policy, leadTimeMinutes: 60 } });
    expect(blocked.windows).toEqual([]);
    expect(blocked.filtered[0]!.reason).toBe('lead-time');
  });

  it('caps a single booking at the policy maximum without hiding the window', () => {
    const d = run();
    expect(d.windows[0]!.durationMinutes).toBe(14 * 60);
    expect(d.windows[0]!.maxBookingMinutes).toBe(180);
    const unlimited = run({ policy: { ...policy, maxDurationMinutes: null } });
    expect(unlimited.windows[0]!.maxBookingMinutes).toBe(14 * 60);
  });

  it('respects provider start increments (60 min)', () => {
    const d = run({
      busy: [iv('08:00', '10:10')],
      openHours: [iv('08:00', '12:00')],
      policy: { ...policy, startIncrementMinutes: 60 },
    });
    expect(windows(d)).toEqual([[t('11:00'), t('12:00')]]);
    expect(d.windows[0]!.startTimes).toEqual([t('11:00')]);
  });
});

describe('availability engine — data trust', () => {
  it('missing snapshot → everything open is unknown, never free', () => {
    const d = run({ snapshot: null });
    expect(d.freshness).toBe('missing');
    expect(kinds(d, 'free')).toEqual([]);
    expect(kinds(d, 'unknown')).toEqual([[t('08:00'), t('22:00')]]);
    expect(d.windows).toEqual([]);
  });

  it('incomplete snapshot: returned bookings show, silence stays unknown', () => {
    const d = run({ snapshot: snap([iv('12:00', '13:00')], { complete: false }) });
    expect(kinds(d, 'free')).toEqual([]);
    expect(kinds(d, 'occupied')).toEqual([[t('12:00'), t('13:00')]]);
    expect(kinds(d, 'unknown')).toEqual([
      [t('08:00'), t('12:00')],
      [t('13:00'), t('22:00')],
    ]);
    expect(d.complete).toBe(false);
  });

  it('complete snapshot only proves free inside its coverage window', () => {
    const d = run({ snapshot: snap([], { coverage: iv('08:00', '12:00') }) });
    expect(kinds(d, 'free')).toEqual([[t('08:00'), t('12:00')]]);
    expect(kinds(d, 'unknown')).toEqual([[t('12:00'), t('22:00')]]);
  });

  it('stale snapshot is withheld entirely', () => {
    const d = run({
      busy: [iv('12:00', '13:00')],
      now: t('10:00'),
      staleAfterMinutes: 30,
    });
    expect(d.freshness).toBe('stale');
    expect(kinds(d, 'occupied')).toEqual([]);
    expect(kinds(d, 'free')).toEqual([]);
    expect(d.windows).toEqual([]);
  });

  it('provider error is surfaced and withheld', () => {
    const d = run({ snapshot: snap([], { error: 'HTTP 503' }) });
    expect(d.freshness).toBe('error');
    expect(d.windows).toEqual([]);
  });

  it('policy/maintenance blocks show as unavailable, not free', () => {
    const d = run({ unavailable: [iv('15:00', '16:00')] });
    expect(kinds(d, 'unavailable')).toEqual([[t('15:00'), t('16:00')]]);
    expect(windows(d)).toEqual([
      [t('08:00'), t('15:00')],
      [t('16:00'), t('22:00')],
    ]);
  });
});

describe('availability engine — calendar edge cases', () => {
  it('fall-back DST day (2026-11-01) is 25 hours long', () => {
    const date = '2026-11-01';
    const day = dayBounds(date);
    expect((day.end - day.start) / 3_600_000).toBe(25);
    const d = computeDay({
      date,
      openHours: [operatingWindow(date, '00:00', '24:00')],
      snapshot: { ...snap([]), coverage: day },
      policy: { ...policy, maxDurationMinutes: null },
      now: day.start - 1,
      staleAfterMinutes: 10_000,
    });
    expect(d.windows[0]!.durationMinutes).toBe(25 * 60);
  });

  it('spring-forward DST day (2026-03-08) is 23 hours; 1–4 AM is 2 real hours', () => {
    const date = '2026-03-08';
    const day = dayBounds(date);
    expect((day.end - day.start) / 3_600_000).toBe(23);
    const w = operatingWindow(date, '01:00', '04:00');
    expect((w.end - w.start) / 3_600_000).toBe(2);
  });

  it('increments stay aligned to local wall-clock across DST', () => {
    const date = '2026-11-01';
    const d = computeDay({
      date,
      openHours: [operatingWindow(date, '00:00', '24:00')],
      snapshot: { ...snap([]), coverage: dayBounds(date) },
      policy,
      now: localTime(date, '01:40') + 3_600_000, // second 1:40 AM (EST)
      staleAfterMinutes: 10_000,
    });
    const startLocal = new Date(d.windows[0]!.start).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    });
    expect(startLocal).toBe('2:00 AM');
  });

  it('cross-midnight hours extend past the calendar day', () => {
    const open = operatingWindow(DATE, '20:00', '02:00');
    expect((open.end - open.start) / 3_600_000).toBe(6);
    const d = run({
      openHours: [open],
      snapshot: snap([], { coverage: { start: t('00:00'), end: open.end } }),
      policy: { ...policy, maxDurationMinutes: null },
    });
    expect(windows(d)).toEqual([[t('20:00'), open.end]]);
    expect(d.range.end).toBe(open.end);
  });
});

describe('statusAt', () => {
  const d = run({ busy: [iv('12:00', '13:00'), iv('13:00', '15:00')], now: t('07:30') });

  it('open with until', () => {
    expect(statusAt(d, t('10:00'))).toMatchObject({ state: 'open', until: t('12:00') });
  });
  it('occupied with until = end of occupied run', () => {
    expect(statusAt(d, t('12:30'))).toMatchObject({ state: 'occupied', until: t('15:00') });
  });
  it('opens soon when the next window starts within 30 minutes; occupied when further out', () => {
    expect(statusAt(d, t('14:35'))).toMatchObject({ state: 'opensSoon', opensAt: t('15:00') });
    expect(statusAt(d, t('14:15'))).toMatchObject({ state: 'occupied', until: t('15:00') });
  });
  it('unknown when data is missing', () => {
    expect(statusAt(run({ snapshot: null }), t('10:00')).state).toBe('unknown');
  });
  it('a room free now whose next bookable start is the next increment is open, not "opens soon"', () => {
    const q = run({ now: t('14:05'), policy: { ...policy, startIncrementMinutes: 15 } });
    expect(q.windows[0]!.start).toBe(t('14:15'));
    expect(statusAt(q, t('14:05'))).toMatchObject({ state: 'open', until: t('22:00') });
  });
  it('still "opens soon" when the room is occupied until shortly before the next window', () => {
    const q = run({ busy: [iv('12:00', '14:10')], now: t('14:00'), policy: { ...policy, startIncrementMinutes: 15 } });
    expect(statusAt(q, t('14:00'))).toMatchObject({ state: 'opensSoon', opensAt: t('14:15') });
  });
  it('closed time is unavailable', () => {
    expect(statusAt(d, t('23:00')).state).toBe('unavailable');
  });
});
