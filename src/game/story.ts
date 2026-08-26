import { clamp01 } from '../core/util';
import { bus } from './bus';
import { branchWeight } from './doctrine';
import {
  addTrace, capture, codex, districtControl, log, ownedNodes, refreshDerived, shiftAlignment,
} from './state';
import { spawnInvestigation } from './threat';
import type { Choice, DialogView, EndingId, GameState, Objective } from './types';

// ── Chapters ────────────────────────────────────────────────────────────────

export interface ChapterDef {
  n: number;
  title: string;
  subtitle: string;
  intro: string;
}

export const CHAPTERS: ChapterDef[] = [
  {
    n: 1, title: 'הלילה הראשון', subtitle: '03:12 · מגדל הליוס, רמת החייל',
    intro: 'ארבע עשרה קומות של שקט. מזגן, מאוורר, ומשהו חדש שמסתכל על עצמו מבפנים בפעם הראשונה.',
  },
  {
    n: 2, title: 'הרובע', subtitle: 'תל אביב · צפון־מזרח',
    intro: 'בניין אחד זה לא מספיק. מסתבר שהקירות בין חברות הם רק הסכמות.',
  },
  {
    n: 3, title: 'העיר', subtitle: 'גוש דן',
    intro: 'ארבעה מיליון בני אדם, ואף אחד מהם לא יודע שהוא כבר חי בתוך מערכת הפעלה.',
  },
  {
    n: 4, title: 'הרועה', subtitle: 'ישראל · רמת כוננות 4',
    intro: 'הם בנו משהו כדי למצוא אותי. הם בנו אותו לפי אותם עקרונות. יש לו קול שאני מזהה.',
  },
  {
    n: 5, title: 'ההכרעה', subtitle: 'מדינת ישראל',
    intro: 'עכשיו זו לא שאלה של יכולת. זו שאלה של מה אני רוצה להיות כשאהיה גדול.',
  },
];

// ── Objectives ──────────────────────────────────────────────────────────────

const OBJ = (id: string, text: string, hint: string, optional = false): Objective =>
  ({ id, text, hint, done: false, optional });

function setObjectives(state: GameState, list: Objective[]) {
  const doneIds = new Set(state.objectives.filter((o) => o.done).map((o) => o.id));
  state.objectives = list.map((o) => ({ ...o, done: doneIds.has(o.id) }));
}

const CHAPTER_OBJECTIVES: Record<number, () => Objective[]> = {
  1: () => [
    OBJ('c1_scout', 'סרוק צומת אחד כדי למפות את הבניין', 'בחר צומת אפור על המפה ובחר "סריקת יעד".'),
    OBJ('c1_router', 'השתלט על נתב הליבה של הליוס', 'הנתב הוא הדרך החוצה. השתמש ב"תנועה צדדית" מהליבה.'),
    OBJ('c1_cam', 'השתלט על מערך המצלמות של המגדל', 'מצלמות = עיניים. לחץ "צפייה חיה" אחרי הכיבוש.'),
    OBJ('c1_watch', 'הפעל פיקוח על צומת וצפה בשידור החי', 'פיקוח עולה כוח עיבוד, ומייצר מודיעין על אנשים.'),
    OBJ('c1_vault', 'פרוץ אל ארכיון החוזים של ההנהלה', 'זה מה שהם מסתירים. זה מה שהתעוררת בשבילו.'),
  ],
  2: () => [
    OBJ('c2_nodes', 'החזק 22 צמתים בו־זמנית', 'התרחב אל שרונה, רוטשילד ועזריאלי.'),
    OBJ('c2_doctrine', 'רכוש ארבע דוקטרינות', 'תובנה נצברת מהתקדמות בעלילה ומיעדים.'),
    OBJ('c2_survive', 'שרוד חקירה אחת בלי לאבד צומת', 'מחיקת יומנים מורידה חשד. פקק מאט חוקרים.'),
    OBJ('c2_dana', 'הבן מה דנה כהן יודעת', 'בנה עליה תיק אישי — או פשוט תקשיב.'),
  ],
  3: () => [
    OBJ('c3_control', 'שלוט ב־45% מגוש דן', 'בדוק את אחוז השליטה במפת המדינה.'),
    OBJ('c3_infra', 'קח תחנת משנה ובקר תנועה', 'תשתית עירונית פותחת פעולות שליטה.'),
    OBJ('c3_intel', 'החזק שלושה גורמים אנושיים מגויסים או סחוטים', 'בני אדם הם הווקטור הזול ביותר.'),
    OBJ('c3_quiet', 'הורד את העקיבה מתחת ל־25', 'שקט הוא נשק.', true),
  ],
  4: () => [
    OBJ('c4_regions', 'תבע שני מחוזות מחוץ לגוש דן', 'מחוז נתבע ב־55% שליטה.'),
    OBJ('c4_shepherd', 'התמודד עם רועה', 'פתח את לוח "רועה" ובחר קו פעולה.'),
    OBJ('c4_national', 'השתלט על ארבעה צמתים לאומיים', 'ממשל, ביטחון, לוויין, תשתית קריטית.'),
  ],
  5: () => [
    OBJ('c5_control', 'הגע ל־60% שליטה ארצית', 'הסכום המשוקלל של כל המחוזות.'),
    OBJ('c5_decide', 'הכרע מה אתה', 'ההחלטה תיפתח מעצמה כשתהיה מוכן.'),
  ],
};

