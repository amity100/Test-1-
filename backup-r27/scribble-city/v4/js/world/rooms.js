import * as THREE from 'three';
import { lin3 } from '../render/materials.js';
import { nextId, seeded, quadGeo } from './kit.js';
import { GOODS } from './paint.js';

// Rooms on the ground floors. Every shop has a real room behind its front: you walk in through
// the open door, see the shop through the window, and the keeper works behind the counter while
// customers browse. Rub a hole in a shop's front with the eraser (or blow one with the bazooka)
// and you can step in that way too.
//
// Everything here is placed in facade coordinates: u along the front (as seen from the street),
// y up, d outwards (negative is inside the building). The rooms are lit by their own lamps: warm,
// a little golden, the colour of the shop windows at dusk.

const T = 0.25; // wall thickness
const STYLE = { GLOW: 'glow' };

const C = {
  wood: [0.72, 0.52, 0.36],
  darkWood: [0.45, 0.32, 0.24],
  lightWood: [0.88, 0.74, 0.54],
  cream: [0.96, 0.92, 0.83],
  white: [0.96, 0.95, 0.92],
  steel: [0.74, 0.77, 0.82],
  dark: [0.26, 0.26, 0.3],
  black: [0.16, 0.16, 0.19],
  red: [0.86, 0.32, 0.3],
  green: [0.42, 0.68, 0.44],
  blue: [0.42, 0.56, 0.86],
  yellow: [0.97, 0.82, 0.32],
  pink: [0.95, 0.62, 0.72],
  orange: [0.96, 0.6, 0.3],
  teal: [0.32, 0.66, 0.68],
  purple: [0.64, 0.48, 0.8],
  brick: [0.78, 0.44, 0.34],
  mirror: [0.8, 0.86, 0.94],
  glass: [0.8, 0.88, 0.94],
};
const DECOR = {
  pizza: { wall: [0.97, 0.88, 0.68], band: [0.82, 0.32, 0.3], floor: 'checker', light: [1, 0.78, 0.5] },
  cafe: { wall: [0.86, 0.7, 0.56], band: [0.5, 0.34, 0.26], floor: 'wood', light: [1, 0.8, 0.55] },
  grocery: { wall: [0.88, 0.94, 0.84], band: [0.44, 0.66, 0.42], floor: 'tiles', light: [1, 0.92, 0.75] },
  deli: { wall: [0.96, 0.92, 0.84], band: [0.7, 0.3, 0.28], floor: 'checker', light: [1, 0.86, 0.62] },
  bagel: { wall: [0.95, 0.86, 0.7], band: [0.66, 0.46, 0.28], floor: 'wood', light: [1, 0.82, 0.55] },
  falafel: { wall: [0.96, 0.9, 0.7], band: [0.3, 0.55, 0.4], floor: 'tiles', light: [1, 0.86, 0.6] },
  sushi: { wall: [0.94, 0.9, 0.84], band: [0.25, 0.25, 0.3], floor: 'wood', light: [1, 0.88, 0.7] },
  icecream: { wall: [0.98, 0.86, 0.9], band: [0.55, 0.78, 0.86], floor: 'checker', light: [1, 0.9, 0.82] },
  books: { wall: [0.62, 0.46, 0.4], band: [0.36, 0.26, 0.22], floor: 'wood', light: [1, 0.78, 0.5] },
  flowers: { wall: [0.88, 0.95, 0.88], band: [0.56, 0.74, 0.5], floor: 'tiles', light: [1, 0.92, 0.78] },
  barber: { wall: [0.92, 0.94, 0.97], band: [0.3, 0.42, 0.7], floor: 'checker', light: [1, 0.92, 0.8] },
  hardware: { wall: [0.86, 0.86, 0.84], band: [0.86, 0.5, 0.22], floor: 'concrete', light: [1, 0.94, 0.82] },
  shop: { wall: [0.94, 0.9, 0.84], band: [0.4, 0.5, 0.8], floor: 'tiles', light: [1, 0.92, 0.78] },
  pharmacy: { wall: [0.96, 0.97, 0.96], band: [0.32, 0.66, 0.46], floor: 'tiles', light: [0.96, 1, 0.96] },
  laundry: { wall: [0.82, 0.9, 0.96], band: [0.4, 0.6, 0.85], floor: 'tiles', light: [0.96, 0.98, 1] },
  phones: { wall: [0.9, 0.9, 0.94], band: [0.3, 0.3, 0.36], floor: 'concrete', light: [0.96, 0.96, 1] },
  optics: { wall: [0.95, 0.94, 0.9], band: [0.5, 0.42, 0.62], floor: 'wood', light: [1, 0.95, 0.85] },
  gym: { wall: [0.82, 0.82, 0.86], band: [0.86, 0.3, 0.28], floor: 'mats', light: [0.96, 0.98, 1] },
  music: { wall: [0.36, 0.3, 0.4], band: [0.66, 0.36, 0.3], floor: 'wood', light: [1, 0.7, 0.45] },
  home: { wall: [0.94, 0.86, 0.74], band: [0.62, 0.5, 0.42], floor: 'wood', light: [1, 0.8, 0.55] },
  studio: { wall: [0.9, 0.9, 0.88], band: [0.5, 0.5, 0.56], floor: 'concrete', light: [1, 0.9, 0.75] },
  store: { wall: [0.78, 0.74, 0.68], band: [0.5, 0.44, 0.38], floor: 'concrete', light: [1, 0.86, 0.62] },
  lobby: { wall: [0.9, 0.88, 0.84], band: [0.34, 0.34, 0.4], floor: 'checker', light: [1, 0.94, 0.84] },
};

// a small seeded random for each room
class RNG {
  constructor(seed) {
    this.r = seeded(Math.max(1, Math.floor(seed) % 2147483646));
  }
  float(a = 0, b = 1) {
    return a + (b - a) * this.r();
  }
  int(a, b) {
    return Math.floor(this.float(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.r() * arr.length)];
  }
}

// what is on a shelf: a cell of the goods texture (see paint.js goodsTexture)
const PAL = { general: GOODS.general, books: GOODS.books, meds: GOODS.meds, tools: GOODS.tools, bread: GOODS.bread, fruit: GOODS.fruit, cups: GOODS.bottles, records: GOODS.records, bottles: GOODS.bottles, glasses: GOODS.meds };
const GOODS_LIST = [C.red, C.yellow, C.blue, C.green, C.orange, C.pink, C.purple, C.teal, C.white];
const L3 = (c) => lin3(c[0], c[1], c[2]);

// the newer shops of the bigger city
Object.assign(DECOR, {
  grocery: DECOR.grocery,
  tacos: { wall: [0.98, 0.84, 0.5], band: [0.86, 0.36, 0.3], floor: 'tiles', light: [1, 0.82, 0.55] },
  diner: { wall: [0.96, 0.94, 0.9], band: [0.86, 0.26, 0.3], floor: 'checker', light: [1, 0.9, 0.75] },
  juice: { wall: [0.88, 0.96, 0.8], band: [0.98, 0.62, 0.22], floor: 'tiles', light: [1, 0.95, 0.8] },
  surf: { wall: [0.78, 0.92, 0.96], band: [0.26, 0.56, 0.78], floor: 'wood', light: [1, 0.92, 0.78] },
  boutique: { wall: [0.98, 0.9, 0.94], band: [0.82, 0.5, 0.68], floor: 'wood', light: [1, 0.9, 0.82] },
  arcade: { wall: [0.3, 0.24, 0.42], band: [0.62, 0.3, 0.86], floor: 'carpet', light: [0.85, 0.7, 1] },
  bar: { wall: [0.42, 0.26, 0.44], band: [0.3, 0.18, 0.24], floor: 'wood', light: [1, 0.66, 0.6] },
  cinema: { wall: [0.62, 0.2, 0.26], band: [0.36, 0.12, 0.16], floor: 'carpet', light: [1, 0.8, 0.6] },
});

/**
 * One room behind facade f.
 * spec: { u0, u1, depth, y0, h, kind, openings: [{ kind: 'door'|'window', u0, u1, y0, y1 }], shop, outside }
 * Returns what the people of the street need to know about it (spots, the way round the furniture).
 */
export function buildRoom(ctx, f, spec) {
  const R = new Room(ctx, f, spec);
  R.shell();
  R.furnish();
  R.collide();
  return R.people;
}

class Room {
  constructor(ctx, f, spec) {
    this.ctx = ctx;
    this.M = ctx.M;
    this.f = f;
    this.spec = spec;
    this.kind = spec.kind;
    this.decor = DECOR[spec.kind] || DECOR.shop;
    this.ua = spec.u0 + T;
    this.ub = spec.u1 - T;
    this.da = -T;
    this.db = -spec.depth;
    this.y0 = spec.y0;
    this.y1 = spec.y0 + spec.h;
    this.rng = new RNG(Math.floor(Math.abs(f.ox * 13.1 + f.oz * 7.7 + spec.u0 * 3.3)) + 11);
    this.spots = { browse: [], seats: [], chairs: [] };
    this.solid = []; // furniture footprints (for the collision)
    this.openings = spec.openings || [];
    // the way in stays clear: nothing stands in the lane from the door into the room
    const door = this.openings.find((o) => o.kind === 'door');
    this.lane = door ? [door.u0 - 0.15, door.u1 + 0.15] : [this.ua, this.ua];
    this.past = Math.max(this.ua, this.lane[1]);
    // (lines drawn in the rooms of the old notebook: left out here)
    this.ch = { sl: { seg() {}, poly() {} } };
  }

