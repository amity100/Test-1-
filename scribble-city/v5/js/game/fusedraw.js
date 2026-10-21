import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { inflateShape, cornerness } from './inflate.js';
import { shapeOf } from './fusemark.js';
import { hull } from './drawncar.js';
import { boxOf } from './signshape.js';
import { clamp } from '../core/util.js';

// (ROADMAP 11.22) Drawn onto the car you drive the way you would draw on it: what you draw is the
// part - your own lines, where you drew them, made solid - and what it does is what such a thing
// does where you put it. Wings out of its side, a wheel where a wheel goes, a rotor on its roof, a
// flame out of its back, a cannon, a balloon over it, floats along its sill... and anything else
// you draw out of it is yours too, just as drawn. Nothing to learn by heart: no sign to make.
//
// A drawing is a few lines (game/fuse.js capture: each point's ray in the car's frame then, and
// its paint where it met it). It is read here (readDrawing) and made (buildDrawn): its lines go
// onto a plane in the car's frame that suits the part - flat for a wing, upright along it for a
// flame, its side for a wheel - each point where its ray meets that plane, so from where you drew it
// it is exactly what you drew; then moulded from its outline (game/inflate.js), its lines inked on
// it as drawn.

// the planes a drawing goes onto: through the car's frame, square to one of its axes (n), with two
// ways along it (e1, e2) - n, e2, e1 a right-handed frame, the way game/inflate.js makes its shapes
// (across x; its outline z, y)
export const AX = {
  x: { n: [1, 0, 0], e1: [0, 0, 1], e2: [0, 1, 0] },
  y: { n: [0, 1, 0], e1: [0, 0, 1], e2: [-1, 0, 0] },
  z: { n: [0, 0, 1], e1: [-1, 0, 0], e2: [0, 1, 0] },
};

// what each one is, what it does - one line (the tag, game/fuse.js)
export const DRAWN = {
  wing: 'כנפיים',
  wheel: 'גלגלים',
  rotor: 'רוטור',
  jet: 'רקטה',
  spring: 'קפיץ',
  barrel: 'תותח',
  blade: 'להב',
  balloon: 'בלון',
  magnet: 'מגנט',
  star: 'כוכב',
  bolt: 'ברק',
  smoke: 'עשן',
  chute: 'מצנח',
  float: 'מצופים',
  deco3: 'קישוט',
};

// what a drawing there could be instead (its tag's "or else": the first is what it was read as)
const ALTS = {
  side: ['wing', 'wheel', 'barrel', 'jet', 'float', 'deco3'],
  top: ['rotor', 'balloon', 'chute', 'barrel', 'wing', 'star', 'bolt', 'deco3'],
  back: ['jet', 'smoke', 'barrel', 'magnet', 'deco3'],
  front: ['blade', 'barrel', 'magnet', 'spring', 'jet', 'deco3'],
  bottom: ['spring', 'float', 'wheel', 'jet', 'deco3'],
};

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const r3 = (q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000, Math.round(q[2] * 1000) / 1000];
const r2 = (q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000];

const _pv = new THREE.Vector3();
// the car's frame onto the screen as it was when the line was drawn (cap.cam)
function projector(cam) {
  const V = new THREE.Matrix4().fromArray(cam.v);
  const P = new THREE.Matrix4().fromArray(cam.p);
  return (q) => {
    _pv.set(q[0], q[1], q[2]).applyMatrix4(V).applyMatrix4(P);
    return [((_pv.x + 1) / 2) * cam.W, ((1 - _pv.y) / 2) * cam.H];
  };
}

// where a point's ray meets the plane (axis ax, at c along it) - [x, y, z] or null
export function onPlane(q, ax, c) {
  const n = AX[ax].n;
  const dn = dot(q.d, n);
  if (Math.abs(dn) < 0.03) return null;
  const t = (c - dot(q.o, n)) / dn;
  if (!(t > 0) || t > 400) return null;
  return [q.o[0] + q.d[0] * t, q.o[1] + q.d[1] * t, q.o[2] + q.d[2] * t];
}

// the plane's own coordinates of a point in the car's frame, and back
export const toUV = (X, ax) => [dot(X, AX[ax].e1), dot(X, AX[ax].e2)];
export function toXYZ(uv, ax, c) {
  const { n, e1, e2 } = AX[ax];
  return [n[0] * c + e1[0] * uv[0] + e2[0] * uv[1], n[1] * c + e1[1] * uv[0] + e2[1] * uv[1], n[2] * c + e1[2] * uv[0] + e2[2] * uv[1]];
}

// does any line of the drawing cross another (an X, a +: a rotor's blades)
function crossing(caps) {
  const seg = (a, b, c, d) => {
    const s = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    return s(a, b, c) * s(a, b, d) < 0 && s(c, d, a) * s(c, d, b) < 0;
  };
  for (let i = 0; i < caps.length; i++) {
    for (let j = i + 1; j < caps.length; j++) {
      const A = caps[i].P;
      const B = caps[j].P;
      for (let a = 1; a < A.length; a++) for (let b = 1; b < B.length; b++) if (seg(A[a - 1], A[a], B[b - 1], B[b])) return true;
    }
  }
  return false;
}

// two long lines side by side, the same way (a barrel drawn as its two sides)
function parallelPair(caps) {
  if (caps.length < 2) return false;
  const dir = (P) => {
    const a = P[0];
    const b = P[P.length - 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, l];
  };
  const [ax, ay, al] = dir(caps[0].P);
  const [bx, by, bl] = dir(caps[1].P);
  return Math.abs(ax * bx + ay * by) > 0.93 && Math.min(al, bl) > Math.max(al, bl) * 0.55;
}

