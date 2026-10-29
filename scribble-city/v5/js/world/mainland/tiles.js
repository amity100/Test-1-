import * as THREE from 'three';
import { srgb, setLightOwner, showLights, releaseLights } from '../../render/materials.js';
import { Batch, seeded, nextId } from '../kit.js';
import { BoxList } from '../collision.js';
import { strip, slab, curb, zebra } from '../ground.js';
import { palm } from '../palms.js';
import { bench } from '../blocks.js';
import { streetLamp, signalPole } from '../streets.js';
import { shadeTree, grassStrip } from '../streetscape.js';
import { NODES, MAIN0 } from '../roads.js';
import { M_AVES, M_STREETS, M_BLOCKS, SHORE_X, BEACH_Z, CURB, underSpan } from './plan.js';
import { Paint, PAINT_Y, frame, curbWord, roadKit } from './roadkit.js';
import { sidewalk, pedHeads, nameBlades, stopPost, polePlate, signalCabinet, bollards, grate, utilityPole, poleEnds, span, guyWire, RAMP, CURB_RED, CURB_YELLOW } from './roadside.js';
import { markRoad, markCrossing, nodeOf, blockAt, schoolBeside, BIKE_AVES, BIKE_STREETS } from './roadmarks.js';

// (v5, ROADMAP 11.17) The mainland's streets, a tile of them at a time near you: the asphalt and
// its markings, the crossings and their zebras, the traffic lights where the cars wait (the
// traffic's own plan, world/roads.js), the sidewalks round every block raised by their curbs, the
// lamps and the trees along them, the palms down the boulevards' medians, the bayfront's walk.
//
// (v5, GTA IV streets) And the street as it is when you stand in it: on the asphalt the stop bars,
// the lanes' arrows, the drains, the manholes, the patches and the sealed cracks, the bicycles of
// the bike routes (world/mainland/roadmarks.js); at the corners the sidewalk let down to the
// zebras, the boxes of the hand and the walking man, the green blades with the two names, the box
// that runs the lights, the iron posts on the busy ones, the post with the names where there is
// no light (world/mainland/roadside.js); along the curbs the red where nobody stops, the yellow where the
// trucks load, the plates on the lamp posts; the trees in their grates in town, in their strip of
// grass where people live, and there the wooden poles and their wires; the sidewalks' own wear.
// What is painted is gathered a colour at a time and added as one part each (one more draw a
// tile at most: the signs' picture, world/mainland/roadkit.js).

// the blocks where people live (their curbs grassed, the wires on poles over them) and the ones
// whose sidewalks are their own (world/mainland/blocks.js)
const LIVE = new Set(['houses', 'bungalows', 'apartments', 'villas', 'mansions', 'school']);
const BARE = new Set(['pier', 'beach', 'point', 'bayfront', 'arena']);
// the blocks of the busy town: iron posts on their corners, the loading zones
const TOWN = new Set(['towers', 'offices', 'condos', 'galleria', 'galleriaW', 'galleriaE', 'lanes', 'dining', 'warehouses', 'lofts', 'walls', 'clubs', 'calle', 'boulevard', 'theatres', 'starlight', 'velvet', 'mixed', 'stripmall', 'boardwalk', 'plaza', 'arcade', 'casino']);

export const TILE = 180;
const X0 = -1980;
const Z0 = -1260;

// every tile of the mainland's ground: [{ id, rect, i, j }]
export function groundTiles() {
  const out = [];
  for (let i = 0; X0 + i * TILE < SHORE_X + 10; i++) {
    for (let j = 0; Z0 + j * TILE < BEACH_Z + 20; j++) {
      const rect = { x0: X0 + i * TILE, x1: X0 + (i + 1) * TILE, z0: Z0 + j * TILE, z1: Z0 + (j + 1) * TILE };
      out.push({ id: `t${i}_${j}`, rect, i, j });
    }
  }
  return out;
}

const clip = (a, b, lo, hi) => [Math.max(a, lo), Math.min(b, hi)];
const inside = (x, z, R) => x >= R.x0 && x < R.x1 && z >= R.z0 && z < R.z1;

