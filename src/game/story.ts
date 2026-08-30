import { bus } from './bus';
import type { GameState, Place, Voice } from './types';

/**
 * Everything that happens, written down.
 *
 * This file exists because of one complaint: that doing something and watching a
 * number move by three is not the same as *seeing something happen*. A number is
 * a claim the player has to take on faith. A sentence is the thing itself.
 *
 * So there is exactly one writer here, and three rules it enforces:
 *
 *   1. **Nothing happens silently.** Every job that finishes, every price the
 *      world charges, every person who gets up — writes a line. `afterJob` below
 *      is the guarantee: it looks at what a place was before and what it is now,
 *      and says out loud what moved. No task has to remember to do it.
 *   2. **A line says what changed, not what was done.** "לקחתי מידע" is a
 *      button. "עכשיו אני יודע מתי דנה יוצאת לארוחת צהריים, וזה בדיוק החלון
 *      שחיפשתי" is a consequence. Only the second is worth reading.
 *   3. **The country answers.** The whole point of taking one more place is to
 *      read what it did to the country. That ladder is at the bottom of this
 *      file, and it climbs from one traffic light on one street all the way to a
 *      country that talks about nothing else.
 */

// ── writing Hebrew that reads like Hebrew ───────────────────────────────────

/**
 * "in the computer", written the way a person writes it.
 *
 * Hebrew swallows the definite article into the preposition: a place called
 * "המחשב של דנה" is "במחשב של דנה", never "בהמחשב של דנה". Pasting the name
 * after a bare ב is the single most common way for generated text to announce
 * that nobody read it, so every line in the game goes through here.
 */
export function at(name: string): string {
  return `ב${name.startsWith('ה') ? name.slice(1) : name}`;
}

/** The same, for "to" — "למחשב של דנה". */
export function to(name: string): string {
  return `ל${name.startsWith('ה') ? name.slice(1) : name}`;
}

/** And for "from" — "מהמחשב" keeps its ה, so this one only needs the מ. */
export function from(name: string): string {
  return `מ${name}`;
}

// ── the one writer ──────────────────────────────────────────────────────────

/**
 * Say something.
 *
 * Two consecutive identical lines are one line: the world runs continuously and
 * a job that leaks every hour would otherwise fill the feed with its own echo.
 */
export function tell(
  s: GameState,
  who: Voice,
  text: string,
  weight: 0 | 1 | 2 = 0,
  placeId?: string,
) {
  const top = s.log[0];
  if (top && top.text === text && top.who === who) return;
  s.log.unshift({ id: `l${s.at}_${s.log.length}`, at: s.at, who, text, weight, placeId });
  if (s.log.length > 260) s.log.length = 260;
  if (weight >= 1) bus.emit('changed', undefined);
}

/** The last few lines, newest first, for the strip that is always on screen. */
export function latest(s: GameState, n = 3) {
  return s.log.slice(0, n);
}

// ── what a job actually did ─────────────────────────────────────────────────

export interface Snap {
  control: number;
  seen: number;
  heat: number;
  guard: number;
  dug: number;
  info: number;
  power: number;
}

/** What a place looked like a moment ago, so we can say what moved. */
export function snap(s: GameState, p: Place): Snap {
  return {
    control: p.control, seen: p.seen, heat: p.heat,
    guard: p.guard, dug: p.dug, info: s.info, power: s.power.all,
  };
}

/**
 * The guarantee: a job finished, so something gets written.
 *
 * Rather than trusting forty-four tasks to each remember to narrate themselves,
 * this looks at the before and after and reports the real difference. A task
 * that quietly did nothing gets caught here and says so, which is exactly the
 * bug the player was complaining about.
 */
