// (ROADMAP 19.3, PHONE_SPEED_PLAN.md Stage 3.4) How much of what the drawing pass draws is the INSIDE of a shop's room -
// its walls, ceiling, floor, shelves and fixtures, not its goods (those are Interiors' own meshes, hidden by the same
// rule as the goods when nothing can be seen into the room: world/interiors.js viewHide) - as opposed to the hall's own
// structure. Every triangle of every piece drawn in the picture is put in the room whose volume holds its middle, if
// any. A shop's walls and shelves seen only through its front could be left out of a view that cannot see into it, as
// its goods are: this says how much that would be.
//
//   WHERE=mall_in node tools/perf/shopshell.mjs       (EXTRA="newgfx=1": with the parts as they are on)
import { open } from './lib.mjs';

const { pg, where, close } = await open({ frames: 30 });
const out = await pg.evaluate(() => {
  const g = window.__game;
  const I = g.world.interiors;
  const r = g.renderer;
  const W = g.pipe.size.x;
  const H = g.pipe.size.y;
  // the rooms' volumes
  const rooms = [];
  for (const rec of I.byRec.keys()) {
    const f = rec.f;
    const sp = rec.spec;
    if (!f || !sp) continue;
    // (its world box, from the corners of its footprint)
    const pts = [];
    for (const u of [sp.u0, sp.u1]) for (const w of [-sp.depth, 0]) pts.push(f.p(u, 0, w));
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of pts) {
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
      z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
    }
    rooms.push({ rec, f, sp, x0, x1, z0, z1, y0: rec.y, y1: rec.y + sp.h, kind: rec.kind });
  }
  // (a grid of 20 m cells over them)
  const CELL = 20;
  const grid = new Map();
  const key = (i, j) => i * 100003 + j;
  for (const R of rooms) for (let i = Math.floor(R.x0 / CELL); i <= Math.floor(R.x1 / CELL); i++) for (let j = Math.floor(R.z0 / CELL); j <= Math.floor(R.z1 / CELL); j++) {
    const k = key(i, j);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(R);
  }
  const roomAt = (x, y, z) => {
    const l = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!l) return null;
    for (const R of l) {
      if (y < R.y0 - 0.05 || y > R.y1 + 0.05 || x < R.x0 - 0.3 || x > R.x1 + 0.3 || z < R.z0 - 0.3 || z > R.z1 + 0.3) continue;
      const u = R.f.toU(x, z);
      const w = R.f.toW(x, z);
      if (u >= R.sp.u0 - 0.05 && u <= R.sp.u1 + 0.05 && w <= 0.05 && w >= -R.sp.depth - 0.05) return R;
    }
    return null;
  };
  // the pieces drawn in the picture
  const drawn = new Set();
  const f0 = r.renderBufferDirect;
  r.renderBufferDirect = function (camera, scene, geometry, material, object) {
    const rt = r.getRenderTarget();
    if (rt && rt.width === W && rt.height === H && object.isMesh && !object.isInstancedMesh && geometry.index && geometry.attributes.position) drawn.add(object);
    return f0.apply(this, arguments);
  };
  window.__frame(1);
  r.renderBufferDirect = f0;
  const rows = [];
  let total = 0;
  let inRooms = 0;
  let inGoods = 0;
  const byKind = {};
  const v = [0, 0, 0];
  for (const o of drawn) {
    const geo = o.geometry;
    const pos = geo.attributes.position.array;
    const ix = geo.index.array;
    const n = ix.length / 3;
    o.updateMatrixWorld(true);
    const e = o.matrixWorld.elements;
    const isGoods = /goods|live/.test(o.name || '') || (o.parent && /stock/.test(o.parent.name || ''));
    let inside = 0;
    for (let t = 0; t < n; t++) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) {
        const i = ix[t * 3 + k] * 3;
        const x = pos[i], y = pos[i + 1], z = pos[i + 2];
        cx += e[0] * x + e[4] * y + e[8] * z + e[12];
        cy += e[1] * x + e[5] * y + e[9] * z + e[13];
        cz += e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      const R = roomAt(cx / 3, cy / 3, cz / 3);
      if (R) {
        inside++;
        if (!isGoods) byKind[R.kind] = (byKind[R.kind] || 0) + 1;
      }
    }
    total += n;
    if (isGoods) inGoods += n;
    else inRooms += inside;
    if (n > 3000) rows.push([o.name || o.type, o.parent ? o.parent.name || '' : '', isGoods ? 'goods' : 'piece', Math.round(n / 100) / 10, Math.round((inside / n) * 100)]);
  }
  rows.sort((a, b) => b[3] - a[3]);
  return { total, inRooms, inGoods, rooms: rooms.length, byKind, rows: rows.slice(0, 40), pieces: drawn.size };
});
console.log(`${where}: ${out.rooms} rooms; the picture draws ${out.pieces} pieces, ${(out.total / 1000).toFixed(0)} K triangles; goods ${(out.inGoods / 1000).toFixed(0)} K; of the rest, ${(out.inRooms / 1000).toFixed(0)} K (${((out.inRooms / Math.max(1, out.total - out.inGoods)) * 100).toFixed(0)}%) lie inside a shop's room`);
console.log('by kind of shop (K triangles of the room itself):', Object.entries(out.byKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / 1000).toFixed(0)}`).join(', '));
for (const r of out.rows) console.log(`  ${String(r[3]).padStart(6)}K  ${String(r[4]).padStart(3)}% in rooms  ${r[2].padEnd(6)} ${r[0]} < ${r[1]}`);
await close();
