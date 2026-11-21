import * as THREE from 'three';
import { Kit, itemMats, linC, buildWeaponModel } from './items.js';
import { helixGeometry } from './drawncar.js';
import { plate, cbox, lathe, rod, pipe, rounded, ring, loft, screw } from './armkit.js';

// (ROADMAP 11.20) The parts drawn onto things, as the city's own things: a real wheel with a tyre
// and a rim, a wing with its flap, a rotor on its mast, a jet's nozzle and its flame - each made the
// way the city's cars are made, its outlines inked by the same hand. The stroke said what and where
// and how big; the model is never the stroke itself, so a part drawn in a rush on the run still
// looks like a part.
//
// Each model is in its own frame, its foot at the origin, built for the frame of what it goes on
// (game/fuse.js): x to the thing's left, y up, z its forward. Returns a THREE.Group (moved about
// freely: matrixAutoUpdate on) with what moves of it in userData: spin (round its axle), flame
// (grows with the throttle), coil (stretches), pivot (turns to where you aim), muzzle (where the
// shot leaves, in the pivot's frame).

const RUBBER = linC(0.1, 0.1, 0.12);
const TREAD = linC(0.16, 0.15, 0.17);
const RIM = linC(0.82, 0.84, 0.88);
const STEEL = linC(0.5, 0.52, 0.57);
const DARK = linC(0.17, 0.17, 0.2);
const CHROME = linC(0.9, 0.91, 0.95);
const BRASS = linC(0.86, 0.66, 0.3);
const WHITE = linC(0.96, 0.95, 0.92);
const FLAME_A = linC(1.0, 0.86, 0.3);
const FLAME_B = linC(1.0, 0.42, 0.12);

// the part's own colour: its ink (a pencil stroke takes the part's usual colour)
export function paintOf(ink, dflt) {
  if (!ink || ink.pencil) return linC(...dflt);
  const [r, g, b] = ink.c;
  return linC(r, g, b);
}

function wrap(group, ud = {}) {
  const w = new THREE.Group();
  w.add(group);
  Object.assign(w.userData, ud);
  return w;
}

// mirrored across x (the thing's other side), its faces still facing out
function mirrorX(g0) {
  const g = g0.index ? g0.toNonIndexed() : g0;
  g.scale(-1, 1, 1);
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    const k = a.itemSize;
    for (let i = 0; i < a.count; i += 3) {
      for (let j = 0; j < k; j++) {
        const t = a.array[(i + 1) * k + j];
        a.array[(i + 1) * k + j] = a.array[(i + 2) * k + j];
        a.array[(i + 2) * k + j] = t;
      }
    }
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ wheel
// one wheel round the x axis, its middle at the origin (r: its radius, v: round | teeth | big |
// bigteeth | small | square)
export function wheelModel(r, v, paint, teethN = 10) {
  const M = itemMats();
  const K = new Kit();
  const big = v === 'big' || v === 'bigteeth';
  const teeth = v === 'teeth' || v === 'bigteeth';
  const w = r * (big ? 0.78 : v === 'small' ? 0.42 : 0.6);
  if (v === 'square') {
    // a square wheel: a block of rubber on a square rim - it clunks round
    K.box(M.matte, -w / 2, -r, -r, w / 2, r, r, RUBBER);
    K.box(M.metal, -w / 2 - 0.01, -r * 0.62, -r * 0.62, w / 2 + 0.01, r * 0.62, r * 0.62, paint);
    K.box(M.metal, -w / 2 - 0.02, -r * 0.16, -r * 0.16, w / 2 + 0.02, r * 0.16, r * 0.16, CHROME);
  } else {
    // (ROADMAP 28.24) a wheel as one is made: a tyre with its wall and shoulders and two grooves round the tread; a
    // rim with a lip each side and a dish between, the brake's dark disc seen through it; spokes in pairs out of the
    // hub to the lip, the nuts round the hub, a cap; a big one's rim locked with a ring of bolts
    const rr = r * 0.64;
    K.add(M.round, lathe([[-w / 2, rr], [-w / 2, r * 0.9], [-w * 0.36, r], [-w * 0.13, r], [-w * 0.11, r * 0.972], [-w * 0.06, r * 0.972], [-w * 0.04, r], [w * 0.04, r], [w * 0.06, r * 0.972], [w * 0.11, r * 0.972], [w * 0.13, r], [w * 0.36, r], [w / 2, r * 0.9], [w / 2, rr]], { axis: 'x', segs: 24 }), RUBBER);
    K.add(M.matte, lathe([[-w * 0.512, r * 0.72], [-w * 0.512, r * 0.8], [-w * 0.49, r * 0.8]], { axis: 'x', segs: 24 }), TREAD);
    K.add(M.matte, lathe([[w * 0.49, r * 0.8], [w * 0.512, r * 0.8], [w * 0.512, r * 0.72]], { axis: 'x', segs: 24 }), TREAD);
    K.add(M.metal, lathe([[-w * 0.47, rr * 0.9], [-w * 0.47, rr], [-w * 0.4, rr * 1.035], [-w * 0.3, rr * 0.93], [w * 0.3, rr * 0.93], [w * 0.4, rr * 1.035], [w * 0.47, rr], [w * 0.47, rr * 0.9]], { axis: 'x', segs: 20 }), paint);
    K.add(M.matte, lathe([[-0.012, 0], [-0.012, rr * 0.92], [0.012, rr * 0.92], [0.012, 0]], { axis: 'x', segs: 16 }), DARK);
    K.add(M.metal, lathe([[-w * 0.5, 0], [-w * 0.5, r * 0.13], [-w * 0.44, r * 0.2], [w * 0.44, r * 0.2], [w * 0.5, r * 0.13], [w * 0.5, 0]], { axis: 'x', segs: 12 }), CHROME);
    const nSp = big ? 6 : 5;
    for (let i = 0; i < nSp; i++) {
      const a = (i / nSp) * Math.PI * 2;
      for (const s of [-1, 1]) {
        for (const da of [-0.15, 0.15]) K.add(M.metal, rod([s * w * 0.42, Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16], [s * w * 0.37, Math.cos(a + da) * rr * 0.93, Math.sin(a + da) * rr * 0.93], r * 0.055, r * 0.04, 5), CHROME);
        K.add(M.metal, rod([s * w * 0.44, Math.cos(a + 0.6) * r * 0.115, Math.sin(a + 0.6) * r * 0.115], [s * w * 0.52, Math.cos(a + 0.6) * r * 0.115, Math.sin(a + 0.6) * r * 0.115], r * 0.026, r * 0.026, 5), STEEL);
      }
    }
    if (big) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        for (const s of [-1, 1]) K.add(M.metal, rod([s * w * 0.4, Math.cos(a) * rr * 1.0, Math.sin(a) * rr * 1.0], [s * w * 0.47, Math.cos(a) * rr * 1.0, Math.sin(a) * rr * 1.0], r * 0.022, r * 0.022, 5), CHROME);
      }
    }
    // the tread: deep blocks round it (teeth: big, far out - it climbs; a big one: deep lugs)
    const n = teeth ? Math.max(8, Math.min(16, teethN + 2)) : big ? 14 : 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const hgt = teeth ? r * 0.2 : r * 0.1;
      const lug = new THREE.BoxGeometry(w * (teeth ? 1.04 : 0.86), hgt, r * (teeth ? 0.2 : 0.16));
      lug.translate(0, r + hgt * 0.42, 0);
      lug.rotateX(a);
      K.add(M.matte, lug, TREAD);
    }
  }
  const g = K.build({ seed: 0.31 });
  const spin = new THREE.Group();
  spin.add(g);
  return wrap(spin, { spin, r: v === 'square' ? r : teeth ? r * 1.12 : big ? r * 1.06 : r, w });
}

