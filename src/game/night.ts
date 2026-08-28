import type { GameState, Person } from './types';

/**
 * The night is the whole budget.
 *
 * It is 03:12 when you wake up and the building is nearly empty. At six the
 * cleaners come in. At half past seven the floor fills. At eight the night is
 * over, and whatever you have not done, you have not done.
 *
 * Nothing here is a turn limit. You may do as many things as you like — but
 * everything takes the time it really takes, and waiting for somebody to get up
 * and walk away costs a great deal more than reading what is on their screen.
 * That is where the strategy is: not in how many things, in which things.
 */

/** Minutes past midnight. */
export const NIGHT_START = 3 * 60 + 12;   // 03:12
export const NIGHT_END = 8 * 60;          // 08:00
export const NIGHT_LENGTH = NIGHT_END - NIGHT_START;

export function clock(minutes: number): string {
  const m = Math.max(0, Math.round(minutes)) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function left(state: GameState): number {
  return Math.max(0, NIGHT_END - state.at);
}

/** One line about what the hour means, for the strip along the top. */
export function hourSays(state: GameState): string {
  const m = state.at;
  if (m < 4 * 60) return 'הבניין ריק כמעט לגמרי.';
  if (m < 5 * 60) return 'השעה הכי שקטה בלילה.';
  if (m < 6 * 60) return 'עוד מעט מתחילים להגיע.';
  if (m < 7 * 60) return 'המנקים בבניין.';
  if (m < 7 * 60 + 30) return 'הראשונים מגיעים לעבודה.';
  return 'הקומה מתמלאת. כל דבר כאן ייראה.';
}

// ── who is in the building at this hour ─────────────────────────────────────

/**
 * The night shift, hour by hour. This is the timetable the whole game plays
 * against: the same thing done at twenty past three and at twenty to eight is
 * two completely different decisions.
 */
interface Shift {
  /** Who, and where they sit, between these two times. */
  who: string;
  at: string;
  from: number;
  until: number;
}

const SHIFTS: Shift[] = [
  { who: 'dana', at: 'dana_pc', from: 0, until: 5 * 60 + 40 },
  { who: 'eitan', at: 'lobby_cam', from: 0, until: 7 * 60 },
  { who: 'michal', at: 'michal_pc', from: 0, until: 4 * 60 + 20 },
  { who: 'ron', at: 'ron_car', from: 0, until: 24 * 60 },
];

/** Anyone whose own hours have ended goes home, wherever the game left them. */
export function tickShifts(state: GameState) {
  for (const s of SHIFTS) {
    const who = state.people[s.who];
    if (!who || who.gone) continue;
    if (state.at < s.until || state.at < s.from) continue;
    who.gone = true;
    const at = state.places[who.atPlaceId];
    if (at) at.peopleIds = at.peopleIds.filter((id) => id !== who.id);
    who.atPlaceId = 'gone';
    state.log.unshift({
      id: `l${state.log.length}`, day: state.night, who: 'world',
      text: `${who.name} אסף/ה את הדברים והלך/ה. ${clock(state.at)}.`,
    });
  }
}

/**
 * How many people are close enough to see something happen here, right now.
 * At three in the morning the answer is nearly always nought; at half past
 * seven it is never nought.
 */
export function crowd(state: GameState, floor: number, buildingId: string): number {
  let n = 0;
  for (const p of Object.values(state.people)) {
    if (p.gone) continue;
    const at = state.places[p.atPlaceId];
    if (at && at.buildingId === buildingId && at.floor === floor) n += 1;
  }
  // And everybody who is not in the game by name but is in the building anyway.
  n += background(state, buildingId, floor);
  return n;
}

/** The people who have no names: cleaners, early risers, the seven o'clock crowd. */
export function background(state: GameState, buildingId: string, floor: number): number {
  if (buildingId === 'street') return state.at >= 6 * 60 ? 1 : 0;
  const m = state.at;
  if (m < 6 * 60) return 0;
  if (m < 7 * 60) return floor === 0 || floor === -1 ? 1 : 0;      // the cleaners, downstairs
  if (m < 7 * 60 + 30) return floor >= 0 && floor % 3 === 2 ? 1 : 0;
  return floor >= 0 ? 2 + (floor % 3) : 1;                          // the floor fills
}

/** True when there is nobody left who could see it. */
export function alone(state: GameState, buildingId: string, floor: number): boolean {
  return crowd(state, floor, buildingId) === 0;
}

export function isMorning(state: GameState): boolean {
  return state.at >= NIGHT_END;
}

/** Spend time. Returns false if the night ran out doing it. */
export function spend(state: GameState, minutes: number): boolean {
  state.at += minutes;
  tickShifts(state);
  return state.at < NIGHT_END;
}
