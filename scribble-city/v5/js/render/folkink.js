import { FACE, JK, PT, TORSO_Y, Hand, smooth, blob, regionOf } from './heroink.js';
import { FOLK, SKINS, IRIS } from './folkspec.js';

// (v5, ROADMAP 13.6) The city's people drawn as the hero is (render/heroink.js): each of them a portrait
// in coloured pencil - their face, their hair, what they wear over and under, their trousers or their
// dress, their shoes - painted from their spec (render/folkspec.js) on the same layouts as his
// pictures (FACE, JK, PT; the boots' round the foot), so their bodies (render/folkshapes.js) wear them
// as he wears his. Each drawn a few times over, by the same hand, every stroke a little different: they
// boil as he does (render/heroart.js).

const specOf = (o) => (typeof o.spec === 'number' ? FOLK[o.spec] : o.spec);

// ------------------------------------------------------------------ the face's shape in tone
// where the face is in shadow whatever the light - as the hero's (heroink.js faceTone), the jaw a
// woman's or a man's
export function folkTone(x, y, fem, sh = null) {
  const ax = Math.abs(x);
  // (ROADMAP 13.6: the face's own shape - full cheeks lit, hollow ones deeper; a heavy jaw's corners)
  const full = sh ? sh.cheeks || 0 : 0;
  const jaw = sh ? sh.jaw || 1 : 1;
  let t = 0;
  t += (fem ? 0.42 : 0.55) * blob(ax, y, 0.032, 0.024, 0.021, 0.011); // the sockets
  t += (fem ? 0.22 : 0.4) * blob(ax, y, 0.031, 0.031, 0.02, 0.0055); // under the brow
  t += 0.38 * blob(ax, y, 0.0115, 0.002, 0.0045, 0.022); // the sides of the nose
  t += 0.45 * blob(x, y, 0, -0.032, 0.013, 0.0045); // under the nose
  t += (fem ? 0.26 : 0.4) * Math.max(0.15, 1 - 0.75 * full) * blob(ax, y, 0.05, -0.034, 0.013, 0.026); // the hollows of the cheeks
  t += 0.4 * blob(ax, y, 0.066, 0.032, 0.012, 0.03); // the temples
  t += 0.42 * blob(x, y, 0, -0.066, 0.016, 0.0055); // under the lower lip
  t += 0.55 * smooth(0.05, 0.076, ax) * (1 - smooth(-0.11, -0.13, y)); // round the sides
  // under the jawline, from its angles down to the chin: the neck in its shade
  const jx = fem ? 0.046 : 0.052;
  if (ax < jx) {
    const yj = (fem ? -0.102 : -0.108) + (Math.max(0.018, ax) - 0.018) * (fem ? 0.75 : 1.0);
    t += 0.78 * smooth(yj + 0.003, yj - 0.016, y) * (1 - smooth(-0.14, -0.16, y));
  }
  if (y < -0.12) {
    t += 0.3 * smooth(-0.115, -0.14, y);
    t += 0.5 * smooth(fem ? 0.026 : 0.03, fem ? 0.05 : 0.058, ax);
    const k = Math.max(0, Math.min(1, (-0.13 - y) / 0.1));
    const mx = 0.05 + (0.014 - 0.05) * k;
    t += 0.3 * blob(ax, y, mx + 0.008, y, 0.006, 1);
    if (!fem) t += 0.28 * blob(x, y, 0, -0.172, 0.007, 0.006);
    t += 0.6 * smooth(-0.2, -0.235, y);
  }
  t += 0.32 * smooth(0.066, 0.09, y); // the hair's shadow on the forehead
  if (!fem) t += (0.3 + 0.5 * Math.max(0, jaw - 1)) * blob(ax, y, 0.047, -0.079, 0.012, 0.016); // the jaw's corners
  // (a round full face: its sides turning away soft and wide)
  if (full > 0) t += 0.2 * full * smooth(0.055, 0.075, ax) * (1 - smooth(-0.1, -0.12, y));
  return Math.min(1, t);
}

// where a beard grows: 'shadow' the five o'clock's (the hero's stubble, sparer), 'short' a close beard
// over the jaw and the cheeks' lower half with a clean line, 'trim' a neat one (the moustache joined to
// it round the mouth)
export function folkBeard(x, y, kind) {
  if (!kind) return 0;
  const ax = Math.abs(x);
  // (a moustache alone: thick over the upper lip, down a little past its corners)
  if (kind === 'mustache') {
    const top = -0.029 - 0.004 * smooth(0.008, 0.026, ax);
    const bot = -0.0465 - 0.007 * smooth(0.018, 0.03, ax);
    return Math.max(0, Math.min(1, smooth(top + 0.002, top - 0.003, y) * smooth(bot - 0.002, bot + 0.002, y) * (1 - smooth(0.029, 0.034, ax))));
  }
  const lift = kind === 'shadow' ? 0 : kind === 'short' ? 0.012 : 0.006;
  const edge = (ax > 0.066 ? 0.026 : ax > 0.052 ? -0.022 + ((ax - 0.052) / 0.014) * 0.048 : ax > 0.03 ? -0.04 + ((ax - 0.03) / 0.022) * 0.018 : -0.041) + lift * smooth(0.02, 0.05, ax);
  let s = smooth(edge + 0.003, edge - 0.006, y);
  if (ax < 0.027 && y < -0.033 && y > -0.045) s = Math.max(s, 0.95 * smooth(0.027, 0.019, ax) * smooth(-0.033, -0.036, y));
  if (ax < 0.025 && y < -0.045 && y > -0.062) s *= 0.05 + 0.95 * smooth(0.019, 0.025, ax);
  s *= 1 - smooth(0.074, 0.086, ax);
  s *= smooth(kind === 'shadow' ? -0.168 : -0.15, kind === 'shadow' ? -0.14 : -0.128, y);
  return Math.max(0, Math.min(1, s));
}

// ------------------------------------------------------------------ the face
/**
 * A portrait in pencil, the head seen from the front: o.spec (render/folkspec.js, or its number),
 * o.seed (this drawing's dice), o.blink (the eyes shut).
 */
