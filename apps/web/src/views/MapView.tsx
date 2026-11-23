import type { Building } from '@nittany-rooms/core';
import type { Map as MLMap, Marker, StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import type { StateCounts } from '../lib/availability';
import { footprints } from '../lib/data';
import { useThemeValue, type Theme } from '../lib/theme';

/**
 * 3D campus map: MapLibre + OpenFreeMap (OpenStreetMap data, no key, no billing).
 * Dark: OpenFreeMap "fiord" recolored to the navy palette, plus 3D buildings.
 * Light: OpenFreeMap "liberty", which ships its own 3D building layer.
 * Buildings with reservable rooms are extruded from their OSM footprints in the
 * accent color. maplibre-gl is lazy-loaded; the sidebar list works without it.
 */
const STYLE_URL: Record<Theme, string> = {
  dark: 'https://tiles.openfreemap.org/styles/fiord',
  light: 'https://tiles.openfreemap.org/styles/liberty',
};

const OVERVIEW = { zoom: 15.35, pitch: 52, bearing: -18 };
/** Phones see less of the campus at the same zoom; pull back a little. */
const overview = (width: number) => ({ ...OVERVIEW, zoom: width < 640 ? 14.7 : OVERVIEW.zoom });
const FOCUS = { zoom: 17.3, pitch: 60, bearing: -24 };

export interface MarkerInfo {
  building: Building;
  counts: StateCounts;
  known: boolean;
}

type AnyLayer = StyleSpecification['layers'][number] & { 'source-layer'?: string; paint?: Record<string, unknown> };

/** Recolor a fetched style to the dark navy palette, defensively (by layer type/source-layer, not id). */
function darkify(style: StyleSpecification): StyleSpecification {
  const layers: AnyLayer[] = [];
  for (const raw of style.layers as AnyLayer[]) {
    const l = { ...raw, paint: { ...(raw.paint ?? {}) } } as AnyLayer;
    const sl = l['source-layer'];
    const p = l.paint as Record<string, unknown>;
    if (l.type === 'background') p['background-color'] = '#0A1628';
    else if (sl === 'water' && l.type === 'fill') p['fill-color'] = '#0B2242';
    else if (sl === 'waterway' && l.type === 'line') p['line-color'] = '#0B2242';
    else if ((sl === 'landcover' || sl === 'landuse' || sl === 'park') && l.type === 'fill') {
      p['fill-color'] = '#0E2140';
      p['fill-opacity'] = 0.55;
    } else if (sl === 'building') continue; // replaced by our extrusion layer
    else if (sl === 'transportation' && l.type === 'line') p['line-color'] = '#1D3259';
    else if (l.type === 'symbol') {
      p['text-color'] = '#7F91AE';
      p['text-halo-color'] = '#0A1628';
      p['text-halo-width'] = 1.2;
    }
    layers.push(l);
  }
  const firstSymbol = layers.findIndex((l) => l.type === 'symbol');
  const extrusion = {
    id: 'nr-osm-3d',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': '#1A2E52',
      'fill-extrusion-height': ['get', 'render_height'],
      'fill-extrusion-base': ['get', 'render_min_height'],
      'fill-extrusion-opacity': 0.92,
    },
  } as unknown as AnyLayer;
  layers.splice(firstSymbol < 0 ? layers.length : firstSymbol, 0, extrusion);
  return { ...style, layers };
}

/** Minimal light map: drop POI icons and airport labels from Liberty. */
function quiet(style: StyleSpecification): StyleSpecification {
  const drop = new Set(['poi', 'aerodrome_label']);
  return { ...style, layers: (style.layers as AnyLayer[]).filter((l) => !drop.has(l['source-layer'] ?? '')) };
}

async function loadStyle(theme: Theme): Promise<StyleSpecification> {
  const res = await fetch(STYLE_URL[theme]);
  if (!res.ok) throw new Error(`style ${res.status}`);
  const style = (await res.json()) as StyleSpecification;
  return theme === 'dark' ? darkify(style) : quiet(style);
}

/**
 * Grow a ring ~1% about its centroid so our walls sit just outside the base
 * map's own 3D model of the same building (no coplanar faces → no z-fighting).
 */
