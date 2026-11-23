import { DateTime } from 'luxon';
import { sources } from '../lib/data';
import type { ThemePref } from '../lib/theme';
import { GitHub } from './Icons';

const REPO = 'https://github.com/Ny1ka/nittanyrooms';
const h = 'text-[11px] font-semibold tracking-wide text-subtle uppercase';

/** Settings + provenance, like illiniSpots' footer panel, kept short. */
export function About({ pref, setPref, liveCheckedAt }: { pref: ThemePref; setPref: (p: ThemePref) => void; liveCheckedAt: number | null }) {
  const roomsChecked = sources.find((s) => s.id === 'psu-libcal-up-spaces')?.retrievedAt;
  return (
    <section aria-label="About and settings" className="space-y-4 text-xs text-muted">
      <p className="text-[11px] text-subtle">Nittany Rooms · student-made, not an official Penn State service.</p>
      <div className="space-y-2">
        <h2 className={h}>Appearance</h2>
        <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-control bg-surface-2 p-1">
          {(['light', 'dark', 'auto'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={pref === p}
              onClick={() => setPref(p)}
              className={`h-7 rounded-[6px] text-xs font-semibold capitalize ${pref === p ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <details className="group">
        <summary className={`${h} cursor-pointer list-none`}>Important notes</summary>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li>Student-made. Not an official Penn State service. Penn State's systems decide eligibility and confirm every booking.</li>
          <li>Library rooms: live open/booked times from Penn State's public LibCal, cached about 3 minutes.</li>
          <li>Engineering (ECoRE) rooms are booked in Outlook. Their schedules aren't public, so they show "Check PSU site".</li>
          <li>Floors are read from room numbers. No floor plans are shown until officially sourced.</li>
          <li>Gaps under 30 minutes are hidden by default. Availability can change at any moment.</li>
        </ul>
      </details>

      <details className="group">
        <summary className={`${h} cursor-pointer list-none`}>Data updates</summary>
        <ul className="mt-2 space-y-1">
          <li>
            Availability: {liveCheckedAt ? `checked ${DateTime.fromMillis(liveCheckedAt).toFormat('h:mm a')}, refreshes every 3 min` : 'not loaded'}
          </li>
          {roomsChecked && <li>Room list: Penn State LibCal, checked {DateTime.fromISO(roomsChecked).toFormat('LLL d, yyyy')}</li>}
          <li>Engineering rooms: Penn State University Libraries, checked Nov 22, 2026</li>
          <li>
            Map: ©{' '}
            <a className="underline underline-offset-2 hover:text-fg" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{' '}
            contributors, tiles by OpenFreeMap
          </li>
        </ul>
      </details>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-fg hover:underline">
          <GitHub size={14} /> View on GitHub
        </a>
        <a href={`${REPO}/issues/new`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
          Report wrong info
        </a>
      </div>
    </section>
  );
}
