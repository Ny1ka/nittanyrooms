import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Controls } from './components/Controls';
import { ChevronUp } from './components/Icons';
import { DemoBanner } from './components/Notices';
import { buildingMatches, NO_FILTERS, type Filters } from './lib/filters';
import { requestLocation, type GeoState } from './lib/geo';
import { fetchWalkingRoute, type RouteState } from './lib/route';
import { buildingCounts, useDemo } from './lib/availability';
import { buildings, getBuilding } from './lib/data';
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
        <Controls sel={sel} filters={filters} setFilters={setFilters} geo={geo} onLocate={locate} themePref={themePref} setThemePref={setThemePref} liveCheckedAt={live.status === 'ok' ? live.retrievedAt : null} />
        <div ref={scroller} id="sidebar-content" tabIndex={-1} className="scrollbar-thin flex-1 overflow-y-auto outline-none" onFocus={() => setSheetOpen(true)}>
          <main>
            {route.name === 'building' ? (
              <BuildingPanel buildingId={route.buildingId} sel={sel} demo={demo} live={live} filters={filters} clearFilters={() => setFilters(NO_FILTERS)} />
            ) : (
              <CampusList markers={markers} visible={visible} filters={filters} setFilters={setFilters} demo={demo} live={live} geo={geo} sel={sel} route={walk} onRoute={showRoute} onClearRoute={() => setWalk({ status: 'idle' })} />
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
          />
        </Suspense>
        <Legend />
      </section>
    </div>
  );
}

function Legend() {
  const item = (cls: string, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${cls}`} aria-hidden="true" />
      {text}
    </span>
  );
  return (
    <div className="pointer-events-none absolute top-3 left-3 hidden gap-3 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-[11px] text-muted md:flex">
      {item('bg-open', 'Rooms open')}
      {item('bg-busy', 'None open')}
      {item('fill-unknown', 'Check PSU site')}
      {item('border border-dashed border-subtle', 'Not verified')}
    </div>
  );
}
