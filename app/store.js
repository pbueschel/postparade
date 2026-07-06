/* PostParade demo persistence (PPStore) — a localStorage overlay on the
   immutable PPData seed. The seed never mutates; user actions (Submissions,
   Requests, race-spec edits) persist as a delta under one versioned key.
   Stage 2 swap: these methods become API calls, same shapes (plan.md §6). */
(function () {
  const KEY = 'pp.demo.v1';
  const blank = () => ({ version: 1, submissions: [], requests: [], raceSpecOverrides: {} });

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

  /* Seed race merged with any persisted spec edits from the race builder. */
  function raceFor(raceId) {
    const base = (window.PPData && PPData.getRace) ? PPData.getRace(raceId) : null;
    const patch = state.raceSpecOverrides[raceId];
    if (!base) return base;
    if (!patch) return base;
    const merged = Object.assign({}, base, patch);
    if (base.conditions || patch.conditions) {
      merged.conditions = Object.assign({}, base.conditions, patch.conditions);
    }
    return merged;
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
    raceFor,
    reset,
    _debug: () => JSON.parse(JSON.stringify(state)),
  };
})();
