// (ROADMAP 11.9) The hand made steady. A line drawn by hand wobbles, its corners come out round,
// its circle is an egg and the shape it closes does not quite meet. As each line is lifted the
// game draws it again as it was meant - a little, never more: a straight line straight, a corner
// sharp (a right angle where it nearly was one, level where it was nearly level), a circle round,
// an ellipse even, a shape that nearly closed closed, a line that nearly met another meeting it,
// and a wheel the size of the wheel beside it. A curve stays the curve it was, its wobble gone.
// Pure geometry on the pen's points ([x, y], the drawing's units: ui/freedraw.js).

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

function pathLen(P) {
  let L = 0;
  for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  return L;
}

function boxOf(P) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of P) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// n points evenly along the path (closed: round the loop back to the start)
export function resample(P, n, closed = false) {
  const Q = closed && P.length > 1 ? [...P, P[0]] : P;
  const L = pathLen(Q);
  if (Q.length < 2 || L < 1e-9) return Array.from({ length: n }, () => [Q[0][0], Q[0][1]]);
  const step = L / (closed ? n : n - 1);
  const out = [[Q[0][0], Q[0][1]]];
  let need = step;
  for (let i = 1; i < Q.length && out.length < n; i++) {
    let [ax, ay] = Q[i - 1];
    const [bx, by] = Q[i];
    let seg = Math.hypot(bx - ax, by - ay);
    while (seg >= need && out.length < n) {
      const t = need / seg;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      out.push([ax, ay]);
      seg -= need;
      need = step;
    }
    need -= seg;
  }
  while (out.length < n) out.push([Q[Q.length - 1][0], Q[Q.length - 1][1]]);
  return out;
}

// Douglas-Peucker: the points that matter (their indices). A loop (its ends together) is split
// first at its point farthest from the start
function rdpIdx(P, eps) {
  const keep = new Uint8Array(P.length);
  keep[0] = 1;
  keep[P.length - 1] = 1;
  const stack = [];
  const last = P.length - 1;
  if (Math.hypot(P[last][0] - P[0][0], P[last][1] - P[0][1]) < eps) {
    let f = 0;
    let df = -1;
    for (let k = 1; k < last; k++) {
      const d = Math.hypot(P[k][0] - P[0][0], P[k][1] - P[0][1]);
      if (d > df) {
        df = d;
        f = k;
      }
    }
    if (f > 0) {
      keep[f] = 1;
      stack.push([0, f], [f, last]);
    }
  } else stack.push([0, last]);
  while (stack.length) {
    const [i, j] = stack.pop();
    const [ax, ay] = P[i];
    const [bx, by] = P[j];
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy) || 1e-9;
    let m = -1;
    let dm = eps;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((P[k][0] - ax) * dy - (P[k][1] - ay) * dx) / L;
      if (d > dm) {
        dm = d;
        m = k;
      }
    }
    if (m >= 0) {
      keep[m] = 1;
      stack.push([i, m], [m, j]);
    }
  }
  const out = [];
  for (let k = 0; k < P.length; k++) if (keep[k]) out.push(k);
  return out;
}

// the farthest any point of P[i..j] is from the line P[i]-P[j]
function bulge(P, i, j) {
  const [ax, ay] = P[i];
  const [bx, by] = P[j];
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy) || 1e-9;
  let dm = 0;
  for (let k = i + 1; k < j; k++) dm = Math.max(dm, Math.abs((P[k][0] - ax) * dy - (P[k][1] - ay) * dx) / L);
  return dm;
}

// a circle through the points (least squares, Kasa): { x, y, r, err (spread of the radius / r) }
function fitCircle(P) {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of P) {
    sx += x;
    sy += y;
  }
  const n = P.length;
  const mx = sx / n;
  const my = sy / n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const [x, y] of P) {
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
  if (Math.abs(det) < 1e-12) return null;
  const a = (suuu + suvv) / 2;
  const b = (svvv + svuu) / 2;
  const uc = (a * svv - b * suv) / det;
  const vc = (b * suu - a * suv) / det;
  const x = mx + uc;
  const y = my + vc;
  let r = 0;
  for (const [px, py] of P) r += Math.hypot(px - x, py - y);
  r /= n;
  let e = 0;
  for (const [px, py] of P) e += (Math.hypot(px - x, py - y) - r) ** 2;
  return { x, y, r, err: Math.sqrt(e / n) / Math.max(r, 1e-9) };
}

