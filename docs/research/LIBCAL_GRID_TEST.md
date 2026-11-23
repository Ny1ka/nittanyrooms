# LibCal availability grid: feasibility test

**Date:** 2026-11-22, ~8:10 PM ET · **Result: ✅ works**

## Question

Can Nittany Rooms get live library room availability from Penn State's LibCal **without** vendor API credentials, the same way illiniSpots does for UIUC?

## How illiniSpots does it (for reference)

illiniSpots (MIT) sends a `POST` to `libcal.library.illinois.edu/spaces/availability/grid` from its server on each request ([facilities.ts](https://github.com/plon/illinispots/blob/main/src/server/services/facilities.ts)). That's the endpoint LibCal's own public booking page calls from the browser. Room IDs and names are hard-coded in a catalog file. No API key is used.

## What we sent

Two requests total, 43 s apart, well over the `Crawl-delay: 10` in `robots.txt`. Neither path is disallowed by `robots.txt`.

1. `GET https://psu.libcal.com/spaces?lid=428&gid=0`: the public "Reserve a Study Room" page.
2. `POST https://psu.libcal.com/spaces/availability/grid` with the same form body the page sends:
   `lid=428&gid=0&eid=-1&seat=false&seatId=0&zone=0&start=2026-11-22&end=2026-11-24&pageIndex=0&pageSize=10000`

> **Temporary:** at the project owner's request, the test used a browser User-Agent string to rule out User-Agent filtering. Before any adapter ships, this must change to an honest identifier (e.g. `NittanyRooms/<version> (+contact URL)`) and the adapter must be re-verified with it.

## Findings

### 1. Room inventory comes from the public page (fixes unknown U1)

The page's static HTML has a `resources.push({...})` block for every room. Each block gives:

| Field | Example |
|---|---|
| `eid` (stable LibCal room ID) | `8577` |
| `title` (official label) | `Pattee W120 - Knowledge Commons` |
| `url` (room booking page) | `/space/8577` → `https://psu.libcal.com/space/8577` |
| `grouping` (library) | `Pattee / Paterno Library` |
| `gid` (category) | `2159` |
| `capacity` | `12` |
| `filterIds` → feature names | Accessible Seat/Space, Desktop PC, Power Available, Screen Monitor, Solstice, Whiteboard |

**54 rooms** at University Park (parsed list: [libcal-rooms-2026-11-22.json](libcal-rooms-2026-11-22.json)):

| Library (LibCal grouping) | Building (from room titles) | Rooms |
|---|---|---|
| Pattee / Paterno Library | Pattee, Paterno | 36 (Paterno E128A–G, E304, E307; Pattee W024–W039 Collaboration Commons, W101A/B, W120–W129 Knowledge Commons) |
| Earth and Mineral Sciences Library | **Deike** | 8 |
| Physical and Mathematical Sciences Library | **Davey** | 8 |
| Architecture and Landscape Architecture Library | **Stuckeman** | 1 (Stuckeman 117) |
| Wellness space | Davey | 1 (capacity 1, so not a group room) |

The room titles name the buildings ("Deike 105A", "Davey 204", "Stuckeman 117"), so the **library-to-building mapping is now verified** from an official source.

### 2. The grid returns complete, slot-level availability

Response: `200 application/json`, ~199 KB, top-level keys `slots`, `bookings`, `isPreCreatedBooking`, `windowEnd`.

```json
{"start":"2026-11-23 12:00:00","end":"2026-11-23 12:15:00","itemId":8246,"checksum":"…"}
{"start":"…","end":"…","itemId":30978,"checksum":"…","className":"s-lc-eq-checkout"}
```

- **Slots are 15 minutes** (all 1,620).
- **Booked slots are included** and marked `className: "s-lc-eq-checkout"` (98 of 1,620). Open slots have no `className`.
- **No gaps** inside any room's slot range. The first and last slot match that room's bookable hours for the day (Pattee/Paterno 9:00–17:00, Deike 9:00–15:00, Stuckeman 12:00–17:00).
- A room with **no slots** isn't bookable that day. All 9 Davey rooms had none on Mon 11/23, which is likely Thanksgiving break hours (not verified).
- Only 11/23 came back. 11/22 was over (8 PM Sunday), and `end` looks exclusive.
- No names, emails, or booking details are returned. It's just open or booked per slot.
- 8 `itemId`s in the grid (8575, 186792, 159700, 36957, 6301, 41117, 36958, 8255) have no matching `resources.push` entry on this page. **Exclude them** until they're identified.

### 3. How it maps onto the availability engine

| LibCal | Engine |
|---|---|
| Union of all slots for a room/date | `openHours` (bookable hours) |
| Slots with `className` `s-lc-eq-checkout` | `snapshot.busy` → `occupied` |
| Slots without `className` | free → bookable windows |
| No slots for a room/date | closed / not bookable |
| Response received OK | `snapshot.complete = true`, `coverage` = the requested day |
| Slot length | `startIncrementMinutes = 15` (supersedes the 30-minute assumption) |

This satisfies the engine's rule that time is only "free" when the data is complete, because LibCal returns booked slots as well as open ones.

## Open questions before shipping an adapter

1. **Terms:** review Springshare's and Penn State Libraries' terms of use for automated reads. Send the Libraries a short heads-up (Ul-study-rooms@lists.psu.edu).
2. **Honest User-Agent:** re-test with a truthful identifier (see note above).
3. **`s-lc-eq-checkout` meaning:** confirm it means "reserved" in every case, not also "blocked by staff". Either way the time isn't bookable, but the label shown to students differs.
4. **Today's past slots:** check whether earlier slots for the current day are omitted, or shown as booked.
5. **Minimum booking length:** check on a room page whether one 15-minute slot is bookable, or whether a minimum applies.
6. **Load plan:** one grid call returns every University Park room for a date range, so the adapter needs about **one request per date** behind a Vercel CDN cache (`s-maxage` around 120–300 s). That's far below `robots.txt`'s 10-second crawl delay.
