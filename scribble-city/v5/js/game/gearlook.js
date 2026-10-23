import { boxOf, thin, tidy, outlineOf, rect, circ, bar, mix, hueOf, lum, lerp, r2, r3, featOf, PAL } from './itemdesign.js';
import { carNums } from './itemlook.js';
import { AX } from './fusedraw.js';
import { clamp } from '../core/util.js';

// (ROADMAP 11.28) The things of the pen (game/itemcat.js) designed as such things are made - a helicopter's
// rotor with its tail rotor, nitro bottles and their exhausts, coilovers at the wheels, a stopwatch on the
// dashboard... - in the car's frame, each part a primitive (game/designbuild.js), what moves round its own
// pivot (groups: a rotor's blades, a flame that shows only while it is used - game/gear.js animate).
//
// A thing here is made on a sheet: the plane the drawing is laid on (square to the car's x, y or z),
// its parts seen on that plane - their outline, as an eye sees it (game/itemdesign.js outlineOf) - is
// what the drawing's lines straighten onto (tidy), as game/itemdesign.js does for the machine gun and
// the cannon: the ink lands on the car as drawn, straightens onto the thing, and it fills.
//
// design(id, lines, ctx, o) -> { shape, at, focus, P3, T3, fade, dash, mirror, flip, side, n, traits }, as
// game/itemdesign.js designOf; o: { side, ink, n, lv (its level, 1-3) }.

const STEEL = [0.55, 0.57, 0.6];
const CHROME = [0.82, 0.84, 0.88];
const RUBBER = [0.09, 0.09, 0.1];
const NITRO = [0.12, 0.34, 0.86];
const BLUEFLAME = [0.55, 0.78, 1];
const HOTFLAME = [1, 0.62, 0.18];
const WHITE = [0.96, 0.96, 0.94];
const HAZARD = [1, 0.78, 0.1];
const RED = [0.86, 0.14, 0.14];
const GREEN = [0.1, 0.78, 0.32];
const BLADE = [0.17, 0.18, 0.2];

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ------------------------------------------------------------------ what its parts look like on a plane
// a polygon's convex hull (its points, any order)
function hull(P) {
  const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// a point of the car's frame on the plane square to ax: [u, w] (game/fusedraw.js AX)
const uvOf = (X, ax) => [dot(X, AX[ax].e1), dot(X, AX[ax].e2)];

// how far a point is from a polygon (0 inside it)
function polyDist(P, [x, y]) {
  let inside = false;
  let best = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j];
    const [bx, by] = P[i];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return inside ? 0 : best;
}

// each primitive as it is seen on the plane (ax): polygons in its (u, w)
export function silOf(prims, ax) {
  const out = [];
  for (const q of prims) {
    if (q.noSil) continue;
    if (q.t === 'box') {
      const P = [];
      for (const x of [q.p0[0], q.p1[0]]) for (const y of [q.p0[1], q.p1[1]]) for (const z of [q.p0[2], q.p1[2]]) P.push(uvOf([x, y, z], ax));
      out.push(hull(P));
    } else if (q.t === 'cyl') {
      const a = uvOf(q.p0, ax);
      const b = uvOf(q.p1, ax);
      const r = Math.max(q.r0, q.r1);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < r * 0.5) out.push(circ(a[0], a[1], r, 16));
      else {
        // (round at its ends as it is seen at a slant)
        const P = [];
        const n = AX[ax].n;
        const d = [q.p1[0] - q.p0[0], q.p1[1] - q.p0[1], q.p1[2] - q.p0[2]];
        const L = Math.hypot(...d) || 1;
        const along = Math.abs(dot(d, n)) / L;
        for (const [c, rr] of [[q.p0, q.r0], [q.p1, q.r1]]) {
          const [u, w] = uvOf(c, ax);
          for (let i = 0; i < 12; i++) {
            const t = (i / 12) * Math.PI * 2;
            P.push([u + Math.cos(t) * rr, w + Math.sin(t) * rr * (along > 0.2 ? 1 : 0.999)]);
          }
        }
        out.push(along > 0.2 ? hull(P) : bar(a, b, r * 2));
      }
    } else if (q.t === 'sph') {
      const [u, w] = uvOf(q.c, ax);
      out.push(circ(u, w, q.r, 16));
    } else if (q.t === 'tor') {
      const P = [];
      const R = q.R + q.r;
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        const a = Math.cos(t) * R;
        const b = Math.sin(t) * R;
        for (const s of [-q.r, q.r]) {
          const X = q.ax === 'x' ? [q.c[0] + s, q.c[1] + a, q.c[2] + b] : q.ax === 'y' ? [q.c[0] + a, q.c[1] + s, q.c[2] + b] : [q.c[0] + a, q.c[1] + b, q.c[2] + s];
          P.push(uvOf(X, ax));
        }
      }
      out.push(hull(P));
    } else if (q.t === 'slab') {
      if (q.ax === ax) out.push(q.ol.map((p) => p.slice()));
      else {
        const A = AX[q.ax];
        const P = [];
        for (const [u, w] of q.ol) {
          for (const s of [-q.W / 2, q.W / 2]) {
            const X = [0, 1, 2].map((k) => A.n[k] * (q.c + s) + A.e1[k] * u + A.e2[k] * w);
            P.push(uvOf(X, ax));
          }
        }
        out.push(hull(P));
      }
    } else if (q.t === 'lathe') {
      const top = q.prof[q.prof.length - 1][1];
      if (ax === 'y') out.push(circ(...uvOf(q.c, ax), Math.max(...q.prof.map((p) => p[0])), 20));
      else {
        const P = [];
        for (const [r, y] of q.prof) P.push(uvOf([q.c[0] + r, q.c[1] + y, q.c[2]], ax));
        for (let i = q.prof.length - 1; i >= 0; i--) P.push(uvOf([q.c[0] - q.prof[i][0], q.c[1] + q.prof[i][1], q.c[2]], ax));
        out.push(P.length >= 3 ? P : rect(0, 0.1, 0, top));
      }
    }
  }
  return out.filter((P) => P && P.length >= 3);
}

