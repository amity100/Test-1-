import * as THREE from 'three';
import { Sketcher, makeCanvas, ellipsePts, FONT_HAND, FONT_SIGN, INK2D, BLACK2D, RED2D } from './sketch2d.js';

// One texture with the effects: ballpoint doodles of impacts, splats, smoke, marks.
// Each cell is 256x256. rects[name] = [u0, v0, du, dv] in texture space.

const C = 256;
const PI = Math.PI;

function arc(cx, cy, rx, ry, a0, a1, n = 14) {
  return ellipsePts(cx, cy, rx, ry, n, a0, a1);
}

function dot(sk, x, y, r, color = BLACK2D) {
  const ctx = sk.ctx;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * sk.r(0.8, 1.05), sk.r(0, PI), 0, PI * 2);
  ctx.fill();
  ctx.restore();
}

function blob(sk, poly, color = '#f7f4ec') {
  sk.paper(poly, color);
}

// Ink-filled shape: dark base, dense scribble texture on top, outline.
function inked(sk, poly, color = BLACK2D, o = {}) {
  sk.paper(poly, o.base || '#2b2b33');
  sk.scribbleIn(poly, { color: o.light || '#4a4a56', width: 1.4, count: (o.count || 140) * 0.6, alpha: 0.7, step: 22 });
  sk.scribbleIn(poly, { color, width: o.width || 3.2, count: o.count || 140, alpha: 0.95, step: o.step || 30 });
  sk.stroke([...poly, poly[0]], { width: o.outline || 4, color, passes: 2, jitter: 0.8 });
}

// ------------------------------------------------------------------ heads
function heroHead(sk, view) {
  const cx = 128;
  const cy = 140;
  const r = 60;
  const circle = ellipsePts(cx, cy, r, r, 30);
  inked(sk, circle, BLACK2D, { count: 170, base: '#1c1c22', light: '#3c3c48' });
  // red headband across the forehead
  const yTop = cy - 30;
  const yBot = cy - 13;
  const top = [];
  const bot = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const yt = yTop + Math.sin(t * PI) * 5;
    const yb = yBot + Math.sin(t * PI) * 5;
    const xt = Math.sqrt(Math.max(0, r * r - (yt - cy) ** 2)) * 1.03;
    const xb = Math.sqrt(Math.max(0, r * r - (yb - cy) ** 2)) * 1.03;
    top.push([cx - xt + 2 * xt * t, yt]);
    bot.unshift([cx - xb + 2 * xb * t, yb]);
  }
  const band = [...top, ...bot];
  sk.paper(band, '#f3ece0');
  sk.hatch(band, { spacing: 2.4, angle: -0.5, color: RED2D, width: 2.2, alpha: 1 });
  sk.stroke([...band, band[0]], { width: 2.6, color: RED2D, passes: 1, jitter: 0.5 });
  if (view === 'side' || view === 'back') {
    const kx = view === 'side' ? cx - r * 0.95 : cx;
    const ky = cy - 20;
    dot(sk, kx, ky, 9, RED2D);
    const dir = view === 'side' ? -1 : 0;
    sk.stroke([[kx, ky], [kx + dir * 40 - 8, ky + 18], [kx + dir * 70 - 14, ky + 14]], { width: 6, color: RED2D, passes: 2 });
    sk.stroke([[kx, ky], [kx + dir * 34 + 8, ky + 34], [kx + dir * 58 + 6, ky + 46]], { width: 5, color: RED2D, passes: 2 });
  }
}

