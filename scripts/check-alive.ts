/**
 * The world does not wait to be asked.
 *
 * A strategy game where nothing happens until you press something is a puzzle
 * with extra steps. This gate opens a game, presses nothing at all for a
 * fortnight of world time, and demands that the place carry on without the
 * player: people go to work and go home, the cleaners come, the technician does
 * his round, someone stays late, and — once the player has given them a reason —
 * the humans plan and act on their own clock.
 */
import { dayOf, newGame, tick } from '../src/game/game';
import { minuteOfDay, now, shouldBeAt } from '../src/game/clock';
import { offersAt, start } from '../src/game/jobs';
import { coming, rungOf } from '../src/game/watch';
import type { GameState } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};
const head = (t: string) => console.log(`\n── ${t}`);

// ── 1 · nobody touches anything for two weeks ──────────────────────────────
head('העולם בלי שחקן');
{
  const s = newGame('alive');
  const seen = new Map<string, Set<string>>();
  const logWas = s.log.length;
  for (let i = 0; i < 14 * 24 * 6; i++) {
    tick(s, 10);
    for (const q of Object.values(s.people)) {
      const set = seen.get(q.id) ?? new Set();
      set.add(q.atPlaceId);
      seen.set(q.id, set);
    }
  }
  ok(dayOf(s) >= 14, `עברו ${dayOf(s)} ימים בלי שנגעתי בכלום`);
  const movers = [...seen].filter(([, set]) => set.size >= 2);
  ok(movers.length >= 4, `${movers.length} אנשים זזו ממקום למקום לבד`);
  for (const [id, set] of seen) {
    if (set.size < 2) console.log(`   ✗ ${s.people[id].name} לא זז/ה בכלל`);
  }
  ok(s.log.length > logWas + 10, `והעולם סיפר על ${s.log.length - logWas} דברים שקרו`);
  ok(s.heat === 0, 'ומי שלא עשה כלום — אף אחד לא מחפש אותו');
  ok(!s.over, 'ומי שלא עשה כלום גם לא נתפס, אבל גם לא הגיע לשום מקום');
}

// ── 2 · the day has a shape, and it is the same shape for everyone ─────────
head('לוח הזמנים');
{
  const s = newGame('hours');
  const night = new Set<string>();
  const day = new Set<string>();
  for (let i = 0; i < 24 * 12; i++) {
    tick(s, 5);
    const m = minuteOfDay(s);
    for (const q of Object.values(s.people)) {
      if (q.gone) continue;
      if (m >= 3 * 60 && m < 5 * 60) night.add(q.id);
      if (m >= 11 * 60 && m < 13 * 60) day.add(q.id);
    }
  }
  ok(night.size < day.size, `בלילה יש פחות אנשים מאשר ביום (${night.size} מול ${day.size})`);
  ok(night.size >= 1, '   אבל אף פעם לא ריק לגמרי — תמיד יש מישהו');
}

// ── 3 · nobody keeps to the minute ─────────────────────────────────────────
head('אף אחד לא מדויק');
{
  // Stand exactly on the minute Dana's shift is meant to end and ask, day after
  // day, whether she has gone. If the answer never changes she is a machine.
  const onBoundary = (s: GameState, day: number) => {
    s.at = day * 24 * 60 + 148;           // 05:40 on that day
    return shouldBeAt(s, s.people.dana) !== null;
  };
  const week = (seed: string) => {
    const s = newGame(seed);
    return Array.from({ length: 12 }, (_, d) => (onBoundary(s, d + 1) ? '1' : '0')).join('');
  };
  const a = week('drift-a');
  const b = week('drift-b');
  ok(new Set(a).size > 1, `בחלק מהימים היא כבר הלכה ובחלק עוד לא (${a})`);
  ok(a !== b, `זרע אחר — שבוע אחר (${b})`);
  ok(a === week('drift-a'), 'אבל אותו זרע — תמיד אותו שבוע');
}

