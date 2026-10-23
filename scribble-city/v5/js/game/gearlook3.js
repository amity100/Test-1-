import { sheet, slab, cyl, box, sph, tor, blade, beltY, hueOf, mix, lerp, r3, carNums, clamp, STEEL, CHROME, RUBBER, WHITE, HAZARD, RED, GREEN } from './gearlook.js';

// (ROADMAP 11.28) More of the pen's things designed (game/gearlook.js has how): the weapons - missiles on
// their rails, the flamethrower, the mine layer, the harpoon gun, the net launcher, the wrecking crane, the
// drone on its pad - and what keeps the car whole - armour plate, the bull bar, the oil drum, the rear
// shield, spikes, the repair kit, the paint sprayers, the jammer, the ejector seat's hatch, the decoy's
// pencil.

const DARK = [0.12, 0.12, 0.14];
const OLIVE = [0.34, 0.38, 0.27];
const GUNMETAL = [0.24, 0.26, 0.29];

// ------------------------------------------------------------------ the missile launcher
// (on the roof, a launcher on its turntable: rails, and on them the missiles - their bodies, noses, fins;
// level 2 a pod of three, level 3 four. Fired, they leave the rails and the next ones come up)
function missilesDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof - 0.02;
  const zc = -0.2;
  const per = lv === 1 ? 1 : 2;
  const L = 1.25;
  const rm = 0.075;
  P.push(cyl([0, y0, zc], [0, y0 + 0.08, zc], 0.3, 0.28, 'dark', 'gun', { n: 20 }));
  P.push(box([0, y0 + 0.08, zc - 0.32], [0.26, y0 + 0.22, zc + 0.3], 'frame'));
  const groups = { ammo: { at: [0.1, y0 + 0.4, zc], ax: 'x', kind: 'ammo' } };
  for (let i = 0; i < per; i++) {
    const x = 0.11 + i * 0.17;
    const y = y0 + 0.32 + (lv === 3 && i ? 0.17 : 0);
    // its rail; on it the missile - body, nose, fins
    P.push(box([x - 0.03, y - rm - 0.03, zc - L / 2], [x + 0.03, y - rm, zc + L / 2], 'frame', 'gun', { noSil: i > 0 }));
    P.push(cyl([x, y, zc - L / 2], [x, y, zc + L / 2 - 0.26], rm, rm, 'body', 'ammo', { n: 14 }));
    P.push(cyl([x, y, zc + L / 2 - 0.26], [x, y, zc + L / 2], rm, 0.01, 'nose', 'ammo', { n: 14 }));
    P.push(cyl([x, y, zc + 0.1], [x, y, zc + 0.16], rm + 0.004, rm + 0.004, 'band', 'ammo', { n: 14, noSil: true }));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = x + Math.cos(a) * (rm + 0.06);
      const cy = y + Math.sin(a) * (rm + 0.06);
      P.push(box([Math.min(x, cx) - 0.006, Math.min(y, cy) - 0.006, zc - L / 2], [Math.max(x, cx) + 0.006, Math.max(y, cy) + 0.006, zc - L / 2 + 0.22], 'fin', 'ammo', { noSil: k !== 1 }));
    }
    if (lv === 3) P.push(box([x - 0.002, y + rm, zc - 0.1], [x + 0.002, y + rm + 0.05, zc + 0.3], 'fin', 'ammo', { noSil: true }));
  }
  if (lv >= 2) {
    // (the pod's casing round them)
    P.push(box([0.02, y0 + 0.2, zc - L / 2 + 0.3], [0.04, y0 + 0.2 + (lv === 3 ? 0.42 : 0.26), zc + L / 2 - 0.3], 'pod', 'gun', { noSil: true }));
  }
  const pal = { dark: DARK, frame: GUNMETAL, body: hc ? mix(hc, WHITE, 0.4) : [0.9, 0.91, 0.88], nose: RED, band: HAZARD, fin: [0.2, 0.22, 0.26], pod: OLIVE };
  return sheet('missiles', lines, ctx, o, {
    ax: 'x',
    c: 0.11 + 0.1,
    prims: P,
    pivot: [0, y0 + 0.08, zc],
    pal,
    groups,
    mirror: true,
    box: [zc - L / 2, zc + L / 2, y0 + 0.32 - rm - 0.06, y0 + 0.32 + rm + 0.06],
    focus: { at: [0, y0 + 0.3, zc], k: 0.25 },
    n: { lv, rails: per * 2, top: r3([0, y0 + 0.4, zc + L / 2]) },
    traits: { missiles: per * 2 },
  });
}

