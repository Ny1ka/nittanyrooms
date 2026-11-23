import { anyFilter, NO_FILTERS, type Filters, type SizeFilter } from '../lib/filters';
import { distanceMeters, formatDistance, type GeoState } from '../lib/geo';
import type { LiveState } from '../lib/live';
import { navigate } from '../lib/router';
import { AvailabilityFreshness } from '../components/Notices';
import { Locate } from '../components/Icons';
import type { MarkerInfo } from './MapView';

const chip = (on: boolean) =>
  `relative inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-semibold ${
    on ? 'bg-accent-soft text-accent-text ring-1 ring-accent-border' : 'border border-line text-muted hover:text-fg hover:border-subtle'
  }`;

const FREE_UNTIL = ['', '14:00', '15:00', '16:00', '17:00', '18:00', '20:00', '22:00'];
const label12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h! < 12 ? 'AM' : 'PM'}`;
};

function Select<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const on = !!value;
  return (
    <label className={`${chip(on)} cursor-pointer pr-2`}>
      <span className="sr-only">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => onChange((typeof value === 'number' ? Number(e.target.value) : e.target.value) as T)}
        className="cursor-pointer appearance-none bg-transparent font-semibold outline-none"
      >
        {options.map(([v, l]) => (
          <option key={String(v)} value={String(v)}>
            {l}
          </option>
        ))}
      </select>
      <span aria-hidden="true">▾</span>
    </label>
  );
}

export function CampusList({
  markers,
  visible,
  filters,
  setFilters,
  demo,
  live,
  geo,
  onLocate,
}: {
  markers: MarkerInfo[];
  visible: MarkerInfo[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  demo: boolean;
  live: LiveState;
  geo: GeoState;
  onLocate: () => void;
}) {
  const pos = geo.status === 'ok' ? geo.pos : null;
  const dist = (m: MarkerInfo) => (pos ? distanceMeters(pos, { lat: m.building.location.lat, lon: m.building.location.lon }) : 0);
  const rows = pos ? [...visible].sort((a, b) => dist(a) - dist(b)) : visible;
  const verified = rows.filter((m) => m.building.status === 'verified');
  const nearest = pos ? verified[0] : undefined;
  const nearestOpen = pos ? verified.find((m) => m.known && m.counts.open > 0) : undefined;

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filters">
        <button type="button" aria-pressed={filters.openNow} className={chip(filters.openNow)} onClick={() => setFilters({ ...filters, openNow: !filters.openNow })}>
          Open now
        </button>
        <Select
          label="Free until"
          value={filters.freeUntil ?? ''}
          options={FREE_UNTIL.map((t) => [t, t ? `Free until ${label12(t)}` : 'Free until…'] as [string, string])}
          onChange={(v) => setFilters({ ...filters, freeUntil: v || null })}
        />
        <Select
          label="Available for at least"
          value={filters.minFree}
          options={[[0, 'For at least…'], [30, 'At least 30 min'], [60, 'At least 1 hr'], [120, 'At least 2 hr'], [180, 'At least 3 hr']]}
          onChange={(v) => setFilters({ ...filters, minFree: v })}
        />
        <Select
          label="Group size"
          value={filters.minSize}
          options={[[0, 'Any size'], [2, '2+ seats'], [5, '5+ seats'], [9, '9+ seats']] as [SizeFilter, string][]}
          onChange={(v) => setFilters({ ...filters, minSize: v })}
        />
        <button type="button" aria-pressed={filters.accessible} className={chip(filters.accessible)} onClick={() => setFilters({ ...filters, accessible: !filters.accessible })}>
          Accessible
        </button>
        <button type="button" onClick={onLocate} aria-pressed={!!pos} className={chip(!!pos)} disabled={geo.status === 'locating'}>
          <Locate size={12} />
          {geo.status === 'locating' ? 'Locating…' : 'Near me'}
        </button>
      </div>

      {geo.status === 'error' && <p className="text-xs text-busy-text">{geo.message}</p>}
      {nearest && (
        <div className="rounded-panel border border-line bg-surface-2 p-3">
          <div className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Closest to you</div>
          <button type="button" onClick={() => navigate(`/b/${nearest.building.id}`)} className="mt-1 block text-left">
            <span className="text-[14px] font-semibold underline-offset-2 hover:underline">{nearest.building.headline}</span>
            <span className="block text-xs text-muted">{formatDistance(dist(nearest))}</span>
          </button>
          {nearestOpen && nearestOpen !== nearest && (
            <button type="button" onClick={() => navigate(`/b/${nearestOpen.building.id}`)} className="mt-2 block text-left text-xs text-muted">
              Closest with a room open now: <span className="font-semibold text-open-text">{nearestOpen.building.headline}</span> · {formatDistance(dist(nearestOpen))}
            </button>
          )}
          <p className="mt-2 text-[11px] text-subtle">Straight-line estimate. Your location stays on this device.</p>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-subtle uppercase" aria-live="polite">
        <span>
          {visible.length} of {markers.length} buildings{pos ? ' · nearest first' : ''}
        </span>
        {anyFilter(filters) && (
          <button type="button" className="tracking-normal normal-case text-muted underline underline-offset-2 hover:text-fg" onClick={() => setFilters(NO_FILTERS)}>
            Clear
          </button>
        )}
      </div>

      {rows.length > 0 ? (
        <ul className="-mx-2" aria-label="Buildings">
          {rows.map((m) => (
            <BuildingRow key={m.building.id} info={m} distance={pos ? formatDistance(dist(m)) : null} />
          ))}
        </ul>
      ) : (
        <div className="rounded-panel border border-line p-3 text-xs text-muted">
          <div className="font-semibold text-fg">No buildings match.</div>
          <p className="mt-1">No room is confirmed free for that. Try another time or clear filters. We only filter on details Penn State publishes.</p>
        </div>
      )}

      <AvailabilityFreshness demo={demo} live={live} />
    </div>
  );
}

function BuildingRow({ info, distance }: { info: MarkerInfo; distance: string | null }) {
  const b = info.building;
  const n = info.counts.total;
  const candidate = b.status === 'candidate';
  let right: React.ReactNode;
  if (candidate) right = <span className="text-[11px] font-semibold text-subtle">Not verified</span>;
  else if (!info.known) right = <span className="text-[11px] font-semibold text-muted">Check PSU site</span>;
  else if (info.counts.open > 0) right = <span className="text-xs font-semibold text-open-text tabular">{info.counts.open} open</span>;
  else right = <span className="text-[11px] font-semibold text-busy-text">None open</span>;
  const dot = candidate ? 'border border-dashed border-subtle' : info.known && info.counts.open > 0 ? 'bg-open' : info.known ? 'bg-busy' : 'fill-unknown';
  const sub = candidate ? 'Rooms not listed yet' : `${n} room${n === 1 ? '' : 's'}${b.headline.includes(b.shortName) ? '' : ` · ${b.shortName}`}`;
  return (
    <li>
      <button type="button" onClick={() => navigate(`/b/${b.id}`)} className="flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left hover:bg-surface-2">
        <span className={`size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{b.headline}</span>
          <span className="block truncate text-xs text-muted">
            {sub}
            {distance ? ` · ${distance}` : ''}
          </span>
        </span>
        {right}
      </button>
    </li>
  );
}
