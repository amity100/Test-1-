/**
 * Is there more than one way to play, and does the game reward it?
 *
 * A strategy game whose best line is "press the same button until you win" is
 * not a strategy game, and for a long time this one was: taking a place meant
 * pressing spread five times, and the special button — the one thing that makes
 * a bank different from a radio mast — was a guaranteed loss that no good player
 * ever touched. Four hundred and eighty-seven presses to take Israel, none of
 * them a decision.
 *
 * So this plays the game five ways, with nothing but the rules, and asks what
 * the rules actually reward. It is the gate that made the two halves of the map
 * mean something: fast and dangerous on one side, slow and needed on the other.
 */
import { newGame, tick } from '../src/game/game';
import { offersAt, start } from '../src/game/jobs';
import { freshness } from '../src/game/catalogue';
import { SHAPE_NAME, lean, leanGives, onTable, take, type Shape } from '../src/game/grow';
import { israel } from '../src/game/sites';
import { noticed, wanted } from '../src/game/watch';
import { watchingSays } from '../src/game/hunter';
import { dayOf } from '../src/game/clock';
import { WAYS, howItWent } from '../src/game/ways';
import { GIFT } from '../src/game/sites';
import type { GameState, Place, PlaceKind } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};
const P = (n: number) => Math.round(n);

const open = (s: GameState) => Object.values(s.places)
  .filter((p) => p.found || p.seen > 0 || p.control > 0);
const mine = (s: GameState) => Object.values(s.places).filter((p) => p.control > 0);

/**
 * Do a thing, the given way.
 *
 * The way in is half of what a style *is* now — somebody who always sneaks and
 * somebody who always kicks the door in are playing two different games even
 * when they press the same buttons in the same order.
 */
function go(s: GameState, p: Place, id: string, way = 'quiet') {
  const o = offersAt(s, p.id).find((x) => x.task.id === id
    && (!x.task.byWay || x.way?.id === way));
  if (!o || o.short > 0) return false;
  return start(s, p.id, id, true, way);
}

interface Style {
  name: string;
  move(s: GameState): void;
  /** Which way this one leans when the game offers a choice. */
  leans?: Shape;
}

const STYLES: Style[] = [
  {
    // Take everything, and buy the bar back down when it gets frightening.
    name: 'זהיר',
    leans: 'spread',
    move(s) {
      if (s.heat > 55) {
        const best = [...mine(s)].sort((a, b) => b.control - a.control)[0];
        if (best && go(s, best, 'quiet')) return;
      }
      for (const p of mine(s).filter((q) => q.control < 100).sort((a, b) => b.control - a.control)) {
        if (go(s, p, 'grow')) return;
      }
      for (const p of open(s).filter((q) => q.control <= 0)) if (go(s, p, 'enter')) return;
    },
  },
  {
    // Everything forward, nothing back.
    name: 'פזיז',
    move(s) {
      for (const p of open(s).filter((q) => q.control <= 0)) if (go(s, p, 'enter', 'force')) return;
      for (const p of mine(s).filter((q) => q.control < 100)) if (go(s, p, 'grow', 'force')) return;
    },
  },
  {
    // Take places, make the country need you — each place's big thing once a
    // day, which is how often it is worth anything — and, crucially, *watch
    // what they are watching*. When somebody works out the shape of what I keep
    // doing, a player who is paying attention does something else for a while.
    // That is the whole counterplay to an opponent who learns, and a style that
    // ignores it is not playing the game the game is offering.
    name: 'מיטיב',
    leans: 'people',
    move(s) {
      // Everybody needs the brake now. Somebody is keeping count, and a night
      // spent doing the same good deed sixty times is still a night with a
      // shape somebody can see.
      if (s.heat > 55) {
        const best = [...mine(s)].sort((a, b) => b.control - a.control)[0];
        if (best && go(s, best, 'quiet')) return;
      }
      const GOOD: PlaceKind[] = ['water', 'roads', 'money', 'city', 'homes', 'transport'];
      const watched = new Set(s.hunters.map((h) => h.onLook).filter(Boolean));
      const hunted = new Set(s.hunters.map((h) => h.onKind).filter(Boolean));
      for (const p of mine(s).filter((q) => q.control >= 100
        && GOOD.includes(q.kind) && freshness(s, q) >= 1
        && !watched.has(GIFT[q.kind].useLook) && !hunted.has(q.kind))) {
        if (go(s, p, 'use')) return;
      }
      // And the way in follows the same rule — the quietest one whose face
      // nobody is currently checking. Getting in the same way sixty-five times
      // is exactly the habit she is built to notice.
      const FACE: Record<string, string> = { quiet: 'outside', person: 'person', force: 'wrong' };
      const way = ['quiet', 'person', 'force'].find((w) => !watched.has(FACE[w] as never)) ?? 'quiet';
      for (const p of mine(s).filter((q) => q.control < 100).sort((a, b) => b.control - a.control)) {
        if (go(s, p, 'grow', way)) return;
      }
      for (const p of open(s).filter((q) => q.control <= 0)) if (go(s, p, 'enter', way)) return;
    },
  },
  {
    // The button-masher: press the big one wherever it will go.
    name: 'לוחץ בלי לחשוב',
    move(s) {
      for (const p of mine(s).filter((q) => q.control >= 45)) if (go(s, p, 'use')) return;
      for (const p of mine(s).filter((q) => q.control < 100)) if (go(s, p, 'grow', 'force')) return;
      for (const p of open(s).filter((q) => q.control <= 0)) if (go(s, p, 'enter', 'force')) return;
    },
  },
  {
    // One place, and silence.
    name: 'מסתתר',
    move(s) {
      const best = [...mine(s)].sort((a, b) => b.control - a.control)[0];
      if (best && best.control < 100) { go(s, best, 'grow'); return; }
      if (best) go(s, best, 'quiet');
    },
  },
];

