import { DateTime } from 'luxon';
import { CAMPUS_TIMEZONE } from '../schema.js';
import type { Interval } from './intervals.js';

/**
 * The full local calendar day for `date` (YYYY-MM-DD) in `zone`, as UTC epoch ms.
 * DST-aware: the spring-forward day is 23 h long, the fall-back day 25 h.
 */
export function dayBounds(date: string, zone = CAMPUS_TIMEZONE): Interval {
  const start = DateTime.fromISO(date, { zone }).startOf('day');
  if (!start.isValid) throw new Error(`Invalid date: ${date}`);
  return { start: start.toMillis(), end: start.plus({ days: 1 }).toMillis() };
}

/**
 * Wall-clock time on a local date → epoch ms. `"24:00"` means the next midnight.
 * Nonexistent times on spring-forward days are shifted forward by Luxon.
 */
export function localTime(date: string, hhmm: string, zone = CAMPUS_TIMEZONE): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`Invalid time: ${hhmm}`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour === 24 && minute === 0) return dayBounds(date, zone).end;
  if (hour > 23 || minute > 59) throw new Error(`Invalid time: ${hhmm}`);
  const dt = DateTime.fromISO(date, { zone }).set({ hour, minute, second: 0, millisecond: 0 });
  return dt.toMillis();
}

/**
 * Operating window for a date. If `close` is at or before `open`, the window
 * crosses midnight and closes on the next calendar day.
 */
export function operatingWindow(
  date: string,
  open: string,
  close: string,
  zone = CAMPUS_TIMEZONE,
): Interval {
  const start = localTime(date, open, zone);
  let end = localTime(date, close, zone);
  if (end <= start) {
    const next = DateTime.fromISO(date, { zone }).plus({ days: 1 }).toISODate()!;
    end = localTime(next, close, zone);
  }
  return { start, end };
}

/**
 * Round `t` up to the next booking-start boundary in local wall-clock time.
 * Increments that divide an hour align to the local hour; others to local midnight.
 */
export function alignUp(t: number, incrementMinutes: number, zone = CAMPUS_TIMEZONE): number {
  const dt = DateTime.fromMillis(t, { zone });
  const base = 60 % incrementMinutes === 0 ? dt.startOf('hour') : dt.startOf('day');
  const step = incrementMinutes * 60_000;
  const offset = t - base.toMillis();
  const k = Math.ceil(offset / step);
  return base.toMillis() + k * step;
}

/** Today's date in the campus timezone as YYYY-MM-DD. */
export function campusDate(t: number, zone = CAMPUS_TIMEZONE): string {
  return DateTime.fromMillis(t, { zone }).toISODate()!;
}
