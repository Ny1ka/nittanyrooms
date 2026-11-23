import { campusDate } from '@nittany-rooms/core';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { AvailabilityPayload, BOOKING_HORIZON_DAYS } from '../../api/_lib/libcal';

/**
 * Live LibCal availability for one campus date, from our /api/availability
 * function. Refreshes every 3 minutes while the page is open. Anything other
 * than a fresh, valid payload leaves library rooms as "unknown".
 */
export type LiveState =
  | { status: 'loading' }
  | { status: 'ok'; data: AvailabilityPayload; retrievedAt: number; refetch: () => void }
  | { status: 'error'; message: string; refetch: () => void }
  | { status: 'disabled' }
  | { status: 'out-of-range' };

class DisabledError extends Error {}

export async function fetchAvailability(date: string): Promise<AvailabilityPayload> {
  const res = await fetch(`/api/availability?date=${date}`, { headers: { accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 503 && (body as { error?: string } | null)?.error === 'disabled') {
    throw new DisabledError('disabled');
  }
  if (!res.ok) throw new Error(`Availability service returned ${res.status}`);
  const parsed = AvailabilityPayload.safeParse(body);
  if (!parsed.success || parsed.data.date !== date) throw new Error('Unexpected availability response');
  return parsed.data;
}

export function useLiveLibcal(date: string, now: number): LiveState {
  const today = campusDate(now);
  const last = DateTime.fromISO(today).plus({ days: BOOKING_HORIZON_DAYS }).toISODate()!;
  const inRange = date >= today && date <= last;
  const q = useQuery({
    queryKey: ['libcal-availability', date],
    queryFn: () => fetchAvailability(date),
    enabled: inRange,
    staleTime: 2 * 60_000,
    refetchInterval: 3 * 60_000,
    refetchOnWindowFocus: true,
    retry: (count, err) => !(err instanceof DisabledError) && count < 1,
  });
  if (!inRange) return { status: 'out-of-range' };
  if (q.data) {
    return { status: 'ok', data: q.data, retrievedAt: Date.parse(q.data.retrievedAt), refetch: () => void q.refetch() };
  }
  if (q.error instanceof DisabledError) return { status: 'disabled' };
  if (q.error) return { status: 'error', message: q.error.message, refetch: () => void q.refetch() };
  return { status: 'loading' };
}