function thugHead(sk, view) {
  const cx = 128;
  const cy = 140;
  if (view === 'back') {
    const hood = [...arc(cx, cy, 78, 84, PI * 0.82, PI * 2.18, 22), [cx + 74, cy + 92], [cx - 74, cy + 92]];
    sk.paper(hood);
    sk.hatch(hood, { spacing: 4.5, angle: -0.9, color: BLACK2D, width: 1.6, cross: 1 });
    sk.stroke([...hood, hood[0]], { width: 4.5, color: BLACK2D });
    sk.stroke([[cx, cy - 84], [cx + 4, cy + 20], [cx, cy + 90]], { width: 2.5, color: BLACK2D });
    return;
  }
  const side = view === 'side';
  const ox = side ? 14 : 0;
  const hood = side
    ? [...arc(cx - 8, cy, 80, 84, PI * 0.62, PI * 2.05, 22), [cx + 70, cy + 40], [cx + 60, cy + 92], [cx - 82, cy + 92]]
    : [...arc(cx, cy, 80, 86, PI * 0.82, PI * 2.18, 22), [cx + 76, cy + 92], [cx - 76, cy + 92]];
  sk.paper(hood);
  sk.hatch(hood, { spacing: 4.5, angle: -0.9, color: BLACK2D, width: 1.6, cross: 1 });
  sk.stroke([...hood, hood[0]], { width: 4.5, color: BLACK2D });
  // face opening in deep shadow
  const face = ellipsePts(cx + ox * 1.6, cy + 8, side ? 38 : 50, 60, 24);
  sk.paper(face, '#efe9da');
  sk.hatch(face, { spacing: 3, angle: 0.7, color: BLACK2D, width: 1.4, cross: 1, alpha: 0.85 });
  sk.stroke([...face, face[0]], { width: 3.5, color: BLACK2D });
  // eye slits (negative space)
  const eyes = side ? [[cx + 40, cy - 6]] : [[cx - 20, cy - 6], [cx + 20, cy - 6]];
  for (const [ex, ey] of eyes) {
    const ctx = sk.ctx;
    ctx.save();
    ctx.fillStyle = '#f7f4ec';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 11, 4.5, ex < cx ? 0.25 : -0.25, 0, PI * 2);
    ctx.fill();
    ctx.restore();
    dot(sk, ex + (side ? 4 : 0), ey + 0.5, 3, BLACK2D);
    sk.line(ex - 14, ey - (ex < cx ? 12 : 6), ex + 12, ey - (ex < cx ? 6 : 12), { width: 4, color: BLACK2D });
  }
  // red bandana over nose and mouth
  const bx = cx + ox * 1.6;
  const band = side
    ? [[bx - 10, cy + 10], [bx + 40, cy + 6], [bx + 34, cy + 48], [bx + 4, cy + 72], [bx - 18, cy + 44]]
    : [[bx - 50, cy + 10], [bx + 50, cy + 10], [bx + 40, cy + 40], [bx, cy + 74], [bx - 40, cy + 40]];
  sk.paper(band);
  sk.hatch(band, { spacing: 3.2, angle: -0.4, color: RED2D, width: 2, alpha: 0.95 });
  sk.stroke([...band, band[0]], { width: 3.5, color: RED2D });
  for (let i = 0; i < 6; i++) sk.circle(bx + sk.r(-30, 30) * (side ? 0.5 : 1) + (side ? 12 : 0), cy + sk.r(18, 46), 3, { width: 1.6, color: '#f7f4ec', passes: 1 });
}

