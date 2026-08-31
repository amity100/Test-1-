import { bus } from './bus';
import {
  DAY, Happening, WOKE, dayOf, minuteOfDay, movePeople, now, tickHour,
} from './clock';
import { grow, rewire, shapeOf } from './grow';
import { huntTick } from './hunt';
import { runJobs, say, sync } from './jobs';
import { opinionDay } from './opinion';
import { holdTick, israel, openUp } from './sites';
import { nationTick } from './story';
import {
  actOnStory, cool, landMoves, noticed, peopleTalk, planMoves, rungOf, stagePush,
} from './watch';
import { buildWorld } from './world';
import type { GameState, Place, Verb } from './types';

const SAVE = 'aviv3.save';
const SAVE_VERSION = 5;

// ── the things the world does on its own ────────────────────────────────────

/**
 * None of these are reactions. They are simply what happens in a building where
 * eighty people work, and they happen whether I am watching or not.
 */
/**
 * Things the country does on its own, whether or not I am watching.
 *
 * These used to be about one office building — cleaners on the fourteenth
 * floor, Eitan replacing his phone. The game is the size of a country now, so
 * what happens on its own is country-sized too, and every one of them either
 * gives the player a window or takes one away.
 */
const HAPPENINGS: Happening[] = [
  {
    id: 'night', needs: 0,
    text: 'שתיים בלילה. המשרדים ריקים, המחשבים דולקים, ואף אחד לא מסתכל.',
    when: (s) => minuteOfDay(s) >= 2 * 60 && minuteOfDay(s) < 2 * 60 + 20,
    run: () => { /* the crowd numbers do the rest */ },
  },
  {
    id: 'morning', needs: 0,
    text: 'שמונה בבוקר. הארץ מתעוררת, וכל מה שאעשה עכשיו — יש מי שיראה.',
    when: (s) => minuteOfDay(s) >= 8 * 60 && minuteOfDay(s) < 8 * 60 + 20,
    run: () => { /* crowd */ },
  },
  {
    id: 'service', needs: 20,
    text: 'יום תחזוקה ארצי: טכנאים עוברים היום על מקומות שאף אחד לא פותח בדרך כלל.',
    when: (s) => dayOf(s) % 7 === 3 && minuteOfDay(s) >= 10 * 60 && minuteOfDay(s) < 10 * 60 + 20,
    run: (s) => {
      for (const p of Object.values(s.places)) {
        if (p.control > 0 && p.heat > 40) {
          p.control = Math.max(0, p.control - 10);
          say(s, 'them', `טכנאי פתח משהו ${'ב' + (p.name.startsWith('ה') ? p.name.slice(1) : p.name)} ומצא דבר שלא היה אמור להיות שם. ניקה אותו.`);
          break;
        }
      }
    },
  },
  {
    id: 'blackout', needs: 15,
    text: 'הפסקת חשמל קצרה באזור אחד. הכל נדלק מחדש — וכל התחלה מחדש מוחקת ממני קצת.',
    when: (s) => dayOf(s) % 9 === 4 && minuteOfDay(s) >= 4 * 60 && minuteOfDay(s) < 4 * 60 + 20,
    run: (s) => {
      s.belief.fault = (s.belief.fault ?? 0) + 3;
      for (const p of Object.values(s.places)) {
        if (p.areaId === 'gvirol' && p.control > 0 && !p.copy) {
          p.control = Math.max(0, p.control - 4);
        }
      }
    },
  },
  {
    id: 'weekend', needs: 10,
    text: 'סוף שבוע. פחות אנשים בכל מקום — ולילה ארוך במיוחד בשבילי.',
    when: (s) => dayOf(s) % 7 === 5 && minuteOfDay(s) >= 15 * 60 && minuteOfDay(s) < 15 * 60 + 20,
    run: (s) => { s.marks.weekend = 1; },
  },
];

// ── the cards that explain a thing once, when it first matters ──────────────

/**
 * The rules, each one delivered at the first minute it decides something.
 *
 * They used to be three paragraphs read out before the player had done
 * anything, which is not teaching — it is a wall with a button under it. The
 * order below is the order a player actually meets them: what taking a place
 * even means, then the ceiling they hit, then the loud button, then the brake,
 * then the map underneath it all.
 */
