// Drawing templates ("blueprints") the player photographs on billboards and redraws.
// Coordinates: x 0..100 to the right, y down. Items face right (muzzle / front at high x).

import { Sketcher } from '../render/sketch2d.js';
import { tr } from '../core/lang.js';

const PI = Math.PI;

function circle(cx, cy, r, n = 18) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * PI * 2;
    pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return pts;
}

function ellipse(cx, cy, rx, ry, n = 24, a0 = 0, a1 = PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return pts;
}

function close(pts) {
  return [...pts, pts[0]];
}

function stadium(x0, y0, x1, y1) {
  const r = (y1 - y0) / 2;
  const cy = y0 + r;
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = PI * 0.5 + (i / 8) * PI;
    pts.push([x0 + r + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  for (let i = 0; i <= 8; i++) {
    const t = -PI * 0.5 + (i / 8) * PI;
    pts.push([x1 - r + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  pts.push(pts[0]);
  return pts;
}

export const BLUEPRINTS = {
  paint: {
    id: 'paint',
    name: tr('אקדח צבע', 'Paint gun'),
    nameEn: 'PAINT BLASTER',
    kind: 'weapon',
    difficulty: 1,
    desc: tr('יורה בלוני צבע צבעוניים. קל לצייר.', 'Fires colorful paint balloons. Easy to draw.'),
    strokes: [
      { label: tr('גוף וקת', 'Body'), en: 'body', pts: close([[0, 31.2], [92.1, 31.2], [100, 36.4], [100, 47], [42.1, 47], [34.2, 83.8], [15.8, 83.8], [23.7, 47], [0, 47]]) },
      { label: tr('מיכל צבע', 'paint tank'), en: 'paint tank', pts: close([[69.7, 14.1], [68.3, 20.4], [64.3, 25.4], [58.4, 28.2], [52.1, 28.2], [46.2, 25.4], [42.2, 20.4], [40.8, 14.1], [42.2, 7.8], [46.2, 2.8], [52.1, 0], [58.4, 0], [64.3, 2.8], [68.3, 7.8]]) },
    ],
    fills: [
      { poly: [[0, 31.2], [92.1, 31.2], [100, 36.4], [100, 47], [42.1, 47], [34.2, 83.8], [15.8, 83.8], [23.7, 47], [0, 47]], color: '#d99a7e' },
      { poly: [[69.7, 14.1], [68.3, 20.4], [64.3, 25.4], [58.4, 28.2], [52.1, 28.2], [46.2, 25.4], [42.2, 20.4], [40.8, 14.1], [42.2, 7.8], [46.2, 2.8], [52.1, 0], [58.4, 0], [64.3, 2.8], [68.3, 7.8]], color: '#93b4dc' },
    ],
    anchors: { muzzle: [66, 36], grip: [24, 52] },
    scale: 0.85,
  },
  rifle: {
    id: 'rifle',
    name: tr('רובה עפרונות', 'Pencil rifle'),
    nameEn: 'PENCIL RIFLE',
    kind: 'weapon',
    difficulty: 2,
    desc: tr('יורה עפרונות עם מחק שמוחקים חלקים מהאויבים.', 'Fires pencils with erasers that erase parts of enemies.'),
    strokes: [
      { label: tr('גוף, קת וקנה', 'Body'), en: 'body', pts: close([[0, 34], [14, 29], [48, 29], [52, 33], [92, 33], [100, 36], [92, 39], [52, 39], [48, 43], [24, 43], [20, 54], [12, 54], [14, 43], [0, 47]]) },
      { label: tr('כוונת', 'scope'), en: 'scope', pts: close([[20, 19], [46, 19], [46, 25], [20, 25]]) },
    ],
    fills: [
      { poly: [[0, 34], [14, 29], [48, 29], [52, 33], [92, 33], [100, 36], [92, 39], [52, 39], [48, 43], [24, 43], [20, 54], [12, 54], [14, 43], [0, 47]], color: '#c4a27e' },
      { poly: [[20, 19], [46, 19], [46, 25], [20, 25]], color: '#ecd27a' },
    ],
    anchors: { muzzle: [96, 34], grip: [22, 48] },
    scale: 1.25,
  },
  car: {
    id: 'car',
    name: tr('סקריבל 1', 'Scribble One'),
    nameEn: 'SCRIBBLE ONE',
    kind: 'vehicle',
    difficulty: 2,
    desc: tr('נוהגים בה ברחבי העיר ודורסים אויבים.', 'Drive it around the city and run over enemies.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 53.2], [0, 44.8], [3.7, 40.5], [18.7, 38.9], [31.2, 33.1], [50, 32.5], [57.5, 34.7], [65, 40.7], [92.5, 44.3], [100, 47.5], [100, 53.2]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[27.7, 50.3], [26.9, 53.6], [24.8, 56.3], [21.7, 57.8], [18.3, 57.8], [15.2, 56.3], [13.1, 53.6], [12.3, 50.3], [13.1, 47], [15.2, 44.3], [18.3, 42.8], [21.7, 42.8], [24.8, 44.3], [26.9, 47]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[86.7, 50.3], [85.9, 53.6], [83.8, 56.3], [80.7, 57.8], [77.3, 57.8], [74.2, 56.3], [72.1, 53.6], [71.3, 50.3], [72.1, 47], [74.2, 44.3], [77.3, 42.8], [80.7, 42.8], [83.8, 44.3], [85.9, 47]]) },
    ],
    fills: [
      { poly: [[0, 53.2], [0, 44.8], [3.7, 40.5], [18.7, 38.9], [31.2, 33.1], [50, 32.5], [57.5, 34.7], [65, 40.7], [92.5, 44.3], [100, 47.5], [100, 53.2]], color: '#cf8a82' },
      { poly: [[27.7, 50.3], [26.9, 53.6], [24.8, 56.3], [21.7, 57.8], [18.3, 57.8], [15.2, 56.3], [13.1, 53.6], [12.3, 50.3], [13.1, 47], [15.2, 44.3], [18.3, 42.8], [21.7, 42.8], [24.8, 44.3], [26.9, 47]], color: '#c3d6ea' },
      { poly: [[86.7, 50.3], [85.9, 53.6], [83.8, 56.3], [80.7, 57.8], [77.3, 57.8], [74.2, 56.3], [72.1, 53.6], [71.3, 50.3], [72.1, 47], [74.2, 44.3], [77.3, 42.8], [80.7, 42.8], [83.8, 44.3], [85.9, 47]], color: '#c3d6ea' },
    ],
    wheels: [[26, 48, 8], [74, 48, 8]],
    scale: 4.4,
  },
  bazooka: {
    id: 'bazooka',
    name: tr('RL-7 מחק', 'RL-7 Eraser'),
    nameEn: 'RL-7 ERASER',
    kind: 'weapon',
    difficulty: 3,
    desc: tr('משגרת מחק ענק שמוחק כל מה שמסביב.', 'Launches a giant eraser that erases everything around.'),
    strokes: [
      { label: tr('צינור וראש', 'Tube'), en: 'tube', pts: close([[0, 22], [10, 26], [66, 26], [72, 20], [84, 20], [100, 32], [84, 44], [72, 44], [66, 38], [10, 38], [0, 42]]) },
      { label: tr('ידית', 'grip'), en: 'grip', pts: [[34, 38], [30, 58], [44, 58], [46, 38]] },
    ],
    fills: [
      { poly: [[0, 22], [10, 26], [66, 26], [72, 20], [84, 20], [100, 32], [84, 44], [72, 44], [66, 38], [10, 38], [0, 42]], color: '#9fb98c' },
    ],
    anchors: { muzzle: [90, 35], grip: [28, 50] },
    scale: 1.55,
  },
  tank: {
    id: 'tank',
    name: tr('טנק מטורף', 'Crazy Tank'),
    nameEn: 'CRAZY TANK',
    kind: 'vehicle',
    difficulty: 4,
    desc: tr('טנק משוריין עם תותח מחקים. כמעט בלתי ניתן לעצירה.', 'An armored tank with an eraser cannon. Almost unstoppable.'),
    strokes: [
      { label: tr('זחל', 'Track'), en: 'track', pts: stadium(6, 54, 94, 72) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(18, 63, 5.5, 12) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(34, 63, 5.5, 12) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(50, 63, 5.5, 12) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(66, 63, 5.5, 12) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(82, 63, 5.5, 12) },
      { label: tr('שלדה', 'Chassis'), en: 'hull', pts: [[10, 54], [16, 44], [84, 44], [90, 54]] },
      { label: tr('צריח', 'turret'), en: 'turret', pts: [[30, 44], [34, 32], [60, 32], [64, 44]] },
      { label: tr('קנה', 'Barrel'), en: 'barrel', pts: [[60, 35], [96, 35], [96, 40], [62, 40]] },
      { label: tr('פתח עליון', 'hatch'), en: 'hatch', pts: [[40, 32], [42, 27], [52, 27], [54, 32]] },
      { label: tr('אנטנה', 'antenna'), en: 'antenna', pts: [[38, 27], [32, 8]] },
      { label: tr('דגל', 'flag'), en: 'flag', pts: [[32, 8], [44, 11], [33, 15]] },
      { label: tr('מחרשה', 'plow'), en: 'plow', pts: [[90, 54], [98, 50], [94, 58], [99, 64], [92, 68]] },
    ],
    fills: [
      { poly: stadium(6, 54, 94, 72), color: '#85858f' },
      { poly: [[10, 54], [16, 44], [84, 44], [90, 54]], color: '#a8b67e' },
      { poly: [[30, 44], [34, 32], [60, 32], [64, 44]], color: '#98a870' },
      { poly: [[60, 35], [96, 35], [96, 40], [62, 40]], color: '#7c8566' },
      { poly: [[32, 8], [44, 11], [33, 15]], color: '#cf8a82' },
    ],
    wheels: [[18, 63, 5.5], [34, 63, 5.5], [50, 63, 5.5], [66, 63, 5.5], [82, 63, 5.5]],
    anchors: { muzzle: [96, 37.5], turret: [47, 38] },
    scale: 7.2,
  },
  // ------------------------------------------------------------------ the new arsenal
  shotgun: {
    id: 'shotgun',
    name: tr('רובה ציד צבעוני', 'Colorful shotgun'),
    nameEn: 'CRAYON SHOTGUN',
    kind: 'weapon',
    difficulty: 2,
    desc: tr('יורה מטח של שמונה עפרונות שעווה. הורס מקרוב.', 'Fires a volley of eight wax crayons. Devastating up close.'),
    strokes: [
      { label: tr('גוף, קת וקנה', 'Body'), en: 'body', pts: close([[0, 40], [18, 30], [44, 28], [100, 28], [100, 33], [60, 33], [60, 38], [40, 38], [36, 36], [22, 40], [6, 50], [0, 48]]) },
      { label: tr('ידית דריכה', 'pump'), en: 'pump', pts: close([[62, 34], [84, 34], [84, 39], [62, 39]]) },
    ],
    fills: [
      { poly: [[0, 40], [18, 30], [44, 28], [100, 28], [100, 33], [60, 33], [60, 38], [40, 38], [36, 36], [22, 40], [6, 50], [0, 48]], color: '#c27a4a' },
      { poly: [[62, 34], [84, 34], [84, 39], [62, 39]], color: '#7c8190' },
    ],
    anchors: { muzzle: [99, 35], grip: [46, 54] },
    scale: 1.25,
    thickness: 0.05,
  },
  stapler: {
    id: 'stapler',
    name: tr('אקדח שדכן', 'Stapler pistol'),
    nameEn: 'STAPLE GUN',
    kind: 'weapon',
    difficulty: 1,
    desc: tr('מכונת יריה של סיכות. כל סיכה מסמררת את האויב למקום לרגע.', 'A staple machine gun. Every staple pins the enemy in place for a moment.'),
    strokes: [
      { label: tr('גוף וידית', 'Body'), en: 'body', pts: close([[2, 36], [14, 24], [90, 24], [98, 32], [90, 42], [40, 42], [36, 58], [24, 58], [26, 42], [8, 42]]) },
      { label: tr('מסילת סיכות', 'staple rail'), en: 'staple rail', pts: [[30, 33], [88, 33]] },
    ],
    fills: [
      { poly: [[2, 36], [14, 24], [90, 24], [98, 32], [90, 42], [40, 42], [36, 58], [24, 58], [26, 42], [8, 42]], color: '#d23c46' },
    ],
    anchors: { muzzle: [90, 33], grip: [34, 60] },
    scale: 0.72,
    thickness: 0.05,
  },
  katana: {
    id: 'katana',
    name: tr('חרב סרגל', 'Ruler sword'),
    nameEn: 'RULER KATANA',
    kind: 'weapon',
    difficulty: 2,
    desc: tr('סרגל של שלושים סנטימטר שהושחז לחרב. חותך גפיים במכה אחת.', 'A thirty-centimeter ruler sharpened into a sword. Cuts off limbs in one blow.'),
    strokes: [
      { label: tr('להב', 'Blade'), en: 'blade', pts: close([[22, 27], [92, 27], [100, 31], [92, 35], [22, 35]]) },
      { label: tr('מגן יד', 'guard'), en: 'guard', pts: [[20, 20], [20, 42]] },
      { label: tr('ידית', 'handle'), en: 'handle', pts: close([[0, 28], [20, 28], [20, 34], [0, 34]]) },
    ],
    fills: [
      { poly: [[22, 27], [92, 27], [100, 31], [92, 35], [22, 35]], color: '#f3df8a' },
      { poly: [[0, 28], [20, 28], [20, 34], [0, 34]], color: '#2c2d36' },
    ],
    anchors: { grip: [14, 34], tip: [98, 34] },
    scale: 1.3,
    thickness: 0.02,
  },
  planes: {
    id: 'planes',
    name: tr('משגר מטוסי נייר', 'Paper plane launcher'),
    nameEn: 'PAPER PLANE LAUNCHER',
    kind: 'weapon',
    difficulty: 3,
    desc: tr('משגר מטוסי נייר מתבייתים שמוצאים את האויב לבד ומתפוצצים בקונפטי.', 'Launches homing paper planes that find the enemy by themselves and burst into confetti.'),
    strokes: [
      { label: tr('גוף וידית', 'Body'), en: 'body', pts: close([[0, 30], [20, 28], [60, 28], [60, 24], [88, 24], [88, 40], [60, 40], [56, 44], [40, 44], [36, 58], [26, 58], [28, 42], [0, 44]]) },
      { label: tr('מטוס נייר', 'paper plane'), en: 'paper plane', pts: close([[86, 32], [100, 27], [93, 32], [100, 37]]) },
    ],
    fills: [
      { poly: [[0, 30], [20, 28], [60, 28], [60, 24], [88, 24], [88, 40], [60, 40], [56, 44], [40, 44], [36, 58], [26, 58], [28, 42], [0, 44]], color: '#5f86b8' },
      { poly: [[86, 32], [100, 27], [93, 32], [100, 37]], color: '#47689a' },
    ],
    anchors: { muzzle: [97, 42], grip: [26, 61] },
    scale: 1.4,
    thickness: 0.07,
  },
  inkbomb: {
    id: 'inkbomb',
    name: tr('רימון דיו', 'Ink grenade'),
    nameEn: 'INK GRENADE',
    kind: 'weapon',
    difficulty: 2,
    desc: tr('בקבוק דיו עם פתיל. זורקים, והוא מתפוצץ בכתם ענק שמוחק את כל מי שבסביבה.', 'An ink bottle with a fuse. Throw it, and it bursts into a giant blot that erases everyone around.'),
    strokes: [
      { label: tr('בקבוק', 'Bottle'), en: 'bottle', pts: close([[5.7, 28.6], [62.9, 28.6], [68.6, 37.1], [68.6, 100], [0, 100], [0, 37.1]]) },
      { label: tr('פקק', 'cap'), en: 'cap', pts: [[22.9, 28.6], [22.9, 14.3], [45.7, 14.3], [45.7, 28.6]] },
      { label: tr('פתיל', 'fuse'), en: 'fuse', pts: [[34.3, 14.3], [40, 4.3], [51.4, 0]] },
    ],
    fills: [
      { poly: [[5.7, 28.6], [62.9, 28.6], [68.6, 37.1], [68.6, 100], [0, 100], [0, 37.1]], color: '#24337e' },
    ],
    anchors: { muzzle: [50, 30], grip: [50, 64] },
    scale: 0.42,
    thickness: 0.12,
  },
  glue: {
    id: 'glue',
    name: tr('אקדח דבק', 'Glue gun'),
    nameEn: 'GLUE GUN',
    kind: 'weapon',
    difficulty: 2,
    desc: tr('יורה טיפות דבק חם. מי שנדבק — לא זז לשום מקום.', 'Fires drops of hot glue. Whoever gets stuck — isn\'t going anywhere.'),
    strokes: [
      { label: tr('גוף, פיה וידית', 'Body'), en: 'body', pts: close([[0, 4.3], [56.5, 0], [76.1, 0], [100, 9.8], [76.1, 17.4], [52.2, 17.4], [45.7, 52.2], [30.4, 52.2], [34.8, 17.4], [23.9, 15.2], [0, 13]]) },
      { label: tr('הדק', 'trigger'), en: 'trigger', pts: [[52.2, 17.4], [56.5, 30.4], [63, 19.6]] },
    ],
    fills: [
      { poly: [[0, 4.3], [56.5, 0], [76.1, 0], [100, 9.8], [76.1, 17.4], [52.2, 17.4], [45.7, 52.2], [30.4, 52.2], [34.8, 17.4], [23.9, 15.2], [0, 13]], color: '#e8853a' },
    ],
    anchors: { muzzle: [92, 39], grip: [32, 64] },
    scale: 0.82,
    thickness: 0.07,
  },
  laser: {
    id: 'laser',
    name: tr('לייזר מרקר זוהר', 'Glowing marker laser'),
    nameEn: 'HIGHLIGHTER LASER',
    kind: 'weapon',
    difficulty: 4,
    desc: tr('מרקר זוהר שיורה קרן זוהרת רציפה. מוחק אויבים — ואפילו חותך קירות.', 'A glowing marker that fires a steady glowing beam. Erases enemies — and even cuts through walls.'),
    strokes: [
      { label: tr('גוף וידית', 'Body'), en: 'body', pts: close([[0, 24], [10, 24], [10, 30], [34, 24], [62, 24], [68, 30], [100, 34], [68, 39], [54, 41], [50, 56], [40, 56], [42, 40], [10, 40], [10, 44], [0, 44]]) },
      { label: tr('קרן', 'beam'), en: 'beam', pts: [[38, 32], [44, 28], [50, 36], [56, 28], [62, 32]] },
    ],
    fills: [
      { poly: [[0, 24], [10, 24], [10, 30], [34, 24], [62, 24], [68, 30], [100, 34], [68, 39], [54, 41], [50, 56], [40, 56], [42, 40], [10, 40], [10, 44], [0, 44]], color: '#e9f23a' },
    ],
    anchors: { muzzle: [92, 41], grip: [36, 64] },
    scale: 1.1,
    thickness: 0.08,
  },
  boomerang: {
    id: 'boomerang',
    name: tr('מספריים בומרנג', 'Boomerang scissors'),
    nameEn: 'SCISSOR BOOMERANG',
    kind: 'weapon',
    difficulty: 3,
    desc: tr('זורקים — והמספריים עפים, גוזרים את כל מי שבדרך וחוזרים ליד.', 'Throw them — and the scissors fly, snip everyone in the way and come back to your hand.'),
    strokes: [
      { label: tr('בומרנג', 'Boomerang'), en: 'boomerang', pts: close([[0, 50], [50, 10], [100, 50], [88, 54], [50, 24], [12, 54]]) },
    ],
    fills: [
      { poly: [[0, 50], [50, 10], [100, 50], [88, 54], [50, 24], [12, 54]], color: '#c6ced8' },
    ],
    anchors: { muzzle: [96, 46], grip: [24, 46] },
    scale: 0.8,
    thickness: 0.03,
  },
  minigun: {
    id: 'minigun',
    name: tr('מיניגאן מחדדים', 'Sharpener minigun'),
    nameEn: 'SHARPENER MINIGUN',
    kind: 'weapon',
    difficulty: 5,
    desc: tr('מחדד ענק עם שישה קנים. מסתובב, ואז יורק מאות עפרונות מחודדים בשנייה.', 'A giant sharpener with six barrels. It spins up, then spits hundreds of sharpened pencils a second.'),
    strokes: [
      { label: tr('גוף וידיות', 'Body'), en: 'body', pts: close([[0, 24], [10, 16], [36, 16], [40, 26], [100, 26], [100, 42], [40, 42], [36, 52], [22, 52], [20, 64], [10, 64], [12, 50], [0, 46]]) },
      { label: tr('קנים', 'barrels'), en: 'barrels', pts: [[40, 31], [100, 31]] },
      { label: tr('קנים', 'barrels'), en: 'barrels', pts: [[40, 37], [100, 37]] },
    ],
    fills: [
      { poly: [[0, 24], [10, 16], [36, 16], [40, 26], [100, 26], [100, 42], [40, 42], [36, 52], [22, 52], [20, 64], [10, 64], [12, 50], [0, 46]], color: '#9aa4b0' },
    ],
    anchors: { muzzle: [94, 40], grip: [28, 68] },
    scale: 1.5,
    thickness: 0.12,
  },
  shield: {
    id: 'shield',
    name: tr('מגן קרטון', 'Cardboard shield'),
    nameEn: 'CARDBOARD SHIELD',
    kind: 'weapon',
    difficulty: 1,
    desc: tr('קרטון עבה עם סלוטייפ. עוצר כמעט כל ירייה מקדימה — ואפשר גם להכות איתו.', 'Thick cardboard with sticky tape. Stops almost every shot from the front — and you can hit with it too.'),
    strokes: [
      { label: tr('קרטון', 'Board'), en: 'board', pts: close([[8.8, 0], [91.2, 0], [100, 8.8], [100, 82.4], [91.2, 91.2], [8.8, 91.2], [0, 82.4], [0, 8.8]]) },
      { label: tr('סלוטייפ', 'tape'), en: 'tape', pts: [[0, 38.2], [100, 44.1]] },
      { label: tr('סלוטייפ', 'tape'), en: 'tape', pts: [[38.2, 0], [44.1, 91.2]] },
    ],
    fills: [
      { poly: [[8.8, 0], [91.2, 0], [100, 8.8], [100, 82.4], [91.2, 91.2], [8.8, 91.2], [0, 82.4], [0, 8.8]], color: '#c99a5f' },
    ],
    anchors: { grip: [50, 50], tip: [50, 50] },
    scale: 0.95,
    thickness: 0.03,
  },
  bandage: {
    id: 'bandage',
    name: tr('פלסטר ענק', 'Giant Band-Aid'),
    nameEn: 'GIANT BAND-AID',
    kind: 'heal',
    difficulty: 1,
    desc: tr('מציירים פלסטר — וכל החורים שנמחקו בך נסגרים. חיים מלאים.', 'Draw a band-aid — and every hole erased in you closes up. Full health.'),
    strokes: [
      { label: tr('פלסטר', 'strip'), en: 'strip', pts: stadium(6, 36, 94, 62) },
      { label: tr('רפידה', 'pad'), en: 'pad', pts: close([[38, 38], [62, 38], [62, 60], [38, 60]]) },
      { label: tr('חור', 'hole'), en: 'hole', pts: circle(20, 49, 2.2, 8) },
      { label: tr('חור', 'hole'), en: 'hole', pts: circle(80, 49, 2.2, 8) },
    ],
    fills: [
      { poly: stadium(6, 36, 94, 62), color: '#e9b893' },
      { poly: [[38, 38], [62, 38], [62, 60], [38, 60]], color: '#f7f1e5' },
    ],
    scale: 0.6,
  },
  bike: {
    id: 'bike',
    name: tr('אינקראנר R', 'Inkrunner R'),
    nameEn: 'INKRUNNER R',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('אופנוע מהיר וזריז. משתחל בין המכוניות ונוטה בפניות.', 'A fast, nimble motorbike. Weaves between cars and leans in the turns.'),
    strokes: [
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[28.9, 35.6], [27.4, 41.8], [23.4, 46.9], [17.7, 49.7], [11.2, 49.7], [5.4, 46.9], [1.4, 41.8], [0, 35.6], [1.4, 29.3], [5.4, 24.2], [11.2, 21.4], [17.7, 21.4], [23.4, 24.2], [27.4, 29.3]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[100, 35.6], [98.6, 41.8], [94.6, 46.9], [88.8, 49.7], [82.3, 49.7], [76.6, 46.9], [72.6, 41.8], [71.1, 35.6], [72.6, 29.3], [76.6, 24.2], [82.3, 21.4], [88.8, 21.4], [94.6, 24.2], [98.6, 29.3]]) },
      { label: tr('גוף ומושב', 'Body'), en: 'body', pts: close([[14.4, 35.6], [32.2, 11.1], [61.1, 8.9], [72.2, 17.8], [58.9, 33.3], [38.9, 35.6]]) },
      { label: tr('כידון', 'handlebar'), en: 'handlebar', pts: [[85.6, 35.6], [72.2, 4.4], [81.1, 0]] },
    ],
    fills: [
      { poly: [[28.9, 35.6], [27.4, 41.8], [23.4, 46.9], [17.7, 49.7], [11.2, 49.7], [5.4, 46.9], [1.4, 41.8], [0, 35.6], [1.4, 29.3], [5.4, 24.2], [11.2, 21.4], [17.7, 21.4], [23.4, 24.2], [27.4, 29.3]], color: '#d8463b' },
      { poly: [[100, 35.6], [98.6, 41.8], [94.6, 46.9], [88.8, 49.7], [82.3, 49.7], [76.6, 46.9], [72.6, 41.8], [71.1, 35.6], [72.6, 29.3], [76.6, 24.2], [82.3, 21.4], [88.8, 21.4], [94.6, 24.2], [98.6, 29.3]], color: '#2f3038' },
      { poly: [[14.4, 35.6], [32.2, 11.1], [61.1, 8.9], [72.2, 17.8], [58.9, 33.3], [38.9, 35.6]], color: '#3a3a42' },
    ],
    wheels: [[18, 62, 14], [82, 62, 14]],
    scale: 2.2,
  },
  copter: {
    id: 'copter',
    name: tr('אינקהוק H1', 'Inkhawk H1'),
    nameEn: 'INKHAWK H1',
    kind: 'vehicle',
    difficulty: 4,
    desc: tr('מסוק מקופל מדף מחברת. טס מעל הגגות ומטיל מטוסי נייר.', 'A helicopter folded from a notebook page. Flies over the rooftops and drops paper planes.'),
    strokes: [
      { label: tr('גוף וזנב', 'Body'), en: 'body', pts: close([[13, 21.7], [34.8, 10.9], [56.5, 13], [67.4, 23.9], [100, 19.6], [100, 26.1], [63, 37], [34.8, 41.3], [15.2, 37], [6.5, 28.3]]) },
      { label: tr('רוטור', 'rotor'), en: 'rotor', pts: [[0, 0], [91.3, 0]] },
      { label: tr('מגלשים', 'skids'), en: 'skids', pts: [[17.4, 50], [67.4, 50]] },
    ],
    fills: [
      { poly: [[13, 21.7], [34.8, 10.9], [56.5, 13], [67.4, 23.9], [100, 19.6], [100, 26.1], [63, 37], [34.8, 41.3], [15.2, 37], [6.5, 28.3]], color: '#f3efe2' },
    ],
    scale: 6,
  },
};

// the parachute's canopy: the top of an ellipse, closed by its scalloped hem
const CANOPY_TOP = ellipse(50, 34, 40, 26, 24, PI, PI * 2);
const CANOPY_HEM = [[90, 34], [76, 39], [63, 35], [50, 39], [37, 35], [24, 39], [10, 34]];

Object.assign(BLUEPRINTS, {
  tippex: {
    id: 'tippex',
    name: tr('מקלע טיפקס', 'White-out machine gun'),
    nameEn: 'CORRECTOR MG',
    kind: 'weapon',
    difficulty: 3,
    desc: tr('מקלע שיורה צרורות של טיפקס לבן. כל מה שהוא פוגע בו נמחק מהדף — קירות, פנסים, מכוניות.', 'A machine gun that fires bursts of white-out. Whatever it hits is erased from the page — walls, lampposts, cars.'),
    strokes: [
      { label: tr('גוף וידית', 'Body'), en: 'body', pts: close([[0, 34], [44, 34], [44, 30], [62, 30], [62, 34], [86, 34], [100, 38], [86, 42], [34, 42], [30, 58], [20, 58], [22, 42], [0, 42]]) },
      { label: tr('בקבוקון', 'bottle'), en: 'bottle', pts: [[46, 30], [48, 12], [52, 8], [56, 12], [58, 30]] },
    ],
    fills: [
      { poly: [[0, 34], [44, 34], [44, 30], [62, 30], [62, 34], [86, 34], [100, 38], [86, 42], [34, 42], [30, 58], [20, 58], [22, 42], [0, 42]], color: '#9aa6c0' },
    ],
    anchors: { muzzle: [98, 42], grip: [30, 58] },
    scale: 1.2,
  },
  erasermg: {
    id: 'erasermg',
    name: tr('מקלע מחקים', 'Eraser machine gun'),
    nameEn: 'ERASER MG',
    kind: 'weapon',
    difficulty: 3,
    desc: tr('מקלע שיורה מחקים קטנים בצרורות. מוחק חורים בקירות, בחפצים ובאויבים.', 'A machine gun that fires little erasers in bursts. Erases holes in walls, in things and in enemies.'),
    strokes: [
      { label: tr('גוף, קנה וידית', 'Body'), en: 'body', pts: close([[0, 26], [60, 26], [60, 30], [92, 30], [92, 26], [100, 26], [100, 40], [92, 40], [92, 36], [60, 36], [60, 40], [34, 40], [30, 56], [18, 56], [20, 40], [0, 40]]) },
      { label: tr('תוף', 'drum'), en: 'drum', pts: close([[55, 49], [54.1, 52.9], [51.6, 56], [48, 57.8], [44, 57.8], [40.4, 56], [37.9, 52.9], [37, 49], [37.9, 45.1], [40.4, 42], [44, 40.2], [48, 40.2], [51.6, 42], [54.1, 45.1]]) },
    ],
    fills: [
      { poly: [[0, 26], [60, 26], [60, 30], [92, 30], [92, 26], [100, 26], [100, 40], [92, 40], [92, 36], [60, 36], [60, 40], [34, 40], [30, 56], [18, 56], [20, 40], [0, 40]], color: '#6f8fd6' },
      { poly: [[55, 49], [54.1, 52.9], [51.6, 56], [48, 57.8], [44, 57.8], [40.4, 56], [37.9, 52.9], [37, 49], [37.9, 45.1], [40.4, 42], [44, 40.2], [48, 40.2], [51.6, 42], [54.1, 45.1]], color: '#ec95a2' },
    ],
    anchors: { muzzle: [97, 42], grip: [28, 60] },
    scale: 1.2,
  },
  paintmg: {
    id: 'paintmg',
    name: tr('מקלע צבע', 'Paint machine gun'),
    nameEn: 'PAINT MG',
    kind: 'weapon',
    difficulty: 3,
    desc: tr('שלוש פחיות צבע ומקלע אחד: מרסס צבע על כל העיר, וחפצים שנצבעים מספיק — נמסים מהדף.', 'Three paint cans and one machine gun: sprays paint all over the city, and things that get painted enough — melt off the page.'),
    strokes: [
      { label: tr('גוף, קנה וידית', 'Body'), en: 'body', pts: close([[0, 32], [56, 32], [56, 36], [92, 36], [100, 39], [92, 42], [56, 42], [56, 46], [34, 46], [30, 62], [18, 62], [20, 46], [0, 46]]) },
      { label: tr('פחיות צבע', 'paint cans'), en: 'paint cans', pts: [[8, 32], [8, 16], [20, 16], [20, 32], [24, 32], [24, 16], [36, 16], [36, 32], [40, 32], [40, 16], [52, 16], [52, 32]] },
    ],
    fills: [
      { poly: [[0, 32], [56, 32], [56, 36], [92, 36], [100, 39], [92, 42], [56, 42], [56, 46], [34, 46], [30, 62], [18, 62], [20, 46], [0, 46]], color: '#4a5778' },
    ],
    anchors: { muzzle: [90, 43], grip: [30, 60] },
    scale: 1.2,
  },
  parachute: {
    id: 'parachute',
    name: tr('פולדגלייד P1', 'Foldglide P1'),
    nameEn: 'FOLDGLIDE P1',
    kind: 'gear',
    difficulty: 2,
    desc: tr('מצנח רחיפה מתקפל: קופצים מגג, פותחים (רווח), ומנווטים רחוק מעל העיר.', 'A folding paraglider: jump off a roof, open it (jump), and steer a long way over the city.'),
    strokes: [
      { label: tr('כיפה', 'canopy'), en: 'canopy', pts: [...CANOPY_TOP, ...CANOPY_HEM.slice(1)] },
      { label: tr('תפר', 'seam'), en: 'seam', pts: [[50, 8], [50, 38]] },
      { label: tr('חבל', 'A rope'), en: 'line', pts: [[10, 34], [46, 74]] },
      { label: tr('חבל', 'A rope'), en: 'line', pts: [[90, 34], [54, 74]] },
      { label: tr('חבל', 'A rope'), en: 'line', pts: [[37, 36], [48, 74]] },
      { label: tr('חבל', 'A rope'), en: 'line', pts: [[63, 36], [52, 74]] },
      { label: tr('רתמה', 'harness'), en: 'harness', pts: close([[44, 74], [56, 74], [56, 86], [44, 86]]) },
    ],
    fills: [
      { poly: [...CANOPY_TOP, ...CANOPY_HEM.slice(1)], color: '#ff8a3c' },
      { poly: [[44, 74], [56, 74], [56, 86], [44, 86]], color: '#3a3a46' },
    ],
    scale: 2.4,
  },
});

// (ROADMAP 4.8) more to draw and ride: a bicycle, a kick scooter, a jet ski, a boat, a light plane
Object.assign(BLUEPRINTS, {
  bicycle: {
    id: 'bicycle',
    name: tr('אופניים', 'Bicycle'),
    the: tr('האופניים', 'The bicycle'),
    g: 'p',
    nameEn: 'BICYCLE',
    kind: 'vehicle',
    difficulty: 2,
    desc: tr('אופניים בעיפרון. שקטים, זריזים בסמטאות, ומצלצלים בפעמון (H).', 'A pencil bicycle. Quiet, nimble in the alleys, and it rings its bell (H).'),
    strokes: [
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(20, 64, 17, 18) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(80, 64, 17, 18) },
      { label: tr('שלדה', 'Chassis'), en: 'frame', pts: close([[44, 64], [36, 34], [72, 36]]) },
      { label: tr('מזלג', 'fork'), en: 'fork', pts: [[72, 36], [80, 64]] },
      { label: tr('מושב', 'seat'), en: 'saddle', pts: [[28, 28], [44, 28]] },
      { label: tr('כידון', 'Bayonet'), en: 'handlebar', pts: [[70, 36], [70, 22], [80, 20]] },
      { label: tr('שרשרת', 'A necklace'), en: 'chain', pts: [[44, 64], [20, 64]] },
    ],
    fills: [
      { poly: [[44, 64], [36, 34], [72, 36]], color: '#3fa7d6' },
    ],
    wheels: [[20, 64, 17], [80, 64, 17]],
    scale: 1.85,
  },
  scooter: {
    id: 'scooter',
    name: tr('קורקינט', 'Kick Scooter'),
    the: tr('הקורקינט', 'The scooter'),
    g: 'm',
    nameEn: 'KICK SCOOTER',
    kind: 'vehicle',
    difficulty: 1,
    desc: tr('קורקינט קטן. נעמדים עליו ובועטים, ומשתחלים בין האנשים במדרכה.', 'A little kick scooter. Stand on it and kick, and weave between people on the sidewalk.'),
    strokes: [
      { label: tr('קרש', 'deck'), en: 'deck', pts: close([[14, 70], [74, 70], [76, 76], [12, 76]]) },
      { label: tr('מוט', 'stem'), en: 'stem', pts: [[76, 72], [70, 14]] },
      { label: tr('כידון', 'Bayonet'), en: 'T-bar', pts: [[58, 14], [82, 14]] },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(18, 82, 7, 12) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(80, 82, 7, 12) },
    ],
    fills: [
      { poly: [[14, 70], [74, 70], [76, 76], [12, 76]], color: '#9be564' },
    ],
    wheels: [[18, 82, 7], [80, 82, 7]],
    scale: 1.1,
  },
  jetski: {
    id: 'jetski',
    name: tr('וייק-01', 'Wake-01'),
    the: tr('הוייק-01', 'The Wake-01'),
    g: 'm',
    nameEn: 'WAKE-01',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('אופנוע ים מהיר. מציירים אותו ליד החוף או המזח, והוא נוחת במים. מקפץ על הגלים ומתיז רסס.', 'A fast jet ski. Draw it near the beach or the pier, and it lands in the water. It bounces on the waves and throws up spray.'),
    strokes: [
      { label: tr('גוף ומושב', 'Hull'), en: 'hull', pts: close([[0, 44], [12, 36], [46, 34], [54, 38], [68, 38], [100, 46], [86, 58], [8, 58]]) },
      { label: tr('כידון', 'handlebar'), en: 'handlebar', pts: [[66, 38], [58, 19], [46, 19]] },
    ],
    fills: [
      { poly: [[0, 44], [12, 36], [46, 34], [54, 38], [68, 38], [100, 46], [86, 58], [8, 58]], color: '#ffd23f' },
    ],
    scale: 3.0,
  },
  boat: {
    id: 'boat',
    name: tr('קוסטראנר S', 'Coastrunner S'),
    the: tr('הקוסטראנר', 'The Coastrunner'),
    g: 'f',
    nameEn: 'COASTRUNNER S',
    kind: 'vehicle',
    difficulty: 4,
    desc: tr('סירת מנוע קטנה. נוחתת במים ליד החוף או המזח, ושטה בכל האוקיינוס.', 'A small motorboat. It lands in the water near the beach or the pier, and sails all over the ocean.'),
    strokes: [
      { label: tr('גוף', 'Hull'), en: 'hull', pts: close([[0, 36], [100, 30], [84, 56], [10, 56]]) },
      { label: tr('תא', 'cabin'), en: 'cabin', pts: [[40, 34], [46, 16], [62, 16], [66, 33]] },
    ],
    fills: [
      { poly: [[0, 36], [100, 30], [84, 56], [10, 56]], color: '#f4f1e8' },
    ],
    scale: 5.4,
  },
  plane: {
    id: 'plane',
    name: tr('פייפרווינג C1', 'Paperwing C1'),
    the: tr('הפייפרווינג', 'The Paperwing'),
    g: 'm',
    nameEn: 'PAPERWING C1',
    kind: 'vehicle',
    difficulty: 5,
    desc: tr('מטוס קל עם מדחף. צריך מסלול ישר וארוך להמראה (השדרה, החוף), מהירות, ואז רווח כדי לעלות.', 'A light plane with a propeller. It needs a long, straight runway to take off (the avenue, the beach), speed, then Space to climb.'),
    strokes: [
      { label: tr('גוף וזנב', 'Body'), en: 'body', pts: close([[0, 10], [10, 10], [20, 30], [76, 30], [92, 34], [100, 40], [90, 46], [20, 46], [4, 36]]) },
      { label: tr('כנף', 'wing'), en: 'wing', pts: close([[36, 38], [30, 54], [58, 54], [62, 38]]) },
      { label: tr('מדחף', 'propeller'), en: 'propeller', pts: [[100, 28], [100, 52]] },
    ],
    fills: [
      { poly: [[0, 10], [10, 10], [20, 30], [76, 30], [92, 34], [100, 40], [90, 46], [20, 46], [4, 36]], color: '#f4f1e8' },
      { poly: [[36, 38], [30, 54], [58, 54], [62, 38]], color: '#d8463b' },
    ],
    scale: 8.0,
  },
});

