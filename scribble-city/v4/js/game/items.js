import * as THREE from 'three';
import { makeSurface, srgb, lin3 } from '../render/materials.js';

// The things you draw and then hold: every weapon as a real thing, made the way the city is made
// (glossy paint full of the sunset, chrome, a glowing bit of neon here and there), its outlines
// inked by the same hand. A drawing that came out wonky comes out wonky in your hand too.
//
// Local frame of a held thing: origin in the hand, +z forward (the muzzle, the striking end),
// +y up, +x to the right.

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const PEN_BLUE = [0.2, 0.36, 0.78];
export const ERASER_PINK = [0.93, 0.5, 0.56];
export const ERASER_BLUE = [0.36, 0.48, 0.82];

let MATS = null;
function mats() {
  if (MATS) return MATS;
  MATS = {
    paint: makeSurface({ kind: 'paint', vcolor: true, gloss: 0.55, ang: 0.1 }),
    matte: makeSurface({ kind: 'box', vcolor: true }),
    round: makeSurface({ kind: 'cyl', vcolor: true, partR: 0.05 }),
    metal: makeSurface({ kind: 'box', vcolor: true, gloss: 0.75 }),
    glass: makeSurface({ kind: 'paint', vcolor: true, gloss: 0.95, ang: 0.5 }),
    glow: makeSurface({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.95, 0.9), emissive: new THREE.Color(2.2, 2.2, 2.2), line: 0.4 }),
  };
  for (const m of Object.values(MATS)) m.userData.depth = m.userData.depth || null;
  return MATS;
}

const C = (r, g, b) => lin3(r, g, b);

// a little modelling kit: parts in the item's frame, merged per pen
class Kit {
  constructor() {
    this.parts = new Map();
  }

  add(mat, geo, color) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push({ g, color });
    return g;
  }

  box(mat, x0, y0, z0, x1, y1, z1, color) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(mat, g, color);
  }

  // a round part along z (or y), from z0 to z1, radius r0 at z0 and r1 at z1
  cyl(mat, r0, r1, z0, z1, color, o = {}) {
    const g = new THREE.CylinderGeometry(r1, r0, Math.abs(z1 - z0), o.segs || 14, 1, !!o.open);
    if (o.axis !== 'y') g.rotateX(Math.PI / 2);
    if (o.axis !== 'y') g.translate(o.x || 0, o.y || 0, (z0 + z1) / 2);
    else g.translate(o.x || 0, (z0 + z1) / 2, o.z || 0);
    if (o.rot) g.rotateZ(o.rot);
    return this.add(mat, g, color);
  }

  sphere(mat, r, x, y, z, color, sx = 1, sy = 1, sz = 1, segs = 14) {
    const g = new THREE.SphereGeometry(r, segs, Math.max(6, Math.round(segs * 0.7)));
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    return this.add(mat, g, color);
  }

  torus(mat, R, r, x, y, z, color, rx = 0, ry = 0) {
    const g = new THREE.TorusGeometry(R, r, 8, 20);
    g.rotateX(rx);
    g.rotateY(ry);
    g.translate(x, y, z);
    return this.add(mat, g, color);
  }

  build(o = {}) {
    const group = new THREE.Group();
    for (const [mat, list] of this.parts) {
      let n = 0;
      for (const it of list) n += it.g.attributes.position.count;
      const pos = new Float32Array(n * 3);
      const nor = new Float32Array(n * 3);
      const uv = new Float32Array(n * 2);
      const col = new Float32Array(n * 3);
      const ids = new Float32Array(n);
      let k = 0;
      let part = (o.seed || 0.13) % 1;
      for (const it of list) {
        const g = it.g;
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array, k * 3);
        nor.set(g.attributes.normal.array, k * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, k * 2);
        for (let i = 0; i < c; i++) col.set(it.color, (k + i) * 3);
        part = (part + 0.1371) % 1;
        ids.fill(part, k, k + c);
        k += c;
      }
      if (o.warp) {
        for (let i = 0; i < n; i++) o.warp(pos, i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
      if (o.warp) geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.userData.dynamic = true;
      group.add(m);
    }
    group.matrixAutoUpdate = false;
    return group;
  }
}

