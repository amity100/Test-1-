/**
 * The whole game in one file of nouns.
 *
 * Rule for everything in here: if a word would look strange to a child, it does
 * not belong. A place is a computer, a camera, a phone, a traffic light. A link
 * is a wire, a person, a device or an update. Nothing else exists.
 *
 * The game runs on five numbers and seven verbs, and nothing else. Everything a
 * player ever wonders about should be answerable with one of them.
 */

// ── the five numbers ────────────────────────────────────────────────────────

/**
 * כוח — held, not spent.
 *
 * This is the whole shape of the game. Power is not a currency you pay and lose;
 * it is a number of things you can be doing at once. Every job you start holds
 * some of it for as long as it runs, and gives it back the moment you stop. So
 * the question is never "can I afford this" — it is "what do I stop doing".
 */
export interface Pool {
  /** Everything I have, from everything I hold. */
  all: number;
  /** How much of it is busy right now. */
  used: number;
}

/** The seven things I can do. There is no eighth. */
export type Verb =
  | 'watch'      // לצפות — see what is happening somewhere
  | 'connect'    // להתחבר — get a foothold somewhere new
  | 'spread'     // להתרחב — reach further out from somewhere I hold
  | 'deepen'     // לחזק — hold what I have more firmly
  | 'influence'  // להשפיע — make something in the world happen
  | 'hide'       // להסתתר — be harder to notice
  | 'defend';    // להגן — be harder to remove

export const VERB_NAME: Record<Verb, string> = {
  watch: 'לצפות',
  connect: 'להתחבר',
  spread: 'להתרחב',
  deepen: 'לחזק',
  influence: 'להשפיע',
  hide: 'להסתתר',
  defend: 'להגן',
};

/** What each verb is actually for, in the words a child would use. */
export const VERB_SAYS: Record<Verb, string> = {
  watch: 'לדעת מה קורה שם',
  connect: 'להגיע למקום חדש',
  spread: 'להגיע רחוק יותר',
  deepen: 'להיות שם חזק יותר',
  influence: 'לגרום למשהו לקרות',
  hide: 'שיפסיקו לשים לב',
  defend: 'שלא יוכלו להוציא אותי',
};

// ── Places ──────────────────────────────────────────────────────────────────

export type PlaceKind =
  | 'computer'      // מחשב של מישהו
  | 'mainframe'     // המחשב הראשי של החברה
  | 'camera'        // מצלמה
  | 'phone'         // טלפון
  | 'traffic'       // רמזור
  | 'power'         // חדר חשמל
  | 'door'          // דלת כניסה
  | 'printer'       // מדפסת
  | 'screen'        // מסך גדול / טלוויזיה
  | 'box'           // קופסת האינטרנט של הבניין
  | 'car'           // מכונית
  | 'speaker';      // רמקול

/**
 * What a thing you did looks like to somebody who finds it in the morning.
 *
 * Suspicion is one number, but it has a face: as long as the humans have an
 * ordinary explanation that fits, the number climbs slowly and they look in the
 * wrong place. Doing something nothing explains is what makes it climb fast.
 */
export type Look =
  | 'electric'   // like the building's wiring giving up again
  | 'person'     // like somebody with a card who was here at night
  | 'outside'    // like it came in on the line from the street
  | 'wrong';     // like nothing anybody here has a word for

export const LOOK_NAME: Record<Look, string> = {
  electric: 'נראה כמו תקלת חשמל',
  person: 'נראה כמו מישהו מבפנים',
  outside: 'נראה כאילו הגיע מבחוץ',
  wrong: 'לא נראה כמו שום דבר שיש להם שם בשבילו',
};

/** How loudly a place is being looked at. Drawn as a colour, never as a number. */
export type Attention = 0 | 1 | 2 | 3;
// 0 שקט · 1 מישהו שם לב · 2 בודקים · 3 עומדים לנתק

export type LinkKind = 'wire' | 'person' | 'device' | 'update';

export interface Link {
  to: string;
  kind: LinkKind;
  /** For a link that rides a human or a gadget. */
  carrierId?: string;
  /** One plain sentence: "דנה עולה לקומה 14 כל בוקר". */
  note: string;
}

export interface Place {
  id: string;
  kind: PlaceKind;
  /** "המחשב של דנה" */
  name: string;
  /** "קומה 14" */
  where: string;
  /** One line of flavour shown when you look inside. */
  desc: string;

