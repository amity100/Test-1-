// (GRAPHICS_PLAN.md, ROADMAP 20) The opening street dressed for the look (STYLE.on, core/util.js): strings of bulbs from the hotels'
// fronts over the sidewalk to the lamps, bougainvillea down the fronts and along the terraces' walls, baskets of flowers and banners on
// the lamps. Its own dice (the city's are left where they were), nothing to bump into (no new collision), all of it in the still city's
// merged pieces.
import * as THREE from 'three';
import { srgb, addLight, makeSurface } from '../render/materials.js';
import { nextId, seeded } from './kit.js';
import { CURB, STREETS, STREET_X0 } from './layout.js';
import { ZONE } from '../render/look.js';
import { clump, globeLamp } from './streetscape.js';

const PINKS = [srgb(0.86, 0.14, 0.5), srgb(0.96, 0.3, 0.62), srgb(0.72, 0.1, 0.44), srgb(1.0, 0.42, 0.7), srgb(0.9, 0.2, 0.36)];
const WARMS = [srgb(1.0, 0.5, 0.2), srgb(1.0, 0.74, 0.26), srgb(0.98, 0.94, 0.9), srgb(0.96, 0.3, 0.62)];
const GREENS = [srgb(0.2, 0.46, 0.24), srgb(0.28, 0.56, 0.26), srgb(0.16, 0.38, 0.26)];
const BANNERS = [srgb(0.46, 0.16, 0.6), srgb(0.86, 0.2, 0.5), srgb(1.0, 0.5, 0.2), srgb(0.2, 0.5, 0.62)];
const WIRE = srgb(0.1, 0.08, 0.14);
const GLOW = srgb(1.0, 0.82, 0.5);
const TW = 3.2;

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
  const g = new THREE.IcosahedronGeometry(rad, 1);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const seed = r() * 1000;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const q = 1 / rad;
    const k = 1 + 0.22 * Math.sin(x * q * 3.1 + seed) * Math.cos(z * q * 2.7 + seed * 0.7) + 0.14 * Math.sin(y * q * 4.3 + seed * 1.3);
    p.setXYZ(i, x * k, y * k * squash, z * k);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  g.translate(cx, cy, cz);
  ctx.B.add(mat, g, null, id, { color });
}

// bougainvillea down a front: from v1 down to v0 at u, widening as it falls
function cascade(ctx, r, f, u, v0, v1, w, side) {
  const n = Math.max(10, Math.round((v1 - v0) * 5.5));
  const idF = nextId();
  const idG = nextId();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const v = v1 - (v1 - v0) * t + r.range(-0.3, 0.3);
    const uu = u + side * t * r.range(0.1, 1.3) + r.range(-0.4, 0.4);
    const p = f.p(uu, v, w + r.range(-0.05, 0.22));
    const green = r() < 0.3;
    puff(ctx, r, p[0], p[1], p[2], r.range(0.24, 0.5), r.range(0.6, 0.85), (green ? r.pick(GREENS) : r.pick(PINKS)).clone().multiplyScalar(r.range(0.9, 1.2)), green ? ctx.M.leaf : ctx.M.flower, green ? idG : idF);
  }
}

export function lookDress(ctx) {
  const dice = ctx.rng;
  const r = (ctx.rng = seeded(20261111));
  const M = ctx.M;
  // the flowers' pen: the leaves', holding a little of its colour in the shade
  if (!M.flower) M.flower = makeSurface({ kind: 'leaf', vcolor: true, emVColor: true, emissive: new THREE.Color(0.3, 0.3, 0.3), ang: 0.6, line: 0.22, objMask: true });
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
        clump(ctx, r, p[0], p[1], p[2], r.range(0.2, 0.3), 0.8, (q < 0.25 ? r.pick(GREENS) : q < 0.7 ? r.pick(PINKS) : r.pick(WARMS)).clone(), q < 0.25 ? null : M.flower, false);
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
      clump(ctx, r, bx + r.range(-0.08, 0.08), CURB + 3.34, bz + r.range(-0.08, 0.08), 0.26, 0.8, r.pick(k % 2 ? WARMS : PINKS).clone(), M.flower, false);
    }
    // (the banner: across the way you walk, seen from along the street)
    const g = new THREE.BoxGeometry(0.56, 1.5, 0.03);
    g.translate(l.x - 0.42, CURB + 2.72, l.z);
    ctx.B.add(M.awning, g, null, nextId(), { color: BANNERS[k % BANNERS.length] });
    wire(ctx, [l.x, CURB + 3.47, l.z], [l.x - 0.72, CURB + 3.47, l.z], 0.014);
    k++;
  }
  ctx.rng = dice;
}
