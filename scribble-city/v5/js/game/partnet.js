import { picture, ready, chances } from './sketchnet.js';
import { PNET } from './partnet_w.js';

// (ROADMAP 11.25) What is drawn for the car, of one category's things. The player says the
// category - a weapon, something it can do, protection - and draws; this tells which of that
// category's things it is, or that it is none of them. A small network of game/sketchnet.js's make,
// that learned from people's drawings (Quick, Draw!: cannons, rifles, lightning, swords and knives,
// hot-air balloons, parachutes, ceiling fans, squares, triangles, stars, clouds, zigzags) and from
// drawings made for what that lacks (flames, wings, rotors, propellers, springs, shields), and from
// what is none of them (houses, trees, faces, cats, cars, scrawls...). Its weights are in
// game/partnet_w.js.

export const CATS = {
  weapon: ['cannon', 'mg', 'flamer', 'bolt', 'blades'],
  func: ['wing', 'balloon', 'rotor', 'prop', 'jet', 'spring', 'chute'],
  armor: ['armor', 'ram', 'star', 'smoke', 'spikes'],
};
export const CAT_ORDER = ['weapon', 'func', 'armor'];
// each thing: the network's class for its drawing (a flame: the flamethrower's, or the jet's)
export const CLASS_OF = {
  cannon: 'cannon', mg: 'gun', flamer: 'flame', bolt: 'lightning', blades: 'blade',
  wing: 'wing', balloon: 'balloon', rotor: 'rotor', prop: 'propeller', jet: 'flame', spring: 'spring', chute: 'parachute',
  armor: 'plate', ram: 'wedge', star: 'star', smoke: 'cloud', spikes: 'spikes',
};
// less sure of it than this, and it is looked at mirrored too (as game/sketchnet.js does)
const MIRROR_BELOW = 0.8;
const G = PNET.size;
const OTHER = PNET.classes.indexOf('other');

function mirrored(img) {
  const m = new Float32Array(G * G);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) m[y * G + x] = img[y * G + G - 1 - x];
  return m;
}

// the drawing (strokes: arrays of [x, y], any units, y down), as one of a category's things:
// { item (null: none of them), p (how sure), none (how sure it is none of them), ranked: [[item, p],
// ...] (highest first) }
export function readItem(strokes, cat) {
  const items = CATS[cat];
  const lines = strokes.filter((s) => s && s.length);
  if (!items || !lines.length) return { item: null, p: 0, none: 1, ranked: [] };
  const idx = items.map((it) => PNET.classes.indexOf(CLASS_OF[it]));
  const img = picture(ready(lines));
  const share = (p) => {
    let s = p[OTHER];
    for (const i of idx) s += p[i];
    return s > 0 ? s : 1;
  };
  let p = chances(img, PNET);
  let s = share(p);
  if (Math.max(...idx.map((i) => p[i] / s), p[OTHER] / s) < MIRROR_BELOW) {
    const q = chances(mirrored(img), PNET);
    p = p.map((v, i) => (v + q[i]) / 2);
    s = share(p);
  }
  const ranked = items.map((it, k) => [it, p[idx[k]] / s]).sort((a, b) => b[1] - a[1]);
  const none = p[OTHER] / s;
  const [best, pb] = ranked[0];
  return { item: pb > none ? best : null, p: pb, none, ranked };
}
