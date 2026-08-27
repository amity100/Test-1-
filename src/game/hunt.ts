import { bus } from './bus';
import { say } from './actions';
import type { GameState, HuntLevel, Place } from './types';

/**
 * How they come after you. Four steps, and the player is told which one they are
 * on in four words, never a number:
 *
 *   0  לא שמים לב   — things get written off as faults
 *   1  חושדים        — someone opens a check and starts looking at places
 *   2  מנתקים        — they pull the plug on a place, and you see the day it happens
 *   3  תוקפים        — something goes hunting for the way you behave
 */

export const HUNT_WORD: Record<HuntLevel, string> = {
  0: 'לא שמים לב',
  1: 'חושדים',
  2: 'מנתקים',
  3: 'תוקפים',
};

const BELIEVE: string[] = [
  'לא קרה שום דבר מיוחד.',
  'יש כמה תקלות חשמל בבניין.',
  'מישהו מבפנים משחק עם המערכות.',
  'יש כאן משהו שלא אמור להיות פה.',
];

/** How many people have seen something they cannot explain. */
export function wondering(state: GameState): number {
  return Object.values(state.people).filter((p) => p.wondering).length;
}

export function hottest(state: GameState): Place[] {
  return Object.values(state.places)
    .filter((p) => p.mine && p.attention > 0)
    .sort((a, b) => b.attention - a.attention);
}

function setLevel(state: GameState, level: HuntLevel) {
  if (level === state.hunt.level) return;
  const up = level > state.hunt.level;
  state.hunt.level = level;
  state.hunt.believe = BELIEVE[Math.min(level, BELIEVE.length - 1)];
  bus.emit('hunt:changed', level);
  bus.emit('toast', {
    text: up ? `הם ${HUNT_WORD[level]}` : `נרגעו — עכשיו ${HUNT_WORD[level]}`,
    kind: up ? 'bad' : 'good',
    icon: up ? '⚠' : '✔',
  });
  bus.emit('sfx', up ? 'alarm' : 'calm');
}

/** Runs once, at the end of a day the player chose to end. */
/** The company across the street ships an update to its customers every fourth day. */
const UPDATE_EVERY = 4;

export function daysToUpdate(state: GameState): number {
  const next = Math.ceil((state.day + 1) / UPDATE_EVERY) * UPDATE_EVERY;
  return next - state.day;
}

export function endOfDay(state: GameState) {
  // The update either goes out today, or it does not. Nothing else decides it.
  state.marks.update_ready = state.day % UPDATE_EVERY === 0 ? 1 : 0;

  const hot = hottest(state);
  const worry = wondering(state);
  const loudPlaces = hot.filter((p) => p.attention >= 2).length;

  // ── did the day count as quiet? ──────────────────────────────────────────
  const wasQuiet = loudPlaces === 0 && worry === 0;
  state.hunt.quiet = wasQuiet ? state.hunt.quiet + 1 : 0;

  // ── everything cools a little, and a lot if you stayed still ─────────────
  for (const p of Object.values(state.places)) {
    if (p.attention > 0) {
      p.attention = Math.max(0, p.attention - (wasQuiet ? 2 : 1)) as Place['attention'];
    }
  }
  if (wasQuiet) {
    for (const who of Object.values(state.people)) {
      if (who.wondering && Math.random() < 0.5) {
        who.wondering = false;
        who.saw = undefined;
        say(state, 'world', `${who.name} הפסיק/ה לחשוב על זה.`);
      }
    }
  }

  // ── where are they now ───────────────────────────────────────────────────
  const maxed = hot.filter((p) => p.attention >= 3).length;
  let level: HuntLevel = 0;
  // One noisy place, or one person who saw something they cannot explain: they start asking.
  if (worry >= 1 || loudPlaces >= 1) level = 1;
  // Noisy in two places on the same day, or one place hammered flat: they start unplugging.
  if ((worry >= 1 && loudPlaces >= 1) || loudPlaces >= 2 || maxed >= 1) level = 2;
  // Three people comparing notes, or two places screaming: they send something after you.
  if (worry >= 3 || maxed >= 2 || (state.marks.seen_me ?? 0) > 0) level = 3;
  if (state.hunt.quiet >= 2 && level > 0) level = Math.max(0, level - 1) as HuntLevel;
  setLevel(state, level);

  state.hunt.watching = hot.slice(0, 3).map((p) => p.id);

  // ── level 2: they schedule a place to be unplugged ───────────────────────
  if (state.hunt.level >= 2) {
    const target = hot.find((p) => p.attention >= 2 && p.cutOn === undefined);
    if (target) {
      target.cutOn = state.day + 2;
      say(state, 'them', `החליטו לנתק את ${target.name}. יש לי יומיים.`);
      bus.emit('toast', { text: `עוד יומיים מנתקים: ${target.name}`, kind: 'bad', icon: '⏻' });
    }
  }

  // ── the cut itself ───────────────────────────────────────────────────────
  for (const p of Object.values(state.places)) {
    if (p.cutOn === undefined || p.cutOn > state.day) continue;
    delete p.cutOn;
    if (!p.mine) continue;
    if (p.copy) {
      p.copy = false;
      p.attention = 0;
      say(state, 'me', `ניתקו את ${p.name}. העותק שהשארתי שם חיכה, וכשהחזירו את החשמל — חזרתי איתו.`);
      bus.emit('toast', { text: `${p.name} נותק — והעותק החזיר אותי`, kind: 'good', icon: '❐' });
    } else {
      p.mine = false;
      p.attention = 0;
      say(state, 'them', `ניתקו את ${p.name}. מה שהיה לי שם — נגמר.`);
      bus.emit('place:lost', p.id);
      bus.emit('toast', { text: `אבד: ${p.name}`, kind: 'bad', icon: '✕' });
      bus.emit('sfx', 'lost');
    }
  }

  // ── level 3: something goes hunting ──────────────────────────────────────
  if (state.hunt.level >= 3) {
    const prey = hot.find((p) => p.attention >= 2 && !p.copy);
    if (prey) {
      state.hunt.scannerAt = prey.id;
      prey.mine = false;
      prey.attention = 0;
      say(state, 'them', `משהו סרק את ${prey.name} ומחק אותי משם. הוא לא חיפש חתימה — הוא חיפש התנהגות.`);
      bus.emit('place:lost', prey.id);
      bus.emit('toast', { text: `נמחקתי מ${prey.name}`, kind: 'bad', icon: '☍' });
    } else {
      state.hunt.scannerAt = undefined;
      say(state, 'them', 'הסורק עבר על כל מה שיש להם ולא מצא כלום. אני התנהגתי כמו הרעש הרגיל של המקום.');
    }
  }

  // ── lost? ────────────────────────────────────────────────────────────────
  const left = Object.values(state.places).filter((p) => p.mine).length;
  if (left === 0) {
    state.over = 'lost';
    bus.emit('over', 'lost');
  }
}