export function paintFolkFace(c, o = {}) {
  const P = specOf(o);
  const S = SKINS[P.skin];
  const fem = !!P.fem;
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const H = c.height;
  const K = W / FACE.W;
  const s = K / 4000;
  const X = (x) => W / 2 - x * K;
  const Y = (y) => H / 2 - (y - FACE.YC) * K;
  const xm = (px) => (W / 2 - px) / K;
  const ym = (py) => (H / 2 - py) / K + FACE.YC;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  const age = P.lines || 0;
  // (ROADMAP 13.6) how they look: a smile lifts the mouth's corners and the cheeks, narrows the eyes
  const ex = P.expr || 'neutral';
  const smile = { neutral: 0, soft: 0.35, half: 0.5, smile: 0.85, laugh: 1 }[ex] || 0;
  const gape = ex === 'laugh' ? 1 : ex === 'smile' ? 0.3 : 0;
  // (as many strokes in a smaller picture, each smaller: the same drawing)
  const N = (n) => n;
  // ---- the skin; its pencil grain
  g.globalAlpha = 1;
  g.fillStyle = S.base;
  g.fillRect(0, 0, W, H);
  h.hatch(0, 0, W, H, N(4200), () => 0.8, 1.05, 30, 1.6, S.grain, 0.32, 0.5);
  h.hatch(0, 0, W, H, N(2000), () => 0.6, -0.55, 24, 1.4, S.grain, 0.22, 0.5);
  // the warmth: the cheeks (rosier made up), the nose, the ears' side
  const blush = 0.6 + (P.blush || 0) * 0.9;
  h.hatch(0, 0, W, H, N(900 + 600 * (P.blush || 0)), (px, py) => {
    const x = xm(px);
    const y = ym(py);
    return 0.7 * blush * blob(Math.abs(x), y, 0.044, -0.008, 0.019, 0.016) + 0.6 * blob(x, y, 0, -0.018, 0.009, 0.012) + 0.4 * smooth(0.06, 0.075, Math.abs(x));
  }, 0.9, 26, 1.8, S.warm, 0.32);
  // the neck in the jaw's shadow: a warm dark laid over it first, deepest right under the jaw
  {
    const [nr, ng, nb] = S.neck;
    const ya = Y(fem ? -0.096 : -0.1);
    const yb = Y(-0.245);
    const gr = g.createLinearGradient(0, ya, 0, yb);
    gr.addColorStop(0, `rgba(${nr},${ng},${nb},0)`);
    gr.addColorStop(0.12, `rgba(${nr},${ng},${nb},${fem ? 0.48 : 0.6})`);
    gr.addColorStop(0.4, `rgba(${nr},${ng},${nb},${fem ? 0.32 : 0.42})`);
    gr.addColorStop(1, `rgba(${Math.round(nr * 0.7)},${Math.round(ng * 0.7)},${Math.round(nb * 0.7)},0.6)`);
    g.fillStyle = gr;
    g.fillRect(0, ya, W, yb - ya);
  }
  // ---- the shadows: the warm dark first, then the cool across it, deepest where it is deepest
  const tone = (px, py) => folkTone(xm(px), ym(py), fem, P.shape);
  const neckK = (py) => smooth(-0.112, -0.132, ym(py));
  const soft = fem ? 0.8 : 1;
  h.hatch(0, 0, W, H, N(7600), (px, py) => tone(px, py) * 1.15 * soft * (1 - neckK(py)), 1.0, 28, 1.8, S.sh1, 0.55);
  h.hatch(0, 0, W, H, N(6200), (px, py) => (tone(px, py) - 0.2) * 1.5 * soft * (1 - neckK(py)), -0.65, 24, 1.7, S.sh2, 0.5);
  h.hatch(0, 0, W, H, N(3600), (px, py) => (tone(px, py) - 0.5) * 2.2 * soft * (1 - neckK(py)), 0.25, 20, 1.9, S.sh3, 0.55);
  h.hatch(0, 0, W, H, N(fem ? 1400 : 2400), (px, py) => tone(px, py) * neckK(py), 1.38, fem ? 24 : 34, 1.7, S.sh1, fem ? 0.24 : 0.36, 0.3);
  h.hatch(0, 0, W, H, N(fem ? 600 : 1100), (px, py) => (tone(px, py) - 0.4) * 1.6 * neckK(py), 1.18, 30, 1.7, S.sh2, fem ? 0.3 : 0.42, 0.3);
  // the light: the forehead's middle, the bridge of the nose, the cheekbones' tops, the chin (and on
  // a made-up face, the light on the cheekbones a little more)
  h.hatch(0, 0, W, H, N(1500 + (fem ? 500 : 0)), (px, py) => {
    const x = xm(px);
    const y = ym(py);
    const ax = Math.abs(x);
    return 0.6 * blob(x, y, 0, 0.055, 0.03, 0.014) + 0.75 * blob(x, y, 0, 0.004, 0.0055, 0.022) + (fem ? 0.7 : 0.5) * blob(ax, y, 0.045, 0.008, 0.014, 0.007) + 0.4 * blob(x, y, 0, -0.088, 0.012, 0.007);
  }, 1.05, 24, 1.6, S.light, 0.42);
  // the city's light caught in the drawing: pink along one side, blue along the other
  h.hatch(0, 0, W, H, N(900), (px, py) => 0.5 * smooth(0.04, 0.065, xm(px)) * (1 - smooth(-0.2, -0.235, ym(py))), 1.15, 30, 1.6, ['#e0709a', '#d860a8', '#f0909a'], 0.28);
  h.hatch(0, 0, W, H, N(900), (px, py) => 0.5 * smooth(-0.04, -0.065, xm(px)) * (1 - smooth(-0.2, -0.235, ym(py))), 1.15, 30, 1.6, ['#5a8ad8', '#6aa0e0', '#7a70d0'], 0.28);
  // ---- freckles: across the nose and the tops of the cheeks
  if (P.freckles) {
    for (let i = 0; i < N(520) * P.freckles; i++) {
      const x = (R() - 0.5) * 0.11;
      const y = -0.022 + R() * 0.04;
      const d = blob(Math.abs(x), y, 0.026, 0.0, 0.032, 0.016);
      if (R() > d) continue;
      g.globalAlpha = 0.35 + 0.35 * R();
      g.fillStyle = h.pick(['#a8603e', '#b8704a', '#9a5434', '#c48058']);
      g.beginPath();
      g.arc(X(x), Y(y), (1 + R() * 1.6) * s * 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  // ---- the beard: short dark hairs growing down and out along the jaw (grey ones in a grey beard)
  if (P.beard) {
    const kind = P.beard;
    const B = P.beardCol || ['#22160f', '#2c1e16', '#1a120c'];
    const st = (px, py) => folkBeard(xm(px), ym(py), kind);
    const growth = kind === 'mustache' ? (px) => Math.PI / 2 + Math.sign(xm(px)) * (0.25 + Math.abs(xm(px)) * 14) : (px, py) => Math.PI / 2 + xm(px) * 9 * (ym(py) > -0.07 ? 1 : 0.4);
    const dens = kind === 'shadow' ? 0.55 : kind === 'short' || kind === 'mustache' ? 1.0 : 0.9;
    // (a beard's mass first: its shade under the hairs)
    if (kind !== 'shadow') h.hatch(0, 0, W, H, N(5200), (px, py) => st(px, py) * 0.95, 1.3, 16, 2.0, B, 0.42, 0.6);
    h.hatch(0, 0, W, H, N(2200), (px, py) => st(px, py) * 0.85 * dens, 1.25, 20, 1.6, ['#6a5a6a', '#5a4a58', '#7a6a70'], 0.26);
    h.ticks(0, 0, W, H, N(kind === 'shadow' ? 16000 : 34000), (px, py) => st(px, py) * 0.62 * dens, growth, kind === 'shadow' ? 3.6 : kind === 'mustache' ? 7.5 : 5.6, kind === 'shadow' ? 1.1 : kind === 'mustache' ? 1.7 : 1.4, B, kind === 'shadow' ? 0.6 : 0.82, 0.7);
    if (kind !== 'shadow') h.ticks(0, 0, W, H, N(9000), (px, py) => st(px, py) * 0.5, growth, 2.4, 1.5, B.slice(-2), 0.7, 1.5);
  }
  // ---- the eyes
  const E = P.eyes;
  const iris = IRIS[E.iris] || IRIS.brown;
  for (const sd of [1, -1]) {
    const cx = X(sd * 0.032);
    const cy = Y(0.0185);
    const ew = 0.0262 * K * (fem ? 1.03 : 1);
    const eh = 0.0064 * K * (E.open || 1) * (fem ? 1.1 : 1) * (1 - 0.16 * smile);
    const lid = E.lid ?? 0.5;
    // (the inner corner by the nose, a touch lower; the outer a touch higher - lifted on a woman's eye)
    const ix = cx + sd * ew * 0.5;
    const iy = cy + 0.06 * eh;
    const ox = cx - sd * ew * 0.5;
    const oy = cy - (fem ? 0.32 : 0.18) * eh;
    const upK = 0.78 + 0.22 * (1 - lid);
    const up = (t) => [ix + (ox - ix) * t, iy + (oy - iy) * t - Math.sin(Math.PI * Math.pow(t, fem ? 0.8 : 0.85)) * eh * upK];
    const lo = (t) => [ix + (ox - ix) * t, iy + (oy - iy) * t + Math.sin(Math.PI * Math.pow(t, 1.1)) * eh * (0.58 - 0.24 * smile)];
    const NE = 14;
    const upper = [];
    const lower = [];
    for (let i = 0; i <= NE; i++) {
      upper.push(up(i / NE));
      lower.push(lo(i / NE));
    }
    // the lid's skin over the eye, in shade - a woman's lid coloured (her shadow); the crease over it
    const crease = upper.slice(2, NE).map(([x, y], i) => [x - sd * ew * 0.02, y - eh * (0.62 + 0.22 * Math.sin(((i + 2) / NE) * Math.PI)) * (1.2 - 0.4 * lid)]);
    h.hatch(Math.min(ix, ox) - 10 * s, cy - eh * 2.4, Math.max(ix, ox) + 10 * s, cy, 260, (px, py) => {
      const t = Math.max(0, Math.min(1, (px - ix) / (ox - ix)));
      const [, yl] = up(t);
      return py < yl && py > yl - eh * 1.15 ? 0.85 : 0;
    }, 0.95, 14, 1.4, S.sh1, 0.6);
    if (E.shadow) {
      h.hatch(Math.min(ix, ox) - 14 * s, cy - eh * 2.8, Math.max(ix, ox) + 14 * s, cy, 320, (px, py) => {
        const t = Math.max(0, Math.min(1, (px - ix) / (ox - ix)));
        const [, yl] = up(t);
        return py < yl && py > yl - eh * 1.6 ? 0.7 * (0.5 + 0.5 * t) : 0;
      }, 0.9, 14, 1.6, [E.shadow, E.shadow, '#6a4a4a'], 0.45);
    }
    if (o.blink) {
      // shut: the lid down to the lower line, its lashes down, a crease over it
      const shut = lower.map(([x, y], i) => [x, y - eh * 0.28 * Math.sin((i / NE) * Math.PI)]);
      h.lines(shut, 3.2 + (E.liner || 0) * 1.6, '#1c120e', 0.95, 2, 0.8);
      for (let i = 3; i < NE; i += 1) {
        const [x, y] = shut[i];
        h.line(x, y, x - sd * 3 * s, y + (6 + 4 * (E.lashes || 0)) * s, 1.3, '#1c120e', 0.8, 0.3);
      }
      if (!E.mono) h.lines(crease.map(([x, y]) => [x, y + eh * 0.5]), 1.5, '#5a3a30', 0.6, 2, 0.8);
      continue;
    }
    // the white of it, not white: warm, shaded under the lid
    g.save();
    g.beginPath();
    g.moveTo(upper[0][0], upper[0][1]);
    for (const [x, y] of upper) g.lineTo(x, y);
    for (let i = NE; i >= 0; i--) g.lineTo(lower[i][0], lower[i][1]);
    g.closePath();
    g.globalAlpha = 1;
    g.fillStyle = P.skin === 'deep' ? '#b8a698' : '#d0c2b4';
    g.fill();
    g.clip();
    h.hatch(cx - ew, cy - eh * 1.5, cx + ew, cy + eh, 160, (px, py) => 0.4 + 0.6 * smooth(cy + eh * 0.2, cy - eh * 0.9, py), 0.3, 10, 1.3, ['#9a8476', '#8a7a78', '#a89080'], 0.5);
    // the iris: its strokes out from the pupil; the pupil; the light in it
    const irx = cx + sd * 0.0012 * K;
    const iry = cy - eh * 0.05;
    const ir = 0.0054 * K * (fem ? 1.04 : 1);
    g.globalAlpha = 1;
    g.fillStyle = iris[1];
    g.beginPath();
    g.arc(irx, iry, ir, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 64; k++) {
      const a = R() * Math.PI * 2;
      const r0 = ir * (0.3 + 0.15 * R());
      const r1 = ir * (0.75 + 0.25 * R());
      h.line(irx + Math.cos(a) * r0, iry + Math.sin(a) * r0, irx + Math.cos(a) * r1, iry + Math.sin(a) * r1, 1.3, h.pick(iris), 0.75, 0.1);
    }
    g.globalAlpha = 0.9;
    g.strokeStyle = '#1e140c';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.arc(irx, iry, ir, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = '#0c0705';
    g.beginPath();
    g.arc(irx, iry, ir * 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff8ee';
    g.beginPath();
    g.arc(irx - ir * 0.32, iry - ir * 0.38, ir * 0.17, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.6;
    g.beginPath();
    g.arc(irx + ir * 0.3, iry + ir * 0.25, ir * 0.07, 0, Math.PI * 2);
    g.fill();
    // (the lid's shadow over the top of it)
    h.hatch(cx - ew, cy - eh * 1.4, cx + ew, cy + eh, 120, (px, py) => smooth(cy - eh * 0.1, cy - eh * (0.85 - 0.3 * (1 - lid)), py), 0.15, 12, 1.6, ['#3a241c', '#4a3028'], 0.5);
    g.restore();
    // the upper lid's line - heavier with liner, a little wing out past the corner; its lashes
    const liner = E.liner || 0;
    h.lines(upper, 4.2 + liner * 2.4, '#140a08', 0.95, 2, 0.9);
    h.path([upper[NE], [ox - sd * (7 + liner * 9) * s, oy - (1.5 + liner * 5) * s]], 2.4 + liner * 1.6, '#160c0a', 0.88, 0.5);
    const lash = E.lashes || 0;
    for (let i = 4; i < NE; i++) {
      const [x, y] = upper[i];
      const out = -sd * (0.4 + i / NE);
      const L = 6 + lash * 7 * (0.5 + i / NE);
      h.line(x, y, x + out * (5 + lash * 3) * s, y - L * s, 1.3 + lash * 0.5, '#140a08', 0.85, 0.4);
    }
    // (the crease over the lid - or, with no crease, the fold of the lid at the inner corner)
    if (!E.mono) h.lines(crease, 1.7, '#5a3830', 0.6, 2, 1);
    else h.path([[ix - sd * 2 * s, iy - eh * 0.2], [ix - sd * ew * 0.12, iy - eh * 0.75], [ix - sd * ew * 0.3, iy - eh * 1.0]], 1.4, '#6a4436', 0.45, 0.6);
    // the pink of its inner corner, the wet line along the lower lid
    g.globalAlpha = 0.75;
    g.fillStyle = '#d08a80';
    g.beginPath();
    g.ellipse(ix - sd * 2.2 * s * 4, iy + eh * 0.05, 3.2 * s * 4 * 0.35, eh * 0.32, 0, 0, Math.PI * 2);
    g.fill();
    h.path(lower.slice(3, NE - 2).map(([x, y]) => [x, y - eh * 0.12]), 1.1, '#f4e2d6', 0.35, 0.5);
    h.path(lower.slice(2), 1.3 + liner * 0.6, liner > 0.3 ? '#2a1a16' : '#6a4436', 0.6, 0.6);
    if (lash > 0.5) for (let i = 6; i < NE; i += 2) {
      const [x, y] = lower[i];
      h.line(x, y, x - sd * 2 * s, y + 4 * s, 1.0, '#2a1a16', 0.55, 0.3);
    }
    // the bag under it, the crow's feet at its corner (with the years)
    h.path(lower.slice(3, NE - 1).map(([x, y]) => [x, y + eh * 0.85]), 1.2, S.sh1[0], 0.2 + 0.35 * age, 1);
    for (let k = 0; k < Math.round(1 + 3 * age + 2 * smile); k++) {
      const a = -0.5 + k * 0.4;
      const x0 = ox - sd * 6 * s;
      const y0 = oy + (k - 1) * 4 * s;
      h.line(x0, y0, x0 - sd * Math.cos(a) * 16 * s, y0 + Math.sin(a) * 10 * s, 1.1, S.sh1[0], 0.18 + 0.35 * age + 0.22 * smile, 0.3);
    }
  }
  // ---- the brows, drawn hair by hair - arched on a woman's face, low and straight on a man's
  const BR = P.brows;
  for (const sd of [1, -1]) {
    const arch = BR.arch ?? 0.3;
    const P0 = [sd * 0.013, 0.0322 + (fem ? 0.0015 : 0)];
    const P1 = [sd * 0.035, 0.0418 + arch * 0.004 + (fem ? 0.002 : 0)];
    const P2 = [sd * 0.057, 0.0336 + (fem ? 0.002 : 0)];
    const at = (t) => {
      const a = (1 - t) * (1 - t);
      const b = 2 * t * (1 - t);
      const c2 = t * t;
      return [a * P0[0] + b * P1[0] + c2 * P2[0], a * P0[1] + b * P1[1] + c2 * P2[1]];
    };
    const thick = 0.0068 * (BR.thick || 1);
    for (let k = 0; k < Math.round(340 * (BR.thick || 1)); k++) {
      const t = R();
      const [bx, by] = at(t);
      const [nx, ny] = at(Math.min(1, t + 0.02));
      const off = (R() - 0.5) * thick * (1 - t * (fem ? 0.75 : 0.6));
      const px = X(bx);
      const py = Y(by + off);
      let a = Math.atan2(Y(ny) - Y(by), X(nx) - X(bx));
      if (t < 0.25) a = -Math.PI / 2 + (sd > 0 ? -0.35 : 0.35) * (t / 0.25);
      const L = (0.0038 + 0.003 * R()) * K;
      h.line(px, py, px + Math.cos(a) * L, py + Math.sin(a) * L, (fem ? 1.3 : 1.6) + R(), h.pick(BR.col), 0.8, 0.35);
    }
  }
  // the furrow between the brows, the forehead's lines (with the years)
  if (!fem) for (const sd of [1, -1]) h.path([[X(sd * 0.005), Y(0.041)], [X(sd * 0.0045), Y(0.033)], [X(sd * 0.006), Y(0.028)]], 1.4, S.sh1[0], 0.2 + 0.3 * age, 0.8);
  for (const y of [0.054, 0.063, 0.071].slice(0, Math.round(age * 3))) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([X(-0.03 + (i / 8) * 0.06), Y(y + Math.sin(i * 0.9 + y * 300) * 0.0012)]);
    h.path(pts, 1.3, S.sh1[0], 0.22 + 0.2 * age, 1.2);
  }
  // ---- the nose: its bridge, the shade down its sides, the wings, the nostrils, the light on its tip
  const nw = P.head.nose || 1;
  for (const sd of [1, -1]) {
    h.lines([[X(sd * 0.0085 * nw), Y(0.027)], [X(sd * 0.0098 * nw), Y(0.008)], [X(sd * 0.0112 * nw), Y(-0.008)], [X(sd * 0.0142 * nw), Y(-0.018)]], 1.8, S.sh1[0], fem ? 0.4 : 0.6, 2, 1);
    h.hatch(X(sd * 0.007 * nw), Y(0.02), X(sd * 0.016 * nw), Y(-0.016), 220, () => (fem ? 0.5 : 0.75), 1.2, 14, 1.5, [S.sh1[0], S.sh2[0], S.sh1[1]], 0.45);
    const wx = sd * 0.0168 * nw;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = -0.9 + (i / 10) * 2.6;
      pts.push([X(wx + sd * Math.cos(a) * 0.0055 * nw), Y(-0.0262 + Math.sin(a) * 0.0058 * (fem ? 0.85 : 1))]);
    }
    h.lines(pts, 2.1, S.sh3[0], 0.7, 2, 0.8);
    g.save();
    g.translate(X(sd * 0.0085 * nw), Y(-0.0312));
    g.rotate(sd * 0.35);
    g.globalAlpha = 0.92;
    g.fillStyle = S.sh3[1];
    g.beginPath();
    g.ellipse(0, 0, 0.0041 * K * nw * (fem ? 0.85 : 1), 0.0021 * K, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  h.hatch(X(0.012 * nw), Y(-0.02), X(-0.012 * nw), Y(-0.034), 160, () => 0.6, 0.2, 12, 1.4, S.sh1, 0.45);
  h.hatch(X(0.004), Y(0.022), X(-0.004), Y(-0.019), 80, () => 0.8, Math.PI / 2, 18, 1.5, S.light, 0.5, 0.2);
  // ---- the mouth: its width, its lips' fullness and colour (lipstick: deeper, glossy) - and how
  // they look: a smile lifts its corners (one of them, a half-smile), a laugh opens it on the teeth
  {
    const M = P.mouth;
    const mw = 0.0245 * (M.w || 1) * (fem ? 0.92 : 1) * (1 + 0.1 * smile);
    const full = (M.full || 1) * (1 - 0.18 * smile);
    const cy = Y(-0.0522);
    const NM = 12;
    const at = (i, k = 1) => mw * k * (i / (NM / 2) - 1);
    const lift = (x) => {
      const u = Math.min(1, Math.abs(x) / mw);
      const side = ex === 'half' ? (x > 0 ? 1 : 0.12) : 1;
      return smile * side * 0.0062 * u * u;
    };
    const midY = (x) => {
      const u = Math.min(1, Math.abs(x) / mw);
      return -0.0522 - 0.0016 * u ** 3 * (1 - smile) + (fem ? 0.0006 * u * u : 0) + lift(x);
    };
    const opn = (x) => {
      const u = Math.min(1, Math.abs(x) / mw);
      return Math.max(0, 1 - u * u) ** 0.8;
    };
    const up = [];
    const upB = [];
    const loT = [];
    const low = [];
    for (let i = 0; i <= NM; i++) {
      const x = at(i);
      const u = Math.abs(x) / mw;
      const bow = Math.abs(x) < 0.008 ? 0.0012 * Math.cos((x / 0.008) * Math.PI) * (fem ? 1.6 : 1) : 0;
      up.push([X(x), Y(midY(x) + 0.0016 * u ** 3 * (1 - smile) + (0.0064 * full - 0.0045 * u * u * full) + bow * 0.5 - 0.0008 + gape * 0.0016 * opn(x))]);
      upB.push([X(x), Y(midY(x) + gape * 0.0016 * opn(x))]);
      loT.push([X(x), Y(midY(x) - gape * 0.0085 * opn(x))]);
    }
    for (let i = 0; i <= NM; i++) {
      const x = at(i, 0.86);
      low.push([X(x), Y(-0.0525 - 0.0072 * full * (1 - (x / (mw * 0.86)) ** 2) - gape * 0.0085 * opn(x) + lift(x) * 0.7)]);
    }
    const poly = (top, bot) => {
      g.beginPath();
      g.moveTo(top[0][0], top[0][1]);
      for (const [x, y] of top) g.lineTo(x, y);
      for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
      g.closePath();
    };
    if (gape > 0) {
      // the mouth open: its dark, the upper teeth, a glimpse of the lower ones
      g.globalAlpha = 1;
      g.fillStyle = '#3a1612';
      poly(upB, loT);
      g.fill();
      g.save();
      poly(upB, loT);
      g.clip();
      const tw = mw * 0.78;
      const ty = (x) => midY(x) + gape * 0.0016 * opn(x);
      g.fillStyle = '#f0e8dc';
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const x = -tw + (i / 10) * 2 * tw;
        const y = ty(x);
        if (i === 0) g.moveTo(X(x), Y(y));
        else g.lineTo(X(x), Y(y));
      }
      for (let i = 10; i >= 0; i--) {
        const x = -tw + (i / 10) * 2 * tw;
        g.lineTo(X(x), Y(ty(x) - 0.0034 * gape * (0.6 + 0.4 * opn(x))));
      }
      g.fill();
      for (let i = -3; i <= 3; i++) h.line(X(i * 0.0042), Y(ty(i * 0.0042)), X(i * 0.0042), Y(ty(i * 0.0042) - 0.003 * gape), 1, '#b8a898', 0.35, 0.1);
      if (gape > 0.6) {
        g.fillStyle = '#e2d8c8';
        g.beginPath();
        for (let i = 0; i <= 8; i++) {
          const x = -tw * 0.7 + (i / 8) * 1.4 * tw;
          const y = midY(x) - gape * 0.0085 * opn(x);
          if (i === 0) g.moveTo(X(x), Y(y));
          else g.lineTo(X(x), Y(y));
        }
        for (let i = 8; i >= 0; i--) {
          const x = -tw * 0.7 + (i / 8) * 1.4 * tw;
          g.lineTo(X(x), Y(midY(x) - gape * 0.0085 * opn(x) + 0.0016));
        }
        g.fill();
      }
      g.restore();
    }
    const [l1, l2] = M.lip;
    g.globalAlpha = M.lipstick ? 0.95 : 0.82;
    g.fillStyle = l1;
    poly(up, upB);
    g.fill();
    g.fillStyle = l2;
    poly(loT, low);
    g.fill();
    h.hatch(up[0][0], up[0][1] - 0.006 * K, up[NM][0], cy, 120, () => 0.7, 0.4, 10, 1.3, M.lipstick ? ['#6a1018', '#7a1820'] : [S.sh1[0], S.sh1[1]], 0.45);
    h.hatch(X(0.012), cy + 0.002 * K + gape * 0.0085 * K, X(-0.012), cy + 0.0058 * K * full + gape * 0.0085 * K, 60, () => 0.7, 0.05, 14, 1.6, M.lipstick ? ['#f08088', '#ff98a0'] : S.light, M.lipstick ? 0.55 : 0.4);
    // (the lips' fine lines, up and down them)
    for (let i = 0; i < 26; i++) {
      const x = (R() - 0.5) * 1.6 * mw;
      const lo2 = R() < 0.5;
      const y0 = lo2 ? midY(x) - gape * 0.0085 * opn(x) - 0.001 : midY(x) + 0.001;
      h.line(X(x), Y(y0), X(x + (R() - 0.5) * 0.001), Y(y0 + (lo2 ? -1 : 1) * 0.0032 * full), 0.9, M.lipstick ? '#6a1018' : S.sh1[1], 0.25, 0.2);
    }
    if (gape > 0) {
      h.lines(upB, 1.6, '#341a16', 0.7, 2, 0.8);
      h.lines(loT, 1.4, '#341a16', 0.55, 2, 0.8);
    } else h.lines(upB, 2.4, M.lipstick ? '#3a0a10' : '#341a16', 0.88, 2, 0.8);
    h.path(up, M.lipstick ? 1.6 : 1.2, M.lipstick ? '#7a1018' : S.sh1[0], 0.55, 0.6);
    if (M.lipstick) h.path(low, 1.2, '#7a1018', 0.45, 0.6);
    // (the corners of a smile pressed into the cheeks)
    if (smile > 0.2) {
      for (const sd of [1, -1]) {
        if (ex === 'half' && sd < 0) continue;
        const x = sd * mw * 1.02;
        h.path([[X(x), Y(midY(x) + 0.002)], [X(x + sd * 0.0035), Y(midY(x) - 0.0008)], [X(x + sd * 0.002), Y(midY(x) - 0.004)]], 1.4, S.sh1[0], 0.35 + 0.3 * smile, 0.6);
      }
    }
  }
  // the shade under the lower lip, the cleft of the chin, the folds from the nose to the mouth
  h.hatch(X(0.017), Y(-0.061), X(-0.017), Y(-0.07), 140, () => 0.7, 0.15, 14, 1.5, S.sh2, 0.45);
  if (!fem) h.path([[X(0.0005), Y(-0.083)], [X(-0.0005), Y(-0.092)]], 1.4, S.sh1[0], 0.35, 0.8);
  for (const sd of [1, -1]) {
    const sm = ex === 'half' && sd < 0 ? 0.15 : smile;
    h.lines([[X(sd * 0.0188), Y(-0.0215)], [X(sd * (0.0262 + 0.004 * sm)), Y(-0.034)], [X(sd * (0.0292 + 0.007 * sm)), Y(-0.048)], [X(sd * (0.0298 + 0.006 * sm)), Y(-0.06)]], 1.7 + 0.5 * sm, S.sh1[0], 0.2 + 0.4 * age + 0.35 * sm, 2, 1.1);
    // (the cheek lifted over it, lit)
    if (sm > 0.2) h.hatch(X(sd * 0.05), Y(-0.008), X(sd * 0.026), Y(-0.034), 90, () => 0.6 * sm, 1.0, 16, 1.6, S.light, 0.35);
  }
  // (a double chin: the fold under the chin, its shade)
  const dbl = (P.shape && P.shape.dbl) || 0;
  if (dbl > 0) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const x = -0.034 + (i / 10) * 0.068;
      pts.push([X(x), Y(-0.118 - 0.006 * (1 - (x / 0.034) ** 2))]);
    }
    h.lines(pts, 1.8, S.sh2[0], 0.45 * dbl, 2, 1);
    h.hatch(X(0.03), Y(-0.12), X(-0.03), Y(-0.134), 160, () => 0.6 * dbl, 0.1, 18, 1.6, S.sh1, 0.4);
  }
  for (const sd of [1, -1]) h.path([[X(sd * 0.0035), Y(-0.034)], [X(sd * 0.0052), Y(-0.0448)]], 1.1, S.sh1[0], 0.3, 0.6);
  g.globalAlpha = 1;
  return c;
}

// ------------------------------------------------------------------ the hair
// strands from the crown out (the picture's v), in the hair's own colours: long and smooth, combed
// back, or tight curls; silver ones through it with the years
export function paintFolkHair(c, o = {}) {
  const P = specOf(o);
  const HR = P.hair;
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const H = c.height;
  const s = W / 512;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  // (as many strokes whatever the picture's size: each smaller in a smaller one)
  const k = 1;
  g.globalAlpha = 1;
  g.fillStyle = HR.base;
  g.fillRect(0, 0, W, H);
  if (HR.style === 'curls') {
    // tight curls: little coils all over, dark, a lighter edge on each
    const coil = (cols, n, r0, a) => {
      for (let i = 0; i < n * k; i++) {
        const x = R() * W;
        const y = R() * H;
        const r = (r0 * (0.7 + 0.6 * R())) * s;
        const a0 = R() * Math.PI * 2;
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.125) {
          const an = a0 + t * Math.PI * 1.7;
          pts.push([x + Math.cos(an) * r * (1 - 0.3 * t), y + Math.sin(an) * r * (1 - 0.3 * t)]);
        }
        h.path(pts, 1.6 + R(), h.pick(cols), a * (0.6 + 0.4 * R()), 0.6);
      }
    };
    coil(HR.dark, 2600, 7, 0.85);
    coil(HR.mid, 1500, 6, 0.7);
    coil(HR.light, 500, 5, 0.55);
    g.globalAlpha = 1;
    return c;
  }
  if (HR.style === 'buzz') {
    // cut close: short fine hairs all over, down and back, grey through them
    const way = () => Math.PI / 2 + (R() - 0.5) * 0.7;
    h.ticks(0, 0, W, H, 30000 * k, () => 0.85, way, 4.2, 1.1, HR.dark, 0.7, 0.6);
    h.ticks(0, 0, W, H, 22000 * k, () => 0.8, way, 3.6, 1.0, HR.mid, 0.65, 0.6);
    h.ticks(0, 0, W, H, 12000 * k, () => 0.7, way, 3.2, 1.0, HR.light, 0.6, 0.6);
    g.globalAlpha = 1;
    return c;
  }
  const long = HR.style === 'long' || HR.style === 'bun';
  const strand = (cols, n, w, a, lo, hi, lit = null) => {
    for (let i = 0; i < n * k; i++) {
      const x = R() * W;
      const v0 = lo + R() * (hi - lo);
      if (lit && R() > lit(x / W, v0)) continue;
      const L = (long ? 0.3 + 0.5 * R() : 0.15 + 0.4 * R()) * H;
      const y0 = (1 - v0) * H;
      const wave = (R() - 0.5) * (22 + 30 * (HR.wave || 0)) * s;
      const pts = [];
      for (let q = 0; q <= 6; q++) {
        const t = q / 6;
        pts.push([x + Math.sin(t * Math.PI * (0.8 + R() * 0.4 + (HR.wave || 0))) * wave + t * (R() - 0.5) * 6 * s, y0 - t * L]);
      }
      h.path(pts, w * (0.7 + 0.6 * R()), h.pick(cols), a * (0.6 + 0.4 * R()), 0.8);
    }
  };
  strand(HR.dark, 1400, 2.6, 0.75, 0, 0.95);
  strand(HR.mid, 1200, 1.7, 0.7, 0, 0.95);
  strand(HR.light, 750, 1.2, 0.65, 0.1, 0.85, (u, v) => 0.4 + 0.6 * Math.exp(-(((v - 0.42) / 0.22) ** 2)));
  if (HR.grey > 0 && HR.grey < 1) strand(['#c8c6c2', '#dcdad6', '#b0aeaa'], 900 * HR.grey, 1.3, 0.7, 0.4, 0.95);
  // (the city's light in it, a little)
  strand(['#c0609a', '#d07aa8'], 60, 1.1, 0.28, 0.1, 0.8);
  strand(['#4aa8c8', '#5ab8d8'], 60, 1.1, 0.26, 0.1, 0.8);
  h.hatch(0, H * 0.82, W, H, 600 * k, () => 0.8, Math.PI / 2, 26, 2.2, HR.dark, 0.6, 0.6);
  g.globalAlpha = 1;
  return c;
}

// ------------------------------------------------------------------ cloth
// a fabric over the box of a region (px): its colour, its weave in short strokes, its sheen where
// sheen(u, v) asks; the stuff's own way (wool: fine and close, linen: slubbed and creased, crepe: smooth,
// nylon: smooth with a broad soft sheen, denim: its twill on the diagonal, cotton: plain; silk: glossy)
function fabric(h, x0, y0, x1, y1, area, ang, f, kind, sheen = () => 0.3) {
  const g = h.g;
  g.globalAlpha = 1;
  g.fillStyle = f.base;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const n = Math.round(area);
  const sh = (x, y) => sheen((x - x0) / (x1 - x0), (y - y0) / (y1 - y0));
  const mid = f.mid || [f.base];
  if (kind === 'denim') {
    // the twill: close diagonal strokes, light and dark, the threads' fade where it is worn
    h.hatch(x0, y0, x1, y1, n * 0.45, () => 0.85, ang + 0.78, 14, 1.3, f.dark, 0.42, 0.15);
    h.hatch(x0, y0, x1, y1, n * 0.3, () => 0.8, ang + 0.78, 12, 1.1, f.light, 0.4, 0.15);
    h.hatch(x0, y0, x1, y1, n * 0.12, (x, y) => sh(x, y), ang, 26, 3.5, f.light, 0.22, 0.3);
  } else if (kind === 'linen') {
    h.hatch(x0, y0, x1, y1, n * 0.3, () => 0.8, ang, 22, 1.5, mid, 0.42, 0.5);
    // (its slubs: short thick strokes here and there along the weave)
    h.hatch(x0, y0, x1, y1, n * 0.12, () => 0.7, ang + (h.R() < 0.5 ? 0 : Math.PI / 2), 7, 2.4, f.dark, 0.3, 0.2);
    h.hatch(x0, y0, x1, y1, n * 0.16, () => 0.8, ang - 0.8, 18, 1.3, f.dark, 0.3, 0.5);
    h.hatch(x0, y0, x1, y1, n * 0.14, (x, y) => 0.3 + 0.6 * sh(x, y), ang, 22, 1.4, f.light, 0.48, 0.4);
  } else if (kind === 'nylon' || kind === 'silk') {
    h.hatch(x0, y0, x1, y1, n * 0.32, () => 0.8, ang, 30, 1.8, mid, 0.42, 0.35);
    h.hatch(x0, y0, x1, y1, n * 0.2, () => 0.75, ang + 0.4, 24, 1.6, f.dark, 0.4, 0.35);
    // (the broad soft sheen, and a few bright strokes in it)
    h.hatch(x0, y0, x1, y1, n * 0.16, (x, y) => sh(x, y), ang, 48, 6, f.light, 0.18, 0.2);
    h.hatch(x0, y0, x1, y1, n * 0.1, (x, y) => sh(x, y) * 0.9, ang, 26, 1.5, f.light, 0.5, 0.25);
  } else {
    // wool, crepe, cotton: the weave close (wool's a little diagonal), the folds' light
    const close = kind === 'wool' ? 0.45 : kind === 'crepe' ? 0.38 : 0.34;
    h.hatch(x0, y0, x1, y1, n * close, () => 0.8, ang + (kind === 'wool' ? 0.6 : 0), kind === 'wool' ? 14 : 22, 1.4, mid, 0.42, 0.4);
    h.hatch(x0, y0, x1, y1, n * 0.2, () => 0.7, ang - 0.8, 20, 1.4, f.dark, 0.34, 0.45);
    h.hatch(x0, y0, x1, y1, n * 0.14, (x, y) => 0.25 + 0.6 * sh(x, y), ang, 22, 1.3, f.light, 0.4, 0.4);
  }
  // (the city's light in it: a few coloured strokes)
  h.hatch(x0, y0, x1, y1, n * 0.025, () => 0.6, ang, 20, 1.2, ['#5a6aa0', '#7a5aa8', '#a0507a'], 0.22, 0.4);
}

// a fold: a crease in the stuff's own darks, its light edge beside it
function crease(h, f, pts, w = 2) {
  const s = h.s;
  h.lines(pts, w, f.dark[0], 0.55, 2, 1.4);
  h.path(pts.map(([x, y]) => [x + 3 * s, y - 3 * s]), w * 0.8, f.light[0], 0.35, 1.4);
}

// a seam: its line, and a row of stitches beside it (a second row: a denim's double)
function seam(h, f, pts, dx, dy, stitch, twice = false) {
  const s = h.s;
  h.lines(pts, 1.8, f.dark[0], 0.7, 2, 1);
  if (stitch) {
    h.stitches(pts.map(([x, y]) => [x + dx * s, y + dy * s]), 1.2, stitch, 0.55);
    if (twice) h.stitches(pts.map(([x, y]) => [x + dx * 2.2 * s, y + dy * 2.2 * s]), 1.2, stitch, 0.5);
  }
}

// a button: its face, its rim, the light on it
function button(g, x, y, r, col, s) {
  g.globalAlpha = 0.95;
  g.fillStyle = col;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.6;
  g.strokeStyle = '#0a0806';
  g.lineWidth = 1.2 * s;
  g.stroke();
  g.globalAlpha = 0.7;
  g.fillStyle = '#f4ece0';
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
  g.fill();
}

// a fabric's kind for a garment
const STUFF = { blazer: null, bomber: 'nylon', denim: 'denim', shirt: 'cotton', tee: 'cotton', blouse: 'silk', dress: 'cotton', trousers: 'wool', chinos: 'cotton', jeans: 'denim', wide: 'crepe' };
const stuffOf = (f) => f.fabric || STUFF[f.kind] || 'cotton';

// the little flowers of a print, scattered over a box (px)
function flowers(h, x0, y0, x1, y1, n, f) {
  const g = h.g;
  const R = h.R;
  const s = h.s;
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0);
    const y = y0 + R() * (y1 - y0);
    const r = (5 + 5 * R()) * s;
    const col = h.pick(f.flower);
    g.globalAlpha = 0.85;
    g.fillStyle = col;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + R() * 0.3;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.45, r * 0.28, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#d8962a';
    g.beginPath();
    g.arc(x, y, r * 0.22, 0, Math.PI * 2);
    g.fill();
    // a leaf or two
    g.globalAlpha = 0.7;
    g.fillStyle = h.pick(['#6a7a3a', '#7a8a44', '#5a6a32']);
    const a = R() * Math.PI * 2;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, r * 0.55, r * 0.2, a, 0, Math.PI * 2);
    g.fill();
  }
}