// ------------------------------------------------------------------ the sheet
// The parts (D.prims, in the car's frame) and the plane the drawing is laid on (D.ax at D.c): the drawing
// over the outline of what is seen of it there (its box fitted to the outline's box, each way within a
// little of the other; mirrored if that lies better), each line tidied onto the edge it is near. D: { ax,
// c, prims, pivot, pal, role, groups, mats, mirror, fill, focus, n, traits, dash (polygons on the plane,
// what the drawing did not draw but such a thing has: dashed in), box ([u0, u1, w0, w1]: where the
// drawing goes - else the outline's box), extra (more of its shape) }
export function sheet(id, lines, ctx, o, D) {
  const A = AX[D.ax];
  const X = (u, w, d = 0) => [0, 1, 2].map((k) => A.n[k] * (D.c + d) + A.e1[k] * u + A.e2[k] * w);
  const sil = silOf(D.prims.filter((q) => !q.hide), D.ax);
  const SB = boxOf(sil);
  const size = Math.max(SB.w, SB.h, 0.2);
  const outl = outlineOf(sil, size / 90);
  const targets = outl.map((P) => ({ P, closed: true }));
  const [u0, u1, w0, w1] = D.box || [SB.x0, SB.x1, SB.y0, SB.y1];
  const B = boxOf(lines);
  // (its box onto the thing's: as wide as it and as tall, but never stretched more than half again one
  // way than the other)
  let su = (u1 - u0) / Math.max(B.w, 1e-3);
  let sw = (w1 - w0) / Math.max(B.h, 1e-3);
  const k = Math.sqrt(su / sw);
  if (k > 1.5) su = sw * 2.25;
  if (k < 1 / 1.5) sw = su * 2.25;
  const cu = (u0 + u1) / 2;
  const cw = (w0 + w1) / 2;
  const lay = (f) => lines.map((L) => L.map(([x, y]) => [cu + f * (x - B.cx) * su, cw + (y - B.cy) * sw]));
  const tol = size * 0.12;
  let best = null;
  for (const f of [1, -1]) {
    const over = lay(f);
    const td = tidy(over.map((L) => thin(L, 48)), targets, tol);
    const on = td.on.filter((x) => x >= 0).length;
    if (!best || on > best.on) best = { over, td, on, f };
  }
  const { td, over } = best;
  const pv = D.pivot;
  // (each line of ink on the part it lies on: one on a moving part - a blade, a saw, a ball - goes round
  // with it, game/designbuild.js)
  const kept = td.lines.filter((L, i) => !td.fade[i]);
  let inkG = null;
  if (D.groups && Object.keys(D.groups).length) {
    const parts = D.prims.filter((q) => !q.hide && !q.noSil).map((q) => ({ g: q.g, P: silOf([q], D.ax)[0] })).filter((x) => x.P);
    inkG = kept.map((L) => {
      const votes = {};
      for (const pt of L) {
        let bg = null;
        let bd = Infinity;
        for (const s of parts) {
          const d = polyDist(s.P, pt);
          if (d < bd) {
            bd = d;
            bg = s.g;
          }
        }
        votes[bg] = (votes[bg] || 0) + 1;
      }
      const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
      return top && D.groups[top[0]] ? top[0] : null;
    });
  }
  const dash = (D.dash || []).map((P) => P.concat([P[0]]).map(([u, w]) => r3(X(u, w, 0.02))));
  const hc = hueOf(o.ink);
  return {
    shape: {
      design: 1,
      kind: id,
      ax: D.ax,
      c: D.c,
      pivot: r3(pv),
      role: D.role || 'gear',
      mirror: !!D.mirror,
      fill: D.fill || D.ax,
      prims: D.prims,
      ink: kept.map((L) => thin(L, 40).map(r2)),
      inkG,
      pal: D.pal,
      groups: D.groups || null,
      mats: D.mats || null,
      lv: o.lv || 1,
      ...(D.extra || {}),
    },
    at: r3(pv),
    focus: D.focus || { at: r3(pv), k: 0.3 },
    // (the ink laid on the thing's plane as it was drawn; then each point onto the thing's lines)
    P3: over.map((L) => L.map(([u, w]) => r3(X(u, w, 0.012)))),
    T3: td.lines.map((L) => L.map(([u, w]) => r3(X(u, w, 0.012)))),
    fade: td.fade,
    dash,
    mirror: !!D.mirror,
    flip: best.f,
    side: o.side || 1,
    n: { ...(D.n || {}), lv: o.lv || 1 },
    traits: { kind: id, lv: o.lv || 1, hue: !!hc, ...(D.traits || {}) },
  };
}

