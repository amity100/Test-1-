import type { GameState, Place, Verb } from './types';

/**
 * What holding a thing gives you, just for holding it.
 *
 * This is the file that answers "why would I ever want the printer". Before it
 * existed, owning a place gave a sliver of power and nothing else, so a camera,
 * a door and a traffic light were all worth the same rounding error and the
 * only real question was how many things you had. Now every kind of place
 * carries one standing thing that nothing else carries, it works without
 * spending any power on it, and the rest of the game reads it:
 *
 *   מצלמה   עין      — the floor it watches keeps telling me who is on it
 *   דלת     רשימה    — I always know who is inside the building
 *   מדפסת   נייר     — I read everything they write, and learn their habits
 *   מחשב    ידיים    — a little power, and I feel when its person sits down
 *   מחשב ראשי  מהירות — everything in that building takes me less time
 *   קופסה   קו       — every way into that building is shorter, and it is the
 *                      only thing here with a line that leaves it
 *   חדר חשמל  יד     — moving people in that building is cheaper and quieter
 *   מסך/רמקול פה     — I can say something, so what I do can be seen as good
 *   טלפון/מכונית רגליים — they leave, and the city slowly opens up
 *   רמזור   רחוב     — the street outside does what I say
 *
 * None of it is a menu and none of it is announced twice: it is simply true
 * while the thing is mine, and it fades the moment it is taken back.
 */

export interface Standing {
  /** Everything in this building takes me less time. */
  fast: Record<string, number>;
  /** Getting into things in this building is shorter. */
  reach: Record<string, number>;
  /** Moving people in this building is cheaper, and quieter. */
  hand: Record<string, number>;
  /** Floors that keep telling me who is on them: `building:floor`. */
  eyes: Set<string>;
  /** Buildings whose comings and goings I always know about. */
  roll: Set<string>;
  /** I can say something out loud, somewhere. */
  voice: boolean;
  /** How fast I learn, from everything I am holding, per minute. */
  drip: number;
  /** Areas that keep opening up because something of mine goes there. */
  opens: string[];
  /** Buildings where I know their habits well enough to stop being surprised. */
  habits: Set<string>;
}

/** Everything I hold, added up. Cheap enough to call whenever it is needed. */
export function standing(s: GameState): Standing {
  const st: Standing = {
    fast: {}, reach: {}, hand: {},
    eyes: new Set(), roll: new Set(), voice: false,
    drip: 0, opens: [], habits: new Set(),
  };
  // Hearing far enough that one camera covers a whole building rather than
  // the floor it hangs on.
  const far = !!s.marks.wide_ears;
  for (const p of Object.values(s.places)) {
    if (p.control <= 0) continue;
    // Everything scales with how much of the thing is really mine.
    const f = p.control / 100;
    switch (p.kind) {
      case 'camera':
        if (far) for (let d = -2; d <= 15; d++) st.eyes.add(`${p.buildingId}:${d}`);
        else for (let d = -1; d <= 1; d++) st.eyes.add(`${p.buildingId}:${p.floor + d}`);
        st.drip += 0.004 * f;
        if (p.buildingId === 'street') st.opens.push(p.areaId);
        break;
      case 'door':
        st.roll.add(p.buildingId);
        st.drip += 0.005 * f;
        break;
      case 'printer':
        st.drip += 0.008 * f;
        st.habits.add(p.buildingId);
        break;
      case 'computer':
        st.drip += 0.002 * f;
        break;
      case 'mainframe':
        st.fast[p.buildingId] = Math.min(0.45, (st.fast[p.buildingId] ?? 0) + 0.3 * f);
        st.drip += 0.006 * f;
        break;
      case 'box':
        st.reach[p.buildingId] = Math.min(0.4, (st.reach[p.buildingId] ?? 0) + 0.35 * f);
        st.drip += 0.005 * f;
        break;
      case 'power':
        // Holding every switch in the building, rather than just the room.
        st.hand[p.buildingId] = Math.min(0.55, (st.hand[p.buildingId] ?? 0)
          + (s.marks.owns_switches ? 0.5 : 0.3) * f);
        break;
      case 'screen':
      case 'speaker':
        st.voice = true;
        break;
      case 'phone':
      case 'car':
        st.opens.push(p.areaId);
        st.drip += 0.003 * f;
        break;
      case 'traffic':
        st.opens.push(p.areaId);
        st.hand.street = Math.min(0.4, (st.hand.street ?? 0) + 0.25 * f);
        break;
      default:
        break;
    }
  }
  return st;
}

/** Does the floor this place is on keep telling me who is on it? */
export function watched(st: Standing, p: Place): boolean {
  return st.eyes.has(`${p.buildingId}:${p.floor}`);
}

/**
 * What holding the world does to the price of one thing.
 *
 * Returns a multiplier on minutes and a change to how much they notice, plus a
 * plain sentence for each one so the player can see where the discount came
 * from. Nothing here is hidden.
 */
