import { useSyncExternalStore } from 'react';

/**
 * Favorite rooms and buildings, stored in this browser only (a convenience; no accounts).
 * Rooms are stored by room id; buildings as `building:<id>` (see buildingKey).
 */
export const buildingKey = (id: string) => `building:${id}`;
const KEY = 'nr-favorites';
const EVENT = 'nr:favorites';

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
let cache = read();
let cacheKey = JSON.stringify(cache);

function subscribe(cb: () => void) {
  const on = () => {
    const next = read();
    const k = JSON.stringify(next);
    if (k !== cacheKey) {
      cache = next;
      cacheKey = k;
    }
    cb();
  };
  window.addEventListener(EVENT, on);
  window.addEventListener('storage', on); // other tabs
  return () => {
    window.removeEventListener(EVENT, on);
    window.removeEventListener('storage', on);
  };
}

export function useFavorites(): { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => void } {
  const ids = useSyncExternalStore(subscribe, () => cache, () => cache);
  return {
    ids,
    has: (id) => ids.includes(id),
    toggle: (id) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: favorites last for this visit only */
      }
      cache = next;
      cacheKey = JSON.stringify(next);
      window.dispatchEvent(new Event(EVENT));
    },
  };
}