// a flat piece (on the plane square to ax at c): its outline in that plane's (u, w), W thick
const slab = (ax, c, ol, W, k, g = 'gun', o = {}) => ({ t: 'slab', ax, c, ol: ol.map(r2), W, k, g, edge: o.edge || 3, ...(o.noSil ? { noSil: true } : {}), ...(o.hide ? { hide: true } : {}), ...(o.res ? { res: o.res } : {}) });
const cyl = (p0, p1, r0, r1, k, g = 'gun', o = {}) => ({ t: 'cyl', p0: r3(p0), p1: r3(p1), r0, r1, k, g, n: o.n || 14, ...(o.noSil ? { noSil: true } : {}), ...(o.hide ? { hide: true } : {}) });
const box = (p0, p1, k, g = 'gun', o = {}) => ({ t: 'box', p0: r3(p0), p1: r3(p1), k, g, ...(o.noSil ? { noSil: true } : {}), ...(o.hide ? { hide: true } : {}) });
const sph = (c, r, k, g = 'gun', o = {}) => ({ t: 'sph', c: r3(c), r, k, g, ...(o.noSil ? { noSil: true } : {}), ...(o.hide ? { hide: true } : {}) });
const tor = (c, R, r, ax, k, g = 'gun', o = {}) => ({ t: 'tor', c: r3(c), R, r, ax, k, g, ...(o.noSil ? { noSil: true } : {}), ...(o.hide ? { hide: true } : {}) });
// a rectangle turned by a (radians) round (cu, cw), from along 0 to along L out, w wide - a blade
function blade(cu, cw, a, r0, r1, w0, w1) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const P = [[r0, -w0 / 2], [r1, -w1 / 2], [r1, w1 / 2], [r0, w0 / 2]];
  return P.map(([x, y]) => [cu + x * c - y * s, cw + x * s + y * c]);
}

// how many arms the drawing has out from its middle (an X: four; a line: two; a propeller of three)
function armsOf(lines) {
  const B = boxOf(lines);
  const size = Math.max(B.w, B.h, 1e-3);
  let n = 0;
  for (const L of lines) {
    for (const q of [L[0], L[L.length - 1]]) if (Math.hypot(q[0] - B.cx, q[1] - B.cy) > size * 0.32) n++;
  }
  return n;
}

// ------------------------------------------------------------------ a helicopter's rotor
// (on a mast over the middle of the roof: two blades - or three, four as drawn - longer than the car, their
// tips painted; a tail boom out over the back, its fin and its tail rotor turning on its side. Laid on the
// plane over the blades, as a rotor is drawn - from over it)
function rotorDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const n = o.n || {};
  const lv = o.lv || 1;
  const arms = armsOf(lines);
  const nb = arms >= 4 ? 4 : arms === 3 ? 3 : 2;
  const R = clamp((n.span || 6) * 0.7, 3.2, 4.6) + (lv - 1) * 0.15;
  const hub = C.roof + 0.66;
  const z0 = -0.05;
  const hc = hueOf(o.ink);
  const P = [];
  // the mast on its plate, the swashplate, its links
  P.push(cyl([0, C.roof - 0.03, z0], [0, C.roof + 0.05, z0], 0.3, 0.27, 'dark', 'gun', { n: 20 }));
  P.push(cyl([0, C.roof + 0.05, z0], [0, hub - 0.05, z0], 0.075, 0.065, 'steel'));
  P.push(cyl([0, hub - 0.25, z0], [0, hub - 0.2, z0], 0.17, 0.17, 'chrome', 'gun', { n: 18 }));
  for (const s of [1, -1]) P.push(cyl([s * 0.12, hub - 0.2, z0], [s * 0.1, hub - 0.03, z0], 0.012, 0.012, 'dark', 'gun', { n: 6 }));
  // (what turns: the hub, its grips, the blades - flat, a little thinner out to their painted tips)
  P.push(cyl([0, hub - 0.06, z0], [0, hub + 0.07, z0], 0.13, 0.11, 'dark', 'main', { n: 16 }));
  P.push(sph([0, hub + 0.08, z0], 0.09, 'chrome', 'main'));
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + 0.35;
    // (on the y plane: u is the car's z, w its -x)
    P.push(slab('y', hub, blade(z0, 0, a, 0.08, 0.36, 0.2, 0.17), 0.07, 'dark', 'main', { edge: 2.4 }));
    P.push(slab('y', hub, blade(z0, 0, a, 0.34, R * 0.84, 0.3, 0.26), 0.045, 'blade', 'main', { edge: 2.2 }));
    P.push(slab('y', hub, blade(z0, 0, a, R * 0.84, R, 0.26, 0.24), 0.05, 'tip', 'main', { edge: 2.2 }));
  }
  // the tail boom: from the back of the roof out behind the car, a little up; its strut to the boot
  const zr = -D.hl * 0.42;
  const zt = -D.hl - 1.5;
  const yr = C.roof + 0.02;
  const yt = C.roof + 0.42;
  P.push(cyl([0, yr, zr], [0, yt, zt], 0.1, 0.055, 'boom', 'gun', { n: 14 }));
  P.push(cyl([0, yr + 0.12, zr + 0.1], [0, hub - 0.22, z0 - 0.05], 0.05, 0.04, 'boom', 'gun', { n: 8 }));
  P.push(cyl([0, C.tailY + 0.25, -D.hl + 0.15], [0, lerp(yr, yt, 0.55), lerp(zr, zt, 0.55)], 0.03, 0.03, 'steel', 'gun', { n: 6 }));
  // its fin (upright, swept) and the stabiliser across it
  P.push(slab('x', 0, [[zt + 0.42, yt - 0.02], [zt + 0.05, yt + 0.62], [zt - 0.16, yt + 0.62], [zt - 0.02, yt - 0.06], [zt + 0.06, yt - 0.3], [zt + 0.24, yt - 0.26]], 0.05, 'boom', 'gun', { edge: 2.4 }));
  P.push(slab('y', yt - 0.02, [[zt + 0.42, -0.42], [zt + 0.18, -0.46], [zt + 0.18, 0.46], [zt + 0.42, 0.42]], 0.04, 'boom', 'gun', { edge: 2 }));
  // the tail rotor, on the fin's side - turning round the car's x
  const ty = yt + 0.32;
  const tz = zt - 0.02;
  const tx = 0.1;
  P.push(cyl([tx - 0.06, ty, tz], [tx + 0.04, ty, tz], 0.045, 0.045, 'dark', 'tail', { n: 10 }));
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + 0.6;
    // (on the x plane: u is the car's z, w its y)
    P.push(slab('x', tx, blade(tz, ty, a, 0.03, 0.42, 0.09, 0.07), 0.025, 'blade', 'tail', { edge: 2 }));
    P.push(slab('x', tx, blade(tz, ty, a, 0.42, 0.5, 0.07, 0.07), 0.03, 'tip', 'tail', { edge: 2 }));
  }
  // (its anti-collision light)
  P.push(sph([0, yt + 0.66, zt - 0.08], 0.035, 'light', 'gun', { noSil: true }));
  const pal = {
    dark: [0.13, 0.13, 0.15],
    steel: STEEL,
    chrome: CHROME,
    blade: BLADE,
    tip: hc ? mix(hc, [1, 1, 1], 0.1) : HAZARD,
    boom: hc ? mix(hc, [0.15, 0.15, 0.17], 0.25) : [0.88, 0.88, 0.86],
    light: RED,
  };
  return sheet('rotor', lines, ctx, o, {
    ax: 'y',
    c: hub,
    prims: P,
    pivot: [0, hub, z0],
    pal,
    groups: { main: { at: [0, hub, z0], ax: 'y' }, tail: { at: [tx, ty, tz], ax: 'x' } },
    // (the drawing over the blades - not over the boom behind)
    box: [z0 - R * 0.85, z0 + R * 0.85, -R * 0.85, R * 0.85],
    focus: { at: [0, hub, -D.hl * 0.4], k: -0.4 },
    n: { span: Math.round(R * 2 * 100) / 100, blades: nb },
    traits: { blades: nb, R: Math.round(R * 100) / 100 },
  });
}

