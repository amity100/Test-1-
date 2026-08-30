import { AREA_KIND_NAME } from './types';
import { WORTH } from './standing';
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

/**
 * What each building is called out loud.
 *
 * Kept here rather than read out of the drawing, because the map has to be able
 * to name a building the camera has never been near.
 */
const BUILDING_NAME: Record<string, string> = {
  helios: 'מגדל הליוס',
  across: 'הבניין ממול',
  flats: 'הבית של דנה',
  street: 'הרחוב עצמו',
};

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

/** How much a single thing is worth having, in one number, for sorting only. */
function worthOf(p: Place): number {
  const by: Record<Place['kind'], number> = {
    mainframe: 10, box: 9, power: 8, traffic: 7, door: 6, camera: 5,
    printer: 5, computer: 4, phone: 4, car: 3, screen: 3, speaker: 3,
  };
  return by[p.kind] ?? 1;
}

// ── what a target is worth ──────────────────────────────────────────────────

/**
 * One line saying why I would want this.
 *
 * An area says the one thing that is true only there — that sentence is already
 * written into the city. A building says whichever of the things inside it is
 * the most useful, borrowing the same sentence the room screen uses, so the two
 * levels never contradict each other.
 */
function worthLine(s: GameState, kind: 'area' | 'building', places: Place[], only?: string): string {
  if (kind === 'area' && only) return only;
  const best = [...places].sort((a, b) => worthOf(b) - worthOf(a))[0];
  if (!best) return 'עוד לא ראיתי מה יש שם.';
  const held = places.filter((p) => p.control > 0).length;
  if (held === 0) return WORTH[best.kind];
  const missing = places.filter((p) => p.control <= 0)
    .sort((a, b) => worthOf(b) - worthOf(a))[0];
  return missing
    ? `${placeCount(held)} כאן כבר שלי. מה שחסר הכי הרבה: ${missing.name} — ${WORTH[missing.kind]}`
    : `הכל כאן כבר שלי.`;
}

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

  // Buildings first: they are what the player actually pushes on.
  const byBuilding = new Map<string, Place[]>();
  for (const p of Object.values(s.places)) {
    if (!p.found && p.control <= 0) continue;
    const list = byBuilding.get(p.buildingId) ?? [];
    list.push(p);
    byBuilding.set(p.buildingId, list);
  }

  for (const [id, places] of byBuilding) {
    const area = s.areas[places[0].areaId];
    const mine = places.filter((p) => p.control > 0).length;
    const control = places.reduce((n, p) => n + p.control, 0) / places.length;
    out.push({
      id: `b:${id}`,
      kind: 'building',
      // The building's own name, not the floor the first thing in it happens to
      // sit on: "קומה 14" is where something is, never what it is.
      name: BUILDING_NAME[id] ?? 'בניין',
      where: area ? area.name : 'תל אביב',
      control,
      heat: Math.max(0, ...places.map((p) => p.heat)),
      mine,
      found: places.length,
      worth: worthLine(s, 'building', places),
      now: nowLine(s, places),
      risk: riskOf(s, places),
      seen: places.reduce((n, p) => n + p.seen, 0) / places.length,
      places: places.map((p) => p.id),
      x: area?.x ?? 0,
      z: area?.z ?? 0,
    });
  }

  // Then the city itself, so "where next" is always a question on screen —
  // but only the parts of it I have actually seen something of. Seven rows all
  // reading "שם על המפה. עוד לא יודע מה יש שם" is not a map with holes in it,
  // it is a wall of the same sentence, and it buried the two rows that meant
  // something. What I have not reached yet gets one row at the end, below.
  for (const a of Object.values(s.areas)) {
    if (a.seen < 20 && a.control <= 0) continue;
    const places = Object.values(s.places).filter((p) => p.areaId === a.id
      && (p.found || p.control > 0));
    out.push({
      id: `a:${a.id}`,
      kind: 'area',
      name: a.name,
      where: AREA_KIND_NAME[a.kind],
      control: a.control,
      heat: a.heat,
      mine: places.filter((p) => p.control > 0).length,
      found: places.length,
      worth: a.seen >= 20 ? a.only : 'שם על המפה. עוד לא יודע מה יש שם.',
      now: nowLine(s, places),
      risk: riskOf(s, places),
      seen: a.seen,
      places: places.map((p) => p.id),
      x: a.x,
      z: a.z,
    });
  }

  // Everywhere I have not reached yet, as one line rather than as seven.
  const dark = Object.values(s.areas).filter((a) => a.seen < 20 && a.control <= 0);
  if (dark.length) {
    out.push({
      id: 'a:dark',
      kind: 'area',
      name: 'שאר העיר',
      where: `${placeCount(dark.length).replace('מקום', 'אזור').replace('מקומות', 'אזורים')} שעוד לא ראיתי`,
      control: 0, heat: 0, mine: 0, found: 0,
      worth: `${dark.slice(0, 3).map((a) => a.name).join(' · ')}`
        + `${dark.length > 3 ? ' ועוד' : ''} — כדי להגיע לשם צריך קודם משהו שיוצא מהבניין.`,
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
    return y.found - x.found;
  });
}

// ── acting from up here ─────────────────────────────────────────────────────

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
    const stands = who ? `${who.name} ${who.he ? 'עומד' : 'עומדת'}` : 'מישהו עומד';
    return `${stands} ${p ? at(p.name) : 'במקום שלי'}, ויש ${left} דקות על השעון. `
      + 'זה הדבר היחיד שחשוב עכשיו.';
  }

  const cut = Object.values(s.places)
    .filter((p) => p.control > 0 && p.cutAt !== undefined)
    .sort((a, b) => (a.cutAt ?? 0) - (b.cutAt ?? 0))[0];
  if (cut) return `עומדים לנתק את ${cut.name}. או שאתפוס שם חזק יותר, או שאעבור משם.`;

  if (s.power.used >= s.power.all) {
    return 'כל הכוח שלי תפוס. כדי להתחיל משהו חדש — צריך לעצור משהו שרץ.';
  }

  const free = s.power.all - s.power.used;
  const held = Object.values(s.places).filter((p) => p.control > 0);
  if (held.length <= 1) {
    // Never end a Hebrew sentence on a digit: the full stop jumps to the wrong
    // side of the number and the line reads as broken even when it is right.
    return `יש לי מקום אחד בעולם, וכוח ל${things(free)} במקביל. עכשיו צריך מקום שני.`;
  }

  const nearly = Object.values(s.places)
    .filter((p) => p.control > 0 && p.control < 50)
    .sort((a, b) => b.control - a.control)[0];
  if (nearly) {
    return `${nearly.name} כבר ${Math.round(nearly.control)} אחוז שלי — עוד קצת, ואוכל להשתמש בו באמת.`;
  }

  const near = Object.values(s.places)
    .filter((p) => p.found && p.control <= 0)
    .sort((a, b) => worthOf(b) - worthOf(a))[0];
  if (near) return `${near.name} — ${WORTH[near.kind]}`;

  if (s.heat >= 40) return 'הם מבינים יותר מדי. שווה עכשיו יותר להסתתר מאשר להתרחב.';
  return 'שקט. שקט זה בדיוק הזמן להתרחב.';
}
