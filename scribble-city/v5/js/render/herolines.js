import { TORSO, PELVIS_ROWS, UPPER_ROWS, FORE_ROWS, THIGH_ROWS, SHIN_ROWS, NECK_ROWS, NECK_Y, LOCKS, section, headSdf, headR, hairEdge, hairThick } from './heroshapes.js';
import { faceTone, stubble } from './heroink.js';

// (v5, ROADMAP 13.1) The hero drawn in lines, as his drawing is: over his body (render/heroshapes.js,
// the pictures of render/heroink.js) the strokes of a pencil that build him - the sketchy contours
// along his edges, drawn and drawn again; hatching round the form where it turns from the light,
// crossed where it is darkest; the creases of the leather and of the trousers; the lines of his hair;
// his eyes, his brows, his nose and his mouth in ink; his stubble; the city's neon caught on his edges
// in coloured pencil. Each stroke lies on his body, in a part's own frame, and goes where the part
// goes; which ones are drawn is worked out every frame from the light and from where you look at him
// (a hatching stroke only in the shade, a contour only where the form turns away). A dozen times a
// second every stroke is drawn again a little differently - the boil of a drawing done by hand.

// a stroke: its points (in its part's frame), its normal there, what kind it is, when it is drawn
// (thr), how it is drawn (w, a, col), whether only near (near)
const K = { feature: 0, contour: 1, hair: 2, fold: 3, rim: 4, hatch: 5, cross: 6, hairhi: 7, shine: 8 };
const ORDER = [K.feature, K.contour, K.hair, K.fold, K.shine, K.rim, K.hatch, K.hairhi, K.cross];

const INK = [0.045, 0.03, 0.026];
const LEATHER = [0.06, 0.042, 0.034];
const LEATHER_D = [0.02, 0.014, 0.012];
// (on dark leather and dark cloth the strokes that show are the light ones: its sheen, its wear)
const LEATHER_HI = [[0.55, 0.43, 0.36], [0.46, 0.36, 0.3], [0.62, 0.5, 0.42]];
const CLOTH_HI = [[0.44, 0.44, 0.5], [0.36, 0.36, 0.42], [0.5, 0.48, 0.55]];
const CLOTH = [0.04, 0.04, 0.05];
const CLOTH_D = [0.012, 0.012, 0.016];
const SEPIA = [0.36, 0.19, 0.12];
const SEPIA_D = [0.17, 0.085, 0.06];
const HAIR = [0.03, 0.02, 0.015];
const HAIR_HI = [0.46, 0.33, 0.23];
const RIM_NIGHT = [[1, 0.42, 0.72], [0.36, 0.86, 1], [0.72, 0.46, 1], [1, 0.55, 0.62]];
const RIM_DAY = [[1, 0.88, 0.66], [1, 0.95, 0.84], [0.98, 0.8, 0.6]];

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const hash = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

// ------------------------------------------------------------------ points on the lofted parts
// a section at height y (rows [y, w, df, db, z, n], ascending or descending): [w, df, db, z, n]
function rowsAt(rows, y, out) {
  let a = rows[0];
  let b = rows[rows.length - 1];
  for (let i = 0; i < rows.length - 1; i++) {
    if ((y - rows[i][0]) * (y - rows[i + 1][0]) <= 0) {
      a = rows[i];
      b = rows[i + 1];
      break;
    }
  }
  const t = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
  const D = [0, 0, 0, 0, 0, 2];
  for (let k = 1; k < 6; k++) out[k - 1] = (a[k] ?? D[k]) + ((b[k] ?? D[k]) - (a[k] ?? D[k])) * t;
  return out;
}
const _r = [0, 0, 0, 0, 0];
const _q = [0, 0];
// the point at height y, angle t (0 ahead, pi/2 its right in its frame), lifted off it; and its normal
function surf(rows, y, t, lift, out, nrm) {
  const [w, df, db, z, n] = rowsAt(rows, y, _r);
  section(t, w, df, db, n, _q);
  const x = _q[0];
  const zz = _q[1];
  const d = zz >= 0 ? df : db;
  let nx = (Math.sign(x) * Math.abs(x / w) ** (n - 1)) / w;
  let nz = (Math.sign(zz) * Math.abs(zz / d) ** (n - 1)) / d;
  const L = Math.hypot(nx, nz) || 1;
  nx /= L;
  nz /= L;
  out[0] = x + nx * lift;
  out[1] = y;
  out[2] = zz + z + nz * lift;
  if (nrm) {
    nrm[0] = nx;
    nrm[1] = 0;
    nrm[2] = nz;
  }
  return out;
}

