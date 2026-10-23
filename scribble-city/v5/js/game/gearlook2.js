import { sheet, slab, cyl, box, sph, tor, blade, beltY, hueOf, mix, lerp, r3, rect, carNums, clamp, STEEL, CHROME, RUBBER, WHITE, HAZARD, RED, BLADE } from './gearlook.js';

// (ROADMAP 11.28) More of the pen's things designed (game/gearlook.js has how): what moves - the grappling
// hook, monster wheels, tank tracks, the water kit (boat, hovercraft, submarine by its level), the
// parachute, the folding bridge.

// ------------------------------------------------------------------ the grappling hook
// (on the front bumper: a winch - its drum wound with steel cable, its frame - and the hook, three prongs,
// in its cradle over it; fired, the hook flies to a roof's edge on its cable, game/gearmove.js)
function grappleDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const hc = hueOf(o.ink);
  const P = [];
  const z = D.hl + 0.06;
  const y = Math.max(0.42, C.clear + 0.26);
  const w = clamp(D.hw * 0.62, 0.42, 0.62);
  // the winch: its frame, its drum, the cable on it
  P.push(box([-w, y - 0.14, z - 0.12], [w, y - 0.1, z + 0.1], 'frame'));
  for (const s of [1, -1]) P.push(box([s * w - 0.04, y - 0.14, z - 0.1], [s * w + 0.04, y + 0.14, z + 0.1], 'frame'));
  P.push(cyl([-w + 0.05, y, z], [w - 0.05, y, z], 0.1, 0.1, 'drum', 'gun', { n: 16 }));
  for (let i = 0; i < 9; i++) P.push(tor([lerp(-w + 0.1, w - 0.1, i / 8), y, z], 0.1, 0.018, 'x', 'cable', 'gun', { noSil: true }));
  P.push(cyl([w + 0.04, y, z], [w + 0.18, y, z], 0.07, 0.07, 'motor', 'gun', { n: 12 }));
  // the hook: its shank up out of the cradle, its three prongs - it flies, game/gearmove.js
  const hy = y + 0.2;
  const hz = z + 0.05;
  P.push(box([-0.09, y + 0.1, hz - 0.08], [0.09, y + 0.16, hz + 0.08], 'frame'));
  P.push(cyl([0, y + 0.14, hz], [0, hy + 0.32, hz], 0.03, 0.03, 'hook', 'hook', { n: 8 }));
  P.push(tor([0, hy + 0.36, hz], 0.045, 0.014, 'z', 'hook', 'hook'));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const dx = Math.cos(a) * 0.17;
    const dz = Math.sin(a) * 0.17;
    P.push(cyl([0, y + 0.18, hz], [dx, y + 0.24, hz + dz], 0.022, 0.022, 'hook', 'hook', { n: 6 }));
    P.push(cyl([dx, y + 0.24, hz + dz], [dx * 1.05, y + 0.38, hz + dz * 1.05], 0.02, 0.01, 'hook', 'hook', { n: 6 }));
  }
  const pal = { frame: [0.16, 0.16, 0.18], drum: hc || HAZARD, cable: [0.55, 0.56, 0.58], motor: [0.1, 0.1, 0.12], hook: CHROME };
  return sheet('grapple', lines, ctx, o, {
    ax: 'z',
    c: z + 0.25,
    prims: P,
    pivot: [0, hy, hz],
    pal,
    mats: { hook: 'metal', cable: 'metal' },
    groups: { hook: { at: [0, hy, hz], ax: 'y', kind: 'show' } },
    focus: { at: [0, y + 0.1, z], k: 0.35 },
    n: { lv: o.lv || 1, hook: r3([0, hy + 0.2, hz]) },
    traits: {},
  });
}