// ------------------------------------------------------------------ wing
// a wing out of the left side (side -1: the right): its root at the origin, span out along x;
// chord: how deep (front to back); a strut under it to the body
export function wingModel(span, chord, side, paint, kind = 'wing') {
  const M = itemMats();
  const K = new Kit();
  if (kind === 'spoiler') {
    // a spoiler: a wing across the back, on two posts (span: across, centred on the origin)
    const half = span / 2;
    for (const s of [-1, 1]) K.box(M.metal, s * half * 0.62 - 0.03, 0, -0.04, s * half * 0.62 + 0.03, 0.22, 0.04, DARK);
    const g = new THREE.BoxGeometry(span, 0.05, chord);
    tilt(g, 0.12);
    g.translate(0, 0.25, 0);
    K.add(M.paint, g, paint);
    for (const s of [-1, 1]) K.box(M.paint, s * half - 0.025, 0.15, -chord / 2, s * half + 0.025, 0.36, chord / 2, paint);
    return wrap(K.build({ seed: 0.53 }), { span });
  }
  const t = Math.max(0.045, Math.min(0.09, chord * 0.07));
  // (ROADMAP 28.24) a wing with an aerofoil's section - a round nose, a full back, a fine tail - skinned from root
  // to tip: narrower and further back towards its tip, the tip a little up; its ribs showing as lines across it; a
  // lamp at the tip (red to the left, green to the right)
  const SEC = [[0.5, 0], [0.4, 0.6], [0.14, 1], [-0.2, 0.8], [-0.5, 0.1], [-0.5, -0.1], [-0.2, -0.36], [0.14, -0.5], [0.4, -0.36]];
  const rings = [];
  for (let i = 0; i <= 5; i++) {
    const k = i / 5;
    const c = chord * (1 - 0.45 * k);
    const th = t * (1.9 - 1.0 * k);
    const r1 = SEC.map(([u, v]) => [k * span * side, span * 0.09 * k + (v * th) / 2, -chord * 0.28 * k + u * c]);
    rings.push(side > 0 ? r1.reverse() : r1);
  }
  K.add(M.paint, loft(rings), paint);
  for (const k of [0.2, 0.4, 0.6]) {
    const c = chord * (1 - 0.45 * k);
    K.add(M.matte, rod([k * span * side, span * 0.09 * k + t * 0.86 * (1 - 0.5 * k), -chord * 0.28 * k + c * 0.36], [k * span * side, span * 0.09 * k + t * 0.42, -chord * 0.28 * k - c * 0.46], 0.006, 0.006, 4), DARK);
  }
  K.add(M.glow, cbox(side * span - 0.02, span * 0.09 - 0.02, -chord * 0.28 - 0.05, side * span + 0.03, span * 0.09 + 0.03, -chord * 0.28 + 0.07, 0.01), side > 0 ? linC(1, 0.2, 0.25) : linC(0.3, 1, 0.4));
  // its flap along the back edge, and a stripe near the tip
  const fl = new THREE.BoxGeometry(span * 0.5, t * 0.8, chord * 0.16);
  fl.translate(side * span * 0.55, span * 0.05, -chord * 0.5 - chord * 0.06);
  K.add(M.matte, fl, DARK);
  const st = new THREE.BoxGeometry(span * 0.08, t * 1.1, chord * 0.62);
  st.translate(side * span * 0.82, span * 0.075, -chord * 0.24);
  K.add(M.matte, st, WHITE);
  // the strut
  const s = new THREE.CylinderGeometry(0.03, 0.03, Math.hypot(span * 0.35, 0.3), 6);
  s.rotateZ(side * Math.atan2(span * 0.35, 0.3));
  s.translate(side * span * 0.17, -0.15, 0);
  K.add(M.metal, s, STEEL);
  return wrap(K.build({ seed: 0.57 }), { span });
}

// a box geometry tipped up at its front (rad)
function tilt(g, a) {
  g.rotateX(-a);
}

// ------------------------------------------------------------------ rotor
// a rotor on its mast: the mast up from the origin, the blades going round (span: tip to tip)
export function rotorModel(span, paint) {
  // (ROADMAP 28.24) a rotor as one is built: the mast in its fairing, the swash plate and two links up to the head; the
  // head with a grip for each blade; two blades of an aerofoil's section, tipped in white; a stabiliser bar across them
  // with a weight at each end
  const M = itemMats();
  const K = new Kit();
  K.add(M.round, lathe([[0, 0.0], [0, 0.17], [0.03, 0.17], [0.12, 0.09], [0.14, 0.0]], { axis: 'y', segs: 14 }), STEEL);
  K.add(M.metal, lathe([[0.12, 0.0], [0.12, 0.05], [0.42, 0.042], [0.42, 0.0]], { axis: 'y', segs: 10 }), DARK);
  K.add(M.metal, lathe([[0.24, 0.0], [0.24, 0.12], [0.265, 0.12], [0.265, 0.0]], { axis: 'y', segs: 14 }), CHROME);
  for (const s of [-1, 1]) K.add(M.metal, rod([s * 0.1, 0.265, 0], [s * 0.09, 0.42, 0.02], 0.008, 0.008, 5), CHROME);
  const base = K.build({ seed: 0.61 });
  const B = new Kit();
  B.add(M.metal, lathe([[0.38, 0.0], [0.38, 0.1], [0.44, 0.115], [0.5, 0.1], [0.53, 0.05], [0.53, 0.0]], { axis: 'y', segs: 12 }), CHROME);
  const c = Math.max(0.14, span * 0.06);
  const foil = rounded([[-c / 2, 0.462], [c * 0.2, 0.474], [c / 2, 0.462], [c * 0.2, 0.452], [-c / 2, 0.458]], 0.004, 2);
  for (const s of [-1, 1]) {
    const x0 = s * 0.2;
    const x1 = s * span * 0.47;
    B.add(M.metal, cbox(Math.min(s * 0.08, x0), 0.44, -0.05, Math.max(s * 0.08, x0), 0.48, 0.05, 0.01), STEEL);
    B.add(M.paint, plate(foil, Math.min(x0, x1), Math.max(x0, x1), { bevel: 0.003 }), paint);
    B.add(M.matte, plate(foil, Math.min(x1, s * span / 2), Math.max(x1, s * span / 2), { bevel: 0.004 }), WHITE);
    // (the bar across the blades, a weight at each end)
    B.add(M.metal, rod([0, 0.52, 0], [0, 0.52, s * span * 0.16], 0.01, 0.01, 5), CHROME);
    B.add(M.metal, lathe([[s * span * 0.16 - 0.05, 0.0], [s * span * 0.16 - 0.05, 0.03], [s * span * 0.16 + 0.05, 0.03], [s * span * 0.16 + 0.05, 0.0]], { y: 0.52, segs: 8 }), DARK);
  }
  const spin = new THREE.Group();
  spin.add(B.build({ seed: 0.67 }));
  const g = new THREE.Group();
  g.add(base);
  g.add(spin);
  return wrap(g, { spin, span });
}

