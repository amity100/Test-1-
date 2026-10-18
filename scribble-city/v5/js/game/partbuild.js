import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { clamp } from '../core/util.js';
import { shapeOf, outline, spanAt, solid, tube, ribbon, thin, inPoly, shade, inkOn, colOf, helixGeometry, envelopeGeometry, hullGeometry } from './drawncar.js';

// (ROADMAP 11.10, the sample) The drawing made into a finished thing, as if the city had always
// had it: the drawing says which parts, where and how big - the game makes each part properly.
//   - the body: lofted from the outline drawn side on - at each station along it a section with
//     rounded corners, as high as drawn there, the sides leaning in towards the top, the nose and
//     the tail rounded off in plan. A car's gets its glasshouse (windows where the outline rises
//     over the bonnet), headlights, tail lights, bumpers and wheel arches; a plane's a canopy
//   - the parts: wheels with tyres, rims and spokes; a turret for each barrel (it turns after
//     where you look), a muzzle brake on it; a rotor of two or four blades on its mast, a tail
//     rotor; wings tapered and swept, thin at their tips, on hinges (they fold); a propeller, a jet
//     nozzle, fins and tail planes; a sail on its mast and boom, bellied; a parachute packed on
//     top, its canopy ready to open; a spring of steel; a blade at the front
//   - the lines drawn on it (a stripe, a door, a number) stay - on its skin, as drawn
// What game/vehicles.js needs of a model, as game/drawncar.js buildModel gives it - and more: every
// turret, the wings (to fold), the canopy (to open).

const INK = [0.07, 0.06, 0.1];
const RUBBER = [0.06, 0.06, 0.07];
const GUNMETAL = [0.3, 0.31, 0.35];
const STEEL = [0.72, 0.74, 0.79];
const GLASS = [0.16, 0.22, 0.32];

// ------------------------------------------------------------------ the body, lofted
// o: the outline drawn side on ([z, y], the model's frame). W: how wide. opt: { n (how square its
// sections), lean (its top narrower), p (its ends in plan: 2 pointed, 4 square), glass: (z, y) =>
// is this glass }. Returns { paint, glass, half(z, y), span(z) }
export function loftBody(o, W, opt = {}) {
  const n = opt.n || 3.2;
  const lean = opt.lean === undefined ? 0.14 : opt.lean;
  const p = opt.p || 3;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [z] of o) {
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const NZ = opt.NZ || 40;
  const K = opt.K || 28;
  const pos = [];
  const rows = [];
  let last = null;
  const plan = (u) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), p)), 1 / p);
  for (let i = 0; i <= NZ; i++) {
    const u = i / NZ;
    const z = z0 + (z1 - z0) * (0.002 + u * 0.996);
    const sp = spanAt(o, z) || last;
    if (!sp) continue;
    last = sp;
    const hw = Math.max(0.015, (W / 2) * (0.18 + 0.82 * plan(u)));
    const yc = (sp[0] + sp[1]) / 2;
    const b = Math.max(0.01, (sp[1] - sp[0]) / 2);
    const row = [];
    for (let k = 0; k < K; k++) {
      const th = (k / K) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      row.push(pos.length / 3);
      pos.push(hw * ex * (1 - lean * Math.max(0, ey)), yc + b * ey, z);
    }
    rows.push({ row, z, yc, b, hw, sp });
  }
  const idx = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let k = 0; k < K; k++) {
      const a = rows[i].row[k];
      const bb = rows[i].row[(k + 1) % K];
      const c = rows[i + 1].row[k];
      const d = rows[i + 1].row[(k + 1) % K];
      idx.push(a, bb, c, bb, d, c);
    }
  }
  // (its ends closed: a fan from each end's middle)
  for (const [R, dir] of [[rows[0], -1], [rows[rows.length - 1], 1]]) {
    const c = pos.length / 3;
    pos.push(0, R.yc, R.z + dir * 0.004);
    for (let k = 0; k < K; k++) {
      const a = R.row[k];
      const b = R.row[(k + 1) % K];
      if (dir < 0) idx.push(c, b, a);
      else idx.push(c, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (paint and glass: each triangle by where it is)
  const P = g.attributes.position;
  const N = g.attributes.normal;
  const out = { paint: [[], []], glass: [[], []] };
  for (let t = 0; t < idx.length; t += 3) {
    let cz = 0;
    let cy = 0;
    for (let j = 0; j < 3; j++) {
      cy += P.getY(idx[t + j]) / 3;
      cz += P.getZ(idx[t + j]) / 3;
    }
    const tgt = opt.glass && opt.glass(cz, cy) ? out.glass : out.paint;
    for (let j = 0; j < 3; j++) {
      const v = idx[t + j];
      tgt[0].push(P.getX(v), P.getY(v), P.getZ(v));
      tgt[1].push(N.getX(v), N.getY(v), N.getZ(v));
    }
  }
  g.dispose();
  const geoOf = ([pp, nn]) => {
    if (!pp.length) return null;
    const G = new THREE.BufferGeometry();
    G.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    G.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    G.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pp.length / 3) * 2), 2));
    return G;
  };
  // the station at z (interpolated)
  const at = (z) => {
    if (z <= rows[0].z) return rows[0];
    if (z >= rows[rows.length - 1].z) return rows[rows.length - 1];
    let i = 0;
    while (i + 1 < rows.length && rows[i + 1].z < z) i++;
    const A = rows[i];
    const B = rows[Math.min(rows.length - 1, i + 1)];
    const t = (z - A.z) / Math.max(1e-6, B.z - A.z);
    return { z, yc: A.yc + (B.yc - A.yc) * t, b: A.b + (B.b - A.b) * t, hw: A.hw + (B.hw - A.hw) * t };
  };
  // how far out its side is at (z, y)
  const half = (z, y) => {
    const R = at(z);
    const ey = clamp((y - R.yc) / R.b, -1, 1);
    const ex = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(ey), n)), 1 / n);
    return R.hw * ex * (1 - lean * Math.max(0, ey));
  };
  return { paint: geoOf(out.paint), glass: geoOf(out.glass), half, at, rows, z0, z1 };
}

// ------------------------------------------------------------------ a ride's body, lofted
// o: its outline drawn side on ([z, y], the model's frame, its nose +z); W: how wide. style: 'car'
// (boxy, its windows over its bonnet line, the glasshouse a little narrower than the body under
// it), 'plane' (round and pointed, a canopy on its top up front), 'copter' (round, a framed glass
// bubble for its nose), 'basket' (square). At each station along it a rounded section as high as
// drawn there - its ring laid out so that its beltline, the top of its windows and the edge of its
// roof glass are lines of the mesh: the glass has clean edges, its pillars straight.
// Returns { paint, glass, half(z, y), at(z), rows, z0, z1, plan }
const ST = {
  car: { n: 3.6, p: 5, end: 0.62, lean: 0.26 },
  plane: { n: 2.2, p: 2.2, end: 0.1, lean: 0.02 },
  copter: { n: 2.3, p: 2.4, end: 0.22, lean: 0.04 },
  basket: { n: 6, p: 10, end: 0.92, lean: 0 },
  // (ROADMAP 11.13: a drone's body - drawn square, a box with round edges; drawn round, a pod)
  drone: { n: 3.4, p: 4, end: 0.8, lean: 0.06 },
  pod: { n: 2.3, p: 2.4, end: 0.3, lean: 0.04 },
};
// (a side's ring, from its bottom: under the belt, the windows, a frame, the roof - 16 steps)
const SEG = [7, 4, 2, 3];

export function loftRide(o, W, style = 'car', hwOf = null) {
  const P = ST[style] || ST.car;
  let z0 = Infinity;
  let z1 = -Infinity;
  let lo = Infinity;
  let hi = -Infinity;
  for (const [z, y] of o) {
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  const L = z1 - z0;
  const NZ = clamp(Math.round(L / 0.1), 30, 64);
  const st = [];
  let last = null;
  for (let i = 0; i <= NZ; i++) {
    const u = i / NZ;
    const z = z0 + L * (0.002 + u * 0.996);
    const sp = spanAt(o, z) || last;
    if (!sp) continue;
    last = sp;
    st.push({ u, z, sp });
  }
  const G = glassPlan(st, style, lo, L);
  const plan = (u) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), P.p)), 1 / P.p);
  const beltY = typeof G.belt === 'number' ? G.belt : null;
  const tumble = (y, yc) => 1 - P.lean * clamp((y - (beltY === null ? yc : beltY)) / Math.max(0.05, hi - (beltY === null ? yc : beltY)), 0, 1);
  const pos = [];
  const rows = [];
  for (const s of st) {
    const hw = Math.max(0.015, hwOf ? hwOf(s.z) : (W / 2) * (P.end + (1 - P.end) * plan(s.u)));
    const yc = (s.sp[0] + s.sp[1]) / 2;
    const b = Math.max(0.01, (s.sp[1] - s.sp[0]) / 2);
    const th = ringAngles(levels(G, style, yc, b, s.sp[1]), yc, b, P.n);
    const row = [];
    for (let k = 0; k < 32; k++) {
      const t = k <= 16 ? th[k] : Math.PI - th[32 - k];
      const c = Math.cos(t);
      const sn = Math.sin(t);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / P.n);
      const ey = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / P.n);
      const y = yc + b * ey;
      row.push(pos.length / 3);
      pos.push(hw * ex * tumble(y, yc), y, s.z);
    }
    rows.push({ row, z: s.z, yc, b, hw, sp: s.sp });
  }
  // the quads, each paint or glass as a whole (k: from k to k + 1 round the ring)
  const inR = (z, R) => R.some(([a, b]) => z >= a && z <= b);
  const glassQ = (k, z) => {
    const side = (k >= 7 && k <= 10) || (k >= 21 && k <= 24);
    const frame = (k >= 11 && k <= 12) || (k >= 19 && k <= 20);
    const top = k >= 13 && k <= 18;
    if (style === 'plane') return (top || frame) && inR(z, G.top);
    if (style === 'copter') return (side || top) && inR(z, G.top);
    return (side && inR(z, G.side)) || (top && inR(z, G.top));
  };
  const idx = [];
  const isG = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const zm = (rows[i].z + rows[i + 1].z) / 2;
    for (let k = 0; k < 32; k++) {
      const a = rows[i].row[k];
      const bb = rows[i].row[(k + 1) % 32];
      const c = rows[i + 1].row[k];
      const d = rows[i + 1].row[(k + 1) % 32];
      idx.push(a, bb, c, bb, d, c);
      const g = glassQ(k, zm);
      isG.push(g, g);
    }
  }
  // (its ends closed: a fan from each end's middle)
  for (const [R, dir] of [[rows[0], -1], [rows[rows.length - 1], 1]]) {
    const c = pos.length / 3;
    pos.push(0, R.yc, R.z + dir * 0.004);
    for (let k = 0; k < 32; k++) {
      const a = R.row[k];
      const b = R.row[(k + 1) % 32];
      if (dir < 0) idx.push(c, b, a);
      else idx.push(c, a, b);
      isG.push(false);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const Pa = g.attributes.position;
  const Na = g.attributes.normal;
  const out = { paint: [[], []], glass: [[], []] };
  for (let t = 0; t < idx.length; t += 3) {
    const tgt = isG[t / 3] ? out.glass : out.paint;
    for (let j = 0; j < 3; j++) {
      const v = idx[t + j];
      tgt[0].push(Pa.getX(v), Pa.getY(v), Pa.getZ(v));
      tgt[1].push(Na.getX(v), Na.getY(v), Na.getZ(v));
    }
  }
  g.dispose();
  const geoOf = ([pp, nn]) => {
    if (!pp.length) return null;
    const G2 = new THREE.BufferGeometry();
    G2.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    G2.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    G2.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pp.length / 3) * 2), 2));
    return G2;
  };
  const at = (z) => {
    if (z <= rows[0].z) return rows[0];
    if (z >= rows[rows.length - 1].z) return rows[rows.length - 1];
    let i = 0;
    while (i + 1 < rows.length && rows[i + 1].z < z) i++;
    const A = rows[i];
    const B = rows[Math.min(rows.length - 1, i + 1)];
    const t = (z - A.z) / Math.max(1e-6, B.z - A.z);
    return { z, yc: A.yc + (B.yc - A.yc) * t, b: A.b + (B.b - A.b) * t, hw: A.hw + (B.hw - A.hw) * t };
  };
  const half = (z, y) => {
    const R = at(z);
    const e = clamp((y - R.yc) / R.b, -1, 1);
    return R.hw * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(e), P.n)), 1 / P.n) * tumble(y, R.yc);
  };
  return { paint: geoOf(out.paint), glass: geoOf(out.glass), half, at, rows, z0, z1, plan: G };
}

// (how near a line comes to an outline: 0 inside it or on it)
function gapTo(pts, ol) {
  let best = Infinity;
  for (const [x, y] of pts) {
    if (inPoly(x, y, ol)) return 0;
    for (let i = 0, j = ol.length - 1; i < ol.length; j = i++) {
      const [ax, ay] = ol[j];
      const [bx, by] = ol[i];
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 > 1e-12 ? clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0;
      best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
    }
  }
  return best;
}

// (how much of a line's length lies inside an outline: 0..1)
function onBody(pts, ol) {
  let inL = 0;
  let all = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const l = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(l / 0.1));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      if (inPoly(ax + (bx - ax) * t, ay + (by - ay) * t, ol)) inL += l / n;
    }
    all += l;
  }
  return all > 1e-6 ? inL / all : pts.filter((q) => inPoly(q[0], q[1], ol)).length / Math.max(1, pts.length);
}

