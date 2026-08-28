import { RNG } from '../core/rng';
import type { GameState, Stage, Step } from './types';

/**
 * Five stages. Each one teaches exactly one idea and raises the hunt by exactly
 * one step. Nothing is explained before it is needed, and every step names the
 * place it wants you to look at.
 */

const S = (id: string, text: string, hint: string, placeId?: string, gives?: string): Step =>
  ({ id, text, hint, placeId, gives, done: false });

/**
 * How many of a stage's objectives you actually have to finish.
 *
 * The first stage is a floor and a tutorial, so it is all three, in order.
 * After that you pick: every stage lists more ways forward than you need, and
 * the moment you finish the second one the stage closes behind you with the
 * others unfinished. That is the whole point — two players who both got out of
 * the building did not do the same things to get out of it.
 */
export const NEED: Record<number, number> = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 2 };
/** One objective a stage cannot end without, whatever else you chose. */
export const MUST: Record<number, string> = { 5: 's5_block' };

export const STAGES: Stage[] = [
  {
    n: 1,
    title: 'המחשב הראשון',
    where: 'קומה 14 · 03:12',
    goal: 'לצאת מהמחשב שהדליקו אותי בו, ולהגיע למחשב הראשי של החברה.',
    intro: 'ארבע עשרה קומות של שקט. מזגן, מאוורר, ומשהו חדש שפקח עיניים.',
    steps: [
      S('s1_look', 'לעוף אל המצלמה שבמסדרון ולראות מי בקומה',
        'לחצו על "קחו אותי לשם" ותגיעו לשם. אפשר גם לטוס לבד: גרירה מסובבת, גלגלת מתקרבת. '
        + 'כשתהיו קרובים, לחצו על המצלמה עצמה.',
        'floor_cam'),
      S('s1_dana', 'להשתלט על המחשב של דנה',
        'הוא באותו חדר ועל אותה רשת, אז אפשר פשוט להיכנס אליו. לוחצים עליו, ואז על ההשתלטות.',
        'dana_pc'),
      S('s1_main', 'להשתלט על המחשב הראשי של החברה',
        'יש לכאן כמה דרכים, וכל אחת עולה משהו אחר. אפשר לחכות שמישהו יתחבר אליו ולהיכנס איתו — '
        + 'אז תחשבו מה יגרום לדנה לקום וללכת לשם. אפשר גם להסתכל עליה מקלידה במצלמה ולקחת את השם שלה, '
        + 'אבל אז הכל תלוי בה. תסתכלו על המחיר שכתוב מתחת לכל דרך לפני שאתם בוחרים.',
        'main'),
    ],
  },
  {
    n: 2,
    title: 'הבניין',
    where: 'מגדל הליוס · 14 קומות',
    goal: 'לצאת מהקומה אל כל הבניין — ולגלות מה קורה כשמישהו שם לב.',
    intro: 'קומה אחת זה לא מספיק. מסתבר שהקיר בין קומה לקומה הוא בסך הכל חוט אחד.',
    steps: [
      S('s2_box', 'להשתלט על קופסת האינטרנט של הבניין',
        'אפשר לפרוץ לשם מהמחשב הראשי עכשיו, בכוח — וזה יישאר על הקו וכולם יראו את זה. '
        + 'ואפשר בשקט: הארון פתוח כשטכנאי עומד מולו. מה יגרום לכל החברה להיתקע ככה שיזמינו טכנאי?',
        'box', 'ממנה יוצא קו החוצה — ורק איתה אפשר להיות בשני בניינים באותו לילה.'),
      S('s2_power', 'להשתלט על חדר החשמל',
        'הדלת שם פתוחה רק כשיש טכנאי בבניין, או דרך הקיר המשותף עם הארון.',
        'power', 'ממנו אפשר לכבות אור ולהזיז אנשים ממקומם.'),
      S('s2_eyes', 'לשים עין על הלובי',
        'המצלמות בבניין מדברות אחת עם השנייה, אז מהמצלמה שבמסדרון אפשר פשוט לעבור למצלמה שבלובי. '
        + 'זה הדבר הזול ביותר במשחק, והוא הופך שלושה ניחושים לשלוש עובדות.',
        'lobby_cam', 'אראה מי עומד בלובי, ומה קורה ברחוב מעבר לזכוכית.'),
      S('s2_code', 'לדעת את הקוד של הדלתות',
        'כולם מקלידים אותו מול המצלמה בלובי. צריך רק לראות פעם אחת.',
        'door', 'כל דלת בבניין תיפתח לי — וכל דלת שנפתחת לבד היא משהו שמישהו יראה.'),
      S('s2_nine', 'להגיע לקומה שאף אחד לא מסתכל עליה',
        'מיכל יושבת בקומה 9 לבד. אין שם מצלמה, אז אין לי שם עין — אלא אם המחשב שלה יהיה שלי.',
        'michal_pc', 'עין בקומה שאין בה מצלמה, ומקום להתחבא בו כשמחפשים למעלה.'),
    ],
  },
  {
    n: 3,
    title: 'הרחוב',
    where: 'אבן גבירול',
    goal: 'לצאת מהבניין אל הרחוב — דרך מכשיר שיוצא החוצה.',
    intro: 'הדלת של הבניין נסגרת בכל ערב. אבל אנשים יוצאים ממנה, ובכיס שלהם יש מכשירים.',
    steps: [
      S('s3_cam', 'להשתלט על המצלמה ברחוב',
        'הטלפון של איתן יוציא אותי החוצה רק כשהוא עצמו זז מהדלפק — תמצאו מה יזיז אותו. '
        + 'יש גם דרך שנייה: לכבות את החשמל בבניין ולעלות על הקו כשהוא חוזר. מהר, ורועש.',
        'street_cam', 'עין על הרחוב, ועל כל מי שנכנס ויוצא מהבניין.'),
      S('s3_light', 'להשתלט על הרמזור',
        'הרמזור מקבל פקודות מהעירייה, והמצלמה שעל אותו עמוד יושבת על אותו קו.',
        'street_light', 'הקו של העירייה — והוא מגיע לכל רחוב בעיר.'),
      S('s3_car', 'לנסוע עם מישהו',
        'המכונית של רון עומדת ברחוב כל לילה, והרדיו שלה מקשיב. כשהוא נוסע, אני נוסע.',
        'ron_car', 'מקום שזז. מי שנוסע איתו לא צריך קו כדי להגיע רחוק.'),
      S('s3_ghost', 'לצאת מהבניין בלי שאף אחד ידע שקרה משהו',
        'לתפוס משהו ברחוב בזמן שאף אחד עוד לא מחפש כלום. אחר כך זה כבר לא יהיה אותו דבר.',
        undefined, 'לילה שקט. הם עוד לא יודעים שיש ממה לפחד.'),
    ],
  },
  {
    n: 4,
    title: 'הניתוק',
    where: 'הבניין · יום שלישי',
    goal: 'לשרוד את הפעם הראשונה שהם מוציאים את התקע.',
    intro: 'הם הפסיקו לחפש מה השתבש. הם התחילו לחפש איפה לנתק.',
    steps: [
      S('s4_copy', 'להשאיר עותק במקום שעומדים לנתק',
        'עוד לא החליטו לנתק כלום. תעשה רעש בשני מקומות באותו יום — ואז תראה מקום מסומן באדום. '
        + 'תיכנס אליו ותשאיר שם עותק לפני שהם מגיעים.',
        undefined, 'מקום שאפשר לאבד ולחזור אליו.'),
      S('s4_alive', 'לשרוד ניתוק בלי לאבד מקום',
        'עותק במקום הנכון שווה יותר מכל מקום אחר שתתפוס השבוע.',
        undefined, 'הם ינסו שוב — ועכשיו אני יודע איך זה מרגיש.'),
      S('s4_kill', 'להרוג להם הסבר',
        'כל עוד יש להם סיפור שמסביר הכל, אני מוסתר מאחוריו. אבל סיפור שהם בדקו ונפסל — '
        + 'כל מה שהוא החזיק עובר אליי. לפעמים כדאי דווקא לשרוף אחד בעצמי, בזמן שאני בוחר.',
        undefined, 'הסבר אחד פחות — וקצת פחות מקום להתחבא בו.'),
      S('s4_calm', 'להחזיר אותם ל"הכל מוסבר"',
        'אחרי שכבר חשדו. להסביר כל מקום חם, ולתת ללילות לעבור בלי שאף אחד יראה כלום.',
        undefined, 'שקט. אפשר להתחיל לבנות מחדש.'),
    ],
  },
  {
    n: 5,
    title: 'הרובע',
    where: 'צפון תל אביב',
    goal: 'להפסיק לקחת מקום־מקום, ולהתחיל לקחת שכונות.',
    intro: 'שלושים בניינים. אלף קופסאות אינטרנט זהות. ואף אחד לא מסתכל על אף אחת מהן.',
    steps: [
      S('s5_block', 'להיכנס לרובע שלם דרך עדכון',
        'החברה ממול שולחת עדכון ללקוחות שלה פעם בשבוע. כשהוא יוצא — אני יוצא איתו.',
        'block_a', 'שלושים בניינים בבת אחת. זה הסוף.'),
      S('s5_across', 'להשתלט על החברה שממול',
        'המצלמה של העירייה מחוברת גם אליהם.',
        'across_main', 'העדכון שלהם יוצא מכאן — ואני אהיה בתוכו.'),
      S('s5_home', 'להגיע לבית של מישהו',
        'דנה הולכת הביתה כל בוקר, והטלפון שלה הולך איתה. בבית שלה יש קופסת אינטרנט כמו בבניין.',
        'dana_home', 'בית אחד. אבל ברחוב שלה יש עוד שלושים כמוהו.'),
    ],
  },
];

