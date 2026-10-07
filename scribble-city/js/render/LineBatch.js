import * as THREE from 'three';

// Base strip of the instanced stroke: (t, side) pairs along the segment.
const SUBDIV = 4;
const baseStrip = (() => {
  const pos = [];
  for (let i = 0; i <= SUBDIV; i++) {
    const t = i / SUBDIV;
    pos.push(t, -1, 0, t, 1, 0);
  }
  const idx = [];
  for (let i = 0; i < SUBDIV; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  return { pos: new THREE.Float32BufferAttribute(pos, 3), idx: new THREE.Uint16BufferAttribute(idx, 1) };
})();

export const INK = [0.11, 0.15, 0.33];
export const BLACK_INK = [0.07, 0.07, 0.09];
export const RED_INK = [0.72, 0.1, 0.12];

/**
 * A batch of sketchy pencil strokes rendered with one draw call.
 * Static batches are built once; dynamic batches are refilled every frame.
 */
export class LineBatch {
  constructor(capacity, material, { dynamic = false } = {}) {
    this.capacity = Math.max(1, capacity);
    this.dynamic = dynamic;
    this.count = 0;
    this.a = new Float32Array(this.capacity * 3);
    this.b = new Float32Array(this.capacity * 3);
    this.col = new Float32Array(this.capacity * 4);
    this.par = new Float32Array(this.capacity * 4);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', baseStrip.pos);
    geo.setIndex(baseStrip.idx);
    const usage = dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage;
    this.attrA = new THREE.InstancedBufferAttribute(this.a, 3).setUsage(usage);
    this.attrB = new THREE.InstancedBufferAttribute(this.b, 3).setUsage(usage);
    this.attrC = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(usage);
    this.attrP = new THREE.InstancedBufferAttribute(this.par, 4).setUsage(usage);
    geo.setAttribute('iA', this.attrA);
    geo.setAttribute('iB', this.attrB);
    geo.setAttribute('iCol', this.attrC);
    geo.setAttribute('iPar', this.attrP);
    geo.instanceCount = 0;
    this.geometry = geo;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = !dynamic;
    this.mesh.renderOrder = 10;
    this.mesh.matrixAutoUpdate = dynamic;
  }

  push(ax, ay, az, bx, by, bz, r, g, b, a, width, seed, overshoot, wobble) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    const i3 = i * 3;
    const i4 = i * 4;
    this.a[i3] = ax;
    this.a[i3 + 1] = ay;
    this.a[i3 + 2] = az;
    this.b[i3] = bx;
    this.b[i3 + 1] = by;
    this.b[i3 + 2] = bz;
    this.col[i4] = r;
    this.col[i4 + 1] = g;
    this.col[i4 + 2] = b;
    this.col[i4 + 3] = a;
    this.par[i4] = width;
    this.par[i4 + 1] = seed;
    this.par[i4 + 2] = overshoot;
    this.par[i4 + 3] = wobble;
    return i;
  }

  setAlpha(i, a) {
    this.col[i * 4 + 3] = a;
  }

  clear() {
    this.count = 0;
  }

  // Upload after filling. For static batches also computes bounds for culling.
  commit() {
    this.geometry.instanceCount = this.count;
    for (const at of [this.attrA, this.attrB, this.attrC, this.attrP]) {
      at.clearUpdateRanges();
      at.addUpdateRange(0, this.count * at.itemSize);
      at.needsUpdate = true;
    }
    if (!this.dynamic) this.computeBounds();
  }

  computeBounds() {
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      v.set(this.a[i * 3], this.a[i * 3 + 1], this.a[i * 3 + 2]);
      box.expandByPoint(v);
      v.set(this.b[i * 3], this.b[i * 3 + 1], this.b[i * 3 + 2]);
      box.expandByPoint(v);
    }
    box.expandByScalar(3);
    this.geometry.boundingBox = box;
    const s = new THREE.Sphere();
    box.getBoundingSphere(s);
    this.geometry.boundingSphere = s;
  }
}

/**
 * Collects strokes in plain arrays (handy while generating the world) and turns
 * them into a LineBatch at the end.
 */
export class StrokeList {
  constructor() {
    this.data = [];
    this.seed = 1;
  }

  get length() {
    return this.data.length / 14;
  }

  seg(a, b, o = {}) {
    const c = o.color || INK;
    const strokes = o.strokes || 1;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const os = o.overshoot !== undefined ? o.overshoot : Math.min(0.15 + len * 0.035, 1.6);
    const wob = o.wobble !== undefined ? o.wobble : 0.008;
    for (let s = 0; s < strokes; s++) {
      this.seed = (this.seed * 1.618 + 0.7319) % 997;
      const sd = this.seed + s * 0.37;
      // second stroke slightly offset, lighter
      const jit = s === 0 ? 0 : (o.jitter !== undefined ? o.jitter : 0.04 + len * 0.004);
      const jx = (Math.sin(sd * 12.9) * 0.5) * jit;
      const jy = (Math.sin(sd * 78.2) * 0.5) * jit;
      const jz = (Math.sin(sd * 37.7) * 0.5) * jit;
      this.data.push(
        a[0] + jx, a[1] + jy, a[2] + jz,
        b[0] - jz, b[1] + jx, b[2] - jy,
        c[0], c[1], c[2], (o.alpha !== undefined ? o.alpha : 0.92) * (s === 0 ? 1 : 0.7),
        (o.width || 2) * (s === 0 ? 1 : 0.8), sd, os, wob,
      );
    }
  }

  poly(points, closed, o = {}) {
    const n = points.length;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) this.seg(points[i], points[(i + 1) % n], o);
  }

  // Horizontal circle (ring) around a vertical axis.
  ring(cx, cy, cz, r, segs, o = {}) {
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * r, cy, cz + Math.sin(t) * r]);
    }
    this.poly(pts, true, { overshoot: 0.02, ...o });
  }

  boxEdges(min, max, o = {}) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const v = (x, y, z) => [x, y, z];
    const vert = { ...o, strokes: o.vStrokes || o.strokes || 1 };
    // verticals
    this.seg(v(x0, y0, z0), v(x0, y1, z0), vert);
    this.seg(v(x1, y0, z0), v(x1, y1, z0), vert);
    this.seg(v(x1, y0, z1), v(x1, y1, z1), vert);
    this.seg(v(x0, y0, z1), v(x0, y1, z1), vert);
    // top
    this.seg(v(x0, y1, z0), v(x1, y1, z0), o);
    this.seg(v(x1, y1, z0), v(x1, y1, z1), o);
    this.seg(v(x1, y1, z1), v(x0, y1, z1), o);
    this.seg(v(x0, y1, z1), v(x0, y1, z0), o);
    if (!o.noBottom) {
      this.seg(v(x0, y0, z0), v(x1, y0, z0), o);
      this.seg(v(x1, y0, z0), v(x1, y0, z1), o);
      this.seg(v(x1, y0, z1), v(x0, y0, z1), o);
      this.seg(v(x0, y0, z1), v(x0, y0, z0), o);
    }
  }

  toBatch(material, extra = 0) {
    const n = this.length;
    const batch = new LineBatch(n + extra, material);
    const d = this.data;
    for (let i = 0; i < n; i++) {
      const k = i * 14;
      batch.push(d[k], d[k + 1], d[k + 2], d[k + 3], d[k + 4], d[k + 5], d[k + 6], d[k + 7], d[k + 8], d[k + 9], d[k + 10], d[k + 11], d[k + 12], d[k + 13]);
    }
    batch.commit();
    return batch;
  }
}