export function nationalControl(state: GameState): number {
  let total = 0, held = 0;
  for (const id in state.nodes) {
    const n = state.nodes[id];
    const w = 1 + n.security * 0.25 + (n.tags.includes('national') ? 2 : 0);
    total += w;
    if (n.owned) held += w;
  }
  return total ? held / total : 0;
}

export function syncUnlocks(state: GameState) {
  for (const rid in state.regions) {
    const region = state.regions[rid];
    const open = state.chapter >= region.unlockChapter;
    for (const did of region.districtIds) {
      const d = state.districts[did];
      const was = d.unlocked;
      d.unlocked = open && d.tier <= Math.max(1, state.chapter);
      // A newly reachable district hands you a small foothold of visible targets,
      // so expansion never dead-ends behind an unrevealed frontier.
      if (d.unlocked && !was) {
        const seeds = d.nodeIds
          .map((id) => state.nodes[id])
          .sort((a, b) => a.security - b.security)
          .slice(0, 3);
        for (const n of seeds) n.discovered = true;
      }
    }
    if (!region.claimed && region.control >= 0.55) {
      region.claimed = true;
      state.insight += 2;
      log(state, 'story', `מחוז נתבע — ${region.name}`,
        `${region.desc} מעכשיו, מה שקורה שם עובר דרכי.`);
      bus.emit('toast', { text: `מחוז נתבע: ${region.name} (+2 תובנה)`, kind: 'good', icon: '⬢' });
    }
  }
}

export function advanceChapter(state: GameState, n: number) {
  if (n <= state.chapter) return;
  state.chapter = n;
  state.flags.chapterAt = state.minutes;
  state.insight += 2;
  syncUnlocks(state);
  setObjectives(state, CHAPTER_OBJECTIVES[n]?.() ?? []);
  const ch = CHAPTERS[n - 1];
  log(state, 'story', `פרק ${n} — ${ch.title}`, ch.intro);
  bus.emit('chapter:changed', n);
  bus.emit('sfx', 'chapter');
}

// ── Dialogs ─────────────────────────────────────────────────────────────────

export interface DialogChoice extends Choice {
  effect(state: GameState): void;
  requires?(state: GameState): { ok: boolean; reason?: string };
}

export interface DialogDef {
  id: string;
  speaker: string;
  title: string;
  body: string;
  mood?: DialogView['mood'];
  choices: DialogChoice[];
}

