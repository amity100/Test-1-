import { tr } from '../core/lang.js';
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
export const CAT_NAME = { weapon: tr('נשק', 'Weapons'), func: tr('תנועה', 'Movement'), armor: tr('הגנה', 'Protection') };

export const ITEMS = {
  // ---------------------------------------------------------------- weapons: what fires, fires paint or Tipp-Ex
  mg: {
    cat: 'weapon', name: tr('מקלע', 'Machine gun'), stage: 1, cls: ['gun'], type: 'barrel', v: 'front', at: 'hood', snd: 'clank', use: 'fire', ink: 0, cool: 0,
    tell: tr('קת = מקלע', 'Stock = machine gun'), does: tr('כתמי צבע על השמשה של הניידת', 'Paint splats on the police car\'s windshield'),
    lv: [tr('מקלע', 'Machine gun'), tr('זוג מקלעים', 'Twin machine guns'), tr('מיניגאן', 'Minigun')],
    icon: '<path d="M2 8 H20 L22 7 V10 H20 V11 H11 L9 15 H6 L7 11 H4 L2 13 Z"/>',
  },
  cannon: {
    cat: 'weapon', name: tr('תותח טיפקס', 'White-out cannon'), stage: 2, cls: ['cannon'], type: 'barrel', v: 'turret', at: 'roof', snd: 'clank', use: 'fire', ink: 0, cool: 0,
    tell: tr('גלגל = תותח', 'Wheel = cannon'), does: tr('כדור טיפקס שמוחק את מה שהוא פוגע בו', 'A white-out ball that erases whatever it hits'),
    lv: [tr('תותח', 'Cannon'), tr('מחיקה רחבה', 'Wide erase'), tr('טעינה מהירה', 'Fast reload')],
    icon: '<rect x="4" y="5" width="15" height="6" rx="1" transform="rotate(-18 11 8)"/><circle cx="8" cy="16" r="4.5"/><circle cx="8" cy="16" r="1"/>',
  },
  missiles: {
    cat: 'weapon', name: tr('משגר טילים', 'Rocket launcher'), stage: 3, cls: ['rocket'], type: 'gear', at: 'roof', snd: 'clank', use: 'fire', ink: 6, cool: 2.4,
    tell: tr('חוד וכנפונים = טיל', 'Tip and fins = rocket'), does: tr('טיל שננעל על ניידת ומתפוצץ בצבע', 'A rocket that locks on to a police car and bursts in paint'),
    lv: [tr('טיל מונחה', 'Guided rocket'), tr('מטח של שלושה', 'A volley of three'), tr('טילים מתפצלים', 'Splitting rockets')],
    icon: '<path d="M3 12 L6 9 H16 L21 12 L16 15 H6 Z M6 9 L4 5 H8 L10 9 M6 15 L4 19 H8 L10 15"/>',
  },
  flamer: {
    cat: 'weapon', name: tr('להביור', 'Flamethrower'), stage: 3, cls: ['flame'], type: 'gear', at: 'nose', snd: 'whoosh', use: 'fire', ink: 0, cool: 0,
    tell: tr('להבה = להביור', 'Flame = flamethrower'), does: tr('אש מהחרטום, ורק כשיורים', 'Fire from the nose, only while firing'),
    lv: [tr('להביור', 'Flamethrower'), tr('להבה ארוכה', 'Long flame'), tr('להבה רחבה', 'Wide flame')],
    icon: '<path d="M12 22 C6 22 5 17 7 13 C8 15 9 15 9.5 14 C9 10 11 6 13 2 C13 6 17 8 17.5 12 C18.5 11 18.5 9.5 18 8.5 C21 12 20 22 12 22 Z"/>',
  },
  tesla: {
    cat: 'weapon', name: tr('סליל טסלה', 'Tesla coil'), stage: 4, cls: ['lightning', 'spring'], type: 'gear', at: 'roof', snd: 'laser', use: 'fire', ink: 5, cool: 1.6,
    tell: tr('זיגזג או סליל = טסלה', 'Zigzag or coil = Tesla'), does: tr('קשת חשמל שמכבה לניידת את המנוע', 'An electric arc that kills the police car\'s engine'),
    lv: [tr('סליל טסלה', 'Tesla coil'), tr('טווח כפול', 'Double range'), tr('שרשרת ברקים', 'Chain lightning')],
    icon: '<path d="M14 2 L6 13 H11 L9 22 L18 10 H13 Z"/>',
  },
  saws: {
    cat: 'weapon', name: tr('מסורי גלגלים', 'Wheel saws'), stage: 4, cls: ['saw', 'wheel'], type: 'gear', at: 'wheels', snd: 'clank', use: 'fire', ink: 0, cool: 0,
    tell: tr('שיניים במעגל = מסור', 'Teeth in a circle = saw'), does: tr('להבים יוצאים מהגלגלים וחותכים צמיגים', 'Blades come out of the wheels and cut tires'),
    lv: [tr('מסורים', 'Saws'), tr('מסורים חדים', 'Sharp saws'), tr('מסורים ארוכים', 'Long saws')],
    icon: '<path d="M12 3 L14 5.2 L17 4.4 L17.6 7.4 L20.5 8.5 L19.4 11.3 L21.3 13.6 L18.8 15.3 L19.1 18.3 L16.1 18.6 L14.8 21.3 L12.3 19.9 L9.7 21.4 L8.4 18.7 L5.4 18.5 L5.6 15.5 L3.1 13.9 L4.9 11.5 L3.7 8.7 L6.6 7.6 L7.1 4.6 L10.1 5.2 Z"/><circle cx="12" cy="12.4" r="2.6"/>',
  },
  mines: {
    cat: 'weapon', name: tr('מוקשים', 'Mines'), stage: 2, cls: ['mine'], type: 'gear', at: 'tail', snd: 'clank', use: 'fire', ink: 4, cool: 1.4,
    tell: tr('כדור עם קוצים = מוקש', 'A ball with spikes = mine'), does: tr('נשאר מאחור ומתפוצץ מתחת לניידת', 'Left behind, it blows up under the police car'),
    lv: [tr('מוקש', 'Mine'), tr('מוקש גדול', 'Big mine'), tr('שלושה מוקשים', 'Three mines')],
    icon: '<circle cx="12" cy="13" r="6"/><path d="M12 7 V3 M12 19 V22 M6 13 H2 M18 13 H22 M7.8 8.8 L5 6 M16.2 8.8 L19 6 M7.8 17.2 L5.5 19.5 M16.2 17.2 L18.5 19.5"/>',
  },
  harpoon: {
    cat: 'weapon', name: tr('הרפון', 'Harpoon'), stage: 3, cls: ['hook'], type: 'gear', at: 'nose', snd: 'clank', use: 'fire', ink: 4, cool: 2,
    tell: tr('וו עם חבל = הרפון', 'A hook with a rope = harpoon'), does: tr('ננעץ בניידת: מסובבים אותה או גוררים', 'Sticks in the police car: spin it or drag it'),
    lv: [tr('הרפון', 'Harpoon'), tr('סיבוב לקיר', 'Swing into the wall'), tr('שני הרפונים', 'Two harpoons')],
    icon: '<path d="M4 20 L16 8 M16 8 L20.5 3.5 L19.5 9 Z M16 8 L12.5 7 M16 8 L17 11.5 M4 20 C2.5 21.5 5.5 23 6.5 20.5"/>',
  },
  net: {
    cat: 'weapon', name: tr('רשת לכידה', 'Capture net'), stage: 3, cls: ['net'], type: 'gear', at: 'roof', snd: 'whoosh', use: 'fire', ink: 5, cool: 2.6,
    tell: tr('משבצות = רשת', 'A grid = net'), does: tr('נופלת על ניידת ועוצרת אותה במקום', 'Falls on a police car and stops it dead'),
    lv: [tr('רשת', 'Net'), tr('רשת חזקה', 'Strong net'), tr('רשת ענק', 'Giant net')],
    icon: '<path d="M4 6 Q12 2 20 6 Q22 12 20 18 Q12 22 4 18 Q2 12 4 6 Z M8.5 4 V20.5 M12 3 V21 M15.5 4 V20.5 M3 9.5 H21 M3 13 H21 M3 16.5 H21"/>',
  },
  wreck: {
    cat: 'weapon', name: tr('כדור הריסה', 'Wrecking ball'), stage: 4, cls: ['wreckball'], type: 'gear', at: 'roof', snd: 'clank', use: 'fire', ink: 3, cool: 1.8,
    tell: tr('כדור על שרשרת = הריסה', 'A ball on a chain = wrecking'), does: tr('מתנדנד לצד ומעיף מכוניות', 'Swings to the side and sends cars flying'),
    lv: [tr('כדור הריסה', 'Wrecking ball'), tr('כדור כבד', 'Heavy ball'), tr('לשני הצדדים', 'Both sides')],
    icon: '<path d="M3 21 V8 L14 3 M3 8 H12 M14 3 V10"/><circle cx="14" cy="14.5" r="4.5"/>',
  },
  drone: {
    cat: 'weapon', name: tr('רחפן תוקף', 'Attack drone'), stage: 4, cls: ['drone', 'rotor'], type: 'gear', at: 'roof', snd: 'whoosh', use: 'fire', ink: 8, cool: 6,
    tell: tr('ארבעה מדחפים = רחפן', 'Four propellers = drone'), does: tr('ממריא מהגג, רודף אחרי ניידת ויורה בה', 'Takes off from the roof, chases a police car and shoots at it'),
    lv: [tr('רחפן', 'Drone'), tr('רחפן ארוך', 'Long-range drone'), tr('שני רחפנים', 'Two drones')],
    icon: '<path d="M7.5 7.5 L16.5 16.5 M16.5 7.5 L7.5 16.5"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><rect x="10" y="10" width="4" height="4"/>',
  },
  // ---------------------------------------------------------------- what moves it
  wing: {
    cat: 'func', name: tr('כנפי מטוס', 'Plane wings'), stage: 3, cls: ['wing'], type: 'wing', at: 'sides', snd: 'flap', use: 'jump', ink: 0, cool: 0,
    tell: tr('כנף או מטוס = כנפיים', 'A wing or a plane = wings'), does: tr('במהירות ובקפיצה דואה, ועם טורבו טסה', 'At speed and in a jump it glides, and with turbo it flies'),
    lv: [tr('דאייה', 'Gliding'), tr('טיסה', 'Flight'), tr('כנף סילון', 'Jet wing')],
    icon: '<path d="M12 2 C13 2 13 4 13 6 V9 L22 13 V15 L13 13 V18 L16 20 V21 L12 20 L8 21 V20 L11 18 V13 L2 15 V13 L11 9 V6 C11 4 11 2 12 2 Z"/>',
  },
  rotor: {
    cat: 'func', name: tr('מדחף מסוק', 'Helicopter rotor'), stage: 4, cls: ['rotor'], type: 'rotor', at: 'roof', snd: 'whoosh', use: 'jump', ink: 0, cool: 0,
    tell: tr('איקס או מסוק = מדחף מסוק', 'An X or a helicopter = helicopter rotor'), does: tr('ממריאה ישר למעלה, מרחפת ונוחתת על גגות', 'Takes off straight up, hovers and lands on rooftops'),
    lv: [tr('ריחוף', 'Hovering'), tr('טיסה', 'Flight'), tr('טיסה מהירה', 'Fast flight')],
    icon: '<path d="M3 4 L21 20 M21 4 L3 20"/><circle cx="12" cy="12" r="2"/>',
  },
  turbo: {
    cat: 'func', name: tr('טורבו', 'Turbo'), stage: 1, cls: ['flame', 'rocket', 'lightning'], type: 'gear', at: 'tail', snd: 'whoosh', use: 'turbo', ink: 0, cool: 0,
    tell: tr('להבה מאחור = טורבו', 'A flame behind = turbo'), does: tr('מהירות שיא, להבה כחולה מהאגזוז', 'Top speed, a blue flame from the exhaust'),
    lv: [tr('ניטרו', 'Nitro'), tr('ניטרו ארוך', 'Long nitro'), tr('מנוע סילון', 'Jet engine')],
    icon: '<path d="M12 22 C6 22 5 17 7 13 C8 15 9 15 9.5 14 C9 10 11 6 13 2 C13 6 17 8 17.5 12 C18.5 11 18.5 9.5 18 8.5 C21 12 20 22 12 22 Z"/>',
  },
  jump: {
    cat: 'func', name: tr('קפיצה על־קולית', 'Supersonic leap'), stage: 2, cls: ['spring'], type: 'gear', at: 'under', snd: 'bounce', use: 'jump', ink: 3, cool: 0.8,
    tell: tr('סליל = קפיצה', 'A coil = jump'), does: tr('המכונית מזנקת למעלה', 'The car leaps up'),
    lv: [tr('הידראוליקה', 'Hydraulics'), tr('מנועי קפיצה', 'Jump engines'), tr('קפיצה על־קולית', 'Supersonic leap')],
    icon: '<path d="M5 21 H19 M12 21 C4 19 20 17 12 15 C4 13 20 11 12 9 C4 7 20 5 12 3"/>',
  },
  rewind: {
    cat: 'func', name: tr('חזרה בזמן', 'Rewind'), stage: 5, cls: ['clock'], type: 'gear', at: 'dash', snd: 'magic', use: 'rewind', ink: 12, cool: 10,
    tell: tr('שעון = חזרה בזמן', 'A clock = rewind'), does: tr('העולם חוזר כמה שניות אחורה', 'The world goes back a few seconds'),
    lv: [tr('3 שניות', '3 seconds'), tr('5 שניות', '5 seconds'), tr('8 שניות והילוך איטי', '8 seconds and slow motion')],
    icon: '<circle cx="12" cy="13" r="8"/><path d="M12 8.5 V13 H8.5 M3.6 9 A9 9 0 0 1 9 3.9 M3.6 9 L2.8 5.6 M3.6 9 L7 8.6"/>',
  },
  grapple: {
    cat: 'func', name: tr('וו טיפוס', 'Grappling hook'), stage: 3, cls: ['hook'], type: 'gear', at: 'nose', snd: 'clank', use: 'jump', ink: 3, cool: 1.2,
    tell: tr('וו עם חבל = וו טיפוס', 'A hook with a rope = grappling hook'), does: tr('נתפס בקצה גג ומושך את המכונית למעלה', 'Catches the edge of a roof and pulls the car up'),
    lv: [tr('משיכה', 'Pull'), tr('טיפוס על קיר', 'Wall climbing'), tr('נדנוד', 'Swing')],
    icon: '<path d="M12 2 V16 M6 12 C6 18 18 18 18 12 M6 12 L4.5 14.5 M18 12 L19.5 14.5 M12 2 C9 2 8 5 10.5 6"/>',
  },
  monster: {
    cat: 'func', name: tr('גלגלי ענק', 'Monster wheels'), stage: 3, cls: ['wheel'], type: 'wheel', v: 'big', at: 'wheels', snd: 'bounce', use: 'always', ink: 0, cool: 0,
    tell: tr('גלגל = גלגלי ענק', 'A wheel = monster wheels'), does: tr('עולים על מכוניות ומחסומים', 'Drive over cars and roadblocks'),
    lv: [tr('גלגלים גדולים', 'Big wheels'), tr('גלגלי ענק', 'Monster wheels'), tr('דריסה', 'Crushing')],
    icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3 V8.5 M12 15.5 V21 M3 12 H8.5 M15.5 12 H21"/>',
  },
  tracks: {
    cat: 'func', name: tr('זחלים', 'Tracks'), stage: 3, cls: ['tracks'], type: 'gear', at: 'wheels', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: tr('פס עם גלגלים = זחלים', 'A belt with wheels = tracks'), does: tr('עולים במדרגות ובשיפועים, ודוחפים מכוניות', 'Climb stairs and slopes, and push cars'),
    lv: [tr('זחלים', 'Tracks'), tr('זחלים מהירים', 'Fast tracks'), tr('זחלי דחיפה', 'Pushing tracks')],
    icon: '<rect x="2" y="8" width="20" height="9" rx="4.5"/><circle cx="7" cy="12.5" r="2"/><circle cx="12" cy="12.5" r="2"/><circle cx="17" cy="12.5" r="2"/>',
  },
  water: {
    cat: 'func', name: tr('ערכת מים', 'Water kit'), stage: 3, cls: ['boat'], type: 'gear', at: 'under', snd: 'bounce', use: 'always', ink: 0, cool: 0,
    tell: tr('סירה = ערכת מים', 'A boat = water kit'), does: tr('שטה במים', 'Sails on water'),
    lv: [tr('סירה', 'Boat'), tr('רחפת', 'Hovercraft'), tr('צוללת', 'Submarine')],
    icon: '<path d="M2 13 H22 L18 19 H6 Z M8 13 V9 H15 L17 13"/>',
  },
  chute: {
    cat: 'func', name: tr('מצנח', 'Parachute'), stage: 2, cls: ['parachute'], type: 'chute', at: 'tail', snd: 'flap', use: 'jump', ink: 0, cool: 0,
    tell: tr('חוטים = מצנח', 'Strings = parachute'), does: tr('בולם בבת אחת, או מנחית בבטחה מגג', 'Brakes all at once, or lands you safely from a roof'),
    lv: [tr('מצנח בלימה', 'Brake chute'), tr('מצנח גדול', 'Big parachute'), tr('מצנח מונחה', 'Steerable parachute')],
    icon: '<path d="M2 11 C2 3 22 3 22 11 C19 9.5 15 9.5 12 11 C9 9.5 5 9.5 2 11 Z M2 11 L12 21 L22 11 M12 11 V21"/>',
  },
  balloon: {
    cat: 'func', name: tr('כדור פורח', 'Hot-air balloon'), stage: 2, cls: ['balloon'], type: 'balloon', at: 'above', snd: 'whoosh', use: 'jump', ink: 0, cool: 0,
    tell: tr('סל = כדור פורח', 'A basket = hot-air balloon'), does: tr('עלייה איטית לגגות', 'A slow climb to the rooftops'),
    lv: [tr('כדור פורח', 'Hot-air balloon'), tr('כדור גדול', 'Big balloon'), tr('כדור עם מבער', 'Balloon with a burner')],
    icon: '<path d="M12 2 C17 2 20 5 20 9 C20 13 16 15 15 17 H9 C8 15 4 13 4 9 C4 5 7 2 12 2 Z"/><rect x="9" y="19" width="6" height="3.5"/><path d="M9 17 V19 M15 17 V19"/>',
  },
  bridge: {
    cat: 'func', name: tr('גשר מתקפל', 'Folding bridge'), stage: 4, cls: ['bridge'], type: 'gear', at: 'roof', snd: 'clank', use: 'always', ink: 8, cool: 4,
    tell: tr('גשר = גשר מתקפל', 'A bridge = folding bridge'), does: tr('נפרש לבד קדימה כשנוסעים אל פער או נהר', 'Unfolds forward by itself when you drive at a gap or a river'),
    lv: [tr('10 מטר', '10 meters'), tr('18 מטר', '18 meters'), tr('30 מטר', '30 meters')],
    icon: '<path d="M2 10 H22 M2 10 V18 M22 10 V18 M5 18 C5 12.5 19 12.5 19 18 M7 10 V14 M12 10 V13 M17 10 V14"/>',
  },
  // ---------------------------------------------------------------- what keeps it whole
  armor: {
    cat: 'armor', name: tr('שריון', 'Armor'), stage: 1, cls: ['plate'], type: 'armor', at: 'body', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: tr('לוח עם ברגים = שריון', 'A plate with bolts = armor'), does: tr('לוחות פלדה שסופגים צבע, טיפקס ומכות', 'Steel plates that soak up paint, white-out and hits'),
    lv: [tr('לוחות', 'Plates'), tr('לוחות וסורגים', 'Plates and bars'), tr('שריון כבד', 'Heavy armor')],
    icon: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12 H20 M12 4 V20"/><circle cx="7" cy="7" r="0.6"/><circle cx="17" cy="7" r="0.6"/><circle cx="7" cy="17" r="0.6"/><circle cx="17" cy="17" r="0.6"/>',
  },
  bullbar: {
    cat: 'armor', name: tr('בולבר', 'Bull bar'), stage: 2, cls: ['wedge'], type: 'blade', v: 'ram', at: 'nose', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: tr('משולש = בולבר', 'A triangle = bull bar'), does: tr('מוט פלדה מקדימה שדוחף מכוניות ומחסומים', 'A steel bar in front that pushes cars and roadblocks'),
    lv: [tr('מוט דחיפה', 'Push bar'), tr('להב דחפור', 'Bulldozer blade'), tr('טריז הפיכה', 'Flipping wedge')],
    icon: '<path d="M12 3 L21 20 H3 Z"/>',
  },
  smoke: {
    cat: 'armor', name: tr('מסך עשן', 'Smoke screen'), stage: 2, cls: ['cloud'], type: 'gear', at: 'tail', snd: 'whoosh', use: 'guard', ink: 5, cool: 8,
    tell: tr('ענן = מסך עשן', 'A cloud = smoke screen'), does: tr('עשן סמיך מאחור, והמשטרה מאבדת אתכם', 'Thick smoke behind, and the police lose you'),
    lv: [tr('מסך עשן', 'Smoke screen'), tr('עשן ארוך', 'Long smoke'), tr('עשן כפול', 'Double smoke')],
    icon: '<path d="M6 19 H18 C21.5 19 22.5 14.5 19.5 13 C20.5 8.5 15.5 7 14 9.5 C13 5 6.5 5.5 7.5 10.5 C3 10.5 2 19 6 19 Z"/>',
  },
  oil: {
    cat: 'armor', name: tr('כתם שמן', 'Oil slick'), stage: 2, cls: ['puddle'], type: 'gear', at: 'tail', snd: 'splat', use: 'guard', ink: 4, cool: 5,
    tell: tr('שלולית וטיפות = שמן', 'A puddle and drops = oil'), does: tr('מי שרודף אחריכם מחליק ומסתובב', 'Whoever\'s chasing you slides and spins out'),
    lv: [tr('כתם שמן', 'Oil slick'), tr('כתם גדול', 'Big slick'), tr('שני כתמים', 'Two slicks')],
    icon: '<path d="M3 17 C3 14 8 15 9 13 C10 11 15 12 16 14 C17 16 22 15 21 18 C20 21 4 21 3 17 Z M12 2.5 C12 2.5 9 6.5 9 8.3 C9 9.9 10.4 11 12 11 C13.6 11 15 9.9 15 8.3 C15 6.5 12 2.5 12 2.5 Z"/>',
  },
  rearshield: {
    cat: 'armor', name: tr('מגן אחורי', 'Rear shield'), stage: 3, cls: ['barrier'], type: 'gear', at: 'trunk', snd: 'clank', use: 'guard', ink: 4, cool: 6,
    tell: tr('מגן = מגן אחורי', 'A shield = rear shield'), does: tr('לוח פלדה עולה מהתא ועוצר ירי מאחור', 'A steel plate rises from the trunk and stops fire from behind'),
    lv: [tr('מגן אחורי', 'Rear shield'), tr('מחסום על הכביש', 'A roadblock on the road'), tr('מגן כפול', 'Double shield')],
    icon: '<path d="M12 2 L20 5 V11 C20 16 16.5 19.5 12 22 C7.5 19.5 4 16 4 11 V5 Z M12 6 V18"/>',
  },
  spikes: {
    cat: 'armor', name: tr('קוצים', 'Spikes'), stage: 3, cls: ['spikes'], type: 'spike', at: 'sides', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: tr('שיניים = קוצים', 'Teeth = spikes'), does: tr('מי שנתקע בכם נהרס', 'Whoever crashes into you gets wrecked'),
    lv: [tr('קוצים', 'Spikes'), tr('פס קוצים', 'Spike strip'), tr('קוצים ארוכים', 'Long spikes')],
    icon: '<path d="M2 17 L5 7 L8 17 L11 7 L14 17 L17 7 L20 17 L22 11"/>',
  },
  dome: {
    cat: 'armor', name: tr('כיפת מגן', 'Shield dome'), stage: 4, cls: ['dome'], type: 'gear', at: 'roof', snd: 'magic', use: 'guard', ink: 8, cool: 14,
    tell: tr('כיפה = כיפת מגן', 'A dome = shield dome'), does: tr('כיפה שקופה שבולעת כל פגיעה לכמה שניות', 'A see-through dome that swallows every hit for a few seconds'),
    lv: [tr('4 שניות', '4 seconds'), tr('6 שניות', '6 seconds'), tr('9 שניות', '9 seconds')],
    icon: '<path d="M2 19 H22 M4 19 C4 8.5 20 8.5 20 19 M7.5 13 C8.5 11.5 10 10.8 11.5 10.6"/>',
  },
  repair: {
    cat: 'armor', name: tr('ערכת תיקון', 'Repair kit'), stage: 3, cls: ['wrench'], type: 'gear', at: 'rack', snd: 'clank', use: 'always', ink: 0, cool: 0,
    tell: tr('מפתח או פטיש = תיקון', 'A wrench or a hammer = repair'), does: tr('מתקנת את המכונית לאט', 'Slowly repairs the car'),
    lv: [tr('תיקון איטי', 'Slow repair'), tr('תיקון מהיר', 'Fast repair'), tr('תיקון בנסיעה', 'Repair on the go')],
    icon: '<path d="M5.5 18.5 L13 11 M13 11 C11.5 8 13.5 4 17.5 4.2 L15.2 6.6 L17.4 8.8 L19.8 6.5 C20 10.4 16 12.5 13 11 M5.5 18.5 C4.6 19.4 4.6 20.4 5.5 21 C6.3 21.6 7.3 21.4 8 20.6 L13 11"/>',
  },
  repaint: {
    cat: 'armor', name: tr('צבע מחדש', 'Respray'), stage: 3, cls: ['paint'], type: 'gear', at: 'rack', snd: 'pour', use: 'guard', ink: 6, cool: 20,
    tell: tr('מברשת או ספריי = צבע', 'A brush or a spray can = paint'), does: tr('המכונית נצבעת מחדש, והמשטרה מחפשת צבע אחר', 'The car gets a new paint job, and the police look for a different color'),
    lv: [tr('רק כשלא רואים', 'Only when unseen'), tr('כוכב אחד פחות', 'One star less'), tr('נעלמים', 'Vanish')],
    icon: '<rect x="7" y="9" width="10" height="13" rx="2"/><path d="M9 9 V6 H15 V9 M12 6 V4 H15 M18.5 3 L20.5 2 M18.5 5 H21.5 M18.5 7 L20.5 8"/>',
  },
  jammer: {
    cat: 'armor', name: tr('משבש קשר', 'Radio jammer'), stage: 4, cls: ['antenna'], type: 'gear', at: 'roof', snd: 'radio', use: 'always', ink: 0, cool: 0,
    tell: tr('אנטנה וגלים = משבש', 'An antenna and waves = jammer'), does: tr('המשטרה לא מזעיקה תגבורת', 'The police can\'t call for backup'),
    lv: [tr('בלי תגבורת', 'No backup'), tr('חיפוש קצר', 'Short search'), tr('בלי מכ״ם', 'No radar')],
    icon: '<path d="M12 22 V9 M9 22 H15 M12 9 L8.5 13 M12 9 L15.5 13 M7.5 6.5 C10 4.2 14 4.2 16.5 6.5 M4.5 3.8 C9 -0.2 15 -0.2 19.5 3.8"/><circle cx="12" cy="9" r="1"/>',
  },
  eject: {
    cat: 'armor', name: tr('כיסא מפלט', 'Ejector seat'), stage: 4, cls: ['chair'], type: 'gear', at: 'roof', snd: 'boom', use: 'eject', ink: 6, cool: 30,
    tell: tr('כיסא = כיסא מפלט', 'A chair = ejector seat'), does: tr('הגג נפתח, ואתם עפים למעלה עם מצנח', 'The roof opens and you fly up with a parachute'),
    lv: [tr('כיסא מפלט', 'Ejector seat'), tr('נחיתה רכה', 'Soft landing'), tr('פיצוץ דיו', 'Ink blast')],
    icon: '<path d="M7 21 V12 H16 V21 M7 12 V4 H12 V12 M19 11 V2.5 M16.2 5.3 L19 2.5 L21.8 5.3"/>',
  },
  decoy: {
    cat: 'armor', name: tr('כפיל מצויר', 'Drawn decoy'), stage: 4, cls: ['car'], type: 'gear', at: 'none', snd: 'magic', use: 'guard', ink: 10, cool: 16,
    tell: tr('מכונית = כפיל', 'A car = decoy'), does: tr('עותק מצויר של המכונית בורח לכיוון אחר', 'A drawn copy of the car runs off in another direction'),
    lv: [tr('כפיל', 'Decoy'), tr('כפיל ארוך', 'Long decoy'), tr('שני כפילים', 'Two decoys')],
    icon: '<path d="M2 15 V12 L5 11 L8 7 H16 L19 11 L22 12 V15 Z"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/>',
  },
};

// each category's things, in the order the legend shows them
export const CATS = Object.fromEntries(CAT_ORDER.map((c) => [c, Object.keys(ITEMS).filter((id) => ITEMS[id].cat === c)]));
// (game/gearplay.js) the order they open in: by stage, and within a stage as listed
export const OPEN_ORDER = Object.keys(ITEMS).map((id, i) => [id, ITEMS[id].stage * 100 + i]).sort((a, b) => a[1] - b[1]).map(([id]) => id);
// how each use is pressed: a computer's, a phone's
export const HOW = {
  fire: [tr('קליק שמאלי', 'Left click'), tr('כפתור הירי', 'The fire button')],
  jump: [tr('רווח', 'Space'), '▲'],
  turbo: ['Shift', tr('כפתור הטורבו', 'The turbo button')],
  rewind: ['Z', '⟲'],
  guard: ['B', '🛡'],
  eject: [tr('להחזיק B', 'Hold B'), tr('להחזיק 🛡', 'Hold 🛡')],
  always: ['', ''],
};
