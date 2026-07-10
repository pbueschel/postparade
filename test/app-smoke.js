// Integration smoke: load engine+data+store+render+screens under DOM stubs,
// invoke every renderer, exercise the store loop. Run: bun app-smoke.js
const fs = require('fs');
const path = require('path').join(__dirname, '..') + '/';

function fakeEl() {
  return {
    innerHTML: '', textContent: '', value: '', style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, setAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    contains() { return false; },
  };
}

const storage = {};
const documentStub = {
  getElementById: (id) => { els[id] = els[id] || fakeEl(); return els[id]; },
  querySelectorAll: () => [],
  createElement: () => fakeEl(),
  addEventListener() {},
  body: Object.assign(fakeEl(), { dataset: { ws: 'trainer' } }),
};
const els = {};

const windowStub = {
  addEventListener() {},
  matchMedia: () => ({ matches: false }),
  location: { hash: '#dashboard', reload() {} },
  scrollTo() {},
};
windowStub.window = windowStub;

global.window = windowStub;
global.document = documentStub;
global.location = windowStub.location;
global.localStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = v; },
  removeItem: (k) => { delete storage[k]; },
};
global.lucide = { createIcons() {} };

// Load in app.html order; classic scripts declare globals via function/var —
// run each file's source in the global scope via indirect eval.
const load = (f) => (0, eval)(fs.readFileSync(path + f, 'utf8'));
for (const f of ['app/engine.js', 'app/data.js', 'app/store.js', 'app/render.js',
                 'app/screens-trainer.js', 'app/screens-track.js']) {
  try { load(f); console.log('loaded', f); }
  catch (e) { console.error('LOAD FAIL', f, e.message); process.exit(1); }
}

const PPData = window.PPData, PPStore = window.PPStore, R = window.PPRenderers;
global.PPData = PPData; global.PPStore = PPStore; global.PPEngine = window.PPEngine;
global.PPRenderers = R;
// render.js helpers were declared via `function foo()` inside indirect eval —
// they land on globalThis already. Verify:
for (const h of ['esc', 'fmtMoney', 'toast', 'pill', 'scoreRing', 'drawInChip', 'fillState', 'daysUntil', 'furlongs', 'fmtDate']) {
  if (typeof globalThis[h] !== 'function') { console.error('MISSING HELPER', h); process.exit(1); }
}

window.rerender = () => {};

const keys = Object.keys(R);
console.log('renderers registered:', keys.join(', '));
const expected = ['dashboard', 'scr-horse', 'scr-recs', 'scr-race', 'trainer/requests', 'trainer/alerts',
  'track/meets', 'scr-track-meet', 'track/meet-builder', 'scr-track-stalls', 'scr-track-stall-builder',
  'scr-track-raceday', 'scr-track-race', 'track/requests', 'track/strength'];
const missing = expected.filter(k => !R[k]);
if (missing.length) { console.error('MISSING RENDERERS:', missing); process.exit(1); }

let fails = 0;
const tryRender = (k, param) => {
  try { R[k](param); console.log('ok  ', k, param ?? ''); }
  catch (e) { fails++; console.error('FAIL', k, param ?? '', '→', e.message); }
};

// null-param defaults + real params
tryRender('dashboard');
tryRender('scr-horse', null);
tryRender('scr-horse', 'zengraya');
tryRender('scr-horse', 'nonexistent-horse');
tryRender('scr-recs', null);
tryRender('scr-recs', 'zengraya');
tryRender('scr-race', null);
tryRender('scr-race', 'cd-jun6-r4');
tryRender('trainer/requests');
tryRender('track/meets');
tryRender('scr-track-meet', null);
tryRender('scr-track-meet', 'cd-2026-summer');
tryRender('scr-track-meet', 'elp-2026-summer');
tryRender('scr-track-meet', 'nonexistent-meet');
tryRender('scr-track-stalls', null);
tryRender('scr-track-stalls', 'cd-2026-summer');
tryRender('scr-track-stalls', 'elp-2026-summer');
tryRender('scr-track-stalls', 'nonexistent-meet');
tryRender('scr-track-stall-builder', null);
tryRender('scr-track-stall-builder', 'cd-2026-summer');
tryRender('scr-track-stall-builder', 'elp-2026-summer');
tryRender('scr-track-stall-builder', 'nonexistent-meet');
tryRender('track/meet-builder', null);
tryRender('track/meet-builder', 'cd-2026-summer');
tryRender('track/meet-builder', 'nonexistent-meet');
tryRender('scr-track-raceday', null);
tryRender('scr-track-race', null);
tryRender('scr-track-race', 'cd-jun6-r4');  // showcase over-subscribed race
tryRender('scr-track-race', 'elp-jul11-r4'); // R5.1 live-card AE + near-miss panel
tryRender('scr-track-race', 'elp-jul11-r5'); // R5.1 Lasix-stakes near-miss panel
tryRender('scr-race', 'elp-jul11-r4');       // R5.1 trainer-side cut-line/AE panel
tryRender('scr-race', 'elp-jul11-r5');
tryRender('track/requests');
tryRender('track/strength');

