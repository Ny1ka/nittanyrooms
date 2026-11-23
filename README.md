# Nittany Rooms

A visual study-room finder for **Penn State University Park**. You go from the campus map to a building, then a floor, a room, an open time window, and finally the **official Penn State reservation page**.

> **Student-made. Not an official Penn State service.** Nittany Rooms does not make reservations. Penn State's own systems decide who can book and confirm every booking.

## Status

Early development. See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for milestones and
[docs/research/KNOWN_LIMITATIONS.md](docs/research/KNOWN_LIMITATIONS.md) for what is and is not verified.

## Repository layout

| Path | Purpose |
|---|---|
| `apps/web/` | React + TypeScript + Vite front end: campus map, building/floor view, room timeline, booking handoff |
| `apps/web/api/` | Vercel Functions: `GET /api/availability?date=` (live LibCal availability) |
| `packages/core/` | Shared types, data schemas, the availability engine (pure functions), and data-quality checks |
| `data/` | Building, room, provider and source records, each with provenance and verification status |
| `docs/` | Plan, architecture, research, source inventory, known limitations |
| `nittany-rooms-design/` | Design package: logo, tokens, mockups, Overpass fonts. Source of truth for the UI. |

## Getting started

Requires Node 22+ and pnpm 10.

```sh
pnpm install
pnpm validate:data   # run data-quality checks on data/
pnpm test            # unit tests (availability engine, data validation)
pnpm dev             # start the web app (also serves /api locally)
```

Server env vars (Vercel project settings; see `apps/web/.env.example`): `LIBCAL_LIVE=off` disables live library availability, and `LIBCAL_USER_AGENT` sets the identifier sent to LibCal.

## Deploying to Vercel

Import the repo, set **Root Directory** to `apps/web`, and keep the detected Vite settings (`vercel.json` supplies the build command, rewrites, and headers).

## Data rules

- Never invent buildings, rooms, coordinates, floor layouts, booking URLs, hours, or availability.
- Every record carries its source, its verification date, and a confidence status.
- If availability can't be verified, it's shown as **"Check on PSU site"**, never as "free".
- Library availability is read live from Penn State's public LibCal pages and cached briefly. Penn State's booking page is always the final word.

## Map data

Building coordinates come from © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL).

## License

MIT. See [LICENSE](LICENSE).
