import {
  MINUTE,
  campusDate,
  formatDateLabel,
  formatDuration,
  formatRange,
  formatTime,
  type Building,
  type Room,
} from '@nittany-rooms/core';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { roomDay, roomStatus, type RoomDay } from '../lib/availability';
import { floorOf, getPolicy, getProvider, getSource } from '../lib/data';
import { featureList, floorName, unknownReason } from '../lib/labels';
import type { LiveState } from '../lib/live';
import { setParams } from '../lib/router';
import type { SelectedTime } from '../lib/time';
import { HandoffPanel } from '../components/HandoffPanel';
import { RoomActions } from '../components/RoomActions';
import { ChevronLeft, ChevronRight, Star } from '../components/Icons';
import { useFavorites } from '../lib/favorites';
import { FreshnessNote } from '../components/Notices';
import { StatusChip } from '../components/StatusChip';
import { Timeline } from '../components/Timeline';
import { BackButton } from './BuildingPanel';

const shiftDate = (date: string, days: number) =>
  DateTime.fromISO(date, { zone: 'America/New_York' }).plus({ days }).toISODate()!;

const sectionLabel = 'text-[11px] font-semibold tracking-wide text-subtle uppercase';

export function RoomPanel({ room, building, sel, demo, live }: { room: Room; building: Building; sel: SelectedTime; demo: boolean; live: LiveState }) {
  const policy = getPolicy(room.policyId);
  const provider = getProvider(room.providerId);
  const floor = floorOf(room, building);
  const fav = useFavorites();
  const isFav = fav.has(room.id);
  const [showShorter, setShowShorter] = useState(false);
  const day = useMemo(() => roomDay(room, sel.date, sel.now, { demo, showShorter, live }), [room, sel.date, sel.now, demo, showShorter, live]);
  const status = roomStatus(day, sel.at);
  const [picked, setPicked] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  const windows = day.windows;
  const chosen = picked !== null ? (windows.find((w) => w.start === picked) ?? null) : (windows.find((w) => w.end > sel.at) ?? null);
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

  // Start at the selected time when it falls inside the window, else at the window start.
  const selStart = chosen ? ((sel.at > chosen.start ? chosen.startTimes.find((t) => t >= sel.at) : undefined) ?? chosen.start) : null;
  const maxEnd = (s: number) => (policy.maxDurationMinutes === null ? Infinity : s + policy.maxDurationMinutes * MINUTE);
  const selection = chosen && selStart !== null ? { start: selStart, end: Math.min(chosen.end, maxEnd(selStart)) } : null;

  const shortGaps = day.filtered.filter((f) => f.reason === 'too-short' && f.raw.end > sel.now);
  const today = campusDate(sel.now);
  const horizonEnd = policy.bookingHorizonDays ? shiftDate(today, policy.bookingHorizonDays) : null;
  const canNext = horizonEnd === null || sel.date < horizonEnd;
  const meta = [floorName(floor), room.area, room.capacity ? `${room.capacity} seats` : null].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4 px-4 py-3">
      <BackButton label={building.headline} onClick={() => setParams({ room: null }, { push: true })} />

      <div className="space-y-2">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl leading-tight font-semibold">{room.displayName}</h1>
            <button
              type="button"
              aria-pressed={isFav}
              aria-label={isFav ? `Remove ${room.displayName} from favorites` : `Save ${room.displayName} to favorites`}
              title={isFav ? 'Remove from favorites' : 'Save to favorites'}
              onClick={() => fav.toggle(room.id)}
              className={`grid size-8 shrink-0 place-items-center rounded-control hover:bg-surface-2 ${isFav ? 'text-yellow' : 'text-subtle hover:text-fg'}`}
            >
              <Star size={18} filled={isFav} />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-muted">{meta}</p>
          {room.officialLabel !== room.displayName && (
            <p className="mt-0.5 text-[11px] text-subtle">On Penn State's site: “{room.officialLabel}”</p>
          )}
        </div>
        <StatusChip status={status} long nowish={sel.isLive && sel.isToday} size="lg" />
        {room.features.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Features">
            {featureList(room).map((f) => (
              <li key={f} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                {f}
              </li>
            ))}
          </ul>
        )}
        {room.capacity === null && <p className="text-[11px] text-subtle">Capacity and features not published.</p>}
      </div>

      <section className="space-y-2" aria-label="Availability">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Previous day" disabled={sel.date <= today} onClick={() => sel.setDate(shiftDate(sel.date, -1))} className="grid size-8 place-items-center rounded-control text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30">
            <ChevronLeft size={14} />
          </button>
          <div className="text-center text-[13px] font-semibold" aria-live="polite">
            {sel.date === today ? 'Today · ' : ''}
            {formatDateLabel(sel.date)}
            {sel.date !== today && (
              <button type="button" className="ml-2 text-xs font-semibold text-muted underline underline-offset-2 hover:text-fg" onClick={() => sel.setDate(today)}>
                Today
              </button>
            )}
          </div>
          <button type="button" aria-label="Next day" disabled={!canNext} onClick={() => sel.setDate(shiftDate(sel.date, 1))} className="grid size-8 place-items-center rounded-control text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30">
            <ChevronRight size={14} />
          </button>
        </div>
        <Timeline day={day} now={sel.now} selected={selection} />
      </section>

      <Windows
        day={day}
        chosenStart={chosen?.start ?? null}
        onPick={(s) => {
          setPicked(s);
          setExpired(false);
        }}
        maxBooking={policy.maxDurationMinutes}
        unknownText={unknownReason(provider)}
        onNextDay={canNext ? () => sel.setDate(shiftDate(sel.date, 1)) : null}
      />
      {expired && (
        <p role="alert" className="rounded-control border border-dashed border-yellow px-3 py-2 text-xs text-soon-text">
          That time is no longer bookable. It may have passed or been taken.
        </p>
      )}
      {shortGaps.length > 0 && !showShorter && (
        <p className="text-xs text-subtle">
          {shortGaps.length === 1
            ? `A ${Math.round((shortGaps[0]!.raw.end - shortGaps[0]!.raw.start) / MINUTE)}-min gap at ${formatTime(shortGaps[0]!.raw.start)} is hidden (under ${day.thresholdMinutes} min).`
            : `${shortGaps.length} gaps under ${day.thresholdMinutes} min are hidden.`}{' '}
          {policy.minDurationMinutes < day.thresholdMinutes && (
            <button type="button" className="font-semibold text-muted underline underline-offset-2 hover:text-fg" onClick={() => setShowShorter(true)}>
              Show
            </button>
          )}
        </p>
      )}
      {showShorter && (
        <button type="button" className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-fg" onClick={() => setShowShorter(false)}>
          Hide short gaps
        </button>
      )}

      <HandoffPanel room={room} building={building} date={sel.date} selection={selection} />
      <RoomActions room={room} building={building} date={sel.date} selection={selection} at={sel.at} />

      <details className="group text-xs text-muted">
        <summary className="cursor-pointer list-none font-semibold text-fg">
          <span className="underline-offset-2 group-open:underline">Booking rules</span>
        </summary>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li>{room.eligibility}</li>
          {policy.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
          {policy.verifiedFields.length === 0 && <li>No published duration limits. Gaps under {policy.minUsefulGapMinutes} min are hidden by default.</li>}
        </ul>
      </details>

      <RoomFreshness day={day} room={room} live={live} now={sel.now} />
    </div>
  );
}

