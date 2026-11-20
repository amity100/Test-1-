// (v5, ROADMAP 28.27) What a shot does where it lands - the owner's word: "every shot should bring a beautiful
// effect of this drawn world: a paint rifle's car goes up in colours and fire, correction fluid leaves erasures and
// fire on what it hits, the pencil rifle is hot metal that leaves a real hole, in walls too. The shots themselves not
// overdone; where they land - beautiful, professional, of the world, not childish."
//
// By what the shot is made of:
//   graphite (pencil rifle, the MAG's slugs, the minigun's shavings) - hot: a hole burnt through the page, its edge
//     white-hot and cooling to a dull red, sparks off it, a wisp of smoke; through a thin wall and out of its far
//     side, through a body and on (game/weapons.js, pr.hot)
//   correction fluid - what it lands on is rubbed out in a white ring that runs outwards, and burns a while with a
//     white fire: flakes of burnt paper go up off it. A car it soaks catches fire
//   paint (the paint gun, the paint machine gun, crayons, the police's ink and markers) - a burst of it thrown out
//     over the surface, running down a wall in drips, a mist of its colour; a car brought down by it burns in its
//     colours and goes up in them: rings, fire and smoke of every colour, lumps of paint thrown far and left where
//     they fall
//   erasers - a rubbed smear, crumbs, dust
// The shot's own damage, the holes rubbed in the city, the paint on somebody - all as they were (game/weapons.js
// onHit); this is what is seen on top. A machine gun's every shot gets the light part of it, every second or third
// the rest: the page must not fill up, nor the phone slow down.

import { groundHeight } from '../world/layout.js';

// (no colour here is brighter than the page: past its white the look only pales it - saturated, and dark beside it)
const HOT = [[1.0, 0.86, 0.42], [1.0, 0.58, 0.14], [0.95, 0.34, 0.07]];
const FIRE = [[1.0, 0.5, 0.13], [1.0, 0.74, 0.22], [0.95, 0.3, 0.06]];
const HOT_WHITE = [1.15, 1.1, 0.8, 1];
const HOT_RED = [1.0, 0.26, 0.06, 0.95];
const COLD = [0.5, 0.1, 0.04, 0];
const GRAPHITE = [[0.2, 0.2, 0.24], [0.34, 0.34, 0.38]];
const SOOT = [0.28, 0.27, 0.3];
const WHITE = [1.15, 1.15, 1.12];
// (correction fluid's fire: white at its heart, blue at its edge, real fire among it)
const WHITE_FIRE = [[1.15, 1.15, 1.12], [0.55, 0.76, 1.1], [1.0, 0.6, 0.18], [1.15, 1.15, 1.12]];
const WHITE_CORE = [1.15, 1.15, 1.15];
const ASH = [[0.97, 0.97, 0.94], [0.72, 0.72, 0.74], [0.4, 0.4, 0.43]];
const PINK = [[0.86, 0.55, 0.62], [0.75, 0.42, 0.5]];
const PAINTS = [[0.92, 0.3, 0.28], [0.98, 0.75, 0.18], [0.25, 0.55, 0.92], [0.35, 0.75, 0.38], [0.95, 0.5, 0.75], [0.6, 0.38, 0.85], [0.98, 0.55, 0.2]];

const GRAPHITE_KINDS = new Set(['pencil', 'slug', 'shaving']);
const PAINT_KINDS = new Set(['paint', 'paintmg', 'crayon', 'paintball', 'ink', 'marker']);

// how often a kind's full effect may be made (s): a rifle's every shot, a machine gun's every second or third
const GAP = { pencil: 0, slug: 0.16, shaving: 0.14, tippex: 0.16, paint: 0.1, paintmg: 0.15, crayon: 0.05, paintball: 0.1, ink: 0.1, marker: 0.1, rubber: 0.16 };

