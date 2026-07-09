/* PostParade demo persistence (PPStore) — a localStorage overlay on the
   immutable PPData seed. The seed never mutates; user actions (Submissions,
   Requests, race-spec edits) persist as a delta under one versioned key.
   Stage 2 swap: these methods become API calls, same shapes (plan.md §6). */
(function () {
  const KEY = 'pp.demo.v1';
  const blank = () => ({ version: 1, submissions: [], requests: [], raceSpecOverrides: {}, stallOverrides: {},
    createdMeets: [], createdRaceDays: [], createdRaces: [], createdPrograms: [],
    deletedMeetIds: [], deletedRaceDayIds: [] });

  let state = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) state = Object.assign(blank(), parsed);
    }
  } catch (e) { /* corrupt or unavailable storage — run in-memory */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota/private mode */ }
  }

  let seq = state.submissions.length + state.requests.length;
  function newId(prefix) { return prefix + '-' + (++seq) + '-' + Math.random().toString(36).slice(2, 7); }

  // Submissions (trainer→race) and Requests (track→horse) share one shape:
  // { id, horseId, raceId, status, at, statusAt?, note?, supplementApplied? }
  function collection(name, initialStatus) {
    return {
      list(filter = {}) {
        return state[name].filter(x => Object.entries(filter).every(([k, v]) => x[k] === v));
      },
      get(id) { return state[name].find(x => x.id === id) || null; },
      find(horseId, raceId) {
        return state[name].find(x => x.horseId === horseId && x.raceId === raceId) || null;
      },
      add(rec) {
        const dup = this.find(rec.horseId, rec.raceId);
        if (dup) return dup;
        const row = Object.assign(
          { id: newId(name.slice(0, 3)), status: initialStatus, at: new Date().toISOString() }, rec);
        state[name].push(row);
        save();
        return row;
      },
      setStatus(id, status) {
        const row = this.get(id);
        if (row) { row.status = status; row.statusAt = new Date().toISOString(); save(); }
        return row;
      },
    };
  }

  const submissions = collection('submissions', 'submitted'); // submitted | accepted | withdrawn
  const requests = collection('requests', 'sent');            // sent | accepted | declined

  /* The one join every fill/field UI calls: seed entries + live submissions
     + accepted requests, deduped per horse. A trainer Submission counts as an
     entry when made (entries are trainer-initiated in real life); a track
     Request counts only once the trainer accepts it. */
  function entriesForRace(raceId) {
    const seed = (window.PPData && PPData.seedEntries) ? PPData.seedEntries(raceId) : [];
    const byHorse = new Map();
    seed.forEach(e => byHorse.set(e.horseId, { horseId: e.horseId, raceId, source: 'seed' }));
    submissions.list({ raceId }).forEach(s => {
      if (s.status === 'withdrawn' || byHorse.has(s.horseId)) return;
      byHorse.set(s.horseId, { horseId: s.horseId, raceId, source: 'submission', ref: s.id });
    });
    requests.list({ raceId, status: 'accepted' }).forEach(r => {
      if (byHorse.has(r.horseId)) return;
      byHorse.set(r.horseId, { horseId: r.horseId, raceId, source: 'request', ref: r.id });
    });
    return Array.from(byHorse.values());
  }

  function overrideRace(raceId, patch) {
    state.raceSpecOverrides[raceId] = Object.assign({}, state.raceSpecOverrides[raceId], patch);
    save();
    return state.raceSpecOverrides[raceId];
  }

  /* --- "Build a meet" creation layer -------------------------------------
     Unlike raceSpecOverrides (which edit an existing seeded entity), these add
     brand-new entities at runtime. Each persists as its own delta array. The
     createRace defaults intentionally mirror every field on a seeded race so
     downstream readers (breadcrumbs, condLine, fillState, the scoring engine)
     work on created races without special-casing. Stage 2: POST to the API. */
  function createMeet(spec) {
    const id = newId('meet');
    const meet = Object.assign({
      status: 'draft', meetType: 'regular', supplementProgramIds: [],
    }, spec, { id });
    state.createdMeets.push(meet);
    save();
    return meet;
  }
  function getCreatedMeet(id) { return state.createdMeets.find(m => m.id === id) || null; }
  function listCreatedMeets() { return state.createdMeets; }

  function createRaceDay(spec) {
    const id = newId('rd');
    const day = Object.assign({ status: 'draft' }, spec, { id });
    state.createdRaceDays.push(day);
    save();
    return day;
  }
  function getCreatedRaceDay(id) { return state.createdRaceDays.find(d => d.id === id) || null; }
  function listCreatedRaceDays(meetId) { return state.createdRaceDays.filter(d => d.meetId === meetId); }

  function createRace(spec) {
    const id = newId('race');
    const race = Object.assign({
      raceNumber: 1, classLadder: 'Alw', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 20000, par: null,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'none',
      entryClose: null, postTime: null,
      stateBredRestricted: false, stateBredCode: null,
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: false, claimingPrice: null, nonWinners: null, text: '' },
      bonusAmount: null, bonusMi: null,
    }, spec, { id });
    state.createdRaces.push(race);
    save();
    return race;
  }
  function getCreatedRace(id) { return state.createdRaces.find(r => r.id === id) || null; }
  function listCreatedRaces(raceDayId) { return state.createdRaces.filter(r => r.raceDayId === raceDayId); }

  function createShipProgram(spec) {
    const id = newId('prog');
    const prog = Object.assign({ type: 'shipAndWin', label: 'Ship & Win' }, spec, { id });
    state.createdPrograms.push(prog);
    save();
    return prog;
  }
  function getCreatedProgram(meetId) {
    const meet = getCreatedMeet(meetId);
    const ids = (meet && meet.supplementProgramIds) || [];
    return state.createdPrograms.find(p => ids.indexOf(p.id) >= 0) || null;
  }

  /* --- Soft delete ---------------------------------------------------------
     Seeded meets/race days are immutable (PPData never mutates), so "delete"
     is an id-set overlay the screens layer filters against, same shape as
     raceSpecOverrides — not a splice. Deleting a meet cascades to its race
     days (seeded + created) so nothing is left reachable underneath it. */
  function deleteMeet(meetId) {
    if (state.deletedMeetIds.indexOf(meetId) === -1) state.deletedMeetIds.push(meetId);
    const seededDays = (window.PPData && PPData.listRaceDays) ? PPData.listRaceDays(meetId) : [];
    const createdDays = state.createdRaceDays.filter(d => d.meetId === meetId);
    seededDays.concat(createdDays).forEach(d => {
      if (state.deletedRaceDayIds.indexOf(d.id) === -1) state.deletedRaceDayIds.push(d.id);
    });
    save();
  }
  function isMeetDeleted(meetId) { return state.deletedMeetIds.indexOf(meetId) !== -1; }

  function deleteRaceDay(dayId) {
    if (state.deletedRaceDayIds.indexOf(dayId) === -1) state.deletedRaceDayIds.push(dayId);
    save();
  }
  function isRaceDayDeleted(dayId) { return state.deletedRaceDayIds.indexOf(dayId) !== -1; }

  /* Seed OR created race merged with any persisted spec edits from the race
     builder. Created races (no PPData seed) resolve from state.createdRaces so
     the Race Builder screen (#track/race/<id>) works on brand-new races too.
     A race whose race day was deleted resolves to null too — no ghost races
     reachable by direct link after their day (or meet) is gone. */
  function raceFor(raceId) {
    const base = (window.PPData && PPData.getRace) ? PPData.getRace(raceId) : null;
    const created = state.createdRaces.find(r => r.id === raceId);
    const b = base || created;
    if (!b || state.deletedRaceDayIds.indexOf(b.raceDayId) !== -1) return null;
    const patch = state.raceSpecOverrides[raceId];
    if (!patch) return b;
    const merged = Object.assign({}, b, patch);
    if (b.conditions || patch.conditions) {
      merged.conditions = Object.assign({}, b.conditions, patch.conditions);
    }
    return merged;
  }

  function overrideStall(appId, patch) {
    state.stallOverrides[appId] = Object.assign({}, state.stallOverrides[appId], patch);
    save();
    return state.stallOverrides[appId];
  }

  /* Seed stall application merged with any persisted assignment edits. */
  function stallFor(appId) {
    const base = (window.PPData && PPData.getStallApplication) ? PPData.getStallApplication(appId) : null;
    const patch = state.stallOverrides[appId];
    return base ? Object.assign({}, base, patch) : null;
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  }

  window.PPStore = {
    submissions,
    requests,
    entriesForRace,
    overrideRace,
    raceOverride: (raceId) => state.raceSpecOverrides[raceId] || null,
    createMeet, getCreatedMeet, listCreatedMeets,
    createRaceDay, getCreatedRaceDay, listCreatedRaceDays,
    createRace, getCreatedRace, listCreatedRaces,
    createShipProgram, getCreatedProgram,
    deleteMeet, isMeetDeleted,
    deleteRaceDay, isRaceDayDeleted,
    raceFor,
    overrideStall,
    stallOverride: (appId) => state.stallOverrides[appId] || null,
    stallFor,
    reset,
    _debug: () => JSON.parse(JSON.stringify(state)),
  };
})();
