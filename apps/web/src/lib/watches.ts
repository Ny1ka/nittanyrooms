import { useSyncExternalStore } from 'react';

/**
 * "Notify me when it opens" watches, stored in this browser only.
 * A watch fires once, when the room gains a free slot of at least `minMinutes`
 * starting at or after `after` on `date`, then it's removed.
 */
export interface Watch {
  id: string;
  roomId: string;
  buildingId: string;
  date: string;
  after: number;
  minMinutes: number;
  createdAt: number;
  /** Set when the server will also push this alert (works with the site closed). */
  server?: { id: string; token: string };
}

const KEY = 'nr-watches';
const EVENT = 'nr:watches';

function read(): Watch[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((w) => w && typeof w.roomId === 'string' && typeof w.after === 'number') : [];
  } catch {
    return [];
  }
}
let cache = read();

function write(next: Watch[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: watches last for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const on = (e: Event) => {
    if (e.type === 'storage') cache = read();
    cb();
  };
  window.addEventListener(EVENT, on);
  window.addEventListener('storage', on);
  return () => {
    window.removeEventListener(EVENT, on);
    window.removeEventListener('storage', on);
  };
}

export function useWatches() {
  const list = useSyncExternalStore(subscribe, () => cache, () => cache);
  return {
    list,
    forRoom: (roomId: string, date: string) => list.find((w) => w.roomId === roomId && w.date === date),
    /** Attach the server registration to an existing local watch. */
    attachServer: (roomId: string, date: string, server: { id: string; token: string }) =>
      write(cache.map((x) => (x.roomId === roomId && x.date === date ? { ...x, server } : x))),
    add: (w: Omit<Watch, 'id' | 'createdAt'>) =>
      write([...cache.filter((x) => !(x.roomId === w.roomId && x.date === w.date)), { ...w, id: `${w.roomId}-${w.date}-${Date.now()}`, createdAt: Date.now() }]),
    remove: (id: string) => write(cache.filter((x) => x.id !== id)),
    /** Drop watches whose day has fully passed. */
    prune: (today: string) => {
      const next = cache.filter((w) => w.date >= today);
      if (next.length !== cache.length) write(next);
    },
  };
}
