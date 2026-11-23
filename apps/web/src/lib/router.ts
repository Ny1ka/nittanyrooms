import { useSyncExternalStore } from 'react';

/**
 * Minimal history router. All view state lives in the URL so deep links,
 * the back button, and sharing a room all work.
 *   /                    campus map
 *   /b/:buildingId       building view   (?floor=2&room=ecore-248)
 * Shared params: d=YYYY-MM-DD, t=HH:mm, demo=1, view=list
 */
export type Route = { name: 'campus' } | { name: 'building'; buildingId: string };

const EVENT = 'nr:navigate';

function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(EVENT, cb);
  };
}

const getHref = () => window.location.pathname + window.location.search;

export function useHref(): string {
  return useSyncExternalStore(subscribe, getHref, () => '/');
}

export function parseRoute(pathname: string): Route {
  const m = /^\/b\/([a-z0-9-]+)\/?$/.exec(pathname);
  return m ? { name: 'building', buildingId: m[1]! } : { name: 'campus' };
}

export function useRoute(): { route: Route; params: URLSearchParams } {
  const href = useHref();
  const url = new URL(href, 'http://x');
  return { route: parseRoute(url.pathname), params: url.searchParams };
}

/** Params that persist across pages (date, time, demo). */
const STICKY = ['d', 't', 'demo'];

function withTransition(fn: () => void) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!reduce && doc.startViewTransition) doc.startViewTransition(fn);
  else fn();
}

export function navigate(
  pathname: string,
  extra: Record<string, string | null> = {},
  opts: { replace?: boolean; transition?: boolean } = {},
) {
  const current = new URLSearchParams(window.location.search);
  const next = new URLSearchParams();
  for (const k of STICKY) {
    const v = current.get(k);
    if (v) next.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v === null) next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  const url = pathname + (qs ? `?${qs}` : '');
  const go = () => {
    window.history[opts.replace ? 'replaceState' : 'pushState'](null, '', url);
    window.dispatchEvent(new Event(EVENT));
  };
  if (opts.transition) withTransition(go);
  else go();
}

/** Update query params on the current page without adding a history entry. */
export function setParams(patch: Record<string, string | null>, opts: { push?: boolean } = {}) {
  const params = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : '');
  window.history[opts.push ? 'pushState' : 'replaceState'](null, '', url);
  window.dispatchEvent(new Event(EVENT));
}