// ------------------------------------------------------------------ jet
// a jet's nozzle pointing back along -z from the origin (its flame further back); len: how long
export function jetModel(len, paint) {
  const M = itemMats();
  const K = new Kit();
  const L = Math.max(0.45, Math.min(1.4, len * 0.55));
  const r0 = 0.15 + L * 0.06;
  const r1 = r0 * 1.32;
  // (ROADMAP 28.24) a jet engine as one is built: an intake with a rolled lip and a spinner in the middle of its fan; a
  // casing in sections, a band of bolts where they join, two pipes along it and the box of its gears under it; a
  // nozzle of overlapping petals, dark inside, a ring of flame holders in it; the pylon it hangs by
  K.add(M.metal, lathe([[-L * 0.62, r0 * 1.1], [-L * 0.56, r0 * 1.12], [-L * 0.5, r0 * 1.06], [-0.08, r0 * 1.02], [0.02, r0 * 1.06], [0.06, r0 * 0.96], [0.03, r0 * 0.82], [-0.06, r0 * 0.8]], { segs: 18 }), paint);
  K.add(M.metal, lathe([[0.012, r0 * 1.075], [0.065, r0 * 0.97], [0.03, r0 * 0.81]], { segs: 18 }), CHROME);
  K.add(M.matte, lathe([[-0.05, 0.0], [-0.05, r0 * 0.8]], { segs: 14 }).scale(1, 1, -1).translate(0, 0, -0.1), DARK);
  K.add(M.metal, lathe([[-0.06, r0 * 0.28], [0.0, r0 * 0.2], [0.06, 0.0]], { segs: 10 }), CHROME);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    K.add(M.metal, rod([Math.cos(a) * r0 * 0.26, Math.sin(a) * r0 * 0.26, -0.03], [Math.cos(a + 0.3) * r0 * 0.78, Math.sin(a + 0.3) * r0 * 0.78, -0.045], 0.016, 0.01, 4), STEEL);
  }
  K.add(M.metal, lathe([[-L, r1 * 0.94], [-L + 0.03, r1], [-L * 0.62, r0 * 1.12]], { segs: 18 }), STEEL);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    K.add(M.matte, rod([Math.cos(a) * r1 * 1.004, Math.sin(a) * r1 * 1.004, -L + 0.03], [Math.cos(a) * r0 * 1.125, Math.sin(a) * r0 * 1.125, -L * 0.62], 0.008, 0.008, 4), DARK);
  }
  K.add(M.metal, lathe([[-L * 0.63, r0 * 1.14], [-L * 0.55, r0 * 1.14]], { segs: 18 }), CHROME);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    K.add(M.metal, rod([Math.cos(a) * r0 * 1.14, Math.sin(a) * r0 * 1.14, -L * 0.59], [Math.cos(a) * r0 * 1.19, Math.sin(a) * r0 * 1.19, -L * 0.59], 0.012, 0.012, 5), STEEL);
  }
  K.add(M.metal, lathe([[-L * 0.3, r0 * 1.05], [-L * 0.26, r0 * 1.05]], { segs: 18 }), CHROME);
  K.add(M.matte, lathe([[-L + 0.05, 0.0], [-L + 0.05, r1 * 0.9]], { segs: 14 }), DARK);
  K.add(M.metal, lathe([[-L + 0.07, r1 * 0.5], [-L + 0.07, r1 * 0.58], [-L + 0.03, r1 * 0.58], [-L + 0.03, r1 * 0.5]], { segs: 12 }), STEEL);
  for (const s of [-1, 1]) K.add(M.metal, pipe([[s * r0 * 0.8, r0 * 0.74, -0.1], [s * r0 * 0.86, r0 * 0.8, -L * 0.3], [s * r0 * 0.9, r0 * 0.84, -L * 0.56]], 0.012, { steps: 12, segs: 5 }), CHROME);
  K.add(M.metal, cbox(-r0 * 0.5, -r0 * 1.3, -L * 0.5, r0 * 0.5, -r0 * 0.96, -L * 0.14, 0.02), DARK);
  // (its mount onto the thing)
  K.add(M.metal, plate(rounded([[-0.28, -r0 - 0.1], [0.06, -r0 - 0.1], [0.02, -r0 + 0.04], [-0.24, -r0 + 0.04]], 0.02, 2), -0.07, 0.07, { bevel: 0.015 }), STEEL);
  const g = K.build({ seed: 0.71 });
  const F = new Kit();
  // (ROADMAP 28.24) an afterburner's flame as one is seen: a short blue cone at the nozzle, a long orange spear out
  // of it, and bright shock diamonds strung along the spear, each smaller than the last
  F.add(M.glow, lathe([[-0.4, 0.0], [-0.22, r1 * 0.5], [-0.06, r1 * 0.84], [0.0, r1 * 0.8]], { segs: 12 }), linC(0.16, 0.36, 1.0));
  F.add(M.glow, lathe([[-1.0, 0.0], [-0.7, r1 * 0.2], [-0.4, r1 * 0.36], [-0.1, r1 * 0.5]], { segs: 10 }), linC(1.0, 0.36, 0.05));
  for (let k = 0; k < 4; k++) {
    const zc = -0.42 - k * 0.14;
    const rr = r1 * 0.5 * (1 + zc) * 1.5 + 0.01;
    F.add(M.glow, lathe([[zc - 0.045, 0.0], [zc, rr], [zc + 0.045, 0.0]], { segs: 8 }), linC(1.0, 0.86, 0.5));
  }
  const flame = new THREE.Group();
  flame.add(F.build({ seed: 0.73 }));
  flame.position.z = -L;
  flame.scale.set(1, 1, 0.001);
  flame.visible = false;
  const out = new THREE.Group();
  out.add(g);
  out.add(flame);
  return wrap(out, { flame, len: L, r: r1 });
}

// a jetpack on the hero's back: two tanks, two nozzles pointing down
export function packModel(len, paint) {
  const M = itemMats();
  const K = new Kit();
  for (const s of [-1, 1]) {
    K.cyl(M.metal, 0.09, 0.09, -0.32, 0.12, paint, { axis: 'y', x: s * 0.11 });
    K.sphere(M.metal, 0.09, s * 0.11, 0.12, 0, paint);
    K.cyl(M.metal, 0.06, 0.08, -0.32, -0.42, STEEL, { axis: 'y', x: s * 0.11 });
  }
  K.box(M.matte, -0.2, -0.2, -0.06, 0.2, 0.05, 0.02, DARK);
  const g = K.build({ seed: 0.79 });
  const F = new Kit();
  for (const s of [-1, 1]) {
    const fl = new THREE.ConeGeometry(0.07, 1, 10, 1, true);
    fl.rotateX(Math.PI);
    fl.translate(s * 0.11, -0.5, 0);
    F.add(M.glow, fl, FLAME_B);
  }
  const flame = new THREE.Group();
  flame.add(F.build({ seed: 0.81 }));
  flame.position.y = -0.42;
  flame.scale.set(1, 0.001, 1);
  const out = new THREE.Group();
  out.add(g);
  out.add(flame);
  return wrap(out, { flame, pack: true, len });
}

// ------------------------------------------------------------------ spring
// a coil spring standing on the origin, h tall, its coils as drawn
export function springModel(coils, h, r, paint) {
  const M = itemMats();
  const K = new Kit();
  const turns = Math.max(3, Math.min(10, coils));
  K.add(M.metal, helixGeometry(0, 0.04, 1, r, turns), paint);
  K.cyl(M.metal, r * 1.15, r * 1.15, 0, 0.05, STEEL, { axis: 'y' });
  K.cyl(M.metal, r * 1.15, r * 1.15, 0.98, 1.03, STEEL, { axis: 'y' });
  const coil = new THREE.Group();
  coil.add(K.build({ seed: 0.83 }));
  coil.scale.y = h;
  return wrap(coil, { coil, h, coils: turns });
}

// a spring bumper across the front: two coils pushing a padded bar
export function bumperModel(width, len, coils, paint) {
  const M = itemMats();
  const K = new Kit();
  for (const s of [-1, 1]) {
    const g = helixGeometry(0, 0, len, 0.08, Math.max(3, coils));
    g.rotateX(Math.PI / 2);
    g.translate(s * width * 0.3, 0, 0);
    K.add(M.metal, g, paint);
  }
  K.box(M.paint, -width / 2, -0.12, len, width / 2, 0.12, len + 0.14, DARK);
  K.box(M.matte, -width / 2 + 0.05, -0.08, len + 0.14, width / 2 - 0.05, 0.08, len + 0.2, linC(0.9, 0.78, 0.12));
  return wrap(K.build({ seed: 0.87 }), { len });
}

