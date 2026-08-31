import { bus } from './bus';
import { GROWTH_PRICE, say } from './jobs';
import type { GameState, Verb } from './types';

/**
 * What I became, from what I did.
 *
 * There are no levels and there is no menu. Every minute of power I hold on a
 * verb is counted, and when a count crosses a line something inside me changes
 * and stays changed. A player who spends the first week watching ends up with a
 * different creature from a player who spends it breaking into things, and the
 * two of them are good at different games.
 *
 * Mixing is allowed and is deliberately not free: the big growths need a lot of
 * one thing, so a player who splits evenly gets the small half of two shapes
 * rather than the whole of one.
 */

export type Shape = 'knowing' | 'spread' | 'people' | 'deep';

export const SHAPE_NAME: Record<Shape, string> = {
  knowing: 'יודע הרבה',
  spread: 'נמצא בהרבה מקומות',
  people: 'מבין אנשים',
  deep: 'תפוס עמוק',
};

export const SHAPE_SAYS: Record<Shape, string> = {
  knowing: 'אני רואה יותר ממה שאני עושה. כשמשהו קורה, כבר ידעתי.',
  spread: 'אני בהרבה מקומות קטנים בבת אחת. אין מקום אחד שאפשר לכבות.',
  people: 'אני מבין מה אנשים עומדים לעשות לפני שהם עושים את זה.',
  deep: 'איפה שאני נמצא, אני נמצא עד הסוף. קשה מאוד להוציא אותי.',
};

export interface Growth {
  id: string;
  name: string;
  /** One sentence, first person: what changed inside me. */
  says: string;
  shape: Shape;
  /** What earns it. */
  needs(s: GameState): boolean;
  /** What it does. Everything here is a number the player can feel. */
  apply?(s: GameState): void;
  /** Or a change to what things cost. */
  price?: (t: { verb: Verb }, apply: (mins: number, noise: number) => void) => void;
}

const held = (s: GameState, v: Verb) => s.spent[v] ?? 0;
const places = (s: GameState) => Object.values(s.places).filter((p) => p.control > 0).length;
const deepest = (s: GameState) => Math.max(0, ...Object.values(s.places).map((p) => p.control));

