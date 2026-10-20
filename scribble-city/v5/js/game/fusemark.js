// (ROADMAP 11.20) A part drawn onto a thing: one stroke, on the car you drive, on the hero, on the
// gun in your hand, on a police car or a man in the street - and the thing has it. The stroke's
// shape says which part it is, where it is drawn on the thing says what that part does there, and
// its size and its details (a wheel's teeth, a spring's coils, a barrel's length) set its numbers.
//
// The ten marks, each one stroke, each drawn the way the part looks:
//   wheel    a circle, low on the thing          (teeth round it: it climbs; a square: it bumps)
//   wing     a long thin shape - or a line - out to the side
//   rotor    a straight line across above it
//   jet      a zigzag of flame out of its back  (out of its front: a flame-thrower)
//   spring   a coil of loops under it           (at its nose: a spring bumper)
//   barrel   a line out of it, the way it fires (a long box: a cannon)
//   blade    an arc, a crescent                 (at its nose: a ram; at its sides: knives)
//   armor    hatching back and forth on it
//   balloon  a circle above it
//   magnet   a U
// (ROADMAP 11.21) And five more, each drawn out of it:
//   star     a star - in one go, its lines crossing, or its outline
//   bolt     a bolt of lightning: a Z, two sharp turns
//   smoke    a spiral, round and round in one place
//   chute    an arch over it, bulging up
//   float    a long shape low along it
// A part stands out of the thing. A line drawn all on it - a stripe, a flame, a smile,
// a name, a star - is no part: it stays on it as ink, as drawn (game/fuse.js inkLine). But a U is a
// magnet wherever it is, and a circle low on it a wheel.
// This file only reads: strokes in screen px ([x, y], y down) and a frame of the thing they are
// drawn on (game/fuse.js makes it). Nothing here knows the city.

import { boxOf, pathLen, along, straightness, corners, crossings, isHeart } from './signshape.js';

export const PART_TYPES = ['wheel', 'wing', 'rotor', 'jet', 'spring', 'barrel', 'blade', 'armor', 'balloon', 'magnet', 'star', 'bolt', 'smoke', 'chute', 'float'];

const TAU = Math.PI * 2;

// a circle through the points (least squares, Kasa): { cx, cy, r, err (rms off it / r), cover (0-1
// of the way round it the points go) }
export function circleFit(Q) {
  const n = Q.length;
  let mx = 0;
  let my = 0;
  for (const [x, y] of Q) {
    mx += x;
    my += y;
  }
  mx /= n;
  my /= n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const [x, y] of Q) {
    const u = x - mx;
    const v = y - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return { cx: mx, cy: my, r: 0, err: 9, cover: 0 };
  const b1 = 0.5 * (suuu + suvv);
  const b2 = 0.5 * (svvv + svuu);
  const uc = (b1 * svv - b2 * suv) / det;
  const vc = (b2 * suu - b1 * suv) / det;
  const cx = mx + uc;
  const cy = my + vc;
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  let e = 0;
  const ang = [];
  for (const [x, y] of Q) {
    const d = Math.hypot(x - cx, y - cy);
    e += (d - r) * (d - r);
    ang.push(Math.atan2(y - cy, x - cx));
  }
  ang.sort((a, b) => a - b);
  let gap = ang[0] + TAU - ang[ang.length - 1];
  for (let i = 1; i < ang.length; i++) gap = Math.max(gap, ang[i] - ang[i - 1]);
  return { cx, cy, r, err: Math.sqrt(e / n) / Math.max(1e-6, r), cover: 1 - gap / TAU };
}

// how the line turns: { signed, abs } (radians)
function turning(Q) {
  let signed = 0;
  let abs = 0;
  for (let i = 1; i < Q.length - 1; i++) {
    let t = Math.atan2(Q[i + 1][1] - Q[i][1], Q[i + 1][0] - Q[i][0]) - Math.atan2(Q[i][1] - Q[i - 1][1], Q[i][0] - Q[i - 1][0]);
    while (t > Math.PI) t -= TAU;
    while (t < -Math.PI) t += TAU;
    signed += t;
    abs += Math.abs(t);
  }
  return { signed, abs };
}