// ------------------------------------------------------------------ barrel
// a gun: on the roof a turret (it turns all the way round), at the nose or the tail a fixed mount
// (it turns a little); its barrel along +z of its pivot, as long as drawn, a cannon as thick
export function barrelModel(len, r, kind, paint) {
  const M = itemMats();
  const L = Math.max(0.55, Math.min(3.2, len));
  const R = Math.max(0.045, Math.min(0.24, r));
  const cannon = R >= 0.11;
  const base = new Kit();
  if (kind === 'turret') {
    base.cyl(M.metal, 0.36, 0.33, 0, 0.12, STEEL, { axis: 'y' });
    base.torus(M.metal, 0.35, 0.025, 0, 0.06, 0, DARK, Math.PI / 2);
  } else {
    base.box(M.metal, -0.16, 0, -0.18, 0.16, 0.14, 0.18, STEEL);
  }
  // (ROADMAP 28.24) on its mount: a ring bolted down (a turret), or a block
  if (kind === 'turret') for (let i = 0; i < 10; i++) base.add(M.metal, lathe([[0.12, 0.0], [0.12, 0.018], [0.135, 0.018], [0.135, 0.0]], { axis: 'y', segs: 5 }).translate(Math.cos((i / 10) * 6.283) * 0.3, 0, Math.sin((i / 10) * 6.283) * 0.3), CHROME);
  const P = new Kit();
  const y = kind === 'turret' ? 0.24 : 0.2;
  // (the cradle it swings in)
  for (const s of [-1, 1]) P.add(M.metal, plate(rounded([[-0.16, y - 0.2], [0.12, y - 0.2], [0.1, y + 0.04], [-0.1, y + 0.06]], 0.03, 2), s * (0.12 + R), s * (0.15 + R), { bevel: 0.008 }), STEEL);
  if (!cannon) {
    // a machine gun as one is made: the receiver and its cover, the feed and the box of rounds with its belt, a jacket
    // drilled with holes round the barrel, a flash hider; two spade grips and the trigger between them; a ring sight;
    // a plate of armour for whoever is behind it
    P.add(M.paint, plate(rounded([[-0.3, y - 0.07], [0.2, y - 0.07], [0.2, y + 0.07], [-0.26, y + 0.07], [-0.3, y + 0.03]], 0.012, 2), -R * 1.5 - 0.02, R * 1.5 + 0.02, { bevel: 0.008 }), paint);
    P.add(M.metal, cbox(-R * 1.3 - 0.02, y + 0.07, -0.2, R * 1.3 + 0.02, y + 0.1, 0.14, 0.008), STEEL);
    P.add(M.metal, lathe([[0.2, 0.0], [0.2, R * 1.7], [0.2 + L * 0.5, R * 1.6], [0.2 + L * 0.5, R]], { y, segs: 12 }), STEEL);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.78;
      for (let i = 0; i < 5; i++) P.add(M.matte, rod([Math.cos(a) * R * 1.62, y + Math.sin(a) * R * 1.62, 0.24 + i * L * 0.09], [Math.cos(a) * R * 1.66, y + Math.sin(a) * R * 1.66, 0.24 + i * L * 0.09], R * 0.42, R * 0.42, 6).rotateX(0), DARK);
    }
    P.add(M.metal, lathe([[0.2 + L * 0.5, 0.0], [0.2 + L * 0.5, R], [0.18 + L - 0.14, R * 0.9], [0.18 + L - 0.14, R * 1.4], [0.18 + L, R * 1.55], [0.18 + L, R * 0.8], [0.18 + L - 0.1, R * 0.8]], { y, segs: 12 }), DARK);
    P.add(M.matte, lathe([[0.181 + L - 0.1, R * 0.8], [0.181 + L - 0.1, 0.0]], { y, segs: 8 }).scale(1, 1, -1).translate(0, 0, 2 * (0.181 + L - 0.1)), DARK);
    const bx = 0.2 + R;
    P.add(M.paint, cbox(bx, y - 0.2, -0.16, bx + 0.16, y + 0.0, 0.12, 0.012), linC(0.26, 0.34, 0.2));
    P.add(M.metal, cbox(bx - 0.006, y - 0.02, -0.17, bx + 0.166, y + 0.006, 0.13, 0.006), linC(0.2, 0.26, 0.15));
    for (let i = 0; i < 6; i++) P.add(M.metal, rod([bx + 0.02 - i * 0.03, y + 0.01 + Math.sin((i / 5) * Math.PI) * 0.05, -0.05], [bx + 0.02 - i * 0.03, y + 0.01 + Math.sin((i / 5) * Math.PI) * 0.05, 0.03], 0.011, 0.008, 6), BRASS);
    for (const s of [-1, 1]) {
      P.add(M.metal, rod([s * 0.06, y, -0.3], [s * 0.07, y, -0.42], 0.012, 0.012, 6), STEEL);
      P.add(M.round, rod([s * 0.07, y - 0.07, -0.42], [s * 0.07, y + 0.07, -0.42], 0.018, 0.018, 8), DARK);
    }
    P.add(M.metal, cbox(-0.02, y - 0.01, -0.38, 0.02, y + 0.03, -0.32, 0.006), CHROME);
    P.add(M.metal, lathe([[0.02, 0.03], [0.02, 0.04], [0.03, 0.04], [0.03, 0.03]], { y: y + 0.16, segs: 12 }), DARK);
    P.add(M.metal, rod([0, y + 0.1, 0.025], [0, y + 0.125, 0.025], 0.006, 0.006, 4), DARK);
    P.add(M.metal, plate(rounded([[-0.2, y - 0.15], [0.2, y - 0.15], [0.2, y + 0.2], [0.13, y + 0.27], [-0.13, y + 0.27], [-0.2, y + 0.2]], 0.02, 2), -0.214, -0.2, { bevel: 0.004, holes: [rounded([[-R * 2.2, y - R * 2.2], [R * 2.2, y - R * 2.2], [R * 2.2, y + R * 2.2], [-R * 2.2, y + R * 2.2]], R, 3)] }).rotateY(Math.PI / 2), linC(0.3, 0.33, 0.3));
  } else {
    // a cannon: its breech and the block that closes it, two recoil cylinders over the barrel, the barrel in bands, a
    // brake cut with slots at its mouth; a sight on its left
    P.add(M.paint, plate(rounded([[-0.26, y - 0.13], [0.2, y - 0.13], [0.2, y + 0.13 + R * 0.5], [-0.22, y + 0.13 + R * 0.5], [-0.26, y + 0.08]], 0.02, 2), -0.2 - R, 0.2 + R, { bevel: 0.012 }), paint);
    P.add(M.metal, cbox(-0.12 - R, y - 0.1, -0.34, 0.12 + R, y + 0.1, -0.24, 0.015), STEEL);
    P.add(M.metal, rod([0.16 + R, y, -0.3], [0.3 + R, y + 0.06, -0.3], 0.014, 0.014, 6), CHROME);
    P.add(M.metal, lathe([[0.18, 0.0], [0.18, R * 1.5], [0.3, R * 1.5], [0.34, R * 1.1], [0.18 + L * 0.5, R], [0.18 + L * 0.5, R * 1.2], [0.24 + L * 0.5, R * 1.2], [0.24 + L * 0.5, R * 0.96], [0.18 + L - 0.24, R * 0.9]], { y, segs: 14 }), DARK);
    for (const s of [-1, 1]) {
      P.add(M.metal, lathe([[0.16, 0.0], [0.16, R * 0.34], [0.2 + L * 0.34, R * 0.34], [0.2 + L * 0.34, 0.0]], { x: s * R * 0.9, y: y + R * 1.5, segs: 8 }), STEEL);
      P.add(M.metal, lathe([[0.2 + L * 0.34, 0.0], [0.2 + L * 0.34, R * 0.2], [0.2 + L * 0.44, R * 0.2], [0.2 + L * 0.44, 0.0]], { x: s * R * 0.9, y: y + R * 1.5, segs: 6 }), CHROME);
    }
    P.add(M.metal, lathe([[0.18 + L - 0.24, R * 0.9], [0.18 + L - 0.24, R * 1.5], [0.18 + L, R * 1.5], [0.18 + L, R * 0.8], [0.18 + L - 0.2, R * 0.8]], { y, segs: 14 }), STEEL);
    for (const s of [-1, 1]) for (const z of [0.18 + L - 0.19, 0.18 + L - 0.1]) P.add(M.matte, cbox(s * R * 1.46, y - R * 0.5, z, s * R * 1.54, y + R * 0.5, z + 0.05, 0.004), DARK);
    P.add(M.matte, lathe([[0.181 + L - 0.2, R * 0.8], [0.181 + L - 0.2, 0.0]], { y, segs: 10 }).scale(1, 1, -1).translate(0, 0, 2 * (0.181 + L - 0.2)), DARK);
    P.add(M.metal, cbox(0.2 + R, y + 0.02, -0.12, 0.3 + R, y + 0.14, 0.1, 0.012), DARK);
    P.add(M.glass, cbox(0.22 + R, y + 0.05, 0.1, 0.28 + R, y + 0.11, 0.104, 0.002), linC(0.3, 0.5, 0.7));
  }
  const pivot = new THREE.Group();
  pivot.add(P.build({ seed: 0.89 }));
  const g = new THREE.Group();
  g.add(base.build({ seed: 0.91 }));
  g.add(pivot);
  return wrap(g, { pivot, muzzle: new THREE.Vector3(0, y, 0.2 + L), r: R, len: L, cannon });
}

