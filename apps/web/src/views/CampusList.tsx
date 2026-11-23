import { formatTime } from '@nittany-rooms/core';
import { getBuilding, getProvider, openSpaces, rooms as allRooms } from '../lib/data';
import { roomDay, roomStatus } from '../lib/availability';
import { buildingKey, useFavorites } from '../lib/favorites';
import { useWatches } from '../lib/watches';
import { deleteServerWatch } from '../lib/push';
import { formatDateLabel, formatDuration } from '@nittany-rooms/core';
import { StatusChip } from '../components/StatusChip';
import { spaceStatus } from '../lib/openSpaces';
import { formatWalk, ROUTE_ATTRIBUTION, type RouteState } from '../lib/route';
import type { SelectedTime } from '../lib/time';
import { External, Star } from '../components/Icons';
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
  sel,
  route,
  onRoute,
  onClearRoute,
}: {
  markers: MarkerInfo[];
  visible: MarkerInfo[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  demo: boolean;
  live: LiveState;
  geo: GeoState;
  sel: SelectedTime;
  route: RouteState;
  onRoute: (buildingId: string) => void;
  onClearRoute: () => void;
}) {
  const favs = useFavorites();
  const watches = useWatches();
  const favRooms = allRooms.filter((r) => favs.ids.includes(r.id));
  const favBuildings = markers.filter((m) => favs.has(buildingKey(m.building.id)));
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
          <RouteControls target={nearestOpen ?? nearest} route={route} onRoute={onRoute} onClearRoute={onClearRoute} />
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

      {watches.list.length > 0 && (
        <section aria-label="Alerts">
          <h2 className="px-4 pt-4 pb-1.5 text-[13px] font-medium text-subtle">🔔 Alerts</h2>
          <ul className="border-t border-line">
            {watches.list.map((w) => {
              const r = allRooms.find((x) => x.id === w.roomId);
              return (
                <li key={w.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-xs">
                  <button type="button" onClick={() => navigate(`/b/${w.buildingId}`, { room: w.roomId, d: w.date })} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[14px] font-semibold">{r?.displayName ?? w.roomId}</span>
                    <span className="block text-muted">
                      {formatDuration(w.minMinutes)}+ slot by {formatTime(w.after + 30 * 60_000)}, {formatDateLabel(w.date)}
                    </span>
                  </button>
                  <button type="button" onClick={() => { deleteServerWatch(w.server); watches.remove(w.id); }} className="font-semibold text-muted underline underline-offset-2 hover:text-fg">
                    Cancel
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(favRooms.length > 0 || favBuildings.length > 0) && !anyFilter(filters) && (
        <section aria-label="Favorites">
          <h2 className="flex items-center gap-1.5 px-4 pt-4 pb-1.5 text-[13px] font-medium text-subtle">
            <Star size={12} filled className="text-yellow" /> Favorites
          </h2>
          <ul className="border-t border-line">
            {favBuildings.map((m) => (
              <Row key={m.building.id} info={m} distance={pos ? formatDistance(dist(m)) : null} />
            ))}
            {favRooms.map((r) => {
              const b = getBuilding(r.buildingId)!;
              const st = roomStatus(roomDay(r, sel.date, sel.now, { demo, live }), sel.at);
              return (
                <li key={r.id} className="border-b border-line">
                  <button type="button" onClick={() => navigate(`/b/${b.id}`, { room: r.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{r.displayName}</span>
                      <span className="block truncate text-xs text-muted">{b.headline}</span>
                    </span>
                    <StatusChip status={st} />
                    <ChevronRight size={14} className="shrink-0 text-subtle" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
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

      {!anyFilter(filters) && (
        <section aria-label="Open study spaces">
          <h2 className="flex items-center gap-2 px-4 pt-4 pb-1.5 text-[13px] font-medium text-subtle">
            <span className="size-2 rounded-full bg-space" aria-hidden="true" />
            Open study spaces · walk-in, not reservable
          </h2>
          <ul className="border-t border-line">
            {(pos ? [...openSpaces].sort((a, b) => distanceMeters(pos, a.location) - distanceMeters(pos, b.location)) : openSpaces).map((s) => (
              <SpaceRow key={s.id} space={s} live={live} sel={sel} distance={pos ? formatDistance(distanceMeters(pos, s.location)) : null} />
            ))}
          </ul>
        </section>
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
  const { open, total, unavailable } = info.counts;
  if (open === 0 && unavailable === total) return <span className={`${base} bg-surface-2 text-muted`}>Closed</span>;
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
  const isFav = useFavorites().has(buildingKey(b.id));
  return (
    <li className="border-b border-line">
      <button type="button" onClick={() => navigate(`/b/${b.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {b.headline}
            {isFav && <Star size={12} filled className="ml-1.5 inline align-[-1px] text-yellow" aria-label="Favorite" />}
          </span>
          {distance && <span className="block truncate text-xs text-muted">{distance}</span>}
        </span>
        <Badge info={info} />
        <ChevronRight size={14} className="shrink-0 text-subtle" />
      </button>
    </li>
  );
}

function RouteControls({ target, route, onRoute, onClearRoute }: { target: MarkerInfo; route: RouteState; onRoute: (id: string) => void; onClearRoute: () => void }) {
  const mine = route.status !== 'idle' && route.targetId === target.building.id;
  if (mine && route.status === 'ok') {
    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-fg">{formatWalk(route.route)} to {target.building.mapLabel ?? target.building.headline}</span>
          <button type="button" onClick={onClearRoute} className="font-semibold underline underline-offset-2 hover:text-fg">
            Hide route
          </button>
        </div>
        <p className="text-[11px] text-subtle">
          <a href={ROUTE_ATTRIBUTION.about} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{ROUTE_ATTRIBUTION.text}</a> ·{' '}
          <a href={ROUTE_ATTRIBUTION.fix} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Fix the map</a>
        </p>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => onRoute(target.building.id)}
        disabled={mine && route.status === 'loading'}
        className="inline-flex h-8 items-center gap-1.5 rounded-control bg-accent px-3 text-xs font-semibold text-accent-ink disabled:opacity-60"
      >
        {mine && route.status === 'loading' ? 'Finding route…' : `Show walking route to ${target.building.mapLabel ?? target.building.headline}`}
      </button>
      {mine && route.status === 'error' && <p className="mt-1 text-busy-text">{route.message}. The map shows a straight line instead.</p>}
      <p className="mt-1 text-[11px] text-subtle">Sends your location to routing.openstreetmap.de (FOSSGIS) to draw the path.</p>
    </div>
  );
}

function SpaceRow({ space, live, sel, distance }: { space: import('@nittany-rooms/core').OpenSpace; live: LiveState; sel: SelectedTime; distance: string | null }) {
  const st = spaceStatus(space, live, sel);
  const base = 'inline-flex h-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular whitespace-nowrap';
  const badge =
    st.state === 'open' ? (
      <span className={`${base} bg-open-soft text-open-text`}>Open · until {formatTime(st.until)}</span>
    ) : st.state === 'closed' ? (
      <span className={`${base} bg-surface-2 text-muted`}>Closed{st.opensAt ? ` · opens ${formatTime(st.opensAt)}` : ''}</span>
    ) : (
      <span className={`${base} bg-space-soft text-space-text`}>Check hours</span>
    );
  return (
    <li className="border-b border-line">
      <a href={space.url} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 px-4 py-3 text-left no-underline hover:bg-surface-2">
        <span className="h-8 w-1 shrink-0 rounded-full bg-space" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{space.name}</span>
          <span className="block truncate text-xs text-muted">
            {space.access}
            {distance ? ` · ${distance}` : ''}
          </span>
        </span>
        {badge}
        <External size={13} className="shrink-0 text-subtle" />
        <span className="sr-only">(opens official page in a new tab)</span>
      </a>
    </li>
  );
}
