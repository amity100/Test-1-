import * as THREE from 'three';
import { BLOCK_TYPES } from '../world/layout.js';

// Every district of the city is drawn by a different artist, in a different medium.
// The shaders look the medium up from the world position (block -> style id), and the
// numbers below tell them what the paper, the ink and the strokes are like.

export const STYLES = ['classic', 'charcoal', 'technical', 'watercolor', 'gel', 'spray', 'pop', 'crayon', 'graphite'];
export const STYLE_ID = Object.fromEntries(STYLES.map((s, i) => [s, i]));

const BY_TYPE = {
  start: 'classic', brown: 'classic', loft: 'classic', dealer: 'classic',
  theater: 'charcoal',
  finance: 'technical', office: 'technical', empire: 'technical',
  park: 'watercolor',
  alien: 'gel',
  fortress: 'spray', fortress2: 'spray',
  plaza: 'pop',
  warehouse: 'crayon', ferry: 'crayon',
  tower: 'graphite',
};

// shown when you walk onto another artist's page
export const STYLE_LABEL = {
  classic: 'עט כדורי וצבעי עיפרון',
  charcoal: 'פחם וגיר אדום',
  technical: 'עט כחול טכני',
  watercolor: 'צבעי מים',
  gel: 'עטי ג\'ל זוהרים על דף שחור',
  spray: 'ספריי וטוש',
  pop: 'קומיקס',
  crayon: 'צבעי שעווה',
  graphite: 'עיפרון גרפיט',
};

// per style, 5 rows of vec4 (see the shaders):
//  A: paper rgb, paper tooth (grain strength)
//  B: ink rgb, ink softness (0 crisp .. 1 grainy chalk)
//  C: line width x, wobble x, overshoot x, pressure (0 = ruler-even technical line)
//  D: line alpha x, neon lines (1), fill saturation x, fill value x
//  E: night ink rgb, page rules (0 none, 1 ruled, 2 grid, 3 dots)
//  F: night page rgb (the paper this artist turns to after dark), spare
const T = {
  classic: [[0.968, 0.958, 0.93, 1.0], [0.12, 0.16, 0.34, 0.0], [1, 1, 1, 1], [1, 0, 1, 1], [0.86, 0.89, 1.0, 1], [0.072, 0.082, 0.155, 0]],
  charcoal: [[0.875, 0.82, 0.725, 2.4], [0.15, 0.13, 0.13, 1.0], [1.6, 1.3, 1.3, 1], [0.92, 0, 0.55, 1.0], [0.98, 0.9, 0.8, 0], [0.115, 0.098, 0.09, 0]],
  technical: [[0.962, 0.972, 0.99, 0.5], [0.09, 0.26, 0.6, 0.0], [0.82, 0.0, 2.8, 0], [1, 0, 0.45, 1.02], [0.8, 0.92, 1.0, 2], [0.05, 0.11, 0.27, 0]],
  watercolor: [[0.988, 0.982, 0.966, 1.5], [0.38, 0.38, 0.43, 0.45], [0.72, 1.4, 0.8, 1], [0.62, 0, 1.3, 1.0], [0.85, 0.88, 0.96, 0], [0.08, 0.1, 0.19, 0]],
  gel: [[0.045, 0.045, 0.085, 0.7], [0.95, 0.4, 0.82, 0.0], [1.15, 1.0, 1.0, 1], [1, 1, 1.5, 0.35], [0.95, 0.4, 0.82, 1], [0.03, 0.03, 0.06, 0]],
  spray: [[0.885, 0.875, 0.85, 1.8], [0.05, 0.05, 0.06, 0.15], [1.85, 0.5, 0.6, 1], [1, 0, 1.65, 1.0], [0.95, 0.95, 0.95, 0], [0.075, 0.075, 0.095, 0]],
  pop: [[0.992, 0.982, 0.95, 0.4], [0.03, 0.03, 0.04, 0.0], [2.0, 0.25, 0.5, 0], [1, 0, 1.55, 1.05], [1.0, 0.94, 0.62, 3], [0.075, 0.05, 0.13, 0]],
  crayon: [[0.95, 0.915, 0.83, 2.2], [0.17, 0.16, 0.34, 0.85], [1.75, 1.7, 1.0, 1], [0.9, 0, 1.4, 1.0], [0.96, 0.86, 0.62, 0], [0.1, 0.07, 0.15, 0]],
  graphite: [[0.972, 0.97, 0.962, 1.0], [0.23, 0.23, 0.26, 0.5], [0.95, 1.0, 1.9, 1], [0.85, 0, 0.18, 1.0], [0.82, 0.84, 0.9, 0], [0.09, 0.09, 0.11, 0]],
};

export function styleOfBlock(bx, bz) {
  return STYLE_ID[BY_TYPE[BLOCK_TYPES[bz][bx]] || 'classic'];
}

// style id -> 5 rows of params, as a float texture (texelFetch(x = row, y = style))
export function makeStyleTexture() {
  const rows = 6;
  const data = new Float32Array(rows * STYLES.length * 4);
  STYLES.forEach((s, y) => {
    T[s].forEach((v, x) => data.set(v, (y * rows + x) * 4));
  });
  const tex = new THREE.DataTexture(data, rows, STYLES.length, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// 5 x 5 blocks -> style id (r = id / 255)
export function makeDistrictTexture() {
  const data = new Uint8Array(5 * 5 * 4);
  for (let bz = 0; bz < 5; bz++) {
    for (let bx = 0; bx < 5; bx++) data[(bz * 5 + bx) * 4] = styleOfBlock(bx, bz);
  }
  const tex = new THREE.DataTexture(data, 5, 5, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// the same lookup on the CPU (for the page colour where you stand, the district card...)
export function styleAt(x, z) {
  const bx = Math.floor((x + 210) / 84);
  const bz = Math.floor((z + 145) / 58);
  if (bx < 0 || bx > 4 || bz < 0 || bz > 4) return 0;
  const lx = x + 210 - bx * 84;
  const lz = z + 145 - bz * 58;
  if (lx < 7 || lx > 77 || lz < 5 || lz > 53) return 0;
  return styleOfBlock(bx, bz);
}

export function styleParams(id) {
  return T[STYLES[id]];
}