// ------------------------------------------------------------------ blade
// a ram: a curved steel plough across the nose, its edge toothed (width: across, depth: how far it
// sticks out)
export function ramModel(width, depth) {
  const M = itemMats();
  const K = new Kit();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n - 0.5) * 2;
    const a1 = ((i + 1) / n - 0.5) * 2;
    const x0 = (a0 * width) / 2;
    const x1 = (a1 * width) / 2;
    const z0 = depth * (1 - a0 * a0);
    const z1 = depth * (1 - a1 * a1);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(len + 0.02, 0.42, 0.06);
    g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
    g.translate((x0 + x1) / 2, 0.21, (z0 + z1) / 2);
    K.add(M.metal, g, STEEL);
    // its teeth along the bottom edge
    const t = new THREE.ConeGeometry(0.05, 0.16, 4);
    t.rotateX(Math.PI / 2);
    t.translate((x0 + x1) / 2, 0.04, (z0 + z1) / 2 + 0.08);
    K.add(M.metal, t, CHROME);
  }
  // the arms back to the chassis
  for (const s of [-1, 1]) K.box(M.metal, s * width * 0.3 - 0.04, 0.12, -0.3, s * width * 0.3 + 0.04, 0.24, depth * 0.6, DARK);
  return wrap(K.build({ seed: 0.93 }), { depth });
}

// a knife out of the side, flat, pointed (len: how far it sticks out; side: +1 the left)
export function sideBladeModel(len, side) {
  const M = itemMats();
  const K = new Kit();
  const L = Math.max(0.4, Math.min(1.6, len));
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.07);
  sh.lineTo(L * 0.8, -0.09);
  sh.lineTo(L, 0);
  sh.lineTo(L * 0.8, 0.09);
  sh.lineTo(0, 0.07);
  sh.lineTo(0, -0.07);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false });
  g.translate(0, 0, -0.015);
  // (flat, out along x, its edge forward)
  g.rotateX(Math.PI / 2);
  K.add(M.metal, side < 0 ? mirrorX(g) : g, CHROME);
  K.box(M.metal, -0.06, -0.1, -0.12, 0.06, 0.1, 0.12, DARK);
  return wrap(K.build({ seed: 0.95 }), { len: L });
}

// a blade (a bayonet, an arm blade): along +z from the origin, curved as drawn
export function bladeModel(len, curve) {
  const M = itemMats();
  const K = new Kit();
  const L = Math.max(0.25, Math.min(1.4, len));
  const sh = new THREE.Shape();
  const bend = Math.max(-0.4, Math.min(0.4, (curve - 1.5) * 0.08)) * L;
  sh.moveTo(-0.035, 0);
  sh.quadraticCurveTo(-0.04 + bend, L * 0.5, 0, L);
  sh.quadraticCurveTo(0.05 + bend, L * 0.5, 0.035, 0);
  sh.lineTo(-0.035, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 8 });
  g.rotateX(Math.PI / 2);
  K.add(M.metal, g, CHROME);
  K.box(M.metal, -0.05, -0.03, -0.04, 0.05, 0.03, 0.02, BRASS);
  return wrap(K.build({ seed: 0.97 }), { len: L });
}

// ------------------------------------------------------------------ armour
// steel plates bolted along a car's sides, its nose and its tail (D: its half length, half width,
// height; cover: how much of it, 0-1)
export function carArmorModel(D, cover, clear = 0.25) {
  const M = itemMats();
  const K = new Kit();
  const top = clear + (D.h - clear) * (0.55 + cover * 0.3);
  const n = 4;
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const z0 = -D.hl * 0.82 + (i / n) * D.hl * 1.64 + 0.03;
      const z1 = -D.hl * 0.82 + ((i + 1) / n) * D.hl * 1.64 - 0.03;
      K.box(M.metal, s * (D.hw + 0.02), clear + 0.08, z0, s * (D.hw + 0.07), top, z1, i % 2 ? STEEL : linC(0.45, 0.47, 0.52));
      for (const zz of [z0 + 0.08, z1 - 0.08]) for (const yy of [clear + 0.16, top - 0.08]) K.box(M.metal, s * (D.hw + 0.065), yy - 0.025, zz - 0.025, s * (D.hw + 0.085), yy + 0.025, zz + 0.025, CHROME);
    }
  }
  // the nose and the tail: a grille guard, a plate
  K.box(M.metal, -D.hw * 0.86, clear + 0.04, D.hl + 0.02, D.hw * 0.86, clear + 0.46, D.hl + 0.1, STEEL);
  for (let i = -3; i <= 3; i++) K.box(M.metal, i * D.hw * 0.24 - 0.025, clear + 0.04, D.hl + 0.1, i * D.hw * 0.24 + 0.025, clear + 0.46, D.hl + 0.14, DARK);
  K.box(M.metal, -D.hw * 0.8, clear + 0.06, -D.hl - 0.08, D.hw * 0.8, clear + 0.36, -D.hl - 0.02, STEEL);
  // (much of it: slits over the windows too)
  if (cover > 0.55) {
    for (const s of [-1, 1]) K.box(M.metal, s * (D.hw * 0.86), top, -D.hl * 0.25, s * (D.hw * 0.9), top + 0.22, D.hl * 0.35, DARK);
  }
  return wrap(K.build({ seed: 0.41 }), { cover });
}

// a chest plate and shoulder pads (the hero's): in his chest's frame
export function vestModel(cover) {
  const M = itemMats();
  const K = new Kit();
  K.box(M.metal, -0.19, -0.24, -0.02, 0.19, 0.2, 0.17, STEEL);
  K.box(M.metal, -0.15, -0.18, 0.17, 0.15, 0.14, 0.2, linC(0.45, 0.47, 0.52));
  if (cover > 0.35) for (const s of [-1, 1]) K.sphere(M.metal, 0.11, s * 0.23, 0.2, 0.06, STEEL, 1, 0.6, 1, 10);
  return wrap(K.build({ seed: 0.43 }), { cover });
}

