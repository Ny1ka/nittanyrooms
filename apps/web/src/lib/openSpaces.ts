import type { OpenSpace } from '@nittany-rooms/core';
import { roomsIn } from './data';
import type { LiveState } from './live';
import type { SelectedTime } from './time';

export type SpaceStatus = { state: 'open'; until: number } | { state: 'closed'; opensAt?: number } | { state: 'check' };

/**
 * Library study areas: open while any of the library's rooms has a bookable slot
 * (booked or free) in LibCal, which matches the library's posted hours. Spaces
 * without published hours always say "Check hours". Never guesses.
 */
export function spaceStatus(space: OpenSpace, live: LiveState, sel: SelectedTime): SpaceStatus {
  if (space.hours.mode !== 'libcal' || !space.buildingId) return { state: 'check' };
  if (live.status !== 'ok' || live.data.date !== sel.date) return { state: 'check' };
  const spans: [number, number][] = [];
  for (const r of roomsIn(space.buildingId)) {
    const item = r.providerRoomId ? live.data.items[r.providerRoomId] : undefined;
    if (item) spans.push(...item.open);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of spans) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const cur = merged.find(([a, b]) => sel.at >= a && sel.at < b);
  if (cur) return { state: 'open', until: cur[1] };
  const next = merged.find(([a]) => a > sel.at);
  return next ? { state: 'closed', opensAt: next[0] } : { state: 'closed' };
}
