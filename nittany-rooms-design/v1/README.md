# Nittany Rooms: design package

Logo, design system and mockups for Nittany Rooms, a student-made web app for finding and reserving study rooms at Penn State University Park. It is not an official Penn State service.

## What's in here

| Folder | Contents |
|---|---|
| `png/` | Each mockup rendered at 2x |
| `html/` | Standalone HTML for each mockup. Open in a browser; fonts load from `fonts/` |
| `logo/` | Logo mark (color, on navy, one-color black, 16 px favicon) and wordmark lockups |
| `tokens/tokens.json` | Colors, room-state styles, type scale, spacing, radius, motion |
| `fonts/` | Overpass 400/600/800 (SIL Open Font License) |
| `source-dc-html/` | Original canvas source files |

Screens, in flow order:

1. `01-logo`: logo sheet
2. `02-design-system`: tokens, room states, timeline, controls
3. `03-desktop-campus-map`: home screen, campus map with buildings that have reservable rooms
4. `04-desktop-floor-plan`: building view, floor plan with room details and booking handoff
5. `05-desktop-fallback-no-floor-plan`: building view when no floor plan has been sourced yet
6. `06-mobile-campus-map`: home screen on a phone, with a building preview sheet

## Copy the look, not the data

These mockups show layout, styling and interaction only. Don't reuse any place, position or number in them as real data. Every screen with drawn stand-in content has a `*` footnote saying so.

| Element | Status | What to build from instead |
|---|---|---|
| Campus map (03, 06): roads, building shapes, marker positions | Hand-drawn guesses, not to scale | Real OpenStreetMap tiles centered on University Park, plus official or properly licensed building coordinates |
| Road names on the desktop map | Real roads, drawn in made-up positions | OSM tiles show the real roads |
| Floor plan layout (04): walls, corridor, room sizes and positions, stairs, elevator, restrooms, entrance | Invented | ECoRE's sourced floor plan, with room polygons tied to official room IDs |
| Fallback tiles (05) | Rooms in number order on purpose, not positions | This is the intended fallback design |
| Room numbers 133, 248, 249, 322, 333 | Real, from the Penn State University Libraries Engineering Library page | Re-verify during data ingestion |
| Floor of each room | Read from the room number, not confirmed | Official room data |
| Pattee and Paterno, Earth and Mineral Sciences libraries | Candidates only, shown as "not verified" | Verify that they have reservable rooms before listing them |
| All statuses, times, timelines, open-room counts, the 15-minute gap | Sample data | Live, complete provider data; mark anything stale or incomplete as unknown |
| Capacity and features | Shown as "Not verified yet" | Show only verified values |
| Booking button destination | Placeholder link | The official room-specific Penn State reservation URL |

## Design rules worth keeping

- Room states never rely on color alone. Each one has a fill or pattern, an icon and a text label (see `tokens.json` → `roomState`).
- Glow yellow always carries navy text. On white backgrounds, use `amberText` for glow-family text.
- Booking language stays honest: "Continue to Penn State reservation", never "Booked".
- Every screen shows how fresh the data is and carries the "Student-made, not an official Penn State service" line.
- No Nittany Lion or other Penn State marks in the branding.
- Touch targets are at least 44 px. Times use tabular figures.
- The lockup SVGs use live `Overpass` text. Convert the text to outlines before using them where the font isn't installed.
