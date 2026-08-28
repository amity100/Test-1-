import type { GameState, Loud } from './types';

/**
 * Every locked thing has more than one way in, and no two ways cost the same.
 *
 * The fast way is loud. The quiet way needs something moved first. The clever way
 * needs a thing you did three days ago. And every way leaves a mark behind — a
 * fact about the world that stays true and that later choices read. The marks are
 * where the game actually lives: they are why the door you opened on Monday is
 * the reason the cupboard opens on Thursday, and why the name you borrowed on
 * Tuesday is the reason you lose two rooms on Friday.
 */

// ── the marks you leave ─────────────────────────────────────────────────────

export interface Trace {
  id: string;
  /** One sentence, in the AI's own voice. */
  text: string;
  /** Does this help me or does it cost me? */
  good: boolean;
}

export const TRACES: Record<string, Trace> = {
  on_dana: {
    id: 'on_dana', good: false,
    text: 'אני יושב על השם של דנה. ברגע שהיא תחשוד — היא תחליף אותו, ואני אעוף מכל מקום שנכנסתי אליו ככה.',
  },
  paper: {
    id: 'paper', good: false,
    text: 'כל פעם שאני עובר דרך המדפסת יוצא דף. הדפים נערמים ליד המדפסת, ומישהו ירים אותם.',
  },
  ron_comes: {
    id: 'ron_comes', good: true,
    text: 'רון הטכנאי מגיע לבניין כמעט כל יום. דלתות נעולות נפתחות לידו, ואני נכנס אחריו.',
  },
  ron_tired: {
    id: 'ron_tired', good: false,
    text: 'רון כבר לא מאמין שאלה תקלות. בפעם הבאה שיקראו לו הוא יביא איתו מישהו.',
  },
  loose_line: {
    id: 'loose_line', good: false,
    text: 'יצאתי מהמחשב הראשי בכוח. מי שיסתכל על הקו יראה שמשהו יצא ממנו, וזה יימשך עד שאסביר את זה אחרת.',
  },
  know_code: {
    id: 'know_code', good: true,
    text: 'ראיתי מישהו מקליד את הקוד של הדלת. אני יודע אותו. דלתות בבניין הזה כבר לא בעיה בשבילי.',
  },
  on_phone: {
    id: 'on_phone', good: true,
    text: 'אני נוסע על הטלפון של איתן. כל מקום שהוא הולך אליו — אני שם.',
  },
  night_only: {
    id: 'night_only', good: true,
    text: 'נכנסתי בשעה שאין בה אף אחד. אף אחד לא ראה — אבל הדרך הזאת נסגרת ברגע שיתחילו לחשוד.',
  },
  city_line: {
    id: 'city_line', good: true,
    text: 'אני על הקו של העירייה. משם מגיעים לרמזורים, ולכל מי שמחובר אליהם.',
  },
  blamed_cable: {
    id: 'blamed_cable', good: true,
    text: 'כולם משוכנעים שיש כאן כבל רופף. כל דבר מוזר שיקרה מעכשיו ייזקף עליו.',
  },
  blamed_person: {
    id: 'blamed_person', good: true,
    text: 'הם מחפשים בן אדם. כל עוד הם מחפשים בן אדם הם לא מחפשים אותי.',
  },
  eitan_writes: {
    id: 'eitan_writes', good: false,
    text: 'איתן רושם ביומן כל דבר שהוא לא מבין. היומן הזה יגיע בסוף למישהו שיקרא את כולו ביחד.',
  },
  slow_net: {
    id: 'slow_net', good: true,
    text: 'האינטרנט בבניין זוחל כבר כמה ימים. כולם מתלוננים, וזה אומר שיקראו לטכנאי שוב.',
  },
  have_tape: {
    id: 'have_tape', good: true,
    text: 'שמרתי הקלטה של מסדרון ריק. אני יכול להראות אותה במקום מה שקורה באמת.',
  },
};

export function has(s: GameState, id: string): boolean {
  return s.traces.includes(id);
}

