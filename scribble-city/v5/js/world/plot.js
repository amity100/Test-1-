import * as THREE from 'three';
import { srgb, hex } from '../render/materials.js';
import { nextId, seeded } from './kit.js';
import { fbox, neonSign } from './deco.js';
import { CURB } from './layout.js';
import { homeHouse, homeLayout } from './home.js';

// (v5, ROADMAP 11.17) A plot to build on: mowed grass between low hedges, a path of stepping
// stones in from the sidewalk, a sapling, and a sign at the front - DRAW YOUR HOME. Nobody has
// built here yet; a friend drawn with a magic pencil may draw a house on it (game/friend.js,
// world/home.js). Its place is kept (ctx.plots) so that the house can be found again; once a
// house is drawn on it (ctx.homes, kept in the browser), the plot is built with the house on it.

// how far back her house stands (the drawing of it is drawn in the same place: game/friend.js)
export const PLOT_FRONT = 3.4;

const hashOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return (h % 2147483000) + 1;
};

export function plotLot(ctx, spec) {
  const M = ctx.M;
  const r = ctx.rng;
  const { f, L, D } = spec;
  const info = { f, L, D, h: 0, top: CURB, floors: 0, doors: [], shop: null, kit: 'plot' };
  if (ctx.roofs) ctx.roofs.cur = null;
  ctx.plots = ctx.plots || [];
  const key = ctx.block ? `${ctx.block.id}:${ctx.plots.length}` : null;
  const rec = key && ctx.homes ? ctx.homes.get(key) : null;
  // (the row's dice thrown the same, a house on it or not: its neighbours stay the ones they were)
  const tu = r() < 0.5 ? 1.6 : L - 1.6;
  const su = r() < 0.5 ? 1.4 : L - 3.2;
  const plot = { key, f: { ox: f.ox, oz: f.oz, ux: f.ux, uz: f.uz, nx: f.nx, nz: f.nz }, L, D, home: null };
  ctx.plots.push(plot);
  // the lawn
  fbox(ctx, f, M.grass, 0.2, CURB - 0.02, -D + 0.3, L - 0.2, CURB + 0.02, -0.2, srgb(0.5, 0.78, 0.44));
  // the hedges along the back and the sides
  const hedge = srgb(0.3, 0.55, 0.3);
  fbox(ctx, f, M.leaf, 0.2, CURB, -D + 0.3, L - 0.2, CURB + 0.9, -D + 1.0, hedge);
  for (const u of [0.2, L - 0.85]) fbox(ctx, f, M.leaf, u, CURB, -D + 1.0, u + 0.65, CURB + 0.75, -1.6, hedge);
  if (rec) {
    // her house, as she drew it (its own dice, from its place)
    const hs = { f, L, D, style: rec.style, kind: 'homeFriend', front: PLOT_FRONT, rng: seeded(hashOf(key)), heart: true };
    const h = homeHouse(ctx, hs);
    const lay = homeLayout(hs);
    // the path of stones to her door, flowers along the front, a tree in the corner
    for (let w = -0.6; w > -PLOT_FRONT + 0.2; w -= 0.75) fbox(ctx, f, M.court, lay.ud - 0.4, CURB + 0.02, w - 0.28, lay.ud + 0.4, CURB + 0.05, w + 0.28, srgb(0.88, 0.86, 0.82));
    const bloom = [srgb(0.95, 0.32, 0.45), srgb(1.0, 0.82, 0.3), srgb(0.98, 0.98, 0.95), srgb(0.75, 0.42, 0.9), srgb(1.0, 0.6, 0.3)];
    let k = 0;
    for (let u = lay.u0 + 0.3; u < lay.u1 - 0.3; u += 0.42) {
      if (Math.abs(u - lay.ud) < 1.5) continue;
      fbox(ctx, f, M.leaf, u - 0.15, CURB, -PLOT_FRONT + 0.15, u + 0.15, CURB + 0.32, -PLOT_FRONT + 0.6, bloom[k++ % bloom.length]);
    }
    tree(ctx, f, tu, -D + 2.6, 1.6);
    plot.home = { rec, room: h.room, door: h.doors[0], uDoor: lay.ud };
    h.kit = 'plot';
    return h;
  }
  // stepping stones up the middle
  for (let w = -0.9; w > -Math.min(D - 2, 8); w -= 0.9) fbox(ctx, f, M.court, L / 2 - 0.35, CURB + 0.02, w - 0.3, L / 2 + 0.35, CURB + 0.05, w + 0.3, srgb(0.86, 0.84, 0.8));
  // a sapling, tied to its stake
  tree(ctx, f, tu, -D + 2.6, 1);
  // the sign at the front: on two posts, its words
  for (const du of [0.1, 1.7]) fbox(ctx, f, M.prop, su + du - 0.05, CURB, -0.95, su + du + 0.05, CURB + 1.6, -0.85, srgb(0.95, 0.94, 0.9));
  fbox(ctx, f, M.prop, su - 0.05, CURB + 0.9, -0.95, su + 1.85, CURB + 1.65, -0.88, srgb(0.98, 0.97, 0.94));
  neonSign(ctx, f, 'DRAW YOUR HOME', su + 0.9, CURB + 1.28, -0.86, 1.7, hex('#3b6fd6'), { font: 'Permanent Marker', size: 80 });
  return info;
}

// a young tree (s: how grown)
function tree(ctx, f, u, w, s) {
  const M = ctx.M;
  const tp = f.p(u, 0, w);
  const trunk = new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 1.7 * s, 6);
  trunk.translate(tp[0], CURB + 0.85 * s, tp[2]);
  ctx.B.add(M.propCyl, trunk, null, nextId(), { color: srgb(0.45, 0.32, 0.2) });
  const crown = new THREE.SphereGeometry(0.75 * s, 10, 8);
  crown.translate(tp[0], CURB + 2.1 * s, tp[2]);
  ctx.B.add(M.leaf, crown, null, nextId(), { color: srgb(0.42, 0.7, 0.4) });
}