// (ROADMAP 29.5, plan item 6) the hover bike: a motorbike with no wheels, on two hover pods - the long body with its
// seat, the pod under its tail and the one under its nose, the handlebar (game/rides.js updateHover). Its drawing is
// found in the city, in the surfers' mechanic's van (game/places.js spot 'hoverbike'): no roof board of its own
// (noBoard - world/roofs.js)
const HB_BODY = [[0, 20], [10, 13], [30, 12], [36, 5], [54, 5], [60, 12], [80, 13], [100, 21], [92, 29], [8, 29]];
Object.assign(BLUEPRINTS, {
  hoverbike: {
    id: 'hoverbike',
    name: tr('אופנוע ריחוף', 'Hover Bike'),
    the: tr('אופנוע הריחוף', 'The hover bike'),
    g: 'm',
    nameEn: 'HOVER BIKE',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('אופנוע בלי גלגלים שמרחף חצי מטר מעל הכביש, החול והמים. קל ומהיר, נוטה בפניות וקופץ קפיצה קטנה (רווח).', 'A motorbike with no wheels that hovers half a metre over the road, the sand and the water. Light and fast, it leans into the turns and hops a little (Space).'),
    strokes: [
      { label: tr('גוף ומושב', 'Body'), en: 'body', pts: close(HB_BODY) },
      { label: tr('כרית ריחוף', 'Hover pod'), en: 'pod', pts: stadium(2, 32, 36, 44) },
      { label: tr('כרית ריחוף', 'Hover pod'), en: 'pod', pts: stadium(62, 32, 96, 44) },
      { label: tr('כידון', 'handlebar'), en: 'handlebar', pts: [[80, 13], [74, 2], [84, 0]] },
    ],
    fills: [
      { poly: HB_BODY, color: '#2bb3b1' },
      { poly: stadium(2, 32, 36, 44), color: '#34343c' },
      { poly: stadium(62, 32, 96, 44), color: '#34343c' },
      { poly: stadium(6, 42, 32, 46), color: '#7fe8ff' },
      { poly: stadium(66, 42, 92, 46), color: '#7fe8ff' },
    ],
    noBoard: true,
    scale: 2.6,
  },
});

