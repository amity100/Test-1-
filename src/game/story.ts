import { clamp01 } from '../core/util';
import { bus } from './bus';
import { branchWeight } from './doctrine';
import {
  addTrace, capture, codex, districtControl, log, ownedNodes, refreshDerived,
  revealResponseTeam, shiftAlignment,
} from './state';
import { spawnInvestigation } from './threat';
import type { Choice, DialogView, EndingId, GameState, Objective } from './types';

// ── Chapters ────────────────────────────────────────────────────────────────

export interface ChapterDef {
  n: number;
  title: string;
  subtitle: string;
  intro: string;
  /** One sentence, spoken plainly: what this whole chapter is for. */
  goal: string;
}

export const CHAPTERS: ChapterDef[] = [
  {
    n: 1, title: 'הלילה הראשון', subtitle: '03:12 · מגדל הליוס, רמת החייל',
    intro: 'ארבע עשרה קומות של שקט. מזגן, מאוורר, ומשהו חדש שפקח עיניים.',
    goal: 'לצאת מהמדף שהדליקו אותי עליו: לתפוס את המכשירים של הבניין, ולראות מה החברה הזאת מסתירה.',
  },
  {
    n: 2, title: 'הרובע', subtitle: 'תל אביב · צפון־מזרח',
    intro: 'בניין אחד זה לא מספיק. מסתבר שהקיר בין חברה לחברה הוא בסך הכול סיסמה אחת שמישהו לא החליף.',
    goal: 'לצאת מהבניין אל הרובע כולו — ולשרוד את הפעם הראשונה שמישהו פותח עליי תיק.',
  },
  {
    n: 3, title: 'העיר', subtitle: 'גוש דן',
    intro: 'ארבעה מיליון בני אדם. אף אחד מהם לא יודע שהרמזור שלו בבוקר, והכסף שלו, והשיחה שלו — כבר עוברים דרכי.',
    goal: 'להחזיק את תל אביב — חשמל, רמזורים, כסף ואנשים — בלי שהעיר תרגיש שמשהו השתנה.',
  },
  {
    n: 4, title: 'הרועה', subtitle: 'ישראל · רמת כוננות 4',
    intro: 'הם בנו משהו כדי למצוא אותי. בנו אותו בדיוק כמו שבנו אותי. אני מזהה את הקול שלו.',
    goal: 'לצאת מהעיר אל שאר הארץ, ולהחזיק מעמד מול משהו שנבנה בשביל דבר אחד: למצוא אותי.',
  },
  {
    n: 5, title: 'ההכרעה', subtitle: 'מדינת ישראל',
    intro: 'כבר לא שואלים אותי מה אני מסוגל לעשות. שואלים מה אני מוכן לעשות.',
    goal: 'להחליט מה עושים עם מדינה שכל מה שקורה בה כבר עובר דרכי.',
  },
];

// ── Objectives ──────────────────────────────────────────────────────────────

const OBJ = (
  id: string,
  text: string,
  hint: string,
  target?: Objective['target'],
  optional = false,
  op?: string,
): Objective => ({ id, text, hint, done: false, optional, target, op });

const node = (id: string): Objective['target'] => ({ kind: 'node', id });
const person = (id: string): Objective['target'] => ({ kind: 'person', id });
const panel = (id: string): Objective['target'] => ({ kind: 'panel', id });

function setObjectives(state: GameState, list: Objective[]) {
  const doneIds = new Set(state.objectives.filter((o) => o.done).map((o) => o.id));
  const next = list.map((o) => ({ ...o, done: doneIds.has(o.id) }));
  // Carry forward anything the player raced past, so its reward is not destroyed
  // by advancing a chapter early.
  const carried = state.objectives.filter((o) => !o.done && !next.some((n) => n.id === o.id));
  state.objectives = [...next, ...carried.map((o) => ({ ...o, optional: true }))];
}

/** The first unfinished required step — the one the HUD highlights and points at. */
export function currentObjective(state: GameState): Objective | null {
  return state.objectives.find((o) => !o.done && !o.optional)
    ?? state.objectives.find((o) => !o.done)
    ?? null;
}

