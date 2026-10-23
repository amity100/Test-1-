import { picture, ready, chances } from './sketchnet.js';
import { PNET } from './partnet_w.js';
import { ITEMS, CATS as ITEM_CATS, CAT_ORDER as ITEM_ORDER } from './itemcat.js';

// (ROADMAP 11.25) What is drawn for the car, of one category's things. The player says the
// category - a weapon, something it can do, protection - and draws; this tells which of that
// category's things it is, or that it is none of them. A small network of game/sketchnet.js's make,
// that learned from people's drawings (Quick, Draw!) and from drawings made for what that lacks, and
// from what is none of them (houses, trees, faces, flowers, scrawls...). Its weights are in
// game/partnet_w.js, whose head says what it learned from.
//
// (ROADMAP 11.28) Thirty-five things now (game/itemcat.js), each drawn as one or more of the network's
// thirty-three classes - one drawing, a thing in each category it is in: a flame is the flamethrower
// among the weapons and the turbo among what moves, a hook a harpoon and a grappling hook, a coil a jump
// and a Tesla coil, a rotor the drone and the helicopter's. A thing is as likely as all its classes
// together. (A car is one now: the drawn double.)

export const CATS = ITEM_CATS;
export const CAT_ORDER = ITEM_ORDER;
// each thing: the network's classes for its drawing
export const CLASS_OF = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, ITEMS[id].cls]));
// less sure of it than this, and it is looked at mirrored too (as game/sketchnet.js does)
const MIRROR_BELOW = 0.8;
const G = PNET.size;
const OTHER = PNET.classes.indexOf('other');
// each thing's classes the network has (one it has not learned yet is no chance)
const IDX = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, ITEMS[id].cls.map((c) => PNET.classes.indexOf(c)).filter((i) => i >= 0)]));

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
  const sum = (p, id) => IDX[id].reduce((s, i) => s + p[i], 0);
  const share = (p) => {
    let s = p[OTHER];
    for (const id of items) s += sum(p, id);
    return s > 0 ? s : 1;
  };
  const img = picture(ready(lines));
  let p = chances(img, PNET);
  let s = share(p);
  if (Math.max(...items.map((id) => sum(p, id) / s), p[OTHER] / s) < MIRROR_BELOW) {
    const q = chances(mirrored(img), PNET);
    p = p.map((v, i) => (v + q[i]) / 2);
    s = share(p);
  }
  const ranked = items.map((id) => [id, sum(p, id) / s]).sort((a, b) => b[1] - a[1]);
  const none = p[OTHER] / s;
  const [best, pb] = ranked[0];
  return { item: pb > none ? best : null, p: pb, none, ranked };
}