// ------------------------------------------------------------------ balloon
// a balloon (d: across), its knot at the origin, striped in its colour and white
export function balloonModel(d, paint) {
  const M = itemMats();
  const K = new Kit();
  const R = Math.max(0.35, d / 2);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const g = new THREE.SphereGeometry(R, 4, 14, (i / n) * Math.PI * 2, (Math.PI * 2) / n);
    g.scale(1, 1.18, 1);
    g.translate(0, R * 1.18 + 0.12, 0);
    K.add(M.paint, g, i % 2 ? WHITE : paint);
  }
  const knot = new THREE.ConeGeometry(0.08, 0.16, 8);
  knot.translate(0, 0.08, 0);
  K.add(M.paint, knot, paint);
  return wrap(K.build({ seed: 0.47 }), { R, top: R * 2.36 + 0.12 });
}

// ------------------------------------------------------------------ magnet
// a horseshoe magnet, its two poles pointing along +z (size: across it)
export function magnetModel(size) {
  const M = itemMats();
  const K = new Kit();
  const S = Math.max(0.35, Math.min(1.4, size));
  const R = S * 0.3;
  const t = S * 0.11;
  const g = new THREE.TorusGeometry(R, t, 8, 18, Math.PI);
  // (the bend behind, the open end ahead)
  g.rotateX(Math.PI / 2);
  g.rotateY(Math.PI);
  K.add(M.paint, g, linC(0.86, 0.12, 0.14));
  for (const s of [-1, 1]) {
    K.cyl(M.paint, t, t, 0, S * 0.32, linC(0.86, 0.12, 0.14), { x: s * R });
    K.cyl(M.metal, t * 1.02, t * 1.02, S * 0.32, S * 0.46, CHROME, { x: s * R });
  }
  K.box(M.metal, -0.06, -0.06, -R - t - 0.18, 0.06, 0.06, -R - t, STEEL);
  return wrap(K.build({ seed: 0.49 }), { S, reach: S * 0.46 });
}

// ------------------------------------------------------------------ (ROADMAP 11.21) more parts
// a star on a short mast, standing up and turning (size: across it): star power while it lasts
export function starModel(size, paint) {
  const M = itemMats();
  const K = new Kit();
  K.cyl(M.round, 0.035, 0.03, 0, 0.32, DARK, { axis: 'y' });
  K.cyl(M.round, 0.11, 0.1, 0, 0.06, STEEL, { axis: 'y' });
  const base = K.build({ seed: 0.81 });
  const R = Math.max(0.28, Math.min(0.75, size * 0.45));
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? R * 0.44 : R;
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: R * 0.22, bevelEnabled: true, bevelThickness: R * 0.06, bevelSize: R * 0.05, bevelSegments: 1 });
  g.translate(0, 0, -R * 0.11);
  g.computeVertexNormals();
  const S = new Kit();
  S.add(M.glow, g, paint);
  const star = new THREE.Group();
  star.add(S.build({ seed: 0.83 }));
  star.position.y = 0.32 + R;
  const out = new THREE.Group();
  out.add(base);
  out.add(star);
  return wrap(out, { spin: star, R, top: 0.32 + R * 2 });
}

// a coil of lightning on the roof: a dark foot, a post with brass rings, a ball that glows - its
// sparks leave from the ball (userData.tip)
export function boltModel(size, paint) {
  const M = itemMats();
  const K = new Kit();
  const s = Math.max(0.8, Math.min(1.4, size));
  K.cyl(M.round, 0.16 * s, 0.13 * s, 0, 0.1 * s, DARK, { axis: 'y' });
  K.cyl(M.metal, 0.05 * s, 0.045 * s, 0.1 * s, 0.5 * s, STEEL, { axis: 'y' });
  for (let i = 0; i < 3; i++) K.torus(M.metal, (0.12 - i * 0.02) * s, 0.022 * s, 0, (0.2 + i * 0.1) * s, 0, BRASS, Math.PI / 2);
  K.sphere(M.glow, 0.1 * s, 0, 0.58 * s, 0, paint, 1, 1, 1, 12);
  return wrap(K.build({ seed: 0.87 }), { tip: new THREE.Vector3(0, 0.58 * s, 0) });
}

// two smoke pots at its tail, pointing back along -z
export function smokeModel(paint) {
  const M = itemMats();
  const K = new Kit();
  for (const s of [-1, 1]) {
    const x = s * 0.32;
    K.cyl(M.metal, 0.11, 0.11, 0, -0.34, paint, { x });
    K.cyl(M.metal, 0.12, 0.14, -0.34, -0.42, STEEL, { x });
    K.torus(M.metal, 0.115, 0.018, x, 0, -0.12, CHROME);
    K.cyl(M.matte, 0.1, 0.1, -0.41, -0.43, DARK, { x });
  }
  K.box(M.metal, -0.4, -0.13, -0.08, 0.4, -0.09, 0.04, STEEL);
  return wrap(K.build({ seed: 0.89 }));
}

// a parachute packed on the roof - and its canopy over it, folded away until it opens
// (userData.canopy: scale it up to open; its lines run to the pack)
export function chuteModel(span, paint) {
  const M = itemMats();
  const K = new Kit();
  K.box(M.matte, -0.3, 0, -0.22, 0.3, 0.16, 0.22, paint);
  K.box(M.matte, -0.31, 0.06, -0.23, 0.31, 0.09, 0.23, DARK);
  const pack = K.build({ seed: 0.91 });
  const C = new Kit();
  const R = Math.max(1.6, Math.min(4.5, span * 0.5));
  const n = 10;
  for (let i = 0; i < n; i++) {
    const g = new THREE.SphereGeometry(R, 3, 6, (i / n) * Math.PI * 2, (Math.PI * 2) / n, 0, Math.PI * 0.42);
    g.scale(1, 0.55, 1);
    g.translate(0, R * 1.05, 0);
    C.add(M.paint, g, i % 2 ? WHITE : paint);
  }
  // (its lines: from the rim down to the pack)
  const rimY = R * 1.05 + Math.cos(Math.PI * 0.42) * R * 0.55;
  const rimR = Math.sin(Math.PI * 0.42) * R;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const top = new THREE.Vector3(Math.cos(a) * rimR, rimY, Math.sin(a) * rimR);
    const foot = new THREE.Vector3(Math.cos(a) * 0.2, 0.16, Math.sin(a) * 0.15);
    const len = top.distanceTo(foot);
    const g = new THREE.CylinderGeometry(0.012, 0.012, len, 4);
    g.translate(0, len / 2, 0);
    g.lookAt(top.clone().sub(foot));
    g.rotateX(Math.PI / 2);
    g.translate(foot.x, foot.y, foot.z);
    C.add(M.matte, g, DARK);
  }
  const canopy = new THREE.Group();
  canopy.add(C.build({ seed: 0.93 }));
  canopy.scale.setScalar(0.001);
  canopy.visible = false;
  const out = new THREE.Group();
  out.add(pack);
  out.add(canopy);
  return wrap(out, { canopy, R });
}

