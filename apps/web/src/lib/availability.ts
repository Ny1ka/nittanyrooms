import {
  MINUTE,
  computeDay,
  localTime,
  operatingWindow,
  statusAt,
  type DayAvailability,
  type ProviderSnapshot,
  type Room,
  type RoomState,
  type RoomStatus,
} from '@nittany-rooms/core';
import { getPolicy, roomsIn } from './data';
import { useRoute } from './router';

/**
 * Where availability comes from.
 *
 * Real mode: no Penn State provider currently grants us programmatic availability
 * (see docs/research/KNOWN_LIMITATIONS.md), so there is no snapshot and every
 * room is "unknown" → "Check on PSU site". The engine never invents free time.
 *
 * Demo mode (?demo=1): deterministic SAMPLE schedules so the timeline and gap
 * filtering can be seen working. Always shown with a "Sample data" banner.
 */

/** Snapshots older than this are withheld. */
export const STALE_AFTER_MINUTES = 15;

export function useDemo(): boolean {
  return useRoute().params.get('demo') === '1';
}

export interface RoomDay extends DayAvailability {
  sample: boolean;
}

// ---- deterministic sample data (demo mode only) ----

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_OPEN = '08:00';
const SAMPLE_CLOSE = '22:00';

function sampleSnapshot(room: Room, date: string, now: number): ProviderSnapshot {
  const rand = rng(hash(`${room.id}:${date}`));
  const busy = [];
  let cursor = localTime(date, SAMPLE_OPEN) + Math.floor(rand() * 8) * 15 * MINUTE;
  const close = localTime(date, SAMPLE_CLOSE);
  while (cursor < close) {
    const len = (2 + Math.floor(rand() * 7)) * 15 * MINUTE; // 30 min – 2 h
    busy.push({ start: cursor, end: Math.min(cursor + len, close) });
    // Gap: sometimes deliberately short (15 min) to exercise filtering.
    const gapSlots = rand() < 0.3 ? 1 : 2 + Math.floor(rand() * 10);
    cursor += len + gapSlots * 15 * MINUTE;
  }
  return {
    roomId: room.id,
    providerId: room.providerId,
    coverage: operatingWindow(date, '00:00', '24:00'),
    complete: true,
    retrievedAt: now - 4 * MINUTE,
    busy,
  };
}

// ---- public API ----

export function roomDay(
  room: Room,
  date: string,
  now: number,
  opts: { demo: boolean; showShorter?: boolean },
): RoomDay {
  const policy = getPolicy(room.policyId);
  // Live provider adapters (milestone M8) will supply snapshots here when
  // getProvider(room.providerId).availabilityAccess !== 'none'. None do yet.
  const snapshot = opts.demo ? sampleSnapshot(room, date, now) : null;
  const day = computeDay({
    date,
    // Real hours aren't verified for any room yet; demo uses labeled sample hours.
    openHours: opts.demo ? [operatingWindow(date, SAMPLE_OPEN, SAMPLE_CLOSE)] : null,
    snapshot,
    policy,
    now,
    staleAfterMinutes: STALE_AFTER_MINUTES,
    ...(opts.showShorter ? { minUsefulGapMinutes: policy.minDurationMinutes } : {}),
  });
  return { ...day, sample: opts.demo };
}

export function roomStatus(day: RoomDay, at: number): RoomStatus {
  return statusAt(day, at);
}

export type StateCounts = Record<RoomState, number> & { total: number };

export function buildingCounts(
  buildingId: string,
  date: string,
  at: number,
  now: number,
  demo: boolean,
): StateCounts {
  const counts: StateCounts = {
    open: 0,
    opensSoon: 0,
    occupied: 0,
    unavailable: 0,
    unknown: 0,
    total: 0,
  };
  for (const r of roomsIn(buildingId)) {
    const s = roomStatus(roomDay(r, date, now, { demo }), at);
    counts[s.state]++;
    counts.total++;
  }
  return counts;
}