// the line's long axis (its spread): { ux, uy (unit), long, thick (extents along and across) }
function axisOf(Q) {
  let mx = 0;
  let my = 0;
  for (const [x, y] of Q) {
    mx += x;
    my += y;
  }
  mx /= Q.length;
  my /= Q.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of Q) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }
  const a = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  let a0 = Infinity;
  let a1 = -Infinity;
  let b0 = Infinity;
  let b1 = -Infinity;
  for (const [x, y] of Q) {
    const s = (x - mx) * ux + (y - my) * uy;
    const t = -(x - mx) * uy + (y - my) * ux;
    a0 = Math.min(a0, s);
    a1 = Math.max(a1, s);
    b0 = Math.min(b0, t);
    b1 = Math.max(b1, t);
  }
  return { ux, uy, mx, my, long: a1 - a0, thick: b1 - b0 };
}

// teeth along a line: how many times it goes back across its long axis, each swing a real one (a
// zigzag's points, a flame's tongues, hatching's strokes)
function swings(Q, A) {
  const vs = Q.map(([x, y]) => -(x - A.mx) * A.uy + (y - A.my) * A.ux);
  return turns(vs, Math.max(4, A.thick * 0.28)).all;
}

// the turns of a run of values, each one by more than amp: { all (every turn back), peaks (the
// highs only) } - wrap: on round past the end (a closed line)
function turns(vs, amp, wrap = 0) {
  let all = 0;
  let peaks = 0;
  let dir = 0;
  let hi = vs[0];
  let lo = vs[0];
  for (let i = 1; i < vs.length + wrap; i++) {
    const v = vs[i % vs.length];
    if (dir === 0) {
      // (not yet going either way: its highest and lowest so far)
      if (v > hi) hi = v;
      if (v < lo) lo = v;
      if (hi - v > amp) {
        dir = -1;
        lo = v;
      } else if (v - lo > amp) {
        dir = 1;
        hi = v;
      }
    } else if (dir > 0) {
      if (v > hi) hi = v;
      else if (hi - v > amp) {
        all++;
        peaks++;
        dir = -1;
        lo = v;
      }
    } else if (v < lo) lo = v;
    else if (v - lo > amp) {
      all++;
      dir = 1;
      hi = v;
    }
  }
  return { all, peaks };
}

// a coil: loop after loop the same way, each a little on along it - { coils }
function coilsOf(Q) {
  let acc = 0;
  let loops = 0;
  const mids = [];
  let sx = 0;
  let sy = 0;
  let m = 0;
  for (let i = 1; i < Q.length - 1; i++) {
    let t = Math.atan2(Q[i + 1][1] - Q[i][1], Q[i + 1][0] - Q[i][0]) - Math.atan2(Q[i][1] - Q[i - 1][1], Q[i][0] - Q[i - 1][0]);
    while (t > Math.PI) t -= TAU;
    while (t < -Math.PI) t += TAU;
    acc += t;
    sx += Q[i][0];
    sy += Q[i][1];
    m++;
    if (Math.abs(acc) >= TAU * 0.92) {
      loops++;
      mids.push([sx / m, sy / m]);
      acc = 0;
      sx = 0;
      sy = 0;
      m = 0;
    }
  }
  if (loops < 2) return loops >= 1 && Math.abs(acc) > Math.PI ? 1.5 : loops;
  // (on along it: the loops' middles move one way - not a ball of string in one place)
  const a = mids[0];
  const b = mids[mids.length - 1];
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const B = boxOf(Q);
  return span > Math.max(B.w, B.h) * 0.22 ? loops + Math.min(0.9, Math.abs(acc) / TAU) : 0;
}

// bumps round a closed line (a wheel's teeth): the distance from its middle going up and down
function bumpsOf(Q, fit) {
  const d = Q.map(([x, y]) => Math.hypot(x - fit.cx, y - fit.cy));
  return turns(d, fit.r * 0.1, Math.round(Q.length * 0.15)).peaks;
}