// the points' main axes: { x, y (the middle), ang (of the long axis), a, b (the half lengths of an
// ellipse with that spread) }
function axes(P) {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of P) {
    sx += x;
    sy += y;
  }
  const n = P.length;
  const mx = sx / n;
  const my = sy / n;
  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (const [x, y] of P) {
    cxx += (x - mx) ** 2;
    cyy += (y - my) ** 2;
    cxy += (x - mx) * (y - my);
  }
  cxx /= n;
  cyy /= n;
  cxy /= n;
  const tr = cxx + cyy;
  const dt = Math.sqrt(Math.max(0, ((cxx - cyy) / 2) ** 2 + cxy * cxy));
  const l1 = tr / 2 + dt;
  const l2 = Math.max(1e-12, tr / 2 - dt);
  const ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  return { x: mx, y: my, ang, a: Math.sqrt(2 * l1), b: Math.sqrt(2 * l2) };
}

// how far round the middle the points go (the biggest gap left, radians)
function gapRound(P, cx, cy) {
  const an = P.map(([x, y]) => Math.atan2(y - cy, x - cx)).sort((p, q) => p - q);
  let gap = an[0] + TAU - an[an.length - 1];
  for (let i = 1; i < an.length; i++) gap = Math.max(gap, an[i] - an[i - 1]);
  return gap;
}

// which way round the points go (1 or -1, in the drawing's y-down units)
function turning(P) {
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i];
    const [bx, by] = P[(i + 1) % P.length];
    s += ax * by - bx * ay;
  }
  return s >= 0 ? 1 : -1;
}

// a direction a little off level, upright or a diagonal is put on it (and every 15 degrees on
// a closer look); a corner a little off square is made square
function snapAngle(a) {
  for (const [step, tol] of [[90, 7], [45, 5], [15, 2.5]]) {
    const s = step * DEG;
    const k = Math.round(a / s) * s;
    if (Math.abs(a - k) < tol * DEG) return k;
  }
  return a;
}

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// where two lines meet (each a point and a direction); null: about parallel
function meet(p, a, q, b) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const ex = Math.cos(b);
  const ey = Math.sin(b);
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < Math.sin(12 * DEG)) return null;
  const t = ((q[0] - p[0]) * ey - (q[1] - p[1]) * ex) / den;
  return [p[0] + dx * t, p[1] + dy * t];
}

// the corners of a run of straight sides: each side on its own line (its direction made level,
// upright, a diagonal or square to the one before, where it nearly was), the corners where the
// lines meet. sides: [{ p: a point on it, a: its direction, len }]
function corners(sides, ends, closed) {
  // square to the one before (a corner of 80-100 degrees), unless already snapped to the page
  for (let i = 1; i < sides.length + (closed ? 1 : 0); i++) {
    const A = sides[i - 1];
    const B = sides[i % sides.length];
    if (B.fixed) continue;
    const turn = wrapA(B.a - A.a);
    if (Math.abs(Math.abs(turn) - Math.PI / 2) < 10 * DEG) {
      B.a = A.a + Math.sign(turn) * Math.PI / 2;
      B.fixed = true;
    }
  }
  const pts = [];
  const n = sides.length;
  for (let i = 0; i < n; i++) {
    const A = sides[i];
    if (i === 0 && !closed) {
      pts.push(project(ends[0], A));
      continue;
    }
    const P = sides[(i - 1 + n) % n];
    const m = meet(P.p, P.a, A.p, A.a);
    // (about parallel: the corner between them where it was drawn)
    pts.push(m && Math.hypot(m[0] - A.p[0], m[1] - A.p[1]) < (A.len + P.len) * 1.5 ? m : A.c0);
  }
  if (!closed) pts.push(project(ends[1], sides[n - 1]));
  else pts.push([pts[0][0], pts[0][1]]);
  return pts;
}

function project(q, S) {
  const dx = Math.cos(S.a);
  const dy = Math.sin(S.a);
  const t = (q[0] - S.p[0]) * dx + (q[1] - S.p[1]) * dy;
  return [S.p[0] + dx * t, S.p[1] + dy * t];
}

