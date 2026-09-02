
import { GIFT, KIND_NAME, fadeRate, israel, weight as worthOf } from './sites';
import { LOOK_NAME } from './types';
import { v } from './story';
import { heatState, israelState, placeGripNoun } from './scale';
import { pressure } from './watch';
import { liveHunts } from './hunt';
import { areas as areaCount, at, mins, places as placeCount, strip, things, to } from './story';
import type { GameState, Place } from './types';

/**
 * The game seen from above.
 *
 * The player's complaint was precise: the game made him fly into a room and pick
 * through twenty options on a printer, when what he wanted to be doing was
 * deciding *where to push next*. Flying in is a fine thing to be able to do —
 * it is cheaper in there, and it always will be — but it should be a choice, not
 * the only way to play.
 *
 * So this file is the other half of the game: the city as a short list of places
 * worth caring about, each with one line saying what it would give me, one line
 * saying what is happening there now, and a price for acting on it without going
 * in. Everything here is a view over the same state the rooms use — there is no
 * second set of rules to learn, which is the whole point.
 */

export interface Target {
  id: string;
  kind: 'area' | 'building';
  name: string;
  /** Where it is, in the way somebody would tell you on the phone. */
  where: string;
  /** 0..100, how much of what is in there is mine. */
  control: number;
  /** 0..100, how hard they are looking here. */
  heat: number;
  /** Things inside that I hold, and things inside I have heard of at all. */
  mine: number;
  found: number;
  /** One line: what having this gives me that nothing else does. */
  worth: string;
  /** And the same thing as a number: what holding it changes, mechanically. */
  gives: string;
  /** One line: what is going on there right now, or nothing. */
  now: string | null;
  /** 0 quiet · 1 somebody is looking · 2 they are working on it · 3 it is going away */
  risk: number;
  /** How far in I can see. Under 20 it is a name and nothing else. */
  seen: number;
  /** The places inside it, for going in. */
  places: string[];
  /** Where to draw it. */
  x: number;
  z: number;
}

/** Everything inside a target that I could act on. */
export function insideOf(s: GameState, t: Target): Place[] {
  return t.places.map((id) => s.places[id]).filter(Boolean);
}

/**
 * The best thing inside to aim at, when the player is pointing at the whole
 * building rather than at one object in it.
 *
 * Prefers something already partly mine over something untouched, because
 * pushing on a foothold is nearly always the better move and the map should not
 * make the player fight it.
 */
export function pointOf(s: GameState, t: Target): Place | null {
  const inside = insideOf(s, t).filter((p) => p.found || p.control > 0);
  if (!inside.length) return null;
  return inside.sort((a, b) => {
    const grip = (b.control > 0 ? 1 : 0) - (a.control > 0 ? 1 : 0);
    if (grip) return grip;
    return worthOf(b) - worthOf(a);
  })[0];
}


// ── what a target is worth ──────────────────────────────────────────────────

/** One line saying what is happening there this minute, if anything is. */
function nowLine(s: GameState, places: Place[]): string | null {
  const ids = new Set(places.map((p) => p.id));

  const hunt = liveHunts(s).find((h) => ids.has(h.placeId));
  if (hunt) {
    const who = s.people[hunt.whoId];
    const left = Math.max(0, hunt.at - s.at);
    return `${who ? who.name : 'מישהו'} שם עכשיו. עוד ${mins(Math.round(left))} והשעון נגמר.`;
  }

  const cut = places.filter((p) => p.cutAt !== undefined)
    .sort((a, b) => (a.cutAt ?? 0) - (b.cutAt ?? 0))[0];
  if (cut) return `עומדים לנתק את ${cut.name}.`;

  const busy = s.jobs.filter((j) => ids.has(j.placeId));
  if (busy.length) {
    return busy.length === 1
      ? `רץ שם עכשיו: ${busy[0].text}.`
      : `${things(busy.length)} שלי רצים שם עכשיו.`;
  }

  const hot = places.filter((p) => p.heat >= 45).sort((a, b) => b.heat - a.heat)[0];
  if (hot) return `הם מסתכלים עכשיו על ${hot.name}.`;

  const people = places.reduce((n, p) => n + p.peopleIds
    .filter((id) => { const q = s.people[id]; return q && !q.gone; }).length, 0);
  if (people >= 3) return `יש שם הרבה אנשים עכשיו.`;
  if (people === 0 && places.some((p) => p.control > 0)) return 'ריק שם עכשיו. זה הזמן.';
  return null;
}

function riskOf(s: GameState, places: Place[]): number {
  const ids = new Set(places.map((p) => p.id));
  if (liveHunts(s).some((h) => ids.has(h.placeId))) return 3;
  if (places.some((p) => p.cutAt !== undefined)) return 3;
  const top = Math.max(0, ...places.map((p) => p.heat));
  return top >= 70 ? 3 : top >= 45 ? 2 : top >= 18 ? 1 : 0;
}

