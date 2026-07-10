# Session progress — 2026-07-09

<!-- Living task tracker for this session's work, distinct from docs/worklog.md
     (append-only narrative journal) and docs/decisions.md (why, not what).
     Update statuses in place as work lands; this file reflects current state,
     it doesn't accumulate history — the worklog does that. -->

Single continuous session, 2026-07-09. Started from a working Track/Trainer
workspace prototype (Churchill Downs-centric, fictional "Snellgrove Racing"
trainer) and ended with a multi-meet, multi-track app fronted by a real
trainer and real tracks. All commits below are on `main`.

## Done — committed

| # | Task | Commit | Notes |
|---|---|---|---|
| 1 | Meets list + parameterized meet dashboard | `af74099` | Replaced the single hardcoded "Meet" page with a `Meets` list; meet dashboard now takes a `meetId` param |
| 2 | Stalls & ship-ins overview + interactive stall builder | `af74099` | Barn capacity, assign/waitlist workflow; Trainer's dead "Condition parser" nav link removed |
| 3 | Build-a-meet flow | `f479d69` | Create a meet → add race days → add races, reusing the existing Race Builder for race specs |
| 4 | Delete meet / delete race day | `f808842` | Soft-delete overlay (works on seeded *and* created entities); cascades meet→race days; "Add race" also added directly on the race day page |
| 5 | Race Builder bug fixes | `cd2cbaf` | Recompute button was discarding un-blurred field edits; condition text was permanently read-only and unwired |
| 6 | Real trainer + real tracks pivot | `f7739b3` | See below — the big one |

### #6 in detail (`f7739b3`)
- Demo trainer persona: fictional "Snellgrove Racing" → real **Kinnon LaRose**
  (Tom Amoss's former head assistant, took over the stable April 2026).
  Seeded with his real, cited, currently-active horses: Midnight Still,
  Hormesis, Gewurztraminer (Saratoga, entered Sat July 11), Modo (Lone Star
  Park, won the Bluebonnet Stakes), Molly McIver (Ellis Park). Sourcing in
  `docs/research-delta-downs-larose-2026-07-09.md`.
- Track workspace identity: Churchill Downs → **Delta Downs**, showing its
  real, currently-live Quarter Horse meet with real trainers (Josue Ponce,
  Jose A. Garcia, Victor Oviedo, Santiago Villaseca, Jose U. Lopez) and their
  real horses. Required new engine/display support for a second racing
  discipline — yards-based distance display and a Quarter Horse class
  vocabulary — additive alongside the existing Thoroughbred one.
- Saratoga and Lone Star Park added as new tracks/meets; Ellis Park's
  existing meet got a real race day.
- `PPData.today` switched from a fixed demo date to **real time** — Churchill
  Downs' fictional meet now reads as closed/historical, by design (Phil
  confirmed this is intentional, not a bug to route around).
- Horse `registry` field (Jockey Club / AQHA, derived from track) and a
  5-person veterinarian roster (`PPData.listVets()`).
- New Trainer "Add a horse" flow (`PPStore.createHorse`), selecting a vet
  from that roster.
- Two bugs found via my own screenshot review (not caught by any test) and
  fixed same-commit: an entry deadline that had already lapsed the moment
  the clock went real-time, and `PPData.shipProgram()`'s tour.html-back-compat
  fallback silently leaking Churchill Downs' Ship & Win numbers onto every
  meet with no program of its own.
- Churchill Downs' meet/races/Snellgrove horses were kept in `app/data.js`,
  not deleted — `tour.html` dynamically loads the live data/engine files at
  runtime and hardcodes references into that content, so deleting them would
  silently break the frozen tour. "Replacing" means changing what's
  *featured*, not removing data. Logged in `docs/decisions.md`.

## Done — this session, uncommitted

| Task | Status |
|---|---|
| Stable display name: "Kinnon LaRose Racing Stables" → **"Kinnon LaRose"** | Done. The "Racing Stables" suffix was never independently verified as his real business name — corrected to just his real, verified name throughout `app.html` and `app/data.js`. |
| Pull Kinnon LaRose's broader horse roster | Done — **10 new real horses added** (15 total, up from 5): Glen Airy, Eye Dee Kay, Arthur Jr., Carbone, Batter Up, Oscar's Hope, Standoutsensation, Authentic Gallop, Hello Angel, My Noble Knight. Equibase itself stayed blocked (HTTP 403, Incapsula) on every direct-fetch attempt; sourced instead via irishracing.com race charts, Oaklawn Park barn notes, and BloodHorse race-result pages — all directly fetched, not search-summarized. One AI-summary name error was caught and corrected against the primary chart ("Eve Dee Kay" → the real spelling, **Eye Dee Kay**). Hoosier Philly (a graded-stakes winner still nominally in the barn) and four other named horses (Market Runner, Curly Jack, Fade to Gold, Hay Jude) were searched but explicitly excluded — no verifiable 2026 activity. Full detail with per-horse confidence tiers in `docs/research-delta-downs-larose-2026-07-09.md`. Also recomputed Modo's and Molly McIver's `daysSince` against the real-time clock (they were still calibrated to the retired fixed demo date). |
| This progress file | Done — `docs/progress.md` created. |

## Known gaps / not yet addressed

- **`tour.html` still shows the old Snellgrove/Churchill-Downs content.** It's
  a frozen clone (own nav/router/markup) that only dynamically loads
  `app/data.js`/`app/engine.js` — it wasn't touched, so it still reads
  correctly, just shows stale content relative to the live app now. Tracked
  in `plan.md` → Held; regeneration awaits Phil's go-ahead per that section.
- **Churchill Downs' fictional storyline is now dormant.** The vet's-list,
  Lasix-vs-stakes, and N1X-eligibility demonstrations were all built around
  Snellgrove's horses, referenced by name in `docs/playbooks/demo-feature.md`.
  They're no longer reachable from the Trainer's own dashboard now that
  LaRose is the featured persona. No replacement demo path has been built —
  flagged, not fixed.
- **Investor walkthrough guide** — still Held, unstarted (plan.md).
