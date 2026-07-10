# PostParade — Lightweight App Plan

**What this is.** A pragmatic plan to take the prototype to a small, real,
shippable app for the **Trainer** and **Track** sides, grounded in
[`docs/research.md`](./docs/research.md) and superseding the naming/model in
[`docs/races-and-recommendations.md`](./docs/races-and-recommendations.md) where
research corrected it. Date: 2026-06-07.

**Design tenets**
1. **Lightweight first.** Ship on what we have; add a backend only when shared
   two-party state demands it. No heavy framework.
2. **Industry-correct terminology.** Use **Meet** in both the data model and the
   UI (decided — favor the real term over a softened alias).
3. **Sit beside Equibase + InCompass**, don't replace them — import
   Equibase-shaped data; we're the *matching/placement* layer.
4. **The loop is the product:** Trainer **Submits** ⇄ Track **Requests**, one
   recommendation engine in the middle, Ship-and-Win to fill the hard races.

## Held — awaiting Phil's go-ahead

Built (or specced) but not shipped; `main` deploys publicly, so these wait for
explicit approval. Session status lives in [`docs/worklog.md`](./docs/worklog.md).

- [ ] **Investor walkthrough guide** — companion doc to the demo/pitch pages.
- [ ] **`tour.html` regeneration** — one-pass rebuild from the current app;
      procedure in [`docs/playbooks/tour-regeneration.md`](./docs/playbooks/tour-regeneration.md).
      **Open decision for Phil:** after the 2026-07-09 LaRose/Delta Downs pivot,
      should the regenerated tour follow the new real-content storyline, or stay
      a frozen snapshot of the Snellgrove/Churchill Downs demo?

---

## Remediation — 2026-07-09 gap review

Gap analysis of the 2026-07-09 session (`af74099`..`6e95ca5`) against what was
discussed in [`docs/progress.md`](./docs/progress.md),
[`docs/worklog.md`](./docs/worklog.md), [`docs/decisions.md`](./docs/decisions.md),
and this plan. Ordered by urgency. Each item has acceptance criteria; run the
verification gates (CLAUDE.md) before calling any of them done.

### R1 — Demo decay: the app runs out of open races on 2026-07-11 ⚠️ URGENT

The 07-09 decision switched `PPData.today` to real time and accepted that seeded
dates "will need periodic date refreshes" — but no refresh mechanism was built.
As of 07-09 the only races with `entryClose > today` are Saratoga (closes
**07-10 10:00 ET**) and Delta Downs (closes **07-11**); Ellis Park's Jul 11 card
already closed on 07-08, one day after the same lapsed-deadline bug class was
fixed in `f7739b3`. After Saturday: zero open races → Trainer recs, Submit,
draw-in chips, alerts, and the Track fill story all render empty.