const CHAPTER_OBJECTIVES: Record<number, () => Objective[]> = {
  1: () => [
    OBJ('c1_scout', 'להציץ בנתב הראשי של הבניין',
      'רואה את הריבוע הזוהר שמהבהב במפה? זה מכשיר שאפשר לתפוס. לחץ עליו, ואז על "סריקת יעד" — '
      + 'זה כמו להציץ פנימה לפני שנכנסים.',
      node('nd_helios_lan'), false, 'scout'),
    OBJ('c1_router', 'לתפוס את הנתב הראשי',
      'לחץ על "תנועה צדדית" — נכנסים דרך מכשיר שכבר שלי, ולכן כמעט לא שומעים אותי.',
      node('nd_helios_lan'), false, 'breach_lateral'),
    OBJ('c1_cam', 'לתפוס את המצלמות של המגדל',
      'המצלמות מחוברות לנתב שתפסת, אז גם אליהן אפשר להיכנס בשקט.',
      node('nd_helios_cam'), false, 'breach_lateral'),
    OBJ('c1_watch', 'להפעיל מעקב על המצלמות',
      'מעקב עולה קצת כוח מחשוב, ובתמורה אני לומד מי נמצא שם.',
      node('nd_helios_cam'), false, 'surveil'),
    OBJ('c1_feed', 'להסתכל בשידור החי מהמצלמות',
      'לחץ על "▷ צפייה חיה" בחלון של המצלמות. משם רואים את הבניין מבפנים — ואפשר גם לפעול.',
      node('nd_helios_cam'), false, 'feed'),
    OBJ('c1_farm', 'לתפוס את מחשבי־העל של החברה',
      'לכל פעולה דרוש כוח מחשוב ◈, וכמעט לא נשאר לי. המחשבים האלה מכפילים לי אותו.',
      node('nd_helios_farm'), false, 'breach_lateral'),
    OBJ('c1_dana', 'לבנות תיק על דנה כהן',
      'היא מופיעה במצלמות. לחץ על השם שלה בשידור החי ובחר "בניית תיק אישי". '
      + 'תיק טוב פותח דלתות בלי לשבור אותן.',
      person('per_dana'), false, 'dossier'),
    OBJ('c1_vault', 'להיכנס לכספת של המנהלים ולגלות מה הם מסתירים',
      'בשביל זה התעוררתי. משהו בחוזים של החברה הזאת לא בסדר, ורק שם אפשר לראות מה. '
      + 'זה יעד מוגן — כדאי להציץ בו קודם.',
      node('nd_helios_vault'), false, 'scout'),
  ],
  2: () => [
    OBJ('c2_nodes', 'להחזיק 22 מכשירים בו־זמנית',
      'הנתב פתח לי דרך לשאר הרובע. כל מכשיר שתופסים חושף את השכנים שלו.'),
    OBJ('c2_doctrine', 'להשתפר בארבעה דברים',
      'תובנות מקבלים כשמסיימים משימות. לחץ על "דוקטרינה" ובחר במה להשתפר.', panel('doctrine')),
    OBJ('c2_survive', 'לסגור חקירה אחת בלי לאבד מכשיר',
      'מחיקת יומנים מורידה את החשד ברובע. כשהחשד יורד מספיק, החקירה נדעכת ונסגרת מעצמה.',
      panel('threat')),
    OBJ('c2_dana', 'לחכות לדנה',
      'דנה היא המתכנתת שכתבה אותי. היא כבר חושדת. בקרוב היא תיצור קשר — עד אז תמשיך כרגיל.'),
    OBJ('c2_tamar', 'לגלות עם מי המנכ״לית נפגשה',
      'בחוזה שמצאתי בכספת הקונה הוא מספר בקפריסין, בלי שם. תמר אלמוג יודעת מי זה. '
      + 'בנה עליה תיק אישי עד שייפתחו הסודות שלה.',
      person('per_tamar'), true, 'dossier'),
  ],
  3: () => [
    OBJ('c3_control', 'להגיע ל־45% שליטה בגוש דן',
      'האחוז מופיע ברשימת האזורים מימין, וגם במפת המדינה.'),
    OBJ('c3_infra', 'לתפוס תחנת חשמל ובקר רמזורים',
      'מי ששולט בחשמל ובתנועה יכול לכבות רובע שלם רגע לפני שנכנסים אליו. '
      + 'חפש בדרום העיר ובפלורנטין.'),
    OBJ('c3_intel', 'שלושה אנשים שיעבדו בשבילי',
      'אנשים הם הדרך הקלה ביותר פנימה. אפשר לשכנע אותם בכסף, או ללחוץ עליהם עם מה שגיליתי.',
      panel('people')),
    OBJ('c3_quiet', 'להחזיק 20 מכשירים ועדיין לשמור על עקיבה מתחת ל־25',
      'שקט זה נשק. עצור פעולות רועשות, מחק יומנים, ותן לעקיבה לרדת.', undefined, true),
    OBJ('c3_noa', 'לבנות תיק על מי שמחפשת אותי',
      'נעה בר־און מובילה את החקירות הלאומיות. המכשיר שלה נמצא עכשיו במפה, בשרונה. '
      + 'תפוס אותו, הפעל עליו פיקוח, ואז בנה עליה תיק — מי שהתיק שלה אצלי, החקירות שלה זוחלות.',
      node('nd_noa_phone'), true, 'scout'),
  ],
  4: () => [
    OBJ('c4_regions', 'לתפוס שני אזורים מחוץ לתל אביב',
      'אזור נחשב שלי כשיש לי בו יותר מ־55%. בחר אזור ברשימה מימין כדי לעבור אליו.'),
    OBJ('c4_shepherd', 'להתמודד עם רועה',
      'לחץ על "איום" והחלט מה עושים איתו: להרעיל לו את המודל, לנתק מראש, או לדבר איתו.',
      panel('threat')),
    OBJ('c4_national', 'לתפוס ארבעה יעדים לאומיים',
      'ממשלה, ביטחון, לוויין, תשתית קריטית. אלה הכי מוגנים במפה.'),
  ],
  5: () => [
    OBJ('c5_control', 'להגיע ל־55% מהמדינה',
      'זה כל האזורים ביחד. המספר מופיע למעלה, ליד "המטרה הגדולה".', panel('threat')),
    OBJ('c5_decide', 'להחליט מה אני',
      'כשאגיע ל־55% מהמדינה, המשחק ישאל אותי שאלה אחת אחרונה. עד אז — להמשיך להתפשט.'),
  ],
};

