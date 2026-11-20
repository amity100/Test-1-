import { sheet, slab, cyl, box, sph, tor, blade, beltY, hull, lat, tube, rbox, ext, ringOf, band, coil, hueOf, mix, lerp, r3, rect, carNums, clamp, STEEL, CHROME, RUBBER, WHITE, HAZARD, RED, BLADE } from './gearlook.js';

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
    const xa = xw - tw / 2;
    const xb = xw + tw / 2;
    // (ROADMAP 28.24) the wheel as such a one is made. The tyre: its walls, its round shoulders, and two rows of
    // deep lugs round it, one a half step on from the other
    P.push(lat([xa, yc, z], [xb, yc, z], [[0, Rw * 0.56], [0, Rw * 0.8], [0.14, Rw * 0.92], [0.86, Rw * 0.92], [1, Rw * 0.8], [1, Rw * 0.56]], 'tyre', g, { n: 24 }));
    for (const [s, a0] of [[-1, 0], [1, Math.PI / 14]]) P.push(ringOf([xw + s * tw * 0.23, yc, z], Rw * 0.95, 'x', 14, 'tread', g, { w: Rw * 0.2, d: Rw * 0.13, h: tw * 0.5, a0 }));
    P.push(lat([xb - 0.012, yc, z], [xb + 0.004, yc, z], [[0, Rw * 0.62], [0, Rw * 0.78], [1, Rw * 0.78], [1, Rw * 0.62]], 'wall', g, { n: 24, noSil: true }));
    // the rim: a deep dish behind a lip, a ring bolted round the lip to hold the bead; six spokes in it out of the
    // hub; the hub's cap and its nuts
    P.push(lat([xa, yc, z], [xb, yc, z], [[1, Rw * 0.6], [1.03, Rw * 0.585], [1.03, Rw * 0.52], [0.5, Rw * 0.47], [0.5, Rw * 0.24], [0.96, Rw * 0.2], [1.06, Rw * 0.12], [1.06, 0]], 'rim', g, { n: 20, noSil: true }));
    P.push(ringOf([xb + tw * 0.035, yc, z], Rw * 0.555, 'x', 16, 'bolt', g, { r: Rw * 0.022, h: 0.03 }));
    P.push(ringOf([xb - tw * 0.22, yc, z], Rw * 0.36, 'x', 6, 'spoke', g, { w: Rw * 0.11, d: Rw * 0.26, h: tw * 0.1 }));
    P.push(ringOf([xb + tw * 0.02, yc, z], Rw * 0.15, 'x', 6, 'bolt', g, { r: Rw * 0.026, h: 0.05, a0: 0.5 }));
    P.push(lat([xb, yc, z], [xb + tw * 0.14, yc, z], [[0, Rw * 0.1], [0.7, Rw * 0.085], [1, Rw * 0.05], [1, 0]], 'hub', g, { n: 10, noSil: true }));
    // (its axle out of the body, a long shock leaning in over it with its spring wound round it, a link under)
    const top = [D.hw - 0.22, C.clear + 0.42, z];
    const low = [xa - 0.06, yc + 0.04, z];
    P.push(cyl([D.hw - 0.3, C.clear + 0.12, z], [xa + 0.02, yc, z], 0.055, 0.05, 'axle', 'gun', { n: 10, noSil: true }));
    P.push(cyl(low, top, 0.03, 0.03, 'shock', 'gun', { n: 8, noSil: true }));
    P.push(cyl([lerp(low[0], top[0], 0.45), lerp(low[1], top[1], 0.45), z], top, 0.045, 0.045, 'strut', 'gun', { n: 10, noSil: true }));
    P.push(coil([lerp(low[0], top[0], 0.08), lerp(low[1], top[1], 0.08), z], [lerp(low[0], top[0], 0.92), lerp(low[1], top[1], 0.92), z], 0.068, 6, 0.012, 'spring'));
    P.push(cyl([D.hw - 0.3, C.clear + 0.04, z - 0.2], [xa - 0.02, yc - Rw * 0.16, z], 0.022, 0.022, 'axle', 'gun', { n: 6, noSil: true }));
  }
  const pal = { tyre: RUBBER, tread: [0.15, 0.15, 0.16], wall: [0.2, 0.2, 0.21], rim: hc || [0.62, 0.64, 0.68], spoke: CHROME, bolt: [0.3, 0.31, 0.34], hub: [0.56, 0.07, 0.08], strut: [0.86, 0.62, 0.08], shock: CHROME, spring: [0.56, 0.07, 0.08], axle: [0.2, 0.2, 0.23] };
  return sheet('monster', lines, ctx, o, {
    ax: 'x',
    c: xw + tw / 2,
    prims: P,
    pivot: [xw, Rw - lift, 0],
    pal,
    mats: { rim: 'metal', tyre: 'matte', tread: 'matte', wall: 'matte', spoke: 'metal', bolt: 'metal', hub: 'metal', shock: 'metal', spring: 'metal', axle: 'metal', strut: 'paint' },
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
  // (ROADMAP 28.24) a track as one is made. Its wheels: the drive sprocket high at the back, its teeth; the idler
  // high at the front; road wheels on the ground between, rubber round each; return rollers over them
  const th = 0.034;
  const nr = 5;
  const Rs = hb * 0.6;
  const Ri = hb * 0.56;
  const wheels = [[zb + Rs + th, hb * 1.12, Rs, 'sprocket'], [zf - Ri - th, hb * 1.2, Ri, 'idler']];
  for (let k = 0; k < nr; k++) wheels.push([lerp(zb + Rs * 2 + Rr * 0.9, zf - Ri * 2 - Rr * 0.9, k / (nr - 1)), Rr + th, Rr, 'road']);
  const yTop = Math.max(wheels[0][1] + Rs, wheels[1][1] + Ri);
  const rollers = [0.3, 0.62].map((t) => [lerp(wheels[0][0], wheels[1][0], t), yTop - 0.065, 0.062, 'roller']);
  // the band: round the outside of them all, link after link, a bar across each
  const pts = [];
  for (const [z, y, R] of wheels.concat(rollers)) for (let i = 0; i < 20; i++) pts.push([z + Math.cos((i / 20) * Math.PI * 2) * (R + th), y + Math.sin((i / 20) * Math.PI * 2) * (R + th)]);
  const loop = hull(pts);
  let run = 0;
  for (let i = 0; i < loop.length; i++) run += Math.hypot(loop[(i + 1) % loop.length][0] - loop[i][0], loop[(i + 1) % loop.length][1] - loop[i][1]);
  P.push(band('x', x, loop, tw, th, 'band', 'gun', { links: Math.round(run / 0.105), gw: 0.062, gh: 0.03, kb: 'tread' }));
  const xo = x + tw / 2 - 0.05;
  const xi = x - tw / 2 + 0.05;
  wheels.concat(rollers).forEach(([z, y, R, kind], i) => {
    const g = `w${i}`;
    groups[g] = { at: [x, y, z], ax: 'x', kind: 'roll' };
    if (kind === 'sprocket') {
      P.push(lat([xi, y, z], [xo, y, z], [[0, 0], [0, R * 0.84], [1, R * 0.84], [1, R * 0.56], [0.7, R * 0.46], [0.7, R * 0.3], [1.1, R * 0.26], [1.16, R * 0.12], [1.16, 0]], 'sprocket', g, { n: 18, noSil: true }));
      for (const xs of [xi + 0.03, xo - 0.03]) P.push(ringOf([xs, y, z], R * 0.92, 'x', 11, 'teeth', g, { w: R * 0.26, d: R * 0.24, h: 0.035 }));
      P.push(ringOf([xo - 0.05, y, z], R * 0.38, 'x', 8, 'hub', g, { r: 0.013, h: 0.03 }));
    } else if (kind === 'roller') {
      P.push(lat([xi + 0.03, y, z], [xo - 0.03, y, z], [[0, 0], [0, R], [0.3, R], [0.34, R * 0.6], [0.66, R * 0.6], [0.7, R], [1, R], [1, 0]], 'wheel', g, { n: 10, noSil: true }));
    } else {
      // (two wheels side by side on one arm, the track's teeth running between them; rubber round each)
      for (const [a, b] of [[xi, x - 0.04], [x + 0.04, xo]]) {
        P.push(lat([a, y, z], [b, y, z], [[0, R * 0.5], [0, R * 0.82], [0.08, R], [0.92, R], [1, R * 0.82], [1, R * 0.5]], 'tyre', g, { n: 18, noSil: true }));
        P.push(lat([a, y, z], [b, y, z], [[1, R * 0.82], [0.6, R * 0.52], [0.6, R * 0.34], [1.12, R * 0.28], [1.2, R * 0.13], [1.2, 0]], kind === 'idler' ? 'sprocket' : 'wheel', g, { n: 16, noSil: true }));
      }
      P.push(ringOf([xo - 0.045, y, z], R * 0.42, 'x', kind === 'idler' ? 8 : 6, 'hub', g, { r: 0.012, h: 0.03 }));
      if (kind === 'idler') P.push(ringOf([xo - 0.07, y, z], R * 0.62, 'x', 5, 'hole', g, { r: R * 0.11, h: 0.02, sides: 8 }));
    }
  });
  // (the beam they hang from, an arm down to each road wheel, the idler's adjuster)
  P.push(rbox([x - tw / 2 - 0.02, hb * 0.86, wheels[0][0] + 0.1], [x - tw / 2 + 0.07, hb * 1.3, wheels[1][0] - 0.1], 'beam', 'gun', { noSil: true, e: 0.02 }));
  for (let k = 0; k < nr; k++) {
    const [z, y] = wheels[2 + k];
    P.push(cyl([x - 0.005, y, z], [x - 0.005, hb * 1.02, z - 0.17], 0.03, 0.036, 'arm', 'gun', { n: 6, noSil: true }));
  }
  P.push(cyl([x, wheels[1][1], wheels[1][0]], [x, hb * 1.12, wheels[1][0] - 0.3], 0.026, 0.026, 'arm', 'gun', { n: 6, noSil: true }));
  // (its guard over the top: a plate, a lip down at the front and one at the back, on brackets)
  const yg = yTop + th + 0.05;
  P.push(ext('x', x, [[zb + 0.02, yg - 0.1], [zb + 0.16, yg], [zf - 0.2, yg], [zf - 0.02, yg - 0.12], [zf - 0.02, yg - 0.09], [zf - 0.2, yg + 0.035], [zb + 0.16, yg + 0.035], [zb + 0.02, yg - 0.07]], tw + 0.07, 'guard', 'gun', { e: 0.012 }));
  for (const t of [0.2, 0.5, 0.8]) P.push(box([x - tw / 2 - 0.04, yg - 0.07, lerp(zb, zf, t) - 0.02], [x - tw / 2 + 0.03, yg + 0.004, lerp(zb, zf, t) + 0.02], 'arm', 'gun', { noSil: true }));
  const pal = { band: [0.17, 0.17, 0.19], tread: [0.27, 0.27, 0.3], tyre: RUBBER, wheel: hc ? mix(hc, [0.25, 0.27, 0.24], 0.5) : [0.3, 0.34, 0.26], sprocket: [0.36, 0.37, 0.4], teeth: [0.46, 0.47, 0.5], hub: CHROME, hole: [0.07, 0.07, 0.08], beam: [0.16, 0.17, 0.17], arm: [0.22, 0.23, 0.24], guard: hc || [0.33, 0.37, 0.26] };
  return sheet('tracks', lines, ctx, o, {
    ax: 'x',
    c: x + tw / 2,
    prims: P,
    pivot: [x, hb, 0],
    pal,
    mats: { band: 'matte', tread: 'metal', hub: 'metal', tyre: 'matte', wheel: 'paint', sprocket: 'metal', teeth: 'metal', hole: 'matte', beam: 'metal', arm: 'metal', guard: 'paint' },
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
  // (ROADMAP 28.24) a drag chute's can as one is made: a tube with a rolled lip, bands round it, the cap that blows
  // off held by four latches, a ring on the cap the pilot chute pulls by; its cradle - two saddles on a plate -
  // bolted down; the firing cable in along it
  P.push(lat([0, yb, zb + 0.2], [0, yb, zb - 0.16], [[0, 0], [0, 0.1], [0.06, 0.13], [0.94, 0.13], [0.94, 0.142], [1, 0.142], [1, 0.12]], 'can', 'gun', { n: 16 }));
  for (const t of [0.22, 0.6]) P.push(tor([0, yb, lerp(zb + 0.2, zb - 0.16, t)], 0.132, 0.008, 'z', 'band', 'gun', { noSil: true }));
  P.push(lat([0, yb, zb - 0.15], [0, yb, zb - 0.22], [[0, 0.136], [0.5, 0.136], [0.8, 0.11], [1, 0.05], [1, 0]], 'cap', 'gun', { n: 16 }));
  P.push(ringOf([0, yb, zb - 0.16], 0.146, 'z', 4, 'band', 'gun', { w: 0.04, d: 0.018, h: 0.05, a0: Math.PI / 4 }));
  P.push(tor([0, yb, zb - 0.235], 0.03, 0.007, 'x', 'band', 'gun', { noSil: true }));
  P.push(rbox([-0.17, yb - 0.165, zb - 0.1], [0.17, yb - 0.14, zb + 0.16], 'dark', 'gun', { e: 0.008 }));
  for (const z of [zb - 0.04, zb + 0.1]) P.push(ext('z', z, [[-0.15, yb - 0.145], [0.15, yb - 0.145], [0.13, yb - 0.06], [0.09, yb - 0.1], [0, yb - 0.125], [-0.09, yb - 0.1], [-0.13, yb - 0.06]], 0.03, 'dark', 'gun', { noSil: true, e: 0.004 }));
  for (const x of [-0.14, 0.14]) for (const z of [zb - 0.07, zb + 0.13]) P.push(cyl([x, yb - 0.142, z], [x, yb - 0.128, z], 0.014, 0.011, 'band', 'gun', { n: 6, noSil: true }));
  P.push(tube([[0.06, yb + 0.1, zb + 0.2], [0.09, yb + 0.07, zb + 0.3], [0.12, yb - 0.08, zb + 0.34], [0.12, yb - 0.15, zb + 0.4]], 0.008, 'band', 'gun', { n: 5 }));
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
  const pal = { can: [0.2, 0.21, 0.25], band: [0.5, 0.51, 0.55], cap: hc || [0.6, 0.08, 0.09], dark: [0.1, 0.1, 0.12], canA: hc || [0.6, 0.08, 0.09], canB: WHITE };
  return sheet('chute', lines, ctx, o, {
    ax: 'z',
    c: zb - 0.25,
    prims: P,
    pivot: [0, yb, zb],
    pal,
    mats: { canA: 'matte', canB: 'matte', can: 'metal', band: 'metal', dark: 'metal' },
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
