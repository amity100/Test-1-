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
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
await page.goto(`http://127.0.0.1:${port}/index.html?${query}`);
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
