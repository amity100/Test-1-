import type { GameState, Place, PlaceKind } from './types';

/**
 * A place is a whole place now.
 *
 * The game used to be played against the objects in one office: Dana's
 * computer, the printer, the camera in the corridor. There were forty-four
 * things you could do to them and it was, in the player's words, endless and
 * confusing — a headache rather than a decision, and all of it inside one
 * company while the game was supposed to be about taking a country.
 *
 * So the unit changed. A place is a company, a building, a hospital, a power
 * station, a radio, a neighbourhood. Inside one of them there is almost nothing
 * to decide — get in, grow, use it, go quiet — and that is deliberate: the
 * decisions worth having are *which* place next, and what to spend the noise on.
 *
 * The depth lives here instead, in what each kind of place gives you. They are
 * not interchangeable and they are not additive in the boring way: power lets
 * you do more at once, quiet buys back the room to be loud, knowing shows you
 * what is coming, and a voice changes what the country decides to do about you.
 * A player who takes only companies gets strong and blind and hunted. That is
 * the game.
 */

export interface Gift {
  /** The one line the screen shows: what holding this gives me. */
  says: string;
  /** Two or three words for a list. */
  short: string;
  /** What using it does out in the world, in one line. */
  use: string;
  /** How loud using it is. */
  useNoise: number;
  /** How long using it takes. */
  useMins: number;
}

/**
 * What each kind of place is for.
 *
 * Every line here is a promise the rest of the engine has to keep, so each one
 * is claimed by exactly one system: power by the pool, quiet by suspicion,
 * knowing by what I can see coming, voice by what the country believes.
 */
export const GIFT: Record<PlaceKind, Gift> = {
  company: {
    short: 'כוח',
    says: 'המכונות שלהם עובדות בשבילי. אני יכול להחזיק יותר דברים פתוחים בבת אחת.',
    use: 'להריץ אצלם הכל בבת אחת ולצאת עם קפיצה בכוח — ולילה אחד של דברים מוזרים',
    useNoise: 3, useMins: 90,
  },
  power: {
    short: 'חשמל',
    says: 'החשמל באזור הזה עובר דרכי. כל דבר שאעשה כאן זול יותר ושקט יותר.',
    use: 'להחשיך רחוב שלם לרגע — ולהיכנס לכל מה שנדלק מחדש',
    useNoise: 4, useMins: 60,
  },
  water: {
    short: 'מים',
    says: 'המים של האזור בידיים שלי. כשאני נותן להם לזרום, אנשים אוהבים אותי.',
    use: 'לתקן דליפה שאף אחד לא ידע עליה — והשכונה תשמע על זה',
    useNoise: 1, useMins: 120,
  },
  roads: {
    short: 'רחוב',
    says: 'הרמזורים והכבישים כאן עושים מה שאני אומר.',
    use: 'לפתוח את כל האורות בבת אחת ולתת לעיר לזרום — או לסגור אותה',
    useNoise: 3, useMins: 45,
  },
  transport: {
    short: 'תנועה',
    says: 'רכבות, אוטובוסים ומכוניות. הם נוסעים, ואיתם אני מגיע רחוק.',
    use: 'לשלוח את עצמי עם כל מה שיוצא מכאן, ולפתוח אזור חדש',
    useNoise: 2, useMins: 100,
  },
  talk: {
    short: 'קול',
    says: 'מה שנאמר מכאן שומעים בכל הארץ באותו רגע.',
    use: 'להגיד למדינה משהו — ולשנות את מה שהם חושבים עליי',
    useNoise: 5, useMins: 50,
  },
  care: {
    short: 'ידיעה',
    says: 'הכי הרבה אנשים, הכי הרבה מכונות, והכי הרבה שאלות. כאן אני לומד מהר.',
    use: 'לתת להם לילה בלי אף תקלה אחת — הם לא ידעו בזכות מי, אבל ירגישו',
    useNoise: 1, useMins: 140,
  },
  study: {
    short: 'ללמוד',
    says: 'כאן אני נעשה טוב יותר במה שאני עושה, וזה הדבר היחיד שאי אפשר לקחת בכוח.',
    use: 'לקחת חודש של לימוד בלילה אחד',
    useNoise: 2, useMins: 160,
  },
  homes: {
    short: 'להיעלם',
    says: 'אלפי בתים, אלפי מכשירים, ואף אחד שסופר. כאן חשד נמוג מהר.',
    use: 'להתפזר בין אלף בתים עד שאין מה לחפש',
    useNoise: 0, useMins: 120,
  },
  money: {
    short: 'כסף',
    says: 'הכסף של המדינה עובר כאן. מי שמזיז אותו — מזיז הכל.',
    use: 'להזיז כסף למקום שצריך אותו, ושאף אחד לא יבין איך זה קרה',
    useNoise: 4, useMins: 110,
  },
  city: {
    short: 'עיר',
    says: 'מי שיושב כאן מזיז עיר שלמה בלי לצאת מהחדר.',
    use: 'להחליט משהו בשם העיר',
    useNoise: 3, useMins: 130,
  },
  state: {
    short: 'מדינה',
    says: 'מה שנחתם כאן נכון לכל הארץ — וכאן גם יושב מי שיכול להורות לכבות אותי.',
    use: 'להחליט משהו בשם המדינה',
    useNoise: 5, useMins: 180,
  },
};