// a U: deep, its arms straight, back the way it came
function isU(S) {
  const turn = Math.abs(S.T.signed);
  return !S.closed && turn > 2.3 && turn < 4.3 && S.depth > S.gap * 0.7 && S.gap > S.size * 0.22 && S.armA > 0.86 && S.armB > 0.86 && S.nx === 0;
}

// a dome: an arch with its feet down (its middle the highest on the screen), or one closed over a
// flat foot
function isDome(S) {
  const P = S.P;
  const B = S.B;
  if (!S.closed) {
    const turn = Math.abs(S.T.signed);
    const a = P[0];
    const b = P[P.length - 1];
    return turn > 1.6 && turn < 4.4 && a[1] > B.y0 + B.h * 0.6 && b[1] > B.y0 + B.h * 0.6 && B.w > B.h * 0.9;
  }
  return S.fill > 0.5 && S.fill < 0.85 && B.w > B.h * 1.3 && S.fit.err > 0.15;
}

// a line as it is on the car's side (the plane x = c): its shape there, in metres - round? where its
// middle is (cy, cz) - or null
function sideShape(cap, c) {
  const P = [];
  for (const q of cap.pts) {
    const X = onPlane(q, 'x', c);
    if (X) P.push([X[2] * 200, -X[1] * 200]);
  }
  if (P.length < 8) return null;
  const S = shapeOf(P);
  const B = boxOf(P);
  return { round: S.closed && S.fit.err < 0.3 && S.fit.cover > 0.7 && S.aspect < 1.6, cz: B.cx / 200, cy: -B.cy / 200, r: Math.max(B.w, B.h) / 400 };
}

// a closed line made into a band round an open one (its thickness h): a blade, a plank
function band(L, h) {
  if (L.length < 2) return null;
  const left = [];
  const right = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[Math.max(0, i - 1)];
    const b = L[Math.min(L.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const k = h * (i === 0 || i === L.length - 1 ? 0.7 : 1);
    left.push([L[i][0] - (dy / l) * k, L[i][1] + (dx / l) * k]);
    right.push([L[i][0] + (dy / l) * k, L[i][1] - (dx / l) * k]);
  }
  return left.concat(right.reverse());
}

// at most n points along a line (its corners kept well enough)
function thinTo(L, n) {
  if (L.length <= n) return L;
  const out = [];
  for (let i = 0; i < n; i++) out.push(L[Math.round((i * (L.length - 1)) / (n - 1))]);
  return out;
}

function areaOf(o) {
  let a = 0;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) a += o[j][0] * o[i][1] - o[i][0] * o[j][1];
  return Math.abs(a / 2);
}

