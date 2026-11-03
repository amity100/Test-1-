import { Model, box, ball, tube, addMaker } from './products.js';

// (v5, ROADMAP 16.5) The sports shop's things (world/sportstore.js): the balls in their bins, the
// bikes on the wall, the treadmill's belt.

const DARK = [0.14, 0.14, 0.16];
const STEEL = [0.74, 0.76, 0.8];

// a ball: its skin (the look's tint), the seams round it (the look's cap); r by its kind
// (look.r: a basketball 0.12, a football 0.11, a volleyball 0.105, a tennis ball 0.034)
function ballMaker(r, seams) {
  return (low) => {
    const m = new Model();
    m.size = [r * 2, r * 2, r * 2];
    ball(m.part('plain', null, 0), 0, r, 0, r, 1, low ? 6 : 9, low ? 8 : 12);
    if (!low) {
      const p = m.part('plain', 'cap', 1);
      const n = 18;
      for (const [ax, tilt] of seams) {
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2;
          // (a great circle, turned about y by ax and tipped by tilt)
          const x0 = Math.cos(a) * r * 1.01;
          const y0 = Math.sin(a) * r * 1.01;
          const x1 = x0 * Math.cos(ax);
          const z1 = x0 * Math.sin(ax);
          const y1 = y0 * Math.cos(tilt) - z1 * Math.sin(tilt);
          const z2 = y0 * Math.sin(tilt) + z1 * Math.cos(tilt);
          pts.push([x1, r + y1, z2]);
        }
        tube(p, pts, r * 0.035, 3);
      }
    }
    return m;
  };
}
addMaker('basketball', ballMaker(0.12, [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]));
addMaker('football', ballMaker(0.11, [[0.4, 0.3], [1.9, 0.8], [3.1, 1.3]]));
addMaker('volleyball', ballMaker(0.105, [[0, 0.5], [2.1, 0.5], [4.2, 0.5]]));

// a bike, side on along x (its front +x), standing on its wheels: the wheels (tyre, rim, a few
// spokes), the frame's tubes (the look's tint), the fork, the saddle, the bars, the cranks
addMaker('bike', (low) => {
  const m = new Model();
  const R = 0.33;
  const wb = 1.02;
  m.size = [wb + 2 * R + 0.1, 1.05, 0.5];
  const tyre = m.part('plain', DARK, 0);
  const rim = m.part('gloss', STEEL, 1);
  const n = low ? 12 : 20;
  for (const cx of [-wb / 2, wb / 2]) {
    const ring = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      ring.push([cx + Math.cos(a) * R, R + Math.sin(a) * R, 0]);
    }
    tube(tyre, ring, 0.022, 4);
    if (!low) {
      const ring2 = ring.map(([x, y]) => [cx + (x - cx) * 0.9, R + (y - R) * 0.9, 0]);
      tube(rim, ring2, 0.008, 3);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        tube(rim, [[cx, R, 0], [cx + Math.cos(a) * R * 0.88, R + Math.sin(a) * R * 0.88, 0]], 0.003, 3);
      }
    }
  }
  // the frame (a diamond): seat tube, top tube, down tube, the stays to the back wheel's hub
  const fr = m.part('gloss', null, 2);
  const bb = [-0.05, R - 0.02, 0];
  const st = [-0.16, R + 0.5, 0];
  const ht0 = [wb / 2 - 0.16, R + 0.42, 0];
  const ht1 = [wb / 2 - 0.13, R + 0.56, 0];
  tube(fr, [bb, st], 0.022, 6);
  tube(fr, [st, ht1], 0.02, 6);
  tube(fr, [bb, ht0], 0.026, 6);
  tube(fr, [ht0, ht1], 0.026, 6);
  for (const z of [-0.04, 0.04]) {
    tube(fr, [[-wb / 2, R, z], [bb[0], bb[1], z * 0.5]], 0.012, 5);
    tube(fr, [[-wb / 2, R, z], [st[0] + 0.02, st[1] - 0.04, z * 0.4]], 0.011, 5);
    // (the fork to the front hub)
    tube(fr, [[ht0[0], ht0[1], z * 0.5], [wb / 2, R, z]], 0.013, 5);
  }
  // the saddle on its post; the bars on their stem; the cranks and the pedals
  const dk = m.part('plain', DARK, 3);
  tube(dk, [[st[0], st[1], 0], [st[0] - 0.03, st[1] + 0.12, 0]], 0.012, 5);
  box(dk, st[0] - 0.16, st[1] + 0.12, -0.06, st[0] + 0.1, st[1] + 0.16, 0.06);
  tube(dk, [[ht1[0], ht1[1], 0], [ht1[0] + 0.05, ht1[1] + 0.1, 0]], 0.014, 5);
  tube(dk, [[ht1[0] + 0.05, ht1[1] + 0.1, -0.24], [ht1[0] + 0.05, ht1[1] + 0.1, 0.24]], 0.012, 5);
  tube(dk, [[bb[0] - 0.14, bb[1] - 0.06, 0.07], [bb[0] + 0.14, bb[1] + 0.06, -0.07]], 0.01, 4);
  for (const [x, y, z] of [[bb[0] - 0.14, bb[1] - 0.06, 0.1], [bb[0] + 0.14, bb[1] + 0.06, -0.1]]) box(dk, x - 0.05, y - 0.012, z - 0.04, x + 0.05, y + 0.012, z + 0.04);
  return m;
});

// a slat of the treadmill's belt (moved along it, round and round: game/trylife.js)
addMaker('slat', () => {
  const m = new Model();
  m.size = [0.04, 0.006, 0.44];
  box(m.part('plain', [0.24, 0.24, 0.27], 0), -0.02, 0, -0.22, 0.02, 0.006, 0.22);
  return m;
});
