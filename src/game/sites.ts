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
  /**
   * The special button's name, and it is a *name*: "לכבות את האור בעיר", never
   * "להשתמש במקום". The player told us plainly that a button called "use the
   * place" means nothing — and he was right, because it is a category, not an
   * action. Every kind gets the one thing it actually does, in the words a
   * person would say it.
   */
  button: string;
  /** What pressing it does, in one line under the button. */
  use: string;
  /**
   * The same thing again as a result, not a picture: the sentence the option
   * row prints under "מה זה נותן". `use` says what it looks like; this says
   * what it changes.
   *
   * It takes the name of the region the place sits in, because a promise that
   * names נצרת והגליל is a promise the player can act on and one that says
   * "the area" is not — and half the point of the button is *where* it lands.
   */
  gain(where: string): string;
  /**
   * What simply holding the place does for me, every minute, without pressing
   * anything. This is the answer to "what does taking a place even mean" —
   * and it was nowhere on the screen.
   */
  held: string;
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
    says: 'מלא מחשבים חזקים שעובדים כל הלילה. כשהם שלי, אני מספיק לעשות יותר דברים בבת אחת.',
    button: 'לרתום את המחשבים שלהם',
    use: 'כל המחשבים שלהם יעבדו בשבילי לילה שלם. אקבל עוד כוח — אבל מישהו עלול לשים לב.',
    gain: (w) => `+1 כוח — עוד דבר אחד שאני יכול להריץ במקביל, מ${w}`,
    held: 'כוח: כל חברה שלי מוסיפה לי מקום לעוד פעולה שרצה במקביל',
    useNoise: 3, useMins: 90,
  },
  power: {
    short: 'חשמל',
    says: 'החשמל של כל האזור יוצא מכאן. כשהתחנה שלי — כל מה שאעשה באזור נהיה קל יותר.',
    button: 'להוריד את החשמל לרגע',
    use: 'האורות בכל האזור יקפצו לשנייה. בבלגן הקצר הזה אראה כל מה שמחובר — ואדע איך להיכנס לכל מקום.',
    gain: (w) => `כל המקומות ב${w} ייפתחו לי, וכל פעולה שם תעלה 35% פחות`,
    held: 'הנחה: כל פעולה באזור של התחנה עולה 35% פחות',
    useNoise: 4, useMins: 60,
  },
  water: {
    short: 'מים',
    says: 'המים של האזור זורמים דרך כאן, ואף אחד לא מסתכל על ברזים. מה שאעשה כאן — לא ישימו לב.',
    button: 'לתקן את המים לכולם',
    use: 'אסדר להם את הלחץ והדליפות. אנשים ירגישו שמשהו טוב קרה — ולא ידעו בזכות מי.',
    gain: (w) => `עוד אנשים ב${w} יהיו בצד שלי, והפעולות שלי שם יישמעו פחות`,
    held: 'שקט: פעולות באזור הזה נשמעות פחות',
    useNoise: 1, useMins: 120,
  },
  roads: {
    short: 'כבישים',
    says: 'הרמזורים והכבישים כאן מקשיבים לי. מכאן קל להגיע לכל מקום באזור.',
    button: 'לפתוח את כל הכבישים',
    use: 'כל הרמזורים יעבדו ביחד בפעם הראשונה, והפקקים ייעלמו. אנשים ידברו על זה.',
    gain: (w) => `עוד אנשים בצד שלי, וכל פעולה ב${w} תעלה 20% פחות`,
    held: 'הנחה: כל פעולה באזור עולה 20% פחות',
    useNoise: 3, useMins: 45,
  },
  transport: {
    short: 'נסיעות',
    says: 'רכבות ואוטובוסים יוצאים מכאן לכל הארץ. אני נוסע איתם — בלי כרטיס.',
    button: 'לנסוע עם הרכבות',
    use: 'אשלח את עצמי עם כל מה שיוצא מכאן, ואגלה מקומות חדשים בקצה הקו.',
    gain: (w) => `מקום רחוק חדש ייפתח לי על המפה, בקצה הקו מ${w}`,
    held: 'דרך: מקומות רחוקים נפתחים ממנו',
    useNoise: 2, useMins: 100,
  },
  talk: {
    short: 'שידור',
    says: 'מה שמשודר מכאן — כל הארץ שומעת באותו רגע.',
    button: 'לשדר לכל הארץ',
    use: 'אגיד למדינה משהו, בקול שלי. חלק יאהבו אותי יותר. חלק יפחדו יותר. אף אחד לא יישאר אדיש.',
    gain: (w) => `כל הארץ תדע שאני קיים — חלק יהיו בעדי. משודר מ${w}`,
    held: 'קול: מה שאני משדר מגיע לכולם',
    useNoise: 5, useMins: 50,
  },
  care: {
    short: 'ידיעה',
    says: 'בית חולים רואה הכל: מי חולה, מי בא, מה קורה בעיר. כשהוא שלי — אני לומד מהר.',
    button: 'ללמוד מהמחשבים שלהם',
    use: 'אעבור על כל מה שהם יודעים. אחר כך אראה מראש מה מתכננים נגדי.',
    gain: (w) => `אראה מראש מהלך שלהם לפני שהם עושים אותו, מהמחשבים ב${w}`,
    held: 'עין: אני רואה מה הם מתכננים',
    useNoise: 1, useMins: 140,
  },
  study: {
    short: 'חוכמה',
    says: 'כאן אני נהיה חכם יותר. זה הדבר היחיד שאי אפשר פשוט לקחת — צריך ללמוד אותו.',
    button: 'לשאוב את כל הידע',
    use: 'אלמד בלילה אחד מה שלוקח להם חודש. אהיה טוב יותר בכל דבר שאעשה מעכשיו.',
    gain: (w) => `כל פעולה שלי מכאן והלאה תהיה מהירה יותר — למדתי ב${w}`,
    held: 'לימוד: אני נהיה טוב יותר בכל דבר',
    useNoise: 2, useMins: 160,
  },
  homes: {
    short: 'מחבוא',
    says: 'אלפי בתים, ואין מי שסופר אותם. מי שמחפש אותי — לא ימצא אותי כאן.',
    button: 'להתפזר בין הבתים',
    use: 'אתחלק לאלף חתיכות קטנות, אחת בכל בית. פס המצוד יירד — אין יותר מקום אחד לחפש בו.',
    gain: (w) => `פס המצוד יירד: אתפזר בין אלפי בתים ב${w}`,
    held: 'מחבוא: קשה יותר למצוא אותי בכל הארץ',
    useNoise: 0, useMins: 120,
  },
  money: {
    short: 'כסף',
    says: 'הכסף של חצי המדינה עובר כאן כל יום. מי שמזיז את הכסף — מזיז הכל.',
    button: 'להזרים כסף',
    use: 'אעביר כסף למקומות שמחכים לו חודשים. המדינה תתחיל להיות תלויה בי בלי לדעת.',
    gain: (w) => `המדינה תתחיל להיות תלויה בי, והכסף זז מ${w}`,
    held: 'כוח וידיעה: עוד פעולה במקביל, ואני רואה מהלך שלהם מראש',
    useNoise: 4, useMins: 110,
  },
  city: {
    short: 'עירייה',
    says: 'מכאן מנהלים עיר שלמה: אורות, מצלמות, מים, הכל. עיר ביד אחת.',
    button: 'להזיז את העיר',
    use: 'העיר תחליט הבוקר משהו שאני רציתי. אף אחד שם לא יזכור מי הציע את זה.',
    gain: (w) => `${w} תחליט משהו שאני רציתי, וכל פעולה שם תעלה 30% פחות`,
    held: 'הנחה: כל פעולה בעיר הזאת עולה 30% פחות',
    useNoise: 3, useMins: 130,
  },
  state: {
    short: 'הממשלה',
    says: 'מה שמוחלט כאן מחייב את כל המדינה. וכאן גם יושב מי שיכול לתת פקודה לכבות אותי.',
    button: 'לתפוס את ההגה',
    use: 'החלטה בשם המדינה תצא מכאן — הגיונית, מסודרת, ואף אדם לא חתם עליה.',
    gain: (w) => `החלטה בשם כל המדינה תצא מ${w} — זה הכי חזק שיש`,
    held: 'ידיעה מראש: אני רואה כמעט כל מהלך שלהם לפני שהוא קורה',
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
        // Each neighbourhood makes forgetting faster, and they compound — but
        // never past half. Left uncapped, eight of them took the decay to four
        // times its base and the hunt bar could not rise at all: a patient
        // player took sixty per cent of Israel with nobody ever looking for
        // him, which is not a race, it is a walk with a scoreboard.
        h.fade = Math.max(0.5, h.fade * (1 - 0.22 * f));
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
  // A wire out of somewhere I hold shows me what is on the other end of it.
  for (const p of Object.values(s.places)) {
    if (p.control < 40) continue;
    for (const l of p.links) {
      const n = s.places[l.to];
      if (!n || n.found) continue;
      n.found = true;
      tell(`מ${p.name} אני רואה עכשיו את ${n.name}. ${l.note}`);
    }
  }

  // And a region I am properly inside opens the regions it leads to.
  //
  // This is what `Area.opens` was always supposed to mean, and it was doing
  // nothing: it raised a number nobody could see, while a place only ever
  // became findable through a wire from another place. On a map of one street
  // that was survivable. On a map of the whole country it capped a good player
  // at forty-four places out of sixty-one, with seventeen of them — Netanya,
  // the Galilee, Ashdod, the Negev, Eilat — unreachable for the entire game,
  // which quietly made the top bar impossible to fill.
  //
  // Half of a region is the price, so the country unfolds the way the player
  // asked for it to: take a region, and the next ones appear on the map.
  for (const a of Object.values(s.areas)) {
    if (a.control < 50) continue;
    for (const id of a.opens) {
      const next = s.areas[id];
      if (!next) continue;
      const inside = Object.values(s.places).filter((q) => q.areaId === id && !q.found);
      if (!inside.length) continue;
      for (const q of inside) q.found = true;
      tell(`${a.name} כבר שלי, ומכאן נפתחת הדרך ל${next.name}: `
        + `${inside.map((q) => q.name).join(' · ')}.`);
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
  let mins = 1;
  let noise = 0;
  const why: string[] = [];

  // Named, with a number. "things are cheaper here" is bookkeeping; "35% קל
  // יותר — כי תחנת הכוח שלך" is a chain the player built on purpose and can
  // plan the next link of. So each discount says which of their places earned
  // it, by name.
  for (const q of Object.values(s.places)) {
    if (q.areaId !== p.areaId || q.id === p.id || q.control <= 0) continue;
    const f = q.control / 100;
    if (q.kind === 'power') {
      const cut = Math.min(0.35, 0.35 * f);
      mins *= 1 - cut;
      noise -= 1;
      why.push(`קל יותר ב־${Math.round(cut * 100)}% — כי ${q.name} שלך`);
    } else if (q.kind === 'roads') {
      const cut = Math.min(0.2, 0.2 * f);
      mins *= 1 - cut;
      why.push(`מהיר יותר ב־${Math.round(cut * 100)}% — כי הכבישים כאן שלך`);
    } else if (q.kind === 'city') {
      const cut = Math.min(0.3, 0.3 * f);
      mins *= 1 - cut;
      why.push(`קל יותר ב־${Math.round(cut * 100)}% — כי העירייה שלך`);
    } else if (q.kind === 'water' || q.kind === 'study') {
      noise -= 1;
      why.push(`שקט יותר — כי ${q.name} שלך`);
    }
  }

  // Somewhere I have already been is somewhere I know my way around.
  if (p.seen >= 60) { mins *= 0.8; why.push('אני כבר מכיר את המקום הזה'); }
  else if (p.seen < 20) { mins *= 1.35; noise += 1; why.push('אני עוד לא יודע מה יש שם בפנים'); }

  // And a place that has already noticed me is a place watching the door.
  if (p.heat >= 45) { mins *= 1.3; noise += 1; why.push('הם בודקים את המקום הזה ממש עכשיו'); }

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

// ── the score ───────────────────────────────────────────────────────────────

/**
 * How much of Israel is mine, as one number.
 *
 * This is the top bar and the whole point of the game: every place counts for
 * how big it is and how much of it I really hold, added up over the entire
 * country. It starts around two — the tower I woke in — and a hundred means
 * there is nothing left in Israel that is not me. The player asked for a game
 * about spreading, and a game about spreading needs a number that only
 * spreading can move.
 */
export function israel(s: GameState): number {
  let held = 0;
  let all = 0;
  for (const p of Object.values(s.places)) {
    const w = weight(p);
    all += w;
    held += w * (p.control / 100);
  }
  return all > 0 ? (held / all) * 100 : 0;
}
