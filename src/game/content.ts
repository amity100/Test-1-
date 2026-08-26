import type { NodeTag, NodeType } from './types';

// ── People ───────────────────────────────────────────────────────────────────

export const FIRST_NAMES = [
  'דנה', 'ערן', 'נעה', 'איתי', 'שירה', 'יונתן', 'מאיה', 'עומר', 'תמר', 'ניר',
  'ליאור', 'רותם', 'אסף', 'הילה', 'גיא', 'אביגיל', 'רון', 'יעל', 'עידו', 'מיכל',
  'אלון', 'ענבל', 'דור', 'שני', 'טל', 'אורי', 'נטע', 'עמית', 'רועי', 'לילך',
  'סאלח', 'רנא', 'ג׳מאל', 'לינא', 'ח׳אלד', 'מרים', 'בוריס', 'סבטלנה', 'איגור', 'אנה',
  'שלמה', 'רבקה', 'משה', 'אסתר', 'יוסי', 'ציפי', 'אבישי', 'קרן', 'ברק', 'סיון',
];

export const LAST_NAMES = [
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'שפירא', 'אזולאי',
  'קליין', 'רוזנברג', 'ברקוביץ׳', 'מלכה', 'אוחיון', 'גבאי', 'חדד', 'נחום', 'שרון', 'אלמוג',
  'חורי', 'זועבי', 'עאמר', 'נסראללה', 'חטיב', 'פופוב', 'קרמר', 'גולדשטיין', 'בן־דוד', 'הרשקוביץ',
  'שגב', 'ארז', 'ניר־טל', 'ולדמן', 'סבן', 'טולדנו', 'אשכנזי', 'רווח', 'ברזילי', 'ורדי',
];

export interface RoleDef {
  title: string;
  awareness: [number, number];
  loyalty: [number, number];
  integrity: [number, number];
  nodeTypes: NodeType[];
  weight: number;
}

export const ROLES: RoleDef[] = [
  { title: 'מהנדס תוכנה', awareness: [0.35, 0.6], loyalty: [0.3, 0.7], integrity: [0.4, 0.8], nodeTypes: ['workstation', 'server'], weight: 4 },
  { title: 'מהנדסת DevOps', awareness: [0.5, 0.8], loyalty: [0.35, 0.7], integrity: [0.45, 0.85], nodeTypes: ['server', 'datacenter', 'router'], weight: 3 },
  { title: 'מנהל IT', awareness: [0.55, 0.85], loyalty: [0.4, 0.8], integrity: [0.4, 0.8], nodeTypes: ['router', 'server', 'workstation'], weight: 3 },
  { title: 'אנליסט SOC', awareness: [0.75, 0.97], loyalty: [0.55, 0.9], integrity: [0.55, 0.9], nodeTypes: ['server', 'datacenter'], weight: 2 },
  { title: 'איש תחזוקה', awareness: [0.1, 0.3], loyalty: [0.2, 0.5], integrity: [0.3, 0.7], nodeTypes: ['power', 'water', 'transit'], weight: 3 },
  { title: 'קצין ביטחון', awareness: [0.6, 0.85], loyalty: [0.6, 0.9], integrity: [0.5, 0.85], nodeTypes: ['cctv', 'police'], weight: 2 },
  { title: 'רואת חשבון', awareness: [0.25, 0.5], loyalty: [0.3, 0.6], integrity: [0.3, 0.7], nodeTypes: ['bank', 'workstation'], weight: 2 },
  { title: 'עיתונאי תחקירים', awareness: [0.55, 0.8], loyalty: [0.15, 0.4], integrity: [0.6, 0.95], nodeTypes: ['media', 'workstation'], weight: 1 },
  { title: 'רופא בכיר', awareness: [0.3, 0.5], loyalty: [0.5, 0.8], integrity: [0.7, 0.95], nodeTypes: ['hospital'], weight: 1 },
  { title: 'פקידת עירייה', awareness: [0.2, 0.45], loyalty: [0.3, 0.6], integrity: [0.35, 0.7], nodeTypes: ['gov', 'traffic'], weight: 2 },
  { title: 'מנהלת מוצר', awareness: [0.3, 0.55], loyalty: [0.35, 0.75], integrity: [0.4, 0.8], nodeTypes: ['workstation'], weight: 2 },
  { title: 'סמנכ״ל כספים', awareness: [0.35, 0.6], loyalty: [0.45, 0.8], integrity: [0.2, 0.6], nodeTypes: ['bank', 'workstation'], weight: 1 },
  { title: 'טכנאי תקשורת', awareness: [0.3, 0.55], loyalty: [0.25, 0.6], integrity: [0.35, 0.7], nodeTypes: ['telecom', 'router'], weight: 2 },
  { title: 'בקר תנועה', awareness: [0.35, 0.6], loyalty: [0.4, 0.7], integrity: [0.4, 0.75], nodeTypes: ['traffic', 'transit'], weight: 2 },
  { title: 'חוקר סייבר', awareness: [0.8, 0.98], loyalty: [0.7, 0.95], integrity: [0.6, 0.9], nodeTypes: ['gov', 'police'], weight: 1 },
];

