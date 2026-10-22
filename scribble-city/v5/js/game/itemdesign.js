import { clamp } from '../core/util.js';
import { placeOf, carNums } from './itemlook.js';

// (ROADMAP 11.27) The thing designed from the drawing. What a drawing is read as (game/partnet.js) says
// what it is; here it is made the way such a thing is made - a machine gun on its mount, a cannon on
// its carriage or in its turret, wings, a hot-air balloon - and the drawing says how: how long it is
// and how its length is shared (a long barrel, a short stock), which parts it has (three barrels: a
// minigun; a wheel: a cannon on its carriage; drawn pointing up: a mortar; feathers: a bird's wings; a
// basket under the balloon...), its colour (its ink), its hand (a wobbly line: a little bent) - each
// inside what such a thing can be: a machine gun is never a giant toast.
//
// The ink lands on the car as it was drawn (game/itemlook.js placeOf), then straightens onto the
// thing's own lines (tidy: each line onto the edge most of it is near, evenly along the stretch of it
// it covers); what such a thing must have and the drawing did not draw comes in dashed; then it fills
// (game/partpen.js drawFlights, game/designbuild.js).
//
// A design: { shape (game/designbuild.js: its parts as primitives in the car's frame - prims -, the
// drawing's lines tidied, on its plane - ink -, its colours - pal -, where it turns or bobs), at, P3
// (the drawing laid on the car as drawn), T3 (each of its points tidied onto the thing), fade (its lines
// that were none of the thing: they go), dash (the parts it was given: outlines in the car's frame),
// mirror, flip, side, n (its numbers, as designed), traits (what was read in the drawing) }.

export const DESIGNED = new Set(['mg', 'cannon', 'wing', 'balloon']);

const METAL = [0.22, 0.23, 0.25];
const DARK = [0.11, 0.11, 0.13];
const IRON = [0.17, 0.17, 0.19];
const BRONZE = [0.7, 0.5, 0.22];
const WOOD = [0.5, 0.33, 0.18];
const TAN = [0.4, 0.35, 0.27];
const OLIVE = [0.33, 0.36, 0.26];
const WICKER = [0.7, 0.53, 0.3];
const CREAM = [0.97, 0.95, 0.9];
const RED = [0.9, 0.2, 0.22];
const YELLOW = [1, 0.8, 0.22];
const ROPE = [0.36, 0.31, 0.24];

const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const mix = (a, b, t) => a.map((x, i) => Math.round((x + (b[i] - x) * t) * 1000) / 1000);
// the drawing's own colour - none for pencil, black (as game/fuse.js drawnColours reads it)
const hueOf = (ink) => (ink && !ink.pencil && lum(ink.c) > 0.3 ? ink.c : null);
const lerp = (a, b, t) => a + (b - a) * t;
const r3 = (q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000, Math.round(q[2] * 1000) / 1000];
const r2 = (q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000];

// ------------------------------------------------------------------ lines
function boxOf(lines) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of lines) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function lenOf(L) {
  let s = 0;
  for (let i = 1; i < L.length; i++) s += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]);
  return s;
}

// a point every `step` along it, about
function dense(L, step) {
  const out = [L[0]];
  for (let i = 1; i < L.length; i++) {
    const [ax, ay] = L[i - 1];
    const [bx, by] = L[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(step, 1e-6)));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

// its points evened out by their neighbours (k each side), its ends where they were
function smooth(L, k = 2) {
  if (L.length < 3) return L.map((q) => q.slice());
  return L.map((q, i) => {
    if (i === 0 || i === L.length - 1) return q.slice();
    let x = 0;
    let y = 0;
    let n = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(L.length - 1, i + k); j++) {
      x += L[j][0];
      y += L[j][1];
      n++;
    }
    return [x / n, y / n];
  });
}

function thin(L, n) {
  if (L.length <= n) return L;
  const out = [];
  for (let i = 0; i < n; i++) out.push(L[Math.round((i * (L.length - 1)) / (n - 1))]);
  return out;
}

function median(a) {
  const b = a.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!b.length) return NaN;
  return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
}

const turn = (lines, a) => {
  const c = Math.cos(-a);
  const s = Math.sin(-a);
  return lines.map((L) => L.map(([x, y]) => [x * c - y * s, x * s + y * c]));
};

// the way most of its ink runs (its lines, not its points: a wheel drawn round adds nothing), radians
// in (-π/2, π/2]
function runOf(lines) {
  let c = 0;
  let s = 0;
  for (const L of lines) {
    for (let i = 1; i < L.length; i++) {
      const dx = L[i][0] - L[i - 1][0];
      const dy = L[i][1] - L[i - 1][1];
      const l = Math.hypot(dx, dy);
      if (!l) continue;
      const a = Math.atan2(dy, dx) * 2;
      c += Math.cos(a) * l;
      s += Math.sin(a) * l;
    }
  }
  return Math.atan2(s, c) / 2;
}

// the way its ink lies (its points: a feather's length, a balloon's height), radians - and how much
// more it lies that way than across (1: a blob)
function spreadOf(lines) {
  const P = [];
  const B = boxOf(lines);
  const step = Math.max(B.w, B.h, 1e-3) / 80;
  for (const L of lines) for (const q of dense(L, step)) P.push(q);
  let mx = 0;
  let my = 0;
  for (const [x, y] of P) {
    mx += x;
    my += y;
  }
  mx /= P.length;
  my /= P.length;
  let a = 0;
  let b = 0;
  let c = 0;
  for (const [x, y] of P) {
    a += (x - mx) * (x - mx);
    b += (x - mx) * (y - my);
    c += (y - my) * (y - my);
  }
  const d = Math.sqrt(((a - c) / 2) ** 2 + b * b);
  const l1 = (a + c) / 2 + d;
  const l2 = Math.max(1e-9, (a + c) / 2 - d);
  return { a: 0.5 * Math.atan2(2 * b, a - c), k: Math.sqrt(l1 / l2) };
}

// how many corners a line has (sharp turns: a box's four, a circle's none)
function cornersOf(L, size) {
  const P = dense(L, Math.max(size, 1e-6) / 40);
  const w = 3;
  const turns = [];
  for (let i = w; i < P.length - w; i++) {
    const ax = P[i][0] - P[i - w][0];
    const ay = P[i][1] - P[i - w][1];
    const bx = P[i + w][0] - P[i][0];
    const by = P[i + w][1] - P[i][1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    turns.push(la && lb ? Math.acos(clamp((ax * bx + ay * by) / (la * lb), -1, 1)) : 0);
  }
  let n = 0;
  let last = -9;
  for (let i = 1; i < turns.length - 1; i++) {
    if (turns[i] > 1.05 && turns[i] >= turns[i - 1] && turns[i] >= turns[i + 1] && i - last > w) {
      n++;
      last = i;
    }
  }
  return n;
}

// a line: closed, how round (1 a circle), its box, its length
function featOf(L) {
  const b = boxOf([L]);
  const len = lenOf(L);
  const size = Math.max(b.w, b.h, 1e-6);
  const gap = Math.hypot(L[0][0] - L[L.length - 1][0], L[0][1] - L[L.length - 1][1]);
  const closed = L.length >= 4 && len > size * 1.6 && gap < Math.max(0.22 * size, 0.08 * len);
  let area = 0;
  for (let i = 0, j = L.length - 1; i < L.length; j = i++) area += L[j][0] * L[i][1] - L[i][0] * L[j][1];
  area = Math.abs(area) / 2;
  const per = len + gap;
  // (round: a square is as round by its area as a circle nearly - but it has corners)
  const corners = cornersOf(closed ? L.concat([L[0]]) : L, size);
  return { L, b, len, size, closed, area, corners, round: closed && per > 0 && corners <= 1 ? (4 * Math.PI * area) / (per * per) : 0 };
}

// along x from x0 to x1, n stations: the ink at each - its lowest, its highest, how tall (h), and how
// many lines a straight line up through its middle crosses (lines nearer than tol: one)
function profileOf(lines, x0, x1, n, tol) {
  const dx = (x1 - x0) / n;
  const P = [];
  for (let i = 0; i < n; i++) P.push({ x: x0 + (i + 0.5) * dx, lo: Infinity, hi: -Infinity, n: 0, h: 0, ink: false });
  for (const L of lines) {
    for (const [x, y] of dense(L, dx * 0.25)) {
      const i = Math.min(n - 1, Math.floor((x - x0) / dx));
      if (i < 0) continue;
      if (y < P[i].lo) P[i].lo = y;
      if (y > P[i].hi) P[i].hi = y;
    }
  }
  for (const p of P) {
    const ys = [];
    for (const L of lines) {
      for (let j = 1; j < L.length; j++) {
        const [ax, ay] = L[j - 1];
        const [bx, by] = L[j];
        if (ax === bx || (ax - p.x) * (bx - p.x) > 0) continue;
        ys.push(ay + ((by - ay) * (p.x - ax)) / (bx - ax));
      }
    }
    ys.sort((a, b) => a - b);
    let last = -Infinity;
    for (const y of ys) {
      if (y - last > tol) p.n++;
      last = y;
    }
    p.ink = p.hi >= p.lo;
    p.h = p.ink ? p.hi - p.lo : 0;
    p.mid = p.ink ? (p.hi + p.lo) / 2 : NaN;
  }
  return P;
}

// how unsteady its hand: 0 steady .. 1 shaky - how far, mostly, each bit of its lines is off the
// straight line between the bits a little before and after it (a corner here and there is not a hand)
function wobOf(lines, size) {
  const step = size / 100;
  const res = [];
  for (const L of lines) {
    const P = dense(L, step);
    for (let i = 3; i < P.length - 3; i += 2) {
      const mx = (P[i - 3][0] + P[i + 3][0]) / 2;
      const my = (P[i - 3][1] + P[i + 3][1]) / 2;
      res.push(Math.hypot(P[i][0] - mx, P[i][1] - my) / step);
    }
  }
  if (res.length < 8) return 0;
  return clamp((median(res) - 0.15) * 1.5, 0, 1);
}

// (a line drawn round - closed, or most of a circle: a wheel) the circle through it: { cx, cy, r, err
// (how far off it, of r), arc (how much of the way round it goes, 0..1) }
function circleOf(L) {
  const b = boxOf([L]);
  const P = dense(L, Math.max(b.w, b.h, 1e-6) / 40);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sx = 0;
  let sy = 0;
  let sxz = 0;
  let syz = 0;
  let sz = 0;
  const n = P.length;
  for (const [x, y] of P) {
    const z = x * x + y * y;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sx += x;
    sy += y;
    sxz += x * z;
    syz += y * z;
    sz += z;
  }
  // (x² + y² + Dx + Ey + F = 0, least squares - Kåsa's)
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const r0 = [-sxz, -syz, -sz];
  for (let i = 0; i < 3; i++) {
    let m = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
    [A[i], A[m]] = [A[m], A[i]];
    [r0[i], r0[m]] = [r0[m], r0[i]];
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let k = i + 1; k < 3; k++) {
      const f = A[k][i] / A[i][i];
      for (let j = i; j < 3; j++) A[k][j] -= f * A[i][j];
      r0[k] -= f * r0[i];
    }
  }
  const z = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let v = r0[i];
    for (let j = i + 1; j < 3; j++) v -= A[i][j] * z[j];
    z[i] = v / A[i][i];
  }
  const cx = -z[0] / 2;
  const cy = -z[1] / 2;
  const r = Math.sqrt(Math.max(0, cx * cx + cy * cy - z[2]));
  if (!(r > 1e-6)) return null;
  let e = 0;
  const an = [];
  for (const [x, y] of P) {
    e += (Math.hypot(x - cx, y - cy) - r) ** 2;
    an.push(Math.atan2(y - cy, x - cx));
  }
  an.sort((p, q) => p - q);
  let gap = an[0] + Math.PI * 2 - an[an.length - 1];
  for (let i = 1; i < an.length; i++) gap = Math.max(gap, an[i] - an[i - 1]);
  return { cx, cy, r, err: Math.sqrt(e / n) / r, arc: 1 - gap / (Math.PI * 2) };
}

