import * as THREE from 'three';
import { lin3 } from '../render/materials.js';
import { nextId } from './kit.js';

// (v5, ROADMAP 11.18) Many small parts in one geometry: the goods on a shelf, the clothes on a
// rail, the shoes on a wall. A shop of the real world is a thousand small things, and a thousand
// THREE geometries made and merged one by one would cost the block's build more than all the rest
// of it; a soup writes its corners straight into its arrays instead, each part with its own id (so
// the inker draws round every can and every box) and its own colour, and goes to the batch as one
// geometry (kit.js Batch.add with { soup: true }).
//
// Faces nobody can see are left out: the bottom of whatever stands on something, the back of
// whatever stands against a wall (skip: a mask of the faces, see F).

// the faces of a box, by the world's axes
export const F = { PX: 1, NX: 2, PY: 4, NY: 8, PZ: 16, NZ: 32 };

const MAXV = 60000;
const _lin = new Map();
// [r, g, b] (sRGB, as the rooms give them) -> linear, remembered
export function lin(c) {
  const k = c[0] * 1e6 + c[1] * 1e3 + c[2];
  let v = _lin.get(k);
  if (!v) {
    v = lin3(c[0], c[1], c[2]);
    _lin.set(k, v);
  }
  return v;
}

export class Soup {
  constructor() {
    this.reset();
  }

  reset() {
    this.P = [];
    this.N = [];
    this.C = [];
    this.I = [];
    this.X = [];
    this.n = 0;
  }

  get full() {
    return this.n > MAXV;
  }

  // a quad a, b, c, d (counter-clockwise seen from the side n faces); col linear
  quad(a, b, c, d, n, col, id) {
    const o = this.n;
    for (const p of [a, b, c, d]) {
      this.P.push(p[0], p[1], p[2]);
      this.N.push(n[0], n[1], n[2]);
      this.C.push(col[0], col[1], col[2]);
      this.I.push(id);
    }
    this.X.push(o, o + 1, o + 2, o, o + 2, o + 3);
    this.n += 4;
  }

  // an axis-aligned box (world), col sRGB [r, g, b]; skip: F mask of the faces left out
  box(x0, y0, z0, x1, y1, z1, col, id = nextId(), skip = 0) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    if (z0 > z1) [z0, z1] = [z1, z0];
    const c = lin(col);
    if (!(skip & F.PX)) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], c, id);
    if (!(skip & F.NX)) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], c, id);
    if (!(skip & F.PY)) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], c, id);
    if (!(skip & F.NY)) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], c, id);
    if (!(skip & F.PZ)) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c, id);
    if (!(skip & F.NZ)) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], c, id);
    return id;
  }

  // an upright cylinder (its side and its top; seg sides)
  cyl(x, y0, z, r, h, col, id = nextId(), seg = 8, top = true, r1 = r) {
    const c = lin(col);
    const y1 = y0 + h;
    const o = this.n;
    // the side: a ring of corners at the bottom and the top, a normal each (smooth)
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      this.P.push(x + ca * r, y0, z + sa * r, x + ca * r1, y1, z + sa * r1);
      this.N.push(ca, 0, sa, ca, 0, sa);
      this.C.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      this.I.push(id, id);
    }
    for (let i = 0; i < seg; i++) {
      const a = o + i * 2;
      this.X.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    this.n += (seg + 1) * 2;
    if (top) {
      const t = this.n;
      this.P.push(x, y1, z);
      this.N.push(0, 1, 0);
      this.C.push(c[0], c[1], c[2]);
      this.I.push(id);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        this.P.push(x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1);
        this.N.push(0, 1, 0);
        this.C.push(c[0], c[1], c[2]);
        this.I.push(id);
      }
      for (let i = 0; i < seg; i++) this.X.push(t, t + 2 + i, t + 1 + i);
      this.n += seg + 2;
    }
    return id;
  }

  // a ball (low: lat x lon), for fruit, the tops of things, a mannequin's head
  ball(x, y, z, r, col, id = nextId(), lat = 4, lon = 6, sy = 1) {
    const c = lin(col);
    const o = this.n;
    for (let j = 0; j <= lat; j++) {
      const v = (j / lat) * Math.PI;
      const sv = Math.sin(v);
      const cv = Math.cos(v);
      for (let i = 0; i <= lon; i++) {
        const u = (i / lon) * Math.PI * 2;
        const nx = Math.cos(u) * sv;
        const nz = Math.sin(u) * sv;
        this.P.push(x + nx * r, y + cv * r * sy, z + nz * r);
        this.N.push(nx, cv, nz);
        this.C.push(c[0], c[1], c[2]);
        this.I.push(id);
      }
    }
    for (let j = 0; j < lat; j++) {
      for (let i = 0; i < lon; i++) {
        const a = o + j * (lon + 1) + i;
        const b = a + lon + 1;
        this.X.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }
    this.n += (lat + 1) * (lon + 1);
    return id;
  }

  geometry() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(this.n * 2), 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aId', new THREE.Float32BufferAttribute(this.I, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.X, 1) : new THREE.Uint16BufferAttribute(this.X, 1));
    return g;
  }

  // into the batch, as one geometry (and empty again)
  flushTo(B, mat) {
    const g = this.geometry();
    if (g) B.add(mat, g, null, nextId(), { soup: true });
    this.reset();
  }
}

/**
 * A soup in a building's front frame (kit.js Facade: u along the front, y up, d out of it): the
 * rooms are furnished this way. Every street runs north-south or east-west, so a box in the frame
 * is a box in the world; the faces to skip are the frame's own (FF: the back is -d).
 */
export const FF = { FRONT: 1, BACK: 2, LEFT: 4, RIGHT: 8, TOP: 16, BOTTOM: 32 };

export class FSoup extends Soup {
  constructor(f) {
    super();
    this.f = f;
    // the frame's faces as the world's
    const ax = (x, z) => (Math.abs(x) > 0.5 ? (x > 0 ? F.PX : F.NX) : z > 0 ? F.PZ : F.NZ);
    this.map = [
      [FF.FRONT, ax(f.nx, f.nz)],
      [FF.BACK, ax(-f.nx, -f.nz)],
      [FF.RIGHT, ax(f.ux, f.uz)],
      [FF.LEFT, ax(-f.ux, -f.uz)],
      [FF.TOP, F.PY],
      [FF.BOTTOM, F.NY],
    ];
  }

  skipOf(m) {
    let s = 0;
    if (!m) return 0;
    for (const [a, b] of this.map) if (m & a) s |= b;
    return s;
  }

  fbox(u0, y0, d0, u1, y1, d1, col, id = nextId(), skip = 0) {
    const a = this.f.p(u0, y0, d0);
    const b = this.f.p(u1, y1, d1);
    return this.box(a[0], a[1], a[2], b[0], b[1], b[2], col, id, this.skipOf(skip));
  }

  fcyl(u, d, r, y0, h, col, id = nextId(), seg = 8, top = true, r1 = r) {
    // (v5, ROADMAP 11.43: the height through the frame too, like a box's - a store up on a floor of
    // the mega mall is lifted with its front, world/kit.js LiftFacade; its bottles, jars and cans
    // were left at the street's height, standing in the air of the store under it)
    const p = this.f.p(u, y0, d);
    return this.cyl(p[0], p[1], p[2], r, h, col, id, seg, top, r1);
  }

  fball(u, y, d, r, col, id = nextId(), lat = 4, lon = 6, sy = 1) {
    const p = this.f.p(u, y, d);
    return this.ball(p[0], p[1], p[2], r, col, id, lat, lon, sy);
  }
}
