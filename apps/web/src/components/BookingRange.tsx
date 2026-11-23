import { formatDuration, formatTime, MINUTE, type BookableWindow } from '@nittany-rooms/core';
import { useRef } from 'react';

/**
 * Adjust the booking inside an open window: drag the block to slide it, drag its
 * right edge to resize, or use the two sliders (keyboard / screen readers).
 * Steps follow the provider's start increment; length is clamped to the room's
 * minimum and to min(policy max, time left in the window).
 */
export function BookingRange({
  window: w,
  start,
  minutes,
  minMinutes,
  maxMinutes,
  step,
  onChange,
}: {
  window: BookableWindow;
  start: number;
  minutes: number;
  minMinutes: number;
  /** Policy cap (null = none). */
  maxMinutes: number | null;
  step: number;
  onChange: (start: number, minutes: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const span = w.end - w.start;
  const cap = (s: number) => Math.floor(Math.min((w.end - s) / MINUTE, maxMinutes ?? Infinity) / step) * step;
  const starts = w.startTimes.filter((t) => cap(t) >= minMinutes);
  const set = (s: number, m: number) => {
    const snappedStart = starts.reduce((best, t) => (Math.abs(t - s) < Math.abs(best - s) ? t : best), starts[0] ?? w.start);
    const len = Math.max(minMinutes, Math.min(cap(snappedStart), Math.round(m / step) * step));
    onChange(snappedStart, len);
  };
  const pct = (t: number) => `${((t - w.start) / span) * 100}%`;

  const drag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.preventDefault();
    const el = track.current;
    if (!el) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const t0 = w.start + ((e.clientX - rect.left) / rect.width) * span;
    const startAt = start;
    const onMove = (ev: PointerEvent) => {
      const t = w.start + ((ev.clientX - rect.left) / rect.width) * span;
      if (mode === 'move') {
        const s = Math.min(Math.max(w.start, startAt + (t - t0)), w.end - minutes * MINUTE);
        set(s, minutes);
      } else {
        set(start, (t - start) / MINUTE);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const end = start + minutes * MINUTE;
  const startIdx = Math.max(0, starts.indexOf(start));
  return (
    <div className="space-y-2 rounded-control bg-surface-2 p-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Your booking</span>
        <span className="font-semibold text-fg tabular">
          {formatTime(start)} – {formatTime(end)} · {formatDuration(minutes)}
        </span>
      </div>
      <div ref={track} aria-hidden="true" className="relative h-8 touch-none rounded-[6px] bg-open-soft">
        <div
          onPointerDown={drag('move')}
          className="absolute inset-y-0 cursor-grab rounded-[6px] bg-accent active:cursor-grabbing"
          style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }}
        >
          <div onPointerDown={(e) => { e.stopPropagation(); drag('resize')(e); }} className="absolute inset-y-0 right-0 w-3 cursor-ew-resize rounded-r-[6px] bg-white/30" />
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-subtle tabular">
        <span>{formatTime(w.start)}</span>
        <span>{formatTime(w.end)}</span>
      </div>
      <label className="block text-xs text-muted">
        <span className="flex justify-between"><span>Start</span><span className="tabular">{formatTime(start)}</span></span>
        <input
          type="range"
          min={0}
          max={Math.max(0, starts.length - 1)}
          step={1}
          value={startIdx}
          onChange={(e) => set(starts[Number(e.target.value)]!, minutes)}
          aria-label="Start time"
          aria-valuetext={formatTime(start)}
          className="w-full accent-[var(--nr-accent)]"
        />
      </label>
      <label className="block text-xs text-muted">
        <span className="flex justify-between"><span>Length</span><span className="tabular">{formatDuration(minutes)}</span></span>
        <input
          type="range"
          min={minMinutes}
          max={Math.max(minMinutes, cap(start))}
          step={step}
          value={minutes}
          onChange={(e) => set(start, Number(e.target.value))}
          aria-label="Booking length"
          aria-valuetext={formatDuration(minutes)}
          className="w-full accent-[var(--nr-accent)]"
        />
      </label>
    </div>
  );
}