// Every race + every horse renders (param routes work for all entities)
for (const r of PPData.listRaces({})) tryRender('scr-track-race', r.id);
for (const h of PPData.horses) tryRender('scr-horse', h.id);

// Store loop: request → accept → entry counted
const before = PPStore.entriesForRace('cd-jun6-r3').length;
const req = PPStore.requests.add({ horseId: 'zengraya', raceId: 'cd-jun6-r3' });
if (PPStore.entriesForRace('cd-jun6-r3').length !== before) { console.error('FAIL: sent request should not count as entry'); fails++; }
PPStore.requests.setStatus(req.id, 'accepted');
if (PPStore.entriesForRace('cd-jun6-r3').length !== before + 1) { console.error('FAIL: accepted request must count as entry'); fails++; }
const sub = PPStore.submissions.add({ horseId: 'tammys-kiss', raceId: 'cd-jun6-r3' });
if (!sub || PPStore.entriesForRace('cd-jun6-r3').length < before + 1) { console.error('FAIL: submission entry join'); fails++; }
// persisted?
if (!storage['pp.demo.v1'] || !storage['pp.demo.v1'].includes('zengraya')) { console.error('FAIL: not persisted to localStorage'); fails++; }
console.log('store loop ok; persisted bytes:', (storage['pp.demo.v1'] || '').length);

// Store loop: pending stall application → assign → status flips
const stallBefore = PPStore.stallFor('stall-cd-3');
if (stallBefore.status !== 'pending') { console.error('FAIL stall pre-state: expected pending, got', stallBefore.status); fails++; }
PPStore.overrideStall('stall-cd-3', { status: 'assigned', barnId: 'barn-cd-14' });
const stallAfter = PPStore.stallFor('stall-cd-3');
if (stallAfter.status !== 'assigned' || stallAfter.barnId !== 'barn-cd-14') { console.error('FAIL stall assign:', stallAfter); fails++; }
else { console.log('stall assign ok'); }

// Store loop: build a meet → race day → race, and confirm every merge-aware
// read path (list, dashboard, ship program, race builder) resolves it.
const newProg = PPStore.createShipProgram({ label: 'Test Ship & Win', flatAmount: 2750, eligibility: { minShipMi: 275 }, cap: { totalBudget: 40000, claimed: 0 } });
const newMeet = PPStore.createMeet({ track: 'KEE', trackName: 'Keeneland', name: 'Keeneland — Fall 2026', label: 'Fall meet', start: '2026-09-01', end: '2026-09-30', meetType: 'regular', supplementProgramIds: [newProg.id] });
if (!PPData.listMeets().concat(PPStore.listCreatedMeets()).some(m => m.id === newMeet.id)) { console.error('FAIL: created meet missing from merged meets list'); fails++; }
const newDay = PPStore.createRaceDay({ meetId: newMeet.id, date: '2026-09-05', label: 'Saturday, September 5' });
const newRace = PPStore.createRace({ raceDayId: newDay.id, meetId: newMeet.id, raceNumber: 1 });
if (!PPStore.raceFor(newRace.id)) { console.error('FAIL: raceFor did not resolve a created race'); fails++; }
else console.log('build-a-meet loop ok:', newMeet.id, newDay.id, newRace.id);
tryRender('track/meets');
tryRender('scr-track-meet', newMeet.id);
tryRender('track/meet-builder', newMeet.id);
tryRender('scr-track-race', newRace.id);

// re-render everything again with live store state
tryRender('trainer/requests');
tryRender('track/requests');
tryRender('scr-track-race', 'cd-jun6-r3');
tryRender('dashboard');
tryRender('trainer/alerts');

