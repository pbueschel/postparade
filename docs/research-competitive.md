# PostParade — Competitive Landscape & Feature Synthesis

Deep-research sweep (13 parallel researchers + adversarial fact-check pass), 2026-07-06.
Sources: vendor sites, official training PDFs, industry press (TDN, BloodHorse, Paulick
Report, The Racing Biz, Past The Wire), app-store listings, archived pages. All reports
fact-checked; verdicts were "sound" or "minor-issues" (corrections incorporated below).
Raw per-competitor reports: workflow journal (session scratch); condensed JSON kept with
the session scratchpad.

---

## 1. The strategic headline

**The matching layer is empty — and the incumbent is consolidating around it.**

- **Nothing on the market computes per-horse eligibility.** Race Trackr ($125/mo),
  TLore ($4/horse/mo + $150/mo data tier), and equineline Trainer Program ($29.95/mo)
  offer *filter-based race search*; the trainer still does the non-winners/state-bred/
  preference math by hand. InCompass IRO shows a horse dropdown "that fits the condition"
  but never explains why, and has no cross-track view.
- **Nothing models draw-in probability or "will this race go."** Confirmed absent in
  every category researched — US, UK, and Australia. The UK shows live entry counts and
  the elimination line *only on closing day*; Australia hand-publishes ballot order only
  for the Melbourne Cup. Parx trainers losing owners because "their races never go" is
  documented industry press.
- **Nothing gives racing secretaries recruitment tooling.** The state of the art is a
  whiteboard of "extras," a backside PA system, and 24 hours of phone calls (TOC, Texas
  Thoroughbred Assn documentation). Ship & Win-class money (Del Mar: $5,000 + 50% purse
  bonus; 2,400+ horses recruited over 15 years) is spent via press releases and phone.
- **The Jockey Club (TJC Innovations) is assembling the full stack**: Track Manager/RTO
  (racing office, ~90 tracks), Equibase (data of record), IRO (trainer portal), and — as
  of July 2024 — **TLore** (trainer stable management with condition-book search).
  1/ST runs Racehorse 360 (AI for its own racing offices); Pinnacle AI is pitching
  machine-generated condition books in PA. **PostParade's defensible wedge is the
  two-sided matching layer holding real-time trainer intent** — the demand signal every
  AI-condition-book effort will need and none of them have.
- **UK/Australia prove the workflow digitizes** (online entries/declarations since 2018
  in the UK; Stable Assist used by 75%+ of AU trainers since ~2006) — but even those
  national systems are *transactional*: they assume the trainer already picked the race.
  Race *finding* is unowned everywhere in the world.

## 2. Competitor matrix

