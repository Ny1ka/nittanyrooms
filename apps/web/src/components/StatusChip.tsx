import { formatTime, formatTimeShort, type RoomState, type RoomStatus } from '@nittany-rooms/core';
import { Clock, DoorClosed, DoorOpen, Question, SlashCircle } from './Icons';

/** Room states never rely on color alone: fill/pattern + icon + word (tokens.json → roomState). */
export const STATE_STYLE: Record<RoomState, string> = {
  open: 'bg-open-soft text-open-text',
  opensSoon: 'border border-dashed border-yellow text-soon-text',
  closingSoon: 'bg-closing-soft text-closing-text',
  occupied: 'bg-busy-soft text-busy-text',
  unavailable: 'fill-unavailable text-fg',
  unknown: 'fill-unknown text-fg',
};

export const STATE_ICON = {
  open: DoorOpen,
  opensSoon: Clock,
  closingSoon: Clock,
  occupied: DoorClosed,
  unavailable: SlashCircle,
  unknown: Question,
} as const;

export function statusLabel(s: RoomStatus, opts: { long?: boolean; nowish?: boolean } = {}): string {
  switch (s.state) {
    case 'open':
      if (!opts.long || !s.until) return 'Open';
      return `${opts.nowish ? 'Open now' : 'Open'} until ${formatTime(s.until)}`;
    case 'opensSoon':
      return `Opens ${opts.long ? formatTime(s.opensAt!) : formatTimeShort(s.opensAt!)}`;
    case 'closingSoon':
      return `Closes ${opts.long ? formatTime(s.until!) : formatTimeShort(s.until!)}`;
    case 'occupied':
      return opts.long && s.until ? `Occupied until ${formatTime(s.until)}` : 'Occupied';
    case 'unavailable':
      return 'Unavailable';
    case 'unknown':
      return 'Check PSU site';
  }
}

export function StatusChip({
  status,
  long,
  nowish,
  size = 'sm',
}: {
  status: RoomStatus;
  long?: boolean;
  nowish?: boolean;
  size?: 'sm' | 'lg';
}) {
  const Icon = STATE_ICON[status.state];
  const dims = size === 'lg' ? 'h-8 px-3 text-[13px] gap-1.5' : 'h-6 px-2 text-[11px] gap-1';
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold tabular ${dims} ${STATE_STYLE[status.state]}`}>
      <Icon size={size === 'lg' ? 14 : 12} />
      {statusLabel(status, { long, nowish })}
    </span>
  );
}
