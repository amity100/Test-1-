// (GRAPHICS_PLAN.md, ROADMAP 20) The look: the art direction of the drawing, in one place, over the renderer as it is. A profile - the
// hour's palette (the sun low at the end of the boulevard, a violet sky going to magenta and orange, the lamps and the windows lit), the
// last pass's grade, how the pens and the ink are laid, how wet the street is, how far the glow reaches - given to the shaders through
// the shared uniforms, by where the camera is: all of it inside the opening street's zone, fading out over PAD metres round it, none of
// it beyond (STYLE.k, 0..1). Off unless the address asks for it (?look, core/util.js STYLE): without it the game draws as it always did.
import * as THREE from 'three';
import { shared } from './materials.js';
import { STYLE } from '../core/util.js';

// the opening street: Ocean Drive between 11th and 9th, its hotels' fronts, the promenade, the park and the beach beside it
export const ZONE = { x0: -72, x1: 118, z0: -118, z1: 44, pad: 45 };

// the hour as the look paints it (game/daynight.js KEYS: the same fields)
export const LOOK_KEY = {
  sun: [1.0, 0.62, 0.32], sunK: 1.7,
  top: [0.3, 0.2, 0.58], mid: [0.94, 0.44, 0.46], hz: [1.0, 0.62, 0.24], glow: [1.0, 0.82, 0.4], bounce: [0.96, 0.7, 0.7], paper: [0.95, 0.88, 0.84],
  fog: 0.00055, bloom: 0.5, exp: 1.3, lamp: 0.6, lit: 1.15, stars: 0.08,
  pens: [
    [1.0, 0.74, 0.26], [1.0, 0.56, 0.22], [1.0, 0.46, 0.36], [1.0, 0.86, 0.48],
    [0.98, 0.4, 0.42], [0.82, 0.3, 0.58], [1.0, 0.52, 0.36], [0.62, 0.26, 0.66],
    [0.36, 0.17, 0.62], [0.27, 0.13, 0.52], [0.48, 0.2, 0.68], [0.2, 0.11, 0.46],
  ],
  cloud: [[0.46, 0.2, 0.56], [1.0, 0.62, 0.36]],
  core: [1.0, 0.97, 0.8], ring: [1.0, 0.7, 0.26], sglow: [1.0, 0.72, 0.36],
};
// the sun: just over the horizon, down the boulevard's far end and a little to the sea's side
export const LOOK_SUN = new THREE.Vector3(0.13, 0.06, -1).normalize();
// (round 8) where its disc is drawn: half set at the very end of the boulevard, under the road sign - the owner's pictures. The
// light and the shadows keep the sun above: a sun that low would lay every shadow the length of the street
// (round 13, the owner's picture: the sun seen - a little up the sky over the road sign, not behind it)
// (round 14, the owner's word: where a setting sun is - low over the horizon, and where the light and the shadows come from)
export const LOOK_DISC = new THREE.Vector3(0.13, 0.068, -1).normalize();
// the last pass: the shadows to violet, the lights to gold, a fuller curve, more colour
// (round 11, the owner's word - the sky exactly as it was before the clouds were touched: the grade and the exposure are the whole
// picture's, the sky's too, so they are round 8's again)
const GRADE = { grade: 0.52, shadowT: [0.95, 0.88, 1.14], lightT: [1.14, 1.0, 0.84], vib: 0.3 };
const PLAIN = { shadowT: [0.74, 0.9, 1.2], lightT: [1.13, 0.97, 0.8] };

const smooth = (x) => x * x * (3 - 2 * x);

// (ROADMAP 23, the owner's word: "bring the street's new graphic style there too" - the story's places: the boulevard on south
// of the opening street, the ice-cream stand, the pier and the giant wheel. Its light, sky, ink and colour; the opening street's
// own dressing - world/lookdress.js - is that street's)
export const STORY_ZONES = [
  { x0: -72, x1: 118, z0: 44, z1: 200, pad: 45 },
  { x0: -40, x1: 200, z0: 190, z1: 310, pad: 45 },
];
// how much of the look there is at a place (1 inside a zone, 0 PAD metres out of it)
export function lookAt(x, z) {
  let k = 0;
  for (const Z of [ZONE, ...STORY_ZONES]) {
    const dx = Math.max(Z.x0 - x, 0, x - Z.x1);
    const dz = Math.max(Z.z0 - z, 0, z - Z.z1);
    k = Math.max(k, 1 - Math.hypot(dx, dz) / Z.pad);
  }
  return smooth(Math.max(0, k));
}

// each frame, before it is drawn (game/game.js renderFrame): the look by where the camera is
export function lookFrame(game) {
  if (!STYLE.on) return;
  const pipe = game.pipe;
  const c = game.camera.position;
  // (the opening film keeps its own light and colour: game/prologue/director.js - while it is filmed, holdCam. The player's own
  // walks and drives between its scenes look as the game does, ROADMAP 18.9 - and the game's look is this one now, 20.15: it comes
  // back over a second after a shot, and is gone at once when one begins, so a moment between two shots does not flash it)
  // (ROADMAP 23: but a scene filmed again in the game's look - director.js newLook - is in it, its shots too)
  const film = !!(game.prologue && game.prologue.active && game.prologue.holdCam && !game.prologue.newLook);
  const now = performance.now();
  const dtF = Math.min(0.1, (now - (lookFrame.at || now)) / 1000);
  lookFrame.at = now;
  lookFrame.back = film ? 0 : Math.min(1, (lookFrame.back === undefined ? 1 : lookFrame.back) + dtF / 1.0);
  const k = STYLE.off || film ? 0 : lookAt(c.x, c.z) * smooth(lookFrame.back);
  if (k === STYLE.k && k === 0) return;
  STYLE.k = k;
  shared.uLook.value = k;
  // (the owner's phone: 14 to 17 frames a second under the look - on a phone its lighter way, render/glsl.js uLookLow: no dark ink
  // hatched into every shade, no scribbled strokes, the street's mirror read twice and not five times, the clouds from less noise)
  shared.uLookLow.value = pipe.low && k > 0 ? 1 : 0;
  // (and the mirror under the street drawn every third frame there, not every other: the wet stone it is read through is rough)
  pipe.lookReflEvery = pipe.low && k > 0.5 ? 3 : 1;
  // the ink's line, bolder
  pipe.lineW = 1.25 + 0.55 * k;
  const L = pipe.look;
  // (the film's own grade is the director's, eased from shot to shot - game/prologue/director.js tickLook: what it had when the
  // player's own time began is kept, and given back the moment the next shot begins)
  const keep = lookFrame.keep;
  if (film) {
    if (keep) {
      for (let i = 0; i < 3; i++) {
        L.shadowT[i] = keep.s[i];
        L.lightT[i] = keep.l[i];
      }
      L.vib = 0;
      lookFrame.keep = null;
    }
    return;
  }
  if (!keep && k > 0 && game.prologue && game.prologue.active) lookFrame.keep = { s: [...L.shadowT], l: [...L.lightT] };
  if (keep && !(game.prologue && game.prologue.active)) lookFrame.keep = null;
  // (the grade's violet and gold are the evening's: by day and by night a part of it)
  L.grade = GRADE.grade * k * (0.4 + 0.6 * STYLE.hourK);
  for (let i = 0; i < 3; i++) {
    L.shadowT[i] = k > 0 ? GRADE.shadowT[i] : PLAIN.shadowT[i];
    L.lightT[i] = k > 0 ? GRADE.lightT[i] : PLAIN.lightT[i];
  }
  L.vib = GRADE.vib * k;
}
