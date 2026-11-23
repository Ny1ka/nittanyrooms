# Source inventory

Last researched: **2026-11-22**. Every fact below was read from the URL given on that date unless marked otherwise. Re-verify before relying on it. Pages change.

Legend for **Status**: ✅ verified from an official source · 🟡 partial / inferred · ❔ candidate, not verified · ⛔ not usable or excluded.

---

## 1. Penn State University Libraries: LibCal (Springshare)

| Field | Value |
|---|---|
| Owner | Penn State University Libraries |
| Official URL | https://psu.libcal.com/spaces?lid=428&gid=2159 (linked as "Reserve a Study Room" from https://libraries.psu.edu/services/rooms-spaces) |
| Status | ✅ provider verified · ✅ 54 University Park rooms and live grid confirmed 2026-11-22 ([LIBCAL_GRID_TEST.md](LIBCAL_GRID_TEST.md)) |
| Data available | Locations, room categories, capacity buckets (2–4, 5–8, 9–16), feature filters (Accessible Seat/Space, Desktop Mac, Desktop PC, Power Available, Screen Monitor, Solstice, Whiteboard), interactive availability grid |
| University Park locations listed | Pattee / Paterno Library · Architecture and Landscape Architecture Library · Earth and Mineral Sciences Library · Physical and Mathematical Sciences Library · "Wellness space" |
| Room IDs | **Obtained.** The static HTML of `/spaces?lid=428&gid=0` has `resources.push({eid,title,url,capacity,grouping,filterIds})` for each room (an earlier text-only fetch missed them). The sitemap lists only location pages (`/spaces?lid=` 428, 948, 949, 1572, 1646, 1734, 1747, 2543, 2609, 3443, 5147, 5986, 6023), which aren't all University Park. |
| Access method | Public web UI. The page's own JSON endpoint, `POST /spaces/availability/grid`, returns 15-minute slots with booked ones marked (`s-lc-eq-checkout`). It's the same approach as illiniSpots and works without credentials (tested 2026-11-22). LibCal has a vendor API (`/1.1/...`, OAuth client credentials), but `psu.libcal.com/admin/api` redirects to a LibApps login. Credentials would have to come from PSU Libraries. |
| Auth to view | The grid page loads without login. Whether slots render without login is unconfirmed (they're JS-rendered). |
| Auth to book | Yes. Policy requires "contact information (e.g., access ID)". An email confirmation is required. |
| robots.txt | `User-agent: *` → `Crawl-delay: 10`, `Disallow: /process_`. `GPTBot`, `crawler`, `crawl` → `Disallow: /`. |
| Terms | Springshare/LibCal terms not yet reviewed for automated availability reads. **Treat automated collection as not permitted until PSU Libraries approves it.** |
| Refresh frequency | Live (vendor-hosted) |
| Known gaps | No room list, no room IDs, deep-link date params untested |

**Policy (UL-ADG16, https://libraries.psu.edu/policies/ul-adg16, last reviewed Feb 2022):**
- "Penn State students have priority use of these rooms."
- "Group Study Rooms may be reserved for a maximum of three hours per day per group."
- "Rooms may only be reserved for two or more people based on the seating capacity."
- "Group Study Rooms will be held for 15 minutes past the beginning of the reserved time."
- "Group Study Rooms are available for drop-in use when they are not reserved."
- "Group Study Rooms may be scheduled up to two weeks in advance."
- The rooms page and LibCal say: "Rooms may be reserved for up to 3 hours within a given time frame." Support contact: Ul-study-rooms@lists.psu.edu.

**Specific rooms named on an official page:**
- Tombros McWhirter Knowledge Commons, West Pattee: "a suite of group study rooms in West Pattee Library (Rooms W120 – W128)". 🟡 The range is stated, but which numbers in it are actual rooms isn't.

---

## 2. College of Engineering: ECoRE group study rooms (Outlook / Microsoft 365)

| Field | Value |
|---|---|
| Owner | Penn State College of Engineering (facilities). **Not** the Libraries. |
| Official page | https://libraries.psu.edu/about/libraries/engineering-library/study-engineering-library |
| Status | ✅ rooms and booking process verified from the official page |
| Rooms | "There are 5 Group study rooms in ECoRE : 133, 248, 249, 322, 333." |
| Not reservable | "Quiet Study Room (204 ECORE)… cannot be reserved" |
| Eligibility | "can be reserved by any current Penn State undergraduate and graduate students, staff, and faculty" |
| Booking process | "Reservations need to be made in Outlook Calendar. Click on the day and search for the building and location. ECoRE Bldg brings up a list of available rooms. You will receive an email if your reservation is approved." |
| Approval | Request/approval. A booking is **not** confirmed until an approval email arrives. |
| Contact | coefacilities@engr.psu.edu |
| Library address | 203 ECoRE, 556 White Course Drive, University Park, PA 16802-1403 |
| Hours | https://libraries.psu.edu/monthly-hours/engineering (library hours, not yet confirmed to govern the rooms) |
| Capacity / features | Not published |
| Floors | 🟡 Inferred from room numbers (1xx → 1, 2xx → 2, 3xx → 3). Not confirmed. |
| Room IDs / deep links | None public. Outlook room mailbox addresses aren't published. There's no room-specific booking URL. |
| Availability | Visible only inside Outlook (Microsoft 365 free/busy) to signed-in PSU users. No public feed. |
| Access method | Manual verification only. Programmatic free/busy needs Microsoft Graph with PSU tenant consent. ⛔ Not available to us. |
| Duration / advance limits | Not stated |

---

## 3. 25Live / CollegeNET (Registrar)

| Field | Value |
|---|---|
| Owner | Office of the University Registrar |
| URL | https://www.registrar.psu.edu/collegenet/students/event-scheduling.cfm |
| Status | ⛔ out of MVP scope (events and meetings, not student study rooms) |
| Notes | Students can log in to request event or meeting rooms. A Dickinson Law guide says its University Park study rooms (Lewis Katz Building) are scheduled in 25Live, and that "reservations made in 25Live are publicly viewable" (https://psudickinsonlaw.libguides.com/student-services/study-rooms-up). Those rooms are likely restricted to law students, so they're excluded until eligibility is verified. |

## 4. HUB-Robeson Center (Student Affairs)

| Field | Value |
|---|---|
| URL | https://studentaffairs.psu.edu/facilities-spaces/hub-robeson-center/hub-meeting-event-spaces |
| Status | ⛔ excluded |
| Notes | Meeting and event spaces booked through 25Live, generally for recognized student organizations. No individual student study-room booking found. |

## 5. Other leads (not yet investigated)

| Lead | URL | Status |
|---|---|---|
| Penn State Learning, "Study Spaces for Groups" | https://pennstatelearning.psu.edu/about-us/facilities/study-spaces-groups | ❔ |
| Mechanical Engineering commons study rooms | https://www.me.psu.edu/commons/Study-Rooms.aspx | ❔ likely department-restricted |

---

## 6. Geospatial: OpenStreetMap

| Field | Value |
|---|---|
| Source | OpenStreetMap via Overpass API, queried 2026-11-22 |
| License | ODbL. Attribution "© OpenStreetMap contributors" is required. |
| Used for | Building centroid coordinates (see `data/buildings.json`, each with its OSM element ID) |

| Building | OSM element | Centroid |
|---|---|---|
| Engineering Collaborative Research and Education Building (ECoRE) | way 1204345414 | 40.7928783, -77.8707086 |
| Pattee Library | relation 359265 | 40.7977846, -77.8662328 |
| Paterno Library | way 431940744 | 40.7984784, -77.8653363 |
| Deike Building (EMS Library) | way 37861072 | 40.7942302, -77.8654394 |
| Stuckeman Family Building (Architecture Library) | way 431071070 | 40.8010877, -77.8667354 |
| Davey Laboratory (PMS Library) | way 431740622 | 40.7981700, -77.8628638 |

✅ The building that houses each branch library (Deike → EMS Library, Stuckeman → Architecture & Landscape Architecture Library, Davey → PMS Library) is confirmed by official LibCal room titles (e.g. "Deike 105A", "Stuckeman 117", "Davey 204").

## 7. Floor plans

| Building | Source found | Status |
|---|---|---|
| ECoRE | None public found yet | ⛔ Use the labeled fallback schematic (rooms in number order, no positions) |
| Pattee / Paterno | Not yet searched | ❔ |

## 8. Reference product: illiniSpots

| Field | Value |
|---|---|
| Repo | https://github.com/plon/illinispots |
| Seen | README only, via a mirror. Stack: Next.js, React, TypeScript, Tailwind, Supabase. Combines class schedules with university-booked events, refreshed periodically. |
| License | Not verified. **No code reused.** Concept-level inspiration only. |

---

## 9. Campus-wide "likely free" study spots (researched 2026-11-23)

Goal: cover all of University Park, like illiniSpots does for UIUC, not just reservable rooms. These rooms are **not reservable**. They'd be shown as "likely free to sit in", below reservable rooms, with a grey **Closed** state when the building is closed.

| Source | What it gives | Status / next step |
|---|---|---|
| **Penn State Map, "Classroom Availability" filter** (map.psu.edu) | Official: "open rooms, daily schedules and hours for all general-purpose classrooms at University Park" (per OPP news) | ❔ **Best candidate.** One official source that already combines classes, events and hours. Need to find its data endpoint and check terms and robots before using it. |
| LionPATH public class search (public.lionpath.psu.edu) | Day, time and room for every class section | ❔ Fallback for class schedules. Public, but heavy to collect per term; check terms. |
| 25Live (CollegeNET) | Room reservations and events | ⛔ Staff/faculty only. Only the public events calendar is exposed. |
| Building hours | No central public source found. Libraries: libraries.psu.edu/hours. 24/7 finals buildings announced by OPP (Boucke, Hammond, Osmond, Thomas, Willard; HUB-Robeson) | ❔ Use the Penn State Map hours if it has them. Otherwise curate per building, with dates. |

Sources: https://www.psu.edu/news/office-physical-plant/story/five-university-park-classroom-buildings-open-24-7-during-finals-week · https://www.psu.edu/news/students/story/lionpath-updates-class-search-feature-students · https://www.registrar.psu.edu/faculty-staff/scheduling/classroom-scheduling/