// a curve without its wobble: Chaikin's corner cutting on the points that matter
function smooth(P, closed, times = 2) {
  let Q = P;
  for (let k = 0; k < times; k++) {
    const out = closed ? [] : [Q[0]];
    const n = Q.length;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = Q[i];
      const b = Q[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) out.push(Q[n - 1]);
    Q = out;
  }
  if (closed) Q.push([Q[0][0], Q[0][1]]);
  return Q;
}

// a ring of n points: a circle (b = a) or an ellipse turned by ang; starting where the drawing
// started (t0) and going round the way it went (dir)
function ring(cx, cy, a, b, ang, t0, dir, n = 48) {
  const out = [];
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  for (let i = 0; i <= n; i++) {
    const t = t0 + (dir * i * TAU) / n;
    const u = Math.cos(t) * a;
    const v = Math.sin(t) * b;
    out.push([cx + u * c - v * s, cy + u * s + v * c]);
  }
  return out;
}

/**
 * One line, as it was meant. P: its points ([x, y], the drawing's units). o.unit: how big a
 * screen pixel is in those units (thresholds that are about the hand, not the shape).
 * Returns { p: the points, kind: 'dot' | 'line' | 'circle' | 'ellipse' | 'poly' | 'curve' |
 * 'mixed' | 'scribble', closed, c: { x, y, r } (a circle's) }
 */
