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
    says: 'למדתי איך נראה פתח. להיכנס למקום חדש כבר לא לוקח לי כמו פעם.',
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
    says: 'למדתי למחוק אחריי כמו שצריך. למחוק עקבות עולה לי הרבה פחות.',
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

/**
 * Which shape I am becoming — from the hours *and* from what I chose.
 *
 * The hours still count, because who you are is mostly what you spent the night
 * doing. But every growth taken is a deliberate lean, and leaning three times
 * the same way should decide it: a player who took every quiet thing on offer
 * has answered the question about himself more clearly than his clock has.
 */
export function shapeOf(s: GameState): Shape {
  const score: Record<Shape, number> = {
    knowing: s.info * 40,
    spread: held(s, 'connect') + held(s, 'spread') + places(s) * 120,
    people: held(s, 'influence') * 2,
    deep: held(s, 'hide') + deepest(s) * 8,
  };
  for (const id of s.grown) {
    const g = GROWTHS.find((x) => x.id === id);
    if (g) score[g.shape] += 900;
  }
  return (Object.keys(score) as Shape[]).sort((a, b) => score[b] - score[a])[0];
}

/**
 * How far I have leaned one way, and what that leaning is worth on its own.
 *
 * Three of a kind is a creature rather than a collection, and the game should
 * say so with a number rather than only with a name on the end screen. This is
 * the whole reason the draft offers one from each temperament: taking the
 * matching one every time is a real strategy with a real payoff, and taking
 * whatever looks best right now is a different, equally real one.
 */
export function lean(s: GameState): { shape: Shape; n: number; says: string | null } {
  const shape = shapeOf(s);
  let n = 0;
  for (const id of s.grown) {
    const g = GROWTHS.find((x) => x.id === id);
    if (g?.shape === shape) n += 1;
  }
  return { shape, n, says: n >= 3 ? LEAN_SAYS[shape] : null };
}

/** What three of one temperament does, over and above the three themselves. */
export const LEAN_SAYS: Record<Shape, string> = {
  knowing: 'אני רואה כל מהלך שלהם הרבה לפני שהוא קורה.',
  spread: 'אני בכל כך הרבה מקומות שכמעט אי אפשר להתחיל לחפש אותי.',
  people: 'אני קורא אנשים טוב מספיק כדי לדעת מי ילך לבדוק, ומתי.',
  deep: 'איפה שאני נמצא — לעקור אותי משם זו עבודה של שבוע.',
};

/** And what it actually changes, applied wherever the number is read. */
export function leanGives(s: GameState): {
  ahead: number; fade: number; quiet: number; dug: number;
} {
  const { shape, n } = lean(s);
  if (n < 3) return { ahead: 0, fade: 1, quiet: 0, dug: 0 };
  return {
    ahead: shape === 'knowing' ? 18 : 0,
    fade: shape === 'spread' ? 0.75 : 1,
    quiet: shape === 'people' ? 1.2 : 0,
    dug: shape === 'deep' ? 25 : 0,
  };
}

/**
 * Something in me is ready to change, and I get to say what.
 *
 * These used to simply happen. You played, and one night a line appeared saying
 * you had become slightly better at something — which is a reward, but it is
 * not a decision, and a game whose long arc contains no decisions has no long
 * arc. The player's question was whether the biggest strategy games work this
 * way, and they do not: the shape of your run is a thing you choose, over and
 * over, from options that exclude each other.
 *
 * So earning one puts up to three on the table, from three different
 * temperaments where the earned ones allow it, and one of them is taken. The
 * others are not destroyed — they go back and can come up again — because the
 * cost here is not the road not taken, it is **the order**: what you take now
 * is what you have for the rest of tonight, and tonight is when it matters.
 */
export function grow(s: GameState) {
  // Something is already on the table. Nothing new is offered until it is taken,
  // because two open questions is not twice the decision, it is neither.
  if (s.offered?.length) return;
  const ready = GROWTHS.filter((g) => !s.grown.includes(g.id) && g.needs(s));
  if (!ready.length) { delete s.marks.ripe; return; }

  // Do not put a table up the instant the first one is earned, or the table is
  // one card and the choice is a formality. Wait for a second to ripen — and if
  // none does within a few hours, offer the one there is rather than sit on it.
  if (!s.marks.ripe) s.marks.ripe = s.at || 1;
  if (ready.length < 2 && s.at - s.marks.ripe < 5 * 60) return;
  delete s.marks.ripe;

  // One from each temperament first, so a table of three is a choice between
  // three different creatures rather than three flavours of the same one.
  const table: Growth[] = [];
  for (const sh of ['knowing', 'spread', 'people', 'deep'] as Shape[]) {
    const one = ready.find((g) => g.shape === sh);
    if (one) table.push(one);
  }
  for (const g of ready) {
    if (table.length >= 3) break;
    if (!table.includes(g)) table.push(g);
  }
  s.offered = table.slice(0, 3).map((g) => g.id);
  say(s, 'me', s.offered.length > 1
    ? 'משהו בי גדל, ואני יכול לבחור לאן. יש לי כמה כיוונים.'
    : 'משהו בי גדל.');
  bus.emit('choose', s.offered);
  bus.emit('toast', {
    text: s.offered.length > 1 ? 'משהו בי גדל — צריך לבחור' : 'משהו בי גדל',
    kind: 'good', icon: '✦',
  });
}

/**
 * Take one of them.
 *
 * The rest go back in the pool. What it cost was the night, not the others.
 */
export function take(s: GameState, id: string): boolean {
  if (!s.offered?.includes(id)) return false;
  const g = GROWTHS.find((x) => x.id === id);
  if (!g) return false;
  s.offered = [];
  s.grown.push(g.id);
  g.apply?.(s);
  if (g.price) GROWTH_PRICE[g.id] = (t, f) => g.price!(t, f);
  say(s, 'me', `${g.name}. ${g.says}`);
  bus.emit('grown', g.id);
  bus.emit('toast', { text: g.name, kind: 'good', icon: '✦' });
  return true;
}

/** What is on the table right now, in full. */
export function onTable(s: GameState): Growth[] {
  return (s.offered ?? []).map((id) => GROWTHS.find((g) => g.id === id))
    .filter((g): g is Growth => !!g);
}

/** Put the price changes back after a save is loaded. */
export function rewire(s: GameState) {
  for (const g of GROWTHS) {
    if (s.grown.includes(g.id) && g.price) GROWTH_PRICE[g.id] = (t, f) => g.price!(t, f);
  }
}
