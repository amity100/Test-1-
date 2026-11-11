// (PHONE_SPEED_PLAN.md 1.2) Which shop's goods make a view differ? For a camera (CAM="px,py,pz:lx,ly,lz", and
// WHERE as in lib.mjs), the view is drawn with every shop's goods (the parts off), with the rule (on), and then,
// for each shop the rule leaves out, with that one shop's goods drawn and the rest left out: the shop whose goods
// bring the picture back to the first is the one. Each is described: its kind, where its front is, where the
// camera is against it.
//   WHERE=at:-835,60,0 CAM="-835,1.8,65.6:-835,1.4,54.8" node tools/perf/shopwhy.mjs
import { open } from './lib.mjs';

const CAM = (process.env.CAM || '').split(':').map((t) => t.split(',').map(Number));
if (CAM.length !== 2) throw new Error('CAM="px,py,pz:lx,ly,lz"');
const { pg, where, close } = await open({ query: 'newgfx=1', frames: 40 });
const out = await pg.evaluate(async ([CAM]) => {
  const g = window.__game;
  const { GFX } = await import('./js/core/util.js');
  const I = g.world.interiors;
  const keep = new Set();
  const orig = g.pipe.viewHide;
  g.pipe.viewHide = (cam, hidden) => {
    orig(cam, hidden);
    for (let i = hidden.length - 1; i >= 0; i--) {
      if (keep.has(hidden[i])) {
        hidden[i].visible = true;
        hidden.splice(i, 1);
      }
    }
  };
  const c = g.renderer.domElement;
  const cv = document.createElement('canvas');
  cv.width = c.width;
  cv.height = c.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const grab = () => {
    cx.clearRect(0, 0, cv.width, cv.height);
    cx.drawImage(c, 0, 0);
    return cx.getImageData(0, 0, cv.width, cv.height).data;
  };
  const diff = (A, B) => {
    let off = 0;
    for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 24) off++;
    return (off / (A.length / 4)) * 100;
  };
  window.__camOverride = { pos: CAM[0], look: CAM[1] };
  g.player.spawn(CAM[0][0], CAM[0][2], 0);
  window.__frame(3, 1 / 30);
  const shot = (off) => {
    GFX.off = off;
    window.__frame(1, 1e-5);
    return grab();
  };
  const A = shot(true);
  const B = shot(false);
  const total = diff(A, B);
  const hiddenNow = [];
  const e = g.camera.matrixWorld.elements;
  for (const l of I.stream.live.values()) {
    const rec = l.cell && l.cell.rec;
    if (!rec || !l.group) continue;
    const f = rec.f;
    const sp = rec.spec;
    if (l.group.visible) {
      // (was it left out of this view? the rule, by hand)
      const w = f.toW(e[12], e[14]);
      const u = f.toU(e[12], e[14]);
      hiddenNow.push({ group: l.group, kind: rec.kind, u: +u.toFixed(1), w: +w.toFixed(1), u0: +sp.u0.toFixed(1), u1: +sp.u1.toFixed(1), depth: +sp.depth.toFixed(1), h: +sp.h.toFixed(1), y: +rec.y.toFixed(1), n: [f.nx, f.nz].map((v) => +v.toFixed(2)), at: [f.ox, f.oz].map((v) => +v.toFixed(1)) });
    }
  }
  const rows = [];
  for (const s of hiddenNow) {
    // (only the ones the rule would leave out)
    const inFront = s.w > -0.5;
    const inside = s.u > s.u0 - 1 && s.u < s.u1 + 1 && s.w > -s.depth - 1;
    if (inFront || inside || e[13] > s.y + s.h - 0.3) continue;
    keep.clear();
    keep.add(s.group);
    const C = shot(false);
    rows.push({ ...s, group: undefined, backBy: +diff(A, C).toFixed(3), diffWithoutIt: +diff(B, C).toFixed(3) });
  }
  keep.clear();
  return { total: +total.toFixed(3), rows, cam: [e[12], e[13], e[14]].map((v) => +v.toFixed(1)) };
}, [CAM]);
console.log(`${where}: the view ${JSON.stringify(CAM)} differs by ${out.total}% with the rule on (the camera at ${JSON.stringify(out.cam)})`);
console.log('shops the rule leaves out of it, and the picture with only that one shop\'s goods put back (against the picture with all of them):');
for (const r of out.rows.sort((a, b) => a.backBy - b.backBy)) console.log(`  ${r.kind.padEnd(11)} differs ${String(r.backBy).padStart(7)}%   (camera at u ${r.u}, w ${r.w}; its room u ${r.u0}..${r.u1}, ${r.depth} deep, ${r.h} high, floor y ${r.y}; its front at ${JSON.stringify(r.at)} facing ${JSON.stringify(r.n)})`);
await close();