// (ROADMAP 11.13) a plane's fin drawn in its body's own line - up over its tail, as most draw one:
// o, the outline ([z, y], its nose at +z). Returns { body: the outline with its top along the
// body's own there, fin: the fin's outline over it } - or null, no fin in it
function cutFin(o) {
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [z] of o) {
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const L = z1 - z0;
  if (!(L > 0.5)) return null;
  const N = 48;
  const st = [];
  for (let i = 0; i <= N; i++) {
    const z = z0 + L * (0.004 + (i / N) * 0.992);
    const sp = spanAt(o, z);
    if (sp) st.push({ u: i / N, z, lo: sp[0], hi: sp[1] });
  }
  const mid = st.filter((q) => q.u > 0.3 && q.u < 0.75);
  if (mid.length < 6) return null;
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const top = med(mid.map((q) => q.hi));
  const h = med(mid.map((q) => q.hi - q.lo));
  // (its tail end: what rises well over the top of its body there)
  const fin = st.filter((q) => q.u < 0.42 && q.hi > top + h * 0.3);
  if (fin.length < 3 || Math.max(...fin.map((q) => q.hi)) < top + h * 0.38) return null;
  const za = fin[0].z;
  const zb = fin[fin.length - 1].z;
  const cap = (q) => (q.z >= za - L * 0.02 && q.z <= zb + L * 0.02 ? Math.max(q.lo + h * 0.25, Math.min(q.hi, top)) : q.hi);
  const body = st.map((q) => [q.z, cap(q)]).concat(st.slice().reverse().map((q) => [q.z, q.lo]));
  const finO = fin.map((q) => [q.z, q.hi]).concat(fin.slice().reverse().map((q) => [q.z, cap(q) - h * 0.12]));
  return { body, fin: finO };
}

// (a side's ring: its angles, so that it passes through the beltline, the top of its windows and
// the edge of its roof glass - y levels [belt, windows' top, roof glass] - in that order)
function ringAngles([yb, yr, yi], yc, b, n) {
  const thOf = (y) => {
    const e = clamp((y - yc) / b, -0.985, 0.985);
    return Math.asin(Math.sign(e) * Math.pow(Math.abs(e), n / 2));
  };
  const tb = clamp(thOf(yb), -1.2, 1.25);
  const tr = clamp(thOf(yr), tb + 0.04, 1.42);
  const ti = clamp(thOf(yi), tr + 0.03, 1.52);
  const th = [];
  const seg = (a, c, m) => {
    for (let j = 0; j < m; j++) th.push(a + ((c - a) * j) / m);
  };
  seg(-Math.PI / 2, tb, SEG[0]);
  seg(tb, tr, SEG[1]);
  seg(tr, ti, SEG[2]);
  seg(ti, Math.PI / 2, SEG[3]);
  th.push(Math.PI / 2);
  return th;
}

// a station's levels: its beltline, the top of its side windows, where its roof glass begins
function levels(G, style, yc, b, top) {
  if (style === 'car') {
    const yb = clamp(typeof G.belt === 'number' ? G.belt : yc, yc - b * 0.9, yc + b * 0.9);
    const yr = Math.max(yb + 0.01, top - Math.max(0.05, (top - yb) * 0.16));
    const yi = Math.max(yr + 0.01, top - Math.max(0.025, (top - yr) * 0.45));
    return [yb, yr, yi];
  }
  if (style === 'copter') return [yc - b * 0.25, yc + b * 0.5, yc + b * 0.62];
  if (style === 'plane') return [yc + b * 0.05, yc + b * 0.3, yc + b * 0.42];
  return [yc, yc + b * 0.5, yc + b * 0.75];
}

// where its glass is: a car's windows where its outline rises over the bonnet line (the longest
// run of it; a pillar in the middle of a long one), the windscreen in front of its roof, the back
// window behind; a box with no such rise - a van, a bus - a band of windows along its top. A
// plane's canopy on its top up front; a helicopter's nose all glass.
function glassPlan(st, style, lo, L) {
  const zs = st.map((s) => s.z);
  const out = { side: [], top: [], belt: null };
  if (!st.length) return out;
  const za0 = zs[0];
  const zb0 = zs[zs.length - 1];
  if (style === 'plane') {
    out.top.push([za0 + L * 0.58, za0 + L * 0.82]);
    return out;
  }
  if (style === 'copter') {
    out.top.push([za0 + L * 0.56, zb0 + 1]);
    return out;
  }
  if (style !== 'car') return out;
  const tops = st.map((s) => s.sp[1]);
  const sorted = tops.slice().sort((a, b) => a - b);
  const hood = sorted[Math.floor(sorted.length * 0.3)];
  const top = sorted[sorted.length - 1];
  const runOf = (f) => {
    let best = null;
    let a = -1;
    for (let i = 0; i <= st.length; i++) {
      const on = i < st.length && f(st[i], i);
      if (on && a < 0) a = i;
      if (!on && a >= 0) {
        if (!best || i - 1 - a > best[1] - best[0]) best = [a, i - 1];
        a = -1;
      }
    }
    return best;
  };
  if (top - hood > Math.max(0.25, (top - lo) * 0.18)) {
    const belt = hood + (top - hood) * 0.1;
    out.belt = belt;
    const run = runOf((s) => s.sp[1] - belt > 0.24);
    if (!run) return out;
    const za = zs[run[0]];
    const zb = zs[run[1]];
    if (zb - za > 1.5) {
      const zm = (za + zb) / 2;
      out.side.push([za, zm - 0.06], [zm + 0.06, zb]);
      out.pillar = zm;
    } else out.side.push([za, zb]);
    out.door = za;
    const roof = runOf((s, i) => i >= run[0] && i <= run[1] && s.sp[1] > top - (top - hood) * 0.14);
    if (roof) {
      if (zs[roof[1]] + 0.08 < zb) out.top.push([zs[roof[1]] + 0.08, zb]);
      if (zs[roof[0]] - 0.08 > za) out.top.push([za, zs[roof[0]] - 0.08]);
    }
    out.front = zb;
    return out;
  }
  // (no glasshouse: windows along its top, a pillar every metre or so)
  out.belt = lo + (top - lo) * 0.58;
  const za = za0 + L * 0.12;
  const zb = zb0 - L * 0.1;
  const n = Math.max(1, Math.round((zb - za) / 1.3));
  const w = (zb - za) / n;
  for (let k = 0; k < n; k++) out.side.push([za + k * w + (k ? 0.05 : 0), za + (k + 1) * w - (k < n - 1 ? 0.05 : 0)]);
  out.door = za;
  out.front = zb;
  return out;
}

// ------------------------------------------------------------------ parts
// a wheel: its tyre, the rim and five spokes, the hub (axle along x) - (ROADMAP 11.12) drawn square,
// square: a block of a tyre, a square rim
function wheel(M, r, w, rim, square = false) {
  const K = new Kit();
  if (square) {
    K.add(M.matte, new THREE.CylinderGeometry(r * 1.2, r * 1.2, w * 0.9, 4, 1).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), linC(...RUBBER));
    K.add(M.metal, new THREE.CylinderGeometry(r * 0.72, r * 0.72, w * 0.96, 4, 1).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), rim);
    K.add(M.metal, new THREE.CylinderGeometry(r * 0.15, r * 0.15, w, 12).rotateZ(Math.PI / 2), linC(0.8, 0.8, 0.84));
    const g = K.build({ seed: 0.62 });
    g.matrixAutoUpdate = true;
    return g;
  }
  K.add(M.matte, new THREE.TorusGeometry(r * 0.8, r * 0.2, 10, 30).rotateY(Math.PI / 2), linC(...RUBBER));
  K.add(M.matte, new THREE.CylinderGeometry(r * 0.97, r * 0.97, w * 0.86, 30, 1, true).rotateZ(Math.PI / 2), linC(0.08, 0.08, 0.09));
  K.add(M.metal, new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 0.7, 24).rotateZ(Math.PI / 2), rim);
  K.add(M.matte, new THREE.CylinderGeometry(r * 0.5, r * 0.5, w * 0.74, 20).rotateZ(Math.PI / 2), shade([0.12, 0.12, 0.14], 1));
  for (let k = 0; k < 5; k++) {
    const sp = new THREE.BoxGeometry(w * 0.72, r * 0.1, r * 0.48);
    sp.translate(0, 0, r * 0.25);
    sp.rotateX((k / 5) * Math.PI * 2);
    K.add(M.metal, sp, rim);
  }
  K.add(M.metal, new THREE.CylinderGeometry(r * 0.15, r * 0.15, w * 0.8, 12).rotateZ(Math.PI / 2), linC(0.8, 0.8, 0.84));
  const g = K.build({ seed: 0.61 });
  g.matrixAutoUpdate = true;
  return g;
}

// (ROADMAP 11.12) a track: a rubber belt round a long loop - a half circle at each end, its bottom
// run on the ground (yb) - across x from x - tw / 2 to x + tw / 2, `t` thick
function trackBelt(z0, z1, yb, r, x, tw, t = 0.07) {
  const za = z0 + r;
  const zb = Math.max(za + 0.01, z1 - r);
  const yc = yb + r;
  // (round it the way it turns: its front end up, over the top, its back end down - at radius rr)
  const loop = (rr) => {
    const L = [];
    for (let k = 0; k <= 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * Math.PI;
      L.push([zb + Math.cos(a) * rr, yc + Math.sin(a) * rr]);
    }
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI / 2 + (k / 10) * Math.PI;
      L.push([za + Math.cos(a) * rr, yc + Math.sin(a) * rr]);
    }
    return L;
  };
  const O = loop(r);
  const I = loop(Math.max(0.02, r - t));
  const xa = x - tw / 2;
  const xb = x + tw / 2;
  const pos = [];
  const tri = (...v) => {
    for (const [px, [pz, py]] of v) pos.push(px, py, pz);
  };
  const n = O.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // (outside, facing out; inside, facing in; its two sides)
    tri([xa, O[i]], [xb, O[i]], [xb, O[j]], [xa, O[i]], [xb, O[j]], [xa, O[j]]);
    tri([xa, I[i]], [xb, I[j]], [xb, I[i]], [xa, I[i]], [xa, I[j]], [xb, I[j]]);
    tri([xb, O[i]], [xb, I[i]], [xb, I[j]], [xb, O[i]], [xb, I[j]], [xb, O[j]]);
    tri([xa, O[i]], [xa, I[j]], [xa, I[i]], [xa, O[i]], [xa, O[j]], [xa, I[j]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

// a blade (of a rotor, a propeller): tapered, flat, `len` long along +z from its root
function bladeGeo(len, root, tip, thick) {
  const sh = new THREE.Shape([new THREE.Vector2(-root / 2, 0), new THREE.Vector2(root / 2, 0), new THREE.Vector2(tip / 2, len), new THREE.Vector2(-tip / 2, len * 0.98)]);
  const g = solid(new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false }));
  // (the shape's y along the blade -> z; its depth -> y)
  g.rotateX(Math.PI / 2);
  g.translate(0, thick / 2, 0);
  return g;
}

// a wing seen from above: from its root (at x = x0, its chord c0 from z0 forward) out to its tip,
// swept back and tapered, its section a thin lens (thickest a third back)
function wingGeo(x0, x1, z0, c0, c1, sweep, t0, t1) {
  const NK = 14;
  const prof = [];
  for (let k = 0; k <= NK; k++) {
    const u = k / NK;
    // (the lens: its thickness along the chord)
    prof.push([u, 4 * u * (1 - u) * (1.15 - u * 0.3)]);
  }
  const sec = (x, zf, c, t) => {
    const up = prof.map(([u, f]) => [x, f * t * 0.6, zf - u * c]);
    const dn = prof.slice(1, NK).reverse().map(([u, f]) => [x, -f * t * 0.4, zf - u * c]);
    return up.concat(dn);
  };
  const A = sec(x0, z0 + c0, c0, t0);
  const B = sec(x1, z0 + c0 - sweep, c1, t1);
  const pos = [];
  const quad = (a, b, c, d) => {
    for (const v of [a, b, c, a, c, d]) pos.push(v[0], v[1], v[2]);
  };
  const m = A.length;
  const flip = x1 < x0;
  for (let k = 0; k < m; k++) {
    const k2 = (k + 1) % m;
    if (flip) quad(A[k], A[k2], B[k2], B[k]);
    else quad(A[k], B[k], B[k2], A[k2]);
  }
  // (its tip closed)
  for (let k = 1; k + 1 < m; k++) {
    const tri = flip ? [B[0], B[k + 1], B[k]] : [B[0], B[k], B[k + 1]];
    for (const v of tri) pos.push(v[0], v[1], v[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

// (ROADMAP 11.13) a wing from its shape from above - plan: [[z, x]...] (x out from its root, >= 0) -
// as thick at its root as `t`, thinner out to its tip; side: -1, the other wing (its mirror)
function planWing(plan, t, side = 1) {
  const pts = plan.map(([z, x]) => new THREE.Vector2(x, -z));
  if (pts.length < 3) return null;
  const shape = new THREE.Shape(pts);
  const b = Math.min(0.03, t * 0.35);
  const g = solid(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.006, t - b * 2), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 }));
  // (the shape's y: -z -> z; its depth: up)
  g.rotateX(-Math.PI / 2);
  g.translate(0, -t / 2 + b, 0);
  let xm = 0;
  for (const [, x] of plan) xm = Math.max(xm, x);
  const a = g.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i);
    a.setY(i, a.getY(i) * (1 - 0.6 * clamp(x / Math.max(1e-3, xm), 0, 1)));
    if (side < 0) a.setX(i, -x);
  }
  if (side < 0) {
    if (g.index) flipFaces(g);
    else {
      // (its mirror turned inside out: each triangle's corners the other way round)
      for (const at of Object.values(g.attributes)) {
        const n = at.itemSize;
        const arr = at.array;
        for (let t = 0; t + 2 < at.count; t += 3) {
          for (let c = 0; c < n; c++) {
            const i1 = (t + 1) * n + c;
            const i2 = (t + 2) * n + c;
            const tmp = arr[i1];
            arr[i1] = arr[i2];
            arr[i2] = tmp;
          }
        }
      }
    }
  }
  g.computeVertexNormals();
  return g;
}

