# Project plan

Product: **Nittany Rooms**, a student-made visual study-room finder for Penn State University Park. The working name and identity come from the design package (`nittany-rooms-design/`).

## Key finding that shapes the plan

The design package uses the **Engineering Library (ECoRE)** as its example building. Research shows its 5 group study rooms are booked through **Outlook Calendar** by the College of Engineering. That means no public availability and no room-specific booking link. The Libraries' **LibCal** rooms (Pattee/Paterno, EMS, Architecture, PMS) are a better long-term data target, but their room IDs aren't verified yet, and reading availability needs Libraries' permission. See [research/KNOWN_LIMITATIONS.md](research/KNOWN_LIMITATIONS.md).

**MVP building: ECoRE (Engineering Library).** Its rooms are fully verified from an official page, it matches the design package, and it exercises every honest fallback: unknown availability, no floor plan, and a non-deep-link handoff. **First live-availability target: a LibCal location**, once room IDs and permission are in hand.

## Milestones

| # | Milestone | Status |
|---|---|---|
| M0 | Repo setup: workspace, tooling, gitignore (prompt excluded) | ✅ |
| M1 | Phase One research docs: source inventory, limitations, booking flows, architecture | ✅ |
| M2 | `packages/core`: schemas, availability engine, data validator, unit tests | ✅ |
| M3 | Verified seed data: ECoRE + 5 rooms, LibCal buildings as "rooms not listed yet", with provenance | ✅ |
| M4 | Web app shell: design tokens, header, campus map (MapLibre/OSM), building list, building preview | ✅ |
| M5 | Building view: floor picker, fallback schematic, synced room list, room panel, timeline, handoff | ✅ |
| M6 | Playwright E2E (search → building → floor → room → handoff, keyboard, mobile viewport), CI workflow | ⏭ next |
| M7 | Ingest LibCal rooms into `data/` with provenance (`pnpm --filter @nittany-rooms/core ingest:libcal <snapshot>`) | ✅ 53 rooms (wellness room excluded) |
| M8 | LibCal grid adapter as a Vercel Function with CDN cache, honest User-Agent, and a kill switch | technically feasible; terms review pending (U2) |
| M9 | Floor plan sourcing for one building (needs U6), plus the SVG floor plan renderer | blocked on U6 |
| M10 | Coverage page, "report an error" link, privacy/disclaimer page, deploy | — |

## Prioritized checklist

- [x] Exclude master prompt from git
- [x] Source inventory with URLs, auth, robots, refresh notes
- [x] Known limitations: verified / hypotheses / unknowns
- [x] Availability engine with tests for the scenarios in the master prompt §12
- [x] Data validator (duplicate IDs, orphan rooms, missing booking URLs, invalid coords, stale records)
- [x] Map with real OSM coordinates and attribution
- [x] Fallback schematic floor view, explicitly labeled
- [x] Honest handoff for Outlook-booked rooms
- [ ] Playwright E2E + GitHub Actions CI
- [ ] Ask PSU Libraries for LibCal API access (draft email for the project owner)
- [ ] Ask CoE facilities for ECoRE room capacity, features, and policies
- [ ] Inventory LibCal rooms for Pattee/Paterno (Knowledge Commons W120–W128 first)
