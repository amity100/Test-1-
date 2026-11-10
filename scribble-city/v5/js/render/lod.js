// (ROADMAP 19.2, PHONE_SPEED_PLAN.md Section 8) The people by their size on the screen: the same shapes over
// the same corners, fewer triangles while a person is small in the picture. Phones only (GFX.folkLod).
//
// A lighter version of a shape is only another list of triangles over the SAME corners (render/simplify.js:
// a corner pulled onto a neighbour, never a new point), so the texture the corners live in, a face's moves,
// the pictures laid on the shapes and the ring a head meets its neck in all stay as they are and in step. The
// lists are made beforehand (tools/perf/lodtest.mjs bake -> render/folklod.js, each differing from the full
// shape by at most half a pixel where it is used) and named by the layout they are for (layoutSig): a shape
// whose layout is not in the file has no lighter version and is drawn as ever, so a changed shape never
// shows a wrong one.

import { GFX } from '../core/util.js';

// How many pixels a metre of a person is on the screen (ppm) decides which version is drawn:
//   a head: the first lighter one below 150 (a head some 4 m off on a phone), the second below 55 (11 m);
//   every other part: the lighter one below 110 (5.4 m).
// Each version differs from the full shape by at most 0.55 / ppm metres where it starts to be used (half a pixel).
export const LOD_HEAD = [150, 55];
export const LOD_BODY = [110];
// (a version is held until the line is passed by this much - no flicker on the line)
export const LOD_HOLD = 0.08;

let LIGHT = null;

// loads the lists made beforehand; false (and nobody gets a lighter version) if they cannot be had
export async function initLod() {
  if (!GFX.folkLod) return false;
  try {
    LIGHT = (await import('./folklod.js')).LIGHT;
    return true;
  } catch (e) {
    console.warn('lighter shapes', e && e.message);
    return false;
  }
}

// a layout of triangles by its corners' number, its triangles' number and a sum over its list
export function layoutSig(corners, index) {
  let h = 0;
  for (let i = 0; i < index.length; i++) h = (Math.imul(h, 31) + index[i]) | 0;
  return `${corners}/${index.length / 3}/${h}`;
}

const _cache = new Map();
// the lighter versions of a layout ({ corners, index }): a Uint16Array of triangles for each, the first
// lighter one first - or null
export function lightOf(layout) {
  if (!LIGHT) return null;
  const sig = layoutSig(layout.corners, layout.index);
  if (_cache.has(sig)) return _cache.get(sig);
  const e = LIGHT[sig];
  let out = null;
  if (e) {
    out = e.map((b64) => {
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Uint16Array(u8.buffer);
    });
  }
  _cache.set(sig, out);
  return out;
}

// the version a person's part is drawn in this frame: 0 the full shape, 1 the first lighter one...
// lines: the ppm below which each lighter version starts, from the nearest (LOD_HEAD, LOD_BODY); was: the
// version it was drawn in last frame. A lighter version is taken when the line is passed by LOD_HOLD,
// and given up for the heavier when it is passed back by as much.
export function lodLevel(ppm, lines, was) {
  let lv = was;
  while (lv < lines.length && ppm < lines[lv] * (1 - LOD_HOLD)) lv++;
  while (lv > 0 && ppm > lines[lv - 1] * (1 + LOD_HOLD)) lv--;
  return lv;
}
