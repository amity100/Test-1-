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
};

export const BLUEPRINT_ORDER = ['paint', 'rifle', 'car', 'bazooka', 'tank', 'ufo'];

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
