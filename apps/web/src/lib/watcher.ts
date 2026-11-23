import { campusDate, formatDateLabel, formatRange, MINUTE, type BookableWindow } from '@nittany-rooms/core';
import { useQueries } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { roomDay } from './availability';
import { getBuilding, rooms } from './data';
import { fetchAvailability, type LiveState } from './live';
import { navigate } from './router';
import { useWatches, type Watch } from './watches';

/** A slot counts if it starts within this long of the requested time ("around when I need it"). */
export const WATCH_SLACK_MINUTES = 30;

/** The first window that frees up around `after` and stays free for `minMinutes`. */
export function matchingWindow(windows: BookableWindow[], w: Pick<Watch, 'after' | 'minMinutes'>): BookableWindow | undefined {
  return windows.find(
    (x) => x.end > w.after && x.start <= w.after + WATCH_SLACK_MINUTES * MINUTE && (x.end - Math.max(x.start, w.after)) / MINUTE >= w.minMinutes,
  );
}

export interface FiredAlert {
  id: string;
  roomId: string;
  buildingId: string;
  title: string;
  body: string;
}

/**
 * Checks every active watch against live LibCal data. Data refreshes every 3 min
 * (also in background tabs while a watch is active). Fires a browser notification
 * (if permitted) and an in-app alert, then removes the watch.
 */
export function useWatcher(now: number): { fired: FiredAlert[]; dismiss: (id: string) => void } {
  const watches = useWatches();
  const [fired, setFired] = useState<FiredAlert[]>([]);
  const today = campusDate(now);
  const dates = [...new Set(watches.list.map((w) => w.date))].filter((d) => d >= today);
  const results = useQueries({
    queries: dates.map((date) => ({
      queryKey: ['libcal-availability', date],
      queryFn: () => fetchAvailability(date),
      refetchInterval: 3 * 60_000,
      refetchIntervalInBackground: true,
      staleTime: 2 * 60_000,
    })),
  });
  const done = useRef(new Set<string>());

  useEffect(() => watches.prune(today), [today]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    dates.forEach((date, i) => {
      const data = results[i]?.data;
      if (!data) return;
      const live: LiveState = { status: 'ok', data, retrievedAt: Date.parse(data.retrievedAt), refetch: () => {} };
      for (const w of watches.list.filter((x) => x.date === date)) {
        if (done.current.has(w.id)) continue;
        const room = rooms.find((r) => r.id === w.roomId);
        if (!room) continue;
        const day = roomDay(room, date, now, { demo: false, live });
        const win = matchingWindow(day.windows, w);
        if (!win) continue;
        done.current.add(w.id);
        const b = getBuilding(w.buildingId);
        const alert: FiredAlert = {
          id: w.id,
          roomId: w.roomId,
          buildingId: w.buildingId,
          title: `${room.displayName} just opened up`,
          body: `${formatRange(Math.max(win.start, w.after), win.end)}${date === today ? ' today' : `, ${formatDateLabel(date)}`} · ${b?.headline ?? ''}`,
        };
        setFired((f) => [...f.filter((x) => x.id !== alert.id), alert]);
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification(alert.title, { body: `${alert.body}. Tap to book on Penn State's site.`, tag: w.id, icon: '/favicon.svg' });
            n.onclick = () => {
              window.focus();
              navigate(`/b/${w.buildingId}`, { room: w.roomId, d: date });
            };
          }
        } catch {
          /* notifications unavailable; the in-app alert still shows */
        }
        watches.remove(w.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(','), watches.list, now]);

  return { fired, dismiss: (id) => setFired((f) => f.filter((x) => x.id !== id)) };
}