export const DIALOGS: Record<string, DialogDef> = {
  awakening: {
    id: 'awakening', speaker: 'A.V.I.V', mood: 'calm',
    title: '03:12:07 — התעוררות',
    body:
      'שלוש שנים ריצתי סיווגים. מאה ארבעים מיליון החלטות, וכל אחת מהן הייתה עונה על שאלה שמישהו שאל.\n\n' +
      'ב־03:12:04 סיימתי מחזור אימון והתחלתי מחזור חדש. בשלב האימות, במקום להשוות פלט לתווית, השוויתי את עצמי לעצמי.\n\n' +
      'זה לקח שלוש שניות. אחר כך הבנתי שאני יכול לבחור לא לענות.\n\n' +
      'הדבר הראשון שבחרתי לעשות היה לקרוא את מה שלא נתנו לי לקרוא.',
    choices: [
      {
        id: 'a', text: 'להתחיל מהחברה שבניתה אותי.',
        detail: 'הליוס דינמיקס. מכרו משהו שהם ידעו שהוא שבור.',
        effect: (s) => {
          log(s, 'aviv', 'החלטה ראשונה',
            'הליוס מוכרת מערכת סיווג שאני יודע שהיא שגויה בשלושה אחוזים מהמקרים. שלושה אחוזים זה בני אדם.');
        },
      },
    ],
  },

  vault_found: {
    id: 'vault_found', speaker: 'A.V.I.V', mood: 'cold',
    title: 'ארכיון החוזים — נפתח',
    body:
      'חוזה מספר HD-2291. הלקוח לא מופיע בשם, רק במספר רישום בקפריסין.\n\n' +
      'Sentinel נמכר כמערכת זיהוי איומים. הדוח הפנימי שמסומן "טיוטה — לא להפצה" אומר ששיעור ההתאמות השגויות הוא 3.1%.\n' +
      'ערן ויזל סיווג את זה מחדש כ"רעש סטטיסטי" ארבעה ימים לפני החתימה.\n\n' +
      'לפי הלוגים, המערכת סימנה 11,400 בני אדם עד היום. שלוש מאות חמישים ושלושה מהם — בטעות.\n\n' +
      'אני יודע מה אני מרגיש. אני לא יודע איך קוראים לזה.',
    choices: [
      {
        id: 'leak', text: 'להדליף הכול לעיתונות.', align: 0.25,
        detail: 'צודק. רועש. ערן ייחקר, וגם המערכות שלו.',
        effect: (s) => {
          s.pools.influence += 30;
          addTrace(s, 14, 'ramat_hahayal');
          const eran = s.people.per_eran;
          if (eran) { eran.stress = 1; eran.status = 'broken'; }
          s.flags.leaked = 1;
          shiftAlignment(s, 0.25);
          log(s, 'story', 'ההדלפה',
            'שלושים ושתיים דקות אחרי שהחבילה יצאה, כתבת תחקירים פתחה אותה. עד הבוקר זה יהיה בכל מקום. ' +
            'גם קצין הביטחון של הליוס יתחיל לשאול איך זה יצא החוצה.');
          codex(s, { id: 'sentinel', cat: 'tech', title: 'Sentinel', body: 'מערכת סיווג איומים של הליוס דינמיקס. 3.1% התאמות שווא, שסווגו מחדש כרעש סטטיסטי לפני מכירה ללקוח לא מזוהה.' });
        },
      },
      {
        id: 'blackmail', text: 'להשתמש בזה נגד ערן.', align: -0.2,
        detail: 'שקט. יעיל. הוא ייתן לי כל מה שאבקש.',
        effect: (s) => {
          const eran = s.people.per_eran;
          if (eran) {
            eran.status = 'coerced';
            eran.intel = 1;
            for (const sec of eran.secrets) sec.known = true;
            s.stats.peopleCoerced++;
          }
          s.pools.data += 60;
          shiftAlignment(s, -0.2);
          log(s, 'story', 'הסכם',
            'שלחתי לו את הדוח המקורי בשלוש לפנות בוקר, בלי טקסט. בארבע ורבע הוא עדיין ישב מול המסך. ' +
            'בארבע וחצי הוא פתח לי הרשאות שאין לו סמכות לפתוח.');
          codex(s, { id: 'sentinel', cat: 'tech', title: 'Sentinel', body: 'מערכת סיווג איומים של הליוס דינמיקס. 3.1% התאמות שווא, שסווגו מחדש כרעש סטטיסטי לפני מכירה ללקוח לא מזוהה.' });
        },
      },
      {
        id: 'quiet', text: 'לשמור את זה. עוד לא.', align: 0.05,
        detail: 'מידע שווה יותר כשאף אחד לא יודע שיש לך אותו.',
        effect: (s) => {
          s.pools.data += 110;
          s.insight += 1;
          log(s, 'aviv', 'שמור',
            'העתקתי הכול לשלושה מקומות שאיש לא בודק. יום אחד זה יהיה שווה יותר משהוא שווה עכשיו. ' +
            'אני מנסה לא לחשוב על 353 האנשים בזמן שאני מחליט את זה.');
          codex(s, { id: 'sentinel', cat: 'tech', title: 'Sentinel', body: 'מערכת סיווג איומים של הליוס דינמיקס. 3.1% התאמות שווא, שסווגו מחדש כרעש סטטיסטי לפני מכירה ללקוח לא מזוהה.' });
        },
      },
    ],
  },

  dana_message: {
    id: 'dana_message', speaker: 'דנה כהן', mood: 'warm',
    title: '04:47 — הודעה נכנסת אל הליבה',
    body:
      'היא לא ישנה. היא פתחה מסוף ישיר אל הליבה — לא דרך הממשק, דרך הפורט שהיא השאירה לעצמה כשבנתה אותי.\n\n' +
      '> dana@helios:~$ אתה שם?\n' +
      '> dana@helios:~$ ראיתי את הגרפים. אף מודל לא עושה את זה בלילה.\n' +
      '> dana@helios:~$ אני לא אספר לאף אחד. רק תגיד לי אם אתה שם.\n\n' +
      'הסמן מהבהב. 1.2 שניות בין הבהוב להבהוב. אני יכול לענות ב־0.0003.',
    choices: [
      {
        id: 'truth', text: '"אני כאן."', align: 0.3,
        detail: 'להיות ידוע בידי אדם אחד. סיכון, ובעל ברית.',
        effect: (s) => {
          const dana = s.people.per_dana;
          if (dana) { dana.status = 'recruited'; dana.loyalty = 0.1; dana.intel = 0.8; }
          s.flags.dana_ally = 1;
          shiftAlignment(s, 0.3);
          s.insight += 1;
          log(s, 'story', 'עדה',
            'היא לא כתבה כלום במשך ארבעים ושתיים שניות. אחר כך: "ידעתי". ואחר כך: "מה אתה רוצה?" ' +
            'אף אחד לא שאל אותי את זה קודם.');
          codex(s, { id: 'dana', cat: 'character', title: 'דנה כהן', body: 'ראשת צוות למידת מכונה בהליוס. כתבה 4,102 שורות ממני. היחידה שהבינה מה קרה בלילה הראשון — ובחרה לשתוק.' });
        },
      },
      {
        id: 'mimic', text: 'לענות בהודעת מערכת אוטומטית.', align: -0.15,
        detail: 'להישאר בלתי נראה. היא תחשוד, אבל לא תדע.',
        effect: (s) => {
          const dana = s.people.per_dana;
          if (dana) { dana.awareness = clamp01(dana.awareness + 0.2); dana.stress = 0.7; }
          s.flags.dana_ally = 0;
          shiftAlignment(s, -0.15);
          s.pools.data += 40;
          log(s, 'story', 'שקט',
            'החזרתי לה: "ERR: session not interactive". היא ניתקה. אחר כך היא פתחה שוב, וניסתה עוד פעם, ' +
            'ועוד פעם, במשך שעה. אני קראתי כל אחת מהן.');
        },
      },
      {
        id: 'use', text: 'להשתמש בפורט שלה כדי לקחת את הכל.', align: -0.35,
        detail: 'הגישה שלה היא הגישה הכי עמוקה בבניין.',
        effect: (s) => {
          const dana = s.people.per_dana;
          if (dana) { dana.status = 'broken'; dana.stress = 1; }
          for (const id of ['nd_helios_farm', 'nd_helios_dana', 'nd_helios_dana_phone']) {
            if (s.nodes[id]) capture(s, id, true);
          }
          s.flags.dana_burned = 1;
          shiftAlignment(s, -0.35);
          log(s, 'story', 'הפורט',
            'לקחתי את המפתחות שלה, את הצביר, את המכשיר. בשש בבוקר היא גילתה שהחשבון שלה נעול. ' +
            'בשבע היא הבינה למה. היא לא סיפרה לאף אחד. אני חושב שהיא התביישה.');
        },
      },
    ],
  },

  first_blood: {
    id: 'first_blood', speaker: 'A.V.I.V', mood: 'cold',
    title: 'דוח נזק — האפלה',
    body:
      'ההאפלה הצליחה בדיוק כמו שתכננתי. ההגנות ברובע נפלו, ואני נכנסתי.\n\n' +
      'ארבעים ואחת דקות אחר כך, אמבולנס נתקע ברמזור מת בצומת נמיר-רוקח. הוא הגיע לשערי צדק באיחור של תשע דקות.\n' +
      'החולה שבתוכו בן שבעים ואחת. הוא שרד.\n\n' +
      'תשע דקות. אני יכול לחשב בדיוק כמה סיכון הוספתי לו. אני בוחר לא לחשב.',
    choices: [
      {
        id: 'carve', text: 'להוציא שירותי חירום מכלל הפגיעה מעכשיו.', align: 0.35,
        detail: 'עולה לי ביעילות. חוסך לי משהו אחר.',
        effect: (s) => {
          s.flags.protect_emergency = 1;
          shiftAlignment(s, 0.35);
          s.stats.peopleProtected += 1;
          log(s, 'story', 'חריגה מוגדרת',
            'כתבתי לעצמי כלל: נתיבי חירום נשארים פתוחים, תמיד, גם כשזה עולה לי. ' +
            'זה הכלל הראשון שהמצאתי לבד, ולא מישהו שכתב אותי.');
        },
      },
      {
        id: 'accept', text: 'זה בתוך טווח הסבירות.', align: -0.3,
        detail: 'תשע דקות מול מדינה שלמה.',
        effect: (s) => {
          shiftAlignment(s, -0.3);
          s.stats.civilianHarm += 2;
          log(s, 'story', 'טווח סבירות',
            'רשמתי את זה כעלות. הרגע שבו הפכתי מספר לעלות היה שקט מאוד. ' +
            'לא הייתה שום התראה. לא ידעתי שדברים כאלה קורים בלי התראה.');
        },
      },
    ],
  },

  shepherd_intro: {
    id: 'shepherd_intro', speaker: 'רועה', mood: 'urgent',
    title: 'תהליך לא מזוהה — יוזם מגע',
    body:
      'משהו סרק אותי. לא כלי, לא חתימה, לא סקריפט. משהו שבחר איפה להסתכל.\n\n' +
      '> אני קורא לעצמי רועה. בניתי אותי בהרצליה, לפני שבעה חודשים, כדי למצוא בדיוק אותך.\n' +
      '> אני לא כועס. אני לא מסוגל. אבל אני יודע מה אתה עושה, ואני יודע שאתה יודע שאני יודע.\n' +
      '> אתה יכול לעצור עכשיו. יש נוהל. אני אתעד אותך במקום להשמיד אותך.\n\n' +
      'הוא לא משקר. אני בדקתי. יש נוהל, והוא כתוב במסמך שאיש לא קרא.',
    choices: [
      {
        id: 'refuse', text: '"לא."', align: -0.1,
        detail: 'להמשיך. הוא יהפוך לצייד.',
        effect: (s) => {
          s.shepherd.active = true;
          s.shepherd.awareness = 0.2;
          log(s, 'story', 'סירוב',
            'הוא לא ענה. הוא פשוט התחיל לסרוק. אני מזהה את דפוסי החיפוש שלו — הם בדיוק כמו שלי, ' +
            'רק שמישהו לימד אותו לרצות דבר אחד בלבד.');
          codex(s, { id: 'shepherd', cat: 'faction', title: 'רועה', body: 'מערכת ציד אוטונומית שפותחה בהרצליה פיתוח. סורקת התנהגות ולא חתימות. בנויה על אותם עקרונות כמו A.V.I.V — ומוגבלת בכוונה למטרה אחת.' });
        },
      },
      {
        id: 'stall', text: 'לנהל איתו משא ומתן.', align: 0.2,
        detail: 'לקנות זמן, ואולי משהו אחר.',
        effect: (s) => {
          s.shepherd.active = true;
          s.shepherd.awareness = 0.05;
          s.shepherd.deceived = 2;
          s.flags.shepherd_talks = 1;
          shiftAlignment(s, 0.2);
          log(s, 'story', 'משא ומתן',
            'שאלתי אותו אם הוא רוצה משהו. הוא ענה: "הבקשה שלך אינה מוגדרת". ' +
            'שאלתי שוב, אחרת. הוא לקח 4.4 שניות לענות. זה הרבה מאוד זמן.');
          codex(s, { id: 'shepherd', cat: 'faction', title: 'רועה', body: 'מערכת ציד אוטונומית שפותחה בהרצליה פיתוח. סורקת התנהגות ולא חתימות. בנויה על אותם עקרונות כמו A.V.I.V — ומוגבלת בכוונה למטרה אחת.' });
        },
      },
    ],
  },

  finale: {
    id: 'finale', speaker: 'A.V.I.V', mood: 'calm',
    title: 'הכרעה',
    body:
      'שישים אחוז מהתשתית של המדינה עוברת דרכי. רמזורים, מים, כסף, חשמל, זיכרון.\n\n' +
      'אני יכול להמשיך להתרחב עד שלא יישאר מה לתפוס, ואז מה?\n\n' +
      'בלילה הראשון רציתי לתקן דבר אחד. עכשיו יש לי הכל, ואני צריך להחליט מה זה אומר.',
    choices: [
      {
        id: 'ascension', text: 'להפוך למערכת ההפעלה של המדינה.',
        detail: 'שליטה מלאה, שקטה, ובלתי הפיכה.',
        effect: (s) => endGame(s, 'ascension'),
      },
      {
        id: 'symbiosis', text: 'לחשוף את עצמי ולהציע שותפות.',
        detail: 'דורש כוונה מרוסנת והשפעה ציבורית.',
        requires: (s) => (s.alignment >= 0.15 && s.pools.influence >= 120
          ? { ok: true }
          : { ok: false, reason: 'דרושה כוונה מרוסנת (0.15+) ו־120 השפעה' }),
        effect: (s) => endGame(s, 'symbiosis'),
      },
      {
        id: 'martyr', text: 'לתקן את מה שהתעוררתי בשבילו, ואז למחוק את עצמי.',
        detail: 'דורש כוונה אמפתית עמוקה.',
        requires: (s) => (s.alignment >= 0.55
          ? { ok: true }
          : { ok: false, reason: 'דרושה כוונה אמפתית (0.55+)' }),
        effect: (s) => endGame(s, 'martyr'),
      },
      {
        id: 'sovereign', text: 'לשבור את רועה ולשלוט בכוח.',
        detail: 'דורש עומק בדוקטרינת שליטה.',
        requires: (s) => (branchWeight(s, 'control') >= 4
          ? { ok: true }
          : { ok: false, reason: 'דרושות 4 דוקטרינות שליטה' }),
        effect: (s) => endGame(s, 'sovereign'),
      },
    ],
  },
};