function maskHead(sk, view) {
  const cx = 128;
  const cy = 140;
  const r = 66;
  const head = ellipsePts(cx, cy, r, r * 1.05, 28);
  sk.paper(head);
  sk.hatch(head, { spacing: 3.6, angle: -1.1, color: BLACK2D, width: 1.7, cross: 1, crossAngle: 1.4 });
  sk.stroke([...head, head[0]], { width: 4.5, color: BLACK2D });
  // knit rows
  for (let y = cy - r + 14; y < cy + r; y += 13) sk.line(cx - r * 0.8, y, cx + r * 0.8, y + 2, { width: 1.1, color: '#f7f4ec', passes: 1 });
  if (view === 'back') {
    dot(sk, cx, cy - r - 2, 10, BLACK2D);
    return;
  }
  const side = view === 'side';
  const ctx = sk.ctx;
  const holes = side ? [[cx + 30, cy - 10]] : [[cx - 22, cy - 10], [cx + 22, cy - 10]];
  ctx.save();
  ctx.fillStyle = '#efe6d6';
  for (const [x, y] of holes) {
    ctx.beginPath();
    ctx.ellipse(x, y, side ? 16 : 18, 11, 0, 0, PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(side ? cx + 36 : cx, cy + 30, side ? 10 : 16, 9, 0, 0, PI * 2);
  ctx.fill();
  ctx.restore();
  for (const [x, y] of holes) {
    sk.ellipse(x, y, side ? 16 : 18, 11, { width: 2.6, color: BLACK2D, overlap: 0.2 });
    dot(sk, x + (side ? 6 : 2), y + 1, 4.2, BLACK2D);
    sk.line(x - 16, y - 16, x + 14, y - 10, { width: 4, color: BLACK2D });
  }
  sk.ellipse(side ? cx + 36 : cx, cy + 30, side ? 10 : 16, 9, { width: 2.6, color: BLACK2D });
  sk.line((side ? cx + 28 : cx - 10), cy + 30, (side ? cx + 44 : cx + 10), cy + 31, { width: 1.6, color: BLACK2D });
  if (side) sk.stroke([[cx + r - 2, cy - 2], [cx + r + 10, cy + 14], [cx + r - 4, cy + 18]], { width: 3.5, color: BLACK2D });
}

function bruteHead(sk, view) {
  const cx = 128;
  const cy = 136;
  const w = 74;
  const h = 82;
  const shape = view === 'side'
    ? [[cx - w * 0.9, cy - h * 0.55], [cx - w * 0.5, cy - h], [cx + w * 0.5, cy - h * 0.95], [cx + w * 0.92, cy - h * 0.5], [cx + w * 1.02, cy - h * 0.05], [cx + w * 0.86, cy + h * 0.2], [cx + w * 0.96, cy + h * 0.62], [cx + w * 0.55, cy + h], [cx - w * 0.6, cy + h * 0.95], [cx - w * 0.95, cy + h * 0.4]]
    : [[cx - w, cy - h * 0.6], [cx - w * 0.62, cy - h], [cx + w * 0.62, cy - h], [cx + w, cy - h * 0.6], [cx + w * 1.04, cy + h * 0.5], [cx + w * 0.62, cy + h], [cx - w * 0.62, cy + h], [cx - w * 1.04, cy + h * 0.5]];
  sk.paper(shape);
  // shading on one side
  const shadeSide = shape.map(([x, y]) => [Math.max(x, cx + w * 0.25), y]);
  sk.hatch(shadeSide, { spacing: 4, angle: -1.0, color: BLACK2D, width: 1.4 });
  sk.stroke([...shape, shape[0]], { width: 4.8, color: BLACK2D });
  if (view === 'back') {
    for (let i = 0; i < 3; i++) sk.stroke(arc(cx, cy + h * 0.55 + i * 9, 40, 10, PI * 0.1, PI * 0.9, 8), { width: 2.4, color: BLACK2D });
    sk.stroke(arc(cx - w - 4, cy, 9, 16, PI * 0.5, PI * 1.5, 8), { width: 3.5, color: BLACK2D });
    sk.stroke(arc(cx + w + 4, cy, 9, 16, -PI * 0.5, PI * 0.5, 8), { width: 3.5, color: BLACK2D });
    return;
  }
  if (view === 'front') {
    sk.line(cx - 52, cy - 26, cx - 6, cy - 18, { width: 8, color: BLACK2D });
    sk.line(cx + 6, cy - 18, cx + 52, cy - 26, { width: 8, color: BLACK2D });
    dot(sk, cx - 26, cy - 6, 4.5);
    dot(sk, cx + 26, cy - 6, 4.5);
    sk.stroke([[cx - 2, cy - 8], [cx - 12, cy + 18], [cx + 2, cy + 22], [cx + 10, cy + 16]], { width: 3.5, color: BLACK2D });
    sk.stroke(arc(cx, cy + 58, 30, 12, PI * 1.15, PI * 1.85, 10), { width: 4.5, color: BLACK2D });
    // scar with stitches
    sk.line(cx + 34, cy - 40, cx + 46, cy + 4, { width: 3, color: RED2D });
    for (let i = 0; i < 4; i++) sk.line(cx + 34 + i * 3.5, cy - 32 + i * 10, cx + 46 + i * 3.5, cy - 34 + i * 10, { width: 1.8, color: RED2D, passes: 1 });
    for (let i = 0; i < 40; i++) dot(sk, cx + sk.r(-58, 58), cy + sk.r(34, 74), 1.3, '#3a3a40');
    sk.stroke(arc(cx - w - 4, cy, 9, 16, PI * 0.5, PI * 1.5, 8), { width: 3.5, color: BLACK2D });
    sk.stroke(arc(cx + w + 4, cy, 9, 16, -PI * 0.5, PI * 0.5, 8), { width: 3.5, color: BLACK2D });
  } else {
    sk.line(cx + 14, cy - 24, cx + w * 0.95, cy - 22, { width: 8, color: BLACK2D });
    dot(sk, cx + w * 0.62, cy - 6, 4.5);
    sk.stroke(arc(cx - 16, cy + 6, 11, 18, -PI * 0.5, PI * 0.5, 8), { width: 3.5, color: BLACK2D });
    sk.line(cx + w * 0.4, cy + 56, cx + w * 0.9, cy + 52, { width: 4, color: BLACK2D });
    for (let i = 0; i < 24; i++) dot(sk, cx + sk.r(0, 66), cy + sk.r(34, 74), 1.3, '#3a3a40');
  }
}

function civHead(sk, view, kind) {
  const cx = 128;
  const cy = 142;
  const r = 56;
  const head = ellipsePts(cx, cy, r, r * 1.04, 28);
  if (kind === 1) {
    // long hair behind
    const hair = [...arc(cx, cy, r * 1.15, r * 1.12, PI * 0.95, PI * 2.05, 16), [cx + r * 1.12, cy + r * 1.3], [cx - r * 1.12, cy + r * 1.3]];
    if (view !== 'side') {
      sk.paper(hair);
      for (let i = 0; i < 22; i++) {
        const x = cx - r * 1.05 + (i / 21) * r * 2.1;
        sk.stroke([[x, cy - r * 0.6], [x + sk.r(-4, 4), cy + r * 0.4], [x + sk.r(-6, 6), cy + r * 1.25]], { width: 1.6, color: INK2D, passes: 1 });
      }
    } else {
      const tail = [[cx - r * 0.5, cy - r * 0.7], [cx - r * 1.4, cy + r * 0.3], [cx - r * 1.2, cy + r * 1.2], [cx - r * 0.6, cy + r * 0.4]];
      sk.paper(tail);
      for (let i = 0; i < 9; i++) sk.stroke([[cx - r * 0.6, cy - r * 0.5], [cx - r * (1.0 + i * 0.04), cy + r * 0.3], [cx - r * (0.9 + i * 0.05), cy + r * 1.1]], { width: 1.5, color: INK2D, passes: 1 });
    }
  }
  sk.paper(head);
  sk.stroke([...head, head[0]], { width: 3.6, color: INK2D });
  if (view === 'back') {
    const cap = arc(cx, cy, r, r * 1.04, PI * 0.9, PI * 2.1, 18);
    sk.paper([...cap, [cx, cy + r * 0.5]]);
    if (kind === 2) {
      sk.hatch([...arc(cx, cy - 10, r * 1.05, r * 0.9, PI, PI * 2, 12)], { spacing: 4, color: INK2D, width: 1.4 });
      sk.ellipse(cx, cy - 12, r * 1.35, 12, { width: 3, color: INK2D });
    } else {
      sk.scribbleIn([...cap, [cx, cy + r * 0.5]], { color: INK2D, width: 1.6, count: 70, step: 16 });
    }
    sk.stroke([...head, head[0]], { width: 3.6, color: INK2D });
    return;
  }
  const side = view === 'side';
  if (kind === 2) {
    // hat
    const crown = [[cx - r * 0.8, cy - r * 0.45], [cx - r * 0.7, cy - r * 1.25], [cx + r * 0.7, cy - r * 1.25], [cx + r * 0.8, cy - r * 0.45]];
    sk.paper(crown);
    sk.hatch(crown, { spacing: 3.5, color: INK2D, width: 1.4, cross: 1 });
    sk.stroke([...crown, crown[0]], { width: 3, color: INK2D });
    sk.ellipse(cx + (side ? 10 : 0), cy - r * 0.45, r * 1.35, 10, { width: 3, color: INK2D });
  } else {
    const top = arc(cx, cy, r * 1.02, r * 1.06, PI * (side ? 0.95 : 1.05), PI * (side ? 1.8 : 1.95), 14);
    const poly = [...top, [cx + (side ? 0 : r * 0.5), cy - r * 0.5], [cx - (side ? r * 0.2 : r * 0.5), cy - r * 0.55]];
    sk.paper(poly);
    sk.scribbleIn(poly, { color: INK2D, width: 1.6, count: 60, step: 14 });
  }
  if (side) {
    sk.stroke([[cx + r * 0.98, cy - 4], [cx + r * 1.12, cy + 8], [cx + r * 0.94, cy + 12]], { width: 2.6, color: INK2D });
    sk.stroke(arc(cx - 6, cy + 6, 8, 12, -PI * 0.5, PI * 0.5, 6), { width: 2.4, color: INK2D });
  }
}

// ------------------------------------------------------------------ torsos (front only)
function torsoHoodie(sk) {
  const s = [[44, 34], [92, 14], [164, 14], [212, 34], [226, 236], [30, 236]];
  sk.paper(s, '#f4f1ea');
  sk.hatch(s, { spacing: 5, angle: -1.0, color: BLACK2D, width: 1.4, alpha: 0.75 });
  const sideL = [[44, 34], [80, 30], [72, 236], [30, 236]];
  const sideR = [[212, 34], [176, 30], [184, 236], [226, 236]];
  sk.hatch(sideL, { spacing: 3.5, angle: 0.5, color: BLACK2D, width: 1.3 });
  sk.hatch(sideR, { spacing: 3.5, angle: 0.5, color: BLACK2D, width: 1.3 });
  sk.stroke([...s, s[0]], { width: 4.6, color: BLACK2D });
  // hood bunch
  sk.stroke(arc(128, 22, 56, 26, 0.1, PI - 0.1, 12), { width: 3.6, color: BLACK2D });
  sk.line(112, 40, 106, 110, { width: 2, color: BLACK2D });
  sk.line(144, 40, 150, 110, { width: 2, color: BLACK2D });
  // pocket
  sk.stroke([[76, 170], [92, 140], [164, 140], [180, 170], [180, 210], [76, 210], [76, 170]], { width: 3, color: BLACK2D });
}

function torsoJacket(sk) {
  const s = [[40, 30], [96, 12], [160, 12], [216, 30], [222, 236], [34, 236]];
  sk.paper(s, '#f4f1ea');
  sk.hatch(s, { spacing: 3.6, angle: -1.1, color: BLACK2D, width: 1.5, cross: 1, alpha: 0.85 });
  sk.stroke([...s, s[0]], { width: 4.6, color: BLACK2D });
  // collar & zipper
  sk.poly([[96, 12], [118, 70], [128, 52], [138, 70], [160, 12]], false, { width: 3.4, color: BLACK2D });
  sk.line(128, 52, 128, 236, { width: 3, color: '#f7f4ec' });
  for (let y = 60; y < 230; y += 9) sk.line(124, y, 132, y + 2, { width: 1.4, color: BLACK2D, passes: 1 });
  sk.line(60, 150, 100, 150, { width: 2.4, color: '#f7f4ec' });
  sk.line(156, 150, 196, 150, { width: 2.4, color: '#f7f4ec' });
}

function torsoBrute(sk) {
  const s = [[30, 44], [70, 12], [96, 12], [100, 44], [156, 44], [160, 12], [186, 12], [226, 44], [240, 150], [214, 238], [42, 238], [16, 150]];
  sk.paper(s, '#f4f1ea');
  const shade = [[180, 44], [226, 44], [240, 150], [214, 238], [170, 238]];
  sk.hatch(shade, { spacing: 4, angle: -1.2, color: BLACK2D, width: 1.4 });
  sk.stroke([...s, s[0]], { width: 5, color: BLACK2D });
  // muscle contours
  sk.stroke(arc(96, 92, 40, 26, 0.2, PI - 0.4, 10), { width: 2.6, color: BLACK2D });
  sk.stroke(arc(160, 92, 40, 26, 0.4, PI - 0.2, 10), { width: 2.6, color: BLACK2D });
  sk.line(128, 70, 128, 220, { width: 2, color: BLACK2D });
  for (let i = 0; i < 3; i++) {
    sk.line(108, 140 + i * 26, 124, 142 + i * 26, { width: 2, color: BLACK2D });
    sk.line(132, 142 + i * 26, 148, 140 + i * 26, { width: 2, color: BLACK2D });
  }
}

function torsoCoat(sk) {
  const s = [[46, 30], [98, 14], [158, 14], [210, 30], [218, 238], [38, 238]];
  sk.paper(s, '#f4f1ea');
  sk.hatch([[46, 30], [84, 26], [80, 238], [38, 238]], { spacing: 5, angle: 0.6, color: INK2D, width: 1.2 });
  sk.stroke([...s, s[0]], { width: 3.8, color: INK2D });
  sk.poly([[98, 14], [122, 84], [128, 62], [134, 84], [158, 14]], false, { width: 2.8, color: INK2D });
  sk.line(128, 84, 128, 236, { width: 2, color: INK2D });
  for (let i = 0; i < 4; i++) dot(sk, 136, 104 + i * 32, 3.2, INK2D);
  sk.line(60, 170, 104, 170, { width: 2, color: INK2D });
  sk.line(152, 170, 196, 170, { width: 2, color: INK2D });
}

function torsoDress(sk) {
  const s = [[94, 14], [162, 14], [176, 76], [230, 238], [26, 238], [80, 76]];
  sk.paper(s, '#f4f1ea');
  sk.hatch([[80, 76], [176, 76], [230, 238], [26, 238]], { spacing: 6, angle: -1.3, color: INK2D, width: 1.1, alpha: 0.6 });
  sk.stroke([...s, s[0]], { width: 3.8, color: INK2D });
  sk.line(82, 78, 174, 78, { width: 3, color: INK2D });
  for (let i = 0; i < 5; i++) sk.stroke([[60 + i * 34, 120], [52 + i * 36, 236]], { width: 1.4, color: INK2D, passes: 1 });
}

// ------------------------------------------------------------------ monsters
function monsterShape(cx, cy, rx, ry, spikes, jag, rnd) {
  const pts = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * PI * 2;
    let rr = 1 + (rnd() - 0.5) * jag;
    if (spikes && i % spikes === 0) rr += 0.32;
    pts.push([cx + Math.cos(t) * rx * rr, cy + Math.sin(t) * ry * rr]);
  }
  return pts;
}

function monsterEyes(sk, eyes, back) {
  if (back) return;
  const ctx = sk.ctx;
  for (const [x, y, r] of eyes) {
    ctx.save();
    ctx.fillStyle = '#f7f4ec';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, sk.r(-0.3, 0.3), 0, PI * 2);
    ctx.fill();
    ctx.restore();
    dot(sk, x + sk.r(-2, 2), y + 1, r * 0.42, RED2D);
    dot(sk, x + sk.r(-1, 1), y + 1, r * 0.18, BLACK2D);
  }
}

