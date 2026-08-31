import { RNG } from '../core/rng';
import { bus } from './bus';
import { dayOf, minuteOfDay, now } from './clock';
import { maybeHunt } from './hunt';
import { say } from './jobs';
import { at, feltIt } from './story';
import { fadeRate } from './sites';
import type { GameState, Look, Move, Place, Rung } from './types';

/**
 * The other side.
 *
 * There is one number — how much of it the humans have understood — and it has
 * a face: as long as they have an ordinary explanation that fits what they are
 * seeing, the number climbs slowly and they go looking in the wrong basement.
 * Do something no explanation covers and it climbs fast.
 *
 * Above that number sit six rungs, and on every rung somebody with a name is
 * doing something about it on their own schedule. They do not wait to be
 * provoked and they do not wait for a turn to end. If I know enough, I can see
 * what they are about to do before they do it — and that is most of what
 * knowing things is for.
 */

// ── the explanations they reach for ─────────────────────────────────────────

export interface Story {
  id: string;
  name: string;
  says: string;
  /** The kinds of thing this can be blamed for. */
  holds: Look[];
  /** What they do about it once they believe it properly. */
  does: string;
  /** Who carries it. */
  who: string;
}

export const STORIES: Story[] = [
  {
    id: 'fault', name: 'תקלת חשמל', who: 'ron',
    says: 'הבניין ישן. הכל כאן נופל מדי פעם.',
    holds: ['electric'], does: 'מזמינים חשמלאי ומחליפים לוחות.',
  },
  {
    id: 'insider', name: 'מישהו מבפנים', who: 'dana',
    says: 'מישהו שיש לו כרטיס עושה כאן דברים בלילה.',
    holds: ['person'], does: 'עוברים על רשימת הכניסות ומדברים עם אנשים.',
  },
  {
    id: 'outside', name: 'מישהו מבחוץ', who: 'amir',
    says: 'זה מגיע מהקו שנכנס לבניין, לא מכאן.',
    holds: ['outside'], does: 'מנתקים קווים ובודקים מה מחובר החוצה.',
  },
];

/** How much they will believe a story before they act on it and burn it. */
export const ACTS_AT = 22;

/** The leading story, or nothing — which is much worse. */
export function leading(s: GameState): Story | null {
  let best: Story | null = null;
  let top = 3;
  for (const t of STORIES) {
    if (s.dead.includes(t.id)) continue;
    const w = s.belief[t.id] ?? 0;
    if (w > top) { top = w; best = t; }
  }
  return best;
}

/**
 * Something happened, and it looked like something.
 *
 * It sticks to the strongest living explanation that can hold that kind. If
 * nothing can hold it, the humans have nothing to put it on, and it lands on
 * the one number that matters.
 */
export function noticed(s: GameState, p: Place, amount: number, look: Look) {
  // Being in a lot of small places means no single one of them stands out.
  const thin = s.marks.many ? 0.7 : 1;
  p.heat = Math.min(100, p.heat + amount * 4 * thin);

  // The room felt it. This is the line that turns "noise 3" into something the
  // player watched happen, and it comes before any of the bookkeeping below.
  feltIt(s, p, `משהו ${at(p.name)} עשה רעש.`);
  bus.emit('felt', { placeId: p.id, kind: amount >= 3 ? 'noise' : 'light' });

  const able = STORIES
    .filter((t) => !s.dead.includes(t.id) && t.holds.includes(look))
    .sort((a, b) => (s.belief[b.id] ?? 0) - (s.belief[a.id] ?? 0));

  // Nothing to search for means nowhere to start searching.
  const slow = s.marks.hard_to_find ? 0.65 : 1;
  if (able.length) {
    s.belief[able[0].id] = (s.belief[able[0].id] ?? 0) + amount;
    s.heat = Math.min(100, s.heat + amount * 0.15 * slow);
  } else {
    s.heat = Math.min(100, s.heat + amount * 1.6 * slow);
    say(s, 'them', `מה שקרה ב${p.name} לא נראה כמו שום דבר שיש להם שם בשבילו.`);
  }

  // Anybody standing there might have seen it. Seeded, because the same night
  // played the same way has to come out the same way.
  const r = new RNG(`${s.seed}:saw:${s.at}:${p.id}`);
  for (const id of p.peopleIds) {
    const who = s.people[id];
    if (!who || who.gone) continue;
    if (r.next() < who.notices * (amount / 5)) {
      who.worry = Math.min(100, who.worry + amount * 6);
      who.saw = `משהו ${at(p.name)}`;
      say(s, 'them', `${who.name} ראה/תה משהו ${at(p.name)}, ולא הבין/ה מה.`);
    }
  }

  // And if it was loud enough, somebody gets up and comes. Not in an hour, not
  // tomorrow morning — now, on their feet, across the floor.
  maybeHunt(s, p, amount);
}

