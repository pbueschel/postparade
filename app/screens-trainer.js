/* Trainer workspace screen renderers (classic script — globals).
 *
 * Registers data-driven renderers on window.PPRenderers under each trainer
 * section id. The app-shell router (app.html) empties the section shells and
 * calls PPRenderers[sectionId](param) on every navigation, then runs
 * lucide.createIcons(); these renderers own each section's full innerHTML and
 * recompute every number from PPData/PPEngine/PPStore. All interpolated data is
 * routed through esc(). One document-level delegated click listener (bottom of
 * file) handles Submit / Accept / Decline and re-renders via window.rerender().
 */
(function (global) {
  'use strict';

  const R = global.PPRenderers = global.PPRenderers || {};

  // ---- resolution + join helpers ------------------------------------------
  function demoStable() {
    return PPData.demoStable() ||
      { id: 'snellgrove', name: 'Snellgrove Racing', trainer: 'Jack Snellgrove' };
  }
  function stableHorses() {
    return PPData.listHorses({ stableId: demoStable().id }) || [];
  }
  function horseOr(id, fallback) {
    return PPData.getHorse(id) || PPData.getHorse(fallback) ||
      stableHorses()[0] || PPData.horses[0] || null;
  }
  function meetOfRace(r) {
    if (!r) return null;
    if (r.meetId) return r.meetId;
    const rd = PPData.getRaceDay(r.raceDayId);
    return rd && rd.meetId;
  }
  function trackIdOfRace(r) {
    const m = PPData.getMeet(meetOfRace(r));
    return m && m.track;
  }
  // Merge any track-side spec edits (the race builder persists overrides).
  function raceMerged(id) {
    return (PPStore.raceFor && PPStore.raceFor(id)) || PPData.getRace(id);
  }
  function openRaces() {
    return (PPData.listRaces({ openOnly: true }) || []).map(r => raceMerged(r.id) || r);
  }

  // Engine ctx builder: returns (race)=>ctx per the engine contract. `program`
  // is resolved from the race's own meet so ship-in bonuses reflect the right
  // supplement program (CD vs Ellis) rather than always the default.
  function ctxFor(h) {
    return function (race) {
      const entrants = (PPStore.entriesForRace(race.id) || [])
        .map(e => PPData.getHorse(e.horseId)).filter(Boolean);
      const mi = PPData.shipMiles(h.home, trackIdOfRace(race));
      return {
        entrants,
        shipMi: mi != null ? mi : h.shipMi,
        today: PPData.today,
        program: PPData.shipProgram(meetOfRace(race)),
      };
    };
  }

  // ---- small formatters ----------------------------------------------------
  function trackName(r) { const t = PPData.getTrack(trackIdOfRace(r)); return t ? t.name : (r.trackName || 'Track'); }
  function raceLabel(r) { return trackName(r) + ' · R' + (r.raceNumber || '?'); }
  function classLabel(code) {
    const c = (PPEngine.CLASS_LADDER || []).find(x => x.code === code);
    return c ? c.label : (code || '');
  }
  function surfName(code) { return code === 'D' ? 'Dirt' : code === 'T' ? 'Turf' : (code || ''); }
  function sexAge(h) { return h.age + 'yo ' + h.sex; }
  function within(v, range) { return Array.isArray(range) && v >= range[0] && v <= range[1]; }
  function initial(name) { return (String(name || '?').trim()[0] || '?').toUpperCase(); }
  function raceMetaLine(r) {
    return [raceLabel(r), fmtDate(r.postTime), furlongs(r.distanceYards) + ' ' + surfName(r.surface),
      classLabel(r.classLadder), fmtMoney(r.purse)].join(' · ');
  }
  function snippet(text, n) {
    const s = String(text || '');
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  }
  function paint(id, html) { const n = document.getElementById(id); if (n) n.innerHTML = html; }

  // Entry-close countdown pill (color ramps as the deadline nears).
  function closePill(iso) {
    const d = daysUntil(iso);
    let cls = 'bg-slate-100 text-slate-600', txt = d + 'd to close';
    if (d <= 0) { cls = 'bg-red-50 text-red-700'; txt = 'Entries closed'; }
    else if (d <= 1) { cls = 'bg-red-50 text-red-700'; txt = d + 'd left'; }
    else if (d <= 3) { cls = 'bg-amber-50 text-amber-700'; txt = d + 'd left'; }
    return pill(esc(txt), cls, 'clock');
  }

  // ---- placement classification (drives the dashboard KPIs) ----------------
  const isLiveSub = (s) => s.status === 'submitted' || s.status === 'accepted';
  function hasLiveEntry(h) {
    const sub = PPStore.submissions.list({ horseId: h.id }).some(isLiveSub);
    const req = PPStore.requests.list({ horseId: h.id, status: 'accepted' }).length > 0;
    return sub || req;
  }
  function vetBarred(h) {
    return !!(h.vetList && h.vetList.listed && h.vetList.eligibleDate &&
      h.vetList.eligibleDate > PPData.today);
  }
  function needsPlacement(h) { return !hasLiveEntry(h) && !vetBarred(h); }

  // Submit-state for a horse+race: 'submitted' | 'requested' | 'open'.
  function submitState(horseId, raceId) {
    const sub = PPStore.submissions.find(horseId, raceId);
    if (sub && sub.status !== 'withdrawn') return 'submitted';
    if (PPStore.requests.find(horseId, raceId)) return 'requested';
    return 'open';
  }
  function submitControl(h, race, eligible) {
    const st = submitState(h.id, race.id);
    if (st === 'submitted') return pill('Submitted', 'accent-soft', 'check-circle-2');
    if (st === 'requested') {
      return `<a href="#trainer/requests" class="pill bg-indigo-50 text-indigo-700" title="A racing office requested this horse"><i data-lucide="inbox" class="w-3 h-3"></i>Requested by track</a>`;
    }
    if (eligible === false) return pill('Ineligible', 'bg-slate-100 text-slate-500', 'x');
    return `<button class="pp-submit text-sm px-3 py-1.5 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5" data-horse-id="${esc(h.id)}" data-race-id="${esc(race.id)}"><i data-lucide="send" class="w-3.5 h-3.5"></i>Submit</button>`;
  }

  function breadcrumb(parts) {
    const sep = '<i data-lucide="chevron-right" class="w-3 h-3"></i>';
    return `<div class="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">${parts.map((p, i) => {
      const last = i === parts.length - 1;
      const inner = p.href && !last
        ? `<a href="${esc(p.href)}" class="hover:text-ink-900">${esc(p.label)}</a>`
        : `<span class="${last ? 'text-ink-900 font-medium' : ''}">${esc(p.label)}</span>`;
      return (i ? sep : '') + inner;
    }).join('')}</div>`;
  }

  // ========================================================================
  // DASHBOARD — computed KPIs, needs-placement ranking, closing + ship panels
  // ========================================================================
  R['dashboard'] = function () {
    const st = demoStable();
    const horses = stableHorses();
    const open = openRaces();

    // Score every barn horse once against the open condition book; reuse below.
    const perHorse = horses.map(h => ({ h, list: PPEngine.racesForHorse(h, open, ctxFor(h)) || [] }));

    const needs = horses.filter(needsPlacement);
    const liveSubs = horses.reduce((n, h) => n + PPStore.submissions.list({ horseId: h.id }).filter(isLiveSub).length, 0);
    const accReq = horses.reduce((n, h) => n + PPStore.requests.list({ horseId: h.id, status: 'accepted' }).length, 0);
    const entered = liveSubs + accReq;
    let wins = 0, starts = 0;
    horses.forEach(h => { wins += (h.record && h.record.careerWins) || 0; starts += (h.record && h.record.starts) || 0; });
    const winPct = starts ? Math.round(wins / starts * 100) : 0;

    // Needs-placement rows ranked by their single best open spot.
    const needIds = new Set(needs.map(h => h.id));
    const rows = perHorse.filter(p => needIds.has(p.h.id))
      .map(p => ({ h: p.h, best: p.list[0] || null }))
      .sort((a, b) => (b.best ? b.best.s.fit : -1) - (a.best ? a.best.s.fit : -1));
    const exposure = rows.reduce((sum, r) => sum + (r.best ? (r.best.race.purse || 0) : 0), 0);

    // Entries closing soonest.
    const closing = open.slice().sort((a, b) => String(a.entryClose).localeCompare(String(b.entryClose))).slice(0, 5);
    const closingSoon = closing.filter(r => daysUntil(r.entryClose) <= 3).length;

    // Best Ship & Win pairing across the whole barn.
    let ship = null;
    perHorse.forEach(p => p.list.forEach(rs => {
      if (rs.s.ship && rs.s.ship.bonus > 0 && (!ship || rs.s.fit > ship.s.fit)) {
        ship = { h: p.h, race: rs.race, s: rs.s };
      }
    }));

    const dateStr = new Date(PPData.today).toLocaleDateString('en-US',
      { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const firstName = String(st.trainer || 'there').split(' ')[0];

    const kpi = (label, value, sub) => `
      <div class="card ring-soft p-4">
        <div class="text-xs text-slate-500">${esc(label)}</div>
        <div class="mt-1 flex items-baseline gap-2">
          <div class="text-2xl font-semibold">${esc(value)}</div>
          ${sub ? `<div class="text-xs text-slate-500">${esc(sub)}</div>` : ''}
        </div>
      </div>`;

    const rowHtml = (r) => {
      const h = r.h;
      const best = r.best;
      const right = best
        ? `<div class="text-right"><div class="text-xs text-slate-500">Top spot</div><div class="font-semibold accent-text">${Math.round(best.s.fit)}</div></div>`
        : `<div class="text-right text-xs text-slate-400">No open spot</div>`;
      const sub = best
        ? `${esc(raceLabel(best.race))} · ${esc(fmtDate(best.race.postTime))} · ${esc(furlongs(best.race.distanceYards))} ${esc(surfName(best.race.surface))} · ${esc(fmtMoney(best.race.purse))}`
        : `${esc(h.record && h.record.starts ? 'Last out ' + fmtDate(h.lastStartDate) : 'Unraced')} · ${esc(h.daysSince)}d since last`;
      return `
        <div class="row-hover flex items-center gap-4 px-5 py-3.5">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-semibold text-slate-700">${esc(initial(h.name))}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <a href="#horse/${esc(h.id)}" class="font-medium hover:underline">${esc(h.name)}</a>
              <span class="pill ${h.maiden ? 'bg-turf-50 text-turf-700' : 'bg-slate-100 text-slate-600'}">${h.maiden ? 'Maiden' : 'Winner'} · ${esc(sexAge(h))}</span>
            </div>
            <div class="text-xs text-slate-500 mt-0.5 truncate">${sub}</div>
          </div>
          ${right}
          <a href="#recs/${esc(h.id)}" class="text-sm accent-text hover:underline whitespace-nowrap">See spots</a>
        </div>`;
    };

    const closingHtml = closing.length ? closing.map(r => `
      <div class="px-5 py-3">
        <div class="flex items-center justify-between gap-2">
          <a href="#race/${esc(r.id)}" class="font-medium hover:underline">${esc(raceLabel(r))}</a>
          ${closePill(r.entryClose)}
        </div>
        <div class="text-xs text-slate-500 mt-0.5">${esc(classLabel(r.classLadder))} · ${esc(furlongs(r.distanceYards))} ${esc(surfName(r.surface))} · ${esc(fmtMoney(r.purse))}</div>
      </div>`).join('') : `<div class="px-5 py-4 text-sm text-slate-500">No open races on the book.</div>`;

    const shipHtml = ship ? `
      <div class="mt-2 text-sm text-slate-700">
        <a href="#recs/${esc(ship.h.id)}" class="font-medium hover:underline">${esc(ship.h.name)}</a>
        ships ${esc(ship.s.ship.shipMi)} mi to <span class="font-medium">${esc(raceLabel(ship.race))}</span> and clears a
        <span class="font-semibold">${esc(fmtMoney(ship.s.ship.bonus))}</span> Ship &amp; Win check.
      </div>
      <a href="#race/${esc(ship.race.id)}" class="mt-3 inline-flex text-sm px-3 py-1.5 rounded-lg bg-ink-900 text-white">Review spot</a>`
      : `<div class="mt-2 text-sm text-slate-600">No shipping incentive matches the barn right now — every horse is stabled on the home circuit.</div>`;

    paint('dashboard', `
      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wider">${esc(dateStr)}</div>
          <h1 class="text-2xl font-semibold tracking-tight">Good morning, ${esc(firstName)}.</h1>
          <div class="text-sm text-slate-600">${esc(needs.length)} horse${needs.length === 1 ? '' : 's'} need a spot · ${esc(fmtMoney(exposure))} purse in play</div>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${kpi('Active horses', horses.length, null)}
        ${kpi('Need placement', needs.length, closingSoon ? closingSoon + ' closing soon' : 'all placed')}
        ${kpi('Entered', entered, 'live submissions + requests')}
        ${kpi('Win rate', winPct + '%', wins + ' of ' + starts + ' starts')}
      </div>

      <div class="grid lg:grid-cols-3 gap-4">
        <div class="card ring-soft lg:col-span-2">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div class="font-semibold">Needs placement</div>
              <div class="text-xs text-slate-500">Ranked by best available spot</div>
            </div>
            <span class="pill bg-slate-100 text-slate-600">${esc(rows.length)}</span>
          </div>
          <div class="divide-y divide-slate-100 text-sm">
            ${rows.length ? rows.map(rowHtml).join('') : `<div class="px-5 py-8 text-center text-sm text-slate-500">Every horse is entered or resting. Nice work.</div>`}
          </div>
        </div>

        <div class="space-y-4">
          <div class="card ring-soft">
            <div class="px-5 py-4 border-b border-slate-100">
              <div class="font-semibold">Entries closing soon</div>
              <div class="text-xs text-slate-500">Open races on your circuit</div>
            </div>
            <div class="divide-y divide-slate-100 text-sm">${closingHtml}</div>
          </div>

          <div class="card ring-soft stripe">
            <div class="px-5 py-4">
              <div class="flex items-center gap-2 text-turf-700">
                <i data-lucide="sparkles" class="w-4 h-4"></i>
                <div class="font-semibold">Suggested ship</div>
              </div>
              ${shipHtml}
            </div>
          </div>
        </div>
      </div>`);
  };

  // ========================================================================
  // HORSE PROFILE — record, status badges, fit profile, next-start panel
  // ========================================================================
  R['scr-horse'] = function (param) {
    const h = horseOr(param, 'zengraya');
    if (!h) { paint('scr-horse', `<div class="card ring-soft p-6 text-slate-500">Horse not found.</div>`); return; }

    const rec = h.record || { starts: 0, careerWins: 0 };
    const track = PPData.getTrack(h.home);

    // Status badges.
    const badges = [];
    badges.push(pill('Active', 'accent-soft', 'circle-dot'));
    if (h.maiden) badges.push(pill('Maiden', 'bg-slate-100 text-slate-600'));
    if (h.vetList && h.vetList.listed) {
      const barred = vetBarred(h);
      badges.push(pill(
        barred ? "Vet's list — eligible " + fmtDate(h.vetList.eligibleDate) : 'Vet-cleared ' + fmtDate(h.vetList.eligibleDate),
        barred ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700', 'stethoscope'));
    }
    if (h.medication && h.medication.firstTimeLasix) badges.push(pill('First-time Lasix', 'bg-sky-50 text-sky-700', 'droplet'));
    else if (h.medication && h.medication.lasix) badges.push(pill('Lasix', 'bg-slate-100 text-slate-600', 'droplet'));
    if (h.stateBred === 'KY') badges.push(pill('KY-bred', 'bg-turf-50 text-turf-700', 'flag'));
    if (h.equipment && h.equipment.changed) {
      badges.push(pill('Blinkers ' + (h.equipment.blinkers || 'change'), 'bg-amber-50 text-amber-700', 'glasses'));
    }

    const stat = (label, value, sub) => `
      <div><div class="text-xs text-slate-500">${esc(label)}</div><div class="font-semibold">${esc(value)}${sub ? ` <span class="text-xs text-slate-500 font-normal">${esc(sub)}</span>` : ''}</div></div>`;

    // Fit profile.
    const surfaces = (h.surf || []).map(surfName).join(' / ') || '—';
    const sweet = h.sweet ? furlongs(h.sweet[0]) + '–' + furlongs(h.sweet[1]) : '—';

    // Next start: top open spots, draw-in headline.
    const list = PPEngine.racesForHorse(h, openRaces(), ctxFor(h)) || [];
    const next = list.slice(0, 2);
    const nextHtml = next.length ? next.map(rs => {
      const r = rs.race;
      return `
        <div class="p-3 rounded-lg border border-slate-100">
          <div class="flex items-center justify-between gap-2">
            <a href="#race/${esc(r.id)}" class="font-medium hover:underline">${esc(raceLabel(r))}</a>
            ${scoreRing(rs.s.fit)}
          </div>
          <div class="text-xs text-slate-500 mt-1">${esc(fmtDate(r.postTime))} · ${esc(furlongs(r.distanceYards))} ${esc(surfName(r.surface))} · ${esc(fmtMoney(r.purse))}</div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">${drawInChip(rs.s.drawIn)}${closePill(r.entryClose)}</div>
        </div>`;
    }).join('') : `<div class="text-sm text-slate-500">No eligible open spot this cycle.</div>`;

    paint('scr-horse', `
      ${breadcrumb([{ label: 'Stable', href: '#dashboard' }, { label: 'Horses' }, { label: h.name }])}

      <div class="card ring-soft p-6">
        <div class="flex items-start gap-5 flex-wrap">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-2xl font-semibold">${esc(initial(h.name))}</div>
          <div class="flex-1 min-w-[240px]">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-2xl font-semibold tracking-tight">${esc(h.name)}</h1>
              ${badges.join('')}
            </div>
            <div class="text-sm text-slate-600 mt-1">${esc(sexAge(h))} · ${esc(h.stable || demoStable().name)}</div>
            <div class="text-sm text-slate-500 mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <span><i data-lucide="users" class="inline w-3.5 h-3.5 mr-1 -mt-0.5"></i>Trainer: ${esc(h.trainer || '—')}</span>
              <span><i data-lucide="home" class="inline w-3.5 h-3.5 mr-1 -mt-0.5"></i>Home: ${esc(track ? track.name : h.home)}</span>
            </div>
          </div>
          <a href="#recs/${esc(h.id)}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg accent-bg accent-bg-h text-white text-sm">
            <i data-lucide="target" class="w-4 h-4"></i>Find next start
          </a>
        </div>

        <div class="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          ${stat('Career', rec.starts + ' · ' + rec.careerWins + 'W', null)}
          ${stat('Last start', rec.starts ? fmtDate(h.lastStartDate) : '—', rec.starts ? h.daysSince + 'd ago' : 'unraced')}
          ${stat('Speed fig', h.lastSpeed || '—', h.lastSpeed ? 'last out' : '')}
          ${stat('Class rating', h.classR || '—', null)}
          ${stat('Home track', h.home || '—', null)}
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">
        <div class="card ring-soft lg:col-span-2 p-6">
          <div class="font-semibold">Fit profile</div>
          <div class="text-xs text-slate-500">Learned from past performances</div>
          <div class="mt-4 space-y-3 text-sm">
            <div class="flex items-center gap-3"><div class="w-32 text-slate-500">Surface</div><div class="flex-1 font-medium">${esc(surfaces)}</div></div>
            <div class="flex items-center gap-3"><div class="w-32 text-slate-500">Sweet-spot trip</div><div class="flex-1 font-medium">${esc(sweet)}</div></div>
            <div class="flex items-center gap-3"><div class="w-32 text-slate-500">Class rating</div><div class="flex-1 font-medium">${esc(h.classR || '—')}</div></div>
            <div class="flex items-center gap-3"><div class="w-32 text-slate-500">Freshness</div><div class="flex-1 font-medium">${rec.starts ? esc(h.daysSince + ' days since last start') : 'First-time starter'}</div></div>
          </div>
        </div>

        <div class="card ring-soft p-6 bg-gradient-to-br from-white to-turf-50">
          <div class="flex items-center gap-2">
            <i data-lucide="target" class="w-4 h-4 text-turf-700"></i>
            <div class="font-semibold">Next start</div>
          </div>
          <div class="text-xs text-slate-500 mt-1">Best open spots, draw-in odds headlined.</div>
          <div class="mt-4 space-y-3">${nextHtml}</div>
          <a href="#recs/${esc(h.id)}" class="mt-5 inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 rounded-lg accent-bg accent-bg-h text-white text-sm">
            Find next start <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </a>
        </div>
      </div>`);
  };

  // ========================================================================
  // RECOMMENDATIONS — ranked open spots for a horse, submit inline
  // ========================================================================
  R['scr-recs'] = function (param) {
    const h = horseOr(param, 'zengraya');
    if (!h) { paint('scr-recs', `<div class="card ring-soft p-6 text-slate-500">Horse not found.</div>`); return; }

    const list = (PPEngine.racesForHorse(h, openRaces(), ctxFor(h)) || []).slice(0, 5);

    const card = (rs) => {
      const r = rs.race, s = rs.s;
      const dist = r.distanceYards;
      const chips = [];
      if ((h.surf || []).includes(r.surface)) chips.push(pill(surfName(r.surface) + ' match', 'accent-soft', 'layers'));
      if (within(dist, h.sweet)) chips.push(pill('Sweet-spot trip', 'accent-soft', 'ruler'));
      else chips.push(pill(furlongs(dist), 'bg-slate-100 text-slate-600', 'ruler'));
      if (h.lastSpeed > 0 && r.par <= h.lastSpeed - 2) chips.push(pill('Class relief · par ' + r.par, 'accent-soft', 'trending-down'));
      else if (h.lastSpeed > 0 && r.par >= h.lastSpeed + 3) chips.push(pill('Class test · par ' + r.par, 'bg-amber-50 text-amber-700', 'trending-up'));
      if (h.daysSince === 0) chips.push(pill('First-time starter', 'bg-slate-100 text-slate-600', 'sparkles'));
      else chips.push(pill(h.daysSince + 'd since last', 'bg-slate-100 text-slate-600', 'calendar'));
      (s.signals || []).forEach(sig => chips.push(pill(sig.label, 'accent-soft', sig.icon)));

      // True Purse (research pick): effective money for THIS horse in THIS race.
      const tp = PPEngine.truePurse(h, r, Object.assign({}, ctxFor(h)(r), { fit: s.fit }));
      const tpHtml = tp ? `
        <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-sm" title="${esc(tp.detail)}">
          <span class="text-slate-500 flex items-center gap-1.5"><i data-lucide="calculator" class="w-3.5 h-3.5"></i>True purse, this start</span>
          <span class="text-xs text-slate-500">${esc(tp.detail)}</span>
          <span class="font-semibold ${tp.ev >= 0 ? 'text-turf-700' : 'text-red-600'}">EV ${tp.ev < 0 ? '−' : ''}${esc(fmtMoney(Math.abs(tp.ev)))}</span>
        </div>` : '';

      return `
        <div class="card ring-soft p-5">
          <div class="flex items-start gap-4 flex-wrap">
            ${scoreRing(s.fit)}
            <div class="flex-1 min-w-[240px]">
              <div class="flex items-center gap-2 flex-wrap">
                <a href="#race/${esc(r.id)}" class="font-semibold hover:underline">${esc(raceLabel(r))}</a>
                ${drawInChip(s.drawIn)}
              </div>
              <div class="text-xs text-slate-500 mt-0.5">${esc(fmtDate(r.postTime))} · ${esc(furlongs(r.distanceYards))} ${esc(surfName(r.surface))} · ${esc(classLabel(r.classLadder))} · ${esc(fmtMoney(r.purse))}</div>
            </div>
            <div class="flex items-center gap-2">${closePill(r.entryClose)}${submitControl(h, r, true)}</div>
          </div>
          <div class="mt-3 text-xs text-slate-600">${esc(snippet(r.conditions && r.conditions.text, 150))}</div>
          <div class="mt-3 flex flex-wrap gap-1.5">${chips.join('')}</div>
          ${tpHtml}
        </div>`;
    };

    paint('scr-recs', `
      ${breadcrumb([{ label: h.name, href: '#horse/' + h.id }, { label: 'Recommendations' }])}
      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Top spots for ${esc(h.name)}</h1>
          <div class="text-sm text-slate-600">${esc(list.length)} eligible open ${list.length === 1 ? 'race' : 'races'} · ranked by fit</div>
        </div>
      </div>
      <div class="space-y-4">
        ${list.length ? list.map(card).join('') : `<div class="card ring-soft p-8 text-center text-sm text-slate-500">No eligible open races for ${esc(h.name)} right now. Check back as the next condition book posts.</div>`}
      </div>`);
  };

  // ========================================================================
  // RACE DETAIL (trainer side) — eligibility check + projected field
  // ========================================================================
  R['scr-race'] = function (param) {
    const race = raceMerged(param) || raceMerged('cd-jun6-r3');
    if (!race) { paint('scr-race', `<div class="card ring-soft p-6 text-slate-500">Race not found.</div>`); return; }

    const entries = PPStore.entriesForRace(race.id) || [];
    const entrantHorses = entries.map(e => PPData.getHorse(e.horseId)).filter(Boolean);
    const target = (race.fieldTarget && race.fieldTarget.min) || 8;
    const fs = fillState(entries.length, target);
    const strength = PPEngine.fieldStrength(entrantHorses, race);

    // Rank the barn for this race: eligible-by-fit first, best ineligible after.
    const scored = stableHorses().map(h => {
      const ctx = ctxFor(h)(race);
      const s = PPEngine.score(h, race, ctx);
      return { h, s, eligible: s.eligible, fit: s.eligible ? s.fit : -1 };
    }).sort((a, b) => b.fit - a.fit).slice(0, 3);

    const reasonRow = (rn) => `
      <li class="flex items-start gap-2">
        <i data-lucide="${rn.pass ? 'check' : 'x'}" class="w-4 h-4 ${rn.pass ? 'text-turf-600' : 'text-red-500'} mt-0.5"></i>
        <span class="${rn.pass ? '' : 'text-slate-700'}">${esc(rn.label)}</span>
      </li>`;

    const eligCard = (row) => {
      const h = row.h, s = row.s;
      return `
        <div class="card ring-soft p-5">
          <div class="flex items-start gap-4 flex-wrap">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-semibold text-slate-700">${esc(initial(h.name))}</div>
            <div class="flex-1 min-w-[200px]">
              <div class="flex items-center gap-2 flex-wrap">
                <a href="#horse/${esc(h.id)}" class="font-semibold hover:underline">${esc(h.name)}</a>
                <span class="pill bg-slate-100 text-slate-600">${esc(sexAge(h))}</span>
                ${s.eligible ? drawInChip(s.drawIn) : pill('Ineligible', 'bg-red-50 text-red-700', 'x')}
              </div>
              <div class="text-xs text-slate-500 mt-0.5">Speed ${esc(h.lastSpeed || '—')} · class ${esc(h.classR || '—')}${s.eligible ? ' · fit ' + Math.round(s.fit) : ''}</div>
            </div>
            <div>${submitControl(h, race, s.eligible)}</div>
          </div>
          <ul class="mt-3 space-y-1.5 text-sm border-t border-slate-100 pt-3">${(s.reasons || []).map(reasonRow).join('')}</ul>
        </div>`;
    };

    paint('scr-race', `
      ${breadcrumb([{ label: 'Races', href: '#dashboard' }, { label: raceLabel(race) }])}

      <div class="card ring-soft p-6">
        <div class="flex items-start gap-5 flex-wrap">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-turf-600 to-turf-800 flex items-center justify-center text-white">
            <i data-lucide="flag-triangle-right" class="w-6 h-6"></i>
          </div>
          <div class="flex-1 min-w-[240px]">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-2xl font-semibold tracking-tight">${esc(raceLabel(race))}</h1>
              ${closePill(race.entryClose)}
            </div>
            <div class="text-sm text-slate-600 mt-1">${esc(fmtDate(race.postTime))} · ${esc(furlongs(race.distanceYards))} ${esc(surfName(race.surface))} · ${esc(classLabel(race.classLadder))}</div>
            <div class="text-sm text-slate-500 mt-2 flex flex-wrap gap-x-5 gap-y-1">
              <span class="text-silk-500 font-medium">Purse ${esc(fmtMoney(race.purse))}</span>
              <span>${esc(entries.length)} of ${esc(target)} target</span>
              <span>par ${esc(race.par || '—')}</span>
            </div>
          </div>
        </div>
        <div class="mt-5">
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="${fs.pill}">${esc(fs.label)}</span>
            <span class="text-xs text-slate-500">${esc(fs.note)}</span>
          </div>
          <div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div class="${fs.bar} h-2 rounded-full" style="width:${fs.pct}%"></div></div>
        </div>
        <div class="mt-4 text-xs text-slate-600">${esc(snippet(race.conditions && race.conditions.text, 220))}</div>
      </div>

      <div class="flex items-center gap-2">
        <i data-lucide="badge-check" class="w-4 h-4 text-turf-600"></i>
        <div class="font-semibold">Eligibility check · your barn</div>
        <span class="text-xs text-slate-500">Projected field: ${esc(strength.label)} (index ${esc(strength.index)})</span>
      </div>
      <div class="space-y-4">
        ${scored.length ? scored.map(eligCard).join('') : `<div class="card ring-soft p-8 text-center text-sm text-slate-500">No barn horses to check against this race.</div>`}
      </div>

      ${cutLinePanel(race, entrantHorses)}`);
  };

  // The cut line (research pick): the entered field ranked by the race's
  // preference system, with the draw-in cut and also-eligible band marked —
  // the transparency the phone call to the racing office used to provide.
  function cutLinePanel(race, entrants) {
    const order = PPEngine.preferenceOrder(entrants, race);
    if (!order || !order.length) return '';
    const max = race.fieldTarget.max, cap = race.alsoEligibleCap || 0;
    const mine = new Set(stableHorses().map(h => h.id));
    const zonePill = {
      in: pill('Draws in', 'accent-soft', 'check-circle-2'),
      ae: pill('Also-eligible', 'bg-amber-50 text-amber-700', 'clock'),
      out: pill('Outside', 'bg-red-50 text-red-700', 'x'),
    };
    const divider = (label) => `
      <div class="px-5 py-1.5 flex items-center gap-3 bg-slate-50">
        <div class="flex-1 border-t border-dashed border-slate-300"></div>
        <span class="text-[11px] uppercase tracking-wider text-slate-500">${esc(label)}</span>
        <div class="flex-1 border-t border-dashed border-slate-300"></div>
      </div>`;
    let rows = '';
    order.forEach((row, i) => {
      if (i === max) rows += divider(`draw-in cut line — top ${max} draw in`);
      if (cap && i === max + cap) rows += divider(`also-eligible cap (${cap})`);
      const h = row.h;
      const isMine = mine.has(h.id);
      const pref = race.preferenceSystem === 'stars'
        ? ((h.preference && h.preference.stars) ?? 0) + '★'
        : (h.preference && h.preference.date) ? 'pref ' + fmtDate(h.preference.date) : (h.daysSince || 0) + 'd since last';
      rows += `
        <div class="px-5 py-2.5 flex items-center gap-3 ${isMine ? 'bg-turf-50/60' : ''}">
          <div class="w-7 text-xs font-mono text-slate-500">${row.rank}</div>
          <div class="flex-1 min-w-0">
            <span class="font-medium ${isMine ? 'text-turf-800' : ''}">${esc(h.name)}</span>
            ${isMine ? '<span class="pill accent-soft ml-1">your barn</span>' : ''}
            <span class="text-xs text-slate-500 ml-1">${esc(h.trainer || '')}</span>
          </div>
          <div class="text-xs text-slate-500">${esc(pref)}</div>
          ${zonePill[row.zone] || ''}
        </div>`;
    });
    return `
      <div class="card ring-soft">
        <div class="px-5 py-4 border-b border-slate-100">
          <div class="font-semibold flex items-center gap-2"><i data-lucide="list-ordered" class="w-4 h-4 text-turf-600"></i>The cut line</div>
          <div class="text-xs text-slate-500">Current field ranked by the ${esc(race.preferenceSystem === 'stars' ? 'preference-star' : race.preferenceSystem === 'date' ? 'preference-date' : 'entry-order')} system · ${order.length} entered for ${max} spots${cap ? ' + ' + cap + ' AE' : ''}</div>
        </div>
        <div class="divide-y divide-slate-100 text-sm">${rows}</div>
      </div>`;
  }

  // ========================================================================
  // INBOUND TRACK REQUESTS — accept/decline, ship-bonus callouts, history
  // ========================================================================
  R['trainer/requests'] = function () {
    const all = PPStore.requests.list();
    const order = { sent: 0, accepted: 1, declined: 2 };
    const sorted = all.slice().sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    const sent = sorted.filter(r => r.status === 'sent');
    const history = sorted.filter(r => r.status !== 'sent');

    const shipCallout = (h, race) => {
      const ctx = ctxFor(h)(race);
      const s = PPEngine.shipping(h, race, ctx);
      if (!s || s.bonus <= 0) return '';
      return `<div class="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg accent-soft text-sm">
        <i data-lucide="truck" class="w-4 h-4"></i><span><span class="font-semibold">Ship &amp; Win bonus: ${esc(fmtMoney(s.bonus))}</span> — ${s.shipMi > 0 ? esc(s.shipMi) + ' mi ship qualifies.' : 'applies to this fill.'}</span></div>`;
    };

    const sentCard = (req) => {
      const h = PPData.getHorse(req.horseId);
      const race = raceMerged(req.raceId);
      if (!h || !race) return '';
      return `
        <div class="card ring-soft p-6">
          <div class="flex items-start gap-5 flex-wrap">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white"><i data-lucide="flag-triangle-right" class="w-5 h-5"></i></div>
            <div class="flex-1 min-w-[240px]">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-semibold">${esc(raceLabel(race))}</h2>
                <span class="pill bg-indigo-50 text-indigo-700">wants <a href="#horse/${esc(h.id)}" class="hover:underline">${esc(h.name)}</a></span>
              </div>
              <div class="text-sm text-slate-500 mt-1">${esc(raceMetaLine(race))}</div>
              <div class="text-xs text-slate-500 mt-2">Requested by <span class="text-ink-900 font-medium">${esc(trackName(race))} Racing Office</span></div>
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-500">Entries close</div>
              <div class="text-sm font-semibold">${esc(fmtDate(race.entryClose))}</div>
              ${closePill(race.entryClose)}
            </div>
          </div>
          ${shipCallout(h, race)}
          <div class="mt-4 flex items-center gap-2">
            <button class="pp-accept-request text-sm px-4 py-2 rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5" data-req-id="${esc(req.id)}"><i data-lucide="check" class="w-4 h-4"></i>Accept &amp; submit</button>
            <button class="pp-decline-request text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600" data-req-id="${esc(req.id)}">Decline</button>
          </div>
        </div>`;
    };

    const histRow = (req) => {
      const h = PPData.getHorse(req.horseId);
      const race = raceMerged(req.raceId);
      if (!h || !race) return '';
      const done = req.status === 'accepted';
      return `
        <div class="flex items-center gap-3 px-5 py-3">
          <i data-lucide="${done ? 'check-circle-2' : 'x-circle'}" class="w-4 h-4 ${done ? 'text-turf-600' : 'text-slate-400'}"></i>
          <div class="flex-1 min-w-0">
            <div class="text-sm"><a href="#horse/${esc(h.id)}" class="font-medium hover:underline">${esc(h.name)}</a> · ${esc(raceLabel(race))}</div>
            <div class="text-xs text-slate-500">${esc(raceMetaLine(race))}</div>
          </div>
          <span class="pill ${done ? 'accent-soft' : 'bg-slate-100 text-slate-500'}">${done ? 'Entered' : 'Declined'}</span>
        </div>`;
    };

    const bonusCount = sent.reduce((n, req) => {
      const h = PPData.getHorse(req.horseId), race = raceMerged(req.raceId);
      if (!h || !race) return n;
      const s = PPEngine.shipping(h, race, ctxFor(h)(race));
      return n + (s && s.bonus > 0 ? 1 : 0);
    }, 0);

    const empty = `
      <div class="card ring-soft p-8 text-center">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><i data-lucide="inbox" class="w-6 h-6"></i></div>
        <div class="mt-3 font-semibold">No requests yet</div>
        <div class="mt-1 text-sm text-slate-600 max-w-md mx-auto">Requests from racing offices land here. Switch to the <span class="font-medium">Track</span> workspace and send one from a race builder to see the loop close.</div>
      </div>`;

    paint('trainer/requests', `
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Requests from tracks</h1>
        <div class="text-sm text-slate-600">Racing offices asking for one of your horses. Accept to file the entry, or decline.</div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Open requests</div><div class="mt-1 text-2xl font-semibold">${esc(sent.length)}</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">With ship bonus</div><div class="mt-1 text-2xl font-semibold accent-text">${esc(bonusCount)}</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-slate-500">Entered / declined</div><div class="mt-1 text-2xl font-semibold">${esc(history.length)}</div></div>
      </div>

      ${sent.length ? sent.map(sentCard).join('') : empty}

      ${history.length ? `
        <div class="card ring-soft">
          <div class="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-600">History</div>
          <div class="divide-y divide-slate-100">${history.map(histRow).join('')}</div>
        </div>` : ''}`);
  };

  // ========================================================================
  // SPOT ALERTS (research pick) — standing per-horse condition watches that
  // fire when a matching race appears, plus the entry-deadline rail. Inverts
  // Equibase Virtual Stable: opportunity-centric, not entity-centric.
  // ========================================================================
  R['trainer/alerts'] = function () {
    const horses = stableHorses();
    const open = openRaces();
    const needs = horses.filter(needsPlacement);

    // A standing watch per horse needing placement, described from its profile.
    const watchDesc = (h) => {
      const bits = [];
      bits.push(h.maiden ? 'Maiden' : (h.record && h.record.winsOtherThanMdnClmStarter ? 'Allowance-level' : 'Winners'));
      if ((h.surf || []).length) bits.push((h.surf || []).map(surfName).join('/'));
      if (h.sweet) bits.push(furlongs(h.sweet[0]) + '–' + furlongs(h.sweet[1]));
      bits.push((h.sex === 'F' || h.sex === 'M') ? 'F&M or open' : 'open company');
      bits.push('≤ 700 mi');
      return bits.join(' · ');
    };

    // Feed: each watched horse's matches, most urgent entry-close first. A race
    // at another meet reads as "new condition book" — the discovery moment.
    const events = [];
    needs.forEach(h => {
      (PPEngine.racesForHorse(h, open, ctxFor(h)) || []).slice(0, 2).forEach(rs => {
        const d = daysUntil(rs.race.entryClose);
        const away = trackIdOfRace(rs.race) !== h.home;
        events.push({ h, rs, d, kind: away ? 'book' : 'match' });
      });
    });
    events.sort((a, b) => a.d - b.d);

    const eventCard = (ev) => {
      const { h, rs, kind } = ev;
      const r = rs.race, s = rs.s;
      const tp = PPEngine.truePurse(h, r, Object.assign({}, ctxFor(h)(r), { fit: s.fit }));
      const tag = kind === 'book'
        ? pill('New book · ' + trackName(r), 'bg-indigo-50 text-indigo-700', 'book-open')
        : pill('Condition match', 'accent-soft', 'zap');
      return `
        <div class="card ring-soft p-5">
          <div class="flex items-start gap-4 flex-wrap">
            <div class="w-10 h-10 rounded-xl bg-turf-50 text-turf-700 flex items-center justify-center"><i data-lucide="bell-ring" class="w-5 h-5"></i></div>
            <div class="flex-1 min-w-[240px]">
              <div class="flex items-center gap-2 flex-wrap">
                ${tag}
                <span class="text-sm">Spot for <a href="#horse/${esc(h.id)}" class="font-semibold hover:underline">${esc(h.name)}</a></span>
              </div>
              <div class="mt-1"><a href="#race/${esc(r.id)}" class="font-medium hover:underline">${esc(raceLabel(r))}</a>
                <span class="text-xs text-slate-500"> · ${esc(fmtDate(r.postTime))} · ${esc(furlongs(r.distanceYards))} ${esc(surfName(r.surface))} · ${esc(classLabel(r.classLadder))} · ${esc(fmtMoney(r.purse))}</span></div>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                ${drawInChip(s.drawIn)}
                ${tp && tp.ev > 0 ? pill('EV ' + fmtMoney(tp.ev), 'accent-soft', 'calculator') : ''}
                ${(s.signals || []).map(sig => pill(esc(sig.label), 'accent-soft', sig.icon)).join('')}
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">${closePill(r.entryClose)}${submitControl(h, r, true)}</div>
          </div>
        </div>`;
    };

    // Deadline rail: races the barn is live in, ordered by entry close.
    const liveSubIds = new Set();
    horses.forEach(h => PPStore.submissions.list({ horseId: h.id }).filter(isLiveSub)
      .forEach(s => liveSubIds.add(s.raceId)));
    const deadlineRows = Array.from(liveSubIds).map(rid => raceMerged(rid)).filter(Boolean)
      .sort((a, b) => String(a.entryClose).localeCompare(String(b.entryClose)))
      .map(r => `
        <div class="px-5 py-3 flex items-center justify-between gap-2">
          <div class="min-w-0"><a href="#race/${esc(r.id)}" class="font-medium hover:underline">${esc(raceLabel(r))}</a>
            <div class="text-xs text-slate-500">${esc(fmtDate(r.postTime))} · entered</div></div>
          ${closePill(r.entryClose)}
        </div>`).join('')
      || '<div class="px-5 py-4 text-sm text-slate-500">No live entries — deadlines appear here once you submit.</div>';

    // Supplement registration reminders for state-breds (KTDF-style forfeiture).
    const kyBreds = horses.filter(h => h.stateBred === 'KY');
    const suppRows = kyBreds.map(h => `
      <div class="px-5 py-3 flex items-center justify-between gap-2">
        <div class="min-w-0"><a href="#horse/${esc(h.id)}" class="font-medium hover:underline">${esc(h.name)}</a>
          <div class="text-xs text-slate-500">KY-bred — KTDF supplement applies to eligible starts</div></div>
        ${pill('Registered', 'accent-soft', 'check')}
      </div>`).join('')
      || '<div class="px-5 py-4 text-sm text-slate-500">No state-breds in the barn.</div>';

    paint('trainer/alerts', `
      <div class="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Spot alerts</h1>
          <div class="text-sm text-slate-600">Standing watches on the condition book — you hear the moment a race your horse fits is published, changed, or filling.</div>
        </div>
        <div class="flex items-center gap-1.5 text-xs text-slate-500">
          Deliver via ${pill('Push', 'accent-soft', 'smartphone')}${pill('SMS', 'accent-soft', 'message-square')}${pill('Email digest', 'bg-slate-100 text-slate-500', 'mail')}
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center gap-2">
            <i data-lucide="bell" class="w-4 h-4 text-turf-600"></i>
            <div class="font-semibold">New matches</div>
            <span class="pill bg-slate-100 text-slate-600">${events.length}</span>
          </div>
          ${events.length ? events.map(eventCard).join('') : '<div class="card ring-soft p-8 text-center text-sm text-slate-500">No new matches — every watched horse is placed or resting.</div>'}
        </div>

        <div class="space-y-4">
          <div class="card ring-soft">
            <div class="px-5 py-4 border-b border-slate-100"><div class="font-semibold">Watches</div><div class="text-xs text-slate-500">One standing search per unplaced horse</div></div>
            <div class="divide-y divide-slate-100 text-sm">
              ${needs.map(h => `
                <div class="px-5 py-3">
                  <div class="flex items-center justify-between"><a href="#horse/${esc(h.id)}" class="font-medium hover:underline">${esc(h.name)}</a>${pill('watching', 'accent-soft', 'eye')}</div>
                  <div class="text-xs text-slate-500 mt-0.5">${esc(watchDesc(h))}</div>
                </div>`).join('') || '<div class="px-5 py-4 text-sm text-slate-500">Every horse is placed.</div>'}
            </div>
          </div>

          <div class="card ring-soft">
            <div class="px-5 py-4 border-b border-slate-100"><div class="font-semibold">Deadlines</div><div class="text-xs text-slate-500">Entry close on your live entries</div></div>
            <div class="divide-y divide-slate-100 text-sm">${deadlineRows}</div>
          </div>

          <div class="card ring-soft">
            <div class="px-5 py-4 border-b border-slate-100"><div class="font-semibold">Supplement registrations</div><div class="text-xs text-slate-500">Miss the registration, forfeit the money</div></div>
            <div class="divide-y divide-slate-100 text-sm">${suppRows}</div>
          </div>
        </div>
      </div>`);
  };

  // ---- one delegated click listener for all trainer actions ---------------
  document.addEventListener('click', function (e) {
    const submit = e.target.closest && e.target.closest('.pp-submit');
    if (submit) {
      const hid = submit.dataset.horseId, rid = submit.dataset.raceId;
      PPStore.submissions.add({ horseId: hid, raceId: rid });
      const h = PPData.getHorse(hid), r = raceMerged(rid);
      toast(esc((h && h.name) || 'Horse') + ' submitted to ' + esc(r ? raceLabel(r) : 'race'));
      if (window.rerender) window.rerender();
      return;
    }
    const acc = e.target.closest && e.target.closest('.pp-accept-request');
    if (acc) {
      const id = acc.dataset.reqId;
      const req = PPStore.requests.get(id);
      PPStore.requests.setStatus(id, 'accepted');
      const h = req && PPData.getHorse(req.horseId);
      toast(esc((h && h.name) || 'Horse') + ' entered — request accepted');
      if (window.rerender) window.rerender();
      return;
    }
    const dec = e.target.closest && e.target.closest('.pp-decline-request');
    if (dec) {
      PPStore.requests.setStatus(dec.dataset.reqId, 'declined');
      if (window.rerender) window.rerender();
      return;
    }
  });

})(window);
