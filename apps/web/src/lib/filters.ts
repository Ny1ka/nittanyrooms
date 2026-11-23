import { MINUTE, localTime, type Room } from '@nittany-rooms/core';
import { roomDay, roomStatus } from './availability';
import { roomsIn } from './data';
import type { LiveState } from './live';
import type { SelectedTime } from './time';

export type SizeFilter = 0 | 2 | 5 | 9;
export interface Filters {
  openNow: boolean;
  minSize: SizeFilter;
  accessible: boolean;
  /** "HH:mm": room must stay free from the selected time until then. */
  freeUntil: string | null;
  /** Room must stay free for at least this many minutes from the selected time. */
  minFree: number;
}
export const NO_FILTERS: Filters = { openNow: false, minSize: 0, accessible: false, freeUntil: null, minFree: 0 };

export const anyFilter = (f: Filters) => f.openNow || f.minSize > 0 || f.accessible || !!f.freeUntil || f.minFree > 0;

export function roomMatches(r: Room, f: Filters, sel: SelectedTime, demo: boolean, live: LiveState): boolean {
  if (f.minSize && (r.capacity === null || r.capacity < f.minSize)) return false;
  if (f.accessible && !r.features.includes('accessible')) return false;
  if (f.openNow || f.freeUntil || f.minFree) {
    const s = roomStatus(roomDay(r, sel.date, sel.now, { demo, live }), sel.at);
    if (s.state !== 'open' || !s.until) return false;
    if (f.freeUntil && s.until < localTime(sel.date, f.freeUntil)) return false;
    if (f.minFree && s.until - sel.at < f.minFree * MINUTE) return false;
  }
  return true;
}

export function buildingMatches(buildingId: string, f: Filters, sel: SelectedTime, demo: boolean, live: LiveState): boolean {
  if (!anyFilter(f)) return true;
  return roomsIn(buildingId).some((r) => roomMatches(r, f, sel, demo, live));
}
