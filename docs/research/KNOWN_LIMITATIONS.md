# Known limitations

Last updated: **2026-11-22**. This file separates what we know from what we're guessing. Update it whenever a fact is verified or disproved.

## Verified facts

1. **There are at least two separate student room-booking systems at University Park.**
   - Penn State University Libraries uses **LibCal** (`psu.libcal.com`) for group study rooms in Pattee/Paterno, Architecture & Landscape Architecture, Earth & Mineral Sciences, and Physical & Mathematical Sciences libraries.
   - **ECoRE group study rooms (133, 248, 249, 322, 333)** are run by the **College of Engineering** and booked through **Outlook Calendar**, not LibCal, even though the Engineering Library is in ECoRE.
2. Library group study rooms: max **3 hours per day per group**, **2+ people**, bookable **up to two weeks ahead**, held **15 minutes** past the start time, open for drop-in use when unreserved (policy UL-ADG16).
3. ECoRE rooms: any current PSU undergrad, grad student, staff, or faculty member can book. A request is only confirmed by an approval email.
4. ECoRE room 204 (Quiet Study Room) is **not reservable**.
5. HUB-Robeson meeting spaces are for events and student organizations, booked through 25Live. They aren't individual study rooms.
6. **LibCal's public availability grid works without credentials** (tested 2026-11-22). It returns 15-minute slots for every University Park library room, with booked slots marked, so the data is complete. The test used a browser User-Agent temporarily; production must identify honestly.
7. **54 LibCal rooms** with official labels, IDs, capacities, and features. The branch-library buildings (Deike, Davey, Stuckeman) are confirmed by room titles.

## Reasonable hypotheses (not verified)

- ECoRE room floors match their first digit (133 → floor 1, 248/249 → floor 2, 322/333 → floor 3). The design mockups make the same assumption. **The UI labels these floors as "inferred".**
- Each LibCal room's `/space/<id>` page (IDs now observed) is its booking page. Date preselection via URL is untested.
- ECoRE room availability may follow ECoRE building hours rather than Engineering Library hours.

## Unknowns and blockers

| # | Unknown | Why it matters | Who can answer |
|---|---|---|---|
| ~~U1~~ | ~~LibCal room names and IDs~~ | **Resolved 2026-11-22.** 54 rooms parsed from the public page ([LIBCAL_GRID_TEST.md](LIBCAL_GRID_TEST.md)) | — |
| U2 | Terms review for reading the public LibCal grid. **Technically confirmed working without credentials** (2026-11-22) | Decides whether the live adapter ships | Springshare/PSU Libraries terms, plus a courtesy note to PSU Libraries |
| U3 | Any public availability source for ECoRE rooms | Without it, ECoRE availability stays "Check on PSU site" permanently | College of Engineering facilities (coefacilities@engr.psu.edu) |
| U4 | ECoRE room capacity, features, accessibility | Shown as "Not verified yet" | College of Engineering facilities |
| U5 | ECoRE booking limits (duration, advance window) | Can't apply policy rules to ECoRE timelines | College of Engineering facilities |
| U6 | Floor plans for ECoRE and Pattee/Paterno, and permission to use them | Without them, the floor view stays a labeled schematic | PSU Office of Physical Plant / Libraries / CoE |
| ~~U7~~ | ~~LibCal date/time deep link~~ | **Partly resolved 2026-11-23:** `psu.libcal.com/space/<id>?date=YYYY-MM-DD` opens the room calendar on that date (server sets `initialDate`). No time parameter exists, so students tap the start time; the handoff tells them which. | — |

## What the product does about it today

- **Availability:** **Library rooms are live**. `/api/availability` reads LibCal's public grid, the CDN caches it for 3 minutes, and the browser refreshes every 3 minutes. If data is missing, failed, or older than 15 minutes, rooms fall back to **"Check on PSU site"**. ECoRE rooms always show "Check on PSU site" (Outlook schedules aren't public).
- **Temporary:** the function sends a browser User-Agent string until the route is proven in production. Set `LIBCAL_USER_AGENT` to an honest identifier before public launch.
- **Rooms:** 58 verified rooms: 5 in ECoRE, plus 53 library rooms from LibCal with official titles, capacities, features, and direct booking links. Floors are inferred from room numbers. Davey's five collaboration spaces have no floor in LibCal, so they're grouped as "Floor not listed".
- **Floor plans:** every building uses the **fallback schematic**: rooms in number order, explicitly labeled "not real positions".
- **Handoff:** ECoRE sends students to Outlook Calendar with step-by-step instructions, because no room-specific link exists. Library rooms link straight to each room's LibCal page.
- **Demo mode:** Adding `?demo=1` to the URL shows clearly labeled **sample** schedules, so the timeline and gap filtering can be seen working. Sample data never appears without the banner.

## Added 2026-11-23

- **Open study spaces:** library study areas show live open/closed status inferred from LibCal bookable hours. That matched the Libraries' banner on 2026-11-23 ("Pattee and Paterno: 9:00am - 5:00pm"), but it's an inference, so each row links to the official hours page. Penn State Learning (220 Boucke) and the HUB lounges don't publish weekly hours, so they show **Check hours**. Entries are flagged after 60 days for re-checking.
- **Closed state:** a reservable building where no room has bookable time at the selected moment shows grey **Closed** (list, map pin, 3D building) instead of red "0/n".
- **Walking route:** only drawn after the user taps "Show walking route". The user's location is then sent to the FOSSGIS OSRM server (routing.openstreetmap.de), which logs requests. Its policy: non-commercial use, at most 1 request per second, attribution and a "fix the map" link (all shown). If routing fails, the map shows a dashed straight line instead.
