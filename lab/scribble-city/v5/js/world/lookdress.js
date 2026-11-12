// (GRAPHICS_PLAN.md, ROADMAP 20) The opening street dressed for the look (STYLE.on, core/util.js): strings of bulbs from the hotels'
// fronts over the sidewalk to the lamps, bougainvillea down the fronts and along the terraces' walls, baskets of flowers and banners on
// the lamps. Its own dice (the city's are left where they were), nothing to bump into (no new collision), all of it in the still city's
// merged pieces.
import * as THREE from 'three';
import { srgb, addLight, makeSurface } from '../render/materials.js';
import { nextId, seeded } from './kit.js';
import { CURB, STREETS, STREET_X0, STREET_X1, PROM_X1 } from './layout.js';
import { ZONE } from '../render/look.js';
import { GFX } from '../core/util.js';
import { clump, globeLamp, planter } from './streetscape.js';
import { bench } from './blocks.js';
import { free, trashCan } from './streets.js';
import { blossom, flowerMat } from './petals.js';

// (round 8: the bougainvillea of the owner's pictures - deep magenta, not a pale pink the light washes out)
const PINKS = [srgb(0.78, 0.06, 0.42), srgb(0.9, 0.1, 0.5), srgb(0.62, 0.04, 0.4), srgb(0.95, 0.16, 0.56), srgb(0.84, 0.08, 0.3)];
const WARMS = [srgb(1.0, 0.46, 0.14), srgb(1.0, 0.7, 0.2), srgb(0.95, 0.24, 0.2), srgb(0.9, 0.16, 0.5)];
const GREENS = [srgb(0.2, 0.46, 0.24), srgb(0.28, 0.56, 0.26), srgb(0.16, 0.38, 0.26)];
const BANNERS = [srgb(0.46, 0.16, 0.6), srgb(0.86, 0.2, 0.5), srgb(1.0, 0.5, 0.2), srgb(0.2, 0.5, 0.62)];
const WIRE = srgb(0.1, 0.08, 0.14);
const GLOW = srgb(1.0, 0.82, 0.5);
const TW = 3.2;
// (the phone's light version: the flowers from fewer bracts)
const DENS = GFX.lite ? 0.55 : 1;

const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);
function wire(ctx, a, b, r) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-3) return;
  const g = new THREE.CylinderGeometry(r, r, len, 4, 1, true);
  g.translate(0, len / 2, 0);
  _d.set(dx / len, dy / len, dz / len);
  g.applyQuaternion(_q.setFromUnitVectors(_y, _d));
  g.translate(a[0], a[1], a[2]);
  ctx.B.add(ctx.M.pole, g, null, nextId(), { color: WIRE });
}

// a string of bulbs from a to b, hanging sag metres in the middle: n bulbs under it
function festoon(ctx, a, b, sag, n, r = 0.085) {
  const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
  const S = 8;
  for (let i = 0; i < S; i++) wire(ctx, at(i / S), at((i + 1) / S), 0.012);
  for (let i = 0; i < n; i++) {
    const p = at((i + 0.5) / n);
    const g = new THREE.SphereGeometry(r, 6, 4);
    g.translate(p[0], p[1] - r * 1.25, p[2]);
    ctx.B.add(ctx.M.bulb, g, null, nextId(), { color: GLOW });
  }
}

// a tuft of flowers or leaves: a ball pushed in and out, lit as a ball (streetscape.js clump) - with the id it is given, so a whole
// cascade is outlined once, round all of it, and not ball by ball
function puff(ctx, r, cx, cy, cz, rad, squash, color, mat, id) {
  // (small and many, each a rough little shape: a mass of leaves and petals, not balls)
  const g = new THREE.IcosahedronGeometry(rad, 0);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const seed = r() * 1000;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const q = 1 / rad;
    const k = 1 + 0.34 * Math.sin(x * q * 3.1 + seed) * Math.cos(z * q * 2.7 + seed * 0.7) + 0.14 * Math.sin(y * q * 4.3 + seed * 1.3);
    p.setXYZ(i, x * k, y * k * squash, z * k);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  g.translate(cx, cy, cz);
  ctx.B.add(mat, g, null, id, { color });
}

