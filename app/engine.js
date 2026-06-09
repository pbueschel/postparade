/* PostParade — recommendation engine (pure, no DOM, no seed data)
 *
 * One score(horse, race) powers both directions (see docs/plan.md §4):
 *   Trainer → Submit a horse to a race
 *   Track   → Request a horse for a race
 *
 * Loaded as a plain <script> (no bundler) — exposes the global `PPEngine`.
 * Stage 2 (Bun + bun:sqlite) imports this same module server-side as the
 * authoritative scorer; the client keeps it for optimistic UI.
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

  // Hard eligibility gate. `race.conditions` = { sexes[], minAge, maidenOnly }.
  // TODO(v1): add vet's-list + medication (Lasix) gates — see docs/research.md §C.
  function eligibility(h, race) {
    const c = race.conditions || race; // tolerate a flat race spec
    const reasons = [];
    const sexOk = c.sexes.includes(h.sex);
    reasons.push({ pass: sexOk, label: sexOk ? `${h.sex} meets sex restriction` : `${h.sex} fails sex restriction` });
    const ageOk = h.age >= c.minAge;
    reasons.push({ pass: ageOk, label: ageOk ? `${h.age}yo eligible` : `${h.age}yo too young` });
    if (c.maidenOnly) reasons.push({ pass: h.maiden, label: h.maiden ? 'maiden — career 0 wins' : 'not a maiden' });
    return { eligible: reasons.every(x => x.pass), reasons };
  }

  // Shipping + incentive. `race` carries the active Ship-and-Win predicate as
  // { bonusAmount, bonusMi } (derived from a SupplementProgram in data.js).
  function shipping(h, race) {
    const amount = race.bonusAmount || 0;
    const minMi = race.bonusMi || 0;
    const qualifies = amount > 0 && h.shipMi >= minMi;
    return { shipMi: h.shipMi, shipIn: h.shipMi > 0, bonus: qualifies ? amount : 0 };
  }

  // Fit score (0–100) + acceptance likelihood. Weights are tunable constants.
  function score(h, race) {
    const elig = eligibility(h, race);
    if (!elig.eligible) return { eligible: false, reasons: elig.reasons };

    const par = race.par || 84;
    const within = (v, [lo, hi]) => v >= lo && v <= hi;
    const distFit  = within(race.distance, h.sweet) ? 100 : Math.max(40, 100 - Math.abs(race.distance - (h.sweet[0] + h.sweet[1]) / 2) / 12);
    const surfFit  = h.surf.includes(race.surface) ? 100 : 45;
    const classFit = Math.max(30, Math.min(100, 50 + (h.classR - 108) * 4));
    const speed    = h.lastSpeed === 0 ? 62 : Math.max(30, Math.min(100, 60 + (h.lastSpeed - par) * 2.5));
    const fresh    = h.daysSince === 0 ? 70 : (h.daysSince <= 45 ? 100 - Math.abs(h.daysSince - 28) : Math.max(35, 100 - (h.daysSince - 45)));
    const connect  = Math.min(100, h.trainerPct * 380);
    const fieldStr = 80;

    const W = { dist: 20, surf: 15, class: 25, speed: 15, fresh: 10, connect: 10, fieldStr: 5 };
    const fit = Math.round(
      (distFit * W.dist + surfFit * W.surf + classFit * W.class + speed * W.speed + fresh * W.fresh + connect * W.connect + fieldStr * W.fieldStr)
      / (W.dist + W.surf + W.class + W.speed + W.fresh + W.connect + W.fieldStr)
    );

    const ship = shipping(h, race);
    const shipPenalty = ship.shipMi > 400 ? -22 : ship.shipMi > 150 ? -10 : 0;
    const bonusBoost  = ship.bonus > 0 ? 12 : 0;
    let accept = Math.round(fit * 0.7 + 22 + bonusBoost + shipPenalty + h.trainerPct * 30);
    accept = Math.max(30, Math.min(95, accept));

    return { eligible: true, reasons: elig.reasons, fit, accept, ship,
             components: { distFit, surfFit, classFit, speed, fresh, connect } };
  }

  // Rank eligible horses for a race (Track → Request side).
  function fitsForRace(horses, race) {
    return horses.map(h => ({ h, s: score(h, race) }))
                 .filter(x => x.s.eligible)
                 .sort((a, b) => b.s.accept - a.s.accept);
  }

  global.PPEngine = { CLASS_LADDER, eligibility, shipping, score, fitsForRace };
})(window);
