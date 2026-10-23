import { srgb } from '../render/materials.js';
import { nextId, seeded } from './kit.js';
import { Soup, F } from './soup.js';
import { CURB } from './layout.js';
import { isTouchDevice } from '../core/util.js';

// (v5, GTA IV) A front up close. A building seen from the sidewalk is not a box with windows
// drawn on it: the windows are holes in a wall a hand's width thick, the glass at the back of
// them and the sash in the glass; a stone sill stands out under each and a lintel (a keystone in
// it, or a little cornice on two brackets) over it; a band of stone runs along the wall between
// the shop and the flats, a cornice on its brackets along the top; the pipe from the roof comes
// down a corner, the meters hang by the door to the flats, with the bells and the number and the
// slot for the letters; a fire escape zigzags down the old walk-ups; the air conditioners stick
// out of the windows and drip down the wall; behind the glass somebody's curtains, a blind half
// down, a window pushed up open. This is that layer, for the kits of world/deco.js, world/kits.js
// and world/hotels.js.
//
// The small parts are many, so they are not made one THREE geometry at a time: a building's
// parts go into soups (world/soup.js), one to a pen, each part with its own id (so the inker
// draws round every sill and every bracket) and its own colour, and into the batch as one
// geometry each when the building is done (Parts.flush). Faces nobody can see are left out: the
// back of whatever stands against the wall.
//
// Everything is in a front's frame (kit.js Facade): u along it, v up (the height above the sea), w
// out of it. Each building has dice of its own (diceAt: from where it stands), so the city's own
// dice, and with them every building, every shop and every name, stay what they were.

// a phone draws a little less of what is only seen up close
const LOW = (() => {
  try {
    return isTouchDevice() || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('low'));
  } catch (e) {
    return false;
  }
})();
export const DETAIL_LOW = LOW;

// the faces of a box in a front's frame (the ones to leave out)
export const FB = { FRONT: 1, BACK: 2, LEFT: 4, RIGHT: 8, TOP: 16, BOTTOM: 32 };

// The slats of a blind: a band of the blind's own colour a shade darker every so often, its face
// only. As a box a centimetre high each had its top and its underside, a fold the inker outlines;
// from across the street those folds fall between the pixels, and every slat came out a row of
// black dots (the offices' blinds like sheets of perforated tin). A face turned the way the blind
// is has no fold to draw: up close it is a slat, far off the blind's tone. SLAT: its height
export const SLAT = 0.03;
export const SLAT_FACE = FB.BACK | FB.TOP | FB.BOTTOM | FB.LEFT | FB.RIGHT;

// the frame's face as the world's (every street runs north-south or east-west)
const axis = (x, z) => (Math.abs(x) > 0.5 ? (x > 0 ? F.PX : F.NX) : z > 0 ? F.PZ : F.NZ);
function skipOf(f, m) {
  if (!m) return 0;
  let s = 0;
  if (m & FB.FRONT) s |= axis(f.nx, f.nz);
  if (m & FB.BACK) s |= axis(-f.nx, -f.nz);
  if (m & FB.RIGHT) s |= axis(f.ux, f.uz);
  if (m & FB.LEFT) s |= axis(-f.ux, -f.uz);
  if (m & FB.TOP) s |= F.PY;
  if (m & FB.BOTTOM) s |= F.NY;
  return s;
}

const cl = (c) => [c.r, c.g, c.b];

// ------------------------------------------------------------------ the parts of a building
export class Parts {
  constructor(ctx) {
    this.ctx = ctx;
    this.M = ctx.M;
    this.soups = new Map();
  }

  soup(mat) {
    let s = this.soups.get(mat);
    if (s && s.n > 50000) {
      s.flushTo(this.ctx.B, mat);
      s = null;
    }
    if (!s) {
      s = new Soup();
      this.soups.set(mat, s);
    }
    return s;
  }

  // a box in the front f; col a THREE.Color (linear, as the kits give them); skip: FB faces left out
  box(mat, f, u0, v0, w0, u1, v1, w1, col, id = nextId(), skip = FB.BACK) {
    if (u1 - u0 < 1e-4 || v1 - v0 < 1e-4 || w1 - w0 < 1e-4) return id;
    const a = f.p(u0, v0, w0);
    const b = f.p(u1, v1, w1);
    boxInto(this.soup(mat), Math.min(a[0], b[0]), v0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), v1, Math.max(a[2], b[2]), cl(col), id, skipOf(f, skip));
    return id;
  }

  // a box in world coordinates
  wbox(mat, x0, y0, z0, x1, y1, z1, col, id = nextId(), skip = 0) {
    boxInto(this.soup(mat), Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), cl(col), id, skip);
    return id;
  }

  // a flat pane standing in the front at w, facing out of it
  pane(mat, f, u0, v0, u1, v1, w, col, id = nextId()) {
    const n = [f.nx, 0, f.nz];
    const a = f.p(u0, v0, w);
    const b = f.p(u1, v0, w);
    const c = f.p(u1, v1, w);
    const d = f.p(u0, v1, w);
    // (wound counter-clockwise seen from where it faces: (b - a) x (d - a) along n)
    const e1x = b[0] - a[0];
    const e1z = b[2] - a[2];
    const e2y = d[1] - a[1];
    const crx = -e1z * e2y;
    const crz = e1x * e2y;
    const s = this.soup(mat);
    if (crx * n[0] + crz * n[2] >= 0) s.quad(a, b, c, d, n, cl(col), id);
    else s.quad(b, a, d, c, n, cl(col), id);
    return id;
  }

  // a bar between two points (a pipe's bend, a stair's stringer): a box turned along it, its faces
  // as a box's (t thick, h high across it)
  bar(mat, a, b, t, col, id = nextId()) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) return id;
    // a frame along the bar: d (along), s (sideways, level), up (across, the rest)
    const d = [dx / len, dy / len, dz / len];
    let s = [-d[2], 0, d[0]];
    const sl = Math.hypot(s[0], s[2]);
    s = sl < 1e-4 ? [1, 0, 0] : [s[0] / sl, 0, s[2] / sl];
    const up = [s[1] * d[2] - s[2] * d[1], s[2] * d[0] - s[0] * d[2], s[0] * d[1] - s[1] * d[0]];
    const h = t / 2;
    const P = (pt, i, j) => [pt[0] + s[0] * i * h + up[0] * j * h, pt[1] + s[1] * i * h + up[1] * j * h, pt[2] + s[2] * i * h + up[2] * j * h];
    const so = this.soup(mat);
    const c = cl(col);
    // the four long faces
    for (const [i0, j0, i1, j1, n] of [[1, -1, 1, 1, s], [-1, 1, -1, -1, [-s[0], -s[1], -s[2]]], [1, 1, -1, 1, up], [-1, -1, 1, -1, [-up[0], -up[1], -up[2]]]]) {
      so.quad(P(a, i0, j0), P(b, i0, j0), P(b, i1, j1), P(a, i1, j1), n, c, id);
    }
    return id;
  }

  // a picture of the board atlas (a poster, a sticker, a plate) flat on the front at w
  sticker(f, cell, uc, vc, w, width, height) {
    const ctx = this.ctx;
    const uv = ctx.atlas && ctx.atlas.rects && ctx.atlas.rects[cell];
    if (!uv || !ctx.M.board) return;
    const a = f.p(uc - width / 2, vc - height / 2, w);
    const b = f.p(uc + width / 2, vc - height / 2, w);
    const c = f.p(uc + width / 2, vc + height / 2, w);
    const d = f.p(uc - width / 2, vc + height / 2, w);
    const g = f.facing(a, b, c, d, [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], [f.nx, 0, f.nz]);
    ctx.B.add(ctx.M.board, g, null, nextId());
  }

  // into the batch: a geometry to a pen (and empty again)
  flush() {
    for (const [mat, s] of this.soups) s.flushTo(this.ctx.B, mat);
    this.soups.clear();
  }
}

