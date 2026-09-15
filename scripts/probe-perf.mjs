// v14 frame budget probe. Measures the JS cost of one game frame (the presentation path included)
// without the GPU in the way: `game.update` is driven directly, so headless software rendering does
// not distort the numbers. Also reports what the scene asks of the card after one real render.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', String(e.stack || e.message).split('\n').slice(0, 2).join(' | ')); });
const url = process.argv[2] || 'http://127.0.0.1:4173/?debug=perf,nofoliage';
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); ok ? pass++ : fail++; };

const out = await page.evaluate(async () => {
  const app = window.__fk.app, g = app.game, gr = app.gr;
  g.startMatch({ playerName: 'Perf', botCount: 0, difficulty: 'normal', buildTime: 0, roundTime: 720, style: 'medieval', mode: 'ascent', playerCount: 12 });
  g.debugSkipIntro();
  g.debugAdvance(60, 1 / 20); // bots build the sky
  const P = window.__fk.perf;
  P.on = true;
  // Warm up, then measure the full frame path (simulation + presentation) without rendering.
  for (let i = 0; i < 30; i++) { g.update(1 / 60); app.input.endFrame(); }
  P.snapshot(30);
  const N = 240;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) { g.update(1 / 60); app.input.endFrame(); }
  const wall = performance.now() - t0;
  const parts = P.snapshot(N);
  // Scene composition after one real render.
  gr.render(1 / 60);
  const ri = gr.renderer.info;
  let skinned = 0, lights = 0, meshes = 0;
  gr.scene.traverse((o) => { if (o.isSkinnedMesh) skinned++; else if (o.isMesh || o.isInstancedMesh) meshes++; if (o.isLight) lights++; });
  const s = g.debugAscent();
  return { tier: gr.quality, frameMs: +(wall / N).toFixed(2), parts, draw: { calls: ri.render.calls, triangles: ri.render.triangles }, skinned, meshes, lights, blocks: s.placedBlocks, maxY: Math.round(Math.max(...s.entities.map((e) => e.y))) };
});
console.log(JSON.stringify(out, null, 1));
const p = out.parts;
check('a game frame (simulation + presentation, no GPU) stays under 4 ms', out.frameMs <= 4, `${out.frameMs} ms`);
check('characters under 0.8 ms', (p.chars ?? 0) <= 0.8, `${p.chars ?? 0} ms`);
check('HUD under 0.5 ms', (p.hud ?? 0) <= 0.5, `${p.hud ?? 0} ms`);
check('effects under 0.6 ms', (p.vfx ?? 0) <= 0.6, `${p.vfx ?? 0} ms`);
check('Sky Flag visuals under 0.5 ms', (p.ascent ?? 0) <= 0.5, `${p.ascent ?? 0} ms`);
// Eleven bots, each with its own perception rays, aim, trigger and a full physics step.
check('bots under 1.6 ms for eleven of them', (p.bots ?? 0) <= 1.6, `${p.bots ?? 0} ms`);
check('one skinned mesh per character', out.skinned <= 14, `${out.skinned}`);
check('at most six lights in the scene', out.lights <= 6, `${out.lights}`);
check('draw calls under 260', out.draw.calls <= 260, `${out.draw.calls}`);
console.log(`\n${pass} passed, ${fail} failed, errors: ${errors.length}`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);
