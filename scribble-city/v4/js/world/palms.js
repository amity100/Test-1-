import * as THREE from 'three';
import { nextId } from './kit.js';
import { CURB } from './layout.js';

// The palms of the first boulevard: a curving, tapering trunk built ring by ring, a crown of
// eleven fronds arching down, five coconuts. Trunks are merged into the city; the crowns of the
// whole city are drawn in one go (the fronds sway in the evening breeze).

export function palmGeometry(height, lean) {
  // a curving, tapering trunk built ring by ring, with the bark's rings in the uv
  const segs = 16;
  const sides = 10;
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean.x * 0.25, height * 0.35, lean.y * 0.25),
    new THREE.Vector3(lean.x * 0.65, height * 0.72, lean.y * 0.65),
    new THREE.Vector3(lean.x, height, lean.y),
  ]);
  const frames = curve.computeFrenetFrames(segs, false);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = 0.32 * (1 - t * 0.45) * (1 + 0.06 * Math.sin(t * 60));
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const dx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const dy = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const dz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(c.x + dx * r, c.y + dy * r, c.z + dz * r);
      nor.push(dx, dy, dz);
      uv.push(k / sides, t * height);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * (sides + 1) + k;
      const b = a + sides + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return { geo: g, top: curve.getPointAt(1) };
}

export function frondGeometry(len, width, droop) {
  const g = new THREE.PlaneGeometry(width, len, 1, 12);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y / len;
    // out and arching down, the tip folding a little
    const out = Math.sin(t * Math.PI * 0.5) * len * 0.92;
    const down = -droop * t * t * len + Math.sin(t * Math.PI) * len * 0.18;
    const x = p.getX(i) * (1 - t * 0.6);
    p.setXYZ(i, x, down, out);
  }
  g.computeVertexNormals();
  return g;
}

// A palm at (x, z), drawn from the random r exactly as the first boulevard drew its own (the
// same calls in the same order), into the city's batches. The crown is merged too: each frond
// remembers how far it reaches from the crown, for the breeze.
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _mx = new THREE.Matrix4();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
export function palm(ctx, r, x, z, height, o = {}) {
  const lean = new THREE.Vector2(r.range(-1.2, 1.2), r.range(-0.8, 0.8));
  if (o.away) {
    // by a road: it leans any way but out over the traffic
    const d = lean.x * o.away[0] + lean.y * o.away[1];
    if (d < 0) {
      lean.x -= o.away[0] * d * 2;
      lean.y -= o.away[1] * d * 2;
    }
  }
  const y0 = o.y0 !== undefined ? o.y0 : CURB;
  const M = ctx.M;
  const id = ctx.objects ? ctx.objects.begin(ctx, 'tree', x, z) : 0;
  const { geo, top } = palmGeometry(height, lean);
  geo.translate(x, y0, z);
  ctx.B.add(M.trunk, geo, null, nextId());
  const cx = x + top.x;
  const cy = y0 + top.y;
  const cz = z + top.z;
  const n = 11;
  for (let k = 0; k < n; k++) {
    const len = r.range(4.2, 5.6);
    const fg = frondGeometry(len, 1.25, r.range(0.5, 0.85)).toNonIndexed();
    _e.set(r.range(-0.25, 0.1), (k / n) * Math.PI * 2 + r.range(-0.2, 0.2), 0, 'YXZ');
    _q.setFromEuler(_e);
    _mx.compose(_p.set(cx, cy, cz), _q, _s);
    // (how far from the crown, for the sway: measured before it is placed)
    const reach = new Float32Array(fg.attributes.position.count);
    for (let i = 0; i < reach.length; i++) {
      const vx = fg.attributes.position.getX(i);
      const vz = fg.attributes.position.getZ(i);
      reach[i] = Math.hypot(vx, vz);
    }
    fg.applyMatrix4(_mx);
    const list = reach;
    let vi = 0;
    ctx.B.add(M.frond, fg, null, nextId(), { sway: () => list[vi++] });
  }
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const nut = new THREE.SphereGeometry(0.17, 6, 4);
    nut.translate(cx + Math.cos(a) * 0.25, cy - 0.3, cz + Math.sin(a) * 0.25);
    ctx.B.add(M.nut, nut, null, nextId());
  }
  ctx.col.addCircle(x, z, 0.45, 0, height, 'tree');
  if (ctx.objects) ctx.objects.end(ctx, id, { palm: true });
  return { x, z, top: [cx, cy, cz] };
}
