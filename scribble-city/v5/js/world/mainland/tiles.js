import * as THREE from 'three';
import { srgb, setLightOwner, showLights, releaseLights } from '../../render/materials.js';
import { Batch, seeded, nextId } from '../kit.js';
import { BoxList } from '../collision.js';
import { strip, slab, curb, zebra } from '../ground.js';
import { palm } from '../palms.js';
import { bench } from '../blocks.js';
import { streetLamp, signalPole } from '../streets.js';
import { shadeTree } from '../streetscape.js';
import { NODES, MAIN0 } from '../roads.js';
import { M_AVES, M_STREETS, M_BLOCKS, SHORE_X, BEACH_Z, CURB } from './plan.js';

// (v5, ROADMAP 11.17) The mainland's streets, a tile of them at a time near you: the asphalt and
// its markings, the crossings and their zebras, the traffic lights where the cars wait (the
// traffic's own plan, world/roads.js), the sidewalks round every block raised by their curbs, the
// lamps and the trees along them, the palms down the boulevards' medians, the bayfront's walk.

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

function* buildTile(tctx, t) {
  const R = t.rect;
  const M = tctx.M;
  const r = tctx.rng;
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
    }
    yield;
  }
  // the streets, between their avenues
  for (const s of M_STREETS) {
    if (s.z < R.z0 || s.z >= R.z1) continue;
    const as = M_AVES.filter((a) => s.z >= a.z0 - 0.5 && s.z <= a.z1 + 0.5 && a.x >= s.x0 - 0.5 && a.x <= s.x1 + 0.5).sort((p, q) => p.x - q.x);
    const xs = [];
    for (let k = 0; k + 1 < as.length; k++) xs.push([as[k].x + as[k].half, as[k + 1].x - as[k + 1].half]);
    // (the causeways' streets go on east to the shore)
    if (s.x1 > as[as.length - 1].x + 1) xs.push([as[as.length - 1].x + as[as.length - 1].half, s.x1 + 2]);
    for (const [xa0, xb0] of xs) {
      const [xa, xb] = clip(xa0, xb0, R.x0, R.x1);
      if (xb <= xa) continue;
      if (s.median) {
        road(tctx, xa, xb, s.z - s.half, s.z - s.median / 2, false, s.half);
        road(tctx, xa, xb, s.z + s.median / 2, s.z + s.half, false, s.half);
        lanes(tctx, xa, xb, s.z, false, [s.median / 2 + 3.4]);
        median(tctx, xa, xb, s.z, s.median, false);
      } else road(tctx, xa, xb, s.z - s.half, s.z + s.half, false, s.half);
    }
    yield;
  }
  // the crossings: asphalt, zebras, the lights
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
      for (const m of n.nb) signalPole(tctx, n, Math.sign(n.x - m.x), Math.sign(n.z - m.z), false);
    }
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
    slab(tctx, M.walk, x0, x1, z0, z1);
    curb(tctx, x0, x0 + 0.18, z0, z1);
    curb(tctx, x1 - 0.18, x1, z0, z1);
    curb(tctx, x0, x1, z0, z0 + 0.18);
    curb(tctx, x0, x1, z1 - 0.18, z1);
    // lamps along the avenues' curbs, a shade tree between every other pair
    for (const [x, ax] of [[x0 + 0.7, -1], [x1 - 0.7, 1]]) {
      for (let z = z0 + 14; z < z1 - 10; z += 26) {
        streetLamp(tctx, x, z, ax, 0, { light: (Math.round(z) & 1) === 0 });
        if (r() < 0.6) shadeTree(tctx, r, x - ax * 0.4, z + 13, { lite: true, size: r.range(0.8, 1.05) });
      }
    }
    for (const [z, az] of [[z0 + 0.7, -1], [z1 - 0.7, 1]]) {
      for (let x = x0 + 16; x < x1 - 12; x += 30) streetLamp(tctx, x, z, 0, az, { light: false });
    }
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
}

/** a tile's build (a generator); returns its live object { group, attach(), detach() } */
export function* buildGroundTile(world, t) {
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
  const meshes = yield* tctx.B.flushSteps(group, { static: true, merge: world.merge, steps: true });
  const cull = [];
  for (const m of meshes) {
    const pen = m.userData.pens ? m.userData.pens[0] : m.material;
    if (world.smallPens.has(pen)) cull.push({ m, r: world.low ? 110 : 150 });
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
