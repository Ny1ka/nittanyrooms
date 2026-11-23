import { formatDateLabel, formatTime, localTime } from '@nittany-rooms/core';
import { navigate } from '../lib/router';
import type { Theme } from '../lib/theme';
import type { SelectedTime } from '../lib/time';
import { Moon, Sun } from './Icons';
import { LogoMark } from './Logo';
import { SearchBox } from './SearchBox';

const pill =
  'relative inline-flex h-8 items-center rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg tabular hover:border-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent';

/**
 * Date/time pills. A transparent native input covers each label, so the platform
 * picker, keyboard entry and screen-reader semantics come from the browser.
 */
export function DateTimePills({ sel }: { sel: SelectedTime }) {
  const today = new Date(sel.now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const timeLabel = sel.isLive && sel.isToday ? 'Now' : formatTime(localTime(sel.date, sel.time));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className={pill}>
        <span aria-hidden="true">{sel.isToday ? 'Today' : formatDateLabel(sel.date)}</span>
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
        <button type="button" onClick={sel.reset} className="h-8 px-2 text-xs font-semibold text-muted underline-offset-2 hover:text-fg hover:underline">
          Reset
        </button>
      )}
      <span id="tz-note" className="sr-only">
        Penn State campus time (Eastern). Selected {formatDateLabel(sel.date)}, {formatTime(sel.at)}.
      </span>
    </div>
  );
}

export function Controls({ sel, theme, onToggleTheme }: { sel: SelectedTime; theme: Theme; onToggleTheme: () => void }) {
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
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="grid size-9 place-items-center rounded-control text-muted hover:bg-surface-2 hover:text-fg"
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>
      <SearchBox />
      <DateTimePills sel={sel} />
    </div>
  );
}
