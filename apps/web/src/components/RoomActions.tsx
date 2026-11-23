import { buildHandoff, formatDateLabel, formatRange, MINUTE, toTimeInputValue, type Building, type Interval, type Room } from '@nittany-rooms/core';
import { useState } from 'react';
import { buildIcs, googleCalendarUrl } from '../lib/calendar';
import { getProvider } from '../lib/data';
import { Calendar, Check, External } from './Icons';

/** Link that reopens this exact room, date and time. */
export function roomShareUrl(room: Room, building: Building, date: string, start: number) {
  const q = new URLSearchParams({ room: room.id, d: date, t: toTimeInputValue(start) });
  return `${window.location.origin}/b/${building.id}?${q}`;
}

const actionBtn = 'inline-flex h-8 items-center gap-1.5 rounded-control bg-surface-2 px-2.5 text-xs font-semibold text-fg hover:bg-surface-3';

/** Secondary room actions under the booking button. */
export function RoomActions({ room, building, date, selection, at }: { room: Room; building: Building; date: string; selection: Interval | null; at: number }) {
  const [calOpen, setCalOpen] = useState(false);
  const [shared, setShared] = useState<'idle' | 'copied' | 'shown'>('idle');
  const when = selection ?? { start: at, end: at + 60 * MINUTE };
  const booking = buildHandoff({ room, building, provider: getProvider(room.providerId), date, selection: when });
  const ev = {
    uid: `${room.id}-${when.start}`,
    title: `Study: ${room.displayName}`,
    start: when.start,
    end: when.end,
    location: `${room.displayName}, ${building.name}, University Park, PA`,
    description: `Study room ${formatRange(when.start, when.end)}. Booked on Penn State's system; check your confirmation email.`,
    url: booking.url,
  };
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(ev))}`;

  const shareUrl = roomShareUrl(room, building, date, when.start);
  async function share() {
    const text = `${room.displayName} (${building.headline}), ${formatDateLabel(date)} ${formatRange(when.start, when.end)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Study room: ${room.displayName}`, text, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShared('copied');
      setTimeout(() => setShared('idle'), 2500);
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return; // user closed the share sheet
      setShared('shown'); // clipboard blocked: show the link to copy by hand
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-expanded={calOpen} onClick={() => setCalOpen((o) => !o)} className={actionBtn}>
          <Calendar size={13} /> Add to calendar
        </button>
        <button type="button" onClick={share} className={actionBtn}>
          {shared === 'copied' ? <Check size={13} /> : <External size={13} />}
          {shared === 'copied' ? 'Link copied' : 'Share room'}
        </button>
      </div>
      <span role="status" className="sr-only">
        {shared === 'copied' ? 'Link to this room copied' : ''}
      </span>
      {shared === 'shown' && (
        <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Link to this room" className="h-8 w-full rounded-control border border-line bg-surface-2 px-2 text-xs text-fg" />
      )}
      {calOpen && (
        <div className="rounded-control border border-line p-2.5 text-xs text-muted">
          <p className="mb-2">Add {formatRange(when.start, when.end)} after Penn State confirms your booking.</p>
          <div className="flex flex-wrap gap-1.5">
            <a href={icsHref} download={`nittany-rooms-${room.id}.ics`} className={`${actionBtn} no-underline`}>
              Apple / Outlook (.ics)
            </a>
            <a href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" className={`${actionBtn} no-underline`}>
              Google Calendar
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