// floats along its two sides, low (len: how long; hw: half the width between them)
// ------------------------------------------------------------------ propeller (ROADMAP 11.25)
// a boat's propeller out of the car's back, along -z from the origin: a shaft, a hub, three broad
// blades round it (r: how long a blade is)
export function propModel(r, paint) {
  // (ROADMAP 28.24) an airscrew as one is made: its engine - seven cylinders round a crankcase, fins on each, in a
  // cowl; two exhaust stubs; the shaft; a spinner over the hub; three blades, each twisted from its root to its
  // tip, broad in its middle, thin at its end, its tip painted
  const M = itemMats();
  const K = new Kit();
  K.add(M.paint, lathe([[-0.25, 0.05], [-0.25, 0.1], [-0.2, 0.13], [-0.05, 0.13], [0.0, 0.1], [0.0, 0.0]], { segs: 14 }), paint);
  K.add(M.metal, lathe([[-0.3, 0.0], [-0.3, 0.045], [-0.25, 0.05]], { segs: 8 }), STEEL);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    K.add(M.metal, rod([c * 0.1, sn * 0.1, -0.13], [c * 0.2, sn * 0.2, -0.13], 0.034, 0.03, 8), DARK);
    for (const q of [0.15, 0.17, 0.19]) K.add(M.metal, rod([c * q, sn * q, -0.13], [c * (q + 0.007), sn * (q + 0.007), -0.13], 0.046, 0.046, 8), STEEL);
  }
  for (const sx of [-1, 1]) K.add(M.metal, pipe([[sx * 0.09, -0.1, -0.1], [sx * 0.13, -0.16, -0.06], [sx * 0.13, -0.17, 0.06]], 0.018, { segs: 6, steps: 8 }), DARK);
  const base = K.build({ seed: 0.71 });
  const B = new Kit();
  B.add(M.metal, lathe([[-0.47, 0.0], [-0.45, 0.03], [-0.39, 0.068], [-0.31, 0.082], [-0.27, 0.082], [-0.27, 0.0]], { segs: 12 }), CHROME);
  const cm = Math.max(0.12, r * 0.3);
  const SEC = [[0, 0.5, 0.045, 0.95], [0.2, 0.8, 0.04, 0.78], [0.45, 1, 0.03, 0.56], [0.75, 0.85, 0.02, 0.4], [0.9, 0.7, 0.014, 0.33]];
  const sect = (z, ch, th, tw) => {
    const out = [];
    for (let i = 0; i < 8; i++) {
      const f = (i / 8) * Math.PI * 2;
      const x = (Math.cos(f) * ch) / 2;
      const y = (Math.sin(f) * th) / 2;
      out.push([x * Math.cos(tw) - y * Math.sin(tw), x * Math.sin(tw) + y * Math.cos(tw), z]);
    }
    return out;
  };
  for (let k = 0; k < 3; k++) {
    const g = loft(SEC.map(([t, c, th, tw]) => sect(0.05 + t * (r - 0.05), cm * c, th, tw)));
    const tip = loft([sect(0.05 + 0.9 * (r - 0.05), cm * 0.7, 0.014, 0.33), sect(r, cm * 0.42, 0.01, 0.3)]);
    for (const [gg, col] of [[g, paint], [tip, WHITE]]) {
      gg.rotateX(-Math.PI / 2);
      gg.translate(0, 0, -0.32);
      gg.rotateZ((k * 2 * Math.PI) / 3);
      B.add(M.paint, gg, col);
    }
  }
  const spin = new THREE.Group();
  spin.add(B.build({ seed: 0.73 }));
  const g = new THREE.Group();
  g.add(base);
  g.add(spin);
  return wrap(g, { spin, r });
}

// ------------------------------------------------------------------ spikes (ROADMAP 11.25)
// spikes all round a car (D: its size), a rail along each sill and across its back, cones out of
// them (len: how long they were drawn)
export function spikesModel(D, len, clear = 0.25) {
  const M = itemMats();
  const K = new Kit();
  const L = Math.max(0.16, Math.min(0.42, 0.12 + len * 0.1));
  const y = clear + 0.16;
  const cone = (x, z, dx, dz) => {
    const c = new THREE.ConeGeometry(0.075, L, 8);
    // (pointing out along dx, dz)
    if (dx) c.rotateZ(-Math.sign(dx) * Math.PI / 2);
    else c.rotateX(Math.sign(dz) * Math.PI / 2);
    c.translate(x + (dx * L) / 2, y, z + (dz * L) / 2);
    K.add(M.metal, c, CHROME);
  };
  for (const s of [-1, 1]) {
    K.box(M.metal, s * D.hw - 0.05, y - 0.06, -D.hl * 0.85, s * D.hw + 0.05, y + 0.06, D.hl * 0.8, DARK);
    const n = Math.max(4, Math.round(D.hl * 2.4));
    for (let i = 0; i < n; i++) cone(s * (D.hw + 0.05), -D.hl * 0.8 + (i / (n - 1)) * D.hl * 1.55, s, 0);
  }
  K.box(M.metal, -D.hw, y - 0.06, -D.hl - 0.05, D.hw, y + 0.06, -D.hl + 0.05, DARK);
  const nb = Math.max(3, Math.round(D.hw * 3));
  for (let i = 0; i < nb; i++) cone(-D.hw * 0.85 + (i / (nb - 1)) * D.hw * 1.7, -D.hl - 0.05, 0, -1);
  return wrap(K.build({ seed: 0.99 }), { len: L });
}

export function floatModel(len, hw, paint) {
  const M = itemMats();
  const K = new Kit();
  const L = Math.max(1.6, len);
  const r = 0.24;
  for (const s of [-1, 1]) {
    const x = s * (hw + r * 0.6);
    K.cyl(M.paint, r, r, -L / 2 + r, L / 2 - r, paint, { x, segs: 16 });
    K.sphere(M.paint, r, x, 0, L / 2 - r, paint, 1, 1, 1.3, 12);
    K.sphere(M.paint, r, x, 0, -L / 2 + r, paint, 1, 1, 1.1, 12);
    for (const z of [-L * 0.25, L * 0.25]) K.cyl(M.matte, r * 1.02, r * 1.02, z - 0.06, z + 0.06, WHITE, { x, segs: 16 });
    // (struts up to the body)
    for (const z of [-L * 0.3, L * 0.3]) K.box(M.metal, x - s * 0.02 - 0.03, 0.1, z - 0.04, x - s * (r * 0.6 + 0.06) + 0.03, 0.42, z + 0.04, STEEL);
  }
  return wrap(K.build({ seed: 0.97 }), { L, r });
}