// an axis-aligned box into a soup, col linear [r, g, b]; skip: the world's faces left out (soup.js F)
function boxInto(S, x0, y0, z0, x1, y1, z1, c, id, skip) {
  if (!(skip & F.PX)) S.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], c, id);
  if (!(skip & F.NX)) S.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], c, id);
  if (!(skip & F.PY)) S.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], c, id);
  if (!(skip & F.NY)) S.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], c, id);
  if (!(skip & F.PZ)) S.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c, id);
  if (!(skip & F.NZ)) S.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], c, id);
}

// ------------------------------------------------------------------ the dice, the dialects
// a building's own dice, from where its front stands (salt: a second set for the same front)
export function diceAt(f, salt = 0) {
  const h = Math.abs(Math.floor(f.ox * 73.13 + f.oz * 37.77 + salt * 1013.7 + 0.5)) % 2147483000;
  return seeded(h + 7);
}

/**
 * How the buildings of a district are built (the same kit, its own hand):
 *   'walkup' - the old brick-and-stucco walk-ups of the busy districts (downtown, the lofts,
 *              Brickton): sash windows two over two, keystones, a bracketed cornice, a band of
 *              stone over the shops, a fire escape down the front, air conditioners in the
 *              windows;
 *   'havana' - Little Havana: tall windows with their shutters folded back, a hood over each, iron
 *              balconettes with the pots on them, a parapet in panels;
 *   'deco'   - Miami Deco (the boulevard, the beach, the island): eyebrows over the rows, bars
 *              across the glass, the neon along the parapet.
 */
export function dialectOf(ctx) {
  const b = ctx.block;
  if (!b) return 'deco';
  switch (b.district) {
    case 'havana':
      return 'havana';
    case 'downtown':
    case 'paintwood':
    case 'brickton':
      return 'walkup';
    default:
      return 'deco';
  }
}

// ------------------------------------------------------------------ colours
const C = (r, g, b) => srgb(r, g, b);
export const COL = {
  iron: C(0.16, 0.14, 0.2),
  ironRust: C(0.36, 0.22, 0.18),
  steel: C(0.62, 0.63, 0.66),
  steelDark: C(0.34, 0.35, 0.38),
  zinc: C(0.7, 0.71, 0.72),
  brass: C(0.82, 0.66, 0.3),
  white: C(0.97, 0.96, 0.93),
  cream: C(0.95, 0.9, 0.78),
  stone: C(0.9, 0.86, 0.78),
  dark: C(0.08, 0.07, 0.1),
  room: C(0.16, 0.12, 0.13),
  grime: C(0.42, 0.38, 0.36),
  rust: C(0.5, 0.33, 0.26),
  acBody: C(0.88, 0.88, 0.86),
  acGrille: C(0.42, 0.43, 0.46),
  pot: C(0.72, 0.4, 0.28),
  leaf: C(0.3, 0.58, 0.3),
  leaf2: C(0.22, 0.48, 0.3),
  bloom: [C(0.95, 0.3, 0.45), C(1.0, 0.82, 0.3), C(0.98, 0.98, 0.95), C(0.75, 0.4, 0.9), C(0.98, 0.5, 0.3)],
};
// the sash's paint, by dialect
const SASH = {
  walkup: [C(0.96, 0.95, 0.9), C(0.12, 0.12, 0.14), C(0.2, 0.3, 0.24), C(0.42, 0.2, 0.16), C(0.96, 0.95, 0.9)],
  havana: [C(0.97, 0.96, 0.92), C(0.97, 0.96, 0.92), C(0.36, 0.22, 0.14)],
  deco: [C(0.97, 0.96, 0.92), C(0.97, 0.96, 0.92), C(0.86, 0.88, 0.9)],
};
// the shutters of Little Havana: louvres painted a colour of their own
export const SHUTTERS = [C(0.2, 0.5, 0.42), C(0.22, 0.42, 0.62), C(0.52, 0.32, 0.2), C(0.15, 0.36, 0.3), C(0.85, 0.82, 0.74), C(0.62, 0.22, 0.24)];
// curtains, blinds
const CURTAINS = [C(0.96, 0.92, 0.82), C(0.98, 0.98, 0.96), C(0.92, 0.7, 0.72), C(0.72, 0.82, 0.92), C(0.75, 0.9, 0.8), C(0.98, 0.88, 0.6), C(0.62, 0.2, 0.24), C(0.22, 0.26, 0.42), C(0.9, 0.55, 0.3)];
// a board over a window
const BOARD = C(0.66, 0.5, 0.34);
// what hangs out to dry
const LAUNDRY = [C(0.95, 0.95, 0.92), C(0.9, 0.3, 0.32), C(0.3, 0.5, 0.85), C(0.98, 0.85, 0.35), C(0.4, 0.75, 0.5), C(0.95, 0.6, 0.75), C(0.25, 0.25, 0.3)];
// the sash's paint for a building of a dialect
export const sashFor = (dia, r) => r.pick(SASH[dia] || SASH.deco);
export const DOORS = [C(0.22, 0.14, 0.1), C(0.12, 0.12, 0.14), C(0.14, 0.3, 0.22), C(0.5, 0.12, 0.14), C(0.18, 0.26, 0.42), C(0.36, 0.24, 0.16)];

export const darker = (c, k = 0.78) => c.clone().multiplyScalar(k);
export const lighter = (c, k = 0.35) => c.clone().lerp(COL.white, k);

// ------------------------------------------------------------------ the wall round the windows
/**
 * The front wall as a skin R thick (w -R..0) over u0..u1, v0..v1, with holes where the windows
 * are ([u0, v0, u1, v1] each): a band of wall across where no window is, piers between the windows
 * where they are. The sides of the piers are the windows' reveals, the bands' undersides their
 * heads. o: { ends: false (no faces at u0 and u1: something stands against them) }
 */
export function skin(P, f, u0, u1, v0, v1, R, holes, col, id, o = {}) {
  const M = P.M;
  const ys = new Set([v0, v1]);
  for (const h of holes) {
    if (h[1] > v0 && h[1] < v1) ys.add(h[1]);
    if (h[3] > v0 && h[3] < v1) ys.add(h[3]);
  }
  const vs = [...ys].sort((a, b) => a - b);
  const endSkip = o.ends === false ? FB.LEFT | FB.RIGHT : 0;
  for (let i = 0; i + 1 < vs.length; i++) {
    const a = vs[i];
    const b = vs[i + 1];
    if (b - a < 1e-3) continue;
    const ym = (a + b) / 2;
    const cut = holes.filter((h) => h[1] < ym && h[3] > ym && h[2] > u0 && h[0] < u1).sort((p, q) => p[0] - q[0]);
    if (!cut.length) {
      P.box(M.wall, f, u0, a, -R, u1, b, 0, col, id, FB.BACK | endSkip);
      continue;
    }
    let u = u0;
    for (let k = 0; k < cut.length; k++) {
      const h = cut[k];
      if (h[0] - u > 0.004) P.box(M.wall, f, u, a, -R, h[0], b, 0, col, id, FB.BACK | FB.TOP | FB.BOTTOM | (k === 0 ? endSkip & FB.LEFT : 0));
      u = Math.max(u, h[2]);
    }
    if (u1 - u > 0.004) P.box(M.wall, f, u, a, -R, u1, b, 0, col, id, FB.BACK | FB.TOP | FB.BOTTOM | (endSkip & FB.RIGHT));
  }
}

