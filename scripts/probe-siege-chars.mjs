import fs from 'node:fs';
fs.mkdirSync('scratch', { recursive: true });
// v12 stage 5: soldiers of the siege era. Every kit builds gear without errors, outfits carry the team's
// device, cloth dyes and skins vary, and a showcase line-up renders for a look.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')); });
await page.goto(process.argv[2] || 'http://127.0.0.1:4173/?debug=medium,nofoliage', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const frames = async (n) => page.evaluate((n) => new Promise((res) => { let i = 0; const tick = () => (++i >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };
const info = await page.evaluate(() => {
  const g = window.__fk.game();
  g.startMatch({ playerName: 'Lord', botCount: 0, difficulty: 'normal', buildTime: 90, roundTime: 480, style: 'medieval', mode: 'siege', teamSize: 8 });
  g.debugAdvance(20, 1 / 20);
  g.finishBuild(false);
  g.debugAdvance(2, 1 / 20);
  g.finishFortify(false);
  g.debugSkipIntro();
  g.debugAdvance(1, 1 / 20);
  const chars = [...g.chars.values()];
  const gear = chars.map((c) => c.gearMeshes.length);
  const keys = new Set();
  for (const c of chars) for (const m of c.gearMeshes) keys.add(m.material.uuid);
  // Outfits per team: the device follows the team.
  const outfits = g.entities.map((e) => ({ team: e.team, id: g.chars.get(e.id)?.gearId, cloth: g.chars.get(e.id)?.outfitId }));
  const dev = (id) => Number(String(id).split('|').pop());
  const devOk = outfits.every((o) => dev(o.id) === o.team);
  const helmets = new Set(outfits.map((o) => String(o.id).split('|')[0]));
  const cloths = new Set(outfits.map((o) => String(o.cloth).split('|').slice(-2)[0]));
  const names = g.entities.filter((e) => e.isBot).map((e) => e.name);
  return { n: chars.length, gear, devOk, helmets: [...helmets], cloths: [...cloths], names: names.slice(0, 6), bodyMats: Object.keys(chars[0].mats) };
});
console.log('info', JSON.stringify(info));
check('every soldier carries period gear (helmet, device, kit) with no build errors', info.n === 16 && info.gear.every((n) => n > 0) && errors.length === 0, JSON.stringify({ n: info.n, gear: info.gear }));
check('the heraldic device follows the team; helmets and dyes vary', info.devOk && info.helmets.length >= 3 && info.cloths.length >= 3, JSON.stringify({ helmets: info.helmets, cloths: info.cloths }));
check('material slots are the period set (cloth, steel, leather, mail, iron, tabard, cream, skin, wood, gold)', ['cloth', 'steel', 'leather', 'mail', 'iron', 'tabard', 'cream', 'skin', 'wood', 'gold'].every((k) => info.bodyMats.includes(k)), JSON.stringify(info.bodyMats));
check('bots bear names of the period', info.names.every((n) => ['Aldric', 'Berta', 'Cedric', 'Dagny', 'Edda', 'Falk', 'Godric', 'Hild', 'Isolde', 'Jorund', 'Kettil', 'Leofric', 'Maud', 'Nils', 'Oswin', 'Piers', 'Rowena', 'Sigrun', 'Tancred', 'Ulf', 'Vidar', 'Wyn', 'Ysolt', 'Ragna'].includes(n)), JSON.stringify(info.names));
// Showcase: six soldiers in a row on the plaza, the rest sent away, overlays hidden.
const lineup = async (weapon, dist, pitch, angle, file) => {
  await page.evaluate(([weapon, dist, pitch, angle]) => {
    const g = window.__fk.game(); const p = g.player;
    p.pos.set(0, g.app.terrain.heightAt(0, 27) + 0.05, 27); p.vel.set(0, 0, 0); p.yaw = angle; p.alive = true; p.hp = p.maxHp;
    const fwd = p.forwardFlat(); const right = p.right();
    const bots = g.entities.filter((e) => e !== p);
    const show = bots.slice(0, 6);
    show.forEach((e, i) => {
      const t = i / 5 - 0.5;
      const pos = p.pos.clone().addScaledVector(fwd, dist + Math.abs(t) * 0.6).addScaledVector(right, t * 5.2);
      pos.y = g.app.terrain.heightAt(pos.x, pos.z);
      e.pos.copy(pos); e.vel.set(0, 0, 0); e.alive = true; e.hp = e.maxHp; e.crouching = false;
      e.yaw = Math.atan2(-(p.pos.x - pos.x), -(p.pos.z - pos.z)); e.pitch = 0;
      e.setLoadout(['rifle', 'sniper', 'shotgun', 'smg', 'rocket', 'pistol'][i]);
      e.setKit([['zipline', 'breach'], ['burrow', 'grapple'], ['breach', 'jumppad'], ['grapple', 'zipline'], ['jumppad', 'burrow'], ['zipline', 'grapple']][i]);
      g.chars.get(e.id)?.setOutfit(g.debugOutfit(e, i * 5 + 1, i % 2));
    });
    for (const e of bots.slice(6)) { e.pos.set(0, 40, -120); e.vel.set(0, 0, 0); }
    g.debugFreezeBots = true;
    p.setLoadout(weapon); g.local.viewModel.show(weapon, true); p.pitch = pitch;
    g.debugAdvance(0.2, 1 / 20);
    for (const el of document.querySelectorAll('.screen, .hud')) el.style.visibility = 'hidden';
  }, [weapon, dist, pitch, angle]);
  await frames(10);
  await page.screenshot({ path: file });
};
await lineup('rifle', 4.4, 0.02, 0, 'scratch/v12-chars.png');
await lineup('sniper', 2.4, 0.08, 0, 'scratch/v12-chars-close.png');
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