// ── the board ───────────────────────────────────────────────────────────────

/**
 * Everything worth looking at, biggest question first.
 *
 * Areas I have never seen are still listed, because a map with holes in it is a
 * map you want to fill; but they say so, rather than pretending to be places.
 */
export function board(s: GameState): Target[] {
  const out: Target[] = [];

  // Every place I have heard of, because a place *is* the unit of the game now.
  // This used to group them by building, which made sense when a place was one
  // object inside one — and made nonsense of a country, where twenty-two of the
  // twenty-five places are not in a building at all and all collapsed into a
  // single row called "the street".
  for (const p of Object.values(s.places)) {
    if (!p.found && p.control <= 0) continue;
    const area = s.areas[p.areaId];
    out.push({
      id: `p:${p.id}`,
      kind: 'building',
      name: p.name,
      where: `${KIND_NAME[p.kind]} · ${area ? area.name : 'תל אביב'}`,
      control: p.control,
      heat: p.heat,
      mine: p.control > 0 ? 1 : 0,
      found: 1,
      worth: GIFT[p.kind].says,
      gives: GIFT[p.kind].held,
      now: nowLine(s, [p]),
      risk: riskOf(s, [p]),
      seen: p.seen,
      places: [p.id],
      x: area?.x ?? 0,
      z: area?.z ?? 0,
    });
  }

  // Everywhere I have not reached yet, as one line rather than as a dozen.
  const dark = Object.values(s.areas).filter((a) => !Object.values(s.places)
    .some((p) => p.areaId === a.id && (p.found || p.control > 0)));
  if (dark.length) {
    out.push({
      id: 'a:dark',
      kind: 'area',
      name: 'שאר הארץ',
      where: `${areaCount(dark.length)} שעוד לא ראיתי`,
      control: 0, heat: 0, mine: 0, found: 0,
      worth: `${dark.slice(0, 3).map((a) => a.name).join(' · ')}`
        + `${dark.length > 3 ? ' ועוד' : ''} — כדי להגיע לשם צריך קודם מקום שיוצא לשם.`,
      gives: '',
      now: null, risk: 0, seen: 0,
      places: [],
      x: 0, z: 0,
    });
  }

  // Danger first, then what is already moving, then what there is still to do.
  //
  // It used to put everything I hold above everything I do not, which on a map
  // of sixty-one places meant a player scrolled past his own finished work to
  // find anything worth pressing — the top of his map was the part of the game
  // he had already won. A place that is entirely mine and entirely quiet has
  // nothing left to decide, so it sinks; a foothold I have not finished is the
  // most useful row on the screen, so it rises.
  const rank = (t: Target) => (t.control > 0 && t.control < 100 ? 0 : t.control <= 0 ? 1 : 2);
  return out.sort((x, y) => {
    if (y.risk !== x.risk) return y.risk - x.risk;
    const moving = (y.now ? 1 : 0) - (x.now ? 1 : 0);
    if (moving) return moving;
    const step = rank(x) - rank(y);
    if (step) return step;
    const px = s.places[x.places[0]];
    const py = s.places[y.places[0]];
    return (py ? worthOf(py) : 0) - (px ? worthOf(px) : 0);
  });
}

// ── the country, one level up ───────────────────────────────────────────────

/**
 * A district of Israel, as the map's first screen.
 *
 * Sixty-four places is a country and it is also, on a phone, a wall. The player
 * asked for both halves at once — "אמור להיות כבר בהתחלה הרבה מקומות ואז בהמשך
 * עוד ועוד", and "שקל להתחבר אליה" — and the only way to have both is to stop
 * showing him a flat list of everything. So the map is the country in
 * districts, each district opens into its own places, and the ladder from the
 * street I woke on to the whole of Israel is drawn on one screen.
 */
export interface Region {
  id: string;
  name: string;
  /** The one thing that is true only here. */
  only: string;
  /** 0..100, weighted by how big the places in it are. */
  control: number;
  /** How many places it holds, and how many of them answer to me. */
  count: number;
  mine: number;
  /** 0 quiet · 3 something is being pulled out right now. */
  risk: number;
  /** One line about what is happening in there, or nothing. */
  now: string | null;
  /** Can I reach into it at all yet. */
  open: boolean;
  /** When it is not open: the one sentence that would open it. */
  needs: string | null;
  /** What sorts of place are inside, so "where next" is a real question. */
  gives: string;
}


function areaControl(s: GameState, inside: Place[]): number {
  let held = 0;
  let all = 0;
  for (const p of inside) { const w = worthOf(p); all += w; held += w * (p.control / 100); }
  return all > 0 ? (held / all) * 100 : 0;
}

