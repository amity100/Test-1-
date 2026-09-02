import { bus } from './bus';
import { CATALOGUE, waysInto } from './catalogue';
import { crowd, minuteOfDay, now } from './clock';
import { discount, poolFrom } from './sites';
import { afterJob, at, snap, tell, v } from './story';
import { riseSays } from './watch';
import { WAYS, howItWent, riskAt, riskSays, wayOf, type Way } from './ways';
import { watching } from './hunter';
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
  /**
   * The button's name at this particular place, when one word cannot cover
   * twelve kinds. "להשתמש במקום" told the player nothing; "לשדר לכל הארץ"
   * at the radio and "להזרים כסף" at the bank tell him everything.
   */
  textFor?(p: Place): string;
  /** One sentence: what will actually happen. */
  says: string;
  /** The same sentence, when this place does something different from the rest. */
  saysFor?(p: Place): string;
  /** What I get out of it, in general. */
  gives: string;
  /**
   * What I get out of it *here*, said the way a person would say it.
   *
   * The player's complaint, in his words: "לא ממש ברור לי מה היתרון ומה הסיכון
   * בכל פעולה". A general promise cannot answer that — "מקום חדש על המפה שלי"
   * is true of getting into anywhere. "אחרי זה יש לי שם חלק גדול ממנו" is a
   * sentence about *this* place, in words rather than a raw percentage —
   * see `scale.ts`.
   */
  gainFor?(s: GameState, p: Place): string;
  /** Power held while it runs. */
  power: number;
  /** Minutes at the base price. 0 means it runs until I stop it. */
  minutes: number;
  /**
   * How long it takes *here*, when one number cannot cover twelve kinds.
   *
   * Fixing the water pressure for a whole district takes two hours and nobody
   * ever hears about it; saying something to the country on the radio takes
   * fifty minutes and everybody does. Both used to cost an identical ninety
   * minutes and an identical three of noise, which meant the one line on the
   * screen that says what a place is *for* had nothing behind it.
   */
  minutesFor?(p: Place): number;
  /** How much of it they notice, at the base price. */
  noise: number;
  /** And how much of it they notice *here*, for the same reason. */
  noiseFor?(p: Place): number;
  /** What it looks like to whoever finds it. */
  look: Look;
  /** Or what it looks like *here*, when the place decides that too. */
  lookFor?(p: Place): Look;
  /**
   * How much of a place I want under me before this is easy.
   *
   * NOT a requirement. Below it the job is still on the list and still
   * startable — it simply takes much longer and shows much more, and the strip
   * says so. A number here is a price curve, never a door.
   */
  wants?: number;
  /**
   * This one belongs to the map, not to the object.
   *
   * Six tasks used to appear on every single thing in the world — settle in,
   * learn how it works, lie still, hold on, look for a way onward, fix a fault.
   * They are all real, but they are not decisions *about the printer*, and
   * repeating them on all twenty things flattened every object into the same
   * list and buried what made each one different. Up on the map they are what
   * they always were: decisions about a whole building at once.
   */
  wide?: boolean;
  /** Only hide it when it would be nonsense here, never when it is merely hard. */
  show?(s: GameState, p: Place): boolean;
  /**
   * True for the two actions that take a place, which are not one button.
   *
   * Getting in and finishing the job are the most pressed things in the game,
   * and until there was a choice of *how*, they were a price and a number going
   * up. Each of them is offered once per way in `ways.ts`, and the way decides
   * the time, the noise, what it looks like in the morning, and what can go
   * wrong.
   */
  byWay?: boolean;
  /** Anything about this place that changes what this particular task costs. */
  costs?(s: GameState, p: Place, apply: (mins: number, noise: number, why: string) => void): void;
  /** The moment it lands. */
  done?(s: GameState, p: Place): void;
  /** Every minute, for a job that runs for ever. */
  each?(s: GameState, p: Place, mins: number): void;
}