// ------------------------------------------------------------------ points on the head
// the head's surface straight ahead of (x, y) (its front), and its normal
// (v5, ROADMAP 13.6) whose head, hair, face and body the strokes are made for: the hero's, or one of
// the city's people drawn as he is (render/folkshapes.js folkBody's lines) - set while they are made
let KIT = null;
function heroKit() {
  return {
    sdf: headSdf, headR, hairEdge, hairThick, locks: LOCKS, tone: faceTone, beard: stubble, fem: false,
    rows: { torso: TORSO, pelvis: PELVIS_ROWS, upper: UPPER_ROWS, fore: FORE_ROWS, thigh: THIGH_ROWS, shin: SHIN_ROWS, neck: NECK_ROWS },
    top: { ink: LEATHER, dark: LEATHER_D, hi: LEATHER_HI }, bottom: { ink: CLOTH, dark: CLOTH_D, hi: CLOTH_HI }, hair: HAIR, hairHi: HAIR_HI,
  };
}
function frontZ(x, y) {
  const headSdf = KIT.sdf;
  let lo = -0.02;
  let hi = 0.16;
  if (headSdf(x, y, lo) > 0) return null;
  for (let i = 0; i < 26; i++) {
    const m = (lo + hi) / 2;
    if (headSdf(x, y, m) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
function headNormal(x, y, z, out) {
  const e = 0.0015;
  const headSdf = KIT.sdf;
  out[0] = headSdf(x + e, y, z) - headSdf(x - e, y, z);
  out[1] = headSdf(x, y + e, z) - headSdf(x, y - e, z);
  out[2] = headSdf(x, y, z + e) - headSdf(x, y, z - e);
  const L = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] /= L;
  out[1] /= L;
  out[2] /= L;
  return out;
}
// a point of the face (head frame, from the front), lifted off the skin
function facePt(x, y, lift = 0.0015) {
  // (a real head's: found on its face where its drawing has the point - render/folkshapes.js)
  if (KIT.facePt) return KIT.facePt(x, y, lift);
  const z = frontZ(x, y);
  if (z === null) return null;
  const n = headNormal(x, y, z, [0, 0, 0]);
  return { p: [x + n[0] * lift, y + n[1] * lift, z + n[2] * lift], n };
}

// ------------------------------------------------------------------ the strokes of each part
class Part {
  constructor(name) {
    this.name = name;
    this.by = ORDER.map(() => []);
  }

  add(kind, pts, n, o = {}) {
    if (!pts || pts.length < 2 || pts.some((p) => !p)) return;
    const flat = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => flat.set(p, i * 3));
    const mid = pts[Math.floor(pts.length / 2)];
    // (ROADMAP 13.7: ex - how each of its points goes with the face's moves; eye - the iris of the
    // right eye (1) or the left (-1): it looks where the eye does, and is shut in with it)
    this.by[ORDER.indexOf(kind)].push({ kind, pts: flat, np: pts.length, n, mid, thr: o.thr ?? 1, w: o.w ?? 1.6, a: o.a ?? 0.8, col: o.col || INK, near: !!o.near, far: !!o.far, ex: o.ex || null, eye: o.eye || 0 });
  }
}

// a limb or a body: its hatching round the form, its crossing strokes along it, its contours, its
// coloured edge (opts: ya, yb the heights it spans; counts; the colours of its stuff)
function lofted(name, rows, o) {
  const P = new Part(name);
  const R = rng(o.seed);
  const n = [0, 0, 0];
  const lift = o.lift ?? 0.003;
  const span = o.yb - o.ya;
  // hatching round the form: short strokes across it, a little slanted
  for (let i = 0; i < o.hatch; i++) {
    const y = o.ya + R() * span;
    const t = R() * Math.PI * 2;
    const d = (o.arc ?? 0.2) * (0.7 + 0.6 * R());
    const sl = (R() - 0.5) * span * 0.05;
    const a = surf(rows, y - sl, t - d, lift, [0, 0, 0]);
    const m = surf(rows, y, t, lift, [0, 0, 0], n);
    const b = surf(rows, y + sl, t + d, lift, [0, 0, 0]);
    P.add(K.hatch, [a, m, b], n.slice(), { thr: 0.25 + 0.5 * R(), w: 1.3 + 0.5 * R(), a: 0.6 + 0.25 * R(), col: o.ink });
  }
  // the light strokes where the stuff turns to the light (its sheen), along the form
  for (let i = 0; i < (o.shine || 0); i++) {
    const y = o.ya + R() * span * 0.92;
    const t = R() * Math.PI * 2;
    const L = span * (0.07 + 0.12 * R());
    const a = surf(rows, y, t, lift + 0.0005, [0, 0, 0]);
    const b = surf(rows, Math.min(o.yb, Math.max(o.ya, y + (o.down ? -L : L))), t + (R() - 0.5) * 0.18, lift + 0.0005, [0, 0, 0], n);
    P.add(K.shine, [a, b], n.slice(), { thr: 0.42 + 0.45 * R(), w: 1.2 + 0.5 * R(), a: 0.55 + 0.3 * R(), col: o.hi[i % o.hi.length] });
  }
  // crossing strokes along it, where it is darkest
  for (let i = 0; i < o.cross; i++) {
    const y = o.ya + R() * span * 0.9;
    const t = R() * Math.PI * 2;
    const L = span * (0.08 + 0.1 * R());
    const a = surf(rows, y, t, lift, [0, 0, 0]);
    const b = surf(rows, Math.min(o.yb, Math.max(o.ya, y + (o.down ? -L : L))), t + (R() - 0.5) * 0.15, lift, [0, 0, 0], n);
    P.add(K.cross, [a, b], n.slice(), { thr: (o.crossThr ?? 0.12) + 0.28 * R(), w: 1.3, a: 0.75, col: o.dark });
  }
  // contours: lines along it all round, drawn where the form turns away from you - in pieces, a
  // little apart, each its own stroke
  const bands = o.bands ?? 3;
  for (let k = 0; k < o.around; k++) {
    const t = (k / o.around) * Math.PI * 2;
    for (let b = 0; b < bands; b++) {
      const y0 = o.ya + (span * b) / bands - span * 0.03;
      const y1 = o.ya + (span * (b + 1)) / bands + span * 0.03;
      const ym = (y0 + y1) / 2;
      const tt = t + (R() - 0.5) * 0.05;
      P.add(K.contour, [surf(rows, Math.max(o.ya, y0), tt, lift, [0, 0, 0]), surf(rows, ym, tt + 0.02, lift, [0, 0, 0], n), surf(rows, Math.min(o.yb, y1), tt, lift, [0, 0, 0])], n.slice(), { w: 2.3 + 0.6 * R(), a: 0.88, col: o.dark });
    }
  }
  // the coloured light on its edges
  for (let i = 0; i < o.rim; i++) {
    const y = o.ya + R() * span;
    const t = R() * Math.PI * 2;
    const L = span * (0.06 + 0.06 * R());
    const a = surf(rows, y, t, lift + 0.001, [0, 0, 0], n);
    const b = surf(rows, Math.min(o.yb, y + L), t + (R() - 0.5) * 0.2, lift + 0.001, [0, 0, 0]);
    P.add(K.rim, [a, b], n.slice(), { w: 1.4, a: 0.75, col: null });
  }
  // the creases: where it bends (each [y0, y1, t0, t1]: a curve across those)
  for (const [y0, y1, t0, t1, cnt] of o.folds || []) {
    for (let i = 0; i < cnt; i++) {
      const y = y0 + R() * (y1 - y0);
      const ta = t0 + R() * (t1 - t0) * 0.4;
      const tb = t1 - R() * (t1 - t0) * 0.4;
      const tm = (ta + tb) / 2;
      const a = surf(rows, y + (R() - 0.5) * 0.01, ta, lift, [0, 0, 0]);
      const m = surf(rows, y + (o.down ? 0.012 : -0.012), tm, lift + 0.001, [0, 0, 0], n);
      const b = surf(rows, y + (R() - 0.5) * 0.01, tb, lift, [0, 0, 0]);
      P.add(K.fold, [a, m, b], n.slice(), { w: 1.9 + 0.6 * R(), a: 0.85, col: o.dark });
    }
  }
  return P;
}

// the head: the face in ink, its shadows hatched, the stubble; the hair's lines; the locks'
function head() {
  const P = new Part('head');
  const R = rng(97);
  const { tone: faceTone, beard: stubble, headR, hairThick, hairEdge, locks: LOCKS, fem } = KIT;
  const HAIR = KIT.hair;
  const F = (x, y, lift) => facePt(x, y, lift);
  // (ROADMAP 13.7: a real head's face moves - its strokes with it, each point as the face there)
  const EX = KIT.faceEx;
  const line = (kind, xy, o) => {
    const pts = xy.map(([x, y]) => F(x, y, o.lift ?? 0.0015));
    if (pts.some((q) => !q)) return;
    const mid = pts[Math.floor(pts.length / 2)];
    let ex = null;
    if (EX) {
      ex = new Float32Array(xy.length * 24);
      xy.forEach(([x, y], i) => {
        const d = EX(x, y);
        if (d) ex.set(d, i * 24);
      });
    }
    P.add(kind, pts.map((q) => q.p), mid.n, ex ? { ...o, ex } : o);
  };
  for (const sd of [1, -1]) {
    // the eye: the upper lid heavy, the lower light, the iris, the crease over it
    line(K.feature, [[sd * 0.019, 0.0181], [sd * 0.027, 0.0226], [sd * 0.036, 0.0236], [sd * 0.0451, 0.0197]], { w: 2.7, a: 0.92 });
    line(K.feature, [[sd * 0.0195, 0.0178], [sd * 0.031, 0.0153], [sd * 0.045, 0.0192]], { w: 1.3, a: 0.6, near: true });
    line(K.feature, [[sd * 0.0325, 0.0207], [sd * 0.0329, 0.0168]], { w: 3.6, a: 0.95, col: [0.09, 0.055, 0.03], eye: sd });
    if (!KIT.mono) line(K.feature, [[sd * 0.021, 0.0262], [sd * 0.033, 0.0288], [sd * 0.0445, 0.0258]], { w: 1.4, a: 0.55, near: true, col: SEPIA_D });
    // the brow: its mass, then its hairs
    const bz = (t) => {
      const a = (1 - t) * (1 - t);
      const b = 2 * t * (1 - t);
      const c = t * t;
      const up = fem ? 0.0018 : 0;
      return [a * sd * 0.012 + b * sd * 0.035 + c * sd * 0.058, a * (0.0318 + up) + b * (0.0418 + up * 1.6) + c * (0.0338 + up)];
    };
    line(K.feature, [bz(0), bz(0.35), bz(0.7), bz(1)], { w: 3.4, a: 0.9 });
    for (let k = 0; k < 9; k++) {
      const t = (k + R()) / 9;
      const [x, y] = bz(t);
      const up = t < 0.25 ? 0.006 : 0.003;
      line(K.feature, [[x, y - 0.002], [x + sd * 0.004, y + up]], { w: 1.4, a: 0.85, near: true });
    }
    // the nose: its side, its wing, the shadow under it
    line(K.feature, [[sd * 0.0088, 0.026], [sd * 0.0105, 0.004], [sd * 0.0135, -0.016]], { w: 1.4, a: 0.45, col: SEPIA_D });
    const wing = [];
    for (let i = 0; i <= 4; i++) {
      const a = -0.6 + (i / 4) * 2.3;
      wing.push([sd * (0.0168 + Math.cos(a) * 0.0055), -0.0262 + Math.sin(a) * 0.0058]);
    }
    line(K.feature, wing, { w: 1.9, a: 0.75 });
    // the fold from the nose to the mouth
    line(K.feature, [[sd * 0.0188, -0.0215], [sd * 0.0262, -0.036], [sd * 0.0295, -0.055]], { w: 1.5, a: 0.5, col: SEPIA_D });
  }
  line(K.feature, [[-0.009, -0.031], [0, -0.0322], [0.009, -0.031]], { w: 2, a: 0.65 });
  // the mouth: the line between the lips, its corners a little down; the shade under the lower lip
  // (a smile lifts its corners - one of them, a half-smile; a laugh: the lips apart)
  const sm = KIT.smile || 0;
  const half = KIT.half ? 0.12 : 1;
  const cw = 0.0245 * (1 + 0.1 * sm);
  const my = (x) => -0.0522 - 0.0016 * (1 - sm) * (Math.abs(x) / cw) ** 3 + sm * (x > 0 ? 1 : half) * 0.0062 * (x / cw) ** 2;
  if (KIT.gape) {
    line(K.feature, [-1, -0.5, 0, 0.5, 1].map((u) => [u * cw, my(u * cw) + 0.0016 * KIT.gape * (1 - u * u)]), { w: 1.8, a: 0.8 });
    line(K.feature, [-0.8, -0.4, 0, 0.4, 0.8].map((u) => [u * cw, my(u * cw) - 0.0085 * KIT.gape * (1 - u * u) ** 0.8]), { w: 1.6, a: 0.7 });
  } else if (EX) {
    // (ROADMAP 13.7: a face that moves - the line between the lips drawn on each of them, as one
    // while the mouth is shut, apart when it opens)
    line(K.feature, [-1, -0.5, 0, 0.5, 1].map((u) => [u * cw, my(u * cw) + 0.0009]), { w: 1.9, a: 0.9 });
    line(K.feature, [-0.92, -0.5, 0, 0.5, 0.92].map((u) => [u * cw, my(u * cw) - 0.0013]), { w: 1.7, a: 0.8 });
  } else line(K.feature, [-1, -0.5, 0, 0.5, 1].map((u) => [u * cw, my(u * cw)]), { w: 2.6, a: 0.92 });
  line(K.feature, [[-0.011, -0.0635], [0, -0.0645], [0.011, -0.0635]], { w: 1.8, a: 0.5, col: SEPIA_D });
  // the forehead's lines, the furrow between the brows
  if (!fem) for (const y of [0.054, 0.063]) line(K.feature, [[-0.026, y], [0, y + 0.0012], [0.026, y]], { w: 1.2, a: 0.35, near: true, col: SEPIA_D });
  if (!fem) for (const sd of [1, -1]) line(K.feature, [[sd * 0.005, 0.04], [sd * 0.0048, 0.032]], { w: 1.2, a: 0.45, near: true, col: SEPIA_D });
  // the shadows of the face hatched: where faceTone has them, slanted strokes
  for (let i = 0; i < 90; i++) {
    const x = (R() - 0.5) * 0.15;
    const y = -0.11 + R() * 0.17;
    const tone = faceTone(x, y);
    if (tone < 0.35) continue;
    const L = 0.007 + 0.006 * R();
    line(K.hatch, [[x - L * 0.5, y - L * 0.35], [x + L * 0.5, y + L * 0.35]], { thr: 0.3 + 0.55 * tone, w: 1.3, a: 0.55, col: tone > 0.7 ? SEPIA_D : SEPIA });
  }
  // the stubble: short dark ticks along the jaw and the chin, over the lip
  for (let i = 0; i < 120; i++) {
    const x = (R() - 0.5) * 0.15;
    const y = -0.11 + R() * 0.08;
    if (stubble(x, y) < 0.6 || P.by[ORDER.indexOf(K.feature)].length > 400) continue;
    line(K.feature, [[x, y], [x + x * 0.04, y - 0.0028]], { w: 1.2, a: 0.7, near: true, col: KIT.beardInk || [0.08, 0.05, 0.04] });
  }
  // the hair's lines: strands from the crown out and down, over the cap of it
  const n = [0, 0, 0];
  const capPt = (th, phi, extra = 0.002) => {
    const dx = Math.sin(th) * Math.sin(phi);
    const dy = Math.cos(th);
    const dz = Math.sin(th) * Math.cos(phi);
    const r = headR(dx, dy, dz) + hairThick(th, phi) + extra;
    n[0] = dx;
    n[1] = dy;
    n[2] = dz;
    return [dx * r, dy * r, dz * r];
  };
  for (let i = 0; i < 170; i++) {
    const phi = R() * Math.PI * 2;
    const edge = hairEdge(phi);
    const th0 = R() * edge * 0.85;
    const th1 = Math.min(edge, th0 + 0.2 + 0.15 * R());
    const th2 = Math.min(edge, th1 + 0.18 + 0.12 * R());
    const wave = (R() - 0.5) * 0.35;
    const a = capPt(th0, phi);
    const b = capPt(th1, phi + wave);
    const m = n.slice();
    const c = capPt(th2, phi + wave * 1.6);
    P.add(R() < 0.82 ? K.hair : K.hairhi, [a, b, c], m, { w: 1.4 + 0.7 * R(), a: 0.85, col: null });
  }
  // the locks: along the middle of each, and along an edge of it
  for (const L of LOCKS) {
    P.add(K.hair, L.mid, L.n, { w: 2.0, a: 0.9, col: HAIR });
    P.add(K.hair, L.edge, L.n, { w: 1.3, a: 0.75, col: HAIR });
  }
  return P;
}

// the neck: hatched down its sides, the shadow under the jaw
function neck() {
  const P = lofted('neck', KIT.rows.neck, { seed: 61, ya: -0.17, yb: -0.02, hatch: 0, cross: 36, crossThr: 0.35, around: 12, bands: 2, rim: 8, ink: SEPIA, dark: SEPIA, down: true, lift: 0.0022 });
  void NECK_Y;
  return P;
}

// ------------------------------------------------------------------ the whole of him
export class HeroLines {
  // kit: whose they are (null: the hero's - see heroKit); fewer: the city's people's, a share of his
  constructor(touch = false, kit = null, fewer = 1) {
    this.touch = touch;
    KIT = kit || heroKit();
    const { TORSO, PELVIS_ROWS, UPPER_ROWS, FORE_ROWS, THIGH_ROWS, SHIN_ROWS } = { TORSO: KIT.rows.torso, PELVIS_ROWS: KIT.rows.pelvis, UPPER_ROWS: KIT.rows.upper, FORE_ROWS: KIT.rows.fore, THIGH_ROWS: KIT.rows.thigh, SHIN_ROWS: KIT.rows.shin };
    const jacket = { ink: KIT.top.ink, dark: KIT.top.dark };
    const cloth = { ink: KIT.bottom.ink, dark: KIT.bottom.dark };
    const LEATHER_HI = KIT.top.hi;
    const CLOTH_HI = KIT.bottom.hi;
    this.hair = KIT.hair;
    this.hairHi = KIT.hairHi;
    const S = (touch ? 0.55 : 1) * fewer;
    const c = (n) => Math.round(n * S);
    this.parts = {
      head: head(),
      neck: neck(),
      torso: lofted('torso', TORSO, { seed: 11, shine: c(170), hi: LEATHER_HI, ya: -0.085, yb: 0.47, hatch: c(250), cross: c(110), around: 28, bands: 4, rim: c(60), ...jacket, folds: [[0.0, 0.12, 0.6, 2.4, 4], [0.0, 0.12, 3.9, 5.7, 4], [0.32, 0.4, 1.2, 1.9, 4], [0.32, 0.4, 4.4, 5.1, 4], [0.05, 0.3, 2.6, 3.7, 4]] }),
      pelvis: lofted('pelvis', PELVIS_ROWS, { seed: 13, shine: c(30), hi: CLOTH_HI, ya: -0.12, yb: 0.06, hatch: c(50), cross: c(16), around: 16, bands: 2, rim: c(12), ...cloth, folds: [[-0.1, -0.05, 2.6, 3.7, 3]] }),
      upper: lofted('upper', UPPER_ROWS, { seed: 17, shine: c(55), hi: LEATHER_HI, ya: -0.33, yb: 0.02, hatch: c(70), cross: c(24), around: 14, bands: 3, rim: c(18), ...jacket, down: true, folds: [[-0.32, -0.26, -0.7, 0.7, 4], [0.0, 0.02, 0.0, 6.28, 2]] }),
      fore: lofted('fore', FORE_ROWS, { seed: 19, shine: c(50), hi: LEATHER_HI, ya: -0.25, yb: 0.03, hatch: c(60), cross: c(20), around: 14, bands: 3, rim: c(16), ...jacket, down: true, folds: [[-0.06, 0.0, -0.8, 0.8, 4], [-0.24, -0.19, 0.0, 6.28, 4]] }),
      thigh: lofted('thigh', THIGH_ROWS, { seed: 23, shine: c(55), hi: CLOTH_HI, ya: -0.5, yb: 0.05, hatch: c(70), cross: c(24), around: 14, bands: 4, rim: c(18), ...cloth, down: true, folds: [[-0.12, -0.02, 2.2, 4.1, 4], [-0.48, -0.42, 2.6, 3.7, 4]] }),
      shin: lofted('shin', SHIN_ROWS, { seed: 29, shine: c(50), hi: CLOTH_HI, ya: -0.44, yb: 0.03, hatch: c(60), cross: c(20), around: 14, bands: 4, rim: c(16), ...cloth, down: true, folds: [[-0.02, 0.03, -0.9, 0.9, 3], [-0.44, -0.37, 0.0, 6.28, 6]] }),
    };
    // (a dress: its skirt's strokes - over the thighs' place, render/folkshapes.js skirtGeo)
    if (KIT.skirt) this.parts.skirt = lofted('skirt', KIT.skirt, { seed: 31, shine: c(40), hi: CLOTH_HI, ya: -0.5, yb: 0.06, hatch: c(70), cross: c(24), around: 18, bands: 4, rim: c(16), ...cloth, down: true, folds: [[-0.5, -0.3, 0, 6.28, 6]] });
    KIT = null;
    // (which part each of his drawn parts is, and the matrix it was drawn with this frame)
    this.slots = {};
    this.budget = Math.round((touch ? 650 : 1500) * fewer);
    this._p = [0, 0, 0];
  }

  // the matrix a part was drawn with this frame (render/people.js drawHero: after it is pushed); a
  // face's moves this frame (ROADMAP 13.7: ex, as far as each is made - render/folkshapes.js EXPR)
  // and where its eyes look (gaze: [x, y], how far the iris goes on the ball)
  set(slot, part, m, ex = null, gaze = null) {
    let s = this.slots[slot];
    if (!s) s = this.slots[slot] = { part, e: new Float32Array(16), on: false, ex: null, gaze: null };
    s.e.set(m.elements);
    s.ex = ex;
    s.gaze = gaze;
    s.on = true;
  }

  // the strokes, into the lines of the figures (sink.lineXYZ). ctx: { cam, L (the light), Lr (the
  // coloured edge light), dark (0 day .. 1 night), t (seconds), dist (camera to him) }
  draw(sink, ctx) {
    const slots = Object.values(this.slots);
    if (!slots.length || ctx.dist > 16) {
      for (const s of slots) s.on = false;
      return;
    }
    const tick = Math.floor(ctx.t * 12);
    const cam = ctx.cam;
    const L = ctx.L;
    const Lr = ctx.Lr;
    const near = ctx.dist < 3.4;
    const mid = ctx.dist < 9;
    // (strokes thinner far off, so he is not all ink; bolder close up)
    const wk = Math.max(0.65, Math.min(1.25, 3.2 / Math.max(1, ctx.dist)));
    const rims = ctx.dark > 0.4 ? RIM_NIGHT : RIM_DAY;
    const rimA = 0.35 + 0.55 * ctx.dark;
    // (ROADMAP 13.7: the city's people's - as many strokes as their share of the frame's)
    const budget = ctx.budget !== undefined ? ctx.budget : this.budget;
    let left = budget;
    const P = this._p;
    for (let oi = 0; oi < ORDER.length && left > 0; oi++) {
      const kind = ORDER[oi];
      if (!mid && (kind === K.hatch || kind === K.cross || kind === K.rim || kind === K.hairhi || kind === K.shine)) continue;
      for (const s of slots) {
        if (!s.on) continue;
        const e = s.e;
        const list = this.parts[s.part].by[oi];
        for (let i = 0; i < list.length && left > 0; i++) {
          const st = list[i];
          if (st.near && !near) continue;
          // its normal and its middle, in the world
          const n = st.n;
          let nx = e[0] * n[0] + e[4] * n[1] + e[8] * n[2];
          let ny = e[1] * n[0] + e[5] * n[1] + e[9] * n[2];
          let nz = e[2] * n[0] + e[6] * n[1] + e[10] * n[2];
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl;
          ny /= nl;
          nz /= nl;
          const m = st.mid;
          const mx = e[0] * m[0] + e[4] * m[1] + e[8] * m[2] + e[12];
          const my = e[1] * m[0] + e[5] * m[1] + e[9] * m[2] + e[13];
          const mz = e[2] * m[0] + e[6] * m[1] + e[10] * m[2] + e[14];
          let vx = cam.x - mx;
          let vy = cam.y - my;
          let vz = cam.z - mz;
          const vl = Math.hypot(vx, vy, vz) || 1;
          vx /= vl;
          vy /= vl;
          vz /= vl;
          const f = nx * vx + ny * vy + nz * vz;
          const lit = 0.5 + 0.5 * (nx * L.x + ny * L.y + nz * L.z);
          let col = st.col;
          let a = st.a;
          if (kind === K.contour) {
            if (f < -0.12 || f > 0.34) continue;
          } else if (kind === K.shine) {
            if (f < 0.05 || lit < st.thr) continue;
          } else if (kind === K.hatch) {
            if (f < 0.05 || lit > st.thr) continue;
          } else if (kind === K.cross) {
            if (f < 0.05 || lit > st.thr) continue;
          } else if (kind === K.fold) {
            if (f < 0.08) continue;
          } else if (kind === K.rim) {
            if (f < 0.03 || f > 0.62 || nx * Lr.x + ny * Lr.y + nz * Lr.z < 0.2) continue;
            col = rims[i % rims.length];
            a *= rimA;
          } else if (kind === K.feature) {
            if (f < 0.12) continue;
          } else if (kind === K.hair) {
            if (f < -0.08) continue;
            if (!col) col = this.hair;
          } else if (kind === K.hairhi) {
            if (f < 0.05 || lit < 0.55) continue;
            col = this.hairHi;
          }
          // (ROADMAP 13.7: an eye shut - its iris with it)
          const ew = st.ex ? s.ex : null;
          if (st.eye && s.ex && s.ex[st.eye > 0 ? 5 : 6] > 0.45) continue;
          // its points, each jittered by the boil, into lines
          const pts = st.pts;
          const seed = (i * 13 + tick * 7 + oi * 101) % 997;
          let ax = 0;
          let ay = 0;
          let az = 0;
          for (let k = 0; k < st.np; k++) {
            let x = pts[k * 3];
            let y = pts[k * 3 + 1];
            let z = pts[k * 3 + 2];
            if (ew) {
              // (the face's moves, as far as each is made)
              const d = st.ex;
              const o = k * 24;
              for (let q = 0; q < 8; q++) {
                const w = ew[q];
                if (w === 0) continue;
                x += w * d[o + q * 3];
                y += w * d[o + q * 3 + 1];
                z += w * d[o + q * 3 + 2];
              }
            }
            if (st.eye && s.gaze) {
              x += s.gaze[0];
              y += s.gaze[1];
            }
            const h = i * 3.17 + k * 1.31 + tick * 0.618;
            const j = st.kind === K.feature ? 0.0006 : 0.0022;
            P[0] = e[0] * x + e[4] * y + e[8] * z + e[12] + (hash(h) - 0.5) * j;
            P[1] = e[1] * x + e[5] * y + e[9] * z + e[13] + (hash(h + 7.1) - 0.5) * j;
            P[2] = e[2] * x + e[6] * y + e[10] * z + e[14] + (hash(h + 3.3) - 0.5) * j;
            if (k > 0) {
              // (a little past its ends, as a hand overshoots - for a stroke this short, millimetres)
              const sl = Math.hypot(P[0] - ax, P[1] - ay, P[2] - az);
              const os = kind === K.feature ? Math.min(0.001, sl * 0.08) : Math.min(0.004, sl * 0.2);
              sink.lineXYZ(ax, ay, az, P[0], P[1], P[2], col, st.w * wk, seed + k, a, 0.006, os);
              left--;
            }
            ax = P[0];
            ay = P[1];
            az = P[2];
          }
        }
      }
    }
    for (const s of slots) s.on = false;
    ctx.used = budget - left;
  }
}
