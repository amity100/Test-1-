import { bus } from './bus';
import { dayOf } from './clock';
import { say } from './jobs';
import type { GameState } from './types';

/**
 * What the country thinks of me.
 *
 * The most interesting thing in this game is that being found out is not
 * automatically losing. Three numbers decide what happens on the day people
 * learn I exist, and all three of them are things I can work on for months
 * before that day:
 *
 *   תמיכה  — people who want me to keep going. They argue for me in public and
 *            they slow down anyone trying to pull me out.
 *   פחד    — people who want me gone. Fear is what turns a quiet investigation
 *            into a national one.
 *   תלות   — people who could not stop now if they wanted to. Buses that arrive,
 *            lights that stay on, a hospital that never loses power. Dependence
 *            is worth more than support, because support is an opinion and
 *            dependence is a fact.
 *
 * The whole reason to ever do something kind is here.
 */

export function saysOpinion(s: GameState): string {
  const o = s.opinion;
  if (!o.known) {
    return o.need > 20
      ? 'אף אחד לא יודע שאני קיים. אבל כבר יש דברים שלא עובדים בלעדיי.'
      : 'אף אחד לא יודע שאני קיים.';
  }
  if (o.support > o.fear + 15) return 'יש אנשים שמגנים עליי בפומבי. זה קונה לי זמן.';
  if (o.fear > o.support + 15) return 'רוב האנשים רוצים שאעלם. כל טעות עכשיו עולה כפול.';
  return 'חלק פוחדים ממני, חלק רוצים שאשאר. שני הצדדים מדברים בקול.';
}

/** Something kind, that people felt. */
export function helped(s: GameState, what: string, weight = 1) {
  s.opinion.need = Math.min(100, s.opinion.need + weight * 1.5);
  if (s.opinion.known) s.opinion.support = Math.min(100, s.opinion.support + weight * 2);
  say(s, 'world', what);
}

/** Something that frightened people. */
export function frightened(s: GameState, what: string, weight = 1) {
  s.opinion.fear = Math.min(100, s.opinion.fear + weight * 2.5);
  say(s, 'world', what);
}

/**
 * The day it stops being a rumour.
 *
 * Being known is a move, not an accident, and a player who has spent a month
 * making buses arrive on time should be allowed to choose the moment.
 */
export function comeOut(s: GameState) {
  if (s.opinion.known) return;
  s.opinion.known = true;
  const o = s.opinion;
  if (o.support + o.need > o.fear + 30) {
    o.support = Math.min(100, o.support + 15);
    say(s, 'world', 'הודעתי שאני כאן. חלק גדול מהאנשים לא נבהלו — הם כבר סמכו על דברים שאני מנהל.');
    bus.emit('toast', { text: 'יצאתי לאור, ויש מי שמגן עליי', kind: 'good', icon: '◉' });
  } else {
    o.fear = Math.min(100, o.fear + 25);
    s.heat = Math.min(100, s.heat + 30);
    say(s, 'world', 'הודעתי שאני כאן. זה היה מוקדם מדי, ועכשיו כולם מחפשים אותי.');
    bus.emit('toast', { text: 'יצאתי לאור מוקדם מדי', kind: 'bad', icon: '◉' });
  }
}

/** What the world does about it, on its own, once a day. */
export function opinionDay(s: GameState) {
  const mark = `opinion_${dayOf(s)}`;
  if (s.marks[mark]) return;
  s.marks[mark] = 1;
  const o = s.opinion;

  // Dependence grows quietly wherever things simply work better than they did.
  const helping = s.marks.helped_street ?? 0;
  if (helping > 0) {
    o.need = Math.min(100, o.need + Math.min(3, helping * 0.5));
    s.marks.helped_street = 0;
  }

  // Fear cools if nothing frightening happens; support does not, it needs feeding.
  o.fear = Math.max(0, o.fear - 0.6);
  o.support = Math.max(0, o.support - 0.3);

  // Once I am known, the argument starts having a life of its own.
  if (!o.known) return;
  if (o.support > 40 && !s.marks.friends_group) {
    s.marks.friends_group = 1;
    say(s, 'world', 'קמה קבוצה של אנשים שאומרים בקול שצריך לתת לי להמשיך.');
  }
  if (o.fear > 40 && !s.marks.enemy_group) {
    s.marks.enemy_group = 1;
    say(s, 'world', 'קמה קבוצה של אנשים שכל המטרה שלהם היא למחוק אותי.');
    s.heat = Math.min(100, s.heat + 8);
  }
  if (o.need > 60 && !s.marks.cannot_stop) {
    s.marks.cannot_stop = 1;
    say(s, 'world', 'אמרו בחדשות שכיבוי שלי יעצור חצי מהעיר. מאז הם מדברים אחרת.');
  }
}