// ------------------------------------------------------------------ a window in the wall
/**
 * A window in its hole u0..u1 x v0..v1 of a skin R deep: the glass at the back, the sash in it, a
 * sill standing out under it, a head over it, the life behind the glass.
 * o: { R, sash, stone (THREE.Color), head: 'keystone' | 'hood' | 'flat' | 'none',
 *   lights: 'two' (two over two, sliding up) | 'one' | 'casement' (two leaves, a fanlight) |
 *   'deco' (bars across), surround (a flat frame round it, in o.stone), shutters (a colour: open
 *   beside it), balconette, ac (an air conditioner in it), r (the building's dice), life (0..1:
 *   how likely there is something behind the glass), glassId }
 */
export function deepWindow(P, f, u0, v0, u1, v1, o) {
  const M = P.M;
  const r = o.r;
  const R = o.R;
  const ww = u1 - u0;
  const uc = (u0 + u1) / 2;
  const back = -R;
  const sash = o.sash || COL.white;
  const stone = o.stone || COL.stone;
  // (where the gangs are, a window boarded up now and then, as world/deco.js lived() boarded them on
  // the flat walls of before: the plywood nailed over the hole, two battens across it, its sill;
  // nobody's light behind it)
  if (o.boarded) {
    const bid = nextId();
    P.box(M.frame, f, u0 - 0.05, v0 - 0.02, -0.03, u1 + 0.05, v1 + 0.02, 0.022, BOARD, bid, FB.BACK);
    for (const k of [0.22, 0.78]) P.box(M.frame, f, u0 - 0.02, v0 + (v1 - v0) * k - 0.05, 0.022, u1 + 0.02, v0 + (v1 - v0) * k + 0.05, 0.04, darker(BOARD, 0.8), bid, FB.BACK);
    P.box(M.frame, f, u0 - 0.1, v0 - 0.1, back, u1 + 0.1, v0 - 0.02, 0.1, stone, nextId(), FB.BACK);
    return;
  }
  // the glass, at the back of the hole (each its own: some rooms are lit and some are not)
  P.pane(M.winGlass, f, u0, v0, u1, v1, back + 0.008, COL.white, o.glassId || nextId());
  // the sash: its stiles and rails, standing a little out of the glass
  const sid = nextId();
  const t = 0.065;
  const sw = back + 0.06;
  P.box(M.frame, f, u0, v0, back, u0 + t, v1, sw, sash, sid, FB.BACK | FB.TOP | FB.BOTTOM);
  P.box(M.frame, f, u1 - t, v0, back, u1, v1, sw, sash, sid, FB.BACK | FB.TOP | FB.BOTTOM);
  P.box(M.frame, f, u0 + t, v1 - t, back, u1 - t, v1, sw, sash, sid, FB.BACK | FB.LEFT | FB.RIGHT | FB.TOP);
  P.box(M.frame, f, u0 + t, v0, back, u1 - t, v0 + 0.09, sw, sash, sid, FB.BACK | FB.LEFT | FB.RIGHT | FB.BOTTOM);
  const lights = o.lights || 'two';
  const vm = v0 + (v1 - v0) * (lights === 'casement' ? 0.74 : 0.52);
  // the life behind the glass, by the building's dice: curtains drawn, a blind half down, the
  // lower sash pushed up open (the dark of the room under it), now and then nothing at all
  let open = false;
  if (r && !o.ac) {
    const q = r();
    if (q < (o.life !== undefined ? o.life : 0.55)) {
      const k = r();
      const cw = back + 0.032;
      if (k < 0.4) {
        // curtains, to the sides or across
        const col = CURTAINS[Math.floor(r() * CURTAINS.length)];
        const a = ww * (0.18 + r() * 0.2);
        P.box(M.prop, f, u0 + t, v0 + 0.09, cw - 0.008, u0 + t + a, v1 - t, cw, col, nextId(), FB.BACK);
        if (r() < 0.7) P.box(M.prop, f, u1 - t - a * (0.7 + r() * 0.5), v0 + 0.09, cw - 0.008, u1 - t, v1 - t, cw, col, nextId(), FB.BACK);
        // (a pelmet over them)
        if (r() < 0.4) P.box(M.prop, f, u0 + t, v1 - t - 0.12, cw - 0.008, u1 - t, v1 - t, cw + 0.006, col.clone().multiplyScalar(0.85), nextId(), FB.BACK);
      } else if (k < 0.72) {
        // a blind, half down, its slats (their faces only: SLAT_FACE)
        const yb = v1 - (v1 - v0) * (0.25 + r() * 0.45);
        const col = r() < 0.6 ? C(0.95, 0.92, 0.84) : r() < 0.5 ? C(0.86, 0.86, 0.84) : C(0.55, 0.42, 0.3);
        const bid = nextId();
        P.box(M.prop, f, u0 + t, yb, cw - 0.008, u1 - t, v1 - t, cw, col, bid, FB.BACK);
        if (!LOW) {
          const sc = col.clone().multiplyScalar(0.8);
          for (let v = yb + 0.2; v < v1 - t - 0.05; v += 0.3) P.box(M.prop, f, u0 + t, v, cw, u1 - t, v + SLAT, cw + 0.008, sc, bid, SLAT_FACE);
        }
      } else if (k < 0.86 && lights !== 'deco') {
        // the lower sash pushed up: the room's dark under it, a curtain stirring in it
        open = true;
        const yo = v0 + 0.09 + (vm - v0) * (0.45 + r() * 0.4);
        P.box(M.prop, f, u0 + t, v0 + 0.09, back + 0.02, u1 - t, yo, back + 0.028, COL.room, nextId(), FB.BACK);
        P.box(M.frame, f, u0 + t, yo - 0.05, back + 0.04, u1 - t, yo + 0.02, back + 0.1, sash, sid, FB.BACK);
        if (r() < 0.5) P.box(M.prop, f, u0 + t + 0.05, v0 + 0.12, back + 0.03, u0 + t + ww * 0.3, yo - 0.05, back + 0.038, CURTAINS[Math.floor(r() * CURTAINS.length)], nextId(), FB.BACK);
      } else {
        // a plant on the sill inside, against the glass
        const pc = u0 + t + 0.15 + r() * Math.max(0.01, ww - 2 * t - 0.3);
        P.box(M.prop, f, pc - 0.09, v0 + 0.09, cw - 0.008, pc + 0.09, v0 + 0.25, cw + 0.02, COL.pot, nextId(), FB.BACK);
        P.box(M.leaf, f, pc - 0.16, v0 + 0.25, cw - 0.008, pc + 0.16, v0 + 0.52, cw + 0.03, r() < 0.5 ? COL.leaf : COL.leaf2, nextId(), FB.BACK);
      }
    }
  }
  // the bars of the glass
  if (lights === 'two' || lights === 'one') {
    // the meeting rail of the two sashes (the upper one in front), and a bar down each (two over two)
    if (!open) P.box(M.frame, f, u0 + t, vm - 0.03, back, u1 - t, vm + 0.03, sw + 0.02, sash, sid, FB.BACK | FB.LEFT | FB.RIGHT);
    if (lights === 'two' && ww > 0.8) P.box(M.frame, f, uc - 0.022, v0 + 0.09, back, uc + 0.022, v1 - t, sw - 0.01, sash, sid, FB.BACK | FB.TOP | FB.BOTTOM);
  } else if (lights === 'casement') {
    // two leaves and the fanlight over them
    P.box(M.frame, f, u0 + t, vm - 0.035, back, u1 - t, vm + 0.035, sw, sash, sid, FB.BACK | FB.LEFT | FB.RIGHT);
    P.box(M.frame, f, uc - 0.035, v0 + 0.09, back, uc + 0.035, vm - 0.035, sw, sash, sid, FB.BACK | FB.TOP | FB.BOTTOM);
    if (!LOW && ww > 1.0) for (const k of [-1, 1]) P.box(M.frame, f, uc + k * ww * 0.25 - 0.016, vm + 0.035, back, uc + k * ww * 0.25 + 0.016, v1 - t, sw - 0.01, sash, sid, FB.BACK | FB.TOP | FB.BOTTOM);
  } else if (lights === 'deco') {
    for (const k of [0.3, 0.55, 0.8]) P.box(M.frame, f, u0 + t, v0 + (v1 - v0) * k - 0.02, back, u1 - t, v0 + (v1 - v0) * k + 0.02, sw, sash, sid, FB.BACK | FB.LEFT | FB.RIGHT);
  }
  // an air conditioner in the lower sash, sticking out over the street, its bracket under it
  if (o.ac) {
    const aw = Math.min(0.72, ww - 0.2);
    const ay0 = v0 + 0.1;
    const ay1 = ay0 + 0.42;
    const aid = nextId();
    P.box(M.steel, f, uc - aw / 2, ay0, back + 0.02, uc + aw / 2, ay1, 0.34, COL.acBody, aid, FB.BACK);
    P.box(M.frame, f, uc - aw / 2 + 0.05, ay0 + 0.05, 0.34, uc + aw / 2 - 0.05, ay1 - 0.06, 0.355, COL.acGrille, aid, FB.BACK);
    // the panel either side filling the open sash, the sash down on top of it
    P.box(M.frame, f, u0 + t, ay0, back + 0.01, u1 - t, ay1 + 0.02, back + 0.03, C(0.82, 0.8, 0.74), aid, FB.BACK);
    P.box(M.frame, f, u0 + t, ay1 + 0.02, back + 0.03, u1 - t, ay1 + 0.08, back + 0.09, sash, sid, FB.BACK);
    for (const k of [-0.32, 0.32]) P.bar(M.frame, f.p(uc + k * aw, v0 - 0.42, 0.01), f.p(uc + k * aw, ay0 - 0.01, 0.3), 0.035, COL.ironRust, aid);
    // (what it drips has drawn a streak down the wall: no further than a metre, so that it stops on
    // the wall over the head of the window under it - longer, it hung in the air across that one's
    // hole, the wall set back behind it)
    if (r && r() < 0.6) P.box(M.frame, f, uc - 0.05 + (r() - 0.5) * 0.2, v0 - 0.12 - (0.45 + r() * 0.55), 0.0, uc + 0.04 + (r() - 0.5) * 0.2, v0 - 0.12, 0.014, COL.grime, nextId(), FB.BACK);
  }
  // the sill: stone, from the back of the hole out over the wall
  const sillId = nextId();
  P.box(M.frame, f, u0 - 0.1, v0 - 0.1, back, u1 + 0.1, v0 + 0.005, 0.1, stone, sillId, FB.BACK);
  // a flat frame of stone round it (an architrave)
  if (o.surround) {
    const s = 0.13;
    P.box(M.frame, f, u0 - s, v0, 0, u0, v1, 0.035, stone, sillId, FB.BACK | FB.TOP | FB.BOTTOM);
    P.box(M.frame, f, u1, v0, 0, u1 + s, v1, 0.035, stone, sillId, FB.BACK | FB.TOP | FB.BOTTOM);
  }
  // the head
  const head = o.head || 'flat';
  if (head === 'keystone') {
    const hid = nextId();
    P.box(M.frame, f, u0 - 0.14, v1, 0, u1 + 0.14, v1 + 0.2, 0.045, stone, hid, FB.BACK);
    P.box(M.frame, f, uc - 0.1, v1 - 0.05, 0, uc + 0.1, v1 + 0.27, 0.075, stone.clone().multiplyScalar(0.94), nextId(), FB.BACK);
  } else if (head === 'hood') {
    const hid = nextId();
    P.box(M.frame, f, u0 - 0.13, v1, 0, u1 + 0.13, v1 + 0.13, 0.05, stone, hid, FB.BACK);
    P.box(M.frame, f, u0 - 0.22, v1 + 0.13, 0, u1 + 0.22, v1 + 0.24, 0.2, stone, hid, FB.BACK);
    // its two brackets
    if (!LOW) for (const u of [u0 - 0.16, u1 + 0.1]) P.box(M.frame, f, u, v1 - 0.18, 0, u + 0.06, v1 + 0.13, 0.12, stone.clone().multiplyScalar(0.92), hid, FB.BACK);
  } else if (head === 'flat') {
    P.box(M.frame, f, u0 - 0.07, v1, 0, u1 + 0.07, v1 + 0.15, 0.03, stone, nextId(), FB.BACK);
  }
  // shutters folded back either side of it (Little Havana's persianas)
  if (o.shutters) {
    const sc = o.shutters;
    const shw = Math.min(ww / 2 + 0.04, 0.62);
    for (const sd of [-1, 1]) {
      const a = sd < 0 ? u0 - (o.surround ? 0.13 : 0) - 0.03 - shw : u1 + (o.surround ? 0.13 : 0) + 0.03;
      const shid = nextId();
      P.box(M.frame, f, a, v0 + 0.02, 0, a + shw, v1 - 0.02, 0.045, sc, shid, FB.BACK);
      // the louvres: the rails across, the stile down the middle
      if (!LOW) {
        for (let v = v0 + 0.3; v < v1 - 0.2; v += 0.48) P.box(M.frame, f, a + 0.05, v, 0.045, a + shw - 0.05, v + 0.035, 0.06, sc.clone().multiplyScalar(0.8), shid, FB.BACK | FB.LEFT | FB.RIGHT);
      }
    }
  }
  // an iron balconette in front of it, the pots on it, now and then the washing over its rail
  if (o.balconette) balconette(P, f, u0 - 0.28, u1 + 0.28, v0 - 0.12, o);
}