interface Run {
  over: string | null; day: number; israel: number; peak: number;
  places: number; presses: number; uses: number;
  /**
   * The average height of the hunt bar across the whole run, and how often the
   * brake had to be pulled.
   *
   * The peak turned out to be the wrong thing to compare two styles by: every
   * style that survives brakes at the same line, so every style that survives
   * peaks at the same number. What actually differs is how much of the night
   * was spent up there, and how often you had to stop what you were doing to
   * come back down. That is what "calmer" means to somebody playing it.
   */
  mean: number; brakes: number;
  /** How hard the country was actually looking by the end. */
  wanted: number;
}
const out = new Map<string, Run>();

for (const style of STYLES) {
  const s = newGame('ways-1');
  let peak = 0;
  let uses = 0;
  let brakes = 0;
  let sum = 0;
  let ticks = 0;
  const seen = new Set<string>();
  for (let day = 0; day < 60 && !s.over; day++) {
    for (let i = 0; i < 24 * 6; i++) {
      tick(s, 10);
      if (s.over) break;
      // The game asks a question when something in me grows, and a bot that
      // never answers it never grows at all — which is not a style, it is a
      // player who has walked away from the screen.
      if (s.offered.length) take(s, style.leans
        ? (onTable(s).find((g) => g.shape === style.leans)?.id ?? s.offered[0])
        : s.offered[0]);
      if (i % 3 === 0) style.move(s);
      peak = Math.max(peak, s.heat);
      sum += s.heat;
      ticks += 1;
      for (const j of s.jobs) {
        if (seen.has(j.id)) continue;
        seen.add(j.id);
        if (j.taskId === 'use') uses += 1;
        if (j.taskId === 'quiet') brakes += 1;
      }
    }
  }
  out.set(style.name, {
    over: s.over ?? null, day: dayOf(s), israel: P(israel(s)), peak: P(peak),
    places: mine(s).length, presses: seen.size, uses,
    mean: P(sum / Math.max(1, ticks)), brakes, wanted: wanted(s),
  });
  const r = out.get(style.name)!;
  console.log(`\n── ${style.name}: ${r.over ?? 'לא נגמר'} · יום ${r.day} · `
    + `ישראל ${r.israel}% · מצוד ממוצע ${r.mean} (שיא ${r.peak}) · ${r.places}/65 מקומות · `
    + `${r.presses} לחיצות (${r.uses} על הכפתור המיוחד, ${r.brakes} מחיקות עקבות) · `
    + `מחפשים אותי פי ${wanted(s).toFixed(2)}`);
}

console.log('');
const careful = out.get('זהיר')!;
const kind = out.get('מיטיב')!;
const rash = out.get('פזיז')!;
const masher = out.get('לוחץ בלי לחשוב')!;
const hider = out.get('מסתתר')!;

ok(careful.over === 'won', `מי שמתפשט ובולם בזמן מנצח (יום ${careful.day})`);
ok(kind.over === 'won', `וגם מי שגורם לארץ להיות תלויה בו מנצח (יום ${kind.day})`);
// Two ways of winning that come out identical are one way of winning with two
// names — but the thing that has to differ is not the peak and not the average.
// Everybody who survives brakes at the same line, so everybody who survives
// peaks and averages at the same number; measuring those compares the brake to
// itself.
//
// What actually differs is **how much I get to do between brakes**. A country
// that needs me reports less, so less of what I do turns into somebody looking
// — and the same thirty stops buy the kind player half as many moves again.
// That is the benefit in the hand: not a calmer bar, a longer turn.
//
// Two numbers, because one of them moves with the dice and the other cannot:
// how much gets done between brakes is the benefit as it is felt, and how hard
// the country is looking is the mechanism underneath it.
const room = (r: Run) => r.presses / Math.max(1, r.brakes);
ok(room(kind) > room(careful) * 1.15,
  `ומי שהארץ צריכה אותו מספיק לעשות יותר בין עצירה לעצירה `
  + `(${room(kind).toFixed(1)} פעולות מול ${room(careful).toFixed(1)})`);
