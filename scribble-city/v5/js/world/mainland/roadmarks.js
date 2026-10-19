import { srgb } from '../../render/materials.js';
import { seeded } from '../kit.js';
import { NODES, MAIN0, exitsFrom } from '../roads.js';
import { M_AVES, M_STREETS, M_BLOCKS } from './plan.js';
import { frame, shift, WHITE, YELLOW, paintWord, paintArrow, paintBike, blot, PAINT_Y } from './roadkit.js';
import { stormDrain, manhole } from './roadside.js';

// (v5, GTA IV streets) What a road of the mainland has on it between two crossings, the way a
// street a few years old has: the white bar where the cars stop for the light and the arrows of
// the lanes before it, the drains at the curbs just short of the corner, the iron of the manholes
// and the little valve covers, the patches where it was dug up (a long trench patch of newer, darker
// asphalt; a round one where a pothole was filled), the black snakes of sealed cracks, the dark
// drips where the cars wait. The bike routes have their bicycles painted on a green ground in the
// lane by the curb; the bayfront boulevard its own bike lane; the streets round the school SLOW
// SCHOOL XING; a corner with no light its STOP.
//
// Everything is laid out for the whole stretch from the stretch's own dice (the same however the
// tiles cut it: every throw is thrown whether its mark is this tile's or not, and a mark's own
// shape - a crack's wander, a patch's ragged edge - from dice of its own) and painted by the tile
// its spot is in, so a mark is painted once, by one tile.

const TAR = srgb(0.15, 0.13, 0.19);
const PATCH = [srgb(0.22, 0.2, 0.28), srgb(0.25, 0.22, 0.31), srgb(0.34, 0.31, 0.39)];
const DRIP = srgb(0.21, 0.19, 0.26);
const GREEN = srgb(0.3, 0.62, 0.38);

// the crossings of the mainland by avenue and street; the blocks by col, row
const NODE_AT = new Map();
for (let i = MAIN0; i < NODES.length; i++) {
  const n = NODES[i];
  if (n.main) NODE_AT.set(`${n.ave.i},${n.street.j}`, n);
}
export const nodeOf = (a, s) => (a && s ? NODE_AT.get(`${a.i},${s.j}`) || null : null);
const BLOCK_AT = new Map(M_BLOCKS.map((b) => [`${b.col},${b.row}`, b]));
export const blockAt = (col, row) => BLOCK_AT.get(`${col},${row}`) || null;

// a crossing where every way stops (no light: the corners of the grid)
export const stopped = (n) => !!n && !n.signal;

// the bike routes: the lane by the curb shared with the bicycles, painted (River Avenue, Fairfax;
// NE 11th, Calle Ocho); the bayfront has a lane of their own
export const BIKE_AVES = new Set([4, 10]);
export const BIKE_STREETS = new Set([7, 10]);

/**
 * The marks of one stretch of road between two crossings: road (the avenue or the street), alongZ,
 * c (its middle across), t0..t1 (the stretch along it, the crossings' edges), n0 / n1 (the
 * crossings at t0 and t1; null where it runs on), key (its own dice). P: the tile's paint; own(x, z):
 * is that spot the tile's (the stretch of the road the tile builds: world/mainland/tiles.js).
 * o.school: it runs past the school; o.lite: a phone's (fewer cracks and drips)
 */
