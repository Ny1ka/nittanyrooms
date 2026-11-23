import { useEffect } from 'react';
import { Header } from './components/Header';
import { DemoBanner, Footer } from './components/Notices';
import { useDemo } from './lib/availability';
import { getBuilding } from './lib/data';
import { useRoute } from './lib/router';
import { useSelectedTime } from './lib/time';
import { BuildingView } from './views/BuildingView';
import { CampusView } from './views/CampusView';

export function App() {
  const { route } = useRoute();
  const sel = useSelectedTime();
  const demo = useDemo();

  useEffect(() => {
    const b = route.name === 'building' ? getBuilding(route.buildingId) : undefined;
    document.title = b ? `${b.headline} · Nittany Rooms` : 'Nittany Rooms: study rooms at University Park';
  }, [route]);

  // Move focus to main content on page change so screen readers announce it.
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [route.name, route.name === 'building' ? route.buildingId : '']);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only-focusable rounded-control bg-navy px-4 py-2 font-semibold text-white">
        Skip to content
      </a>
      {demo && <DemoBanner />}
      <Header sel={sel} searchPlaceholder={route.name === 'building' ? 'Search rooms and buildings' : undefined} />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {route.name === 'building' ? <BuildingView buildingId={route.buildingId} sel={sel} /> : <CampusView sel={sel} />}
      </main>
      <Footer />
    </div>
  );
}