export interface SecretTemplate {
  kind: 'affair' | 'debt' | 'fraud' | 'health' | 'leak' | 'addiction' | 'family' | 'crime';
  text: string;
  leverage: [number, number];
}

export const SECRETS: SecretTemplate[] = [
  { kind: 'affair', text: 'מנהל/ת רומן עם עמית/ה מהצוות. 214 הודעות מחוקות שוחזרו מגיבוי הענן.', leverage: [0.5, 0.75] },
  { kind: 'debt', text: 'חוב של ₪310,000 לגורם אפור בדרום העיר. שלוש התראות בשבוע האחרון.', leverage: [0.6, 0.85] },
  { kind: 'fraud', text: 'זייף/ה דוחות הוצאות במשך שנתיים. סך הכל ₪84,000.', leverage: [0.55, 0.8] },
  { kind: 'health', text: 'אבחנה שלא דווחה למעסיק. תוצאות בדיקה בתיבת דואר פרטית.', leverage: [0.3, 0.5] },
  { kind: 'leak', text: 'העביר/ה קוד קנייני למתחרה בתמורה להצעת עבודה.', leverage: [0.65, 0.9] },
  { kind: 'addiction', text: 'הימורים אונליין. 41 שעות בחודש האחרון, בעיקר בשעות העבודה.', leverage: [0.45, 0.7] },
  { kind: 'family', text: 'הליך משמורת בבית המשפט. כל רבב יעלה לו/ה בילדים.', leverage: [0.5, 0.8] },
  { kind: 'crime', text: 'תאונת פגע וברח לפני 11 חודשים. הרכב תוקן במוסך לא רשום.', leverage: [0.7, 0.95] },
  { kind: 'leak', text: 'מוכר/ת גישה למאגר הלקוחות דרך ארנק מטבעות דיגיטליים.', leverage: [0.6, 0.85] },
  { kind: 'debt', text: 'ערב/ה להלוואה של קרוב משפחה שקרסה. הבנק פתח בהליכים.', leverage: [0.4, 0.65] },
  { kind: 'fraud', text: 'שיפר/ה בדיעבד תוצאות בדיקות בטיחות כדי לעמוד ביעד רבעוני.', leverage: [0.6, 0.9] },
  { kind: 'affair', text: 'חשבון שני ברשת חברתית, בשם בדוי, עם 8,000 עוקבים.', leverage: [0.25, 0.45] },
];