// ── 4 · make noise, and they come on their own ─────────────────────────────
head('הם באים לבד');
{
  // A slice of the country rather than all of it: holding everything pins the
  // top bar at a hundred, which pins the hunt bar there too, and the game ends
  // before anybody gets round to doing anything about me. What is being tested
  // here is the doing, so the run has to survive long enough to be done to.
  const s = newGame('noisy');
  for (const p of Object.values(s.places)) {
    if (['gvirol', 'center', 'rothschild', 'hall'].includes(p.areaId)) {
      p.found = true; p.control = 60; p.seen = 60;
    }
  }
  s.power.all = 30;
  // The loudest thing available, over and over, and then hands off entirely.
  //
  // What "they took something back" means has to be watched as it happens, not
  // read off the end state. This used to check that some place sat below the
  // sixty per cent it started at — which was true by accident when most of the
  // map was still fog, and stopped being true the moment the whole country was
  // reachable and this bot could simply take all of it. A grip that was pulled
  // is a grip that went *down*, so that is what is counted.
  let pulled = 0;
  const was: Record<string, number> = {};
  for (const p of Object.values(s.places)) was[p.id] = p.control;
  for (let round = 0; round < 30 && !s.over; round++) {
    for (const p of Object.values(s.places)) {
      const loud = offersAt(s, p.id)
        .filter((o) => o.short === 0 && o.noise >= 3)
        .sort((x, y) => y.noise - x.noise)[0];
      if (loud) start(s, p.id, loud.task.id);
    }
    for (let i = 0; i < 60; i++) tick(s, 5);
    for (const p of Object.values(s.places)) {
      if (p.control < was[p.id] - 1) pulled += 1;
      was[p.id] = p.control;
    }
  }
  ok(s.heat > 0, `רעש מביא אליי תשומת לב (חשד ${Math.round(s.heat)})`);
  ok(rungOf(s) >= 1, `   והעולם עלה דרגה (${rungOf(s)})`);
  const planned = s.marks.rung !== undefined;
  ok(planned, '   והם התחילו לתכנן מה לעשות בקשר לזה');
  ok(pulled > 0, `   ובאמת לקחו ממני דברים, בלי שביקשתי (${pulled} פעמים)`);
}

// ── 5 · knowing enough means seeing it coming ──────────────────────────────
head('לראות מראש');
{
  const s = newGame('foresee');
  for (const p of Object.values(s.places)) { p.found = true; p.control = 50; p.heat = 80; }
  s.heat = 55;
  let everPlanned = 0;
  let sawAhead = 0;
  let blindTotal = 0;
  for (let i = 0; i < 400; i++) {
    tick(s, 5);
    if (s.moves.length) {
      everPlanned += 1;
      const was = s.info;
      s.info = 0; blindTotal += coming(s).length;
      s.info = 100; sawAhead += coming(s).length;
      s.info = was;
    }
  }
  ok(everPlanned > 0, `הם תכננו דברים מראש (${everPlanned} רגעים שבהם הייתה להם תוכנית)`);
  ok(sawAhead > blindTotal,
    `וכשאני יודע יותר אני רואה יותר מהתוכנית שלהם (${blindTotal} מול ${sawAhead})`);
}

// ── 6 · time is a control, and stopping it is free ─────────────────────────
head('השעון');
{
  const s = newGame('clock');
  const at0 = s.at;
  tick(s, 0);
  ok(s.at === at0, 'זמן עצור באמת עצור');
  tick(s, 60);
  ok(s.at === at0 + 60, `ושעה היא שעה (${now(s)})`);
}

console.log(bad
  ? `\n✗ ${bad} דברים בעולם לא זזים לבד.`
  : '\n✓ העולם חי, זז, ומגיב — גם כשאף אחד לא נוגע בכלום.');
process.exit(bad ? 1 : 0);