// ------------------------------------------------------------------ monster wheels
// (four huge treaded tyres on chrome rims, the car up on them - each turns as it rolls, the front ones
// steer: game/gearmove.js)
function monsterDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const r0 = ctx.r0 || 0.34;
  const Rw = clamp(r0 * [1.7, 2.1, 2.35][lv - 1], 0.6, 0.95);
  const lift = Rw - r0;
  const spots = (ctx.spots || []).filter((q) => q.x > 0);
  const wz = spots.length ? spots.map((q) => q.z) : [-D.hl * 0.62, D.hl * 0.62];
  const xw = (spots.length ? spots[0].x : D.hw - 0.2) + Rw * 0.28;
  const tw = Rw * 0.62;
  const P = [];
  const groups = {};
  for (let i = 0; i < wz.length; i++) {
    const z = wz[i];
    const g = `wheel${i}`;
    const yc = Rw - lift;
    groups[g] = { at: [xw, yc, z], ax: 'x', kind: wz[i] > 0 ? 'steer' : 'roll' };
    // the tyre: its body, its tread blocks all round, its rim, its hub and bolts
    P.push(cyl([xw - tw / 2, yc, z], [xw + tw / 2, yc, z], Rw * 0.92, Rw * 0.92, 'tyre', g, { n: 24 }));
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const cu = Math.cos(a);
      const sw = Math.sin(a);
      const R1 = Rw * 0.9;
      P.push(box([xw - tw / 2 - 0.01, yc + sw * R1 - 0.06, z + cu * R1 - 0.06], [xw + tw / 2 + 0.01, yc + sw * (Rw + 0.01) + 0.06, z + cu * (Rw + 0.01) + 0.06], 'tread', g, { noSil: true }));
    }
    P.push(cyl([xw + tw / 2 - 0.02, yc, z], [xw + tw / 2 + 0.03, yc, z], Rw * 0.55, Rw * 0.55, 'rim', g, { n: 20 }));
    P.push(cyl([xw + tw / 2 + 0.02, yc, z], [xw + tw / 2 + 0.09, yc, z], Rw * 0.2, Rw * 0.16, 'hub', g, { n: 12 }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      P.push(sph([xw + tw / 2 + 0.04, yc + Math.sin(a) * Rw * 0.36, z + Math.cos(a) * Rw * 0.36], 0.03, 'hub', g, { noSil: true }));
    }
    // (its strut up to the body)
    P.push(cyl([xw - tw / 2 - 0.02, yc, z], [D.hw - 0.25, C.clear + 0.1, z], 0.06, 0.05, 'strut', 'gun', { n: 10, noSil: true }));
  }
  const pal = { tyre: RUBBER, tread: [0.16, 0.16, 0.17], rim: hc || CHROME, hub: RED, strut: [0.86, 0.68, 0.1] };
  return sheet('monster', lines, ctx, o, {
    ax: 'x',
    c: xw + tw / 2,
    prims: P,
    pivot: [xw, Rw - lift, 0],
    pal,
    mats: { rim: 'metal', tyre: 'matte', tread: 'matte' },
    groups,
    mirror: true,
    box: [wz[0] - Rw, wz[0] + Rw, -lift, Rw * 2 - lift],
    focus: { at: [D.hw, Rw * 0.5, 0], k: 0.05 },
    n: { lv, r: Math.round(Rw * 100) / 100 },
    traits: { R: Math.round(Rw * 100) / 100 },
  });
}

