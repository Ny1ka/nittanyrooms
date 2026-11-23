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

## Reasonable hypotheses (not verified)

- ECoRE room floors match their first digit (133 → floor 1, 248/249 → floor 2, 322/333 → floor 3). The design mockups make the same assumption. **The UI labels these floors as "inferred".**
- The Libraries' LibCal can deep-link to a specific space (`/space/<id>`), as other LibCal sites can. PSU room IDs haven't been observed, and date preselection is untested.
- ECoRE room availability may follow ECoRE building hours rather than Engineering Library hours.
- Deike, Stuckeman, and Davey house the EMS, Architecture, and PMS libraries.

## Unknowns and blockers

| # | Unknown | Why it matters | Who can answer |
|---|---|---|---|
| U1 | LibCal room names and IDs for each University Park location | Can't list library rooms or deep-link to them | Viewing psu.libcal.com in a browser, or PSU Libraries (Ul-study-rooms@lists.psu.edu) |
| U2 | Permission to read LibCal availability programmatically (vendor API credentials, or approval to read the public grid) | Without it, library availability stays "Check on PSU site" | PSU Libraries |
| U3 | Any public availability source for ECoRE rooms | Without it, ECoRE availability stays "Check on PSU site" permanently | College of Engineering facilities (coefacilities@engr.psu.edu) |
| U4 | ECoRE room capacity, features, accessibility | Shown as "Not verified yet" | College of Engineering facilities |
| U5 | ECoRE booking limits (duration, advance window) | Can't apply policy rules to ECoRE timelines | College of Engineering facilities |
| U6 | Floor plans for ECoRE and Pattee/Paterno, and permission to use them | Without them, the floor view stays a labeled schematic | PSU Office of Physical Plant / Libraries / CoE |
| U7 | Whether LibCal has a supported date/time deep-link format | Handoff can't preselect a time | PSU Libraries or testing in a browser |

## What the product does about it today

- **Availability:** No permitted live source exists yet, so every room shows **"Check on PSU site"** (the "unknown" state). The availability engine is built and tested, but it only marks time as free when a provider snapshot is flagged complete and fresh.
- **Floor plans:** ECoRE uses the **fallback schematic**: rooms in number order, explicitly labeled "not real positions".
- **Handoff:** ECoRE sends students to Outlook Calendar with step-by-step instructions, because no room-specific link exists. Library rooms will deep-link once room IDs are verified.
- **Demo mode:** Adding `?demo=1` to the URL shows clearly labeled **sample** schedules, so the timeline and gap filtering can be seen working. Sample data never appears without the banner.