// ------------------------------------------------------------------ the flamethrower
// (two fuel tanks across the boot, their hose along the side to a nozzle under the front bumper - its pilot
// light lit; the fire comes out of it only as it fires)
function flamerDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const K = ctx.K;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const yt = (K ? beltY(K, 0.06) : C.tailY + 0.3) + 0.12;
  const zt = -D.hl + 0.4;
  for (const z of [zt, zt + 0.32]) {
    P.push(cyl([-0.55, yt, z], [0.55, yt, z], 0.13, 0.13, 'tank', 'gun', { n: 16, noSil: true }));
    P.push(sph([0.55, yt, z], 0.13, 'tank', 'gun', { noSil: true }));
    P.push(sph([-0.55, yt, z], 0.13, 'tank', 'gun', { noSil: true }));
  }
  P.push(cyl([0.4, yt + 0.12, zt + 0.16], [D.hw - 0.1, C.mid - 0.1, 0], 0.025, 0.025, 'hose', 'gun', { n: 6, noSil: true }));
  P.push(cyl([D.hw - 0.1, C.mid - 0.1, 0], [0.2, C.noseY - 0.05, D.hl - 0.1], 0.025, 0.025, 'hose', 'gun', { n: 6, noSil: true }));
  // the nozzle under the bumper: its pipe, its guard, its pilot light
  const yn = C.noseY - 0.08;
  const zn = D.hl + 0.05;
  P.push(cyl([0, yn, zn - 0.25], [0, yn, zn + 0.32], 0.06, 0.05, 'pipe', 'gun', { n: 12 }));
  P.push(cyl([0, yn, zn + 0.32], [0, yn, zn + 0.42], 0.08, 0.09, 'dark', 'gun', { n: 12 }));
  P.push(box([-0.03, yn + 0.06, zn + 0.18], [0.03, yn + 0.11, zn + 0.38], 'dark'));
  P.push(sph([0, yn + 0.11, zn + 0.4], 0.025, 'pilot', 'gun', { noSil: true }));
  // the fire: out only as it fires (and as it takes shape)
  const fl = [1.8, 2.6, 2.6][lv - 1];
  const fw = lv >= 3 ? 0.5 : 0.32;
  P.push(cyl([0, yn, zn + 0.42], [0, yn + 0.25, zn + 0.42 + fl], 0.09, fw, 'flameO', 'flame', { n: 14 }));
  P.push(cyl([0, yn, zn + 0.42], [0, yn + 0.12, zn + 0.42 + fl * 0.6], 0.05, fw * 0.5, 'flameY', 'flame', { n: 12, noSil: true }));
  const pal = { tank: hc || RED, hose: RUBBER, pipe: GUNMETAL, dark: DARK, pilot: [0.4, 0.7, 1], flameO: [1, 0.45, 0.1], flameY: [1, 0.9, 0.4] };
  return sheet('flamer', lines, ctx, o, {
    ax: 'x',
    c: 0,
    prims: P,
    pivot: [0, yn, zn + 0.42],
    pal,
    mats: { flameO: 'glow', flameY: 'glow', pilot: 'glow' },
    groups: { flame: { at: [0, yn, zn + 0.42], ax: 'z', kind: 'flame' } },
    box: [zn + 0.42, zn + 0.42 + fl, yn - fw, yn + fw + 0.25],
    focus: { at: [0, yn + 0.2, zn + 0.8], k: 0.15 },
    n: { lv, range: [8, 12, 16][lv - 1] },
    traits: {},
  });
}

// ------------------------------------------------------------------ the mine layer
// (under the back bumper its dispenser, its hatch; on the boot a rack of disc mines - their red lights)
function minesDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const K = ctx.K;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const zb = -D.hl - 0.04;
  const yb = Math.max(0.24, C.clear);
  P.push(box([-0.36, yb - 0.08, zb - 0.06], [0.36, yb + 0.1, zb + 0.3], 'box'));
  P.push(box([-0.3, yb - 0.09, zb - 0.07], [0.3, yb - 0.07, zb + 0.06], 'hazard', 'gun', { noSil: true }));
  const yr = (K ? beltY(K, 0.06) : C.tailY + 0.3) + 0.03;
  const zr = -D.hl + 0.35;
  const n = lv >= 3 ? 3 : 2;
  const R = 0.2 + 0.03 * (lv - 1);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.46;
    P.push(cyl([x, yr, zr], [x, yr + 0.08, zr], R, R * 0.9, 'mine', 'gun', { n: 18 }));
    P.push(cyl([x, yr + 0.08, zr], [x, yr + 0.12, zr], R * 0.45, R * 0.35, 'mine', 'gun', { n: 14 }));
    P.push(sph([x, yr + 0.135, zr], 0.03, 'light', 'gun', { noSil: true }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      P.push(cyl([x + Math.cos(a) * R * 0.9, yr + 0.04, zr + Math.sin(a) * R * 0.9], [x + Math.cos(a) * (R + 0.06), yr + 0.06, zr + Math.sin(a) * (R + 0.06)], 0.016, 0.006, 'spike', 'gun', { n: 6, noSil: k % 2 }));
    }
  }
  const pal = { box: GUNMETAL, hazard: HAZARD, mine: hc || OLIVE, light: RED, spike: STEEL };
  return sheet('mines', lines, ctx, o, {
    ax: 'y',
    c: yr + 0.13,
    prims: P,
    pivot: [0, yr, zr],
    pal,
    mats: { light: 'glow' },
    groups: { light: { at: [0, yr + 0.13, zr], ax: 'y', kind: 'blink' } },
    focus: { at: [0, yr, zr], k: 0.3 },
    n: { lv, R },
    traits: { mines: n },
  });
}

// ------------------------------------------------------------------ the harpoon gun
// (on the hood: its stock and mount, its barrel, the harpoon loaded in it - its barbed head out front - and
// the reel of steel cable at its side)
function harpoonDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const yb = C.hoodY + 0.2;
  const zb = C.hoodZ - 0.25;
  const L = 1.15;
  const xs = lv >= 3 ? [0.26] : [0];
  const mirror = lv >= 3;
  for (const x of xs) {
    P.push(cyl([x, C.hoodY - 0.02, zb], [x, yb - 0.07, zb], 0.05, 0.05, 'dark', 'gun', { n: 10 }));
    P.push(box([x - 0.07, yb - 0.08, zb - 0.32], [x + 0.07, yb + 0.07, zb + 0.15], 'body'));
    P.push(cyl([x, yb, zb + 0.15], [x, yb, zb + L * 0.62], 0.045, 0.045, 'barrel', 'gun', { n: 12 }));
    P.push(cyl([x, yb, zb - 0.44], [x, yb, zb - 0.3], 0.05, 0.06, 'dark', 'gun', { n: 10 }));
    // the harpoon: its shaft, its head and barbs - it flies (game/gearweap2.js)
    P.push(cyl([x, yb, zb + L * 0.62], [x, yb, zb + L * 0.85], 0.02, 0.02, 'steel', 'spear', { n: 8 }));
    P.push(cyl([x, yb, zb + L * 0.85], [x, yb, zb + L], 0.05, 0.004, 'head', 'spear', { n: 10 }));
    for (const s of [1, -1]) P.push(cyl([x, yb, zb + L * 0.88], [x, yb + s * 0.09, zb + L * 0.8], 0.012, 0.006, 'head', 'spear', { n: 6 }));
    // the reel
    P.push(cyl([x + 0.08, yb - 0.02, zb - 0.12], [x + 0.18, yb - 0.02, zb - 0.12], 0.1, 0.1, 'reel', 'gun', { n: 16, noSil: true }));
    P.push(tor([x + 0.13, yb - 0.02, zb - 0.12], 0.09, 0.012, 'x', 'cable', 'gun', { noSil: true }));
  }
  const pal = { dark: DARK, body: hc || [0.32, 0.36, 0.42], barrel: GUNMETAL, steel: CHROME, head: [0.85, 0.86, 0.9], reel: HAZARD, cable: [0.5, 0.5, 0.52] };
  return sheet('harpoon', lines, ctx, o, {
    ax: 'x',
    c: xs[0],
    prims: P,
    pivot: [xs[0], yb, zb],
    pal,
    mats: { steel: 'metal', head: 'metal' },
    groups: { spear: { at: [xs[0], yb, zb + L * 0.7], ax: 'z', kind: 'show' } },
    mirror,
    focus: { at: [0, yb, zb + 0.3], k: 0.35 },
    n: { lv, muzzle: r3([xs[0], yb, zb + L]) },
    traits: { guns: mirror ? 2 : 1 },
  });
}

