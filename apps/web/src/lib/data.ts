import {
  FEATURE_LABELS,
  loadDataset,
  loadFootprints,
  loadOpenSpaces,
  loadBuildingHours,
  rawDataset,
  validateDataset,
  type Building,
  type ReservationPolicy,
  type ReservationProvider,
  type Room,
} from '@nittany-rooms/core';

/**
 * The user-facing inventory: schema-valid records that passed every data-quality
 * check. Anything the audit excludes never reaches the UI.
 */
const dataset = loadDataset();
const audit = validateDataset(rawDataset);
const okBuildings = new Set(audit.userFacing.buildingIds);
const okRooms = new Set(audit.userFacing.roomIds);

export const buildings: Building[] = dataset.buildings.filter((b) => okBuildings.has(b.id));
export const rooms: Room[] = dataset.rooms
  .filter((r) => okRooms.has(r.id))
  .sort((a, b) => a.officialLabel.localeCompare(b.officialLabel, 'en', { numeric: true }));
export const sources = dataset.sources;
export const footprints = loadFootprints();
export const openSpaces = loadOpenSpaces();
export const buildingHoursTable = loadBuildingHours();

const providers = new Map(dataset.providers.map((p) => [p.id, p]));
const policies = new Map(dataset.policies.map((p) => [p.id, p]));

export const getBuilding = (id: string) => buildings.find((b) => b.id === id);
export const getProvider = (id: string): ReservationProvider => providers.get(id)!;
export const getPolicy = (id: string): ReservationPolicy => policies.get(id)!;
export const roomsIn = (buildingId: string) => rooms.filter((r) => r.buildingId === buildingId);
export const getSource = (id: string) => sources.find((s) => s.id === id);

export function floorOf(room: Room, building: Building) {
  return building.floors.find((f) => f.id === room.floorId);
}

/** Lowercase haystack for search: names, aliases, room labels. */
export function searchIndex() {
  const entries: { kind: 'building' | 'room'; id: string; buildingId: string; label: string; sub: string; hay: string }[] = [];
  for (const b of buildings) {
    entries.push({
      kind: 'building',
      id: b.id,
      buildingId: b.id,
      label: b.headline,
      sub: b.headline === b.name ? b.shortName : b.name,
      hay: [b.name, b.shortName, b.headline, ...b.aliases].join(' ').toLowerCase(),
    });
  }
  for (const r of rooms) {
    const b = getBuilding(r.buildingId)!;
    entries.push({
      kind: 'room',
      id: r.id,
      buildingId: b.id,
      label: r.displayName,
      sub: [r.area, b.headline].filter(Boolean).join(' · '),
      hay: [r.displayName, r.officialLabel, r.shortLabel ?? '', r.area ?? '', b.shortName, b.headline, ...b.aliases, ...r.features.map((f) => FEATURE_LABELS[f])]
        .join(' ')
        .toLowerCase(),
    });
  }
  return entries;
}
