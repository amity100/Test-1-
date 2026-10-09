import * as THREE from 'three';
import { penRow } from '../render/materials.js';

// Building kit: geometry merged per material and per piece of the city (one draw per material
// per chunk, so whatever is behind you is skipped), each part keeping an id of its own so the
// inker can see where one part ends and the next begins. Parts can carry a colour of their own
// (one material for many coloured walls), the id of a prop the eraser can rub out, and how far
// a frond reaches from its crown (for the breeze).

let partSeed = 7;
export function nextId() {
  partSeed = (partSeed * 16807) % 2147483647;
  return (partSeed % 100000) / 100000;
}

export const CHUNK = 96;
const chunkKey = (x, z) => `${Math.floor(x / CHUNK)}_${Math.floor(z / CHUNK)}`;

const _box = new THREE.Box3();
const _c = new THREE.Vector3();
const WHITE = [1, 1, 1];

export class Batch {
  constructor() {
    this.groups = new Map(); // material -> Map(chunk -> [{ geo, id, color, obj, sway }])
    this.obj = 0; // the prop being built (its id goes on every part added meanwhile)
    this.vcount = 0;
  }

  // add a geometry (already placed in world space, or with a matrix) with a part id
  // o: { color: [r,g,b] linear | THREE.Color, obj: prop id, sway: number | (x,y,z)=>number, chunk: key }
  add(material, geo, matrix = null, id = nextId(), o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    let key = o.chunk;
    if (!key) {
      g.computeBoundingBox();
      _box.copy(g.boundingBox);
      const size = Math.max(_box.max.x - _box.min.x, _box.max.z - _box.min.z);
      _box.getCenter(_c);
      key = size > CHUNK * 2.5 ? 'big' : chunkKey(_c.x, _c.z);
    }
    if (!this.groups.has(material)) this.groups.set(material, new Map());
    const byChunk = this.groups.get(material);
    if (!byChunk.has(key)) byChunk.set(key, []);
    const col = o.color ? (o.color.isColor ? [o.color.r, o.color.g, o.color.b] : o.color) : WHITE;
    byChunk.get(key).push({ geo: g, id, color: col, obj: o.obj !== undefined ? o.obj : this.obj, sway: o.sway || 0 });
    this.vcount += g.attributes.position.count;
    return id;
  }

  box(material, x0, y0, z0, x1, y1, z1, id, o) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(material, g, null, id, o);
  }

  // a box with UVs in metres (window grids, pavers, posters)
  boxM(material, x0, y0, z0, x1, y1, z1, tile = 1, id, o) {
    const g = boxMetres(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), tile);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(material, g, null, id, o);
  }

  // opts.merge(mat): the shared pen mat draws with (materials.js mergedSurface), or null
  flush(parent, opts = {}) {
    const meshes = [];
    const draws = new Map();
    for (const [mat, byChunk] of this.groups) {
      const dm = (opts.merge && opts.merge(mat)) || mat;
      if (!draws.has(dm)) draws.set(dm, new Map());
      const dc = draws.get(dm);
      for (const [key, list] of byChunk) {
        if (!dc.has(key)) dc.set(key, []);
        const out = dc.get(key);
        for (const it of list) {
          it.src = mat;
          out.push(it);
        }
      }
    }
    for (const [mat, byChunk] of draws) {
      const tab = !!(mat.defines && mat.defines.USE_MATTAB !== undefined);
      for (const [key, list] of byChunk) {
        let n = 0;
        for (const it of list) n += it.geo.attributes.position.count;
        const pos = new Float32Array(n * 3);
        const nor = new Float32Array(n * 3);
        const uv = new Float32Array(n * 2);
        const ids = new Float32Array(n);
        const vc = mat.vertexColors ? new Float32Array(n * 3) : null;
        let objs = null;
        let sway = null;
        if (mat.defines && mat.defines.USE_OBJ !== undefined) objs = new Float32Array(n);
        if (mat.defines && mat.defines.SWAY_ATTR !== undefined) sway = new Float32Array(n);
        const rows = tab ? new Float32Array(n) : null;
        const pens = new Set();
        let o = 0;
        for (const it of list) {
          const g = it.geo;
          const c = g.attributes.position.count;
          const src = it.src;
          pens.add(src);
          pos.set(g.attributes.position.array, o * 3);
          nor.set(g.attributes.normal.array, o * 3);
          uv.set(g.attributes.uv.array, o * 2);
          ids.fill(it.id, o, o + c);
          // (a pen of its own colour, sharing a draw with coloured parts: white, as it was)
          if (vc) {
            const col = src.vertexColors ? it.color : WHITE;
            for (let i = 0; i < c; i++) vc.set(col, (o + i) * 3);
          }
          if (objs) objs.fill(src.defines && src.defines.USE_OBJ !== undefined ? it.obj : 0, o, o + c);
          if (rows) rows.fill(penRow(src), o, o + c);
          if (sway) {
            if (typeof it.sway === 'function') {
              const p = g.attributes.position.array;
              for (let i = 0; i < c; i++) sway[o + i] = it.sway(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
            } else sway.fill(it.sway, o, o + c);
          }
          o += c;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
        if (vc) geo.setAttribute('color', new THREE.BufferAttribute(vc, 3));
        if (objs) geo.setAttribute('aObj', new THREE.BufferAttribute(objs, 1));
        if (sway) geo.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
        if (rows) geo.setAttribute('aMat', new THREE.BufferAttribute(rows, 1));
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, mat);
        m.matrixAutoUpdate = false;
        m.name = key;
        Object.assign(m.userData, opts);
        delete m.userData.merge;
        // the pens drawn in it (more than one when they share)
        m.userData.pens = [...pens];
        parent.add(m);
        meshes.push(m);
      }
    }
    this.groups.clear();
    return meshes;
  }
}

