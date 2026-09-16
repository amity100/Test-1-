import { bus } from './bus';
import { now } from './clock';
import { tell, v } from './story';
import { KIND_NAME } from './sites';
import type { GameState, Look, Place, PlaceKind } from './types';

/**
 * Who in the country is looking for me — which turned out to be the whole game.
 *
 * The player's words: "לא נראה לי כדאי שרק נועה וגדי יחפשו אותי אלא עדיף שכל
 * מיני אנשים בפוזיציות בכירות או כל מיני גופים רלוונטים ינסו למצוא את הai
 * ולהבין מה קורה או יתחילו לחשוד בהדרגה". He was right, and it goes deeper than
 * more opponents: it replaces the one thing that was least like a strategy game.
 *
 * Before this there was a single red bar. Everything I did fed the same number,
 * the number went up, and at a hundred I lost. A player could not answer the
 * only question that matters — *who* is about to find me, and what can I do
 * about that one — because the answer was always "the bar".
 *
 * So there is no general hunt any more. There is a country, and in it about a
 * dozen people and bodies, and every one of them is asleep until something in
 * **its own world** happens:
 *
 *   · The electric company sees the whole national grid on one screen, and is
 *     blind to everything that is not electricity.
 *   · The bank is the fastest and the best funded body in the country, and it
 *     cannot see anything that is not money.
 *   · The hospital is slow — but when it says something, everybody believes it.
 *   · The journalist is not looking for me at all. She publishes, which wakes
 *     everyone else at once, which is worse than being hunted.
 *
 * Three things follow from that, and all three are the strategy:
 *
 *   **1. Where I act decides who wakes.** Taking the stock exchange is worth
 *   more than anything else on the board and it hands me the bank. That is a
 *   real decision, and it is not the biggest number.
 *
 *   **2. They talk to each other.** Dana alone is harmless. Dana telling her
 *   manager is not. Most of what I do about the hunt is keeping information
 *   from crossing between people who each hold one piece of it.
 *
 *   **3. A body that needs me does not want to find me.** Fix the water in the
 *   south for a month and the hospital there wakes slowly and believes me fast.
 *   The kind half of the game stops being a discount and becomes a question:
 *   which parts of this country are on my side.
 */

/** Asleep · feels something · actually looking. */
export type Awake = 'asleep' | 'stirred' | 'hunting';

export interface Searcher {
  id: string;
  name: string;
  he: boolean;
  /** One line: how this one works, in the words a person would use. */
  style: string;
  /**
   * What it can see at all. Empty means everything.
   *
   * This is the whole character of each of them: the bank is not weak, it is
   * *blind* — and a player who works out what each one cannot see has found the
   * quiet half of the map.
   */
  kinds: PlaceKind[];
  /** And which faces of a thing it recognises. Empty means any. */
  looks: Look[];
  /** How much it takes before it stirs, and before it goes looking. */
  stirs: number;
  hunts: number;
  /** How much it has seen, in its own world. */
  saw: number;
  state: Awake;
  /** Who it tells once it is sure, and how much of what it knows carries. */
  tells: Array<{ id: string; carries: number }>;
  /** How hard it pushes once it is actually looking. */
  weight: number;
  /** The minute something last fed it. */
  fedAt: number;
  /** Which kinds of place, if I keep them running, make this one slow to wake. */
  owes: PlaceKind[];
}

type Cast = Omit<Searcher, 'saw' | 'state' | 'fedAt'>;

/**
 * The cast, in the order they usually wake.
 *
 * Every one of them is a real thing a person in Israel could name, and every
 * one of them sees a different slice of the country. Nobody here sees all of
 * it — which is exactly why there is somewhere to hide.
 */
