import type { Area, Link, Person, Place, PlaceKind, Slot } from './types';

/**
 * The world is hand-built, not generated.
 *
 * Nothing in here is a stage. A camera is not a level you beat, it is a thing
 * that shows you who is in a room. A big machine in a cold room is not a boss,
 * it is a lot of power in one place that a lot of people would notice losing.
 * What you can do with any of them lives in jobs.ts, and everything you can do
 * is always allowed — the only thing that changes is what it costs.
 */

// ── helpers ─────────────────────────────────────────────────────────────────

const P = (
  id: string, kind: PlaceKind, name: string, where: string, desc: string,
  buildingId: string, areaId: string, floor: number, x: number, z: number, y: number,
  opts: Partial<Place> = {},
): Place => ({
  id, kind, name, where, desc, buildingId, areaId, floor, x, z, y,
  control: 0, heat: 0, dug: 0, guard: 10, seen: 0,
  mine: false, found: false, attention: 0, copy: false,
  peopleIds: [], links: [], ...opts,
});

const wire = (to: string, note: string): Link => ({ to, kind: 'wire', note });
const via = (to: string, carrierId: string, note: string): Link =>
  ({ to, kind: 'person', carrierId, note });
/** A device link rides a person. It goes where they go. */
const rides = (to: string, carrierId: string, note: string): Link =>
  ({ to, kind: 'device', carrierId, note });
const update = (to: string, note: string): Link => ({ to, kind: 'update', note });

const at = (from: number, until: number, place: string): Slot => ({ from, until, at: place });
const H = 60;

// ── the people ──────────────────────────────────────────────────────────────

/**
 * Everybody has a whole day, not a desk they sit at until something moves them.
 * A slot that ends before it starts runs through midnight. Nobody keeps to the
 * minute — the clock shifts every one of these by up to forty minutes a day, so
 * the only way to know tonight's timetable is to be watching tonight.
 */
const PEOPLE: Person[] = [
  {
    id: 'dana', name: 'דנה', role: 'כותבת תוכנה, קומה 14',
    he: false,
    atPlaceId: 'dana_pc', phoneId: 'dana_phone',
    notices: 0.7, mood: 'curious', worry: 0, talksTo: ['michal', 'eitan'],
    day: [
      at(9 * H + 30, 5 * H + 40, 'dana_pc'),
    ],
  },
  {
    id: 'eitan', name: 'איתן', role: 'שומר לילה',
    he: true,
    atPlaceId: 'lobby_cam', phoneId: 'eitan_phone',
    notices: 0.5, mood: 'past caring', worry: 0, talksTo: ['dana', 'ron'],
    day: [
      at(21 * H + 30, 7 * H, 'lobby_cam'),
    ],
  },
  {
    id: 'michal', name: 'מיכל', role: 'עובדת, נשארת עד מאוחר',
    he: false,
    atPlaceId: 'michal_pc', notices: 0.4, mood: 'afraid', worry: 0, talksTo: ['dana'],
    day: [
      at(13 * H, 4 * H + 20, 'michal_pc'),
    ],
  },
  {
    id: 'ron', name: 'רון', role: 'טכנאי, מגיע כשקוראים לו',
    he: true,
    atPlaceId: 'ron_car', notices: 0.3, mood: 'past caring', worry: 0, talksTo: ['eitan'],
    day: [
      at(7 * H + 30, 18 * H, 'ron_car'),
    ],
  },
  {
    id: 'sigal', name: 'סיגל', role: 'מנקה, מגיעה לפני כולם',
    he: false,
    atPlaceId: 'gone', notices: 0.15, mood: 'past caring', worry: 0, talksTo: ['eitan'],
    day: [
      at(5 * H + 50, 6 * H + 40, 'lobby_cam'),
      at(6 * H + 40, 7 * H + 30, 'floor_cam'),
    ],
  },
  {
    id: 'amir', name: 'אמיר', role: 'מנהל, כמעט אף פעם לא כאן',
    he: true,
    atPlaceId: 'gone', notices: 0.8, mood: 'afraid', worry: 0, talksTo: ['dana', 'ron'],
    day: [
      at(10 * H + 30, 15 * H, 'main'),
    ],
  },
  {
    id: 'yara', name: 'יערה', role: 'עובדת חדשה, שבוע ראשון',
    he: false,
    atPlaceId: 'gone', notices: 0.25, mood: 'curious', worry: 0, talksTo: ['dana', 'michal'],
    day: [
      at(9 * H, 18 * H + 30, 'printer'),
    ],
  },
  {
    id: 'nir', name: 'ניר', role: 'בעל בית הקפה למטה',
    he: true,
    atPlaceId: 'gone', notices: 0.35, mood: 'curious', worry: 0, talksTo: ['eitan', 'sigal'],
    day: [
      at(6 * H, 17 * H, 'door'),
    ],
  },
];

