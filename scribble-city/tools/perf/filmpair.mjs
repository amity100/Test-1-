// (ROADMAP 19.2, PHONE_SPEED_PLAN.md 8.3 step 2.5, "the film") Moments of the opening film as the phone draws them (lib.mjs),
// each drawn twice at one and the same moment - the parts of the phone's own way of drawing off (GFX.off) and on - and laid
// out for the player to look at: before, after, and how they differ (x8), the whole picture and two places of it at 3x.
//
//   node tools/perf/filmpair.mjs <outDir>          SCENES=2,3,4,5  AT=10,30 (scene seconds)   (EXTRA="newgfx=1" is put on by itself)
import fs from 'node:fs';
import path from 'node:path';
import { open } from './lib.mjs';

const OUT = process.argv[2] || 'film-out';
fs.mkdirSync(OUT, { recursive: true });
const SCENES = (process.env.SCENES || '2,3,4,5').split(',').map(Number);
const AT = (process.env.AT || '10,30').split(',').map(Number);
const log = [];
for (const sc of SCENES) {
  const { pg, close } = await open({ where: `s${sc}`, query: 'newgfx=1', cond: `P.sceneT > ${AT[0]}` });
  for (let i = 0; i < AT.length; i++) {
    const at = AT[i];
    if (i > 0) {
      // (on to the next moment: the scene's own clock, a step a frame)
      await pg.evaluate(async (at) => {
        const g = window.__game;
        const P = g.prologue;
        let n = 0;
        while (P.sceneT < at && n < 6000) {
          for (let k = 0; k < 6; k++) g.update(1 / 30);
          n += 6;
        }
      }, at);
    }
    const r = await pg.evaluate(async ([sc, at]) => {
      const g = window.__game;
      const { GFX } = await import('./js/core/util.js');
      for (const id of ['hud', 'touch']) {
        const el = document.getElementById(id);
        if (el) el.style.visibility = 'hidden';
      }
      window.__frame(3, 1 / 30);
      const cv = g.renderer.domElement;
      const w = cv.width;
      const h = cv.height;
      const grab = (off) => {
        GFX.off = off;
        window.__frame(1, 1e-5);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(cv, 0, 0);
        return { c, d: x.getImageData(0, 0, w, h).data };
      };
      const A = grab(true);
      const B = grab(false);
      GFX.off = false;
      const dc = document.createElement('canvas');
      dc.width = w;
      dc.height = h;
      const dg = dc.getContext('2d');
      const di = dg.createImageData(w, h);
      let off = 0;
      let max = 0;
      const BL = 96;
      const bw = Math.ceil(w / BL);
      const blocks = new Float64Array(bw * Math.ceil(h / BL));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const d = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]));
          if (d > 24) off++;
          if (d > max) max = d;
          blocks[Math.floor(y / BL) * bw + Math.floor(x / BL)] += d;
          const v = 255 - Math.min(255, d * 8);
          di.data[i] = di.data[i + 1] = di.data[i + 2] = v;
          di.data[i + 3] = 255;
        }
      }
      dg.putImageData(di, 0, 0);
      let best = 0;
      for (let i = 1; i < blocks.length; i++) if (blocks[i] > blocks[best]) best = i;
      const hot = [(best % bw) * BL + BL / 2, Math.floor(best / bw) * BL + BL / 2];
      const pct = (off / (w * h)) * 100;
      // the sheet: before, after at the width of the picture, then the difference and two places at 3x side by side
      const W = w;
      const head = 40;
      const Z = 3;
      const cw = W / 2 - 6;
      const chh = 330;
      const sheet = document.createElement('canvas');
      sheet.width = W;
      sheet.height = (h + head) * 2 + (chh + head) * 2 + 20;
      const sg = sheet.getContext('2d');
      sg.fillStyle = '#16161c';
      sg.fillRect(0, 0, sheet.width, sheet.height);
      sg.textBaseline = 'middle';
      sg.font = 'bold 28px sans-serif';
      sg.fillStyle = '#fff';
      let y = 0;
      sg.fillText(`before - scene ${sc}, ${at} s`, 14, y + head / 2);
      sg.drawImage(A.c, 0, y + head);
      y += head + h;
      sg.fillText(`after - ${pct.toFixed(3)}% of the pixels differ by more than 24`, 14, y + head / 2);
      sg.drawImage(B.c, 0, y + head);
      y += head + h + 10;
      sg.imageSmoothingEnabled = false;
      for (const [what, cx, cy] of [['where they differ most, 3x', hot[0], hot[1]], ['the middle, 3x', w / 2, h / 2]]) {
        const sw = cw / Z;
        const sh = chh / Z;
        const sx = Math.max(0, Math.min(w - sw, cx - sw / 2));
        const sy = Math.max(0, Math.min(h - sh, cy - sh / 2));
        sg.fillText(`before: ${what}`, 14, y + head / 2);
        sg.fillText(`after: ${what}`, W / 2 + 20, y + head / 2);
        sg.drawImage(A.c, sx, sy, sw, sh, 0, y + head, cw, chh);
        sg.drawImage(B.c, sx, sy, sw, sh, W / 2 + 6, y + head, cw, chh);
        y += head + chh + 5;
      }
      return { png: sheet.toDataURL('image/png'), pct, max };
    }, [sc, at]);
    const file = path.join(OUT, `s${sc}_${at}s.png`);
    fs.writeFileSync(file, Buffer.from(r.png.split(',')[1], 'base64'));
    const line = `scene ${sc} at ${at} s: ${r.pct.toFixed(3)}% of the pixels differ (max ${r.max})`;
    log.push(line);
    console.log(line);
  }
  await close();
}
fs.writeFileSync(path.join(OUT, 'film.txt'), log.join('\n'));
