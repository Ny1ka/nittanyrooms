import { formatDateLabel, formatTime, localTime } from '@nittany-rooms/core';
import type { SelectedTime } from '../lib/time';
import { navigate } from '../lib/router';
import { LogoMark } from './Logo';
import { SearchBox } from './SearchBox';

const control =
  'relative inline-flex h-11 items-center rounded-control border border-input-border bg-surface px-3.5 text-[15px] font-semibold text-navy tabular focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-glow-border';

/**
 * Date and time pickers styled like the design ("Mon, Nov 23" / "2:00 PM").
 * A transparent native input covers each label, so the platform picker,
 * keyboard entry, and screen-reader semantics all come from the browser.
 */
export function DateTimeControls({ sel }: { sel: SelectedTime }) {
  const today = new Date(sel.now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const timeLabel = sel.isLive && sel.isToday ? 'Now' : formatTime(localTime(sel.date, sel.time));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={control}>
        <span aria-hidden="true">{sel.isToday ? `Today, ${formatDateLabel(sel.date).split(', ')[1]}` : formatDateLabel(sel.date)}</span>
        <span className="sr-only">Date</span>
        <input
          type="date"
          value={sel.date}
          min={today}
          onChange={(e) => e.target.value && sel.setDate(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-describedby="tz-note"
        />
      </label>
      <label className={control}>
        <span aria-hidden="true">{timeLabel}</span>
        <span className="sr-only">Time</span>
        <input
          type="time"
          step={900}
          value={sel.time}
          onChange={(e) => sel.setTime(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-describedby="tz-note"
        />
      </label>
      {(!sel.isLive || !sel.isToday) && (
        <button type="button" onClick={sel.reset} className="inline-flex h-11 items-center rounded-control px-2 text-[15px] font-semibold underline underline-offset-2">
          Reset to now
        </button>
      )}
      <span id="tz-note" className="sr-only">
        Penn State campus time (Eastern). Selected {formatDateLabel(sel.date)}, {formatTime(sel.at)}.
      </span>
    </div>
  );
}

export function Header({ sel, searchPlaceholder }: { sel: SelectedTime; searchPlaceholder?: string }) {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3.5 sm:px-6">
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate('/', {}, { transition: true });
        }}
        className="flex min-h-11 items-center gap-2.5 no-underline"
      >
        <LogoMark />
        <span className="text-xl font-extrabold tracking-[-0.02em]">Nittany Rooms</span>
      </a>
      <div className="w-full sm:w-auto sm:max-w-[420px] sm:flex-[1_1_260px]">
        <SearchBox {...(searchPlaceholder ? { placeholder: searchPlaceholder } : {})} />
      </div>
      <DateTimeControls sel={sel} />
      <div className="hidden text-small text-slate xl:ml-auto xl:block">
        Student-made. Not an official Penn State service.
      </div>
    </header>
  );
}
