// (ROADMAP 19, PHONE_SPEED_PLAN.md 1.2 and 1.4) Is a shop's goods left out of a view only where no ray from
// the eye reaches them? For shops of every kind found round WHERE (a place of the city, lib.mjs), the
// camera is put where a person could not see into the shop, and where they could - in front across the
// street, at its window, from behind it, from both sides, from above, from inside - and each view is
// drawn twice at one and the same moment, with the parts off (GFX.off) and on: the pixels that differ are
// counted. Nothing may differ, anywhere. (A view that does: put the same camera in ab-phone.mjs's SPOTS and look.)
//
//   WHERE=at:-835,60,0 node tools/perf/shopcheck.mjs      (EXTRA="newgfx=1" is put on by itself)
//   SHOPS=8             how many shops (one of each kind first)
//   SHOPKIND=jewelry    only shops of that kind;  VIEWS='behind it,above'  only the views whose name has one of those in it;  ORBIT=0  no walk round it
import { open } from './lib.mjs';

const SHOPS = +(process.env.SHOPS || 8);
const KIND = process.env.SHOPKIND || '';
const VIEWS = process.env.VIEWS || '';
const ORBIT = process.env.ORBIT !== '0';
const { pg, where, close } = await open({ query: 'newgfx=1', frames: 40 });

const rows = await pg.evaluate(async ([SHOPS, KIND, VIEWS, ORBIT]) => {
  const g = window.__game;
  const { GFX } = await import('./js/core/util.js');
  if (!GFX.shopView) return { error: 'the shops\' view is not on (GFX.shopView false): a phone, or ?low, with ?newgfx=1' };
  const I = g.world.interiors;
  const live = [...I.stream.live.values()].filter((l) => l.cell && l.cell.rec && l.group && (!KIND || l.cell.rec.kind === KIND));
  // one of each kind first, then more of the same
  const seen = new Set();
  const first = [];
  const rest = [];
  for (const l of live) {
    const k = l.cell.rec.kind;
    if (seen.has(k)) rest.push(l);
    else {
      seen.add(k);
      first.push(l);
    }
  }
  const list = [...first, ...rest].slice(0, SHOPS);
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
  const out = [];
  const pics = [];
  for (const l of list) {
    const rec = l.cell.rec;
    const f = rec.f;
    const sp = rec.spec;
    const um = (sp.u0 + sp.u1) / 2;
    const y0 = rec.y;
    const dep = sp.depth;
    const at = (u, y, w) => {
      const p = f.p(u, 0, w);
      return [p[0], y0 + y, p[2]];
    };
    const mid = at(um, 1.3, -dep / 2);
    const views = [
      ['street 6 m', at(um, 1.7, 6), mid],
      ['across the street 22 m', at(um, 1.7, 22), mid],
      ['at the window', at(um, 1.6, 1.6), mid],
      ['from inside', at(um, 1.6, -dep * 0.3), at(um, 1.3, -dep)],
      ['behind it', at(um, 1.7, -dep - 7), mid],
      ['beside it, left', at(sp.u0 - 6, 1.7, -dep / 2), mid],
      ['beside it, right', at(sp.u1 + 6, 1.7, -dep / 2), mid],
      ['above it', at(um, 16, -dep / 2), mid],
      ['behind it, high', at(um, 8, -dep - 9), mid],
    ];
    // (and, for the first of them: all the way round it, in steps of 15 degrees at 12 metres, and in through
    // its door in ten steps - what is seen of its goods must not change by a pixel anywhere on the way)
    if (ORBIT && l === list[0]) {
      const cu = (sp.u0 + sp.u1) / 2;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const ox = cu + Math.cos(a) * 12;
        const ow = -dep / 2 + Math.sin(a) * 12;
        views.push([`round it ${k * 15} deg`, at(ox, 1.7, ow), mid]);
      }
      const door = (sp.openings || []).find((o) => o.kind === 'door');
      const du = door ? (door.u0 + door.u1) / 2 : cu;
      for (let k = 0; k <= 10; k++) {
        const w = 10 - (k / 10) * (10 + dep * 0.8);
        views.push([`in through the door ${k}/10`, at(du, 1.6, w), at(du, 1.3, -dep)]);
      }
    }
    for (const [name, pos, look] of views) {
      if (VIEWS && !VIEWS.split(',').some((v) => name.includes(v))) continue;
      window.__camOverride = { pos, look };
      const x = pos[0];
      const z = pos[2];
      g.player.spawn(x, z, 0);
      window.__frame(3, 1 / 30);
      GFX.off = true;
      window.__frame(1, 1e-5);
      const A = grab();
      GFX.off = false;
      window.__frame(1, 1e-5);
      const hidden = I.viewStats ? I.viewStats.hidden : -1;
      const B = grab();
      let off = 0;
      let sum = 0;
      for (let i = 0; i < A.length; i += 4) {
        const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        sum += d;
        if (d > 24) off++;
      }
      const n = A.length / 4;
      const row = { shop: rec.kind, view: name, pct: (off / n) * 100, mean: sum / n, hiddenShops: hidden, pos: pos.map((v) => +v.toFixed(1)), look: look.map((v) => +v.toFixed(1)) };
      out.push(row);
    }
  }
  return { rows: out, shops: list.map((l) => l.cell.rec.kind) };
}, [SHOPS, KIND, VIEWS, ORBIT]);

if (rows.error) {
  console.log(rows.error);
} else {
  console.log(`${where}: ${rows.shops.length} shops (${rows.shops.join(', ')}), ${rows.rows.length} views, each at one moment with the parts off and on`);
  let worst = 0;
  for (const r of rows.rows) {
    worst = Math.max(worst, r.pct);
    console.log(`  ${r.shop.padEnd(12)} ${r.view.padEnd(24)} ${r.pct.toFixed(3)}% of the pixels differ (mean ${r.mean.toFixed(3)}), shops left out of the last view: ${r.hiddenShops}   camera ${JSON.stringify(r.pos)} looking at ${JSON.stringify(r.look)}`);
  }
  console.log(worst < 0.02 ? `PASS: nothing differs (worst ${worst.toFixed(3)}%)` : `DIFFERS: worst ${worst.toFixed(3)}% - look at the views above that are not 0`);
}
await close();
