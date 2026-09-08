// v11 on a phone: Fortress War through the touch UI. Build screen with the ping tool, the trap walk,
// the war HUD (no overlap between the ticket bar and the timer), the spawn choice by tap, the team podium.
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('scratch/phone-war', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const phone = devices['Pixel 7'] || devices['Pixel 5'];
const ctx = await browser.newContext({ ...phone, viewport: { width: 860, height: 400 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 2).join(' | ')); });
const url = process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
const rect = async (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, hidden: e.hidden || r.width === 0 }; }, sel);
await page.evaluate(() => { const g = window.__fk.game(); g.startMatch({ playerName: 'Phone', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 720, style: 'medieval', mode: 'war', teamSize: 6 }); g.debugAdvance(25, 1 / 20); });
await frames(12);
const ping = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.bld-bar button, .bld-tools button, button')).find((x) => /ping/i.test(x.textContent || '') || x.dataset.tool === 'ping'); return b ? { text: b.textContent, r: b.getBoundingClientRect().toJSON() } : null; });
check('the phone build screen shows the ping tool', !!ping && ping.r.width > 20, JSON.stringify(ping));
await page.screenshot({ path: 'scratch/phone-war/p1-build.png' });
// Tap the ping tool, then tap the plot: a ping appears.
if (ping) {
  await page.touchscreen.tap(ping.r.x + ping.r.width / 2, ping.r.y + ping.r.height / 2);
  await frames(3);
  const tool = await page.evaluate(() => window.__fk.game().builder.tool);
  const spot = await page.evaluate(() => { const g = window.__fk.game(); const plot = g.app.plots[0]; const cam = g.app.gr.camera; const v = new (Object.getPrototypeOf(cam.position).constructor)(plot.minX + 12, 12.2, plot.minZ + 20); v.project(cam); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; });
  console.log('tool', tool, 'plot spot on screen', JSON.stringify(spot));
  await page.touchscreen.tap(spot.x, spot.y);
  await frames(3);
}
const pings = await page.evaluate(() => window.__fk.game().builder.pings.length);
check('tapping the plot with the ping tool drops a ping', pings >= 1, `pings ${pings}`);
await page.evaluate(() => { const g = window.__fk.game(); g.finishBuild(false); g.debugAdvance(6, 1 / 20); });
await frames(12);
await page.screenshot({ path: 'scratch/phone-war/p2-fortify.png' });
const fort = await page.evaluate(() => { const g = window.__fk.game(); return { mode: g.mode, touch: !!document.querySelector('.touch-ui'), place: !!document.querySelector('.touch .tc-place, .touch [data-act=place], .fortify-ui, .fort-bar') }; });
check('the trap walk runs with the touch controls', fort.mode === 'fortify' && fort.touch, JSON.stringify(fort));
await page.evaluate(() => { const g = window.__fk.game(); g.finishFortify(false); g.debugSkipIntro(); g.debugAdvance(20, 1 / 20); });
await frames(12);
const bar = await rect('.warbar');
const top = await rect('.topbar');
const timer = await rect('.topbar .timer');
console.log('bar', JSON.stringify(bar), 'topbar', JSON.stringify(top), 'timer', JSON.stringify(timer));
check('the war bar shows on the phone below the timer without overlapping it', !!bar && !bar.hidden && !!timer && bar.y >= timer.y + timer.h - 2, `bar y ${bar?.y} timer bottom ${timer ? timer.y + timer.h : '-'}`);
const target = await rect('.topbar .target');
check('the topbar objective line is hidden in war (it lives in the war bar)', !target || target.hidden, JSON.stringify(target));
await page.screenshot({ path: 'scratch/phone-war/p3-battle.png' });
// Die, then tap a spawn option.
await page.evaluate(() => { const g = window.__fk.game(); const war = g.match.war; war.outposts[0].owner = 1; war.outposts[1].owner = 0; war.outposts[2].owner = -1; g.debugKillPlayer(); g.debugAdvance(0.3, 1 / 20); });
await frames(6);
const opts = await page.evaluate(() => Array.from(document.querySelectorAll('.spawnbox .sb-opt')).map((b) => ({ text: b.textContent, off: b.classList.contains('off'), r: b.getBoundingClientRect().toJSON() })));
console.log('opts', JSON.stringify(opts.map((o) => ({ text: o.text, off: o.off, w: Math.round(o.r.width), y: Math.round(o.r.y) }))));
check('the spawn options fit on the phone screen', opts.length === 4 && opts.every((o) => o.r.width > 40 && o.r.y + o.r.height < 400), JSON.stringify(opts.map((o) => Math.round(o.r.y + o.r.height))));
await page.screenshot({ path: 'scratch/phone-war/p4-dead.png' });
if (opts[2]) await page.touchscreen.tap(opts[2].r.x + opts[2].r.width / 2, opts[2].r.y + opts[2].r.height / 2);
await frames(3);
const choice = await page.evaluate(() => { const g = window.__fk.game(); const c = g.spawnChoice; g.debugAdvance(7, 1 / 20); const o = g.match.war.outposts[1]; return { choice: c, alive: g.player.alive, dOut: Math.round(Math.hypot(g.player.pos.x - o.pos.x, g.player.pos.z - o.pos.z)) }; });
check('tapping Point B selects it and the player respawns there', choice.choice === 1 && choice.alive && choice.dOut < 12, JSON.stringify(choice));
// End: podium fits.
await page.evaluate(() => { const g = window.__fk.game(); const war = g.match.war; war.tickets[1] = 1; const bot = g.entities.find((e) => e.team === 1 && e.alive); g.combat.applyDamage(bot, 999, g.player, g.time, false, bot.center); g.debugAdvance(8.5, 1 / 20); });
await frames(8);
const pod = await rect('.panel.podium.war');
check('the team podium shows on the phone and fits the screen', !!pod && pod.h > 100 && pod.y + pod.h <= 402, JSON.stringify(pod));
await page.screenshot({ path: 'scratch/phone-war/p5-podium.png' });
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
