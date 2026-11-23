import { roomDay, roomStatus } from '../lib/availability';
import { roomsIn } from '../lib/data';
import type { LiveState } from '../lib/live';
import { navigate } from '../lib/router';
import type { SelectedTime } from '../lib/time';
import { AvailabilityFreshness } from '../components/Notices';
import type { MarkerInfo } from './MapView';

export type SizeFilter = 0 | 2 | 5 | 9;
export interface Filters {
  openNow: boolean;
  minSize: SizeFilter;
  accessible: boolean;
}
export const NO_FILTERS: Filters = { openNow: false, minSize: 0, accessible: false };

const chip = (on: boolean) =>
  `inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-semibold ${
    on ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-fg hover:border-subtle'
  }`;

/** A building matches if at least one verified room matches every active filter. */
export function matchesFilters(m: MarkerInfo, f: Filters, sel: SelectedTime, demo: boolean, live: LiveState): boolean {
  if (!f.openNow && !f.minSize && !f.accessible) return true;
  return roomsIn(m.building.id).some((r) => {
    if (f.minSize && (r.capacity === null || r.capacity < f.minSize)) return false;
    if (f.accessible && !r.features.includes('accessible')) return false;
    if (f.openNow && roomStatus(roomDay(r, sel.date, sel.now, { demo, live }), sel.at).state !== 'open') return false;
    return true;
  });
}

export function CampusList({
  markers,
  visible,
  filters,
  setFilters,
  demo,
  live,
}: {
  markers: MarkerInfo[];
  visible: MarkerInfo[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  demo: boolean;
  live: LiveState;
}) {
  const anyFilter = filters.openNow || filters.minSize > 0 || filters.accessible;
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filters">
        <button type="button" aria-pressed={filters.openNow} className={chip(filters.openNow)} onClick={() => setFilters({ ...filters, openNow: !filters.openNow })}>
          Open now
        </button>
        <label className={`${chip(filters.minSize > 0)} cursor-pointer pr-2`}>
          <span className="sr-only">Group size</span>
          <select
            value={filters.minSize}
            onChange={(e) => setFilters({ ...filters, minSize: Number(e.target.value) as SizeFilter })}
            className="cursor-pointer appearance-none bg-transparent font-semibold outline-none"
          >
            <option value={0}>Any size</option>
            <option value={2}>2+ seats</option>
            <option value={5}>5+ seats</option>
            <option value={9}>9+ seats</option>
          </select>
          <span aria-hidden="true">▾</span>
        </label>
        <button type="button" aria-pressed={filters.accessible} className={chip(filters.accessible)} onClick={() => setFilters({ ...filters, accessible: !filters.accessible })}>
          Accessible
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-subtle uppercase" aria-live="polite">
        <span>
          {visible.length} of {markers.length} buildings
        </span>
        {anyFilter && (
          <button type="button" className="tracking-normal normal-case text-muted underline underline-offset-2 hover:text-fg" onClick={() => setFilters({ openNow: false, minSize: 0, accessible: false })}>
            Clear
          </button>
        )}
      </div>

      {visible.length > 0 ? (
        <ul className="-mx-2" aria-label="Buildings">
          {visible.map((m) => (
            <BuildingRow key={m.building.id} info={m} />
          ))}
        </ul>
      ) : (
        <div className="rounded-panel border border-line p-3 text-xs text-muted">
          <div className="font-semibold text-fg">No buildings match.</div>
          <p className="mt-1">
            {filters.openNow ? 'No room is confirmed open at this time. ' : ''}
            We only filter on details Penn State publishes. Try another time or clear filters.
          </p>
        </div>
      )}

      <AvailabilityFreshness demo={demo} live={live} />
    </div>
  );
}

function BuildingRow({ info }: { info: MarkerInfo }) {
  const b = info.building;
  const n = info.counts.total;
  const candidate = b.status === 'candidate';
  let right: React.ReactNode;
  if (candidate) right = <span className="text-[11px] font-semibold text-subtle">Not verified</span>;
  else if (!info.known) right = <span className="text-[11px] font-semibold text-muted">Check PSU site</span>;
  else if (info.counts.open > 0)
    right = (
      <span className="text-xs font-semibold text-accent-text tabular">
        {info.counts.open} open
      </span>
    );
  else right = <span className="text-[11px] font-semibold text-muted">None open</span>;

  const dot = candidate
    ? 'border border-dashed border-subtle'
    : info.known && info.counts.open > 0
      ? 'bg-accent'
      : info.known
        ? 'bg-occupied'
        : 'fill-unknown';

  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/b/${b.id}`)}
        className="flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left hover:bg-surface-2"
      >
        <span className={`size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{b.headline}</span>
          <span className="block truncate text-xs text-muted">
            {candidate ? 'Rooms not listed yet' : `${n} room${n === 1 ? '' : 's'}${b.headline.includes(b.shortName) ? '' : ` · ${b.shortName}`}`}
          </span>
        </span>
        {right}
      </button>
    </li>
  );
}