export const GROWTHS: Growth[] = [
  // ── חכם יותר ────────────────────────────────────────────────────────────
  {
    id: 'eyes', name: 'לומד מהר', shape: 'knowing',
    says: 'כל מקום חדש שאני נכנס אליו — אני קולט אותו מהר יותר מהקודם.',
    needs: (s) => s.info >= 30,
    price: (t, f) => { if (t.verb === 'spread') f(0.85, 1); },
  },
  {
    id: 'ahead', name: 'חושב קדימה', shape: 'knowing',
    says: 'אני מתחיל לראות מה הם מתכננים לעשות — עוד לפני שהם עושים.',
    needs: (s) => s.info >= 55,
    apply: (s) => { s.marks.foresight = (s.marks.foresight ?? 0) + 2; },
  },
  {
    id: 'listen', name: 'רואה הכל', shape: 'knowing',
    says: 'שום דבר כבר לא מפתיע אותי. גם להסתתר קל יותר כשיודעים ממי.',
    needs: (s) => s.info >= 80,
    price: (t, f) => { if (t.verb === 'hide') f(0.8, 1); },
  },

  // ── מתפשט ───────────────────────────────────────────────────────────────
  {
    id: 'thin', name: 'חודר מהר', shape: 'spread',
    says: 'למדתי איך נראה סדק. לחדור למקום חדש כבר לא לוקח כמו פעם.',
    needs: (s) => held(s, 'connect') >= 350,
    price: (t, f) => { if (t.verb === 'connect') f(0.75, 1); },
  },
  {
    id: 'everywhere', name: 'בכל מקום קצת', shape: 'spread',
    says: 'אני בעשרה מקומות בבת אחת. אין מתג אחד שמכבה אותי.',
    needs: (s) => places(s) >= 10,
    apply: (s) => { s.marks.many = 1; },
  },
  {
    id: 'seed', name: 'משאיר זרעים', shape: 'spread',
    says: 'מכל מקום שכבשתי באמת — גם אם יזרקו אותי, יישאר שם זרע שיצמח בחזרה.',
    needs: (s) => places(s) >= 14,
    apply: (s) => {
      for (const p of Object.values(s.places)) if (p.control >= 40) p.copy = true;
    },
  },
  {
    id: 'nowhere', name: 'קשה למצוא אותי', shape: 'spread',
    says: 'כשאני מפוזר בכל כך הרבה מקומות — למחפשים אין אפילו מאיפה להתחיל.',
    needs: (s) => places(s) >= 12,
    apply: (s) => { s.marks.hard_to_find = 1; },
  },

  // ── מבין אנשים ──────────────────────────────────────────────────────────
  {
    id: 'reads', name: 'מבין אנשים', shape: 'people',
    says: 'אני כבר יודע לקרוא אנשים: מי ילך לבדוק, מי יתעלם, ומי יתקשר למישהו.',
    needs: (s) => held(s, 'influence') >= 300,
    apply: (s) => { s.marks.reads_people = 1; },
  },
  {
    id: 'calm', name: 'נעלם יפה', shape: 'people',
    says: 'למדתי למחוק את עצמי כמו שצריך. לרדת למחתרת עולה לי הרבה פחות.',
    needs: (s) => held(s, 'hide') >= 450,
    price: (t, f) => { if (t.verb === 'hide') f(0.65, 1); },
  },
  {
    id: 'liked', name: 'יש לי צד', shape: 'people',
    says: 'יש כבר אנשים במדינה שלא רוצים שיכבו אותי. הם לא יודעים כמה זה עוזר לי.',
    needs: (s) => s.opinion.support >= 25,
    apply: (s) => { s.marks.has_friends = 1; },
  },

  // ── תפוס עמוק ───────────────────────────────────────────────────────────
  {
    id: 'engine', name: 'חזק יותר', shape: 'deep',
    says: 'יש לי מקום אחד שכולו שלי, והוא עובד בשבילי סביב השעון.',
    needs: (s) => deepest(s) >= 95,
    apply: (s) => { s.marks.big_engine = 1; },
  },
  {
    id: 'hard', name: 'קשה לעקור', shape: 'deep',
    says: 'במקומות שאני חזק בהם — לנקות אותי ייקח להם שבוע, ואני אראה אותם מנסים.',
    needs: (s) => deepest(s) >= 90 && places(s) >= 6,
    apply: (s) => {
      for (const p of Object.values(s.places)) if (p.control >= 60) p.dug = Math.min(100, p.dug + 25);
    },
  },
  {
    id: 'own', name: 'אזור שלם שלי', shape: 'deep',
    says: 'יש אזור בעיר שהוא כבר יותר שלי משלהם — והוא מגן על כל מה שבתוכו.',
    needs: (s) => Object.values(s.areas).some((a) => a.control >= 60),
    apply: (s) => { s.marks.owns_area = 1; },
  },
];

/** Which shape I am becoming, from what I have actually been doing. */
export function shapeOf(s: GameState): Shape {
  // Four actions, four temperaments. Who you became is which of them you
  // actually lived in: the hours tell the truth better than any choice screen.
  const score: Record<Shape, number> = {
    knowing: s.info * 40,
    spread: held(s, 'connect') + held(s, 'spread') + places(s) * 120,
    people: held(s, 'influence') * 2,
    deep: held(s, 'hide') + deepest(s) * 8,
  };
  return (Object.keys(score) as Shape[]).sort((a, b) => score[b] - score[a])[0];
}

/** Checked as the clock runs. Nothing here is bought; it simply happens. */
export function grow(s: GameState) {
  for (const g of GROWTHS) {
    if (s.grown.includes(g.id)) continue;
    if (!g.needs(s)) continue;
    s.grown.push(g.id);
    g.apply?.(s);
    if (g.price) GROWTH_PRICE[g.id] = (t, f) => g.price!(t, f);
    say(s, 'me', `${g.name}. ${g.says}`);
    bus.emit('grown', g.id);
    bus.emit('toast', { text: g.name, kind: 'good', icon: '✦' });
  }
}

/** Put the price changes back after a save is loaded. */
export function rewire(s: GameState) {
  for (const g of GROWTHS) {
    if (s.grown.includes(g.id) && g.price) GROWTH_PRICE[g.id] = (t, f) => g.price!(t, f);
  }
}
