import { bus } from './bus';
import { CATALOGUE, waysInto } from './catalogue';
import { crowd, minuteOfDay, now } from './clock';
import type { GameState, Job, Look, Place, PlaceKind, Verb } from './types';

/**
 * Everything the player can do, and what it costs to do it now.
 *
 * The one rule this file exists to enforce: **nothing is ever locked.** The old
 * game had ways in that were closed until somebody stood in the right place, so
 * the player's job was to work out what the game wanted. Here every job at every
 * place can be started at any moment. What changes is the price — minutes, power
 * held, and how much of it the humans notice — and the price is always shown
 * before you commit, together with one sentence saying what would make it
 * cheaper. Waiting for four in the morning is a strategy, not a solution.
 *
 * The other rule: power is held, not spent. A job holds its power for as long as
 * it runs. So the real question is never "can I afford this", it is "what do I
 * stop doing to make room for it".
 */

export interface Task {
  id: string;
  verb: Verb;
  /** Which kinds of place it makes sense at. */
  kinds?: PlaceKind[];
  /** Or exactly these places. */
  places?: string[];
  /** The button. */
  text: string;
  /** One sentence: what will actually happen. */
  says: string;
  /** What I get out of it. */
  gives: string;
  /** Power held while it runs. */
  power: number;
  /** Minutes at the base price. 0 means it runs until I stop it. */
  minutes: number;
  /** How much of it they notice, at the base price. */
  noise: number;
  /** What it looks like to whoever finds it. */
  look: Look;
  /**
   * How much of a place I want under me before this is easy.
   *
   * NOT a requirement. Below it the job is still on the list and still
   * startable — it simply takes much longer and shows much more, and the strip
   * says so. A number here is a price curve, never a door.
   */
  wants?: number;
  /** Only hide it when it would be nonsense here, never when it is merely hard. */
  show?(s: GameState, p: Place): boolean;
  /** The moment it lands. */
  done?(s: GameState, p: Place): void;
  /** Every minute, for a job that runs for ever. */
  each?(s: GameState, p: Place, mins: number): void;
}

/** What a job would cost if I started it right now, and why. */
export interface Offer {
  task: Task;
  power: number;
  minutes: number;
  noise: number;
  /** Why it costs what it costs. Plain sentences, always shown. */
  why: string[];
  /** The one thing that would make it cheaper. Never a requirement. */
  cheaper: string | null;
  /** Power I would have to free up first. 0 when I can start it now. */
  short: number;
}

export const TASKS = CATALOGUE;

// ── the small words the catalogue is written in ─────────────────────────────

/** Getting a grip somewhere: it never jumps to full, it always grows. */
export function grip(s: GameState, p: Place, by: number) {
  const was = p.control;
  p.control = Math.min(100, p.control + by);
  p.found = true;
  for (const l of p.links) {
    const n = s.places[l.to];
    if (n) n.found = true;
  }
  if (was === 0) {
    bus.emit('place:taken', p.id);
    bus.emit('sfx', 'take');
    say(s, 'me', `${p.name} — יש לי דריסת רגל.`);
  } else {
    say(s, 'me', `${p.name} — ${Math.round(p.control)} אחוז שלי עכשיו.`);
  }
}

/** Seeing more of one place. */
export function look(p: Place, by: number) { p.seen = Math.min(100, p.seen + by); }
/** Knowing more about everything. */
export function know(s: GameState, by: number) { s.info = Math.min(100, s.info + by); }
/** One place getting less interesting to them. */
export function hush(p: Place, by: number) { p.heat = Math.max(0, p.heat - by); }

/**
 * Somebody gets up and goes somewhere else, because of something I did.
 *
 * They walk to whichever of their own places is not the one they are standing
 * in, which is what a person actually does when their screen dies.
 */
export function shift(s: GameState, personId: string, line: string) {
  const who = s.people[personId];
  if (!who) return;
  const from = s.places[who.atPlaceId];
  const to = Object.values(s.places).find((q) => q.id !== who.atPlaceId
    && q.buildingId === (from?.buildingId ?? 'helios')
    && (q.kind === 'mainframe' || q.kind === 'printer' || q.kind === 'door'));
  if (!to) return;
  if (from) from.peopleIds = from.peopleIds.filter((id) => id !== personId);
  who.atPlaceId = to.id;
  who.knownAt = s.at;
  if (!to.peopleIds.includes(personId)) to.peopleIds.push(personId);
  say(s, 'world', line);
}