// everything about the stroke's shape, by itself (screen px)
export function shapeOf(P0) {
  const B = boxOf(P0);
  const size = Math.max(B.w, B.h, 1);
  const L = pathLen(P0);
  const Q = along(P0, 72);
  const gap = Math.hypot(P0[P0.length - 1][0] - P0[0][0], P0[P0.length - 1][1] - P0[0][1]);
  // (its turning on fewer points: a shaky hand's wobbles are not turns)
  const T = turning(along(P0, 28));
  // closed: its end back at its start - or, gone once round and on a little past it, by where it
  // began
  let back = Infinity;
  const [ex, ey] = P0[P0.length - 1];
  for (let i = 0; i < Q.length * 0.35; i++) back = Math.min(back, Math.hypot(Q[i][0] - ex, Q[i][1] - ey));
  // (not a spiral: round and round, but ever wider - it never comes back to where it began)
  const fit = circleFit(Q);
  const closed = L > size * 1.8 && (gap < Math.max(10, size * 0.26) || (Math.abs(T.signed) > 5 && back < Math.max(10, size * 0.3) && fit.err < 0.22));
  const A = axisOf(Q);
  const nc = corners(Q, closed);
  const teeth = swings(Q, A);
  // (and back and forth along its length: hatching across its long way - strokes up and down a
  // tall patch)
  const teethL = turns(Q.map(([x, y]) => (x - A.mx) * A.ux + (y - A.my) * A.uy), Math.max(4, A.long * 0.25)).all;
  const coils = closed ? 0 : coilsOf(Q);
  const nx = crossings(P0, 96);
  const straight = straightness(P0);
  const aspect = A.long / Math.max(1, A.thick);
  // (a closed round one: its outline's bumps, for a wheel's teeth)
  const bumps = closed && fit.cover > 0.7 ? bumpsOf(along(P0, 96), fit) : 0;
  // (an open curve: how deep, across its ends - a U is deep, a crescent shallow)
  let depth = 0;
  if (!closed && gap > 1) {
    const ex = (P0[P0.length - 1][0] - P0[0][0]) / gap;
    const ey = (P0[P0.length - 1][1] - P0[0][1]) / gap;
    for (const [x, y] of Q) depth = Math.max(depth, Math.abs(-(x - P0[0][0]) * ey + (y - P0[0][1]) * ex));
  }
  const n3 = Math.round(Q.length * 0.3);
  const armA = straightness(Q.slice(0, n3));
  const armB = straightness(Q.slice(Q.length - n3));
  // (a closed one: how much of its box it fills - a square nearly all, a circle 0.79)
  let fill = 0;
  if (closed) {
    let a = 0;
    for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) a += Q[j][0] * Q[i][1] - Q[i][0] * Q[j][1];
    fill = Math.abs(a / 2) / Math.max(1, B.w * B.h);
  }
  return { B, size, L, Q, gap, closed, A, fit, T, nc, teeth, teethL, coils, nx, straight, aspect, bumps, depth, armA, armB, fill, P: P0 };
}