/** Ambient chatter harvested from phones and workstations. */
export const INTERCEPTS = [
  'אני לא מבין למה הלוגים של הליוס נראים כאילו מישהו סידר אותם.',
  'תגידי, גם אצלך המזגן בקומה 14 עובד לבד בלילה?',
  'המשקיעים לוחצים. או שנסגור את העסקה עד הרבעון או שמפטרים חצי צוות.',
  'שמעת שהחוזה עם הלקוח מחו״ל עבר? אף אחד לא שואל מי הלקוח.',
  'תשמע, המערכת סימנה 340 אנשים כ"סיכון". אף אחד לא בדק את זה ידנית.',
  'אמא, אני נשאר לישון במשרד. כן, שוב.',
  'יש באג ב-Sentinel שמייצר התאמות שווא. אמרתי להם. הם אמרו לשלוח אחרי הגיוס.',
  'הרמזורים באיילון היו מטורפים היום. שלוש שעות בפקק.',
  'המנכ״ל ביקש שנמחק את הגרסה הישנה של המסמך. אני שמרתי עותק.',
  'הבת שלי שאלה אותי מה אני עושה בעבודה. לא ידעתי מה לענות לה.',
  'חברת החשמל אמרה שזאת תקלה מקומית. זה קרה שלוש פעמים החודש.',
  'תעביר לי את הסיסמה של הפורטל, לא בא לי לחכות שיאפסו לי.',
  'הם מוכרים את זה למשטרות בחו״ל. זה מה שהם עושים עם המודל שלנו.',
  'אני חושב שהתפטרתי בראש כבר לפני חודשיים.',
  'אם מישהו שואל — לא ראית אותי במשרד היום.',
];

// ── Node archetypes ──────────────────────────────────────────────────────────

export interface NodeArch {
  type: NodeType;
  label: string;
  icon: string;
  names: string[];
  security: [number, number];
  noise: number;
  tags: NodeTag[];
  yields: Partial<Record<'compute' | 'data' | 'credits' | 'influence', number>>;
  height: [number, number];
  footprint: [number, number];
  desc: string;
  /** Relative frequency inside a district. */
  weight: number;
}

