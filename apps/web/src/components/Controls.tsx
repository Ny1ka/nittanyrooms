import { formatDateLabel, formatTime, localTime } from '@nittany-rooms/core';
import { DateTime } from 'luxon';
import { anyFilter, NO_FILTERS, type Filters, type SizeFilter } from '../lib/filters';
import type { GeoState } from '../lib/geo';
import { navigate } from '../lib/router';
import type { ThemePref } from '../lib/theme';
import { useThemeValue } from '../lib/theme';
import type { SelectedTime } from '../lib/time';
import { About } from './About';
import { Calendar, GitHub, Locate } from './Icons';
import { LogoMark } from './Logo';
import { Popover } from './Popover';
import { SearchBox } from './SearchBox';

const sectionH = 'mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase';
const field = 'h-9 w-full rounded-control border border-line bg-surface-2 px-2.5 text-[13px] text-fg tabular';
const toggle = (on: boolean) =>
  `h-8 rounded-control px-3 text-xs font-semibold ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted hover:text-fg'}`;

const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M2 4h12M4.5 8h7M7 12h2" />
  </svg>
);
const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="3.5" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.5" cy="8" r="1.3" />
  </svg>
);

function FilterPanel({ filters, setFilters, geo, onLocate }: { filters: Filters; setFilters: (f: Filters) => void; geo: GeoState; onLocate: () => void }) {
  const set = (p: Partial<Filters>) => setFilters({ ...filters, ...p });
  return (
    <div className="space-y-3">
      <div>
        <div className={sectionH}>Availability</div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={filters.openNow} className={toggle(filters.openNow)} onClick={() => set({ openNow: !filters.openNow })}>
            Open now
          </button>
          <button type="button" aria-pressed={filters.accessible} className={toggle(filters.accessible)} onClick={() => set({ accessible: !filters.accessible })}>
            Accessible
          </button>
        </div>
      </div>
      <label className="block">
        <span className={sectionH + ' block'}>Free until</span>
        <select value={filters.freeUntil ?? ''} onChange={(e) => set({ freeUntil: e.target.value || null })} className={field}>
          <option value="">Any time</option>
          {HALF_HOURS.filter((t) => t >= '08:00').map((t) => (
            <option key={t} value={t}>
              {label12(t)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={sectionH + ' block'}>Available for at least</span>
        <select value={filters.minFree} onChange={(e) => set({ minFree: Number(e.target.value) })} className={field}>
          <option value={0}>Any length</option>
          <option value={30}>30 minutes</option>
          <option value={60}>1 hour</option>
          <option value={120}>2 hours</option>
          <option value={180}>3 hours</option>
        </select>
      </label>
      <label className="block">
        <span className={sectionH + ' block'}>Group size</span>
        <select value={filters.minSize} onChange={(e) => set({ minSize: Number(e.target.value) as SizeFilter })} className={field}>
          <option value={0}>Any size</option>
          <option value={2}>2+ seats</option>
          <option value={5}>5+ seats</option>
          <option value={9}>9+ seats</option>
        </select>
      </label>
      <button type="button" onClick={onLocate} disabled={geo.status === 'locating'} className={`${toggle(geo.status === 'ok')} inline-flex w-full items-center justify-center gap-1.5`}>
        <Locate size={13} /> {geo.status === 'locating' ? 'Locating…' : geo.status === 'ok' ? 'Sorted by distance' : 'Sort by distance (near me)'}
      </button>
      {anyFilter(filters) && (
        <button type="button" onClick={() => setFilters(NO_FILTERS)} className="w-full text-xs font-semibold text-muted underline underline-offset-2 hover:text-fg">
          Clear filters
        </button>
      )}
    </div>
  );
}

/** Half-hour slots shown in the time picker and "Free until" (campus time). */
export const HALF_HOURS = Array.from({ length: 36 }, (_, i) => {
  const m = 6 * 60 + i * 30; // 6:00 AM – 11:30 PM
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
export const label12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
};

const chipBtn = (on: boolean, disabled = false) =>
  `h-9 rounded-control text-[13px] font-medium tabular ${
    on ? 'bg-accent text-accent-ink' : disabled ? 'text-subtle/50 cursor-not-allowed' : 'bg-surface-2 text-fg hover:bg-surface-3'
  }`;

function TimePanel({ sel, close }: { sel: SelectedTime; close: () => void }) {
  const today = DateTime.fromMillis(sel.now, { zone: 'America/New_York' }).startOf('day');
  const days = Array.from({ length: 15 }, (_, i) => today.plus({ days: i })); // booking window
  const nowHHMM = DateTime.fromMillis(sel.now, { zone: 'America/New_York' }).toFormat('HH:mm');
  const live = sel.isLive && sel.isToday;
  return (
    <div className="space-y-3">
      <div>
        <div className={sectionH}>Day</div>
        <div className="grid grid-cols-5 gap-1">
          {days.map((d, i) => {
            const iso = d.toISODate()!;
            const on = sel.date === iso;
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={on}
                aria-label={d.toFormat('cccc, LLLL d')}
                onClick={() => sel.setDate(iso)}
                className={`${chipBtn(on)} flex h-12 flex-col items-center justify-center leading-tight`}
              >
                <span className={`text-[10px] font-semibold uppercase ${on ? '' : 'text-subtle'}`}>{i === 0 ? 'Today' : d.toFormat('ccc')}</span>
                <span className="text-[14px] font-semibold">{d.toFormat('d')}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className={sectionH}>Time</div>
        <button
          type="button"
          aria-pressed={live}
          onClick={() => {
            sel.reset();
            close();
          }}
          className={`${chipBtn(live)} mb-1 w-full`}
        >
          Now
        </button>
        <div className="grid max-h-48 grid-cols-4 gap-1 overflow-y-auto pr-0.5">
          {HALF_HOURS.filter((t) => !(sel.isToday && t < nowHHMM.slice(0, 3) + (Number(nowHHMM.slice(3)) >= 30 ? '30' : '00'))).map((t) => {
            const past = false;
            const on = !live && sel.time === t;
            return (
              <button key={t} type="button" disabled={past} aria-pressed={on} onClick={() => sel.setTime(t)} className={chipBtn(on, past)}>
                {label12(t).replace(':00', '')}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-subtle">Penn State campus time (Eastern).</p>
    </div>
  );
}

export function Controls({
  sel,
  filters,
  setFilters,
  geo,
  onLocate,
  themePref,
  setThemePref,
  liveCheckedAt,
}: {
  sel: SelectedTime;
  filters: Filters;
  setFilters: (f: Filters) => void;
  geo: GeoState;
  onLocate: () => void;
  themePref: ThemePref;
  setThemePref: (p: ThemePref) => void;
  liveCheckedAt: number | null;
}) {
  const theme = useThemeValue();
  const live = sel.isLive && sel.isToday;
  const timeLabel = live ? 'Now' : `${sel.isToday ? '' : formatDateLabel(sel.date).split(', ')[1] + ' '}${formatTime(localTime(sel.date, sel.time))}`;
  const nFilters = [filters.openNow, filters.accessible, !!filters.freeUntil, filters.minFree > 0, filters.minSize > 0].filter(Boolean).length;
  return (
    <div className="relative flex items-center gap-1.5 border-b border-line px-3 py-2.5">
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate('/');
        }}
        className="flex h-9 shrink-0 items-center gap-1.5 pr-1 no-underline"
        title="Nittany Rooms"
      >
        <LogoMark size={20} onNavy={theme === 'dark'} />
        <span className="hidden text-[15px] font-extrabold tracking-[-0.02em] lg:inline">
          <span style={{ color: 'var(--nr-brand-navy)' }}>Nittany</span>{' '}
          <span style={{ color: 'var(--nr-brand-yellow)' }}>Rooms</span>
        </span>
      </a>
      <div className="min-w-0 flex-1">
        <SearchBox placeholder="Search rooms" />
      </div>
      <Popover label="Filters" active={nFilters > 0 || geo.status === 'ok'} button={<><FilterIcon />{nFilters > 0 && <span className="text-xs font-bold">{nFilters}</span>}</>}>
        {() => <FilterPanel filters={filters} setFilters={setFilters} geo={geo} onLocate={onLocate} />}
      </Popover>
      <Popover label={`Date and time: ${live ? 'now' : timeLabel}`} active={!live} width={300} button={<><Calendar size={14} /><span className="whitespace-nowrap tabular">{timeLabel}</span></>}>
        {(close) => <TimePanel sel={sel} close={close} />}
      </Popover>
      <a
        href="https://github.com/Ny1ka/nittanyrooms"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source on GitHub (opens in a new tab)"
        title="View on GitHub"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-line bg-surface-2 text-fg hover:border-subtle"
      >
        <GitHub size={16} />
      </a>
      <Popover label="More" width={320} button={<DotsIcon />}>
        {() => <About pref={themePref} setPref={setThemePref} liveCheckedAt={liveCheckedAt} />}
      </Popover>
    </div>
  );
}