// (ROADMAP 9.2, not with ?classic) drawings that solve problems: a ladder up to a roof, a ramp to
// jump off, a bridge over a gap, an umbrella for the rain, a key for what is locked (game/gadgets.js)
const UMB_TOP = ellipse(50, 46, 44, 38, 16, PI, PI * 2);
const UMB_HEM = (() => {
  const pts = [[94, 46]];
  for (let i = 0; i < 4; i++) pts.push(...ellipse(83 - 22 * i, 46, 11, 5, 6, 0, -PI).slice(1));
  return pts;
})();
Object.assign(BLUEPRINTS, {
  ladder: {
    id: 'ladder',
    name: tr('סולם', 'Ladder'),
    the: tr('הסולם', 'The ladder'),
    g: 'm',
    nameEn: 'LADDER',
    kind: 'tool',
    difficulty: 1,
    desc: tr('מציירים מול קיר של בניין, והסולם עומד עליו עד הגג. E למטה, ומטפסים.', 'Draw it against the wall of a building, and the ladder stands on it up to the roof. E at the bottom, and climb.'),
    strokes: [
      { label: tr('רגל', 'gear leg'), en: 'rail', pts: [[32, 4], [32, 96]] },
      { label: tr('רגל', 'gear leg'), en: 'rail', pts: [[68, 4], [68, 96]] },
      { label: tr('שלב', 'rung'), en: 'rung', pts: [[32, 18], [68, 18]] },
      { label: tr('שלב', 'rung'), en: 'rung', pts: [[32, 36], [68, 36]] },
      { label: tr('שלב', 'rung'), en: 'rung', pts: [[32, 54], [68, 54]] },
      { label: tr('שלב', 'rung'), en: 'rung', pts: [[32, 72], [68, 72]] },
      { label: tr('שלב', 'rung'), en: 'rung', pts: [[32, 90], [68, 90]] },
    ],
    fills: [
      { poly: [[29, 4], [35, 4], [35, 96], [29, 96]], color: '#b07a47' },
      { poly: [[65, 4], [71, 4], [71, 96], [65, 96]], color: '#b07a47' },
    ],
    scale: 1,
  },
  ramp: {
    id: 'ramp',
    name: tr('רמפה', 'Ramp'),
    the: tr('הרמפה', 'The ramp'),
    g: 'f',
    nameEn: 'STUNT RAMP',
    kind: 'tool',
    difficulty: 1,
    desc: tr('מציירים על הכביש, מול שטח ישר ופנוי. עולים עליה ברכב, מהר, ועפים.', 'Draw it on the road, facing flat, open ground. Drive up it, fast, and fly.'),
    strokes: [
      { label: tr('משטח', 'deck'), en: 'deck', pts: close([[4, 82], [88, 30], [96, 36], [14, 84]]) },
      { label: tr('רגל', 'gear leg'), en: 'leg', pts: [[90, 36], [90, 84]] },
      { label: tr('רגל', 'gear leg'), en: 'leg', pts: [[56, 54], [56, 84]] },
      { label: tr('בסיס', 'base'), en: 'base', pts: [[40, 84], [96, 84]] },
    ],
    fills: [{ poly: [[4, 82], [88, 30], [96, 36], [14, 84]], color: '#d8b07a' }],
    scale: 1,
  },
  // (ROADMAP 15.4) a barrier drawn as a line on the ground, there and as long as drawn
  barrier: {
    id: 'barrier',
    name: tr('מחסום', 'Roadblock'),
    the: tr('המחסום', 'The roadblock'),
    g: 'm',
    nameEn: 'ROAD BARRIER',
    kind: 'tool',
    difficulty: 1,
    desc: tr('קו על הקרקע — והמחסום עומד שם, באורך שציירתם (עד 14 מטר). מכוניות ושוטרים נעצרים בו.', 'A line on the ground — and the roadblock stands there, as long as you drew it (up to 14 meters). Cars and cops stop at it.'),
    strokes: [
      { label: tr('קורה', 'board'), en: 'board', pts: close([[6, 40], [94, 40], [94, 54], [6, 54]]) },
      { label: tr('רגל', 'gear leg'), en: 'leg', pts: [[16, 54], [16, 86]] },
      { label: tr('רגל', 'gear leg'), en: 'leg', pts: [[84, 54], [84, 86]] },
      { label: tr('פס', 'stripe'), en: 'stripe', pts: [[30, 40], [40, 54]] },
    ],
    fills: [{ poly: [[6, 40], [94, 40], [94, 54], [6, 54]], color: '#e8574a' }],
    scale: 1,
  },
  bridge: {
    id: 'bridge',
    name: tr('גשר', 'Bridge'),
    the: tr('הגשר', 'The bridge'),
    g: 'm',
    nameEn: 'PLANK BRIDGE',
    kind: 'tool',
    difficulty: 2,
    desc: tr('מציירים בקצה (של גג, של המזח), מול הצד השני, והגשר נמתח עד אליו. מעל המים בלי צד שני: מזח.', 'Draw it at an edge (of a roof, of the pier), facing the other side, and the bridge stretches across to it. Over water with no other side: a jetty.'),
    strokes: [
      { label: tr('משטח', 'deck'), en: 'deck', pts: close([[4, 56], [96, 56], [96, 64], [4, 64]]) },
      { label: tr('מעקה', 'rail'), en: 'rail', pts: [[4, 30], [96, 30]] },
      { label: tr('עמוד', 'pillar'), en: 'post', pts: [[6, 30], [6, 56]] },
      { label: tr('עמוד', 'pillar'), en: 'post', pts: [[36, 30], [36, 56]] },
      { label: tr('עמוד', 'pillar'), en: 'post', pts: [[64, 30], [64, 56]] },
      { label: tr('עמוד', 'pillar'), en: 'post', pts: [[94, 30], [94, 56]] },
      { label: tr('קשת', 'An arc'), en: 'arch', pts: ellipse(50, 96, 44, 30, 16, PI, PI * 2) },
    ],
    fills: [{ poly: [[4, 56], [96, 56], [96, 64], [4, 64]], color: '#b98a55' }],
    scale: 1,
  },
  umbrella: {
    id: 'umbrella',
    name: tr('מטריה', 'Umbrella'),
    the: tr('המטריה', 'The umbrella'),
    g: 'f',
    nameEn: 'UMBRELLA',
    kind: 'tool',
    difficulty: 1,
    desc: tr('בגשם היא נפתחת מעליכם, והציורים באוויר לא נמרחים. ובנפילה מגובה היא מאטה אתכם.', 'In the rain it opens over you, and drawings in the air don\'t smudge. And in a fall from up high it slows you down.'),
    strokes: [
      { label: tr('כיפה', 'canopy'), en: 'canopy', pts: [...UMB_TOP, ...UMB_HEM.slice(1)] },
      { label: tr('מוט', 'stem'), en: 'shaft', pts: [[50, 8], [50, 86]] },
      { label: tr('ידית', 'Handle'), en: 'handle', pts: [[50, 86], ...ellipse(43, 86, 7, 7, 8, 0, PI).slice(1)] },
    ],
    fills: [{ poly: [...UMB_TOP, ...UMB_HEM.slice(1)], color: '#3d55b8' }],
    scale: 1,
  },
  key: {
    id: 'key',
    name: tr('מפתח', 'Key'),
    the: tr('המפתח', 'The key'),
    g: 'm',
    nameEn: 'SKELETON KEY',
    kind: 'tool',
    difficulty: 2,
    desc: tr('פותח כל מנעול: מכונית חונה בלי אזעקה, וחנות סגורה בלילה. מפתח עקום מתעקם מהר.', 'Opens every lock: a parked car without an alarm, and a shop closed at night. A crooked key bends quickly.'),
    strokes: [
      { label: tr('ראש', 'Head'), en: 'bow', pts: circle(22, 50, 15, 18) },
      { label: tr('חור', 'hole'), en: 'hole', pts: circle(22, 50, 6, 10) },
      { label: tr('מוט', 'stem'), en: 'shaft', pts: [[37, 50], [94, 50]] },
      { label: tr('שיניים', 'bit'), en: 'bit', pts: [[78, 50], [78, 66], [86, 66], [86, 60], [94, 60], [94, 50]] },
    ],
    fills: [{ poly: circle(22, 50, 15, 18), color: '#e0b046' }],
    scale: 1,
  },
});