// ------------------------------------------------------------------ what they wear over: JK's layout
/**
 * Their jacket (its body, sleeves, collar, front edges, chest pockets' flaps: JK): a blazer (wool,
 * linen, crepe), a bomber, a denim jacket.
 */
export function paintFolkTop(c, o = {}) {
  const P = specOf(o);
  const T = P.top;
  const kind = T.kind;
  const stuff = stuffOf(T);
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const s = W / 1024;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  // (as many strokes whatever the picture's size: each smaller in a smaller one)
  const k = 1;
  const stitch = T.stitch || (kind === 'blazer' ? null : T.dark[0]);
  const twice = kind === 'denim';
  // ---- the body (u round it: the front's middle at 0.5, the left side 0.25, the back 0 and 1)
  {
    const r = regionOf(c, JK.torso);
    const Y0 = TORSO_Y[0];
    const Y1 = TORSO_Y[1];
    const v = (y) => (y - Y0) / (Y1 - Y0);
    const Pt = (u, y) => [r.x(u), r.y(v(y))];
    const sheen = (u, vv) => {
      const near = (c0, w) => Math.exp(-(((u - c0) / w) ** 2));
      return 0.15 + 0.5 * (near(0.38, 0.06) + near(0.62, 0.06)) + 0.3 * (near(0.12, 0.05) + near(0.88, 0.05)) * (1 - vv) + 0.2 * near(0.5, 0.2) * vv;
    };
    fabric(h, r.x0, r.y0, r.x1, r.y1, 52000 * k, -Math.PI / 2 + 0.25, T, stuff, sheen);
    // the side seams, the back's middle, the yoke (a denim jacket's), the front panels
    for (const u of [0.25, 0.75]) seam(h, T, [Pt(u, Y0), Pt(u, 0.2), Pt(u, 0.4)], 5, 0, stitch, twice);
    if (kind !== 'bomber') seam(h, T, [Pt(0.0, Y0), Pt(0.0, 0.25), Pt(0.0, 0.45)], 4, 0, stitch, twice);
    if (kind === 'denim') {
      // the yoke across the chest and the back, the panels down from the pockets, the waistband
      for (const [ua, ub] of [[0.27, 0.73], [0.77, 1], [0, 0.23]]) {
        const pts = [];
        for (let i = 0; i <= 8; i++) pts.push(Pt(ua + (ub - ua) * (i / 8), 0.36 + 0.01 * Math.sin((i / 8) * Math.PI)));
        seam(h, T, pts, 0, 5, stitch, true);
      }
      for (const sd of [1, -1]) seam(h, T, [Pt(0.5 + sd * 0.085, 0.36), Pt(0.5 + sd * 0.09, 0.15), Pt(0.5 + sd * 0.092, -0.04)], sd * 5, 0, stitch, true);
      const band = [];
      for (let i = 0; i <= 16; i++) band.push(Pt(i / 16, -0.04));
      seam(h, T, band, 0, -5, stitch, true);
      for (const sd of [1, -1]) button(g, ...Pt(0.5 + sd * 0.16, -0.065), 6 * s, T.buttons, s);
    }
    if (kind === 'blazer') {
      // the darts down the front, the lapels laid back from the opening (their edge, the notch under
      // the collar, the roll's light), its buttons, the flap pockets at the hips, the breast pocket
      for (const sd of [1, -1]) {
        crease(h, T, [Pt(0.5 + sd * 0.11, 0.3), Pt(0.5 + sd * 0.115, 0.15), Pt(0.5 + sd * 0.112, 0.02)], 1.3);
        const top = Pt(0.5 + sd * 0.07, 0.445);
        const out = Pt(0.5 + sd * 0.115, 0.36);
        const notch = Pt(0.5 + sd * 0.095, 0.345);
        const tip = Pt(0.5 + sd * 0.042, 0.19);
        const lap = [top, out, notch, Pt(0.5 + sd * 0.1, 0.33), tip];
        // (the lapel's face: a little lighter, the cloth facing up)
        g.save();
        g.beginPath();
        g.moveTo(...Pt(0.5 + sd * 0.036, 0.445));
        for (const p2 of lap) g.lineTo(p2[0], p2[1]);
        g.lineTo(...Pt(0.5 + sd * 0.036, 0.19));
        g.closePath();
        g.clip();
        h.hatch(r.x0, r.y0, r.x1, r.y1, 1600 * k, () => 0.8, -0.6, 18, 1.4, T.light, 0.35, 0.3);
        g.restore();
        h.lines(lap, 2.2, T.dark[0], 0.85, 2, 0.8);
        h.lines([Pt(0.5 + sd * 0.044, 0.2), Pt(0.5 + sd * 0.04, 0.12), Pt(0.5 + sd * 0.036, Y0)], 1.6, T.dark[1], 0.5, 2, 0.8);
        // the flap pocket at the hip
        const [xa, ya] = Pt(0.5 + sd * 0.09, 0.062);
        const [xb, yb] = Pt(0.5 + sd * 0.17, 0.036);
        h.lines([[xa, ya], [xb, ya], [xb, yb], [xa, yb], [xa, ya]], 1.7, T.dark[0], 0.75, 2, 0.6);
        h.hatch(Math.min(xa, xb), yb, Math.max(xa, xb), yb + 7 * s, 90, () => 0.9, 0.1, 12, 1.4, T.dark, 0.5);
      }
      // the buttons: two on the left front, their holes on the right
      for (const y of [0.165, 0.09]) {
        button(g, ...Pt(0.5 - 0.05, y), 7 * s, T.buttons || '#2a2420', s);
        h.line(...Pt(0.5 + 0.045, y), ...Pt(0.5 + 0.03, y), 2, T.dark[0], 0.8, 0.1);
      }
      // the breast pocket's welt on the left of the chest, a pocket square peeping out of it
      const [wa, wy] = Pt(0.5 + 0.07, 0.315);
      const [wb] = Pt(0.5 + 0.13, 0.315);
      h.lines([[wa, wy], [wb, wy - 4 * s]], 2.2, T.dark[0], 0.8, 2, 0.6);
      if (T.square) {
        g.globalAlpha = 0.95;
        g.fillStyle = T.square;
        g.beginPath();
        g.moveTo(wa + 4 * s, wy);
        g.lineTo(wa + (wb - wa) * 0.3, wy - 22 * s);
        g.lineTo(wa + (wb - wa) * 0.5, wy - 8 * s);
        g.lineTo(wa + (wb - wa) * 0.72, wy - 20 * s);
        g.lineTo(wb - 4 * s, wy - 4 * s);
        g.closePath();
        g.fill();
        h.hatch(wa, wy - 24 * s, wb, wy, 80, () => 0.8, 0.9, 10, 1.3, ['#b0502a', '#f0a070'], 0.5);
      }
      // (a pinstripe in a fine wool)
      if (T.stripe) for (let u = 0.02; u < 1; u += 0.018) h.lines([Pt(u, Y0), Pt(u + 0.002, 0.2), Pt(u, 0.44)], 0.9, T.stripe, 0.32, 1, 0.6);
    }
    if (kind === 'bomber') {
      // the ribbed band at the hem; the front's zip lines; the slanted pockets; the puff of it
      const [, hy0] = Pt(0, -0.088);
      const [, hy1] = Pt(0, -0.045);
      g.globalAlpha = 1;
      g.fillStyle = T.rib;
      g.fillRect(r.x0, hy1, r.x1 - r.x0, hy0 - hy1);
      for (let x = r.x0; x < r.x1; x += 5 * s) h.line(x, hy1, x + R() * 2 * s, hy0, 1.4, R() < 0.5 ? T.dark[0] : T.mid[0], 0.6, 0.05);
      for (const sd of [1, -1]) {
        const a = Pt(0.5 + sd * 0.1, 0.13);
        const b = Pt(0.5 + sd * 0.14, 0.02);
        h.lines([a, b], 3, T.dark[0], 0.85, 2, 0.6);
        h.stitches([[a[0] + sd * 6 * s, a[1]], [b[0] + sd * 6 * s, b[1]]], 1.2, T.mid[0], 0.5);
      }
      for (let i = 0; i < 18; i++) {
        const u = 0.15 + R() * 0.7;
        if (Math.abs(u - 0.5) < 0.06) continue;
        const y = -0.03 + R() * 0.12;
        crease(h, T, [Pt(u - 0.04, y), Pt(u, y + 0.018), Pt(u + 0.04, y)], 1.8);
      }
    }
    // the creases at the waist, under the arms
    for (let i = 0; i < 12; i++) {
      const u = 0.18 + R() * 0.64;
      if (Math.abs(u - 0.5) < 0.06) continue;
      const y = 0.06 + R() * 0.1;
      const len = 0.03 + 0.04 * R();
      crease(h, T, [Pt(u - len, y + 0.01 * (R() - 0.5)), Pt(u, y + 0.012), Pt(u + len, y + 0.01 * (R() - 0.5))], stuff === 'linen' ? 2 : 1.5);
    }
    for (const sd of [1, -1]) for (let i = 0; i < 4; i++) {
      const u = 0.5 + sd * (0.2 + 0.05 * R());
      crease(h, T, [Pt(u, 0.41 - i * 0.02), Pt(u + sd * 0.03, 0.37 - i * 0.025)], 1.4);
    }
  }
  // ---- the sleeves: the upper (shoulder at v 0 to elbow at 1), the forearm (elbow to the cuff)
  for (const [key, cuff] of [['upper', false], ['fore', true]]) {
    const r = regionOf(c, JK[key]);
    const Pt = (u, vv) => [r.x(u), r.y(vv)];
    const sheen = (u, vv) => 0.2 + 0.5 * Math.exp(-(((u - 0.62) / 0.08) ** 2)) + 0.3 * Math.exp(-(((u - 0.12) / 0.06) ** 2)) * (cuff ? 1 - vv : vv);
    fabric(h, r.x0, r.y0, r.x1, r.y1, 16000 * k, 0.05, T, stuff, sheen);
    for (const u of [0.5, 0.0, 1.0]) seam(h, T, [Pt(u, 0), Pt(u, 0.5), Pt(u, 1)], u > 0.9 ? -5 : 5, 0, stitch, twice);
    const at = cuff ? 0.06 : 0.92;
    for (let i = 0; i < 9; i++) {
      const vv = at + (cuff ? 1 : -1) * R() * 0.22;
      const u0 = 0.55 + R() * 0.1;
      const u1 = 0.85 + R() * 0.1;
      crease(h, T, [Pt(u0, vv + 0.04 * (R() - 0.5)), Pt((u0 + u1) / 2, vv - 0.05), Pt(u1, vv + 0.04 * (R() - 0.5))], stuff === 'linen' ? 2 : 1.6);
    }
    if (!cuff) {
      const pts = [];
      for (let i = 0; i <= 10; i++) pts.push(Pt(i / 10, 0.06));
      seam(h, T, pts, 0, -5, stitch, twice);
      // (a bomber's pocket on the left sleeve: its zip, its pull)
      if (kind === 'bomber') {
        const [xa, ya] = Pt(0.62, 0.22);
        const [xb, yb] = Pt(0.82, 0.48);
        h.lines([[xa, ya], [xb, ya], [xb, yb], [xa, yb], [xa, ya]], 1.8, T.dark[0], 0.8, 2, 0.6);
        h.lines([[xa + 6 * s, ya + 10 * s], [xb - 6 * s, ya + 10 * s]], 2.4, '#3a3a36', 0.9, 2, 0.4);
        button(g, xb - 10 * s, ya + 10 * s, 4 * s, T.buttons, s);
      }
    } else {
      // the cuff: a blazer's three buttons at the back of the wrist; a bomber's rib; a denim's band
      if (kind === 'blazer') for (let i = 0; i < 3; i++) button(g, ...Pt(0.25 + i * 0.045, 0.88), 4.5 * s, T.buttons || '#2a2420', s);
      else if (kind === 'bomber') {
        const [, y0] = Pt(0, 0.84);
        const [, y1] = Pt(0, 1);
        g.globalAlpha = 1;
        g.fillStyle = T.rib;
        g.fillRect(r.x0, y1, r.x1 - r.x0, y0 - y1);
        for (let x = r.x0; x < r.x1; x += 5 * s) h.line(x, y1, x + R() * 2 * s, y0, 1.4, R() < 0.5 ? T.dark[0] : T.mid[0], 0.6, 0.05);
      } else {
        const top = [];
        for (let i = 0; i <= 10; i++) top.push(Pt(i / 10, 0.84));
        seam(h, T, top, 0, 5, stitch, true);
        button(g, ...Pt(0.25, 0.92), 6 * s, T.buttons, s);
      }
    }
  }
  // ---- the collar: a blazer's of its cloth (its felt under); a bomber's rib; a denim's
  {
    const r = regionOf(c, JK.collar);
    if (kind === 'bomber') {
      g.globalAlpha = 1;
      g.fillStyle = T.rib;
      g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      for (let x = r.x0; x < r.x1; x += 5 * s) h.line(x, r.y0, x + R() * 2 * s, r.y1, 1.4, R() < 0.5 ? T.dark[0] : T.mid[0], 0.6, 0.05);
    } else fabric(h, r.x0, r.y0, r.x1, r.y1, 8000 * k, 0.1, T, stuff, (u, vv) => 0.25 + 0.5 * vv);
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([r.x(i / 12), r.y(0.86)]);
    if (stitch) h.stitches(pts, 1.3, stitch, 0.6);
    const fold0 = [];
    for (let i = 0; i <= 12; i++) fold0.push([r.x(i / 12), r.y(0.06)]);
    h.lines(fold0, 2.4, T.dark[0], 0.8, 2, 1);
  }
  // ---- the front edges (along the picture's x: from the hem up to the collar) and the flaps
  {
    const r = regionOf(c, JK.edge);
    fabric(h, r.x0, r.y0, r.x1, r.y1, 5000 * k, 0, T, stuff, (u, vv) => 0.35 + 0.4 * vv);
    if (kind === 'bomber') {
      // the zip: its teeth down the edge, metal; the lining's colour along the inside
      g.globalAlpha = 0.9;
      g.fillStyle = T.lining;
      g.fillRect(r.x0, r.y(0.15), r.x1 - r.x0, r.y(0) - r.y(0.15));
      for (let x = r.x0; x < r.x1; x += 6 * s) {
        g.fillStyle = R() < 0.5 ? '#8a8a84' : '#b8b8b0';
        g.fillRect(x, r.y(0.62), 3.5 * s, r.y(0.42) - r.y(0.62));
      }
    } else if (kind === 'denim') {
      const a = [];
      const b = [];
      for (let i = 0; i <= 12; i++) {
        a.push([r.x(i / 12), r.y(0.25)]);
        b.push([r.x(i / 12), r.y(0.78)]);
      }
      h.stitches(a, 1.2, stitch, 0.6);
      h.stitches(b, 1.2, stitch, 0.6);
      for (let i = 1; i < 6; i++) button(g, r.x(0.08 + i * 0.15), r.y(0.5), 6 * s, T.buttons, s);
    } else {
      const a = [];
      for (let i = 0; i <= 12; i++) a.push([r.x(i / 12), r.y(0.7)]);
      h.path(a, 1.1, T.dark[1], 0.45, 0.4);
    }
  }
  {
    const r = regionOf(c, JK.flap);
    fabric(h, r.x0, r.y0, r.x1, r.y1, 3000 * k, 0, T, stuff, (u, vv) => 0.3 + 0.5 * vv);
    const m = 8 * s;
    if (kind === 'denim') {
      // a pointed flap, stitched twice round, its button
      const mx = (r.x0 + r.x1) / 2;
      h.lines([[r.x0 + m, r.y0 + m], [r.x1 - m, r.y0 + m], [r.x1 - m, r.y1 - m * 2.5], [mx, r.y1 - m], [r.x0 + m, r.y1 - m * 2.5], [r.x0 + m, r.y0 + m]], 1.8, T.dark[0], 0.8, 2, 0.6);
      h.stitches([[r.x0 + m * 1.6, r.y0 + m * 1.6], [r.x1 - m * 1.6, r.y0 + m * 1.6], [r.x1 - m * 1.6, r.y1 - m * 3], [mx, r.y1 - m * 1.8], [r.x0 + m * 1.6, r.y1 - m * 3], [r.x0 + m * 1.6, r.y0 + m * 1.6]], 1.2, stitch, 0.6);
      button(g, mx, r.y1 - m * 3.2, 6 * s, T.buttons, s);
    } else h.lines([[r.x0 + m, r.y1 - m], [r.x1 - m, r.y1 - m]], 2.2, T.dark[0], 0.8, 2, 0.6);
  }
  g.globalAlpha = 1;
  return c;
}