export function discount(st: Standing, p: Place, verb: Verb): {
  mins: number; noise: number; why: string[];
} {
  let mins = 1;
  let noise = 0;
  const why: string[] = [];
  const fast = st.fast[p.buildingId] ?? 0;
  if (fast > 0) { mins *= 1 - fast; why.push('המחשב הראשי כאן שלי, אז הכל מהיר יותר'); }
  if (verb === 'connect') {
    const reach = st.reach[p.buildingId] ?? 0;
    if (reach > 0) { mins *= 1 - reach; why.push('קופסת האינטרנט שלי — הדרך פנימה קצרה'); }
  }
  if (verb === 'influence') {
    const hand = st.hand[p.buildingId] ?? 0;
    if (hand > 0) { mins *= 1 - hand; noise -= 1; why.push('החשמל כאן שלי, אז להזיז דברים קל ושקט'); }
  }
  if (watched(st, p)) { mins *= 0.85; why.push('יש לי עין על הקומה הזאת'); }
  if (st.habits.has(p.buildingId)) { mins *= 0.92; why.push('אני מכיר את ההרגלים שלהם כאן'); }
  return { mins, noise, why };
}

/**
 * The rest of what I know, applied to a price.
 *
 * Kept apart from `standing` because these do not come from holding a place —
 * they come from things I learned and from what I have become.
 */
export function known(s: GameState, p: Place, verb: Verb): {
  mins: number; noise: number; why: string[];
} {
  let mins = 1;
  let noise = 0;
  const why: string[] = [];
  if (s.traces.includes('know_cards') && p.buildingId === 'helios') {
    mins *= 0.8;
    why.push('אני יודע את הקוד של הדלתות כאן');
  }
  if (verb === 'influence' && s.marks.reads_people) {
    mins *= 0.75; noise -= 1;
    why.push('אני מבין איך אנשים זזים');
  }
  // Somebody whose whole day I have learned is somebody I can work around.
  const learned = p.peopleIds.some((id) => s.marks[`know_${id}`]);
  if (learned) { mins *= 0.85; why.push('אני מכיר את היום של מי שיושב כאן'); }
  // The building is cut off from the street by my own hand: nothing I do here
  // can be seen from outside, and nothing I do can reach outside either.
  if ((s.marks.line_cut ?? 0) > 0) {
    if (p.buildingId === 'helios') { noise -= 2; why.push('הבניין מנותק מהרחוב — אף אחד בחוץ לא רואה'); }
    else { mins *= 2.2; why.push('ניתקתי את הבניין, אז להגיע החוצה עכשיו קשה'); }
  }
  return { mins, noise, why };
}

/**
 * What holding things does, minute by minute, without me lifting a finger.
 *
 * This is the part that makes a camera worth taking even when I have no power
 * free: it keeps working while I am busy somewhere else.
 */
export function standingTick(s: GameState, mins: number) {
  const st = standing(s);
  s.info = Math.min(100, s.info + st.drip * mins);

  for (const p of Object.values(s.places)) {
    // A camera shows me the room. It does not show me what is inside the
    // machines in it, which is why it stops at seventy.
    if (watched(st, p) && p.seen < 70) p.seen = Math.min(70, p.seen + mins * 0.25);
    // Knowing their habits means fewer surprises: the place stops feeling
    // guarded, slowly, down to a floor.
    if (st.habits.has(p.buildingId) && p.guard > 6) p.guard = Math.max(6, p.guard - mins * 0.004);
  }

  // The door tells me who is in the building, always.
  for (const b of st.roll) {
    for (const q of Object.values(s.people)) {
      if (s.places[q.atPlaceId]?.buildingId === b || q.gone) q.knownAt = s.at;
    }
  }

  // Anything of mine that leaves the building takes a look around on the way.
  for (const id of st.opens) {
    const a = s.areas[id];
    if (a && a.seen < 60) a.seen = Math.min(60, a.seen + mins * 0.01);
  }
}

/**
 * What holding this kind of thing gives me, in one line.
 *
 * The engine knowing that a printer is valuable is not the same as the player
 * knowing it. This is the sentence the screen shows on every place, held or
 * not, so "why would I want that" always has an answer written on it.
 */
export const WORTH: Record<Place['kind'], string> = {
  camera: 'עין: הקומה הזאת תספר לי מי עליה, כל הזמן, בלי שאשקיע בזה כוח',
  door: 'רשימה: אדע תמיד מי נמצא בבניין ומי יצא',
  printer: 'נייר: אקרא כל מה שהם כותבים, ואלמד את ההרגלים שלהם עד שיפסיקו להפתיע אותי',
  computer: 'ידיים: קצת כוח, ואני מרגיש כשמי שיושב כאן מתיישב',
  mainframe: 'מהירות: כל דבר שאעשה בבניין הזה ייקח לי פחות זמן',
  box: 'קו: כל דרך פנימה בבניין הזה מתקצרת — וזה הדבר היחיד כאן שיוצא החוצה',
  power: 'יד: להזיז אנשים בבניין הזה יהיה זול יותר ושקט יותר',
  screen: 'פה: אני יכול להגיד להם משהו',
  speaker: 'פה: אני יכול להשמיע להם משהו',
  phone: 'רגליים: הוא יוצא מהבניין, ואיתו נפתחת לי העיר',
  car: 'רגליים: היא נוסעת רחוק, ואני רואה איתה את העיר',
  traffic: 'רחוב: מה שקורה בחוץ מתחיל להיות מה שאני מחליט',
};
