# PostParade — agent conventions

Two-sided horse-racing SaaS prototype: **Trainers** place horses into races,
**Tracks** (racing offices) fill race cards. One recommendation engine scores
horse-vs-race in both directions (Trainer **Submits** ⇄ Track **Requests**).
Positioning: the matching layer beside Equibase (data of record) and InCompass
(racing-office system) — never the system of record.

Task playbooks live in [`docs/playbooks/`](docs/playbooks/) — read the relevant
one before starting: competitive research, demo features, content pages,
release, tour regeneration.

**Session ritual:** read `plan.md` (including its **Held** section) and
`docs/worklog.md` before working; end substantive sessions with the
wrap-session ritual — update plan.md, append a worklog entry, log decisions in
`docs/decisions.md`, run the verification gates, commit.

## File map

| Path | Role |
|---|---|
| `index.html` | Marketing landing (Tailwind CDN) |
| `tour.html` | Guided investor tour — a frozen clone of the old app; see back-compat contract |
| `app.html` | App shell: sidebar/nav, router, empty `<section class="screen">` shells |
| `app/data.js` | `PPData` — normalized seed + facade (the future API shape) |
| `app/engine.js` | `PPEngine` — pure scoring engine, no DOM, no seed |
| `app/store.js` | `PPStore` — localStorage overlay (`pp.demo.v1`); seed is immutable |
| `app/render.js` | Shared helpers (`esc`, `pill`, `scoreRing`, `drawInChip`, `fillState`, `toast`…) + `PPRenderers` registry |
| `app/screens-trainer.js`, `app/screens-track.js` | Screen renderers — each owns its section's full innerHTML |
| `features.html`, `architecture.html`, `pitch.html` | Self-contained content pages (no Tailwind CDN — hand-written brand CSS) |
| `docs/research.md`, `docs/research-competitive.md` | Domain + competitive research (cite these, don't re-research settled facts) |
| `plan.md` | Product plan: terminology, domain model, staged architecture, **Held** deliverables |
| `docs/worklog.md` | Session journal, append-only — read before working, append before stopping |
| `docs/decisions.md` | Decision log, append-only (product decisions from June 2026 are in plan.md §9) |
| `test/app-smoke.js`, `test/engine-smoke.js` | Verification suites — run with `bun` |

## Hard rules

1. **Runtime is `bun`, not node** — node is not installed on dev machines.
   Syntax check: `bun -e "new Function(require('fs').readFileSync('<file>','utf8'))"`.
2. **tour.html back-compat contract** (tour loads `app/engine.js` + `app/data.js`):
   never rename or remove existing fields on horses/races — only add;
   keep `PPData.horses`, `PPData.race`, `PPData.meet`, `PPData.shipProgram()`,
   `PPData.classLadder` aliases; two-arg `PPEngine.score(h, race)` /
   `fitsForRace(horses, race)` against **flat race specs** (`distance`, `sexes`,
   `minAge`, `maidenOnly`, `bonusAmount`, `bonusMi`) must behave identically;
   flat `bonusAmount/bonusMi` takes precedence over program-driven shipping.
3. **`score(h, race, ctx)` stays the single engine entry point.** New signals are
   components/weights, gates (a `{pass,label}` reason), or `s.signals[]` badges —
   not new top-level scoring paths. Everything reads v1 fields defensively
   (absent field ⇒ gate/signal skips silently).
4. **Seed is immutable; user actions go through `PPStore`.** Fill counts always
   come from `PPStore.entriesForRace(raceId)` (seed + live submissions +
   accepted requests). Statuses: submissions `submitted|accepted|withdrawn`
   (live submission counts as an entry); requests `sent|accepted|declined`
   (counts only when accepted).
5. **Escape all interpolated data with `esc()`.** One document-level delegated
   listener per screens file; after any `PPStore` mutation: `toast(...)` then
   `window.rerender()`.
6. **Industry-correct terminology** (plan.md §2): Meet · Race Day · Race ·
   Submit · Request · Ship & Win. Never "Weekend".
7. **Demo clock** is `PPData.today` — never wall-clock for countdowns/daysSince.

## Adding a screen (3 steps)

1. Sidebar link: `<a class="nav-item" href="#trainer/x">` in the right
   `data-nav` group in `app.html`.
2. Empty shell: `<section id="trainer/x" class="screen p-6 space-y-6">`.
3. Renderer: `PPRenderers['trainer/x'] = function (param) { ... }` in the
   matching screens file. The router calls it on every navigation and runs
   `lucide.createIcons()` after. Parameterized routes (`#horse/:id`,
   `#track/race/:id`…) resolve via the `paramRoutes` prefix table in `app.html`.

## Brand tokens (content pages reproduce these in hand-written CSS)

Page bg `#fbfaf7` · ink `#0b1220 / #475569 / #94a3b8` · turf green
`#059669 / #10b981 / #ecfdf5` (trainer accent) · indigo `#4f46e5 / #eef2ff`
(track accent) · silk amber `#d97706 / #f59e0b` · cards: white, border
`#eef0f4`, radius 14px, shadow `0 8px 24px -12px rgba(15,23,42,.08)` · fonts
Inter + JetBrains Mono (Google Fonts link OK with system-ui fallback) · logo =
32px `#0b1220` rounded square + flag glyph in `#6ee7b7` + "PostParade"
wordmark. Content pages must be **self-contained** (inline CSS, no CDN JS) so
they work on GitHub Pages *and* as Claude artifacts; wide tables/diagrams
scroll inside their own `overflow-x:auto` container.

## Verification (run before every commit)

```sh
bun test/engine-smoke.js       # engine unit assertions
bun test/app-smoke.js          # full-stack renderer + store-loop smoke
# real-browser render check (headless Chrome):
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --virtual-time-budget=4000 \
  --dump-dom "file://$PWD/app.html#dashboard" | grep -c 'Good morning'
```

Check key routes render (`#dashboard`, `#trainer/alerts`, `#track/race/cd-jun6-r4`,
`#race/cd-jun6-r4`, `tour.html`) and grep dumps for `undefined|NaN|[object`.
Manual loop test: Track sends Request → appears in `#trainer/requests` →
Accept → fill count rises → reload persists → Reset button clears.

## Deploy

GitHub Pages serves **`main` at root** (public!). Work on a feature branch,
staged logical commits, merge/push to `main` only with Phil's approval, then
verify the live URLs (see `docs/playbooks/release.md`). Anything on `main` is
publicly reachable by URL — including pitch/internal docs.