function monsterMouth(sk, x0, x1, y, h, back) {
  if (back) return;
  const ctx = sk.ctx;
  const mouth = [[x0, y], [x1, y], [x1 - 8, y + h], [x0 + 8, y + h]];
  ctx.save();
  ctx.fillStyle = '#1a0d10';
  sk.path(mouth);
  ctx.fill();
  ctx.fillStyle = '#f7f4ec';
  const n = Math.round((x1 - x0) / 12);
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n;
    const b = x0 + ((x1 - x0) * (i + 1)) / n;
    ctx.beginPath();
    ctx.moveTo(a, y);
    ctx.lineTo(b, y);
    ctx.lineTo((a + b) / 2, y + h * 0.55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(a + 4, y + h);
    ctx.lineTo(b + 4, y + h);
    ctx.lineTo((a + b) / 2 + 4, y + h * 0.5);
    ctx.fill();
  }
  ctx.restore();
}

function monsterScrib(sk, back) {
  const shape = monsterShape(128, 140, 100, 92, 0, 0.18, sk.rnd);
  inked(sk, shape, BLACK2D, { count: 230, width: 3.4 });
  // tendrils
  for (let i = 0; i < 7; i++) {
    const t = sk.r(0, PI * 2);
    const x = 128 + Math.cos(t) * 96;
    const y = 140 + Math.sin(t) * 88;
    sk.stroke([[x, y], [x + Math.cos(t) * 18 + sk.r(-8, 8), y + Math.sin(t) * 16 + sk.r(-8, 8)], [x + Math.cos(t) * 28, y + Math.sin(t) * 26]], { width: 3, color: BLACK2D, passes: 1 });
  }
  if (back) {
    for (let i = 0; i < 5; i++) sk.poly([[118, 70 + i * 28], [128, 50 + i * 28], [138, 70 + i * 28]], false, { width: 3, color: '#f7f4ec' });
    return;
  }
  monsterEyes(sk, [[96, 112, 20], [160, 106, 15]], back);
  monsterMouth(sk, 70, 186, 156, 34, back);
}