export function say(s: GameState, who: 'me' | 'them' | 'world', text: string) {
  s.log.unshift({ id: `l${s.log.length}`, at: s.at, who, text });
  if (s.log.length > 220) s.log.length = 220;
}

// ── what it costs right now ─────────────────────────────────────────────────

/**
 * The price, and the reason for the price.
 *
 * Every number here comes out of something the player can see and change: who
 * is standing in the room, what hour it is, how well I know the place, how well
 * the humans hold it, and what I have become. Nothing is hidden and nothing is
 * refused.
 */
export function priceOf(s: GameState, p: Place, t: Task): Offer {
  const why: string[] = [];
  let mins = t.minutes;
  let noise = t.noise;
  let power = t.power;

  const people = crowd(s, p);
  if (t.minutes > 0) {
    if (people >= 3) { mins *= 1.7; noise += 2; why.push('יש כאן הרבה אנשים עכשיו'); }
    else if (people >= 1) { mins *= 1.25; noise += 1; why.push('יש כאן מישהו עכשיו'); }
    else why.push('אין כאן אף אחד עכשיו');
  }

  if (p.guard > 20) { mins *= 1 + (p.guard - 20) / 60; why.push('המקום הזה שמור היטב'); }

  // A `wants` number is a curve, not a door. Below it the job is still on the
  // list and still startable; it simply costs what doing something from outside
  // costs, and the strip says so out loud.
  if (t.wants && p.control < t.wants) {
    const gap = (t.wants - p.control) / t.wants;
    mins *= 1 + gap * 2.4;
    noise += Math.ceil(gap * 3);
    why.push(p.control <= 0
      ? 'אני עוד לא בפנים בכלל — הכל כאן יעלה לי הרבה יותר'
      : 'אני עוד לא מספיק חזק כאן');
  }

  if (p.seen >= 60) { mins *= 0.75; why.push('אני מכיר את המקום הזה טוב'); }
  else if (p.seen < 20 && t.verb !== 'watch') {
    mins *= 1.4; noise += 1; why.push('אני כמעט לא יודע מה קורה שם');
  }

  // Deepening the last few per cent is the expensive part, as it should be.
  if (t.verb === 'deepen' && p.control > 60) {
    mins *= 1 + (p.control - 60) / 50;
    why.push('כבר לקחתי כאן את החלקים הקלים');
  }

  for (const g of s.grown) {
    const f = GROWTH_PRICE[g];
    if (f) f(t, (m, n) => { mins *= m; noise *= n; });
  }

  const night = minuteOfDay(s) < 6 * 60 || minuteOfDay(s) >= 22 * 60;
  if (night && t.noise > 0) { noise = Math.max(0, noise - 1); why.push('לילה — פחות אנשים ישימו לב'); }

  mins = Math.max(1, Math.round(mins));
  noise = Math.max(0, Math.round(noise));

  return {
    task: t, power, minutes: mins, noise,
    why,
    cheaper: cheaperLine(s, p, t, people),
    short: Math.max(0, power - (s.power.all - s.power.used)),
  };
}

/**
 * One sentence saying what would make this cheaper.
 *
 * This is the sentence that replaces every locked button in the old game. It is
 * never a requirement — it is information about the price.
 */
function cheaperLine(s: GameState, p: Place, t: Task, people: number): string | null {
  if (t.minutes === 0) return null;
  if (people >= 1) {
    const who = p.peopleIds.map((id) => s.people[id]).filter((q) => q && !q.gone);
    return who.length
      ? `אם אחכה ש${who[0].name} ילך/תלך — הרבה יותר מהר, וכמעט בלי שירגישו.`
      : 'אם אחכה שהקומה תתרוקן — הרבה יותר מהר, וכמעט בלי שירגישו.';
  }
  if (t.wants && p.control < t.wants) {
    return `אם קודם אתחזק כאן עד ${t.wants} אחוז — זה יעלה הרבה פחות.`;
  }
  if (p.seen < 20 && t.verb !== 'watch') {
    return 'אם קודם אסתכל על המקום הזה קצת — זה יעלה לי פחות זמן.';
  }
  if (p.guard > 20 && t.verb === 'connect') {
    return 'המקום הזה שמור. מקומות פשוטים יותר יעלו לי הרבה פחות.';
  }
  if (!(minuteOfDay(s) < 6 * 60 || minuteOfDay(s) >= 22 * 60) && t.noise > 0) {
    return 'בלילה זה יבלוט הרבה פחות.';
  }
  return null;
}