// ------------------------------------------------------------------ on a thing
// F: the thing's frame on screen (game/fuse.js frameOf):
//   F.kind:  'veh' (yours) | 'car' | 'hero' | 'person' | 'weapon' | 'prop'
//   F.dims:  { hl, hw, h } - half its length, half its width, its height (m)
//   F.local(sx, sy) -> { p: [x, y, z] in its own frame (x to its left, y up, z forward), hit }
//   F.perPx: metres a pixel, where it is
//   F.up:    [x, y] its up on screen (unit), F.fwd its forward on screen (px a metre)
//   F.box:   its box on screen { x0, y0, x1, y1, cx, cy, w, h }
// Returns { type, v (what kind of it, where), at [x, y, z], dir [x, y, z] | null, n {numbers},
// alts [types], why } or null (not a part on this)
export function readMark(P, F) {
  const S = shapeOf(P);
  if (S.L < 14 || S.size < 10) return null;
  const D = F.dims;
  // the stroke in the thing's frame: every few points, where it falls on it (or beside it, level
  // with its middle)
  const n = 24;
  const Q = along(P, n);
  const loc = Q.map(([x, y]) => F.local(x, y));
  let inside = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const o of loc) {
    if (o.hit) inside++;
    cx += o.p[0];
    cy += o.p[1];
    cz += o.p[2];
  }
  inside /= n;
  cx /= n;
  cy /= n;
  cz /= n;
  const c = [cx, cy, cz];
  const first = loc[0];
  const last = loc[n - 1];
  const m = F.perPx;
  const sizeM = S.size * m;
  // where it is on the thing
  const above = cy > D.h * 0.92 && inside < 0.35;
  const lateral = Math.abs(cx) > D.hw * 1.05;
  const front = cz > D.hl * 0.6;
  const back = cz < -D.hl * 0.6;
  const person = F.kind === 'hero' || F.kind === 'person';
  const R = (type, v, at, dir, nn, alts, extra) => ({ type, v, at, dir: dir || null, n: nn || {}, alts: alts || [], c, inside, sizeM, ...(extra || {}) });

  // -------- hatching on it (or scribbled over it): armour
  // (a patch of it, not a long tongue: a long zigzag out of it is a flame - a jet, below)
  if (inside >= 0.5 && ((S.teeth >= 3 && S.aspect < 2.2) || S.teethL >= 3 || S.nx >= 5) && !S.closed && Math.abs(S.T.signed) < 6 && F.kind !== 'prop') {
    const cover = Math.min(1, (S.B.w * S.B.h) / Math.max(1, F.box.w * F.box.h));
    return R('armor', 'plate', [0, D.h * 0.5, 0], null, { cover, teeth: S.teeth }, ['jet', 'spring']);
  }
  // -------- drawn all on it: ink on it, not a part (ROADMAP 11.21)
  if (!person && F.kind !== 'weapon' && F.kind !== 'prop' && onItAll(F, Q, loc) && !isU(S) && !(S.closed && roundish(S) && cy < D.h * 0.55 && !isHeart(S.P))) return null;
  // -------- a coil: a spring (at the nose of a car: a bumper)
  if (S.coils >= 1.5 && S.nx >= 1 && !S.closed) {
    const coils = Math.max(2, Math.round(S.coils));
    const len = S.A.long * m;
    if (F.kind === 'weapon') return R('spring', 'bounce', [0, 0, 0], [0, 0, 1], { coils, len }, ['jet']);
    if (!person && front && cy > D.h * 0.15) return R('spring', 'bumper', [0, D.h * 0.32, D.hl], [0, 0, 1], { coils, len }, ['jet']);
    return R('spring', 'under', [0, 0, 0], [0, 1, 0], { coils, len }, ['jet', 'armor']);
  }
  // -------- a spiral, round and round in one place (not a coil going along): smoke at its back
  if (!S.closed && Math.abs(S.T.signed) > 8.5 && S.coils < 1.5 && S.nx <= 1 && F.kind !== 'weapon' && !person) {
    return R('smoke', 'back', [0, D.h * 0.35, -D.hl], [0, 0, -1], { turns: Math.abs(S.T.signed) / TAU }, ['spring']);
  }
  // -------- closed shapes
  if (S.closed) {
    const fit = S.fit;
    // a star: star power (on what is yours)
    if (isStar(S) && F.kind !== 'weapon') return R('star', 'top', [0, D.h, clampZ(cz, D)], [0, 1, 0], { size: S.size * m }, ['balloon']);
    const square = S.nc >= 3 && S.nc <= 5 && S.fill > 0.72 && S.aspect < 1.45;
    const round = fit.err < 0.24 && fit.cover > 0.72 && S.aspect < 1.9;
    if (round || square) {
      const r = fit.r * m;
      // (over it: a balloon; on it, low: a wheel)
      if (above || (cy > D.h * 0.66 && !person) || (person && cy > D.h * 0.96)) return R('balloon', 'top', [0, D.h, clampZ(cz, D)], [0, 1, 0], { d: r * 2 }, ['wheel']);
      if (F.kind === 'weapon') return null;
      let v = 'round';
      if (square) v = 'square';
      else if (S.bumps >= 5) v = 'teeth';
      const base = F.wheelR || 0.34;
      if (v !== 'square' && r >= base * 1.45 && !person) v = v === 'teeth' ? 'bigteeth' : 'big';
      else if (v === 'round' && r <= base * 0.45 && !person) v = 'small';
      return R('wheel', v, [0, 0, 0], null, { r, bumps: S.bumps }, ['balloon']);
    }
    // a long one low along it, by its wheels: floats (ROADMAP 11.21)
    if (S.aspect >= 2.2 && cy < D.h * 0.32 && inside < 0.5 && S.B.cy > F.box.y0 + F.box.h * 0.55 && !person && F.kind !== 'weapon' && alongIt(S, F, D)) return R('float', 'pontoon', [0, 0, 0], null, { len: S.A.long * m }, ['wing', 'barrel']);
    // a long thin one: a wing out to the side; a cannon out of its front, back or top
    if (S.aspect >= 2.4) {
      const dir = axisDir(loc, D);
      if (lateral || Math.abs(dir.d[0]) > 0.62) return R('wing', wingKind(c, D), [Math.sign(cx || 1) * D.hw, wingY(c, D, person), clampZ(cz, D)], dir.d, { span: S.A.long * m, chord: S.A.thick * m }, ['barrel', 'blade']);
      if (F.kind === 'weapon') return R('barrel', 'extra', dir.at, dir.d, { len: S.A.long * m, r: Math.max(0.05, S.A.thick * m * 0.5), thick: true }, ['blade']);
      return R('barrel', barrelKind(dir, D), dir.at, dir.d, { len: S.A.long * m, r: Math.max(0.07, S.A.thick * m * 0.5), thick: true }, ['wing', 'blade']);
    }
    // a triangle: a wing at the side; a spike at the nose
    if (S.nc === 3 || (S.nc === 2 && S.fill < 0.6)) {
      const dir = axisDir(loc, D);
      if (lateral || Math.abs(cx) > D.hw * 0.7) return R('wing', wingKind(c, D), [Math.sign(cx || 1) * D.hw, wingY(c, D, person), clampZ(cz, D)], dir.d, { span: S.A.long * m, chord: S.A.thick * m }, ['blade']);
      return R('blade', front ? 'ram' : lateral ? 'side' : 'ram', [0, D.h * 0.3, D.hl], [0, 0, 1], { len: S.A.long * m, curve: 0 }, ['wing']);
    }
    // anything else closed, over it: a balloon
    if (above) return R('balloon', 'top', [0, D.h, clampZ(cz, D)], [0, 1, 0], { d: Math.max(S.B.w, S.B.h) * m }, []);
    return null;
  }
  // -------- open lines
  const turn = Math.abs(S.T.signed);
  // an arch over it, clear of it, bulging up: a parachute (ROADMAP 11.21) - an arc with its ends on
  // it is a blade
  if (above && inside < 0.15 && !first.hit && !last.hit && F.kind !== 'weapon' && S.nx === 0 && turn > 1.2 && turn < 4.6 && bulgesUp(S, F)) return R('chute', 'top', [0, D.h, 0], [0, 1, 0], { span: S.A.long * m }, ['balloon', 'blade']);
  // a U: a magnet (deep, its two arms straight, back the way it came)
  if (isU(S)) {
    const fr = cz >= 0 || person || F.kind === 'weapon';
    return R('magnet', fr ? 'front' : 'back', [0, D.h * 0.45, fr ? D.hl : -D.hl], [0, 0, fr ? 1 : -1], { size: S.size * m }, ['blade']);
  }
  // a straight line: out of it, a barrel; across above it, a rotor; out to its side, a wing
  if (S.straight > 0.9) {
    const dir = axisDir(loc, D);
    const len = S.A.long * m;
    // (across, over it, level: a rotor - not one end on it pointing away)
    const upS = F.up;
    const lev = Math.abs((S.P[S.P.length - 1][0] - S.P[0][0]) * upS[0] + (S.P[S.P.length - 1][1] - S.P[0][1]) * upS[1]) / Math.max(1, S.L);
    const overMid = S.B.x0 < F.box.cx + F.box.w * 0.18 && S.B.x1 > F.box.cx - F.box.w * 0.18;
    if (cy > D.h * 0.86 && lev < 0.45 && overMid && !(dir.fromIt && dir.atTop === false)) {
      if (F.kind === 'weapon') return R('rotor', 'fan', [0, D.h, 0], [0, 1, 0], { span: len }, ['barrel']);
      return R('rotor', 'top', [0, D.h, clampZ(cz, D)], [0, 1, 0], { span: len }, ['barrel', 'wing']);
    }
    if (!dir.fromIt && !(person && dir.near)) return null;
    // (a hero's steep line up from himself is the quick sign's rope up to a roof - not a part)
    if (person && dir.d[1] > 0.55) return null;
    if (Math.abs(dir.d[0]) > 0.66 && Math.abs(dir.d[0]) > Math.abs(dir.d[2]) && F.kind !== 'weapon') return R('wing', 'plank', [Math.sign(dir.d[0]) * D.hw, wingY(c, D, person), clampZ(cz, D)], dir.d, { span: len, chord: Math.max(0.35, len * 0.35) }, ['barrel']);
    if (F.kind === 'weapon') return R('barrel', 'extra', dir.at, dir.d, { len, r: 0.035 }, ['blade']);
    return R('barrel', barrelKind(dir, D), dir.at, dir.d, { len, r: 0.06 }, ['wing', 'rotor']);
  }
  // a zigzag: hatching on it is armour (above); out of it, a flame - a jet
  if (S.teeth >= 3 && S.nx <= 3) {
    const len = S.A.long * m;
    if (F.kind === 'weapon') return R('jet', 'rocket', [0, 0, -D.hl], [0, 0, -1], { len, teeth: S.teeth }, ['spring']);
    if (person) return R('jet', 'pack', [0, D.h * 0.62, -D.hl], [0, -1, -0.3], { len, teeth: S.teeth }, ['spring', 'armor']);
    if (front && cy > D.h * 0.1) return R('jet', 'front', [0, D.h * 0.35, D.hl], [0, 0, 1], { len, teeth: S.teeth }, ['spring', 'armor']);
    // (under it and upright, seen from beside it: it lifts - not one out of its back, seen from
    // behind it, coming down the screen at you)
    const fromBack = axisDir(loc, D).at[2] < -D.hl * 0.6;
    if (cy < 0 && !back && !fromBack && Math.abs(S.A.uy) > 0.75) return R('jet', 'under', [0, 0.1, 0], [0, -1, 0], { len, teeth: S.teeth }, ['spring']);
    return R('jet', 'back', [0, D.h * 0.4, -D.hl], [0, 0, -1], { len, teeth: S.teeth }, ['spring', 'armor', 'barrel']);
  }
  // a bolt of lightning: a Z - two sharp turns, there and back (ROADMAP 11.21)
  if (isBolt(S) && F.kind !== 'weapon') return R('bolt', person ? 'aura' : 'coil', [0, D.h, 0], [0, 1, 0], { size: S.size * m }, ['jet', 'wing']);
  // an arc: a blade - at its nose a ram, at its sides knives (on the hero: on his arm)
  const onCircle = S.fit.err < 0.12 && S.fit.cover > 0.15 && S.fit.cover < 0.8 && S.depth > S.gap * 0.12;
  if (S.nx === 0 && (onCircle || (turn > 0.9 && turn < 3.8 && S.T.abs < turn * 1.6 + 0.6))) {
    const len = S.L * m;
    if (F.kind === 'weapon') return R('blade', 'bayonet', [0, 0, D.hl], [0, 0, 1], { len, curve: turn }, ['magnet']);
    if (person) return R('blade', 'arm', [0, D.h * 0.55, 0], [0, 0, 1], { len, curve: turn }, ['magnet']);
    const side = lateral && !front;
    return R('blade', side ? 'side' : back ? 'rear' : 'ram', side ? [D.hw, D.h * 0.3, 0] : [0, D.h * 0.3, back ? -D.hl : D.hl], side ? [1, 0, 0] : [0, 0, back ? -1 : 1], { len, curve: turn }, ['magnet', 'wing']);
  }
  // a V: a wing out to the side (or a spike at its nose: a blade)
  if (S.nc === 1 && S.armA > 0.85 && S.armB > 0.85) {
    const dir = axisDir(loc, D);
    if (lateral || Math.abs(dir.d[0]) > 0.5) return R('wing', wingKind(c, D), [Math.sign(cx || 1) * D.hw, wingY(c, D, person), clampZ(cz, D)], dir.d, { span: S.A.long * m, chord: S.A.thick * m }, ['blade']);
    if (front && !person) return R('blade', 'ram', [0, D.h * 0.3, D.hl], [0, 0, 1], { len: S.A.long * m, curve: 0 }, ['wing']);
  }
  return null;
}

