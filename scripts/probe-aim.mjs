// v14 aim probe: the sight sits on the crosshair at full ADS, and the view still turns when the
// browser refuses to capture the pointer.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
fs.mkdirSync('scratch/ads', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 2).join(' | ')); });
await page.goto(process.argv[2] || 'http://127.0.0.1:4173/?debug=low,nofoliage', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };

// Every weapon: at full ADS the optic's centre projects onto the middle of the screen.
const ads = await page.evaluate(async () => {
  const g = window.__fk.game();
  g.startMatch({ playerName: 'Aim', botCount: 0, difficulty: 'normal', buildTime: 0, roundTime: 720, style: 'medieval', mode: 'ascent', playerCount: 2 });
  g.debugSkipIntro();
  g.screens.hideAll();
  g.debugAdvance(0.2, 1 / 20);
  const p = g.player; p.alive = true; p.hp = 100; p.pitch = 0;
  g.local.enabled = true;
  const out = [];
  const THREE = g.app.gr.camera.position.constructor;
  for (const id of ['pistol', 'smg', 'rifle', 'shotgun', 'sniper']) {
    const w = p.weapon;
    if (w) { w.id = id; w.ammo = 30; }
    // Raise it instantly: the switch animation is not what this measures.
    g.local.viewModel.show(id, true);
    // Hold the aim button, as a player would.
    g.app.input.enabled = true;
    g.app.input.buttonsDown.add(2);
    for (let i = 0; i < 150; i++) { g.update(1 / 60); g.app.input.endFrame(); }
    const model = g.local.viewModel.model;
    if (!model) { out.push({ id, err: 'no model' }); continue; }
    // Where the optic ends up on screen: its offset in the model, taken to world, then to NDC.
    model.updateWorldMatrix(true, false);
    const a = model.userData.ads;
    const v = new THREE(-a.x, -a.y, -0.34 - a.z);
    model.localToWorld(v);
    v.project(g.app.gr.camera);
    out.push({ id, ads: +p.ads.toFixed(2), ndc: [+v.x.toFixed(3), +v.y.toFixed(3)], fov: +g.app.gr.camera.fov.toFixed(1), pos: model.position.toArray().map((q) => +q.toFixed(3)), want: model.userData.ads.toArray().map((q) => +q.toFixed(3)), rot: model.rotation.toArray().slice(0, 3).map((q) => +q.toFixed(3)), sight: model.userData.sight.toArray().map((q) => +q.toFixed(3)) });
  }
  return out;
});
console.log('ads', JSON.stringify(ads));
for (const a of ads) {
  if (a.err) { check(`${a.id}: viewmodel present`, false, a.err); continue; }
  check(`${a.id}: the sight sits on the crosshair at full ADS`, Math.abs(a.ndc[0]) < 0.06 && Math.abs(a.ndc[1]) < 0.06, `ndc ${a.ndc.join(',')} fov ${a.fov}`);
}
check('aiming down sights narrows the view', ads.every((a) => a.err || a.fov < 70), ads.map((a) => a.fov).join(','));

// Cursor aim without a pointer lock: the outer band keeps turning, the middle does not.
const look = await page.evaluate(() => {
  const g = window.__fk.game(); const input = g.app.input;
  input.fallbackLook = true; input.fallbackActive = true; input.pointerLocked = false;
  input.syncCursor();
  g.screens.hideAll();
  const p = g.player; p.ads = 0; p.wantsAds = false; g.local.enabled = true;
  const turn = (fx) => {
    input.cursorX = innerWidth * fx; input.cursorY = innerHeight * 0.5;
    const y0 = p.yaw;
    for (let i = 0; i < 60; i++) { g.update(1 / 60); g.app.input.endFrame(); }
    return Math.abs(((p.yaw - y0 + Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI;
  };
  const edge = turn(0.97);
  const middle = turn(0.55);
  return { edge: +edge.toFixed(1), middle: +middle.toFixed(1), cursor: getComputedStyle(document.getElementById('game')).cursor };
});
console.log('look', JSON.stringify(look));
check('the outer band of the window keeps turning the view', look.edge > 20, `${look.edge}° in one second`);
check('the middle of the window does not drift', look.middle < 1, `${look.middle}°`);
check('the mouse pointer is hidden while aiming without a lock', look.cursor === 'none', look.cursor);
await page.screenshot({ path: 'scratch/ads/aim.png' });
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);
