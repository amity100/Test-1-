import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { helixGeometry } from './drawncar.js';

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
    // the tyre (rounded at its shoulders), the rim, the hub, the spokes
    const tyre = new THREE.CylinderGeometry(r, r, w * 0.82, 24, 1);
    tyre.rotateZ(Math.PI / 2);
    K.add(M.round, tyre, RUBBER);
    for (const s of [-1, 1]) {
      const sh = new THREE.TorusGeometry(r - w * 0.09, w * 0.1, 6, 24);
      sh.rotateY(Math.PI / 2);
      sh.translate((s * w * 0.41), 0, 0);
      K.add(M.round, sh, RUBBER);
    }
    const rim = new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 0.9, 18, 1);
    rim.rotateZ(Math.PI / 2);
    K.add(M.metal, rim, paint);
    const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.24, w * 1.02, 10, 1);
    hub.rotateZ(Math.PI / 2);
    K.add(M.metal, hub, CHROME);
    const nSp = big ? 6 : 5;
    for (let i = 0; i < nSp; i++) {
      const a = (i / nSp) * Math.PI * 2;
      const sp = new THREE.BoxGeometry(w * 0.94, r * 0.09, r * 0.4);
      sp.translate(0, 0, r * 0.38);
      sp.rotateX(a);
      K.add(M.metal, sp, CHROME);
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
  const g = new THREE.BoxGeometry(span, t, chord, 6, 1, 1);
  // taper, sweep and dihedral: narrower and further back towards its tip, the tip a little up
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) + span / 2;
    const k = x / span;
    P.setZ(i, P.getZ(i) * (1 - 0.45 * k) - chord * 0.28 * k);
    P.setY(i, P.getY(i) + span * 0.09 * k);
    P.setX(i, x);
  }
  g.computeVertexNormals();
  K.add(M.paint, side < 0 ? mirrorX(g) : g, paint);
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
  const M = itemMats();
  const K = new Kit();
  K.cyl(M.round, 0.06, 0.05, 0, 0.42, DARK, { axis: 'y' });
  K.cyl(M.round, 0.15, 0.13, 0, 0.12, STEEL, { axis: 'y' });
  const base = K.build({ seed: 0.61 });
  const B = new Kit();
  B.cyl(M.metal, 0.11, 0.09, 0.38, 0.5, CHROME, { axis: 'y' });
  for (const s of [-1, 1]) {
    const bl = new THREE.BoxGeometry(span / 2, 0.035, Math.max(0.14, span * 0.06));
    bl.translate((s * span) / 4, 0.46, 0);
    // (a little twist along it)
    bl.rotateX(s * 0.08);
    B.add(M.paint, bl, paint);
    const tip = new THREE.BoxGeometry(span * 0.06, 0.04, Math.max(0.15, span * 0.065));
    tip.translate(s * span * 0.47, 0.46, 0);
    B.add(M.matte, tip, WHITE);
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
  K.cyl(M.metal, r0, r0 * 1.06, 0, -L * 0.55, paint);
  K.cyl(M.metal, r0 * 1.06, r1, -L * 0.55, -L, STEEL);
  K.torus(M.metal, r0 * 1.08, 0.025, 0, 0, -L * 0.3, CHROME);
  K.torus(M.metal, r1 * 1.02, 0.03, 0, 0, -L, CHROME);
  K.cyl(M.matte, r1 * 0.86, r1 * 0.86, -L + 0.02, -L + 0.05, DARK);
  // (its mount onto the thing)
  K.box(M.metal, -0.08, -r0 - 0.08, -0.25, 0.08, -r0 + 0.02, 0.05, STEEL);
  const g = K.build({ seed: 0.71 });
  const F = new Kit();
  const fl = new THREE.ConeGeometry(r1 * 0.9, 1, 12, 1, true);
  fl.rotateX(-Math.PI / 2);
  fl.translate(0, 0, -0.5);
  F.add(M.glow, fl, FLAME_B);
  const inner = new THREE.ConeGeometry(r1 * 0.5, 0.7, 10, 1, true);
  inner.rotateX(-Math.PI / 2);
  inner.translate(0, 0, -0.35);
  F.add(M.glow, inner, FLAME_A);
  const flame = new THREE.Group();
  flame.add(F.build({ seed: 0.73 }));
  flame.position.z = -L;
  flame.scale.set(1, 1, 0.001);
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
  const P = new Kit();
  const y = kind === 'turret' ? 0.24 : 0.2;
  P.box(M.paint, -0.2 - R, y - 0.12, -0.24, 0.2 + R, y + 0.12 + R * 0.5, 0.2, paint);
  P.cyl(M.metal, R, R * 0.92, 0.18, 0.18 + L, DARK, { y });
  P.cyl(M.metal, R * 1.45, R * 1.4, 0.18 + L - Math.min(0.2, L * 0.15), 0.18 + L, STEEL, { y });
  if (!cannon) {
    // a machine gun: its cooling jacket and the box of rounds at its side
    P.cyl(M.metal, R * 1.6, R * 1.6, 0.2, 0.2 + L * 0.45, STEEL, { y, segs: 8 });
    P.box(M.matte, 0.2 + R, y - 0.16, -0.14, 0.34 + R, y + 0.02, 0.1, linC(0.3, 0.38, 0.22));
  } else {
    P.torus(M.metal, R * 1.25, R * 0.25, 0, y, 0.4, CHROME);
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
  const M = itemMats();
  const K = new Kit();
  K.cyl(M.metal, 0.05, 0.05, -0.3, 0, STEEL);
  const base = K.build({ seed: 0.71 });
  const B = new Kit();
  B.cyl(M.metal, 0.1, 0.07, -0.38, -0.26, CHROME);
  for (let k = 0; k < 3; k++) {
    const bl = new THREE.BoxGeometry(Math.max(0.12, r * 0.42), r, 0.03);
    bl.translate(0, r / 2 + 0.06, -0.32);
    // (each blade a little twisted, as a propeller's are)
    bl.rotateY(0.35);
    bl.rotateZ((k * 2 * Math.PI) / 3);
    B.add(M.paint, bl, paint);
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