- [x] **R1.1 — Rolling dates for demo-fiction races.** Derive race day /
      `entryClose` / `postTime` for *fictional* cards (ELP `elp-jul11-*`, and any
      future demo cards) relative to `PPData.today` (e.g. always next Saturday,
      close T-72h), so the demo is perpetually live. Real historical races
      (Bluebonnet, Old South, Molly McIver's Ellis win) keep fixed real dates —
      per the 07-09 "real facts vs. engine-input numbers" decision, never shift
      a cited real result.
      *Accept:* on any wall-clock date, ≥1 meet has ≥3 open races reachable from
      both workspaces; seeded real results unchanged; tour.html untouched.
- [x] **R1.2 — Smoke-test guard against decay.** `test/app-smoke.js` fails when
      open-race count < 3 or when the featured trainer has zero open, eligible
      recommendations.
      *Accept:* guard trips if R1.1's derivation is reverted to fixed dates.

### R2 — Ship & Win leak fixed on the Track side only

`f7739b3` guarded the `PPData.shipProgram()` back-compat fallback at the
`screens-track.js` call site (`shipProgramFor`), but the Trainer side still
leaks: `screens-trainer.js` (engine ctx) passes `PPData.shipProgram(meetOfRace)`,
whose fallback returns the first ship-and-win program for any meet without one —
so Saratoga/Lone Star recommendations can show a phantom Ship & Win bonus, and
`engine.js`'s own no-ctx fallback does the same.

- [x] **R2.1 — One strict helper, both workspaces.** Add a strict
      `PPData.shipProgramForMeet(meetId)` (null when the meet has no program);
      use it in both screens files; keep the loose `shipProgram()` untouched for
      the tour back-compat contract (CLAUDE.md rule 2).
      *Accept:* SAR/LS/DED races show no bonus anywhere in either workspace;
      `tour.html` renders identically; engine-smoke case covers the null path.

### R3 — No discipline gate: Thoroughbreds fit Quarter Horse races

Quarter Horse racing was added additively (QH class ladder, yards display,
horse `registry`), but the engine never reads `registry` — Delta Downs' Race
Builder "who fits" will happily rank Jockey Club horses into AQHA races and
vice versa. The 07-09 decision scoped QH display to `screens-track.js`, which
hides the problem in one direction only.

- [ ] **R3.1 — Registry eligibility gate.** Hard gate in `PPEngine.score`:
      horse `registry` must match the race's discipline (derive from the meet's
      track / QH class-ladder vocabulary). Per CLAUDE.md rule 3 it's a
      `{pass,label}` gate reason and skips silently when either field is absent
      (tour's flat specs stay unaffected).
      *Accept:* DED who-fits lists only AQHA horses; a LaRose horse against a
      DED race returns `eligible:false` with a named reason; engine-smoke case;
      tour.html identical.

### R4 — The core loop has no demo path between the featured personas

Plan tenet 4 says "the loop is the product," but after the pivot the featured
Track (Delta Downs, Quarter Horse) and the featured Trainer (LaRose,
Thoroughbred-only) can never transact — R3 makes that formally true. The
CD ⇄ Snellgrove world that carried the Submit ⇄ Request demo is closed/dormant.

- [ ] **R4.1 — Ellis Park as the loop-carrying meet.** Give the Track
      workspace's meet list a live Ellis Park Thoroughbred card (R1.1 keeps it
      open) where LaRose horses genuinely fit — ELP already has barns/stalls
      seed data and LaRose history (Molly McIver). Delta Downs stays the
      featured QH showcase; ELP carries the two-sided loop.
      *Accept:* CLAUDE.md's manual loop test passes on current content —
      Track sends Request to a LaRose horse → appears in `#trainer/requests` →
      Accept → fill count rises → reload persists → Reset clears.

### R5 — Dormant feature showcases (vet's-list, Lasix, N1X, also-eligible)

The eligibility-gate demonstrations were all built on Snellgrove horses in the
now-historical Churchill meet and are no longer reachable from the featured
dashboards; `docs/playbooks/demo-feature.md` still names those horses.
Flagged in `docs/progress.md`, not fixed.

- [ ] **R5.1 — Recreate showcase states on current content.** On the live
      LaRose/ELP world: one horse on the vet's list (real vet roster already
      exists), one N1X near-miss, one over-subscribed race spilling to
      also-eligibles (the `cd-jun6-r4` pattern). Illustrative states go on
      demo-fiction entities, never asserted as real facts about LaRose's actual
      horses — mark them the way the seed already marks engine-input numbers.
      *Accept:* each showcase reachable ≤2 clicks from a featured dashboard;
      `docs/playbooks/demo-feature.md` updated to current names.

### R6 — Docs drift from the pivot

- [ ] **R6.1** Annotate §9.4 below as superseded (single-track Churchill MVP →
      multi-track real content) pointing at `docs/decisions.md` 2026-07-09 —
      done in this revision, verify it sticks.
- [ ] **R6.2** Add `docs/progress.md` to CLAUDE.md's file map (it's referenced
      by the session ritual docs but unmapped).
- [ ] **R6.3** Worklog corrective entry: the 07-09 entry says the LaRose pivot
      was "uncommitted — pending review," but `f7739b3`/`6e95ca5` were committed
      and pushed to public `main` later that evening without a closing worklog
      update.