// ------------------------------------------------------------------ the thing's own lines
function prep(P, closed) {
  const pts = closed ? P.concat([P[0]]) : P.slice();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] || 1e-6, closed };
}

// the nearest point of T to q: how far, and how far along T
function nearT(T, q) {
  let bd = Infinity;
  let bs = 0;
  const { pts, cum } = T;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-12;
    const t = clamp(((q[0] - ax) * dx + (q[1] - ay) * dy) / l2, 0, 1);
    const d = Math.hypot(q[0] - ax - dx * t, q[1] - ay - dy * t);
    if (d < bd) {
      bd = d;
      bs = cum[i - 1] + t * (cum[i] - cum[i - 1]);
    }
  }
  return { d: bd, s: bs };
}

function atS(T, s) {
  const { pts, cum, len } = T;
  const u = T.closed ? ((s % len) + len) % len : clamp(s, 0, len);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < u) i++;
  const t = (u - cum[i - 1]) / (cum[i] - cum[i - 1] || 1e-9);
  return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
}

// (the morph's second beat) each line of the drawing, already set over the thing on its plane, onto the
// thing's own lines (targets: { P, closed }): onto the one most of it is near, evenly along the stretch
// of it the line covers - a wobbly line drawn along an edge is that edge. Near none of them it was
// none of the thing (smoke, a cannonball, a scribble): it goes - smoothed, faded. Returns { lines, fade,
// on (the target each line went onto, -1 none) }
function tidy(lines, targets, tol) {
  const TT = targets.map((t) => prep(t.P, t.closed));
  const out = [];
  const fade = [];
  const on = [];
  for (const L of lines) {
    const near = L.map((q) => {
      let b = null;
      for (let k = 0; k < TT.length; k++) {
        const r = nearT(TT[k], q);
        if (!b || r.d < b.d) b = { d: r.d, s: r.s, k };
      }
      return b;
    });
    const votes = new Array(TT.length).fill(0);
    for (const r of near) if (r && r.d < tol) votes[r.k]++;
    let k = -1;
    let kn = 0;
    votes.forEach((n, i) => {
      if (n > kn) {
        kn = n;
        k = i;
      }
    });
    if (k < 0 || kn < L.length * 0.45) {
      out.push(smooth(L, 2));
      fade.push(true);
      on.push(-1);
      continue;
    }
    const T = TT[k];
    const ss = L.map((q, i) => (near[i].k === k ? near[i].s : nearT(T, q).s));
    if (T.closed) {
      for (let i = 1; i < ss.length; i++) {
        while (ss[i] - ss[i - 1] > T.len / 2) ss[i] -= T.len;
        while (ss[i] - ss[i - 1] < -T.len / 2) ss[i] += T.len;
      }
    }
    // (its stretch: where it begins to where it ends - one that went back on itself, as far as it went)
    let s0 = ss[0];
    let s1 = ss[ss.length - 1];
    const lo = Math.min(...ss);
    const hi = Math.max(...ss);
    if (hi - lo > Math.abs(s1 - s0) * 1.4) {
      if (s1 >= s0) {
        s0 = lo;
        s1 = hi;
      } else {
        s0 = hi;
        s1 = lo;
      }
    }
    out.push(L.map((q, i) => atS(T, lerp(s0, s1, i / Math.max(1, L.length - 1)))));
    fade.push(false);
    on.push(k);
  }
  return { lines: out, fade, on };
}

// a polygon's points down to those that carry its shape (eps off a straight line between them)
function rdp(P, eps) {
  if (P.length < 4) return P;
  const keep = new Uint8Array(P.length);
  keep[0] = 1;
  keep[P.length - 1] = 1;
  const st = [[0, P.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    const [ax, ay] = P[a];
    const [bx, by] = P[b];
    const dx = bx - ax;
    const dy = by - ay;
    const l = Math.hypot(dx, dy) || 1e-9;
    let bi = -1;
    let bd = eps;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / l;
      if (d > bd) {
        bd = d;
        bi = i;
      }
    }
    if (bi >= 0) {
      keep[bi] = 1;
      st.push([a, bi], [bi, b]);
    }
  }
  return P.filter((q, i) => keep[i]);
}

const DX8 = [1, 1, 0, -1, -1, -1, 0, 1];
const DY8 = [0, 1, 1, 1, 0, -1, -1, -1];

// the outline(s) round shapes on a plane seen together (polygons), as an eye sees them: drawn into a
// grid a step wide, each piece traced round
function outlineOf(polys, step) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const P of polys) {
    for (const [x, y] of P) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const pad = 2;
  const W = Math.ceil((x1 - x0) / step) + pad * 2 + 1;
  const H = Math.ceil((y1 - y0) / step) + pad * 2 + 1;
  const m = new Uint8Array(W * H);
  for (const P of polys) {
    for (let j = 0; j < H; j++) {
      const y = y0 + (j - pad) * step;
      const xs = [];
      for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
        const [xa, ya] = P[b];
        const [xb, yb] = P[a];
        if (ya <= y !== yb <= y) xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - x0) / step) + pad);
        const i1 = Math.min(W - 1, Math.floor((xs[k + 1] - x0) / step) + pad);
        for (let i = i0; i <= i1; i++) m[j * W + i] = 1;
      }
    }
  }
  const seen = new Uint8Array(W * H);
  const out = [];
  for (let s0 = 0; s0 < W * H; s0++) {
    if (!m[s0] || seen[s0]) continue;
    const q = [s0];
    seen[s0] = 1;
    let area = 0;
    while (q.length) {
      const c = q.pop();
      area++;
      const cx = c % W;
      const cy = (c - cx) / W;
      for (let d = 0; d < 8; d += 2) {
        const nx = cx + DX8[d];
        const ny = cy + DY8[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (m[k] && !seen[k]) {
          seen[k] = 1;
          q.push(k);
        }
      }
    }
    if (area < 4) continue;
    const sx = s0 % W;
    const sy = (s0 - sx) / W;
    const pts = [];
    let x = sx;
    let y = sy;
    let back = 4;
    let first = -1;
    for (let n = 0; n < W * H * 2; n++) {
      let found = -1;
      for (let k = 1; k <= 8; k++) {
        const d = (back + k) % 8;
        const nx = x + DX8[d];
        const ny = y + DY8[d];
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && m[ny * W + nx]) {
          found = d;
          break;
        }
      }
      if (found < 0) break;
      if (n > 0 && x === sx && y === sy && found === first) break;
      if (n === 0) first = found;
      pts.push([x0 + (x - pad) * step, y0 + (y - pad) * step]);
      x += DX8[found];
      y += DY8[found];
      back = (found + 5) % 8;
    }
    if (pts.length >= 4) out.push(rdp(pts, step * 0.7));
  }
  return out;
}

const rect = (a0, a1, b0, b1) => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
const circ = (a, b, r, n = 20) => Array.from({ length: n }, (_, i) => [a + r * Math.cos((i / n) * Math.PI * 2), b + r * Math.sin((i / n) * Math.PI * 2)]);
// a straight piece between two points on the plane, w wide
function bar(p, q, w) {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const l = Math.hypot(dx, dy) || 1e-6;
  const nx = (-dy / l) * (w / 2);
  const ny = (dx / l) * (w / 2);
  return [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]];
}