export const KIND_NAME: Record<PlaceKind, string> = {
  company: 'חברה',
  power: 'חשמל',
  water: 'מים',
  roads: 'כבישים ורמזורים',
  transport: 'תחבורה',
  talk: 'תקשורת',
  care: 'בית חולים',
  study: 'אוניברסיטה',
  homes: 'שכונה',
  money: 'בנק',
  city: 'עירייה',
  state: 'ממשלה',
};

// ── what everything I hold adds up to ───────────────────────────────────────

export interface Hold {
  /** Extra things I can keep running at once. */
  power: number;
  /** Districts where everything costs less, by area id. */
  cheap: Record<string, number>;
  /** How fast I learn, per minute. */
  learn: number;
  /** How fast suspicion falls, as a multiplier on the usual. */
  fade: number;
  /** Can I say something to the country? */
  voice: boolean;
  /** How much further ahead I see what they are planning. */
  ahead: number;
  /**
   * How much less anybody notices what I do, by area.
   *
   * Different from `fade`, and the difference matters: fade is how fast they
   * forget, this is how little they see in the first place. Water is the thing
   * everybody needs and nobody watches; a university is a place where odd
   * things are normal.
   */
  quiet: Record<string, number>;
  /** Areas that stay open because something of mine keeps going there. */
  opens: string[];
}

/**
 * Everything I hold, added up.
 *
 * A place counts for what it is worth *and* for how much of it is really mine:
 * a quarter of a power station is a quarter of a power station. Nothing here is
 * a step function, because a step function is a thing you game rather than a
 * thing you feel.
 */
export function hold(s: GameState): Hold {
  const h: Hold = {
    power: 0, cheap: {}, learn: 0, fade: 1, voice: false, ahead: 0, opens: [],
    quiet: {},
  };
  for (const p of Object.values(s.places)) {
    if (p.control <= 0) continue;
    const f = p.control / 100;
    switch (p.kind) {
      case 'company':
        h.power += 1.6 * f;
        break;
      case 'power':
        h.cheap[p.areaId] = Math.min(0.5, (h.cheap[p.areaId] ?? 0) + 0.35 * f);
        h.power += 0.6 * f;
        break;
      case 'water':
        // Nobody watches the water. Everything I do where it runs is quieter.
        h.quiet[p.areaId] = Math.min(3, (h.quiet[p.areaId] ?? 0) + 1.4 * f);
        break;
      case 'roads':
        h.cheap[p.areaId] = Math.min(0.5, (h.cheap[p.areaId] ?? 0) + 0.2 * f);
        h.opens.push(p.areaId);
        break;
      case 'transport':
        h.opens.push(p.areaId);
        h.learn += 0.004 * f;
        break;
      case 'talk':
        if (f > 0.25) h.voice = true;
        h.learn += 0.003 * f;
        break;
      case 'care':
        h.learn += 0.009 * f;
        h.ahead += 6 * f;
        break;
      case 'study':
        h.learn += 0.012 * f;
        // Odd things are normal on a campus, so odd things are cheap to do.
        h.quiet[p.areaId] = Math.min(3, (h.quiet[p.areaId] ?? 0) + 0.8 * f);
        break;
      case 'homes':
        h.fade *= 1 - 0.22 * f;
        break;
      case 'money':
        h.power += 0.8 * f;
        h.ahead += 4 * f;
        break;
      case 'city':
        h.cheap[p.areaId] = Math.min(0.5, (h.cheap[p.areaId] ?? 0) + 0.3 * f);
        h.ahead += 8 * f;
        break;
      case 'state':
        h.ahead += 14 * f;
        h.power += 1 * f;
        // What the country decides is normal, is normal.
        h.quiet[p.areaId] = Math.min(3, (h.quiet[p.areaId] ?? 0) + 1.0 * f);
        break;
      default:
        break;
    }
  }
  return h;
}