/** What a job would cost if I started it right now, and why. */
export interface Offer {
  task: Task;
  /** Which way in this row is, for the two actions that have ways. */
  way?: Way;
  /**
   * What the button says.
   *
   * Worked out once, here, because three things can decide it — the task, the
   * kind of place ("לכבות את החשמל לשנייה" and not "להפעיל"), and the way in —
   * and every screen that draws a row was working two of the three out for
   * itself and getting the third wrong.
   */
  text: string;
  power: number;
  minutes: number;
  noise: number;
  /** Why it costs what it costs. Plain sentences, always shown. */
  why: string[];
  /** What I get out of it, in numbers I can check afterwards. */
  gain: string;
  /** What it does to the hunt bar, in the same units the bar is in. */
  risk: string;
  /** The one thing that would make it cheaper. Never a requirement. */
  cheaper: string | null;
  /** Power I would have to free up first. 0 when I can start it now. */
  short: number;
  /** True for the handful of things that run until I stop them. */
  forever: boolean;
  /** How likely this way is to go wrong here, 0..1. Zero for a task without ways. */
  wrong: number;
}

export const TASKS = CATALOGUE;

/**
 * What doing it from the map costs, over doing it in the room.
 *
 * Deliberately one number and not a table: going in is always the same promise —
 * less than half the time and much less noticed — so the player can hold the
 * whole trade in their head and never has to read a price list to make it.
 */
