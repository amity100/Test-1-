// Of the still city's triangles drawn in a frame, how many belong to parts (by their id, aId) that
// are smaller than a few pixels in the picture - by the part's own distance, and by its whole
// piece's nearest distance (all that a draw range by size could leave out).
//   node tools/perf/parts.mjs             (WHERE=island | mall | mall_in | at:x,z,yaw)
import { open } from './lib.mjs';

const { pg, where, close } = await open({ frames: 40 });
const out = await pg.evaluate(() => {
  const g = window.__game;
  const r = g.renderer;
  const drawn = new Map();
  const f0 = r.renderBufferDirect;
  const H = g.pipe.size.y;
  r.renderBufferDirect = function (camera, scene, geometry, material, object) {
    const rt = r.getRenderTarget();
    if (rt && rt.height === H && rt.width === g.pipe.size.x && object.isMesh && !object.isInstancedMesh && geometry.index && geometry.attributes.aId) drawn.set(object, (drawn.get(object) || 0) + 1);
    return f0.apply(this, arguments);
  };
  window.__frame(1);
  r.renderBufferDirect = f0;
  const cam = g.camera;
  const ppmK = H / (2 * Math.tan((cam.fov * Math.PI) / 360));
  const cx = cam.position.x;
  const cy = cam.position.y;
  const cz = cam.position.z;
  const PX = [1.5, 3, 5, 8];
  const tot = { tris: 0, meshes: 0, part: PX.map(() => 0), piece: PX.map(() => 0) };
  const by = new Map();
  for (const [m] of drawn) {
    const geo = m.geometry;
    const idx = geo.index.array;
    const pos = geo.attributes.position.array;
    const ids = geo.attributes.aId.array;
    const dr = geo.drawRange;
    const cnt = Math.min(idx.length, dr.count === Infinity ? idx.length : dr.count);
    const e = m.matrixWorld.elements;
    const ident = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0;
    if (!ident) continue;
    const parts = new Map();
    for (let k = 0; k < cnt; k += 3) {
      const id = ids[idx[k]];
      let p = parts.get(id);
      if (!p) {
        p = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity, 0];
        parts.set(id, p);
      }
      for (let q = 0; q < 3; q++) {
        const v = idx[k + q] * 3;
        const x = pos[v];
        const y = pos[v + 1];
        const z = pos[v + 2];
        if (x < p[0]) p[0] = x;
        if (y < p[1]) p[1] = y;
        if (z < p[2]) p[2] = z;
        if (x > p[3]) p[3] = x;
        if (y > p[4]) p[4] = y;
        if (z > p[5]) p[5] = z;
      }
      p[6]++;
    }
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const bs = geo.boundingSphere;
    const dPiece = Math.max(1, Math.hypot(bs.center.x - cx, bs.center.y - cy, bs.center.z - cz) - bs.radius);
    const pen = m.material.name || (m.material.uniforms && m.material.uniforms.uKind ? 'k' + m.material.uniforms.uKind.value : '?');
    const row = by.get(pen) || { tris: 0, piece3: 0, part3: 0, parts: 0 };
    by.set(pen, row);
    for (const p of parts.values()) {
      const size = Math.hypot(p[3] - p[0], p[4] - p[1], p[5] - p[2]);
      const dx = Math.max(p[0] - cx, 0, cx - p[3]);
      const dy = Math.max(p[1] - cy, 0, cy - p[4]);
      const dz = Math.max(p[2] - cz, 0, cz - p[5]);
      const dPart = Math.max(1, Math.hypot(dx, dy, dz));
      tot.tris += p[6];
      row.tris += p[6];
      row.parts++;
      PX.forEach((px, i) => {
        if ((size * ppmK) / dPart < px) tot.part[i] += p[6];
        if ((size * ppmK) / dPiece < px) tot.piece[i] += p[6];
      });
      if ((size * ppmK) / dPart < 3) row.part3 += p[6];
      if ((size * ppmK) / dPiece < 3) row.piece3 += p[6];
    }
    tot.meshes++;
  }
  return { tot, PX, by: [...by.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 14) };
});
console.log(where, 'still pieces drawn:', out.tot.meshes, 'tris', Math.round(out.tot.tris / 1000) + 'K');
out.PX.forEach((px, i) => console.log(`  parts under ${px} px: by their own distance ${Math.round(out.tot.part[i] / 1000)}K (${((100 * out.tot.part[i]) / out.tot.tris).toFixed(0)}%), by their piece's ${Math.round(out.tot.piece[i] / 1000)}K (${((100 * out.tot.piece[i]) / out.tot.tris).toFixed(0)}%)`));
for (const [pen, r] of out.by) console.log(`   ${pen.padEnd(8)} tris ${String(Math.round(r.tris / 1000)).padStart(5)}K parts ${String(r.parts).padStart(6)}  under 3 px: own ${Math.round(r.part3 / 1000)}K, piece ${Math.round(r.piece3 / 1000)}K`);
await close();