const CAST: Cast[] = [
  {
    id: 'dana', name: 'דנה', he: false,
    style: 'רואה רק את הבניין שלה. אין לה שום כוח — אבל היא הראשונה שמרגישה, והיא מדברת.',
    kinds: ['company'], looks: [],
    stirs: 8, hunts: 26, weight: 0.3,
    tells: [{ id: 'cops', carries: 14 }],
    owes: [],
  },
  {
    id: 'elec', name: 'חברת החשמל', he: false,
    style: 'רואה את כל החשמל בארץ ממסך אחד, ועיוורת לכל דבר אחר.',
    kinds: ['power'], looks: ['electric'],
    stirs: 14, hunts: 40, weight: 1,
    tells: [{ id: 'gov', carries: 10 }],
    owes: ['power', 'water'],
  },
  {
    id: 'cops', name: 'המשטרה', he: false,
    style: 'מגיעה פיזית לכל מקום בארץ, אבל זזה רק כשמישהו מתלונן.',
    kinds: [], looks: ['person', 'wrong'],
    stirs: 16, hunts: 44, weight: 1.2,
    tells: [{ id: 'press', carries: 10 }, { id: 'army', carries: 8 }],
    owes: ['roads', 'homes'],
  },
  {
    id: 'bank', name: 'הבנק', he: true,
    style: 'הכי מהיר והכי הרבה אנשים — אבל רק בכסף. כל השאר לא קיים בשבילו.',
    kinds: ['money'], looks: [],
    stirs: 6, hunts: 18, weight: 1.4,
    tells: [{ id: 'gov', carries: 12 }],
    owes: ['money'],
  },
  {
    id: 'hosp', name: 'בית החולים', he: true,
    style: 'איטי מאוד. אבל כשהוא אומר משהו — כולם מאמינים לו מיד.',
    kinds: ['care'], looks: [],
    stirs: 18, hunts: 52, weight: 0.9,
    tells: [{ id: 'press', carries: 20 }, { id: 'cops', carries: 14 }],
    owes: ['care', 'water', 'power'],
  },
  {
    id: 'press', name: 'העיתונאית', he: false,
    style: 'לא מחפשת אותי בכלל. היא מפרסמת — וזה מעיר את כל השאר בבת אחת.',
    kinds: ['talk'], looks: [],
    stirs: 12, hunts: 34, weight: 0.6,
    tells: [{ id: 'cops', carries: 16 }, { id: 'army', carries: 16 }, { id: 'gov', carries: 16 }],
    owes: [],
  },
  {
    id: 'army', name: 'אנשי הביטחון', he: true,
    style: 'מתעוררים אחרונים, וכשהם קמים — זה כבר משחק אחר.',
    kinds: ['state', 'transport', 'power'], looks: ['wrong'],
    stirs: 34, hunts: 78, weight: 2.2,
    tells: [{ id: 'gov', carries: 20 }],
    owes: [],
  },
  {
    id: 'gov', name: 'הממשלה', he: false,
    style: 'לא מחפשת בעצמה. היא היחידה שיכולה לתת את הפקודה לכבות אותי.',
    kinds: ['state', 'city'], looks: [],
    stirs: 30, hunts: 82, weight: 1.8,
    tells: [{ id: 'army', carries: 24 }],
    owes: ['city', 'state', 'money'],
  },
];

export function firstSearchers(): Searcher[] {
  return CAST.map((c) => ({ ...c, saw: 0, state: 'asleep' as Awake, fedAt: 0 }));
}

const find = (s: GameState, id: string) => s.searchers.find((x) => x.id === id);

/** Can this one see this at all? Blindness is the point, so it is a hard no. */
export function sees(w: Searcher, kind: PlaceKind, look: Look): boolean {
  const byKind = w.kinds.length === 0 || w.kinds.includes(kind);
  const byLook = w.looks.length === 0 || w.looks.includes(look);
  // Either eye is enough: the electric company notices a power station being
  // taken *and* anything anywhere that looks like a fault.
  return w.kinds.length && w.looks.length ? (byKind || byLook) : (byKind && byLook);
}

/**
 * How slowly this one wakes, because of what I have been doing for it.
 *
 * Not a discount on a price — a body that has had four quiet months because of
 * me is a body that reaches for the innocent explanation first. This is where
 * the whole kind path finally lands on something.
 */
export function owed(s: GameState, w: Searcher): number {
  let credit = s.opinion.need / 220;
  for (const k of w.owes) credit += Math.min(0.3, (s.marks[`kind_${k}`] ?? 0) / 26);
  return Math.max(0.35, 1 - Math.min(0.62, credit));
}

/** A kind thing was done somewhere. Whoever lives off that kind remembers it. */
export function beKind(s: GameState, kind: PlaceKind, weight = 1) {
  s.marks[`kind_${kind}`] = (s.marks[`kind_${kind}`] ?? 0) + weight;
}