// (v5, ROADMAP 11.41) the catalog's cars, drawn from nothing - as many lines as there is to each
// (game/vehicles.js CAR_BP: each a car of one of the city's shapes, render/cars.js)
const HYPER = [[3, 44], [3, 33], [16, 30], [36, 28], [46, 20], [62, 19], [75, 27], [90, 33], [97, 38], [97, 44]];
const MUSCLE = [[3, 44], [3, 32], [12, 30], [42, 19], [60, 19], [70, 28], [96, 30], [97, 38], [97, 44]];
const MONSTER = [[8, 40], [8, 28], [40, 28], [44, 15], [66, 15], [72, 27], [94, 29], [94, 40]];
const ARMORED = [[4, 46], [4, 18], [64, 18], [78, 26], [96, 30], [96, 46]];
const LIMO = [[2, 40], [2, 31], [12, 29], [22, 22], [80, 22], [87, 29], [98, 31], [98, 40]];
const FIRETRUCK = [[3, 46], [3, 27], [68, 27], [70, 16], [88, 16], [96, 29], [96, 46]];
const RUNGS = [];
for (let x = 8; x <= 64; x += 8) RUNGS.push(...(((x - 8) / 8) % 2 ? [[x, 23], [x, 20]] : [[x, 20], [x, 23]]));
Object.assign(BLUEPRINTS, {
  hyper: {
    id: 'hyper',
    name: tr('אפקסליין S6', 'Apexline S6'),
    the: tr('האפקסליין', 'The Apexline'),
    g: 'm',
    nameEn: 'APEXLINE S6',
    kind: 'vehicle',
    difficulty: 4,
    desc: tr('נמוכה כמו ברך, כנף מאחור ונאון מתחת. הכי מהירה בעיר, עם טורבו.', 'Knee-high, a wing at the back and neon underneath. The fastest in the city, with a turbo.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 55.2], [0, 41], [25, 39.4], [40, 34.1], [57.5, 34], [65, 36.9], [73.8, 44.4], [100, 50.3], [100, 55.2]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[25.7, 50.3], [24.9, 53.6], [22.8, 56.3], [19.7, 57.8], [16.3, 57.8], [13.2, 56.3], [11.1, 53.6], [10.3, 50.3], [11.1, 47], [13.2, 44.3], [16.3, 42.8], [19.7, 42.8], [22.8, 44.3], [24.9, 47]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[87.7, 50.3], [86.9, 53.6], [84.8, 56.3], [81.7, 57.8], [78.3, 57.8], [75.2, 56.3], [73.1, 53.6], [72.3, 50.3], [73.1, 47], [75.2, 44.3], [78.3, 42.8], [81.7, 42.8], [84.8, 44.3], [86.9, 47]]) },
      { label: tr('כנף אחורית', 'rear wing'), en: 'rear wing', pts: [[5, 41], [5, 28], [21, 28]] },
    ],
    fills: [
      { poly: [[0, 55.2], [0, 41], [25, 39.4], [40, 34.1], [57.5, 34], [65, 36.9], [73.8, 44.4], [100, 50.3], [100, 55.2]], color: '#3fd6c8' },
      { poly: [[25.7, 50.3], [24.9, 53.6], [22.8, 56.3], [19.7, 57.8], [16.3, 57.8], [13.2, 56.3], [11.1, 53.6], [10.3, 50.3], [11.1, 47], [13.2, 44.3], [16.3, 42.8], [19.7, 42.8], [22.8, 44.3], [24.9, 47]], color: '#26323f' },
      { poly: [[87.7, 50.3], [86.9, 53.6], [84.8, 56.3], [81.7, 57.8], [78.3, 57.8], [75.2, 56.3], [73.1, 53.6], [72.3, 50.3], [73.1, 47], [75.2, 44.3], [78.3, 42.8], [81.7, 42.8], [84.8, 44.3], [86.9, 47]], color: '#2a2a30' },
    ],
    wheels: [[22, 45, 7], [78, 45, 7]],
    scale: 4.7,
  },
  muscle: {
    id: 'muscle',
    name: tr('איירונראש V8', 'Ironrush V8'),
    the: tr('האיירונראש', 'The Ironrush'),
    g: 'f',
    nameEn: 'IRONRUSH V8',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('מנוע ענק מתחת למכסה, עם פתח אוויר. מחליקה יפה בפניות, עם טורבו.', 'A huge engine under the hood, with an air scoop. Slides beautifully in the turns, with a turbo.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 54.1], [0, 38.4], [12.5, 37.5], [35, 30.8], [52.5, 30.2], [57.5, 31.6], [66.2, 39], [93.8, 39.9], [100, 42.9], [100, 54.1]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[25.6, 50.4], [24.8, 53.7], [22.7, 56.3], [19.7, 57.8], [16.3, 57.8], [13.3, 56.3], [11.2, 53.7], [10.4, 50.4], [11.2, 47.1], [13.3, 44.5], [16.3, 43], [19.7, 43], [22.7, 44.5], [24.8, 47.1]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[87.6, 50.4], [86.8, 53.7], [84.7, 56.3], [81.7, 57.8], [78.3, 57.8], [75.3, 56.3], [73.2, 53.7], [72.4, 50.4], [73.2, 47.1], [75.3, 44.5], [78.3, 43], [81.7, 43], [84.7, 44.5], [86.8, 47.1]]) },
      { label: tr('סקופ', 'hood scoop'), en: 'hood scoop', pts: [[73.8, 39.9], [73.8, 30.4], [87.8, 30.4], [87.8, 39.9]] },
    ],
    fills: [
      { poly: [[0, 54.1], [0, 38.4], [12.5, 37.5], [35, 30.8], [52.5, 30.2], [57.5, 31.6], [66.2, 39], [93.8, 39.9], [100, 42.9], [100, 54.1]], color: '#f08a2c' },
      { poly: [[25.6, 50.4], [24.8, 53.7], [22.7, 56.3], [19.7, 57.8], [16.3, 57.8], [13.3, 56.3], [11.2, 53.7], [10.4, 50.4], [11.2, 47.1], [13.3, 44.5], [16.3, 43], [19.7, 43], [22.7, 44.5], [24.8, 47.1]], color: '#c3d6ea' },
      { poly: [[87.6, 50.4], [86.8, 53.7], [84.7, 56.3], [81.7, 57.8], [78.3, 57.8], [75.3, 56.3], [73.2, 53.7], [72.4, 50.4], [73.2, 47.1], [75.3, 44.5], [78.3, 43], [81.7, 43], [84.7, 44.5], [86.8, 47.1]], color: '#2a2a30' },
    ],
    wheels: [[22, 45, 8], [79, 45, 8]],
    scale: 4.9,
  },
  monster: {
    id: 'monster',
    name: tr('משאית מפלצת', 'Monster Truck'),
    the: tr('משאית המפלצת', 'The monster truck'),
    g: 'f',
    nameEn: 'MONSTER TRUCK',
    kind: 'vehicle',
    difficulty: 4,
    desc: tr('גלגלים בגובה של אדם: עולה על מכוניות ומועכת אותן, וכמעט לא נשרטת.', 'Wheels as tall as a person: drives over cars and crushes them, and hardly gets a scratch.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close(MONSTER) },
      { label: tr('חלון', 'Window'), en: 'window', pts: [[47, 27], [49, 18], [63, 18], [68, 27]] },
      { label: tr('קשת גלגול', 'roll bar'), en: 'roll bar', pts: [[14, 28], [16, 20], [32, 20], [34, 28]] },
      { label: tr('פנסים', 'light bar'), en: 'light bar', pts: [[46, 11], [64, 11]] },
      { label: tr('ארובה', 'exhaust stack'), en: 'exhaust stack', pts: [[39, 28], [39, 8]] },
      { label: tr('גלגל ענק', 'Giant wheel'), en: 'giant wheel', pts: circle(25, 56, 15, 20) },
      { label: tr('גלגל ענק', 'Giant wheel'), en: 'giant wheel', pts: circle(77, 56, 15, 20) },
      { label: tr('בולם', 'shock'), en: 'shock', pts: [[22, 40], [28, 43], [22, 45], [28, 48]] },
      { label: tr('בולם', 'shock'), en: 'shock', pts: [[74, 40], [80, 43], [74, 45], [80, 48]] },
    ],
    fills: [
      { poly: MONSTER, color: '#74c63a' },
      { poly: [[47, 27], [49, 18], [63, 18], [68, 27]], color: '#c3d6ea' },
      { poly: circle(25, 56, 15, 20), color: '#2e2e34' },
      { poly: circle(77, 56, 15, 20), color: '#2e2e34' },
    ],
    wheels: [[25, 56, 15], [77, 56, 15]],
    scale: 5.3,
  },
  armored: {
    id: 'armored',
    name: tr('משוריין SWAT', 'Swat Armor'),
    the: tr('המשוריין', 'The armored car'),
    g: 'm',
    nameEn: 'SWAT ARMOR',
    kind: 'vehicle',
    difficulty: 5,
    desc: tr('פלדה מכל הצדדים, צריח על הגג ואיל ברזל מקדימה. דוחף מכוניות הצידה, ויריות כמעט לא עוברות.', 'Steel on every side, a turret on the roof and an iron ram in front. Pushes cars aside, and bullets hardly get through.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close(ARMORED) },
      { label: tr('חלון חרך', 'slit window'), en: 'slit window', pts: [[66, 23], [76, 28]] },
      { label: tr('דלת', 'door'), en: 'door', pts: close([[40, 21], [62, 21], [62, 42], [40, 42]]) },
      { label: tr('חלון חרך', 'slit window'), en: 'slit window', pts: [[44, 25], [58, 25]] },
      { label: tr('צריח', 'turret'), en: 'turret', pts: [[18, 18], [21, 10], [37, 10], [40, 18]] },
      { label: tr('קנה', 'Barrel'), en: 'gun', pts: [[37, 13], [58, 13]] },
      { label: tr('איל ברזל', 'ram'), en: 'ram', pts: [[96, 32], [100, 34], [100, 46], [96, 46]] },
      { label: tr('שריון', 'Armor'), en: 'armor plate', pts: [[8, 36], [36, 36]] },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(22, 48, 9) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(80, 48, 9) },
    ],
    fills: [
      { poly: ARMORED, color: '#4a4e56' },
      { poly: [[18, 18], [21, 10], [37, 10], [40, 18]], color: '#2c2f35' },
      { poly: circle(22, 48, 9), color: '#2a2a30' },
      { poly: circle(80, 48, 9), color: '#2a2a30' },
    ],
    wheels: [[22, 48, 9], [80, 48, 9]],
    scale: 5.8,
  },
  limo: {
    id: 'limo',
    name: tr('לימוזינה', 'Stretch Limo'),
    the: tr('הלימוזינה', 'The limousine'),
    g: 'f',
    nameEn: 'STRETCH LIMO',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('ארוכה כמו שלוש מכוניות, שחורה ומבריקה. רכה בנסיעה, וחזקה ממכונית רגילה.', 'As long as three cars, black and shiny. A soft ride, and tougher than a normal car.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close(LIMO) },
      { label: tr('קו חלונות', 'window line'), en: 'window line', pts: [[20, 29], [87, 29]] },
      { label: tr('עמוד', 'pillar'), en: 'pillar', pts: [[38, 22], [38, 29]] },
      { label: tr('עמוד', 'pillar'), en: 'pillar', pts: [[54, 22], [54, 29]] },
      { label: tr('עמוד', 'pillar'), en: 'pillar', pts: [[70, 22], [70, 29]] },
      { label: tr('פס כרום', 'chrome line'), en: 'chrome line', pts: [[6, 34], [94, 34]] },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(15, 41, 6) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(86, 41, 6) },
    ],
    fills: [
      { poly: LIMO, color: '#2a2a30' },
      { poly: [[20, 29], [24, 23], [79, 23], [86, 29]], color: '#5c6878' },
      { poly: circle(15, 41, 6), color: '#55555e' },
      { poly: circle(86, 41, 6), color: '#55555e' },
    ],
    wheels: [[15, 41, 6], [86, 41, 6]],
    scale: 7.1,
  },
  firetruck: {
    id: 'firetruck',
    name: tr('כבאית', 'Fire truck'),
    the: tr('הכבאית', 'The fire truck'),
    g: 'f',
    nameEn: 'FIRE ENGINE',
    kind: 'vehicle',
    difficulty: 5,
    desc: tr('ארוכה וכבדה, עם סולם על הגב וסירנה. דוחפת מכוניות מהדרך.', 'Long and heavy, with a ladder on its back and a siren. Pushes cars out of the way.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close(FIRETRUCK) },
      { label: tr('חלון', 'Window'), en: 'window', pts: [[73, 27], [75, 19], [86, 19], [91, 27]] },
      { label: tr('מעקה סולם', 'ladder rail'), en: 'ladder rail', pts: [[5, 20], [66, 20]] },
      { label: tr('מעקה סולם', 'ladder rail'), en: 'ladder rail', pts: [[5, 23], [66, 23]] },
      { label: tr('שלבים', 'rungs'), en: 'rungs', pts: RUNGS },
      { label: tr('גלגלת צינור', 'hose reel'), en: 'hose reel', pts: circle(44, 38, 5, 12) },
      { label: tr('סירנה', 'light bar'), en: 'light bar', pts: [[73, 13], [86, 13]] },
      { label: tr('פס לבן', 'white band'), en: 'white band', pts: [[3, 31], [96, 31]] },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(16, 48, 7) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(32, 48, 7) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: circle(83, 48, 7) },
    ],
    fills: [
      { poly: FIRETRUCK, color: '#d8463b' },
      { poly: [[73, 27], [75, 19], [86, 19], [91, 27]], color: '#c3d6ea' },
      { poly: circle(16, 48, 7), color: '#3a3a42' },
      { poly: circle(32, 48, 7), color: '#3a3a42' },
      { poly: circle(83, 48, 7), color: '#3a3a42' },
    ],
    wheels: [[16, 48, 7], [32, 48, 7], [83, 48, 7]],
    scale: 8.6,
  },
});

