/* Standalone smoke test for app/engine.js — stubs window/PPData, loads the
 * plain-<script> module, asserts the back-compat surface + new v1 gates. */
'use strict';
const path = require('path');
const fs = require('fs');

// Stub the browser globals the IIFE expects.
global.window = global;
global.PPData = { today: '2026-06-06', shipProgram() { return null; } };

// Load engine.js (it assigns window.PPEngine = ...).
const enginePath = require('path').join(__dirname, '..', 'app', 'engine.js');
new Function('window', fs.readFileSync(enginePath, 'utf8'))(global.window);
const E = global.PPEngine;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  -', name); }
  else { fail++; console.log('  FAIL-', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

// (a) OLD flat-spec call — the tour.html / race-builder path. Eligible + numeric fit 0-100.
const flatHorse = { sex: 'F', age: 3, maiden: true, surf: ['D'], sweet: [1210, 1430], classR: 70, lastSpeed: 78, daysSince: 30, shipMi: 0, trainerPct: 0.18 };
const flatRace = { sexes: ['F'], minAge: 3, maidenOnly: true, distance: 1320, purse: 85000, bonusAmount: 1500, bonusMi: 150 };
const a = E.score(flatHorse, flatRace);
ok('(a) flat-spec eligible', a.eligible === true, a);
ok('(a) flat-spec fit numeric 0-100', typeof a.fit === 'number' && a.fit >= 0 && a.fit <= 100, a.fit);
ok('(a) flat-spec has ship + accept (back-compat fields)', a.ship && typeof a.accept === 'number', a);
ok('(a) flat-spec drawIn null (no fieldTarget)', a.drawIn === null, a.drawIn);
ok('(a) flat-spec signals array present', Array.isArray(a.signals), a.signals);

// (b) Vet-listed horse fails eligibility with the right label.
const vetRace = { conditions: { sexes: ['F'], minAge: 3 }, postTime: '2026-06-06T14:14:00-05:00' };
const vetHorse = { sex: 'F', age: 4, maiden: false, surf: ['D'], sweet: [1320, 1540], classR: 110, lastSpeed: 80, daysSince: 20, shipMi: 0, trainerPct: 0.15,
                   record: { starts: 6, careerWins: 1, winsOtherThanMdnClmStarter: 0, lastWinDate: '2026-03-01' },
                   vetList: { listed: true, reason: 'bled', eligibleDate: '2026-06-15' } };
const b = E.eligibility(vetHorse, vetRace);
const vetReason = b.reasons.find(r => /Vet's list/.test(r.label));
ok('(b) vet-listed horse ineligible', b.eligible === false, b);
ok('(b) vet label present + fails', vetReason && vetReason.pass === false, vetReason);
ok('(b) vet label reads "Vet\'s list (bled) — eligible Jun 15"', vetReason && vetReason.label === "Vet's list (bled) — eligible Jun 15", vetReason && vetReason.label);
// cleared case: past eligibleDate -> passes with a "cleared" reason
const clearedHorse = Object.assign({}, vetHorse, { vetList: { listed: true, reason: 'bled', eligibleDate: '2026-05-28' } });
const bc = E.eligibility(clearedHorse, vetRace);
const clearedReason = bc.reasons.find(r => /cleared/.test(r.label));
ok('(b) previously-listed cleared passes', clearedReason && clearedReason.pass === true, clearedReason && clearedReason.label);

// (c) N1X: winsOtherThanMdnClmStarter < count (count=1). 0-wins-other passes, 1-win-other fails.
const zeroOther = E.nonWinnersEligible({ record: { careerWins: 3, winsOtherThanMdnClmStarter: 0 } }, { kind: 'N_X', count: 1 });
const oneOther  = E.nonWinnersEligible({ record: { careerWins: 3, winsOtherThanMdnClmStarter: 1 } }, { kind: 'N_X', count: 1 });
ok('(c) N1X: 0 wins-other passes', zeroOther.pass === true, zeroOther);
ok('(c) N1X: 1 win-other fails', oneOther.pass === false, oneOther);
// same via full eligibility integration
const nxRace = { conditions: { sexes: ['F'], minAge: 3, nonWinners: { kind: 'N_X', count: 1 } } };
const nxBase = { sex: 'F', age: 3, maiden: false, surf: ['D'], sweet: [1320, 1430], classR: 100, lastSpeed: 75, daysSince: 20, shipMi: 0, trainerPct: 0.1 };
const nxPass = E.eligibility(Object.assign({}, nxBase, { record: { careerWins: 1, winsOtherThanMdnClmStarter: 0 } }), nxRace);
const nxFail = E.eligibility(Object.assign({}, nxBase, { record: { careerWins: 2, winsOtherThanMdnClmStarter: 1 } }), nxRace);
ok('(c) eligibility N1X integration pass', nxPass.eligible === true, nxPass);
ok('(c) eligibility N1X integration fail', nxFail.eligible === false, nxFail);
// skip silently when no record
const nxSkip = E.nonWinnersEligible({}, { kind: 'N_X', count: 1 });
ok('(c) nonWinners skips when no record', nxSkip.skip === true, nxSkip);

// (d) drawIn: 'in' when projected<=max, 'ae' in the AE band, null for flat spec.
const dRace = { fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date' };
const dHorse = { preference: { date: '2026-04-15' }, daysSince: 30 };
const dIn = E.drawIn(dHorse, dRace, { projectedEntries: 9, entrants: [] });
ok('(d) drawIn "in" when projected<=max', dIn && dIn.bucket === 'in', dIn);
// AE band: 11 entrants all with earlier pref dates -> this horse ranks 12th; max=10, cap=4 -> 11..14 = ae.
const earlierEntrants = Array.from({ length: 11 }, (_, i) => ({ preference: { date: '2026-01-0' + ((i % 9) + 1) } }));
const dAe = E.drawIn(dHorse, dRace, { projectedEntries: 16, entrants: earlierEntrants });
ok('(d) drawIn "ae" in the AE band', dAe && dAe.bucket === 'ae', dAe);
ok('(d) drawIn null for flat spec', E.drawIn(flatHorse, flatRace, {}) === null, E.drawIn(flatHorse, flatRace, {}));
// unlikely: rank beyond max+cap
const manyEntrants = Array.from({ length: 20 }, (_, i) => ({ preference: { date: '2026-01-01' } }));
const dUnlikely = E.drawIn(dHorse, dRace, { projectedEntries: 22, entrants: manyEntrants });
ok('(d) drawIn "unlikely" beyond AE band', dUnlikely && dUnlikely.bucket === 'unlikely', dUnlikely);

// (e) state-bred gate fails a non-KY-bred in a restricted race.
const sbRace = { conditions: { sexes: ['F'], minAge: 3 }, stateBredRestricted: true, stateBredCode: 'KY' };
const sbHorse = { sex: 'F', age: 3, maiden: true, surf: ['D'], sweet: [1320, 1430], classR: 100, lastSpeed: 70, daysSince: 20, shipMi: 0, trainerPct: 0.1, stateBred: null };
const e = E.eligibility(sbHorse, sbRace);
const sbReason = e.reasons.find(r => /bred only/.test(r.label));
ok('(e) non-KY-bred ineligible in restricted race', e.eligible === false, e);
ok('(e) state-bred label "KY-bred only"', sbReason && sbReason.label === 'KY-bred only' && sbReason.pass === false, sbReason);
const sbOk = E.eligibility(Object.assign({}, sbHorse, { stateBred: 'KY' }), sbRace);
ok('(e) KY-bred passes restricted race', sbOk.eligible === true, sbOk);

// Extra: fieldStrength wiring + program shipping + racesForHorse mirror.
const fs2 = E.fieldStrength([], { par: 84 });
ok('(x) fieldStrength empty -> Average/50', fs2.index === 50 && fs2.label === 'Average', fs2);
const softField = E.fieldStrength([{ classR: 95, lastSpeed: 70 }, { classR: 98, lastSpeed: 72 }], { par: 84 });
ok('(x) fieldStrength soft field labeled', ['Soft', 'Average'].includes(softField.label), softField);
const eligibleHorse = { sex: 'F', age: 4, maiden: false, surf: ['D'], sweet: [1320, 1540], classR: 110, lastSpeed: 80, daysSince: 20, shipMi: 0, trainerPct: 0.15, record: { starts: 6, careerWins: 1 } };
const withCtx = E.score(eligibleHorse, { conditions: { sexes: ['F'], minAge: 3 }, par: 84, distanceYards: 1320, surface: 'D', purse: 85000, fieldTarget: { min: 8, max: 10 } },
                        { entrants: [{ classR: 95, lastSpeed: 68 }], today: '2026-06-06' });
ok('(x) score attaches fieldStrength with ctx.entrants', withCtx.fieldStrength && typeof withCtx.fieldStrength.index === 'number', withCtx.fieldStrength);
const prog = { id: 'sw', flatAmount: 1500, purseBonusPct: 0, eligibility: { shipInOnly: true, minShipMi: 150, excludeStakes: true, excludeFirstTimers: false } };
const shipQ = E.shipping({ shipMi: 300, record: { starts: 4 } }, { classLadder: 'MSW', purse: 85000 }, { shipMi: 300, program: prog });
ok('(x) program shipping qualifies -> bonus 1500', shipQ.bonus === 1500, shipQ);
const shipNo = E.shipping({ record: { starts: 4 } }, { classLadder: 'G1', purse: 85000 }, { shipMi: 300, program: prog });
ok('(x) program shipping excludes stakes -> bonus 0', shipNo.bonus === 0, shipNo);
const races = E.racesForHorse(flatHorse, [flatRace, { sexes: ['M'], minAge: 3, distance: 1320 }]);
ok('(x) racesForHorse filters to eligible + returns {race,s}', races.length === 1 && races[0].race && races[0].s.eligible, races.length);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
