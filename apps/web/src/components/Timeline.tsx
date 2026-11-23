import {
  MINUTE,
  formatHourTick,
  formatRange,
  localTime,
  type Interval,
  type Segment,
} from '@nittany-rooms/core';
import type { RoomDay } from '../lib/availability';

type Visual = 'open' | 'short' | 'occupied' | 'unavailable' | 'unknown';

const VISUAL_CLASS: Record<Visual, string> = {
  open: 'bg-glow',
  short: 'bg-[#EEF1F5]',
  occupied: 'bg-navy',
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
      if (seg.end <= now) return 'open'; // already past; the past overlay dims it
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

/** Range to draw: open hours when known, otherwise 7 AM – 11 PM. */
function displayRange(day: RoomDay): Interval {
  const notClosed = day.segments.filter((s) => s.kind !== 'closed');
  const hasHours = day.segments.some((s) => s.kind === 'closed');
  if (hasHours && notClosed.length) {
    const start = Math.min(...notClosed.map((s) => s.start)) - 0;
    const end = Math.max(...notClosed.map((s) => s.end));
    // Pad to show a sliver of "closed" at the end, like the design.
    return { start, end: end + 60 * MINUTE };
  }
  return { start: localTime(day.date, '07:00'), end: localTime(day.date, '23:00') };
}

export function Timeline({
  day,
  now,
  selected,
}: {
  day: RoomDay;
  now: number;
  selected?: Interval | null;
}) {
  const range = displayRange(day);
  const span = range.end - range.start;
  const pct = (t: number) => `${(Math.min(Math.max(t - range.start, 0), span) / span) * 100}%`;
  const visible = day.segments
    .map((s) => ({ ...s, start: Math.max(s.start, range.start), end: Math.min(s.end, range.end) }))
    .filter((s) => s.end > s.start);

  const pieces = visible.map((s) => ({ seg: s, visual: visualOf(s, day, now) }));
  const summary = pieces
    .map((p) => `${formatRange(p.seg.start, p.seg.end)} ${VISUAL_WORD[p.visual]}`)
    .join('; ');

  // Ticks every 3 hours on the hour.
  const ticks: number[] = [];
  const firstHour = Math.ceil(range.start / (60 * MINUTE)) * 60 * MINUTE;
  for (let t = firstHour; t <= range.end; t += 3 * 60 * MINUTE) ticks.push(t);

  const showNow = now > range.start && now < range.end;

  return (
    <div>
      <div
        role="img"
        aria-label={`Availability timeline for ${day.date}: ${summary}.`}
        className="relative h-11 overflow-hidden rounded-lg border border-line"
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
            className="absolute inset-y-0 rounded-sm shadow-[inset_0_0_0_3px_#12284C,inset_0_0_0_5px_#FFFFFF]"
            style={{
              left: pct(selected.start),
              width: `calc(${pct(selected.end)} - ${pct(selected.start)})`,
            }}
          />
        )}
        {showNow && (
          <>
            <div
              className="absolute inset-y-0 left-0 bg-white/55"
              style={{ width: pct(now) }}
            />
            <div className="absolute inset-y-0 w-0.5 bg-now" style={{ left: pct(now) }} />
          </>
        )}
      </div>
      <div className="relative mt-1.5 h-4 text-xs text-slate tabular" aria-hidden="true">
        {ticks.map((t, i) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0"
            style={{ left: pct(t) }}
          >
            {i === 0 || formatHourTick(t).endsWith('PM') !== formatHourTick(ticks[i - 1]!).endsWith('PM')
              ? formatHourTick(t)
              : formatHourTick(t).replace(/ (AM|PM)$/, '')}
          </span>
        ))}
      </div>
      {showNow && (
        <p className="sr-only">The current time is marked on the timeline.</p>
      )}
    </div>
  );
}
