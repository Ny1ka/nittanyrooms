import {
  MINUTE,
  campusDate,
  formatDateLabel,
  formatDuration,
  formatRange,
  formatTime,
  type Building,
  type Floor,
  type Room,
  type RoomStatus,
} from '@nittany-rooms/core';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { roomDay, roomStatus, useDemo, type RoomDay } from '../lib/availability';
import { floorOf, getBuilding, getPolicy, getProvider, getSource, roomsIn } from '../lib/data';
import { navigate, setParams, useRoute } from '../lib/router';
import { buildingPhrase, featureList, floorName, floorsPhrase, roomCountPhrase, roomShort, unknownReason } from '../lib/labels';
import type { SelectedTime } from '../lib/time';
import { HandoffPanel } from '../components/HandoffPanel';
import { ChevronLeft, ChevronRight, Close, External, Info } from '../components/Icons';
import { AvailabilityFreshness, FreshnessNote } from '../components/Notices';
import { STATE_ICON, StatusChip, statusLabel } from '../components/StatusChip';
import { Timeline } from '../components/Timeline';

function BackLink() {
  return (
    <a
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate('/', {}, { transition: true });
      }}
      className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold underline underline-offset-2"
    >
      <ChevronLeft />
      Back to campus map
    </a>
  );
}

export function BuildingView({ buildingId, sel }: { buildingId: string; sel: SelectedTime }) {
  const building = getBuilding(buildingId);
  if (!building) return <NotFound />;
  if (building.roomInventory === 'none') return <NoRoomsYet building={building} />;
  return <BuildingWithRooms building={building} sel={sel} />;
}

function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-10">
      <BackLink />
      <h1 className="text-title font-extrabold">Building not found</h1>
      <p className="text-slate">We don't have that building. It may not have rooms students can reserve, or the link is out of date.</p>
    </main>
  );
}