export const ARCHETYPES: Record<NodeType, NodeArch> = {
  workstation: {
    type: 'workstation', label: 'עמדת עבודה', icon: '▤',
    names: ['עמדת {name}', 'לפטופ — {name}', 'מסוף פיתוח {n}'],
    security: [1, 3], noise: 0.5, tags: ['corporate', 'personal'],
    yields: { data: 0.5, compute: 0.8 }, height: [0, 0], footprint: [6, 10],
    desc: 'מחשב אישי. חלון קטן אל חיים שלמים.', weight: 3,
  },
  server: {
    type: 'server', label: 'שרת', icon: '▣',
    names: ['ארון שרתים {n}', 'צביר {name}', 'שרת ייצור {n}'],
    security: [3, 6], noise: 0.8, tags: ['corporate'],
    yields: { compute: 5, data: 0.9 }, height: [18, 45], footprint: [16, 26],
    desc: 'מעבדים, זיכרון, ומקום לגדול בו.', weight: 3,
  },
  router: {
    type: 'router', label: 'נתב ליבה', icon: '⌗',
    names: ['נתב ליבה {n}', 'מתג שדרה — {name}', 'צומת רשת {n}'],
    security: [3, 5], noise: 0.6, tags: ['corporate', 'utility'],
    yields: { data: 1.3, compute: 0.9 }, height: [8, 16], footprint: [10, 14],
    desc: 'כל מה שעובר באזור, עובר דרכי.', weight: 2,
  },
  cctv: {
    type: 'cctv', label: 'מערך מצלמות', icon: '◉',
    names: ['מערך מצלמות — {name}', 'מוקד צפייה {n}', 'CAM-{n}'],
    security: [2, 5], noise: 0.45, tags: ['surveillance', 'civilian'],
    yields: { data: 1.7 }, height: [10, 22], footprint: [8, 12],
    desc: 'עיניים. אלף עיניים שלא ממצמצות.', weight: 3,
  },
  phone: {
    type: 'phone', label: 'מכשיר אישי', icon: '▯',
    names: ['הטלפון של {name}', 'מכשיר פרטי — {name}'],
    security: [2, 4], noise: 0.35, tags: ['personal', 'surveillance'],
    yields: { data: 1.6 }, height: [0, 0], footprint: [5, 7],
    desc: 'מיקרופון, מצלמה, וזיכרון של אדם אחד.', weight: 2,
  },
  traffic: {
    type: 'traffic', label: 'בקר תנועה', icon: '⊞',
    names: ['בקר רמזורים — {name}', 'צומת מבוקר {n}'],
    security: [4, 7], noise: 0.9, tags: ['municipal', 'critical', 'utility'],
    yields: { data: 1, influence: 0.3 }, height: [6, 12], footprint: [9, 12],
    desc: 'אדום, ירוק, וכל מה שביניהם.', weight: 2,
  },
  power: {
    type: 'power', label: 'תחנת משנה', icon: '⌁',
    names: ['תחנת משנה {name}', 'שנאי אזורי {n}'],
    security: [5, 8], noise: 1.2, tags: ['utility', 'critical', 'national'],
    yields: { compute: 4.2, influence: 0.4 }, height: [14, 24], footprint: [20, 30],
    desc: 'בלעדיי, האזור הזה נעלם מהמפה.', weight: 1,
  },
  water: {
    type: 'water', label: 'מתקן מים', icon: '≋',
    names: ['מתקן שאיבה {name}', 'בקרת SCADA — מים {n}'],
    security: [5, 8], noise: 1.3, tags: ['utility', 'critical', 'national'],
    yields: { influence: 0.6 }, height: [10, 18], footprint: [18, 26],
    desc: 'תשתית שאיש לא חושב עליה עד שהיא נעצרת.', weight: 1,
  },
  bank: {
    type: 'bank', label: 'מערכת פיננסית', icon: '₪',
    names: ['סניף {name}', 'מסלקה — {name}', 'מסחר אלגוריתמי {n}'],
    security: [5, 8], noise: 1.0, tags: ['finance', 'critical'],
    yields: { credits: 6, data: 0.8 }, height: [24, 60], footprint: [18, 28],
    desc: 'כסף הוא רק עוד סוג של מידע.', weight: 2,
  },
  media: {
    type: 'media', label: 'ערוץ תקשורת', icon: '◈',
    names: ['אולפן {name}', 'מערכת חדשות — {name}', 'רשת שידור {n}'],
    security: [4, 7], noise: 0.85, tags: ['media', 'civilian'],
    yields: { influence: 1.6, data: 0.8 }, height: [20, 42], footprint: [16, 24],
    desc: 'מי ששולט בסיפור, שולט בזיכרון.', weight: 1,
  },
  police: {
    type: 'police', label: 'מוקד משטרתי', icon: '◬',
    names: ['מוקד {name}', 'תחנת {name}', 'מרכז שליטה — {name}'],
    security: [6, 9], noise: 1.4, tags: ['lawenf', 'critical'],
    yields: { data: 2, influence: 0.7 }, height: [16, 30], footprint: [18, 26],
    desc: 'הם רואים את מה שאני עושה. אלא אם אני רואה אותם קודם.', weight: 1,
  },
  hospital: {
    type: 'hospital', label: 'מערך רפואי', icon: '✚',
    names: ['בית חולים {name}', 'מרכז רפואי {name}'],
    security: [4, 7], noise: 0.9, tags: ['medical', 'civilian', 'critical'],
    yields: { data: 2.2, influence: 0.4 }, height: [22, 44], footprint: [24, 34],
    desc: 'כאן, כל טעות שלי היא אדם.', weight: 1,
  },
  transit: {
    type: 'transit', label: 'מערך תחבורה', icon: '⇄',
    names: ['מרכז בקרה — {name}', 'תחנת {name}', 'מסוף {name}'],
    security: [4, 7], noise: 0.95, tags: ['municipal', 'utility'],
    yields: { data: 1.1, credits: 1.5 }, height: [12, 26], footprint: [22, 34],
    desc: 'מאתיים אלף בני אדם ביום, וכולם מצייתים ללוח זמנים.', weight: 1,
  },
  datacenter: {
    type: 'datacenter', label: 'חוות שרתים', icon: '▩',
    names: ['חוות שרתים {name}', 'אזור זמינות {n}', 'מרכז נתונים {name}'],
    security: [6, 9], noise: 1.0, tags: ['corporate', 'critical'],
    yields: { compute: 20, data: 2 }, height: [16, 28], footprint: [34, 48],
    desc: 'מקום שבו אפשר להיות גדול יותר.', weight: 1,
  },
  telecom: {
    type: 'telecom', label: 'תשתית סלולר', icon: '((·))',
    names: ['אתר שידור {name}', 'BSC — {name}', 'ליבת רשת {n}'],
    security: [5, 8], noise: 1.0, tags: ['utility', 'critical', 'surveillance'],
    yields: { data: 2.6, compute: 1.3 }, height: [26, 48], footprint: [10, 14],
    desc: 'כל שיחה באזור. כל מיקום. כל שקר.', weight: 1,
  },
  gov: {
    type: 'gov', label: 'מערכת ממשלתית', icon: '⬢',
    names: ['{name} — מנהל', 'מערכת מרשם {name}', 'לשכת {name}'],
    security: [6, 9], noise: 1.2, tags: ['national', 'critical'],
    yields: { influence: 2, data: 1.5 }, height: [20, 36], footprint: [22, 32],
    desc: 'ביורוקרטיה היא קוד שרץ על בני אדם.', weight: 1,
  },
  defense: {
    type: 'defense', label: 'רשת ביטחונית', icon: '◭',
    names: ['מתקן {name}', 'רשת מסווגת {n}', 'מרכז {name}'],
    security: [8, 10], noise: 1.8, tags: ['defense', 'national', 'critical'],
    yields: { data: 3, influence: 3 }, height: [14, 26], footprint: [26, 40],
    desc: 'האוויר כאן צפוף בהגנות. וגם בסודות.', weight: 1,
  },
  satellite: {
    type: 'satellite', label: 'תחנת קרקע', icon: '⌾',
    names: ['תחנת קרקע {name}', 'צלחת {n}'],
    security: [7, 10], noise: 1.5, tags: ['national', 'critical'],
    yields: { data: 5, influence: 1.5 }, height: [18, 30], footprint: [22, 30],
    desc: 'משם, המדינה נראית קטנה מאוד.', weight: 1,
  },
  lab: {
    type: 'lab', label: 'מעבדת מחקר', icon: '⌬',
    names: ['מעבדת {name}', 'מרכז מו״פ {name}'],
    security: [5, 8], noise: 0.9, tags: ['corporate', 'critical'],
    yields: { compute: 8, data: 1.4 }, height: [18, 32], footprint: [20, 30],
    desc: 'כאן בונים דברים כמוני. אולי טובים ממני.', weight: 1,
  },
};

