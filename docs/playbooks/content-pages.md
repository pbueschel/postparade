# Playbook: brand-matched content pages

How `features.html`, `architecture.html`, and `pitch.html` were built; use for
any new investor/advisor-facing page (walkthrough guide, one-pagers, case
studies).

## Constraints (non-negotiable)

- **Self-contained single file**: all CSS inline in one `<style>` block, no
  Tailwind CDN, no external JS. Only external request allowed: the Google
  Fonts `<link>` (Inter + JetBrains Mono) — page must look right if it fails
  (system-ui fallback). Why: the same file must work on GitHub Pages *and*
  under the strict CSP of Claude artifact previews.
- **Brand tokens** from CLAUDE.md, reproduced as CSS variables. Logo = dark
  rounded square + inline-SVG flag glyph `#6ee7b7` + wordmark + page sublabel.
- **Responsive**: body never scrolls horizontally; every wide table/diagram
  wraps in its own `overflow-x:auto` container with a `min-width`.
- Diagrams are pure HTML/CSS (grid/flex boxes, dashed borders = external
  systems, color coding: green=trainer, indigo=track, ink=platform,
  amber=SaaS control plane).
- Footer nav strip cross-linking `index.html · app.html · tour.html ·
  features.html · architecture.html · pitch.html`.

## Page-specific notes

- **features.html** — every recommendation card has a stable anchor id and a
  status chip; `In the demo →` chips deep-link into `app.html#<route>`. Update
  chips whenever demo features ship (see demo-feature playbook §Verification).
- **pitch.html** — 12 full-viewport scroll-snap slides, keyboard nav
  (arrows/space/PgUp/PgDn), fixed slide counter. All invented figures carry
  visible `[EDIT]` chips. The competitive slide's rows sit between
  `<!-- R1-PATCH: competitor rows -->` markers — patch there after any
  research refresh.
- **architecture.html** — keep the build-out sequencing table honest: every
  box maps to demo / Stage 2 / Stage 3 so the diagram reads as a roadmap.

## Verification & delivery

1. Tag-balance check (python `html.parser` walker — see release playbook).
2. Headless-Chrome dump: content present, no `undefined`.
3. Publish a Claude artifact preview for review **before** pushing to `main`
   (Pages is public; artifacts are private).
4. Remember: anything merged to `main` is publicly reachable by URL even if
   unlinked — confirm with Phil before putting internal material there.
