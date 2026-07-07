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
can't show it. Current storyline entities (keep them working):
`steel-thistle` vet-barred to Jun 20 · `harbor-mist` vet-cleared May 28 ·
`silverware` Lasix vs the Listed stakes (`cd-jun6-r7`) · `copper-kettle`
demo-stable KY-bred · `quarry-road` N1X-eligible vs `tin-roof`/`delta-duke`
not · `cd-jun6-r4` the over-subscribed showcase race (12 entered / 10 cap,
drives cut-line + AE) · ship-in qualifiers at OP/FG · `gale-warning` turf+MTO
(`cd-jun5-r3`). If your feature needs a new storyline, add one and list it here.

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