// ------------------------------------------------------------------ the net launcher
// (on the roof: a low box, a short barrel at each corner angled up and out - the net's weights in them - and
// the net folded on top)
function netDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof - 0.02;
  const zc = -0.15;
  const w = 0.42 + 0.04 * (lv - 1);
  P.push(box([-w, y0, zc - w], [w, y0 + 0.16, zc + w], 'box'));
  // the net folded on it: its cords, criss-cross
  for (let i = 0; i <= 6; i++) {
    const t = lerp(-w + 0.06, w - 0.06, i / 6);
    P.push(box([t - 0.008, y0 + 0.16, zc - w + 0.06], [t + 0.008, y0 + 0.185, zc + w - 0.06], 'cord', 'gun', { noSil: true }));
    P.push(box([-w + 0.06, y0 + 0.16, zc + t - 0.008], [w - 0.06, y0 + 0.185, zc + t + 0.008], 'cord', 'gun', { noSil: true }));
  }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const b0 = [sx * (w - 0.06), y0 + 0.12, zc + sz * (w - 0.06)];
    const b1 = [sx * (w + 0.06), y0 + 0.36, zc + sz * (w + 0.06)];
    P.push(cyl(b0, b1, 0.055, 0.06, 'barrel', 'gun', { n: 12 }));
    P.push(sph(b1, 0.045, 'weight', 'gun', { noSil: true }));
  }
  const pal = { box: hc ? mix(hc, GUNMETAL, 0.4) : GUNMETAL, cord: [0.85, 0.82, 0.7], barrel: DARK, weight: HAZARD };
  return sheet('net', lines, ctx, o, {
    ax: 'y',
    c: y0 + 0.2,
    prims: P,
    pivot: [0, y0 + 0.1, zc],
    pal,
    focus: { at: [0, y0 + 0.15, zc], k: 0.35 },
    n: { lv },
    traits: {},
  });
}

// ------------------------------------------------------------------ the wrecking crane
// (on the roof, a little crane on its turntable: its jib out over the side, the chain down from its tip, the
// ball on it - swung out as it fires; level 3 a jib each way)
function wreckDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof - 0.02;
  const zc = -0.25;
  const Rb = 0.32 + 0.06 * (lv - 1);
  const xt = D.hw + 0.55;
  const yt = y0 + 1.15;
  P.push(cyl([0, y0, zc], [0, y0 + 0.12, zc], 0.3, 0.28, 'dark', 'gun', { n: 20 }));
  P.push(box([-0.14, y0 + 0.12, zc - 0.16], [0.14, y0 + 0.42, zc + 0.16], 'cab'));
  // the jib: a lattice of two rails and their braces, out and up to over the side
  for (const dz of [-0.07, 0.07]) P.push(cyl([0.08, y0 + 0.36, zc + dz], [xt, yt, zc + dz], 0.025, 0.02, 'jib', 'gun', { n: 6 }));
  for (let k = 1; k < 6; k++) {
    const t = k / 6;
    const x = lerp(0.08, xt, t);
    const y = lerp(y0 + 0.36, yt, t);
    P.push(cyl([x, y, zc - 0.07], [x, y, zc + 0.07], 0.012, 0.012, 'jib', 'gun', { n: 6, noSil: true }));
  }
  P.push(cyl([xt, yt + 0.04, zc - 0.1], [xt, yt + 0.04, zc + 0.1], 0.06, 0.06, 'dark', 'gun', { n: 10 }));
  // the chain and the ball: they swing (game/gearweap2.js)
  const yb = Math.max(C.mid + 0.1, yt - 1.15);
  const nl = 7;
  for (let k = 0; k < nl; k++) {
    const y = lerp(yt, yb + Rb, (k + 0.5) / nl);
    P.push(tor([xt, y, zc], 0.04, 0.012, k % 2 ? 'x' : 'z', 'chain', 'ball', { noSil: true }));
  }
  P.push(sph([xt, yb, zc], Rb, 'ball', 'ball'));
  P.push(tor([xt, yb + Rb, zc], 0.06, 0.02, 'z', 'chain', 'ball', { noSil: true }));
  const pal = { dark: DARK, cab: hc || HAZARD, jib: hc ? mix(hc, HAZARD, 0.5) : HAZARD, chain: [0.45, 0.46, 0.5], ball: [0.16, 0.16, 0.18] };
  return sheet('wreck', lines, ctx, o, {
    ax: 'z',
    c: zc + 0.4,
    prims: P,
    pivot: [0, y0 + 0.12, zc],
    pal,
    mats: { ball: 'metal', chain: 'metal' },
    groups: { ball: { at: [xt, yt, zc], ax: 'z', kind: 'swing' } },
    mirror: lv >= 3,
    box: [-(xt + Rb), -(xt - Rb), yb - Rb, yt],
    focus: { at: [D.hw * 0.5, y0 + 0.4, zc], k: 0.05 },
    n: { lv, R: Rb, tip: r3([xt, yt, zc]) },
    traits: { R: Rb },
  });
}

