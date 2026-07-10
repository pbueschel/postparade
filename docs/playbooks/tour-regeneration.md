# Playbook: tour.html regeneration

`tour.html` is the guided investor tour. As of **2026-07-10** it is a thin
overlay on the **real app**, not a frozen clone: it reuses `app.html`'s shell and
router and drives the live renderers (`PPRenderers` over `PPData`/`PPEngine`/
`PPStore`), following the current LaRose / Ellis Park / Delta Downs storyline.
Decision on 2026-07-06: **regenerate in one pass rather than reconcile
incrementally**; executed 2026-07-10 (see `docs/decisions.md`). Regenerate the
same way next time the featured content shifts.

## How the tour works now (preserve this mechanism)

- **Built from `app.html`.** `tour.html` is `app.html` plus: the tour overlay CSS
  in `<style>`, the overlay DOM (`#tourBackdrop`/`#tourRing`/`#tourPop`/
  `#tourModal`) before the app scripts, and one tour-driver `<script>` **after**
  app.html's boot script. The driver reuses the shell's globals — `showScreen`,
  `setWorkspace`, `workspaces` — so navigation goes through the real router and
  every screen is painted by its real renderer. Keep the same script tags / CDN
  pattern as `app.html` (self-contained, GitHub-Pages-ready).
- **`TOUR` array of stops.** Each stop is either:
  - `{ kind:'modal', ... }` — centered welcome/outro (no spotlight); or
  - `{ kind:'spot', ws, route, resolve, badge, title, body, metric, ... }` —
    `navTo(route)` swaps screen+workspace via `history.replaceState`+`showScreen`
    (no `hashchange`), an optional `onEnter()` runs store beats, then
    `resolve()` **locates the target element in the freshly-rendered DOM** and it
    gets the `.tour-ring` (#10b981) spotlight + `.tour-pop` popover. The step
    counter (`tourIdx / TOUR.length-2`) excludes the welcome/outro modals.
- **Targets resolve after render — do NOT add `data-tour` to the app screens.**
  Each `resolve()` finds its element by a stable selector or heading text within
  the rendered section (e.g. `within('scr-recs','a[href="#race/elp-jul11-r3"]')
  .closest('.card')`, `cardWith('scr-race','The cut line')`, a
  `.pp-request[data-horse-id="…"]` row), falling back to the section element.
  This keeps `app.html`/`app/screens-*.js` **byte-identical** to the app — the
  whole tour lives in `tour.html`.
- **Real state, deterministic.** The driver clears `pp.demo.v1` at boot (one-time
  reload when leftover exists) so every run starts identical. The Submit⇄Request
  beat writes a real Request to `PPStore` and Accepts it on-screen (two-phase
  loop stop: phase A spotlights the Accept button, `Next` accepts + re-renders,
  phase B shows the entered count risen). The outro offers a reset. A `?step=N`
  query param deep-links to any stop (review + headless verification).

## Regeneration steps

1. Copy `app.html` → `tour.html`; set the `<title>`.
2. Re-add the three tour blocks (CSS, overlay DOM, driver script) — lift them
   from the previous `tour.html` (they are content-agnostic).
3. Rewrite the `TOUR` array to the current featured story. Verify the anchors in
   `app/data.js` first (which horses actually fit, which race carries the loop,
   the featured meet) — see the current arc below.
4. Point each `resolve()` at the real rendered DOM for its route. Prefer selector
   / heading-text matching over editing the screens; add `data-tour` attributes
   only as a last resort, minimal and additive.
5. Verify per `release.md` + the checks below; click through every stop.

## Current story arc (2026-07-10)

Welcome modal → (1) Trainer dashboard, LaRose barn, needs-placement → (2) Spot
alerts → (3) Recs for **Arthur Jr.** spotlighting his `elp-jul11-r3` card (fit,
draw-in, True Purse EV, real Ship & Win) → (4) Trainer race view of
`elp-jul11-r4` cut line (10 in / 2 AE) → (5) Track Meets, Delta Downs' Quarter
Horse meet (yards, AQHA, discipline pills) → (6) Race builder `elp-jul11-r3`
spec + fill probability → (7) who-fits + "One rule away", Request Arthur Jr. →
(8) Trainer requests inbox, Accept, loop closes + entered count rises → Outro
modal ("Trainer ⇄ Track. One engine.") with links to features/architecture/pitch
and a reset.

## Verification (run before commit)

- `bun test/engine-smoke.js` && `bun test/app-smoke.js` — must pass unchanged
  (the tour touches no engine/screen code).
- Headless Chrome, base load: welcome modal present, no `undefined|NaN|[object`.
- Headless Chrome per stop via `?step=N`: each route renders and its target
  resolves — confirm exactly one element carries the applied `tour-spot` class
  (0 for the outro modal), and grep for the expected panel (`One rule away`,
  `draw-in cut line`, the DED meet link, the Accept button + Ship & Win callout).
- Confirm `git diff app.html app/screens-*.js` is empty — the tour must not have
  drifted the app.

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --virtual-time-budget=6000 \
  --dump-dom "file://$PWD/tour.html" | grep -c 'Two sides of every race'
for n in $(seq 1 9); do
  "$CHROME" --headless=new --disable-gpu --virtual-time-budget=6000 \
    --dump-dom "file://$PWD/tour.html?step=$n" > /tmp/s$n.html
  echo "step $n tour-spot els:" $(grep -oc 'class="[^"]*tour-spot[^"]*"' /tmp/s$n.html)
done
```

## Back-compat note

The old tour depended on CLAUDE.md rule 2's back-compat contract (`PPData.race`/
`PPData.meet`, loose `PPData.shipProgram()`, flat two-arg `PPEngine.score`). The
**new tour does not** — it drives the real renderers over real races and resolves
ship programs through the strict per-meet path. Those aliases are **retained**
(their removal is a separate decision for Phil), but nothing in `tour.html` still
exercises them.

## Related held deliverable

The **investor walkthrough guide** (HTML page narrating intended usage) is the
last Held item — produce it from **this** arc: same scenes, prose + screenshots
instead of the live overlay.
