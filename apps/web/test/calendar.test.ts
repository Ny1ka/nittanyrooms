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

import { matchingWindow } from '../src/lib/watcher';
describe('notify-me matching', () => {
  const t = (h: number, m = 0) => Date.parse(`2026-11-23T${String(h + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const win = (a: number, b: number) => ({ start: a, end: b, raw: { start: a, end: b }, durationMinutes: (b - a) / 60000, maxBookingMinutes: 180, startTimes: [] });
  it('matches a slot that frees up within 30 min of the requested time and is long enough', () => {
    expect(matchingWindow([win(t(13, 15), t(17))], { after: t(13), minMinutes: 30 })).toBeTruthy();
  });
  it('ignores later slots, short slots, and slots that ended', () => {
    expect(matchingWindow([win(t(16), t(17))], { after: t(13), minMinutes: 30 })).toBeUndefined();
    expect(matchingWindow([win(t(13), t(13, 20))], { after: t(13), minMinutes: 30 })).toBeUndefined();
    expect(matchingWindow([win(t(11), t(12))], { after: t(13), minMinutes: 15 })).toBeUndefined();
  });
});
