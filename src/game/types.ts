/**
 * The whole game in one file of nouns.
 *
 * Rule for everything in here: if a word would look strange to a child, it does
 * not belong. A place is a computer, a camera, a phone, a traffic light. A link
 * is a wire, a person, a device or an update. Nothing else exists.
 */

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

/** How much a thing you do will be felt. One word, never a number. */
export type Loud = 'quiet' | 'noticed' | 'loud';

/** How loudly a place is being looked at right now. Shown as a picture, never a number. */
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
  mine: boolean;
  /** You have heard of it. Places you have not found are not drawn. */
  found: boolean;
  attention: Attention;
  /** Day number it goes off the network. Undefined until they decide to cut it. */
  cutOn?: number;
  /** Set when you left something behind here before it was cut. */
  copy: boolean;
  peopleIds: string[];
  links: Link[];
  /** Which building it sits in. Street furniture uses 'street'. */
  buildingId: string;
  /** Which floor. 0 is the lobby, -1 is the basement, and the street is 0. */
  floor: number;
  /** Where in the room, in metres from the middle of the building. */
  x: number;
  z: number;
  /** How high off the floor it sits: a camera is high, a phone is on a desk. */
  y: number;
}

// ── People ──────────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  name: string;
  /** "מנהלת צוות", "שומר", "טכנאי" — never a job title from a careers page. */
  role: string;
  /** Where they are right now. */
  atPlaceId: string;
  /** The spot they sit at when nothing has moved them. */
  homePlaceId: string;
  /** Their phone, if they have one you could ride. */
  phoneId?: string;
  /** 0..1 — how likely they are to notice something odd. */
  notices: number;
  /** True once they have seen something they cannot explain. */
  wondering: boolean;
  /** What they saw, in their words. */
  saw?: string;
}

// ── The hunt ────────────────────────────────────────────────────────────────

export type HuntLevel = 0 | 1 | 2 | 3;
// 0 לא שמים לב · 1 חושדים · 2 מנתקים · 3 תוקפים

export interface Hunt {
  level: HuntLevel;
  /** The single sentence they currently believe. */
  believe: string;
  /** Places they are actively looking at. */
  watching: string[];
  /** Where their scanner is, once they have one. */
  scannerAt?: string;
  /** Days of quiet in a row. Enough of them and they calm down. */
  quiet: number;
}

// ── Stages ──────────────────────────────────────────────────────────────────

export interface Step {
  id: string;
  /** "להשתלט על המחשב הראשי" */
  text: string;
  /** What to do, in the voice of someone standing next to you. */
  hint: string;
  /** The place the arrow points at. */
  placeId?: string;
  done: boolean;
}

export interface Stage {
  n: number;
  title: string;
  where: string;
  /** One sentence: why you are here. */
  goal: string;
  /** Shown on the card before the stage starts. */
  intro: string;
  steps: Step[];
}

// ── The whole game ──────────────────────────────────────────────────────────

export interface LogLine {
  id: string;
  day: number;
  /** 'me' = the AI thinking · 'them' = something they did · 'world' = something that happened */
  who: 'me' | 'them' | 'world';
  text: string;
}

export interface GameState {
  seed: string;
  day: number;
  stage: number;
  places: Record<string, Place>;
  people: Record<string, Person>;
  hunt: Hunt;
  steps: Step[];
  log: LogLine[];
  /** Things the player has been told once already. */
  taught: string[];
  /** Free-form marks the stages use. */
  marks: Record<string, number>;
  /** What I have left behind me in the world, in the order I left it. */
  traces: string[];
  over: 'won' | 'lost' | null;
}

export interface BusEvents {
  changed: undefined;
  'place:taken': string;
  'place:lost': string;
  'day:passed': number;
  'step:done': string;
  'stage:changed': number;
  'hunt:changed': HuntLevel;
  toast: { text: string; kind: 'good' | 'bad' | 'warn' | 'info'; icon?: string };
  teach: string;
  look: string | null;
  /** Something happened in a room, and the people in it should feel it. */
  felt: { placeId: string; kind: 'dark' | 'light' | 'ring' | 'print' | 'screen' | 'door' | 'noise' | 'stop' };
  sfx: string;
  over: 'won' | 'lost';
}
