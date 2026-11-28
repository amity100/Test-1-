// (ROADMAP 11.9) The quick signs' shapes by themselves, before what is under them (game/signs.js
// looks at that): strokes in screen px ([x, y] each). A sign's shape has to be one a drawing
// hardly ever starts with - a heart, a scribble - or else it needs the world to agree (a car
// under the X, people in the loop, the hero at the rope's start).

export function pathLen(P) {
  let L = 0;
  for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  return L;
}

export function boxOf(P) {
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
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export function inPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

// where two segments cross: { t, u (along each, 0-1), x, y } | null
export function cross(a0, a1, b0, b1) {
  const dx = a1[0] - a0[0];
  const dy = a1[1] - a0[1];
  const ex = b1[0] - b0[0];
  const ey = b1[1] - b0[1];
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b0[0] - a0[0]) * ey - (b0[1] - a0[1]) * ex) / den;
  const u = ((b0[0] - a0[0]) * dy - (b0[1] - a0[1]) * dx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, x: a0[0] + dx * t, y: a0[1] + dy * t };
}

export function straightness(P) {
  const L = pathLen(P);
  return L > 0 ? Math.hypot(P[P.length - 1][0] - P[0][0], P[P.length - 1][1] - P[0][1]) / L : 0;
}

// n points evenly along the line
export function along(P, n) {
  if (P.length < 2) return [P[0].slice()];
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1];
  if (L <= 0) return [P[0].slice()];
  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * L;
    while (j < P.length - 1 && cum[j] < s) j++;
    const s0 = cum[j - 1];
    const t = Math.min(1, Math.max(0, (s - s0) / (cum[j] - s0 || 1)));
    out.push([P[j - 1][0] + (P[j][0] - P[j - 1][0]) * t, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * t]);
  }
  return out;
}

// how the line turns: { signed, abs } (radians), each point's turn taken over a few steps
function turning(Q) {
  let signed = 0;
  let abs = 0;
  for (let i = 1; i < Q.length - 1; i++) {
    const a = Math.atan2(Q[i][1] - Q[i - 1][1], Q[i][0] - Q[i - 1][0]);
    const b = Math.atan2(Q[i + 1][1] - Q[i][1], Q[i + 1][0] - Q[i][0]);
    let t = b - a;
    while (t > Math.PI) t -= Math.PI * 2;
    while (t < -Math.PI) t += Math.PI * 2;
    signed += t;
    abs += Math.abs(t);
  }
  return { signed, abs };
}

// the sharp corners along a line (n points evenly along it; closed: round the end to the start)
export function corners(Q, closed = false) {
  const n = Q.length;
  const k = 4;
  const at = (i) => (closed ? Q[(i + n) % n] : Q[Math.max(0, Math.min(n - 1, i))]);
  const turn = [];
  for (let i = 0; i < n; i++) {
    const a = at(i - k);
    const b = at(i);
    const c = at(i + k);
    const t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
    turn.push(Math.min(t, Math.PI * 2 - t));
  }
  let m = 0;
  let last = -100;
  for (let i = 0; i < n; i++) {
    if (!closed && (i < k || i >= n - k)) continue;
    if (turn[i] < 1.2) continue;
    if (turn[i] < turn[(i + n - 1) % n] || turn[i] < turn[(i + 1) % n]) continue;
    if (i - last < 6) continue;
    m++;
    last = i;
  }
  return m;
}

