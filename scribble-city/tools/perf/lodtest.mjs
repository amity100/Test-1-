// (ROADMAP 19.2, PHONE_SPEED_PLAN.md Stage 2) The people's lighter shapes on their own: the simplifier
// (v5/js/render/simplify.js) run on the base head with no game round it (tools/perf/lod.html), how many
// triangles are left, how long it takes, and - exactly, in both directions - how far the lighter surface is
// from the full one.
//
//   node tools/perf/lodtest.mjs info                       the base head: corners, triangles, borders
//   node tools/perf/lodtest.mjs head 3.5 10                the head simplified to an error of 3.5 mm, and 10 mm
//   node tools/perf/lodtest.mjs parts                      every part of the phone's kinds of people: the layouts of triangles they share
//   node tools/perf/lodtest.mjs part torso 2.6 [kind]      one part simplified
//   node tools/perf/lodtest.mjs shapes                     the layouts the game's shapes share (name, corners, triangles)
//   OUT=f.json node tools/perf/lodtest.mjs bake            the lighter lists of every layout, as far as half a pixel allows (minutes)
//   node tools/perf/lodtest.mjs write f.json               -> v5/js/render/folklod.js
//   node tools/perf/lodtest.mjs verify                     the file's lists are for layouts the game has
//     UV=0.004 NOR=0.25 MOUTH=0.1 MOVE=3.5 (mm)  the tolerances of the attributes (0 = not checked); CREASE=0.7 FLIP=0.5
//     NOMEASURE=1     no distance measuring (only the counts and the time)
import { startServer, launch } from '../shot.mjs';

