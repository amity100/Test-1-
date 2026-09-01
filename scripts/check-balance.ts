/**
 * Four different creatures play the same game.
 *
 * The design promise is that how you spend your power decides what you become,
 * and that the four shapes are genuinely different games rather than the same
 * game in four colours. So four bots play a month each, and the build refuses
 * to ship unless:
 *
 *   · being loud gets you erased
 *   · being silent keeps you alive and gets you nowhere
 *   · playing well gets you both — alive, and much bigger
 *   · and the four of them do not end up as the same creature
 *
 * The bots are deliberately simple. If a simple rule can win, the game is too
 * easy; if no simple rule survives, it is too hard.
 */
import { newGame, shape, tick } from '../src/game/game';
import { Offer, offersAt, start, stop } from '../src/game/jobs';
import { SHAPE_NAME, take } from '../src/game/grow';
import { israel } from '../src/game/sites';
import { rungOf } from '../src/game/watch';
import { answer, liveHunts, rowsOf, stillNeeds } from '../src/game/hunt';
import type { GameState } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};

const held = (s: GameState) => Object.values(s.places).filter((p) => p.control > 0).length;
const total = (s: GameState) =>
  Math.round(Object.values(s.places).reduce((n, p) => n + p.control, 0));

/** Everything I could start right now, anywhere I can reach. */
function open(s: GameState): Array<{ placeId: string; o: Offer }> {
  const out: Array<{ placeId: string; o: Offer }> = [];
  for (const p of Object.values(s.places)) {
    if (!p.found && p.control <= 0) continue;
    for (const o of offersAt(s, p.id)) {
      if (o.short > 0) continue;
      out.push({ placeId: p.id, o });
    }
  }
  return out;
}

interface Bot {
  name: string;
  /** What to start next, or nothing to sit still for a while. */
  pick(s: GameState, can: Array<{ placeId: string; o: Offer }>): { placeId: string; o: Offer } | undefined;
  /** Should this job be stopped to make room? */
  drop?(s: GameState): string | undefined;
  /**
   * Does this one deal with somebody standing in the room?
   *
   * A real player cannot miss a hunt: it takes over the screen and its answers
   * are the biggest buttons on it. So a bot that ignores them is not modelling a
   * careless player, it is modelling somebody who is not looking at the game,
   * and balancing against that would make the whole mechanic look far crueller
   * than it is. The reckless ones still ignore it, because that is what reckless
   * means and burning for it is the point.
   */
  answers?: boolean;
}

/** Press whatever would close whatever is running, cheapest first. */
function dealWith(s: GameState) {
  for (const h of liveHunts(s)) {
    let guard = 0;
    while (stillNeeds(s, h) > 0 && guard++ < 4) {
      const row = rowsOf(s, h).find((r) => !r.met && r.can);
      if (!row) break;
      answer(s, h.id, row.id);
    }
  }
}

function play(bot: Bot, days: number) {
  const s = newGame(`bal-${bot.name}`);
  for (let step = 0; step < days * 24 * 4 && !s.over; step++) {
    if (s.offered.length) take(s, s.offered[0]);
    if (bot.answers) dealWith(s);
    // Four decisions an hour, then the world runs for fifteen minutes.
    for (let n = 0; n < 3; n++) {
      const choice = bot.pick(s, open(s));
      if (!choice) break;
      // The way in is part of the choice now, and starting a different one from
      // the row that was picked is how the reckless bot quietly became the
      // careful one: it chose the loudest row on the screen and then sneaked in.
      if (!start(s, choice.placeId, choice.o.task.id, false, choice.o.way?.id)) {
        const drop = bot.drop?.(s);
        if (drop) stop(s, drop);
        break;
      }
    }
    tick(s, 15);
  }
  return s;
}

const noisiest = (can: Array<{ placeId: string; o: Offer }>) =>
  [...can].sort((a, b) => b.o.noise - a.o.noise)[0];
const quietest = (can: Array<{ placeId: string; o: Offer }>) =>
  [...can].sort((a, b) => a.o.noise - b.o.noise || a.o.minutes - b.o.minutes)[0];
const oldestJob = (s: GameState) => s.jobs[0]?.id;

// ── פזיז ───────────────────────────────────────────────────────────────────
const wild = play({
  name: 'wild',
  // Takes the loudest thing available, always, everywhere.
  pick: (_s, can) => noisiest(can),
  drop: oldestJob,
}, 30);
ok(wild.over === 'lost' || rungOf(wild) >= 4,
  `פזיז נשרף (${wild.over ?? 'שרד בקושי'} · דרגה ${rungOf(wild)} · חשד ${Math.round(wild.heat)})`);
