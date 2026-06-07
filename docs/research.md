# PostParade — Domain Research

**Purpose.** Ground the product in how Thoroughbred racing offices and trainers
*actually* operate, with correct terminology, real workflow order, and the
mechanics we had not yet considered. This feeds [`plan.md`](../plan.md) and
corrects parts of [`races-and-recommendations.md`](./races-and-recommendations.md)
(notably the "weekend" naming and the missing preference/draw layer).

**Date:** 2026-06-07. **Scope:** North American Thoroughbred racing (US/Canada).
Practices vary by jurisdiction and by track house rules, and medication/vet rules
are now largely federalized under **HISA** — always confirm against a specific
track's current condition book + state commission rules.

**Sourcing note.** Synthesized from track/association glossaries (NYRA/Saratoga,
Pennsylvania HRA, TOC), regulators (KHRC, AGCO, Oregon RC), the Jockey
Club/InCompass/Equibase, and trade press (TDN, BloodHorse, Paulick, DRF). Key
URLs are inline; a consolidated list is at the end. Where a claim varies by
jurisdiction it is flagged.

---

## TL;DR — what this changes about the product

1. **"Race weekend" is not an industry unit. Use _Meet_ as the structural top
   container, surfaced in the UI as _"Event."_** Multi-day marquee racing
   (Breeders' Cup, Derby week, a stakes "festival weekend") is a **Festival** —
   a *named grouping of race days inside a meet* — not a top-level type. A
   one-day or multi-day event is the **same primitive** (a Festival with 1..N
   cards). ⇒ rename `Weekend` → `Meet`/`Event`, add an optional `Festival`
   overlay, keep `Race Day` and `Race`.
2. **Getting into a race is not first-come — it's preference-ranked.** The
   **preference/date ("stars") system** decides who draws into an oversubscribed
   race, and **also-eligibles (AE)** wait for scratches. We modeled eligibility
   (can this horse enter?) but not *draw-in probability* (will it actually get
   in?). That's a core trainer anxiety and a strong recommendation signal.
3. **"Shipping bonus" has a real name: _Ship and Win_** — a flat appearance check
   **plus** a % purse bonus, with specific eligibility (shipped from out of
   state, hasn't raced in-state recently, first-timers/stakes excluded). Model
   purse incentives as stackable programs, not an ad-hoc field.
4. **The condition ladder and conditions language are precise** (MSW, Mdn Clm,
   Clm, Opt Clm, Starter Alw, Alw N1X/N2X…, Hcp, Listed, G3/G2/G1, state-bred).
   The "non-winners of N other than" logic is the highest-value eligibility math.
5. **Stakes run on a long-lead lifecycle** (nominations → sustaining payments →
   supplementary noms → entry), distinct from the rolling condition-book races.
   Two cadences. "Win and You're In" (Breeders' Cup Challenge) is the marquee
   campaign mechanic.
6. **We sit _beside_ InCompass + Equibase**, the incumbent racing-office system
   and data layer — not replace them.

---

## Part A — How racing is organized over time (the "weekend" question)

### The canonical hierarchy

```
MEET (meeting)         a track's defined, licensed racing period (Keeneland Fall Meet 2026)
  └─ RACE DAY          one calendar date of live racing
       └─ CARD/PROGRAM the full slate of races that day (synonyms)
            └─ RACE     a single contest with its own conditions, purse, grade
```

- **Meet / meeting** is the top organizing unit — a continuous, **state-licensed**
  block of dates at one track, with its own condition-book cycle and stall
  application. Tracks run several meets a year (Keeneland *Spring*/*Fall*;
  Saratoga *summer meet*). It's the only word that spans a 1-day showcase to a
  46-day Saratoga meet.
  ([Wikipedia glossary](https://en.wikipedia.org/wiki/Glossary_of_North_American_horse_racing),
  [West Point TB](https://www.westpointtb.com/the-condition-book-how-it-works-and-types-of-races-for-thoroughbred-racehorses/))
- **Card = Program** = one day's races. **Race** is the atomic contest.
  ([Equibase glossary](https://www.equibase.com/newfan/glossary-full.cfm))
- **Dark day** — a date inside a meet's span with no live racing (e.g.,
  Mon–Wed at a Thu–Sun meet).

### Where the marketing words fit (these are NOT structural levels)

"Opening/closing weekend," "stakes day," "signature day," "festival,"
"championship" are **labels for a sub-grouping of cards inside a meet**, applied
for promotion. When a track bundles a Fri–Sun block it *brands* it
("Fall Stars Weekend," "July 4th Racing Festival") — it becomes a named
**Festival**, never a generic "weekend." The day/card is the primary unit; tracks
only group days when there's a marketing reason.

| Event | Official framing | Days | Notes |
|---|---|---|---|
| **Breeders' Cup** | "World **Championships**" — a roaming championship *event* hosted within a host track's meet | **2** (two-day since 2007) | 14 G1s, $30M+. Fri = "Future Stars Friday" (juveniles); Sat = championships. The one case where the *event* arguably outranks the host meet. ([Wikipedia](https://en.wikipedia.org/wiki/Breeders%27_Cup)) |
| **Kentucky Derby/Oaks** | A *week* inside Churchill's **Spring Meet**; Oaks (Fri) + Derby (Sat) | 2 headline cards | Marquee days within a longer meet. |
| **Saratoga** | "**Summer meet**" | 46 days / ~10 wks | Opens with a branded "July 4th Racing Festival"; marquee single days "Whitney Day," "Travers Day." |
| **Keeneland** | "**Fall Meet**" (boutique) | 17 days | Opens with "**Fall Stars Weekend**" — 3 cards, 11 stakes, 8 of them BC Challenge races. |
| **Royal Ascot** (UK) | "Royal **Meeting**" | 5 | ~18 Group races; one+ marquee G1/day. |
| **Cheltenham** (UK) | "**Festival**" (jumps) | 4 | Climaxes in the Gold Cup. "Festival" is the dominant UK word. |
| **Dubai World Cup** | "World Cup **night**" | 1 card | 9 graded races, $30.5M. |

### Recommendation (naming)

Store the industry-correct term, surface the approachable alias:

| Concept | Data model (internal) | UI label | Why |
|---|---|---|---|
| Top container | **Meet** | **"Event"** | "Meet" is correct and spans 1-day→10-week; "Event" reads better to non-experts. |
| Multi-day marquee block | **Festival** (a.k.a. Feature) | "Festival" / "Big Weekend" | Correct home for "Derby week," "Fall Stars Weekend," "Breeders' Cup." A *named set of cards*, 1..N. |
| One day's races | **Card** | **"Race Day"** | Card/Program is standard; "Race Day" is friendliest. |
| One contest | **Race** | "Race" | Universal. |

**Model one-day and multi-day identically:** a Festival is an ordered set of
Cards (1..N). Dubai night = 1 card; Breeders' Cup = 2; Royal Ascot = 5. No
separate "weekend" type. A standalone showcase not tied to a host meet = a Meet
whose only child is one Festival.

> **→ Design implication.** Rename the prototype's `Weekend` to `Meet`. Keep
> `Race Day` and `Race`. Add an optional `Festival` grouping over race days
> (default off — most racing is ordinary condition-book days). This research
> recommended "Event" as a softened UI alias, but **the decision (see
> [`plan.md`](../plan.md) §9) is to use the real term "Meet" in the UI too.**

---

## Part B — Building / writing races (Track side)

### The racing office

The **racing secretary** runs the racing office: *writes the races* ("**carding**"),
assigns weights in handicaps, allots stalls, and is on the hook to **fill the
card**. ([TOC Racing Office](https://toconline.com/publicationsmedia/article-archives-2/racing-your-horse/racing-office))
Outputs:

- **Condition book** — booklets of the *conditions* of races over a rolling
  ~2–3 week window; the trainer's planning document, released ~1 week before
  the first listed day. ([PennHorseRacing](https://pennhorseracing.com/glossary/condition-books/))
- **Overnight** — the official entries sheet for a race day, published **after
  the draw** (so named because it comes the day before): all races, drawn
  horses, posts, weights, riders, AEs, MTOs, and extras.
  ([Equibase overnights](https://www.equibase.com/static/horsemen/horsemenareaON.html))
- **Extras** — substitute races for which entries are *actually taken*, used only
  if a carded race fails to fill.
- **Stakes schedule / stakes book** — advance-published list of the meet's
  stakes with nomination/closing dates (see Part D lifecycle).

### The class ladder (exact race types + codes)

Lowest → highest class; codes match Brisnet/Equibase data:

| Type | Code | Meaning |
|---|---|---|
| Maiden Special Weight | `S` / MSW | Never-won, not claimable, weights by age/sex. Entry point for better stock. |
| Maiden Claiming | `M` | Never-won, claimable at a tag. A step below MSW. |
| Claiming | `C` | Any starter may be claimed (bought) for the tag. ~70% of NA races. |
| Optional Claiming | `CO`/`AO` | Run **either** for a tag **or** under an allowance condition (no sale). |
| Starter Allowance | `R` | Allowance restricted to horses that **started** for ≤ a stated claiming price within a period; not claimable. |
| Allowance | `A` | Non-claiming above maiden; weights "allowed off" by condition. Climbs the **non-winners ladder** ↓. |
| Handicap | `Hcp` | Secretary assigns weights by ability to equalize chances. |
| Stakes — Listed | `N` | Black-type, ungraded. |
| Stakes — Graded | `G3`/`G2`/`G1` | Graded by the American Graded Stakes Committee; can move up/down. |
| State-bred restricted | (flag) | Parallel ladder limited to in-state-bred horses. |

**The non-winners ("other than") ladder — the highest-value eligibility math:**
- **N1X / NW1X** = "non-winners of **one** race **other than** maiden, claiming,
  or starter." For a horse that broke its maiden but hasn't won an allowance.
- **N2X / N3X** = non-winners of two/three such races — the horse climbs as it
  wins. Written in data like `ALW90000N1X`.
- **N1Y** = non-winners of one *in a time window*; **N$Y** = non-winners of a
  *dollar amount* in a window; **N2L** = not won >2 races lifetime, any type.
- **Crucially: maiden and claiming wins don't count; restricted/state-bred wins
  generally don't count against open-company conditions.**
  ([PennHorseRacing](https://pennhorseracing.com/stories/racing-classes-thoroughbred-racing/),
  [West Point TB](https://www.westpointtb.com/the-condition-book-how-it-works-and-types-of-races-for-thoroughbred-racehorses/))

### Weights, allowances, purse, funds

- **Weights** — base by **scale of weights** (age/sex/distance/time of year),
  modified by conditions. **Allowance (weight)** = pounds a horse may *not* carry
  for failing a condition ("NW since [date] allowed 3 lbs"). **Apprentice
  allowance ("bug")** ≈ 10/7/5 lbs by experience (varies by jurisdiction).
- **Purse** = handle takeout + (in many states) gaming/HHR revenue +
  **state-bred/breeder development funds**. E.g., **KTDF** supplements purses for
  KY-sired & KY-foaled horses **registered before close of entries**; ~$41M/yr.
  Every racing state has an analogous fund (NY Fund, Cal-bred, PA-bred…) with
  distinct eligibility — model as **pluggable per-jurisdiction supplement
  programs**. ([KHRC](https://khrc.ky.gov/newstatic_info.aspx?static_id=167))

### Fill vs. short — the racing office's KPI

A race **"fills"** when it gets enough entries to run (min often 6–8); otherwise
it **"doesn't fill" / goes short** and is dropped (an **extra** may replace it).
**Field size drives handle** — more runners → more bet combinations → more wagering
— so **maximizing average field size is the office's primary KPI**. Del Mar
credits its Ship-and-Win program for ~8.7 runners/race.
([HRN](https://www.horseracingnation.com/news/Del_Mar_raises_incentives_in_ship_and_win_program_123))

> **→ Design implication.** The race-builder already covers type/surface/distance/
> purse/conditions. Add: a **class-ladder enum** with the codes above; structured
> **non-winners conditions** as the core eligibility predicate; **purse =
> base + stackable supplement programs**; and frame the Track's whole UI around
> **field-size/fill health** as the KPI (we already started this).

---

## Part C — Entries, the draw & day-of (the layer we under-modeled)

### Canonical step order

```
1. Stall application → stall assignments        (pre-meet; sets the horse inventory)
2. Condition book published                     (~1 wk before; new book each ~2–3 wks)
3. Entries taken ("the box is open")            trainers enter; office checks eligibility/weight
4. Entries close                                48–72 hrs before race day (track house rule)
5. THE DRAW                                      posts assigned randomly; PREFERENCE decides who's
                                                 in the body vs. the also-eligible list
6. Eligibility cross-check                       vs. vet's/starter's/stewards' lists
7. Overnight published                           day before: field, posts, riders, AEs, MTOs
8. Scratch time                                  withdraw deadline (race-day AM or day before)
9. Also-eligibles draw in                        as scratches open spots — in draw order, outside posts
10. Final field set → race runs
```
([TOC](https://toconline.com/publicationsmedia/article-archives-2/racing-your-horse/racing-office),
[AGCO Ch. 6](https://www.agco.ca/en/horse-racing/rules-thoroughbred-racing/thoroughbred-chapter-6-entries-and-subscriptions))

### Preference / the "stars" / date system — the big miss

When **more horses enter than a race can hold**, preference (not first-come)
decides who gets in. The common **date system**: "the horse that has started most
recently is the **least preferred**" — horses that haven't run recently, or that
hold an earned **star** (e.g., from entering a race that didn't fill), get
priority. Maryland uses E/R/S preference dates (E>R>S), tie-broken by state-bred
status and stabling; a horse that re-enters but doesn't draw in **keeps its
preference date**. Implementation varies by track.
([TOC](https://toconline.com/publicationsmedia/article-archives-2/racing-your-horse/racing-office),
[MTHA](https://www.mdhorsemen.com/misc-pages/mtha-preference-date-system))

> This is a major trainer anxiety ("will my horse even draw in?") and a strong
> signal we don't yet use. **Draw-in probability** belongs in the engine.

### Other first-class entry attributes

- **Also-eligible (AE)** — entered + drawn but on a waiting list; starts only if
  scratches reduce the field below the cap. AEs draw in *in original order*,
  taking *outside* posts.
- **Main-Track-Only (MTO)** — entered for a turf race; runs **only if the race
  comes off the turf** to dirt. A backup mechanism.
- **Scratch time** — deadline to withdraw (race-day morning ~scratch time, or
  the morning before; varies). A scratch is generally irrevocable.
- **Coupled entry / mutuel field** — common-owned (sometimes common-trained)
  horses bet as one interest (1 & 1A). **Many states have decoupled** — model as
  a per-jurisdiction flag.
- **Vet's list** — bars a horse from entry (unsoundness, bleeding/EIPH,
  shockwave, recency); removable **only by the listing authority**, usually after
  a published workout/exam. **Gates entry entirely.**
- **Lasix / HISA** — furosemide permitted within 48h **except 2yos and stakes**;
  a horse on the bleeder list must keep racing on Lasix; removal → ineligible
  ~30 days (state-varying). ([HISA FAQs](https://hisaus.org/faqs))
- **Equipment changes** (blinkers on/off, etc.) must be **declared at entry** and
  are published — material handicapping signals.
- **First-time angles** — first-time starter, first Lasix, first blinkers, first
  off the claim, first off a layoff. Key features.

> **→ Design implication.** Make **preference state**, **AE**, **MTO**,
> **vet's-list status**, and **medication/equipment** first-class fields on Horse
> and Entry. The eligibility gate must include vet's-list + medication
> constraints, and the engine should output a **draw-in probability** alongside
> fit. An **Overnight** view (read-only field + posts + AEs) is the natural Track
> artifact once entries close.

---

## Part D — Interactions with trainers (recruiting, placement, campaigns)

This is where **Submit / Request** lives. The same matching, two sides.

### Track side — recruiting to fill

Today this is **phone/text**: the secretary, staff, and a dedicated **recruiter /
stakes coordinator** call trainers and jockey agents to solicit entries into
slow-filling races. Goal: competitive, full fields.
Incentives (these are real and named):

- **Ship and Win** — *the* "shipping bonus." Del Mar model: a **guaranteed
  appearance check** (~$4–5k) for a qualifying out-of-state horse's **first
  start**, **plus a 40–50% bonus on purse earnings** for that and later meet
  starts. Eligibility: **last start out of state**, **not raced in-state ~12
  months**, **first-timers and stakes excluded**. Purpose: boost field size.
  ([TDN](https://www.thoroughbreddailynews.com/del-mars-ship-and-win-program-to-again-boost-summer-purses-along-with-maiden-dirt-bonus/))
- **Shipping stipend / van allowance** — a flat per-horse travel payment (e.g.
  $800), distinct from Ship-and-Win.
- **Maiden bonus / purse supplement** (e.g., Del Mar Maiden Dirt Bonus, +20%).
- **Stall & nomination incentives** — preferential stalls for trainers who
  support the meet; reduced/early nomination fees.

> Our "shipping bonus" should be renamed/modeled as a **Ship-and-Win program**
> (flat check + % purse, with eligibility predicates) — a stackable purse program,
> not a single number.

### Trainer side — placing / spotting

- **The condition book is the trainer's bible.** Placement = **"spotting"** /
  **"finding a spot"**: choosing the race where the horse is most competitive
  (right class, distance, surface, field, conditions). **Class moves**: *dropping
  down* (easier, to win/find the bottom) vs *moving up*.
  ([BloodHorse: Nolan Ramsey](https://www.bloodhorse.com/horse-racing/articles/278345/bloodhorse-interview-trainer-nolan-ramsey))
- **Placement workflow:** assess the horse → scan conditions it fits → shortlist
  1–2 targets + a backup ("if it doesn't fill" / "if it comes off the turf") →
  confirm eligibility → get owner approval → enter.

### Trainer side — campaign planning

- **Campaign** — a planned sequence of races toward target(s). **Point to** a
  race (back-plan prep from the target date); **prep race**; **spacing**;
  **layoff** (61+ days); **freshen** (~36–60 days).
  ([EquinEdge race spacing](https://equinedge.com/glossary/key-factors/race-spacing))
- **Stakes pipeline** (long-lead, paid): **stakes schedule** → **nomination**
  (often free; Preakness a notable paid exception) → **sustaining/interim
  payments** to keep eligible → **supplementary nomination** (late, expensive) →
  entry. **"Win and You're In"** = Breeders' Cup **Challenge Series**: winning a
  designated race earns an automatic **berth** + paid fees (+ travel allowance).
  ([Breeders' Cup](https://breederscup.com/races/how-it-works))

### Trainer side — riders & logistics

- **Naming a rider** — engaging a jockey, booked via **jockey agents** who manage
  the **book**. **"The call"** = a rider's commitment; agents resolve **conflicts**
  when two trainers want the same rider (first/contractual call wins).
- **Logistics** — **ship-in** (van to another track), **stall application** to get
  on the grounds, and the **distance/cost gap**: a better spot at a distant track
  must justify van cost + risk — exactly what Ship-and-Win exists to bridge.
- **Owner approval** — the trainer proposes the spot (and any ship/claiming-tag/
  nomination cost); the **owner approves entering**. Entry authority traces to the
  owner. (Owners are out of product scope but this interaction is real → the
  future "guest access.")

### Trainer pain points (our wedge)

- Condition book is a **static PDF**, ~2 weeks, no auto-matching of *their*
  horses' eligibility (N-conditions, preference, state-bred) to conditions.
- **Eligibility math is error-prone** (which wins count for N1X vs N2X).
- **Preference uncertainty** — can't know if a horse draws in until the draw.
- **Comms are phone/text** with the office and agents in a narrow morning window.
- **Data is siloed** (Equibase/Brisnet PPs, DRF Formulator, condition PDFs).

> **→ Design implication.** Submit (trainer→race) and Request (track→horse) are
> the digital version of the morning phone calls. The trainer-side wedge is
> **auto-matching their horses to fitting conditions + computing eligibility AND
> draw-in odds**. Campaign planning ("point a horse to a target," prep spacing,
> stakes nomination reminders) is a strong Phase-2 trainer feature. Rider naming +
> agent conflict is real but can stay lightweight (named/TBD) for the MVP.

---

## Part E — Things not yet considered (gaps to fold into the plan)

1. **Draw-in probability (preference).** Eligibility ≠ getting in. Add a
   preference model + a "likely to draw in" signal. (Part C)
2. **Vet's list / medication gating.** A horse can be perfectly eligible by
   conditions yet barred. Add as a hard gate. (Part C)
3. **Also-eligible & MTO strategy.** Backups when a race overfills or comes off
   the turf — surface these instead of treating a race as binary in/out.
4. **Stakes nomination lifecycle (two cadences).** Long-lead stakes (noms →
   sustaining → supplement → entry) vs rolling condition-book races. The
   Track's stakes schedule and the trainer's "point to" planning both need it.
5. **State-bred parallel ladder.** Restricted races/funds expand placement
   options; restricted wins don't count against open conditions.
6. **Coupled entries / decoupling.** Per-jurisdiction; affects field count.
7. **Field-size-as-KPI framing.** Make the Track's success metric explicit
   (avg field size, underfilled count, handle proxy).
8. **HISA + jurisdictional variance.** Entry-close hours, scratch times,
   preference codes, state funds, Lasix rules all vary — keep them configurable
   per track, not hard-coded.
9. **Interop reality.** **InCompass** (Jockey Club's Track Manager + Interactive
   Racing Office) is the incumbent racing-office system; **Equibase** is the
   official data layer (charts, PPs, codes, horseman's page). We **sit beside**
   them — import Equibase-shaped data, don't try to replace the office of record.
   ([InCompass](https://www.incompass-solutions.com/), [Equibase](https://www.equibase.com/))
10. **Condition books are PDF; entry-close ≠ post time.** Keep the condition
    parser; source `entry_close` separately (already noted in the data-model doc).

---

## Consolidated glossary

| Term | Meaning |
|---|---|
| Meet / meeting | A track's licensed, continuous racing period; the structural top unit. |
| Card / program | One race day's full slate of races. |
| Festival / signature weekend | A *named* multi-day grouping of cards inside a meet (marketing, not licensing). |
| Dark day | A non-racing date within a meet's span. |
| Racing secretary | Runs the racing office; writes races, assigns weights, allots stalls, fills the card. |
| Condition book | Rolling booklet of upcoming race conditions; the trainer's planning bible. |
| Overnight | Official post-draw entries sheet for a race day. |
| Extra | Substitute race used only if a carded race fails to fill. |
| Conditions | A race's eligibility rules (age/sex/wins/earnings/claiming/surface/distance/weight). |
| MSW / Mdn Clm / Clm / Opt Clm / Starter Alw / Alw / Hcp / Stakes | The class ladder (low→high). |
| N1X / N2X / N1Y / N$Y / N2L | Non-winners "other than" conditions (which wins count is the key logic). |
| Scale of weights | Standard weights by age/sex/distance/season. |
| Apprentice allowance ("bug") | Weight concession for an inexperienced jockey (~10/7/5 lbs). |
| KTDF / state-bred funds | Purse supplements for in-state-bred horses; per-jurisdiction rules. |
| Fill / go short | Get enough entries to run / fail to and be dropped. |
| The draw | Random post-position assignment after entries close. |
| Preference / date / "stars" | Ranks who draws into an oversubscribed race (not first-come). |
| Also-eligible (AE) | Entered + drawn but waitlisted; starts only on scratches. |
| Main-track-only (MTO) | Turf entrant that runs only if the race comes off the turf. |
| Scratch / scratch time | Withdraw a horse / the deadline to do so. |
| Coupled entry | Common-owned horses bet as one interest; often decoupled now. |
| Vet's list | Bars a horse from entry until removed by the listing authority. |
| Lasix / bleeder list / HISA | Anti-bleeding medication; federalized medication framework. |
| Spotting / placing / "a spot" | Choosing the right race for a horse. |
| Point to / prep / layoff / freshen | Campaign-planning terms toward a target race. |
| Nomination / sustaining / supplementary | The staged, paid stakes-eligibility lifecycle. |
| Win and You're In | Breeders' Cup Challenge — win a designated race → automatic berth. |
| Naming a rider / the call / jockey agent | Engaging a jockey; commitment; the agent who books mounts. |
| Ship-in / Ship and Win / van allowance | Vanning to another track / the bonus program / flat travel pay. |
| InCompass / Equibase | Incumbent racing-office system / official data layer — we interoperate. |

## Sources

- Equibase: [glossary](https://www.equibase.com/newfan/glossary-full.cfm) ·
  [codes](https://www.equibase.com/newfan/codes.cfm) ·
  [overnights](https://www.equibase.com/static/horsemen/horsemenareaON.html) ·
  [condition books](https://www.equibase.com/static/horsemen/horsemenareaCB.html)
- TOC: [racing office](https://toconline.com/publicationsmedia/article-archives-2/racing-your-horse/racing-office) ·
  [condition-book terms](https://toconline.com/resources/owner-handbook/appendices-charts-and-sample-forms/definitions-of-common-condition-book-terms/)
- West Point TB: [condition book & race types](https://www.westpointtb.com/the-condition-book-how-it-works-and-types-of-races-for-thoroughbred-racehorses/)
- Pennsylvania HRA: [racing classes](https://pennhorseracing.com/stories/racing-classes-thoroughbred-racing/) ·
  [also-eligible](https://pennhorseracing.com/glossary/also-eligible/)
- AGCO: [Thoroughbred Ch. 6 — Entries & Subscriptions](https://www.agco.ca/en/horse-racing/rules-thoroughbred-racing/thoroughbred-chapter-6-entries-and-subscriptions)
- MTHA: [preference date system](https://www.mdhorsemen.com/misc-pages/mtha-preference-date-system)
- KHRC: [KTDF](https://khrc.ky.gov/newstatic_info.aspx?static_id=167)
- HISA: [FAQs](https://hisaus.org/faqs)
- DRF: [glossary](https://www1.drf.com/help/help_glossary.html)
- EquinEdge: [race spacing](https://equinedge.com/glossary/key-factors/race-spacing)
- Breeders' Cup: [how it works / Challenge](https://breederscup.com/races/how-it-works)
- TDN: [Del Mar Ship and Win](https://www.thoroughbreddailynews.com/del-mars-ship-and-win-program-to-again-boost-summer-purses-along-with-maiden-dirt-bonus/)
- BloodHorse: [trainer interview (placement)](https://www.bloodhorse.com/horse-racing/articles/278345/bloodhorse-interview-trainer-nolan-ramsey)
- InCompass: [racing-office system](https://www.incompass-solutions.com/) · Equibase: [data layer](https://www.equibase.com/)
- Reference glossaries: [Wikipedia — NA racing glossary](https://en.wikipedia.org/wiki/Glossary_of_North_American_horse_racing)
