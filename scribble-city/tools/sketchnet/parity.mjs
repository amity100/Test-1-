// game/sketchnet.js against the numpy network (parity.py), on the same held-out drawings
import { readFileSync } from 'fs';
import { chances, picture, CLASSES } from '../../v5/js/game/sketchnet.js';
const data = JSON.parse(readFileSync(new URL('./parity.json', import.meta.url)));
let maxd = 0;
let same = 0;
let right = 0;
const t0 = performance.now();
for (const d of data) {
  const p = chances(picture(d.strokes));
  let a = 0;
  let b = 0;
  for (let i = 0; i < p.length; i++) {
    maxd = Math.max(maxd, Math.abs(p[i] - d.p[i]));
    if (p[i] > p[a]) a = i;
    if (d.p[i] > d.p[b]) b = i;
  }
  if (a === b) same++;
  if (CLASSES[a] === d.cls) right++;
}
const ms = (performance.now() - t0) / data.length;
console.log(`drawings ${data.length}  same top-1 ${same}/${data.length}  max prob diff ${maxd.toFixed(5)}  js top-1 ${(right / data.length).toFixed(3)}  ${ms.toFixed(2)} ms each`);
