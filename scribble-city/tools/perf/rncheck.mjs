// (a probe for tools/perf/lib.mjs's repeatability) Who asks the dice for numbers when the test is not stepping a
// frame? Every Math.random call made outside window.__frame is counted by the place that made it.
//   node tools/perf/rncheck.mjs         (SECONDS: how long to wait after ready, default 20)
import { open } from './lib.mjs';

const init = () => {
  globalThis.__rnOut = new Map();
  globalThis.__inFrame = 0;
  const rnd = Math.random;
  Math.random = () => {
    if (!globalThis.__inFrame) {
      const st = (new Error().stack || '').split('\n').slice(2, 5).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ');
      globalThis.__rnOut.set(st, (globalThis.__rnOut.get(st) || 0) + 1);
    }
    return rnd();
  };
};
const { pg, close } = await open({ init, frames: 1 });
await pg.evaluate(() => {
  // from here: frames are stepped by the test only
  const f = window.__frame;
  window.__frame = (...a) => {
    globalThis.__inFrame++;
    try {
      return f(...a);
    } finally {
      globalThis.__inFrame--;
    }
  };
  globalThis.__rnOut.clear();
});
await pg.waitForTimeout(+(process.env.SECONDS || 20) * 1000);
await pg.evaluate(() => window.__frame(30, 1 / 30));
await pg.waitForTimeout(3000);
const out = await pg.evaluate(() => [...globalThis.__rnOut.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));
console.log('Math.random asked outside a stepped frame (after ready), by place:');
for (const [st, n] of out) console.log(`  ${String(n).padStart(6)}  ${st}`);
if (!out.length) console.log('  (none)');
await close();