// a drawing that came out wonky is wonky in your hand: bent, lumpy, a little too big here and there
function warpFor(grade, seed = 1) {
  const k = grade === 'fail' ? 1 : grade === 'wonky' ? 0.45 : 0;
  if (!k) return null;
  const a = 3 + (seed % 3);
  return (p, i) => {
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];
    p[i] = x * (1 + 0.25 * k) + Math.sin(z * a + seed) * 0.02 * k;
    p[i + 1] = y + Math.sin(z * (a + 2) + seed * 2) * 0.035 * k + z * 0.12 * k;
    p[i + 2] = z * (1 - 0.08 * k) + Math.sin(y * 9) * 0.01 * k;
  };
}

// a hexagonal pencil along z from z0 to z1 (its sharpened end at z1 if dir > 0)
function pencilShape(K, M, r, z0, z1, body, o = {}) {
  K.cyl(M.paint, r, r, z0, z1, body, { segs: 6, x: o.x || 0, y: o.y || 0 });
  const tipLen = r * 3.2;
  const zt = o.back ? z0 : z1;
  const dir = o.back ? -1 : 1;
  K.cyl(M.round, dir > 0 ? r : r * 0.32, dir > 0 ? r * 0.32 : r, dir > 0 ? zt : zt - tipLen, dir > 0 ? zt + tipLen : zt, C(0.93, 0.8, 0.62), { segs: 6, x: o.x || 0, y: o.y || 0 });
  const gz = zt + dir * tipLen;
  K.cyl(M.round, dir > 0 ? r * 0.32 : 0.001, dir > 0 ? 0.001 : r * 0.32, dir > 0 ? gz : gz - r * 0.9, dir > 0 ? gz + r * 0.9 : gz, C(0.18, 0.18, 0.22), { segs: 6, x: o.x || 0, y: o.y || 0 });
  return gz + dir * r * 0.9;
}