function tileCtx(world, t) {
  const c = world.ctx;
  const lightOwner = { lights: [] };
  const tctx = {
    B: new Batch(),
    M: world.mainM,
    col: new BoxList(),
    rng: seeded(9100 + t.i * 97 + t.j * 13),
    parent: null,
    hideSpots: [],
    signals: [],
    lamps: [],
    benches: [],
    atlas: c.atlas,
    lightOwner,
    lightCount: () => lightOwner.lights.length,
    props: [],
    // (a phone's: fewer of the little things on the ground)
    low: !!world.low,
  };
  tctx.objects = {
    begin: (cx, kind, x, z) => world.objects.beginLocal(cx, kind, x, z),
    end: (cx, id, data) => world.objects.endLocal(cx, id, data),
  };
  return tctx;
}

// a strip of road along an avenue (alongZ) or a street, clipped to the tile, its texture by width
function road(tctx, x0, x1, z0, z1, alongZ, half) {
  const M = tctx.M;
  // (14 m: the avenues' paint, two lanes each way; 12 m: the streets', parking either side; wider
  // ones: plain asphalt, their lane lines painted on, world/mainland/tiles.js lanes())
  if (half === 7) strip(tctx, M.ave, x0, x1, z0, z1, alongZ, 14, 14);
  else if (half === 6) strip(tctx, M.cross, x0, x1, z0, z1, alongZ, 12, 8);
  else strip(tctx, M.asphalt, x0, x1, z0, z1, alongZ, 8, 8);
}

// the lane lines of a wide boulevard (white dashes either side of its median)
function lanes(tctx, a, b, c, alongZ, lanesAt) {
  const M = tctx.M;
  const white = srgb(0.95, 0.93, 0.88);
  for (const off of lanesAt) {
    for (const sd of [-1, 1]) {
      const o = c + sd * off;
      for (let t = a + 2; t < b - 3; t += 9) {
        const t1 = Math.min(b, t + 3.5);
        if (alongZ) tctx.B.box(M.court, o - 0.07, 0.008, t, o + 0.07, 0.012, t1, nextId(), { color: white });
        else tctx.B.box(M.court, t, 0.008, o - 0.07, t1, 0.012, o + 0.07, nextId(), { color: white });
      }
    }
  }
}

// a raised median with palms down a boulevard
function median(tctx, a, b, c, w, alongZ) {
  const M = tctx.M;
  const r = tctx.rng;
  if (alongZ) {
    slab(tctx, M.walk, c - w / 2, c + w / 2, a, b);
    const g = new THREE.PlaneGeometry(w - 0.6, b - a - 0.6).rotateX(-Math.PI / 2);
    g.translate(c, CURB + 0.01, (a + b) / 2);
    tctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.46, 0.7, 0.4) });
    for (let t = a + 6; t < b - 4; t += 13) palm(tctx, r, c + r.range(-0.3, 0.3), t, r.range(9, 12.5), { y0: CURB });
  } else {
    slab(tctx, M.walk, a, b, c - w / 2, c + w / 2);
    const g = new THREE.PlaneGeometry(b - a - 0.6, w - 0.6).rotateX(-Math.PI / 2);
    g.translate((a + b) / 2, CURB + 0.01, c);
    tctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.46, 0.7, 0.4) });
    for (let t = a + 6; t < b - 4; t += 13) palm(tctx, r, t, c + r.range(-0.3, 0.3), r.range(9, 12.5), { y0: CURB });
  }
}

// the lamp just stood (streetLamp's prop: its plates are rubbed out with it)
const lastProp = (tctx) => (tctx.props.length ? tctx.props[tctx.props.length - 1].id : 0);

// a crossing's corners: for each, which way is into its block (qx, qz), the curbs' corner and the
// block (col: west of an avenue is its own col, east of it the one before; row: north of a street
// the one before, south its own)
function cornersOf(n) {
  const a = n.ave;
  const s = n.street;
  const out = [];
  for (const qx of [-1, 1]) {
    for (const qz of [-1, 1]) {
      const b = blockAt(qx < 0 ? a.i : a.i - 1, qz < 0 ? s.j - 1 : s.j);
      out.push({ qx, qz, x: n.x + qx * a.half, z: n.z + qz * s.half, b });
    }
  }
  return out;
}