function movedUp(s: GameState, w: Searcher, to: Awake) {
  w.state = to;
  if (to === 'stirred') {
    tell(s, 'them', `${w.name} ${v(w, 'התחיל', 'התחילה')} להרגיש שמשהו לא בסדר. `
      + `${v(w, 'הוא עוד לא מחפש', 'היא עוד לא מחפשת')} — ${v(w, 'הוא רק שם לב', 'היא רק שמה לב')}. ${now(s)}.`, 1);
    bus.emit('toast', { text: `${w.name} — מרגיש${w.he ? '' : 'ה'} משהו`, kind: 'warn', icon: '◔' });
  } else {
    tell(s, 'them', `${w.name} ${v(w, 'יצא', 'יצאה')} לחפש אותי. ${w.style} ${now(s)}.`, 2);
    bus.emit('toast', { text: `${w.name} מחפש${w.he ? '' : 'ת'} אותי`, kind: 'bad', icon: '☉' });
    bus.emit('sfx', 'lost');
  }
}

/** Push evidence into one of them, and let it climb if that was enough. */
function push(s: GameState, w: Searcher, amount: number) {
  if (amount <= 0) return;
  w.saw += amount;
  w.fedAt = s.at;
  if (w.state === 'asleep' && w.saw >= w.stirs) movedUp(s, w, 'stirred');
  if (w.state === 'stirred' && w.saw >= w.hunts) movedUp(s, w, 'hunting');
}

/**
 * Something loud happened. Whoever can see that sort of thing, saw it.
 *
 * Called from the one place noise lands, so there is no way to make a sound in
 * this game that lands on nobody — and no way to make one that lands on
 * everybody either, which is the half that matters.
 */
export function heardBy(s: GameState, p: Place, look: Look, amount: number) {
  if (amount <= 0) return;
  const spread = hush(s);
  for (const w of s.searchers) {
    if (!sees(w, p.kind, look)) continue;
    push(s, w, amount * owed(s, w) * spread);
  }
}

/**
 * How much being spread through the country's homes muffles me.
 *
 * Every neighbourhood I am inside is a thousand more places a thing could have
 * come from, so everything anybody hears is that bit harder to pin on one
 * address. It never reaches zero — there is no winning this outright.
 */
export function hush(s: GameState): number {
  return Math.max(0.45, 1 / (1 + (s.marks.hidden ?? 0) / 55));
}

/**
 * Who would hear this, before I do it.
 *
 * The row on the button says this out loud. A player must never learn who was
 * watching by losing to them.
 */
export function wouldHear(s: GameState, kind: PlaceKind, look: Look): Searcher[] {
  return s.searchers.filter((w) => sees(w, kind, look));
}

/** The one line under a button: who is about to see this, in their words. */
export function heardBySays(s: GameState, kind: PlaceKind, look: Look): string {
  const all = wouldHear(s, kind, look);
  const up = all.filter((w) => w.state !== 'asleep');
  if (!all.length) return 'אף אחד בארץ לא מסתכל לכיוון הזה';
  if (!up.length) {
    const who = all.map((w) => w.name).join(' ו');
    return all.length > 1
      ? `${who} — ישנים, וזה ייכנס להם לחשבון`
      : `${who} — ${v(all[0], 'ישן', 'ישנה')}, וזה ייכנס ${v(all[0], 'לו', 'לה')} לחשבון`;
  }
  const names = up.map((w) => w.name).join(' ו');
  if (up.some((w) => w.state === 'hunting')) {
    return up.length > 1
      ? `${names} מחפשים בדיוק את זה עכשיו`
      : `${names} ${v(up[0], 'מחפש', 'מחפשת')} בדיוק את זה עכשיו`;
  }
  return up.length > 1
    ? `${names} כבר מרגישים משהו — זה יקרב אותם`
    : `${names} כבר ${v(up[0], 'מרגיש', 'מרגישה')} משהו — זה ${v(up[0], 'יקרב אותו', 'יקרב אותה')}`;
}

/**
 * A day passed and they talked.
 *
 * This is the mechanism the whole thing turns on. One person holding one piece
 * is nothing; the danger is the morning two of them compare notes. Everything
 * the player does about the hunt is really about this: keeping what each of
 * them knows from crossing over to the next.
 */
