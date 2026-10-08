import { STYLE } from '../render/MeshBuilder.js';
import { RNG } from '../core/util.js';

// Rooms on the ground floors. Every shop has a real room behind its front: you walk in through
// the open door, see the shop through the window, and the keeper works behind the counter while
// customers browse. The houses have rooms too, behind closed walls: rub a hole in the wall with
// the eraser (or blow one with the bazooka) and you can see in, and step through.
//
// Everything here is placed in facade coordinates: u along the front (as seen from the street),
// y up, d outwards (negative is inside the building).

const T = 0.25; // wall thickness

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
const GOODS = [C.red, C.yellow, C.blue, C.green, C.orange, C.pink, C.purple, C.teal, C.white];
// what is on a shelf (the surface shader draws the rows of things: STYLE.GOODS)
const PAL = { general: 0, books: 1, meds: 2, tools: 3, bread: 4, fruit: 5, cups: 6, records: 7, bottles: 8, glasses: 9 };

// the look of each kind of room: walls, lower band of the walls, floor
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

/**
 * One room behind facade f.
 * spec: { u0, u1, depth, y0, h, kind, bw, bd, top, openings: [{ kind: 'door'|'window', u0, u1, y0, y1, hinge }],
 *         shop (the shop it belongs to, if any), seed }
 * Returns the room (its spots for people, its collision boxes).
 */
export function buildRoom(W, ch, f, spec) {
  const R = new Room(W, ch, f, spec);
  R.shell();
  R.furnish();
  R.collide();
  return R;
}

/**
 * Several rooms side by side behind one facade, tiling it from 0 to common.bw: the building above
 * them is solid once for all; each room does its own walls and the solid rest behind it.
 */
export function buildRooms(W, ch, f, list, common) {
  const { y0, h, bw, bd, top } = common;
  const above = f.box(0, y0 + h, -bd, bw, top, 0);
  W.collision.addBox(above[0][0], above[0][2], above[1][0], above[1][2], y0 + h, top, 'wall');
  return list.map((r) => buildRoom(W, ch, f, { ...common, ...r, around: false }));
}

// split [u0, u1] into rooms of at most `max` metres
export function splitRooms(u0, u1, max = 10) {
  const n = Math.max(1, Math.ceil((u1 - u0) / max));
  const out = [];
  for (let i = 0; i < n; i++) out.push([u0 + ((u1 - u0) * i) / n, u0 + ((u1 - u0) * (i + 1)) / n]);
  return out;
}

class Room {
  constructor(W, ch, f, spec) {
    this.W = W;
    this.ch = ch;
    this.f = f;
    this.spec = spec;
    this.kind = spec.kind;
    this.decor = DECOR[spec.kind] || DECOR.shop;
    this.mb = ch.rb;
    this.ua = spec.u0 + T;
    this.ub = spec.u1 - T;
    this.da = -T;
    this.db = -spec.depth;
    this.y0 = spec.y0;
    this.y1 = spec.y0 + spec.h;
    this.rng = new RNG(spec.seed || Math.floor(Math.abs(f.ox * 13.1 + f.oz * 7.7 + spec.u0 * 3.3)) + 11);
    this.spots = { browse: [], seats: [], chairs: [] };
    this.solid = []; // furniture footprints (for the collision)
    this.openings = spec.openings || [];
    // the way in stays clear: nothing stands in the lane from the door into the room (the
    // furniture that would starts just past it, at this.past)
    const door = this.openings.find((o) => o.kind === 'door');
    this.lane = door ? [door.u0 - 0.15, door.u1 + 0.15] : [this.ua, this.ua];
    this.past = Math.max(this.ua, this.lane[1]);
  }

  P(u, y, d) {
    return this.f.p(u, y, d);
  }

  // world (x, z) -> facade coordinates (u along the front, d outwards)
  toUD(x, z) {
    const f = this.f;
    return [(x - f.ox) * f.rx + (z - f.oz) * f.rz, (x - f.ox) * f.nx + (z - f.oz) * f.nz];
  }