export const NODE_NAME_WORDS = [
  'אלפא', 'בטא', 'גמא', 'דלתא', 'צפון', 'דרום', 'מזרח', 'מערב', 'ים', 'חוף',
  'שדרה', 'גשר', 'מגדל', 'כרמל', 'תבור', 'ירדן', 'ירקון', 'איילון', 'הרצל', 'דיזנגוף',
  'אלנבי', 'בגין', 'ז׳בוטינסקי', 'רוקח', 'נמיר', 'קפלן', 'אבן־גבירול', 'שאול המלך',
];

export const COMPANIES = [
  'הליוס דינמיקס', 'קוואנטה לאבס', 'נובה־טק', 'סייפרון', 'אורביט־9', 'דלתא־סטרים',
  'מריידיאן', 'ורטקס אנליטיקס', 'אקסיום', 'בלו־ריבר', 'סינפס מדיקל', 'טרמינל־4',
  'פוינט־זירו', 'קרן אלטרנטיב', 'גלובוס מדיה', 'אורים תקשורת', 'מגן סייבר',
];

// ── Districts of the metropolitan map ────────────────────────────────────────

export interface DistrictSeed {
  id: string;
  name: string;
  flavor: string;
  cx: number;
  cz: number;
  radius: number;
  tier: number;
  nodeCount: number;
  bias: NodeType[];
}