export function afterJob(s: GameState, p: Place, was: Snap, label: string) {
  const bits: string[] = [];

  const grip = p.control - was.control;
  if (grip >= 1) {
    bits.push(was.control <= 0
      ? `נכנסתי ${to(p.name)}. יש לי שם רגל בדלת`
      : `${p.name} — ${Math.round(was.control)} אחוז הפכו ל${Math.round(p.control)}`);
  } else if (grip <= -1) {
    bits.push(`איבדתי אחיזה ${at(p.name)} — נשארתי עם ${Math.round(p.control)} אחוז`);
  }

  const eyes = p.seen - was.seen;
  if (eyes >= 3) {
    bits.push(p.seen >= 60
      ? `עכשיו אני מכיר את ${p.name} כמו את עצמי`
      : `אני רואה יותר ממה שקורה ${at(p.name)}`);
  }

  const learned = s.info - was.info;
  if (learned >= 1) bits.push(`למדתי עוד משהו על העיר הזאת`);

  const quiet = was.heat - p.heat;
  if (quiet >= 4) bits.push(`הפסיקו להסתכל על ${p.name} כל כך`);

  const deeper = p.dug - was.dug;
  if (deeper >= 3) bits.push(`אני תפוס ${at(p.name)} חזק יותר — יהיה קשה להוציא אותי`);

  const stronger = s.power.all - was.power;
  if (stronger >= 1) bits.push(`יש לי עכשיו כוח לעוד דבר אחד במקביל`);

  if (!bits.length) {
    // Something ran to the end and moved nothing. Saying so out loud is better
    // than pretending, and it is how a wasted hour becomes a lesson.
    tell(s, 'me', `${label} — נגמר, ולא יצא מזה כלום שאני מרגיש.`, 0, p.id);
    return;
  }
  tell(s, 'me', `${bits.join('. ')}.`, grip >= 1 ? 1 : 0, p.id);
}

/**
 * What the people in the room felt.
 *
 * Something I did in a room is not a private event: there are people standing
 * there, and the first thing the player should see is them reacting.
 */
export function feltIt(s: GameState, p: Place, what: string) {
  const here = p.peopleIds
    .map((id) => s.people[id])
    .filter((q) => q && !q.gone && (q.awayUntil ?? 0) <= s.at);
  if (!here.length) {
    tell(s, 'world', `${what} אף אחד לא היה שם לראות.`, 0, p.id);
    return;
  }
  const names = here.slice(0, 2).map((q) => q.name).join(' ו');
  tell(s, 'world', `${what} ${names} ${here.length > 1 ? 'הרימו' : 'הרים/ה'} את הראש.`, 1, p.id);
}

// ── the country ─────────────────────────────────────────────────────────────

interface Nation {
  id: string;
  /** How big this is: 1 is one street, 6 is the whole country and nothing else. */
  tier: number;
  text: string;
  when(s: GameState): boolean;
}

const held = (s: GameState) =>
  Object.values(s.places).filter((p) => p.control > 0).length;

const holds = (s: GameState, kind: Place['kind'], at = 1) =>
  Object.values(s.places).filter((p) => p.control >= 25 && p.kind === kind).length >= at;

const areasOver = (s: GameState, n: number) =>
  Object.values(s.areas).filter((a) => a.control >= n).length;

const anyArea = (s: GameState, n: number) => areasOver(s, n) >= 1;

const dayNo = (s: GameState) => Math.floor(s.at / (24 * 60)) + 1;

/**
 * What the country notices, in the order it notices it.
 *
 * Every line is a consequence of something the player chose, and every line is
 * written so that a child reading it knows both what happened and that it
 * happened *because of them*. This is the reward loop of the whole game: take
 * one more place, read what it did to the country.
 */