// a U: deep, its two arms straight, back the way it came
function isU(S) {
  const turn = Math.abs(S.T.signed);
  return !S.closed && turn > 2.3 && turn < 4.3 && S.depth > S.gap * 0.7 && S.gap > S.size * 0.22 && S.armA > 0.86 && S.armB > 0.86 && S.nx === 0;
}

// (ROADMAP 11.21) a star: in one go, its lines crossing in the middle - or its outline, five points in
// and out (not round: a gear's teeth are a wheel's)
function isStar(S) {
  if (!S.closed || S.aspect > 1.8) return false;
  return (S.nx >= 4 && S.nc >= 4) || (S.bumps >= 4 && S.bumps <= 7 && S.fill < 0.44 && S.fit.err > 0.22);
}

// a bolt of lightning: open, two sharp turns, its three runs straight, going on the way it went
function isBolt(S) {
  return !S.closed && S.nc === 2 && S.teeth <= 2 && S.nx === 0 && Math.abs(S.T.signed) < 1.6 && S.armA > 0.8 && S.armB > 0.8 && S.straight < 0.9;
}

// an arch bulging up on the screen (the thing's up): its middle well above the line across its ends
function bulgesUp(S, F) {
  const P = S.P;
  const a = P[0];
  const b = P[P.length - 1];
  const mid = S.Q[Math.floor(S.Q.length / 2)];
  const h = (mid[0] - (a[0] + b[0]) / 2) * F.up[0] + (mid[1] - (a[1] + b[1]) / 2) * F.up[1];
  return h > Math.max(6, S.size * 0.18);
}

