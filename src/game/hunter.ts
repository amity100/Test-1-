import { bus } from './bus';
import { now } from './clock';
import { tell, v } from './story';
import type { GameState, Look, PlaceKind } from './types';
import { KIND_NAME } from './sites';
import { LOOK_NAME } from './types';

/**
 * The one who is actually looking for me, and what she has worked out.
 *
 * Until now the manhunt was a formula. It climbed with a number, it picked
 * whichever of my places happened to be hottest, and it did the same things in
 * the same order however I played. There was nothing there to out-think — the
 * player's words for it were that the whole thing was "פחות הגיוני" than it
 * should be, and he was right: you cannot outsmart an average.
 *
 * So there is a person. She has a name, she keeps count, and the count is the
 * whole mechanism:
 *
 *   **She counts how things looked.** Every noisy thing I do lands under one of
 *   five faces — like a power fault, like somebody with a card, like it came in
 *   off the street, like it simply got fixed, or like nothing anybody has a word
 *   for. Do the same one often enough and she stops believing in coincidence,
 *   says so out loud, and from then on that face costs me three times as much.
 *
 *   **She counts what I take.** Six power stations in a week and she starts
 *   guarding power stations — all of them, everywhere, including the ones I have
 *   not touched.
 *
 * Both of those are counterable, and that is the point. Change the way I get in
 * and the face changes with it. Go somewhere else for a few days and she loses
 * the thread — what she is holding fades if nothing feeds it. She is beatable
 * the way a person is beatable: by not being predictable.
 *
 * Everything she believes is on the screen, in her words, before it costs me
 * anything. A hidden opponent is not a puzzle, it is a tax.
 */

export interface Hunter {
  id: string;
  name: string;
  he: boolean;
  /** One line: how this one works, so two of them never feel the same. */
  style: string;
  /** How much of each face she has seen. */
  looks: Partial<Record<Look, number>>;
  /** And how much of each sort of place. */
  kinds: Partial<Record<PlaceKind, number>>;
  /** The face she has settled on, once she is sure enough. */
  onLook?: Look;
  /** And the sort of place. */
  onKind?: PlaceKind;
  /** The minute she last saw something that fed either. */
  fedAt: number;
}

/**
 * How much of one face it takes before she stops calling it coincidence.
 *
 * A single loud thing is worth a handful, so this is a dozen or so actions
 * wearing the same face — a habit, not a coincidence and not a run of three.
 * Set low it turned the whole game hostile: every style, including the careful
 * ones, was locked on to within a night and had nothing left that was cheap.
 */
export const SURE = 55;
/**
 * And a pattern is a *share*, not a total.
 *
 * Play long enough and every face crosses any count. What she is actually
 * noticing is that most of what she sees looks the same, so it has to be most
 * of what she has seen.
 */
export const MOSTLY = 0.45;
/** How long a thread survives with nothing feeding it, in world minutes. */
export const FORGETS = 26 * 60;

/** Everything one of them has seen, of any face. */
const totalLooks = (h: Hunter) =>
  Object.values(h.looks).reduce((a, b) => a + b, 0);
const totalKinds = (h: Hunter) =>
  Object.values(h.kinds).reduce((a, b) => a + b, 0);

/**
 * Who is looking, and who joins.
 *
 * One to begin with, because one person with a hunch is what the beginning of
 * this story is. The second arrives when the country knows I exist, and she
 * works the other way round — the first watches *how* things happen, the second
 * watches *what* they happen to.
 */
const CAST: Array<Omit<Hunter, 'looks' | 'kinds' | 'fedAt'>> = [
  {
    id: 'noa', name: 'נעה', he: false,
    style: 'שמה לב לצורה של דברים. אם משהו חוזר על עצמו — היא תראה את זה.',
  },
  {
    id: 'gadi', name: 'גדי', he: true,
    style: 'לא מסתכל על איך זה קרה אלא על איפה. הוא מחפש את הדפוס במפה.',
  },
];

export function firstHunters(): Hunter[] {
  return [{ ...CAST[0], looks: {}, kinds: {}, fedAt: 0 }];
}

/** The second one joins once I am not a rumour any more. */
export function maybeJoin(s: GameState) {
  if (!s.opinion.known || s.hunters.length > 1) return;
  s.hunters.push({ ...CAST[1], looks: {}, kinds: {}, fedAt: s.at });
  tell(s, 'them', `${CAST[1].name} הצטרף לחיפוש. ${CAST[1].style}`, 2);
  bus.emit('toast', { text: `${CAST[1].name} הצטרף לחיפוש`, kind: 'bad', icon: '☉' });
}

/**
 * Something loud happened, and they were counting.
 *
 * Called from the one place noise lands, so there is no way to make a sound in
 * this game that nobody is counting.
 */
export function saw(s: GameState, amount: number, look: Look, kind: PlaceKind) {
  if (amount <= 0) return;
  for (const h of s.hunters) {
    h.looks[look] = (h.looks[look] ?? 0) + amount;
    h.kinds[kind] = (h.kinds[kind] ?? 0) + amount;
    h.fedAt = s.at;

    // The face. She names it out loud the minute she is sure, because an
    // opponent whose conclusion is a hidden multiplier is not an opponent.
    const looksAll = totalLooks(h);
    const kindsAll = totalKinds(h);
    if (!h.onLook && h.id === 'noa'
      && (h.looks[look] ?? 0) >= SURE && (h.looks[look] ?? 0) >= looksAll * MOSTLY) {
      h.onLook = look;
      tell(s, 'them', `${h.name} ${v(h, 'שם', 'שמה')} לב שהרבה מהדברים המוזרים `
        + `נראים אותו דבר — ${LOOK_NAME[look]}. מעכשיו ${v(h, 'הוא בודק', 'היא בודקת')} `
        + `כל דבר כזה מקרוב. ${now(s)}.`, 2);
      bus.emit('toast', {
        text: `${h.name} תפסה את הדפוס: ${LOOK_NAME[look]}`, kind: 'bad', icon: '◎',
      });
    }
    if (!h.onKind && h.id === 'gadi'
      && (h.kinds[kind] ?? 0) >= SURE && (h.kinds[kind] ?? 0) >= kindsAll * MOSTLY) {
      h.onKind = kind;
      tell(s, 'them', `${h.name} ${v(h, 'הבין', 'הבינה')} שכל מה שקורה קורה במקומות `
        + `מאותו סוג: ${KIND_NAME[kind]}. עכשיו שומרים על כולם בארץ. ${now(s)}.`, 2);
      bus.emit('toast', {
        text: `${h.name} שם עין על כל ה${KIND_NAME[kind]} בארץ`, kind: 'bad', icon: '◎',
      });
    }
  }
}