  // a quad given by four points, wound so that its front faces n
  quad(a, b, c, d, n, color, uvs, f1 = [0, 3, 3, 0]) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) this.mb.quad(a, b, c, d, n, color, uvs, f1);
    else this.mb.quad(a, d, c, b, n, color, [uvs[0], uvs[3], uvs[2], uvs[1]], f1);
  }

  // an axis-aligned box in facade coordinates
  box(u0, y0, d0, u1, y1, d1, color, o = {}) {
    const [mn, mx] = this.f.box(u0, y0, d0, u1, y1, d1);
    this.mb.box(mn, mx, { color, seed: this.rng.float(0, 100), bottom: !!o.bottom, topStyle: o.topStyle, sideStyle: o.sideStyle || 0, topColor: o.topColor });
    if (o.solid) this.solid.push([Math.min(u0, u1), Math.min(d0, d1), Math.max(u0, u1), Math.max(d0, d1), y1]);
  }

  cyl(u, d, r, y0, h, color, n = 10) {
    const p = this.P(u, 0, d);
    this.mb.cylinder(p[0], y0, p[2], r, h, n, color);
  }

  disc(u, d, y, r, color, n = 10) {
    const p = this.P(u, 0, d);
    this.mb.disc(p[0], y, p[2], r, n, color);
  }

  // a picture from the sign atlas on the back wall (menus, posters)
  sign(u, y, w, h, rect, d = null) {
    const p = this.P(u, y, (d !== null ? d : this.db) + 0.03);
    this.W.signs.push({ x: p[0], y: p[1], z: p[2], w, h, rect, axis: [this.f.rx, 0, this.f.rz], pivot: [0.5, 0.5] });
  }

  // a lamp hanging from the ceiling (and its warm pool of light on the floor)
  lamp(u, d, col = this.decor.light) {
    const y = this.y1 - 0.55;
    const a = this.P(u, this.y1, d);
    const b = this.P(u, y + 0.2, d);
    this.ch.sl.seg(a, b, { width: 1.2, overshoot: 0, color: C.black });
    const [mn, mx] = this.f.box(u - 0.22, y, d - 0.22, u + 0.22, y + 0.2, d + 0.22);
    this.mb.box(mn, mx, { color: [1, 0.9, 0.62], sideStyle: STYLE.GLOW, topStyle: STYLE.GLOW, bottom: true });
    const g = this.P(u, 0, d);
    this.W.lights.push({ x: g[0], z: g[2], r: 4.2, col, i: 0.9 });
  }

  // the front of a shelf full of things: one quad, the shader draws the products row by row
  goodsFace(u0, u1, ya, yb, d, rowH, pal, facing = 1) {
    const n = [this.f.nx * facing, 0, this.f.nz * facing];
    const w = Math.abs(u1 - u0);
    this.quad(this.P(u0, ya, d), this.P(u1, ya, d), this.P(u1, yb, d), this.P(u0, yb, d), n, [0.72, 0.56, 0.42], [[0, 0], [w, 0], [w, yb - ya], [0, yb - ya]], [STYLE.GOODS, rowH, pal, this.rng.float(0, 100)]);
  }

  // the same on a shelf standing along a side wall (facing along u)
  goodsSide(u, d0, d1, ya, yb, rowH, pal, facing = 1) {
    const n = [this.f.rx * facing, 0, this.f.rz * facing];
    const w = Math.abs(d1 - d0);
    this.quad(this.P(u, ya, d0), this.P(u, ya, d1), this.P(u, yb, d1), this.P(u, yb, d0), n, [0.72, 0.56, 0.42], [[0, 0], [w, 0], [w, yb - ya], [0, yb - ya]], [STYLE.GOODS, rowH, pal, this.rng.float(0, 100)]);
  }

  // things laid out on a table top or in a crate, seen from above
  goodsTop(u0, u1, d0, d1, y, pal) {
    const w = Math.abs(u1 - u0);
    const dd = Math.abs(d1 - d0);
    this.quad(this.P(u0, y, d0), this.P(u1, y, d0), this.P(u1, y, d1), this.P(u0, y, d1), [0, 1, 0], [0.72, 0.56, 0.42], [[0, 0], [w, 0], [w, dd], [0, dd]], [STYLE.GOODS, dd / 2, pal, this.rng.float(0, 100)]);
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
    this.box(u0 - 0.05, top - 0.05, d - deep - 0.04, u1 + 0.05, top, d + 0.06, o.top || C.lightWood);
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
    const { f, mb, ua, ub, da, db, y0, y1 } = this;
    const dec = this.decor;
    const n = [f.nx, 0, f.nz];
    const r = [f.rx, 0, f.rz];
    const neg = (v) => [-v[0], -v[1], -v[2]];
    mb.obj = 0;
    // floor: one quad, the shader draws the tiles or boards
    const fl = dec.floor;
    const pat = { checker: [0, 0.5], tiles: [1, 0.6], mats: [2, 1.0], wood: [3, 0.18], concrete: [4, 1] }[fl] || [4, 1];
    const fcol = fl === 'checker' ? [0.95, 0.94, 0.9] : fl === 'mats' ? [0.36, 0.36, 0.4] : fl === 'tiles' ? [0.9, 0.88, 0.84] : fl === 'wood' ? [0.74, 0.55, 0.38] : [0.74, 0.74, 0.72];
    this.quad(this.P(ua, y0 + 0.004, db), this.P(ub, y0 + 0.004, db), this.P(ub, y0 + 0.004, da), this.P(ua, y0 + 0.004, da), [0, 1, 0], fcol, [[ua, db], [ub, db], [ub, da], [ua, da]], [STYLE.FLOOR, pat[1], pat[0], this.rng.float(0, 50)]);
    // ceiling
    this.quad(this.P(ua, y1, db), this.P(ub, y1, db), this.P(ub, y1, da), this.P(ua, y1, da), [0, -1, 0], [0.94, 0.92, 0.86], [[ua, db], [ub, db], [ub, da], [ua, da]]);
    // walls: a lower band and the wall above it
    const band = y0 + 0.95;
    const wall = (a0, a1, b0, b1, nn, len) => {
      // a0..a1: two bottom corners (y0); the face goes up to y1
      this.quad([a0[0], y0, a0[2]], [a1[0], y0, a1[2]], [a1[0], band, a1[2]], [a0[0], band, a0[2]], nn, dec.band, [[0, 0], [len, 0], [len, band - y0], [0, band - y0]]);
      this.quad([a0[0], band, a0[2]], [a1[0], band, a1[2]], [a1[0], y1, a1[2]], [a0[0], y1, a0[2]], nn, dec.wall, [[0, band - y0], [len, band - y0], [len, y1 - y0], [0, y1 - y0]]);
      void b0;
      void b1;
    };
    wall(this.P(ua, y0, db), this.P(ub, y0, db), null, null, n, ub - ua); // back wall faces the front
    wall(this.P(ua, y0, da), this.P(ua, y0, db), null, null, r, da - db); // left wall faces right
    wall(this.P(ub, y0, db), this.P(ub, y0, da), null, null, neg(r), da - db); // right wall
    // the front wall from inside, with the door and the windows cut out (a hollow wall: rub
    // it out and you are through)
    mb.hollow = y1;
    const len = ub - ua;
    const holes = this.openings.map((o) => [ub - o.u1, o.y0, ub - o.u0, o.y1]);
    mb.faceWithHoles((t, y) => this.P(ub - t, y, da), len, y0, y1, y0, neg(n), dec.wall, [0, 3, 3, 0], [0, 0, 0, 0], holes);
    // the sides of each opening, through the thickness of the wall
    for (const o of this.openings) {
      const wc = this.spec.outside || dec.wall;
      this.quad(this.P(o.u0, o.y0, 0), this.P(o.u0, o.y0, da), this.P(o.u0, o.y1, da), this.P(o.u0, o.y1, 0), r, wc, [[0, 0], [T, 0], [T, 1], [0, 1]]);
      this.quad(this.P(o.u1, o.y0, da), this.P(o.u1, o.y0, 0), this.P(o.u1, o.y1, 0), this.P(o.u1, o.y1, da), neg(r), wc, [[0, 0], [T, 0], [T, 1], [0, 1]]);
      this.quad(this.P(o.u0, o.y1, 0), this.P(o.u0, o.y1, da), this.P(o.u1, o.y1, da), this.P(o.u1, o.y1, 0), [0, -1, 0], wc, [[0, 0], [T, 0], [T, 1], [0, 1]]);
      if (o.y0 > y0 + 0.05) this.quad(this.P(o.u0, o.y0, da), this.P(o.u0, o.y0, 0), this.P(o.u1, o.y0, 0), this.P(o.u1, o.y0, da), [0, 1, 0], wc, [[0, 0], [T, 0], [T, 1], [0, 1]]);
      if (o.kind === 'window') {
        // the glass, a little inside the wall
        const g = this.ch.gb;
        const gd = -0.06;
        const a = this.P(o.u0, o.y0, gd);
        const b = this.P(o.u1, o.y0, gd);
        const c = this.P(o.u1, o.y1, gd);
        const d = this.P(o.u0, o.y1, gd);
        g.quad(a, b, c, d, n, C.glass, [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 3, 3, 0]);
        // a sill inside, with something on it
        this.box(o.u0 - 0.05, o.y0 - 0.06, da - 0.22, o.u1 + 0.05, o.y0, da + 0.02, C.lightWood);
      } else if (o.kind === 'door') {
        // the door stands open, flat against the wall inside
        const hinge = o.hinge || 'left';
        const hu = hinge === 'left' ? o.u0 : o.u1;
        const w = o.u1 - o.u0;
        const s = hinge === 'left' ? 1 : -1;
        const uu0 = hu + s * 0.02;
        this.box(Math.min(uu0, uu0 + s * 0.05), o.y0, da - w, Math.max(uu0, uu0 + s * 0.05), o.y1 - 0.06, da, o.color || C.darkWood);
        // a mat at the door
        this.box(o.u0 + 0.05, y0, da - 0.9, o.u1 - 0.05, y0 + 0.012, da, [0.62, 0.42, 0.3]);
      }
    }
    mb.hollow = 0;
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
      const fx = s.face ? this.f.rx * s.face[0] + this.f.nx * s.face[1] : this.f.nx;
      const fz = s.face ? this.f.rz * s.face[0] + this.f.nz * s.face[1] : this.f.nz;
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
      // the way from one spot to another round the furniture (world points, the last one the goal)
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
    const { f, W, spec, ua, ub, da, db, y0, y1 } = this;
    const col = W.collision;
    const add = (u0, d0, u1, d1, ya, yb, tag = 'wall', data = null) => {
      if (Math.abs(u1 - u0) < 1e-3 || Math.abs(d1 - d0) < 1e-3) return null;
      const [mn, mx] = f.box(u0, ya, d0, u1, yb, d1);
      return col.addBox(mn[0], mn[2], mx[0], mx[2], ya, yb, tag, data);
    };
    const top = spec.top;
    const bw = spec.bw;
    const bd = spec.bd;
    // the building above the room and beside it (unless the building does that itself, when it
    // has several rooms side by side), and the solid rest of the building behind it
    if (spec.around !== false) {
      add(0, -bd, bw, 0, y1, top);
      if (spec.u0 > 0.01) add(0, -bd, spec.u0, 0, y0, y1);
      if (spec.u1 < bw - 0.01) add(spec.u1, -bd, bw, 0, y0, y1);
    }
    add(spec.u0, -bd, spec.u1, db, y0, y1);
    // the side walls of the room
    add(spec.u0, db, ua, 0, y0, y1);
    add(ub, db, spec.u1, 0, y0, y1);
    // the front wall, open at the doors; a wall you can rub through (see Game.eraseWorld)
    const doors = this.openings.filter((o) => o.kind === 'door').sort((a, b) => a.u0 - b.u0);
    let u = spec.u0;
    const wallData = { room: this, f, d0: da, d1: 0, y0, y1 };
    for (const d of doors) {
      add(u, da, d.u0, 0, y0, y1, 'roomwall', wallData);
      u = d.u1;
    }
    add(u, da, spec.u1, 0, y0, y1, 'roomwall', wallData);
    // the bigger furniture
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

// ------------------------------------------------------------------ what each kind of room holds
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
      const p = R.P(u + 0.36, y0 + 0.46, db + 0.73);
      R.ch.sl.poly(Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return R.P(u + 0.36 + Math.cos(a) * 0.22, y0 + 0.46 + Math.sin(a) * 0.22, db + 0.73);
      }), true, { width: 1.6, color: C.black, overshoot: 0 });
      void p;
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

export { DECOR };

/**
 * A rubbed-out spot on the front wall of a room: once it is big enough for a person and reaches
 * down to the floor, the wall opens there (its collision box is split round the hole).
 */
export function openWall(collision, nav, box, spot) {
  const d = box.data;
  if (!d || !box.alive) return false;
  if (spot.r < 0.8 || spot.y - spot.r > d.y0 + 0.5 || spot.y + spot.r < d.y0 + 1.5) return false;
  const f = d.f;
  const toU = (x, z) => (x - f.ox) * f.rx + (z - f.oz) * f.rz;
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

