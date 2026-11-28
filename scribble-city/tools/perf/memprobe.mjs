// (ROADMAP 21, found in round 24) The page's memory as the game is played: the resident memory of all the browser's own
// processes, and the JS heap, every two seconds - in the city, in the pause menu, after going back to the game, with the album
// open. usage: node tools/perf/memprobe.mjs [query] (from scribble-city)
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { startServer, launch } from '../shot.mjs';
const pids = () => execSync('pgrep -f chrome-headless || true').toString().split('\n').filter(Boolean).map(Number);
const before = new Set(pids());
const rss = (set) => { let t = 0; for (const p of set) { try { const m = /VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${p}/status`, 'utf8')); if (m) t += +m[1]; } catch (e) {} } return Math.round(t / 1024); };
const server = await startServer();
const browser = await launch();
const mine = () => new Set(pids().filter((p) => !before.has(p)));
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
const cdp = await ctx.newCDPSession(pg);
await cdp.send('Performance.enable');
const log = async (tag) => { const m = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] })); const v = (n) => { const x = m.metrics.find((q) => q.name === n); return x ? Math.round(x.value / 1048576) : -1; }; console.log(tag.padEnd(10), 'rss', rss(mine()), 'MB  js', v('JSHeapUsedSize'), '/', v('JSHeapTotalSize'), 'MB  nodes', (m.metrics.find((q) => q.name === 'Nodes') || {}).value); };
await pg.goto(`http://127.0.0.1:${server.address().port}/v5/index.html?${process.argv[2] || 'look=1&prologue=0&autostart=1'}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
await pg.waitForFunction('window.__ready === true', null, { timeout: 600000, polling: 1000 });
await log('ready');
await pg.evaluate(() => window.__loadLeave && window.__loadLeave());
await pg.waitForTimeout(6000);
for (let k = 0; k < 5; k++) { await pg.waitForTimeout(2000); await log(`city ${k * 2 + 2}s`); }
await pg.evaluate(() => window.__game.showPauseMenu());
for (let k = 0; k < 3; k++) { await pg.waitForTimeout(2000); await log(`pause ${k * 2 + 2}s`); }
await pg.evaluate(() => window.__game.resume());
for (let k = 0; k < 8; k++) { await pg.waitForTimeout(2000); await log(`resumed ${k * 2 + 2}s`); }
await pg.evaluate(() => window.__game.album.show(() => {}));
for (let k = 0; k < 8; k++) { await pg.waitForTimeout(2000); await log(`album ${k * 2 + 2}s`); }
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
await browser.close();
server.close();
