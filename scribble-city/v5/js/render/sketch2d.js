// Hand-drawn 2D drawing helpers on top of CanvasRenderingContext2D.
// Used for sprites (heads, bodies, trees...), billboards, blueprints and the UI.

import { mulberry32 } from '../core/util.js';

export const FONT_HAND = '"Gveret Levin", "Rubik", "Segoe Print", cursive';
export const FONT_UI = '"Rubik", "Heebo", "Segoe UI", sans-serif';
// In-world lettering (signs, ads, blueprints) is English, hand-lettered.
export const FONT_SIGN = '"Permanent Marker", "Caveat", "Rubik", sans-serif';
export const FONT_NOTE = '"Caveat", "Permanent Marker", "Rubik", sans-serif';

export const INK2D = '#1c2650';
export const BLACK2D = '#141418';
export const RED2D = '#b3191e';

export class Sketcher {
  constructor(ctx, seed = 1) {
    this.ctx = ctx;
    this.rnd = mulberry32(seed);
  }

  r(a = 0, b = 1) {
    return a + (b - a) * this.rnd();
  }

  // Smoothly jittered polyline drawn with several pencil passes.
  stroke(pts, o = {}) {
    const ctx = this.ctx;
    const color = o.color || INK2D;
    const width = o.width || 3;
    const passes = o.passes || 2;
    const jitter = o.jitter !== undefined ? o.jitter : 1.2;
    const alpha = o.alpha !== undefined ? o.alpha : 1;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    for (let p = 0; p < passes; p++) {
      const ph = this.r(0, 100);
      const amp = jitter * (p === 0 ? 1 : 1.6);
      ctx.globalAlpha = alpha * (p === 0 ? 0.95 : 0.45);
      ctx.lineWidth = width * (p === 0 ? 1 : 0.65);
      ctx.beginPath();
      const q = pts.map((pt, i) => [
        pt[0] + Math.sin(i * 1.7 + ph) * amp * 0.6 + this.r(-amp, amp) * 0.5,
        pt[1] + Math.cos(i * 1.3 + ph * 1.3) * amp * 0.6 + this.r(-amp, amp) * 0.5,
      ]);
      if (o.closed) q.push([q[0][0] + this.r(-1, 1) * amp, q[0][1] + this.r(-1, 1) * amp]);
      ctx.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < q.length - 1; i++) {
        const mx = (q[i][0] + q[i + 1][0]) / 2;
        const my = (q[i][1] + q[i + 1][1]) / 2;
        ctx.quadraticCurveTo(q[i][0], q[i][1], mx, my);
      }
      const last = q[q.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Straight-ish line with overshoot and a slight bow.
  line(x0, y0, x1, y1, o = {}) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(len / 10));
    const os = o.overshoot !== undefined ? o.overshoot : Math.min(4, len * 0.05);
    const dx = (x1 - x0) / (len || 1);
    const dy = (y1 - y0) / (len || 1);
    const a0 = this.r(-0.3, 1) * os;
    const a1 = this.r(-0.3, 1) * os;
    const sx = x0 - dx * a0;
    const sy = y0 - dy * a0;
    const ex = x1 + dx * a1;
    const ey = y1 + dy * a1;
    const bow = this.r(-1, 1) * Math.min(len * 0.025, 4);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const b = Math.sin(t * Math.PI) * bow;
      pts.push([sx + (ex - sx) * t - dy * b, sy + (ey - sy) * t + dx * b]);
    }
    this.stroke(pts, { jitter: 0.6, ...o });
  }

  poly(pts, closed, o = {}) {
    const n = pts.length;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      this.line(a[0], a[1], b[0], b[1], o);
    }
  }

  // Smooth curve through points (no overshoot), e.g. for organic shapes.
  curve(pts, o = {}) {
    this.stroke(pts, o);
  }

  ellipse(cx, cy, rx, ry, o = {}) {
    const n = Math.max(14, Math.round((rx + ry) * 0.5));
    const start = this.r(0, Math.PI * 2);
    const sweep = Math.PI * 2 + (o.overlap !== undefined ? o.overlap : this.r(0.15, 0.45));
    const wob = o.wobble !== undefined ? o.wobble : 0.04;
    const ph = this.r(0, 10);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = start + (i / n) * sweep;
      const k = 1 + Math.sin(t * 2 + ph) * wob + (i / n) * this.r(-0.02, 0.02);
      pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
    }
    this.stroke(pts, { jitter: 0.5, ...o });
  }

  circle(cx, cy, r, o = {}) {
    this.ellipse(cx, cy, r, r, o);
  }

  rect(x, y, w, h, o = {}) {
    this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, o);
  }

  // Crayon fill of a polygon using scan lines that wander past the edges a bit.
  fill(poly, color, o = {}) {
    const ctx = this.ctx;
    const ang = o.angle !== undefined ? o.angle : this.r(-0.9, -0.4);
    const spacing = o.spacing || 3.2;
    const width = o.width || spacing * 1.25;
    const over = o.overshoot !== undefined ? o.overshoot : 2.5;
    const alpha = o.alpha !== undefined ? o.alpha : 0.75;
    const ca = Math.cos(-ang);
    const sa = Math.sin(-ang);
    const rot = poly.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of rot) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    const cb = Math.cos(ang);
    const sb = Math.sin(ang);
    const back = (x, y) => [x * cb - y * sb, x * sb + y * cb];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    for (let y = minY + spacing * 0.5; y < maxY; y += spacing) {
      const xs = [];
      for (let i = 0; i < rot.length; i++) {
        const a = rot[i];
        const b = rot[(i + 1) % rot.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        if (this.rnd() < (o.skip || 0.04)) continue;
        const yy = y + this.r(-0.6, 0.6);
        const xa = xs[i] - this.r(-over * 0.6, over);
        const xb = xs[i + 1] + this.r(-over * 0.6, over);
        if (xb - xa < 0.5) continue;
        ctx.globalAlpha = alpha * this.r(0.65, 1);
        ctx.beginPath();
        const p0 = back(xa, yy);
        const p1 = back(xb, yy + this.r(-0.8, 0.8));
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  fillEllipse(cx, cy, rx, ry, color, o = {}) {
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const t = (i / 28) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
    }
    this.fill(pts, color, o);
  }

  // Tight back-and-forth kid scribble inside an ellipse (hair, smoke, monsters...).
  scribble(cx, cy, rx, ry, o = {}) {
    const n = o.loops || 40;
    const pts = [];
    let a = this.r(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      a += this.r(1.9, 3.4);
      const rr = this.r(0.35, 1);
      pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]);
    }
    this.stroke(pts, { width: o.width || 2, color: o.color || INK2D, passes: 1, jitter: 1.5, alpha: o.alpha || 0.9 });
  }

  // Path helper.
  path(poly, close = true) {
    const ctx = this.ctx;
    ctx.beginPath();
    poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (close) ctx.closePath();
  }

  // Run fn with the canvas clipped to a polygon.
  clip(poly, fn) {
    const ctx = this.ctx;
    ctx.save();
    this.path(poly);
    ctx.clip();
    fn();
    ctx.restore();
  }

  // Opaque paper underlay (so shapes hide what is behind them).
  paper(poly, color = '#f7f4ec') {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    this.path(poly);
    ctx.fill();
    ctx.restore();
  }

  // Pen hatching inside a polygon: parallel strokes (optionally crossed), slightly wobbly.
  hatch(poly, o = {}) {
    const ctx = this.ctx;
    const spacing = o.spacing || 6;
    const ang = o.angle !== undefined ? o.angle : -0.9;
    const width = o.width || 1.4;
    const color = o.color || INK2D;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of poly) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const R = Math.hypot(x1 - x0, y1 - y0) / 2 + spacing;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    this.clip(poly, () => {
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      for (let k = -R; k <= R; k += spacing) {
        if (this.rnd() < (o.skip || 0.05)) continue;
        const ox = cx - dy * k;
        const oy = cy + dx * k;
        const a = R * this.r(0.85, 1);
        ctx.globalAlpha = (o.alpha !== undefined ? o.alpha : 0.9) * this.r(0.7, 1);
        ctx.lineWidth = width * this.r(0.8, 1.15);
        ctx.beginPath();
        ctx.moveTo(ox - dx * a + this.r(-1, 1), oy - dy * a + this.r(-1, 1));
        ctx.quadraticCurveTo(ox + this.r(-1.5, 1.5), oy + this.r(-1.5, 1.5), ox + dx * a, oy + dy * a);
        ctx.stroke();
      }
    });
    if (o.cross) this.hatch(poly, { ...o, cross: o.cross - 1 || false, angle: ang + (o.crossAngle || 1.2), alpha: (o.alpha || 0.9) * 0.9 });
  }

  // Dense chaotic scribble clipped to a polygon (inked-in areas, monsters, hair).
  scribbleIn(poly, o = {}) {
    const ctx = this.ctx;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of poly) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const n = o.count || Math.round(((x1 - x0) * (y1 - y0)) / 60);
    this.clip(poly, () => {
      ctx.strokeStyle = o.color || INK2D;
      ctx.lineWidth = o.width || 1.6;
      ctx.lineCap = 'round';
      ctx.globalAlpha = o.alpha || 0.85;
      ctx.beginPath();
      let x = this.r(x0, x1);
      let y = this.r(y0, y1);
      ctx.moveTo(x, y);
      const step = o.step || Math.max(8, (x1 - x0) * 0.25);
      for (let i = 0; i < n; i++) {
        const nx = Math.min(x1 + 4, Math.max(x0 - 4, x + this.r(-step, step)));
        const ny = Math.min(y1 + 4, Math.max(y0 - 4, y + this.r(-step, step)));
        ctx.quadraticCurveTo(x + this.r(-step, step) * 0.6, y + this.r(-step, step) * 0.6, nx, ny);
        x = nx;
        y = ny;
      }
      ctx.stroke();
    });
  }

  // Erode a region with paper-grain speckles so crayon looks waxy.
  grain(x, y, w, h, amount = 0.25) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const count = Math.floor(w * h * 0.02 * amount);
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = this.r(0.2, 0.7);
      ctx.fillRect(x + this.r(0, w), y + this.r(0, h), this.r(0.8, 2.2), this.r(0.6, 1.4));
    }
    ctx.restore();
  }

  text(str, x, y, o = {}) {
    const ctx = this.ctx;
    ctx.save();
    let size = o.size || 32;
    ctx.font = `${o.weight || 700} ${size}px ${o.font || FONT_HAND}`;
    if (o.maxWidth) {
      const mw = ctx.measureText(str).width;
      if (mw > o.maxWidth) {
        size = Math.floor((size * o.maxWidth) / mw);
        ctx.font = `${o.weight || 700} ${size}px ${o.font || FONT_HAND}`;
      }
    }
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    ctx.direction = o.dir || 'rtl';
    ctx.translate(x, y);
    ctx.rotate(o.rotate || 0);
    if (o.outline) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = o.outline;
      ctx.lineWidth = o.outlineWidth || 6;
      ctx.strokeText(str, 0, 0);
    }
    ctx.fillStyle = o.color || INK2D;
    const passes = o.passes || 2;
    for (let p = 0; p < passes; p++) {
      ctx.globalAlpha = p === 0 ? 1 : 0.35;
      ctx.fillText(str, p === 0 ? 0 : this.r(-1, 1), p === 0 ? 0 : this.r(-1, 1));
    }
    ctx.restore();
  }

  star(cx, cy, r, points = 5, o = {}) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const t = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * (o.inner || 0.45);
      pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
    }
    if (o.fill) this.fill(pts, o.fill, { spacing: 2.5, overshoot: 1.5 });
    this.poly(pts, true, o);
    return pts;
  }
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Circle / ellipse polygon helper.
export function ellipsePts(cx, cy, rx, ry, n = 24, a0 = 0, a1 = Math.PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return pts;
}