// a shallow iron balcony in front of a window: its slab, the rail, the bars, life on it
export function balconette(P, f, u0, u1, y, o = {}) {
  const M = P.M;
  const r = o.r;
  const iron = o.iron || COL.iron;
  const d = o.depth || 0.5;
  const bid = nextId();
  P.box(M.frame, f, u0, y - 0.1, 0, u1, y, d, o.slab || COL.stone, bid, FB.BACK);
  const rid = nextId();
  const rh = 0.95;
  P.box(M.frame, f, u0, y + rh - 0.04, d - 0.05, u1, y + rh, d, iron, rid, FB.BACK);
  P.box(M.frame, f, u0, y + 0.08, d - 0.04, u1, y + 0.12, d - 0.01, iron, rid, FB.BACK);
  for (const u of [u0, u1 - 0.04]) P.box(M.frame, f, u, y, 0, u + 0.04, y + rh, d, iron, rid, FB.BACK | FB.BOTTOM);
  const step = LOW ? 0.32 : 0.2;
  for (let u = u0 + step; u < u1 - 0.05; u += step) P.box(M.prop, f, u - 0.012, y, d - 0.035, u + 0.012, y + rh - 0.04, d - 0.012, iron, rid, FB.BACK | FB.BOTTOM | FB.TOP);
  if (!r) return;
  // the pots along it
  const q = r();
  if (q < 0.55) {
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const pc = u0 + 0.25 + (u1 - u0 - 0.5) * ((k + 0.5) / n) + (r() - 0.5) * 0.15;
      const ph = 0.2 + r() * 0.12;
      P.box(M.prop, f, pc - 0.11, y, d * 0.3, pc + 0.11, y + ph, d * 0.3 + 0.22, k % 2 ? COL.pot : C(0.86, 0.84, 0.8), nextId(), FB.BOTTOM);
      const bloom = r() < 0.5;
      P.box(M.leaf, f, pc - 0.17, y + ph, d * 0.3 - 0.05, pc + 0.17, y + ph + 0.22 + r() * 0.25, d * 0.3 + 0.27, bloom ? COL.bloom[Math.floor(r() * COL.bloom.length)] : COL.leaf, nextId(), 0);
    }
  } else if (q < 0.75) {
    // the washing over the rail
    let u = u0 + 0.15;
    while (u < u1 - 0.4) {
      const w = 0.3 + r() * 0.35;
      const h = 0.3 + r() * 0.35;
      P.box(M.prop, f, u, y + rh - h, d + 0.005, u + w, y + rh + 0.02, d + 0.03, LAUNDRY[Math.floor(r() * LAUNDRY.length)], nextId(), FB.BACK);
      u += w + 0.08 + r() * 0.25;
      if (r() < 0.3) break;
    }
  } else if (q < 0.85 && u1 - u0 > 1.2) {
    // a folding chair, against the wall
    const cu = u0 + 0.3 + r() * (u1 - u0 - 0.9);
    const cc = r() < 0.5 ? C(0.85, 0.2, 0.2) : C(0.92, 0.92, 0.9);
    const cid = nextId();
    P.box(M.prop, f, cu, y + 0.42, 0.06, cu + 0.42, y + 0.46, 0.4, cc, cid, 0);
    P.box(M.prop, f, cu, y + 0.46, 0.04, cu + 0.42, y + 0.9, 0.08, cc, cid, 0);
    for (const du of [0.03, 0.36]) P.box(M.prop, f, cu + du, y, 0.36, cu + du + 0.03, y + 0.42, 0.39, cc, cid, FB.BOTTOM);
  }
}

