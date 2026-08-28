import type { GameState, Place, Power } from './types';

/**
 * What a place is good for, and what I cannot see without it.
 *
 * Twenty rooms that all do the same thing is a list, not a map. Each kind of
 * place here gives one thing nothing else gives — and the one that matters most
 * is a camera, because without an eye on a floor I genuinely do not know who is
 * standing on it. Every plan that waits for a room to empty is a guess until I
 * own the eye that looks at it.
 */

export const POWER_OF: Partial<Record<Place['kind'], Power>> = {
  camera: 'sight',
  box: 'reach',
  power: 'move',
  phone: 'ride',
  car: 'ride',
  mainframe: 'speed',
};

export const POWER_NAME: Record<Power, string> = {
  sight: 'לראות מי נמצא שם',
  reach: 'להגיע לבניין אחר באותו לילה',
  move: 'להזיז אנשים ממקומם',
  ride: 'לנסוע עם מי שיוצא',
  speed: 'לעשות הכל מהר יותר',
};

/** Things that tell me somebody is there just by being mine: they sit at them. */
const DESKS: Array<Place['kind']> = ['computer', 'mainframe', 'phone'];

/**
 * Do I have an eye on this floor?
 *
 * A camera sees its own floor and one floor either side — the stairwell is
 * open. Anything somebody sits at tells me when they sit down. And the street
 * is one place: the camera on the pole sees it, and so does the lobby camera,
 * which looks straight out through the glass.
 */
export function canSee(s: GameState, buildingId: string, floor: number): boolean {
  if (buildingId === 'street') {
    return Object.values(s.places).some((p) => p.mine
      && ((p.kind === 'camera' && p.buildingId === 'street') || p.id === 'lobby_cam' || p.id === 'door'));
  }
  return Object.values(s.places).some((p) => p.mine && p.buildingId === buildingId
    && ((p.kind === 'camera' && Math.abs(p.floor - floor) <= 1)
      || (p.floor === floor && DESKS.includes(p.kind))));
}

/**
 * Something the world said out loud tonight is not fog. If I turned off the
 * main computer and the technician came, I was told he came — I do not also
 * need a camera pointed at the cupboard to believe it.
 */
export function known(s: GameState, placeId: string): boolean {
  if (s.shown?.includes(placeId)) return true;
  const p = s.places[placeId];
  if (!p) return true;
  return canSee(s, p.buildingId, p.floor);
}

/** Remember that the world just showed me this spot. Cleared every morning. */
export function show(s: GameState, ...placeIds: Array<string | undefined>) {
  if (!s.shown) s.shown = [];
  for (const id of placeIds) if (id && !s.shown.includes(id)) s.shown.push(id);
}

/** Do I know where this person is standing right now? */
export function knowsWhere(s: GameState, personId: string): boolean {
  const who = s.people[personId];
  return !who || known(s, who.atPlaceId);
}

/** Everyone I can actually see at this place. Under fog this is empty. */
export function seenAt(s: GameState, p: Place): string[] {
  if (!known(s, p.id)) return [];
  return Object.values(s.people)
    .filter((q) => !q.gone && q.atPlaceId === p.id)
    .map((q) => q.name);
}

/**
 * A plan that waits for somebody is a guess whenever I cannot watch the spot
 * it waits on. `watch` is the place to keep an eye on — '*' means the place I
 * am trying to get into. Note that seeing a spot answers the question either
 * way: if I can see the cupboard and the technician is not at it, I know that
 * too. Fog hides the spot, not the person.
 */
export function fogged(s: GameState, watch: string | undefined, target: Place | undefined): boolean {
  if (!watch) return false;
  const id = watch === '*' ? target?.id : watch;
  return !!id && !known(s, id);
}

/**
 * Being in two buildings in one night takes the cupboard: it is the only thing
 * in here with a line that leaves the building. Without it, whichever building
 * I open the night in is the building I spend it in.
 */
export function reachable(s: GameState, p: Place): string | null {
  if (s.places.box?.mine) return null;
  const where = s.startedIn;
  if (!where || where === p.buildingId) return null;
  return 'הלילה הזה כבר התחיל במקום אחר, ואין לי קו שיוצא מהבניין. '
    + 'עם קופסת האינטרנט אוכל להיות בשני מקומות באותו לילה.';
}

/** The first place I touch tonight decides which building the night belongs to. */
export function markWhere(s: GameState, p: Place) {
  if (!s.startedIn) s.startedIn = p.buildingId;
}