- [ ] **R6.4** §5's shared "condition parser playground" no longer has a nav
      entry (dead link removed 07-09) — either restore it as a Track-side tool
      or mark it deferred here.

**Sequencing recommendation:** R1 + R2 immediately (R1 before Saturday or the
public demo goes dark); R3 + R4 together next (the gate makes the loop-path
problem explicit, the ELP meet solves it); then R5; R6 alongside. Tour
regeneration stays Held pending the decision above.

---

## 1. Scope

**In (MVP):** Trainer + Track workspaces. Track builds races under
**Meet/Event → Race Day → Race**. Race spec (type/surface/distance/purse/
conditions). Recommendation engine ranks who-fits. Submit/Request actions.
Ship-and-Win incentive. Fill/field-size health.

**In (v1, post-MVP):** Preference **draw-in probability**; vet's-list +
medication eligibility gating; also-eligible / MTO backups; Overnight view;
trainer campaign planning (point-to/prep/target) + stakes nomination reminders.

**Out / backlog:** Owner workspace → future **guest access** (owner views their
horses under one trainer). Billing, jockey-booking workflow, live data
ingestion pipeline, real notifications, multi-track circuit, InCompass
integration. Wagering/handicapping features (not our lane).

---

## 2. Terminology & naming decisions

| Concept | Data model | UI label | Note |
|---|---|---|---|
| Top container | **Meet** | **Meet** | Spans 1-day→multi-week. Replaces prototype's "Weekend." (UI uses the real term.) |
| Multi-day marquee block | **Festival** (optional) | "Festival" | Named grouping of race days; default off. |
| One day's races | **Card** | **Race Day** | |
| One contest | **Race** | Race | |
| Purse incentive | **SupplementProgram** | "Ship & Win" / "Bonus" | Stackable; Ship-and-Win is the canonical one. |
| Trainer→race action | **Submission** | **Submit** | |
| Track→horse action | **Request** | **Request** | |

> Rename across the app: `track/weekend` → `track/meet`, copy "weekend" → "meet".
> Keep "Race Day" and "Race". Add an optional Festival grouping later.

---

## 3. Domain model (corrected)

Entity relationships (changes from the prior doc in **bold**):

```
Track 1─* Meet 1─* RaceDay 1─* Race 1─* Entry
                │              │        │
   SupplementProgram ─────────┘        ├─* Submission ─┐
   (Ship&Win / bonus, scoped)          ├─* Request ────┤→ resolve to Entry
   **Festival** (optional overlay      └─* Recommendation (computed)
    over RaceDays)
Stable(Trainer) 1─* Horse 1─* PastPerformance
Horse: + **preferenceDate/stars**, + **vetListStatus**, + **medication/equipment**, + homeTrack
Race:  + **classLadder enum/code**, + **nonWinnersCondition**, + **prefSystem**, + AE cap, + MTO flag
```

### Key entities & the fields research added

- **Meet** — `track`, `label`, `start/end`, `status`
  (draft→published→closed→run), `meetType` (regular | boutique | festival/event),
  optional **`festivals[]`** (named card groupings), `supplementPrograms[]`.
- **Race** — prior spec **plus**: `classLadder` enum (`MSW|MdnClm|Clm|OptClm|
  StarterAlw|Alw|Hcp|Listed|G3|G2|G1`), **`nonWinnersCondition`** (`{kind:
  N_X|N_Y|N$Y|N2L, count, sinceDate?, amount?}`), `stateBredRestricted` flag,
  **`preferenceSystem`** (`date|stars|none`), **`alsoEligibleCap`**, **`isTurf`/
  `mtoAllowed`**, `entryClose` (separate from `postTime`), `fieldTarget{min,max}`.
- **Horse** — prior fields **plus**: **`preferenceDate`/`stars`** (per condition
  recency), **`vetList`** (`{listed:bool, reason?, eligibleDate?}`),
  **`medication`** (Lasix/bleeder-list), **`equipment`** + change flags,
  `firstTimeAngles[]`, `homeTrack`, `stateBred`.