// bougainvillea on a front (round 11, the owner's pictures): a mass of it at the first balcony, wide over the awnings and spilling
// out from the wall, strands of it hanging down from the mass, and a thin climb of it up the wall above
function cascade(ctx, r, f, u, v0, v1, w, side) {
  const o = { mat: ctx.M.flower, leafMat: ctx.M.leaf, idF: nextId(), idG: nextId(), base: null, greens: GREENS, green: 0.24 };
  const base = r.pick(PINKS);
  const vM = Math.min(v1 - 0.4, v0 + 1.5);
  const half = r.range(1.8, 2.7);
  // (in from the front's end, not round its corner)
  u += side * half * 0.75;
  // the mass: fullest in its middle
  const n = Math.round(half * 16 * DENS);
  for (let i = 0; i < n; i++) {
    const t = r.range(-1, 1);
    const k = 1 - t * t * 0.7;
    const p = f.p(u + t * half, vM + r.range(-0.7, 1.1) * k, w + r.range(0.05, 0.9) * k);
    o.base = r() < 0.75 ? base : r.pick(PINKS);
    blossom(ctx, r, p[0], p[1], p[2], r.range(0.36, 0.58) * (0.6 + 0.4 * k), Math.round(r.range(20, 28) * DENS), o);
  }
  // the strands down from it
  const strands = 3 + Math.floor(r() * 3);
  for (let q = 0; q < strands; q++) {
    const us = u + r.range(-1, 1) * half * 0.85;
    const len = r.range(0.5, Math.max(0.6, vM - v0 + 0.5));
    const wS = w + r.range(0.3, 0.75);
    for (let d = 0.25; d < len; d += r.range(0.22, 0.34)) {
      const p = f.p(us + r.range(-0.08, 0.08), vM - 0.3 - d, wS - d * 0.12);
      o.base = base;
      blossom(ctx, r, p[0], p[1], p[2], r.range(0.18, 0.27) * (1 - 0.4 * (d / len)), Math.round(r.range(10, 14) * DENS), o);
    }
  }
  // the climb above: sparse, mostly leaves
  o.green = 0.5;
  for (let v = vM + 0.7; v < v1; v += r.range(0.4, 0.7)) {
    const p = f.p(u + side * (v - vM) * r.range(0.05, 0.3) + r.range(-0.25, 0.25), v, w + r.range(0, 0.15));
    o.base = base;
    blossom(ctx, r, p[0], p[1], p[2], r.range(0.2, 0.32), Math.round(r.range(9, 13) * DENS), o);
  }
}

// a tuft of flowers (a basket, a pot, a wall's top): leaves under, the flower's bracts over them
function tuft(ctx, r, x, y, z, rad, n, pal) {
  blossom(ctx, r, x, y, z, rad, Math.round(n * 1.5 * DENS), { mat: ctx.M.flower, leafMat: ctx.M.leaf, idF: nextId(), idG: nextId(), base: r.pick(pal), greens: GREENS, green: 0.3, sq: 0.7 });
}

// a pot of flowers at the curb: the planter's leaves, and flowers over them
function flowerPot(ctx, r, x, z) {
  planter(ctx, r, x, z, { r: 0.52, color: srgb(0.74, 0.42, 0.3), trim: srgb(0.56, 0.3, 0.22) });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + r.range(-0.4, 0.4);
    tuft(ctx, r, x + Math.cos(a) * 0.28, CURB + 0.92 + r.range(0, 0.2), z + Math.sin(a) * 0.28, r.range(0.24, 0.32), 14, k % 3 === 2 ? WARMS : PINKS);
  }
}

