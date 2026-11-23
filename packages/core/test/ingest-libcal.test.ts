import { describe, expect, it } from 'vitest';
import { inferFloor, parseTitle } from '../scripts/ingest-libcal.js';

describe('LibCal ingestion rules', () => {
  it('splits building, room number and area from official titles', () => {
    expect(parseTitle('Pattee W120 - Knowledge Commons')).toEqual({
      head: 'Pattee W120',
      buildingWord: 'Pattee',
      roomNo: 'W120',
      area: 'Knowledge Commons',
    });
    expect(parseTitle('Deike 113A - Study Cubicle - Earth and Mineral Sciences Library')?.area).toBe('Study Cubicle');
    expect(parseTitle('Paterno E128A')?.area).toBeNull();
    // Library-name suffixes (including the source's "Libary" typo) are not areas.
    expect(parseTitle('Davey Collaboration Space 1 - Physical and Mathematical Sciences Libary')?.area).toBeNull();
  });

  it('rejects titles that do not start with a known building', () => {
    expect(parseTitle('Mystery Room 12')).toBeNull();
  });

  it('infers floors from room numbers, ground for 0xx, null when no number', () => {
    expect(inferFloor('W120')).toEqual({ label: '1', level: 1 });
    expect(inferFloor('E304')).toEqual({ label: '3', level: 3 });
    expect(inferFloor('W024')).toEqual({ label: 'G', level: 0 });
    expect(inferFloor('113A')).toEqual({ label: '1', level: 1 });
    expect(inferFloor('Collaboration Space 1')).toBeNull();
  });
});
