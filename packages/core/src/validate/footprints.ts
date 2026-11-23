import { z } from 'zod';
import { UNIVERSITY_PARK_BBOX, type Issue } from './index.js';

const Position = z.tuple([z.number(), z.number()]);
export const FootprintCollection = z.object({
  type: z.literal('FeatureCollection'),
  source: z.string().min(1),
  retrievedAt: z.iso.date(),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      properties: z.object({
        buildingId: z.string(),
        name: z.string().nullable(),
        osmElement: z.string().regex(/^(way|relation)\/\d+$/),
        heightMeters: z.number().positive().max(200),
        heightSource: z.string().min(1),
      }),
      geometry: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(Position).min(4)).min(1),
      }),
    }),
  ),
});
export type FootprintCollection = z.infer<typeof FootprintCollection>;

/** Footprints must parse, reference known buildings, stay on campus, and be closed rings. */
export function validateFootprints(raw: unknown, buildingIds: string[], verifiedIds: string[]): Issue[] {
  const issues: Issue[] = [];
  const parsed = FootprintCollection.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({
      severity: 'error' as const,
      code: 'footprint-schema',
      message: `${i.path.join('.')}: ${i.message}`,
    }));
  }
  const bb = UNIVERSITY_PARK_BBOX;
  const covered = new Set<string>();
  parsed.data.features.forEach((f, idx) => {
    const ref = `footprints/${idx}`;
    const id = f.properties.buildingId;
    covered.add(id);
    if (!buildingIds.includes(id)) {
      issues.push({ severity: 'error', code: 'footprint-orphan', message: `Unknown building "${id}"`, ref });
    }
    for (const ring of f.geometry.coordinates) {
      const [a, z2] = [ring[0]!, ring[ring.length - 1]!];
      if (a[0] !== z2[0] || a[1] !== z2[1]) {
        issues.push({ severity: 'error', code: 'footprint-open-ring', message: 'Ring is not closed', ref });
      }
      if (ring.some(([lon, lat]) => lat < bb.minLat || lat > bb.maxLat || lon < bb.minLon || lon > bb.maxLon)) {
        issues.push({ severity: 'error', code: 'footprint-outside-campus', message: 'Point outside University Park', ref });
      }
    }
  });
  for (const id of verifiedIds) {
    if (!covered.has(id)) {
      issues.push({ severity: 'warning', code: 'footprint-missing', message: `No footprint for ${id}`, ref: `buildings/${id}` });
    }
  }
  return issues;
}