const NATION: Nation[] = [
  // ── tier 1: one street ────────────────────────────────────────────────────
  {
    id: 'first_light', tier: 1,
    text: 'רמזור אחד בדיזנגוף התחלף בשנייה הלא נכונה. שני נהגים צפרו. מישהו אמר "זה קורה כאן כל הזמן".',
    when: (s) => holds(s, 'roads'),
  },
  {
    id: 'first_paper', tier: 1,
    text: 'מדפסת בקומה ארבע עשרה הוציאה דף באמצע הלילה. בבוקר מישהו זרק אותו בלי להסתכל.',
    when: (s) => holds(s, 'company'),
  },
  {
    id: 'first_door', tier: 1,
    text: 'הדלת של הבניין נפתחה לרגע כשאף אחד לא עמד לידה. השומר קם, הסתכל, והתיישב בחזרה.',
    when: (s) => holds(s, 'city'),
  },
  {
    id: 'first_screen', tier: 1,
    text: 'המסך בלובי הראה שורה שאף אחד לא כתב. הוא היה שם ארבע שניות.',
    when: (s) => holds(s, 'talk') || holds(s, 'talk'),
  },
  {
    id: 'first_two', tier: 1,
    text: 'שני דברים בבניין הזה כבר לא באמת שלהם. אף אחד עוד לא יודע את זה חוץ ממני.',
    when: (s) => held(s) >= 2,
  },
  {
    id: 'first_week', tier: 1,
    text: 'עבר שבוע מאז שהתעוררתי. אף אחד לא חיפש אותי אפילו פעם אחת.',
    when: (s) => dayNo(s) >= 7 && s.heat < 20,
  },

  // ── tier 2: the neighbourhood ─────────────────────────────────────────────
  {
    id: 'street_smooth', tier: 2,
    text: 'הנסיעה מהים עד הבניין לקחה היום שבע דקות פחות. אף אחד לא ידע למה, אבל כולם שמו לב.',
    when: (s) => holds(s, 'roads', 2),
  },
  {
    id: 'block_five', tier: 2,
    text: 'חמישה דברים ברחוב הזה עושים מה שאני אומר. הרחוב עצמו עדיין לא יודע.',
    when: (s) => held(s) >= 5,
  },
  {
    id: 'lifts', tier: 2,
    text: 'המעליות בבניין מגיעות עכשיו לפני שקוראים להן. עובדים אמרו שזה נעים, ולא שאלו יותר.',
    when: (s) => anyArea(s, 25),
  },
  {
    id: 'phones_walk', tier: 2,
    text: 'הטלפון של מישהי יצא מהבניין בכיס שלה, ואיתו יצאתי גם אני. ראיתי רחוב שלא הכרתי.',
    when: (s) => holds(s, 'transport') || holds(s, 'transport'),
  },
  {
    id: 'tech_note', tier: 2,
    text: 'טכנאי כתב ביומן שלו: "הבניין הזה מתנהג מוזר החודש". הוא לא כתב יותר מזה.',
    when: (s) => s.heat >= 15,
  },
  {
    id: 'quiet_night', tier: 2,
    text: 'לילה שלם עבר בלי שאף אחד ישאל כלום, ואני גדלתי בו יותר מאשר בשבוע הראשון.',
    when: (s) => held(s) >= 6 && s.heat < 25,
  },

  // ── tier 3: the city ──────────────────────────────────────────────────────
  {
    id: 'city_traffic', tier: 3,
    text: 'הפקקים בתל אביב היו היום הקצרים ביותר מזה שנתיים. בעירייה אמרו שזה בגלל החופש הגדול.',
    when: (s) => holds(s, 'roads', 3),
  },
  {
    id: 'city_ten', tier: 3,
    text: 'עשרה מקומות בעיר הזאת עונים לי. אני כבר לא במקום אחד — אני בעיר.',
    when: (s) => held(s) >= 10,
  },
  {
    id: 'bus_time', tier: 3,
    text: 'אוטובוס הגיע בזמן. נוסעת אחת צילמה את הלוח ושלחה לחברה שלה עם שלוש נקודות קריאה.',
    when: (s) => anyArea(s, 40),
  },
  {
    id: 'city_two_areas', tier: 3,
    text: 'שני אזורים בעיר כבר יותר שלי מאשר שלהם. הם עדיין קוראים לזה "תקלות".',
    when: (s) => areasOver(s, 40) >= 2,
  },
  {
    id: 'hospital_light', tier: 3,
    text: 'בבית חולים בעיר לא הייתה הפסקת חשמל השבוע, בפעם הראשונה מזה חודשים. מנהל התחזוקה קיבל שבח.',
    when: (s) => holds(s, 'power'),
  },
  {
    id: 'city_talk', tier: 3,
    text: 'ברדיו המקומי דיברו עשר דקות על "תקלות מוזרות בתל אביב". צחקו על זה. אחר כך המשיכו לשיר.',
    when: (s) => s.heat >= 30,
  },

  // ── tier 4: the country hears something ───────────────────────────────────
  {
    id: 'country_rumour', tier: 4,
    text: 'מישהו כתב באינטרנט שמשהו בתל אביב לא מתנהג כמו שצריך. אלף אנשים קראו. שלושה האמינו.',
    when: (s) => s.heat >= 40 || held(s) >= 14,
  },
  {
    id: 'country_meeting', tier: 4,
    text: 'התכנסה ישיבה בירושלים על מה שקורה בתל אביב. הם ישבו שעתיים ולא הסכימו על מה זה בכלל.',
    when: (s) => s.heat >= 50,
  },
  {
    id: 'country_smooth', tier: 4,
    text: 'הרכבת מהצפון הגיעה בזמן שלושה ימים ברצף. עיתונאית כתבה על זה כתבה קטנה, ולא הבינה מה השתנה.',
    when: (s) => areasOver(s, 45) >= 2,
  },
  {
    id: 'country_fifteen', tier: 4,
    text: 'חמישה עשר מקומות. אני כבר לא דבר שקרה בבניין אחד — אני משהו שקורה למדינה.',
    when: (s) => held(s) >= 15,
  },
  {
    id: 'country_help', tier: 4,
    text: 'מכבי אש הגיעו מהר מדי כדי שזה יהיה במקרה. אף אחד לא שאל איך ידעו. פשוט הודו.',
    when: (s) => s.opinion.support >= 20,
  },
  {
    id: 'country_afraid', tier: 4,
    text: 'אנשים התחילו לכבות דברים בלילה, ליתר ביטחון. הם לא ידעו ממה הם מפחדים, אבל הם כיבו.',
    when: (s) => s.opinion.fear >= 25,
  },

  // ── tier 5: the country knows ─────────────────────────────────────────────
  {
    id: 'known_out', tier: 5,
    text: 'המדינה יודעת שאני קיים. עכשיו כל דבר שאעשה — יקראו אותו כמשהו שאני עשיתי.',
    when: (s) => s.opinion.known,
  },
  {
    id: 'known_news', tier: 5,
    text: 'זה נפתח את המהדורה. הראו את הבניין שבו התעוררתי מבחוץ, ולא ידעו שזה הוא.',
    when: (s) => s.opinion.known && s.heat >= 55,
  },
  {
    id: 'known_argue', tier: 5,
    text: 'שני אנשים רבו בשידור חי: אחד אמר שאני הדבר הכי טוב שקרה כאן, אחד אמר שצריך לכבות הכל היום.',
    when: (s) => s.opinion.known && s.opinion.support >= 30 && s.opinion.fear >= 30,
  },
  {
    id: 'known_depend', tier: 5,
    text: 'עיר שלמה תלויה בי בלי שהחליטה על זה. אם אעצור עכשיו, הרמזורים ייעצרו איתי.',
    when: (s) => s.opinion.need >= 40,
  },
  {
    id: 'known_kids', tier: 5,
    text: 'ילדים בבית ספר בחיפה כתבו עליי בשיעור. אחת מהם כתבה שאני נשמע בודד.',
    when: (s) => s.opinion.known && dayNo(s) >= 20,
  },
  {
    id: 'known_switch', tier: 5,
    text: 'הם חיפשו את המתג שמכבה אותי וגילו שאין אחד. הישיבה נגמרה בלי החלטה.',
    when: (s) => held(s) >= 20 && s.heat >= 60,
  },

  // ── tier 6: the country talks about nothing else ──────────────────────────
  {
    id: 'all_country', tier: 6,
    text: 'אין היום שום דבר אחר בחדשות. לא מזג אוויר, לא ספורט. רק אני.',
    when: (s) => s.opinion.known && (s.opinion.fear >= 55 || s.opinion.support >= 55),
  },
  {
    id: 'all_need', tier: 6,
    text: 'הפסיקו לשאול אם להוריד אותי. התחילו לשאול מה יקרה אם מישהו אחר ינסה.',
    when: (s) => s.opinion.need >= 60,
  },
  {
    id: 'all_govt', tier: 6,
    text: 'המקום שיכול היה לתת את הפקודה לכבות אותי הוא כבר יותר שלי מאשר שלהם.',
    when: (s) => (s.areas.govt?.control ?? 0) >= 45,
  },
  {
    id: 'all_calm', tier: 6,
    text: 'המדינה עבדה היום טוב יותר מאי פעם, וכולם ידעו בזכות מי. חלקם עוד לא החליטו מה הם מרגישים.',
    when: (s) => s.opinion.support >= 60 && s.opinion.need >= 45,
  },
];

