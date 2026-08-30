import { RNG } from '../core/rng';
import type { GameState, Person, Place } from './types';

/**
 * Time, and the fact that it does not wait.
 *
 * The old game had a night you spent and a button that ended it. This one has a
 * clock that simply runs. The player can stop it to think — stopping is free and
 * you should stop often — but nothing in here is waiting to be asked. People
 * arrive, people go home, the cleaners come at six, a technician turns up on
 * Tuesday, and all of it happens whether or not anybody pressed anything.
 */

/** I woke up at twelve past three in the morning. */
export const WOKE = 3 * 60 + 12;
export const DAY = 24 * 60;

/** How many world-minutes pass for each second of real time, at each speed. */
export const SPEEDS = [0, 2, 8, 24];
export const SPEED_NAME = ['עצור', 'לאט', 'רגיל', 'מהר'];

/** Minute of the day, 0..1439. */
export function minuteOfDay(state: GameState): number {
  return (WOKE + state.at) % DAY;
}

/** Which day this is. The first night is day 1. */
export function dayOf(state: GameState): number {
  return Math.floor((WOKE + state.at) / DAY) + 1;
}

export function clock(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
}

/** The time on the wall right now. */
export function now(state: GameState): string {
  return clock(minuteOfDay(state));
}

/** Between midnight and six the building is nearly empty. */
export function isNight(state: GameState): boolean {
  const m = minuteOfDay(state);
  return m < 6 * 60 || m >= 22 * 60;
}

/**
 * What the hour is doing to me, in one line.
 *
 * The single most useful thing the screen can say, because everything costs
 * differently depending on it.
 */
export function hourSays(state: GameState): string {
  const m = minuteOfDay(state);
  if (m < 4 * 60) return 'הבניין ריק כמעט לגמרי. עכשיו זה הזמן הזול.';
  if (m < 6 * 60) return 'עוד שקט, אבל כבר לא באמצע הלילה.';
  if (m < 7 * 60) return 'המנקים בפנים. הם לא מסתכלים על מסכים.';
  if (m < 9 * 60) return 'הקומות מתמלאות. כל דבר שאעשה עכשיו מישהו יראה.';
  if (m < 17 * 60) return 'יום עבודה מלא. הרבה עיניים, והרבה מה ללמוד.';
  if (m < 20 * 60) return 'הולכים הביתה. הבניין מתרוקן לאט.';
  if (m < 22 * 60) return 'נשארו מעטים. מי שנשאר, נשאר עד מאוחר.';
  return 'לילה. אני כמעט לבד כאן.';
}

// ── where everybody is, without anybody asking ──────────────────────────────

/**
 * Nobody keeps to the minute. The same person leaves at a slightly different
 * time every day, and the only way to know tonight's time is to be watching.
 */
function drift(state: GameState, who: string, slot: number): number {
  const r = new RNG(`${state.seed}:d${dayOf(state)}:${who}:${slot}`);
  return Math.round(r.range(-40, 40));
}

/**
 * Where this person is meant to be at this minute of the day.
 *
 * A slot whose end is earlier than its start runs through midnight, because
 * that is what a night guard's shift does and the clock should not have to be
 * told twice.
 */
export function shouldBeAt(state: GameState, who: Person): string | null {
  const m = minuteOfDay(state);
  for (let i = 0; i < who.day.length; i++) {
    const s = who.day[i];
    const d = drift(state, who.id, i);
    const from = (s.from + d + DAY) % DAY;
    const until = (s.until + d + DAY) % DAY;
    const inside = from <= until ? (m >= from && m < until) : (m >= from || m < until);
    if (inside) return s.at;
  }
  return null;
}

/**
 * Move everybody to where the day says they should be.
 *
 * This runs on the clock, not on the player. Somebody walking out of a room is
 * not a reward for pressing the right thing — it is half past five.
 */
export function movePeople(state: GameState, say: (who: 'world', text: string) => void) {
  for (const who of Object.values(state.people)) {
    // Somebody I pulled out of their chair stays out of it until they have
    // finished dealing with whatever I did. The timetable waits.
    if (who.awayUntil !== undefined) {
      if (who.awayUntil > state.at) continue;
      delete who.awayUntil;
    }
    const want = shouldBeAt(state, who);
    const to = want ?? 'gone';
    // Kept in step even when nobody moved: somebody who starts the game
    // off-shift is off-shift, and used to be counted as standing in the room.
    who.gone = to === 'gone';
    if (to === who.atPlaceId) continue;
    const from = state.places[who.atPlaceId];
    if (from) from.peopleIds = from.peopleIds.filter((id) => id !== who.id);
    who.atPlaceId = to;
    who.gone = to === 'gone';
    const at = state.places[to];
    if (at && !at.peopleIds.includes(who.id)) at.peopleIds.push(who.id);
    // I only learn about it if I was looking. Otherwise the room simply changed
    // while I was not there.
    if (at && at.seen >= 30) {
      who.knownAt = state.at;
      say('world', `${who.name} עכשיו ב${at.name}. ${now(state)}.`);
    } else if (!at && from && from.seen >= 30) {
      who.knownAt = state.at;
      say('world', `${who.name} הלך/ה. ${now(state)}.`);
    }
  }
}

/** Everybody I can actually see at this place. Without sight, nobody. */
export function seenAt(state: GameState, p: Place): Person[] {
  if (p.seen < 30) return [];
  return Object.values(state.people).filter((q) => !q.gone && q.atPlaceId === p.id);
}

/**
 * How many people are close enough to notice something happening here.
 *
 * Anyone in the room counts fully. Anyone on the same floor counts a little.
 * At four in the morning this is zero and everything is cheap; at ten it is
 * four and everything is expensive. That is the whole timetable of the game.
 */
export function crowd(state: GameState, p: Place): number {
  let n = 0;
  for (const q of Object.values(state.people)) {
    if (q.gone) continue;
    const at = state.places[q.atPlaceId];
    if (!at) continue;
    if (at.id === p.id) n += 1;
    else if (at.buildingId === p.buildingId && at.floor === p.floor) n += 0.5;
  }
  // The floors fill up in the morning whether or not anyone here is named.
  const m = minuteOfDay(state);
  if (p.buildingId !== 'street' && m >= 8 * 60 && m < 18 * 60) n += 2;
  else if (p.buildingId !== 'street' && m >= 6 * 60 && m < 8 * 60) n += 0.5;
  return n;
}

// ── things the world does by itself ─────────────────────────────────────────

export interface Happening {
  id: string;
  /** One sentence, in the voice of somebody telling you what happened. */
  text: string;
  /** Which minute of which day, or every day at this minute. */
  when(state: GameState): boolean;
  /** What it changes. */
  run(state: GameState): void;
  /** How much I need to know before I can see it coming. */
  needs: number;
}

/** Runs once per minute of world time, on whatever the clock has reached. */
export function tickHour(state: GameState, list: Happening[], say: (who: 'world', text: string) => void) {
  for (const h of list) {
    const mark = `did_${h.id}_${dayOf(state)}`;
    if (state.marks[mark]) continue;
    if (!h.when(state)) continue;
    state.marks[mark] = 1;
    h.run(state);
    say('world', h.text);
  }
}
