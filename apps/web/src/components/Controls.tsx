import { formatDateLabel, formatTime, localTime } from '@nittany-rooms/core';
import { navigate } from '../lib/router';
import { useThemeValue } from '../lib/theme';
import type { SelectedTime } from '../lib/time';
import { Calendar, Clock, Close } from './Icons';
import { LogoMark } from './Logo';
import { SearchBox } from './SearchBox';

const pill =
  'relative inline-flex h-9 flex-1 items-center gap-2 rounded-control border border-line bg-surface-2 px-3 text-[13px] font-medium text-fg tabular hover:border-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-border';

/**
 * Date/time pills. A transparent native input covers each label, so the platform
 * picker, keyboard entry and screen-reader semantics come from the browser.
 */
export function DateTimePills({ sel }: { sel: SelectedTime }) {
  const today = new Date(sel.now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const timeLabel = sel.isLive && sel.isToday ? `Now · ${formatTime(sel.now)}` : formatTime(localTime(sel.date, sel.time));
  return (
    <div className="flex items-center gap-1.5">
      <label className={pill}>
        <Calendar size={14} className="shrink-0 text-subtle" />
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
      <label className={pill}>
        <Clock size={14} className="shrink-0 text-subtle" />
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
        <button type="button" onClick={sel.reset} aria-label="Reset to now" title="Reset to now" className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-surface-2 hover:text-fg">
          <Close size={14} />
        </button>
      )}
      <span id="tz-note" className="sr-only">
        Penn State campus time (Eastern). Selected {formatDateLabel(sel.date)}, {formatTime(sel.at)}.
      </span>
    </div>
  );
}

export function Controls({ sel }: { sel: SelectedTime }) {
  const theme = useThemeValue();
  return (
    <div className="space-y-2.5 border-b border-line px-4 pt-3 pb-3">
      <div className="flex items-center justify-between">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="flex min-h-9 items-center gap-2 no-underline"
        >
          <LogoMark size={22} onNavy={theme === 'dark'} />
          <span className="text-[15px] font-extrabold tracking-[-0.01em]">Nittany Rooms</span>
        </a>
      </div>
      <SearchBox />
      <DateTimePills sel={sel} />
    </div>
  );
}