// a heart: closed (as one line, or two halves meeting at both ends), two round bumps on top with
// a sharp dip between them, narrowing down to a point at the bottom
export function isHeart(P0) {
  const B = boxOf(P0);
  const size = Math.max(B.w, B.h);
  if (size < 40 || B.w / B.h < 0.6 || B.w / B.h > 1.7) return false;
  const gap = Math.hypot(P0[P0.length - 1][0] - P0[0][0], P0[P0.length - 1][1] - P0[0][1]);
  const L = pathLen(P0);
  if (gap > size * 0.3 || L < size * 2.4 || L > size * 4.6) return false;
  const P = along(P0, 120);
  // the top and the bottom of it, column by column
  const N = 20;
  const top = new Array(N).fill(Infinity);
  const bot = new Array(N).fill(-Infinity);
  for (const [x, y] of P) {
    const c = Math.min(N - 1, Math.max(0, Math.floor(((x - B.x0) / B.w) * N)));
    if (y < top[c]) top[c] = y;
    if (y > bot[c]) bot[c] = y;
  }
  for (let c = 0; c < N; c++) if (!Number.isFinite(top[c])) return false;
  // the dip: the top's lowest point in the middle, well under both bumps
  let dip = -Infinity;
  let dc = -1;
  for (let c = 7; c <= 12; c++) {
    if (top[c] > dip) {
      dip = top[c];
      dc = c;
    }
  }
  let bumpL = Infinity;
  let bumpR = Infinity;
  for (let c = 0; c < dc; c++) bumpL = Math.min(bumpL, top[c]);
  for (let c = dc + 1; c < N; c++) bumpR = Math.min(bumpR, top[c]);
  const D = dip - Math.max(bumpL, bumpR);
  if (D < B.h * 0.05) return false;
  // (a V there, not a lid sagging in the middle)
  if (dip - top[dc - 2] < D * 0.3 || dip - top[dc + 2] < D * 0.3) return false;
  // (round bumps: its sharp corners are the dip and the point, not a star's ten)
  if (corners(P, true) > 4) return false;
  // (in the top part: a dip, not a sag in a lid or the gap between two things)
  if (dip > B.y0 + B.h * 0.5) return false;
  // the point: the lowest point near the middle, and the sides closing in on it
  let low = P[0];
  for (const q of P) if (q[1] > low[1]) low = q;
  if (Math.abs(low[0] - B.cx) > B.w * 0.2) return false;
  // (the bottom at the sides well above the point: a V, not a flat floor)
  const side = Math.max(bot[1], bot[N - 2]);
  if (B.y1 - side < B.h * 0.3) return false;
  let wMid = [Infinity, -Infinity];
  let wLow = [Infinity, -Infinity];
  for (const [x, y] of P) {
    const v = (y - B.y0) / B.h;
    if (v > 0.3 && v < 0.45) wMid = [Math.min(wMid[0], x), Math.max(wMid[1], x)];
    if (v > 0.75 && v < 0.88) wLow = [Math.min(wLow[0], x), Math.max(wLow[1], x)];
  }
  return wLow[1] - wLow[0] < (wMid[1] - wMid[0]) * 0.62;
}

// two lines that meet at both ends (a heart drawn a half at a time): one closed line, or null
export function halves(A, B) {
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const box = boxOf([...A, ...B]);
  const tol = Math.max(14, Math.max(box.w, box.h) * 0.2);
  const a0 = A[0];
  const a1 = A[A.length - 1];
  if (d(a1, B[0]) < tol && d(a0, B[B.length - 1]) < tol) return [...A, ...B];
  if (d(a1, B[B.length - 1]) < tol && d(a0, B[0]) < tol) return [...A, ...B.slice().reverse()];
  return null;
}

// how many times the line crosses itself (n points evenly along it)
export function crossings(P, n = 120) {
  const Q = along(P, n);
  let k = 0;
  for (let i = 1; i < Q.length; i++) {
    for (let j = i + 2; j < Q.length; j++) if (cross(Q[i - 1], Q[i], Q[j - 1], Q[j])) k++;
  }
  return k;
}

// a scribble: over and over the same patch, thick with ink - a tangle, crossing itself again and
// again. Not a spring: a zigzag goes on along its length without crossing itself, a coil's turns
// cross only the ones next to them
export function isScribble(P0) {
  const B = boxOf(P0);
  const diag = Math.hypot(B.w, B.h);
  if (diag < 80) return false;
  const asp = B.w / Math.max(1, B.h);
  if (asp < 0.35 || asp > 2.8) return false;
  const L = pathLen(P0);
  if (L < diag * 4.5) return false;
  const n = Math.max(48, Math.min(240, Math.round(L / 8)));
  const Q = along(P0, n);
  const T = turning(Q);
  // (its passes: a turn round, or a way across and back)
  const passes = Math.max(1, Math.abs(T.signed) / (Math.PI * 2), T.abs / (Math.PI * 2) - Math.abs(T.signed) / (Math.PI * 2));
  const k = crossings(Q, n);
  if (k < 8 || k < passes * 2.5) return false;
  // (round and round: in one place - a coil's turns go on along it)
  return Math.abs(T.signed) < T.abs * 0.5 || !coil(Q);
}