// ------------------------------------------------------------------ and under, below: PT's layout
/**
 * Their trousers or their dress, and what is seen of their shirt in the jacket's opening (PT): the
 * thighs, the shins (bare legs under a dress), the seat, the front (the shirt, the tee, the blouse, the
 * dress's bodice; the belt), the pocket (a dress's skirt is drawn over the thighs' place).
 */
export function paintFolkBottom(c, o = {}) {
  const P = specOf(o);
  const B = P.bottom;
  const I = P.inner;
  const S = SKINS[P.skin];
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const s = W / 1024;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  // (as many strokes whatever the picture's size: each smaller in a smaller one)
  const k = 1;
  const stuff = stuffOf(B);
  const dress = B.kind === 'dress';
  for (const key of ['thigh', 'shin', 'pelvis', 'pocket']) {
    const r = regionOf(c, PT[key]);
    // (as many strokes as the hero's trousers have there: its share of the picture's)
    const area = ((r.x1 - r.x0) * (r.y1 - r.y0) * 60000) / (W * W);
    const Pt = (u, vv) => [r.x(u), r.y(vv)];
    if (dress && key === 'shin') {
      // bare legs under the dress: the skin, its grain, shaded round the shin, the ankle's bones
      g.globalAlpha = 1;
      g.fillStyle = S.base;
      g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      h.hatch(r.x0, r.y0, r.x1, r.y1, area * 0.3 * k, () => 0.8, Math.PI / 2 + 0.2, 24, 1.5, S.grain, 0.32, 0.5);
      h.hatch(r.x0, r.y0, r.x1, r.y1, area * 0.3 * k, (x) => 0.2 + 0.7 * Math.abs(Math.sin(((x - r.x0) / (r.x1 - r.x0)) * Math.PI * 2)) ** 3, Math.PI / 2, 26, 1.6, S.sh1, 0.4, 0.4);
      h.hatch(r.x0, r.y0, r.x1, r.y1, area * 0.15 * k, (x) => Math.exp(-((((x - r.x0) / (r.x1 - r.x0) - 0.75) / 0.08) ** 2)), Math.PI / 2, 26, 1.5, S.light, 0.4, 0.3);
      continue;
    }
    fabric(h, r.x0, r.y0, r.x1, r.y1, area * k, Math.PI / 2 + 0.15, B, stuff, (u) => 0.3 + 0.5 * Math.exp(-(((u - 0.75) / 0.12) ** 2)));
    if (dress) {
      // the skirt (drawn over the thighs' place): its print, its folds falling from the waist
      if (key === 'thigh' || key === 'pelvis') flowers(h, r.x0, r.y0, r.x1, r.y1, Math.round(380 * k * (key === 'thigh' ? 1 : 0.4)), B);
      if (key === 'thigh') {
        for (let i = 0; i < 26; i++) {
          const u = R();
          crease(h, B, [Pt(u, 0.02), Pt(u + 0.01 * (R() - 0.5), 0.45), Pt(u + 0.02 * (R() - 0.5), 0.95)], 1.6 + R());
        }
        const hem = [];
        for (let i = 0; i <= 16; i++) hem.push(Pt(i / 16, 0.97));
        h.lines(hem, 2, B.dark[0], 0.7, 2, 1);
        h.stitches(hem.map(([x, y]) => [x, y + 6 * s]), 1.1, B.dark[1], 0.45);
      }
      continue;
    }
    const twice = B.kind === 'jeans';
    const stitch = B.stitch || (B.kind === 'jeans' ? '#c08840' : null);
    for (const u of [0.5, 0.0, 1.0]) seam(h, B, [Pt(u, 0), Pt(u, 0.5), Pt(u, 1)], u > 0.9 ? -5 : 5, 0, stitch, twice);
    if (key === 'thigh' || key === 'shin') {
      // a pressed crease down the front; the knee's and the crotch's folds; a jean's whiskers
      if (B.crease) h.lines([Pt(0.75, 0), Pt(0.75, 0.5), Pt(0.75, 1)], 1.4, B.light[0], 0.5, 2, 0.6);
      const n = key === 'thigh' ? 10 : 7;
      for (let i = 0; i < n; i++) {
        const u = R();
        const vv = key === 'thigh' ? R() * 0.35 : 0.02 + R() * 0.12;
        crease(h, B, [Pt(u, vv), Pt(u + 0.03, vv + 0.08), Pt(u + 0.05, vv + 0.18)], 1.5);
      }
      if (B.kind === 'jeans' && key === 'thigh') for (let i = 0; i < 9; i++) {
        const vv = 0.05 + R() * 0.12;
        h.lines([Pt(0.66 + R() * 0.04, vv), Pt(0.75, vv + 0.03), Pt(0.84 - R() * 0.04, vv + 0.01)], 1.4, B.light[1], 0.45, 1, 1);
      }
      if (key === 'shin') {
        // the hem: a chino's turned-up cuff, a trouser's break over the shoe, a wide leg's fall
        if (B.cuff) {
          const a = [];
          const b = [];
          for (let i = 0; i <= 12; i++) {
            a.push(Pt(i / 12, 0.86));
            b.push(Pt(i / 12, 0.97));
          }
          h.lines(a, 2.2, B.dark[0], 0.8, 2, 0.8);
          h.lines(b, 1.6, B.dark[1], 0.6, 2, 0.8);
        }
        const lengthwise = B.kind === 'wide';
        for (let i = 0; i < (lengthwise ? 16 : 10); i++) {
          const u = R();
          if (lengthwise) crease(h, B, [Pt(u, 0.2 + R() * 0.2), Pt(u + 0.01, 0.6), Pt(u + 0.02 * (R() - 0.5), 0.98)], 1.8);
          else {
            const vv = 0.8 + R() * 0.15;
            crease(h, B, [Pt(u - 0.06, vv), Pt(u, vv - 0.03), Pt(u + 0.06, vv + 0.01)], 1.6);
          }
        }
      }
    } else if (key === 'pelvis') {
      // the waistband round the top, its belt loops
      const pts = [];
      for (let i = 0; i <= 16; i++) pts.push(Pt(i / 16, 0.86));
      h.lines(pts, 1.6, B.dark[0], 0.6, 2, 0.6);
      if (P.belt) {
        g.globalAlpha = 0.95;
        g.fillStyle = P.belt.col;
        g.fillRect(r.x0, r.y(1), r.x1 - r.x0, r.y(0.86) - r.y(1));
      }
      if (B.kind === 'jeans') {
        // the back pockets' stitching
        for (const u of [0.12, 0.38]) {
          const [xa, ya] = Pt(u - 0.07, 0.75);
          const [xb, yb] = Pt(u + 0.07, 0.3);
          h.stitches([[xa, ya], [xb, ya], [xb, yb], [(xa + xb) / 2, yb + 12 * s], [xa, yb], [xa, ya]], 1.2, stitch, 0.6);
        }
      }
    }
  }
  // ---- the front: what they wear under the jacket, seen in its opening (the picture's x along it
  // from the jacket's hem up, y across); the belt across the bottom of it
  {
    const r = regionOf(c, PT.front);
    const Y0 = TORSO_Y[0];
    const Y1 = 0.48;
    const xAt = (y) => r.x((y - Y0) / (Y1 - Y0));
    const yAt = (u) => r.y(u);
    const istuff = stuffOf(I);
    fabric(h, r.x0, r.y0, r.x1, r.y1, 9000 * k, 0.1, I, istuff, (u, vv) => 0.3 + 0.4 * Math.exp(-(((vv - 0.5) / 0.3) ** 2)));
    if (I.kind === 'dress') flowers(h, r.x0, r.y0, r.x1, r.y1, Math.round(70 * k), I);
    for (let i = 0; i < 9; i++) {
      const y = 0.05 + R() * 0.36;
      crease(h, I, [[xAt(y), yAt(0.1 + R() * 0.2)], [xAt(y + 0.02), yAt(0.5)], [xAt(y + 0.01), yAt(0.75 + R() * 0.2)]], 1.3);
    }
    if (I.kind === 'shirt') {
      // the placket down the middle, its buttons; the open collar's points at the top
      h.lines([[xAt(0.0), yAt(0.5)], [xAt(0.42), yAt(0.5)]], 1.4, I.dark[0], 0.6, 2, 0.6);
      for (let y = 0.05; y < 0.36; y += 0.075) button(g, xAt(y), yAt(0.5), 3.4 * s, '#f4f2ee', s);
      for (const sd of [1, -1]) {
        const pts = [[xAt(0.48), yAt(0.5 + sd * 0.28)], [xAt(0.41), yAt(0.5 + sd * 0.06)], [xAt(0.455), yAt(0.5 + sd * 0.42)]];
        h.lines(pts, 1.8, I.dark[0], 0.8, 2, 0.6);
      }
      // (the throat in the open collar)
      g.globalAlpha = 1;
      g.fillStyle = S.base;
      g.beginPath();
      g.moveTo(xAt(0.48), yAt(0.32));
      g.lineTo(xAt(0.405), yAt(0.5));
      g.lineTo(xAt(0.48), yAt(0.68));
      g.fill();
      h.hatch(xAt(0.4), yAt(0.68), xAt(0.48), yAt(0.32), 120, () => 0.8, 0.2, 14, 1.4, S.sh1, 0.45);
    } else if (I.kind === 'tee') {
      // the crew neck's band at the top
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        pts.push([xAt(0.44 - 0.03 * Math.sin(u * Math.PI)), yAt(u)]);
      }
      h.lines(pts, 2.2, I.dark[0], 0.7, 2, 0.6);
      h.lines(pts.map(([x, y]) => [x + 6 * s, y]), 1.2, I.dark[1], 0.45, 2, 0.6);
    } else if (I.kind === 'blouse') {
      // its high round neck, a soft drape across it, the silk's light
      const pts = [];
      for (let i = 0; i <= 10; i++) pts.push([xAt(0.455 - 0.012 * Math.sin((i / 10) * Math.PI)), yAt(i / 10)]);
      h.lines(pts, 2, I.dark[0], 0.7, 2, 0.6);
      for (let i = 0; i < 6; i++) {
        const y = 0.2 + R() * 0.2;
        h.lines([[xAt(y), yAt(0.15)], [xAt(y - 0.03), yAt(0.5)], [xAt(y), yAt(0.85)]], 2.4, I.light[0], 0.35, 2, 1);
      }
    } else if (I.kind === 'dress') {
      // the bodice's V, its buttons; the sash at the waist
      for (const sd of [1, -1]) h.lines([[xAt(0.47), yAt(0.5 + sd * 0.4)], [xAt(0.36), yAt(0.5)]], 1.8, I.dark[0], 0.7, 2, 0.6);
      g.globalAlpha = 1;
      g.fillStyle = S.base;
      g.beginPath();
      g.moveTo(xAt(0.475), yAt(0.12));
      g.lineTo(xAt(0.37), yAt(0.5));
      g.lineTo(xAt(0.475), yAt(0.88));
      g.fill();
      for (let y = 0.1; y < 0.33; y += 0.06) button(g, xAt(y), yAt(0.5), 3.2 * s, '#f4e6c8', s);
    }
    // the belt across the bottom (a sash on a dress), its buckle
    if (P.belt) {
      g.globalAlpha = 1;
      g.fillStyle = P.belt.col;
      g.fillRect(xAt(-0.034), r.y0, xAt(0.0) - xAt(-0.034), r.y1 - r.y0);
      h.hatch(xAt(-0.034), r.y0, xAt(0.0), r.y1, 300, () => 0.8, Math.PI / 2, 14, 1.4, ['#2a2422', '#3a302c', '#0a0808'], 0.45);
      const bx0 = xAt(-0.03);
      const bx1 = xAt(-0.004);
      const by0 = yAt(0.82);
      const by1 = yAt(0.18);
      g.globalAlpha = 0.95;
      g.strokeStyle = P.belt.buckle;
      g.lineWidth = 5 * s;
      g.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
      h.lines([[xAt(-0.04), yAt(0.5)], [xAt(-0.088), yAt(0.5)]], 1.6, B.dark[0], 0.7, 2, 0.8);
    } else if (I.kind === 'dress') {
      h.lines([[xAt(0.0), yAt(0)], [xAt(0.0), yAt(1)]], 6, I.dark[0], 0.6, 2, 0.6);
      h.lines([[xAt(0.0), yAt(0.55)], [xAt(-0.08), yAt(0.62)], [xAt(-0.12), yAt(0.58)]], 4, I.dark[1], 0.7, 2, 0.6);
    }
  }
  g.globalAlpha = 1;
  return c;
}

