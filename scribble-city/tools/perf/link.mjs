// (ROADMAP 19.4, PHONE_SPEED_PLAN.md 5.1; the owner's word: "a link that runs the performance test by itself, without
// entering the game") The dedicated link, opened here the way the player's own phone opens it - a screen of 882 x 411 CSS
// pixels held sideways, touch, and the REAL loop (no test=1: the page's own animation frames, its own start screen) - and
// watched: that the game goes straight into the city (the title page gone, no opening film), that the test route begins by
// itself, that its progress is on the screen, that the screen is asked to be kept awake, and that at its end the report is
// shown with its copy and close buttons. No graphics card here (SwiftShader), so a frame takes seconds: FAST=1 (the default)
// cuts the route's parts short once it has begun (the stands, the length of the drive); FAST=0 lets it run its whole length.
//
//   node tools/perf/link.mjs <outDir>          QUERY="perftest=quick&newgfx=1" (the address's query)   DSF=1   FAST=1
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from '../shot.mjs';

const OUT = process.argv[2] || 'link-out';
fs.mkdirSync(OUT, { recursive: true });
const QUERY = process.env.QUERY || 'perftest=quick&newgfx=1';
const DSF = +(process.env.DSF || 1);
const FAST = process.env.FAST !== '0';
const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 882, height: 411 }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const logs = [];
pg.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
pg.on('console', (m) => {
  if (m.type() === 'error') logs.push('console.error ' + m.text().slice(0, 200));
});
// (a screen wake lock: a headless browser may refuse one - a stand-in here, to see that it is asked for and let go of)
await pg.addInitScript(() => {
  window.__wake = { asked: 0, released: 0 };
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async () => {
        window.__wake.asked++;
        return { release: async () => void window.__wake.released++ };
      },
    },
  });
});
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(5) + ' s';
await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?${QUERY}`);
console.log(`${stamp()}  opened ?${QUERY}`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 1500000, polling: 1000 });
console.log(`${stamp()}  the game is ready`);
// (the start screen - the loading page - must have gone by itself, and the card with its button be over the city)
await pg.waitForSelector('#perf-start button', { timeout: 60000 });
await pg.waitForFunction(() => document.getElementById('loader').classList.contains('gone'), null, { timeout: 60000 });
await pg.waitForTimeout(500);
await pg.screenshot({ path: path.join(OUT, 'link_card.png'), timeout: 180000 });
{
  const s0 = await pg.evaluate(() => ({ bench: !!window.__game.perf.bench, loader: document.getElementById('loader').className }));
  console.log(`${stamp()}  the card is shown; the loading page: "${s0.loader}"; the test has begun by itself: ${s0.bench} (it must wait for the tap)`);
}
await pg.tap('#perf-start button');
console.log(`${stamp()}  tapped`);
const peek = () =>
  pg.evaluate(() => {
    const g = window.__game;
    const p = g.perf;
    const title = document.getElementById('title');
    const loader = document.getElementById('loader');
    const prog = document.getElementById('perf-progress');
    const rep = document.getElementById('perf-report');
    return {
      state: g.state,
      titleHidden: !!title && title.classList.contains('hidden'),
      loaderGone: !!loader && loader.classList.contains('gone'),
      prologue: !!(g.prologue && g.prologue.active),
      bench: p.bench ? (p.bench.drive ? 'drive' : p.bench.still ? 'stands' : 'route') : null,
      progress: prog ? prog.textContent : null,
      report: !!rep && !rep.classList.contains('hidden'),
      wake: window.__wake,
      player: [+g.player.pos.x.toFixed(0), +g.player.pos.z.toFixed(0)],
    };
  });
let began = false;
let cut = false;
let last = '';
for (let i = 0; i < 4000; i++) {
  const s = await peek();
  const line = JSON.stringify({ ...s, progress: s.progress ? s.progress.replace(/\n/g, ' | ') : null });
  if (line !== last) {
    console.log(`${stamp()}  ${line}`);
    last = line;
  }
  if (s.bench && !began) {
    began = true;
    // (the progress is on the screen: a picture of it)
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: path.join(OUT, 'link_progress.png'), timeout: 180000 });
  }
  if (s.bench && FAST && !cut) {
    cut = true;
    // (the rest cut short: the stands not stood, the route's walk ended, a one-second drive)
    await pg.evaluate(() => {
      const b = window.__game.perf.bench;
      b.stands = [];
      b.islandN = 0;
      b.stages = null;
      b.driveSecs = 1;
      b.t = b.warm + b.secs - 0.05;
    });
    console.log(`${stamp()}  (cut short)`);
  }
  if (s.report) break;
  await pg.waitForTimeout(2000);
}
const end = await peek();
await pg.screenshot({ path: path.join(OUT, 'link_report.png'), timeout: 180000 });
const rep = await pg.evaluate(() => {
  const el = document.getElementById('perf-report');
  const pre = el ? el.querySelector('pre') : null;
  const btns = el ? [...el.querySelectorAll('button')].map((b) => b.textContent.trim()) : [];
  const g = window.__game;
  return { text: pre ? pre.textContent : null, btns, off: !!(g.pipe && g.pipe.reflections !== undefined), left: g.perf.bench === null };
});
fs.writeFileSync(path.join(OUT, 'link_report.txt'), rep.text || '');
console.log('----');
console.log(`the title page gone: ${end.titleHidden}; the loading page gone: ${end.loaderGone}; the opening film playing: ${end.prologue}; the state: ${end.state}`);
console.log(`the report is shown: ${end.report}; its buttons: ${rep.btns.join(' / ')}; the route is over: ${rep.left}`);
console.log(`the screen kept awake - asked ${end.wake.asked}, let go ${end.wake.released}`);
console.log(`the progress line taken off the screen: ${end.progress === null}`);
console.log(logs.length ? 'page errors:\n  ' + logs.join('\n  ') : 'no page errors');
console.log('---- the report:');
console.log(rep.text);
await browser.close();
server.close();