// a colour a little brighter or duller, never past the page's white
const hdr = (c, k) => [Math.min(1.12, c[0] * Math.min(k, 1.2)), Math.min(1.12, c[1] * Math.min(k, 1.2)), Math.min(1.12, c[2] * Math.min(k, 1.2))];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class ImpactFx {
  constructor(game) {
    this.game = game;
    this.last = {};
    // lumps of paint in the air, each left where it falls
    this.globs = [];
    this.stats = { world: 0, body: 0, car: 0, deaths: 0, exits: 0 };
  }

  // may this kind's full effect be made now (else the light part alone)
  rich(kind, x, z) {
    const g = this.game;
    const cam = g.camera.position;
    if (Math.hypot(x - cam.x, z - cam.z) > 70) return false;
    const t = g.time;
    const gap = GAP[kind] === undefined ? 0.1 : GAP[kind];
    if (t - (this.last[kind] || -9) < gap) return false;
    this.last[kind] = t;
    return true;
  }

  // ------------------------------------------------------------------ on the world: a wall, the ground, a thing
  world(pr, hit, ux, uy, uz) {
    const kind = pr.kind;
    const fx = this.game.fx;
    const nx = hit.nx || 0;
    const ny = hit.ny === undefined ? 1 : hit.ny;
    const nz = hit.nz || 0;
    const x = hit.x;
    const y = hit.y;
    const z = hit.z;
    this.stats.world++;
    if (GRAPHITE_KINDS.has(kind)) {
      const big = kind === 'slug' ? 1.25 : kind === 'shaving' ? 0.5 : 1;
      const rich = this.rich(kind, x, z);
      // (back off the wall, the way it came - and along the wall)
      const d = ux * nx + uy * ny + uz * nz;
      const rx = ux - 2 * d * nx;
      const ry = uy - 2 * d * ny;
      const rz = uz - 2 * d * nz;
      fx.spray(x, y, z, rx * 0.6 + nx * 0.6, ry * 0.6 + ny * 0.6 + 0.15, rz * 0.6 + nz * 0.6, rich ? 7 : 3, 7.5 * big, HOT, { cone: 0.75, len: 0.17, life: 0.26, wide: 2.4 });
      if (!rich) return;
      fx.markAt('hole', x, y, z, nx, ny, nz, 0.36 * big, [1, 1, 1], 0.95, 0.034);
      const rim = fx.markAt('rim', x, y, z, nx, ny, nz, 0.4 * big, HOT_WHITE, 1, 0.04);
      fx.animate(rim, { life: 0.5, tint1: HOT_RED, ease: 2, next: { life: 1.3, tint1: COLD } });
      fx.sprite('glow', x + nx * 0.06, y + ny * 0.06, z + nz * 0.06, { size: 0.75 * big, grow: 0.5, life: 0.13, tint: HOT[0] });
      // (molten bits dropping off it; smoke off the hole)
      fx.spray(x, y, z, nx, ny + 0.3, nz, 3, 2.4, HOT.slice(1), { cone: 0.9, bits: true, len: 0.028, life: 0.75 });
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + nx * 0.1, y + ny * 0.1 + 0.05, z + nz * 0.1, { size: 0.2 * big, grow: 2.6, life: 1.25, vx: nx * 0.3, vy: 0.75, vz: nz * 0.3, tint: SOOT, alpha: 0.55, fadeIn: 0.12 });
      return;
    }
    if (kind === 'tippex') {
      const rich = this.rich(kind, x, z);
      // (the white of it thrown over the surface; the erasure running out from where it landed)
      fx.markAt('burst', x, y, z, nx, ny, nz, rich ? 1.0 + Math.random() * 0.4 : 0.5, WHITE, 0.96, 0.026);
      const ring = fx.markAt('rim', x, y, z, nx, ny, nz, 0.45, [1.15, 1.15, 1.15], 0.95, 0.045);
      fx.animate(ring, { life: 0.34, tint1: [1.15, 1.15, 1.15, 0], w1: rich ? 1.7 : 1.1, h1: rich ? 1.7 : 1.1, ease: 2 });
      if (!rich) return;
      fx.sprite('glow', x + nx * 0.08, y + ny * 0.08, z + nz * 0.08, { size: 0.9, grow: 0.6, life: 0.12, tint: [1.15, 1.15, 1.15] });
      fx.burn(x + nx * 0.07, y + ny * 0.07 - 0.04, z + nz * 0.07, { life: 1.15 + Math.random() * 0.5, size: 0.3, tints: WHITE_FIRE, core: WHITE_CORE, smoke: false });
      // (what burnt of the page: flakes going up, a white steam)
      fx.spray(x, y, z, nx * 0.4, 1, nz * 0.4, 5, 1.7, ASH, { cone: 1.1, flutter: true, len: 0.036, life: 1.5 });
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + nx * 0.12, y + ny * 0.12 + 0.1, z + nz * 0.12, { size: 0.3, grow: 2.2, life: 1.1, vy: 0.9, tint: [1.2, 1.2, 1.2], alpha: 0.5, fadeIn: 0.1 });
      return;
    }
    if (PAINT_KINDS.has(kind)) {
      const c = pr.color || pick(PAINTS);
      const s = kind === 'paint' || kind === 'paintball' ? 1 : kind === 'paintmg' ? 0.75 : kind === 'crayon' ? 0.5 : 0.6;
      const rich = this.rich(kind, x, z);
      fx.sprite('glow', x + nx * 0.06, y + ny * 0.06, z + nz * 0.06, { size: 0.5 * s, grow: 0.6, life: 0.1, tint: hdr(c, 1.9), alpha: 0.8 });
      if (!rich) {
        fx.markAt('burst', x, y, z, nx, ny, nz, (0.42 + Math.random() * 0.2) * s, c, 0.9, 0.024);
        return;
      }
      // (thrown out over the surface: the splash of it, and the thick of it in its middle)
      fx.markAt('burst', x, y, z, nx, ny, nz, (1.05 + Math.random() * 0.4) * s, c, 0.9, 0.024);
      fx.markAt('burst', x, y, z, nx, ny, nz, (0.55 + Math.random() * 0.15) * s, [c[0] * 0.82, c[1] * 0.82, c[2] * 0.82], 0.95, 0.03);
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + nx * 0.14, y + ny * 0.14, z + nz * 0.14, { size: 0.34 * s, grow: 1.9, life: 0.42, vx: nx * 0.9, vy: ny * 0.9 + 0.2, vz: nz * 0.9, tint: hdr(c, 1.15), alpha: 0.5 });
      // (on a wall: it runs)
      if (Math.abs(ny) < 0.5) this.drips(x, y, z, nx, nz, c, s);
      return;
    }
    if (kind === 'rubber') {
      if (!this.rich(kind, x, z)) return;
      // (rubbed: a pale smear, the dust of it)
      fx.markAt('scorch', x, y, z, nx, ny, nz, 0.5, [2.6, 2.1, 2.2], 0.42, 0.026);
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + nx * 0.1, y + ny * 0.1, z + nz * 0.1, { size: 0.26, grow: 1.8, life: 0.5, vx: nx * 0.6, vy: 0.3, vz: nz * 0.6, tint: [1.05, 0.9, 0.93], alpha: 0.45 });
      fx.spray(x, y, z, nx, ny + 0.3, nz, 4, 2.6, PINK, { cone: 0.9, bits: true, len: 0.035, life: 0.8 });
    }
  }

  // paint running down a wall from where it landed: a run or two, each as long as it likes
  drips(x, y, z, nx, nz, c, s) {
    const fx = this.game.fx;
    const l = Math.hypot(nx, nz) || 1;
    // (along the wall, and straight up it)
    const ax = [-nz / l, 0, nx / l];
    const n = 1 + (Math.random() < 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const o = (Math.random() - 0.5) * 0.34 * s;
      const w = (0.2 + Math.random() * 0.12) * s;
      const len = Math.min(y - 0.2, (0.45 + Math.random() * 0.75) * s);
      if (len < 0.12) continue;
      const d = fx.decalAt('drip', x + ax[0] * o + (nx / l) * 0.028, y + 0.02 - Math.random() * 0.08 * s, z + ax[2] * o + (nz / l) * 0.028, w, 0.04, c, 0.94, ax, [0, 1, 0], [0.5, 0.975]);
      fx.animate(d, { hold: 0.08 + i * 0.2, life: 1.3 + Math.random() * 0.9, h1: len, ease: 2.2 });
    }
  }

  // out of the far side of a thin wall the hot graphite went through
  exit(pr, x, y, z, ux, uy, uz) {
    const fx = this.game.fx;
    this.stats.exits++;
    fx.markAt('hole', x, y, z, ux, uy, uz, 0.3, [1, 1, 1], 0.95, 0.034);
    const rim = fx.markAt('rim', x, y, z, ux, uy, uz, 0.34, HOT_WHITE, 1, 0.04);
    fx.animate(rim, { life: 0.5, tint1: HOT_RED, ease: 2, next: { life: 1.1, tint1: COLD } });
    fx.sprite('glow', x + ux * 0.08, y + uy * 0.08, z + uz * 0.08, { size: 0.6, grow: 0.5, life: 0.12, tint: HOT[0] });
    // (the wall's own stuff blown out ahead of it)
    fx.spray(x, y, z, ux, uy + 0.1, uz, 8, 6, [[0.93, 0.92, 0.88], [0.7, 0.7, 0.72], [0.3, 0.3, 0.33]], { cone: 0.5, bits: true, len: 0.04, life: 0.7 });
    fx.spray(x, y, z, ux, uy, uz, 5, 8, HOT, { cone: 0.4, len: 0.16, life: 0.22, wide: 2.2 });
    fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + ux * 0.2, y + uy * 0.2, z + uz * 0.2, { size: 0.3, grow: 2, life: 0.6, vx: ux * 1.6, vy: uy * 1.6 + 0.3, vz: uz * 1.6, tint: [0.92, 0.91, 0.88], alpha: 0.5 });
  }

  // ------------------------------------------------------------------ on somebody
  // who: { pos, yaw } of the one hit (an enemy, a passer-by)
  body(pr, hit, ux, uy, uz, who) {
    const kind = pr.kind;
    const fx = this.game.fx;
    const x = hit.x;
    const y = hit.y;
    const z = hit.z;
    this.stats.body++;
    if (GRAPHITE_KINDS.has(kind)) {
      // (through him and out of his back: what it is made of, and the heat of it)
      fx.sprite('glow', x, y, z, { size: 0.42, grow: 0.5, life: 0.1, tint: HOT[0], alpha: 0.9 });
      if (!this.rich(kind, x, z)) return;
      fx.spray(x + ux * 0.3, y + uy * 0.3, z + uz * 0.3, ux, uy + 0.1, uz, 5, 6, GRAPHITE, { cone: 0.45, len: 0.12, life: 0.3, wide: 2.6 });
      fx.spray(x + ux * 0.3, y + uy * 0.3, z + uz * 0.3, ux, uy + 0.15, uz, 3, 5, HOT, { cone: 0.4, len: 0.1, life: 0.22, wide: 2 });
      return;
    }
    if (kind === 'tippex') {
      fx.sprite('glow', x, y, z, { size: 0.6, grow: 0.5, life: 0.11, tint: [1.15, 1.15, 1.15], alpha: 0.9 });
      if (!this.rich(kind, x, z) || !who || !who.pos) return;
      // (it burns on him a moment, white)
      const c = Math.cos(who.yaw || 0);
      const s = Math.sin(who.yaw || 0);
      const dx = x - who.pos.x;
      const dz = z - who.pos.z;
      fx.burn(x, y, z, { life: 0.85, size: 0.24, tints: WHITE_FIRE, core: WHITE_CORE, smoke: false, follow: who, ox: dx * c - dz * s, oy: y - (who.pos.y || 0), oz: dx * s + dz * c, done: () => who.alive === false });
      fx.spray(x, y, z, -ux * 0.3, 1, -uz * 0.3, 4, 1.6, ASH, { cone: 1.0, flutter: true, len: 0.034, life: 1.2 });
      return;
    }
    if (PAINT_KINDS.has(kind)) {
      const c = pr.color || pick(PAINTS);
      fx.sprite('glow', x, y, z, { size: 0.5, grow: 0.5, life: 0.1, tint: hdr(c, 1.8), alpha: 0.8 });
      if (!this.rich(kind, x, z)) return;
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x - ux * 0.1, y, z - uz * 0.1, { size: 0.32, grow: 1.8, life: 0.4, vx: -ux * 0.7, vy: 0.3, vz: -uz * 0.7, tint: hdr(c, 1.15), alpha: 0.5 });
      // (what goes past him lands behind him)
      const gy = groundHeight(x + ux * 1.4, z + uz * 1.4);
      if (Math.abs(gy - (y - 1)) < 1.6) fx.decal('burst', x + ux * (0.9 + Math.random() * 0.9), gy + 0.17, z + uz * (0.9 + Math.random() * 0.9), 0.5 + Math.random() * 0.3, c, 0.85, [1, 0, 0], [0, 0, -1]);
    }
  }

  // ------------------------------------------------------------------ on a car
  car(pr, hit, ux, uy, uz, c) {
    const kind = pr.kind;
    const game = this.game;
    const fx = game.fx;
    const x = hit.x;
    const y = hit.y;
    const z = hit.z;
    this.stats.car++;
    // (what brought it down is what it goes up in: carDeath)
    const S = c.shotBy || (c.shotBy = { kind: null, color: null, t: 0, n: 0, cols: [] });
    if (S.kind !== kind || game.time - S.t > 6) {
      S.n = 0;
      S.cols.length = 0;
    }
    S.kind = kind;
    S.t = game.time;
    S.n++;
    const nx = hit.nx || -ux;
    const ny = hit.ny || 0;
    const nz = hit.nz || -uz;
    if (GRAPHITE_KINDS.has(kind)) {
      // (through its tin: sparks off it, a hot hole that goes with it a moment)
      const rich = this.rich(kind, x, z);
      fx.spray(x, y, z, nx * 0.7 - ux * 0.3, ny + 0.35, nz * 0.7 - uz * 0.3, rich ? 9 : 4, 8, HOT, { cone: 0.8, len: 0.18, life: 0.28, wide: 2.4 });
      fx.sprite('glow', x + nx * 0.05, y, z + nz * 0.05, { size: 0.6, grow: 0.5, life: 0.12, tint: HOT[0] });
      if (rich) fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + nx * 0.1, y + 0.1, z + nz * 0.1, { size: 0.22, grow: 2.4, life: 0.9, vy: 0.9, tint: SOOT, alpha: 0.5 });
      return;
    }
    if (kind === 'tippex') {
      fx.sprite('glow', x + nx * 0.05, y, z + nz * 0.05, { size: 0.8, grow: 0.5, life: 0.12, tint: [1.15, 1.15, 1.15] });
      // (soaked in it, it catches)
      if (S.n >= 7 && game.damage && c.dmg && !c.dmg.burning && !c.dmg.burnt && !c.hurt) game.damage.ignite(c, 0.2);
      if (!this.rich(kind, x, z)) return;
      this.onCar(c, x, y, z, { life: 1.5, size: 0.34, tints: WHITE_FIRE, core: WHITE_CORE, smoke: false });
      fx.spray(x, y, z, nx * 0.4, 1, nz * 0.4, 4, 1.8, ASH, { cone: 1.1, flutter: true, len: 0.036, life: 1.3 });
      return;
    }
    if (PAINT_KINDS.has(kind)) {
      const col = pr.color || pick(PAINTS);
      S.color = col;
      if (S.cols.length < 6) S.cols.push(col);
      fx.sprite('glow', x + nx * 0.05, y, z + nz * 0.05, { size: 0.6, grow: 0.6, life: 0.1, tint: hdr(col, 1.9), alpha: 0.85 });
      if (!this.rich(kind, x, z)) return;
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + nx * 0.15, y, z + nz * 0.15, { size: 0.4, grow: 1.9, life: 0.45, vx: nx * 1.1, vy: 0.4, vz: nz * 1.1, tint: hdr(col, 1.15), alpha: 0.55 });
      fx.spray(x, y, z, nx, 0.5, nz, 6, 4.5, col, { cone: 0.9, wide: 4.5, len: 0.11, life: 0.6 });
      // (what runs off it, on the road under it)
      const gy = groundHeight(x, z);
      if (Math.random() < 0.6) fx.decal('burst', x + nx * (0.3 + Math.random() * 0.6), gy + 0.17, z + nz * (0.3 + Math.random() * 0.6), 0.5 + Math.random() * 0.35, col, 0.85, [1, 0, 0], [0, 0, -1]);
    }
  }

  // a little fire on a car, going with it
  onCar(c, x, y, z, o) {
    const cs = Math.cos(c.yaw || 0);
    const sn = Math.sin(c.yaw || 0);
    const dx = x - c.pos.x;
    const dz = z - c.pos.z;
    return this.game.fx.burn(x, y, z, { ...o, follow: c, ox: dx * cs - dz * sn, oy: y - (c.pos.y || 0), oz: dx * sn + dz * cs, done: () => c.dead || c.poofT !== undefined });
  }

  // it has caught fire: by what set it alight - paint burns in its colours, correction fluid white (the fire that
  // is drawn on it as ever is its own: game/damage.js)
  carAlight(c) {
    const S = c.shotBy;
    if (!S || this.game.time - S.t > 8) return;
    const paint = PAINT_KINDS.has(S.kind);
    if (!paint && S.kind !== 'tippex') return;
    const cols = paint ? (S.cols.length ? S.cols : PAINTS) : null;
    const D = c.dmg;
    for (let i = 0; i < 4; i++) {
      const tints = paint ? [cols[i % cols.length], cols[(i + 1) % cols.length], FIRE[0]] : WHITE_FIRE;
      this.game.fx.burn(c.pos.x, 1, c.pos.z, { life: 14, size: 0.6 + (i % 2) * 0.2, tints, core: paint ? undefined : WHITE_CORE, smoke: paint, follow: c, ox: ((i % 2) - 0.5) * 0.9, oy: 0.9 + (i % 2) * 0.3, oz: 1.3 - i * 0.85, done: () => !D || !D.burning });
    }
  }

  // it goes up: in what brought it down
  carDeath(c) {
    const S = c.shotBy;
    const game = this.game;
    if (!S || game.time - S.t > 22) return;
    const x = c.pos.x;
    const z = c.pos.z;
    const gy = groundHeight(x, z);
    const fx = game.fx;
    this.stats.deaths++;
    if (PAINT_KINDS.has(S.kind)) {
      const cols = [];
      for (const q of S.cols) cols.push(q);
      while (cols.length < 5) cols.push(PAINTS[(cols.length * 3 + 1) % PAINTS.length]);
      // (a light of its colours, rings of them racing out over the road one after another)
      fx.sprite('glow', x, gy + 1.2, z, { size: 9, grow: 0.5, life: 0.2, tint: [1.15, 1.1, 0.9], alpha: 0.9 });
      cols.slice(0, 4).forEach((q, i) => fx.ring(x, gy + 0.2 + i * 0.02, z, 0.6 + i * 0.3, 5.5 + i * 1.6, 0.55 + i * 0.14, hdr(q, 1.3), 9 - i));
      cols.forEach((q, i) => fx.burst(x, gy + 1.1, z, 6, 13 + i * 2, hdr(q, 1.5), 1.2, 0.36));
      this.fireball(x, gy + 1.1, z, cols.concat([FIRE[0], FIRE[1]]), 1);
      // (fire in every colour of it, a while; smoke of them going up)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.6;
        const r = 1.2 + Math.random() * 2.1;
        const q = cols[i % cols.length];
        fx.burn(x + Math.cos(a) * r, gy + 0.2 + Math.random() * 0.3, z + Math.sin(a) * r, { life: 2.8 + Math.random() * 1.8, size: 0.6 + Math.random() * 0.5, tints: [q, cols[(i + 2) % cols.length], FIRE[0]] });
        fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + Math.cos(a) * r * 0.7, gy + 1.4 + Math.random(), z + Math.sin(a) * r * 0.7, { size: 2.2 + Math.random() * 1.2, grow: 1.4, life: 2.2 + Math.random() * 0.9, vx: Math.cos(a) * 0.9, vy: 1.9, vz: Math.sin(a) * 0.9, tint: hdr(q, 0.95), alpha: 0.78, fadeIn: 0.15 });
      }
      // (lumps of paint thrown far, each left where it falls; a rain of drops)
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 7.5;
        this.glob(x, gy + 1.1, z, Math.cos(a) * sp, 5.5 + Math.random() * 6, Math.sin(a) * sp, cols[i % cols.length], 0.6 + Math.random() * 0.8);
      }
      fx.spray(x, gy + 1.2, z, 0, 1, 0, 34, 9, cols, { cone: 1.3, wide: 4.5, len: 0.14, life: 1.2 });
      fx.decal('burst', x, gy + 0.18, z, 5.5, cols[0], 0.9, [1, 0, 0], [0, 0, -1]);
      fx.decal('burst', x + 0.5, gy + 0.19, z - 0.4, 3.6, cols[1], 0.9, [1, 0, 0], [0, 0, -1]);
      game.audio.play('splat', 1);
      return;
    }
    if (S.kind === 'tippex') {
      // (rubbed out in a white fire: white rings, the flakes of what it was going up)
      fx.sprite('glow', x, gy + 1.2, z, { size: 9, grow: 0.5, life: 0.2, tint: [1.15, 1.15, 1.15], alpha: 0.95 });
      fx.ring(x, gy + 0.2, z, 0.6, 6.5, 0.6, WHITE, 10);
      fx.ring(x, gy + 0.22, z, 0.3, 4.2, 0.8, [0.72, 0.86, 1.1], 5);
      this.fireball(x, gy + 1.1, z, WHITE_FIRE, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.6;
        const r = 1.2 + Math.random() * 2.0;
        fx.burn(x + Math.cos(a) * r, gy + 0.2 + Math.random() * 0.3, z + Math.sin(a) * r, { life: 2.6 + Math.random() * 1.6, size: 0.6 + Math.random() * 0.5, tints: WHITE_FIRE, core: WHITE_CORE, smoke: false });
      }
      fx.spray(x, gy + 1.2, z, 0, 1, 0, 30, 3.2, ASH, { cone: 1.4, flutter: true, len: 0.05, life: 2.6 });
      fx.spray(x, gy + 2.0, z, 0, 1, 0, 24, 5, ASH, { cone: 1.6, flutter: true, len: 0.06, life: 3.2 });
      fx.decal('burst', x, gy + 0.18, z, 6.5, WHITE, 0.95, [1, 0, 0], [0, 0, -1]);
      game.audio.play('splat', 0.8);
      return;
    }
    if (GRAPHITE_KINDS.has(S.kind)) {
      // (shot through: hot bits of it thrown up out of it, a scorch under it)
      this.fireball(x, gy + 1.1, z, HOT, 0.8);
      fx.spray(x, gy + 1.0, z, 0, 1, 0, 26, 12, HOT, { cone: 1.2, len: 0.2, life: 0.5, wide: 2.6 });
      fx.spray(x, gy + 1.0, z, 0, 1, 0, 12, 6, HOT.slice(1), { cone: 1.3, bits: true, len: 0.04, life: 1.3 });
      fx.decal('scorch', x, gy + 0.18, z, 5, [1, 1, 1], 0.8, [1, 0, 0], [0, 0, -1]);
    }
  }

  // the heart of it as it goes up: lights of its colours swelling one over another, tongues of fire thrown up out
  // of them (tints: hotter than the page's white; k: how big)
  fireball(x, y, z, tints, k) {
    const fx = this.game.fx;
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.3 * k;
      fx.sprite('glow', x + Math.cos(a) * r, y + Math.random() * 1.2 * k, z + Math.sin(a) * r, { size: (3.4 + Math.random() * 2.6) * k, grow: 0.9, life: 0.34 + Math.random() * 0.3, vy: 1.2, tint: tints[i % tints.length], alpha: 0.85, fadeIn: i * 0.03 });
    }
    // (dark smoke behind it: a colour is seen against what is darker than it)
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + Math.cos(a) * 1.2 * k, y + 0.6 + Math.random() * 1.4, z + Math.sin(a) * 1.2 * k, { size: (2.6 + Math.random() * 1.6) * k, grow: 1.3, life: 1.6 + Math.random() * 0.9, vx: Math.cos(a) * 0.7, vy: 2.2, vz: Math.sin(a) * 0.7, tint: [0.2, 0.19, 0.22], alpha: 0.8, fadeIn: 0.12 });
    }
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2 + Math.random() * 0.5;
      const r = (0.5 + Math.random() * 1.9) * k;
      fx.sprite(Math.random() < 0.6 ? 'flame0' : 'flame1', x + Math.cos(a) * r, y - 0.8 * k + Math.random() * 0.5, z + Math.sin(a) * r, { size: (1.1 + Math.random() * 1.3) * k, grow: 0.9, life: 0.32 + Math.random() * 0.4, vx: Math.cos(a) * 1.4, vy: 2.2 + Math.random() * 2.6, vz: Math.sin(a) * 1.4, tint: tints[(i * 2) % tints.length], alpha: 0.95, pivot: [0.5, 0.04], aspect: 0.55 + Math.random() * 0.25 });
    }
  }

  // a lump of paint thrown: where it falls, it stays
  glob(x, y, z, vx, vy, vz, color, size) {
    if (this.globs.length > 40) return;
    this.globs.push({ x, y, z, vx, vy, vz, color, size, t: 0, s: null });
  }

  // ------------------------------------------------------------------ a blast (a rocket, a bottle of ink): what it
  // leaves burning - white for an eraser's, the ink's own for a bottle's
  blast(pr, x, y, z, r) {
    const fx = this.game.fx;
    const gy = groundHeight(x, z);
    const white = pr.kind === 'eraser' || pr.kind === 'whiteShell';
    const n = Math.round(Math.min(7, 3 + r * 0.6));
    fx.sprite('glow', x, y + 0.6, z, { size: r * 2.2, grow: 0.5, life: 0.22, tint: white ? [1.15, 1.15, 1.15] : [1.1, 0.8, 0.35], alpha: 0.9 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.7;
      const d = r * (0.2 + Math.random() * 0.45);
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      fx.burn(px, groundHeight(px, pz) + 0.2, pz, { life: 1.8 + Math.random() * 1.8, size: 0.6 + Math.random() * 0.5, tints: white ? WHITE_FIRE : undefined, core: white ? WHITE_CORE : undefined, smoke: !white });
    }
    if (white) fx.spray(x, y + 0.6, z, 0, 1, 0, 22, r * 0.6, ASH, { cone: 1.4, flutter: true, len: 0.05, life: 2.6 });
    else fx.decal('scorch', x, gy + 0.175, z, r * 1.5, [1, 1, 1], 0.75, [1, 0, 0], [0, 0, -1]);
  }

  update(dt) {
    const G = this.globs;
    if (!G.length) return;
    const fx = this.game.fx;
    for (let i = G.length - 1; i >= 0; i--) {
      const g = G[i];
      g.t += dt;
      g.vy -= 15 * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
      const gy = groundHeight(g.x, g.z) + 0.17;
      if (g.y <= gy || g.t > 3) {
        fx.decal('burst', g.x, gy + 0.01 + Math.random() * 0.02, g.z, g.size * (1.3 + Math.random() * 0.8), g.color, 0.9, [1, 0, 0], [0, 0, -1]);
        fx.spray(g.x, gy + 0.05, g.z, 0, 1, 0, 3, 2.6, g.color, { cone: 1.2, wide: 3.5, len: 0.08, life: 0.4 });
        G.splice(i, 1);
        continue;
      }
      // (seen as it flies: a blot of its colour, a drop or two off it)
      fx.sprite('splat1', g.x, g.y, g.z, { size: g.size * 0.55, grow: 0, life: dt * 1.6, tint: g.color, alpha: 0.95 });
      if (Math.random() < 0.25 && fx.particles.length < 400) fx.particles.push({ x: g.x, y: g.y, z: g.z, vx: g.vx * 0.4, vy: g.vy * 0.4, vz: g.vz * 0.4, life: 0.3, t: 0, len: 0.07, color: g.color, seed: Math.random() * 50, spin: 0, streak: true, wide: 3.5, noGrav: false, drag: 0 });
    }
  }
}
