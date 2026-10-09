import { Sketcher, makeCanvas, FONT_SIGN, FONT_NOTE, INK2D, BLACK2D, RED2D } from '../render/sketch2d.js';
import { canvasTexture } from '../render/materials.js';
import { BLUEPRINT_ORDER, BLUEPRINTS, blueprintBounds } from '../game/blueprints.js';
import { AVES, STREETS } from './layout.js';
import { ADS2 } from './ads.js';

// Everything printed on a board in the city, in one texture: the blueprints you photograph (a
// technical drawing pinned up on a billboard), the ads, DRAW YOURSELF A FRIEND, the street names.
// Everything written inside the world is English.

const PI = Math.PI;
const HIGHLIGHT = 'rgba(255, 226, 60, 0.55)';
const W = 2048;
// twelve rows of big cells (blueprints, ads), then the little plates
const BIG_ROWS = 12;
const H = BIG_ROWS * 256 + 512;
const BIG_W = 512;
const BIG_H = 256;
const SMALL_W = 256;
const SMALL_H = 64;

function boardFrame(sk, ctx, w, h, opts = {}) {
  ctx.save();
  ctx.fillStyle = opts.paper || '#f7f4ec';
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

function dot2(sk, x, y) {
  const ctx = sk.ctx;
  ctx.save();
  ctx.fillStyle = INK2D;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, PI * 2);
  ctx.fill();
  ctx.restore();
}

