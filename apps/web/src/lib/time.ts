import { campusDate, localTime, toTimeInputValue } from '@nittany-rooms/core';
import { useEffect, useState } from 'react';
import { setParams, useRoute } from './router';

/** Current time, ticking every 30 s so "now" markers and statuses stay current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface SelectedTime {
  now: number;
  date: string;
  /** HH:mm */
  time: string;
  /** The selected instant (epoch ms). Follows the live clock when isLive. */
  at: number;
  isLive: boolean;
  isToday: boolean;
  setDate: (d: string) => void;
  setTime: (t: string) => void;
  reset: () => void;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Selected date/time shared by map, floor view and timeline (stored in the URL). */
export function useSelectedTime(): SelectedTime {
  const now = useNow();
  const { params } = useRoute();
  const today = campusDate(now);
  const d = params.get('d');
  const t = params.get('t');
  const date = d && DATE_RE.test(d) && d >= today ? d : today;
  const isLive = !t || !TIME_RE.test(t);
  const time = isLive ? toTimeInputValue(now) : t!;
  // A past time today isn't useful for booking; treat it as "now".
  const picked = isLive && date === today ? now : localTime(date, time);
  const at = date === today ? Math.max(picked, now) : picked;
  return {
    now,
    date,
    time,
    at,
    isLive,
    isToday: date === today,
    setDate: (v) => setParams({ d: v === today ? null : v }),
    setTime: (v) => setParams({ t: v || null }),
    reset: () => setParams({ d: null, t: null }),
  };
}
