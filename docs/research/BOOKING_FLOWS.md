# Official booking flows (as a student sees them)

Researched 2026-11-22. See [SOURCE_INVENTORY.md](SOURCE_INVENTORY.md) for sources.

## A. Library group study room (LibCal)

```mermaid
flowchart TD
  A[libraries.psu.edu → Rooms & Spaces] --> B["Reserve a Study Room<br/>psu.libcal.com/spaces?lid=428&gid=2159"]
  B --> C[Pick location: Pattee/Paterno, Arch, EMS, PMS, Wellness]
  C --> D[Filter by capacity / features]
  D --> E[Pick a time slot on the availability grid]
  E --> F[Submit times]
  F --> G[Enter details incl. access ID]
  G --> H[Email confirmation]
```

**How Nittany Rooms hands off:** once room IDs are verified, link to that room's LibCal page. Until then, link to the University Park study-space page and show the room name and time so the student can find it there.

## B. ECoRE group study room (College of Engineering, Outlook)

```mermaid
flowchart TD
  A[Open Outlook Calendar<br/>signed in with PSU account] --> B[Click the day / new event]
  B --> C[Search building & location: 'ECoRE Bldg']
  C --> D[List of available rooms]
  D --> E[Add room to event, send request]
  E --> F{Approval email?}
  F -- yes --> G[Reservation confirmed]
  F -- no --> H[Not reserved, contact coefacilities@engr.psu.edu]
```

**How Nittany Rooms hands off:** open Outlook on the web, then show the room number, date, and time along with these exact steps. Copy-to-clipboard for room and time. Never imply the booking is confirmed. Approval happens by email from Penn State.

## C. Nittany Rooms discovery flow

```mermaid
flowchart LR
  M[Campus map] --> P[Building preview]
  P --> F[Floor view / fallback schematic]
  F --> R[Room detail + timeline]
  R --> H[Handoff summary]
  H --> O[(Official PSU system)]
```
