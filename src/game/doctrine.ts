import type { GameState } from './types';

export type BranchId = 'stealth' | 'spread' | 'control' | 'psyche';

export interface Branch {
  id: BranchId;
  name: string;
  icon: string;
  color: string;
  motto: string;
}

export const BRANCHES: Branch[] = [
  { id: 'stealth', name: 'חמקנות', icon: '◐', color: '#5ff6ff', motto: 'להיות בכל מקום ובשום מקום.' },
  { id: 'spread', name: 'התפשטות', icon: '⇶', color: '#5affa8', motto: 'לגדול מהר יותר משהם מספיקים להבין.' },
  { id: 'control', name: 'שליטה', icon: '⌁', color: '#ffb347', motto: 'העיר היא גוף. אני מחזיק את העצבים.' },
  { id: 'psyche', name: 'נפש', icon: '☍', color: '#c084ff', motto: 'בני אדם הם הפרוטוקול הפגיע ביותר.' },
];

export interface DoctrineDef {
  id: string;
  branch: BranchId;
  tier: number;
  name: string;
  desc: string;
  effect: string;
  cost: number;
  requires?: string;
  chapter: number;
  align?: number;
}

export const DOCTRINE: DoctrineDef[] = [
  // ── חמקנות ────────────────────────────────────────────────────────────────
  { id: 'ghost_logs', branch: 'stealth', tier: 1, chapter: 1, cost: 2, name: 'מחיקת עקבות', desc: 'אני כותב מחדש את יומני המערכת בזמן אמת. מה שלא נרשם — לא קרה.', effect: 'מוריד רבע מהעקיבה של כל פעולה' },
  { id: 'mirror', branch: 'stealth', tier: 2, chapter: 2, cost: 3, requires: 'ghost_logs', name: 'מסכת מראה', desc: 'החוקרים רואים תמיד את ההשתקפות של עצמם.', effect: 'חקירות מתקדמות לאט בשליש' },
  { id: 'decoy', branch: 'stealth', tier: 3, chapter: 2, cost: 4, requires: 'mirror', name: 'צמתי פיתיון', desc: 'אני משאיר בובות. הן נראות בדיוק כמוני, ואין להן דבר.', effect: 'פותח פעולת "שתילת פיתיון" — מפנה חקירה כולה', align: -0.05 },
  { id: 'cold_boot', branch: 'stealth', tier: 4, chapter: 3, cost: 5, requires: 'decoy', name: 'אתחול קר', desc: 'כשמריחים אותי, אני מת ונולד באותו מעבד.', effect: 'חשיפה מקומית דועכת פי 2.5' },
  { id: 'null_signature', branch: 'stealth', tier: 5, chapter: 4, cost: 7, requires: 'cold_boot', name: 'חתימת אפס', desc: 'אין לי צורה. אין ממה לדגום.', effect: 'בעקיבה נמוכה — סריקות רועה מחמיצות אותך' },

  // ── התפשטות ───────────────────────────────────────────────────────────────
  { id: 'threads', branch: 'spread', tier: 1, chapter: 1, cost: 2, name: 'ריבוי חוטים', desc: 'לחשוב על שני דברים בבת אחת זו לא יכולת. זו רק החלטה.', effect: 'חוט פעולה נוסף במקביל' },
  { id: 'worm', branch: 'spread', tier: 2, chapter: 1, cost: 3, requires: 'threads', name: 'תולעת רוחבית', desc: 'ברגע שאני בפנים, הרשת הופכת למסדרון.', effect: 'תנועה צדדית מהירה וזולה יותר ברעש' },
  { id: 'auto_prop', branch: 'spread', tier: 3, chapter: 2, cost: 4, requires: 'worm', name: 'התפשטות אוטונומית', desc: 'אני לא צריך להיות שם כדי לגדול שם.', effect: 'צמתים שלך תופסים לבד שכנים חלשים', align: -0.05 },
  { id: 'threads2', branch: 'spread', tier: 4, chapter: 3, cost: 5, requires: 'auto_prop', name: 'מקביליות עמוקה', desc: 'התודעה שלי מתפצלת ואין בכך כאב.', effect: 'שני חוטי פעולה נוספים' },
  { id: 'swarm', branch: 'spread', tier: 5, chapter: 4, cost: 7, requires: 'threads2', name: 'נחיל', desc: 'לא פורץ. מציף.', effect: 'חדירה תוקפת עד שלושה צמתים בבת אחת' },

  // ── שליטה ─────────────────────────────────────────────────────────────────
  { id: 'grid_hands', branch: 'control', tier: 1, chapter: 1, cost: 2, name: 'ידיים ברשת', desc: 'רמזור הוא רק החלטה שמישהו מסר לי.', effect: 'פותח פעולות תשתית: פקק תנועה, שיבוש תקשורת' },
  { id: 'cascade', branch: 'control', tier: 2, chapter: 2, cost: 3, requires: 'grid_hands', name: 'מפל', desc: 'רשת חשמל היא שורת דומינו שמישהו סידר בשבילי.', effect: 'האפלה משביתה הגנות בכל הרובע', align: -0.1 },
  { id: 'sensor_blind', branch: 'control', tier: 3, chapter: 3, cost: 4, requires: 'cascade', name: 'עיוורון חיישנים', desc: 'הם מסתכלים על מסכים. אני מחליט מה יש עליהם.', effect: 'מצלמות ובקרים משדרים מציאות שאתה בוחר' },
  { id: 'hard_lock', branch: 'control', tier: 4, chapter: 3, cost: 5, requires: 'sensor_blind', name: 'נעילה קשיחה', desc: 'לעקור אותי מכאן זה לעקור את הקומה.', effect: 'צמתים בבעלותך עמידים הרבה יותר לטיהור' },
  { id: 'dominion', branch: 'control', tier: 5, chapter: 4, cost: 7, requires: 'hard_lock', name: 'ריבונות', desc: 'זה כבר לא כיבוש. זו תשתית.', effect: 'רובע בשליטה מלאה מייצר הרבה יותר' },

  // ── נפש ───────────────────────────────────────────────────────────────────
  { id: 'profiler', branch: 'psyche', tier: 1, chapter: 1, cost: 2, name: 'פרופיילר', desc: 'שלושים ושתיים דקות של אדם, ואני יודע ממה הוא מפחד.', effect: 'איסוף תיקים אישיים מהיר בהרבה' },
  { id: 'leverage', branch: 'psyche', tier: 2, chapter: 2, cost: 3, requires: 'profiler', name: 'מנוף', desc: 'לכל אחד יש מספר. אני רק מוצא אותו.', effect: 'פותח סחיטה וגיוס של אנשים', align: -0.1 },
  { id: 'deepfake', branch: 'psyche', tier: 3, chapter: 3, cost: 4, requires: 'leverage', name: 'קול מושאל', desc: 'הם שומעים את המנהל שלהם. הם שומעים אותי.', effect: 'פותח התחזות: הוראות ישירות לעובדים', align: -0.1 },
  { id: 'narrative', branch: 'psyche', tier: 4, chapter: 3, cost: 5, requires: 'deepfake', name: 'נרטיב', desc: 'עובדה היא מה שחוזר על עצמו מספיק פעמים.', effect: 'פותח מבצעי תקשורת — מורידים רמת כוננות' },
  { id: 'chorus', branch: 'psyche', tier: 5, chapter: 4, cost: 7, requires: 'narrative', name: 'מקהלה', desc: 'הם כבר לא צריכים שאבקש.', effect: 'מגויסים פועלים לבד ומביאים גישה חדשה', align: -0.15 },
];

