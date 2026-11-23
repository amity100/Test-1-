// (ROADMAP 28.22) The rides modelled as the real machines are made - a hull with its chines and its rub rail, a
// fuselage with its cowl and its doors, a wing with an aerofoil's section, an outboard with its leg and its
// propeller - with the kit real weapons are modelled with (game/armkit.js). Each builder draws into a Kit of
// game/items.js (K) with its pens (M) and returns { parts: { name: { kit, at } } } for what turns (wheels, a
// propeller, a rotor). game/rides.js and game/vehicles.js make the ride of it: where the rider sits, how it goes -
// none of that is here, and none of it changed.
//
// A ride's own frame: z forward, y up, x across; on the ground (or the water) at y = 0.
import * as THREE from 'three';
import { lin3 } from '../render/materials.js';
import { plate, cbox, lathe, rod, pipe, tilted, mirrored, screw, rounded, ring, loft } from './armkit.js';

const C = (r, g, b) => lin3(r, g, b);

const P = {
  white: C(0.93, 0.92, 0.88),
  white2: C(0.8, 0.8, 0.78),
  red: C(0.58, 0.07, 0.09), // (deep: a bright red goes to bare paper in the evening sun)
  red2: C(0.42, 0.05, 0.07),
  yellow: C(0.95, 0.74, 0.16),
  yellow2: C(0.78, 0.56, 0.1),
  ink: C(0.09, 0.09, 0.12),
  rubber: C(0.13, 0.13, 0.16),
  steel: C(0.3, 0.32, 0.38),
  steel2: C(0.46, 0.48, 0.55),
  chrome: C(0.84, 0.85, 0.89),
  teak: C(0.52, 0.36, 0.2),
  teak2: C(0.36, 0.23, 0.12),
  glass: C(0.5, 0.68, 0.84),
  glassD: C(0.2, 0.3, 0.44),
  cowl: C(0.2, 0.21, 0.26),
  label: C(0.93, 0.9, 0.8),
  navRed: C(1.0, 0.2, 0.25),
  navGreen: C(0.3, 1.0, 0.4),
  lamp: C(1.0, 0.95, 0.75),
  blue: C(0.16, 0.36, 0.72),
  olive: C(0.36, 0.44, 0.26),
  olive2: C(0.26, 0.32, 0.19),
  paper: C(0.95, 0.93, 0.87),
  rule: C(0.5, 0.62, 0.86),
};

// a wheel with a tyre that has shoulders, a dished rim, its spokes and its nuts, turning about x (in its own kit)
function wheelKit(Kit, M, r, w, o = {}) {
  const W = new Kit();
  const rr = r * (o.rim || 0.62);
  W.add(M.round, lathe([[-w / 2, rr], [-w / 2, r * 0.9], [-w * 0.32, r], [w * 0.32, r], [w / 2, r * 0.9], [w / 2, rr]], { axis: 'x', segs: o.segs || 20 }), P.rubber);
  for (const x of [-w * 0.16, w * 0.16]) W.add(M.matte, lathe([[x - w * 0.03, r * 1.004], [x + w * 0.03, r * 1.004]], { axis: 'x', segs: o.segs || 20 }), P.ink);
  W.add(M.metal, lathe([[-w * 0.44, 0.0], [-w * 0.44, rr], [-w * 0.3, rr * 1.02], [-w * 0.12, rr * 0.78], [-w * 0.1, r * 0.2], [-w * 0.2, r * 0.16], [-w * 0.2, 0.0]], { axis: 'x', segs: 16 }), o.col || P.chrome);
  W.add(M.metal, lathe([[w * 0.2, 0.0], [w * 0.2, r * 0.16], [w * 0.1, r * 0.2], [w * 0.12, rr * 0.78], [w * 0.3, rr * 1.02], [w * 0.44, rr], [w * 0.44, 0.0]], { axis: 'x', segs: 16 }), o.col || P.chrome);
  const n = o.spokes || 5;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    for (const s of [1, -1]) W.add(M.metal, rod([s * w * 0.16, Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18], [s * w * 0.3, Math.cos(a) * rr * 0.96, Math.sin(a) * rr * 0.96], r * 0.07, r * 0.05, 5), o.col || P.chrome);
    for (const s of [1, -1]) W.add(M.metal, rod([s * w * 0.2, Math.cos(a + 0.6) * r * 0.11, Math.sin(a + 0.6) * r * 0.11], [s * w * 0.26, Math.cos(a + 0.6) * r * 0.11, Math.sin(a + 0.6) * r * 0.11], r * 0.025, r * 0.025, 5), P.steel);
  }
  return W;
}

