import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { inflateShape } from './inflate.js';
import { clamp } from '../core/util.js';
import { lathe, pipe, cbox, plate } from './armkit.js';

// (ROADMAP 11.27) A thing designed from its drawing (game/itemdesign.js), made: its primitives in the
// car's frame round its pivot - boxes, cylinders and cones, balls, rings, flat pieces moulded from their
// outline (game/inflate.js), a balloon's envelope turned round its axis gore by gore - each in its own
// colour; what turns, spins, bobs as its role says (game/fuse.js draw: a gun's mount stays as the gun
// turns, a minigun's barrels spin as it fires); its hand (a little bent, as drawn); the drawing's own
// lines, tidied onto it, inked on both its faces. Returns [{ m, role, side }] as game/fusedraw.js
// buildLook does.

const AX = {
  x: { n: [1, 0, 0], e1: [0, 0, 1], e2: [0, 1, 0] },
  y: { n: [0, 1, 0], e1: [0, 0, 1], e2: [-1, 0, 0] },
  z: { n: [0, 0, 1], e1: [-1, 0, 0], e2: [0, 1, 0] },
};
// (what each colour of it is made of)
const MAT_OF = { metal: 'metal', dark: 'metal', iron: 'metal', paint: 'paint', body: 'paint', furn: 'paint', trim: 'paint', accent: 'paint', fabA: 'paint', fabB: 'paint', fA: 'matte', fB: 'matte', wood: 'matte', wicker: 'matte', rim: 'matte', rope: 'matte',
  // (ROADMAP 11.28: the things of game/gearlook.js - a shape may say what any of its colours is made of)
  chrome: 'metal', steel: 'metal', copper: 'metal', rubber: 'matte', canvas: 'matte', glass: 'glass', glow: 'glow', flame: 'glow', light: 'glow' };
const _Y = new THREE.Vector3(0, 1, 0);
const _Z = new THREE.Vector3(0, 0, 1);
// (ROADMAP 28.24) the finer primitives as the plainer ones they stand where: what is seen of them on a plane
// (game/gearlook.js silOf), how deep they are under a line of ink (depthAt)
export const plainPrim = (q) => (q.t === 'rbox' ? { ...q, t: 'box' } : q.t === 'lat' ? { ...q, t: 'cyl', r0: Math.max(...q.prof.map((p) => p[1])), r1: Math.max(...q.prof.map((p) => p[1])) } : q.t === 'ext' || q.t === 'band' ? { ...q, t: 'slab' } : q);

// a geometry mirrored across x, its faces still facing out
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

function inPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// a balloon's profile ([r, y]) between two heights, cut where they cross it
function cutProf(prof, y0, y1) {
  const out = [];
  const at = (y) => {
    for (let i = 1; i < prof.length; i++) {
      if (prof[i][1] >= y) {
        const t = (y - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1] || 1e-9);
        return [prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * t, y];
      }
    }
    return prof[prof.length - 1].slice();
  };
  out.push(at(y0));
  for (const q of prof) if (q[1] > y0 && q[1] < y1) out.push(q);
  out.push(at(y1));
  return out;
}

// (ROADMAP 28.6) how fine a slab's grid is made, of what its design asks (1: as asked): a phone makes them coarser -
// a wing, a rotor's blades, a parachute's canopy were 14 to 26 thousand triangles each (game/game.js sets it)
let SLAB_K = 1;
export function setSlabRes(k) {
  SLAB_K = Math.max(0.3, Math.min(1, k || 1));
}