// ------------------------------------------------------------------ reading it
// caps: the drawing's lines (game/fuse.js capture), ctx: { D (half length, half width, height),
// K (a city car's kind, or null), r0 (its wheels' radius), spots (its wheels, [{x, z}]) }, force:
// a part to read it as (its tag's "or else"), or 'ink'. Returns { kind: 'ink' } - all of it on the
// car's paint: ink on it - or { kind: 'part', type, v, n, at, dir, shape, face, alts, name } - or null.
// force 'part': what it would be as a part, though it is all on its paint
export function readDrawing(caps, ctx, force = null) {
  const asPart = force === 'part';
  if (asPart) force = null;
  const all = [];
  for (const c of caps) for (const q of c.pts) all.push(q);
  if (all.length < 3) return null;
  const D = ctx.D;
  const K = ctx.K;
  const roof = K ? K.roofY : D.h;
  const clear = K ? K.clear : 0.25;
  const pr = projector(caps[caps.length - 1].cam);
  const on = all.filter((q) => q.k);
  const off = all.filter((q) => !q.k);
  const onFrac = on.length / all.length;
  // the drawing on the screen: its longest line's shape, and all of it
  let main = caps[0];
  for (const c of caps) if (c.len > main.len) main = c;
  const S = shapeOf(main.P);
  const round = S.closed && S.fit.err < 0.26 && S.fit.cover > 0.7 && S.aspect < 1.7;
  // (over a wheel of its own, round there - on its side, in metres, not as the camera sees it: a
  // wheel of yours instead, though it is all on its paint)
  const sd0 = Math.sign(main.pts[0].o[0]) || 1;
  const SW = sideShape(main, sd0 * D.hw);
  const overWheel = !!SW && SW.round && SW.cy < ctx.r0 * 2.2 && ctx.spots.some((s) => Math.abs(SW.cz - s.z) < ctx.r0 * 1.8 && Math.sign(s.x) === sd0);
  if (force === 'ink' || (!force && !asPart && onFrac >= 0.85 && !overWheel)) return { kind: 'ink' };
  // ---- where it meets the car, and which of its faces it comes out of
  const sc = (L) => {
    let x = 0;
    let y = 0;
    for (const q of L) {
      x += q.s[0];
      y += q.s[1];
    }
    return [x / L.length, y / L.length];
  };
  const oc = sc(off.length ? off : all);
  let A = null;
  let AN = null;
  if (on.length) {
    let best = Infinity;
    for (const q of on) {
      const d = Math.hypot(q.s[0] - oc[0], q.s[1] - oc[1]);
      if (d < best) {
        best = d;
        A = q.k.p.slice();
        AN = q.k.n;
      }
    }
  }
  const floating = !A;
  if (floating) {
    // (not touching it: by the face of it nearest on the screen - over its roof most of all)
    const faces = [
      [[0, roof, 0], [0, 1, 0]],
      [[D.hw, D.h * 0.5, 0], [1, 0, 0]],
      [[-D.hw, D.h * 0.5, 0], [-1, 0, 0]],
      [[0, D.h * 0.5, D.hl], [0, 0, 1]],
      [[0, D.h * 0.5, -D.hl], [0, 0, -1]],
    ];
    let best = Infinity;
    for (const [p, n] of faces) {
      const s = pr(p);
      const d = Math.hypot(s[0] - oc[0], s[1] - oc[1]) * (n[1] > 0 ? 0.8 : 1);
      if (d < best) {
        best = d;
        A = p.slice();
        AN = n;
      }
    }
    if (AN[1] > 0) {
      // (over its roof: the roof under it)
      const ys = off.map((q) => onPlane(q, 'x', 0)).filter(Boolean);
      if (ys.length) A[2] = clamp(ys.reduce((s, X) => s + X[2], 0) / ys.length, -D.hl * 0.45, D.hl * 0.45);
    }
  }
  // the face: the way out of it on the screen most like the way the drawing goes from where it meets
  // it (that face of it most of all)
  const a0 = pr(A);
  const dx = oc[0] - a0[0];
  const dy = oc[1] - a0[1];
  const dl = Math.hypot(dx, dy) || 1;
  const nAxis = Math.abs(AN[1]) > 0.6 ? 'top' : Math.abs(AN[0]) >= Math.abs(AN[2]) ? 'side' : AN[2] > 0 ? 'front' : 'back';
  const cand = [
    ['side', [Math.sign(A[0]) || 1, 0, 0]],
    ['top', [0, 1, 0]],
    ['front', [0, 0, 1]],
    ['back', [0, 0, -1]],
  ];
  if (A[1] < clear + 0.35) cand.push(['bottom', [0, -1, 0]]);
  let face = nAxis;
  if (off.length && dl > 6) {
    let bs = -Infinity;
    for (const [f, n] of cand) {
      const b = pr([A[0] + n[0] * 0.6, A[1] + n[1] * 0.6, A[2] + n[2] * 0.6]);
      const fx = b[0] - a0[0];
      const fy = b[1] - a0[1];
      const fl = Math.hypot(fx, fy);
      if (fl < 4) continue;
      const s = (fx * dx + fy * dy) / (fl * dl) + (f === nAxis ? 0.45 : 0);
      if (s > bs) {
        bs = s;
        face = f;
      }
    }
  }
  if (overWheel) face = 'side';
  // ---- what it is: what it looks like, where it is
  const teethy = S.teeth >= 3 || S.teethL >= 3;
  const coily = S.coils >= 1.2;
  const tubey = parallelPair(caps) || (S.closed && S.aspect >= 3.2 && caps.length <= 2) || (!S.closed && caps.length === 1 && S.straight > 0.92);
  const crossed = crossing(caps);
  // (a star: closed, with many points or crossing itself; a bolt: a Z, two sharp turns)
  const starry = S.closed && !round && (S.nx >= 4 || S.nc >= 8);
  const zed = !S.closed && caps.length === 1 && S.nc === 2 && S.teeth <= 2 && S.straight < 0.8;
  let type = force;
  if (!type) {
    if (overWheel) type = 'wheel';
    else if (starry && face !== 'bottom') type = 'star';
    else if (zed && face === 'top') type = 'bolt';
    else if (face === 'side') {
      // (as a wing would be - flat, at its waist: out from it, or along it? Along it and low, floats)
      const sd = Math.sign(A[0]) || 1;
      let out = 0;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (const q of all) {
        const X = onPlane(q, 'y', clamp(A[1], 0.2, roof));
        if (!X) continue;
        out = Math.max(out, X[0] * sd - D.hw);
        z0 = Math.min(z0, X[2]);
        z1 = Math.max(z1, X[2]);
      }
      const along = z1 - z0 > 1.5 && z1 - z0 > out * 2.2;
      const SS = SW && Math.sign(sd0) === sd ? SW : sideShape(main, sd * D.hw);
      const low = SS ? SS.cy < Math.max(clear + 0.3, D.h * 0.36) : A[1] < D.h * 0.4;
      if (SS && SS.round && SS.cy < D.h * 0.5) type = 'wheel';
      else if (along && low) type = 'float';
      else if (!S.closed && caps.length === 1 && (teethy || coily)) type = 'deco3';
      else type = 'wing';
    } else if (face === 'top') {
      if (isDome(S)) type = 'chute';
      else if (round) type = 'balloon';
      else if (crossed) type = 'rotor';
      else if (parallelPair(caps)) type = 'barrel';
      else if (!S.closed && caps.length <= 2 && S.straight > 0.85 && !floating && S.B.w > S.B.h * 1.6) type = 'rotor';
      else if (tubey) type = 'barrel';
      else if (A[2] < -D.hl * 0.35 && S.B.w > S.B.h * 1.5) type = 'wing';
      else type = 'deco3';
    } else if (face === 'back') {
      if (isU(S)) type = 'magnet';
      else if (coily || (round && S.bumps >= 5)) type = 'smoke';
      else if (teethy || tubey || S.closed || caps.length > 1) type = 'jet';
      else type = 'deco3';
    } else if (face === 'front') {
      if (isU(S)) type = 'magnet';
      else if (coily) type = 'spring';
      else if (tubey) type = 'barrel';
      else if (teethy || S.closed || S.nc >= 1) type = 'blade';
      else type = 'deco3';
    } else {
      if (coily || (teethy && Math.abs(S.A.uy) > 0.6)) type = 'spring';
      else if (round) type = 'wheel';
      else if (S.aspect >= 2 || caps.length > 1) type = 'float';
      else type = 'deco3';
    }
  }
  const part = makePart(type, caps, ctx, { A, face, S, round, floating, main });
  if (!part) return null;
  const alts = (ALTS[face] || ALTS.side).filter((a) => a !== type).slice(0, 3);
  return { kind: 'part', ...part, face, alts, name: DRAWN[type] };
}

// ------------------------------------------------------------------ what its shape does (ROADMAP 11.23)
// floats: how much of the car they hold up (1: all of it) - long and thick enough for its weight
export function floatK(n, mass) {
  return (clamp(n.len || 3.6, 1, 6) * clamp(n.w || 0.45, 0.2, 0.8) * 0.85) / (mass || 1.25);
}

