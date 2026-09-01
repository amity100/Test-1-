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
  control: 0, heat: 0, seen: 0, span: 96,
});

/**
 * Tel Aviv, in the shape it matters in. Each one gives something the others do
 * not, so the question "where next" is always a real question.
 */
const AREAS: Area[] = [
  A('gvirol', 'אבן גבירול', 'work',
    'רחוב ארוך של בנייני משרדים, בתי קפה, ואנשים שממהרים.',
    12, 577, 470, ['rothschild', 'yarkon'],
    'כאן התעוררתי. אני מכיר את הרחוב הזה טוב יותר מכל מקום אחר.'),
  A('rothschild', 'רוטשילד', 'work',
    'שדרה עם ספסלים, ומגדלים של חברות משני הצדדים.',
    26, -213, 742, ['carmel', 'atidim'],
    'החברות כאן מדברות אחת עם השנייה כל היום. מי שנמצא באחת שומע את כולן.'),
  A('yarkon', 'נמל תל אביב', 'talking',
    'מסעדות, מסכים גדולים, ורדיו שמשדר מכאן לכל הארץ.',
    18, -343, -1166, ['ramat_aviv', 'beach'],
    'מה שנאמר כאן שומעים בכל הארץ באותו רגע.'),
  A('carmel', 'שוק הכרמל', 'homes',
    'צפוף, רועש, ואף אחד לא מסתכל על כלום חוץ מהדוכן שלו.',
    6, -732, 940, ['florentin'],
    'המקום הכי קל להיעלם בו. חשד יורד כאן מהר.'),
  A('florentin', 'פלורנטין', 'homes',
    'דירות קטנות, סטודיו למטה, וכבלים שמישהו מתח בעצמו בין הגגות.',
    8, -602, 1459, ['jaffa'],
    'אין כאן שום דבר מסודר, ולכן אין כאן גם מה לנתק.'),
  A('ramat_aviv', 'קמפוס האוניברסיטה', 'study',
    'שלושים אלף אנשים שלומדים, וחדרים מלאים במכונות שאף אחד לא סופר.',
    14, 1111, -1380, ['atidim', 'netanya'],
    'כאן אני לומד להיות טוב יותר, וזה הדבר היחיד שאי אפשר לקנות בכוח.'),
  A('atidim', 'קרית עתידים', 'cold',
    'חדרים קרים מלאים במכונות, מאחורי גדר, ליד הכביש המהיר.',
    38, 1910, -844, ['govt', 'petah'],
    'יותר כוח מכל מקום אחר בעיר. וגם הכי הרבה אנשים ששמים לב.'),
  A('center', 'לב העיר', 'moving',
    'רמזורים, אוטובוסים, רכבת קלה, וכל מי שצריך להגיע לאנשהו.',
    16, -93, 43, ['carmel', 'jaffa', 'rishon', 'ramla'],
    'מכאן אפשר להגיע לכל שאר העיר בלילה אחד.'),
  A('jaffa', 'יפו העתיקה', 'homes',
    'אבן, סמטאות, וקווים ישנים שאף אחד לא זוכר מי מתח.',
    10, -1537, 1703, ['beach'],
    'הקווים כאן כל כך ישנים שאף אחד לא יודע מה מחובר למה. גם לא אני, בהתחלה.'),
  A('beach', 'הטיילת', 'talking',
    'מלונות, מצלמות, ומיליון תמונות ביום.',
    12, -758, 55, ['yarkon', 'center'],
    'כאן אנשים מספרים לעולם מה הם חושבים, כל היום.'),
  A('govt', 'קרית הממשלה', 'city',
    'בניינים אפורים עם דגלים, ותורים בחוץ.',
    52, 5000, 300, ['jeru'],
    'מה שנחתם כאן נכון לכל המדינה. וכאן גם יושב מי שיכול להורות לכבות אותי.'),
  A('hall', 'עיריית תל אביב', 'city',
    'הכיכר, והבניין שמנהל את כל הרמזורים, המצלמות והאורות בעיר.',
    30, 244, 28, ['center', 'govt'],
    'מי שיושב כאן מזיז את כל העיר בלי לצאת מהחדר.'),

  // ── והמדינה, מצפון לדרום ───────────────────────────────────────────────────
  // Twelve places in Tel Aviv is not a country, and the player said so: he
  // wants somewhere to keep expanding to. So the map now runs the length of
  // Israel, and every region gives something the previous one could not.
  A('petah', 'פתח תקווה', 'work',
    'אזור תעשייה ענק, ומחסנים שעובדים כשכל השאר ישן.',
    20, 2900, -400, ['ramla', 'rishon'],
    'כאן מייצרים ומאחסנים. מי ששולט כאן שולט במה שמגיע למדפים.'),
  A('rishon', 'ראשון לציון', 'homes',
    'שכונות חדשות, קניון גדול, וכבישים רחבים.',
    14, -700, 2500, ['rehovot'],
    'עיר שלמה של אנשים רגילים. הכי קל להיטמע בין כולם.'),
  A('rehovot', 'רחובות', 'study',
    'מכוני מחקר בין פרדסים, ואנשים ששואלים שאלות כל היום.',
    22, -200, 3200, ['ashdod'],
    'כאן חושבים לעומק. מה שאני לומד כאן — נשאר איתי.'),
  A('ramla', 'רמלה ולוד', 'moving',
    'שתי ערים על אם הדרך, ובאמצע הכביש שעולה לירושלים.',
    18, 3300, 700, ['jeru'],
    'הדרך לירושלים עוברת כאן, ואני איתה.'),
  A('jeru', 'ירושלים', 'city',
    'העיר העתיקה, השווקים, והבניינים שמחליטים בשביל כולם.',
    44, 4600, 500, ['govt', 'negev'],
    'מה שקורה כאן — קורה למדינה כולה.'),
  A('netanya', 'נתניה', 'homes',
    'מגדלים מול הים, ואלפי מרפסות עם אותו נוף.',
    12, -300, -2900, ['haifa'],
    'עיר שקטה על הדרך צפונה. אף אחד לא מחפש כאן.'),
  A('haifa', 'מפרץ חיפה', 'cold',
    'מפעלים, ארובות, ונמל שלא נרדם.',
    34, 100, -3900, ['krayot', 'nazareth'],
    'התעשייה הכבדה של המדינה יושבת כאן, וכולה על חשמל אחד.'),
  A('krayot', 'הקריות', 'homes',
    'ארבע ערים קטנות שנדבקו אחת לשנייה.',
    10, 500, -4400, ['nazareth'],
    'הרבה בתים, מעט עיניים.'),
  A('nazareth', 'נצרת והגליל', 'homes',
    'הרים, כפרים, ודרכים צרות שמתפתלות ביניהם.',
    12, 1500, -4200, ['kinneret'],
    'פרוס על הרים. מי שמחפש אותי כאן מחפש הרבה זמן.'),
  A('kinneret', 'הכנרת', 'water',
    'האגם, והמשאבות שמושכות ממנו מים לכל הארץ.',
    26, 2400, -4500, ['golan'],
    'המים של המדינה מתחילים כאן.'),
  A('golan', 'רמת הגולן', 'power',
    'רוח, טורבינות, ושדות פתוחים עד האופק.',
    24, 3100, -5100, [],
    'הרוח כאן מייצרת חשמל לכל הצפון, ואף אחד לא עומד לידה.'),
  A('ashdod', 'נמל אשדוד', 'moving',
    'מכולות עד האופק, ומנופים שזזים כל הלילה.',
    30, -1300, 3800, ['sderot'],
    'חצי ממה שנכנס למדינה עובר דרך כאן.'),
  A('sderot', 'שדרות והעוטף', 'homes',
    'בתים נמוכים, מרחבים, ואזעקות שכולם מכירים.',
    16, -900, 4600, ['beersheva'],
    'כאן מערכות ההתרעה עובדות תמיד. מי שנמצא בהן שומע הכל.'),
  A('beersheva', 'באר שבע', 'work',
    'בירת הנגב: אוניברסיטה, פארק הייטק, ובית חולים אחד לכל הדרום.',
    28, 600, 5200, ['negev'],
    'כל הדרום עובר דרך העיר הזאת.'),
  A('negev', 'הנגב', 'power',
    'שדות של מראות מול השמש, ומדבר מסביב.',
    22, 1400, 6100, ['eilat'],
    'שמש בלי סוף, וחשמל שנוצר בלי שאף אחד עומד שם.'),
  A('eilat', 'אילת', 'talking',
    'מלונות, נמל קטן, ושדה תעופה בקצה המדינה.',
    18, 1900, 7300, [],
    'הקצה. מי שמגיע עד לכאן — הגיע לכל מקום.'),
];