// a flat shape (an outline [z, y]) made a plate `t` thick across x, at x = xc, its edges rounded
function plate(o, t, xc = 0, bev = 0.015) {
  if (o.length < 3) return null;
  const shape = new THREE.Shape(o.map(([z, y]) => new THREE.Vector2(z, y)));
  const b = Math.min(bev, t * 0.4);
  const g = solid(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.004, t - b * 2), bevelEnabled: b > 0.002, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 }));
  g.rotateY(-Math.PI / 2);
  g.translate(xc + t / 2 - b, 0, 0);
  return g;
}

// (ROADMAP 11.13) a rocket's body (o: its outline [z, y] standing up, the model's frame): turned
// round its upright middle - as wide as drawn at each height, closed to a point at its nose - its
// nose cone in a colour of its own; a flat foot. Returns { axis (its middle's z), y0, y1, r0 (its
// foot's half width), rAt(y) }
function rocketBody(K, M, o, c0) {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [, y] of o) {
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const N = 36;
  const rs = [];
  let ax = 0;
  let aw = 0;
  for (let i = 0; i <= N; i++) {
    const y = y0 + ((y1 - y0) * i) / N;
    let lo = Infinity;
    let hi = -Infinity;
    for (let a = 0, b = o.length - 1; a < o.length; b = a++) {
      const [zA, yA] = o[b];
      const [zB, yB] = o[a];
      if ((yA <= y && yB >= y) || (yB <= y && yA >= y)) {
        const t = Math.abs(yB - yA) < 1e-9 ? 0.5 : (y - yA) / (yB - yA);
        const z = zA + (zB - zA) * t;
        lo = Math.min(lo, z);
        hi = Math.max(hi, z);
      }
    }
    const r = hi > lo ? (hi - lo) / 2 : 0;
    rs.push(r);
    if (r > 0) {
      ax += ((hi + lo) / 2) * r;
      aw += r;
    }
  }
  const axis = ax / Math.max(1e-6, aw);
  const rMax = Math.max(...rs);
  const r = rs.map((v, i) => (i === 0 || i === N ? v : (rs[i - 1] + v * 2 + rs[i + 1]) / 4));
  r[N] = 0.001;
  r[0] = Math.max(r[0], rMax * 0.6);
  const pts = r.map((v, i) => new THREE.Vector2(Math.max(0.001, v), y0 + ((y1 - y0) * i) / N));
  // (its nose cone: from where it starts to narrow to its tip)
  let ic = N;
  while (ic > N * 0.55 && r[ic - 1] < rMax * 0.82) ic--;
  const body = new THREE.LatheGeometry(pts.slice(0, ic + 1), 28).translate(0, 0, axis);
  K.add(M.paint, body.toNonIndexed(), linC(...c0));
  const cone = new THREE.LatheGeometry(pts.slice(ic), 28).translate(0, 0, axis);
  const red = c0[0] > 0.6 && c0[1] < 0.45 ? [0.95, 0.95, 0.92] : [0.88, 0.16, 0.14];
  K.add(M.paint, cone.toNonIndexed(), linC(...red));
  // (its foot closed)
  K.add(M.paint, new THREE.CircleGeometry(r[0], 28).rotateX(Math.PI / 2).translate(0, y0, axis).toNonIndexed(), shade(c0, 0.7));
  const rAt = (y) => {
    const t = clamp((y - y0) / Math.max(1e-6, y1 - y0), 0, 1) * N;
    const i = Math.min(N - 1, Math.floor(t));
    return r[i] + (r[i + 1] - r[i]) * (t - i);
  };
  return { axis, y0, y1, r0: r[0], rAt };
}

// (ROADMAP 11.13) an airship's envelope (eo: its outline [z, y], the model's frame): turned round its
// own length - as high as drawn all along it - dark above, light under it, its seams; its fins on
// its tail as drawn, and the two the side view hides (four, a cross); its gondola hung under it
function airship(K, M, eo, finO, c0, body) {
  let za = Infinity;
  let zb = -Infinity;
  for (const [z] of eo) {
    za = Math.min(za, z);
    zb = Math.max(zb, z);
  }
  const N = 44;
  const rs = [];
  const ycs = [];
  for (let i = 0; i <= N; i++) {
    const z = za + ((zb - za) * i) / N;
    let lo = Infinity;
    let hi = -Infinity;
    for (let a = 0, b = eo.length - 1; a < eo.length; b = a++) {
      const [zA, yA] = eo[b];
      const [zB, yB] = eo[a];
      if ((zA <= z && zB >= z) || (zB <= z && zA >= z)) {
        const t = Math.abs(zB - zA) < 1e-9 ? 0.5 : (z - zA) / (zB - zA);
        const y = yA + (yB - yA) * t;
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
    }
    rs.push(lo <= hi ? (hi - lo) / 2 : 0);
    ycs.push(lo <= hi ? (hi + lo) / 2 : NaN);
  }
  // (its axis: level, at its middle's height; its ends closed round)
  let ya = 0;
  let wy = 0;
  ycs.forEach((y, i) => {
    if (!Number.isNaN(y)) {
      ya += y * rs[i];
      wy += rs[i];
    }
  });
  ya /= Math.max(1e-6, wy);
  const r = rs.map((v, i) => (i === 0 || i === N ? 0 : (rs[i - 1] + v * 2 + rs[i + 1]) / 4));
  const rMax = Math.max(...r);
  const pts = r.map((v, i) => new THREE.Vector2(Math.max(0.001, i === 0 || i === N ? 0.001 : Math.max(v, rMax * 0.05)), za + ((zb - za) * i) / N));
  const light = linC(0.95, 0.94, 0.9);
  const dark = linC(...c0);
  const G = 12;
  for (let k = 0; k < G; k++) {
    const g = new THREE.LatheGeometry(pts, 4, (k / G) * Math.PI * 2, (Math.PI * 2) / G);
    // (the lathe's length its z, its bottom down)
    g.rotateX(Math.PI / 2);
    g.translate(0, ya, 0);
    const mid = ((k + 0.5) / G) * Math.PI * 2;
    K.add(M.paint, g.index ? g.toNonIndexed() : g, Math.cos(mid) > 0.45 ? light : dark);
  }
  // (its seams, and a band round its nose)
  const seam = linC(...c0.map((v) => v * 0.55));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let i = 1; i <= N; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      tube(K, M.matte, [Math.sin(a) * p0.x * 1.004, ya - Math.cos(a) * p0.x * 1.004, p0.y], [Math.sin(a) * p1.x * 1.004, ya - Math.cos(a) * p1.x * 1.004, p1.y], 0.03, seam, 4);
    }
  }
  // ---- its fins: as drawn up (and down); the ones each side the same as the top one
  const up = finO.filter((o) => o.reduce((s, q) => s + q[1], 0) / o.length > ya);
  const dn = finO.filter((o) => o.reduce((s, q) => s + q[1], 0) / o.length <= ya);
  const flip = (o) => o.map(([z, y]) => [z, 2 * ya - y]);
  const ups = up.length ? up : dn.map(flip);
  const dns = dn.length ? dn : up.map(flip);
  const finC = linC(...c0.map((v) => v * 0.8));
  const fin = (o, ang) => {
    const g = plate(o.length > 2 ? o : o.concat([o[0]]), 0.14, 0, 0.04);
    if (!g) return;
    g.translate(0, -ya, 0);
    g.rotateZ(ang);
    g.translate(0, ya, 0);
    K.add(M.paint, g, finC);
  };
  for (const o of ups) fin(o, 0);
  for (const o of dns) fin(o, 0);
  for (const o of ups.slice(0, 1)) {
    fin(o, Math.PI / 2);
    fin(o, -Math.PI / 2);
  }
  // ---- its gondola hung under it: struts up to it, either side
  if (body) {
    const zm = (body.z0 + body.z1) / 2;
    const half = (body.z1 - body.z0) * 0.32;
    for (const dz of [-half, half]) {
      const st = body.at(zm + dz);
      const top = st.yc + st.b * 0.85;
      const i = clamp(Math.round(((zm + dz - za) / Math.max(1e-6, zb - za)) * N), 0, N);
      const yEnv = ya - r[i] * 0.92;
      if (yEnv > top + 0.05) for (const sx of [-1, 1]) tube(K, M.metal, [sx * st.hw * 0.6, top, zm + dz], [sx * Math.min(st.hw * 0.9, r[i] * 0.4), yEnv, zm + dz], 0.035, linC(0.3, 0.3, 0.34), 6);
    }
  }
}

