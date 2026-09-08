import fs from 'node:fs';
fs.mkdirSync('scratch', { recursive: true });
// v12 stage 3a: the period arsenal. Every weapon model builds and shows in first person, the names read right,
// and a fire pot leaves whoever it splashes burning.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); });
await page.goto(process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
await page.evaluate(() => {
  const g = window.__fk.game();
  g.startMatch({ playerName: 'Lord', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: 'medieval', mode: 'siege', teamSize: 4 });
  g.debugAdvance(20, 1 / 20); g.finishBuild(false); g.debugAdvance(3, 1 / 20); g.finishFortify(false); g.debugSkipIntro(); g.debugAdvance(1, 1 / 20);
});
const names = await page.evaluate(() => Object.values(window.__fk.game().debugWeaponNames?.() ?? {}));
for (const w of ['rifle', 'smg', 'pistol', 'shotgun', 'sniper', 'rocket']) {
  const r = await page.evaluate((w) => { const g = window.__fk.game(); return g.debugShowcase(w, 4.5, 0, true); }, w);
  await frames(8);
  await page.screenshot({ path: `scratch/v12-weapon-${w}.png` });
  const hud = await page.evaluate(() => document.querySelector('.weapon .wname')?.textContent);
  console.log(w, JSON.stringify(r).slice(0, 120), 'hud name', hud);
  check(`${w} builds, shows and is named for the period`, !!hud && /flintlock|crossbow|hand cannon|arquebus|mortar/i.test(hud), hud || '');
}
const burn = await page.evaluate(() => {
  const g = window.__fk.game(); const p = g.player;
  const bot = g.entities.find((e) => e.isBot && e.team === 1);
  bot.pos.set(p.pos.x + 3, p.pos.y, p.pos.z); bot.vel.set(0, 0, 0); bot.hp = 100;
  const start = g.combat.projectiles.length;
  // A pot dropped at its feet.
  const proj = g.combat.spawnProjectile('grenade', p, bot.pos.clone().add(new (Object.getPrototypeOf(p.pos).constructor)(0, 0.5, 0)), new (Object.getPrototypeOf(p.pos).constructor)(0, -1, 0), 1, 0.3);
  g.debugAdvance(0.6, 1 / 20);
  return { spawned: g.combat.projectiles.length >= start, burning: bot.burnUntil > g.time, hp: Math.round(bot.hp) };
});
console.log('burn', JSON.stringify(burn));
check('a fire pot leaves the splashed burning', burn.burning && burn.hp < 100, JSON.stringify(burn));
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