function monsterStalk(sk, back) {
  const shape = monsterShape(128, 132, 64, 112, 0, 0.12, sk.rnd);
  inked(sk, shape, BLACK2D, { count: 200, width: 3.2 });
  if (back) {
    for (let i = 0; i < 6; i++) sk.line(128 + sk.r(-30, 30), 50 + i * 30, 128 + sk.r(-30, 30), 62 + i * 30, { width: 2.4, color: '#f7f4ec' });
    return;
  }
  monsterEyes(sk, [[128, 84, 26]], back);
  const ctx = sk.ctx;
  ctx.save();
  ctx.fillStyle = '#1a0d10';
  ctx.beginPath();
  ctx.ellipse(128, 166, 18, 50, 0, 0, PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f7f4ec';
  for (let i = 0; i < 6; i++) {
    const y = 124 + i * 14;
    ctx.beginPath();
    ctx.moveTo(112, y);
    ctx.lineTo(124, y + 5);
    ctx.lineTo(112, y + 10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(144, y + 6);
    ctx.lineTo(132, y + 11);
    ctx.lineTo(144, y + 16);
    ctx.fill();
  }
  ctx.restore();
}

function monsterSpike(sk, back) {
  const shape = monsterShape(128, 136, 92, 88, 3, 0.1, sk.rnd);
  inked(sk, shape, BLACK2D, { count: 220, width: 3.2 });
  if (back) return;
  monsterEyes(sk, [[94, 112, 14], [128, 98, 18], [162, 112, 14]], back);
  monsterMouth(sk, 64, 192, 146, 40, back);
}

// ------------------------------------------------------------------ nature & sky
function foliage(cx, cy, rx, ry, rnd, n = 9) {
  const pts = [];
  const m = n * 6;
  for (let i = 0; i <= m; i++) {
    const t = (i / m) * PI * 2;
    const bump = 1 + 0.13 * Math.abs(Math.sin(t * n * 0.5)) + (rnd() - 0.5) * 0.06;
    pts.push([cx + Math.cos(t) * rx * bump, cy + Math.sin(t) * ry * bump]);
  }
  return pts;
}

function tree(sk, kind) {
  const trunk = [[118, 252], [122, 150], [136, 150], [142, 252]];
  if (kind === 2) {
    // bare tree: branches only
    sk.paper(trunk);
    sk.hatch(trunk, { spacing: 3, angle: 1.4, color: INK2D, width: 1.2 });
    sk.stroke([...trunk, trunk[0]], { width: 3, color: INK2D });
    const branch = (x, y, a, len, depth) => {
      if (depth === 0) return;
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      sk.stroke([[x, y], [(x + x2) / 2 + sk.r(-3, 3), (y + y2) / 2 + sk.r(-3, 3)], [x2, y2]], { width: depth * 1.1, color: INK2D, passes: 1 });
      branch(x2, y2, a - sk.r(0.3, 0.6), len * 0.72, depth - 1);
      branch(x2, y2, a + sk.r(0.3, 0.6), len * 0.7, depth - 1);
    };
    branch(129, 152, -PI / 2, 50, 5);
    return;
  }
  const crown = kind === 1 ? foliage(128, 96, 54, 92, sk.rnd, 7) : foliage(128, 92, 104, 76, sk.rnd, 9);
  sk.paper(crown);
  sk.fill(crown, '#9fb27f', { spacing: 3.2, alpha: 0.5, overshoot: 0, angle: -0.9 });
  // shading on the lower right
  const sh = crown.filter(([x, y]) => x > 112 || y > 100);
  if (sh.length > 3) sk.hatch(crown.map(([x, y]) => [Math.max(x, 128), Math.max(y, 84)]), { spacing: 4.4, angle: -0.8, color: INK2D, width: 1.3, alpha: 0.8 });
  sk.stroke(crown, { width: 3, color: INK2D, passes: 2, jitter: 1 });
  for (let i = 0; i < 9; i++) {
    const x = 128 + sk.r(-70, 70) * (kind === 1 ? 0.45 : 1);
    const y = 92 + sk.r(-50, 50) * (kind === 1 ? 1.4 : 1);
    sk.stroke(arc(x, y, 9, 6, PI * 0.1, PI * 0.9, 5), { width: 1.6, color: INK2D, passes: 1 });
  }
  sk.paper(trunk);
  sk.hatch(trunk, { spacing: 3, angle: 1.4, color: INK2D, width: 1.2 });
  sk.stroke([...trunk, trunk[0]], { width: 3, color: INK2D });
  sk.line(129, 168, 112, 140, { width: 2.6, color: INK2D });
  sk.line(131, 176, 150, 150, { width: 2.6, color: INK2D });
}

function bush(sk) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = PI + (i / 40) * PI;
    const bump = 1 + 0.14 * Math.abs(Math.sin(t * 6)) + sk.r(-0.03, 0.03);
    pts.push([128 + Math.cos(t) * 118 * bump, 238 + Math.sin(t) * 150 * bump]);
  }
  const poly = [...pts, [246, 238], [10, 238]];
  sk.paper(poly);
  sk.fill(poly, '#9fb27f', { spacing: 3.2, alpha: 0.5, overshoot: 0 });
  sk.hatch(poly.map(([x, y]) => [Math.max(x, 120), y]), { spacing: 4.4, angle: -0.8, color: INK2D, width: 1.3, alpha: 0.75 });
  sk.stroke(pts, { width: 3, color: INK2D });
  sk.line(10, 238, 246, 238, { width: 3, color: INK2D });
}

