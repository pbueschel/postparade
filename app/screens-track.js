/* PostParade — Track workspace screen renderers (classic script, globals).
 *
 * Each renderer owns the FULL innerHTML of its section (app.html ships bare
 * shells). Registered on window.PPRenderers under the router's resolved section
 * id; the router calls fn(param) then lucide.createIcons() on every navigation,
 * so screens always reflect live PPStore state. All track actions (Request,
 * race-spec edits) flow through ONE delegated click/change listener wired once
 * at file load; after any PPStore mutation we toast() then window.rerender().
 *
 * Depends on: PPData (data.js), PPStore (store.js), PPEngine (engine.js),
 * and the shared helpers in render.js (esc, fmtMoney, fmtDate, furlongs, toast,
 * pill, scoreRing, drawInChip, fillState).
 */
(function () {
  'use strict';

  const R = window.PPRenderers = window.PPRenderers || {};
  const CD_MEET = 'cd-2026-summer';

  // Race-builder option tables.
  const DISTANCES = [
    [1210, '5½ furlongs'], [1320, '6 furlongs'], [1430, '6½ furlongs'],
    [1540, '7 furlongs'], [1760, '1 mile'], [1830, '1 mile 70y'],
    [1870, '1 1/16 mile'], [1980, '1 1/8 mile'],
  ];
  // Quarter Horse distances are quoted in yards, never furlongs (see DED meet).
  const QH_DISTANCES = [
    [300, '300 yards'], [330, '330 yards'], [350, '350 yards'], [400, '400 yards'],
    [440, '440 yards (¼ mile)'], [550, '550 yards'], [660, '660 yards'], [870, '870 yards'],
  ];
  const SURFACES = [['D', 'Dirt'], ['T', 'Turf'], ['A', 'All-weather']];
  const RESTRICTS = [['FM3U', 'F&M 3yo and up'], ['3U', '3yo and up (open)'], ['2U', '2yo and up']];
  const TARGETS = [['8', '8'], ['10', '10'], ['12', '12']];
  const TYPES = [['S', 'Maiden Special Weight'], ['M', 'Maiden Claiming'], ['A', 'Allowance'],
    ['C', 'Claiming'], ['AO', 'Allowance Optional Claiming'], ['N', 'Stakes'],
    ['QMDN', 'Quarter Horse Maiden'], ['QSG3', 'Quarter Horse Stakes (G3)'], ['QSG2', 'Quarter Horse Stakes (G2)'],
    ['QSG1', 'Quarter Horse Stakes (G1)'], ['QRG3', 'Restricted Graded (RG3)'], ['QRG2', 'Restricted Graded (RG2)'],
    ['QRG1', 'Restricted Graded (RG1)'], ['QFUT', 'Futurity'], ['QDER', 'Derby'], ['QTRL', 'Trial (qualifier)']];
  const CLASS_OF_TYPE = {
    S: 'MSW', M: 'MdnClm', A: 'Alw', C: 'Clm', AO: 'OptClm', N: 'Listed',
    QMDN: 'MDN', QSG3: 'StkG3', QSG2: 'StkG2', QSG1: 'StkG1',
    QRG3: 'RG3', QRG2: 'RG2', QRG1: 'RG1', QFUT: 'Fut', QDER: 'Der', QTRL: 'Trial',
  };
  const TYPE_OF_CLASS = {
    MSW: 'S', MdnClm: 'M', Alw: 'A', Clm: 'C', OptClm: 'AO',
    MDN: 'QMDN', StkG3: 'QSG3', StkG2: 'QSG2', StkG1: 'QSG1',
    RG3: 'QRG3', RG2: 'QRG2', RG1: 'QRG1', Fut: 'QFUT', Der: 'QDER', Trial: 'QTRL',
  };

  // ---- small local helpers -------------------------------------------------
  function mount(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
  function entriesOf(raceId) { return PPStore.entriesForRace(raceId); }
  function enteredCount(raceId) { return entriesOf(raceId).length; }
  function entrantHorses(raceId) { return entriesOf(raceId).map(e => PPData.getHorse(e.horseId)).filter(Boolean); }
  function parseMoney(s) { return Math.round(+String(s == null ? '' : s).replace(/[^0-9.]/g, '') || 0); }

  // Merge-aware lookups: a "Build a meet" creation exists only in PPStore, not
  // in the PPData seed, so every "the meet / its days / its races / its program"
  // read must check BOTH sources or a created meet silently misbehaves. These
  // also filter out anything soft-deleted (PPStore.isMeetDeleted/isRaceDayDeleted)
  // so a deleted meet or race day disappears everywhere, not just where deleted.
  function meetFor(id) {
    if (!id || PPStore.isMeetDeleted(id)) return null;
    return PPData.getMeet(id) || PPStore.getCreatedMeet(id) || null;
  }
  function raceDaysForMeet(meetId) {
    return PPData.listRaceDays(meetId).concat(PPStore.listCreatedRaceDays(meetId))
      .filter(d => !PPStore.isRaceDayDeleted(d.id));
  }
  function racesForMeet(meetId) {
    const days = raceDaysForMeet(meetId);
    const dayIds = new Set(days.map(d => d.id));
    const seeded = PPData.listRaces({ meetId }).filter(r => dayIds.has(r.raceDayId));
    const created = days.reduce((acc, d) => acc.concat(PPStore.listCreatedRaces(d.id)), []);
    return seeded.concat(created);
  }
  // PPData.shipProgram() falls back to the FIRST ship-and-win program in the
  // whole seed (a tour.html back-compat behavior we can't change at the
  // source) whenever a meet's own supplementProgramIds is empty — which would
  // silently show every program-less meet Churchill Downs' numbers. Guard
  // against that here instead of touching PPData.shipProgram itself.
  function shipProgramFor(meetId) {
    if (PPStore.getCreatedMeet(meetId)) return PPStore.getCreatedProgram(meetId);
    const meet = PPData.getMeet(meetId);
    if (!meet || !meet.supplementProgramIds || !meet.supplementProgramIds.length) return null;
    return PPData.shipProgram(meetId);
  }
  function raceDayFor(id) {
    if (!id || PPStore.isRaceDayDeleted(id)) return null;
    return PPData.getRaceDay(id) || PPStore.getCreatedRaceDay(id) || null;
  }
  // Inclusive count of calendar days a meet spans, or null if start/end aren't set.
  function meetDaySpan(meet) {
    if (!meet || !meet.start || !meet.end) return null;
    const s = new Date(meet.start + 'T00:00:00');
    const e = new Date(meet.end + 'T00:00:00');
    if (isNaN(s) || isNaN(e) || e < s) return null;
    return Math.round((e - s) / 86400000) + 1;
  }

  function raceTrackId(race) {
    const rd = raceDayFor(race.raceDayId);
    const meet = rd ? meetFor(rd.meetId) : null;
    return meet ? meet.track : 'CD';
  }
  function isQuarterHorseRace(race) { return raceTrackId(race) === 'DED'; }
  function meetIdForRace(race) {
    if (race.meetId) return race.meetId;
    const rd = PPData.getRaceDay(race.raceDayId);
    return rd ? rd.meetId : CD_MEET;
  }
  // Per-horse ctx builder for the engine: real ship miles + active program.
  function ctxFor(race) {
    const trackId = raceTrackId(race);
    const entrants = entrantHorses(race.id);
    const program = shipProgramFor(meetIdForRace(race));
    return function (h) {
      const mi = PPData.shipMiles(h.home, trackId);
      return { entrants, shipMi: (mi != null ? mi : h.shipMi), program, today: PPData.today };
    };
  }

  function sexLabel(sexes) {
    if (!sexes || !sexes.length) return 'Open';
    const set = new Set(sexes);
    const male = set.has('G') || set.has('C') || set.has('H') || set.has('R');
    if (!male && (set.has('F') || set.has('M'))) return 'F&M';
    return 'Open';
  }
  function surfLabel(race) { return (race.isTurf || race.surface === 'T') ? 'Turf' : race.surface === 'A' ? 'AWT' : 'Dirt'; }
  // Quarter Horse races quote distance in yards; Thoroughbred races in furlongs.
  function distanceLabel(race) { return isQuarterHorseRace(race) ? race.distanceYards + ' yards' : furlongs(race.distanceYards); }
  // "MSW · 6f Dirt · F&M 3yo+ · $85k" — the one-line condition summary.
  function condLine(race) {
    const c = race.conditions || {};
    return `${race.classLadder} · ${distanceLabel(race)} ${surfLabel(race)} · ${sexLabel(c.sexes)} ${c.minAge || 3}yo+ · ${fmtMoney(race.purse)}`;
  }
  function shortDay(day) {
    const d = new Date(day.date);
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  }

  // ===========================================================================
  // 0. Meets list — one card per meet, aggregate stats scoped to that meet.
  // ===========================================================================
  R['track/meets'] = function () {
    const D = PPData;
    const meets = D.listMeets().concat(PPStore.listCreatedMeets()).filter(m => !PPStore.isMeetDeleted(m.id));

    const cards = meets.map(meet => {
      const races = D.listRaces({ meetId: meet.id });
      let totalEntered = 0, underfilled = 0;
      races.forEach(r => { const e = enteredCount(r.id); totalEntered += e; if (e < r.fieldTarget.min) underfilled++; });
      const avg = races.length ? totalEntered / races.length : 0;
      const days = D.listRaceDays(meet.id);
      const prog = shipProgramFor(meet.id);
      const cap = (prog && prog.cap) || { totalBudget: 0, claimed: 0 };
      const raceIds = new Set(races.map(r => r.id));
      const reqOut = PPStore.requests.list().filter(r => raceIds.has(r.raceId)).length;
      const tag = underfilled === 0 ? pill('healthy', 'accent-soft')
        : pill(`${underfilled} underfilled`, underfilled <= 1 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700');

      return `
        <a href="#track/meet/${esc(meet.id)}" class="card ring-soft p-5 hover:border-indigo-300 transition block">
          <div class="flex items-center justify-between"><div class="font-semibold">${esc(meet.name)}</div>${tag}</div>
          <div class="text-xs text-slate-500 mt-1">${esc(meet.trackName || '')} · ${esc(meet.label || '')}</div>
          <div class="text-xs text-slate-500">${fmtDate(meet.start)} – ${fmtDate(meet.end)}</div>
          <div class="mt-3 text-sm text-slate-600">${days.length} race days · ${races.length} races</div>
          <div class="mt-2 flex items-center gap-2 text-xs">
            <div class="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden"><div class="h-full ${underfilled === 0 ? 'accent-bg' : underfilled <= 1 ? 'bg-amber-500' : 'bg-red-500'}" style="width:${Math.min(100, Math.round(avg / 9 * 100))}%"></div></div>
            <span class="text-slate-500">avg ${avg.toFixed(1)}</span>
          </div>
          <div class="mt-2 text-xs text-slate-500">ship-in pool ${fmtMoney(cap.totalBudget)} · ${reqOut} requests out</div>
        </a>`;
    }).join('');

    mount('track/meets', `
      <div>
        <div class="text-xs text-slate-500 uppercase tracking-wider">TRACK WORKSPACE</div>
        <h1 class="text-2xl font-semibold tracking-tight">Meets</h1>
        <div class="text-sm text-slate-600">${meets.length} meets · ${meets.filter(m => m.status === 'published').length} published</div>
      </div>
      <div class="grid lg:grid-cols-2 gap-4">${cards}</div>`);
  };

  // ===========================================================================
  // 0b. Build a meet — one-shot create flow. Mode A (no id) creates a meet;
  //     Mode B (id) adds race days and seeds draft races into it.
  // ===========================================================================
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white';
  R['track/meet-builder'] = function (meetId) {
    const D = PPData;

    // Mode B — an existing/created meet: add race days + races.
    if (meetId) {
      const meet = meetFor(meetId);
      if (!meet) { mount('track/meet-builder', '<div class="text-sm text-slate-500">Meet not found.</div>'); return; }
      const days = raceDaysForMeet(meetId);
      const races = racesForMeet(meetId);

      const dayRows = days.map(day => {
        const rc = D.listRaces({ raceDayId: day.id }).concat(PPStore.listCreatedRaces(day.id)).length;
        return `
          <div class="px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <div class="font-medium">${esc(day.label || 'Race day')}</div>
              <div class="text-xs text-slate-500">${day.date ? fmtDate(day.date) : ''} · ${rc} race${rc === 1 ? '' : 's'}</div>
            </div>
            <div class="flex items-center gap-2">
              <button class="pp-create-race text-sm px-3 py-1.5 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5" data-race-day-id="${esc(day.id)}" data-meet-id="${esc(meetId)}"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Add race</button>
              <button class="pp-delete-raceday text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 inline-flex items-center gap-1.5" data-day-id="${esc(day.id)}" title="Delete race day"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
          </div>`;
      }).join('') || '<div class="px-5 py-8 text-center text-sm text-slate-500">No race days yet — add one above to get started.</div>';

      const totalDays = meetDaySpan(meet);
      const atCap = totalDays != null && days.length >= totalDays;
      const spanNote = totalDays != null
        ? ` ${days.length} of ${totalDays} day${totalDays === 1 ? '' : 's'} scheduled.`
        : '';
      const addDayForm = atCap
        ? `<div class="card ring-soft p-5">
             <div class="font-semibold">Add a race day</div>
             <div class="mt-2 text-sm text-slate-600">All ${totalDays} day${totalDays === 1 ? '' : 's'} of this meet already have race days.</div>
           </div>`
        : `<div class="card ring-soft p-5">
             <div class="font-semibold">Add a race day</div>
             <div class="text-xs text-slate-500">Give it a date and label, then add races to it below.${spanNote}</div>
             <div class="mt-4 grid sm:grid-cols-3 gap-x-4 gap-y-3 text-sm items-end">
               <label class="block"><div class="text-xs text-slate-500 mb-1">Date</div><input id="mb-day-date" type="date" required ${meet.start ? `min="${esc(meet.start)}"` : ''} ${meet.end ? `max="${esc(meet.end)}"` : ''} class="${inputCls}"></label>
               <label class="block"><div class="text-xs text-slate-500 mb-1">Label</div><input id="mb-day-label" type="text" required placeholder="e.g. Saturday, September 5" class="${inputCls}"></label>
               <button class="pp-create-raceday px-3 py-2 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center justify-center gap-1.5" data-meet-id="${esc(meetId)}"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Add race day</button>
             </div>
           </div>`;

      mount('track/meet-builder', `
        <div class="text-xs text-slate-500 flex items-center gap-1.5">
          <a href="#track/meets" class="hover:text-ink-900">Meets</a>
          <i data-lucide="chevron-right" class="w-3 h-3"></i>
          <a href="#track/meet/${esc(meetId)}" class="hover:text-ink-900">${esc(meet.name || meet.label || 'Meet')}</a>
          <i data-lucide="chevron-right" class="w-3 h-3"></i>
          <span class="text-ink-900 font-medium">Build</span>
        </div>
        <div class="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-wider">${esc(meet.trackName || meet.track || 'Track')} · ${esc(meet.label || 'meet')}</div>
            <h1 class="text-2xl font-semibold tracking-tight">${esc(meet.name || 'Meet')}</h1>
            <div class="text-sm text-slate-600">${days.length} race day${days.length === 1 ? '' : 's'} · ${races.length} race${races.length === 1 ? '' : 's'} so far</div>
          </div>
          <button class="pp-delete-meet text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 inline-flex items-center gap-1.5" data-meet-id="${esc(meetId)}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Delete meet</button>
        </div>

        ${addDayForm}

        <div class="card ring-soft">
          <div class="px-5 py-4 border-b border-slate-100"><div class="font-semibold">Race days</div><div class="text-xs text-slate-500">Add races to each day — each opens the race builder to spec it out.</div></div>
          <div class="divide-y divide-slate-100 text-sm">${dayRows}</div>
        </div>

        <a href="#track/meet/${esc(meetId)}" class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg accent-bg accent-bg-h text-white">Finish → go to meet dashboard</a>`);
      return;
    }

    // Mode A — fresh landing: create the meet itself.
    mount('track/meet-builder', `
      <div class="text-xs text-slate-500 flex items-center gap-1.5">
        <a href="#track/meets" class="hover:text-ink-900">Meets</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <span class="text-ink-900 font-medium">Build a meet</span>
      </div>
      <div>
        <div class="text-xs text-slate-500 uppercase tracking-wider">TRACK WORKSPACE</div>
        <h1 class="text-2xl font-semibold tracking-tight">Build a meet</h1>
        <div class="text-sm text-slate-600">Set up the meet, then add race days and races.</div>
      </div>

      <div class="card ring-soft p-5 max-w-2xl">
        <div class="font-semibold">Meet details</div>
        <div class="text-xs text-slate-500">Create the meet first — you'll add race days and races next.</div>
        <div class="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <label class="block"><div class="text-xs text-slate-500 mb-1">Track</div>${selectHtml('mb-track', D.listTracks().map(t => [t.id, t.name]), 'CD')}</label>
          <label class="block"><div class="text-xs text-slate-500 mb-1">Meet type</div>${selectHtml('mb-type', [['regular', 'Regular'], ['boutique', 'Boutique']], 'regular')}</label>
          <label class="block sm:col-span-2"><div class="text-xs text-slate-500 mb-1">Meet name</div><input id="mb-name" type="text" required placeholder="e.g. Keeneland — Fall 2026" class="${inputCls}"></label>
          <label class="block"><div class="text-xs text-slate-500 mb-1">Label</div><input id="mb-label" type="text" placeholder="e.g. Fall meet" class="${inputCls}"></label>
          <label class="block"></label>
          <label class="block"><div class="text-xs text-slate-500 mb-1">Start date</div><input id="mb-start" type="date" required class="${inputCls}"></label>
          <label class="block"><div class="text-xs text-slate-500 mb-1">End date</div><input id="mb-end" type="date" required class="${inputCls}"></label>
        </div>

        <div class="mt-4 pt-4 border-t border-slate-100">
          <label class="flex items-center gap-2 accent-text"><input type="checkbox" id="mb-bonus-on" checked class="rounded border-slate-300"><i data-lucide="truck" class="w-4 h-4"></i><span class="font-semibold text-ink-900">Include a Ship &amp; Win bonus program</span></label>
          <div class="mt-3 grid sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <label class="block"><div class="text-xs text-slate-500 mb-1">Bonus amount</div><input id="mb-bonus-amount" type="text" value="1500" class="${inputCls}"></label>
            <label class="block"><div class="text-xs text-slate-500 mb-1">Min ship miles</div><input id="mb-bonus-mi" type="number" value="150" step="25" class="${inputCls}"></label>
            <label class="block"><div class="text-xs text-slate-500 mb-1">Bonus pool budget</div><input id="mb-bonus-budget" type="text" value="30000" class="${inputCls}"></label>
          </div>
        </div>

        <div class="mt-5">
          <button class="pp-create-meet text-sm px-4 py-2 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Create meet →</button>
        </div>
      </div>`);
  };

  // ===========================================================================
  // 1. Meet overview — computed KPIs, race-day cards, ship-in bonus panel.
  // ===========================================================================
  R['scr-track-meet'] = function (meetId) {
    const D = PPData;
    const mid = meetId || CD_MEET;
    const meet = meetFor(mid);
    if (!meet) { mount('scr-track-meet', '<div class="text-sm text-slate-500">Meet not found.</div>'); return; }
    const races = racesForMeet(mid);
    const days = raceDaysForMeet(mid);
    const prog = shipProgramFor(mid);
    const cap = (prog && prog.cap) || { totalBudget: 0, claimed: 0 };

    let totalEntered = 0, underfilled = 0;
    races.forEach(r => { const e = enteredCount(r.id); totalEntered += e; if (e < r.fieldTarget.min) underfilled++; });
    const avg = races.length ? totalEntered / races.length : 0;
    const reqOut = PPStore.requests.list().length;

    const barns = D.listStallBarns(mid);
    const stallApps = D.listStallApplications(mid).map(a => PPStore.stallFor(a.id));
    const pendingCount = stallApps.filter(a => a.status === 'pending').length;

    const dayCards = days.map(day => {
      const dr = D.listRaces({ raceDayId: day.id }).concat(PPStore.listCreatedRaces(day.id));
      let ent = 0, soft = 0;
      dr.forEach(r => { const e = enteredCount(r.id); ent += e; if (e < r.fieldTarget.min) soft++; });
      const dAvg = dr.length ? ent / dr.length : 0;
      const barCls = soft === 0 ? 'accent-bg' : soft <= 1 ? 'bg-amber-500' : 'bg-red-500';
      const tag = soft === 0 ? pill('healthy', 'accent-soft')
        : pill(`${soft} underfilled`, soft <= 1 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700');
      return `
        <a href="#track/raceday/${esc(day.id)}" class="card ring-soft p-5 hover:border-indigo-300 transition block">
          <div class="flex items-center justify-between"><div class="font-semibold">${esc(day.label)}</div>${tag}</div>
          <div class="text-xs text-slate-500 mt-1">${dr.length} races · ${esc(day.status)}</div>
          <div class="mt-3 flex items-center gap-2 text-xs">
            <div class="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden"><div class="h-full ${barCls}" style="width:${Math.min(100, Math.round(dAvg / 9 * 100))}%"></div></div>
            <span class="text-slate-500">avg ${dAvg.toFixed(1)}</span>
          </div>
        </a>`;
    }).join('');

    mount('scr-track-meet', `
      <div class="text-xs text-slate-500 flex items-center gap-1.5">
        <a href="#track/meets" class="hover:text-ink-900">Meets</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <span class="text-ink-900 font-medium">${esc(meet.name || meet.label || 'Meet')}</span>
      </div>
      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wider">${esc(meet.trackName || 'Churchill Downs')} · ${esc(meet.label || 'meet')}</div>
          <h1 class="text-2xl font-semibold tracking-tight">${esc(meet.name || 'Summer meet')}</h1>
          <div class="text-sm text-slate-600">${days.length} race days · ${races.length} races · <span class="text-red-600 font-medium">${underfilled} underfilled</span> · ship-in pool ${fmtMoney(cap.totalBudget)}</div>
        </div>
        <div class="flex items-center gap-2">
          <a href="#track/meet-builder/${esc(mid)}" class="text-sm px-3 py-1.5 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Build a race</a>
          <button class="pp-delete-meet text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 inline-flex items-center gap-1.5" data-meet-id="${esc(mid)}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Delete meet</button>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Avg field, meet</div><div class="mt-1 text-2xl font-semibold">${avg.toFixed(1)}</div><div class="text-xs text-slate-500">across ${races.length} races</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Underfilled races</div><div class="mt-1 text-2xl font-semibold text-red-600">${underfilled}</div><div class="text-xs text-slate-500">below field minimum</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Ship-in bonus pool</div><div class="mt-1 text-2xl font-semibold">${fmtMoney(cap.totalBudget)}</div><div class="text-xs accent-text">${fmtMoney(cap.claimed)} committed</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Requests out</div><div class="mt-1 text-2xl font-semibold">${reqOut}</div><div class="text-xs text-slate-500">awaiting trainers</div></div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">${dayCards}</div>

      <a href="#track/stalls/${esc(mid)}" class="card ring-soft p-5 hover:border-indigo-300 transition flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg accent-soft flex items-center justify-center"><i data-lucide="warehouse" class="w-5 h-5"></i></div>
          <div><div class="font-semibold">Stalls &amp; ship-ins</div><div class="text-xs text-slate-500">${barns.length} barns · ${pendingCount} pending</div></div>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
      </a>

      ${prog ? `
      <div class="card ring-soft p-5 stripe">
        <div class="flex items-center gap-2 accent-text"><i data-lucide="truck" class="w-4 h-4"></i><div class="font-semibold">${esc(prog.label || 'Ship & Win')}, meet-wide</div></div>
        <div class="mt-2 text-sm text-slate-700">
          <span class="font-medium">${fmtMoney(prog.flatAmount)}</span> to any horse shipping in <span class="font-medium">≥ ${prog.eligibility.minShipMi} mi</span>, applied to underfilled non-stakes races. Individual races can override.
          <span class="text-slate-500">Pool ${fmtMoney(cap.totalBudget)} · ${fmtMoney(cap.claimed)} committed.</span>
        </div>
      </div>` : ''}`);
  };

  // ===========================================================================
  // 2. Race-day card — per-race fill rows (param raceDayId; null → first CD day).
  // ===========================================================================
  R['scr-track-raceday'] = function (param) {
    const D = PPData;
    const day = param ? raceDayFor(param) : D.listRaceDays(CD_MEET)[0];
    if (!day) { mount('scr-track-raceday', '<div class="text-sm text-slate-500">Race day not found.</div>'); return; }
    const meet = meetFor(day.meetId) || {};
    const races = D.listRaces({ raceDayId: day.id }).concat(PPStore.listCreatedRaces(day.id));

    let ent = 0, under = 0, openN = 0;
    races.forEach(r => { const e = enteredCount(r.id); ent += e; if (e < r.fieldTarget.min) under++; if (r.entryClose > D.today) openN++; });
    const avg = races.length ? ent / races.length : 0;

    const rows = races.map(r => {
      const e = enteredCount(r.id);
      const fs = fillState(e, r.fieldTarget.min);
      const short = r.fieldTarget.min - e;
      const rowBg = short > 2 ? 'bg-red-50/40' : short > 0 ? 'bg-amber-50/40' : '';
      const fp = PPEngine.fillProbability(r, e);
      const fpChip = fp ? `<span class="pill ${fp.bucket === 'likely' ? 'accent-soft' : fp.bucket === 'atRisk' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}" title="${esc(fp.detail)}">${esc(fp.label)} · ${Math.round(fp.prob * 100)}%</span>` : '';
      const action = short > 0
        ? `<a href="#track/race/${esc(r.id)}" class="pill bg-red-600 text-white">Outreach</a>`
        : `<a href="#track/race/${esc(r.id)}" class="pill accent-soft">Open builder</a>`;
      return `
        <div class="px-5 py-4 grid grid-cols-12 gap-3 items-center ${rowBg}">
          <div class="col-span-1 font-mono text-slate-500">R${r.raceNumber}</div>
          <div class="col-span-4"><div class="font-medium">${esc(r.classLadder)} ${fmtMoney(r.purse)}</div><div class="text-xs text-slate-500">${esc(condLine(r))}</div></div>
          <div class="col-span-3"><div class="text-xs text-slate-500">Entries</div>
            <div class="flex items-center gap-2 mt-0.5"><div class="font-medium ${short > 0 ? 'text-red-700' : ''}">${e}</div>
              <div class="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden"><div class="h-full ${fs.bar}" style="width:${fs.pct}%"></div></div>
              <div class="text-xs text-slate-500">/ ${r.fieldTarget.min}</div></div></div>
          <div class="col-span-3 text-xs ${short > 0 ? 'text-red-700' : 'text-slate-500'}">${fpChip}<div class="mt-1">${esc(fs.note)}</div></div>
          <div class="col-span-1 text-right">${action}</div>
        </div>`;
    }).join('');

    mount('scr-track-raceday', `
      <div class="text-xs text-slate-500 flex items-center gap-1.5">
        <a href="#track/meet/${esc(meet.id)}" class="hover:text-ink-900">${esc(meet.label || 'Meet')}</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <span class="text-ink-900 font-medium">${esc(day.label)}</span>
      </div>
      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wider">${esc(meet.trackName || 'Churchill Downs')} · ${esc(meet.label || 'meet')}</div>
          <h1 class="text-2xl font-semibold tracking-tight">Race day — ${esc(day.label)}</h1>
          <div class="text-sm text-slate-600">${races.length} races · ${openN} open for entry · <span class="text-red-600 font-medium">${under} underfilled</span></div>
        </div>
        <div class="flex items-center gap-2">
          <button class="pp-create-race text-sm px-3 py-1.5 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5" data-race-day-id="${esc(day.id)}" data-meet-id="${esc(meet.id || '')}"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Add race</button>
          <button class="pp-delete-raceday text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 inline-flex items-center gap-1.5" data-day-id="${esc(day.id)}" data-after-delete="#track/meet/${esc(meet.id || '')}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Delete race day</button>
        </div>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Avg field size</div><div class="mt-1 text-2xl font-semibold">${avg.toFixed(1)}</div><div class="text-xs text-slate-500">this card</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Underfilled races</div><div class="mt-1 text-2xl font-semibold text-red-600">${under}</div><div class="text-xs text-slate-500">need outreach</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Open for entry</div><div class="mt-1 text-2xl font-semibold">${openN}</div><div class="text-xs text-slate-500">entries not closed</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Status</div><div class="mt-1 text-2xl font-semibold capitalize">${esc(day.status)}</div></div>
      </div>
      <div class="card ring-soft">
        <div class="px-5 py-4 border-b border-slate-100"><div class="font-semibold">Card</div><div class="text-xs text-slate-500">Live fill from entries, submissions & accepted requests</div></div>
        <div class="divide-y divide-slate-100 text-sm">${rows || '<div class="px-5 py-8 text-center text-sm text-slate-500">No races on this card.</div>'}</div>
      </div>`);
  };

  // ===========================================================================
  // 3. Race builder — spec form + fill + who's-in + engine fits (param raceId).
  // ===========================================================================
  function selectHtml(id, options, selected) {
    const opts = options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`).join('');
    return `<select id="${id}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white">${opts}</select>`;
  }
  function distOptions(race) {
    const qh = isQuarterHorseRace(race);
    const table = qh ? QH_DISTANCES : DISTANCES;
    const sel = race.distanceYards;
    const list = table.slice();
    if (!list.some(d => d[0] === sel)) list.push([sel, qh ? sel + ' yards' : furlongs(sel)]);
    return list;
  }
  function restrictOf(race) {
    const c = race.conditions || {};
    if (c.minAge === 2) return '2U';
    return sexLabel(c.sexes) === 'F&M' ? 'FM3U' : '3U';
  }
  function typeOf(race) {
    if (TYPE_OF_CLASS[race.classLadder]) return TYPE_OF_CLASS[race.classLadder];
    return ['Listed', 'G3', 'G2', 'G1'].indexOf(race.classLadder) >= 0 ? 'N' : 'A';
  }

  function fitRow(h, s, raceId) {
    const acceptCls = s.accept >= 75 ? 'accent-soft' : s.accept >= 55 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
    const shipTxt = s.ship.shipMi === 0 ? 'In barn' : `Ship ${s.ship.shipMi} mi from ${esc(h.home)}`;
    const bonusBadge = s.ship.bonus > 0
      ? pill('+' + fmtMoney(s.ship.bonus) + ' ship', 'accent-soft', 'truck')
      : (s.ship.shipIn ? pill('ship-in · below min', 'bg-slate-100 text-slate-500') : '');
    const sigBadges = (s.signals || []).map(x => pill(esc(x.label), 'bg-indigo-50 text-indigo-700', x.icon || '')).join('');
    const requested = PPStore.requests.find(h.id, raceId);
    const action = requested
      ? pill('Requested', 'bg-slate-100 text-slate-600', 'clock')
      : `<button class="pp-request text-sm px-3 py-1.5 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5" data-horse-id="${esc(h.id)}" data-race-id="${esc(raceId)}"><i data-lucide="send" class="w-3.5 h-3.5"></i>Request</button>`;
    return `
      <div class="px-5 py-3.5 grid grid-cols-12 gap-3 items-center">
        <div class="col-span-1">${scoreRing(s.fit)}</div>
        <div class="col-span-3"><div class="font-medium">${esc(h.name)}</div><div class="text-xs text-slate-500">${esc(h.sex)} ${h.age}yo · ${esc(h.stable)}</div></div>
        <div class="col-span-2"><div class="text-xs text-slate-500">Trainer</div><div>${esc(h.trainer)}</div></div>
        <div class="col-span-2"><span class="pill ${acceptCls}">Likely yes · ${s.accept}%</span>${s.drawIn ? '<div class="mt-1">' + drawInChip(s.drawIn) + '</div>' : ''}</div>
        <div class="col-span-2 text-xs text-slate-500">${shipTxt}<div class="mt-1 flex flex-wrap gap-1">${bonusBadge}${sigBadges}</div></div>
        <div class="col-span-2 text-right">${action}</div>
      </div>`;
  }

  R['scr-track-race'] = function (param) {
    const D = PPData;
    const raceId = param || 'cd-jun6-r3';
    const race = PPStore.raceFor(raceId);
    if (!race) { mount('scr-track-race', '<div class="text-sm text-slate-500">Race not found.</div>'); return; }
    const day = raceDayFor(race.raceDayId) || {};
    const meet = meetFor(meetIdForRace(race)) || {};
    const prog = shipProgramFor(meetIdForRace(race));

    const entries = entriesOf(raceId);
    const enteredIds = new Set(entries.map(e => e.horseId));
    const e = entries.length;
    const target = race.fieldTarget || { min: 8, max: 10 };
    const fs = fillState(e, target.min);

    const candidates = D.horses.filter(h => !enteredIds.has(h.id));
    const fits = PPEngine.fitsForRace(candidates, race, ctxFor(race));

    const whosIn = entries.map(en => {
      const h = D.getHorse(en.horseId); if (!h) return '';
      const label = en.source === 'submission' ? 'entered' : en.source === 'request' ? 'via request' : 'card';
      return `<div class="px-5 py-2.5 flex items-center justify-between">
        <div><span class="font-medium">${esc(h.name)}</span> <span class="text-xs text-slate-500">${esc(h.sex)} ${h.age}yo · ${esc(h.trainer)}</span></div>
        ${pill(label, 'bg-slate-100 text-slate-500')}</div>`;
    }).join('') || '<div class="px-5 py-4 text-sm text-slate-500">No entries yet — request qualifying horses below.</div>';

    const fitRows = fits.map(({ h, s }) => fitRow(h, s, raceId)).join('')
      || '<div class="px-5 py-8 text-center text-sm text-slate-500">No eligible horses match these conditions. Loosen the spec to widen the pool.</div>';

    const bonusAmount = race.bonusAmount != null ? race.bonusAmount : (prog ? prog.flatAmount : 1500);
    const bonusMi = race.bonusMi != null ? race.bonusMi : (prog ? prog.eligibility.minShipMi : 150);
    const reqCount = PPStore.requests.list({ raceId }).length;

    mount('scr-track-race', `
      <div class="text-xs text-slate-500 flex items-center gap-1.5">
        <a href="#track/meet/${esc(meet.id)}" class="hover:text-ink-900">${esc(meet.label || 'Meet')}</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <a href="#track/raceday/${esc(race.raceDayId)}" class="hover:text-ink-900">${esc(day.label || 'Race day')}</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <span class="text-ink-900 font-medium">R${race.raceNumber} · build</span>
      </div>

      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Build Race ${race.raceNumber} — ${esc(day.label || '')}</h1>
          <div class="text-sm text-slate-600">Spec the conditions, then PostParade ranks who fits and lets you request them.</div>
        </div>
        <span class="pill ${fs.pill.replace('pill ', '')}" id="rb-status-pill">${fs.label}</span>
      </div>

      <div class="grid lg:grid-cols-3 gap-4" data-race-id="${esc(raceId)}">
        <div class="card ring-soft p-5 lg:col-span-2">
          <div class="font-semibold">Race spec</div>
          <div class="text-xs text-slate-500">Edit any field — matches recompute on the right instantly.</div>
          <div class="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <label class="block"><div class="text-xs text-slate-500 mb-1">Race type</div>${selectHtml('rb-type', TYPES, typeOf(race))}</label>
            <label class="block"><div class="text-xs text-slate-500 mb-1">Surface</div>${selectHtml('rb-surface', SURFACES, race.surface)}</label>
            <label class="block"><div class="text-xs text-slate-500 mb-1">Distance</div>${selectHtml('rb-distance', distOptions(race), race.distanceYards)}</label>
            <label class="block"><div class="text-xs text-slate-500 mb-1">Purse</div><input id="rb-purse" type="text" value="${fmtMoney(race.purse)}" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"></label>
            <label class="block"><div class="text-xs text-slate-500 mb-1">Age / sex restriction</div>${selectHtml('rb-restrict', RESTRICTS, restrictOf(race))}</label>
            <label class="block"><div class="text-xs text-slate-500 mb-1">Field target (max)</div>${selectHtml('rb-target', TARGETS, String(target.max))}</label>
            <label class="block sm:col-span-2"><div class="text-xs text-slate-500 mb-1">Condition text</div>
              <textarea id="rb-conditions" rows="3" placeholder="e.g. FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD." class="w-full font-mono text-xs leading-relaxed p-3 rounded-lg bg-white border border-slate-200 focus:border-slate-400 focus:outline-none">${esc((race.conditions && race.conditions.text) || '')}</textarea></label>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <div class="flex items-center gap-2 accent-text"><i data-lucide="truck" class="w-4 h-4"></i><div class="font-semibold text-ink-900">Shipping bonus</div></div>
            <div class="mt-3 grid sm:grid-cols-3 gap-x-4 gap-y-3 text-sm items-end">
              <label class="block"><div class="text-xs text-slate-500 mb-1">Bonus amount</div><input id="rb-bonus" type="number" value="${bonusAmount}" step="250" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"></label>
              <label class="block"><div class="text-xs text-slate-500 mb-1">Min ship distance (mi)</div><input id="rb-bonus-mi" type="number" value="${bonusMi}" step="25" class="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"></label>
              <button class="pp-recompute px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Recompute</button>
            </div>
          </div>
        </div>

        <div class="card ring-soft p-5">
          <div class="font-semibold">Fill status</div>
          <div class="mt-3 flex items-center gap-2"><div class="text-3xl font-semibold">${e}</div><div class="text-slate-500">/ ${target.min} min · ${target.max} cap</div></div>
          <div class="mt-2 h-2 rounded bg-slate-100 overflow-hidden"><div class="h-full ${fs.bar}" style="width:${fs.pct}%"></div></div>
          <div class="mt-2 text-xs text-slate-500">${esc(fs.note)}</div>
          ${(() => {
            const fp = PPEngine.fillProbability(race, e);
            if (!fp) return '';
            const cls = fp.bucket === 'likely' ? 'accent-soft' : fp.bucket === 'atRisk' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
            return `<div class="mt-3 flex items-center justify-between rounded-lg px-3 py-2 ${cls}">
              <span class="text-sm font-medium">Will it go? ${esc(fp.label)}</span>
              <span class="text-sm font-semibold">${Math.round(fp.prob * 100)}%</span>
            </div><div class="mt-1 text-xs text-slate-400">${esc(fp.detail)}</div>`;
          })()}
          <div class="mt-4 pt-4 border-t border-slate-100 text-sm space-y-2">
            <div class="flex items-center justify-between"><span class="text-slate-500">Entries close</span><span class="font-medium">${fmtDate(race.entryClose)}</span></div>
            <div class="flex items-center justify-between"><span class="text-slate-500">Eligible, not entered</span><span class="font-medium">${fits.length}</span></div>
            <div class="flex items-center justify-between"><span class="text-slate-500">Requests sent</span><span class="font-medium">${reqCount}</span></div>
          </div>
        </div>
      </div>

      <div class="card ring-soft">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div><div class="font-semibold">Already in (${entries.length})</div><div class="text-xs text-slate-500">Seed card entries, trainer submissions & accepted requests</div></div>
        </div>
        <div class="divide-y divide-slate-100 text-sm">${whosIn}</div>
      </div>

      <div class="card ring-soft">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div><div class="font-semibold">Horses that fit this race</div><div class="text-xs text-slate-500">Eligible horses across stables · ranked by fit + likelihood to accept</div></div>
          <div class="text-xs text-slate-500 flex items-center gap-1.5"><i data-lucide="cpu" class="w-3.5 h-3.5"></i>PostParade recommendation engine</div>
        </div>
        <div class="divide-y divide-slate-100 text-sm">${fitRows}</div>
      </div>`);
  };

  // ===========================================================================
  // 4. Requests — outbound requests by status + entries received (submissions).
  // ===========================================================================
  function requestRow(r) {
    const D = PPData;
    const h = D.getHorse(r.horseId); const race = D.getRace(r.raceId);
    if (!h || !race) return '';
    const day = D.getRaceDay(race.raceDayId) || {};
    const s = PPEngine.shipping(h, race, ctxFor(race)(h));
    const bonus = s.bonus > 0 ? pill('+' + fmtMoney(s.bonus) + ' ship', 'accent-soft', 'truck') : '';
    return `
      <div class="px-5 py-3 grid grid-cols-12 gap-3 items-center">
        <div class="col-span-3"><div class="font-medium">${esc(h.name)}</div><div class="text-xs text-slate-500">${esc(h.trainer)}</div></div>
        <div class="col-span-4 text-xs text-slate-500">R${race.raceNumber} ${esc(race.classLadder)} · ${esc(day.label || '')}</div>
        <div class="col-span-3 text-xs text-slate-500">${s.shipMi === 0 ? 'In barn' : 'Ship ' + s.shipMi + ' mi'}${bonus ? '<div class="mt-1">' + bonus + '</div>' : ''}</div>
        <div class="col-span-2 text-right text-xs text-slate-400">${fmtDate(r.at)}</div>
      </div>`;
  }

  R['track/requests'] = function () {
    const reqs = PPStore.requests.list();
    const subs = PPStore.submissions.list();
    const groups = [
      ['sent', 'Awaiting trainer', 'clock', 'bg-amber-50 text-amber-700'],
      ['accepted', 'Accepted → entered', 'check-circle-2', 'accent-soft'],
      ['declined', 'Declined', 'x-circle', 'bg-red-50 text-red-700'],
    ];
    const groupHtml = groups.map(([st, label, icon, cls]) => {
      const list = reqs.filter(r => r.status === st);
      const items = list.map(requestRow).join('') || `<div class="px-5 py-3 text-sm text-slate-400">Nothing here yet.</div>`;
      return `
        <div class="card ring-soft">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div class="font-semibold flex items-center gap-2"><i data-lucide="${icon}" class="w-4 h-4"></i>${label}</div>
            <span class="pill ${cls}">${list.length}</span></div>
          <div class="divide-y divide-slate-100">${items}</div>
        </div>`;
    }).join('');

    const subItems = subs.map(s => {
      const h = PPData.getHorse(s.horseId); const race = PPData.getRace(s.raceId);
      if (!h || !race) return '';
      return `<div class="px-5 py-3 grid grid-cols-12 gap-3 items-center">
        <div class="col-span-4"><div class="font-medium">${esc(h.name)}</div><div class="text-xs text-slate-500">${esc(h.trainer)}</div></div>
        <div class="col-span-5 text-xs text-slate-500">R${race.raceNumber} ${esc(race.classLadder)}</div>
        <div class="col-span-3 text-right">${pill(esc(s.status), 'bg-slate-100 text-slate-600')}</div></div>`;
    }).join('') || '<div class="px-5 py-6 text-center text-sm text-slate-400">No trainer-initiated entries yet. Entries a trainer submits directly will appear here.</div>';

    mount('track/requests', `
      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Requests &amp; outreach</h1>
          <div class="text-sm text-slate-600">Every horse you've requested for a race, grouped by where it stands. Requests convert to entries when the trainer accepts.</div>
        </div>
        <a href="#track/meet/${CD_MEET}" class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Back to meet</a>
      </div>
      ${reqs.length === 0 ? `<div class="card ring-soft p-5 stripe text-sm text-slate-600"><span class="font-medium">No requests sent yet.</span> Open a race builder, find qualifying horses in the fits list, and hit <span class="accent-text font-medium">Request</span> to reach their trainers.</div>` : ''}
      <div class="grid lg:grid-cols-3 gap-4">${groupHtml}</div>
      <div class="card ring-soft">
        <div class="px-5 py-4 border-b border-slate-100"><div class="font-semibold">Entries received</div><div class="text-xs text-slate-500">Submissions trainers sent you directly (display-only)</div></div>
        <div class="divide-y divide-slate-100 text-sm">${subItems}</div>
      </div>`);
  };

  // ===========================================================================
  // 5. Field strength — per-day board, strength per race, soft conditions,
  //    trainer activity. All computed from live entries + PPEngine.fieldStrength.
  // ===========================================================================
  R['track/strength'] = function () {
    const D = PPData;
    const days = D.listRaceDays(CD_MEET);
    const races = D.listRaces({ meetId: CD_MEET });

    const board = days.map(day => {
      const dr = D.listRaces({ raceDayId: day.id });
      let ent = 0; dr.forEach(r => ent += enteredCount(r.id));
      const avg = dr.length ? ent / dr.length : 0;
      const cls = avg >= 8 ? 'accent-soft' : avg >= 7 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800';
      return `<div class="rounded-lg p-3 text-center ${cls}"><div class="text-xs">${esc(shortDay(day))}</div><div class="text-xs">${dr.length} races</div><div class="font-semibold">${avg.toFixed(1)}</div></div>`;
    }).join('');

    const strengthRows = races.map(r => {
      const ents = entrantHorses(r.id);
      const f = PPEngine.fieldStrength(ents, r);
      const cls = f.label === 'Strong' ? 'accent-soft' : f.label === 'Average' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-700';
      return `<div class="px-5 py-2.5 grid grid-cols-12 gap-2 items-center">
        <div class="col-span-1 font-mono text-slate-500">R${r.raceNumber}</div>
        <div class="col-span-6 text-slate-700">${esc(condLine(r))}</div>
        <div class="col-span-2 text-xs text-slate-500">${ents.length} in · index ${f.index}</div>
        <div class="col-span-3 text-right">${pill(f.label, cls)}</div></div>`;
    }).join('');

    const soft = races.map(r => ({ r, short: r.fieldTarget.min - enteredCount(r.id), fp: PPEngine.fillProbability(r, enteredCount(r.id)) }))
      .filter(x => x.short > 0).sort((a, b) => (a.fp ? a.fp.prob : 1) - (b.fp ? b.fp.prob : 1)).slice(0, 5);
    const softList = soft.map(({ r, short, fp }) => {
      const day = D.getRaceDay(r.raceDayId) || {};
      const icon = short > 2 ? 'text-red-600' : 'text-amber-600';
      const risk = fp && fp.bucket !== 'likely'
        ? ` <span class="pill ${fp.bucket === 'unlikely' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}" title="${esc(fp.detail)}">${Math.round(fp.prob * 100)}% to go</span>` : '';
      return `<li class="flex items-start gap-2"><i data-lucide="trending-down" class="w-4 h-4 ${icon} mt-0.5"></i>
        <span><span class="font-medium">${esc(r.classLadder)} ${distanceLabel(r)}</span> · ${esc(day.label || '')} — ${short} short of the ${r.fieldTarget.min}-horse minimum${risk}</span></li>`;
    }).join('') || '<li class="text-sm text-slate-400">Every condition is filling — nothing running soft.</li>';

    // Trainer activity: live submissions per stable, then head count on grounds.
    const subs = PPStore.submissions.list();
    const subByStable = {};
    subs.forEach(s => { const h = D.getHorse(s.horseId); if (h) subByStable[h.stableId] = (subByStable[h.stableId] || 0) + 1; });
    const act = D.listStables().map(st => ({ st, subs: subByStable[st.id] || 0, horses: D.listHorses({ stableId: st.id }).length }))
      .sort((a, b) => b.subs - a.subs || b.horses - a.horses).slice(0, 6);
    const actList = act.map(a => `
      <div class="flex items-center justify-between"><div>${esc(a.st.trainer)}</div>
        <div class="text-xs text-slate-500">${a.horses} on grounds${a.subs ? ' · ' + a.subs + ' submitted' : ''}</div></div>`).join('');

    mount('track/strength', `
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Field strength — ${esc((D.getMeet(CD_MEET) || {}).label || 'meet')}</h1>
        <div class="text-sm text-slate-600">Spot weak cards and short conditions before they cost handle.</div>
      </div>
      <div class="card ring-soft p-5">
        <div class="grid gap-2" style="grid-template-columns:repeat(${Math.max(days.length, 1)},minmax(0,1fr))">${board}</div>
        <div class="mt-3 text-xs text-slate-500">Average field size per race day. Red &lt; 7, amber 7–8, green ≥ 8.</div>
      </div>
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="card ring-soft p-5">
          <div class="font-semibold">Conditions running soft</div>
          <div class="text-xs text-slate-500 mb-3">Races most below their field minimum — consider rewriting or outreach.</div>
          <ul class="text-sm space-y-2">${softList}</ul>
        </div>
        <div class="card ring-soft p-5">
          <div class="font-semibold">Trainer activity</div>
          <div class="text-xs text-slate-500 mb-3">Stables on the grounds, ranked by live submissions.</div>
          <div class="space-y-2 text-sm">${actList}</div>
        </div>
      </div>
      <div class="card ring-soft">
        <div class="px-5 py-4 border-b border-slate-100"><div class="font-semibold">Field strength by race</div><div class="text-xs text-slate-500">Class rating + speed vs par across entered horses</div></div>
        <div class="divide-y divide-slate-100 text-sm">${strengthRows}</div>
      </div>`);
  };

  // ===========================================================================
  // 6. Stalls & ship-ins — read-only overview of barn capacity + applications.
  // ===========================================================================
  R['scr-track-stalls'] = function (meetId) {
    const D = PPData;
    const mid = meetId || CD_MEET;
    const meet = meetFor(mid);
    if (!meet) { mount('scr-track-stalls', '<div class="text-sm text-slate-500">Meet not found.</div>'); return; }

    const barns = D.listStallBarns(mid);
    const apps = D.listStallApplications(mid).map(a => PPStore.stallFor(a.id));
    const assignedIn = (barnId) => apps.filter(a => a.barnId === barnId && a.status === 'assigned').reduce((s, a) => s + a.horseCount, 0);

    const totalStalls = barns.reduce((s, b) => s + b.totalStalls, 0);
    const assignedTotal = barns.reduce((s, b) => s + assignedIn(b.id), 0);
    const openTotal = totalStalls - assignedTotal;
    const pendingCount = apps.filter(a => a.status === 'pending').length;

    const barnRows = barns.map(b => {
      const assigned = assignedIn(b.id);
      const fs = fillState(assigned, b.totalStalls);
      return `
        <div class="px-5 py-4 grid grid-cols-12 gap-3 items-center">
          <div class="col-span-4"><div class="font-medium">${esc(b.name)}</div><div class="text-xs text-slate-500">${b.totalStalls} stalls</div></div>
          <div class="col-span-6"><div class="flex items-center gap-2">
            <div class="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden"><div class="h-full ${fs.bar}" style="width:${fs.pct}%"></div></div>
            <div class="text-xs text-slate-500">${assigned}/${b.totalStalls}</div></div></div>
          <div class="col-span-2 text-right text-xs text-slate-500">${b.totalStalls - assigned} open</div>
        </div>`;
    }).join('') || '<div class="px-5 py-8 text-center text-sm text-slate-500">No barns configured for this meet.</div>';

    const prog = shipProgramFor(mid);
    const cap = (prog && prog.cap) || { totalBudget: 0, claimed: 0 };

    mount('scr-track-stalls', `
      <div class="text-xs text-slate-500 flex items-center gap-1.5">
        <a href="#track/meets" class="hover:text-ink-900">Meets</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <a href="#track/meet/${esc(meet.id)}" class="hover:text-ink-900">${esc(meet.name || meet.label || 'Meet')}</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <span class="text-ink-900 font-medium">Stalls &amp; ship-ins</span>
      </div>
      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wider">${esc(meet.trackName || 'Churchill Downs')} · ${esc(meet.label || 'meet')}</div>
          <h1 class="text-2xl font-semibold tracking-tight">Stalls &amp; ship-ins</h1>
          <div class="text-sm text-slate-600">${barns.length} barns · ${totalStalls} stalls · ${pendingCount} pending applications</div>
        </div>
        <a href="#track/stall-builder/${esc(mid)}" class="text-sm px-3 py-1.5 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5"><i data-lucide="clipboard-list" class="w-3.5 h-3.5"></i>Manage assignments →</a>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Total stalls</div><div class="mt-1 text-2xl font-semibold">${totalStalls}</div><div class="text-xs text-slate-500">across ${barns.length} barns</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Assigned</div><div class="mt-1 text-2xl font-semibold">${assignedTotal}</div><div class="text-xs accent-text">horses stabled</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Open</div><div class="mt-1 text-2xl font-semibold">${openTotal}</div><div class="text-xs text-slate-500">stalls available</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Pending applications</div><div class="mt-1 text-2xl font-semibold text-amber-600">${pendingCount}</div><div class="text-xs text-slate-500">awaiting assignment</div></div>
      </div>

      <div class="card ring-soft">
        <div class="px-5 py-4 border-b border-slate-100"><div class="font-semibold">Barns</div><div class="text-xs text-slate-500">Assigned horses vs. capacity per barn</div></div>
        <div class="divide-y divide-slate-100 text-sm">${barnRows}</div>
      </div>

      ${prog ? `
      <div class="card ring-soft p-5 stripe">
        <div class="flex items-center gap-2 accent-text"><i data-lucide="truck" class="w-4 h-4"></i><div class="font-semibold">${esc(prog.label || 'Ship & Win')}, meet-wide</div></div>
        <div class="mt-2 text-sm text-slate-700">
          <span class="font-medium">${fmtMoney(prog.flatAmount)}</span> to any horse shipping in <span class="font-medium">≥ ${prog.eligibility.minShipMi} mi</span>, applied to underfilled non-stakes races. Individual races can override.
          <span class="text-slate-500">Pool ${fmtMoney(cap.totalBudget)} · ${fmtMoney(cap.claimed)} committed.</span>
        </div>
      </div>` : ''}`);
  };

  // ===========================================================================
  // 7. Stall builder — interactive assignment tool (pending → assign/waitlist).
  // ===========================================================================
  function stallRow(a) {
    const D = PPData;
    const stable = D.getStable(a.stableId) || {};
    const prefName = (D.getStallBarn(a.preferredBarnId) || {}).name || '—';
    const assignedName = a.status === 'assigned' ? ((D.getStallBarn(a.barnId) || {}).name || '—') : '';
    const actions = a.status === 'pending'
      ? `<div class="mt-2 flex flex-wrap gap-2">
          <button class="pp-stall-assign text-xs px-2.5 py-1 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1" data-app-id="${esc(a.id)}" data-barn-id="${esc(a.preferredBarnId)}"><i data-lucide="check" class="w-3 h-3"></i>Assign to preferred barn</button>
          <button class="pp-stall-waitlist text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1" data-app-id="${esc(a.id)}"><i data-lucide="hourglass" class="w-3 h-3"></i>Waitlist</button>
        </div>`
      : '';
    return `
      <div class="px-5 py-3">
        <div class="flex items-center justify-between gap-3">
          <div><div class="font-medium">${esc(stable.name || 'Stable')}</div><div class="text-xs text-slate-500">${esc(stable.trainer || '')}</div></div>
          <div class="text-xs text-slate-500 text-right">${a.horseCount} horses</div>
        </div>
        <div class="mt-1 text-xs text-slate-500">Prefers ${esc(prefName)}${assignedName ? ' · <span class="accent-text font-medium">Assigned ' + esc(assignedName) + '</span>' : ''}</div>
        ${actions}
      </div>`;
  }

  R['scr-track-stall-builder'] = function (meetId) {
    const D = PPData;
    const mid = meetId || CD_MEET;
    const meet = D.getMeet(mid);
    if (!meet) { mount('scr-track-stall-builder', '<div class="text-sm text-slate-500">Meet not found.</div>'); return; }

    const apps = D.listStallApplications(mid).map(a => PPStore.stallFor(a.id));
    const barns = D.listStallBarns(mid);
    const assignedIn = (barnId) => apps.filter(a => a.barnId === barnId && a.status === 'assigned').reduce((s, a) => s + a.horseCount, 0);

    const capCards = barns.map(b => {
      const assigned = assignedIn(b.id);
      const fs = fillState(assigned, b.totalStalls);
      return `
        <div class="rounded-lg border border-slate-100 p-3">
          <div class="flex items-center justify-between"><div class="text-sm font-medium">${esc(b.name)}</div><div class="text-xs text-slate-500">${b.totalStalls - assigned} open</div></div>
          <div class="mt-2 flex items-center gap-2"><div class="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden"><div class="h-full ${fs.bar}" style="width:${fs.pct}%"></div></div><div class="text-xs text-slate-500">${assigned}/${b.totalStalls}</div></div>
        </div>`;
    }).join('') || '<div class="text-sm text-slate-500">No barns configured.</div>';

    const groups = [
      ['pending', 'Awaiting assignment', 'clock', 'bg-amber-50 text-amber-700'],
      ['assigned', 'Assigned', 'check-circle-2', 'accent-soft'],
      ['waitlisted', 'Waitlisted', 'hourglass', 'bg-red-50 text-red-700'],
    ];
    const groupHtml = groups.map(([st, label, icon, cls]) => {
      const list = apps.filter(a => a.status === st);
      const items = list.map(stallRow).join('') || `<div class="px-5 py-3 text-sm text-slate-400">Nothing here yet.</div>`;
      return `
        <div class="card ring-soft">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div class="font-semibold flex items-center gap-2"><i data-lucide="${icon}" class="w-4 h-4"></i>${label}</div>
            <span class="pill ${cls}">${list.length}</span></div>
          <div class="divide-y divide-slate-100">${items}</div>
        </div>`;
    }).join('');

    mount('scr-track-stall-builder', `
      <div class="text-xs text-slate-500 flex items-center gap-1.5">
        <a href="#track/meets" class="hover:text-ink-900">Meets</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <a href="#track/meet/${esc(meet.id)}" class="hover:text-ink-900">${esc(meet.name || meet.label || 'Meet')}</a>
        <i data-lucide="chevron-right" class="w-3 h-3"></i>
        <span class="text-ink-900 font-medium">Stalls</span>
      </div>
      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wider">${esc(meet.trackName || 'Churchill Downs')} · ${esc(meet.label || 'meet')}</div>
          <h1 class="text-2xl font-semibold tracking-tight">Stall assignments</h1>
          <div class="text-sm text-slate-600">Assign pending applications to barns or waitlist them. Capacity updates live.</div>
        </div>
        <a href="#track/stalls/${esc(mid)}" class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Back to overview</a>
      </div>

      <div class="card ring-soft p-5">
        <div class="font-semibold">Barn capacity</div>
        <div class="text-xs text-slate-500 mb-3">Remaining stalls per barn — assigning fills these live.</div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${capCards}</div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">${groupHtml}</div>`);
  };

  // ---- Delegated interactivity (wired once) --------------------------------
  function onClick(ev) {
    const reqBtn = ev.target.closest && ev.target.closest('.pp-request');
    if (reqBtn) {
      const horseId = reqBtn.getAttribute('data-horse-id');
      const raceId = reqBtn.getAttribute('data-race-id');
      if (horseId && raceId) {
        PPStore.requests.add({ horseId, raceId });
        const h = PPData.getHorse(horseId);
        toast('Request sent to ' + ((h && h.trainer) || 'trainer'));
        window.rerender();
      }
      return;
    }
    const recomputeBtn = ev.target.closest && ev.target.closest('.pp-recompute');
    if (recomputeBtn) {
      const scope = recomputeBtn.closest('[data-race-id]');
      const raceId = scope && scope.getAttribute('data-race-id');
      if (raceId) saveRaceSpec(raceId);
      window.rerender();
      return;
    }

    const createMeetBtn = ev.target.closest && ev.target.closest('.pp-create-meet');
    if (createMeetBtn) {
      const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
      const meetStart = val('mb-start'), meetEnd = val('mb-end');
      if (!val('mb-name') || !meetStart || !meetEnd) { toast('Enter a meet name, start date, and end date'); return; }
      if (meetStart > meetEnd) { toast('Start date must be before the end date'); return; }
      const trackId = val('mb-track');
      const trackObj = PPData.getTrack(trackId) || {};
      const bonusOn = document.getElementById('mb-bonus-on');
      let supplementProgramIds = [];
      if (bonusOn && bonusOn.checked) {
        const prog = PPStore.createShipProgram({
          label: 'Ship & Win',
          flatAmount: parseMoney(val('mb-bonus-amount')),
          eligibility: { minShipMi: +val('mb-bonus-mi') || 0 },
          cap: { totalBudget: parseMoney(val('mb-bonus-budget')), claimed: 0 },
        });
        supplementProgramIds = [prog.id];
      }
      const meet = PPStore.createMeet({
        track: trackId,
        trackName: trackObj.name || trackId,
        name: val('mb-name') || 'New meet',
        label: val('mb-label') || 'New meet',
        start: val('mb-start'),
        end: val('mb-end'),
        meetType: val('mb-type') || 'regular',
        status: 'draft',
        supplementProgramIds,
      });
      toast('Meet created — now add race days');
      location.hash = '#track/meet-builder/' + meet.id;
      return;
    }
    const createDayBtn = ev.target.closest && ev.target.closest('.pp-create-raceday');
    if (createDayBtn) {
      const meetId = createDayBtn.getAttribute('data-meet-id');
      const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
      const date = val('mb-day-date');
      const label = val('mb-day-label');
      if (!date || !label) { toast('Enter a date and label for the race day'); return; }
      const meet = meetFor(meetId);
      if (meet && meet.start && date < meet.start) { toast('Date is before the meet starts'); return; }
      if (meet && meet.end && date > meet.end) { toast('Date is after the meet ends'); return; }
      const existingDays = raceDaysForMeet(meetId);
      if (existingDays.some(d => d.date === date)) { toast('This meet already has a race day on that date'); return; }
      const span = meetDaySpan(meet);
      if (span != null && existingDays.length >= span) { toast('This meet already has race days for all ' + span + ' days'); return; }
      PPStore.createRaceDay({ meetId, date, label, status: 'draft' });
      toast('Race day added');
      window.rerender();
      return;
    }
    const createRaceBtn = ev.target.closest && ev.target.closest('.pp-create-race');
    if (createRaceBtn) {
      const raceDayId = createRaceBtn.getAttribute('data-race-day-id');
      const meetId = createRaceBtn.getAttribute('data-meet-id');
      const existing = PPData.listRaces({ raceDayId }).concat(PPStore.listCreatedRaces(raceDayId));
      const raceNumber = existing.length + 1;
      const day = raceDayFor(raceDayId);
      const race = PPStore.createRace({
        raceDayId, meetId, raceNumber,
        entryClose: day ? day.date : null,
        postTime: day ? day.date : null,
      });
      toast('Draft race ' + raceNumber + ' created — spec it out below');
      location.hash = '#track/race/' + race.id;
      return;
    }

    const deleteMeetBtn = ev.target.closest && ev.target.closest('.pp-delete-meet');
    if (deleteMeetBtn) {
      const meetId = deleteMeetBtn.getAttribute('data-meet-id');
      const meet = meetFor(meetId);
      if (!confirm('Delete "' + ((meet && (meet.name || meet.label)) || 'this meet') + '" and all its race days? This cannot be undone.')) return;
      PPStore.deleteMeet(meetId);
      toast('Meet deleted');
      location.hash = '#track/meets';
      return;
    }
    const deleteDayBtn = ev.target.closest && ev.target.closest('.pp-delete-raceday');
    if (deleteDayBtn) {
      const dayId = deleteDayBtn.getAttribute('data-day-id');
      const day = raceDayFor(dayId);
      if (!confirm('Delete "' + ((day && day.label) || 'this race day') + '" and its races? This cannot be undone.')) return;
      PPStore.deleteRaceDay(dayId);
      toast('Race day deleted');
      const after = deleteDayBtn.getAttribute('data-after-delete');
      if (after) location.hash = after; else window.rerender();
      return;
    }

    const assignBtn = ev.target.closest && ev.target.closest('.pp-stall-assign');
    if (assignBtn) {
      const appId = assignBtn.getAttribute('data-app-id');
      const barnId = assignBtn.getAttribute('data-barn-id');
      PPStore.overrideStall(appId, { status: 'assigned', barnId });
      const app = PPStore.stallFor(appId);
      const stable = app && PPData.getStable(app.stableId);
      toast(((stable && stable.name) || 'Stable') + ' assigned a stall');
      window.rerender();
      return;
    }
    const waitlistBtn = ev.target.closest && ev.target.closest('.pp-stall-waitlist');
    if (waitlistBtn) {
      const appId = waitlistBtn.getAttribute('data-app-id');
      PPStore.overrideStall(appId, { status: 'waitlisted' });
      const app = PPStore.stallFor(appId);
      const stable = app && PPData.getStable(app.stableId);
      toast(((stable && stable.name) || 'Stable') + ' waitlisted');
      window.rerender();
      return;
    }
  }

  // Reads every rb-* field for the given race and saves it as one patch —
  // shared by onChange (fires on blur/select) and the Recompute button (which
  // must commit whatever's currently typed, even in an un-blurred number
  // input, before re-rendering — otherwise a value typed but not yet
  // committed gets silently discarded by the re-render).
  function saveRaceSpec(raceId) {
    const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const restrict = val('rb-restrict'), type = val('rb-type');
    const base = PPStore.raceFor(raceId) || {};
    const baseMin = (base.fieldTarget && base.fieldTarget.min) || Math.max(2, (+val('rb-target')) - 2);
    const patch = {
      surface: val('rb-surface'),
      distanceYards: +val('rb-distance'),
      purse: parseMoney(val('rb-purse')),
      classLadder: CLASS_OF_TYPE[type] || 'Alw',
      fieldTarget: { min: Math.min(baseMin, +val('rb-target')), max: +val('rb-target') },
      bonusAmount: parseMoney(val('rb-bonus')),
      bonusMi: +val('rb-bonus-mi') || 0,
      conditions: {
        sexes: restrict.charAt(0) === 'F' ? ['F', 'M'] : ['F', 'M', 'G', 'C', 'H', 'R'],
        minAge: restrict.indexOf('2') >= 0 ? 2 : 3,
        maidenOnly: (type === 'S' || type === 'M'),
        text: val('rb-conditions'),
      },
    };
    PPStore.overrideRace(raceId, patch);
  }

  function onChange(ev) {
    const t = ev.target;
    if (!t || !t.id || t.id.indexOf('rb-') !== 0) return;
    const scope = t.closest('[data-race-id]');
    const raceId = scope && scope.getAttribute('data-race-id');
    if (!raceId) return;
    saveRaceSpec(raceId);
    window.rerender();
  }

  if (!window.__ppTrackWired) {
    window.__ppTrackWired = true;
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
  }
})();
