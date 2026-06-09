/* PostParade — seed data + shapes (Stage 1: in-memory; Stage 2: fetch() the API)
 *
 * Loaded as a plain <script> — exposes the global `PPData`. The accessor
 * methods (listHorses, getRace, shipProgram) are the future API boundary:
 * in Stage 2 they become `await fetch('/horses')` etc. without changing callers.
 *
 * Field names/codes track the Brisnet/Equibase set (see docs/research.md) so the
 * eventual Equibase adapter is a swap, not a remodel.
 */
(function (global) {
  'use strict';

  // Class ladder enum (mirrors PPEngine.CLASS_LADDER; kept here for the data layer).
  const classLadder = [
    'MSW', 'MdnClm', 'Clm', 'OptClm', 'StarterAlw', 'Alw', 'Hcp', 'Listed', 'G3', 'G2', 'G1',
  ];

  // Meet metadata (top-level container — the industry "Meet", shown as "Meet" in UI).
  const meet = {
    id: 'cd-2026-summer',
    track: 'CD',
    trackName: 'Churchill Downs',
    label: 'Summer meet',
    status: 'published',
  };

  // Purse incentive programs (stackable). Ship-and-Win is the canonical
  // "shipping bonus" — flat appearance check + % purse bonus, with eligibility
  // predicates (see docs/research.md §D). The race-builder seeds its bonus
  // inputs from the active program below.
  const supplementPrograms = [
    {
      id: 'cd-ship-and-win',
      type: 'shipAndWin',
      label: 'Ship & Win',
      scope: 'meet',
      flatAmount: 1500,        // guaranteed appearance check
      purseBonusPct: 0,        // % of purse earnings (0 for the prototype)
      eligibility: {
        shipInOnly: true,
        minShipMi: 150,
        fromOutsideState: false,
        notRacedInStateMonths: 0,
        excludeStakes: true,
        excludeFirstTimers: false,
      },
      cap: { perHorse: 1, totalBudget: 45000, claimed: 12000 },
    },
  ];

  // The R3 demo race, with structured conditions (the class-ladder code + the
  // "non-winners other than" predicate — the core eligibility math).
  const race = {
    id: 'cd-jun6-r3',
    meetId: meet.id,
    raceNumber: 3,
    classLadder: 'MSW',
    surface: 'D',
    distanceYards: 1320,        // 6 furlongs
    purse: 85000,
    fieldTarget: { min: 8, max: 10 },
    entryClose: '2026-06-03T10:00:00-05:00',  // sourced separately from post time
    postTime: '2026-06-06T14:14:00-05:00',
    stateBredRestricted: false,
    preferenceSystem: 'date',  // TODO(v1): drive draw-in probability from this
    alsoEligibleCap: 4,
    isTurf: false,
    conditions: {
      sexes: ['F', 'M'],
      minAge: 3,
      maidenOnly: true,
      // non-winners "other than" ladder; for a maiden race the predicate is
      // simply "career 0 wins". Shape supports Alw N1X/N2X/N1Y/N$Y/N2L later.
      nonWinners: { kind: 'maiden' },
      preference: { kind: 'startedUnder', amount: 50000 },
      text: 'FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. Three Year Olds, 118 lbs.; Older, 124 lbs. (Preference To Horses That Have Not Started For Less Than $50,000).',
    },
  };

  // Horses on the circuit. Ship miles = home track → Churchill Downs.
  // TODO(v1): add preferenceDate/stars, vetList, medication, equipment fields.
  const horses = [
    { name: 'Zengraya',      stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'F', age: 3, maiden: true,  under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 121, lastSpeed: 82, daysSince: 49,  home: 'CD',  shipMi: 0,   trainerPct: 0.21 },
    { name: "Tammy's Kiss",  stable: 'Snellgrove Racing', trainer: 'Bauer P.',     sex: 'F', age: 3, maiden: true,  under50k: true,  surf: ['D'], sweet: [1320, 1430], classR: 114, lastSpeed: 0,  daysSince: 0,   home: 'CD',  shipMi: 0,   trainerPct: 0.18 },
    { name: 'Island Barbie', stable: 'Murphy Racing',     trainer: 'Murphy C.',    sex: 'F', age: 4, maiden: true,  under50k: true,  surf: ['D'], sweet: [1320, 1540], classR: 107, lastSpeed: 64, daysSince: 120, home: 'CD',  shipMi: 0,   trainerPct: 0.11 },
    { name: 'Halcyon Days',  stable: 'Cox Thoroughbreds', trainer: 'Cox B.',       sex: 'F', age: 3, maiden: true,  under50k: true,  surf: ['D'], sweet: [1540, 1760], classR: 110, lastSpeed: 0,  daysSince: 0,   home: 'CD',  shipMi: 0,   trainerPct: 0.19 },
    { name: 'Painted Lily',  stable: 'Mott Stable',       trainer: 'Mott W.',      sex: 'F', age: 3, maiden: true,  under50k: true,  surf: ['D'], sweet: [1320, 1430], classR: 112, lastSpeed: 75, daysSince: 35,  home: 'KEE', shipMi: 78,  trainerPct: 0.14 },
    { name: 'River Sonata',  stable: 'Stewart Racing',    trainer: 'Stewart D.',   sex: 'F', age: 3, maiden: true,  under50k: true,  surf: ['D'], sweet: [1320, 1430], classR: 108, lastSpeed: 71, daysSince: 28,  home: 'ELP', shipMi: 130, trainerPct: 0.13 },
    { name: 'Quiet Storm',   stable: 'Asmussen Stable',   trainer: 'Asmussen S.',  sex: 'F', age: 4, maiden: true,  under50k: true,  surf: ['D'], sweet: [1320, 1540], classR: 111, lastSpeed: 80, daysSince: 25,  home: 'OP',  shipMi: 560, trainerPct: 0.20 },
    { name: 'Cajun Belle',   stable: 'Lobo Stable',       trainer: 'Lobo P.',      sex: 'F', age: 4, maiden: true,  under50k: true,  surf: ['D'], sweet: [1430, 1760], classR: 105, lastSpeed: 73, daysSince: 40,  home: 'FG',  shipMi: 700, trainerPct: 0.16 },
    // Ineligible example — exercised by the eligibility gate, never shown as a fit.
    { name: 'Battis Grove',  stable: 'Walden Racing',     trainer: 'Walden W.',    sex: 'G', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 112, lastSpeed: 90, daysSince: 30,  home: 'CD',  shipMi: 0,   trainerPct: 0.22 },
  ];

  // ---- API facade (Stage 2: swap bodies for fetch()) -----------------------
  const PPData = {
    classLadder,
    meet,
    horses,
    race,
    supplementPrograms,
    listHorses() { return horses; },
    getRace() { return race; },
    // The active Ship-and-Win program for the current meet (drives bonus inputs).
    shipProgram() { return supplementPrograms.find(p => p.type === 'shipAndWin') || null; },
  };

  global.PPData = PPData;
})(window);