// ------------------------------------------------------------------ the drone on its pad
// (on the roof: a landing pad, its H; on it the drone - its body, four arms, four rotors in their guards, a
// paint gun under it. Fired, it takes off after the nearest police car: game/gearweap2.js)
function droneDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof - 0.02;
  const zc = -0.2;
  P.push(box([-0.45, y0, zc - 0.45], [0.45, y0 + 0.05, zc + 0.45], 'pad'));
  for (const x of [-0.18, 0.18]) P.push(box([x - 0.03, y0 + 0.05, zc - 0.2], [x + 0.03, y0 + 0.058, zc + 0.2], 'mark', 'gun', { noSil: true }));
  P.push(box([-0.18, y0 + 0.05, zc - 0.03], [0.18, y0 + 0.058, zc + 0.03], 'mark', 'gun', { noSil: true }));
  const yd = y0 + 0.16;
  P.push(box([-0.12, yd - 0.05, zc - 0.16], [0.12, yd + 0.06, zc + 0.16], 'body', 'drone'));
  P.push(cyl([0, yd - 0.05, zc + 0.08], [0, yd - 0.11, zc + 0.08], 0.03, 0.03, 'dark', 'drone', { n: 8 }));
  P.push(cyl([0, yd - 0.1, zc + 0.08], [0, yd - 0.1, zc + 0.22], 0.015, 0.015, 'dark', 'drone', { n: 6, noSil: true }));
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ex = sx * 0.3;
    const ez = zc + sz * 0.3;
    P.push(cyl([sx * 0.08, yd, zc + sz * 0.1], [ex, yd + 0.02, ez], 0.02, 0.02, 'arm', 'drone', { n: 6 }));
    P.push(cyl([ex, yd + 0.02, ez], [ex, yd + 0.07, ez], 0.035, 0.03, 'dark', 'drone', { n: 8 }));
    P.push(tor([ex, yd + 0.07, ez], 0.16, 0.012, 'y', 'arm', 'drone', { noSil: false }));
    P.push(slab('y', yd + 0.08, blade(ez, -ex, 0.3, -0.15, 0.15, 0.04, 0.04), 0.012, 'prop', 'drone', { noSil: true }));
    P.push(cyl([sx * 0.1, yd - 0.05, zc + sz * 0.12], [sx * 0.14, y0 + 0.05, zc + sz * 0.16], 0.01, 0.01, 'dark', 'drone', { n: 5, noSil: true }));
  }
  P.push(sph([0, yd + 0.07, zc - 0.16], 0.022, 'light', 'drone', { noSil: true }));
  const pal = { pad: [0.22, 0.23, 0.26], mark: WHITE, body: hc || [0.92, 0.92, 0.9], dark: DARK, arm: [0.2, 0.2, 0.22], prop: [0.35, 0.36, 0.4], light: GREEN };
  return sheet('drone', lines, ctx, o, {
    ax: 'y',
    c: yd + 0.1,
    prims: P,
    pivot: [0, yd, zc],
    pal,
    mats: { light: 'glow' },
    groups: { drone: { at: [0, yd, zc], ax: 'y', kind: 'show' } },
    box: [zc - 0.46, zc + 0.46, -0.46, 0.46],
    focus: { at: [0, yd, zc], k: 0.4 },
    n: { lv, drones: lv >= 3 ? 2 : 1 },
    traits: {},
  });
}

// ------------------------------------------------------------------ armour plate
// (steel plates bolted on the doors and the wings, their rivets; level 2 grilles over the windows too;
// level 3 heavier - the sills and the bumpers plated, a plate over the windscreen with a slit)
function armorDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const x = D.hw + 0.03;
  const yl = C.clear + 0.08;
  const yh = clamp(C.mid + 0.18, yl + 0.3, C.roof - 0.25);
  const panels = [[-D.hl * 0.78, -D.hl * 0.12], [-D.hl * 0.1, D.hl * 0.42], [D.hl * 0.44, D.hl * 0.86]];
  for (const [z0, z1] of panels) {
    P.push(slab('x', x, [[z0, yl], [z1, yl], [z1, yh], [z0, yh]], 0.035, 'plate', 'gun', { edge: 4.5 }));
    for (const z of [z0 + 0.06, z1 - 0.06]) for (const y of [yl + 0.06, yh - 0.06, (yl + yh) / 2]) P.push(sph([x + 0.022, y, z], 0.022, 'rivet', 'gun', { noSil: true }));
  }
  if (lv >= 2) {
    // (grilles over the side windows: bars up and across)
    const yw0 = yh + 0.06;
    const yw1 = C.roof - 0.08;
    const xw = x - 0.08;
    for (let k = 0; k <= 7; k++) {
      const z = lerp(-D.hl * 0.42, D.hl * 0.18, k / 7);
      P.push(box([xw - 0.015, yw0, z - 0.015], [xw + 0.015, yw1, z + 0.015], 'bar', 'gun', { noSil: true }));
    }
    P.push(box([xw - 0.015, (yw0 + yw1) / 2 - 0.015, -D.hl * 0.42], [xw + 0.015, (yw0 + yw1) / 2 + 0.015, D.hl * 0.18], 'bar', 'gun', { noSil: true }));
  }
  if (lv >= 3) {
    P.push(box([D.hw * 0.2, C.clear - 0.02, D.hl - 0.05], [D.hw + 0.02, C.clear + 0.3, D.hl + 0.08], 'plate'));
    P.push(box([D.hw * 0.2, C.clear - 0.02, -D.hl - 0.08], [D.hw + 0.02, C.clear + 0.3, -D.hl + 0.05], 'plate'));
    P.push(box([x - 0.02, C.clear - 0.06, -D.hl * 0.8], [x + 0.03, yl, D.hl * 0.8], 'plate', 'gun', { noSil: true }));
  }
  const pal = { plate: hc ? mix(hc, [0.45, 0.47, 0.5], 0.5) : [0.45, 0.47, 0.5], rivet: [0.3, 0.31, 0.33], bar: [0.18, 0.18, 0.2] };
  return sheet('armor', lines, ctx, o, {
    ax: 'x',
    c: x + 0.02,
    prims: P,
    pivot: [x, (yl + yh) / 2, 0],
    pal,
    mats: { plate: 'metal', bar: 'metal' },
    mirror: true,
    box: [panels[1][0], panels[1][1], yl, yh],
    focus: { at: [D.hw, C.mid, 0], k: 0.05 },
    n: { lv, cover: [0.45, 0.65, 0.85][lv - 1] },
    traits: { panels: 6 },
  });
}