- **SupplementProgram** (replaces ad-hoc "shipping bonus") —
  `type` (`shipAndWin|vanAllowance|maidenBonus|stateFund`),
  `flatAmount`, `purseBonusPct`, `eligibility` (`{shipInOnly, minShipMi,
  fromOutsideState, notRacedInStateMonths, excludeStakes, excludeFirstTimers}`),
  `cap{perHorse,totalBudget,claimed}`, `scope` (meet|festival|raceDay|race).
- **Submission / Request** — as before (`status` state machines), **plus**
  `preferenceRank` snapshot and `supplementApplied{program,amount}`.
- **Recommendation** (computed) — see §4.

---

## 4. Recommendation engine (v1 spec)

One `score(horse, race)`, both directions. Pipeline:

1. **Hard eligibility gate** → `eligible:false` with the failing rule named.
   - Conditions: age/sex, maiden/non-winners ladder (which wins count!),
     claiming, **state-bred restriction**.
   - **New gates:** **vet's-list** (barred until `eligibleDate`),
     **medication** (e.g., 2yo/stakes Lasix rule), nomination status (stakes).
2. **Fit score (0–100)** — weighted: distance, surface, class (drop/jump),
   speed vs par, freshness, connections, field strength. *(weights as tunable
   constants — already implemented.)*
3. **Shipping & incentives** — ship distance `homeTrack→track`; apply matching
   **SupplementProgram** (Ship-and-Win flat + % purse) when eligible; surface it.
4. **Draw-in probability (NEW)** — from the race's **preference system** +
   horse's preference date/stars + projected entries vs `alsoEligibleCap`:
   "Likely to draw in / likely AE / unlikely." This is the trainer's real
   anxiety and a differentiator.
5. **Acceptance likelihood (Track/Request view)** — fit + ship feasibility +
   bonus sweetener + trainer activity. Drives the "Likely yes · NN%" ranking.

Two queries over the same engine: **Trainer (Submit)** fixes the horse, ranks
open races; **Track (Request)** fixes the race, ranks eligible-not-entered horses.

> The current prototype implements 1–3 and 5 (minus the new gates). v1 adds the
> vet/medication gates and **draw-in probability**.

---

## 5. Screens / information architecture

**Track** — `track/meet` (Meet overview: race days, fill health, bonus pool) ·
`track/raceday` (card + fill status) · `track/race/:id` (**race builder** + spec
+ who-fits engine + Request) · `track/requests` (fill & outreach) ·
`track/overnight/:day` *(v1: read-only field, posts, AEs)* · `track/strength`
(field-strength trends).

**Trainer** — `trainer/dashboard` (stable; horses needing a spot) ·
`trainer/horse/:id` (profile + fit + **draw-in odds**) · `trainer/recs/:id`
(recommended races → **Submit**) · `trainer/requests` (inbound → accept) ·
`trainer/campaign/:id` *(v1: point-to a target, prep spacing, nomination
reminders)*.

**Shared** — condition parser playground.

---

## 6. Architecture (lightweight, phased)