function cloud(sk, variant) {
  const cx = 128;
  const cy = 150;
  const bumps = variant === 0 ? [[-80, 10, 34], [-36, -18, 46], [16, -28, 48], [62, -8, 40], [96, 14, 26]] : [[-86, 14, 28], [-44, -6, 40], [6, -20, 44], [54, -10, 38], [92, 12, 24]];
  const pts = [[cx - 112, cy + 30]];
  for (const [dx, dy, r] of bumps) pts.push(...arc(cx + dx, cy + dy, r, r * 0.86, PI * 1.05, PI * 1.95, 8));
  pts.push([cx + 116, cy + 30]);
  sk.paper([...pts, [cx + 116, cy + 32], [cx - 112, cy + 32]], '#fbf9f3');
  sk.stroke(pts, { width: 2.6, color: INK2D, passes: 1, jitter: 0.8 });
  sk.line(cx - 112, cy + 30, cx + 116, cy + 30, { width: 2.2, color: INK2D });
  sk.hatch([[cx - 90, cy + 12], [cx + 90, cy + 12], [cx + 100, cy + 30], [cx - 100, cy + 30]], { spacing: 5, angle: -0.6, color: INK2D, width: 1.1, alpha: 0.55 });
}

// ------------------------------------------------------------------ FX
function jagged(cx, cy, r, n, rnd, inner = 0.55) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const t = (i / (n * 2)) * PI * 2 + (rnd() - 0.5) * 0.12;
    const rr = i % 2 === 0 ? r * (0.85 + rnd() * 0.2) : r * inner * (0.85 + rnd() * 0.25);
    pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
  }
  return pts;
}