// F5 engine functions
const E = window.PPEngine;
const showcase = PPData.getRace('cd-jun6-r4');
const showEntrants = PPStore.entriesForRace('cd-jun6-r4').map(e => PPData.getHorse(e.horseId)).filter(Boolean);
const po = E.preferenceOrder(showEntrants, showcase);
if (!po || po.length < 11) { console.error('FAIL preferenceOrder: expected 12 entrants, got', po && po.length); fails++; }
else {
  const zones = po.map(x => x.zone);
  if (zones[0] !== 'in' || !zones.includes('ae')) { console.error('FAIL preferenceOrder zones:', zones.join(',')); fails++; }
  else console.log('preferenceOrder ok:', zones.join(','));
}
const fp = E.fillProbability(showcase, showEntrants.length);
if (!fp || fp.bucket !== 'likely') { console.error('FAIL fillProbability on full race:', JSON.stringify(fp)); fails++; }
else console.log('fillProbability ok:', fp.label, fp.prob);
const shortRace = PPData.listRaces({}).map(r => ({ r, n: PPStore.entriesForRace(r.id).length }))
  .find(x => x.n < x.r.fieldTarget.min - 2);
if (shortRace) {
  const fp2 = E.fillProbability(shortRace.r, shortRace.n);
  if (!fp2 || fp2.bucket === 'likely') { console.error('FAIL fillProbability on short race:', JSON.stringify(fp2)); fails++; }
  else console.log('fillProbability short ok:', fp2.label, fp2.prob, `(${shortRace.n}/${shortRace.r.fieldTarget.min})`);
}
const zen = PPData.getHorse('zengraya');
const tp = E.truePurse(zen, PPData.getRace('cd-jun6-r3'), { fit: 90 });
if (!tp || typeof tp.ev !== 'number') { console.error('FAIL truePurse:', JSON.stringify(tp)); fails++; }
else console.log('truePurse ok: ev', tp.ev, '|', tp.detail);
if (E.fillProbability({ distance: 1320 }, 5) !== null) { console.error('FAIL: fillProbability flat spec must be null'); fails++; }

// Demo-decay guard (R1.2): the app must never run out of live content. Trips
// if the rolling demo-fiction card (R1.1) is reverted to fixed dates that age
// past `today`. Two independent checks so a regression can't slip through one.
const openRaces = PPData.listRaces({ openOnly: true });
if (openRaces.length < 3) {
  console.error(`FAIL demo-decay: only ${openRaces.length} open race(s) (need >=3) — the rolling ELP card (R1.1) likely decayed to fixed dates`);
  fails++;
} else {
  console.log('demo-decay open-race count ok:', openRaces.length);
}
// The featured trainer (larose) must have at least one open, eligible race to
// recommend — mirrors screens-trainer's engine call (strict per-meet program).
const featured = PPData.demoStable();
if (!featured) { console.error('FAIL demo-decay: no featured demo stable (isDemoUser)'); fails++; }
else {
  const meetOfRace = (r) => r.meetId || (PPData.getRaceDay(r.raceDayId) || {}).meetId;
  const featuredHorses = PPData.listHorses({ stableId: featured.id });
  let recs = 0;
  for (const h of featuredHorses) {
    for (const r of openRaces) {
      const ctx = { today: PPData.today, program: PPData.shipProgramForMeet(meetOfRace(r)) };
      if (E.score(h, r, ctx).eligible) recs++;
    }
  }
  if (recs === 0) {
    console.error(`FAIL demo-decay: featured trainer "${featured.id}" has zero open, eligible recommendations`);
    fails++;
  } else {
    console.log(`demo-decay featured-trainer recs ok: ${recs} open eligible pairing(s) for "${featured.id}"`);
  }
}

// R4.1 — the core loop on CURRENT content: the ELP office Requests a LaRose
// horse for an open Ellis Park race → it lands in the trainer's inbound list →
// trainer Accepts → the race's fill count rises. Mirrors CLAUDE.md's manual loop.
const loopRace = 'elp-jul11-r3', loopHorse = 'arthur-jr';
{
  const lr = PPStore.raceFor(loopRace), lh = PPData.getHorse(loopHorse);
  if (!lr || (lr.entryClose || '') <= PPData.today) { console.error('FAIL R4 loop: ELP loop race not open —', loopRace); fails++; }
  // The requested LaRose (Jockey Club) horse must genuinely fit the ELP race,
  // else the loop is a demo fiction. Uses the strict per-meet program (R2.1).
  const loopCtx = { today: PPData.today, program: PPData.shipProgramForMeet('elp-2026-summer') };
  if (!lh || !E.score(lh, lr, loopCtx).eligible) { console.error('FAIL R4 loop: LaRose horse', loopHorse, 'not eligible for', loopRace); fails++; }
  const loopBefore = PPStore.entriesForRace(loopRace).length;
  const loopReq = PPStore.requests.add({ horseId: loopHorse, raceId: loopRace });
  // Visible to the trainer as an inbound "sent" request (screens-trainer reads this list).
  if (!PPStore.requests.list({ status: 'sent' }).some(r => r.id === loopReq.id)) { console.error('FAIL R4 loop: request not visible to trainer as sent'); fails++; }
  if (PPStore.entriesForRace(loopRace).length !== loopBefore) { console.error('FAIL R4 loop: a sent request must not yet count as an entry'); fails++; }
  PPStore.requests.setStatus(loopReq.id, 'accepted');
  if (PPStore.entriesForRace(loopRace).length !== loopBefore + 1) { console.error('FAIL R4 loop: accepted request must raise the fill count'); fails++; }
  else console.log('R4 loop ok: ELP request→accept raised fill on', loopRace);
}