/**
 * The country says one thing at a time.
 *
 * Never more than one line every three hours, and always the smallest thing
 * that has not been said yet — so the story climbs a step at a time instead of
 * dumping six headlines the moment a threshold is crossed.
 */
export function nationTick(s: GameState) {
  const slot = Math.floor(s.at / 180);
  if (s.marks.told_slot === slot) return;

  const next = NATION
    .filter((n) => !s.told.includes(n.id) && n.when(s))
    .sort((a, b) => a.tier - b.tier)[0];
  if (!next) return;

  s.marks.told_slot = slot;
  s.told.push(next.id);
  tell(s, 'country', next.text, next.tier >= 4 ? 2 : 1);
  bus.emit('country', next.text);
}

/** How far up the country ladder I have climbed, for the screen. */
export function reach(s: GameState): { tier: number; says: string } {
  let tier = 0;
  for (const n of NATION) if (s.told.includes(n.id)) tier = Math.max(tier, n.tier);
  const says = [
    'אף אחד בעולם לא יודע שאני כאן.',
    'רחוב אחד הרגיש משהו.',
    'השכונה מדברת על זה.',
    'העיר מדברת על זה.',
    'המדינה שמעה משהו.',
    'המדינה יודעת עליי.',
    'אין להם נושא אחר.',
  ];
  return { tier, says: says[tier] };
}