// ------------------------------------------------------------------ the arsenal
const BUILD = {
  // the pencil you start with: held near the point, the eraser end rubs things out
  pencil(K, M) {
    const r = 0.05;
    K.cyl(M.paint, r, r, -0.16, 0.78, C(0.98, 0.8, 0.22), { segs: 6 });
    K.cyl(M.round, 0.016, r, -0.32, -0.16, C(0.93, 0.8, 0.62), { segs: 6 });
    K.cyl(M.round, 0.001, 0.016, -0.36, -0.32, C(0.18, 0.18, 0.22), { segs: 6 });
    K.cyl(M.metal, r * 1.08, r * 1.08, 0.78, 0.87, C(0.82, 0.82, 0.86), { segs: 12 });
    for (const z of [0.8, 0.85]) K.cyl(M.metal, r * 1.12, r * 1.12, z, z + 0.008, C(0.55, 0.55, 0.6), { segs: 12 });
    K.cyl(M.round, r, r, 0.87, 0.98, C(0.98, 0.56, 0.62), { segs: 12 });
    K.sphere(M.round, r, 0, 0, 0.98, C(0.98, 0.56, 0.62), 1, 1, 0.35, 12);
    return { tip: new THREE.Vector3(0, 0, 1.0), length: 1.1 };
  },
  // the paint blaster: a candy-coloured pistol with a glass ball of paint on top
  paint(K, M) {
    const body = C(0.2, 0.78, 0.76);
    K.box(M.paint, -0.035, 0.0, -0.08, 0.035, 0.09, 0.2, body);
    K.sphere(M.paint, 0.045, 0, 0.045, -0.08, body, 0.78, 1, 0.6);
    const grip = new THREE.BoxGeometry(0.06, 0.14, 0.065);
    grip.rotateX(-0.28);
    grip.translate(0, -0.06, -0.035);
    K.add(M.matte, grip, C(0.42, 0.24, 0.58));
    K.torus(M.metal, 0.03, 0.006, 0, -0.02, 0.03, C(0.75, 0.75, 0.8), 0, Math.PI / 2);
    // the tank of paint
    K.cyl(M.metal, 0.018, 0.018, 0.0, 0.06, C(0.75, 0.75, 0.8), { axis: 'y', z: 0.04, segs: 8 });
    K.sphere(M.glass, 0.062, 0, 0.15, 0.04, C(0.85, 0.92, 1.0));
    K.sphere(M.paint, 0.05, 0, 0.14, 0.04, C(1.0, 0.36, 0.62), 1, 0.85, 1);
    // the nozzle and its ring of glowing paint
    K.cyl(M.metal, 0.02, 0.016, 0.2, 0.29, C(0.8, 0.8, 0.86), { y: 0.045 });
    K.torus(M.glow, 0.019, 0.006, 0, 0.045, 0.285, C(1.0, 0.3, 0.6));
    return { muzzle: new THREE.Vector3(0, 0.045, 0.31), length: 0.4 };
  },
  // the pencil rifle: a wooden stock, a scope, and a long pencil for a barrel
  rifle(K, M) {
    const wood = C(0.62, 0.4, 0.24);
    const dark = C(0.22, 0.22, 0.28);
    const stock = new THREE.BoxGeometry(0.05, 0.11, 0.36);
    stock.translate(0, -0.01, -0.26);
    K.add(M.paint, stock, wood);
    K.box(M.paint, -0.024, -0.09, -0.44, 0.024, 0.06, -0.42, C(0.3, 0.2, 0.15));
    K.box(M.matte, -0.032, -0.03, -0.1, 0.032, 0.07, 0.26, dark);
    const grip = new THREE.BoxGeometry(0.045, 0.12, 0.05);
    grip.rotateX(-0.3);
    grip.translate(0, -0.08, -0.02);
    K.add(M.matte, grip, dark);
    K.box(M.metal, -0.02, -0.17, 0.06, 0.02, -0.03, 0.12, C(0.6, 0.6, 0.66));
    // the scope
    K.cyl(M.paint, 0.024, 0.024, -0.04, 0.18, C(0.12, 0.12, 0.16), { y: 0.13 });
    K.cyl(M.glow, 0.02, 0.02, 0.18, 0.186, C(0.4, 0.9, 1.0), { y: 0.13 });
    for (const z of [0.0, 0.13]) K.box(M.matte, -0.012, 0.07, z - 0.012, 0.012, 0.11, z + 0.012, dark);
    // the barrel: a yellow pencil
    const end = pencilShape(K, M, 0.026, 0.26, 0.72, C(0.98, 0.8, 0.22), { y: 0.02 });
    return { muzzle: new THREE.Vector3(0, 0.02, end + 0.02), length: 1.2 };
  },
  // the eraser bazooka: a green tube on the shoulder, a pink eraser in its mouth
  bazooka(K, M) {
    const green = C(0.42, 0.66, 0.4);
    const y = 0.1;
    K.cyl(M.paint, 0.075, 0.075, -0.55, 0.52, green, { y, segs: 16 });
    K.cyl(M.paint, 0.075, 0.098, 0.52, 0.62, C(0.34, 0.54, 0.32), { y, segs: 16, open: true });
    K.cyl(M.paint, 0.085, 0.085, -0.6, -0.52, C(0.3, 0.46, 0.28), { y, segs: 16 });
    for (const z of [-0.38, 0.36]) K.cyl(M.paint, 0.078, 0.078, z, z + 0.05, C(0.98, 0.84, 0.3), { y, segs: 16 });
    // the warhead: a big two-tone eraser poking out
    K.box(M.round, -0.058, y - 0.045, 0.5, 0.058, y + 0.045, 0.66, C(...ERASER_PINK));
    K.box(M.round, -0.058, y - 0.045, 0.66, 0.058, y + 0.045, 0.74, C(...ERASER_BLUE));
    K.box(M.matte, -0.02, -0.12, -0.12, 0.02, y - 0.06, -0.06, C(0.3, 0.3, 0.34));
    K.box(M.matte, -0.02, -0.08, 0.14, 0.02, y - 0.06, 0.2, C(0.3, 0.3, 0.34));
    K.box(M.matte, -0.03, y + 0.07, -0.08, 0.03, y + 0.13, 0.06, C(0.2, 0.2, 0.24));
    K.cyl(M.glow, 0.022, 0.022, 0.06, 0.068, C(1.0, 0.4, 0.4), { y: y + 0.1 });
    return { muzzle: new THREE.Vector3(0, y, 0.78), length: 1.3 };
  },
  // the police pen-pistol: a fat ballpoint for a barrel on a moulded grip
  pen(K, M) {
    K.box(M.matte, -0.022, -0.13, -0.05, 0.022, 0.0, 0.015, C(0.16, 0.18, 0.24));
    K.cyl(M.glass, 0.026, 0.026, -0.07, 0.2, C(0.82, 0.88, 0.95), { y: 0.03, segs: 6 });
    K.cyl(M.paint, 0.009, 0.009, -0.06, 0.17, C(...PEN_BLUE), { y: 0.03, segs: 6 });
    K.cyl(M.paint, 0.021, 0.021, 0.2, 0.26, C(...PEN_BLUE), { y: 0.03, segs: 6 });
    K.cyl(M.paint, 0.013, 0.013, -0.11, -0.07, C(...PEN_BLUE), { y: 0.03, segs: 6 });
    K.cyl(M.metal, 0.02, 0.003, 0.26, 0.31, C(0.82, 0.82, 0.86), { y: 0.03, segs: 8 });
    K.box(M.paint, 0.026, 0.05, -0.06, 0.034, 0.06, 0.1, C(...PEN_BLUE));
    return { muzzle: new THREE.Vector3(0, 0.03, 0.33), length: 0.4 };
  },
  // the paint M4 of the police special unit
  m4(K, M, o) {
    const dark = C(0.26, 0.27, 0.31);
    const paint = o.paint ? C(...o.paint) : C(0.95, 0.35, 0.6);
    K.box(M.matte, -0.03, -0.02, -0.12, 0.03, 0.06, 0.2, dark);
    K.box(M.matte, -0.025, -0.05, -0.36, 0.025, 0.05, -0.12, C(0.33, 0.33, 0.36));
    K.box(M.matte, -0.022, -0.12, -0.06, 0.022, -0.02, 0.0, dark);
    K.box(M.matte, -0.032, -0.01, 0.2, 0.032, 0.05, 0.38, C(0.36, 0.37, 0.4));
    K.cyl(M.metal, 0.012, 0.012, 0.38, 0.6, dark, { y: 0.02, segs: 8 });
    K.box(M.matte, -0.012, 0.06, -0.02, 0.012, 0.1, 0.14, dark);
    K.cyl(M.paint, 0.045, 0.045, -0.15, -0.05, paint, { axis: 'y', z: 0.08 });
    K.sphere(M.paint, 0.016, 0.04, -0.17, 0.08, paint, 1, 1.6, 1, 8);
    return { muzzle: new THREE.Vector3(0, 0.02, 0.62), length: 0.95 };
  },
  // the big two-tone school eraser
  bigEraser(K, M) {
    const w = 0.075;
    const h = 0.045;
    K.box(M.round, -w, -h, -0.02, w, h, 0.17, C(...ERASER_PINK));
    K.box(M.round, -w, -h, 0.17, w, h, 0.34, C(...ERASER_BLUE));
    K.box(M.matte, -w - 0.004, -h - 0.004, 0.12, w + 0.004, h + 0.004, 0.22, C(0.96, 0.95, 0.9));
    return { tip: new THREE.Vector3(0, 0, 0.34), length: 0.38 };
  },
  // the crayon shotgun: two barrels, a crayon in each, a box of spares strapped on
  shotgun(K, M) {
    const wood = C(0.66, 0.42, 0.26);
    const stock = new THREE.BoxGeometry(0.05, 0.1, 0.32);
    stock.rotateX(0.12);
    stock.translate(0, -0.03, -0.24);
    K.add(M.paint, stock, wood);
    K.box(M.matte, -0.034, -0.03, -0.08, 0.034, 0.05, 0.1, C(0.24, 0.22, 0.28));
    for (const sx of [-0.022, 0.022]) {
      K.cyl(M.metal, 0.021, 0.021, 0.1, 0.62, C(0.3, 0.3, 0.36), { x: sx, y: 0.03 });
      K.cyl(M.paint, 0.015, 0.015, 0.56, 0.64, sx < 0 ? C(0.92, 0.25, 0.28) : C(0.98, 0.78, 0.2), { x: sx, y: 0.03, segs: 10 });
      K.cyl(M.paint, 0.015, 0.002, 0.64, 0.68, sx < 0 ? C(0.92, 0.25, 0.28) : C(0.98, 0.78, 0.2), { x: sx, y: 0.03, segs: 10 });
    }
    K.box(M.paint, -0.04, -0.03, 0.24, 0.04, 0.02, 0.4, C(0.98, 0.56, 0.2));
    K.box(M.paint, 0.045, -0.02, -0.04, 0.085, 0.07, 0.08, C(0.3, 0.6, 0.95));
    const cols = [C(0.92, 0.25, 0.28), C(0.98, 0.78, 0.2), C(0.3, 0.75, 0.4), C(0.7, 0.4, 0.9)];
    cols.forEach((c, i) => K.cyl(M.paint, 0.008, 0.008, 0.07, 0.12, c, { axis: 'y', x: 0.055 + (i % 2) * 0.02, z: -0.02 + Math.floor(i / 2) * 0.05, segs: 6 }));
    const grip = new THREE.BoxGeometry(0.045, 0.11, 0.05);
    grip.rotateX(-0.3);
    grip.translate(0, -0.07, -0.05);
    K.add(M.matte, grip, C(0.24, 0.22, 0.28));
    return { muzzle: new THREE.Vector3(0, 0.03, 0.68), length: 1.0 };
  },
  // the stapler gun: a big red stapler, its jaw for a muzzle
  stapler(K, M) {
    K.box(M.matte, -0.035, -0.02, -0.06, 0.035, 0.02, 0.28, C(0.22, 0.22, 0.26));
    const arm = new THREE.BoxGeometry(0.06, 0.05, 0.34);
    arm.translate(0, 0.0, 0.17);
    arm.rotateX(-0.06);
    arm.translate(0, 0.055, -0.05);
    K.add(M.paint, arm, C(0.9, 0.18, 0.22));
    K.sphere(M.paint, 0.03, 0, 0.055, -0.05, C(0.9, 0.18, 0.22), 1, 0.9, 1, 10);
    K.box(M.metal, -0.026, 0.024, 0.0, 0.026, 0.03, 0.27, C(0.8, 0.8, 0.86));
    K.box(M.metal, -0.03, 0.02, 0.26, 0.03, 0.05, 0.29, C(0.8, 0.8, 0.86));
    K.box(M.matte, -0.022, -0.13, -0.04, 0.022, -0.02, 0.02, C(0.14, 0.14, 0.18));
    return { muzzle: new THREE.Vector3(0, 0.035, 0.31), length: 0.45 };
  },
  // the ruler sword: a long wooden ruler with its marks, a black grip, a gold guard
  katana(K, M) {
    K.cyl(M.round, 0.02, 0.02, -0.17, 0.04, C(0.12, 0.1, 0.12), { segs: 8 });
    for (let z = -0.15; z < 0.03; z += 0.035) K.cyl(M.round, 0.022, 0.022, z, z + 0.012, C(0.75, 0.15, 0.2), { segs: 8 });
    K.box(M.metal, -0.05, -0.022, 0.04, 0.05, 0.022, 0.06, C(0.95, 0.75, 0.25));
    K.box(M.paint, -0.006, -0.036, 0.06, 0.006, 0.036, 1.06, C(0.96, 0.86, 0.56));
    for (let i = 0, z = 0.08; z < 1.04; z += 0.025, i++) K.box(M.matte, -0.0065, 0.036 - (i % 4 === 0 ? 0.03 : 0.016), z, 0.0065, 0.036, z + 0.004, C(0.15, 0.12, 0.15));
    return { tip: new THREE.Vector3(0, 0, 1.06), length: 1.2 };
  },
  // the paper plane launcher: a cardboard tube with a plane in its mouth
  planes(K, M) {
    const card = C(0.8, 0.64, 0.44);
    K.cyl(M.round, 0.07, 0.07, -0.32, 0.42, card, { y: 0.08, segs: 14 });
    K.cyl(M.round, 0.076, 0.076, 0.4, 0.44, C(0.95, 0.4, 0.45), { y: 0.08, segs: 14 });
    K.cyl(M.round, 0.076, 0.076, -0.34, -0.3, C(0.95, 0.4, 0.45), { y: 0.08, segs: 14 });
    // the plane: two folded wings and a keel
    const plane = (z, y, s) => {
      const w = new THREE.BufferGeometry();
      const P = [0, y, z + 0.18 * s, -0.09 * s, y + 0.01, z - 0.04 * s, 0, y - 0.015, z - 0.06 * s, 0, y, z + 0.18 * s, 0, y - 0.015, z - 0.06 * s, 0.09 * s, y + 0.01, z - 0.04 * s];
      w.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      w.computeVertexNormals();
      K.add(M.matte, w, C(0.98, 0.98, 0.96));
      const back = w.clone();
      back.index = null;
      const p = back.attributes.position.array;
      for (let i = 0; i < p.length; i += 9) {
        for (let k = 0; k < 3; k++) {
          const t = p[i + 3 + k];
          p[i + 3 + k] = p[i + 6 + k];
          p[i + 6 + k] = t;
        }
      }
      back.computeVertexNormals();
      K.add(M.matte, back, C(0.92, 0.92, 0.9));
    };
    plane(0.44, 0.08, 1);
    plane(-0.05, 0.17, 0.7);
    K.box(M.matte, -0.02, -0.12, -0.08, 0.02, 0.02, -0.02, C(0.3, 0.3, 0.34));
    return { muzzle: new THREE.Vector3(0, 0.08, 0.6), length: 0.9 };
  },
  // the ink bomb: a bottle of ink with a cork and a fizzing fuse
  inkbomb(K, M) {
    K.cyl(M.glass, 0.05, 0.05, -0.05, 0.05, C(0.12, 0.16, 0.42), { axis: 'y' });
    K.cyl(M.glass, 0.022, 0.03, 0.05, 0.085, C(0.12, 0.16, 0.42), { axis: 'y' });
    K.cyl(M.round, 0.02, 0.02, 0.085, 0.11, C(0.66, 0.48, 0.3), { axis: 'y', segs: 8 });
    K.cyl(M.round, 0.052, 0.052, -0.02, 0.02, C(0.97, 0.95, 0.88), { axis: 'y' });
    K.cyl(M.round, 0.004, 0.004, 0.11, 0.17, C(0.4, 0.3, 0.2), { axis: 'y', segs: 5 });
    K.sphere(M.glow, 0.012, 0, 0.175, 0, C(1.0, 0.7, 0.2), 1, 1, 1, 8);
    return { muzzle: new THREE.Vector3(0, 0.05, 0.05), length: 0.2 };
  },
  // the glue gun: a hot-glue gun, the stick of glue out of the back
  glue(K, M) {
    K.box(M.paint, -0.035, -0.0, -0.08, 0.035, 0.1, 0.16, C(0.3, 0.5, 0.95));
    K.sphere(M.paint, 0.05, 0, 0.05, 0.16, C(0.3, 0.5, 0.95), 0.7, 1, 0.8);
    K.cyl(M.metal, 0.02, 0.006, 0.18, 0.26, C(0.8, 0.8, 0.85), { y: 0.05 });
    K.cyl(M.glass, 0.018, 0.018, -0.2, -0.08, C(0.96, 0.96, 0.9), { y: 0.06 });
    const grip = new THREE.BoxGeometry(0.06, 0.14, 0.06);
    grip.rotateX(-0.2);
    grip.translate(0, -0.06, -0.02);
    K.add(M.paint, grip, C(0.3, 0.5, 0.95));
    K.box(M.matte, -0.012, -0.05, 0.03, 0.012, 0.0, 0.06, C(0.95, 0.85, 0.2));
    K.sphere(M.glass, 0.012, 0, 0.04, 0.27, C(0.97, 0.97, 0.92), 1, 1.4, 1, 8);
    return { muzzle: new THREE.Vector3(0, 0.05, 0.28), length: 0.45 };
  },
  // the glowing highlighter: a giant neon marker, its chisel tip alight
  laser(K, M) {
    const y = 0.07;
    K.cyl(M.paint, 0.048, 0.048, -0.42, 0.34, C(0.98, 0.94, 0.25), { y, segs: 12 });
    K.cyl(M.paint, 0.052, 0.052, -0.46, -0.3, C(0.85, 0.8, 0.15), { y, segs: 12 });
    K.cyl(M.paint, 0.048, 0.03, 0.34, 0.42, C(0.2, 0.2, 0.24), { y, segs: 12 });
    const tip = new THREE.BoxGeometry(0.03, 0.05, 0.1);
    tip.rotateX(0.35);
    tip.translate(0, y, 0.46);
    K.add(M.glow, tip, C(0.9, 1.0, 0.3));
    K.box(M.matte, -0.02, -0.08, -0.06, 0.02, y - 0.04, 0.0, C(0.2, 0.2, 0.24));
    K.box(M.glow, -0.05, y - 0.006, -0.1, -0.046, y + 0.006, 0.2, C(0.9, 1.0, 0.3));
    return { muzzle: new THREE.Vector3(0, y, 0.52), length: 1.0 };
  },
  // the boomerang scissors: open blades, red and blue rings for the fingers
  boomerang(K, M) {
    for (const s of [-1, 1]) {
      const b = new THREE.BoxGeometry(0.03, 0.008, 0.3);
      b.translate(0, 0, 0.16);
      b.rotateY(s * 0.32);
      K.add(M.metal, b, C(0.85, 0.86, 0.9));
      K.torus(M.paint, 0.04, 0.012, s * 0.05, 0, -0.06, s > 0 ? C(0.9, 0.2, 0.25) : C(0.25, 0.45, 0.9), Math.PI / 2);
    }
    K.cyl(M.metal, 0.012, 0.012, -0.012, 0.012, C(0.5, 0.5, 0.55), { axis: 'y', z: 0.0, segs: 8 });
    return { tip: new THREE.Vector3(0, 0, 0.32), length: 0.4 };
  },
  // the sharpener minigun: a sharpener for a body, a ring of pencils spinning in front
  minigun(K, M, o) {
    K.box(M.metal, -0.08, -0.06, -0.3, 0.08, 0.1, 0.02, C(0.3, 0.45, 0.85));
    K.cyl(M.metal, 0.03, 0.03, -0.36, -0.3, C(0.2, 0.2, 0.24), { y: 0.02 });
    K.box(M.matte, -0.02, 0.1, -0.24, 0.02, 0.17, -0.05, C(0.2, 0.2, 0.24));
    K.box(M.matte, -0.022, -0.16, -0.18, 0.022, -0.06, -0.12, C(0.2, 0.2, 0.24));
    const B = new Kit();
    const cols = [C(0.98, 0.8, 0.22), C(0.92, 0.3, 0.3), C(0.3, 0.6, 0.95), C(0.4, 0.8, 0.4), C(0.95, 0.5, 0.75), C(0.98, 0.6, 0.2)];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pencilShape(B, M, 0.018, 0.02, 0.5, cols[i], { x: Math.cos(a) * 0.045, y: Math.sin(a) * 0.045 });
    }
    B.cyl(M.metal, 0.07, 0.07, 0.3, 0.33, C(0.75, 0.75, 0.8));
    B.cyl(M.metal, 0.07, 0.07, 0.05, 0.08, C(0.75, 0.75, 0.8));
    o.barrel = B;
    return { muzzle: new THREE.Vector3(0, 0.02, 0.62), length: 0.95 };
  },
  // the correction-fluid machine gun: a grey gun, a big white bottle of the stuff for a magazine
  tippex(K, M) {
    const body = C(0.6, 0.66, 0.78);
    const dark = C(0.22, 0.22, 0.28);
    const white = C(0.98, 0.98, 0.95);
    K.box(M.paint, -0.042, -0.03, -0.2, 0.042, 0.07, 0.3, body);
    const stock = new THREE.BoxGeometry(0.05, 0.1, 0.28);
    stock.rotateX(0.1);
    stock.translate(0, -0.01, -0.33);
    K.add(M.matte, stock, dark);
    const grip = new THREE.BoxGeometry(0.045, 0.13, 0.05);
    grip.rotateX(-0.3);
    grip.translate(0, -0.08, -0.04);
    K.add(M.matte, grip, dark);
    K.box(M.matte, -0.02, -0.1, 0.12, 0.02, -0.03, 0.18, dark);
    // the bottle, its label and its red cap with the brush
    K.cyl(M.paint, 0.062, 0.056, 0.07, 0.25, white, { axis: 'y', z: 0.05, segs: 14 });
    K.cyl(M.paint, 0.064, 0.063, 0.13, 0.18, C(0.3, 0.55, 0.92), { axis: 'y', z: 0.05, segs: 14 });
    K.cyl(M.paint, 0.034, 0.03, 0.25, 0.31, C(0.86, 0.22, 0.2), { axis: 'y', z: 0.05, segs: 10 });
    // the barrel and the nozzle, a white drop hanging from it
    K.cyl(M.metal, 0.022, 0.022, 0.3, 0.6, C(0.55, 0.56, 0.62), { y: 0.025, segs: 10 });
    K.cyl(M.paint, 0.034, 0.014, 0.6, 0.7, white, { y: 0.025, segs: 10 });
    K.sphere(M.paint, 0.016, 0, 0.0, 0.66, white, 1, 1.4, 1, 8);
    return { muzzle: new THREE.Vector3(0, 0.025, 0.72), length: 1.1 };
  },
  // the eraser machine gun: a big two-tone eraser for a body, a drum of little erasers
  erasermg(K, M) {
    const dark = C(0.22, 0.22, 0.28);
    K.box(M.round, -0.05, -0.04, -0.14, 0.05, 0.07, 0.26, C(...ERASER_PINK));
    K.box(M.round, -0.05, -0.04, -0.42, 0.05, 0.07, -0.14, C(...ERASER_BLUE));
    K.box(M.matte, -0.054, -0.044, -0.2, 0.054, 0.074, -0.1, C(0.96, 0.95, 0.9));
    const drum = new THREE.CylinderGeometry(0.085, 0.085, 0.07, 16).rotateZ(Math.PI / 2);
    drum.translate(0, -0.1, 0.1);
    K.add(M.paint, drum, C(...ERASER_BLUE));
    const grip = new THREE.BoxGeometry(0.045, 0.13, 0.05);
    grip.rotateX(-0.3);
    grip.translate(0, -0.09, -0.08);
    K.add(M.matte, grip, dark);
    K.cyl(M.metal, 0.024, 0.024, 0.26, 0.6, C(0.55, 0.56, 0.62), { y: 0.015, segs: 10 });
    K.box(M.round, -0.03, -0.012, 0.6, 0.03, 0.045, 0.67, C(...ERASER_PINK));
    return { muzzle: new THREE.Vector3(0, 0.015, 0.69), length: 1.1 };
  },
  // the paint machine gun: three cans of paint on its back, a nozzle ringed with colour
  paintmg(K, M) {
    const body = C(0.24, 0.3, 0.44);
    const dark = C(0.2, 0.2, 0.25);
    K.box(M.paint, -0.045, -0.03, -0.18, 0.045, 0.07, 0.3, body);
    const stock = new THREE.BoxGeometry(0.05, 0.1, 0.26);
    stock.translate(0, -0.01, -0.31);
    K.add(M.matte, stock, dark);
    const grip = new THREE.BoxGeometry(0.045, 0.13, 0.05);
    grip.rotateX(-0.3);
    grip.translate(0, -0.08, -0.05);
    K.add(M.matte, grip, dark);
    const cans = [C(0.92, 0.3, 0.36), C(0.98, 0.8, 0.22), C(0.25, 0.62, 0.86)];
    cans.forEach((c, i) => {
      const z = -0.11 + i * 0.12;
      K.cyl(M.paint, 0.042, 0.042, 0.07, 0.19, c, { axis: 'y', z, segs: 12 });
      K.cyl(M.metal, 0.044, 0.044, 0.19, 0.205, C(0.75, 0.75, 0.8), { axis: 'y', z, segs: 12 });
    });
    K.cyl(M.metal, 0.022, 0.022, 0.3, 0.6, C(0.55, 0.56, 0.62), { y: 0.025, segs: 10 });
    K.torus(M.glow, 0.026, 0.008, 0, 0.025, 0.6, C(1.0, 0.35, 0.6));
    K.cyl(M.paint, 0.03, 0.02, 0.6, 0.66, C(0.98, 0.8, 0.22), { y: 0.025, segs: 10 });
    return { muzzle: new THREE.Vector3(0, 0.025, 0.68), length: 1.05 };
  },
  // the cardboard shield: a flat of a box with tape and a handle (its face is the x side)
  shield(K, M) {
    K.box(M.round, -0.015, -0.4, -0.3, 0.015, 0.4, 0.3, C(0.78, 0.62, 0.42));
    K.box(M.matte, 0.016, -0.42, -0.06, 0.02, 0.42, 0.06, C(0.85, 0.82, 0.72));
    K.box(M.matte, 0.016, 0.24, -0.32, 0.02, 0.3, 0.32, C(0.85, 0.82, 0.72));
    K.sphere(M.paint, 0.07, 0.03, 0.04, 0.0, C(0.95, 0.4, 0.45), 0.3, 1, 1, 10);
    K.box(M.matte, -0.06, -0.05, -0.08, -0.015, 0.05, 0.08, C(0.3, 0.25, 0.22));
    return { tip: new THREE.Vector3(0.1, 0, 0), length: 0.6 };
  },
};