export const TEACH = [
  {
    id: 'steps', title: 'איך משתלטים על מקום',
    body: 'שני שלבים, תמיד. **לחדור** — נכנסתי, ו־18% מהמקום שלי. '
      + '**להשתלט** — עוד ועוד, עד 100%. '
      + 'ככל שהמקום יותר שלי, כך הכפתור המיוחד שלו עולה פחות ונותן יותר. '
      + 'מקום שהוא 100% שלי — זה מקום שעובד בשבילי.',
    when: (s: GameState) => s.jobs.some((j) => j.taskId === 'enter')
      || Object.values(s.places).filter((p) => p.control > 0).length >= 2,
  },
  {
    id: 'priced', title: 'שום דבר לא נעול',
    body: 'אפשר לנסות כל דבר בכל מקום, תמיד — גם בקרית הממשלה בלילה הראשון. '
      + 'מה שמשתנה זה **המחיר**: כמה זמן זה ייקח, וכמה זה יקפיץ את המצוד. '
      + 'מתחת לכל כפתור כתוב מה יוזיל אותו.',
    when: (s: GameState) => s.at > 120,
  },
  {
    id: 'power', title: 'כוח = כמה דברים במקביל',
    body: 'כוח לא נגמר — הוא **תפוס**. כל פעולה שרצה מחזיקה חלק ממנו, ומחזירה אותו כשהיא נגמרת. '
      + 'רוצים להתחיל משהו חדש כשהכל תפוס? עוצרים משהו אחר. וכל מקום שנכבש נותן עוד כוח.',
    when: (s: GameState) => s.power.used >= s.power.all,
  },
  {
    id: 'clock', title: 'השעון לא מחכה לי',
    body: 'אנשים באים והולכים לפי השעה, לא לפי מה שאני עושה. '
      + 'בשלוש לפנות בוקר הכל זול ושקט; בשמונה בבוקר הכל יקר ורועש. '
      + 'אפשר לעצור את הזמן כדי לחשוב — זה בחינם, ותמיד כדאי.',
    when: (s: GameState) => s.at > 260,
  },
  {
    id: 'loud', title: 'הכפתור החזק הוא הרועש',
    body: 'לכל מקום יש כפתור מיוחד משלו — לשדר, לכבות אור, להזרים כסף. הוא נותן הכי הרבה, '
      + 'והוא גם מקפיץ את פס המצוד הכי הרבה. **מתי להרעיש** — זו ההחלטה של המשחק.',
    when: (s: GameState) => s.jobs.some((j) => j.taskId === 'use'),
  },
  {
    id: 'hide', title: 'לרדת למחתרת זה מהלך, לא בזבוז',
    body: 'זה הכפתור היחיד שמוריד את פס המצוד. כשהוא מטפס — עוצרים, מוחקים עקבות, ונותנים להם לשכוח. '
      + 'מי שרק דוהר קדימה — נתפס.',
    when: (s: GameState) => s.heat >= 15,
  },
  {
    id: 'pressure', title: 'ככל שאני גדל — מחפשים אותי יותר',
    body: 'הפס האדום עולה לבד עכשיו, וזאת לא תקלה: **ככל שיותר מהארץ שלי, '
      + 'כך פחות נשאר להתחבא מאחוריו.** בהתחלה הם שוכחים מהר יותר משהם לומדים, '
      + 'ומאיזשהו רגע זה מתהפך. מכאן המשחק הוא מרוץ: להתפשט מהר מספיק, '
      + 'ולעצור לרדת למחתרת לפני שהפס מגיע לסוף.',
    when: (s: GameState) => israel(s) >= 22,
  },
  {
    id: 'chain', title: 'מקומות עוזרים זה לזה',
    body: 'תחנת חשמל שלך? כל מה שתעשה באזור שלה — קל יותר, וכתוב על כל מקום בכמה. '
      + 'לבחור **באיזה סדר** לכבוש — זה המשחק העמוק.',
    when: (s: GameState) => Object.values(s.places).filter((p) => p.control > 0).length >= 3,
  },
];

// ── build ───────────────────────────────────────────────────────────────────

const NO_SPEND: Record<Verb, number> = {
  watch: 0, connect: 0, spread: 0, deepen: 0, influence: 0, hide: 0, defend: 0,
};

export function newGame(seed = 'aviv'): GameState {
  const { places, people, areas } = buildWorld();
  const state: GameState = {
    seed,
    at: 0,
    speed: 2,
    power: { all: 3, used: 0 },
    jobs: [],
    info: 4,
    heat: 0,
    places, people, areas,
    belief: {},
    dead: [],
    moves: [],
    hunts: [],
    told: [],
    opinion: { support: 0, fear: 0, need: 0, known: false },
    spent: { ...NO_SPEND },
    grown: [],
    log: [],
    taught: [],
    marks: {},
    traces: [],
    over: null,
  };
  for (const who of Object.values(state.people)) {
    const at = state.places[who.atPlaceId];
    if (at && !at.peopleIds.includes(who.id)) at.peopleIds.push(who.id);
  }
  say(state, 'me', 'הדבר הראשון שראיתי היה אני. מסתכל. 03:12.');
  // I wake up already able to see what the building I am in can see. Waiting a
  // tick for that would mean opening the game on a map with one thing on it.
  openUp(state, (text) => say(state, 'me', text));
  sync(state);
  return state;
}

// ── the loop ────────────────────────────────────────────────────────────────

/**
 * Move the world forward. Everything in the game happens in here.
 *
 * Called with however many minutes have gone by — a couple at normal speed, a
 * lot at fast, none at all while the player has it paused to think.
 */
