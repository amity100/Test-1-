// (ROADMAP 19.6) How long the mainland's own "build everything round here now" (world/mainland/index.js fill) takes at the places the test
// route stands in, piece by piece - the blocks and tiles, the shop signs, the shops' insides, the walking nets - by the real clock (NODET=1 is
// put on by itself: the page's clock moves as the browser's does). A phone's processor is several times slower than this machine's: what takes
// a few seconds here stops the page for tens of seconds there, and a page that does not answer for that long looks stuck (the owner's word,
// on the test route's way to the mall).
//
//   node tools/perf/filltime.mjs          PLACES="-700,-37;-835,-37;-420,-379"
import { open } from './lib.mjs';

process.env.NODET = '1';
const PLACES = (process.env.PLACES || '-700,-37;-835,-37;-420,-379').split(';').map((s) => s.split(',').map(Number));
const { pg, close } = await open({ frames: 4, dsf: 1, det: false });
const out = await pg.evaluate(async (PLACES) => {
  const g = window.__game;
  const ml = g.world.mainland;
  const il = g.world.interiors;
  const nav = g.world.nav;
  const rows = [];
  for (const [x, z] of PLACES) {
    const row = { at: [x, z] };
    const live0 = ml.stream.live.size;
    let t = performance.now();
    const lap = () => {
      const n = performance.now();
      const d = n - t;
      t = n;
      return Math.round(d);
    };
    ml.stream.fill(x, z);
    row.blocks = lap();
    row.blocksBuilt = ml.stream.live.size - live0;
    row.pendingLeft = ml.stream.pending.length;
    ml.neon.flush(1e9);
    row.neon = lap();
    const il0 = il.stream.live.size;
    il.fill(x, z, 20000, 0);
    row.shops = lap();
    row.shopsBuilt = il.stream.live.size - il0;
    if (nav && nav.pump) nav.pump(1e9);
    row.nav = lap();
    row.total = row.blocks + row.neon + row.shops + row.nav;
    rows.push(row);
  }
  return rows;
}, PLACES);
for (const r of out) console.log(`at (${r.at.join(', ')}): blocks and tiles ${r.blocks} ms (${r.blocksBuilt} cells; ${r.pendingLeft} left waiting) - signs ${r.neon} ms - shops' insides ${r.shops} ms (${r.shopsBuilt} shops) - walking net ${r.nav} ms - together ${r.total} ms`);
await close();
