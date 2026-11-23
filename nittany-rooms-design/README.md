# Nittany Rooms: design package (v2)

The design language for Nittany Rooms, a student-made web app for finding and reserving study rooms at Penn State University Park. It is not an official Penn State service.

**v2.1 is minimal and neutral.** Dark and light gray surfaces, **green = open/available, red = occupied/not available, grey = closed/unknown, purple = walk-in study space**, and blue (actions, selection) and yellow (brand, “opens soon”) as accents only. Appearance can be Light, Dark (default) or Auto. The 3D campus map is the canvas, and a quiet sidebar or bottom sheet holds the content. The palette is navy surfaces with a single yellow accent. v1, the original mockups, is kept in [`v1/`](v1/) for reference.

## What's in here

| Path | Contents |
|---|---|
| `tokens/tokens.json` | **v2 tokens**: dark and light themes, room states, map palette and camera, type scale, spacing, radius, motion |
| `html/02-design-system.html` | Standalone v2 design-system sheet (open in a browser; fonts load from `fonts/`) |
| `png/` | v2 design sheet and screenshots of the **real app** at 2x (live Penn State data, Mon Nov 23 2026, 1 PM) |
| `logo/` | Logo mark and lockups (use `mark-on-navy.svg` on dark). Lockups set the wordmark in live Inter text; outline it before using it where Inter isn't installed |
| `fonts/` | **Inter** variable (`inter-latin-wght-normal.woff2`, weights 100–900, SIL OFL), the v2 typeface. Overpass files remain only for the archived v1 mockups |
| `v1/` | Original v1 mockups, tokens and canvas sources (superseded) |

Screens in `png/` (2x, real app, **sample availability** at Mon Nov 23, 1:00 PM so every state shows):

1. `02-design-system`: tokens, room states, timeline, header controls, building list, open study spaces, map pins and route, dark vs light
2. `03-desktop-campus-dark`: 3D campus, grouped building list, open study spaces
3. `04-desktop-building-dark`: rooms by floor with status chips and mini timelines
4. `05-desktop-room-dark`: room timeline, bookable windows, official handoff
5. `06-desktop-campus-light`: light theme
6. `07-mobile-campus-dark` / `08-mobile-room-dark`: phone bottom sheet
7. `09-desktop-filters`: filters popover (open now, accessible, free until, available for at least, size, distance)
8. `10-desktop-date-time`: custom date and time picker
9. `11-desktop-near-me-route`: closest building and animated walking route
10. `12-desktop-settings`: ⋯ menu with Appearance, Important notes, Data updates, GitHub
11. `13-desktop-open-study-spaces`: walk-in spaces with live library hours and purple "Check hours"

The code is the source of truth. Tokens are implemented in `apps/web/src/index.css` as `--nr-*` CSS variables, exposed to Tailwind as semantic colors (`bg`, `surface`, `fg`, `muted`, `accent`, …).

## v2 principles

- **Map first.** The 3D OpenFreeMap campus is always on screen. Choosing a building flies the camera in, which is the campus → building transition. Buildings with reservable rooms are extruded from their OpenStreetMap footprints in the accent color when rooms are open, and in muted blue otherwise.
- **State colors carry meaning.** Green marks open and available, red marks occupied and not available. Both appear as soft tinted chips with AA text. Blue `#2563EB` is for actions and selection (with white text). Yellow is reserved for the brand, “opens soon”, and the now marker.
- **Quiet surfaces.** Three neutral gray steps (`bg` → `surface` → `surface-2`), 1px `line` borders, and almost no shadows (only floating sheets and popovers have one). No gradients, glass, or oversized cards.
- **Small, steady type.** Inter (variable, features `cv11` and `ss03`) at 14px body, 18–20px headings, and 11px uppercase section labels. Times and counts use tabular figures.
- **One header row, everything else in popovers** (illiniSpots pattern): brand · search · Filters · date/time (“Now”) · ⋯ (Appearance, Important notes, Data updates, GitHub). Buildings are grouped (Libraries, Engineering, Not verified), each row with one count badge: green `34/36` = rooms open, red `0/8` = none open, gray “Check site” / “Not verified”, plus a chevron.
- **Lists over decoration.** Rooms are compact rows with a status chip and a thin day timeline. Until a real floor plan is sourced, the building view is a floor-grouped list. That's the documented fallback, not a drawn layout.
- **Dark by default**, with a light theme one tap away. Both themes share every component; only tokens change.

## Rules carried over from v1 (still binding)

- Room states never rely on color alone. Each has a fill or pattern, an icon and a word (`tokens.json` → `roomState`).
- Booking language stays honest: "Continue to Penn State reservation", never "Booked".
- Every screen shows where availability came from and how fresh it is, and carries the "Student-made, not an official Penn State service" line.
- No Nittany Lion or other Penn State marks in the branding.
- Touch targets are at least 44px on rows and primary actions. Pills and chips sit inside larger hit areas.
- Unknown or stale availability shows "Check PSU site" (dots), never "free".
- Reduced motion: the camera jumps instead of flying, and transitions are off.

## Map spec (summary)

| | Dark (default) | Light |
|---|---|---|
| Base style | OpenFreeMap `fiord`, recolored to navy | OpenFreeMap `liberty`, POI icons removed |
| Buildings | 3D extrusion `#1A2E52` | Liberty's 3D buildings |
| Reservable, rooms open | `#FFC845` extrusion | `#FFC845` |
| Reservable, none open or unknown | `#3B5A92` | `#8EA6CC` |
| Camera | Overview: pitch 52°, bearing −18°, zoom 15.35 (14.7 on phones). Building: pitch 60°, zoom 17.3 | same |

Map data © OpenStreetMap contributors (ODbL). Tiles from OpenFreeMap.

