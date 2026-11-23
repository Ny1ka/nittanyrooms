import { z } from 'zod';
import { UNIVERSITY_PARK_BBOX, type Issue } from './validate/index.js';

/**
 * Walk-in study spaces (not reservable): library study floors, commons, lounges.
 * Hours come from a stated source, never guessed:
 *  - "libcal": live, inferred from the building's LibCal bookable hours (same feed as rooms)
 *  - "not-published": no official weekly hours, so the UI shows "Check hours" with a link
 */
export const OpenSpace = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  /** Building with reservable rooms this space is in (for LibCal-derived hours), if any. */
  buildingId: z.string().nullable(),
  buildingName: z.string().min(1),
  location: z.object({ lat: z.number(), lon: z.number(), osmElement: z.string().regex(/^(node|way|relation)\/\d+$/) }),
  kind: z.enum(['library', 'commons', 'lounge']),
  access: z.string().min(1),
  hours: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('libcal') }),
    z.object({ mode: z.literal('not-published') }),
  ]),
  /** Official page students should check (hours/policies). */
  url: z.url(),
  notes: z.array(z.string()),
  verification: z.object({ sourceIds: z.array(z.string()).min(1), verifiedAt: z.iso.date() }),
});
export type OpenSpace = z.infer<typeof OpenSpace>;

export function validateOpenSpaces(raw: unknown, ctx: { buildingIds: string[]; sourceIds: string[]; now?: number }): Issue[] {
  const parsed = z.array(OpenSpace).safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({ severity: 'error' as const, code: 'open-space-schema', message: `${i.path.join('.')}: ${i.message}` }));
  }
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const bb = UNIVERSITY_PARK_BBOX;
  const now = ctx.now ?? Date.now();
  for (const s of parsed.data) {
    const ref = `open-spaces/${s.id}`;
    if (seen.has(s.id)) issues.push({ severity: 'error', code: 'duplicate-id', message: `Duplicate id ${s.id}`, ref });
    seen.add(s.id);
    if (s.buildingId && !ctx.buildingIds.includes(s.buildingId)) issues.push({ severity: 'error', code: 'unknown-building', message: s.buildingId, ref });
    if (s.hours.mode === 'libcal' && !s.buildingId) issues.push({ severity: 'error', code: 'libcal-needs-building', message: 'LibCal hours need a building', ref });
    for (const id of s.verification.sourceIds) if (!ctx.sourceIds.includes(id)) issues.push({ severity: 'error', code: 'unknown-source', message: id, ref });
    const { lat, lon } = s.location;
    if (lat < bb.minLat || lat > bb.maxLat || lon < bb.minLon || lon > bb.maxLon) issues.push({ severity: 'error', code: 'coords-outside-campus', message: `${lat},${lon}`, ref });
    const ageDays = (now - Date.parse(s.verification.verifiedAt)) / 86_400_000;
    if (ageDays > 60) issues.push({ severity: 'warning', code: 'stale-open-space', message: `Checked ${Math.floor(ageDays)} days ago; re-check hours and access`, ref });
  }
  return issues;
}
