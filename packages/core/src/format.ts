import { DateTime } from 'luxon';
import { CAMPUS_TIMEZONE } from './schema.js';

/** "2:00 PM" */
export function formatTime(t: number, zone = CAMPUS_TIMEZONE): string {
  return DateTime.fromMillis(t, { zone }).toFormat('h:mm a');
}

/** "2:00" (no meridiem) — for compact labels where context is clear. */
export function formatTimeShort(t: number, zone = CAMPUS_TIMEZONE): string {
  return DateTime.fromMillis(t, { zone }).toFormat('h:mm');
}

/** "2:00 – 3:30 PM", or "11:30 AM – 1:00 PM" when meridiem differs. */
export function formatRange(start: number, end: number, zone = CAMPUS_TIMEZONE): string {
  const a = DateTime.fromMillis(start, { zone });
  const b = DateTime.fromMillis(end, { zone });
  if (a.toFormat('a') === b.toFormat('a') && a.hasSame(b, 'day')) {
    return `${a.toFormat('h:mm')} – ${b.toFormat('h:mm a')}`;
  }
  return `${a.toFormat('h:mm a')} – ${b.toFormat('h:mm a')}`;
}

/** "1 hr 30 min", "4 hr", "45 min" */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} hr`;
  return `${h} hr ${r} min`;
}

/** "Mon, Nov 23" */
export function formatDateLabel(date: string, zone = CAMPUS_TIMEZONE): string {
  return DateTime.fromISO(date, { zone }).toFormat('ccc, LLL d');
}

/** "8 AM", "2 PM" — for timeline axis ticks. */
export function formatHourTick(t: number, zone = CAMPUS_TIMEZONE): string {
  const dt = DateTime.fromMillis(t, { zone });
  return dt.minute === 0 ? dt.toFormat('h a') : dt.toFormat('h:mm a');
}

/** Hour of day (0–23) and minute → "HH:mm" for <input type=time>. */
export function toTimeInputValue(t: number, zone = CAMPUS_TIMEZONE): string {
  return DateTime.fromMillis(t, { zone }).toFormat('HH:mm');
}
