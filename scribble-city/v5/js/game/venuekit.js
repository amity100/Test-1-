import * as THREE from 'three';
import { makeSurface, srgb } from '../render/materials.js';
import { letter } from '../world/letters.js';

// (v5, ROADMAP 12.7) What the great halls of the night are built with - the arcade, the casino, the
// clubs: the kit's pens (game/items.js) under a dark hall's own light (render/glsl.js, indoor
// 'club': a little violet from above, the neon and the screens doing the rest), and the pieces every
// such place has - its name in neon tubes, pictures made of squares of light, bulbs that chase.

// (the pens of a hall: 'club' the arcade's and the clubs', 'casino' the casino's floor, gold)
const CMS = {};
export function clubMats(indoor = 'club') {
  if (CMS[indoor]) return CMS[indoor];
  const CM = {
    paint: makeSurface({ kind: 'paint', vcolor: true, gloss: 0.55, ang: 0.1, indoor }),
    matte: makeSurface({ kind: 'box', vcolor: true, indoor }),
    round: makeSurface({ kind: 'cyl', vcolor: true, partR: 0.05, indoor }),
    metal: makeSurface({ kind: 'box', vcolor: true, gloss: 0.75, indoor }),
    glass: makeSurface({ kind: 'paint', vcolor: true, gloss: 0.95, ang: 0.5, indoor }),
    glow: makeSurface({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.95, 0.9), emissive: new THREE.Color(2.2, 2.2, 2.2), line: 0.4 }),
  };
  for (const m of Object.values(CM)) m.userData.depth = m.userData.depth || null;
  CMS[indoor] = CM;
  return CM;
}

// a word in light on a wall: its middle at (x, y, z) - y the foot of its letters - read by one
// standing out from the wall along (nx, nz) (one of the four ways), `d` out from it, `t` thick
export function neonWord(K, mat, text, h, x, y, z, nx, nz, color, d = 0.04, t = 0.06) {
  // (the reader's right, facing the wall: nz, -nx)
  const rx = nz;
  const rz = -nx;
  return letter(text, h, (a0, b0, a1, b1) => {
    // (the stroke's two corners: along the line and out from the wall - the four ways are square)
    const xa = x + rx * a0 + nx * d;
    const za = z + rz * a0 + nz * d;
    const xb = x + rx * a1 + nx * (d + t);
    const zb = z + rz * a1 + nz * (d + t);
    K.box(mat, Math.min(xa, xb), y + b0, Math.min(za, zb), Math.max(xa, xb), y + b1, Math.max(za, zb), color);
  });
}

// a picture of squares of light (rows of a string each, '.' nothing, a letter a colour from pal),
// standing on a wall at (x, y, z) - its middle, its foot at y - facing (nx, nz), `s` a square
export function pixelArt(K, mat, rows, pal, s, x, y, z, nx, nz, d = 0.05) {
  const rx = nz;
  const rz = -nx;
  const w = rows[0].length;
  const h = rows.length;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      if (ch === '.' || ch === ' ') continue;
      const a = (c - w / 2) * s;
      const b = (h - 1 - r) * s;
      const xa = x + rx * a + nx * d;
      const za = z + rz * a + nz * d;
      const xb = x + rx * (a + s * 0.9) + nx * (d + 0.06);
      const zb = z + rz * (a + s * 0.9) + nz * (d + 0.06);
      K.box(mat, Math.min(xa, xb), y + b, Math.min(za, zb), Math.max(xa, xb), y + b + s * 0.9, Math.max(za, zb), pal[ch]);
    }
  }
}

// bulbs along a line that chase: two sets, every other bulb in each, shown in turn (chase(t))
export function chaser(mats, pts, r, color) {
  const K = [[], []];
  pts.forEach((p, i) => K[i % 2].push(p));
  const out = [];
  for (const list of K) {
    const geos = [];
    for (const [x, y, z] of list) {
      const g = new THREE.SphereGeometry(r, 8, 6);
      g.translate(x, y, z);
      geos.push(g.toNonIndexed());
    }
    const n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const col = new Float32Array(n * 3);
    const ids = new Float32Array(n);
    let k = 0;
    for (const g of geos) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, k * 3);
      nor.set(g.attributes.normal.array, k * 3);
      uv.set(g.attributes.uv.array, k * 2);
      for (let i = 0; i < c; i++) col.set(color, (k + i) * 3);
      ids.fill(0.5, k, k + c);
      k += c;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mats.glow);
    m.frustumCulled = false;
    m.userData.dynamic = true;
    out.push(m);
  }
  return out;
}

// a flat picture (a canvas texture's piece, uv [u0, v0, u1, v1]) w by h, its middle at (x, y, z),
// facing (nx, nz) - or lying face up when flat (its top towards (nx, nz))
export function picture(mat, w, h, x, y, z, nx, nz, uvBox = null, flat = false) {
  const m = new THREE.Mesh(pictureGeo(w, h, x, y, z, nx, nz, uvBox, flat), mat);
  m.frustumCulled = false;
  return m;
}

// the same picture's shape alone, to be put with others of its pen into one (merged())
export function pictureGeo(w, h, x, y, z, nx, nz, uvBox = null, flat = false) {
  const g = new THREE.PlaneGeometry(w, h);
  if (uvBox) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uvBox[0] + uv.getX(i) * (uvBox[2] - uvBox[0]), uvBox[1] + uv.getY(i) * (uvBox[3] - uvBox[1]));
  }
  if (flat) {
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(nx, nz) + Math.PI);
  } else g.rotateY(Math.atan2(nx, nz));
  g.translate(x, y, z);
  return g;
}

// pictures of one pen as one shape: one draw for all the screens, one for all the names
export function merged(geos, mat) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  let k = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, k * 3);
    nor.set(g.attributes.normal.array, k * 3);
    uv.set(g.attributes.uv.array, k * 2);
    k += c;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}