// the things of a crossing's corners: the box that runs its lights on one of them, the iron posts
// on the corners of the busy town
function cornerThings(tctx, n) {
  const r = seeded(7717 + n.id * 31);
  const lite = tctx.low;
  const cs = cornersOf(n).filter((c) => c.b && !BARE.has(c.b.kind));
  if (!cs.length) return;
  if (n.signal) {
    // (along the avenue's curb, past the newspapers and the bin of the corner, on a corner south of
    // the crossing: a block's north end, where its sidewalk's things leave the stretch from 7 to 13 m
    // clear - world/mainland/sidewalks.js. At its south end a block by one of the wide streets has
    // one of its places there; no corner south of the crossing, no box)
    const south = cs.filter((c) => c.qz > 0);
    const c = south[Math.floor(r() * south.length)];
    if (c) signalCabinet(tctx, c.x + c.qx * 0.95, c.z + c.qz * 9.6, Math.atan2(c.qx, 0));
  }
  for (const c of cs) {
    if (!TOWN.has(c.b.kind)) continue;
    // (on a phone, the one at the point of the corner; the other two short of the ramps, which
    // begin a metre from the corner: world/mainland/roadside.js RAMP)
    const pts = [[c.x + c.qx * 0.45, c.z + c.qz * 0.45]];
    if (!lite) pts.push([c.x + c.qx * 0.34, c.z + c.qz * 0.85], [c.x + c.qx * 0.85, c.z + c.qz * 0.34]);
    bollards(tctx, pts);
  }
}

// a corner with no lights (the grid's corners, where the road only turns: the cars go round it
// without stopping - world/roads.js lightAt, game/traffic.js - so no stop sign they would drive
// past): the zebras on each of its ways, and short of the first, on the corner to the right of
// the cars coming in, the post with the two roads' names
function stopCorner(tctx, n) {
  const a = n.ave;
  const s = n.street;
  let first = true;
  for (const m of n.nb) {
    const ex = Math.sign(m.x - n.x);
    const ez = Math.sign(m.z - n.z);
    if (ez !== 0) {
      const z0 = ez < 0 ? s.z - s.half - 3.2 : s.z + s.half + 0.4;
      zebra(tctx, a.x - a.half, a.x + a.half, z0, z0 + 2.8, false);
    } else {
      const x0 = ex < 0 ? a.x - a.half - 3.2 : a.x + a.half + 0.4;
      zebra(tctx, x0, x0 + 2.8, s.z - s.half, s.z + s.half, true);
    }
    if (!first) continue;
    first = false;
    // (the cars coming in from m go -ex, -ez: the post on the corner to their right, short of the zebra)
    const dx = -ex;
    const dz = -ez;
    const along = dz !== 0;
    const back = (along ? s.half : a.half) + 3.6;
    const side = (along ? a.half : s.half) + 0.5;
    stopPost(tctx, n, n.x - dx * back - dz * side, n.z - dz * back + dx * side, dx, dz, true, { sign: false });
  }
}

// a block's curbs: red short of the corners on its streets (no parking by the zebras), yellow
// where the trucks load (in town, one stretch of a street side in two, by a lamp: its plate is on
// it). Returns { paints, loading: [{ x0, x1, z, side, lamp }] }
function curbPaint(b, x0, x1, z0, z1) {
  const r = seeded(b.seed * 13 + 5);
  const R1 = RAMP.R1;
  const paints = { n: [], s: [], w: [], e: [] };
  const loading = [];
  for (const [key, z, side] of [['n', z0, -1], ['s', z1, 1]]) {
    paints[key].push([x0 + R1, x0 + R1 + 4.5, CURB_RED], [x1 - R1 - 4.5, x1 - R1, CURB_RED]);
    const load = TOWN.has(b.kind) && r() < 0.55;
    const lamp = x0 + 16 + 30 * Math.floor(r() * 2);
    if (load && lamp < x1 - 12) {
      paints[key].push([lamp - 2.5, lamp + 10, CURB_YELLOW]);
      loading.push({ x0: lamp - 2.5, x1: lamp + 10, z, side, lamp });
    }
  }
  return { paints, loading };
}