// ------------------------------------------------------------------ tank tracks
// (each side a track: its band round a drive sprocket at the back, an idler at the front, road wheels
// between - the car's own wheels gone under them)
function tracksDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const r0 = ctx.r0 || 0.34;
  const spots = (ctx.spots || []).filter((q) => q.x > 0);
  const wz = spots.length ? spots.map((q) => q.z).sort((a, b) => a - b) : [-D.hl * 0.62, D.hl * 0.62];
  const x = (spots.length ? spots[0].x : D.hw - 0.2) + 0.1;
  const tw = 0.42;
  const zb = wz[0] - r0 * 1.25;
  const zf = wz[wz.length - 1] + r0 * 1.3;
  const Rr = r0 * 0.62;
  const hb = r0 * 1.02;
  const P = [];
  const groups = {};
  // the band: its outline round the wheels (a stadium a little higher at the front), flat across
  const band = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI;
    band.push([zf + Math.cos(a) * hb * 0.9 - hb * 0.9, hb + Math.sin(a) * hb + 0.06 * (1 + Math.sin(a))]);
  }
  for (let i = 0; i <= N; i++) {
    const a = Math.PI / 2 + (i / N) * Math.PI;
    band.push([zb + Math.cos(a) * hb * 0.92 + hb * 0.92, hb + Math.sin(a) * hb]);
  }
  P.push(slab('x', x + tw / 2, band, 0.05, 'band', 'gun', { edge: 2 }));
  P.push(slab('x', x - tw / 2, band, 0.05, 'band', 'gun', { edge: 2, noSil: true }));
  // the tread across the top and the bottom runs
  for (let k = 0; k <= 12; k++) {
    const z = lerp(zb + hb * 0.6, zf - hb * 0.6, k / 12);
    P.push(box([x - tw / 2, 0.0, z - 0.035], [x + tw / 2, 0.06, z + 0.035], 'tread', 'gun', { noSil: true }));
    P.push(box([x - tw / 2, hb * 2 - 0.05, z - 0.035], [x + tw / 2, hb * 2 + 0.01, z + 0.035], 'tread', 'gun', { noSil: true }));
  }
  // the wheels inside it: the sprocket at the back, the idler at the front, road wheels between
  const nr = 4;
  const wheels = [[zb + hb * 0.92, hb, hb * 0.78, 'sprocket'], [zf - hb * 0.9, hb + 0.06, hb * 0.72, 'idler']];
  for (let k = 0; k < nr; k++) wheels.push([lerp(zb + hb * 1.9, zf - hb * 1.9, k / (nr - 1)), Rr + 0.03, Rr, 'road']);
  wheels.forEach(([z, y, R, kind], i) => {
    const g = `w${i}`;
    groups[g] = { at: [x, y, z], ax: 'x', kind: 'roll' };
    P.push(cyl([x - tw / 2 + 0.05, y, z], [x + tw / 2 - 0.05, y, z], R, R, kind === 'sprocket' ? 'sprocket' : 'wheel', g, { n: kind === 'sprocket' ? 10 : 18, noSil: true }));
    P.push(cyl([x + tw / 2 - 0.05, y, z], [x + tw / 2 + 0.01, y, z], R * 0.45, R * 0.45, 'hub', g, { n: 10, noSil: true }));
  });
  // (its guard over the top)
  P.push(box([x - tw / 2 - 0.02, hb * 2 + 0.02, zb + 0.2], [x + tw / 2 + 0.02, hb * 2 + 0.07, zf - 0.1], 'guard', 'gun', { noSil: true }));
  const pal = { band: [0.2, 0.2, 0.22], tread: [0.3, 0.3, 0.32], wheel: [0.25, 0.27, 0.24], sprocket: [0.18, 0.18, 0.2], hub: CHROME, guard: hc || [0.33, 0.37, 0.26] };
  return sheet('tracks', lines, ctx, o, {
    ax: 'x',
    c: x + tw / 2,
    prims: P,
    pivot: [x, hb, 0],
    pal,
    mats: { band: 'matte', tread: 'metal', hub: 'metal' },
    groups,
    mirror: true,
    focus: { at: [D.hw, hb, 0], k: 0.05 },
    n: { lv },
    traits: { roadWheels: nr },
  });
}

