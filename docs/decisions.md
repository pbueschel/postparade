# Decisions

## 2026-07-09 — Dormant showcases rebuilt Track-side on demo-fiction horses, not in LaRose's barn (R5.1)
- **Decision:** The vet's-list, non-winners (N3X), also-eligible, and Lasix
  showcases now live on the perpetually-open Ellis Park `elp-jul11` card, driven
  by the **demo-fiction** Snellgrove/other-barn roster and surfaced on the
  **Track** side (the "who fits" list plus a new **"One rule away"** near-miss
  panel on the race builder, and the trainer-side cut-line panel). New fictional
  races: `elp-jul11-r4` (12-over-10 also-eligible spill) and `elp-jul11-r5`
  (no-Lasix Listed stakes). `steel-thistle`'s vet-clearance date was made
  *rolling* (ELP race day + 14d) so the vet showcase never decays to cleared.
- **Why Track-side, not the Trainer's own barn:** the featured Trainer workspace
  is the **real** Kinnon LaRose. Putting a vet's-list / Lasix / near-miss state
  on one of his real horses would assert a false real-world fact about a real
  person's stable (a vet's-list flag claims unsoundness) — forbidden by the
  2026-07-09 "real facts vs. engine-input numbers" decision below. Illustrative
  eligibility states may sit **only** on demo-fiction entities. The Snellgrove
  roster is already demo-fiction and already carries exactly these states, so it
  is reused (given ELP entries / near-miss candidacy) rather than inventing a new
  fictional stable or, worse, faking horses into LaRose's barn.
- **Consequence:** trainer-side showcases of these gates ("your horse is
  vet-listed") intentionally do **not** exist for LaRose — the reconstruction is
  Track-facing ("who almost fits this race, and the one rule that blocks them").
  The near-miss panel truthfully lists real LaRose horses too when a real record
  (e.g. Modo's 5 allowance wins → over N3X, a 2yo → too young) is the blocking
  rule; that is a true statement computed by the engine, not a planted flag.
- **Rejected:** a fictional horse inside the real LaRose stable (asserts a false
  fact); a brand-new fictional Ellis Park stable (more invented fiction than
  reusing the already-fictional Snellgrove roster); leaving the showcases only in
  the now-historical Churchill Downs meet (unreachable from the featured demo).

## 2026-07-09 — Discipline derived from the meet, stamped onto races (R3.1)
- **Why:** The registry gate needs a per-race discipline, but the engine must
  stay seed-agnostic and tour-safe. Chosen: add `discipline` ('TB'|'QH') to each
  meet, then stamp it onto every seeded race at data-build time (mirrors the
  existing `h.registry` stamp). The engine reads `race.discipline` + `h.registry`
  directly and skips silently when either is absent — so tour.html's flat race
  specs (no `discipline`) are untouched, verified byte-identical. Yards-vs-furlongs
  display was re-keyed off discipline (was DED-track-only) so it generalizes.
- **Rejected:** Passing discipline only through the screens' engine `ctx` (would
  miss the smoke-guard and any future call site that doesn't build ctx); a
  parallel QH engine path (violates the single-entry-point rule).

## 2026-07-09 — Demo pivots to real trainer/track content; Churchill Downs stays but is no longer featured
- **Why:** Phil asked to replace the fictional demo trainer with the real
  Kinnon LaRose, then to make Delta Downs the demo's track "going forward,"
  with more real trainers/tracks pulled in as found. This supersedes plan.md
  §9.4's "MVP scope: single track first (Churchill Downs...)" decision without
  editing that line directly — plan.md is left as the historical record of
  the original decision, this entry records the change.
- **Kept, not deleted:** Churchill Downs' meet, races, and the Snellgrove
  stable/horses stay in `app/data.js` untouched. `tour.html` dynamically loads
  the live `app/data.js`/`app/engine.js` at runtime and hardcodes references
  into that content — deleting it would silently break the frozen tour.
  "Replacing" Churchill Downs means changing what's *featured* (the Track
  workspace's identity, the Trainer's persona) — not deleting the underlying
  data. `isDemoUser` moved from the `snellgrove` stable to a new `larose`
  stable; nothing else changed shape.
- **Real-time clock accepted the consequence of Churchill Downs going stale:**
  `PPData.today` (was a fixed 2026-06-01 anchor) is now real time. Phil
  explicitly confirmed this is fine — Churchill Downs' fictional meet reads
  as closed/historical the moment real time passes its June 28 end date,
  since Delta Downs is meant to be the current, live showcase instead.
  Consequence for future sessions: every fixed real-world date seeded this
  session (meet windows, race days, entry deadlines) will similarly go stale
  as real time advances — this is expected, not a bug, and will need periodic
  date refreshes to keep the "live" content actually live.
- **Real facts vs. engine-input numbers, kept separate:** Every new horse's
  identity, race context, and results are real and cited
  (`docs/research-delta-downs-larose-2026-07-09.md`); numeric fields the
  scoring engine needs but aren't published stats (class rating, sweet-spot
  distance range, trainer win%) are demo-illustrative, same convention the
  original seed already used for its own horses — never fabricated as if
  real.
- **Quarter Horse racing modeled additively, not as a schema rewrite:**
  Delta Downs' current live meet is Quarter Horse (a different discipline
  than the rest of the app). Distances still live in the existing
  `distanceYards` field (QH racing already measures in yards); a new
  classLadder vocabulary (MDN/StkG1-3/RG1-3/Fut/Der/Trial) was added
  alongside the existing Thoroughbred one, and yards-vs-furlongs display is
  keyed off the race's track, scoped entirely to `screens-track.js` (the
  Trainer workspace never shows a Delta Downs race, since Kinnon LaRose has
  no Quarter Horse horses).
- **Rejected:** Deleting/renaming Churchill Downs content to fully "kill" it;
  modeling Quarter Horse racing as a parallel schema/engine rather than an
  additive vocabulary extension of the existing one.

<!-- Product/domain decisions made 2026-06-07 (stack staging, "Meet" terminology,
     draw-in heuristic, single-track MVP, owner access parked) live in plan.md §9
     and are not duplicated here — this log picks up from July 2026. -->

## 2026-07-06 — Adopt the repo-as-memory structure (worklog + decisions + Held)
- **Why:** Session state (especially held deliverables) previously lived only in
  Claude's conversation memory — invisible to collaborators and fragile across
  machines. The repo must be reconstructable-from-scratch by any fresh session.
- **Rejected:** Keeping status in chat memory only; a single combined STATUS.md
  (append-only journal + decision log serve different lookups).

## 2026-07-06 — tour.html: one-pass regeneration, not incremental patching
- **Why:** The tour is a frozen clone of the old app under a strict back-compat
  contract (CLAUDE.md rule 2); patching it piecemeal drifts it out of sync with the
  live app. Regenerate it in one pass from the current app when it's time.
  Procedure: `docs/playbooks/tour-regeneration.md`.
- **Rejected:** Incremental edits to the existing tour.html.

## 2026-07-06 — Outward-facing deliverables ship only on explicit go-ahead
- **Why:** `main` deploys publicly via GitHub Pages; investor-facing material
  (walkthrough guide, regenerated tour) must be reviewed by Phil before it is
  reachable by URL. Tracked in plan.md → Held so no session forgets them.
- **Rejected:** Shipping to main as soon as built.