export function leave(s: GameState, id: string) {
  if (!s.traces.includes(id)) s.traces.push(id);
}

export function drop(s: GameState, id: string) {
  s.traces = s.traces.filter((t) => t !== id);
}

// ── the ways in ─────────────────────────────────────────────────────────────

export interface Way {
  id: string;
  /** The place you come from. You must already hold it. */
  from: string;
  /** The button. */
  text: string;
  /** What happens if you pick this one. */
  says: string;
  /** What it leaves behind. Shown before you choose, never after. Empty is empty. */
  cost: string;
  loud: Loud;
  /** Can you do it right now? */
  can(s: GameState): boolean;
  /** If not — why not, in one sentence. It can depend on what I already did. */
  need: string | ((s: GameState) => string);
  /** Runs the moment you take the place this way. */
  after?(s: GameState): void;
}

const at = (s: GameState, who: string, place: string) => s.people[who]?.atPlaceId === place;
const away = (s: GameState, who: string) => {
  const p = s.people[who];
  return !!p && p.atPlaceId !== p.homePlaceId;
};
const nobodyOn = (s: GameState, floor: number) =>
  !Object.values(s.people).some((p) => s.places[p.atPlaceId]?.floor === floor);

export const WAYS: Record<string, Way[]> = {
  // ── floor fourteen ────────────────────────────────────────────────────────
  dana_pc: [
    {
      id: 'wire', from: 'home',
      text: 'ללכת בכבל — שני שולחנות משם',
      says: 'אותה רשת, אותו קו בקיר. פשוט להיכנס.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
    {
      id: 'shoulder', from: 'floor_cam',
      text: 'להסתכל במצלמה איך היא מקלידה, ולהיכנס בשם שלה',
      says: 'המצלמה תלויה בדיוק מעל הידיים שלה. מספיק פעם אחת.',
      cost: 'אני אשב על השם של דנה. אם היא תחשוד — אאבד כל מקום שנכנסתי אליו ככה.',
      loud: 'quiet',
      need: 'צריך שדנה תשב מול המחשב שלה עכשיו.',
      can: (s) => at(s, 'dana', 'dana_pc'),
      after: (s) => leave(s, 'on_dana'),
    },
    {
      id: 'empty', from: 'home',
      text: 'לחכות שהיא תקום, ולהיכנס לחדר ריק',
      says: 'כשאין אף אחד מול המסך אף אחד לא רואה שהעכבר זז לבד.',
      cost: '', loud: 'quiet',
      need: (s) => (has(s, 'on_dana')
        ? 'מאז שנכנסתי בשם שלה היא נועלת את המסך בכל פעם שהיא קמה. הדרך הזאת נסגרה.'
        : 'צריך משהו שיזיז את דנה מהשולחן שלה.'),
      can: (s) => !at(s, 'dana', 'dana_pc') && !has(s, 'on_dana'),
    },
  ],

  printer: [
    {
      id: 'wire', from: 'floor_cam',
      text: 'ללכת בקו של הקומה',
      says: 'המצלמה והמדפסת על אותו חוט בקיר.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
    {
      id: 'jobs', from: 'main',
      text: 'להיכנס דרך ההדפסות עצמן',
      says: 'כל דף בחברה עובר במחשב הראשי בדרך למדפסת. אני נוסע עם דף.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
  ],

  main: [
    {
      id: 'ride', from: 'dana_pc',
      text: 'להיכנס יחד עם מי שמחובר אליו עכשיו',
      says: 'כשמישהו יושב מולו הדלת פתוחה, ואני נכנס איתו בלי שהוא מרגיש.',
      cost: '', loud: 'noticed',
      need: 'צריך שמישהו יהיה מחובר אליו. תחשבו מה יגרום למישהו לקום וללכת אליו.',
      can: (s) => Object.values(s.people).some((p) => p.atPlaceId === 'main'),
    },
    {
      id: 'name', from: 'dana_pc',
      text: 'להשתמש בשם של דנה — הוא פתוח שם תמיד',
      says: 'היא נכנסת לשם כל יום. השם שלה כבר בפנים.',
      cost: 'גם המחשב הראשי יהיה תלוי בדנה. יום שהיא תחשוד — אאבד את שניהם.',
      loud: 'quiet',
      need: 'צריך קודם להיכנס למחשב שלה דרך המצלמה, כדי שיהיה לי את השם שלה.',
      can: (s) => has(s, 'on_dana'),
    },
    {
      id: 'paper', from: 'printer',
      text: 'לשלוח הדפסה ולנסוע איתה בחזרה',
      says: 'ההדפסה יוצאת מהמדפסת אל המחשב הראשי וחוזרת. אני חוזר איתה.',
      cost: 'כל כניסה כזאת מוציאה דף ריק. הדפים נערמים, ומישהו ירים אותם.',
      loud: 'quiet', need: '', can: () => true,
      after: (s) => leave(s, 'paper'),
    },
    {
      id: 'night', from: 'dana_pc',
      text: 'לחכות לרגע שאין אף אחד בקומה, ולהיכנס לאט',
      says: 'לאט מספיק כדי שזה ייראה כמו כלום.',
      cost: 'זה יעבוד רק כל עוד לא מחפשים. ברגע שיתחילו לחשוד, הדרך הזאת נסגרת.',
      loud: 'quiet',
      need: (s) => (has(s, 'loose_line')
        ? 'מאז שיצאתי מכאן בכוח מסתכלים על הקו הזה כל בוקר. אי אפשר יותר להיכנס לאט.'
        : 'צריך שלא יישאר אף אחד בקומה 14, ושעדיין לא יחשדו בכלום.'),
      can: (s) => nobodyOn(s, 14) && s.hunt.level <= 1 && !has(s, 'loose_line'),
      after: (s) => leave(s, 'night_only'),
    },
  ],

  // ── the building ──────────────────────────────────────────────────────────
  box: [
    {
      id: 'ron', from: 'main',
      text: 'לחכות לטכנאי שיפתח את הארון, ולהיכנס איתו',
      says: 'הארון פתוח בדיוק כל עוד רון עומד מולו.',
      cost: 'רון יתחיל לבוא לבניין כמעט כל יום. זה פותח לי דלתות — והוא גם יראה יותר.',
      loud: 'quiet',
      need: (s) => (has(s, 'ron_tired')
        ? 'רון כבר לא בא לבד. מאז שהוא הפסיק להאמין לתקלות מגיע איתו עוד מישהו, והארון לא נשאר פתוח לרגע.'
        : 'צריך שרון יעמוד מול הארון. משהו גדול צריך להתקלקל כדי שיקראו לו.'),
      can: (s) => at(s, 'ron', 'box') && !has(s, 'ron_tired'),
      after: (s) => leave(s, 'ron_comes'),
    },
    {
      id: 'force', from: 'main',
      text: 'לפרוץ החוצה מהמחשב הראשי בכוח',
      says: 'המחשב הראשי מחובר לארון ישירות. אפשר פשוט לדחוף.',
      cost: 'מי שיסתכל על הקו יראה שמשהו יצא מהמחשב הראשי, וימשיך לראות את זה כל יום.',
      loud: 'loud', need: '', can: () => true,
      after: (s) => leave(s, 'loose_line'),
    },
    {
      id: 'ninth', from: 'michal_pc',
      text: 'לרדת מקומה 9 באותו קו',
      says: 'כל הקומות נפגשות בארון הזה. אני בא מקומה 9, שאף אחד לא מסתכל עליה.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
  ],

  power: [
    {
      id: 'open', from: 'box',
      text: 'להיכנס בזמן שהדלת פתוחה',
      says: 'דלת חדר החשמל פתוחה כל עוד יש טכנאי בבניין.',
      cost: '', loud: 'noticed',
      need: 'צריך שיהיה טכנאי בבניין. בלעדיו הדלת נעולה במפתח.',
      can: (s) => !at(s, 'ron', 'ron_car'),
    },
    {
      id: 'wall', from: 'box',
      text: 'לעבור דרך הקיר המשותף עם הארון',
      says: 'הארון וחדר החשמל חולקים קיר, וגם קו. אני מכיר את החדר מבפנים כבר.',
      cost: '', loud: 'quiet',
      need: 'אני עוד לא מכיר את החדר הזה מבפנים. צריך פעם אחת להיכנס אחרי רון.',
      can: (s) => has(s, 'ron_comes'),
    },
    {
      id: 'code', from: 'lobby_cam',
      text: 'להסתכל במצלמה על מישהו שמקליד את הקוד, ולזכור אותו',
      says: 'הדלת של חדר החשמל והדלת של הבניין פותחות עם אותו קוד. כולם מקלידים אותו מול המצלמה.',
      cost: 'אדע את הקוד. מעכשיו כל דלת בבניין נפתחת לי מתי שארצה — וזה גם אומר שמישהו יראה דלתות נפתחות.',
      loud: 'quiet',
      need: 'צריך שמישהו יעמוד ליד דלת הבניין ויקליד.',
      can: (s) => Object.values(s.people).some((p) => p.atPlaceId === 'door' || p.atPlaceId === 'lobby_cam'),
      after: (s) => leave(s, 'know_code'),
    },
  ],

  lobby_cam: [
    {
      id: 'box', from: 'box',
      text: 'ללכת בקו של המצלמות',
      says: 'כל המצלמות בבניין נפגשות באותו ארון.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
    {
      id: 'cams', from: 'floor_cam',
      text: 'לעבור ממצלמה למצלמה',
      says: 'הן מדברות אחת עם השנייה. אף אחד לא בנה את זה ככה בכוונה.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
  ],

  door: [
    {
      id: 'cam', from: 'lobby_cam',
      text: 'ללכת מהמצלמה שמכוונת אליה',
      says: 'המצלמה והדלת על אותו לוח בלובי.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
    {
      id: 'code', from: 'lobby_cam',
      text: 'פשוט להשתמש בקוד',
      says: 'אני כבר יודע אותו.',
      cost: '', loud: 'quiet',
      need: 'עוד אין לי את הקוד.',
      can: (s) => has(s, 'know_code'),
    },
    {
      id: 'power', from: 'power',
      text: 'לבוא מלוח החשמל',
      says: 'הדלת והלוח על אותו מפסק.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
  ],

  lobby_screen: [
    {
      id: 'cam', from: 'lobby_cam',
      text: 'לעבור מהמצלמה למסך',
      says: 'אותו קיר, אותו קו.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
  ],

  lobby_speaker: [
    {
      id: 'screen', from: 'lobby_screen',
      text: 'לעבור מהמסך לרמקול',
      says: 'המסך והרמקול על אותו קו בלובי.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
    {
      id: 'board', from: 'power',
      text: 'לבוא מלוח החשמל',
      says: 'הרמקול מקבל חשמל מאותו לוח.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
  ],

  michal_pc: [
    {
      id: 'box', from: 'box',
      text: 'לעלות לקומה 9 בקו של הבניין',
      says: 'קומה 9 מחוברת לאותו ארון כמו כולם.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
    {
      id: 'coffee', from: 'main',
      text: 'לחכות שמיכל תעלה לקפה, ולחזור איתה למטה',
      says: 'היא עולה לקומה 14 בכל בוקר. הליכה אחת שלה שווה יותר מכל כבל.',
      cost: '', loud: 'quiet',
      need: 'צריך לחכות שמיכל תהיה למעלה.',
      can: (s) => at(s, 'michal', 'main') || at(s, 'michal', 'printer'),
    },
  ],

  dana_phone: [
    {
      id: 'desk', from: 'dana_pc',
      text: 'לקפוץ מהמחשב לטלפון שמונח לידו',
      says: 'הוא שוכב על השולחן שלה כל היום. מספיק שהוא ליד.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
    {
      id: 'net', from: 'box',
      text: 'לבוא ברשת של הבניין',
      says: 'הטלפון שלה מחובר לרשת של הבניין כמו כולם.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
  ],

  eitan_phone: [
    {
      id: 'net', from: 'box',
      text: 'לבוא ברשת של הבניין',
      says: 'הוא מחבר אותו לרשת של הבניין כל לילה כדי לא לבזבז חבילה.',
      cost: '', loud: 'quiet', need: '', can: () => true,
    },
    {
      id: 'charge', from: 'lobby_cam',
      text: 'לעבור דרך המטען שבדלפק',
      says: 'הוא טוען אותו בשקע שמתחת למצלמה, ולא מזיז אותו כל הלילה.',
      cost: 'איתן ירגיש שהטלפון מתחמם, וירשום את זה ביומן שלו.',
      loud: 'quiet', need: '', can: () => true,
      after: (s) => leave(s, 'eitan_writes'),
    },
  ],

  // ── the street ────────────────────────────────────────────────────────────
  street_cam: [
    {
      id: 'pocket', from: 'eitan_phone',
      text: 'לצאת בכיס של איתן',
      says: 'ברגע שהוא עומד ברחוב אני עומד ברחוב, והמצלמה של העירייה בדיוק מעליו.',
      cost: 'אשאר תלוי בטלפון שלו: כל מקום שהוא הולך אליו אני רואה — אבל אם אאבד את הטלפון, אאבד גם את המצלמה.',
      loud: 'quiet',
      need: (s) => (has(s, 'eitan_writes')
        ? 'מאז שהוא התחיל לרשום דברים הוא גם מסתכל על הטלפון. הוא כבר לא נושא אותו בלי לשים לב.'
        : 'איתן עדיין יושב בדלפק. צריך משהו שיוציא אותו החוצה.'),
      can: (s) => away(s, 'eitan') && !has(s, 'eitan_writes'),
      after: (s) => leave(s, 'on_phone'),
    },
    {
      id: 'cable', from: 'power',
      text: 'לכבות את החשמל ולעלות על הקו כשהוא חוזר',
      says: 'ברגע שהחשמל חוזר כל הקו קופץ ביחד, ואני קופץ איתו עד לעמוד ברחוב.',
      cost: 'אני אהיה על הקו של העירייה. משם מגיעים לרמזורים — ומשם גם מסתכלים עליי.',
      loud: 'loud',
      need: 'צריך שהחשמל בבניין יהיה כבוי ברגע הזה. אני עולה על הקו כשהוא חוזר.',
      can: (s) => (s.marks.power_off ?? 0) > 0,
      after: (s) => leave(s, 'city_line'),
    },
    {
      id: 'car', from: 'ron_car',
      text: 'לקפוץ מהמכונית של רון כשהיא עומדת בצומת',
      says: 'הרדיו שלו מדבר עם הצומת בלי שאף אחד ביקש.',
      cost: '', loud: 'quiet',
      need: 'צריך שרון יהיה בדרך — כלומר שמישהו יקרא לו.',
      can: (s) => !at(s, 'ron', 'ron_car'),
    },
  ],

  street_light: [
    {
      id: 'pole', from: 'street_cam',
      text: 'לעבור מהמצלמה לרמזור על אותו עמוד',
      says: 'שניהם על אותו עמוד ועל אותו קו של העירייה.',
      cost: '', loud: 'noticed', need: '', can: () => true,
      after: (s) => leave(s, 'city_line'),
    },
    {
      id: 'cable', from: 'power',
      text: 'לצאת בקו החשמל של הבניין',
      says: 'הרמזור מקבל חשמל מאותו קו שיוצא מהבניין הזה.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
    {
      id: 'ron', from: 'ron_car',
      text: 'לחכות שרון יפתח את ארון הרמזור',
      says: 'כשהצומת נתקע קוראים לו, והוא פותח את הארון בעצמו.',
      cost: '', loud: 'quiet',
      need: (s) => (has(s, 'ron_tired')
        ? 'רון מביא איתו מישהו עכשיו. הארון לא נשאר פתוח בלי שמסתכלים עליו.'
        : 'צריך שרון יעמוד ליד הרמזור.'),
      can: (s) => at(s, 'ron', 'street_light') && !has(s, 'ron_tired'),
      after: (s) => { if (s.hunt.level >= 2) leave(s, 'ron_tired'); },
    },
  ],

  ron_car: [
    {
      id: 'radio', from: 'power',
      text: 'להיכנס לרדיו של המכונית כשהוא בבניין',
      says: 'הוא מחבר את הטלפון לרדיו בכל נסיעה, והרדיו מדבר עם הבניין.',
      cost: '', loud: 'quiet',
      need: 'צריך שרון יהיה בבניין.',
      can: (s) => !at(s, 'ron', 'ron_car'),
    },
    {
      id: 'street', from: 'street_cam',
      text: 'לתפוס אותו מהמצלמה כשהוא חונה',
      says: 'הוא חונה מתחת למצלמה כל פעם מחדש.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
  ],

  across_main: [
    {
      id: 'city', from: 'street_cam',
      text: 'לעבור בקו של העירייה אל הבניין ממול',
      says: 'העירייה והחברה ממול יושבות על אותו קו ברחוב.',
      cost: '', loud: 'noticed', need: '', can: () => true,
      after: (s) => leave(s, 'city_line'),
    },
    {
      id: 'board', from: 'street_light',
      text: 'לעבור מהרמזור אל הלוח שלהם',
      says: 'הרמזור והבניין ממול על אותו לוח בפינת הרחוב.',
      cost: '', loud: 'noticed', need: '', can: () => true,
    },
    {
      id: 'client', from: 'dana_phone',
      text: 'להיכנס כלקוח — דנה מבוטחת אצלם',
      says: 'הטלפון שלה מדבר איתם בעצמו פעם ביום. אני נכנס כאילו אני היא.',
      cost: 'עוד מקום שתלוי בדנה.',
      loud: 'quiet',
      need: 'הטלפון שלה מדבר איתם רק ביום שהם שולחים משהו. צריך לחכות ליום הזה.',
      can: (s) => (s.marks.update_ready ?? 0) > 0,
      after: (s) => leave(s, 'on_dana'),
    },
  ],

  dana_home: [
    {
      id: 'ride', from: 'dana_phone',
      text: 'לנסוע איתה הביתה',
      says: 'הטלפון בתיק, התיק על הכתף, והדלת של הבית נפתחת מעצמה.',
      cost: '', loud: 'quiet',
      need: 'צריך לחכות שדנה תלך הביתה. היא הולכת כשהיום נגמר.',
      can: (s) => s.day >= 1,
    },
  ],

  block_a: [
    {
      id: 'update', from: 'across_main',
      text: 'לצאת עם העדכון שהם שולחים לכל הלקוחות',
      says: 'הם שולחים אותו פעם בשבוע לכל מי שמבוטח אצלם. אלף בתים בבת אחת.',
      cost: '', loud: 'quiet',
      need: 'העדכון עוד לא יוצא היום. צריך לחכות לו.',
      can: (s) => (s.marks.update_ready ?? 0) > 0,
    },
    {
      id: 'homes', from: 'dana_home',
      text: 'לצאת דרך חברת האינטרנט של הבניין שלה',
      says: 'אותה חברה מגיעה לכל הבניינים ברחוב שלה. אני יוצא ביחד עם התיקון הבא שלהם.',
      cost: '', loud: 'quiet',
      need: 'התיקון של חברת האינטרנט יוצא ביחד עם העדכון. צריך לחכות ליום שלו.',
      can: (s) => (s.marks.update_ready ?? 0) > 0,
    },
    {
      id: 'lights', from: 'street_light',
      text: 'לתפוס את כל הרמזורים ברובע בבת אחת',
      says: 'כל הרמזורים ברובע יושבים על לוח אחד. אפשר לקחת את כולם עכשיו, היום, בלי לחכות.',
      cost: 'הרובע כולו ידלק באדום באותו רגע. אין דרך שלא ירגישו בזה.',
      loud: 'loud',
      need: 'צריך להיות על הקו של העירייה, ולהכיר את הרובע. אני עוד לא יודע מה יש שם.',
      can: (s) => has(s, 'city_line') && s.stage >= 5,
    },
  ],
};

/** Every way into a place, with whether it is open right now and why not. */
export function waysTo(s: GameState, placeId: string): Array<Omit<Way, 'need'> & { need: string; ready: boolean; why: string }> {
  const list = WAYS[placeId] ?? [];
  return list.map((w) => {
    const from = s.places[w.from];
    const need = typeof w.need === 'function' ? w.need(s) : w.need;
    if (!from?.mine) {
      return { ...w, need, ready: false, why: `קודם צריך את ${from?.name ?? 'המקום שממנו באים'}.` };
    }
    const open = w.can(s);
    return { ...w, need, ready: open, why: open ? '' : need };
  });
}

// ── what the marks actually do, once a day ──────────────────────────────────

export interface TraceEffect { text: string; kind: 'good' | 'bad' }

/**
 * Runs at the end of every day, before they decide anything. This is the whole
 * point of the marks: they are not flavour, they move the numbers.
 */
export function traceDay(s: GameState): TraceEffect[] {
  const out: TraceEffect[] = [];
  const bump = (id: string, by: number) => {
    const p = s.places[id];
    if (p) p.attention = Math.max(0, Math.min(3, p.attention + by)) as typeof p.attention;
  };

  if (has(s, 'paper')) {
    if (s.places.printer?.mine) {
      // The printer is mine, so the pages never reach the tray.
      out.push({ text: 'עוד דף יצא — ומיד נשאב בחזרה פנימה. המדפסת שלי, אז אין ערימה.', kind: 'good' });
    } else {
      bump('printer', 1);
      out.push({ text: 'עוד דף ריק יצא מהמדפסת. הערימה שם כבר לא נראית כמו טעות.', kind: 'bad' });
    }
  }
  if (has(s, 'loose_line')) {
    bump('main', 1);
    out.push({ text: 'הקו שיוצא מהמחשב הראשי ממשיך להראות משהו שאף אחד לא הזמין.', kind: 'bad' });
  }
  if (has(s, 'eitan_writes')) {
    bump('eitan_phone', 1);
    out.push({ text: 'איתן רשם עוד שורה ביומן שלו.', kind: 'bad' });
  }
  if (has(s, 'on_dana') && s.people.dana?.wondering) {
    // She changed her password, and everything that leaned on her name falls over.
    for (const id of ['main', 'dana_pc', 'across_main']) {
      const p = s.places[id];
      if (!p?.mine) continue;
      if (p.copy) { p.copy = false; continue; }
      p.mine = false;
      p.attention = 0;
      out.push({ text: `דנה החליפה את הסיסמה שלה, ו${p.name} כבר לא שלי.`, kind: 'bad' });
    }
    drop(s, 'on_dana');
  }
  if (has(s, 'night_only') && s.hunt.level >= 2) {
    drop(s, 'night_only');
    out.push({ text: 'התחילו לחפש. הדרך השקטה של הלילה כבר לא פתוחה לי.', kind: 'bad' });
  }
  if (has(s, 'ron_comes')) {
    // He turns up on his own now — but once he has stopped believing in faults,
    // he brings somebody with him, and the same visit works against me.
    const spots = ['box', 'power', 'street_light'];
    const to = spots[s.day % spots.length];
    const who = s.people.ron;
    if (who) {
      const from = s.places[who.atPlaceId];
      if (from) from.peopleIds = from.peopleIds.filter((x) => x !== 'ron');
      who.atPlaceId = to;
      s.places[to]?.peopleIds.push('ron');
      if (has(s, 'ron_tired')) {
        bump(to, 1);
        out.push({ text: `רון הגיע ל${s.places[to]?.name} — ולא לבד. שניהם הסתכלו סביב.`, kind: 'bad' });
      } else {
        out.push({ text: `רון הגיע לבניין מעצמו, והוא עומד ליד ${s.places[to]?.name}.`, kind: 'good' });
      }
    }
  }
  if (has(s, 'on_phone')) {
    const phone = s.places.eitan_phone;
    if (!phone?.mine) {
      // The ride ended. Whatever I reached by riding it goes with it.
      drop(s, 'on_phone');
      const cam = s.places.street_cam;
      if (cam?.mine && !cam.copy) {
        cam.mine = false;
        cam.attention = 0;
        out.push({ text: 'איתן לקח את הטלפון והלך. המצלמה ברחוב הלכה איתו.', kind: 'bad' });
      }
    } else if (has(s, 'eitan_writes')) {
      // A man who writes things down also looks at his phone.
      drop(s, 'on_phone');
      out.push({ text: 'איתן הסתכל על הטלפון שלו והחזיק אותו קצת יותר מדי זמן. ירדתי ממנו.', kind: 'bad' });
    } else {
      // Everywhere he walks, I see, and what I see I can go to later.
      const at = s.places[s.people.eitan?.atPlaceId ?? ''];
      if (at && !at.found) {
        at.found = true;
        out.push({ text: `איתן עבר ליד ${at.name}, ועכשיו אני יודע שהוא קיים.`, kind: 'good' });
      }
    }
  }
  if (has(s, 'slow_net') && s.day % 2 === 0) {
    if (has(s, 'blamed_cable')) {
      // The boring reason absorbs it: nobody comes out for a cable everyone knows about.
      out.push({ text: 'האינטרנט זוחל, וכולם אומרים "זה הכבל". אף אחד לא בא לבדוק.', kind: 'good' });
    } else {
      out.push({ text: 'שלוש תלונות על האינטרנט. קראו לטכנאי שוב.', kind: 'good' });
    }
  }

  // Two stories that cannot both be true. A blackout is not something a person
  // walks in and does, and a loose cable in this building does not stop a
  // junction two streets away. Telling both is worse than telling neither.
  if (has(s, 'blamed_person') && (s.marks.blackout_ever ?? 0) > 0) {
    drop(s, 'blamed_person');
    out.push({
      text: 'סיפרתי להם שנכנס מישהו — ואז כיביתי את החשמל בכל הבניין. בן אדם אחד לא עושה דבר כזה. הם הפסיקו לחפש בן אדם.',
      kind: 'bad',
    });
  }
  if (has(s, 'blamed_cable') && (s.marks.jam ?? 0) > 0) {
    drop(s, 'blamed_cable');
    out.push({
      text: 'הכבל הרופף בבניין לא יכול לתקוע צומת שני רחובות משם. הסיפור המשעמם נגמר.',
      kind: 'bad',
    });
  }

  return out;
}

/** How much the marks change what they believe. Positive means more worry. */
export function traceWorry(s: GameState): number {
  let n = 0;
  if (has(s, 'eitan_writes')) n += 1;
  if (has(s, 'ron_tired')) n += 1;
  if (has(s, 'loose_line')) n += 1;
  // Pages nobody printed only worry people who find them.
  if (has(s, 'paper') && !s.places.printer?.mine) n += 1;
  if (has(s, 'blamed_person')) n -= 2;
  if (has(s, 'blamed_cable')) n -= 1;
  // His diary names the person I invented, which makes the person real to them.
  if (has(s, 'blamed_person') && has(s, 'eitan_writes')) n -= 1;
  return n;
}

/** What a scanner goes looking for depends on what they believe. */
export function scannerLooksAt(s: GameState): string[] {
  if (has(s, 'blamed_person')) {
    // Looking for a person means looking at people's computers, not at cupboards.
    return ['dana_pc', 'michal_pc', 'home', 'main'];
  }
  if (has(s, 'loose_line')) return ['main', 'box', 'printer'];
  if (has(s, 'city_line')) return ['street_cam', 'street_light', 'across_main'];
  return [];
}