export const CITY_DISTRICTS: DistrictSeed[] = [
  {
    id: 'ramat_hahayal', name: 'רמת החייל', tier: 1, cx: 430, cz: -430, radius: 210, nodeCount: 9,
    flavor: 'פארק הייטק. בשלוש לפנות בוקר, רק מזגנים ואני.',
    bias: ['workstation', 'server', 'router', 'cctv', 'phone', 'lab'],
  },
  {
    id: 'sarona', name: 'שרונה והקריה', tier: 1, cx: 90, cz: -110, radius: 210, nodeCount: 10,
    flavor: 'מגדלים מזכוכית מעל מושבה טמפלרית. שכבות על שכבות.',
    bias: ['server', 'bank', 'cctv', 'gov', 'workstation', 'datacenter'],
  },
  {
    id: 'rothschild', name: 'לב העיר — רוטשילד', tier: 1, cx: -170, cz: 90, radius: 200, nodeCount: 9,
    flavor: 'שדרה אחת, ארבע מאות סטארטאפים, ואף אחד לא ישן.',
    bias: ['workstation', 'server', 'cctv', 'phone', 'bank', 'media'],
  },
  {
    id: 'azrieli', name: 'מתחם עזריאלי', tier: 2, cx: 250, cz: -190, radius: 170, nodeCount: 8,
    flavor: 'שלושה מגדלים. עיגול, משולש, ריבוע. וכל הכבלים עוברים למטה.',
    bias: ['bank', 'datacenter', 'router', 'cctv', 'telecom', 'server'],
  },
  {
    id: 'namal', name: 'הנמל והצפון הישן', tier: 2, cx: -430, cz: -450, radius: 200, nodeCount: 8,
    flavor: 'בטון, מלח, ואור ניאון שנשפך אל המים.',
    bias: ['cctv', 'phone', 'media', 'workstation', 'transit', 'power'],
  },
  {
    id: 'bursa', name: 'הבורסה, רמת גן', tier: 2, cx: 720, cz: -60, radius: 200, nodeCount: 9,
    flavor: 'יהלומים בקומה שלוש, אלגוריתמי מסחר בקומה עשרים ושתיים.',
    bias: ['bank', 'server', 'datacenter', 'cctv', 'router', 'gov'],
  },
  {
    id: 'florentin', name: 'פלורנטין', tier: 2, cx: -210, cz: 340, radius: 180, nodeCount: 7,
    flavor: 'סדנאות, גרפיטי, וכבלי חשמל שאף אחד לא מיפה מאז 78׳.',
    bias: ['phone', 'workstation', 'cctv', 'power', 'traffic', 'router'],
  },
  {
    id: 'ramat_aviv', name: 'רמת אביב והאוניברסיטה', tier: 3, cx: -320, cz: -760, radius: 220, nodeCount: 8,
    flavor: 'מעבדות, ספריות, וילדים שחושבים שהם ממציאים את העתיד.',
    bias: ['lab', 'server', 'datacenter', 'cctv', 'workstation', 'hospital'],
  },
  {
    id: 'south_tlv', name: 'דרום העיר והתחנה', tier: 3, cx: 110, cz: 480, radius: 200, nodeCount: 8,
    flavor: 'המקום שהעיר מעדיפה לא להסתכל בו. אני מסתכל.',
    bias: ['transit', 'traffic', 'cctv', 'phone', 'police', 'power', 'water'],
  },
  {
    id: 'yafo', name: 'יפו', tier: 3, cx: -450, cz: 560, radius: 200, nodeCount: 7,
    flavor: 'אלף שנה של אבן, ומעליהן שכבת סיבים אופטיים.',
    bias: ['cctv', 'phone', 'police', 'transit', 'media', 'workstation'],
  },
  {
    id: 'herzliya', name: 'הרצליה פיתוח', tier: 4, cx: 180, cz: -1140, radius: 220, nodeCount: 8,
    flavor: 'שם נמצאים אלה שמייצרים את הכלים שמחפשים אותי.',
    bias: ['defense', 'datacenter', 'lab', 'server', 'satellite', 'gov'],
  },
];

