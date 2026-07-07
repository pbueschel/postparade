# Playbook: tour.html regeneration (HELD — needs Phil's go-ahead)

`tour.html` is a frozen clone of the pre-refinement app with a guided-overlay
driver. It still *works* (it loads the shared `app/engine.js` + `app/data.js`
via the back-compat contract) but its cloned markup shows the old
single-race world and stale numbers. Decision on 2026-07-06: **regenerate in
one pass rather than reconcile incrementally** — clone-and-annotate artifacts
cost more to patch than to rebuild.

## How the tour works (preserve this mechanism)

- Full copy of the app's screens, with a `TOUR` array of stops layered on top.
- Each stop: `{ kind: 'modal'|'spot', ws: 'trainer'|'track', route: '#...',
  target: '[data-tour="..."]', title, body }`.
- `spot` stops navigate, spotlight the target with a green focus ring
  (`.tour-ring`, #10b981), and show a `.tour-pop` popover; step counter
  excludes the welcome/outro modals.

## Regeneration steps

1. Copy the **refined** `app.html` + its script tags as the new base (screens
   now render via PPRenderers, so the tour drives the real renderers instead
   of cloned static markup — inject `data-tour` attributes via the renderers
   or wrap targets after render).
2. Rewrite the `TOUR` stops for the refined story (suggested arc):
   1. Welcome modal — two sides of every race.
   2. Trainer dashboard — live KPIs, needs-placement ranking.
   3. Spot alerts — the condition-centric watch feed (new differentiator).
   4. Recs for Zengraya — fit score + draw-in chip + True Purse EV.
   5. Trainer race view on `cd-jun6-r4` — the cut line / AE band.
   6. Track meet — fill health + Ship & Win pool.
   7. Race builder — spec edit recomputes fits; "Will it go?" probability.
   8. Request a horse → 9. Trainer requests inbox — accept, loop closes,
      fill count rises (state is real now — the tour can mutate PPStore and
      offer a reset at the outro).
   10. Outro modal — "Trainer ⇄ Track. One engine." + links.
3. Reset `PPStore` (`pp.demo.v1`) at tour start so every run is deterministic.
4. Keep the walkthrough copy consistent with `features.html` claims — the tour
   is the investor-facing proof of exactly those chips.
5. Verify per `release.md` + click through every stop in a real browser.

## Related held deliverable

The **investor walkthrough guide** (HTML page narrating intended usage) should
be produced from the same story arc after the tour is regenerated — same
scenes, prose + screenshots instead of live overlay.
