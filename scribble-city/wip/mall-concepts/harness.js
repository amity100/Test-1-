// (ROADMAP 11.31, the mock-ups) The test page's side: the site cleared - the two blocks under the
// mall built empty, the towers on the next one folded away, nobody and no car on it - a look
// built there, and the pictures framed from where you would see it.
import { buildConcept, dropConcept, SITE, LOT, CX, CZ, VOID } from './concepts.js';
import { CURB } from '/v5/js/world/mainland/plan.js';

const G = CURB;
let built = null;

// a block of the two, built as ever and then emptied: nothing of it shown, no shops, no people
function empty(live) {
  live.group.traverse((m) => {
    if (m.isMesh) m.geometry.dispose();
  });
  live.group.clear();
  const bc = live.bctx;
  for (const k of ['signs', 'shops', 'hideSpots', 'alleys', 'parks', 'courts', 'benches', 'stands', 'plazas', 'fountains', 'seats', 'busStops', 'markets', 'lamps', 'billboards', 'territories', 'footprints', 'queues', 'lots', 'props', 'stock', 'plots', 'anims', 'walks']) if (Array.isArray(bc[k])) bc[k].length = 0;
  bc.col.boxes.length = 0;
  bc.mall = null;
  bc.arena = null;
  bc.carousel = null;
  if (bc.lightOwner) bc.lightOwner.lights.length = 0;
  live.shops = bc.shops;
}

// the towers of the blocks under it: their corners put under the ground
function foldTowers(w) {
  const ts = (w.ctx.mainTowers || []).filter((t) => SITE.blocks.includes(t.block));
  const boxes = ts.map((t) => [t.x - t.w / 2 - 2, t.z - t.d / 2 - 2, t.x + t.w / 2 + 2, t.z + t.d / 2 + 2]);
  let n = 0;
  if (!boxes.length) return 0;
  w.group.traverse((m) => {
    const g = m.isMesh && m.geometry;
    if (!g || !g.attributes.position) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    if (!boxes.some(([x0, z0, x1, z1]) => bb.max.x > x0 && bb.min.x < x1 && bb.max.z > z0 && bb.min.z < z1)) return;
    const p = g.attributes.position;
    let hit = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      if (p.getY(i) > G + 0.6 && boxes.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) {
        p.setY(i, -60);
        hit++;
      }
    }
    if (hit) {
      p.needsUpdate = true;
      g.computeBoundingSphere();
      g.computeBoundingBox();
      n += hit;
    }
  });
  return n;
}

// everything else the city has standing on the lot - the towers' podiums, the avenue's trees,
// lamps and signs - folded under the ground (not the mock-up's own)
function foldLot(w) {
  const L = { x0: LOT.x0 - 0.5, x1: LOT.x1 + 0.5, z0: LOT.z0 - 0.5, z1: LOT.z1 + 0.5 };
  let n = 0;
  const skip = new Set();
  w.group.traverse((o) => {
    if (o.name && o.name.startsWith('concept')) o.traverse((m) => skip.add(m));
  });
  w.group.traverse((m) => {
    const g = m.isMesh && !skip.has(m) && m.geometry;
    if (!g || !g.attributes.position || m.isInstancedMesh) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    if (!(bb.max.x > L.x0 && bb.min.x < L.x1 && bb.max.z > L.z0 && bb.min.z < L.z1 && bb.max.y > G + 0.3)) return;
    const e = m.matrixWorld.elements;
    const ident = e[0] === 1 && e[5] === 1 && e[10] === 1 && !e[12] && !e[13] && !e[14];
    if (!ident) return;
    const p = g.attributes.position;
    let hit = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      if (p.getY(i) > G + 0.3 && p.getY(i) < 400 && x > L.x0 && x < L.x1 && z > L.z0 && z < L.z1) {
        p.setY(i, -60);
        hit++;
      }
    }
    if (hit) {
      p.needsUpdate = true;
      g.computeBoundingSphere();
      g.computeBoundingBox();
      n += hit;
    }
  });
  return n;
}