/**
 * How much the hunt bar will move if I do something this loud, here.
 *
 * The same arithmetic `noticed` runs, read out loud before the player commits
 * instead of after. It is the single most important number in the game and it
 * used to be printed as "3 יראו", which says nothing: three people? three what?
 * A player cannot weigh a risk written in a unit nobody explained.
 *
 * The gap between the two branches is the whole strategy of the game — noise
 * that lands on an explanation people already believe is nearly free, and noise
 * that lands on nothing costs ten times as much — so it has to be visible.
 */
export function wouldRise(s: GameState, amount: number, look: Look): number {
  if (amount <= 0) return 0;
  const slow = s.marks.hard_to_find ? 0.65 : 1;
  const covered = STORIES.some((t) => !s.dead.includes(t.id) && t.holds.includes(look));
  return amount * (covered ? 0.15 : 1.6) * slow;
}

/** The same number as a sentence a person can act on. */
export function riseSays(s: GameState, amount: number, look: Look): string {
  const up = wouldRise(s, amount, look);
  if (up < 0.4) return 'המצוד כמעט לא יזוז';
  if (up < 1.2) return `המצוד יעלה קצת (${up.toFixed(1)})`;
  if (up < 3) return `המצוד יעלה ב־${up.toFixed(1)}`;
  return `המצוד יקפוץ ב־${Math.round(up)} — זה רועש`;
}

/**
 * An explanation dies when something it took the blame for turns out to be
 * something it cannot possibly cover. Everything it was holding lands on me at
 * once, which makes burning one a knife with no handle — and sometimes exactly
 * the right move, because a story I burned is a story they can never act on.
 */
export function burn(s: GameState, id: string): number {
  if (s.dead.includes(id)) return 0;
  s.dead.push(id);
  const moved = s.belief[id] ?? 0;
  s.belief[id] = 0;
  s.heat = Math.min(100, s.heat + moved * 0.9);
  const t = STORIES.find((x) => x.id === id);
  if (t) {
    say(s, 'them', `הם הפסיקו להאמין ש${t.name}. עכשיו אין להם על מה לשים את זה.`);
    bus.emit('toast', { text: `נגמר להם ההסבר: ${t.name}`, kind: 'bad', icon: '⊗' });
  }
  return moved;
}

// ── the rungs ───────────────────────────────────────────────────────────────

/**
 * Where the hunt stands, in the four stages the player was promised.
 *
 * The thresholds are the same round numbers printed on the bar — 25, 50, 75,
 * 90 — because a stage that lands at 42 when the bar says 40 teaches the player
 * that the bar lies. Stage five is not a stage: it is the bar reaching the end,
 * and the end of the game.
 */
export function rungOf(s: GameState): Rung {
  const h = s.heat;
  if (h >= 100) return 5;
  if (h >= 90) return 4;
  if (h >= 75) return 3;
  if (h >= 50) return 2;
  if (h >= 25) return 1;
  return 0;
}

/** Who is carrying it right now, by name. Nobody, at the top, is the bad one. */
export function asking(s: GameState): { name: string; doing: string } | null {
  const rung = rungOf(s);
  if (rung >= 4) return null;
  const t = leading(s);
  if (!t) return null;
  const who = s.people[t.who];
  if (!who) return null;
  return { name: who.name, doing: t.does };
}

/** One sentence: what is going on, and what it means for me. */
export function saysNow(s: GameState): string {
  const rung = rungOf(s);
  const t = leading(s);
  switch (rung) {
    case 0: return 'אף אחד עוד לא מחפש אותי.';
    case 1: return t
      ? `מישהו שם לב שקורים דברים מוזרים. בינתיים הם חושבים ש${t.name}.`
      : 'מישהו שם לב שקורים דברים מוזרים, ואין להם הסבר.';
    case 2: return 'מחפשים אותי. צוות שלם עובר מקום־מקום.';
    case 3: return 'כולם יודעים שאני קיים. כל דבר שאעשה עכשיו — בולט כפליים.';
    case 4: return 'סוגרים עליי. מנתקים אזורים שלמים כדי לחנוק אותי.';
    default: return 'הם מצאו אותי.';
  }
}

// ── what they are about to do ───────────────────────────────────────────────

/**
 * They plan ahead, and the plan is a list I can read if I know enough.
 *
 * Every so often the world writes down what it is going to do and when. A player
 * with information sees it coming and can hide, dig in, or get out. A player
 * without it finds out when the lights go off.
 */