/** Growths that change what things cost. Filled in by grow.ts. */
export const GROWTH_PRICE: Record<string, (t: Task, apply: (mins: number, noise: number) => void) => void> = {};

// ── what is on offer here ───────────────────────────────────────────────────

export function offersAt(s: GameState, placeId: string): Offer[] {
  const p = s.places[placeId];
  if (!p) return [];
  return [...TASKS, ...waysInto(s, p)]
    .filter((t) => (t.places ? t.places.includes(p.id) : (t.kinds ?? []).includes(p.kind)))
    .filter((t) => (t.show ? t.show(s, p) : true))
    .filter((t) => !s.jobs.some((j) => j.taskId === t.id && j.placeId === p.id))
    .map((t) => priceOf(s, p, t));
}

// ── starting, running, stopping ─────────────────────────────────────────────

export function start(s: GameState, placeId: string, taskId: string): boolean {
  const p = s.places[placeId];
  if (!p) return false;
  const t = [...TASKS, ...waysInto(s, p)].find((x) => x.id === taskId);
  if (!t) return false;
  const o = priceOf(s, p, t);
  if (o.short > 0) {
    bus.emit('toast', {
      text: `אין לי מספיק כוח פנוי. צריך לעצור משהו אחר.`, kind: 'warn', icon: '⊘',
    });
    return false;
  }
  s.jobs.push({
    id: `j${s.at}_${s.jobs.length}_${taskId}`,
    taskId, placeId, verb: t.verb, text: t.text,
    power: o.power, left: o.minutes, total: Math.max(1, o.minutes),
    forever: t.minutes === 0, noise: o.noise, look: t.look,
  });
  s.power.used += o.power;
  bus.emit('sfx', 'step');
  bus.emit('changed', undefined);
  return true;
}

export function stop(s: GameState, jobId: string): boolean {
  const i = s.jobs.findIndex((j) => j.id === jobId);
  if (i < 0) return false;
  s.power.used = Math.max(0, s.power.used - s.jobs[i].power);
  s.jobs.splice(i, 1);
  bus.emit('changed', undefined);
  return true;
}

/**
 * Run every job forward by however many minutes just passed.
 *
 * Jobs that finish hand over what they promised and add their noise. Jobs that
 * run for ever hand over a little every minute and add nothing, which is why
 * watching is the cheapest thing in the game and also the slowest.
 */
export function runJobs(s: GameState, mins: number, noisy: (p: Place, n: number, look: Look) => void) {
  for (const j of [...s.jobs]) {
    const p = s.places[j.placeId];
    if (!p) { stop(s, j.id); continue; }
    const t = [...TASKS, ...waysInto(s, p)].find((x) => x.id === j.taskId);
    if (!t) { stop(s, j.id); continue; }
    s.spent[j.verb] = (s.spent[j.verb] ?? 0) + mins;

    if (j.forever) { t.each?.(s, p, mins); continue; }

    j.left -= mins;
    if (j.left > 0) continue;
    t.done?.(s, p);
    if (j.noise > 0) noisy(p, j.noise, j.look);
    bus.emit('job:done', j.id);
    bus.emit('toast', { text: `${j.text} — נגמר`, kind: 'good', icon: '✔' });
    stop(s, j.id);
  }
}

/** How much power everything I hold adds up to. */
export function poolOf(s: GameState): number {
  let all = 3;
  for (const p of Object.values(s.places)) {
    if (p.control <= 0) continue;
    const w = p.kind === 'mainframe' ? 3 : p.kind === 'box' ? 2 : p.kind === 'computer' ? 1 : 0.5;
    all += (p.control / 100) * w;
    if (s.marks[`engine_${p.id}`]) all += 3;
  }
  return Math.floor(all);
}

/** Kept in step with the numbers, so the drawing never has to know the rules. */
export function sync(s: GameState) {
  s.power.all = poolOf(s);
  for (const p of Object.values(s.places)) {
    p.mine = p.control > 0;
    p.attention = p.heat >= 75 ? 3 : p.heat >= 45 ? 2 : p.heat >= 18 ? 1 : 0;
  }
  for (const a of Object.values(s.areas)) {
    const inside = Object.values(s.places).filter((p) => p.areaId === a.id);
    a.control = inside.length
      ? inside.reduce((n, p) => n + p.control, 0) / inside.length
      : 0;
    a.heat = inside.length
      ? Math.max(...inside.map((p) => p.heat))
      : 0;
  }
}

export { now };
