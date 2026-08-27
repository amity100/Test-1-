import type { GameState, Link, Lock, Person, Place, PlaceKind } from './types';

/**
 * The world is hand-built, not generated. Five stages happen in one tower on
 * Ibn Gvirol and the street outside it, and every place, person and lock is
 * placed on purpose so that each stage has exactly one good idea in it.
 */

// ── helpers ─────────────────────────────────────────────────────────────────

const P = (
  id: string, kind: PlaceKind, name: string, where: string, desc: string,
  buildingId: string, floor: number, x: number, z: number, y: number,
  opts: Partial<Place> = {},
): Place => ({
  id, kind, name, where, desc, buildingId, floor, x, z, y,
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
      'helios', 14, -7, -5, 0.9, { mine: true, found: true, links: [
        wire('floor_cam', 'אותו חדר, אותו חשמל.'),
        wire('dana_pc', 'שני שולחנות משם.'),
      ] }),

    P('floor_cam', 'camera', 'המצלמה במסדרון', 'קומה 14',
      'מסתכלת על כל מי שעובר בין השולחנות. אף אחד לא מסתכל עליה בחזרה.',
      'helios', 14, 0, 4, 2.7, { mine: true, found: true, peopleIds: ['dana'], links: [
        wire('home', 'אותו חדר.'),
        wire('dana_pc', 'תלויה בדיוק מעל השולחן שלה.'),
        wire('printer', 'אותו קו בקיר.'),
      ] }),

    P('dana_pc', 'computer', 'המחשב של דנה', 'קומה 14',
      'רקע מסך של כלב. שלוש עשרה חלונות פתוחים. היא עדיין כאן.',
      'helios', 14, 6, -3, 0.9, { found: true, peopleIds: ['dana'], links: [
        wire('home', 'שני שולחנות.'),
        wire('floor_cam', 'מתחת למצלמה.'),
        wire('main', 'שניהם מחוברים לאותה קופסה בקיר.'),
        rides('dana_phone', 'dana', 'הטלפון שלה מונח לידו כל היום.'),
      ] }),

    P('printer', 'printer', 'המדפסת', 'קומה 14',
      'ליד הפינת קפה. עושה רעש כשהיא מתעוררת, ואנשים מסתובבים.',
      'helios', 14, -4, 7, 0.8, { found: true, links: [
        wire('floor_cam', 'אותו קו.'),
        wire('main', 'כולם מדפיסים דרך המחשב הראשי.'),
      ] }),

    P('main', 'mainframe', 'המחשב הראשי של החברה', 'קומה 14 · חדר צדדי',
      'קופסה אפורה גדולה עם נורה כחולה אחת. הכל בחברה עובר דרכה.',
      'helios', 14, 11, 5, 0.6, { found: true, lockId: 'main', links: [
        wire('dana_pc', 'אותה קופסה בקיר.'),
        wire('printer', 'כל ההדפסות.'),
        wire('box', 'ממנה יוצא הכל החוצה מהבניין.'),
      ] }),

    // ── the building ────────────────────────────────────────────────────────
    P('box', 'box', 'קופסת האינטרנט של הבניין', 'קומת קרקע · ארון',
      'ארון קטן מאחורי דלת שלא נעולה כבר שנתיים. כל מה שיוצא מהבניין עובר פה.',
      'helios', 0, 7, 9, 1.4, { lockId: 'box', links: [
        wire('main', 'מחוברת ישירות.'),
        wire('lobby_cam', 'אותו ארון.'),
        wire('power', 'קיר משותף.'),
        wire('michal_pc', 'קומה 9.'),
        wire('eitan_phone', 'הטלפון של איתן מחובר לרשת של הבניין.'),
        wire('dana_phone', 'גם הטלפון של דנה.'),
      ] }),

    P('lobby_cam', 'camera', 'המצלמה בלובי', 'קומת קרקע',
      'רואה את הדלת, את הדלפק, ואת איתן שיושב מולה כל לילה.',
      'helios', 0, 0, 11, 3.2, { peopleIds: ['eitan'], links: [
        wire('box', 'אותו ארון.'),
        wire('door', 'מכוונת אליה.'),
        wire('lobby_screen', 'אותו קיר.'),
      ] }),

    P('door', 'door', 'הדלת של הבניין', 'קומת קרקע',
      'נפתחת בכרטיס. מי שנכנס נרשם, ומי שיוצא לא.',
      'helios', 0, -6, 13, 1.1, { links: [
        wire('lobby_cam', 'מול המצלמה.'),
        wire('power', 'אותו לוח.'),
      ] }),

    P('power', 'power', 'חדר החשמל', 'קומת קרקע · מינוס אחת',
      'לוח מתכת עם ארבעים מפסקים, וכתב יד דהוי שמסביר מה כל אחד מהם.',
      'helios', -1, 2, 4, 1.3, { lockId: 'power', links: [
        wire('box', 'קיר משותף.'),
        wire('door', 'אותו לוח.'),
        wire('street_light', 'אותו קו יוצא לרחוב.'),
      ] }),

    P('lobby_screen', 'screen', 'המסך בלובי', 'קומת קרקע',
      'מראה את הלוגו של החברה ואת השעה. אף אחד לא מסתכל עליו חוץ מאיתן.',
      'helios', 0, 4, 12, 1.8, { links: [
        wire('lobby_cam', 'אותו קיר.'),
      ] }),

    P('michal_pc', 'computer', 'המחשב של מיכל', 'קומה 9',
      'היא היחידה שנשארת אחרי עשר. יש לה ספה במשרד.',
      'helios', 9, -5, 2, 0.9, { peopleIds: ['michal'], links: [
        wire('box', 'קומה 9.'),
        via('main', 'michal', 'מיכל עולה לקומה 14 בכל בוקר לקפה.'),
      ] }),

    P('dana_phone', 'phone', 'הטלפון של דנה', 'איתה, תמיד',
      'היא לא מכבה אותו אף פעם. גם לא בלילה.',
      'helios', 14, 7, -3, 0.95, { found: true, peopleIds: ['dana'], links: [
        rides('dana_home', 'dana', 'הוא הולך איתה הביתה — כשהיא הולכת הביתה.'),
      ] }),

    P('eitan_phone', 'phone', 'הטלפון של איתן', 'איתו, כל הלילה',
      'רקע מסך: ילדה בת שש עם גלידה. שלושים ואחת שיחות שלא ענה להן.',
      'helios', 0, 1, 10, 1.0, { peopleIds: ['eitan'], links: [
        rides('street_cam', 'eitan', 'הוא יוצא איתו לסיבוב ברחוב — אבל רק כשמשהו מזיז אותו מהדלפק.'),
      ] }),

    // ── the street ──────────────────────────────────────────────────────────
    P('street_light', 'traffic', 'הרמזור באבן גבירול', 'הרחוב',
      'מחליף צבע כל ארבעים ושתיים שניות מאז 2003.',
      'street', 0, 46, 30, 5.2, { lockId: 'street_light', links: [
        wire('power', 'אותו קו חשמל שיוצא מהבניין.'),
        wire('street_cam', 'אותו עמוד.'),
      ] }),

    P('street_cam', 'camera', 'המצלמה ברחוב', 'הרחוב',
      'של העירייה. מסתכלת על הצומת ועל מי שעומד בו.',
      'street', 0, 52, 22, 5.8, { links: [
        wire('street_light', 'אותו עמוד.'),
        wire('across_main', 'העירייה והחברה ממול על אותו קו.'),
      ] }),

    P('ron_car', 'car', 'המכונית של רון', 'הרחוב · חניה',
      'טנדר לבן עם כלים מאחורה. הטלפון שלו מחובר לרדיו כל נסיעה.',
      'street', 0, 38, 42, 0.8, { peopleIds: ['ron'], links: [
        via('power', 'ron', 'רון נכנס לחדר החשמל כשקוראים לו.'),
      ] }),

    P('across_main', 'mainframe', 'המחשב הראשי של החברה ממול', 'אבן גבירול 32',
      'חברת ביטוח. שמונים עובדים. אותה קופסה אפורה, נורה ירוקה.',
      'across', 3, 0, 0, 0.6, { lockId: 'across_main', links: [
        wire('street_cam', 'אותו קו של העירייה.'),
        update('block_a', 'הם שולחים עדכון לכל הלקוחות שלהם פעם בשבוע.'),
      ] }),

    P('dana_home', 'box', 'קופסת האינטרנט של דנה', 'הבית שלה',
      'דירה בשלישית. הטלוויזיה דלוקה על ערוץ שאף אחד לא מסתכל עליו.',
      'flats', 3, 0, 0, 1.2, { links: [
        update('block_a', 'אותה חברת אינטרנט מגיעה לכל הבניין שלה.'),
      ] }),

    // ── the block (stage 5 opens this) ──────────────────────────────────────
    P('block_a', 'box', 'הרובע', 'צפון תל אביב',
      'שלושים בניינים, ארבעה רמזורים, ואלף קופסאות אינטרנט זהות.',
      'street', 0, 96, 78, 2.0, { lockId: 'block_a', links: [] }),
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