// ------------------------------------------------------------------ the bands of stone
// a band standing out of the wall along u0..u1 at v0..v1, out w (a string course, a sill course)
export function band(P, f, u0, u1, v0, v1, out, col, id = nextId(), mat = null) {
  P.box(mat || P.M.wall, f, u0, v0, 0, u1, v1, out, col, id, FB.BACK);
  return id;
}

/**
 * A cornice along the top of a front: a frieze under it, its brackets (or blocks) under a slab
 * that stands well out, a crown along its edge. v: the bottom of the frieze. o: { style:
 * 'brackets' | 'blocks' | 'plain', out, step }
 * returns the top of it
 */
export function cornice(P, f, u0, u1, v, col, o = {}) {
  const M = P.M;
  const out = o.out || 0.55;
  const id = nextId();
  const fr = o.frieze !== undefined ? o.frieze : 0.42;
  // the frieze, a fillet under it
  P.box(M.wall, f, u0, v, 0, u1, v + fr, 0.06, col, id, FB.BACK);
  P.box(M.wall, f, u0 - 0.03, v - 0.06, 0, u1 + 0.03, v, 0.1, darker(col, 0.92), id, FB.BACK);
  const y0 = v + fr;
  // the slab
  P.box(M.wall, f, u0 - 0.12, y0 + 0.16, 0, u1 + 0.12, y0 + 0.36, out, col, id, FB.BACK);
  P.box(M.wall, f, u0 - 0.16, y0 + 0.36, 0, u1 + 0.16, y0 + 0.46, out + 0.06, lighter(col, 0.25), nextId(), FB.BACK);
  // under it, its brackets, or a row of blocks (dentils)
  const style = o.style || 'brackets';
  if (style === 'brackets') {
    const step = o.step || 0.85;
    const n = Math.max(2, Math.round((u1 - u0) / step));
    const bid = nextId();
    for (let k = 0; k <= n; k++) {
      const u = u0 + 0.08 + ((u1 - u0 - 0.16) * k) / n;
      P.box(M.wall, f, u - 0.07, y0 - 0.28, 0.06, u + 0.07, y0 + 0.16, out - 0.1, darker(col, 0.9), bid, FB.BACK);
    }
    P.box(M.wall, f, u0, y0, 0, u1, y0 + 0.16, 0.14, col, id, FB.BACK);
  } else if (style === 'blocks' && !LOW) {
    const n = Math.max(2, Math.round((u1 - u0) / 0.32));
    const bid = nextId();
    P.box(M.wall, f, u0, y0, 0, u1, y0 + 0.16, 0.1, col, id, FB.BACK);
    for (let k = 0; k < n; k++) {
      const u = u0 + ((u1 - u0) * (k + 0.5)) / n;
      P.box(M.wall, f, u - 0.07, y0 + 0.02, 0.1, u + 0.07, y0 + 0.16, 0.22, darker(col, 0.92), bid, FB.BACK | FB.TOP);
    }
  } else P.box(M.wall, f, u0, y0, 0, u1, y0 + 0.16, 0.2, col, id, FB.BACK);
  return y0 + 0.46;
}

// ------------------------------------------------------------------ the pipes, the meters
// the pipe down from the roof: its head under the cornice, the clips holding it, its shoe
export function downpipe(P, f, u, vTop, vBot, col, o = {}) {
  const M = P.M;
  const w0 = o.w || 0;
  const id = nextId();
  P.box(M.frame, f, u - 0.17, vTop - 0.32, w0, u + 0.17, vTop, w0 + 0.22, col, id, FB.BACK);
  P.box(M.frame, f, u - 0.055, vBot + 0.25, w0 + 0.03, u + 0.055, vTop - 0.32, w0 + 0.14, col, id, FB.BACK | FB.TOP);
  P.box(M.frame, f, u - 0.06, vBot, w0 + 0.03, u + 0.06, vBot + 0.25, w0 + 0.3, col, id, FB.BACK);
  if (!LOW) for (let v = vBot + 1.6; v < vTop - 0.6; v += 1.9) P.box(M.frame, f, u - 0.08, v, w0, u + 0.08, v + 0.06, w0 + 0.16, darker(col, 0.8), id, FB.BACK);
  return id;
}

