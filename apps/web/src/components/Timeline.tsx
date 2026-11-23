import { MINUTE, formatHourTick, formatRange, localTime, type Interval, type Segment } from '@nittany-rooms/core';
import type { RoomDay } from '../lib/availability';

type Visual = 'open' | 'short' | 'occupied' | 'unavailable' | 'unknown';

const VISUAL_CLASS: Record<Visual, string> = {
  open: 'bg-open',
  short: 'bg-surface-3',
  occupied: 'bg-busy',
  unavailable: 'fill-unavailable',
  unknown: 'fill-unknown',
};

const VISUAL_WORD: Record<Visual, string> = {
  open: 'open',
  short: 'free but too short to book',
  occupied: 'occupied',
  unavailable: 'closed or unavailable',
  unknown: 'unknown, check on PSU site',
};

function visualOf(seg: Segment, day: RoomDay, now: number): Visual {
  switch (seg.kind) {
    case 'free':
      if (seg.end <= now) return 'open';
      return day.windows.some((w) => w.start < seg.end && w.end > seg.start) ? 'open' : 'short';
    case 'occupied':
      return 'occupied';
    case 'closed':
    case 'unavailable':
      return 'unavailable';
    case 'unknown':
      return 'unknown';
  }
}

/** Range to draw: bookable hours when known (padded an hour each side), else 7 AM – 11 PM. */
export function displayRange(days: RoomDay[]): Interval {
  const notClosed = days.flatMap((d) => d.segments.filter((s) => s.kind !== 'closed'));
  const hasHours = days.some((d) => d.segments.some((s) => s.kind === 'closed'));
  const date = days[0]!.date;
  if (hasHours && notClosed.length) {
    return {
      start: Math.min(...notClosed.map((s) => s.start)) - 60 * MINUTE,
      end: Math.max(...notClosed.map((s) => s.end)) + 60 * MINUTE,
    };
  }
  return { start: localTime(date, '07:00'), end: localTime(date, '23:00') };
}

function useGeometry(day: RoomDay, range: Interval, now: number) {
  const span = range.end - range.start;
  const pct = (t: number) => `${(Math.min(Math.max(t - range.start, 0), span) / span) * 100}%`;
  const pieces = day.segments
    .map((s) => ({ ...s, start: Math.max(s.start, range.start), end: Math.min(s.end, range.end) }))
    .filter((s) => s.end > s.start)
    .map((s) => ({ seg: s, visual: visualOf(s, day, now) }));
  return { pct, pieces, showNow: now > range.start && now < range.end };
}

export function Timeline({ day, now, selected }: { day: RoomDay; now: number; selected?: Interval | null }) {
  const range = displayRange([day]);
  const { pct, pieces, showNow } = useGeometry(day, range, now);
  const summary = pieces.map((p) => `${formatRange(p.seg.start, p.seg.end)} ${VISUAL_WORD[p.visual]}`).join('; ');
  const ticks: number[] = [];
  const firstHour = Math.ceil(range.start / (60 * MINUTE)) * 60 * MINUTE;
  const step = range.end - range.start > 10 * 60 * MINUTE ? 3 : 2;
  for (let t = firstHour; t <= range.end; t += step * 60 * MINUTE) ticks.push(t);

  return (
    <div>
      <div
        role="img"
        aria-label={`Availability timeline for ${day.date}: ${summary}.`}
        className="relative h-8 overflow-hidden rounded-control bg-surface-2"
      >
        {pieces.map(({ seg, visual }) => (
          <div
            key={`${seg.start}-${seg.kind}`}
            className={`absolute inset-y-0 ${VISUAL_CLASS[visual]}`}
            style={{ left: pct(seg.start), width: `calc(${pct(seg.end)} - ${pct(seg.start)})` }}
          />
        ))}
        {selected && (
          <div
            className="absolute inset-y-0 rounded-[4px] shadow-[inset_0_0_0_2px_var(--nr-fg)]"
            style={{ left: pct(selected.start), width: `calc(${pct(selected.end)} - ${pct(selected.start)})` }}
          />
        )}
        {showNow && (
          <>
            <div className="absolute inset-y-0 left-0 bg-bg/55" style={{ width: pct(now) }} />
            <div className="absolute inset-y-0 w-0.5 bg-now" style={{ left: pct(now) }} />
          </>
        )}
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-subtle tabular" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0" style={{ left: pct(t) }}>
            {formatHourTick(t)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Thin per-room bar for lists. Decorative: the row's text carries the status. */
export function MiniTimeline({ day, now, range }: { day: RoomDay; now: number; range: Interval }) {
  const { pct, pieces, showNow } = useGeometry(day, range, now);
  return (
    <div aria-hidden="true" className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
      {pieces.map(({ seg, visual }) => (
        <div
          key={`${seg.start}-${seg.kind}`}
          className={`absolute inset-y-0 ${VISUAL_CLASS[visual]}`}
          style={{ left: pct(seg.start), width: `calc(${pct(seg.end)} - ${pct(seg.start)})` }}
        />
      ))}
      {showNow && (
        <>
          <div className="absolute inset-y-0 left-0 bg-bg/55" style={{ width: pct(now) }} />
          <div className="absolute inset-y-0 w-px bg-now" style={{ left: pct(now) }} />
        </>
      )}
    </div>
  );
}