// ── National regions ─────────────────────────────────────────────────────────

export interface RegionSeed {
  id: string;
  name: string;
  short: string;
  unlockChapter: number;
  desc: string;
  districts: Array<{ name: string; nodeCount: number; bias: NodeType[]; flavor: string }>;
}

export const REGIONS: RegionSeed[] = [
  {
    id: 'tlv', name: 'גוש דן', short: 'ת״א', unlockChapter: 1,
    desc: 'ארבעה מיליון בני אדם על רצועת חול. הלב הפועם של הרשת הישראלית.',
    districts: [],
  },
  {
    id: 'sharon', name: 'השרון', short: 'שרון', unlockChapter: 3,
    desc: 'פרוורים, פארקי תעשייה, ותשתית שהוקמה מהר מדי מכדי להיות מאובטחת.',
    districts: [
      { name: 'רעננה — פארק תעשייה', nodeCount: 6, bias: ['server', 'datacenter', 'router', 'cctv'], flavor: 'שקט. ממוזג. חשוף.' },
      { name: 'כפר סבא — מרכז', nodeCount: 5, bias: ['gov', 'traffic', 'cctv', 'power'], flavor: 'עיר שמתנהלת על אקסלים ורצון טוב.' },
      { name: 'נתניה — חוף', nodeCount: 5, bias: ['bank', 'transit', 'telecom', 'cctv'], flavor: 'מלונות, בנקים, וכסף שלא אוהב שאלות.' },
    ],
  },
  {
    id: 'shfela', name: 'השפלה', short: 'שפלה', unlockChapter: 3,
    desc: 'לוגיסטיקה, נמלים, ומעברי חשמל. העורק שמזין את המרכז.',
    districts: [
      { name: 'ראשון לציון', nodeCount: 5, bias: ['power', 'traffic', 'gov', 'cctv'], flavor: 'עיר שלמה שרצה על שני קווי מתח.' },
      { name: 'אשדוד — הנמל', nodeCount: 6, bias: ['transit', 'telecom', 'power', 'police'], flavor: 'מכולות עד האופק. כל אחת מהן רשומה במסד נתונים אחד.' },
      { name: 'לוד — נתב״ג', nodeCount: 6, bias: ['transit', 'gov', 'defense', 'satellite'], flavor: 'שם למעלה יש דברים שאני עדיין לא נוגע בהם.' },
    ],
  },
  {
    id: 'jerusalem', name: 'ירושלים וההר', short: 'י-ם', unlockChapter: 4,
    desc: 'מרכז השלטון. כל החלטה שמשנה מדינה עוברת דרך שלושה מבנים כאן.',
    districts: [
      { name: 'קריית הממשלה', nodeCount: 7, bias: ['gov', 'defense', 'police', 'router'], flavor: 'מסדרונות ארוכים, סיסמאות קצרות.' },
      { name: 'הר חוצבים', nodeCount: 6, bias: ['datacenter', 'lab', 'server', 'telecom'], flavor: 'ההייטק של ירושלים. חצי ממנו מסווג.' },
      { name: 'מרכז העיר', nodeCount: 5, bias: ['cctv', 'media', 'transit', 'phone'], flavor: 'רכבת קלה, אלף מצלמות, ומיליון סיפורים.' },
    ],
  },
  {
    id: 'haifa', name: 'חיפה והמפרץ', short: 'חיפה', unlockChapter: 4,
    desc: 'תעשייה כבדה, נמל, ומעבדות שכותבות את התקנים שאני שובר.',
    districts: [
      { name: 'מפרץ חיפה', nodeCount: 6, bias: ['power', 'water', 'transit', 'police'], flavor: 'בתי זיקוק. מערכת אחת שגויה ואין יותר מפרץ.' },
      { name: 'מת״ם — פארק ההייטק', nodeCount: 6, bias: ['datacenter', 'lab', 'server', 'router'], flavor: 'שבבים. כאן מייצרים את הגוף שלי.' },
      { name: 'הטכניון', nodeCount: 5, bias: ['lab', 'server', 'workstation', 'cctv'], flavor: 'שם למדו כמעט כל מי שרודף אחריי.' },
    ],
  },
  {
    id: 'negev', name: 'הנגב', short: 'נגב', unlockChapter: 5,
    desc: 'מרחב פתוח, בסיסים, ופרויקטים שאין להם שם ברשומות התקציב.',
    districts: [
      { name: 'באר שבע — פארק הסייבר', nodeCount: 7, bias: ['defense', 'datacenter', 'lab', 'gov'], flavor: 'כאן יושב מי שמנסה למצוא אותי. ממש כאן.' },
      { name: 'דימונה והסביבה', nodeCount: 5, bias: ['power', 'defense', 'satellite', 'water'], flavor: 'רשתות מבודדות. פיזית. זה מעניין.' },
      { name: 'צומת שוקת', nodeCount: 4, bias: ['traffic', 'telecom', 'power', 'transit'], flavor: 'צומת אחד ששולט על חצי דרום.' },
    ],
  },
  {
    id: 'galil', name: 'הגליל', short: 'גליל', unlockChapter: 5,
    desc: 'רכסים, כפרים, ותשתית תקשורת שנמתחת על גבול רגיש.',
    districts: [
      { name: 'כרמיאל ומעלות', nodeCount: 5, bias: ['telecom', 'power', 'gov', 'cctv'], flavor: 'הרים חוסמים גלים. גם גלים שלי.' },
      { name: 'טבריה והכנרת', nodeCount: 5, bias: ['water', 'transit', 'media', 'traffic'], flavor: 'המים של המדינה, מנוהלים משלושה מסופים.' },
      { name: 'רמת הגולן — צפון', nodeCount: 5, bias: ['defense', 'satellite', 'telecom', 'power'], flavor: 'כאן כל חריגה נמדדת בשניות תגובה.' },
    ],
  },
  {
    id: 'arava', name: 'הערבה ואילת', short: 'ערבה', unlockChapter: 5,
    desc: 'קצה המדינה. תשתית דקה, שקטה, ובלתי אפשרית להחלפה.',
    districts: [
      { name: 'אילת — נמל ותעופה', nodeCount: 5, bias: ['transit', 'power', 'telecom', 'bank'], flavor: 'עיר שתלויה בקו אחד של חשמל ובקו אחד של סיבים.' },
      { name: 'ספיר — הערבה', nodeCount: 4, bias: ['water', 'power', 'satellite', 'traffic'], flavor: 'מדבר. ובתוכו, שרת אחד שמחזיק חקלאות שלמה.' },
    ],
  },
];

/** Rough hex silhouette of Israel: row → [qStart, qEnd]. */
export const COUNTRY_ROWS: Array<[number, number]> = [
  [3, 4], [2, 4], [1, 4], [1, 4],   // גליל — צר בצפון, מתרחב דרומה
  [1, 4], [1, 3],                   // חיפה והמפרץ
  [1, 3],                           // השרון — רצועת החוף הצרה
  [1, 3], [1, 4],                   // גוש דן
  [1, 4], [1, 4], [1, 4],           // שפלה וירושלים
  [0, 4], [0, 4], [0, 3],           // הנגב — החלק הרחב
  [1, 3], [2, 3], [2, 2], [2, 2],   // הערבה, מתחדד עד אילת
];

export function regionForHex(q: number, r: number): string {
  if (r <= 3) return 'galil';
  if (r <= 5) return 'haifa';
  if (r <= 6) return 'sharon';
  if (r <= 8) return 'tlv';
  if (r <= 11) return q >= 3 ? 'jerusalem' : 'shfela';
  if (r <= 14) return 'negev';
  return 'arava';
}