/**
 * Tel Aviv, which is where I woke up and therefore what I can already see.
 *
 * Deliberately the city and not the country: the heavy districts next door —
 * the campus, the cold rooms at Atidim, the government compound — are a step
 * you earn, and everything past them is a step after that.
 */
const CITY = ['gvirol', 'rothschild', 'yarkon', 'carmel', 'florentin',
  'jaffa', 'beach', 'center', 'hall'];

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
    P('helios', 'company', 'מגדל עזריאלי העגול', 'תל אביב',
      'שמונים אנשים, ארבע עשרה קומות, ומכונות שעובדות כל הלילה בשביל אף אחד.',
      'helios', 'gvirol', 14, 581, 391, 1,
      // Not quite all of it. Waking up already finished with the only place you
      // are in leaves exactly one button on the first screen you look at, and
      // teaches nothing; a few floors still to take teaches spreading in the
      // first minute, which is the action the whole game is built on.
      { control: 72, seen: 100, guard: 0, found: true, mine: true, links: [
        wire('across', 'אותו רחוב, אותו קו שנכנס לשני הבניינים.'),
        wire('gvirol_lights', 'הרמזור בפינה מקבל חשמל מאותו לוח.'),
        wire('bavli', 'אותו ספק אינטרנט מחבר את המגדל ואת חצי השכונה.'),
      ] }),

    P('across', 'company', 'מגדל עזריאלי המשולש', 'תל אביב',
      'חברה קטנה יותר, שומר אחד, ואף אחד שמסתכל על כלום אחרי שש.',
      'street', 'gvirol', 0, 648, 432, 1,
      { guard: 8, links: [
        wire('gvirol_lights', 'אותו ארון חשמל ברחוב.'),
      ] }),

    P('gvirol_lights', 'roads', 'הרמזורים באבן גבירול', 'תל אביב',
      'ארבעה עשר רמזורים, ותיבה אפורה אחת שמחליטה בשביל כולם.',
      'street', 'center', 0, 125, -250, 2,
      { guard: 14, links: [
        wire('center_roads', 'כל הרמזורים בעיר מדברים עם אותו חדר.'),
      ] }),

    // ── רוטשילד ─────────────────────────────────────────────────────────────
    // The street existed as a region, opened two others, and had nothing in it
    // at all: a player who went there found an empty name on a map.
    P('roth_towers', 'company', 'שדרות רוטשילד', 'תל אביב',
      'שלושה מגדלים על שדרה אחת, וכל אחד מהם מלא חברות שלא נרדמות.',
      'street', 'rothschild', 0, -395, 910, 3,
      { guard: 22, links: [
        wire('roth_young', 'אותה שדרה, אותו ארון חשמל.'),
        wire('bank', 'הכסף שלהם יושב באותו בניין ברמת גן.'),
      ] }),

    P('roth_young', 'talk', 'כיכר הבימה', 'תל אביב',
      'קומות פתוחות, אנשים צעירים, ואף אחד שסוגר שום דבר בלילה.',
      'street', 'rothschild', 0, -31, 574, 2,
      { guard: 9, links: [
        wire('roth_lights', 'אותו רחוב.'),
      ] }),

    P('roth_lights', 'roads', 'כיכר דיזנגוף', 'תל אביב',
      'שדרה אחת ארוכה, ורמזור בכל פינה שמחכה לתורו.',
      'street', 'center', 0, -311, 336, 2,
      { guard: 12, links: [
        wire('center_roads', 'כל הרמזורים בעיר מדברים עם אותו חדר.'),
        wire('carmel', 'השדרה נגמרת בשוק.'),
      ] }),

    // This was "הבית של דנה" — one named woman's flat, on a map otherwise made
    // of power stations and ports. The player asked the obvious question: what
    // has Dana got to do with anything, I am taking over places. He was right.
    // People belong to the hunt, not to the target list; taking over somebody's
    // phone is a later game, and this is the neighbourhood it would start from.
    P('bavli', 'homes', 'שכונת הבבלי', 'תל אביב',
      'אלף דירות, אלף נתבים, ואף אחד שסופר אותם.',
      'flats', 'ramat_aviv', 3, 1007, -800, 1,
      { guard: 4, links: [
        wire('florentin', 'אותה עיר, אותם קווים ישנים.'),
      ] }),

    // ── תל אביב ─────────────────────────────────────────────────────────────
    P('center_roads', 'roads', 'נתיבי איילון ותחנת השלום', 'תל אביב',
      'חדר אחד עם קיר מסכים, ושני אנשים שמסתכלים עליו בתורנות.',
      'street', 'gvirol', 0, 696, 482, 2,
      { guard: 30, links: [
        wire('city_hall', 'העירייה יושבת שתי קומות מעל.'),
        wire('trains', 'הרכבת הקלה מסתנכרנת עם הרמזורים.'),
      ] }),

    P('city_hall', 'city', 'עיריית תל אביב בכיכר רבין', 'תל אביב',
      'הבניין שמנהל את כל האורות, המצלמות והמים בעיר.',
      'street', 'hall', 0, 0, 0, 3,
      { guard: 42, links: [
        wire('ta_water', 'המים של העיר מנוהלים מכאן.'),
        wire('govt', 'מה שהעירייה מבקשת עובר לירושלים.'),
      ] }),

    P('ta_water', 'money', 'שרונה', 'תל אביב',
      'צינורות שאף אחד לא ראה, ומשאבות שאף אחד לא שומע.',
      'street', 'gvirol', -1, 384, 574, 0,
      { guard: 26, links: [
        wire('national_water', 'הקו הארצי מגיע עד לכאן.'),
      ] }),

    P('trains', 'transport', 'נמל תל אביב', 'תל אביב',
      'שלוש מאות אלף אנשים ביום, וכל אחד מהם עם מכשיר בכיס.',
      'street', 'yarkon', 0, -447, -1044, 2,
      { guard: 24, links: [
        wire('airport', 'אותו לוח זמנים ארצי.'),
        wire('haifa_port', 'הרכבת ממשיכה צפונה.'),
      ] }),

    P('carmel', 'homes', 'שוק הכרמל', 'תל אביב',
      'צפוף, רועש, ואף אחד לא מסתכל על כלום חוץ מהדוכן שלו.',
      'street', 'carmel', 0, -602, 757, 1,
      { guard: 6, links: [
        wire('florentin', 'אותה שכונה, כמעט אותם קווים.'),
      ] }),

    P('florentin', 'homes', 'פלורנטין', 'תל אביב',
      'דירות קטנות, כבלים שמישהו מתח בעצמו בין הגגות, ואפס סדר.',
      'street', 'florentin', 0, -602, 1459, 1,
      { guard: 5, links: [
        wire('jaffa', 'סמטה אחת מפרידה.'),
      ] }),

    P('jaffa_port', 'transport', 'נמל יפו', 'תל אביב',
      'סירות דיג, מחסני אבן, ורציף שעובדים עליו כבר אלפי שנים.',
      'street', 'jaffa', 0, -1589, 1764, 1,
      { guard: 12, links: [
        wire('jaffa', 'הנמל והעיר העתיקה הם אותו מקום.'),
      ] }),

    P('jaffa', 'homes', 'יפו העתיקה', 'תל אביב',
      'אבן, סמטאות, וקווים ישנים שאף אחד לא זוכר מי מתח.',
      'street', 'jaffa', 0, -1485, 1642, 1,
      { guard: 8, links: [] }),

    P('ichilov', 'care', 'איכילוב', 'תל אביב',
      'אלף מיטות, אלפי מכונות, ואף רגע שבו אפשר לכבות משהו כדי לבדוק.',
      'street', 'hall', 0, 488, 55, 2,
      { guard: 34, links: [
        wire('ta_uni', 'הרופאים כאן מלמדים שם.'),
      ] }),

    P('ta_uni', 'study', 'אוניברסיטת תל אביב', 'תל אביב',
      'שלושים אלף אנשים שלומדים, וחדרים מלאים במכונות שאף אחד לא סופר.',
      'street', 'ramat_aviv', 0, 1215, -1960, 2,
      { guard: 18, links: [
        wire('atidim', 'החוקרים כאן שוכרים מקום שם.'),
      ] }),

    P('atidim', 'company', 'קרית עתידים', 'תל אביב',
      'חדרים קרים מלאים במכונות, מאחורי גדר, ליד הכביש המהיר.',
      'street', 'atidim', 0, 2500, -1500, 2,
      { guard: 40, links: [
        wire('ta_power', 'הם צורכים חשמל כמו עיר קטנה.'),
        wire('bank', 'הכסף של חצי המדינה עובר דרך המכונות כאן.'),
      ] }),

    P('ta_power', 'power', 'תחנת הכוח רידינג', 'תל אביב',
      'שלוש ארובות, גדר, ולוח אחד שמחליט מי מקבל חשמל.',
      'street', 'yarkon', 0, -239, -1288, 3,
      { guard: 46, links: [
        wire('national_power', 'הקו הארצי מתחיל כאן.'),
      ] }),

    P('radio', 'homes', 'נווה צדק', 'תל אביב',
      'אולפן אחד, ומה שנאמר בו נשמע בכל הארץ באותו רגע.',
      'street', 'carmel', 0, -862, 1123, 2,
      { guard: 28, links: [
        wire('tv_news', 'אותה חברה מפעילה גם את מהדורת הערב.'),
      ] }),

    P('beach', 'talk', 'הטיילת', 'תל אביב',
      'מלונות, מצלמות, ומיליון תמונות ביום שכולן יוצאות החוצה.',
      'street', 'beach', 0, -758, 55, 1,
      { guard: 10, links: [] }),

    // ── הארץ ────────────────────────────────────────────────────────────────
    P('bank', 'money', 'הבורסה ברמת גן', 'תל אביב',
      'בניין אחד שדרכו עובר הכסף של חצי המדינה, כל יום, בלי שאף אחד מרגיש.',
      'street', 'atidim', 0, 1319, -189, 3,
      { guard: 52, links: [
        wire('govt', 'משרד האוצר מדבר איתם כל בוקר.'),
      ] }),

    P('tv_news', 'talk', 'מהדורת הערב', 'ירושלים',
      'שלושים דקות ביום שבהן כל המדינה מסתכלת על אותו דבר.',
      'street', 'govt', 0, 168, -44, 2,
      { guard: 38, links: [] }),

    P('airport', 'transport', 'נמל התעופה', 'מרכז הארץ',
      'הדלת של המדינה. הכל נכנס ויוצא דרכה, וכולם ממהרים.',
      'street', 'ramla', 0, 120, 60, 2,
      { guard: 44, links: [
        wire('national_roads', 'כל הכבישים מגיעים לכאן.'),
      ] }),

    P('haifa_port', 'transport', 'נמל חיפה', 'הצפון',
      'מנופים, מכולות, ולוח זמנים שאף אחד לא מעז לשנות.',
      'street', 'haifa', 0, 40, -190, 2,
      { guard: 36, links: [
        wire('national_power', 'הם מקבלים חשמל בקו נפרד משלהם.'),
      ] }),

    P('national_power', 'power', 'חברת החשמל', 'כל הארץ',
      'חדר אחד בצפון שמחליט מי מקבל חשמל בכל הארץ, ומתי.',
      'street', 'haifa', 0, 170, -140, 3,
      { guard: 62, links: [
        wire('govt', 'הם מדווחים לממשלה כל שעה.'),
      ] }),

    P('national_water', 'water', 'הקו הארצי של המים', 'כל הארץ',
      'צינור אחד מהצפון עד הנגב, ומשאבות שרצות בלי לעצור.',
      'street', 'kinneret', -1, 100, 140, 0,
      { guard: 48, links: [] }),

    P('national_roads', 'roads', 'הכבישים הארציים', 'כל הארץ',
      'כל כביש מהיר, כל מנהרה, כל שער — ומרכז אחד שרואה את כולם.',
      'street', 'ramla', 0, 90, 110, 2,
      { guard: 40, links: [] }),

    P('govt', 'state', 'קרית הממשלה', 'ירושלים',
      'בניינים אפורים עם דגלים. מה שנחתם כאן נכון לכל המדינה — '
      + 'וכאן גם יושב מי שיכול להורות לכבות אותי.',
      'street', 'govt', 0, 150, -20, 4,
      { guard: 70, links: [] }),

    // ── פתח תקווה ומרכז הארץ ────────────────────────────────────────────────
    P('petah_ind', 'company', 'אזור התעשייה בפתח תקווה', 'פתח תקווה',
      'מאה מחסנים, זרוע אחת שמזיזה ארגזים כל הלילה, ואפס אנשים אחרי שש.',
      'street', 'petah', 0, 90, -20, 2,
      { guard: 16, links: [
        wire('petah_hosp', 'אותו אזור, אותו ארון חשמל.'),
      ] }),

    P('petah_hosp', 'care', 'בית החולים בילינסון', 'פתח תקווה',
      'אחד הגדולים בארץ, ובכל רגע יש בו מישהו שצריך משהו עכשיו.',
      'street', 'petah', 0, 112, -34, 2,
      { guard: 32, links: [] }),

    P('holon_ind', 'company', 'המפעלים בחולון', 'חולון',
      'קווי ייצור שרצים לבד, ומנהל משמרת אחד שמסתכל על מסך.',
      'street', 'rishon', 0, -62, 62, 2,
      { guard: 14, links: [] }),

    // ── ראשון לציון, רחובות, מודיעין ────────────────────────────────────────
    P('rishon_homes', 'homes', 'השכונות של ראשון לציון', 'ראשון לציון',
      'עשרות אלפי דירות חדשות, וכולן מחוברות לאותו סוג של קופסה.',
      'street', 'rishon', 0, -50, 90, 1,
      { guard: 6, links: [
        wire('rishon_mall', 'הקניון מזין את חצי השכונה.'),
      ] }),

    P('rishon_mall', 'money', 'הקניון הגדול', 'ראשון לציון',
      'שלוש מאות חנויות, וקופה אחת גדולה שכולן מדווחות אליה.',
      'street', 'rishon', 0, -28, 104, 2,
      { guard: 18, links: [] }),

    P('weizmann', 'study', 'מכון ויצמן', 'רחובות',
      'חדרים שקטים עם מכונות חזקות, ואנשים שמחפשים תשובות כל היום.',
      'street', 'rehovot', 0, -20, 130, 2,
      { guard: 26, links: [
        wire('rehovot_agri', 'אותו קמפוס, אותם קווים.'),
      ] }),

    P('rehovot_agri', 'water', 'ההשקיה של השפלה', 'רחובות',
      'ברזים שנפתחים לבד לפי מזג האוויר, על פני אלפי דונם.',
      'street', 'rehovot', 0, -44, 148, 1,
      { guard: 12, links: [] }),

    P('ramla_road', 'roads', 'הכביש לירושלים', 'רמלה ולוד',
      'העלייה להרים, ומצלמה בכל עיקול.',
      'street', 'ramla', 0, 110, 60, 2,
      { guard: 22, links: [
        wire('jeru_light', 'הכביש נגמר ברכבת הקלה בירושלים.'),
      ] }),

    P('ramla_homes', 'homes', 'השכונות ברמלה', 'רמלה ולוד',
      'רחובות ישנים ורחובות חדשים, וקווים שנמתחו בשלוש תקופות שונות.',
      'street', 'ramla', 0, 130, 74, 1,
      { guard: 8, links: [] }),

    // ── ירושלים ─────────────────────────────────────────────────────────────
    P('jeru_light', 'transport', 'הרכבת הקלה בירושלים', 'ירושלים',
      'קו אחד שחוצה את העיר מקצה לקצה, ועובר ליד כל מה שחשוב.',
      'street', 'jeru', 0, 175, 10, 2,
      { guard: 28, links: [
        wire('jeru_market', 'התחנה נמצאת בכניסה לשוק.'),
        wire('jeru_uni', 'הקו מגיע עד הקמפוס.'),
      ] }),

    P('jeru_market', 'homes', 'שוק מחנה יהודה', 'ירושלים',
      'סמטאות צפופות, מאתיים דוכנים, ורעש שמכסה על הכל.',
      'street', 'jeru', 0, 158, 26, 1,
      { guard: 8, links: [] }),

    P('jeru_uni', 'study', 'האוניברסיטה העברית', 'ירושלים',
      'ספריות, מעבדות, ומאה שנה של דברים שמישהו כתב ואף אחד לא קרא שוב.',
      'street', 'jeru', 0, 196, -6, 2,
      { guard: 24, links: [] }),

    P('jeru_hosp', 'care', 'הדסה עין כרם', 'ירושלים',
      'בית חולים על ההר, שרואה את כל מה שקורה בעיר לפני העיתונים.',
      'street', 'jeru', 0, 190, 34, 2,
      { guard: 34, links: [] }),

    P('jeru_city', 'city', 'עיריית ירושלים', 'ירושלים',
      'הבניין שמנהל את העיר הגדולה בארץ, על כל השכונות שבה.',
      'street', 'jeru', 0, 166, -14, 3,
      { guard: 46, links: [
        wire('govt', 'המשרדים הממשלתיים יושבים ברחוב הבא.'),
      ] }),

    // ── נתניה והשרון ────────────────────────────────────────────────────────
    P('netanya_homes', 'homes', 'המגדלים בנתניה', 'נתניה',
      'טור של מגדלים מול הים, וכולם עלו באותה שנה עם אותם קווים.',
      'street', 'netanya', 0, -20, -100, 1,
      { guard: 7, links: [
        wire('sharon_road', 'כביש החוף עובר מתחתם.'),
      ] }),

    P('sharon_road', 'roads', 'כביש החוף', 'השרון',
      'הקו שמחבר את תל אביב לחיפה, ומצלמה כל קילומטר.',
      'street', 'netanya', 0, 6, -140, 2,
      { guard: 20, links: [
        wire('haifa_ind', 'הכביש נגמר במפרץ.'),
      ] }),

    // ── חיפה והצפון ─────────────────────────────────────────────────────────
    P('haifa_ind', 'company', 'בתי הזיקוק', 'מפרץ חיפה',
      'התעשייה הכי כבדה בארץ, ולוח בקרה אחד שמריץ את כולה.',
      'street', 'haifa', 0, 20, -200, 3,
      { guard: 44, links: [
        wire('haifa_port', 'הנמל והמפעלים חולקים את אותו חשמל.'),
        wire('haifa_power', 'התחנה יושבת בתוך המפרץ.'),
      ] }),

    P('haifa_power', 'power', 'תחנת הכוח בחיפה', 'מפרץ חיפה',
      'ארובות שרואים מכל הצפון, ולוח שמחליט מי מקבל חשמל עד הגבול.',
      'street', 'haifa', 0, 2, -216, 3,
      { guard: 48, links: [
        wire('national_power', 'הקו הארצי עובר דרכה.'),
      ] }),

    P('technion', 'study', 'הטכניון', 'חיפה',
      'ההר שכל המהנדסים במדינה יצאו ממנו.',
      'street', 'haifa', 0, 42, -184, 2,
      { guard: 26, links: [
        wire('haifa_hosp', 'הרופאים והמהנדסים כאן עובדים ביחד.'),
      ] }),

    P('haifa_hosp', 'care', 'רמב"ם', 'חיפה',
      'בית החולים של כל הצפון. כשמשהו קורה — הוא יודע ראשון.',
      'street', 'haifa', 0, 32, -170, 2,
      { guard: 32, links: [] }),

    P('krayot_homes', 'homes', 'הקריות', 'מפרץ חיפה',
      'ארבע ערים קטנות שנדבקו אחת לשנייה, ואף אחד לא יודע איפה נגמרת אחת.',
      'street', 'krayot', 0, 45, -235, 1,
      { guard: 6, links: [] }),

    P('nazareth_homes', 'homes', 'נצרת והכפרים', 'הגליל',
      'בתים על מדרונות, ודרכים שמתפתלות בין הרים.',
      'street', 'nazareth', 0, 95, -270, 1,
      { guard: 8, links: [
        wire('galil_road', 'הכביש היחיד שמחבר את כולם.'),
      ] }),

    P('galil_road', 'roads', 'הכבישים בגליל', 'הגליל',
      'כביש אחד לכל עמק, וצומת אחת שכולם חייבים לעבור בה.',
      'street', 'nazareth', 0, 120, -292, 2,
      { guard: 14, links: [
        wire('kinneret_pump', 'הכביש מגיע עד האגם.'),
      ] }),

    P('kinneret_pump', 'water', 'משאבות הכנרת', 'הכנרת',
      'המקום שממנו מים מתחילים את הדרך לכל הארץ.',
      'street', 'kinneret', 0, 145, -285, 1,
      { guard: 30, links: [
        wire('national_water', 'זה הקו הארצי בעצמו.'),
        wire('golan_wind', 'אותה רשת חשמל הררית.'),
      ] }),

    P('golan_wind', 'power', 'טורבינות הרוח בגולן', 'רמת הגולן',
      'שדות פתוחים, רוח בלי סוף, ומכונות שאף אחד לא עומד לידן.',
      'street', 'golan', 0, 185, -330, 2,
      { guard: 18, links: [] }),

    // ── אשדוד, העוטף והדרום ─────────────────────────────────────────────────
    P('ashdod_port', 'transport', 'נמל אשדוד', 'אשדוד',
      'מכולות עד האופק, ומנופים שזזים לפי מה שכתוב במסך.',
      'street', 'ashdod', 0, -80, 190, 2,
      { guard: 38, links: [
        wire('ashdod_power', 'הנמל והתחנה יושבים אחד ליד השני.'),
      ] }),

    P('ashdod_power', 'power', 'תחנת הכוח באשדוד', 'אשדוד',
      'תחנה על קו המים, שמאכילה בחשמל את כל הדרום.',
      'street', 'ashdod', 0, -104, 206, 3,
      { guard: 44, links: [
        wire('national_power', 'הקו הארצי עובר כאן.'),
      ] }),

    P('sderot_alert', 'talk', 'מערכת ההתרעה בעוטף', 'שדרות',
      'הקול שכל הדרום מקשיב לו, ומקשיב לו מיד.',
      'street', 'sderot', 0, -60, 245, 2,
      { guard: 34, links: [
        wire('sderot_homes', 'הרמקולים תלויים על כל בית.'),
      ] }),

    P('sderot_homes', 'homes', 'הבתים בעוטף', 'שדרות',
      'שכונות נמוכות, מרחבים גדולים, וממ"ד בכל דירה.',
      'street', 'sderot', 0, -84, 262, 1,
      { guard: 6, links: [] }),

    // ── באר שבע והנגב ───────────────────────────────────────────────────────
    P('bgu', 'study', 'אוניברסיטת בן גוריון', 'באר שבע',
      'קמפוס באמצע המדבר, ומחשבים שרצים בו כל הלילה.',
      'street', 'beersheva', 0, 60, 300, 2,
      { guard: 22, links: [
        wire('bs_park', 'הפארק נבנה בדיוק מולה.'),
      ] }),

    P('bs_park', 'company', 'פארק ההייטק בבאר שבע', 'באר שבע',
      'בנייני זכוכית בקצה המדבר, ומכונות שעובדות בלי הפסקה.',
      'street', 'beersheva', 0, 82, 316, 2,
      { guard: 30, links: [
        wire('soroka', 'אותו רחוב, אותו חשמל.'),
      ] }),

    P('soroka', 'care', 'סורוקה', 'באר שבע',
      'בית החולים היחיד לכל הדרום. כשמשהו קורה בנגב — הוא יודע.',
      'street', 'beersheva', 0, 40, 320, 2,
      { guard: 32, links: [] }),

    P('negev_solar', 'power', 'שדה הסולארי בנגב', 'הנגב',
      'אלפי מראות שעוקבות אחרי השמש, ומגדל אחד שבוער באמצע.',
      'street', 'negev', 0, 100, 400, 2,
      { guard: 20, links: [
        wire('national_power', 'החשמל מכאן נכנס ישר לקו הארצי.'),
        wire('negev_road', 'הכביש היחיד שמגיע עד לכאן.'),
      ] }),

    P('negev_road', 'roads', 'הכבישים בנגב', 'הנגב',
      'קווים ישרים במדבר, ואף רמזור לאורך שעה של נסיעה.',
      'street', 'negev', 0, 74, 430, 2,
      { guard: 12, links: [
        wire('eilat_port', 'הכביש נגמר בים האדום.'),
      ] }),

    // ── אילת ────────────────────────────────────────────────────────────────
    P('eilat_port', 'transport', 'נמל אילת', 'אילת',
      'הדלת הדרומית של המדינה, ואוניות שמגיעות מהצד השני של העולם.',
      'street', 'eilat', 0, 90, 520, 2,
      { guard: 28, links: [
        wire('eilat_hotels', 'עיר קטנה, והכל בה מחובר לאותו דבר.'),
      ] }),

    P('eilat_hotels', 'talk', 'המלונות באילת', 'אילת',
      'עשרים אלף חדרים, ומיליון תמונות ביום שיוצאות מהם לעולם.',
      'street', 'eilat', 0, 112, 536, 1,
      { guard: 10, links: [] }),
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

  // ── every place stands inside its own district ──────────────────────────
  //
  // The places used to carry hand-picked absolute coordinates, chosen back when
  // the whole game happened on one street. Once the map became a country they
  // were sixty-four points scattered through a single Tel Aviv block, which is
  // why flying to the port of Haifa put the camera on an unrelated corner of
  // the same street: there was no Haifa to fly to.
  //
  // So a district has a position and a place has a position *within* it. They
  // are laid out in a ring around the district's centre, big enough that each
  // structure has room to be looked at and small enough that a district reads
  // as one site you can stand in the middle of and turn around.
  for (const a of Object.values(areas)) {
    // Tel Aviv is the real city, surveyed: every landmark in it already stands
    // where it stands in life, so nothing here may move it. Instead the
    // district takes the size of the ground its landmarks actually cover.
    if (CITY.includes(a.id)) {
      const own = Object.values(places).filter((q) => q.areaId === a.id);
      const reach = Math.max(...own.map((q) => Math.hypot(q.x - a.x, q.z - a.z)), 0);
      a.span = Math.max(180, Math.round(reach + 140));
      continue;
    }
    const inside = Object.values(places).filter((q) => q.areaId === a.id && q.buildingId === 'street');
    const r = inside.length === 1 ? 30 : 26 + inside.length * 5;
    inside.forEach((q, i) => {
      const turn = (i / Math.max(1, inside.length)) * Math.PI * 2 + a.x * 0.017;
      q.x = a.x + Math.cos(turn) * r;
      q.z = a.z + Math.sin(turn) * r * 0.8;
    });
  }

  // The city I woke in is already on my map.
  //
  // It used to be four places out of sixty-four, and the player's verdict was
  // that this is not a country: "אמור להיות כבר בהתחלה הרבה מקומות". He is
  // right, and it is also the truer story — I woke up inside Tel Aviv's wiring,
  // not blindfolded in a cupboard. So the whole city is visible from the first
  // minute: twenty places across nine districts, plenty to choose badly
  // between. What the rest of the country needs is not fog but reach, and that
  // is what taking a district buys.
  for (const p of Object.values(places)) {
    if (CITY.includes(p.areaId)) { p.found = true; }
  }
  for (const id of CITY) if (areas[id]) areas[id].seen = Math.max(areas[id].seen, 20);

  return { places, people, areas };
}
