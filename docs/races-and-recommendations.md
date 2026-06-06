# PostParade — Races & Recommendation Engine

**Design doc + data model.** Status: draft for review. Date: 2026-06-06.
Supersedes the three-persona framing in the current prototype where it conflicts.

This doc captures the direction from the trainer review: focus on **Trainer** and **Track**
workspaces, let the **Track build races** structured as **Weekend → Raceday → Race**, and
drive a **bidirectional recommendation engine** that both sides use to **Submit** (trainer → race)
or **Request** (track → horse) a horse — with **shipping bonuses** to attract ship-ins.

---

## 1. Scope change

| Area | Before (current `app.html`) | After (this doc) |
|---|---|---|
| Workspaces | Trainer, Owner, Racing Office | **Trainer, Track** (Racing Office = Track) |
| Owner | First-class workspace (`owner/*` screens, owner accent) | **Backlog**: future *guest access* — an owner views only their horses under one trainer. Keep the screens/accent code, drop from primary nav. |
| Races | Flat, illustrative cards | **Built by the Track**, organized Weekend → Raceday → Race, each fully spec'd |
| Matching | Two one-directional flows (trainer "Find next start"; office "Outreach") | **One engine, two entry points**: trainer **Submits**, track **Requests** |
| Shipping | Passive "ship-share" note | **Shipping bonus** as a first-class incentive on a race/raceday/weekend |
| Data | Hard-coded illustrative values | Schema grounded in Equibase/Brisnet fields; seedable from an open stand-in dataset now, real Equibase file later |

**Out of scope for now (backlog):** Owner workspace / guest access, billing & tax docs,
jockey-booking workflow, nightly condition-book PDF ingestion pipeline.

---

## 2. Personas & the core loop

Two parties who actually transact a race:

- **Track (racing office / racing secretary).** Builds the race card, wants every race to
  *fill* with a strong field. Pain: underfilled races, soft conditions, low handle.
- **Trainer.** Has horses that need a *spot*. Pain: reading conditions, checking eligibility,
  coordinating shipping, not missing the right race.

**The core loop is one matching problem viewed from two ends:**

```
        ┌─────────────────────────────────────────────┐
        │            Recommendation engine             │
        │   (eligibility gate + fit score + shipping)  │
        └─────────────────────────────────────────────┘
              ▲                              ▲
   "Find a spot for my horse"      "Find a horse for my race"
              │                              │
        TRAINER ── Submit ──►  RACE  ◄── Request ── TRACK
              │                              │
        creates a Submission         creates a Request
              └──────────► both become ENTRIES ◄────────┘
```

