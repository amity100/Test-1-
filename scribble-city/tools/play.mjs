// Scripted headless play session for testing.
// usage: node tools/play.mjs <query> <scriptFile.js> <outPrefix> [w] [h]
// The script file exports steps: [{ js: '...', frames: n, shot: 'name' }, ...] (evaluated in the page).
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from './shot.mjs';

const [, , query = 'test=1&autostart=1', scriptFile, outPrefix = 'play', w = '1280', h = '720'] = process.argv;
const steps = scriptFile ? JSON.parse(fs.readFileSync(scriptFile, 'utf8')) : [{ frames: 5, shot: 'start' }];
const server = await startServer();
const port = server.address().port;
const browser = await launch();
const mobile = !!process.env.MOBILE;
const page = await browser.newPage(mobile ? { viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: +w, height: +h } });
const cdp = mobile ? await page.context().newCDPSession(page) : null;
// SEED=n: a repeatable Math.random, so two builds can be compared frame for frame
if (process.env.SEED) {
  await page.addInitScript((seed) => {
    let a = seed >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, +process.env.SEED);
}
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
// PAGE=v2/index.html tests another page of the project
await page.goto(`http://127.0.0.1:${port}/${process.env.PAGE || 'index.html'}?${query}`);
try {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
} catch (e) {
  logs.push('[timeout waiting for __ready]');
}
for (const st of steps) {
  try {
    if (st.js) {
      const r = await page.evaluate(st.js);
      if (r !== undefined && r !== null) logs.push('[eval] ' + JSON.stringify(r).slice(0, 600));
    }
    // real taps / touch drags (MOBILE=1): { tap: '#btn-draw' } or { touch: [[x, y], [x, y], ...] }
    if (st.tap) {
      const box = await page.locator(st.tap).boundingBox();
      if (!box) logs.push(`[tap] ${st.tap} not visible`);
      else {
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        logs.push(`[tap] ${st.tap} at ${Math.round(box.x + box.width / 2)},${Math.round(box.y + box.height / 2)}`);
      }
    }
    if (st.touch && cdp) {
      const pts = st.touch;
      const tp = (p) => [{ x: p[0], y: p[1], id: 7, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) });
      for (let i = 1; i < pts.length; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(pts[i]) });
        if (st.touchFrames) await page.evaluate(`window.__frame(1, ${st.dt || 1 / 30})`);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    if (st.frames) await page.evaluate(`window.__frame(${st.frames}, ${st.dt || 1 / 30})`);
    if (st.shot) {
      const file = `${outPrefix}_${st.shot}.png`;
      await page.screenshot({ path: file });
      logs.push(`[shot] ${path.basename(file)}`);
    }
  } catch (e) {
    logs.push('[step error] ' + e.message);
  }
}
console.log(logs.slice(0, 120).join('\n'));
await browser.close();
server.close();