function NoRoomsYet({ building }: { building: Building }) {
  const provider = getProvider(building.providerIds[0]!);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      <BackLink />
      <h1 className="text-[32px] leading-tight font-extrabold tracking-[-0.02em]">{building.headline}</h1>
      <span className="inline-flex h-9 items-center self-start rounded-full border-2 border-dashed border-slate px-3 text-sm font-semibold">
        Not verified yet: rooms not listed
      </span>
      <ul className="list-disc space-y-1 pl-5 text-ink-muted">
        {building.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <a href={provider.portalUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center justify-center gap-2 self-start rounded-control bg-navy px-5 font-semibold text-white no-underline">
        See rooms on Penn State's booking page <External />
      </a>
      <p className="text-small text-slate">We'll add this building's rooms once each one is confirmed from an official source.</p>
    </main>
  );
}

function useStatuses(rooms: Room[], sel: SelectedTime, demo: boolean) {
  return useMemo(() => {
    const m = new Map<string, { day: RoomDay; status: RoomStatus }>();
    for (const r of rooms) {
      const day = roomDay(r, sel.date, sel.now, { demo });
      m.set(r.id, { day, status: roomStatus(day, sel.at) });
    }
    return m;
  }, [rooms, sel.date, sel.now, sel.at, demo]);
}

function BuildingWithRooms({ building, sel }: { building: Building; sel: SelectedTime }) {
  const demo = useDemo();
  const { params } = useRoute();
  const rooms = roomsIn(building.id);
  const statuses = useStatuses(rooms, sel, demo);
  const floors = [...building.floors].sort((a, b) => b.level - a.level); // elevator order
  const roomId = params.get('room');
  const room = rooms.find((r) => r.id === roomId) ?? null;
  const floorParam = params.get('floor');
  const floor: Floor =
    floors.find((f) => f.label === floorParam) ??
    (room && floorOf(room, building)) ??
    floors[floors.length - 1]!;
  const floorRooms = rooms.filter((r) => r.floorId === floor.id);

  const selectRoom = (r: Room) => {
    const f = floorOf(r, building);
    setParams({ room: r.id, floor: f?.label ?? null }, { push: true });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-4 sm:px-6 lg:flex-row lg:items-stretch">
      <aside className="flex flex-col gap-4 lg:w-[300px] lg:shrink-0">
        <BackLink />
        <div>
          <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em]">{building.headline}</h1>
          <p className="mt-1.5 text-[15px] leading-snug text-slate">
            {buildingPhrase(building)} {roomCountPhrase(rooms.length)}
            {floorsPhrase(building) ? ` on ${floorsPhrase(building)}` : ''}.
          </p>
        </div>
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          <div className="max-h-[50vh] overflow-y-auto lg:max-h-[calc(100dvh-360px)]">
            {[...floors].reverse().map((f) => {
              const list = rooms.filter((r) => r.floorId === f.id);
              if (!list.length) return null;
              return (
                <section key={f.id} aria-label={floorName(f)}>
                  {floors.length > 1 && (
                    <h2 className="sticky top-0 z-10 border-b border-line bg-paper px-4 py-1.5 text-small font-semibold text-slate">
                      {floorName(f)}
                    </h2>
                  )}
                  <ul>
                    {list.map((r) => {
                      const s = statuses.get(r.id)!.status;
                      const active = r.id === room?.id;
                      return (
                        <li key={r.id} className="border-b border-line last:border-b-0">
                          <button
                            type="button"
                            onClick={() => selectRoom(r)}
                            aria-current={active ? 'true' : undefined}
                            aria-label={`${r.displayName}, ${floorName(f)}${r.capacity ? `, ${r.capacity} seats` : ''}, ${statusLabel(s, { long: true })}`}
                            className={`flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left text-[15px] ${active ? 'bg-glow-tint' : 'bg-surface hover:bg-paper'}`}
                          >
                            <span className="min-w-0">
                              <strong className="font-extrabold">{roomShort(r)}</strong>
                              <span className="block truncate text-small text-slate">
                                {[r.area, r.capacity ? `${r.capacity} seats` : null].filter(Boolean).join(' · ') || floorName(f)}
                              </span>
                            </span>
                            <StatusChip status={s} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
        <p className="text-small leading-relaxed text-slate">
          Rooms from{' '}
          <a className="underline" href={getSource(rooms[0]!.verification.sourceIds[0]!)?.url} target="_blank" rel="noopener noreferrer">
            {getSource(rooms[0]!.verification.sourceIds[0]!)?.name}
          </a>
          , checked {DateTime.fromISO(rooms[0]!.verification.verifiedAt).toFormat('LLL d, yyyy')}.
        </p>
        <div className="lg:hidden">
          <AvailabilityFreshness demo={demo} />
        </div>
      </aside>

      <FloorSection
        building={building}
        floors={floors}
        floor={floor}
        rooms={floorRooms}
        allRooms={rooms}
        statuses={statuses}
        selectedId={room?.id ?? null}
        onSelectRoom={selectRoom}
      />

      {room ? (
        <RoomPanel key={`${room.id}`} room={room} building={building} sel={sel} demo={demo} />
      ) : (
        <section className="hidden flex-col justify-center gap-3 rounded-panel border border-line bg-surface p-6 text-slate lg:flex lg:w-[400px] lg:shrink-0">
          <div className="text-heading font-semibold text-navy">Pick a room</div>
          <p>Choose a room on the floor or from the list to see its times and how to book it.</p>
          <AvailabilityFreshness demo={demo} />
        </section>
      )}
    </div>
  );
}

function FloorSection({
  building,
  floors,
  floor,
  rooms,
  allRooms,
  statuses,
  selectedId,
  onSelectRoom,
}: {
  building: Building;
  floors: Floor[];
  floor: Floor;
  rooms: Room[];
  allRooms: Room[];
  statuses: Map<string, { status: RoomStatus }>;
  selectedId: string | null;
  onSelectRoom: (r: Room) => void;
}) {
  const inferred = floor.verification.status === 'inferred';
  return (
    <section
      aria-label={`${building.headline}, ${floorName(floor).toLowerCase()}`}
      className="on-night flex min-h-[420px] flex-1 gap-3 rounded-panel bg-night p-3 sm:gap-5 sm:p-5 lg:min-h-[640px] lg:min-w-0"
    >
      <div role="group" aria-label="Floors" className="flex flex-col gap-1.5 self-start rounded-[14px] bg-night-panel p-1.5">
        {floors.map((f) => {
          const n = allRooms.filter((r) => r.floorId === f.id).length;
          const on = f.id === floor.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              aria-label={`${floorName(f)}, ${n} room${n === 1 ? '' : 's'}`}
              onClick={() => setParams({ floor: f.label, room: null })}
              className={`size-[52px] rounded-control text-lg font-extrabold ${on ? 'bg-glow text-navy' : 'bg-night-raised text-white hover:bg-night-line'}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-heading font-extrabold text-white">{floorName(floor)}</h2>
          <div className="inline-flex items-start gap-2 rounded-control bg-night-raised px-3 py-2 text-small text-line">
            <Info className="mt-px shrink-0" />
            <span>
              Schematic only. Rooms are shown in number order, not their real positions.
              {floor.unlisted
                ? " Penn State's booking site doesn't say which floor these rooms are on."
                : inferred && ' Floor numbers are read from room numbers and not yet confirmed.'}
            </span>
          </div>
        </div>
        {/* Floor plan state "none": number-order tiles. Verified SVG plans render here once sourced (M9). */}
        <div className={`night-grid relative flex flex-1 flex-wrap content-center items-center justify-center rounded-[14px] border-2 border-dashed border-night-line p-4 sm:p-8 ${rooms.length > 6 ? 'gap-3' : 'gap-4 sm:gap-6'}`}>
          {rooms.length === 0 && <p className="text-line">No reservable rooms on this floor.</p>}
          {rooms.map((r) => (
            <RoomTile key={r.id} room={r} compact={rooms.length > 6} status={statuses.get(r.id)!.status} selected={r.id === selectedId} onClick={() => onSelectRoom(r)} />
          ))}
        </div>
        <NightLegend />
      </div>
    </section>
  );
}

const TILE_STYLE = {
  open: 'bg-glow text-navy',
  opensSoon: 'bg-night text-glow border-2 border-dashed border-glow',
  occupied: 'bg-night-raised text-white border-[1.5px] border-night-line',
  unavailable: 'fill-unavailable-night text-white border-[1.5px] border-night-line',
  unknown: 'fill-unknown-night text-white border-[1.5px] border-night-line',
} as const;

function RoomTile({ room, status, selected, compact, onClick }: { room: Room; status: RoomStatus; selected: boolean; compact: boolean; onClick: () => void }) {
  const Icon = STATE_ICON[status.state];
  const label = statusLabel(status, { long: true });
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${room.displayName}, ${label}${selected ? ', selected' : ''}`}
      className={`flex flex-col items-start justify-between rounded-xl text-left ${compact ? 'h-[108px] w-[136px] p-3' : 'h-[150px] w-[min(220px,100%)] p-4 sm:h-[170px]'} ${TILE_STYLE[status.state]} ${
        selected ? 'shadow-[0_0_0_4px_#0E1E3A,0_0_0_7px_#FFFFFF,0_0_48px_8px_rgba(255,200,69,0.35)]' : ''
      }`}
    >
      <Icon size={compact ? 18 : 22} />
      <span>
        <span className={`block leading-tight font-extrabold ${compact ? 'text-[22px]' : 'text-[30px]'}`}>{roomShort(room)}</span>
        <span className={`font-semibold ${compact ? 'text-small' : 'text-[15px]'} ${status.state === 'open' ? '' : 'text-line'}`}>{label}</span>
      </span>
    </button>
  );
}

function NightLegend() {
  const item = (cls: string, text: string) => (
    <span className="inline-flex items-center gap-2">
      <span className={`size-3.5 rounded ${cls}`} aria-hidden="true" />
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-small text-line">
      {item('bg-glow', 'Open')}
      {item('border-2 border-dashed border-glow', 'Opens soon')}
      {item('bg-night-raised border-[1.5px] border-night-line', 'Occupied')}
      {item('fill-unavailable-night', 'Unavailable')}
      {item('fill-unknown-night border-[1.5px] border-night-line', 'Check on PSU site')}
    </div>
  );
}

function shiftDate(date: string, days: number) {
  return DateTime.fromISO(date, { zone: 'America/New_York' }).plus({ days }).toISODate()!;
}

function RoomPanel({ room, building, sel, demo }: { room: Room; building: Building; sel: SelectedTime; demo: boolean }) {
  const policy = getPolicy(room.policyId);
  const provider = getProvider(room.providerId);
  const floor = floorOf(room, building);
  const [showShorter, setShowShorter] = useState(false);
  const day = useMemo(() => roomDay(room, sel.date, sel.now, { demo, showShorter }), [room, sel.date, sel.now, demo, showShorter]);
  const status = roomStatus(day, sel.at);
  const [picked, setPicked] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  // Default selection: the window containing (or next after) the selected time.
  const windows = day.windows;
  const defaultWindow = windows.find((w) => w.end > sel.at) ?? null;
  const chosen = picked !== null ? windows.find((w) => w.start === picked) ?? null : defaultWindow;

  // A picked window can expire as time passes or data refreshes.
  useEffect(() => {
    if (picked !== null && !windows.some((w) => w.start === picked)) {
      setPicked(null);
      setExpired(true);
    }
  }, [picked, windows]);
  useEffect(() => {
    setPicked(null);
    setExpired(false);
  }, [sel.date]);

  // Mobile: move focus into the sheet when it opens.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) panelRef.current?.focus();
  }, []);

  const selection = chosen
    ? { start: chosen.start, end: Math.min(chosen.end, chosen.start + chosen.maxBookingMinutes * MINUTE) }
    : null;
  const shortGaps = day.filtered.filter((f) => f.reason === 'too-short' && f.raw.end > sel.now);
  const today = campusDate(sel.now);
  const horizonEnd = policy.bookingHorizonDays ? shiftDate(today, policy.bookingHorizonDays) : null;
  const close = () => setParams({ room: null }, { push: true });
  const nowish = sel.isLive && sel.isToday;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy/40 lg:hidden" onClick={close} aria-hidden="true" />
      <section
        ref={panelRef}
        tabIndex={-1}
        aria-label={`${room.displayName} details`}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col gap-[18px] overflow-y-auto rounded-t-sheet bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(18,40,76,0.25)] outline-none sm:p-6 lg:static lg:z-auto lg:max-h-none lg:w-[400px] lg:shrink-0 lg:rounded-panel lg:border lg:border-line lg:shadow-none"
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-title leading-tight font-extrabold tracking-[-0.01em]">{room.displayName}</h2>
            <p className="mt-1 text-[15px] text-slate">
              {building.headline}, {floorName(floor).toLowerCase()}.{room.area ? ` ${room.area}.` : ''}
            </p>
            {room.officialLabel !== room.displayName && (
              <p className="mt-1 text-small text-slate">Listed on Penn State's site as “{room.officialLabel}”.</p>
            )}
          </div>
          <button type="button" onClick={close} aria-label="Close room details" className="grid size-11 shrink-0 place-items-center rounded-control border border-line lg:hidden">
            <Close />
          </button>
        </div>

        <StatusChip status={status} long nowish={nowish} size="lg" />

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate">Capacity</dt>
            <dd className="font-semibold">{room.capacity ? `${room.capacity} people` : 'Not verified yet'}</dd>
          </div>
          <div>
            <dt className="text-slate">Features</dt>
            <dd className="font-semibold">{room.features.length ? featureList(room).join(', ') : 'Not verified yet'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate">Who can book</dt>
            <dd>{room.eligibility}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2.5 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous day"
              disabled={sel.date <= today}
              onClick={() => sel.setDate(shiftDate(sel.date, -1))}
              className="grid size-11 place-items-center rounded-control border border-line disabled:opacity-40"
            >
              <ChevronLeft />
            </button>
            <div className="text-base font-semibold" aria-live="polite">
              {sel.date === today ? 'Today, ' : ''}
              {formatDateLabel(sel.date).replace(',', '')}
            </div>
            <button
              type="button"
              aria-label="Next day"
              disabled={horizonEnd !== null && sel.date >= horizonEnd}
              onClick={() => sel.setDate(shiftDate(sel.date, 1))}
              className="grid size-11 place-items-center rounded-control border border-line disabled:opacity-40"
            >
              <ChevronRight />
            </button>
          </div>
          {sel.date !== today && (
            <button type="button" className="self-center text-sm font-semibold underline" onClick={() => sel.setDate(today)}>
              Back to today
            </button>
          )}
          <Timeline day={day} now={sel.now} selected={selection} />
          <p className="text-xs text-slate">Times are Penn State campus time (Eastern).</p>
        </div>

        <Windows
          day={day}
          chosenStart={chosen?.start ?? null}
          onPick={(s) => {
            setPicked(s);
            setExpired(false);
          }}
          maxBooking={policy.maxDurationMinutes}
          unknownText={unknownReason(provider)}
          onNextDay={horizonEnd === null || sel.date < horizonEnd ? () => sel.setDate(shiftDate(sel.date, 1)) : null}
        />
        {expired && (
          <p role="alert" className="rounded-control border-2 border-dashed border-glow-border px-3 py-2 text-sm text-amber-text">
            The time you picked is no longer bookable. It may have passed or been taken. Pick another time.
          </p>
        )}
        {shortGaps.length > 0 && !showShorter && (
          <p className="text-small leading-relaxed text-slate">
            {shortGaps.length === 1
              ? `A ${Math.round((shortGaps[0]!.raw.end - shortGaps[0]!.raw.start) / MINUTE)}-minute gap at ${formatTime(shortGaps[0]!.raw.start)} is hidden because it's shorter than ${day.thresholdMinutes} minutes.`
              : `${shortGaps.length} gaps shorter than ${day.thresholdMinutes} minutes are hidden.`}{' '}
            {policy.minDurationMinutes < day.thresholdMinutes && (
              <button type="button" className="underline" onClick={() => setShowShorter(true)}>
                Show shorter gaps
              </button>
            )}
          </p>
        )}
        {showShorter && (
          <button type="button" className="self-start text-small underline" onClick={() => setShowShorter(false)}>
            Hide short gaps
          </button>
        )}

        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Booking rules</summary>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-muted">
            {policy.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {policy.verifiedFields.length === 0 && (
              <li>Penn State hasn't published duration limits for this room. Gaps under {policy.minUsefulGapMinutes} minutes are hidden by default.</li>
            )}
          </ul>
        </details>

        <div className="mt-auto flex flex-col gap-3">
          <HandoffPanel room={room} building={building} date={sel.date} selection={selection} />
          <FreshnessNote>
            {day.sample ? (
              <>Sample data, generated {Math.round((sel.now - (day.retrievedAt ?? sel.now)) / MINUTE)} min ago. Live availability isn't connected yet.</>
            ) : (
              <>
                Room verified {DateTime.fromISO(room.verification.verifiedAt).toFormat('LLL d, yyyy')} from{' '}
                <a className="underline" href={getSource(room.verification.sourceIds[0]!)?.url} target="_blank" rel="noopener noreferrer">
                  {getSource(room.verification.sourceIds[0]!)?.owner}
                </a>
                . Live availability isn't connected.
              </>
            )}
          </FreshnessNote>
        </div>
      </section>
    </>
  );
}

function Windows({
  day,
  chosenStart,
  onPick,
  maxBooking,
  unknownText,
  onNextDay,
}: {
  day: RoomDay;
  chosenStart: number | null;
  onPick: (start: number) => void;
  maxBooking: number | null;
  unknownText: string;
  onNextDay: (() => void) | null;
}) {
  if (day.freshness !== 'fresh') {
    return (
      <div className="rounded-control fill-unknown p-4 text-sm text-ink-muted">
        <div className="font-semibold text-navy">Open times: check on PSU site</div>
        <p className="mt-1">
          {day.freshness === 'stale'
            ? 'Our last availability check is too old to trust, so we’re not showing it.'
            : day.freshness === 'error'
              ? 'We couldn’t refresh availability from Penn State just now.'
              : unknownText}
        </p>
      </div>
    );
  }
  if (!day.complete) {
    return (
      <div className="rounded-control fill-unknown p-4 text-sm text-ink-muted">
        Penn State only returned part of today’s schedule, so we can’t confirm open times. Check on PSU site.
      </div>
    );
  }
  if (day.windows.length === 0) {
    return (
      <div className="rounded-control border border-line p-4 text-sm">
        <div className="font-semibold">No open times left that are long enough to book.</div>
        {onNextDay && (
          <button type="button" className="mt-1 font-semibold underline" onClick={onNextDay}>
            Check the next day
          </button>
        )}
      </div>
    );
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-base font-semibold">Open times you can book</legend>
      {day.windows.map((w) => {
        const on = w.start === chosenStart;
        const capped = maxBooking !== null && w.durationMinutes > maxBooking;
        return (
          <label
            key={w.start}
            className={`flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-control px-3.5 text-[15px] tabular ${on ? 'border-2 border-navy' : 'border border-line'}`}
          >
            <span className="flex items-center gap-2.5">
              <input type="radio" name="window" checked={on} onChange={() => onPick(w.start)} className="size-[18px] accent-navy" />
              {on ? <strong>{formatRange(w.start, w.end)}</strong> : formatRange(w.start, w.end)}
            </span>
            <span className="text-right text-slate">
              {formatDuration(w.durationMinutes)}
              {capped && <span className="block text-xs">up to {formatDuration(maxBooking!)} per booking</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