- **Submit** = trainer proposes one of their horses into a specific race.
- **Request** = track invites a specific (trainer's) horse into a race it needs to fill.
- A Request that the trainer accepts *becomes* a Submission. Both resolve into the race's
  entry list. Same scoring math underlies both views.

---

## 3. Information architecture (target nav)

**Track workspace**
- `track/weekend` — Weekend overview (racedays, fill health, shipping-bonus budget)
- `track/raceday` — A single raceday card; list of races + fill status
- `track/race/:id` — **Race builder / detail** (spec the race; see who fits; send Requests)
- `track/race/:id/requests` — Request outreach for a race (replaces today's `office/outreach`)
- `track/strength` — Field-strength trends (keep existing `office/strength`)

**Trainer workspace**
- `trainer/dashboard` — Stable; horses needing a spot (keep existing `dashboard`)
- `trainer/horse/:id` — Horse profile + fit profile (keep existing `horse/*`)
- `trainer/recs/:id` — **Recommended races** for a horse → **Submit** (extends existing `recs/*`)
- `trainer/race/:id` — Race detail from the trainer's POV (eligibility + Submit CTA)
- `trainer/requests` — Inbound **Requests** from tracks (accept → becomes a Submission)

**Shared tool**
- `parser-playground` — keep; it demonstrates turning condition text into a structured Race.

The existing hash router + per-workspace nav visibility in `app.html` already supports this;
this is mostly renaming `office/*` → `track/*`, removing `owner/*` from nav, and adding the
weekend/raceday/race-builder screens.

---

## 4. Data model

Entity relationships:

```
Track 1───* Weekend 1───* Raceday 1───* Race 1───* Entry
                              │            │
                ShippingBonus ┘            ├──* Submission ──┐
                (weekend/raceday/race)     ├──* Request ─────┤→ resolve to Entry
                                           └──* Recommendation (computed, per Horse)

Stable(Trainer) 1───* Horse 1───* PastPerformance
Horse *───* Race  (via Submission / Request / Entry)
```

Field specs below are grounded in the Equibase/Brisnet/TrackMaster layout (see §7). Codes are
kept short (don't pre-expand) to match what the real feed sends. Distances stored in **yards**
(negative = "about", per Brisnet convention) with a furlong/mile display helper.

### 4.1 Track
| Field | Type | Notes |
|---|---|---|
| `track_code` | string(3) | Equibase track code (e.g. `CD`, `KEE`, `BEL`) |
| `name` | string | Churchill Downs |
| `location` | {lat,lng,city,state} | for ship-distance math |
| `surfaces` | code[] | which of D/T/d/t/A this track offers |
| `meet` | {name, start, end} | e.g. "Summer meet" |

### 4.2 Weekend
| Field | Type | Notes |
|---|---|---|
| `id` | id | |
| `track_code` | fk | |
| `label` | string | "Jun 6–8" / "Belmont Stakes weekend" |
| `start_date` / `end_date` | date | |
| `racedays` | Raceday[] | |
| `shipping_bonus` | ShippingBonus? | optional weekend-wide ship-in incentive |
| `fill_health` | derived | avg projected field size, # underfilled races |

### 4.3 Raceday
| Field | Type | Notes |
|---|---|---|
| `id` | id | |
| `weekend_id` | fk | |
| `date` | date | |
| `status` | enum | `draft` \| `published` \| `closed` \| `run` |
| `races` | Race[] | |
| `shipping_bonus` | ShippingBonus? | optional raceday-wide incentive |

### 4.4 Race (the spec the Track builds)
The heart of "spec out a race." Mirrors the parsed-condition fields the prototype already shows.

| Field | Type | Notes |
|---|---|---|
| `id` | id | e.g. `cd-2026-06-06-r3` |
| `raceday_id` | fk | |
| `race_number` | int | |
| `post_time` | datetime | |
| `entry_close` | datetime | **separate source** from post time (see §7) |
| `surface` | code | D dirt, T turf, d inner-dirt, t inner-turf, A all-weather, s steeplechase |
| `distance_yards` | int | negative = "about"; display in f / m |
| `race_type` | code | S mdn-sp-wt, M mdn-clm, A alw, C clm, CO opt-clm, AO alw-opt-clm, N/G1/G2/G3 stakes, etc. |
| `race_classification` | string | human label ("Mdn 75k", "Alw N1X") |
| `purse` | money | + optional fund add-ons (e.g. KTDF) |
| `claiming_price` | money? | low/high if optional-claiming |
| `age_sex_restrictions` | code(3) | parsed age group + sex |
| `weights` | {base, by_age, allowances[]} | e.g. 3yo 118 / older 124; -2 NW since date |
| `conditions_text` | string(≤500) | raw condition language |
| `conditions_structured` | object | parsed eligibility rules (the parser output) |
| `preference` | string? | "has not started for < $50,000" etc. |
| `statebred_restriction` | code? | e.g. NY-bred only |
| `field_target` | {min, max} | desired field size (fill goal) |
| `status` | enum | `draft` \| `open` \| `filling` \| `closed` \| `drawn` \| `run` |
| `shipping_bonus` | ShippingBonus? | race-specific incentive (overrides raceday/weekend) |
| `entries` | Entry[] | resolved list |
| `projected_field` | derived | engine estimate from eligible+likely horses |

### 4.5 Horse
| Field | Type | Notes |
|---|---|---|
| `id` / `equibase_id` | id | |
| `name` | string | |
| `year_of_birth` + `foaling_month` | | derive `age` |
| `sex` | code | C/F/G/H/M/R |
| `color` | code | |
| `where_bred` + `statebred_flag` | | for state restrictions |
| `sire` / `dam` / `dam_sire` | string | pedigree (for first-timers / surface aptitude) |
| `owner` / `breeder` / `trainer` | fk/string | connections |
| `stable_id` | fk | which Trainer workspace owns the relationship |
| `home_track` | track_code | base location for ship-distance |
| `career` | record block | starts/wins/places/shows/earnings, lifetime + current/prev year |
| `surface_splits` | record blocks | distance / turf / wet / all-weather records |
| `best_speed` | {figure, surface, distance} | |
| `days_since_last` | int | freshness |
| `run_style` / `quirin_points` | | pace profile |
| `fit_profile` | derived | surface/distance/class/pace star ratings (already in prototype) |
| `past_performances` | PastPerformance[] | |
| `availability` | enum | `needs_spot` \| `pointed` (targeted at a race) \| `entered` \| `resting` \| `vet_hold` |

### 4.6 PastPerformance (one per prior start)
| Field | Type | Notes |
|---|---|---|
| `race_date` / `days_since_previous` | | |
| `track_code` / `race_number` | | |
| `surface` / `distance_yards` / `track_condition` | | |
| `race_type` / `race_classification` / `purse` / `claiming_price` | | class context |
| `post_position` / `field_size` | | |
| `finish` / `beaten_lengths` | | |
| `weight_carried` / `equipment` / `medication` / `odds` | | |
| `jockey` / `trainer` | | |
| `bris_speed` / `speed_rating` / `track_variant` | | figures |
| `pace_figs` | {2f,4f,6f,8f,10f,late} | running style evidence |
| `trip_comment` | string | |

### 4.7 ShippingBonus
| Field | Type | Notes |
|---|---|---|
| `id` | id | |
| `scope` | enum | `weekend` \| `raceday` \| `race` (race overrides raceday overrides weekend) |
| `amount` | money | flat award (e.g. $1,500 ship-in bonus) |
| `eligibility` | object | `{ ship_in_only: true, min_distance_mi: 200, from_outside_state?: bool, exclude_tracks?: [] }` |
| `cap` | {per_horse?, total_budget?, claimed_so_far} | budget tracking |
| `funded_by` | enum | track / purse-supplement / state-fund |
| `status` | enum | `active` \| `exhausted` \| `expired` |

### 4.8 Submission (trainer → race)
| Field | Type | Notes |
|---|---|---|
| `id` | id | |
| `race_id` / `horse_id` / `stable_id` | fk | |
| `source` | enum | `trainer_submit` \| `from_request` (accepted Request) |
| `status` | enum | `proposed` \| `submitted` \| `drawn_in` \| `also_eligible` \| `scratched` \| `declined` |
| `jockey` | string? | named or TBD |
| `fit_score` | int | snapshot of the recommendation at submit time |
| `shipping_bonus_applied` | bool + amount | if the horse qualifies |
| `note` | string | trainer rationale (shown to track) |
| `created_at` / `updated_at` | | |

### 4.9 Request (track → horse)
| Field | Type | Notes |
|---|---|---|
| `id` | id | |
| `race_id` / `horse_id` / `stable_id` | fk | who the track is asking |
| `status` | enum | `sent` \| `accepted` \| `declined` \| `expired` |
| `acceptance_likelihood` | int | engine estimate (the "Likely yes · 88%" pill) |
| `channel` | enum | in-app / email / sms |
| `message` | string | personalized template |
| `expires_at` | datetime | typically entry-close |
| → on accept | | spawns a Submission with `source = from_request` |

### 4.10 Recommendation (computed; not stored long-term)
The engine output for a (Horse, Race) pair — see §5.
```
{ horse_id, race_id, eligible: bool, eligibility_reasons: [{rule, pass, detail}],
  fit_score: 0..100, components: {distance, surface, class, speed, freshness, connections,
  field_strength}, shipping: {distance_mi, ship_in: bool, bonus_amount, feasible},
  acceptance_likelihood: 0..100,  // only meaningful for the Track/Request view
  why: "human explanation string" }
```

---

## 5. Recommendation engine

One function, both directions: `score(horse, race) → Recommendation`.

**Step 1 — Eligibility gate (hard pass/fail).** Validate the horse against the race's
`conditions_structured`: age, sex, maiden/win conditions, claiming eligibility, state-bred
restriction, preference tier. Anything failing → `eligible: false` with the failing rule named
(auditable, as the prototype already shows). Ineligible horses are filtered from recommendations
but can be surfaced as "near-miss" with the reason.

**Step 2 — Fit score (0–100), weighted blend of components:**

| Component | Signal | Weight (initial) |
|---|---|---|
| Distance fit | horse's sweet-spot vs race distance | 20 |
| Surface fit | record by surface | 15 |
| Class fit | par/class rating vs race level (drop vs jump) | 25 |
| Speed | best/recent BRIS speed vs projected par | 15 |
| Freshness | days-since-last vs ideal window | 10 |
| Connections | trainer (and jockey) win% at this type/track | 10 |
| Field strength | softer projected field ⇒ better spot | 5 |

(Weights are tunable; expose as constants so they can be calibrated against real results later.)

**Step 3 — Shipping.** Compute ship distance from `horse.home_track` to the race track. If a
ShippingBonus applies and the horse qualifies (ship-in, min distance, etc.), attach the bonus and
surface it prominently. Ship distance also feeds a soft feasibility factor (very long, no-bonus
ships are deprioritized for the trainer view).

**Step 4 — Acceptance likelihood (Track/Request view only).** Estimate the probability the
trainer says yes: fit_score + the trainer's recent activity/preferences at this race type +
ship feasibility + whether a shipping bonus sweetens it. This is the "Likely yes · 88%" signal in
the existing outreach screen.

**Two query directions over the same engine:**
- **Trainer (Submit):** fix the horse, rank open races → "Top spots for {horse}". CTA: **Submit**.
- **Track (Request):** fix the race, rank eligible horses not yet entered → "Horses that fit
  R3, sorted by acceptance likelihood". CTA: **Request**.

---

## 6. State machine (Submit / Request → Entry)

```
RACE:  draft ─► open ─► filling ─► closed ─► drawn ─► run

Trainer path:
  (engine recommends) ─► Submit ─► Submission{submitted}
        └─ track draws field ─► {drawn_in | also_eligible | scratched}

Track path:
  (engine recommends) ─► Request{sent}
        ├─ trainer accepts ─► Submission{submitted, source=from_request}
        ├─ trainer declines ─► Request{declined}
        └─ entry_close passes ─► Request{expired}

Both Submissions feed RACE.entries; on "drawn" the field is finalized.
```

Notifications: trainer gets inbound Requests in `trainer/requests`; track sees incoming
Submissions update fill health on the weekend/raceday/race screens in real time.

---

## 7. Data sourcing plan

**What we're waiting on:** Equibase free sample dataset — registration done, awaiting emailed
download link (https://www.equibase.com/handicappersdata.cfm). Real formats:
- **Result charts** → CSV + XML
- **Past performances** → TrackMaster XML (with XML schema)
- **Condition books** → **PDF** (per-meet). ⚠️ Condition books are *not* a clean feed — this is
  why we keep the condition **parser**: PDF/condition text → structured `Race`.
- ⚠️ Equibase PP/chart data exposes **post time**, not **entry-close time**. `entry_close` must
  be sourced from the condition book / overnight, modeled as its own field (§4.4).

**Usable now (stand-in), in priority order:**
1. **`eprochasson/horserace_data`** (GitHub, Apache/open, `git clone`, no login) — HKJC +
   Singapore as gzipped CSVs. Fastest to wire up for horse/result/PP shapes.
2. **JCapper free `.JCP` sample weekend** (http://www.jcapper.com/commadelimiteddatafiles.asp) —
   the real ~1,435-field comma-delimited **DRF-equivalent** layout (rename `.JCP`→`.csv`).
   Best for validating our parser/field mapping against the *actual* Equibase/Brisnet structure.
3. **Kaggle `gdaley/hkracing`** — cleanest two-table schema (`races.csv`, `runs.csv`) but
   login-gated.

**Field-spec references (for the mapping layer):**
- Brisnet structure index — https://www.brisnet.com/cgi-bin/static.cgi?page=structures
- Archived Brisnet field layout (numbers/types/lengths) —
  http://web.archive.org/web/20161010174928/http://www.brisnet.com/cgi-bin/static.cgi?page=drfmff
- `karera-drf` Avro IDL (Apache-2.0, field-by-field map) — https://github.com/Bettorware/karera-drf

**Recommendation:** seed the prototype from `eprochasson/horserace_data` now, build a thin
adapter (`raw row → PostParade entity`), and keep the field names/codes aligned to Brisnet so
swapping in the Equibase file later is a new adapter, not a remodel.

---

## 8. Build plan (for `app.html`, next session)

Single-file, CDN-Tailwind, hash-router prototype — same conventions as today. Phased so each
step is demoable to the trainer:

1. **Demote Owner.** Remove `owner/*` from sidebar nav; rename "Racing Office" → **Track**
   throughout; keep `owner/*` screens + accent code parked for the guest-access backlog.
2. **Track race-builder.** New screens: `track/weekend`, `track/raceday`, `track/race/:id` with
   an editable race spec form (surface, distance, type, purse, conditions → live parser).
3. **Recommendation engine module.** Extract a JS `score(horse, race)` + sample horse/race seed
   data; render both directions (trainer recs reuse; track "who fits" list reuses outreach).
4. **Submit / Request actions.** Wire the two CTAs to a shared in-memory entry list + the state
   machine; reflect fill health on weekend/raceday.
5. **Shipping bonus.** Add the bonus object to weekend/raceday/race; surface qualifying bonus in
   both recommendation views and in the Request message template.
6. **Seed real-ish data.** Swap illustrative values for an adapter over the stand-in dataset.

---

## 9. Open questions

- **Field-target / draw rules:** do tracks want PostParade to model also-eligibles and the
  actual draw (preference tiers, MTO) or just project fill? (Affects Race.status granularity.)
- **Shipping-bonus funding:** who funds it (track, purse supplement, state fund) and is the
  budget per-race or pooled per-weekend? Affects the cap model in §4.7.
- **Multi-track circuit:** does a Trainer see races across many Tracks (cross-track recs) in v1,
  or one Track at a time? The engine supports cross-track; the nav needs a track filter if so.
- **Identity:** align on `equibase_id` as the canonical horse key for when the real feed lands.