// ------------------------------------------------------------------ the water kit
// (level 1: pontoons along both sides, an outboard motor on the back. Level 2: a hovercraft - a rubber
// skirt all round, a big ducted fan behind with its rudders. Level 3: a submarine - its ballast tanks,
// a periscope up out of the roof, a screw behind, the windows sealed)
function waterDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const K = ctx.K;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const groups = {};
  const zt = -D.hl;
  let mirror = true;
  let ax = 'x';
  let c = D.hw + 0.2;
  let box0 = null;
  let pivot;
  if (lv === 1) {
    // pontoons: long, round, pointed at the front
    const xp = D.hw + 0.16;
    const yp = Math.max(0.28, C.clear + 0.04);
    const L = clamp(D.hl * 2 * 0.92, 2.4, 6);
    const rp = 0.24;
    P.push(cyl([xp, yp, -L / 2], [xp, yp, L / 2 - 0.5], rp, rp, 'float', 'gun', { n: 16 }));
    P.push(cyl([xp, yp, L / 2 - 0.5], [xp, yp + 0.06, L / 2], rp, 0.05, 'float', 'gun', { n: 16 }));
    P.push(sph([xp, yp, -L / 2], rp * 0.98, 'float'));
    for (const z of [-L * 0.28, L * 0.18]) P.push(box([D.hw - 0.12, yp + 0.05, z - 0.05], [xp, yp + 0.12, z + 0.05], 'strut'));
    P.push(box([xp - 0.01, yp + rp * 0.7, -L / 2 + 0.2], [xp + 0.01, yp + rp, L / 2 - 0.3], 'stripe', 'gun', { noSil: true }));
    // the outboard motor (this side's half: its cowl on the middle line)
    const ym = C.tailY + 0.1;
    P.push(box([0, ym, zt - 0.36], [0.17, ym + 0.32, zt - 0.06], 'motor'));
    P.push(box([0, ym - 0.5, zt - 0.26], [0.05, ym, zt - 0.16], 'dark'));
    groups.prop = { at: [0.0, ym - 0.48, zt - 0.32], ax: 'z', kind: 'spin' };
    for (let k = 0; k < 3; k++) P.push(slab('z', zt - 0.32, blade(0, ym - 0.48, (k / 3) * Math.PI * 2, 0.02, 0.15, 0.06, 0.08), 0.02, 'prop', 'prop', { noSil: true }));
    box0 = [-L / 2, L / 2, yp - rp, yp + rp];
    c = xp;
    pivot = [xp, yp, 0];
  } else if (lv === 2) {
    // the skirt round the bottom, the fan behind in its duct, two rudders
    const ys = Math.max(0.18, C.clear - 0.04);
    const xs = D.hw + 0.12;
    const hl = D.hl + 0.1;
    P.push(cyl([xs, ys, -hl + 0.3], [xs, ys, hl - 0.3], 0.22, 0.22, 'skirt', 'gun', { n: 14 }));
    P.push(sph([xs, ys, hl - 0.3], 0.22, 'skirt'));
    P.push(sph([xs, ys, -hl + 0.3], 0.22, 'skirt'));
    P.push(cyl([0, ys, hl - 0.05], [xs - 0.2, ys, hl - 0.05], 0.22, 0.22, 'skirt', 'gun', { n: 14, noSil: true }));
    P.push(cyl([0, ys, -hl + 0.05], [xs - 0.2, ys, -hl + 0.05], 0.22, 0.22, 'skirt', 'gun', { n: 14, noSil: true }));
    const yf = (K ? K.roofY : D.h) + 0.15;
    const zf = zt + 0.3;
    const Rf = clamp(D.hw * 0.75, 0.6, 0.85);
    // (this side's half of the duct and its stand; the fan whole on the middle line, half each side)
    P.push(tor([0, yf, zf], Rf, 0.07, 'z', 'duct'));
    P.push(box([0.08, C.roof - 0.02, zf - 0.08], [0.16, yf - Rf + 0.04, zf + 0.08], 'duct'));
    groups.fan = { at: [0, yf, zf], ax: 'z', kind: 'spin' };
    P.push(cyl([0, yf, zf - 0.08], [0, yf, zf + 0.08], 0.12, 0.12, 'dark', 'fan', { n: 12 }));
    for (let k = 0; k < 3; k++) P.push(slab('z', zf, blade(0, yf, (k / 6) * Math.PI * 2, 0.1, Rf - 0.06, 0.16, 0.12), 0.03, 'prop', 'fan', { noSil: true }));
    P.push(slab('x', 0.28, [[zf - 0.15, yf - Rf * 0.8], [zf - 0.45, yf - Rf * 0.8], [zf - 0.45, yf + Rf * 0.8], [zf - 0.15, yf + Rf * 0.8]], 0.03, 'duct', 'gun', { noSil: true }));
    ax = 'z';
    c = zf - 0.1;
    box0 = [-Rf, Rf, yf - Rf, yf + Rf];
    mirror = true;
    pivot = [0, yf, zf];
  } else {
    // the submarine's: ballast tanks along both sides, the periscope, the screw, a dive plane
    const xt = D.hw + 0.1;
    const yt = Math.max(0.35, C.clear + 0.12);
    const L = clamp(D.hl * 2 * 0.8, 2.2, 5);
    P.push(cyl([xt, yt, -L / 2], [xt, yt, L / 2], 0.2, 0.2, 'hull', 'gun', { n: 16 }));
    P.push(sph([xt, yt, L / 2], 0.2, 'hull'));
    P.push(sph([xt, yt, -L / 2], 0.2, 'hull'));
    for (let k = 0; k < 4; k++) P.push(tor([xt, yt, lerp(-L / 2 + 0.3, L / 2 - 0.3, k / 3)], 0.205, 0.02, 'z', 'band', 'gun', { noSil: true }));
    P.push(slab('y', yt, [[0.25, -(xt + 0.15)], [-0.2, -(xt + 0.45)], [-0.35, -(xt + 0.45)], [-0.1, -(xt + 0.15)]], 0.04, 'hull', 'gun', { noSil: true }));
    // (on the middle line: the periscope, the screw)
    const yr = K ? K.roofY : D.h;
    P.push(cyl([0.12, yr - 0.02, -0.4], [0.12, yr + 0.85, -0.4], 0.045, 0.045, 'peri', 'gun', { n: 10 }));
    P.push(box([0.07, yr + 0.8, -0.42], [0.17, yr + 0.92, -0.18], 'peri'));
    P.push(box([0.08, yr + 0.83, -0.18], [0.16, yr + 0.89, -0.16], 'glass', 'gun', { noSil: true }));
    groups.prop = { at: [0, C.tailY, zt - 0.2], ax: 'z', kind: 'spin' };
    P.push(cyl([0, C.tailY, zt + 0.05], [0, C.tailY, zt - 0.2], 0.06, 0.05, 'dark', 'gun', { n: 10 }));
    for (let k = 0; k < 2; k++) P.push(slab('z', zt - 0.2, blade(0, C.tailY, (k / 4) * Math.PI * 2 + 0.4, 0.04, 0.3, 0.12, 0.16), 0.03, 'prop', 'prop', { noSil: true }));
    box0 = [-L / 2, L / 2, yt - 0.3, yt + 0.3];
    c = xt + 0.2;
    pivot = [xt, yt, 0];
  }
  const pal = { float: hc || [1, 0.52, 0.12], stripe: WHITE, strut: [0.2, 0.2, 0.22], motor: [0.12, 0.13, 0.16], dark: [0.1, 0.1, 0.12], prop: CHROME, skirt: [0.12, 0.12, 0.13], duct: hc || [0.86, 0.86, 0.88], hull: hc || [0.95, 0.78, 0.08], band: [0.2, 0.2, 0.22], peri: [0.3, 0.32, 0.36], glass: [0.5, 0.75, 0.95] };
  return sheet('water', lines, ctx, o, {
    ax,
    c,
    prims: P,
    pivot,
    pal,
    mats: { prop: 'metal', glass: 'glass', skirt: 'matte' },
    groups,
    mirror,
    box: box0,
    focus: { at: [0, C.mid, 0], k: 0.0 },
    n: { lv },
    traits: { style: ['boat', 'hovercraft', 'submarine'][lv - 1] },
  });
}

