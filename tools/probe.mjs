// Debug probe: loads the game headless, starts the mission, evaluates a JS snippet (with `g` = game, `L` = level)
// and prints the JSON result. Optional screenshot from a free camera.
// usage: node tools/probe.mjs [--port=8150] [--shot=out.png --cam=x,y,z --look=x,y,z] [--w=1280 --h=720] "<js body returning a value>"
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
import http from 'http'; import fs from 'fs'; import path from 'path';
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const code = argv.filter((a) => !a.startsWith('--')).join('\n');
const port = +opt('port', 8150), shotPath = opt('shot', null), W = +opt('w', 1280), H = +opt('h', 720);
const cam = opt('cam', null), look = opt('look', null), mode = opt('mode', 'ground'), file = opt('file', null);
const root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.css': 'text/css' };
const server = http.createServer((req, res) => { const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(port, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(([q, l]) => { window.__VANTAGE_NOLOCK = true; try { localStorage.setItem('vantage.settings', JSON.stringify({ quality: q, sensitivity: 1, invertY: false, volume: 0 })); localStorage.setItem('vantage.lang', l); } catch (e) {} }, [opt('quality', 'high'), opt('lang', 'en')]);
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!t.includes('fonts.g') && !t.includes('net::ERR') && !t.includes('GL Driver')) console.log('console.error:', t.slice(0, 300)); } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
await page.evaluate(() => { const g = window.__game; g.startMission(); g.beginPlay(); g.player.godMode = true; g.debugStep(0.3); });
const src = file ? fs.readFileSync(file, 'utf8') : code;
if (src.trim()) {
  try { const r = await page.evaluate(`(function(){ const g = window.__game, L = g.level, THREE = { Vector3: g.player.pos.constructor }; ${src} })()`); console.log('RESULT', typeof r === 'string' ? r : JSON.stringify(r)); } catch (e) { console.log('EVAL ERROR:', e.message); }
}
if (shotPath) {
  await page.evaluate(([cam, look, mode]) => {
    const g = window.__game;
    if (mode === 'map' && !g.tacmap.active) g.input.emit('keydown', 'Tab', { preventDefault() {} });
    g.debugStep(0.2);
    const c = g.tacmap.active ? g.tacmap.camera : g.camera;
    if (cam) { const [x, y, z] = cam.split(',').map(Number); c.position.set(x, y, z); if (g.tacmap.active) { 0; } }
    if (look) { const [x, y, z] = look.split(',').map(Number); c.lookAt(x, y, z); }
    if (cam && !g.tacmap.active) { const [x, y, z] = cam.split(',').map(Number); g.player.pos.set(x, y - 1.6, z); if (look) { const [lx, ly, lz] = look.split(',').map(Number); g.player.camYaw = Math.atan2(lx - x, lz - z); g.player.camPitch = Math.atan2(ly - y, Math.hypot(lx - x, lz - z)); } g.player.update(0, 0); }
    g.debugFrozen = true; g.debugRender();
    if (cam && g.tacmap.active) { const [x, y, z] = cam.split(',').map(Number); c.position.set(x, y, z); if (look) { const [lx, ly, lz] = look.split(',').map(Number); c.lookAt(lx, ly, lz); } g.debugRender(); }
  }, [cam, look, mode]);
  const waitMs = +opt('wait', 0); if (waitMs > 0) await page.waitForTimeout(waitMs);
  await page.screenshot({ path: shotPath, timeout: 120000 });
  console.log('saved', shotPath);
}
await browser.close(); server.close();