// ------------------------------------------------------------------ the bull bar
// (level 1 a police push bar - two uprights and its rails before the grille; level 2 a plough blade, curved;
// level 3 a ramp wedge, from the bumper down almost to the road: a car that hits it goes up it and over)
function bullbarDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const z = D.hl + 0.12;
  const w = D.hw * 0.92;
  const yl = Math.max(0.16, C.clear - 0.06);
  const yh = C.noseY + 0.32;
  if (lv === 1) {
    for (const x of [-w * 0.45, w * 0.45]) P.push(box([x - 0.05, yl, z - 0.05], [x + 0.05, yh, z + 0.05], 'bar'));
    for (const y of [yl + 0.12, (yl + yh) / 2, yh - 0.05]) P.push(cyl([-w, y, z + 0.04], [w, y, z + 0.04], 0.035, 0.035, 'bar', 'gun', { n: 10 }));
    P.push(box([-w * 0.5, yh - 0.1, z + 0.05], [w * 0.5, yh - 0.02, z + 0.1], 'light', 'gun', { noSil: true }));
  } else if (lv === 2) {
    // the blade: a curve across, in strips; its arms back to the car
    const N = 6;
    for (let k = 0; k < N; k++) {
      const t0 = k / N;
      const t1 = (k + 1) / N;
      const y0 = lerp(yl - 0.06, yh + 0.12, t0);
      const y1 = lerp(yl - 0.06, yh + 0.12, t1);
      const z0 = z + 0.22 * Math.sin(t0 * Math.PI) * 0.6 + 0.1 * t0;
      const z1 = z + 0.22 * Math.sin(t1 * Math.PI) * 0.6 + 0.1 * t1;
      P.push(box([-w - 0.1, y0, Math.min(z0, z1)], [w + 0.1, y1, Math.max(z0, z1) + 0.05], 'blade', 'gun'));
    }
    for (const x of [-w * 0.5, w * 0.5]) P.push(box([x - 0.05, yl + 0.1, z - 0.3], [x + 0.05, yl + 0.2, z + 0.1], 'bar'));
    P.push(box([-w - 0.1, yl - 0.08, z + 0.04], [w + 0.1, yl - 0.03, z + 0.12], 'edge', 'gun', { noSil: true }));
  } else {
    // the wedge: a plate from over the bumper down and out to just over the road
    const zt = z + 0.9;
    P.push(slab('x', 0, [[z - 0.05, yh], [zt, 0.08], [zt, 0.04], [z - 0.05, yl]], w * 2 + 0.2, 'blade', 'gun', { edge: 4 }));
    P.push(box([-w - 0.1, 0.02, zt - 0.04], [w + 0.1, 0.09, zt + 0.02], 'edge'));
    for (const x of [-w * 0.6, w * 0.6]) P.push(box([x - 0.04, yl, z - 0.25], [x + 0.04, yh - 0.1, z], 'bar'));
  }
  const pal = { bar: hc || [0.12, 0.12, 0.14], blade: hc ? mix(hc, HAZARD, 0.5) : HAZARD, edge: [0.2, 0.2, 0.22], light: [1, 0.95, 0.8] };
  return sheet('bullbar', lines, ctx, o, {
    ax: 'x',
    c: lv === 3 ? w + 0.12 : w,
    prims: P,
    pivot: [0, (yl + yh) / 2, z],
    pal,
    mats: { bar: 'metal', edge: 'metal', light: 'glow' },
    focus: { at: [0, (yl + yh) / 2, z + 0.4], k: 0.2 },
    n: { lv, len: [0.6, 0.9, 1.2][lv - 1] },
    traits: { style: ['bar', 'plough', 'wedge'][lv - 1] },
  });
}

