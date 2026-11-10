import { FONT_SIGN, FONT_NOTE, FONT_UI, INK2D, BLACK2D } from '../render/sketch2d.js';

// The city's advertising, the way real ads look - a big bold brand, a hero picture, a slogan, a
// price - only every brand in this city draws: the sneakers are drawn, the phone comes with
// erasers, the lawyer sues over erasers. (All the brands are made up.) Each ad is a 512 x 256 cell
// of the board atlas (boards.js), drawn with the same pens as everything else.

const PI = Math.PI;

// ---- little helpers
function bg(sk, c, w, h, color, tex) {
  c.fillStyle = color;
  c.fillRect(0, 0, w, h);
  if (tex) sk.fill([[0, 0], [w, 0], [w, h], [0, h]], tex, { spacing: 4, alpha: 0.28, overshoot: 0, angle: -0.5 });
}
function gradient(c, w, h, stops, vertical = true) {
  const g = vertical ? c.createLinearGradient(0, 0, 0, h) : c.createLinearGradient(0, 0, w, 0);
  stops.forEach(([t, col]) => g.addColorStop(t, col));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}
function border(sk, w, h, color = BLACK2D, width = 6) {
  sk.poly([[5, 5], [w - 5, 5], [w - 5, h - 5], [5, h - 5]], true, { width, color });
}
function corp(sk, text, x, y, size, color, o = {}) {
  sk.text(text, x, y, { size, color, font: FONT_UI, weight: o.weight || 800, dir: 'ltr', align: o.align || 'center', maxWidth: o.maxWidth, outline: o.outline, outlineWidth: o.outlineWidth, rotate: o.rotate, passes: 1 });
}
function marker(sk, text, x, y, size, color, o = {}) {
  sk.text(text, x, y, { size, color, font: FONT_SIGN, weight: 400, dir: 'ltr', align: o.align || 'center', maxWidth: o.maxWidth, outline: o.outline, outlineWidth: o.outlineWidth || 7, rotate: o.rotate });
}
function note(sk, text, x, y, size, color, o = {}) {
  sk.text(text, x, y, { size, color, font: FONT_NOTE, weight: 700, dir: 'ltr', align: o.align || 'center', maxWidth: o.maxWidth, rotate: o.rotate, outline: o.outline, outlineWidth: o.outlineWidth });
}
function shape(sk, pts, fill, line = BLACK2D, width = 3.2, o = {}) {
  sk.paper(pts, fill);
  if (o.tex) sk.fill(pts, o.tex, { spacing: 3, alpha: 0.5, overshoot: 0, angle: o.angle });
  sk.poly(pts, true, { width, color: line });
}
function oval(cx, cy, rx, ry, n = 28, a0 = 0, a1 = PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return pts;
}
function roundRect(x, y, w, h, r, n = 5) {
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= n; i++) {
      const t = a0 + (i / n) * (PI / 2);
      pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
  };
  corner(x + w - r, y + r, -PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, PI / 2);
  corner(x + r, y + r, PI);
  return pts;
}
function speedLines(sk, x0, x1, ys, color, width = 3) {
  for (const y of ys) sk.line(x0 + sk.r(0, 20), y, x1 - sk.r(0, 20), y, { width, color, overshoot: 0 });
}
function sparkle(sk, x, y, r, color) {
  sk.line(x - r, y, x + r, y, { width: 2.4, color, overshoot: 0 });
  sk.line(x, y - r, x, y + r, { width: 2.4, color, overshoot: 0 });
  sk.line(x - r * 0.5, y - r * 0.5, x + r * 0.5, y + r * 0.5, { width: 1.6, color, overshoot: 0 });
  sk.line(x - r * 0.5, y + r * 0.5, x + r * 0.5, y - r * 0.5, { width: 1.6, color, overshoot: 0 });
}
function zigzag(x, y, s) {
  return [[x, y + s * 0.5], [x + s * 0.45, y - s * 0.05], [x + s * 0.4, y + s * 0.2], [x + s, y - s * 0.5], [x + s * 0.55, y + s * 0.05], [x + s * 0.6, y - s * 0.2]];
}

