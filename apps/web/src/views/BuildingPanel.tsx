import { type Building, type Room, type RoomStatus } from '@nittany-rooms/core';
import { useMemo } from 'react';
import { roomDay, roomStatus, type RoomDay } from '../lib/availability';
import { floorOf, getBuilding, getProvider, getSource, roomsIn } from '../lib/data';
import { buildingPhrase, floorName, floorsPhrase, roomCountPhrase, roomShort } from '../lib/labels';
import { anyFilter, roomMatches, type Filters } from '../lib/filters';
import type { LiveState } from '../lib/live';
import { navigate, setParams, useRoute } from '../lib/router';
import type { SelectedTime } from '../lib/time';
import { ChevronLeft, External } from '../components/Icons';
import { AvailabilityFreshness } from '../components/Notices';
import { StatusChip, statusLabel } from '../components/StatusChip';
import { MiniTimeline, displayRange } from '../components/Timeline';
import { RoomPanel } from './RoomPanel';

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="-ml-1 inline-flex h-8 items-center gap-1 rounded-control px-1 text-xs font-semibold text-muted hover:text-fg">
      <ChevronLeft size={14} />
      {label}
    </button>
  );
}

const toCampus = () => navigate('/');

export function BuildingPanel({ buildingId, sel, demo, live, filters, clearFilters }: { buildingId: string; sel: SelectedTime; demo: boolean; live: LiveState; filters: Filters; clearFilters: () => void }) {
  const { params } = useRoute();
  const building = getBuilding(buildingId);
  if (!building) {
    return (
      <div className="space-y-2 px-4 py-3">
        <BackButton label="All buildings" onClick={toCampus} />
        <h1 className="text-lg font-semibold">Building not found</h1>
        <p className="text-xs text-muted">It may not have rooms students can reserve, or the link is out of date.</p>
      </div>
    );
  }
  if (building.roomInventory === 'none') return <NoRoomsYet building={building} />;
  const room = roomsIn(building.id).find((r) => r.id === params.get('room'));
  if (room) return <RoomPanel key={room.id} room={room} building={building} sel={sel} demo={demo} live={live} />;
  return <RoomList building={building} sel={sel} demo={demo} live={live} filters={filters} clearFilters={clearFilters} />;
}

