import { describe, expect, it } from 'vitest';
import { buildIcs, googleCalendarUrl } from '../src/lib/calendar';

const ev = {
  uid: 'pattee-w120-1',
  title: 'Study: Pattee W120',
  start: Date.parse('2026-11-23T18:00:00Z'),
  end: Date.parse('2026-11-23T19:30:00Z'),
  location: 'Pattee W120, Pattee Library and Paterno Library, University Park, PA',
  description: 'Line one; with, commas\nline two',
  url: 'https://psu.libcal.com/space/8577',
};

describe('calendar export', () => {
  it('builds a valid single-event iCalendar file in UTC with escaped text', () => {
    const ics = buildIcs(ev, Date.parse('2026-11-23T12:00:00Z'));
    expect(ics).toContain('DTSTART:20261123T180000Z');
    expect(ics).toContain('DTEND:20261123T193000Z');
    expect(ics).toContain('LOCATION:Pattee W120\\, Pattee Library and Paterno Library\\, University Park\\, PA');
    expect(ics).toContain('DESCRIPTION:Line one\; with\\, commas\\nline two');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
  it('builds a Google Calendar template link', () => {
    const u = new URL(googleCalendarUrl(ev));
    expect(u.searchParams.get('dates')).toBe('20261123T180000Z/20261123T193000Z');
    expect(u.searchParams.get('text')).toBe('Study: Pattee W120');
  });
});