// one primitive into a kit, round o (its origin, the car's frame)
function addPrim(Kt, q, o, mat, col, matOf, colOf) {
  switch (q.t) {
    case 'box':
      Kt.box(mat, q.p0[0] - o[0], q.p0[1] - o[1], q.p0[2] - o[2], q.p1[0] - o[0], q.p1[1] - o[1], q.p1[2] - o[2], col);
      break;
    case 'cyl': {
      const a = new THREE.Vector3(q.p0[0] - o[0], q.p0[1] - o[1], q.p0[2] - o[2]);
      const b = new THREE.Vector3(q.p1[0] - o[0], q.p1[1] - o[1], q.p1[2] - o[2]);
      const d = b.clone().sub(a);
      const len = d.length();
      if (len < 1e-5) break;
      const g = new THREE.CylinderGeometry(q.r1, q.r0, len, q.n || 12);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_Y, d.normalize()));
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      Kt.add(mat, g, col);
      break;
    }
    case 'sph':
      Kt.sphere(mat, q.r, q.c[0] - o[0], q.c[1] - o[1], q.c[2] - o[2], col, 1, 1, 1, 12);
      break;
    case 'tor': {
      const g = new THREE.TorusGeometry(q.R, q.r, 6, 22);
      if (q.ax === 'x') g.rotateY(Math.PI / 2);
      else if (q.ax === 'y') g.rotateX(Math.PI / 2);
      g.translate(q.c[0] - o[0], q.c[1] - o[1], q.c[2] - o[2]);
      Kt.add(mat, g, col);
      break;
    }
    case 'slab': {
      // (ROADMAP 11.28: a small one finer than it need be - its own grid, coarser: game/gearlook.js)
      const B = inflateShape(q.ol, q.W, { n: q.edge || 3, R: (q.W / 2) * 0.9, res: Math.max(12, Math.round((q.res || 40) * SLAB_K)) });
      if (!B) break;
      const { n, e1, e2 } = AX[q.ax];
      const m4 = new THREE.Matrix4().makeBasis(new THREE.Vector3(...n), new THREE.Vector3(...e2), new THREE.Vector3(...e1));
      m4.setPosition(n[0] * q.c - o[0], n[1] * q.c - o[1], n[2] * q.c - o[2]);
      B.geo.applyMatrix4(m4);
      Kt.add(mat, B.geo, col);
      break;
    }
    // (ROADMAP 28.24) the finer ones: what a thing is made of when it is made as such things are - a part turned on a
    // lathe to a profile, a pipe bent through its points, a block with its edges broken, a plate cut to an outline
    // with a bevel, a ring of bolts or teeth, a belt round an outline with bars across it (a tank's track)
    case 'lat': {
      const a = new THREE.Vector3(q.p0[0] - o[0], q.p0[1] - o[1], q.p0[2] - o[2]);
      const b = new THREE.Vector3(q.p1[0] - o[0], q.p1[1] - o[1], q.p1[2] - o[2]);
      const d = b.clone().sub(a);
      const len = d.length();
      if (len < 1e-5) break;
      const g = lathe(q.prof.map(([t, r]) => [t * len, r]), { segs: q.n || 14 });
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_Z, d.normalize()));
      g.translate(a.x, a.y, a.z);
      Kt.add(mat, g, col);
      break;
    }
    case 'pipe':
      if (q.pts.length >= 2) Kt.add(mat, pipe(q.pts.map((p) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]), q.r, { segs: q.n || 6, steps: q.steps || q.pts.length * 4, closed: !!q.closed, tension: q.tension }), col);
      break;
    case 'rbox':
      Kt.add(mat, cbox(q.p0[0] - o[0], q.p0[1] - o[1], q.p0[2] - o[2], q.p1[0] - o[0], q.p1[1] - o[1], q.p1[2] - o[2], q.e || 0.012), col);
      break;
    case 'ext': {
      const g = plate(q.ol, -q.W / 2, q.W / 2, { bevel: q.e === undefined ? 0.008 : q.e });
      if (q.ax === 'y') g.rotateZ(Math.PI / 2);
      else if (q.ax === 'z') g.rotateY(-Math.PI / 2);
      const { n } = AX[q.ax];
      g.translate(n[0] * q.c - o[0], n[1] * q.c - o[1], n[2] * q.c - o[2]);
      Kt.add(mat, g, col);
      break;
    }
    case 'ring': {
      for (let i = 0; i < q.n; i++) {
        const a = (q.a0 || 0) + (i / q.n) * Math.PI * 2;
        // (made on y, its place out along x; then round, then onto its own axis)
        const g = q.w ? new THREE.BoxGeometry(q.d, q.h, q.w) : new THREE.CylinderGeometry(q.r, q.r1 === undefined ? q.r : q.r1, q.h, q.sides || 6);
        g.translate(q.R, 0, 0);
        g.rotateY(a);
        if (q.ax === 'x') g.rotateZ(-Math.PI / 2);
        else if (q.ax === 'z') g.rotateX(Math.PI / 2);
        g.translate(q.c[0] - o[0], q.c[1] - o[1], q.c[2] - o[2]);
        Kt.add(mat, g, col);
      }
      break;
    }
    case 'band': {
      const g = beltGeo(q, o);
      if (g) Kt.add(mat, g, col);
      if (q.links) {
        const bars = barsOf(q, o);
        for (const b of bars) Kt.add(matOf(q.kb || q.k), b, colOf(q.kb || q.k));
      }
      break;
    }
    case 'lathe': {
      // (a balloon's envelope: gore by gore round its axis, two colours - in bands across it if so)
      const top = q.prof[q.prof.length - 1][1];
      const N = q.gores;
      const parts = q.bands ? bandsOf(q.bands, top) : [[0, top, -1]];
      for (let i = 0; i < N; i++) {
        for (const [y0, y1, kk] of parts) {
          const pr = cutProf(q.prof, y0, y1).map(([r, y]) => new THREE.Vector2(Math.max(r, 0.002), y));
          const g = new THREE.LatheGeometry(pr, 3, (i / N) * Math.PI * 2, (Math.PI * 2) / N);
          g.translate(q.c[0] - o[0], q.c[1] - o[1], q.c[2] - o[2]);
          const k = kk >= 0 ? q.ks[kk] : q.ks[i % 2];
          Kt.add(matOf(k), g, colOf(k));
        }
      }
      break;
    }
    default:
      break;
  }
}