// R3 — a user-added Quarter Horse is handled sanely: ineligible for TB races via
// the registry gate, with no crash/blank state in the trainer renderers.
{
  const qh = PPStore.createHorse({ name: 'Test QH Filly', stableId: featured ? featured.id : 'larose', registry: 'AQHA', home: 'DED', sex: 'F', age: 3 });
  tryRender('scr-horse', qh.id);
  tryRender('scr-recs', qh.id);
  const anyTbOpen = PPData.listRaces({ openOnly: true }).find(r => r.discipline === 'TB');
  if (anyTbOpen && E.score(qh, anyTbOpen, { today: PPData.today }).eligible) { console.error('FAIL R3: AQHA horse should be ineligible for a TB race'); fails++; }
  else console.log('R3 QH-horse sanity ok: AQHA horse gated out of TB races, renderers stable');
}

// R5.1 — the four dormant feature showcases, reconstructed on the live ELP card
// (rolling dates keep them perpetually reachable). Each asserts the STATE exists
// so a future seed edit that breaks a showcase trips here. Illustrative states
// sit on demo-fiction horses only (steel-thistle vet list, silverware win
// count/Lasix) — never on a real LaRose horse.
{
  const t = { today: PPData.today };
  // (1) Also-eligible spill: elp-jul11-r4 seeded OVER fieldTarget.max.
  const aeRace = PPData.getRace('elp-jul11-r4');
  const aeEnt = PPStore.entriesForRace('elp-jul11-r4').map(e => PPData.getHorse(e.horseId)).filter(Boolean);
  if (!aeRace || aeEnt.length <= aeRace.fieldTarget.max) {
    console.error('FAIL R5 AE: elp-jul11-r4 not over cap —', aeEnt.length, 'vs max', aeRace && aeRace.fieldTarget.max); fails++;
  } else {
    const zones = (E.preferenceOrder(aeEnt, aeRace) || []).map(x => x.zone);
    if (zones[0] !== 'in' || !zones.includes('ae')) { console.error('FAIL R5 AE: no also-eligible spill —', zones.join(',')); fails++; }
    else console.log(`R5 AE showcase ok: ${aeEnt.length} entered / ${aeRace.fieldTarget.max} cap → ${zones.join(',')}`);
  }
  // (2) Vet's-list ineligibility: steel-thistle gated out of the live N3X race with the named reason.
  const r3 = PPData.getRace('elp-jul11-r3');
  const steelE = E.eligibility(PPData.getHorse('steel-thistle'), r3, t);
  const vetR = (steelE.reasons || []).find(r => /Vet's list/.test(r.label) && !r.pass);
  if (steelE.eligible || !vetR) { console.error('FAIL R5 vet: steel-thistle not vet-gated on elp-jul11-r3 —', JSON.stringify(steelE.reasons)); fails++; }
  else console.log('R5 vet showcase ok:', vetR.label);
  // (3) Non-winners near-miss with the failing rule named: silverware over the N3X bar.
  const nxE = E.eligibility(PPData.getHorse('silverware'), r3, t);
  const nxR = (nxE.reasons || []).find(r => /N3X/.test(r.label) && !r.pass);
  if (nxE.eligible || !nxR) { console.error('FAIL R5 N3X: silverware not N3X-gated on elp-jul11-r3 —', JSON.stringify(nxE.reasons)); fails++; }
  else console.log('R5 N3X near-miss ok:', nxR.label);
  // (4) Medication gate: silverware Lasix-blocked from the ELP Listed turf stakes.
  const lxE = E.eligibility(PPData.getHorse('silverware'), PPData.getRace('elp-jul11-r5'), t);
  const lxR = (lxE.reasons || []).find(r => /Lasix/.test(r.label) && !r.pass);
  if (lxE.eligible || !lxR) { console.error('FAIL R5 Lasix: silverware not Lasix-gated on elp-jul11-r5 —', JSON.stringify(lxE.reasons)); fails++; }
  else console.log('R5 Lasix showcase ok:', lxR.label);
}

console.log(fails ? `SMOKE FAILED: ${fails} failures` : 'SMOKE PASSED');
process.exit(fails ? 1 : 0);