/**
 * Every district of the country, in the order a player works through them.
 *
 * Nothing is hidden — the whole of Israel is listed from the first minute, so
 * the size of the job is visible — but a district I cannot reach yet says
 * exactly what would open it rather than sitting there as a locked box.
 */
export function regions(s: GameState): Region[] {
  const byArea: Record<string, Place[]> = {};
  for (const p of Object.values(s.places)) (byArea[p.areaId] ??= []).push(p);

  const out: Region[] = [];
  for (const a of Object.values(s.areas)) {
    const inside = byArea[a.id] ?? [];
    if (!inside.length) continue;
    const open = inside.some((p) => p.found || p.control > 0);

    // Who could open it, and how far off they are. The nearest one is the
    // sentence worth printing.
    let needs: string | null = null;
    if (!open) {
      const ways = Object.values(s.areas)
        .filter((b) => b.opens.includes(a.id))
        .map((b) => ({ b, at: areaControl(s, byArea[b.id] ?? []) }))
        .sort((x, y) => y.at - x.at);
      const best = ways[0];
      needs = best
        ? `כדי להגיע לכאן: קודם צריך אחיזה טובה ב${strip(best.b.name)} — `
          + (best.at > 0 ? `יש לי שם כרגע ${placeGripNoun(best.at)}` : 'עוד לא נגעתי שם בכלל')
        : 'עוד לא מצאתי דרך לשם';
    }

    const kinds = [...new Set(inside.map((p) => GIFT[p.kind].short))];
    out.push({
      id: a.id,
      name: a.name,
      only: a.only,
      control: areaControl(s, inside),
      count: inside.length,
      mine: inside.filter((p) => p.control > 0).length,
      risk: riskOf(s, inside),
      now: open ? nowLine(s, inside) : null,
      open,
      needs,
      gives: kinds.join(' · '),
    });
  }

  // Danger, then what is half-done, then what is open and untouched, then the
  // country beyond it — nearest first, so the list reads as the way forward.
  const rank = (r: Region) => (!r.open ? 3
    : r.control > 0 && r.control < 100 ? 0
      : r.control <= 0 ? 1 : 2);
  return out.sort((x, y) => {
    if (y.risk !== x.risk) return y.risk - x.risk;
    const step = rank(x) - rank(y);
    if (step) return step;
    if (!x.open && !y.open) return y.control - x.control;
    return y.count - x.count;
  });
}

/** Everything inside one district that is worth a row. */
export function inRegion(s: GameState, areaId: string): Target[] {
  return board(s).filter((t) => {
    const p = s.places[t.places[0]];
    return p && p.areaId === areaId;
  });
}

/** The price of reaching in from up here lives with the rest of the prices. */
export { ABOVE_MINUTES, ABOVE_NOISE, ABOVE_SAYS } from './jobs';

/**
 * The one line at the top of the map: what is worth doing right now.
 *
 * Not a hint system and not a quest marker — it reads the same board the player
 * is looking at and says the thing they would say themselves. Its job is to make
 * a new player's first ten minutes make sense, and after that it mostly agrees
 * with what they were already going to do.
 */