// a long one lying along the thing's length (its ends front and back of each other, on it)
function alongIt(S, F, D) {
  let i0 = 0;
  let i1 = 0;
  let lo = Infinity;
  let hi = -Infinity;
  S.Q.forEach(([x, y], i) => {
    const s = (x - S.A.mx) * S.A.ux + (y - S.A.my) * S.A.uy;
    if (s < lo) {
      lo = s;
      i0 = i;
    }
    if (s > hi) {
      hi = s;
      i1 = i;
    }
  });
  const a = F.local(S.Q[i0][0], S.Q[i0][1]).p;
  const b = F.local(S.Q[i1][0], S.Q[i1][1]).p;
  return Math.abs(b[2] - a[2]) > Math.abs(b[0] - a[0]) * 1.2 && Math.abs(b[2] - a[2]) > D.hl * 0.5;
}

// a closed one that is round, or square: a wheel's, a balloon's
function roundish(S) {
  const square = S.nc >= 3 && S.nc <= 5 && S.fill > 0.72 && S.aspect < 1.45;
  const round = S.fit.err < 0.24 && S.fit.cover > 0.72 && S.aspect < 1.9;
  return round || square;
}

// (ROADMAP 11.21) a line all on the thing itself, but for a slip of the hand: on its paint where that
// is known (a car of the city's kinds: F.skinAt), else on its box. Q: the line's points, loc: theirs
// on it (F.local)
export function onItAll(F, Q, loc) {
  let on = 0;
  for (let i = 0; i < Q.length; i++) if (F.skinAt ? F.skinAt(Q[i][0], Q[i][1]) : loc[i].hit) on++;
  return on >= Q.length * 0.85;
}

