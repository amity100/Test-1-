// What moves on its own (the people's parts, the cars), and where it was a frame ago. The smart
// drawing (render/pipeline.js) puts each frame together with the ones before it, and a thing that
// moves must be looked up where it was then, not where the camera alone would put it. Each
// instanced draw of theirs keeps, for every instance, last frame's matrix (three rows) in one float
// texture shared by all of them; the draw says where its rows begin (uMotion, set just before it
// is drawn). Nothing of this is done while the smart drawing is off.
import * as THREE from 'three';
import { shared } from './materials.js';

// instances on a row of the texture (three texels each)
const PER_ROW = 1024;

export const motion = {
  // (render/pipeline.js: on while the smart drawing is)
  on: false,
  // the frame being got ready: one more after each drawing
  gen: 0,
  used: 0,
  usedGen: -1,
  data: null,
  tex: null,
  cap: 0,
};

function grow(n) {
  const rows = Math.ceil(n / PER_ROW);
  const data = new Float32Array(rows * PER_ROW * 12);
  if (motion.data) data.set(motion.data.subarray(0, Math.min(motion.data.length, data.length)));
  if (motion.tex) motion.tex.dispose();
  const tex = new THREE.DataTexture(data, PER_ROW * 3, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  motion.data = data;
  motion.tex = tex;
  motion.cap = rows * PER_ROW;
  shared.uPrevInst.value = tex;
}

// a draw's instances this frame: their n rows (12 numbers each, last frame's matrices) go in; the
// row where they begin comes back
export function motionRows(prev, n) {
  if (motion.usedGen !== motion.gen) {
    motion.used = 0;
    motion.usedGen = motion.gen;
  }
  const base = motion.used;
  motion.used += n;
  if (motion.used > motion.cap) grow(motion.used + 512);
  motion.data.set(prev.subarray(0, n * 12), base * 12);
  return base;
}

// before the frame is drawn: the rows of this frame up to the graphics card
export function motionUpload() {
  if (motion.tex && motion.usedGen === motion.gen && motion.used > 0) motion.tex.needsUpdate = true;
}

// the rows of a matrix as it is now (a thing just come: it was where it is)
export function rowsOf(e, out, o) {
  out[o] = e[0];
  out[o + 1] = e[4];
  out[o + 2] = e[8];
  out[o + 3] = e[12];
  out[o + 4] = e[1];
  out[o + 5] = e[5];
  out[o + 6] = e[9];
  out[o + 7] = e[13];
  out[o + 8] = e[2];
  out[o + 9] = e[6];
  out[o + 10] = e[10];
  out[o + 11] = e[14];
}

// an instanced draw that keeps its last matrices (own: { motionBase, motionGen }): it tells the
// shader where its rows are, and only if they are this frame's (paused, nothing was put down:
// nothing moved). (Off, nothing is told: the draws are as they were)
export function bindMotion(mesh, own) {
  mesh.userData.motion = own;
  mesh.onBeforeRender = (r, s, c, g, mat) => {
    if (!motion.on) return;
    shared.uMotion.value.set(own.motionBase, own.motionGen === motion.gen ? 1 : 0);
    mat.uniformsNeedUpdate = true;
  };
  mesh.onAfterRender = (r, s, c, g, mat) => {
    if (!motion.on) return;
    shared.uMotion.value.set(0, 0);
    mat.uniformsNeedUpdate = true;
  };
}