// ------------------------------------------------------------------ a ride
// design: { strokes: [{ type, pts ([z, y] metres), col, pencil, neon, part }], color }, spec: from
// game/drawncar.js specOf. Returns what game/vehicles.js needs (as buildModel does), and turrets
// (every barrel's), wings (each side's, on its hinge), canopy (the parachute, closed)
export function buildPolished(design, spec) {
  const M = itemMats();
  const base = design.color;
  // (ROADMAP 11.13: a plane drawn from above - as wide as drawn)
  const planHW = design.plan && design.plan.hw ? design.plan.hw : null;
  const W = planHW ? Math.max(0.3, ...planHW.map((q) => q[1] * 2)) : spec.W;
  const zc = (spec.x0 + spec.x1) / 2;
  const S = design.strokes;
  let floor = spec.y0;
  if (spec.wheels.length) floor = Math.min(...spec.wheels.map((w) => w.y - w.r));
  // (ROADMAP 11.12: on its tracks; a hovercraft, over its skirt)
  for (const t of spec.tracks || []) floor = Math.min(floor, t.y0);
  if (spec.hover && !spec.wheels.length && !(spec.tracks || []).length) floor = spec.y0 - 0.34;
  // (what each part is where it is: game/partrole.js, game/partsum.js rideSpec)
  const roleOf = (s) => (spec.role && spec.role.get(s) ? spec.role.get(s).v : null);
  for (const s of S) if (s.type === 'spring') floor = Math.min(floor, shapeOf(s.pts).y0);
  // (its skids under it: what it stands on)
  for (const s of S) if (s.part === 'skid') floor = Math.min(floor, shapeOf(s.pts).y0 - 0.05);
  const Z = (z) => z - zc;
  const Y = (y) => y - floor;
  const toM = (pts) => pts.map(([z, y]) => [Z(z), Y(y)]);
  const K = new Kit();
  const drive = !!(spec.modes && spec.modes.drive);
  const flier = !!(spec.modes && (spec.modes.plane || spec.modes.copter));
  const boat = spec.base === 'boat';
  // ---- the body: the body's outline and every cabin on it, one skin (a cabin narrower)
  const bodies = S.filter((s) => s.type === 'body' && s.part !== 'cabin');
  const cabins = S.filter((s) => s.type === 'body' && s.part === 'cabin');
  const main = bodies.map((s) => ({ s, sh: shapeOf(s.pts) })).sort((a, b) => b.sh.area - a.sh.area)[0];
  // (a bike's: a slim tank and seat over its frame)
  const slim = !!(main && main.s.slim);
  let body = null;
  let hull = null;
  let rocket = null;
  if (main) {
    let o = outline(toM(main.s.pts));
    // (a cabin drawn on it: the skin goes up over it)
    const cabO = cabins.map((s) => outline(toM(s.pts))).filter((c) => c.length >= 3);
    if (cabO.length) o = mergeTop(o, cabO);
    const bc = colOf(main.s, design);
    if (design.rocket) {
      rocket = rocketBody(K, M, o, bc);
    } else if (boat && main.s.hull !== false) {
      hull = hullGeometry(o, W);
      K.add(M.paint, hull.geo, linC(...bc));
      K.add(M.matte, hull.deck, shade(bc, 0.62));
    } else {
      // (its style: a car's body - one that drives, even if it flies too - a plane's, a
      // helicopter's, a balloon's basket)
      const style = design.drone ? (design.drone.round ? 'pod' : 'drone') : design.airship ? 'copter' : spec.base === 'plane' ? 'plane' : spec.base === 'copter' ? 'copter' : spec.base === 'balloon' ? 'basket' : 'car';
      const hwOf = planHW
        ? (z) => {
            const zz = z + zc;
            let i = 0;
            while (i + 2 < planHW.length && planHW[i + 1][0] < zz) i++;
            const [za, a] = planHW[i];
            const [zb, b] = planHW[i + 1];
            return a + (b - a) * clamp((zz - za) / Math.max(1e-6, zb - za), 0, 1);
          }
        : null;
      // (ROADMAP 11.13: a plane's fin drawn in its body's line - its body a tube, the fin a thin
      // plate over its tail, tail planes either side of its foot)
      const cut = style === 'plane' && !planHW && !S.some((q) => q.type === 'fin') ? cutFin(o) : null;
      if (cut) {
        o = cut.body;
        K.add(M.paint, plate(cut.fin, 0.09, 0, 0.02), shade(bc, 1.08));
        const fz = cut.fin.map((q) => q[0]);
        const fy = Math.min(...cut.fin.map((q) => q[1]));
        const fw = Math.max(...fz) - Math.min(...fz);
        const span = clamp(fw * 1.6, 0.8, 3.2);
        for (const sx of [-1, 1]) K.add(M.paint, wingGeo(sx * 0.05, sx * span, Math.max(...fz), fw * 0.9, fw * 0.45, fw * 0.25, 0.08, 0.04).translate(0, fy + 0.05, 0), shade(bc, 1.08));
      }
      body = loftRide(o, slim ? Math.min(W, 0.42) : W, style, hwOf);
      K.add(M.paint, body.paint, linC(...bc));
      if (body.glass && !slim) K.add(M.glass, body.glass, linC(...GLASS));
      // a car's lights, its grille, its bumpers, its doors and mirrors
      if (style === 'car' && spec.L > 1.4 && !slim) carDetails(K, M, body, bc);
    }
  }
  // (another body drawn by it: a part of its own, a little narrower)
  for (const o of bodies) {
    if (!main || o === main.s) continue;
    const oo = outline(toM(o.pts));
    if (oo.length < 3) continue;
    const lb = loftBody(oo, W * 0.9, { n: 3, lean: 0.1, p: 3 });
    K.add(M.paint, lb.paint, linC(...colOf(o, design)));
  }
  const half = body ? body.half : hull ? hull.half : () => W / 2;
  let tailTip = null;
  // ---- the lines drawn on it: on its skin, both sides
  const skinLine = (pts, w, c, out = 0.006) => {
    const P = thin(toM(pts), 0.035, 90);
    for (const sx of [-1, 1]) {
      const g = ribbon(P, sx * (W / 2), w, sx);
      const a = g.attributes.position;
      for (let i = 0; i < a.count; i++) a.setX(i, sx * (half(a.getZ(i), a.getY(i)) + out));
      K.add(M.matte, g, c);
    }
  };
  const ol = main ? outline(main.s.pts) : null;
  // (a cockpit's glass bubble: its pilot sits in it)
  let canopyAt = null;
  // (how far its wings reach: a biplane's struts stand out on them)
  let wingSpan = 0;
  for (const s of S) if (s.type === 'wing' && roleOf(s) !== 'fin') wingSpan = Math.max(wingSpan, s.span || clamp(Math.max(shapeOf(s.pts).w * 2.6, spec.L * 0.95), 2.2, 11));
  for (const s of S) {
    if (s.type !== 'line' && s.type !== 'armor') continue;
    // (the lines that drew its body: the body is made of them already)
    if (s.edge) continue;
    const c = s.col && !s.pencil ? s.col : INK;
    if (s.part === 'frame') {
      // (a bike's frame: a tube along each line, in its paint; ROADMAP 11.13 - a plane's struts
      // between its wings: out on them, both sides)
      const P = thin(toM(s.pts), 0.06);
      const xs = wingSpan && spec.base === 'plane' ? [-wingSpan * 0.28, wingSpan * 0.28] : [0];
      for (const x of xs) for (let i = 1; i < P.length; i++) tube(K, M.metal, [x, P[i - 1][1], P[i - 1][0]], [x, P[i][1], P[i][0]], 0.045, linC(...colOf(s, design)), 8);
      continue;
    }
    // (how much of it - its length, not its points: a line drawn with a few - is on the body)
    const on = ol ? onBody(s.pts, ol) : 0;
    // (ROADMAP 11.13: a cockpit's canopy drawn as a dome on its top - a glass bubble there)
    if (s.part === 'window' && on <= 0.6 && body && main) {
      const sh = shapeOf(toM(s.pts));
      const st = body.at(sh.cx);
      const top = st.yc + st.b;
      if (sh.y1 > top - 0.05 && sh.w > 0.3) {
        const h = clamp(sh.y1 - top + st.b * 0.35, 0.15, 1.2);
        canopyAt = { z: sh.cx, top, h };
        const g = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        g.scale(clamp(st.hw * 0.72, 0.18, 0.7), h, sh.w / 2);
        g.translate(0, top - st.b * 0.35, sh.cx);
        K.add(M.glass, g.toNonIndexed(), linC(...GLASS));
        continue;
      }
    }
    if (s.part === 'window' && rocket) {
      // (a rocket's porthole: glass in a ring, both sides)
      const sh = shapeOf(toM(s.pts));
      const rr = clamp(Math.min(sh.w, sh.h) / 2, 0.12, 0.6);
      const rx = rocket.rAt(sh.cy);
      for (const sx of [-1, 1]) {
        const g = new THREE.CylinderGeometry(rr, rr, 0.04, 20).rotateZ(Math.PI / 2).translate(sx * (rx - 0.005), sh.cy, rocket.axis + (sh.cx - rocket.axis) * 0.2);
        K.add(M.glass, g.toNonIndexed(), linC(...GLASS));
        const ring = new THREE.TorusGeometry(rr, 0.035, 6, 24).rotateY(Math.PI / 2).translate(sx * (rx + 0.01), sh.cy, rocket.axis + (sh.cx - rocket.axis) * 0.2);
        K.add(M.metal, ring.toNonIndexed(), linC(0.6, 0.6, 0.64));
      }
      continue;
    }
    if (s.part === 'window' && on > 0.6) {
      // (a window drawn on it: glass, set into its side)
      const wo = outline(toM(s.pts));
      if (wo.length >= 3) {
        for (const sx of [-1, 1]) {
          const g = new THREE.ShapeGeometry(new THREE.Shape(wo.map(([z, y]) => new THREE.Vector2(z, y))));
          const a = g.attributes.position;
          const pts3 = [];
          for (let i = 0; i < a.count; i++) pts3.push([a.getX(i), a.getY(i)]);
          for (let i = 0; i < a.count; i++) {
            const [z, y] = pts3[i];
            a.setXYZ(i, sx * (half(z, y) + 0.008), y, z);
          }
          if (sx < 0) flipFaces(g);
          g.computeVertexNormals();
          K.add(M.glass, g.index ? g.toNonIndexed() : g, linC(...GLASS));
        }
        skinLine(s.pts.concat([s.pts[0]]), 0.035, inkOn(INK, base), 0.01);
      }
      continue;
    }
    if (s.type === 'armor') skinLine(s.pts, 0.1, inkOn(s.col && !s.pencil ? s.col : [0.32, 0.33, 0.36], base), 0.012);
    else if (on >= 0.6) skinLine(s.pts, 0.05, s.neon ? linC(...c) : inkOn(c, base));
    else if (s.part === 'mast' && S.some((q) => q.type === 'sail')) continue;
    else if (s.part === 'skid') {
      // (a helicopter's skids: a steel tube each side where it was drawn, on struts up to it)
      const P = thin(toM(s.pts), 0.08);
      const a = P[0];
      const b = P[P.length - 1];
      const steel = linC(0.32, 0.33, 0.37);
      for (const sx of [-1, 1]) {
        const x = sx * W * 0.38;
        tube(K, M.metal, [x, a[1], a[0]], [x, b[1], b[0]], 0.045, steel, 10);
        for (const t of [0.28, 0.72]) {
          const z = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t;
          const st = body ? body.at(z) : null;
          const yTop = st ? st.yc - st.b * 0.6 : y + 0.4;
          if (yTop > y + 0.05) tube(K, M.metal, [x, y, z], [sx * W * 0.24, yTop, z], 0.03, steel, 8);
        }
      }
    } else if (s.part === 'tail' && body) {
      // (a helicopter's tail: a boom out of its back, tapering, in its paint - its fin at the end)
      const P = toM(s.pts);
      const d = (q) => Math.abs(q[0] - (body.z0 + body.z1) / 2);
      // (its two ends: nearest its body's middle, furthest out - a line drawn there and back again
      // too, its first and last points one)
      const a = P.reduce((m, q) => (d(q) < d(m) ? q : m), P[0]);
      const b = P.reduce((m, q) => (d(q) > d(m) ? q : m), P[0]);
      const st = body.at(clamp(a[0], body.z0, body.z1));
      const r0 = clamp(st.b * 0.42, 0.1, 0.42);
      const r1 = Math.max(0.05, r0 * 0.42);
      const ax = [0, a[1], clamp(a[0], body.z0 + 0.2, body.z1 - 0.2)];
      const bx = [0, b[1], b[0]];
      const len = Math.hypot(bx[1] - ax[1], bx[2] - ax[2]);
      if (len > 0.2) {
        const g = new THREE.CylinderGeometry(r1, r0, len, 14);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, bx[1] - ax[1], bx[2] - ax[2]).normalize()));
        g.translate(0, (ax[1] + bx[1]) / 2, (ax[2] + bx[2]) / 2);
        K.add(M.paint, g, linC(...colOf(main.s, design)));
        const fo = [[bx[2] + 0.05, bx[1]], [bx[2] - Math.max(0.35, r0 * 1.6), bx[1]], [bx[2] - Math.max(0.2, r0), bx[1] + Math.max(0.5, r0 * 2.6)], [bx[2] + 0.12, bx[1] + Math.max(0.42, r0 * 2.2)]];
        K.add(M.paint, plate(fo, 0.07, 0, 0.02), shade(colOf(main.s, design), 0.85));
        tailTip = [r1 + 0.1, bx[1] + r1 * 0.5, bx[2] - 0.1];
      }
    } else {
      // (ROADMAP 11.13: on an aircraft, a line drawn off it touching nothing of it - the wind, its
      // speed, a cloud: the drawing's, not the model's)
      if (flier && s.part === 'deco' && ol && gapTo(s.pts, ol) > Math.max(0.25, spec.H * 0.12)) continue;
      const P = thin(toM(s.pts), 0.06);
      for (let i = 1; i < P.length; i++) tube(K, M.matte, [0, P[i - 1][1], P[i - 1][0]], [0, P[i][1], P[i][0]], 0.05, shade(colOf(s, design), 0.5));
    }
  }
  // ---- fins: a plate where drawn, and tail planes either side of its foot
  for (const s of S) {
    // (ROADMAP 11.12: a wing drawn standing up - a fin; on a car, its spoiler: a plate right across it)
    if (s.type === 'wing' && roleOf(s) === 'fin') {
      const sh = shapeOf(toM(s.pts));
      const c = colOf(s, design);
      const fo = sh.closed ? outline(toM(s.pts)) : toM(s.pts).concat(toM(s.pts).reverse().map(([z, y]) => [z - 0.08, y]));
      if (fo.length >= 3) K.add(M.paint, plate(fo, drive ? W * 0.8 : 0.09, 0, 0.02), shade(c, 1.08));
      continue;
    }
    if (s.type !== 'fin' || design.airship) continue;
    const sh = shapeOf(s.pts);
    const c = colOf(s, design);
    // (ROADMAP 11.13: a rocket's - as drawn either side of it, and the two the drawing hides: four
    // round its foot)
    if (rocket) {
      const fo = outline(toM(s.pts).concat([toM(s.pts)[0]]));
      for (const a of [0, Math.PI / 2]) {
        const g = plate(fo.length >= 3 ? fo : toM(s.pts), 0.08, 0, 0.02);
        if (!g) continue;
        g.translate(0, 0, -rocket.axis);
        g.rotateY(a);
        g.translate(0, 0, rocket.axis);
        K.add(M.paint, g, shade(c, 1.05));
      }
      continue;
    }
    // (ROADMAP 11.13: a tailplane drawn from above - its shape, either side, flat across its tail)
    if (s.flat && s.plan) {
      const zs = s.plan.map((q) => q[0]);
      const st = body ? body.at(Z((Math.min(...zs) + Math.max(...zs)) / 2)) : null;
      const y = st ? st.yc + st.b * 0.15 : Y(sh.cy);
      const chord = Math.max(...zs) - Math.min(...zs);
      for (const sx of [-1, 1]) {
        const g = planWing(s.plan.map(([z, x]) => [Z(z), x]), clamp(chord * 0.1, 0.04, 0.16), sx);
        if (g) K.add(M.paint, g.translate(0, y, 0), shade(c, 1.08));
      }
      continue;
    }
    const fo = sh.closed ? outline(toM(s.pts)) : null;
    if (fo && fo.length >= 3) K.add(M.paint, plate(fo, 0.09, 0, 0.02), shade(c, 1.08));
    if (S.some((q) => q.type === 'fin' && q.flat)) continue;
    const foot = Y(sh.y0) + 0.05;
    const span = clamp(sh.w * 1.6, 0.8, 3.2);
    for (const sx of [-1, 1]) K.add(M.paint, wingGeo(sx * 0.05, sx * span, Z(sh.x0), sh.w * 0.9, sh.w * 0.45, sh.w * 0.25, 0.08, 0.04).translate(0, foot, 0), shade(c, 1.08));
  }
  // ---- a sail on its mast and boom, bellied by the wind
  let sailAt = null;
  for (const s of S) {
    if (s.type !== 'sail') continue;
    const so = outline(toM(s.pts));
    if (so.length < 3) continue;
    const sh = shapeOf(so);
    const mastZ = sh.x0 + sh.w * 0.08;
    const deck = main ? Y(spanAt(outline(main.s.pts), mastZ + zc) ? spanAt(outline(main.s.pts), mastZ + zc)[1] : spec.y1) : sh.y0;
    K.cyl(M.metal, 0.07, 0.05, deck - 0.1, sh.y1 + 0.3, linC(0.82, 0.8, 0.74), { axis: 'y', z: mastZ, segs: 10 });
    K.cyl(M.metal, 0.05, 0.05, mastZ, sh.x1, linC(0.62, 0.5, 0.36), { y: sh.y0 + 0.05, segs: 8 });
    const cloth = s.col && !s.pencil ? linC(...s.col) : linC(0.97, 0.95, 0.9);
    for (const side of [1, -1]) {
      const g = new THREE.ShapeGeometry(new THREE.Shape(so.map(([z, y]) => new THREE.Vector2(z, y))), 6);
      const a = g.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const z = a.getX(i);
        const y = a.getY(i);
        const u = clamp((z - sh.x0) / Math.max(0.01, sh.w), 0, 1);
        const v = clamp((y - sh.y0) / Math.max(0.01, sh.h), 0, 1);
        const belly = Math.sin(u * Math.PI) * (1 - v * 0.5) * sh.w * 0.12;
        a.setXYZ(i, belly + side * 0.012, y, z);
      }
      if (side < 0) flipFaces(g);
      g.computeVertexNormals();
      K.add(M.paint, g.index ? g.toNonIndexed() : g, cloth);
    }
    sailAt = sh;
  }
  // ---- a balloon: its envelope in gores, the burner under its mouth
  let env = null;
  const envS = S.find((s) => s.type === 'envelope');
  if (envS && envS.ship) airship(K, M, toM(envS.pts), S.filter((s) => s.type === 'fin').map((s) => toM(s.pts)), colOf(envS, design), body);
  else if (envS) {
    const eo = outline(toM(envS.pts));
    const c0 = colOf(envS, design);
    if (eo.length >= 3) {
      env = envelopeGeometry(eo, [linC(...c0), linC(0.98, 0.95, 0.86), linC(...c0.map((v) => v * 0.72))]);
      for (const [g, col] of env.geos) K.add(M.paint, g, col);
      const dark = linC(...INK);
      for (let k = 0; k < env.G; k++) {
        const a = (k / env.G) * Math.PI * 2;
        const Pp = env.pts.map((v) => [Math.sin(a) * v.x * 1.004, v.y, env.axis + Math.cos(a) * v.x * 1.004]);
        for (let i = 1; i < Pp.length; i++) tube(K, M.matte, Pp[i - 1], Pp[i], 0.02, dark, 5);
      }
      K.cyl(M.metal, 0.22, 0.22, env.y0 - 0.5, env.y0 - 0.15, linC(0.45, 0.45, 0.5), { axis: 'y', z: env.axis, segs: 10 });
      // (the ropes down to its basket)
      if (body) {
        const top = body.at(env.axis);
        const ty = top.yc + top.b;
        const rr = Math.max(0.3, env.rAt(env.y0 + 0.05) * 0.8);
        const dz = Math.min(0.6, (body.z1 - body.z0) * 0.35);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tube(K, M.matte, [sx * top.hw * 0.8, ty, env.axis + sz * dz], [sx * rr * 0.7, env.y0 + 0.05, env.axis + sz * rr * 0.7], 0.018, linC(0.42, 0.33, 0.22), 5);
      }
    }
  }
  // ---- a spring under it: a steel coil between two pads - (ROADMAP 11.12) at its front a bumper on
  // two coils, at its back two coils lying along it
  for (const s of S) {
    if (s.type !== 'spring') continue;
    const sh = shapeOf(s.pts);
    const v = roleOf(s);
    if (v === 'bumper' || v === 'kick') {
      const front = v === 'bumper';
      const r = clamp(Math.min(sh.w, sh.h) / 2, 0.1, 0.24);
      const len = clamp(Math.max(sh.w, sh.h) * 0.8, 0.35, 1.1);
      const turns = clamp(Math.round((s.coils || 6) / 2), 3, 8);
      const y = clamp(Y(sh.cy), r + 0.15, Y(spec.y1) - r);
      const z0 = front ? Z(spec.x1) - 0.12 : Z(spec.x0) + 0.12;
      const zEnd = z0 + (front ? len : -len);
      for (const x of [-W * 0.28, W * 0.28]) {
        const g = helixGeometry(0, 0, len, r, turns).rotateX(front ? Math.PI / 2 : -Math.PI / 2);
        K.add(M.metal, g.translate(x, y, z0), linC(...STEEL));
      }
      // (the pad it hits with)
      K.box(M.matte, -W * 0.44, y - r * 1.6, Math.min(zEnd, zEnd + (front ? 0.1 : -0.1)), W * 0.44, y + r * 1.6, Math.max(zEnd, zEnd + (front ? 0.1 : -0.1)), linC(0.13, 0.13, 0.15));
      continue;
    }
    const r = clamp(Math.min(sh.w, sh.h) / 2, 0.14, 0.5);
    const turns = clamp(Math.round((s.coils || 6) / 2), 3, 9);
    for (const x of drive && W > 0.6 ? [-W * 0.24, W * 0.24] : [0]) {
      K.add(M.metal, helixGeometry(Z(sh.mx), Y(sh.y0) + 0.06, Y(sh.y1) - 0.04, r, turns).translate(x, 0, 0), linC(...STEEL));
      K.cyl(M.matte, r * 1.15, r * 1.15, Y(sh.y0), Y(sh.y0) + 0.06, linC(0.12, 0.12, 0.14), { axis: 'y', x, z: Z(sh.mx), segs: 16 });
    }
  }
  // ---- jets: a nozzle out of its back, the glow in it - (ROADMAP 11.12) under it, a nozzle each side
  // pointing down (it lifts it); at its front, one pointing forward (it brakes)
  const jetsAt = [];
  const vtolAt = [];
  for (const s of S) {
    if (s.type !== 'jet') continue;
    const sh = shapeOf(s.pts);
    const r = clamp(sh.size / 2, 0.16, 0.6);
    const v = roleOf(s);
    if (v === 'vtol' && rocket) {
      // (a rocket's: its engine's bell under its foot, the flame in it)
      const rb = clamp(rocket.r0 * 0.7, 0.18, 0.7);
      const yb = rocket.y0;
      K.cyl(M.metal, rb * 0.55, rb, yb - rb * 1.1, yb, linC(0.36, 0.36, 0.4), { axis: 'y', z: rocket.axis, segs: 18 });
      K.cyl(M.glow, rb * 0.8, rb * 0.8, yb - rb * 1.14, yb - rb * 1.08, s.neon ? linC(...s.col) : linC(1.0, 0.6, 0.2), { axis: 'y', z: rocket.axis, segs: 16 });
      vtolAt.push([0, yb - rb * 1.3, rocket.axis]);
      continue;
    }
    if (v === 'vtol') {
      const rr = clamp(r, 0.18, 0.45);
      for (const sx of [-1, 1]) {
        const x = sx * (W / 2 + rr * 0.9);
        const z = Z(sh.mx);
        const yb = Math.max(rr * 0.6, Y(sh.y0));
        K.cyl(M.metal, rr * 1.05, rr * 0.85, yb, yb + rr * 2.2, linC(0.5, 0.51, 0.56), { axis: 'y', x, z, segs: 16 });
        K.cyl(M.metal, rr * 1.12, rr * 1.12, yb - 0.04, yb + 0.08, linC(0.25, 0.25, 0.28), { axis: 'y', x, z, segs: 16 });
        K.cyl(M.glow, rr * 0.7, rr * 0.7, yb - 0.05, yb - 0.02, s.neon ? linC(...s.col) : linC(1.0, 0.55, 0.2), { axis: 'y', x, z, segs: 14 });
        // (a strut to its side)
        K.box(M.metal, Math.min(x, sx * W * 0.4), yb + rr * 1.2, z - 0.08, Math.max(x, sx * W * 0.4), yb + rr * 1.4, z + 0.08, linC(0.4, 0.4, 0.45));
        vtolAt.push([x, yb - 0.15, z]);
      }
      continue;
    }
    if (v === 'retro') {
      const y = Y(sh.cy);
      const za = Z(Math.min(sh.x0, spec.x1 - 0.2));
      const zb = Z(sh.x1) + 0.15;
      for (const x of W > 1.2 ? [-W * 0.3, W * 0.3] : [0]) {
        K.cyl(M.metal, r * 0.92, r * 1.1, za, zb, linC(0.5, 0.51, 0.56), { x, y, segs: 18 });
        K.cyl(M.glow, r * 0.7, r * 0.7, zb + 0.02, zb + 0.05, s.neon ? linC(...s.col) : linC(1.0, 0.55, 0.2), { x, y, segs: 16 });
      }
      continue;
    }
    const onWing = s.lat !== undefined || s.wing;
    const zb = s.side || onWing ? Z(sh.x1) : Z(Math.max(sh.x1, spec.x0 + 0.2));
    const z0 = Z(sh.x0) - 0.15;
    let y = Y(sh.cy);
    // (one under a wing - a plane drawn from above: out along the wing, both sides; ROADMAP 11.13:
    // where it was drawn on it - from the side, under each wing a third of the way out)
    let xs = s.side ? [-1, 1].map((sx) => sx * clamp(W * 1.1, 1.2, 3.5)) : [0];
    if (s.lat !== undefined) xs = [s.lat];
    else if (s.wing) {
      const wi = S.find((q) => q.type === 'wing' && q.span);
      const hs = wi ? wi.span / 2 : clamp(spec.L * 0.5, 1.5, 6);
      xs = [-1, 1].map((sx) => sx * Math.max(W / 2 + r * 1.3, hs * 0.34));
      const st = body ? body.at((z0 + zb) / 2) : null;
      if (st) y = Math.max(r + 0.12, st.yc - st.b * 0.42 - r * 1.05);
    }
    for (const x of xs) {
      K.cyl(M.metal, r * 1.1, r * 0.92, z0, zb, linC(0.5, 0.51, 0.56), { x, y, segs: 18 });
      K.cyl(M.metal, r * 1.18, r * 1.18, z0 - 0.04, z0 + 0.08, linC(0.25, 0.25, 0.28), { x, y, segs: 18 });
      K.cyl(M.glow, r * 0.7, r * 0.7, z0 - 0.05, z0 - 0.02, s.neon ? linC(...s.col) : linC(1.0, 0.55, 0.2), { x, y, segs: 16 });
      jetsAt.push([x, y, z0 - 0.15]);
    }
  }
  // (ROADMAP 11.13: no engine drawn - the jet in it: its nozzle at its tail, glowing)
  if (spec.inner === 'jet' && body) {
    const st = body.at(body.z0 + (body.z1 - body.z0) * 0.08);
    const r = clamp(Math.min(st.hw, st.b) * 0.8, 0.12, 0.42);
    const z0 = body.z0 - 0.14;
    K.cyl(M.metal, r * 0.92, r * 1.08, z0, body.z0 + 0.4, linC(0.42, 0.43, 0.47), { y: st.yc, segs: 18 });
    K.cyl(M.metal, r * 1.02, r * 1.02, z0 - 0.03, z0 + 0.06, linC(0.22, 0.22, 0.25), { y: st.yc, segs: 18 });
    K.cyl(M.glow, r * 0.72, r * 0.72, z0 - 0.04, z0 - 0.01, linC(1.0, 0.55, 0.2), { y: st.yc, segs: 16 });
    jetsAt.push([0, st.yc, z0 - 0.15]);
  }
  // ---- a blade at the front (a ram): steel, its edge bevelled
  for (const s of S) {
    if (s.type !== 'blade') continue;
    const bo = outline(toM(s.pts));
    if (bo.length < 3) continue;
    const t = clamp(W * 0.08, 0.06, 0.16);
    // (ROADMAP 11.12: drawn along its side - a blade out of each side of it)
    const side = roleOf(s) === 'side';
    const xs = side ? [-W / 2 - 0.08, W / 2 + 0.08] : W > 1.2 ? [-W * 0.3, W * 0.3] : [0];
    for (const x of xs) K.add(M.metal, plate(bo, side ? t * 0.5 : t, x, t * 0.25), s.col && !s.pencil ? shade(s.col, 1) : linC(...STEEL));
  }
  const root = K.build({ seed: 0.42 });
  root.matrixAutoUpdate = true;
  // ---- wheels: a pair each, turning - (ROADMAP 11.12) a square one square; a track a belt round
  // its wheels each side, as long as drawn
  const wheels = [];
  for (const s of S) {
    if (s.type !== 'wheel') continue;
    const sh = shapeOf(s.pts);
    const skate = spec.kind === 'skate';
    const rim = s.col && !s.pencil ? shade(s.col, 1) : linC(0.82, 0.83, 0.87);
    if (roleOf(s) === 'track') {
      const r = clamp(sh.h / 2, 0.2, 0.62);
      const tw = clamp(W * 0.24, 0.28, 0.56);
      const z0 = Z(sh.x0);
      const z1 = Z(sh.x1);
      const yb = Y(sh.y0);
      const TK = new Kit();
      for (const sx of [-1, 1]) {
        const x = sx * (W / 2 + tw / 2 + 0.03);
        TK.add(M.matte, trackBelt(z0, z1, yb, r, x, tw), linC(...RUBBER));
        // (its guard over it)
        TK.box(M.paint, x - tw * 0.55, yb + r * 2 + 0.02, z0 - 0.04, x + tw * 0.55, yb + r * 2 + 0.07, z1 + 0.04, shade(base, 0.7));
      }
      root.add(TK.build({ seed: 0.63 }));
      const n = clamp(Math.round((z1 - z0) / (r * 2.1)), 2, 7);
      for (let k = 0; k < n; k++) {
        const z = z0 + r + ((z1 - z0 - r * 2) * k) / Math.max(1, n - 1);
        for (const sx of [-1, 1]) {
          const g = wheel(M, r * 0.82, tw * 0.7, rim);
          g.position.set(sx * (W / 2 + tw / 2 + 0.03), yb + r, z);
          root.add(g);
          wheels.push(g);
        }
      }
      continue;
    }
    const square = roleOf(s) === 'square';
    const r = clamp((sh.w + sh.h) / 4, skate ? 0.025 : 0.15, 1.3);
    const ww = skate ? 0.045 : clamp(r * 0.62, 0.12, 0.46);
    for (const sx of slim ? [0] : [-1, 1]) {
      const g = wheel(M, r, slim ? Math.min(ww, 0.14) : ww, rim, square);
      g.position.set(sx * (skate ? W * 0.42 : W / 2 + ww / 2 + 0.02), Y(sh.my), Z(sh.mx));
      root.add(g);
      wheels.push(g);
    }
    // (its arch: the dark of the wheel well behind it, on the body's side)
    if (body && !skate && !slim) {
      for (const sx of [-1, 1]) {
        const d = new THREE.CircleGeometry(r * 1.14, 26);
        d.rotateY(sx * Math.PI / 2);
        const x = sx * (half(Z(sh.mx), Y(sh.my)) + 0.006);
        d.translate(x, Y(sh.my), Z(sh.mx));
        const AK = new Kit();
        AK.add(M.matte, d, linC(0.05, 0.05, 0.06));
        const am = AK.build({ seed: 0.2 });
        root.add(am);
      }
    }
  }
  // ---- a turret for each barrel: it turns after where you look - one up on its top all the way
  // round; one out of its nose (its tail, its side) only a little, or it would turn into the body.
  // As long as it was drawn, from where it was drawn, slanting up as it was drawn
  const turrets = [];
  for (const s of S) {
    if (s.type !== 'gun') continue;
    const g = shapeOf(toM(s.pts));
    const r = clamp(s.r || (s.thick || g.h) * 0.5, 0.035, 0.32);
    const cannon = r >= 0.11;
    const bs = s.base ? [Z(s.base[0]), Y(s.base[1])] : [g.x0, g.cy];
    const mz = s.muz ? [Z(s.muz[0]), Y(s.muz[1])] : [g.x1, g.cy];
    const dz = mz[0] - bs[0];
    const L = Math.max(0.3, Math.hypot(dz, mz[1] - bs[1]));
    const elev = clamp(Math.atan2(mz[1] - bs[1], Math.abs(dz)), -0.35, 1.2);
    const st = body ? body.at(bs[0]) : null;
    const roof = st ? st.yc + st.b : Y(spec.y1);
    // (ROADMAP 11.12: its body itself the barrel - no turret: it fires out of its nose, where it
    // points)
    const whole = !!s.whole;
    const onTop = !whole && bs[1] > roof - Math.max(0.25, r * 2);
    const T = new Kit();
    const metal = s.col && !s.pencil ? shade(s.col, 0.85) : linC(...GUNMETAL);
    const dark = shade(GUNMETAL, 0.75);
    const rb = cannon ? clamp(r * 2.6, 0.3, 0.9) : 0.16;
    // (its foot on the roof; its barrel as high as drawn - on a post, if drawn high over it)
    const mountY = onTop ? roof - 0.05 : bs[1];
    const ay = onTop ? Math.max(cannon ? rb * 0.32 : 0.19, bs[1] - mountY) : 0;
    if (onTop) {
      if (ay > (cannon ? rb * 0.6 : 0.3)) T.cyl(M.metal, rb * 0.35, rb * 0.42, 0, ay - (cannon ? rb * 0.3 : 0.1), dark, { axis: 'y', segs: 12 });
      const y0 = cannon ? Math.max(0, ay - rb * 0.32) : Math.max(0, ay - 0.19);
      if (cannon) {
        T.cyl(M.paint, rb, rb * 0.9, y0 - 0.05, y0 + rb * 0.55, shade(base, 0.85), { axis: 'y', segs: 22 });
        T.sphere(M.paint, rb * 0.92, 0, y0 + rb * 0.5, 0, shade(base, 0.8), 1, 0.45, 1, 18);
      } else {
        T.cyl(M.metal, rb, rb, y0 - 0.04, y0 + 0.12, linC(0.35, 0.35, 0.38), { axis: 'y', segs: 14 });
        T.box(M.matte, -0.09, y0 + 0.08, -0.25, 0.09, y0 + 0.3, 0.2, linC(...GUNMETAL));
        T.box(M.matte, 0.09, y0 + 0.06, -0.15, 0.24, y0 + 0.24, 0.08, linC(0.3, 0.36, 0.24));
      }
    } else if (!whole) T.sphere(M.metal, Math.max(r * 1.7, 0.09), 0, 0, 0, dark, 1, 1, 1, 14);
    // the barrel: along +z from the turret, then slanted up as drawn (round its foot)
    const bar = [];
    const z0 = cannon ? (onTop ? rb * 0.4 : 0) : onTop ? 0.2 : 0;
    bar.push(T.cyl(M.metal, r, r * 0.86, z0, L, metal, { y: ay, segs: 16 }));
    if (cannon) {
      bar.push(T.cyl(M.metal, r * 1.3, r * 1.3, z0, z0 + rb * 0.25, metal, { y: ay, segs: 16 }));
      bar.push(T.cyl(M.metal, r * 1.32, r * 1.32, L - Math.min(0.22, L * 0.2), L, dark, { y: ay, segs: 16 }));
    } else for (let z = z0 + 0.1; z < L - 0.15; z += 0.18) bar.push(T.cyl(M.metal, r * 1.35, r * 1.35, z, z + 0.05, shade(GUNMETAL, 0.8), { y: ay, segs: 12 }));
    bar.push(T.cyl(M.matte, r * 0.62, r * 0.62, L, L + 0.006, linC(0.02, 0.02, 0.03), { y: ay, segs: 12 }));
    for (const geo of bar) {
      geo.translate(0, -ay, 0);
      geo.rotateX(-elev);
      geo.translate(0, ay, 0);
    }
    const node = T.build({ seed: 0.31 + turrets.length * 0.07 });
    node.matrixAutoUpdate = true;
    node.position.set(0, mountY, bs[0]);
    // (one drawn pointing back: turned round)
    const yaw0 = dz < 0 ? Math.PI : 0;
    node.rotation.y = yaw0;
    root.add(node);
    const ml = L + 0.15;
    turrets.push({ node, muzzle: new THREE.Vector3(0, ay + Math.sin(elev) * ml, Math.cos(elev) * ml), pivot: new THREE.Vector3(0, ay, 0), type: cannon ? 'cannon' : 'mg', r, yaw0, arc: whole ? 0.12 : onTop ? Math.PI : 0.4 });
  }
  // ---- the rotors on their masts (ROADMAP 11.13: each one drawn - two, a tandem's; four, a
  // drone's); its tail rotor where it was drawn on its tail, as big
  let rotor = null;
  const rotorsAll = [];
  let tailRotor = new THREE.Object3D();
  const bc = linC(0.12, 0.12, 0.14);
  // (ROADMAP 11.13: a drone's - each as big as drawn, in its guard, on an arm out of its body)
  const hub = body ? body.at((body.z0 + body.z1) / 2) : null;
  for (const [ri, ro] of spec.rotors.entries()) {
    const R = ro.guard ? clamp((ro.w / 2) * 0.9, 0.25, 4) : ri === 0 ? spec.rotorR || 2 : clamp((ro.w / 2) * 1.15, 0.6, spec.rotorR || 2);
    const y = Y(Math.max(ro.cy, spec.y1 + 0.25));
    const blades = R > 2.6 ? 4 : 2;
    const Rk = new Kit();
    for (let k = 0; k < blades; k++) {
      const g = bladeGeo(R, 0.34 * Math.min(1, R / 2), 0.2 * Math.min(1, R / 2), 0.05);
      g.rotateY((k / blades) * Math.PI * 2);
      Rk.add(M.matte, g, bc);
    }
    Rk.cyl(M.metal, 0.2, 0.16, -0.08, 0.14, linC(0.5, 0.5, 0.55), { axis: 'y', segs: 14 });
    Rk.sphere(M.metal, 0.14, 0, 0.16, 0, linC(0.6, 0.6, 0.65), 1, 0.6, 1, 12);
    const node = Rk.build({ seed: 0.5 + ri * 0.01 });
    node.matrixAutoUpdate = true;
    node.position.set(ro.lat || 0, y, Z(ro.cx));
    node.userData.dir = ri % 2 ? -1 : 1;
    root.add(node);
    rotorsAll.push(node);
    if (!rotor) rotor = node;
    // (ROADMAP 11.13: one the game added - a second over it on the same mast, turning the other way:
    // nothing turns it round)
    if (ro.coax) {
      const Ck = new Kit();
      for (let k = 0; k < blades; k++) {
        const g = bladeGeo(R * 0.96, 0.34 * Math.min(1, R / 2), 0.2 * Math.min(1, R / 2), 0.05);
        g.rotateY((k / blades + 0.25) * Math.PI * 2);
        Ck.add(M.matte, g, bc);
      }
      Ck.cyl(M.metal, 0.13, 0.13, -0.42, 0.1, linC(0.5, 0.5, 0.55), { axis: 'y', segs: 12 });
      Ck.sphere(M.metal, 0.12, 0, 0.12, 0, linC(0.6, 0.6, 0.65), 1, 0.6, 1, 12);
      const top = Ck.build({ seed: 0.53 + ri * 0.01 });
      top.matrixAutoUpdate = true;
      top.position.set(ro.lat || 0, y + 0.42, Z(ro.cx));
      top.userData.dir = -node.userData.dir;
      root.add(top);
      rotorsAll.push(top);
    }
    const mk = new Kit();
    if (ro.guard && hub) {
      // (its arm out of the body's middle, its motor at the end of it under the blades, the
      // guard drawn round them)
      const Rg = Math.max(R + 0.06, ro.w / 2);
      const armY = hub.yc + hub.b * 0.2;
      const rA = clamp(Rg * 0.09, 0.045, 0.14);
      const zA = (body.z0 + body.z1) / 2;
      tube(mk, M.paint, [0, armY, zA], [ro.lat || 0, armY, Z(ro.cx)], rA, shade(base, 0.85), 10);
      mk.cyl(M.metal, rA * 1.6, rA * 1.8, armY - rA * 1.4, y - 0.04, linC(0.22, 0.22, 0.25), { axis: 'y', x: ro.lat || 0, z: Z(ro.cx), segs: 14 });
      const ring = new THREE.TorusGeometry(Rg, clamp(Rg * 0.035, 0.025, 0.08), 6, 40);
      ring.rotateX(Math.PI / 2);
      ring.translate(ro.lat || 0, y, Z(ro.cx));
      mk.add(M.paint, ring.toNonIndexed(), shade(base, 0.7));
      // (its light under the motor: red on its left at the front, green on its right, white behind)
      const front = Z(ro.cx) > zA;
      const lc = front ? ((ro.lat || 0) > 0 ? linC(1, 0.12, 0.1) : linC(0.15, 1, 0.3)) : linC(1, 1, 0.95);
      mk.add(M.glow, new THREE.SphereGeometry(rA * 0.9, 10, 8).translate(ro.lat || 0, armY - rA * 1.5, Z(ro.cx)).toNonIndexed(), lc);
      // (and its two struts from the arm to the guard)
      for (const a of [Math.PI / 2, -Math.PI / 2]) {
        const dx = Math.cos(Math.atan2(Z(ro.cx) - zA, ro.lat || 0) + a) * Rg;
        const dz = Math.sin(Math.atan2(Z(ro.cx) - zA, ro.lat || 0) + a) * Rg;
        tube(mk, M.metal, [ro.lat || 0, armY, Z(ro.cx)], [(ro.lat || 0) + dx, y, Z(ro.cx) + dz], rA * 0.45, linC(0.3, 0.3, 0.34), 6);
      }
      root.add(mk.build({ seed: 0.51 + ri * 0.01 }));
      continue;
    }
    const at = body && !ro.lat ? body.at(Z(ro.cx)) : null;
    const topY = at ? at.yc + at.b : Y(spec.y1);
    mk.cyl(M.metal, 0.09, 0.11, topY - 0.08, y, linC(0.4, 0.4, 0.45), { axis: 'y', x: ro.lat || 0, z: Z(ro.cx), segs: 12 });
    if (!ro.lat) mk.cyl(M.paint, 0.32, 0.38, topY - 0.06, topY + 0.14, shade(base, 0.8), { axis: 'y', z: Z(ro.cx), segs: 16 });
    root.add(mk.build({ seed: 0.51 + ri * 0.01 }));
  }
  if (spec.tailRotor) {
    const tr = new Kit();
    const r2 = spec.tailRotor.r;
    for (let k = 0; k < 2; k++) {
      const g = bladeGeo(r2, 0.14, 0.08, 0.03);
      g.rotateX(Math.PI / 2);
      g.rotateX((k / 2) * Math.PI * 2);
      tr.add(M.matte, g, bc);
    }
    tr.cyl(M.metal, 0.07, 0.07, -0.06, 0.06, linC(0.5, 0.5, 0.55), { axis: 'x', segs: 10 });
    tailRotor = tr.build({ seed: 0.52 });
    tailRotor.matrixAutoUpdate = true;
    tailRotor.position.set(0.16, Y(spec.tailRotor.cy), Z(spec.tailRotor.cx));
    root.add(tailRotor);
  }
  // ---- wings: each side on its hinge (they fold up when the parachute opens)
  const wings = [];
  let span = W;
  for (const s of S) {
    if (s.type !== 'wing' || roleOf(s) === 'fin') continue;
    const sh = shapeOf(toM(s.pts));
    const c = colOf(s, design);
    // (ROADMAP 11.13) its shape from above, as drawn: its root in the body - low on it, or high, as
    // it was drawn - its tips up a little
    if (s.plan) {
      const P = s.plan.map(([z, x]) => [Z(z), x]);
      const zs = P.map((q) => q[0]);
      const zm = (Math.min(...zs) + Math.max(...zs)) / 2;
      const st = body ? body.at(zm) : null;
      const yr = st ? (s.mount === 'high' ? st.yc + st.b * 0.62 : st.yc - st.b * 0.42) : sh.cy;
      const chord = Math.max(...zs) - Math.min(...zs);
      const sp = s.span || W * 4;
      span = Math.max(span, sp);
      for (const sx of [-1, 1]) {
        const g = planWing(P, clamp(chord * 0.11, 0.06, 0.3), sx);
        if (!g) continue;
        const wk = new Kit();
        wk.add(M.paint, g, shade(c, 1.08));
        const node = wk.build({ seed: 0.44 + wings.length * 0.03 });
        node.matrixAutoUpdate = true;
        node.position.set(0, yr, 0);
        node.rotation.z = sx * 0.05;
        node.userData.side = sx;
        root.add(node);
        wings.push(node);
      }
      continue;
    }
    const chord = Math.max(0.4, sh.w);
    const sp = s.span ? clamp(s.span, 2.2, 16) : clamp(Math.max(chord * 2.6, spec.L * 0.95), 2.2, 11);
    span = Math.max(span, sp);
    const rootX = body ? Math.max(0.05, half(sh.cx, sh.cy) - 0.04) : W / 2;
    for (const sx of [-1, 1]) {
      const g = wingGeo(0, sx * (sp / 2 - rootX), 0, chord, chord * 0.48, chord * 0.32, clamp(chord * 0.12, 0.06, 0.3), clamp(chord * 0.06, 0.03, 0.16));
      const wk = new Kit();
      wk.add(M.paint, g, shade(c, 1.08));
      // (a darker stripe at its tip)
      const tip = wingGeo(sx * (sp / 2 - rootX) * 0.9, sx * (sp / 2 - rootX), -chord * 0.29, chord * 0.53, chord * 0.48, chord * 0.03, clamp(chord * 0.07, 0.03, 0.17), clamp(chord * 0.065, 0.03, 0.16));
      wk.add(M.paint, tip, shade(c, 0.45));
      const node = wk.build({ seed: 0.44 + wings.length * 0.03 });
      node.matrixAutoUpdate = true;
      node.position.set(sx * rootX, sh.cy, sh.x0);
      node.userData.side = sx;
      root.add(node);
      wings.push(node);
    }
  }
  // ---- the propeller on its nose - (ROADMAP 11.12) or at its back, pushing, in a ring (an airboat's)
  let prop = null;
  const props = [];
  for (const pr of spec.props || []) {
    const R = clamp(Math.max(pr.h, pr.w * 0.8) / 2, 0.35, 1.6);
    const Pk = new Kit();
    for (let k = 0; k < 3; k++) {
      const g = bladeGeo(R, 0.2, 0.1, 0.04);
      g.rotateX(-Math.PI / 2);
      g.rotateZ((k / 3) * Math.PI * 2);
      Pk.add(M.matte, g, linC(0.1, 0.1, 0.12));
    }
    Pk.cyl(M.metal, 0.2, 0.02, 0, 0.36, shade(base, 1), { segs: 14 });
    if (pr.back) Pk.add(M.metal, new THREE.TorusGeometry(R * 1.08, 0.04, 6, 32).translate(0, 0, 0.05), linC(0.32, 0.33, 0.37));
    const node = Pk.build({ seed: 0.55 + props.length * 0.02 });
    node.matrixAutoUpdate = true;
    // (as high as drawn - kept clear of the ground)
    const y = Math.max(Y(pr.cy), R + 0.1);
    if (pr.back) {
      node.position.set(pr.lat || 0, y, Z(Math.min(pr.x0, spec.x0)) - 0.1);
      node.rotation.y = Math.PI;
    } else node.position.set(pr.lat || 0, y, pr.lat ? Z(pr.x1) + 0.05 : Z(Math.max(pr.x1, spec.x1)) + 0.05);
    root.add(node);
    props.push(node);
  }
  prop = props[0] || null;
  // ---- (ROADMAP 11.12) a hovercraft's fans under it, each in its duct; its skirt round its bottom
  const fans = [];
  for (const f of spec.fans || []) {
    const R = clamp(f.w / 2, 0.35, Math.max(0.4, W * 0.42));
    const Fk = new Kit();
    Fk.add(M.metal, new THREE.TorusGeometry(R * 1.06, 0.06, 8, 30).rotateX(Math.PI / 2), linC(0.26, 0.26, 0.3));
    for (let k = 0; k < 4; k++) {
      const g = bladeGeo(R, 0.24, 0.12, 0.03);
      g.rotateY((k / 4) * Math.PI * 2);
      Fk.add(M.matte, g, linC(0.1, 0.1, 0.12));
    }
    Fk.cyl(M.metal, 0.12, 0.12, -0.05, 0.06, linC(0.5, 0.5, 0.55), { axis: 'y', segs: 12 });
    const node = Fk.build({ seed: 0.66 + fans.length * 0.02 });
    node.matrixAutoUpdate = true;
    node.position.set(0, Math.max(0.12, Y(spec.y0) - 0.02), Z(clamp(f.mx, spec.x0 + R, spec.x1 - R)));
    root.add(node);
    fans.push(node);
  }
  if (spec.hover) {
    const a = W / 2 + 0.14;
    const b = spec.L / 2 + 0.12;
    const P = [];
    for (let k = 0; k < 40; k++) {
      const t = (k / 40) * Math.PI * 2;
      // (round at its ends, straight along its sides)
      const c = Math.cos(t);
      const sn = Math.sin(t);
      P.push(new THREE.Vector3(Math.sign(sn) * Math.pow(Math.abs(sn), 0.6) * a, Math.max(0.17, Y(spec.y0) - 0.12), Math.sign(c) * Math.pow(Math.abs(c), 0.6) * b));
    }
    const SK = new Kit();
    SK.add(M.matte, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P, true), 80, 0.17, 8, true), linC(0.1, 0.1, 0.12));
    root.add(SK.build({ seed: 0.67 }));
  }
  // ---- a parachute: packed on its top; the canopy over it, closed until it opens
  let canopy = null;
  let pack = null;
  for (const s of S) {
    if (s.type !== 'chute') continue;
    const sh = shapeOf(toM(s.pts));
    const c = colOf(s, design);
    const pz = clamp(sh.mx, body ? body.z0 + 0.4 : -1, body ? body.z1 - 0.4 : 1);
    const st = body ? body.at(pz) : null;
    const py = st ? st.yc + st.b - 0.02 : Y(spec.y1);
    const pk = new Kit();
    pk.box(M.paint, -0.32, 0, -0.38, 0.32, 0.26, 0.38, shade(c, 0.7));
    pk.box(M.matte, -0.34, 0.08, -0.4, 0.34, 0.12, 0.4, linC(0.1, 0.1, 0.12));
    pack = pk.build({ seed: 0.57 });
    pack.matrixAutoUpdate = true;
    pack.position.set(0, py, pz);
    root.add(pack);
    const rx = clamp(Math.max(sh.w / 2, spec.L * 0.55), 1.6, 7);
    const ry = rx * 0.55;
    const ck = new Kit();
    for (let k = 0; k < 12; k++) {
      const g = new THREE.SphereGeometry(1, 3, 7, (k / 12) * Math.PI * 2, Math.PI / 6, 0, Math.PI / 2);
      g.scale(rx, ry, rx);
      g.translate(0, rx * 0.95, 0);
      ck.add(M.paint, g, k % 2 ? linC(0.98, 0.96, 0.9) : linC(...c));
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      tube(ck, M.matte, [0, 0.2, 0], [Math.sin(a) * rx * 0.97, rx * 0.95, Math.cos(a) * rx * 0.97], 0.015, linC(0.85, 0.85, 0.8), 4);
    }
    canopy = ck.build({ seed: 0.58 });
    canopy.matrixAutoUpdate = true;
    canopy.position.set(0, py + 0.2, pz);
    canopy.scale.setScalar(0.01);
    canopy.visible = false;
    root.add(canopy);
    break;
  }
  // ---- where the rider sits (as game/drawncar.js has it)
  const topY = Y(spec.y1);
  let seatY = Math.max(Y(spec.y0) + 0.5, topY - 0.55);
  let seatZ = clamp(-spec.L * 0.08, -1.2, 0);
  let pose = 'pilot';
  let deck = 0;
  let bar = [0, seatY + 0.95, seatZ + 0.55];
  let grip = 0.22;
  if (spec.kind === 'skate') {
    pose = 'stand';
    deck = topY;
    bar = [0, topY + 1.0, 0.05];
    grip = 0.5;
  } else if (spec.base === 'balloon' && !design.airship) {
    pose = 'stand';
    deck = Y(spec.y0) + 0.1;
    bar = [0, topY + 0.02, Z(spec.x1) - 0.18];
    grip = clamp(W * 0.3, 0.2, 0.4);
  }
  // (ROADMAP 11.13: a fighter's pilot - down in its cockpit, the head in the glass bubble)
  if (canopyAt && spec.base === 'plane') {
    seatY = canopyAt.top - 0.85;
    seatZ = canopyAt.z - 0.15;
    bar = [0, seatY + 0.95, seatZ + 0.55];
  }
  // (ROADMAP 11.13: an airship's pilot - sitting at the front of its gondola, behind its glass)
  if (design.airship) {
    seatY = Y(spec.y0) + 0.05;
    seatZ = Z(spec.x1) - clamp(spec.L * 0.28, 0.6, 1.4);
    bar = [0, seatY + 0.95, seatZ + 0.55];
  }
  let flame = null;
  if (env) {
    const F = new Kit();
    F.add(M.glow, new THREE.ConeGeometry(0.2, 0.9, 10).translate(0, 0.45, 0), linC(1.0, 0.62, 0.2));
    F.add(M.glow, new THREE.ConeGeometry(0.1, 0.55, 8).translate(0, 0.3, 0), linC(1.0, 0.92, 0.55));
    flame = F.build();
    flame.matrixAutoUpdate = true;
    flame.position.set(0, env.y0 - 0.15, env.axis);
    flame.scale.setScalar(0.01);
    root.add(flame);
  }
  // ---- (ROADMAP 11.12) how it stands: a node of its own between it and the vehicle's (which leans
  // it in the turns) - game/vehicles.js tips it onto its tail, its nose, its two wheels, rolls it
  // over. On its roof's wheels only: built on its back
  root.updateMatrixWorld(true);
  if (spec.upside) {
    const b0 = new THREE.Box3().setFromObject(root);
    root.rotation.z = Math.PI;
    root.position.y = b0.max.y;
    root.updateMatrixWorld(true);
  }
  const bb = new THREE.Box3().setFromObject(root);
  const stance = new THREE.Group();
  stance.add(root);
  const outer = new THREE.Group();
  outer.add(stance);
  const zs = spec.wheels.map((w) => Z(w.z));
  for (const t of spec.tracks || []) zs.push(Z(t.x0), Z(t.x1));
  const standAt = { zr: zs.length ? Math.min(...zs) : Z(spec.x0), zf: zs.length ? Math.max(...zs) : Z(spec.x1), top: Math.max(0.5, bb.max.y) };
  const t0 = turrets[0] || null;
  return {
    body: outer,
    stance,
    standAt,
    props,
    fans,
    vtolAt,
    wheels,
    prop: prop || new THREE.Object3D(),
    rotor: rotor || new THREE.Object3D(),
    tailRotor,
    rotorsAll,
    turret: t0 ? t0.node : null,
    muzzle: t0 ? t0.muzzle : null,
    turrets,
    wings,
    canopy,
    pack,
    flame,
    jetsAt,
    pose,
    deck,
    seatAt: [0, seatY + 0.5, seatZ],
    bar,
    grip,
    halfLen: Math.max(0.8, spec.L / 2),
    halfWid: Math.max(W / 2 + 0.3, span / 2),
    heightM: Math.max(1.2, topY + 0.6),
    radius: clamp(spec.L * 0.42, 0.9, 3.2),
    circles: [-spec.L * 0.3, 0, spec.L * 0.3],
    circleR: clamp(W / 2, 0.5, 1.1),
    span,
    sailAt,
  };
}

