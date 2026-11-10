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
  GLOW: 8, // lamp glass: lights up at night
  SHOPWIN: 9, // shop windows: warm light inside at night
  ROAD_AVE: 10,
  ROAD_ST: 11,
  INTERSECTION: 12,
  SIDEWALK: 13,
  GRASS: 14,
  WATER: 15,
  GRAPH: 16,
  DIRT: 17,
  PLAZA: 18,
  GOODS: 19, // a shelf full of things (the shader draws the rows of products)
  FLOOR: 20, // a floor indoors: tiles, chequers, boards (drawn by the shader)
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
    this.ob = [];
    this.pt = [];
    this.hl = [];
    this.vcount = 0;
    // a wall with a room right behind it: below this height a rubbed-out spot is a hole you can
    // see (and walk) through, instead of blank paper (0 = solid)
    this.hollow = 0;
    // every box, quad or cylinder is a part of its own: the inker outlines where parts meet
    this.part = Math.floor(Math.random() * 50000);
    this.depth = 0;
    // object id stamped on every vertex: -1 = not part of the city (vehicles, items),
    // 0 = permanent city (buildings, ground), > 0 = a removable prop (see world/objects.js)
    this.obj = -1;
  }

  begin() {
    if (this.depth++ === 0) this.part++;
  }

  end() {
    this.depth--;
  }

  // p0..p3 counter-clockwise when seen from the front. uvs: 4 [u,v] pairs.
  quad(p0, p1, p2, p3, n, color, uvs, f1 = [0, 3, 3, 1], f2 = [0, 0, 0, 0]) {
    this.begin();
    const base = this.vcount;
    const ps = [p0, p1, p2, p3];
    for (let i = 0; i < 4; i++) {
      this.pos.push(ps[i][0], ps[i][1], ps[i][2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.f1.push(f1[0], f1[1], f1[2], f1[3]);
      this.f2.push(f2[0], f2[1], f2[2], f2[3]);
      this.ob.push(this.obj);
      this.pt.push(this.part);
      this.hl.push(this.hollow);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vcount += 4;
    this.end();
  }

  tri(p0, p1, p2, n, color, uvs, f1 = [0, 3, 3, 1], f2 = [0, 0, 0, 0]) {
    this.begin();
    const base = this.vcount;
    const ps = [p0, p1, p2];
    for (let i = 0; i < 3; i++) {
      this.pos.push(ps[i][0], ps[i][1], ps[i][2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.col.push(color[0], color[1], color[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.f1.push(f1[0], f1[1], f1[2], f1[3]);
      this.f2.push(f2[0], f2[1], f2[2], f2[3]);
      this.ob.push(this.obj);
      this.pt.push(this.part);
      this.hl.push(this.hollow);
    }
    this.idx.push(base, base + 1, base + 2);
    this.vcount += 3;
    this.end();
  }

  /**
   * Axis aligned box. opts:
   *  color, sideStyle (window style), cell [w,h], groundH, seed, topStyle, baseY (for window rows),
   *  skipBottom (default true), skipTop
   */
  box(min, max, o = {}) {
    this.begin();
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
    const holes = o.holes || {};
    const hollow = o.hollow || {};
    const w = x1 - x0;
    const d = z1 - z0;
    // each side as a function from (u along the facade, height) to a point; openings cut out
    const side = (key, P, len, n, sd) => {
      this.hollow = hollow[key] || 0;
      this.faceWithHoles(P, len, y0, y1, by, n, c, [st, cw, ch, seed + sd], [len, faceH, gh, h], holes[key]);
      this.hollow = 0;
    };
    // +Z face (south), viewed from +z: left = x0, right = x1
    if (sides[0]) side('s', (u, y) => [x0 + u, y, z1], w, [0, 0, 1], 0.11);
    // -Z face (north), viewed from -z: left = x1, right = x0
    if (sides[1]) side('n', (u, y) => [x1 - u, y, z0], w, [0, 0, -1], 0.23);
    // +X face (east), viewed from +x: left = z1, right = z0
    if (sides[2]) side('e', (u, y) => [x1, y, z1 - u], d, [1, 0, 0], 0.37);
    // -X face (west), viewed from -x: left = z0, right = z1
    if (sides[3]) side('w', (u, y) => [x0, y, z0 + u], d, [-1, 0, 0], 0.41);
    if (!o.skipTop) {
      const ts = o.topStyle !== undefined ? o.topStyle : 0;
      const tc = o.topColor || c;
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], tc,
        [[0, 0], [w, 0], [w, d], [0, d]], [ts, 3, 3, seed + 0.5], [w, d, 0, 0]);
    }
    if (o.bottom) {
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], c,
        [[0, 0], [w, 0], [w, d], [0, d]], [o.bottomStyle || 0, 3, 3, seed + 0.6], [w, d, 0, 0]);
    }
    this.end();
  }

  /**
   * A vertical face (u 0..len along it, heights y0..y1) with rectangular openings cut out of it
   * (holes: [[u0, ya, u1, yb], ...] in the same u and in world heights). The face keeps one set
   * of window-grid parameters, so the windows stay where they were.
   */
  faceWithHoles(P, len, y0, y1, baseY, n, color, f1, f2, holes) {
    if (!holes || !holes.length) {
      this.quad(P(0, y0), P(len, y0), P(len, y1), P(0, y1), n, color, [[0, y0 - baseY], [len, y0 - baseY], [len, y1 - baseY], [0, y1 - baseY]], f1, f2);
      return;
    }
    const us = [0, len];
    const ys = [y0, y1];
    for (const [a, ya, b, yb] of holes) {
      us.push(Math.max(0, Math.min(len, a)), Math.max(0, Math.min(len, b)));
      ys.push(Math.max(y0, Math.min(y1, ya)), Math.max(y0, Math.min(y1, yb)));
    }
    const U = [...new Set(us)].sort((p, q) => p - q);
    const Y = [...new Set(ys)].sort((p, q) => p - q);
    this.begin();
    for (let i = 0; i < U.length - 1; i++) {
      for (let j = 0; j < Y.length - 1; j++) {
        const ua = U[i];
        const ub = U[i + 1];
        const ya = Y[j];
        const yb = Y[j + 1];
        if (ub - ua < 1e-4 || yb - ya < 1e-4) continue;
        const uc = (ua + ub) / 2;
        const yc = (ya + yb) / 2;
        if (holes.some(([a, hy0, b, hy1]) => uc > a && uc < b && yc > hy0 && yc < hy1)) continue;
        this.quad(P(ua, ya), P(ub, ya), P(ub, yb), P(ua, yb), n, color, [[ua, ya - baseY], [ub, ya - baseY], [ub, yb - baseY], [ua, yb - baseY]], f1, f2);
      }
    }
    this.end();
  }

  // Horizontal rectangle (ground decals: roads, sidewalks, grass...).
  // u runs along x unless rotate=true (then u along z).
  flat(x0, z0, x1, z1, y, style, color = [1, 1, 1], o = {}) {
    this.begin();
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
    this.end();
  }

  // Vertical cylinder, open or capped. n segments.
  cylinder(cx, y0, cz, r, h, n, color, o = {}) {
    this.begin();
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
    this.end();
  }

  disc(cx, y, cz, r, n, color, o = {}) {
    this.begin();
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      this.tri([cx, y, cz], [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r],
        [0, 1, 0], color, [[0, 0], [Math.cos(a1) * r, Math.sin(a1) * r], [Math.cos(a0) * r, Math.sin(a0) * r]], [0, 3, 3, o.seed || 0]);
    }
    this.end();
  }

  // a rounded lump (a squashed, slightly lumpy ball): the crowns of the trees
  blob(cx, cy, cz, rx, ry, rz, color, o = {}) {
    this.begin();
    const nu = o.nu || 8;
    const nv = o.nv || 5;
    const seed = o.seed || 0;
    const lumpy = o.lumpy !== undefined ? o.lumpy : 0.1;
    const P = (i, j) => {
      const u = (i / nu) * Math.PI * 2 + seed;
      const v = (j / nv) * Math.PI - Math.PI / 2;
      const w = 1 + lumpy * Math.sin(u * 3 + seed * 1.3) * Math.cos(v * 2 + seed * 0.7);
      return [cx + Math.cos(v) * Math.cos(u) * rx * w, cy + Math.sin(v) * ry * w, cz + Math.cos(v) * Math.sin(u) * rz * w];
    };
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = P(i, j);
        const b = P(i + 1, j);
        const c = P(i + 1, j + 1);
        const d = P(i, j + 1);
        // the facet's normal, outwards (through an ellipsoid)
        const mx = (a[0] + b[0] + c[0] + d[0]) / 4 - cx;
        const my = (a[1] + b[1] + c[1] + d[1]) / 4 - cy;
        const mz = (a[2] + b[2] + c[2] + d[2]) / 4 - cz;
        let n = [mx / (rx * rx), my / (ry * ry), mz / (rz * rz)];
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        n = [n[0] / l, n[1] / l, n[2] / l];
        const uvs = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([x, y]) => [x * 0.9, y * 0.9]);
        // wound counter-clockwise seen from outside
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) this.quad(a, b, c, d, n, color, uvs, [o.style || 0, 3, 3, seed]);
        else this.quad(a, d, c, b, n, color, [uvs[0], uvs[3], uvs[2], uvs[1]], [o.style || 0, 3, 3, seed]);
      }
    }
    this.end();
  }

  cone(cx, y0, cz, r, h, n, color, o = {}) {
    this.begin();
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const sl = Math.atan2(r, h);
      const nn = [Math.cos(am) * Math.cos(sl), Math.sin(sl), Math.sin(am) * Math.cos(sl)];
      this.tri([cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], [cx, y0 + h, cz],
        nn, color, [[a1 * r, 0], [a0 * r, 0], [am * r, h]], [0, 3, 3, o.seed || 0]);
    }
    this.end();
  }

  // Pyramid roof on a rectangle.
  pyramid(x0, z0, x1, z1, y, h, color, o = {}) {
    this.begin();
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
    this.end();
  }

  // Arbitrary planar polygon (convex) facing +Y or a given normal.
  polygonFlat(points, y, style, color, o = {}) {
    this.begin();
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[0];
      const b = points[i + 1];
      const c = points[i];
      this.tri([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [0, 1, 0], color,
        [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]]], [style, 3, 3, o.seed || 0]);
    }
    this.end();
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
    g.setAttribute('aObj', new THREE.Float32BufferAttribute(this.ob, 1));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.pt, 1));
    g.setAttribute('aHollow', new THREE.Float32BufferAttribute(this.hl, 1));
    const IndexArray = this.vcount > 65535 ? Uint32Array : Uint16Array;
    g.setIndex(new THREE.BufferAttribute(new IndexArray(this.idx), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