// the meters by the door: grey boxes with a window each, the pipes from them into the ground
export function meters(P, f, u0, v0, n, o = {}) {
  const M = P.M;
  const id = nextId();
  const gas = o.gas;
  const body = gas ? C(0.86, 0.84, 0.78) : COL.steel;
  for (let k = 0; k < n; k++) {
    const u = u0 + k * 0.32;
    P.box(M.steel, f, u, v0, 0, u + 0.26, v0 + 0.36, 0.17, body, id, FB.BACK);
    P.box(M.frame, f, u + 0.06, v0 + 0.17, 0.17, u + 0.2, v0 + 0.29, 0.185, C(0.82, 0.88, 0.9), nextId(), FB.BACK);
    P.box(M.frame, f, u + 0.11, CURB, 0.04, u + 0.15, v0, 0.09, gas ? C(0.86, 0.72, 0.2) : COL.steelDark, id, FB.BACK | FB.BOTTOM);
  }
  // the conduit up from them, into the wall
  P.box(M.frame, f, u0 + 0.1, v0 + 0.36, 0.04, u0 + 0.15, v0 + 1.2, 0.09, COL.steelDark, id, FB.BACK);
  return id;
}

// a lamp on the wall by a door (lit at night by its glass)
export function wallLamp(P, f, u, v, o = {}) {
  const M = P.M;
  const id = nextId();
  const body = o.body || COL.iron;
  P.box(M.frame, f, u - 0.06, v - 0.05, 0, u + 0.06, v + 0.05, 0.18, body, id, FB.BACK);
  P.box(M.lampGlass, f, u - 0.1, v - 0.32, 0.12, u + 0.1, v - 0.05, 0.32, COL.white, nextId(), 0);
  P.box(M.frame, f, u - 0.13, v - 0.05, 0.09, u + 0.13, v + 0.02, 0.35, body, id, 0);
  return id;
}

// ------------------------------------------------------------------ the door to the flats
/**
 * The door to the flats beside a shop (or a house's): in its hole u0..u1 (CURB to vTop) set R
 * back, a door of panels, its casing, the fanlight over it, the number, the bells and the slot
 * for the letters, a lamp, the step. The hole's wall is the caller's.
 * o: { R, door (colour), casing (colour), dialect, r, number: true, lamp: 'left' | 'right' | null,
 *   bells: 'left' | 'right' | null }
 */
export function flatsDoor(P, f, u0, u1, vTop, o) {
  const M = P.M;
  const R = o.R || 0.2;
  const back = -R;
  const dc = o.door || DOORS[0];
  const cas = o.casing || COL.white;
  const uc = (u0 + u1) / 2;
  const dTop = Math.min(vTop - 0.5, CURB + 2.3);
  // (the stair hall's dark behind the leaf and the fanlight: the room of the shop next door shows
  // through no slit beside them; its back left out, where the shop's own wall stands)
  P.box(M.frame, f, u0, CURB, back - 0.03, u1, vTop, back - 0.025, COL.room, nextId(), FB.BACK);
  // the fanlight over the door, its bars
  P.pane(M.winGlass, f, u0 + 0.06, dTop + 0.08, u1 - 0.06, vTop - 0.06, back + 0.01, COL.white, nextId());
  const fid = nextId();
  P.box(M.frame, f, u0, dTop, back, u1, dTop + 0.08, back + 0.08, cas, fid, FB.BACK);
  if (!LOW) for (const k of [0.33, 0.66]) P.box(M.frame, f, u0 + (u1 - u0) * k - 0.02, dTop + 0.08, back + 0.01, u0 + (u1 - u0) * k + 0.02, vTop - 0.06, back + 0.05, cas, fid, FB.BACK);
  // the door: its leaf, two panels raised on it (the upper one glass on a walk-up), the kick plate
  const did = nextId();
  P.box(M.frame, f, u0 + 0.05, CURB, back, u1 - 0.05, dTop, back + 0.05, dc, did, FB.BACK);
  const pa = u0 + 0.16;
  const pb = u1 - 0.16;
  if (o.dialect === 'walkup') {
    P.pane(M.winGlass, f, pa, CURB + 1.2, pb, dTop - 0.16, back + 0.052, COL.white, nextId());
    P.box(M.frame, f, pa - 0.03, CURB + 1.17, back + 0.05, pb + 0.03, CURB + 1.2, back + 0.07, dc, did, FB.BACK);
  } else P.box(M.frame, f, pa, CURB + 1.25, back + 0.05, pb, dTop - 0.15, back + 0.075, darker(dc, 0.85), did, FB.BACK);
  P.box(M.frame, f, pa, CURB + 0.32, back + 0.05, pb, CURB + 1.05, back + 0.075, darker(dc, 0.85), did, FB.BACK);
  P.box(M.prop, f, u0 + 0.07, CURB + 0.02, back + 0.05, u1 - 0.07, CURB + 0.24, back + 0.06, COL.brass, nextId(), FB.BACK);
  // the slot for the letters, the knob
  P.box(M.prop, f, uc - 0.16, CURB + 1.1, back + 0.05, uc + 0.16, CURB + 1.16, back + 0.065, COL.brass, nextId(), FB.BACK);
  P.box(M.prop, f, u1 - 0.18, CURB + 0.98, back + 0.05, u1 - 0.12, CURB + 1.06, back + 0.12, COL.brass, nextId(), FB.BACK);
  // the casing round the hole, on the wall's face
  const cid = nextId();
  P.box(M.frame, f, u0 - 0.14, CURB, 0, u0, vTop + 0.12, 0.05, cas, cid, FB.BACK);
  P.box(M.frame, f, u1, CURB, 0, u1 + 0.14, vTop + 0.12, 0.05, cas, cid, FB.BACK);
  P.box(M.frame, f, u0 - 0.2, vTop + 0.12, 0, u1 + 0.2, vTop + 0.26, 0.14, cas, cid, FB.BACK);
  // the step
  P.box(M.prop, f, u0 - 0.1, CURB, back, u1 + 0.1, CURB + 0.14, 0.32, COL.stone, nextId(), FB.BACK);
  // the number: gilt on the fanlight's glass (the old walk-ups'), or brass on a plate over it
  if (o.number !== false) {
    const nid = nextId();
    const digits = 2 + Math.floor((o.r ? o.r() : 0.5) * 2);
    const onGlass = o.number !== 'plate' && vTop - dTop > 0.32;
    const nv0 = onGlass ? dTop + 0.14 : vTop + 0.3;
    const nh = onGlass ? Math.min(0.2, vTop - dTop - 0.26) : 0.12;
    const nw = onGlass ? back + 0.014 : 0.02;
    if (!onGlass) P.box(M.prop, f, uc - 0.2, vTop + 0.27, 0, uc + 0.2, vTop + 0.45, 0.02, COL.dark, nid, FB.BACK);
    for (let k = 0; k < digits; k++) {
      const u = uc - (digits - 1) * 0.06 + k * 0.12;
      P.box(M.prop, f, u - 0.032, nv0, nw, u + 0.032, nv0 + nh, nw + 0.008, onGlass ? C(0.95, 0.8, 0.4) : COL.brass, nid, FB.BACK);
    }
  }
  // the bells beside it: a plate of buttons, the speaker over them
  if (o.bells) {
    const bu = o.bells === 'left' ? u0 - 0.42 : u1 + 0.2;
    const bid = nextId();
    P.box(M.prop, f, bu, CURB + 1.25, 0, bu + 0.2, CURB + 1.72, 0.03, COL.steel, bid, FB.BACK);
    P.box(M.prop, f, bu + 0.04, CURB + 1.55, 0.03, bu + 0.16, CURB + 1.67, 0.04, COL.steelDark, bid, FB.BACK);
    if (!LOW) for (let k = 0; k < 4; k++) P.box(M.prop, f, bu + 0.06, CURB + 1.3 + k * 0.055, 0.03, bu + 0.14, CURB + 1.33 + k * 0.055, 0.042, COL.cream, bid, FB.BACK);
  }
  if (o.lamp === 'over') wallLamp(P, f, uc, vTop + 0.72, { body: o.lampBody });
  else if (o.lamp) wallLamp(P, f, o.lamp === 'left' ? u0 - 0.36 : u1 + 0.36, vTop + 0.05, { body: o.lampBody });
}