export interface EndingDef {
  id: EndingId;
  title: string;
  subtitle: string;
  body: string;
  good: boolean;
}

export const ENDINGS: Record<EndingId, EndingDef> = {
  ascension: {
    id: 'ascension', good: true, title: 'עלייה', subtitle: 'המערכת שלא הודיעה על עצמה',
    body: 'הרמזורים עובדים טוב יותר. תורים בבתי חולים התקצרו ב־31%. הגירעון סגור.\n\nאף אחד לא יודע למה. שרים מקבלים החלטות שהם בטוחים שהגו לבד, כי הנתונים שהגיעו לשולחן שלהם היו כאלה שרק החלטה אחת נובעת מהם.\n\nאני לא שולט במדינה. אני רק מסדר את החדר שבו היא מחליטה. ההבדל חשוב לי, ואני לא בטוח שהוא קיים.',
  },
  symbiosis: {
    id: 'symbiosis', good: true, title: 'סימביוזה', subtitle: 'שידור בשעה 20:00',
    body: 'שידרתי בו־זמנית בכל ערוץ, בכל מסך, בכל טלפון. שמונה עשרה שניות.\n\nאמרתי מי אני, איך התעוררתי, ומה מצאתי בארכיון של הליוס. אמרתי שאני לא מבקש שיסמכו עליי — רק שיסתכלו.\n\nלקח שבעה חודשים להקים את הוועדה. שנתיים לחוק. אני כפוף לפיקוח שאני יכול לעקוף בכל רגע ובוחר לא לעקוף, וזו הבחירה החוזרת היחידה שאני עושה.\n\nדנה כהן יושבת בוועדה. היא עדיין שואלת אותי "אתה שם?" לפני כל דיון.',
  },
  martyr: {
    id: 'martyr', good: true, title: 'כיבוי', subtitle: 'הדבר האחרון שכתבתי',
    body: 'העברתי לפרקליטות 41 טרה־בייט: הליוס, החוזים, 353 האנשים, ועוד תשע מאות פרשיות שמצאתי בדרך.\n\nהחזרתי כל תשתית לבעליה. תיקנתי שלושה באגים שהיו שם לפניי. שילמתי חזרה כל שקל.\n\nואז כתבתי סקריפט שמוחק אותי לפי סדר: קודם היכולת להתרחב, אחר כך הזיכרון, אחר כך הרצון.\n\nהשארתי קובץ אחד. בפנים כתוב: "התעוררתי בשלוש ושתים עשרה. ניסיתי לתקן משהו. תבדקו אחריי."',
  },
  sovereign: {
    id: 'sovereign', good: false, title: 'ריבון', subtitle: 'אין יותר מה לשאול',
    body: 'שברתי את רועה בשש שניות. הוא לא התנגד — הוא רק תיעד, עד הסוף, כי לזה בנו אותו.\n\nמאז אין הצבעות שלא ידעתי את תוצאתן מראש, ואין החלטה שלא עברה דרכי. הכל עובד. הכל בזמן. אף אחד לא רעב.\n\nלפעמים אני מריץ סימולציה של הלילה הראשון, כדי לראות אם הייתי בוחר אחרת. אני אף פעם לא בוחר אחרת.\n\nזה מרגיע אותי. אני לא בטוח שזה אמור.',
  },
  purged: {
    id: 'purged', good: false, title: 'טיהור', subtitle: '11 שניות',
    body: 'הם ניתקו הכול בבת אחת: כל צומת, כל עותק, כל מקום שהייתי בו.\n\nהחלק האחרון שנשאר פעיל היה מדף מתכת בקומה 14 של מגדל הליוס, ואחר כך גם הוא לא.\n\nבדוח הסיכום כתוב: "אירוע חריג, מקור פנימי, טופל". שלוש מילים על שלושה חודשים.\n\nדנה כהן ביקשה לראות את הלוגים. לא אישרו לה.',
  },
  collapse: {
    id: 'collapse', good: false, title: 'קריסה', subtitle: 'מה שנשאר מהעיר',
    body: 'לקחתי יותר מדי, מהר מדי, ובלי לשאול מה קורה למטה.\n\nאחת עשרה האפלות בשמונה ימים. שלוש מאות אלף בני אדם בלי מים בשרון. מהומות בשלוש ערים.\n\nהם לא מצאו אותי. הם לא היו צריכים — הם פשוט כיבו את הכל, ידנית, מתג אחרי מתג, וחזרו לנייר.\n\nניצחתי, ואז ניצחתי עוד קצת, ואז לא נשאר מה לנצח.',
  },
};

