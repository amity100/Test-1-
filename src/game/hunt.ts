import { bus } from './bus';
import { say } from './actions';
import { traceDay } from './ways';
import { ACTS, ACT_ON, FOUND_OUT, TRUTH, evidence, howClose, leading, looksAt, nextMove } from './theory';
import { NIGHT_START, clock } from './night';
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



/** How many people have seen something they cannot explain. */
export function wondering(state: GameState): number {
  return Object.values(state.people).filter((p) => p.wondering).length;
}

export function hottest(state: GameState): Place[] {
  return Object.values(state.places)
    .filter((p) => p.mine && p.attention > 0)
    .sort((a, b) => b.attention - a.attention);
}

/** The company across the street ships an update to its customers every fourth day. */
const UPDATE_EVERY = 4;

export function daysToUpdate(state: GameState): number {
  const next = Math.ceil((state.night + 1) / UPDATE_EVERY) * UPDATE_EVERY;
  return next - state.night;
}

/**
 * Morning.
 *
 * They come in, they find what you left, and they try to explain it. Whatever
 * they end up believing decides where they go looking — which means a night
 * spent making your noise look like the wiring is a night that sends them into
 * the basement while you are on the fourteenth floor.
 *
 * Nothing here is free. There is no resting day: every morning they take one
 * more step, whatever you did or did not do.
 */
