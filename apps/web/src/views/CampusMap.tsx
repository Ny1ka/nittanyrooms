import type { Building } from '@nittany-rooms/core';
import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import type { StateCounts } from '../lib/availability';

/**
 * MapLibre + OpenFreeMap (OpenStreetMap data, no API key, no billing).
 * maplibre-gl is lazy-loaded so the building list is usable before the map arrives.
 * If WebGL or tiles fail, the list remains the full alternative.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const UP_BOUNDS: [[number, number], [number, number]] = [
  [-77.905, 40.775],
  [-77.825, 40.825],
];

export interface MarkerInfo {
  building: Building;
  counts: StateCounts;
  /** Whether availability is actually known for any room. */
  known: boolean;
}

function markerHtml(info: MarkerInfo, selected: boolean): { html: string; label: string } {
  const b = info.building;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  let pill: string;
  let badge: string;
  let label: string;
  if (b.status === 'candidate') {
    pill = 'background:#fff;color:#12284C;border:2px dashed #4F5B6E;';
    badge = '<span style="background:#EEF1F5;color:#12284C">?</span>';
    label = `${b.headline}, not verified yet, rooms not listed`;
  } else if (info.known && info.counts.open > 0) {
    pill = 'background:#FFC845;color:#12284C;border:2px solid #FFC845;';
    badge = `<span style="background:#12284C;color:#FFC845">${info.counts.open}</span>`;
    label = `${b.headline}, ${info.counts.open} of ${info.counts.total} rooms open at this time`;
  } else {
    pill = 'background:#fff;color:#12284C;border:2px solid #12284C;';
    badge = `<span style="background:#12284C;color:#fff">${info.known ? 0 : info.counts.total}</span>`;
    label = info.known
      ? `${b.headline}, no rooms open at this time`
      : `${b.headline}, ${info.counts.total} reservable rooms, availability: check on PSU site`;
  }
  const ring = selected ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px #12284C;' : 'box-shadow:0 2px 8px rgba(18,40,76,.25);';
  return {
    label,
    html: `<span class="nr-pill" style="${pill}${ring}">${badge.replace(
      '<span ',
      '<span class="nr-badge" ',
    )}<span class="nr-name">${esc(b.mapLabel ?? b.headline)}</span></span>`,
  };
}

export function CampusMap({
  markers,
  visibleIds,
  selectedId,
  onSelect,
}: {
  markers: MarkerInfo[];
  /** Buildings passing the current filters; others are hidden, not removed. */
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRefs = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | undefined;
    (async () => {
      try {
        const [maplibre, worker] = await Promise.all([
          import('maplibre-gl'),
          // v6 loads its worker from a separate file; give Vite a stable URL for it.
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        maplibre.setWorkerUrl(worker.default);
        if (cancelled || !container.current) return;
        const lm = new maplibre.Map({
          container: container.current,
          style: STYLE_URL,
          bounds: UP_BOUNDS,
          maxBounds: [
            [-77.95, 40.75],
            [-77.78, 40.85],
          ],
          minZoom: 13,
          maxZoom: 19,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
        map = lm;
        lm.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        lm.on('load', () => {
          if (cancelled) return;
          setStatus('ready');
          const pts = markers.map((m) => [m.building.location.lon, m.building.location.lat] as [number, number]);
          if (pts.length) {
            const lons = pts.map((p) => p[0]);
            const lats = pts.map((p) => p[1]);
            lm.fitBounds(
              [
                [Math.min(...lons), Math.min(...lats)],
                [Math.max(...lons), Math.max(...lats)],
              ],
              { padding: { top: 80, bottom: 80, left: 80, right: 80 }, maxZoom: 16, duration: 0 },
            );
          }
        });
        lm.on('error', (e) => {
          // Tile hiccups are recoverable; only a failed style is fatal.
          if (!lm.isStyleLoaded() && String(e.error?.message ?? '').match(/style|fetch/i)) {
            setStatus('error');
          }
        });
        mapRef.current = lm;
        // Markers
        for (const m of markers) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'nr-marker';
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            onSelectRef.current(m.building.id);
          });
          const marker = new maplibre.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([m.building.location.lon, m.building.location.lat])
            .addTo(lm);
          markerRefs.current.set(m.building.id, { marker, el });
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      markerRefs.current.clear();
      mapRef.current = null;
    };
    // Markers set is static per page load (data is bundled).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker visuals in sync with counts/selection.
  useEffect(() => {
    for (const m of markers) {
      const ref = markerRefs.current.get(m.building.id);
      if (!ref) continue;
      const { html, label } = markerHtml(m, m.building.id === selectedId);
      ref.el.innerHTML = html;
      ref.el.setAttribute('aria-label', label);
      ref.el.setAttribute('aria-pressed', String(m.building.id === selectedId));
      ref.el.style.zIndex = m.building.id === selectedId ? '2' : m.building.status === 'verified' ? '1' : '0';
      ref.el.style.display = visibleIds.has(m.building.id) ? '' : 'none';
    }
  }, [markers, visibleIds, selectedId, status]);

  // Pan to selection.
  useEffect(() => {
    const map = mapRef.current;
    const m = markers.find((x) => x.building.id === selectedId);
    if (!map || !m || status !== 'ready') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({
      center: [m.building.location.lon, m.building.location.lat],
      duration: reduce ? 0 : 300,
      offset: [0, -60],
    });
  }, [selectedId, status, markers]);

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden rounded-panel border border-line bg-[#EEF1F5]">
      {/* Inline position: maplibre's CSS sets .maplibregl-map{position:relative}. */}
      <div ref={container} style={{ position: 'absolute', inset: 0 }} aria-label="Campus map of University Park" role="region" />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate" aria-live="polite">
          <div className="flex flex-col items-center gap-2">
            <div className="h-2 w-40 animate-pulse rounded-full bg-line" />
            Loading campus map…
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center" role="alert">
          <div className="max-w-sm rounded-panel border border-line bg-surface p-5 text-sm">
            <div className="font-semibold">The map couldn't load.</div>
            <p className="mt-1 text-slate">
              Your connection or browser may be blocking map tiles. Every building is still in the list.
            </p>
          </div>
        </div>
      )}
      <style>{`
        .nr-marker{border:0;background:none;padding:0;cursor:pointer;font-family:var(--font-sans)}
        .nr-pill{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 14px 0 5px;border-radius:999px;font-weight:600;font-size:15px;white-space:nowrap}
        .nr-badge{display:inline-grid;place-items:center;min-width:32px;height:32px;padding:0 6px;border-radius:999px;font-weight:800;font-size:15px;box-sizing:border-box}
        .nr-marker:focus-visible{outline:none}
        .nr-marker:focus-visible .nr-pill{outline:3px solid #C99400;outline-offset:3px}
        @media (max-width:640px){.nr-name{max-width:150px;overflow:hidden;text-overflow:ellipsis}}
      `}</style>
    </div>
  );
}
