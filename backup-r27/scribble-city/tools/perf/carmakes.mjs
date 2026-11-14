// (PHONE_SPEED_PLAN.md Stage 1) How many triangles each make of each kind of car has: the full one, the
// one some way off, the one far off - body, glass, and the wheels' tyres and rims.
//   node tools/perf/carmakes.mjs      (put on with ?newgfx=1 by itself)
import { open } from './lib.mjs';

const { pg, close } = await open({ query: 'newgfx=1', frames: 2 });
const out = await pg.evaluate(() => {
  const g = window.__game;
  const C = g.cars;
  const tri = (m) => (m.mesh.geometry.index ? m.mesh.geometry.index.count : m.mesh.geometry.attributes.position.count) / 3;
  const rows = {};
  for (const [kind, P] of Object.entries(C.kinds)) rows[kind] = P.makes.map((L) => ({ shell: tri(L.shell), glass: tri(L.glass), sameGlassGeometry: L.glass.mesh.geometry === P.makes[0].glass.mesh.geometry }));
  return { rows, tyres: C.tyreMakes.map(tri), rims: C.rimMakes.map(tri), pxPerMetre: C.ppmK };
});
for (const [kind, ms] of Object.entries(out.rows)) console.log(`${kind.padEnd(8)} ` + ms.map((m, i) => `make ${i}: body ${m.shell} · glass ${m.glass}${m.sameGlassGeometry ? ' (same as make 0)' : ''}`).join('   '));
console.log('tyres (a wheel):', out.tyres.join(' / '), '  rims:', out.rims.join(' / '));
await close();
