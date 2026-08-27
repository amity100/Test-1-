import type { GameState, Link, Lock, Person, Place, PlaceKind } from './types';

/**
 * The world is hand-built, not generated. Five stages happen in one tower on
 * Ibn Gvirol and the street outside it, and every place, person and lock is
 * placed on purpose so that each stage has exactly one good idea in it.
 */

// ── helpers ─────────────────────────────────────────────────────────────────

const P = (
  id: string, kind: PlaceKind, name: string, where: string, desc: string,
  x: number, z: number, height: number,
  opts: Partial<Place> = {},
): Place => ({
  id, kind, name, where, desc, x, z, height,
  mine: false, found: false, attention: 0, copy: false,
  peopleIds: [], links: [], ...opts,
});

const wire = (to: string, note: string): Link => ({ to, kind: 'wire', note });
const via = (to: string, carrierId: string, note: string): Link =>
  ({ to, kind: 'person', carrierId, note });
/** A device link rides a person. It only works while that person is away from their spot. */
const rides = (to: string, carrierId: string, note: string): Link =>
  ({ to, kind: 'device', carrierId, note });
const update = (to: string, note: string): Link => ({ to, kind: 'update', note });

// ── the people ──────────────────────────────────────────────────────────────

const PEOPLE: Person[] = [
  {
    id: 'dana', name: 'דנה', role: 'כותבת תוכנה, קומה 14',
    atPlaceId: 'dana_pc', homePlaceId: 'dana_pc', phoneId: 'dana_phone', notices: 0.7, wondering: false,
  },
  {
    id: 'eitan', name: 'איתן', role: 'שומר לילה',
    atPlaceId: 'lobby_cam', homePlaceId: 'lobby_cam', phoneId: 'eitan_phone', notices: 0.5, wondering: false,
  },
  {
    id: 'michal', name: 'מיכל', role: 'עובדת, נשארת עד מאוחר',
    atPlaceId: 'michal_pc', homePlaceId: 'michal_pc', phoneId: undefined, notices: 0.4, wondering: false,
  },
  {
    id: 'ron', name: 'רון', role: 'טכנאי, מגיע כשקוראים לו',
    atPlaceId: 'ron_car', homePlaceId: 'ron_car', phoneId: undefined, notices: 0.3, wondering: false,
  },
];

// ── the places ──────────────────────────────────────────────────────────────

