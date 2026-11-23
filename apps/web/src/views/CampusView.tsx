import { formatTime } from '@nittany-rooms/core';
import { lazy, Suspense, useMemo, useState } from 'react';
import { buildingCounts, roomDay, roomStatus, useDemo, type StateCounts } from '../lib/availability';
import { buildings, getProvider, getSource, roomsIn } from '../lib/data';
import { buildingPhrase, floorsPhrase, roomCountPhrase, unknownReason } from '../lib/labels';
import { navigate, setParams, useRoute } from '../lib/router';
import type { SelectedTime } from '../lib/time';
import { Close, External, ListIcon, MapIcon } from '../components/Icons';
import { AvailabilityFreshness } from '../components/Notices';
import type { MarkerInfo } from './CampusMap';

const CampusMap = lazy(() => import('./CampusMap').then((m) => ({ default: m.CampusMap })));

type SizeFilter = 0 | 2 | 5 | 9;

interface Filters {
  openNow: boolean;
  minSize: SizeFilter;
  accessible: boolean;
}

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold ${
    on ? 'bg-glow text-navy' : 'border border-input-border bg-surface text-navy'
  }`;

export function CampusView({ sel }: { sel: SelectedTime }) {
  const demo = useDemo();
  const { params } = useRoute();
  const selectedId = params.get('b');
  const listMode = params.get('view') === 'list';
  const [filters, setFilters] = useState<Filters>({ openNow: false, minSize: 0, accessible: false });
  const anyFilter = filters.openNow || filters.minSize > 0 || filters.accessible;

  const markers: MarkerInfo[] = useMemo(
    () =>
      buildings.map((b) => {
        const counts = buildingCounts(b.id, sel.date, sel.at, sel.now, demo);
        return { building: b, counts, known: counts.total > 0 && counts.unknown < counts.total };
      }),
    [sel.date, sel.at, sel.now, demo],
  );

  // A building matches if at least one of its verified rooms matches every active filter.
  const visible = markers.filter(({ building }) => {
    if (!anyFilter) return true;
    return roomsIn(building.id).some((r) => {
      if (filters.minSize && (r.capacity === null || r.capacity < filters.minSize)) return false;
      if (filters.accessible && !r.features.includes('accessible')) return false;
      if (filters.openNow) {
        const s = roomStatus(roomDay(r, sel.date, sel.now, { demo }), sel.at);
        if (s.state !== 'open') return false;
      }
      return true;
    });
  });

  const select = (id: string | null) => setParams({ b: id });
  const selected = markers.find((m) => m.building.id === selectedId) ?? null;

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-4 sm:px-6 lg:flex-row lg:gap-6">
      <aside className={`flex-col gap-4 lg:flex lg:w-[340px] lg:shrink-0 ${listMode ? 'flex' : 'hidden lg:flex'}`}>
        <div>
          <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] lg:text-[40px]">
            Study rooms at University Park
          </h1>
          <p className="mt-2 text-base leading-snug text-slate">
            Buildings with rooms you can reserve. Pick one to see its floors.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
          <button type="button" aria-pressed={filters.openNow} className={chip(filters.openNow)} onClick={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}>
            Open at this time
          </button>
          <label className={`${chip(filters.minSize > 0)} relative cursor-pointer gap-1 pr-3`}>
            <span className="sr-only">Group size</span>
            <select
              value={filters.minSize}
              onChange={(e) => setFilters((f) => ({ ...f, minSize: Number(e.target.value) as SizeFilter }))}
              className="cursor-pointer appearance-none bg-transparent pr-1 font-semibold outline-none"
            >
              <option value={0}>Group size</option>
              <option value={2}>2+ people</option>
              <option value={5}>5+ people</option>
              <option value={9}>9+ people</option>
            </select>
            <span aria-hidden="true">▾</span>
          </label>
          <button type="button" aria-pressed={filters.accessible} className={chip(filters.accessible)} onClick={() => setFilters((f) => ({ ...f, accessible: !f.accessible }))}>
            Accessible
          </button>
        </div>

        <div className="flex items-center justify-between text-small text-slate" aria-live="polite">
          <span>
            {visible.length} of {markers.length} buildings
            {anyFilter ? ' match' : ''}
          </span>
          {anyFilter && (
            <button type="button" className="min-h-11 font-semibold text-navy underline" onClick={() => setFilters({ openNow: false, minSize: 0, accessible: false })}>
              Clear filters
            </button>
          )}
        </div>

        {visible.length > 0 ? (
          <ul className="overflow-hidden rounded-panel border border-line bg-surface" aria-label="Buildings">
            {visible.map((m) => (
              <BuildingRow key={m.building.id} info={m} selected={m.building.id === selectedId} onSelect={() => select(m.building.id)} />
            ))}
          </ul>
        ) : (
          <EmptyFilters filters={filters} demo={demo} />
        )}

        <AvailabilityFreshness demo={demo} />
      </aside>

      <section
        aria-label="Campus map"
        className={`relative min-h-[calc(100dvh-230px)] flex-1 lg:min-h-0 ${listMode ? 'hidden lg:block' : 'block'}`}
      >
        <Suspense fallback={<div className="h-full min-h-[420px] animate-pulse rounded-panel bg-line/50" />}>
          <CampusMap markers={markers} visibleIds={new Set(visible.map((m) => m.building.id))} selectedId={selectedId} onSelect={select} />
        </Suspense>
        <Legend />
        {selected && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center lg:absolute lg:inset-x-6 lg:bottom-6">
            <BuildingPreview info={selected} sel={sel} onClose={() => select(null)} />
          </div>
        )}
      </section>

      {/* Mobile list/map toggle */}
      <button
        type="button"
        onClick={() => setParams({ view: listMode ? null : 'list' })}
        className="fixed right-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-30 flex min-h-12 items-center gap-2 rounded-full bg-navy px-5 font-semibold text-white shadow-lg lg:hidden"
        style={selected && !listMode ? { display: 'none' } : undefined}
      >
        {listMode ? <MapIcon /> : <ListIcon />}
        {listMode ? 'Show map' : 'Show list'}
      </button>
    </div>
  );
}

function BuildingRow({ info, selected, onSelect }: { info: MarkerInfo; selected: boolean; onSelect: () => void }) {
  const b = info.building;
  const n = info.counts.total;
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex min-h-[76px] w-full items-center justify-between gap-3 px-5 py-3 text-left ${selected ? 'bg-glow-tint' : 'bg-surface hover:bg-paper'}`}
      >
        <span>
          <span className="block text-lg leading-tight font-semibold">{b.headline}</span>
          <span className="block text-[15px] text-slate">
            {b.status === 'candidate'
              ? 'Rooms not listed yet'
              : `${n} room${n === 1 ? '' : 's'}${b.headline.includes(b.shortName) ? '' : ` · ${b.shortName}`}`}
          </span>
        </span>
        <BuildingBadge info={info} />
      </button>
    </li>
  );
}