// round the same way, each turn a little further on: a coil
function coil(Q) {
  const C = [];
  let acc = 0;
  let sx = 0;
  let sy = 0;
  let m = 0;
  let size = 0;
  let b = boxOf([Q[0]]);
  for (let i = 1; i < Q.length - 1; i++) {
    const a = Math.atan2(Q[i][1] - Q[i - 1][1], Q[i][0] - Q[i - 1][0]);
    const c = Math.atan2(Q[i + 1][1] - Q[i][1], Q[i + 1][0] - Q[i][0]);
    let t = c - a;
    while (t > Math.PI) t -= Math.PI * 2;
    while (t < -Math.PI) t += Math.PI * 2;
    acc += t;
    sx += Q[i][0];
    sy += Q[i][1];
    m++;
    b = { x0: Math.min(b.x0, Q[i][0]), x1: Math.max(b.x1, Q[i][0]), y0: Math.min(b.y0, Q[i][1]), y1: Math.max(b.y1, Q[i][1]) };
    if (Math.abs(acc) >= Math.PI * 2) {
      C.push([sx / m, sy / m]);
      size += Math.max(b.x1 - b.x0, b.y1 - b.y0);
      acc = 0;
      sx = 0;
      sy = 0;
      m = 0;
      b = { x0: Q[i][0], x1: Q[i][0], y0: Q[i][1], y1: Q[i][1] };
    }
  }
  if (C.length < 3) return false;
  size /= C.length;
  // (the turns' middles: along one way, in order, over a good part of a turn's size)
  const first = C[0];
  const last = C[C.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const span = Math.hypot(dx, dy);
  if (span < size * 0.6) return false;
  let back = 0;
  for (let i = 1; i < C.length; i++) {
    const step = ((C[i][0] - C[i - 1][0]) * dx + (C[i][1] - C[i - 1][1]) * dy) / span;
    if (step < -size * 0.08) back++;
  }
  return back <= C.length * 0.2;
}

// a loop: closed, round something (game/signs.js: people inside it)
export function isLoop(P) {
  const B = boxOf(P);
  const size = Math.max(B.w, B.h);
  const gap = Math.hypot(P[P.length - 1][0] - P[0][0], P[P.length - 1][1] - P[0][1]);
  const L = pathLen(P);
  return size >= 30 && gap <= size * 0.35 && L >= size * 2.2 && L <= size * 5;
}

// an X: two straight slanting lines of about the same length crossing near their middles:
// { x, y, size } | null
export function xOf(A, Bs) {
  if (straightness(A) < 0.85 || straightness(Bs) < 0.85) return null;
  const a0 = A[0];
  const a1 = A[A.length - 1];
  const b0 = Bs[0];
  const b1 = Bs[Bs.length - 1];
  const la = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
  const lb = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
  if (la < 24 || lb < 24 || Math.max(la, lb) / Math.min(la, lb) > 2.4) return null;
  const c = cross(a0, a1, b0, b1);
  if (!c || c.t < 0.2 || c.t > 0.8 || c.u < 0.2 || c.u > 0.8) return null;
  const ang = Math.abs(Math.atan2(a1[1] - a0[1], a1[0] - a0[0]) - Math.atan2(b1[1] - b0[1], b1[0] - b0[0])) % Math.PI;
  if (ang < 0.6 || ang > Math.PI - 0.6) return null;
  // (each a slant, as an X is drawn: not a body across and wings up and down)
  const slant = (dx, dy) => Math.atan2(Math.abs(dy), Math.abs(dx));
  for (const s of [slant(a1[0] - a0[0], a1[1] - a0[1]), slant(b1[0] - b0[0], b1[1] - b0[1])]) if (s < 0.33 || s > 1.24) return null;
  return { x: c.x, y: c.y, size: Math.max(la, lb) };
}