// (ROADMAP 28.24) a belt round a closed outline on the plane square to q.ax at q.c: q.W wide across the plane, q.th
// thick inwards from the outline - its outside, its inside and its two edges
function beltFrame(q, o) {
  const A = AX[q.ax];
  let P = q.ol.map((p) => [p[0], p[1]]);
  let area = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area < 0) P = P.reverse();
  const n = P.length;
  // (each point's way out: between its two edges' own)
  const out = P.map((p, i) => {
    const a = P[(i + n - 1) % n];
    const b = P[(i + 1) % n];
    const e0 = [p[0] - a[0], p[1] - a[1]];
    const e1 = [b[0] - p[0], b[1] - p[1]];
    const l0 = Math.hypot(e0[0], e0[1]) || 1;
    const l1 = Math.hypot(e1[0], e1[1]) || 1;
    const x = e0[1] / l0 + e1[1] / l1;
    const y = -e0[0] / l0 - e1[0] / l1;
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  });
  const X = (u, w, d) => new THREE.Vector3(A.n[0] * (q.c + d) + A.e1[0] * u + A.e2[0] * w - o[0], A.n[1] * (q.c + d) + A.e1[1] * u + A.e2[1] * w - o[1], A.n[2] * (q.c + d) + A.e1[2] * u + A.e2[2] * w - o[2]);
  const V = (u, w) => new THREE.Vector3(A.e1[0] * u + A.e2[0] * w, A.e1[1] * u + A.e2[1] * w, A.e1[2] * u + A.e2[2] * w);
  return { A, P, n, out, X, V };
}
function beltGeo(q, o) {
  const { A, P, n, out, X, V } = beltFrame(q, o);
  if (n < 3) return null;
  const pos = [];
  const N = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  // (a four-sided face, facing the way it is told to)
  const quad = (a, b, c, d, want) => {
    N.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    const L = N.dot(want) >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const v of L) pos.push(v.x, v.y, v.z);
  };
  const hw = q.W / 2;
  const th = q.th || 0.03;
  const side = new THREE.Vector3(A.n[0], A.n[1], A.n[2]);
  const back = side.clone().negate();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = P[i];
    const b = P[j];
    const ai = [a[0] - out[i][0] * th, a[1] - out[i][1] * th];
    const bi = [b[0] - out[j][0] * th, b[1] - out[j][1] * th];
    const el = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const fo = V((b[1] - a[1]) / el, -(b[0] - a[0]) / el);
    quad(X(a[0], a[1], -hw), X(b[0], b[1], -hw), X(b[0], b[1], hw), X(a[0], a[1], hw), fo);
    quad(X(ai[0], ai[1], -hw), X(bi[0], bi[1], -hw), X(bi[0], bi[1], hw), X(ai[0], ai[1], hw), fo.clone().negate());
    quad(X(a[0], a[1], hw), X(b[0], b[1], hw), X(bi[0], bi[1], hw), X(ai[0], ai[1], hw), side);
    quad(X(a[0], a[1], -hw), X(b[0], b[1], -hw), X(bi[0], bi[1], -hw), X(ai[0], ai[1], -hw), back);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}