// ------------------------------------------------------------------ (ROADMAP 28.3) the new rides of the start
const STREETLINE = [[4, 48], [4, 33], [24, 32], [30, 14], [66, 14], [72, 32], [96, 34], [96, 48]];
const NIGHTSHIFT = [[3, 46], [3, 36], [12, 31], [38, 23], [52, 23], [66, 33], [97, 38], [97, 46]];
const TRAILFORGE = [[6, 42], [6, 14], [60, 14], [66, 28], [94, 30], [94, 42]];
const DRIFTVAN = [[6, 46], [6, 14], [70, 14], [86, 28], [94, 34], [94, 46]];
const INTERCEPTOR = [[6, 46], [6, 34], [22, 33], [32, 21], [62, 21], [73, 33], [92, 35], [92, 46]];
Object.assign(BLUEPRINTS, {
  streetline: {
    id: 'streetline',
    name: tr('סטריטליין S4', 'Streetline S4'),
    the: tr('הסטריטליין', 'The Streetline'),
    g: 'f',
    nameEn: 'STREETLINE S4',
    kind: 'vehicle',
    difficulty: 2,
    desc: tr('מכונית משפחתית עם ארבע דלתות: עושה הכול טוב מספיק, ולא מושכת עין.', 'A four-door family saloon: does everything well enough, and turns no heads.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 52.7], [0, 40.3], [3.8, 37.6], [21.2, 37], [31.3, 27.4], [56.3, 27.1], [61.3, 29.4], [68.8, 38.3], [93.8, 39.6], [100, 43.3], [100, 52.7]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[26.2, 50.8], [25.5, 53.9], [23.5, 56.4], [20.6, 57.8], [17.4, 57.8], [14.5, 56.4], [12.5, 53.9], [11.8, 50.8], [12.5, 47.7], [14.5, 45.2], [17.4, 43.8], [20.6, 43.8], [23.5, 45.2], [25.5, 47.7]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[87.2, 50.8], [86.5, 53.9], [84.5, 56.4], [81.6, 57.8], [78.4, 57.8], [75.5, 56.4], [73.5, 53.9], [72.8, 50.8], [73.5, 47.7], [75.5, 45.2], [78.4, 43.8], [81.6, 43.8], [84.5, 45.2], [86.5, 47.7]]) },
      { label: tr('עמוד בין הדלתות', 'door post'), en: 'door post', pts: [[43.8, 27.1], [43.8, 52]] },
    ],
    fills: [
      { poly: [[0, 52.7], [0, 40.3], [3.8, 37.6], [21.2, 37], [31.3, 27.4], [56.3, 27.1], [61.3, 29.4], [68.8, 38.3], [93.8, 39.6], [100, 43.3], [100, 52.7]], color: '#5d86c9' },
      { poly: [[26.2, 50.8], [25.5, 53.9], [23.5, 56.4], [20.6, 57.8], [17.4, 57.8], [14.5, 56.4], [12.5, 53.9], [11.8, 50.8], [12.5, 47.7], [14.5, 45.2], [17.4, 43.8], [20.6, 43.8], [23.5, 45.2], [25.5, 47.7]], color: '#c3d6ea' },
      { poly: [[87.2, 50.8], [86.5, 53.9], [84.5, 56.4], [81.6, 57.8], [78.4, 57.8], [75.5, 56.4], [73.5, 53.9], [72.8, 50.8], [73.5, 47.7], [75.5, 45.2], [78.4, 43.8], [81.6, 43.8], [84.5, 45.2], [86.5, 47.7]], color: '#c3d6ea' },
    ],
    wheels: [[24, 50, 8], [76, 50, 8]],
    scale: 4.75,
  },
  nightshift: {
    id: 'nightshift',
    name: tr('נייטשיפט R9', 'Nightshift R9'),
    the: tr('הנייטשיפט', 'The Nightshift'),
    g: 'f',
    nameEn: 'NIGHTSHIFT R9',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('קופה לילית: מכסה מנוע ארוך, גג שיורד עד הזנב. נצמדת לכביש בפניות.', 'A night coupe: a long hood, a roof that runs down to the tail. Holds the road through the turns.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 53.9], [0, 41.9], [27.5, 32.9], [50, 32], [56.2, 34.2], [63.7, 40.9], [91.2, 42.8], [100, 46.5], [100, 53.9]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[26.4, 50.6], [25.7, 53.8], [23.6, 56.4], [20.6, 57.8], [17.4, 57.8], [14.4, 56.4], [12.3, 53.8], [11.6, 50.6], [12.3, 47.4], [14.4, 44.8], [17.4, 43.4], [20.6, 43.4], [23.6, 44.8], [25.7, 47.4]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[87.4, 50.6], [86.7, 53.8], [84.6, 56.4], [81.6, 57.8], [78.4, 57.8], [75.4, 56.4], [73.3, 53.8], [72.6, 50.6], [73.3, 47.4], [75.4, 44.8], [78.4, 43.4], [81.6, 43.4], [84.6, 44.8], [86.7, 47.4]]) },
      { label: tr('אלומת פנסים', 'headlight beam'), en: 'headlight beam', pts: [[120, 41.2], [102, 49.7], [120, 56.2]] },
    ],
    fills: [
      { poly: [[0, 53.9], [0, 41.9], [27.5, 32.9], [50, 32], [56.2, 34.2], [63.7, 40.9], [91.2, 42.8], [100, 46.5], [100, 53.9]], color: '#3b3d5c' },
      { poly: [[26.4, 50.6], [25.7, 53.8], [23.6, 56.4], [20.6, 57.8], [17.4, 57.8], [14.4, 56.4], [12.3, 53.8], [11.6, 50.6], [12.3, 47.4], [14.4, 44.8], [17.4, 43.4], [20.6, 43.4], [23.6, 44.8], [25.7, 47.4]], color: '#9fb6d8' },
      { poly: [[87.4, 50.6], [86.7, 53.8], [84.6, 56.4], [81.6, 57.8], [78.4, 57.8], [75.4, 56.4], [73.3, 53.8], [72.6, 50.6], [73.3, 47.4], [75.4, 44.8], [78.4, 43.4], [81.6, 43.4], [84.6, 44.8], [86.7, 47.4]], color: '#6e6e78' },
    ],
    wheels: [[22, 48, 8], [78, 48, 8]],
    scale: 4.85,
  },
  trailforge: {
    id: 'trailforge',
    name: tr('טריילפורג׳ X4', 'Trailforge X4'),
    the: tr('הטריילפורג׳', 'The Trailforge'),
    g: 'm',
    nameEn: 'TRAILFORGE X4',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('רכב שטח מרובע על צמיגים גדולים, גגון על הגג. סופג מכות ולא מתרגש ממדרכות.', 'A square 4x4 on big tyres, a rack on its roof. Soaks up knocks and shrugs at kerbs.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 48], [0, 31.5], [3.7, 29.7], [8.7, 14.5], [57.5, 14.5], [61.2, 16.6], [68.8, 30.8], [93.8, 31.9], [100, 36.3], [100, 48]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[28, 48], [27, 52.3], [24.2, 55.8], [20.2, 57.7], [15.8, 57.7], [11.8, 55.8], [9, 52.3], [8, 48], [9, 43.7], [11.8, 40.2], [15.8, 38.3], [20.2, 38.3], [24.2, 40.2], [27, 43.7]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[90, 48], [89, 52.3], [86.2, 55.8], [82.2, 57.7], [77.8, 57.7], [73.8, 55.8], [71, 52.3], [70, 48], [71, 43.7], [73.8, 40.2], [77.8, 38.3], [82.2, 38.3], [86.2, 40.2], [89, 43.7]]) },
      { label: tr('גגון', 'roof rack'), en: 'roof rack', pts: [[10.7, 14.5], [10.7, 6.5], [55.5, 6.5], [55.5, 14.5]] },
    ],
    fills: [
      { poly: [[0, 48], [0, 31.5], [3.7, 29.7], [8.7, 14.5], [57.5, 14.5], [61.2, 16.6], [68.8, 30.8], [93.8, 31.9], [100, 36.3], [100, 48]], color: '#c98f45' },
      { poly: [[28, 48], [27, 52.3], [24.2, 55.8], [20.2, 57.7], [15.8, 57.7], [11.8, 55.8], [9, 52.3], [8, 48], [9, 43.7], [11.8, 40.2], [15.8, 38.3], [20.2, 38.3], [24.2, 40.2], [27, 43.7]], color: '#c3d6ea' },
      { poly: [[90, 48], [89, 52.3], [86.2, 55.8], [82.2, 57.7], [77.8, 57.7], [73.8, 55.8], [71, 52.3], [70, 48], [71, 43.7], [73.8, 40.2], [77.8, 38.3], [82.2, 38.3], [86.2, 40.2], [89, 43.7]], color: '#c3d6ea' },
    ],
    wheels: [[24, 47, 11], [76, 47, 11]],
    scale: 4.6,
  },
  driftvan: {
    id: 'driftvan',
    name: tr('דריפט-ואן', 'Driftvan'),
    the: tr('הדריפט-ואן', 'The Driftvan'),
    g: 'm',
    nameEn: 'DRIFTVAN',
    kind: 'vehicle',
    difficulty: 2,
    desc: tr('ואן צהוב שהזנב שלו בורח: מחליק לרוחב בכל פנייה. מקום לכל החבורה.', 'A yellow van whose tail steps out: it goes sideways through every turn. Room for the whole crew.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 52], [0, 16.8], [35, 13.1], [55, 15.3], [62.5, 15.6], [73.8, 15.7], [78.8, 20.1], [86.2, 35.3], [96.2, 37.7], [100, 41.2], [100, 52]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[24.2, 50.8], [23.5, 53.9], [21.5, 56.4], [18.6, 57.8], [15.4, 57.8], [12.5, 56.4], [10.5, 53.9], [9.8, 50.8], [10.5, 47.7], [12.5, 45.2], [15.4, 43.8], [18.6, 43.8], [21.5, 45.2], [23.5, 47.7]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[89.2, 50.8], [88.5, 53.9], [86.5, 56.4], [83.6, 57.8], [80.4, 57.8], [77.5, 56.4], [75.5, 53.9], [74.8, 50.8], [75.5, 47.7], [77.5, 45.2], [80.4, 43.8], [83.6, 43.8], [86.5, 45.2], [88.5, 47.7]]) },
    ],
    fills: [
      { poly: [[0, 52], [0, 16.8], [35, 13.1], [55, 15.3], [62.5, 15.6], [73.8, 15.7], [78.8, 20.1], [86.2, 35.3], [96.2, 37.7], [100, 41.2], [100, 52]], color: '#e8c84a' },
      { poly: [[24.2, 50.8], [23.5, 53.9], [21.5, 56.4], [18.6, 57.8], [15.4, 57.8], [12.5, 56.4], [10.5, 53.9], [9.8, 50.8], [10.5, 47.7], [12.5, 45.2], [15.4, 43.8], [18.6, 43.8], [21.5, 45.2], [23.5, 47.7]], color: '#c3d6ea' },
      { poly: [[89.2, 50.8], [88.5, 53.9], [86.5, 56.4], [83.6, 57.8], [80.4, 57.8], [77.5, 56.4], [75.5, 53.9], [74.8, 50.8], [75.5, 47.7], [77.5, 45.2], [80.4, 43.8], [83.6, 43.8], [86.5, 45.2], [88.5, 47.7]], color: '#6e6e78' },
    ],
    wheels: [[24, 48, 8], [76, 48, 8]],
    scale: 5.0,
  },
  cargobrute: {
    id: 'cargobrute',
    name: tr('קרגו-ברוט', 'Cargobrute'),
    the: tr('הקרגו-ברוט', 'The Cargobrute'),
    g: 'f',
    nameEn: 'CARGOBRUTE',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('משאית כבדה על שלושה סרנים: איטית, ושום דבר לא עוצר אותה. הבסיס לבנייה גדולה.', 'A heavy lorry on three axles: slow, and nothing stops it. The base for a big build.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 53.1], [0, 16.1], [41.2, 11.6], [65, 14.1], [67.5, 14.9], [72.5, 21.2], [83.8, 21.4], [87.5, 25.8], [92.5, 39.2], [100, 44.8], [100, 53.1]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[20.2, 51.8], [19.6, 54.5], [17.9, 56.6], [15.4, 57.8], [12.6, 57.8], [10.1, 56.6], [8.4, 54.5], [7.8, 51.8], [8.4, 49.1], [10.1, 47], [12.6, 45.8], [15.4, 45.8], [17.9, 47], [19.6, 49.1]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[33.2, 51.8], [32.6, 54.5], [30.9, 56.6], [28.4, 57.8], [25.6, 57.8], [23.1, 56.6], [21.4, 54.5], [20.8, 51.8], [21.4, 49.1], [23.1, 47], [25.6, 45.8], [28.4, 45.8], [30.9, 47], [32.6, 49.1]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[90.2, 51.8], [89.6, 54.5], [87.9, 56.6], [85.4, 57.8], [82.6, 57.8], [80.1, 56.6], [78.4, 54.5], [77.8, 51.8], [78.4, 49.1], [80.1, 47], [82.6, 45.8], [85.4, 45.8], [87.9, 47], [89.6, 49.1]]) },
      { label: tr('קו הארגז', 'box edge'), en: 'box edge', pts: [[72, 13.6], [72, 52]] },
    ],
    fills: [
      { poly: [[0, 53.1], [0, 16.1], [41.2, 11.6], [65, 14.1], [67.5, 14.9], [72.5, 21.2], [83.8, 21.4], [87.5, 25.8], [92.5, 39.2], [100, 44.8], [100, 53.1]], color: '#6f8f7c' },
      { poly: [[20.2, 51.8], [19.6, 54.5], [17.9, 56.6], [15.4, 57.8], [12.6, 57.8], [10.1, 56.6], [8.4, 54.5], [7.8, 51.8], [8.4, 49.1], [10.1, 47], [12.6, 45.8], [15.4, 45.8], [17.9, 47], [19.6, 49.1]], color: '#4f6b5c' },
      { poly: [[33.2, 51.8], [32.6, 54.5], [30.9, 56.6], [28.4, 57.8], [25.6, 57.8], [23.1, 56.6], [21.4, 54.5], [20.8, 51.8], [21.4, 49.1], [23.1, 47], [25.6, 45.8], [28.4, 45.8], [30.9, 47], [32.6, 49.1]], color: '#c3d6ea' },
      { poly: [[90.2, 51.8], [89.6, 54.5], [87.9, 56.6], [85.4, 57.8], [82.6, 57.8], [80.1, 56.6], [78.4, 54.5], [77.8, 51.8], [78.4, 49.1], [80.1, 47], [82.6, 45.8], [85.4, 45.8], [87.9, 47], [89.6, 49.1]], color: '#55555e' },
    ],
    wheels: [[16, 49, 7], [32, 49, 7], [82, 49, 7]],
    scale: 7.4,
  },
  interceptor: {
    id: 'interceptor',
    name: tr('מטרו אינטרספטור', 'Metro Interceptor'),
    the: tr('האינטרספטור', 'The Interceptor'),
    g: 'm',
    nameEn: 'METRO INTERCEPTOR',
    kind: 'vehicle',
    difficulty: 3,
    desc: tr('ניידת מרדף לא מסומנת: שחורה, מהירה, עם טורבו ופגוש דחיפה.', 'An unmarked pursuit car: black, quick, with a turbo and a push bar.'),
    strokes: [
      { label: tr('גוף', 'Body'), en: 'body', pts: close([[0, 52.7], [0, 40.3], [3.8, 37.6], [21.2, 37], [31.3, 27.4], [56.3, 27.1], [61.3, 29.4], [68.8, 38.3], [93.8, 39.6], [100, 43.3], [100, 52.7]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[26.2, 50.8], [25.5, 53.9], [23.5, 56.4], [20.6, 57.8], [17.4, 57.8], [14.5, 56.4], [12.5, 53.9], [11.8, 50.8], [12.5, 47.7], [14.5, 45.2], [17.4, 43.8], [20.6, 43.8], [23.5, 45.2], [25.5, 47.7]]) },
      { label: tr('גלגל', 'Wheel'), en: 'wheel', pts: close([[87.2, 50.8], [86.5, 53.9], [84.5, 56.4], [81.6, 57.8], [78.4, 57.8], [75.5, 56.4], [73.5, 53.9], [72.8, 50.8], [73.5, 47.7], [75.5, 45.2], [78.4, 43.8], [81.6, 43.8], [84.5, 45.2], [86.5, 47.7]]) },
      { label: tr('אור משטרתי', 'beacon'), en: 'beacon', pts: [[38.8, 27.1], [38.8, 21.1], [41.3, 18.1], [46.3, 18.1], [48.8, 21.1], [48.8, 27.1]] },
    ],
    fills: [
      { poly: [[0, 52.7], [0, 40.3], [3.8, 37.6], [21.2, 37], [31.3, 27.4], [56.3, 27.1], [61.3, 29.4], [68.8, 38.3], [93.8, 39.6], [100, 43.3], [100, 52.7]], color: '#2b2b33' },
      { poly: [[26.2, 50.8], [25.5, 53.9], [23.5, 56.4], [20.6, 57.8], [17.4, 57.8], [14.5, 56.4], [12.5, 53.9], [11.8, 50.8], [12.5, 47.7], [14.5, 45.2], [17.4, 43.8], [20.6, 43.8], [23.5, 45.2], [25.5, 47.7]], color: '#9fb6d8' },
      { poly: [[87.2, 50.8], [86.5, 53.9], [84.5, 56.4], [81.6, 57.8], [78.4, 57.8], [75.5, 56.4], [73.5, 53.9], [72.8, 50.8], [73.5, 47.7], [75.5, 45.2], [78.4, 43.8], [81.6, 43.8], [84.5, 45.2], [86.5, 47.7]], color: '#5d86c9' },
    ],
    wheels: [[24, 48, 8], [74, 48, 8]],
    scale: 4.75,
  },
});