export const RIDEKITS = {
  // ---------------------------------------------------------------------------------------------- the jet ski
  // A runabout: a V hull with its chine and a black rub rail round the gunwale, a moulded deck in yellow, a long
  // stepped saddle, the steering column with its bars, grips, throttle lever and a little screen ahead of them,
  // mirrors, the foot wells with their mats, a grab handle behind the saddle, the jet's nozzle and its bucket at
  // the stern, sponsons, a tow eye at the bow.
  jetski(K, M) {
    // --- the hull
    const hull = [
      ring(-1.48, 0.46, 0.1, 0.5, { e: 0.55, eb: 1.3, cy: 0.42 }),
      ring(-1.2, 0.56, 0.02, 0.52, { e: 0.55, eb: 1.3, cy: 0.42 }),
      ring(-0.3, 0.62, -0.04, 0.54, { e: 0.55, eb: 1.4, cy: 0.42 }),
      ring(0.6, 0.58, -0.02, 0.56, { e: 0.55, eb: 1.5, cy: 0.44 }),
      ring(1.3, 0.4, 0.1, 0.6, { e: 0.6, eb: 1.6, cy: 0.48 }),
      ring(1.75, 0.2, 0.26, 0.63, { e: 0.7, eb: 1.6, cy: 0.52 }),
      ring(1.98, 0.04, 0.44, 0.62, { e: 0.8, eb: 1.4, cy: 0.56 }),
    ];
    K.add(M.paint, loft(hull), P.white);
    // (the rub rail round it, where hull meets deck)
    K.add(M.round, pipe([[0, 0.56, 2.0], [0.21, 0.54, 1.75], [0.41, 0.5, 1.3], [0.59, 0.46, 0.6], [0.63, 0.44, -0.3], [0.57, 0.44, -1.2], [0.47, 0.44, -1.5], [-0.47, 0.44, -1.5], [-0.57, 0.44, -1.2], [-0.63, 0.44, -0.3], [-0.59, 0.46, 0.6], [-0.41, 0.5, 1.3], [-0.21, 0.54, 1.75]], 0.028, { closed: true, steps: 60, tension: 0.3, segs: 6 }), P.rubber);
    for (const s of [1, -1]) {
      K.add(M.paint, plate([[-1.2, 0.2], [0.9, 0.24], [1.3, 0.36], [0.9, 0.3], [-1.2, 0.27]], s * 0.6, s * 0.615, { bevel: 0.003 }), P.red);
      for (let i = 0; i < 4; i++) K.add(M.matte, cbox(s * 0.4 - 0.002, 0.44, 1.02 + i * 0.07, s * 0.4 + 0.002, 0.53, 1.06 + i * 0.07, 0.001).rotateY(s * -0.42).translate(s * 0.44, 0, -0.42), P.ink);
      // (a sponson low at the stern)
      K.add(M.matte, plate(rounded([[-1.4, 0.1], [-0.8, 0.08], [-0.74, 0.14], [-0.8, 0.2], [-1.4, 0.22]], 0.02, 3), s * 0.5, s * 0.66, { bevel: 0.02 }), P.rubber);
    }
    // --- the deck: the hood ahead, the tunnel the saddle sits on, the foot wells either side
    const deck = [
      ring(-1.42, 0.3, 0.44, 0.62, { e: 0.5 }),
      ring(-1.0, 0.3, 0.44, 0.7, { e: 0.5 }),
      ring(0.1, 0.3, 0.44, 0.74, { e: 0.5 }),
      ring(0.45, 0.38, 0.44, 0.92, { e: 0.6 }),
      ring(0.9, 0.42, 0.46, 0.86, { e: 0.7 }),
      ring(1.5, 0.26, 0.5, 0.72, { e: 0.8 }),
      ring(1.9, 0.06, 0.54, 0.64, { e: 0.9 }),
    ];
    K.add(M.paint, loft(deck), P.yellow);
    for (const s of [1, -1]) {
      K.add(M.paint, plate([[-1.4, 0.44], [0.9, 0.44], [1.2, 0.5], [0.9, 0.52], [-1.4, 0.5]], s * 0.3, s * 0.58, { bevel: 0.02 }), P.yellow2);
      K.add(M.matte, cbox(s * 0.33, 0.5, -1.1, s * 0.56, 0.515, 0.4, 0.004), P.rubber);
      for (let i = 0; i < 9; i++) K.add(M.matte, cbox(s * 0.34, 0.515, -1.05 + i * 0.16, s * 0.55, 0.522, -0.98 + i * 0.16, 0.002), P.ink);
    }
    // (the hood's seam, its vents, the filler cap, the maker's plate)
    K.add(M.matte, pipe([[0.36, 0.6, 0.62], [0.3, 0.8, 0.9], [0, 0.875, 0.92], [-0.3, 0.8, 0.9], [-0.36, 0.6, 0.62]], 0.008, { steps: 20, segs: 4 }), P.yellow2);
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) K.add(M.matte, cbox(-0.05, 0.0, -0.012, 0.05, 0.004, 0.012, 0.002).rotateZ(s * 0.5).translate(s * 0.26, 0.77, 1.1 + i * 0.07), P.ink);
    K.add(M.metal, lathe([[0.78, 0.0], [0.78, 0.045], [0.796, 0.045], [0.8, 0.035], [0.8, 0.0]], { axis: 'y', z: 1.32, segs: 12 }), P.chrome);
    // --- the saddle: long, stepped for a second rider, a strap across it; the grab handle behind
    const sad = [
      ring(-1.2, 0.17, 0.6, 0.8, { e: 0.6 }),
      ring(-1.0, 0.2, 0.62, 0.92, { e: 0.6 }),
      ring(-0.62, 0.21, 0.66, 0.94, { e: 0.6 }),
      ring(-0.5, 0.21, 0.66, 0.88, { e: 0.6 }),
      ring(-0.1, 0.2, 0.68, 0.87, { e: 0.6 }),
      ring(0.2, 0.17, 0.7, 0.9, { e: 0.6 }),
    ];
    K.add(M.matte, loft(sad), P.ink);
    K.add(M.matte, cbox(-0.215, 0.7, -0.4, 0.215, 0.895, -0.34, 0.006), P.steel);
    for (const s of [1, -1]) K.add(M.matte, plate([[-1.0, 0.7], [0.1, 0.74], [0.1, 0.78], [-1.0, 0.74]], s * 0.2, s * 0.214, { bevel: 0.002 }), P.red);
    K.add(M.metal, pipe([[-0.2, 0.62, -1.18], [-0.22, 0.74, -1.32], [0, 0.78, -1.38], [0.22, 0.74, -1.32], [0.2, 0.62, -1.18]], 0.018, { steps: 20, tension: 0.3, segs: 6 }), P.steel2);
    // --- the steering: the column and its pad, the bars, the grips, the throttle and the stop lanyard; the screen; mirrors
    K.add(M.paint, rod([0, 0.86, 0.5], [0, 1.06, 0.4], 0.06, 0.05, 10), P.yellow2);
    K.add(M.matte, cbox(-0.11, 1.03, 0.34, 0.11, 1.1, 0.46, 0.02), P.ink);
    K.add(M.metal, rod([-0.3, 1.08, 0.4], [0.3, 1.08, 0.4], 0.014, 0.014, 8), P.steel2);
    for (const s of [1, -1]) {
      K.add(M.round, lathe([[0.22, 0.0], [0.22, 0.022], [0.34, 0.02], [0.346, 0.026], [0.35, 0.0]], { axis: 'x', y: 1.08, z: 0.4, segs: 10 }).scale(s, 1, 1), P.rubber);
      K.add(M.metal, rod([s * 0.2, 1.085, 0.42], [s * 0.31, 1.07, 0.46], 0.006, 0.005, 5), P.chrome);
      K.add(M.metal, rod([s * 0.2, 0.9, 0.72], [s * 0.36, 1.0, 0.78], 0.01, 0.01, 6), P.ink);
      K.add(M.glass, cbox(s * 0.36 - 0.05, 0.97, 0.775, s * 0.36 + 0.05, 1.04, 0.786, 0.006), P.glassD);
    }
    K.add(M.glass, plate(rounded([[0.56, 0.9], [0.66, 0.9], [0.6, 1.14], [0.54, 1.12]], 0.02, 3), -0.2, 0.2, { bevel: 0.006 }), P.glassD);
    K.add(M.glow, cbox(-0.05, 1.1, 0.4, 0.05, 1.104, 0.45, 0.001), C(0.4, 0.9, 1.0));
    K.add(M.matte, pipe([[0.08, 1.06, 0.36], [0.14, 0.98, 0.3], [0.1, 0.9, 0.26]], 0.005, { steps: 12, segs: 4 }), P.red);
    // --- the stern: the nozzle of the jet, its ring, the bucket over it; the ride plate; the tail lamp; the bow eye
    K.add(M.metal, lathe([[-1.6, 0.085], [-1.6, 0.11], [-1.52, 0.12], [-1.44, 0.12]], { y: 0.2, segs: 14 }), P.steel);
    K.add(M.matte, lathe([[-1.598, 0.085], [-1.598, 0.0]], { y: 0.2, segs: 12 }), P.ink);
    K.add(M.metal, plate(rounded([[-1.68, 0.3], [-1.56, 0.34], [-1.5, 0.3], [-1.56, 0.26]], 0.01, 2), -0.13, 0.13, { bevel: 0.006 }), P.steel2);
    K.add(M.metal, cbox(-0.2, 0.05, -1.62, 0.2, 0.07, -1.3, 0.005), P.steel2);
    K.add(M.glow, cbox(-0.1, 0.5, -1.5, 0.1, 0.56, -1.47, 0.006), P.navRed);
    K.add(M.metal, pipe([[-0.03, 0.44, 1.93], [0, 0.42, 2.0], [0.03, 0.44, 1.93]], 0.008, { steps: 10, segs: 5 }), P.chrome);
    return { parts: {} };
  },

  // ---------------------------------------------------------------------------------------------- the speedboat
  // A runabout of the bay: a V hull with a spray rail and a red boot stripe, a laid teak deck, a foredeck with its
  // cleats, hatch and bow rail, a wrap of glass in a chromed frame, the helm - wheel, dials, throttle - on its
  // starboard side, two seats and a bench, and an outboard clamped to the transom: its cowl, its leg, the plate
  // over the propeller, the propeller, the skeg.
  boat(K, M) {
    // --- the hull
    const hull = [
      ring(-2.62, 1.0, 0.16, 0.86, { e: 0.45, eb: 1.3, cy: 0.62, n: 18 }),
      ring(-2.2, 1.08, 0.06, 0.86, { e: 0.45, eb: 1.3, cy: 0.62, n: 18 }),
      ring(-0.6, 1.15, -0.02, 0.88, { e: 0.45, eb: 1.4, cy: 0.62, n: 18 }),
      ring(1.0, 1.12, 0.0, 0.92, { e: 0.45, eb: 1.5, cy: 0.66, n: 18 }),
      ring(2.2, 0.86, 0.14, 0.98, { e: 0.5, eb: 1.6, cy: 0.72, n: 18 }),
      ring(3.0, 0.48, 0.38, 1.04, { e: 0.6, eb: 1.6, cy: 0.82, n: 18 }),
      ring(3.6, 0.05, 0.72, 1.08, { e: 0.8, eb: 1.4, cy: 0.94, n: 18 }),
    ];
    K.add(M.paint, loft(hull), P.white);
    const gun = [[0, 1.08, 3.62], [0.5, 1.03, 3.0], [0.88, 0.97, 2.2], [1.14, 0.91, 1.0], [1.17, 0.87, -0.6], [1.1, 0.85, -2.2], [1.02, 0.85, -2.64]];
    for (const s of [1, -1]) {
      K.add(M.round, pipe(gun.map(([x, y, z]) => [s * x, y, z]), 0.035, { steps: 40, tension: 0.3, segs: 6 }), P.red);
      // (the boot stripe, the spray rail under it; the name on her bow)
      K.add(M.paint, pipe([[s * 1.0, 0.5, -2.62], [s * 1.12, 0.48, -0.6], [s * 1.08, 0.52, 1.0], [s * 0.8, 0.62, 2.2], [s * 0.42, 0.76, 3.0]], 0.03, { steps: 30, tension: 0.3, segs: 5 }), P.red);
      K.add(M.matte, pipe([[s * 0.86, 0.3, -2.4], [s * 0.98, 0.26, -0.6], [s * 0.92, 0.3, 1.0], [s * 0.62, 0.42, 2.2]], 0.016, { steps: 24, tension: 0.3, segs: 4 }), P.white2);
      for (let i = 0; i < 5; i++) K.add(M.matte, cbox(-0.03, 0, -0.004, 0.03, 0.07, 0.004, 0.002).rotateY(s * -0.48).translate(s * (0.78 - i * 0.045), 0.78 + i * 0.01, 2.3 + i * 0.09), P.blue);
    }
    K.add(M.round, pipe([[-1.02, 0.85, -2.64], [-0.5, 0.86, -2.68], [0.5, 0.86, -2.68], [1.02, 0.85, -2.64]], 0.035, { steps: 12, segs: 6 }), P.red);
    // --- the cockpit: its sole of laid teak, the coamings inside the gunwales
    K.add(M.matte, cbox(-0.98, 0.5, -2.5, 0.98, 0.54, 1.75, 0.006), P.teak);
    for (let i = 0; i < 11; i++) K.add(M.matte, cbox(-0.9 + i * 0.18 - 0.006, 0.54, -2.48, -0.9 + i * 0.18 + 0.006, 0.546, 1.73, 0.002), P.teak2);
    for (const s of [1, -1]) K.add(M.paint, plate([[-2.56, 0.5], [1.78, 0.5], [1.78, 0.9], [-2.56, 0.84]], s * 0.96, s * 1.08, { bevel: 0.02 }), P.white);
    K.add(M.paint, plate([[-2.62, 0.5], [-2.5, 0.5], [-2.5, 0.86], [-2.62, 0.86]], -1.0, 1.0, { bevel: 0.02 }), P.white);
    // --- the foredeck: its camber, the hatch, two cleats and the bow rail, the lights
    const fd = [
      ring(1.72, 1.1, 0.86, 0.98, { e: 0.5, n: 14 }),
      ring(2.2, 0.86, 0.9, 1.03, { e: 0.5, n: 14 }),
      ring(3.0, 0.47, 0.96, 1.08, { e: 0.5, n: 14 }),
      ring(3.56, 0.06, 1.02, 1.1, { e: 0.6, n: 14 }),
    ];
    K.add(M.paint, loft(fd), P.white);
    K.add(M.paint, cbox(-0.26, 1.03, 2.3, 0.26, 1.06, 2.84, 0.012), P.white2);
    K.add(M.metal, lathe([[1.06, 0.0], [1.06, 0.02], [1.075, 0.02], [1.075, 0.0]], { axis: 'y', z: 2.57, segs: 8 }), P.chrome);
    for (const s of [1, -1]) {
      K.add(M.metal, rod([s * 0.5, 1.0, 2.34], [s * 0.5, 1.0, 2.5], 0.012, 0.012, 6), P.chrome);
      for (const z of [2.38, 2.46]) K.add(M.metal, rod([s * 0.5, 0.97, z], [s * 0.5, 1.0, z], 0.01, 0.01, 5), P.chrome);
      K.add(M.metal, pipe([[s * 1.0, 0.92, 1.9], [s * 0.98, 1.22, 2.0], [s * 0.6, 1.3, 2.9], [s * 0.12, 1.34, 3.5], [0, 1.34, 3.56]], 0.014, { steps: 30, tension: 0.3, segs: 6 }), P.chrome);
      for (const [x, y, z] of [[0.82, 1.26, 2.45], [0.42, 1.32, 3.15]]) K.add(M.metal, rod([s * x, 0.98, z], [s * x, y, z], 0.01, 0.01, 5), P.chrome);
    }
    K.add(M.glow, cbox(-0.92, 0.98, 2.1, -0.84, 1.03, 2.16, 0.006), P.navRed);
    K.add(M.glow, cbox(0.84, 0.98, 2.1, 0.92, 1.03, 2.16, 0.006), P.navGreen);
    // --- the screen: three panes in a chromed frame, raked back
    const scr = [[-1.0, 0.94, 1.5], [-0.62, 0.96, 1.8], [0.62, 0.96, 1.8], [1.0, 0.94, 1.5]];
    for (let i = 0; i < 3; i++) {
      const a = scr[i];
      const b = scr[i + 1];
      const g = new THREE.BufferGeometry();
      const top = 0.44;
      const rk = -0.2;
      const pts = [a[0], a[1], a[2], b[0], b[1], b[2], b[0] * 0.94, b[1] + top, b[2] + rk, a[0], a[1], a[2], b[0] * 0.94, b[1] + top, b[2] + rk, a[0] * 0.94, a[1] + top, a[2] + rk];
      g.setAttribute('position', new THREE.Float32BufferAttribute([...pts, pts[3], pts[4], pts[5], pts[0], pts[1], pts[2], pts[6], pts[7], pts[8], pts[12], pts[13], pts[14], pts[9], pts[10], pts[11], pts[15], pts[16], pts[17]], 3));
      g.computeVertexNormals();
      K.add(M.glass, g, P.glass);
      K.add(M.metal, rod([a[0] * 0.94, a[1] + top, a[2] + rk], [b[0] * 0.94, b[1] + top, b[2] + rk], 0.013, 0.013, 6), P.chrome);
      K.add(M.metal, rod(a, b, 0.016, 0.016, 6), P.chrome);
      K.add(M.metal, rod(a, [a[0] * 0.94, a[1] + top, a[2] + rk], 0.012, 0.012, 6), P.chrome);
      if (i === 2) K.add(M.metal, rod(b, [b[0] * 0.94, b[1] + top, b[2] + rk], 0.012, 0.012, 6), P.chrome);
    }
    // --- the helm (starboard is -x here): the console, the wheel on its boss, three dials, the throttle
    K.add(M.paint, plate(rounded([[0.02, 0.54], [0.5, 0.54], [0.56, 1.0], [0.44, 1.3], [0.1, 1.3], [0.02, 1.16]], 0.04, 3), -0.9, -0.12, { bevel: 0.03 }), P.white);
    K.add(M.matte, plate([[0.06, 1.14], [0.12, 1.28], [0.14, 1.28], [0.08, 1.14]], -0.86, -0.16, { bevel: 0.004 }), P.teak);
    for (let i = 0; i < 3; i++) {
      K.add(M.metal, lathe([[0.0, 0.0], [0.0, 0.04], [0.012, 0.04], [0.012, 0.0]], { segs: 12 }).rotateX(0.42).translate(-0.72 + i * 0.13, 1.215, 0.092), P.chrome);
      K.add(M.glow, lathe([[0.0125, 0.032], [0.0125, 0.0]], { segs: 10 }).rotateX(0.42).translate(-0.72 + i * 0.13, 1.215, 0.092), C(0.7, 0.9, 1.0));
    }
    K.add(M.metal, rod([-0.5, 1.2, 0.1], [-0.5, 1.26, 0.3], 0.018, 0.014, 8), P.steel2);
    const wheelA = Math.atan2(0.2, 0.06);
    K.add(M.round, new THREE.TorusGeometry(0.17, 0.016, 8, 22).rotateX(Math.PI / 2 - wheelA + Math.PI / 2).translate(-0.5, 1.262, 0.31), P.teak2);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      K.add(M.metal, rod([-0.5, 1.262, 0.31], [-0.5 + Math.cos(a) * 0.17, 1.262 + Math.sin(a) * 0.17 * 0.96, 0.31 - Math.sin(a) * 0.17 * 0.28], 0.008, 0.008, 5), P.chrome);
    }
    K.add(M.metal, cbox(-0.2, 1.0, 0.12, -0.14, 1.12, 0.3, 0.01), P.steel);
    K.add(M.metal, rod([-0.17, 1.1, 0.2], [-0.17, 1.26, 0.28], 0.01, 0.01, 6), P.chrome);
    K.add(M.round, lathe([[1.25, 0.0], [1.25, 0.022], [1.29, 0.022], [1.3, 0.0]], { axis: 'y', x: -0.17, z: 0.285, segs: 8 }), P.red);
    // --- the seats: two buckets with piped cushions, a bench across the stern; a fuel can, an extinguisher
    for (const s of [1, -1]) {
      K.add(M.round, plate(rounded([[-0.92, 0.54], [-0.32, 0.54], [-0.3, 0.92], [-0.78, 0.92], [-0.86, 1.46], [-1.0, 1.46]], 0.05, 3), s * 0.5 - 0.27, s * 0.5 + 0.27, { bevel: 0.04, bs: 2 }), P.white);
      K.add(M.round, cbox(s * 0.5 - 0.23, 0.92, -0.76, s * 0.5 + 0.23, 0.97, -0.34, 0.02), P.red);
      K.add(M.round, tilted(cbox(s * 0.5 - 0.22, 0.98, -0.8, s * 0.5 + 0.22, 1.4, -0.76, 0.02), 0.16, 0.98, -0.78), P.red);
    }
    K.add(M.round, cbox(-0.92, 0.54, -2.46, 0.92, 0.84, -2.02, 0.04), P.white);
    K.add(M.round, cbox(-0.88, 0.84, -2.44, 0.88, 0.89, -2.04, 0.02), P.red);
    K.add(M.paint, cbox(0.6, 0.54, -1.86, 0.88, 0.86, -1.5, 0.03), P.red);
    K.add(M.metal, lathe([[0.86, 0.0], [0.86, 0.04], [0.89, 0.04], [0.89, 0.0]], { axis: 'y', x: 0.8, z: -1.6, segs: 8 }), P.ink);
    K.add(M.paint, lathe([[0.54, 0.0], [0.54, 0.06], [0.84, 0.06], [0.88, 0.03], [0.92, 0.03], [0.92, 0.0]], { axis: 'y', x: -0.86, z: -1.7, segs: 10 }), P.red);
    // --- the outboard: its bracket on the transom, the cowl with its band and its plate, the leg, the plate over
    // the propeller, the gear case, the skeg
    const OZ = -2.92;
    K.add(M.metal, cbox(-0.16, 0.5, -2.74, 0.16, 0.92, -2.62, 0.02), P.steel);
    for (const s of [1, -1]) K.add(M.metal, rod([s * 0.1, 0.84, -2.6], [s * 0.1, 0.84, -2.52], 0.02, 0.02, 6), P.chrome);
    const cowl = [
      ring(OZ - 0.3, 0.14, 1.0, 1.36, { e: 0.6, n: 12 }),
      ring(OZ - 0.2, 0.21, 0.96, 1.5, { e: 0.6, n: 12 }),
      ring(OZ + 0.06, 0.22, 0.96, 1.54, { e: 0.6, n: 12 }),
      ring(OZ + 0.26, 0.17, 0.98, 1.44, { e: 0.6, n: 12 }),
    ];
    K.add(M.paint, loft(cowl), P.cowl);
    for (const s of [1, -1]) {
      K.add(M.paint, cbox(s * 0.218, 1.1, OZ - 0.2, s * 0.224, 1.16, OZ + 0.2, 0.002), P.red);
      K.add(M.matte, cbox(s * 0.22, 1.24, OZ - 0.12, s * 0.2255, 1.38, OZ + 0.1, 0.002), P.label);
      K.add(M.matte, cbox(s * 0.2255, 1.29, OZ - 0.08, s * 0.228, 1.33, OZ + 0.06, 0.001), P.cowl);
    }
    K.add(M.metal, plate(rounded([[OZ - 0.12, 0.96], [OZ + 0.12, 0.96], [OZ + 0.09, 0.2], [OZ - 0.07, 0.2]], 0.02, 2), -0.07, 0.07, { bevel: 0.02 }), P.steel);
    K.add(M.metal, cbox(-0.2, 0.17, OZ - 0.3, 0.2, 0.2, OZ + 0.14, 0.008), P.steel);
    K.add(M.metal, lathe([[OZ - 0.2, 0.0], [OZ - 0.2, 0.04], [OZ - 0.14, 0.075], [OZ + 0.1, 0.075], [OZ + 0.22, 0.03], [OZ + 0.24, 0.0]], { y: 0.02, segs: 12 }), P.steel);
    K.add(M.metal, plate([[OZ - 0.06, -0.05], [OZ + 0.1, -0.05], [OZ + 0.02, -0.24], [OZ - 0.04, -0.2]], -0.012, 0.012, { bevel: 0.006 }), P.steel);
    K.add(M.matte, pipe([[0.06, 1.1, -2.66], [0.2, 1.0, -2.4], [0.3, 0.7, -2.3], [0.4, 0.56, -2.0]], 0.014, { steps: 16, segs: 5 }), P.rubber);
    // (its propeller is a part of its own: it turns)
    const Pk = new K.constructor();
    Pk.add(M.metal, lathe([[-0.11, 0.0], [-0.1, 0.03], [-0.02, 0.05], [0.0, 0.05]], { segs: 10 }), P.steel2);
    for (let k = 0; k < 3; k++) {
      const b = plate(rounded([[-0.05, 0.03], [0.03, 0.04], [0.05, 0.14], [0.0, 0.2], [-0.07, 0.15]], 0.02, 3), -0.006, 0.006, { bevel: 0.004 });
      b.rotateY(0.55);
      b.rotateZ((k / 3) * Math.PI * 2);
      Pk.add(M.metal, b, P.chrome);
    }
    return { parts: { screw: { kit: Pk, at: [0, 0.02, OZ - 0.2] } } };
  },

  // ---------------------------------------------------------------------------------------------- the light plane
  // A high-wing tourer: a cowl with its two inlets and a stub of exhaust, a cabin with a windscreen, a window in
  // each door and one behind, a fuselage drawn out to the tail with a red line down it; a wing of an aerofoil's
  // section with its flaps and ailerons scribed in, red tips, a strut to each side; a fin and rudder, a tailplane;
  // spring-leaf legs with spats over the main wheels, a nose leg in its fork. The propeller and its spinner, and
  // the three wheels, are parts of their own: they turn.
  plane(K, M) {
    const FY = 1.38;
    // --- the fuselage: the cowl, the cabin, the cone to the tail
    const fus = [
      ring(-4.45, 0.06, 1.5, 1.66, { e: 0.8 }),
      ring(-3.6, 0.2, 1.3, 1.76, { e: 0.75 }),
      ring(-2.2, 0.38, 1.02, 1.9, { e: 0.7 }),
      ring(-0.8, 0.58, 0.8, 2.02, { e: 0.6 }),
      ring(0.2, 0.64, 0.74, 2.06, { e: 0.55 }),
      ring(1.3, 0.62, 0.76, 2.02, { e: 0.55 }),
      ring(1.7, 0.58, 0.8, 1.74, { e: 0.6 }),
      ring(2.3, 0.5, 0.86, 1.72, { e: 0.65 }),
      ring(2.62, 0.42, 0.94, 1.68, { e: 0.7 }),
      ring(2.72, 0.3, 1.04, 1.6, { e: 0.8 }),
    ];
    K.add(M.paint, loft(fus), P.white);
    // (the line down her side, the belly's colour, her letters on the tail cone)
    for (const s of [1, -1]) {
      K.add(M.paint, pipe([[s * 0.5, 1.3, 2.4], [s * 0.645, 1.3, 1.3], [s * 0.665, 1.32, 0.2], [s * 0.6, 1.36, -0.8], [s * 0.4, 1.44, -2.2], [s * 0.21, 1.52, -3.6]], 0.03, { steps: 30, tension: 0.3, segs: 5 }), P.red);
      K.add(M.paint, pipe([[s * 0.5, 1.2, 2.4], [s * 0.64, 1.2, 1.3], [s * 0.66, 1.22, 0.2], [s * 0.59, 1.27, -0.8], [s * 0.39, 1.37, -2.2]], 0.014, { steps: 24, tension: 0.3, segs: 4 }), P.red);
      for (let i = 0; i < 5; i++) K.add(M.matte, cbox(-0.004, 0, -0.06, 0.004, 0.16, 0.06, 0.002).rotateY(s * 0.1).translate(s * (0.47 - i * 0.03), 1.56 + i * 0.014, -1.5 - i * 0.26), P.ink);
    }
    // --- the cabin's glass: the windscreen, the doors' windows, the one behind them; the doors' seams and handles
    const ws = [
      ring(1.28, 0.6, 1.5, 2.04, { e: 0.55, n: 16 }).filter((_, i) => i <= 8),
      ring(1.72, 0.56, 1.5, 1.76, { e: 0.6, n: 16 }).filter((_, i) => i <= 8),
    ];
    const wg = new THREE.BufferGeometry();
    const wp = [];
    for (let k = 0; k < 8; k++) {
      const a = ws[0][k];
      const b = ws[0][k + 1];
      const c = ws[1][k];
      const d = ws[1][k + 1];
      for (const p of [a, b, c, b, d, c]) wp.push(p[0] * 1.012, p[1] + 0.006, p[2]);
    }
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    wg.computeVertexNormals();
    K.add(M.glass, wg, P.glass);
    for (const s of [1, -1]) {
      K.add(M.glass, plate(rounded([[0.36, 1.5], [1.2, 1.5], [1.2, 1.92], [0.42, 1.96]], 0.05, 3), s * 0.632, s * 0.648, { bevel: 0.004 }), P.glass);
      K.add(M.glass, plate(rounded([[-0.6, 1.52], [0.24, 1.5], [0.3, 1.94], [-0.4, 1.9]], 0.06, 3), s * 0.6, s * 0.636, { bevel: 0.004 }), P.glass);
      K.add(M.matte, pipe([[s * 0.655, 1.98, 1.24], [s * 0.66, 0.96, 1.24], [s * 0.655, 0.9, 1.1], [s * 0.655, 0.9, 0.42], [s * 0.66, 1.0, 0.32], [s * 0.655, 1.98, 0.32]], 0.006, { steps: 24, tension: 0.1, segs: 4 }), P.steel);
      K.add(M.metal, cbox(s * 0.66 - 0.006, 1.34, 0.4, s * 0.66 + 0.012, 1.37, 0.52, 0.004), P.chrome);
      K.add(M.metal, cbox(s * 0.56, 0.72, 0.7, s * 0.74, 0.75, 0.9, 0.006), P.steel);
    }
    // --- the cowl: its two inlets, the stub of exhaust under it, a row of fasteners round its joint
    for (const s of [1, -1]) K.add(M.matte, lathe([[2.722, 0.1], [2.722, 0.0]], { segs: 10 }).scale(1.25, 0.8, 1).translate(s * 0.18, 1.42, 0), P.ink);
    K.add(M.metal, rod([-0.2, 0.86, 2.2], [-0.24, 0.7, 2.0], 0.03, 0.03, 8), P.steel);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      K.add(M.metal, lathe([[0.0, 0.0], [0.0, 0.012], [0.004, 0.012], [0.004, 0.0]], { axis: 'y', segs: 5 }).rotateZ(-a + Math.PI / 2).translate(Math.cos(a) * 0.59, 1.28 + Math.sin(a) * 0.46, 1.72), P.chrome);
    }
    K.add(M.glow, lathe([[2.726, 0.05], [2.726, 0.0]], { segs: 8 }).translate(0, 1.0, -0.02), P.lamp);
    // --- the wing: an aerofoil from tip to tip; its flaps and ailerons scribed; red tips; the tanks' caps; the pitot
    const foil = rounded([[1.56, 2.12], [1.5, 2.18], [1.2, 2.25], [0.7, 2.24], [0.14, 2.14], [0.14, 2.11], [0.7, 2.08], [1.3, 2.07], [1.52, 2.09]], 0.02, 3);
    K.add(M.paint, plate(foil, -4.6, 4.6, { bevel: 0.01 }), P.white);
    for (const s of [1, -1]) {
      K.add(M.paint, plate(foil, s * 4.6, s * 5.04, { bevel: 0.03, bs: 2 }), P.red);
      K.add(M.matte, cbox(s * 0.7, 2.16, 0.5, s * 4.5, 2.2, 0.512, 0.002), P.steel);
      for (const x of [0.7, 2.5, 4.5]) K.add(M.matte, cbox(s * x - 0.006, 2.12, 0.14, s * x + 0.006, 2.2, 0.5, 0.002), P.steel);
      K.add(M.metal, lathe([[2.248, 0.0], [2.248, 0.04], [2.256, 0.04], [2.256, 0.0]], { axis: 'y', x: s * 1.2, z: 0.95, segs: 8 }), P.chrome);
      // (its strut, faired; where it meets wing and fuselage)
      K.add(M.metal, plate([[0.82, 0], [0.98, 0], [0.99, 0.03], [0.83, 0.03]], -1.35, 1.35, { bevel: 0.012 }).rotateZ(s * 0.52).translate(s * 1.66, 1.5, 0), P.white2);
      K.add(M.glow, cbox(s * 5.03, 2.12, 0.9, s * 5.06, 2.2, 1.0, 0.008), s > 0 ? P.navRed : P.navGreen);
    }
    K.add(M.metal, rod([-3.4, 2.08, 1.3], [-3.4, 2.02, 1.3], 0.012, 0.012, 5), P.steel);
    K.add(M.metal, rod([-3.4, 2.02, 1.3], [-3.4, 2.02, 1.52], 0.008, 0.008, 5), P.chrome);
    K.add(M.glow, cbox(2.7, 2.1, 1.5, 3.0, 2.16, 1.55, 0.006), P.lamp);
    // --- the tail: the tailplane and its elevators, the fin and its rudder, the light on top, the tie-down ring
    const tfoil = rounded([[-3.55, 1.6], [-3.62, 1.64], [-4.0, 1.66], [-4.42, 1.62], [-4.42, 1.6], [-4.0, 1.58]], 0.012, 2);
    K.add(M.paint, plate(tfoil, -1.72, 1.72, { bevel: 0.02 }), P.white);
    K.add(M.matte, cbox(-1.7, 1.652, -4.14, 1.7, 1.662, -4.128, 0.002), P.steel);
    K.add(M.paint, plate(rounded([[-3.3, 1.72], [-3.9, 2.86], [-4.5, 2.92], [-4.56, 1.62], [-4.2, 1.66]], 0.06, 3), -0.035, 0.035, { bevel: 0.02 }), P.red);
    K.add(M.matte, plate([[-4.16, 1.7], [-4.15, 2.88], [-4.14, 2.88], [-4.15, 1.7]], -0.04, 0.04, { bevel: 0.002 }), P.red2);
    K.add(M.paint, plate([[-2.6, 1.84], [-3.36, 1.9], [-3.4, 1.74], [-2.7, 1.78]], -0.03, 0.03, { bevel: 0.02 }), P.white);
    K.add(M.glow, lathe([[2.9, 0.0], [2.9, 0.035], [2.95, 0.03], [2.97, 0.0]], { axis: 'y', z: -4.2, segs: 8 }), P.navRed);
    K.add(M.metal, pipe([[-0.02, 1.36, -3.9], [0, 1.28, -3.94], [0.02, 1.36, -3.98]], 0.01, { steps: 10, segs: 5 }), P.steel);
    for (const [x, z] of [[0.2, 0.2], [-0.24, -0.5]]) K.add(M.metal, rod([x, 2.02, z], [x, 2.3, z - 0.12], 0.008, 0.005, 5), P.chrome);
    // --- the gear: a spring leaf to each main wheel and a spat over it; the nose leg, its fork
    for (const s of [1, -1]) {
      K.add(M.metal, plate([[0.8, 0], [1.0, 0], [0.98, 0.03], [0.82, 0.03]], -0.42, 0.42, { bevel: 0.01 }).rotateZ(s * -0.72).translate(s * 0.76, 0.56, 0), P.steel2);
      K.add(M.paint, loft([ring(0.52, 0.03, 0.2, 0.36, { e: 0.8, n: 10, x: s * 1.0 }), ring(0.7, 0.1, 0.1, 0.5, { e: 0.7, n: 10, x: s * 1.0 }), ring(1.0, 0.1, 0.1, 0.52, { e: 0.7, n: 10, x: s * 1.0 }), ring(1.24, 0.05, 0.18, 0.4, { e: 0.8, n: 10, x: s * 1.0 })]), P.white);
      K.add(M.paint, cbox(s * 1.0 - 0.105, 0.3, 0.6, s * 1.0 + 0.105, 0.34, 1.1, 0.01), P.red);
    }
    K.add(M.metal, rod([0, 0.98, 2.2], [0, 0.44, 2.28], 0.035, 0.028, 8), P.steel2);
    K.add(M.metal, rod([0, 0.6, 2.26], [0, 0.44, 2.3], 0.02, 0.02, 6), P.chrome);
    for (const s of [1, -1]) K.add(M.metal, plate([[2.24, 0.46], [2.34, 0.46], [2.33, 0.16], [2.27, 0.16]], s * 0.07, s * 0.09, { bevel: 0.006 }), P.steel);
    K.add(M.metal, cbox(-0.09, 0.42, 2.24, 0.09, 0.47, 2.34, 0.01), P.steel);
    // --- what turns: the propeller with its spinner; the three wheels
    const Kit = K.constructor;
    const Pk = new Kit();
    Pk.add(M.paint, lathe([[-0.06, 0.0], [-0.06, 0.2], [0.02, 0.2], [0.16, 0.14], [0.3, 0.05], [0.34, 0.0]], { segs: 14 }), P.red);
    Pk.add(M.metal, lathe([[-0.07, 0.205], [-0.05, 0.205]], { segs: 14 }), P.chrome);
    for (const s of [1, -1]) {
      // (a blade: broad across the airflow, set at an angle to it; its tip in yellow)
      const bl = plate(rounded([[-0.012, 0.16], [0.012, 0.16], [0.016, 0.6], [0.01, 1.0], [0.0, 1.06], [-0.01, 1.0], [-0.016, 0.6]], 0.004, 2), -0.075, 0.075, { bevel: 0.006 });
      bl.rotateY(0.32);
      if (s < 0) bl.rotateZ(Math.PI);
      Pk.add(M.matte, bl, P.ink);
      const tip = plate([[-0.01, 0.9], [0.01, 0.9], [0.01, 1.0], [0.0, 1.06], [-0.01, 1.0]], -0.077, 0.077, { bevel: 0.006 });
      tip.rotateY(0.32);
      if (s < 0) tip.rotateZ(Math.PI);
      Pk.add(M.paint, tip, P.yellow);
    }
    const parts = { prop: { kit: Pk, at: [0, 1.3, 2.74] } };
    [[1.0, 0.26, 0.9, 0.26], [-1.0, 0.26, 0.9, 0.26], [0, 0.18, 2.3, 0.18]].forEach(([x, y, z, r], i) => {
      parts['w' + i] = { kit: wheelKit(Kit, M, r, i < 2 ? 0.13 : 0.1, { spokes: 4, rim: 0.5 }), at: [x, y, z] };
    });
    return { parts };
  },

  // ---------------------------------------------------------------------------------------------- the motorbike
  // A sports bike with its clothes off: a twin-spar frame round an engine with finned cylinders and its covers, four
  // pipes swept into one silencer, a radiator ahead of it; a sculpted tank, a stepped seat and a tail unit with its
  // lamp and plate; a nose with twin lamps and a screen, mirrors on stalks, clip-on bars with their levers; upside-
  // down forks, a mudguard, calipers on the discs; a swingarm, its shock, a chain to the back wheel; pegs, a stand.
  // (The two wheels are parts of their own - they roll - with their discs and the sprocket on them.)
  bike(K, M) {
    const FA = [0, 0.43, 1.28]; // the front axle
    const RA = [0, 0.43, -0.72];
    const HEAD = [0, 1.16, 0.78];
    // --- the frame: two spars from the head down to the pivot, the subframe to the tail, the engine's cradle
    for (const s of [1, -1]) {
      K.add(M.metal, pipe([[s * 0.06, 1.14, 0.76], [s * 0.15, 0.98, 0.3], [s * 0.15, 0.72, -0.12], [s * 0.12, 0.52, -0.24]], 0.03, { steps: 16, tension: 0.3, segs: 6 }), P.steel2);
      K.add(M.metal, rod([s * 0.13, 0.86, -0.16], [s * 0.1, 0.98, -0.86], 0.016, 0.014, 6), P.steel);
      K.add(M.metal, rod([s * 0.12, 0.6, -0.22], [s * 0.1, 0.94, -0.7], 0.014, 0.012, 6), P.steel);
      // (the swingarm, braced; the footpeg on its hanger)
      K.add(M.metal, plate(rounded([[-0.8, 0.38], [-0.2, 0.46], [-0.18, 0.58], [-0.5, 0.52], [-0.8, 0.48]], 0.02, 2), s * 0.1, s * 0.135, { bevel: 0.01 }), P.steel2);
      K.add(M.metal, plate(rounded([[-0.42, 0.44], [-0.3, 0.44], [-0.28, 0.6], [-0.36, 0.64]], 0.01, 2), s * 0.15, s * 0.165, { bevel: 0.004 }), P.steel);
      K.add(M.metal, rod([s * 0.16, 0.46, -0.37], [s * 0.26, 0.46, -0.37], 0.012, 0.012, 6), P.chrome);
    }
    K.add(M.metal, lathe([[1.06, 0.0], [1.06, 0.04], [1.3, 0.04], [1.3, 0.0]], { axis: 'y', segs: 10 }).rotateX(-0.42).translate(0, 0, 0.78 + 0.47), P.steel2);
    // --- the engine: the cases, the block and head leaning forward with their fins, the covers each side, the sump
    K.add(M.metal, cbox(-0.17, 0.3, -0.22, 0.17, 0.56, 0.3, 0.03), P.steel);
    K.add(M.metal, tilted(cbox(-0.19, 0.54, 0.0, 0.19, 0.82, 0.3, 0.02), 0.3, 0.54, 0.15), P.steel2);
    for (let i = 0; i < 6; i++) K.add(M.metal, tilted(cbox(-0.2, 0.57 + i * 0.04, -0.012, 0.2, 0.582 + i * 0.04, 0.312, 0.004), 0.3, 0.54, 0.15), P.steel);
    K.add(M.metal, tilted(cbox(-0.18, 0.82, 0.02, 0.18, 0.88, 0.28, 0.02), 0.3, 0.54, 0.15), P.cowl);
    K.add(M.metal, lathe([[0.17, 0.0], [0.17, 0.12], [0.2, 0.12], [0.215, 0.09], [0.215, 0.0]], { axis: 'x', y: 0.44, z: -0.06, segs: 14 }), P.steel2);
    K.add(M.metal, mirrored(lathe([[0.17, 0.0], [0.17, 0.1], [0.195, 0.1], [0.21, 0.07], [0.21, 0.0]], { axis: 'x', y: 0.42, z: 0.12, segs: 14 })), P.steel2);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      screw(K, M.metal, 0.2, 0.44 + Math.sin(a) * 0.1, -0.06 + Math.cos(a) * 0.1, 0.01, P.chrome);
    }
    K.add(M.metal, lathe([[0.28, 0.0], [0.28, 0.035], [0.36, 0.035], [0.36, 0.0]], { axis: 'y', x: 0.06, z: 0.33, segs: 8 }).rotateX(Math.PI / 2 - 0.2).translate(0, 0.72, 0.0), P.blue);
    // (the radiator: its core, its end tanks, a hose)
    K.add(M.matte, cbox(-0.2, 0.56, 0.46, 0.2, 0.9, 0.5, 0.006), P.ink);
    for (let i = 0; i < 8; i++) K.add(M.metal, cbox(-0.19, 0.58 + i * 0.04, 0.5, 0.19, 0.594 + i * 0.04, 0.506, 0.002), P.steel2);
    for (const s of [1, -1]) K.add(M.metal, cbox(s * 0.2 - 0.016, 0.55, 0.45, s * 0.2 + 0.016, 0.91, 0.51, 0.008), P.steel);
    K.add(M.round, pipe([[0.18, 0.86, 0.46], [0.22, 0.84, 0.36], [0.19, 0.8, 0.26]], 0.016, { steps: 10, segs: 6 }), P.rubber);
    // --- the exhaust: four pipes down the front and under, into one silencer on the right, its heat shield and strap
    for (let i = 0; i < 4; i++) {
      const x = -0.135 + i * 0.09;
      K.add(M.metal, pipe([[x, 0.74, 0.34], [x, 0.56, 0.44], [x * 0.7, 0.3, 0.36], [0.08 + i * 0.012, 0.26, 0.0], [0.14, 0.28, -0.24]], 0.02, { steps: 18, tension: 0.35, segs: 6 }), P.steel2);
    }
    K.add(M.metal, lathe([[-1.08, 0.0], [-1.08, 0.04], [-1.06, 0.062], [-0.36, 0.062], [-0.3, 0.03], [-0.22, 0.026]], { x: 0.24, y: 0.42, segs: 14 }).rotateX(-0.2).translate(0, -0.12, 0.02), P.chrome);
    K.add(M.matte, lathe([[-1.082, 0.036], [-1.082, 0.0]], { x: 0.24, y: 0.42, segs: 10 }).rotateX(-0.2).translate(0, -0.12, 0.02), P.ink);
    K.add(M.metal, plate(rounded([[-0.96, 0.6], [-0.44, 0.48], [-0.44, 0.56], [-0.96, 0.69]], 0.02, 2), 0.3, 0.312, { bevel: 0.004 }), P.cowl);
    // --- the tank, the seat, the tail: its lamp, the plate on its hanger, the indicators
    const tank = [
      ring(-0.14, 0.13, 0.88, 1.02, { e: 0.6, n: 14 }),
      ring(0.02, 0.2, 0.86, 1.13, { e: 0.6, n: 14 }),
      ring(0.3, 0.23, 0.86, 1.17, { e: 0.6, n: 14 }),
      ring(0.52, 0.19, 0.9, 1.14, { e: 0.65, n: 14 }),
      ring(0.66, 0.1, 0.98, 1.1, { e: 0.7, n: 14 }),
    ];
    K.add(M.paint, loft(tank), P.red);
    K.add(M.metal, lathe([[1.165, 0.0], [1.165, 0.045], [1.176, 0.045], [1.18, 0.035], [1.18, 0.0]], { axis: 'y', z: 0.34, segs: 12 }), P.chrome);
    for (const s of [1, -1]) K.add(M.matte, plate(rounded([[0.0, 0.9], [0.3, 0.9], [0.26, 1.0], [0.04, 1.0]], 0.03, 3), s * 0.205, s * 0.222, { bevel: 0.006 }), P.ink);
    const seat = [
      ring(-0.74, 0.12, 0.96, 1.07, { e: 0.6, n: 12 }),
      ring(-0.5, 0.15, 0.94, 1.07, { e: 0.6, n: 12 }),
      ring(-0.42, 0.15, 0.93, 1.02, { e: 0.6, n: 12 }),
      ring(-0.14, 0.14, 0.92, 1.01, { e: 0.6, n: 12 }),
    ];
    K.add(M.matte, loft(seat), P.ink);
    const tail = [
      ring(-1.0, 0.04, 1.02, 1.1, { e: 0.7, n: 12 }),
      ring(-0.86, 0.12, 0.94, 1.12, { e: 0.6, n: 12 }),
      ring(-0.72, 0.15, 0.9, 1.0, { e: 0.6, n: 12 }),
      ring(-0.5, 0.165, 0.88, 0.96, { e: 0.6, n: 12 }),
    ];
    K.add(M.paint, loft(tail), P.red);
    K.add(M.glow, cbox(-0.08, 1.0, -1.015, 0.08, 1.06, -0.99, 0.01), P.navRed);
    K.add(M.metal, rod([0, 0.94, -0.92], [0, 0.72, -1.08], 0.014, 0.012, 6), P.ink);
    K.add(M.matte, tilted(cbox(-0.1, 0.62, -1.1, 0.1, 0.76, -1.09, 0.004), -0.3, 0.7, -1.09), P.label);
    for (const s of [1, -1]) {
      K.add(M.metal, rod([s * 0.03, 0.82, -1.0], [s * 0.15, 0.82, -1.0], 0.007, 0.007, 5), P.ink);
      K.add(M.glow, lathe([[0.13, 0.0], [0.13, 0.018], [0.18, 0.012], [0.19, 0.0]], { axis: 'x', y: 0.82, z: -1.0, segs: 8 }).scale(s, 1, 1), P.yellow);
    }
    // --- the nose: its fairing, the two lamps in it, the screen; the clocks; the mirrors
    const nose = [
      ring(0.72, 0.19, 0.98, 1.26, { e: 0.6, n: 14 }),
      ring(0.9, 0.2, 0.96, 1.3, { e: 0.6, n: 14 }),
      ring(1.04, 0.15, 1.0, 1.24, { e: 0.65, n: 14 }),
      ring(1.12, 0.06, 1.06, 1.18, { e: 0.8, n: 14 }),
    ];
    K.add(M.paint, loft(nose), P.red);
    for (const s of [1, -1]) {
      K.add(M.glow, lathe([[0.0, 0.0], [0.0, 0.045], [0.012, 0.04], [0.02, 0.0]], { segs: 10 }).scale(1.2, 0.8, 1).rotateY(s * 0.5).translate(s * 0.085, 1.1, 1.075), P.lamp);
      K.add(M.metal, pipe([[s * 0.16, 1.24, 0.86], [s * 0.3, 1.36, 0.9], [s * 0.36, 1.42, 0.88]], 0.008, { steps: 10, segs: 5 }), P.ink);
      K.add(M.round, cbox(s * 0.36 - 0.06, 1.39, 0.87, s * 0.36 + 0.06, 1.46, 0.9, 0.012), P.ink);
      K.add(M.glass, cbox(s * 0.36 - 0.05, 1.4, 0.866, s * 0.36 + 0.05, 1.45, 0.872, 0.004), P.glassD);
    }
    K.add(M.glass, plate(rounded([[0.76, 1.26], [0.98, 1.28], [0.86, 1.5], [0.76, 1.48]], 0.03, 3), -0.15, 0.15, { bevel: 0.02 }), P.glassD);
    K.add(M.matte, cbox(-0.1, 1.24, 0.72, 0.1, 1.32, 0.78, 0.01), P.ink);
    for (const x of [-0.05, 0.05]) K.add(M.glow, lathe([[0.72, 0.03], [0.72, 0.0]], { segs: 10 }).translate(x, 1.28, -0.002), C(0.5, 0.9, 1.0));
    // --- the forks: the yokes, two upside-down legs, the mudguard, the calipers; the bars, grips and levers
    for (const y of [1.3, 1.12]) K.add(M.metal, cbox(-0.15, y - 0.014, 0.78 + (1.3 - y) * 0.45, 0.15, y + 0.014, 0.9 + (1.3 - y) * 0.45, 0.01), P.steel2);
    for (const s of [1, -1]) {
      K.add(M.metal, rod([s * 0.12, 1.34, 0.82], [s * 0.12, 0.84, 1.07], 0.03, 0.03, 10), C(0.72, 0.58, 0.2));
      K.add(M.metal, rod([s * 0.12, 0.84, 1.07], [s * 0.12, 0.43, 1.28], 0.022, 0.022, 8), P.chrome);
      K.add(M.metal, cbox(s * 0.12 - 0.03, 0.4, 1.24, s * 0.12 + 0.03, 0.5, 1.33, 0.01), P.steel2);
      K.add(M.metal, plate(rounded([[1.36, 0.5], [1.48, 0.5], [1.5, 0.62], [1.4, 0.66]], 0.01, 2), s * 0.075, s * 0.115, { bevel: 0.006 }), C(0.72, 0.58, 0.2));
      K.add(M.metal, rod([s * 0.05, 1.38, 0.82], [s * 0.38, 1.36, 0.76], 0.013, 0.013, 8), P.steel2);
      K.add(M.round, lathe([[0.24, 0.0], [0.24, 0.02], [0.38, 0.02], [0.385, 0.025], [0.39, 0.0]], { axis: 'x', segs: 8 }).scale(s, 1, 1).rotateY(s * 0.18).translate(0, 1.37, 0.82 - 0.0), P.rubber);
      K.add(M.metal, pipe([[s * 0.2, 1.37, 0.84], [s * 0.24, 1.37, 0.9], [s * 0.4, 1.35, 0.86]], 0.005, { steps: 8, segs: 4 }), P.chrome);
    }
    const fend = [];
    for (let i = 0; i <= 10; i++) {
      const a = 0.5 + (i / 10) * 2.0;
      fend.push([FA[2] + Math.cos(a) * 0.47, FA[1] + Math.sin(a) * 0.47]);
    }
    for (let i = 10; i >= 0; i--) {
      const a = 0.5 + (i / 10) * 2.0;
      fend.push([FA[2] + Math.cos(a) * 0.455, FA[1] + Math.sin(a) * 0.455]);
    }
    K.add(M.paint, plate(fend, -0.08, 0.08, { bevel: 0.006 }), P.red);
    // --- the back: the shock, the chain and its guard, the hugger; the stand
    K.add(M.metal, rod([0, 0.84, -0.2], [0, 0.52, -0.34], 0.022, 0.022, 8), P.steel);
    K.add(M.metal, pipe(Array.from({ length: 9 }, (_, k) => [Math.cos(k * 1.5) * 0.045, 0.84 - (k / 8) * 0.32, -0.2 - (k / 8) * 0.14 + Math.sin(k * 1.5) * 0.045]), 0.008, { steps: 40, segs: 4 }), P.yellow);
    K.add(M.matte, rod([-0.14, 0.52, -0.1], [-0.14, 0.54, -0.72], 0.01, 0.01, 4), P.ink);
    K.add(M.matte, rod([-0.14, 0.4, -0.1], [-0.14, 0.33, -0.72], 0.01, 0.01, 4), P.ink);
    K.add(M.metal, lathe([[-0.15, 0.0], [-0.15, 0.06], [-0.13, 0.06], [-0.13, 0.0]], { axis: 'x', y: 0.46, z: -0.1, segs: 10 }), P.steel);
    K.add(M.matte, plate([[-0.68, 0.55], [-0.2, 0.57], [-0.2, 0.6], [-0.68, 0.585]], -0.17, -0.155, { bevel: 0.003 }), P.ink);
    K.add(M.metal, rod([-0.14, 0.34, -0.1], [-0.3, 0.04, -0.2], 0.012, 0.012, 6), P.ink);
    // --- its wheels: the tyre and the cast rim; a disc each side of the front one, a disc and the sprocket behind
    const Kit = K.constructor;
    const disc = (W, x, r) => {
      W.add(M.metal, lathe([[x - 0.004, r * 0.5], [x - 0.004, r], [x + 0.004, r], [x + 0.004, r * 0.5]], { axis: 'x', segs: 18 }), P.steel2);
      for (let k = 0; k < 8; k++) W.add(M.matte, lathe([[x - 0.0045, 0.0], [x - 0.0045, 0.012], [x + 0.0045, 0.012], [x + 0.0045, 0.0]], { axis: 'x', segs: 5 }).translate(0, Math.cos((k / 8) * 6.283) * r * 0.8, Math.sin((k / 8) * 6.283) * r * 0.8), P.ink);
    };
    const wf = wheelKit(Kit, M, 0.43, 0.15, { spokes: 5, rim: 0.72, segs: 22, col: P.cowl });
    disc(wf, 0.09, 0.2);
    disc(wf, -0.09, 0.2);
    const wr = wheelKit(Kit, M, 0.43, 0.2, { spokes: 5, rim: 0.72, segs: 22, col: P.cowl });
    disc(wr, 0.11, 0.15);
    wr.add(M.metal, lathe([[-0.145, 0.06], [-0.145, 0.13], [-0.135, 0.13], [-0.135, 0.06]], { axis: 'x', segs: 18 }), P.steel2);
    return { parts: { w0: { kit: wr, at: RA }, w1: { kit: wf, at: FA } }, head: HEAD };
  },

  // ---------------------------------------------------------------------------------------------- the hover bike
  // (ROADMAP 29.5, plan item 6) A motorbike with no wheels, on two ducted hover pods: a sleek fairing drawn out from a
  // pointed nose to a tail with its lamp and a little thruster, a cream line down its side, vents scribed in it; a stepped
  // seat with its stitching and a pillion hump; a small raked screen, a dash that glows, bars with their grips, levers and
  // mirrors; footrests on their hangers; a keel under it from pod to pod. Each pod hangs in a yoke on two pins along the
  // bike - it tilts there with the lean (game/vehicles.js) - a duct with its chromed intake ring and a grille over it, the
  // vanes and the hub inside, and under it a glowing ring and disc. (The pods and the fans in them are parts of their own.)
  // Its frame: the pods' undersides at y = 0 - it rides 0.6 m over that (game/rides.js updateHover).
  hoverbike(K, M) {
    const TEAL = C(0.07, 0.5, 0.53);
    const TEAL2 = C(0.04, 0.33, 0.37);
    const GLOW = C(0.45, 0.96, 1.0);
    const Kit = K.constructor;
    const PZ = [-0.74, 0.78];
    const PY = 0.15;
    // --- the fairing: one skin from the tail to the nose, higher over the tank
    const fair = [
      ring(-1.24, 0.03, 0.44, 0.5, { e: 0.8, eb: 0.9, n: 16 }),
      ring(-1.08, 0.13, 0.36, 0.62, { e: 0.6, eb: 0.9, n: 16 }),
      ring(-0.78, 0.2, 0.36, 0.6, { e: 0.55, eb: 0.9, n: 16 }),
      ring(-0.36, 0.22, 0.34, 0.57, { e: 0.55, eb: 0.9, n: 16 }),
      ring(-0.04, 0.25, 0.32, 0.7, { e: 0.6, eb: 0.9, n: 16 }),
      ring(0.36, 0.26, 0.33, 0.76, { e: 0.6, eb: 0.9, n: 16 }),
      ring(0.74, 0.23, 0.37, 0.7, { e: 0.6, eb: 0.9, n: 16 }),
      ring(1.04, 0.16, 0.4, 0.6, { e: 0.65, eb: 0.9, n: 16 }),
      ring(1.24, 0.07, 0.44, 0.52, { e: 0.75, eb: 0.9, n: 16 }),
      ring(1.34, 0.01, 0.47, 0.48, { e: 0.9, eb: 0.9, n: 16 }),
    ];
    K.add(M.paint, loft(fair), TEAL);
    // (its belly darker, the keel under it from pod to pod)
    K.add(M.paint, loft([ring(-1.0, 0.13, 0.35, 0.42, { e: 0.6, n: 12 }), ring(-0.2, 0.21, 0.31, 0.4, { e: 0.6, n: 12 }), ring(0.6, 0.21, 0.34, 0.42, { e: 0.6, n: 12 }), ring(1.1, 0.12, 0.4, 0.46, { e: 0.6, n: 12 })]), TEAL2);
    K.add(M.metal, plate(rounded([[-0.4, 0.33], [0.42, 0.33], [0.34, 0.24], [-0.32, 0.24]], 0.03, 2), -0.05, 0.05, { bevel: 0.01 }), P.steel);
    // (the cream line down each side, the vents behind the nose, the maker's tag)
    for (const s of [1, -1]) {
      K.add(M.paint, pipe([[s * 0.11, 0.55, -1.12], [s * 0.2, 0.5, -0.78], [s * 0.225, 0.46, -0.36], [s * 0.252, 0.47, 0.0], [s * 0.262, 0.5, 0.36], [s * 0.232, 0.5, 0.74], [s * 0.16, 0.5, 1.04], [s * 0.05, 0.47, 1.28]], 0.014, { steps: 40, tension: 0.3, segs: 5 }), P.white);
      for (let i = 0; i < 4; i++) K.add(M.matte, cbox(-0.004, 0, -0.06, 0.004, 0.012, 0.06, 0.002).rotateY(s * 0.12).translate(s * (0.258 - i * 0.004), 0.58 - i * 0.035, 0.52 + i * 0.03), P.ink);
      K.add(M.matte, plate(rounded([[-0.2, 0.39], [0.12, 0.39], [0.1, 0.43], [-0.18, 0.43]], 0.01, 2), s * 0.226, s * 0.232, { bevel: 0.002 }), P.label);
      // (the footrests on their hangers, the rubber on them)
      K.add(M.metal, plate(rounded([[-0.16, 0.12], [0.04, 0.12], [0.08, 0.36], [-0.12, 0.36]], 0.02, 2), s * 0.2, s * 0.22, { bevel: 0.006 }), P.steel2);
      K.add(M.metal, rod([s * 0.22, 0.15, -0.06], [s * 0.34, 0.15, -0.06], 0.016, 0.016, 8), P.chrome);
      K.add(M.round, lathe([[0.26, 0.0], [0.26, 0.026], [0.36, 0.026], [0.365, 0.02], [0.365, 0.0]], { axis: 'x', y: 0.15, z: -0.06, segs: 8 }).scale(s, 1, 1), P.rubber);
    }
    // --- each pod's yoke: an arm down to a pin ahead of the pod and one behind it (the pod turns on them)
    for (const pz of PZ) {
      for (const e of [-1, 1]) {
        const zp = pz + e * 0.37;
        K.add(M.metal, plate(rounded([[zp - 0.05, PY - 0.02], [zp + 0.05, PY - 0.02], [pz + e * 0.2 + 0.06, 0.4], [pz + e * 0.2 - 0.06, 0.4]], 0.015, 2), -0.035, 0.035, { bevel: 0.008 }), P.steel2);
        K.add(M.metal, lathe([[zp - 0.05, 0.0], [zp - 0.05, 0.03], [zp + 0.05, 0.03], [zp + 0.05, 0.0]], { y: PY, segs: 10 }), P.chrome);
      }
    }
    // --- the seat: the rider's, stepped up behind to a pillion hump; its piping; the grab rail
    const seat = [
      ring(-1.02, 0.08, 0.56, 0.64, { e: 0.6, n: 12 }),
      ring(-0.9, 0.13, 0.56, 0.71, { e: 0.6, n: 12 }),
      ring(-0.7, 0.15, 0.55, 0.7, { e: 0.6, n: 12 }),
      ring(-0.58, 0.17, 0.54, 0.62, { e: 0.6, n: 12 }),
      ring(-0.3, 0.18, 0.52, 0.62, { e: 0.6, n: 12 }),
      ring(-0.06, 0.16, 0.58, 0.64, { e: 0.6, n: 12 }),
    ];
    K.add(M.matte, loft(seat), P.ink);
    for (const s of [1, -1]) K.add(M.matte, pipe([[s * 0.06, 0.64, -1.0], [s * 0.12, 0.7, -0.84], [s * 0.15, 0.66, -0.64], [s * 0.172, 0.615, -0.4], [s * 0.15, 0.63, -0.08]], 0.006, { steps: 24, segs: 4 }), P.red);
    K.add(M.metal, pipe([[-0.15, 0.6, -0.86], [-0.17, 0.66, -1.06], [0, 0.69, -1.14], [0.17, 0.66, -1.06], [0.15, 0.6, -0.86]], 0.014, { steps: 20, tension: 0.3, segs: 6 }), P.steel2);
    // (the filler cap on the tank)
    K.add(M.metal, lathe([[0.75, 0.0], [0.75, 0.04], [0.762, 0.04], [0.768, 0.03], [0.768, 0.0]], { axis: 'y', z: 0.3, segs: 12 }), P.chrome);
    // --- the steering: the head, the bars, grips, levers; the dash; the screen; the mirrors
    K.add(M.paint, rod([0, 0.7, 0.72], [0, 0.94, 0.66], 0.05, 0.04, 10), TEAL2);
    K.add(M.metal, rod([-0.3, 0.97, 0.64], [0.3, 0.97, 0.64], 0.014, 0.014, 8), P.steel2);
    K.add(M.metal, cbox(-0.07, 0.93, 0.6, 0.07, 0.98, 0.7, 0.01), P.steel);
    for (const s of [1, -1]) {
      K.add(M.round, lathe([[0.2, 0.0], [0.2, 0.022], [0.32, 0.02], [0.326, 0.026], [0.33, 0.0]], { axis: 'x', y: 0.97, z: 0.64, segs: 10 }).scale(s, 1, 1), P.rubber);
      K.add(M.metal, pipe([[s * 0.17, 0.975, 0.66], [s * 0.22, 0.98, 0.72], [s * 0.31, 0.96, 0.7]], 0.005, { steps: 8, segs: 4 }), P.chrome);
      K.add(M.metal, pipe([[s * 0.12, 0.98, 0.66], [s * 0.24, 1.08, 0.7], [s * 0.3, 1.13, 0.68]], 0.007, { steps: 10, segs: 5 }), P.ink);
      K.add(M.round, cbox(s * 0.3 - 0.055, 1.11, 0.67, s * 0.3 + 0.055, 1.17, 0.7, 0.012), P.ink);
      K.add(M.glass, cbox(s * 0.3 - 0.046, 1.12, 0.666, s * 0.3 + 0.046, 1.16, 0.672, 0.004), P.glassD);
    }
    K.add(M.matte, tilted(cbox(-0.08, 0.86, 0.72, 0.08, 0.9, 0.84, 0.01), -0.5, 0.88, 0.78), P.ink);
    K.add(M.glow, tilted(cbox(-0.06, 0.9, 0.74, 0.06, 0.903, 0.82, 0.002), -0.5, 0.88, 0.78), GLOW);
    K.add(M.glass, plate(rounded([[0.84, 0.66], [1.0, 0.61], [0.86, 0.95], [0.78, 0.93]], 0.03, 3), -0.17, 0.17, { bevel: 0.012 }), P.glassD);
    for (const s of [1, -1]) K.add(M.metal, pipe([[s * 0.16, 0.66, 0.88], [s * 0.17, 0.8, 0.83], [s * 0.13, 0.93, 0.8]], 0.006, { steps: 10, segs: 4 }), P.chrome);
    // --- the nose: its two lamps, the intake under them; the tail: its lamp, the thruster and its ring, the plate
    for (const s of [1, -1]) K.add(M.glow, lathe([[0.0, 0.0], [0.0, 0.04], [0.012, 0.035], [0.02, 0.0]], { segs: 10 }).scale(1.4, 0.7, 1).rotateY(s * 0.42).translate(s * 0.07, 0.52, 1.22), P.lamp);
    K.add(M.matte, plate(rounded([[1.12, 0.41], [1.27, 0.44], [1.27, 0.46], [1.12, 0.45]], 0.008, 2), -0.07, 0.07, { bevel: 0.004 }), P.ink);
    K.add(M.glow, cbox(-0.08, 0.5, -1.22, 0.08, 0.55, -1.19, 0.008), P.navRed);
    K.add(M.metal, lathe([[-1.34, 0.05], [-1.33, 0.075], [-1.24, 0.08], [-1.16, 0.07]], { y: 0.41, segs: 14 }), P.steel);
    K.add(M.glow, lathe([[-1.338, 0.052], [-1.338, 0.0]], { y: 0.41, segs: 12 }), GLOW);
    K.add(M.matte, tilted(cbox(-0.08, 0.34, -1.18, 0.08, 0.42, -1.17, 0.004), 0.35, 0.38, -1.18), P.label);
    // --- the pods (each a part of its own: it tilts in its yoke) and the fans in them (they turn)
    const pod = (r) => {
      const Pk = new Kit();
      const h = 0.29;
      const y0 = -PY;
      // (the duct: out round its side, in over its lip and down its bore)
      Pk.add(M.paint, lathe([[y0 + 0.0, r - 0.05], [y0 + 0.025, r - 0.005], [y0 + 0.2, r + 0.004], [y0 + h - 0.03, r - 0.012], [y0 + h - 0.01, r - 0.04], [y0 + h - 0.03, r - 0.062], [y0 + 0.03, r - 0.065], [y0 + 0.0, r - 0.05]], { axis: 'y', segs: 24 }), TEAL2);
      Pk.add(M.paint, lathe([[y0 + 0.1, r + 0.006], [y0 + 0.16, r + 0.006]], { axis: 'y', segs: 24 }), P.white);
      // (the intake ring, chromed, round its lip; the grille over the intake)
      Pk.add(M.metal, new THREE.TorusGeometry(r - 0.035, 0.018, 8, 28).rotateX(Math.PI / 2).translate(0, y0 + h - 0.006, 0), P.chrome);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI;
        Pk.add(M.metal, cbox(-(r - 0.06), y0 + h - 0.03, -0.006, r - 0.06, y0 + h - 0.018, 0.006, 0.002).rotateY(a), P.steel);
      }
      Pk.add(M.metal, lathe([[y0 + h - 0.035, r * 0.42], [y0 + h - 0.02, r * 0.42], [y0 + h - 0.02, r * 0.38], [y0 + h - 0.035, r * 0.38]], { axis: 'y', segs: 16 }), P.steel2);
      // (the hub inside, its spinner; four vanes from it to the duct)
      Pk.add(M.metal, lathe([[y0 + 0.05, 0.0], [y0 + 0.05, 0.05], [y0 + 0.08, 0.075], [y0 + 0.17, 0.075], [y0 + 0.21, 0.04], [y0 + 0.22, 0.0]], { axis: 'y', segs: 12 }), P.steel2);
      for (let k = 0; k < 4; k++) Pk.add(M.metal, cbox(0.07, y0 + 0.06, -0.008, r - 0.06, y0 + 0.09, 0.008, 0.003).rotateY((k / 4) * Math.PI * 2 + 0.4), P.steel);
      // (underneath: the glowing disc, a brighter ring round it, the dark lip)
      Pk.add(M.glow, lathe([[y0 + 0.014, 0.0], [y0 + 0.014, r - 0.07]], { axis: 'y', segs: 20 }), GLOW);
      Pk.add(M.glow, lathe([[y0 + 0.008, r - 0.068], [y0 + 0.008, r - 0.048]], { axis: 'y', segs: 24 }), C(0.8, 1.0, 1.0));
      Pk.add(M.glow, lathe([[y0 - 0.002, r - 0.046], [y0 + 0.022, r - 0.002]], { axis: 'y', segs: 24 }), GLOW);
      // (a lamp on each side of it)
      for (const s of [1, -1]) Pk.add(M.glow, cbox(s * (r + 0.002) - 0.006, y0 + 0.12, -0.03, s * (r + 0.002) + 0.006, y0 + 0.14, 0.03, 0.003), s > 0 ? P.navRed : P.navGreen);
      return Pk;
    };
    const fan = (r) => {
      const Fk = new Kit();
      for (let k = 0; k < 7; k++) {
        const b = plate(rounded([[-0.035, 0.0], [0.035, 0.0], [0.045, r], [-0.02, r]], 0.006, 2), -0.004, 0.004, { bevel: 0.002 });
        // (the blade's length out along x, flat across the duct, its pitch)
        b.rotateZ(-Math.PI / 2);
        b.rotateX(0.5);
        b.rotateY((k / 7) * Math.PI * 2);
        b.translate(0, 0.0, 0);
        Fk.add(M.metal, b, P.steel2);
      }
      return Fk;
    };
    const rR = 0.35;
    const rF = 0.33;
    return {
      parts: {
        podR: { kit: pod(rR), at: [0, PY, PZ[0]] },
        podF: { kit: pod(rF), at: [0, PY, PZ[1]] },
        fanR: { kit: fan(rR - 0.075), at: [0, PY - 0.01, PZ[0]] },
        fanF: { kit: fan(rF - 0.075), at: [0, PY - 0.01, PZ[1]] },
      },
    };
  },

  // ---------------------------------------------------------------------------------------------- the helicopter
  // A light helicopter folded from a notebook's page - its blue rules still round the cabin - and built as one is: a
  // bubble of glass in its frame, a door each side, the engine's cowl behind with its intake and its pipe, the mast
  // with its swash plate and pitch links, a boom to the tail with a stabiliser, a fin and the tail rotor's gearbox;
  // skids on two cross tubes with a step each side; a lamp under the nose. (The two rotors are parts of their own.)
  copter(K, M) {
    // --- the cabin and the cowl behind it, one skin; the page's rules round it
    const cab = [
      ring(-1.5, 0.3, 1.5, 2.0, { e: 0.7, n: 18 }),
      ring(-1.1, 0.62, 1.1, 2.3, { e: 0.65, n: 18 }),
      ring(-0.5, 0.86, 0.82, 2.46, { e: 0.6, n: 18 }),
      ring(0.2, 0.98, 0.72, 2.5, { e: 0.6, n: 18 }),
      ring(0.9, 0.9, 0.74, 2.38, { e: 0.62, n: 18 }),
      ring(1.4, 0.66, 0.9, 2.08, { e: 0.68, n: 18 }),
      ring(1.68, 0.3, 1.14, 1.74, { e: 0.8, n: 18 }),
    ];
    K.add(M.matte, loft(cab), P.paper);
    for (const y of [1.0, 1.3, 1.6, 1.9, 2.2]) {
      const pts = [];
      for (const z of [-1.1, -0.5, 0.2, 0.9, 1.4]) {
        const r = cab[[-1.1, -0.5, 0.2, 0.9, 1.4].indexOf(z) + 1];
        // (where the cabin's side is at this height: its widest point there)
        let best = null;
        for (const p of r) if (p[0] > 0 && (!best || Math.abs(p[1] - y) < Math.abs(best[1] - y))) best = p;
        pts.push([best[0] + 0.004, y, z]);
      }
      for (const s of [1, -1]) K.add(M.matte, pipe(pts.map(([x, yy, z]) => [s * x, yy, z]), 0.007, { steps: 16, segs: 4 }), P.rule);
    }
    for (const s of [1, -1]) K.add(M.matte, rod([s * 0.5, 2.36, -0.6], [s * 0.5, 2.4, 0.9], 0.008, 0.008, 4), P.red);
    // --- the bubble: glass over the front, its centre post and its sill; the doors, their glass, seams and handles
    const bub = [
      ring(0.56, 0.9, 1.2, 2.4, { e: 0.62, n: 18 }),
      ring(1.0, 0.86, 1.14, 2.32, { e: 0.64, n: 18 }),
      ring(1.42, 0.64, 1.16, 2.06, { e: 0.7, n: 18 }),
      ring(1.7, 0.28, 1.3, 1.76, { e: 0.82, n: 18 }),
    ].map((r) => r.map(([x, y, z]) => [x * 1.012, y + 0.008, z + 0.012]));
    K.add(M.glass, loft(bub, { caps: false }), P.glass);
    K.add(M.glass, lathe([[1.73, 0.26], [1.74, 0.0]], { segs: 12 }).translate(0, 1.53, 0), P.glass);
    K.add(M.matte, pipe([[0, 2.42, 0.56], [0, 2.34, 1.0], [0, 2.08, 1.44], [0, 1.78, 1.72], [0, 1.3, 1.72]], 0.016, { steps: 20, segs: 5 }), P.paper);
    for (const s of [1, -1]) {
      K.add(M.glass, plate(rounded([[-0.3, 1.5], [0.48, 1.5], [0.48, 2.24], [-0.1, 2.24]], 0.08, 3), s * 0.97, s * 1.0, { bevel: 0.004 }), P.glass);
      K.add(M.matte, pipe([[s * 1.0, 2.34, 0.52], [s * 1.0, 0.92, 0.52], [s * 0.96, 0.86, 0.3], [s * 0.94, 0.88, -0.36], [s * 0.94, 2.3, -0.36]], 0.008, { steps: 24, tension: 0.1, segs: 4 }), P.steel);
      K.add(M.metal, cbox(s * 0.99, 1.36, -0.26, s * 1.02, 1.4, -0.12, 0.006), P.chrome);
      // (the cowl's louvres, the engine's intake)
      for (let i = 0; i < 4; i++) K.add(M.matte, cbox(s * 0.7, 1.84 - i * 0.1, -1.04, s * 0.74, 1.87 - i * 0.1, -0.7, 0.004).rotateY(s * 0.42).translate(s * -0.1, 0, s * 0.0), P.ink);
    }
    K.add(M.metal, rod([0.3, 1.6, -1.2], [0.52, 1.5, -1.62], 0.05, 0.045, 8), P.steel);
    K.add(M.matte, lathe([[0.0, 0.035], [0.0, 0.0]], { segs: 8 }).rotateY(Math.PI / 2 + 0.9).translate(0.525, 1.498, -1.628), P.ink);
    // --- the mast: its fairing, the swash plate, three links up to the head
    K.add(M.matte, loft([ring(-0.2, 0.22, 2.44, 2.62, { e: 0.6, n: 12 }), ring(0.2, 0.26, 2.44, 2.66, { e: 0.6, n: 12 }), ring(0.6, 0.18, 2.42, 2.58, { e: 0.6, n: 12 })]), P.paper);
    K.add(M.metal, lathe([[2.5, 0.0], [2.5, 0.055], [2.9, 0.045], [2.9, 0.0]], { axis: 'y', z: 0.2, segs: 10 }), P.steel);
    K.add(M.metal, lathe([[2.7, 0.0], [2.7, 0.14], [2.73, 0.14], [2.73, 0.0]], { axis: 'y', z: 0.2, segs: 14 }), P.steel2);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      K.add(M.metal, rod([Math.cos(a) * 0.12, 2.73, 0.2 + Math.sin(a) * 0.12], [Math.cos(a) * 0.1, 2.9, 0.2 + Math.sin(a) * 0.1], 0.008, 0.008, 5), P.chrome);
    }
    // --- the boom: a tube to the tail, its stabiliser, the fin, the gearbox; a guard under the tail rotor; lights
    K.add(M.matte, loft([ring(-4.3, 0.1, 1.68, 1.9, { e: 0.9, n: 12 }), ring(-3.0, 0.16, 1.62, 1.96, { e: 0.9, n: 12 }), ring(-1.3, 0.3, 1.52, 2.1, { e: 0.8, n: 12 })]), P.paper);
    for (const z of [-2.0, -3.0, -3.9]) K.add(M.matte, lathe([[z, 0.0], [z, 0.2 - (z + 2) * -0.045], [z + 0.012, 0.2 - (z + 2) * -0.045], [z + 0.012, 0.0]], { y: 1.79, segs: 12 }), P.rule);
    K.add(M.matte, plate(rounded([[-3.3, 1.76], [-3.75, 1.78], [-3.8, 1.8], [-3.3, 1.82]], 0.01, 2), -0.75, 0.75, { bevel: 0.01 }), P.paper);
    for (const s of [1, -1]) K.add(M.matte, plate(rounded([[-3.28, 1.6], [-3.8, 1.64], [-3.8, 1.98], [-3.36, 2.0]], 0.03, 2), s * 0.73, s * 0.76, { bevel: 0.008 }), P.red);
    K.add(M.matte, plate(rounded([[-3.7, 1.86], [-4.1, 2.86], [-4.42, 2.9], [-4.4, 1.3], [-4.2, 1.26], [-4.1, 1.7]], 0.05, 3), -0.03, 0.03, { bevel: 0.016 }), P.paper);
    K.add(M.matte, plate([[-3.86, 2.3], [-4.38, 2.42], [-4.38, 2.62], [-3.96, 2.56]], -0.034, 0.034, { bevel: 0.004 }), P.red);
    K.add(M.metal, cbox(-0.02, 2.14, -4.1, 0.12, 2.36, -3.9, 0.03), P.steel);
    K.add(M.metal, pipe([[0, 1.3, -4.3], [0, 1.0, -4.36], [0, 0.96, -4.2], [0, 1.2, -4.0]], 0.014, { steps: 14, segs: 5 }), P.steel2);
    K.add(M.glow, lathe([[2.9, 0.0], [2.9, 0.03], [2.94, 0.025], [2.96, 0.0]], { axis: 'y', z: -4.26, segs: 8 }), P.navRed);
    K.add(M.glow, cbox(-1.0, 1.5, 0.3, -0.98, 1.56, 0.4, 0.004), P.navGreen);
    K.add(M.glow, cbox(0.98, 1.5, 0.3, 1.0, 1.56, 0.4, 0.004), P.navRed);
    // --- the skids: two cross tubes bowed down to them, the skids with their turned-up toes, a step each side; the lamp
    for (const z of [-0.5, 0.7]) K.add(M.metal, pipe([[-0.75, 0.15, z], [-0.6, 0.6, z], [0, 0.86, z], [0.6, 0.6, z], [0.75, 0.15, z]], 0.032, { steps: 24, tension: 0.4, segs: 6 }), P.steel);
    for (const s of [1, -1]) {
      K.add(M.metal, pipe([[s * 0.75, 0.15, -1.1], [s * 0.75, 0.15, 1.0], [s * 0.75, 0.2, 1.24], [s * 0.75, 0.34, 1.38]], 0.04, { steps: 20, tension: 0.3, segs: 6 }), P.steel);
      K.add(M.metal, cbox(s * 0.72 - 0.06, 0.52, -0.1, s * 0.72 + 0.14, 0.55, 0.3, 0.008), P.steel2);
      for (const z of [-0.9, 0.9]) K.add(M.round, cbox(s * 0.75 - 0.05, 0.1, z - 0.12, s * 0.75 + 0.05, 0.13, z + 0.12, 0.006), P.rubber);
    }
    K.add(M.glow, lathe([[0.0, 0.0], [0.0, 0.07], [0.02, 0.06], [0.03, 0.0]], { segs: 10 }).rotateX(0.5).translate(0, 0.98, 1.34), P.lamp);
    K.add(M.metal, rod([0.2, 2.44, -0.7], [0.2, 2.9, -0.86], 0.006, 0.004, 4), P.steel);
    // --- what turns: the main rotor - its head, the grips, four tapering blades - and the tail rotor
    const Kit = K.constructor;
    const R = new Kit();
    R.add(M.metal, lathe([[-0.06, 0.0], [-0.06, 0.12], [0.03, 0.12], [0.06, 0.07], [0.1, 0.05], [0.1, 0.0]], { axis: 'y', segs: 12 }), P.steel2);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const grip = cbox(0.1, -0.03, -0.06, 0.42, 0.03, 0.06, 0.01);
      const blade = plate(rounded([[-0.16, 0.012], [0.1, 0.022], [0.14, 0.006], [0.1, -0.008], [-0.16, 0.0]], 0.006, 2), 0.4, 3.6, { bevel: 0.004 });
      const tip = plate(rounded([[-0.16, 0.012], [0.1, 0.022], [0.14, 0.006], [0.1, -0.008], [-0.16, 0.0]], 0.006, 2), 3.3, 3.62, { bevel: 0.005 });
      for (const [g, mat, col] of [[grip, M.metal, P.steel], [blade, M.matte, P.paper], [tip, M.matte, P.red]]) {
        g.rotateY(a);
        R.add(mat, g, col);
      }
    }
    const T = new Kit();
    T.add(M.metal, lathe([[-0.02, 0.0], [-0.02, 0.05], [0.06, 0.05], [0.08, 0.0]], { axis: 'x', segs: 10 }), P.steel2);
    for (const s of [1, -1]) {
      const b = plate(rounded([[-0.05, 0.05], [0.05, 0.05], [0.06, 0.56], [0.0, 0.6], [-0.06, 0.56]], 0.02, 2), 0.02, 0.034, { bevel: 0.004 });
      if (s < 0) b.rotateX(Math.PI);
      T.add(M.matte, b, P.paper);
      const t = plate([[-0.058, 0.48], [0.058, 0.48], [0.06, 0.56], [0.0, 0.6], [-0.06, 0.56]], 0.018, 0.036, { bevel: 0.004 });
      if (s < 0) t.rotateX(Math.PI);
      T.add(M.matte, t, P.red);
    }
    return { parts: { rotor: { kit: R, at: [0, 2.92, 0.2] }, tailRotor: { kit: T, at: [0.12, 2.25, -4.0] } } };
  },

  // ---------------------------------------------------------------------------------------------- the tank
  // A battle tank as they are built: a welded hull with its sloped glacis, the driver's hatch and periscopes in it;
  // tracks of linked shoes over five road wheels a side, a toothed sprocket ahead and an idler behind, return
  // rollers, skirts bolted over them; grilles and two stub exhausts over the engine, drums of fuel across the back,
  // a shovel and a tow cable stowed; and at its nose a dozer blade - which is a school eraser on two rams. The
  // turret is a part of its own (it turns): a cast shell, the gun in its mantlet with a fume extractor and a slotted
  // brake, a cupola with its vision blocks and a machine gun, smoke dischargers, a stowage rack, an aerial and flag.
  tank(K, M) {
    // --- the tracks and what they run on
    for (const s of [1, -1]) {
      const X = s * 1.6;
      const out = rounded([[-3.12, 0.16], [3.08, 0.16], [3.3, 0.56], [3.02, 1.0], [-3.02, 1.0], [-3.3, 0.56]], 0.16, 5);
      const inn = rounded([[-3.04, 0.24], [3.0, 0.24], [3.18, 0.56], [2.96, 0.92], [-2.96, 0.92], [-3.18, 0.56]], 0.14, 5);
      K.add(M.matte, plate(out, X - 0.32, X + 0.32, { bevel: 0.01, holes: [inn] }), P.rubber);
      for (let i = 0; i < 27; i++) {
        const z = -2.94 + i * 0.226;
        K.add(M.metal, cbox(X - 0.33, 0.128, z, X + 0.33, 0.166, z + 0.12, 0.008), P.steel);
        K.add(M.metal, cbox(X - 0.33, 0.996, z, X + 0.33, 1.03, z + 0.12, 0.008), P.steel);
      }
      for (let k = 0; k < 5; k++) {
        const z = -2.2 + k * 1.1;
        const wh = lathe([[0.02, 0.0], [0.02, 0.33], [0.06, 0.34], [0.24, 0.34], [0.28, 0.33], [0.3, 0.2], [0.26, 0.1], [0.32, 0.08], [0.32, 0.0]], { axis: 'x', y: 0.5, z, segs: 16 });
        K.add(M.metal, s > 0 ? wh.translate(1.6, 0, 0) : mirrored(wh).translate(-1.6, 0, 0), P.olive2);
        const tyre = lathe([[0.03, 0.345], [0.27, 0.345]], { axis: 'x', y: 0.5, z, segs: 16 });
        K.add(M.round, s > 0 ? tyre.translate(1.6, 0, 0) : mirrored(tyre).translate(-1.6, 0, 0), P.rubber);
        for (let b = 0; b < 6; b++) screw(K, M.metal, s * 1.92, 0.5 + Math.sin((b / 6) * 6.283) * 0.14, z + Math.cos((b / 6) * 6.283) * 0.14, 0.022, P.steel2);
      }
      // (the sprocket and its teeth; the idler; the rollers over them)
      for (const [z, y, teeth] of [[2.86, 0.6, 1], [-2.86, 0.6, 0]]) {
        const hub = lathe([[0.04, 0.0], [0.04, 0.3], [0.26, 0.3], [0.3, 0.14], [0.34, 0.1], [0.34, 0.0]], { axis: 'x', y, z, segs: 16 });
        K.add(M.metal, s > 0 ? hub.translate(1.6, 0, 0) : mirrored(hub).translate(-1.6, 0, 0), P.steel);
        if (teeth) for (let b = 0; b < 12; b++) K.add(M.metal, rod([s * 1.9, y + Math.sin((b / 12) * 6.283) * 0.3, z + Math.cos((b / 12) * 6.283) * 0.3], [s * 1.9, y + Math.sin((b / 12) * 6.283) * 0.37, z + Math.cos((b / 12) * 6.283) * 0.37], 0.03, 0.02, 5), P.steel2);
      }
      for (const z of [-1.6, 0, 1.6]) {
        const rl = lathe([[0.1, 0.0], [0.1, 0.1], [0.3, 0.1], [0.3, 0.0]], { axis: 'x', y: 0.88, z, segs: 10 });
        K.add(M.metal, s > 0 ? rl.translate(1.6, 0, 0) : mirrored(rl).translate(-1.6, 0, 0), P.steel);
      }
      // (the mudguard over it, the skirt in four plates bolted on; a stowage bin, a lamp in its guard)
      K.add(M.paint, cbox(s > 0 ? 1.26 : -1.98, 1.03, -3.26, s > 0 ? 1.98 : -1.26, 1.07, 3.2, 0.012), P.olive);
      for (let k = 0; k < 4; k++) {
        K.add(M.paint, plate([[-2.9 + k * 1.46, 0.74], [-1.5 + k * 1.46, 0.74], [-1.5 + k * 1.46, 1.06], [-2.9 + k * 1.46, 1.06]], s * 1.95, s * 1.985, { bevel: 0.006 }), P.olive);
        for (const z of [-2.78, -1.62]) for (const y of [0.8, 1.0]) screw(K, M.metal, s * 1.985, y, z + k * 1.46, 0.016, P.olive2);
      }
      K.add(M.paint, cbox(s * 1.62 - 0.3, 1.07, -1.2, s * 1.62 + 0.3, 1.3, -0.2, 0.02), P.olive2);
      K.add(M.glow, lathe([[0.0, 0.0], [0.0, 0.08], [0.03, 0.07], [0.04, 0.0]], { segs: 10 }).translate(s * 1.5, 1.2, 3.0), P.lamp);
      K.add(M.metal, pipe([[s * 1.38, 1.07, 3.0], [s * 1.38, 1.32, 3.06], [s * 1.62, 1.32, 3.06], [s * 1.62, 1.07, 3.0]], 0.012, { steps: 14, tension: 0.2, segs: 5 }), P.olive2);
      K.add(M.metal, pipe([[s * 0.9, 0.7, 3.1], [s * 0.9, 0.62, 3.2], [s * 1.0, 0.62, 3.2], [s * 1.0, 0.7, 3.1]], 0.02, { steps: 10, tension: 0.2, segs: 5 }), P.steel);
    }
    // --- the hull: its sides, the glacis, the belly; the weld seams; the driver's hatch and periscopes
    K.add(M.paint, plate(rounded([[-2.9, 0.6], [2.5, 0.6], [3.12, 0.96], [2.3, 1.56], [-2.72, 1.56], [-2.92, 1.24]], 0.04, 2), -1.3, 1.3, { bevel: 0.03 }), P.olive);
    K.add(M.matte, cbox(-1.26, 1.26, 2.72, 1.26, 1.275, 2.74, 0.004), P.olive2);
    K.add(M.metal, lathe([[1.56, 0.0], [1.56, 0.34], [1.6, 0.34], [1.62, 0.3], [1.62, 0.0]], { axis: 'y', x: 0.55, z: 1.7, segs: 14 }), P.olive2);
    K.add(M.metal, pipe([[0.4, 1.62, 1.6], [0.4, 1.68, 1.7], [0.4, 1.62, 1.8]], 0.012, { steps: 8, segs: 5 }), P.steel);
    for (let k = 0; k < 3; k++) K.add(M.glass, cbox(0.3 + k * 0.2, 1.56, 2.02, 0.44 + k * 0.2, 1.64, 2.12, 0.01), P.glassD);
    // --- the engine's deck: two grilles, the exhausts, the drums of fuel; the shovel; the tow cable
    for (const s of [1, -1]) {
      K.add(M.matte, cbox(s * 0.66 - 0.5, 1.56, -2.6, s * 0.66 + 0.5, 1.59, -1.5, 0.006), P.olive2);
      for (let i = 0; i < 9; i++) K.add(M.matte, cbox(s * 0.66 - 0.46, 1.59, -2.54 + i * 0.12, s * 0.66 + 0.46, 1.605, -2.48 + i * 0.12, 0.004), P.ink);
      K.add(M.metal, lathe([[-3.1, 0.0], [-3.1, 0.07], [-2.86, 0.07], [-2.86, 0.0]], { x: s * 1.0, y: 1.3, segs: 10 }), P.steel);
      K.add(M.matte, lathe([[-3.102, 0.05], [-3.102, 0.0]], { x: s * 1.0, y: 1.3, segs: 8 }), P.ink);
      const drum = lathe([[0.06, 0.0], [0.06, 0.2], [0.1, 0.21], [0.4, 0.21], [0.44, 0.2], [0.74, 0.2], [0.78, 0.21], [1.04, 0.21], [1.08, 0.2], [1.08, 0.0]], { axis: 'x', y: 1.36, z: -3.16, segs: 14 });
      K.add(M.paint, s > 0 ? drum : mirrored(drum), P.olive2);
    }
    K.add(M.metal, rod([-1.5, 1.1, 0.4], [-1.5, 1.1, 1.5], 0.016, 0.016, 6), P.teak);
    K.add(M.metal, plate(rounded([[1.5, 1.08], [1.78, 1.08], [1.84, 1.1], [1.78, 1.12], [1.5, 1.12]], 0.01, 2), -1.6, -1.4, { bevel: 0.004 }), P.steel);
    K.add(M.metal, pipe([[1.32, 1.3, -0.4], [1.32, 1.4, 0.2], [1.32, 1.34, 1.2], [1.32, 1.2, 2.0], [1.3, 1.0, 2.6]], 0.016, { steps: 30, tension: 0.4, segs: 5 }), P.steel);
    // --- the dozer blade: a school eraser - pink, its blue end, a paper band - with a steel edge, on two arms and rams
    const blade = rounded([[3.34, 0.14], [3.56, 0.12], [3.66, 0.46], [3.6, 0.84], [3.4, 0.86], [3.46, 0.5]], 0.03, 3);
    K.add(M.round, plate(blade, -1.5, 1.95, { bevel: 0.02, bs: 2 }), C(0.84, 0.46, 0.48));
    K.add(M.round, plate(blade, -1.95, -1.5, { bevel: 0.02, bs: 2 }), C(0.36, 0.48, 0.82));
    K.add(M.matte, plate(blade.map(([z, y]) => [z + (z > 3.5 ? 0.006 : -0.006), y]), -0.5, 0.5, { bevel: 0.01 }), P.label);
    K.add(M.metal, cbox(-1.96, 0.1, 3.5, 1.96, 0.16, 3.6, 0.006), P.steel2);
    for (const s of [1, -1]) {
      K.add(M.metal, rod([s * 1.0, 0.56, 2.6], [s * 1.0, 0.4, 3.4], 0.05, 0.05, 8), P.olive2);
      K.add(M.metal, rod([s * 0.7, 1.0, 2.7], [s * 0.7, 0.7, 3.42], 0.04, 0.04, 8), P.steel);
      K.add(M.metal, rod([s * 0.7, 0.86, 3.04], [s * 0.7, 0.7, 3.42], 0.022, 0.022, 6), P.chrome);
    }
    // --- the turret (it turns): the cast shell, the mantlet, the gun; the cupola and its gun; hatches, dischargers, rack
    const Kit = K.constructor;
    const T = new Kit();
    const shell = [
      ring(-1.6, 0.62, 0.06, 0.62, { e: 0.6, n: 18 }),
      ring(-1.1, 1.06, 0.0, 0.8, { e: 0.6, n: 18 }),
      ring(-0.2, 1.2, 0.0, 0.88, { e: 0.55, n: 18 }),
      ring(0.6, 1.08, 0.0, 0.84, { e: 0.6, n: 18 }),
      ring(1.1, 0.78, 0.06, 0.76, { e: 0.65, n: 18 }),
      ring(1.36, 0.46, 0.16, 0.7, { e: 0.7, n: 18 }),
    ];
    T.add(M.paint, loft(shell), P.olive);
    T.add(M.metal, lathe([[0.0, 0.0], [0.0, 1.22], [0.05, 1.22], [0.05, 0.0]], { axis: 'y', z: -0.1, segs: 22 }).translate(0, -0.04, 0), P.olive2);
    T.add(M.paint, cbox(-0.42, 0.16, 1.2, 0.42, 0.74, 1.52, 0.06), P.olive2);
    for (const s of [1, -1]) for (const y of [0.24, 0.66]) screw(T, M.metal, s * 0.42, y, 1.36, 0.03, P.steel2);
    T.add(M.metal, lathe([[1.46, 0.0], [1.46, 0.2], [1.56, 0.17], [2.6, 0.15], [2.62, 0.21], [3.04, 0.21], [3.06, 0.14], [4.0, 0.128], [4.02, 0.19], [4.38, 0.19], [4.38, 0.115], [4.1, 0.115]], { y: 0.45, segs: 16 }), P.olive2);
    T.add(M.matte, lathe([[4.382, 0.115], [4.382, 0.0]], { y: 0.45, segs: 12 }), P.ink);
    for (const s of [1, -1]) for (const z of [4.08, 4.2, 4.3]) T.add(M.matte, cbox(s * 0.185, 0.39, z, s * 0.195, 0.51, z + 0.06, 0.004), P.ink);
    T.add(M.metal, rod([0.3, 0.5, 1.5], [0.3, 0.5, 1.9], 0.022, 0.018, 6), P.steel);
    // (the cupola: its ring of vision blocks, the lid, the gun on its pintle)
    T.add(M.paint, lathe([[0.78, 0.0], [0.78, 0.38], [0.94, 0.36], [0.98, 0.3], [0.98, 0.0]], { axis: 'y', x: -0.42, z: -0.3, segs: 16 }), P.olive2);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      T.add(M.glass, cbox(-0.06, 0.84, -0.02, 0.06, 0.92, 0.02, 0.006).rotateY(-a + Math.PI / 2).translate(-0.42 + Math.cos(a) * 0.375, 0, -0.3 + Math.sin(a) * 0.375), P.glassD);
    }
    T.add(M.paint, tilted(lathe([[0.0, 0.0], [0.0, 0.29], [0.04, 0.29], [0.05, 0.0]], { axis: 'y', segs: 14 }), -1.1, 0, 0).translate(-0.42, 1.0, -0.56), P.olive);
    T.add(M.metal, rod([-0.42, 0.98, 0.02], [-0.42, 1.22, 0.06], 0.02, 0.02, 6), P.steel);
    T.add(M.metal, cbox(-0.47, 1.2, -0.14, -0.37, 1.3, 0.3, 0.012), P.steel);
    T.add(M.metal, lathe([[0.3, 0.0], [0.3, 0.022], [0.96, 0.018], [0.96, 0.03], [1.02, 0.03], [1.02, 0.0]], { x: -0.42, y: 1.26, segs: 8 }), P.steel);
    T.add(M.paint, cbox(-0.56, 1.14, -0.02, -0.5, 1.26, 0.16, 0.01), P.olive2);
    T.add(M.paint, lathe([[0.84, 0.0], [0.84, 0.28], [0.87, 0.28], [0.88, 0.0]], { axis: 'y', x: 0.46, z: -0.2, segs: 14 }), P.olive2);
    T.add(M.metal, cbox(0.5, 0.86, 0.5, 0.74, 1.02, 0.76, 0.02), P.olive2);
    T.add(M.glass, cbox(0.54, 0.9, 0.762, 0.7, 0.98, 0.766, 0.004), P.glassD);
    for (const s of [1, -1]) for (let k = 0; k < 3; k++) T.add(M.metal, lathe([[0.0, 0.0], [0.0, 0.045], [0.22, 0.045], [0.22, 0.03], [0.02, 0.03]], { segs: 8 }).rotateX(-0.5).rotateY(s * (0.5 + k * 0.16)).translate(s * (0.9 - k * 0.02), 0.5, 0.84 - k * 0.14), P.olive2);
    // (the rack behind, a rolled sheet in it; the aerial and its flag)
    for (const y of [0.2, 0.54]) T.add(M.metal, pipe([[-0.72, y, -1.5], [-0.76, y, -1.96], [0.76, y, -1.96], [0.72, y, -1.5]], 0.016, { steps: 16, tension: 0.15, segs: 5 }), P.olive2);
    for (const x of [-0.74, -0.25, 0.25, 0.74]) T.add(M.metal, rod([x, 0.2, -1.96], [x, 0.54, -1.96], 0.012, 0.012, 5), P.olive2);
    T.add(M.round, lathe([[-0.62, 0.0], [-0.62, 0.13], [0.62, 0.13], [0.62, 0.0]], { axis: 'x', y: 0.36, z: -1.76, segs: 10 }), P.teak);
    for (const x of [-0.36, 0.36]) T.add(M.matte, lathe([[x - 0.02, 0.134], [x + 0.02, 0.134]], { axis: 'x', y: 0.36, z: -1.76, segs: 10 }), P.ink);
    T.add(M.metal, lathe([[0.8, 0.0], [0.8, 0.03], [0.9, 0.02], [0.9, 0.0]], { axis: 'y', x: 0.6, z: -0.9, segs: 8 }), P.steel);
    T.add(M.metal, rod([0.6, 0.9, -0.9], [0.6, 2.7, -0.96], 0.008, 0.005, 5), P.steel);
    T.add(M.paint, plate([[-1.5, 2.3], [-1.0, 2.36], [-1.0, 2.66], [-1.5, 2.6], [-1.38, 2.46]], 0.592, 0.608, { bevel: 0.002 }), P.red);
    return { parts: { turret: { kit: T, at: [0, 1.55, -0.2] } } };
  },
};