// (the bars across its outside: q.links of them evenly round it, each q.gw long, q.gh high, as wide as the belt and
// a little over)
function barsOf(q, o) {
  const { A, P, n, X, V } = beltFrame(q, o);
  const out = [];
  if (n < 3) return out;
  const len = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = P[i];
    const b = P[(i + 1) % n];
    len.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
    total += len[i];
  }
  const gh = q.gh || 0.03;
  const side = new THREE.Vector3(A.n[0], A.n[1], A.n[2]);
  let i = 0;
  let acc = 0;
  for (let k = 0; k < q.links; k++) {
    const s = ((k + 0.5) / q.links) * total;
    while (i < n - 1 && acc + len[i] < s) acc += len[i++];
    const a = P[i];
    const b = P[(i + 1) % n];
    const t = (s - acc) / (len[i] || 1);
    const tu = (b[0] - a[0]) / (len[i] || 1);
    const tw = (b[1] - a[1]) / (len[i] || 1);
    const up = V(tw, -tu);
    const along = new THREE.Vector3().crossVectors(side, up);
    const g = new THREE.BoxGeometry(q.W * (q.over || 1.04), gh, q.gw || 0.05);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(side, up, along));
    const c = X(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0).addScaledVector(up, gh * 0.4);
    g.translate(c.x, c.y, c.z);
    out.push(g);
  }
  return out;
}

// (bands across a balloon: [[y0, y1] of its height, 0..1]) its stretches up it and their colour: the
// bands in its second, the rest its first
function bandsOf(bands, top) {
  const out = [];
  let y = 0;
  for (const [a, b] of bands) {
    if (a * top > y) out.push([y, a * top, 0]);
    out.push([a * top, b * top, 1]);
    y = b * top;
  }
  if (y < top) out.push([y, top, 0]);
  return out;
}

// how far out of its plane (on side sgn) the thing is at (u, w) on it - where its lines are inked
function depthAt(sh, u, w, sgn) {
  const { n, e1, e2 } = AX[sh.ax];
  const X = [0, 1, 2].map((k) => n[k] * sh.c + e1[k] * u + e2[k] * w);
  const ni = n.indexOf(1);
  const others = [0, 1, 2].filter((k) => k !== ni);
  let best = 0;
  for (const q0 of sh.prims) {
    const q = plainPrim(q0);
    let lo = null;
    let hi = null;
    if (q.t === 'box') {
      if (others.every((k) => X[k] >= Math.min(q.p0[k], q.p1[k]) - 1e-4 && X[k] <= Math.max(q.p0[k], q.p1[k]) + 1e-4)) {
        lo = Math.min(q.p0[ni], q.p1[ni]);
        hi = Math.max(q.p0[ni], q.p1[ni]);
      }
    } else if (q.t === 'cyl') {
      const d = [0, 1, 2].map((k) => q.p1[k] - q.p0[k]);
      const len = Math.hypot(...d) || 1e-9;
      const dir = d.map((x) => x / len);
      if (Math.abs(dir[ni]) > 0.9) {
        const dd = Math.hypot(...others.map((k) => X[k] - q.p0[k]));
        if (dd <= Math.max(q.r0, q.r1)) {
          lo = Math.min(q.p0[ni], q.p1[ni]);
          hi = Math.max(q.p0[ni], q.p1[ni]);
        }
      } else if (Math.abs(dir[ni]) < 0.2) {
        const t = others.reduce((s, k) => s + (X[k] - q.p0[k]) * dir[k], 0) / len;
        if (t >= 0 && t <= 1) {
          const C = [0, 1, 2].map((k) => q.p0[k] + d[k] * t);
          const r = q.r0 + (q.r1 - q.r0) * t;
          const dd = Math.hypot(...others.map((k) => X[k] - C[k]));
          if (dd <= r) {
            const h = Math.sqrt(r * r - dd * dd);
            lo = C[ni] - h;
            hi = C[ni] + h;
          }
        }
      }
    } else if (q.t === 'sph') {
      const dd = Math.hypot(...others.map((k) => X[k] - q.c[k]));
      if (dd <= q.r) {
        const h = Math.sqrt(q.r * q.r - dd * dd);
        lo = q.c[ni] - h;
        hi = q.c[ni] + h;
      }
    } else if (q.t === 'slab') {
      if (q.ax === sh.ax && inPoly(u, w, q.ol)) {
        lo = q.c - q.W / 2;
        hi = q.c + q.W / 2;
      }
    } else if (q.t === 'lathe' && ni !== 1) {
      const y = X[1] - q.c[1];
      const pr = q.prof;
      if (y >= 0 && y <= pr[pr.length - 1][1]) {
        let i = 1;
        while (i < pr.length - 1 && pr[i][1] < y) i++;
        const t = (y - pr[i - 1][1]) / (pr[i][1] - pr[i - 1][1] || 1e-9);
        const r = pr[i - 1][0] + (pr[i][0] - pr[i - 1][0]) * t;
        const k = others.find((j) => j !== 1);
        const dd = Math.abs(X[k] - q.c[k]);
        if (dd <= r) {
          const h = Math.sqrt(r * r - dd * dd);
          lo = q.c[ni] - h;
          hi = q.c[ni] + h;
        }
      }
    }
    if (lo === null) continue;
    best = Math.max(best, sgn > 0 ? hi - X[ni] : X[ni] - lo);
  }
  return best;
}