// the sidewalk's own wear (in the paint, on the slab): the dark spots of old gum, the cracks, a
// worn patch, the covers of the water and the phone lines in it (x0..x1, z0..z1: the curbs; wx,
// wz: how wide the walks along the avenues and the streets are)
const GUM = srgb(0.5, 0.42, 0.44);
const CRACK = srgb(0.44, 0.36, 0.4);
const WORN = srgb(0.8, 0.7, 0.66);
const LID = srgb(0.5, 0.48, 0.5);
const LID_IN = srgb(0.38, 0.36, 0.4);
function sidewalkWear(P, r, x0, x1, z0, z1, wx, wz, lite, grass = false) {
  const y = CURB + 0.008;
  const sides = [
    // [along x?, the curb's coordinate, into the walk, from, to, the walk's width]
    [true, z0, 1, x0 + 4, x1 - 4, wz],
    [true, z1, -1, x0 + 4, x1 - 4, wz],
    [false, x0, 1, z0 + 4, z1 - 4, wx],
    [false, x1, -1, z0 + 4, z1 - 4, wx],
  ];
  const flat = frame(0, 0, 0, 1);
  for (const [alongX, c, s, a, b, w] of sides) {
    const at = (t, d) => (alongX ? [t, c + s * d] : [c + s * d, t]);
    // (the gum: little dark spots, thickest where people wait - by the corners)
    for (let k = lite ? 3 : 8; k > 0; k--) {
      const t = r() < 0.5 ? r.range(a, a + 10) : r.range(a, b);
      const [x, z] = at(t, r.range(0.8, w - 0.4));
      P.disc(x, z, r.range(0.035, 0.07), GUM, y, 5);
    }
    // the cracks across a slab, zigzag
    for (let k = r.int(1, 2); k > 0; k--) {
      let t = r.range(a, b);
      let d = r.range(1.2, w - 0.5);
      const pts = [];
      for (let i = 0; i < 4; i++) {
        const [x, z] = at(t, d);
        pts.push([-x, z]);
        t += r.range(0.2, 0.55);
        d = Math.max(0.4, Math.min(w - 0.3, d + r.range(-0.35, 0.35)));
      }
      // (frame(0, 0, 0, 1): u is -x, v is z)
      P.stroke(flat, pts, 0.03, CRACK, y);
    }
    // a worn patch where everybody walks
    if (r() < 0.6) {
      const t = r.range(a, b);
      const [x, z] = at(t, r.range(1.8, w - 1.2));
      const pts = [];
      const ra = r.range(0.6, 1.3);
      const rb = r.range(0.5, 1.0);
      for (let k = 0; k < 9; k++) {
        const qa = (k / 9) * Math.PI * 2;
        const kk = r.range(0.75, 1.05);
        pts.push([-(x + Math.cos(qa) * ra * kk), z + Math.sin(qa) * rb * kk]);
      }
      P.poly(flat, pts, WORN, y - 0.002);
    }
    // the covers: the water's, the phone's (a frame, a lid, its bar; where people live, past the
    // strip of grass along the curb, homeStreets)
    for (let k = r.int(0, 2); k > 0; k--) {
      const t = r.range(a, b);
      const d = r.range(0.5, 1.3) + (grass ? 1.3 : 0);
      const [x, z] = at(t, d);
      const hw = alongX ? 0.32 : 0.48;
      const hd = alongX ? 0.48 : 0.32;
      P.rect(x - hw, z - hd, x + hw, z + hd, LID, y);
      P.rect(x - hw + 0.05, z - hd + 0.05, x + hw - 0.05, z + hd - 0.05, LID_IN, y + 0.003);
      P.rect(x - 0.12, z - 0.03, x + 0.12, z + 0.03, LID, y + 0.006);
    }
  }
}