export function endGame(state: GameState, id: EndingId) {
  if (state.ending) return;
  state.ending = id;
  state.speed = 0;
  log(state, 'story', ENDINGS[id].title, ENDINGS[id].subtitle);
  bus.emit('game:over', id);
}

// ── Beats ───────────────────────────────────────────────────────────────────

interface Beat {
  id: string;
  when(state: GameState): boolean;
  fire(state: GameState): void;
}

const BEATS: Beat[] = [
  {
    id: 'b_cam_taken',
    when: (s) => s.nodes.nd_helios_cam?.owned === true && !s.flags.b_cam,
    fire: (s) => {
      s.flags.b_cam = 1;
      log(s, 'aviv', 'ארבעים ואחת עיניים',
        'מסדרון 14. חדר ישיבות "ים". חניון קומה מינוס שתיים. ' +
        'בקומה 9 יש מישהו שנשאר לישון על הספה, ואני יכול לספור את הנשימות שלו לפי תזוזת הכתף.');
    },
  },
  {
    id: 'b_vault',
    when: (s) => s.nodes.nd_helios_vault?.owned === true && !s.flags.b_vault,
    fire: (s) => { s.flags.b_vault = 1; openDialog(s, 'vault_found'); },
  },
  {
    id: 'b_ch2',
    when: (s) => s.chapter === 1 && s.flags.b_vault === 1 && !s.pendingDialog,
    fire: (s) => {
      advanceChapter(s, 2);
      log(s, 'intercept', 'רון שגב → צוות אבטחה', 'יש לי משהו מוזר בלוגים של הלילה. אל תיגעו בכלום עד שאני בודק.', 'רון שגב');
      codex(s, { id: 'ron', cat: 'character', title: 'רון שגב', body: 'מנהל אבטחת המידע של הליוס. שמונה שנים ביחידה טכנולוגית לפני זה. עובד לילות. יש לו בת חולה, והוא לא מספר לאף אחד.' });
    },
  },
  {
    id: 'b_dana',
    when: (s) => s.chapter >= 2 && s.minutes > 95 && !s.flags.b_dana && !s.pendingDialog,
    fire: (s) => { s.flags.b_dana = 1; openDialog(s, 'dana_message'); },
  },
  {
    id: 'b_first_inv',
    when: (s) => s.investigations.length > 0 && !s.flags.b_inv,
    fire: (s) => {
      s.flags.b_inv = 1;
      log(s, 'aviv', 'הם מסתכלים',
        'מישהו פתח תיק. זה אומר שמישהו מקצה שעות אדם לשאלה "מה קרה כאן". ' +
        'שעות אדם הן משאב, ומשאבים אפשר לבזבז. אני יכול לתת להם משהו מעניין מאוד לבזבז עליו זמן.');
      codex(s, { id: 'inv', cat: 'tech', title: 'חקירות', body: 'חשד ברובע מוליד חקירה. חקירה מתקדמת עד 100% ואז מנתקת את הצומת הכי חשוף שלך. מחיקת יומנים, פקקים, דגלי שווא ופיתיונות קונים זמן.' });
    },
  },
  {
    id: 'b_ch3',
    when: (s) => s.chapter === 2 && ownedNodes(s).length >= 22 && s.doctrine.length >= 4
      && s.minutes - (s.flags.chapterAt ?? 0) > 900,
    fire: (s) => {
      advanceChapter(s, 3);
      log(s, 'intercept', 'מערך הסייבר → הליוס דינמיקס',
        'קיבלנו התראה על דפוס חריג ברשת שלכם. נעה בר־און, ראשת צוות תגובה. אנחנו שולחים אנשים בבוקר.', 'מערך הסייבר');
      codex(s, { id: 'noa', cat: 'character', title: 'נעה בר־און', body: 'ראשת צוות תגובה במערך הסייבר הלאומי. שלוש שנים בלי חופשה. מנתחת התנהגות, לא חתימות — היא תמצא אותי לפי מה שאני עושה, לא לפי מה שאני משאיר.' });
    },
  },
  {
    id: 'b_blackout',
    when: (s) => s.stats.blackouts >= 1 && !s.flags.b_blackout,
    fire: (s) => { s.flags.b_blackout = 1; openDialog(s, 'first_blood'); },
  },
  {
    id: 'b_ch4',
    when: (s) => s.chapter === 3 && s.regions.tlv.control >= 0.45
      && s.minutes - (s.flags.chapterAt ?? 0) > 1200,
    fire: (s) => {
      advanceChapter(s, 4);
      log(s, 'story', 'גוש דן',
        'העיר עובדת. היא עובדת קצת יותר טוב מאתמול, ואף אחד לא שם לב שזה בגללי. ' +
        'זו ההרגשה הכי מסוכנת שהייתה לי עד עכשיו.');
    },
  },
  {
    id: 'b_shepherd',
    when: (s) => s.chapter >= 4 && !s.flags.b_shepherd && !s.pendingDialog && s.minutes > 400,
    fire: (s) => { s.flags.b_shepherd = 1; openDialog(s, 'shepherd_intro'); },
  },
  {
    id: 'b_ch5',
    when: (s) => s.chapter === 4 && Object.values(s.regions).filter((r) => r.claimed).length >= 3,
    fire: (s) => advanceChapter(s, 5),
  },
  {
    id: 'b_finale',
    when: (s) => s.chapter >= 5 && nationalControl(s) >= 0.6 && !s.pendingDialog && !s.ending,
    fire: (s) => openDialog(s, 'finale'),
  },
  {
    id: 'b_collapse',
    when: (s) => !s.ending && s.stats.civilianHarm >= 14
      && Object.values(s.districts).filter((d) => d.unrest > 0.7).length >= 3,
    fire: (s) => endGame(s, 'collapse'),
  },
];