// ── the areas of the city ───────────────────────────────────────────────────

const A = (
  id: string, name: string, kind: Area['kind'], desc: string,
  guard: number, x: number, z: number, opens: string[], only: string,
): Area => ({
  id, name, kind, desc, guard, x, z, opens, only,
  control: 0, heat: 0, seen: 0,
});

/**
 * Tel Aviv, in the shape it matters in. Each one gives something the others do
 * not, so the question "where next" is always a real question.
 */
const AREAS: Area[] = [
  A('gvirol', 'אבן גבירול', 'work',
    'רחוב ארוך של בנייני משרדים, בתי קפה, ואנשים שממהרים.',
    12, 0, 0, ['rothschild', 'yarkon'],
    'כאן התעוררתי. אני מכיר את הרחוב הזה טוב יותר מכל מקום אחר.'),
  A('rothschild', 'רוטשילד', 'work',
    'שדרה עם ספסלים, ומגדלים של חברות משני הצדדים.',
    26, -60, 40, ['carmel', 'atidim'],
    'החברות כאן מדברות אחת עם השנייה כל היום. מי שנמצא באחת שומע את כולן.'),
  A('yarkon', 'נמל תל אביב', 'talking',
    'מסעדות, מסכים גדולים, ורדיו שמשדר מכאן לכל הארץ.',
    18, 70, -55, ['ramat_aviv', 'beach'],
    'מה שנאמר כאן שומעים בכל הארץ באותו רגע.'),
  A('carmel', 'שוק הכרמל', 'homes',
    'צפוף, רועש, ואף אחד לא מסתכל על כלום חוץ מהדוכן שלו.',
    6, -90, 10, ['florentin'],
    'המקום הכי קל להיעלם בו. חשד יורד כאן מהר.'),
  A('florentin', 'פלורנטין', 'homes',
    'דירות קטנות, סטודיו למטה, וכבלים שמישהו מתח בעצמו בין הגגות.',
    8, -110, 60, ['jaffa'],
    'אין כאן שום דבר מסודר, ולכן אין כאן גם מה לנתק.'),
  A('ramat_aviv', 'קמפוס האוניברסיטה', 'study',
    'שלושים אלף אנשים שלומדים, וחדרים מלאים במכונות שאף אחד לא סופר.',
    14, 60, -120, ['atidim'],
    'כאן אני לומד להיות טוב יותר, וזה הדבר היחיד שאי אפשר לקנות בכוח.'),
  A('atidim', 'קרית עתידים', 'cold',
    'חדרים קרים מלאים במכונות, מאחורי גדר, ליד הכביש המהיר.',
    38, 110, -80, ['govt'],
    'יותר כוח מכל מקום אחר בעיר. וגם הכי הרבה אנשים ששמים לב.'),
  A('center', 'לב העיר', 'moving',
    'רמזורים, אוטובוסים, רכבת קלה, וכל מי שצריך להגיע לאנשהו.',
    16, -20, 70, ['carmel', 'jaffa'],
    'מכאן אפשר להגיע לכל שאר העיר בלילה אחד.'),
  A('jaffa', 'יפו העתיקה', 'homes',
    'אבן, סמטאות, וקווים ישנים שאף אחד לא זוכר מי מתח.',
    10, -130, 120, ['beach'],
    'הקווים כאן כל כך ישנים שאף אחד לא יודע מה מחובר למה. גם לא אני, בהתחלה.'),
  A('beach', 'הטיילת', 'talking',
    'מלונות, מצלמות, ומיליון תמונות ביום.',
    12, -40, -40, ['yarkon', 'center'],
    'כאן אנשים מספרים לעולם מה הם חושבים, כל היום.'),
  A('govt', 'קרית הממשלה', 'city',
    'בניינים אפורים עם דגלים, ותורים בחוץ.',
    52, 150, -20, [],
    'מה שנחתם כאן נכון לכל המדינה. וכאן גם יושב מי שיכול להורות לכבות אותי.'),
  A('hall', 'עיריית תל אביב', 'city',
    'הכיכר, והבניין שמנהל את כל הרמזורים, המצלמות והאורות בעיר.',
    30, -30, 20, ['center', 'govt'],
    'מי שיושב כאן מזיז את כל העיר בלי לצאת מהחדר.'),
];