// ------------------------------------------------------------------ a gun drawn side on
// a drawn gun's main lines (long along it, or its body drawn round) - not its wheels, its drum, its
// legs, its magazine (B: its box)
function mainOf(F, B) {
  const out = F.filter((f) => {
    const round = (f.closed && f.round > 0.6 && f.b.w < f.b.h * 1.5) || (() => {
      const c = f.size > B.w * 0.06 && f.corners <= 1 ? circleOf(f.L) : null;
      return !!c && c.err < 0.13 && c.arc > 0.62 && f.b.w < f.b.h * 1.6;
    })();
    if (round) return false;
    return (f.b.w > B.w * 0.22 && f.b.w > f.b.h * 1.1) || (f.closed && f.b.w > B.w * 0.15 && f.b.w >= f.b.h * 1.3);
  });
  return out.length ? out : F;
}

// the drawing turned along the way it runs, its muzzle to +x - the thinner end of its main lines (a
// cannon's: the end away from its wheel) - as parts of its length (N: x 0..1 from its back, y up from
// its lowest)
function gunFrame(lines, kind = 'mg') {
  const th = runOf(lines);
  let T = turn(lines, th);
  let B = boxOf(T);
  const F = T.map(featOf);
  const main = mainOf(F, B);
  const P = profileOf(main.map((f) => f.L), B.x0, B.x1, 20, B.w * 0.018);
  const endH = (i0, i1) => median(P.slice(i0, i1).filter((p) => p.ink).map((p) => p.h));
  const back = endH(0, 6);
  const front = endH(14, 20);
  let flip = Number.isFinite(back) && Number.isFinite(front) && front > back * 1.08 ? -1 : 1;
  if (kind === 'cannon') {
    // (its wheel: under its back)
    const wh = F.filter((f) => !main.includes(f) && f.size > B.w * 0.1 && f.b.cy < B.cy + B.h * 0.1);
    if (wh.length) {
      const wx = wh.reduce((a, f) => a + f.b.cx, 0) / wh.length;
      flip = wx < B.cx ? 1 : -1;
    }
  }
  if (flip < 0) {
    T = T.map((L) => L.map(([x, y]) => [-x, y]));
    B = boxOf(T);
  }
  const Ld = Math.max(B.w, 1e-3);
  const N = T.map((L) => L.map(([x, y]) => [(x - B.x0) / Ld, (y - B.y0) / Ld]));
  // (how far up from level its muzzle points: + up)
  const elev = flip * th;
  return { th, flip, elev, Ld, N, h: B.h / Ld };
}

// a gun's own parts, side on (a: along it to the muzzle, b: up), made in the car's frame by X(a, b, x):
// primitives, the outline of them all seen together (sil), the outlines of those added (dash)
function gunSheet(X, toUV) {
  const S = { prims: [], sil: [], dash: [] };
  S.box = (a0, a1, b0, b1, hw, k, g = 'gun', o = {}) => {
    const x = o.x || 0;
    S.prims.push({ t: 'box', p0: r3(X(a0, b0, x - hw)), p1: r3(X(a1, b1, x + hw)), k, g });
    if (!o.noSil) S.sil.push(rect(a0, a1, b0, b1));
    if (o.dash) S.dash.push(rect(a0, a1, b0, b1));
  };
  // along it (a cylinder, a cone): from a0 to a1, at height b, its radius r0 to r1
  S.tube = (a0, a1, b, r0, r1, k, g = 'gun', o = {}) => {
    const x = o.x || 0;
    S.prims.push({ t: 'cyl', p0: r3(X(a0, b, x)), p1: r3(X(a1, b, x)), r0, r1, k, g, n: o.n || 14 });
    const P = [[a0, b - r0], [a1, b - r1], [a1, b + r1], [a0, b + r0]];
    if (!o.noSil) S.sil.push(P);
    if (o.dash) S.dash.push(P);
  };
  // between two points of it (a: [a, b]), round, r thick
  S.rod = (p, q, r, k, g = 'gun', o = {}) => {
    S.prims.push({ t: 'cyl', p0: r3(X(p[0], p[1], o.x0 || 0)), p1: r3(X(q[0], q[1], o.x1 || 0)), r0: r, r1: o.r1 || r, k, g, n: o.n || 8 });
    if (!o.noSil) S.sil.push(bar(p, q, Math.max(r, o.r1 || r) * 2));
    if (o.dash) S.dash.push(bar(p, q, r * 2));
  };
  // across it (a drum, a wheel's hub): round as seen from its side
  S.disc = (a, b, r, hw, k, g = 'gun', o = {}) => {
    const x = o.x || 0;
    S.prims.push({ t: 'cyl', p0: r3(X(a, b, x - hw)), p1: r3(X(a, b, x + hw)), r0: r, r1: r, k, g, n: o.n || 20 });
    if (!o.noSil) S.sil.push(circ(a, b, r));
    if (o.dash) S.dash.push(circ(a, b, r));
  };
  S.ball = (a, b, r, k, g = 'gun') => {
    S.prims.push({ t: 'sph', c: r3(X(a, b, 0)), r, k, g });
    S.sil.push(circ(a, b, r, 14));
  };
  // a ring round it at a (a band on a barrel); round a wheel's axle: ax 'x'
  S.ring = (a, b, R, r, k, g = 'gun', o = {}) => {
    S.prims.push({ t: 'tor', c: r3(X(a, b, o.x || 0)), R, r, ax: o.ax || 'z', k, g });
    if (!o.noSil) S.sil.push(o.ax === 'x' ? circ(a, b, R + r) : rect(a - r, a + r, b - R - r, b + R + r));
  };
  // a flat piece with its outline as seen from the side (ol: [a, b]), hw each way across
  S.slab = (ol, hw, k, g = 'gun', o = {}) => {
    S.prims.push({ t: 'slab', ax: 'x', c: o.x || 0, ol: ol.map(([a, b]) => r2(toUV(a, b))), W: hw * 2, k, g, edge: o.edge || 3 });
    if (!o.noSil) S.sil.push(ol);
    if (o.dash) S.dash.push(ol);
  };
  return S;
}

// what a machine gun drawn side on has: { bf (how much of it is barrel), body (its top, bottom), hb,
// barrels, hbar (how thick its barrel), mid (its barrel's line), stock, drop, mag, magH, drum, bipod,
// scope, grip }
function mgTraits(G) {
  const N = G.N;
  const F = N.map(featOf);
  // (its main lines - the rest hang off them: a magazine, a drum, legs, a sight)
  const mainF = mainOf(F, boxOf(N));
  const P = profileOf(mainF.map((f) => f.L), 0, 1, 20, 0.018);
  const Hmax = Math.max(1e-3, ...P.map((p) => p.h));
  let ib = P.length;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    if (!p.ink || p.h <= Hmax * 0.55 + 0.01 || (p.n >= 3 && i >= P.length * 0.25)) ib = i;
    else break;
  }
  const bf = ib >= P.length ? 0.45 : 1 - ib / P.length;
  const barrelP = P.slice(Math.min(ib, P.length - 2)).filter((p) => p.ink);
  const bodyP = P.slice(0, Math.max(1, ib)).filter((p) => p.ink);
  const bodyLo = median(bodyP.map((p) => p.lo));
  const bodyHi = median(bodyP.map((p) => p.hi));
  const hb = Math.max(0.02, (bodyHi - bodyLo) || 0.06);
  const cross = Math.round(median(barrelP.slice(0, -1).map((p) => p.n))) || 1;
  const barrels = cross >= 3 ? clamp(cross, 3, 6) : 1;
  const hbar = median(barrelP.map((p) => p.h)) || 0;
  const mid = Number.isFinite(median(barrelP.map((p) => p.mid))) ? median(barrelP.map((p) => p.mid)) : (bodyLo + bodyHi) / 2;
  const barLo = Number.isFinite(median(barrelP.map((p) => p.lo))) ? median(barrelP.map((p) => p.lo)) : mid;
  // a stock: its back end down below the barrel's line, more than the barrel is thick
  const backP = P.slice(0, 4).filter((p) => p.ink);
  const backLo = backP.length ? Math.min(...backP.map((p) => p.lo)) : barLo;
  const stock = backP.length > 0 && backLo < barLo - Math.max(0.05, hbar * 1.5);
  const drop = stock ? clamp(barLo - backLo - 0.08, 0, 0.12) : 0;
  const bEnd = 1 - bf;
  let mag = null;
  let drum = false;
  let grip = false;
  let bipod = false;
  let scope = false;
  for (const f of F) {
    if (mainF.includes(f)) continue;
    const { b } = f;
    const leg = !f.closed && b.h > b.w * 1.4 && b.h > 0.05;
    // (down from its front half to below it, upright: the legs of a bipod)
    if (leg && b.cx > 0.4 && b.y0 < barLo - 0.04 && b.y1 > barLo - 0.1) {
      bipod = true;
      continue;
    }
    // (under it, in its middle: big - a magazine, round - a drum; small - its grip)
    if (b.cx > 0.1 && b.cx < bEnd + 0.12 && b.y1 <= mid + 0.04 && b.y0 < barLo - 0.03) {
      if (f.size >= 0.07) {
        const c = f.corners <= 1 ? circleOf(f.L) : null;
        if ((f.closed && f.round > 0.55) || (c && c.err < 0.14 && c.arc > 0.62)) drum = true;
        else if (!mag || f.size > mag.size) mag = f;
      } else grip = true;
      continue;
    }
    // (over it, long: a sight)
    if (b.cx > 0.1 && b.cx < 0.78 && b.y0 > Math.max(bodyHi, mid) - 0.015 && b.w > b.h * 1.3 && b.w > 0.06 && b.w < 0.5) scope = true;
  }
  return { bf, hb, bodyLo, bodyHi, barrels, hbar, mid, stock, drop, mag: !!mag && !drum, magH: mag ? mag.b.h : 0, drum, bipod, scope, grip, wob: wobOf(N, 1) };
}

function mgDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const G = gunFrame(lines);
  const t = mgTraits(G);
  const len = clamp(G.Ld * 0.6, 1.1, 2);
  const bf = clamp(t.bf, 0.32, 0.6);
  const stockL = t.stock ? clamp(len * 0.2, 0.2, 0.38) : 0;
  const a0 = t.stock ? stockL : len * 0.05;
  const aB = Math.max(len * (1 - bf), a0 + 0.28);
  const hr = clamp(t.hb * len * 0.9, 0.14, 0.21);
  const wr = hr * 0.62;
  const multi = t.barrels >= 3;
  const rb = multi ? clamp(0.014 + len * 0.006, 0.02, 0.03) : clamp(0.026 + t.hbar * len * 0.1, 0.026, 0.045);
  const ya = hr * 0.64;
  const postH = 0.2;
  const aP = (a0 + aB) / 2;
  const zP = C.hoodZ - 0.05;
  const yP = C.hoodY + postH;
  const X = (a, b, x = 0) => [x, yP + b, zP + a - aP];
  const toUV = (a, b) => [zP + a - aP, yP + b];
  const S = gunSheet(X, toUV);
  const aM = len;
  // the receiver, its feed cover, its rear sight; the cradle under it, on its mount (the mount still on
  // the hood as the gun turns)
  S.box(a0, aB + 0.02, 0, hr, wr / 2, 'paint');
  S.box(a0 + 0.04, aB - 0.03, hr, hr + 0.022, wr * 0.36, 'paint');
  S.box(a0 + 0.02, a0 + 0.05, hr + 0.022, hr + 0.062, 0.01, 'dark');
  S.box(aP - 0.07, aP + 0.07, -0.035, 0.004, wr * 0.56, 'dark', 'gun', { dash: true });
  S.rod([aP, -postH], [aP, -0.03], 0.03, 'dark', 'base', { r1: 0.026, dash: true, n: 10 });
  S.box(aP - 0.11, aP + 0.11, -postH - 0.012, -postH + 0.012, 0.11, 'dark', 'base', { dash: true });
  if (!multi) {
    S.tube(aB, aM - 0.07, ya, rb, rb * 0.95, 'metal');
    if (t.hbar > 0.045) {
      // (a barrel drawn thick: its cooling jacket, ringed)
      const j1 = aB + (aM - aB) * 0.56;
      S.tube(aB - 0.01, j1, ya, rb * 1.85, rb * 1.85, 'dark');
      for (let i = 1; i <= 3; i++) S.ring(aB + ((j1 - aB) * i) / 4, ya, rb * 1.85, rb * 0.22, 'metal', 'gun', { noSil: true });
    }
    S.tube(aM - 0.075, aM, ya, rb * 1.3, rb * 1.55, 'dark');
    S.box(aM - 0.15, aM - 0.12, ya + rb * 0.8, ya + rb + 0.05, 0.006, 'dark');
  } else {
    // (three barrels or more: round their axis, turning together - a minigun)
    const R = rb * 1.9;
    for (let i = 0; i < t.barrels; i++) {
      const an = (i / t.barrels) * Math.PI * 2;
      S.prims.push({ t: 'cyl', p0: r3(X(aB, ya + Math.sin(an) * R, Math.cos(an) * R)), p1: r3(X(aM, ya + Math.sin(an) * R, Math.cos(an) * R)), r0: rb, r1: rb, k: 'metal', g: 'spin', n: 8 });
    }
    S.sil.push(rect(aB, aM, ya - R - rb, ya + R + rb));
    for (const f of [0.14, 0.56, 0.95]) S.tube(aB + (aM - aB) * f - 0.02, aB + (aM - aB) * f + 0.02, ya, R + rb * 1.25, R + rb * 1.25, 'dark', 'spin', { noSil: true, n: 16 });
    S.tube(aB - 0.1, aB + 0.04, ya, R + rb * 1.7, R + rb * 1.7, 'paint', 'gun', { n: 16 });
  }
  if (t.stock) {
    const drop = clamp(t.drop * len, 0, 0.07);
    S.slab([[a0 + 0.01, hr * 0.88], [a0 + 0.01, hr * 0.2], [0, -drop], [0, hr * 0.66 - drop * 0.5]], wr * 0.3, 'furn');
    S.box(-0.012, 0.004, -drop, hr * 0.66 - drop * 0.5, wr * 0.32, 'dark');
    const aG = a0 + 0.05;
    S.slab([[aG, 0.004], [aG + 0.056, 0.004], [aG + 0.03, -0.115], [aG - 0.028, -0.105]], wr * 0.26, 'furn', 'gun', { dash: !t.grip });
  } else {
    // (no stock: spade grips at its back, the trigger between them)
    for (const s of [1, -1]) S.rod([0.016, hr * 0.12], [0.016, hr * 0.92], 0.017, 'furn', 'gun', { x0: s * wr * 0.32, x1: s * wr * 0.32, dash: s > 0 });
    S.box(0.016, a0, hr * 0.25, hr * 0.8, wr * 0.4, 'dark', 'gun', { noSil: true });
  }
  const aMag = a0 + (aB - a0) * 0.45;
  if (t.drum) {
    const dr = clamp(hr * 0.95, 0.08, 0.14);
    S.disc(aMag, -dr * 0.72, dr, wr * 0.5, 'furn');
  } else if (t.mag) {
    const mw = clamp((aB - a0) * 0.22, 0.06, 0.1);
    const mh = clamp(t.magH * len, 0.12, 0.26);
    S.slab([[aMag - mw / 2, 0.004], [aMag + mw / 2, 0.004], [aMag + mw / 2 + 0.03, -mh], [aMag - mw / 2 + 0.03, -mh]], wr * 0.36, 'furn');
  } else {
    // (nothing under it: a box of rounds on its side, the belt into it)
    S.box(aMag - 0.09, aMag + 0.09, -0.07, hr * 0.7, 0.05, 'furn', 'gun', { x: wr / 2 + 0.055, dash: true });
    S.box(aMag - 0.03, aMag + 0.03, hr * 0.42, hr * 0.62, 0.03, 'dark', 'gun', { x: wr / 2 + 0.01, noSil: true });
  }
  if (t.bipod) {
    const ab = aB + (aM - aB) * 0.62;
    for (const s of [1, -1]) S.rod([ab, ya - rb], [ab + 0.07, -postH + 0.015], 0.011, 'dark', 'gun', { x0: s * 0.02, x1: s * 0.13, noSil: s < 0 });
  }
  if (t.scope) {
    const s0 = a0 + 0.05;
    const s1 = Math.max(s0 + 0.14, Math.min(aB - 0.02, s0 + 0.3));
    S.tube(s0, s1, hr + 0.085, 0.028, 0.032, 'dark');
    S.box(s0 + 0.04, s0 + 0.07, hr + 0.02, hr + 0.06, 0.014, 'dark', 'gun', { noSil: true });
    S.box(s1 - 0.07, s1 - 0.04, hr + 0.02, hr + 0.06, 0.014, 'dark', 'gun', { noSil: true });
  }
  const hc = hueOf(o.ink);
  const pal = {
    metal: METAL,
    dark: DARK,
    paint: hc ? mix(METAL, hc, 0.62) : [0.26, 0.28, 0.25],
    furn: hc ? mix(hc, [1, 1, 1], 0.12) : TAN,
  };
  // (the drawing over it: as long as it, its barrel's line on the barrel)
  const over = G.N.map((L) => L.map(([a, b]) => [a * len, b * len + (ya - t.mid * len)]));
  return finishGun({ G, t, S, X, toUV, over, len, pal, ctx, o, C, pivot: [0, yP, zP], muzzle: X(aM, ya), spinAt: multi ? X(0, ya) : null, item: 'mg', n: { barrels: t.barrels }, bend: t.wob * 0.02, bendR: [-aP, len - aP] });
}

// what a cannon drawn side on has: { elev, mortar, wheels, flare, rings, taper, mid, barH }
function cannonTraits(G) {
  const N = G.N;
  const F = N.map(featOf);
  // (its wheels: round, closed, big enough, low; its balls and its smoke: round and small, or out in
  // front)
  const wheels = F.filter((f) => {
    if (f.size <= 0.12 || f.b.cx > 0.75) return false;
    if (f.closed && f.round > 0.5 && f.b.w < f.b.h * 1.7 && f.b.h < f.b.w * 1.7) return true;
    if (f.corners > 1) return false;
    const c = circleOf(f.L);
    return !!c && c.err < 0.13 && c.arc > 0.6 && c.r > 0.06 && c.r < 0.32;
  });
  const barrelLines = N.filter((L, i) => !wheels.includes(F[i]) && !(F[i].closed && F[i].round > 0.5 && F[i].size < 0.12));
  const P = profileOf(barrelLines.length ? barrelLines : N, 0, 1, 20, 0.02);
  const front = P.filter((p, i) => p.ink && i >= 8);
  const mid = median(front.map((p) => p.mid));
  const barH = median(P.filter((p, i) => p.ink && i >= 9 && i <= 17).map((p) => p.h)) || 0.08;
  const lowWheels = wheels.filter((f) => f.b.cy < (Number.isFinite(mid) ? mid : 0.5) - barH * 0.15);
  const endH = Math.max(...P.slice(-2).map((p) => p.h), 0);
  const backH = median(P.filter((p, i) => p.ink && i >= 3 && i <= 7).map((p) => p.h)) || barH;
  const frontH = median(P.filter((p, i) => p.ink && i >= 13 && i <= 17).map((p) => p.h)) || barH;
  const rings = F.filter((f) => !f.closed && f.b.h > f.b.w * 1.3 && f.b.h < barH * 1.7 + 0.02 && f.b.cx > 0.25 && f.b.cx < 0.95 && Number.isFinite(mid) && Math.abs(f.b.cy - mid) < barH * 0.7).length;
  return { elev: G.elev, mortar: G.elev > 0.5, wheels: lowWheels.length, flare: endH > barH * 1.25 && endH > 0.05, rings: clamp(rings, 0, 3), taper: clamp(backH / Math.max(frontH, 1e-3), 1, 1.5), mid: Number.isFinite(mid) ? mid : G.h / 2, barH, wob: wobOf(N, 1) };
}

function cannonDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const G = gunFrame(lines, 'cannon');
  const t = cannonTraits(G);
  const n = o.n || {};
  const Lb = clamp(n.len || 1.2, 0.6, 2.4);
  const yP = C.roof - 0.03;
  const zP = -0.15;
  const X = (a, b, x = 0) => [x, yP + b, zP + a];
  const toUV = (a, b) => [zP + a, yP + b];
  const S = gunSheet(X, toUV);
  const hc = hueOf(o.ink);
  let muzzle;
  let over;
  let style;
  let bendR = null;
  if (t.mortar) {
    // (drawn pointing up: a mortar - its tube up on its base plate, its legs)
    style = 'mortar';
    const e = clamp(t.elev, 0.75, 1.25);
    const Lt = clamp(Lb * 0.62, 0.55, 1.25);
    const rt = clamp((n.r || 0.14) * 0.72, 0.08, 0.15);
    const A = [-0.14, 0.09];
    const dir = [Math.cos(e), Math.sin(e)];
    const at = (k) => [A[0] + dir[0] * Lt * k, A[1] + dir[1] * Lt * k];
    S.rod([0, 0], [0, 0.045], 0.34, 'dark', 'base', { dash: true, n: 20 });
    S.ball(A[0], A[1], rt * 1.15, 'dark');
    S.rod(A, at(1), rt, 'paint', 'gun', { r1: rt * 0.96, n: 16 });
    S.rod(at(0.97), at(1.03), rt * 1.17, 'dark', 'gun', { n: 16 });
    const leg = at(0.55);
    for (const s of [1, -1]) S.rod(leg, [leg[0] + 0.24, 0.02], 0.016, 'dark', 'gun', { x0: s * 0.02, x1: s * 0.26, noSil: s < 0, dash: s > 0 });
    S.box(leg[0] - 0.04, leg[0] + 0.05, leg[1] - 0.04, leg[1] + 0.05, 0.03, 'dark', 'gun', { x: rt + 0.05, noSil: true });
    muzzle = X(...at(1));
    const La = Lt * 1.12;
    const nrm = [-dir[1], dir[0]];
    over = G.N.map((L) => L.map(([a, b]) => {
      const u = a * La - Lt * 0.06;
      const v = (b - t.mid) * La;
      return [A[0] + dir[0] * u + nrm[0] * v, A[1] + dir[1] * u + nrm[1] * v];
    }));
  } else if (t.wheels) {
    // (a wheel drawn: a cannon on its carriage - two spoked wheels, its cheeks, its trail down behind)
    style = 'classic';
    const rbv = clamp((n.r || 0.14) * 0.85, 0.09, 0.2);
    const Rw = clamp(0.2 + rbv * 0.9, 0.26, 0.42);
    const yb = Rw + 0.07;
    const aT = 0.05;
    const aBr = aT - Lb * 0.34;
    const aMz = aT + Lb * 0.66;
    const tp = t.taper;
    S.tube(aBr, aBr + Lb * 0.36, yb, rbv * tp, rbv * tp * 0.97, 'iron', 'gun', { n: 18 });
    S.tube(aBr + Lb * 0.36, aMz - Lb * 0.08, yb, rbv * 0.98, rbv * 0.88, 'iron', 'gun', { n: 18 });
    S.tube(aMz - Lb * 0.08, aMz, yb, rbv * 0.95, rbv * (t.flare ? 1.32 : 1.1), 'iron', 'gun', { n: 18 });
    S.tube(aMz - 0.02, aMz + 0.004, yb, rbv * 0.62, rbv * 0.62, 'dark', 'gun', { noSil: true, n: 14 });
    S.ball(aBr - rbv * 0.42, yb, rbv * 0.42, 'iron');
    for (let i = 0; i < Math.max(1, t.rings); i++) S.ring(aBr + Lb * (0.06 + i * 0.27), yb, rbv * tp * 1.02, rbv * 0.13, 'iron', 'gun', { noSil: true });
    const cw = rbv * tp + 0.05;
    const cheek = [[aBr - 0.16, 0.02], [aT + 0.2, Rw * 0.5], [aT + 0.17, yb + 0.06], [aT - 0.14, yb + 0.07], [aBr + 0.02, 0.2], [aBr - 0.16, 0.12]];
    for (const s of [1, -1]) S.slab(cheek, 0.032, 'wood', 'gun', { x: s * cw, edge: 4, dash: s > 0 && false });
    S.rod([aT, Rw], [aT, Rw], 0.035, 'iron', 'gun', { x0: -(cw + 0.13), x1: cw + 0.13, noSil: true });
    for (const s of [1, -1]) {
      const x = s * (cw + 0.1);
      S.ring(aT, Rw, Rw - 0.03, 0.03, 'iron', 'gun', { ax: 'x', x });
      S.ring(aT, Rw, Rw - 0.075, 0.032, 'wood', 'gun', { ax: 'x', x, noSil: true });
      S.disc(aT, Rw, 0.06, 0.06, 'iron', 'gun', { x, n: 12 });
      for (let k = 0; k < 10; k++) {
        const an = (k / 10) * Math.PI * 2;
        S.rod([aT + Math.cos(an) * 0.05, Rw + Math.sin(an) * 0.05], [aT + Math.cos(an) * (Rw - 0.08), Rw + Math.sin(an) * (Rw - 0.08)], 0.016, 'wood', 'gun', { x0: x, x1: x, noSil: true, n: 5 });
      }
    }
    muzzle = X(aMz, yb);
    bendR = [aBr - rbv * 0.84, aMz];
    const La = aMz - aBr + rbv * 0.84;
    over = G.N.map((L) => L.map(([a, b]) => [aBr - rbv * 0.84 + a * La, yb + (b - t.mid) * La]));
  } else {
    // (no wheel: a gun in its turret - a low armoured turret, its mantlet, a long barrel)
    style = 'turret';
    const rbv = clamp((n.r || 0.14) * 0.6, 0.07, 0.13);
    S.rod([0, 0], [0, 0.06], 0.44, 'dark', 'base', { dash: true, n: 24 });
    S.slab([[-0.52, 0.06], [0.34, 0.06], [0.46, 0.15], [0.36, 0.31], [-0.42, 0.31], [-0.54, 0.2]], 0.36, 'paint', 'gun', { edge: 4.5, dash: true });
    S.box(0.38, 0.52, 0.1, 0.27, 0.15, 'paint');
    const yb = 0.185;
    const a1 = 0.5 + Lb * 0.95;
    S.tube(0.48, a1 - 0.15, yb, rbv, rbv * 0.9, 'paint', 'gun', { n: 16 });
    S.tube(0.5 + Lb * 0.45, 0.5 + Lb * 0.6, yb, rbv * 1.45, rbv * 1.45, 'paint', 'gun', { n: 16 });
    S.box(a1 - 0.15, a1, yb - rbv * 1.15, yb + rbv * 1.15, rbv * 1.35, 'dark');
    S.rod([-0.18, 0.31], [-0.18, 0.36], 0.12, 'paint', 'gun', { r1: 0.11, n: 14, dash: true });
    S.box(0.05, 0.13, 0.31, 0.37, 0.05, 'dark', 'gun', { noSil: true });
    muzzle = X(a1, yb);
    bendR = [0.48, a1];
    const La = a1 + 0.54;
    over = G.N.map((L) => L.map(([a, b]) => [-0.54 + a * La, yb + (b - t.mid) * La]));
  }
  const pal = {
    metal: METAL,
    dark: DARK,
    iron: hc && (hc[0] > 0.85 && hc[2] < 0.45) ? BRONZE : IRON,
    wood: hc && !(hc[0] > 0.85 && hc[2] < 0.45) ? mix(hc, [0.3, 0.2, 0.1], 0.25) : WOOD,
    paint: hc ? mix(OLIVE, hc, 0.7) : OLIVE,
  };
  return finishGun({ G, t: { ...t, style }, S, X, toUV, over, len: Lb, pal, ctx, o, C, pivot: [0, yP, zP], muzzle, spinAt: null, item: 'cannon', n: t.mortar ? { mortar: Math.round(clamp(t.elev, 0.75, 1.25) * 100) / 100 } : {}, bend: bendR ? t.wob * 0.025 : 0, bendR });
}

// a gun designed: its outline (the targets of the drawing's lines), the drawing tidied onto it, laid on
// the car; its shape for game/designbuild.js
function finishGun(D) {
  const { S, X, toUV, over, len } = D;
  const outl = outlineOf(S.sil, len / 90);
  const targets = outl.map((P) => ({ P, closed: true }));
  const td = tidy(over.map((L) => thin(L, 48)), targets, len * 0.12);
  return { S, td, X, toUV, D };
}

