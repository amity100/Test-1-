// Drawing templates ("blueprints") the player photographs on billboards and redraws.
// Coordinates: x 0..100 to the right, y down. Items face right (muzzle / front at high x).

import { Sketcher } from '../render/sketch2d.js';

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
    name: 'אקדח צבע',
    nameEn: 'PAINT BLASTER',
    kind: 'weapon',
    difficulty: 1,
    desc: 'יורה בלוני צבע צבעוניים. קל לצייר.',
    strokes: [
      { label: 'גוף', en: 'body', pts: close([[8, 30], [62, 30], [66, 34], [66, 42], [34, 42], [30, 64], [16, 64], [20, 42], [8, 42]]) },
      { label: 'מיכל צבע', en: 'paint tank', pts: circle(36, 21, 8) },
      { label: 'טיפת צבע', en: 'paint drop', pts: circle(77, 36, 5, 12) },
    ],
    fills: [
      { poly: [[8, 30], [62, 30], [66, 34], [66, 42], [34, 42], [30, 64], [16, 64], [20, 42], [8, 42]], color: '#d99a7e' },
      { poly: circle(36, 21, 8), color: '#93b4dc' },
      { poly: circle(77, 36, 5, 12), color: '#93b4dc' },
    ],
    anchors: { muzzle: [66, 36], grip: [24, 52] },
    scale: 0.85,
  },
  rifle: {
    id: 'rifle',
    name: 'רובה עפרונות',
    nameEn: 'PENCIL RIFLE',
    kind: 'weapon',
    difficulty: 2,
    desc: 'יורה עפרונות עם מחק שמוחקים חלקים מהאויבים.',
    strokes: [
      { label: 'קת', en: 'stock', pts: close([[4, 34], [18, 28], [64, 28], [64, 40], [30, 40], [26, 56], [18, 56], [20, 40], [4, 46]]) },
      { label: 'קנה-עיפרון', en: 'pencil barrel', pts: [[64, 30], [86, 30], [86, 38], [64, 38]] },
      { label: 'חוד', en: 'tip', pts: [[86, 30], [96, 34], [86, 38]] },
      { label: 'כוונת', en: 'scope', pts: close([[28, 18], [50, 18], [50, 24], [28, 24]]) },
      { label: 'רגל כוונת', en: 'mount', pts: [[34, 24], [34, 28]] },
      { label: 'רגל כוונת', en: 'mount', pts: [[44, 24], [44, 28]] },
      { label: 'מחסנית', en: 'magazine', pts: [[40, 40], [40, 52], [48, 52], [48, 40]] },
    ],
    fills: [
      { poly: [[4, 34], [18, 28], [64, 28], [64, 40], [30, 40], [26, 56], [18, 56], [20, 40], [4, 46]], color: '#c4a27e' },
      { poly: [[64, 30], [86, 30], [86, 38], [64, 38]], color: '#ecd27a' },
      { poly: [[86, 30], [96, 34], [86, 38]], color: '#e3cdb2' },
      { poly: [[28, 18], [50, 18], [50, 24], [28, 24]], color: '#8e8e98' },
      { poly: [[40, 40], [40, 52], [48, 52], [48, 40]], color: '#a9a9b2' },
    ],
    anchors: { muzzle: [96, 34], grip: [22, 48] },
    scale: 1.25,
  },
  car: {
    id: 'car',
    name: 'מכונית שרבוט',
    nameEn: 'SCRIBBLE CAR',
    kind: 'vehicle',
    difficulty: 2,
    desc: 'נוהגים בה ברחבי העיר ודורסים אויבים.',
    strokes: [
      { label: 'גוף', en: 'body', pts: close([[6, 46], [6, 34], [24, 34], [34, 20], [64, 20], [76, 34], [94, 36], [94, 46]]) },
      { label: 'קו חלונות', en: 'window line', pts: [[24, 34], [76, 34]] },
      { label: 'עמוד', en: 'pillar', pts: [[49, 20], [49, 34]] },
      { label: 'גלגל', en: 'wheel', pts: circle(26, 48, 8) },
      { label: 'גלגל', en: 'wheel', pts: circle(74, 48, 8) },
    ],
    fills: [
      { poly: [[6, 46], [6, 34], [24, 34], [34, 20], [64, 20], [76, 34], [94, 36], [94, 46]], color: '#cf8a82' },
      { poly: [[26, 33], [35, 22], [48, 22], [48, 33]], color: '#c3d6ea' },
      { poly: [[50, 33], [50, 22], [63, 22], [73, 33]], color: '#c3d6ea' },
      { poly: circle(26, 48, 8), color: '#6e6e78' },
      { poly: circle(74, 48, 8), color: '#6e6e78' },
    ],
    wheels: [[26, 48, 8], [74, 48, 8]],
    scale: 4.4,
  },
  bazooka: {
    id: 'bazooka',
    name: 'בזוקת מחקים',
    nameEn: 'ERASER BAZOOKA',
    kind: 'weapon',
    difficulty: 3,
    desc: 'משגרת מחק ענק שמוחק כל מה שמסביב.',
    strokes: [
      { label: 'צינור', en: 'tube', pts: close([[8, 28], [72, 28], [72, 42], [8, 42]]) },
      { label: 'פתח', en: 'muzzle', pts: [[72, 26], [82, 22], [82, 48], [72, 44]] },
      { label: 'מחק', en: 'eraser', pts: [[82, 28], [93, 28], [97, 32], [97, 38], [93, 42], [82, 42]] },
      { label: 'ידית', en: 'grip', pts: [[26, 42], [24, 56], [32, 56], [34, 42]] },
      { label: 'ידית', en: 'grip', pts: [[48, 42], [48, 52], [56, 52], [56, 42]] },
      { label: 'כוונת', en: 'scope', pts: [[36, 28], [36, 20], [44, 20], [44, 28]] },
      { label: 'פס', en: 'stripe', pts: [[16, 28], [16, 42]] },
      { label: 'פס', en: 'stripe', pts: [[64, 28], [64, 42]] },
    ],
    fills: [
      { poly: [[8, 28], [72, 28], [72, 42], [8, 42]], color: '#9fb98c' },
      { poly: [[72, 26], [82, 22], [82, 48], [72, 44]], color: '#7d9a6c' },
      { poly: [[82, 28], [93, 28], [97, 32], [97, 38], [93, 42], [82, 42]], color: '#e3aab8' },
      { poly: [[26, 42], [24, 56], [32, 56], [34, 42]], color: '#77777f' },
      { poly: [[48, 42], [48, 52], [56, 52], [56, 42]], color: '#77777f' },
    ],
    anchors: { muzzle: [90, 35], grip: [28, 50] },
    scale: 1.55,
  },
  tank: {
    id: 'tank',
    name: 'טנק מטורף',
    nameEn: 'CRAZY TANK',
    kind: 'vehicle',
    difficulty: 4,
    desc: 'טנק משוריין עם תותח מחקים. כמעט בלתי ניתן לעצירה.',
    strokes: [
      { label: 'זחל', en: 'track', pts: stadium(6, 54, 94, 72) },
      { label: 'גלגל', en: 'wheel', pts: circle(18, 63, 5.5, 12) },
      { label: 'גלגל', en: 'wheel', pts: circle(34, 63, 5.5, 12) },
      { label: 'גלגל', en: 'wheel', pts: circle(50, 63, 5.5, 12) },
      { label: 'גלגל', en: 'wheel', pts: circle(66, 63, 5.5, 12) },
      { label: 'גלגל', en: 'wheel', pts: circle(82, 63, 5.5, 12) },
      { label: 'שלדה', en: 'hull', pts: [[10, 54], [16, 44], [84, 44], [90, 54]] },
      { label: 'צריח', en: 'turret', pts: [[30, 44], [34, 32], [60, 32], [64, 44]] },
      { label: 'קנה', en: 'barrel', pts: [[60, 35], [96, 35], [96, 40], [62, 40]] },
      { label: 'פתח עליון', en: 'hatch', pts: [[40, 32], [42, 27], [52, 27], [54, 32]] },
      { label: 'אנטנה', en: 'antenna', pts: [[38, 27], [32, 8]] },
      { label: 'דגל', en: 'flag', pts: [[32, 8], [44, 11], [33, 15]] },
      { label: 'מחרשה', en: 'plow', pts: [[90, 54], [98, 50], [94, 58], [99, 64], [92, 68]] },
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
  ufo: {
    id: 'ufo',
    name: 'חללית חייזרים',
    nameEn: 'ALIEN SAUCER',
    kind: 'vehicle',
    difficulty: 5,
    desc: 'עפה מעל העיר וקרן הלייזר שלה מוחקת הכל.',
    strokes: [
      { label: 'צלחת', en: 'saucer', pts: ellipse(50, 46, 44, 11, 28) },
      { label: 'כיפה', en: 'dome', pts: ellipse(50, 41, 20, 25, 16, PI, PI * 2) },
      { label: 'ראש חייזר', en: 'pilot', pts: circle(50, 30, 8, 14) },
      { label: 'עין', en: 'eye', pts: circle(46.5, 30, 2.4, 8) },
      { label: 'עין', en: 'eye', pts: circle(53.5, 30, 2.4, 8) },
      { label: 'מחוש', en: 'antenna', pts: [[46, 23], [42, 15]] },
      { label: 'מחוש', en: 'antenna', pts: [[54, 23], [58, 15]] },
      { label: 'נורה', en: 'light', pts: circle(18, 46, 3, 10) },
      { label: 'נורה', en: 'light', pts: circle(34, 47, 3, 10) },
      { label: 'נורה', en: 'light', pts: circle(50, 47.5, 3, 10) },
      { label: 'נורה', en: 'light', pts: circle(66, 47, 3, 10) },
      { label: 'נורה', en: 'light', pts: circle(82, 46, 3, 10) },
      { label: 'בסיס', en: 'base', pts: [[34, 55], [40, 62], [60, 62], [66, 55]] },
      { label: 'קרן', en: 'beam', pts: [[40, 62], [26, 92], [74, 92], [60, 62]] },
    ],
    fills: [
      { poly: ellipse(50, 46, 44, 11, 28), color: '#c6cbd4' },
      { poly: ellipse(50, 41, 20, 25, 16, PI, PI * 2), color: '#cfe5e8' },
      { poly: circle(50, 30, 8, 14), color: '#a9cf97' },
      { poly: [[40, 62], [26, 92], [74, 92], [60, 62]], color: '#d8ecc6' },
      { poly: circle(18, 46, 3, 10), color: '#ecd87e' },
      { poly: circle(34, 47, 3, 10), color: '#ecd87e' },
      { poly: circle(50, 47.5, 3, 10), color: '#ecd87e' },
      { poly: circle(66, 47, 3, 10), color: '#ecd87e' },
      { poly: circle(82, 46, 3, 10), color: '#ecd87e' },
    ],
    scale: 9,
  },
  // ------------------------------------------------------------------ the new arsenal
  shotgun: {
    id: 'shotgun',
    name: 'רובה ציד צבעוני',
    nameEn: 'CRAYON SHOTGUN',
    kind: 'weapon',
    difficulty: 2,
    desc: 'יורה מטח של שמונה עפרונות שעווה. הורס מקרוב.',
    strokes: [
      { label: 'קת', en: 'stock', pts: close([[4, 42], [20, 33], [38, 33], [38, 45], [24, 46], [8, 54]]) },
      { label: 'גוף', en: 'receiver', pts: close([[38, 31], [60, 31], [60, 44], [38, 44]]) },
      { label: 'קנה', en: 'barrel', pts: close([[60, 32], [95, 32], [95, 38], [60, 38]]) },
      { label: 'משאבה', en: 'pump', pts: close([[64, 39], [86, 39], [86, 45], [64, 45]]) },
      { label: 'ידית', en: 'grip', pts: [[44, 44], [41, 58], [49, 58], [52, 44]] },
      { label: 'חוד שעווה', en: 'crayon tip', pts: [[95, 31], [100, 35], [95, 39]] },
    ],
    fills: [
      { poly: [[4, 42], [20, 33], [38, 33], [38, 45], [24, 46], [8, 54]], color: '#c27a4a' },
      { poly: [[38, 31], [60, 31], [60, 44], [38, 44]], color: '#7c8190' },
      { poly: [[60, 32], [95, 32], [95, 38], [60, 38]], color: '#f0c040' },
      { poly: [[64, 39], [86, 39], [86, 45], [64, 45]], color: '#d0574f' },
      { poly: [[44, 44], [41, 58], [49, 58], [52, 44]], color: '#5c5f6a' },
      { poly: [[95, 31], [100, 35], [95, 39]], color: '#e65a4a' },
    ],
    anchors: { muzzle: [99, 35], grip: [46, 54] },
    scale: 1.25,
    thickness: 0.05,
  },
  stapler: {
    id: 'stapler',
    name: 'אקדח שדכן',
    nameEn: 'STAPLE GUN',
    kind: 'weapon',
    difficulty: 1,
    desc: 'מכונת יריה של סיכות. כל סיכה מסמררת את האויב למקום לרגע.',
    strokes: [
      { label: 'זרוע', en: 'top arm', pts: close([[8, 24], [78, 24], [86, 29], [86, 36], [8, 36]]) },
      { label: 'בסיס', en: 'base', pts: close([[8, 40], [90, 40], [90, 47], [8, 47]]) },
      { label: 'ציר', en: 'hinge', pts: circle(12, 38, 5, 12) },
      { label: 'ידית', en: 'grip', pts: [[30, 47], [26, 66], [38, 66], [42, 47]] },
      { label: 'סיכה', en: 'staple', pts: [[89, 30], [89, 35], [97, 35], [97, 30]] },
    ],
    fills: [
      { poly: [[8, 24], [78, 24], [86, 29], [86, 36], [8, 36]], color: '#d23c46' },
      { poly: [[8, 40], [90, 40], [90, 47], [8, 47]], color: '#373a46' },
      { poly: circle(12, 38, 5, 12), color: '#a2a8b4' },
      { poly: [[30, 47], [26, 66], [38, 66], [42, 47]], color: '#373a46' },
    ],
    anchors: { muzzle: [90, 33], grip: [34, 60] },
    scale: 0.72,
    thickness: 0.05,
  },
  katana: {
    id: 'katana',
    name: 'חרב סרגל',
    nameEn: 'RULER KATANA',
    kind: 'weapon',
    difficulty: 2,
    desc: 'סרגל של שלושים סנטימטר שהושחז לחרב. חותך גפיים במכה אחת.',
    strokes: [
      { label: 'להב-סרגל', en: 'ruler blade', pts: close([[30, 30], [93, 30], [99, 34], [93, 38], [30, 38]]) },
      { label: 'שנתה', en: 'tick', pts: [[45, 30], [45, 34]] },
      { label: 'שנתה', en: 'tick', pts: [[60, 30], [60, 34]] },
      { label: 'שנתה', en: 'tick', pts: [[75, 30], [75, 34]] },
      { label: 'מגן יד', en: 'guard', pts: close([[25, 23], [30, 23], [30, 45], [25, 45]]) },
      { label: 'ידית', en: 'handle', pts: close([[3, 31], [25, 31], [25, 37], [3, 37]]) },
      { label: 'ליפוף', en: 'wrap', pts: [[6, 31], [10, 37], [14, 31], [18, 37], [22, 31]] },
    ],
    fills: [
      { poly: [[30, 30], [93, 30], [99, 34], [93, 38], [30, 38]], color: '#f3df8a' },
      { poly: [[25, 23], [30, 23], [30, 45], [25, 45]], color: '#2c2d36' },
      { poly: [[3, 31], [25, 31], [25, 37], [3, 37]], color: '#3d4a8c' },
    ],
    anchors: { grip: [14, 34], tip: [98, 34] },
    scale: 1.3,
    thickness: 0.02,
  },
  planes: {
    id: 'planes',
    name: 'משגר מטוסי נייר',
    nameEn: 'PAPER PLANE LAUNCHER',
    kind: 'weapon',
    difficulty: 3,
    desc: 'משגר מטוסי נייר מתבייתים שמוצאים את האויב לבד ומתפוצצים בקונפטי.',
    strokes: [
      { label: 'צינור', en: 'tube', pts: close([[10, 34], [68, 34], [68, 50], [10, 50]]) },
      { label: 'פתח', en: 'mouth', pts: close([[68, 30], [76, 27], [76, 57], [68, 54]]) },
      { label: 'מטוס נייר', en: 'paper plane', pts: close([[76, 37], [99, 42], [76, 47], [83, 42]]) },
      { label: 'קיפול', en: 'fold', pts: [[83, 42], [99, 42]] },
      { label: 'ידית', en: 'grip', pts: [[24, 50], [21, 66], [30, 66], [33, 50]] },
      { label: 'כוונת', en: 'sight', pts: close([[28, 26], [42, 26], [42, 34], [28, 34]]) },
    ],
    fills: [
      { poly: [[10, 34], [68, 34], [68, 50], [10, 50]], color: '#5f86b8' },
      { poly: [[68, 30], [76, 27], [76, 57], [68, 54]], color: '#47689a' },
      { poly: [[76, 37], [99, 42], [76, 47], [83, 42]], color: '#fbf8ef' },
      { poly: [[24, 50], [21, 66], [30, 66], [33, 50]], color: '#4e505c' },
      { poly: [[28, 26], [42, 26], [42, 34], [28, 34]], color: '#8c8f99' },
    ],
    anchors: { muzzle: [97, 42], grip: [26, 61] },
    scale: 1.4,
    thickness: 0.07,
  },
  inkbomb: {
    id: 'inkbomb',
    name: 'רימון דיו',
    nameEn: 'INK GRENADE',
    kind: 'weapon',
    difficulty: 2,
    desc: 'בקבוק דיו עם פתיל. זורקים, והוא מתפוצץ בכתם ענק שמוחק את כל מי שבסביבה.',
    strokes: [
      { label: 'בקבוק', en: 'bottle', pts: close([[26, 46], [34, 40], [66, 40], [74, 46], [74, 80], [26, 80]]) },
      { label: 'צוואר', en: 'neck', pts: close([[40, 30], [60, 30], [60, 40], [40, 40]]) },
      { label: 'פתיל', en: 'fuse', pts: [[50, 30], [52, 20], [60, 14], [66, 16]] },
      { label: 'תווית', en: 'label', pts: close([[33, 54], [67, 54], [67, 70], [33, 70]]) },
      { label: 'טיפה', en: 'drop', pts: circle(50, 62, 4, 10) },
    ],
    fills: [
      { poly: [[26, 46], [34, 40], [66, 40], [74, 46], [74, 80], [26, 80]], color: '#24337e' },
      { poly: [[40, 30], [60, 30], [60, 40], [40, 40]], color: '#24337e' },
      { poly: [[33, 54], [67, 54], [67, 70], [33, 70]], color: '#f4efe0' },
      { poly: circle(50, 62, 4, 10), color: '#24337e' },
    ],
    anchors: { muzzle: [50, 30], grip: [50, 64] },
    scale: 0.42,
    thickness: 0.12,
  },
  glue: {
    id: 'glue',
    name: 'אקדח דבק',
    nameEn: 'GLUE GUN',
    kind: 'weapon',
    difficulty: 2,
    desc: 'יורה טיפות דבק חם. מי שנדבק — לא זז לשום מקום.',
    strokes: [
      { label: 'גוף', en: 'body', pts: close([[20, 26], [64, 26], [72, 32], [72, 44], [20, 44]]) },
      { label: 'חרטום', en: 'nozzle', pts: close([[72, 35], [92, 38], [92, 40], [72, 42]]) },
      { label: 'ידית', en: 'grip', pts: [[30, 44], [24, 72], [38, 72], [44, 44]] },
      { label: 'הדק', en: 'trigger', pts: [[46, 44], [48, 55], [53, 45]] },
      { label: 'מקל דבק', en: 'glue stick', pts: close([[2, 30], [20, 30], [20, 40], [2, 40]]) },
      { label: 'טיפת דבק', en: 'glue drip', pts: circle(92, 45, 3.5, 10) },
    ],
    fills: [
      { poly: [[20, 26], [64, 26], [72, 32], [72, 44], [20, 44]], color: '#e8853a' },
      { poly: [[72, 35], [92, 38], [92, 40], [72, 42]], color: '#a3a9b3' },
      { poly: [[30, 44], [24, 72], [38, 72], [44, 44]], color: '#4a4b55' },
      { poly: [[2, 30], [20, 30], [20, 40], [2, 40]], color: '#eef1f2' },
      { poly: circle(92, 45, 3.5, 10), color: '#f4f4f0' },
    ],
    anchors: { muzzle: [92, 39], grip: [32, 64] },
    scale: 0.82,
    thickness: 0.07,
  },
  laser: {
    id: 'laser',
    name: 'לייזר מרקר זוהר',
    nameEn: 'HIGHLIGHTER LASER',
    kind: 'weapon',
    difficulty: 4,
    desc: 'מרקר זוהר שיורה קרן זוהרת רציפה. מוחק אויבים — ואפילו חותך קירות.',
    strokes: [
      { label: 'גוף מרקר', en: 'marker body', pts: close([[18, 30], [68, 30], [76, 35], [76, 47], [68, 52], [18, 52]]) },
      { label: 'מכסה', en: 'cap', pts: close([[6, 32], [18, 32], [18, 50], [6, 50]]) },
      { label: 'חוד', en: 'chisel tip', pts: close([[76, 37], [92, 39], [92, 43], [76, 45]]) },
      { label: 'קרן', en: 'beam', pts: [[94, 41], [99, 41]] },
      { label: 'ידית', en: 'grip', pts: [[32, 52], [28, 72], [40, 72], [44, 52]] },
      { label: 'זרם', en: 'energy', pts: [[22, 41], [32, 36], [42, 46], [52, 36], [62, 41]] },
    ],
    fills: [
      { poly: [[18, 30], [68, 30], [76, 35], [76, 47], [68, 52], [18, 52]], color: '#e9f23a' },
      { poly: [[6, 32], [18, 32], [18, 50], [6, 50]], color: '#30313a' },
      { poly: [[76, 37], [92, 39], [92, 43], [76, 45]], color: '#f7ff70' },
      { poly: [[32, 52], [28, 72], [40, 72], [44, 52]], color: '#30313a' },
    ],
    anchors: { muzzle: [92, 41], grip: [36, 64] },
    scale: 1.1,
    thickness: 0.08,
  },
  boomerang: {
    id: 'boomerang',
    name: 'מספריים בומרנג',
    nameEn: 'SCISSOR BOOMERANG',
    kind: 'weapon',
    difficulty: 3,
    desc: 'זורקים — והמספריים עפים, גוזרים את כל מי שבדרך וחוזרים ליד.',
    strokes: [
      { label: 'להב', en: 'blade', pts: close([[36, 40], [52, 44], [97, 34], [52, 40]]) },
      { label: 'להב', en: 'blade', pts: close([[36, 52], [52, 48], [97, 58], [52, 52]]) },
      { label: 'טבעת', en: 'ring', pts: circle(24, 34, 10, 16) },
      { label: 'טבעת', en: 'ring', pts: circle(24, 58, 10, 16) },
      { label: 'בורג', en: 'screw', pts: circle(52, 46, 3, 10) },
    ],
    fills: [
      { poly: [[36, 40], [52, 44], [97, 34], [52, 40]], color: '#c6ced8' },
      { poly: [[36, 52], [52, 48], [97, 58], [52, 52]], color: '#c6ced8' },
      { poly: circle(24, 34, 10, 16), color: '#d8424f' },
      { poly: circle(24, 58, 10, 16), color: '#d8424f' },
      { poly: circle(52, 46, 3, 10), color: '#5a5d66' },
    ],
    anchors: { muzzle: [96, 46], grip: [24, 46] },
    scale: 0.8,
    thickness: 0.03,
  },
  minigun: {
    id: 'minigun',
    name: 'מיניגאן מחדדים',
    nameEn: 'SHARPENER MINIGUN',
    kind: 'weapon',
    difficulty: 5,
    desc: 'מחדד ענק עם שישה קנים. מסתובב, ואז יורק מאות עפרונות מחודדים בשנייה.',
    strokes: [
      { label: 'קנים', en: 'barrels', pts: close([[42, 30], [94, 30], [94, 50], [42, 50]]) },
      { label: 'קו קנה', en: 'barrel line', pts: [[42, 37], [94, 37]] },
      { label: 'קו קנה', en: 'barrel line', pts: [[42, 43], [94, 43]] },
      { label: 'מחדד', en: 'sharpener', pts: close([[16, 24], [42, 24], [42, 56], [16, 56]]) },
      { label: 'ידית נשיאה', en: 'handle', pts: [[22, 24], [22, 14], [36, 14], [36, 24]] },
      { label: 'ידית', en: 'grip', pts: [[24, 56], [20, 74], [32, 74], [36, 56]] },
      { label: 'תיבת עפרונות', en: 'pencil box', pts: close([[2, 36], [16, 36], [16, 62], [2, 62]]) },
    ],
    fills: [
      { poly: [[42, 30], [94, 30], [94, 50], [42, 50]], color: '#9aa4b0' },
      { poly: [[16, 24], [42, 24], [42, 56], [16, 56]], color: '#c9473e' },
      { poly: [[24, 56], [20, 74], [32, 74], [36, 56]], color: '#3d3e48' },
      { poly: [[2, 36], [16, 36], [16, 62], [2, 62]], color: '#6f7f4c' },
    ],
    anchors: { muzzle: [94, 40], grip: [28, 68] },
    scale: 1.5,
    thickness: 0.12,
  },
  shield: {
    id: 'shield',
    name: 'מגן קרטון',
    nameEn: 'CARDBOARD SHIELD',
    kind: 'weapon',
    difficulty: 1,
    desc: 'קרטון עבה עם סלוטייפ. עוצר כמעט כל ירייה מקדימה — ואפשר גם להכות איתו.',
    strokes: [
      { label: 'קרטון', en: 'board', pts: close([[18, 8], [82, 8], [88, 14], [88, 86], [82, 92], [18, 92], [12, 86], [12, 14]]) },
      { label: 'סלוטייפ', en: 'tape', pts: [[12, 42], [88, 46]] },
      { label: 'כוכב', en: 'star', pts: close([[50, 28], [56, 44], [73, 44], [59, 54], [64, 71], [50, 61], [36, 71], [41, 54], [27, 44], [44, 44]]) },
    ],
    fills: [
      { poly: [[18, 8], [82, 8], [88, 14], [88, 86], [82, 92], [18, 92], [12, 86], [12, 14]], color: '#c99a5f' },
      { poly: [[50, 28], [56, 44], [73, 44], [59, 54], [64, 71], [50, 61], [36, 71], [41, 54], [27, 44], [44, 44]], color: '#e04f4f' },
    ],
    anchors: { grip: [50, 50], tip: [50, 50] },
    scale: 0.95,
    thickness: 0.03,
  },
  bandage: {
    id: 'bandage',
    name: 'פלסטר ענק',
    nameEn: 'GIANT BAND-AID',
    kind: 'heal',
    difficulty: 1,
    desc: 'מציירים פלסטר — וכל החורים שנמחקו בך נסגרים. חיים מלאים.',
    strokes: [
      { label: 'פלסטר', en: 'strip', pts: stadium(6, 36, 94, 62) },
      { label: 'רפידה', en: 'pad', pts: close([[38, 38], [62, 38], [62, 60], [38, 60]]) },
      { label: 'חור', en: 'hole', pts: circle(20, 49, 2.2, 8) },
      { label: 'חור', en: 'hole', pts: circle(80, 49, 2.2, 8) },
    ],
    fills: [
      { poly: stadium(6, 36, 94, 62), color: '#e9b893' },
      { poly: [[38, 38], [62, 38], [62, 60], [38, 60]], color: '#f7f1e5' },
    ],
    scale: 0.6,
  },
  bike: {
    id: 'bike',
    name: 'אופנוע שרבוט',
    nameEn: 'SCRIBBLE BIKE',
    kind: 'vehicle',
    difficulty: 3,
    desc: 'אופנוע מהיר וזריז. משתחל בין המכוניות ונוטה בפניות.',
    strokes: [
      { label: 'גוף', en: 'fairing', pts: close([[28, 52], [38, 36], [68, 36], [78, 50], [60, 58], [40, 58]]) },
      { label: 'מושב', en: 'seat', pts: close([[30, 30], [64, 30], [70, 36], [28, 36]]) },
      { label: 'גלגל', en: 'wheel', pts: circle(18, 62, 14, 18) },
      { label: 'גלגל', en: 'wheel', pts: circle(82, 62, 14, 18) },
      { label: 'כידון', en: 'handlebar', pts: [[68, 36], [74, 18], [84, 18]] },
      { label: 'מזלג', en: 'fork', pts: [[74, 30], [82, 62]] },
      { label: 'אגזוז', en: 'exhaust', pts: [[36, 54], [8, 52]] },
    ],
    fills: [
      { poly: [[28, 52], [38, 36], [68, 36], [78, 50], [60, 58], [40, 58]], color: '#d8463b' },
      { poly: [[30, 30], [64, 30], [70, 36], [28, 36]], color: '#2f3038' },
      { poly: circle(18, 62, 14, 18), color: '#3a3a42' },
      { poly: circle(82, 62, 14, 18), color: '#3a3a42' },
    ],
    wheels: [[18, 62, 14], [82, 62, 14]],
    scale: 2.2,
  },
  copter: {
    id: 'copter',
    name: 'מסוק נייר',
    nameEn: 'PAPER COPTER',
    kind: 'vehicle',
    difficulty: 4,
    desc: 'מסוק מקופל מדף מחברת. טס מעל הגגות ומטיל מטוסי נייר.',
    strokes: [
      { label: 'תא', en: 'cabin', pts: ellipse(44, 50, 26, 16, 24) },
      { label: 'זנב', en: 'tail', pts: close([[66, 46], [96, 42], [96, 48], [66, 54]]) },
      { label: 'כנף זנב', en: 'tail fin', pts: [[92, 42], [98, 30], [99, 46]] },
      { label: 'חלון', en: 'window', pts: ellipse(34, 46, 10, 8, 14) },
      { label: 'תורן', en: 'mast', pts: [[44, 34], [44, 22]] },
      { label: 'רוטור', en: 'rotor', pts: [[8, 22], [80, 22]] },
      { label: 'מגלש', en: 'skid', pts: [[24, 74], [66, 74]] },
    ],
    fills: [
      { poly: ellipse(44, 50, 26, 16, 24), color: '#f3efe2' },
      { poly: [[66, 46], [96, 42], [96, 48], [66, 54]], color: '#f3efe2' },
      { poly: ellipse(34, 46, 10, 8, 14), color: '#bcd8ea' },
    ],
    scale: 6,
  },
};

export const BLUEPRINT_ORDER = ['paint', 'rifle', 'car', 'bazooka', 'tank', 'ufo', 'shield', 'stapler', 'bandage', 'shotgun', 'katana', 'glue', 'inkbomb', 'boomerang', 'planes', 'bike', 'laser', 'copter', 'minigun'];

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