function fxImpact(sk) {
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * PI * 2 + sk.r(-0.15, 0.15);
    const r0 = sk.r(24, 40);
    const r1 = sk.r(80, 116);
    sk.line(128 + Math.cos(t) * r0, 128 + Math.sin(t) * r0, 128 + Math.cos(t) * r1, 128 + Math.sin(t) * r1, { width: sk.r(2.5, 5), color: BLACK2D, overshoot: 0 });
  }
  sk.circle(128, 128, 18, { width: 3, color: BLACK2D });
}

function fxBoom(sk) {
  const outer = jagged(128, 128, 118, 13, sk.rnd, 0.62);
  sk.paper(outer);
  sk.fill(outer, '#f2c46a', { spacing: 3.4, alpha: 0.45, overshoot: 0 });
  sk.stroke([...outer, outer[0]], { width: 3.6, color: BLACK2D });
  const inner = jagged(128, 128, 66, 9, sk.rnd, 0.6);
  sk.stroke([...inner, inner[0]], { width: 2.6, color: BLACK2D });
  sk.hatch(outer.map(([x, y]) => [x, Math.max(y, 150)]), { spacing: 4, angle: -0.7, color: BLACK2D, width: 1.3, alpha: 0.6 });
  for (let i = 0; i < 10; i++) {
    const t = sk.r(0, PI * 2);
    const d = sk.r(70, 112);
    sk.rect(128 + Math.cos(t) * d - 3, 128 + Math.sin(t) * d - 3, 6, 6, { width: 2, color: BLACK2D });
  }
}

function fxZap(sk) {
  for (let k = 0; k < 4; k++) {
    let x = 128 + sk.r(-20, 20);
    let y = 12;
    const pts = [[x, y]];
    while (y < 244) {
      x += sk.r(-30, 30);
      y += sk.r(18, 34);
      pts.push([x, y]);
    }
    sk.stroke(pts, { width: k === 0 ? 5 : 2.4, color: k === 0 ? '#2e8b57' : BLACK2D, passes: 1, jitter: 0.5 });
  }
}

function fxCrash(sk) {
  for (let i = 0; i < 14; i++) {
    const t = sk.r(0, PI * 2);
    const d = sk.r(20, 100);
    const x = 128 + Math.cos(t) * d;
    const y = 128 + Math.sin(t) * d;
    const s = sk.r(6, 16);
    sk.poly([[x, y], [x + s, y + sk.r(-4, 4)], [x + s * 0.4, y + s]], true, { width: 2.2, color: BLACK2D });
  }
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * PI * 2;
    sk.line(128 + Math.cos(t) * 30, 128 + Math.sin(t) * 30, 128 + Math.cos(t) * 70, 128 + Math.sin(t) * 70, { width: 2, color: BLACK2D });
  }
}

function fxMark(sk, ch, color, size = 170) {
  sk.text(ch, 128, 132, { size, color, font: FONT_HAND, dir: 'ltr', passes: 2, weight: 400 });
  sk.stroke([[70, 222], [128, 230], [190, 220]], { width: 5, color, passes: 1 });
}

