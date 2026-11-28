// The pause menu as a phone shows it: a picture of its top, one of its bottom, and where the test
// route's button is in it.
//   OUT=/path/prefix node tools/perf/pause.mjs
import { open } from './lib.mjs';

const { pg, close } = await open({ dsf: 1, frames: 5 });
await pg.evaluate(() => {
  document.getElementById('pause').classList.remove('hidden');
  document.body.classList.add('paused');
});
const OUT = process.env.OUT || 'pause';
await pg.screenshot({ path: OUT + '_top.png' });
const info = await pg.evaluate(() => {
  const s = document.querySelector('#pause .sheet');
  const ids = ['bench-btn', 'bench-btn-top'].filter((id) => document.getElementById(id));
  const before = ids.map((id) => [id, Math.round(document.getElementById(id).getBoundingClientRect().top), getComputedStyle(document.getElementById(id)).display]);
  s.scrollTop = s.scrollHeight;
  return { sheetHeight: s.clientHeight, sheetScrollHeight: s.scrollHeight, screenHeight: innerHeight, buttons: before };
});
console.log(JSON.stringify(info));
await pg.screenshot({ path: OUT + '_bottom.png' });
await close();