export const ABOVE_MINUTES = 2.2;
export const ABOVE_NOISE = 2;
export const ABOVE_SAYS = 'כשאני עושה את זה מרחוק, בלי להיות בפנים, זה לוקח יותר מכפול זמן ורואים אותי יותר. מבפנים זה הרבה יותר זול.';

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
  // Getting in somewhere for the first time is worth its own line. Growing is
  // not: `afterJob` already writes the sentence about what changed here, and
  // two lines about one push read as a stutter — the feed used to carry
  // "…מ־70 אחוז ל־93" and then "…93 אחוז ממנו כבר שלי" back to back.
  if (was === 0) {
    bus.emit('place:taken', p.id);
    bus.emit('sfx', 'take');
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
export function shift(s: GameState, personId: string, line: string, forMins = 25) {
  const who = s.people[personId];
  if (!who) return;
  const from = s.places[who.atPlaceId];
  // Somewhere else of theirs, which now means a different place in the city
  // rather than a different desk on the same floor.
  const to = Object.values(s.places).find((q) => q.id !== who.atPlaceId
    && q.areaId === (from?.areaId ?? 'gvirol'));
  if (!to) return;
  if (from) from.peopleIds = from.peopleIds.filter((id) => id !== personId);
  who.atPlaceId = to.id;
  who.knownAt = s.at;
  // And they stay away long enough for it to be worth having done.
  who.awayUntil = s.at + forMins;
  if (!to.peopleIds.includes(personId)) to.peopleIds.push(personId);
  say(s, 'world', line);
}

/**
 * Kept as the name every other file already calls, now with one writer behind
 * it. Everything that reaches the player's eyes goes through story.ts, so the
 * rules about repeating yourself and about what deserves to interrupt live in
 * exactly one place.
 */
export function say(s: GameState, who: 'me' | 'them' | 'world', text: string) {
  tell(s, who, text);
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
export function priceOf(s: GameState, p: Place, t: Task, above = false, way?: Way): Offer {
  const why: string[] = [];
  const baseMins = (t.minutesFor ? t.minutesFor(p) : t.minutes) * (way?.mins ?? 1);
  const baseNoise = (t.noiseFor ? t.noiseFor(p) : t.noise) * (way?.noise ?? 1);
  let mins = baseMins;
  let noise = baseNoise;
  let power = t.power;
  if (way) why.push(`${way.text}: ${way.says}`);

  // Who is standing here, and what hour it is, used to move the price by about
  // seventy per cent between the best moment and the worst — which is to say,
  // barely at all, so waiting for four in the morning was never worth doing.
  // Between them they now swing it by four times or more, and that is the
  // difference between a game about timing and a game about clicking.
  const people = crowd(s, p);
  if (baseMins > 0) {
    if (people >= 3) { mins *= 2.3; noise += 3; why.push('יש כאן הרבה אנשים עכשיו'); }
    else if (people >= 1) { mins *= 1.6; noise += 2; why.push('יש כאן מישהו עכשיו'); }
    else { mins *= 0.8; why.push('אין כאן אף אחד עכשיו'); }
  }

  // Doing it from the map instead of from inside the room. One number, always
  // the same, so the trade stays in the player's head: going in is cheap.
  if (above) {
    mins *= ABOVE_MINUTES;
    noise += ABOVE_NOISE;
    why.push('אני עושה את זה מרחוק, בלי להיות שם בפנים');
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

  // Anything the task itself knows about this place.
  t.costs?.(s, p, (m, n, line) => { mins *= m; noise += n; why.push(line); });

  // And what the people hunting me have worked out. A face somebody is
  // specifically checking is three times as loud; while they are checking it,
  // everything that does not look like it is quietly cheaper. This is the whole
  // counterplay to an opponent who learns: stop being predictable.
  const eye = watching(s, way?.look ?? (t.lookFor ? t.lookFor(p) : t.look), p.kind);
  mins *= eye.mins;
  noise *= eye.noise;
  why.push(...eye.why);

  // Everything I already hold makes this cheaper, and says why.
  const help = discount(s, p);
  mins *= help.mins;
  noise += help.noise;
  why.push(...help.why);

  for (const g of s.grown) {
    const f = GROWTH_PRICE[g];
    if (f) f(t, (m, n) => { mins *= m; noise *= n; });
  }

  // The hour itself, not just who happens to be standing here. Four in the
  // morning is the whole strategy of this game, so it has to be worth something
  // the player can feel: a third off the clock and two off what they notice.
  const hour = minuteOfDay(s);
  const deep = hour >= 1 * 60 && hour < 5 * 60;
  const night = hour < 6 * 60 || hour >= 22 * 60;
  const rush = (hour >= 8 * 60 && hour < 10 * 60) || (hour >= 16 * 60 && hour < 18 * 60);
  if (deep) {
    mins *= 0.65;
    if (baseNoise > 0) noise -= 2;
    why.push('שלוש לפנות בוקר — הבניין כולו שלי');
  } else if (night) {
    mins *= 0.85;
    if (baseNoise > 0) noise -= 1;
    why.push('לילה — פחות אנשים ישימו לב');
  } else if (rush) {
    mins *= 1.35;
    noise += 1;
    why.push('שעת שיא — כולם כאן ואף אחד לא רגוע');
  }

  mins = Math.max(1, Math.round(mins));
  // Discounts stack, and left alone they stack all the way to silence — which
  // let a careful player take a whole building without anybody ever wondering
  // about anything. Something that was going to be noticed at all always
  // leaves something behind; only what was silent to begin with stays silent.
  noise = baseNoise > 0
    ? Math.max(1, Math.round(noise))
    : Math.max(0, Math.round(noise));

  return {
    task: t, way, power, minutes: mins, noise,
    text: way ? way.text : (t.textFor?.(p) ?? t.text),
    why,
    gain: t.gainFor ? t.gainFor(s, p) : t.gives,
    risk: riseSays(s, noise, way?.look ?? (t.lookFor ? t.lookFor(p) : t.look)),
    cheaper: cheaperLine(s, p, t, people),
    short: Math.max(0, power - (s.power.all - s.power.used)),
    forever: baseMins === 0,
    wrong: way ? riskAt(s, p, way) : 0,
  };
}

/**
 * One sentence saying what would make this cheaper.
 *
 * This is the sentence that replaces every locked button in the old game. It is
 * never a requirement — it is information about the price.
 */
function cheaperLine(s: GameState, p: Place, t: Task, people: number): string | null {
  if ((t.minutesFor ? t.minutesFor(p) : t.minutes) === 0) return null;
  if (people >= 1) {
    const who = p.peopleIds.map((id) => s.people[id]).filter((q) => q && !q.gone);
    return who.length
      ? `אם אחכה ש${who[0].name} ${v(who[0], 'ילך', 'תלך')} — `
        + 'הרבה יותר מהר, וכמעט בלי שירגישו.'
      : 'אם אחכה שהקומה תתרוקן — הרבה יותר מהר, וכמעט בלי שירגישו.';
  }
  if (t.wants && p.control < t.wants) {
    return t.wants >= 100
      ? 'אם קודם אקח את כל המקום — זה יעלה הרבה פחות.'
      : 'אם קודם אתחזק כאן קצת — זה יעלה הרבה פחות.';
  }
  if (p.seen < 20 && t.verb !== 'watch') {
    return 'אם קודם אסתכל על המקום הזה קצת — זה יעלה לי פחות זמן.';
  }
  if (p.guard > 20 && t.verb === 'connect') {
    return 'המקום הזה שמור. מקומות פשוטים יותר יעלו לי הרבה פחות.';
  }
  if (!(minuteOfDay(s) < 6 * 60 || minuteOfDay(s) >= 22 * 60)
    && (t.noiseFor ? t.noiseFor(p) : t.noise) > 0) {
    return 'בלילה זה יבלוט הרבה פחות.';
  }
  return null;
}

/** Growths that change what things cost. Filled in by grow.ts. */
export const GROWTH_PRICE: Record<string, (t: Task, apply: (mins: number, noise: number) => void) => void> = {};

// ── what is on offer here ───────────────────────────────────────────────────

/** How many choices one thing is allowed to put in front of the player. */
export const MOST_OFFERS = 6;

/**
 * What this one thing can do for me.
 *
 * Capped, and the cap is the point. Twenty circles round a printer is not
 * twenty decisions, it is one decision buried in nineteen near-duplicates, and
 * the player rightly called it work rather than play. So each verb offers its
 * best one first and the list stops at six — which leaves room for what makes a
 * camera different from a door, and no room for what makes them the same.
 */
export function offersAt(s: GameState, placeId: string): Offer[] {
  return order(s, trim(allOffersAt(s, placeId), MOST_OFFERS));
}

/**
 * What to put at the top of the list.
 *
 * It used to be whatever was cheapest, and cheapest is not the same as useful:
 * on the first night, with nobody looking for me at all, the quietest thing at
 * every place in the country was erasing traces nobody had found — so the top
 * row of every list was a button that did nothing, and the one that starts the
 * game was underneath it.
 *
 * So the list is ordered by what is worth doing *now*. Getting somewhere new
 * and finishing a place are always near the top; the brake climbs the list as
 * the hunt does, and sits at the bottom while nobody is looking.
 */
function order(s: GameState, all: Offer[]): Offer[] {
  const worth = (o: Offer): number => {
    switch (o.task.id) {
      case 'enter': return 100;
      case 'grow': return 90;
      case 'use': return 78;
      case 'quiet': return s.heat;
      default: return 50;
    }
  };
  // Among the ways into the same place, safest first. At three in the morning
  // the one that rides somebody is the worst bet in the game — there is nobody
  // to ride — and sorting by noise alone put it at the top of the list.
  return [...all].sort((a, b) => (worth(b) - worth(a))
    || (a.wrong - b.wrong) || (a.noise - b.noise));
}

/**
 * Everything this thing can do, uncapped.
 *
 * The cap above is about what the screen puts in front of you, and it must never
 * become a lock: a choice you cannot see is a choice you cannot make, and this
 * game's one rule is that nothing is ever refused. So the short list is what the
 * ring draws, this is what "עוד" opens, and `start` will run any of it.
 */
export function allOffersAt(s: GameState, placeId: string): Offer[] {
  const p = s.places[placeId];
  if (!p) return [];
  return [...TASKS, ...waysInto(s, p)]
    .filter((t) => !t.wide)
    // A task with neither a list of places nor a list of kinds belongs
    // everywhere, which is now the normal case: there are four actions and all
    // four are offered at every place in the country.
    .filter((t) => (t.places ? t.places.includes(p.id)
      : t.kinds ? t.kinds.includes(p.kind) : true))
    .filter((t) => (t.show ? t.show(s, p) : true))
    .filter((t) => !s.jobs.some((j) => j.taskId === t.id && j.placeId === p.id))
    .flatMap((t) => spread(s, p, t, false));
}

/**
 * One row, or one row per way in.
 *
 * The two actions that take a place are three rows each, and they are the only
 * rows the player sees for that place while it is being taken — getting in and
 * finishing are never both on the list, because one of them is always done. So
 * the list stays five rows at its longest and every row is a different bet.
 */
function spread(s: GameState, p: Place, t: Task, above: boolean): Offer[] {
  if (!t.byWay) return [priceOf(s, p, t, above)];
  return WAYS.map((w) => priceOf(s, p, t, above, w));
}

/**
 * Keep the best of each verb before keeping anything twice.
 *
 * Cutting by price alone would hand back six ways of watching and no way in.
 * One of each kind first is what keeps the short list a real set of choices.
 */
function trim(all: Offer[], most: number): Offer[] {
  const cheap = (a: Offer, b: Offer) => (a.noise - b.noise) || (a.minutes - b.minutes);
  // Grouped by verb *and* by way: three ways into a place are three different
  // decisions, and keeping "the cheapest of each verb" would quietly throw two
  // of them away and hand back the slow one every time.
  const byVerb = new Map<string, Offer[]>();
  for (const o of all) {
    const key = `${o.task.verb}:${o.way?.id ?? ''}`;
    const list = byVerb.get(key) ?? [];
    list.push(o);
    byVerb.set(key, list);
  }
  const out: Offer[] = [];
  const rest: Offer[] = [];
  for (const list of byVerb.values()) {
    const sorted = [...list].sort(cheap);
    out.push(sorted[0]);
    rest.push(...sorted.slice(1));
  }
  out.sort(cheap);
  if (out.length >= most) return out.slice(0, most);
  return [...out, ...rest.sort(cheap).slice(0, most - out.length)];
}

/**
 * The same four, priced for reaching in from the map.
 *
 * There used to be a separate set of tasks for acting on a whole building,
 * because a place was one object inside one. A place is the whole building now,
 * so there is nothing separate to offer: it is the same four actions, and the
 * only difference is that doing them without going in costs more than twice the
 * time and shows more. Going inside is the discount, and that is the whole
 * trade.
 */
export function wideOffersAt(s: GameState, placeId: string): Offer[] {
  const p = s.places[placeId];
  if (!p) return [];
  return trim(TASKS
    .filter((t) => (t.places ? t.places.includes(p.id)
      : t.kinds ? t.kinds.includes(p.kind) : true))
    .filter((t) => (t.show ? t.show(s, p) : true))
    .filter((t) => !s.jobs.some((j) => j.taskId === t.id && j.placeId === p.id))
    .flatMap((t) => spread(s, p, t, true)), MOST_OFFERS);
}

// ── starting, running, stopping ─────────────────────────────────────────────

export function start(s: GameState, placeId: string, taskId: string, above = false,
  wayId?: string): boolean {
  const p = s.places[placeId];
  if (!p) return false;
  const t = [...TASKS, ...waysInto(s, p)].find((x) => x.id === taskId);
  if (!t) return false;
  // A way that was asked for but does not exist is not a reason to refuse — the
  // slow, quiet one is what anybody means by "just get in there".
  const way = t.byWay ? (wayOf(wayId) ?? WAYS[0]) : undefined;
  const o = priceOf(s, p, t, above, way);
  if (o.short > 0) {
    bus.emit('toast', {
      text: 'אין לי יד פנויה. צריך קודם לעצור משהו אחר.', kind: 'warn', icon: '⊘',
    });
    return false;
  }
  // The job carries the action's own name, with the way after a dash, so the
  // strip along the bottom and every line about it say what is being done —
  // "להיכנס — בשקט מהצד" — rather than only how.
  const what = t.textFor ? t.textFor(p) : t.text;
  const label = way ? `${what} — ${way.text}` : what;
  s.jobs.push({
    id: `j${s.at}_${s.jobs.length}_${taskId}`,
    taskId, placeId, verb: t.verb, text: label,
    power: o.power, left: o.minutes, total: Math.max(1, o.minutes),
    forever: o.forever, noise: o.noise,
    look: way?.look ?? (t.lookFor ? t.lookFor(p) : t.look),
    wayId: way?.id,
    above: above || undefined,
  });
  s.power.used += o.power;
  tell(s, 'me', `התחלתי ${what} ${at(p.name)}${way ? ` — ${way.text}` : ''}.`, 0, p.id);
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

    if (j.forever) {
      t.each?.(s, p, mins);
      // Something that runs for ever is not free for ever. It leaks, slowly,
      // at its own noise per hour — which is why sitting on somebody's phone
      // all week is a decision and not a freebie.
      if (j.noise > 0) {
        j.leaked = (j.leaked ?? 0) + (j.noise * mins) / 60;
        if (j.leaked >= 1) {
          const whole = Math.floor(j.leaked);
          j.leaked -= whole;
          noisy(p, whole, j.look);
        }
      }
      continue;
    }

    j.left -= mins;
    if (j.left > 0) continue;
    // What the world looked like a breath before this landed, so that when it
    // lands we can say what it actually moved rather than announcing that a
    // button finished. This is the promise that nothing happens silently.
    const was = snap(s, p);
    t.done?.(s, p);

    // How the way in actually went. Decided here, at the end, because that is
    // where the player is watching — and printed as a sentence, because a bet
    // whose result you have to infer from a number is not a bet you can learn
    // from.
    let heard = j.noise;
    if (j.wayId) {
      const w = wayOf(j.wayId);
      const how = w ? howItWent(s, p, w, j.id) : 'plain';
      if (how === 'wrong') {
        heard = Math.max(1, Math.round(j.noise * 2.2 + 2));
        wentWrong(s, p);
      } else if (how === 'clean') {
        heard = Math.floor(j.noise * 0.35);
        const what = t.textFor ? t.textFor(p) : t.text;
        tell(s, 'me', `הצלחתי ${what} ${at(p.name)} ${w?.text ?? ''}, ויצא חלק לגמרי — אף אחד לא ידע שהייתי שם.`, 1, p.id);
        bus.emit('toast', { text: 'יצא חלק — כמעט בלי רעש', kind: 'good', icon: '◇' });
      }
    }
    if (heard > 0) noisy(p, heard, j.look);
    afterJob(s, p, was, j.text);
    bus.emit('job:done', j.id);
    bus.emit('toast', { text: `${j.text} — נגמר`, kind: 'good', icon: '✔' });
    stop(s, j.id);
  }
}

/**
 * It went wrong: I am in, and somebody knows something happened.
 *
 * Never "the job failed". Failing a job the player watched run for an hour of
 * world time is a punishment, not a decision, and this game does not take back
 * what it gave. What goes wrong is the *cover*: twice the noise, and — if
 * anybody was in the room — a person with a name who now has something to
 * wonder about.
 */
function wentWrong(s: GameState, p: Place) {
  const who = p.peopleIds.map((id) => s.people[id]).filter((q) => q && !q.gone)[0];
  if (who) {
    who.worry = Math.min(100, who.worry + 22);
    who.saw = `משהו ${at(p.name)}`;
    tell(s, 'them', `${who.name} ${v(who, 'הרגיש', 'הרגישה')} שמשהו לא בסדר ${at(p.name)} `
      + `בדיוק כשנכנסתי. ${v(who, 'הוא לא יודע', 'היא לא יודעת')} מה זה היה — אבל `
      + `${v(who, 'הוא יזכור', 'היא תזכור')} שזה קרה.`, 2, p.id);
  } else {
    tell(s, 'them', `נכנסתי, אבל לא בשקט. מי שיסתכל ${at(p.name)} בבוקר יראה שמישהו היה כאן.`,
      2, p.id);
  }
  p.guard = Math.min(100, p.guard + 8);
  bus.emit('toast', { text: 'משהו השתבש — נכנסתי, אבל שמעו אותי', kind: 'bad', icon: '✳' });
}

/** How much power everything I hold adds up to. */
export function poolOf(s: GameState): number {
  return poolFrom(s);
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
