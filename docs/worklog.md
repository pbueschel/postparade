# Worklog

<!-- Append-only session journal, newest entry first.
     Written at the end of every substantive session — by Phil or by an agent. -->

## 2026-07-09/10 — Remediation branch `plan-gap-remediation`: R1–R6 executed
- **Changed (four commits on `plan-gap-remediation`, off `main`):**
  - `f42b45e` — the gap review itself (plan.md Remediation section R1–R6,
    §9.4 superseded note, worklog corrective entry).
  - `c81d806` — **R1** rolling demo-fiction Ellis Park `elp-jul11` card (race
    day / entryClose / postTime derive from `PPData.today`, always the upcoming
    Saturday) so the demo never runs out of open races; smoke guard trips if it
    decays. **R2** strict `PPData.shipProgramForMeet()` used in both workspaces
    so program-less meets (SAR/LS/DED) show no phantom Ship & Win; loose
    `shipProgram()` untouched for the tour contract.
  - `20333f2` — **R3** engine registry/discipline gate (Jockey Club⇄TB,
    AQHA⇄QH) as a `{pass,label}` reason that skips silently on flat specs; a
    `discipline` stamp on meets/races; discipline pills. **R4** Ellis Park tuned
    (`elp-jul11-r3` → N3X) so LaRose's real dirt roster genuinely fits — ELP
    carries the Submit⇄Request loop while Delta Downs stays the QH showcase.
  - This session — **R5** the four dormant showcases (vet's-list, N3X
    near-miss, also-eligible spill, Lasix gate) rebuilt on the live ELP card,
    **Track-side on demo-fiction horses** (never LaRose's real barn): rolling
    vet date on `steel-thistle`, `silverware` over the N3X bar, new
    `elp-jul11-r4` (12-over-10 AE spill) and `elp-jul11-r5` (no-Lasix Listed
    stakes), a new **"One rule away"** near-miss panel on the Track race builder.
    **R6** docs drift — `docs/progress.md` added to CLAUDE.md's file map, §5
    condition-parser playground marked deferred, §9.4 supersession + worklog
    corrective verified. plan.md R1–R6 checkboxes all ticked.
- **Verification:** `bun test/engine-smoke.js` 38 pass; `bun test/app-smoke.js`
  SMOKE PASSED (adds the four R5 showcase-state assertions + the R4 ELP loop +
  demo-decay guards); headless-Chrome dumps of `#dashboard`, `#trainer/alerts`,
  `#trainer/requests`, the three ELP race routes, `#race/elp-jul11-r4`, a DED
  route — no `undefined|NaN|[object`; **tour.html renders byte-identical**
  (257,118 bytes, empty diff) against the committed data.js.
- **Next:** Phil reviews `plan-gap-remediation` and merges to `main` (nothing
  pushed — `main` is the public GitHub Pages deploy). Then the Held items.
- **Held/blocked:** Investor walkthrough guide; `tour.html` regeneration — the
  latter now with an explicit open decision (follow the new LaRose/Delta Downs
  storyline or stay a frozen Snellgrove snapshot). Both await Phil's go-ahead.

## 2026-07-09 (later) — Gap review of the day's session; remediation plan added
- **Correction to the entry below:** the LaRose/Delta Downs pivot it lists as
  "uncommitted — pending review" was in fact committed and pushed to public
  `main` later that evening (`f7739b3`, then `6e95ca5` adding 10 more horses,
  the stable-name fix, and `docs/progress.md`) without a closing worklog update.
- **Changed:** Gap analysis of `af74099`..`6e95ca5` vs. the session notes
  (progress/worklog/decisions) and plan.md. Six gaps found, written up as
  plan.md → **"Remediation — 2026-07-09 gap review"** (R1–R6, acceptance
  criteria, sequencing) on branch `plan-gap-remediation`. Headline findings:
  the real-time-clock decision left the app with **zero open races after
  2026-07-11** (Saratoga closes 07-10, Delta Downs 07-11, Ellis already closed
  07-08 — the lapsed-deadline bug class recurred one day after being fixed);
  the Ship & Win fallback leak was guarded only on the Track side (Trainer recs
  can still show phantom bonuses via `screens-trainer.js` engine ctx); the
  engine has **no registry/discipline gate**, so Thoroughbreds rank into Delta
  Downs' Quarter Horse races; and the featured personas (QH track ⇄ TB trainer)
  can never transact, leaving plan tenet 4's core loop without a demo path.
  Also annotated plan.md §9.4 as superseded per the 07-09 decision.
- **Next:** Phil reviews the remediation plan, merges the branch, then R1+R2
  before Saturday (07-11) or the public demo goes dark; R3+R4 next.
- **Held/blocked:** Walkthrough guide; tour regeneration — now with an explicit
  open decision recorded in plan.md → Held (follow the new LaRose content vs.
  stay a frozen snapshot). Both still await Phil's go-ahead.

## 2026-07-09 — Track workspace features, then real-trainer/real-track content pivot
- **Changed (committed, `af74099`..`cd2cbaf`):** Meets list + parameterized meet
  dashboard; Stalls & ship-ins overview + interactive stall builder (barns,
  assign/waitlist); Trainer sidebar Condition parser link removed; Build-a-meet
  flow (meet → race day → race, reusing the Race Builder); race day/meet
  day-count cap + delete meet/delete race day (soft-delete overlay, cascades,
  works on seeded and created entities alike); Race Builder's dead Recompute
  button and read-only condition text fixed.
- **Changed (uncommitted — this session, pending review):** Replaced the
  fictional "Snellgrove Racing" demo trainer with the real **Kinnon LaRose**
  (Tom Amoss's former head assistant, took over the stable April 2026),
  seeded with his real, cited, currently-active horses (Midnight Still,
  Hormesis, Gewurztraminer at Saratoga; Modo at Lone Star Park; Molly McIver
  at Ellis Park — see `docs/research-delta-downs-larose-2026-07-09.md`).
  Added three real tracks: **Delta Downs** (now the Track workspace's default
  identity, its current live Quarter Horse meet — required new yards-based
  distance display + a QH classLadder vocabulary, additive alongside the
  existing Thoroughbred one), **Saratoga**, **Lone Star Park** — each with
  real, cited trainers/horses/results. `PPData.today` is now real time
  (formatted to stay string-comparison-compatible with the seed), not a fixed
  demo date — Churchill Downs' fictional meet is now naturally
  historical/closed as a result, by design. Added horse `registry`
  (Jockey Club/AQHA, derived from track) and a veterinarian roster
  (`PPData.listVets()`), plus a new Trainer "Add a horse" flow
  (`PPStore.createHorse`) that selects a vet from that roster. Found and
  fixed a latent bug along the way: `PPData.shipProgram()`'s tour.html-
  back-compat fallback silently returned Churchill Downs' Ship & Win numbers
  for any meet with no program of its own — guarded at the `screens-track.js`
  call site rather than touching the back-compat-sensitive source function.
- **Next:** Review the LaRose/Delta Downs content, then commit + push.
  Consider whether Churchill Downs' now-dormant fictional storyline
  (vet's-list/Lasix/N1X demonstrations, all Snellgrove-horse-based) needs a
  replacement demo path, since it's no longer reachable from the Trainer's
  own dashboard.
- **Held/blocked:** Investor walkthrough guide; `tour.html` regeneration (now
  more relevant than before — tour.html still shows the old Snellgrove/CD
  storyline, since it's a frozen clone; regenerating it would need a decision
  on whether the tour should follow the new LaRose/Delta Downs content or
  stay as a fixed historical snapshot). Both still await Phil's go-ahead.

## 2026-07-06 — Memory retrofit (worklog, decisions, Held tracking)
- **Changed:** Added `docs/worklog.md` + `docs/decisions.md`; added a **Held** section
  to `plan.md`; registered both files in `CLAUDE.md`'s file map and session ritual.
- **Next:** On Phil's go-ahead, run the held deliverables — tour regeneration first
  (`docs/playbooks/tour-regeneration.md`, one-pass), then the investor walkthrough guide.
- **Held/blocked:** Investor walkthrough guide; `tour.html` regeneration. Both awaiting
  Phil's explicit go-ahead (see plan.md → Held).

## 2026-07-06 — Research-driven demo + content pages shipped
- **Changed:** Four commits landed: demo foundation (normalized seed, engine v1,
  localStorage persistence, live Trainer/Track screens — `87fc97d`), competitive
  research synthesis via 13-agent sweep + fact-check (`docs/research-competitive.md`,
  `c50fb99`), content pages (`features.html`, `architecture.html`, `pitch.html` —
  `18bfa82`), and agent conventions + task playbooks + smoke tests (`303fd60`).
- **Next:** Nothing in-flight; next work is the held deliverables above or Phase 2
  domain depth (plan.md §7 — vet's-list/medication gates, draw-in probability).
- **Held/blocked:** Walkthrough guide + tour regeneration (playbook written;
  one-pass regeneration preferred over incremental patching). Competitive research
  is settled — cite `docs/research-competitive.md`, don't re-run it.
