// (ROADMAP 11.28) What the pen makes on the car: thirty-five things, eleven or twelve to a category, each
// a real thing a car in an action game could carry - a device on the car; what it does (smoke, an arc of
// electricity, fire, a shield) comes out of it only while it is used, and goes.
//
// Each: its category, its name, the stage of the game it opens at (game/gearplay.js), what it is drawn
// as (the network's classes, game/partnet.js - one drawing, two things: a flame is a flamethrower among
// the weapons and the turbo among what moves), the part it is (game/fuse.js), where it goes on the car,
// its sound, the legend's picture of how it is drawn, what tells it from the one it is nearest to, how it
// is used, its three levels, what one use costs in ink and how long it takes to be ready again.
//
// use: fire - the fire button (every weapon on the car fires); jump - Space / ▲; turbo - Shift / the
// turbo button; rewind - Z / ⟲; guard - B / 🛡 (held: the ejector seat); always - nothing to press.

export const CAT_ORDER = ['weapon', 'func', 'armor'];
export const CAT_NAME = { weapon: 'נשק', func: 'תנועה', armor: 'הגנה' };

export const ITEMS = {
  // ---------------------------------------------------------------- weapons: what fires, fires paint or Tipp-Ex
  mg: {
    cat: 'weapon', name: 'מקלע', stage: 1, cls: ['gun'], type: 'barrel', v: 'front', at: 'hood', snd: 'clank', use: 'fire', ink: 0, cool: 0,
    tell: 'קת = מקלע', does: 'כתמי צבע על השמשה של הניידת',
    lv: ['מקלע', 'זוג מקלעים', 'מיניגאן'],
    icon: '<path d="M2 8 H20 L22 7 V10 H20 V11 H11 L9 15 H6 L7 11 H4 L2 13 Z"/>',
  },
  cannon: {
    cat: 'weapon', name: 'תותח טיפקס', stage: 2, cls: ['cannon'], type: 'barrel', v: 'turret', at: 'roof', snd: 'clank', use: 'fire', ink: 0, cool: 0,
    tell: 'גלגל = תותח', does: 'כדור טיפקס שמוחק את מה שהוא פוגע בו',
    lv: ['תותח', 'מחיקה רחבה', 'טעינה מהירה'],
    icon: '<rect x="4" y="5" width="15" height="6" rx="1" transform="rotate(-18 11 8)"/><circle cx="8" cy="16" r="4.5"/><circle cx="8" cy="16" r="1"/>',
  },
  missiles: {
    cat: 'weapon', name: 'משגר טילים', stage: 3, cls: ['rocket'], type: 'gear', at: 'roof', snd: 'clank', use: 'fire', ink: 6, cool: 2.4,
    tell: 'חוד וכנפונים = טיל', does: 'טיל שננעל על ניידת ומתפוצץ בצבע',
    lv: ['טיל מונחה', 'מטח של שלושה', 'טילים מתפצלים'],
    icon: '<path d="M3 12 L6 9 H16 L21 12 L16 15 H6 Z M6 9 L4 5 H8 L10 9 M6 15 L4 19 H8 L10 15"/>',
  },
  flamer: {
    cat: 'weapon', name: 'להביור', stage: 3, cls: ['flame'], type: 'gear', at: 'nose', snd: 'whoosh', use: 'fire', ink: 0, cool: 0,
    tell: 'להבה = להביור', does: 'אש מהחרטום, ורק כשיורים',
    lv: ['להביור', 'להבה ארוכה', 'להבה רחבה'],
    icon: '<path d="M12 22 C6 22 5 17 7 13 C8 15 9 15 9.5 14 C9 10 11 6 13 2 C13 6 17 8 17.5 12 C18.5 11 18.5 9.5 18 8.5 C21 12 20 22 12 22 Z"/>',
  },
  tesla: {
    cat: 'weapon', name: 'סליל טסלה', stage: 4, cls: ['lightning', 'spring'], type: 'gear', at: 'roof', snd: 'laser', use: 'fire', ink: 5, cool: 1.6,
    tell: 'זיגזג או סליל = טסלה', does: 'קשת חשמל שמכבה לניידת את המנוע',
    lv: ['סליל טסלה', 'טווח כפול', 'שרשרת ברקים'],
    icon: '<path d="M14 2 L6 13 H11 L9 22 L18 10 H13 Z"/>',
  },
  saws: {
    cat: 'weapon', name: 'מסורי גלגלים', stage: 4, cls: ['saw', 'wheel'], type: 'gear', at: 'wheels', snd: 'clank', use: 'fire', ink: 0, cool: 0,
    tell: 'שיניים במעגל = מסור', does: 'להבים יוצאים מהגלגלים וחותכים צמיגים',
    lv: ['מסורים', 'מסורים חדים', 'מסורים ארוכים'],
    icon: '<path d="M12 3 L14 5.2 L17 4.4 L17.6 7.4 L20.5 8.5 L19.4 11.3 L21.3 13.6 L18.8 15.3 L19.1 18.3 L16.1 18.6 L14.8 21.3 L12.3 19.9 L9.7 21.4 L8.4 18.7 L5.4 18.5 L5.6 15.5 L3.1 13.9 L4.9 11.5 L3.7 8.7 L6.6 7.6 L7.1 4.6 L10.1 5.2 Z"/><circle cx="12" cy="12.4" r="2.6"/>',
  },
  mines: {
    cat: 'weapon', name: 'מוקשים', stage: 2, cls: ['mine'], type: 'gear', at: 'tail', snd: 'clank', use: 'fire', ink: 4, cool: 1.4,
    tell: 'כדור עם קוצים = מוקש', does: 'נשאר מאחור ומתפוצץ מתחת לניידת',
    lv: ['מוקש', 'מוקש גדול', 'שלושה מוקשים'],
    icon: '<circle cx="12" cy="13" r="6"/><path d="M12 7 V3 M12 19 V22 M6 13 H2 M18 13 H22 M7.8 8.8 L5 6 M16.2 8.8 L19 6 M7.8 17.2 L5.5 19.5 M16.2 17.2 L18.5 19.5"/>',
  },
  harpoon: {
    cat: 'weapon', name: 'הרפון', stage: 3, cls: ['hook'], type: 'gear', at: 'nose', snd: 'clank', use: 'fire', ink: 4, cool: 2,
    tell: 'וו עם חבל = הרפון', does: 'ננעץ בניידת: מסובבים אותה או גוררים',
    lv: ['הרפון', 'סיבוב לקיר', 'שני הרפונים'],
    icon: '<path d="M4 20 L16 8 M16 8 L20.5 3.5 L19.5 9 Z M16 8 L12.5 7 M16 8 L17 11.5 M4 20 C2.5 21.5 5.5 23 6.5 20.5"/>',
  },
  net: {
    cat: 'weapon', name: 'רשת לכידה', stage: 3, cls: ['net'], type: 'gear', at: 'roof', snd: 'whoosh', use: 'fire', ink: 5, cool: 2.6,
    tell: 'משבצות = רשת', does: 'נופלת על ניידת ועוצרת אותה במקום',
    lv: ['רשת', 'רשת חזקה', 'רשת ענק'],
    icon: '<path d="M4 6 Q12 2 20 6 Q22 12 20 18 Q12 22 4 18 Q2 12 4 6 Z M8.5 4 V20.5 M12 3 V21 M15.5 4 V20.5 M3 9.5 H21 M3 13 H21 M3 16.5 H21"/>',
  },
  wreck: {
    cat: 'weapon', name: 'כדור הריסה', stage: 4, cls: ['wreckball'], type: 'gear', at: 'roof', snd: 'clank', use: 'fire', ink: 3, cool: 1.8,
    tell: 'כדור על שרשרת = הריסה', does: 'מתנדנד לצד ומעיף מכוניות',
    lv: ['כדור הריסה', 'כדור כבד', 'לשני הצדדים'],
    icon: '<path d="M3 21 V8 L14 3 M3 8 H12 M14 3 V10"/><circle cx="14" cy="14.5" r="4.5"/>',
  },
  drone: {
    cat: 'weapon', name: 'רחפן תוקף', stage: 4, cls: ['drone', 'rotor'], type: 'gear', at: 'roof', snd: 'whoosh', use: 'fire', ink: 8, cool: 6,
    tell: 'ארבעה מדחפים = רחפן', does: 'ממריא מהגג, רודף אחרי ניידת ויורה בה',
    lv: ['רחפן', 'רחפן ארוך', 'שני רחפנים'],
    icon: '<path d="M7.5 7.5 L16.5 16.5 M16.5 7.5 L7.5 16.5"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><rect x="10" y="10" width="4" height="4"/>',
  },
  // ---------------------------------------------------------------- what moves it
  wing: {
    cat: 'func', name: 'כנפי מטוס', stage: 3, cls: ['wing'], type: 'wing', at: 'sides', snd: 'flap', use: 'jump', ink: 0, cool: 0,
    tell: 'כנף או מטוס = כנפיים', does: 'במהירות ובקפיצה דואה, ועם טורבו טסה',
    lv: ['דאייה', 'טיסה', 'כנף סילון'],
    icon: '<path d="M12 2 C13 2 13 4 13 6 V9 L22 13 V15 L13 13 V18 L16 20 V21 L12 20 L8 21 V20 L11 18 V13 L2 15 V13 L11 9 V6 C11 4 11 2 12 2 Z"/>',
  },
  rotor: {
    cat: 'func', name: 'מדחף מסוק', stage: 4, cls: ['rotor'], type: 'rotor', at: 'roof', snd: 'whoosh', use: 'jump', ink: 0, cool: 0,
    tell: 'איקס או מסוק = מדחף מסוק', does: 'ממריאה ישר למעלה, מרחפת ונוחתת על גגות',
    lv: ['ריחוף', 'טיסה', 'טיסה מהירה'],
    icon: '<path d="M3 4 L21 20 M21 4 L3 20"/><circle cx="12" cy="12" r="2"/>',
  },
  turbo: {
    cat: 'func', name: 'טורבו', stage: 1, cls: ['flame', 'rocket', 'lightning'], type: 'gear', at: 'tail', snd: 'whoosh', use: 'turbo', ink: 0, cool: 0,
    tell: 'להבה מאחור = טורבו', does: 'מהירות שיא, להבה כחולה מהאגזוז',
    lv: ['ניטרו', 'ניטרו ארוך', 'מנוע סילון'],
    icon: '<path d="M12 22 C6 22 5 17 7 13 C8 15 9 15 9.5 14 C9 10 11 6 13 2 C13 6 17 8 17.5 12 C18.5 11 18.5 9.5 18 8.5 C21 12 20 22 12 22 Z"/>',
  },
  jump: {
    cat: 'func', name: 'קפיצה על־קולית', stage: 2, cls: ['spring'], type: 'gear', at: 'under', snd: 'bounce', use: 'jump', ink: 3, cool: 0.8,
    tell: 'סליל = קפיצה', does: 'המכונית מזנקת למעלה',
    lv: ['הידראוליקה', 'מנועי קפיצה', 'קפיצה על־קולית'],
    icon: '<path d="M5 21 H19 M12 21 C4 19 20 17 12 15 C4 13 20 11 12 9 C4 7 20 5 12 3"/>',
  },
  rewind: {
    cat: 'func', name: 'חזרה בזמן', stage: 5, cls: ['clock'], type: 'gear', at: 'dash', snd: 'magic', use: 'rewind', ink: 12, cool: 10,
    tell: 'שעון = חזרה בזמן', does: 'העולם חוזר כמה שניות אחורה',
    lv: ['3 שניות', '5 שניות', '8 שניות והילוך איטי'],
    icon: '<circle cx="12" cy="13" r="8"/><path d="M12 8.5 V13 H8.5 M3.6 9 A9 9 0 0 1 9 3.9 M3.6 9 L2.8 5.6 M3.6 9 L7 8.6"/>',
  },
  grapple: {
    cat: 'func', name: 'וו טיפוס', stage: 3, cls: ['hook'], type: 'gear', at: 'nose', snd: 'clank', use: 'jump', ink: 3, cool: 1.2,
    tell: 'וו עם חבל = וו טיפוס', does: 'נתפס בקצה גג ומושך את המכונית למעלה',
    lv: ['משיכה', 'טיפוס על קיר', 'נדנוד'],
    icon: '<path d="M12 2 V16 M6 12 C6 18 18 18 18 12 M6 12 L4.5 14.5 M18 12 L19.5 14.5 M12 2 C9 2 8 5 10.5 6"/>',
  },
  monster: {
    cat: 'func', name: 'גלגלי ענק', stage: 3, cls: ['wheel'], type: 'wheel', v: 'big', at: 'wheels', snd: 'bounce', use: 'always', ink: 0, cool: 0,
    tell: 'גלגל = גלגלי ענק', does: 'עולים על מכוניות ומחסומים',
    lv: ['גלגלים גדולים', 'גלגלי ענק', 'דריסה'],
    icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3 V8.5 M12 15.5 V21 M3 12 H8.5 M15.5 12 H21"/>',
  },
  tracks: {
    cat: 'func', name: 'זחלים', stage: 3, cls: ['tracks'], type: 'gear', at: 'wheels', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: 'פס עם גלגלים = זחלים', does: 'עולים במדרגות ובשיפועים, ודוחפים מכוניות',
    lv: ['זחלים', 'זחלים מהירים', 'זחלי דחיפה'],
    icon: '<rect x="2" y="8" width="20" height="9" rx="4.5"/><circle cx="7" cy="12.5" r="2"/><circle cx="12" cy="12.5" r="2"/><circle cx="17" cy="12.5" r="2"/>',
  },
  water: {
    cat: 'func', name: 'ערכת מים', stage: 3, cls: ['boat'], type: 'gear', at: 'under', snd: 'bounce', use: 'always', ink: 0, cool: 0,
    tell: 'סירה = ערכת מים', does: 'שטה במים',
    lv: ['סירה', 'רחפת', 'צוללת'],
    icon: '<path d="M2 13 H22 L18 19 H6 Z M8 13 V9 H15 L17 13"/>',
  },
  chute: {
    cat: 'func', name: 'מצנח', stage: 2, cls: ['parachute'], type: 'chute', at: 'tail', snd: 'flap', use: 'jump', ink: 0, cool: 0,
    tell: 'חוטים = מצנח', does: 'בולם בבת אחת, או מנחית בבטחה מגג',
    lv: ['מצנח בלימה', 'מצנח גדול', 'מצנח מונחה'],
    icon: '<path d="M2 11 C2 3 22 3 22 11 C19 9.5 15 9.5 12 11 C9 9.5 5 9.5 2 11 Z M2 11 L12 21 L22 11 M12 11 V21"/>',
  },
  balloon: {
    cat: 'func', name: 'כדור פורח', stage: 2, cls: ['balloon'], type: 'balloon', at: 'above', snd: 'whoosh', use: 'jump', ink: 0, cool: 0,
    tell: 'סל = כדור פורח', does: 'עלייה איטית לגגות',
    lv: ['כדור פורח', 'כדור גדול', 'כדור עם מבער'],
    icon: '<path d="M12 2 C17 2 20 5 20 9 C20 13 16 15 15 17 H9 C8 15 4 13 4 9 C4 5 7 2 12 2 Z"/><rect x="9" y="19" width="6" height="3.5"/><path d="M9 17 V19 M15 17 V19"/>',
  },
  bridge: {
    cat: 'func', name: 'גשר מתקפל', stage: 4, cls: ['bridge'], type: 'gear', at: 'roof', snd: 'clank', use: 'always', ink: 8, cool: 4,
    tell: 'גשר = גשר מתקפל', does: 'נפרש לבד קדימה כשנוסעים אל פער או נהר',
    lv: ['10 מטר', '18 מטר', '30 מטר'],
    icon: '<path d="M2 10 H22 M2 10 V18 M22 10 V18 M5 18 C5 12.5 19 12.5 19 18 M7 10 V14 M12 10 V13 M17 10 V14"/>',
  },
  // ---------------------------------------------------------------- what keeps it whole
  armor: {
    cat: 'armor', name: 'שריון', stage: 1, cls: ['plate'], type: 'armor', at: 'body', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: 'לוח עם ברגים = שריון', does: 'לוחות פלדה שסופגים צבע, טיפקס ומכות',
    lv: ['לוחות', 'לוחות וסורגים', 'שריון כבד'],
    icon: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12 H20 M12 4 V20"/><circle cx="7" cy="7" r="0.6"/><circle cx="17" cy="7" r="0.6"/><circle cx="7" cy="17" r="0.6"/><circle cx="17" cy="17" r="0.6"/>',
  },
  bullbar: {
    cat: 'armor', name: 'בולבר', stage: 2, cls: ['wedge'], type: 'blade', v: 'ram', at: 'nose', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: 'משולש = בולבר', does: 'מוט פלדה מקדימה שדוחף מכוניות ומחסומים',
    lv: ['מוט דחיפה', 'להב דחפור', 'טריז הפיכה'],
    icon: '<path d="M12 3 L21 20 H3 Z"/>',
  },
  smoke: {
    cat: 'armor', name: 'מסך עשן', stage: 2, cls: ['cloud'], type: 'gear', at: 'tail', snd: 'whoosh', use: 'guard', ink: 5, cool: 8,
    tell: 'ענן = מסך עשן', does: 'עשן סמיך מאחור, והמשטרה מאבדת אתכם',
    lv: ['מסך עשן', 'עשן ארוך', 'עשן כפול'],
    icon: '<path d="M6 19 H18 C21.5 19 22.5 14.5 19.5 13 C20.5 8.5 15.5 7 14 9.5 C13 5 6.5 5.5 7.5 10.5 C3 10.5 2 19 6 19 Z"/>',
  },
  oil: {
    cat: 'armor', name: 'כתם שמן', stage: 2, cls: ['puddle'], type: 'gear', at: 'tail', snd: 'splat', use: 'guard', ink: 4, cool: 5,
    tell: 'שלולית וטיפות = שמן', does: 'מי שרודף אחריכם מחליק ומסתובב',
    lv: ['כתם שמן', 'כתם גדול', 'שני כתמים'],
    icon: '<path d="M3 17 C3 14 8 15 9 13 C10 11 15 12 16 14 C17 16 22 15 21 18 C20 21 4 21 3 17 Z M12 2.5 C12 2.5 9 6.5 9 8.3 C9 9.9 10.4 11 12 11 C13.6 11 15 9.9 15 8.3 C15 6.5 12 2.5 12 2.5 Z"/>',
  },
  rearshield: {
    cat: 'armor', name: 'מגן אחורי', stage: 3, cls: ['barrier'], type: 'gear', at: 'trunk', snd: 'clank', use: 'guard', ink: 4, cool: 6,
    tell: 'מגן = מגן אחורי', does: 'לוח פלדה עולה מהתא ועוצר ירי מאחור',
    lv: ['מגן אחורי', 'מחסום על הכביש', 'מגן כפול'],
    icon: '<path d="M12 2 L20 5 V11 C20 16 16.5 19.5 12 22 C7.5 19.5 4 16 4 11 V5 Z M12 6 V18"/>',
  },
  spikes: {
    cat: 'armor', name: 'קוצים', stage: 3, cls: ['spikes'], type: 'spike', at: 'sides', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: 'שיניים = קוצים', does: 'מי שנתקע בכם נהרס',
    lv: ['קוצים', 'פס קוצים', 'קוצים ארוכים'],
    icon: '<path d="M2 17 L5 7 L8 17 L11 7 L14 17 L17 7 L20 17 L22 11"/>',
  },
  dome: {
    cat: 'armor', name: 'כיפת מגן', stage: 4, cls: ['dome'], type: 'gear', at: 'roof', snd: 'magic', use: 'guard', ink: 8, cool: 14,
    tell: 'כיפה = כיפת מגן', does: 'כיפה שקופה שבולעת כל פגיעה לכמה שניות',
    lv: ['4 שניות', '6 שניות', '9 שניות'],
    icon: '<path d="M2 19 H22 M4 19 C4 8.5 20 8.5 20 19 M7.5 13 C8.5 11.5 10 10.8 11.5 10.6"/>',
  },
  repair: {
    cat: 'armor', name: 'ערכת תיקון', stage: 3, cls: ['wrench'], type: 'gear', at: 'rack', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: 'מפתח או פטיש = תיקון', does: 'מתקנת את המכונית לאט',
    lv: ['תיקון איטי', 'תיקון מהיר', 'תיקון בנסיעה'],
    icon: '<path d="M5.5 18.5 L13 11 M13 11 C11.5 8 13.5 4 17.5 4.2 L15.2 6.6 L17.4 8.8 L19.8 6.5 C20 10.4 16 12.5 13 11 M5.5 18.5 C4.6 19.4 4.6 20.4 5.5 21 C6.3 21.6 7.3 21.4 8 20.6 L13 11"/>',
  },
  repaint: {
    cat: 'armor', name: 'צבע מחדש', stage: 3, cls: ['paint'], type: 'gear', at: 'rack', snd: 'pour', use: 'guard', ink: 6, cool: 20,
    tell: 'מברשת או ספריי = צבע', does: 'המכונית נצבעת מחדש, והמשטרה מחפשת צבע אחר',
    lv: ['רק כשלא רואים', 'כוכב אחד פחות', 'נעלמים'],
    icon: '<rect x="7" y="9" width="10" height="13" rx="2"/><path d="M9 9 V6 H15 V9 M12 6 V4 H15 M18.5 3 L20.5 2 M18.5 5 H21.5 M18.5 7 L20.5 8"/>',
  },
  jammer: {
    cat: 'armor', name: 'משבש קשר', stage: 4, cls: ['antenna'], type: 'gear', at: 'roof', snd: 'radio', use: 'always', ink: 0, cool: 0,
    tell: 'אנטנה וגלים = משבש', does: 'המשטרה לא מזעיקה תגבורת',
    lv: ['בלי תגבורת', 'חיפוש קצר', 'בלי מכ״ם'],
    icon: '<path d="M12 22 V9 M9 22 H15 M12 9 L8.5 13 M12 9 L15.5 13 M7.5 6.5 C10 4.2 14 4.2 16.5 6.5 M4.5 3.8 C9 -0.2 15 -0.2 19.5 3.8"/><circle cx="12" cy="9" r="1"/>',
  },
  eject: {
    cat: 'armor', name: 'כיסא מפלט', stage: 4, cls: ['chair'], type: 'gear', at: 'roof', snd: 'boom', use: 'eject', ink: 6, cool: 30,
    tell: 'כיסא = כיסא מפלט', does: 'הגג נפתח, ואתם עפים למעלה עם מצנח',
    lv: ['כיסא מפלט', 'נחיתה רכה', 'פיצוץ דיו'],
    icon: '<path d="M7 21 V12 H16 V21 M7 12 V4 H12 V12 M19 11 V2.5 M16.2 5.3 L19 2.5 L21.8 5.3"/>',
  },
  decoy: {
    cat: 'armor', name: 'כפיל מצויר', stage: 4, cls: ['car'], type: 'gear', at: 'none', snd: 'magic', use: 'guard', ink: 10, cool: 16,
    tell: 'מכונית = כפיל', does: 'עותק מצויר של המכונית בורח לכיוון אחר',
    lv: ['כפיל', 'כפיל ארוך', 'שני כפילים'],
    icon: '<path d="M2 15 V12 L5 11 L8 7 H16 L19 11 L22 12 V15 Z"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/>',
  },
};

// each category's things, in the order the legend shows them
export const CATS = Object.fromEntries(CAT_ORDER.map((c) => [c, Object.keys(ITEMS).filter((id) => ITEMS[id].cat === c)]));
// (game/gearplay.js) the order they open in: by stage, and within a stage as listed
export const OPEN_ORDER = Object.keys(ITEMS).map((id, i) => [id, ITEMS[id].stage * 100 + i]).sort((a, b) => a[1] - b[1]).map(([id]) => id);
// how each use is pressed: a computer's, a phone's
export const HOW = {
  fire: ['קליק שמאלי', 'כפתור הירי'],
  jump: ['רווח', '▲'],
  turbo: ['Shift', 'כפתור הטורבו'],
  rewind: ['Z', '⟲'],
  guard: ['B', '🛡'],
  eject: ['להחזיק B', 'להחזיק 🛡'],
  always: ['', ''],
};
