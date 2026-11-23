import { describe, expect, it } from 'vitest';
import { buildHandoff, loadDataset, localTime, rawDataset, rawFootprints, rawOpenSpaces, validateDataset, validateFootprints, validateOpenSpaces } from '../src/index.js';

const NOW = Date.parse('2026-11-23T12:00:00Z');
const clone = () => structuredClone(rawDataset) as any;

describe('validateDataset', () => {
  it('passes on the committed dataset', () => {
    const r = validateDataset(rawDataset, { now: NOW });
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.userFacing.roomIds).toContain('ecore-248');
  });

  it('rejects duplicate room ids', () => {
    const d = clone();
    d.rooms.push({ ...d.rooms[0], officialLabel: '999' });
    const r = validateDataset(d, { now: NOW });
    expect(r.errors.map((e) => e.code)).toContain('duplicate-id');
  });

  it('rejects duplicate room labels in the same building', () => {
    const d = clone();
    d.rooms.push({ ...d.rooms[0], id: 'ecore-dup' });
    expect(validateDataset(d, { now: NOW }).errors.map((e) => e.code)).toContain(
      'duplicate-room-label',
    );
  });

  it('flags missing booking URLs for room-link providers', () => {
    const d = clone();
    d.rooms.push({
      ...d.rooms[0],
      id: 'pattee-w120',
      officialLabel: 'W120',
      buildingId: 'pattee-paterno',
      floorId: 'pp-f1',
      providerId: 'psul-libcal',
      policyId: 'psul-group-study',
      bookingUrl: null,
    });
    d.buildings.find((b: any) => b.id === 'pattee-paterno').floors.push({
      id: 'pp-f1',
      label: '1',
      level: 1,
      floorplan: 'none',
      verification: { status: 'verified', sourceIds: ['psul-rooms-spaces'], verifiedAt: '2026-11-22' },
    });
    const r = validateDataset(d, { now: NOW });
    expect(r.errors).toContainEqual(
      expect.objectContaining({ code: 'missing-booking-url', ref: 'rooms/pattee-w120' }),
    );
    expect(r.userFacing.roomIds).not.toContain('pattee-w120');
  });

  it('rejects rooms pointing at nonexistent buildings or floors', () => {
    const d = clone();
    d.rooms[0].buildingId = 'nowhere';
    d.rooms[1].floorId = 'ecore-f9';
    const codes = validateDataset(d, { now: NOW }).errors.map((e) => e.code);
    expect(codes).toContain('orphan-room');
    expect(codes).toContain('orphan-room-floor');
  });

  it('rejects coordinates outside University Park', () => {
    const d = clone();
    d.buildings[0].location.lat = 40.0;
    expect(validateDataset(d, { now: NOW }).errors.map((e) => e.code)).toContain(
      'coords-outside-campus',
    );
  });

  it('rejects unknown source references (provenance must resolve)', () => {
    const d = clone();
    d.rooms[0].verification.sourceIds = ['made-up'];
    expect(validateDataset(d, { now: NOW }).errors.map((e) => e.code)).toContain('unknown-source');
  });

  it('warns on stale records', () => {
    const later = Date.parse('2027-09-01T00:00:00Z');
    expect(validateDataset(rawDataset, { now: later }).warnings.map((w) => w.code)).toContain(
      'stale-record',
    );
  });

  it('reports schema errors instead of throwing', () => {
    const d = clone();
    d.rooms[0].bookingUrl = 'not a url';
    const r = validateDataset(d, { now: NOW });
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.code).toBe('schema');
  });

  it('rejects features outside the known vocabulary (no free-text claims)', () => {
    const d = clone();
    d.rooms[0].features = ['hot tub'];
    expect(validateDataset(d, { now: NOW }).errors[0]!.code).toBe('schema');
  });

  it('excludes candidate rooms from the user-facing inventory', () => {
    const d = clone();
    d.rooms[0].verification.status = 'candidate';
    expect(validateDataset(d, { now: NOW }).userFacing.roomIds).not.toContain(d.rooms[0].id);
  });
});

describe('buildHandoff', () => {
  const data = loadDataset();
  const building = data.buildings.find((b) => b.id === 'ecore')!;
  const room = data.rooms.find((r) => r.id === 'ecore-248')!;
  const outlook = data.providers.find((p) => p.id === 'coe-outlook')!;
  const libcal = data.providers.find((p) => p.id === 'psul-libcal')!;
  const selection = {
    start: localTime('2026-11-23', '14:00'),
    end: localTime('2026-11-23', '15:30'),
  };

  it('ECoRE hands off to Outlook with instructions and approval wording', () => {
    const h = buildHandoff({ room, building, provider: outlook, date: '2026-11-23', selection });
    expect(h.mode).toBe('portal-with-instructions');
    expect(h.url).toBe('https://outlook.office.com/calendar/');
    expect(h.confirmation).toBe('approval-email');
    expect(h.summary).toMatchObject({ time: '2:00 – 3:30 PM', duration: '1 hr 30 min', floor: 'Floor 2' });
    expect(h.copyText).toContain('Room 248');
    expect(h.url).not.toMatch(/date|time/);
  });

  it('uses the room link when the provider supports it and the room has one', () => {
    const r = { ...room, providerId: 'psul-libcal', bookingUrl: 'https://psu.libcal.com/space/1' };
    const h = buildHandoff({ room: r, building, provider: libcal, date: '2026-11-23', selection });
    // LibCal's room page reads ?date= into its calendar (verified 2026-11-23).
    expect(h.url).toBe('https://psu.libcal.com/space/1?date=2026-11-23');
    expect(h.datePreselected).toBe(true);
  });

  it('falls back to the portal when a room-link provider room has no verified link', () => {
    const h = buildHandoff({ room, building, provider: libcal, date: '2026-11-23', selection: null });
    expect(h.mode).toBe('portal-with-instructions');
    expect(h.url).toBe(libcal.portalUrl);
    expect(h.summary.time).toBeNull();
  });
});

describe('validateFootprints', () => {
  const ids = rawDataset.buildings.map((b) => b.id);
  it('passes on the committed footprints and covers every verified building', () => {
    expect(validateFootprints(rawFootprints, ids, ids)).toEqual([]);
  });
  it('flags orphans, open rings and off-campus points', () => {
    const fc = structuredClone(rawFootprints) as any;
    fc.features[0].properties.buildingId = 'nowhere';
    fc.features[1].geometry.coordinates[0].pop();
    fc.features[2].geometry.coordinates[0][1] = [-80, 41];
    const codes = validateFootprints(fc, ids, ids).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['footprint-orphan', 'footprint-open-ring', 'footprint-outside-campus']));
  });
});

describe('validateOpenSpaces', () => {
  const ctx = { buildingIds: rawDataset.buildings.map((b) => b.id), sourceIds: rawDataset.sources.map((s) => s.id), now: Date.parse('2026-11-24') };
  it('passes on the committed open spaces', () => expect(validateOpenSpaces(rawOpenSpaces, ctx)).toEqual([]));
  it('requires a building for LibCal-derived hours and flags stale entries', () => {
    const d = structuredClone(rawOpenSpaces) as any;
    d[0].buildingId = null;
    const codes = validateOpenSpaces(d, { ...ctx, now: Date.parse('2027-03-01') }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['libcal-needs-building', 'stale-open-space']));
  });
});