function NoRoomsYet({ building }: { building: Building }) {
  const provider = getProvider(building.providerIds[0]!);
  return (
    <div className="space-y-3 px-4 py-3">
      <BackButton label="All buildings" onClick={toCampus} />
      <h1 className="text-lg font-semibold">{building.headline}</h1>
      <p className="text-xs text-muted">Not verified yet. Rooms aren't listed here.</p>
      <ul className="ml-4 list-disc space-y-1 text-xs text-muted">
        {building.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <a href={provider.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-semibold no-underline hover:bg-surface-2">
        Penn State's booking page <External size={12} />
      </a>
    </div>
  );
}

function RoomList({ building, sel, demo, live, filters, clearFilters }: { building: Building; sel: SelectedTime; demo: boolean; live: LiveState; filters: Filters; clearFilters: () => void }) {
  const { params } = useRoute();
  const allRooms = roomsIn(building.id);
  const filtering = anyFilter(filters);
  const rooms = filtering ? allRooms.filter((r) => roomMatches(r, filters, sel, demo, live)) : allRooms;
  const provider = getProvider(building.providerIds[0]!);
  const days = useMemo(() => {
    const m = new Map<string, { day: RoomDay; status: RoomStatus }>();
    for (const r of rooms) {
      const day = roomDay(r, sel.date, sel.now, { demo, live });
      m.set(r.id, { day, status: roomStatus(day, sel.at) });
    }
    return m;
  }, [rooms, sel.date, sel.now, sel.at, demo, live]);
  const range = displayRange([...days.values()].map((d) => d.day));
  const floors = [...building.floors].sort((a, b) => (a.unlisted ? 1 : b.unlisted ? -1 : a.level - b.level));
  const floorParam = params.get('floor');
  const activeFloor = floors.find((f) => f.label === floorParam) ?? null;
  const shown = floors.filter((f) => !activeFloor || f.id === activeFloor.id);
  const counts = { open: 0, opensSoon: 0, occupied: 0 };
  for (const { status } of days.values()) if (status.state in counts) counts[status.state as keyof typeof counts]++;
  const known = [...days.values()].some((d) => d.status.state !== 'unknown');
  const source = getSource(allRooms[0]!.verification.sourceIds[0]!);

  return (
    <div className="space-y-3 px-4 py-3">
      <BackButton label="All buildings" onClick={toCampus} />
      <div>
        <h1 className="text-lg leading-tight font-semibold">{building.headline}</h1>
        <p className="mt-0.5 text-xs text-muted">
          {buildingPhrase(building)} {roomCountPhrase(allRooms.length)}
          {floorsPhrase(building) ? ` on ${floorsPhrase(building)}` : ''}.
        </p>
      </div>

      {known && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted tabular">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-open" />{counts.open} open</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border border-dashed border-yellow" />{counts.opensSoon} opening soon</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-busy" />{counts.occupied} occupied</span>
        </div>
      )}

      {floors.length > 1 && (
        <div role="group" aria-label="Floor" className="flex flex-wrap gap-1">
          {[null, ...floors].map((f) => {
            const on = (f?.id ?? null) === (activeFloor?.id ?? null);
            return (
              <button
                key={f?.id ?? 'all'}
                type="button"
                aria-pressed={on}
                aria-label={f ? floorName(f) : 'All floors'}
                onClick={() => setParams({ floor: f ? f.label : null })}
                className={`h-7 min-w-9 rounded-control px-2.5 text-xs font-bold ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted hover:text-fg'}`}
              >
                {f ? f.label : 'All'}
              </button>
            );
          })}
        </div>
      )}

      {filtering && (
        <p className="flex items-center justify-between rounded-control bg-accent-soft px-3 py-2 text-xs text-accent-text">
          <span>
            {rooms.length} of {allRooms.length} rooms match your filters
          </span>
          <button type="button" onClick={clearFilters} className="font-semibold underline underline-offset-2">
            Show all
          </button>
        </p>
      )}

      <p className="text-[11px] leading-snug text-subtle">
        No floor plan yet, so rooms are listed by number. Floors are read from room numbers and not yet confirmed.
      </p>

      <div className="-mx-2">
        {shown.map((f) => {
          const list = rooms.filter((r) => r.floorId === f.id);
          if (!list.length) return null;
          return (
            <section key={f.id} aria-label={floorName(f)}>
              {floors.length > 1 && (
                <h2 className="sticky top-0 z-10 bg-surface px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">{floorName(f)}</h2>
              )}
              <ul>
                {list.map((r) => (
                  <RoomRow key={r.id} room={r} building={building} {...days.get(r.id)!} range={range} now={sel.now} nowish={sel.isLive && sel.isToday} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <AvailabilityFreshness demo={demo} live={live} scope={provider.system === 'outlook' ? 'outlook' : 'libcal'} />
      {source && (
        <p className="text-[11px] text-subtle">
          Rooms from{' '}
          <a className="underline underline-offset-2 hover:text-fg" href={source.url} target="_blank" rel="noopener noreferrer">
            {source.name}
          </a>
        </p>
      )}
    </div>
  );
}

function RoomRow({
  room,
  building,
  day,
  status,
  range,
  now,
  nowish,
}: {
  room: Room;
  building: Building;
  day: RoomDay;
  status: RoomStatus;
  range: { start: number; end: number };
  now: number;
  nowish: boolean;
}) {
  const f = floorOf(room, building);
  const sub = [room.area, room.capacity ? `${room.capacity} seats` : null].filter(Boolean).join(' · ');
  return (
    <li>
      <button
        type="button"
        onClick={() => setParams({ room: room.id }, { push: true })}
        aria-label={`${room.displayName}, ${floorName(f)}${room.capacity ? `, ${room.capacity} seats` : ''}, ${statusLabel(status, { long: true, nowish })}`}
        className="w-full space-y-1.5 rounded-control px-2 py-2 text-left hover:bg-surface-2"
      >
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="text-[14px] font-semibold">{roomShort(room)}</span>
            {sub && <span className="ml-2 truncate text-xs text-muted">{sub}</span>}
          </span>
          <StatusChip status={status} />
        </span>
        <MiniTimeline day={day} now={now} range={range} />
      </button>
    </li>
  );
}
