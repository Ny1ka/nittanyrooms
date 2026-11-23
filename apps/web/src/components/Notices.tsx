import { navigate, setParams } from '../lib/router';
import { useRoute } from '../lib/router';

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

export function AvailabilityFreshness({ demo }: { demo: boolean }) {
  return (
    <FreshnessNote>
      {demo ? (
        <>Sample data. Live availability isn't connected yet.</>
      ) : (
        <>
          Live availability isn't connected yet, so rooms show <strong>Check on PSU site</strong>.{' '}
          <TryDemoLink />
        </>
      )}
    </FreshnessNote>
  );
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