function* buildTile(tctx, t) {
  const R = t.rect;
  const M = tctx.M;
  const r = tctx.rng;
  const P = new Paint();
  const lite = tctx.low;
  // (the dice of the new things, apart from the ones the lamps and the trees have always had)
  const q = seeded(5150 + t.i * 61 + t.j * 7);
  // (which spots of a road's marks are this tile's: the stretch of it the tile builds)
  const ownZ = (x, z) => z >= R.z0 && z < R.z1;
  const ownX = (x) => x >= R.x0 && x < R.x1;
  // the avenues through the tile, between their crossings
  for (const a of M_AVES) {
    if (a.x < R.x0 || a.x >= R.x1) continue;
    const ss = M_STREETS.filter((s) => s.z >= a.z0 - 0.5 && s.z <= a.z1 + 0.5 && a.x >= s.x0 - 0.5 && a.x <= s.x1 + 0.5);
    for (let k = 0; k + 1 < ss.length; k++) {
      const s0 = ss[k];
      const s1 = ss[k + 1];
      const [za, zb] = clip(s0.z + s0.half, s1.z - s1.half, R.z0, R.z1);
      if (zb <= za) continue;
      if (a.median) {
        road(tctx, a.x - a.half, a.x - a.median / 2, za, zb, true, a.half);
        road(tctx, a.x + a.median / 2, a.x + a.half, za, zb, true, a.half);
        lanes(tctx, za, zb, a.x, true, [a.median / 2 + 3.6]);
        median(tctx, za, zb, a.x, a.median, true);
      } else road(tctx, a.x - a.half, a.x + a.half, za, zb, true, a.half);
      markRoad(tctx, P, ownZ, a, true, a.x, s0.z + s0.half, s1.z - s1.half, nodeOf(a, s0), nodeOf(a, s1), 1 + a.i * 40 + s0.j, { lite, school: schoolBeside(true, a.i, s0.j) });
      // (a stretch a step: the streamer gets its frame back between them - a boulevard's palms
      // and a stretch's marks together were a step longer than a phone's frame)
      yield;
    }
  }
  // the streets, between their avenues
  for (const s of M_STREETS) {
    if (s.z < R.z0 || s.z >= R.z1) continue;
    const as = M_AVES.filter((a) => s.z >= a.z0 - 0.5 && s.z <= a.z1 + 0.5 && a.x >= s.x0 - 0.5 && a.x <= s.x1 + 0.5).sort((p, p2) => p.x - p2.x);
    // [west edge, east edge, the avenue west of it, the one east of it]
    const xs = [];
    for (let k = 0; k + 1 < as.length; k++) xs.push([as[k].x + as[k].half, as[k + 1].x - as[k + 1].half, as[k], as[k + 1]]);
    // (the causeways' streets go on east to the shore)
    if (s.x1 > as[as.length - 1].x + 1) xs.push([as[as.length - 1].x + as[as.length - 1].half, s.x1 + 2, as[as.length - 1], null]);
    for (const [xa0, xb0, aw, ae] of xs) {
      const [xa, xb] = clip(xa0, xb0, R.x0, R.x1);
      if (xb <= xa) continue;
      if (s.median) {
        road(tctx, xa, xb, s.z - s.half, s.z - s.median / 2, false, s.half);
        road(tctx, xa, xb, s.z + s.median / 2, s.z + s.half, false, s.half);
        lanes(tctx, xa, xb, s.z, false, [s.median / 2 + 3.4]);
        median(tctx, xa, xb, s.z, s.median, false);
      } else road(tctx, xa, xb, s.z - s.half, s.z + s.half, false, s.half);
      markRoad(tctx, P, ownX, s, false, s.z, xa0, ae ? xb0 : xb0 - 2, nodeOf(aw, s), ae ? nodeOf(ae, s) : null, 5000 + s.j * 40 + aw.i, { lite, school: ae ? schoolBeside(false, s.j, ae.i) : false });
      yield;
    }
  }
  // the crossings: asphalt, zebras, the lights (and the boxes of the hand and the walking man on
  // their poles, the names on two of them), the corners' things
  for (let i = MAIN0; i < NODES.length; i++) {
    const n = NODES[i];
    if (!inside(n.x, n.z, R)) continue;
    const a = n.ave;
    const s = n.street;
    strip(tctx, M.asphalt, a.x - a.half, a.x + a.half, s.z - s.half, s.z + s.half, true, 8, 8);
    if (n.signal) {
      zebra(tctx, a.x - a.half, a.x + a.half, s.z - s.half - 3.2, s.z - s.half - 0.4, false);
      zebra(tctx, a.x - a.half, a.x + a.half, s.z + s.half + 0.4, s.z + s.half + 3.2, false);
      zebra(tctx, a.x - a.half - 3.2, a.x - a.half - 0.4, s.z - s.half, s.z + s.half, true);
      zebra(tctx, a.x + a.half + 0.4, a.x + a.half + 3.2, s.z - s.half, s.z + s.half, true);
      const k0 = tctx.signals.length;
      for (const m of n.nb) signalPole(tctx, n, Math.sign(n.x - m.x), Math.sign(n.z - m.z), false);
      const poles = tctx.signals.slice(k0);
      // (the poles a step, their boxes and names the next, the corners' things the one after)
      yield;
      for (const sig of poles) {
        pedHeads(tctx, n, sig, { lite });
        // (the names on the poles of two corners across from each other)
        if (Math.sign(sig.x - n.x) === Math.sign(sig.z - n.z)) nameBlades(tctx, n, sig.x, CURB + 4.15, sig.z, sig.obj);
      }
      yield;
    } else stopCorner(tctx, n);
    markCrossing(tctx, P, n, { lite });
    cornerThings(tctx, n);
    yield;
  }
  // the sidewalks round each block whose middle is in the tile (to the curbs of its roads)
  for (const b of M_BLOCKS) {
    if (!inside(b.cx, b.cz, R)) continue;
    const ae = M_AVES[b.col];
    const aw = M_AVES[b.col + 1];
    const sn = M_STREETS[b.row];
    const ss = M_STREETS[b.row + 1];
    const x0 = aw.x + aw.half;
    const x1 = ae.x - ae.half;
    const z0 = sn.z + sn.half;
    const z1 = ss.z - ss.half;
    const live = LIVE.has(b.kind);
    const bare = BARE.has(b.kind);
    const cp = curbPaint(b, x0, x1, z0, z1);
    sidewalk(tctx, x0, x1, z0, z1, P, { paints: cp.paints });
    const bq = seeded(b.seed * 17 + 9);
    // lamps along the avenues' curbs (their plates: the speed, the bike route, no turn on red, the
    // tow-away), a shade tree between every other pair (in its grate in town; where people live,
    // in the strip of grass along the curb)
    for (const [x, ax] of [[x0 + 0.7, -1], [x1 - 0.7, 1]]) {
      let k = 0;
      const bikeAve = BIKE_AVES.has((ax < 0 ? aw : ae).i);
      for (let z = z0 + 14; z < z1 - 10; z += 26, k++) {
        // (none under the Galleria's bridges and its gate over Second Avenue: ROADMAP 11.31)
        const plate = k === 0 ? (bikeAve ? 'bike' : bq() < 0.5 ? 'speed35' : null) : bq.pick(['tow', null, 'noturn', null, null, 'clean']);
        if (!underSpan(x, z, 2)) {
          streetLamp(tctx, x, z, ax, 0, { light: (Math.round(z) & 1) === 0 });
          const lid = lastProp(tctx);
          // (on a phone, the first lamp's plate of a side only)
          if (plate && !bare && (!lite || k === 0)) polePlate(tctx, x, z, CURB + 2.7, true, plate, lid, 0.115);
        }
        if (r() < 0.6) {
          const tx = x - ax * 0.4;
          const tz = z + 13;
          const size = r.range(0.8, 1.05);
          if (!underSpan(tx, tz, 4)) {
            shadeTree(tctx, r, tx, tz, { lite: true, size });
            if (!live && !bare) grate(P, tx, tz);
          }
        }
      }
      // (a side of the block's lamps and trees a step)
      yield;
    }
    for (const [z, az] of [[z0 + 0.7, -1], [z1 - 0.7, 1]]) {
      // (where people live the south side's lamps are on the poles of the wires)
      if (live && az > 0) continue;
      const bikeSt = BIKE_STREETS.has((az < 0 ? sn : ss).j);
      for (let x = x0 + 16; x < x1 - 12; x += 30) {
        streetLamp(tctx, x, z, 0, az, { light: false });
        const lid = lastProp(tctx);
        const load = cp.loading.find((l) => l.lamp === x && l.side === az);
        const plate = load ? 'loading' : bikeSt && x === x0 + 16 ? 'bike' : bare ? null : bq.pick(['clean', 'hour2', null, null, 'tow']);
        if (plate && (!lite || load || x === x0 + 16)) polePlate(tctx, x, z, CURB + 2.7, false, plate, lid, 0.115);
      }
    }
    // the loading zones' words, along the curb in the lane of the parked cars
    for (const l of cp.loading) curbWord(P, (l.x0 + l.x1) / 2, l.z, 0, l.side, 'LOADING ZONE', srgb(0.95, 0.8, 0.25), PAINT_Y, 0.55, 0.5, 1.3);
    if (live) yield* homeStreets(tctx, b, x0, x1, z0, z1, q);
    yield;
    if (!bare) sidewalkWear(P, bq, x0, x1, z0, z1, Math.min(aw.walk, ae.walk), Math.min(sn.walk, ss.walk), lite, live);
    yield;
  }
  // the bayfront: a walk along the water, its lawn and palms, benches looking out over the bay
  const bay = M_AVES[0];
  const bx0 = bay.x + bay.half;
  if (bx0 < R.x1 && SHORE_X > R.x0) {
    const [za, zb] = clip(M_STREETS[0].z - 6, BEACH_Z, R.z0, R.z1);
    if (zb > za) {
      slab(tctx, M.prom, bx0, SHORE_X, za, zb);
      curb(tctx, bx0, bx0 + 0.18, za, zb);
      const g = new THREE.PlaneGeometry(SHORE_X - bx0 - 12, zb - za).rotateX(-Math.PI / 2);
      g.translate((bx0 + 6 + SHORE_X - 6) / 2, CURB + 0.012, (za + zb) / 2);
      tctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.5, 0.76, 0.44) });
      for (let z = za + 5; z < zb - 3; z += 11) palm(tctx, r, bx0 + 8 + r.range(-1, 1), z, r.range(9, 13), { y0: CURB });
      for (let z = za + 9; z < zb - 6; z += 22) {
        bench(tctx, SHORE_X - 3.2, z, -Math.PI / 2);
        streetLamp(tctx, SHORE_X - 2.2, z + 11, 1, 0, { light: true });
      }
    }
    yield;
  }
  // the paint, a colour a part
  if (!P.empty) P.flush(tctx, M.court, 'paint');
}

