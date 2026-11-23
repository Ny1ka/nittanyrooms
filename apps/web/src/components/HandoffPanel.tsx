import { buildHandoff, type Building, type Interval, type Room } from '@nittany-rooms/core';
import { useState } from 'react';
import { getProvider } from '../lib/data';
import { Check, Copy, External } from './Icons';

/**
 * Official reservation handoff. Never claims a booking: the CTA leaves for
 * Penn State's system and the copy says what's left to do there.
 */
export function HandoffPanel({ room, building, date, selection }: { room: Room; building: Building; date: string; selection: Interval | null }) {
  const provider = getProvider(room.providerId);
  const h = buildHandoff({ room, building, provider, date, selection });
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(h.copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the text is visible */
    }
  }
  const when = h.summary.time ? `${h.summary.date} · ${h.summary.time}` : h.summary.date;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-control bg-surface-2 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{h.summary.room}</div>
          <div className="text-xs text-muted tabular">
            {when}
            {h.summary.duration ? ` · ${h.summary.duration}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-muted hover:bg-surface-3 hover:text-fg"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
          <span className="sr-only"> room and time</span>
        </button>
        <span role="status" className="sr-only">
          {copied ? 'Room and time copied to clipboard' : ''}
        </span>
      </div>

      <a
        href={h.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-11 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[14px] font-semibold text-accent-ink no-underline hover:brightness-105"
      >
        Continue to Penn State reservation
        <External size={14} />
        <span className="sr-only">(opens {h.providerName} in a new tab)</span>
      </a>

      <details className="group text-xs text-muted">
        <summary className="cursor-pointer list-none font-semibold text-fg marker:hidden">
          <span className="underline-offset-2 group-open:underline">What happens next</span>
        </summary>
        <p className="mt-2">
          {h.mode === 'room-link'
            ? h.datePreselected
              ? `Opens Penn State's page for ${h.summary.room}, already on ${h.summary.date}.${h.summary.time ? ` Tap ${h.summary.time} on its calendar.` : ''}`
              : `Opens Penn State's page for ${h.summary.room} in a new tab.`
            : `Opens ${provider.system === 'outlook' ? 'Outlook Calendar' : provider.name} in a new tab. There's no direct link to this room, so:`}
        </p>
        <ol className="mt-1.5 ml-4 list-decimal space-y-1">
          {h.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </details>
      <p className="text-xs leading-relaxed text-subtle">
        {h.confirmation === 'approval-email'
          ? 'Requests need approval. It isn’t reserved until you get the approval email.'
          : 'It isn’t reserved until Penn State emails your confirmation.'}{' '}
        Times may have changed since the last check.
        {provider.supportContact && (
          <>
            {' '}
            Help:{' '}
            <a href={`mailto:${provider.supportContact}`} className="underline underline-offset-2 hover:text-fg">
              {provider.supportContact}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
