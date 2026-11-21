// (ROADMAP 19.4, PHONE_SPEED_PLAN.md 5.1, "what a stall is made of") The test route's drive on the mainland
// (game/perf.js beginDrive / driveStep / driveLines) run here by itself, in the real loop as a phone opens it
// (lib.mjs): straight to the drive - the island's route and stands left out - then every frame stepped by hand.
// No graphics card here, and the page's clock stands still unless NODET=1, so the milliseconds mean nothing;
// what this checks is that the drive begins where it should, goes along the causeway and the boulevard to the
// mall's door at the speed it says, that each frame carries what the streamers did in it, that the report's
// lines are all there with sane numbers, and that the game is left as it was (the streamers' own calls put
// back, GFX.off false, the player where it began).
//
//   node tools/perf/drive.mjs          SECS: seconds of the drive (default 30); DT: game seconds a frame (0.25)
//                                      NODET=1: the real clock (the streamers keep to their slices of a frame, as in play)
//                                      DSF=1: device pixel ratio (a small picture: the frames are far cheaper)
//                                      (EXTRA="newgfx=1" for the game with the new parts on)
import { open } from './lib.mjs';

const SECS = +(process.env.SECS || 30);
const DT = +(process.env.DT || 0.25);
const DSF = +(process.env.DSF || 1);
const { pg, close } = await open({ frames: 4, dsf: DSF });
const out = await pg.evaluate(async ([SECS, DT]) => {
  const g = window.__game;
  const { GFX } = await import('./js/core/util.js');
  const { groundHeight } = await import('./js/world/layout.js');
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  const before = { x: g.player.pos.x, z: g.player.pos.z, scale: g.pipe.scale };
  const ml = g.world.mainland;
  const il = g.world.interiors;
  const own = { ml: Object.prototype.hasOwnProperty.call(ml, 'update'), il: Object.prototype.hasOwnProperty.call(il, 'update') };
  const perf = g.perf;
  perf.startBench(0.5, 0.1, SECS);
  if (!perf.bench) return { error: 'the route did not start' };
  const b = perf.bench;
  // (straight to the drive)
  b.stands = [];
  b.islandN = 0;
  b.stages = null;
  const track = [];
  const hooked = [];
  let n = 0;
  let moved = 0;
  let last = null;
  while (perf.bench && n < 6000) {
    window.__frame(1, DT);
    n++;
    const D = perf.bench && perf.bench.drive;
    if (D) {
      if (hooked.length === 0) hooked.push(Object.prototype.hasOwnProperty.call(ml, 'update'), Object.prototype.hasOwnProperty.call(il, 'update'));
      const c = g.camera.position;
      // (the jump from where the player was to the drive's start is not part of the drive: after the settle only)
      if (last && D.t > D.settle + 1e-6) moved = Math.max(moved, Math.hypot(c.x - last.x, c.z - last.z));
      last = { x: c.x, z: c.z };
      if (n % 12 === 0) track.push([+D.t.toFixed(1), +D.d.toFixed(0), +c.x.toFixed(0), +c.y.toFixed(1), +c.z.toFixed(0), +groundHeight(c.x, c.z).toFixed(2), ml.stream.live.size, ml.stream.pending.length, il.stream.live.size]);
    }
  }
  const mid = { x: g.player.pos.x, z: g.player.pos.z };
  return {
    frames: n,
    finished: !perf.bench,
    report: perf.lastReport || null,
    track,
    hooked,
    own,
    ownAfter: { ml: Object.prototype.hasOwnProperty.call(ml, 'update'), il: Object.prototype.hasOwnProperty.call(il, 'update') },
    moved,
    after: { x: g.player.pos.x, z: g.player.pos.z, scale: g.pipe.scale, off: GFX.off },
    before,
    mid,
    mainland: !!(ml && ml.on),
  };
}, [SECS, DT]);
if (out.error) console.log(out.error);
else {
  console.log(out.report);
  console.log('----');
  console.log('t(s) along(m)   x     y     z  ground  live pending shops');
  for (const r of out.track) console.log(r.map((v) => String(v).padStart(7)).join(' '));
  console.log(`frames stepped ${out.frames}; finished ${out.finished}; the mainland ${out.mainland ? 'on' : 'off'}`);
  console.log(`the streamers' calls wrapped during the drive: mainland ${out.hooked[0]}, shops ${out.hooked[1]}; own properties before ${JSON.stringify(out.own)}, after ${JSON.stringify(out.ownAfter)}`);
  console.log(`the most the camera moved in one frame ${out.moved.toFixed(1)} m (the speed asked: ${(20 * DT).toFixed(1)} m a frame at 20 m/s); GFX.off after: ${out.after.off}`);
  console.log(`the drawing's scale before ${out.before.scale.toFixed(3)}, after ${out.after.scale.toFixed(3)}; the player before (${out.before.x.toFixed(1)}, ${out.before.z.toFixed(1)}), after (${out.after.x.toFixed(1)}, ${out.after.z.toFixed(1)})`);
}
await close();