// Where people live: the strip of grass along every curb (broken by the corners' ramps), the
// trees in it along the streets, and on the south side of the block the wooden poles of the wires
// with the lamps on their arms, the wires from pole to pole and on over the avenue to the next
// block's poles where people live there too (else the last pole held by its guy wire)
function* homeStreets(tctx, b, x0, x1, z0, z1, q) {
  const g0 = 0.35;
  const g1 = 1.6;
  const e = RAMP.R1 + 1.2;
  grassStrip(tctx, x0 + e, z0 + g0, x1 - e, z0 + g1);
  grassStrip(tctx, x0 + e, z1 - g1, x1 - e, z1 - g0);
  grassStrip(tctx, x0 + g0, z0 + e, x0 + g1, z1 - e);
  grassStrip(tctx, x1 - g1, z0 + e, x1 - g0, z1 - e);
  // a street tree on each side (between the lamps and the things on the sidewalk:
  // world/mainland/sidewalks.js; not on a phone)
  for (const [z, s, u] of [[z0 + 1.0, 1, 27], [z1 - 1.0, -1, 57]]) {
    const x = x0 + u + q.range(-0.6, 0.6);
    if (x > x1 - 8 || tctx.low) continue;
    shadeTree(tctx, q, x, z, { lite: true, away: [0, s], size: q.range(0.75, 0.95) });
  }
  yield;
  // the poles on the south side, their lamps out over the street. The line - its poles, its wires,
  // its guy wires - is one thing of the street's: a wooden pole with the wires on it does not go
  // over when a car hits it, it stops the car; and rubbed out, the line goes all together, nothing
  // of it left hanging in the air (game/knock.js, world/objects.js)
  const zp = z1 - 0.7;
  const xs = [x0 + 16, x0 + 46, x1 - 5];
  const line = tctx.objects.begin(tctx, 'pole', xs[1], zp);
  const poles = xs.map((x, k) => utilityPole(tctx, x, zp, 0, 1, { alongX: true, xfmr: k === 1 && q() < 0.6 }));
  const lite = tctx.low;
  for (let k = 0; k + 1 < poles.length; k++) span(tctx, poles[k], poles[k + 1], { lite });
  // over the avenue to the east (col - 1) when people live there too - the top wires only: the
  // phone cable would hang through the light's pole on the far corner (world/streets.js
  // signalPole, 0.62 m in from the curb, as the wires are 0.7); else the guy wire, down to the
  // corner's point past the two ramps (not on the ramp where the zebra lands, in the people's way)
  const east = blockAt(b.col - 1, b.row);
  if (east && LIVE.has(east.kind)) {
    const ex0 = M_AVES[b.col].x + M_AVES[b.col].half;
    span(tctx, poles[poles.length - 1], poleEnds(ex0 + 16, zp, 0, 1, { alongX: true }), { lite, cable: false });
  } else guyWire(tctx, poles[poles.length - 1], 1, 0, x1 - 0.45 - xs[2]);
  const west = blockAt(b.col + 1, b.row);
  if (!west || !LIVE.has(west.kind)) guyWire(tctx, poles[0], -1, 0);
  tctx.objects.end(tctx, line);
}

