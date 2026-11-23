import { formatTime } from '@nittany-rooms/core';
import type { LiveState } from '../lib/live';
import { setParams } from '../lib/router';

/** Shown on every page in demo mode. Sample data never appears without it. */
export function DemoBanner() {
  return (
    <div role="status" className="flex items-center justify-between gap-3 bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink">
      <span>Demo mode: sample data, not real Penn State availability.</span>
      <button type="button" className="underline underline-offset-2" onClick={() => setParams({ demo: null })}>
        Exit
      </button>
    </div>
  );
}

/** Quiet provenance line with a status dot. */
export function FreshnessNote({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'live' | 'muted' | 'warn' }) {
  const dot = tone === 'live' ? 'bg-accent' : tone === 'warn' ? 'bg-now' : 'bg-subtle';
  return (
    <p className="flex items-start gap-2 text-xs leading-snug text-muted">
      <span className={`mt-[5px] size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

const linkBtn = 'font-semibold text-fg underline underline-offset-2';

export function AvailabilityFreshness({
  demo,
  live,
  scope = 'campus',
}: {
  demo: boolean;
  live?: LiveState;
  scope?: 'campus' | 'libcal' | 'outlook';
}) {
  if (demo) return <FreshnessNote tone="warn">Sample data, not real Penn State availability.</FreshnessNote>;
  if (scope === 'outlook') {
    return <FreshnessNote>Booked in Outlook. Schedules aren't public, so rooms show “Check PSU site”.</FreshnessNote>;
  }
  switch (live?.status) {
    case 'ok':
      return (
        <FreshnessNote tone="live">
          Live from Penn State's LibCal · checked {formatTime(live.retrievedAt)}
          {scope === 'campus' ? '. ECoRE rooms: check PSU site.' : ''}
        </FreshnessNote>
      );
    case 'loading':
      return <FreshnessNote>Checking availability with Penn State…</FreshnessNote>;
    case 'error':
      return (
        <FreshnessNote tone="warn">
          Couldn't reach Penn State's LibCal.{' '}
          <button type="button" className={linkBtn} onClick={live.refetch}>
            Retry
          </button>
        </FreshnessNote>
      );
    case 'disabled':
      return (
        <FreshnessNote>
          Live availability is off right now.{' '}
          <button type="button" className={linkBtn} onClick={() => setParams({ demo: '1' })}>
            Preview sample data
          </button>
        </FreshnessNote>
      );
    case 'out-of-range':
      return <FreshnessNote>Penn State takes library bookings up to two weeks ahead.</FreshnessNote>;
    default:
      return <FreshnessNote>Live availability isn't connected.</FreshnessNote>;
  }
}

export function Footer() {
  return (
    <footer className="space-y-1 border-t border-line px-4 py-3 text-[11px] leading-relaxed text-subtle">
      <p>Student-made. Not an official Penn State service. Penn State's systems decide eligibility and confirm every booking.</p>
      <p>
        <a href="https://github.com/Ny1ka/nittanyrooms/issues/new" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
          Report wrong info
        </a>
        {' · '}Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
          OpenStreetMap
        </a>{' '}
        contributors
      </p>
    </footer>
  );
}
