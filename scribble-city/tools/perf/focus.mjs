// (ROADMAP 19.6, the owner's word: "a test specifically for the places where the speed was improved") The focused test (game/perf.js
// focusInit, focusStep, focusText) run here in the real loop's frame (lib.mjs): each place stood in, the mainland's built round the player a
// little a frame, the conditions turning about in blocks of a second, the report at the end. No graphics card here, and the page's clock stands
// still unless NODET=1: the milliseconds mean nothing; what this checks is that every place is reached and built, that the turn of conditions
// goes as it should (now / before, and at the key places the lowest resolution and no drawing), that the crowd is made and sent off, that
// the report has every line with sane numbers, and that the game is left as it was.
//
//   node tools/perf/focus.mjs        QUICK=1 (the default: a few frames of each condition)   DT: game seconds a frame (0.1)   DSF=1
//                                    (EXTRA="newgfx=1" for the game with the new parts on - put on by itself unless EXTRA is given)
import { open } from './lib.mjs';

const DT = +(process.env.DT || 0.1);
const QUICK = process.env.QUICK !== '0';
const DSF = +(process.env.DSF || 1);
const MODE = process.env.MODE || 'focus';
const { pg, close } = await open({ frames: 4, dsf: DSF, query: process.env.EXTRA === undefined ? 'newgfx=1' : process.env.EXTRA });
const out = await pg.evaluate(async ([DT, QUICK, MODE]) => {
  const g = window.__game;
  const { GFX } = await import('./js/core/util.js');
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  const before = { x: g.player.pos.x, z: g.player.pos.z, scale: g.pipe.scale, civ: g.civilians.list.length };
  const perf = g.perf;
  perf.startBench(0, 0, 0, MODE);
  if (!perf.bench) return { error: 'the test did not start' };
  if (QUICK) perf.bench.focus.quick = true;
  const phases = [];
  let last = '';
  let n = 0;
  let crowd = 0;
  const gfx = [];
  while (perf.bench && n < 6000) {
    window.__frame(1, DT);
    n++;
    const F = perf.bench && perf.bench.focus;
    if (F) {
      const key = `${F.i}:${F.spot ? F.spot.id : '-'}:${F.phase}`;
      if (key !== last) {
        phases.push([n, key]);
        last = key;
      }
      if (F.crowd) crowd = Math.max(crowd, F.crowd.length);
      const gk = `${F.cond}/${GFX.off ? 'off' : 'on'}/${perf.bench.noDraw ? 'nodraw' : 'draw'}/${g.pipe.scale.toFixed(2)}`;
      if (F.phase === 'measure' && !gfx.includes(gk)) gfx.push(gk);
    }
  }
  return {
    frames: n,
    finished: !perf.bench,
    report: perf.lastReport || null,
    phases,
    crowd,
    gfx,
    crowdLeft: g.civilians.list.filter((c) => c.owner && c.owner.focus && !c.gone).length,
    after: { x: g.player.pos.x, z: g.player.pos.z, scale: g.pipe.scale, off: GFX.off, on: GFX.on },
    before,
    loopErrors: g.loopErrors || null,
    stored: (() => {
      try {
        const s = JSON.parse(localStorage.getItem('sc5-bench'));
        return { done: s.done, mode: s.mode, textLines: s.text ? s.text.split('\n').length : 0 };
      } catch (e) {
        return null;
      }
    })(),
  };
}, [DT, QUICK, MODE]);
if (out.error) console.log(out.error);
else {
  console.log(out.report);
  console.log('----');
  console.log(`frames stepped ${out.frames}; finished ${out.finished}; people of the crowd made ${out.crowd}, left after ${out.crowdLeft}`);
  console.log('phases (frame, place:phase):', out.phases.map((p) => `${p[0]} ${p[1]}`).join(' | '));
  console.log('conditions seen while measuring (condition/GFX/drawing/scale):', out.gfx.join('  '));
  console.log(`GFX.off after: ${out.after.off}; the scale before ${out.before.scale.toFixed(3)}, after ${out.after.scale.toFixed(3)}; the player before (${out.before.x.toFixed(1)}, ${out.before.z.toFixed(1)}), after (${out.after.x.toFixed(1)}, ${out.after.z.toFixed(1)})`);
  console.log(`the report kept for the next visit: ${JSON.stringify(out.stored)}; loop errors: ${JSON.stringify(out.loopErrors)}`);
}
await close();
