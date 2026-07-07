# Playbook: competitive deep research

Reusable recipe for the multi-agent research sweep that produced
[`docs/research-competitive.md`](../research-competitive.md) (July 2026).
Use it to refresh the landscape, vet a new competitor, or research a new
category (e.g., owner tools, international expansion).

## Shape

Three phases, run as a Workflow (or parallel subagents):

1. **Sweep** — one researcher per competitor/category, in parallel. Each gets
   the same product context block plus its assigned target, and returns a
   structured report: `name, category, audience, summary, features[{name,
   description, personaValue}], pricing, workflowCoverage, gaps[],
   userComplaints[], postparadeImplications[], confidence, sources[]`.
   Instructions that matter:
   - WebSearch/WebFetch liberally; prefer primary sources (vendor sites,
     official training PDFs, app-store listings) then industry press
     (TDN, BloodHorse, Paulick Report, The Racing Biz, Past The Wire).
   - "If the product barely exists or is defunct, say so — that is itself a
     finding." (This is how we learned "Prerace" doesn't exist.)
   - `postparadeImplications` must be concrete feature proposals naming the
     persona, not observations.
2. **Verify** — one adversarial fact-checker per report, spot-checking the 3
   most load-bearing claims (does it exist, is it current, are the features
   real, is the audience right) → `verdict: sound|minor-issues|unreliable` +
   corrections. Discount `unreliable` reports in synthesis; fold corrections in.
3. **Synthesize** — one high-effort agent over all verified reports →
   prioritized feature shortlist (Trainer-first), competitor matrix, key
   insights for the pitch, and 2–4 **demoPicks** scored by
   trainer-value × differentiation × demoability-in-a-client-side-app.

## Target list (July 2026 sweep — reuse/extend)

InCompass (Track Manager/RTO/IRO) · Equibase ecosystem (Virtual Stable,
Horsemen's Area) · Stable Secretary · barn-mgmt category (BarnManager,
HorseLinc, Equicty, Stablebuzz, CRIO, Ardex/Prism) · condition-book tools
(Race Trackr, TLore, equineline, Backstretch) · UK stack (BHA Racing Admin /
Weatherbys, The Racing Manager) · Racing Australia SNS/Stable Assist · US
entry platforms (IRO adoption, 1/ST Racehorse 360, USTA harness) · incentive
programs (Del Mar Ship & Win, Colonial, KTDF, NY/Cal/PA/VA funds) ·
racing-office comms status quo · jockey tooling (light — roadmap only) ·
marketplace analogs (Instawork/Wonolo/Qwick, OpenTable/Resy, DAT/Convoy) ·
trainer voice (forums + industry press, quotes with sources).

## Outputs & where they land

1. Update `docs/research-competitive.md` (synthesis, matrix, shortlist,
   fact-check corrections). Keep the "corrections worth remembering" section —
   it stops agents re-asserting debunked claims.
2. Update `features.html` (the public-facing synthesis): matrix rows,
   recommendation cards with anchor ids + status chips
   (`In the demo →` deep link / `Partially` / `Planned` / `Roadmap`).
3. Feed demoPicks into `docs/playbooks/demo-feature.md` execution.
4. Patch `pitch.html` competitive slide between the
   `<!-- R1-PATCH: competitor rows -->` markers.

## Lessons from the first run

- Workflow agents can die mid-run (rate limits); results persist in the run's
  `journal.jsonl` — salvage from there before re-running anything.
- Guard synthesis code against null agent results (`.filter(Boolean)` and
  null-check nested fields) — one dead verify agent killed the first run's
  final phase.
- Cost: ~26 agents / ~800k tokens for the full sweep. A single-competitor
  refresh needs only sweep+verify for that target plus a manual synthesis edit.
