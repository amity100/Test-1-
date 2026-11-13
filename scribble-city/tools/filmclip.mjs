// A scene of the story's film as a moving picture, as a phone draws it (no sound; its words are on the screen): the scene is prepared
// and played by the story's own test pilot (tools/perf/lib.mjs open), stepped a fifteenth of a second a picture, and the pictures
// put together by ffmpeg. For judging a scene in motion - a walk, a cut, a hand - before the owner sees it.
//   node tools/filmclip.mjs <outDir> <scene 1-9> <from s> <to s>      EXTRA="look=1"   FPS=15   NAME=s2   STRIP=1 (also a sheet of every 4th picture)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { open } from './perf/lib.mjs';

const OUT = process.argv[2] || 'filmclip-out';
const sc = +process.argv[3] || 2;
const T0 = +process.argv[4] || 0.5;
const T1 = +process.argv[5] || 30;
const FPS = +process.env.FPS || 15;
const name = process.env.NAME || `s${sc}`;
const dir = path.join(OUT, `${name}_frames`);
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
const t0 = Date.now();
const { pg, close } = await open({ where: `s${sc}`, query: process.env.EXTRA || '', cond: `P.sceneT > ${T0}`, dsf: 1, frames: 1 });
await pg.evaluate(() => {
  for (const id of ['hud', 'touch']) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = 'hidden';
  }
});
const steps = Math.round(30 / FPS);
let n = 0;
for (;;) {
  const r = await pg.evaluate(([steps]) => {
    window.__frame(steps, 1 / 30);
    const P = window.__game.prologue;
    return { scene: P.sceneN, t: P.sceneT };
  }, [steps]);
  if (r.scene !== sc || r.t > T1 || n > 3000) break;
  await pg.screenshot({ path: path.join(dir, `f${String(n).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88, timeout: 180000 });
  n++;
}
await close();
const mp4 = path.join(OUT, `${name}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', mp4]);
console.log(`${name}.mp4  ${n} pictures, ${(n / FPS).toFixed(1)} s  (${Math.round((Date.now() - t0) / 1000)} s)`);