Object.assign(BLUEPRINTS, {
  // (ROADMAP 28.19) the heavy machine gun: drawn from its side - the butt, the body, the grip, the long barrel, the
  // legs under it, the tin its belt comes out of
  mag: {
    id: 'mag',
    name: tr('מאג', 'MAG'),
    nameEn: 'MAG',
    kind: 'weapon',
    difficulty: 3,
    desc: tr('מקלע כבד מוזן שרשרת. קליעי גרפיט כבדים, נותב כל רביעי. יציב על הדו-רגל כשכורעים, פרוע בתנועה — והקנה מתחמם.', 'A heavy belt-fed machine gun. Heavy graphite slugs, a tracer every fourth. Steady off its bipod when you kneel, wild on the move — and the barrel heats up.'),
    strokes: [
      { label: tr('גוף, קת וקנה', 'Body'), en: 'body', pts: close([[0, 30], [16, 28], [40, 28], [42, 31], [96, 31], [100, 34], [96, 37], [42, 37], [40, 42], [30, 42], [26, 54], [18, 54], [20, 42], [14, 40], [0, 44]]) },
      { label: tr('ארגז תחמושת', 'ammo box'), en: 'ammo box', pts: close([[32, 42], [44, 42], [44, 52], [32, 52]]) },
      { label: tr('חצובה', 'bipod'), en: 'bipod', pts: [[72, 54], [78, 37], [84, 54]] },
    ],
    fills: [
      { poly: [[0, 30], [16, 28], [40, 28], [42, 31], [96, 31], [100, 34], [96, 37], [42, 37], [40, 42], [30, 42], [26, 54], [18, 54], [20, 42], [14, 40], [0, 44]], color: '#8f6a3d' },
      { poly: [[32, 42], [44, 42], [44, 52], [32, 52]], color: '#4a4d58' },
    ],
    anchors: { muzzle: [97, 42.5], grip: [32, 58] },
    scale: 1.5,
  },
  // (ROADMAP 29.5, the plan's start kit) the marker SMG: drawn from its side - the body with its stock struts and a fat
  // marker for a barrel, the curved magazine leaning forward, the grip
  mp5: {
    id: 'mp5',
    name: tr('תת-מקלע טושים', 'Marker SMG'),
    nameEn: 'MARKER SMG',
    kind: 'weapon',
    difficulty: 2,
    desc: tr('תת-מקלע קצר ומהיר שיורה טוש: צרור צפוף של דיו בכל לחיצה ארוכה. מדויק מקרוב, מתפזר מרחוק.', 'A short, fast submachine gun that fires marker ink: a tight stream of it while you hold. Accurate up close, spreading at range.'),
    strokes: [
      { label: tr('גוף, קת וטוש', 'Body'), en: 'body', pts: close([[0, 24], [6, 24], [6, 30], [22, 30], [22, 22], [70, 22], [74, 26], [96, 26], [100, 30], [96, 34], [74, 34], [70, 38], [22, 38], [22, 34], [6, 34], [6, 40], [0, 40]]) },
      { label: tr('מחסנית מעוקלת', 'curved magazine'), en: 'magazine', pts: close([[50, 38], [56, 38], [62, 54], [66, 68], [58, 70], [54, 56]]) },
      { label: tr('ידית', 'grip'), en: 'grip', pts: [[32, 38], [28, 56], [38, 56], [40, 38]] },
    ],
    fills: [
      { poly: [[0, 24], [6, 24], [6, 30], [22, 30], [22, 22], [70, 22], [74, 26], [96, 26], [100, 30], [96, 34], [74, 34], [70, 38], [22, 38], [22, 34], [6, 34], [6, 40], [0, 40]], color: '#3a3d46' },
      { poly: [[50, 38], [56, 38], [62, 54], [66, 68], [58, 70], [54, 56]], color: '#2d6fd0' },
    ],
    anchors: { muzzle: [100, 30], grip: [34, 50] },
    scale: 1,
  },
  paramotor: {
    id: 'paramotor',
    name: tr('דריפטפאן P2', 'Driftfan P2'),
    nameEn: 'DRIFTFAN P2',
    kind: 'gear',
    difficulty: 3,
    desc: tr('מצנח רחיפה עם מנוע על הגב: רצים, קופצים ומחזיקים את כפתור הקפיצה — וממריאים מהרחוב. המנוע מטפס, הכנף גולשת.', 'A paraglider with a motor on your back: run, jump and hold the jump button — and take off from the street. The motor climbs, the wing glides.'),
    strokes: [
      { label: tr('כנף', 'wing'), en: 'wing', pts: close([[6, 26], [20, 12], [50, 6], [80, 12], [94, 26], [50, 20]]) },
      { label: tr('חבל', 'A rope'), en: 'line', pts: [[12, 24], [46, 62]] },
      { label: tr('חבל', 'A rope'), en: 'line', pts: [[88, 24], [54, 62]] },
      { label: tr('כלוב המדחף', 'fan cage'), en: 'fan cage', pts: circle(50, 74, 14) },
      { label: tr('מדחף', 'propeller'), en: 'propeller', pts: [[38, 74], [62, 74]] },
      { label: tr('מנוע', 'motor'), en: 'motor', pts: close([[46, 68], [54, 68], [54, 80], [46, 80]]) },
    ],
    fills: [
      { poly: [[6, 26], [20, 12], [50, 6], [80, 12], [94, 26], [50, 20]], color: '#3fa7d6' },
      { poly: [[46, 68], [54, 68], [54, 80], [46, 80]], color: '#d9513a' },
    ],
    scale: 2.6,
  },
});