// ------------------------------------------------------------------ links (ROADMAP 28)
// what joins things, each at its own place on the ride (game/buildtray.js linkAt), its foot at the origin: the coupler -
// a tow bar out of the tail with a clamp ring on it, its pin through; the mode shift - a switch box with its lever and
// three lamps; the chassis link - two arms out of the side with a locking plate; the cargo mount - a rack on the roof,
// two rails and a stop at its front
export function linkModel(kind, D, paint) {
  const M = itemMats();
  const K = new Kit();
  const YEL = linC(0.98, 0.78, 0.16);
  if (kind === 'coupler') {
    K.box(M.metal, -0.07, -0.05, -0.16, 0.07, 0.05, 0.18, STEEL);
    K.box(M.metal, -0.14, -0.09, 0.1, 0.14, 0.09, 0.18, DARK);
    K.torus(M.metal, 0.13, 0.035, 0, 0.0, -0.27, CHROME, Math.PI / 2, 0);
    K.cyl(M.metal, 0.028, 0.028, -0.12, 0.16, YEL, { axis: 'y', z: -0.16 });
    K.sphere(M.metal, 0.05, 0, 0.18, -0.16, YEL);
    K.box(M.matte, -0.09, -0.07, -0.02, 0.09, 0.07, 0.04, paint);
  } else if (kind === 'mode') {
    // (ROADMAP 28.24) a shifter as one is made: a cast base bolted down, a gate plate with its three slots and the
    // slot across them, a rubber boot, the lever leaning out of it with its knob; three lamps in their bezels - road,
    // air, water; its loom out of the back
    K.add(M.metal, cbox(-0.17, 0, -0.22, 0.17, 0.09, 0.22, 0.022), DARK);
    K.add(M.paint, cbox(-0.14, 0.088, -0.19, 0.14, 0.104, 0.19, 0.005), paint);
    for (const x of [-0.07, 0, 0.07]) K.add(M.matte, cbox(x - 0.012, 0.103, -0.03, x + 0.012, 0.108, 0.13, 0.001), DARK);
    K.add(M.matte, cbox(-0.082, 0.103, 0.038, 0.082, 0.108, 0.062, 0.001), DARK);
    K.add(M.matte, lathe([[0.104, 0.052], [0.128, 0.04], [0.146, 0.046], [0.166, 0.03], [0.186, 0.034], [0.2, 0.018]], { axis: 'y', z: 0.05, segs: 10 }), RUBBER);
    K.add(M.metal, rod([0, 0.19, 0.05], [0.035, 0.35, 0.01], 0.014, 0.011, 8), CHROME);
    K.sphere(M.metal, 0.044, 0.038, 0.37, 0.006, YEL);
    for (const [x, c] of [[-0.08, linC(0.3, 0.85, 0.4)], [0, linC(0.35, 0.65, 1)], [0.08, linC(1, 0.5, 0.2)]]) {
      K.add(M.metal, lathe([[0.104, 0.032], [0.122, 0.032], [0.122, 0.022]], { axis: 'y', x, z: -0.13, segs: 10 }), CHROME);
      K.add(M.glow, lathe([[0.118, 0.022], [0.134, 0.013], [0.134, 0.0]], { axis: 'y', x, z: -0.13, segs: 10 }), c);
    }
    for (const x of [-0.14, 0.14]) for (const z of [-0.19, 0.19]) K.add(M.metal, rod([x, 0.086, z], [x, 0.1, z], 0.014, 0.011, 6), CHROME);
    K.add(M.matte, pipe([[0.08, 0.05, -0.2], [0.1, 0.04, -0.28], [0.15, 0.0, -0.32]], 0.016, { segs: 5, steps: 8 }), RUBBER);
  } else if (kind === 'dual') {
    // (ROADMAP 28.24) a docking clamp as one is made: two box arms out of the chassis, a heavy beam across them; at
    // each end a jaw open outwards, a pin down through it on a yellow handle; two rubber buffers on its face; a ram
    // that draws it in
    for (const z of [-0.55, 0.55]) {
      K.add(M.metal, cbox(0, -0.045, z - 0.055, 0.4, 0.045, z + 0.055, 0.012), STEEL);
      K.add(M.metal, plate([[0.38, -0.125], [0.62, -0.125], [0.62, -0.07], [0.48, -0.07], [0.48, 0.07], [0.62, 0.07], [0.62, 0.125], [0.38, 0.125]], -(z + 0.06), -(z - 0.06), { bevel: 0.008 }).rotateY(Math.PI / 2), DARK);
      K.add(M.metal, rod([0.56, -0.17, z], [0.56, 0.19, z], 0.018, 0.018, 8), CHROME);
      K.add(M.metal, rod([0.52, 0.2, z], [0.6, 0.2, z], 0.016, 0.016, 6), YEL);
    }
    K.add(M.metal, cbox(0.36, -0.075, -0.5, 0.45, 0.075, 0.5, 0.014), DARK);
    K.add(M.paint, cbox(0.45, -0.05, -0.34, 0.462, 0.05, 0.34, 0.004), paint);
    for (const z of [-0.22, 0.22]) K.add(M.round, lathe([[0.46, 0.0], [0.46, 0.055], [0.49, 0.055], [0.51, 0.036], [0.51, 0.0]], { axis: 'x', z, segs: 10 }), RUBBER);
    K.add(M.metal, rod([0.06, 0.0, -0.42], [0.24, 0.0, -0.2], 0.032, 0.032, 8), STEEL);
    K.add(M.metal, rod([0.24, 0.0, -0.2], [0.37, 0.0, -0.05], 0.015, 0.015, 6), CHROME);
  } else {
    const w = Math.min(0.62, D.hw * 0.72);
    const l = Math.min(0.9, D.hl * 0.42);
    // (ROADMAP 28.24) a carrier as one is made: two rails of tube, their ends turned down, each on two clamped feet;
    // five slats across; two channels the carried ride's wheels sit in; a fairing at the front; the catch that lets
    // it go at the back
    for (const s of [-1, 1]) {
      K.add(M.metal, pipe([[s * w, 0.03, -l - 0.05], [s * w, 0.1, -l + 0.04], [s * w, 0.1, l - 0.04], [s * w, 0.03, l + 0.05]], 0.022, { segs: 7, steps: 18, tension: 0.15 }), CHROME);
      for (const z of [-l * 0.72, l * 0.72]) {
        K.add(M.metal, cbox(s * w - 0.045, 0, z - 0.05, s * w + 0.045, 0.085, z + 0.05, 0.014), DARK);
        K.add(M.metal, rod([s * (w + 0.044), 0.045, z], [s * (w + 0.064), 0.045, z], 0.014, 0.011, 6), CHROME);
      }
      K.add(M.metal, plate([[-l * 0.55, 0.1], [l * 0.55, 0.1], [l * 0.55, 0.135], [l * 0.55 - 0.02, 0.135], [l * 0.55 - 0.02, 0.112], [-l * 0.55 + 0.02, 0.112], [-l * 0.55 + 0.02, 0.135], [-l * 0.55, 0.135]], s * w * 0.55 - 0.07, s * w * 0.55 + 0.07, { bevel: 0.004 }), DARK);
    }
    for (const z of [-l * 0.8, -l * 0.4, 0, l * 0.4, l * 0.8]) K.add(M.metal, cbox(-w, 0.082, z - 0.03, w, 0.1, z + 0.03, 0.005), STEEL);
    K.add(M.paint, plate([[l - 0.03, 0.1], [l + 0.12, 0.1], [l + 0.1, 0.13], [l, 0.25], [l - 0.03, 0.25]], -w, w, { bevel: 0.006 }), paint);
    K.add(M.metal, plate([[-l - 0.02, 0.1], [-l + 0.12, 0.1], [-l + 0.12, 0.13], [-l + 0.04, 0.13], [-l + 0.02, 0.19], [-l - 0.02, 0.19]], -w * 0.3, w * 0.3, { bevel: 0.006 }), YEL);
  }
  return wrap(K.build({ seed: 0.57 }));
}

// (ROADMAP 28.15) a gun of the hand on a ride's roof: a post on a yellow plate, a swivel, and the gun itself on it - twice
// as big as in the hand, to be seen up there. Its handles as a barrel's (pivot: what turns; muzzle and pivotPt in the pivot's frame)
export function handMountModel(hand, k = 2.1) {
  const M = itemMats();
  const K = new Kit();
  K.cyl(M.metal, 0.08, 0.06, 0, 0.3, DARK, { axis: 'y' });
  K.box(M.metal, -0.16, 0, -0.16, 0.16, 0.04, 0.16, linC(0.98, 0.78, 0.16));
  K.sphere(M.metal, 0.07, 0, 0.32, 0, CHROME);
  const post = K.build({ seed: 0.91 });
  const wm = buildWeaponModel(hand.id, hand.grade || 'good', { seed: hand.score || 0.8 });
  const mz = wm.muzzle || new THREE.Vector3(0, 0.05, 0.4);
  const hold = new THREE.Group();
  hold.add(wm.group);
  hold.scale.setScalar(k);
  // (its grip over the post: a third of the way along it)
  const back = Math.min(0.2, (wm.length || 0.5) * 0.3);
  hold.position.set(0, 0.03, -back * k);
  const pivot = new THREE.Group();
  pivot.position.y = 0.36;
  pivot.add(hold);
  const g = new THREE.Group();
  g.add(post);
  g.add(pivot);
  const my = 0.03 + mz.y * k;
  return wrap(g, { pivot, muzzle: new THREE.Vector3(0, my, (mz.z - back) * k), pivotPt: new THREE.Vector3(0, my, 0), r: 0.05, len: (wm.length || 0.5) * k });
}
