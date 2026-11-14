// Moments of one scene of the story's film as a phone draws them, laid out on one sheet - for looking at a scene's shots without
// playing to it: the scene is prepared and played by the story's own test pilot (tools/perf/lib.mjs open, game/prologue/autopilot.js),
// stepped to each time asked, and photographed. Each picture's tag: the scene's second, F in a film shot (the camera held) or P in play.
//   node tools/filmsheet.mjs <outDir> <scene 1-9> <t1,t2,...>      EXTRA="look=1" (added to the address)   KEEP=1 (the single pictures kept)
import fs from 'node:fs';
import path from 'node:path';
import { open } from './perf/lib.mjs';

const OUT = process.argv[2] || 'filmsheet-out';
const sc = +process.argv[3] || 2;
const AT = (process.argv[4] || '4,10,16,22,28,34').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const { pg, close } = await open({ where: `s${sc}`, query: process.env.EXTRA || '', cond: `P.sceneT > ${AT[0]}`, dsf: 1 });
const shots = [];
for (let i = 0; i < AT.length; i++) {
  const r = await pg.evaluate(async ([at, sc]) => {
    const g = window.__game;
    const P = g.prologue;
    let n = 0;
    while (P.sceneN === sc && P.sceneT < at && n < 9000) {
      for (let k = 0; k < 6; k++) g.update(1 / 30);
      n += 6;
    }
    for (const id of ['hud', 'touch']) {
      const el = document.getElementById(id);
      if (el) el.style.visibility = 'hidden';
    }
    window.__frame(3, 1 / 30);
    return { scene: P.sceneN, t: +P.sceneT.toFixed(1), film: !!P.holdCam };
  }, [AT[i], sc]);
  if (r.scene !== sc) {
    console.log(`s${sc}: over before ${AT[i]} s (now scene ${r.scene})`);
    break;
  }
  const tag = `${Math.round(r.t)}${r.film ? 'F' : 'P'}`;
  const f = path.join(OUT, `s${sc}_${String(i).padStart(2, '0')}_${tag}.png`);
  await pg.screenshot({ path: f, timeout: 180000 });
  shots.push([f, tag]);
  console.log(`s${sc} ${r.t} s ${r.film ? 'film' : 'play'}  (${Math.round((Date.now() - t0) / 1000)} s)`);
}
// (the sheet: three across, put together in a page of its own)
if (shots.length) {
  const W = 588;
  const H = 274;
  const pg2 = await pg.context().newPage();
  await pg2.setViewportSize({ width: W * 3, height: H * Math.ceil(shots.length / 3) });
  const cells = shots.map(([f, tag]) => `<div style="position:relative;height:${H}px"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" width="${W}" height="${H}"><span style="position:absolute;left:0;top:0;background:#000;color:#fff;padding:1px 5px">${tag}</span></div>`);
  await pg2.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(3,${W}px);font:12px sans-serif">${cells.join('')}</body>`);
  await pg2.screenshot({ path: path.join(OUT, `s${sc}_sheet.jpg`), type: 'jpeg', quality: 88 });
  if (!process.env.KEEP) for (const [f] of shots) fs.unlinkSync(f);
  console.log(`s${sc}_sheet.jpg`);
}
await close();
