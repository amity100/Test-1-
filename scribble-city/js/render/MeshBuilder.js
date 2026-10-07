import * as THREE from 'three';

export const STYLE = {
  PLAIN: 0,
  WIN_LOFT: 1,
  WIN_TOWER: 2,
  WIN_GLASS: 3,
  WIN_OFFICE: 4,
  WIN_BROWN: 5,
  ROOF: 6,
  AWNING: 7,
  ROAD_AVE: 10,
  ROAD_ST: 11,
  INTERSECTION: 12,
  SIDEWALK: 13,
  GRASS: 14,
  WATER: 15,
  GRAPH: 16,
  DIRT: 17,
  PLAZA: 18,
};

/**
 * Accumulates "paper" surfaces (quads, boxes, cylinders...) with the per-vertex
 * data the sketch surface shader needs: crayon color, face-local meters (aUV)
 * and facade parameters (window grid etc).
 */
export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.uv = [];
    this.f1 = [];
    this.f2 = [];
    this.idx = [];
    this.vcount = 0;
  }

  // p0..p3 counter-clockwise when seen from the front. uvs: 4 [u,v] pairs.
  quad(p0, p1, p2, p3, n, color, uvs, f1 = [0, 3, 3, 1], f2 = [0, 0, 0, 0]) {
    const base = this.vcount;
    const ps = [p0, p1, p2, p3];
    for (let i = 0; i < 4; i++) {
      this.pos.push(ps[i][0], ps[i][1], ps[i][2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.f1.push(f1[0], f1[1], f1[2], f1[3]);
      this.f2.push(f2[0], f2[1], f2[2], f2[3]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vcount += 4;
  }

  tri(p0, p1, p2, n, color, uvs, f1 = [0, 3, 3, 1], f2 = [0, 0, 0, 0]) {
    const base = this.vcount;
    const ps = [p0, p1, p2];
    for (let i = 0; i < 3; i++) {
      this.pos.push(ps[i][0], ps[i][1], ps[i][2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.f1.push(f1[0], f1[1], f1[2], f1[3]);
      this.f2.push(f2[0], f2[1], f2[2], f2[3]);
    }
    this.idx.push(base, base + 1, base + 2);
    this.vcount += 3;
  }

  /**
   * Axis aligned box. opts:
   *  color, sideStyle (window style), cell [w,h], groundH, seed, topStyle, baseY (for window rows),
   *  skipBottom (default true), skipTop
   */
  box(min, max, o = {}) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const c = o.color || [0.972, 0.957, 0.914];
    const seed = o.seed || 0;
    const st = o.sideStyle || 0;
    const cw = o.cell ? o.cell[0] : 3;
    const ch = o.cell ? o.cell[1] : 3;
    const gh = o.groundH || 0;
    const by = o.baseY !== undefined ? o.baseY : y0;
    const h = y1 - y0;
    const v0 = y0 - by;
    const v1 = y1 - by;
    const faceH = y1 - by;
    const sides = o.sides || [true, true, true, true];
    // +Z face (south), viewed from +z: left = x0, right = x1
    const w = x1 - x0;
    const d = z1 - z0;
    if (sides[0]) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c,
      [[0, v0], [w, v0], [w, v1], [0, v1]], [st, cw, ch, seed + 0.11], [w, faceH, gh, h]);
    // -Z face (north), viewed from -z: left = x1, right = x0
    if (sides[1]) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], c,
      [[0, v0], [w, v0], [w, v1], [0, v1]], [st, cw, ch, seed + 0.23], [w, faceH, gh, h]);
    // +X face (east), viewed from +x: left = z1, right = z0
    if (sides[2]) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], c,
      [[0, v0], [d, v0], [d, v1], [0, v1]], [st, cw, ch, seed + 0.37], [d, faceH, gh, h]);
    // -X face (west), viewed from -x: left = z0, right = z1
    if (sides[3]) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], c,
      [[0, v0], [d, v0], [d, v1], [0, v1]], [st, cw, ch, seed + 0.41], [d, faceH, gh, h]);
    if (!o.skipTop) {
      const ts = o.topStyle !== undefined ? o.topStyle : 0;
      const tc = o.topColor || c;
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], tc,
        [[0, 0], [w, 0], [w, d], [0, d]], [ts, 3, 3, seed + 0.5], [w, d, 0, 0]);
    }
    if (o.bottom) {
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], c,
        [[0, 0], [w, 0], [w, d], [0, d]], [0, 3, 3, seed + 0.6], [w, d, 0, 0]);
    }
  }

  // Horizontal rectangle (ground decals: roads, sidewalks, grass...).
  // u runs along x unless rotate=true (then u along z).
  flat(x0, z0, x1, z1, y, style, color = [1, 1, 1], o = {}) {
    const w = x1 - x0;
    const d = z1 - z0;
    let uvs;
    let f2;
    if (o.alongZ) {
      // u across (x), v along (z)
      uvs = [[0, d], [w, d], [w, 0], [0, 0]];
      f2 = [w, d, 0, 0];
    } else if (o.alongX) {
      // u across (z), v along (x)
      uvs = [[d, 0], [d, w], [0, w], [0, 0]];
      f2 = [d, w, 0, 0];
    } else {
      uvs = [[0, 0], [w, 0], [w, d], [0, d]];
      f2 = [w, d, 0, 0];
    }
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], color, uvs, [style, 3, 3, o.seed || 0], f2);
  }

  // Vertical cylinder, open or capped. n segments.
  cylinder(cx, y0, cz, r, h, n, color, o = {}) {
    const circ = 2 * Math.PI * r;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r];
      const p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const am = (a0 + a1) / 2;
      const nn = [Math.cos(am), 0, Math.sin(am)];
      const u0 = (i / n) * circ;
      const u1 = ((i + 1) / n) * circ;
      // winding: seen from outside, p1 is to the left of p0? keep CCW from outside
      this.quad(p1, p0, [p0[0], y0 + h, p0[2]], [p1[0], y0 + h, p1[2]], nn, color,
        [[u1, 0], [u0, 0], [u0, h], [u1, h]], [o.style || 0, 3, 3, o.seed || 0], [0, 0, 0, 0]);
    }
    if (o.cap !== false) this.disc(cx, y0 + h, cz, r, n, color, o);
  }

  disc(cx, y, cz, r, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.tri([cx, y, cz], [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r],
        [0, 1, 0], color, [[0, 0], [Math.cos(a1) * r, Math.sin(a1) * r], [Math.cos(a0) * r, Math.sin(a0) * r]], [0, 3, 3, o.seed || 0]);
    }
  }

  cone(cx, y0, cz, r, h, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const sl = Math.atan2(r, h);
      const nn = [Math.cos(am) * Math.cos(sl), Math.sin(sl), Math.sin(am) * Math.cos(sl)];
      this.tri([cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], [cx, y0 + h, cz],
        nn, color, [[a1 * r, 0], [a0 * r, 0], [am * r, h]], [0, 3, 3, o.seed || 0]);
    }
  }

  // Pyramid roof on a rectangle.
  pyramid(x0, z0, x1, z1, y, h, color, o = {}) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const top = [cx, y + h, cz];
    const corners = [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [top[0] - a[0], top[1] - a[1], top[2] - a[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      const L = Math.hypot(e1[0], e1[2]);
      this.tri(a, b, top, [n[0] / l, n[1] / l, n[2] / l], color, [[0, 0], [L, 0], [L / 2, h]], [0, 3, 3, o.seed || 0]);
    }
  }

  // Arbitrary planar polygon (convex) facing +Y or a given normal.
  polygonFlat(points, y, style, color, o = {}) {
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[0];
      const b = points[i + 1];
      const c = points[i];
      this.tri([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [0, 1, 0], color,
        [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]]], [style, 3, 3, o.seed || 0]);
    }
  }

  get empty() {
    return this.vcount === 0;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aUV', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aFace', new THREE.Float32BufferAttribute(this.f1, 4));
    g.setAttribute('aFace2', new THREE.Float32BufferAttribute(this.f2, 4));
    const IndexArray = this.vcount > 65535 ? Uint32Array : Uint16Array;
    g.setIndex(new THREE.BufferAttribute(new IndexArray(this.idx), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