// the same stroke as another part (the tag's "not that one?" - game/fuse.js swap): that part where
// the stroke was drawn, its size from the stroke's
export function asType(type, m, F) {
  const D = F.dims;
  const c = m.c;
  const [cx, , cz] = c;
  const s = Math.max(0.3, m.sizeM || 1);
  const person = F.kind === 'hero' || F.kind === 'person';
  const gun = F.kind === 'weapon';
  const side = Math.sign(cx || 1);
  const fr = cz >= 0 || person || gun;
  const R = (v, at, dir, n) => ({ type, v, at, dir: dir || null, n: n || {}, alts: [], c, inside: m.inside, sizeM: m.sizeM });
  switch (type) {
    case 'wheel':
      return gun ? null : R('round', [0, 0, 0], null, { r: person ? 0.06 : F.wheelR || 0.34, bumps: 0 });
    case 'balloon':
      return gun ? null : R('top', [0, D.h, clampZ(cz, D)], [0, 1, 0], { d: Math.max(person ? 0.7 : 1.4, s) });
    case 'spring':
      if (gun) return R('bounce', [0, 0, 0], [0, 0, 1], { coils: 4, len: s });
      return R('under', [0, 0, 0], [0, 1, 0], { coils: 4, len: Math.max(0.4, Math.min(1.2, s)) });
    case 'jet':
      if (gun) return R('rocket', [0, 0, -D.hl], [0, 0, -1], { len: s, teeth: 4 });
      if (person) return R('pack', [0, D.h * 0.62, -D.hl], [0, -1, -0.3], { len: s, teeth: 4 });
      return R('back', [0, D.h * 0.4, -D.hl], [0, 0, -1], { len: Math.max(0.6, s), teeth: 4 });
    case 'armor':
      return R('plate', [0, D.h * 0.5, 0], null, { cover: 0.6, teeth: 4 });
    case 'rotor':
      return gun ? R('fan', [0, D.h, 0], [0, 1, 0], { span: s }) : R('top', [0, D.h, clampZ(cz, D)], [0, 1, 0], { span: Math.max(person ? 1 : 2, s) });
    case 'wing':
      return gun ? R('wing', [side * D.hw, D.h * 0.5, 0], [side, 0, 0], { span: s, chord: s * 0.35 }) : R(wingKind(c, D), [side * D.hw, wingY(c, D, person), clampZ(cz, D)], [side, 0, 0], { span: Math.max(1, s), chord: Math.max(0.35, s * 0.35) });
    case 'barrel':
      if (gun) return R('extra', [0, D.h * 0.5, D.hl], [0, 0, 1], { len: Math.max(0.3, s), r: 0.035 });
      return R('turret', [0, D.h, 0], [0, 0, 1], { len: Math.max(0.8, s), r: 0.06 });
    case 'blade':
      if (gun) return R('bayonet', [0, 0, D.hl], [0, 0, 1], { len: s, curve: 1.5 });
      if (person) return R('arm', [0, D.h * 0.55, 0], [0, 0, 1], { len: s, curve: 1.5 });
      return R('ram', [0, D.h * 0.3, D.hl], [0, 0, 1], { len: Math.max(1, s), curve: 1.5 });
    case 'magnet':
      return R(fr ? 'front' : 'back', [0, D.h * 0.45, fr ? D.hl : -D.hl], [0, 0, fr ? 1 : -1], { size: Math.max(0.5, s) });
    case 'star':
      return gun ? null : R('top', [0, D.h, clampZ(cz, D)], [0, 1, 0], { size: Math.max(0.6, s) });
    case 'bolt':
      return gun ? null : R(person ? 'aura' : 'coil', [0, D.h, 0], [0, 1, 0], { size: 1 });
    case 'smoke':
      return gun || person ? null : R('back', [0, D.h * 0.35, -D.hl], [0, 0, -1], { turns: 2 });
    case 'chute':
      return gun ? null : R('top', [0, D.h, 0], [0, 1, 0], { span: Math.max(2.4, s) });
    case 'float':
      return gun || person ? null : R('pontoon', [0, 0, 0], null, { len: D.hl * 1.7 });
    default:
      return null;
  }
}