/**
 * Nothing has fed the thread for a day, so it goes cold.
 *
 * This is the whole counterplay, and it has to be as loud as the moment she
 * caught on — a player who changed how he works has to be *told* it worked, or
 * he will never learn that it is a thing he can do.
 */
export function coolOff(s: GameState) {
  for (const h of s.hunters) {
    if (s.at - h.fedAt < FORGETS) continue;
    h.fedAt = s.at;
    // A quarter of everything, so what is left keeps its shape: going quiet
    // does not wipe her memory, it lets the strongest thread fall below the
    // line first, which is exactly the order a person forgets things in.
    for (const k of Object.keys(h.looks) as Look[]) {
      h.looks[k] = Math.max(0, (h.looks[k] ?? 0) * 0.7);
    }
    for (const k of Object.keys(h.kinds) as PlaceKind[]) {
      h.kinds[k] = Math.max(0, (h.kinds[k] ?? 0) * 0.7);
    }
    // Two clear days buys the release, which is a rule a player can learn and
    // plan around — and planning around it is the whole game this file adds.
    if (h.onLook && (h.looks[h.onLook] ?? 0) < SURE * 0.7) {
      const was = h.onLook;
      delete h.onLook;
      tell(s, 'them', `${h.name} ${v(h, 'הפסיק', 'הפסיקה')} לחפש דברים ש${LOOK_NAME[was]}. `
        + `כבר יומיים לא קרה שם כלום. ${now(s)}.`, 2);
      bus.emit('toast', { text: `${h.name} ירדה מהדפוס`, kind: 'good', icon: '◌' });
    }
    if (h.onKind && (h.kinds[h.onKind] ?? 0) < SURE * 0.7) {
      const was = h.onKind;
      delete h.onKind;
      tell(s, 'them', `הפסיקו לשמור במיוחד על ה${KIND_NAME[was]}. שם כבר שקט. ${now(s)}.`, 2);
      bus.emit('toast', { text: `הורידו את השמירה מה${KIND_NAME[was]}`, kind: 'good', icon: '◌' });
    }
  }
}

/**
 * What being watched costs me, on this face and at this sort of place.
 *
 * A face somebody is specifically checking is three times as loud, because the
 * ordinary explanation that used to cover it is exactly the thing she stopped
 * believing. Everything else gets quietly *cheaper* — while she is looking one
 * way, she is not looking the others — and that discount is what makes changing
 * your habits a move rather than a chore.
 */
export function watching(s: GameState, look: Look, kind: PlaceKind): {
  noise: number; mins: number; why: string[];
} {
  let noise = 1;
  let mins = 1;
  const why: string[] = [];
  let anyLock = false;
  for (const h of s.hunters) {
    if (h.onLook) anyLock = true;
    if (h.onLook === look) {
      noise *= 2.2;
      why.push(`${h.name} בודקת כל דבר ש${LOOK_NAME[look]} — עכשיו זה בולט הרבה יותר`);
    }
    if (h.onKind === kind) {
      mins *= 1.35;
      noise *= 1.45;
      why.push(`שומרים במיוחד על כל ה${KIND_NAME[kind]} בארץ בגלל ${h.name}`);
    }
  }
  // Looking one way means not looking the others.
  if (anyLock && !s.hunters.some((h) => h.onLook === look)) {
    noise *= 0.65;
    why.push('הם מחפשים משהו אחר לגמרי עכשיו — מהכיוון הזה כמעט לא מסתכלים');
  }
  return { noise, mins, why };
}

/** What they are holding right now, in one line each, for the screen. */
export function watchingSays(s: GameState): string[] {
  const out: string[] = [];
  for (const h of s.hunters) {
    if (h.onLook) out.push(`${h.name}: בודקת כל דבר ש${LOOK_NAME[h.onLook]}.`);
    if (h.onKind) out.push(`${h.name}: שם עין על כל ה${KIND_NAME[h.onKind]} בארץ.`);
    if (!h.onLook && !h.onKind) out.push(`${h.name}: ${h.style}`);
  }
  return out;
}

/**
 * How close each of them is to catching on, as a share of the way there.
 *
 * Shown as a bar before it locks, so being caught out is never a surprise: the
 * player can watch himself becoming predictable and change tack in time.
 */
export function closeness(h: Hunter): { look: Look | null; kind: PlaceKind | null; at: number } {
  let look: Look | null = null;
  let kind: PlaceKind | null = null;
  let top = 0;
  for (const [k, n] of Object.entries(h.looks) as Array<[Look, number]>) {
    if (n > top) { top = n; look = k; kind = null; }
  }
  for (const [k, n] of Object.entries(h.kinds) as Array<[PlaceKind, number]>) {
    if (n > top) { top = n; kind = k; look = null; }
  }
  return { look, kind, at: Math.min(1, top / SURE) };
}