// the outline o with the cabins' tops over it: at each z where a cabin is, the higher top
function mergeTop(o, cabs) {
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [z] of o) {
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  for (const c of cabs) {
    for (const [z] of c) {
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
  }
  const N = 60;
  const top = [];
  const bot = [];
  for (let i = 0; i <= N; i++) {
    const z = z0 + ((z1 - z0) * (0.002 + (i / N) * 0.996));
    let sp = spanAt(o, z);
    for (const c of cabs) {
      const s2 = spanAt(c, z);
      if (s2) sp = sp ? [Math.min(sp[0], s2[0]), Math.max(sp[1], s2[1])] : s2;
    }
    if (!sp) continue;
    top.push([z, sp[1]]);
    bot.push([z, sp[0]]);
  }
  return top.concat(bot.reverse());
}

// a car's lights (wide, low, at its nose's corners; red at its tail), its grille, its bumpers,
// its sills, its door seams and handles, its mirrors - on the body as it was lofted
function carDetails(K, M, body, bc) {
  const G = body.plan || {};
  const zF = body.z1;
  const zB = body.z0;
  const front = body.at(zF - 0.12);
  const back = body.at(zB + 0.12);
  const dark = linC(0.09, 0.09, 0.11);
  const chrome = linC(0.84, 0.85, 0.89);
  // (its lights: at its nose's corners, a little under its middle)
  const yF = front.yc + front.b * 0.12;
  const yB = back.yc + back.b * 0.22;
  const r = clamp(front.b * 0.34, 0.06, 0.16);
  for (const sx of [-1, 1]) {
    const xF = sx * front.hw * 0.62;
    K.sphere(M.metal, r * 1.18, xF, yF, zF - 0.05, chrome, 1.35, 0.7, 0.42, 14);
    K.sphere(M.glow, r, xF, yF, zF - 0.025, linC(1.0, 0.97, 0.86), 1.35, 0.66, 0.42, 14);
    const xB = sx * back.hw * 0.66;
    K.sphere(M.glow, r * 0.9, xB, yB, zB + 0.03, linC(0.95, 0.1, 0.12), 1.5, 0.55, 0.4, 12);
  }
  // (its grille, between its lights)
  K.box(M.matte, -front.hw * 0.3, yF - r * 0.9, zF - 0.1, front.hw * 0.3, yF + r * 0.55, zF + 0.012, dark);
  for (let k = 1; k <= 3; k++) {
    const y = yF - r * 0.9 + ((r * 1.45) * k) / 4;
    K.box(M.metal, -front.hw * 0.29, y - 0.008, zF - 0.09, front.hw * 0.29, y + 0.008, zF + 0.018, chrome);
  }
  // (its bumpers: a rounded bar across its nose and its tail)
  const bar = (z, R, sgn) => {
    const g = new THREE.CylinderGeometry(0.07, 0.07, R.hw * 1.84, 12).rotateZ(Math.PI / 2);
    g.translate(0, R.yc - R.b * 0.72, z + sgn * 0.02);
    K.add(M.matte, g, linC(0.13, 0.13, 0.15));
  };
  bar(zF, body.at(zF - 0.05), 1);
  bar(zB, body.at(zB + 0.05), -1);
  // (its sills: a dark band low along each side; its door seams, its handles)
  const zs = [];
  for (let z = zB + 0.35; z <= zF - 0.35; z += 0.12) zs.push(z);
  const belt = typeof G.belt === 'number' ? G.belt : null;
  const seams = [];
  if (G.door !== undefined) seams.push(G.door + 0.04);
  if (G.pillar !== undefined) seams.push(G.pillar);
  for (const sx of [-1, 1]) {
    const sill = zs.map((z) => {
      const R = body.at(z);
      return [z, R.yc - R.b * 0.78];
    });
    if (sill.length > 1) {
      const g = ribbon(sill, 0, 0.12, sx);
      const a = g.attributes.position;
      for (let i = 0; i < a.count; i++) a.setX(i, sx * (body.half(a.getZ(i), a.getY(i)) + 0.008));
      K.add(M.matte, g, linC(0.14, 0.14, 0.17));
    }
    if (belt === null) continue;
    for (const z of seams) {
      const R = body.at(z);
      const pts = [];
      for (let k = 0; k <= 6; k++) pts.push([z, belt - 0.02 - ((belt - 0.02 - (R.yc - R.b * 0.62)) * k) / 6]);
      const g = ribbon(pts, 0, 0.022, sx);
      const a = g.attributes.position;
      for (let i = 0; i < a.count; i++) a.setX(i, sx * (body.half(a.getZ(i), a.getY(i)) + 0.006));
      K.add(M.matte, g, shade(bc, 0.42));
      // (a handle behind it)
      const hz = z - 0.28;
      const hy = belt - 0.12;
      const hx = sx * (body.half(hz, hy) + 0.012);
      K.box(M.metal, hx - 0.012, hy - 0.018, hz - 0.08, hx + 0.012, hy + 0.018, hz + 0.08, chrome);
    }
    // (its mirror, at the front of its windows)
    if (G.front !== undefined) {
      const mz = Math.min(G.front - 0.05, zF - 0.5);
      const my = belt + 0.06;
      const mx = sx * (body.half(mz, my) + 0.06);
      K.box(M.paint, mx - 0.05, my - 0.04, mz - 0.05, mx + 0.05, my + 0.05, mz + 0.06, linC(...bc));
      K.box(M.glass, mx - 0.04, my - 0.03, mz - 0.062, mx + 0.04, my + 0.04, mz - 0.05, linC(0.55, 0.62, 0.7));
    }
  }
}

// a geometry's faces turned the other way
function flipFaces(g) {
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
  }
}