function inflate(ring: [number, number][], k = 1.012): [number, number][] {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

function footprintData(markers: MarkerInfo[], selectedId: string | null) {
  const byId = new Map(markers.map((m) => [m.building.id, m]));
  return {
    type: 'FeatureCollection' as const,
    features: footprints.features
      .filter((f) => byId.has(f.properties.buildingId))
      .map((f) => {
        const m = byId.get(f.properties.buildingId)!;
        const open = m.known && m.counts.open > 0;
        const selected = f.properties.buildingId === selectedId;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Polygon' as const, coordinates: f.geometry.coordinates.map((r) => inflate(r as [number, number][])) },
          properties: {
            buildingId: f.properties.buildingId,
            height: f.properties.heightMeters + 2,
            tone: `${open ? 'open' : 'quiet'}${selected ? '-selected' : ''}`,
          },
        };
      }),
  };
}

function addOverlays(map: MLMap, theme: Theme, data: ReturnType<typeof footprintData>) {
  if (map.getSource('nr-footprints')) return;
  map.addSource('nr-footprints', { type: 'geojson', data });
  const quiet = theme === 'dark' ? '#3B5A92' : '#8EA6CC';
  map.addLayer({
    id: 'nr-footprints-3d',
    type: 'fill-extrusion',
    source: 'nr-footprints',
    paint: {
      'fill-extrusion-color': [
        'match',
        ['get', 'tone'],
        'open',
        '#FFC845',
        'open-selected',
        '#FFD978',
        'quiet-selected',
        theme === 'dark' ? '#6E93D6' : '#5E7FB8',
        quiet,
      ],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.95,
    },
  });
}

function markerHtml(info: MarkerInfo, selected: boolean): { html: string; label: string } {
  const b = info.building;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const name = esc(b.mapLabel ?? b.headline);
  let cls = 'nr-pin';
  let badge = '';
  let label: string;
  if (b.status === 'candidate') {
    cls += ' nr-pin--candidate';
    badge = '?';
    label = `${b.headline}, not verified yet`;
  } else if (info.known && info.counts.open > 0) {
    cls += ' nr-pin--open';
    badge = String(info.counts.open);
    label = `${b.headline}, ${info.counts.open} of ${info.counts.total} rooms open at this time`;
  } else if (info.known) {
    badge = '0';
    label = `${b.headline}, no rooms open at this time`;
  } else {
    badge = String(info.counts.total);
    label = `${b.headline}, ${info.counts.total} reservable rooms, check times on Penn State's site`;
  }
  if (selected) cls += ' nr-pin--selected';
  return { label, html: `<span class="${cls}"><span class="nr-pin__badge">${badge}</span><span class="nr-pin__name">${name}</span></span>` };
}

