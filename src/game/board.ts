
import { GIFT, KIND_NAME, weight as worthOf } from './sites';
import { liveHunts } from './hunt';
import { at, places as placeCount, things } from './story';
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
    return `${who ? who.name : 'מישהו'} שם עכשיו, ונשארו ${Math.round(left)} דקות.`;
  }

  const cut = places.filter((p) => p.cutAt !== undefined)
    .sort((a, b) => (a.cutAt ?? 0) - (b.cutAt ?? 0))[0];
  if (cut) return `עומדים לנתק את ${cut.name}.`;

  const busy = s.jobs.filter((j) => ids.has(j.placeId));
  if (busy.length) {
    return busy.length === 1
      ? `${busy[0].text} — רץ שם עכשיו.`
      : `${busy.length} דברים שלי רצים שם עכשיו.`;
  }

  const hot = places.filter((p) => p.heat >= 45).sort((a, b) => b.heat - a.heat)[0];
  if (hot) return `מסתכלים על ${hot.name}.`;

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
      where: `${dark.length} אזורים שעוד לא ראיתי`,
      control: 0, heat: 0, mine: 0, found: 0,
      worth: `${dark.slice(0, 3).map((a) => a.name).join(' · ')}`
        + `${dark.length > 3 ? ' ועוד' : ''} — כדי להגיע לשם צריך קודם מקום שיוצא לשם.`,
      now: null, risk: 0, seen: 0,
      places: [],
      x: 0, z: 0,
    });
  }

  // Danger first, then what is already moving, then what is worth the most.
  return out.sort((x, y) => {
    if (y.risk !== x.risk) return y.risk - x.risk;
    const moving = (y.now ? 1 : 0) - (x.now ? 1 : 0);
    if (moving) return moving;
    if (y.mine !== x.mine) return y.mine - x.mine;
    const px = s.places[x.places[0]];
    const py = s.places[y.places[0]];
    return (py ? worthOf(py) : 0) - (px ? worthOf(px) : 0);
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
    return `${stands} ${p ? at(p.name) : 'במקום שלי'}, ונשארו ${left} דקות לשעון. תטפל בזה עכשיו.`;
  }

  const cut = Object.values(s.places)
    .filter((p) => p.control > 0 && p.cutAt !== undefined)
    .sort((a, b) => (a.cutAt ?? 0) - (b.cutAt ?? 0))[0];
  if (cut) return `הם עומדים לנתק את ${cut.name}. או שתתחפר שם חזק — או שתברח משם בזמן.`;

  if (s.heat >= 60) return 'פס המצוד גבוה מדי. עכשיו זה הזמן לרדת למחתרת, לא להתרחב.';

  if (s.power.used >= s.power.all) {
    return 'כל הכוח שלך תפוס. כדי להתחיל משהו חדש — תעצור משהו שרץ.';
  }

  const held = Object.values(s.places).filter((p) => p.control > 0);
  if (held.length <= 1) {
    return 'יש לך מקום אחד בעולם. הדבר הכי חשוב עכשיו: לחדור למקום שני.';
  }

  const nearly = Object.values(s.places)
    .filter((p) => p.control > 0 && p.control < 60)
    .sort((a, b) => b.control - a.control)[0];
  if (nearly) {
    return `${nearly.name} כבר ${Math.round(nearly.control)} אחוז שלך. תסיים להשתלט עליו — ואז הכפתור המיוחד שלו ייפתח.`;
  }

  const near = Object.values(s.places)
    .filter((p) => p.found && p.control <= 0)
    .sort((a, b) => worthOf(b) - worthOf(a))[0];
  if (near) return `הבא בתור: ${near.name}. ${GIFT[near.kind].says}`;

  return 'שקט עכשיו. שקט זה בדיוק הזמן להתפשט הלאה.';
}
