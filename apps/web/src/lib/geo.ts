export interface LatLon {
  lat: number;
  lon: number;
}

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "0.3 mi · 6 min walk" (straight-line distance, ~1.3 m/s walking). */
export function formatDistance(m: number): string {
  const mi = m / 1609.34;
  const walk = Math.max(1, Math.round((m * 1.25) / 1.3 / 60)); // 1.25× for paths vs straight line
  return `${mi < 0.1 ? `${Math.round(m * 3.281)} ft` : `${mi.toFixed(1)} mi`} · ${walk} min walk`;
}

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ok'; pos: LatLon; accuracy: number }
  | { status: 'error'; message: string };

/** Ask for the device location only when the user taps "Near me". Never stored or sent anywhere. */
export function requestLocation(cb: (s: GeoState) => void) {
  if (!('geolocation' in navigator)) return cb({ status: 'error', message: 'Location isn’t available in this browser.' });
  cb({ status: 'locating' });
  navigator.geolocation.getCurrentPosition(
    (p) => cb({ status: 'ok', pos: { lat: p.coords.latitude, lon: p.coords.longitude }, accuracy: p.coords.accuracy }),
    (e) => cb({ status: 'error', message: e.code === e.PERMISSION_DENIED ? 'Location permission was denied.' : 'Couldn’t get your location.' }),
    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
  );
}