export function planMoves(s: GameState) {
  const rung = rungOf(s);
  if (rung === 0) return;
  // The higher the rung the more they do in a day, but never more than a few:
  // they are people with other work, not a machine that empties the building.
  const each = rung >= 4 ? 3 : rung >= 2 ? 2 : 1;
  const done = s.marks[`planned_${dayOf(s)}`] ?? 0;
  if (done >= each) return;
  s.marks[`planned_${dayOf(s)}`] = done + 1;

  const r = new RNG(`${s.seed}:plan:${dayOf(s)}:${rung}:${done}`);
  const hot = Object.values(s.places)
    .filter((p) => p.control > 0)
    .sort((a, b) => b.heat - a.heat);
  if (!hot.length) return;

  const target = hot[Math.min(hot.length - 1, r.int(0, 1))];
  const delay = rung >= 4 ? r.int(60, 6 * 60) : r.int(3 * 60, 18 * 60);
  const at = s.at + delay;

  const kinds: Array<Move['kind']> = rung >= 5
    ? ['wipe', 'cut'] : rung >= 4 ? ['cut', 'guard'] : rung >= 3 ? ['check', 'guard'] : ['check', 'watch'];
  const kind = kinds[r.int(0, kinds.length - 1)];

  const text: Record<Move['kind'], string> = {
    check: `מישהו הולך לבדוק את ${target.name}.`,
    watch: `הם שמים עין על ${target.name}.`,
    guard: `הם מחזקים את ${target.name} כדי שיהיה קשה יותר להיכנס אליו.`,
    cut: `הם עומדים לנתק את ${target.name}.`,
    wipe: `הם עומדים לנקות את ${target.name} עד הסוף.`,
  };

  s.moves.push({
    id: `m${s.at}_${target.id}`,
    text: text[kind], at, placeId: target.id, kind,
    needs: kind === 'wipe' ? 20 : kind === 'cut' ? 30 : 45,
  });
  if (kind === 'cut' || kind === 'wipe') target.cutAt = at;
}

/** The moves I can actually see coming. Everything else arrives unannounced. */
export function coming(s: GameState): Move[] {
  const ahead = (s.marks.foresight ?? 0) * 8;
  return s.moves
    .filter((m) => m.at > s.at && s.info + ahead >= m.needs)
    .sort((a, b) => a.at - b.at);
}

/** Everything that has come due. This is where the world hits back. */
/** Crossing into stage three is the end of being a rumour. */
export function stagePush(s: GameState) {
  if (rungOf(s) >= 3 && !s.opinion.known) {
    s.opinion.known = true;
    say(s, 'them', 'זהו. זה בחדשות. כל המדינה יודעת שיש משהו בפנים.');
  }
}

export function landMoves(s: GameState) {
  for (const m of [...s.moves]) {
    if (m.at > s.at) continue;
    s.moves = s.moves.filter((x) => x.id !== m.id);
    const p = m.placeId ? s.places[m.placeId] : undefined;
    if (!p) continue;
    delete p.cutAt;

    switch (m.kind) {
      case 'watch':
        p.guard = Math.min(100, p.guard + 8);
        say(s, 'them', `שמו עין על ${p.name}. כל דבר שאעשה שם עכשיו יבלוט יותר.`);
        break;
      case 'guard':
        // Somewhere that is more mine than theirs is somewhere they cannot
        // really harden any more.
        p.guard = Math.min(100, p.guard + (s.marks.owns_area
          && (s.areas[p.areaId]?.control ?? 0) >= 60 ? 8 : 22));
        say(s, 'them', `חיזקו את ${p.name}. להיכנס לשם עכשיו יעלה לי הרבה יותר.`);
        break;
      case 'check': {
        say(s, 'them', `בדקו את ${p.name}.`);
        if (p.control > 0 && p.heat > 30) {
          const lost = Math.min(p.control, 18 + p.heat / 4 - p.dug / 4);
          p.control = Math.max(0, p.control - lost);
          s.heat = Math.min(100, s.heat + 6);
          say(s, 'me', `מצאו חלק ממני ב${p.name} וניקו אותו. נשארתי שם עם ${Math.round(p.control)} אחוז.`);
          bus.emit('sfx', 'lost');
        }
        break;
      }
      case 'cut':
      case 'wipe': {
        // Being dug in is the difference between losing a place and losing a week.
        // People who do not want me gone slow the hands that would pull me out.
        const friends = s.marks.has_friends ? 0.7 : 1;
        const bite = (m.kind === 'wipe' ? 100 : 60) * friends;
        const kept = Math.max(0, Math.min(p.control, p.dug * 0.6));
        const before = p.control;
        p.control = Math.max(0, Math.min(p.control, kept + Math.max(0, p.control - bite)));
        p.dug = Math.max(0, p.dug - 30);
        p.heat = 0;
        if (p.copy && p.control <= 0) {
          p.copy = false;
          p.control = 15;
          say(s, 'me', `ניתקו את ${p.name}. העותק חיכה, וכשהחזירו — חזרתי איתו.`);
        } else if (p.control <= 0 && s.marks.back_door
          && !Object.values(s.places).some((q) => q.id !== p.id
            && q.buildingId === p.buildingId && q.control > 0)) {
          // The last thing I had in this building, and I kept one wire for
          // exactly this. It is spent now.
          delete s.marks.back_door;
          p.control = 10;
          say(s, 'me', `ניקו את ${p.name} עד הסוף — אבל השארתי לעצמי חוט אחד, והוא החזיק.`);
          bus.emit('toast', { text: 'דרך החזרה נשרפה, ואני עוד כאן', kind: 'warn', icon: '↩' });
        } else if (p.control <= 0) {
          say(s, 'them', `ניתקו את ${p.name}. מה שהיה לי שם — נגמר.`);
          bus.emit('place:lost', p.id);
        } else {
          say(s, 'me', `ניסו לנקות את ${p.name}. הייתי תפוס שם חזק מדי — נשאר לי ${Math.round(p.control)} אחוז.`);
        }
        if (before > 0) { bus.emit('sfx', 'lost'); bus.emit('toast', { text: `${p.name} — ניתקו`, kind: 'bad', icon: '⏻' }); }
        break;
      }
    }
  }
}