function BuildingBadge({ info }: { info: MarkerInfo }) {
  if (info.building.status === 'candidate') {
    return (
      <span className="inline-flex h-9 shrink-0 items-center rounded-full border-2 border-dashed border-slate px-3 text-sm font-semibold">
        Not verified
      </span>
    );
  }
  if (!info.known) {
    return (
      <span className="inline-flex h-9 shrink-0 items-center rounded-full fill-unknown px-3 text-sm font-semibold text-ink-muted">
        Check on PSU site
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${info.counts.open ? 'bg-glow' : 'bg-navy text-white'}`}
    >
      {info.counts.open ? `${info.counts.open} open` : 'None open'}
    </span>
  );
}

function EmptyFilters({ filters, demo }: { filters: Filters; demo: boolean }) {
  const reasons: string[] = [];
  if (filters.minSize) reasons.push('No room has a verified capacity yet.');
  if (filters.accessible) reasons.push('No room has verified accessibility details yet.');
  if (filters.openNow && !demo) reasons.push('Live availability isn’t connected, so no room can be confirmed open.');
  if (filters.openNow && demo) reasons.push('No rooms are open at the selected time. Try a different time.');
  return (
    <div className="rounded-panel border border-line bg-surface p-5 text-[15px]">
      <div className="font-semibold">No buildings match these filters.</div>
      <ul className="mt-1 list-disc pl-5 text-slate">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="mt-2 text-slate">We only filter on details Penn State has published. Clear filters to see every building.</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute top-3 left-3 hidden flex-col gap-2 rounded-control bg-surface/95 px-4 py-3 text-sm shadow-sm sm:flex">
      <span className="flex items-center gap-2">
        <span className="size-4 rounded-full border-2 border-navy bg-glow" aria-hidden="true" />
        Rooms open at this time
      </span>
      <span className="flex items-center gap-2">
        <span className="size-4 rounded-full border-2 border-navy bg-white" aria-hidden="true" />
        Reservable, check times on PSU site
      </span>
      <span className="flex items-center gap-2">
        <span className="size-4 rounded-full border-2 border-dashed border-slate" aria-hidden="true" />
        Not verified yet
      </span>
    </div>
  );
}

function CountTile({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={`flex min-h-[72px] flex-col justify-center rounded-control px-3.5 py-2 ${cls}`}>
      <span className="text-2xl leading-none font-extrabold tabular">{n}</span>
      <span className="mt-1 text-sm font-semibold">{label}</span>
    </div>
  );
}

function BuildingPreview({ info, sel, onClose }: { info: MarkerInfo; sel: SelectedTime; onClose: () => void }) {
  const b = info.building;
  const c: StateCounts = info.counts;
  const provider = getProvider(b.providerIds[0]!);
  const source = getSource(b.verification.sourceIds[0]!);
  const at = formatTime(sel.at).replace(':00 ', ' ');

  return (
    <div
      role="dialog"
      aria-label={`${b.headline} preview`}
      className="pointer-events-auto max-h-[70dvh] w-full overflow-y-auto rounded-t-sheet bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(18,40,76,0.22)] sm:p-6 lg:max-w-[460px] lg:rounded-sheet lg:shadow-[0_8px_32px_rgba(18,40,76,0.22)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl leading-tight font-extrabold tracking-[-0.01em]">{b.headline}</h2>
          <p className="mt-1 text-[15px] text-slate">
            {buildingPhrase(b)}{' '}
            {b.status === 'verified'
              ? `${roomCountPhrase(c.total)}${floorsPhrase(b) ? ` on ${floorsPhrase(b)}` : ''}.`
              : 'Rooms not listed yet.'}
          </p>
          {b.address && <p className="text-small text-slate">{b.address}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-11 shrink-0 place-items-center rounded-control border border-line">
          <Close />
        </button>
      </div>

      {b.status === 'verified' ? (
        <>
          <div className="mt-4">
            {info.known ? (
              <div className="grid grid-cols-3 gap-2">
                <CountTile n={c.open} label={`Open at ${at}`} cls="bg-glow" />
                <CountTile n={c.opensSoon} label="Opens soon" cls="border-2 border-dashed border-glow-border text-amber-text" />
                <CountTile n={c.occupied} label="Occupied" cls="bg-navy text-white" />
              </div>
            ) : (
              <p className="rounded-control fill-unknown px-3.5 py-3 text-sm font-semibold text-ink-muted">
                Availability: check on PSU site. {unknownReason(provider)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/b/${b.id}`, {}, { transition: true })}
            className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-control bg-navy text-base font-semibold text-white hover:bg-night"
          >
            Explore floors
          </button>
        </>
      ) : (
        <>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            {b.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <a
            href={provider.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-control border border-input-border text-base font-semibold no-underline"
          >
            See rooms on Penn State's booking page <External />
          </a>
          {source && (
            <p className="mt-2 text-small text-slate">
              Source:{' '}
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
                {source.name}
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
