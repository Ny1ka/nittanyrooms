/**
 * Ingest a LibCal room snapshot into data/.
 *
 *   pnpm --filter @nittany-rooms/core ingest:libcal ../../docs/research/libcal-rooms-2026-11-22.json
 *
 * Idempotent: replaces every room owned by the `psul-libcal` provider and the
 * floors/status of the mapped library buildings, leaving other data untouched.
 * Every derived value (floor, short label, area) follows a rule written here and
 * is marked "inferred" in the data. Rooms that don't map cleanly are excluded and
 * listed in the report rather than guessed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Building, DataSource, Floor, Room, RoomFeature } from '../src/schema.js';
import { validateDataset } from '../src/validate/index.js';

const DATA = resolve(import.meta.dirname, '../../../data');
const PROVIDER = 'psul-libcal';
const POLICY = 'psul-group-study';
const SOURCE_ID = 'psu-libcal-up-spaces';
const LIBCAL_ORIGIN = 'https://psu.libcal.com';

interface SnapshotRoom {
  eid: number;
  title: string;
  url: string;
  grouping: string;
  gid: number;
  lid: number;
  capacity: number;
  features: string[];
}
interface Snapshot {
  source: string;
  retrievedAt: string;
  rooms: SnapshotRoom[];
}

/** LibCal grouping → our building id. Unlisted groupings are excluded. */
const GROUPING_TO_BUILDING: Record<string, string> = {
  'Pattee / Paterno Library': 'pattee-paterno',
  'Earth and Mineral Sciences Library': 'deike',
  'Physical and Mathematical Sciences Library': 'davey',
  'Architecture and Landscape Architecture Library': 'stuckeman',
};
const EXCLUDED_GROUPINGS: Record<string, string> = {
  'Wellness space': 'single-occupancy wellness room, not a study room',
};

const FEATURE_MAP: Record<string, RoomFeature> = {
  'Accessible Seat/Space': 'accessible',
  'Desktop PC': 'desktop-pc',
  'Power Available': 'power',
  'Screen Monitor': 'screen-monitor',
  Solstice: 'solstice',
  Whiteboard: 'whiteboard',
};

const BUILDING_WORDS = ['Pattee', 'Paterno', 'Deike', 'Davey', 'Stuckeman'];

/**
 * Confirmed floors for buildings whose room titles don't carry a number
 * (e.g. "Davey Collaboration Space 1"). Each entry cites its source.
 */