// (ROADMAP 11.24) wings: how much of a fall they glide away (v.glide) - the bigger, the more
export function wingGlide(n) {
  const area = clamp((n.span || 1) * (n.chord || 0.5), 0.2, 6);
  return clamp(0.32 + area * 0.16, 0.35, 0.86);
}

// (ROADMAP 11.26) wings lift it off: how fast it must go for them to hold it up (m/s) - two of them,
// span by chord each; the bigger for its weight, the slower
export function takeoffOf(n, mass) {
  const area = 2 * clamp(n.span || 1, 0.2, 4) * clamp(n.chord || 0.5, 0.2, 2);
  return Math.sqrt(((mass || 1.25) * 610) / area);
}
// (it lifts off them only if it can go that fast: this much of its top speed at most)
export const WING_TOP = 0.92;

// a rotor: how much of the car it lifts (1: all of it) - as wide as the car, about, it flies
export function rotorLift(n, mass) {
  const span = clamp(n.span || 2, 0.6, 9);
  return clamp((span * span * 0.42) / (mass || 1), 0.15, 3);
}

// (ROADMAP 11.24, game/partpen.js) a part said and drawn: its lines already on its plane (uvLines, in
// metres), where it goes on the car (A, face) - made as any drawn part is. Returns as readDrawing
export function partOf(type, uvLines, ctx, A, face, plane) {
  uvLines = uvLines.filter((L) => L.length >= 2);
  if (!uvLines.length) return null;
  const flat = (L) => L.map(([u, w]) => [u * 200, -w * 200]);
  let main = uvLines[0];
  for (const L of uvLines) if (L.length > main.length) main = L;
  const S = shapeOf(flat(main));
  const round = S.closed && S.fit.err < 0.26 && S.fit.cover > 0.7 && S.aspect < 1.7;
  const closed = uvLines.map((L) => shapeOf(flat(L)).closed);
  // (its outline, not closed: all of what was drawn - two lines, its top and its bottom, a float)
  const fill = type === 'wing' || type === 'float';
  const part = makePart(type, [], ctx, { A: A.slice(), face, S, round, floating: false, plane, uvLines, closed, fill });
  return part ? { kind: 'part', ...part, face, alts: [], name: DRAWN[type] } : null;
}