/**
 * A thing to hold: { group, muzzle, tip, length, barrel? } in the hand's frame.
 * grade: how well it was drawn (a bad drawing makes a bent thing).
 */
export function buildWeaponModel(id, grade = 'good', o = {}) {
  const M = mats();
  const K = new Kit();
  const fn = BUILD[id] || BUILD.paint;
  const opt = { ...o };
  const info = fn(K, M, opt);
  const seed = (id.length * 7.31 + (o.seed || 0)) % 10;
  const group = K.build({ warp: warpFor(grade, seed), seed: seed * 0.1 });
  const out = { group, ...info, id, grade };
  if (opt.barrel) {
    const b = opt.barrel.build({ warp: warpFor(grade, seed + 1), seed: seed * 0.2 });
    b.matrixAutoUpdate = true;
    group.add(b);
    out.barrel = b;
  }
  return out;
}

// the starting pencil and the gear the police drop (the old names)
export const buildPencilModel = () => buildWeaponModel('pencil');
export const buildPenGunModel = () => buildWeaponModel('pen');
export const buildM4Model = (_m, paint) => buildWeaponModel('m4', 'good', { paint });
export const buildBigEraserModel = () => buildWeaponModel('bigEraser');

export { Kit, mats as itemMats, warpFor, C as linC };

// (the old notebook revealed a drawn thing stroke by stroke; here it plops in whole)
export function setReveal() {}