export function setup(g) {
  const w = g.world;
  const ml = w.mainland;
  const orig = ml.buildBlock.bind(ml);
  ml.buildBlock = function* (b) {
    const live = yield* orig(b);
    if (SITE.blocks.includes(b.id)) empty(live);
    return live;
  };
  if (g.mallLife) g.mallLife.update = () => {};
  const already = SITE.blocks.filter((id) => [...ml.blocks.values()].some((l) => l.block && l.block.id === id));
  const folded = foldTowers(w);
  // stand in the middle of it (out of sight), the city round it built
  g.player.spawn(CX, CZ + 30, 0);
  g.player.rideHidden = true;
  ml.fill({ x: CX, z: CZ }, 30000);
  const lot = foldLot(w);
  return { already, folded, lot, towers: (w.ctx.mainTowers || []).filter((t) => SITE.blocks.includes(t.block)).length };
}

export function build(g, name) {
  if (built) {
    g.world.mainland.hide(built.group);
    dropConcept(built.group);
  }
  built = buildConcept(g.world, name);
  // (as the mainland shows its blocks: into a bucket, and the still city's)
  g.world.mainland.show(built.group, `concept-${name}`);
  return { verts: built.verts, meshes: built.meshes };
}

function clearSite(g, cam) {
  const near = (x, z, m) => (x > LOT.x0 - m && x < LOT.x1 + m && z > LOT.z0 - m && z < LOT.z1 + m) || (cam && Math.hypot(x - cam[0], z - cam[2]) < 34);
  let n = 0;
  for (const c of [...g.civilians.list]) if (c.pos && near(c.pos.x, c.pos.z, 3)) {
    g.civilians.remove(c);
    n++;
  }
  const T = g.traffic;
  for (const car of [...T.list]) if (near(car.pos.x, car.pos.z, 4)) {
    T.removeCar(car);
    T.list.splice(T.list.indexOf(car), 1);
    n++;
  }
  for (const pk of [...(T.parked || [])]) if (!pk.taken && near(pk.pos.x, pk.pos.z, 2)) {
    T.take(pk);
    n++;
  }
  return n;
}

// (from the crossings at the two north corners, a little up; from over the low roofs south-east; in
// the nave looking along it to the court; from the fourth floor's gallery across the court)
const VIEWS = {
  street: { pos: [-788, 20, -121], look: [CX - 6, 17, CZ - 12], fov: 60, hour: 13 },
  air: { pos: [CX + 150, 120, CZ + 190], look: [CX - 4, 6, CZ - 6], fov: 50, hour: 13 },
  inside: { pos: [VOID.x0 + 1.5, G + 1.75, CZ], look: [CX, G + 11, CZ], fov: 74, hour: 13 },
  gallery: { pos: [CX + 3, G + 17.9, CZ + 18.2], look: [CX - 4, G + 11, CZ - 14], fov: 76, hour: 13 },
  night: { pos: [-972, 20, -121], look: [CX + 6, 17, CZ - 12], fov: 60, hour: 21.6 },
};

export function view(g, name) {
  const v = VIEWS[name];
  if (g.daynight.hour === undefined || Math.abs(g.daynight.hour - v.hour) > 0.05) g.daynight.setHour(v.hour);
  const gone = clearSite(g, v.pos);
  for (let i = 0; i < 3; i++) g.update(1 / 30);
  clearSite(g, v.pos);
  g.update(1 / 30);
  foldLot(g.world);
  const cam = g.camera;
  cam.fov = v.fov;
  cam.far = Math.max(cam.far, 2500);
  cam.updateProjectionMatrix();
  cam.position.set(...v.pos);
  cam.lookAt(...v.look);
  cam.updateMatrixWorld(true);
  g.renderFrame();
  const ri = g.renderer.info.render;
  return { view: name, gone, calls: ri.calls, tris: ri.triangles };
}