ok(kind.wanted <= 0.7 && careful.wanted >= 0.95,
  `ומחפשים אותו בחצי כוח, בזמן שאת הזהיר מחפשים במלוא הכוח `
  + `(פי ${kind.wanted.toFixed(2)} מול פי ${careful.wanted.toFixed(2)})`);
ok(kind.uses > careful.uses + 30,
  `והוא עושה את זה בלי לוותר על הדבר הגדול של אף מקום (${kind.uses} לחיצות מול ${careful.uses})`);
ok(rash.over === 'lost', `מי שרק דוהר קדימה נתפס (יום ${rash.day}, ${rash.israel}%)`);
ok(masher.over === 'lost',
  `ומי שלוחץ על הכפתור הגדול בלי לחשוב נתפס מהר (יום ${masher.day})`);
ok(hider.over === null && hider.israel < 10,
  `ומי שנשאר במקום אחד לא נתפס אף פעם — וגם לא מגיע לשום מקום (${hider.israel}%)`);

// The treadmill test. Taking a country used to be four hundred and eighty-seven
// presses of two buttons; a game is a sequence of decisions, and pressing the
// same thing five times in a row is one decision written out five times.
ok(careful.presses < 260,
  `ולקחת את כל ישראל לוקח ${careful.presses} לחיצות, לא כמה מאות`);
ok(kind.uses > 40, `והכפתור המיוחד הוא דרך משחק שלמה (${kind.uses} לחיצות בריצה אחת)`);

// ── and the three ways in are three different bets ─────────────────────────
//
// The player's second complaint: "הקטע הזה שפשוט נכנסים ולוקחים אחוז מהמקום זה
// לא מידי פשוט וחסר פואנטה?" It was, and the fix is only real if the three ways
// actually pull apart — same place, same minute, three genuinely different
// trades of time against noise against what can go wrong.
{
  const s = newGame('ways-in');
  const p = Object.values(s.places).find((q) => q.found && q.control <= 0)!;
  const rows = offersAt(s, p.id).filter((o) => o.task.id === 'enter');
  ok(rows.length === 3, `שלוש דרכים להיכנס לאותו מקום (${rows.length})`);
  const by = (id: string) => rows.find((o) => o.way?.id === id)!;
  const quiet = by('quiet');
  const force = by('force');
  ok(!!quiet && !!force, 'ובהן הדרך השקטה והדרך המהירה');
  if (quiet && force) {
    ok(force.minutes * 2 < quiet.minutes,
      `המהירה מהירה בהרבה: ${force.minutes} דקות מול ${quiet.minutes}`);
    ok(force.noise > quiet.noise,
      `והשקטה שקטה יותר: ${quiet.noise} רעש מול ${force.noise}`);
    ok(force.wrong > quiet.wrong + 0.1,
      `והמהירה מסוכנת יותר: ${Math.round(force.wrong * 100)}% מול ${Math.round(quiet.wrong * 100)}%`);
    ok(force.way!.look !== quiet.way!.look,
      `ובבוקר הן נראות אחרת: "${force.way!.look}" מול "${quiet.way!.look}"`);
    // Every row has to say its own odds out loud, because a bet whose odds are
    // hidden is not a decision, it is a dice roll with extra steps.
    ok(rows.every((o) => o.wrong > 0), 'ולכל דרך יש סיכוי משלה שמשהו ישתבש');
  }

  // And the bet has to be able to go both ways. A gamble you can only lose is
  // a fee; one that sometimes comes out better than promised is a decision.
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const q = newGame(`out-${i}`);
    const r = Object.values(q.places).find((x) => x.found && x.control <= 0)!;
    seen.add(howItWent(q, r, WAYS[1], `j${i}`));
  }
  ok(seen.has('wrong') && seen.has('clean') && seen.has('plain'),
    `ודרך יכולה לצאת חלק, רגיל, או להשתבש (${[...seen].join(', ')})`);
}

