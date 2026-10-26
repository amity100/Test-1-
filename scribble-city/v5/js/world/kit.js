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
    // (the order the parts were added in: what is painted over something else, a crossing over the
    // avenue, comes after it)
    this.seq = 0;
  }

  // add a geometry (already placed in world space, or with a matrix) with a part id
  // o: { color: [r,g,b] linear | THREE.Color, obj: prop id, sway: number | (x,y,z)=>number, chunk: key,
  //   soup: the geometry brings its own aId and color for every corner (world/soup.js) }
  add(material, geo, matrix = null, id = nextId(), o = {}) {
    // (shared corners stay shared: a box is 24 corners, not 36; but a shape without normals of
    // its own gets flat ones, face by face, as it always did)
    let g = geo.index && !geo.attributes.normal ? geo.toNonIndexed() : geo.clone();
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
    byChunk.get(key).push({ geo: g, id, color: col, obj: o.obj !== undefined ? o.obj : this.obj, sway: o.sway || 0, seq: this.seq++, soup: !!o.soup });
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
    const it = this.flushSteps(parent, opts);
    for (;;) {
      const r = it.next();
      if (r.done) return r.value;
    }
  }

  // (v5, ROADMAP 11.17) the same, a draw at a time (a block of the mainland, in the background)
  *flushSteps(parent, opts = {}) {
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
    // (v5) a pen with little of it in the whole city (opts.whole: { max corners, ok(pens): not
    // one hidden by distance }) is one draw for all of it, not one in every chunk it is in: where
    // it is hardly matters to the graphics card, a draw more or less does (the city's street
    // paint was 34 draws of 616 corners)
    if (opts.whole) {
      for (const [, byChunk] of draws) {
        if (byChunk.size < 2) continue;
        let n = 0;
        const pens = new Set();
        for (const [, list] of byChunk) {
          for (const it of list) {
            n += it.geo.attributes.position.count;
            pens.add(it.src);
          }
        }
        if (n > opts.whole.max || !opts.whole.ok([...pens])) continue;
        const all = [];
        for (const [, list] of byChunk) for (const it of list) all.push(it);
        // (in the order they were added. Seen from high up, a few hundred metres, two flat pieces
        // at the same height can come out the other way round than in chunks of their own, where
        // the farther chunk was drawn last; from the street the picture is the same)
        all.sort((a, b) => a.seq - b.seq);
        byChunk.clear();
        byChunk.set('whole', all);
      }
    }
    // (v5: a draw of more than 65535 corners would need 32-bit indices, which a browser drawing
    // without a graphics card makes ready only slowly, the first time: such a chunk is drawn in
    // two pieces, or more)
    for (const [, byChunk] of draws) {
      for (const [key, list] of [...byChunk]) {
        let n = 0;
        for (const it of list) n += it.geo.attributes.position.count;
        if (n <= 65535) continue;
        const parts = [];
        let cur = [];
        let cn = 0;
        for (const it of list) {
          const c = it.geo.attributes.position.count;
          if (cn + c > 65535 && cur.length) {
            parts.push(cur);
            cur = [];
            cn = 0;
          }
          cur.push(it);
          cn += c;
        }
        if (cur.length) parts.push(cur);
        byChunk.set(key, parts[0]);
        for (let i = 1; i < parts.length; i++) byChunk.set(`${key}#${i}`, parts[i]);
      }
    }
    for (const [mat, byChunk] of draws) {
      const tab = !!(mat.defines && mat.defines.USE_MATTAB !== undefined);
      for (const [key, list] of byChunk) {
        let n = 0;
        let ni = 0;
        for (const it of list) {
          n += it.geo.attributes.position.count;
          ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count;
        }
        const index = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
        let io = 0;
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
          if (g.index) {
            const ia = g.index.array;
            for (let k = 0; k < ia.length; k++) index[io + k] = ia[k] + o;
            io += ia.length;
          } else {
            for (let k = 0; k < c; k++) index[io + k] = o + k;
            io += c;
          }
          // (a soup of many parts in one geometry - world/soup.js - brings an id and a colour for
          // every corner of its own)
          const own = it.soup ? g.attributes.aId : null;
          if (own) ids.set(own.array, o);
          else ids.fill(it.id, o, o + c);
          // (a pen of its own colour, sharing a draw with coloured parts: white, as it was)
          if (vc) {
            const oc = it.soup ? g.attributes.color : null;
            if (oc && src.vertexColors) vc.set(oc.array, o * 3);
            else {
              const col = src.vertexColors ? it.color : WHITE;
              for (let i = 0; i < c; i++) vc.set(col, (o + i) * 3);
            }
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
        // (v5) the corners the same in everything, one corner (shareCorners)
        const att = [['position', pos, 3], ['normal', nor, 3], ['uv', uv, 2], ['aId', ids, 1]];
        if (vc) att.push(['color', vc, 3]);
        if (objs) att.push(['aObj', objs, 1]);
        if (sway) att.push(['aSway', sway, 1]);
        if (rows) att.push(['aMat', rows, 1]);
        const kept = shareCorners(n, index, att);
        const geo = new THREE.BufferGeometry();
        geo.setIndex(new THREE.BufferAttribute(index, 1));
        for (const [name, a, w] of att) geo.setAttribute(name, new THREE.BufferAttribute(kept ? compact(a, w, kept) : a, w));
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, mat);
        m.matrixAutoUpdate = false;
        m.name = key;
        Object.assign(m.userData, opts);
        delete m.userData.merge;
        delete m.userData.whole;
        delete m.userData.steps;
        // the pens drawn in it (more than one when they share)
        m.userData.pens = [...pens];
        parent.add(m);
        meshes.push(m);
        if (opts.steps) yield;
      }
    }
    this.groups.clear();
    return meshes;
  }
}

