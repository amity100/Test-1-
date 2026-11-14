// (ROADMAP 19, PHONE_SPEED_PLAN.md) The pause menu's test route run here, in the real loop, as a phone
// opens it (lib.mjs): a short route, then every stand - the island's, and the mainland's places - each
// frame stepped by hand. No graphics card here, so its milliseconds mean nothing; what this checks is
// that the route runs to its end, that every line of the report is there with sane numbers, and that
// the game is left as it was (GFX.off false, the drawing's scale back, the player where it began).
//
//   node tools/perf/bench.mjs             (EXTRA="newgfx=1" for the game with the new parts on;
//                                          SECS: the route's seconds (default 4); DT: game seconds a frame (0.5);
//                                          STILL: seconds of each stand (5); DRIVE: seconds of the drive on the mainland (30);
//                                          DSF: the pixel ratio (2.625, a phone's; 1 for a small picture and far quicker frames))
import { open } from './lib.mjs';

const SECS = +(process.env.SECS || 4);
const DT = +(process.env.DT || 0.5);
const STILL = +(process.env.STILL || 5);
const DRIVE = +(process.env.DRIVE || 30);
const { pg, close } = await open({ frames: 4, dsf: +(process.env.DSF || 2.625) });
const out = await pg.evaluate(async ([SECS, DT, STILL, DRIVE]) => {
  const g = window.__game;
  const { GFX } = await import('./js/core/util.js');
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  const before = { x: g.player.pos.x, z: g.player.pos.z, scale: g.pipe.scale };
  const perf = g.perf;
  perf.startBench(SECS, STILL, DRIVE);
  if (!perf.bench) return { error: 'the route did not start' };
  const seen = { off: false, places: new Set(), drive: false };
  let n = 0;
  while (perf.bench && n < 4000) {
    window.__frame(1, DT);
    n++;
    if (GFX.off) seen.off = true;
    if (perf.bench && perf.bench.drive) seen.drive = true;
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
    sawDrive: seen.drive,
    places: [...seen.places],
    mainland: !!(g.world.mainland && g.world.mainland.on),
  };
}, [SECS, DT, STILL, DRIVE]);
if (out.error) console.log(out.error);
else {
  console.log(out.report);
  console.log('----');
  console.log(`frames stepped ${out.frames}; finished ${out.finished}; the mainland ${out.mainland ? 'on' : 'off'}; places stood in: ${out.places.join(', ') || '-'}`);
  console.log(`the drive on the mainland ${out.sawDrive ? 'was run' : 'was not run'}`);
  console.log(`GFX.phone ${out.after.phone}, GFX.on ${out.after.on}; the 'as before' stand ${out.sawOff ? 'was seen (GFX.off true during it)' : 'was not run'}; GFX.off after: ${out.after.off}`);
  console.log(`the drawing's scale before ${out.before.scale.toFixed(3)}, after ${out.after.scale.toFixed(3)}; the player before (${out.before.x.toFixed(1)}, ${out.before.z.toFixed(1)}), after (${out.after.x.toFixed(1)}, ${out.after.z.toFixed(1)})`);
}
await close();
