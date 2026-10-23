import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { inflateShape } from './inflate.js';
import { clamp } from '../core/util.js';

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
      const B = inflateShape(q.ol, q.W, { n: q.edge || 3, R: (q.W / 2) * 0.9, res: q.res || 40 });
      if (!B) break;
      const { n, e1, e2 } = AX[q.ax];
      const m4 = new THREE.Matrix4().makeBasis(new THREE.Vector3(...n), new THREE.Vector3(...e2), new THREE.Vector3(...e1));
      m4.setPosition(n[0] * q.c - o[0], n[1] * q.c - o[1], n[2] * q.c - o[2]);
      B.geo.applyMatrix4(m4);
      Kt.add(mat, B.geo, col);
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
  for (const q of sh.prims) {
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