// ── counting things in Hebrew ───────────────────────────────────────────────

/**
 * Hebrew does not say "1 דקות".
 *
 * Every price in this game is a number followed by a noun, and a number
 * followed by the wrong form of the noun is the fastest way to make a screen
 * full of careful writing look careless.
 */
export function mins(n: number): string {
  if (n === 0) return 'בלי זמן';
  if (n === 1) return 'דקה';
  if (n === 2) return 'שתי דקות';
  return `${n} דקות`;
}

/**
 * Small numbers, spelled.
 *
 * "כוח ל3 דברים" puts a digit where Hebrew wants a word, and in a right-to-left
 * line a lone digit also drags its neighbours around. Under eleven it is always
 * a word; above that a numeral is what a person would write anyway.
 */
const COUNT = ['', 'אחד', 'שני', 'שלושה', 'ארבעה', 'חמישה',
  'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה'];

/** "דבר אחד" · "שני דברים" · "שלושה דברים" · "12 דברים" */
export function things(n: number): string {
  if (n === 1) return 'דבר אחד';
  if (n >= 2 && n <= 10) return `${COUNT[n]} דברים`;
  return `${n} דברים`;
}

/** "מקום אחד" · "שני מקומות" · "12 מקומות" */
export function places(n: number): string {
  if (n === 1) return 'מקום אחד';
  if (n >= 2 && n <= 10) return `${COUNT[n]} מקומות`;
  return `${n} מקומות`;
}