// ------------------------------------------------------------------ the turbo
// (level 1-2: two nitrous bottles across the boot lid, blue, on their brackets, their lines down to two big
// chrome exhausts out of the back - from which a blue flame roars as it boosts. Level 3: a jet engine on
// the roof, its intake ring, its nozzle out over the back, the flame white-hot)
function turboDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const K = ctx.K;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const trunkY = K ? beltY(K, 0.06) + 0.04 : C.tailY + 0.3;
  const zt = -D.hl;
  let pivot;
  let groups;
  let box0;
  let focus;
  if (lv < 3) {
    const xb = 0.22;
    const zb0 = zt + 0.28;
    const zb1 = zb0 + clamp(D.hl * 0.42, 0.62, 0.9) * (lv === 2 ? 1.12 : 1);
    const rb = lv === 2 ? 0.115 : 0.1;
    const yb = trunkY + rb + 0.05;
    for (const x of [xb]) {
      P.push(cyl([x, yb, zb0], [x, yb, zb1], rb, rb, 'nitro', 'gun', { n: 16 }));
      P.push(sph([x, yb, zb1], rb * 0.98, 'nitro'));
      P.push(sph([x, yb, zb0], rb * 0.98, 'nitro'));
      P.push(cyl([x, yb, lerp(zb0, zb1, 0.42)], [x, yb, lerp(zb0, zb1, 0.58)], rb + 0.006, rb + 0.006, 'white', 'gun', { n: 16, noSil: true }));
      P.push(cyl([x, yb, zb1 + rb * 0.7], [x, yb, zb1 + rb + 0.07], 0.03, 0.03, 'chrome', 'gun', { n: 8 }));
      P.push(cyl([x, yb + 0.07, zb1 + rb + 0.05], [x, yb + 0.07, zb1 + rb + 0.09], 0.05, 0.05, 'dark', 'gun', { n: 10 }));
      for (const z of [lerp(zb0, zb1, 0.18), lerp(zb0, zb1, 0.82)]) P.push(box([x - rb - 0.015, trunkY - 0.01, z - 0.025], [x + rb + 0.015, yb - rb * 0.3, z + 0.025], 'dark'));
    }
    // the exhausts: big chrome tips out of the bumper
    const ye = Math.max(0.3, C.clear + 0.12);
    const xe = clamp(D.hw * 0.55, 0.35, 0.6);
    const ze0 = zt + 0.05;
    const ze1 = zt - 0.24;
    P.push(cyl([xe, ye, ze0], [xe, ye, ze1], 0.075, 0.085, 'chrome', 'gun', { n: 16 }));
    P.push(cyl([xe, ye, ze1 - 0.005], [xe, ye, ze1 - 0.01], 0.06, 0.06, 'dark', 'gun', { n: 16, noSil: true }));
    // (the line from the bottle down to it)
    P.push(cyl([xb, yb, zb1 + rb + 0.06], [xe * 0.9, ye + 0.12, zt + 0.02], 0.016, 0.016, 'rubber', 'gun', { n: 6, noSil: true }));
    // the flame - out only as it boosts (game/gear.js), and as it takes shape
    const fl = lv === 2 ? 1.25 : 1;
    P.push(cyl([xe, ye, ze1 - 0.02], [xe, ye, ze1 - 1.05 * fl], 0.1, 0.015, 'flameB', 'flame', { n: 12 }));
    P.push(cyl([xe, ye, ze1 - 0.02], [xe, ye, ze1 - 0.55 * fl], 0.055, 0.01, 'flameW', 'flame', { n: 10, noSil: true }));
    pivot = [xe, ye, ze1];
    groups = { flame: { at: [xe, ye, ze1], ax: 'z', kind: 'flame' } };
    box0 = [ze1 - 1.05 * fl, ze1, ye - 0.16, ye + 0.16];
    focus = { at: [0, ye + 0.3, zt - 0.3], k: 0.12 };
  } else {
    // (a jet engine over the roof's back: its pylon on the roof, its intake, its casing, its nozzle)
    const y = C.roof + 0.36;
    const zf = 0.15;
    const zn = zt - 0.35;
    const R0 = 0.3;
    P.push(box([-0.06, C.roof - 0.02, zf - 0.45], [0.06, y - R0 * 0.6, zn + 0.55], 'dark'));
    P.push(tor([0, y, zf], R0, 0.045, 'z', 'chrome'));
    P.push(cyl([0, y, zf], [0, y, zf - 0.25], R0, R0 * 1.02, 'jet', 'gun', { n: 22 }));
    P.push(cyl([0, y, zf - 0.25], [0, y, zn + 0.35], R0 * 1.02, R0 * 0.86, 'jet', 'gun', { n: 22 }));
    P.push(cyl([0, y, zn + 0.35], [0, y, zn], R0 * 0.86, R0 * 0.62, 'dark', 'gun', { n: 22 }));
    P.push(cyl([0, y, zf - 0.02], [0, y, zf - 0.05], R0 * 0.9, R0 * 0.9, 'chrome', 'gun', { n: 22, noSil: true }));
    P.push(sph([0, y, zf - 0.08], R0 * 0.32, 'chrome', 'gun', { noSil: true }));
    for (const s of [1, -1]) P.push(box([s * 0.03 - 0.01, y - 0.02, zf - 0.6], [s * 0.03 + 0.01, y + R0 * 1.04, zf - 0.35], 'accent', 'gun', { noSil: true }));
    P.push(cyl([0, y, zn - 0.02], [0, y, zn - 1.6], R0 * 0.55, 0.03, 'flameB', 'flame', { n: 14 }));
    P.push(cyl([0, y, zn - 0.02], [0, y, zn - 0.9], R0 * 0.3, 0.02, 'flameW', 'flame', { n: 12, noSil: true }));
    pivot = [0, y, zn];
    groups = { flame: { at: [0, y, zn], ax: 'z', kind: 'flame' } };
    box0 = [zn - 1.6, zf, y - R0, y + R0];
    focus = { at: [0, y, zt * 0.6], k: 0.05 };
  }
  const pal = {
    nitro: hc ? mix(hc, NITRO, 0.35) : NITRO,
    white: WHITE,
    chrome: CHROME,
    dark: [0.12, 0.12, 0.14],
    rubber: RUBBER,
    jet: hc ? mix(hc, STEEL, 0.4) : STEEL,
    accent: HAZARD,
    flameB: lv === 3 ? HOTFLAME : BLUEFLAME,
    flameW: [1, 1, 0.96],
  };
  return sheet('turbo', lines, ctx, o, {
    ax: 'x',
    c: lv < 3 ? clamp(D.hw * 0.55, 0.35, 0.6) : 0,
    prims: P,
    pivot,
    pal,
    mats: { flameB: 'glow', flameW: 'glow', nitro: 'paint' },
    groups,
    mirror: lv < 3,
    box: box0,
    focus,
    n: { lv },
    traits: { style: lv < 3 ? 'nitro' : 'jet' },
  });
}