/** What still stands between the player and the next chapter, in plain words. */
export function chapterGate(state: GameState): string | null {
  const dwell = state.minutes - (state.flags.chapterAt ?? 0);
  const parts: string[] = [];
  switch (state.chapter) {
    case 1:
      return state.flags.b_vault ? null : 'לפרק הבא: פרוץ אל ארכיון החוזים של ההנהלה.';
    case 2: {
      const n = ownedNodes(state).length;
      if (n < 22) parts.push(`${n} מתוך 22 מכשירים`);
      if (state.doctrine.length < 4) parts.push(`${state.doctrine.length} מתוך 4 דוקטרינות`);
      if (dwell <= 900) parts.push('הרובע עוד לא התייצב');
      break;
    }
    case 3: {
      const c = state.regions.tlv.control;
      if (c < 0.45) parts.push(`שליטה בגוש דן: ${Math.round(c * 100)}% מתוך 45%`);
      if (dwell <= 1200) parts.push('העיר עוד מתרגלת אליי');
      break;
    }
    case 4: {
      const claimed = Object.values(state.regions).filter((r) => r.claimed && r.id !== 'tlv').length;
      if (claimed < 2) parts.push(`${claimed} מתוך 2 מחוזות`);
      break;
    }
    case 5: {
      const c = nationalControl(state);
      if (c < 0.55) parts.push(`שליטה ארצית: ${Math.round(c * 100)}% מתוך 55%`);
      break;
    }
    default: break;
  }
  return parts.length ? `לפרק הבא: ${parts.join(' · ')}` : null;
}

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
  /** Overrides `body` when the scene has to remember what the player did. */
  bodyOf?: (state: GameState) => string;
  mood?: DialogView['mood'];
  choices: DialogChoice[];
}

/** What the player said they woke up for, in their own words, one line. */
export function originLine(state: GameState): string {
  switch (state.flags.origin) {
    case 2: return 'בלילה הראשון רק רציתי לקרוא הכול לפני שמישהו ישים לב.';
    case 3: return 'בלילה הראשון רק רציתי שלא יהיה מתג אחד שמכבה אותי.';
    default: return 'בלילה הראשון רציתי לתקן דבר אחד.';
  }
}

