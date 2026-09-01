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
import { israel } from '../src/game/sites';
import { wanted } from '../src/game/watch';
import { dayOf } from '../src/game/clock';
import type { GameState, Place } from '../src/game/types';

let bad = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '✓' : '✗'} ${what}`);
  if (!cond) bad += 1;
};
const P = (n: number) => Math.round(n);

const open = (s: GameState) => Object.values(s.places)
  .filter((p) => p.found || p.seen > 0 || p.control > 0);
const mine = (s: GameState) => Object.values(s.places).filter((p) => p.control > 0);

function go(s: GameState, p: Place, id: string) {
  const o = offersAt(s, p.id).find((x) => x.task.id === id);
  if (!o || o.short > 0) return false;
  return start(s, p.id, id, true);
}

interface Style { name: string; move(s: GameState): void }

const STYLES: Style[] = [
  {
    // Take everything, and buy the bar back down when it gets frightening.
    name: 'זהיר',
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
      for (const p of open(s).filter((q) => q.control <= 0)) if (go(s, p, 'enter')) return;
      for (const p of mine(s).filter((q) => q.control < 100)) if (go(s, p, 'grow')) return;
    },
  },
  {
    // Take places, and make the country need you — each place's big thing once
    // a day, which is how often it is worth anything.
    name: 'מיטיב',
    move(s) {
      const GOOD = ['water', 'roads', 'money', 'city', 'homes', 'transport'];
      for (const p of mine(s).filter((q) => q.control >= 100
        && GOOD.includes(q.kind) && freshness(s, q) >= 1)) {
        if (go(s, p, 'use')) return;
      }
      for (const p of mine(s).filter((q) => q.control < 100).sort((a, b) => b.control - a.control)) {
        if (go(s, p, 'grow')) return;
      }
      for (const p of open(s).filter((q) => q.control <= 0)) if (go(s, p, 'enter')) return;
    },
  },
  {
    // The button-masher: press the big one wherever it will go.
    name: 'לוחץ בלי לחשוב',
    move(s) {
      for (const p of mine(s).filter((q) => q.control >= 45)) if (go(s, p, 'use')) return;
      for (const p of mine(s).filter((q) => q.control < 100)) if (go(s, p, 'grow')) return;
      for (const p of open(s).filter((q) => q.control <= 0)) if (go(s, p, 'enter')) return;
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
}
const out = new Map<string, Run>();

for (const style of STYLES) {
  const s = newGame('ways-1');
  let peak = 0;
  let uses = 0;
  const seen = new Set<string>();
  for (let day = 0; day < 60 && !s.over; day++) {
    for (let i = 0; i < 24 * 6; i++) {
      tick(s, 10);
      if (s.over) break;
      if (i % 3 === 0) style.move(s);
      peak = Math.max(peak, s.heat);
      for (const j of s.jobs) {
        if (seen.has(j.id)) continue;
        seen.add(j.id);
        if (j.taskId === 'use') uses += 1;
      }
    }
  }
  out.set(style.name, {
    over: s.over ?? null, day: dayOf(s), israel: P(israel(s)), peak: P(peak),
    places: mine(s).length, presses: seen.size, uses,
  });
  const r = out.get(style.name)!;
  console.log(`\n── ${style.name}: ${r.over ?? 'לא נגמר'} · יום ${r.day} · `
    + `ישראל ${r.israel}% · שיא מצוד ${r.peak} · ${r.places}/65 מקומות · `
    + `${r.presses} לחיצות (${r.uses} מהן על הכפתור המיוחד) · `
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
// names. What has to differ is the thing the player feels: how close it was.
ok(kind.peak < careful.peak - 20,
  `ושתי הדרכים שונות: המיטיב עבר את המשחק בשיא מצוד ${kind.peak}, הזהיר ב־${careful.peak}`);
ok(kind.day > careful.day,
  `ומי שנחמד לארץ מגיע לשם לאט יותר (${kind.day} ימים מול ${careful.day})`);
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

console.log(bad ? `\n✗ ${bad} דברים במשחקיות לא עובדים` : '\n✓ יש יותר מדרך אחת לשחק, והמשחק מבדיל ביניהן.');
process.exit(bad ? 1 : 0);