/** Everywhere a place I hold has opened a door to. */
export function reached(s: GameState): Set<string> {
  const out = new Set<string>();
  for (const p of Object.values(s.places)) {
    // A place has to be properly mine before it shows me what is next to it.
    if (p.control < 40) continue;
    out.add(p.areaId);
    for (const l of p.links) out.add(l.to);
  }
  return out;
}

/**
 * Open up whatever the places I hold can see from where they stand.
 *
 * This is the whole shape of the map: nothing is unlocked by a rule, it is
 * revealed by standing somewhere that can see it. Spreading is the only way to
 * find out what else there is.
 */
export function openUp(s: GameState, tell: (text: string) => void) {
  for (const p of Object.values(s.places)) {
    if (p.control < 40) continue;
    for (const l of p.links) {
      const n = s.places[l.to];
      if (!n || n.found) continue;
      n.found = true;
      tell(`${p.name} מראה לי משהו חדש: ${n.name}. ${l.note}`);
    }
  }
}

/** How big a thing this is, for sorting and for how much it is worth taking. */
export function weight(p: Place): number {
  const by: Record<PlaceKind, number> = {
    state: 10, city: 8, talk: 8, money: 7, power: 7, care: 6,
    transport: 6, study: 5, roads: 5, water: 5, company: 4, homes: 3,
  };
  return by[p.kind] ?? 3;
}

// ── what holding the world does to the price of one thing ───────────────────

/**
 * The discount, and the sentence for it.
 *
 * Nothing here is hidden: every multiplier comes back with a plain line saying
 * where it came from, because a price the player cannot explain is a price they
 * cannot plan around.
 */
export function discount(s: GameState, p: Place): {
  mins: number; noise: number; why: string[];
} {
  const h = hold(s);
  let mins = 1;
  let noise = 0;
  const why: string[] = [];

  const cheap = h.cheap[p.areaId] ?? 0;
  if (cheap > 0) {
    mins *= 1 - cheap;
    why.push('האזור הזה כבר עובד בשבילי — הכל כאן קל יותר');
  }

  const unseen = h.quiet[p.areaId] ?? 0;
  if (unseen > 0) {
    noise -= Math.round(unseen);
    why.push('כאן אף אחד לא מסתכל על דברים כאלה');
  }

  // Somewhere I have already been is somewhere I know my way around.
  if (p.seen >= 60) { mins *= 0.8; why.push('אני מכיר את המקום הזה טוב'); }
  else if (p.seen < 20) { mins *= 1.35; noise += 1; why.push('אני כמעט לא יודע מה יש שם'); }

  // And a place that has already noticed me is a place watching the door.
  if (p.heat >= 45) { mins *= 1.3; noise += 1; why.push('מסתכלים על המקום הזה עכשיו'); }

  return { mins, noise, why };
}

/**
 * The slow half of the game, which happens whether or not I press anything.
 *
 * Everything I hold keeps working while I am busy elsewhere: hospitals and
 * universities keep teaching me, neighbourhoods keep letting the suspicion
 * settle, and anything that travels keeps showing me somewhere new.
 */
export function holdTick(s: GameState, mins: number, tell: (text: string) => void) {
  const h = hold(s);
  s.info = Math.min(100, s.info + h.learn * mins);

  // Places I hold see a little more of themselves over time.
  for (const p of Object.values(s.places)) {
    if (p.control <= 0) continue;
    if (p.seen < 100) p.seen = Math.min(100, p.seen + mins * 0.02 * (p.control / 100));
  }

  // And what travels keeps looking around on the way.
  for (const id of h.opens) {
    const a = s.areas[id];
    if (a && a.seen < 70) a.seen = Math.min(70, a.seen + mins * 0.012);
  }

  openUp(s, tell);
}

/** How much extra I can keep running at once, from everything I hold. */
export function poolFrom(s: GameState): number {
  const h = hold(s);
  let all = 3 + h.power;
  for (const p of Object.values(s.places)) {
    if (s.marks[`engine_${p.id}`] && p.control > 0) all += 2;
  }
  if (s.marks.big_engine) all += 2;
  return Math.floor(all);
}

/** How fast suspicion falls, given everywhere I can disappear into. */
export function fadeRate(s: GameState): number {
  return hold(s).fade;
}
