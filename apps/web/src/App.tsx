import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Controls } from './components/Controls';
import { ChevronUp } from './components/Icons';
import { DemoBanner } from './components/Notices';
import { buildingMatches, NO_FILTERS, type Filters } from './lib/filters';
import { requestLocation, type GeoState } from './lib/geo';
import { fetchWalkingRoute, type RouteState } from './lib/route';
import { spaceStatus } from './lib/openSpaces';
import { useWatcher } from './lib/watcher';
import { buildingCounts, useDemo } from './lib/availability';
import { buildings, getBuilding, openSpaces } from './lib/data';
import { useLiveLibcal } from './lib/live';
import { navigate, useRoute } from './lib/router';
import { useThemePref } from './lib/theme';
import { useSelectedTime } from './lib/time';
import { BuildingPanel } from './views/BuildingPanel';
import { CampusList } from './views/CampusList';
import type { MarkerInfo } from './views/MapView';

const MapView = lazy(() => import('./views/MapView').then((m) => ({ default: m.MapView })));

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

const SHEET_PEEK = 150; // px: handle + header row + first list row
const SHEET_OPEN = 0.7; // fraction of viewport height

export function App() {
  const { route, params } = useRoute();
  const sel = useSelectedTime();
  const demo = useDemo();
  const [themePref, setThemePref] = useThemePref();
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const locate = () => requestLocation(setGeo);
  const alerts = useWatcher(sel.now);
  const [walk, setWalk] = useState<RouteState>({ status: 'idle' });
  const showRoute = (buildingId: string) => {
    const b = getBuilding(buildingId);
    if (geo.status !== 'ok' || !b) return;
    setWalk({ status: 'loading', targetId: buildingId });
    fetchWalkingRoute(geo.pos, b.location)
      .then((r) => setWalk({ status: 'ok', targetId: buildingId, route: r }))
      .catch((e: Error) => setWalk({ status: 'error', targetId: buildingId, message: e.message || 'Couldn’t get a walking route' }));
  };
  const routeTarget = walk.status !== 'idle' ? getBuilding(walk.targetId) : undefined;
  const routeLine =
    walk.status === 'ok'
      ? { coords: walk.route.coords, fallback: false }
      : walk.status === 'error' && geo.status === 'ok' && routeTarget
        ? { coords: [[geo.pos.lon, geo.pos.lat], [routeTarget.location.lon, routeTarget.location.lat]] as [number, number][], fallback: true }
        : null;
  const live = useLiveLibcal(sel.date, sel.now);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const isDesktop = useMedia('(min-width: 768px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const markers: MarkerInfo[] = useMemo(
    () =>
      buildings.map((b) => {
        const counts = buildingCounts(b.id, sel.date, sel.at, sel.now, demo, live);
        return { building: b, counts, known: counts.total > 0 && counts.unknown < counts.total };
      }),
    [sel.date, sel.at, sel.now, demo, live],
  );
  const visible = markers.filter((m) => buildingMatches(m.building.id, filters, sel, demo, live));
  const visibleKey = visible.map((m) => m.building.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visibleIds = useMemo(() => new Set(visible.map((m) => m.building.id)), [visibleKey]);
  const selectedId = route.name === 'building' ? route.buildingId : null;
  const roomId = params.get('room');

  // Title, scroll reset and focus on navigation.
  useEffect(() => {
    const b = selectedId ? getBuilding(selectedId) : undefined;
    document.title = b ? `${b.headline} · Nittany Rooms` : 'Nittany Rooms: study rooms at University Park';
    scroller.current?.scrollTo({ top: 0 });
    if (selectedId) setSheetOpen(true);
  }, [selectedId, roomId]);

  const bottomPadding = isDesktop ? 0 : sheetOpen ? Math.round(window.innerHeight * SHEET_OPEN) : SHEET_PEEK;

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <a href="#sidebar-content" className="sr-only-focusable rounded-control bg-accent px-3 py-2 text-xs font-semibold text-accent-ink">
        Skip to content
      </a>
      <aside
        aria-label="Study rooms"
        className="fixed inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-sheet border-t border-line bg-surface shadow-float transition-[height] duration-200 ease-out md:static md:z-auto md:h-full md:w-[460px] xl:w-[500px] md:shrink-0 md:rounded-none md:border-t-0 md:border-r md:shadow-none"
        style={isDesktop ? undefined : { height: sheetOpen ? `${SHEET_OPEN * 100}dvh` : SHEET_PEEK }}
      >
        {!isDesktop && (
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            aria-label={sheetOpen ? 'Collapse panel' : 'Expand panel'}
            className="flex h-6 shrink-0 items-center justify-center text-subtle"
          >
            <span className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <ChevronUp size={12} className={`ml-1 transition-transform ${sheetOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
        {demo && <DemoBanner />}
        {alerts.fired.map((a) => (
          <div key={a.id} role="alert" className="flex items-start gap-3 border-b border-line bg-open-soft px-4 py-2.5 text-xs text-open-text">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">🔔 {a.title}</span>
              <span className="block">{a.body}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                alerts.dismiss(a.id);
                navigate(`/b/${a.buildingId}`, { room: a.roomId });
              }}
              className="font-semibold underline underline-offset-2"
            >
              View room
            </button>
            <button type="button" aria-label="Dismiss alert" onClick={() => alerts.dismiss(a.id)} className="font-semibold">
              ×
            </button>
          </div>
        ))}
        <Controls sel={sel} filters={filters} setFilters={setFilters} geo={geo} onLocate={locate} themePref={themePref} setThemePref={setThemePref} liveCheckedAt={live.status === 'ok' ? live.retrievedAt : null} />
        <div ref={scroller} id="sidebar-content" tabIndex={-1} className="scrollbar-thin flex-1 overflow-y-auto outline-none" onFocus={() => setSheetOpen(true)}>
          <main>
            {route.name === 'building' ? (
              <BuildingPanel buildingId={route.buildingId} sel={sel} demo={demo} live={live} filters={filters} clearFilters={() => setFilters(NO_FILTERS)} />
            ) : (
              <CampusList markers={markers} visible={visible} filters={filters} setFilters={setFilters} demo={demo} live={live} geo={geo} sel={sel} route={walk} onRoute={showRoute} onClearRoute={() => setWalk({ status: 'idle' })} onExitNearby={() => { setWalk({ status: 'idle' }); setGeo({ status: 'idle' }); }} />
            )}
          </main>
        </div>
      </aside>

      <section aria-label="Campus map" className="fixed inset-0 md:relative md:flex-1">
        <Suspense fallback={<div className="absolute inset-0 bg-bg" />}>
          <MapView
            markers={markers}
            visibleIds={visibleIds}
            selectedId={selectedId}
            onSelect={(id) => navigate(`/b/${id}`)}
            bottomPadding={bottomPadding}
            userPos={geo.status === 'ok' ? geo.pos : null}
            onLocate={locate}
            routeLine={routeLine}
            spaceStatuses={Object.fromEntries(openSpaces.filter((s) => s.footprint).map((s) => [s.id, spaceStatus(s, live, sel)]))}
          />
        </Suspense>
        <Legend />
      </section>
    </div>
  );
}

const LEGEND: [string, string, string][] = [
  ['bg-open', 'Rooms open', 'At least one room bookable now'],
  ['bg-yellow', 'Opening soon', 'A room opens within 30 minutes'],
  ['bg-closing', 'Closing soon', 'Rooms close for the day within 30 minutes'],
  ['bg-busy', 'None open', 'All rooms booked for now'],
  ['bg-[#6b7280]', 'Closed', 'No bookable time right now'],
  ['fill-unknown ring-1 ring-subtle', 'Check PSU site', 'Availability isn’t public'],
  ['bg-space', 'Walk-in study space', 'No reservation needed'],
  ['border border-dashed border-subtle', 'Not verified', 'Rooms not listed yet'],
];

/** Collapsed map key: a dot strip that expands into a compact card. */
function Legend() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div ref={ref} className="absolute top-3 left-3 z-10">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="map-key"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface/95 px-3 text-[11px] font-semibold text-muted shadow-float hover:text-fg"
      >
        <span className="flex -space-x-0.5" aria-hidden="true">
          {LEGEND.slice(0, 6).map(([cls]) => (
            <span key={cls} className={`size-2.5 rounded-full ring-2 ring-surface ${cls}`} />
          ))}
        </span>
        Key
      </button>
      {open && (
        <div id="map-key" role="dialog" aria-label="Map key" className="mt-1.5 w-64 rounded-panel border border-line bg-surface p-3 text-xs shadow-float">
          <ul className="space-y-2">
            {LEGEND.map(([cls, label, hint]) => (
              <li key={label} className="flex items-start gap-2.5">
                <span className={`mt-0.5 size-3 shrink-0 rounded-full ${cls}`} aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-fg">{label}</span>
                  <span className="block text-subtle">{hint}</span>
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2.5 border-t border-line pt-2">
              <span className="mt-0.5 size-3 shrink-0 rounded-full border-2 border-white bg-[#3b82f6]" aria-hidden="true" />
              <span className="font-semibold text-fg">You are here</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-1 w-3 shrink-0 rounded-full bg-[#3b82f6]" aria-hidden="true" />
              <span className="font-semibold text-fg">Walking route</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
