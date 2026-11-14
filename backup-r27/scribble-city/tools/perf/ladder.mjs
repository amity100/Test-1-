// (ROADMAP 19.2, PHONE_SPEED_PLAN.md 8.3 step 2.5) The ladder: the city's people stood in rows at 2, 3.5, 4.5, 6, 9,
// 12, 16, 24 and 30 metres from a still camera, as the phone draws them (lib.mjs), facing it, side on and with their
// backs to it, one of each row with an open mouth. Each rung is drawn twice at one and the same moment - the people's
// lighter shapes off (GFX.off: every shape in full) and on - and laid out for the player to look at: before, after,
// and how they differ (x8). The pictures are cut to the row and magnified.
//
//   node tools/perf/ladder.mjs <outDir>
//     DIST=2,3.5,...  KINDS=0,6,13,21,30,41  FACE=front,side,back  ZOOM=8 (the most a rung is magnified)
//   (EXTRA="newgfx=1" is put on by itself)
import fs from 'node:fs';
import path from 'node:path';
import { open } from './lib.mjs';

const OUT = process.argv[2] || 'ladder-out';
fs.mkdirSync(OUT, { recursive: true });
const DIST = (process.env.DIST || '2,3.5,4.5,6,9,12,16,24,30').split(',').map(Number);
const KINDS = (process.env.KINDS || '0,6,13,21,30,41').split(',').map(Number);
const FACES = (process.env.FACE || 'front,side,back').split(',');
const ZOOM = +(process.env.ZOOM || 8);
const { pg, close } = await open({ query: 'newgfx=1', frames: 20 });

// the street the camera looks down: the boulevard of the first spot of ab-phone.mjs, nothing walking on it that is not ours
await pg.evaluate(() => {
  const g = window.__game;
  g.enemies.spawnT = 1e9;
  g.audio.schedule = () => {};
  g.pause = () => {};
  for (const id of ['hud', 'touch']) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = 'hidden';
  }
});