export function markRoad(ctx, P, own, road, alongZ, c, t0, t1, n0, n1, key, o = {}) {
  const r = seeded(9001 + key * 7919);
  // (the dice of one mark's own shape)
  const sub = () => seeded(1 + Math.floor(r() * 2147480000));
  const L = t1 - t0;
  if (L < 6) return;
  const half = road.half;
  const med = road.median || 0;
  const lanes = road.lanes || (alongZ ? [1.75, 5.25] : [1.8]);
  const bay = road === M_AVES[0];
  const bike = alongZ ? BIKE_AVES.has(road.i) : BIKE_STREETS.has(road.j);
  const y = PAINT_Y;
  for (const dir of [1, -1]) {
    // the frame of this way: u to the right of the cars (towards the curb), v along from where
    // they come in to the crossing they go to
    const f = alongZ ? frame(c, dir > 0 ? t0 : t1, 0, dir) : frame(dir > 0 ? t0 : t1, c, dir, 0);
    const to = dir > 0 ? n1 : n0;
    const from = dir > 0 ? n0 : n1;
    const at = (u, v) => [f.ox + f.rx * u + f.fx * v, f.oz + f.rz * u + f.fz * v];
    const mine = (u, v) => {
      const p = at(u, v);
      return own(p[0], p[1]);
    };
    const u0 = med / 2 + 0.15;
    // (what is painted where along this way already: the arrows, the words - [v0, v1, u0, u1])
    const busy = [];
    const free = (v0, v1, ua, ub) => !busy.some(([a, b, c0, c1]) => v1 > a && v0 < b && ub > c0 && ua < c1);
    // ---- at the crossing ahead: the stop bar, the arrows, the drips of the waiting cars
    if (to) {
      if (mine((u0 + half) / 2, L - 3.7)) P.box(f, u0, L - 3.95, half - 0.25, L - 3.5, WHITE, y);
      busy.push([L - 4, L, 0, half]);
      if (stopped(to)) {
        const fw = shift(f, (u0 + half) / 2);
        if (mine((u0 + half) / 2, L - 8)) paintWord(P, fw, 'STOP', L - 8.6, WHITE, y, 0.5, 2.3, 0.14);
        busy.push([L - 9, L - 6, 0, half]);
      }
      // the arrows: the way(s) out of the crossing from each lane (no left turn where the way goes
      // on: game/traffic.js turns nobody across anybody)
      if (lanes.length >= 2 || bay) {
        const ex = exitsFrom(to, f.fx, f.fz);
        const S = ex.some((e) => e.turn === 0);
        const Rt = ex.some((e) => e.turn === 1);
        const Lt = ex.some((e) => e.turn === -1);
        const inner = S ? 'S' : Lt ? 'L' : 'R';
        const outer = S ? (Rt ? 'SR' : 'S') : Rt ? 'R' : 'L';
        const sets = L > 80 ? [L - 15.5, L - 50] : L > 30 ? [L - 15.5] : [];
        for (const va of sets) {
          lanes.forEach((lu, k) => {
            const kind = k === lanes.length - 1 ? outer : inner;
            if (mine(lu, va + 2)) paintArrow(P, shift(f, lu), kind, va, WHITE, y);
            busy.push([va - 0.5, va + 5.2, lu - 1.4, lu + 1.4]);
          });
        }
      }
      // (where the cars wait, a dark drip in the middle of each lane)
      if (!o.lite) {
        for (const lu of lanes) {
          const v = L - r.range(5.5, 9);
          const du = r.range(-0.2, 0.2);
          const len = r.range(0.9, 1.6);
          const sr = sub();
          if (mine(lu, v)) blot(P, f, sr, lu + du, v, 0.32, len, DRIP, y - 0.004, 8);
        }
      }
    }
    // ---- the school's: SLOW SCHOOL XING, read from near to far, across both lanes
    if (o.school && L > 50) {
      const uw = (u0 + half) / 2;
      const fw = shift(f, uw);
      const v = L - 38;
      if (mine(uw, v + 3)) {
        paintWord(P, fw, 'SLOW', v, YELLOW, y, 0.5, 2.0, 0.13);
        paintWord(P, fw, 'SCHOOL', v + 3.0, YELLOW, y, 0.5, 2.0, 0.13);
        paintWord(P, fw, 'XING', v + 6.0, YELLOW, y, 0.5, 2.0, 0.13);
      }
      busy.push([v - 0.5, v + 8.5, 0, half]);
    }
    // ---- the bicycles: the bayfront's own lane by the curb (its line, its bicycles, green where
    // it meets the crossings), the bike routes' bicycles on green in the lane by the curb
    if (bay) {
      const ul = half - 1.42;
      for (let v = 2; v < L - 4; v += 12) {
        const v1 = Math.min(L - 4.2, v + 12);
        if (mine(ul, (v + v1) / 2)) P.box(f, ul - 0.08, v, ul + 0.08, v1, WHITE, y);
      }
      const ub = (ul + half) / 2;
      for (let v = 14; v < L - 18; v += 46) if (mine(ub, v + 1)) paintBike(P, shift(f, ub), v, WHITE, y + 0.003, false);
      if (to && mine(ub, L - 8)) P.box(f, ul + 0.1, L - 12, half - 0.2, L - 4.2, GREEN, y - 0.003);
      if (from && mine(ub, 6)) P.box(f, ul + 0.1, 0.4, half - 0.2, 5, GREEN, y - 0.003);
    } else if (bike) {
      const ub = alongZ ? lanes[lanes.length - 1] + 0.35 : half - 3.5;
      for (let v = 12; v + 7 < L - 4; v += 52) {
        if (!free(v - 0.6, v + 6.8, ub - 1, ub + 1)) continue;
        busy.push([v - 0.6, v + 6.8, ub - 1, ub + 1]);
        if (!mine(ub, v + 3)) continue;
        P.box(f, ub - 0.85, v - 0.5, ub + 0.85, v + 6.6, GREEN, y - 0.003);
        paintBike(P, shift(f, ub), v, WHITE, y + 0.003, true);
      }
    }
    // ---- the drains at the curb: short of the crossing ahead, and one along the way now and then
    if (L > 14) {
      const vd = L - 5.4;
      if (mine(half - 0.3, vd)) stormDrain(ctx, P, f, vd, half, y);
    }
    if (L > 60 && r() < 0.6) {
      const vd = r.range(L * 0.35, L * 0.6);
      if (mine(half - 0.3, vd)) stormDrain(ctx, P, f, vd, half, y);
    }
    // ---- the iron: a manhole in a lane, a pair of little valve covers by the curb
    for (let k = r.int(1, L > 80 ? 2 : 1); k > 0; k--) {
      const lu = r.pick(lanes) + r.range(-0.6, 0.6);
      const v = r.range(6, Math.max(7, L - 18));
      const rad = r.range(0.32, 0.38);
      if (!free(v - 0.5, v + 0.5, lu - 0.5, lu + 0.5)) continue;
      const p = at(lu, v);
      if (own(p[0], p[1])) manhole(P, p[0], p[1], rad, y);
    }
    if (r() < 0.55) {
      const v = r.range(4, Math.max(5, L - 10));
      const uu = half - r.range(0.9, 1.4);
      const p = at(uu, v);
      const q = at(uu, v + 0.55);
      if (own(p[0], p[1])) {
        P.disc(p[0], p[1], 0.13, srgb(0.36, 0.34, 0.4), y, 10);
        P.disc(p[0], p[1], 0.09, srgb(0.2, 0.19, 0.23), y + 0.004, 10);
        P.disc(q[0], q[1], 0.11, srgb(0.36, 0.34, 0.4), y, 10);
        P.disc(q[0], q[1], 0.07, srgb(0.2, 0.19, 0.23), y + 0.004, 10);
      }
    }
    // ---- the wear: a trench patch, a pothole's, the sealed cracks
    if (r() < 0.5) {
      const w = r.range(0.9, 1.8);
      const ua = r.range(u0 + 0.2, Math.max(u0 + 0.3, half - w - 0.6));
      const len = r.range(3, 11);
      const v = r.range(3, Math.max(4, L - len - 6));
      const col = r.pick(PATCH);
      const sr = sub();
      if (mine(ua + w / 2, v + len / 2)) {
        const j = () => sr.range(-0.08, 0.08);
        P.poly(f, [[ua + j(), v + j()], [ua + w + j(), v + j()], [ua + w + j(), v + len * 0.5 + j()], [ua + w + j(), v + len + j()], [ua + j(), v + len + j()], [ua + j(), v + len * 0.5 + j()]], col, y - 0.006);
      }
    }
    if (r() < 0.45) {
      const uu = r.range(u0 + 0.6, half - 0.8);
      const v = r.range(3, Math.max(4, L - 6));
      const ra = r.range(0.45, 1.0);
      const rb = r.range(0.45, 1.0);
      const col = r.pick(PATCH);
      const sr = sub();
      if (mine(uu, v)) blot(P, f, sr, uu, v, ra, rb, col, y - 0.005, 9);
    }
    const nc = o.lite ? 1 : r.int(1, 2);
    for (let k = 0; k < nc; k++) {
      // (along the lane line, or the middle, or anywhere in the lane)
      const along = [u0 + 0.1, ...lanes.slice(0, -1).map((lu, i) => (lu + lanes[i + 1]) / 2), r.range(u0 + 0.4, half - 0.5)];
      const ua = r.pick(along) + r.range(-0.15, 0.15);
      const v = r.range(1, Math.max(2, L - 8));
      const len = r.range(4, 11);
      const sr = sub();
      if (mine(ua, v)) snake(P, f, sr, ua, v, len, u0, half - 0.2, TAR, y - 0.002);
    }
  }
}