export function MapView({
  markers,
  visibleIds,
  selectedId,
  onSelect,
  bottomPadding = 0,
}: {
  markers: MarkerInfo[];
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  bottomPadding?: number;
}) {
  const theme = useThemeValue();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRefs = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const latest = useRef({ markers, selectedId, onSelect, theme });
  latest.current = { markers, selectedId, onSelect, theme };
  const overviewCenter = useRef<[number, number]>([-77.8655, 40.7968]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | undefined;
    (async () => {
      try {
        const [maplibre, worker] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ]);
        maplibre.setWorkerUrl(worker.default);
        const style = await loadStyle(latest.current.theme);
        if (cancelled || !container.current) return;
        const pts = latest.current.markers.map((m) => [m.building.location.lon, m.building.location.lat] as const);
        if (pts.length) {
          overviewCenter.current = [
            pts.reduce((s, p) => s + p[0], 0) / pts.length,
            pts.reduce((s, p) => s + p[1], 0) / pts.length,
          ];
        }
        const lm = new maplibre.Map({
          container: container.current,
          style,
          center: overviewCenter.current,
          ...overview(container.current.clientWidth),
          maxBounds: [
            [-77.95, 40.75],
            [-77.78, 40.85],
          ],
          minZoom: 13,
          maxZoom: 19.5,
          maxPitch: 70,
          attributionControl: { compact: true },
        });
        map = lm;
        lm.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'top-right');
        lm.on('style.load', () => {
          const { markers: ms, selectedId: sid, theme: th } = latest.current;
          addOverlays(lm, th, footprintData(ms, sid));
        });
        lm.on('load', () => !cancelled && setStatus('ready'));
        lm.on('click', 'nr-footprints-3d', (e) => {
          const id = e.features?.[0]?.properties?.buildingId as string | undefined;
          if (id) latest.current.onSelect(id);
        });
        lm.on('mouseenter', 'nr-footprints-3d', () => (lm.getCanvas().style.cursor = 'pointer'));
        lm.on('mouseleave', 'nr-footprints-3d', () => (lm.getCanvas().style.cursor = ''));
        lm.on('error', (e) => {
          if (!lm.isStyleLoaded() && /style/i.test(String(e.error?.message ?? ''))) setStatus('error');
        });
        mapRef.current = lm;
        for (const m of latest.current.markers) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'nr-marker';
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            latest.current.onSelect(m.building.id);
          });
          const marker = new maplibre.Marker({ element: el, anchor: 'bottom', offset: [0, -6] })
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
  }, []);

  // Theme switch → swap base style, re-add overlays on style.load.
  const appliedTheme = useRef(theme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    loadStyle(theme)
      .then((style) => map.setStyle(style, { diff: false }))
      .catch(() => {
        /* keep the current style if the new one can't load */
      });
  }, [theme, status]);

  // Sync markers and footprint colors with counts/filters/selection.
  useEffect(() => {
    for (const m of markers) {
      const ref = markerRefs.current.get(m.building.id);
      if (!ref) continue;
      const { html, label } = markerHtml(m, m.building.id === selectedId);
      ref.el.innerHTML = html;
      ref.el.setAttribute('aria-label', label);
      ref.el.setAttribute('aria-pressed', String(m.building.id === selectedId));
      ref.el.style.zIndex = m.building.id === selectedId ? '3' : m.building.status === 'verified' ? '2' : '1';
      ref.el.style.display = visibleIds.has(m.building.id) ? '' : 'none';
    }
    const src = mapRef.current?.getSource('nr-footprints') as { setData?: (d: unknown) => void } | undefined;
    src?.setData?.(footprintData(markers.filter((m) => visibleIds.has(m.building.id)), selectedId));
  }, [markers, visibleIds, selectedId, status]);

  // Camera: fly into the selected building, or back out to the campus.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = markers.find((x) => x.building.id === selectedId);
    const padding = { top: 40, bottom: bottomPadding + 40, left: 40, right: 40 };
    const target = m
      ? { center: [m.building.location.lon, m.building.location.lat] as [number, number], ...FOCUS }
      : { center: overviewCenter.current, ...overview(map.getContainer().clientWidth) };
    if (reduce) map.jumpTo({ ...target, padding });
    else map.flyTo({ ...target, padding, duration: 1100, essential: false });
    // Only react to selection and layout changes, not every count refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, status, bottomPadding]);

  return (
    <div className="absolute inset-0 bg-bg">
      {/* Inline position: maplibre's CSS sets .maplibregl-map{position:relative}. */}
      <div ref={container} style={{ position: 'absolute', inset: 0 }} aria-label="3D campus map of University Park" role="region" />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted" aria-live="polite">
          Loading campus map…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center p-6" role="alert">
          <div className="max-w-xs rounded-panel border border-line bg-surface p-4 text-center text-sm">
            <div className="font-semibold">The map couldn't load.</div>
            <p className="mt-1 text-xs text-muted">Map tiles may be blocked on this network. Every building is still in the list.</p>
          </div>
        </div>
      )}
      <style>{`
        .nr-marker{border:0;background:none;padding:0;cursor:pointer;font-family:var(--font-sans)}
        .nr-pin{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px 0 3px;border-radius:999px;
          background:var(--nr-surface);color:var(--nr-fg);box-shadow:0 0 0 1px var(--nr-line),0 4px 14px rgb(0 0 0 / .3);
          font-size:12px;font-weight:600;white-space:nowrap}
        .nr-pin__badge{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:999px;
          background:var(--nr-surface-3);color:var(--nr-fg);font-weight:800;font-size:11px;box-sizing:border-box}
        .nr-pin--open .nr-pin__badge{background:var(--nr-accent);color:var(--nr-accent-ink)}
        .nr-pin--candidate{box-shadow:none;outline:1.5px dashed var(--nr-subtle);outline-offset:-1.5px}
        .nr-pin--selected{box-shadow:0 0 0 2px var(--nr-accent),0 4px 14px rgb(0 0 0 / .35)}
        .nr-marker:focus-visible{outline:none}
        .nr-marker:focus-visible .nr-pin{box-shadow:0 0 0 2px var(--nr-accent)}
      `}</style>
    </div>
  );
}
