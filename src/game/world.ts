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

/**
 * Israel, as the places worth taking.
 *
 * Twenty-four of them, and not one is an object: each is a whole company, a
 * whole hospital, a whole neighbourhood, a whole grid. They open one another in
 * a rough order — the street you woke on, then the city, then the country — but
 * the order is a suggestion the map makes, never a gate, because a player who
 * finds a way to a power station on night three has earned the power station.
 */
function buildPlaces(): Place[] {
  return [
    // ── the street I woke on ────────────────────────────────────────────────
    P('helios', 'company', 'מגדל הליוס', 'אבן גבירול',
      'שמונים אנשים, ארבע עשרה קומות, ומכונות שעובדות כל הלילה בשביל אף אחד.',
      'helios', 'gvirol', 14, 0, 0, 1,
      // Not quite all of it. Waking up already finished with the only place you
      // are in leaves exactly one button on the first screen you look at, and
      // teaches nothing; a few floors still to take teaches spreading in the
      // first minute, which is the action the whole game is built on.
      { control: 72, seen: 100, guard: 0, found: true, mine: true, links: [
        wire('across', 'אותו רחוב, אותו קו שנכנס לשני הבניינים.'),
        wire('gvirol_lights', 'הרמזור בפינה מקבל חשמל מאותו לוח.'),
        via('dana_home', 'dana', 'דנה נוסעת הביתה כל ערב, והטלפון שלה בא איתה.'),
      ] }),

    P('across', 'company', 'הבניין ממול', 'אבן גבירול',
      'חברה קטנה יותר, שומר אחד, ואף אחד שמסתכל על כלום אחרי שש.',
      'across', 'gvirol', 6, 78, -14, 1,
      { guard: 8, links: [
        wire('gvirol_lights', 'אותו ארון חשמל ברחוב.'),
      ] }),

    P('gvirol_lights', 'roads', 'הרמזורים באבן גבירול', 'הרחוב עצמו',
      'ארבעה עשר רמזורים, ותיבה אפורה אחת שמחליטה בשביל כולם.',
      'street', 'gvirol', 0, 30, 30, 2,
      { guard: 14, links: [
        wire('center_roads', 'כל הרמזורים בעיר מדברים עם אותו חדר.'),
      ] }),

    P('dana_home', 'homes', 'הבית של דנה', 'צפון תל אביב',
      'בניין מגורים אחד מתוך אלף. אף אחד כאן לא סופר כלום.',
      'flats', 'center', 3, -70, 22, 1,
      { guard: 4, links: [
        wire('florentin', 'אותה שכונה, אותם קווים ישנים.'),
      ] }),

    // ── תל אביב ─────────────────────────────────────────────────────────────
    P('center_roads', 'roads', 'חדר הבקרה של הרמזורים', 'לב העיר',
      'חדר אחד עם קיר מסכים, ושני אנשים שמסתכלים עליו בתורנות.',
      'street', 'center', 0, -20, 70, 2,
      { guard: 30, links: [
        wire('city_hall', 'העירייה יושבת שתי קומות מעל.'),
        wire('trains', 'הרכבת הקלה מסתנכרנת עם הרמזורים.'),
      ] }),

    P('city_hall', 'city', 'עיריית תל אביב', 'הכיכר',
      'הבניין שמנהל את כל האורות, המצלמות והמים בעיר.',
      'street', 'hall', 0, -30, 20, 3,
      { guard: 42, links: [
        wire('ta_water', 'המים של העיר מנוהלים מכאן.'),
        wire('govt', 'מה שהעירייה מבקשת עובר לירושלים.'),
      ] }),

    P('ta_water', 'water', 'המים של תל אביב', 'מתחת לעיר',
      'צינורות שאף אחד לא ראה, ומשאבות שאף אחד לא שומע.',
      'street', 'hall', -1, -46, 34, 0,
      { guard: 26, links: [
        wire('national_water', 'הקו הארצי מגיע עד לכאן.'),
      ] }),

    P('trains', 'transport', 'הרכבת הקלה', 'לב העיר',
      'שלוש מאות אלף אנשים ביום, וכל אחד מהם עם מכשיר בכיס.',
      'street', 'center', 0, 10, 92, 2,
      { guard: 24, links: [
        wire('airport', 'אותו לוח זמנים ארצי.'),
        wire('haifa_port', 'הרכבת ממשיכה צפונה.'),
      ] }),

    P('carmel', 'homes', 'שוק הכרמל', 'דרום תל אביב',
      'צפוף, רועש, ואף אחד לא מסתכל על כלום חוץ מהדוכן שלו.',
      'street', 'carmel', 0, -90, 10, 1,
      { guard: 6, links: [
        wire('florentin', 'אותה שכונה, כמעט אותם קווים.'),
      ] }),

    P('florentin', 'homes', 'פלורנטין', 'דרום תל אביב',
      'דירות קטנות, כבלים שמישהו מתח בעצמו בין הגגות, ואפס סדר.',
      'street', 'florentin', 0, -110, 60, 1,
      { guard: 5, links: [
        wire('jaffa', 'סמטה אחת מפרידה.'),
      ] }),

    P('jaffa', 'homes', 'יפו העתיקה', 'דרום תל אביב',
      'אבן, סמטאות, וקווים ישנים שאף אחד לא זוכר מי מתח.',
      'street', 'jaffa', 0, -130, 120, 1,
      { guard: 8, links: [] }),

    P('ichilov', 'care', 'איכילוב', 'לב העיר',
      'אלף מיטות, אלפי מכונות, ואף רגע שבו אפשר לכבות משהו כדי לבדוק.',
      'street', 'center', 0, -8, 44, 2,
      { guard: 34, links: [
        wire('ta_uni', 'הרופאים כאן מלמדים שם.'),
      ] }),

    P('ta_uni', 'study', 'אוניברסיטת תל אביב', 'רמת אביב',
      'שלושים אלף אנשים שלומדים, וחדרים מלאים במכונות שאף אחד לא סופר.',
      'street', 'ramat_aviv', 0, 60, -120, 2,
      { guard: 18, links: [
        wire('atidim', 'החוקרים כאן שוכרים מקום שם.'),
      ] }),

    P('atidim', 'company', 'קרית עתידים', 'צפון תל אביב',
      'חדרים קרים מלאים במכונות, מאחורי גדר, ליד הכביש המהיר.',
      'street', 'atidim', 0, 110, -80, 2,
      { guard: 40, links: [
        wire('ta_power', 'הם צורכים חשמל כמו עיר קטנה.'),
        wire('bank', 'הכסף של חצי המדינה עובר דרך המכונות כאן.'),
      ] }),

    P('ta_power', 'power', 'תחנת הכוח של תל אביב', 'קצה העיר',
      'שלוש ארובות, גדר, ולוח אחד שמחליט מי מקבל חשמל.',
      'street', 'atidim', 0, 140, -110, 3,
      { guard: 46, links: [
        wire('national_power', 'הקו הארצי מתחיל כאן.'),
      ] }),

    P('radio', 'talk', 'הרדיו בנמל', 'נמל תל אביב',
      'אולפן אחד, ומה שנאמר בו נשמע בכל הארץ באותו רגע.',
      'street', 'yarkon', 0, 70, -55, 2,
      { guard: 28, links: [
        wire('tv_news', 'אותה חברה מפעילה גם את מהדורת הערב.'),
      ] }),

    P('beach', 'talk', 'הטיילת', 'קו הים',
      'מלונות, מצלמות, ומיליון תמונות ביום שכולן יוצאות החוצה.',
      'street', 'beach', 0, -40, -40, 1,
      { guard: 10, links: [] }),

    // ── הארץ ────────────────────────────────────────────────────────────────
    P('bank', 'money', 'הבנק הגדול', 'רמת גן',
      'בניין אחד שדרכו עובר הכסף של חצי המדינה, כל יום, בלי שאף אחד מרגיש.',
      'street', 'atidim', 0, 150, -60, 3,
      { guard: 52, links: [
        wire('govt', 'משרד האוצר מדבר איתם כל בוקר.'),
      ] }),

    P('tv_news', 'talk', 'מהדורת הערב', 'ירושלים',
      'שלושים דקות ביום שבהן כל המדינה מסתכלת על אותו דבר.',
      'street', 'govt', 0, 168, -44, 2,
      { guard: 38, links: [] }),

    P('airport', 'transport', 'נמל התעופה', 'מרכז הארץ',
      'הדלת של המדינה. הכל נכנס ויוצא דרכה, וכולם ממהרים.',
      'street', 'center', 0, 120, 60, 2,
      { guard: 44, links: [
        wire('national_roads', 'כל הכבישים מגיעים לכאן.'),
      ] }),

    P('haifa_port', 'transport', 'נמל חיפה', 'הצפון',
      'מנופים, מכולות, ולוח זמנים שאף אחד לא מעז לשנות.',
      'street', 'ramat_aviv', 0, 40, -190, 2,
      { guard: 36, links: [
        wire('national_power', 'הם מקבלים חשמל בקו נפרד משלהם.'),
      ] }),

    P('national_power', 'power', 'חברת החשמל', 'כל הארץ',
      'חדר אחד בצפון שמחליט מי מקבל חשמל בכל הארץ, ומתי.',
      'street', 'atidim', 0, 170, -140, 3,
      { guard: 62, links: [
        wire('govt', 'הם מדווחים לממשלה כל שעה.'),
      ] }),

    P('national_water', 'water', 'הקו הארצי של המים', 'כל הארץ',
      'צינור אחד מהצפון עד הנגב, ומשאבות שרצות בלי לעצור.',
      'street', 'hall', -1, 100, 140, 0,
      { guard: 48, links: [] }),

    P('national_roads', 'roads', 'הכבישים הארציים', 'כל הארץ',
      'כל כביש מהיר, כל מנהרה, כל שער — ומרכז אחד שרואה את כולם.',
      'street', 'center', 0, 90, 110, 2,
      { guard: 40, links: [] }),

    P('govt', 'state', 'קרית הממשלה', 'ירושלים',
      'בניינים אפורים עם דגלים. מה שנחתם כאן נכון לכל המדינה — '
      + 'וכאן גם יושב מי שיכול להורות לכבות אותי.',
      'street', 'govt', 0, 150, -20, 4,
      { guard: 70, links: [] }),
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