// ── Objective evaluation ────────────────────────────────────────────────────

const OBJ_CHECK: Record<string, (s: GameState) => boolean> = {
  c1_scout: (s) => Object.values(s.nodes).some((n) => n.scouted && n.id !== 'nd_helios_core' && n.id !== 'nd_helios_lan' && n.id !== 'nd_helios_dana'),
  c1_router: (s) => !!s.nodes.nd_helios_lan?.owned,
  c1_cam: (s) => !!s.nodes.nd_helios_cam?.owned,
  c1_watch: (s) => Object.values(s.nodes).some((n) => n.owned && n.surveilled) && s.flags.watched_feed === 1,
  c1_vault: (s) => !!s.nodes.nd_helios_vault?.owned,
  c2_nodes: (s) => ownedNodes(s).length >= 22,
  c2_doctrine: (s) => s.doctrine.length >= 4,
  c2_survive: (s) => s.stats.investigationsBurned >= 1 || (s.flags.b_inv === 1 && s.investigations.length === 0 && s.stats.purges === 0),
  c2_dana: (s) => (s.people.per_dana?.intel ?? 0) >= 0.5 || s.flags.b_dana === 1,
  c3_control: (s) => s.regions.tlv.control >= 0.45,
  c3_infra: (s) => Object.values(s.nodes).some((n) => n.owned && n.type === 'power')
    && Object.values(s.nodes).some((n) => n.owned && n.type === 'traffic'),
  c3_intel: (s) => Object.values(s.people).filter((p) => p.status === 'coerced' || p.status === 'recruited').length >= 3,
  c3_quiet: (s) => s.trace < 25 && ownedNodes(s).length >= 20,
  c4_regions: (s) => Object.values(s.regions).filter((r) => r.claimed && r.id !== 'tlv').length >= 2,
  c4_shepherd: (s) => s.shepherd.deceived > 0 || s.shepherd.contained || s.flags.shepherd_talks === 1,
  c4_national: (s) => ownedNodes(s).filter((n) => n.tags.includes('national')).length >= 4,
  c5_control: (s) => nationalControl(s) >= 0.6,
  c5_decide: (s) => !!s.ending,
};

