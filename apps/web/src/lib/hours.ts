import { localTime, MINUTE, OPENS_SOON_MINUTES, type Building, type BuildingHoursEntry } from '@nittany-rooms/core';
import { DateTime } from 'luxon';
import { buildingHoursTable, getProvider, roomsIn } from './data';
import type { LiveState } from './live';
import type { SelectedTime } from './time';

export type HoursStatus =
  | { state: 'open'; until: number; source: 'libcal' | 'manual' }
  | { state: 'closingSoon'; until: number; source: 'libcal' | 'manual' }
  | { state: 'closed'; opensAt?: number; source: 'libcal' | 'manual' }
  | { state: 'unknown' };

type Span = [number, number];

function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Library buildings: open while any room has a bookable LibCal slot (booked or free). */
function libcalSpans(b: Building, live: LiveState, date: string): Span[] | null {
  if (live.status !== 'ok' || live.data.date !== date) return null;
  const spans: Span[] = [];
  for (const r of roomsIn(b.id)) {
    const item = r.providerRoomId ? live.data.items[r.providerRoomId] : undefined;
    if (item) spans.push(...item.open);
  }
  return merge(spans);
}

function manualSpans(entry: BuildingHoursEntry, date: string): Span[] | null {
  if ((entry.validFrom && date < entry.validFrom) || (entry.validTo && date > entry.validTo)) return null;
  const ex = entry.exceptions.find((e) => e.date === date);
  const day = DateTime.fromISO(date, { zone: 'America/New_York' }).toFormat('ccc').toLowerCase() as keyof BuildingHoursEntry['weekly'];
  const list = ex ? ex.hours : entry.weekly[day];
  return merge(
    list.map(([o, c]) => {
      const s = localTime(date, o);
      const e = c <= o ? localTime(DateTime.fromISO(date).plus({ days: 1 }).toISODate()!, c) : localTime(date, c);
      return [s, e] as Span;
    }),
  );
}

/**
 * General building hours for the selected moment (separate from room availability:
 * an open building doesn't mean every room is free). Never guessed: unknown → "Hours unavailable".
 */
export function buildingHours(b: Building, live: LiveState, sel: SelectedTime): HoursStatus {
  const libcal = getProvider(b.providerIds[0]!).system === 'libcal';
  const entry = buildingHoursTable.find((h) => h.buildingId === b.id);
  const source = libcal ? 'libcal' : 'manual';
  const spans = libcal ? libcalSpans(b, live, sel.date) : entry ? manualSpans(entry, sel.date) : null;
  if (!spans) return { state: 'unknown' };
  const cur = spans.find(([a, z]) => sel.at >= a && sel.at < z);
  if (cur) {
    const later = spans.some(([a]) => a >= cur[1]);
    return cur[1] - sel.at <= OPENS_SOON_MINUTES * MINUTE && !later
      ? { state: 'closingSoon', until: cur[1], source }
      : { state: 'open', until: cur[1], source };
  }
  const next = spans.find(([a]) => a > sel.at);
  return next ? { state: 'closed', opensAt: next[0], source } : { state: 'closed', source };
}