The product needs **shared two-party state** (a Track's Request must show up in a
Trainer's inbox). That eventually means a backend — but we stage it.

**Stage 1 — client-side MVP (now).** Keep the single-page Tailwind app; promote
the inline seed into a structured JS data module + the engine module; persist
Submit/Request to **`localStorage`**. Still deploys to **GitHub Pages**. Proves
the UX and engine end-to-end with zero infra. *(We're ~80% here already.)*

**Stage 2 — lightweight full-stack (when two real users need to share state).**
- **Runtime:** **Bun** (matches your toolchain). Single process.
- **Server:** `Bun.serve` (or **Hono** on Bun) — a thin JSON API
  (`/events`, `/races`, `/horses`, `/submissions`, `/requests`, `/score`).
- **DB:** **`bun:sqlite`** — one file, zero-ops, perfect for this size.
- **Front-end:** the *same* HTML/Tailwind, fetching the API instead of seed JSON.
  Optionally split the growing single file into partials, but no SPA framework
  needed.
- **Engine:** shared module imported by both server (authoritative scoring) and
  client (optimistic UI).
- **Deploy:** a small always-on host (Fly.io / Railway / Render). *(Pages is
  static-only, so Stage 2 leaves Pages — keep the marketing `index.html`/`tour`
  on Pages, run the app on the host.)*

**Recommendation:** build Stage 1 now (fast, keeps the demo live), design the
data module as the future API shape so Stage 2 is a swap, not a rewrite.

```
postparade/
  index.html  tour.html        # marketing + tour (stay on Pages)
  app/                          # the app
    index.html                 # shell (current app.html, refactored)
    engine.js                  # score(horse,race) — shared
    data.js                    # Stage 1 seed + adapters  →  Stage 2: fetch()
  server/                       # Stage 2 only
    index.ts                   # Bun.serve / Hono
    db.ts                      # bun:sqlite schema + queries
    seed.ts
  docs/  plan.md
```

---

## 7. Roadmap

**Phase 0 — Model & naming lock (small).** Rename Weekend→Meet/Event in
`app.html`; add the class-ladder enum, non-winners condition, and
SupplementProgram shape to the seed; split engine + data into modules.

**Phase 1 — MVP polish (Stage 1).** Real seed of horses/races shaped to the
Equibase/Brisnet fields; Submit/Request persisted to `localStorage`; Ship-and-Win
modeled as a SupplementProgram; fill/field-size health as the Track KPI.

**Phase 2 — v1 domain depth.** Vet's-list + medication gates; **draw-in
probability** (preference system); also-eligible / MTO surfacing; Overnight
view; trainer campaign planning + stakes nomination reminders.

**Phase 3 — Stage 2 backend.** Bun + `bun:sqlite` + thin API; move shared
state server-side so Trainer and Track genuinely transact; deploy to a small
host; auth (magic-link) for the two roles.

**Phase 4 — Data & scale.** Equibase adapter when the file lands (charts/PPs XML,
condition-book parse); notifications (email/SMS for requests + close times);
multi-track circuit; explore InCompass/Equibase interop.

---

## 8. Data seeding

- **Now:** hand-authored seed shaped to the Brisnet/Equibase field set (see
  [`races-and-recommendations.md` §7](./docs/races-and-recommendations.md)).
  No-login stand-ins to pull when ready: `eprochasson/horserace_data` (GitHub),
  JCapper free DRF-equivalent weekend.
- **Later:** the **Equibase free dataset** (registered, awaiting link) via a thin
  adapter `raw row → PostParade entity`. Keep field names/codes aligned so the
  swap is an adapter, not a remodel. Remember: condition books are **PDF** and
  carry **post time, not entry-close** — source `entryClose` separately.

---

## 9. Decisions (resolved 2026-06-07)

1. **App stack: Stage 1 → Stage 2.** Client-side localStorage MVP now (stays on
   Pages); graduate to Bun + `bun:sqlite` + thin API when the two roles need
   shared state. Design the data module as the future API shape.
2. **Top-container label: "Meet"** in both the data model and the UI — use the
   real industry term, not a softened alias. Multi-day marquee = "Festival".
3. **Draw-in: simple heuristic first.** A "likely to draw in / likely AE /
   unlikely" estimate from recency + projected entries vs field cap. Full
   date/stars model is a later refinement.
4. **MVP scope: single track first** (Churchill Downs + its circuit's trainers).
   Engine already supports cross-track; defer the track filter + circuit nav.
   *Superseded 2026-07-09* — demo pivoted to real multi-track content (Delta
   Downs featured, LaRose persona); see `docs/decisions.md`. Kept as the
   historical record of the original decision.
5. **Owner guest access: fully parked.** No read-only owner view in v1; keep the
   parked screens/code for the future backlog item.

---

## 10. Explicitly deferred

Owner workspace (→ guest access), billing/tax, jockey booking, live ingestion,
real notifications, InCompass integration, wagering/handicapping, coupled-entry
modeling (per-jurisdiction), HISA rule automation. Tracked so they're not lost.
