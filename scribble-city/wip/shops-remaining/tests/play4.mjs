// Scripted headless play session for testing.
// usage: node tools/play.mjs <query> <scriptFile.js> <outPrefix> [w] [h]
// The script file exports steps: [{ js: '...', frames: n, shot: 'name' }, ...] (evaluated in the page).
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from '/home/user/Test-1-/scribble-city/tools/shot.mjs';

const [, , query = 'test=1&autostart=1', scriptFile, outPrefix = 'play', w = '1280', h = '720'] = process.argv;
const steps = scriptFile ? JSON.parse(fs.readFileSync(scriptFile, 'utf8')) : [{ frames: 5, shot: 'start' }];
const server = await startServer();
const port = server.address().port;
const browser = await launch();
// (WATCHDOG) the browser's memory: closed, with a word, before the machine runs out
import('node:child_process').then(({ execSync }) => {
  const lim = +(process.env.MEMGB || 9);
  setInterval(() => {
    let kb = 0;
    try { for (const l of execSync('ps -eo rss,args').toString().split('\n')) if (/chrom/.test(l)) kb += +l.trim().split(/\s+/)[0]; } catch {}
    if (kb / 1048576 > lim) { fs.appendFileSync((process.argv[4] || 'play') + '.live', '[watchdog] browser at ' + (kb / 1048576).toFixed(2) + ' GB - closed\n'); console.log('[watchdog]', (kb / 1048576).toFixed(2)); browser.close().catch(() => {}); setTimeout(() => process.exit(3), 800); }
  }, 700).unref();
});
const mobile = !!process.env.MOBILE;
const page = await browser.newPage(mobile ? { viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: +w, height: +h } });
const cdp = mobile ? await page.context().newCDPSession(page) : null;
// THROTTLE=n: the processor n times slower (a phone's main thread), set once the game is up
const throttle = +process.env.THROTTLE || 0;
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
const logs = []; const _push = logs.push.bind(logs); logs.push = (s) => { fs.appendFileSync(outPrefix + '.live', s + '\n'); return _push(s); };
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
// PAGE=v2/index.html tests another page of the project
await page.goto(`http://127.0.0.1:${port}/${process.env.PAGE || 'index.html'}?${query}`);
try {
  await page.waitForFunction('window.__ready === true', null, { timeout: 1500000 });
  if (throttle > 1) { const c = cdp || (await page.context().newCDPSession(page)); await c.send('Emulation.setCPUThrottlingRate', { rate: throttle }); logs.push('[throttle] ' + throttle); }
} catch (e) {
  logs.push('[timeout waiting for __ready]');
}
for (const st of steps) {
  try {
    if (st.js) {
      const r = await page.evaluate(st.js);
      if (r !== undefined && r !== null) logs.push('[eval] ' + JSON.stringify(r).slice(0, +process.env.MAXLOG || 600));
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
    // a player's mouse stroke: { mouse: [[x, y], ...], mouseFrames: true } (CSS pixels; a game frame per move)
    // (or worked out in the page just before: { mouseJs: 'window.__strokeOf(...)' } - an array of points)
    if (st.mouseJs) st.mouse = await page.evaluate(st.mouseJs);
    if (st.mouse && st.mouse.length >= 2) {
      const pts = st.mouse;
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (let i = 1; i < pts.length; i++) {
        await page.mouse.move(pts[i][0], pts[i][1], { steps: 2 });
        if (st.mouseFrames) await page.evaluate(`window.__frame(1, ${st.dt || 1 / 30})`);
      }
      // ({ hold: true }: the button stays down - a shot of the line as it is drawn; { release: true } later)
      if (!st.hold) await page.mouse.up();
      logs.push('[mouse] ' + pts.length + ' points' + (st.hold ? ' (held)' : ''));
    }
    if (st.release) await page.mouse.up();
    // a real mouse click on an element: { click: '#fd-leg [data-i="car"]' }
    if (st.click) {
      const box = await page.locator(st.click).first().boundingBox();
      if (!box) logs.push(`[click] ${st.click} not visible`);
      else {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        logs.push(`[click] ${st.click}`);
      }
    }
    // keys: { press: ['KeyQ'] } once; { down: ['KeyW'] } held through this step's frames, { up: [...] } after them
    if (st.press) for (const k of st.press) await page.keyboard.press(k);
    if (st.down) for (const k of st.down) await page.keyboard.down(k);
    // { profile: 'start' } / { profile: 'stop' }: the processor's own profile of what runs between them (<out prefix>_cpu.json)
    if (st.profile) {
      const c = cdp || globalThis.__profS || (globalThis.__profS = await page.context().newCDPSession(page));
      if (st.profile === 'start') { await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 200 }); await c.send('Profiler.start'); }
      else { const { profile } = await c.send('Profiler.stop'); fs.writeFileSync(outPrefix + '_cpu.json', JSON.stringify(profile)); logs.push('[profile] saved'); }
    }
    if (st.frames) await page.evaluate(`window.__frame(${st.frames}, ${st.dt || 1 / 30})`);
    if (st.up) for (const k of st.up) await page.keyboard.up(k);
    // { rss: true }: the browser's memory now (all its processes, GB)
    if (st.rss) {
      const { execSync } = await import('node:child_process');
      let kb = 0;
      const per = [];
      for (const l of execSync('ps -eo rss,args').toString().split('\n')) if (/chrom/.test(l)) { const k = +l.trim().split(/\s+/)[0]; kb += k; const t = (l.match(/--type=([a-z-]+)/) || [])[1] || 'main'; per.push(t + ':' + (k / 1048576).toFixed(2)); }
      logs.push('[rss] ' + (kb / 1048576).toFixed(2) + ' GB ' + per.join(' '));
    }
    if (st.shot) {
      const file = `${outPrefix}_${st.shot}.png`;
      await page.screenshot({ path: file, timeout: 150000 });
      logs.push(`[shot] ${path.basename(file)}`);
    }
  } catch (e) {
    logs.push('[step error] ' + e.message);
  }
}
console.log(logs.slice(0, +process.env.MAXLINES || 120).join('\n'));
await browser.close();
server.close();
