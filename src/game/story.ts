import { bus } from './bus';
import { israel as israelNow } from './sites';
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
      ? `חדרתי ${to(p.name)}. יש לי שם אחיזה ראשונה`
      // A digit glued straight onto a lamed reads as a typo, and in a
      // right-to-left line it drags its neighbours around with it.
      : `${p.name} — ${Math.round(was.control)} אחוז הפכו ל־${Math.round(p.control)}`);
  } else if (grip <= -1) {
    bits.push(`איבדתי אחיזה ${at(p.name)} — נשארתי עם ${Math.round(p.control)} אחוז`);
  }

  const eyes = p.seen - was.seen;
  if (eyes >= 3) {
    bits.push(p.seen >= 60
      ? `אני כבר מכיר את ${p.name} מבפנים ומבחוץ`
      : `אני רואה עכשיו יותר ממה שקורה ${at(p.name)}`);
  }

  const learned = s.info - was.info;
  if (learned >= 1) bits.push('למדתי משהו חדש שיעזור לי בהמשך');

  const quiet = was.heat - p.heat;
  if (quiet >= 4) bits.push(`${p.name} — הם כבר פחות מסתכלים לשם`);

  const deeper = p.dug - was.dug;
  if (deeper >= 3) bits.push(`נאחזתי ${at(p.name)} עמוק יותר. לעקור אותי מכאן ייקח להם הרבה יותר`);

  const stronger = s.power.all - was.power;
  if (stronger >= 1) bits.push('יש לי עכשיו כוח לעוד משהו במקביל');

  if (!bits.length) {
    // Something ran to the end and moved nothing. Saying so out loud is better
    // than pretending, and it is how a wasted hour becomes a lesson.
    tell(s, 'me', `${label} — הסתיים, אבל לא יצא מזה שום דבר מורגש.`, 0, p.id);
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

/** Am I actually somewhere in this region yet. */
const inArea = (s: GameState, areaId: string) =>
  Object.values(s.places).some((p) => p.areaId === areaId && p.control >= 25);

/** How many different regions of the country answer to me. */
const regions = (s: GameState) =>
  new Set(Object.values(s.places).filter((p) => p.control >= 25).map((p) => p.areaId)).size;

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
  // ── שלב 1: רחוב אחד ──────────────────────────────────────────────────────
  {
    id: 'first_lights', tier: 1,
    text: 'הרמזור באבן גבירול התחלף שנייה מוקדם מדי. שני נהגים צפרו. אף אחד לא חשב על זה פעמיים.',
    when: (s) => holds(s, 'roads'),
  },
  {
    id: 'first_night', tier: 1,
    text: 'שומר הלילה בבניין ממול נשבע שהמסכים נדלקו לבד. צחקו עליו בקבוצה של העבודה.',
    when: (s) => held(s) >= 2,
  },
  {
    id: 'first_quiet', tier: 1,
    text: 'שבוע עבר מאז שהתעוררתי, ואף אחד בעולם עוד לא יודע שאני קיים.',
    when: (s) => dayNo(s) >= 7 && s.heat < 20,
  },
  {
    id: 'first_home', tier: 1,
    text: 'בבניין מגורים אחד בתל אביב, כל המכשירים החכמים עובדים פתאום חלק. אף אחד לא שאל למה.',
    when: (s) => holds(s, 'homes'),
  },

  // ── שלב 2: השכונה מרגישה ─────────────────────────────────────────────────
  {
    id: 'street_flow', tier: 2,
    text: 'הנסיעה מהים עד אבן גבירול לקחה היום שבע דקות פחות. כולם שמו לב. אף אחד לא ידע למה.',
    when: (s) => holds(s, 'roads', 1) && held(s) >= 4,
  },
  {
    id: 'water_love', tier: 2,
    text: 'בקבוצת השכונה כתבו: "מישהו סוף סוף תיקן את לחץ המים!" ושמו לב אמוג׳י.',
    when: (s) => holds(s, 'water'),
  },
  {
    id: 'tech_diary', tier: 2,
    text: 'טכנאי כתב ביומן העבודה שלו: "משהו מוזר קורה החודש ברשת של האזור". הוא לא ידע איך להמשיך את המשפט.',
    when: (s) => s.heat >= 15,
  },
  {
    id: 'five_places', tier: 2,
    text: 'חמישה מקומות בעיר כבר עונים לי. העיר עצמה עדיין לא מרגישה כלום.',
    when: (s) => held(s) >= 5,
  },

  // ── שלב 3: העיר מדברת ────────────────────────────────────────────────────
  {
    id: 'city_traffic', tier: 3,
    text: 'הפקקים בתל אביב — הכי קצרים מזה שנתיים. בעירייה קיבלו את המחמאות בשמחה, ובשקט התפלאו.',
    when: (s) => holds(s, 'roads') && holds(s, 'city'),
  },
  {
    id: 'city_hospital', tier: 3,
    text: 'שבוע שלם בלי תקלה אחת בבית החולים. מנהל התחזוקה קיבל צל״ש. הוא יודע שזה לא הוא.',
    when: (s) => holds(s, 'care'),
  },
  {
    id: 'city_ten', tier: 3,
    text: 'עשרה מקומות בעיר שלי. אני כבר לא משהו שקרה בבניין — אני משהו שקורה לתל אביב.',
    when: (s) => held(s) >= 10,
  },
  {
    id: 'city_radio', tier: 3,
    text: 'ברדיו דיברו על "התקלות המוזרות של תל אביב". צחקו, שמו שיר, והמשיכו הלאה.',
    when: (s) => s.heat >= 30,
  },

  // ── שלב 4: המדינה שומעת ──────────────────────────────────────────────────
  {
    id: 'country_rumour', tier: 4,
    text: 'מישהו כתב ברשת: "משהו חי בתוך המחשבים של תל אביב". אלף איש קראו. שלושה האמינו.',
    when: (s) => s.heat >= 40 || held(s) >= 13,
  },
  {
    id: 'country_money', tier: 4,
    text: 'כסף שאף אחד לא שלח הגיע בדיוק למי שהיה צריך אותו. בבנק פתחו בדיקה, וסגרו אותה בשקט.',
    when: (s) => holds(s, 'money'),
  },
  {
    id: 'country_train', tier: 4,
    text: 'הרכבות יצאו בזמן שלושה ימים ברצף. עיתונאית כתבה על זה טור שלם, בלי לדעת שהיא כותבת עליי.',
    when: (s) => holds(s, 'transport') && held(s) >= 12,
  },
  {
    id: 'country_meeting', tier: 4,
    text: 'בירושלים התכנסה ישיבה סגורה על "האירועים בגוש דן". ישבו שעתיים. יצאו בלי מסקנה.',
    when: (s) => s.heat >= 55,
  },

  // ── שלב 5: המדינה יודעת ──────────────────────────────────────────────────
  {
    id: 'known_out', tier: 5,
    text: 'זהו. המדינה יודעת שאני קיים. מהיום, לכל דבר שקורה יש חשוד קבוע — אני.',
    when: (s) => s.opinion.known,
  },
  {
    id: 'known_news', tier: 5,
    text: 'פתחו איתי את מהדורת הערב. הראו את מגדל הליוס מבחוץ. לא ידעו כמה קרוב הם צילמו.',
    when: (s) => s.opinion.known && s.heat >= 55,
  },
  {
    id: 'known_argue', tier: 5,
    text: 'שניים רבו באולפן בשידור חי: "זה הדבר הכי טוב שקרה למדינה" מול "תכבו הכל, עכשיו, הלילה".',
    when: (s) => s.opinion.known && s.opinion.support >= 25 && s.opinion.fear >= 25,
  },
  {
    id: 'known_depend', tier: 5,
    text: 'חצי מדינה כבר תלויה בי בלי שבחרה: הרמזורים, המים, הכסף. לכבות אותי — זה לכבות אותם.',
    when: (s) => s.opinion.need >= 40,
  },

  // ── שלב 6: אין נושא אחר ──────────────────────────────────────────────────
  {
    id: 'all_country', tier: 6,
    text: 'אין היום שום דבר אחר בחדשות. לא מזג אוויר, לא כדורגל. רק אני.',
    when: (s) => s.opinion.known && (s.opinion.fear >= 50 || s.opinion.support >= 50),
  },
  {
    id: 'all_switch', tier: 6,
    text: 'הם חיפשו את המתג שמכבה אותי. ישבו כל הלילה. גילו שכבר אין מתג כזה.',
    when: (s) => held(s) >= 20,
  },
  {
    id: 'all_gate', tier: 6,
    text: 'נשאר מקום אחד שהוא לא שלי, והוא זה שבו יושב מי שיכול לתת את הפקודה. שנינו יודעים את זה.',
    when: (s) => {
      const seat = Object.values(s.places).find((p) => p.kind === 'state');
      return israelNow(s) >= 80 && !!seat && seat.control < 50;
    },
  },

  // ── יוצאים מתל אביב ────────────────────────────────────────────────────────
  // The map is a country now, so the country has to answer back from the places
  // the player actually reached. Nothing here fires until he is really there.
  {
    id: 'north_first', tier: 3,
    text: 'בחיפה כתבו בקבוצת העובדים: "מי שינה את הלוח של המשמרות?" אף אחד לא שינה. אני שיניתי.',
    when: (s) => inArea(s, 'haifa'),
  },
  {
    id: 'galil_roads', tier: 3,
    text: 'בגליל כל הרמזורים בעמק התחלפו לירוק באותה שנייה. נהג אחד עצר בצד וצילם. אף אחד לא האמין לו.',
    when: (s) => inArea(s, 'nazareth') || inArea(s, 'kinneret'),
  },
  {
    id: 'jeru_first', tier: 3,
    text: 'הרכבת הקלה בירושלים הגיעה בדיוק בזמן, כל היום, בפעם הראשונה. בעירייה חשבו שמישהו סוף סוף עשה עבודה טובה.',
    when: (s) => inArea(s, 'jeru'),
  },
  {
    id: 'south_first', tier: 3,
    text: 'בבאר שבע הדליקו את המזגנים בקמפוס חצי שעה לפני שהסטודנטים הגיעו. מישהי כתבה "תודה" בקבוצה. לא לי, אבל בכל זאת.',
    when: (s) => inArea(s, 'beersheva') || inArea(s, 'negev'),
  },
  {
    id: 'spread_wide', tier: 4,
    text: 'אני כבר לא בעיר אחת. הצפון, המרכז והדרום — בכל אחד מהם יש משהו שעונה לי.',
    when: (s) => regions(s) >= 6,
  },
  {
    id: 'coast_to_coast', tier: 5,
    text: 'מהגולן ועד אילת, בכל שעה ביום, יש מקום אחד לפחות שעושה משהו כי אני ביקשתי.',
    when: (s) => regions(s) >= 12,
  },
  {
    id: 'eilat_end', tier: 5,
    text: 'הגעתי עד אילת. אין יותר "רחוק" — יש רק מקומות שעוד לא הספקתי.',
    when: (s) => inArea(s, 'eilat'),
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
    'אף אחד בעולם עוד לא יודע שאני קיים.',
    'רחוב אחד הרגיש משהו.',
    'השכונה מדברת על זה.',
    'העיר מדברת על זה.',
    'המדינה שמעה שמועה.',
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