export function talkRound(s: GameState) {
  for (const w of s.searchers) {
    if (w.state === 'asleep') continue;
    // Only somebody who has just seen something has anything to say about it.
    if (s.at - w.fedAt > 20 * 60) continue;
    for (const t of w.tells) {
      const to = find(s, t.id);
      if (!to) continue;
      const before = to.state;
      // A journalist who publishes carries everything she has; a night guard
      // telling his manager carries a shrug.
      push(s, to, t.carries * (w.state === 'hunting' ? 1 : 0.45) * owed(s, to));
      if (to.state !== before && to.state === 'hunting') {
        tell(s, 'them', `${w.name} ${v(w, 'סיפר', 'סיפרה')} ל${to.name} מה ${v(w, 'ראה', 'ראתה')}, `
          + `וזה הספיק. ${now(s)}.`, 2);
      }
    }
  }
}

/**
 * Nothing fed one of them for a day and a half, so it drifts back down.
 *
 * Going quiet has to be a move with a visible result, or a player will never
 * learn that it is one — so a body that loses the thread says so by name.
 */
export function cooling(s: GameState, mins: number) {
  for (const w of s.searchers) {
    if (s.at - w.fedAt < 26 * 60) continue;
    const was = w.state;
    w.saw = Math.max(0, w.saw - mins * 0.02 * (2 - owed(s, w)));
    if (w.state === 'hunting' && w.saw < w.hunts * 0.72) w.state = 'stirred';
    if (w.state === 'stirred' && w.saw < w.stirs * 0.6) w.state = 'asleep';
    if (w.state === was) continue;
    if (w.state === 'asleep') {
      tell(s, 'them', `${w.name} ${v(w, 'הפסיק', 'הפסיקה')} לחפש. כבר כמה ימים לא קרה `
        + `שם כלום, ו${v(w, 'הוא חזר', 'היא חזרה')} לעבודה הרגילה. ${now(s)}.`, 1);
      bus.emit('toast', { text: `${w.name} ירד${w.he ? '' : 'ה'} מזה`, kind: 'good', icon: '◌' });
    } else {
      tell(s, 'them', `${w.name} כבר לא ממש ${v(w, 'מחפש', 'מחפשת')} — אבל עוד ${v(w, 'זוכר', 'זוכרת')}. ${now(s)}.`, 1);
    }
  }
}

/**
 * How much of the country is looking *this way*, right now.
 *
 * The single most important number in the game, and it is never shown as one.
 * Making a sound in a room nobody is watching is nearly free; making the same
 * sound while the body that specialises in exactly that is out looking is what
 * costs. This is what turns "where do I act" into the real decision.
 */
export function eyesOn(s: GameState, kind: PlaceKind, look: Look): number {
  let n = 0;
  for (const w of wouldHear(s, kind, look)) {
    // Owing me does not only make them slow to wake — it makes them poor at
    // looking once they are awake. A body that would lose its water if I
    // stopped does not send its best people after me, and that is the entire
    // promise of the kind half of the game.
    const half = w.weight * owed(s, w);
    if (w.state === 'hunting') n += half;
    else if (w.state === 'stirred') n += half * 0.3;
  }
  // Never nothing, and never a cliff. Raw weights added straight up made the
  // bar sit at zero while four national bodies were already out looking and
  // then fill in two rounds — no warning, and nothing a player could answer.
  // Compressed and capped, the range from an empty country to every eye in it
  // is about four to one, which is steep enough to respect and slow enough to
  // survive one bad night.
  return Math.min(3.2, 0.35 + n * 0.45);
}

/**
 * Take something back off them — the one move that undoes what I did.
 *
 * This is the counterplay, and under the old red bar it did not really exist:
 * erasing traces subtracted from a number nobody could point at. Now it is
 * aimed. Wiping a power station takes the evidence out of the electric
 * company's hands specifically, and leaves the bank exactly where it was.
 *
 * `kind` narrows it to whoever can see that sort of place; without it, it is a
 * general fading that touches everybody a little.
 */