// (ROADMAP 29.5) the car's parts found in the city, as their drawings on the walls - copied by finger to have them (game/finds.js).
// Never on the pen's shelves (hidden): read only against one another when one is being copied
Object.assign(BLUEPRINTS, {
  p_jet: {
    id: 'p_jet',
    name: tr('מאיץ רקטי', 'Rocket Booster'),
    nameEn: 'ROCKET BOOSTER',
    kind: 'part',
    hidden: true,
    difficulty: 2,
    desc: tr('מנוע רקטי לכל כלי: דחיפה אדירה על דלק משלו, גם באוויר.', 'A rocket motor for any ride: a huge push on its own fuel, in the air too.'),
    strokes: [
      { label: tr('גוף', 'body'), en: 'body', pts: close([[6, 40], [14, 30], [70, 30], [70, 50], [14, 50]]) },
      { label: tr('נחיר', 'nozzle'), en: 'nozzle', pts: close([[70, 33], [96, 24], [96, 56], [70, 47]]) },
      { label: tr('כנפון', 'fin'), en: 'fin', pts: [[22, 30], [12, 14], [40, 30]] },
    ],
    fills: [{ poly: [[6, 40], [14, 30], [70, 30], [70, 50], [14, 50]], color: '#c8483c' }],
    scale: 1,
  },
  p_wing: {
    id: 'p_wing',
    name: tr('כנפיים — דרגה 2', 'Wings — level 2'),
    nameEn: 'WINGS LEVEL 2',
    kind: 'part',
    hidden: true,
    difficulty: 2,
    desc: tr('זוג כנפיים חזק יותר: ממריאות מוקדם, מטפסות כמו מטוס קרב, עד גובה המגדלים.', 'A stronger pair of wings: they lift off sooner, climb like a fighter, up to the towers.'),
    strokes: [
      { label: tr('כנף שמאל', 'left wing'), en: 'left wing', pts: close([[46, 36], [4, 50], [6, 58], [46, 50]]) },
      { label: tr('כנף ימין', 'right wing'), en: 'right wing', pts: close([[54, 36], [96, 50], [94, 58], [54, 50]]) },
      { label: tr('גוף', 'body'), en: 'body', pts: close([[46, 24], [54, 24], [54, 70], [46, 70]]) },
    ],
    fills: [{ poly: [[46, 36], [4, 50], [6, 58], [46, 50]], color: '#3d7bd9' }],
    scale: 1,
  },
  p_rotor2: {
    id: 'p_rotor2',
    name: tr('רוטור כפול', 'Dual Rotor'),
    nameEn: 'DUAL ROTOR',
    kind: 'part',
    hidden: true,
    difficulty: 3,
    desc: tr('שני רוטורים על קורה: מרים כל כלי, גם כבד, ועף מהר וגבוה.', 'Two rotors on a beam: lifts any ride, a heavy one too, and flies fast and high.'),
    strokes: [
      { label: tr('רוטור', 'rotor'), en: 'rotor', pts: circle(26, 34, 22) },
      { label: tr('רוטור', 'rotor'), en: 'rotor', pts: circle(74, 34, 22) },
      { label: tr('קורה ותורן', 'beam and mast'), en: 'beam', pts: [[26, 34], [74, 34], [50, 34], [50, 64]] },
    ],
    fills: [],
    scale: 1,
  },
});

