// What moves in the drawing's own pass - the people, the cars, what they hold: every draw that has no
// name, by its pen's kind, its shape's size (corners, triangles), how many of it, and what marks its
// shader (FOLK_HEAD: a real head; USE_ATLAS: one of the city's people's parts; USE_DENTS: a car's;
// PORTRAIT: a face drawn near). The 40 biggest.
//   node tools/perf/moving.mjs            (WHERE, EXTRA, COND: see lib.mjs)
import { open, KIND } from './lib.mjs';

const { pg, where, close } = await open();
const out = await pg.evaluate(() => {
  const g = window.__game;
  const r = g.renderer;
  const rows = [];
  const f0 = r.renderBufferDirect;
  const W = g.pipe.size.x;
  const H = g.pipe.size.y;
  r.renderBufferDirect = function (camera, scene, geometry, material, object) {
    const rt = r.getRenderTarget();
    if (rt && rt.width === W && rt.height === H && !object.name && !(object.parent && object.parent.name)) {
      const n = geometry.index ? geometry.index.count : geometry.attributes.position.count;
      const inst = object.isInstancedMesh ? object.count : geometry.isInstancedBufferGeometry ? Math.min(geometry.instanceCount, geometry._maxInstanceCount === undefined ? Infinity : geometry._maxInstanceCount) : 1;
      const k = material.uniforms && material.uniforms.uKind ? material.uniforms.uKind.value : -1;
      rows.push([k, geometry.attributes.position.count, n / 3, isFinite(inst) ? inst : 1, Object.keys(material.defines || {}).filter((d) => /PORTRAIT|FOLK|HERO|ATLAS|DENTS|MAPSET|LINES/.test(d)).join('+')]);
    }
    return f0.apply(this, arguments);
  };
  window.__frame(1);
  r.renderBufferDirect = f0;
  const C = g.civilians;
  return { rows, people: C && C.list ? C.list.length : null, cars: g.traffic ? g.traffic.list.length : null, parkShown: g.traffic ? g.traffic.parkShown : null };
});
console.log(where, 'people', out.people, 'traffic cars', out.cars, 'parked shown', out.parkShown);
out.rows.sort((a, b) => b[2] * b[3] - a[2] * a[3]);
let tot = 0;
const sums = { heads: 0, folk: 0, cars: 0, rest: 0 };
for (const r of out.rows) {
  const t = r[2] * r[3];
  tot += t;
  if (/FOLK_HEAD/.test(r[4])) sums.heads += t;
  else if (/USE_ATLAS/.test(r[4])) sums.folk += t;
  else if (/USE_DENTS/.test(r[4])) sums.cars += t;
  else sums.rest += t;
}
console.log('  ' + Object.entries(sums).map(([k, n]) => `${k} ${Math.round(n / 1000)}K`).join(' · ') + '   (folk: the parts of the city\'s people besides their heads; cars: bodies and glass, without wheels; rest: hair, far walkers, wheels, lines...)');
for (const [k, verts, tris, inst, defs] of out.rows.slice(0, 40)) console.log(`  ${String(Math.round((tris * inst) / 1000)).padStart(5)}K  ${(KIND[k] || k + '').padEnd(6)} shape ${String(verts).padStart(6)} corners ${String(Math.round(tris)).padStart(6)} tris  x${String(inst).padStart(4)}  ${defs}`);
console.log('  total', Math.round(tot / 1000) + 'K in', out.rows.length, 'draws');
await close();