  P(u, y, d) {
    return this.f.p(u, y, d);
  }

  // world (x, z) -> facade coordinates (u along the front, d outwards)
  toUD(x, z) {
    return [this.f.toU(x, z), this.f.toW(x, z)];
  }

  add(mat, geo, color) {
    this.ctx.R.add(mat, geo, null, nextId(), { color: color ? L3(color) : undefined });
  }

  // a quad given by four points, wound so that its front faces n
  quad(a, b, c, d, n, color, uvs, mat = null) {
    this.add(mat || this.M.inWall, this.f.facing(a, b, c, d, uvs || [[0, 0], [1, 0], [1, 1], [0, 1]], n), color);
  }

  // an axis-aligned box in facade coordinates
  box(u0, y0, d0, u1, y1, d1, color, o = {}) {
    const [mn, mx] = this.f.box(u0, y0, d0, u1, y1, d1);
    const g = new THREE.BoxGeometry(Math.max(1e-3, mx[0] - mn[0]), Math.max(1e-3, mx[1] - mn[1]), Math.max(1e-3, mx[2] - mn[2]));
    g.translate((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
    const glow = o.sideStyle === STYLE.GLOW;
    this.add(glow ? this.M.inLamp : o.gloss ? this.M.inGloss : this.M.inBox, g, color);
    if (o.solid) this.solid.push([Math.min(u0, u1), Math.min(d0, d1), Math.max(u0, u1), Math.max(d0, d1), y1]);
  }

  cyl(u, d, r, y0, h, color, n = 10) {
    const p = this.P(u, y0 + h / 2, d);
    const g = new THREE.CylinderGeometry(r, r, h, Math.max(6, n));
    g.translate(p[0], p[1], p[2]);
    this.add(this.M.inCyl, g, color);
  }

  disc(u, d, y, r, color, n = 10) {
    this.cyl(u, d, r, y, 0.025, color, n);
  }

  // a board on the back wall (menus, posters): a dark green chalk board in a wooden frame
  sign(u, y, w, h, rect, d = null) {
    const dd = (d !== null ? d : this.db) + 0.04;
    this.box(u - w / 2 - 0.05, y - h / 2 - 0.05, dd - 0.04, u + w / 2 + 0.05, y + h / 2 + 0.05, dd, C.darkWood);
    const col = rect && rect.startsWith('chalk') ? [0.18, 0.28, 0.24] : [0.95, 0.9, 0.8];
    const a = this.P(u - w / 2, y - h / 2, dd + 0.005);
    const b = this.P(u + w / 2, y - h / 2, dd + 0.005);
    const c = this.P(u + w / 2, y + h / 2, dd + 0.005);
    const e = this.P(u - w / 2, y + h / 2, dd + 0.005);
    this.quad(a, b, c, e, [this.f.nx, 0, this.f.nz], col, null, this.M.inBox);
    // a few lines of chalk
    for (let i = 0; i < 3; i++) {
      const yy = y + h * (0.25 - i * 0.22);
      this.box(u - w * 0.35, yy - 0.012, dd + 0.006, u + w * (0.15 + 0.15 * ((i * 7) % 3) / 2), yy + 0.012, dd + 0.012, i === 0 ? [0.98, 0.95, 0.85] : [0.98, 0.84, 0.42]);
    }
  }

  // a lamp hanging from the ceiling
  lamp(u, d, col = this.decor.light) {
    const y = this.y1 - 0.55;
    this.cyl(u, d, 0.012, y + 0.2, this.y1 - y - 0.2, C.black, 4);
    const p = this.P(u, y + 0.1, d);
    const g = new THREE.CylinderGeometry(0.12, 0.26, 0.24, 10);
    g.translate(p[0], p[1], p[2]);
    this.add(this.M.inLamp, g, col);
  }

  // the front of a shelf full of things: one quad from the goods texture
  goodsQuad(a, b, c, d, n, w, h, pal) {
    const cell = (pal || 0) * 64;
    const off = this.rng.float(0, 1);
    const uvs = [[off, cell], [off + w, cell], [off + w, cell + h], [off, cell + h]];
    this.add(this.M.goods, this.f.facing(a, b, c, d, uvs, n), null);
  }

  goodsFace(u0, u1, ya, yb, d, rowH, pal, facing = 1) {
    const n = [this.f.nx * facing, 0, this.f.nz * facing];
    const rows = Math.max(1, Math.round((yb - ya) / rowH));
    this.goodsQuad(this.P(u0, ya, d), this.P(u1, ya, d), this.P(u1, yb, d), this.P(u0, yb, d), n, Math.abs(u1 - u0) / 1.0, rows / 2, pal);
  }

  goodsSide(u, d0, d1, ya, yb, rowH, pal, facing = 1) {
    const n = [this.f.ux * facing, 0, this.f.uz * facing];
    const rows = Math.max(1, Math.round((yb - ya) / rowH));
    this.goodsQuad(this.P(u, ya, d0), this.P(u, ya, d1), this.P(u, yb, d1), this.P(u, yb, d0), n, Math.abs(d1 - d0) / 1.0, rows / 2, pal);
  }

  goodsTop(u0, u1, d0, d1, y, pal) {
    this.goodsQuad(this.P(u0, y, d0), this.P(u1, y, d0), this.P(u1, y, d1), this.P(u0, y, d1), [0, 1, 0], Math.abs(u1 - u0), Math.abs(d1 - d0) / 1.0, pal);
  }

  // shelves against a wall at d (the back) from u0 to u1: a wooden case full of things
  shelves(u0, u1, dBack, o = {}) {
    const depth = o.depth || 0.42;
    const h = o.h || 2.2;
    const rows = o.rows || 4;
    const d0 = dBack;
    const d1 = dBack + depth;
    const wood = o.wood || C.wood;
    this.box(u0, this.y0, d0, u1, this.y0 + h, d1, wood);
    this.solid.push([u0, d0, u1, d1, this.y0 + h]);
    this.goodsFace(u0 + 0.05, u1 - 0.05, this.y0 + 0.08, this.y0 + h - 0.06, d1 + 0.006, (h - 0.14) / rows, o.pal || 0, 1);
  }

  // the same against a side wall (the case faces along u, into the room)
  sideShelves(uWall, uIn, d0, d1, o = {}) {
    const h = o.h || 2.2;
    const rows = o.rows || 4;
    const wood = o.wood || C.wood;
    const ua = Math.min(uWall, uIn);
    const ub = Math.max(uWall, uIn);
    this.box(ua, this.y0, d0, ub, this.y0 + h, d1, wood);
    this.solid.push([ua, d0, ub, d1, this.y0 + h]);
    const facing = uIn > uWall ? 1 : -1;
    this.goodsSide(uIn + facing * 0.006, d0 + 0.05, d1 - 0.05, this.y0 + 0.08, this.y0 + h - 0.06, (h - 0.14) / rows, o.pal || 0, facing);
  }

  // a shop counter parallel to the front, from u0 to u1 at depth d (its front face)
  counter(u0, u1, d, o = {}) {
    const top = this.y0 + (o.h || 1.0);
    const deep = o.deep || 0.62;
    this.box(u0, this.y0, d - deep, u1, top - 0.05, d, o.front || C.darkWood, { solid: true });
    this.box(u0 - 0.05, top - 0.05, d - deep - 0.04, u1 + 0.05, top, d + 0.06, o.top || C.lightWood, { gloss: true });
    if (o.register !== false) {
      // the till
      const ru = u0 + 0.35;
      this.box(ru, top, d - 0.45, ru + 0.36, top + 0.22, d - 0.12, C.dark);
      this.box(ru + 0.04, top + 0.22, d - 0.4, ru + 0.32, top + 0.3, d - 0.3, C.steel);
    }
    return top;
  }

  table(u, d, o = {}) {
    const top = this.y0 + 0.74;
    const r = o.r || 0.36;
    if (o.round) {
      this.cyl(u, d, 0.05, this.y0, 0.72, C.dark, 6);
      this.cyl(u, d, r, top - 0.04, 0.04, o.color || C.white, 14);
    } else {
      this.box(u - 0.04, this.y0, d - 0.04, u + 0.04, top - 0.04, d + 0.04, C.dark);
      this.box(u - r, top - 0.04, d - r, u + r, top, d + r, o.color || C.lightWood);
    }
    this.solid.push([u - r, d - r, u + r, d + r, top]);
    const chairs = o.chairs || [[1, 0], [-1, 0]];
    for (const [cu, cd] of chairs) {
      const su = u + cu * (r + 0.32);
      const sd = d + cd * (r + 0.32);
      this.chair(su, sd, Math.atan2(-cu, -cd), o.chairColor);
      this.spots.seats.push({ u: su, d: sd, face: [-cu, -cd] });
    }
  }

  chair(u, d, ang, color = C.darkWood) {
    const s = 0.2;
    this.box(u - s, this.y0 + 0.42, d - s, u + s, this.y0 + 0.46, d + s, color);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box(u + a * (s - 0.03) - 0.02, this.y0, d + b * (s - 0.03) - 0.02, u + a * (s - 0.03) + 0.02, this.y0 + 0.42, d + b * (s - 0.03) + 0.02, color);
    // the back, on the side away from the table
    const bu = -Math.sin(ang);
    const bd = -Math.cos(ang);
    if (Math.abs(bu) > Math.abs(bd)) this.box(u + Math.sign(bu) * (s - 0.04) - 0.02, this.y0 + 0.46, d - s, u + Math.sign(bu) * (s - 0.04) + 0.02, this.y0 + 0.92, d + s, color);
    else this.box(u - s, this.y0 + 0.46, d + Math.sign(bd) * (s - 0.04) - 0.02, u + s, this.y0 + 0.92, d + Math.sign(bd) * (s - 0.04) + 0.02, color);
  }

  // ------------------------------------------------------------------ the room itself
  shell() {
    const { f, ua, ub, da, db, y0, y1 } = this;
    const dec = this.decor;
    const n = [f.nx, 0, f.nz];
    const r = [f.ux, 0, f.uz];
    const neg = (v) => [-v[0], -v[1], -v[2]];
    // the floor (boards, tiles, the checker of a diner), its pattern in world metres
    const fl = dec.floor;
    const fcol = fl === 'checker' ? [0.98, 0.97, 0.95] : fl === 'mats' ? [0.8, 0.8, 0.85] : fl === 'tiles' ? [0.98, 0.96, 0.92] : fl === 'wood' ? [0.98, 0.9, 0.82] : fl === 'carpet' ? [0.95, 0.9, 0.95] : [0.94, 0.94, 0.92];
    const fp = [this.P(ua, y0 + 0.004, db), this.P(ub, y0 + 0.004, db), this.P(ub, y0 + 0.004, da), this.P(ua, y0 + 0.004, da)];
    const fuv = fp.map((p) => [p[0] / 2, -p[2] / 2]);
    this.add(this.M.floors[fl] || this.M.floors.concrete, this.f.facing(fp[0], fp[1], fp[2], fp[3], fuv, [0, 1, 0]), fcol);
    // the ceiling
    this.quad(this.P(ua, y1, db), this.P(ub, y1, db), this.P(ub, y1, da), this.P(ua, y1, da), [0, -1, 0], [0.96, 0.93, 0.86]);
    // walls: a lower band and the wall above it
    const band = y0 + 0.95;
    const wall = (a0, a1, nn) => {
      this.quad([a0[0], y0, a0[2]], [a1[0], y0, a1[2]], [a1[0], band, a1[2]], [a0[0], band, a0[2]], nn, dec.band);
      this.quad([a0[0], band, a0[2]], [a1[0], band, a1[2]], [a1[0], y1, a1[2]], [a0[0], y1, a0[2]], nn, dec.wall);
    };
    wall(this.P(ua, y0, db), this.P(ub, y0, db), n); // back wall faces the front
    wall(this.P(ua, y0, da), this.P(ua, y0, db), r); // left wall faces right
    wall(this.P(ub, y0, db), this.P(ub, y0, da), neg(r)); // right wall
    // the front wall from inside, the door and the windows cut out of it
    const ops = this.openings.slice().sort((a, b) => a.u0 - b.u0);
    let u = ua;
    const piece = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      this.quad(this.P(a, ya, da), this.P(b, ya, da), this.P(b, yb, da), this.P(a, yb, da), neg(n), ya < band - 0.01 && yb <= band + 0.01 ? dec.band : dec.wall);
    };
    for (const o of ops) {
      piece(u, o.u0, y0, y1);
      piece(o.u0, o.u1, y0, o.y0);
      piece(o.u0, o.u1, o.y1, y1);
      u = o.u1;
      if (o.kind === 'door') {
        // the door stands open, flat against the wall inside
        const w = o.u1 - o.u0;
        this.box(o.u0 + 0.02, o.y0, da - w, o.u0 + 0.07, o.y1 - 0.06, da, o.color || [0.36, 0.3, 0.44]);
        this.box(o.u0 + 0.05, y0, da - 0.9, o.u1 - 0.05, y0 + 0.012, da, [0.62, 0.42, 0.3]);
      } else {
        // a sill inside
        this.box(o.u0 - 0.05, o.y0 - 0.06, da - 0.22, o.u1 + 0.05, o.y0, da + 0.02, C.lightWood);
      }
    }
    piece(u, ub, y0, y1);
  }

  // ------------------------------------------------------------------ what is in the room
  furnish() {
    const fn = FURNISH[this.kind] || FURNISH.shop;
    fn(this);
    // a lamp or two, always
    const n = this.ub - this.ua > 7 ? 3 : 2;
    for (let i = 0; i < n; i++) this.lamp(this.ua + ((i + 0.5) / n) * (this.ub - this.ua), (this.da + this.db) / 2);
    // the way in, just past the door, and where the keeper stands
    const door = this.openings.find((o) => o.kind === 'door');
    if (door) {
      const p = this.P((door.u0 + door.u1) / 2, this.y0, this.da - 0.9);
      this.spots.door = { x: p[0], z: p[2] };
    }
    const toWorld = (s) => {
      const p = this.P(s.u, this.y0, s.d);
      const fx = s.face ? this.f.ux * s.face[0] + this.f.nx * s.face[1] : this.f.nx;
      const fz = s.face ? this.f.uz * s.face[0] + this.f.nz * s.face[1] : this.f.nz;
      return { x: p[0], z: p[2], yaw: Math.atan2(fx, fz), lift: !!s.lift };
    };
    const out = {
      door: this.spots.door,
      keeper: this.spots.keeper ? toWorld(this.spots.keeper) : null,
      browse: this.spots.browse.map(toWorld),
      seats: this.spots.seats.map(toWorld),
      chairs: this.spots.chairs.map(toWorld),
      center: (() => {
        const p = this.P((this.ua + this.ub) / 2, this.y0, (this.da + this.db) / 2);
        return { x: p[0], z: p[2] };
      })(),
      floor: this.y0,
      height: this.y1 - this.y0,
      kind: this.kind,
      // the floor's corners: front left, front right, back right, back left
      corners: [[this.ua, this.da], [this.ub, this.da], [this.ub, this.db], [this.ua, this.db]].map(([u, d]) => {
        const p = this.P(u, this.y0, d);
        return { x: p[0], z: p[2] };
      }),
      path: (ax, az, bx, bz) => this.path(ax, az, bx, bz),
      inside: (x, z, pad = 0) => {
        const [u, d] = this.toUD(x, z);
        return u > this.ua - pad && u < this.ub + pad && d > this.db - pad && d < this.da + pad;
      },
    };
    this.people = out;
    if (this.spec.shop) this.spec.shop.room = out;
  }

  // ------------------------------------------------------------------ walls you bump into
  collide() {
    const { f, spec, ua, ub, db, y0, y1 } = this;
    const col = this.ctx.col;
    const add = (u0, d0, u1, d1, ya, yb, tag = 'wall') => {
      if (Math.abs(u1 - u0) < 1e-3 || Math.abs(d1 - d0) < 1e-3) return;
      const [mn, mx] = f.box(u0, ya, d0, u1, yb, d1);
      col.addBox(mn[0], mn[2], mx[0], mx[2], ya, yb, tag);
    };
    // the room's own walls (the building round it does the rest)
    add(spec.u0, db - T, spec.u1, db, y0, y1);
    add(spec.u0, db, ua, -T, y0, y1);
    add(ub, db, spec.u1, -T, y0, y1);
    for (const [a, b, c, d, yt] of this.solid) add(a, b, c, d, y0, yt, 'furniture');
  }
}

// ------------------------------------------------------------------ the way round the furniture
const G = 0.25; // walk grid cell (metres)
const BODY = 0.3; // how far a person keeps from walls and furniture

Room.prototype.grid = function grid() {
  if (this._grid) return this._grid;
  const nu = Math.max(1, Math.ceil((this.ub - this.ua) / G));
  const nd = Math.max(1, Math.ceil((this.da - this.db) / G));
  const free = new Uint8Array(nu * nd);
  const solid = this.solid.map(([a, b, c, d]) => [Math.min(a, c) - BODY, Math.min(b, d) - BODY, Math.max(a, c) + BODY, Math.max(b, d) + BODY]);
  for (let j = 0; j < nd; j++) {
    const d = this.db + (j + 0.5) * G;
    for (let i = 0; i < nu; i++) {
      const u = this.ua + (i + 0.5) * G;
      let ok = u > this.ua + BODY && u < this.ub - BODY && d > this.db + BODY && d < this.da - BODY;
      for (let k = 0; ok && k < solid.length; k++) {
        const s = solid[k];
        if (u > s[0] && u < s[2] && d > s[1] && d < s[3]) ok = false;
      }
      free[j * nu + i] = ok ? 1 : 0;
    }
  }
  this._grid = { nu, nd, free };
  return this._grid;
};

// A* over the walk grid, then pulled tight; world points, ending at (bx, bz)
Room.prototype.path = function path(ax, az, bx, bz) {
  const { nu, nd, free } = this.grid();
  const ok = (i, j) => i >= 0 && j >= 0 && i < nu && j < nd && free[j * nu + i] === 1;
  const cellOf = (x, z) => {
    const [u, d] = this.toUD(x, z);
    return [Math.floor((u - this.ua) / G), Math.floor((d - this.db) / G)];
  };
  const nearest = ([i, j]) => {
    if (ok(i, j)) return [i, j];
    for (let r = 1; r < 10; r++) {
      let best = null;
      let bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !ok(i + di, j + dj)) continue;
          const dd = di * di + dj * dj;
          if (dd < bd) {
            bd = dd;
            best = [i + di, j + dj];
          }
        }
      }
      if (best) return best;
    }
    return null;
  };
  const toWorld = (i, j) => {
    const p = this.P(this.ua + (i + 0.5) * G, 0, this.db + (j + 0.5) * G);
    return { x: p[0], z: p[2] };
  };
  const goalCell = cellOf(bx, bz);
  const s = nearest(cellOf(ax, az));
  const t = nearest(goalCell);
  if (!s || !t) return [{ x: bx, z: bz }];
  const N = nu * nd;
  const si = s[1] * nu + s[0];
  const ti = t[1] * nu + t[0];
  const gs = new Float32Array(N).fill(Infinity);
  const fs = new Float32Array(N);
  const from = new Int32Array(N).fill(-1);
  const shut = new Uint8Array(N);
  const heap = [];
  const h = (k) => {
    const dx = Math.abs((k % nu) - t[0]);
    const dy = Math.abs(Math.floor(k / nu) - t[1]);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const push = (k) => {
    heap.push(k);
    let c = heap.length - 1;
    while (c > 0) {
      const pa = (c - 1) >> 1;
      if (fs[heap[pa]] <= fs[heap[c]]) break;
      [heap[pa], heap[c]] = [heap[c], heap[pa]];
      c = pa;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && fs[heap[l]] < fs[heap[m]]) m = l;
        if (r < heap.length && fs[heap[r]] < fs[heap[m]]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  gs[si] = 0;
  fs[si] = h(si);
  push(si);
  let found = si === ti;
  while (heap.length && !found) {
    const k = pop();
    if (shut[k]) continue;
    shut[k] = 1;
    if (k === ti) {
      found = true;
      break;
    }
    const ki = k % nu;
    const kj = Math.floor(k / nu);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ki + di;
        const nj = kj + dj;
        if (!ok(ni, nj)) continue;
        // no cutting corners past furniture
        if (di && dj && (!ok(ki + di, kj) || !ok(ki, kj + dj))) continue;
        const nk = nj * nu + ni;
        const g = gs[k] + (di && dj ? 1.414 : 1);
        if (g < gs[nk]) {
          gs[nk] = g;
          fs[nk] = g + h(nk);
          from[nk] = k;
          push(nk);
        }
      }
    }
  }
  if (!found) return [{ x: bx, z: bz }];
  const cells = [];
  for (let k = ti; k >= 0; k = from[k]) {
    cells.push([k % nu, Math.floor(k / nu)]);
    if (k === si) break;
  }
  cells.reverse();
  // pull the string tight: skip every corner that can be cut in a straight line
  const clear = (a, b) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let q = 1; q < n; q++) {
      const i = Math.floor(a[0] + 0.5 + ((b[0] - a[0]) * q) / n);
      const j = Math.floor(a[1] + 0.5 + ((b[1] - a[1]) * q) / n);
      if (!ok(i, j)) return false;
    }
    return true;
  };
  const out = [];
  let k = 0;
  while (k < cells.length - 1) {
    let m = cells.length - 1;
    while (m > k + 1 && !clear(cells[k], cells[m])) m--;
    out.push(toWorld(cells[m][0], cells[m][1]));
    k = m;
  }
  // the goal itself if it is where a person can stand
  if (t[0] === goalCell[0] && t[1] === goalCell[1]) {
    if (out.length) out[out.length - 1] = { x: bx, z: bz };
    else out.push({ x: bx, z: bz });
  } else if (!out.length) out.push(toWorld(t[0], t[1]));
  return out;
};