const [, , mode = 'info', ...rest] = process.argv;
const server = await startServer();
const browser = await launch();
const pg = await browser.newPage();
pg.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
pg.on('console', (m) => {
  if (m.type() === 'error') console.log('console.error ' + m.text().slice(0, 300));
});
await pg.goto(`http://127.0.0.1:${server.address().port}/tools/perf/lod.html`);
await pg.waitForFunction('window.ready === true', null, { timeout: 120000 });
const num = (k, d) => (process.env[k] === undefined ? d : +process.env[k]);
if (mode === 'info') {
  console.log(JSON.stringify(await pg.evaluate(() => window.headInfo())));
} else if (mode === 'parts') {
  console.log(JSON.stringify(await pg.evaluate(() => window.partInfo()), null, 1));
} else if (mode === 'shapes') {
  // the shapes the game has drawn by their corners, by layout: name, corners, triangles
  const rows = await pg.evaluate(() => window.gameShapes());
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.sig)) by.set(r.sig, { sig: r.sig, tris: r.tris, names: [], lod: r.lod });
    by.get(r.sig).names.push(r.name);
  }
  for (const L of [...by.values()].sort((a, b) => b.tris - a.tris)) {
    const names = L.names.length > 4 ? `${L.names.slice(0, 3).join(', ')} ... (${L.names.length})` : L.names.join(', ');
    console.log(String(L.tris).padStart(6), L.sig.padEnd(26), L.lod.padEnd(7), names);
  }
} else if (mode === 'bake') {
  // the lighter lists of every layout the people have (the ones worth a draw call), each as far from the full shape
  // as half a pixel allows where it is used - written as JSON to OUT (then: node tools/perf/lodtest.mjs write <json>)
  const out = process.env.OUT || 'lod-bake.json';
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const list = await pg.evaluate(() => window.bakeList());
  // (uvMm: how far the picture may slide on the surface, in millimetres - its units to a metre differ a great deal
  // from part to part, a hand's thirty, a pelvis's a half)
  const HEAD = [
    { maxErr: 0.0019, uvMm: 2.2, nor: 0.3, mouth: 0.1, move: 0.002, crease: 0.7, limit: 0.55 / 150 * 1000 },
    { maxErr: 0.0048, uvMm: 4.4, nor: 0.5, mouth: 0.1, move: 0.008, crease: 0.4, limit: 0.55 / 55 * 1000 },
  ];
  const BODY = [{ maxErr: 0.002, uvMm: 2.5, nor: 0.3, crease: 0.7, limit: 0.55 / 110 * 1000 }];
  const res = [];
  for (const e of list) {
    if (e.tris < 300 || (only && !only.some((o) => e.name.includes(o)))) continue;
    const levels = /_head$/.test(e.name) ? HEAD : BODY;
    const t0 = Date.now();
    const r = await pg.evaluate(([i, l]) => window.bakeOne(i, l), [e.i, levels]);
    res.push(r);
    console.log(`${String(e.tris).padStart(5)} ${e.name.padEnd(16)} x${String(r.shapes).padEnd(4)}`, r.levels.map((l) => `${l.tris} tris (error ${l.errMm} mm, farthest ${l.devMax} mm, 99% ${l.devP99} mm, ${l.iter + 1} tries${l.ok ? '' : ', NOT within its limit'})`).join('  |  '), `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  (await import('node:fs')).writeFileSync(out, JSON.stringify(res));
  console.log('written', out);
} else if (mode === 'write') {
  // node tools/perf/lodtest.mjs write <bake.json>  ->  v5/js/render/folklod.js
  const fs = await import('node:fs');
  const res = JSON.parse(fs.readFileSync(rest[0], 'utf8'));
  const lines = [];
  let bytes = 0;
  for (const r of res) {
    const keep = [];
    for (const l of r.levels) {
      if (!l.ok || r.tris - l.tris < 120 || l.tris > r.tris * 0.8) break;
      keep.push(l);
    }
    if (!keep.length) continue;
    bytes += keep.reduce((a, l) => a + l.b64.length, 0);
    const what = keep.map((l) => `${l.tris} triangles, farthest ${l.devMax} mm from the full shape`).join('; ');
    lines.push(`  // ${r.name}${r.shapes > 1 ? ` (and ${r.shapes - 1} more of its layout)` : ''}: ${r.tris} triangles -> ${what}`);
    lines.push(`  ${JSON.stringify(r.sig)}: [${keep.map((l) => JSON.stringify(l.b64)).join(', ')}],`);
  }
  const head = `// GENERATED by tools/perf/lodtest.mjs (bake, then write) - do not edit by hand.
// (ROADMAP 19.2, PHONE_SPEED_PLAN.md Stage 2) The people's shapes in fewer triangles, over the same corners (made with
// render/simplify.js; see render/lod.js). Named by the layout of triangles they are for, 'corners/triangles/sum': a shape
// whose layout is not here is drawn in full. Each is a Uint16Array of triangles, base64, the first for a person whose
// metre is under 110 pixels (a head: 150), the second (a head's) under 55; each the farthest it is, measured on the
// shapes of the people themselves, from the full shape - at most half a pixel where it starts to be used.
export const LIGHT = {
${lines.join('\n')}
};
`;
  fs.writeFileSync(new URL('../../v5/js/render/folklod.js', import.meta.url), head);
  console.log(`written v5/js/render/folklod.js: ${res.length} layouts baked, ${(head.length / 1024).toFixed(0)} KB`);
} else if (mode === 'verify') {
  // the file's lists are for layouts the game has, and are lists of triangles over their corners
  const r = await pg.evaluate(async () => {
    const { LIGHT } = await import('/v5/js/render/folklod.js');
    const shapes = window.gameShapes();
    const have = new Map(shapes.map((s) => [s.sig, s]));
    const bad = [];
    let lists = 0;
    for (const [sig, e] of Object.entries(LIGHT)) {
      const g = have.get(sig);
      if (!g) {
        bad.push(`${sig}: no such layout in the game`);
        continue;
      }
      for (const b64 of e) {
        lists++;
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const ix = new Uint16Array(u8.buffer);
        if (ix.length % 3) bad.push(`${sig}: not triangles`);
        for (let i = 0; i < ix.length; i++) if (ix[i] >= g.corners) { bad.push(`${sig}: a corner past the end`); break; }
        if (ix.length / 3 >= g.tris) bad.push(`${sig}: not fewer triangles`);
      }
    }
    return { layouts: Object.keys(LIGHT).length, lists, bad };
  });
  console.log(JSON.stringify(r));
  if (r.bad.length) process.exitCode = 1;
} else if (mode === 'uvdensity') {
  const list = await pg.evaluate(() => window.bakeList());
  for (const e of list) console.log(String(e.tris).padStart(5), e.name.padEnd(16), `${e.uvPerMetre} uv units to a metre -> uv 0.006 is ${(0.006 / (e.uvPerMetre || 1) * 1000).toFixed(1)} mm of surface`);
} else if (mode === 'products') {
  const mm = +(rest[0] || 5);
  const rows = await pg.evaluate((mm) => window.productInfo(mm), mm);
  rows.sort((a, b) => (b.low || 0) - (a.low || 0));
  for (const r of rows) console.log(r.error ? `${r.name}: ${r.error}` : `${String(r.full).padStart(6)} full ${String(r.low).padStart(6)} low ${String(r.far).padStart(6)} far   corners ${String(r.lowVerts).padStart(5)} -> ${String(r.farVerts).padStart(5)}   farthest ${String(r.devMm).padStart(5)} mm (99% ${r.p99Mm})   ${r.name}`);
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  console.log(`${rows.length} products: ${sum('full')} triangles in the full make, ${sum('low')} in the low one, ${sum('far')} in the far one`);
} else if (mode === 'bakex') {
  // one layout with settings of one's own: node tools/perf/lodtest.mjs bakex <name> <maxErr mm> <uv> <nor> <crease> <limit mm>
  const [name, mm, uv, nor, crease, limit] = rest;
  const list = await pg.evaluate(() => window.bakeList());
  const e = list.find((x) => x.name.includes(name));
  if (!e) throw new Error('no such layout');
  const L = { maxErr: +mm / 1000, uv: +uv, nor: +nor, crease: +crease, limit: +limit };
  const r = await pg.evaluate(([i, l]) => window.bakeOne(i, [l]), [e.i, L]);
  console.log(e.name, e.tris, '->', r.levels.map((l) => `${l.tris} tris (error ${l.errMm} mm, farthest ${l.devMax} mm, 99% ${l.devP99} mm, ok ${l.ok})`).join(' | '));
} else if (mode === 'part') {
  // node tools/perf/lodtest.mjs part torso 2.6 [kind]   (UV, NOR, CREASE, FLIP as for the head)
  const [name, mm = '2.6', kind = '0'] = rest;
  const cfg = { maxErr: +mm / 1000, uvTol: num('UV', 0.006), norTol: num('NOR', 0.3), creaseCos: num('CREASE', 0.7), flipCos: num('FLIP', 0.5), measure: !process.env.NOMEASURE };
  console.log(JSON.stringify(await pg.evaluate(([n, k, c]) => window.partTrial(n, k, c), [name, +kind, cfg])));
} else if (mode === 'head') {
  for (const mm of rest.length ? rest.map(Number) : [3.5, 10]) {
    const cfg = {
      maxErr: mm / 1000,
      uvTol: num('UV', 0.004),
      norTol: num('NOR', 0.25),
      mouthTol: num('MOUTH', 0.1),
      moveTol: num('MOVE', mm) / 1000,
      creaseCos: num('CREASE', 0.7),
      flipCos: num('FLIP', 0.5),
      measure: !process.env.NOMEASURE,
    };
    const r = await pg.evaluate((c) => window.headTrial(c), cfg);
    console.log(`head, error ${mm} mm:`, JSON.stringify(r));
  }
}
await browser.close();
server.close();