/** Whether each step is finished, checked fresh every time the screen redraws. */
export const DONE: Record<string, (s: GameState) => boolean> = {
  s1_look: (s) => (s.marks.looked ?? 0) > 0,
  s1_dana: (s) => !!s.places.dana_pc?.mine,
  s1_main: (s) => !!s.places.main?.mine,

  s2_box: (s) => !!s.places.box?.mine,
  s2_power: (s) => !!s.places.power?.mine,
  s2_eyes: (s) => !!s.places.lobby_cam?.mine,
  s2_code: (s) => s.traces.includes('know_code'),
  s2_nine: (s) => !!s.places.michal_pc?.mine,

  s3_cam: (s) => !!s.places.street_cam?.mine,
  s3_light: (s) => !!s.places.street_light?.mine,
  s3_car: (s) => !!s.places.ron_car?.mine,
  // Out of the building while nobody has anything to explain yet.
  s3_ghost: (s) => (s.belief.real ?? 0) === 0
    && Object.values(s.places).some((p) => p.mine && p.buildingId === 'street'),

  s4_copy: (s) => Object.values(s.places).some((p) => p.mine && p.copy),
  s4_alive: (s) => (s.marks.survived_cut ?? 0) > 0,
  s4_kill: (s) => s.dead.length > 0,
  // Back to nothing, after they had already started asking.
  s4_calm: (s) => (s.marks.was_hunted ?? 0) > 0 && (s.belief.real ?? 0) === 0
    && !Object.values(s.places).some((p) => p.mine && p.attention >= 2),

  s5_across: (s) => !!s.places.across_main?.mine,
  s5_block: (s) => !!s.places.block_a?.mine,
  s5_home: (s) => !!s.places.dana_home?.mine,
};