const BUILDING_FLOOR_OVERRIDES: Record<string, { label: string; level: number; sourceId: string; note: string }> = {
  davey: {
    label: '2',
    level: 2,
    sourceId: 'owner-pms-floor',
    note: 'Physical and Mathematical Sciences Library is on the 2nd floor of Davey Laboratory (project owner, 2026-11-23).',
  },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "Pattee W120 - Knowledge Commons" → head "Pattee W120", area "Knowledge Commons". */
export function parseTitle(title: string) {
  const parts = title.split(' - ').map((p) => p.trim());
  const head = parts[0]!;
  const area = parts.slice(1).find((p) => !/Libr?ar?y/i.test(p)) ?? null;
  const m = new RegExp(`^(${BUILDING_WORDS.join('|')})\\s+(.+)$`).exec(head);
  if (!m) return null;
  return { head, buildingWord: m[1]!, roomNo: m[2]!, area };
}

/** Floor from a room number: first digit, with 0xx → ground ("G"). Otherwise unlisted. */
export function inferFloor(roomNo: string): { label: string; level: number } | null {
  const m = /^[A-Z]?(\d)\d{2}[A-Z]?$/.exec(roomNo);
  if (!m) return null;
  const d = Number(m[1]);
  return d === 0 ? { label: 'G', level: 0 } : { label: String(d), level: d };
}

function main() {
  const snapPath = process.argv[2];
  if (!snapPath) throw new Error('Usage: ingest-libcal <snapshot.json>');
  const snap = JSON.parse(readFileSync(resolve(snapPath), 'utf8')) as Snapshot;
  const read = <T>(f: string): T => JSON.parse(readFileSync(`${DATA}/${f}`, 'utf8')) as T;
  const sources = read<DataSource[]>('sources.json');
  const buildings = read<Building[]>('buildings.json');
  const allRooms = read<Room[]>('rooms.json');

  const verification = (status: 'verified' | 'inferred' | 'candidate', note?: string) => ({
    status,
    sourceIds: [SOURCE_ID],
    verifiedAt: snap.retrievedAt,
    ...(note ? { note } : {}),
  });

  const excluded: string[] = [];
  const rooms: Room[] = [];
  const floorsByBuilding = new Map<string, Map<string, Floor>>();

  for (const r of snap.rooms) {
    if (EXCLUDED_GROUPINGS[r.grouping]) {
      excluded.push(`${r.title} (eid ${r.eid}): ${EXCLUDED_GROUPINGS[r.grouping]}`);
      continue;
    }
    const buildingId = GROUPING_TO_BUILDING[r.grouping];
    const parsed = parseTitle(r.title);
    if (!buildingId || !parsed) {
      excluded.push(`${r.title} (eid ${r.eid}): unrecognised grouping or title`);
      continue;
    }
    const features: RoomFeature[] = [];
    for (const f of r.features) {
      const mapped = FEATURE_MAP[f];
      if (!mapped) throw new Error(`Unknown LibCal feature "${f}" on ${r.title}`);
      features.push(mapped);
    }
    const override = BUILDING_FLOOR_OVERRIDES[buildingId];
    const inferred = override ? { label: override.label, level: override.level } : inferFloor(parsed.roomNo);
    const floors = floorsByBuilding.get(buildingId) ?? new Map<string, Floor>();
    floorsByBuilding.set(buildingId, floors);
    const floorKey = inferred ? inferred.label : 'unlisted';
    if (!floors.has(floorKey)) {
      floors.set(
        floorKey,
        inferred
          ? {
              id: `${buildingId}-f${inferred.label.toLowerCase()}`,
              label: inferred.label,
              level: inferred.level,
              floorplan: 'none',
              verification: override
                ? { status: 'verified' as const, sourceIds: [SOURCE_ID, override.sourceId], verifiedAt: snap.retrievedAt, note: override.note }
                : verification(
                'inferred',
                inferred.level === 0
                  ? 'Ground level read from 0xx room numbers; not confirmed by a floor plan.'
                  : 'Floor read from the first digit of the room number; not confirmed by a floor plan.',
              ),
            }
          : {
              id: `${buildingId}-funlisted`,
              label: '?',
              level: 999,
              unlisted: true,
              floorplan: 'none',
              verification: verification('candidate', "LibCal doesn't say which floor these rooms are on."),
            },
      );
    }
    const floor = floors.get(floorKey)!;
    rooms.push({
      id: `${slug(parsed.buildingWord)}-${slug(parsed.roomNo)}`,
      providerRoomId: String(r.eid),
      buildingId,
      floorId: floor.id,
      officialLabel: r.title,
      shortLabel: parsed.roomNo.replace(/^Collaboration Space /, 'Collab '),
      displayName: parsed.head,
      area: parsed.area,
      type: 'group-study',
      capacity: r.capacity > 0 ? r.capacity : null,
      features,
      eligibility:
        'Penn State students have priority. Reservations are for two or more people, based on seating capacity.',
      providerId: PROVIDER,
      policyId: POLICY,
      bookingUrl: new URL(r.url, LIBCAL_ORIGIN).toString(),
      floorplanLocation: 'unknown',
      floorVerification: override ? 'verified' : inferred ? 'inferred' : 'candidate',
      verification: verification('verified'),
    });
  }

  // Source record
  const source: DataSource = {
    id: SOURCE_ID,
    name: 'LibCal: University Park study spaces (all groups)',
    owner: 'Penn State University Libraries (Springshare LibCal)',
    url: snap.source,
    accessMethod: 'public-page',
    retrievedAt: snap.retrievedAt,
    notes: 'Room list parsed from the public page (resources.push blocks): eid, title, capacity, features, booking URL.',
  };
  const ownerFloor: DataSource = {
    id: 'owner-pms-floor',
    name: 'Project owner confirmation: PMS Library floor',
    owner: 'Nittany Rooms project owner',
    url: 'https://libraries.psu.edu/hours-and-locations',
    accessMethod: 'manual',
    retrievedAt: '2026-11-23',
    notes: 'The Physical and Mathematical Sciences Library (Davey Laboratory) is on the 2nd floor, so all its reservable rooms are on floor 2.',
  };
  const nextSources = [...sources.filter((s) => s.id !== SOURCE_ID && s.id !== ownerFloor.id), source, ownerFloor];

  // Buildings: floors, status, notes
  const nextBuildings = buildings.map((b) => {
    const floors = floorsByBuilding.get(b.id);
    if (!floors) return b;
    const roomCount = rooms.filter((r) => r.buildingId === b.id).length;
    const hasUnlisted = [...floors.values()].some((f) => f.unlisted);
    return {
      ...b,
      status: 'verified' as const,
      roomInventory: 'complete' as const,
      floors: [...floors.values()].sort((a, z) => a.level - z.level),
      notes: [
        `${roomCount} reservable room${roomCount === 1 ? '' : 's'} listed in the Libraries' LibCal (checked ${snap.retrievedAt}).`,
        b.id in BUILDING_FLOOR_OVERRIDES
          ? BUILDING_FLOOR_OVERRIDES[b.id]!.note
          : 'Floors are read from room numbers and not yet confirmed by a floor plan.',
        ...(hasUnlisted ? ["Some rooms don't have a floor listed in LibCal, so they're grouped under “?”."] : []),
      ],
      verification: {
        status: 'verified' as const,
        sourceIds: [SOURCE_ID, 'osm'],
        verifiedAt: snap.retrievedAt,
      },
    };
  });

  const nextRooms = [...allRooms.filter((r) => r.providerId !== PROVIDER), ...rooms];

  // Validate before writing anything.
  const report = validateDataset({
    sources: nextSources,
    providers: read('providers.json'),
    policies: read('policies.json'),
    buildings: nextBuildings,
    rooms: nextRooms,
  });
  if (!report.ok) {
    for (const e of report.errors) console.error(`✗ [${e.code}] ${e.ref ?? ''} ${e.message}`);
    throw new Error('Validation failed; nothing written.');
  }

  const write = (f: string, v: unknown) => writeFileSync(`${DATA}/${f}`, `${JSON.stringify(v, null, 2)}\n`);
  write('sources.json', nextSources);
  write('buildings.json', nextBuildings);
  write('rooms.json', nextRooms);

  console.log(`Ingested ${rooms.length} LibCal rooms from ${snap.source} (${snap.retrievedAt}).`);
  for (const [b, floors] of floorsByBuilding) {
    const counts = [...floors.values()].map(
      (f) => `${f.label}:${rooms.filter((r) => r.floorId === f.id).length}`,
    );
    console.log(`  ${b}: ${counts.join('  ')}`);
  }
  for (const e of excluded) console.log(`  – excluded ${e}`);
}

if (process.argv[1]?.endsWith('ingest-libcal.ts')) main();