| Product / category | Audience | What it does well | What it lacks (PostParade wedge) |
|---|---|---|---|
| **InCompass Track Manager / RTO** (Jockey Club) | Racing offices (~90 NA tracks) | System of record: condition-book authoring, entries, draw, overnights, stalls, 12 regulatory lists, purse accounting | Legacy IE-era UI; no recruitment tooling; no fill forecasting; no matching |
| **InCompass IRO** | Trainers (per-track, opt-in) | Online entries, stall apps, stakes noms, rundown counts, list warnings | Per-track silo; basic condition filter with no "why"; no cross-track shopping; no draw-in |
| **Equibase ecosystem** | Trainers/owners (free) + bettors (paid) | Virtual Stable alerts (~200 horses), condition-book/overnight PDF distribution (~65 tracks), free data of record | PDFs unstructured; alerts entity-centric (never "a race your horse fits appeared"); email-only; 3.3★ app |
| **TLore** (acquired by InCompass 7/2024) | Trainers | Stable mgmt + billing + InCompass-maintained condition-book search; TJC/HISA data sync | Filter search, not eligibility math; no draw-in; no track side |
| **Race Trackr** ($125/mo) | Trainers | First searchable national condition book; save/assign/calendar planning UX; medication-withdrawal hand-off | No per-horse eligibility; continuity questionable ("Coming Soon" placeholder site) |
| **equineline Trainer Program** ($29.95/mo ≤20 horses) | Trainers | Interactive condition book + day-rate billing, official TJC data | Filter search only; dated |
| **Backstretch** ($10/mo) | Trainers | Push alerts on entries/works/results; multi-user stables | Post-draw only — alerts fire after the decision moment |
| **Stable Secretary / BarnManager / CRIO / Equicty / HorseLinc / Stablebuzz** | Sport-horse barns | Health records, billing/Stripe, owner portals, task boards | Zero racing features — confirms barn-ops and race-placement are separate markets; integrate, don't rebuild |
| **Ardex/Prism** (AUS) | Racing stables | Official racing-data feed into stable mgmt; ownership-%-split invoicing (claims 75% of top AU trainers) | AUS/NZ only; displays noms/acceptances *after* the trainer decided |
| **UK: BHA Racing Admin (Weatherbys)** | UK trainers | Online entries/decs since 2018; live entry counts on closing day; elimination-sequence transparency; reserves workflow; Weatherbys text alerts | Transactional only — no race finding, no forward-looking probability |
| **AUS: Racing Australia SNS / Stable Assist** | AU trainers | 24/7 national nominations/acceptances/gear/scratchings; SMS/email suite; receipts; single RA ID | Same: assumes the race is already chosen; no ballot position for everyday races |
| **Ship & Win / state-bred funds** (Del Mar, Colonial, KTDF, NY, Cal, PA, VA) | Trainers/owners | Real money: $5k checks + 40–50% purse bonuses; KTDF ~$27k avg supplement/race; Colonial free vans + $300/start trainer cash | Rules published as prose/PDF/JPEG; no structured data, no decision-time surfacing, no cross-track comparison, no ROI analytics |
| **Jockey tooling** (JockeyFinder NZ, JockeyHQ AU) | Agents/jockeys | Ride-offer state machines, availability calendars, audit trails | Nothing in the US at all; disconnected from entries — roadmap validation for PostParade |
| **Marketplace analogs** (Instawork, Wonolo, OpenTable/Resy, DAT) | — | Tiered dispatch by fit score; reliability scores gating access; standing "Notify" alerts; pay-on-fulfillment incentives; reverse prospecting (LaneMakers) | None expose fill probability to users — PostParade's draw-in display is novel even outside racing |

## 3. Trainer pain points, in their own words (ranked)

1. **Condition-book integrity collapse** — offices abandon book races and card ad-hoc
   extras; "can't plan races except stakes" (Barry Irwin, TDN).
2. **Races not filling / the extra-overnight limbo loop** — an unfilled race "is pushed
   back and listed as an extra," may reappear for weeks (West Point).
3. **Convoluted conditions defeat eligibility math** — Parx racing secretary Sal Sinatra:
   "Some of us — I'm one of them — have succumbed to playing with race conditions…"
4. **Opaque phone-based pre-draw intel** — offices selectively reveal who's in a race to
   make it fill (Linda Rice hearings; David Donk testimony).
5. **HISA administrative burden** — paperwork doubled for a 30-horse stable (Jason
   Barkley); enter-once data reuse is the antidote to yet-another-portal resistance.
6. **Vet's-list clearance friction** — documented race-day scratches waiting on
   clearance samples; needs an "earliest safe entry date" clock.
7. **Preference/AE opacity** — trainers can't see their standing under the date system
   before entering.

Fill-the-card economics (track side): US average field ~7.4–7.9 and falling; foal crop
down 44% since 2008; TDN elasticity: 10 starters ≈ +43% handle, 6 ≈ −58%. Ten
lack-of-entries cancellations in Sept 2025 alone.

## 4. Prioritized feature shortlist (Trainer-first)