function RoomFreshness({ day, room, live, now }: { day: RoomDay; room: Room; live: LiveState; now: number }) {
  const provider = getProvider(room.providerId);
  const src = getSource(room.verification.sourceIds[0]!);
  if (day.sample) {
    return <FreshnessNote tone="warn">Sample data, generated {Math.round((now - (day.retrievedAt ?? now)) / MINUTE)} min ago. Not real availability.</FreshnessNote>;
  }
  if (day.live) {
    return (
      <FreshnessNote tone="live">
        Checked {formatTime(day.retrievedAt!)} from{' '}
        <a className="underline underline-offset-2 hover:text-fg" href={provider.portalUrl} target="_blank" rel="noopener noreferrer">
          Penn State's LibCal
        </a>
        . Penn State's page has the final say.
      </FreshnessNote>
    );
  }
  if (provider.system === 'libcal' && live.status === 'error') {
    return (
      <FreshnessNote tone="warn">
        Couldn't reach Penn State's LibCal.{' '}
        <button type="button" className="font-semibold text-fg underline underline-offset-2" onClick={live.refetch}>
          Retry
        </button>
      </FreshnessNote>
    );
  }
  return (
    <FreshnessNote>
      Room verified {DateTime.fromISO(room.verification.verifiedAt).toFormat('LLL d, yyyy')} from{' '}
      <a className="underline underline-offset-2 hover:text-fg" href={src?.url} target="_blank" rel="noopener noreferrer">
        {src?.owner}
      </a>
      .
    </FreshnessNote>
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
  const box = 'rounded-control p-3 text-xs';
  const next = onNextDay && (
    <button type="button" className="mt-1 font-semibold text-fg underline underline-offset-2" onClick={onNextDay}>
      Check the next day
    </button>
  );
  if (day.freshness !== 'fresh') {
    return (
      <div className={`${box} fill-unknown text-fg`}>
        <div className="font-semibold">Open times: check PSU site</div>
        <p className="mt-0.5 text-muted">
          {day.freshness === 'stale'
            ? 'Our last check is too old to trust, so it’s hidden.'
            : day.freshness === 'error'
              ? 'We couldn’t refresh availability from Penn State just now.'
              : unknownText}
        </p>
      </div>
    );
  }
  if (!day.complete) {
    return <div className={`${box} fill-unknown text-fg`}>Penn State returned only part of the schedule, so open times can’t be confirmed.</div>;
  }
  if (day.windows.length === 0 && day.segments.every((s) => s.kind === 'closed')) {
    return (
      <div className={`${box} fill-unavailable text-fg`}>
        <div className="font-semibold">Not bookable on this day</div>
        <p className="mt-0.5">Penn State's system has no times for this room. The library may be closed.</p>
        {next}
      </div>
    );
  }
  if (day.windows.length === 0) {
    return (
      <div className={`${box} border border-line`}>
        <div className="font-semibold">No open times left that are long enough to book.</div>
        {next}
      </div>
    );
  }
  return (
    <fieldset className="space-y-1.5">
      <legend className={`${sectionLabel} mb-1.5`}>Open times you can book</legend>
      {day.windows.map((w) => {
        const on = w.start === chosenStart;
        const capped = maxBooking !== null && w.durationMinutes > maxBooking;
        return (
          <label
            key={w.start}
            className={`flex h-11 cursor-pointer items-center justify-between gap-3 rounded-control px-3 text-[13px] tabular ${on ? 'bg-accent-soft ring-1 ring-accent-border' : 'bg-surface-2 hover:bg-surface-3'}`}
          >
            <span className="flex items-center gap-2.5">
              <input type="radio" name="window" checked={on} onChange={() => onPick(w.start)} className="size-4 accent-[var(--nr-accent)]" />
              <span className={on ? 'font-semibold' : ''}>{formatRange(w.start, w.end)}</span>
            </span>
            <span className="text-right text-xs text-muted">
              {formatDuration(w.durationMinutes)}
              {capped && <span className="block text-[10px] text-subtle">max {formatDuration(maxBooking!)} per booking</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
