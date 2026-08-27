import type { GameState, Stage, Step } from './types';

/**
 * Five stages. Each one teaches exactly one idea and raises the hunt by exactly
 * one step. Nothing is explained before it is needed, and every step names the
 * place it wants you to look at.
 */

const S = (id: string, text: string, hint: string, placeId?: string): Step =>
  ({ id, text, hint, placeId, done: false });

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
        'הוא נעול, ונפתח רק כשמישהו מחובר אליו. תסתכלו מי יושב איפה בקומה — '
        + 'ותחשבו מה יגרום לה לקום מהמקום שלה וללכת אליו.',
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
        'הארון בקומת הקרקע, והוא פתוח רק כשטכנאי עומד מולו. '
        + 'מה יגרום לכל החברה להיתקע ככה שיזמינו טכנאי?',
        'box'),
      S('s2_power', 'להשתלט על חדר החשמל',
        'הדלת שם פתוחה רק כשיש טכנאי בבניין. עכשיו יש.',
        'power'),
      S('s2_five', 'להחזיק חמישה מקומות בו־זמנית',
        'כל מקום שאתה תופס מגלה לך את השכנים שלו. תמשיך.'),
    ],
  },
  {
    n: 3,
    title: 'הרחוב',
    where: 'אבן גבירול',
    goal: 'לצאת מהבניין אל הרחוב — דרך מכשיר שיוצא החוצה.',
    intro: 'הדלת של הבניין נסגרת בכל ערב. אבל אנשים יוצאים ממנה, ובכיס שלהם יש מכשירים.',
    steps: [
      S('s3_phone', 'להשתלט על הטלפון של איתן השומר',
        'הטלפון שלו מחובר לרשת של הבניין, והרשת כבר שלי.',
        'eitan_phone'),
      S('s3_cam', 'להשתלט על המצלמה ברחוב',
        'הטלפון יוציא אותי החוצה רק כשאיתן עצמו זז מהדלפק. תמצאו מה יזיז אותו.',
        'street_cam'),
      S('s3_light', 'להשתלט על הרמזור',
        'הרמזור מקבל פקודות מהעירייה, והמצלמה שעל אותו עמוד יושבת על אותו קו.',
        'street_light'),
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
        + 'תיכנס אליו ותשאיר שם עותק לפני שהם מגיעים.'),
      S('s4_alive', 'לשרוד ניתוק בלי לאבד מקום',
        'עותק במקום הנכון שווה יותר מכל מקום אחר שתתפוס השבוע.'),
    ],
  },
  {
    n: 5,
    title: 'הרובע',
    where: 'צפון תל אביב',
    goal: 'להפסיק לקחת מקום־מקום, ולהתחיל לקחת שכונות.',
    intro: 'שלושים בניינים. אלף קופסאות אינטרנט זהות. ואף אחד לא מסתכל על אף אחת מהן.',
    steps: [
      S('s5_across', 'להשתלט על החברה שממול',
        'המצלמה של העירייה מחוברת גם אליהם.',
        'across_main'),
      S('s5_block', 'להיכנס לרובע שלם דרך עדכון',
        'החברה ממול שולחת עדכון ללקוחות שלה פעם בשבוע. כשהוא יוצא — אני יוצא איתו.',
        'block_a'),
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
  s2_five: (s) => Object.values(s.places).filter((p) => p.mine).length >= 5,

  s3_phone: (s) => !!s.places.eitan_phone?.mine,
  s3_cam: (s) => !!s.places.street_cam?.mine,
  s3_light: (s) => !!s.places.street_light?.mine,

  s4_copy: (s) => Object.values(s.places).some((p) => p.mine && p.copy),
  s4_alive: (s) => (s.marks.survived_cut ?? 0) > 0,

  s5_across: (s) => !!s.places.across_main?.mine,
  s5_block: (s) => !!s.places.block_a?.mine,
};

/** The one thing the player should be doing right now. */
export function currentStep(state: GameState): Step | null {
  return state.steps.find((st) => !st.done) ?? null;
}

/** What still stands between the player and the next stage, in plain words. */
export function whatIsLeft(state: GameState): string | null {
  const left = state.steps.filter((st) => !st.done);
  if (!left.length) return null;
  return left.length === 1 ? left[0].text : `${left.length} דברים: ${left.map((l) => l.text).join(' · ')}`;
}
