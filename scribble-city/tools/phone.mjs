// The game on a phone held sideways (ROADMAP 10.6), the moments the player sees most: walking with a
// word on the screen, the police after you, a chase in a car with the radio on, the pause menu.
// Each is photographed, and where everything on the screen is gets measured: the pairs on top of
// each other are printed. (The words are kept on the screen while the photograph is taken: a
// photograph here takes longer than they last.)
//
//   node tools/phone.mjs <outPrefix> [device] [query]
//     device: iphone (844x390, the default), pixel (915x412), small (740x360), se (667x375);
//     desk (1280x720) and deskLow (1280x500) are a computer, where nothing of the phone's may change.
//   -> <outPrefix>_play.png, _police.png, _car.png, _menu.png
import { startServer, launch } from './shot.mjs';

const OUT = process.argv[2];
const DEV = process.argv[3] || 'iphone';
const Q = process.argv[4] || '';
const DEVICES = {
  // (CSS pixels, held sideways)
  iphone: { width: 844, height: 390, dpr: 3 },
  pixel: { width: 915, height: 412, dpr: 2.625 },
  small: { width: 740, height: 360, dpr: 3 },
  se: { width: 667, height: 375, dpr: 2 },
  // (a computer: nothing of the phone's may change here)
  desk: { width: 1280, height: 720, dpr: 1, desk: true },
  deskLow: { width: 1280, height: 500, dpr: 1, desk: true },
};
const d = DEVICES[DEV];
if (!OUT || !d) {
  console.log('usage: node tools/phone.mjs <outPrefix> [iphone|pixel|small|se|desk|deskLow] [query]');
  process.exit(1);
}
const server = await startServer();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr, isMobile: !d.desk, hasTouch: !d.desk });
const pg = await ctx.newPage();
await pg.addInitScript((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, 7);
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/v4/index.html?test=1&autostart=1&hour=13${Q ? '&' + Q : ''}`);
await pg.waitForFunction('window.__ready === true', null, { timeout: 300000 });
const sync = () => pg.evaluate(() => { const r = window.__game.renderer; r.setRenderTarget(null); const gl = r.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); });
const settle = () => new Promise((r) => setTimeout(r, 500));
const IDS = ['minimap-wrap', 'vehicle-hp', 'subs', 'hidden-tag', 'btn-pause', 'btn-phone', 'btn-radio', 'gps-dist', 'weapon', 'btn-swap', 'wanted', 'toasts', 'topbar', 'btn-fire', 'btn-jump', 'btn-draw', 'btn-photo', 'btn-enter', 'btn-up', 'btn-down', 'btn-view', 'btn-guard', 'btn-hands', 'stick-base', 'prompt', 'radio'];
const measure = () => pg.evaluate((IDS) => {
  const out = {};
  for (const id of IDS) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    out[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
  }
  // pairs on top of each other (not a card in its own bar)
  const ks = Object.keys(out);
  const hits = [];
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = out[ks[i]];
    const b = out[ks[j]];
    const ea = document.getElementById(ks[i]);
    const eb = document.getElementById(ks[j]);
    if (ea.contains(eb) || eb.contains(ea)) continue;
    if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) hits.push(ks[i] + '×' + ks[j]);
  }
  return { out, hits };
}, IDS);
const report = {};
const BP = 'כל השרטוטים פתוחים: לוחצים על העיפרון ובוחרים מה לצייר ✏';
await pg.evaluate(() => {
  const g = window.__game;
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  window.__frame(20, 1 / 30);
});
// 1. walking: a word on the screen, a blueprint to photograph
await pg.evaluate((BP) => {
  const g = window.__game;
  g.hud.toastsEl.innerHTML = '';
  g.hud.toast(BP, 'info', 900);
  g.hud.setPrompt = () => {};
  const pr = document.getElementById('prompt');
  pr.textContent = 'לצלם את השרטוט';
  pr.classList.remove('hidden');
  document.getElementById('btn-photo').classList.remove('hidden');
  window.__frame(1, 1 / 30);
}, BP);
await settle();
await sync();
await pg.screenshot({ path: `${OUT}_play.png`, timeout: 600000 });
report.play = await measure();
// 2. the police after you: their word and the stars
await pg.evaluate((BP) => {
  const g = window.__game;
  document.getElementById('prompt').classList.add('hidden');
  document.getElementById('btn-photo').classList.add('hidden');
  g.police.addHeat(60, g.player.pos.x, g.player.pos.z, true);
  g.hud.toastsEl.innerHTML = '';
  g.hud.toast(BP, 'info', 900);
  g.hud.toast('המשטרה מחפשת אותך!', 'bad', 900);
  window.__frame(1, 1 / 30);
}, BP);
await settle();
await sync();
await pg.screenshot({ path: `${OUT}_police.png`, timeout: 600000 });
report.police = await measure();
// 3. driving, the radio on
await pg.evaluate(() => {
  const g = window.__game;
  g.police.clear();
  g.hud.toastsEl.innerHTML = '';
  const p = g.player.pos;
  let best = null;
  let bd = 1e9;
  for (const c of g.traffic.parked) {
    if (c.taken || (c.spec && c.spec.police)) continue;
    const dd = Math.hypot(c.x - p.x, c.z - p.z);
    if (dd < bd) { bd = dd; best = c; }
  }
  const v = g.vehicles.spawnStock(best.spec, p.clone(), g.camRig.yaw);
  g.enterVehicle(v);
  window.__frame(12, 1 / 30);
  g.hud.radio('Radio Scribble 99.1 · "Sunset on the Boulevard"');
  // (a chase: the stars up too)
  g.police.addHeat(150, g.player.pos.x, g.player.pos.z, true);
  g.hud.toastsEl.innerHTML = '';
  g.hud.toast('עוד ניידות בדרך!', 'bad', 900);
  window.__frame(1, 1 / 30);
});
await settle();
await sync();
await pg.screenshot({ path: `${OUT}_car.png`, timeout: 600000 });
report.car = await measure();
// 4. the menu
await pg.evaluate(() => {
  const g = window.__game;
  g.police.clear();
  g.hud.toastsEl.innerHTML = '';
  delete g.pause;
  g.pause();
});
await new Promise((r) => setTimeout(r, 800));
await pg.screenshot({ path: `${OUT}_menu.png`, timeout: 600000 });
const info = await pg.evaluate(() => ({ touch: document.body.classList.contains('touch'), nc: document.body.classList.contains('nc'), w: innerWidth, h: innerHeight }));
console.log(JSON.stringify({ info, errs: errs.slice(0, 3) }));
for (const k in report) console.log(k, 'overlaps:', JSON.stringify(report[k].hits), '\n ', JSON.stringify(report[k].out));
await browser.close();
server.close();