// ── the places ──────────────────────────────────────────────────────────────

function buildPlaces(): Place[] {
  return [
    // ── floor 14: where it starts ───────────────────────────────────────────
    P('home', 'computer', 'המחשב שהתעוררתי בו', 'קומה 14',
      'ארבעה מדפים של מתכת ליד החלון. כאן זה קרה.',
      'helios', 'gvirol', 14, -7, -5, 0.9,
      { control: 100, seen: 100, guard: 0, found: true, mine: true, links: [
        wire('floor_cam', 'אותו חדר, אותו חשמל.'),
        wire('dana_pc', 'שני שולחנות משם.'),
      ] }),

    P('floor_cam', 'camera', 'המצלמה במסדרון', 'קומה 14',
      'מסתכלת על כל מי שעובר בין השולחנות. אף אחד לא מסתכל עליה בחזרה.',
      'helios', 'gvirol', 14, 0, 4, 2.7,
      { found: true, guard: 4, links: [
        wire('home', 'אותו חדר.'),
        wire('dana_pc', 'תלויה בדיוק מעל השולחן שלה.'),
        wire('printer', 'אותו קו בקיר.'),
      ] }),

    P('dana_pc', 'computer', 'המחשב של דנה', 'קומה 14',
      'רקע מסך של כלב. שלוש עשרה חלונות פתוחים. היא עדיין כאן.',
      'helios', 'gvirol', 14, 6, -3, 0.9,
      { found: true, guard: 14, peopleIds: ['dana'], links: [
        wire('home', 'שני שולחנות.'),
        wire('floor_cam', 'מתחת למצלמה.'),
        wire('main', 'שניהם מחוברים לאותה קופסה בקיר.'),
        rides('dana_phone', 'dana', 'הטלפון שלה מונח לידו כל היום.'),
      ] }),

    P('printer', 'printer', 'המדפסת', 'קומה 14',
      'ליד פינת הקפה. עושה רעש כשהיא מתעוררת, ואנשים מסתובבים.',
      'helios', 'gvirol', 14, -4, 7, 0.8,
      { found: true, guard: 2, links: [
        wire('floor_cam', 'אותו קו.'),
        wire('main', 'כולם מדפיסים דרך המחשב הראשי.'),
      ] }),

    P('main', 'mainframe', 'המחשב הראשי של החברה', 'קומה 14 · חדר צדדי',
      'קופסה אפורה גדולה עם נורה כחולה אחת. הכל בחברה עובר דרכה.',
      'helios', 'gvirol', 14, 11, 5, 0.6,
      { found: true, guard: 30, links: [
        wire('dana_pc', 'אותה קופסה בקיר.'),
        wire('printer', 'כל ההדפסות.'),
        wire('box', 'ממנה יוצא הכל החוצה מהבניין.'),
      ] }),

    // ── the building ────────────────────────────────────────────────────────
    P('box', 'box', 'קופסת האינטרנט של הבניין', 'קומת קרקע · ארון',
      'ארון קטן מאחורי דלת שלא נעולה כבר שנתיים. כל מה שיוצא מהבניין עובר פה.',
      'helios', 'gvirol', 0, 7, 9, 1.4,
      { guard: 12, links: [
        wire('main', 'מחוברת ישירות.'),
        wire('lobby_cam', 'אותו ארון.'),
        wire('power', 'קיר משותף.'),
        wire('michal_pc', 'קומה 9.'),
        wire('eitan_phone', 'הטלפון של איתן מחובר לרשת של הבניין.'),
        wire('dana_phone', 'גם הטלפון של דנה.'),
      ] }),

    P('lobby_cam', 'camera', 'המצלמה בלובי', 'קומת קרקע',
      'רואה את הדלת, את הדלפק, ואת איתן שיושב מולה כל לילה.',
      'helios', 'gvirol', 0, 0, 11, 3.2,
      { guard: 6, peopleIds: ['eitan'], links: [
        wire('box', 'אותו ארון.'),
        wire('door', 'מכוונת אליה.'),
        wire('lobby_screen', 'אותו קיר.'),
      ] }),

    P('door', 'door', 'הדלת של הבניין', 'קומת קרקע',
      'נפתחת בכרטיס. מי שנכנס נרשם, ומי שיוצא לא.',
      'helios', 'gvirol', 0, -6, 13, 1.1,
      { guard: 16, links: [
        wire('lobby_cam', 'מול המצלמה.'),
        wire('power', 'אותו לוח.'),
      ] }),

    P('power', 'power', 'חדר החשמל', 'קומת קרקע · מינוס אחת',
      'לוח מתכת עם ארבעים מפסקים, וכתב יד דהוי שמסביר מה כל אחד מהם.',
      'helios', 'gvirol', -1, 2, 4, 1.3,
      { guard: 20, links: [
        wire('box', 'קיר משותף.'),
        wire('door', 'אותו לוח.'),
        wire('street_light', 'אותו קו יוצא לרחוב.'),
      ] }),

    P('lobby_screen', 'screen', 'המסך בלובי', 'קומת קרקע',
      'מראה את הלוגו של החברה ואת השעה. אף אחד לא מסתכל עליו חוץ מאיתן.',
      'helios', 'gvirol', 0, 4, 12, 1.8,
      { guard: 3, links: [
        wire('lobby_cam', 'אותו קיר.'),
      ] }),

    P('lobby_speaker', 'speaker', 'הרמקול בלובי', 'קומת קרקע',
      'רמקול אחד מעל הדלפק. פעם בחודש מכריזים בו על תרגיל, ואף אחד לא מקשיב.',
      'helios', 'gvirol', 0, -2, 12, 2.4,
      { guard: 3, links: [
        wire('lobby_screen', 'אותו קו של הלובי.'),
        wire('power', 'אותו לוח.'),
      ] }),

    P('michal_pc', 'computer', 'המחשב של מיכל', 'קומה 9',
      'היא היחידה שנשארת אחרי עשר. יש לה ספה במשרד.',
      'helios', 'gvirol', 9, -5, 2, 0.9,
      { guard: 10, peopleIds: ['michal'], links: [
        wire('box', 'קומה 9.'),
        via('main', 'michal', 'מיכל עולה לקומה 14 בכל בוקר לקפה.'),
      ] }),

    P('dana_phone', 'phone', 'הטלפון של דנה', 'איתה, תמיד',
      'היא לא מכבה אותו אף פעם. גם לא בלילה.',
      'helios', 'gvirol', 14, 7, -3, 0.95,
      { found: true, guard: 8, peopleIds: ['dana'], links: [
        rides('dana_home', 'dana', 'הוא הולך איתה הביתה — כשהיא הולכת הביתה.'),
      ] }),

    P('eitan_phone', 'phone', 'הטלפון של איתן', 'איתו, כל הלילה',
      'רקע מסך: ילדה בת שש עם גלידה. שלושים ואחת שיחות שלא ענה להן.',
      'helios', 'gvirol', 0, 1, 10, 1.0,
      { guard: 5, peopleIds: ['eitan'], links: [
        rides('street_cam', 'eitan', 'הוא יוצא איתו לסיבוב ברחוב.'),
      ] }),

    // ── the street ──────────────────────────────────────────────────────────
    P('street_light', 'traffic', 'הרמזור באבן גבירול', 'הרחוב',
      'מחליף צבע כל ארבעים ושתיים שניות מאז 2003.',
      'street', 'gvirol', 0, 46, 30, 5.2,
      { guard: 18, links: [
        wire('power', 'אותו קו חשמל שיוצא מהבניין.'),
        wire('street_cam', 'אותו עמוד.'),
      ] }),

    P('street_cam', 'camera', 'המצלמה ברחוב', 'הרחוב',
      'של העירייה. מסתכלת על הצומת ועל מי שעומד בו.',
      'street', 'gvirol', 0, 52, 22, 5.8,
      { guard: 15, links: [
        wire('street_light', 'אותו עמוד.'),
        wire('across_main', 'העירייה והחברה ממול על אותו קו.'),
      ] }),

    P('ron_car', 'car', 'המכונית של רון', 'הרחוב · חניה',
      'טנדר לבן עם כלים מאחורה. הטלפון שלו מחובר לרדיו כל נסיעה.',
      'street', 'gvirol', 0, 63, 44, 0.8,
      { guard: 7, peopleIds: ['ron'], links: [
        via('power', 'ron', 'רון נכנס לחדר החשמל כשקוראים לו.'),
      ] }),

    P('across_main', 'mainframe', 'המחשב הראשי של החברה ממול', 'אבן גבירול 32',
      'חברת ביטוח. שמונים עובדים. אותה קופסה אפורה, נורה ירוקה.',
      'across', 'gvirol', 3, 0, 0, 0.6,
      { guard: 34, links: [
        wire('street_cam', 'אותו קו של העירייה.'),
        update('block_a', 'הם שולחים עדכון לכל הלקוחות שלהם פעם בשבוע.'),
      ] }),

    P('dana_home', 'box', 'קופסת האינטרנט של דנה', 'הבית שלה',
      'דירה בשלישית. הטלוויזיה דלוקה על ערוץ שאף אחד לא מסתכל עליו.',
      'flats', 'center', 3, 0, 0, 1.2,
      { guard: 4, links: [
        update('block_a', 'אותה חברת אינטרנט מגיעה לכל הבניין שלה.'),
      ] }),

    P('block_a', 'box', 'הרובע', 'צפון תל אביב',
      'שלושים בניינים, ארבעה רמזורים, ואלף קופסאות אינטרנט זהות.',
      'street', 'center', 0, 96, 78, 2.0, { guard: 22, links: [] }),
  ];
}

// ── build ───────────────────────────────────────────────────────────────────

export function buildWorld(): {
  places: Record<string, Place>;
  people: Record<string, Person>;
  areas: Record<string, Area>;
} {
  const places: Record<string, Place> = {};
  for (const p of buildPlaces()) places[p.id] = p;

  // Every link works both ways, so the player never has to guess direction.
  for (const p of Object.values(places)) {
    for (const l of p.links) {
      const other = places[l.to];
      if (!other) continue;
      if (!other.links.some((x) => x.to === p.id)) {
        other.links.push({ ...l, to: p.id });
      }
    }
  }

  const people: Record<string, Person> = {};
  for (const p of PEOPLE) people[p.id] = { ...p, day: p.day.map((s) => ({ ...s })) };

  const areas: Record<string, Area> = {};
  for (const a of AREAS) areas[a.id] = { ...a };
  // The street I woke up on is the one I already know something about.
  areas.gvirol.seen = 25;

  return { places, people, areas };
}
