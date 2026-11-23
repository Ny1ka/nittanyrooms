import { CAMPUS_TIMEZONE, type ReservationPolicy } from '../schema.js';
import {
  MINUTE,
  contains,
  hull,
  intersect,
  normalize,
  subtract,
  type Interval,
} from './intervals.js';
import { alignUp, dayBounds } from './time.js';

export type SegmentKind = 'free' | 'occupied' | 'unavailable' | 'closed' | 'unknown';

export interface Segment extends Interval {
  kind: SegmentKind;
}

/**
 * One response from an official provider for one room and date.
 * `complete` must only be true when the provider guarantees the busy list is
 * exhaustive for `coverage`. "No bookings returned" is not the same as "free".
 */
export interface ProviderSnapshot {
  roomId: string;
  providerId: string;
  coverage: Interval;
  complete: boolean;
  retrievedAt: number;
  busy: Interval[];
  error?: string;
}

export type PolicyRules = Pick<
  ReservationPolicy,
  | 'minDurationMinutes'
  | 'maxDurationMinutes'
  | 'startIncrementMinutes'
  | 'leadTimeMinutes'
  | 'minUsefulGapMinutes'
>;

export interface DayInput {
  date: string;
  zone?: string;
  /** Room/building operating windows for the date. `null` = hours not known. */
  openHours: Interval[] | null;
  /** Policy or maintenance blocks known from our own verified data. */
  unavailable?: Interval[];
  snapshot: ProviderSnapshot | null;
  policy: PolicyRules;
  now: number;
  /** Snapshots older than this are withheld (everything becomes unknown). */
  staleAfterMinutes: number;
  /** "Show shorter openings" override. Never goes below the provider minimum. */
  minUsefulGapMinutes?: number;
}

export type Freshness = 'fresh' | 'stale' | 'missing' | 'error';

export interface BookableWindow extends Interval {
  /** The full free interval this window came from. */
  raw: Interval;
  durationMinutes: number;
  /** Longest single booking that fits (capped by policy max). */
  maxBookingMinutes: number;
  /** Every valid booking start time (provider increments, room for min duration). */
  startTimes: number[];
}

export type FilterReason = 'past' | 'too-short' | 'lead-time' | 'misaligned';

export interface FilteredGap {
  raw: Interval;
  reason: FilterReason;
  /** Minutes that would actually be bookable after rules. */
  usableMinutes: number;
}

export interface DayAvailability {
  date: string;
  zone: string;
  range: Interval;
  segments: Segment[];
  windows: BookableWindow[];
  filtered: FilteredGap[];
  freshness: Freshness;
  /** Whether the provider data was complete (only meaningful when fresh). */
  complete: boolean;
  retrievedAt: number | null;
  thresholdMinutes: number;
}

function freshnessOf(input: DayInput): Freshness {
  const s = input.snapshot;
  if (!s) return 'missing';
  if (s.error) return 'error';
  if (input.now - s.retrievedAt > input.staleAfterMinutes * MINUTE) return 'stale';
  return 'fresh';
}

function tag(intervals: Interval[], kind: SegmentKind): Segment[] {
  return intervals.map((i) => ({ ...i, kind }));
}

/** Merge adjacent segments of the same kind; input must be non-overlapping. */
function stitch(segments: Segment[]): Segment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.kind === s.kind && last.end === s.start) last.end = s.end;
    else out.push({ ...s });
  }
  return out;
}

/**
 * Compute a room's day: typed timeline segments plus bookable windows.
 *
 * Steps (master prompt §4.3): normalize → clip to hours → merge busy → complement
 * only if data is complete and fresh → apply policy, lead time, increments →
 * return windows plus the reason each rejected gap was filtered.
 */