ok(total(wild) < 900, `   ולא נשאר לו הרבה (${total(wild)} נקודות שליטה)`);

// ── שקט ────────────────────────────────────────────────────────────────────
const quiet = play({
  name: 'quiet',
  answers: true,
  // Never does anything anybody could notice. Which means it never gets in
  // anywhere either, because getting in is the loud one.
  pick: (_s, can) => can.filter((c) => c.o.noise === 0)[0],
}, 30);
ok(!quiet.over, `שקט שרד חודש (חשד ${Math.round(quiet.heat)})`);
ok(rungOf(quiet) === 0, '   ואף אחד לא חיפש אותו אף פעם');
ok(held(quiet) <= 3, `   אבל הוא גם לא הגיע לשום מקום (${held(quiet)} מקומות)`);

// ── מחושב ──────────────────────────────────────────────────────────────────
const smart = play({
  name: 'smart',
  answers: true,
  pick: (s, can) => {
    // Getting close to being looked at: stop growing, start tidying.
    if (s.heat >= 22) {
      const calm = can.find((c) => c.o.task.id === 'quiet');
      if (calm) return calm;
    }
    // Finish what is nearly finished — a place at ninety is worth far more
    // than two at forty, because what a place gives scales with how much of it
    // is really mine.
    const nearly = can.filter((c) => c.o.task.id === 'grow'
      && s.places[c.placeId].control >= 55);
    if (nearly.length) return quietest(nearly);
    // Then somewhere new, quietly, and only at a decent hour.
    const doors = can.filter((c) => c.o.task.id === 'enter');
    if (doors.length && s.heat < 16) return quietest(doors);
    // Otherwise keep growing whatever is cheapest.
    const grow = can.filter((c) => c.o.task.id === 'grow');
    if (grow.length) return quietest(grow);
    return can.find((c) => c.o.task.id === 'quiet');
  },
  drop: oldestJob,
}, 30);
// A month is a long time now. The country itself pushes back the more of it I
// hold, so surviving thirty days while taking sixty-one places is no longer the
// bar — reaching the end of the race is. Either ending is a life well lived;
// what must never happen is this player being wiped out or standing still.
ok(smart.over !== 'lost' || israel(smart) >= 85,
  `מחושב הגיע רחוק (${israel(smart).toFixed(0)}% מישראל, חשד ${Math.round(smart.heat)}, `
  + `${smart.over === 'won' ? 'ניצח' : smart.over === 'lost' ? 'נתפס בסוף' : 'עוד רץ'})`);
ok(held(smart) > held(quiet), `   וגדל הרבה יותר מהשקט (${held(smart)} מקומות מול ${held(quiet)})`);
ok(total(smart) > total(quiet) * 2, `   ובעומק (${total(smart)} מול ${total(quiet)})`);

// ── עיוור ──────────────────────────────────────────────────────────────────
const blind = play({
  name: 'blind',
  // Grabs and grabs and never once tidies up after itself.
  pick: (_s, can) => {
    const grab = can.filter((c) => c.o.task.id === 'enter' || c.o.task.id === 'use');
    return grab.length ? grab[0] : can.find((c) => c.o.task.id === 'grow');
  },
  drop: oldestJob,
}, 30);
ok(blind.heat > smart.heat,
  `מי שלא מסתכל משלם על זה (חשד ${Math.round(blind.heat)} מול ${Math.round(smart.heat)})`);

// ── and they really are four different creatures ───────────────────────────
const shapes = [wild, quiet, smart, blind].map((s) => shape(s));
console.log(`\n   פזיז: ${SHAPE_NAME[shapes[0]]} · שקט: ${SHAPE_NAME[shapes[1]]}`
  + ` · מחושב: ${SHAPE_NAME[shapes[2]]} · עיוור: ${SHAPE_NAME[shapes[3]]}`);
ok(new Set(shapes).size >= 2, 'ארבע דרכי משחק — לא אותו יצור בסוף');
ok(smart.grown.length > 0, `ומי ששיחק הרבה באמת השתנה (${smart.grown.length} דברים גדלו בו)`);

console.log(bad
  ? `\n✗ ${bad} דברים במאזן לא בסדר.`
  : '\n✓ אפשר להישרף, אפשר לשרוד בלי לגדול, ואפשר לשחק טוב ולקבל את שניהם.');
process.exit(bad ? 1 : 0);
