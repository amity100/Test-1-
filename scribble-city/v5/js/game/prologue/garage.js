import * as THREE from 'three';
import { linC } from '../items.js';
import { letter } from '../../world/letters.js';
import { randomCarSpec } from '../../render/cars.js';

// (prologue) The two car parks at the island's southern tip, out past 5th Street on the open
// ground by the water: South Pointe Garage, four decks tall (the roof at 9.9 m), where Danny's car
// is parked; and across the short street west of it, Pointe West Parking, a deck lower (its roof
// at 6.65 m) - the roof the car lands on.
//
// Each is the same plan: two aisles along its length (the north one and the south one, 8 m wide),
// the parking bays between them in the middle with the columns, a turn at each end; the decks
// joined by straight ramps up the aisles, a deck's ramp in the north aisle and the next deck's in the
// south, the way a car goes round and up. Over a ramp the deck above is open - a low wall round the
// opening - and a car on the deck below drives under the ramp's high end only (Garage.floorAt: the
// highest floor no more than a step above the car; the walls are the city's collision boxes, a
// deck's own height each). Drawn the way the city is drawn (game/items.js Kit, the city's pens):
// bare concrete, a painted band round each deck, the bays' lines, the lights under each deck, the
// stair tower, the name in lights; the cars parked in the bays are the city's own (drawn with them).

const CONC = linC(0.78, 0.76, 0.74);
const CONC_D = linC(0.58, 0.56, 0.56);
const DARK = linC(0.24, 0.23, 0.27);
const LINE = linC(0.96, 0.95, 0.9);
const YEL = linC(0.98, 0.82, 0.25);
const LAMP = linC(1, 0.93, 0.78);

const SLAB = 0.35;
const WALL = 1.0;

// a rotated box (along x, tilted up by `pitch` about z): a ramp's slab, its rail
function tiltedBox(w, h, d, x, y, z, pitch) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateZ(pitch);
  g.translate(x, y, z);
  return g;
}

export class Garage {
  // spec: { name, x0, x1, z0, z1, Y: [deck heights], ramps: [{ lv, aisle: 'N'|'S', xLow, xHigh }],
  // open: [{ lv, side: 'E'|'W', aisle }], band: colour, sign: { text, side } }
  constructor(spec) {
    this.s = spec;
    const { z0, z1 } = spec;
    // the aisles and the bays between them
    this.aN = [z0 + 2, z0 + 10];
    this.aS = [z1 - 10, z1 - 2];
    this.holes = [];
    for (const r of spec.ramps) {
      const a = r.aisle === 'N' ? this.aN : this.aS;
      this.holes.push({ lv: r.lv + 1, x0: Math.min(r.xLow, r.xHigh), x1: Math.max(r.xLow, r.xHigh), z0: a[0], z1: a[1], r });
    }
    // more floors laid on it later (the prologue's drawn ramp)
    this.extra = [];
    this.cols = [];
    // the cars parked in its bays (drawn as the city's own cars are: PrologueSet.drawCars)
    this.parked = [];
  }

  inside(x, z) {
    const s = this.s;
    return x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1;
  }

  // the floor under (x, z) for something at height y: the highest deck or ramp no more than a step
  // above it (a car on a deck drives under the one over it). -Infinity off it
  floorAt(x, z, y) {
    let best = -Infinity;
    const lim = y + 1.1;
    if (this.inside(x, z)) {
      const Y = this.s.Y;
      // (the street floor's own slab, a curb's height up)
      if (Y[0] <= lim) best = Y[0];
      for (let k = 1; k < Y.length; k++) {
        if (Y[k] > lim) break;
        let open = false;
        for (const h of this.holes) if (h.lv === k && x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1) open = true;
        if (!open && Y[k] > best) best = Y[k];
      }
      for (const r of this.s.ramps) {
        const a = r.aisle === 'N' ? this.aN : this.aS;
        if (z < a[0] || z > a[1]) continue;
        const t = (x - r.xLow) / (r.xHigh - r.xLow);
        if (t < 0 || t > 1) continue;
        const h = Y[r.lv] + (Y[r.lv + 1] - Y[r.lv]) * t;
        if (h <= lim && h > best) best = h;
      }
    }
    for (const e of this.extra) {
      const h = e.floorAt(x, z, y);
      if (h <= lim && h > best) best = h;
    }
    return best;
  }