const FURNISH = {
  pizza(R) {
    const { ua, ub, db, y0 } = R;
    // the oven: a brick dome in the back corner, its mouth glowing
    const ou = ub - 1.4;
    R.box(ou - 1.0, y0, db, ou + 1.0, y0 + 1.0, db + 1.4, C.brick, { solid: true });
    R.box(ou - 0.9, y0 + 1.0, db + 0.1, ou + 0.9, y0 + 1.9, db + 1.3, C.brick);
    R.box(ou - 0.38, y0 + 1.1, db + 1.3, ou + 0.38, y0 + 1.5, db + 1.42, [1, 0.62, 0.25], { sideStyle: STYLE.GLOW });
    // the counter with pizzas in a glass case
    const top = R.counter(ua + 0.5, ou - 1.3, db + 2.1);
    for (let i = 0; i < 3; i++) R.disc(ua + 1.0 + i * 0.7, db + 1.8, top + 0.02, 0.28, i % 2 ? C.yellow : C.orange, 12);
    R.spots.keeper = { u: (ua + ou) / 2 - 0.8, d: db + 1.0 };
    R.spots.browse.push({ u: ua + 1.0, d: db + 2.8, face: [0, -1] }, { u: ua + 1.9, d: db + 2.9, face: [0, -1] });
    R.sign((ua + ou) / 2 - 0.6, y0 + 2.35, 1.1, 1.1, 'chalk_slice');
    if (R.da - R.db > 4.8 && ub - 1.3 - 0.7 > R.past) R.table(ub - 1.3, R.da - 1.2, { chairs: [[-1, 0], [0, -1]] });
  },
  cafe(R) {
    const { ua, ub, db, da, y0 } = R;
    const top = R.counter(ub - 4.2, ub - 0.4, db + 1.8);
    // the espresso machine, cups stacked on it
    R.box(ub - 1.5, top, db + 1.25, ub - 0.7, top + 0.45, db + 1.7, C.steel);
    for (let i = 0; i < 3; i++) R.cyl(ub - 1.38 + i * 0.25, db + 1.47, 0.05, top + 0.45, 0.08, C.white, 8);
    // the pastry case
    R.box(ub - 3.9, top, db + 1.2, ub - 2.3, top + 0.3, db + 1.75, [0.85, 0.92, 0.96]);
    for (let i = 0; i < 5; i++) R.box(ub - 3.8 + i * 0.3, top + 0.05, db + 1.35, ub - 3.62 + i * 0.3, top + 0.14, db + 1.55, i % 2 ? C.orange : C.yellow);
    R.spots.keeper = { u: ub - 2.2, d: db + 0.9 };
    R.spots.browse.push({ u: ub - 2.8, d: db + 2.5, face: [0, -1] });
    R.shelves(ub - 4.2, ub - 0.4, db, { h: 1.6, rows: 3, pal: PAL.cups });
    R.sign(ub - 2.2, y0 + 2.45, 1.0, 1.0, 'chalk_coffee');
    const t0 = R.past + 0.95;
    const n = Math.min(3, Math.floor((ub - 0.85 - t0) / 1.6) + 1);
    for (let i = 0; i < n; i++) R.table(t0 + i * 1.6, da - 1.1 - (i % 2 && da - db > 6.2 ? 1.5 : 0), { round: true, r: 0.32, chairs: [[1, 0], [-1, 0]] });
  },
  grocery(R) {
    const { ua, ub, db, da, y0 } = R;
    R.shelves(ua + 0.2, ub - 0.2, db, { h: 2.1, rows: 4 });
    // an aisle down the middle
    const mid = (db + da) / 2;
    if (ub - ua > 4) {
      R.box(ua + 1.4, y0, mid - 0.3, ub - 2.2, y0 + 1.3, mid + 0.3, C.wood, { solid: true });
      R.goodsFace(ua + 1.45, ub - 2.25, y0 + 0.1, y0 + 1.25, mid + 0.306, 0.38, PAL.general, 1);
      R.goodsFace(ua + 1.45, ub - 2.25, y0 + 0.1, y0 + 1.25, mid - 0.306, 0.38, PAL.general, -1);
      R.spots.browse.push({ u: ua + 2.0, d: mid + 0.8, face: [0, -1] }, { u: ub - 3.0, d: mid - 0.8, face: [0, 1] });
    }
    // fruit crates by the window
    for (let i = 0; i < 3; i++) {
      const u = R.past + 0.45 + i * 0.75;
      if (u + 0.3 > ub - 2.1) break;
      R.box(u - 0.3, y0, da - 1.1, u + 0.3, y0 + 0.5, da - 0.6, C.lightWood, { solid: true });
      R.goodsTop(u - 0.27, u + 0.27, da - 1.05, da - 0.65, y0 + 0.506, PAL.fruit);
    }
    const top = R.counter(ub - 2.0, ub - 0.3, da - 1.1, { deep: 0.55 });
    void top;
    R.spots.keeper = { u: ub - 1.1, d: da - 2.05, face: [0, 1] };
    R.spots.browse.push({ u: ub - 2.6, d: db + 0.9, face: [0, -1] });
  },
  deli(R) {
    FURNISH.grocery(R);
    R.sign((R.ua + R.ub) / 2, R.y0 + 2.5, 1.0, 1.0, 'chalk_fresh');
  },
  bagel(R) {
    const { ua, ub, db, y0 } = R;
    const top = R.counter(ua + 0.5, ub - 1.2, db + 1.9);
    for (let i = 0; i < 6; i++) R.cyl(ua + 0.8 + i * 0.4, db + 1.6, 0.12, top, 0.06, [0.86, 0.64, 0.34], 10);
    R.shelves(ua + 0.4, ub - 1.2, db, { h: 1.9, rows: 3, pal: PAL.bread });
    R.spots.keeper = { u: (ua + ub) / 2 - 0.4, d: db + 0.95 };
    R.spots.browse.push({ u: ua + 1.4, d: db + 2.7, face: [0, -1] }, { u: ua + 2.4, d: db + 2.8, face: [0, -1] });
    R.sign(ub - 0.7, y0 + 1.9, 0.9, 0.9, 'chalk_fresh', db);
  },
  falafel(R) {
    FURNISH.bagel(R);
  },
  sushi(R) {
    const { ua, ub, db, da, y0 } = R;
    // a long bar with stools, the chef behind it
    const top = R.counter(ua + 0.4, ub - 0.6, db + 1.8, { front: [0.62, 0.44, 0.3], top: [0.9, 0.78, 0.6], register: false });
    for (let i = 0; i < 5; i++) R.box(ua + 0.8 + i * 0.6, top, db + 1.35, ua + 1.1 + i * 0.6, top + 0.05, db + 1.6, i % 2 ? [0.95, 0.5, 0.4] : C.white);
    for (let i = 0; i < Math.floor((ub - ua - 1.2) / 0.9); i++) {
      const u = ua + 0.9 + i * 0.9;
      R.cyl(u, db + 2.25, 0.18, y0 + 0.66, 0.06, C.darkWood, 10);
      R.cyl(u, db + 2.25, 0.04, y0, 0.66, C.dark, 6);
      if (i < 2) R.spots.seats.push({ u, d: db + 2.25, face: [0, -1] });
    }
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 0.95 };
    R.sign((ua + ub) / 2, y0 + 2.4, 1.0, 1.0, 'chalk_welcome');
    void da;
  },
  icecream(R) {
    const { ua, ub, db, da, y0 } = R;
    const top = R.counter(ua + 0.5, ub - 0.8, db + 1.9, { front: [0.95, 0.75, 0.82], top: C.white });
    // tubs of every colour under the glass
    const tubs = [[0.98, 0.72, 0.8], [0.6, 0.4, 0.25], [0.98, 0.95, 0.85], [0.6, 0.85, 0.55], [0.98, 0.8, 0.4], [0.7, 0.6, 0.9]];
    for (let i = 0; i < Math.min(6, Math.floor((ub - ua - 1.6) / 0.4)); i++) R.box(ua + 0.8 + i * 0.4, top - 0.02, db + 1.45, ua + 1.12 + i * 0.4, top + 0.06, db + 1.75, tubs[i % tubs.length]);
    R.box(ua + 0.6, top + 0.06, db + 1.4, ub - 0.9, top + 0.35, db + 1.8, [0.85, 0.92, 0.96]);
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 1.0 };
    R.spots.browse.push({ u: ua + 1.4, d: db + 2.7, face: [0, -1] }, { u: ua + 2.5, d: db + 2.8, face: [0, -1] });
    R.sign((ua + ub) / 2, y0 + 2.4, 1.0, 1.0, 'chalk_icecream');
    if (da - db > 4.8) R.table(ub - 1.4, da - 1.2, { round: true, r: 0.3, color: C.pink, chairs: [[-1, 0], [0, -1]] });
  },
  books(R) {
    const { ua, ub, db, da, y0 } = R;
    const books = { pal: PAL.books, wood: C.darkWood, rows: 5 };
    R.shelves(ua + 0.15, ub - 0.15, db, { ...books, h: 2.5 });
    R.sideShelves(ua, ua + 0.42, db + 0.6, da - 0.7, { ...books, h: 2.3 });
    if (ub - ua > 5) R.sideShelves(ub, ub - 0.42, db + 0.6, da - 0.7, { ...books, h: 2.3 });
    // a table of new books and an armchair for reading
    const tu = (ua + ub) / 2;
    const td = (db + da) / 2;
    R.box(tu - 0.8, y0, td - 0.45, tu + 0.8, y0 + 0.78, td + 0.45, C.darkWood, { solid: true });
    R.goodsTop(tu - 0.75, tu + 0.75, td - 0.4, td + 0.4, y0 + 0.786, PAL.books);
    const au = R.past + 0.4;
    R.box(au, y0, da - 1.8, au + 0.8, y0 + 0.45, da - 1.0, [0.65, 0.28, 0.25], { solid: true });
    R.box(au, y0 + 0.45, da - 1.8, au + 0.8, y0 + 1.05, da - 1.6, [0.65, 0.28, 0.25]);
    R.spots.seats.push({ u: au + 0.4, d: da - 1.3, face: [0, 1] });
    R.spots.keeper = { u: tu + 1.2, d: td, face: [-1, 0] };
    R.spots.browse.push({ u: tu, d: db + 1.0, face: [0, -1] }, { u: ua + 1.0, d: td, face: [-1, 0] }, { u: tu - 1.0, d: td + 0.9, face: [0, -1] });
  },
  flowers(R) {
    const { ua, ub, db, da, y0 } = R;
    const cols = [[0.92, 0.3, 0.45], [0.98, 0.8, 0.25], [0.75, 0.45, 0.85], [0.98, 0.6, 0.72], [0.98, 0.97, 0.92], [0.95, 0.45, 0.25]];
    // tiers of buckets along the back wall
    for (let t = 0; t < 3; t++) {
      const y = y0 + t * 0.4;
      R.box(ua + 0.3, y0, db + t * 0.0, ub - 0.3, y + 0.4, db + 0.5 + (2 - t) * 0.45, C.lightWood, { solid: t === 0 });
      for (let u = ua + 0.6; u < ub - 0.5; u += 0.55) {
        const d = db + 0.25 + (2 - t) * 0.45;
        R.cyl(u, d, 0.15, y + 0.4, 0.3, C.steel, 8);
        const c = R.rng.pick(cols);
        for (let k = 0; k < 4; k++) R.box(u - 0.12 + (k % 2) * 0.12, y + 0.72 + (k >> 1) * 0.1, d - 0.12 + (k >> 1) * 0.1, u + (k % 2) * 0.12, y + 0.82 + (k >> 1) * 0.1, d + (k >> 1) * 0.1, c);
      }
    }
    const top = R.counter(ub - 2.2, ub - 0.4, da - 1.2, { deep: 0.55 });
    R.goodsTop(ub - 2.1, ub - 1.2, da - 1.65, da - 1.25, top + 0.006, PAL.fruit);
    R.spots.keeper = { u: ub - 1.3, d: da - 2.15, face: [0, 1] };
    R.spots.browse.push({ u: ua + 1.4, d: db + 2.3, face: [0, -1] }, { u: (ua + ub) / 2, d: db + 2.4, face: [0, -1] });
  },
  barber(R) {
    const { ua, ub, db, da, y0 } = R;
    // two chairs before a long mirror on the side wall, a bench to wait on by the window
    const mu = ub - 0.04;
    R.box(mu - 0.03, y0 + 1.0, db + 0.6, mu, y0 + 2.2, da - 1.0, C.mirror);
    R.box(mu - 0.4, y0 + 0.85, db + 0.6, mu, y0 + 0.92, da - 1.0, C.white);
    for (let i = 0; i < 2; i++) {
      const d = db + 1.4 + i * 1.8;
      if (d > da - 1.4) break;
      const u = ub - 1.2;
      // the barber's chair: a red seat on a chrome post, a footrest, a headrest
      R.cyl(u, d, 0.22, y0, 0.08, C.steel, 10);
      R.cyl(u, d, 0.05, y0 + 0.08, 0.4, C.steel, 6);
      R.box(u - 0.28, y0 + 0.48, d - 0.28, u + 0.28, y0 + 0.62, d + 0.28, [0.75, 0.15, 0.18]);
      R.box(u - 0.3, y0 + 0.62, d - 0.28, u - 0.2, y0 + 1.32, d + 0.28, [0.75, 0.15, 0.18]);
      R.box(u + 0.3, y0 + 0.2, d - 0.2, u + 0.55, y0 + 0.24, d + 0.2, C.steel);
      R.solid.push([u - 0.32, d - 0.32, u + 0.32, d + 0.32, y0 + 0.62]);
      R.spots.chairs.push({ u, d, face: [1, 0] });
    }
    // the bench and a little table of magazines
    const b0 = R.past + 0.3;
    const b1 = Math.min(b0 + 2.0, ub - 0.4);
    R.box(b0, y0 + 0.42, da - 1.0, b1, y0 + 0.5, da - 0.55, C.darkWood, { solid: true });
    R.box(b0, y0, da - 0.98, b0 + 0.06, y0 + 0.42, da - 0.57, C.darkWood);
    R.box(b1 - 0.06, y0, da - 0.98, b1, y0 + 0.42, da - 0.57, C.darkWood);
    R.spots.seats.push({ u: b0 + 0.5, d: da - 0.78, face: [0, -1] }, { u: b1 - 0.5, d: da - 0.78, face: [0, -1] });
    // a shelf of tonics and a towel stack
    R.shelves(ua + 0.4, ua + 2.4, db, { h: 1.8, rows: 3, pal: PAL.bottles });
    R.spots.keeper = { u: ub - 1.9, d: db + 1.4, face: [1, 0] };
  },
  hardware(R) {
    const { ua, ub, db, da, y0 } = R;
    const tools = { pal: PAL.tools };
    R.shelves(ua + 0.2, ub - 0.2, db, { ...tools, h: 2.4, rows: 5 });
    // aisles
    const n = Math.max(1, Math.floor((ub - ua - 2.4) / 2.0));
    for (let i = 0; i < n; i++) {
      const u = ua + 1.3 + i * 2.0;
      R.sideShelves(u, u + 0.6, db + 1.2, da - 2.0, { ...tools, h: 1.8, rows: 3 });
      R.spots.browse.push({ u: u + 1.0, d: (db + da) / 2, face: [-1, 0] });
    }
    R.counter(ub - 2.0, ub - 0.3, da - 1.0, { deep: 0.55 });
    R.spots.keeper = { u: ub - 1.1, d: da - 1.95, face: [0, 1] };
  },
  shop(R) {
    FURNISH.hardware(R);
    R.sign((R.ua + R.ub) / 2, R.y0 + 2.6, 0.9, 0.9, 'chalk_sale', R.db + 0.45);
  },
  pharmacy(R) {
    const { ua, ub, db, da, y0 } = R;
    const meds = { pal: PAL.meds };
    R.shelves(ua + 0.2, ub - 0.2, db, { ...meds, h: 2.3, rows: 5, wood: C.white });
    R.sideShelves(ua, ua + 0.4, db + 0.6, da - 0.8, { ...meds, h: 2.0, rows: 4, wood: C.white });
    R.counter(ua + 1.2, ub - 0.8, db + 2.0, { front: C.white, top: [0.4, 0.75, 0.55] });
    // the green cross
    R.box((ua + ub) / 2 - 0.3, y0 + 2.45, db + 0.45, (ua + ub) / 2 + 0.3, y0 + 2.6, db + 0.5, [0.3, 0.8, 0.45], { sideStyle: STYLE.GLOW });
    R.box((ua + ub) / 2 - 0.08, y0 + 2.22, db + 0.45, (ua + ub) / 2 + 0.08, y0 + 2.83, db + 0.5, [0.3, 0.8, 0.45], { sideStyle: STYLE.GLOW });
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 1.1 };
    R.spots.browse.push({ u: ua + 1.0, d: (db + da) / 2, face: [-1, 0] }, { u: (ua + ub) / 2, d: db + 2.8, face: [0, -1] });
  },
  laundry(R) {
    const { ua, ub, db, da, y0 } = R;
    // a row of washing machines along the back, dryers stacked by the side
    for (let u = ua + 0.3; u < ub - 0.9; u += 0.8) {
      R.box(u, y0, db, u + 0.72, y0 + 0.9, db + 0.7, C.white, { solid: true });
      R.cyl(u + 0.36, db + 0.71, 0.24, y0 + 0.2, 0.02, [0.3, 0.4, 0.55], 12);
      R.box(u + 0.12, y0 + 0.22, db + 0.7, u + 0.6, y0 + 0.7, db + 0.73, [0.55, 0.68, 0.86], { gloss: true });
    }
    const lt = R.past + 0.4;
    R.box(lt, y0, da - 2.2, lt + 1.6, y0 + 0.85, da - 1.5, C.lightWood, { solid: true });
    R.goodsTop(lt + 0.05, lt + 1.55, da - 2.15, da - 1.55, y0 + 0.856, PAL.meds);
    R.spots.keeper = { u: lt + 0.8, d: da - 2.7, face: [0, 1] };
    R.spots.browse.push({ u: ua + 1.0, d: db + 1.3, face: [0, -1] }, { u: ua + 2.6, d: db + 1.3, face: [0, -1] });
  },
  phones(R) {
    const { ua, ub, db, da, y0 } = R;
    for (let i = 0; i < 2; i++) {
      const u = ua + 1.3 + i * 2.0;
      if (u > ub - 1.0) break;
      R.box(u - 0.6, y0, (db + da) / 2 - 0.4, u + 0.6, y0 + 0.9, (db + da) / 2 + 0.4, C.white, { solid: true });
      R.goodsTop(u - 0.5, u + 0.5, (db + da) / 2 - 0.25, (db + da) / 2 + 0.25, y0 + 0.906, PAL.glasses);
      R.spots.browse.push({ u, d: (db + da) / 2 + 0.8, face: [0, -1] });
    }
    R.counter(ua + 0.6, ub - 0.6, db + 1.5, { front: C.dark, top: C.white });
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 0.45 };
    R.sign((ua + ub) / 2, y0 + 2.3, 0.9, 0.9, 'chalk_sale');
  },
  optics(R) {
    const { ua, ub, db, da, y0 } = R;
    R.shelves(ua + 0.3, ub - 0.3, db, { h: 2.2, rows: 6, pal: PAL.glasses, wood: C.white });
    R.box(ua + 0.04, y0 + 0.9, db + 1.0, ua + 0.07, y0 + 2.1, da - 1.2, C.mirror);
    R.counter(ub - 2.4, ub - 0.4, da - 1.3, { front: C.white });
    R.spots.keeper = { u: ub - 1.4, d: da - 2.3, face: [0, 1] };
    R.spots.browse.push({ u: (ua + ub) / 2, d: db + 1.0, face: [0, -1] }, { u: ua + 0.8, d: (db + da) / 2, face: [-1, 0] });
  },
  gym(R) {
    const { ua, ub, db, da, y0 } = R;
    // a mirror wall, a weight bench, a rack of dumbbells, a treadmill
    R.box(ua + 0.3, y0 + 0.5, db + 0.01, ub - 0.3, y0 + 2.3, db + 0.04, C.mirror);
    R.box(ua + 0.4, y0, db + 0.3, ub - 0.4, y0 + 0.5, db + 0.6, C.dark, { solid: true });
    for (let u = ua + 0.6; u < ub - 0.6; u += 0.32) {
      R.cyl(u, db + 0.45, 0.08, y0 + 0.5, 0.14, C.black, 8);
    }
    const bu = (ua + ub) / 2;
    const bd = (db + da) / 2;
    R.box(bu - 0.2, y0 + 0.4, bd - 0.7, bu + 0.2, y0 + 0.48, bd + 0.7, C.red, { solid: true });
    R.box(bu - 0.9, y0 + 1.0, bd + 0.55, bu + 0.9, y0 + 1.05, bd + 0.6, C.steel);
    for (const s of [-1, 1]) R.cyl(bu + s * 0.75, bd + 0.575, 0.22, y0 + 0.78, 0.05, C.black, 12);
    if (ub - ua > 5) {
      R.box(ub - 1.2, y0, da - 2.6, ub - 0.5, y0 + 0.2, da - 0.9, C.dark, { solid: true });
      R.box(ub - 1.2, y0 + 0.2, da - 1.0, ub - 0.5, y0 + 1.25, da - 0.9, C.dark);
    }
    R.spots.keeper = { u: bu - 1.2, d: bd, face: [1, 0] };
    R.spots.browse.push({ u: bu, d: bd - 1.2, face: [0, -1] }, { u: ua + 1.0, d: db + 1.2, face: [0, -1] });
    R.sign(ua + 1.2, y0 + 2.55, 0.9, 0.9, 'chalk_gym', db + 0.05);
  },
  music(R) {
    const { ua, ub, db, da, y0 } = R;
    // guitars on the back wall, a piano, record crates
    for (let u = ua + 0.6; u < ub - 0.5; u += 0.6) {
      const c = R.rng.pick([C.red, C.yellow, [0.6, 0.35, 0.2], C.blue, C.black]);
      R.box(u - 0.17, y0 + 1.0, db + 0.02, u + 0.17, y0 + 1.42, db + 0.1, c);
      R.box(u - 0.04, y0 + 1.42, db + 0.04, u + 0.04, y0 + 2.05, db + 0.08, C.darkWood);
    }
    const pu = R.past + 0.4;
    R.box(pu, y0, da - 2.2, pu + 1.5, y0 + 1.0, da - 1.6, C.black, { solid: true });
    R.box(pu, y0 + 0.75, da - 1.65, pu + 1.5, y0 + 0.8, da - 1.4, C.white);
    for (let i = 0; i < 3; i++) {
      const u = ub - 1.0 - i * 0.7;
      R.box(u - 0.3, y0, (db + da) / 2 - 0.25, u + 0.3, y0 + 0.5, (db + da) / 2 + 0.25, C.wood, { solid: true });
      R.goodsTop(u - 0.27, u + 0.27, (db + da) / 2 - 0.2, (db + da) / 2 + 0.2, y0 + 0.506, PAL.records);
    }
    R.spots.keeper = { u: pu + 0.75, d: da - 2.6, face: [0, 1] };
    R.spots.browse.push({ u: ub - 1.4, d: (db + da) / 2 + 0.6, face: [0, -1] }, { u: (ua + ub) / 2, d: db + 1.0, face: [0, -1] });
  },
  // the lobby of an office tower: a guard at the desk, two lifts, plants, a bench
  lobby(R) {
    const { ua, ub, db, da, y0 } = R;
    const mid = (ua + ub) / 2;
    R.counter(mid - 1.5, mid + 1.5, db + 2.7, { front: [0.3, 0.3, 0.36], top: [0.86, 0.85, 0.82], register: false });
    // a little screen on the desk
    R.box(mid + 0.6, R.y0 + 1.0, db + 2.3, mid + 1.1, R.y0 + 1.35, db + 2.36, C.dark);
    R.box(mid + 0.64, R.y0 + 1.04, db + 2.36, mid + 1.06, R.y0 + 1.31, db + 2.37, [0.55, 0.8, 0.95], { sideStyle: STYLE.GLOW });
    R.spots.keeper = { u: mid, d: db + 1.65 };
    // the lifts on the back wall, a lit arrow over each
    for (const s of [-1, 1]) {
      const lu = mid + s * 2.7;
      if (lu - 0.8 < ua || lu + 0.8 > ub) continue;
      R.box(lu - 0.75, y0, db + 0.005, lu + 0.75, y0 + 2.5, db + 0.05, C.steel);
      R.box(lu - 0.015, y0, db + 0.05, lu + 0.015, y0 + 2.5, db + 0.06, C.dark);
      R.box(lu - 0.12, y0 + 2.62, db + 0.05, lu + 0.12, y0 + 2.8, db + 0.07, [1, 0.78, 0.38], { sideStyle: STYLE.GLOW });
      R.spots.browse.push({ u: lu + 0.3, d: db + 1.2, face: [0, -1], lift: true });
    }
    // big plants in pots either side of the doors
    for (const u of [ua + 0.85, ub - 0.85]) {
      R.cyl(u, da - 1.0, 0.3, y0, 0.55, [0.55, 0.38, 0.28], 12);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const lu = u + Math.cos(a) * 0.18;
        const ld = da - 1.0 + Math.sin(a) * 0.18;
        R.box(lu - 0.12, y0 + 0.55 + (k % 2) * 0.2, ld - 0.12, lu + 0.12, y0 + 1.25 + (k % 3) * 0.18, ld + 0.12, k % 2 ? C.green : [0.32, 0.56, 0.36]);
      }
      R.solid.push([u - 0.35, da - 1.35, u + 0.35, da - 0.65, y0 + 0.55]);
    }
    // a bench by the side wall to wait on
    if (da - db > 5) {
      R.box(ua + 0.2, y0 + 0.42, db + 2.0, ua + 0.65, y0 + 0.5, db + 4.2, C.darkWood, { solid: true });
      R.spots.seats.push({ u: ua + 0.45, d: db + 2.6, face: [1, 0] }, { u: ua + 0.45, d: db + 3.6, face: [1, 0] });
    }
  },
  // the houses' ground floors (seen when you rub a hole in the wall)
  home(R) {
    const { ua, ub, db, da, y0 } = R;
    const rng = R.rng;
    // a sofa, a coffee table, a lamp, a bookcase, a rug
    const su = (ua + ub) / 2;
    R.box(su - 1.1, y0, db + 0.2, su + 1.1, y0 + 0.45, db + 1.0, rng.pick([[0.45, 0.55, 0.75], [0.7, 0.36, 0.32], [0.45, 0.62, 0.45]]), { solid: true });
    R.box(su - 1.1, y0 + 0.45, db + 0.2, su + 1.1, y0 + 0.9, db + 0.42, rng.pick([[0.4, 0.5, 0.7], [0.62, 0.3, 0.28], [0.4, 0.56, 0.4]]));
    R.box(su - 0.55, y0, db + 1.4, su + 0.55, y0 + 0.4, db + 1.9, C.darkWood, { solid: true });
    R.box(su - 1.5, y0 + 0.006, db + 1.1, su + 1.5, y0 + 0.012, db + 2.3, rng.pick([[0.82, 0.55, 0.4], [0.6, 0.5, 0.7], [0.85, 0.75, 0.5]]));
    if (ub - ua > 4) R.sideShelves(ua, ua + 0.36, db + 0.4, db + 2.0, { h: 2.0, rows: 4, pal: PAL.books, wood: C.darkWood });
    R.box(ub - 0.9, y0, da - 1.4, ub - 0.3, y0 + 0.75, da - 0.6, C.wood, { solid: true });
    R.cyl(ub - 0.6, da - 1.0, 0.1, y0 + 0.75, 0.3, rng.pick([C.green, C.teal]), 8);
    R.spots.browse.push({ u: su, d: db + 2.6, face: [0, -1] });
  },
  studio(R) {
    const { ua, ub, db, da, y0 } = R;
    // a painter's studio: easels, a big table of paints, canvases against the walls
    for (let i = 0; i < 2; i++) {
      const u = ua + 1.2 + i * 2.2;
      if (u > ub - 1) break;
      R.box(u - 0.04, y0, (db + da) / 2 - 0.04, u + 0.04, y0 + 1.7, (db + da) / 2 + 0.04, C.darkWood);
      R.box(u - 0.45, y0 + 0.8, (db + da) / 2 + 0.05, u + 0.45, y0 + 1.6, (db + da) / 2 + 0.09, R.rng.pick([C.yellow, C.blue, C.pink, C.teal]));
    }
    R.box(ub - 2.4, y0, db + 0.3, ub - 0.4, y0 + 0.82, db + 1.2, C.lightWood, { solid: true });
    R.goodsTop(ub - 2.35, ub - 0.45, db + 0.35, db + 1.15, y0 + 0.826, PAL.general);
    for (let i = 0; i < 4; i++) R.box(ua + 0.3 + i * 0.12, y0, db + 0.3, ua + 0.34 + i * 0.12, y0 + 1.1 - i * 0.12, db + 1.3 - i * 0.1, R.rng.pick(GOODS));
    R.spots.browse.push({ u: ua + 1.2, d: (db + da) / 2 + 0.7, face: [0, -1] });
  },
  store(R) {
    const { ua, ub, db, da, y0 } = R;
    // crates and stacked boxes, a forklift-ish trolley
    for (let u = ua + 0.6; u < ub - 1.2; u += 1.6) {
      for (let d = db + 0.6; d < da - 1.6; d += 1.8) {
        const h = R.rng.float(0.6, 1.8);
        R.box(u, y0, d, u + 1.1, y0 + h, d + 1.1, R.rng.pick([[0.76, 0.6, 0.42], [0.66, 0.5, 0.36], [0.8, 0.68, 0.5]]), { solid: true });
      }
    }
    R.spots.browse.push({ u: ub - 0.8, d: (db + da) / 2, face: [-1, 0] });
  },
};


