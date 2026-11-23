import type { LatLon } from './geo';

/**
 * Walking route via the FOSSGIS OSRM server (routing.openstreetmap.de, OpenStreetMap data).
 * Policy: non-commercial, ≤1 request/second, attribution + "fix the map" link, no heavy use.
 * Requests are logged by FOSSGIS, so the UI asks before sending the user's location.
 */
export const ROUTE_ATTRIBUTION = {
  text: 'Route: FOSSGIS OSRM · © OpenStreetMap contributors',
  about: 'https://routing.openstreetmap.de/about.html',
  fix: 'https://www.openstreetmap.org/fixthemap',
};

export interface WalkingRoute {
  coords: [number, number][]; // [lon, lat]
  meters: number;
  seconds: number;
}

const cache = new Map<string, WalkingRoute>();
let lastCall = 0;

export async function fetchWalkingRoute(from: LatLon, to: LatLon): Promise<WalkingRoute> {
  const key = [from.lat, from.lon, to.lat, to.lon].map((n) => n.toFixed(4)).join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Routing service returned ${res.status}`);
  const body = (await res.json()) as { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
  const r = body.routes?.[0];
  if (body.code !== 'Ok' || !r || r.geometry.coordinates.length < 2) throw new Error('No walking route found');
  const route = { coords: r.geometry.coordinates, meters: r.distance, seconds: r.duration };
  cache.set(key, route);
  return route;
}

export type RouteState =
  | { status: 'idle' }
  | { status: 'loading'; targetId: string }
  | { status: 'ok'; targetId: string; route: WalkingRoute }
  | { status: 'error'; targetId: string; message: string };

export function formatWalk(r: WalkingRoute): string {
  const mi = r.meters / 1609.34;
  return `${Math.max(1, Math.round(r.seconds / 60))} min walk · ${mi < 0.1 ? `${Math.round(r.meters * 3.281)} ft` : `${mi.toFixed(1)} mi`}`;
}