// ------------------------------------------------------------------ a thing for the hand
// H: { parts: [{ type, pts ([z, y] metres, the hand at the origin, its front +z) , col, pencil,
// neon }], color }. Its frame: x across, y up, z forward. Returns what game/weapons.js needs:
// { group, length, kind, muzzle | tip }
export function buildHandPolished(H) {
  const M = itemMats();
  const K = new Kit();
  const P = H.parts;
  const base = H.color;
  const gun = P.some((p) => p.type === 'barrel');
  const dflt = gun ? GUNMETAL : STEEL;
  const colP = (p, d = dflt) => (p.col && !p.pencil ? p.col : d);
  let zMax = 0;
  let zMin = 0;
  for (const p of P) for (const [z] of p.pts) {
    zMax = Math.max(zMax, z);
    zMin = Math.min(zMin, z);
  }
  const out = { length: Math.max(0.3, zMax - zMin), kind: H.kind };
  for (const p of P) {
    const sh = shapeOf(p.pts);
    const o = sh.closed ? outline(p.pts) : null;
    if (p.type === 'body' || p.type === 'head' || p.type === 'stock' || p.type === 'mag' || p.type === 'grip' || p.type === 'scope') {
      if (p.type === 'scope') {
        // (a sight: a tube on mounts, glass at both ends)
        const r = clamp(sh.h / 2, 0.012, 0.035);
        K.cyl(M.paint, r, r, sh.x0, sh.x1, linC(0.12, 0.12, 0.15), { y: sh.cy, segs: 14 });
        K.cyl(M.glass, r * 0.85, r * 0.85, sh.x1 - 0.004, sh.x1 + 0.003, linC(0.4, 0.75, 0.95), { y: sh.cy, segs: 14 });
        K.cyl(M.glass, r * 0.7, r * 0.7, sh.x0 - 0.003, sh.x0 + 0.004, linC(0.4, 0.75, 0.95), { y: sh.cy, segs: 12 });
        continue;
      }
      if (!o || o.length < 3) {
        // (drawn as a line: a round rod along it)
        const pts = thin(p.pts, 0.02, 40);
        for (let i = 1; i < pts.length; i++) tube(K, M.round, [0, pts[i - 1][1], pts[i - 1][0]], [0, pts[i][1], pts[i][0]], p.type === 'grip' ? 0.018 : 0.014, linC(...colP(p, p.type === 'grip' ? [0.2, 0.14, 0.12] : dflt)), 10);
        continue;
      }
      const t = p.type === 'head' ? clamp(sh.h * 0.55, 0.05, 0.12) : p.type === 'grip' ? 0.034 : p.type === 'mag' ? 0.026 : p.type === 'stock' ? 0.04 : gun ? 0.042 : 0.03;
      const lofted = p.type === 'body' || p.type === 'head';
      const c = p.type === 'grip' ? colP(p, gun ? [0.16, 0.16, 0.19] : [0.22, 0.15, 0.12]) : p.type === 'stock' ? colP(p, [0.5, 0.32, 0.2]) : p.type === 'mag' ? colP(p, [0.18, 0.18, 0.21]) : colP(p);
      if (lofted) {
        const lb = loftBody(o, t, { n: p.type === 'head' ? 3 : 4.2, lean: 0.05, p: 4, NZ: 28, K: 20 });
        K.add(p.type === 'head' ? M.metal : M.paint, lb.paint, linC(...c));
      } else K.add(p.type === 'grip' ? M.matte : M.paint, plate(o, t, -t / 2, t * 0.35), linC(...c));
      // (a grip's grooves)
      if (p.type === 'grip') {
        for (let k = 1; k <= 3; k++) {
          const y = sh.y0 + (sh.h * k) / 4;
          const sp = spanAt(o, sh.cx);
          if (!sp) continue;
          K.box(M.matte, -t / 2 - 0.002, y - 0.003, sh.x0 + sh.w * 0.15, t / 2 + 0.002, y + 0.003, sh.x1 - sh.w * 0.15, linC(0.06, 0.06, 0.07));
        }
      }
      continue;
    }
    if (p.type === 'barrel') {
      const r = clamp((p.thick || sh.h) / 2, 0.008, 0.06);
      const y = sh.cy;
      const m = linC(...colP(p, [0.24, 0.25, 0.29]));
      K.cyl(M.metal, r, r * 0.94, sh.x0, sh.x1, m, { y, segs: 14 });
      K.cyl(M.metal, r * 1.25, r * 1.25, sh.x1 - Math.min(0.04, sh.w * 0.15), sh.x1, shade(GUNMETAL, 0.7), { y, segs: 14 });
      K.cyl(M.matte, r * 0.62, r * 0.62, sh.x1 - 0.003, sh.x1 + 0.002, linC(0.02, 0.02, 0.03), { y, segs: 10 });
      K.box(M.matte, -0.004, y + r, sh.x1 - 0.03, 0.004, y + r + 0.014, sh.x1 - 0.015, linC(0.1, 0.1, 0.12));
      if (!out.muzzles) out.muzzles = [];
      out.muzzles.push(new THREE.Vector3(0, y, sh.x1 + 0.02));
      continue;
    }
    if (p.type === 'blade') {
      // (a blade: thick along its spine, thin to its edges - a diamond, steel; its fuller darker)
      if (!o || o.length < 3) {
        const pts = thin(p.pts, 0.02, 40);
        for (let i = 1; i < pts.length; i++) tube(K, M.metal, [0, pts[i - 1][1], pts[i - 1][0]], [0, pts[i][1], pts[i][0]], 0.008, linC(...STEEL), 6);
        out.tip = new THREE.Vector3(0, sh.cy, sh.x1);
        continue;
      }
      const lb = loftBody(o, 0.02, { n: 1.15, lean: 0, p: 6, NZ: 30, K: 16 });
      K.add(M.metal, lb.paint, linC(...colP(p, STEEL)));
      const spine = [];
      for (let i = 0; i <= 12; i++) {
        const z = sh.x0 + (sh.w * i) / 12;
        const sp = spanAt(o, z);
        if (sp) spine.push([z, (sp[0] + sp[1]) / 2]);
      }
      for (const sx of [-1, 1]) if (spine.length > 1) K.add(M.matte, ribbon(spine.slice(0, -2), sx * 0.0105, 0.006, sx), linC(0.45, 0.47, 0.52));
      out.tip = new THREE.Vector3(0, sh.cy, sh.x1);
      continue;
    }
    if (p.type === 'guard') {
      K.box(M.metal, -0.03, sh.y0, sh.cx - 0.015, 0.03, sh.y1, sh.cx + 0.015, linC(0.7, 0.62, 0.3));
      continue;
    }
    if (p.type === 'spring') {
      const r = clamp(Math.min(sh.w, sh.h) / 2, 0.015, 0.06);
      const g = helixGeometry(0, sh.y0, sh.y1, r, clamp(Math.round((p.coils || 6) / 2), 3, 8));
      g.translate(0, 0, sh.mx);
      K.add(M.metal, g, linC(...STEEL));
      continue;
    }
    if (p.type === 'chute') {
      K.box(M.paint, -0.04, sh.y0, sh.mx - 0.05, 0.04, sh.y0 + 0.05, sh.mx + 0.05, shade(colP(p, [0.9, 0.3, 0.3]), 0.8));
      continue;
    }
    // (anything else drawn on it: inked on both its sides)
    const pts = thin(p.pts, 0.012, 120);
    const c = p.neon ? linC(...p.col) : inkOn(p.col && !p.pencil ? p.col : INK, base);
    for (const sx of [-1, 1]) K.add(p.neon ? M.glow : M.matte, ribbon(pts, sx * 0.024, 0.006, sx), c);
  }
  // (a trigger guard, in front of a gun's grip)
  const grip = P.find((p) => p.type === 'grip');
  if (gun && grip) {
    const sh = shapeOf(grip.pts);
    K.torus(M.metal, 0.028, 0.005, 0, sh.y1 - 0.02, sh.x1 + 0.03, linC(0.3, 0.3, 0.34), 0, Math.PI / 2);
  }
  out.group = K.build({ seed: 0.27 });
  if (out.muzzles && out.muzzles.length) out.muzzle = out.muzzles[0];
  if (!out.muzzle && !out.tip) out.tip = new THREE.Vector3(0, 0, zMax);
  return out;
}