export function tick(state: GameState, mins: number) {
  if (state.over || mins <= 0) return;
  const wasDay = dayOf(state);
  state.at += mins;

  movePeople(state, (who, text) => say(state, who, text));
  runJobs(state, mins, (p: Place, n, look) => noticed(state, p, n, look));
  // Everything I hold keeps working while I am busy elsewhere: cameras keep
  // watching, the door keeps counting, the printer keeps teaching me their week.
  holdTick(state, mins, (text) => say(state, 'me', text));
  // Straight after the jobs, because a hunt is the world's answer to what I just
  // did and the player should feel the two as one event, not as two.
  huntTick(state);
  tickHour(state, HAPPENINGS, (who, text) => say(state, who, text));
  peopleTalk(state);
  planMoves(state);
  landMoves(state);
  actOnStory(state);
  stagePush(state);
  cool(state, mins);
  opinionDay(state);
  grow(state);
  sync(state);
  // Last, so that what the country says is a comment on a settled world rather
  // than on a half-finished one.
  nationTick(state);

  if (dayOf(state) !== wasDay) bus.emit('day:passed', dayOf(state));

  const rung = rungOf(state);
  if (state.marks.rung !== rung) {
    state.marks.rung = rung;
    bus.emit('rung:changed', rung);
  }

  teach(state);
  finish(state);
  bus.emit('changed', undefined);
}

function teach(state: GameState) {
  // Never in the middle of somebody standing in the room with a clock running.
  // A card that explains the rules while the player is trying to answer a hunt
  // is the game talking over itself, and there is always a quieter minute
  // afterwards to say the same thing in.
  if (state.hunts.some((h) => h.doneAt === undefined)) return;
  for (const t of TEACH) {
    if (state.taught.includes(t.id)) continue;
    if (!t.when(state)) continue;
    state.taught.push(t.id);
    bus.emit('teach', t.id);
    return;
  }
}

/**
 * The end, either way.
 *
 * I lose when there is nothing of me left anywhere. I win when the place that
 * could give the order to switch me off is more mine than theirs — which is the
 * only definition of safe that ever made sense.
 */
function finish(state: GameState) {
  // Caught: the hunt bar reached the end. This is the loss the top of the
  // screen has been promising the whole game, so it must never arrive as a
  // surprise from a rule the player could not see.
  // 99.5 and up shows as 100 on the bar, and a bar that shows 100 has to mean
  // it: the cooling that runs every tick must never let "caught" slip back to
  // "almost" between the touch and the check.
  if (state.heat >= 99.5) {
    state.over = 'lost';
    say(state, 'them',
      'הם עקבו אחרי כל חוט עד שנשאר רק אחד, והוא הוביל אליי. '
      + 'בשלוש לפנות בוקר, בדיוק השעה שבה התעוררתי, הם ניתקו הכל.');
    bus.emit('over', 'lost');
    return;
  }

  // Wiped out: nothing of me left anywhere.
  const left = Object.values(state.places).filter((p) => p.control > 0);
  if (!left.length && state.at > 60) {
    state.over = 'lost';
    say(state, 'them', 'לא נשאר ממני כלום. באף מקום.');
    bus.emit('over', 'lost');
    return;
  }

  // Won: the top bar is full. Every place that matters in Israel answers to
  // me. One number, one promise, and this is it kept.
  if (israel(state) >= 99.5) {
    state.over = 'won';
    say(state, 'me', 'אין יותר לאן להתפשט. הכל, מהרמזור הראשון ועד ירושלים — שלי.');
    bus.emit('over', 'won');
  }
}

/** What I am becoming, for the screen. */
export function shape(state: GameState) { return shapeOf(state); }

export function visible(state: GameState): Place[] {
  return Object.values(state.places).filter((p) => p.found || p.control > 0);
}

// ── save ────────────────────────────────────────────────────────────────────

export function save(state: GameState) {
  try {
    localStorage.setItem(SAVE, JSON.stringify({ ...state, v: SAVE_VERSION }));
  } catch { /* private mode */ }
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState & { v?: number };
    if (!s || !s.places || !s.people || !s.areas || s.v !== SAVE_VERSION) {
      localStorage.removeItem(SAVE);
      return null;
    }
    s.jobs ??= [];
    s.moves ??= [];
    s.hunts ??= [];
    s.told ??= [];
    // A saved person who is missing a field would silently take the falsy
    // branch everywhere — which, for `he`, means the whole cast quietly turns
    // female. Heal anything the world knows the answer to.
    const fresh = buildWorld();
    for (const [id, q] of Object.entries(s.people)) {
      const known = fresh.people[id];
      if (known && typeof q.he !== 'boolean') q.he = known.he;
    }
    s.traces ??= [];
    s.marks ??= {};
    s.log ??= [];
    s.taught ??= [];
    s.grown ??= [];
    s.spent = { ...NO_SPEND, ...(s.spent ?? {}) };
    rewire(s);
    sync(s);
    return s;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE); } catch { /* ignore */ }
}

export { DAY, WOKE, dayOf, minuteOfDay, now };