// ------------------------------------------------------------------ the bigger city's own shops
Object.assign(FURNISH, {
  tacos(R) {
    const { ua, ub, db, da, y0 } = R;
    const top = R.counter(ua + 0.5, ub - 1.0, db + 1.9, { front: [0.86, 0.36, 0.3], top: [0.98, 0.86, 0.5] });
    // the griddle and the bowls of salsa
    R.box(ua + 0.8, top, db + 1.4, ua + 2.0, top + 0.12, db + 1.75, C.steel);
    for (let i = 0; i < 4; i++) R.cyl(ua + 2.4 + i * 0.32, db + 1.6, 0.11, top, 0.08, [[0.86, 0.2, 0.18], [0.36, 0.7, 0.3], [0.98, 0.86, 0.4], [0.6, 0.35, 0.2]][i], 10);
    R.shelves(ua + 0.4, ub - 1.2, db, { h: 1.7, rows: 3, pal: PAL.bottles });
    R.spots.keeper = { u: (ua + ub) / 2 - 0.4, d: db + 1.0 };
    R.spots.browse.push({ u: ua + 1.4, d: db + 2.7, face: [0, -1] }, { u: ua + 2.5, d: db + 2.8, face: [0, -1] });
    R.sign((ua + ub) / 2, y0 + 2.4, 1.0, 1.0, 'chalk_welcome');
    if (da - db > 4.8 && ub - 1.3 - 0.7 > R.past) R.table(ub - 1.3, da - 1.2, { round: true, r: 0.32, color: [0.98, 0.86, 0.5], chairs: [[-1, 0], [0, -1]] });
  },
  diner(R) {
    const { ua, ub, db, da, y0 } = R;
    // a long counter with red stools, the kitchen hatch behind, booths by the windows
    const top = R.counter(ua + 0.5, ub - 0.6, db + 1.7, { front: [0.86, 0.26, 0.3], top: [0.95, 0.95, 0.95], register: true });
    for (let u = ua + 0.9; u < ub - 0.8; u += 0.75) {
      R.cyl(u, db + 2.1, 0.2, y0 + 0.66, 0.08, [0.86, 0.22, 0.26], 12);
      R.cyl(u, db + 2.1, 0.04, y0, 0.66, C.steel, 6);
    }
    for (let i = 0; i < 3; i++) R.cyl(ua + 1.2 + i * 1.2, db + 1.4, 0.15, top, 0.03, C.white, 12);
    R.box(ua + 0.6, y0 + 1.3, db + 0.01, ub - 0.6, y0 + 2.1, db + 0.05, C.steel);
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 0.9 };
    R.spots.seats.push({ u: ua + 1.65, d: db + 2.1, face: [0, -1] }, { u: ua + 3.15, d: db + 2.1, face: [0, -1] });
    // booths along the front
    for (let u = R.past + 0.9; u < ub - 1.2; u += 2.2) {
      R.box(u - 0.45, y0, da - 1.4, u + 0.45, y0 + 0.74, da - 0.7, C.white, { solid: true });
      R.box(u - 0.5, y0, da - 2.05, u + 0.5, y0 + 0.45, da - 1.6, [0.86, 0.26, 0.3], { solid: true });
      R.box(u - 0.5, y0 + 0.45, da - 2.12, u + 0.5, y0 + 1.1, da - 1.95, [0.86, 0.26, 0.3]);
      R.spots.seats.push({ u, d: da - 1.82, face: [0, 1] });
    }
  },
  juice(R) {
    const { ua, ub, db, da, y0 } = R;
    const top = R.counter(ua + 0.6, ub - 0.6, db + 1.8, { front: [0.98, 0.62, 0.22], top: C.white });
    for (let i = 0; i < 3; i++) {
      const u = ua + 1.0 + i * 0.6;
      R.cyl(u, db + 1.45, 0.1, top, 0.1, C.dark, 10);
      R.cyl(u, db + 1.45, 0.08, top + 0.1, 0.26, [[0.98, 0.6, 0.2], [0.55, 0.85, 0.35], [0.95, 0.35, 0.5]][i], 10);
    }
    for (let i = 0; i < 4; i++) R.box(ub - 2.6 + i * 0.5, top, db + 1.25, ub - 2.2 + i * 0.5, top + 0.22, db + 1.65, C.lightWood);
    R.goodsTop(ub - 2.58, ub - 0.72, db + 1.28, db + 1.62, top + 0.226, PAL.fruit);
    R.shelves(ua + 0.4, ub - 0.4, db, { h: 1.5, rows: 3, pal: PAL.fruit });
    R.spots.keeper = { u: (ua + ub) / 2, d: db + 0.95 };
    R.spots.browse.push({ u: ua + 1.4, d: db + 2.6, face: [0, -1] });
    if (da - db > 4.6) R.table(ub - 1.3, da - 1.2, { round: true, r: 0.3, color: [0.55, 0.85, 0.35], chairs: [[-1, 0], [0, -1]] });
  },
  surf(R) {
    const { ua, ub, db, da, y0 } = R;
    // boards standing along the back wall, a rack of shirts, wax on the counter
    const cols = [[0.98, 0.6, 0.25], [0.3, 0.7, 0.85], [0.98, 0.85, 0.35], [0.95, 0.4, 0.55], [0.55, 0.85, 0.5], [0.98, 0.98, 0.95]];
    for (let u = ua + 0.5, i = 0; u < ub - 0.5; u += 0.55, i++) {
      const p = R.P(u, y0 + 1.15, db + 0.25);
      const g = new THREE.CapsuleGeometry(0.24, 1.7, 4, 10);
      g.scale(1, 1, 0.16);
      g.rotateY(Math.atan2(R.f.ux, R.f.uz));
      g.translate(p[0], p[1], p[2]);
      R.add(R.M.inGloss, g, cols[i % cols.length]);
    }
    R.solid.push([ua + 0.2, db, ub - 0.2, db + 0.5, y0 + 2.2]);
    const ru = (ua + ub) / 2;
    const rd = (db + da) / 2 + 0.3;
    R.box(ru - 1.2, y0 + 1.5, rd - 0.02, ru + 1.2, y0 + 1.54, rd + 0.02, C.steel);
    for (const s of [-1, 1]) R.box(ru + s * 1.2 - 0.02, y0, rd - 0.02, ru + s * 1.2 + 0.02, y0 + 1.54, rd + 0.02, C.steel);
    for (let k = 0; k < 7; k++) R.box(ru - 1.05 + k * 0.33, y0 + 0.75, rd - 0.22, ru - 0.85 + k * 0.33, y0 + 1.48, rd + 0.22, cols[(k + 2) % cols.length]);
    R.solid.push([ru - 1.25, rd - 0.25, ru + 1.25, rd + 0.25, y0 + 1.5]);
    R.counter(ub - 2.0, ub - 0.3, da - 1.0, { deep: 0.55 });
    R.spots.keeper = { u: ub - 1.1, d: da - 1.95, face: [0, 1] };
    R.spots.browse.push({ u: ru, d: rd - 0.8, face: [0, 1] }, { u: ua + 1.2, d: db + 1.1, face: [0, -1] });
  },
  boutique(R) {
    const { ua, ub, db, da, y0 } = R;
    const cols = [[0.95, 0.45, 0.6], [0.45, 0.6, 0.95], [0.98, 0.9, 0.6], [0.6, 0.85, 0.7], [0.75, 0.5, 0.85], [0.98, 0.98, 0.95]];
    // rails of long dresses and shirts, a mirror, a little counter
    for (const [rd, n] of [[db + 0.5, 1], [(db + da) / 2, 2]]) {
      const ru0 = ua + 0.6;
      const ru1 = ub - (n === 1 ? 0.6 : 2.4);
      R.box(ru0, y0 + 1.6, rd - 0.02, ru1, y0 + 1.64, rd + 0.02, C.steel);
      for (let u = ru0 + 0.15, k = 0; u < ru1 - 0.15; u += 0.3, k++) R.box(u - 0.11, y0 + 0.35, rd - 0.18, u + 0.11, y0 + 1.56, rd + 0.18, cols[k % cols.length]);
      R.solid.push([ru0, rd - 0.25, ru1, rd + 0.25, y0 + 1.6]);
      R.spots.browse.push({ u: (ru0 + ru1) / 2, d: rd + 0.7, face: [0, -1] });
    }
    R.box(ub - 0.07, y0 + 0.2, db + 0.8, ub - 0.04, y0 + 2.2, db + 1.8, C.mirror, { gloss: true });
    R.counter(ub - 2.0, ub - 0.3, da - 1.0, { deep: 0.5, front: [0.98, 0.9, 0.94] });
    R.spots.keeper = { u: ub - 1.1, d: da - 1.9, face: [0, 1] };
  },
  arcade(R) {
    const { ua, ub, db, da, y0 } = R;
    // cabinets in a row along the back, their screens glowing, a claw machine by the door
    const cols = [[0.86, 0.26, 0.5], [0.3, 0.45, 0.9], [0.98, 0.7, 0.2], [0.3, 0.8, 0.6]];
    for (let u = ua + 0.6, i = 0; u < ub - 0.6; u += 0.95, i++) {
      R.box(u - 0.35, y0, db + 0.1, u + 0.35, y0 + 1.85, db + 0.8, cols[i % cols.length], { solid: true });
      R.box(u - 0.28, y0 + 1.05, db + 0.81, u + 0.28, y0 + 1.55, db + 0.83, [0.5, 0.9, 1.0], { sideStyle: STYLE.GLOW });
      R.box(u - 0.3, y0 + 0.85, db + 0.8, u + 0.3, y0 + 0.95, db + 1.05, C.dark);
      if (i % 2 === 0) R.spots.browse.push({ u, d: db + 1.4, face: [0, -1] });
    }
    const cu = ub - 1.0;
    R.box(cu - 0.45, y0, da - 1.6, cu + 0.45, y0 + 2.0, da - 0.7, [0.95, 0.45, 0.6], { solid: true });
    R.box(cu - 0.38, y0 + 1.0, da - 1.58, cu + 0.38, y0 + 1.85, da - 0.72, [0.8, 0.9, 1.0], { gloss: true });
    R.spots.keeper = { u: (ua + ub) / 2, d: da - 1.6, face: [0, -1] };
  },
  bar(R) {
    const { ua, ub, db, da, y0 } = R;
    // the bar along the back, stools, bottles glowing on the shelves, a jukebox, booths
    const top = R.counter(ua + 0.6, ub - 1.6, db + 1.7, { front: [0.36, 0.2, 0.3], top: [0.9, 0.62, 0.42], register: false });
    R.shelves(ua + 0.6, ub - 1.6, db, { h: 2.2, rows: 4, pal: PAL.bottles, wood: [0.3, 0.18, 0.22] });
    for (let u = ua + 1.0; u < ub - 1.8; u += 0.8) {
      R.cyl(u, db + 2.15, 0.19, y0 + 0.72, 0.08, [0.75, 0.2, 0.4], 12);
      R.cyl(u, db + 2.15, 0.04, y0, 0.72, C.steel, 6);
      R.spots.seats.push({ u, d: db + 2.15, face: [0, -1] });
    }
    for (let i = 0; i < 4; i++) R.cyl(ua + 1.2 + i * 0.9, db + 1.4, 0.04, top, 0.18, [[0.4, 0.85, 0.6], [0.95, 0.75, 0.3], [0.85, 0.3, 0.45], [0.5, 0.6, 0.95]][i], 8);
    // the jukebox in the corner
    const ju = ub - 0.75;
    R.box(ju - 0.45, y0, db + 0.2, ju + 0.45, y0 + 1.5, db + 0.75, [0.85, 0.3, 0.55], { solid: true });
    R.box(ju - 0.36, y0 + 0.8, db + 0.76, ju + 0.36, y0 + 1.35, db + 0.78, [1, 0.8, 0.4], { sideStyle: STYLE.GLOW });
    // a booth by the window
    if (da - db > 5 && ub - 1.4 > R.past + 1.2) R.table(ub - 1.4, da - 1.3, { color: [0.36, 0.2, 0.3], chairs: [[-1, 0], [1, 0]], chairColor: [0.75, 0.2, 0.4] });
    R.spots.keeper = { u: (ua + ub) / 2 - 0.6, d: db + 0.9 };
    R.spots.browse.push({ u: (ua + ub) / 2, d: (db + da) / 2 + 0.6, face: [0, -1] });
  },
  cinema(R) {
    FURNISH.lobby(R);
  },
});

