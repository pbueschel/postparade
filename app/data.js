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

  // Canonical demo clock — real time, not a fixed date. Several call sites
  // compare this against seeded ISO strings lexicographically (e.g.
  // `race.entryClose > PPData.today` in screens-track.js), which only works
  // if every string shares the same UTC offset suffix — so this is formatted
  // as US Central (-05:00) to match the seed's timestamps, not toISOString()
  // (which would emit a 'Z' suffix and silently break those comparisons).
  // Content with fixed real-world dates (meets, race days) will naturally
  // age into "closed"/historical as real time passes them — expected, not a bug.
  const pad2 = (n) => String(n).padStart(2, '0');
  function nowAsCentralISO() {
    const d = new Date(Date.now() - 5 * 3600 * 1000); // shift to Central wall-clock, read back as UTC fields
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}-05:00`;
  }
  const today = nowAsCentralISO();

  // ---- Rolling demo-fiction race day (R1.1) --------------------------------
  // The *fictional* Ellis Park `elp-jul11-*` card is kept perpetually live by
  // deriving its date from `today` at seed-build time, instead of a fixed
  // calendar date that decays into "closed" as real time advances. It always
  // lands on the upcoming Saturday that leaves ≥72h of entry runway (so
  // `entryClose > today` always holds and the card stays open in both
  // workspaces). ONLY this invented card rolls — every real, cited race/result
  // (Saratoga, Bluebonnet, Delta Downs, Molly McIver's Ellis win) keeps its
  // fixed real date per docs/decisions.md (2026-07-09). See plan.md R1.1.
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_MS = 86400000;
  function ymd(d) { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
  const rollBase = new Date(today.slice(0, 10) + 'T00:00:00Z');
  // Days to the next Saturday (getUTCDay: 0=Sun … 6=Sat); if that Saturday is
  // under 4 days out (entryClose would fall on/before today), skip to the one
  // after so there is always a live countdown.
  let toSat = (6 - rollBase.getUTCDay() + 7) % 7;
  if (toSat < 4) toSat += 7;
  const rollRaceDay = new Date(rollBase.getTime() + toSat * DAY_MS);   // the card's Saturday
  const rollClose   = new Date(rollRaceDay.getTime() - 3 * DAY_MS);    // entries close ~72h before post
  const rollDate    = ymd(rollRaceDay);                                 // 'YYYY-MM-DD' race-day date
  const rollLabel   = `Saturday, ${MONTH_NAMES[rollRaceDay.getUTCMonth()]} ${rollRaceDay.getUTCDate()}`;
  const rollCloseISO = `${ymd(rollClose)}T10:00:00-05:00`;              // shared entryClose for the card
  const rollPostISO  = (hhmm) => `${rollDate}T${hhmm}:00-05:00`;        // per-race post time on the rolling Saturday

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
    // Real tracks added for the LaRose demo — see docs/research-delta-downs-larose-2026-07-09.md
    { id: 'DED', name: 'Delta Downs',     state: 'LA' },
    { id: 'SAR', name: 'Saratoga',        state: 'NY' },
    { id: 'LS',  name: 'Lone Star Park',  state: 'TX' },
  ];

  // ---- Shipping matrix -----------------------------------------------------
  // Pair-keyed road miles (one direction stored; shipMiles() checks both).
  const shipMi = {
    'KEE>CD': 78,  'ELP>CD': 130, 'TP>CD': 100, 'OP>CD': 560, 'FG>CD': 700,
    'KEE>ELP': 140, 'KEE>TP': 85,  'KEE>OP': 570, 'KEE>FG': 730,
    'ELP>TP': 200, 'ELP>OP': 470, 'ELP>FG': 640,
    'TP>OP': 640,  'TP>FG': 780,
    'OP>FG': 440,
    // New-track road-mile pairings (approximate real-world highway miles, illustrative like the rest of this matrix) — see docs/research-delta-downs-larose-2026-07-09.md
    'DED>CD': 780, 'DED>ELP': 750, 'DED>SAR': 1450, 'DED>LS': 220, 'DED>KEE': 830, 'DED>TP': 800, 'DED>OP': 440, 'DED>FG': 200,
    'SAR>CD': 780, 'SAR>ELP': 800, 'SAR>KEE': 750, 'SAR>TP': 780, 'SAR>OP': 1250, 'SAR>FG': 1500, 'SAR>LS': 1750,
    'LS>CD': 900,  'LS>ELP': 870, 'LS>KEE': 950, 'LS>TP': 900, 'LS>OP': 320, 'LS>FG': 260,
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
      discipline: 'TB',
      supplementProgramIds: ['cd-ship-and-win'],
    },
    {
      id: 'elp-2026-summer',
      track: 'ELP',
      trackName: 'Ellis Park',
      name: 'Ellis Park — Summer 2026',
      label: 'Ellis summer meet',
      start: '2026-07-04',
      // End extends to whichever is later — the fixed seed end or two weeks past
      // the rolling demo card (R1.1) — so the perpetually-live card always falls
      // inside the meet window even as `today` advances.
      end: ymd(new Date(Math.max(Date.parse('2026-08-30T00:00:00Z'), rollRaceDay.getTime() + 14 * DAY_MS))),
      status: 'published',
      meetType: 'boutique',
      discipline: 'TB',
      supplementProgramIds: ['elp-ship-and-win'],
    },
    // Real tracks/meets for the LaRose demo — see docs/research-delta-downs-larose-2026-07-09.md
    {
      id: 'sar-2026-summer', track: 'SAR', trackName: 'Saratoga',
      name: 'Saratoga — Summer 2026', label: 'Summer meet',
      start: '2026-07-03', end: '2026-09-07', status: 'published', meetType: 'boutique',
      discipline: 'TB',
      supplementProgramIds: [],
    },
    {
      id: 'ls-2026-spring', track: 'LS', trackName: 'Lone Star Park',
      name: 'Lone Star Park — Spring 2026', label: 'Spring meet',
      start: '2026-04-16', end: '2026-07-12', status: 'published', meetType: 'regular',
      discipline: 'TB',
      supplementProgramIds: [],
    },
    {
      id: 'ded-2026-quarter', track: 'DED', trackName: 'Delta Downs',
      name: 'Delta Downs — Quarter Horse Meet 2026', label: 'Quarter Horse meet',
      start: '2026-04-24', end: '2026-07-18', status: 'published', meetType: 'regular',
      // Quarter Horse racing (AQHA) — the app's only non-Thoroughbred meet. Drives
      // the registry eligibility gate (R3.1) and yards-not-furlongs distance display.
      discipline: 'QH',
      supplementProgramIds: [],
    },
  ];

  // ---- Race days -----------------------------------------------------------
  const raceDays = [
    { id: 'cd-jun05', meetId: 'cd-2026-summer', date: '2026-06-05', label: 'Friday, June 5', status: 'published' },
    { id: 'cd-jun06', meetId: 'cd-2026-summer', date: '2026-06-06', label: 'Saturday, June 6', status: 'published' },
    { id: 'cd-jun07', meetId: 'cd-2026-summer', date: '2026-06-07', label: 'Sunday, June 7', status: 'published' },
    // Ellis Park — fictional demo card, dates roll off `today` (R1.1) so it is
    // always the upcoming Saturday and always open. Keeps its `elp-jul11` id.
    { id: 'elp-jul11', meetId: 'elp-2026-summer', date: rollDate, label: rollLabel, status: 'published' },
    // Real race days for the LaRose demo — see docs/research-delta-downs-larose-2026-07-09.md
    // Saratoga — the live, still-open card (Jul 11 is after `today`)
    { id: 'sar-jul11', meetId: 'sar-2026-summer', date: '2026-07-11', label: 'Saturday, July 11', status: 'published' },
    // Lone Star Park — historical, already-run Bluebonnet card
    { id: 'ls-apr16', meetId: 'ls-2026-spring', date: '2026-04-16', label: 'Thursday, April 16', status: 'published' },
    // Delta Downs — mix of historical (already-run, real results known) and live (Jul 11, not yet run)
    { id: 'ded-apr24', meetId: 'ded-2026-quarter', date: '2026-04-24', label: 'Opening Night', status: 'published' },
    { id: 'ded-may16', meetId: 'ded-2026-quarter', date: '2026-05-16', label: 'Old South Futurity/Derby Finals', status: 'published' },
    { id: 'ded-jul11', meetId: 'ded-2026-quarter', date: '2026-07-11', label: 'Louisiana Bred Finals Day', status: 'published' },
    // Ellis Park — new day on the EXISTING elp-2026-summer meet (Molly McIver's postponed card)
    { id: 'elp-jul06', meetId: 'elp-2026-summer', date: '2026-07-06', label: 'Monday, July 6', status: 'published' },
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

    // --- Ellis Park fictional demo card — dates roll off `today` (R1.1), always open ---
    {
      id: 'elp-jul11-r1', raceDayId: 'elp-jul11', raceNumber: 1,
      classLadder: 'MSW', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 42000, par: 78,
      fieldTarget: { min: 6, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: rollCloseISO, postTime: rollPostISO('13:00'),
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
      entryClose: rollCloseISO, postTime: rollPostISO('13:30'),
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
      entryClose: rollCloseISO, postTime: rollPostISO('14:00'),
      stateBredRestricted: false, stateBredCode: null,
      // FICTIONAL demo card (R1.1/R4.1): the non-winners bar is set to N3X so
      // Kinnon LaRose's real dirt roster (older allowance/claiming winners with
      // ≤2 wins "other than") genuinely fits — this is the loop-carrying ELP race
      // the Track office can Request LaRose horses into. Only this invented race's
      // conditions are tuned; the real horses' facts are never touched.
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3,
        nonWinners: { kind: 'N_X', count: 3 },
        text: 'FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON THREE RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER. One Mile And 70 Yards.',
      },
    },

    // ==== Real races for the LaRose demo — see docs/research-delta-downs-larose-2026-07-09.md ====

    // --- Saratoga, Saturday, July 11 (live/open — entryClose after today) ---
    {
      id: 'sar-jul11-r1', raceDayId: 'sar-jul11', meetId: 'sar-2026-summer', raceNumber: 1,
      classLadder: 'MSW', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 20010, par: 78,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-07-10T10:00:00-04:00', postTime: '2026-07-11T13:00:00-04:00',
      stateBredRestricted: true, stateBredCode: 'NY',
      conditions: {
        sexes: ['C', 'G'], minAge: 2, maidenOnly: true, claimingPrice: null,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, TWO YEAR OLDS. New York-bred Fund Purse.',
      },
    },
    {
      id: 'sar-jul11-r2', raceDayId: 'sar-jul11', meetId: 'sar-2026-summer', raceNumber: 2,
      classLadder: 'MSW', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1320, purse: 20010, par: 78,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-07-10T10:00:00-04:00', postTime: '2026-07-11T13:30:00-04:00',
      stateBredRestricted: true, stateBredCode: 'NY',
      conditions: {
        sexes: ['F'], minAge: 2, maidenOnly: true, claimingPrice: null,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS, FILLIES TWO YEARS OLD. New York-bred Fund Purse.',
      },
    },
    {
      id: 'sar-jul11-r7', raceDayId: 'sar-jul11', meetId: 'sar-2026-summer', raceNumber: 7,
      classLadder: 'OptClm', surface: 'T', isTurf: true, mtoAllowed: false,
      distanceYards: 1320, purse: 21750, par: 90,
      fieldTarget: { min: 8, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-07-10T10:00:00-04:00', postTime: '2026-07-11T15:00:00-04:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: false, claimingPrice: 80000,
        nonWinners: null,
        text: 'ALLOWANCE OPTIONAL CLAIMING. Claiming Price $80,000. Inner turf.',
      },
    },

    // --- Lone Star Park, Thursday, April 16 (historical — the Bluebonnet Stakes) ---
    {
      id: 'ls-apr16-bluebonnet', raceDayId: 'ls-apr16', meetId: 'ls-2026-spring', raceNumber: 7,
      classLadder: 'Stk', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1430, purse: 75000, par: 92,
      fieldTarget: { min: 6, max: 8 }, alsoEligibleCap: 4, preferenceSystem: 'stars',
      entryClose: '2026-04-13T10:00:00-05:00', postTime: '2026-04-16T19:35:00-05:00',
      stateBredRestricted: true, stateBredCode: 'TX',
      conditions: {
        sexes: ['F', 'M'], minAge: 3, maidenOnly: false, claimingPrice: null,
        nonWinners: null,
        text: 'THE BLUEBONNET STAKES. For fillies and mares three years old and upward. Texas-bred.',
      },
    },

    // --- Delta Downs Quarter Horse races (distanceYards holds real YARDS, not furlong-equivalents) ---
    {
      id: 'ded-apr24-misspolly', raceDayId: 'ded-apr24', meetId: 'ded-2026-quarter', raceNumber: 1,
      classLadder: 'StkG3', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 400, purse: 50000, par: 90,
      fieldTarget: { min: 6, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'stars',
      entryClose: '2026-04-21T10:00:00-05:00', postTime: '2026-04-24T18:15:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: false, claimingPrice: null,
        nonWinners: null,
        text: 'THE MISS POLLY CLASSIC (G3). Open. 400 Yards.',
      },
    },
    {
      id: 'ded-may16-oldsouthfuturity', raceDayId: 'ded-may16', meetId: 'ded-2026-quarter', raceNumber: 1,
      classLadder: 'Fut', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 330, purse: 151650, par: 88,
      fieldTarget: { min: 6, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'stars',
      entryClose: '2026-05-13T10:00:00-05:00', postTime: '2026-05-16T18:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 2, maidenOnly: false, claimingPrice: null,
        nonWinners: null,
        text: 'THE OLD SOUTH FUTURITY. Texas-bred eligible. 330 Yards.',
      },
    },
    {
      id: 'ded-may16-oldsouthderby', raceDayId: 'ded-may16', meetId: 'ded-2026-quarter', raceNumber: 2,
      classLadder: 'Der', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 400, purse: 50000, par: 88,
      fieldTarget: { min: 6, max: 10 }, alsoEligibleCap: 4, preferenceSystem: 'stars',
      entryClose: '2026-05-13T10:00:00-05:00', postTime: '2026-05-16T18:30:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: false, claimingPrice: null,
        nonWinners: null,
        text: 'THE OLD SOUTH DERBY. 400 Yards.',
      },
    },
    {
      id: 'ded-jul11-labredoaks', raceDayId: 'ded-jul11', meetId: 'ded-2026-quarter', raceNumber: 1,
      classLadder: 'RG1', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 400, purse: 50000, par: 89,
      fieldTarget: { min: 6, max: 8 }, alsoEligibleCap: 4, preferenceSystem: 'stars',
      entryClose: '2026-07-11T15:00:00-05:00', postTime: '2026-07-11T18:15:00-05:00',
      stateBredRestricted: true, stateBredCode: 'LA',
      conditions: {
        sexes: ['F', 'M'], minAge: 3, maidenOnly: false, claimingPrice: null,
        nonWinners: null,
        text: 'DELTA DOWNS LOUISIANA BRED OAKS. Fillies and mares, Louisiana-bred. 400 Yards.',
      },
    },

    // --- Ellis Park, Monday, July 6 (historical — Molly McIver's postponed maiden) ---
    {
      id: 'elp-jul06-r4', raceDayId: 'elp-jul06', meetId: 'elp-2026-summer', raceNumber: 4,
      classLadder: 'MSW', surface: 'D', isTurf: false, mtoAllowed: false,
      distanceYards: 1210, purse: 100000, par: 82,
      fieldTarget: { min: 8, max: 12 }, alsoEligibleCap: 4, preferenceSystem: 'date',
      entryClose: '2026-07-03T10:00:00-05:00', postTime: '2026-07-06T15:00:00-05:00',
      stateBredRestricted: false, stateBredCode: null,
      conditions: {
        sexes: ['F'], minAge: 2, maidenOnly: true, claimingPrice: null,
        nonWinners: { kind: 'maiden' },
        text: 'FOR MAIDENS. Fillies, two years old. Five and One Half Furlongs.',
      },
    },
  ];

  // ---- Stables (Trainer barns) ---------------------------------------------
  // `snellgrove` is the demo user's barn (dashboard persona: "Jack Snellgrove").
  const stables = [
    { id: 'snellgrove', name: 'Snellgrove Racing', trainer: 'Jack Snellgrove', homeTrack: 'CD',  trainerPct: 0.20 },
    { id: 'murphy',     name: 'Murphy Racing',     trainer: 'Murphy C.',       homeTrack: 'CD',  trainerPct: 0.11 },
    { id: 'cox',        name: 'Cox Thoroughbreds', trainer: 'Cox B.',          homeTrack: 'CD',  trainerPct: 0.19 },
    { id: 'mott',       name: 'Mott Stable',       trainer: 'Mott W.',         homeTrack: 'KEE', trainerPct: 0.14 },
    { id: 'stewart',    name: 'Stewart Racing',    trainer: 'Stewart D.',      homeTrack: 'ELP', trainerPct: 0.13 },
    { id: 'asmussen',   name: 'Asmussen Stable',   trainer: 'Asmussen S.',     homeTrack: 'OP',  trainerPct: 0.20 },
    { id: 'lobo',       name: 'Lobo Stable',       trainer: 'Lobo P.',         homeTrack: 'FG',  trainerPct: 0.16 },
    { id: 'walden',     name: 'Walden Racing',     trainer: 'Walden W.',       homeTrack: 'CD',  trainerPct: 0.22 },
    { id: 'hartman',    name: 'Hartman Racing',    trainer: 'Hartman J.',      homeTrack: 'TP',  trainerPct: 0.15 },
    // Kinnon LaRose — real trainer + new demo persona; see docs/research-delta-downs-larose-2026-07-09.md
    // trainer/homeTrack real; trainerPct 0.26 ≈ his real ~26-28% strike rate (Oaklawn barn-notes); other fields are demo convention.
    { id: 'larose', name: 'Kinnon LaRose', trainer: 'Kinnon LaRose', homeTrack: 'CD', trainerPct: 0.26, isDemoUser: true },
    // Real Delta Downs Quarter Horse trainers (research doc, Delta Downs section)
    { id: 'ponce',      name: 'Josue Ponce Racing',        trainer: 'Josue Ponce',        homeTrack: 'DED', trainerPct: 0.24 },
    { id: 'jgarcia',    name: 'Jose A. Garcia Stable',     trainer: 'Jose A. Garcia',     homeTrack: 'DED', trainerPct: 0.18 },
    { id: 'oviedo',     name: 'Victor Oviedo Racing',      trainer: 'Victor Oviedo',      homeTrack: 'DED', trainerPct: 0.15 },
    { id: 'villaseca',  name: 'Santiago Villaseca Racing', trainer: 'Santiago Villaseca', homeTrack: 'DED', trainerPct: 0.16 },
    { id: 'ulopez',     name: 'Jose U. Lopez Stable',      trainer: 'Jose U. Lopez',      homeTrack: 'DED', trainerPct: 0.17 },
    // Real Lone Star Park rival stables from the Bluebonnet Stakes chart (research doc, Lone Star section)
    { id: 'wcalhoun',   name: 'W. Bret Calhoun Racing',    trainer: 'W. Bret Calhoun',    homeTrack: 'LS',  trainerPct: 0.19 },
    { id: 'dpish',      name: 'Danny Pish Racing',         trainer: 'Danny Pish',         homeTrack: 'LS',  trainerPct: 0.14 },
    // Real Ellis Park race winner's trainer (research doc, Ellis Park section)
    { id: 'bcox',       name: 'Brad Cox Racing',           trainer: 'Brad Cox',           homeTrack: 'CD',  trainerPct: 0.28 },
  ];

  // ---- Veterinarians (roster available when registering a new horse) ------
  // Illustrative demo roster — plausible names/credentials, NOT real people.
  const vets = [
    { id: 'vet-hollis',   name: 'Dr. Renee Hollis, DVM',   clinic: 'Bluegrass Equine Clinic',      credential: 'AAEP Certified' },
    { id: 'vet-park',     name: 'Dr. Marcus Park, DVM',     clinic: 'Twin Spires Veterinary Group',  credential: 'AAEP Certified' },
    { id: 'vet-alvarado', name: 'Dr. Sofia Alvarado, DVM',  clinic: 'Riverside Equine Sports Medicine', credential: 'Board Certified Surgeon' },
    { id: 'vet-nguyen',   name: 'Dr. Kevin Nguyen, DVM',    clinic: 'Delta Equine Services',          credential: 'AAEP Certified' },
    { id: 'vet-obrien',   name: "Dr. Aisling O'Brien, DVM", clinic: 'Saratoga Equine Hospital',       credential: 'AAEP Certified' },
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

    // ===== Kinnon LaRose — 5 real horses; see docs/research-delta-downs-larose-2026-07-09.md =====
    // REAL per horse: name, sex, age, entered race/track/date, jockey, ML (in research doc). Real results for Modo/Molly.
    // ILLUSTRATIVE engine input: classR, lastSpeed, sweet, surf, home, shipMi, trainerPct, preference, par-adjacent figs.
    // shipMi is 0 for all new horses (a stored home-baseline hint, not relevant to these pre-/post-entry seeds).
    // Midnight Still — real 2yo colt, Saratoga R1 Jul 11 (Flavien Prat, ML 6/5); unraced going in.
    { id: 'midnight-still', name: 'Midnight Still', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'C', age: 2, maiden: true, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 122, lastSpeed: 0, daysSince: 0, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 0, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: null,
      preference: { date: null, stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['first-time-starter'] },
    // Hormesis — real 2yo filly, Saratoga R2 Jul 11 (Manuel Franco, ML 8/1); longer price, honest maiden.
    { id: 'hormesis', name: 'Hormesis', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'F', age: 2, maiden: true, under50k: false, surf: ['D'], sweet: [1320, 1430], classR: 108, lastSpeed: 0, daysSince: 0, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 0, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: null,
      preference: { date: null, stars: 2 }, vetList: { listed: false }, medication: { lasix: true, firstTimeLasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['first-time-starter'] },
    // Gewurztraminer — real 5yo gelding, Saratoga R7 Jul 11 inner-turf allowance/$80k (Jose L. Ortiz); record illustrative.
    { id: 'gewurztraminer', name: 'Gewurztraminer', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'G', age: 5, maiden: false, under50k: false, surf: ['T'], sweet: [1760, 1980], classR: 106, lastSpeed: 88, daysSince: 22, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 18, careerWins: 3, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-05-10' }, lastStartDate: '2026-05-10',
      preference: { date: '2026-05-10', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Modo — REAL: won $75k Bluebonnet Stakes at Lone Star Park 2026-04-16, 6½f dirt, wire-to-wire, 1:16.31,
    // jockey Lane Luzzi, by Liam's Map out of Academy Road, TX-bred, owner Dr. Joel Politi (no owner field in schema).
    // home 'CD' = her current LaRose barn; she shipped IN to Lone Star for this one start. Figures illustrative-but-grounded.
    // daysSince recomputed against the real-time clock (was 46, calibrated to a since-retired fixed demo date).
    { id: 'modo', name: 'Modo', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'F', age: 5, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 128, lastSpeed: 97, daysSince: 84, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 12, careerWins: 6, winsOtherThanMdnClmStarter: 5, lastWinDate: '2026-04-16' }, lastStartDate: '2026-04-16',
      preference: { date: '2026-04-16', stars: 5 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: 'TX', flags: ['stakes-quality'] },
    // Molly McIver — REAL: Ellis Park R4 MSW (2yo fillies, 5½f), jockey Brian Hernandez Jr., card postponed Jul 2→Jul 6,
    // finished 8th of 12; by Charlatan. daysSince recomputed against the real-time clock (was clamped to 0 when the
    // demo clock was a fixed 2026-06-01 date that predated this real result).
    { id: 'molly-mciver', name: 'Molly McIver', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'F', age: 2, maiden: true, under50k: false, surf: ['D'], sweet: [1210, 1430], classR: 104, lastSpeed: 68, daysSince: 3, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 2, careerWins: 0, winsOtherThanMdnClmStarter: 0, lastWinDate: null }, lastStartDate: '2026-07-06',
      preference: { date: '2026-07-06', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },

    // ===== Kinnon LaRose — 10 more real horses, pulled via Horse Racing Nation /
    // Oaklawn barn notes / BloodHorse race charts (Equibase itself blocks
    // automated access — HTTP 403 via Incapsula bot protection on both its
    // horse-profile and condition-book pages). REAL per horse: name, sex, age,
    // sire/dam where sourced, race/date/track, result. Where sex/age weren't in
    // any sourced article, a plausible value is used and flagged illustrative.
    // classR/lastSpeed/sweet/surf/record counts are illustrative engine input,
    // same convention as the rest of the seed — grounded in the real result
    // (e.g. a win gets stronger figures than a 7th-of-8) but not sourced stats.
    // Glen Airy — REAL: 6yo chestnut gelding, sire Sky Mesa, dam My Favorite Tune, owner Maggi Moss.
    // 3rd, Oaklawn R1 ($70k claiming, 4yo+), 2026-04-26, jockey Rafael Bejarano, went off 11/4 co-favorite.
    { id: 'glen-airy', name: 'Glen Airy', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'G', age: 6, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 106, lastSpeed: 81, daysSince: 74, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 22, careerWins: 3, winsOtherThanMdnClmStarter: 3, lastWinDate: '2026-02-01' }, lastStartDate: '2026-04-26',
      preference: { date: '2026-04-26', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Eye Dee Kay — REAL: 7yo chestnut gelding, sire Overanalyze, dam Crab Key (by Candy Ride).
    // WON, Keeneland R3, 2026-04-11, jockey Irad Ortiz Jr.
    { id: 'eye-dee-kay', name: 'Eye Dee Kay', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'G', age: 7, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1430], classR: 112, lastSpeed: 88, daysSince: 89, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 27, careerWins: 5, winsOtherThanMdnClmStarter: 5, lastWinDate: '2026-04-11' }, lastStartDate: '2026-04-11',
      preference: { date: '2026-04-11', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Arthur Jr. — REAL: 4yo bay/brown gelding, sire Authentic, dam Parade Of Roses, owner L F Geaux Racing.
    // WON by ½L, Keeneland R4 (1 1/16 mi), 2026-04-10, jockey Jose Ortiz, 1:45.56 — LaRose's first win as head trainer.
    { id: 'arthur-jr', name: 'Arthur Jr.', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'G', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1760, 1870], classR: 116, lastSpeed: 90, daysSince: 90, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 9, careerWins: 2, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-04-10' }, lastStartDate: '2026-04-10',
      preference: { date: '2026-04-10', stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Carbone — REAL: 5yo gelding by Mitole, claimed $50k by 8:38 Racing off a Feb 5 win.
    // WON $126,000 allowance optional claiming sprint, Oaklawn R10, 2026-05-01, jockey Rafael Bejarano ($6.60) —
    // LaRose's most lucrative win as head trainer to date.
    { id: 'carbone', name: 'Carbone', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'G', age: 5, maiden: false, under50k: false, surf: ['D'], sweet: [1210, 1320], classR: 124, lastSpeed: 96, daysSince: 69, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 15, careerWins: 4, winsOtherThanMdnClmStarter: 4, lastWinDate: '2026-05-01' }, lastStartDate: '2026-05-01',
      preference: { date: '2026-05-01', stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['stakes-quality'] },
    // Batter Up — REAL: WON, Oaklawn R1, 2026-05-01, jockey Rafael Bejarano, favored ($6).
    // Sex/age not in any sourced article — illustrative placeholder (gelding, age 4), flagged.
    { id: 'batter-up', name: 'Batter Up', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'G', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1430], classR: 110, lastSpeed: 84, daysSince: 69, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 7, careerWins: 2, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-05-01' }, lastStartDate: '2026-05-01',
      preference: { date: '2026-05-01', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Oscar's Hope — REAL: bay colt, sire Twirling Candy, dam Hopeful Princess (by Not This Time),
    // owner Michael McLoughlin, bred by Stonestreet. 2nd (head), $400,000 Lafayette S. (Listed), Keeneland,
    // 2026-04-03, jockey Irad Ortiz Jr., earned $78,000. Age not stated — 3yo is the standard field for this stakes, flagged.
    { id: 'oscars-hope', name: "Oscar's Hope", stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'C', age: 3, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 130, lastSpeed: 95, daysSince: 97, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 5, careerWins: 2, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-02-14' }, lastStartDate: '2026-04-03',
      preference: { date: '2026-04-03', stars: 5 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['stakes-quality'] },
    // Standoutsensation — REAL: mare, sire Take Charge Indy, prior wins include the Pippin S. and Turnback the Alarm S.
    // 3rd, $200,000 Dig a Diamond S., Oaklawn, 2026-04-25, jockey Rafael Bejarano. Exact age not stated — mare implies 4+, flagged.
    { id: 'standoutsensation', name: 'Standoutsensation', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'M', age: 5, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1430], classR: 120, lastSpeed: 92, daysSince: 75, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 14, careerWins: 3, winsOtherThanMdnClmStarter: 3, lastWinDate: '2026-01-17' }, lastStartDate: '2026-04-25',
      preference: { date: '2026-04-25', stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['stakes-quality'] },
    // Authentic Gallop — REAL: 4yo gelding, sire Authentic, dam Galloping Ami. 7th of 8, $100,000 Evangeline Mile S.,
    // Evangeline Downs, 2026-04-04, jockey Kevin Roman — an off day, figures reflect the below-par finish.
    { id: 'authentic-gallop', name: 'Authentic Gallop', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'G', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 108, lastSpeed: 75, daysSince: 96, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 11, careerWins: 2, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-02-20' }, lastStartDate: '2026-04-04',
      preference: { date: '2026-04-04', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Hello Angel — REAL: WON, Oaklawn R3, 2026-04-16, jockey Ramon Vazquez, favored ($6.20) — LaRose's first Oaklawn win.
    // Sex/age not in any sourced article — illustrative placeholder (filly, age 4), flagged.
    { id: 'hello-angel', name: 'Hello Angel', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'F', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1430], classR: 114, lastSpeed: 88, daysSince: 84, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 6, careerWins: 2, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-04-16' }, lastStartDate: '2026-04-16',
      preference: { date: '2026-04-16', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // My Noble Knight — REAL: Oaklawn R2 ($50k starter allowance, 1 1/8 mi), 2026-04-02, finished 4th —
    // LaRose's first career starter as head trainer (the horse itself had raced before, under Amoss).
    // Sex/age not in any sourced article — illustrative placeholder (gelding, age 5), flagged.
    { id: 'my-noble-knight', name: 'My Noble Knight', stableId: 'larose', stable: 'Kinnon LaRose', trainer: 'Kinnon LaRose', sex: 'G', age: 5, maiden: false, under50k: false, surf: ['D'], sweet: [1760, 1980], classR: 100, lastSpeed: 78, daysSince: 98, home: 'CD', shipMi: 0, trainerPct: 0.26,
      record: { starts: 8, careerWins: 1, winsOtherThanMdnClmStarter: 1, lastWinDate: '2025-09-12' }, lastStartDate: '2026-04-02',
      preference: { date: '2026-04-02', stars: 2 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },

    // ===== Delta Downs Quarter Horse roster — real horses; see docs/research-delta-downs-larose-2026-07-09.md =====
    // sweet[] holds real YARDS (330/400-centered tight ranges — QH sprinters). classR/preference illustrative;
    // several lastSpeed values are the horse's REAL Speed Index used directly (noted per horse). Ages flagged where derived.
    // Dropping Dimes — real: won Miss Polly Classic (G3), 400y, 19.910, SI 95. Age 4 illustrative (3yo+ G3 winner). lastSpeed = real SI 95.
    { id: 'dropping-dimes', name: 'Dropping Dimes', stableId: 'ponce', stable: 'Josue Ponce Racing', trainer: 'Josue Ponce', sex: 'G', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [330, 440], classR: 124, lastSpeed: 95, daysSince: 38, home: 'DED', shipMi: 0, trainerPct: 0.24,
      record: { starts: 9, careerWins: 4, winsOtherThanMdnClmStarter: 4, lastWinDate: '2026-04-24' }, lastStartDate: '2026-04-24',
      preference: { date: '2026-04-24', stars: 5 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['stakes-quality'] },
    // Chilley — real: colt, Chilitos–Zoom in On Me, won Old South Derby 2026-05-16.
    { id: 'chilley', name: 'Chilley', stableId: 'ponce', stable: 'Josue Ponce Racing', trainer: 'Josue Ponce', sex: 'C', age: 3, maiden: false, under50k: false, surf: ['D'], sweet: [300, 440], classR: 120, lastSpeed: 92, daysSince: 16, home: 'DED', shipMi: 0, trainerPct: 0.24,
      record: { starts: 6, careerWins: 2, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-05-16' }, lastStartDate: '2026-05-16',
      preference: { date: '2026-05-16', stars: 4 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Marcy Train B — real: filly, Freighttrain B–Jessbye Marcy, ML favorite in LA Bred Oaks trials, qualified for Jul 11 final.
    // lastStartDate 2026-06-13 (trials) is AFTER the demo clock — daysSince clamped to 0 (not computed literally).
    { id: 'marcy-train-b', name: 'Marcy Train B', stableId: 'ponce', stable: 'Josue Ponce Racing', trainer: 'Josue Ponce', sex: 'F', age: 3, maiden: false, under50k: false, surf: ['D'], sweet: [330, 440], classR: 126, lastSpeed: 96, daysSince: 0, home: 'DED', shipMi: 0, trainerPct: 0.24,
      record: { starts: 11, careerWins: 3, winsOtherThanMdnClmStarter: 3, lastWinDate: '2026-05-30' }, lastStartDate: '2026-06-13',
      preference: { date: '2026-06-13', stars: 5 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['stakes-quality'] },
    // MC Blue Cartel — real (medium confidence): filly, Carters Cartel–Mc Bluecorona, reported Lassie Futurity winner 2026-05-22.
    { id: 'mc-blue-cartel', name: 'MC Blue Cartel', stableId: 'ponce', stable: 'Josue Ponce Racing', trainer: 'Josue Ponce', sex: 'F', age: 2, maiden: false, under50k: false, surf: ['D'], sweet: [330, 440], classR: 118, lastSpeed: 93, daysSince: 10, home: 'DED', shipMi: 0, trainerPct: 0.24,
      record: { starts: 4, careerWins: 1, winsOtherThanMdnClmStarter: 1, lastWinDate: '2026-05-22' }, lastStartDate: '2026-05-22',
      preference: { date: '2026-05-22', stars: 3 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Mucho Man Lady — real: TX-bred filly, Kj Mucho Macho Man–Cosmo Traffic, won $151,650 Old South Futurity, 330y, 16.806, SI 93. lastSpeed = real SI 93.
    { id: 'mucho-man-lady', name: 'Mucho Man Lady', stableId: 'jgarcia', stable: 'Jose A. Garcia Stable', trainer: 'Jose A. Garcia', sex: 'F', age: 2, maiden: false, under50k: false, surf: ['D'], sweet: [300, 400], classR: 121, lastSpeed: 93, daysSince: 16, home: 'DED', shipMi: 0, trainerPct: 0.18,
      record: { starts: 4, careerWins: 2, winsOtherThanMdnClmStarter: 2, lastWinDate: '2026-05-16' }, lastStartDate: '2026-05-16',
      preference: { date: '2026-05-16', stars: 4 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'off', changed: false }, stateBred: 'TX', flags: ['stakes-quality'] },
    // Sharpest Image — real: colt, Gold Heart Eagle V–Non Stop Patriot, 3rd Mardi Gras Futurity, ML fav Laddie trials 2026-04-28. Earlier win date illustrative.
    { id: 'sharpest-image', name: 'Sharpest Image', stableId: 'oviedo', stable: 'Victor Oviedo Racing', trainer: 'Victor Oviedo', sex: 'C', age: 2, maiden: false, under50k: false, surf: ['D'], sweet: [330, 440], classR: 117, lastSpeed: 90, daysSince: 34, home: 'DED', shipMi: 0, trainerPct: 0.15,
      record: { starts: 5, careerWins: 1, winsOtherThanMdnClmStarter: 1, lastWinDate: '2026-03-20' }, lastStartDate: '2026-04-28',
      preference: { date: '2026-04-28', stars: 3 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Mamma Im Leaving You — real: filly, Coronas Leaving You–Mamma Jamma Jamma, won Mardi Gras Oaks (G3), ML fav LA Bred Oaks trials, qualified for Jul 11 final.
    // lastStartDate 2026-06-13 (trials) is AFTER the demo clock — daysSince clamped to 0. Numbers make her the slight favorite over Marcy Train B.
    { id: 'mamma-im-leaving-you', name: 'Mamma Im Leaving You', stableId: 'ulopez', stable: 'Jose U. Lopez Stable', trainer: 'Jose U. Lopez', sex: 'F', age: 3, maiden: false, under50k: false, surf: ['D'], sweet: [330, 440], classR: 127, lastSpeed: 97, daysSince: 0, home: 'DED', shipMi: 0, trainerPct: 0.17,
      record: { starts: 11, careerWins: 5, winsOtherThanMdnClmStarter: 5, lastWinDate: '2026-04-10' }, lastStartDate: '2026-06-13',
      preference: { date: '2026-06-13', stars: 5 }, vetList: { listed: false }, medication: { lasix: false }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['stakes-quality'] },

    // ===== Bluebonnet Stakes rivals (real, from the chart) — Modo's actual race field =====
    // Too Much Kiki — real: trainer W. Bret Calhoun, finished 2nd. Record/figures illustrative (below Modo's).
    { id: 'too-much-kiki', name: 'Too Much Kiki', stableId: 'wcalhoun', stable: 'W. Bret Calhoun Racing', trainer: 'W. Bret Calhoun', sex: 'F', age: 4, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 122, lastSpeed: 93, daysSince: 46, home: 'LS', shipMi: 0, trainerPct: 0.19,
      record: { starts: 14, careerWins: 3, winsOtherThanMdnClmStarter: 3, lastWinDate: '2026-03-01' }, lastStartDate: '2026-04-16',
      preference: { date: '2026-04-16', stars: 4 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },
    // Naval Woman — real: trainer Danny Pish, finished 3rd. Record/figures illustrative.
    { id: 'naval-woman', name: 'Naval Woman', stableId: 'dpish', stable: 'Danny Pish Racing', trainer: 'Danny Pish', sex: 'F', age: 5, maiden: false, under50k: false, surf: ['D'], sweet: [1320, 1540], classR: 119, lastSpeed: 90, daysSince: 46, home: 'LS', shipMi: 0, trainerPct: 0.14,
      record: { starts: 19, careerWins: 4, winsOtherThanMdnClmStarter: 4, lastWinDate: '2026-02-14' }, lastStartDate: '2026-04-16',
      preference: { date: '2026-04-16', stars: 3 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: [] },

    // ===== Ellis Park race winner (real) — Molly McIver's field =====
    // Scarlett Begonia — REAL: trainer Brad Cox, WON the race (1:04.94, margin 3¾L), later named a TDN "Rising Star".
    // lastStartDate 2026-07-06 is AFTER the demo clock — daysSince clamped to 0. Figures read as a clear top-tier prospect.
    { id: 'scarlett-begonia', name: 'Scarlett Begonia', stableId: 'bcox', stable: 'Brad Cox Racing', trainer: 'Brad Cox', sex: 'F', age: 2, maiden: false, under50k: false, surf: ['D'], sweet: [1210, 1430], classR: 132, lastSpeed: 99, daysSince: 0, home: 'CD', shipMi: 0, trainerPct: 0.28,
      record: { starts: 1, careerWins: 1, winsOtherThanMdnClmStarter: 1, lastWinDate: '2026-07-06' }, lastStartDate: '2026-07-06',
      preference: { date: '2026-07-06', stars: 5 }, vetList: { listed: false }, medication: { lasix: true }, equipment: { blinkers: 'off', changed: false }, stateBred: null, flags: ['stakes-quality'] },
  ];

  // Registry: Jockey Club (Thoroughbred) for everything except the real Delta
  // Downs Quarter Horse roster (home: 'DED'), which races under AQHA.
  horses.forEach((h) => { h.registry = h.home === 'DED' ? 'AQHA' : 'Jockey Club'; });

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
    // Real LaRose-demo race entries — see docs/research-delta-downs-larose-2026-07-09.md
    'sar-jul11-r1': ['midnight-still'],
    'sar-jul11-r2': ['hormesis'],
    'sar-jul11-r7': ['gewurztraminer'],
    'ls-apr16-bluebonnet': ['modo', 'too-much-kiki', 'naval-woman'],
    'ded-apr24-misspolly': ['dropping-dimes'],
    'ded-may16-oldsouthfuturity': ['mucho-man-lady'],
    'ded-may16-oldsouthderby': ['chilley'],
    'ded-jul11-labredoaks': ['marcy-train-b', 'mamma-im-leaving-you'],
    'elp-jul06-r4': ['molly-mciver', 'scarlett-begonia'],
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
  const vetById = byId(vets);
  const programById = byId(supplementPrograms);
  const stallBarnById = byId(stallBarns);
  const stallApplicationById = byId(stallApplications);

  const meetOfRace = (r) => (r.meetId || (raceDayById[r.raceDayId] || {}).meetId);

  // Discipline stamp (R3.1): each seeded race inherits its meet's discipline
  // ('TB' Thoroughbred / 'QH' Quarter Horse), so the engine's registry gate and
  // the yards-vs-furlongs display can read it directly off the race — additive,
  // never renames a field (tour.html's flat specs carry no `discipline`, so the
  // gate skips them silently). Defaults to 'TB' if a meet is somehow unresolved.
  races.forEach((r) => { const m = meetById[meetOfRace(r)]; r.discipline = (m && m.discipline) || 'TB'; });

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
    tracks, meets, raceDays, races, stables, vets, entries, shipMi,
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

    // veterinarians
    getVet(id) { return vetById[id] || null; },
    listVets() { return vets; },

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
    // Strict variant (R2.1): the meet's OWN ship-and-win program, or null —
    // NO cross-meet fallback. Both workspaces use this so a program-less meet
    // (Saratoga/Lone Star/Delta Downs) never shows another meet's phantom Ship
    // & Win. The loose shipProgram() above keeps its fallback untouched for the
    // tour.html back-compat contract (CLAUDE.md rule 2).
    shipProgramForMeet(meetId) {
      const m = meetById[meetId];
      const ids = (m && m.supplementProgramIds) || [];
      for (let i = 0; i < ids.length; i++) {
        const p = programById[ids[i]];
        if (p && p.type === 'shipAndWin') return p;
      }
      return null;
    },

    // entries
    seedEntries(raceId) { return entries.filter((e) => e.raceId === raceId); },
  };

  global.PPData = PPData;
})(window);