export function cleanStroke(P, o = {}) {
  const px = o.unit || 1 / 360;
  if (!P || P.length < 2) return { p: P, kind: 'dot', closed: false };
  const L = pathLen(P);
  const B = boxOf(P);
  const size = Math.max(B.w, B.h);
  if (L < px * 6 || size < px * 4) return { p: P, kind: 'dot', closed: false };
  // a scribble (going back and forth over itself): left as it is
  if (L > Math.hypot(B.w, B.h) * 5.5) return { p: P, kind: 'scribble', closed: false };
  // the hand's tremble out first: points evenly along it, each the average of it and its two
  // neighbours (the ends stay where they are)
  const n = Math.max(12, Math.min(160, Math.round(L / (px * 3))));
  let Q = resample(P, n);
  Q = Q.map((q, i) => (i === 0 || i === n - 1 ? q : [(Q[i - 1][0] + q[0] * 2 + Q[i + 1][0]) / 4, (Q[i - 1][1] + q[1] * 2 + Q[i + 1][1]) / 4]));
  const a0 = Q[0];
  const a1 = Q[n - 1];
  const chord = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
  // ---- closed (nearly): a circle, an ellipse, or a shape of straight sides and curves
  const closedish = chord < Math.max(px * 14, size * 0.2) && L > size * 2.2;
  if (closedish) {
    const ring0 = Q.slice(0, n - 1);
    const C = fitCircle(ring0);
    const ax = axes(ring0);
    const dir = turning(ring0);
    if (C && C.err < 0.085 && ax.a / ax.b < 1.22 && gapRound(ring0, C.x, C.y) < 70 * DEG) {
      const t0 = Math.atan2(a0[1] - C.y, a0[0] - C.x);
      return { p: ring(C.x, C.y, C.r, C.r, 0, t0, dir), kind: 'circle', closed: true, c: { x: C.x, y: C.y, r: C.r } };
    }
    if (ax.a / ax.b >= 1.22 && ax.a / ax.b < 4) {
      // an ellipse? (its own axes; level or upright if it nearly was)
      const ang = snapAngle(ax.ang);
      const c = Math.cos(-ang);
      const s = Math.sin(-ang);
      let e = 0;
      for (const [x, y] of ring0) {
        const u = (x - ax.x) * c - (y - ax.y) * s;
        const v = (x - ax.x) * s + (y - ax.y) * c;
        e += (Math.hypot(u / ax.a, v / ax.b) - 1) ** 2;
      }
      if (Math.sqrt(e / ring0.length) < 0.085 && gapRound(ring0, ax.x, ax.y) < 70 * DEG) {
        const u0 = (a0[0] - ax.x) * c - (a0[1] - ax.y) * s;
        const v0 = (a0[0] - ax.x) * s + (a0[1] - ax.y) * c;
        return { p: ring(ax.x, ax.y, ax.a, ax.b, ang, Math.atan2(v0 / ax.b, u0 / ax.a), dir), kind: 'ellipse', closed: true };
      }
    }
  }
  // ---- straight sides and curves, between the corners
  const eps = Math.max(px * 2.5, size * 0.03);
  const ring1 = closedish ? [...Q.slice(0, n - 1), Q[0]] : Q;
  const idx = rdpIdx(ring1, eps);
  // the corners: where it turns sharply. Looked at close by and a little farther: a corner turns
  // all at once (as much close by as farther off), a bend of a curve turns more the farther one
  // looks - a wave stays a wave
  const m = ring1.length;
  const at = (i) => ring1[closedish ? ((i % (m - 1)) + (m - 1)) % (m - 1) : Math.max(0, Math.min(m - 1, i))];
  const turnAt = (i, k) => {
    const p = at(i - k);
    const q = at(i);
    const r = at(i + k);
    return Math.abs(wrapA(Math.atan2(r[1] - q[1], r[0] - q[0]) - Math.atan2(q[1] - p[1], q[0] - p[0])));
  };
  const sharp = (i) => {
    const t2 = turnAt(i, 2);
    return t2 > 22 * DEG && t2 > 0.5 * turnAt(i, 5);
  };
  const cIdx = [idx[0]];
  for (let k = 1; k < idx.length - 1; k++) if (sharp(idx[k])) cIdx.push(idx[k]);
  cIdx.push(idx[idx.length - 1]);
  // (a closed one: its start is a corner only if it turns there too)
  if (closedish && cIdx.length > 2 && !o.rotated) {
    if (!sharp(0) && cIdx.length > 3) {
      // no corner at the start: begin at the first real one
      const k0 = cIdx[1];
      const rot = [...ring1.slice(k0, ring1.length - 1), ...ring1.slice(0, k0), ring1[k0]];
      return cleanStroke(rot, { ...o, rotated: true });
    }
  }
  // each run between corners: straight (how far it bulges from its chord) or a curve
  const runs = [];
  for (let k = 0; k < cIdx.length - 1; k++) {
    const i = cIdx[k];
    const j = cIdx[k + 1];
    const len = Math.hypot(ring1[j][0] - ring1[i][0], ring1[j][1] - ring1[i][1]);
    const straight = j - i < 2 || bulge(ring1, i, j) < Math.max(px * 3, len * 0.06);
    runs.push({ i, j, straight, len });
  }
  const allStraight = runs.every((r) => r.straight);
  if (!closedish && runs.length === 1 && allStraight && chord > L * 0.9) {
    // one straight line: level, upright or a diagonal if it nearly was (turned about its middle)
    const ang = snapAngle(Math.atan2(a1[1] - a0[1], a1[0] - a0[0]));
    const mx = (a0[0] + a1[0]) / 2;
    const my = (a0[1] + a1[1]) / 2;
    const h = chord / 2;
    return { p: [[mx - Math.cos(ang) * h, my - Math.sin(ang) * h], [mx + Math.cos(ang) * h, my + Math.sin(ang) * h]], kind: 'line', closed: false };
  }
  if (allStraight && runs.length >= 2) {
    // straight sides: each on its line, the corners where the lines meet
    const sides = runs.map((r) => {
      const a = ring1[r.i];
      const b = ring1[r.j];
      const raw = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const ang = snapAngle(raw);
      return { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], a: ang, len: r.len, c0: a, fixed: ang !== raw };
    });
    const pts = corners(sides, [ring1[0], ring1[ring1.length - 1]], closedish);
    return { p: pts, kind: 'poly', closed: closedish };
  }
  // curves (with straight bits between sharp corners): each run smoothed, or straight
  const out = [];
  for (const r of runs) {
    const seg = ring1.slice(r.i, r.j + 1);
    let part;
    if (r.straight) part = [seg[0], seg[seg.length - 1]];
    else {
      const keep = rdpIdx(seg, Math.max(px * 1.2, size * 0.012)).map((k) => seg[k]);
      part = smooth(keep, false, 2);
    }
    if (out.length) part = part.slice(1);
    out.push(...part);
  }
  if (closedish) out.push([out[0][0], out[0][1]]);
  return { p: out, kind: runs.length > 1 ? 'mixed' : 'curve', closed: closedish };
}