// UVs in metres on a box (for the window grids and pavers)
export function boxMetres(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const sx = ax > 0.5 ? d : w;
    const sy = ay > 0.5 ? d : h;
    uv.setXY(i, (uv.getX(i) * sx) / tile, (uv.getY(i) * sy) / tile);
  }
  return g;
}

// a flat quad from four corners (counter-clockwise seen from the front), uvs given
export function quadGeo(a, b, c, d, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  const g = new THREE.BufferGeometry();
  const pos = [...a, ...b, ...c, ...a, ...c, ...d];
  const e1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const e2 = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
  const n = e1.cross(e2).normalize();
  const nor = [];
  for (let i = 0; i < 6; i++) nor.push(n.x, n.y, n.z);
  const uv = [...uvs[0], ...uvs[1], ...uvs[2], ...uvs[0], ...uvs[2], ...uvs[3]];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/**
 * A frame on a building front: u along the front, v up, w out of it (towards the street).
 * Every street of the city runs north-south or east-west, so boxes stay boxes.
 */
export class Facade {
  // (ox, oz): the start of the front (u = 0); (ux, uz): along it; (nx, nz): out of it
  constructor(ox, oz, ux, uz, nx, nz) {
    this.ox = ox;
    this.oz = oz;
    this.ux = ux;
    this.uz = uz;
    this.nx = nx;
    this.nz = nz;
  }

  p(u, v, w) {
    return [this.ox + this.ux * u + this.nx * w, v, this.oz + this.uz * u + this.nz * w];
  }

  // a box in the frame -> [min, max] in the world
  box(u0, v0, w0, u1, v1, w1) {
    const a = this.p(u0, v0, w0);
    const b = this.p(u1, v1, w1);
    return [
      [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
      [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
    ];
  }

  // world -> frame (u, w)
  toU(x, z) {
    return (x - this.ox) * this.ux + (z - this.oz) * this.uz;
  }

  toW(x, z) {
    return (x - this.ox) * this.nx + (z - this.oz) * this.nz;
  }

  // a quad standing in the front at depth w, facing out (its uv: u across, v up, in metres / tile)
  quad(u0, v0, u1, v1, w, tile = 0) {
    const a = this.p(u0, v0, w);
    const b = this.p(u1, v0, w);
    const c = this.p(u1, v1, w);
    const d = this.p(u0, v1, w);
    const uvs = tile ? [[0, 0], [(u1 - u0) / tile, 0], [(u1 - u0) / tile, (v1 - v0) / tile], [0, (v1 - v0) / tile]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    return this.facing(a, b, c, d, uvs, [this.nx, 0, this.nz]);
  }

  // the same quad facing into the building
  quadIn(u0, v0, u1, v1, w, tile = 0) {
    const a = this.p(u1, v0, w);
    const b = this.p(u0, v0, w);
    const c = this.p(u0, v1, w);
    const d = this.p(u1, v1, w);
    const uvs = tile ? [[0, 0], [(u1 - u0) / tile, 0], [(u1 - u0) / tile, (v1 - v0) / tile], [0, (v1 - v0) / tile]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    return this.facing(a, b, c, d, uvs, [-this.nx, 0, -this.nz]);
  }

  // wind the quad so its front faces n
  facing(a, b, c, d, uvs, n) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) return quadGeo(a, b, c, d, uvs);
    return quadGeo(b, a, d, c, [uvs[1], uvs[0], uvs[3], uvs[2]]);
  }

  // rotation about y that turns local +z into the front's outward normal
  get yaw() {
    return Math.atan2(this.nx, this.nz);
  }
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// a rough hand: a line drawn twice with a little wobble
export function handLine(g, pts, w, col, passes = 2, jit = 1.5) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    g.strokeStyle = col;
    g.lineWidth = w * (p ? 0.7 : 1);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (Math.random() - 0.5) * jit;
      const jy = y + (Math.random() - 0.5) * jit;
      if (i === 0) g.moveTo(jx, jy);
      else g.lineTo(jx, jy);
    });
    g.stroke();
  }
}

// a seeded random (the first boulevard draws its palms and towers from this one, in its order)
export function seeded(seed) {
  let s = seed;
  const f = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  return f;
}
export const rand = seeded(4242);