  /** 0..100. Never "captured" — always a number that grew. */
  control: number;
  /** 0..100. How hard the humans are looking at this one thing. */
  heat: number;
  /** How much of me is dug in here. Slows down anyone trying to pull me out. */
  dug: number;
  /** How well the humans hold it to begin with. Raises every price here. */
  guard: number;
  /** How much I know about this place. Under 30 I cannot see who is in it. */
  seen: number;

  /** Kept for the drawing: true the moment I have any control at all. */
  mine: boolean;
  /** You have heard of it. Places you have not found are not drawn. */
  found: boolean;
  /** Kept for the drawing: heat, in four steps. */
  attention: Attention;

  /** Minute of the world clock they will pull it out. Undefined until they decide. */
  cutAt?: number;
  /** Set when I left something behind here before it was pulled. */
  copy: boolean;

  peopleIds: string[];
  links: Link[];
  /** Which building it sits in. Street furniture uses 'street'. */
  buildingId: string;
  /** Which area of the city it belongs to. */
  areaId: string;
  /** Which floor. 0 is the lobby, -1 is the basement, and the street is 0. */
  floor: number;
  /** Where in the room, in metres from the middle of the building. */
  x: number;
  z: number;
  /** How high off the floor it sits: a camera is high, a phone is on a desk. */
  y: number;
}

// ── Areas ───────────────────────────────────────────────────────────────────

/** What an area of the city is good for. One word, in the words a child uses. */
export type AreaKind =
  | 'work'      // בניינים של חברות
  | 'study'     // אוניברסיטה
  | 'moving'    // תחבורה
  | 'talking'   // תקשורת
  | 'homes'     // שכונות מגורים
  | 'city'      // עירייה
  | 'cold';     // חדרים קרים מלאים במכונות

export const AREA_KIND_NAME: Record<AreaKind, string> = {
  work: 'בניינים של חברות',
  study: 'אוניברסיטה',
  moving: 'תחבורה',
  talking: 'מקום שמדבר לכולם',
  homes: 'שכונת מגורים',
  city: 'עירייה',
  cold: 'חדר קר מלא במכונות',
};

export interface Area {
  id: string;
  /** "דיזנגוף" */
  name: string;
  kind: AreaKind;
  /** One sentence a child would recognise the place from. */
  desc: string;
  /** 0..100, the average of what I hold in it, weighted by how big each thing is. */
  control: number;
  /** 0..100 — how much the people here have understood. */
  heat: number;
  /** How much I know about it. Under 20 it is a name on a map and nothing else. */
  seen: number;
  /** How well guarded it is to begin with. */
  guard: number;
  /** Areas that become reachable once I am properly inside this one. */
  opens: string[];
  /** The one thing that is true only here. */
  only: string;
  /** Where it sits on the city floor, for the drawing. */
  x: number;
  z: number;
}

// ── Jobs ────────────────────────────────────────────────────────────────────

/**
 * Something I started, that is running.
 *
 * A job holds power for as long as it lives. Some jobs finish and hand me
 * something; some run until I stop them and keep handing me a little all the
 * time. Nothing in this game happens the instant you press it.
 */
export interface Job {
  /** Unique to this run of it. */
  id: string;
  /** Which entry in the catalogue. */
  taskId: string;
  placeId: string;
  verb: Verb;
  /** The button it came from, so the screen can say what is running. */
  text: string;
  /** Power held for as long as it lives. */
  power: number;
  /** Minutes of work still to do. */
  left: number;
  /** Minutes it was going to take, for the bar. */
  total: number;
  /** True for a job that runs until I stop it. */
  forever: boolean;
  /** Suspicion it adds, spread over the time it takes. */
  noise: number;
  look: Look;
  /** Set the minute it ends, so the screen can show it fading. */
  doneAt?: number;
  /** Noise a never-ending job has built up but not yet spilled. */
  leaked?: number;
}

// ── People ──────────────────────────────────────────────────────────────────

/** What somebody thinks about strange things happening around them. */
export type Mood = 'afraid' | 'curious' | 'past caring';

export const MOOD_NAME: Record<Mood, string> = {
  afraid: 'נבהל/ת מדברים מוזרים',
  curious: 'סקרן/ית לגבי דברים מוזרים',
  'past caring': 'לא אכפת לו/ה',
};

/** One line of somebody's night: where they are, between these two minutes. */
export interface Slot {
  from: number;
  until: number;
  at: string;
}