// ------------------------------------------------------------------ the parachute
// (its canister on the back of the boot; out of it, opened, a round canopy - its gores in two colours -
// on its lines to the car: folded away till it opens, game/gearmove.js)
function chuteDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const K = ctx.K;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const yb = (K ? beltY(K, 0.05) : C.tailY + 0.3) + 0.06;
  const zb = -D.hl + 0.14;
  P.push(cyl([0, yb, zb + 0.2], [0, yb, zb - 0.16], 0.13, 0.13, 'can', 'gun', { n: 16 }));
  P.push(cyl([0, yb, zb - 0.16], [0, yb, zb - 0.2], 0.14, 0.14, 'cap', 'gun', { n: 16 }));
  P.push(box([-0.16, yb - 0.15, zb - 0.06], [0.16, yb - 0.1, zb + 0.12], 'dark'));
  // the canopy, open: behind and up, facing the car - shown as it opens
  const R = clamp(1.6 + 0.4 * lv, 1.8, 2.8);
  const zc = zb - 4.2 - lv * 0.3;
  const yc = yb + 1.1;
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    // (a gore: from the apex out to the rim, bulging back)
    const ol = [[0, 0], [Math.cos(a0) * R, Math.sin(a0) * R], [Math.cos((a0 + a1) / 2) * R * 1.03, Math.sin((a0 + a1) / 2) * R * 1.03], [Math.cos(a1) * R, Math.sin(a1) * R]];
    P.push(slab('z', zc, ol.map(([u, w]) => [-u, yc + w]), 0.05, i % 2 ? 'canA' : 'canB', 'canopy', { noSil: true, edge: 1.5 }));
  }
  P.push(tor([0, yc, zc + 0.02], R * 0.18, 0.04, 'z', 'dark', 'canopy', { noSil: true }));
  const pal = { can: [0.16, 0.17, 0.2], cap: hc || RED, dark: [0.1, 0.1, 0.12], canA: hc || RED, canB: WHITE };
  return sheet('chute', lines, ctx, o, {
    ax: 'z',
    c: zb - 0.25,
    prims: P,
    pivot: [0, yb, zb],
    pal,
    mats: { canA: 'matte', canB: 'matte' },
    groups: { canopy: { at: [0, yb, zb - 0.2], ax: 'z', kind: 'open' } },
    box: [-R, R, yc - R, yc + R],
    focus: { at: [0, yb + 0.6, zb - 2], k: -0.2 },
    extra: { canopyAt: r3([0, yc, zc]), canopyR: R },
    n: { lv, span: R * 2 },
    traits: { R },
  });
}