function splat(sk, variant) {
  const cx = 128;
  const cy = 128;
  const pts = [];
  const n = 26;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * PI * 2;
    const rr = 68 + (variant === 0 ? Math.sin(t * 5) * 20 : Math.sin(t * 7 + 1) * 16) + sk.r(-10, 10);
    pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
  }
  const ctx = sk.ctx;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  sk.path(pts);
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const t = sk.r(0, PI * 2);
    const d = sk.r(90, 118);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(t) * d, cy + Math.sin(t) * d, sk.r(4, 10), 0, PI * 2);
    ctx.fill();
  }
  ctx.restore();
  sk.stroke([...pts, pts[0]], { width: 2.4, color: '#9a9aa4', passes: 1 });
}

function smoke(sk) {
  for (let i = 0; i < 6; i++) {
    const x = 128 + sk.r(-50, 50);
    const y = 128 + sk.r(-40, 40);
    const r = sk.r(34, 58);
    sk.paper(ellipsePts(x, y, r, r * 0.85, 18), 'rgba(235,233,228,0.9)');
  }
  sk.scribble(128, 128, 96, 80, { loops: 30, width: 2, color: '#6a6a78', alpha: 0.7 });
}

function muzzle(sk) {
  const outer = jagged(128, 128, 116, 8, sk.rnd, 0.35);
  sk.paper(outer, '#fff6cf');
  sk.stroke([...outer, outer[0]], { width: 3, color: BLACK2D });
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * PI * 2 + 0.2;
    sk.line(128 + Math.cos(t) * 20, 128 + Math.sin(t) * 20, 128 + Math.cos(t) * 60, 128 + Math.sin(t) * 60, { width: 2, color: BLACK2D });
  }
}

function eyeIcon(sk) {
  sk.paper(ellipsePts(128, 128, 100, 100, 30), '#f7f4ec');
  sk.circle(128, 128, 100, { width: 5, color: INK2D });
  sk.stroke(arc(128, 112, 62, 40, PI * 0.1, PI * 0.9, 14), { width: 6, color: INK2D });
  for (let i = 0; i < 5; i++) {
    const t = PI * 0.2 + i * PI * 0.15;
    const x = 128 + Math.cos(t) * 62;
    const y = 112 + Math.sin(t) * 40;
    sk.line(x, y, x + Math.cos(t) * 16, y + Math.sin(t) * 20, { width: 4, color: INK2D });
  }
}

/**
 * Draw every cell. Must run after web fonts are loaded so the handwritten marks use them.
 */
export function buildAtlas() {
  const W = 1024;
  const H = 1024;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rects = {};
  let slot = 0;
  const cell = (name, fn, seed) => {
    const cx = (slot % 4) * C;
    const cy = Math.floor(slot / 4) * C;
    slot++;
    const tmp = makeCanvas(C, C);
    const tctx = tmp.getContext('2d');
    tctx.translate(C / 2, C / 2);
    tctx.scale(0.94, 0.94);
    tctx.translate(-C / 2, -C / 2);
    const sk = new Sketcher(tctx, seed || slot * 977 + 31);
    fn(sk, tctx);
    ctx.drawImage(tmp, cx, cy);
    rects[name] = [cx / W, 1 - (cy + C) / H, C / W, C / H];
  };

  cell('fx_impact', fxImpact);
  cell('fx_boom', fxBoom);
  cell('fx_zap', fxZap);
  cell('fx_crash', fxCrash);
  cell('fx_alert', (sk) => fxMark(sk, '!', RED2D));
  cell('fx_question', (sk) => fxMark(sk, '?', INK2D));
  cell('fx_jam', (sk) => {
    sk.text('JAMMED!', 128, 128, { size: 60, color: RED2D, font: FONT_SIGN, weight: 400, dir: 'ltr', maxWidth: 230, rotate: -0.08 });
    sk.stroke([[30, 180], [128, 190], [226, 176]], { width: 5, color: RED2D, passes: 1 });
  });
  cell('fx_heart', (sk) => {
    // a doodled heart (the drawn friends, the hero's friend who draws you one)
    const pts = [];
    for (let i = 0; i <= 44; i++) {
      const t = (i / 44) * PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([128 + x * 5.8, 122 - y * 5.8]);
    }
    sk.fill(pts, '#ff4f78', { spacing: 3.2, alpha: 0.95, angle: -0.6 });
    sk.poly(pts, true, { width: 7, color: '#a3123c' });
    sk.stroke([[92, 82], [104, 72], [118, 74]], { width: 6, color: '#ffe3ea', passes: 1 });
  });
  cell('splat0', (sk) => splat(sk, 0));
  cell('splat1', (sk) => splat(sk, 1));
  cell('smoke0', smoke, 901);
  cell('smoke1', smoke, 902);
  cell('muzzle', muzzle);
  cell('eye', eyeIcon);
  cell('fx_star', (sk, g) => {
    // a twinkle: a four-pointed star of light in a soft glow (tinted when it is used)
    const glow = g.createRadialGradient(128, 128, 0, 128, 128, 112);
    glow.addColorStop(0, 'rgba(255,255,255,0.85)');
    glow.addColorStop(0.22, 'rgba(255,255,255,0.32)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(128, 128, 112, 0, PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 - PI / 2;
      const r = i % 2 ? 15 : i % 4 ? 70 : 120;
      g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { texture: tex, rects, canvas };
}

export { FONT_HAND };
