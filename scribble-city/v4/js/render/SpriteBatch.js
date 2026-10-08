import * as THREE from 'three';
import { makeSpriteBatchMaterial } from './materials.js';

const quad = {
  pos: new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3),
  idx: new THREE.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1),
};

/**
 * Many atlas pictures in one draw call. Each one can turn to face you around its upright
 * (axis = 0), face the camera fully (axis = [2, 0, 0]), or keep its own right / up vectors.
 */
export class SpriteBatch {
  constructor(capacity, atlasTex, { dynamic = false, transparent = false, noFog = false, nearFade = 0, lit = true } = {}) {
    this.capacity = capacity;
    this.count = 0;
    this.dynamic = dynamic;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', quad.pos);
    geo.setIndex(quad.idx);
    const mk = (n) => {
      const at = new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n);
      if (dynamic) at.setUsage(THREE.DynamicDrawUsage);
      return at;
    };
    this.attrs = { iPos: mk(3), iSize: mk(2), iRect: mk(4), iTint: mk(4), iAxis: mk(3), iUp: mk(3), iPivot: mk(2) };
    for (const k in this.attrs) geo.setAttribute(k, this.attrs[k]);
    geo.instanceCount = 0;
    this.geometry = geo;
    this.material = makeSpriteBatchMaterial(atlasTex, { noFog, nearFade, lit, opaque: !transparent });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = !dynamic;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = transparent ? 12 : 0;
  }

  /** o: { x,y,z, w,h, rect:[u,v,du,dv], tint:[r,g,b,a], axis:[x,y,z], up:[x,y,z], pivot:[px,py] } */
  add(o) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.set(i, o);
    return i;
  }

  set(i, o) {
    const a = this.attrs;
    a.iPos.array.set([o.x, o.y, o.z], i * 3);
    a.iSize.array.set([o.w, o.h], i * 2);
    a.iRect.array.set(o.rect, i * 4);
    const t = o.tint || [1, 1, 1, 1];
    a.iTint.array.set([t[0], t[1], t[2], t[3] === undefined ? 1 : t[3]], i * 4);
    a.iAxis.array.set(o.axis || [0, 0, 0], i * 3);
    a.iUp.array.set(o.up || [0, 0, 0], i * 3);
    a.iPivot.array.set(o.pivot || [0.5, 0], i * 2);
  }

  setPos(i, x, y, z) {
    const p = this.attrs.iPos.array;
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
  }

  setAlpha(i, a) {
    this.attrs.iTint.array[i * 4 + 3] = a;
  }

  setSize(i, w, h) {
    this.attrs.iSize.array[i * 2] = w;
    this.attrs.iSize.array[i * 2 + 1] = h;
  }

  clear() {
    this.count = 0;
  }

  commit() {
    this.geometry.instanceCount = this.count;
    for (const k in this.attrs) {
      const at = this.attrs[k];
      at.clearUpdateRanges();
      at.addUpdateRange(0, Math.max(1, this.count) * at.itemSize);
      at.needsUpdate = true;
    }
    if (!this.dynamic) {
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      const p = this.attrs.iPos.array;
      const s = this.attrs.iSize.array;
      for (let i = 0; i < this.count; i++) {
        const r = Math.max(s[i * 2], s[i * 2 + 1]);
        box.expandByPoint(v.set(p[i * 3] + r, p[i * 3 + 1] + r, p[i * 3 + 2] + r));
        box.expandByPoint(v.set(p[i * 3] - r, p[i * 3 + 1] - r, p[i * 3 + 2] - r));
      }
      this.geometry.boundingBox = box;
      const sph = new THREE.Sphere();
      box.getBoundingSphere(sph);
      this.geometry.boundingSphere = sph;
    }
  }
}
