// Where the CPU goes: (a) simulation-only steps (debugAdvance), (b) real frames with presentation,
// (c) scene composition (draw calls, meshes by type) after one render.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:4173/?debug=nofoliage', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fk && (window.__fk.ready || window.__fk.error), { timeout: 240000 });
const out = await page.evaluate(async () => {
  const app = window.__fk.app; const g = app.game; const gr = app.gr;
  g.startMatch({ playerName: 'Perf', botCount: 0, difficulty: 'normal', buildTime: 0, roundTime: 720, style: 'medieval', mode: 'ascent', playerCount: 12 });
  g.debugSkipIntro();
  g.debugAdvance(45, 1 / 20);
  const times = {};
  const wrap = (obj, name, label) => { if (!obj || typeof obj[name] !== 'function') return; const o = obj[name].bind(obj); obj[name] = (...a) => { const s = performance.now(); const r = o(...a); times[label] = (times[label] ?? 0) + performance.now() - s; return r; }; };
  const proto = Object.getPrototypeOf(g);
  const wrapProto = (name) => { if (typeof proto[name] !== 'function') return; const o = proto[name]; g[name] = function (...a) { const s = performance.now(); const r = o.apply(this, a); times[name] = (times[name] ?? 0) + performance.now() - s; return r; }; };
  for (const n of ['ascentInput', 'ascentVisuals', 'updateCharacters', 'syncProjectiles', 'updateEventVisuals', 'trapParticles', 'hudState', 'ascentHud', 'flagMarker', 'updateMarkers', 'battleUpdate']) wrapProto(n);
  wrap(g.local, 'update', 'local.update'); wrap(g.combat, 'updateProjectiles', 'combat.projectiles'); wrap(g.gadgets, 'update', 'gadgets'); wrap(g.traps, 'update', 'traps');
  wrap(g.match, 'update', 'match.update'); wrap(g.match?.ascent, 'update', 'ascent.update'); wrap(g.sky, 'aim', 'sky.aim'); wrap(g.sky, 'aimFrom', 'sky.aimFrom(bots)'); wrap(g.ascentMeshes, 'update', 'ascentMeshes'); wrap(g.vfx, 'update', 'vfx'); wrap(g.hud, 'update', 'hud.update'); wrap(g.hud, 'setState', 'hud.setState'); wrap(g.focus, 'update', 'focus');
  for (const b of g.bots) wrap(b, 'update', 'bots.total');
  wrap(app.chunks, 'update', 'chunks.update'); wrap(app.sky, 'update', 'skySystem'); wrap(app.water, 'update', 'water'); wrap(gr, 'render', 'gr.render');
  // (a) simulation only, 600 steps of 1/60.
  const t0 = performance.now(); g.debugAdvance(10, 1 / 60); const simMs = performance.now() - t0;
  const sim = Object.fromEntries(Object.entries(times).map(([k, v]) => [k, +(v / 600).toFixed(3)]));
  for (const k of Object.keys(times)) delete times[k];
  // (b) real frames.
  let frames = 0; const origUpdate = g.update.bind(g); g.update = (dt) => { frames++; const s = performance.now(); const r = origUpdate(dt); times['game.update'] = (times['game.update'] ?? 0) + performance.now() - s; return r; };
  await new Promise((res) => setTimeout(res, 9000));
  const frame = Object.fromEntries(Object.entries(times).map(([k, v]) => [k, +(v / Math.max(1, frames)).toFixed(2)]));
  // (c) scene composition.
  const ri = gr.renderer.info; const counts = {}; let visible = 0;
  gr.scene.traverse((o) => { if (o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.isPoints || o.isLine) { const k = o.isSkinnedMesh ? 'SkinnedMesh' : o.isInstancedMesh ? 'InstancedMesh' : o.isPoints ? 'Points' : o.isLine ? 'Line' : 'Mesh'; counts[k] = (counts[k] ?? 0) + 1; if (o.visible) visible++; } });
  return { simStepMs: +(simMs / 600).toFixed(2), sim, frames, frame, draw: { calls: ri.render.calls, triangles: ri.render.triangles, lines: ri.render.lines, points: ri.render.points }, counts, visible, regions: app.chunks.regions.size, shadowMap: gr.sun?.shadow?.mapSize?.x ?? gr.dirLight?.shadow?.mapSize?.x ?? 'n/a', lights: (() => { let n = 0; gr.scene.traverse((o) => { if (o.isLight) n++; }); return n; })() };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
