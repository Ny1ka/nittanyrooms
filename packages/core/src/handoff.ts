import { formatDateLabel, formatDuration, formatRange } from './format.js';
import { CAMPUS_TIMEZONE, type Building, type ReservationProvider, type Room } from './schema.js';
import type { Interval } from './availability/intervals.js';

export interface Handoff {
  /** Official destination. Never a Nittany Rooms URL. */
  url: string;
  /** True when the official page opens on the selected date. */
  datePreselected: boolean;
  /** Effective mode — falls back to portal when a room has no verified link. */
  mode: 'room-link' | 'portal-with-instructions';
  providerName: string;
  steps: string[];
  confirmation: ReservationProvider['confirmation'];
  summary: {
    room: string;
    building: string;
    floor: string;
    date: string;
    time: string | null;
    duration: string | null;
  };
  /** Plain text for the clipboard so the student can paste it on PSU's site. */
  copyText: string;
}

/**
 * Build the official reservation handoff. Date/time parameters are never appended:
 * no PSU provider has a documented, tested deep-link format for them yet.
 */
export function buildHandoff(args: {
  room: Room;
  building: Building;
  provider: ReservationProvider;
  date: string;
  selection: Interval | null;
  zone?: string;
}): Handoff {
  const { room, building, provider, date, selection } = args;
  const zone = args.zone ?? CAMPUS_TIMEZONE;
  const useRoomLink = provider.handoffMode === 'room-link' && room.bookingUrl !== null;
  const floor = building.floors.find((f) => f.id === room.floorId);

  const time = selection ? formatRange(selection.start, selection.end, zone) : null;
  const duration = selection
    ? formatDuration((selection.end - selection.start) / 60_000)
    : null;
  const dateLabel = formatDateLabel(date, zone);

  const summary = {
    room: room.displayName,
    building: building.name,
    floor: !floor ? 'Floor not verified' : floor.unlisted ? 'Floor not listed' : `Floor ${floor.label}`,
    date: dateLabel,
    time,
    duration,
  };

  const copyText = [
    `${room.displayName}, ${building.name}`,
    time ? `${dateLabel}, ${time}` : dateLabel,
  ].join('\n');

  let url = useRoomLink ? room.bookingUrl! : provider.portalUrl;
  if (useRoomLink && provider.deepLink) {
    const u = new URL(url);
    u.searchParams.set(provider.deepLink.dateParam, date);
    url = u.toString();
  }

  return {
    url,
    /** True when the official page opens on the selected date. */
    datePreselected: useRoomLink && !!provider.deepLink,
    mode: useRoomLink ? 'room-link' : 'portal-with-instructions',
    providerName: provider.name,
    steps: provider.handoffSteps,
    confirmation: provider.confirmation,
    summary,
    copyText,
  };
}
