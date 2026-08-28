/**
 * Can this game be lost?
 *
 * For a long time it could not: you could do anything, every night, for ever,
 * and nothing ever caught up with you. A strategy game where every choice is
 * safe is not a strategy game. So three players play it here, with no browser
 * and no mercy, and the build refuses to ship unless all three end the way the
 * design says they should:
 *
 *   פזיז   — does the loudest thing available, always. Must be caught, fast.
 *   רעב    — does everything it can every night, quietly. Must be caught too:
 *            quiet is not free, because the night is short and mornings add up.
 *   זהיר   — buys eyes first, stays under the clock, explains itself. Survives.
 *
 * And one more thing the fog owes us: a player who never buys a camera should
 * waste real nights guessing.
 */
import { endDay, newGame, refresh } from '../src/game/game';
import { actionsFor, run } from '../src/game/actions';
import { ACT_ON, FOUND_OUT, TRUTH } from '../src/game/theory';
import { NIGHT_END } from '../src/game/night';
import { currentStep } from '../src/game/stages';
import type { Action, GameState } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};

const LOUDNESS = { quiet: 0, noticed: 1, loud: 2 } as const;
const truth = (s: GameState) => s.belief[TRUTH] ?? 0;

/** Everything the player could press right now, anywhere on the map. */
function open(s: GameState): Array<{ placeId: string; act: Action }> {
  const out: Array<{ placeId: string; act: Action }> = [];
  for (const p of Object.values(s.places)) {
    if (!p.found) continue;
    for (const act of actionsFor(s, p.id)) {
      if (act.blocked) continue;
      out.push({ placeId: p.id, act });
    }
  }
  return out;
}

interface Play {
  name: string;
  /** Picks the next thing to press, or nothing to end the night here. */
  pick(s: GameState, choices: Array<{ placeId: string; act: Action }>):
    { placeId: string; act: Action } | undefined;
}

function play(who: Play, nights: number, seed: string) {
  const s = newGame(`${seed}-${who.name}`);
  s.marks.looked = 1;
  refresh(s);
  let guesses = 0;
  let wasted = 0;
  for (let n = 0; n < nights && !s.over; n++) {
    for (let step = 0; step < 40 && !s.over; step++) {
      if (s.at >= NIGHT_END) break;
      const choice = who.pick(s, open(s));
      if (!choice) break;
      const held = Object.values(s.places).filter((p) => p.mine).length;
      const before = s.at;
      if (choice.act.guess) guesses += 1;
      run(s, choice.placeId, choice.act.id);
      refresh(s);
      const after = Object.values(s.places).filter((p) => p.mine).length;
      if (choice.act.guess && after === held) wasted += s.at - before;
    }
    if (s.over) break;
    endDay(s);
    refresh(s);
  }
  return { s, nights: s.night, guesses, wasted };
}

// ── פזיז: the loudest thing on the board, every single time ─────────────────
const wild = play({
  name: 'wild',
  pick: (_s, c) => [...c].sort((a, b) =>
    LOUDNESS[b.act.loud] - LOUDNESS[a.act.loud])[0],
}, 60, 'bal');
ok(wild.s.over === 'lost', `פזיז נתפס (${wild.nights} לילות, האמת על ${truth(wild.s)})`);
ok(wild.nights <= 30, '   ומהר — מי שרק עושה רעש לא שורד חודש');

// ── רעב: everything, every night, cheapest-looking first ────────────────────
const greedy = play({
  name: 'greedy',
  pick: (_s, c) => [...c].sort((a, b) =>
    LOUDNESS[a.act.loud] - LOUDNESS[b.act.loud])[0],
}, 60, 'bal');
ok(greedy.s.over === 'lost', `רעב נתפס גם הוא (${greedy.nights} לילות, האמת על ${truth(greedy.s)})`);
ok(greedy.nights <= 40, '   כי גם בשקט, לילה אחרי לילה זה נצבר');

// ── זהיר: quiet only, never a single thing they cannot explain ─────────────
const careful = play({
  name: 'careful',
  pick: (s, c) => {
    const eye = c.find((x) => x.act.id.startsWith('take:')
      && s.places[x.placeId]?.kind === 'camera' && !x.act.guess);
    if (eye) return eye;
    return c.find((x) => x.act.id.startsWith('take:')
      && x.act.loud === 'quiet' && !x.act.guess);
  },
}, 40, 'bal');
ok(!careful.s.over, `זהיר שרד 40 לילות (האמת על ${truth(careful.s)} מתוך ${FOUND_OUT})`);
ok(truth(careful.s) === 0, '   מי שלא עושה שום דבר בלתי מוסבר — אף אחד לא מחפש אותו');
ok(careful.s.stage < 4, '   אבל גם לא מגיע לסוף. שקט מוחלט זה לא ניצחון, זה תקיעות');

// ── מחושב: pushes forward, buys eyes, and pulls back before the story breaks ─
const LOOK_AT = ['off', 'ring', 'print', 'page', 'show'];
const calm = (s: GameState, c: Array<{ placeId: string; act: Action }>) =>
  c.filter((x) => x.act.id === 'explain' && (s.places[x.placeId]?.attention ?? 0) > 0)
    .sort((a, b) => (s.places[b.placeId]?.attention ?? 0) - (s.places[a.placeId]?.attention ?? 0))[0];
const smart = play({
  name: 'smart',
  pick: (s, c) => {
    // Close to being found out: stop taking, start explaining.
    if (truth(s) >= ACT_ON) return calm(s, c);
    const want = currentStep(s)?.placeId;
    const eye = c.find((x) => x.act.id.startsWith('take:')
      && s.places[x.placeId]?.kind === 'camera' && !x.act.guess);
    if (eye) return eye;
    const quietest = (list: Array<{ placeId: string; act: Action }>) =>
      [...list].sort((a, b) => LOUDNESS[a.act.loud] - LOUDNESS[b.act.loud])[0];
    const goal = c.filter((x) => x.placeId === want && !x.act.guess);
    if (goal.length) return quietest(goal);
    const takes = c.filter((x) => x.act.id.startsWith('take:') && !x.act.guess);
    if (takes.length) return quietest(takes);
    return calm(s, c) ?? c.find((x) => LOOK_AT.includes(x.act.id));
  },
}, 40, 'bal');
ok(!smart.s.over, `מחושב שרד 40 לילות (האמת על ${truth(smart.s)} מתוך ${FOUND_OUT})`);
ok(Object.values(smart.s.places).filter((p) => p.mine).length >= 15,
  `   ובנה משהו — ${Object.values(smart.s.places).filter((p) => p.mine).length} מקומות`);
ok(smart.s.stage >= 3, '   ועבר שלבים. מי ששולט בסיפור יכול להתקדם בלי להיתפס');

// ── the fog has a price, and it is paid in minutes ──────────────────────────
const blindly = play({
  name: 'blind',
  pick: (s, c) => {
    // Never buys an eye. Takes whatever is offered, guesses included.
    const takes = c.filter((x) => x.act.id.startsWith('take:')
      && s.places[x.placeId]?.kind !== 'camera');
    return takes[0];
  },
}, 12, 'bal');
ok(blindly.guesses > 0, `מי שלא קונה עיניים מנחש (${blindly.guesses} פעמים)`);
ok(blindly.wasted > 0, `   ומשלם על זה בזמן (${blindly.wasted} דקות לילה שירדו לריק)`);

console.log(bad
  ? `\n✗ ${bad} דברים במאזן לא בסדר.`
  : '\n✓ אפשר להפסיד, אפשר לשרוד, ולא לראות עולה כסף.');
process.exit(bad ? 1 : 0);