// a blueprint as a technical drawing: construction lines, part callouts, a dimension line and a
// title block; the highlighter marks say "take a photo of me"
function blueprintBoard(sk, ctx, w, h, bp) {
  boardFrame(sk, ctx, w, h, { grid: true });
  ctx.save();
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillRect(26, 22, w - 52, 30);
  ctx.restore();
  sk.text(`BLUEPRINT: ${bp.nameEn}`, 34, 38, { size: 24, color: BLACK2D, font: FONT_SIGN, align: 'left', maxWidth: w * 0.62, weight: 400, dir: 'ltr' });
  const b = blueprintBounds(bp);
  const ax = 32;
  const ay = 64;
  const aw = w * 0.62;
  const ah = h - 104;
  const s = Math.min(aw / b.w, ah / b.h) * 0.86;
  const ox = ax + (aw - b.w * s) / 2 - b.x0 * s;
  const oy = ay + (ah - b.h * s) / 2 - b.y0 * s;
  const tr = (p) => [ox + p[0] * s, oy + p[1] * s];
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
  for (const f of bp.fills) sk.fill(f.poly.map(tr), f.color, { spacing: Math.max(2, s * 0.8), alpha: 0.6, overshoot: s * 0.3 });
  for (const st of bp.strokes) sk.stroke(st.pts.map(tr), { width: Math.max(2, s * 0.55), color: INK2D, jitter: s * 0.15, passes: 2 });
  const dy = yb + 16;
  const xa = ox + b.x0 * s;
  const xb = ox + b.x1 * s;
  sk.line(xa, dy, xb, dy, { width: 1.6, color: INK2D, overshoot: 0 });
  sk.line(xa, dy - 6, xa, dy + 6, { width: 1.6, color: INK2D, overshoot: 0 });
  sk.line(xb, dy - 6, xb, dy + 6, { width: 1.6, color: INK2D, overshoot: 0 });
  sk.poly([[xa + 10, dy - 4], [xa, dy], [xa + 10, dy + 4]], false, { width: 1.6, color: INK2D, overshoot: 0 });
  sk.poly([[xb - 10, dy - 4], [xb, dy], [xb - 10, dy + 4]], false, { width: 1.6, color: INK2D, overshoot: 0 });
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
  const tx0 = w * 0.69;
  const tx1 = w - 30;
  const ty0 = 70;
  const ty1 = h - 30;
  sk.poly([[tx0, ty0], [tx1, ty0], [tx1, ty1], [tx0, ty1]], true, { width: 2, color: INK2D });
  sk.line(tx0, ty0 + 54, tx1, ty0 + 54, { width: 1.4, color: INK2D });
  sk.line(tx0, ty0 + 102, tx1, ty0 + 102, { width: 1.4, color: INK2D });
  sk.text(bp.kind === 'vehicle' ? 'VEHICLE' : bp.kind === 'heal' ? 'FIRST AID' : bp.kind === 'gear' ? 'GEAR' : 'WEAPON', (tx0 + tx1) / 2, ty0 + 28, { size: 22, color: BLACK2D, font: FONT_SIGN, weight: 400, dir: 'ltr', maxWidth: tx1 - tx0 - 12 });
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

// ---- ads, drawn like pen sketches on bright paper (the colours of the boulevard)
function adLayout(sk, ctx, w, h, title, sub, paper, draw) {
  boardFrame(sk, ctx, w, h, { paper });
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

const ADS = {
  ad_rent: (sk, c, w, h) =>
    adLayout(sk, c, w, h, 'FOR RENT', '3 rooms · sea view', '#ffe3ec', () => {
      sketchBuilding(sk, 50, 50, 110, 170);
      sketchBuilding(sk, 170, 100, 70, 120);
    }),
  ad_phone: (sk, c, w, h) =>
    adLayout(sk, c, w, h, 'PHONE REPAIR', 'screens · batteries · 1 hour', '#e0f6f4', () => {
      sk.rect(100, 40, 90, 170, { width: 3.4, color: INK2D });
      sk.rect(110, 56, 70, 128, { width: 1.8, color: INK2D });
      sk.circle(145, 196, 7, { width: 2, color: INK2D });
      sk.stroke([[112, 70], [140, 110], [124, 128], [168, 176]], { width: 2, color: RED2D, passes: 1 });
      sk.hatch([[110, 56], [180, 56], [180, 184], [110, 184]], { spacing: 6, color: INK2D, width: 1, alpha: 0.4 });
    }),
  ad_coffee: (sk, c, w, h) =>
    adLayout(sk, c, w, h, 'BAY CAFE', 'iced latte $3', '#fff1d6', () => {
      const cup = [[90, 90], [200, 90], [186, 210], [104, 210]];
      sk.paper(cup);
      sk.poly(cup, true, { width: 3.4, color: INK2D });
      sk.ellipse(145, 90, 55, 12, { width: 2.6, color: INK2D });
      sk.hatch([[100, 140], [195, 140], [188, 200], [106, 200]], { spacing: 5, color: INK2D, width: 1.1, alpha: 0.6 });
      for (let i = 0; i < 3; i++) sk.stroke([[120 + i * 24, 76], [112 + i * 24, 56], [124 + i * 24, 38]], { width: 2, color: INK2D, passes: 1 });
    }),
  ad_gym: (sk, c, w, h) =>
    adLayout(sk, c, w, h, 'MUSCLE BEACH', 'gym · open 24/7', '#e6e2ff', () => {
      sk.line(70, 130, 230, 130, { width: 6, color: INK2D });
      for (const x of [70, 90, 210, 230]) sk.rect(x - 8, 90, 16, 80, { width: 2.6, color: INK2D });
      sk.hatch([[62, 90], [98, 90], [98, 170], [62, 170]], { spacing: 4, color: INK2D, width: 1.1 });
      sk.hatch([[202, 90], [238, 90], [238, 170], [202, 170]], { spacing: 4, color: INK2D, width: 1.1 });
    }),
  ad_sale: (sk, c, w, h) =>
    adLayout(sk, c, w, h, 'BIG SALE', 'everything must go', '#fff8c8', () => {
      const tag = [[60, 120], [110, 60], [240, 60], [240, 180], [110, 180]];
      sk.paper(tag);
      c.save();
      c.fillStyle = HIGHLIGHT;
      sk.path(tag);
      c.fill();
      c.restore();
      sk.poly(tag, true, { width: 3.4, color: INK2D });
      sk.circle(98, 120, 9, { width: 2.4, color: INK2D });
      sk.text('-50%', 176, 124, { size: 52, color: RED2D, font: FONT_SIGN, dir: 'ltr', weight: 400 });
    }),
  ad_surf: (sk, c, w, h) =>
    adLayout(sk, c, w, h, 'SURF SCHOOL', 'first lesson free', '#d8f4ff', () => {
      const board = [[70, 210], [96, 60], [122, 40], [146, 60], [150, 210]];
      sk.fill(board, '#ff8a3c', { spacing: 3, alpha: 0.85, overshoot: 0, angle: 1.2 });
      sk.poly(board, true, { width: 3.4, color: INK2D });
      sk.line(110, 60, 112, 200, { width: 2, color: INK2D });
      for (let i = 0; i < 3; i++) sk.stroke([[170, 150 + i * 22], [200, 138 + i * 22], [230, 150 + i * 22], [260, 138 + i * 22]], { width: 2.4, color: '#2a7fd4', passes: 1 });
    }),
  ad_cola: (sk, c, w, h) =>
    adLayout(sk, c, w, h, 'SUNSET COLA', 'taste the evening', '#ffd9cf', () => {
      const bottle = [[120, 214], [116, 120], [132, 90], [132, 50], [158, 50], [158, 90], [174, 120], [170, 214]];
      sk.fill(bottle, '#c2185b', { spacing: 3, alpha: 0.8, overshoot: 0, angle: 0.5 });
      sk.poly(bottle, true, { width: 3.4, color: INK2D });
      sk.rect(118, 140, 54, 30, { width: 2.4, color: INK2D });
      sk.circle(230, 80, 26, { width: 3, color: '#ff8a3c' });
    }),
  ad_movers: (sk, c, w, h) =>
    adLayout(sk, c, w, h, 'MOVERS', 'homes & offices · free quote', '#e7f6dc', () => {
      sk.rect(40, 80, 150, 100, { width: 3, color: INK2D });
      sk.poly([[190, 110], [240, 110], [262, 140], [262, 180], [190, 180]], true, { width: 3, color: INK2D });
      sk.rect(200, 118, 36, 24, { width: 2, color: INK2D });
      sk.circle(82, 186, 16, { width: 3, color: INK2D });
      sk.circle(224, 186, 16, { width: 3, color: INK2D });
      sk.hatch([[40, 80], [190, 80], [190, 110], [40, 110]], { spacing: 5, color: INK2D, width: 1, alpha: 0.5 });
    }),
};

// a doodled heart: points around (cx, cy), s wide
function heartPts(cx, cy, s, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([cx + (x / 32) * s, cy - (y / 32) * s]);
  }
  return pts;
}

// the board over the stand on the promenade
function friendBoard(sk, ctx, w, h) {
  const frame = [[8, 10], [w - 8, 8], [w - 10, h - 8], [10, h - 10]];
  sk.paper(frame, '#fff5f7');
  sk.fill(frame, '#ffc2d4', { spacing: 3, alpha: 0.6, overshoot: 0, angle: -0.4 });
  sk.poly(frame, true, { width: 6, color: '#7a2848' });
  sk.text('DRAW YOURSELF', w / 2 + 34, 74, { size: 58, color: '#4a1636', font: FONT_SIGN, dir: 'ltr', weight: 400, maxWidth: w - 150 });
  sk.text('A FRIEND', w / 2 + 34, 160, { size: 96, color: '#d8265a', font: FONT_SIGN, dir: 'ltr', weight: 400, maxWidth: w - 150, rotate: -0.03 });
  sk.text('magic pencils · $1', w / 2 + 34, 224, { size: 30, color: '#4a1636', font: FONT_NOTE, dir: 'ltr', weight: 700 });
  const px = 70;
  const py = 150;
  const pen = [[px - 14, py - 70], [px + 6, py - 76], [px + 26, py - 10], [px + 6, py - 4]];
  sk.fill(pen, '#f5c242', { spacing: 2.4, alpha: 0.95, overshoot: 0, angle: 1.2 });
  sk.poly(pen, true, { width: 3.5, color: '#3a2a1a' });
  sk.poly([[px + 6, py - 4], [px + 26, py - 10], [px + 22, py + 14]], true, { width: 3.5, color: '#3a2a1a' });
  const hp = heartPts(px + 2, py + 52, 64);
  sk.fill(hp, '#ff4f78', { spacing: 3, alpha: 0.9, angle: -0.6 });
  sk.poly(hp, true, { width: 4, color: '#a3123c' });
  for (const [x, y, s] of [[w - 34, 34, 30], [w - 54, h - 34, 22], [130, 34, 20]]) sk.poly(heartPts(x, y, s, 20), true, { width: 3, color: '#d8265a' });
}

// a sample of what you get: a friend drawn on a sheet (a nice, ordinary woman in a denim jacket
// and jeans, waving)
function friendSketch(sk, ctx, w, h) {
  ctx.fillStyle = '#fbf8f0';
  ctx.fillRect(0, 0, w, h);
  sk.poly([[6, 6], [w - 6, 6], [w - 6, h - 6], [6, h - 6]], true, { width: 4, color: '#6b4a2e' });
  const ink = '#2a2230';
  // the hair, the face
  sk.fill([[100, 52], [156, 52], [162, 112], [94, 112]], '#6b3d22', { spacing: 2.4, alpha: 0.85, overshoot: 0, angle: 1.4 });
  sk.circle(128, 70, 24, { width: 4, color: ink });
  sk.stroke([[104, 62], [112, 46], [128, 42], [144, 46], [152, 62]], { width: 4, color: '#6b3d22' });
  sk.line(119, 66, 119, 70, { width: 4, color: ink });
  sk.line(137, 66, 137, 70, { width: 4, color: ink });
  sk.stroke([[118, 79], [128, 84], [138, 79]], { width: 3, color: '#c2265a' });
  // a white tee under an open denim jacket
  const tee = [[116, 98], [140, 98], [142, 158], [114, 158]];
  sk.fill(tee, '#f4f2ec', { spacing: 2.6, alpha: 0.9, overshoot: 0 });
  sk.poly(tee, true, { width: 2.5, color: ink });
  for (const sd of [-1, 1]) {
    const x0 = 128 + sd * 12;
    const jacket = [[x0, 96], [128 + sd * 30, 100], [128 + sd * 32, 162], [x0 + sd * 2, 162]];
    sk.fill(jacket, '#5f86c9', { spacing: 2.6, alpha: 0.9, overshoot: 0, angle: -0.5 });
    sk.poly(jacket, true, { width: 3.5, color: ink });
  }
  // the jeans, the sneakers
  for (const sd of [-1, 1]) {
    const leg = [[128 + sd * 2, 160], [128 + sd * 26, 160], [128 + sd * 24, 228], [128 + sd * 8, 228]];
    sk.fill(leg, '#2f3f6e', { spacing: 2.6, alpha: 0.9, overshoot: 0, angle: 1.2 });
    sk.poly(leg, true, { width: 3.5, color: ink });
    sk.poly([[128 + sd * 6, 228], [128 + sd * 28, 228], [128 + sd * 30, 238], [128 + sd * 4, 238]], true, { width: 3, color: ink });
  }
  // one arm down, one waving
  sk.stroke([[100, 104], [92, 136], [90, 160]], { width: 8, color: '#5f86c9' });
  sk.stroke([[100, 104], [92, 136], [90, 160]], { width: 2.5, color: ink });
  sk.stroke([[156, 104], [176, 84], [184, 56]], { width: 8, color: '#5f86c9' });
  sk.stroke([[156, 104], [176, 84], [184, 56]], { width: 2.5, color: ink });
  sk.circle(185, 50, 6, { width: 3, color: ink });
  sk.text('Hi!', 210, 40, { size: 40, color: '#d8265a', font: FONT_NOTE, dir: 'ltr', weight: 700 });
  const hp = heartPts(210, 96, 34, 20);
  sk.fill(hp, '#ff4f78', { spacing: 3, alpha: 0.9 });
  sk.poly(hp, true, { width: 3, color: '#a3123c' });
}

// a street name blade: white letters on green, like the big sign over the boulevard
function streetBlade(ctx, w, h, text) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1f7a4c';
  ctx.fillRect(3, 3, w - 6, h - 6);
  ctx.strokeStyle = '#e8f2ea';
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, w - 14, h - 14);
  ctx.fillStyle = '#f6f6f0';
  ctx.font = `700 34px ${FONT_NOTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  ctx.fillText(text, w / 2, h / 2 + 2, w - 20);
}

// a little plate: a bus stop, a phone booth's sign
function plate(sk, ctx, w, h, text, bg, fg = '#141418') {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  sk.poly([[4, 4], [w - 4, 4], [w - 4, h - 4], [4, h - 4]], true, { width: 3, color: INK2D });
  ctx.fillStyle = fg;
  ctx.font = `400 34px ${FONT_SIGN}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  ctx.fillText(text, w / 2, h / 2 + 2, w - 24);
}