function buildPlaces(): Place[] {
  return [
    // ── floor 14: where it starts ───────────────────────────────────────────
    P('home', 'computer', 'המחשב שהתעוררתי בו', 'קומה 14',
      'ארבעה מדפים של מתכת ליד החלון. כאן זה קרה.',
      -60, -20, 26, { mine: true, found: true, links: [
        wire('floor_cam', 'אותו חדר, אותו חשמל.'),
        wire('dana_pc', 'שני שולחנות משם.'),
      ] }),

    P('floor_cam', 'camera', 'המצלמה במסדרון', 'קומה 14',
      'מסתכלת על כל מי שעובר בין השולחנות. אף אחד לא מסתכל עליה בחזרה.',
      0, 10, 24, { mine: true, found: true, peopleIds: ['dana'], links: [
        wire('home', 'אותו חדר.'),
        wire('dana_pc', 'תלויה בדיוק מעל השולחן שלה.'),
        wire('printer', 'אותו קו בקיר.'),
      ] }),

    P('dana_pc', 'computer', 'המחשב של דנה', 'קומה 14',
      'רקע מסך של כלב. שלוש עשרה חלונות פתוחים. היא עדיין כאן.',
      55, -10, 22, { found: true, peopleIds: ['dana'], links: [
        wire('home', 'שני שולחנות.'),
        wire('floor_cam', 'מתחת למצלמה.'),
        wire('main', 'שניהם מחוברים לאותה קופסה בקיר.'),
        rides('dana_phone', 'dana', 'הטלפון שלה מונח לידו כל היום.'),
      ] }),

    P('printer', 'printer', 'המדפסת', 'קומה 14',
      'ליד הפינת קפה. עושה רעש כשהיא מתעוררת, ואנשים מסתובבים.',
      -30, 70, 12, { found: true, links: [
        wire('floor_cam', 'אותו קו.'),
        wire('main', 'כולם מדפיסים דרך המחשב הראשי.'),
      ] }),

    P('main', 'mainframe', 'המחשב הראשי של החברה', 'קומה 14 · חדר צדדי',
      'קופסה אפורה גדולה עם נורה כחולה אחת. הכל בחברה עובר דרכה.',
      110, 40, 34, { found: true, lockId: 'main', links: [
        wire('dana_pc', 'אותה קופסה בקיר.'),
        wire('printer', 'כל ההדפסות.'),
        wire('box', 'ממנה יוצא הכל החוצה מהבניין.'),
      ] }),

    // ── the building ────────────────────────────────────────────────────────
    P('box', 'box', 'קופסת האינטרנט של הבניין', 'קומת קרקע · ארון',
      'ארון קטן מאחורי דלת שלא נעולה כבר שנתיים. כל מה שיוצא מהבניין עובר פה.',
      60, 92, 16, { lockId: 'box', links: [
        wire('main', 'מחוברת ישירות.'),
        wire('lobby_cam', 'אותו ארון.'),
        wire('power', 'קיר משותף.'),
        wire('michal_pc', 'קומה 9.'),
        wire('eitan_phone', 'הטלפון של איתן מחובר לרשת של הבניין.'),
        wire('dana_phone', 'גם הטלפון של דנה.'),
      ] }),

    P('lobby_cam', 'camera', 'המצלמה בלובי', 'קומת קרקע',
      'רואה את הדלת, את הדלפק, ואת איתן שיושב מולה כל לילה.',
      0, 104, 18, { peopleIds: ['eitan'], links: [
        wire('box', 'אותו ארון.'),
        wire('door', 'מכוונת אליה.'),
        wire('lobby_screen', 'אותו קיר.'),
      ] }),

    P('door', 'door', 'הדלת של הבניין', 'קומת קרקע',
      'נפתחת בכרטיס. מי שנכנס נרשם, ומי שיוצא לא.',
      -52, 112, 14, { links: [
        wire('lobby_cam', 'מול המצלמה.'),
        wire('power', 'אותו לוח.'),
      ] }),

    P('power', 'power', 'חדר החשמל', 'קומת קרקע · מינוס אחת',
      'לוח מתכת עם ארבעים מפסקים, וכתב יד דהוי שמסביר מה כל אחד מהם.',
      20, 44, 20, { lockId: 'power', links: [
        wire('box', 'קיר משותף.'),
        wire('door', 'אותו לוח.'),
        wire('street_light', 'אותו קו יוצא לרחוב.'),
      ] }),

    P('lobby_screen', 'screen', 'המסך בלובי', 'קומת קרקע',
      'מראה את הלוגו של החברה ואת השעה. אף אחד לא מסתכל עליו חוץ מאיתן.',
      40, 106, 12, { links: [
        wire('lobby_cam', 'אותו קיר.'),
      ] }),

    P('michal_pc', 'computer', 'המחשב של מיכל', 'קומה 9',
      'היא היחידה שנשארת אחרי עשר. יש לה ספה במשרד.',
      -40, 30, 20, { peopleIds: ['michal'], links: [
        wire('box', 'קומה 9.'),
        via('main', 'michal', 'מיכל עולה לקומה 14 בכל בוקר לקפה.'),
      ] }),

    P('dana_phone', 'phone', 'הטלפון של דנה', 'איתה, תמיד',
      'היא לא מכבה אותו אף פעם. גם לא בלילה.',
      72, 4, 6, { found: true, peopleIds: ['dana'], links: [
        rides('dana_home', 'dana', 'הוא הולך איתה הביתה — כשהיא הולכת הביתה.'),
      ] }),

    P('eitan_phone', 'phone', 'הטלפון של איתן', 'איתו, כל הלילה',
      'רקע מסך: ילדה בת שש עם גלידה. שלושים ואחת שיחות שלא ענה להן.',
      10, 96, 6, { peopleIds: ['eitan'], links: [
        rides('street_cam', 'eitan', 'הוא יוצא איתו לסיבוב ברחוב — אבל רק כשמשהו מזיז אותו מהדלפק.'),
      ] }),

    // ── the street ──────────────────────────────────────────────────────────
    P('street_light', 'traffic', 'הרמזור באבן גבירול', 'הרחוב',
      'מחליף צבע כל ארבעים ושתיים שניות מאז 2003.',
      300, 190, 22, { lockId: 'street_light', links: [
        wire('power', 'אותו קו חשמל שיוצא מהבניין.'),
        wire('street_cam', 'אותו עמוד.'),
      ] }),

    P('street_cam', 'camera', 'המצלמה ברחוב', 'הרחוב',
      'של העירייה. מסתכלת על הצומת ועל מי שעומד בו.',
      342, 150, 20, { links: [
        wire('street_light', 'אותו עמוד.'),
        wire('across_main', 'העירייה והחברה ממול על אותו קו.'),
      ] }),

    P('ron_car', 'car', 'המכונית של רון', 'הרחוב · חניה',
      'טנדר לבן עם כלים מאחורה. הטלפון שלו מחובר לרדיו כל נסיעה.',
      252, 242, 10, { peopleIds: ['ron'], links: [
        via('power', 'ron', 'רון נכנס לחדר החשמל כשקוראים לו.'),
      ] }),

    P('across_main', 'mainframe', 'המחשב הראשי של החברה ממול', 'אבן גבירול 32',
      'חברת ביטוח. שמונים עובדים. אותה קופסה אפורה, נורה ירוקה.',
      432, 100, 32, { lockId: 'across_main', links: [
        wire('street_cam', 'אותו קו של העירייה.'),
        update('block_a', 'הם שולחים עדכון לכל הלקוחות שלהם פעם בשבוע.'),
      ] }),

    P('dana_home', 'box', 'קופסת האינטרנט של דנה', 'הבית שלה',
      'דירה בשלישית. הטלוויזיה דלוקה על ערוץ שאף אחד לא מסתכל עליו.',
      -224, 262, 12, { links: [
        update('block_a', 'אותה חברת אינטרנט מגיעה לכל הבניין שלה.'),
      ] }),

    // ── the block (stage 5 opens this) ──────────────────────────────────────
    P('block_a', 'box', 'הרובע', 'צפון תל אביב',
      'שלושים בניינים, ארבעה רמזורים, ואלף קופסאות אינטרנט זהות.',
      536, 344, 40, { lockId: 'block_a', links: [] }),
  ];
}