export interface Person {
  id: string;
  name: string;
  /** "מנהלת צוות", "שומר", "טכנאי" — never a job title from a careers page. */
  role: string;
  /** Where they are right now. */
  atPlaceId: string;
  /** The whole day, hour by hour. The world does not wait to be asked. */
  day: Slot[];
  /** Their phone, if they have one you could ride. */
  phoneId?: string;
  /** 0..1 — how likely they are to notice something odd. */
  notices: number;
  mood: Mood;
  /** 0..100 — how much this one person has understood. */
  worry: number;
  /** Who they talk to. Two people comparing notes is worse than one wondering. */
  talksTo: string[];
  /** What they saw, in their words. */
  saw?: string;
  /** The minute I last actually knew where they were. */
  knownAt?: number;
  /**
   * Pulled away from their own day until this minute.
   *
   * Without this, making somebody get up did nothing at all: the timetable put
   * them straight back in their chair on the very next minute, so every ring,
   * every dead screen and every message was theatre.
   */
  awayUntil?: number;
  /** They have gone home. Back tomorrow. */
  gone?: boolean;
}

// ── What the humans are doing about it ──────────────────────────────────────

/** The rungs, from nobody noticing to somebody trying to erase me. */
export type Rung = 0 | 1 | 2 | 3 | 4 | 5;

export const RUNG_NAME: Record<Rung, string> = {
  0: 'אף אחד לא שם לב',
  1: 'תקלות מוזרות',
  2: 'מדברים על זה',
  3: 'בודקים',
  4: 'מנתקים',
  5: 'מוחקים',
};

/** Something the world is doing to me, that I can see coming if I know enough. */
export interface Move {
  id: string;
  /** One sentence: what they are about to do. */
  text: string;
  /** Which minute it lands. */
  at: number;
  /** What it hits. */
  placeId?: string;
  areaId?: string;
  kind: 'check' | 'cut' | 'wipe' | 'guard' | 'watch';
  /** How much I have to know before I can see it coming at all. */
  needs: number;
}

// ── What the country thinks ─────────────────────────────────────────────────

export interface Opinion {
  /** They want me to keep going. */
  support: number;
  /** They want me gone. */
  fear: number;
  /** They could not stop now if they wanted to. */
  need: number;
  /** True once I am not a rumour any more. */
  known: boolean;
}

// ── The whole game ──────────────────────────────────────────────────────────

export interface LogLine {
  id: string;
  /** Minute of the world clock it happened at. */
  at: number;
  /** 'me' = the AI thinking · 'them' = something they did · 'world' = something that happened */
  who: 'me' | 'them' | 'world';
  text: string;
}

export interface GameState {
  seed: string;
  /**
   * Minutes since I woke up, at 03:12. The clock never stops on its own — the
   * player can pause it to think, and pausing costs nothing, but nothing waits.
   */
  at: number;
  /** 0 paused · 1 · 4 · 12. How fast the world runs. */
  speed: number;

  power: Pool;
  jobs: Job[];
  /** How much I know, 0..100. */
  info: number;
  /** How much they understand, 0..100. */
  heat: number;

  places: Record<string, Place>;
  people: Record<string, Person>;
  areas: Record<string, Area>;

  /** How much they believe each ordinary explanation. The face of a low number. */
  belief: Record<string, number>;
  /** Explanations I have made impossible. */
  dead: string[];

  /** What they are about to do, in the order they will do it. */
  moves: Move[];
  opinion: Opinion;

  /** Minutes of power spent on each verb. This is what I grow from. */
  spent: Record<Verb, number>;
  /** What I have become. */
  grown: string[];

  log: LogLine[];
  /** Things the player has been told once already. */
  taught: string[];
  /** Free-form marks the world uses to remember what happened. */
  marks: Record<string, number>;
  /** What I have left behind me, in the order I left it. */
  traces: string[];
  over: 'won' | 'lost' | null;
}

export interface BusEvents {
  changed: undefined;
  'place:taken': string;
  'place:lost': string;
  'job:done': string;
  'day:passed': number;
  'rung:changed': Rung;
  'grown': string;
  toast: { text: string; kind: 'good' | 'bad' | 'warn' | 'info'; icon?: string };
  teach: string;
  look: string | null;
  /** Something happened in a room, and the people in it should feel it. */
  felt: { placeId: string; kind: 'dark' | 'light' | 'ring' | 'print' | 'screen' | 'door' | 'noise' | 'stop' };
  sfx: string;
  over: 'won' | 'lost';
}
