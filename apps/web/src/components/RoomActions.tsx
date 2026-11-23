import { buildHandoff, formatRange, MINUTE, type Building, type Interval, type Room } from '@nittany-rooms/core';
import { useState } from 'react';
import { buildIcs, googleCalendarUrl } from '../lib/calendar';
import { getProvider } from '../lib/data';
import { Calendar } from './Icons';

const actionBtn = 'inline-flex h-8 items-center gap-1.5 rounded-control bg-surface-2 px-2.5 text-xs font-semibold text-fg hover:bg-surface-3';

/** Secondary room actions under the booking button. */
export function RoomActions({ room, building, date, selection, at }: { room: Room; building: Building; date: string; selection: Interval | null; at: number }) {
  const [calOpen, setCalOpen] = useState(false);
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-expanded={calOpen} onClick={() => setCalOpen((o) => !o)} className={actionBtn}>
          <Calendar size={13} /> Add to calendar
        </button>
      </div>
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