// (ROADMAP 28) rides put away: not on the pen's shelves, not read from a drawing - the ids, the models and what already
// holds one are as they were. later: a later tier's. (The guns are all as they were before stage 1: ROADMAP 28.16.) ?allgear=1 brings them all back to the shelves
const ALL_GEAR = typeof location !== 'undefined' && /[?&]allgear=1/.test(location.search);
if (!ALL_GEAR) {
  for (const id of ['bicycle', 'scooter', 'firetruck']) if (BLUEPRINTS[id]) BLUEPRINTS[id].hidden = true;
  for (const id of ['tank', 'armored', 'limo', 'monster']) {
    if (!BLUEPRINTS[id]) continue;
    BLUEPRINTS[id].hidden = true;
    BLUEPRINTS[id].later = true;
  }
}

export const BLUEPRINT_ORDER = ['paint', 'rifle', 'car', 'bazooka', 'tank', 'shield', 'stapler', 'bandage', 'shotgun', 'katana', 'glue', 'inkbomb', 'boomerang', 'planes', 'bike', 'laser', 'copter', 'minigun', 'tippex', 'erasermg', 'paintmg', 'parachute'];
// (ROADMAP 4.8: in the album, not with ?classic - and no boards of their own in the city)
export const BLUEPRINT_MORE = ['scooter', 'bicycle', 'jetski', 'boat', 'plane', 'hoverbike'];
// (the ones of them on boards up on the city's roofs - world/roofs.js, world/city.js: not one found somewhere of its own)
export const BLUEPRINT_ROOFS = BLUEPRINT_MORE.filter((id) => !BLUEPRINTS[id].noBoard);
// (ROADMAP 28: new things of the start - in the album and on the pen's shelf; no boards of their own in the city)
export const BLUEPRINT_NEW = ['paramotor', 'mag', 'mp5'];
// (ROADMAP 11.41: the catalog's cars - in the album, not with ?classic; no boards of their own)
export const BLUEPRINT_CARS = ['streetline', 'muscle', 'nightshift', 'hyper', 'trailforge', 'driftvan', 'cargobrute', 'interceptor', 'limo', 'monster', 'armored', 'firetruck'];
// (ROADMAP 9.2: in the album, not with ?classic; to be had in the shops, no boards of their own)
export const BLUEPRINT_TOOLS = ['ladder', 'ramp', 'bridge', 'barrier', 'umbrella', 'key'];

export function blueprintBounds(bp) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of bp.strokes) {
    for (const [x, y] of s.pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/**
 * Draw a blueprint in crayon + marker style into a canvas rectangle.
 * opts: { fills: true, width, color, seed, pad }
 */
export function drawBlueprint(ctx, bp, x, y, w, h, opts = {}) {
  const b = blueprintBounds(bp);
  const pad = opts.pad !== undefined ? opts.pad : 0.08;
  const s = Math.min((w * (1 - pad * 2)) / b.w, (h * (1 - pad * 2)) / b.h);
  const ox = x + (w - b.w * s) / 2 - b.x0 * s;
  const oy = y + (h - b.h * s) / 2 - b.y0 * s;
  const tr = (p) => [ox + p[0] * s, oy + p[1] * s];
  const sk = new Sketcher(ctx, opts.seed || 7);
  if (opts.fills !== false) {
    for (const f of bp.fills) sk.fill(f.poly.map(tr), f.color, { spacing: Math.max(2, s * 0.9), alpha: 0.8, overshoot: s * 0.6 });
  }
  const lw = opts.width || Math.max(2.5, s * 0.75);
  for (const st of bp.strokes) {
    sk.stroke(st.pts.map(tr), { width: lw, color: opts.color || '#1d1d24', jitter: opts.jitter !== undefined ? opts.jitter : s * 0.25, passes: 2 });
  }
  return { s, ox, oy };
}