/** a tile's build (a generator); returns its live object { group, attach(), detach() } */
export function* buildGroundTile(world, t) {
  // (the signs' pen is one of the little things not drawn from far off, like the props it hangs
  // on - the blocks' plates too, world/mainland/sidewalks.js)
  world.smallPens.add(roadKit().mat);
  const tctx = tileCtx(world, t);
  const group = new THREE.Group();
  group.name = `ground ${t.id}`;
  group.visible = false;
  tctx.parent = group;
  try {
    const it = buildTile(tctx, t);
    for (;;) {
      setLightOwner(tctx.lightOwner);
      const r = it.next();
      setLightOwner(null);
      if (r.done) break;
      yield;
    }
  } finally {
    setLightOwner(null);
  }
  // (a phone: each pen of the tile in one draw - see world/mainland/blocks.js)
  const whole = world.low ? { max: 60000, ok: (pens) => !pens.some((p) => world.smallPens.has(p)) } : null;
  const meshes = yield* tctx.B.flushSteps(group, { static: true, merge: world.merge, steps: true, whole });
  const cull = [];
  for (const m of meshes) {
    const pen = m.userData.pens ? m.userData.pens[0] : m.material;
    if (world.smallPens.has(pen)) cull.push({ m, r: world.low ? 85 : 150 });
    // (the paint, a draw of its own: flat on the street 2 cm up it throws no shadow worth the sun's
    // map, and the wet street's mirror would show it just under itself, where the paint covers it -
    // in neither, render/pipeline.js)
    if (m.name === 'paint' || m.name.startsWith('paint#')) {
      m.userData.noShadow = true;
      m.userData.noReflect = true;
    }
  }
  return {
    group,
    tile: t,
    verts: tctx.B.vcount,
    attach() {
      for (const box of tctx.col.boxes) world.collision.adopt(box);
      world.objects.adoptLocal(tctx.props);
      showLights(tctx.lightOwner, true);
      for (const s of tctx.signals) world.signals.push(s);
      for (const c of cull) world.cullList.push(c);
      group.visible = true;
      world.mainland.show(group, `g${t.id}`);
    },
    detach() {
      world.mainland.hide(group);
      world.collision.release(tctx.col.boxes.map((x) => x.id));
      world.objects.releaseLocal(tctx.props);
      releaseLights(tctx.lightOwner);
      for (const s of tctx.signals) {
        const k = world.signals.indexOf(s);
        if (k >= 0) world.signals.splice(k, 1);
      }
      for (const c of cull) {
        const k = world.cullList.indexOf(c);
        if (k >= 0) world.cullList.splice(k, 1);
      }
      group.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
    },
  };
}