export function computeDay(input: DayInput): DayAvailability {
  const zone = input.zone ?? CAMPUS_TIMEZONE;
  const day = dayBounds(input.date, zone);
  const hours = input.openHours ? normalize(input.openHours) : null;
  const range = hull([day, ...(hours ?? [])])!;
  const open = hours ?? [range];
  const closed = hours ? subtract([range], hours) : [];
  const freshness = freshnessOf(input);
  const snapshot = input.snapshot;

  const unavailable = intersect(input.unavailable ?? [], open);
  const openUsable = subtract(open, unavailable);

  let occupied: Interval[] = [];
  let free: Interval[] = [];
  let unknown: Interval[];

  if (freshness === 'fresh' && snapshot) {
    occupied = intersect(snapshot.busy, openUsable);
    if (snapshot.complete) {
      const known = intersect(openUsable, [snapshot.coverage]);
      free = subtract(known, occupied);
      unknown = subtract(openUsable, [snapshot.coverage, ...occupied]);
    } else {
      // Incomplete: returned bookings are real, but silence proves nothing.
      unknown = subtract(openUsable, occupied);
    }
  } else {
    // Missing, errored, or stale: withhold everything.
    unknown = openUsable;
  }

  const segments = stitch([
    ...tag(closed, 'closed'),
    ...tag(unavailable, 'unavailable'),
    ...tag(occupied, 'occupied'),
    ...tag(free, 'free'),
    ...tag(unknown, 'unknown'),
  ]);

  const p = input.policy;
  const thresholdMinutes = Math.max(
    p.minDurationMinutes,
    input.minUsefulGapMinutes ?? p.minUsefulGapMinutes,
  );
  const threshold = thresholdMinutes * MINUTE;
  const earliestStart = input.now + p.leadTimeMinutes * MINUTE;

  const windows: BookableWindow[] = [];
  const filtered: FilteredGap[] = [];

  for (const raw of normalize(free)) {
    const start = alignUp(Math.max(raw.start, earliestStart), p.startIncrementMinutes, zone);
    const usable = raw.end - start;
    if (usable >= threshold) {
      const maxBooking = p.maxDurationMinutes
        ? Math.min(usable, p.maxDurationMinutes * MINUTE)
        : usable;
      const startTimes: number[] = [];
      const step = p.startIncrementMinutes * MINUTE;
      for (let t = start; t + p.minDurationMinutes * MINUTE <= raw.end; t += step) {
        startTimes.push(t);
      }
      windows.push({
        start,
        end: raw.end,
        raw,
        durationMinutes: usable / MINUTE,
        maxBookingMinutes: maxBooking / MINUTE,
        startTimes,
      });
      continue;
    }
    let reason: FilterReason;
    if (raw.end <= input.now) reason = 'past';
    else if (raw.end - raw.start < threshold) reason = 'too-short';
    else if (raw.end - alignUp(Math.max(raw.start, input.now), p.startIncrementMinutes, zone) < threshold)
      reason = 'past';
    else if (earliestStart > raw.start) reason = 'lead-time';
    else reason = 'misaligned';
    filtered.push({ raw, reason, usableMinutes: Math.max(0, usable / MINUTE) });
  }

  return {
    date: input.date,
    zone,
    range,
    segments,
    windows,
    filtered,
    freshness,
    complete: freshness === 'fresh' && !!snapshot?.complete,
    retrievedAt: snapshot?.retrievedAt ?? null,
    thresholdMinutes,
  };
}

export type RoomState = 'open' | 'opensSoon' | 'occupied' | 'unavailable' | 'unknown';

export interface RoomStatus {
  state: RoomState;
  /** For open: window end. For occupied: end of the occupied run. */
  until?: number;
  /** For opensSoon: when the next window starts. */
  opensAt?: number;
  window?: BookableWindow;
}

/** First bookable window that hasn't ended by `t` (may already be in progress). */
export function nextWindow(day: DayAvailability, t: number): BookableWindow | undefined {
  return day.windows.find((w) => w.end > t);
}

/**
 * Room state at an instant, mapped to the design system's five room states.
 * `soonMinutes` controls how close the next window must be to count as "opens soon".
 */
export function statusAt(day: DayAvailability, t: number, soonMinutes = 60): RoomStatus {
  const seg = day.segments.find((s) => contains(s, t));
  if (!seg || seg.kind === 'unknown') return { state: 'unknown' };

  const current = day.windows.find((w) => contains(w, t));
  if (current) return { state: 'open', until: current.end, window: current };

  const upcoming = day.windows.find((w) => w.start > t);
  if (upcoming && upcoming.start - t <= soonMinutes * MINUTE) {
    return { state: 'opensSoon', opensAt: upcoming.start, window: upcoming };
  }
  if (seg.kind === 'occupied') return { state: 'occupied', until: seg.end };
  return { state: 'unavailable' };
}