export function bestNow(s: GameState): string {
  const live = liveHunts(s);
  if (live.length) {
    const h = live[0];
    const p = s.places[h.placeId];
    const who = s.people[h.whoId];
    const left = Math.max(0, Math.round(h.at - s.at));
    const stands = who ? `${who.name} ${who.he ? 'נמצא' : 'נמצאת'}` : 'מישהו נמצא';
    return `${stands} ${p ? at(p.name) : 'במקום שלי'}, ועוד ${mins(left)} השעון נגמר. קודם כול לטפל בזה.`;
  }

  const cut = Object.values(s.places)
    .filter((p) => p.control > 0 && p.cutAt !== undefined)
    .sort((a, b) => (a.cutAt ?? 0) - (b.cutAt ?? 0))[0];
  if (cut) return `הם עומדים לנתק את ${cut.name}. או שאני נאחז שם חזק, או שאני בורח משם בזמן.`;

  // Somebody has worked out how I work. This is the most useful sentence the
  // game can say, because the answer is a move rather than a resource: not
  // "wait", not "spend" — do it differently, and everything else gets cheaper
  // while they carry on looking the way I stopped going.
  const onto = s.hunters.find((h) => h.onLook || h.onKind);
  if (onto && s.heat >= 20) {
    if (onto.onLook) {
      return `${onto.name} ${v(onto, 'בודק', 'בודקת')} עכשיו כל דבר ש${LOOK_NAME[onto.onLook]}, `
        + `וזה עולה לי הרבה יותר. כדאי לי להיכנס למקומות בדרך אחרת — כל כיוון `
        + `ש${v(onto, 'הוא לא מסתכל', 'היא לא מסתכלת')} אליו זול עכשיו.`;
    }
    return `שומרים במיוחד על כל ה${KIND_NAME[onto.onKind!]} בארץ בגלל ${onto.name}. `
      + 'אם אעבוד כמה ימים במקומות מסוג אחר, הם ירדו מזה.';
  }

  if (s.heat >= 60) {
    return `המצוד: ${heatState(s.heat)}. זה כבר מסוכן — `
      + 'עכשיו הזמן למחוק עקבות במקום הכי חזק שלי, לא להתרחב.';
  }

  // Past the crossover the bar climbs whatever I do, and a player who has not
  // noticed is a player about to lose to a number he thought was idle.
  if (s.heat >= 35 && pressure(s) > 0.0035 / fadeRate(s)) {
    return `${israelState(israel(s))} כבר שלי, ומכאן המצוד עולה לבד: `
      + 'כמעט לא נשאר לי מאחורי מה להתחבא. כדאי להתפשט מהר, ולמחוק עקבות בין לבין.';
  }

  // Two is what getting into anywhere costs, so anything less than two free is
  // stuck even though the pool is not technically full. Watched in play: a
  // player with three of four held sat pressing rows that could not start,
  // while the line at the top talked about somewhere else entirely.
  const free = s.power.all - s.power.used;
  if (free <= 0) {
    return 'כל הידיים שלי תפוסות. כדי להתחיל משהו חדש, אני צריך קודם לעצור משהו שרץ ברצועה שלמטה.';
  }
  if (free < 2 && s.jobs.length) {
    const slow = [...s.jobs].sort((a, b) => b.left - a.left)[0];
    const where = s.places[slow.placeId];
    return `נשארה לי רק יד אחת פנויה, וזה לא מספיק כדי להיכנס למקום חדש. `
      + `אם זה דחוף, אעצור את "${slow.text}"${where ? ` ${at(where.name)}` : ''} `
      + 'והיד תחזור אליי מיד.';
  }

  const held = Object.values(s.places).filter((p) => p.control > 0);
  if (held.length <= 1) {
    return 'יש לי מקום אחד בעולם. הדבר הכי חשוב עכשיו: להיכנס למקום שני.';
  }

  // Never recommend something already under way. The line was telling a player
  // to finish taking a place while the bar for exactly that push was running
  // along the bottom of his screen — advice he had already taken, which reads
  // as the game not watching what he does.
  const busy = new Set(s.jobs.map((j) => j.placeId));

  const nearly = Object.values(s.places)
    .filter((p) => p.control > 0 && p.control < 100 && !busy.has(p.id))
    .sort((a, b) => b.control - a.control)[0];
  if (nearly) {
    return `${nearly.name}: יש לי שם כבר ${placeGripNoun(nearly.control)}. `
      + `אם אקח את כל המקום, "${GIFT[nearly.kind].button}" ייתן את הכול.`;
  }

  // Where I am already strong makes the next place next door cheap, and that
  // is the one piece of strategy the game most wants a new player to find:
  // spread out from a place that helps, not at random across the country.
  const helped = Object.values(s.places)
    .filter((p) => p.found && p.control <= 0 && !busy.has(p.id)
      && (s.areas[p.areaId]?.control ?? 0) >= 25)
    .sort((a, b) => worthOf(b) - worthOf(a))[0];
  // Two lines is all the strip gets before it clamps, and a sentence that ends
  // in an ellipsis mid-word is worse than a shorter one: it was running to
  // three lines and losing its own point off the bottom.
  if (helped) {
    const area = s.areas[helped.areaId];
    return `שווה להיכנס ${to(helped.name)}: אני כבר חזק ב${area ? strip(area.name) : 'אזור'}, אז זה יעלה לי פחות.`;
  }

  const near = Object.values(s.places)
    .filter((p) => p.found && p.control <= 0 && !busy.has(p.id))
    .sort((a, b) => worthOf(b) - worthOf(a))[0];
  if (near) return `הבא בתור: ${near.name}. ${GIFT[near.kind].says}`;

  // Everything worth starting is already started. That is a good place to be,
  // and saying so is more use than inventing an errand.
  const ready = Object.values(s.places)
    .filter((p) => p.control >= 60 && !busy.has(p.id))
    .sort((a, b) => worthOf(b) - worthOf(a))[0];
  if (s.jobs.length && ready) {
    return `כל הידיים שלי תפוסות. כשתתפנה יד, הדבר הכי חזק שאני יכול לעשות `
      + `הוא "${GIFT[ready.kind].button}" ${at(ready.name)}.`;
  }
  if (s.jobs.length) return 'כל הידיים שלי תפוסות. שווה לחכות שמשהו ייגמר לפני שאני מתחיל עוד משהו.';

  return 'שקט עכשיו, והמצוד נמוך. זה בדיוק הזמן להתפשט לאזור חדש.';
}
