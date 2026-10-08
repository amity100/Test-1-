import * as THREE from 'three';
import { Sketcher, makeCanvas, ellipsePts, FONT_SIGN, FONT_NOTE, INK2D, BLACK2D, RED2D } from './sketch2d.js';
import { BLUEPRINT_ORDER, BLUEPRINTS, blueprintBounds } from '../game/blueprints.js';
import { AVE_SIGNS, STREET_SIGNS } from '../world/layout.js';

const PI = Math.PI;
const HIGHLIGHT = 'rgba(255, 226, 60, 0.55)';

// [id, text, background tint] — everything written inside the world is English.
export const SMALL_SIGNS = [
  ['pizza', 'PIZZA', '#e9c4b8'],
  ['deli', 'DELI', '#cfe0c8'],
  ['cafe', 'COFFEE', '#ddd0c0'],
  ['grocery', 'GROCERY', '#ece0b4'],
  ['books', 'BOOKS', '#c8d4ea'],
  ['flowers', 'FLOWERS', '#e6d0d4'],
  ['barber', 'BARBER', '#f1eee6'],
  ['bagel', 'BAKERY', '#ead8bd'],
  ['icecream', 'ICE CREAM', '#d3e3ec'],
  ['hardware', 'HARDWARE', '#d9d9d9'],
  ['laundry', 'LAUNDROMAT', '#d3e3ec'],
  ['bank', 'BANK', '#cfd3dc'],
  ['hotel', 'HOTEL', '#e2d2c6'],
  ['cinema', 'CINEMA', '#d8d8de'],
  ['theater', 'THEATER', '#e3c7c3'],
  ['cars', 'CAR SALES', '#c8d4ea'],
  ['ferry', 'FERRY', '#c8d8e4'],
  ['warehouse', 'WAREHOUSE', '#ddd0c0'],
  ['danger', 'DANGER', '#f3e08a'],
  ['noentry', 'NO ENTRY', '#e9b8b0'],
  ['subway', 'SUBWAY', '#cfe0c8'],
  ['sushi', 'SUSHI', '#f1eee6'],
  ['falafel', 'FALAFEL', '#ece0b4'],
  ['shop', 'STORE', '#ddd0c0'],
  ['hotdog', 'HOT DOGS', '#e9c4b8'],
  ['gym', 'GYM', '#d8d8de'],
  ['music', 'MUSIC', '#d3d7e6'],
  ['pharmacy', 'PHARMACY', '#cfe0c8'],
  ['construction', 'CONSTRUCTION', '#f3e08a'],
  ['alien', 'RESTRICTED', '#d8d8de'],
  ['hideout', 'GARAGE', '#f1eee6'],
  ['parking', 'BUS STOP', '#c8d4ea'],
  ['phones', 'PHONES', '#d3e3ec'],
  ['optics', 'OPTICIAN', '#f1eee6'],
  ['exit', 'EXIT', '#cfe0c8'],
];

export const SHOP_SIGNS = ['pizza', 'deli', 'cafe', 'grocery', 'books', 'flowers', 'barber', 'bagel', 'icecream', 'hardware', 'laundry', 'sushi', 'falafel', 'shop', 'gym', 'music', 'pharmacy', 'phones', 'optics'];

function smallSign(sk, w, h, text, bg) {
  const frame = [[5, 6], [w - 5, 5], [w - 6, h - 6], [6, h - 5]];
  sk.paper(frame, '#f7f4ec');
  sk.fill(frame, bg, { spacing: 2.6, alpha: 0.75, overshoot: 0, angle: -0.3 });
  sk.poly(frame, true, { width: 3, color: INK2D });
  sk.text(text, w / 2, h / 2 + 3, { size: 34, color: BLACK2D, font: FONT_SIGN, maxWidth: w - 30, weight: 400, dir: 'ltr' });
}

function streetSign(sk, w, h, text) {
  const frame = [[4, 8], [w - 4, 8], [w - 4, h - 8], [4, h - 8]];
  sk.paper(frame, '#f7f4ec');
  sk.fill(frame, '#9cc49a', { spacing: 2.6, alpha: 0.8, overshoot: 0 });
  sk.poly(frame, true, { width: 3, color: INK2D });
  sk.text(text, w / 2, h / 2 + 3, { size: 34, color: BLACK2D, font: FONT_NOTE, maxWidth: w - 24, weight: 700, dir: 'ltr' });
}