// ------------------------------------------------------------------ the shoes
/**
 * Their shoes (u round the foot: 0 on top, 0.5 under it; v from the heel to the toe): oxfords, loafers,
 * sneakers, booties.
 */
export function paintFolkShoes(c, o = {}) {
  const P = specOf(o);
  const F = P.shoes;
  const g = c.getContext('2d', { willReadFrequently: true });
  const W = c.width;
  const H = c.height;
  const s = W / 512;
  const h = new Hand(g, o.seed || 1, s);
  const R = h.R;
  // (as many strokes whatever the picture's size: each smaller in a smaller one)
  const k = 1;
  const Pt = (u, v) => [u * W, (1 - v) * H];
  const kind = F.kind;
  g.globalAlpha = 1;
  g.fillStyle = F.base;
  g.fillRect(0, 0, W, H);
  const sheen = (x, y) => {
    const u = x / W;
    return 0.2 + 0.6 * Math.exp(-(((u - 0.82) / 0.08) ** 2)) + 0.6 * Math.exp(-(((u - 0.18) / 0.08) ** 2));
  };
  if (kind === 'loafer') {
    // suede: soft, stippled, no shine
    h.ticks(0, 0, W, H, 14000 * k, () => 0.8, () => R() * 6.3, 2.5, 1.6, [...F.dark, ...F.light], 0.5, 6);
    h.hatch(0, 0, W, H, 900 * k, (x, y) => sheen(x, y) * 0.6, Math.PI / 2, 30, 4, F.light, 0.2, 0.3);
  } else {
    h.hatch(0, 0, W, H, 2400 * k, () => 0.8, Math.PI / 2, 22, 1.6, F.dark, 0.38, 0.5);
    h.hatch(0, 0, W, H, 1200 * k, (x, y) => sheen(x, y), Math.PI / 2, kind === 'sneaker' ? 30 : 40, kind === 'sneaker' ? 2 : 5, F.light, kind === 'sneaker' ? 0.3 : 0.25, 0.2);
    if (kind !== 'sneaker') h.hatch(0, 0, W, H, 600 * k, (x, y) => sheen(x, y), Math.PI / 2, 22, 1.4, F.light, 0.55, 0.25);
  }
  // the toe's seam, the heel counter, the welt's stitching
  const cap = [];
  for (let i = 0; i <= 16; i++) cap.push(Pt(i / 16, 0.8 + 0.05 * Math.cos((i / 16) * Math.PI * 2)));
  if (kind !== 'bootie') h.lines(cap, 1.8, F.dark[0], 0.7, 2, 1);
  const heel = [];
  for (let i = 0; i <= 16; i++) heel.push(Pt(i / 16, 0.2 - 0.04 * Math.cos((i / 16) * Math.PI * 2)));
  h.lines(heel, 1.6, F.dark[0], 0.65, 2, 1);
  if (kind === 'oxford') {
    // closed lacing over the instep, the brogue's punched dots along the cap
    for (let i = 0; i < 5; i++) {
      const v = 0.36 + i * 0.05;
      h.line(...Pt(0.94, v), W, Pt(0.94, v)[1], 1.8, F.lace, 0.85, 0.1);
      h.line(0, Pt(0.06, v)[1], ...Pt(0.06, v), 1.8, F.lace, 0.85, 0.1);
    }
    for (let i = 0; i <= 30; i++) {
      const [x, y] = Pt(i / 30, 0.83 + 0.05 * Math.cos((i / 30) * Math.PI * 2));
      g.globalAlpha = 0.7;
      g.fillStyle = F.dark[0];
      g.beginPath();
      g.arc(x, y, 1.6 * s, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'loafer') {
    // the moc toe's seam round the top of the foot, the penny strap across it
    const moc = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      moc.push([W * (0.0 + 0.12 * Math.sin(a)), H * (1 - (0.55 + 0.35 * (i / 12)))]);
    }
    h.lines(moc, 1.8, F.dark[0], 0.7, 2, 0.8);
    h.lines(moc.map(([x, y]) => [W - x, y]), 1.8, F.dark[0], 0.7, 2, 0.8);
    for (const xx of [0, W]) h.stitches(moc.map(([x, y]) => [xx ? W - x - 4 * s : x + 4 * s, y]), 1.1, F.light[0], 0.5);
    g.globalAlpha = 0.9;
    g.fillStyle = F.dark[1];
    g.fillRect(0, Pt(0, 0.56)[1], W * 0.14, H * 0.06);
    g.fillRect(W * 0.86, Pt(0, 0.56)[1], W * 0.14, H * 0.06);
  } else if (kind === 'sneaker') {
    // the panels' seams, the side's stripes in its colour, the laces up the top, the toe's holes
    for (const u of [0.3, 0.7]) h.lines([Pt(u, 0.15), Pt(u, 0.45), Pt(u + (u < 0.5 ? 0.05 : -0.05), 0.75)], 1.4, F.dark[0], 0.5, 2, 1);
    for (const sd of [0.25, 0.75]) {
      for (const dv of [0, 0.06]) {
        const pts = [];
        for (let i = 0; i <= 8; i++) pts.push(Pt(sd + 0.03 * Math.sin((i / 8) * Math.PI) * (sd < 0.5 ? 1 : -1), 0.25 + dv + (i / 8) * 0.4));
        h.lines(pts, 5, F.accent, 0.85, 2, 0.6);
      }
    }
    for (let i = 0; i < 6; i++) {
      const v = 0.32 + i * 0.06;
      h.line(...Pt(0.93, v), W, Pt(0.93, v + 0.03)[1], 3, F.lace, 0.9, 0.1);
      h.line(0, Pt(0.07, v + 0.03)[1], ...Pt(0.07, v), 3, F.lace, 0.9, 0.1);
      h.line(...Pt(0.93, v), W, Pt(0.93, v + 0.03)[1], 1, F.dark[0], 0.4, 0.1);
    }
    for (let i = 0; i < 24; i++) {
      const [x, y] = Pt((R() < 0.5 ? R() * 0.12 : 1 - R() * 0.12), 0.84 + R() * 0.1);
      g.globalAlpha = 0.5;
      g.fillStyle = F.dark[0];
      g.beginPath();
      g.arc(x, y, 1.4 * s, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'bootie') {
    // the side zip, the shaft's seam, the shine down the toe
    for (const u of [0.36, 0.64]) h.lines([Pt(u, 0.02), Pt(u, 0.3)], 2.2, '#8a8a90', 0.7, 2, 0.4);
    h.hatch(0, Pt(0, 0.95)[1], W, Pt(0, 0.6)[1], 300 * k, (x) => Math.exp(-(((x / W - 0.5) / 0.3) ** 2)) * 0.6, Math.PI / 2, 20, 2, F.light, 0.5, 0.2);
  }
  // (the welt's stitching round the bottom)
  for (const u of [0.36, 0.64]) h.stitches([Pt(u, 0.02), Pt(u, 0.5), Pt(u, 0.98)], 1.2, kind === 'sneaker' ? F.dark[0] : F.light[0], 0.45);
  g.globalAlpha = 1;
  void R;
  return c;
}

// every picture by its name (render/heroworker.js draws them by name, with { folk })
export const FOLK_PAINTERS = { face: paintFolkFace, hair: paintFolkHair, jacket: paintFolkTop, pants: paintFolkBottom, boots: paintFolkShoes };