// ------------------------------------------------------------------ the folding bridge
// (on roof rails: a giant ruler folded in three, its centimetres marked - out over a gap it unfolds
// forward and lies down across it, game/gearmove.js)
function bridgeDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof + 0.04;
  const L = clamp(D.hl * 2 * 0.86, 2.4, 4.4);
  const W = clamp(D.hw * 1.7, 1.4, 1.9);
  for (const s of [1, -1]) P.push(box([s * (W / 2 - 0.05) - 0.03, C.roof - 0.02, -L / 2], [s * (W / 2 - 0.05) + 0.03, y0, L / 2], 'rail'));
  const nf = lv + 1;
  for (let i = 0; i < nf; i++) {
    const y = y0 + i * 0.075;
    P.push(box([-W / 2, y, -L / 2], [W / 2, y + 0.065, L / 2], i % 2 ? 'rulerB' : 'ruler'));
    // (its marks: every 10 cm a tick, every metre a long one - on the top of the top fold)
    if (i === nf - 1) {
      for (let k = 0; k <= 20; k++) {
        const z = lerp(-L / 2 + 0.05, L / 2 - 0.05, k / 20);
        const long = k % 5 === 0;
        P.push(box([W / 2 - (long ? 0.36 : 0.18), y + 0.066, z - 0.008], [W / 2 - 0.02, y + 0.072, z + 0.008], 'mark', 'gun', { noSil: true }));
      }
    }
  }
  P.push(cyl([-W / 2 - 0.03, y0 + 0.1, L / 2 - 0.05], [W / 2 + 0.03, y0 + 0.1, L / 2 - 0.05], 0.04, 0.04, 'hinge', 'gun', { n: 10 }));
  const pal = { rail: [0.15, 0.15, 0.17], ruler: hc || [0.98, 0.84, 0.32], rulerB: hc ? mix(hc, [1, 1, 1], 0.25) : [0.99, 0.9, 0.52], mark: [0.12, 0.12, 0.14], hinge: CHROME };
  return sheet('bridge', lines, ctx, o, {
    ax: 'x',
    c: W / 2,
    prims: P,
    pivot: [0, y0, 0],
    pal,
    mats: { hinge: 'metal' },
    focus: { at: [0, y0, 0], k: 0.15 },
    n: { lv, len: [10, 18, 30][lv - 1], width: W },
    traits: { folds: nf },
  });
}

export const DESIGNS2 = { grapple: grappleDesign, monster: monsterDesign, tracks: tracksDesign, water: waterDesign, chute: chuteDesign, bridge: bridgeDesign };
export { rect, STEEL, BLADE };