// (a city car's waist height, t: 0 its tail .. 1 its nose)
function beltY(K, t) {
  const B = K.belt;
  if (!B) return K.roofY * 0.6;
  for (let i = 1; i < B.length; i++) {
    if (t <= B[i][0]) {
      const k = (t - B[i - 1][0]) / Math.max(1e-6, B[i][0] - B[i - 1][0]);
      return B[i - 1][1] + (B[i][1] - B[i - 1][1]) * k;
    }
  }
  return B[B.length - 1][1];
}

// ------------------------------------------------------------------ the jump
// (at each wheel a coilover - its spring round its damper, from the hub up to the body - in the drawing's
// colour; level 2-3 also a jump jet under each sill, its nozzle pointing down, its flame out as it jumps.
// Laid on the car's side, as a spring is drawn)
function jumpDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const spots = (ctx.spots || []).filter((s) => s.x > 0);
  const wz = spots.length ? spots.map((s) => s.z) : [-D.hl * 0.62, D.hl * 0.62];
  const r0 = ctx.r0 || 0.34;
  const x = D.hw + 0.08;
  const y0 = r0 * 0.9;
  const y1 = Math.max(C.mid + 0.05, y0 + 0.5);
  const groups = {};
  for (let i = 0; i < wz.length; i++) {
    const z = wz[i];
    const g = `coil${i}`;
    groups[g] = { at: [x, y0, z], ax: 'y', kind: 'spring' };
    // the damper (its body, its rod), its mounts; the spring round it
    P.push(cyl([x, y0, z], [x, lerp(y0, y1, 0.55), z], 0.05, 0.05, 'damper', g, { n: 12 }));
    P.push(cyl([x, lerp(y0, y1, 0.5), z], [x, y1, z], 0.022, 0.022, 'chrome', g, { n: 8 }));
    P.push(cyl([x, y0 - 0.04, z], [x, y0 + 0.02, z], 0.07, 0.07, 'dark', g, { n: 12 }));
    P.push(cyl([x, y1 - 0.03, z], [x, y1 + 0.02, z], 0.085, 0.085, 'dark', g, { n: 12 }));
    const coils = 6;
    const rc = 0.085;
    for (let k = 0; k < coils; k++) {
      const yy = lerp(y0 + 0.08, y1 - 0.08, (k + 0.5) / coils);
      P.push(tor([x, yy, z], rc, 0.018, 'y', 'spring', g));
    }
  }
  if (lv >= 2) {
    // (the jump jets: a nozzle under each sill between the wheels, its tank above)
    const zs = wz.length >= 2 ? [lerp(wz[0], wz[wz.length - 1], 0.3), lerp(wz[0], wz[wz.length - 1], 0.7)] : [0];
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      const xj = D.hw - 0.12;
      const yj = Math.max(0.16, C.clear - 0.02);
      P.push(cyl([xj, yj + 0.16, z], [xj, yj, z], 0.06, 0.085, 'dark', 'gun', { n: 14 }));
      P.push(cyl([xj, yj + 0.16, z - 0.1], [xj, yj + 0.16, z + 0.1], 0.06, 0.06, 'tank', 'gun', { n: 12, noSil: true }));
      const g = `jet${i}`;
      groups[g] = { at: [xj, yj, z], ax: 'y', kind: 'flame' };
      P.push(cyl([xj, yj - 0.01, z], [xj, yj - (lv === 3 ? 0.9 : 0.65), z], 0.09, 0.012, 'flameB', g, { n: 12, noSil: true }));
      P.push(cyl([xj, yj - 0.01, z], [xj, yj - 0.35, z], 0.05, 0.01, 'flameW', g, { n: 10, noSil: true }));
    }
  }
  const pal = {
    spring: hc || [0.9, 0.16, 0.12],
    damper: [0.92, 0.72, 0.1],
    chrome: CHROME,
    dark: [0.12, 0.12, 0.14],
    tank: STEEL,
    flameB: BLUEFLAME,
    flameW: [1, 1, 0.96],
  };
  return sheet('jump', lines, ctx, o, {
    ax: 'x',
    c: x,
    prims: P,
    pivot: [x, y0, 0],
    pal,
    mats: { flameB: 'glow', flameW: 'glow' },
    groups,
    mirror: true,
    box: [wz[wz.length - 1] - 0.12, wz[wz.length - 1] + 0.12, y0 - 0.05, y1 + 0.05],
    focus: { at: [D.hw, y0 + 0.2, 0], k: 0.15 },
    n: { lv },
    traits: { coilovers: wz.length * 2, jets: lv >= 2 },
  });
}