// ── and somebody is actually watching, and can be thrown off ───────────────
//
// The manhunt used to be a formula: it climbed with a number, hit whichever of
// my places was hottest, and did the same things in the same order however I
// played. There was nothing in it to out-think. So: she has to notice a habit,
// she has to charge for it, and she has to let go of it when the habit stops —
// otherwise "an opponent who learns" is just a difficulty slider with a name.
{
  const s = newGame('watched');
  const p = Object.values(s.places).find((q) => q.found && q.control <= 0)!;
  const before = offersAt(s, p.id).find((o) => o.way?.id === 'force')!;

  // Fifteen loud things, all wearing the same face.
  for (let i = 0; i < 15; i++) noticed(s, p, 6, 'wrong');
  const noa = s.hunters[0];
  ok(noa.onLook === 'wrong',
    `היא תופסת דפוס אחרי שחוזרים עליו (${noa.onLook ?? 'לא תפסה'})`);
  ok(watchingSays(s).some((l) => l.includes('בודקת')),
    `ואומרת את זה במילים: "${watchingSays(s)[0]}"`);

  const after = offersAt(s, p.id).find((o) => o.way?.id === 'force')!;
  ok(after.noise > before.noise,
    `ומאותו רגע אותה דרך בדיוק רועשת יותר (${before.noise} ← ${after.noise})`);
  const other = offersAt(s, p.id).find((o) => o.way?.id === 'quiet')!;
  ok(other.noise <= before.noise,
    `ובזמן שהיא מסתכלת לשם, הכיוון האחר לא נהיה יקר יותר (${other.noise})`);
  ok(after.why.some((w) => w.includes(noa.name)),
    'והשורה אומרת בשמה למה זה עולה יותר');

  // And then a few days of doing something else entirely. (Fifteen loud things
  // in a row is a caught player, so the bar is put back where a survivor's
  // would be — what is under test here is her memory, not my luck.)
  s.heat = 18;
  let quiet = 0;
  while (quiet < 6 && s.hunters[0].onLook) {
    for (let i = 0; i < 24 * 6; i++) tick(s, 10);
    quiet += 1;
  }
  ok(!s.hunters[0].onLook && quiet <= 4,
    `וכשמפסיקים היא יורדת מזה, אחרי ${quiet} ימים שקטים`);
}

// ── and what I grow into is chosen, not handed to me ───────────────────────
//
// These used to simply happen: you played, and one night a line said you had
// got slightly better at something. That is a reward, not a decision, and a
// game whose long arc contains no decisions has no long arc. So earning one
// puts a table up, the table has more than one temperament on it, and leaning
// the same way three times is worth something beyond the three themselves.
{
  const s = newGame('grew');
  let tables = 0;
  let biggest = 0;
  const shapes = new Set<string>();
  const play = STYLES[0].move;
  for (let i = 0; i < 40 * 24 * 6 && !s.over; i++) {
    tick(s, 10);
    if (i % 3 === 0 && !s.offered.length) play(s);
    if (!s.offered.length) continue;
    tables += 1;
    biggest = Math.max(biggest, s.offered.length);
    for (const g of onTable(s)) shapes.add(g.shape);
    // Lean one way every single time, and see whether leaning is worth anything.
    take(s, onTable(s).find((g) => g.shape === 'spread')?.id ?? s.offered[0]);
  }
  ok(tables >= 4, `המשחק שואל אותי לאן לגדול, יותר מפעם אחת (${tables} פעמים)`);
  ok(biggest >= 2, `ובכל פעם יש יותר מאפשרות אחת (${biggest} על השולחן)`);
  ok(shapes.size >= 3,
    `והאפשרויות הן באמת כיוונים שונים (${[...shapes].join(', ')})`);

  const l = lean(s);
  ok(l.n >= 3 && l.shape === 'spread',
    `מי שנוטה לכיוון אחד — נהיה הדבר הזה (${SHAPE_NAME[l.shape]}, ${l.n} גדילות)`);
  ok(!!l.says, `ויש לזה משמעות משלה: "${l.says}"`);
  const g = leanGives(s);
  ok(g.fade < 1 || g.ahead > 0 || g.quiet > 0 || g.dug > 0,
    'ולנטייה יש מספר מאחוריה, לא רק שם');

  // Nothing is offered while something is already on the table: two open
  // questions is not twice the decision, it is neither.
  const s2 = newGame('grew2');
  for (let i = 0; i < 40 * 24 * 6 && !s2.over && s2.offered.length < 1; i++) {
    tick(s2, 10);
    if (i % 3 === 0) play(s2);
  }
  const had = [...s2.offered];
  for (let i = 0; i < 24 * 6; i++) tick(s2, 10);
  ok(JSON.stringify(had) === JSON.stringify(s2.offered),
    'וכל עוד לא בחרתי, המשחק לא מציע לי עוד דבר');
}

console.log(bad ? `\n✗ ${bad} דברים במשחקיות לא עובדים` : '\n✓ יש יותר מדרך אחת לשחק, והמשחק מבדיל ביניהן.');
process.exit(bad ? 1 : 0);