// ------------------------------------------------------------------ the oil slick
// (an oil drum strapped upright on the boot, its pipe down to a spray bar under the back bumper)
function oilDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const K = ctx.K;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const yb = (K ? beltY(K, 0.06) : C.tailY + 0.3) + 0.02;
  const zb = -D.hl + 0.42;
  const R = 0.22 + 0.02 * (lv - 1);
  const xs = lv >= 3 ? [0.32] : [0];
  for (const x of xs) {
    P.push(cyl([x, yb, zb], [x, yb + 0.62, zb], R, R, 'drum', 'gun', { n: 20 }));
    for (const y of [yb + 0.2, yb + 0.42]) P.push(tor([x, y, zb], R + 0.004, 0.018, 'y', 'rim', 'gun', { noSil: true }));
    P.push(cyl([x + R * 0.5, yb + 0.62, zb], [x + R * 0.5, yb + 0.66, zb], 0.04, 0.04, 'rim', 'gun', { n: 8 }));
    P.push(box([x - R - 0.02, yb + 0.29, zb - 0.02], [x + R + 0.02, yb + 0.33, zb + 0.02], 'strap', 'gun', { noSil: true }));
    P.push(cyl([x, yb + 0.05, zb - R], [x * 0.5, Math.max(0.3, C.clear + 0.05), -D.hl - 0.02], 0.025, 0.025, 'pipe', 'gun', { n: 6, noSil: true }));
  }
  const yn = Math.max(0.26, C.clear + 0.02);
  P.push(cyl([-D.hw * 0.7, yn, -D.hl - 0.05], [D.hw * 0.7, yn, -D.hl - 0.05], 0.035, 0.035, 'pipe', 'gun', { n: 8 }));
  for (let k = 0; k < 5; k++) P.push(cyl([lerp(-D.hw * 0.6, D.hw * 0.6, k / 4), yn, -D.hl - 0.05], [lerp(-D.hw * 0.6, D.hw * 0.6, k / 4), yn - 0.04, -D.hl - 0.1], 0.015, 0.02, 'dark', 'gun', { n: 6, noSil: true }));
  const pal = { drum: hc || [0.1, 0.1, 0.12], rim: [0.6, 0.62, 0.66], strap: HAZARD, pipe: GUNMETAL, dark: DARK };
  return sheet('oil', lines, ctx, o, {
    ax: 'z',
    c: zb - R - 0.05,
    prims: P,
    pivot: [0, yb + 0.3, zb],
    pal,
    mats: { drum: 'paint', rim: 'metal' },
    mirror: lv >= 3,
    focus: { at: [0, yb + 0.3, zb - 0.5], k: 0.3 },
    n: { lv },
    traits: {},
  });
}

// ------------------------------------------------------------------ the rear shield
// (a steel plate folded flat on the boot lid, hinged at the back window; B and it swings up behind the car)
function rearshieldDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const K = ctx.K;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const yh = (K ? beltY(K, 0.08) : C.tailY + 0.3) + 0.04;
  const zh = -D.hl + 0.62;
  const w = D.hw * 0.95;
  const H = 0.95 + 0.15 * (lv - 1);
  // (raised: upright at the hinge, its face back - the group turns it flat, game/gearguard2.js)
  P.push(box([-w, yh, zh - 0.06], [w, yh + H, zh - 0.01], 'plate', 'shield'));
  for (const x of [-w * 0.6, 0, w * 0.6]) P.push(box([x - 0.03, yh + 0.08, zh - 0.08], [x + 0.03, yh + H - 0.08, zh - 0.05], 'rib', 'shield', { noSil: true }));
  P.push(box([-w * 0.4, yh + H - 0.24, zh - 0.07], [w * 0.4, yh + H - 0.2, zh - 0.06], 'slit', 'shield', { noSil: true }));
  P.push(cyl([-w, yh, zh], [w, yh, zh], 0.04, 0.04, 'hinge', 'gun', { n: 10 }));
  for (const x of [-w * 0.7, w * 0.7]) P.push(box([x - 0.05, yh - 0.04, zh - 0.05], [x + 0.05, yh + 0.02, zh + 0.05], 'hinge'));
  const pal = { plate: hc ? mix(hc, [0.4, 0.42, 0.45], 0.5) : [0.4, 0.42, 0.45], rib: [0.3, 0.31, 0.34], slit: DARK, hinge: GUNMETAL };
  return sheet('rearshield', lines, ctx, o, {
    ax: 'z',
    c: zh - 0.1,
    prims: P,
    pivot: [0, yh, zh],
    pal,
    mats: { plate: 'metal', rib: 'metal' },
    groups: { shield: { at: [0, yh, zh], ax: 'x', kind: 'raise' } },
    focus: { at: [0, yh + 0.4, zh - 0.4], k: 0.2 },
    n: { lv },
    traits: {},
  });
}

// ------------------------------------------------------------------ spikes
// (steel spikes along both sills and round each wheel's rim; level 3 longer)
function spikesDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const L = [0.22, 0.26, 0.38][lv - 1];
  const x = D.hw + 0.02;
  const y = C.sill;
  P.push(box([x - 0.04, y - 0.05, -D.hl * 0.9], [x + 0.02, y + 0.05, D.hl * 0.9], 'rail'));
  const n = 9;
  for (let k = 0; k < n; k++) {
    const z = lerp(-D.hl * 0.82, D.hl * 0.82, k / (n - 1));
    P.push(cyl([x, y, z], [x + L, y, z], 0.045, 0.004, 'spike', 'gun', { n: 8 }));
  }
  // (round the wheels' rims: short spikes out of the hub)
  for (const s of (ctx.spots || []).filter((q) => q.x > 0)) {
    const r0 = ctx.r0 || 0.34;
    P.push(cyl([s.x + 0.12, r0, s.z], [s.x + 0.12 + L * 0.8, r0, s.z], 0.05, 0.004, 'spike', 'gun', { n: 8, noSil: true }));
  }
  // (and over the bumpers' corners)
  for (const z of [D.hl + 0.02, -D.hl - 0.02]) P.push(cyl([D.hw * 0.7, C.clear + 0.12, z], [D.hw * 0.7, C.clear + 0.12, z + Math.sign(z) * L], 0.045, 0.004, 'spike', 'gun', { n: 8, noSil: true }));
  const pal = { rail: DARK, spike: hc ? mix(hc, CHROME, 0.5) : CHROME };
  return sheet('spikes', lines, ctx, o, {
    ax: 'y',
    c: y,
    prims: P,
    pivot: [x, y, 0],
    pal,
    mats: { spike: 'metal' },
    mirror: true,
    box: [-D.hl * 0.9, D.hl * 0.9, -(x + L), -x],
    focus: { at: [D.hw, y, 0], k: 0.05 },
    n: { lv, len: L * 4 },
    traits: { spikes: n * 2 },
  });
}