// ------------------------------------------------------------------ the fire escape
const FH = 3.6;
const GROUND = 4.4;
/**
 * The fire escape down the front of an old walk-up (the iron that New York is drawn in): a landing
 * of grating at every floor over the shop, its railing of thin bars, the stairs from each down to
 * the one under it with their rail, the brackets under them into the wall, and from the lowest one
 * a ladder hung up over the sidewalk. Between a and b along the front.
 * o: { iron, out (how far it stands out), base (the ground floor's height), fh }
 */
export function fireStairs(P, f, a, b, floors, o = {}) {
  const M = P.M;
  const iron = o.iron || COL.iron;
  const d = o.out || 1.2;
  const fh = o.fh || FH;
  const base = o.base || GROUND;
  const id = nextId();
  const bid = nextId();
  const step = LOW ? 0.3 : 0.15;
  const yAt = (fl) => CURB + base + (fl - 1) * fh + 0.55;
  for (let fl = 1; fl < floors; fl++) {
    const y = yAt(fl);
    // the landing, a grating: its frame and the slats across it
    P.box(M.frame, f, a, y - 0.08, 0, b, y - 0.02, d, iron, id, FB.BACK);
    if (!LOW) for (let w = 0.12; w < d - 0.05; w += 0.14) P.box(M.frame, f, a + 0.04, y - 0.02, w - 0.015, b - 0.04, y, w + 0.015, iron, bid, FB.BACK | FB.BOTTOM | FB.LEFT | FB.RIGHT);
    // the railing: its top rail and a middle one, round the three sides
    P.box(M.frame, f, a, y + 0.98, d - 0.05, b, y + 1.03, d, iron, id, FB.BACK);
    P.box(M.frame, f, a, y + 0.48, d - 0.04, b, y + 0.51, d - 0.01, iron, id, FB.BACK);
    for (const u of [a, b - 0.05]) {
      P.box(M.frame, f, u, y + 0.98, 0, u + 0.05, y + 1.03, d, iron, id, FB.BACK);
      P.box(M.frame, f, u, y - 0.02, d - 0.05, u + 0.05, y + 1.03, d, iron, id, FB.BACK | FB.BOTTOM);
      for (let w = 0.2; w < d - 0.1; w += step * 1.6) P.box(M.prop, f, u + 0.013, y, w - 0.012, u + 0.037, y + 0.98, w + 0.012, iron, bid, FB.TOP | FB.BOTTOM);
    }
    for (let u = a + step; u < b - 0.08; u += step) P.box(M.prop, f, u - 0.012, y, d - 0.037, u + 0.012, y + 0.98, d - 0.013, iron, bid, FB.BACK | FB.TOP | FB.BOTTOM);
    // the brackets under it, back into the wall
    for (const u of [a + 0.25, b - 0.25]) P.bar(M.frame, f.p(u, y - 0.75, 0.02), f.p(u, y - 0.1, d - 0.12), 0.05, iron, id);
    // the stairs down to the landing under it (from the second floor up): two stringers, the
    // treads between them, a rail
    if (fl > 1) {
      const yl = yAt(fl - 1);
      const ua = b - 0.45;
      const ub = a + 0.55;
      const w0 = 0.16;
      const w1 = 0.72;
      for (const w of [w0, w1]) P.bar(M.frame, f.p(ua, yl + 0.02, w), f.p(ub, y - 0.06, w), 0.07, iron, id);
      const n = LOW ? 6 : 11;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const u = ua + (ub - ua) * t;
        const v = yl + (y - yl) * t;
        P.box(M.frame, f, u - 0.1, v - 0.02, w0 + 0.03, u + 0.1, v + 0.01, w1 - 0.03, iron, bid, FB.BOTTOM);
      }
      P.bar(M.frame, f.p(ua, yl + 0.95, w1 + 0.05), f.p(ub, y + 0.9, w1 + 0.05), 0.04, iron, id);
    }
  }
  // the ladder hung up under the lowest landing (it drops to the sidewalk when somebody needs it)
  if (floors > 1) {
    const y = yAt(1);
    const lu = o.ladderU !== undefined ? o.ladderU : b - 0.6;
    const lw = d - 0.3;
    const v0 = y - 2.1;
    for (const k of [-0.2, 0.2]) P.box(M.frame, f, lu + k - 0.025, v0, lw - 0.025, lu + k + 0.025, y + 0.95, lw + 0.025, iron, id, 0);
    for (let v = v0 + 0.15; v < y - 0.1; v += 0.3) P.box(M.prop, f, lu - 0.2, v - 0.015, lw - 0.015, lu + 0.2, v + 0.015, lw + 0.015, iron, bid, FB.LEFT | FB.RIGHT);
  }
  return id;
}

// ------------------------------------------------------------------ the shops' fronts
// The kick plate under a shop's glass used to run right across its door, a wall up to the knee that
// every shopper walked in through. It stops in the jambs now (they stand at the door's middle -+
// 0.7..0.78: the plate ends inside them, so that no two faces lie in one plane), and the doorway
// has a sill of its own, worn metal flush with the sidewalk (doorSill: the kits' own fbox draws it).
export const plateSpans = (sg0, sg1, uDoor) => [[sg0, uDoor - 0.74], [uDoor + 0.74, sg1]].filter(([a, b]) => b - a > 0.02);
export const SILL = C(0.6, 0.58, 0.55);
export const doorSill = (box, uDoor) => box(uDoor - 0.7, CURB, -0.25, uDoor + 0.7, CURB + 0.025, 0.1);

/**
 * A shop front's hardware: the box of the roll-down shutter over the glass and its runners down
 * either side, the bar to push the door, a sticker or two on the glass (the hours, a poster).
 * o: { r, top (the box's bottom), door (u), doorW (half its width), housing: false, stickers }
 */