// ------------------------------------------------------------------ wings
// the drawing along its length (the span), its root at 0: { N (s 0..1 out from the root, c across, up its
// leading edge), Ls (m), bilateral, stem }
function wingFrame(lines, side) {
  const sp = spreadOf(lines);
  // (long - a feather: along its length; a blob of a wing: across the screen, as it was drawn)
  const phi = sp.k > 1.6 ? sp.a : 0;
  let T = turn(lines, phi);
  let B = boxOf(T);
  const Ls0 = Math.max(B.w, 1e-3);
  let N = T.map((L) => L.map(([x, y]) => [(x - B.x0) / Ls0, (y - B.y0) / Ls0]));
  let P = profileOf(N, 0, 1, 16, 0.02);
  const Hmax = Math.max(1e-3, ...P.map((p) => p.h));
  // (both wings drawn - a bird, a bat: its two halves alike, the middle no wider than them)
  let sym = 0;
  let cnt = 0;
  for (let i = 0; i < 8; i++) {
    const a = P[i];
    const b = P[15 - i];
    if (!a.ink || !b.ink) continue;
    sym += Math.abs(a.mid - b.mid) + Math.abs(a.h - b.h);
    cnt++;
  }
  const midH = Math.max(P[7].h, P[8].h);
  const bilateral = cnt >= 5 && sym / cnt < 0.06 + Hmax * 0.3 && B.w > B.h * 2.2 && midH <= Hmax * 0.6 + 0.02;
  if (bilateral) {
    // (one of them: the half the far side of its middle, its root at the middle)
    const cx = B.cx;
    T = T.map((L) => L.map(([x, y]) => [Math.abs(x - cx), y]));
    B = boxOf(T);
    const Ls = Math.max(B.w, 1e-3);
    N = T.map((L) => L.map(([x, y]) => [x / Ls, (y - B.y0) / Ls]));
    P = profileOf(N, 0, 1, 16, 0.02);
    return finishWingFrame(N, P, Ls, true, 0, phi);
  }
  // its root: the end a thin stem sticks out of (a feather's quill) - else the end nearer the car
  const run = (from) => {
    let k = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[from ? P.length - 1 - i : i];
      if (p.ink && p.h < Hmax * 0.12) k++;
      else if (p.ink || k) break;
    }
    return k;
  };
  const a = run(false);
  const b = run(true);
  let rootAt0;
  let stem = 0;
  if (Math.max(a, b) >= 2 && a !== b) {
    rootAt0 = a > b;
    stem = Math.max(a, b) / P.length;
  } else {
    // (in the drawing as drawn: the end of it nearer the car)
    const c = Math.cos(phi);
    rootAt0 = side > 0 ? c >= 0 : c < 0;
  }
  if (!rootAt0) {
    N = N.map((L) => L.map(([s, y]) => [1 - s, y]));
    P = profileOf(N, 0, 1, 16, 0.02);
  }
  return finishWingFrame(N, P, Ls0, false, stem, phi);
}

function finishWingFrame(N, P, Ls, bilateral, stem, phi) {
  // its leading edge up: the smoother edge (feathers' tips, a bat's scallops, are behind)
  const rough = (k) => {
    let r = 0;
    for (let i = 1; i < P.length - 1; i++) {
      if (!P[i - 1].ink || !P[i].ink || !P[i + 1].ink) continue;
      r += Math.abs(P[i + 1][k] - 2 * P[i][k] + P[i - 1][k]);
    }
    return r;
  };
  if (rough('hi') > rough('lo') * 1.25 + 0.01) {
    const top = Math.max(...N.flat().map((q) => q[1]));
    N = N.map((L) => L.map(([s, c]) => [s, top - c]));
    P = profileOf(N, 0, 1, 16, 0.02);
  }
  return { N, P, Ls, bilateral, stem, phi };
}

function wingTraits(W, lines) {
  const { P, N } = W;
  const from = Math.min(P.length - 4, Math.round(W.stem * P.length));
  const vane = P.slice(from).filter((p) => p.ink);
  const ch = vane.map((p) => p.h);
  const mean = Math.max(0.02, ch.reduce((a, b) => a + b, 0) / Math.max(1, ch.length));
  const q = (a, b) => median(P.slice(Math.round(a * P.length), Math.max(Math.round(a * P.length) + 1, Math.round(b * P.length))).filter((p) => p.ink).map((p) => p.h));
  const root = q(Math.max(W.stem, 0.06), Math.max(W.stem, 0.06) + 0.25) || mean;
  const tip = q(0.68, 0.9) || mean;
  // sweep: how far back its middle goes, out to its tip
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let k = 0;
  for (const p of vane) {
    sx += p.x;
    sy += p.mid;
    sxx += p.x * p.x;
    sxy += p.x * p.mid;
    k++;
  }
  const slope = k > 2 ? (k * sxy - sx * sy) / Math.max(1e-6, k * sxx - sx * sx) : 0;
  const last = vane.length ? vane[vane.length - 1].h : 0;
  const maxC = Math.max(1e-3, ...ch);
  // feathers: teeth along its trailing edge (feathers' tips, scallops), or rows of them along it inside,
  // or its strokes many and short (barbs), or a quill
  const Q = profileOf(N, 0, 1, 40, 0.02);
  const prom = Math.max(0.012, mean * 0.12);
  let scallops = 0;
  let lastAt = -9;
  for (let i = 1; i < Q.length - 1; i++) {
    if (!Q[i].ink || !Q[i - 1].ink || !Q[i + 1].ink) continue;
    if (Q[i].lo > Q[i - 1].lo || Q[i].lo > Q[i + 1].lo) continue;
    let up = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(Q.length - 1, i + 3); j++) if (Q[j].ink) up = Math.max(up, Q[j].lo - Q[i].lo);
    if (up > prom && i - lastAt > 2) {
      scallops++;
      lastAt = i;
    }
  }
  const F = N.map(featOf);
  const total = F.reduce((a, f) => a + f.len, 0);
  const barbs = F.filter((f) => f.size < 0.35 && f.len < total * 0.3).length;
  const outline = F.reduce((a, f) => (!a || f.len > a.len ? f : a), null);
  const rows = F.filter((f) => f !== outline && f.b.w > f.b.h * 1.5 && f.b.w > 0.2 && f.len < total * 0.45).length;
  const feather = scallops >= 3 || barbs >= 3 || rows >= 2 || W.stem > 0.05;
  return {
    aspect: 1 / mean,
    taper: tip / Math.max(root, 1e-3),
    sweep: -slope,
    round: last < maxC * 0.5,
    feather,
    feathers: clamp(scallops >= 3 ? scallops + 2 : barbs >= 3 ? barbs : 7, 5, 9),
    dih: W.bilateral ? clamp(Math.abs(Math.atan2(Math.sin(runOf(lines)), Math.cos(runOf(lines)))), 0, 0.22) : 0,
    wob: wobOf(N, 1),
    meanN: mean,
  };
}

function wingDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const W = wingFrame(lines, o.side || 1);
  const t = wingTraits(W, lines);
  const span = clamp(W.Ls * (1 - W.stem * 0.6) * 0.8, 0.7, 3);
  const aspect = clamp(t.aspect, 2.4, 5.2);
  const cbar = clamp(span / aspect, 0.32, 1.25);
  const taper = clamp(t.taper, t.feather ? 0.55 : 0.4, 0.95);
  const Cr = (2 * cbar) / (1 + taper);
  const Ct = Cr * taper;
  const sweep = clamp(t.sweep, -0.12, 0.5) * span * 0.55;
  const round = t.round || t.feather;
  const mid = (s) => -sweep * (s / span);
  const chord = (s) => {
    const k = s / span;
    let c = lerp(Cr, Ct, k);
    if (round && k > 0.7) c *= 0.12 + 0.88 * Math.sqrt(Math.max(0, 1 - ((k - 0.7) / 0.3) ** 2));
    return c;
  };
  // in the car's frame: its root at the door, out of its side (x to its left), on the plane y
  const xr = C.D.hw - 0.08;
  const zc = -0.1;
  const yc = C.mid;
  const toUV = (s, c) => [zc + c, -(xr + s)];
  const X = (s, c, up = 0) => [xr + s, yc + up, zc + c];
  const prims = [];
  const sil = [];
  const dash = [];
  const edge = (f) => {
    const out = [];
    for (let i = 0; i <= 16; i++) {
      const s = (i / 16) * span;
      out.push([s, mid(s) + f(s)]);
    }
    return out;
  };
  const le = edge((s) => chord(s) / 2);
  const te = edge((s) => -chord(s) / 2);
  const plan = le.concat(te.slice().reverse());
  const slab = (ol, W2, k, o2 = {}) => {
    prims.push({ t: 'slab', ax: 'y', c: yc + (o2.up || 0), ol: ol.map(([s, c]) => r2(toUV(s, c))), W: W2, k, g: 'gun', edge: o2.edge || 2.4 });
    if (!o2.noSil) sil.push(ol);
    if (o2.dash) dash.push(ol);
  };
  const thick = clamp(Cr * 0.1, 0.04, 0.085);
  if (t.feather) {
    // (feathers: the coverts over its front, the long feathers fanned out behind and out at the tip)
    const back = (s) => mid(s) - chord(s) * 0.08;
    const cov = [];
    for (let i = 0; i <= 16; i++) {
      const s = (i / 16) * span * 0.86;
      cov.push([s, back(s) - 0.035 * Math.abs(Math.sin((i / 16) * Math.PI * 5))]);
    }
    slab(le.filter((q) => q[0] <= span * 0.86).concat(cov.reverse()), thick, 'fA', { edge: 2.2 });
    const nF = t.feathers;
    for (let i = 0; i < nF; i++) {
      const k = nF > 1 ? i / (nF - 1) : 0.5;
      const sb = lerp(0.1, 0.8, k) * span;
      const cb = mid(sb) - chord(sb) * 0.04;
      const ang = lerp(-1.45, -0.32, k ** 1.3);
      const l = Math.min(lerp(chord(sb) * 0.66, span * 0.42, k ** 1.6), span * 1.1 - sb);
      const w = clamp(lerp(0.17, 0.13, k) * Cr, 0.06, 0.2);
      const d = [Math.cos(ang), Math.sin(ang)];
      const nrm = [-d[1], d[0]];
      const leaf = [];
      const NS = 8;
      for (let j = 0; j <= NS; j++) {
        const u = (j / NS) * l;
        const hw = (w / 2) * Math.min(1, Math.sqrt(u / (0.15 * l + 1e-6))) * (u > 0.72 * l ? Math.sqrt(Math.max(0, 1 - ((u - 0.72 * l) / (0.28 * l)) ** 2)) : 1);
        leaf.push([sb + d[0] * u + nrm[0] * hw, cb + d[1] * u + nrm[1] * hw]);
      }
      for (let j = NS; j >= 0; j--) {
        const u = (j / NS) * l;
        const hw = (w / 2) * Math.min(1, Math.sqrt(u / (0.15 * l + 1e-6))) * (u > 0.72 * l ? Math.sqrt(Math.max(0, 1 - ((u - 0.72 * l) / (0.28 * l)) ** 2)) : 1);
        leaf.push([sb + d[0] * u - nrm[0] * hw, cb + d[1] * u - nrm[1] * hw]);
      }
      slab(leaf, 0.022, i % 2 ? 'fB' : 'fA', { up: -0.006 - (nF - i) * 0.003, edge: 2 });
    }
  } else {
    // (a wing as aeroplanes have: its panel, an aileron at its trailing edge, its tip in the drawing's
    // colour, a fairing at its root)
    slab(plan, thick, 'body');
    const ail = [];
    for (let i = 0; i <= 8; i++) {
      const s = lerp(0.5, 0.88, i / 8) * span;
      ail.push([s, mid(s) - chord(s) / 2 + 0.004]);
    }
    for (let i = 8; i >= 0; i--) {
      const s = lerp(0.5, 0.88, i / 8) * span;
      ail.push([s, mid(s) - chord(s) * 0.26]);
    }
    slab(ail, thick * 0.7, 'trim', { up: 0.004, noSil: true, dash: true });
    const tipT = plan.filter((q) => q[0] >= span * 0.9);
    if (tipT.length >= 3) slab(tipT, thick + 0.012, 'accent', { noSil: true });
    const fair = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      fair.push([0.04 + Math.cos(a) * 0.1, mid(0) + Math.sin(a) * Cr * 0.46]);
    }
    slab(fair, thick + 0.03, 'body', { dash: true, edge: 2 });
  }
  const outl = outlineOf(sil, span / 80);
  const targets = outl.map((P) => ({ P, closed: true }));
  // (the drawing over it: as long as it out from its root, its middle on its middle)
  const kc = clamp(cbar / Math.max(t.meanN * W.Ls, 0.05), 0.6, 3);
  const midN = (s) => {
    const p = W.P[Math.min(W.P.length - 1, Math.max(0, Math.floor(s * W.P.length)))];
    return p && p.ink ? p.mid : 0;
  };
  const over = W.N.map((L) => L.map(([s, c]) => {
    const sd = s * span;
    return [sd, mid(sd) + (c - midN(s)) * W.Ls * kc];
  }));
  const td = tidy(over.map((L) => thin(L, 48)), targets, Math.max(span, Cr) * 0.14);
  const hc = hueOf(o.ink);
  const pal = {
    fA: hc ? mix(hc, [1, 1, 1], 0.55) : CREAM,
    fB: hc ? mix(hc, [1, 1, 1], 0.3) : [0.86, 0.85, 0.82],
    trim: hc ? mix(hc, [0, 0, 0], 0.25) : [0.55, 0.56, 0.6],
    accent: hc || [0.86, 0.16, 0.2],
  };
  const pl = placeOf('wing', lines, ctx, { side: o.side });
  const T3 = td.lines.map((L) => L.map(([s, c]) => r3(X(s, c, 0.01))));
  return {
    shape: { design: 1, kind: 'wing', ax: 'y', c: yc, pivot: r3([xr, yc, zc]), role: t.feather ? 'dwing' : 'drawn', mirror: true, fill: 'x', prims, ink: td.lines.filter((L, i) => !td.fade[i]).map((L) => thin(L, 40).map(([s, c]) => r2(toUV(s, c)))), pal, dih: Math.round(t.dih * 100) / 100, bend: Math.round(t.wob * 0.03 * 1000) / 1000, bendR: [0, Math.round(span * 1000) / 1000] },
    at: r3([xr, yc, zc]),
    // (what the camera leans in on as it takes shape - game/fuse.js sketchCam: how far, - away)
    focus: { at: r3([0, yc, zc]), k: 0.22 },
    P3: pl.P3,
    T3,
    fade: td.fade,
    dash: dash.map((P) => P.concat([P[0]]).map(([s, c]) => r3(X(s, c, 0.02)))),
    mirror: true,
    flip: 1,
    side: o.side || 1,
    n: { span: Math.round(span * 100) / 100, chord: Math.round(cbar * 100) / 100, feather: t.feather ? 1 : 0 },
    traits: { kind: 'wing', style: t.feather ? 'feather' : 'plane', bilateral: W.bilateral, stem: Math.round(W.stem * 100) / 100, aspect: Math.round(aspect * 10) / 10, taper: Math.round(taper * 100) / 100, sweep: Math.round(t.sweep * 100) / 100, round, feathers: t.feather ? t.feathers : 0, dih: t.dih },
  };
}

// ------------------------------------------------------------------ the balloon
// its classic shape: how wide (0..1 of its widest) at each height (0 at its mouth .. 1 its top)
function balloonT(y) {
  const r0 = 0.2;
  const ym = 0.6;
  if (y <= ym) return r0 + (1 - r0) * Math.sin((Math.PI / 2) * (y / ym)) ** 0.85;
  const k = (y - ym) / (1 - ym);
  return Math.sqrt(Math.max(0, 1 - k * k));
}

function balloonDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const n = o.n || {};
  const B = boxOf(lines);
  const F = lines.map(featOf);
  // its envelope: the lines up at its top, the biggest of them first (one drawn in two halves: both)
  let env = null;
  for (const f of F) if (f.b.y1 >= B.y1 - B.h * 0.18 && (!env || f.b.w * f.b.h > env.b.w * env.b.h)) env = f;
  const envs = env ? F.filter((f) => f === env || (f.b.y1 >= B.y1 - B.h * 0.18 && f.b.h > env.b.h * 0.5 && f.size > env.size * 0.4)) : [];
  const eL = envs.length ? envs.flatMap((f) => dense(f.L, Math.max(B.w, B.h) / 120)) : lines.flat();
  const eb = boxOf([eL]);
  // its width up it, its widest, and its mouth - where below its widest it is narrower than 38% of it
  const NB = 16;
  const wid = [];
  for (let i = 0; i < NB; i++) {
    const y0 = eb.y0 + (i / NB) * eb.h;
    const y1 = eb.y0 + ((i + 1) / NB) * eb.h;
    let a = Infinity;
    let b = -Infinity;
    for (const [x, y] of eL) {
      if (y < y0 || y > y1) continue;
      a = Math.min(a, x);
      b = Math.max(b, x);
    }
    wid.push(b > a ? { w: b - a, c: (a + b) / 2 } : null);
  }
  let im = 0;
  wid.forEach((w, i) => {
    if (w && (!wid[im] || w.w > wid[im].w)) im = i;
  });
  const W0 = wid[im] ? wid[im].w : eb.w;
  const ex = wid[im] ? wid[im].c : eb.cx;
  let i0 = 0;
  for (let i = im; i >= 0; i--) {
    if (wid[i] && wid[i].w < W0 * 0.38) {
      i0 = i;
      break;
    }
  }
  const mouthY = eb.y0 + (i0 / NB) * eb.h;
  const He0 = Math.max(1e-3, eb.y1 - mouthY);
  const prof = [];
  for (let i = i0; i < NB; i++) {
    const w = wid[i];
    prof.push({ y: ((i + 0.5) / NB) * eb.h + eb.y0 - mouthY, r: w ? w.w / W0 : 0 });
  }
  const rD = (y) => {
    const yy = y * He0;
    let best = null;
    for (const p of prof) if (!best || Math.abs(p.y - yy) < Math.abs(best.y - yy)) best = p;
    return best ? best.r : balloonT(y);
  };
  // a basket under it; lines between (its ropes); lines on it up and down (its gores), across (bands)
  let basket = null;
  let ropes = 0;
  let gores = 0;
  let bands = 0;
  for (const f of F) {
    if (envs.includes(f)) continue;
    const b = f.b;
    if (b.y1 <= mouthY + He0 * 0.12 && b.w < W0 * 0.65 && b.w > W0 * 0.08) {
      if ((f.closed || f.L.length >= 4) && b.h < W0 * 0.6 && (!basket || b.y0 < basket.b.y0)) basket = f;
      else if (b.h > b.w * 1.4) ropes++;
    } else if (b.cy > mouthY && b.cy < eb.y1 && b.cx > ex - W0 / 2 && b.cx < ex + W0 / 2) {
      if (b.h > b.w * 1.4) gores++;
      else if (b.w > b.h * 1.4) bands++;
    }
  }
  const t = { aspect: He0 / W0, basket: !!basket, bw: basket ? basket.b.w / W0 : 0, ropes, gores, bands, wob: wobOf(lines, Math.max(B.w, B.h)) };
  // ---- the balloon itself
  const D = clamp(n.d || 1.6, 0.8, 6);
  const He = D * clamp(t.aspect, 0.95, 1.35);
  const bw = clamp(D * (t.basket ? t.bw * 0.9 : 0.24), D * 0.16, D * 0.33);
  const bh = bw * 0.72;
  const gap = clamp(D * 0.2, 0.25, 0.8);
  const base = C.roof + 0.35;
  const b0 = bh + gap;
  const NP = 18;
  const R = [];
  for (let i = 0; i <= NP; i++) {
    const y = i / NP;
    R.push(0.5 * balloonT(y) + 0.5 * rD(y));
  }
  // (evened, its mouth no narrower than 14% nor wider than 30%, closed at its top)
  const Rs = R.map((r, i) => (i === 0 || i === NP ? r : (R[i - 1] + 2 * r + R[i + 1]) / 4));
  Rs[0] = clamp(Rs[0], 0.14, 0.3);
  Rs[NP] = 0;
  Rs[NP - 1] = Math.min(Rs[NP - 1], 0.45);
  const rMax = Math.max(...Rs);
  const prof3 = Rs.map((r, i) => [Math.round((r / rMax) * (D / 2) * 1000) / 1000, Math.round((i / NP) * He * 1000) / 1000]);
  const rAt = (yy) => {
    const k = clamp(yy / He, 0, 1) * NP;
    const i = Math.min(NP - 1, Math.floor(k));
    return lerp(prof3[i][0], prof3[i + 1][0], k - i);
  };
  const N = t.gores ? clamp(8 + 2 * t.gores, 8, 16) : 12;
  const rT = prof3[0][0];
  const yRing = base + b0 - gap * 0.28;
  const prims = [
    { t: 'lathe', c: r3([0, base + b0, 0]), prof: prof3, gores: N, ks: ['fabA', 'fabB'], bands: t.bands && !t.gores ? [[0.42, 0.56], [0.84, 1]] : null, g: 'gun' },
    { t: 'cyl', p0: r3([0, yRing, 0]), p1: r3([0, base + b0 + 0.01, 0]), r0: rT * 0.86, r1: rT, k: 'fabB', g: 'gun', n: N * 2 },
    { t: 'tor', c: r3([0, yRing, 0]), R: rT * 0.86, r: 0.016, ax: 'y', k: 'dark', g: 'gun' },
    { t: 'cyl', p0: r3([0, base + bh + gap * 0.3, 0]), p1: r3([0, base + bh + gap * 0.5, 0]), r0: bw * 0.11, r1: bw * 0.09, k: 'metal', g: 'gun', n: 10 },
    { t: 'box', p0: r3([-bw / 2, base, -bw / 2]), p1: r3([bw / 2, base + bh, bw / 2]), k: 'wicker', g: 'gun' },
    { t: 'box', p0: r3([-bw / 2 - 0.02, base + bh - 0.035, -bw / 2 - 0.02]), p1: r3([bw / 2 + 0.02, base + bh + 0.01, bw / 2 + 0.02]), k: 'rim', g: 'gun' },
  ];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    prims.push({ t: 'cyl', p0: r3([sx * bw * 0.44, base + bh, sz * bw * 0.44]), p1: r3([sx * rT * 0.6, yRing, sz * rT * 0.6]), r0: 0.009, r1: 0.009, k: 'rope', g: 'gun', n: 5 });
  }
  // ---- its own lines seen from the front (x to the screen's right is the car's -x): the envelope, the
  // basket, the ropes, its seams and bands - what the drawing's lines go onto
  const U = (x, y) => [x, y];
  const envP = [];
  for (let i = 0; i <= NP; i++) envP.push(U(prof3[i][0], b0 + prof3[i][1]));
  for (let i = NP - 1; i >= 0; i--) envP.push(U(-prof3[i][0], b0 + prof3[i][1]));
  const basketP = rect(-bw / 2, bw / 2, 0, bh);
  const targets = [{ P: envP, closed: true }, { P: basketP, closed: true }];
  for (const s of [1, -1]) targets.push({ P: [U(s * bw * 0.44, bh), U(s * rT * 0.6, yRing - base)], closed: false });
  for (let k = 1; k < N; k++) {
    const ph = (k / N) * Math.PI * 2;
    if (Math.cos(ph) <= 0.15) continue;
    const seam = [];
    for (let i = 0; i <= NP; i++) seam.push(U(prof3[i][0] * Math.sin(ph), b0 + prof3[i][1]));
    targets.push({ P: seam, closed: false });
  }
  if (t.bands && !t.gores) {
    for (const yb of [0.42, 0.56, 0.84]) {
      const yy = yb * He;
      const r = rAt(yy);
      targets.push({ P: [U(-r, b0 + yy), U(r, b0 + yy)], closed: false });
    }
  }
  // (the drawing over it: its envelope on the envelope, what is under it under it)
  const k = D / W0;
  const yUnder = Math.min(B.y0, mouthY - 1e-3);
  const over = lines.map((L) => L.map(([x, y]) => [(x - ex) * k, y >= mouthY ? b0 + ((y - mouthY) / He0) * He : ((y - yUnder) / Math.max(1e-3, mouthY - yUnder)) * b0]));
  // (its envelope's outline, target 0, inks only the morph: round all over, a line round its middle
  // would cross its face from anywhere but straight in front - its edges are drawn as it is seen)
  const td = tidy(over.map((L) => thin(L, 48)), targets, D * 0.1);
  // (in the car's frame: x to its left - the screen's right is its -x - over its roof)
  const X = (x, y, z = 0) => [-x, base + y, z];
  const hc = hueOf(o.ink);
  const pal = {
    fabA: hc || RED,
    fabB: hc ? (lum(hc) > 0.66 ? mix(hc, [0.25, 0.3, 0.75], 0.55) : CREAM) : YELLOW,
    metal: METAL,
    dark: DARK,
    wicker: WICKER,
    rim: mix(WICKER, [0.2, 0.12, 0.05], 0.45),
    rope: ROPE,
  };
  const pl = placeOf('balloon', lines, ctx, { side: o.side });
  const roof = C.roof;
  const ropesTo = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => ({ a: r3([sx * bw * 0.44, base + 0.01, sz * bw * 0.44]), b: r3([sx * C.D.hw * 0.62, roof, sz * Math.min(C.D.hl * 0.3, 0.7)]) }));
  return {
    shape: { design: 1, kind: 'balloon', ax: 'z', c: 0, pivot: r3([0, base, 0]), role: 'dballoon', mirror: false, fill: 'z', prims, ink: td.lines.filter((L, i) => !td.fade[i] && td.on[i] !== 0).map((L) => thin(L, 40).map(([x, y]) => r2([x, base + y]))), pal, ropes: ropesTo, rof: r3([0, base + b0, 0]) },
    at: r3([0, base, 0]),
    focus: { at: r3([0, base + b0 + He * 0.4, 0]), k: -0.15 },
    P3: pl.P3,
    T3: td.lines.map((L) => L.map(([x, y]) => r3(X(x, y)))),
    fade: td.fade,
    dash: [
      ...(t.basket ? [] : [basketP.concat([basketP[0]]).map(([x, y]) => r3(X(x, y)))]),
      ...ropesTo.slice(0, 2).map((rp) => [rp.a, rp.b]),
    ],
    mirror: false,
    flip: 1,
    side: o.side || 1,
    n: {},
    traits: { kind: 'balloon', aspect: Math.round(t.aspect * 100) / 100, basket: t.basket, ropes: t.ropes, gores: N, bands: !!(t.bands && !t.gores), wob: t.wob },
  };
}

// ------------------------------------------------------------------ the design
// (ROADMAP 11.27) the thing (id) designed from its drawing (M: lines in metres, x right, y up - by the
// car on the screen) on a car (ctx: game/fuse.js drawCtx). o: { side, flip, ink (game/freeform.js
// INKS'), n (its numbers: game/partpen.js nOf) }. null: not one of those designed, or a drawing that
// cannot be (game/itemlook.js's, as drawn, then)
export function designOf(id, M, ctx, o = {}) {
  if (!DESIGNED.has(id)) return null;
  const lines = (M || []).filter((L) => L && L.length >= 2);
  if (!lines.length) return null;
  try {
    if (id === 'wing') return wingDesign(lines, ctx, o);
    if (id === 'balloon') return balloonDesign(lines, ctx, o);
    const gun = id === 'mg' ? mgDesign(lines, ctx, o) : cannonDesign(lines, ctx, o);
    return gunOut(gun, lines, ctx, o);
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('design', id, err);
    return null;
  }
}

function gunOut(gun, lines, ctx, o) {
  const { S, td, X, toUV, D } = gun;
  const pl = placeOf(D.item, lines, ctx, { flip: D.G.flip, side: o.side });
  const pv = D.pivot;
  return {
    shape: {
      design: 1,
      kind: D.item,
      ax: 'x',
      c: 0,
      pivot: r3(pv),
      role: 'barrel',
      mirror: false,
      fill: 'x',
      prims: S.prims,
      ink: td.lines.filter((L, i) => !td.fade[i]).map((L) => thin(L, 40).map(([a, b]) => r2(toUV(a, b)))),
      pal: D.pal,
      muzzle: r3(D.muzzle),
      ...(D.spinAt ? { spinAt: r3(D.spinAt) } : {}),
      bend: Math.round(D.bend * 1000) / 1000,
      ...(D.bendR ? { bendR: D.bendR.map((x) => Math.round(x * 1000) / 1000) } : {}),
    },
    at: r3(pv),
    focus: { at: r3(pv), k: D.item === 'mg' ? 0.45 : 0.36 },
    P3: pl.P3,
    T3: td.lines.map((L) => L.map(([a, b]) => r3(X(a, b, 0)))),
    fade: td.fade,
    dash: S.dash.map((P) => P.concat([P[0]]).map(([a, b]) => r3(X(a, b, 0)))),
    mirror: false,
    flip: D.G.flip,
    side: 1,
    n: D.n,
    traits: { kind: D.item, ...Object.fromEntries(Object.entries(D.t).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v])) },
  };
}

// (ROADMAP 11.27) while it is drawn (lines of screen px): what kind of it it is so far - a cannon
// drawn pointing up is a mortar, a machine gun with three barrels a minigun, wings with feathers climb
// faster: { name, say } or null
export function variantOf(id, lines) {
  const L = (lines || []).filter((q) => q && q.length >= 2).map((q) => q.map(([x, y]) => [x, -y]));
  if (!L.length) return null;
  try {
    if (id === 'cannon') {
      const G = gunFrame(L, 'cannon');
      return G.elev > 0.5 ? { name: 'מרגמה', say: 'ירי בקשת' } : null;
    }
    if (id === 'mg') {
      const t = mgTraits(gunFrame(L));
      return t.barrels >= 3 ? { name: 'מיניגאן', say: `${t.barrels} קנים · מהיר פי 2` } : null;
    }
    if (id === 'wing') {
      const W = wingFrame(L, 1);
      return wingTraits(W, L).feather ? { name: 'כנפי נוצות', say: 'טיפוס מהיר' } : null;
    }
  } catch (err) {
    // (nothing to say yet)
  }
  return null;
}