// ------------------------------------------------------------------ the repair kit
// (on a roof rack: a red toolbox, a wrench and a jack strapped by it; level 3 a little robot arm folded on
// top that reaches down as it mends)
function repairDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof + 0.02;
  const zc = -0.35;
  for (const x of [-0.42, 0.42]) P.push(box([x - 0.025, C.roof - 0.02, zc - 0.5], [x + 0.025, y0 + 0.04, zc + 0.5], 'rack'));
  for (const z of [zc - 0.4, zc + 0.4]) P.push(box([-0.45, y0 + 0.04, z - 0.025], [0.45, y0 + 0.08, z + 0.025], 'rack'));
  P.push(box([-0.3, y0 + 0.08, zc - 0.2], [0.24, y0 + 0.36, zc + 0.12], 'box'));
  P.push(box([-0.3, y0 + 0.36, zc - 0.2], [0.24, y0 + 0.4, zc + 0.12], 'lid'));
  P.push(box([-0.08, y0 + 0.4, zc - 0.06], [0.02, y0 + 0.46, zc - 0.02], 'dark'));
  // the wrench lying by it
  P.push(box([0.27, y0 + 0.08, zc - 0.3], [0.31, y0 + 0.11, zc + 0.15], 'steel'));
  P.push(tor([0.29, y0 + 0.1, zc + 0.2], 0.05, 0.018, 'y', 'steel'));
  P.push(tor([0.29, y0 + 0.1, zc - 0.35], 0.045, 0.018, 'y', 'steel', 'gun', { noSil: true }));
  if (lv >= 3) {
    P.push(cyl([-0.1, y0 + 0.4, zc + 0.05], [-0.1, y0 + 0.62, zc + 0.05], 0.035, 0.035, 'arm', 'arm', { n: 8 }));
    P.push(cyl([-0.1, y0 + 0.62, zc + 0.05], [0.25, y0 + 0.66, zc + 0.3], 0.03, 0.03, 'arm', 'arm', { n: 8 }));
    P.push(sph([0.25, y0 + 0.66, zc + 0.3], 0.04, 'dark', 'arm'));
  }
  const pal = { rack: DARK, box: hc || RED, lid: hc ? mix(hc, [0, 0, 0], 0.2) : [0.7, 0.1, 0.1], dark: DARK, steel: CHROME, arm: HAZARD };
  return sheet('repair', lines, ctx, o, {
    ax: 'x',
    c: 0.3,
    prims: P,
    pivot: [0, y0 + 0.2, zc],
    pal,
    mats: { steel: 'metal' },
    groups: lv >= 3 ? { arm: { at: [-0.1, y0 + 0.4, zc + 0.05], ax: 'x', kind: 'arm' } } : {},
    focus: { at: [0, y0 + 0.2, zc], k: 0.35 },
    n: { lv },
    traits: {},
  });
}

// ------------------------------------------------------------------ the paint sprayers
// (on the roof a rail across with two spray guns on it, and a rack of three paint cans in different colours)
function repaintDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof - 0.02;
  const zc = -0.25;
  P.push(box([-0.55, y0, zc - 0.05], [0.55, y0 + 0.08, zc + 0.05], 'rail'));
  for (const x of [-0.45, 0.45]) {
    P.push(cyl([x, y0 + 0.08, zc], [x, y0 + 0.28, zc], 0.025, 0.025, 'rail', 'gun', { n: 8 }));
    P.push(box([x - 0.05, y0 + 0.22, zc - 0.08], [x + 0.05, y0 + 0.32, zc + 0.12], 'gun'));
    P.push(cyl([x, y0 + 0.28, zc + 0.12], [x * 1.25, y0 + 0.24, zc + 0.24], 0.02, 0.03, 'chrome', 'gun', { n: 8 }));
  }
  const cols = [hc || [0.9, 0.2, 0.25], [0.2, 0.5, 0.95], [0.25, 0.8, 0.35]];
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * 0.2;
    P.push(cyl([x, y0 + 0.08, zc - 0.32], [x, y0 + 0.36, zc - 0.32], 0.075, 0.075, `can${k}`, 'gun', { n: 14 }));
    P.push(cyl([x, y0 + 0.36, zc - 0.32], [x, y0 + 0.4, zc - 0.32], 0.05, 0.03, 'chrome', 'gun', { n: 10 }));
  }
  const pal = { rail: DARK, gun: [0.3, 0.32, 0.36], chrome: CHROME, can0: cols[0], can1: cols[1], can2: cols[2] };
  return sheet('repaint', lines, ctx, o, {
    ax: 'z',
    c: zc + 0.3,
    prims: P,
    pivot: [0, y0 + 0.2, zc],
    pal,
    mats: { chrome: 'metal' },
    focus: { at: [0, y0 + 0.2, zc], k: 0.35 },
    n: { lv },
    traits: {},
  });
}