export function shopHardware(P, f, sg0, sg1, o) {
  const M = P.M;
  const r = o.r;
  if (o.housing !== false) {
    const hid = nextId();
    const v0 = o.top !== undefined ? o.top : 3.55;
    const hc = o.housingCol || COL.steel;
    P.box(M.steel, f, sg0 - 0.08, v0, 0, sg1 + 0.08, v0 + 0.3, 0.24, hc, hid, FB.BACK);
    P.box(M.frame, f, sg0 - 0.12, v0 + 0.02, 0, sg0 - 0.04, v0 + 0.28, 0.26, darker(hc, 0.8), hid, FB.BACK);
    P.box(M.frame, f, sg1 + 0.04, v0 + 0.02, 0, sg1 + 0.12, v0 + 0.28, 0.26, darker(hc, 0.8), hid, FB.BACK);
    // the runners the shutter comes down in
    for (const u of [sg0 - 0.07, sg1 + 0.01]) P.box(M.frame, f, u, CURB + 0.05, 0, u + 0.06, v0, 0.09, COL.steelDark, hid, FB.BACK | FB.TOP);
    // (a padlock's hasp at the foot of it)
    P.box(M.prop, f, (sg0 + sg1) / 2 - 0.05, CURB + 0.02, 0.18, (sg0 + sg1) / 2 + 0.05, CURB + 0.08, 0.24, COL.steelDark, nextId(), 0);
  }
  // the doormat before the open door
  if (o.door !== undefined) {
    const d = o.door;
    P.box(M.prop, f, d - 0.55, CURB, 0.25, d + 0.55, CURB + 0.02, 0.85, C(0.3, 0.26, 0.24), nextId(), FB.BOTTOM);
  }
  // stickers on the glass: the hours by the door, a poster in a pane
  if (r && o.stickers !== false && P.ctx.atlas) {
    const d = o.door !== undefined ? o.door : (sg0 + sg1) / 2;
    if (r() < 0.55) {
      const left = d - 0.95 > sg0 + 0.3;
      P.sticker(f, r() < 0.5 ? 'open24' : 'ch_open', left ? d - 1.15 : d + 1.15, CURB + 1.55, 0.085, 0.6, 0.15);
    }
    const posters = P.ctx.posters;
    if (posters && posters.length && r() < 0.45) {
      const a = r() < 0.5 ? sg0 + 0.55 : sg1 - 0.55;
      if (Math.abs(a - d) > 1.3) P.sticker(f, posters[Math.floor(r() * posters.length)], a, CURB + 1.85, 0.085, 0.58, 0.29);
    }
  }
}

// a sign standing out of the front on its bracket, the shop's name on both its faces
export function bladeSign(P, f, u, v, text, col, o = {}) {
  const ctx = P.ctx;
  const M = P.M;
  const len = o.len || 1.05;
  const hgt = o.h || 0.62;
  const w0 = o.w0 || 0.25;
  const iron = COL.iron;
  const id = nextId();
  // the bracket: an arm out of the wall over the board, a stay under it
  P.box(M.frame, f, u - 0.03, v + hgt / 2 + 0.02, 0, u + 0.03, v + hgt / 2 + 0.08, w0 + len + 0.12, iron, id, FB.BACK);
  P.box(M.frame, f, u - 0.06, v - hgt / 2 - 0.12, 0, u + 0.06, v + hgt / 2 + 0.12, 0.05, iron, id, FB.BACK);
  // the board, hung from the arm
  const board = o.board || COL.dark;
  P.box(M.frame, f, u - 0.05, v - hgt / 2, w0, u + 0.05, v + hgt / 2, w0 + len, board, nextId(), 0);
  for (const k of [0.15, len - 0.15]) P.box(M.frame, f, u - 0.012, v + hgt / 2, w0 + k - 0.012, u + 0.012, v + hgt / 2 + 0.03, w0 + k + 0.012, iron, id, 0);
  // the name on both faces (the same letters as the sign over the window: no new place in the
  // neon's picture)
  if (!text || !ctx.neon) return;
  const rr = ctx.neon.add(text, { font: o.font || 'Caveat', size: o.size || 75, italic: o.italic });
  if (!rr) return;
  const tw = len * 0.94;
  const th = tw / 4;
  for (const sd of [-1, 1]) {
    const uu = u + sd * 0.056;
    const n = [f.ux * sd, 0, f.uz * sd];
    // (read from where it faces, left to right: the right hand of someone looking at it is up x n)
    let wa = w0 + (len - tw) / 2;
    let wb = w0 + (len + tw) / 2;
    const rx = n[2];
    const rz = -n[0];
    if ((f.nx * rx + f.nz * rz) * (wb - wa) < 0) [wa, wb] = [wb, wa];
    const p0 = f.p(uu, v - th / 2, wa);
    const p1 = f.p(uu, v - th / 2, wb);
    const p2 = f.p(uu, v + th / 2, wb);
    const p3 = f.p(uu, v + th / 2, wa);
    const g = f.facing(p0, p1, p2, p3, [[rr[0], rr[3]], [rr[2], rr[3]], [rr[2], rr[1]], [rr[0], rr[1]]], n);
    ctx.B.add(M.signNeon, g, null, nextId(), { color: col });
  }
}

// ------------------------------------------------------------------ weathering
/**
 * What the weather and the years have done to a wall: streaks down it from under the cornice
 * and the sills, a patch of new stucco, the grime along its foot. All a hair in front of the wall.
 * o: { r, u0, u1, v0 (the foot), v1 (under the cornice), col (the wall), streaks, patches, grime }
 */
export function weather(P, f, o) {
  const M = P.M;
  const r = o.r;
  if (!r) return;
  const { u0, u1, v0, v1 } = o;
  const col = o.col;
  const w = o.w || 0.014;
  const span = u1 - u0;
  if (span < 1) return;
  // streaks from under the cornice
  const ns = o.streaks !== undefined ? o.streaks : Math.floor(r() * 3);
  for (let k = 0; k < ns; k++) {
    const u = u0 + 0.4 + r() * (span - 0.8);
    const len = 0.8 + r() * 2.2;
    const sw = 0.12 + r() * 0.3;
    P.box(M.frame, f, u - sw / 2, v1 - len, 0, u + sw / 2, v1, w, darker(col, 0.86), nextId(), FB.BACK);
  }
  // a patch of new stucco, a shade off the old
  if (o.patches !== false && r() < 0.45) {
    const pw = 0.6 + r() * 1.2;
    const ph = 0.4 + r() * 0.8;
    const u = u0 + 0.3 + r() * Math.max(0.01, span - pw - 0.6);
    const v = v0 + 0.6 + r() * Math.max(0.01, v1 - v0 - ph - 1.2);
    P.box(M.frame, f, u, v, 0, u + pw, v + ph, w, r() < 0.5 ? lighter(col, 0.12) : darker(col, 0.93), nextId(), FB.BACK);
  }
  // the grime along its foot
  if (o.grime !== false) P.box(M.frame, f, u0, v0, 0, u1, v0 + 0.22 + r() * 0.2, w + 0.002, darker(col, 0.72), nextId(), FB.BACK);
}

// a tag sprayed on a wall (the alleys' tags, world/boards.js)
export function tag(P, f, uc, vc, w, width) {
  const ctx = P.ctx;
  const M = ctx.M;
  if (!M.tag || !ctx.atlas || !ctx.atlas.rects) return;
  const names = ['tag_kaos', 'tag_zeph', 'tag_omen', 'tag_raze', 'tag_skiz', 'tag_neko', 'tag_blaze', 'tag_dust', 'tag_vex', 'tag_misfit'];
  const cell = names[Math.abs(Math.floor(uc * 7 + vc * 13 + f.ox + f.oz)) % names.length];
  const uv = ctx.atlas.rects[cell];
  if (!uv) return;
  const h = width / 4;
  const a = f.p(uc - width / 2, vc - h / 2, w);
  const b = f.p(uc + width / 2, vc - h / 2, w);
  const c = f.p(uc + width / 2, vc + h / 2, w);
  const d = f.p(uc - width / 2, vc + h / 2, w);
  ctx.B.add(M.tag, f.facing(a, b, c, d, [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], [f.nx, 0, f.nz]), null, nextId());
}

