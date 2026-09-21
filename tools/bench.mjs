// Render-cost benchmark: loads the game at a phone viewport in touch mode, opens a gateway in view and measures
// draw calls, triangles and JS/render milliseconds per frame. Headless SwiftShader numbers are only meaningful
// relative to each other (before/after a change), not as phone frame rates.
// usage: node tools/bench.mjs [--port=8240] [--quality=medium] [--w=844 --h=390] [--dpr=2] [--frames=120] [--desktop]
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
import http from 'http'; import fs from 'fs'; import path from 'path';
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const port = +opt('port', 8240), W = +opt('w', 844), H = +opt('h', 390), DPR = +opt('dpr', 2), frames = +opt('frames', 120), quality = opt('quality', 'medium');
const desktop = argv.includes('--desktop');
const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.css': 'text/css' };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(port, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: !desktop, isMobile: !desktop });
const page = await ctx.newPage();
await page.addInitScript(([q, touch]) => { window.__VANTAGE_NOLOCK = true; window.__VANTAGE_TOUCH = touch; try { localStorage.setItem('vantage.settings', JSON.stringify({ quality: q, sensitivity: 1, invertY: false, volume: 0 })); localStorage.setItem('vantage.lang', 'en'); } catch (e) {} }, [quality, !desktop]);
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
const res = await page.evaluate(async (frames) => {
  const g = window.__game;
  g.startMission(); g.beginPlay(); g.player.godMode = true; g.debugStep(0.5);
  const THREE = { Vector3: g.player.pos.constructor, Vector2: g.tacmap.cursor.constructor };
  // stand in the yard looking north-east at the warehouse and the container yard, with a gateway open in view
  const p = g.player; p.pos.set(-30, 0, -30); p.camYaw = 0.6; p.camPitch = -0.05; p.update(0, 0);
  g.debugStep(0.2);
  const V = (x, y, z) => p.pos.clone().set(x, y, z);
  const open = g.openPortalAt(V(-20, 0, -14)); g.debugStep(0.6);
  const r = g.renderer, info = r.info; info.autoReset = false;
  const sample = (fn) => { info.reset(); const t0 = performance.now(); fn(); const ms = performance.now() - t0; return { ms: +ms.toFixed(2), calls: info.render.calls, tris: info.render.triangles }; };
  // warm up
  for (let i = 0; i < 5; i++) { g.debugStep(1 / 60); g._render(); }
  const out = { quality: g.settings.quality, touch: g.isTouch, pixelRatio: r.getPixelRatio(), portal: open.ok, programs: info.programs.length };
  const dbs = r.getDrawingBufferSize(new THREE.Vector2()); out.buffer = [dbs.x, dbs.y];
  // full frame breakdown, averaged
  const acc = { update: 0, shadowAndMain: 0, portals: 0, post: 0, full: 0, calls: 0, tris: 0, n: 0 };
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now(); g._frame(1 / 60, false); acc.update += performance.now() - t0;
    const sp = sample(() => { r.shadowMap.needsUpdate = true; g.portals.render(r, g.scene, g.camera); }); acc.portals += sp.ms;
    const sm = sample(() => { r.render(g.scene, g.camera); }); acc.shadowAndMain += sm.ms;
    const sf = sample(() => { g._render(); }); acc.full += sf.ms; acc.calls += sf.calls; acc.tris += sf.tris;
    acc.n++;
  }
  const n = acc.n;
  out.perFrame = { updateMs: +(acc.update / n).toFixed(2), portalViewsMs: +(acc.portals / n).toFixed(2), sceneMs: +(acc.shadowAndMain / n).toFixed(2), fullRenderMs: +(acc.full / n).toFixed(2), calls: Math.round(acc.calls / n), tris: Math.round(acc.tris / n) };
  // how much of the full render is post-processing: full minus (portals + scene)
  out.perFrame.postMsApprox = +(out.perFrame.fullRenderMs - out.perFrame.portalViewsMs - out.perFrame.sceneMs).toFixed(2);
  // JS profile of the update
  g.profile = {}; for (let i = 0; i < 60; i++) g._frame(1 / 60, false); out.updateProfile = Object.fromEntries(Object.entries(g.profile).map(([k, v]) => [k, +(v / 60).toFixed(2)])); g.profile = null;
  out.characters = g.characters.length; out.lightsVisible = g.scene.children.filter((o) => o.isLight && o.visible).length;
  out.programsAfter = info.programs.length;
  return out;
}, frames);
console.log(JSON.stringify(res, null, 1));
await browser.close(); server.close();