// ------------------------------------------------------------------ the jammer
// (on the roof: its box - its little lights - three whip aerials and a small dish)
function jammerDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof - 0.02;
  const zc = -0.3;
  P.push(box([-0.22, y0, zc - 0.16], [0.22, y0 + 0.14, zc + 0.16], 'box'));
  for (let k = 0; k < 5; k++) P.push(sph([-0.14 + k * 0.07, y0 + 0.1, zc + 0.165], 0.012, 'led', 'leds', { noSil: true }));
  for (const [x, h] of [[-0.16, 0.9], [0, 1.15], [0.16, 0.8]]) {
    P.push(cyl([x, y0 + 0.14, zc], [x, y0 + 0.14 + h * (0.85 + 0.1 * lv), zc], 0.012, 0.006, 'aerial', 'gun', { n: 6 }));
    P.push(sph([x, y0 + 0.14 + h * (0.85 + 0.1 * lv), zc], 0.018, 'tip', 'gun'));
  }
  // the dish, on its stalk, facing up and back
  P.push(cyl([0.1, y0 + 0.14, zc - 0.1], [0.1, y0 + 0.28, zc - 0.12], 0.02, 0.02, 'aerial', 'gun', { n: 6 }));
  P.push(cyl([0.1, y0 + 0.3, zc - 0.14], [0.1, y0 + 0.35, zc - 0.2], 0.14, 0.02, 'dish', 'gun', { n: 18 }));
  const pal = { box: hc || [0.2, 0.22, 0.26], led: RED, aerial: DARK, tip: [0.86, 0.14, 0.14], dish: WHITE };
  return sheet('jammer', lines, ctx, o, {
    ax: 'z',
    c: zc + 0.25,
    prims: P,
    pivot: [0, y0 + 0.1, zc],
    pal,
    mats: { led: 'glow' },
    groups: { leds: { at: [0, y0 + 0.1, zc + 0.165], ax: 'y', kind: 'blink' } },
    focus: { at: [0, y0 + 0.5, zc], k: 0.25 },
    n: { lv },
    traits: {},
  });
}

// ------------------------------------------------------------------ the ejector seat
// (its hatch cut into the roof over the driver: its frame in hazard stripes, its release handle - held B and
// it blows, game/gearguard2.js)
function ejectDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const P = [];
  const y0 = C.roof + 0.005;
  const zc = clamp(D.hl * 0.12, 0, 0.35);
  const w = 0.42;
  const l = 0.55;
  P.push(box([-w, y0, zc - l], [w, y0 + 0.035, zc + l], 'hatch', 'hatch'));
  const st = 8;
  for (let k = 0; k < st; k++) {
    const t0 = k / st;
    const t1 = (k + 0.5) / st;
    P.push(box([-w - 0.03, y0 + 0.035, lerp(zc - l, zc + l, t0)], [-w + 0.03, y0 + 0.045, lerp(zc - l, zc + l, t1)], 'stripe', 'hatch', { noSil: true }));
    P.push(box([w - 0.03, y0 + 0.035, lerp(zc - l, zc + l, t0)], [w + 0.03, y0 + 0.045, lerp(zc - l, zc + l, t1)], 'stripe', 'hatch', { noSil: true }));
  }
  P.push(box([-0.12, y0 + 0.035, zc + l - 0.12], [0.12, y0 + 0.07, zc + l - 0.06], 'handle', 'hatch'));
  P.push(box([-w, y0 + 0.035, zc - 0.01], [w, y0 + 0.042, zc + 0.01], 'dark', 'hatch', { noSil: true }));
  const pal = { hatch: [0.24, 0.25, 0.28], stripe: HAZARD, handle: RED, dark: DARK };
  return sheet('eject', lines, ctx, o, {
    ax: 'y',
    c: y0 + 0.05,
    prims: P,
    pivot: [0, y0, zc],
    pal,
    groups: { hatch: { at: [0, y0, zc], ax: 'y', kind: 'show' } },
    focus: { at: [0, y0, zc], k: 0.3 },
    n: { lv },
    traits: {},
  });
}

// ------------------------------------------------------------------ the decoy's pencil
// (a giant pencil clipped along the roof rack - sharpened, its rubber end, its ferrule: it draws the car's
// copy, game/gearguard2.js)
function decoyDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof + 0.1;
  const x = 0.3;
  const L = clamp(D.hl * 1.4, 2.2, 3.4);
  const z0 = -L / 2;
  const z1 = L / 2;
  const R = 0.07;
  P.push(box([x - 0.03, C.roof - 0.02, -0.5], [x + 0.03, y0 - R, -0.42], 'clip'));
  P.push(box([x - 0.03, C.roof - 0.02, 0.42], [x + 0.03, y0 - R, 0.5], 'clip'));
  P.push(cyl([x, y0, z0 + 0.18], [x, y0, z1 - 0.32], R, R, 'wood', 'gun', { n: 6 }));
  P.push(cyl([x, y0, z1 - 0.32], [x, y0, z1 - 0.06], R, 0.022, 'shaving', 'gun', { n: 6 }));
  P.push(cyl([x, y0, z1 - 0.06], [x, y0, z1], 0.022, 0.002, 'lead', 'gun', { n: 6 }));
  P.push(cyl([x, y0, z0 + 0.06], [x, y0, z0 + 0.18], R + 0.004, R + 0.004, 'ferrule', 'gun', { n: 10 }));
  P.push(cyl([x, y0, z0], [x, y0, z0 + 0.06], R, R, 'rubber', 'gun', { n: 10 }));
  const pal = { clip: DARK, wood: hc || [0.98, 0.78, 0.18], shaving: [0.86, 0.68, 0.46], lead: [0.15, 0.15, 0.18], ferrule: [0.8, 0.8, 0.84], rubber: [0.96, 0.52, 0.6] };
  return sheet('decoy', lines, ctx, o, {
    ax: 'x',
    c: x,
    prims: P,
    pivot: [x, y0, 0],
    pal,
    mats: { ferrule: 'metal' },
    focus: { at: [0, y0, 0], k: 0.3 },
    n: { lv, copies: lv >= 3 ? 2 : 1 },
    traits: {},
  });
}

export const DESIGNS3 = {
  missiles: missilesDesign,
  flamer: flamerDesign,
  mines: minesDesign,
  harpoon: harpoonDesign,
  net: netDesign,
  wreck: wreckDesign,
  drone: droneDesign,
  armor: armorDesign,
  bullbar: bullbarDesign,
  oil: oilDesign,
  rearshield: rearshieldDesign,
  spikes: spikesDesign,
  repair: repairDesign,
  repaint: repaintDesign,
  jammer: jammerDesign,
  eject: ejectDesign,
  decoy: decoyDesign,
};