// ---- the ads
export const ADS2 = {
  // sneakers: "draw your shoes now" - we draw the best shoes in town
  ad_shoes(sk, c, w, h) {
    bg(sk, c, w, h, '#ff7a2f', '#ff9d5c');
    speedLines(sk, 16, 120, [128, 150, 172, 194], '#fff3e0', 4);
    const sole = [[46, 206], [262, 206], [290, 196], [288, 182], [44, 186]];
    const upper = [[50, 186], [54, 146], [86, 126], [126, 118], [150, 98], [178, 98], [196, 128], [236, 148], [272, 160], [288, 182]];
    shape(sk, upper, '#f8f6f0', BLACK2D, 3.6, { tex: '#d9dde8', angle: 1.2 });
    shape(sk, sole, '#ffffff', BLACK2D, 3.6);
    sk.line(52, 196, 280, 194, { width: 2, color: BLACK2D });
    shape(sk, zigzag(110, 160, 92), '#1b1430', BLACK2D, 2);
    for (let i = 0; i < 4; i++) sk.line(160 + i * 11, 108 + i * 8, 178 + i * 11, 104 + i * 9, { width: 2.6, color: BLACK2D });
    shape(sk, [[54, 150], [64, 146], [70, 184], [52, 184]], '#ff3b6b', BLACK2D, 2.2);
    marker(sk, 'DRAW YOUR', 400, 56, 46, '#ffffff', { outline: '#1b1430', maxWidth: 210 });
    marker(sk, 'SHOES NOW', 400, 106, 46, '#ffffff', { outline: '#1b1430', maxWidth: 210 });
    corp(sk, 'STRYDE', 392, 168, 42, '#1b1430', { maxWidth: 170 });
    shape(sk, zigzag(470, 168, 28), '#1b1430', '#1b1430', 1.5);
    note(sk, 'we draw the best shoes in town', 392, 214, 25, '#1b1430', { maxWidth: 220 });
    border(sk, w, h);
  },
  // a phone: the Pencil 12, now with three erasers
  ad_phone2(sk, c, w, h) {
    gradient(c, w, h, [[0, '#1b2a64'], [1, '#0d1430']]);
    for (let i = 0; i < 26; i++) sparkle(sk, sk.r(10, w - 10), sk.r(10, h - 10), sk.r(1.5, 3.5), 'rgba(255,255,255,0.5)');
    const body = roundRect(66, 26, 104, 206, 16);
    shape(sk, body, '#2b2b36', '#0a0a10', 3.4);
    const scr = roundRect(76, 40, 84, 176, 9);
    c.save();
    sk.path(scr);
    c.clip();
    gradient(c, w, h, [[0.1, '#ffd36b'], [0.45, '#ff6fa1'], [0.85, '#6b4fd8']]);
    c.restore();
    sk.poly(scr, true, { width: 2, color: '#0a0a10' });
    sk.circle(118, 120, 22, { width: 3, color: '#ffffff' });
    sk.stroke([[106, 124], [118, 134], [132, 108]], { width: 3, color: '#ffffff', passes: 1 });
    // the stylus: a pencil with an eraser on each end
    const pen = [[188, 222], [196, 228], [252, 40], [244, 36]];
    shape(sk, pen, '#f5c242', BLACK2D, 2.6);
    shape(sk, [[244, 36], [252, 40], [258, 20], [250, 18]], '#ee8d9b', BLACK2D, 2.2);
    shape(sk, [[188, 222], [196, 228], [190, 246], [182, 240]], '#7d93d8', BLACK2D, 2.2);
    corp(sk, 'PENCIL 12', 390, 74, 54, '#ffffff', { maxWidth: 230 });
    note(sk, 'now with 3 erasers', 390, 126, 36, '#ffd23f', { maxWidth: 230 });
    corp(sk, 'sketch your selfies', 390, 176, 20, '#cfd8ff', { weight: 400 });
    corp(sk, 'from $699', 390, 208, 26, '#ffffff', { weight: 600 });
    border(sk, w, h, '#0a0a10');
  },
  // a burger: the Doodle Double
  ad_burger(sk, c, w, h) {
    bg(sk, c, w, h, '#e8402f', '#ff6a4f');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2;
      sk.line(150 + Math.cos(a) * 40, 130 + Math.sin(a) * 40, 150 + Math.cos(a) * 140, 130 + Math.sin(a) * 140, { width: 10, color: 'rgba(255,210,63,0.35)', overshoot: 0 });
    }
    shape(sk, oval(150, 112, 92, 52, 30, PI, PI * 2).concat([[242, 116], [58, 116]]), '#f2a24a', BLACK2D, 3.4, { tex: '#e08a2f' });
    for (let i = 0; i < 9; i++) sk.circle(98 + i * 13 + sk.r(-3, 3), 82 + Math.abs(i - 4) * 4 + sk.r(-3, 3), 2.5, { width: 2, color: '#fff3d6' });
    const lettuce = [];
    for (let i = 0; i <= 14; i++) lettuce.push([54 + i * 14, 120 + (i % 2 ? 12 : 0)]);
    shape(sk, lettuce.concat([[250, 132], [54, 132]]), '#6fcf4a', BLACK2D, 2.6);
    shape(sk, [[58, 140], [242, 140], [270, 160], [146, 176], [30, 160]], '#ffcf3a', BLACK2D, 2.6);
    shape(sk, roundRect(56, 146, 188, 34, 14), '#6b3a22', BLACK2D, 3.2, { tex: '#4a2716' });
    shape(sk, roundRect(56, 184, 188, 26, 10), '#f2a24a', BLACK2D, 3.2, { tex: '#e08a2f' });
    marker(sk, 'DOODLE', 390, 52, 50, '#ffd23f', { outline: '#3a0f08' });
    marker(sk, 'DOUBLE', 390, 104, 50, '#ffd23f', { outline: '#3a0f08' });
    corp(sk, '2 for $5', 390, 158, 44, '#ffffff', { outline: '#3a0f08', outlineWidth: 6 });
    note(sk, 'drawn fresh every day · Scribble Burger', 390, 210, 24, '#fff3e6', { maxWidth: 230 });
    border(sk, w, h);
  },
  // perfume: the scent of fresh pencils
  ad_perfume(sk, c, w, h) {
    gradient(c, w, h, [[0, '#26222c'], [1, '#0c0b10']], false);
    for (let i = 0; i < 18; i++) sparkle(sk, sk.r(20, 250), sk.r(20, h - 20), sk.r(2, 5), 'rgba(217,180,90,0.7)');
    const bottle = [[96, 96], [196, 96], [210, 112], [210, 216], [196, 230], [96, 230], [82, 216], [82, 112]];
    shape(sk, bottle, '#f3d27a', '#5a4214', 3, { tex: '#e8b84a', angle: 1.1 });
    sk.line(100, 112, 104, 214, { width: 4, color: 'rgba(255,255,255,0.7)' });
    shape(sk, [[118, 140], [174, 140], [174, 186], [118, 186]], '#1a1820', '#5a4214', 2);
    sk.text('É', 146, 164, { size: 34, color: '#f3d27a', font: FONT_SIGN, weight: 400, dir: 'ltr', passes: 1 });
    // the cap: a sharpened pencil tip
    shape(sk, [[124, 96], [168, 96], [168, 62], [124, 62]], '#1a1820', '#5a4214', 2.6);
    shape(sk, [[124, 62], [168, 62], [146, 22]], '#e9cfa6', '#5a4214', 2.6);
    shape(sk, [[139, 36], [153, 36], [146, 22]], '#1a1820', '#1a1820', 1.5);
    corp(sk, 'ÉCLAT', 384, 82, 58, '#d9b45a', { weight: 400, maxWidth: 220 });
    note(sk, 'de Crayon', 384, 134, 40, '#f3e7c8');
    sk.line(300, 160, 468, 160, { width: 1.5, color: '#d9b45a', overshoot: 0 });
    note(sk, 'the scent of fresh pencils', 384, 196, 26, '#d9b45a', { maxWidth: 220 });
    border(sk, w, h, '#d9b45a', 4);
  },
  // a car: draw it, drive it
  ad_car(sk, c, w, h) {
    gradient(c, w, h, [[0, '#2a5bd6'], [0.6, '#33b5ff'], [1, '#ffd9a8']]);
    c.fillStyle = '#3a3a48';
    c.fillRect(0, 214, w, 42);
    sk.line(0, 214, w, 214, { width: 3, color: BLACK2D, overshoot: 0 });
    speedLines(sk, 8, 90, [150, 170, 190], '#ffffff', 3);
    const body = [[62, 196], [62, 172], [96, 160], [146, 132], [212, 126], [262, 142], [306, 152], [320, 170], [318, 196]];
    shape(sk, body, '#e8402f', BLACK2D, 3.4, { tex: '#c22a1c', angle: 0.2 });
    shape(sk, [[150, 138], [208, 132], [246, 146], [158, 152]], '#bfe4ff', BLACK2D, 2.4);
    sk.line(120, 176, 300, 172, { width: 2, color: '#ffd0c8' });
    for (const x of [112, 270]) {
      shape(sk, oval(x, 200, 22, 22), '#26262e', BLACK2D, 3);
      sk.circle(x, 200, 9, { width: 2.4, color: '#d8d8e0' });
    }
    corp(sk, 'VELOCE GT', 420, 60, 46, '#ffffff', { maxWidth: 170, rotate: -0.04 });
    note(sk, 'Draw it. Drive it.', 420, 112, 36, '#ffffff', { outline: '#1d3a8a', outlineWidth: 4, maxWidth: 170 });
    corp(sk, 'from $29,990', 420, 160, 22, '#1b1430', { weight: 600 });
    corp(sk, 'test drive at Bay Motors', 420, 236, 17, '#ffffff', { weight: 400, maxWidth: 170 });
    border(sk, w, h);
  },
  // a film: ERASED 3, in cinemas Friday
  ad_movie(sk, c, w, h) {
    gradient(c, w, h, [[0, '#3a1458'], [1, '#08040e']]);
    for (let i = 0; i < 5; i++) {
      c.save();
      c.globalAlpha = 0.12;
      c.fillStyle = '#ffb43f';
      c.beginPath();
      c.moveTo(w, 0);
      c.lineTo(i * 70, h);
      c.lineTo(i * 70 + 30, h);
      c.closePath();
      c.fill();
      c.restore();
    }
    // a face in profile, half rubbed out by a giant eraser
    const head = [[70, 230], [74, 186], [60, 160], [64, 112], [92, 70], [140, 56], [180, 74], [196, 112], [210, 126], [200, 140], [204, 160], [192, 176], [184, 210], [160, 230]];
    shape(sk, head, '#141018', '#ff3b3b', 2.6);
    c.save();
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(247, 244, 236, ${sk.r(0.6, 1)})`;
      c.fillRect(150 + sk.r(-10, 60), 70 + sk.r(-10, 80), sk.r(2, 7), sk.r(2, 5));
    }
    c.restore();
    shape(sk, [[150, 40], [252, 2], [276, 62], [176, 102]], '#ee8d9b', BLACK2D, 3);
    shape(sk, [[214, 18], [252, 2], [276, 62], [238, 78]], '#7d93d8', BLACK2D, 3);
    marker(sk, 'ERASED 3', 384, 74, 62, '#ff3b3b', { outline: '#ffffff', outlineWidth: 5, maxWidth: 230 });
    note(sk, 'Nobody is safe from the eraser.', 384, 134, 26, '#f3e7ff', { maxWidth: 230 });
    corp(sk, 'IN CINEMAS FRIDAY', 384, 188, 24, '#ffd23f', { maxWidth: 230 });
    corp(sk, 'Bay Cinema · Coconut St', 384, 222, 15, '#c9b8e0', { weight: 400 });
    border(sk, w, h, '#0a0610');
  },
  // a bank: your savings, never erased
  ad_bank(sk, c, w, h) {
    bg(sk, c, w, h, '#2f9e6e', '#45b884');
    const pig = oval(140, 140, 86, 62, 30);
    shape(sk, pig, '#ffb3c6', '#5a1a30', 3.4, { tex: '#ff94ae' });
    shape(sk, oval(226, 136, 18, 22, 16), '#ff94ae', '#5a1a30', 3);
    sk.circle(222, 132, 3, { width: 2, color: '#5a1a30' });
    sk.circle(232, 140, 3, { width: 2, color: '#5a1a30' });
    shape(sk, [[150, 80], [170, 50], [184, 84]], '#ffb3c6', '#5a1a30', 3);
    for (const x of [92, 120, 160, 188]) shape(sk, [[x, 190], [x + 18, 190], [x + 16, 214], [x + 2, 214]], '#ff94ae', '#5a1a30', 2.6);
    sk.circle(190, 118, 3.5, { width: 2.4, color: '#1a1a20' });
    shape(sk, [[118, 82], [150, 82], [150, 90], [118, 90]], '#3a2a1a', '#3a2a1a', 1.6);
    shape(sk, oval(134, 40, 20, 20), '#ffd23f', '#7a5a10', 3);
    sk.text('$', 134, 42, { size: 24, color: '#7a5a10', font: FONT_UI, weight: 800, dir: 'ltr', passes: 1 });
    corp(sk, 'PAPERTRUST', 386, 64, 40, '#ffffff', { maxWidth: 220 });
    corp(sk, 'B A N K', 386, 104, 22, '#d8ffe9', { weight: 600 });
    note(sk, 'your savings — never erased', 386, 154, 30, '#ffffff', { maxWidth: 220 });
    corp(sk, 'no fees on your first sketchbook', 386, 206, 15, '#eafff3', { weight: 400, maxWidth: 220 });
    border(sk, w, h);
  },
  // an airline: paper planes to anywhere
  ad_airline(sk, c, w, h) {
    gradient(c, w, h, [[0, '#6fc6ff'], [1, '#c9ecff']]);
    for (const [x, y, s] of [[60, 60, 1], [230, 200, 1.3], [400, 40, 0.8]]) {
      for (let i = 0; i < 4; i++) sk.paper(oval(x + i * 18 * s, y + (i % 2) * 6, 22 * s, 14 * s, 18), '#ffffff');
    }
    const plane = [[60, 150], [250, 90], [150, 168], [130, 214]];
    shape(sk, plane, '#ffffff', '#1d3a8a', 3.4);
    shape(sk, [[60, 150], [250, 90], [118, 166]], '#e6f0ff', '#1d3a8a', 2.6);
    sk.line(150, 168, 250, 90, { width: 2, color: '#1d3a8a' });
    for (let i = 0; i < 6; i++) sk.line(48 - i * 16, 156 + i * 5, 40 - i * 16, 158 + i * 5, { width: 3, color: '#1d3a8a', overshoot: 0 });
    corp(sk, 'SKETCH AIR', 392, 72, 44, '#1d3a8a', { maxWidth: 210, rotate: -0.03 });
    note(sk, 'fly anywhere from $19', 392, 124, 32, '#e8402f', { maxWidth: 210 });
    corp(sk, 'paper planes · daily departures', 392, 176, 16, '#1d3a8a', { weight: 400, maxWidth: 210 });
    border(sk, w, h, '#1d3a8a');
  },
  // pizza: 30 minutes or it's free
  ad_pizza2(sk, c, w, h) {
    bg(sk, c, w, h, '#fff6e6');
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < 260; x += 64) {
      c.fillStyle = 'rgba(214, 48, 49, 0.85)';
      c.fillRect(x, y, 32, 32);
    }
    const slice = [[40, 60], [250, 60], [150, 236]];
    shape(sk, slice, '#ffcf5a', '#7a3a10', 3.4, { tex: '#ffb63a' });
    shape(sk, [[34, 48], [256, 48], [250, 70], [40, 70]], '#d98a3a', '#7a3a10', 3.2, { tex: '#c0702a' });
    for (const [x, y] of [[100, 96], [168, 92], [140, 140], [110, 120], [190, 118], [150, 186]]) shape(sk, oval(x, y, 13, 11, 14), '#d8392b', '#7a1a10', 2.2);
    for (const x of [92, 176, 206]) sk.stroke([[x, 70], [x + 2, 88], [x - 1, 100]], { width: 5, color: '#ffcf5a', passes: 1 });
    marker(sk, 'PIZZA PRONTO', 392, 62, 40, '#1f8a4c', { outline: '#ffffff', outlineWidth: 6, maxWidth: 220 });
    shape(sk, [[284, 104], [500, 100], [496, 146], [288, 150]], '#d63031', '#7a1a10', 2.4);
    corp(sk, "30 MIN OR IT'S FREE", 392, 126, 22, '#ffffff', { maxWidth: 200 });
    note(sk, 'call 555-0142', 392, 186, 34, '#1b1430');
    border(sk, w, h);
  },
  // a radio station
  ad_radio(sk, c, w, h) {
    gradient(c, w, h, [[0, '#ff4fa0'], [1, '#7a2fd8']], false);
    for (let i = 1; i <= 4; i++) sk.ellipse(140, 128, 40 + i * 26, 40 + i * 26, { width: 3, color: 'rgba(255,255,255,0.55)', overlap: 0 });
    // headphones
    sk.stroke(oval(140, 130, 62, 70, 24, PI * 1.05, PI * 1.95), { width: 10, color: '#1b1430', passes: 1 });
    shape(sk, roundRect(62, 124, 34, 56, 12), '#ffd23f', BLACK2D, 3);
    shape(sk, roundRect(184, 124, 34, 56, 12), '#ffd23f', BLACK2D, 3);
    corp(sk, 'WAVE', 380, 58, 50, '#ffffff', { maxWidth: 220 });
    corp(sk, '101.7 FM', 380, 112, 46, '#ffd23f', { maxWidth: 220 });
    note(sk, 'drawing the hits all night', 380, 170, 30, '#ffffff', { maxWidth: 220 });
    for (let i = 0; i < 3; i++) sk.text('♪', 300 + i * 70, 222, { size: 30, color: '#ffffff', font: FONT_UI, weight: 400, dir: 'ltr', passes: 1 });
    border(sk, w, h, '#2a0a3a');
  },
  // sunglasses: drawn for the sunset
  ad_glasses(sk, c, w, h) {
    bg(sk, c, w, h, '#ffd23f', '#ffe27a');
    const lens = (cx) => {
      const pts = [[cx - 62, 96], [cx + 58, 96], [cx + 54, 150], [cx + 20, 176], [cx - 30, 176], [cx - 60, 150]];
      c.save();
      sk.path(pts);
      c.clip();
      gradient(c, w, h, [[0.3, '#ffb43f'], [0.6, '#ff4f78'], [0.8, '#6b2fd8']]);
      c.fillStyle = 'rgba(255, 240, 200, 0.9)';
      c.beginPath();
      c.arc(cx, 160, 16, 0, PI * 2);
      c.fill();
      c.restore();
      sk.poly(pts, true, { width: 5, color: BLACK2D });
    };
    lens(96);
    lens(236);
    sk.stroke([[158, 110], [166, 102], [174, 110]], { width: 5, color: BLACK2D, passes: 1 });
    sk.line(34, 104, 10, 96, { width: 5, color: BLACK2D });
    sk.line(298, 104, 322, 96, { width: 5, color: BLACK2D });
    marker(sk, 'SHADE LINES', 420, 70, 40, '#1b1430', { maxWidth: 170 });
    note(sk, 'sunglasses drawn', 420, 128, 30, '#c2185b', { maxWidth: 170 });
    note(sk, 'for the sunset', 420, 162, 30, '#c2185b', { maxWidth: 170 });
    corp(sk, 'at Bella Boutique', 420, 214, 16, '#1b1430', { weight: 600 });
    border(sk, w, h);
  },
  // a gig on the pier
  ad_concert(sk, c, w, h) {
    gradient(c, w, h, [[0, '#0f3d4a'], [1, '#06161c']]);
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = '#ffe14f';
    for (const x of [70, 150, 230]) {
      c.beginPath();
      c.moveTo(x - 8, 0);
      c.lineTo(x + 8, 0);
      c.lineTo(x + 60, 220);
      c.lineTo(x - 60, 220);
      c.closePath();
      c.fill();
    }
    c.restore();
    shape(sk, [[10, 210], [290, 210], [290, 246], [10, 246]], '#2a1a14', '#000000', 2.6);
    // the band: a guitarist, the singer at the microphone, the drums
    const ink = '#000000';
    shape(sk, oval(70, 104, 13, 14), ink, ink, 2);
    shape(sk, [[58, 120], [82, 120], [86, 168], [54, 168]], ink, ink, 2);
    sk.line(62, 168, 58, 208, { width: 7, color: ink });
    sk.line(78, 168, 84, 208, { width: 7, color: ink });
    shape(sk, [[56, 150], [104, 132], [110, 140], [62, 160]], '#b3191e', ink, 2);
    shape(sk, oval(150, 92, 13, 14), ink, ink, 2);
    shape(sk, [[138, 106], [162, 106], [164, 160], [136, 160]], ink, ink, 2);
    sk.line(142, 160, 138, 208, { width: 8, color: ink });
    sk.line(158, 160, 162, 208, { width: 8, color: ink });
    sk.line(160, 116, 176, 96, { width: 5, color: ink });
    sk.line(176, 96, 176, 208, { width: 2.6, color: '#888888' });
    shape(sk, oval(236, 182, 30, 24), '#3fe8ff', ink, 2.6);
    shape(sk, oval(236, 112, 13, 14), ink, ink, 2);
    sk.line(222, 130, 250, 130, { width: 9, color: ink });
    marker(sk, 'THE HATCHLINES', 400, 64, 38, '#3fe8ff', { maxWidth: 200 });
    corp(sk, 'LIVE AT THE PIER', 400, 118, 22, '#ffffff', { maxWidth: 200 });
    corp(sk, 'SATURDAY · 9 PM', 400, 152, 22, '#ffe14f', { maxWidth: 200 });
    note(sk, 'tickets $12', 400, 204, 30, '#ffffff');
    border(sk, w, h, '#000000');
  },
  // a lawyer: hurt by an eraser?
  ad_lawyer(sk, c, w, h) {
    bg(sk, c, w, h, '#f6efe0');
    c.fillStyle = '#1d3a8a';
    c.fillRect(0, 0, 196, h);
    // the lawyer: a big smile, a blue suit, a thumbs up
    shape(sk, [[50, 256], [56, 186], [98, 170], [150, 186], [156, 256]], '#22264a', '#000000', 3);
    shape(sk, [[90, 172], [104, 172], [100, 226]], '#ffffff', '#000000', 2);
    shape(sk, [[94, 180], [100, 180], [98, 216]], '#c2185b', '#000000', 1.6);
    shape(sk, oval(98, 118, 40, 48), '#f1c8a0', '#000000', 3);
    sk.stroke([[60, 98], [72, 72], [104, 64], [132, 76], [138, 100]], { width: 7, color: '#3a2a20', passes: 1 });
    sk.circle(84, 112, 3, { width: 3, color: '#000000' });
    sk.circle(112, 112, 3, { width: 3, color: '#000000' });
    shape(sk, oval(98, 138, 20, 10, 16, 0, PI), '#ffffff', '#000000', 2.4);
    shape(sk, roundRect(150, 168, 30, 34, 8), '#f1c8a0', '#000000', 2.6);
    shape(sk, roundRect(158, 140, 12, 34, 6), '#f1c8a0', '#000000', 2.6);
    corp(sk, 'HURT BY AN ERASER?', 352, 52, 26, '#c2185b', { maxWidth: 290 });
    marker(sk, 'CALL MAX MARKER', 352, 106, 36, '#1d3a8a', { maxWidth: 290 });
    corp(sk, 'attorney at law', 352, 150, 20, '#1b1430', { weight: 400 });
    corp(sk, '555-0199', 352, 192, 40, '#1b1430', { maxWidth: 290 });
    note(sk, 'no win, no fee!', 352, 232, 24, '#c2185b');
    border(sk, w, h);
  },
  // an energy drink: sharpen up
  ad_energy(sk, c, w, h) {
    gradient(c, w, h, [[0, '#24242c'], [1, '#101014']], false);
    for (let i = 0; i < 4; i++) shape(sk, zigzag(20 + i * 60, 220 - i * 50, 50), 'rgba(168,255,60,0.25)', 'rgba(168,255,60,0.25)', 1);
    const can = roundRect(92, 30, 92, 200, 14);
    shape(sk, can, '#1c1c22', '#a8ff3c', 3.4);
    shape(sk, [[92, 52], [184, 52], [184, 60], [92, 60]], '#8a8a96', '#8a8a96', 1);
    shape(sk, zigzag(104, 130, 70), '#a8ff3c', '#000000', 2.4);
    sk.text('G', 138, 196, { size: 34, color: '#a8ff3c', font: FONT_SIGN, weight: 400, dir: 'ltr', passes: 1 });
    corp(sk, 'GRAPHITE', 376, 62, 46, '#a8ff3c', { maxWidth: 230 });
    corp(sk, 'ENERGY', 376, 112, 46, '#ffffff', { maxWidth: 230 });
    note(sk, 'sharpen up.', 376, 172, 38, '#ffffff');
    border(sk, w, h, '#a8ff3c', 4);
  },
  // a dentist: whiter than correction fluid
  ad_dentist(sk, c, w, h) {
    bg(sk, c, w, h, '#d8f0ff', '#c4e6ff');
    const tooth = [[70, 60], [100, 40], [140, 52], [180, 40], [212, 60], [218, 110], [204, 160], [192, 222], [170, 226], [156, 170], [128, 170], [114, 226], [92, 222], [80, 160], [64, 110]];
    shape(sk, tooth, '#ffffff', '#1d3a8a', 3.4);
    sk.circle(118, 104, 5, { width: 4, color: '#1d3a8a' });
    sk.circle(166, 104, 5, { width: 4, color: '#1d3a8a' });
    sk.stroke([[112, 132], [142, 148], [172, 132]], { width: 4, color: '#1d3a8a', passes: 1 });
    sparkle(sk, 230, 50, 14, '#1d9bf0');
    sparkle(sk, 46, 170, 10, '#1d9bf0');
    sparkle(sk, 250, 190, 8, '#1d9bf0');
    marker(sk, 'BRIGHT SMILE', 390, 64, 40, '#1d3a8a', { maxWidth: 220 });
    note(sk, 'whiter than correction fluid!', 390, 124, 28, '#c2185b', { maxWidth: 220 });
    corp(sk, 'Dental Clinic · Palm Ave', 390, 178, 18, '#1d3a8a', { weight: 600 });
    corp(sk, 'first check-up free', 390, 212, 16, '#1d3a8a', { weight: 400 });
    border(sk, w, h, '#1d3a8a');
  },
  // the evening news
  ad_tv(sk, c, w, h) {
    bg(sk, c, w, h, '#1e4fd0', '#2f62e8');
    c.fillStyle = '#e8402f';
    c.fillRect(0, 196, w, 34);
    const tv = roundRect(30, 30, 210, 150, 12);
    shape(sk, tv, '#222230', '#000000', 3.4);
    const scr = [[44, 44], [226, 44], [226, 166], [44, 166]];
    c.save();
    sk.path(scr);
    c.clip();
    gradient(c, w, h, [[0, '#ff9a4f'], [0.6, '#ff4f78']]);
    c.restore();
    // the anchor: hair, a high-necked blouse, a microphone
    shape(sk, [[100, 166], [104, 130], [134, 120], [164, 130], [170, 166]], '#3a6ad8', '#000000', 2.4);
    shape(sk, oval(134, 100, 20, 23), '#e9b48a', '#000000', 2.4);
    sk.stroke([[112, 108], [114, 82], [134, 74], [154, 82], [158, 110], [160, 128]], { width: 6, color: '#3a2216', passes: 1 });
    sk.line(186, 150, 186, 120, { width: 3, color: '#000000' });
    shape(sk, oval(186, 116, 6, 8), '#333333', '#000000', 2);
    corp(sk, 'CHANNEL 9', 384, 64, 46, '#ffffff', { maxWidth: 220 });
    corp(sk, 'N E W S', 384, 106, 24, '#ffd23f', { weight: 600 });
    note(sk, 'we cover the whole city', 384, 152, 28, '#ffffff', { maxWidth: 220 });
    corp(sk, 'TONIGHT AT 9 · SKY 9 IN THE AIR', 256, 214, 18, '#ffffff', { maxWidth: 470 });
    border(sk, w, h, '#0a1a50');
  },
};

export const AD_IDS = ['ad_cola', 'ad_surf', 'ad_coffee', 'ad_gym', 'ad_phone', 'ad_sale', 'ad_rent', 'ad_movers', ...Object.keys(ADS2)];
// the ones fit for a bus shelter, a poster on a wall
export const STREET_ADS = ['ad_cola', 'ad_coffee', 'ad_phone', 'ad_shoes', 'ad_phone2', 'ad_burger', 'ad_perfume', 'ad_movie', 'ad_airline', 'ad_radio', 'ad_glasses', 'ad_concert', 'ad_lawyer', 'ad_energy', 'ad_dentist', 'ad_tv', 'ad_pizza2', 'ad_bank', 'ad_car'];

// silence an unused import warning in some editors
void INK2D;
