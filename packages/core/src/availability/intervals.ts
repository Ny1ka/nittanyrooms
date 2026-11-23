/** Half-open interval [start, end) in epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

export const MINUTE = 60_000;

/** Drop empty/invalid intervals, sort, and merge overlapping or touching ones. */
export function normalize(intervals: readonly Interval[]): Interval[] {
  const valid = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Interval[] = [];
  for (const cur of valid) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push(cur);
    }
  }
  return out;
}

/** Intersection of two interval sets. */
export function intersect(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const A = normalize(a);
  const B = normalize(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const x = A[i]!;
    const y = B[j]!;
    const start = Math.max(x.start, y.start);
    const end = Math.min(x.end, y.end);
    if (end > start) out.push({ start, end });
    if (x.end < y.end) i++;
    else j++;
  }
  return out;
}

/** Everything in `a` that is not in `b`. */
export function subtract(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const B = normalize(b);
  const out: Interval[] = [];
  for (const x of normalize(a)) {
    let cursor = x.start;
    for (const y of B) {
      if (y.end <= cursor) continue;
      if (y.start >= x.end) break;
      if (y.start > cursor) out.push({ start: cursor, end: y.start });
      cursor = Math.max(cursor, y.end);
      if (cursor >= x.end) break;
    }
    if (cursor < x.end) out.push({ start: cursor, end: x.end });
  }
  return out;
}

export function clip(intervals: readonly Interval[], range: Interval): Interval[] {
  return intersect(intervals, [range]);
}

export function hull(intervals: readonly Interval[]): Interval | null {
  const n = normalize(intervals);
  if (n.length === 0) return null;
  return { start: n[0]!.start, end: n[n.length - 1]!.end };
}

export function durationMinutes(i: Interval): number {
  return (i.end - i.start) / MINUTE;
}

export function contains(i: Interval, t: number): boolean {
  return t >= i.start && t < i.end;
}