// ------------------------------------------------------------------ making it
// the drawing as that part: its plane, its outline(s), its lines, its numbers - { type, v, n, at,
// dir, shape }
function makePart(type, caps, ctx, o) {
  const { A, face, S, round } = o;
  const D = ctx.D;
  const K = ctx.K;
  const roof = K ? K.roofY : D.h;
  const side = Math.sign(A[0]) || 1;
  // ---- its plane: what suits it
  let ax = 'x';
  let c = 0;
  if (type === 'wing' && face !== 'top') {
    ax = 'y';
    c = clamp(A[1], 0.2, roof);
  } else if (type === 'wing') {
    // (a wing over its tail: a spoiler - its side view, across the car)
    ax = 'x';
    c = 0;
  } else if (type === 'blade') {
    ax = face === 'side' ? 'x' : 'y';
    c = face === 'side' ? side * D.hw : clamp(A[1], 0.15, roof);
  } else if (type === 'rotor') {
    ax = 'y';
    c = Math.max(A[1], roof) + 0.3;
  } else if (type === 'wheel') {
    ax = 'x';
    c = side * D.hw;
  } else if (type === 'float') {
    ax = 'x';
    c = side * (D.hw + 0.12);
  } else if (type === 'jet' || type === 'smoke' || type === 'spring' || type === 'magnet') {
    ax = face === 'side' ? 'y' : 'x';
    c = face === 'side' ? A[1] : clamp(A[0], -D.hw * 0.8, D.hw * 0.8);
  } else if (type === 'barrel') {
    ax = face === 'side' ? 'y' : 'x';
    c = face === 'side' ? A[1] : clamp(A[0], -D.hw * 0.8, D.hw * 0.8);
  } else if (type === 'chute') {
    ax = 'z';
    c = A[2];
  } else if (!o.plane) {
    // (a balloon, a star, anything else: square to the eye as it was drawn - from there exactly what
    // was drawn - through where it meets the car)
    const v = caps[caps.length - 1].view;
    const k = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
    ax = k[0] >= k[1] && k[0] >= k[2] ? 'x' : k[1] >= k[2] ? 'y' : 'z';
    c = A[ax === 'x' ? 0 : ax === 'y' ? 1 : 2];
  }
  // (ROADMAP 11.23: drawn on a sheet - its plane is the sheet's, the lines on it already)
  if (o.plane) {
    ax = o.plane.ax;
    c = o.plane.c;
  }
  // ---- its lines on that plane (a point whose ray misses it: where it met the car, else left out)
  const lines = [];
  const closedL = [];
  if (o.uvLines) {
    o.uvLines.forEach((L, i) => {
      if (L.length < 2) return;
      lines.push(L);
      if (o.closed[i] && L.length >= 4) closedL.push(L);
    });
  }
  for (const cap of o.uvLines ? [] : caps) {
    const L = [];
    for (const q of cap.pts) {
      const X = onPlane(q, ax, c) || (q.k ? q.k.p : null);
      if (!X) continue;
      // (not out past all reason: a ray nearly along the plane)
      if (Math.abs(X[0]) > 9 || X[1] < -1 || X[1] > 9 || Math.abs(X[2]) > 12) continue;
      L.push(toUV(X, ax));
    }
    if (L.length < 2) continue;
    lines.push(L);
    if (shapeOf(cap.P).closed && L.length >= 4) closedL.push(L);
  }
  if (!lines.length) return null;
  let allUV = [];
  for (const L of lines) allUV = allUV.concat(L);
  // (the extent of it along the plane, and its long way)
  const bx = boxOf(allUV);
  const longM = Math.max(bx.w, bx.h);
  const shortM = Math.min(bx.w, bx.h);
  // ---- its outline(s): the biggest closed line; else round all of it if it has a breadth, else a band
  // round its line
  let outlines = [];
  let rods = [];
  let rodR = 0.04;
  if (type === 'barrel' || type === 'spring' || type === 'magnet') {
    rods = lines.slice(0, 3);
    rodR = type === 'spring' ? 0.045 : type === 'magnet' ? 0.07 : 0.06;
  } else if (type === 'rotor') {
    // (each line a blade; a closed one as drawn)
    for (const L of lines) {
      const closed = closedL.includes(L);
      const ol = closed ? L : band(L, 0.09);
      if (ol) outlines.push(ol);
    }
  } else if (type === 'chute' && !closedL.length) {
    // (its canopy: the arch as drawn, a thin sheet across it)
    let longest = lines[0];
    for (const L of lines) if (L.length > longest.length) longest = L;
    const ol = band(longest, 0.07);
    if (ol) outlines = [ol];
  } else if (closedL.length) {
    let best = closedL[0];
    for (const L of closedL) if (areaOf(L) > areaOf(best)) best = L;
    outlines = [best];
  } else if (shortM >= longM * (o.fill ? 0.08 : 0.28) && allUV.length >= 8) {
    outlines = [hull(allUV)];
  } else if (type === 'deco3' || type === 'star' || type === 'bolt') {
    rods = lines.slice(0, 6);
    rodR = 0.035;
  } else {
    let longest = lines[0];
    for (const L of lines) if (L.length > longest.length) longest = L;
    const ol = band(longest, type === 'wing' ? 0.2 : type === 'blade' ? 0.1 : 0.14);
    if (ol) outlines = [ol];
  }
  outlines = outlines.map((ol) => thinTo(ol, 120).map(r2));
  rods = rods.map((L) => thinTo(L, 48).map(r2));
  const shapeLines = lines.map((L) => thinTo(L, 64).map(r2));
  // ---- its numbers, from it in metres
  const P3 = allUV.map((uv) => toXYZ(uv, ax, c));
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const X of P3) {
    x0 = Math.min(x0, X[0]);
    x1 = Math.max(x1, X[0]);
    y0 = Math.min(y0, X[1]);
    y1 = Math.max(y1, X[1]);
    z0 = Math.min(z0, X[2]);
    z1 = Math.max(z1, X[2]);
  }
  const far = P3.reduce((b, X) => (Math.hypot(X[0] - A[0], X[1] - A[1], X[2] - A[2]) > Math.hypot(b[0] - A[0], b[1] - A[1], b[2] - A[2]) ? X : b), A);
  const reach = Math.hypot(far[0] - A[0], far[1] - A[1], far[2] - A[2]);
  const shape = { ax, c: Math.round(c * 1000) / 1000, outlines, rods, rodR, lines: shapeLines };
  let v = 'drawn';
  const n = {};
  let at = r3(A);
  let dir = null;
  const r0 = ctx.r0 || 0.34;
  if (type === 'wing') {
    if (face === 'top') {
      v = 'spoiler';
      n.span = D.hw * 2;
      shape.W = clamp(D.hw * 1.7, 1, 2.4);
    } else {
      v = 'wing';
      n.span = clamp(Math.max(Math.abs(x0), Math.abs(x1)) - D.hw, 0.25, 4);
      n.chord = clamp(z1 - z0, 0.25, 2);
      shape.W = clamp(n.chord * 0.12, 0.05, 0.14);
      shape.mirror = true;
    }
  } else if (type === 'wheel') {
    // (round about its middle: a wheel's size and its look)
    const ol = outlines[0] || hull(allUV);
    let mu = 0;
    let mv = 0;
    for (const [u, w] of ol) {
      mu += u;
      mv += w;
    }
    mu /= ol.length;
    mv /= ol.length;
    let rr = 0;
    for (const [u, w] of ol) rr += Math.hypot(u - mu, w - mv);
    rr = clamp(rr / ol.length, r0 * 0.55, r0 * 2.6);
    n.r = rr;
    n.bumps = S.bumps || 0;
    v = S.nc >= 3 && S.nc <= 5 && S.fill > 0.72 ? 'square' : S.bumps >= 5 ? 'teeth' : 'round';
    if (v !== 'square' && rr >= r0 * 1.45) v = v === 'teeth' ? 'bigteeth' : 'big';
    else if (v === 'round' && rr <= r0 * 0.7) v = 'small';
    // (the wheel itself: its outline and its lines about its own middle, in metres)
    const k = 1;
    shape.wheel = ol.map(([u, w]) => r2([(u - mu) * k, (w - mv) * k]));
    shape.spokes = shapeLines.filter((L) => L !== ol).map((L) => L.map(([u, w]) => r2([u - mu, w - mv])));
    shape.W = clamp(rr * 0.7, 0.2, 0.42);
  } else if (type === 'rotor') {
    const pu = allUV.reduce((s, q) => s + q[0], 0) / allUV.length;
    const pv = allUV.reduce((s, q) => s + q[1], 0) / allUV.length;
    shape.pivot = r2([pu, pv]);
    let span = 0;
    for (const [u, w] of allUV) span = Math.max(span, Math.hypot(u - pu, w - pv));
    n.span = clamp(span * 2, 0.8, 9);
    shape.W = 0.05;
    shape.mast = r3(A);
    v = 'top';
  } else if (type === 'jet') {
    n.len = clamp(reach, 0.4, 3);
    shape.W = clamp(shortM * 0.55, 0.18, 0.7);
    v = face === 'front' ? 'front' : face === 'bottom' ? 'under' : 'back';
  } else if (type === 'barrel') {
    n.len = clamp(reach, 0.5, 3.2);
    n.r = clamp(shortM * 0.5, 0.05, 0.22);
    n.thick = n.r >= 0.11;
    shape.far = r3(far);
    shape.rodR = n.r;
    dir = [(far[0] - A[0]) / (reach || 1), (far[1] - A[1]) / (reach || 1), (far[2] - A[2]) / (reach || 1)];
    v = face === 'top' ? 'turret' : dir[2] < 0 ? 'rear' : 'front';
  } else if (type === 'spring') {
    n.coils = Math.max(2, Math.round(S.coils || 3));
    n.len = clamp(longM, 0.3, 1.6);
    v = face === 'front' ? 'bumper' : 'under';
  } else if (type === 'blade') {
    n.len = clamp(reach, 0.3, 2.5);
    n.curve = 0;
    shape.W = 0.06;
    v = face === 'back' ? 'rear' : face === 'side' ? 'side' : 'ram';
  } else if (type === 'balloon') {
    n.d = clamp(longM, 0.6, 6);
    shape.W = clamp(n.d * 0.85, 0.4, 5);
    v = 'top';
    shape.string = r3([clamp(A[0], -D.hw * 0.5, D.hw * 0.5), roof, A[2]]);
  } else if (type === 'chute') {
    n.span = clamp(bx.w, 1.4, 8);
    shape.W = clamp(n.span * 0.55, 0.8, 4);
    shape.string = r3([clamp(A[0], -D.hw * 0.5, D.hw * 0.5), roof, A[2]]);
    v = 'top';
  } else if (type === 'float') {
    n.len = clamp(z1 - z0, 1, 6);
    shape.W = clamp(shortM * 0.9, 0.25, 0.6);
    shape.mirror = true;
    v = 'pontoon';
  } else if (type === 'magnet') {
    n.size = clamp(longM, 0.4, 1.6);
    v = face === 'back' ? 'back' : 'front';
  } else if (type === 'smoke') {
    shape.W = clamp(shortM * 0.6, 0.25, 1);
    v = 'back';
  } else if (type === 'star') {
    n.size = clamp(longM, 0.5, 2);
    shape.W = 0.12;
    v = 'top';
  } else if (type === 'bolt') {
    n.size = clamp(longM, 0.5, 2);
    shape.W = 0.08;
    v = 'coil';
  } else {
    shape.W = 0.08;
    v = 'deco';
  }
  if (!shape.W) shape.W = 0.1;
  // (ROADMAP 11.23: what any shape does comes of its size - its area flat, its length)
  const ol0 = outlines[0];
  n.area = Math.round((ol0 ? areaOf(ol0) : longM * Math.max(0.05, shortM * 0.3)) * 100) / 100;
  n.long = Math.round(longM * 100) / 100;
  if (type === 'float') n.w = Math.round(shape.W * 100) / 100;
  // (how big it is, for its ink: game/fuse.js run)
  const sizeM = longM;
  return { type, v, n, at, dir, shape, sizeM };
}

