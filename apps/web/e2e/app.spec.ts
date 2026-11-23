import AxeBuilder from '@axe-core/playwright';
import { NOW, TODAY, expect, payload, test } from './fixtures';

const roomRow = (name: string) => new RegExp(`^${name},`);

test.describe('campus discovery', () => {
  test('lists buildings with live counts and provenance; map failure leaves the list usable', async ({ page, api }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Pattee and Paterno Libraries/ })).toContainText('/36');
    await expect(page.getByRole('button', { name: /Engineering Library/ })).toContainText('Check site');
    await expect(page.getByRole('button', { name: /Physical and Mathematical Sciences/ })).toContainText('Closed');
    await expect(page.getByText(/Live from Penn State's LibCal · checked 12:59 PM/)).toBeVisible();
    await expect(page.getByText("The map couldn't load.")).toBeVisible();
    expect(api).toContain(TODAY);
  });

  test('search finds a room by number and opens it', async ({ page, api: _ }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Search buildings and rooms' }).fill('W120');
    await page.getByRole('option', { name: /Pattee W120/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pattee W120' })).toBeVisible();
    await expect(page.getByText('Open now until 5:00 PM')).toBeVisible();
    await expect(page).toHaveURL(/\/b\/pattee-paterno\?room=pattee-w120/);
  });

  test('"Open now" filter narrows buildings and can be cleared', async ({ page, api: _ }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Open now', exact: true }).click();
    await page.keyboard.press('Escape');
    // Pattee/Paterno and Deike have open rooms at 1 PM in the fixture; Stuckeman and Davey have no slots.
    await expect(page.getByText(/^2 of \d+ buildings match$/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Engineering Library/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.getByRole('button', { name: /Engineering Library/ })).toBeVisible();
  });
});

test.describe('building → floor → room → handoff', () => {
  test('select by list, read the timeline, pick a window, hand off to the exact LibCal room', async ({ page, api: _ }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Pattee and Paterno Libraries/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pattee and Paterno Libraries' })).toBeVisible();

    // Floor tabs filter the list.
    await page.getByRole('button', { name: 'Floor 1', exact: true }).click();
    await expect(page.getByRole('button', { name: roomRow('Pattee W024') })).toHaveCount(0);
    await expect(page.getByRole('button', { name: roomRow('Pattee W101B') })).toContainText('Occupied');
    await expect(page.getByRole('button', { name: roomRow('Pattee W101A') })).toContainText('Opens 1:30');

    await page.getByRole('button', { name: roomRow('Paterno E128A') }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Paterno E128A' })).toBeVisible();
    await expect(page.getByText('Open now until 2:00 PM')).toBeVisible();
    await expect(page.getByRole('img', { name: /Availability timeline for 2026-11-23: .*11:00 AM – 2:00 PM open/ })).toBeVisible();

    // The free interval is 11–2, but time before "now" (1 PM) isn't bookable.
    const window = page.getByRole('radio', { name: /1:00 – 2:00 PM/ });
    await expect(window).toBeChecked();
    await expect(page.getByText('Mon, Nov 23 · 1:00 – 2:00 PM · 1 hr')).toBeVisible();

    const cta = page.getByRole('link', { name: /Continue to Penn State reservation/ });
    await expect(cta).toHaveAttribute('href', 'https://psu.libcal.com/space/30978?date=2026-11-23');
    await expect(cta).toHaveAttribute('target', '_blank');
    await expect(page.getByText(/It isn’t reserved until Penn State emails your confirmation/)).toBeVisible();
    await expect(page.getByText('Booked', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Pattee and Paterno Libraries' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pattee and Paterno Libraries' })).toBeVisible();
  });

  test('changing the date refetches availability for that date', async ({ page, api }) => {
    await page.goto('/b/deike?room=deike-105a');
    await page.getByRole('button', { name: 'Next day' }).click();
    await expect(page.getByLabel('Availability').getByText('Tue, Nov 24')).toBeVisible();
    await expect.poll(() => api).toContain('2026-11-24');
    await expect(page.getByRole('radio', { name: /9:00 AM – 3:00 PM/ })).toBeVisible();
    // The official LibCal page opens on the newly selected day.
    await expect(page.getByRole('link', { name: /Continue to Penn State reservation/ })).toHaveAttribute('href', 'https://psu.libcal.com/space/8251?date=2026-11-24');
  });

  test('ECoRE (Outlook) never shows free time and explains the approval handoff', async ({ page, api: _ }) => {
    await page.goto('/b/ecore?room=ecore-248');
    await expect(page.getByText('Check PSU site').first()).toBeVisible();
    await expect(page.getByText(/doesn't publish these rooms' schedules publicly/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Open times you can book' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Continue to Penn State reservation/ })).toHaveAttribute('href', 'https://outlook.office.com/calendar/');
    await expect(page.getByText(/It isn’t reserved until you get the approval email/)).toBeVisible();
  });

  test('a room with no slots that day is shown as not bookable', async ({ page, api: _ }) => {
    await page.goto('/b/davey?room=davey-204');
    await expect(page.getByText('Not bookable on this day')).toBeVisible();
    await expect(page.getByText('Unavailable').first()).toBeVisible();
  });
});

test.describe('data trust states', () => {
  test.describe('provider error', () => {
    test.use({ apiMode: 'error' });
    test('falls back to "Check PSU site" with a retry', async ({ page, api: _ }) => {
      await page.goto('/b/pattee-paterno?room=pattee-w120');
      await expect(page.getByText(/Couldn't reach Penn State's LibCal/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
      await expect(page.getByText('We couldn’t refresh availability from Penn State just now.')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Open times you can book' })).toHaveCount(0);
    });
  });

  test.describe('stale data', () => {
    test.use({ apiMode: 'stale' });
    test('is withheld rather than shown as live', async ({ page, api: _ }) => {
      await page.goto('/b/pattee-paterno?room=pattee-w120');
      await expect(page.getByText(/too old to trust/)).toBeVisible();
      await expect(page.getByRole('group', { name: 'Open times you can book' })).toHaveCount(0);
    });
  });

  test.describe('kill switch', () => {
    test.use({ apiMode: 'disabled' });
    test('explains live availability is off', async ({ page, api: _ }) => {
      await page.goto('/');
      await expect(page.getByText(/Live availability is off right now/)).toBeVisible();
    });
  });

  test('demo mode is always bannered', async ({ page, api: _ }) => {
    await page.goto('/?demo=1');
    await expect(page.getByText(/Demo mode: sample data/)).toBeVisible();
  });
});

test.describe('accessibility', () => {
  test('keyboard only: search, open a room, reach the official handoff', async ({ page, api: _ }) => {
    await page.goto('/');
    await page.keyboard.press('Tab'); // skip link
    let found = false;
    for (let i = 0; i < 8 && !found; i++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'combobox');
    }
    expect(found).toBe(true);
    await page.keyboard.type('Deike 105A');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Deike 105A' })).toBeVisible();
    let onCta = false;
    for (let i = 0; i < 30 && !onCta; i++) {
      await page.keyboard.press('Tab');
      onCta = await page.evaluate(() => /Continue to Penn State reservation/.test(document.activeElement?.textContent ?? ''));
    }
    expect(onCta).toBe(true);
  });

  for (const [name, path, theme] of [
    ['campus', '/', 'dark'],
    ['building', '/b/pattee-paterno', 'dark'],
    ['room', '/b/pattee-paterno?room=paterno-e128a', 'dark'],
    ['room (light)', '/b/pattee-paterno?room=paterno-e128a', 'light'],
    ['ECoRE room (light)', '/b/ecore?room=ecore-248', 'light'],
  ] as const) {
    test(`no WCAG A/AA violations: ${name}`, async ({ page, api: _ }) => {
      await page.addInitScript((t) => localStorage.setItem('nr-theme', t), theme);
      await page.goto(path);
      await page.locator('h1, [aria-label="Buildings"]').first().waitFor();
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('.maplibregl-map').analyze();
      const detail = results.violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id} ${n.target.join(' ')} :: ${n.failureSummary?.split('\n').slice(1).join(' ')}`),
      );
      expect(detail).toEqual([]);
    });
  }
});

test.describe('mobile', () => {
  test('@mobile bottom sheet: pick a building, open a room, reach the handoff', async ({ page, api: _ }) => {
    await page.goto('/');
    const handle = page.getByRole('button', { name: /Expand panel|Collapse panel/ });
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    await handle.click();
    await page.getByRole('button', { name: /Earth and Mineral Sciences Library/ }).click();
    await expect(page.getByRole('button', { name: 'Collapse panel' })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: roomRow('Deike 105A') }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Deike 105A' })).toBeVisible();
    const cta = page.getByRole('link', { name: /Continue to Penn State reservation/ });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', 'https://psu.libcal.com/space/8251?date=2026-11-23');
    const box = await cta.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('open study spaces and closed state', () => {
  test('walk-in spaces show live library hours, grey Closed, and Check hours', async ({ page, api: _ }) => {
    await page.goto('/');
    const section = page.getByRole('region', { name: 'Open study spaces' });
    await expect(section.getByRole('link', { name: /Pattee and Paterno study areas/ })).toContainText('Open · until 5:00 PM');
    await expect(section.getByRole('link', { name: /Earth and Mineral Sciences Library study areas/ })).toContainText('Open · until 3:00 PM');
    await expect(section.getByRole('link', { name: /Physical and Mathematical Sciences Library study areas/ })).toContainText('Closed');
    await expect(section.getByRole('link', { name: /HUB-Robeson Center lounges/ })).toContainText('Check hours');
    // A reservable building with no bookable slots shows grey Closed, not red 0/n.
    await expect(page.getByRole('button', { name: /Physical and Mathematical Sciences Library/ })).toContainText('Closed');
  });
});

test.describe('walking route to the closest building', () => {
  test.use({ geolocation: { latitude: 40.7963, longitude: -77.8627 }, permissions: ['geolocation'] });
  test('asks before routing, then draws the route with attribution', async ({ page, api: _ }) => {
    let routed = 0;
    await page.route('https://routing.openstreetmap.de/**', (r) => {
      routed++;
      return r.fulfill({
        json: { code: 'Ok', routes: [{ distance: 350, duration: 280, geometry: { coordinates: [[-77.8627, 40.7963], [-77.8628, 40.797], [-77.8629, 40.7982]] } }] },
        headers: { 'access-control-allow-origin': '*' },
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: /Sort by distance/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Closest to you')).toBeVisible();
    expect(routed).toBe(0); // nothing sent until the user asks
    await page.getByRole('button', { name: /Show walking route to/ }).click();
    await expect(page.getByText(/5 min walk · 0\.2 mi to/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Fix the map' })).toBeVisible();
    expect(routed).toBe(1);
  });
});

test.describe('favorites', () => {
  test('save a room, see it pinned at the top with live status after reload', async ({ page, api: _ }) => {
    await page.goto('/b/pattee-paterno?room=pattee-w120');
    await page.getByRole('button', { name: 'Save Pattee W120 to favorites' }).click();
    await expect(page.getByRole('button', { name: 'Remove Pattee W120 from favorites' })).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/');
    const favs = page.getByRole('region', { name: 'Favorites' });
    await expect(favs.getByRole('button', { name: /Pattee W120/ })).toContainText('Open');
    await favs.getByRole('button', { name: /Pattee W120/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pattee W120' })).toBeVisible();
  });
});

test.describe('room actions', () => {
  test('add to calendar offers .ics and Google for the selected window', async ({ page, api: _ }) => {
    await page.goto('/b/pattee-paterno?room=paterno-e128a');
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    const ics = page.getByRole('link', { name: 'Apple / Outlook (.ics)' });
    await expect(ics).toHaveAttribute('download', 'nittany-rooms-paterno-e128a.ics');
    const href = decodeURIComponent((await ics.getAttribute('href'))!);
    expect(href).toContain('DTSTART:20261123T180000Z');
    expect(href).toContain('DTEND:20261123T190000Z');
    await expect(page.getByRole('link', { name: 'Google Calendar' })).toHaveAttribute('href', /calendar\.google\.com.*20261123T180000Z/);
  });
});

test.describe('share a room', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
  test('copies a link that reopens the same room, date and time', async ({ page, api: _ }) => {
    await page.goto('/b/pattee-paterno?room=paterno-e128a');
    await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
    await page.getByRole('button', { name: 'Share room' }).click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toMatch(/\/b\/pattee-paterno\?room=paterno-e128a&d=2026-11-23&t=13%3A00$/);
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1, name: 'Paterno E128A' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Date and time/ })).toContainText('1:00 PM');
  });
});

test.describe('report wrong info', () => {
  test('opens a GitHub issue pre-filled with the room identifiers', async ({ page, api: _ }) => {
    await page.goto('/b/leonhard?room=leonhard-105a');
    const link = page.getByRole('link', { name: /Report wrong info/ });
    await expect(link).toHaveAttribute('target', '_blank');
    const u = new URL((await link.getAttribute('href'))!);
    expect(u.origin + u.pathname).toBe('https://github.com/Ny1ka/nittanyrooms/issues/new');
    expect(u.searchParams.get('title')).toBe('Wrong info: Leonhard 105A');
    expect(u.searchParams.get('body')).toContain('`leonhard-105a`');
    expect(u.searchParams.get('body')).toContain('Open/booked times');
  });
});

test.describe('favorite buildings', () => {
  test('save a building and see it in Favorites with its live count', async ({ page, api: _ }) => {
    await page.goto('/b/deike');
    await page.getByRole('button', { name: 'Save Earth and Mineral Sciences Library to favorites' }).click();
    await page.goto('/');
    const favs = page.getByRole('region', { name: 'Favorites' });
    await expect(favs.getByRole('button', { name: /Earth and Mineral Sciences Library/ })).toContainText('/8');
    await favs.getByRole('button', { name: /Earth and Mineral Sciences Library/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Earth and Mineral Sciences Library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Earth and Mineral Sciences Library from favorites' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('adjustable booking range', () => {
  test('slide and resize the booking; summary and calendar follow (15 min – 3 hr)', async ({ page, api: _ }) => {
    await page.goto('/b/pattee-paterno?room=pattee-w120');
    // Window 1:00–5:00 PM; default fills up to the 3-hour maximum.
    await expect(page.getByText('Mon, Nov 23 · 1:00 – 4:00 PM · 3 hr')).toBeVisible();
    const length = page.getByRole('slider', { name: 'Booking length' });
    await expect(length).toHaveAttribute('max', '180');
    await length.focus();
    await page.keyboard.press('Home');
    await expect(page.getByText('Mon, Nov 23 · 1:00 – 1:15 PM · 15 min')).toBeVisible();
    const start = page.getByRole('slider', { name: 'Start time' });
    await start.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Mon, Nov 23 · 1:30 – 1:45 PM · 15 min')).toBeVisible();
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    const href = decodeURIComponent((await page.getByRole('link', { name: 'Apple / Outlook (.ics)' }).getAttribute('href'))!);
    expect(href).toContain('DTSTART:20261123T183000Z');
    expect(href).toContain('DTEND:20261123T184500Z');
  });
});

test.describe('notify me when it opens', () => {
  test('watch an occupied room; when it frees up, a notification and in-app alert fire once', async ({ page, api: _ }) => {
    await page.addInitScript(() => {
      (window as any).__notes = [];
      class FakeNotification {
        static permission = 'granted';
        static requestPermission = async () => 'granted';
        onclick: (() => void) | null = null;
        constructor(title: string, opts: { body?: string }) {
          (window as any).__notes.push({ title, body: opts?.body });
        }
      }
      (window as any).Notification = FakeNotification;
    });
    // W101B is occupied 12:00–4:00 PM in the default fixture.
    await page.goto('/b/pattee-paterno?room=pattee-w101b');
    await page.getByRole('button', { name: /Notify me/ }).click();
    await expect(page.getByText(/You'll be notified if a 30 min\+ slot opens by 1:30 PM/)).toBeVisible();

    // It frees up at 1:15 PM; the next check (here, a reload) fires the alert.
    await page.unroute('**/api/availability?*');
    await page.route('**/api/availability?*', async (route) => {
      const date = new URL(route.request().url()).searchParams.get('date')!;
      const body = payload(date);
      body.items['8573'] = { open: body.items['8573']!.open, busy: [[NOW.set({ hour: 12 }).toMillis(), NOW.set({ hour: 13, minute: 15 }).toMillis()]] };
      await route.fulfill({ json: body });
    });
    await page.goto('/');
    await expect(page.getByRole('alert').filter({ hasText: 'Pattee W101B just opened up' })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__notes.length)).toBe(1);
    await expect(page.getByRole('region', { name: 'Alerts' })).toHaveCount(0); // watch removed after firing
  });
});
