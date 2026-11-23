import { formatDateLabel, formatDuration, formatTime, type Building, type Room } from '@nittany-rooms/core';
import { useState } from 'react';
import type { RoomDay } from '../lib/availability';
import { matchingWindow, WATCH_SLACK_MINUTES } from '../lib/watcher';
import { deleteServerWatch, registerServerWatch } from '../lib/push';
import { useWatches } from '../lib/watches';

/** Watch a room and get notified when a long-enough slot opens after the selected time. */
export function NotifyMe({ room, building, date, after, day }: { room: Room; building: Building; date: string; after: number; day: RoomDay }) {
  const watches = useWatches();
  const existing = watches.forRoom(room.id, date);
  const [minMinutes, setMin] = useState(30);
  const [note, setNote] = useState<string | null>(null);
  const btn = 'inline-flex h-8 items-center rounded-control px-3 text-xs font-semibold';

  if (existing) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-control border border-accent-border bg-accent-soft px-3 py-2.5 text-xs text-accent-text">
        <span>
          🔔 You'll be notified if a {formatDuration(existing.minMinutes)}+ slot opens by {formatTime(existing.after + WATCH_SLACK_MINUTES * 60_000)}
          {date ? `, ${formatDateLabel(date)}` : ''}.
        </span>
        <button
          type="button"
          onClick={() => {
            deleteServerWatch(existing.server);
            watches.remove(existing.id);
          }}
          className="font-semibold underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    );
  }

  async function watch() {
    if (matchingWindow(day.windows, { after, minMinutes })) {
      setNote(`It's already free for ${formatDuration(minMinutes)} around ${formatTime(after)}. Pick a time above and book it.`);
      return;
    }
    let permission: NotificationPermission | 'unsupported' = 'unsupported';
    try {
      if ('Notification' in window) {
        permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      }
    } catch {
      /* treat as unsupported */
    }
    watches.add({ roomId: room.id, buildingId: building.id, date, after, minMinutes });
    if (permission !== 'granted') {
      setNote("Browser notifications are off, so you'll see an alert here instead while the page is open.");
      return;
    }
    const server = room.providerRoomId
      ? await registerServerWatch({ roomId: room.id, roomName: room.displayName, buildingId: building.id, eid: room.providerRoomId, date, after, minMinutes })
      : null;
    if (server) {
      watches.attachServer(room.id, date, server);
      setNote("You'll get a notification even if you close this tab.");
    } else {
      setNote(null);
    }
  }

  return (
    <div className="space-y-2 rounded-control border border-line p-3 text-xs text-muted">
      <div className="font-semibold text-fg">Notify me when it opens</div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span>Need at least</span>
          <select value={minMinutes} onChange={(e) => setMin(Number(e.target.value))} className="h-8 rounded-control border border-line bg-surface-2 px-2 text-xs text-fg">
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hr</option>
            <option value={120}>2 hr</option>
          </select>
        </label>
        <span>starting by {formatTime(after + WATCH_SLACK_MINUTES * 60_000)}</span>
        <button type="button" onClick={watch} className={`${btn} bg-accent text-accent-ink`}>
          🔔 Notify me
        </button>
      </div>
      {note && <p role="status" className="text-fg">{note}</p>}
      <p className="text-[11px] text-subtle">
        Notifications reach you even with the site closed where supported (on iPhone, add Nittany Rooms to your Home Screen first). Otherwise it works while the site is open in a tab.
      </p>
    </div>
  );
}