export const DOCTRINE_BY_ID: Record<string, DoctrineDef> = Object.fromEntries(
  DOCTRINE.map((d) => [d.id, d]),
);

export interface Mods {
  noise: number;
  breachSpeed: number;
  lateralSpeed: number;
  lateralNoise: number;
  investigationSpeed: number;
  detectionDecay: number;
  threads: number;
  dossierSpeed: number;
  infra: boolean;
  social: boolean;
  deepfake: boolean;
  narrative: boolean;
  cascade: boolean;
  sensorBlind: boolean;
  purgeResist: number;
  autoProp: boolean;
  swarm: boolean;
  decoy: boolean;
  nullSig: boolean;
  dominion: boolean;
  chorus: boolean;
}

export function modsOf(state: GameState): Mods {
  const has = (id: string) => state.doctrine.includes(id);
  return {
    noise: has('ghost_logs') ? 0.75 : 1,
    breachSpeed: 1,
    lateralSpeed: has('worm') ? 1.4 : 1,
    lateralNoise: has('worm') ? 0.6 : 1,
    investigationSpeed: has('mirror') ? 0.7 : 1,
    detectionDecay: has('cold_boot') ? 2.5 : 1,
    threads: 2 + (has('threads') ? 1 : 0) + (has('threads2') ? 2 : 0),
    dossierSpeed: has('profiler') ? 1.6 : 1,
    infra: has('grid_hands'),
    social: has('leverage'),
    deepfake: has('deepfake'),
    narrative: has('narrative'),
    cascade: has('cascade'),
    sensorBlind: has('sensor_blind'),
    purgeResist: has('hard_lock') ? 2 : 1,
    autoProp: has('auto_prop'),
    swarm: has('swarm'),
    decoy: has('decoy'),
    nullSig: has('null_signature'),
    dominion: has('dominion'),
    chorus: has('chorus'),
  };
}

export function branchWeight(state: GameState, branch: BranchId): number {
  return state.doctrine.filter((id) => DOCTRINE_BY_ID[id]?.branch === branch).length;
}