const rungs = [];
for (const face of FACES) {
  for (const d of DIST) rungs.push([face, d]);
}
const log = [];
for (const [face, d] of rungs) {
  const r = await pg.evaluate(async ([face, d, KINDS, ZOOM]) => {
    const g = window.__game;
    const { GFX } = await import('./js/core/util.js');
    const { folkLook } = await import('./js/game/looks.js');
    // (a clean street: the city's own people and cars not where the rung is)
    g.civilians.list = g.civilians.list.filter((c) => c.scripted && c.owner && c.owner.ladder);
    for (const c of g.civilians.list) c.gone = true;
    const cam = [2, 1.55, 14];
    g.player.spawn(-6, 2, Math.PI);
    g.camRig.yaw = Math.PI;
    const N = KINDS.length;
    const sp = d <= 12 ? 1.0 : d <= 24 ? 1.3 : 1.6;
    const z = cam[2] - d;
    const yaw = face === 'front' ? 0 : face === 'side' ? Math.PI / 2 : Math.PI;
    const owner = { ladder: true };
    const figs = [];
    KINDS.forEach((k, i) => {
      const x = cam[0] + (i - (N - 1) / 2) * sp;
      const c = g.civilians.spawnScripted(x, z, folkLook(k), owner, null);
      c.yaw = yaw;
      if (c.fig) {
        c.fig.yaw = yaw;
        // (the second of them talking: the mouth wide open)
        if (i === 1) c.fig.mood = 'shout';
      }
      figs.push(c);
    });
    window.__camOverride = { pos: cam, look: [cam[0], 1.55, cam[2] - 60] };
    window.__frame(12, 1 / 30);
    for (const c of figs) {
      c.yaw = yaw;
      if (c.fig && c.fig.mood === undefined) c.fig.mood = null;
    }
    window.__frame(3, 1 / 30);
    // where the row is on the screen: its box, projected, with a margin
    const cv = g.renderer.domElement;
    const cw = cv.width;
    const ch = cv.height;
    const V = g.camera.position.constructor;
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    const half = ((N - 1) / 2) * sp + 0.6;
    for (const sx of [-half, half]) {
      for (const sy of [-0.05, 2.0]) {
        const p = new V(cam[0] + sx, sy, z).project(g.camera);
        const px = (p.x * 0.5 + 0.5) * cw;
        const py = (-p.y * 0.5 + 0.5) * ch;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
    }
    const m = 10;
    x0 = Math.max(0, Math.floor(x0 - m));
    y0 = Math.max(0, Math.floor(y0 - m));
    x1 = Math.min(cw, Math.ceil(x1 + m));
    y1 = Math.min(ch, Math.ceil(y1 + m));
    const w = x1 - x0;
    const h = y1 - y0;
    const zoom = Math.max(1, Math.min(ZOOM, Math.floor(1700 / w), Math.floor(700 / h)));
    // the two pictures of one moment
    const grab = (off) => {
      GFX.off = off;
      window.__frame(1, 1e-5);
      const cx = document.createElement('canvas');
      cx.width = w;
      cx.height = h;
      const g2 = cx.getContext('2d', { willReadFrequently: true });
      g2.drawImage(cv, x0, y0, w, h, 0, 0, w, h);
      return { cx, data: g2.getImageData(0, 0, w, h).data };
    };
    const A = grab(true);
    const levels = figs.map((c) => [c.fig._lodH || 0, c.fig._lodB || 0]);
    const B = grab(false);
    const levelsOn = figs.map((c) => [c.fig._lodH || 0, c.fig._lodB || 0]);
    let off = 0;
    let max = 0;
    const dc = document.createElement('canvas');
    dc.width = w;
    dc.height = h;
    const dg = dc.getContext('2d');
    const di = dg.createImageData(w, h);
    for (let i = 0; i < A.data.length; i += 4) {
      const dd = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
      if (dd > 24) off++;
      if (dd > max) max = dd;
      const v = 255 - Math.min(255, dd * 8);
      di.data[i] = di.data[i + 1] = di.data[i + 2] = v;
      di.data[i + 3] = 255;
    }
    dg.putImageData(di, 0, 0);
    // the sheet: before, after, difference x8, each w * zoom wide
    const head = 34;
    const sheet = document.createElement('canvas');
    sheet.width = Math.max(w * zoom, 640);
    sheet.height = (h * zoom + head) * 3;
    const sg = sheet.getContext('2d');
    sg.fillStyle = '#16161c';
    sg.fillRect(0, 0, sheet.width, sheet.height);
    sg.imageSmoothingEnabled = false;
    sg.textBaseline = 'middle';
    sg.font = 'bold 22px sans-serif';
    sg.fillStyle = '#fff';
    const panels = [
      [`before (every shape in full) - ${face}, ${d} m, ${zoom}x`, A.cx],
      [`after (lighter shapes by size)   levels (head, body): ${levelsOn.map((l) => l.join('/')).join('  ')}`, B.cx],
      [`difference x8 - ${((off / (w * h)) * 100).toFixed(3)}% of the pixels differ by more than 24, the most ${max}`, dc],
    ];
    panels.forEach(([text, im], i) => {
      sg.fillStyle = '#fff';
      sg.fillText(text, 10, i * (h * zoom + head) + head / 2);
      sg.drawImage(im, 0, i * (h * zoom + head) + head, w * zoom, h * zoom);
    });
    GFX.off = false;
    return { png: sheet.toDataURL('image/png'), pct: (off / (w * h)) * 100, max, w, h, zoom, levels: levelsOn, levelsOff: levels, ndc: [x0, y0, x1, y1] };
  }, [face, d, KINDS, ZOOM]);
  const file = path.join(OUT, `${face}_${String(d).replace('.', '_')}m.png`);
  fs.writeFileSync(file, Buffer.from(r.png.split(',')[1], 'base64'));
  const line = `${face.padEnd(5)} ${String(d).padStart(4)} m  ${r.pct.toFixed(3)}% differ (max ${r.max}), crop ${r.w}x${r.h} ${r.zoom}x, levels head/body ${r.levels.map((l) => l.join('/')).join(' ')}`;
  log.push(line);
  console.log(line);
}
fs.writeFileSync(path.join(OUT, 'ladder.txt'), log.join('\n'));
await close();