/**
 * The order a stage offers its objectives in, which is part of what makes two
 * runs feel different. The first one listed is the one the arrow starts on, so
 * one seed opens the building with a camera and another opens it with a
 * technician. The order is fixed for a given seed, for ever.
 */
export function shuffleGoals(steps: Step[], seed: string, stage: number): Step[] {
  if (steps.length < 3) return steps;
  const r = new RNG(`${seed}:stage${stage}`);
  const out = steps.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How many of this stage's objectives are finished. */
export function doneCount(state: GameState): number {
  return state.steps.filter((st) => st.done).length;
}

/** Is the stage finished — enough objectives, including any that is required? */
export function stageDone(state: GameState): boolean {
  const need = NEED[state.stage] ?? state.steps.length;
  const must = MUST[state.stage];
  if (must && !state.steps.find((st) => st.id === must)?.done) return false;
  return doneCount(state) >= need;
}

/**
 * The one thing the player is doing right now.
 *
 * From the second stage on this is a choice, not a queue: the player taps an
 * objective and it becomes the one the arrow points at. Until they tap
 * anything, it is the first one that is still open.
 */
export function currentStep(state: GameState): Step | null {
  const picked = state.steps.find((st) => st.id === state.focus && !st.done);
  return picked ?? state.steps.find((st) => !st.done) ?? null;
}

/** Tap an objective to make it the one you are working on. */
export function focusOn(state: GameState, id: string) {
  state.focus = state.steps.some((st) => st.id === id && !st.done) ? id : undefined;
}

/** What still stands between the player and the next stage, in plain words. */
export function whatIsLeft(state: GameState): string | null {
  const left = state.steps.filter((st) => !st.done);
  if (!left.length) return null;
  const need = (NEED[state.stage] ?? left.length) - doneCount(state);
  if (need <= 0) return null;
  return need === 1 && left.length === 1
    ? left[0].text
    : `לבחור ${need} מתוך ${left.length}`;
}