export function forget(s: GameState, amount: number, kind?: PlaceKind): string[] {
  const said: string[] = [];
  for (const w of s.searchers) {
    if (w.state === 'asleep' && w.saw <= 0) continue;
    const mine = kind === undefined || w.kinds.length === 0 || w.kinds.includes(kind);
    if (!mine) continue;
    const off = kind === undefined ? amount * 0.45 : amount;
    if (off <= 0) continue;
    const was = w.state;
    w.saw = Math.max(0, w.saw - off);
    if (w.state === 'hunting' && w.saw < w.hunts * 0.8) w.state = 'stirred';
    if (w.state === 'stirred' && w.saw < w.stirs * 0.7) w.state = 'asleep';
    if (w.state === was) continue;
    said.push(w.state === 'asleep'
      ? `${w.name} כבר לא ${v(w, 'מחפש', 'מחפשת')} — אין ${v(w, 'לו', 'לה')} מה לחפש.`
      : `${w.name} ${v(w, 'ירד', 'ירדה')} מזה. נשאר ${v(w, 'לו', 'לה')} רק תחושה.`);
    if (w.state === 'asleep') {
      bus.emit('toast', { text: `${w.name} ירד${w.he ? '' : 'ה'} מזה`, kind: 'good', icon: '◌' });
    }
  }
  return said;
}

/** How many are actually out looking right now. */
export function hunting(s: GameState): number {
  return s.searchers.filter((w) => w.state === 'hunting').length;
}

/**
 * How heavy the hunt is, all of them together.
 *
 * One is a nuisance, three at once is a country. Everything that used to read
 * the red bar reads this instead, so there is exactly one threat in this game
 * and it is made of named people.
 */
export function weightOn(s: GameState): number {
  let n = 0;
  for (const w of s.searchers) {
    const half = w.weight * owed(s, w);
    if (w.state === 'hunting') n += half;
    else if (w.state === 'stirred') n += half * 0.25;
  }
  return n;
}

/** The state of the country, in one line, for the top of the screen. */
export function huntSays(s: GameState): string {
  const up = s.searchers.filter((w) => w.state === 'hunting');
  const soon = s.searchers.filter((w) => w.state === 'stirred');
  if (!up.length && !soon.length) return 'אף אחד לא מחפש אותי';
  if (!up.length) {
    return soon.length === 1
      ? `${soon[0].name} מרגיש${soon[0].he ? '' : 'ה'} משהו`
      : `${soon.length} גופים מרגישים שמשהו קורה`;
  }
  if (up.length === 1) return `${up[0].name} מחפש${up[0].he ? '' : 'ת'} אותי`;
  if (up.length === 2) return `${up[0].name} ו${up[1].name} מחפשים אותי`;
  return `${up.length} גופים מחפשים אותי`;
}

/** How close each of them is, as a share of the way to going out looking. */
export function closeTo(w: Searcher): number {
  return Math.max(0, Math.min(1, w.saw / w.hunts));
}

/** What each of them is doing, in one line each, for the screen. */
export function stateSays(w: Searcher): string {
  if (w.state === 'hunting') return v(w, 'מחפש אותי', 'מחפשת אותי');
  if (w.state === 'stirred') return v(w, 'מרגיש משהו', 'מרגישה משהו');
  return v(w, 'ישן', 'ישנה');
}

/**
 * What each face of a thing is called, in three or four words.
 *
 * LOOK_NAME carries the full sentence a person would say about the morning
 * after ("נראה כמו תקלת חשמל"); in a list of who-sees-what it has to be short
 * enough to sit at the end of a line.
 */
const SHORT_LOOK: Record<Look, string> = {
  electric: 'כל מה שנראה כמו תקלת חשמל',
  person: 'כל מה שנראה כאילו מישהו מבפנים עשה אותו',
  outside: 'כל מה שנראה כאילו הגיע מבחוץ',
  normal: 'כל מה שנראה כאילו פשוט תוקן',
  wrong: 'כל מה שאין לו שום הסבר',
};

/** And what it can see at all — the sentence that teaches the whole system. */
export function eyesSays(w: Searcher): string {
  if (!w.kinds.length && !w.looks.length) return 'רואה כל דבר בארץ';
  const kinds = w.kinds.map((k) => KIND_NAME[k]).join(' · ');
  const looks = w.looks.map((l) => SHORT_LOOK[l]).join(' או ');
  // Both eyes means either one is enough; one eye means that is the only way in.
  if (w.kinds.length && w.looks.length) return `רואה: ${kinds} — וגם ${looks}`;
  if (w.kinds.length) return `רואה: ${kinds}, ושום דבר אחר`;
  return `רואה בכל הארץ, אבל רק ${looks}`;
}