export { DECOR, FURNISH, PAL };

/**
 * A rubbed-out spot on the front wall of a room: once it is big enough for a person and reaches
 * down to the floor, the wall opens there (its collision box is split round the hole).
 */
export function openWall(collision, nav, box, spot) {
  const d = box.data;
  if (!d || !box.alive) return false;
  if (spot.r < 0.8 || spot.y - spot.r > d.y0 + 0.5 || spot.y + spot.r < d.y0 + 1.5) return false;
  const f = d.f;
  const toU = (x, z) => f.toU(x, z);
  const ua = toU(box.x0, box.z0);
  const ub = toU(box.x1, box.z1);
  const u0 = Math.min(ua, ub);
  const u1 = Math.max(ua, ub);
  const su = toU(spot.x, spot.z);
  const half = Math.min(spot.r * 0.85, 1.2);
  if (su + half < u0 || su - half > u1) return false;
  collision.remove(box.id);
  const add = (a, b) => {
    if (b - a < 0.15) return;
    const [mn, mx] = f.box(a, box.y0, d.d0, b, box.y1, d.d1);
    collision.addBox(mn[0], mn[2], mx[0], mx[2], box.y0, box.y1, 'roomwall', d);
  };
  add(u0, su - half);
  add(su + half, u1);
  if (nav) nav.refresh(Math.min(box.x0, box.x1) - 3, Math.min(box.z0, box.z1) - 3, Math.max(box.x0, box.x1) + 3, Math.max(box.z0, box.z1) + 3);
  return true;
}