// ------------------------------------------------------------------ the rewind
// (a stopwatch on the dashboard - chrome, its crown and its buttons, its face, its hands: they run back as
// it rewinds. Nothing else of it shows on the car)
function rewindDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const hc = hueOf(o.ink);
  const P = [];
  // (on the hood, just before the windscreen, lying face up in its chrome bezel - the driver's, and in
  // sight from behind and above)
  const zc = C.hoodZ - clamp(D.hl * 0.12, 0.12, 0.3);
  const yc = C.hoodY + 0.06;
  const R = 0.17;
  P.push(cyl([0, yc - 0.06, zc], [0, yc + 0.03, zc], R, R, 'case', 'gun', { n: 26 }));
  P.push(tor([0, yc + 0.03, zc], R, 0.018, 'y', 'chrome'));
  P.push(cyl([0, yc + 0.03, zc], [0, yc + 0.034, zc], R * 0.9, R * 0.9, 'face', 'gun', { n: 26, noSil: true }));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const l = k % 3 ? 0.02 : 0.04;
    P.push(box([Math.cos(a) * (R * 0.8 - l) - 0.004, yc + 0.034, zc + Math.sin(a) * (R * 0.8 - l) - 0.004], [Math.cos(a) * R * 0.8 + 0.004, yc + 0.04, zc + Math.sin(a) * R * 0.8 + 0.004], 'dark', 'gun', { noSil: true }));
  }
  // its crown and its two buttons, forward
  P.push(cyl([0, yc, zc + R], [0, yc, zc + R + 0.05], 0.028, 0.028, 'chrome', 'gun', { n: 10 }));
  P.push(cyl([0, yc, zc + R + 0.05], [0, yc, zc + R + 0.075], 0.045, 0.045, 'chrome', 'gun', { n: 12 }));
  for (const s of [1, -1]) P.push(cyl([s * R * 0.62, yc, zc + R * 0.78], [s * R * 0.84, yc, zc + R * 1.0], 0.02, 0.02, 'chrome', 'gun', { n: 8 }));
  P.push(box([-0.08, C.hoodY - 0.02, zc - 0.08], [0.08, yc - 0.05, zc + 0.08], 'dark'));
  // the hands: they turn round its middle - back, as it rewinds
  P.push(box([-0.007, yc + 0.042, zc - 0.006], [0.007, yc + 0.05, zc + R * 0.76], 'hand', 'hands'));
  P.push(box([-0.009, yc + 0.044, zc - 0.009], [R * 0.52, yc + 0.052, zc + 0.009], 'hand', 'hands'));
  P.push(cyl([0, yc + 0.04, zc], [0, yc + 0.058, zc], 0.016, 0.016, 'accent', 'hands', { n: 8, noSil: true }));
  const pal = { case: hc || [0.86, 0.87, 0.9], chrome: CHROME, face: WHITE, dark: [0.12, 0.12, 0.14], hand: [0.1, 0.1, 0.12], accent: RED };
  return sheet('rewind', lines, ctx, o, {
    ax: 'y',
    c: yc + 0.04,
    prims: P,
    pivot: [0, yc, zc],
    pal,
    mats: { case: 'metal', chrome: 'metal' },
    groups: { hands: { at: [0, yc, zc], ax: 'y' } },
    box: [zc - R, zc + R, -R, R],
    focus: { at: [0, yc, zc], k: 0.5 },
    n: { lv: o.lv || 1 },
    traits: {},
  });
}