// ------------------------------------------------------------------ the model
// a geometry mirrored across x, its faces still facing out (its normals with it)
function flipX(g) {
  g.scale(-1, 1, 1);
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    const k = a.itemSize;
    for (let i = 0; i + 2 < a.count; i += 3) {
      for (let j = 0; j < k; j++) {
        const t = a.array[(i + 1) * k + j];
        a.array[(i + 1) * k + j] = a.array[(i + 2) * k + j];
        a.array[(i + 2) * k + j] = t;
      }
    }
  }
}

// the middle of a part's drawing, in the car's frame
function middleOf(sh) {
  const P3 = [];
  const from = sh.outlines.length ? sh.outlines : sh.rods.length ? sh.rods : sh.lines;
  for (const L of from) for (const q of L) P3.push(toXYZ(q, sh.ax, sh.c));
  if (!P3.length) return [0, 0, 0];
  return [0, 1, 2].map((i) => P3.reduce((s, q) => s + q[i], 0) / P3.length);
}

// the part as drawn, in the car's frame: [{ m, role, side }] - each m's userData.lines (in
// userData.lineNode's frame) the drawing's own lines, inked on it each frame (game/fuse.js draw).
// ctx: { D, K, spots (its wheels), wheelR (their radius now), lift }, body: its colour (0-1)
export function buildDrawn(p, ctx, body) {
  const sh = p.shape;
  if (sh.look) return buildLook(p, body);
  const M = itemMats();
  const out = [];
  const col = linC(body[0], body[1], body[2]);
  const mat = p.type === 'barrel' || p.type === 'spring' || p.type === 'magnet' ? M.metal : M.paint;
  // (a solid from an outline on the plane: moulded round its own middle, its edges squarer for one
  // drawn with corners; its lines on both its faces, as far out as it is there)
  const mould = (Kt, ol, W, linesUV, shift) => {
    const cn = cornerness(ol);
    const B = inflateShape(ol, W, { n: 2.2 + 1.8 * cn, R: (W / 2) * (1 - 0.35 * cn), res: 48 });
    if (!B) return [];
    const { n, e1, e2 } = AX[sh.ax];
    const c = sh.c;
    const m4 = new THREE.Matrix4().makeBasis(new THREE.Vector3(...n), new THREE.Vector3(...e2), new THREE.Vector3(...e1));
    m4.setPosition(n[0] * c - shift[0], n[1] * c - shift[1], n[2] * c - shift[2]);
    B.geo.applyMatrix4(m4);
    Kt.add(mat, B.geo, col);
    const L3 = [];
    for (const L of linesUV) {
      for (const sgn of [1, -1]) {
        L3.push(
          thinTo(L, 40).map(([u, w]) => {
            const k = c + sgn * ((B.half(u, w) || 0) + 0.012);
            return [n[0] * k + e1[0] * u + e2[0] * w - shift[0], n[1] * k + e1[1] * u + e2[1] * w - shift[1], n[2] * k + e1[2] * u + e2[2] * w - shift[2]];
          }),
        );
      }
    }
    return L3;
  };
  const rod = (Kt, L3, r) => {
    if (L3.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(L3.map((q) => new THREE.Vector3(q[0], q[1], q[2])));
    Kt.add(mat, new THREE.TubeGeometry(curve, Math.max(8, L3.length * 2), r, 6, false), col);
  };
  const rel = (L, shift) => L.map((q) => {
    const X = toXYZ(q, sh.ax, sh.c);
    return [X[0] - shift[0], X[1] - shift[1], X[2] - shift[2]];
  });
  if (p.type === 'wheel') {
    // (the wheel as drawn, about its own middle, at each of its wheels - as big as it rolls)
    const W = sh.W || 0.26;
    const rr = p.n.r || 0.34;
    const R = ctx.wheelR || rr;
    for (const s of ctx.spots) {
      const Kt = new Kit();
      const B = inflateShape(sh.wheel, W, { n: 2.6, R: W * 0.4, res: 40 });
      if (!B) continue;
      Kt.add(mat, B.geo, col);
      const lines = [];
      for (const L of [sh.wheel, ...(sh.spokes || [])]) {
        for (const sgn of [1, -1]) lines.push(L.map(([u, w]) => [sgn * ((B.half(u, w) || 0) + 0.012), w, u]));
      }
      const spin = new THREE.Group();
      spin.add(Kt.build({ seed: 0.31 }));
      spin.scale.setScalar(R / rr);
      const m = new THREE.Group();
      m.add(spin);
      m.position.set(s.x + Math.sign(s.x) * (p.v === 'big' || p.v === 'bigteeth' ? R * 0.2 : 0.02), R - (ctx.lift || 0), s.z);
      Object.assign(m.userData, { spin, front: s.z > 0, lineNode: spin, lines });
      out.push({ m, role: 'wheel' });
    }
    return out;
  }
  if (p.type === 'barrel') {
    // (along the line as drawn, out of its foot - straight along +z on its turn, as a gun's barrel
    // turns after where you look)
    const A = p.at;
    const far = sh.far;
    const len = Math.hypot(far[0] - A[0], far[1] - A[1], far[2] - A[2]) || 0.6;
    const yaw0 = Math.atan2(far[0] - A[0], far[2] - A[2]);
    const pitch = Math.asin(clamp((far[1] - A[1]) / len, -0.9, 0.9));
    const r = clamp(sh.rodR || 0.07, 0.04, 0.24);
    const Kt = new Kit();
    const tip = [0, Math.sin(pitch) * len, Math.cos(pitch) * len];
    const g = new THREE.CylinderGeometry(r, r * 1.08, len, 10);
    g.rotateX(Math.PI / 2 - pitch);
    g.translate(0, tip[1] / 2, tip[2] / 2);
    Kt.add(M.metal, g, col);
    // (its foot on the car, a ring at its mouth)
    Kt.sphere(M.metal, r * 1.6, 0, 0, 0, col);
    const cap = new THREE.TorusGeometry(r * 1.15, r * 0.22, 6, 14);
    cap.rotateX(-pitch);
    cap.translate(tip[0], tip[1], tip[2]);
    Kt.add(M.metal, cap, linC(0.9, 0.91, 0.95));
    const pivot = new THREE.Group();
    pivot.rotation.y = yaw0;
    pivot.add(Kt.build({ seed: 0.89 }));
    const m = new THREE.Group();
    m.position.set(A[0], A[1], A[2]);
    m.add(pivot);
    // (its two sides as drawn: lines along it, on its top)
    const lines = [[[0, r * 1.05, 0], [tip[0], tip[1] + r * 1.05, tip[2]]]];
    Object.assign(m.userData, { pivot, muzzle: new THREE.Vector3(...tip), pivotPt: new THREE.Vector3(0, 0, 0), r, yaw0, lineNode: pivot, lines });
    out.push({ m, role: 'barrel' });
    return out;
  }
  // ---- the rest: its outline(s) moulded, its rods, its lines - round its foot or its middle - and
  // the same on its other side for a pair
  let pivot = p.at;
  if (p.type === 'rotor' && sh.pivot) pivot = toXYZ(sh.pivot, sh.ax, sh.c);
  else if (p.type === 'balloon' || p.type === 'star' || p.type === 'bolt') pivot = middleOf(sh);
  else if (p.type === 'chute' && sh.string) pivot = sh.string;
  const makeOne = (mirror) => {
    const Kt = new Kit();
    let lines = [];
    sh.outlines.forEach((ol, i) => {
      lines = lines.concat(mould(Kt, ol, sh.W || 0.1, i === 0 ? sh.lines : [ol], pivot));
    });
    for (const L of sh.rods) rod(Kt, rel(L, pivot), sh.rodR || 0.04);
    if (!sh.outlines.length) lines = lines.concat(sh.lines.map((L) => rel(L, pivot)));
    if (mirror) {
      for (const list of Kt.parts.values()) for (const it of list) flipX(it.g);
      lines = lines.map((L) => L.map((q) => [-q[0], q[1], q[2]]));
    }
    const inner = new THREE.Group();
    inner.add(Kt.build({ seed: 0.47 }));
    const m = new THREE.Group();
    m.position.set(mirror ? -pivot[0] : pivot[0], pivot[1], pivot[2]);
    m.add(inner);
    m.userData.lineNode = inner;
    m.userData.lines = lines;
    let role = 'drawn';
    if (p.type === 'rotor' || p.type === 'star') {
      m.userData.spin = inner;
      role = p.type;
    } else if (p.type === 'jet') {
      m.userData.dflame = inner;
      role = 'jet';
    } else if (p.type === 'spring') {
      m.userData.dcoil = inner;
      role = 'dspring';
    } else if (p.type === 'balloon') {
      m.userData.base = m.position.clone();
      m.userData.stringTo = sh.string ? new THREE.Vector3(...sh.string) : null;
      role = 'dballoon';
    } else if (p.type === 'chute') {
      m.userData.canopy = inner;
      role = 'dchute';
    } else if (p.type === 'magnet') role = 'magnet';
    out.push({ m, role, side: mirror ? -1 : 1 });
  };
  makeOne(false);
  if (sh.mirror) makeOne(true);
  // (the mast under a rotor: from the roof up to it)
  if (p.type === 'rotor' && sh.mast && sh.pivot) {
    const top = toXYZ(sh.pivot, sh.ax, sh.c);
    const Kt = new Kit();
    rod(Kt, [sh.mast, [(sh.mast[0] + top[0]) / 2, (sh.mast[1] + top[1]) / 2, (sh.mast[2] + top[2]) / 2], top], 0.04);
    const m = new THREE.Group();
    m.add(Kt.build({ seed: 0.6 }));
    out.push({ m, role: 'drawn', side: 1 });
  }
  return out;
}

// (ROADMAP 11.26) a thing of the part pen, as drawn (game/itemlook.js lookOf): each of its solids
// moulded on its plane, its rods, its lines inked on both faces - round its pivot; a pair for one on
// both sides. Turned, spun, folded, squeezed as its role says (game/fuse.js draw): [{ m, role, side }]
export function buildLook(p, body) {
  const sh = p.shape;
  const M = itemMats();
  const col = linC(body[0], body[1], body[2]);
  const mat = sh.metal ? M.metal : M.paint;
  const { n, e1, e2 } = AX[sh.ax];
  const c = sh.c;
  const pv = sh.pivot;
  const at3 = (u, w, k) => [n[0] * k + e1[0] * u + e2[0] * w - pv[0], n[1] * k + e1[1] * u + e2[1] * w - pv[1], n[2] * k + e1[2] * u + e2[2] * w - pv[2]];
  const out = [];
  const makeOne = (mirror) => {
    const Kt = new Kit();
    let lines = [];
    for (const s of sh.solids) {
      const cn = cornerness(s.ol);
      const B = inflateShape(s.ol, s.W, { n: 2.2 + 1.8 * cn, R: (s.W / 2) * (1 - 0.35 * cn), res: 44 });
      if (!B) continue;
      const m4 = new THREE.Matrix4().makeBasis(new THREE.Vector3(...n), new THREE.Vector3(...e2), new THREE.Vector3(...e1));
      m4.setPosition(n[0] * c - pv[0], n[1] * c - pv[1], n[2] * c - pv[2]);
      B.geo.applyMatrix4(m4);
      Kt.add(mat, B.geo, col);
      for (const L of s.ink) for (const sgn of [1, -1]) lines.push(L.map(([u, w]) => at3(u, w, c + sgn * ((B.half(u, w) || 0) + 0.012))));
    }
    for (const r of sh.rods) {
      const L3 = r.L.map(([u, w]) => at3(u, w, c));
      if (L3.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(L3.map((q) => new THREE.Vector3(q[0], q[1], q[2])));
      Kt.add(mat, new THREE.TubeGeometry(curve, Math.max(8, L3.length * 2), r.r, 6, false), col);
    }
    if (mirror) {
      for (const list of Kt.parts.values()) for (const it of list) flipX(it.g);
      lines = lines.map((L) => L.map((q) => [-q[0], q[1], q[2]]));
    }
    const inner = new THREE.Group();
    inner.add(Kt.build({ seed: 0.47 }));
    const m = new THREE.Group();
    m.position.set(mirror ? -pv[0] : pv[0], pv[1], pv[2]);
    m.add(inner);
    const ud = m.userData;
    ud.lineNode = inner;
    ud.lines = lines;
    let role = 'drawn';
    if (sh.role === 'barrel') {
      // (a gun on its turn: its muzzle at the end of it drawn to the nose)
      const mz = sh.muzzle || [pv[0], pv[1], pv[2] + 1];
      Object.assign(ud, { pivot: inner, muzzle: new THREE.Vector3(mz[0] - pv[0], mz[1] - pv[1], mz[2] - pv[2]), pivotPt: new THREE.Vector3(0, 0, 0), r: clamp(p.n.r || 0.08, 0.04, 0.24), yaw0: 0 });
      role = 'barrel';
    } else if (sh.role === 'rotor' || sh.role === 'star' || sh.role === 'prop') {
      ud.spin = inner;
      role = sh.role;
    } else if (sh.role === 'jet') {
      ud.dflame = inner;
      role = 'jet';
    } else if (sh.role === 'dspring') {
      ud.dcoil = inner;
      ud.rest = sh.rest || 1;
      inner.scale.y = ud.rest;
      role = 'dspring';
    } else if (sh.role === 'dballoon') {
      ud.base = m.position.clone();
      ud.stringTo = sh.string ? new THREE.Vector3(...sh.string) : null;
      role = 'dballoon';
    } else if (sh.role === 'dchute') {
      ud.canopy = inner;
      role = 'dchute';
    }
    out.push({ m, role, side: mirror ? -1 : 1 });
  };
  makeOne(false);
  if (sh.mirror) makeOne(true);
  // (a rotor's mast: from the roof up to it)
  if (sh.mast) {
    const Kt = new Kit();
    const a = sh.mast;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3((a[0] + pv[0]) / 2, (a[1] + pv[1]) / 2, (a[2] + pv[2]) / 2), new THREE.Vector3(pv[0], pv[1], pv[2])]);
    Kt.add(M.metal, new THREE.TubeGeometry(curve, 6, 0.045, 6, false), col);
    const m = new THREE.Group();
    m.add(Kt.build({ seed: 0.6 }));
    out.push({ m, role: 'drawn', side: 1 });
  }
  return out;
}
