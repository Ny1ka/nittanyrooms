import { DateTime } from 'luxon';
import { Dataset, type Building, type Room } from '../schema.js';

export interface Issue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  /** e.g. "rooms/ecore-248" */
  ref?: string;
}

export interface AuditReport {
  ok: boolean;
  generatedAt: string;
  errors: Issue[];
  warnings: Issue[];
  counts: Record<string, number>;
  /** Records safe to show as verified. Invalid ones are excluded but kept here for review. */
  userFacing: { buildingIds: string[]; roomIds: string[] };
  excluded: { ref: string; reasons: string[] }[];
}

/** Rough University Park bounding box. Coordinates outside it are rejected. */
export const UNIVERSITY_PARK_BBOX = { minLat: 40.78, maxLat: 40.82, minLon: -77.89, maxLon: -77.84 };

export interface ValidateOptions {
  now?: number;
  /** Records not re-verified within this many days are flagged stale. */
  staleAfterDays?: number;
}

function dupes<T>(items: T[], key: (t: T) => string): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const i of items) {
    const k = key(i);
    if (seen.has(k)) out.add(k);
    seen.add(k);
  }
  return [...out];
}

/** Run every data-quality check (master prompt §3.4) and produce an audit report. */
export function validateDataset(raw: unknown, opts: ValidateOptions = {}): AuditReport {
  const now = opts.now ?? Date.now();
  const staleAfterDays = opts.staleAfterDays ?? 180;
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const excluded = new Map<string, string[]>();
  const exclude = (ref: string, reason: string) => {
    excluded.set(ref, [...(excluded.get(ref) ?? []), reason]);
  };
  const err = (code: string, message: string, ref?: string) => {
    errors.push({ severity: 'error', code, message, ...(ref ? { ref } : {}) });
    if (ref) exclude(ref, code);
  };
  const warn = (code: string, message: string, ref?: string) =>
    warnings.push({ severity: 'warning', code, message, ...(ref ? { ref } : {}) });

  const parsed = Dataset.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      err('schema', `${issue.path.join('.')}: ${issue.message}`);
    }
    return {
      ok: false,
      generatedAt: new Date(now).toISOString(),
      errors,
      warnings,
      counts: {},
      userFacing: { buildingIds: [], roomIds: [] },
      excluded: [],
    };
  }
  const d = parsed.data;

  // Duplicate IDs
  for (const [name, list] of [
    ['sources', d.sources],
    ['providers', d.providers],
    ['policies', d.policies],
    ['buildings', d.buildings],
    ['rooms', d.rooms],
  ] as const) {
    for (const id of dupes(list as { id: string }[], (x) => x.id)) {
      err('duplicate-id', `Duplicate ${name} id "${id}"`, `${name}/${id}`);
    }
  }
  for (const b of d.buildings) {
    for (const id of dupes(b.floors, (f) => f.id)) {
      err('duplicate-floor', `Duplicate floor id "${id}"`, `buildings/${b.id}`);
    }
    for (const lvl of dupes(b.floors, (f) => String(f.level))) {
      err('conflicting-floor', `Two floors share level ${lvl}`, `buildings/${b.id}`);
    }
  }

  const sourceIds = new Set(d.sources.map((s) => s.id));
  const providers = new Map(d.providers.map((p) => [p.id, p]));
  const policies = new Map(d.policies.map((p) => [p.id, p]));
  const buildings = new Map<string, Building>(d.buildings.map((b) => [b.id, b]));

  // Provenance and staleness
  const checkVerification = (
    ref: string,
    v: { sourceIds: string[]; verifiedAt: string },
  ) => {
    for (const s of v.sourceIds) {
      if (!sourceIds.has(s)) err('unknown-source', `References unknown source "${s}"`, ref);
    }
    const age = (now - DateTime.fromISO(v.verifiedAt).toMillis()) / 86_400_000;
    if (age > staleAfterDays) {
      warn('stale-record', `Last verified ${Math.floor(age)} days ago`, ref);
    }
    if (age < -1) err('future-verification', `verifiedAt ${v.verifiedAt} is in the future`, ref);
  };
  d.providers.forEach((p) => checkVerification(`providers/${p.id}`, p.verification));
  d.policies.forEach((p) => {
    checkVerification(`policies/${p.id}`, p.verification);
    if (!providers.has(p.providerId)) {
      err('orphan-policy', `Unknown provider "${p.providerId}"`, `policies/${p.id}`);
    }
    if (p.maxDurationMinutes !== null && p.maxDurationMinutes < p.minDurationMinutes) {
      err('impossible-policy', 'maxDuration < minDuration', `policies/${p.id}`);
    }
  });

  // Buildings
  const bb = UNIVERSITY_PARK_BBOX;
  for (const b of d.buildings) {
    const ref = `buildings/${b.id}`;
    checkVerification(ref, b.verification);
    b.floors.forEach((f) => checkVerification(`${ref}/floors/${f.id}`, f.verification));
    const { lat, lon } = b.location;
    if (lat < bb.minLat || lat > bb.maxLat || lon < bb.minLon || lon > bb.maxLon) {
      err('coords-outside-campus', `(${lat}, ${lon}) is outside University Park`, ref);
    }
    for (const pid of b.providerIds) {
      if (!providers.has(pid)) err('unknown-provider', `Unknown provider "${pid}"`, ref);
    }
    if (b.status === 'verified' && b.verification.status !== 'verified') {
      err('status-mismatch', 'Building marked verified without verified provenance', ref);
    }
  }

  // Rooms
  const labelKey = (r: Room) => `${r.buildingId}::${r.officialLabel}`;
  for (const k of dupes(d.rooms, labelKey)) {
    err('duplicate-room-label', `Two rooms share label ${k.replace('::', ' / ')}`);
  }
  for (const k of dupes(
    d.rooms.filter((r) => r.providerRoomId),
    (r) => `${r.providerId}::${r.providerRoomId}`,
  )) {
    err('duplicate-provider-room-id', `Provider room id reused: ${k}`);
  }
  for (const r of d.rooms) {
    const ref = `rooms/${r.id}`;
    checkVerification(ref, r.verification);
    const b = buildings.get(r.buildingId);
    if (!b) {
      err('orphan-room', `Unknown building "${r.buildingId}"`, ref);
    } else if (!b.floors.some((f) => f.id === r.floorId)) {
      err('orphan-room-floor', `Floor "${r.floorId}" not in ${b.id}`, ref);
    } else if (!b.providerIds.includes(r.providerId)) {
      err('provider-mismatch', `Building ${b.id} doesn't list provider ${r.providerId}`, ref);
    }
    const provider = providers.get(r.providerId);
    if (!provider) err('unknown-provider', `Unknown provider "${r.providerId}"`, ref);
    const policy = policies.get(r.policyId);
    if (!policy) err('unknown-policy', `Unknown policy "${r.policyId}"`, ref);
    else if (policy.providerId !== r.providerId) {
      err('policy-provider-mismatch', `Policy belongs to ${policy.providerId}`, ref);
    }
    if (provider?.handoffMode === 'room-link' && !r.bookingUrl) {
      err('missing-booking-url', 'Provider uses room links but this room has none', ref);
    }
    if (r.verification.status === 'candidate') {
      exclude(ref, 'candidate');
    }
  }

  // Verified buildings need at least one verified room or must say inventory is 'none'.
  for (const b of d.buildings) {
    const rooms = d.rooms.filter((r) => r.buildingId === b.id);
    if (b.roomInventory !== 'none' && rooms.length === 0) {
      err('inventory-mismatch', `roomInventory "${b.roomInventory}" but no rooms`, `buildings/${b.id}`);
    }
    if (b.roomInventory === 'none' && rooms.length > 0) {
      warn('inventory-mismatch', 'roomInventory "none" but rooms exist', `buildings/${b.id}`);
    }
  }

  const roomIds = d.rooms.map((r) => r.id).filter((id) => !excluded.has(`rooms/${id}`));
  const buildingIds = d.buildings.map((b) => b.id).filter((id) => !excluded.has(`buildings/${id}`));

  return {
    ok: errors.length === 0,
    generatedAt: new Date(now).toISOString(),
    errors,
    warnings,
    counts: {
      sources: d.sources.length,
      providers: d.providers.length,
      policies: d.policies.length,
      buildings: d.buildings.length,
      verifiedBuildings: d.buildings.filter((b) => b.status === 'verified').length,
      rooms: d.rooms.length,
    },
    userFacing: { buildingIds, roomIds },
    excluded: [...excluded].map(([ref, reasons]) => ({ ref, reasons })),
  };
}