// ------------------------------------------------------------------ the Tesla coil
// (on the roof: its box, an insulator, the tall copper coil wound round, the chrome ring on top - the arcs
// come out of it only as it fires, game/gearweap.js; its ring glows as it charges)
function teslaDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof - 0.02;
  const zc = -0.25;
  const H = 0.62 + 0.08 * (lv - 1);
  P.push(box([-0.24, y0, zc - 0.22], [0.24, y0 + 0.13, zc + 0.22], 'dark'));
  P.push(box([-0.2, y0 + 0.13, zc - 0.18], [0.2, y0 + 0.15, zc + 0.18], 'steel', 'gun', { noSil: true }));
  P.push(tor([0, y0 + 0.17, zc], 0.17, 0.012, 'y', 'copper', 'gun', { noSil: true }));
  P.push(tor([0, y0 + 0.2, zc], 0.13, 0.012, 'y', 'copper', 'gun', { noSil: true }));
  P.push(cyl([0, y0 + 0.13, zc], [0, y0 + 0.24, zc], 0.07, 0.06, 'white', 'gun', { n: 12 }));
  P.push(cyl([0, y0 + 0.24, zc], [0, y0 + 0.24 + H, zc], 0.08, 0.075, 'copper', 'gun', { n: 16 }));
  const nw = 11;
  for (let i = 0; i < nw; i++) P.push(tor([0, y0 + 0.28 + (H - 0.08) * (i / (nw - 1)), zc], 0.08, 0.009, 'y', 'wind', 'gun', { noSil: true }));
  const yt = y0 + 0.24 + H + 0.07;
  P.push(cyl([0, y0 + 0.24 + H, zc], [0, yt, zc], 0.03, 0.03, 'chrome', 'gun', { n: 8 }));
  P.push(tor([0, yt, zc], 0.17 + 0.02 * lv, 0.07, 'y', 'chrome'));
  // (its charge: a glow round the ring, out as it charges and fires)
  P.push(tor([0, yt, zc], 0.17 + 0.02 * lv, 0.1, 'y', 'glow', 'charge', { noSil: true }));
  P.push(sph([0, yt, zc], 0.12, 'glow', 'charge', { noSil: true }));
  const pal = { dark: [0.12, 0.12, 0.14], steel: STEEL, copper: hc ? mix(hc, [0.78, 0.45, 0.2], 0.4) : [0.78, 0.45, 0.2], wind: [0.55, 0.3, 0.12], white: WHITE, chrome: CHROME, glow: [0.62, 0.86, 1] };
  return sheet('tesla', lines, ctx, o, {
    ax: 'z',
    c: zc + 0.25,
    prims: P,
    pivot: [0, yt, zc],
    pal,
    mats: { glow: 'glow', copper: 'metal', wind: 'metal' },
    groups: { charge: { at: [0, yt, zc], ax: 'y', kind: 'flame' } },
    focus: { at: [0, y0 + 0.5, zc], k: 0.18 },
    n: { lv, top: r3([0, yt, zc]) },
    traits: { h: Math.round(H * 100) / 100 },
  });
}

// ------------------------------------------------------------------ saws at the wheels
// (out of each wheel's hub: an arm, and a saw blade - its teeth all round - that spins out from the wheel as
// it cuts, game/gearweap.js; folded in against the wheel the while)
function sawsDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const r0 = ctx.r0 || 0.34;
  const spots = (ctx.spots || []).filter((q) => q.x > 0);
  const wz = spots.length ? spots.map((q) => q.z) : [-D.hl * 0.62, D.hl * 0.62];
  const xw = spots.length ? spots[0].x : D.hw - 0.2;
  const xb = Math.max(xw + 0.24, D.hw + 0.1);
  const Rs = r0 * [1.08, 1.12, 1.26][lv - 1];
  const P = [];
  const groups = {};
  const teeth = 22;
  const toothed = (cu, cw) => {
    const out = [];
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.62) / teeth) * Math.PI * 2;
      out.push([cu + Math.cos(a0) * Rs * 0.86, cw + Math.sin(a0) * Rs * 0.86]);
      out.push([cu + Math.cos(a1) * Rs, cw + Math.sin(a1) * Rs]);
    }
    return out;
  };
  for (let i = 0; i < wz.length; i++) {
    const z = wz[i];
    const g = `saw${i}`;
    groups[g] = { at: [xb, r0, z], ax: 'x', kind: 'spin' };
    P.push(cyl([xw, r0, z], [xb - 0.01, r0, z], 0.05, 0.05, 'dark', 'gun', { n: 10 }));
    P.push(slab('x', xb, toothed(z, r0), 0.022, 'blade', g, { edge: 1.6, res: 26 }));
    P.push(cyl([xb - 0.03, r0, z], [xb + 0.035, r0, z], 0.085, 0.085, 'hub', g, { n: 14 }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      P.push(slab('x', xb + 0.004, blade(z, r0, a, 0.12, Rs * 0.7, 0.05, 0.035), 0.026, 'slot', g, { noSil: true, edge: 1.5, res: 12 }));
    }
    P.push(sph([xb + 0.04, r0, z], 0.035, 'hub', g, { noSil: true }));
  }
  const pal = { dark: [0.12, 0.12, 0.14], blade: hc ? mix(hc, CHROME, 0.55) : [0.78, 0.8, 0.84], hub: [0.86, 0.12, 0.12], slot: [0.3, 0.31, 0.34] };
  return sheet('saws', lines, ctx, o, {
    ax: 'x',
    c: xb,
    prims: P,
    pivot: [xb, r0, 0],
    pal,
    mats: { blade: 'metal', hub: 'paint', slot: 'metal' },
    groups,
    mirror: true,
    box: [wz[0] - Rs, wz[0] + Rs, r0 - Rs, r0 + Rs],
    focus: { at: [D.hw, r0, wz[0]], k: 0.2 },
    n: { lv, R: Math.round(Rs * 100) / 100, xb: Math.round(xb * 100) / 100 },
    traits: { saws: wz.length * 2, teeth },
  });
}

