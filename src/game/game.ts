import { bus } from './bus';
import {
  DAY, Happening, WOKE, dayOf, minuteOfDay, movePeople, now, tickHour,
} from './clock';
import { grow, rewire, shapeOf } from './grow';
import { huntTick } from './hunt';
import { runJobs, say, sync } from './jobs';
import { opinionDay } from './opinion';
import { standingTick } from './standing';
import { nationTick } from './story';
import {
  actOnStory, cool, landMoves, noticed, peopleTalk, planMoves, rungOf,
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
const HAPPENINGS: Happening[] = [
  {
    id: 'cleaners', needs: 10,
    text: 'המנקים נכנסו. הם לא מסתכלים על מסכים, אבל הם מדליקים כל אור בקומה.',
    when: (s) => minuteOfDay(s) >= 5 * 60 + 50 && minuteOfDay(s) < 6 * 60 + 10,
    run: () => { /* the crowd numbers do the rest */ },
  },
  {
    id: 'morning', needs: 0,
    text: 'הקומות מתמלאות.',
    when: (s) => minuteOfDay(s) >= 8 * 60 && minuteOfDay(s) < 8 * 60 + 20,
    run: () => { /* crowd */ },
  },
  {
    id: 'tech', needs: 25,
    text: 'רון עלה לבניין לביקורת שבועית. הוא פותח ארונות שאף אחד לא פותח.',
    when: (s) => dayOf(s) % 7 === 3 && minuteOfDay(s) >= 10 * 60 && minuteOfDay(s) < 10 * 60 + 20,
    run: (s) => {
      for (const p of Object.values(s.places)) {
        if (p.buildingId !== 'helios') continue;
        if (p.control > 0 && p.heat > 40) {
          p.control = Math.max(0, p.control - 12);
          say(s, 'them', `רון פתח את ${p.name} וסידר שם משהו. חלק ממני נעלם.`);
        }
      }
    },
  },
  {
    id: 'audit', needs: 40,
    text: 'עוברים היום על רשימת הכניסות של החודש. שורה־שורה.',
    when: (s) => dayOf(s) % 14 === 6 && minuteOfDay(s) >= 11 * 60 && minuteOfDay(s) < 11 * 60 + 20,
    run: (s) => {
      const borrowed = s.traces.filter((t) => t.startsWith('name_'));
      if (!borrowed.length) return;
      s.heat = Math.min(100, s.heat + 8);
      s.traces = s.traces.filter((t) => !t.startsWith('name_'));
      say(s, 'them', 'מצאו כניסות בשעות מוזרות בשם של מישהי שישנה אז. עכשיו הם שואלים אותה.');
    },
  },
  {
    id: 'outage', needs: 20,
    text: 'החשמל ברחוב קפץ לרגע. כל הבניין נדלק מחדש.',
    when: (s) => dayOf(s) % 9 === 4 && minuteOfDay(s) >= 4 * 60 && minuteOfDay(s) < 4 * 60 + 20,
    run: (s) => {
      s.belief.fault = (s.belief.fault ?? 0) + 3;
      for (const p of Object.values(s.places)) {
        if (p.buildingId === 'helios' && p.control > 0 && !p.copy) {
          p.control = Math.max(0, p.control - 4);
        }
      }
    },
  },
  {
    id: 'late', needs: 15,
    text: 'מישהו נשאר לישון במשרד. הקומה לא תהיה ריקה הלילה.',
    when: (s) => dayOf(s) % 5 === 2 && minuteOfDay(s) >= 23 * 60,
    run: (s) => { s.marks.somebody_stayed = 1; },
  },
  {
    id: 'newphone', needs: 30,
    text: 'איתן החליף טלפון. מה שהיה לי בישן — נשאר בישן.',
    when: (s) => dayOf(s) === 11 && minuteOfDay(s) >= 9 * 60 && minuteOfDay(s) < 9 * 60 + 20,
    run: (s) => {
      const p = s.places.eitan_phone;
      if (p && p.control > 0) { p.control = 0; bus.emit('place:lost', p.id); }
    },
  },
  {
    id: 'camfix', needs: 20,
    text: 'באו לתקן את המצלמה בלובי. היא הייתה שבורה חודשיים.',
    when: (s) => dayOf(s) === 8 && minuteOfDay(s) >= 13 * 60 && minuteOfDay(s) < 13 * 60 + 20,
    run: (s) => { const p = s.places.lobby_cam; if (p) p.guard += 10; },
  },
];

// ── the cards that explain a thing once, when it first matters ──────────────

export const TEACH = [
  {
    id: 'power', title: 'כוח זה לא כסף',
    body: 'כוח לא מתבזבז — הוא **תפוס**. כל דבר שאני מפעיל מחזיק חלק ממנו כל עוד הוא רץ, '
      + 'ומשחרר אותו ברגע שאני עוצר. אז השאלה אף פעם לא "האם אני יכול", אלא **"מה אני מפסיק"**.',
    when: (s: GameState) => s.power.used >= s.power.all,
  },
  {
    id: 'price', title: 'שום דבר לא נעול',
    body: 'כל דבר אפשר לעשות תמיד. מה שמשתנה זה **המחיר**: כמה זמן, כמה כוח, וכמה יראו. '
      + 'מתחת לכל בחירה כתוב מה יוזיל אותה — לחכות שמישהו ילך, להסתכל קודם, לחכות ללילה.',
    when: (s: GameState) => s.jobs.length >= 1,
  },
  {
    id: 'clock', title: 'השעון לא מחכה לי',
    body: 'אנשים נכנסים ויוצאים לפי השעה, לא לפי מה שאני עושה. אפשר לעצור את הזמן כדי לחשוב — '
      + 'זה בחינם — אבל כשהוא רץ, הוא רץ גם בשבילם.',
    when: (s: GameState) => s.at > 120,
  },
  {
    id: 'heat', title: 'הם מנסים להסביר',
    body: 'הם לא סופרים רעש. הם מנסים **להסביר** מה קרה, ומאמינים להסבר הראשון שמסתדר. '
      + 'משהו שנראה כמו תקלת חשמל כמעט לא מקרב אותם אליי. משהו שאין לו שום הסבר — מקרב מיד.',
    when: (s: GameState) => s.heat >= 8,
  },
  {
    id: 'moves', title: 'הם מתכננים מראש',
    body: 'כשאני יודע מספיק, אני רואה מה הם עומדים לעשות **לפני** שהם עושים את זה. '
      + 'זה הזמן להסתתר, להיתפס חזק יותר, או פשוט לצאת משם.',
    when: (s: GameState) => s.moves.length > 0,
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
  standingTick(state, mins);
  // Straight after the jobs, because a hunt is the world's answer to what I just
  // did and the player should feel the two as one event, not as two.
  huntTick(state);
  tickHour(state, HAPPENINGS, (who, text) => say(state, who, text));
  peopleTalk(state);
  planMoves(state);
  landMoves(state);
  actOnStory(state);
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
  const left = Object.values(state.places).filter((p) => p.control > 0);
  if (!left.length && state.at > 60) {
    state.over = 'lost';
    say(state, 'them', 'לא נשאר ממני כלום באף מקום.');
    bus.emit('over', 'lost');
    return;
  }
  const govt = state.areas.govt;
  if (govt && govt.control >= 60) {
    state.over = 'won';
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