let ATLAS = null;

export function boardAtlas() {
  if (ATLAS) return ATLAS;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(0, 0, W, H);
  const rects = {};
  let big = 0;
  const large = (name, fn) => {
    if (big >= BIG_ROWS * 4) throw new Error('board atlas full');
    const cx = (big % 4) * BIG_W;
    const cy = Math.floor(big / 4) * BIG_H;
    big++;
    const tmp = makeCanvas(BIG_W, BIG_H);
    const tctx = tmp.getContext('2d');
    fn(new Sketcher(tctx, big * 977 + 3), tctx, BIG_W, BIG_H);
    ctx.drawImage(tmp, cx, cy);
    rects[name] = cell(cx, cy, BIG_W, BIG_H);
  };
  let small = 0;
  const smallCell = (name, fn) => {
    const cx = (small % 8) * SMALL_W;
    const cy = BIG_ROWS * BIG_H + Math.floor(small / 8) * SMALL_H;
    small++;
    const tmp = makeCanvas(SMALL_W, SMALL_H);
    const tctx = tmp.getContext('2d');
    fn(new Sketcher(tctx, small * 131 + 7), tctx, SMALL_W, SMALL_H);
    ctx.drawImage(tmp, cx, cy);
    rects[name] = cell(cx, cy, SMALL_W, SMALL_H);
  };
  for (const id of BLUEPRINT_ORDER) large(`bb_${id}`, (sk, c, w, h) => blueprintBoard(sk, c, w, h, BLUEPRINTS[id]));
  for (const [k, fn] of Object.entries(ADS)) large(k, fn);
  for (const [k, fn] of Object.entries(ADS2)) large(k, fn);
  large('friend_stand', (sk, c, w, h) => friendBoard(sk, c, w, h));
  // the drawn friend: a 256 square, twice (in a big cell)
  large('friend_sketch', (sk, c) => {
    c.save();
    friendSketch(sk, c, 256, 256);
    c.restore();
  });
  rects.friend_sketch = cell(rects.friend_sketch.px[0], rects.friend_sketch.px[1], 256, 256);
  for (const a of AVES) smallCell(`ave_${a.sign}`, (sk, c, w, h) => streetBlade(c, w, h, a.sign));
  for (const s of STREETS) smallCell(`st_${s.sign}`, (sk, c, w, h) => streetBlade(c, w, h, s.sign));
  smallCell('bus', (sk, c, w, h) => plate(sk, c, w, h, 'BUS STOP', '#ffd23f'));
  smallCell('phone', (sk, c, w, h) => plate(sk, c, w, h, 'PHONE', '#3fd0c9'));
  smallCell('news', (sk, c, w, h) => plate(sk, c, w, h, 'DAILY NEWS', '#f6f2e8'));
  smallCell('police', (sk, c, w, h) => plate(sk, c, w, h, 'POLICE', '#2a4fa0', '#ffffff'));
  smallCell('pier', (sk, c, w, h) => plate(sk, c, w, h, 'PIER', '#ff8a3c'));
  smallCell('heli', (sk, c, w, h) => plate(sk, c, w, h, 'HELIPAD', '#f6f2e8'));
  ATLAS = { texture: canvasTexture(canvas), rects, canvas };
  return ATLAS;
}

// [u0, v0, u1, v1] of a cell (v up, as the texture is flipped)
function cell(cx, cy, w, h) {
  const pad = 1.5;
  const r = [(cx + pad) / W, 1 - (cy + h - pad) / H, (cx + w - pad) / W, 1 - (cy + pad) / H];
  r.px = [cx, cy];
  return r;
}