// a crack sealed with tar from (u, v), wandering along the way for len metres, kept between ua
// and ub across it
function snake(P, f, r, u, v, len, ua, ub, color, y) {
  const pts = [[u, v]];
  let a = r.range(-0.3, 0.3);
  for (let s = 0; s < len; s += 1.0) {
    a = Math.max(-0.65, Math.min(0.65, a + r.range(-0.4, 0.4)));
    u = Math.max(ua, Math.min(ub, u + Math.sin(a)));
    v += Math.cos(a);
    pts.push([u, v]);
    // (a branch now and then)
    if (r() < 0.08) {
      const b = a + (r() < 0.5 ? -1 : 1) * r.range(0.6, 1.1);
      P.stroke(f, [[u, v], [Math.max(ua, Math.min(ub, u + Math.sin(b) * 1.2)), v + Math.cos(b) * 1.2]], 0.045, color, y);
    }
  }
  P.stroke(f, pts, r.range(0.05, 0.08), color, y);
}

/**
 * The marks in a crossing's box (n: the crossing): a manhole or two in it, the cracks across it
 */
export function markCrossing(ctx, P, n, o = {}) {
  const r = seeded(4111 + n.id * 131);
  const a = n.ave;
  const s = n.street;
  const y = PAINT_Y;
  const f = frame(n.x, n.z, 0, 1);
  // (the crossing is its tile's: the one its middle is in - world/mainland/tiles.js)
  for (let k = r.int(1, 2); k > 0; k--) {
    const x = n.x + r.range(-a.half + 1.5, a.half - 1.5);
    const z = n.z + r.range(-s.half + 1.5, s.half - 1.5);
    manhole(P, x, z, r.range(0.32, 0.38), y);
  }
  if (!o.lite) {
    for (let k = r.int(1, 2); k > 0; k--) {
      const len = r.range(5, 10);
      snake(P, f, r, r.range(-a.half + 1, a.half - 1), r.range(-s.half, s.half - 3), len, -a.half + 0.4, a.half - 0.4, TAR, y - 0.002);
    }
  }
}

// the stretches of road whose middle of a side touches the school (they get SLOW SCHOOL XING)
export function schoolBeside(alongZ, idx, k0, k1) {
  // an avenue between streets k0, k1 (rows k0): the blocks either side are cols idx and idx - 1
  if (alongZ) {
    const w = blockAt(idx, k0);
    const e = blockAt(idx - 1, k0);
    return (!!w && w.kind === 'school') || (!!e && e.kind === 'school');
  }
  // a street between avenues (k0: the east one's index): the blocks north and south of it
  const nb = blockAt(k0, idx - 1);
  const sb = blockAt(k0, idx);
  return (!!nb && nb.kind === 'school') || (!!sb && sb.kind === 'school');
}

export { M_AVES, M_STREETS };