// the nearest point on a stroke's lines to q: { x, y, d, end (it is one of its ends) }
function nearestOn(S, q) {
  let best = null;
  const P = S.p;
  for (let i = 1; i < P.length; i++) {
    const [ax, ay] = P[i - 1];
    const [bx, by] = P[i];
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / L2));
    const x = ax + dx * t;
    const y = ay + dy * t;
    const d = Math.hypot(q[0] - x, q[1] - y);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best;
}

/**
 * The line just cleaned, joined to the lines drawn before it: an end that nearly met an end (or a
 * line) meets it, and a circle the size of a circle beside it (a wheel and its pair) takes its
 * size and its height. C: cleanStroke's result (changed); prev: the lines before, cleaned
 * ({ p, kind, c }); o.unit as above.
 */
export function joinStroke(C, prev, o = {}) {
  const px = o.unit || 1 / 360;
  if (C.kind === 'dot' || C.kind === 'scribble' || !prev.length) return C;
  if (C.kind === 'circle' && C.c) {
    // a wheel beside a wheel: the same size, at the same height
    for (const S of prev) {
      if (S.kind !== 'circle' || !S.c) continue;
      const k = C.c.r / S.c.r;
      if (k > 0.8 && k < 1.25 && Math.abs(C.c.y - S.c.y) < S.c.r * 0.6 && Math.abs(C.c.x - S.c.x) > S.c.r * 1.5) {
        const t0 = Math.atan2(C.p[0][1] - C.c.y, C.p[0][0] - C.c.x);
        const dir = turning(C.p.slice(0, -1));
        C.c = { x: C.c.x, y: S.c.y, r: S.c.r };
        C.p = ring(C.c.x, C.c.y, C.c.r, C.c.r, 0, t0, dir);
        break;
      }
    }
    return C;
  }
  if (C.closed) return C;
  const reach = Math.max(px * 12, 0.0001);
  const ends = [0, C.p.length - 1];
  for (const e of ends) {
    const q = C.p[e];
    let to = null;
    let dBest = reach;
    for (const S of prev) {
      if (S.kind === 'dot' || S.kind === 'scribble') continue;
      // an end first (a corner where two lines meet), then anywhere along it
      for (const k of S.closed ? [] : [0, S.p.length - 1]) {
        const d = Math.hypot(S.p[k][0] - q[0], S.p[k][1] - q[1]);
        if (d < dBest * 1.2) {
          dBest = d / 1.2;
          to = [S.p[k][0], S.p[k][1]];
        }
      }
      const m = nearestOn(S, q);
      if (m && m.d < dBest) {
        dBest = m.d;
        to = [m.x, m.y];
      }
    }
    if (!to) continue;
    const dx = to[0] - q[0];
    const dy = to[1] - q[1];
    if (C.kind === 'line' || C.kind === 'poly') {
      C.p[e] = to;
    } else {
      // a curve: its end eases over to it, the rest as it was
      const n = C.p.length;
      for (let i = 0; i < n; i++) {
        const t = e === 0 ? 1 - i / (n - 1) : i / (n - 1);
        const w = Math.max(0, (t - 0.7) / 0.3);
        C.p[i] = [C.p[i][0] + dx * w * w, C.p[i][1] + dy * w * w];
      }
    }
  }
  return C;
}

// the line as drawn and as cleaned, each as n points that go together (for drawing the one
// turning into the other: ui/freedraw.js). A closed one is turned to start where the hand
// started, going round the way it went
export function morphPair(raw, clean, closed, n = 64) {
  const a = resample(raw, n);
  let b = resample(clean, n);
  if (closed) {
    let k = 0;
    let best = Infinity;
    for (let i = 0; i < n - 1; i++) {
      const d = Math.hypot(b[i][0] - a[0][0], b[i][1] - a[0][1]);
      if (d < best) {
        best = d;
        k = i;
      }
    }
    const ring0 = b.slice(0, n - 1);
    const fwd = [...ring0.slice(k), ...ring0.slice(0, k)];
    const back = [fwd[0], ...fwd.slice(1).reverse()];
    const far = (R) => R.reduce((s, q, i) => s + Math.hypot(q[0] - a[i][0], q[1] - a[i][1]), 0);
    const R = far(fwd) <= far(back) ? fwd : back;
    b = [...R, R[0]];
  }
  return { a, b };
}