export function lookDress(ctx) {
  const dice = ctx.rng;
  const r = (ctx.rng = seeded(20261111));
  const M = ctx.M;
  flowerMat(M);
  const hotels = ((ctx.ocean && ctx.ocean.hotels) || []).filter((h) => h.spec && h.spec.f && h.z1 > ZONE.z0 + 4 && h.z0 < ZONE.z1 - 4);
  for (const h of hotels) {
    const f = h.spec.f;
    const L = h.L;
    const top = Math.min((h.top || 12) - 0.6, 9.5);
    // down the two ends of the front (a long one: once more in the middle third)
    if (L > 9) {
      cascade(ctx, r, f, 1.1, 3.3, top, 0.3, 1);
      cascade(ctx, r, f, L - 1.1, 3.3, top * r.range(0.75, 1), 0.3, -1);
    }
    if (L > 24) cascade(ctx, r, f, L * r.range(0.38, 0.62), 4.6, top, 0.3, r() < 0.5 ? 1 : -1);
    // flowers along the terrace's low wall (not across the way in)
    if (h.spec.terrace) {
      const uD = h.uDoor !== undefined ? h.uDoor : L / 2;
      for (let u = 1.4; u < L - 1.2; u += r.range(0.75, 1.05)) {
        if (Math.abs(u - uD) < 2.0) continue;
        const p = f.p(u, CURB + 0.98 + r.range(-0.03, 0.06), TW + 0.02);
        const q = r();
        if (q < 0.25) clump(ctx, r, p[0], p[1], p[2], r.range(0.2, 0.3), 0.8, r.pick(GREENS).clone(), null, false);
        else tuft(ctx, r, p[0], p[1] + 0.05, p[2], r.range(0.2, 0.28), 11, q < 0.7 ? PINKS : WARMS);
      }
    }
  }
  // the lamps along the hotels' sidewalk: a string of bulbs to the front behind each, baskets of flowers, a banner
  // (the boulevard's hotel side had none: the look's own, along the curb, where there is room for one)
  const lamps = [];
  {
    const x = STREET_X0 - 1.45;
    let n = 0;
    for (let z = ZONE.z0 + 9; z < ZONE.z1 - 6; z += 9.5) {
      if (STREETS.some((s) => Math.abs(z - s.z) < s.half + s.walk + 3)) continue;
      if (ctx.col.pointInside(x, 1.2, z, 0.7)) continue;
      globeLamp(ctx, x, z, { alongZ: true, light: n++ % 2 === 0 });
      lamps.push({ x, z });
    }
  }
  for (let i = 0; i + 1 < lamps.length; i++) {
    const a = lamps[i];
    const b = lamps[i + 1];
    if (b.z - a.z < 10.5) festoon(ctx, [a.x, CURB + 4.12, a.z + 0.6], [b.x, CURB + 4.12, b.z - 0.6], 0.5, 11);
  }
  let k = 0;
  for (const l of lamps) {
    const h = hotels.find((q) => l.z > q.z0 + 0.8 && l.z < q.z1 - 0.8);
    if (h) {
      const f = h.spec.f;
      const a = f.p(f.toU(l.x, l.z), 5.3, 0.12);
      festoon(ctx, a, [l.x, CURB + 4.2, l.z], 0.95, 16);
      addLight((a[0] + l.x) / 2, 3.4, l.z, 10.5, GLOW, 0.85);
    }
    for (const s of [-1, 1]) {
      const bx = l.x - 0.02;
      const bz = l.z + s * 0.5;
      wire(ctx, [l.x, CURB + 3.75, l.z], [bx, CURB + 3.6, bz], 0.014);
      wire(ctx, [bx, CURB + 3.6, bz], [bx, CURB + 3.28, bz], 0.008);
      clump(ctx, r, bx, CURB + 3.2, bz, 0.3, 0.75, r.pick(GREENS).clone());
      tuft(ctx, r, bx, CURB + 3.36, bz, 0.3, 16, k % 2 ? WARMS : PINKS);
    }
    // (the banner: across the way you walk, seen from along the street)
    const g = new THREE.BoxGeometry(0.56, 1.5, 0.03);
    g.translate(l.x - 0.42, CURB + 2.72, l.z);
    ctx.B.add(M.awning, g, null, nextId(), { color: BANNERS[k % BANNERS.length] });
    wire(ctx, [l.x, CURB + 3.47, l.z], [l.x - 0.72, CURB + 3.47, l.z], 0.014);
    k++;
  }
  // (round 8, the owner's pictures) pots of flowers between the lamps; and the sea's side of the boulevard dressed as the hotels'
  // is: lamps with their baskets and banners, a bench, a bin, pots of flowers - each only where nothing stands yet
  for (let i = 0; i + 1 < lamps.length; i++) {
    const a = lamps[i];
    const b = lamps[i + 1];
    if (b.z - a.z > 10.5) continue;
    const z = (a.z + b.z) / 2;
    if (free(ctx, a.x, z, 0.75)) flowerPot(ctx, r, a.x, z);
  }
  {
    // (at the curb's edge and at the promenade's far side: the strollers' lines are at 15.2 and 17.6, game/civilians.js PROM_LINES)
    const x = STREET_X1 + 0.8;
    const xb = PROM_X1 - 0.75;
    let n = 0;
    for (let z = ZONE.z0 + 13.5; z < ZONE.z1 - 6; z += 9.5) {
      if (STREETS.some((s) => Math.abs(z - s.z) < s.half + s.walk + 3)) continue;
      const slot = n++ % 4;
      if (slot === 0 || slot === 2) {
        if (!free(ctx, x, z, 0.8)) continue;
        globeLamp(ctx, x, z, { alongZ: true, light: slot === 0 });
        for (const sg of [-1, 1]) {
          const bz = z + sg * 0.5;
          wire(ctx, [x, CURB + 3.75, z], [x, CURB + 3.6, bz], 0.014);
          wire(ctx, [x, CURB + 3.6, bz], [x, CURB + 3.28, bz], 0.008);
          clump(ctx, r, x, CURB + 3.2, bz, 0.3, 0.75, r.pick(GREENS).clone());
          tuft(ctx, r, x, CURB + 3.36, bz, 0.3, 16, k % 2 ? WARMS : PINKS);
        }
        const g = new THREE.BoxGeometry(0.56, 1.5, 0.03);
        g.translate(x + 0.42, CURB + 2.72, z);
        ctx.B.add(M.awning, g, null, nextId(), { color: BANNERS[k % BANNERS.length] });
        wire(ctx, [x, CURB + 3.47, z], [x + 0.72, CURB + 3.47, z], 0.014);
        k++;
      } else if (slot === 1) {
        if (free(ctx, x, z, 0.75)) flowerPot(ctx, r, x, z);
      } else {
        if (free(ctx, xb, z, 1.2)) bench(ctx, xb, z, -Math.PI / 2);
        if (free(ctx, xb, z + 1.9, 0.5)) trashCan(ctx, xb, z + 1.9);
        if (free(ctx, x, z, 0.75)) flowerPot(ctx, r, x, z);
      }
    }
  }
  ctx.rng = dice;
}
