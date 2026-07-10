# Playbook: adding a feature to the demo

How to take a feature (usually a research demoPick from
`docs/research-competitive.md` §4–5) into `app.html` without breaking the
contracts. Read `CLAUDE.md` first — the hard rules there are the contract.

## Decide the extension point (usually a combination)

1. **New screen** — 3-step recipe in CLAUDE.md (nav link → section shell →
   `PPRenderers[...]` renderer). Example: Spot alerts (`#trainer/alerts`).
2. **New engine signal** — pure function in `app/engine.js`, exported on
   `PPEngine`; returns `null` for flat/old-shaped input so tour.html and the
   race-builder form keep working. Examples: `drawIn`, `fillProbability`,
   `truePurse`, `preferenceOrder`.
3. **New seed fields** — additive only, on all horses/races for consistency;
   `horse.flags[]` / `race.tags[]` are the free-form bags. Update
   `PPData.today`-derived fields coherently (a maiden has `careerWins: 0`).
4. **UI surfacing** — chips/panels in the screens files, using `render.js`
   helpers; new shared chip helpers go in `app/render.js`.

## Storyline seeding

Every gate/signal needs a horse or race that demonstrates it, or the demo
can't show it.

**Live showcases (on the perpetually-open Ellis Park `elp-jul11` card — reach
them from the Track workspace: Meets → Ellis Park → the `elp-jul11` race day → a
race builder).** After the 2026-07-09 LaRose/Delta Downs pivot the featured
Trainer is the *real* Kinnon LaRose, so illustrative eligibility states can't
sit on his barn (a vet-list/Lasix flag on a real horse asserts a real-world
fact — forbidden per docs/decisions.md 2026-07-09). They live instead on the
**demo-fiction** Snellgrove/other-barn roster and surface **Track-side** as
"who fits" + a **"One rule away"** near-miss panel on the race builder
(`scr-track-race`), plus the trainer-side cut-line panel (`#race/:id`):

- **Vet's list** — `steel-thistle` (demo-fiction colt) is vet-barred with a
  *rolling* clearance date (`rollVetEligible` = ELP race day + 14d, so it never
  decays to cleared). Shows as a named near-miss on `elp-jul11-r3`
  ("Vet's list (unsound) — eligible …").
- **Non-winners (the card's N3X)** — `silverware` (3 wins other than
  mdn/clm/starter) is one over the `elp-jul11-r3` N3X bar → near-miss
  "over N3X limit". (`quarry-road`/`arthur-jr`, 0 wins-other, pass; the loop
  Requests them into r3.)
- **Also-eligible / cut line** — `elp-jul11-r4` (open Clm) is seeded 12 entries
  against `fieldTarget.max` 10 → spills to also-eligibles (rolling-date
  reconstruction of the old `cd-jun6-r4`). Cut-line + AE band render on the
  trainer-side `#race/elp-jul11-r4`.
- **Lasix / medication** — `elp-jul11-r5` is a Listed turf stakes prohibiting
  race-day Lasix; the demo-fiction Lasix mare `silverware` is class/distance
  eligible but gated out → near-miss "Lasix not permitted". `battis-grove` /
  `bourbon-barrel` (no Lasix) fill the legal field.

**Historical CD storyline (still in the seed, now dormant — tour.html + the CD
meet).** `steel-thistle` also carries the CD-era vet flag · `harbor-mist`
vet-cleared · `silverware` Lasix vs the Listed stakes (`cd-jun6-r7`) ·
`copper-kettle` demo-stable KY-bred · `quarry-road` N1X-eligible vs
`tin-roof`/`delta-duke` · `cd-jun6-r4` the over-subscribed showcase race ·
ship-in qualifiers at OP/FG · `gale-warning` turf+MTO (`cd-jun5-r3`).

If your feature needs a new storyline, add one and list it here.

## Division of labor (what parallelizes)

- `app/data.js`, `app/engine.js`, `app/store.js`, each screens file — separate
  agents fine (different files). Give every agent the same shape contract
  inline and "code defensively: optional chaining, absent field ⇒ skip".
- `app.html` — single owner per task (nav, shells, router, inline script).
- Renderers own their section's **full innerHTML**; visual reference for
  layout/Tailwind classes is the existing renderers, or `git show <rev>:app.html`
  for historical markup.

## Verification checklist (all must pass before commit)

1. `bun test/engine-smoke.js` — extend it with assertions for new engine
   functions (old flat-spec call must still return the old shape).
2. `bun test/app-smoke.js` — extend `expected` renderers list + add feature
   assertions; it renders every route for every entity and exercises the
   Request→Accept→entry store loop.
3. Headless-Chrome route dumps (see CLAUDE.md) — new screen + touched screens
   render, zero `undefined|NaN|[object` in the DOM.
4. tour.html still renders (back-compat gate).
5. Update `features.html`: flip the feature's status chip to
   `In the demo →` with a deep link to its route.
