import { getProvider } from '../lib/data';
import { anyFilter, NO_FILTERS, type Filters } from '../lib/filters';
import { distanceMeters, formatDistance, type GeoState } from '../lib/geo';
import type { LiveState } from '../lib/live';
import { navigate } from '../lib/router';
import { ChevronRight } from '../components/Icons';
import { AvailabilityFreshness } from '../components/Notices';
import type { MarkerInfo } from './MapView';

/** illiniSpots-style list: grouped sections, one count badge per row, chevron. */
export function CampusList({
  markers,
  visible,
  filters,
  setFilters,
  demo,
  live,
  geo,
}: {
  markers: MarkerInfo[];
  visible: MarkerInfo[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  demo: boolean;
  live: LiveState;
  geo: GeoState;
}) {
  const pos = geo.status === 'ok' ? geo.pos : null;
  const dist = (m: MarkerInfo) => (pos ? distanceMeters(pos, { lat: m.building.location.lat, lon: m.building.location.lon }) : 0);
  const rows = pos ? [...visible].sort((a, b) => dist(a) - dist(b)) : visible;
  const nearest = pos ? rows.find((m) => m.building.status === 'verified') : undefined;
  const nearestOpen = pos ? rows.find((m) => m.known && m.counts.open > 0) : undefined;

  const groups: [string, MarkerInfo[]][] = pos
    ? [['Nearest first', rows]]
    : [
        ['Libraries', rows.filter((m) => m.building.status === 'verified' && getProvider(m.building.providerIds[0]!).system === 'libcal')],
        ['Engineering', rows.filter((m) => m.building.status === 'verified' && getProvider(m.building.providerIds[0]!).system === 'outlook')],
        ['Not verified yet', rows.filter((m) => m.building.status !== 'verified')],
      ];

  return (
    <div className="pb-3">
      <h1 className="sr-only">Study rooms you can reserve at Penn State University Park</h1>
      {geo.status === 'error' && <p className="px-4 pt-3 text-xs text-busy-text">{geo.message}</p>}
      {nearest && (
        <div className="mx-4 mt-3 rounded-panel border border-line bg-surface-2 p-3 text-xs text-muted">
          <div className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Closest to you</div>
          <button type="button" onClick={() => navigate(`/b/${nearest.building.id}`)} className="mt-1 block text-left">
            <span className="text-[14px] font-semibold text-fg hover:underline">{nearest.building.headline}</span>
            <span className="block">{formatDistance(dist(nearest))}</span>
          </button>
          {nearestOpen && nearestOpen !== nearest && (
            <button type="button" onClick={() => navigate(`/b/${nearestOpen.building.id}`)} className="mt-2 block text-left">
              Closest with a room open: <span className="font-semibold text-open-text">{nearestOpen.building.headline}</span> · {formatDistance(dist(nearestOpen))}
            </button>
          )}
        </div>
      )}
      {anyFilter(filters) && (
        <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted" aria-live="polite">
          <span>
            {visible.length} of {markers.length} buildings match
          </span>
          <button type="button" className="font-semibold underline underline-offset-2 hover:text-fg" onClick={() => setFilters(NO_FILTERS)}>
            Clear
          </button>
        </div>
      )}

      {rows.length === 0 && (
        <p className="px-4 pt-3 text-xs text-muted">No building has a room free for that. Try another time or clear filters.</p>
      )}
      {groups.map(([title, list]) =>
        list.length ? (
          <section key={title} aria-label={title}>
            <h2 className="px-4 pt-4 pb-1.5 text-[13px] font-medium text-subtle">{title}</h2>
            <ul className="border-t border-line">
              {list.map((m) => (
                <Row key={m.building.id} info={m} distance={pos ? formatDistance(dist(m)) : null} />
              ))}
            </ul>
          </section>
        ) : null,
      )}

      <div className="px-4 pt-3">
        <AvailabilityFreshness demo={demo} live={live} />
      </div>
    </div>
  );
}

function Badge({ info }: { info: MarkerInfo }) {
  const base = 'inline-flex h-6 min-w-12 items-center justify-center rounded-full px-2 text-xs font-semibold tabular';
  if (info.building.status === 'candidate') return <span className={`${base} bg-surface-2 text-muted`}>Not verified</span>;
  if (!info.known) return <span className={`${base} bg-surface-2 text-muted`}>Check site</span>;
  const { open, total } = info.counts;
  return open > 0 ? (
    <span className={`${base} bg-open-soft text-open-text`} aria-label={`${open} of ${total} open`}>
      {open}/{total}
    </span>
  ) : (
    <span className={`${base} bg-busy-soft text-busy-text`} aria-label={`None of ${total} open`}>
      0/{total}
    </span>
  );
}

function Row({ info, distance }: { info: MarkerInfo; distance: string | null }) {
  const b = info.building;
  return (
    <li className="border-b border-line">
      <button type="button" onClick={() => navigate(`/b/${b.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{b.headline}</span>
          {distance && <span className="block truncate text-xs text-muted">{distance}</span>}
        </span>
        <Badge info={info} />
        <ChevronRight size={14} className="shrink-0 text-subtle" />
      </button>
    </li>
  );
}
