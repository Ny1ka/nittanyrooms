import { z } from 'zod';
import type { Issue } from './validate/index.js';

/**
 * Manually maintained building hours (for buildings whose hours can't be read
 * from a live source). Every entry cites a source; unknown buildings show
 * "Hours unavailable" rather than invented hours.
 */
const HHMM = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/);
const Span = z.tuple([HHMM, HHMM]);
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const BuildingHoursEntry = z.object({
  buildingId: z.string(),
  /** Open spans per weekday; an empty array means closed that day. */
  weekly: z.object(Object.fromEntries(DAYS.map((d) => [d, z.array(Span)])) as Record<(typeof DAYS)[number], z.ZodArray<typeof Span>>),
  /** Date-specific overrides (holidays, breaks, finals). */
  exceptions: z.array(z.object({ date: z.iso.date(), hours: z.array(Span), note: z.string().optional() })),
  /** Optional validity window for the weekly schedule (e.g. a semester). */
  validFrom: z.iso.date().optional(),
  validTo: z.iso.date().optional(),
  sourceId: z.string(),
  verifiedAt: z.iso.date(),
});
export type BuildingHoursEntry = z.infer<typeof BuildingHoursEntry>;
export const WEEKDAYS = DAYS;

export function validateBuildingHours(raw: unknown, ctx: { buildingIds: string[]; sourceIds: string[]; now?: number }): Issue[] {
  const parsed = z.array(BuildingHoursEntry).safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({ severity: 'error' as const, code: 'hours-schema', message: `${i.path.join('.')}: ${i.message}` }));
  }
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const now = ctx.now ?? Date.now();
  for (const h of parsed.data) {
    const ref = `building-hours/${h.buildingId}`;
    if (seen.has(h.buildingId)) issues.push({ severity: 'error', code: 'duplicate-hours', message: 'Two entries for one building', ref });
    seen.add(h.buildingId);
    if (!ctx.buildingIds.includes(h.buildingId)) issues.push({ severity: 'error', code: 'unknown-building', message: h.buildingId, ref });
    if (!ctx.sourceIds.includes(h.sourceId)) issues.push({ severity: 'error', code: 'unknown-source', message: h.sourceId, ref });
    const spans = [...Object.values(h.weekly).flat(), ...h.exceptions.flatMap((e) => e.hours)];
    if (spans.some(([a, b]) => a === b)) issues.push({ severity: 'error', code: 'empty-span', message: 'Open and close are equal', ref });
    if ((now - Date.parse(h.verifiedAt)) / 86_400_000 > 120) issues.push({ severity: 'warning', code: 'stale-hours', message: 'Hours not re-checked in 120 days', ref });
  }
  return issues;
}
