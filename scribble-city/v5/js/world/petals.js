// (ROADMAP 20.10, the owner's word: "they do not really look like flowers") A blossom as the owner's pictures draw bougainvillea: not a
// ball of colour but a mass of small papery bracts, each a little kite turned its own way - dark ones in under the mass, lighter ones
// on top where the light falls - and leaves among them. One shape a shade (three of the flower's, one of the leaves'), lit as the
// ball they sit on, all under the ids they are given: a whole vine is outlined once, round all of it.
import * as THREE from 'three';
import { makeSurface } from '../render/materials.js';

const _c = new THREE.Color();

// the flowers' pen: the leaves', fuller, seen from both sides (no light of its own: the hour's lit windows' strength went into it,
// and every flower was white - round 8)
export function flowerMat(M) {
  if (!M.flower) M.flower = makeSurface({ kind: 'leaf', vcolor: true, ang: 0.6, line: 0.3, objMask: true, wash: 0.9, density: 1.2, side: THREE.DoubleSide });
  return M.flower;
}

// r: the dice (r(), r.range, r.pick); o: { mat, leafMat, idF, idG, base (the flower's colour), greens (the leaves'), green (their
// share), sq (how flat the mass is) }
export function blossom(ctx, r, cx, cy, cz, rad, n, o) {
  const sq = o.sq !== undefined ? o.sq : 0.78;
  const share = o.green !== undefined ? o.green : 0.2;
  const P = [[], [], [], []];
  const N = [[], [], [], []];
  // (the body of the mass under the bracts: a rough ball in the flower's deep colour - without it they were specks on the wall)
  {
    const g = new THREE.IcosahedronGeometry(rad * 0.7, 0);
    const gp = g.attributes.position;
    const gn = g.attributes.normal;
    const seed = r() * 1000;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i);
      const y = gp.getY(i);
      const z = gp.getZ(i);
      const q = 1 / (rad * 0.7);
      const k = 1 + 0.3 * Math.sin(x * q * 3.1 + seed) * Math.cos(z * q * 2.7 + seed * 0.7);
      gp.setXYZ(i, x * k, y * k * sq, z * k);
      const l = Math.hypot(x, y, z) || 1;
      gn.setXYZ(i, x / l, y / l, z / l);
    }
    g.translate(cx, cy, cz);
    const leafy = share >= 0.45;
    if (leafy) _c.copy(r.pick(o.greens)).multiplyScalar(0.8);
    else _c.copy(o.base).multiplyScalar(0.66);
    ctx.B.add(leafy ? o.leafMat : o.mat, g, null, leafy ? o.idG : o.idF, { color: _c.clone() });
  }
  for (let i = 0; i < n; i++) {
    let dx = r.range(-1, 1);
    let dy = r.range(-0.75, 1);
    let dz = r.range(-1, 1);
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l;
    dy /= l;
    dz /= l;
    const rr = rad * (0.62 + 0.42 * r());
    const px = cx + dx * rr;
    const py = cy + dy * rr * sq;
    const pz = cz + dz * rr;
    const green = r() < share;
    const s = green ? r.range(0.13, 0.21) : r.range(0.1, 0.18);
    // (a across the ball's own direction, turned at random in that plane and tipped a little outward; b across both)
    let ax = -dz;
    let ay = 0;
    let az = dx;
    if (Math.abs(ax) + Math.abs(az) < 1e-3) ax = 1;
    const t = r.range(0, Math.PI * 2);
    const bx0 = dy * az - dz * ay;
    const by0 = dz * ax - dx * az;
    const bz0 = dx * ay - dy * ax;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const tip = r.range(0.25, 0.7);
    let ux = ax * ct + bx0 * st + dx * tip;
    let uy = ay * ct + by0 * st + dy * tip;
    let uz = az * ct + bz0 * st + dz * tip;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    let vx = dy * uz - dz * uy;
    let vy = dz * ux - dx * uz;
    let vz = dx * uy - dy * ux;
    const vl = Math.hypot(vx, vy, vz) || 1;
    vx /= vl;
    vy /= vl;
    vz /= vl;
    const w = s * (green ? 0.38 : 0.52);
    // the kite: its stem end, its two sides a third of the way up, its tip
    const A = [px - ux * s * 0.45, py - uy * s * 0.45, pz - uz * s * 0.45];
    const T = [px + ux * s, py + uy * s, pz + uz * s];
    const R = [px + ux * s * 0.1 + vx * w, py + uy * s * 0.1 + vy * w, pz + uz * s * 0.1 + vz * w];
    const L = [px + ux * s * 0.1 - vx * w, py + uy * s * 0.1 - vy * w, pz + uz * s * 0.1 - vz * w];
    // (dark in under the mass, light on top of it)
    const k = green ? 3 : dy > 0.3 ? (r() < 0.55 ? 2 : 1) : dy < -0.2 ? (r() < 0.7 ? 0 : 1) : r() < 0.3 ? 0 : 1;
    P[k].push(...A, ...R, ...T, ...A, ...T, ...L);
    for (let q = 0; q < 6; q++) N[k].push(dx, dy * 0.8 + 0.2, dz);
  }
  for (let k = 0; k < 4; k++) {
    if (!P[k].length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P[k], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N[k], 3));
    if (k === 3) _c.copy(r.pick(o.greens));
    else if (k === 0) _c.copy(o.base).multiplyScalar(0.8);
    else if (k === 1) _c.copy(o.base);
    else _c.copy(o.base).lerp(LIGHT, 0.45);
    ctx.B.add(k === 3 ? o.leafMat : o.mat, g, null, k === 3 ? o.idG : o.idF, { color: _c.clone() });
  }
}
const LIGHT = new THREE.Color(1, 0.72, 0.86);