// ------------------------------------------------------------------ the smoke screen
// (on the boot lid: a rack of short dischargers each side, angled up and back, their caps - a press of B
// and they pop their canisters out behind; the smoke is the canisters', not the car's: game/gearguard.js)
function smokeDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const D = C.D;
  const K = ctx.K;
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const yb = (K ? beltY(K, 0.08) : C.tailY + 0.3) + 0.02;
  const zb = -D.hl + 0.32;
  P.push(box([0, yb - 0.02, zb - 0.1], [Math.min(D.hw - 0.1, 0.62), yb + 0.06, zb + 0.12], 'rack'));
  const nt = lv >= 3 ? 4 : 3;
  for (let i = 0; i < nt; i++) {
    const x = 0.16 + i * 0.13;
    const p0 = [x, yb + 0.04, zb];
    const p1 = [x + 0.03, yb + 0.22, zb - 0.16];
    P.push(cyl(p0, p1, 0.052, 0.052, 'tube', 'gun', { n: 12 }));
    P.push(cyl(p1, [p1[0] + 0.004, p1[1] + 0.025, p1[2] - 0.022], 0.056, 0.056, 'cap', 'gun', { n: 12 }));
  }
  P.push(box([0.1, yb + 0.06, zb + 0.02], [0.1 + nt * 0.13, yb + 0.1, zb + 0.08], 'rack', 'gun', { noSil: true }));
  const pal = { rack: [0.2, 0.22, 0.2], tube: hc ? mix(hc, [0.3, 0.34, 0.26], 0.5) : [0.34, 0.38, 0.28], cap: [0.86, 0.16, 0.14] };
  return sheet('smoke', lines, ctx, o, {
    ax: 'z',
    c: zb - 0.2,
    prims: P,
    pivot: [0.3, yb + 0.12, zb - 0.1],
    pal,
    mirror: true,
    focus: { at: [0, yb + 0.1, zb - 0.2], k: 0.18 },
    n: { lv, tubes: nt * 2 },
    traits: { tubes: nt * 2 },
  });
}

// ------------------------------------------------------------------ the shield dome
// (on the roof: a little generator - its base, four emitters round a glowing core in its ring; a press of B
// and a dome of light stands round the car for a few seconds, game/gearguard.js)
function domeDesign(lines, ctx, o) {
  const C = carNums(ctx);
  const lv = o.lv || 1;
  const hc = hueOf(o.ink);
  const P = [];
  const y0 = C.roof - 0.02;
  const zc = -0.15;
  P.push(cyl([0, y0, zc], [0, y0 + 0.07, zc], 0.24, 0.22, 'base', 'gun', { n: 20 }));
  P.push(cyl([0, y0 + 0.07, zc], [0, y0 + 0.16, zc], 0.06, 0.05, 'base', 'gun', { n: 12 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x1 = Math.cos(a) * 0.2;
    const z1 = zc + Math.sin(a) * 0.2;
    P.push(cyl([Math.cos(a) * 0.12, y0 + 0.06, zc + Math.sin(a) * 0.12], [x1, y0 + 0.3, z1], 0.018, 0.014, 'rod', 'gun', { n: 8 }));
    P.push(sph([x1, y0 + 0.31, z1], 0.03, 'tip', 'gun'));
  }
  P.push(tor([0, y0 + 0.24, zc], 0.11, 0.018, 'y', 'rod'));
  P.push(sph([0, y0 + 0.24, zc], 0.075, 'core', 'core'));
  const pal = { base: [0.16, 0.17, 0.2], rod: CHROME, tip: hc || [0.45, 0.85, 1], core: hc || [0.45, 0.85, 1] };
  return sheet('dome', lines, ctx, o, {
    ax: 'z',
    c: zc + 0.3,
    prims: P,
    pivot: [0, y0 + 0.24, zc],
    pal,
    mats: { tip: 'glow', core: 'glow' },
    groups: { core: { at: [0, y0 + 0.24, zc], ax: 'y', kind: 'pulse' } },
    focus: { at: [0, y0 + 0.2, zc], k: 0.4 },
    n: { lv },
    traits: {},
  });
}

// ------------------------------------------------------------------ these
export const DESIGNS1 = { rotor: rotorDesign, turbo: turboDesign, jump: jumpDesign, rewind: rewindDesign, tesla: teslaDesign, saws: sawsDesign, smoke: smokeDesign, dome: domeDesign };

// (for the other sheets of designs - game/gearlook2.js, game/gearlook3.js)
export { STEEL, CHROME, RUBBER, NITRO, BLUEFLAME, HOTFLAME, WHITE, HAZARD, RED, GREEN, BLADE, lum, PAL, featOf, slab, cyl, box, sph, tor, blade, beltY, armsOf, hueOf, mix, lerp, r2, r3, rect, circ, boxOf, carNums, clamp };
