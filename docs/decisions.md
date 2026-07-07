# Decisions

<!-- Append-only decision log, newest entry first.
     Record anything a future session would otherwise re-litigate.
     Product/domain decisions made 2026-06-07 (stack staging, "Meet" terminology,
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