  // ------------------------------------------------------------------ the building
  build(K, M, col) {
    const s = this.s;
    const { x0, x1, z0, z1, Y } = s;
    const top = Y[Y.length - 1];
    const wall = (ax0, az0, ax1, az1, ay0, ay1, tag = 'wall') => this.cols.push(col.addBox(ax0, az0, ax1, az1, ay0, ay1, tag));
    // ---- the decks: the ground floor's concrete, each deck's slab (open over its ramp)
    K.box(M.matte, x0, 0.02, z0, x1, Y[0] + 0.01, z1, CONC_D);
    for (let k = 1; k < Y.length; k++) {
      const y = Y[k];
      const holes = this.holes.filter((h) => h.lv === k);
      // (the slab in pieces round the opening)
      const xs = [x0, x1];
      for (const h of holes) xs.push(h.x0, h.x1);
      xs.sort((a, b) => a - b);
      const zs = [z0, z1];
      for (const h of holes) zs.push(h.z0, h.z1);
      zs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i++) {
        for (let j = 0; j + 1 < zs.length; j++) {
          const cx = (xs[i] + xs[i + 1]) / 2;
          const cz = (zs[j] + zs[j + 1]) / 2;
          if (xs[i + 1] - xs[i] < 0.01 || zs[j + 1] - zs[j] < 0.01) continue;
          if (holes.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1)) continue;
          K.box(M.matte, xs[i], y - SLAB, zs[j], xs[i + 1], y, zs[j + 1], k === Y.length - 1 ? CONC_D : CONC);
        }
      }
      // the band painted round the deck's edge, outside
      K.box(M.paint, x0 - 0.04, y - SLAB + 0.05, z0 - 0.04, x1 + 0.04, y - 0.1, z0 + 0.02, s.band);
      K.box(M.paint, x0 - 0.04, y - SLAB + 0.05, z1 - 0.02, x1 + 0.04, y - 0.1, z1 + 0.04, s.band);
      K.box(M.paint, x0 - 0.04, y - SLAB + 0.05, z0, x0 + 0.02, y - 0.1, z1, s.band);
      K.box(M.paint, x1 - 0.02, y - SLAB + 0.05, z0, x1 + 0.04, y - 0.1, z1, s.band);
      // the low wall round the opening (on the bays' side, and over the ramp's low end)
      for (const h of holes) {
        const r = h.r;
        const bz = r.aisle === 'N' ? h.z1 : h.z0;
        K.box(M.matte, h.x0, y, bz - 0.15, h.x1, y + WALL, bz + 0.15, CONC);
        wall(h.x0, bz - 0.15, h.x1, bz + 0.15, y - 0.3, y + WALL);
        const lowX = r.xLow;
        K.box(M.matte, lowX - 0.15, y, h.z0, lowX + 0.15, y + WALL, h.z1, CONC);
        wall(lowX - 0.15, h.z0, lowX + 0.15, h.z1, y - 0.3, y + WALL);
      }
    }
    // ---- the ramps: a tilted slab up the aisle, a low wall along its bays' side, the arrows
    for (const r of s.ramps) {
      const a = r.aisle === 'N' ? this.aN : this.aS;
      const yA = Y[r.lv];
      const yB = Y[r.lv + 1];
      const L = Math.abs(r.xHigh - r.xLow);
      const pitch = Math.atan2(yB - yA, r.xHigh - r.xLow);
      const len = Math.hypot(L, yB - yA);
      const cx = (r.xLow + r.xHigh) / 2;
      const cy = (yA + yB) / 2 - SLAB / 2;
      const cz = (a[0] + a[1]) / 2;
      K.add(M.matte, tiltedBox(len, SLAB, a[1] - a[0], cx, cy, cz, pitch), CONC);
      // its rail on the bays' side, and on the outside (the deck's own wall stops at the opening)
      const bz = r.aisle === 'N' ? a[1] : a[0];
      for (const zz of [bz]) K.add(M.matte, tiltedBox(len, WALL, 0.3, cx, cy + SLAB / 2 + WALL / 2, zz, pitch), CONC);
      // (collision: the rail in steps, each at its height)
      const n = 8;
      for (let i = 0; i < n; i++) {
        const xa = r.xLow + ((r.xHigh - r.xLow) * i) / n;
        const xb = r.xLow + ((r.xHigh - r.xLow) * (i + 1)) / n;
        const ya = yA + ((yB - yA) * i) / n;
        wall(Math.min(xa, xb), bz - 0.15, Math.max(xa, xb), bz + 0.15, ya - 0.2, ya + (yB - yA) / n + WALL);
      }
      // under it, solid (a wedge of concrete down to the deck below: no driving in under a ramp
      // the wrong way and coming up through it), in steps for the collision
      {
        const sh = new THREE.Shape();
        sh.moveTo(r.xLow, yA - 0.02);
        sh.lineTo(r.xHigh, yA - 0.02);
        sh.lineTo(r.xHigh, yB - SLAB);
        sh.lineTo(r.xLow, yA - 0.02);
        const g = new THREE.ExtrudeGeometry(sh, { depth: a[1] - a[0] - 0.1, bevelEnabled: false });
        g.translate(0, 0, a[0] + 0.05);
        K.add(M.matte, g, CONC_D);
        const m = 6;
        for (let i = 0; i < m; i++) {
          const xa = r.xLow + ((r.xHigh - r.xLow) * i) / m;
          const xb = r.xLow + ((r.xHigh - r.xLow) * (i + 1)) / m;
          const top = yA + ((yB - yA) * i) / m - SLAB;
          if (top - yA < 0.25) continue;
          wall(Math.min(xa, xb), a[0] + 0.05, Math.max(xa, xb), a[1] - 0.05, yA - 0.3, top);
        }
      }
      // arrows painted up it
      const dir = Math.sign(r.xHigh - r.xLow);
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        const ax = r.xLow + (r.xHigh - r.xLow) * t;
        const ay = yA + (yB - yA) * t + 0.03;
        K.add(M.paint, tiltedBox(1.6, 0.04, 0.3, ax, ay, cz, pitch), LINE);
        K.add(M.paint, tiltedBox(0.7, 0.04, 0.3, ax + dir * 0.55, ay + 0.02, cz - 0.35, pitch), LINE);
        K.add(M.paint, tiltedBox(0.7, 0.04, 0.3, ax + dir * 0.55, ay + 0.02, cz + 0.35, pitch), LINE);
      }
    }
    // ---- the walls round each deck (waist-high: the views over them), the openings
    for (let k = 0; k < Y.length; k++) {
      const y = Y[k];
      const opens = (s.open || []).filter((o) => o.lv === k);
      const gap = (side) => {
        const o = opens.find((q) => q.side === side);
        if (!o) return null;
        return o.aisle === 'N' ? this.aN : this.aS;
      };
      // north and south
      for (const [zz, nz] of [[z0, 1], [z1, -1]]) {
        K.box(M.matte, x0, y, zz - 0.15 * nz, x1, y + WALL, zz + 0.15 * nz, CONC);
        K.box(M.paint, x0, y + WALL - 0.22, zz - 0.17 * nz, x1, y + WALL - 0.08, zz + 0.17 * nz, s.band);
        wall(x0, Math.min(zz, zz + 0.3 * nz), x1, Math.max(zz, zz + 0.3 * nz), y - 0.3, y + WALL);
      }
      // west and east, open where the way out is
      for (const [xx, side] of [[x0, 'W'], [x1, 'E']]) {
        const g = gap(side);
        const parts = g ? [[z0, g[0]], [g[1], z1]] : [[z0, z1]];
        const nx = side === 'W' ? 1 : -1;
        for (const [za, zb] of parts) {
          if (zb - za < 0.05) continue;
          K.box(M.matte, xx - 0.15 * nx, y, za, xx + 0.15 * nx, y + WALL, zb, CONC);
          K.box(M.paint, xx - 0.17 * nx, y + WALL - 0.22, za, xx + 0.17 * nx, y + WALL - 0.08, zb, s.band);
          wall(Math.min(xx, xx + 0.3 * nx), za, Math.max(xx, xx + 0.3 * nx), zb, y - 0.3, y + WALL);
        }
      }
    }
    // ---- the columns: along the bays' edges, deck to deck (and the corners)
    const cx0 = x0 + 9;
    const cx1 = x1 - 9;
    const ncol = Math.max(2, Math.round((cx1 - cx0) / 9));
    for (let k = 0; k + 1 < Y.length; k++) {
      const ya = Y[k];
      const yb = Y[k + 1] - SLAB;
      for (let i = 0; i <= ncol; i++) {
        const x = cx0 + ((cx1 - cx0) * i) / ncol;
        for (const z of [this.aN[1], this.aS[0]]) {
          K.box(M.matte, x - 0.3, ya, z - 0.3, x + 0.3, yb, z + 0.3, CONC);
          K.box(M.paint, x - 0.32, ya, z - 0.32, x + 0.32, ya + 0.5, z + 0.32, YEL);
          wall(x - 0.3, z - 0.3, x + 0.3, z + 0.3, ya, yb, 'pole');
        }
      }
      // the lights under the deck over it, along each aisle
      for (const a of [this.aN, this.aS]) {
        const zc = (a[0] + a[1]) / 2;
        for (let x = x0 + 5; x < x1 - 3; x += 7) K.box(M.glow, x - 0.8, yb - 0.08, zc - 0.12, x + 0.8, yb, zc + 0.12, LAMP);
      }
    }
    // the lamp posts on the roof
    for (let x = x0 + 6; x < x1 - 4; x += 14) {
      for (const z of [this.aN[1] + 0.6, this.aS[0] - 0.6]) {
        K.box(M.metal, x - 0.08, top, z - 0.08, x + 0.08, top + 5, z + 0.08, DARK);
        K.box(M.glow, x - 0.35, top + 4.9, z - 0.2, x + 0.35, top + 5.05, z + 0.2, LAMP);
        wall(x - 0.12, z - 0.12, x + 0.12, z + 0.12, top, top + 5, 'pole');
      }
    }
    // ---- the bays: their lines, and cars parked in them (not on the turns, not where a ramp comes
    // up through the deck)
    const rng = mulberry(s.seed || 7);
    for (let k = 0; k < Y.length; k++) {
      const y = Y[k];
      for (let x = x0 + 9.4; x < x1 - 9.4; x += 2.8) {
        for (const [za, zb, face] of [[this.aN[1], this.aN[1] + 5.2, 1], [this.aS[0] - 5.2, this.aS[0], -1]]) {
          K.box(M.paint, x - 0.06, y + 0.01, za, x + 0.06, y + 0.03, zb, LINE);
          if (k === Y.length - 1 && rng() < 0.55) continue;
          if (rng() < 0.3) continue;
          if ((s.keepFree || []).some((f) => f.lv === k && x > f.x0 && x < f.x1)) continue;
          const cxx = x + 1.4;
          if (cxx > x1 - 9.4) continue;
          const czz = (za + zb) / 2 + face * 0.2;
          let spec = randomCarSpec(rng);
          for (let k = 0; k < 4 && (spec.taxi || spec.kind === 'van'); k++) spec = randomCarSpec(rng);
          if (spec.taxi) spec = { kind: 'sedan', color: [0.7, 0.72, 0.76] };
          // (nose in, towards the wall at the back of the bay)
          this.parked.push({ x: cxx, y, z: czz, yaw: face > 0 ? 0 : Math.PI, spec });
          wall(cxx - 0.95, czz - 2.2, cxx + 0.95, czz + 2.2, y, y + 1.4, 'prop');
        }
      }
    }
    // ---- the stair tower, the name in lights over the way in
    if (s.tower) {
      const t = s.tower;
      K.box(M.matte, t.x0, Y[0], t.z0, t.x1, top + 3.2, t.z1, CONC);
      K.box(M.paint, t.x0 - 0.05, top + 1.6, t.z0 - 0.05, t.x1 + 0.05, top + 3.0, t.z1 + 0.05, s.band);
      K.box(M.glass, t.x0 + 0.6, Y[0] + 0.4, t.z0 - 0.06, t.x1 - 0.6, top + 1.2, t.z0 + 0.02, linC(0.4, 0.55, 0.7));
      wall(t.x0, t.z0, t.x1, t.z1, Y[0], top + 3.2);
    }
    if (s.sign) {
      const g = s.sign;
      const h = 1.5;
      // (on the face over the way in: a backing board, the letters standing off it, lit)
      const y0 = Y[1] + 0.6;
      if (g.side === 'E' || g.side === 'W') {
        const xx = g.side === 'E' ? x1 + 0.2 : x0 - 0.2;
        const nx = g.side === 'E' ? 1 : -1;
        const len = letter(g.text, h, () => {});
        K.box(M.matte, xx - 0.05 * nx, y0 - 0.3, g.z - len / 2 - 0.6, xx + 0.05 * nx, y0 + h + 0.3, g.z + len / 2 + 0.6, DARK);
        letter(g.text, h, (a0, b0, a1, b1) => {
          K.box(M.glow, Math.min(xx + 0.06 * nx, xx + 0.16 * nx), y0 + b0, g.z - a1 * nx, Math.max(xx + 0.06 * nx, xx + 0.16 * nx), y0 + b1, g.z - a0 * nx, g.col);
        });
      } else {
        const zz = g.side === 'S' ? z1 + 0.2 : z0 - 0.2;
        const nz = g.side === 'S' ? 1 : -1;
        const len = letter(g.text, h, () => {});
        K.box(M.matte, g.x - len / 2 - 0.6, y0 - 0.3, zz - 0.05 * nz, g.x + len / 2 + 0.6, y0 + h + 0.3, zz + 0.05 * nz, DARK);
        letter(g.text, h, (a0, b0, a1, b1) => {
          K.box(M.glow, g.x + a0 * nz, y0 + b0, Math.min(zz + 0.06 * nz, zz + 0.16 * nz), g.x + a1 * nz, y0 + b1, Math.max(zz + 0.06 * nz, zz + 0.16 * nz), g.col);
        });
      }
    }
    // a big P on a post by the way in
    if (s.pSign) {
      const p = s.pSign;
      K.box(M.metal, p.x - 0.1, Y[0], p.z - 0.1, p.x + 0.1, Y[0] + 5.2, p.z + 0.1, DARK);
      K.box(M.paint, p.x - 0.12, Y[0] + 3.6, p.z - 0.9, p.x + 0.12, Y[0] + 5.4, p.z + 0.9, linC(0.12, 0.34, 0.78));
      letter('P', 1.3, (a0, b0, a1, b1) => K.box(M.glow, p.x + 0.13, Y[0] + 3.85 + b0, p.z - a1, p.x + 0.2, Y[0] + 3.85 + b1, p.z - a0, LINE));
    }
  }

  dispose(col) {
    for (const id of this.cols) col.remove(id);
    this.cols = [];
  }
}

// a little repeatable dice
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