| # | Feature | Persona | Priority | Demo? | Inspired by / beats |
|---|---|---|---|---|---|
| 1 | **Spot Alerts (Condition Watch)** — standing per-horse search; push the moment a matching race/extra/substitute appears, with entry-deadline countdowns | Trainer | P0 | ✅ built | Inverts Equibase Virtual Stable (entity→opportunity); Resy Notify + DAT saved-search |
| 2 | **True Purse / EV per start** — base purse + state-bred supplement + Ship & Win + trainer-paid bonuses − vanning, × draw-in probability | Trainer | P0 | ✅ built | Nothing surfaces incentives at decision time; DAT RateView analog |
| 3 | **Race Fill Board + fill probability** — every race: entries vs minimum, "will it go" score, hours-to-close; cancellation early warning | Track + Trainer | P0 | ✅ built | Digitizes the office whiteboard; beats IRO Rundown's raw counts |
| 4 | **Preference / cut-line transparency** — each entered horse's standing vs the field cap, AE band, and the cost of declining | Trainer | P0 | ✅ built | UK elimination-sequence panel, brought forward pre-entry |
| 5 | Targeted Request waves (tiered dispatch) with attached incentives | Track | P1 | partial (Requests exist) | Instawork tiered dispatch; Wonolo preferred lists |
| 6 | Deadline command center (noms/entries/scratch/registration deadlines incl. KTDF-style forfeitures) | Trainer | P1 | partial (closing rail) | Racing Australia daily deadline summary |
| 7 | Vet's-list clearance clock ("earliest safe entry date", HIWU SLA countdown) | Trainer | P1 | gate built; clock roadmap | IRO "HORSE ON A LIST" banner, made actionable |
| 8 | Extra/overnight lifecycle tracking (auto-follow unfilled races → "back as extra Thursday, needs 3") | Trainer | P1 | roadmap | West Point limbo loop |
| 9 | Owner read-only share ("where we plan to run and why" + auto-posted milestones) | Trainer→Owner | P2 | parked screens exist | TLore OwnerSync, TRM, Prism |
| 10 | Incentive publisher + ROI dashboard (cost per added starter, field-size lift) | Track | P2 | roadmap | Del Mar's internal math, productized |
| 11 | Starter Score (trainer reliability: entry-to-start rate, late scratches) gating early access | Both | P2 | roadmap | Instawork/QwickScore |
| 12 | Multi-track stall application + one PostParade identity across tracks | Trainer | P2 | roadmap | Inverts IRO per-track access friction |
| 13 | Condition demand testing (float draft conditions, see soft commits) | Track | P2 | roadmap | Attacks the 8-hours-to-card-8-races problem |
| 14 | Ownership-split fee itemization → QuickBooks export | Trainer | P3 | roadmap | Ardex/Prism stickiest feature |
| 15 | Rider slot on Submit → future agent workspace (offer state machine, audit trail) | Jockey (roadmap) | P3 | roadmap | JockeyFinder/JockeyHQ; UK booking-inside-declaration |

## 5. Demo picks built (F5)

1. **Spot Alerts + Deadlines rail** (`#trainer/alerts`) — standing searches per horse;
   feed of matched new races/extras with Submit buttons; deadline countdowns.
2. **True Purse / EV** — engine `truePurse(h, race, ctx)`: purse share + supplements +
   ship bonus, EV weighted by draw-in probability; surfaced on recs rows and the race
   builder.
3. **Fill probability** — engine `fillProbability(race, entries)`; chips on meet/raceday/
   builder; "cancellation risk" flag on the strength board.
4. **Cut-line panel** — trainer race view shows every entered horse ranked by the race's
   preference system with the draw-in cut line and AE band marked.

## 6. Insights for the pitch (evidence-backed)

1. The matching layer is unoccupied in every racing jurisdiction on earth; UK/AUS
   digitized the *transaction*, nobody owns the *decision*.
2. TJC now owns office + data + trainer stable management (TLore, Jul 2024) — the window
   for an independent matching layer is now; PostParade's data moat is trainer intent.
3. Field size is the industry's stated crisis (7.4 avg, −44% foal crop, handle
   elasticity ±50%) and tracks already pay millions in untargeted incentives — the
   track-side budget exists.
4. Trainer willingness-to-pay is thin ($10–30/mo tools; $125/mo failed) — monetize the
   track side (per-meet SaaS + pay-on-start incentive placement, OpenTable's $7.50/cover
   model), keep trainer-side cheap with free alerts as the acquisition wedge.
5. Convoy's lesson: be the software layer, never the principal. DAT paid ~$250M for the
   software layer — the position PostParade occupies beside Equibase/InCompass.
6. Go-to-market: sign a circuit/horsemen's association, not one track at a time (USTA
   harness proved breed-wide rails; per-track sales is why IRO stalled). A meet activates
   its circuit's trainers — the two-sided network forms per meet.

## 7. Fact-check corrections worth remembering

- "Prerace" does not exist (dead domain) — the niche is Race Trackr / TLore / equineline
  / Backstretch, all filter-search or post-draw.
- Stable Secretary has **no** Jockey Club integration (premise corrected).
- Prism has no permanent free tier ($30–150/mo modular); its "75% of top AU trainers" is
  vendor marketing.
- 1/ST is not wagering-only: Racehorse 360 serves its racing offices (safety-led).
- Virtual Stable horse/track alerts can be immediate; trainer/jockey/stakes digests are
  daily-only.
- Average field size: 7.40 (2023, Jockey Club) — worse than the ~7.86 often cited.