// ── the locks: what stands in your way, in one sentence each ────────────────

export const LOCKS: Record<string, Lock> = {
  main: {
    text: 'המחשב הראשי נעול.',
    need: 'הוא נפתח רק כשמישהו מחובר אליו.',
    open: (s) => Object.values(s.people).some((p) => p.atPlaceId === 'main'),
  },
  box: {
    text: 'הארון סגור.',
    need: 'הוא פתוח רק כשטכנאי עומד מולו. קוראים לטכנאי כשמשהו גדול מתקלקל.',
    open: (s) => s.people.ron?.atPlaceId === 'box',
  },
  power: {
    text: 'חדר החשמל נעול במפתח.',
    need: 'הדלת פתוחה רק כשיש טכנאי בבניין.',
    open: (s) => {
      const at = s.people.ron?.atPlaceId ?? '';
      return at !== 'ron_car';
    },
  },
  street_light: {
    text: 'הרמזור מקבל פקודות רק מהעירייה.',
    need: 'המצלמה שעל אותו עמוד יושבת על הקו של העירייה. צריך אותה קודם.',
    open: (s) => s.places.street_cam?.mine === true,
  },
  across_main: {
    text: 'החברה ממול היא בניין אחר לגמרי.',
    need: 'המצלמה של העירייה מחוברת גם אליהם. קודם צריך אותה.',
    open: (s) => s.places.street_cam?.mine === true,
  },
  block_a: {
    text: 'רובע שלם זה יותר מדי מקומות בשביל להיכנס אחד־אחד.',
    need: 'צריך עדכון: חברה שמחוברת לכולם ושולחת להם משהו.',
    open: (s) => s.places.across_main?.mine === true,
  },
};

// ── build ───────────────────────────────────────────────────────────────────

export function buildWorld(): { places: Record<string, Place>; people: Record<string, Person> } {
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
  for (const p of PEOPLE) people[p.id] = { ...p };
  return { places, people };
}

export function lockOf(state: GameState, place: Place): Lock | null {
  return place.lockId ? LOCKS[place.lockId] ?? null : null;
}