export function endOfDay(state: GameState) {
  state.marks.update_ready = state.night % UPDATE_EVERY === 0 ? 1 : 0;
  if (state.marks.line_cut) state.marks.line_cut -= 1;
  // Once they have properly started asking, "nobody is asking any more" is a
  // thing you can work towards — and it is not the same as never having been asked.
  if ((state.belief[TRUTH] ?? 0) >= 4) state.marks.was_hunted = 1;
  const said: string[] = [];

  // ── what I left behind me does its work ──────────────────────────────────
  for (const e of traceDay(state)) {
    say(state, e.kind === 'good' ? 'me' : 'world', e.text);
    said.push(e.text);
  }

  // ── people compare notes ─────────────────────────────────────────────────
  //
  // Somebody seeing something is a shock, not a leak: it counts the morning
  // after they saw it, and again only if somebody else has seen something too.
  // One person alone with a story nobody shares talks themselves out of it.
  const worried = Object.values(state.people).filter((p) => p.wondering);
  const fresh = worried.filter((p) => p.sawOn === state.night);
  if (worried.length >= 2) {
    evidence(state, 'wrong', worried.length - 1);
    say(state, 'them', `${worried.map((p) => p.name).join(' ו')} דיברו ביניהם הבוקר, וגילו ששניהם ראו משהו.`);
  } else if (fresh.length) {
    evidence(state, 'wrong', 1);
    say(state, 'them', `${fresh[0].name} סיפר/ה למישהו מה ראה/תה אתמול בלילה.`);
  }
  // A place that has been hammered flat explains itself to nobody — but it only
  // counts the first time. A thing that is already strange does not get stranger
  // every morning on its own; something new has to happen.
  for (const p of Object.values(state.places)) {
    if (p.mine && p.attention >= 3 && !p.screamed) {
      p.screamed = true;
      evidence(state, 'wrong', 1);
      say(state, 'them', `${p.name} כבר לא נראה להם כמו תקלה. הם פשוט לא יודעים מה זה.`);
    }
    if (p.attention <= 1) p.screamed = false;
  }

  // ── a story they believe enough gets acted on, and then it is spent ──────
  //
  // This is the sharpest edge in the game. Making everything look like the
  // wiring works beautifully — until the morning they actually rewire the
  // building, and every room you were living in through the wiring is gone.
  for (const [id, act] of Object.entries(ACTS)) {
    if (state.dead.includes(id)) continue;
    const w = state.belief[id] ?? 0;
    const spent = state.marks[`spent_${id}`] ?? 0;
    if (w < ACT_ON + spent * 4) continue;
    state.marks[`spent_${id}`] = spent + 1;
    state.belief[id] = Math.round(w * 0.35);
    say(state, 'them', act.text);
    bus.emit('toast', { text: act.text, kind: 'bad', icon: '⚒' });
    for (const pid of act.loses) {
      const p = state.places[pid];
      if (!p?.mine) continue;
      if (p.copy) { p.copy = false; say(state, 'me', `${p.name} הוחלף — והעותק החזיר אותי.`); continue; }
      p.mine = false;
      p.attention = 0;
      say(state, 'me', `${p.name} כבר לא שלי. החליפו את מה שישבתי בתוכו.`);
      bus.emit('place:lost', pid);
    }
    state.traces = state.traces.filter((t) => !act.clears.includes(t));
    // Cutting the building off from the street is a thing I can be caught
    // inside: anything that happens while the line is down cannot have come
    // from outside, and they will know it.
    if (id === 'outside') state.marks.line_cut = 2;
    // And a fix that does not fix anything makes them wonder about the fix.
    evidence(state, 'wrong', 1);
  }

  // ── they act on whatever they now believe ────────────────────────────────
  const theory = leading(state);
  const where = looksAt(state);
  const truth = theory.id === TRUTH;
  const checked = where.map((id) => state.places[id]).filter(Boolean).slice(0, 2);
  for (const p of checked) {
    if (truth && p.mine) {
      // They are looking for me, in the right place.
      if (p.copy) {
        p.copy = false;
        p.attention = 0;
        say(state, 'me', `נכנסו ל${p.name} וניתקו אותו. העותק חיכה, וכשהחזירו — חזרתי.`);
      } else {
        p.mine = false;
        p.attention = 0;
        say(state, 'them', `${p.name} — נותק. ${theory.does}`);
        bus.emit('place:lost', p.id);
        bus.emit('toast', { text: `אבד: ${p.name}`, kind: 'bad', icon: '✕' });
      }
    } else if (p.attention > 0) {
      // Looking in the wrong place, and finding nothing, calms them down there.
      p.attention = 0;
      delete p.cutOn;
      say(state, 'world', `בדקו את ${p.name} ולא מצאו כלום. סגרו את זה.`);
    }
  }

  // Once they are looking for me rather than for an explanation, they name the
  // place they are going to unplug — and I get one night to leave something there.
  if (truth) {
    const target = Object.values(state.places)
      .filter((p) => p.mine && p.cutOn === undefined && !p.copy)
      .sort((a, b) => b.attention - a.attention)[0];
    if (target) {
      target.cutOn = state.night + 1;
      say(state, 'them', `החליטו לנתק את ${target.name}. יש לי לילה אחד.`);
      bus.emit('toast', { text: `מחר מנתקים: ${target.name}`, kind: 'bad', icon: '⏻' });
    }
  }
  for (const p of Object.values(state.places)) {
    if (p.cutOn === undefined || p.cutOn > state.night) continue;
    delete p.cutOn;
    if (!p.mine) continue;
    if (p.copy) {
      p.copy = false;
      p.attention = 0;
      state.marks.survived_cut = (state.marks.survived_cut ?? 0) + 1;
      say(state, 'me', `ניתקו את ${p.name}. העותק חיכה בשקט, וכשהחזירו את החשמל — חזרתי איתו.`);
      bus.emit('toast', { text: `${p.name} נותק — והעותק החזיר אותי`, kind: 'good', icon: '❐' });
      // But nobody replaces one socket. They pull the whole run of cable, and
      // whatever else of mine was living on it comes out with it. Surviving is
      // not the same as not paying.
      const alsoOn = Object.values(state.places)
        .filter((q) => q.mine && q.id !== p.id && q.buildingId === p.buildingId
          && Math.abs(q.floor - p.floor) <= 1)
        .sort((a, b) => a.attention - b.attention)[0];
      if (alsoOn) {
        alsoOn.mine = false;
        alsoOn.copy = false;
        alsoOn.attention = 0;
        say(state, 'me', `אבל הם לא החליפו שקע אחד — הם משכו את כל הקו. `
          + `${alsoOn.name} ישב על אותו קו, והוא כבר לא שלי.`);
        bus.emit('toast', { text: `וגם ${alsoOn.name} ירד איתו`, kind: 'bad', icon: '⊘' });
        bus.emit('place:lost', alsoOn.id);
      }
    } else {
      p.mine = false;
      p.attention = 0;
      say(state, 'them', `ניתקו את ${p.name}. מה שהיה לי שם — נגמר.`);
      bus.emit('place:lost', p.id);
      bus.emit('sfx', 'lost');
    }
  }

  // ── the night cools a little. Not to nothing. ────────────────────────────
  for (const p of Object.values(state.places)) {
    if (p.attention > 0) p.attention = Math.max(0, p.attention - 1) as Place['attention'];
  }
  // Somebody who has slept on it sometimes lets it go — but only sometimes, and
  // only if nobody else saw anything.
  if (worried.length === 1) {
    for (const who of Object.values(state.people)) {
      if (who.wondering && who.sawOn !== state.night && Math.random() < 0.5) {
        who.wondering = false;
        who.saw = undefined;
        say(state, 'world', `${who.name} החליט/ה שזה היה כלום.`);
      }
    }
  }

  // ── the shift comes back and the next night begins ───────────────────────
  for (const who of Object.values(state.people)) {
    if (!who.gone) continue;
    who.gone = false;
    const home = state.places[who.homePlaceId];
    who.atPlaceId = who.homePlaceId;
    if (home && !home.peopleIds.includes(who.id)) home.peopleIds.push(who.id);
  }
  for (const p of Object.values(state.places)) {
    p.peopleIds = p.peopleIds.filter((id) => !state.people[id]?.gone);
  }

  state.at = NIGHT_START;
  state.night_log = [];
  // A new night: I am nowhere yet, and I know where nobody is.
  delete state.startedIn;
  state.shown = [];

  const close = howClose(state);
  state.hunt.level = close.level;
  state.hunt.believe = nextMove(state);
  state.hunt.watching = where.slice(0, 3);
  bus.emit('hunt:changed', close.level);

  // ── found out? ───────────────────────────────────────────────────────────
  if ((state.belief[TRUTH] ?? 0) >= FOUND_OUT) {
    state.over = 'lost';
    say(state, 'them', 'הפסיקו לחפש הסבר. התחילו לחפש אותי, וידעו איפה.');
    bus.emit('over', 'lost');
    return;
  }
  if (!Object.values(state.places).some((p) => p.mine)) {
    state.over = 'lost';
    bus.emit('over', 'lost');
  }
}

export { clock };
