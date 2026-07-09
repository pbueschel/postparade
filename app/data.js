/* PostParade — seed data + shapes (Stage 1: in-memory; Stage 2: fetch() the API)
 *
 * Loaded as a plain <script> — exposes the global `PPData`. The accessor
 * methods (listRaces, getHorse, shipProgram, …) are the future API boundary:
 * in Stage 2 they become `await fetch('/races')` etc. without changing callers.
 *
 * Field names/codes track the Brisnet/Equibase set (see docs/research.md) so the
 * eventual Equibase adapter is a swap, not a remodel.
 *
 * Model (plan.md §3): Track 1─* Meet 1─* RaceDay 1─* Race 1─* Entry;
 *                     Stable(Trainer) 1─* Horse; SupplementProgram scoped to a Meet.
 * Everything below is normalized by string `id`; the facade joins by id.
 */
(function (global) {
  'use strict';

  // Canonical demo clock. All daysSince/countdowns derive from this instant.
  const today = '2026-06-01T09:00:00-05:00';

  // Class ladder enum (mirrors PPEngine.CLASS_LADDER; kept here for the data layer).
  const classLadder = [
    'MSW', 'MdnClm', 'Clm', 'OptClm', 'StarterAlw', 'Alw', 'Hcp', 'Listed', 'G3', 'G2', 'G1',
  ];

  // ---- Tracks --------------------------------------------------------------
  const tracks = [
    { id: 'CD',  name: 'Churchill Downs', state: 'KY' },
    { id: 'ELP', name: 'Ellis Park',      state: 'KY' },
    { id: 'KEE', name: 'Keeneland',       state: 'KY' },
    { id: 'TP',  name: 'Turfway Park',    state: 'KY' },
    { id: 'OP',  name: 'Oaklawn Park',    state: 'AR' },
    { id: 'FG',  name: 'Fair Grounds',    state: 'LA' },
  ];

  // ---- Shipping matrix -----------------------------------------------------
  // Pair-keyed road miles (one direction stored; shipMiles() checks both).
  const shipMi = {
    'KEE>CD': 78,  'ELP>CD': 130, 'TP>CD': 100, 'OP>CD': 560, 'FG>CD': 700,
    'KEE>ELP': 140, 'KEE>TP': 85,  'KEE>OP': 570, 'KEE>FG': 730,
    'ELP>TP': 200, 'ELP>OP': 470, 'ELP>FG': 640,
    'TP>OP': 640,  'TP>FG': 780,
    'OP>FG': 440,
  };
  function shipMiles(from, to) {
    if (!from || !to) return null;
    if (from === to) return 0;
    if (shipMi[from + '>' + to] != null) return shipMi[from + '>' + to];
    if (shipMi[to + '>' + from] != null) return shipMi[to + '>' + from];
    return null;
  }

  // ---- Supplement programs (stackable purse incentives) --------------------
  // Ship-and-Win is the canonical shipping bonus — flat appearance check + %
  // purse bonus, with eligibility predicates (see docs/research.md §D). The
  // race-builder seeds its bonus inputs from the active program below.
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
    {
      id: 'elp-ship-and-win',
      type: 'shipAndWin',
      label: 'Ellis Ship Bonus',
      scope: 'meet',
      flatAmount: 1000,
      purseBonusPct: 0,
      eligibility: {
        shipInOnly: true,
        minShipMi: 120,
        fromOutsideState: false,
        notRacedInStateMonths: 0,
        excludeStakes: true,
        excludeFirstTimers: false,
      },
      cap: { perHorse: 1, totalBudget: 20000, claimed: 3000 },
    },
  ];

  // ---- Meets ---------------------------------------------------------------
  // The CD meet object keeps its original prototype fields (track, trackName,
  // label, status) so PPData.meet stays shape-compatible for tour.html.
  const meets = [
    {
      id: 'cd-2026-summer',
      track: 'CD',
      trackName: 'Churchill Downs',
      name: 'Churchill Downs — Summer 2026',
      label: 'Summer meet',
      start: '2026-05-30',
      end: '2026-06-28',
      status: 'published',
      meetType: 'regular',
      supplementProgramIds: ['cd-ship-and-win'],
    },
    {
      id: 'elp-2026-summer',
      track: 'ELP',
      trackName: 'Ellis Park',
      name: 'Ellis Park — Summer 2026',
      label: 'Ellis summer meet',
      start: '2026-07-04',
      end: '2026-08-30',
      status: 'published',
      meetType: 'boutique',
      supplementProgramIds: ['elp-ship-and-win'],
    },
  ];

  // ---- Race days -----------------------------------------------------------
  const raceDays = [
    { id: 'cd-jun05', meetId: 'cd-2026-summer', date: '2026-06-05', label: 'Friday, June 5', status: 'published' },
    { id: 'cd-jun06', meetId: 'cd-2026-summer', date: '2026-06-06', label: 'Saturday, June 6', status: 'published' },
    { id: 'cd-jun07', meetId: 'cd-2026-summer', date: '2026-06-07', label: 'Sunday, June 7', status: 'published' },
    { id: 'elp-jul11', meetId: 'elp-2026-summer', date: '2026-07-11', label: 'Saturday, July 11', status: 'draft' },
  ];

  // ---- Stall barns + trainer stall applications (assigned at the meet level)
  const stallBarns = [
    { id: 'barn-cd-12',  meetId: 'cd-2026-summer',  name: 'Barn 12', totalStalls: 40 },
    { id: 'barn-cd-14',  meetId: 'cd-2026-summer',  name: 'Barn 14', totalStalls: 36 },
    { id: 'barn-cd-18',  meetId: 'cd-2026-summer',  name: 'Barn 18', totalStalls: 32 },
    { id: 'barn-cd-22',  meetId: 'cd-2026-summer',  name: 'Barn 22', totalStalls: 24 },
    { id: 'barn-elp-3',  meetId: 'elp-2026-summer', name: 'Barn 3',  totalStalls: 28 },
    { id: 'barn-elp-5',  meetId: 'elp-2026-summer', name: 'Barn 5',  totalStalls: 20 },
  ];

  const stallApplications = [
    { id: 'stall-cd-1',  meetId: 'cd-2026-summer',  stableId: 'snellgrove', horseCount: 6,  preferredBarnId: 'barn-cd-12', status: 'assigned',   barnId: 'barn-cd-12' },
    { id: 'stall-cd-2',  meetId: 'cd-2026-summer',  stableId: 'walden',     horseCount: 8,  preferredBarnId: 'barn-cd-12', status: 'assigned',   barnId: 'barn-cd-12' },
    { id: 'stall-cd-3',  meetId: 'cd-2026-summer',  stableId: 'cox',        horseCount: 10, preferredBarnId: 'barn-cd-14', status: 'pending',    barnId: null },
    { id: 'stall-cd-4',  meetId: 'cd-2026-summer',  stableId: 'murphy',     horseCount: 5,  preferredBarnId: 'barn-cd-18', status: 'pending',    barnId: null },
    { id: 'stall-cd-5',  meetId: 'cd-2026-summer',  stableId: 'hartman',    horseCount: 4,  preferredBarnId: 'barn-cd-22', status: 'waitlisted', barnId: null },
    { id: 'stall-elp-1', meetId: 'elp-2026-summer', stableId: 'stewart',    horseCount: 6,  preferredBarnId: 'barn-elp-3', status: 'assigned',   barnId: 'barn-elp-3' },
    { id: 'stall-elp-2', meetId: 'elp-2026-summer', stableId: 'lobo',       horseCount: 5,  preferredBarnId: 'barn-elp-5', status: 'pending',    barnId: null },
    { id: 'stall-elp-3', meetId: 'elp-2026-summer', stableId: 'asmussen',   horseCount: 3,  preferredBarnId: 'barn-elp-5', status: 'waitlisted', barnId: null },
  ];

  // ---- Races ---------------------------------------------------------------
  // Distances (yards): 5.5f=1210, 6f=1320, 6.5f=1430, 7f=1540, 1mi=1760,
  // 1m70y=1830, 8.5f=1870, 9f=1980. entryClose sits ~72h before postTime.
  const races = [
    // --- Friday, June 5 ---
    {
      id: 'cd-jun5-r1', raceDayId: 'cd-jun05', raceNumber: 1,
      classLadder: 'MdnClm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 32000, par: 76,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'none',
      entryClose: '2026-06-02T10:00:00-05:00', postTime: '2026-06-05T13:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M'], minAge: 3, maidenOnly: true, claimingPrice: 30000,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. Claiming Price $30,000. Six Furlongs.',
      },
    },
    {
      id: 'cd-jun5-r2', raceDayId: 'cd-jun05', raceNumber: 2,
      classLadder: 'Clm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1430, purse: 27000, par: 80,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-06-02T10:00:00-05:00', postTime: '2026-06-05T13:30:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 20000,
        nonWinners: { kind: 'N2L', count: 2 },
        text: 'FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON TWO RACES. Claiming Price $20,000. Six And One Half Furlongs.',
      },
    },
    {
      id: 'cd-jun5-r3', raceDayId: 'cd-jun05', raceNumber: 3,
      classLadder: 'MSW', surface: 'T', isTurf: true, mtoAllowed: true,
      distanceYards: 1760, purse: 90000, par: 84,
      fieldTarget: { min: 7, max: 12 }, alsoEligibleCap: 6, preferenceSystem: 'date',
      entryClose: '2026-06-02T10:00:00-05:00', postTime: '2026-06-05T14:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M'], minAge: 3, maidenOnly: true,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. One Mile (Turf). Main-track-only entries permitted.',
      },
    },
    {
      id: 'cd-jun5-r4', raceDayId: 'cd-jun05', raceNumber: 4,
      classLadder: 'Alw', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1540, purse: 78000, par: 88,
      fieldTarget: { min: 6, max: 9 }, alsoEligibleCap: 3, preferenceSystem: 'date',
      entryClose: '2026-06-02T10:00:00-05:00', postTime: '2026-06-05T14:30:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3,
        nonWinners: { kind: 'N_X', count: 1 },
        text: 'FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON A RACE OTHER THAN MAIDEN, CLAIMING, OR STARTER. Seven Furlongs.',
      },
    },
    {
      id: 'cd-jun5-r5', raceDayId: 'cd-jun05', raceNumber: 5,
      classLadder: 'StarterAlw', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1830, purse: 42000, par: 84,
      fieldTarget: { min: 7, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-06-02T10:00:00-05:00', postTime: '2026-06-05T15:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, starterPrice: 16000, sinceDate: '2025-06-05',
        text: 'FOR THREE YEAR OLDS AND UPWARD WHICH HAVE STARTED FOR A CLAIMING PRICE OF $16,000 OR LESS SINCE JUNE 5, 2025. One Mile And 70 Yards.',
      },
    },
    {
      id: 'cd-jun5-r6', raceDayId: 'cd-jun05', raceNumber: 6,
      classLadder: 'MSW', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 68000, par: 82,
      fieldTarget: { min: 6, max: 9 }, alsoEligibleCap: 3, preferenceSystem: 'date',
      entryClose: '2026-06-02T10:00:00-05:00', postTime: '2026-06-05T15:30:00-05:00',
      stateBredRestricted: true, stateBredCode: 'KY',
      conditions: {
        sexes: ['F', 'M'], minAge: 3, maidenOnly: true,
        nonWinners: { kind: 'maiden' },
        text: 'FOR REGISTERED KENTUCKY-BRED MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. Six Furlongs.',
      },
    },

    // --- Saturday, June 6 ---
    {
      id: 'cd-jun6-r1', raceDayId: 'cd-jun06', raceNumber: 1,
      classLadder: 'MSW', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1210, purse: 84000, par: 82,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-06-03T10:00:00-05:00', postTime: '2026-06-06T13:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M'], minAge: 3, maidenOnly: true,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. Five And One Half Furlongs.',
      },
    },
    {
      id: 'cd-jun6-r2', raceDayId: 'cd-jun06', raceNumber: 2,
      classLadder: 'MdnClm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 38000, par: 78,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'none',
      entryClose: '2026-06-03T10:00:00-05:00', postTime: '2026-06-06T13:30:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: true, claimingPrice: 40000,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, THREE YEARS OLD AND UPWARD. Claiming Price $40,000. Six Furlongs.',
      },
    },
    // R3 — the demo race. Preserved exactly as the prototype shipped it; only
    // the normalized/new fields (raceDayId, par, stateBredCode, mtoAllowed) are added.
    {
      id: 'cd-jun6-r3',
      raceDayId: 'cd-jun06',
      meetId: 'cd-2026-summer',
      raceNumber: 3,
      classLadder: 'MSW',
      surface: 'D',
      distanceYards: 1320,        // 6 furlongs
      purse: 85000,
      par: 82,
      fieldTarget: { min: 8, max: 10 },
      entryClose: '2026-06-03T10:00:00-05:00',  // sourced separately from post time
      postTime: '2026-06-06T14:14:00-05:00',
      stateBredRestricted: false,
      stateBredCode: null,
      preferenceSystem: 'date',  // TODO(v1): drive draw-in probability from this
      alsoEligibleCap: 4,
      isTurf: false,
      mtoAllowed: false,
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
    },
    // R4 — the draw-in / also-eligible SHOWCASE: deliberately seeded OVER
    // fieldTarget.max so the field spills into the also-eligible list.
    {
      id: 'cd-jun6-r4', raceDayId: 'cd-jun06', raceNumber: 4,
      classLadder: 'Clm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 30000, par: 82,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-06-03T10:00:00-05:00', postTime: '2026-06-06T14:45:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 25000,
        text: 'FOR THREE YEAR OLDS AND UPWARD. Claiming Price $25,000. Six Furlongs. (Overfilled — preference by last-start date; also-eligibles drawn if scratches occur.)',
      },
    },
    {
      id: 'cd-jun6-r5', raceDayId: 'cd-jun06', raceNumber: 5,
      classLadder: 'Alw', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1430, purse: 74000, par: 86,
      fieldTarget: { min: 7, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-06-03T10:00:00-05:00', postTime: '2026-06-06T15:15:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M'], minAge: 3,
        nonWinners: { kind: 'N2L', count: 2 },
        text: 'FOR FILLIES AND MARES THREE YEARS OLD AND UPWARD WHICH HAVE NEVER WON TWO RACES. Six And One Half Furlongs.',
      },
    },
    {
      id: 'cd-jun6-r6', raceDayId: 'cd-jun06', raceNumber: 6,
      classLadder: 'OptClm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1830, purse: 82000, par: 90,
      fieldTarget: { min: 6, max: 9 }, alsoEligibleCap: 3, preferenceSystem: 'date',
      entryClose: '2026-06-03T10:00:00-05:00', postTime: '2026-06-06T15:45:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 62500,
        nonWinners: { kind: 'N_X', count: 1 },
        text: 'FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON A RACE OTHER THAN MAIDEN, CLAIMING, OR STARTER OR OPTIONAL CLAIMING PRICE $62,500. One Mile And 70 Yards.',
      },
    },
    // R7 — the stakes: Listed, Lasix prohibited (blocks the storyline mare).
    {
      id: 'cd-jun6-r7', raceDayId: 'cd-jun06', raceNumber: 7,
      classLadder: 'Listed', surface: 'T', isTurf: true, mtoAllowed: false,
      distanceYards: 1870, purse: 150000, par: 94,
      fieldTarget: { min: 6, max: 12 }, alsoEligibleCap: 4, preferenceSystem: 'stars',
      entryClose: '2026-06-03T10:00:00-05:00', postTime: '2026-06-06T16:15:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, lasixProhibited: true,
        name: 'Louisville Turf Stakes (Listed)',
        text: 'THE LOUISVILLE TURF STAKES (LISTED). FOR THREE YEAR OLDS AND UPWARD. One And One Sixteenth Miles (Turf). No race-day Lasix permitted.',
      },
    },

    // --- Sunday, June 7 ---
    {
      id: 'cd-jun7-r1', raceDayId: 'cd-jun07', raceNumber: 1,
      classLadder: 'MSW', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 84000, par: 82,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-06-04T10:00:00-05:00', postTime: '2026-06-07T13:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M'], minAge: 3, maidenOnly: true,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. Six Furlongs.',
      },
    },
    {
      id: 'cd-jun7-r2', raceDayId: 'cd-jun07', raceNumber: 2,
      classLadder: 'MdnClm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1760, purse: 46000, par: 78,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'none',
      entryClose: '2026-06-04T10:00:00-05:00', postTime: '2026-06-07T13:30:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: true, claimingPrice: 50000,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, THREE YEARS OLD AND UPWARD. Claiming Price $50,000. One Mile.',
      },
    },
    {
      id: 'cd-jun7-r3', raceDayId: 'cd-jun07', raceNumber: 3,
      classLadder: 'Clm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 16000, par: 80,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-06-04T10:00:00-05:00', postTime: '2026-06-07T14:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 10000,
        nonWinners: { kind: 'N2L', count: 2 },
        text: 'FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON TWO RACES. Claiming Price $10,000. Six Furlongs.',
      },
    },
    {
      id: 'cd-jun7-r4', raceDayId: 'cd-jun07', raceNumber: 4,
      classLadder: 'Alw', surface: 'T', isTurf: true, mtoAllowed: false,
      distanceYards: 1760, purse: 80000, par: 88,
      fieldTarget: { min: 6, max: 9 }, alsoEligibleCap: 3, preferenceSystem: 'date',
      entryClose: '2026-06-04T10:00:00-05:00', postTime: '2026-06-07T14:30:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3,
        nonWinners: { kind: 'N_X', count: 1 },
        text: 'FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON A RACE OTHER THAN MAIDEN, CLAIMING, OR STARTER. One Mile (Turf).',
      },
    },
    {
      id: 'cd-jun7-r5', raceDayId: 'cd-jun07', raceNumber: 5,
      classLadder: 'Clm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1540, purse: 33000, par: 84,
      fieldTarget: { min: 7, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-06-04T10:00:00-05:00', postTime: '2026-06-07T15:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 40000,
        text: 'FOR THREE YEAR OLDS AND UPWARD. Claiming Price $40,000. Seven Furlongs.',
      },
    },

    // --- Ellis Park, Saturday, July 11 (draft meet) ---
    {
      id: 'elp-jul11-r1', raceDayId: 'elp-jul11', raceNumber: 1,
      classLadder: 'MSW', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 42000, par: 78,
      fieldTarget: { min: 6, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-07-08T10:00:00-05:00', postTime: '2026-07-11T13:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M'], minAge: 3, maidenOnly: true,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. Six Furlongs.',
      },
    },
    {
      id: 'elp-jul11-r2', raceDayId: 'elp-jul11', raceNumber: 2,
      classLadder: 'Clm', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1430, purse: 18000, par: 78,
      fieldTarget: { min: 6, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-07-08T10:00:00-05:00', postTime: '2026-07-11T13:30:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 15000,
        text: 'FOR THREE YEAR OLDS AND UPWARD. Claiming Price $15,000. Six And One Half Furlongs.',
      },
    },
    {
      id: 'elp-jul11-r3', raceDayId: 'elp-jul11', raceNumber: 3,
      classLadder: 'Alw', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1830, purse: 44000, par: 84,
      fieldTarget: { min: 6, max: 9 }, alsoEligibleCap: 3, preferenceSystem: 'date',
      entryClose: '2026-07-08T10:00:00-05:00', postTime: '2026-07-11T14:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3,
        nonWinners: { kind: 'N_X', count: 1 },
        text: 'FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON A RACE OTHER THAN MAIDEN, CLAIMING, OR STARTER. One Mile And 70 Yards.',
      },
    },
  ];

  // ---- Stables (Trainer barns) ---------------------------------------------
  // `snellgrove` is the demo user's barn (dashboard persona: "Jack Snellgrove").
  const stables = [
    { id: 'snellgrove', name: 'Snellgrove Racing', trainer: 'Jack Snellgrove', homeTrack: 'CD',  trainerPct: 0.20, isDemoUser: true },
    { id: 'murphy',     name: 'Murphy Racing',     trainer: 'Murphy C.',       homeTrack: 'CD',  trainerPct: 0.11 },
    { id: 'cox',        name: 'Cox Thoroughbreds', trainer: 'Cox B.',          homeTrack: 'CD',  trainerPct: 0.19 },
    { id: 'mott',       name: 'Mott Stable',       trainer: 'Mott W.',         homeTrack: 'KEE', trainerPct: 0.14 },
    { id: 'stewart',    name: 'Stewart Racing',    trainer: 'Stewart D.',      homeTrack: 'ELP', trainerPct: 0.13 },
    { id: 'asmussen',   name: 'Asmussen Stable',   trainer: 'Asmussen S.',     homeTrack: 'OP',  trainerPct: 0.20 },
    { id: 'lobo',       name: 'Lobo Stable',       trainer: 'Lobo P.',         homeTrack: 'FG',  trainerPct: 0.16 },
    { id: 'walden',     name: 'Walden Racing',     trainer: 'Walden W.',       homeTrack: 'CD',  trainerPct: 0.22 },
    { id: 'hartman',    name: 'Hartman Racing',    trainer: 'Hartman J.',      homeTrack: 'TP',  trainerPct: 0.15 },
  ];

  // ---- Horses --------------------------------------------------------------
  // The original 9 prototype horses keep every existing field name/value; each
  // gains an `id`, a `stableId`, and the v1 fields (record, lastStartDate,
  // preference, vetList, medication, equipment, stateBred, flags).
  // `daysSince` and `lastStartDate` are both derived from PPData.today.
  const horses = [
    // ----- Snellgrove Racing (demo barn, 14 head) -----
    { id: 'zengraya', name: 'Zengraya', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'F', age: 3, maiden: true, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 121, lastSpeed: 82, daysSince: 49, home: 'CD', shipMi: 0, trainerPct: 0.21,
      record: { starts: 3, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-13',
      preference: { date: '2026-04-13', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    { id: 'tammys-kiss', name: "Tammy's Kiss", stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Bauer P.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 114, lastSpeed: 0, daysSince: 0, home: 'CD', shipMi: 0, trainerPct: 0.18,
      record: { starts: 0, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: null,
      preference: { date: null, stars: 1 }, vetList: { listed: false }, medication: { lasix: false, firstTimeLasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['first-time-starter'] },
    { id: 'silverware', name: 'Silverware', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'F', age: 4, maiden: false, under50k: false, surf: ['T', 'D'], sweet: [1760, 1980], classR: 124, lastSpeed: 96, daysSince: 16, home: 'CD', shipMi: 0, trainerPct: 0.20,
      record: { starts: 16, careerWins: 5, winsOtherThanMdnClmStarter: 3, lastWinDate: '2026-05-16' }, lastStartDate: '2026-05-16',
      preference: { date: '2026-05-16', stars: 5 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['stakes-quality', 'lasix-stakes-block'] },
    { id: 'cinder-path', name: 'Cinder Path', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 116, lastSpeed: 78, daysSince: 30, home: 'CD', shipMi: 0, trainerPct: 0.20,
      record: { starts: 3, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-05-02',
      preference: { date: '2026-05-02', stars: 3 }, vetList: { listed: false }, medication: { lasix: false, firstTimeLasix: true }, equipment: { blinkers: 'on', changed: true }, stateBred: null, flags: ['first-time-lasix', 'first-time-blinkers'] },
    { id: 'marigold-lane', name: 'Marigold Lane', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Bauer P.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1540], classR: 113, lastSpeed: 70, daysSince: 42, home: 'CD', shipMi: 0, trainerPct: 0.18,
      record: { starts: 4, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-20',
      preference: { date: '2026-04-20', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    { id: 'copper-kettle', name: 'Copper Kettle', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 115, lastSpeed: 74, daysSince: 33, home: 'CD', shipMi: 0, trainerPct: 0.20,
      record: { starts: 3, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-29',
      preference: { date: '2026-04-29', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: 'KY', flags: ['ky-bred'] },
    { id: 'steel-thistle', name: 'Steel Thistle', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'C', age: 3, maiden: true, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 118, lastSpeed: 84, daysSince: 45, home: 'CD', shipMi: 0, trainerPct: 0.20,
      record: { starts: 4, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-17',
      preference: { date: '2026-04-17', stars: 3 }, vetList: { listed: true, reason: 'unsound', eligibleDate: '2026-06-20' }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['vet-list'] },
    { id: 'harbor-mist', name: 'Harbor Mist', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Bauer P.', sex: 'F', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1430, 1760], classR: 117, lastSpeed: 86, daysSince: 40, home: 'CD', shipMi: 0, trainerPct: 0.18,
      record: { starts: 11, careerWins: 2, winsOtherThanMdnClmStarter: 0, lastWinDate: '2026-03-15' }, lastStartDate: '2026-04-22',
      preference: { date: '2026-04-22', stars: 3 }, vetList: { listed: true, reason: 'bled', eligibleDate: '2026-05-28' }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['recently-cleared'] },
    { id: 'quarry-road', name: 'Quarry Road', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'C', age: 3, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 119, lastSpeed: 90, daysSince: 24, home: 'CD', shipMi: 0, trainerPct: 0.20,
      record: { starts: 6, careerWins: 2, winsOtherThanMdnClmStarter: 0, lastWinDate: '2026-05-08' }, lastStartDate: '2026-05-08',
      preference: { date: '2026-05-08', stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['n1x-eligible'] },
    { id: 'tin-roof', name: 'Tin Roof', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Bauer P.', sex: 'G', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1540, 1830], classR: 120, lastSpeed: 91, daysSince: 27, home: 'CD', shipMi: 0, trainerPct: 0.18,
      record: { starts: 9, careerWins: 3, winsOtherThanMdnClmStarter: 1, lastWinDate: '2026-05-05' }, lastStartDate: '2026-05-05',
      preference: { date: '2026-05-05', stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'on', changed: false }, stateBred: null, flags: ['n2x-eligible'] },
    { id: 'maple-sugar', name: 'Maple Sugar', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Bauer P.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 106, lastSpeed: 62, daysSince: 38, home: 'CD', shipMi: 0, trainerPct: 0.18,
      record: { starts: 5, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-24',
      preference: { date: '2026-04-24', stars: 1 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['drop-to-maiden-claiming'] },
    { id: 'dockside', name: 'Dockside', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'C', age: 4, maiden: false, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 110, lastSpeed: 84, daysSince: 20, home: 'CD', shipMi: 0, trainerPct: 0.20,
      record: { starts: 12, careerWins: 2, winsOtherThanMdnClmStarter: 0, lastWinDate: '2026-04-10' }, lastStartDate: '2026-05-12',
      preference: { date: '2026-05-12', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: true }, stateBred: null, flags: ['claiming'] },
    { id: 'gale-warning', name: 'Gale Warning', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Beschizza A.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['T', 'D'], sweet: [1760, 1830], classR: 114, lastSpeed: 76, daysSince: 31, home: 'CD', shipMi: 0, trainerPct: 0.20,
      record: { starts: 4, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-05-01',
      preference: { date: '2026-05-01', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['turf', 'mto-candidate'] },
    { id: 'river-reign', name: 'River Reign', stableId: 'snellgrove', stable: 'Snellgrove Racing', trainer: 'Bauer P.', sex: 'C', age: 3, maiden: true, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 117, lastSpeed: 79, daysSince: 26, home: 'CD', shipMi: 0, trainerPct: 0.18,
      record: { starts: 3, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-05-06',
      preference: { date: '2026-05-06', stars: 3 }, vetList: { listed: false }, medication: { lasix: false, firstTimeLasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['first-time-lasix'] },

    // ----- Other barns (ship-in & field-filler stories) -----
    { id: 'island-barbie', name: 'Island Barbie', stableId: 'murphy', stable: 'Murphy Racing', trainer: 'Murphy C.', sex: 'F', age: 4, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1540], classR: 107, lastSpeed: 64, daysSince: 120, home: 'CD', shipMi: 0, trainerPct: 0.11,
      record: { starts: 6, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-02-01',
      preference: { date: '2026-02-01', stars: 1 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['layoff'] },
    { id: 'halcyon-days', name: 'Halcyon Days', stableId: 'cox', stable: 'Cox Thoroughbreds', trainer: 'Cox B.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1540, 1760], classR: 110, lastSpeed: 0, daysSince: 0, home: 'CD', shipMi: 0, trainerPct: 0.19,
      record: { starts: 0, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: null,
      preference: { date: null, stars: 2 }, vetList: { listed: false }, medication: { lasix: false, firstTimeLasix: true }, equipment: { blinkers: 'on', changed: true }, stateBred: null, flags: ['first-time-starter'] },
    { id: 'painted-lily', name: 'Painted Lily', stableId: 'mott', stable: 'Mott Stable', trainer: 'Mott W.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 112, lastSpeed: 75, daysSince: 35, home: 'KEE', shipMi: 78, trainerPct: 0.14,
      record: { starts: 3, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-27',
      preference: { date: '2026-04-27', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: 'KY', flags: ['ship-in', 'ky-bred'] },
    { id: 'river-sonata', name: 'River Sonata', stableId: 'stewart', stable: 'Stewart Racing', trainer: 'Stewart D.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 108, lastSpeed: 71, daysSince: 28, home: 'ELP', shipMi: 130, trainerPct: 0.13,
      record: { starts: 2, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-05-04',
      preference: { date: '2026-05-04', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['ship-in', 'below-bonus-min'] },
    { id: 'quiet-storm', name: 'Quiet Storm', stableId: 'asmussen', stable: 'Asmussen Stable', trainer: 'Asmussen S.', sex: 'F', age: 4, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1540], classR: 111, lastSpeed: 80, daysSince: 25, home: 'OP', shipMi: 560, trainerPct: 0.20,
      record: { starts: 5, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-05-07',
      preference: { date: '2026-05-07', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['ship-in', 'ship-and-win'] },
    { id: 'cajun-belle', name: 'Cajun Belle', stableId: 'lobo', stable: 'Lobo Stable', trainer: 'Lobo P.', sex: 'F', age: 4, maiden: true, under50k: true, surf: ['D'], sweet: [1430, 1760], classR: 105, lastSpeed: 73, daysSince: 40, home: 'FG', shipMi: 700, trainerPct: 0.16,
      record: { starts: 7, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-22',
      preference: { date: '2026-04-22', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['ship-in', 'ship-and-win'] },
    { id: 'battis-grove', name: 'Battis Grove', stableId: 'walden', stable: 'Walden Racing', trainer: 'Walden W.', sex: 'G', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 112, lastSpeed: 90, daysSince: 30, home: 'CD', shipMi: 0, trainerPct: 0.22,
      record: { starts: 14, careerWins: 3, winsOtherThanMdnClmStarter: 1, lastWinDate: '2026-03-20' }, lastStartDate: '2026-05-02',
      preference: { date: '2026-05-02', stars: 4 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'on', changed: false }, stateBred: null, flags: ['n2x-eligible'] },
    { id: 'bourbon-barrel', name: 'Bourbon Barrel', stableId: 'asmussen', stable: 'Asmussen Stable', trainer: 'Asmussen S.', sex: 'G', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 116, lastSpeed: 92, daysSince: 21, home: 'OP', shipMi: 560, trainerPct: 0.20,
      record: { starts: 8, careerWins: 2, winsOtherThanMdnClmStarter: 0, lastWinDate: '2026-05-11' }, lastStartDate: '2026-05-11',
      preference: { date: '2026-05-11', stars: 4 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['ship-in', 'ship-and-win', 'n1x-eligible'] },
    { id: 'delta-duke', name: 'Delta Duke', stableId: 'lobo', stable: 'Lobo Stable', trainer: 'Lobo P.', sex: 'C', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 118, lastSpeed: 94, daysSince: 18, home: 'FG', shipMi: 700, trainerPct: 0.18,
      record: { starts: 11, careerWins: 4, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-05-14' }, lastStartDate: '2026-05-14',
      preference: { date: '2026-05-14', stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['ship-in', 'ship-and-win'] },
    { id: 'ozark-ruby', name: 'Ozark Ruby', stableId: 'asmussen', stable: 'Asmussen Stable', trainer: 'Asmussen S.', sex: 'F', age: 4, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 109, lastSpeed: 77, daysSince: 23, home: 'OP', shipMi: 560, trainerPct: 0.20,
      record: { starts: 6, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-05-09',
      preference: { date: '2026-05-09', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['ship-in', 'ship-and-win'] },
    { id: 'crescent-moon', name: 'Crescent Moon', stableId: 'lobo', stable: 'Lobo Stable', trainer: 'Lobo P.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['T', 'D'], sweet: [1540, 1760], classR: 108, lastSpeed: 72, daysSince: 35, home: 'FG', shipMi: 700, trainerPct: 0.16,
      record: { starts: 4, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-27',
      preference: { date: '2026-04-27', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['ship-in', 'ship-and-win', 'turf'] },
    { id: 'bluegrass-baron', name: 'Bluegrass Baron', stableId: 'mott', stable: 'Mott Stable', trainer: 'Mott W.', sex: 'C', age: 3, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 118, lastSpeed: 88, daysSince: 29, home: 'KEE', shipMi: 78, trainerPct: 0.14,
      record: { starts: 7, careerWins: 2, winsOtherThanMdnClmStarter: 1, lastWinDate: '2026-05-03' }, lastStartDate: '2026-05-03',
      preference: { date: '2026-05-03', stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: 'KY', flags: ['ship-in', 'ky-bred'] },
    { id: 'frost-bank', name: 'Frost Bank', stableId: 'hartman', stable: 'Hartman Racing', trainer: 'Hartman J.', sex: 'G', age: 4, maiden: false, under50k: true, surf: ['D'], sweet: [1320, 1540], classR: 111, lastSpeed: 83, daysSince: 26, home: 'TP', shipMi: 100, trainerPct: 0.15,
      record: { starts: 15, careerWins: 3, winsOtherThanMdnClmStarter: 0, lastWinDate: '2026-05-06' }, lastStartDate: '2026-05-06',
      preference: { date: '2026-05-06', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['ship-in', 'below-bonus-min', 'claiming'] },
    { id: 'silk-purse', name: 'Silk Purse', stableId: 'stewart', stable: 'Stewart Racing', trainer: 'Stewart D.', sex: 'F', age: 3, maiden: true, under50k: true, surf: ['D'], sweet: [1320, 1430], classR: 110, lastSpeed: 74, daysSince: 33, home: 'ELP', shipMi: 130, trainerPct: 0.13,
      record: { starts: 5, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-04-29',
      preference: { date: '2026-04-29', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: 'KY', flags: ['ship-in', 'below-bonus-min', 'ky-bred'] },
  ];

  // ---- Entries (seeded baseline fields) ------------------------------------
  // Most races sit a bit UNDER fieldTarget.min to motivate the Track "fill"
  // story; the demo barn's horses are mostly left unentered (they need spots).
  // cd-jun6-r4 is deliberately OVER fieldTarget.max — the also-eligible showcase.
  const seedRoster = {
    'cd-jun5-r1': ['island-barbie', 'painted-lily', 'river-sonata', 'silk-purse', 'ozark-ruby'],
    'cd-jun5-r2': ['battis-grove', 'frost-bank', 'delta-duke', 'bluegrass-baron', 'bourbon-barrel'],
    'cd-jun5-r3': ['crescent-moon', 'silk-purse', 'painted-lily'],
    'cd-jun5-r4': ['bourbon-barrel', 'frost-bank'],
    'cd-jun5-r5': ['frost-bank', 'battis-grove', 'delta-duke'],
    'cd-jun5-r6': ['silk-purse', 'painted-lily'],
    'cd-jun6-r1': ['island-barbie', 'halcyon-days', 'river-sonata', 'ozark-ruby', 'crescent-moon'],
    'cd-jun6-r2': ['painted-lily', 'silk-purse', 'quiet-storm', 'cajun-belle'],
    'cd-jun6-r3': ['island-barbie', 'painted-lily', 'river-sonata', 'quiet-storm', 'cajun-belle', 'ozark-ruby'],
    // Showcase: 12 entries against fieldTarget.max = 10 → spills to also-eligibles.
    'cd-jun6-r4': ['battis-grove', 'bourbon-barrel', 'delta-duke', 'bluegrass-baron', 'frost-bank', 'ozark-ruby', 'quiet-storm', 'cajun-belle', 'island-barbie', 'silk-purse', 'painted-lily', 'river-sonata'],
    'cd-jun6-r5': ['quiet-storm', 'cajun-belle', 'ozark-ruby', 'crescent-moon'],
    'cd-jun6-r6': ['bourbon-barrel', 'delta-duke', 'bluegrass-baron', 'battis-grove'],
    'cd-jun6-r7': ['battis-grove', 'bourbon-barrel'],
    'cd-jun7-r1': ['island-barbie', 'painted-lily', 'river-sonata', 'crescent-moon'],
    'cd-jun7-r2': ['quiet-storm', 'cajun-belle', 'ozark-ruby', 'silk-purse'],
    'cd-jun7-r3': ['frost-bank', 'battis-grove', 'delta-duke'],
    'cd-jun7-r4': ['bourbon-barrel', 'frost-bank'],
    'cd-jun7-r5': ['battis-grove', 'bourbon-barrel', 'bluegrass-baron', 'delta-duke'],
    'elp-jul11-r1': ['silk-purse', 'crescent-moon', 'ozark-ruby'],
    'elp-jul11-r2': ['frost-bank', 'battis-grove'],
    'elp-jul11-r3': ['bourbon-barrel', 'frost-bank'],
  };
  const entries = [];
  Object.keys(seedRoster).forEach((raceId) => {
    seedRoster[raceId].forEach((horseId) => {
      entries.push({ id: raceId + '::' + horseId, raceId, horseId, source: 'seed' });
    });
  });

  // ---- Internal join helpers ----------------------------------------------
  const byId = (arr) => arr.reduce((m, x) => { m[x.id] = x; return m; }, {});
  const trackById = byId(tracks);
  const meetById = byId(meets);
  const raceDayById = byId(raceDays);
  const raceById = byId(races);
  const stableById = byId(stables);
  const horseById = byId(horses);
  const programById = byId(supplementPrograms);
  const stallBarnById = byId(stallBarns);
  const stallApplicationById = byId(stallApplications);

  const meetOfRace = (r) => (r.meetId || (raceDayById[r.raceDayId] || {}).meetId);

  // ---- Back-compat anchors (tour.html / app.html load this file) -----------
  const race = raceById['cd-jun6-r3'];            // PPData.race — the demo race
  const meet = meetById['cd-2026-summer'];        // PPData.meet — the CD meet

  // ---- API facade (Stage 2: swap bodies for fetch()) -----------------------
  const PPData = {
    // canonical clock + enums
    today,
    classLadder,

    // back-compat surface (unchanged shapes) --------------------------------
    horses,          // array of every horse, original field names intact
    race,            // the cd-jun6-r3 object
    meet,            // the Churchill Downs meet object
    supplementPrograms,

    // normalized collections (handy for the new data-driven screens) --------
    tracks, meets, raceDays, races, stables, entries, shipMi,
    stallBarns, stallApplications,

    // tracks
    getTrack(id) { return trackById[id] || null; },
    listTracks() { return tracks; },

    // meets
    getMeet(id) { return meetById[id] || null; },
    listMeets() { return meets; },

    // race days
    listRaceDays(meetId) { return raceDays.filter((d) => d.meetId === meetId); },
    getRaceDay(id) { return raceDayById[id] || null; },

    // races. openOnly = entryClose strictly after PPData.today.
    listRaces(opts) {
      const o = opts || {};
      let out = races;
      if (o.raceDayId) out = out.filter((r) => r.raceDayId === o.raceDayId);
      if (o.meetId) out = out.filter((r) => meetOfRace(r) === o.meetId);
      if (o.openOnly) out = out.filter((r) => r.entryClose > today);
      return out;
    },
    // getRace() with no id returns the demo race (prototype back-compat).
    getRace(id) { return id ? (raceById[id] || null) : race; },

    // horses
    getHorse(id) { return horseById[id] || null; },
    listHorses(opts) {
      if (!opts || !opts.stableId) return horses;
      return horses.filter((h) => h.stableId === opts.stableId);
    },

    // stables
    getStable(id) { return stableById[id] || null; },
    listStables() { return stables; },

    // stall barns + trainer stall applications (meet-level)
    getStallBarn(id) { return stallBarnById[id] || null; },
    listStallBarns(meetId) { return stallBarns.filter((b) => b.meetId === meetId); },
    getStallApplication(id) { return stallApplicationById[id] || null; },
    listStallApplications(meetId) { return stallApplications.filter((a) => a.meetId === meetId); },
    demoStable() { return stables.find((s) => s.isDemoUser) || null; },

    // shipping + incentives
    shipMiles,
    // Active Ship-and-Win program for a meet (default = CD meet). Same object
    // and behavior as the prototype's shipProgram().
    shipProgram(meetId) {
      const m = meetById[meetId || 'cd-2026-summer'] || meet;
      const ids = (m && m.supplementProgramIds) || [];
      for (let i = 0; i < ids.length; i++) {
        const p = programById[ids[i]];
        if (p && p.type === 'shipAndWin') return p;
      }
      // Fallback preserves the original find-by-type behavior.
      return supplementPrograms.find((p) => p.type === 'shipAndWin') || null;
    },

    // entries
    seedEntries(raceId) { return entries.filter((e) => e.raceId === raceId); },
  };

  global.PPData = PPData;
})(window);
