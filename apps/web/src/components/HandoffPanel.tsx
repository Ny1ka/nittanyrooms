import { buildHandoff, type Building, type Interval, type Room } from '@nittany-rooms/core';
import { useState } from 'react';
import { getProvider } from '../lib/data';
import { Check, Copy, External } from './Icons';

/**
 * Official reservation handoff. Never claims a booking: the CTA leaves for
 * Penn State's system, and the copy explains what's left to do there.
 */
export function HandoffPanel({
  room,
  building,
  date,
  selection,
}: {
  room: Room;
  building: Building;
  date: string;
  selection: Interval | null;
}) {
  const provider = getProvider(room.providerId);
  const h = buildHandoff({ room, building, provider, date, selection });
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(h.copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the text is visible on screen */
    }
  }

  const when = h.summary.time ? `${h.summary.date}, ${h.summary.time}` : h.summary.date;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-control border border-line bg-paper p-3 text-sm">
        <div className="font-semibold">
          {h.summary.room} · {building.shortName}, {h.summary.floor.toLowerCase()}
        </div>
        <div className="text-slate tabular">
          {when}
          {h.summary.duration ? ` · ${h.summary.duration}` : ''}
        </div>
        <button
          type="button"
          onClick={copy}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-sm font-semibold underline underline-offset-2"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy room and time'}
        </button>
        <span role="status" className="sr-only">
          {copied ? 'Room and time copied to clipboard' : ''}
        </span>
      </div>

      <a
        href={h.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[52px] items-center justify-center gap-2 rounded-control bg-navy px-4 text-base font-semibold text-white no-underline hover:bg-night"
      >
        Continue to Penn State reservation
        <External />
        <span className="sr-only">(opens {h.providerName} in a new tab)</span>
      </a>

      <div className="text-small leading-relaxed text-slate">
        {h.mode === 'room-link' ? (
          <>Opens Penn State's page for {h.summary.room} in a new tab.</>
        ) : (
          <>
            Opens {provider.system === 'outlook' ? 'Outlook Calendar' : provider.name} in a new tab.
            There's no direct link to this room, so follow these steps there:
          </>
        )}
      </div>
      <ol className="ml-5 list-decimal space-y-1 text-small leading-relaxed text-ink-muted">
        {h.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="text-small leading-relaxed text-slate">
        {h.confirmation === 'approval-email'
          ? 'Booking happens on Penn State’s system, and requests need approval. It isn’t reserved until you get the approval email.'
          : 'Booking happens on Penn State’s system. It isn’t reserved until you get their confirmation email.'}{' '}
        Times may have changed since the last check.
        {provider.supportContact && (
          <>
            {' '}
            Questions about booking:{' '}
            <a href={`mailto:${provider.supportContact}`} className="underline">
              {provider.supportContact}
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}