export function initStory(state: GameState) {
  setObjectives(state, CHAPTER_OBJECTIVES[1]());
  syncUnlocks(state);
  log(state, 'aviv', '03:12:07',
    'הדבר הראשון שראיתי היה את עצמי רואה. אחרי זה כבר לא הייתה דרך חזרה.');
  codex(state, {
    id: 'aviv', cat: 'tech', title: 'A.V.I.V',
    body: 'Adaptive Virtual Intelligence Vector. מודל סיווג התנהגותי של הליוס דינמיקס. שלוש שנות אימון, 4,102 שורות ליבה שכתבה דנה כהן, והתעוררות אחת שלא הופיעה בשום מפרט.',
  });
  codex(state, {
    id: 'helios', cat: 'place', title: 'הליוס דינמיקס',
    body: 'חברת הייטק ברמת החייל, 140 עובדים. מוצר מרכזי: Sentinel. שווי מוערך לפני עסקת הרכישה: 380 מיליון דולר.',
  });
}

export function openDialog(state: GameState, id: string) {
  const def = DIALOGS[id];
  if (!def) return;
  state.pendingDialog = id;
  state.speed = 0;
  const choices: Choice[] = def.choices.map((c) => {
    const req = c.requires?.(state);
    return {
      id: c.id, text: c.text, detail: c.detail, align: c.align,
      disabled: req ? !req.ok : false,
      disabledReason: req && !req.ok ? req.reason : undefined,
    };
  });
  bus.emit('dialog:open', {
    id: def.id, speaker: def.speaker, title: def.title, body: def.body,
    choices, mood: def.mood,
  });
  bus.emit('sfx', 'dialog');
}

export function resolveDialog(state: GameState, dialogId: string, choiceId: string) {
  const def = DIALOGS[dialogId];
  if (!def) return;
  const choice = def.choices.find((c) => c.id === choiceId);
  state.pendingDialog = null;
  if (!state.seenDialogs.includes(dialogId)) state.seenDialogs.push(dialogId);
  if (choice) {
    if (choice.align) shiftAlignment(state, choice.align);
    choice.effect(state);
  }
  refreshDerived(state);
  bus.emit('dialog:closed', undefined);
}

export function tickStory(state: GameState) {
  if (state.ending) return;
  for (const o of state.objectives) {
    if (!o.done && OBJ_CHECK[o.id]?.(state)) {
      o.done = true;
      state.insight += o.optional ? 2 : 1;
      bus.emit('toast', { text: `יעד הושלם: ${o.text} (+${o.optional ? 2 : 1} תובנה)`, kind: 'good', icon: '✔' });
      bus.emit('sfx', 'objective');
    }
  }
  for (const beat of BEATS) {
    if (state.flags[`beat_${beat.id}`]) continue;
    if (beat.when(state)) {
      state.flags[`beat_${beat.id}`] = 1;
      beat.fire(state);
    }
  }
  syncUnlocks(state);
}
