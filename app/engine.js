/* PostParade — recommendation engine (pure, no DOM, no seed data)
 *
 * One score(horse, race, ctx) powers both directions (see docs/plan.md §4):
 *   Trainer → Submit a horse to a race   (racesForHorse: fix horse, rank races)
 *   Track   → Request a horse for a race  (fitsForRace: fix race, rank horses)
 *
 * Loaded as a plain <script> (no bundler) — exposes the global `PPEngine`.
 * Stage 2 (Bun + bun:sqlite) imports this same module server-side as the
 * authoritative scorer; the client keeps it for optimistic UI.
 *
 * Back-compat contract: two-arg calls score(h, race) / eligibility(h, race)
 * against OLD-shaped flat race specs (the tour.html + race-builder form path)
 * behave byte-identically to the prior version. Every v1 field (record,
 * vetList, medication, preference, stateBred, fieldTarget, conditions.*) is
 * read defensively — absent fields make the new gate/signal skip silently.
 */
(function (global) {
  'use strict';

  // Class ladder, low → high (codes match Brisnet/Equibase; see docs/research.md §B).
  const CLASS_LADDER = [
    { code: 'MSW',        label: 'Maiden Special Weight' },
    { code: 'MdnClm',     label: 'Maiden Claiming' },
    { code: 'Clm',        label: 'Claiming' },
    { code: 'OptClm',     label: 'Optional Claiming' },
    { code: 'StarterAlw', label: 'Starter Allowance' },
    { code: 'Alw',        label: 'Allowance' },
    { code: 'Hcp',        label: 'Handicap' },
    { code: 'Listed',     label: 'Listed Stakes' },
    { code: 'G3',         label: 'Grade 3 Stakes' },
    { code: 'G2',         label: 'Grade 2 Stakes' },
    { code: 'G1',         label: 'Grade 1 Stakes' },
  ];

  const STAKES_LADDER = ['Listed', 'G3', 'G2', 'G1'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ---- small helpers -------------------------------------------------------
  const round2 = (x) => Math.round(x * 100) / 100;
  function fmtShort(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    if (!m || !d) return String(iso);
    return `${MONTHS[+m - 1]} ${+d}`;
  }
  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function resolveToday(ctx) {
    return (ctx && ctx.today) ||
           (global.PPData && global.PPData.today) ||
           new Date().toISOString().slice(0, 10);
  }
  function raceDateOf(race, ctx) {
    return (race && race.postTime ? String(race.postTime).slice(0, 10) : null) || resolveToday(ctx);
  }

  // Non-winners "other than" ladder. Returns {pass, label, skip?}. Skips silently
  // (skip:true) when the horse has no `record` or no condition — old-shaped data.
  // N1X = "non-winners of ONE race other than mdn/clm/starter": a horse with ZERO
  // such wins IS eligible, hence winsOtherThanMdnClmStarter < count.
  function nonWinnersEligible(h, nw) {
    const rec = h && h.record;
    if (!rec || !nw) return { pass: true, label: null, skip: true };
    switch (nw.kind) {
      case 'maiden':
        return { pass: rec.careerWins === 0,
                 label: rec.careerWins === 0 ? 'maiden — career 0 wins' : 'not a maiden (has a win)' };
      case 'N_X': {
        const w = rec.winsOtherThanMdnClmStarter ?? 0;
        const ok = w < nw.count;
        return { pass: ok, label: ok
          ? `eligible: ${w} win(s) other than mdn/clm/starter (under N${nw.count}X)`
          : `${w} win(s) other than mdn/clm/starter — over N${nw.count}X limit` };
      }
      case 'N_Y': {
        const ok = rec.careerWins < nw.count;
        return { pass: ok, label: ok
          ? `eligible: ${rec.careerWins} career win(s) (under N${nw.count}Y)`
          : `${rec.careerWins} career win(s) — over N${nw.count}Y limit` };
      }
      case 'N2L': {
        const ok = rec.careerWins < 2;
        return { pass: ok, label: ok
          ? `eligible: non-winners of two lifetime (${rec.careerWins} win)`
          : `${rec.careerWins} career wins — N2L ineligible` };
      }
      case 'N$Y': {
        // Money-condition non-winners: "non-winners of $Y since <date>". No purse
        // history in the demo, so approximate from lastWinDate/careerWins.
        const since = nw.sinceDate;
        let recentWins = rec.careerWins;
        if (since) recentWins = (rec.lastWinDate && rec.lastWinDate >= since) ? 1 : 0;
        const ok = recentWins < (nw.count || 1);
        return { pass: ok, label: `${ok ? 'eligible' : 'ineligible'}: N$${nw.amount || ''} condition (approx)` };
      }
      default:
        return { pass: true, label: null, skip: true };
    }
  }

  // Hard eligibility gate. Old sex/age/maiden reasons kept EXACTLY (tour.html
  // renders these labels). New gates append {pass,label} reasons, each skipping
  // silently when its inputs are absent on an old-shaped horse/race.
  function eligibility(h, race, ctx = {}) {
    const c = race.conditions || race; // tolerate a flat race spec
    const reasons = [];

    // --- existing gates (labels frozen) ---
    const sexOk = c.sexes.includes(h.sex);
    reasons.push({ pass: sexOk, label: sexOk ? `${h.sex} meets sex restriction` : `${h.sex} fails sex restriction` });
    const ageOk = h.age >= c.minAge;
    reasons.push({ pass: ageOk, label: ageOk ? `${h.age}yo eligible` : `${h.age}yo too young` });
    if (c.maxAge != null && h.age > c.maxAge) {
      reasons.push({ pass: false, label: `${h.age}yo too old (max ${c.maxAge})` });
    }
    if (c.maidenOnly) reasons.push({ pass: h.maiden, label: h.maiden ? 'maiden — career 0 wins' : 'not a maiden' });

    // --- v1 gates (skip silently on old-shaped data) ---

    // Non-winners ladder. Skip the redundant 'maiden' branch when maidenOnly
    // already produced the maiden reason above.
    const nw = c.nonWinners;
    if (nw && h.record && !(nw.kind === 'maiden' && c.maidenOnly)) {
      const r = nonWinnersEligible(h, nw);
      if (!r.skip) reasons.push({ pass: r.pass, label: r.label });
    }

    // Claiming price: claiming eligibility is by the tag price a horse is entered
    // at (declared at entry), not a stored attribute — out of demo scope, so skip.

    // Vet's list: barred until eligibleDate. No reason at all if never listed.
    if (h.vetList && h.vetList.listed) {
      const ed = h.vetList.eligibleDate;
      const rd = raceDateOf(race, ctx);
      const barred = !ed || ed > rd;
      if (barred) {
        reasons.push({ pass: false, label: `Vet's list${h.vetList.reason ? ` (${h.vetList.reason})` : ''} — eligible ${ed ? fmtShort(ed) : 'date TBD'}` });
      } else {
        reasons.push({ pass: true, label: `Vet's list: cleared ${fmtShort(ed)}` });
      }
    }

    // Medication: some conditions (2yo races, certain stakes) prohibit Lasix.
    if (c.lasixProhibited) {
      const usesLasix = !!(h.medication && h.medication.lasix);
      reasons.push({ pass: !usesLasix, label: usesLasix ? 'Lasix not permitted (2yo/stakes rule)' : 'no Lasix — permitted' });
    }

    // State-bred restricted races.
    if (race.stateBredRestricted) {
      const ok = h.stateBred === race.stateBredCode;
      reasons.push({ pass: ok, label: ok ? `${race.stateBredCode}-bred — eligible` : `${race.stateBredCode || 'State'}-bred only` });
    }

    // Registry/discipline gate: a Thoroughbred (Jockey Club) can't run a Quarter
    // Horse (AQHA) race or vice-versa. The race carries a `discipline` ('TB'|'QH',
    // stamped in data.js); the horse a `registry` ('Jockey Club'|'AQHA'). Skips
    // silently unless BOTH are present — tour.html's flat race specs carry neither.
    const disc = race.discipline;
    if (disc && h.registry) {
      const need = disc === 'QH' ? 'AQHA' : 'Jockey Club';
      const ok = h.registry === need;
      reasons.push({ pass: ok, label: ok ? `${need}-registered — eligible` : `${need}-registered only` });
    }

    return { eligible: reasons.every(x => x.pass), reasons };
  }

  // Preference priority under a race's preference system. Lower = better spot.
  // 'date': earlier preference date wins (older date has priority); a horse
  // without a preference date is proxied by last-start recency (larger
  // daysSince ≈ older last start ≈ better). 'stars': fewer stars wins.
  function prefPriority(x, prefSystem) {
    if (prefSystem === 'date') {
      if (x.preference && x.preference.date) return Date.parse(x.preference.date);
      return Date.now() - (x.daysSince || 0) * 86400000;
    }
    if (prefSystem === 'stars') return (x.preference && x.preference.stars) ?? 999;
    return 0;
  }

  // Draw-in probability (v1). Heuristic from preference system + projected
  // entries vs field cap + also-eligible cap. Returns null for a flat race spec
  // (no fieldTarget) — callers MUST tolerate null.
  function drawIn(h, race, ctx = {}) {
    const ft = race && race.fieldTarget;
    if (!ft) return null;

    const max = ft.max ?? 12;
    const cap = race.alsoEligibleCap ?? 0;
    const entrants = ctx.entrants || [];
    const projected = ctx.projectedEntries ?? (entrants.length + 1);
    const overflow = projected - max;
    const prefSystem = race.preferenceSystem || 'none';

    const prefDesc = prefSystem === 'date'
      ? (h.preference && h.preference.date ? `pref date ${fmtShort(h.preference.date)}` : 'by recency')
      : prefSystem === 'stars'
        ? `${(h.preference && h.preference.stars) ?? 0}★`
        : 'no preference';

    if (overflow <= 0) {
      return { bucket: 'in', prob: 0.92, rank: null, projected, overflow,
               label: 'Likely to draw in',
               detail: `${projected} projected for ${max} spots — under target` };
    }

    // Rank this horse among ctx.entrants + self (prefPriority: lower = better).
    const field = entrants.concat([h]);
    const priority = (x) => prefPriority(x, prefSystem);

    let rank;
    if (prefSystem === 'none') {
      rank = projected; // no preference system — this horse sits at the back
    } else {
      const mine = priority(h);
      rank = field.filter(x => x !== h && priority(x) < mine).length + 1;
    }

    const detail = `${projected} projected for ${max} spots; ${prefDesc} ranks ${ordinal(rank)}`;

    if (rank <= max) {
      const margin = (max - rank) / Math.max(1, max);
      return { bucket: 'in', prob: round2(0.8 + 0.15 * margin), rank, projected, overflow,
               label: 'Likely to draw in', detail };
    }
    if (rank <= max + cap) {
      const prob = Math.min(0.5, 0.15 + 0.1 * (max + cap - rank));
      return { bucket: 'ae', prob: round2(prob), rank, projected, overflow,
               label: 'Likely also-eligible', detail };
    }
    return { bucket: 'unlikely', prob: 0.05, rank, projected, overflow,
             label: 'Unlikely to draw in', detail };
  }

  // Field strength (v1). Mean of entrants' class rating and speed-vs-par, scaled
  // to 0–100. Empty entrants → neutral. Used to make a SOFTER field (lower
  // index) read as more attractive to enter (see score()).
  function fieldStrength(entrantHorses, race) {
    const list = entrantHorses || [];
    if (!list.length) return { index: 50, label: 'Average' };
    const par = (race && race.par) || 84;
    let sum = 0;
    for (const h of list) {
      const classComp = Math.max(30, Math.min(100, 50 + ((h.classR ?? 108) - 108) * 4));
      const speedComp = (h.lastSpeed == null || h.lastSpeed === 0)
        ? 55
        : Math.max(30, Math.min(100, 50 + (h.lastSpeed - par) * 2.5));
      sum += (classComp + speedComp) / 2;
    }
    const index = Math.max(0, Math.min(100, Math.round(sum / list.length)));
    const label = index >= 66 ? 'Strong' : index >= 40 ? 'Average' : 'Soft';
    return { index, label };
  }

  // Shipping + incentive. Two paths:
  //   flat (precedence): race.bonusAmount/bonusMi from the race-builder form and
  //     tour.html — behaves exactly as the prior version.
  //   program-driven: a SupplementProgram (data.js) with full eligibility
  //     predicates, resolved from ctx.program or PPData.shipProgram().
  function shipping(h, race, ctx = {}) {
    const shipMi = ctx.shipMi ?? h.shipMi ?? 0;
    const shipIn = shipMi > 0;

    // Flat spec path — takes precedence, unchanged semantics.
    if (race && (race.bonusAmount != null || race.bonusMi != null)) {
      const amount = race.bonusAmount || 0;
      const minMi = race.bonusMi || 0;
      const qualifies = amount > 0 && shipMi >= minMi;
      return { shipMi, shipIn, bonus: qualifies ? amount : 0 };
    }

    // Program-driven path. A caller-supplied ctx OWNS the program decision: if
    // it carries a `program` key we respect it even when it's null/undefined
    // (the strict per-meet helpers pass null for a program-less meet — no
    // phantom bonus). Only the no-ctx two-arg/tour path (ctx has no `program`
    // key) falls back to the global default program. (R2.1)
    const program = ('program' in ctx)
      ? ctx.program
      : (global.PPData && global.PPData.shipProgram && global.PPData.shipProgram());
    if (!program) return { shipMi, shipIn, bonus: 0 };

    const e = program.eligibility || {};
    let qualifies = true;
    if (e.shipInOnly && shipMi < (e.minShipMi || 0)) qualifies = false;
    if (e.excludeStakes && STAKES_LADDER.includes(race.classLadder)) qualifies = false;
    if (e.excludeFirstTimers && !(h.record && h.record.starts > 0)) qualifies = false;
    // notRacedInStateMonths + fromOutsideState need a track→state map we don't
    // carry in the demo data — skip those predicates silently.

    const bonus = qualifies
      ? Math.round((program.flatAmount || 0) + (program.purseBonusPct || 0) * (race.purse || 0))
      : 0;
    return { shipMi, shipIn, bonus, program: program.id };
  }

  // Fit score (0–100) + acceptance likelihood. Weights are tunable constants.
  // `ctx` is optional {entrants?, projectedEntries?, shipMi?, program?, today?}.
  function score(h, race, ctx = {}) {
    const elig = eligibility(h, race, ctx);
    if (!elig.eligible) return { eligible: false, reasons: elig.reasons };

    const par = race.par || 84;
    const distance = race.distanceYards ?? race.distance; // v1 uses yards; flat spec uses distance
    const within = (v, [lo, hi]) => v >= lo && v <= hi;
    const distFit  = within(distance, h.sweet) ? 100 : Math.max(40, 100 - Math.abs(distance - (h.sweet[0] + h.sweet[1]) / 2) / 12);
    const surfFit  = h.surf.includes(race.surface) ? 100 : 45;
    const classFit = Math.max(30, Math.min(100, 50 + (h.classR - 108) * 4));
    const speed    = h.lastSpeed === 0 ? 62 : Math.max(30, Math.min(100, 60 + (h.lastSpeed - par) * 2.5));
    const fresh    = h.daysSince === 0 ? 70 : (h.daysSince <= 45 ? 100 - Math.abs(h.daysSince - 28) : Math.max(35, 100 - (h.daysSince - 45)));
    const connect  = Math.min(100, h.trainerPct * 380);

    // Field strength: a softer field (lower index) is MORE attractive to enter,
    // so the component score is 100 - index. Default 80 when no ctx.entrants.
    let fieldStr = 80;
    let fieldStrengthObj = null;
    if (ctx.entrants) {
      fieldStrengthObj = fieldStrength(ctx.entrants, race);
      fieldStr = 100 - fieldStrengthObj.index;
    }

    const W = { dist: 20, surf: 15, class: 25, speed: 15, fresh: 10, connect: 10, fieldStr: 5 };
    const fit = Math.round(
      (distFit * W.dist + surfFit * W.surf + classFit * W.class + speed * W.speed + fresh * W.fresh + connect * W.connect + fieldStr * W.fieldStr)
      / (W.dist + W.surf + W.class + W.speed + W.fresh + W.connect + W.fieldStr)
    );

    const ship = shipping(h, race, ctx);
    const shipPenalty = ship.shipMi > 400 ? -22 : ship.shipMi > 150 ? -10 : 0;
    const bonusBoost  = ship.bonus > 0 ? 12 : 0;
    let accept = Math.round(fit * 0.7 + 22 + bonusBoost + shipPenalty + h.trainerPct * 30);
    accept = Math.max(30, Math.min(95, accept));

    // Angle badges surfaced in the UI.
    const rd = raceDateOf(race, ctx);
    const signals = [];
    if (h.medication && h.medication.firstTimeLasix) signals.push({ icon: 'droplet', label: 'First-time Lasix' });
    if (h.equipment && h.equipment.changed)          signals.push({ icon: 'glasses', label: 'Equipment change' });
    if (ship.bonus > 0)                              signals.push({ icon: 'truck', label: `Ship & Win eligible +$${ship.bonus.toLocaleString()}` });
    if (h.vetList && h.vetList.listed && h.vetList.eligibleDate && h.vetList.eligibleDate <= rd) {
      signals.push({ icon: 'stethoscope', label: 'Recently cleared vet list' });
    }

    const result = { eligible: true, reasons: elig.reasons, fit, accept, ship,
                     components: { distFit, surfFit, classFit, speed, fresh, connect },
                     drawIn: drawIn(h, race, ctx), signals };
    if (fieldStrengthObj) result.fieldStrength = fieldStrengthObj;
    return result;
  }

  // Fill probability (research pick #3): will this race go as carded? Heuristic
  // from entries vs the field minimum and time to entry close. Returns null for
  // a flat race spec (no fieldTarget) — callers must tolerate null.
  function fillProbability(race, enteredCount, ctx = {}) {
    const ft = race && race.fieldTarget;
    if (!ft) return null;
    const min = ft.min ?? 6;
    const entered = enteredCount ?? (ctx.entrants ? ctx.entrants.length : 0);
    const today = resolveToday(ctx);
    const daysToClose = race.entryClose
      ? Math.max(0, Math.ceil((Date.parse(race.entryClose) - Date.parse(today)) / 86400000))
      : 3;
    let p;
    if (entered >= min) {
      p = 0.9 + Math.min(0.08, (entered - min) * 0.03);
    } else {
      // Short of the minimum: base on how close, plus recruiting runway.
      p = 0.2 + 0.55 * (entered / min) + Math.min(0.15, daysToClose * 0.03);
    }
    p = round2(Math.max(0.05, Math.min(0.98, p)));
    const bucket = p >= 0.75 ? 'likely' : p >= 0.45 ? 'atRisk' : 'unlikely';
    const label = bucket === 'likely' ? 'Likely to go'
      : bucket === 'atRisk' ? 'At risk' : 'Unlikely to go';
    return { prob: p, bucket, label, entered, min, daysToClose,
             detail: `${entered} entered vs ${min} minimum · ${daysToClose}d to entry close` };
  }

  // True Purse (research pick #2): this horse's effective money picture for a
  // race — expected purse earnings + ship-in bonus − van cost, weighted by
  // draw-in probability. All figures are decision-support estimates.
  function truePurse(h, race, ctx = {}) {
    const purse = race && race.purse;
    if (!purse) return null;
    const ship = shipping(h, race, ctx);
    const shipCost = Math.round((ship.shipMi || 0) * 2.1); // van estimate ~$2.10/mi
    const di = drawIn(h, race, ctx);
    const drawProb = di ? di.prob : 0.9;
    // Expected purse earnings ≈ 19% of purse for a mid-fit horse, scaled by fit.
    const fitFactor = Math.min(1.5, (ctx.fit ?? 70) / 70);
    const expEarn = Math.round(purse * 0.19 * fitFactor);
    const ev = Math.round(drawProb * (expEarn + ship.bonus) - shipCost);
    const parts = [`$${expEarn.toLocaleString()} exp. purse`];
    if (ship.bonus) parts.push(`+ $${ship.bonus.toLocaleString()} bonus`);
    if (shipCost) parts.push(`− $${shipCost.toLocaleString()} van`);
    parts.push(`× ${Math.round(drawProb * 100)}% draw-in`);
    return { expEarn, bonus: ship.bonus, shipCost, drawProb, ev,
             winShare: Math.round(purse * 0.6), detail: parts.join(' ') };
  }

  // Preference order (research pick #4): the full entered field ranked by the
  // race's preference system, with each horse's zone relative to the draw-in
  // cut line ('in'), the also-eligible band ('ae'), or outside ('out').
  function preferenceOrder(entrants, race) {
    const ft = race && race.fieldTarget;
    if (!ft) return null;
    const prefSystem = race.preferenceSystem || 'none';
    const ranked = (entrants || []).slice()
      .sort((a, b) => prefPriority(a, prefSystem) - prefPriority(b, prefSystem));
    const max = ft.max ?? 12;
    const cap = race.alsoEligibleCap ?? 0;
    return ranked.map((h, i) => ({
      h, rank: i + 1,
      zone: i < max ? 'in' : i < max + cap ? 'ae' : 'out',
    }));
  }

  // Track → Request: fix the race, rank eligible-not-entered horses by acceptance.
  // ctxFor optional (horse)=>ctx callback; 2-arg call behaves as before.
  function fitsForRace(horses, race, ctxFor) {
    return horses.map(h => {
      const ctx = typeof ctxFor === 'function' ? (ctxFor(h) || {}) : {};
      return { h, s: score(h, race, ctx) };
    })
      .filter(x => x.s.eligible)
      .sort((a, b) => b.s.accept - a.s.accept);
  }

  // Trainer → Submit: fix the horse, rank open races by fit. Mirror of
  // fitsForRace. ctxFor optional (race)=>ctx callback.
  function racesForHorse(horse, races, ctxFor) {
    return races.map(race => {
      const ctx = typeof ctxFor === 'function' ? (ctxFor(race) || {}) : {};
      return { race, s: score(horse, race, ctx) };
    })
      .filter(x => x.s.eligible)
      .sort((a, b) => b.s.fit - a.s.fit);
  }

  global.PPEngine = {
    CLASS_LADDER,
    eligibility,
    nonWinnersEligible,
    drawIn,
    fieldStrength,
    fillProbability,
    truePurse,
    preferenceOrder,
    shipping,
    score,
    fitsForRace,
    racesForHorse,
  };
})(window);
