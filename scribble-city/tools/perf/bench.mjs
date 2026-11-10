// (ROADMAP 19, PHONE_SPEED_PLAN.md) The pause menu's test route run here, in the real loop, as a phone
// opens it (lib.mjs): a short route, then every stand - the island's, and the mainland's places - each
// frame stepped by hand. No graphics card here, so its milliseconds mean nothing; what this checks is
// that the route runs to its end, that every line of the report is there with sane numbers, and that
// the game is left as it was (GFX.off false, the drawing's scale back, the player where it began).
//
//   node tools/perf/bench.mjs             (EXTRA="newgfx=1" for the game with the new parts on;
//                                          SECS: the route's seconds (default 4); DT: game seconds a frame (0.5))
import { open } from './lib.mjs';

const SECS = +(process.env.SECS || 4);
const DT = +(process.env.DT || 0.5);
const { pg, close } = await open({ frames: 4 });
const out = await pg.evaluate(async ([SECS, DT]) => {
  const g = window.__game;
  const { GFX } = await import('./js/core/util.js');
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  const before = { x: g.player.pos.x, z: g.player.pos.z, scale: g.pipe.scale };
  const perf = g.perf;
  perf.startBench(SECS, 5);
  if (!perf.bench) return { error: 'the route did not start' };
  const seen = { off: false, places: new Set() };
  let n = 0;
  while (perf.bench && n < 4000) {
    window.__frame(1, DT);
    n++;
    if (GFX.off) seen.off = true;
    const s = perf.bench && perf.bench.still;
    if (s && s.place) seen.places.add(s.place.name);
  }
  return {
    frames: n,
    finished: !perf.bench,
    report: perf.lastReport || null,
    after: { x: g.player.pos.x, z: g.player.pos.z, scale: g.pipe.scale, off: GFX.off, on: GFX.on, phone: GFX.phone },
    before,
    sawOff: seen.off,
    places: [...seen.places],
    mainland: !!(g.world.mainland && g.world.mainland.on),
  };
}, [SECS, DT]);
if (out.error) console.log(out.error);
else {
  console.log(out.report);
  console.log('----');
  console.log(`frames stepped ${out.frames}; finished ${out.finished}; the mainland ${out.mainland ? 'on' : 'off'}; places stood in: ${out.places.join(', ') || '-'}`);
  console.log(`GFX.phone ${out.after.phone}, GFX.on ${out.after.on}; the 'as before' stand ${out.sawOff ? 'was seen (GFX.off true during it)' : 'was not run'}; GFX.off after: ${out.after.off}`);
  console.log(`the drawing's scale before ${out.before.scale.toFixed(3)}, after ${out.after.scale.toFixed(3)}; the player before (${out.before.x.toFixed(1)}, ${out.before.z.toFixed(1)}), after (${out.after.x.toFixed(1)}, ${out.after.z.toFixed(1)})`);
}
await close();