// along the thing (its length), kept on it
function clampZ(z, D) {
  return Math.max(-D.hl * 0.85, Math.min(D.hl * 0.85, z));
}

function wingY(c, D, person) {
  return person ? D.h * 0.72 : Math.max(D.h * 0.38, Math.min(D.h * 0.8, c[1]));
}

// a small wing high at the back of a car: a spoiler (grip), else a wing (it glides)
function wingKind(c, D) {
  return c[2] < -D.hl * 0.55 && c[1] > D.h * 0.55 && Math.abs(c[0]) < D.hw * 1.1 ? 'spoiler' : 'wing';
}

// a line's way in the thing's frame: from the end on it to the end off it - { d [x,y,z] (unit),
// at (its foot on the thing), fromIt (one end on or by it), near, atTop }
function axisDir(loc, D) {
  const a = loc[0];
  const b = loc[loc.length - 1];
  const dist = (o) => {
    const [x, y, z] = o.p;
    const dx = Math.max(0, Math.abs(x) - D.hw);
    const dy = Math.max(0, y - D.h, -y);
    const dz = Math.max(0, Math.abs(z) - D.hl);
    return Math.hypot(dx, dy, dz);
  };
  const da = a.hit ? 0 : dist(a);
  const db = b.hit ? 0 : dist(b);
  const inner = da <= db ? a : b;
  const outer = da <= db ? b : a;
  const near = Math.min(da, db) < Math.max(0.6, D.h * 0.35);
  let dx = outer.p[0] - inner.p[0];
  let dy = outer.p[1] - inner.p[1];
  let dz = outer.p[2] - inner.p[2];
  const l = Math.hypot(dx, dy, dz) || 1;
  dx /= l;
  dy /= l;
  dz /= l;
  // its foot: where it meets the thing (pulled onto its skin)
  const at = [Math.max(-D.hw, Math.min(D.hw, inner.p[0])), Math.max(0, Math.min(D.h, inner.p[1])), Math.max(-D.hl, Math.min(D.hl, inner.p[2]))];
  return { d: [dx, dy, dz], at, fromIt: near, near, atTop: at[1] > D.h * 0.8 };
}

// a gun on a car: on the roof it turns (a turret); out of its nose it fires ahead; out of its tail,
// back at what chases it
function barrelKind(dir, D) {
  if (dir.atTop && dir.d[1] > -0.2) return 'turret';
  if (dir.d[2] > 0.55) return 'front';
  if (dir.d[2] < -0.55) return 'rear';
  return 'turret';
}
