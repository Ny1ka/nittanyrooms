import { formatTime, formatTimeShort, type RoomState, type RoomStatus } from '@nittany-rooms/core';
import { Clock, DoorClosed, DoorOpen, Question, SlashCircle } from './Icons';

/**
 * Room states never rely on color alone: each has a fill/pattern, an icon and a word.
 * (tokens.json → roomState)
 */
export const STATE_STYLE: Record<RoomState, string> = {
  open: 'bg-glow text-navy',
  opensSoon: 'bg-surface text-amber-text border-2 border-dashed border-glow-border',
  occupied: 'bg-navy text-white',
  unavailable: 'fill-unavailable text-ink-muted',
  unknown: 'fill-unknown text-ink-muted',
};

export const STATE_ICON = {
  open: DoorOpen,
  opensSoon: Clock,
  occupied: DoorClosed,
  unavailable: SlashCircle,
  unknown: Question,
} as const;

/** Short word for lists/tiles; `long` adds times. */
export function statusLabel(s: RoomStatus, opts: { long?: boolean; nowish?: boolean } = {}): string {
  switch (s.state) {
    case 'open':
      if (!opts.long || !s.until) return 'Open';
      return `${opts.nowish ? 'Open now' : 'Open'} until ${formatTime(s.until)}`;
    case 'opensSoon':
      return `Opens ${opts.long ? formatTime(s.opensAt!) : formatTimeShort(s.opensAt!)}`;
    case 'occupied':
      return opts.long && s.until ? `Occupied until ${formatTime(s.until)}` : 'Occupied';
    case 'unavailable':
      return 'Unavailable';
    case 'unknown':
      return 'Check on PSU site';
  }
}

export function StatusChip({
  status,
  long,
  nowish,
  size = 'sm',
  showIcon = size === 'lg',
}: {
  status: RoomStatus;
  long?: boolean;
  nowish?: boolean;
  size?: 'sm' | 'lg';
  showIcon?: boolean;
}) {
  const Icon = STATE_ICON[status.state];
  const dims = size === 'lg' ? 'h-[34px] px-3.5 text-sm gap-2' : 'h-7 px-2.5 text-small gap-1.5';
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold tabular ${dims} ${STATE_STYLE[status.state]}`}
    >
      {showIcon && <Icon size={size === 'lg' ? 16 : 14} />}
      {statusLabel(status, { long, nowish })}
    </span>
  );
}