// ── people talking to each other ────────────────────────────────────────────

/**
 * One person alone with a story talks themselves out of it. Two people who
 * compare notes do not. This is the thing that turns a quiet night into a
 * fortnight of somebody sitting and going through everything.
 */
export function peopleTalk(s: GameState) {
  const hour = minuteOfDay(s);
  const mark = `talk_${dayOf(s)}`;
  if (hour < 9 * 60 || hour > 11 * 60 || s.marks[mark]) return;
  s.marks[mark] = 1;

  const worried = Object.values(s.people).filter((q) => q.worry >= 30);
  if (worried.length >= 2) {
    s.heat = Math.min(100, s.heat + worried.length * 3);
    for (const q of worried) q.worry = Math.min(100, q.worry + 10);
    say(s, 'them', `${worried.map((q) => q.name).join(' ו')} דיברו הבוקר וגילו ששניהם ראו משהו.`);
    bus.emit('toast', { text: 'הם משווים סיפורים', kind: 'bad', icon: '☍' });
  } else if (worried.length === 1) {
    const q = worried[0];
    // Somebody afraid tells a manager. Somebody curious goes and looks themselves.
    if (q.mood === 'afraid') { s.heat = Math.min(100, s.heat + 4); say(s, 'them', `${q.name} סיפר/ה למישהו מה ראה/תה.`); }
    else if (q.mood === 'curious') { say(s, 'world', `${q.name} התחיל/ה לחפש לבד מה קרה שם.`); q.worry += 6; }
    else q.worry = Math.max(0, q.worry - 12);
  }

  // Worry fades on its own when nothing new happens.
  for (const q of Object.values(s.people)) q.worry = Math.max(0, q.worry - 4);
}

/** Everything cools a little all the time. Doing nothing is a real move. */
export function cool(s: GameState, mins: number) {
  // Everywhere I can disappear into makes forgetting faster, which is what a
  // neighbourhood is actually for.
  s.heat = Math.max(0, s.heat - mins * 0.0035 / fadeRate(s));
  for (const p of Object.values(s.places)) p.heat = Math.max(0, p.heat - mins * 0.012);
  for (const t of STORIES) {
    if (s.belief[t.id]) s.belief[t.id] = Math.max(0, s.belief[t.id] - mins * 0.002);
  }
}

/** They act on a story they believe, and the story burns itself out doing it. */
export function actOnStory(s: GameState) {
  for (const t of STORIES) {
    if (s.dead.includes(t.id)) continue;
    const w = s.belief[t.id] ?? 0;
    const spent = s.marks[`spent_${t.id}`] ?? 0;
    if (w < ACTS_AT + spent * 10) continue;
    s.marks[`spent_${t.id}`] = spent + 1;
    s.belief[t.id] = Math.round(w * 0.3);
    say(s, 'them', `${t.does} ${now(s)}.`);
    bus.emit('toast', { text: t.does, kind: 'bad', icon: '⚒' });

    // What they replace, I lose my grip on.
    const hit = Object.values(s.places).filter((p) => p.control > 0
      && ((t.id === 'fault' && (p.kind === 'power' || p.kind === 'water'))
        || (t.id === 'insider' && (p.kind === 'company' || p.kind === 'city'))
        || (t.id === 'outside' && (p.kind === 'roads' || p.kind === 'transport'))));
    for (const p of hit.slice(0, 2)) {
      p.control = Math.max(0, p.control - 40);
      p.guard = Math.min(100, p.guard + 12);
      if (p.control <= 0) bus.emit('place:lost', p.id);
    }
    // And a fix that fixes nothing makes them wonder about the fix.
    s.heat = Math.min(100, s.heat + 3);
  }
}
