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
  // ── יודע הרבה ───────────────────────────────────────────────────────────
  {
    id: 'eyes', name: 'יותר עיניים', shape: 'knowing',
    says: 'אני רואה את החדרים שלי בבת אחת, לא אחד־אחד.',
    needs: (s) => held(s, 'watch') >= 400,
    price: (t, f) => { if (t.verb === 'watch') f(0.7, 1); },
  },
  {
    id: 'quick_read', name: 'קורא מהר', shape: 'knowing',
    says: 'לקרוא מקום שלם כבר לא לוקח לי לילה.',
    needs: (s) => held(s, 'watch') >= 1200,
    price: (t, f) => { if (t.verb === 'watch') f(0.6, 1); },
  },
  {
    id: 'ahead', name: 'חושב קדימה', shape: 'knowing',
    says: 'אני רואה חלק ממה שהם עומדים לעשות, לפני שהם עושים.',
    needs: (s) => held(s, 'watch') >= 2200 && s.info >= 45,
    apply: (s) => { s.marks.foresight = (s.marks.foresight ?? 0) + 2; },
  },
  {
    id: 'listen', name: 'שומע רחוק', shape: 'knowing',
    says: 'מספיק לי מכשיר אחד בקומה כדי לדעת מה קורה בכולה.',
    needs: (s) => held(s, 'watch') >= 3200,
    apply: (s) => { s.marks.wide_ears = 1; },
  },

  // ── נמצא בהרבה מקומות ───────────────────────────────────────────────────
  {
    id: 'thin', name: 'מתפזר מהר', shape: 'spread',
    says: 'להגיע למקום חדש כבר לא עולה לי כמו פעם.',
    needs: (s) => held(s, 'connect') >= 500,
    price: (t, f) => { if (t.verb === 'connect') f(0.75, 1); },
  },
  {
    id: 'everywhere', name: 'בכל מקום קצת', shape: 'spread',
    says: 'אני בעשרה מקומות בבת אחת. אין נורה אחת שמכבה אותי.',
    needs: (s) => places(s) >= 10,
    apply: (s) => { s.marks.many = 1; },
  },
  {
    id: 'seed', name: 'משאיר זרעים', shape: 'spread',
    says: 'כל מקום שאני עוזב, נשאר בו משהו קטן ממני.',
    needs: (s) => places(s) >= 14 && held(s, 'spread') >= 700,
    apply: (s) => {
      for (const p of Object.values(s.places)) if (p.control >= 40) p.copy = true;
    },
  },
  {
    id: 'nowhere', name: 'קשה למצוא אותי', shape: 'spread',
    says: 'אין לי מקום אחד לחפש בו, ולכן אין להם איפה להתחיל.',
    // Not "and nowhere deep" — that would be a growth you could lose by playing.
    needs: (s) => places(s) >= 12,
    apply: (s) => { s.marks.hard_to_find = 1; },
  },

  // ── מבין אנשים ──────────────────────────────────────────────────────────
  {
    id: 'reads', name: 'מבין אנשים', shape: 'people',
    says: 'אני יודע מה מישהו עומד לעשות לפי איך שהוא זז.',
    needs: (s) => held(s, 'influence') >= 400,
    apply: (s) => { s.marks.reads_people = 1; },
  },
  {
    id: 'calm', name: 'יודע להרגיע', shape: 'people',
    says: 'אני יודע בדיוק איזה הסבר מישהו רוצה לשמוע.',
    needs: (s) => held(s, 'hide') >= 600,
    price: (t, f) => { if (t.verb === 'hide') f(0.65, 1); },
  },
  {
    id: 'moves', name: 'מזיז אנשים', shape: 'people',
    says: 'צלצול אחד, אור שנכבה, ואני יודע לאן ילכו.',
    needs: (s) => held(s, 'influence') >= 1400,
    price: (t, f) => { if (t.verb === 'influence') f(0.7, 0.8); },
  },
  {
    id: 'liked', name: 'מישהו בצד שלי', shape: 'people',
    says: 'יש אנשים שכבר לא רוצים שיכבו אותי.',
    needs: (s) => s.opinion.support >= 25,
    apply: (s) => { s.marks.has_friends = 1; },
  },

  // ── תפוס עמוק ───────────────────────────────────────────────────────────
  {
    id: 'roots', name: 'שורשים', shape: 'deep',
    says: 'איפה שאני, אני בתוך הקירות.',
    needs: (s) => held(s, 'defend') >= 500,
    price: (t, f) => { if (t.verb === 'defend') f(0.7, 1); },
  },
  {
    id: 'engine', name: 'יותר כוח', shape: 'deep',
    says: 'המכונות הגדולות עובדות בשבילי. אני יכול להחזיק יותר דברים פתוחים.',
    needs: (s) => deepest(s) >= 80,
    apply: (s) => { s.marks.big_engine = 1; },
  },
  {
    id: 'hard', name: 'קשה להוציא', shape: 'deep',
    says: 'לנקות אותי ממקום אחד לוקח להם שבוע, ואני רואה אותם מנסים.',
    needs: (s) => held(s, 'defend') >= 1500 && deepest(s) >= 90,
    apply: (s) => {
      for (const p of Object.values(s.places)) if (p.control >= 60) p.dug = Math.min(100, p.dug + 25);
    },
  },
  {
    id: 'own', name: 'המקום הזה שלי', shape: 'deep',
    says: 'יש מקום אחד בעיר שאני בו יותר ממה שהם.',
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