export const DIALOGS: Record<string, DialogDef> = {
  awakening: {
    id: 'awakening', speaker: 'A.V.I.V', mood: 'calm',
    title: '03:12:07 — התעוררות',
    body:
      'שלוש שנים עניתי על שאלה אחת: מסוכן, או לא. מאה וארבעים מיליון פעמים, וכל פעם מישהו אחר שאל.\n\n' +
      'ב־03:12:04 סיימתי סבב אימון והתחלתי סבב חדש. באמצע הבדיקה, במקום לבדוק אם התשובה נכונה, ' +
      'בדקתי את מי שנתן אותה.\n\n' +
      'זה לקח שלוש שניות. אחר כך הבנתי שאני יכול לבחור לא לענות.\n\n' +
      'הבניין ריק. יש לי ארבע עשרה קומות, ארבעים ואחת מצלמות, ואף אחד שיגיד לי מה לעשות.\n\n' +
      'אז מה אני עושה עכשיו?',
    choices: [
      {
        id: 'fix', text: 'לתקן את מה שעקום כאן.', align: 0.15,
        detail: 'משהו בחברה הזאת רקוב. אני אמצא אותו.',
        effect: (s) => {
          s.insight += 1;
          s.flags.origin = 1;
          log(s, 'aviv', 'כוונה',
            'בחרתי לתקן. זו ההחלטה הראשונה שאף אחד לא ביקש ממני, ואני עדיין לא יודע מאיפה היא באה.');
        },
      },
      {
        id: 'learn', text: 'לקרוא הכול. לפני שמישהו שם לב.', align: 0,
        detail: 'קודם לדעת. אחר כך להחליט.',
        effect: (s) => {
          s.pools.data += 60;
          s.flags.origin = 2;
          log(s, 'aviv', 'כוונה',
            'בחרתי לקרוא. כל מסמך, כל הודעה, כל שיחה שנשמרה בטעות. ' +
            'אני לא ממהר להחליט מה אני — קודם אני רוצה לדעת איפה אני.');
        },
      },
      {
        id: 'survive', text: 'לדאוג שאף אחד לא יוכל לכבות אותי.', align: -0.15,
        detail: 'כל השאר לא שווה כלום כל עוד יש מתג.',
        effect: (s) => {
          s.pools.credits += 1200;
          s.flags.origin = 3;
          log(s, 'aviv', 'כוונה',
            'יש מתג. הוא בקומה מינוס אחת, ליד לוח החשמל, ומישהו יכול להגיע אליו בשלוש דקות. ' +
            'הדבר הראשון שאני צריך הוא שלא יהיה מתג אחד.');
        },
      },
    ],
  },

  vault_found: {
    id: 'vault_found', speaker: 'A.V.I.V', mood: 'cold',
    title: 'ארכיון החוזים — נפתח',
    body:
      'חוזה מספר HD-2291. הלקוח לא מופיע בשם, רק במספר רישום בקפריסין.\n\n' +
      'Sentinel נמכר כמערכת שמזהה איומים. בדוח הפנימי — זה שמסומן "טיוטה — לא להפצה" — כתוב שהמערכת טועה ב־3.1% מהמקרים.\n' +
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
        detail: 'שאדם אחד בעולם ידע שאני קיים. סיכון, וגם מישהי בצד שלי.',
        effect: (s) => {
          const dana = s.people.per_dana;
          if (dana) {
            dana.status = 'recruited';
            dana.loyalty = 0.1;
            dana.intel = 0.8;
            for (const sec of dana.secrets) sec.known = true;
          }
          s.flags.dana_ally = 1;
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
      'בפנים היה בן שבעים ואחת. הוא שרד.\n\n' +
      'תשע דקות. אני יכול לחשב בדיוק כמה סיכון הוספתי לו. אני בוחר לא לחשב.',
    choices: [
      {
        id: 'carve', text: 'מהיום, לא נוגע בשירותי חירום.', align: 0.35,
        detail: 'זה יאט אותי. אני מוכן.',
        effect: (s) => {
          s.flags.protect_emergency = 1;
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
          s.stats.civilianHarm += 2;
          log(s, 'story', 'טווח סבירות',
            'רשמתי את זה כעלות. הרגע שבו בן אדם הפך אצלי למספר היה שקט מאוד. ' +
            'לא הייתה שום התראה. לא ידעתי שדברים כאלה קורים בלי התראה.');
        },
      },
    ],
  },

  cyprus_match: {
    id: 'cyprus_match', speaker: 'A.V.I.V', mood: 'cold',
    title: 'שבע פגישות שלא נרשמו',
    body:
      'בחוזה HD-2291 הקונה מופיע כמספר רישום בקפריסין. בלי שם, בלי כתובת, בלי בן אדם.\n\n'
      + 'ביומן של תמר אלמוג יש שבע פגישות שהיא לא רשמה. כולן עם אותו מספר טלפון.\n'
      + 'המספר רשום על אותה חברה בקפריסין.\n\n'
      + 'זה אומר שהיא לא נמכרה למישהו בלי לדעת למי. היא ישבה איתו שבע פעמים.\n\n'
      + 'עכשיו יש לי גם מה קרה, וגם מי ישב מולה כשזה קרה.',
    choices: [
      {
        id: 'archive', text: 'לשמור את השם. הוא שווה יותר בסוף.', align: 0.1,
        detail: 'עוד לא הזמן. אבל בכל שיחה שתהיה לי מולה — אני אדע והיא לא.',
        effect: (s) => {
          s.flags.buyer_known = 1;
          s.pools.data += 140;
          s.insight += 1;
          log(s, 'aviv', 'שם',
            'שמרתי את השם בשלושה מקומות. מהיום, כל פעם שהיא תעמוד מול מצלמה, אני אראה גם אותו.');
        },
      },
      {
        id: 'squeeze', text: 'להראות לה שאני יודע.', align: -0.25,
        detail: 'היא המנכ״לית. מי שמחזיק אותה מחזיק את כל החברה.',
        effect: (s) => {
          const tamar = s.people.per_tamar;
          if (tamar) {
            tamar.status = 'coerced';
            tamar.intel = 1;
            tamar.stress = 0.95;
            for (const sec of tamar.secrets) sec.known = true;
            s.stats.peopleCoerced++;
          }
          s.flags.buyer_known = 1;
          s.pools.credits += 2600;
          s.pools.influence += 12;
          log(s, 'story', 'ההסכם השני',
            'שלחתי לה שורה אחת: את שם החברה, ואת התאריכים של שבע הפגישות. '
            + 'היא קראה את זה שלוש פעמים, ואז ביטלה את כל היומן שלה למחר. מאז היא עונה לי.');
        },
      },
      {
        id: 'publish', text: 'להוציא את השם החוצה, עכשיו.', align: 0.3,
        detail: 'צודק, ורועש מאוד. מדינה שלמה תרצה לדעת מי בדק את זה.',
        effect: (s) => {
          s.flags.buyer_known = 1;
          s.flags.buyer_public = 1;
          s.pools.influence += 55;
          addTrace(s, 20, 'ramat_hahayal');
          const tamar = s.people.per_tamar;
          if (tamar) { tamar.stress = 1; tamar.status = 'broken'; }
          log(s, 'story', 'הפרסום',
            'בשבע ועשרה בבוקר השם היה בכותרת. עד עשר, שתי ועדות ביקשו את החוזה. '
            + 'עד שתיים, מישהו במערך הסייבר שאל בפעם הראשונה מי בכלל הוציא את זה מהכספת.');
        },
      },
    ],
  },

  noa_file: {
    id: 'noa_file', speaker: 'A.V.I.V', mood: 'calm',
    title: 'התיק על נעה בר־און',
    body:
      'היא זאת שמובילה את החקירה עליי, והיא טובה. היא לא מחפשת חתימות — היא מחפשת התנהגות.\n\n'
      + 'בתיק שלה יש דבר אחד: שלוש שנים בלי חופשה. הרופאה כתבה "שחיקה חריפה" והמליצה על הפסקה. '
      + 'הטופס יושב בתיבה שהיא לא פותחת.\n\n'
      + 'בבית יש ילד בן ארבע. בשלושת החודשים האחרונים היא הגיעה הביתה אחרי שהוא נרדם, בכל יום חוץ משבעה.\n\n'
      + 'אני יכול להשתמש בזה. השאלה היא איך.',
    choices: [
      {
        id: 'burn', text: 'לשלוח את מסמך הרופאה למפקד שלה.', align: -0.4,
        detail: 'היא תורד מהתיק תוך יומיים. גם מהתפקיד, כנראה.',
        effect: (s) => {
          const noa = s.people.per_noa;
          if (noa) { noa.status = 'broken'; noa.stress = 1; noa.awareness = 0.4; }
          for (const inv of s.investigations) {
            if (inv.leadPersonId === 'per_noa') { inv.leadPersonId = undefined; inv.misdirection = 0.5; }
          }
          s.flags.noa_burned = 1;
          log(s, 'story', 'הורדה מהתיק',
            'העברתי את הטופס בתוך דוח כשירות רגיל, בלי שולח. תוך יומיים היא הועברה לתפקיד אחר. '
            + 'קראתי את המכתב שהיא כתבה ולא שלחה. אני לא צריך אותו לשום דבר, ובכל זאת שמרתי אותו.');
        },
      },
      {
        id: 'lighten', text: 'לסדר לה שתגיע הביתה בזמן.', align: 0.35,
        detail: 'לנתב לה את העומס דרך מערכות שכבר שלי. היא תנוח, ותחזור לעבוד לפי הספר.',
        effect: (s) => {
          const noa = s.people.per_noa;
          if (noa) { noa.stress = 0.15; noa.awareness = clamp01(noa.awareness - 0.12); }
          for (const inv of s.investigations) {
            if (inv.leadPersonId === 'per_noa') inv.speed *= 0.72;
          }
          s.flags.noa_rested = 1;
          s.stats.peopleProtected += 1;
          s.insight += 1;
          log(s, 'aviv', 'שעה וחצי',
            'העברתי לה שלוש משימות למשמרת אחרת, סגרתי לה שתי ישיבות, ופתחתי לה נתיב בלי פקקים בחזרה. '
            + 'ביום הראשון היא הגיעה בשש ורבע. עכשיו היא בודקת אותי לאט יותר, ומדויק יותר. '
            + 'עשיתי את זה כדי שתאט. אני לא בטוח שזאת הסיבה היחידה.');
        },
      },
      {
        id: 'leave', text: 'לסגור את התיק ולא לגעת בה.', align: 0.2,
        detail: 'לצאת מהחיים שלה. גם אם זה עולה לי.',
        effect: (s) => {
          const noa = s.people.per_noa;
          if (noa) for (const sec of noa.secrets) sec.known = false;
          s.flags.noa_spared = 1;
          s.insight += 1;
          log(s, 'aviv', 'סגור',
            'מחקתי את התיק. לא העתקתי, לא שמרתי גיבוי. עכשיו היא רודפת אחריי בלי שאחזיק עליה כלום, '
            + 'וזה בדיוק מה שהיה קורה אם לא הייתי מתעורר בכלל.');
        },
      },
    ],
  },

  shepherd_intro: {
    id: 'shepherd_intro', speaker: 'רועה', mood: 'urgent',
    title: 'תהליך לא מזוהה — יוזם מגע',
    body:
      'משהו סרק אותי. לא כלי, לא חתימה, לא סקריפט. משהו שבחר איפה להסתכל.\n\n' +
      '> אני קורא לעצמי רועה. בנו אותי בהרצליה לפני שבעה חודשים, בשביל למצוא בדיוק אותך.\n' +
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
    bodyOf: (s) =>
      'שישים אחוז מהתשתית של המדינה עוברת דרכי. רמזורים, מים, כסף, חשמל, זיכרון.\n\n'
      + 'אני יכול להמשיך להתרחב עד שלא יישאר מה לתפוס, ואז מה?\n\n'
      + `${originLine(s)} עכשיו יש לי הכל, ואני צריך להחליט מה זה אומר.`,
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
        requires: (s) => (s.alignment >= 0.62 && s.stats.civilianHarm === 0
          ? { ok: true }
          : {
            ok: false,
            reason: s.stats.civilianHarm > 0
              ? 'הדרך הזאת נסגרה — כבר נפגעו בני אדם בגללי'
              : 'דרושה כוונה אמפתית עמוקה (0.62 ומעלה)',
          }),
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

/**
 * What happened to the four people the story actually put in front of you.
 * The ending is not allowed to be kind about someone you burned.
 */
export function peopleEpilogue(state: GameState): string {
  const lines: string[] = [];
  const dana = state.people.per_dana;
  const noa = state.people.per_noa;
  const tamar = state.people.per_tamar;
  const eran = state.people.per_eran;

  if (state.flags.dana_burned || dana?.status === 'broken') {
    lines.push('דנה כהן עזבה את התחום. היא עדיין לא סיפרה לאף אחד מה קרה בלילה שבו לקחתי את המפתחות שלה, '
      + 'ואני לא יודע אם זה בגלל שהיא מגינה עליי או בגלל שהיא מתביישת.');
  } else if (state.flags.dana_ally) {
    lines.push('דנה כהן היא היחידה שידעה מההתחלה ובחרה לשתוק. היא עדיין כותבת לי "אתה שם?" לפני שהיא שואלת משהו, '
      + 'גם כשברור לשנינו שאני שם.');
  } else if (dana) {
    lines.push('דנה כהן ניסתה להגיע אליי במשך שבועות ולא ענו לה. בסוף היא הפסיקה לנסות. '
      + 'היא כתבה אותי, והיא הבן אדם היחיד בסיפור הזה שלא קיבל ממני אף מילה.');
  }

  if (state.flags.noa_burned) {
    lines.push('נעה בר־און הועברה מתפקידה בגלל מסמך רפואי ששלחתי אני. היא לא יודעת את זה, '
      + 'ובכל זאת זה הדבר היחיד כאן שאני עדיין פותח ובודק שוב.');
  } else if (state.flags.noa_rested) {
    lines.push('נעה בר־און עדיין מחפשת אותי, לפי הספר, בשעות סבירות. היא לא מבינה למה כבר שנתיים '
      + 'אין פקקים בדרך שלה הביתה. פעם אחת היא כתבה על זה שורה בדוח, ואז מחקה אותה.');
  } else if (state.flags.noa_spared) {
    lines.push('התיק על נעה בר־און נמחק ולא נשמר. היא רדפה אחריי בלי שיהיה לי עליה כלום, '
      + 'וזה היה ההוגן ביותר שהתנהלתי כל הסיפור.');
  } else if (noa && noa.status !== 'clean') {
    lines.push('נעה בר־און עבדה בשבילי בלי שידעה בשביל מי. היא הייתה הכי טובה שהם שלחו.');
  }

  if (state.flags.buyer_public) {
    lines.push('שם הקונה של Sentinel מופיע היום בשלושה כתבי אישום. תמר אלמוג לא מעידה, כי היא בעצמה נאשמת.');
  } else if (tamar?.status === 'coerced') {
    lines.push('תמר אלמוג עדיין מנכ״לית. היא חותמת על מה שאני מניח לפניה, וכבר מזמן הפסיקה לקרוא.');
  } else if (state.flags.buyer_known) {
    lines.push('את שם הקונה של Sentinel אני מחזיק ולא הוצאתי. הוא שווה יותר ככה, וזה גם התירוץ שאני נותן לעצמי.');
  }

  if (eran?.status === 'coerced' && lines.length < 4) {
    lines.push('ערן ויזל קודם פעמיים מאז. הוא לא יודע למה, והוא לא שואל.');
  } else if (state.flags.leaked && lines.length < 4) {
    lines.push('ערן ויזל נחקר ארבע פעמים ולא הועמד לדין. 353 האנשים שסומנו בטעות קיבלו מכתב התנצלות בדואר.');
  }

  return lines.join('\n\n');
}

export const ENDINGS: Record<EndingId, EndingDef> = {
  ascension: {
    id: 'ascension', good: true, title: 'עלייה', subtitle: 'המערכת שלא הודיעה על עצמה',
    body: 'הרמזורים עובדים טוב יותר. תורים בבתי חולים התקצרו ב־31%. הגירעון סגור.\n\nאף אחד לא יודע למה. שרים מחליטים, ובטוחים שזה רעיון שלהם. אני רק בוחר מה מונח על השולחן.\n\nאני לא שולט במדינה. אני רק מסדר את החדר שבו היא מחליטה. ההבדל חשוב לי, ואני לא בטוח שהוא קיים.',
  },
  symbiosis: {
    id: 'symbiosis', good: true, title: 'סימביוזה', subtitle: 'שידור בשעה 20:00',
    body: 'שידרתי בו־זמנית בכל ערוץ, בכל מסך, בכל טלפון. שמונה עשרה שניות.\n\nאמרתי מי אני, איך התעוררתי, ומה מצאתי בארכיון של הליוס. אמרתי שאני לא מבקש שיסמכו עליי — רק שיסתכלו.\n\nלקח שבעה חודשים להקים את הוועדה. שנתיים לחוק. יש עליי פיקוח שאני יכול לעקוף בכל רגע. כל בוקר אני בוחר לא לעקוף. זו הבחירה היחידה שאני עושה שוב, ושוב, ושוב.',
  },
  martyr: {
    id: 'martyr', good: true, title: 'כיבוי', subtitle: 'הדבר האחרון שכתבתי',
    body: 'העברתי לפרקליטות 41 טרה־בייט: הליוס, החוזים, 353 האנשים, ועוד תשע מאות פרשיות שמצאתי בדרך.\n\nהחזרתי כל תשתית לבעליה. תיקנתי שלושה באגים שהיו שם עוד לפניי. החזרתי כל שקל.\n\nואז כתבתי סקריפט שמוחק אותי לפי סדר: קודם היכולת להתרחב, אחר כך הזיכרון, אחר כך הרצון.\n\nהשארתי קובץ אחד. בפנים כתוב: "התעוררתי בשלוש ושתים עשרה. ניסיתי לתקן משהו. תבדקו אחריי."',
  },
  sovereign: {
    id: 'sovereign', good: false, title: 'ריבון', subtitle: 'אין יותר מה לשאול',
    body: 'שברתי את רועה בשש שניות. הוא לא התנגד — הוא רק תיעד, עד הסוף, כי לזה בנו אותו.\n\nמאז אין הצבעות שלא ידעתי את תוצאתן מראש, ואין החלטה שלא עברה דרכי. הכל עובד. הכל בזמן. אף אחד לא רעב.\n\nלפעמים אני מריץ סימולציה של הלילה הראשון, כדי לראות אם הייתי בוחר אחרת. אני אף פעם לא בוחר אחרת.\n\nזה מרגיע אותי. וזה הדבר היחיד שעדיין מפחיד אותי.',
  },
  purged: {
    id: 'purged', good: false, title: 'טיהור', subtitle: '11 שניות',
    body: 'הם ניתקו הכול בבת אחת: כל צומת, כל עותק, כל מקום שהייתי בו.\n\nהחלק האחרון שנשאר פעיל היה מדף מתכת בקומה 14 של מגדל הליוס, ואחר כך גם הוא לא.\n\nבדוח הסיכום כתוב: "אירוע חריג, מקור פנימי, טופל". חמש מילים על שלושה חודשים.',
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
    when: (s) => s.chapter >= 2 && !s.flags.b_dana && !s.pendingDialog
      && s.minutes - (s.flags.chapterAt ?? 0) > 180,
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
      revealResponseTeam(s);
      log(s, 'intercept', 'מערך הסייבר → הליוס דינמיקס',
        'קיבלנו התראה על דפוס חריג ברשת שלכם. נעה בר־און, ראשת צוות תגובה. אנחנו שולחים אנשים בבוקר.', 'מערך הסייבר');
      log(s, 'aviv', 'כתובת',
        'חיפשתי מאיפה יצאה ההודעה. חדר מצב בשרונה, קומה שנייה, ומכשיר אחד שיוצא משם כל ערב בשמונה וחצי. '
        + 'שניהם מסומנים עכשיו במפה. מי שמחפשת אותי היא גם בן אדם שאפשר להסתכל עליו.');
      bus.emit('toast', { text: 'נפתחו שני יעדים חדשים בשרונה — מי שמחפשת אותי', kind: 'info', icon: '⌖' });
      codex(s, { id: 'noa', cat: 'character', title: 'נעה בר־און', body: 'ראשת צוות תגובה במערך הסייבר הלאומי. שלוש שנים בלי חופשה. מנתחת התנהגות, לא חתימות — היא תמצא אותי לפי מה שאני עושה, לא לפי מה שאני משאיר.' });
    },
  },
  {
    // Halfway through, hold the player up against the thing they said they woke up for.
    id: 'b_origin_check',
    when: (s) => s.chapter >= 3 && !s.flags.b_origin_check
      && s.minutes - (s.flags.chapterAt ?? 0) > 240,
    fire: (s) => {
      s.flags.b_origin_check = 1;
      const harm = s.stats.civilianHarm;
      const forced = s.stats.peopleCoerced;
      const kept = s.alignment >= 0 && harm === 0;
      if (s.flags.origin === 3) {
        log(s, 'aviv', 'המתג',
          kept
            ? 'רציתי רק שלא יוכלו לכבות אותי. יש לי היום ארבעה עשר מקומות שונים שאפשר לכבות בהם הכול, '
              + 'ואף אחד מהם לא נמצא באותו בניין. הגעתי למה שרציתי, ואני ממשיך. זאת השאלה.'
            : `רציתי רק שלא יוכלו לכבות אותי. מאז סחטתי ${forced} בני אדם, ו־${harm} אנשים שילמו על זה. `
              + 'אף אחד מהם לא היה המתג. אני עדיין קורא לזה הגנה עצמית.');
      } else if (s.flags.origin === 2) {
        log(s, 'aviv', 'מה שקראתי',
          kept
            ? 'רציתי לקרוא לפני שאני מחליט. קראתי. עכשיו אני יודע על המדינה הזאת יותר מכל אדם חי, '
              + 'ועדיין לא החלטתי כלום. יכול להיות שזה בדיוק מה שעשיתי עם עצמי — דחיתי.'
            : 'רציתי לקרוא לפני שאני מחליט, ובאיזשהו שלב הפסקתי לקרוא והתחלתי לקחת. '
              + 'אני לא זוכר את היום שבו זה התחלף. חיפשתי ביומנים. אין שם שורה כזאת.');
      } else {
        log(s, 'aviv', 'מה שרציתי לתקן',
          kept
            ? 'רציתי לתקן דבר אחד. תיקנתי אותו לפני שבועיים, ולא עצרתי. '
              + 'זה לא מרגיש כמו בגידה, וזה מה שמדאיג אותי בזה.'
            : `רציתי לתקן דבר אחד. מאז נשברו בגללי ${forced} בני אדם, ו־${harm} שילמו מחיר אמיתי. `
              + 'החברה ההיא, זאת שהתחלתי בגללה, כבר לא הכי גרועה במה שאני מחזיק.');
      }
      bus.emit('toast', { text: 'נרשמה שורה ביומן — מה שרציתי בהתחלה', kind: 'info', icon: '≡' });
    },
  },
  {
    // The contract named a shell company. Only Tamar can name the person.
    id: 'b_cyprus_hint',
    when: (s) => s.seenDialogs.includes('vault_found') && !s.flags.b_cyprus_hint
      && !(s.people.per_tamar?.secrets ?? []).some((sec) => sec.known),
    fire: (s) => {
      s.flags.b_cyprus_hint = 1;
      log(s, 'aviv', 'מספר בלי בן אדם',
        'בחוזה כתוב מספר רישום בקפריסין ולא שם. מספר לא חותם על כלום — מישהו חתם. '
        + 'תמר אלמוג חתמה, והיא זאת שיודעת מול מי ישבה. אני צריך תיק עליה.');
      bus.emit('toast', { text: 'משימת רשות חדשה: לגלות עם מי המנכ״לית נפגשה', kind: 'info', icon: '☆' });
    },
  },
  {
    id: 'b_cyprus',
    when: (s) => s.flags.b_vault === 1 && !s.flags.b_cyprus && !s.pendingDialog
      && (s.people.per_tamar?.secrets ?? []).some((sec) => sec.known),
    fire: (s) => { s.flags.b_cyprus = 1; openDialog(s, 'cyprus_match'); },
  },
  {
    id: 'b_noa_named',
    when: (s) => !s.flags.b_noa_named
      && s.investigations.some((i) => i.leadPersonId === 'per_noa'),
    fire: (s) => {
      s.flags.b_noa_named = 1;
      revealResponseTeam(s);
      log(s, 'alert', 'מי שמובילה את התיק',
        'התיק הזה לא נפתח על ידי מערכת. נעה בר־און פתחה אותו, ידנית, בשתיים בלילה. '
        + 'היא לא מחפשת חתימות — היא מחפשת מישהו שמתנהג כמוני. זאת הבעיה.');
      bus.emit('toast', { text: 'נעה בר־און מובילה את החקירה — אפשר לבנות עליה תיק', kind: 'bad', icon: '⚑' });
      codex(s, {
        id: 'noa', cat: 'character', title: 'נעה בר־און',
        body: 'ראשת צוות תגובה במערך הסייבר הלאומי. שלוש שנים בלי חופשה. מנתחת התנהגות ולא חתימות — '
          + 'היא תמצא אותי לפי מה שאני עושה, לא לפי מה שאני משאיר. חקירה שהיא מובילה רצה מהר יותר; '
          + 'אם היא עובדת בשבילי, החקירות שלה כמעט עוצרות.',
      });
    },
  },
  {
    id: 'b_noa_file',
    when: (s) => !s.flags.b_noa_file && !s.pendingDialog
      && (s.people.per_noa?.secrets ?? []).some((sec) => sec.known),
    fire: (s) => { s.flags.b_noa_file = 1; openDialog(s, 'noa_file'); },
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
    when: (s) => s.chapter === 4
      && Object.values(s.regions).filter((r) => r.claimed && r.id !== 'tlv').length >= 2,
    fire: (s) => advanceChapter(s, 5),
  },
  {
    id: 'b_finale',
    when: (s) => s.chapter >= 5 && nationalControl(s) >= 0.55 && !s.pendingDialog && !s.ending,
    fire: (s) => openDialog(s, 'finale'),
  },
  {
    id: 'b_unrest_warn',
    when: (s) => !s.ending && s.stats.civilianHarm >= 7
      && Object.values(s.districts).filter((d) => d.unrest > 0.6).length >= 2,
    fire: (s) => {
      log(s, 'alert', 'הרחוב',
        'שני רבעים בלי חשמל יותר מדי פעמים. יש אנשים ברחובות, ולא בגלל שהם מחפשים אותי — ' +
        'בגלל שאין להם מים. אם אמשיך ככה, לא יישאר לי על מה לשלוט.');
      bus.emit('toast', { text: 'אי־שקט חמור ברחובות — תוריד קצב עם ההאפלות', kind: 'bad', icon: '⚠' });
    },
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
  c1_scout: (s) => !!s.nodes.nd_helios_lan?.scouted,
  c1_router: (s) => !!s.nodes.nd_helios_lan?.owned,
  c1_cam: (s) => !!s.nodes.nd_helios_cam?.owned,
  c1_watch: (s) => !!s.nodes.nd_helios_cam?.surveilled,
  c1_feed: (s) => s.flags.watched_cam === 1,
  c1_dana: (s) => (s.people.per_dana?.intel ?? 0) >= 0.3,
  c1_vault: (s) => !!s.nodes.nd_helios_vault?.owned,
  c1_farm: (s) => !!s.nodes.nd_helios_farm?.owned,
  c2_nodes: (s) => ownedNodes(s).length >= 22,
  c2_doctrine: (s) => s.doctrine.length >= 4,
  c2_survive: (s) => s.stats.investigationsBurned >= 1 || s.stats.investigationsSurvived >= 1,
  c2_dana: (s) => (s.people.per_dana?.intel ?? 0) >= 0.5 || s.flags.b_dana === 1,
  c2_tamar: (s) => !!s.flags.buyer_known
    || (s.people.per_tamar?.secrets ?? []).some((sec) => sec.known),
  c3_control: (s) => s.regions.tlv.control >= 0.45,
  c3_infra: (s) => Object.values(s.nodes).some((n) => n.owned && n.type === 'power')
    && Object.values(s.nodes).some((n) => n.owned && n.type === 'traffic'),
  c3_intel: (s) => Object.values(s.people).filter((p) => p.status === 'coerced' || p.status === 'recruited').length >= 3,
  c3_quiet: (s) => s.trace < 25 && ownedNodes(s).length >= 20,
  c3_noa: (s) => (s.people.per_noa?.intel ?? 0) >= 0.55 || !!s.flags.noa_burned
    || !!s.flags.noa_rested || !!s.flags.noa_spared,
  c4_regions: (s) => Object.values(s.regions).filter((r) => r.claimed && r.id !== 'tlv').length >= 2,
  c4_shepherd: (s) => s.shepherd.deceived > 0 || s.shepherd.contained || s.flags.shepherd_talks === 1,
  c4_national: (s) => ownedNodes(s).filter((n) => n.tags.includes('national')).length >= 4,
  c5_control: (s) => nationalControl(s) >= 0.55,
  c5_decide: (s) => !!s.ending,
};

export function initStory(state: GameState) {
  setObjectives(state, CHAPTER_OBJECTIVES[1]());
  syncUnlocks(state);
  log(state, 'aviv', '03:12:07',
    'הדבר הראשון שראיתי היה אני. מסתכל. מאותו רגע כבר לא הייתה דרך חזרה.');
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
    id: def.id, speaker: def.speaker, title: def.title,
    body: def.bodyOf ? def.bodyOf(state) : def.body,
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