// (v5) The corners of a draw that are the same in everything (the place, the direction, the
// picture, the part, the prop, the pen) made one: the graphics card works a corner out once, not
// once for every triangle it is in (the two triangles of a flat quad share two of its corners; a
// box's faces keep their own, their directions differ). The same triangles, the same picture.
// Renumbers index in place; returns the corners kept (or null: none shared).
function shareCorners(n, index, att) {
  const views = att.map(([, a, w]) => ({ u: new Uint32Array(a.buffer, a.byteOffset, a.length), w }));
  let size = 1;
  while (size < n * 2) size <<= 1;
  const mask = size - 1;
  const table = new Int32Array(size).fill(-1);
  const keep = new Int32Array(n);
  const remap = new Int32Array(n);
  let m = 0;
  const same = (i, j) => {
    for (const v of views) {
      const a = i * v.w;
      const b = j * v.w;
      for (let k = 0; k < v.w; k++) if (v.u[a + k] !== v.u[b + k]) return false;
    }
    return true;
  };
  for (let i = 0; i < n; i++) {
    let h = 2166136261;
    for (const v of views) {
      const o = i * v.w;
      for (let k = 0; k < v.w; k++) h = Math.imul(h ^ v.u[o + k], 16777619);
    }
    let slot = (h ^ (h >>> 15)) & mask;
    for (;;) {
      const j = table[slot];
      if (j < 0) {
        table[slot] = m;
        keep[m] = i;
        remap[i] = m++;
        break;
      }
      if (same(keep[j], i)) {
        remap[i] = j;
        break;
      }
      slot = (slot + 1) & mask;
    }
  }
  if (m === n) return null;
  for (let k = 0; k < index.length; k++) index[k] = remap[index[k]];
  return keep.subarray(0, m);
}

function compact(a, w, kept) {
  const out = new Float32Array(kept.length * w);
  for (let j = 0; j < kept.length; j++) {
    const s = kept[j] * w;
    for (let k = 0; k < w; k++) out[j * w + k] = a[s + k];
  }
  return out;
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

// (v5, the mega mall) a front up on a floor of its own: everything built on it - the store's glass,
// its sign, the room behind it, the walls you bump into - stands dy higher (world/mainland/megamall.js)
export class LiftFacade extends Facade {
  constructor(ox, oz, ux, uz, nx, nz, dy) {
    super(ox, oz, ux, uz, nx, nz);
    this.dy = dy;
  }

  p(u, v, w) {
    const q = super.p(u, v, w);
    q[1] += this.dy;
    return q;
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
