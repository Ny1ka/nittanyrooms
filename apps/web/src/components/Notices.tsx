import { formatTime } from '@nittany-rooms/core';
import type { LiveState } from '../lib/live';
import { navigate, setParams, useRoute } from '../lib/router';

/** Shown on every page in demo mode. Sample data never appears without it. */
export function DemoBanner() {
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-glow px-4 py-2 text-center text-sm font-semibold text-navy">
      <span>Demo mode: statuses and times are sample data, not real Penn State availability.</span>
      <button type="button" className="underline underline-offset-2" onClick={() => setParams({ demo: null })}>
        Exit demo
      </button>
    </div>
  );
}

/** Grey-dot freshness note from the design system. */
export function FreshnessNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-control bg-paper px-3 py-2.5 text-small leading-snug text-ink-muted">
      <span className="mt-1 size-2 shrink-0 rounded-full bg-dot" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function AvailabilityFreshness({ demo, live, scope = 'campus' }: { demo: boolean; live?: LiveState; scope?: 'campus' | 'libcal' | 'outlook' }) {
  if (demo) return <FreshnessNote>Sample data, not real Penn State availability.</FreshnessNote>;
  const ecore = scope === 'campus' ? ' Engineering Library (ECoRE) rooms: check on PSU site.' : '';
  if (scope === 'outlook') {
    return (
      <FreshnessNote>
        These rooms are booked in Outlook, and their schedules aren't public, so they show <strong>Check on PSU site</strong>.
      </FreshnessNote>
    );
  }
  switch (live?.status) {
    case 'ok':
      return (
        <FreshnessNote>
          Library availability is live from Penn State's LibCal, checked {formatTime(live.retrievedAt)}. Penn State's page has the final say.{ecore}
        </FreshnessNote>
      );
    case 'loading':
      return <FreshnessNote>Checking library availability with Penn State…</FreshnessNote>;
    case 'error':
      return (
        <FreshnessNote>
          Couldn't reach Penn State's LibCal just now, so library rooms show <strong>Check on PSU site</strong>.{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={live.refetch}>
            Try again
          </button>
        </FreshnessNote>
      );
    case 'disabled':
      return (
        <FreshnessNote>
          Live library availability is turned off right now, so rooms show <strong>Check on PSU site</strong>. <TryDemoLink />
        </FreshnessNote>
      );
    case 'out-of-range':
      return <FreshnessNote>Penn State only takes library bookings up to two weeks ahead.</FreshnessNote>;
    default:
      return (
        <FreshnessNote>
          Live availability isn't connected, so rooms show <strong>Check on PSU site</strong>. <TryDemoLink />
        </FreshnessNote>
      );
  }
}

function TryDemoLink() {
  const { route } = useRoute();
  return (
    <button
      type="button"
      className="font-semibold underline underline-offset-2"
      onClick={() => {
        if (route.name === 'campus') navigate('/', { demo: '1' });
        else setParams({ demo: '1' });
      }}
    >
      Preview with sample data
    </button>
  );
}

export function Footer() {
  return (
    <footer className="px-4 pb-6 text-xs leading-relaxed text-slate sm:px-6">
      Student-made. Not an official Penn State service, and not affiliated with or endorsed by Penn State. Availability can change, and Penn State's own systems decide eligibility and confirm every booking.{' '}
      <a href="https://github.com/Ny1ka/nittanyrooms/issues/new" target="_blank" rel="noopener noreferrer" className="underline">
        Report wrong or outdated info
      </a>
      . Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors.
    </footer>
  );
}
