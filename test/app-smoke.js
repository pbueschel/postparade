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
  'track/meets', 'scr-track-meet', 'scr-track-stalls', 'scr-track-stall-builder',
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
tryRender('scr-track-raceday', null);
tryRender('scr-track-race', null);
tryRender('scr-track-race', 'cd-jun6-r4');  // showcase over-subscribed race
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

console.log(fails ? `SMOKE FAILED: ${fails} failures` : 'SMOKE PASSED');
process.exit(fails ? 1 : 0);
