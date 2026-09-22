// Pull frames out of a video with the bundled Chromium (no ffmpeg needed): load it in a page, seek, screenshot.
// usage: node tools/frames.mjs <video> <outDir> [--n=12] [--from=0] [--to=0]
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
import fs from 'fs'; import path from 'path'; import http from 'http';
const [video, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? +a.slice(k.length + 3) : d; };
const N = opt('n', 12), FROM = opt('from', 0), TO = opt('to', 0), PORT = opt('port', 8410);
fs.mkdirSync(outDir, { recursive: true });
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/v')) { const st = fs.statSync(video); res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(video).pipe(res); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<!doctype html><html><body style="margin:0;background:#000"><video id="v" src="/v" style="width:100vw;height:100vh;object-fit:contain"></video></body></html>`);
});
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
const meta = await page.evaluate(() => new Promise((res, rej) => {
  const v = document.getElementById('v');
  const done = () => res({ d: v.duration, w: v.videoWidth, h: v.videoHeight, err: null });
  if (v.readyState >= 1) return done();
  v.onloadedmetadata = done;
  v.onerror = () => res({ err: (v.error && v.error.message) || 'decode error', code: v.error && v.error.code });
  setTimeout(() => res({ err: 'timeout' }), 15000);
}));
console.log('META', JSON.stringify(meta));
if (meta.err) { console.log('Chromium cannot decode this file'); await browser.close(); server.close(); process.exit(2); }
await page.setViewportSize({ width: Math.min(1600, meta.w), height: Math.min(900, Math.round(meta.h * Math.min(1600, meta.w) / meta.w)) });
const to = TO || meta.d;
for (let i = 0; i < N; i++) {
  const t = FROM + (to - FROM) * (i / Math.max(1, N - 1));
  await page.evaluate((t) => new Promise((res) => { const v = document.getElementById('v'); v.onseeked = () => setTimeout(res, 60); v.currentTime = Math.min(t, v.duration - 0.05); }), t);
  const name = `f${String(i).padStart(2, '0')}_${t.toFixed(2)}s.png`;
  await page.locator('#v').screenshot({ path: path.join(outDir, name) });
  console.log('frame', name);
}
await browser.close(); server.close();