// (its hand: a gun a little bowed along it, wings a little up or down out to their tips)
function bender(sh, pv) {
  const amp = sh.bend || 0;
  if (!(amp > 0.002) || !sh.bendR) return null;
  const [a0, a1] = sh.bendR;
  const L = Math.max(1e-3, a1 - a0);
  if (sh.kind === 'wing') {
    return (p, i) => {
      const t = Math.min(1, Math.abs(p[i]) / L);
      p[i + 1] += amp * t * t;
    };
  }
  return (p, i) => {
    const t = (p[i + 2] - a0) / L;
    if (t > 0 && t < 1) p[i + 1] += amp * Math.sin(Math.PI * t);
  };
}

export function buildDesign(p, body) {
  const sh = p.shape;
  const M = itemMats();
  const pv = sh.pivot;
  const colOf = (k) => {
    const c = k === 'body' ? body : (sh.pal && sh.pal[k]) || body;
    return linC(c[0], c[1], c[2]);
  };
  const matOf = (k) => M[(sh.mats && sh.mats[k]) || MAT_OF[k] || 'paint'];
  const spinO = sh.spinAt ? [0, sh.spinAt[1], pv[2]] : null;
  const { n, e1, e2 } = AX[sh.ax];
  // (the drawing's lines on both its faces, as far out as it is there)
  const inkLines = [];
  // (ROADMAP 11.28: the moving part each line lies on, if any - game/gearlook.js sheet)
  const inkGs = [];
  for (const [li, L] of (sh.ink || []).entries()) {
    for (const sgn of [1, -1]) {
      inkGs.push(sh.inkG ? sh.inkG[li] : null);
      inkLines.push(
        L.map(([u, w]) => {
          const k = sh.c + sgn * (depthAt(sh, u, w, sgn) + 0.012);
          return [n[0] * k + e1[0] * u + e2[0] * w - pv[0], n[1] * k + e1[1] * u + e2[1] * w - pv[1], n[2] * k + e1[2] * u + e2[2] * w - pv[2]];
        }),
      );
    }
  }
  const warp = bender(sh, pv);
  const out = [];
  // (ROADMAP 11.28) its other moving parts, each round its own pivot (a rotor's blades, a saw, a flame
  // that shows only as it is used: game/gear.js animate)
  const GR = sh.groups || {};
  const makeOne = (mirror) => {
    const kits = { gun: new Kit(), base: new Kit(), spin: new Kit() };
    for (const name of Object.keys(GR)) kits[name] = new Kit();
    for (const q of sh.prims) {
      const g = kits[q.g] ? q.g || 'gun' : 'gun';
      const o = g === 'spin' ? spinO : GR[g] ? GR[g].at : pv;
      addPrim(kits[g], q, o, matOf(q.k), colOf(q.k), matOf, colOf);
    }
    if (mirror) for (const Kt of Object.values(kits)) for (const list of Kt.parts.values()) for (const it of list) flipX(it.g);
    const inner = new THREE.Group();
    if (kits.gun.parts.size) inner.add(kits.gun.build({ seed: 0.53, warp }));
    let spin = null;
    if (kits.spin.parts.size) {
      spin = new THREE.Group();
      spin.position.set(spinO[0] - pv[0], spinO[1] - pv[1], spinO[2] - pv[2]);
      spin.add(kits.spin.build({ seed: 0.71 }));
      inner.add(spin);
    }
    const groups = {};
    let seed = 0.31;
    for (const [name, G] of Object.entries(GR)) {
      if (!kits[name].parts.size) continue;
      const node = new THREE.Group();
      const sx = mirror ? -1 : 1;
      node.position.set(sx * (G.at[0] - pv[0]), G.at[1] - pv[1], G.at[2] - pv[2]);
      node.add(kits[name].build({ seed: (seed += 0.137) % 1 }));
      inner.add(node);
      groups[name] = { node, ax: G.ax || 'y', kind: G.kind || 'spin', at: G.at };
    }
    const m = new THREE.Group();
    m.position.set(mirror ? -pv[0] : pv[0], pv[1], pv[2]);
    m.add(inner);
    const ud = m.userData;
    ud.groups = groups;
    ud.lineNode = inner;
    const lines = mirror ? inkLines.map((L) => L.map((q) => [-q[0], q[1], q[2]])) : inkLines;
    // (those on a moving part, in its own frame: they go round with it - game/fuse.js draw)
    ud.lines = lines.filter((L, i) => {
      const G = inkGs[i] && groups[inkGs[i]];
      if (!G) return true;
      const p0 = G.node.position;
      (G.lines || (G.lines = [])).push(L.map((q) => [q[0] - p0.x, q[1] - p0.y, q[2] - p0.z]));
      return false;
    });
    ud.fill = sh.fill || null;
    let role = 'drawn';
    if (sh.role === 'barrel') {
      const mz = sh.muzzle || [pv[0], pv[1], pv[2] + 1];
      Object.assign(ud, { pivot: inner, muzzle: new THREE.Vector3(mz[0] - pv[0], mz[1] - pv[1], mz[2] - pv[2]), pivotPt: new THREE.Vector3(0, 0, 0), r: clamp((p.n && p.n.r) || 0.06, 0.04, 0.24), yaw0: 0, gatling: spin });
      role = 'barrel';
    } else if (sh.role === 'dballoon') {
      ud.base = m.position.clone();
      ud.stringTo = null;
      ud.ropes = (sh.ropes || []).map((r) => ({ a: new THREE.Vector3(r.a[0] - pv[0], r.a[1] - pv[1], r.a[2] - pv[2]), b: new THREE.Vector3(...r.b) }));
      role = 'dballoon';
    } else if (sh.role === 'dwing') {
      ud.flap = inner;
      role = 'dwing';
    } else if (sh.role === 'gear') {
      ud.inner = inner;
      role = 'gear';
    }
    if (sh.dih) inner.rotation.z = mirror ? -sh.dih : sh.dih;
    ud.dih = sh.dih || 0;
    out.push({ m, role, side: mirror ? -1 : 1 });
    // (what stays as it turns: a gun's mount, a turret's ring, a mortar's plate)
    if (kits.base.parts.size) {
      const bm = new THREE.Group();
      bm.position.set(mirror ? -pv[0] : pv[0], pv[1], pv[2]);
      bm.add(kits.base.build({ seed: 0.29 }));
      bm.userData.fill = sh.fill || null;
      out.push({ m: bm, role: 'drawn', side: mirror ? -1 : 1 });
    }
  };
  makeOne(false);
  if (sh.mirror) makeOne(true);
  return out;
}
