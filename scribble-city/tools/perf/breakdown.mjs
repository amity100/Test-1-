// One frame's draws, each put down to what it is - the pass (its picture's size), the thing drawn
// (its name, or its parents': DEPTH of them, 3), its pen - and added up; the biggest of the drawing's
// own pass listed (TOP of them, 45).
//   node tools/perf/breakdown.mjs         (WHERE, EXTRA, COND: see lib.mjs)
import { open } from './lib.mjs';

const { pg, where, close } = await open();
const out = await pg.evaluate((depth) => {
  const g = window.__game;
  const r = g.renderer;
  const rows = new Map();
  const f0 = r.renderBufferDirect;
  r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    const rt = r.getRenderTarget();
    const pass = rt ? `${rt.width}x${rt.height}` : 'screen';
    let n = group ? group.count : geometry.index ? geometry.index.count : geometry.attributes.position ? geometry.attributes.position.count : 0;
    const dr = geometry.drawRange;
    if (!group && dr && dr.count !== Infinity) n = Math.min(n, dr.count);
    let inst = 1;
    if (object.isInstancedMesh) inst = object.count;
    else if (geometry.isInstancedBufferGeometry) inst = Math.min(geometry.instanceCount, geometry._maxInstanceCount === undefined ? Infinity : geometry._maxInstanceCount);
    if (!isFinite(inst)) inst = 1;
    const chain = [];
    let o = object;
    let k = 0;
    while (o && k < depth) {
      if (o.name) chain.push(o.name);
      o = o.parent;
      k++;
    }
    const name = chain.join(' < ') || '(unnamed)';
    const mat = (material.name || (material.userData && material.userData.kind) || material.type || '').toString();
    const key = pass + ' | ' + name + ' | ' + mat;
    const e = rows.get(key) || { draws: 0, idx: 0 };
    e.draws++;
    e.idx += n * inst;
    rows.set(key, e);
    return f0.apply(this, arguments);
  };
  window.__frame(1);
  r.renderBufferDirect = f0;
  const I = g.world.interiors;
  return { rows: [...rows.entries()].map(([k, v]) => [k, v.draws, v.idx]), main: `${g.pipe.size.x}x${g.pipe.size.y}`, shops: I && I.viewStats ? I.viewStats : null };
}, +(process.env.DEPTH || 3));
const byPass = new Map();
for (const [k, d, n] of out.rows) {
  const p = k.split(' | ')[0];
  const e = byPass.get(p) || { draws: 0, idx: 0 };
  e.draws += d;
  e.idx += n;
  byPass.set(p, e);
}
console.log('== ' + where + ' : passes');
for (const [p, e] of byPass) console.log(`  ${p}  draws ${e.draws}  tris ${(e.idx / 3 / 1000).toFixed(0)}K`);
if (out.shops) console.log('== shops live', out.shops.live, 'left out of the last view', out.shops.hidden);
const main = out.main;
console.log('== the drawing itself, ' + main + ' : the biggest');
const rows = out.rows.filter(([k]) => k.startsWith(main + ' | ')).sort((a, b) => b[2] - a[2]);
let tot = 0;
for (const r of rows) tot += r[2];
// (by what they are: the shops' goods, the mainland's blocks, the island, what moves)
const group = { goods: 0, mainland: 0, island: 0, moving: 0 };
for (const [k, , n] of rows) {
  const name = k.slice(main.length + 3);
  if (name.startsWith('(unnamed)')) group.moving += n;
  else if (/stock /.test(name)) group.goods += n;
  else if (/mainland\d|block /.test(name)) group.mainland += n;
  else group.island += n;
}
console.log('  ' + Object.entries(group).map(([k, n]) => `${k} ${(n / 3 / 1000).toFixed(0)}K (${((100 * n) / Math.max(1, tot)).toFixed(0)}%)`).join(' · '));
for (const [k, d, n] of rows.slice(0, +(process.env.TOP || 45))) console.log(`  ${(n / 3 / 1000).toFixed(0).padStart(6)}K ${((100 * n) / tot).toFixed(1).padStart(5)}%  x${d}  ${k.slice(main.length + 3)}`);
console.log('  total', (tot / 3 / 1000).toFixed(0) + 'K tris in', rows.length, 'kinds');
await close();