function boardFrame(sk, ctx, w, h, opts = {}) {
  ctx.save();
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(8, 8, w - 16, h - 16);
  ctx.restore();
  if (opts.grid) {
    ctx.save();
    ctx.strokeStyle = 'rgba(110, 150, 210, 0.35)';
    ctx.lineWidth = 1;
    for (let x = 16; x < w - 12; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 12);
      ctx.lineTo(x, h - 12);
      ctx.stroke();
    }
    for (let y = 16; y < h - 12; y += 16) {
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(w - 12, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  sk.poly([[8, 8], [w - 8, 8], [w - 8, h - 8], [8, h - 8]], true, { width: 5, color: INK2D });
  sk.poly([[18, 18], [w - 18, 18], [w - 18, h - 18], [18, h - 18]], true, { width: 1.6, color: INK2D });
}

/**
 * Billboard showing a blueprint as a technical drawing: construction lines, part callouts,
 * dimension line and a title block. Highlighter marks make it read as "interactive".
 */
function blueprintBoard(sk, ctx, w, h, bp) {
  boardFrame(sk, ctx, w, h, { grid: true });
  // highlighter stripe at the top
  ctx.save();
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillRect(26, 22, w - 52, 30);
  ctx.restore();
  sk.text(`BLUEPRINT: ${bp.nameEn}`, 34, 38, { size: 24, color: BLACK2D, font: FONT_SIGN, align: 'left', maxWidth: w * 0.62, weight: 400, dir: 'ltr' });
  // drawing area (left 66%)
  const b = blueprintBounds(bp);
  const ax = 32;
  const ay = 64;
  const aw = w * 0.62;
  const ah = h - 104;
  const s = Math.min(aw / b.w, ah / b.h) * 0.86;
  const ox = ax + (aw - b.w * s) / 2 - b.x0 * s;
  const oy = ay + (ah - b.h * s) / 2 - b.y0 * s;
  const tr = (p) => [ox + p[0] * s, oy + p[1] * s];
  // construction lines (light)
  ctx.save();
  ctx.strokeStyle = 'rgba(28, 38, 80, 0.25)';
  ctx.lineWidth = 1;
  const yb = oy + b.y1 * s;
  const yt = oy + b.y0 * s;
  ctx.beginPath();
  ctx.moveTo(ax - 6, yb);
  ctx.lineTo(ax + aw + 6, yb);
  ctx.moveTo(ax - 6, yt);
  ctx.lineTo(ax + aw + 6, yt);
  ctx.stroke();
  ctx.restore();
  for (const f of bp.fills) sk.fill(f.poly.map(tr), f.color, { spacing: Math.max(2, s * 0.8), alpha: 0.5, overshoot: s * 0.3 });
  for (const st of bp.strokes) sk.stroke(st.pts.map(tr), { width: Math.max(2, s * 0.55), color: INK2D, jitter: s * 0.15, passes: 2 });
  // dimension line under the drawing
  const dy = yb + 16;
  const xa = ox + b.x0 * s;
  const xb = ox + b.x1 * s;
  sk.line(xa, dy, xb, dy, { width: 1.6, color: INK2D, overshoot: 0 });
  sk.line(xa, dy - 6, xa, dy + 6, { width: 1.6, color: INK2D, overshoot: 0 });
  sk.line(xb, dy - 6, xb, dy + 6, { width: 1.6, color: INK2D, overshoot: 0 });
  sk.poly([[xa + 10, dy - 4], [xa, dy], [xa + 10, dy + 4]], false, { width: 1.6, color: INK2D, overshoot: 0 });
  sk.poly([[xb - 10, dy - 4], [xb, dy], [xb - 10, dy + 4]], false, { width: 1.6, color: INK2D, overshoot: 0 });
  // callouts for two labelled parts
  const labelled = [];
  const seen = new Set();
  for (const st of bp.strokes) {
    if (!seen.has(st.label) && labelled.length < 3) {
      seen.add(st.label);
      labelled.push(st);
    }
  }
  labelled.forEach((st, i) => {
    const p = tr(st.pts[Math.floor(st.pts.length / 3)]);
    const lx = ax + aw - 6;
    const ly = ay + 18 + i * 34;
    sk.line(p[0], p[1], lx - 66, ly, { width: 1.2, color: INK2D, overshoot: 0 });
    dot2(sk, p[0], p[1]);
    sk.text(st.en, lx, ly, { size: 24, color: INK2D, font: FONT_NOTE, align: 'right', weight: 700, maxWidth: 74, dir: 'ltr' });
  });
  // title block
  const tx0 = w * 0.69;
  const tx1 = w - 30;
  const ty0 = 70;
  const ty1 = h - 30;
  sk.poly([[tx0, ty0], [tx1, ty0], [tx1, ty1], [tx0, ty1]], true, { width: 2, color: INK2D });
  sk.line(tx0, ty0 + 54, tx1, ty0 + 54, { width: 1.4, color: INK2D });
  sk.line(tx0, ty0 + 102, tx1, ty0 + 102, { width: 1.4, color: INK2D });
  sk.text(bp.kind === 'vehicle' ? 'VEHICLE' : 'WEAPON', (tx0 + tx1) / 2, ty0 + 28, { size: 22, color: BLACK2D, font: FONT_SIGN, weight: 400, dir: 'ltr', maxWidth: tx1 - tx0 - 12 });
  // difficulty pips
  sk.text('DIFFICULTY', (tx0 + tx1) / 2, ty0 + 66, { size: 20, color: INK2D, font: FONT_NOTE, weight: 700, dir: 'ltr' });
  for (let i = 0; i < 5; i++) {
    const x = (tx0 + tx1) / 2 + (i - 2) * 20;
    const y = ty0 + 88;
    sk.circle(x, y, 7, { width: 1.8, color: INK2D });
    if (i < bp.difficulty) {
      ctx.save();
      ctx.fillStyle = '#b3191e';
      ctx.beginPath();
      ctx.arc(x, y, 4.8, 0, PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  // camera hint in the title block
  const cx = (tx0 + tx1) / 2;
  const cy = ty0 + 122;
  sk.rect(cx - 22, cy - 14, 44, 28, { width: 2.2, color: INK2D });
  sk.circle(cx, cy, 8, { width: 2, color: INK2D });
  sk.rect(cx - 8, cy - 20, 16, 6, { width: 1.8, color: INK2D });
  ctx.save();
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillRect(tx0 + 8, cy + 17, tx1 - tx0 - 16, 20);
  ctx.restore();
  sk.text('PHOTO', cx, cy + 27, { size: 18, color: BLACK2D, font: FONT_SIGN, weight: 400, dir: 'ltr' });
}

function dot2(sk, x, y) {
  const ctx = sk.ctx;
  ctx.save();
  ctx.fillStyle = INK2D;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- practical advertisements, drawn like pen sketches
function adLayout(sk, ctx, w, h, title, sub, draw) {
  boardFrame(sk, ctx, w, h);
  draw(sk, ctx);
  sk.text(title, w * 0.72, 92, { size: 38, color: BLACK2D, font: FONT_SIGN, maxWidth: w * 0.46, weight: 400, dir: 'ltr' });
  sk.line(w * 0.52, 122, w * 0.92, 118, { width: 2, color: RED2D });
  sk.text(sub, w * 0.72, 166, { size: 30, color: INK2D, font: FONT_NOTE, maxWidth: w * 0.46, weight: 700, dir: 'ltr' });
}

function sketchBuilding(sk, x, y, bw, bh) {
  sk.rect(x, y, bw, bh, { width: 3, color: INK2D });
  for (let r = 0; r < Math.floor(bh / 26); r++) {
    for (let c = 0; c < Math.floor(bw / 22); c++) sk.rect(x + 8 + c * 22, y + 10 + r * 26, 12, 14, { width: 1.6, color: INK2D });
  }
  sk.hatch([[x + bw * 0.6, y], [x + bw, y], [x + bw, y + bh], [x + bw * 0.6, y + bh]], { spacing: 5, color: INK2D, width: 1.1, alpha: 0.6 });
}

function adRent(sk, ctx, w, h) {
  adLayout(sk, ctx, w, h, 'FOR RENT', '3 rooms · balcony · parking', () => {
    sketchBuilding(sk, 50, 50, 110, 170);
    sketchBuilding(sk, 170, 100, 70, 120);
  });
}

function adPhone(sk, ctx, w, h) {
  adLayout(sk, ctx, w, h, 'PHONE REPAIR', 'screens · batteries · 1 hour', () => {
    sk.rect(100, 40, 90, 170, { width: 3.4, color: INK2D });
    sk.rect(110, 56, 70, 128, { width: 1.8, color: INK2D });
    sk.circle(145, 196, 7, { width: 2, color: INK2D });
    sk.stroke([[112, 70], [140, 110], [124, 128], [168, 176]], { width: 2, color: RED2D, passes: 1 });
    sk.hatch([[110, 56], [180, 56], [180, 184], [110, 184]], { spacing: 6, color: INK2D, width: 1, alpha: 0.4 });
  });
}

function adBank(sk, ctx, w, h) {
  adLayout(sk, ctx, w, h, 'CITY BANK', 'fixed-rate mortgages', () => {
    sk.poly([[40, 90], [150, 40], [260, 90]], true, { width: 3, color: INK2D });
    for (let i = 0; i < 5; i++) {
      sk.rect(56 + i * 42, 100, 16, 100, { width: 2.2, color: INK2D });
      sk.hatch([[64 + i * 42, 100], [72 + i * 42, 100], [72 + i * 42, 200], [64 + i * 42, 200]], { spacing: 4, color: INK2D, width: 1, alpha: 0.6 });
    }
    sk.line(40, 206, 260, 206, { width: 3, color: INK2D });
  });
}

function adMovers(sk, ctx, w, h) {
  adLayout(sk, ctx, w, h, 'MOVERS', 'homes & offices · free quote', () => {
    sk.rect(40, 80, 150, 100, { width: 3, color: INK2D });
    sk.poly([[190, 110], [240, 110], [262, 140], [262, 180], [190, 180]], true, { width: 3, color: INK2D });
    sk.rect(200, 118, 36, 24, { width: 2, color: INK2D });
    sk.circle(82, 186, 16, { width: 3, color: INK2D });
    sk.circle(224, 186, 16, { width: 3, color: INK2D });
    sk.hatch([[40, 80], [190, 80], [190, 110], [40, 110]], { spacing: 5, color: INK2D, width: 1, alpha: 0.5 });
  });
}

function adCoffee(sk, ctx, w, h) {
  adLayout(sk, ctx, w, h, 'CORNER CAFE', 'large latte $3', () => {
    const cup = [[90, 90], [200, 90], [186, 210], [104, 210]];
    sk.paper(cup);
    sk.poly(cup, true, { width: 3.4, color: INK2D });
    sk.ellipse(145, 90, 55, 12, { width: 2.6, color: INK2D });
    sk.hatch([[100, 140], [195, 140], [188, 200], [106, 200]], { spacing: 5, color: INK2D, width: 1.1, alpha: 0.6 });
    for (let i = 0; i < 3; i++) sk.stroke([[120 + i * 24, 76], [112 + i * 24, 56], [124 + i * 24, 38]], { width: 2, color: INK2D, passes: 1 });
  });
}

function adGym(sk, ctx, w, h) {
  adLayout(sk, ctx, w, h, 'GYM', 'monthly pass · open 24/7', () => {
    sk.line(70, 130, 230, 130, { width: 6, color: INK2D });
    for (const x of [70, 90, 210, 230]) sk.rect(x - 8, 90, 16, 80, { width: 2.6, color: INK2D });
    sk.hatch([[62, 90], [98, 90], [98, 170], [62, 170]], { spacing: 4, color: INK2D, width: 1.1 });
    sk.hatch([[202, 90], [238, 90], [238, 170], [202, 170]], { spacing: 4, color: INK2D, width: 1.1 });
  });
}

function adSale(sk, ctx, w, h) {
  adLayout(sk, ctx, w, h, 'CLEARANCE', 'everything must go', () => {
    const tag = [[60, 120], [110, 60], [240, 60], [240, 180], [110, 180]];
    sk.paper(tag);
    ctx.save();
    ctx.fillStyle = HIGHLIGHT;
    sk.path(tag);
    ctx.fill();
    ctx.restore();
    sk.poly(tag, true, { width: 3.4, color: INK2D });
    sk.circle(98, 120, 9, { width: 2.4, color: INK2D });
    sk.text('-50%', 176, 124, { size: 52, color: RED2D, font: FONT_SIGN, dir: 'ltr', weight: 400 });
  });
}

function adParking(sk, ctx, w, h) {
  adLayout(sk, ctx, w, h, 'PARKING', 'open 24h · $8 per hour', () => {
    sk.rect(70, 50, 150, 150, { width: 4, color: INK2D });
    sk.text('P', 145, 130, { size: 130, color: INK2D, font: FONT_SIGN, dir: 'ltr', weight: 400 });
  });
}

function marquee(sk, ctx, w, h) {
  boardFrame(sk, ctx, w, h);
  for (let i = 0; i < 18; i++) {
    sk.circle(32 + i * 26.5, 34, 5, { width: 1.8, color: INK2D });
    sk.circle(32 + i * 26.5, h - 34, 5, { width: 1.8, color: INK2D });
  }
  sk.text('TONIGHT 8 PM', w / 2, 88, { size: 38, color: INK2D, font: FONT_NOTE, weight: 700, dir: 'ltr' });
  sk.text('HAMLET', w / 2, 152, { size: 56, color: BLACK2D, font: FONT_SIGN, maxWidth: w - 70, weight: 400, dir: 'ltr' });
}

function ferrySign(sk, ctx, w, h) {
  boardFrame(sk, ctx, w, h);
  const hull = [[50, 150], [250, 150], [220, 200], [80, 200]];
  sk.poly(hull, true, { width: 3, color: INK2D });
  sk.hatch(hull, { spacing: 5, color: INK2D, width: 1.1, alpha: 0.6 });
  sk.rect(90, 104, 120, 46, { width: 3, color: INK2D });
  for (let i = 0; i < 5; i++) sk.rect(100 + i * 22, 114, 12, 12, { width: 1.8, color: INK2D });
  sk.line(150, 104, 150, 70, { width: 3, color: INK2D });
  sk.text('FERRY', w * 0.74, 96, { size: 52, color: BLACK2D, font: FONT_SIGN, weight: 400, dir: 'ltr' });
  sk.text('every 30 minutes', w * 0.74, 166, { size: 32, color: INK2D, font: FONT_NOTE, weight: 700, dir: 'ltr', maxWidth: w * 0.46 });
}

// ------------------------------------------------------------------ The Inkwell (the bar)
function neonText(ctx, text, x, y, size, color, font = FONT_NOTE, weight = 700) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  ctx.lineJoin = 'round';
  // glow, then the tube, then a hot white core
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.strokeText(text, x, y);
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3.4;
  ctx.strokeText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.2;
  ctx.strokeText(text, x, y);
  ctx.restore();
}

function barNeon(sk, ctx, w, h) {
  ctx.fillStyle = '#1d1a26';
  ctx.fillRect(0, 0, w, h);
  sk.poly([[6, 6], [w - 6, 6], [w - 6, h - 6], [6, h - 6]], true, { width: 4, color: '#0b0a10' });
  neonText(ctx, 'The Inkwell', w / 2 + 30, h / 2 - 14, 82, '#ff5fa8');
  neonText(ctx, 'COCKTAILS · BEER · MUSIC', w / 2 + 30, h - 44, 26, '#62e6ff', FONT_SIGN, 400);
  // a little neon martini glass
  ctx.save();
  ctx.shadowColor = '#62e6ff';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = '#62e6ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 70);
  ctx.lineTo(96, 70);
  ctx.lineTo(63, 116);
  ctx.closePath();
  ctx.moveTo(63, 116);
  ctx.lineTo(63, 168);
  ctx.moveTo(42, 172);
  ctx.lineTo(84, 172);
  ctx.stroke();
  ctx.strokeStyle = '#ffe36a';
  ctx.beginPath();
  ctx.arc(80, 64, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function barMenu(sk, ctx, w, h) {
  // chalkboard
  ctx.fillStyle = '#26332c';
  ctx.fillRect(0, 0, w, h);
  sk.poly([[5, 5], [w - 5, 5], [w - 5, h - 5], [5, h - 5]], true, { width: 9, color: '#6b4a2e' });
  const chalk = 'rgba(245, 242, 230, 0.92)';
  sk.text('TONIGHT', w / 2, 40, { size: 40, color: chalk, font: FONT_SIGN, dir: 'ltr', weight: 400 });
  const rows = [['Draft Beer', '3'], ['Ink Special', '7'], ['Strawberry Shake', '4'], ['Tap Water', '0']];
  rows.forEach(([n, p], i) => {
    const y = 92 + i * 40;
    sk.text(n, 40, y, { size: 32, color: chalk, font: FONT_NOTE, dir: 'ltr', align: 'left', weight: 700 });
    sk.text(`$${p}`, w - 46, y, { size: 32, color: '#ffd76a', font: FONT_NOTE, dir: 'ltr', align: 'right', weight: 700 });
    sk.line(250, y + 6, w - 100, y + 6, { width: 1.4, color: 'rgba(245, 242, 230, 0.35)', jitter: 1.5 });
  });
}

// ------------------------------------------------------------------ open shops
function openNeon(sk, ctx, w, h) {
  ctx.fillStyle = '#1d1a26';
  ctx.fillRect(4, 4, w - 8, h - 8);
  sk.poly([[5, 5], [w - 5, 5], [w - 5, h - 5], [5, h - 5]], true, { width: 3, color: '#0b0a10' });
  neonText(ctx, 'OPEN', w / 2, h / 2 + 2, 46, '#ff4f6a', FONT_SIGN, 400);
}

// chalk board on a sidewalk A-frame
function chalkBoard(sk, ctx, w, h, lines, icon) {
  ctx.fillStyle = '#26332c';
  ctx.fillRect(0, 0, w, h);
  sk.fill([[10, 10], [w - 10, 10], [w - 10, h - 10], [10, h - 10]], '#33443b', { spacing: 5, alpha: 0.35, angle: 0.6 });
  sk.poly([[5, 5], [w - 5, 5], [w - 5, h - 5], [5, h - 5]], true, { width: 10, color: '#6b4a2e' });
  const chalk = 'rgba(245, 242, 230, 0.92)';
  const n = lines.length;
  lines.forEach((t, i) => {
    const y = h * (icon ? 0.24 : 0.32) + i * (h * (icon ? 0.22 : 0.3)) + (n === 1 ? h * 0.12 : 0);
    sk.text(t, w / 2, y, { size: i === 0 ? 50 : 40, color: i === 0 ? chalk : '#ffd76a', font: i === 0 ? FONT_SIGN : FONT_NOTE, dir: 'ltr', weight: i === 0 ? 400 : 700, maxWidth: w - 36 });
  });
  if (icon) icon(sk, ctx, w, h, chalk);
}

const CHALK = {
  chalk_slice: [['PIZZA', 'SLICE $1'], (sk, c, w, h, col) => {
    sk.poly([[w / 2 - 34, h - 72], [w / 2 + 34, h - 72], [w / 2, h - 22]], true, { width: 4, color: col });
    sk.circle(w / 2 - 6, h - 58, 6, { width: 3, color: '#ff8a6a' });
    sk.circle(w / 2 + 10, h - 50, 5, { width: 3, color: '#ff8a6a' });
  }],
  chalk_coffee: [['ESPRESSO', '$2'], (sk, c, w, h, col) => {
    sk.poly([[w / 2 - 26, h - 74], [w / 2 - 20, h - 26], [w / 2 + 20, h - 26], [w / 2 + 26, h - 74]], false, { width: 4, color: col });
    sk.circle(w / 2 + 34, h - 54, 11, { width: 3.4, color: col });
  }],
  chalk_fresh: [['FRESH', 'TODAY'], null],
  chalk_icecream: [['ICE CREAM', '2 SCOOPS'], (sk, c, w, h, col) => {
    sk.poly([[w / 2 - 22, h - 66], [w / 2, h - 20], [w / 2 + 22, h - 66]], false, { width: 4, color: '#e8c08a' });
    sk.circle(w / 2, h - 76, 18, { width: 4, color: '#ff9ac0' });
  }],
  chalk_welcome: [['COME IN', 'WE\'RE OPEN'], null],
  chalk_sale: [['SALE', '50% OFF'], null],
  chalk_gym: [['NO PAIN', 'NO GAIN'], null],
};

function gigPoster(sk, ctx, w, h) {
  ctx.fillStyle = '#f2e6c9';
  ctx.fillRect(0, 0, w, h);
  sk.fill([[0, 0], [w, 0], [w, h], [0, h]], '#e9a23b', { spacing: 3, alpha: 0.5, angle: 0.4 });
  sk.text('LIVE', 120, 70, { size: 70, color: '#c2261f', font: FONT_SIGN, dir: 'ltr', weight: 400, rotate: -0.08 });
  sk.text('THE ERASERS', w / 2 + 40, 140, { size: 60, color: BLACK2D, font: FONT_SIGN, dir: 'ltr', weight: 400 });
  sk.text('friday · no cover', w / 2 + 40, 200, { size: 32, color: INK2D, font: FONT_NOTE, dir: 'ltr', weight: 700 });
  for (let i = 0; i < 3; i++) sk.circle(420 + i * 18, 60 + i * 9, 10 + i * 4, { width: 2.5, color: BLACK2D });
}

export function buildSignAtlas() {
  const W = 2048;
  const H = 3072;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rects = {};
  let slot = 0;
  const small = (name, fn) => {
    const cx = (slot % 8) * 256;
    const cy = Math.floor(slot / 8) * 64;
    slot++;
    const tmp = makeCanvas(256, 64);
    const tctx = tmp.getContext('2d');
    fn(new Sketcher(tctx, slot * 131 + 7), tctx);
    ctx.drawImage(tmp, cx, cy);
    rects[name] = [cx / W, 1 - (cy + 64) / H, 256 / W, 64 / H];
  };
  for (const [id, text, bg] of SMALL_SIGNS) small(id, (sk) => smallSign(sk, 256, 64, text, bg));
  small('open', (sk, c) => openNeon(sk, c, 256, 64));
  small('barSmall', (sk, c) => {
    c.fillStyle = '#1d1a26';
    c.fillRect(0, 0, 256, 64);
    neonText(c, 'BAR', 128, 34, 46, '#ff5fa8', FONT_SIGN, 400);
  });
  AVE_SIGNS.forEach((n, i) => small(`ave${i}`, (sk) => streetSign(sk, 256, 64, n)));
  STREET_SIGNS.forEach((n, i) => small(`st${i}`, (sk) => streetSign(sk, 256, 64, n)));

  let big = 0;
  const large = (name, fn) => {
    const cx = (big % 4) * 512;
    const cy = 512 + Math.floor(big / 4) * 256;
    big++;
    const tmp = makeCanvas(512, 256);
    const tctx = tmp.getContext('2d');
    fn(new Sketcher(tctx, big * 977 + 3), tctx);
    ctx.drawImage(tmp, cx, cy);
    rects[name] = [cx / W, 1 - (cy + 256) / H, 512 / W, 256 / H];
  };
  for (const id of BLUEPRINT_ORDER) large(`bb_${id}`, (sk, c) => blueprintBoard(sk, c, 512, 256, BLUEPRINTS[id]));
  large('ad_rent', (sk, c) => adRent(sk, c, 512, 256));
  large('ad_phone', (sk, c) => adPhone(sk, c, 512, 256));
  large('ad_bank', (sk, c) => adBank(sk, c, 512, 256));
  large('ad_movers', (sk, c) => adMovers(sk, c, 512, 256));
  large('ad_coffee', (sk, c) => adCoffee(sk, c, 512, 256));
  large('ad_gym', (sk, c) => adGym(sk, c, 512, 256));
  large('ad_sale', (sk, c) => adSale(sk, c, 512, 256));
  large('ad_parking', (sk, c) => adParking(sk, c, 512, 256));
  large('marquee', (sk, c) => marquee(sk, c, 512, 256));
  large('ferry_big', (sk, c) => ferrySign(sk, c, 512, 256));
  large('bar_neon', (sk, c) => barNeon(sk, c, 512, 256));
  large('bar_menu', (sk, c) => barMenu(sk, c, 512, 256));
  large('bar_poster', (sk, c) => gigPoster(sk, c, 512, 256));

  // square tiles along the bottom row of the atlas
  let med = 0;
  const square = (name, fn) => {
    const cx = (med % 8) * 256;
    const cy = H - 256;
    med++;
    const tmp = makeCanvas(256, 256);
    const tctx = tmp.getContext('2d');
    fn(new Sketcher(tctx, med * 577 + 11), tctx);
    ctx.drawImage(tmp, cx, cy);
    rects[name] = [cx / W, 1 - (cy + 256) / H, 256 / W, 256 / H];
  };
  for (const [id, [lines, icon]] of Object.entries(CHALK)) square(id, (sk, c) => chalkBoard(sk, c, 256, 256, lines, icon));

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return { texture: tex, rects, canvas };
}

export { ellipsePts };
