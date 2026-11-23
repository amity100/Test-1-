// (ROADMAP 28.19) The arsenal modelled as real weapons are made - receivers of pressed and riveted steel, turned barrels,
// machined sights, wood furniture - and of what the drawn city is made of: graphite steel, pencil cedar, pencil-stub
// rounds, an eraser for a butt pad, ink. Each builder draws into a Kit of game/items.js (K) with its pens (M) and
// returns what the game holds it by: { muzzle, length, ... , parts: { name: a Kit of its own, for what moves } }.
//
// The frame of a held thing: its origin in the hand (the web of the hand at the top of its grip), +z to the muzzle,
// +y up, +x to the SHOOTER'S LEFT (game/player.js holdMatrix: x = up × forward). A side profile is [[z, y], ...].
import * as THREE from 'three';
import { lin3 } from '../render/materials.js';
import { plate, cbox, lathe, rod, pipe, tilted, mirrored, rail, slots, screw, ridges, rounded, hexbar } from './armkit.js';

const C = (r, g, b) => lin3(r, g, b);

// what things are made of
export const INK = {
  steel: C(0.25, 0.27, 0.33), // blued, graphite-dark
  steel2: C(0.34, 0.36, 0.43), // parkerised, a shade lighter: what is bolted on
  steel3: C(0.47, 0.49, 0.56), // worn
  bright: C(0.8, 0.81, 0.85), // bare steel: pins, a bolt face, a worn edge
  black: C(0.07, 0.07, 0.09), // a hole, a slot, a bore
  cedar: C(0.56, 0.4, 0.24), // pencil wood, oiled
  cedar2: C(0.38, 0.25, 0.14),
  yellow: C(0.96, 0.74, 0.14), // pencil lacquer
  tipwood: C(0.9, 0.76, 0.56), // a sharpened pencil's cone
  lead: C(0.17, 0.17, 0.21), // graphite
  brass: C(0.78, 0.6, 0.24),
  eraser: C(0.84, 0.46, 0.48),
  tin: C(0.11, 0.27, 0.4), // an ink tin
  label: C(0.93, 0.9, 0.8),
  red: C(0.82, 0.16, 0.14),
  polymer: C(0.12, 0.12, 0.14),
  walnut: C(0.44, 0.27, 0.16), // a gunstock, darker than pencil cedar
  walnut2: C(0.3, 0.17, 0.1),
  olive: C(0.3, 0.4, 0.24), // a launcher's tube
  olive2: C(0.22, 0.3, 0.18),
  teal: C(0.16, 0.62, 0.62), // anodised: the paint gun's body
  teal2: C(0.1, 0.44, 0.46),
  plum: C(0.36, 0.2, 0.5), // its grip
  chrome: C(0.86, 0.87, 0.9),
  glassc: C(0.8, 0.9, 0.98),
  lens: C(0.2, 0.42, 0.62),
  paintPink: C(0.62, 0.06, 0.3),
  blueRubber: C(0.36, 0.48, 0.82), // the other half of a school eraser
  paper: C(0.95, 0.94, 0.88),
  crayons: [C(0.9, 0.24, 0.26), C(0.97, 0.76, 0.18), C(0.25, 0.55, 0.9), C(0.32, 0.72, 0.38)],
  staplerRed: C(0.56, 0.06, 0.08), // (deep: in the evening sun a bright red goes to bare paper)
  penBlue: C(0.2, 0.36, 0.78),
  navy: C(0.15, 0.17, 0.24), // police polymer
  alu: C(0.3, 0.31, 0.35), // an anodised receiver
  alu2: C(0.22, 0.23, 0.27),
  glueBlue: C(0.24, 0.44, 0.9),
  glueBlue2: C(0.16, 0.3, 0.68),
  glueStick: C(0.96, 0.96, 0.9),
  orange: C(0.95, 0.5, 0.14),
  enamel: C(0.5, 0.56, 0.7), // the white-out gun's grey-blue
  enamel2: C(0.36, 0.42, 0.56),
  white: C(0.93, 0.93, 0.9),
  sharpBlue: C(0.2, 0.36, 0.76), // a desk sharpener's enamel
  sharpBlue2: C(0.13, 0.25, 0.56),
  navy2: C(0.2, 0.25, 0.4),
  kraft: C(0.7, 0.54, 0.36), // cardboard
  kraft2: C(0.54, 0.4, 0.26),
  tape: C(0.82, 0.78, 0.66),
  hiYellow: C(0.92, 0.86, 0.16), // a highlighter's body
  hiGlow: C(0.85, 1.0, 0.3),
  inkGlass: C(0.1, 0.14, 0.38),
  ruler: C(0.9, 0.78, 0.5), // boxwood
  gold: C(0.86, 0.66, 0.22),
  pencils: [C(0.96, 0.74, 0.14), C(0.62, 0.08, 0.1), C(0.2, 0.45, 0.85), C(0.25, 0.62, 0.32), C(0.7, 0.3, 0.62), C(0.9, 0.46, 0.12)],
};

// a geometry mirrored by a negative scale: its faces turned back out
function flip(g) {
  const m = g.index ? g.toNonIndexed() : g;
  for (const name of ['position', 'normal', 'uv']) {
    const at = m.attributes[name];
    if (!at) continue;
    const n = at.itemSize;
    const A = at.array;
    for (let i = 0; i < A.length; i += n * 3) {
      for (let k = 0; k < n; k++) {
        const t = A[i + n + k];
        A[i + n + k] = A[i + 2 * n + k];
        A[i + 2 * n + k] = t;
      }
    }
  }
  return m;
}

// a whole kit moved (a part built where it sits on the gun, then brought to its own hinge)
function shift(kit, x, y, z) {
  for (const list of kit.parts.values()) for (const it of list) it.g.translate(x, y, z);
}

// a pencil's end for a butt: a brass ferrule crimped twice and a rubber on it (its back face at z0 - 0.07), over a stock
// y0..y1 high and hw half-wide at z0
function pencilButt(K, M, z0, y0, y1, hw) {
  const S = INK;
  K.add(M.metal, plate(rounded([[z0 - 0.03, y0 - 0.004], [z0 + 0.002, y0 - 0.002], [z0 + 0.002, y1 + 0.002], [z0 - 0.03, y1 + 0.004]], 0.01, 3), -hw - 0.0015, hw + 0.0015, { bevel: 0.007, bs: 2 }), S.brass);
  for (const z of [z0 - 0.023, z0 - 0.011]) K.add(M.metal, plate(rounded([[z, y0 - 0.006], [z + 0.005, y0 - 0.006], [z + 0.005, y1 + 0.006], [z, y1 + 0.006]], 0.01, 3), -hw - 0.0026, hw + 0.0026, { bevel: 0.006, bs: 2 }), S.steel3);
  K.add(M.round, plate(rounded([[z0 - 0.07, y0 + 0.002], [z0 - 0.03, y0 - 0.002], [z0 - 0.03, y1 + 0.002], [z0 - 0.07, y1 - 0.004]], 0.016, 4), -hw - 0.0005, hw + 0.0005, { bevel: 0.01, bs: 2 }), S.eraser);
}

// a trigger in its guard: the guard a loop of steel from z0 to z1 hanging from y to y - d, the blade in it
function triggerGuard(K, M, z0, z1, y, d, col, o = {}) {
  const S = INK;
  const out = rounded([[z0, y + 0.004], [z1, y + 0.004], [z1, y - d * 0.55], [z1 - d * 0.5, y - d], [z0 + 0.008, y - d], [z0, y - d * 0.75]], d * 0.3, 4);
  const t = o.t || 0.007;
  const inn = rounded([[z0 + t, y], [z1 - t, y], [z1 - t, y - d * 0.5], [z1 - d * 0.5 - t * 0.4, y - d + t], [z0 + t + 0.006, y - d + t], [z0 + t, y - d * 0.7]], d * 0.22, 4);
  K.add(M.metal, plate(out, -(o.hw || 0.008), o.hw || 0.008, { bevel: 0.002, holes: [inn] }), col);
  for (const zt of o.blades || [z0 + (z1 - z0) * 0.42]) K.add(M.metal, plate(rounded([[zt, y], [zt + 0.011, y], [zt + 0.009, y - d * 0.45], [zt + 0.014, y - d * 0.74], [zt + 0.008, y - d * 0.78], [zt, y - d * 0.45]], 0.003, 3), -0.004, 0.004, { bevel: 0.0014 }), S.bright);
}

// a sheet of paper folded to a dart, its nose at z + 0.18 * s: two wings and the keel under them (seen from both sides)
function paperPlane(K, M, x, y, z, s, col, col2) {
  const P = [0, y, z + 0.18 * s, -0.09 * s, y + 0.012, z - 0.04 * s, 0, y - 0.004, z - 0.05 * s, 0, y, z + 0.18 * s, 0, y - 0.004, z - 0.05 * s, 0.09 * s, y + 0.012, z - 0.04 * s, 0, y, z + 0.18 * s, 0, y - 0.004, z - 0.05 * s, 0, y - 0.03, z - 0.04 * s];
  for (let i = 0; i < P.length; i += 3) P[i] += x;
  const w = new THREE.BufferGeometry();
  w.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  w.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((P.length / 3) * 2).fill(0), 2));
  w.computeVertexNormals();
  K.add(M.matte, w, col);
  const back = w.clone();
  const p = back.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = p[i + 3 + k];
      p[i + 3 + k] = p[i + 6 + k];
      p[i + 6 + k] = t;
    }
  }
  back.computeVertexNormals();
  K.add(M.matte, back, col2 || col);
}

// a pencil-stub round lying along z, its point at z1: a lacquered case, a cut cone of wood, a graphite point
function stubRound(K, M, x, y, z0, len, r, o = {}) {
  const body = len * 0.62;
  const cone = len * 0.26;
  K.add(M.paint, lathe([[z0, 0], [z0, r * 0.82], [z0 + r * 0.25, r], [z0 + body, r]], { x, y, segs: 6, soft: 2 }), o.case || INK.yellow);
  // (the rim it is pulled by)
  K.add(M.metal, lathe([[z0 - r * 0.2, 0], [z0 - r * 0.2, r * 1.04], [z0 + r * 0.12, r * 1.04], [z0 + r * 0.12, r * 0.8]], { x, y, segs: 6 }), INK.brass);
  K.add(M.matte, lathe([[z0 + body, r], [z0 + body + cone, r * 0.32]], { x, y, segs: 6, soft: 2 }), INK.tipwood);
  K.add(M.matte, lathe([[z0 + body + cone, r * 0.32], [z0 + len, 0.0004]], { x, y, segs: 6, soft: 2 }), INK.lead);
}

export const ARMS = {
  // ------------------------------------------------------------------ the MAG
  // The general-purpose machine gun, belt-fed, gas-operated, as it is built: a long riveted receiver, the feed cover
  // on top of it, a heavy quick-change barrel with its carrying handle, the gas cylinder under it and its regulator,
  // a bipod folded back along the cylinder, a wooden butt. Of the drawn city: graphite steel, pencil cedar, a belt of
  // pencil-stub rounds out of an ink tin, a pencil's ferrule and eraser for a butt plate.
  mag(K, M, o = {}) {
    const S = INK;
    const Kit = K.constructor;
    const BY = 0.086; // the barrel's axis
    const GY = 0.045; // the gas cylinder's
    const W = 0.03; // half the receiver's width

    // --- the receiver: two side plates and what is between them
    const recv = [[-0.14, 0.028], [0.3, 0.028], [0.312, 0.04], [0.312, 0.104], [0.296, 0.114], [-0.118, 0.114], [-0.14, 0.098]];
    K.add(M.metal, plate(recv, -W, W, { bevel: 0.0035 }), S.steel);
    // (the reinforcing plates riveted to its sides, front and rear; the rail the cocking handle runs in)
    for (const s of [1, -1]) {
      K.add(M.metal, plate([[0.2, 0.034], [0.306, 0.034], [0.306, 0.108], [0.2, 0.108]], s * W, s * (W + 0.0028), { bevel: 0.0012, r: 0.004 }), S.steel2);
      K.add(M.metal, plate([[-0.132, 0.034], [-0.04, 0.034], [-0.04, 0.1], [-0.122, 0.108], [-0.132, 0.098]], s * W, s * (W + 0.0028), { bevel: 0.0012, r: 0.004 }), S.steel2);
      K.add(M.metal, plate([[-0.03, 0.06], [0.19, 0.06], [0.19, 0.066], [-0.03, 0.066]], s * W, s * (W + 0.002), { bevel: 0.0008 }), S.steel3);
      K.add(M.metal, plate([[-0.03, 0.036], [0.19, 0.036], [0.19, 0.042], [-0.03, 0.042]], s * W, s * (W + 0.002), { bevel: 0.0008 }), S.steel3);
      for (const z of [-0.124, -0.1, -0.076, -0.05]) for (const y of [0.042, 0.092]) screw(K, M.metal, s * (W + 0.0028), y, z, 0.0042, S.bright);
      for (const z of [0.212, 0.24, 0.268, 0.296]) for (const y of [0.042, 0.1]) screw(K, M.metal, s * (W + 0.0028), y, z, 0.0042, S.bright);
      for (const z of [-0.02, 0.03, 0.08, 0.13, 0.18]) screw(K, M.metal, s * (W + 0.002), 0.039, z, 0.003, S.bright);
    }
    // (the right side: the slot of the cocking handle, the handle; the port the links fall out of)
    K.add(M.matte, plate([[0.0, 0.074], [0.19, 0.074], [0.19, 0.086], [0.0, 0.086]], -W - 0.001, -W + 0.001, { bevel: 0.0004, r: 0.005 }), S.black);
    const Q = new Kit();
    Q.add(M.metal, cbox(-W - 0.012, 0.07, 0.15, -W, 0.09, 0.176, 0.003), S.steel3);
    Q.add(M.metal, mirrored(lathe([[W + 0.006, 0], [W + 0.006, 0.0085], [W + 0.012, 0.0085], [W + 0.014, 0.011], [W + 0.034, 0.012], [W + 0.038, 0.0095], [W + 0.038, 0]], { axis: 'x', y: 0.08, z: 0.163, segs: 10 })), S.bright);
    K.add(M.matte, plate([[0.088, 0.094], [0.19, 0.094], [0.19, 0.11], [0.088, 0.11]], -W - 0.0012, -W + 0.001, { bevel: 0.0004, r: 0.003 }), S.black);
    // (the left side: the serial plate, the barrel's locking lever)
    K.add(M.metal, plate([[-0.02, 0.07], [0.05, 0.07], [0.05, 0.094], [-0.02, 0.094]], W, W + 0.0016, { bevel: 0.0006 }), S.steel3);
    for (const z of [-0.014, 0.044]) screw(K, M.metal, W + 0.0016, 0.082, z, 0.0022, S.bright);
    K.add(M.metal, plate([[0.262, 0.05], [0.316, 0.056], [0.322, 0.07], [0.316, 0.08], [0.262, 0.074]], W + 0.0028, W + 0.011, { bevel: 0.002, r: 0.004 }), S.steel3);
    screw(K, M.metal, W + 0.011, 0.064, 0.272, 0.0055, S.bright);
    // (under it: the ejection port and its cover, a little open)
    K.add(M.matte, cbox(-0.02, 0.0265, 0.09, 0.02, 0.029, 0.2, 0.001), S.black);
    K.add(M.metal, tilted(cbox(-0.021, 0.022, 0.09, 0.021, 0.0245, 0.2, 0.001), -0.1, 0.024, 0.2), S.steel2);

    // --- the feed cover on top, its latch at the back, its hinge at the front; the feed tray under it
    // (the cover is a part of its own: it swings up on its hinge when a new belt is laid in)
    const V = new Kit();
    const HY = 0.121;
    const HZ = 0.27;
    const cover = [[0.03, 0.114], [0.268, 0.114], [0.276, 0.124], [0.262, 0.14], [0.08, 0.15], [0.044, 0.146], [0.03, 0.134]];
    V.add(M.metal, plate(cover, -W - 0.002, W + 0.002, { bevel: 0.004, r: 0.004 }), S.steel2);
    V.add(M.metal, plate([[0.07, 0.15], [0.25, 0.141], [0.25, 0.146], [0.074, 0.155]], -0.012, 0.012, { bevel: 0.002 }), S.steel);
    slots(V, M.matte, 5, 0.09, 0.24, 0.122, 0.136, W + 0.002, S.black, { fill: 0.5, lean: 0.004 });
    K.add(M.metal, lathe([[-W - 0.006, 0], [-W - 0.006, 0.0055], [W + 0.006, 0.0055], [W + 0.006, 0]], { axis: 'x', y: 0.121, z: 0.27, segs: 8 }), S.bright);
    for (const s of [1, -1]) V.add(M.metal, cbox(s * W + (s > 0 ? 0.002 : -0.008), 0.12, 0.034, s * W + (s > 0 ? 0.008 : -0.002), 0.138, 0.056, 0.002), S.steel3);
    for (const s of [1, -1]) ridges(V, M.metal, 4, 0.036, 0.054, 0.122, 0.136, W + 0.008, S.bright, { one: s, h: 0.001 });
    // (what is under it: the pawls that pull the belt across, the slot the round drops through)
    V.add(M.metal, cbox(-0.02, 0.1155, 0.12, 0.02, 0.119, 0.18, 0.001), S.steel3);
    for (const z of [0.132, 0.15, 0.168]) V.add(M.metal, cbox(-0.016, 0.1135, z - 0.004, 0.016, 0.1158, z + 0.004, 0.0008), S.bright);
    shift(V, 0, -HY, -HZ);
    K.add(M.matte, cbox(-0.011, 0.1136, 0.1, 0.011, 0.1146, 0.192, 0.0004), S.black);
    for (const s of [1, -1]) K.add(M.metal, cbox(s * 0.013, 0.1136, 0.094, s * 0.019, 0.1166, 0.198, 0.0006), S.steel3);
    K.add(M.metal, cbox(-W - 0.003, 0.108, 0.086, W + 0.052, 0.114, 0.196, 0.0015), S.steel3);
    K.add(M.metal, plate([[0.086, 0.114], [0.196, 0.114], [0.196, 0.121], [0.086, 0.121]], W + 0.046, W + 0.052, { bevel: 0.001 }), S.steel3);

    // --- the rear sight on the receiver's back: its base, the leaf folded down, the aperture up
    K.add(M.metal, cbox(-0.016, 0.114, -0.1, 0.016, 0.122, 0.012, 0.002), S.steel2);
    K.add(M.metal, plate([[-0.092, 0.122], [0.004, 0.122], [0.004, 0.127], [-0.092, 0.127]], -0.011, 0.011, { bevel: 0.001 }), S.steel3);
    for (let i = 0; i < 7; i++) K.add(M.matte, cbox(-0.0112, 0.1272, -0.084 + i * 0.012, 0.0112, 0.1278, -0.0825 + i * 0.012, 0.0002), S.bright);
    K.add(M.metal, plate([[-0.1, 0.122], [-0.092, 0.122], [-0.092, 0.146], [-0.096, 0.15], [-0.1, 0.146]], -0.012, 0.012, { bevel: 0.0012 }), S.steel2);
    K.add(M.matte, lathe([[-0.1012, 0], [-0.1012, 0.0034], [-0.0908, 0.0034], [-0.0908, 0]], { y: 0.141, segs: 8 }), S.black);
    for (const s of [1, -1]) screw(K, M.metal, s * 0.016, 0.118, -0.06, 0.0045, S.bright, { h: 0.004 });

    // --- the trigger housing, the guard, the trigger, the grip
    K.add(M.metal, plate([[-0.1, 0.03], [0.09, 0.03], [0.09, 0.016], [0.06, 0.006], [-0.1, 0.006]], -0.019, 0.019, { bevel: 0.0025 }), S.steel2);
    const guardOut = rounded([[-0.004, 0.008], [0.088, 0.008], [0.088, -0.022], [0.07, -0.04], [0.004, -0.04], [-0.004, -0.03]], 0.012, 4);
    const guardIn = rounded([[0.006, 0.004], [0.08, 0.004], [0.08, -0.02], [0.066, -0.033], [0.008, -0.033], [0.006, -0.026]], 0.009, 4);
    K.add(M.metal, plate(guardOut, -0.009, 0.009, { bevel: 0.002, holes: [guardIn] }), S.steel2);
    K.add(M.metal, plate(rounded([[0.03, 0.006], [0.042, 0.006], [0.04, -0.012], [0.046, -0.024], [0.04, -0.026], [0.03, -0.012]], 0.004, 3), -0.0045, 0.0045, { bevel: 0.0015 }), S.bright);
    for (const s of [1, -1]) screw(K, M.metal, s * 0.019, 0.018, -0.07, 0.0036, S.bright);
    for (const s of [1, -1]) screw(K, M.metal, s * 0.019, 0.018, 0.07, 0.0036, S.bright);
    K.add(M.metal, lathe([[-0.024, 0], [-0.024, 0.006], [0.024, 0.006], [0.024, 0]], { axis: 'x', y: 0.018, z: -0.02, segs: 8 }), S.red);
    // (the grip: raked back, cedar cheeks on a steel frame, cut with a hand's hold)
    const grip = rounded([[-0.052, 0.008], [-0.004, 0.008], [-0.03, -0.118], [-0.086, -0.118], [-0.092, -0.104]], 0.012, 4);
    K.add(M.metal, plate(grip, -0.012, 0.012, { bevel: 0.003 }), S.steel);
    for (const s of [1, -1]) {
      K.add(M.matte, plate(rounded([[-0.05, 0.0], [-0.01, 0.0], [-0.034, -0.112], [-0.082, -0.112], [-0.086, -0.1]], 0.012, 4), s * 0.012, s * 0.021, { bevel: 0.005 }), S.cedar);
      for (let i = 0; i < 7; i++) {
        const y = -0.02 - i * 0.012;
        const z0 = -0.05 + (y / -0.112) * -0.03;
        K.add(M.matte, plate([[z0, y], [z0 + 0.036, y], [z0 + 0.035, y - 0.004], [z0 - 0.001, y - 0.004]], s * 0.021, s * 0.0226, { bevel: 0.0006 }), S.cedar2);
      }
      screw(K, M.metal, s * 0.021, -0.055, -0.048, 0.005, S.bright, { h: 0.002 });
    }
    K.add(M.metal, cbox(-0.0125, -0.123, -0.09, 0.0125, -0.116, -0.028, 0.002), S.steel2);

    // --- the butt: the back plate and the buffer, the cedar stock, the ferrule and the eraser, the shoulder rest
    K.add(M.metal, plate([[-0.156, 0.03], [-0.14, 0.026], [-0.14, 0.1], [-0.118, 0.116], [-0.156, 0.116]], -W - 0.001, W + 0.001, { bevel: 0.003 }), S.steel2);
    K.add(M.metal, lathe([[-0.156, 0.016], [-0.176, 0.016], [-0.176, 0]], { y: 0.074, segs: 10 }), S.steel3);
    for (const s of [1, -1]) screw(K, M.metal, s * (W + 0.001), 0.1, -0.148, 0.0048, S.bright);
    const stock = rounded([[-0.156, 0.034], [-0.156, 0.108], [-0.44, 0.112], [-0.44, -0.034], [-0.3, -0.008]], 0.014, 4);
    K.add(M.matte, plate(stock, -0.023, 0.023, { bevel: 0.009, bs: 2 }), S.cedar);
    // (the grain of it: long dark strokes let into its cheeks)
    for (const s of [1, -1]) {
      for (const [z0, z1, y] of [[-0.42, -0.2, 0.086], [-0.4, -0.25, 0.06], [-0.43, -0.3, 0.034], [-0.41, -0.33, 0.006], [-0.3, -0.18, 0.05]]) K.add(M.matte, plate([[z0, y], [z1, y + 0.002], [z1, y + 0.0045], [z0, y + 0.003]], s * 0.0225, s * 0.0236, { bevel: 0.0004 }), S.cedar2);
      K.add(M.metal, plate(rounded([[-0.25, 0.05], [-0.2, 0.05], [-0.2, 0.076], [-0.25, 0.076]], 0.008, 3), s * 0.023, s * 0.0246, { bevel: 0.0008 }), S.brass);
      screw(K, M.metal, s * 0.0246, 0.063, -0.225, 0.004, S.bright, { h: 0.0015 });
    }
    // (a pencil's end: the ferrule, crimped twice, and the eraser)
    const fer = rounded([[-0.47, -0.04], [-0.438, -0.038], [-0.438, 0.116], [-0.47, 0.118]], 0.01, 3);
    K.add(M.metal, plate(fer, -0.0245, 0.0245, { bevel: 0.007, bs: 2 }), S.brass);
    for (const z of [-0.462, -0.449]) K.add(M.metal, plate(rounded([[z, -0.042], [z + 0.005, -0.042], [z + 0.005, 0.12], [z, 0.12]], 0.01, 3), -0.0256, 0.0256, { bevel: 0.006, bs: 2 }), S.steel3);
    K.add(M.round, plate(rounded([[-0.512, -0.034], [-0.47, -0.038], [-0.47, 0.116], [-0.512, 0.11]], 0.016, 4), -0.0235, 0.0235, { bevel: 0.01, bs: 2 }), S.eraser);
    // (the shoulder rest, folded down along its top; the sling's loop under it)
    K.add(M.metal, plate([[-0.5, 0.118], [-0.39, 0.118], [-0.386, 0.122], [-0.5, 0.123]], -0.016, 0.016, { bevel: 0.0012 }), S.steel2);
    K.add(M.metal, lathe([[-0.018, 0], [-0.018, 0.004], [0.018, 0.004], [0.018, 0]], { axis: 'x', y: 0.12, z: -0.392, segs: 8 }), S.bright);
    K.add(M.metal, pipe([[-0.012, -0.012, -0.34], [-0.012, -0.036, -0.335], [0.012, -0.036, -0.335], [0.012, -0.012, -0.34]], 0.0028, { steps: 12, tension: 0.2 }), S.bright);
    K.add(M.metal, cbox(-0.014, -0.018, -0.352, 0.014, -0.008, -0.328, 0.002), S.steel2);

    // --- the barrel: its nut, the heavy barrel, the front sight on its ears, the slotted flash hider
    K.add(M.metal, lathe([[0.312, 0.0], [0.312, 0.027], [0.318, 0.029], [0.352, 0.029], [0.358, 0.024], [0.358, 0.0195]], { y: BY, segs: 18 }), S.steel2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      K.add(M.metal, rod([Math.cos(a) * 0.0292, BY + Math.sin(a) * 0.0292, 0.32], [Math.cos(a) * 0.0292, BY + Math.sin(a) * 0.0292, 0.35], 0.0026, 0.0026, 4), S.steel3);
    }
    K.add(M.metal, lathe([[0.358, 0.0195], [0.5, 0.018], [0.52, 0.0205], [0.566, 0.0205], [0.574, 0.0172], [0.76, 0.0152], [0.764, 0.019], [0.79, 0.019], [0.794, 0.0146], [0.82, 0.0146]], { y: BY, segs: 18 }), S.steel);
    // (the heat of it: a skin over the barrel, seen only once it has fired long - game/armfx.js colours it)
    const H = new Kit();
    H.add(M.glow, lathe([[0.412, 0.0188], [0.5, 0.0186], [0.52, 0.0211], [0.566, 0.0211], [0.574, 0.0178], [0.76, 0.0158]], { y: BY, segs: 14 }), C(0.6, 0.12, 0.05));
    // (the flash hider: a cone cut with long slots, its mouth; the bore)
    K.add(M.metal, lathe([[0.82, 0.0146], [0.824, 0.0185], [0.84, 0.0185], [0.9, 0.0235], [0.906, 0.021], [0.906, 0.0125], [0.83, 0.0085], [0.83, 0.0]], { y: BY, segs: 18 }), S.steel2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      const c = Math.cos(a);
      const s = Math.sin(a);
      K.add(M.matte, rod([c * 0.0196, BY + s * 0.0196, 0.846], [c * 0.0232, BY + s * 0.0232, 0.894], 0.0034, 0.0034, 4), S.black);
    }
    K.add(M.matte, lathe([[0.9065, 0.0125], [0.9065, 0.0]], { y: BY, segs: 12 }), S.black);
    // (the front sight: a band, two ears, the post between them)
    K.add(M.metal, plate(rounded([[0.762, BY + 0.012], [0.792, BY + 0.012], [0.79, BY + 0.05], [0.782, BY + 0.058], [0.77, BY + 0.058], [0.764, BY + 0.05]], 0.004, 3), 0.008, 0.0125, { bevel: 0.0012 }), S.steel2);
    K.add(M.metal, plate(rounded([[0.762, BY + 0.012], [0.792, BY + 0.012], [0.79, BY + 0.05], [0.782, BY + 0.058], [0.77, BY + 0.058], [0.764, BY + 0.05]], 0.004, 3), -0.0125, -0.008, { bevel: 0.0012 }), S.steel2);
    K.add(M.metal, cbox(-0.0125, BY + 0.014, 0.764, 0.0125, BY + 0.03, 0.79, 0.002), S.steel2);
    K.add(M.metal, lathe([[BY + 0.03, 0.0026], [BY + 0.05, 0.0018], [BY + 0.05, 0]], { axis: 'y', z: 0.777, segs: 6 }), S.bright);

    // --- the carrying handle on the barrel: its collar, its arm, the cedar grip
    K.add(M.metal, lathe([[0.385, 0.0], [0.385, 0.0235], [0.41, 0.0235], [0.41, 0.0]], { y: BY, segs: 14 }), S.steel2);
    K.add(M.metal, plate([[0.386, BY + 0.018], [0.408, BY + 0.018], [0.4, BY + 0.05], [0.36, BY + 0.094], [0.35, BY + 0.088], [0.384, BY + 0.046]], -0.006, 0.006, { bevel: 0.002 }), S.steel2);
    K.add(M.matte, lathe([[0.25, 0.0], [0.25, 0.0125], [0.256, 0.0145], [0.3, 0.0158], [0.344, 0.0145], [0.35, 0.0125], [0.35, 0.0]], { y: BY + 0.098, segs: 12 }), S.cedar);
    for (const z of [0.262, 0.3, 0.338]) K.add(M.matte, lathe([[z, 0.0152], [z + 0.003, 0.0152]], { y: BY + 0.098, segs: 12 }), S.cedar2);
    K.add(M.metal, lathe([[0.35, 0.0], [0.35, 0.0085], [0.366, 0.0085], [0.366, 0.0]], { y: BY + 0.098, segs: 8 }), S.steel3);
    screw(K, M.metal, 0.006, BY + 0.03, 0.397, 0.0045, S.bright, { both: true });

    // --- the gas cylinder under the barrel, the block that joins them, the regulator with its three ports
    K.add(M.metal, lathe([[0.312, 0.0], [0.312, 0.0155], [0.33, 0.0155], [0.334, 0.0138], [0.52, 0.0138], [0.524, 0.016], [0.566, 0.016]], { y: GY, segs: 14 }), S.steel2);
    K.add(M.metal, plate(rounded([[0.522, GY - 0.006], [0.566, GY - 0.006], [0.566, BY + 0.004], [0.522, BY + 0.004]], 0.004, 3), -0.0135, 0.0135, { bevel: 0.003 }), S.steel2);
    K.add(M.metal, lathe([[0.566, 0.016], [0.57, 0.0195], [0.6, 0.0195], [0.604, 0.016], [0.612, 0.016], [0.62, 0.011], [0.62, 0.0]], { y: GY, segs: 14 }), S.steel3);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      K.add(M.metal, rod([Math.cos(a) * 0.0196, GY + Math.sin(a) * 0.0196, 0.574], [Math.cos(a) * 0.0196, GY + Math.sin(a) * 0.0196, 0.598], 0.0022, 0.0022, 4), S.steel);
    }
    for (const a of [-0.8, 0, 0.8]) K.add(M.matte, rod([-0.0192, GY + Math.sin(a) * 0.011, 0.585], [-0.0204, GY + Math.sin(a) * 0.011, 0.585], 0.0026, 0.0026, 6), S.black);
    screw(K, M.metal, 0.0135, (GY + BY) / 2, 0.544, 0.0045, S.bright, { both: true });

    // --- the belt out of the ink tin on its left: pencil-stub rounds in their links, over the feed tray and down
    const B = new Kit();
    const path = [];
    for (let i = 0; i < 12; i++) {
      // (along the tray, over its edge, and down in a hang to the tin's mouth)
      const t = i * 0.0152;
      let x;
      let y;
      if (t < 0.052) {
        x = 0.012 + t;
        y = 0.1235;
      } else {
        const u = t - 0.052;
        const a = Math.min(Math.PI / 2, u / 0.022);
        x = 0.064 + Math.sin(a) * 0.022 + Math.max(0, u - 0.0346) * 0.08;
        y = 0.1235 - (1 - Math.cos(a)) * 0.022 - Math.max(0, u - 0.0346);
      }
      path.push([x, y]);
    }
    path.forEach(([x, y], i) => {
      stubRound(B, M, x, y, 0.106, 0.074, 0.0066);
      if (i < path.length - 1) {
        const [x2, y2] = path[i + 1];
        B.add(M.metal, rod([x, y, 0.128], [x2, y2, 0.128], 0.0036, 0.0036, 4), S.steel);
        B.add(M.metal, rod([x, y, 0.15], [x2, y2, 0.15], 0.0036, 0.0036, 4), S.steel);
      }
      B.add(M.metal, lathe([[0.124, 0.0074], [0.134, 0.0074]], { x, y, segs: 6 }), S.steel);
      B.add(M.metal, lathe([[0.146, 0.0074], [0.154, 0.0074]], { x, y, segs: 6 }), S.steel);
    });
    // (the tin: a lid, a label, a latch; hung from the receiver on its bracket)
    K.add(M.paint, cbox(0.05, -0.062, 0.09, 0.126, 0.028, 0.2, 0.005), S.tin);
    K.add(M.paint, cbox(0.047, 0.026, 0.087, 0.129, 0.04, 0.203, 0.004), S.tin);
    K.add(M.matte, cbox(0.07, 0.039, 0.1, 0.112, 0.041, 0.19, 0.001), S.black);
    K.add(M.matte, cbox(0.1262, -0.04, 0.104, 0.1272, 0.008, 0.186, 0.0004), S.label);
    K.add(M.matte, cbox(0.1274, -0.03, 0.112, 0.128, -0.022, 0.178, 0.0003), S.tin);
    K.add(M.matte, cbox(0.1274, -0.016, 0.112, 0.128, -0.006, 0.15, 0.0003), S.lead);
    K.add(M.metal, cbox(0.126, 0.012, 0.132, 0.1325, 0.034, 0.158, 0.002), S.bright);
    for (const z of [0.098, 0.192]) K.add(M.metal, cbox(0.049, -0.062, z - 0.004, 0.127, 0.028, z + 0.004, 0.002), S.steel3);
    K.add(M.metal, plate([[0.1, 0.03], [0.19, 0.03], [0.19, 0.046], [0.1, 0.046]], W, 0.052, { bevel: 0.002 }), S.steel2);

    // --- the bipod: its yoke on the gas cylinder, two legs and their feet (folded back along the cylinder)
    const P = new Kit();
    const PZ = 0.5;
    const PY = GY - 0.016;
    for (const s of [1, -1]) {
      // (in the bipod's own frame: its hinge at the origin, the legs running down -y when it stands)
      P.add(M.metal, rod([s * 0.016, 0, 0], [s * 0.04, -0.3, 0.01], 0.0062, 0.0052, 8), S.steel2);
      P.add(M.metal, rod([s * 0.0235, -0.09, 0.003], [s * 0.031, -0.19, 0.0065], 0.0074, 0.0074, 8), S.steel3);
      P.add(M.metal, plate(rounded([[-0.018, -0.3], [0.03, -0.3], [0.036, -0.312], [-0.024, -0.312]], 0.004, 3), s * 0.04 - 0.01, s * 0.04 + 0.01, { bevel: 0.002 }), S.steel2);
      P.add(M.metal, lathe([[0.0, 0.0], [0.0, 0.009], [0.006, 0.009], [0.006, 0]], { axis: 'x', y: 0, z: 0, segs: 8 }).translate(s > 0 ? 0.012 : -0.018, 0, 0), S.bright);
    }
    P.add(M.metal, rod([-0.03, -0.14, 0.0045], [0.03, -0.14, 0.0045], 0.0032, 0.0032, 6), S.steel3);
    K.add(M.metal, lathe([[PZ - 0.014, 0.0], [PZ - 0.014, 0.0175], [PZ + 0.014, 0.0175], [PZ + 0.014, 0.0]], { y: GY, segs: 12 }), S.steel3);
    K.add(M.metal, cbox(-0.02, PY - 0.008, PZ - 0.012, 0.02, PY + 0.004, PZ + 0.012, 0.002), S.steel3);

    return {
      muzzle: new THREE.Vector3(0, BY, 0.91),
      length: 1.42,
      eject: new THREE.Vector3(-0.034, 0.1, 0.14),
      fore: new THREE.Vector3(0, GY - 0.02, 0.42),
      barrelAt: [0.36, 0.82, BY, 0.02],
      // (the left hand's hold, under the receiver's front; where the gun rests on its legs)
      hold: new THREE.Vector3(0.0, 0.016, 0.2),
      beltPitch: 0.0152,
      parts: {
        belt: { kit: B, at: [0, 0, 0] },
        bipod: { kit: P, at: [0, PY, PZ], fold: Math.PI / 2 - 0.06 },
        cover: { kit: V, at: [0, HY, HZ] },
        cock: { kit: Q, at: [0, 0, 0] },
        heat: { kit: H, at: [0, 0, 0], hide: true },
      },
    };
  },

  // ---------------------------------------------------------------------------------------------- the M16 pencil rifle
  // The service rifle of the later pattern as it is made: a forged upper and lower pinned together, the carrying handle
  // with the rear sight on its back and the drum that raises it, the forward assist, the port with its cover dropped
  // open and the brass deflector behind it, a fixed polymer stock and its butt plate with the trapdoor, a round ribbed
  // handguard in two halves held by the slip ring, the front sight's post between its ears on the triangular base - and
  // its barrel a long yellow pencil, its ferrule the barrel nut, sharpened at the muzzle. Through the open port: the
  // next pencil lying in the magazine's lips.
  rifle(K, M) {
    const S = INK;
    const BY = 0.046; // the bore
    const UT = 0.074; // the upper's top
    // --- the lower: the magazine well and its flared mouth, the grip with its finger swell, the guard
    K.add(M.metal, plate(rounded([[-0.124, -0.002], [-0.03, -0.002], [-0.01, 0.006], [0.098, 0.006], [0.1, -0.054], [0.18, -0.058], [0.184, -0.002], [0.194, 0.024], [-0.124, 0.024]], 0.006, 3), -0.016, 0.016, { bevel: 0.004 }), S.alu);
    K.add(M.metal, plate(rounded([[0.097, -0.048], [0.183, -0.052], [0.185, -0.062], [0.095, -0.058]], 0.003, 2), -0.0176, 0.0176, { bevel: 0.003 }), S.alu);
    const grip = rounded([[-0.056, 0.004], [-0.008, 0.004], [-0.016, -0.036], [-0.011, -0.05], [-0.019, -0.062], [-0.03, -0.106], [-0.08, -0.11], [-0.092, -0.094]], 0.01, 4);
    K.add(M.matte, plate(grip, -0.0138, 0.0138, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const s of [1, -1]) {
      for (let i = 0; i < 6; i++) K.add(M.matte, plate([[-0.074 - i * 0.002, -0.07 - i * 0.0062], [-0.04 - i * 0.002, -0.07 - i * 0.0062], [-0.041 - i * 0.002, -0.073 - i * 0.0062], [-0.075 - i * 0.002, -0.073 - i * 0.0062]], s * 0.0136, s * 0.0147, { bevel: 0.0005 }), S.steel);
      // (its pins: the takedown pin and the pivot, the hammer's and the trigger's)
      for (const [z, y] of [[-0.11, 0.014], [0.178, 0.012], [0.03, 0.013], [0.068, 0.011]]) screw(K, M.metal, s * 0.016, y, z, 0.0034, S.bright);
    }
    triggerGuard(K, M, 0.0, 0.094, 0.006, 0.042, S.alu, { hw: 0.007 });
    // (the left: the selector turned back to its third mark, three rounds a pull; the bolt catch over the guard)
    K.add(M.metal, lathe([[0.016, 0.0], [0.016, 0.0056], [0.0192, 0.0056], [0.0192, 0.0]], { axis: 'x', y: 0.013, z: -0.022, segs: 10 }), S.steel);
    K.add(M.metal, plate(rounded([[-0.026, 0.009], [-0.05, 0.0075], [-0.054, 0.0125], [-0.05, 0.0165], [-0.022, 0.0165]], 0.002, 2), 0.0175, 0.0212, { bevel: 0.0012 }), S.steel);
    for (const [z, y, c] of [[-0.002, 0.013, S.white], [-0.022, 0.021, S.white], [-0.058, 0.0125, S.red]]) K.add(M.matte, lathe([[0.016, 0.0], [0.016, 0.0016], [0.0164, 0.0016], [0.0164, 0.0]], { axis: 'x', y, z, segs: 6 }), c);
    K.add(M.metal, plate(rounded([[0.084, 0.004], [0.098, 0.006], [0.098, 0.02], [0.086, 0.022]], 0.002, 2), 0.016, 0.0188, { bevel: 0.001 }), S.alu2);
    // (the right: the magazine's catch in the fence round it)
    K.add(M.metal, plate(rounded([[0.08, -0.016], [0.098, -0.016], [0.098, 0.008], [0.08, 0.008]], 0.004, 2), -0.0186, -0.016, { bevel: 0.001, holes: [rounded([[0.084, -0.0115], [0.094, -0.0115], [0.094, 0.0035], [0.084, 0.0035]], 0.004, 2)] }), S.alu);
    K.add(M.metal, mirrored(lathe([[0.016, 0.0], [0.016, 0.0046], [0.0192, 0.0046], [0.0192, 0.0]], { axis: 'x', y: -0.004, z: 0.089, segs: 10 })), S.steel);

    // --- the upper: its body, the port cut through its right wall; in the port the bolt held back and the next round in
    // the magazine's lips; the cover dropped open under it, the deflector behind it, the forward assist
    const up = rounded([[-0.124, 0.024], [0.194, 0.024], [0.194, UT], [-0.118, UT], [-0.124, UT - 0.008]], 0.005, 3);
    const port = rounded([[0.012, 0.036], [0.1, 0.036], [0.1, 0.062], [0.012, 0.062]], 0.003, 2);
    K.add(M.metal, plate(up, -0.0068, 0.017, { bevel: 0.005 }), S.alu);
    K.add(M.metal, plate(up, -0.017, -0.0058, { bevel: 0.004, holes: [port] }), S.alu);
    K.add(M.matte, cbox(-0.0074, 0.035, 0.011, -0.0062, 0.063, 0.101, 0.0003), S.black);
    K.add(M.metal, cbox(-0.0158, 0.0375, 0.008, -0.0066, 0.0605, 0.027, 0.0012), S.steel3);
    K.add(M.matte, lathe([[0.0272, 0.0], [0.0272, 0.0034]], { x: -0.0112, y: 0.049, segs: 8 }), S.black);
    K.add(M.metal, cbox(-0.0158, 0.0352, 0.028, -0.0068, 0.0386, 0.099, 0.0006), S.alu2);
    stubRound(K, M, -0.0112, 0.0436, 0.031, 0.066, 0.0056);
    K.add(M.metal, cbox(-0.0194, 0.009, 0.012, -0.0174, 0.0335, 0.1, 0.001), S.alu2);
    K.add(M.metal, lathe([[0.008, 0.0], [0.008, 0.0019], [0.104, 0.0019], [0.104, 0.0]], { x: -0.0178, y: 0.0342, segs: 6 }), S.bright);
    K.add(M.metal, plate(rounded([[-0.032, 0.04], [0.008, 0.04], [0.008, 0.07], [-0.014, 0.072], [-0.032, 0.062]], 0.004, 2), -0.0256, -0.0165, { bevel: 0.003 }), S.alu);
    K.add(M.metal, lathe([[-0.094, 0.0], [-0.094, 0.0086], [-0.044, 0.0086], [-0.034, 0.005], [-0.032, 0.0]], { x: -0.0215, y: 0.055, segs: 12 }), S.alu);
    K.add(M.metal, lathe([[-0.113, 0.0], [-0.113, 0.0076], [-0.109, 0.0092], [-0.094, 0.0092], [-0.094, 0.0]], { x: -0.0215, y: 0.055, segs: 12 }), S.steel);
    for (const z of [-0.107, -0.102, -0.097]) K.add(M.metal, lathe([[z, 0.0095], [z + 0.002, 0.0095]], { x: -0.0215, y: 0.055, segs: 12 }), S.steel3);
    // (the charging handle under the rear sight, its latch on the left)
    K.add(M.metal, cbox(-0.0115, UT - 0.018, -0.137, 0.0115, UT - 0.006, -0.122, 0.002), S.alu2);
    K.add(M.metal, cbox(0.0115, UT - 0.017, -0.135, 0.018, UT - 0.008, -0.125, 0.0015), S.alu2);

    // --- the carrying handle and the rear sight on its back: two ears, the aperture, the windage knob, the drum
    const hdl = rounded([[-0.122, UT - 0.002], [0.174, UT - 0.002], [0.154, UT + 0.016], [0.126, UT + 0.046], [0.114, UT + 0.05], [-0.114, UT + 0.05], [-0.122, UT + 0.044]], 0.005, 3);
    const gap = rounded([[-0.05, UT + 0.008], [0.124, UT + 0.008], [0.11, UT + 0.031], [-0.042, UT + 0.033], [-0.05, UT + 0.026]], 0.008, 3);
    K.add(M.metal, plate(hdl, -0.0095, 0.0095, { bevel: 0.003, holes: [gap] }), S.alu);
    K.add(M.matte, cbox(-0.0022, UT + 0.0494, -0.03, 0.0022, UT + 0.0508, 0.1, 0.0003), S.black);
    K.add(M.matte, lathe([[UT + 0.049, 0.0], [UT + 0.049, 0.0032], [UT + 0.0512, 0.0032], [UT + 0.0512, 0.0]], { axis: 'y', z: 0.04, segs: 8 }), S.black);
    for (const s of [1, -1]) K.add(M.metal, plate(rounded([[-0.112, UT + 0.046], [-0.076, UT + 0.046], [-0.081, UT + 0.062], [-0.09, UT + 0.067], [-0.102, UT + 0.062]], 0.003, 2), s * 0.0072, s * 0.011, { bevel: 0.001 }), S.alu);
    K.add(M.metal, cbox(-0.0072, UT + 0.048, -0.097, 0.0072, UT + 0.066, -0.091, 0.001), S.steel3);
    K.add(M.matte, lathe([[-0.0972, 0.0], [-0.0972, 0.0021]], { y: UT + 0.058, segs: 8 }), S.black);
    K.add(M.metal, mirrored(lathe([[0.0095, 0.0], [0.0095, 0.0076], [0.018, 0.0076], [0.0196, 0.006], [0.0196, 0.0]], { axis: 'x', y: UT + 0.054, z: -0.094, segs: 12 })), S.steel);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      K.add(M.metal, rod([-0.011, UT + 0.054 + Math.sin(a) * 0.0078, -0.094 + Math.cos(a) * 0.0078], [-0.0176, UT + 0.054 + Math.sin(a) * 0.0078, -0.094 + Math.cos(a) * 0.0078], 0.0011, 0.0011, 4), S.steel3);
    }
    K.add(M.metal, lathe([[-0.0104, 0.0], [-0.0104, 0.0128], [0.0104, 0.0128], [0.0104, 0.0]], { axis: 'x', y: UT + 0.03, z: -0.094, segs: 18 }), S.steel3);
    K.add(M.matte, mirrored(lathe([[0.0105, 0.0], [0.0105, 0.0078], [0.0108, 0.0078], [0.0108, 0.0]], { axis: 'x', y: UT + 0.03, z: -0.094, segs: 12 })), S.steel);
    K.add(M.matte, lathe([[0.0105, 0.0], [0.0105, 0.0078], [0.0108, 0.0078], [0.0108, 0.0]], { axis: 'x', y: UT + 0.03, z: -0.094, segs: 12 }), S.steel);

    // --- the stock: fixed and long - polymer over the buffer, its comb in line with the bore; the plate and its door
    const st = rounded([[-0.124, UT - 0.002], [-0.455, UT + 0.002], [-0.455, -0.1], [-0.44, -0.098], [-0.2, -0.008], [-0.15, 0.014], [-0.124, 0.02]], 0.012, 4);
    K.add(M.matte, plate(st, -0.022, 0.022, { bevel: 0.009, bs: 2 }), S.polymer);
    K.add(M.matte, plate(rounded([[-0.134, 0.018], [-0.124, 0.02], [-0.124, UT - 0.002], [-0.134, UT - 0.002]], 0.003, 2), -0.0178, 0.0178, { bevel: 0.003 }), S.polymer);
    K.add(M.metal, plate(rounded([[-0.47, UT + 0.001], [-0.455, UT + 0.003], [-0.455, -0.101], [-0.47, -0.1]], 0.005, 2), -0.0228, 0.0228, { bevel: 0.004 }), S.alu2);
    K.add(M.metal, cbox(-0.014, -0.08, -0.4715, 0.014, 0.05, -0.469, 0.002), S.alu);
    K.add(M.metal, lathe([[-0.012, 0.0], [-0.012, 0.0028], [0.012, 0.0028], [0.012, 0.0]], { axis: 'x', y: -0.083, z: -0.4712, segs: 8 }), S.bright);
    screw(K, M.metal, 0.0, UT + 0.003, -0.462, 0.0034, S.bright);
    // (the sling's swivel under the butt)
    K.add(M.metal, cbox(-0.006, -0.094, -0.428, 0.006, -0.084, -0.412, 0.002), S.alu2);
    K.add(M.metal, pipe([[-0.011, -0.092, -0.42], [-0.011, -0.114, -0.418], [0.011, -0.114, -0.418], [0.011, -0.092, -0.42]], 0.0024, { steps: 12, tension: 0.2 }), S.bright);

    // --- the barrel: a pencil - its brass ferrule for the barrel nut, crimped into the upper; six yellow sides to the
    // point, its name stamped in gold along them
    K.add(M.metal, lathe([[0.194, 0.0], [0.194, 0.0196], [0.238, 0.0196], [0.242, 0.0176], [0.242, 0.0]], { y: BY, segs: 16 }), S.brass);
    for (const z of [0.2, 0.212, 0.224]) K.add(M.metal, lathe([[z, 0.0204], [z + 0.005, 0.0204]], { y: BY, segs: 16 }), S.steel3);
    K.add(M.paint, hexbar(0.238, 0.76, 0.0168, 0.0168, { y: BY }), S.yellow);
    for (const s of [1, -1]) K.add(M.matte, cbox(s * 0.0144, BY - 0.0022, 0.646, s * 0.0149, BY + 0.0022, 0.736, 0.0002), S.gold);
    K.add(M.matte, hexbar(0.742, 0.746, 0.0171, 0.0171, { y: BY }), S.lead);
    K.add(M.matte, hexbar(0.76, 0.83, 0.0168, 0.0062, { y: BY }), S.tipwood);
    K.add(M.matte, lathe([[0.83, 0.0062], [0.862, 0.0034], [0.862, 0.0019], [0.84, 0.0019]], { y: BY, segs: 8, soft: 2 }), S.lead);
    K.add(M.matte, lathe([[0.8622, 0.0019], [0.8622, 0.0]], { y: BY, segs: 8 }), S.black);
    // (the slip ring that holds the handguard's back, its sloped face to the receiver)
    K.add(M.metal, lathe([[0.242, 0.0], [0.242, 0.0215], [0.25, 0.0345], [0.26, 0.0352], [0.264, 0.0325], [0.264, 0.0]], { y: BY, segs: 20 }), S.alu2);
    // (the handguard: two round halves, ribbed round for the hand, the seam between them along each side; its cap)
    K.add(M.matte, lathe([[0.262, 0.0], [0.262, 0.0306], [0.556, 0.0298], [0.556, 0.0]], { y: BY, segs: 20 }), S.polymer);
    for (let i = 0; i < 21; i++) K.add(M.matte, lathe([[0.27 + i * 0.0136, 0.0305], [0.2745 + i * 0.0136, 0.0323], [0.279 + i * 0.0136, 0.0304]], { y: BY, segs: 16, soft: 0.5 }), C(0.17, 0.17, 0.2));
    for (const s of [1, -1]) K.add(M.matte, cbox(s * 0.0294, BY - 0.0007, 0.264, s * 0.0326, BY + 0.0007, 0.558, 0.0002), S.black);
    K.add(M.metal, lathe([[0.556, 0.0], [0.556, 0.0334], [0.564, 0.0334], [0.572, 0.0262], [0.58, 0.0222], [0.58, 0.0]], { y: BY, segs: 20 }), S.alu2);
    // --- the front sight: its collar on the barrel and its pins, the triangle up to the ears, the post, the gas tube
    // into it, the bayonet's lug and the sling's swivel under it
    K.add(M.metal, lathe([[0.578, 0.0], [0.578, 0.0215], [0.632, 0.0215], [0.632, 0.0]], { y: BY, segs: 16 }), S.steel2);
    for (const z of [0.588, 0.622]) screw(K, M.metal, 0.0215, BY + 0.008, z, 0.0026, S.bright, { both: true });
    K.add(M.metal, plate(rounded([[0.58, BY + 0.012], [0.63, BY + 0.012], [0.614, BY + 0.066], [0.61, BY + 0.074], [0.598, BY + 0.074], [0.594, BY + 0.066]], 0.003, 2), -0.0075, 0.0075, { bevel: 0.002, holes: [rounded([[0.594, BY + 0.024], [0.616, BY + 0.024], [0.606, BY + 0.054], [0.603, BY + 0.054]], 0.003, 2)] }), S.steel2);
    for (const s of [1, -1]) K.add(M.metal, plate(rounded([[0.594, BY + 0.064], [0.614, BY + 0.064], [0.612, BY + 0.084], [0.604, BY + 0.088], [0.596, BY + 0.084]], 0.003, 2), s * 0.0055, s * 0.0088, { bevel: 0.001 }), S.steel2);
    K.add(M.metal, cbox(-0.0017, BY + 0.066, 0.6025, 0.0017, BY + 0.09, 0.6061, 0.0006), S.steel3);
    K.add(M.metal, lathe([[0.57, 0.0], [0.57, 0.0028], [0.584, 0.0028]], { y: BY + 0.024, segs: 8 }), S.steel3);
    K.add(M.metal, cbox(-0.0045, BY - 0.034, 0.602, 0.0045, BY - 0.02, 0.628, 0.0015), S.steel2);
    K.add(M.metal, pipe([[0, BY - 0.02, 0.584], [0, BY - 0.038, 0.582], [0, BY - 0.038, 0.598], [0, BY - 0.02, 0.596]], 0.0022, { steps: 10, tension: 0.2 }), S.bright);

    // --- the magazine: thirty rounds in a box, nearly straight, bowed forward toward its foot; the ribs pressed down its
    // sides, the floor plate (its lips and the next round seen through the port)
    const mf = [];
    const mb = [];
    const mc = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const y = -0.004 - 0.194 * t;
      const zc = 0.141 + 0.03 * t * t;
      mf.push([zc + 0.035, y]);
      mb.unshift([zc - 0.035, y]);
      mc.push([zc, y]);
    }
    K.add(M.metal, plate(rounded([...mf, ...mb], 0.004, 2), -0.0138, 0.0138, { bevel: 0.003 }), S.alu2);
    for (const f of [-0.016, 0.014]) {
      const a = mc.slice(2).map(([z, y]) => [z + f - 0.0022, y]);
      const b = mc.slice(2).map(([z, y]) => [z + f + 0.0022, y]).reverse();
      K.add(M.metal, plate([...a, ...b], -0.0148, 0.0148, { bevel: 0.0008 }), S.alu);
    }
    const [fz, fy] = mf[6];
    const [bz, by] = mb[0];
    K.add(M.metal, plate(rounded([[bz - 0.003, by + 0.004], [fz + 0.004, fy + 0.004], [fz + 0.004, fy - 0.008], [bz - 0.003, by - 0.008]], 0.003, 2), -0.0152, 0.0152, { bevel: 0.0025 }), S.steel2);
    return { muzzle: new THREE.Vector3(0, BY, 0.865), length: 1.34, hold: new THREE.Vector3(0, BY - 0.031, 0.32), eject: new THREE.Vector3(-0.018, 0.05, 0.056) };
  },

  // ---------------------------------------------------------------------------------------------- the marker SMG
  // The submachine gun of the roller-locked pattern as it is made: a receiver pressed out of sheet steel, the cocking
  // tube running on over the barrel with its handle forward on the left, the hooded front sight at its end and the
  // rotary drum at the back; a polymer trigger group with its grip, its big guard and the selector; a slim fore-end; a
  // stock of two steel struts and a rubber pad, pulled out; the curved magazine leaning forward in its well - and for
  // its barrel a fat felt-tip marker screwed into the front of the receiver: the ribbed ring it is gripped by, a blue
  // label round its dark body, the chisel nib at the muzzle.
  mp5(K, M) {
    const S = INK;
    const BY = 0.03; // the bore: the marker's axis
    const CY = 0.056; // the cocking tube's
    const CR = 0.0105;
    const TY = 0.066; // the receiver's top
    const W = 0.0165; // half the receiver's width
    const HY = CY + 0.028; // the line of the sights
    const blue = C(0.12, 0.32, 0.86);
    const dark = C(0.08, 0.1, 0.14);
    // --- the receiver: pressed steel, a rib down each side, the sleeves the stock's struts run in; its end cap and the
    // stock's latch; the mount's notches on top; the port on the right and the bolt in it
    K.add(M.metal, plate(rounded([[-0.112, 0.008], [0.134, 0.008], [0.134, 0.044], [0.128, TY], [-0.106, TY], [-0.112, TY - 0.006]], 0.004, 3), -W, W, { bevel: 0.004 }), S.steel);
    for (const s of [1, -1]) {
      K.add(M.metal, plate([[-0.1, 0.048], [0.124, 0.048], [0.124, 0.054], [-0.1, 0.054]], s * W, s * (W + 0.0014), { bevel: 0.0006, r: 0.002 }), S.steel2);
      K.add(M.metal, cbox(s * W, 0.02, -0.112, s * (W + 0.0058), 0.034, -0.026, 0.0016), S.steel2);
      for (const z of [-0.1, -0.04]) screw(K, M.metal, s * (W + 0.0058), 0.027, z, 0.0024, S.bright);
    }
    K.add(M.metal, plate(rounded([[-0.121, 0.012], [-0.11, 0.008], [-0.11, TY], [-0.121, TY - 0.004]], 0.002, 2), -W - 0.001, W + 0.001, { bevel: 0.002 }), S.steel2);
    K.add(M.metal, cbox(-0.006, TY - 0.008, -0.127, 0.006, TY + 0.001, -0.116, 0.002), S.steel3);
    for (const z of [-0.06, -0.046, 0.074, 0.088]) {
      K.add(M.metal, cbox(-0.0112, TY - 0.001, z, 0.0112, TY + 0.0028, z + 0.009, 0.001), S.steel2);
      K.add(M.matte, cbox(-0.0116, TY + 0.0004, z + 0.0032, 0.0116, TY + 0.003, z + 0.0058, 0.0003), S.black);
    }
    K.add(M.matte, plate([[0.03, 0.03], [0.074, 0.03], [0.074, 0.05], [0.03, 0.05]], -W - 0.001, -W + 0.001, { bevel: 0.0004, r: 0.003 }), S.black);
    K.add(M.metal, cbox(-W - 0.0012, 0.0335, 0.033, -W + 0.0004, 0.0465, 0.047, 0.0006), S.steel3);
    // (the magazine's well under its front, its catch behind it)
    K.add(M.metal, plate(rounded([[0.074, 0.01], [0.136, 0.01], [0.136, -0.028], [0.13, -0.034], [0.082, -0.034], [0.074, -0.028]], 0.003, 2), -W - 0.0015, W + 0.0015, { bevel: 0.003 }), S.steel);
    K.add(M.metal, plate(rounded([[0.064, -0.006], [0.074, -0.006], [0.075, -0.026], [0.068, -0.03]], 0.002, 2), -0.006, 0.006, { bevel: 0.0015 }), S.steel3);
    K.add(M.metal, mirrored(lathe([[W + 0.0015, 0.0], [W + 0.0015, 0.0042], [W + 0.0042, 0.0042], [W + 0.0042, 0.0]], { axis: 'x', y: -0.012, z: 0.112, segs: 8 })), S.steel3);

    // --- the rear sight: its base on the receiver's back, two ears, the drum between them and its four holes
    const DZ = -0.08;
    K.add(M.metal, cbox(-0.012, TY - 0.001, DZ - 0.02, 0.012, TY + 0.005, DZ + 0.018, 0.0015), S.steel2);
    for (const s of [1, -1]) K.add(M.metal, plate(rounded([[DZ - 0.018, TY + 0.004], [DZ + 0.016, TY + 0.004], [DZ + 0.012, TY + 0.018], [DZ + 0.004, TY + 0.022], [DZ - 0.012, TY + 0.018]], 0.003, 2), s * 0.0094, s * 0.0124, { bevel: 0.001 }), S.steel2);
    K.add(M.metal, lathe([[TY + 0.004, 0.0], [TY + 0.004, 0.0088], [TY + 0.026, 0.0088], [TY + 0.028, 0.0074], [TY + 0.028, 0.0]], { axis: 'y', z: DZ, segs: 14 }), S.steel3);
    for (const z of [DZ - 0.0093, DZ + 0.0087]) K.add(M.matte, lathe([[z, 0.0], [z, 0.0026], [z + 0.0006, 0.0026], [z + 0.0006, 0.0]], { y: HY, segs: 8 }), S.black);
    screw(K, M.metal, 0.0124, TY + 0.009, DZ - 0.01, 0.0024, S.bright, { both: true });

    // --- the cocking tube over the barrel: its slot on the left, the handle folded out at its front
    K.add(M.metal, lathe([[0.128, 0.0], [0.128, CR], [0.318, CR], [0.318, 0.0]], { y: CY, segs: 14 }), S.steel);
    K.add(M.matte, plate([[0.17, CY - 0.0028], [0.3, CY - 0.0028], [0.3, CY + 0.0028], [0.17, CY + 0.0028]], CR - 0.0014, CR + 0.0008, { bevel: 0.0004, r: 0.002 }), S.black);
    K.add(M.matte, plate([[0.17, CY], [0.177, CY], [0.177, CY + 0.008], [0.17, CY + 0.008]], CR - 0.0022, CR - 0.0002, { bevel: 0.0004 }), S.black);
    K.add(M.metal, rod([CR - 0.002, CY + 0.001, 0.29], [CR + 0.024, CY + 0.012, 0.302], 0.0034, 0.0028, 8), S.steel2);
    K.add(M.metal, lathe([[CR + 0.02, 0.0], [CR + 0.02, 0.0036], [CR + 0.023, 0.0048], [CR + 0.032, 0.0048], [CR + 0.034, 0.0034], [CR + 0.034, 0.0]], { axis: 'x', y: CY + 0.012, z: 0.302, segs: 10 }), S.polymer);

    // --- the front sight at the tube's end: the block that joins tube and barrel, the hood, the post in it
    const FZ = 0.318;
    K.add(M.metal, plate(rounded([[FZ - 0.006, BY - 0.019], [FZ + 0.028, BY - 0.019], [FZ + 0.028, CY + 0.012], [FZ + 0.02, CY + 0.017], [FZ + 0.002, CY + 0.017], [FZ - 0.006, CY + 0.012]], 0.004, 3), -0.0125, 0.0125, { bevel: 0.003 }), S.steel2);
    K.add(M.metal, lathe([[FZ + 0.0, 0.0094], [FZ + 0.0, 0.0118], [FZ + 0.026, 0.0118], [FZ + 0.026, 0.0094], [FZ + 0.0, 0.0094]], { y: HY, segs: 16 }), S.steel2);
    K.add(M.metal, cbox(-0.0016, CY + 0.016, FZ + 0.011, 0.0016, HY + 0.003, FZ + 0.015, 0.0006), S.steel3);
    screw(K, M.metal, 0.0125, BY, FZ + 0.011, 0.003, S.bright, { both: true });

    // --- the slim fore-end: polymer round the barrel up to the tube, flared at its mouth, fluted along its sides
    K.add(M.matte, lathe([[0.132, 0.0], [0.132, 0.0185], [0.138, 0.0205], [0.27, 0.0205], [0.28, 0.0238], [0.288, 0.0238], [0.29, 0.021], [0.29, 0.0]], { y: BY, segs: 18 }), S.polymer);
    for (const s of [1, -1]) for (const dy of [-0.0095, 0.0, 0.0095]) {
      const x = Math.sqrt(0.0205 * 0.0205 - dy * dy);
      K.add(M.matte, cbox(s * (x - 0.0009), BY + dy - 0.0016, 0.152, s * (x + 0.0005), BY + dy + 0.0016, 0.26, 0.0004), S.black);
    }

    // --- the barrel: a fat marker - its dark body out of the receiver under the tube, the ribbed ring it screws into
    // the sight's block by, the blue label, the shoulder, the cone that holds the nib, the chisel of felt
    const RZ = FZ + 0.028;
    K.add(M.paint, lathe([[0.13, 0.0], [0.13, 0.0135], [RZ, 0.0135], [RZ, 0.0]], { y: BY, segs: 16 }), dark);
    K.add(M.matte, lathe([[RZ, 0.0], [RZ, 0.0152], [RZ + 0.022, 0.0152], [RZ + 0.022, 0.0]], { y: BY, segs: 16 }), S.alu);
    for (let i = 0; i < 5; i++) K.add(M.matte, lathe([[RZ + 0.002 + i * 0.0042, 0.0152], [RZ + 0.0028 + i * 0.0042, 0.0165], [RZ + 0.0036 + i * 0.0042, 0.0165], [RZ + 0.0044 + i * 0.0042, 0.0152]], { y: BY, segs: 16 }), S.alu);
    K.add(M.paint, lathe([[RZ + 0.022, 0.0], [RZ + 0.022, 0.0148], [RZ + 0.058, 0.0148], [RZ + 0.064, 0.0118], [RZ + 0.064, 0.0]], { y: BY, segs: 16 }), dark);
    K.add(M.paint, lathe([[RZ + 0.026, 0.0151], [RZ + 0.054, 0.0151]], { y: BY, segs: 16 }), blue);
    for (const z of [RZ + 0.0245, RZ + 0.054]) K.add(M.matte, lathe([[z, 0.0152], [z + 0.0015, 0.0152]], { y: BY, segs: 16 }), S.label);
    K.add(M.matte, lathe([[RZ + 0.064, 0.0118], [RZ + 0.066, 0.0118], [RZ + 0.076, 0.0058], [RZ + 0.076, 0.0]], { y: BY, segs: 14 }), dark);
    K.add(M.matte, plate([[RZ + 0.071, BY - 0.0056], [RZ + 0.09, BY - 0.0056], [RZ + 0.08, BY + 0.0056], [RZ + 0.071, BY + 0.0056]], -0.0036, 0.0036, { bevel: 0.0009 }), blue);

    // --- the trigger group: one polymer moulding - its housing under the receiver, the grip, the big guard; its pins,
    // the selector on the left and its marks
    K.add(M.matte, plate(rounded([[-0.108, 0.0085], [0.074, 0.0085], [0.074, -0.002], [0.066, -0.01], [-0.1, -0.01], [-0.108, -0.002]], 0.004, 3), -0.0148, 0.0148, { bevel: 0.003 }), S.polymer);
    const grip = rounded([[-0.054, 0.0], [-0.008, 0.0], [-0.03, -0.106], [-0.08, -0.11], [-0.092, -0.094]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.0145, 0.0145, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const s of [1, -1]) {
      for (let i = 0; i < 7; i++) K.add(M.matte, plate([[-0.07 - i * 0.002, -0.02 - i * 0.012], [-0.034 - i * 0.004, -0.02 - i * 0.012], [-0.035 - i * 0.004, -0.024 - i * 0.012], [-0.071 - i * 0.002, -0.024 - i * 0.012]], s * 0.0143, s * 0.0154, { bevel: 0.0005 }), S.steel);
      for (const z of [-0.098, 0.062]) screw(K, M.metal, s * 0.0148, 0.0, z, 0.0032, S.bright);
    }
    triggerGuard(K, M, -0.004, 0.07, -0.008, 0.046, S.polymer, { hw: 0.0085, t: 0.008 });
    K.add(M.metal, lathe([[0.0148, 0.0], [0.0148, 0.0052], [0.0178, 0.0052], [0.0178, 0.0]], { axis: 'x', y: -0.001, z: -0.03, segs: 10 }), S.steel);
    K.add(M.metal, plate(rounded([[-0.034, -0.0045], [-0.026, -0.0045], [-0.006, 0.0005], [-0.006, 0.0045], [-0.03, 0.003]], 0.002, 2), 0.0168, 0.0196, { bevel: 0.001 }), S.steel);
    for (const [z, y, c] of [[-0.046, 0.002, S.white], [-0.008, 0.005, S.red], [-0.012, -0.005, S.red]]) K.add(M.matte, lathe([[0.0148, 0.0], [0.0148, 0.0017], [0.0152, 0.0017], [0.0152, 0.0]], { axis: 'x', y, z, segs: 6 }), c);

    // --- the magazine: thirty rounds in a curve, leaning forward out of its well; a rib pressed down each side, the
    // floor plate
    const mf = [];
    const mb = [];
    const rib = [[], []];
    for (let i = 0; i <= 7; i++) {
      const t = i / 7;
      const zc = 0.104 + 0.022 * t + 0.026 * t * t;
      const y = -0.006 - 0.16 * t;
      const dz = 0.022 + 0.052 * t;
      const l = Math.hypot(dz, 0.16);
      const nz = 0.16 / l;
      const ny = dz / l;
      mf.push([zc + nz * 0.0175, y + ny * 0.0175]);
      mb.unshift([zc - nz * 0.0165, y - ny * 0.0165]);
      if (i && i < 7) {
        rib[0].push([zc + nz * 0.004, y + ny * 0.004]);
        rib[1].unshift([zc - nz * 0.0015, y - ny * 0.0015]);
      }
    }
    K.add(M.metal, plate(rounded([...mf, ...mb], 0.003, 2), -0.0122, 0.0122, { bevel: 0.0025 }), S.steel);
    K.add(M.metal, plate([...rib[0], ...rib[1]], -0.0134, 0.0134, { bevel: 0.0008 }), S.steel2);
    const [fz, fy] = mf[7];
    const [bz, by] = mb[0];
    const ux = (fz - bz) / Math.hypot(fz - bz, fy - by);
    const uy = (fy - by) / Math.hypot(fz - bz, fy - by);
    K.add(M.metal, plate(rounded([[bz - ux * 0.003 + uy * 0.004, by - uy * 0.003 - ux * 0.004], [fz + ux * 0.003 + uy * 0.004, fy + uy * 0.003 - ux * 0.004], [fz + ux * 0.003 - uy * 0.006, fy + uy * 0.003 + ux * 0.006], [bz - ux * 0.003 - uy * 0.006, by - uy * 0.003 + ux * 0.006]], 0.002, 2), -0.014, 0.014, { bevel: 0.002 }), S.steel2);

    // --- the stock, pulled out: two steel struts out of their sleeves, the butt's frame where they meet, its rubber pad
    const SZ = -0.234;
    for (const s of [1, -1]) K.add(M.metal, rod([s * (W + 0.0029), 0.027, -0.03], [s * (W + 0.0029), 0.027, SZ], 0.0032, 0.0032, 8), S.steel2);
    K.add(M.metal, plate(rounded([[SZ - 0.012, -0.056], [SZ + 0.002, -0.05], [SZ + 0.006, 0.036], [SZ - 0.002, 0.062], [SZ - 0.012, 0.066]], 0.006, 3), -0.0232, 0.0232, { bevel: 0.003 }), S.steel2);
    for (const s of [1, -1]) K.add(M.metal, cbox(s * 0.0168, 0.02, SZ - 0.002, s * 0.0242, 0.034, SZ + 0.014, 0.002), S.steel2);
    K.add(M.round, plate(rounded([[SZ - 0.026, -0.062], [SZ - 0.012, -0.058], [SZ - 0.012, 0.068], [SZ - 0.024, 0.066], [SZ - 0.029, 0.002]], 0.008, 3), -0.0244, 0.0244, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const y of [-0.04, -0.02, 0.0, 0.02, 0.04]) K.add(M.matte, cbox(-0.019, y - 0.0015, SZ - 0.0295, 0.019, y + 0.0015, SZ - 0.027, 0.0004), S.steel);
    return { muzzle: new THREE.Vector3(0, BY - 0.004, RZ + 0.09), length: 0.7, hold: new THREE.Vector3(0, BY - 0.0205, 0.215), eject: new THREE.Vector3(-W - 0.002, 0.04, 0.052) };
  },

  // ---------------------------------------------------------------------------------------------- the paint gun
  // A painter's spray gun made a pistol: a forged body anodised teal, a chromed air cap with its two horns round the
  // fluid tip, a glass cup of paint fed by gravity on top, the fluid and fan knobs at the back, a long steel trigger,
  // a hose fitting under the grip.
  paint(K, M) {
    const S = INK;
    const NY = 0.05; // the nozzle
    // --- the grip, and the fitting under it
    const grip = rounded([[-0.052, 0.006], [-0.002, 0.006], [-0.022, -0.106], [-0.074, -0.11], [-0.084, -0.094]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.0145, 0.0145, { bevel: 0.006, bs: 2 }), S.plum);
    for (let i = 0; i < 4; i++) K.add(M.matte, cbox(-0.0152, -0.03 - i * 0.02, -0.02 - i * 0.004, 0.0152, -0.022 - i * 0.02, -0.004 - i * 0.004, 0.003), S.plum);
    for (const s of [1, -1]) for (let i = 0; i < 6; i++) K.add(M.matte, plate([[-0.066, -0.024 - i * 0.013], [-0.03, -0.024 - i * 0.013], [-0.032, -0.028 - i * 0.013], [-0.068, -0.028 - i * 0.013]], s * 0.0142, s * 0.0152, { bevel: 0.0004 }), S.polymer);
    K.add(M.metal, lathe([[-0.14, 0.0], [-0.14, 0.006], [-0.132, 0.0075], [-0.124, 0.0075], [-0.12, 0.0105], [-0.11, 0.0105], [-0.108, 0.0]], { axis: 'y', z: -0.05, segs: 6 }), S.brass);
    // --- the body, forged in one: over the hand, out to the head
    const body = rounded([[-0.082, 0.002], [0.05, 0.002], [0.1, 0.02], [0.196, 0.024], [0.196, 0.076], [0.09, 0.082], [-0.05, 0.076], [-0.086, 0.05]], 0.012, 4);
    K.add(M.paint, plate(body, -0.019, 0.019, { bevel: 0.007, bs: 2 }), S.teal);
    for (const s of [1, -1]) {
      K.add(M.paint, plate(rounded([[-0.04, 0.02], [0.08, 0.026], [0.16, 0.036], [0.16, 0.064], [0.06, 0.066], [-0.04, 0.058]], 0.008, 3), s * 0.019, s * 0.0206, { bevel: 0.001 }), S.teal2);
      screw(K, M.metal, s * 0.0206, 0.03, 0.062, 0.0046, S.chrome);
      screw(K, M.metal, s * 0.0206, 0.046, -0.02, 0.003, S.chrome);
    }
    // (the hook it hangs by)
    K.add(M.metal, pipe([[0, 0.076, -0.03], [0, 0.098, -0.04], [0, 0.104, -0.062], [0, 0.09, -0.074]], 0.0036, { steps: 14, tension: 0.3 }), S.teal2);
    // --- the head: the ring that holds the cap, knurled; the cap and its horns; the fluid tip and the needle
    K.add(M.metal, lathe([[0.196, 0.0], [0.196, 0.0235], [0.214, 0.0235], [0.218, 0.021], [0.232, 0.019], [0.236, 0.015], [0.236, 0.0]], { y: NY, segs: 18 }), S.chrome);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      K.add(M.metal, rod([Math.cos(a) * 0.0238, NY + Math.sin(a) * 0.0238, 0.199], [Math.cos(a) * 0.0238, NY + Math.sin(a) * 0.0238, 0.212], 0.0016, 0.0016, 4), S.steel3);
    }
    for (const s of [1, -1]) K.add(M.metal, plate(rounded([[0.23, NY + s * 0.011], [0.252, NY + s * 0.013], [0.254, NY + s * 0.019], [0.23, NY + s * 0.02]], 0.002, 2), -0.0045, 0.0045, { bevel: 0.0014 }), S.chrome);
    K.add(M.metal, lathe([[0.236, 0.0072], [0.246, 0.0042], [0.246, 0.0016], [0.238, 0.0016]], { y: NY, segs: 10 }), S.brass);
    K.add(M.glow, lathe([[0.2365, 0.0125], [0.2365, 0.0082]], { y: NY, segs: 14 }), S.paintPink);
    // --- the cup: its neck screwed into the body, the glass, the paint in it, the lid and its breather
    const CZ = 0.085;
    K.add(M.metal, lathe([[0.078, 0.0], [0.078, 0.0135], [0.094, 0.0135], [0.098, 0.017], [0.106, 0.017], [0.106, 0.0]], { axis: 'y', z: CZ, segs: 12 }), S.chrome);
    // (the glass is seen through: the paint in it colours it to its level, a dark line where it stops, clear above)
    K.add(M.glass, lathe([[0.106, 0.015], [0.126, 0.043], [0.168, 0.0464]], { axis: 'y', z: CZ, segs: 18 }), S.paintPink);
    K.add(M.matte, lathe([[0.168, 0.0468], [0.171, 0.047]], { axis: 'y', z: CZ, segs: 18 }), S.red);
    K.add(M.glass, lathe([[0.171, 0.0466], [0.2, 0.049], [0.206, 0.046]], { axis: 'y', z: CZ, segs: 18 }), S.glassc);
    for (const yy of [0.13, 0.15, 0.19]) K.add(M.matte, cbox(-0.012, yy, CZ + 0.0462 + (yy - 0.13) * 0.04, 0.0, yy + 0.0012, CZ + 0.0478 + (yy - 0.13) * 0.04, 0.0003), S.label);
    K.add(M.paint, lathe([[0.204, 0.0], [0.204, 0.051], [0.214, 0.051], [0.218, 0.046], [0.218, 0.0]], { axis: 'y', z: CZ, segs: 18 }), S.teal2);
    K.add(M.metal, lathe([[0.218, 0.0], [0.218, 0.006], [0.226, 0.006], [0.226, 0.0]], { axis: 'y', z: CZ, segs: 8 }), S.chrome);
    // --- the back: the fluid knob on the needle's line, the fan knob over it
    K.add(M.metal, lathe([[-0.118, 0.0], [-0.118, 0.0105], [-0.096, 0.0105], [-0.092, 0.0075], [-0.084, 0.0075]], { y: NY - 0.004, segs: 12 }), S.chrome);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      K.add(M.metal, rod([Math.cos(a) * 0.0108, NY - 0.004 + Math.sin(a) * 0.0108, -0.116], [Math.cos(a) * 0.0108, NY - 0.004 + Math.sin(a) * 0.0108, -0.098], 0.0013, 0.0013, 4), S.steel3);
    }
    K.add(M.metal, mirrored(lathe([[0.019, 0.0], [0.019, 0.0068], [0.032, 0.0068], [0.034, 0.005], [0.034, 0.0]], { axis: 'x', y: 0.066, z: -0.04, segs: 10 })), S.chrome);
    // --- the trigger: a long pressed lever on its pin, the needle's stem behind it
    K.add(M.metal, plate(rounded([[0.062, 0.034], [0.078, 0.034], [0.07, -0.02], [0.058, -0.07], [0.046, -0.068], [0.056, -0.02]], 0.004, 3), -0.0065, 0.0065, { bevel: 0.002 }), S.bright);
    screw(K, M.metal, 0.0206, 0.03, 0.07, 0.0035, S.steel3, { both: true });
    K.add(M.metal, rod([0, 0.026, 0.02], [0, 0.026, 0.06], 0.0024, 0.0024, 6), S.bright);
    return { muzzle: new THREE.Vector3(0, NY, 0.25), length: 0.38 };
  },

  // ---------------------------------------------------------------------------------------------- the crayon shotgun
  // A side-by-side as a gunmaker makes one: two blued barrels and the rib between them, a case-coloured action with its
  // top lever and two triggers, a walnut stock and forend cut with chequering - and wax crayons for its shells, two
  // in its mouths and four in the loops on its butt.
  shotgun(K, M) {
    const S = INK;
    const BY = 0.034;
    const BX = 0.0128;
    // --- the stock and its forend
    const stock = rounded([[-0.4, 0.034], [-0.22, 0.04], [-0.12, 0.024], [-0.04, 0.012], [-0.012, 0.012], [-0.012, -0.03], [-0.03, -0.104], [-0.082, -0.11], [-0.1, -0.054], [-0.4, -0.1]], 0.012, 4);
    K.add(M.matte, plate(stock, -0.022, 0.022, { bevel: 0.009, bs: 2 }), S.walnut);
    for (const s of [1, -1]) {
      for (const [z0, z1, y] of [[-0.38, -0.2, 0.012], [-0.36, -0.15, -0.02], [-0.39, -0.22, -0.05], [-0.3, -0.14, -0.07]]) K.add(M.matte, plate([[z0, y], [z1, y + 0.002], [z1, y + 0.0046], [z0, y + 0.003]], s * 0.0215, s * 0.0226, { bevel: 0.0004 }), S.walnut2);
      K.add(M.matte, plate(rounded([[-0.082, -0.03], [-0.022, -0.03], [-0.038, -0.098], [-0.076, -0.102]], 0.008, 3), s * 0.021, s * 0.0232, { bevel: 0.001 }), S.walnut2);
      for (let i = 0; i < 6; i++) K.add(M.matte, plate([[-0.076 + i * 0.002, -0.04 - i * 0.0105], [-0.032 - i * 0.002, -0.04 - i * 0.0105], [-0.033 - i * 0.002, -0.043 - i * 0.0105], [-0.077 + i * 0.002, -0.043 - i * 0.0105]], s * 0.0232, s * 0.0238, { bevel: 0.0003 }), S.walnut);
    }
    pencilButt(K, M, -0.4, -0.1, 0.034, 0.022);
    const fore = rounded([[0.16, -0.016], [0.38, -0.006], [0.392, 0.004], [0.39, 0.024], [0.16, 0.024]], 0.008, 3);
    K.add(M.matte, plate(fore, -0.03, 0.03, { bevel: 0.012, bs: 2 }), S.walnut);
    for (const s of [1, -1]) {
      K.add(M.matte, plate(rounded([[0.18, -0.008], [0.37, 0.0], [0.37, 0.016], [0.18, 0.016]], 0.005, 3), s * 0.029, s * 0.0312, { bevel: 0.001 }), S.walnut2);
      for (let i = 0; i < 9; i++) K.add(M.matte, plate([[0.19 + i * 0.02, -0.004], [0.194 + i * 0.02, -0.004], [0.204 + i * 0.02, 0.013], [0.2 + i * 0.02, 0.013]], s * 0.0312, s * 0.0318, { bevel: 0.0003 }), S.walnut);
    }
    K.add(M.metal, cbox(-0.006, -0.014, 0.39, 0.006, 0.004, 0.402, 0.002), S.steel3);
    // --- the action: its body, the fences behind the barrels, the side plates and their pins, the lever, the safety
    const act = rounded([[-0.03, -0.032], [0.15, -0.026], [0.16, -0.012], [0.16, 0.05], [0.13, 0.058], [0.02, 0.04], [-0.03, 0.014]], 0.008, 3);
    K.add(M.metal, plate(act, -0.027, 0.027, { bevel: 0.006, bs: 2 }), S.steel3);
    for (const s of [1, -1]) {
      K.add(M.metal, lathe([[0.1, 0.0], [0.1, 0.0175], [0.118, 0.0195], [0.16, 0.0185]], { x: s * BX, y: BY, segs: 12 }), S.steel3);
      K.add(M.metal, plate(rounded([[-0.02, -0.022], [0.12, -0.018], [0.13, 0.03], [0.03, 0.03], [-0.02, 0.008]], 0.008, 3), s * 0.027, s * 0.0288, { bevel: 0.001 }), S.steel2);
      for (const [z, y] of [[0.0, -0.01], [0.06, 0.016], [0.108, -0.006]]) screw(K, M.metal, s * 0.0288, y, z, 0.0036, S.bright);
      // (a scroll cut into it: three curls)
      for (const [z, y] of [[0.03, 0.002], [0.074, -0.004], [0.092, 0.016]]) K.add(M.matte, pipe([[s * 0.0292, y, z], [s * 0.0292, y + 0.008, z + 0.006], [s * 0.0292, y + 0.004, z + 0.014], [s * 0.0292, y - 0.003, z + 0.01]], 0.0008, { steps: 10, segs: 4 }), S.steel);
    }
    K.add(M.metal, plate(rounded([[0.0, 0.03], [0.06, 0.048], [0.058, 0.054], [-0.006, 0.036]], 0.002, 2), -0.005, 0.005, { bevel: 0.0015 }), S.bright);
    K.add(M.metal, lathe([[0.052, 0.0], [0.052, 0.007], [0.058, 0.007], [0.058, 0.0]], { axis: 'y', z: 0.058, segs: 10 }), S.bright);
    K.add(M.metal, cbox(-0.004, 0.016, -0.028, 0.004, 0.022, -0.012, 0.0015), S.red);
    triggerGuard(K, M, 0.0, 0.1, -0.03, 0.044, S.steel2, { blades: [0.034, 0.058] });
    // --- the barrels: two tubes and their bores, the rib, the bead; a band of engraving at the breech
    for (const s of [1, -1]) {
      K.add(M.metal, lathe([[0.16, 0.0], [0.16, 0.0128], [0.74, 0.0122], [0.74, 0.0102], [0.7, 0.0102]], { x: s * BX, y: BY, segs: 14 }), S.steel);
      K.add(M.metal, lathe([[0.164, 0.0134], [0.176, 0.0134]], { x: s * BX, y: BY, segs: 14 }), S.bright);
    }
    K.add(M.metal, cbox(-0.0045, BY + 0.0085, 0.16, 0.0045, BY + 0.0145, 0.738, 0.001), S.steel2);
    K.add(M.metal, cbox(-0.0035, BY - 0.0135, 0.2, 0.0035, BY - 0.009, 0.738, 0.001), S.steel2);
    for (let i = 0; i < 26; i++) K.add(M.matte, cbox(-0.0046, BY + 0.0146, 0.176 + i * 0.021, 0.0046, BY + 0.0151, 0.184 + i * 0.021, 0.0002), S.steel);
    K.add(M.metal, lathe([[BY + 0.0145, 0.0], [BY + 0.0145, 0.0026], [BY + 0.02, 0.0032], [BY + 0.023, 0.0]], { axis: 'y', z: 0.728, segs: 8 }), S.brass);
    // --- its shells: a crayon in each mouth, paper round it, and four more in the loops on the butt
    [S.crayons[0], S.crayons[1]].forEach((c, i) => {
      const x = (i ? 1 : -1) * BX;
      K.add(M.paint, lathe([[0.71, 0.0096], [0.752, 0.0096], [0.768, 0.0042], [0.768, 0.0]], { x, y: BY, segs: 10 }), c);
      K.add(M.matte, lathe([[0.712, 0.01], [0.74, 0.01]], { x, y: BY, segs: 10 }), S.paper);
    });
    K.add(M.matte, cbox(-0.0305, -0.066, -0.33, -0.022, -0.02, -0.2, 0.002), S.polymer);
    S.crayons.forEach((c, i) => {
      const z = -0.312 + i * 0.03;
      K.add(M.matte, cbox(-0.044, -0.058, z - 0.012, -0.03, -0.03, z + 0.012, 0.003), S.polymer);
      K.add(M.paint, lathe([[-0.084, 0.0], [-0.084, 0.0092], [0.0, 0.0092], [0.016, 0.004], [0.016, 0.0]], { axis: 'y', x: -0.0372, z, segs: 10 }), c);
      K.add(M.matte, lathe([[-0.08, 0.0096], [-0.012, 0.0096]], { axis: 'y', x: -0.0372, z, segs: 10 }), S.paper);
      K.add(M.metal, lathe([[-0.09, 0.0], [-0.09, 0.0102], [-0.084, 0.0102]], { axis: 'y', x: -0.0372, z, segs: 10 }), S.brass);
    });
    return { muzzle: new THREE.Vector3(0, BY, 0.77), length: 1.24, hold: new THREE.Vector3(0, -0.016, 0.28) };
  },

  // ---------------------------------------------------------------------------------------------- the eraser bazooka
  // A shoulder launcher as they are made: a steel tube banded at its joints, a blast cone at its back and a bell at
  // its mouth, a wooden shield round it where it lies on the shoulder, a trigger group and a second grip under it, an
  // optical sight on a bracket at its left and a folding leaf on top - and its rocket a two-colour school eraser in
  // its paper sleeve, standing out of the mouth.
  bazooka(K, M) {
    const S = INK;
    const TY = 0.1; // the tube
    const R = 0.058;
    // --- the tube, its bore, the cone at the back, the bell at the mouth
    K.add(M.paint, lathe([[-0.66, 0.062], [-0.66, 0.092], [-0.64, 0.094], [-0.52, R + 0.004], [-0.5, R], [0.5, R], [0.52, R + 0.004], [0.58, 0.076], [0.588, 0.074], [0.588, 0.066], [0.5, 0.052], [-0.5, 0.052], [-0.66, 0.062]], { y: TY, segs: 20 }), S.olive);
    K.add(M.matte, lathe([[-0.52, 0.052], [-0.52, 0.0]], { y: TY, segs: 16 }), S.black);
    for (const z of [-0.5, -0.06, 0.12, 0.44]) {
      K.add(M.metal, lathe([[z, R + 0.001], [z, R + 0.005], [z + 0.022, R + 0.005], [z + 0.022, R + 0.001]], { y: TY, segs: 20 }), S.steel2);
      for (const s of [1, -1]) screw(K, M.metal, s * (R + 0.005), TY, z + 0.011, 0.0044, S.bright);
    }
    for (const z of [-0.44, 0.34]) K.add(M.paint, lathe([[z, R + 0.0008], [z + 0.03, R + 0.0008]], { y: TY, segs: 20 }), S.yellow);
    K.add(M.matte, cbox(-0.03, TY + R - 0.004, 0.19, 0.03, TY + R + 0.0012, 0.3, 0.0006), S.label);
    for (let i = 0; i < 3; i++) K.add(M.matte, cbox(-0.022, TY + R + 0.0012, 0.2 + i * 0.03, 0.022, TY + R + 0.0018, 0.212 + i * 0.03, 0.0002), S.lead);
    // --- the shield of wood where it lies on the shoulder, grooved, two straps of steel round it
    K.add(M.matte, lathe([[-0.4, R + 0.002], [-0.396, R + 0.013], [-0.1, R + 0.013], [-0.096, R + 0.002]], { y: TY, segs: 20 }), S.cedar);
    for (let i = 0; i < 9; i++) K.add(M.matte, lathe([[-0.38 + i * 0.032, R + 0.0134], [-0.374 + i * 0.032, R + 0.0134]], { y: TY, segs: 20 }), S.cedar2);
    for (const z of [-0.39, -0.12]) K.add(M.metal, lathe([[z, R + 0.014], [z, R + 0.016], [z + 0.012, R + 0.016], [z + 0.012, R + 0.014]], { y: TY, segs: 20 }), S.steel3);
    // --- under it: the trigger group on its lugs, the grip, the hammer's spur; and the second grip ahead
    K.add(M.metal, plate(rounded([[-0.07, 0.006], [0.1, 0.006], [0.1, TY - R + 0.006], [-0.07, TY - R + 0.006]], 0.006, 3), -0.017, 0.017, { bevel: 0.004 }), S.steel2);
    const grip = rounded([[-0.052, 0.008], [-0.004, 0.008], [-0.028, -0.112], [-0.082, -0.114], [-0.09, -0.1]], 0.012, 4);
    K.add(M.metal, plate(grip, -0.011, 0.011, { bevel: 0.003 }), S.steel);
    for (const s of [1, -1]) {
      K.add(M.matte, plate(rounded([[-0.05, 0.0], [-0.01, 0.0], [-0.032, -0.106], [-0.078, -0.108], [-0.084, -0.096]], 0.012, 4), s * 0.011, s * 0.02, { bevel: 0.005 }), S.cedar);
      for (let i = 0; i < 7; i++) K.add(M.matte, plate([[-0.05 - i * 0.004, -0.02 - i * 0.012], [-0.016 - i * 0.004, -0.02 - i * 0.012], [-0.017 - i * 0.004, -0.024 - i * 0.012], [-0.051 - i * 0.004, -0.024 - i * 0.012]], s * 0.02, s * 0.0214, { bevel: 0.0005 }), S.cedar2);
      screw(K, M.metal, s * 0.02, -0.056, -0.048, 0.0046, S.bright, { h: 0.002 });
      screw(K, M.metal, s * 0.017, 0.024, -0.05, 0.004, S.bright);
      screw(K, M.metal, s * 0.017, 0.024, 0.08, 0.004, S.bright);
    }
    triggerGuard(K, M, 0.0, 0.088, 0.008, 0.046, S.steel2);
    K.add(M.metal, plate(rounded([[-0.08, 0.03], [-0.066, 0.03], [-0.07, 0.056], [-0.094, 0.064], [-0.096, 0.056]], 0.003, 2), -0.005, 0.005, { bevel: 0.0015 }), S.bright);
    const FZ = 0.26;
    K.add(M.metal, cbox(-0.015, TY - R - 0.014, FZ - 0.03, 0.015, TY - R + 0.004, FZ + 0.03, 0.004), S.steel2);
    K.add(M.matte, lathe([[TY - R - 0.13, 0.0], [TY - R - 0.13, 0.016], [TY - R - 0.122, 0.0185], [TY - R - 0.04, 0.016], [TY - R - 0.02, 0.0185], [TY - R - 0.014, 0.014]], { axis: 'y', z: FZ, segs: 12 }), S.cedar);
    for (let i = 0; i < 5; i++) K.add(M.matte, lathe([[TY - R - 0.112 + i * 0.016, 0.0182], [TY - R - 0.106 + i * 0.016, 0.0182]], { axis: 'y', z: FZ, segs: 12 }), S.cedar2);
    // --- its sights: the optic on its bracket at the left, its eyecup and glass; the leaf and the post on top
    const OX = R + 0.03;
    const OY = TY + 0.052;
    K.add(M.metal, cbox(R - 0.006, TY + 0.006, 0.0, R + 0.014, TY + 0.03, 0.09, 0.003), S.steel2);
    K.add(M.metal, cbox(OX - 0.02, OY - 0.028, -0.006, OX + 0.02, OY + 0.026, 0.1, 0.006), S.steel);
    K.add(M.metal, lathe([[0.1, 0.0], [0.1, 0.017], [0.13, 0.019], [0.134, 0.017], [0.134, 0.0]], { x: OX, y: OY, segs: 14 }), S.steel);
    K.add(M.glass, lathe([[0.1345, 0.0165], [0.1345, 0.0]], { x: OX, y: OY, segs: 14 }), S.lens);
    K.add(M.matte, lathe([[-0.07, 0.019], [-0.064, 0.021], [-0.03, 0.017], [-0.006, 0.014], [-0.006, 0.0]], { x: OX, y: OY - 0.004, segs: 14 }), S.polymer);
    K.add(M.metal, lathe([[OY + 0.026, 0.0], [OY + 0.026, 0.009], [OY + 0.038, 0.009], [OY + 0.04, 0.007], [OY + 0.04, 0.0]], { axis: 'y', x: OX, z: 0.05, segs: 10 }), S.steel3);
    for (const z of [0.012, 0.078]) screw(K, M.metal, OX + 0.02, OY, z, 0.004, S.bright);
    K.add(M.metal, plate([[0.38, TY + R + 0.004], [0.41, TY + R + 0.004], [0.404, TY + R + 0.05], [0.398, TY + R + 0.056], [0.392, TY + R + 0.05]], -0.004, 0.004, { bevel: 0.0012 }), S.steel2);
    K.add(M.metal, plate([[-0.04, TY + R + 0.012], [-0.01, TY + R + 0.012], [-0.012, TY + R + 0.046], [-0.038, TY + R + 0.046]], -0.011, 0.011, { bevel: 0.0012, holes: [[[-0.03, TY + R + 0.022], [-0.02, TY + R + 0.022], [-0.02, TY + R + 0.04], [-0.03, TY + R + 0.04]]] }), S.steel2);
    // --- the rocket: a school eraser, pink and blue, in its paper sleeve
    K.add(M.round, cbox(-0.041, TY - 0.031, 0.46, 0.041, TY + 0.031, 0.7, 0.008), S.eraser);
    K.add(M.round, cbox(-0.041, TY - 0.031, 0.7, 0.041, TY + 0.031, 0.8, 0.008), S.blueRubber);
    K.add(M.matte, cbox(-0.0425, TY - 0.0325, 0.6, 0.0425, TY + 0.0325, 0.72, 0.004), S.paper);
    for (const s of [1, -1]) {
      K.add(M.matte, cbox(s * 0.0425 - 0.0004, TY - 0.014, 0.62, s * 0.0425 + 0.0004, TY + 0.014, 0.7, 0.0002), S.tin);
      K.add(M.matte, cbox(s * 0.043 - 0.0004, TY - 0.005, 0.632, s * 0.043 + 0.0004, TY + 0.005, 0.688, 0.0002), S.paper);
    }
    // (it lies on the shoulder, beside the head)
    return { muzzle: new THREE.Vector3(0, TY, 0.8), length: 1.46, hold: new THREE.Vector3(0, TY - R - 0.07, FZ), reach: 0.4, side: 0.2 };
  },

  // ---------------------------------------------------------------------------------------------- the stapler pistol
  // A machine pistol whose slide is an office stapler's arm: pressed red steel, a rubber pad for the thumb, hinged on
  // a pin at the back; under it the bright channel the strip of staples runs in, and the anvil at its mouth. The rest
  // is a pistol as one is made - a polymer frame, a grip cut for the hand, a guard, sights.
  stapler(K, M) {
    const S = INK;
    // --- the frame and the grip
    K.add(M.matte, plate(rounded([[-0.066, 0.004], [0.2, 0.004], [0.204, 0.01], [0.204, 0.024], [-0.066, 0.024]], 0.004, 2), -0.0135, 0.0135, { bevel: 0.003 }), S.polymer);
    slots(K, M.matte, 3, 0.11, 0.19, 0.008, 0.016, 0.0135, S.black, { fill: 0.5 });
    const grip = rounded([[-0.054, 0.006], [-0.004, 0.006], [-0.026, -0.108], [-0.078, -0.112], [-0.09, -0.096]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.0142, 0.0142, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const s of [1, -1]) {
      for (let i = 0; i < 7; i++) K.add(M.matte, plate([[-0.07 - i * 0.002, -0.02 - i * 0.012], [-0.03 - i * 0.004, -0.02 - i * 0.012], [-0.031 - i * 0.004, -0.024 - i * 0.012], [-0.071 - i * 0.002, -0.024 - i * 0.012]], s * 0.014, s * 0.0152, { bevel: 0.0005 }), S.steel);
      screw(K, M.metal, s * 0.0135, 0.014, -0.05, 0.003, S.bright);
      screw(K, M.metal, s * 0.0135, 0.014, 0.06, 0.003, S.bright);
    }
    K.add(M.metal, cbox(-0.013, -0.122, -0.092, 0.013, -0.111, -0.024, 0.003), S.steel3);
    K.add(M.metal, mirrored(lathe([[0.014, 0.0], [0.014, 0.0045], [0.018, 0.0045], [0.018, 0.0]], { axis: 'x', y: -0.01, z: -0.002, segs: 8 })), S.steel3);
    triggerGuard(K, M, 0.0, 0.086, 0.004, 0.042, S.polymer, { hw: 0.0075 });
    // --- the channel the staples run in, bright; the strip in it seen through the frame's window; the anvil
    K.add(M.metal, cbox(-0.0118, 0.022, -0.05, 0.0118, 0.03, 0.216, 0.0012), S.bright);
    K.add(M.metal, cbox(-0.0145, 0.0, 0.204, 0.0145, 0.026, 0.224, 0.003), S.steel3);
    K.add(M.matte, cbox(-0.009, 0.0222, 0.2242, 0.009, 0.0258, 0.2246, 0.0002), S.black);
    for (let i = 0; i < 22; i++) K.add(M.metal, cbox(-0.0122, 0.0245, 0.0 + i * 0.008, 0.0122, 0.029, 0.005 + i * 0.008, 0.0004), S.steel3);
    // --- the arm: pressed in one, rounded at its nose, its sides ribbed at the back; the pad; the pin it hinges on
    const arm = rounded([[-0.09, 0.032], [0.204, 0.032], [0.224, 0.042], [0.226, 0.058], [0.206, 0.07], [-0.05, 0.078], [-0.09, 0.066]], 0.01, 4);
    K.add(M.paint, plate(arm, -0.0165, 0.0165, { bevel: 0.007, bs: 2 }), S.staplerRed);
    ridges(K, M.paint, 6, -0.078, -0.03, 0.04, 0.066, 0.0165, S.red, { h: 0.0012, lean: 0.004 });
    K.add(M.matte, plate(rounded([[0.1, 0.072], [0.2, 0.068], [0.2, 0.074], [0.1, 0.078]], 0.002, 2), -0.012, 0.012, { bevel: 0.002 }), S.polymer);
    for (let i = 0; i < 6; i++) K.add(M.matte, cbox(-0.0122, 0.0752 - i * 0.0007, 0.108 + i * 0.015, 0.0122, 0.079 - i * 0.0007, 0.114 + i * 0.015, 0.001), S.steel);
    K.add(M.metal, lathe([[-0.019, 0.0], [-0.019, 0.0062], [0.019, 0.0062], [0.019, 0.0]], { axis: 'x', y: 0.05, z: -0.074, segs: 10 }), S.bright);
    K.add(M.matte, plate([[0.04, 0.044], [0.1, 0.044], [0.1, 0.058], [0.04, 0.058]], -0.0172, -0.0158, { bevel: 0.0004, r: 0.003 }), S.black);
    for (const s of [1, -1]) K.add(M.matte, plate(rounded([[0.12, 0.04], [0.19, 0.04], [0.19, 0.056], [0.12, 0.058]], 0.004, 3), s * 0.0165, s * 0.0172, { bevel: 0.0004 }), S.red);
    // --- the spring's rod out of its back; the sights
    K.add(M.metal, lathe([[-0.11, 0.0], [-0.11, 0.0052], [-0.104, 0.0064], [-0.09, 0.0064]], { y: 0.044, segs: 8 }), S.chrome);
    for (const s of [1, -1]) K.add(M.metal, cbox(s * 0.005, 0.074, -0.056, s * 0.011, 0.084, -0.044, 0.0012), S.steel);
    K.add(M.metal, plate([[0.196, 0.068], [0.214, 0.064], [0.21, 0.076], [0.2, 0.078]], -0.0026, 0.0026, { bevel: 0.0008 }), S.steel);
    return { muzzle: new THREE.Vector3(0, 0.024, 0.226), length: 0.34, eject: new THREE.Vector3(-0.018, 0.05, 0.07) };
  },

  // ---------------------------------------------------------------------------------------------- the police pen pistol
  // A service pistol whose barrel and slide are a fat ballpoint: a clear six-sided body with the blue of its ink
  // showing through, a ribbed blue grip-section and a steel cone to its ball, a cap with its clicker at the back and
  // a steel pocket clip along its top. Under it a duty frame: dark polymer, a badge let into the grip.
  pen(K, M) {
    const S = INK;
    const PY = 0.038;
    // --- the frame, the grip, the guard
    K.add(M.matte, plate(rounded([[-0.064, 0.002], [0.16, 0.002], [0.166, 0.008], [0.166, 0.016], [-0.064, 0.016]], 0.004, 2), -0.0125, 0.0125, { bevel: 0.003 }), S.navy);
    const grip = rounded([[-0.052, 0.004], [-0.004, 0.004], [-0.024, -0.102], [-0.074, -0.106], [-0.086, -0.09]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.0138, 0.0138, { bevel: 0.006, bs: 2 }), S.navy);
    for (const s of [1, -1]) {
      for (let i = 0; i < 5; i++) K.add(M.matte, plate([[-0.066 - i * 0.002, -0.05 - i * 0.011], [-0.03 - i * 0.004, -0.05 - i * 0.011], [-0.031 - i * 0.004, -0.054 - i * 0.011], [-0.067 - i * 0.002, -0.054 - i * 0.011]], s * 0.0136, s * 0.0147, { bevel: 0.0005 }), S.polymer);
      // (the badge let into it: a brass disc, a blue star on it)
      const badge = lathe([[0.0138, 0.0], [0.0138, 0.0092], [0.0152, 0.0092], [0.0158, 0.0072], [0.0158, 0.0]], { axis: 'x', y: -0.026, z: -0.036, segs: 12 });
      const star = lathe([[0.0158, 0.0], [0.0158, 0.0042], [0.0164, 0.0042], [0.0164, 0.0]], { axis: 'x', y: -0.026, z: -0.036, segs: 5 });
      K.add(M.metal, s > 0 ? badge : mirrored(badge), S.brass);
      K.add(M.metal, s > 0 ? star : mirrored(star), S.penBlue);
      screw(K, M.metal, s * 0.0125, 0.009, 0.1, 0.0028, S.bright);
    }
    K.add(M.metal, cbox(-0.0125, -0.115, -0.088, 0.0125, -0.105, -0.022, 0.003), S.steel3);
    triggerGuard(K, M, 0.0, 0.082, 0.002, 0.04, S.navy, { hw: 0.007 });
    // --- the pen: its clear body, the ink in it; the section, the cone, the ball
    K.add(M.glass, hexbar(-0.074, 0.2, 0.0245, 0.0245, { y: PY }), S.glassc);
    for (const s of [1, -1]) K.add(M.matte, cbox(s * 0.0212 - 0.0005, PY - 0.0052, -0.06, s * 0.0212 + 0.0005, PY + 0.0052, 0.185, 0.0003), S.penBlue);
    K.add(M.matte, cbox(-0.0052, PY + 0.0208, -0.06, 0.0052, PY + 0.0216, 0.185, 0.0003), S.penBlue);
    K.add(M.paint, lathe([[0.2, 0.0], [0.2, 0.0235], [0.206, 0.0215], [0.262, 0.0205], [0.266, 0.0185]], { y: PY, segs: 14 }), S.penBlue);
    for (let i = 0; i < 6; i++) K.add(M.paint, lathe([[0.212 + i * 0.008, 0.0222], [0.216 + i * 0.008, 0.0222]], { y: PY, segs: 14 }), S.navy);
    K.add(M.metal, lathe([[0.266, 0.0185], [0.27, 0.0175], [0.318, 0.0052], [0.324, 0.0052], [0.324, 0.0]], { y: PY, segs: 14 }), S.chrome);
    K.add(M.metal, lathe([[0.324, 0.0038], [0.331, 0.0024], [0.331, 0.0]], { y: PY, segs: 8 }), S.brass);
    // --- the cap and the clicker; the clip
    K.add(M.paint, lathe([[-0.118, 0.0], [-0.118, 0.018], [-0.112, 0.021], [-0.078, 0.0225], [-0.074, 0.0245]], { y: PY, segs: 14 }), S.penBlue);
    K.add(M.metal, lathe([[-0.142, 0.0], [-0.142, 0.0085], [-0.138, 0.0105], [-0.118, 0.0105]], { y: PY, segs: 10 }), S.chrome);
    K.add(M.metal, plate(rounded([[-0.1, PY + 0.021], [-0.086, PY + 0.03], [0.07, PY + 0.03], [0.082, PY + 0.024], [0.07, PY + 0.0255], [-0.086, PY + 0.0255]], 0.002, 2), -0.0055, 0.0055, { bevel: 0.001 }), S.bright);
    K.add(M.metal, lathe([[PY + 0.0205, 0.0], [PY + 0.0205, 0.0042], [PY + 0.0262, 0.0042], [PY + 0.0262, 0.0]], { axis: 'y', z: 0.076, segs: 8 }), S.bright);
    return { muzzle: new THREE.Vector3(0, PY, 0.333), length: 0.48 };
  },

  // ---------------------------------------------------------------------------------------------- the paint M4
  // The carbine of the special unit, as the real one is made: an upper and a lower of forged alloy pinned together, a
  // flat top's rail with its rear sight, the charging handle and the forward assist, the port's cover, a telescoping
  // stock on its tube, a ribbed handguard behind the triangle of its front sight, a birdcage at the muzzle - and for
  // its magazine a tin of paint, the lid on, a run of it down the side.
  m4(K, M, o = {}) {
    const S = INK;
    const paint = o.paint ? C(...o.paint) : C(0.62, 0.06, 0.3);
    const BY = 0.04;
    // --- the lower: the magazine well, the grip, the guard; its pins
    K.add(M.metal, plate(rounded([[-0.11, 0.0], [-0.02, 0.0], [0.0, 0.008], [0.09, 0.008], [0.094, -0.052], [0.16, -0.056], [0.166, 0.0], [0.176, 0.022], [-0.11, 0.022]], 0.006, 3), -0.0155, 0.0155, { bevel: 0.004 }), S.alu);
    const grip = rounded([[-0.054, 0.004], [-0.008, 0.004], [-0.03, -0.106], [-0.08, -0.11], [-0.09, -0.094]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.0135, 0.0135, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const s of [1, -1]) {
      for (let i = 0; i < 7; i++) K.add(M.matte, plate([[-0.07 - i * 0.002, -0.02 - i * 0.012], [-0.034 - i * 0.004, -0.02 - i * 0.012], [-0.035 - i * 0.004, -0.024 - i * 0.012], [-0.071 - i * 0.002, -0.024 - i * 0.012]], s * 0.0133, s * 0.0144, { bevel: 0.0005 }), S.steel);
      for (const [z, y] of [[-0.09, 0.012], [0.166, 0.012], [0.03, 0.014], [0.07, 0.002]]) screw(K, M.metal, s * 0.0155, y, z, 0.0034, S.bright);
    }
    K.add(M.metal, plate(rounded([[0.02, 0.012], [0.05, 0.012], [0.05, 0.02], [0.02, 0.02]], 0.002, 2), 0.0155, 0.019, { bevel: 0.001 }), S.steel3);
    K.add(M.metal, mirrored(lathe([[0.0155, 0.0], [0.0155, 0.0046], [0.019, 0.0046], [0.019, 0.0]], { axis: 'x', y: 0.006, z: 0.082, segs: 8 })), S.steel3);
    triggerGuard(K, M, 0.0, 0.088, 0.006, 0.04, S.alu, { hw: 0.007 });
    // --- the upper: its body and the hump of the brass deflector, the port and its cover, the assist, the rail
    K.add(M.metal, plate(rounded([[-0.11, 0.022], [0.176, 0.022], [0.176, 0.064], [-0.1, 0.064], [-0.11, 0.054]], 0.005, 3), -0.0165, 0.0165, { bevel: 0.005 }), S.alu);
    K.add(M.matte, plate([[0.02, 0.036], [0.098, 0.036], [0.098, 0.054], [0.02, 0.054]], -0.0172, -0.016, { bevel: 0.0004, r: 0.003 }), S.black);
    K.add(M.metal, tilted(cbox(-0.0185, 0.022, 0.018, -0.0165, 0.036, 0.1, 0.001), 0, 0, 0), S.alu2);
    K.add(M.metal, plate(rounded([[-0.02, 0.034], [0.006, 0.03], [0.012, 0.05], [-0.016, 0.052]], 0.003, 2), -0.0215, -0.0165, { bevel: 0.002 }), S.alu);
    K.add(M.metal, mirrored(lathe([[0.0165, 0.0], [0.0165, 0.0058], [0.024, 0.0058], [0.027, 0.0072], [0.0305, 0.0072], [0.0305, 0.0]], { axis: 'x', y: 0.044, z: -0.05, segs: 10 })), S.alu2);
    rail(K, M.metal, -0.1, 0.17, 0.064, S.alu2, { w: 0.021 });
    K.add(M.metal, plate([[-0.126, 0.05], [-0.1, 0.05], [-0.1, 0.062], [-0.126, 0.062]], -0.012, 0.012, { bevel: 0.002 }), S.alu2);
    for (const s of [1, -1]) K.add(M.metal, cbox(s * 0.012, 0.051, -0.13, s * 0.021, 0.061, -0.116, 0.002), S.alu2);
    // (the rear sight on the rail: its base, the ears, the aperture, the windage drum)
    K.add(M.metal, cbox(-0.0115, 0.0735, -0.09, 0.0115, 0.083, -0.04, 0.002), S.alu2);
    for (const s of [1, -1]) K.add(M.metal, plate(rounded([[-0.086, 0.083], [-0.05, 0.083], [-0.054, 0.104], [-0.066, 0.108], [-0.082, 0.104]], 0.003, 2), s * 0.0075, s * 0.0115, { bevel: 0.001 }), S.alu2);
    K.add(M.metal, plate([[-0.07, 0.084], [-0.066, 0.084], [-0.066, 0.1], [-0.07, 0.1]], -0.0056, 0.0056, { bevel: 0.0006, holes: [[[-0.07, 0.09], [-0.066, 0.09], [-0.066, 0.096], [-0.07, 0.096]]] }), S.steel3);
    K.add(M.metal, mirrored(lathe([[0.0115, 0.0], [0.0115, 0.0064], [0.017, 0.0064], [0.017, 0.0]], { axis: 'x', y: 0.092, z: -0.068, segs: 10 })), S.steel3);
    // --- the stock: the buffer tube and its nut, the sliding body, its latch and its pad
    K.add(M.metal, lathe([[-0.3, 0.0], [-0.3, 0.0128], [-0.118, 0.0128], [-0.118, 0.018], [-0.11, 0.018]], { y: 0.04, segs: 12 }), S.alu2);
    for (let i = 0; i < 8; i++) K.add(M.metal, rod([Math.cos((i / 8) * 6.283) * 0.0182, 0.04 + Math.sin((i / 8) * 6.283) * 0.0182, -0.118], [Math.cos((i / 8) * 6.283) * 0.0182, 0.04 + Math.sin((i / 8) * 6.283) * 0.0182, -0.11], 0.0026, 0.0026, 4), S.steel3);
    const st = rounded([[-0.34, 0.058], [-0.16, 0.058], [-0.16, 0.022], [-0.2, 0.016], [-0.25, -0.03], [-0.34, -0.05]], 0.008, 3);
    K.add(M.matte, plate(st, -0.016, 0.016, { bevel: 0.005, holes: [rounded([[-0.3, 0.012], [-0.24, 0.012], [-0.27, -0.016], [-0.3, -0.022]], 0.006, 3)] }), S.polymer);
    K.add(M.matte, plate(rounded([[-0.352, 0.06], [-0.34, 0.06], [-0.34, -0.052], [-0.352, -0.054]], 0.004, 2), -0.0175, 0.0175, { bevel: 0.003 }), S.steel);
    ridges(K, M.matte, 7, -0.351, -0.341, -0.046, 0.054, 0.0, S.polymer, { h: 0.0178 });
    K.add(M.metal, plate(rounded([[-0.25, 0.016], [-0.2, 0.016], [-0.206, 0.004], [-0.244, 0.0]], 0.003, 2), -0.006, 0.006, { bevel: 0.0015 }), S.steel3);
    // --- the barrel: the ring that holds the handguard, the handguard, the front sight's triangle, the birdcage
    K.add(M.metal, lathe([[0.176, 0.0], [0.176, 0.024], [0.184, 0.026], [0.2, 0.026], [0.204, 0.022]], { y: BY, segs: 16 }), S.alu2);
    for (let i = 0; i < 14; i++) K.add(M.metal, rod([Math.cos((i / 14) * 6.283) * 0.0262, BY + Math.sin((i / 14) * 6.283) * 0.0262, 0.184], [Math.cos((i / 14) * 6.283) * 0.0262, BY + Math.sin((i / 14) * 6.283) * 0.0262, 0.2], 0.0022, 0.0022, 4), S.steel3);
    K.add(M.matte, lathe([[0.204, 0.022], [0.21, 0.0255], [0.42, 0.0225], [0.426, 0.019], [0.426, 0.0]], { y: BY, segs: 16 }), S.polymer);
    for (let i = 0; i < 9; i++) K.add(M.matte, lathe([[0.222 + i * 0.022, 0.0258 - i * 0.00032], [0.23 + i * 0.022, 0.0257 - i * 0.00032]], { y: BY, segs: 16 }), S.steel);
    for (const s of [1, -1]) for (let i = 0; i < 6; i++) K.add(M.matte, cbox(s * 0.014 - 0.001, BY + 0.0195, 0.23 + i * 0.03, s * 0.014 + 0.001, BY + 0.0215, 0.246 + i * 0.03, 0.0004), S.black);
    K.add(M.paint, lathe([[0.404, 0.0232], [0.416, 0.023]], { y: BY, segs: 16 }), paint);
    K.add(M.metal, lathe([[0.426, 0.0], [0.426, 0.0098], [0.6, 0.0092], [0.6, 0.0]], { y: BY, segs: 12 }), S.steel);
    K.add(M.metal, plate(rounded([[0.44, BY - 0.012], [0.49, BY - 0.012], [0.486, BY + 0.03], [0.474, BY + 0.066], [0.462, BY + 0.066], [0.446, BY + 0.03]], 0.004, 3), -0.0075, 0.0075, { bevel: 0.002, holes: [rounded([[0.454, BY + 0.016], [0.48, BY + 0.016], [0.472, BY + 0.05], [0.462, BY + 0.05]], 0.003, 2)] }), S.alu2);
    K.add(M.metal, lathe([[BY + 0.066, 0.002], [BY + 0.078, 0.0014], [BY + 0.078, 0.0]], { axis: 'y', z: 0.468, segs: 6 }), S.bright);
    K.add(M.metal, pipe([[0, BY - 0.012, 0.46], [0, BY - 0.03, 0.458], [0, BY - 0.03, 0.474], [0, BY - 0.012, 0.472]], 0.0022, { steps: 10, tension: 0.2 }), S.bright);
    K.add(M.metal, lathe([[0.6, 0.0], [0.6, 0.011], [0.606, 0.0128], [0.656, 0.0128], [0.662, 0.0105], [0.662, 0.0062], [0.61, 0.0062]], { y: BY, segs: 12 }), S.steel2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      K.add(M.matte, rod([Math.cos(a) * 0.0124, BY + Math.sin(a) * 0.0124, 0.618], [Math.cos(a) * 0.0124, BY + Math.sin(a) * 0.0124, 0.65], 0.0026, 0.0026, 4), S.black);
    }
    K.add(M.matte, lathe([[0.6622, 0.0062], [0.6622, 0.0]], { y: BY, segs: 10 }), S.black);
    // --- its magazine: a tin of paint under the well - the rim, the lid's bead, the wire handle, a run down its side
    const TZ = 0.127;
    K.add(M.paint, lathe([[-0.17, 0.0], [-0.17, 0.04], [-0.062, 0.04], [-0.062, 0.0]], { axis: 'y', z: TZ, segs: 16 }), paint);
    for (const y of [-0.172, -0.066]) K.add(M.metal, lathe([[y, 0.0412], [y + 0.007, 0.0412]], { axis: 'y', z: TZ, segs: 16 }), S.chrome);
    K.add(M.matte, lathe([[-0.142, 0.0405], [-0.094, 0.0405]], { axis: 'y', z: TZ, segs: 16 }), S.label);
    K.add(M.matte, lathe([[-0.128, 0.0409], [-0.108, 0.0409]], { axis: 'y', z: TZ, segs: 16 }), paint);
    K.add(M.metal, pipe([[-0.041, -0.08, TZ], [-0.05, -0.12, TZ + 0.03], [0, -0.14, TZ + 0.05], [0.05, -0.12, TZ + 0.03], [0.041, -0.08, TZ]], 0.0018, { steps: 20, tension: 0.4, segs: 5 }), S.chrome);
    K.add(M.paint, pipe([[0.012, -0.062, TZ + 0.0395], [0.014, -0.08, TZ + 0.0405], [0.012, -0.1, TZ + 0.0405], [0.013, -0.108, TZ + 0.0402]], 0.0034, { steps: 10, segs: 6 }), paint);
    return { muzzle: new THREE.Vector3(0, BY, 0.664), length: 1.02, hold: new THREE.Vector3(0, BY - 0.026, 0.3), eject: new THREE.Vector3(-0.02, 0.046, 0.06) };
  },

  // ---------------------------------------------------------------------------------------------- the glue gun
  // A workshop's hot-glue gun: a moulded body in two halves screwed together, vents over the heater, a steel nozzle
  // in its orange sleeve with a bead of glue on it, the stick of glue standing out of the back, a big yellow trigger,
  // a wire stand folded under its nose, a stub of flex out of the grip.
  glue(K, M) {
    const S = INK;
    const NY = 0.052;
    // --- the body and the grip, one moulding; the seam; its screws
    const body = rounded([[-0.09, 0.012], [0.02, 0.008], [0.12, 0.012], [0.172, 0.03], [0.172, 0.074], [0.11, 0.094], [-0.06, 0.094], [-0.09, 0.07]], 0.014, 4);
    K.add(M.paint, plate(body, -0.021, 0.021, { bevel: 0.008, bs: 2 }), S.glueBlue);
    const grip = rounded([[-0.058, 0.014], [-0.002, 0.014], [-0.022, -0.104], [-0.08, -0.108], [-0.092, -0.09]], 0.014, 4);
    K.add(M.paint, plate(grip, -0.0165, 0.0165, { bevel: 0.007, bs: 2 }), S.glueBlue);
    K.add(M.matte, cbox(-0.0008, 0.094, -0.06, 0.0008, 0.0955, 0.11, 0.0003), S.glueBlue2);
    for (const s of [1, -1]) {
      K.add(M.paint, plate(rounded([[-0.064, 0.026], [0.03, 0.022], [0.1, 0.03], [0.1, 0.07], [-0.064, 0.074]], 0.008, 3), s * 0.021, s * 0.0226, { bevel: 0.001 }), S.glueBlue2);
      for (const [z, y] of [[-0.07, 0.05], [0.09, 0.082], [0.03, 0.016], [-0.05, -0.08]]) screw(K, M.metal, s * (y < 0 ? 0.0165 : 0.0226), y, z, 0.0036, S.steel3);
      for (let i = 0; i < 6; i++) K.add(M.matte, plate([[-0.074 - i * 0.002, -0.014 - i * 0.012], [-0.036 - i * 0.004, -0.014 - i * 0.012], [-0.037 - i * 0.004, -0.018 - i * 0.012], [-0.075 - i * 0.002, -0.018 - i * 0.012]], s * 0.0163, s * 0.0174, { bevel: 0.0005 }), S.glueBlue2);
    }
    slots(K, M.matte, 5, 0.105, 0.165, 0.04, 0.072, 0.0214, S.black, { fill: 0.45, lean: 0.006 });
    K.add(M.matte, plate(rounded([[-0.03, 0.04], [0.05, 0.04], [0.05, 0.062], [-0.03, 0.062]], 0.004, 3), 0.0226, 0.0232, { bevel: 0.0003 }), S.label);
    K.add(M.matte, cbox(0.0232, 0.047, -0.02, 0.0236, 0.055, 0.04, 0.0002), S.glueBlue2);
    K.add(M.glow, lathe([[0.0226, 0.0], [0.0226, 0.004], [0.0244, 0.004], [0.0244, 0.0]], { axis: 'x', y: 0.082, z: 0.06, segs: 8 }), S.orange);
    // --- the nozzle: its heater's shroud, the orange sleeve, the steel tip, a bead of glue
    K.add(M.metal, lathe([[0.172, 0.0], [0.172, 0.02], [0.186, 0.02], [0.19, 0.016]], { y: NY, segs: 14 }), S.steel3);
    K.add(M.round, lathe([[0.19, 0.0165], [0.194, 0.0185], [0.224, 0.014], [0.228, 0.011]], { y: NY, segs: 14 }), S.orange);
    K.add(M.metal, lathe([[0.228, 0.0], [0.228, 0.0105], [0.258, 0.0048], [0.266, 0.0048], [0.266, 0.002], [0.24, 0.002]], { y: NY, segs: 12 }), S.brass);
    K.add(M.glass, lathe([[0.266, 0.0], [0.266, 0.0044], [0.274, 0.006], [0.282, 0.0036], [0.286, 0.0]], { y: NY - 0.0016, segs: 8 }), S.glueStick);
    // --- the stick out of the back, through its collar; the stand; the trigger; the flex
    K.add(M.paint, lathe([[-0.106, 0.0], [-0.106, 0.0165], [-0.09, 0.0165], [-0.09, 0.0]], { y: 0.062, segs: 14 }), S.glueBlue2);
    K.add(M.glass, lathe([[-0.24, 0.0], [-0.24, 0.0105], [-0.236, 0.012], [-0.106, 0.012]], { y: 0.062, segs: 12 }), S.glueStick);
    K.add(M.metal, pipe([[-0.017, 0.016, 0.14], [-0.024, -0.034, 0.168], [0, -0.04, 0.172], [0.024, -0.034, 0.168], [0.017, 0.016, 0.14]], 0.0024, { steps: 18, tension: 0.3, segs: 5 }), S.chrome);
    K.add(M.paint, plate(rounded([[0.014, 0.012], [0.07, 0.014], [0.062, -0.02], [0.05, -0.058], [0.034, -0.056], [0.03, -0.02]], 0.006, 3), -0.0095, 0.0095, { bevel: 0.004, bs: 2 }), S.yellow);
    for (let i = 0; i < 4; i++) K.add(M.matte, cbox(-0.0098, -0.012 - i * 0.011, 0.058 - i * 0.003, 0.0098, -0.008 - i * 0.011, 0.066 - i * 0.003, 0.001), S.brass);
    K.add(M.matte, lathe([[-0.132, 0.0], [-0.132, 0.008], [-0.126, 0.0095], [-0.108, 0.011], [-0.106, 0.0]], { axis: 'y', z: -0.05, segs: 10 }), S.polymer);
    K.add(M.matte, pipe([[0, -0.132, -0.05], [0, -0.16, -0.054], [0.004, -0.185, -0.07], [0.012, -0.2, -0.094]], 0.0042, { steps: 14, tension: 0.4, segs: 6 }), S.polymer);
    return { muzzle: new THREE.Vector3(0, NY, 0.288), length: 0.53 };
  },

  // ---------------------------------------------------------------------------------------------- the white-out machine gun
  // A light machine gun fed from the top, as the old ones were: a bottle of correction fluid stands on it for a
  // magazine - its label, its ribbed red cap - so the sights sit off to the left of it. A finned barrel that carries its
  // heat off, a carrying handle, a cone of a nozzle with a white drop on it, a skeleton butt.
  tippex(K, M) {
    const S = INK;
    const BY = 0.04;
    // --- the receiver: a milled box, enamelled; its cover, the port, the cocking handle
    K.add(M.paint, plate(rounded([[-0.14, 0.004], [0.26, 0.004], [0.27, 0.014], [0.27, 0.07], [0.25, 0.08], [-0.12, 0.08], [-0.14, 0.066]], 0.006, 3), -0.022, 0.022, { bevel: 0.005 }), S.enamel);
    for (const s of [1, -1]) {
      K.add(M.paint, plate(rounded([[-0.12, 0.014], [0.24, 0.014], [0.24, 0.036], [-0.12, 0.036]], 0.004, 2), s * 0.022, s * 0.0238, { bevel: 0.001 }), S.enamel2);
      for (const z of [-0.11, -0.04, 0.03, 0.1, 0.17, 0.23]) screw(K, M.metal, s * 0.0238, 0.025, z, 0.0036, S.bright);
      screw(K, M.metal, s * 0.022, 0.064, -0.11, 0.0044, S.bright);
      screw(K, M.metal, s * 0.022, 0.064, 0.24, 0.0044, S.bright);
    }
    K.add(M.matte, plate([[0.02, 0.046], [0.11, 0.046], [0.11, 0.066], [0.02, 0.066]], -0.0228, -0.021, { bevel: 0.0004, r: 0.003 }), S.black);
    K.add(M.matte, plate([[0.12, 0.05], [0.24, 0.05], [0.24, 0.058], [0.12, 0.058]], -0.0228, -0.021, { bevel: 0.0003, r: 0.003 }), S.black);
    K.add(M.metal, mirrored(lathe([[0.022, 0.0], [0.022, 0.006], [0.03, 0.006], [0.032, 0.0085], [0.05, 0.0092], [0.053, 0.007], [0.053, 0.0]], { axis: 'x', y: 0.054, z: 0.2, segs: 10 })), S.bright);
    // --- the grip, the guard; the butt: a tube, a skeleton of pressed steel, a rubber pad
    const grip = rounded([[-0.054, 0.006], [-0.004, 0.006], [-0.028, -0.108], [-0.08, -0.112], [-0.092, -0.096]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.014, 0.014, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const s of [1, -1]) for (let i = 0; i < 7; i++) K.add(M.matte, plate([[-0.07 - i * 0.002, -0.02 - i * 0.012], [-0.032 - i * 0.004, -0.02 - i * 0.012], [-0.033 - i * 0.004, -0.024 - i * 0.012], [-0.071 - i * 0.002, -0.024 - i * 0.012]], s * 0.0138, s * 0.0149, { bevel: 0.0005 }), S.steel);
    triggerGuard(K, M, 0.0, 0.088, 0.004, 0.042, S.steel2);
    K.add(M.metal, lathe([[-0.3, 0.0], [-0.3, 0.012], [-0.14, 0.012]], { y: 0.056, segs: 10 }), S.steel2);
    const butt = rounded([[-0.42, 0.074], [-0.29, 0.074], [-0.29, 0.04], [-0.31, 0.03], [-0.34, -0.04], [-0.42, -0.06]], 0.008, 3);
    K.add(M.metal, plate(butt, -0.014, 0.014, { bevel: 0.004, holes: [rounded([[-0.4, 0.05], [-0.32, 0.05], [-0.35, -0.02], [-0.4, -0.036]], 0.008, 3)] }), S.steel2);
    K.add(M.metal, rod([0, 0.02, -0.14], [0, -0.03, -0.335], 0.006, 0.006, 8), S.steel2);
    K.add(M.round, plate(rounded([[-0.44, 0.078], [-0.42, 0.078], [-0.42, -0.064], [-0.44, -0.062]], 0.006, 3), -0.017, 0.017, { bevel: 0.005, bs: 2 }), S.polymer);
    // --- its magazine: the bottle on its collar - shoulders, a label, the cap with its ribs
    const MZ = 0.07;
    K.add(M.metal, lathe([[0.08, 0.0], [0.08, 0.03], [0.096, 0.03], [0.1, 0.027], [0.1, 0.0]], { axis: 'y', z: MZ, segs: 14 }), S.steel2);
    K.add(M.paint, lathe([[0.1, 0.0], [0.1, 0.046], [0.106, 0.05], [0.24, 0.05], [0.262, 0.036], [0.268, 0.026], [0.286, 0.026], [0.286, 0.0]], { axis: 'y', z: MZ, segs: 18 }), S.white);
    K.add(M.matte, lathe([[0.13, 0.0506], [0.216, 0.0506]], { axis: 'y', z: MZ, segs: 18 }), S.tin);
    K.add(M.matte, lathe([[0.15, 0.0511], [0.172, 0.0511]], { axis: 'y', z: MZ, segs: 18 }), S.white);
    K.add(M.matte, lathe([[0.186, 0.0511], [0.192, 0.0511]], { axis: 'y', z: MZ, segs: 18 }), S.white);
    K.add(M.paint, lathe([[0.286, 0.0], [0.286, 0.031], [0.34, 0.028], [0.346, 0.022], [0.346, 0.0]], { axis: 'y', z: MZ, segs: 14 }), S.staplerRed);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      K.add(M.paint, rod([Math.cos(a) * 0.0305, 0.29, MZ + Math.sin(a) * 0.0305], [Math.cos(a) * 0.0282, 0.338, MZ + Math.sin(a) * 0.0282], 0.0024, 0.0024, 4), S.red);
    }
    // --- the sights, off to its left: a leaf at the back, a hooded post at the front
    K.add(M.metal, cbox(0.022, 0.07, -0.1, 0.04, 0.082, -0.05, 0.002), S.steel2);
    K.add(M.metal, plate([[-0.084, 0.082], [-0.078, 0.082], [-0.078, 0.112], [-0.084, 0.112]], 0.024, 0.038, { bevel: 0.001, holes: [[[-0.084, 0.098], [-0.078, 0.098], [-0.078, 0.106], [-0.084, 0.106]]] }), S.steel3);
    K.add(M.metal, cbox(0.02, BY + 0.01, 0.6, 0.038, BY + 0.03, 0.63, 0.002), S.steel2);
    K.add(M.metal, plate(rounded([[0.602, BY + 0.03], [0.628, BY + 0.03], [0.626, BY + 0.062], [0.615, BY + 0.068], [0.604, BY + 0.062]], 0.003, 2), 0.024, 0.036, { bevel: 0.001, holes: [rounded([[0.608, BY + 0.038], [0.622, BY + 0.038], [0.622, BY + 0.056], [0.608, BY + 0.056]], 0.003, 2)] }), S.steel2);
    // --- the barrel: finned behind, plain ahead; the handle on it; the nozzle and its drop
    K.add(M.metal, lathe([[0.27, 0.0], [0.27, 0.0165], [0.66, 0.0135], [0.66, 0.0]], { y: BY, segs: 14 }), S.steel);
    for (let i = 0; i < 16; i++) K.add(M.metal, lathe([[0.284 + i * 0.016, 0.0], [0.284 + i * 0.016, 0.026 - i * 0.0004], [0.29 + i * 0.016, 0.026 - i * 0.0004], [0.29 + i * 0.016, 0.0]], { y: BY, segs: 14 }), S.steel2);
    K.add(M.metal, lathe([[0.4, 0.0], [0.4, 0.0215], [0.42, 0.0215], [0.42, 0.0]], { y: BY, segs: 12 }), S.steel3);
    K.add(M.metal, plate([[0.402, BY + 0.018], [0.418, BY + 0.018], [0.412, BY + 0.05], [0.37, BY + 0.086], [0.36, BY + 0.08], [0.398, BY + 0.046]], -0.0055, 0.0055, { bevel: 0.002 }), S.steel2);
    K.add(M.matte, lathe([[0.27, 0.0], [0.27, 0.012], [0.276, 0.014], [0.36, 0.014], [0.366, 0.012], [0.366, 0.0]], { y: BY + 0.09, segs: 12 }), S.polymer);
    K.add(M.paint, lathe([[0.66, 0.0], [0.66, 0.02], [0.668, 0.0225], [0.69, 0.0225], [0.74, 0.0075], [0.752, 0.0075], [0.752, 0.0038], [0.7, 0.0038]], { y: BY, segs: 14 }), S.white);
    K.add(M.paint, lathe([[0.668, 0.0232], [0.676, 0.0232]], { y: BY, segs: 14 }), S.staplerRed);
    K.add(M.paint, lathe([[0.0, 0.0], [0.004, 0.006], [0.014, 0.0085], [0.022, 0.006], [0.026, 0.0]], { axis: 'y', z: 0.75, segs: 8 }).translate(0, BY - 0.034, 0), S.white);
    return { muzzle: new THREE.Vector3(0, BY, 0.755), length: 1.2, hold: new THREE.Vector3(0, BY - 0.03, 0.2), eject: new THREE.Vector3(-0.024, 0.056, 0.06) };
  },

  // ---------------------------------------------------------------------------------------------- the eraser machine gun
  // A drum gun of the old pattern: a tube receiver with its bolt handle in a slot, a barrel in a jacket cut with
  // cooling slots and a slanted compensator, a round drum under it with its winding key - and its furniture cut out of
  // school eraser, pink behind and blue ahead, the paper sleeve still round the butt. Its mouth holds the next one.
  erasermg(K, M) {
    const S = INK;
    const BY = 0.04;
    // --- the butt, of eraser, in its sleeve; the grip
    const butt = rounded([[-0.42, 0.058], [-0.14, 0.062], [-0.14, 0.012], [-0.2, 0.002], [-0.42, -0.07]], 0.014, 4);
    K.add(M.round, plate(butt, -0.022, 0.022, { bevel: 0.009, bs: 2 }), S.blueRubber);
    K.add(M.round, plate(rounded([[-0.26, 0.061], [-0.14, 0.063], [-0.14, 0.011], [-0.2, 0.001], [-0.26, -0.018]], 0.01, 3), -0.0224, 0.0224, { bevel: 0.009, bs: 2 }), S.eraser);
    K.add(M.matte, plate(rounded([[-0.34, 0.062], [-0.25, 0.064], [-0.25, -0.024], [-0.34, -0.05]], 0.006, 3), -0.0236, 0.0236, { bevel: 0.006, bs: 2 }), S.paper);
    for (const s of [1, -1]) {
      K.add(M.matte, plate([[-0.326, 0.008], [-0.264, 0.008], [-0.264, 0.04], [-0.326, 0.04]], s * 0.0236, s * 0.0242, { bevel: 0.0003, r: 0.004 }), S.tin);
      K.add(M.matte, plate([[-0.316, 0.02], [-0.274, 0.02], [-0.274, 0.028], [-0.316, 0.028]], s * 0.0242, s * 0.0246, { bevel: 0.0002 }), S.paper);
    }
    K.add(M.metal, plate(rounded([[-0.434, 0.06], [-0.42, 0.06], [-0.42, -0.072], [-0.434, -0.07]], 0.005, 2), -0.0225, 0.0225, { bevel: 0.004 }), S.steel2);
    const grip = rounded([[-0.054, 0.006], [-0.004, 0.006], [-0.03, -0.104], [-0.08, -0.108], [-0.092, -0.092]], 0.014, 4);
    K.add(M.round, plate(grip, -0.016, 0.016, { bevel: 0.007, bs: 2 }), S.eraser);
    for (const s of [1, -1]) screw(K, M.metal, s * 0.016, -0.05, -0.05, 0.0046, S.bright, { h: 0.002 });
    // --- the receiver: a tube and its end cap, the trigger housing under it, the bolt's slot and handle, the port
    K.add(M.metal, lathe([[-0.16, 0.0], [-0.16, 0.021], [-0.152, 0.024], [-0.14, 0.024], [-0.136, 0.0215], [0.2, 0.0215], [0.2, 0.0]], { y: BY, segs: 16 }), S.steel);
    for (let i = 0; i < 10; i++) K.add(M.metal, rod([Math.cos((i / 10) * 6.283) * 0.0242, BY + Math.sin((i / 10) * 6.283) * 0.0242, -0.154], [Math.cos((i / 10) * 6.283) * 0.0242, BY + Math.sin((i / 10) * 6.283) * 0.0242, -0.14], 0.0022, 0.0022, 4), S.steel3);
    K.add(M.metal, plate(rounded([[-0.11, 0.004], [0.2, 0.004], [0.2, 0.026], [-0.11, 0.026]], 0.004, 2), -0.016, 0.016, { bevel: 0.003 }), S.steel2);
    K.add(M.matte, plate([[-0.06, BY + 0.004], [0.11, BY + 0.004], [0.11, BY + 0.012], [-0.06, BY + 0.012]], -0.0224, -0.0206, { bevel: 0.0003, r: 0.003 }), S.black);
    K.add(M.metal, mirrored(lathe([[0.0215, 0.0], [0.0215, 0.0052], [0.03, 0.0052], [0.032, 0.008], [0.046, 0.008], [0.046, 0.0]], { axis: 'x', y: BY + 0.008, z: 0.07, segs: 10 })), S.bright);
    K.add(M.matte, plate([[0.02, BY + 0.016], [0.1, BY + 0.016], [0.1, BY + 0.022], [0.02, BY + 0.022]], -0.006, 0.006, { bevel: 0.0004 }).translate(0, 0.0, 0), S.black);
    triggerGuard(K, M, 0.0, 0.088, 0.004, 0.042, S.steel2);
    for (const s of [1, -1]) for (const z of [-0.09, 0.02, 0.17]) screw(K, M.metal, s * 0.016, 0.015, z, 0.0034, S.bright);
    // --- the drum: two pressed halves riveted round their rim, the winding key, the little erasers seen in its window
    const DZ = 0.14;
    const DY = -0.062;
    K.add(M.paint, lathe([[-0.03, 0.0], [-0.03, 0.074], [-0.024, 0.08], [0.024, 0.08], [0.03, 0.074], [0.03, 0.0]], { axis: 'x', y: DY, z: DZ, segs: 22 }), S.blueRubber);
    K.add(M.metal, lathe([[-0.005, 0.0815], [0.005, 0.0815]], { axis: 'x', y: DY, z: DZ, segs: 22 }), S.steel3);
    for (const s of [1, -1]) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        screw(K, M.metal, s * 0.03, DY + Math.sin(a) * 0.066, DZ + Math.cos(a) * 0.066, 0.0032, S.bright);
      }
      const ring = lathe([[0.03, 0.05], [0.0312, 0.05], [0.0312, 0.044], [0.03, 0.044]], { axis: 'x', y: DY, z: DZ, segs: 20 });
      K.add(M.paint, s > 0 ? ring : mirrored(ring), S.tin);
    }
    K.add(M.metal, lathe([[0.03, 0.0], [0.03, 0.012], [0.036, 0.012], [0.036, 0.0]], { axis: 'x', y: DY, z: DZ, segs: 10 }), S.steel3);
    K.add(M.metal, cbox(0.036, DY - 0.005, DZ - 0.03, 0.041, DY + 0.005, DZ + 0.03, 0.002), S.bright);
    K.add(M.matte, plate([[DZ - 0.04, DY + 0.02], [DZ + 0.04, DY + 0.02], [DZ + 0.034, DY + 0.036], [DZ - 0.034, DY + 0.036]], -0.0312, -0.0298, { bevel: 0.0003, r: 0.003 }), S.black);
    for (let i = 0; i < 5; i++) K.add(M.round, cbox(-0.0318, DY + 0.0225, DZ - 0.034 + i * 0.0142, -0.03, DY + 0.0335, DZ - 0.023 + i * 0.0142, 0.0015), i % 2 ? S.blueRubber : S.eraser);
    K.add(M.metal, cbox(-0.014, DY + 0.07, DZ - 0.03, 0.014, 0.006, DZ + 0.03, 0.003), S.steel2);
    // --- the barrel in its jacket, slotted; the compensator cut on a slant; the next eraser in its mouth
    K.add(M.metal, lathe([[0.2, 0.0], [0.2, 0.0235], [0.21, 0.0255], [0.56, 0.0255], [0.6, 0.0255], [0.6, 0.022], [0.22, 0.022]], { y: BY, segs: 16 }), S.steel2);
    for (let r = 0; r < 4; r++) {
      const a = (r / 4) * Math.PI * 2 + Math.PI / 4;
      for (let i = 0; i < 5; i++) K.add(M.matte, rod([Math.cos(a) * 0.0256, BY + Math.sin(a) * 0.0256, 0.24 + i * 0.062], [Math.cos(a) * 0.0256, BY + Math.sin(a) * 0.0256, 0.28 + i * 0.062], 0.0052, 0.0052, 6), S.black);
    }
    K.add(M.metal, lathe([[0.2, 0.0], [0.2, 0.0125], [0.6, 0.0118]], { y: BY, segs: 10 }), S.steel);
    K.add(M.metal, plate([[0.6, BY - 0.0255], [0.65, BY - 0.0255], [0.628, BY + 0.0255], [0.6, BY + 0.0255]], -0.0235, 0.0235, { bevel: 0.004, holes: [[[0.606, BY - 0.012], [0.636, BY - 0.012], [0.626, BY + 0.012], [0.606, BY + 0.012]]] }), S.steel3);
    K.add(M.metal, plate(rounded([[0.56, BY + 0.0255], [0.59, BY + 0.0255], [0.586, BY + 0.05], [0.566, BY + 0.05]], 0.003, 2), -0.003, 0.003, { bevel: 0.001 }), S.steel2);
    K.add(M.metal, plate([[-0.02, BY + 0.0215], [0.0, BY + 0.0215], [0.0, BY + 0.046], [-0.02, BY + 0.046]], -0.011, 0.011, { bevel: 0.001, holes: [[[-0.02, BY + 0.032], [0.0, BY + 0.032], [0.0, BY + 0.04], [-0.02, BY + 0.04]]] }), S.steel2);
    K.add(M.round, cbox(-0.0105, BY - 0.0105, 0.6, 0.0105, BY + 0.0105, 0.668, 0.003), S.eraser);
    // (the hand's place ahead of the drum: a block of blue eraser)
    K.add(M.round, plate(rounded([[0.25, BY - 0.026], [0.42, BY - 0.026], [0.43, BY - 0.04], [0.42, BY - 0.066], [0.26, BY - 0.07], [0.244, BY - 0.05]], 0.01, 3), -0.02, 0.02, { bevel: 0.008, bs: 2 }), S.blueRubber);
    for (const s of [1, -1]) for (let i = 0; i < 5; i++) K.add(M.round, cbox(s * 0.02 - 0.001, BY - 0.062, 0.274 + i * 0.03, s * 0.02 + 0.001, BY - 0.034, 0.284 + i * 0.03, 0.0008), S.tin);
    return { muzzle: new THREE.Vector3(0, BY, 0.67), length: 1.11, hold: new THREE.Vector3(0, BY - 0.07, 0.33), eject: new THREE.Vector3(-0.024, BY + 0.008, 0.03) };
  },

  // ---------------------------------------------------------------------------------------------- the paint machine gun
  // A sprayer made a machine gun: three tins of paint stand in a rack on its back - red, yellow, blue - each with its
  // lid, its wire handle and a hose down into the receiver; a heavy barrel in a perforated shroud, a spray head with
  // its ring of wet paint at the mouth; a fixed butt.
  paintmg(K, M) {
    const S = INK;
    const BY = 0.036;
    const cans = [S.staplerRed, S.yellow, C(0.16, 0.42, 0.74)];
    // --- the receiver, its ribs; the port; the handle on its right
    K.add(M.paint, plate(rounded([[-0.16, 0.002], [0.28, 0.002], [0.29, 0.012], [0.29, 0.064], [0.27, 0.072], [-0.14, 0.072], [-0.16, 0.058]], 0.006, 3), -0.0235, 0.0235, { bevel: 0.005 }), S.navy2);
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++) K.add(M.paint, plate([[-0.13 + i * 0.1, 0.012], [-0.06 + i * 0.1, 0.012], [-0.06 + i * 0.1, 0.03], [-0.13 + i * 0.1, 0.03]], s * 0.0235, s * 0.0252, { bevel: 0.001, r: 0.004 }), S.navy);
      for (const z of [-0.14, 0.0, 0.14, 0.27]) screw(K, M.metal, s * 0.0235, 0.058, z, 0.004, S.bright);
    }
    K.add(M.matte, plate([[0.02, 0.04], [0.1, 0.04], [0.1, 0.058], [0.02, 0.058]], -0.0242, -0.0226, { bevel: 0.0004, r: 0.003 }), S.black);
    K.add(M.metal, mirrored(lathe([[0.0235, 0.0], [0.0235, 0.0056], [0.032, 0.0056], [0.034, 0.0085], [0.052, 0.0085], [0.052, 0.0]], { axis: 'x', y: 0.05, z: 0.18, segs: 10 })), S.bright);
    // --- the grip, the guard, the butt and its pad
    const grip = rounded([[-0.054, 0.006], [-0.004, 0.006], [-0.028, -0.108], [-0.08, -0.112], [-0.092, -0.096]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.014, 0.014, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const s of [1, -1]) for (let i = 0; i < 7; i++) K.add(M.matte, plate([[-0.07 - i * 0.002, -0.02 - i * 0.012], [-0.032 - i * 0.004, -0.02 - i * 0.012], [-0.033 - i * 0.004, -0.024 - i * 0.012], [-0.071 - i * 0.002, -0.024 - i * 0.012]], s * 0.0138, s * 0.0149, { bevel: 0.0005 }), S.steel);
    triggerGuard(K, M, 0.0, 0.088, 0.004, 0.042, S.steel2);
    const butt = rounded([[-0.42, 0.066], [-0.16, 0.066], [-0.16, 0.008], [-0.22, 0.0], [-0.42, -0.06]], 0.012, 4);
    K.add(M.matte, plate(butt, -0.019, 0.019, { bevel: 0.007, bs: 2, holes: [rounded([[-0.38, 0.04], [-0.24, 0.04], [-0.26, 0.012], [-0.38, -0.022]], 0.01, 3)] }), S.polymer);
    K.add(M.round, plate(rounded([[-0.44, 0.07], [-0.42, 0.07], [-0.42, -0.064], [-0.44, -0.062]], 0.006, 3), -0.0205, 0.0205, { bevel: 0.005, bs: 2 }), S.steel);
    // --- the rack and its three tins: lids, beads, handles, labels; a hose from each down into the receiver
    K.add(M.metal, cbox(-0.03, 0.072, -0.13, 0.03, 0.08, 0.2, 0.002), S.steel2);
    cans.forEach((c, i) => {
      const z = -0.085 + i * 0.12;
      K.add(M.paint, lathe([[0.08, 0.0], [0.08, 0.046], [0.19, 0.046], [0.19, 0.0]], { axis: 'y', z, segs: 16 }), c);
      for (const y of [0.08, 0.186]) K.add(M.metal, lathe([[y, 0.0474], [y + 0.006, 0.0474]], { axis: 'y', z, segs: 16 }), S.chrome);
      K.add(M.metal, lathe([[0.192, 0.0], [0.192, 0.04], [0.196, 0.04], [0.196, 0.0]], { axis: 'y', z, segs: 14 }), S.chrome);
      K.add(M.matte, lathe([[0.106, 0.0466], [0.162, 0.0466]], { axis: 'y', z, segs: 16 }), S.label);
      K.add(M.matte, lathe([[0.124, 0.0471], [0.144, 0.0471]], { axis: 'y', z, segs: 16 }), c);
      K.add(M.metal, pipe([[-0.047, 0.17, z], [-0.056, 0.21, z + 0.012], [0, 0.236, z + 0.02], [0.056, 0.21, z + 0.012], [0.047, 0.17, z]], 0.0018, { steps: 18, tension: 0.4, segs: 5 }), S.chrome);
      K.add(M.matte, pipe([[0.047, 0.1, z + 0.01], [0.062, 0.07, z + 0.014], [0.05, 0.04, z + 0.012], [0.024, 0.03, z + 0.012]], 0.0052, { steps: 14, tension: 0.4, segs: 6 }), S.polymer);
      K.add(M.metal, lathe([[0.024, 0.0], [0.024, 0.007], [0.029, 0.007], [0.029, 0.0]], { axis: 'x', y: 0.03, z: z + 0.012, segs: 8 }), S.brass);
    });
    // --- the barrel, heavy, in a shroud drilled with holes; the spray head: its ring, its cap, the wet ring
    K.add(M.metal, lathe([[0.29, 0.0], [0.29, 0.016], [0.62, 0.0145], [0.62, 0.0]], { y: BY, segs: 12 }), S.steel);
    K.add(M.metal, lathe([[0.29, 0.0], [0.29, 0.026], [0.3, 0.028], [0.52, 0.028], [0.53, 0.026], [0.53, 0.0235], [0.3, 0.0235]], { y: BY, segs: 16 }), S.steel2);
    for (let r = 0; r < 6; r++) {
      const a = (r / 6) * Math.PI * 2 + 0.26;
      for (let i = 0; i < 7; i++) K.add(M.matte, lathe([[0.0278, 0.0], [0.0278, 0.0048], [0.0284, 0.0048], [0.0284, 0.0]], { axis: 'x', y: 0, z: 0, segs: 8 }).rotateZ(a).translate(0, BY, 0.32 + i * 0.03 + (r % 2) * 0.015), S.black);
    }
    K.add(M.metal, plate(rounded([[0.5, BY + 0.028], [0.528, BY + 0.028], [0.524, BY + 0.056], [0.514, BY + 0.062], [0.504, BY + 0.056]], 0.003, 2), -0.004, 0.004, { bevel: 0.001 }), S.steel2);
    K.add(M.metal, plate([[-0.03, 0.08], [-0.01, 0.08], [-0.01, 0.1], [-0.03, 0.1]], 0.03, 0.044, { bevel: 0.001, holes: [[[-0.03, 0.088], [-0.01, 0.088], [-0.01, 0.095], [-0.03, 0.095]]] }), S.steel2);
    K.add(M.metal, lathe([[0.62, 0.0], [0.62, 0.0235], [0.64, 0.0235], [0.644, 0.021], [0.662, 0.019], [0.666, 0.015], [0.666, 0.0]], { y: BY, segs: 16 }), S.chrome);
    for (let i = 0; i < 16; i++) K.add(M.metal, rod([Math.cos((i / 16) * 6.283) * 0.0238, BY + Math.sin((i / 16) * 6.283) * 0.0238, 0.623], [Math.cos((i / 16) * 6.283) * 0.0238, BY + Math.sin((i / 16) * 6.283) * 0.0238, 0.638], 0.0016, 0.0016, 4), S.steel3);
    for (const s of [1, -1]) K.add(M.metal, plate(rounded([[0.66, BY + s * 0.011], [0.682, BY + s * 0.013], [0.684, BY + s * 0.019], [0.66, BY + s * 0.02]], 0.002, 2), -0.0045, 0.0045, { bevel: 0.0014 }), S.chrome);
    K.add(M.paint, lathe([[0.666, 0.0072], [0.678, 0.0042], [0.678, 0.0016], [0.668, 0.0016]], { y: BY, segs: 10 }), S.yellow);
    K.add(M.glow, lathe([[0.6665, 0.0125], [0.6665, 0.0082]], { y: BY, segs: 14 }), S.paintPink);
    return { muzzle: new THREE.Vector3(0, BY, 0.682), length: 1.13, hold: new THREE.Vector3(0, BY - 0.03, 0.3), eject: new THREE.Vector3(-0.025, 0.05, 0.06) };
  },

  // ---------------------------------------------------------------------------------------------- the sharpener minigun
  // Six barrels on a rotor, each a pencil of another colour cut to a point, held in two steel discs; behind them a
  // desk sharpener for the motor's housing - blue enamel, its crank on the side, its drawer of shavings under it - a
  // handle over the top to carry and steer it by, a grip and a trigger behind. (The rotor is a part of its own: it turns.)
  minigun(K, M, o = {}) {
    const S = INK;
    const RY = 0.03; // the rotor's axis
    // --- the housing: the sharpener's body, its two halves, the plate with the maker's name; the drawer
    K.add(M.paint, plate(rounded([[-0.3, -0.05], [0.04, -0.05], [0.06, -0.03], [0.06, 0.09], [0.03, 0.112], [-0.27, 0.112], [-0.3, 0.09]], 0.016, 4), -0.07, 0.07, { bevel: 0.014, bs: 2 }), S.sharpBlue);
    for (const s of [1, -1]) {
      K.add(M.paint, plate(rounded([[-0.27, -0.03], [0.03, -0.03], [0.03, 0.09], [-0.27, 0.09]], 0.012, 3), s * 0.07, s * 0.0724, { bevel: 0.0012 }), S.sharpBlue2);
      for (const [z, y] of [[-0.25, -0.012], [0.01, -0.012], [-0.25, 0.072], [0.01, 0.072]]) screw(K, M.metal, s * 0.0724, y, z, 0.0052, S.bright);
    }
    K.add(M.matte, plate(rounded([[-0.2, 0.02], [-0.07, 0.02], [-0.07, 0.056], [-0.2, 0.056]], 0.005, 3), 0.0724, 0.0734, { bevel: 0.0004 }), S.label);
    for (const y of [0.03, 0.04]) K.add(M.matte, cbox(0.0734, y, -0.19, 0.0738, y + 0.005, -0.08, 0.0002), S.sharpBlue2);
    K.add(M.glass, plate(rounded([[-0.26, -0.11], [-0.04, -0.11], [-0.03, -0.1], [-0.03, -0.05], [-0.27, -0.05], [-0.27, -0.1]], 0.008, 3), -0.06, 0.06, { bevel: 0.008, bs: 2 }), S.glassc);
    for (let i = 0; i < 9; i++) K.add(M.matte, pipe([[0.0605, -0.064 - (i % 3) * 0.012, -0.24 + i * 0.022], [0.0612, -0.058 - (i % 3) * 0.012, -0.232 + i * 0.022], [0.0612, -0.068 - (i % 3) * 0.012, -0.224 + i * 0.022], [0.0605, -0.074 - (i % 3) * 0.012, -0.232 + i * 0.022]], 0.0016, { steps: 8, segs: 4, closed: true }), i % 2 ? S.tipwood : S.pencils[i % 6]);
    K.add(M.metal, cbox(-0.02, -0.116, -0.17, 0.02, -0.108, -0.13, 0.003), S.chrome);
    // --- the crank on its right: the boss, the arm, the wooden knob
    K.add(M.metal, mirrored(lathe([[0.07, 0.0], [0.07, 0.022], [0.078, 0.022], [0.082, 0.014], [0.094, 0.014], [0.094, 0.0]], { axis: 'x', y: 0.03, z: -0.13, segs: 14 })), S.chrome);
    K.add(M.metal, plate(rounded([[-0.142, 0.02], [-0.118, 0.02], [-0.108, 0.096], [-0.13, 0.1]], 0.006, 3), -0.1, -0.094, { bevel: 0.002 }), S.chrome);
    K.add(M.matte, mirrored(lathe([[0.1, 0.0], [0.1, 0.008], [0.106, 0.0125], [0.134, 0.0135], [0.14, 0.009], [0.14, 0.0]], { axis: 'x', y: 0.088, z: -0.119, segs: 10 })), S.cedar);
    // --- the handle over the top; the grip and the trigger behind; the motor's can at the back, its flex
    K.add(M.metal, pipe([[0, 0.112, -0.24], [0, 0.17, -0.235], [0, 0.185, -0.2], [0, 0.185, -0.06], [0, 0.17, -0.025], [0, 0.112, -0.02]], 0.0085, { steps: 30, tension: 0.2, segs: 8 }), S.steel2);
    K.add(M.round, lathe([[-0.19, 0.0], [-0.19, 0.0125], [-0.184, 0.0145], [-0.076, 0.0145], [-0.07, 0.0125], [-0.07, 0.0]], { y: 0.185, segs: 12 }), S.polymer);
    for (let i = 0; i < 7; i++) K.add(M.round, lathe([[-0.176 + i * 0.015, 0.0152], [-0.17 + i * 0.015, 0.0152]], { y: 0.185, segs: 12 }), S.steel);
    const grip = rounded([[-0.26, -0.05], [-0.21, -0.05], [-0.234, -0.16], [-0.286, -0.164], [-0.298, -0.148]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.015, 0.015, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const s of [1, -1]) for (let i = 0; i < 7; i++) K.add(M.matte, plate([[-0.276 - i * 0.002, -0.072 - i * 0.012], [-0.238 - i * 0.004, -0.072 - i * 0.012], [-0.239 - i * 0.004, -0.076 - i * 0.012], [-0.277 - i * 0.002, -0.076 - i * 0.012]], s * 0.0148, s * 0.0159, { bevel: 0.0005 }), S.steel);
    triggerGuard(K, M, -0.21, -0.122, -0.052, 0.042, S.steel2);
    K.add(M.metal, lathe([[-0.37, 0.0], [-0.37, 0.034], [-0.362, 0.04], [-0.3, 0.04]], { y: RY, segs: 16 }), S.steel2);
    for (let i = 0; i < 5; i++) K.add(M.matte, lathe([[-0.356 + i * 0.011, 0.0406], [-0.351 + i * 0.011, 0.0406]], { y: RY, segs: 16 }), S.black);
    K.add(M.matte, pipe([[0, RY, -0.37], [0, RY - 0.01, -0.4], [0.01, RY - 0.05, -0.42], [0.02, RY - 0.1, -0.415]], 0.005, { steps: 14, tension: 0.4, segs: 6 }), S.polymer);
    // --- the bearing the rotor turns in, at the housing's face
    K.add(M.metal, lathe([[0.06, 0.0], [0.06, 0.058], [0.072, 0.058], [0.078, 0.05], [0.078, 0.0]], { y: RY, segs: 20 }), S.steel2);
    // --- the rotor (it turns): six pencils round a spindle, two discs that hold them, a third at their points
    const B = new K.constructor();
    const R0 = 0.04;
    B.add(M.metal, lathe([[0.078, 0.0], [0.078, 0.012], [0.5, 0.012], [0.5, 0.0]], { segs: 8 }), S.steel);
    for (const [z, w] of [[0.1, 0.014], [0.3, 0.012], [0.47, 0.01]]) {
      B.add(M.metal, lathe([[z, 0.0], [z, 0.062], [z + w, 0.062], [z + w, 0.0]], { segs: 24 }), S.steel3);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        B.add(M.matte, rod([Math.cos(a) * 0.05, Math.sin(a) * 0.05, z - 0.0006], [Math.cos(a) * 0.05, Math.sin(a) * 0.05, z + w + 0.0006], 0.006, 0.006, 6), S.black);
      }
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * R0;
      const y = Math.sin(a) * R0;
      B.add(M.paint, hexbar(0.08, 0.52, 0.0165, 0.0165, { x, y, turn: 0 }), S.pencils[i]);
      B.add(M.metal, lathe([[0.08, 0.0], [0.08, 0.0185], [0.098, 0.0185]], { x, y, segs: 10 }), S.brass);
      B.add(M.matte, hexbar(0.52, 0.575, 0.0165, 0.006, { x, y }), S.tipwood);
      B.add(M.matte, lathe([[0.575, 0.006], [0.6, 0.003], [0.6, 0.0016], [0.582, 0.0016]], { x, y, segs: 6, soft: 2 }), S.lead);
    }
    // (all of it brought to the hand: the web of the hand at the top of its grip)
    const HY = 0.052;
    const HZ = 0.236;
    shift(K, 0, HY, HZ);
    return { muzzle: new THREE.Vector3(0, RY + HY, 0.61 + HZ), length: 1.03, hold: new THREE.Vector3(0, 0.185 + HY, -0.13 + HZ), eject: new THREE.Vector3(-0.075, -0.02 + HY, -0.05 + HZ), reach: 0.38, side: 0.16, parts: { rotor: { kit: B, at: [0, RY + HY, HZ] } } };
  },

  // ---------------------------------------------------------------------------------------------- the paper plane launcher
  // A break-open single-shot launcher - a walnut butt, a steel action with its latch, a ladder sight stood up on the
  // barrel - whose short fat barrel is a mailing tube, steel-ringed at breech and mouth; a paper dart sits in the
  // mouth, two more are tucked under a band on the butt.
  planes(K, M) {
    const S = INK;
    const BY = 0.062;
    const R = 0.05;
    // --- the butt and its pad; the band and the spare darts
    const stock = rounded([[-0.38, 0.05], [-0.2, 0.056], [-0.1, 0.03], [-0.03, 0.012], [-0.012, 0.012], [-0.012, -0.03], [-0.03, -0.104], [-0.082, -0.11], [-0.1, -0.054], [-0.38, -0.09]], 0.012, 4);
    K.add(M.matte, plate(stock, -0.023, 0.023, { bevel: 0.009, bs: 2 }), S.walnut);
    for (const s of [1, -1]) for (const [z0, z1, y] of [[-0.36, -0.2, 0.024], [-0.34, -0.15, -0.008], [-0.37, -0.22, -0.04], [-0.28, -0.14, -0.062]]) K.add(M.matte, plate([[z0, y], [z1, y + 0.002], [z1, y + 0.0046], [z0, y + 0.003]], s * 0.0225, s * 0.0236, { bevel: 0.0004 }), S.walnut2);
    pencilButt(K, M, -0.38, -0.09, 0.05, 0.023);
    K.add(M.matte, cbox(-0.0255, -0.08, -0.25, 0.0255, 0.056, -0.228, 0.002), S.polymer);
    paperPlane(K, M, 0.03, -0.01, -0.24, 0.62, S.paper, S.label);
    paperPlane(K, M, -0.03, -0.01, -0.24, 0.62, S.paper, S.label);
    // --- the action: its frame, the hinge, the latch on top, the guard
    K.add(M.metal, plate(rounded([[-0.03, -0.032], [0.1, -0.032], [0.12, -0.012], [0.12, BY + 0.03], [0.08, BY + 0.05], [-0.01, BY + 0.03], [-0.03, 0.014]], 0.008, 3), -0.03, 0.03, { bevel: 0.006, bs: 2 }), S.steel2);
    for (const s of [1, -1]) {
      screw(K, M.metal, s * 0.03, -0.012, 0.09, 0.0062, S.bright);
      screw(K, M.metal, s * 0.03, 0.03, 0.02, 0.0036, S.bright);
      K.add(M.metal, plate(rounded([[-0.01, 0.0], [0.07, 0.0], [0.07, 0.05], [-0.01, 0.034]], 0.006, 3), s * 0.03, s * 0.0316, { bevel: 0.001 }), S.steel3);
    }
    K.add(M.metal, plate(rounded([[-0.02, BY + 0.03], [0.05, BY + 0.05], [0.046, BY + 0.058], [-0.03, BY + 0.038]], 0.002, 2), -0.007, 0.007, { bevel: 0.0015 }), S.bright);
    triggerGuard(K, M, 0.0, 0.094, -0.032, 0.044, S.steel2);
    // --- the barrel: a mailing tube - its spiral seam, a strip of tape, the steel rings; its bore
    K.add(M.matte, lathe([[0.12, 0.0], [0.12, R], [0.56, R], [0.56, R - 0.007], [0.2, R - 0.007]], { y: BY, segs: 20 }), S.kraft);
    for (let i = 0; i < 5; i++) K.add(M.matte, pipe(Array.from({ length: 9 }, (_, k) => { const a = (k / 8) * Math.PI * 2 + i; return [Math.cos(a) * (R + 0.0004), BY + Math.sin(a) * (R + 0.0004), 0.15 + i * 0.08 + (k / 8) * 0.08]; }), 0.0011, { steps: 24, segs: 4 }), S.kraft2);
    K.add(M.matte, lathe([[0.3, R + 0.0006], [0.34, R + 0.0006]], { y: BY, segs: 20 }), S.tape);
    for (const [z, w] of [[0.12, 0.03], [0.535, 0.03]]) K.add(M.metal, lathe([[z, R + 0.001], [z, R + 0.005], [z + w, R + 0.005], [z + w, R + 0.001]], { y: BY, segs: 20 }), S.steel3);
    K.add(M.matte, lathe([[0.22, R - 0.007], [0.22, 0.0]], { y: BY, segs: 16 }), S.black);
    // (the wood under it, for the other hand)
    K.add(M.matte, plate(rounded([[0.16, BY - R - 0.03], [0.4, BY - R - 0.02], [0.41, BY - R - 0.004], [0.4, BY - R + 0.014], [0.16, BY - R + 0.014]], 0.008, 3), -0.028, 0.028, { bevel: 0.01, bs: 2 }), S.walnut);
    for (const s of [1, -1]) for (let i = 0; i < 8; i++) K.add(M.matte, plate([[0.18 + i * 0.026, BY - R - 0.022], [0.184 + i * 0.026, BY - R - 0.022], [0.194 + i * 0.026, BY - R + 0.004], [0.19 + i * 0.026, BY - R + 0.004]], s * 0.028, s * 0.029, { bevel: 0.0003 }), S.walnut2);
    // --- the ladder sight, stood up; the blade at the mouth
    K.add(M.metal, cbox(-0.014, BY + R + 0.004, 0.25, 0.014, BY + R + 0.012, 0.3, 0.002), S.steel2);
    K.add(M.metal, plate([[0.268, BY + R + 0.012], [0.274, BY + R + 0.012], [0.274, BY + R + 0.1], [0.268, BY + R + 0.1]], -0.012, 0.012, { bevel: 0.001, holes: [[[0.268, BY + R + 0.022], [0.274, BY + R + 0.022], [0.274, BY + R + 0.09], [0.268, BY + R + 0.09]]] }), S.steel2);
    for (let i = 0; i < 6; i++) K.add(M.metal, cbox(-0.012, BY + R + 0.03 + i * 0.011, 0.269, -0.006, BY + R + 0.032 + i * 0.011, 0.273, 0.0004), S.bright);
    K.add(M.metal, cbox(-0.008, BY + R + 0.056, 0.2675, 0.008, BY + R + 0.064, 0.2745, 0.001), S.steel3);
    K.add(M.metal, plate(rounded([[0.54, BY + R + 0.005], [0.562, BY + R + 0.005], [0.556, BY + R + 0.03], [0.546, BY + R + 0.03]], 0.002, 2), -0.003, 0.003, { bevel: 0.001 }), S.steel2);
    // --- the dart in its mouth
    paperPlane(K, M, 0, BY, 0.56, 0.92, S.paper, S.label);
    return { muzzle: new THREE.Vector3(0, BY, 0.62), length: 1.1, hold: new THREE.Vector3(0, BY - R - 0.03, 0.28) };
  },

  // ---------------------------------------------------------------------------------------------- the marker laser
  // A beam rifle built round a fat highlighter: its yellow body is the cell, the ink's glow showing in a window down
  // each side; a dark head with cooling fins holds the chisel of felt it shines out of. On it what a rifle has: a grip
  // and trigger, a wire butt, a tube sight on a rail, a lead from the cell to the head.
  laser(K, M) {
    const S = INK;
    const LY = 0.052;
    // --- the body: a highlighter - its cap end behind, a clip on it, the windows of glowing ink
    K.add(M.paint, lathe([[-0.2, 0.0], [-0.2, 0.036], [-0.192, 0.042], [0.3, 0.042], [0.31, 0.036]], { y: LY, segs: 18 }), S.hiYellow);
    K.add(M.paint, lathe([[-0.26, 0.0], [-0.26, 0.038], [-0.252, 0.045], [-0.14, 0.045], [-0.134, 0.042]], { y: LY, segs: 18 }), S.steel);
    for (let i = 0; i < 6; i++) K.add(M.paint, lathe([[-0.244 + i * 0.017, 0.0458], [-0.236 + i * 0.017, 0.0458]], { y: LY, segs: 18 }), S.steel2);
    for (const s of [1, -1]) {
      K.add(M.glow, plate(rounded([[-0.1, LY - 0.012], [0.26, LY - 0.012], [0.26, LY + 0.012], [-0.1, LY + 0.012]], 0.008, 3), s * 0.0405, s * 0.0428, { bevel: 0.0006 }), S.hiGlow);
      for (let i = 0; i < 7; i++) K.add(M.matte, cbox(s * 0.0428 - 0.0004, LY - 0.012, -0.06 + i * 0.045, s * 0.0428 + 0.0004, LY + 0.012, -0.056 + i * 0.045, 0.0002), S.steel);
    }
    K.add(M.matte, plate(rounded([[-0.08, LY + 0.0405], [0.12, LY + 0.0405], [0.12, LY + 0.0425], [-0.08, LY + 0.0425]], 0.001, 2), -0.016, 0.016, { bevel: 0.0005 }), S.label);
    // --- the head: dark, finned; the chisel of felt alight in it
    K.add(M.paint, lathe([[0.31, 0.036], [0.316, 0.04], [0.42, 0.034], [0.47, 0.024], [0.476, 0.02], [0.476, 0.0]], { y: LY, segs: 18 }), S.steel);
    for (let i = 0; i < 7; i++) K.add(M.metal, lathe([[0.326 + i * 0.013, 0.0], [0.326 + i * 0.013, 0.047 - i * 0.0016], [0.331 + i * 0.013, 0.047 - i * 0.0016], [0.331 + i * 0.013, 0.0]], { y: LY, segs: 18 }), S.steel2);
    K.add(M.glow, tilted(cbox(-0.012, LY - 0.02, 0.476, 0.012, LY + 0.02, 0.56, 0.003), 0.0, LY, 0.5), S.hiGlow);
    K.add(M.glow, plate([[0.56, LY - 0.02], [0.59, LY - 0.02], [0.59, LY - 0.012], [0.572, LY + 0.02], [0.56, LY + 0.02]], -0.012, 0.012, { bevel: 0.002 }), S.hiGlow);
    // --- the grip and trigger, hung under it on a bracket; the wire butt
    K.add(M.metal, plate(rounded([[-0.08, LY - 0.05], [0.1, LY - 0.05], [0.1, LY - 0.036], [-0.08, LY - 0.036]], 0.003, 2), -0.015, 0.015, { bevel: 0.003 }), S.steel2);
    for (const z of [-0.06, 0.08]) K.add(M.metal, lathe([[z - 0.01, 0.0432], [z + 0.01, 0.0432]], { y: LY, segs: 18 }), S.steel3);
    const grip = rounded([[-0.054, 0.004], [-0.004, 0.004], [-0.028, -0.106], [-0.08, -0.11], [-0.092, -0.094]], 0.012, 4);
    K.add(M.matte, plate(grip, -0.014, 0.014, { bevel: 0.006, bs: 2 }), S.polymer);
    for (const s of [1, -1]) for (let i = 0; i < 7; i++) K.add(M.matte, plate([[-0.07 - i * 0.002, -0.02 - i * 0.012], [-0.032 - i * 0.004, -0.02 - i * 0.012], [-0.033 - i * 0.004, -0.024 - i * 0.012], [-0.071 - i * 0.002, -0.024 - i * 0.012]], s * 0.0138, s * 0.0149, { bevel: 0.0005 }), S.steel);
    triggerGuard(K, M, 0.0, 0.088, 0.002, 0.042, S.steel2);
    for (const s of [1, -1]) K.add(M.metal, pipe([[s * 0.02, LY - 0.03, -0.25], [s * 0.022, LY - 0.03, -0.44], [s * 0.02, LY - 0.07, -0.46], [s * 0.016, LY - 0.13, -0.45]], 0.0046, { steps: 24, tension: 0.25, segs: 6 }), S.steel2);
    K.add(M.round, plate(rounded([[-0.476, LY + 0.01], [-0.452, LY + 0.01], [-0.44, LY - 0.14], [-0.47, LY - 0.14]], 0.006, 3), -0.026, 0.026, { bevel: 0.006, bs: 2 }), S.polymer);
    // --- the sight: a rail, a tube on two rings, its glass; the lead from cell to head
    rail(K, M.metal, -0.08, 0.14, LY + 0.0425, S.steel2, { w: 0.02 });
    K.add(M.metal, lathe([[-0.04, 0.0], [-0.04, 0.0175], [-0.034, 0.019], [0.1, 0.019], [0.106, 0.0175], [0.106, 0.0]], { y: LY + 0.076, segs: 14 }), S.steel);
    K.add(M.glass, lathe([[0.1065, 0.0165], [0.1065, 0.0]], { y: LY + 0.076, segs: 12 }), S.lens);
    K.add(M.glass, lathe([[-0.0405, 0.0], [-0.0405, 0.0165]], { y: LY + 0.076, segs: 12 }), S.lens);
    for (const z of [-0.02, 0.07]) K.add(M.metal, cbox(-0.012, LY + 0.052, z, 0.012, LY + 0.06, z + 0.018, 0.002), S.steel2);
    K.add(M.matte, pipe([[0.03, LY + 0.03, 0.2], [0.05, LY + 0.04, 0.25], [0.05, LY + 0.03, 0.31], [0.032, LY + 0.022, 0.335]], 0.0036, { steps: 16, tension: 0.4, segs: 6 }), S.staplerRed);
    return { muzzle: new THREE.Vector3(0, LY, 0.6), length: 1.08, hold: new THREE.Vector3(0, LY - 0.05, 0.22) };
  },

  // ---------------------------------------------------------------------------------------------- the ruler sword
  // A sword mounted as a katana is - a hilt bound in crossed cord over a pale skin, a brass pommel cap and collar, a
  // round pierced guard, a brass sleeve where the blade leaves it - and the blade a long boxwood ruler, its marks and
  // its numbers cut along it, a strip of steel let into its edge, its end cut on a slant.
  katana(K, M) {
    const S = INK;
    // --- the hilt: the core, the binding's diamonds, the cap and the collar
    K.add(M.round, lathe([[-0.2, 0.0], [-0.2, 0.019], [0.03, 0.02], [0.03, 0.0]], { segs: 8 }).scale(0.72, 1, 1), S.label);
    for (let i = 0; i < 9; i++) {
      const z = -0.186 + i * 0.024;
      for (const s of [1, -1]) {
        K.add(M.matte, plate([[z, -0.02], [z + 0.012, 0.0], [z, 0.02], [z + 0.008, 0.02], [z + 0.02, 0.0], [z + 0.008, -0.02]], s * 0.0136, s * 0.0152, { bevel: 0.0005 }), S.polymer);
        K.add(M.matte, plate([[z + 0.012, -0.02], [z + 0.024, 0.0], [z + 0.012, 0.02], [z + 0.02, 0.02], [z + 0.032, 0.0], [z + 0.02, -0.02]], s * 0.0136, s * 0.0152, { bevel: 0.0005 }), S.polymer);
      }
      K.add(M.matte, cbox(-0.0148, 0.0186, z, 0.0148, 0.0206, z + 0.016, 0.0006), S.polymer);
      K.add(M.matte, cbox(-0.0148, -0.0206, z + 0.004, 0.0148, -0.0186, z + 0.02, 0.0006), S.polymer);
    }
    K.add(M.metal, lathe([[-0.222, 0.0], [-0.222, 0.016], [-0.216, 0.0215], [-0.198, 0.0215], [-0.198, 0.0]], { segs: 10 }).scale(0.76, 1, 1), S.gold);
    K.add(M.metal, lathe([[0.024, 0.0], [0.024, 0.0225], [0.044, 0.0225], [0.044, 0.0]], { segs: 10 }).scale(0.76, 1, 1), S.gold);
    for (const s of [1, -1]) K.add(M.metal, plate(rounded([[-0.11, -0.006], [-0.086, -0.01], [-0.07, 0.0], [-0.086, 0.01], [-0.11, 0.006]], 0.003, 2), s * 0.0152, s * 0.0166, { bevel: 0.0006 }), S.gold);
    // --- the guard: a disc, pierced with four leaves; the sleeve on the blade
    const tsuba = lathe([[0.044, 0.0], [0.044, 0.05], [0.047, 0.054], [0.052, 0.054], [0.055, 0.05], [0.055, 0.0]], { segs: 20 });
    K.add(M.metal, tsuba, S.steel2);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      K.add(M.matte, lathe([[0.0436, 0.0], [0.0436, 0.009], [0.0554, 0.009], [0.0554, 0.0]], { segs: 8 }).translate(Math.cos(a) * 0.034, Math.sin(a) * 0.034, 0), S.black);
    }
    K.add(M.metal, lathe([[0.043, 0.047], [0.043, 0.0555], [0.056, 0.0555], [0.056, 0.047]], { segs: 20 }), S.gold);
    K.add(M.metal, plate([[0.055, -0.034], [0.088, -0.036], [0.088, 0.036], [0.055, 0.034]], -0.0062, 0.0062, { bevel: 0.0015 }), S.gold);
    // --- the blade: the ruler, its slanted end, the steel in its edge; the marks, a number at every ten
    const blade = [[0.088, -0.036], [1.02, -0.036], [1.06, 0.0], [1.04, 0.036], [0.088, 0.036]];
    K.add(M.paint, plate(blade, -0.0046, 0.0046, { bevel: 0.0014 }), S.ruler);
    K.add(M.metal, plate([[0.088, -0.0395], [1.022, -0.0395], [1.062, 0.0005], [1.056, 0.0005], [1.02, -0.035], [0.088, -0.035]], -0.0022, 0.0022, { bevel: 0.0008 }), S.bright);
    for (const s of [1, -1]) {
      for (let i = 0; i < 90; i++) {
        const z = 0.1 + i * 0.01;
        const h = i % 10 === 0 ? 0.022 : i % 5 === 0 ? 0.015 : 0.009;
        K.box(M.matte, s * 0.0046 - 0.0003, 0.036 - h, z, s * 0.0046 + 0.0003, 0.0345, z + 0.0016, S.lead);
      }
      for (let i = 0; i < 9; i++) K.box(M.matte, s * 0.0046 - 0.0003, 0.002, 0.103 + i * 0.1, s * 0.0046 + 0.0003, 0.011, 0.11 + i * 0.1, S.lead);
      // (the hole it hangs by)
      const hole = lathe([[0.0046, 0.0], [0.0046, 0.007], [0.0049, 0.007], [0.0049, 0.0]], { axis: 'x', y: -0.012, z: 0.98, segs: 10 });
      K.add(M.matte, s > 0 ? hole : mirrored(hole), S.black);
    }
    return { tip: new THREE.Vector3(0, 0, 1.06), length: 1.29 };
  },

  // ---------------------------------------------------------------------------------------------- the ink grenade
  // A bottle of ink - thick blue glass, flat shoulders, its label - fused as a grenade is: a steel fuze screwed into its
  // neck, the lever that flies off down its side, the ring and its pin through the fuze.
  inkbomb(K, M) {
    const S = INK;
    // --- the bottle: its foot, its body, the shoulders, the neck; the ink's level; the label
    K.add(M.glass, lathe([[-0.058, 0.0], [-0.058, 0.04], [-0.052, 0.046], [0.03, 0.046], [0.05, 0.03], [0.056, 0.022], [0.07, 0.022]], { axis: 'y', segs: 8, soft: 2 }), S.inkGlass);
    K.add(M.glass, lathe([[0.07, 0.022], [0.07, 0.026], [0.078, 0.026], [0.078, 0.0]], { axis: 'y', segs: 12 }), S.inkGlass);
    K.add(M.matte, lathe([[-0.036, 0.0465], [0.014, 0.0465]], { axis: 'y', segs: 8, soft: 2 }), S.label);
    K.add(M.matte, lathe([[-0.024, 0.047], [-0.012, 0.047]], { axis: 'y', segs: 8, soft: 2 }), S.inkGlass);
    K.add(M.matte, lathe([[-0.004, 0.047], [0.0, 0.047]], { axis: 'y', segs: 8, soft: 2 }), S.lead);
    // --- the fuze: its body, the striker's housing, the lever down the side, the pin and its ring
    K.add(M.metal, lathe([[0.078, 0.0], [0.078, 0.0235], [0.09, 0.0235], [0.094, 0.018], [0.118, 0.016], [0.124, 0.012], [0.124, 0.0]], { axis: 'y', segs: 12 }), S.steel2);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      K.add(M.metal, rod([Math.cos(a) * 0.0238, 0.079, Math.sin(a) * 0.0238], [Math.cos(a) * 0.0238, 0.089, Math.sin(a) * 0.0238], 0.002, 0.002, 4), S.steel3);
    }
    K.add(M.metal, cbox(-0.008, 0.112, -0.02, 0.008, 0.13, 0.014, 0.002), S.steel3);
    K.add(M.metal, plate(rounded([[-0.022, 0.134], [0.02, 0.128], [0.05, 0.1], [0.056, 0.02], [0.05, -0.03], [0.045, -0.03], [0.05, 0.02], [0.045, 0.096], [0.018, 0.122], [-0.022, 0.128]], 0.004, 2), -0.009, 0.009, { bevel: 0.001 }), S.steel3);
    K.add(M.metal, rod([-0.016, 0.119, -0.012], [0.016, 0.119, -0.012], 0.0018, 0.0018, 5), S.bright);
    K.add(M.metal, pipe(Array.from({ length: 13 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return [-0.016 - 0.0, 0.119 + Math.sin(a) * 0.017 - 0.017, -0.012 - 0.002 + (Math.cos(a) - 1) * 0.017]; }), 0.0016, { steps: 28, segs: 5, closed: true }), S.bright);
    return { muzzle: new THREE.Vector3(0, 0.05, 0.05), length: 0.2 };
  },

  // ---------------------------------------------------------------------------------------------- the boomerang scissors
  // A pair of shears as they are made: two ground blades crossing on a screw, each with its bevel and its point; the
  // handles moulded on - a long loop for the fingers, a round one for the thumb - one red, one blue. Open, to fly.
  boomerang(K, M) {
    const S = INK;
    const half = (s, col) => {
      const a = s * 0.3;
      const turn = (g) => g.rotateY(a);
      // (its blade: ground flat, a bevel along the edge, to a point)
      const bl = new THREE.Shape();
      bl.moveTo(-0.012, -0.03);
      bl.lineTo(0.016, -0.03);
      bl.lineTo(0.014, 0.2);
      bl.lineTo(0.002, 0.3);
      bl.lineTo(-0.012, 0.2);
      bl.closePath();
      const g = new THREE.ExtrudeGeometry(bl, { depth: 0.0036, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 });
      g.rotateX(Math.PI / 2);
      g.translate(0, 0.0018 + s * 0.0026, 0);
      if (s < 0) g.scale(-1, 1, 1);
      K.add(M.metal, turn(s < 0 ? flip(g) : g), S.bright);
      K.add(M.metal, turn(cbox(s * 0.009, s * 0.0026 + 0.0032, 0.0, s * 0.0155, s * 0.0026 + 0.0042, 0.2, 0.0004)), S.steel3);
      // (its handle: the shank, the loop)
      K.add(M.paint, turn(pipe([[s * -0.004, s * 0.0026, -0.02], [s * -0.012, s * 0.0026, -0.06], [s * -0.03, s * 0.0026, -0.09]], 0.008, { steps: 10, segs: 8 })), col);
      const loop = s > 0 ? [0.03, 0.05] : [0.024, 0.026];
      K.add(M.paint, turn(pipe(Array.from({ length: 16 }, (_, k) => { const t = (k / 16) * Math.PI * 2; return [s * -0.036 + Math.cos(t) * loop[0] * 0.8 * -s, s * 0.0026, -0.09 - loop[1] + Math.sin(t) * loop[1]]; }), 0.0075, { steps: 40, segs: 8, closed: true })), col);
    };
    half(1, S.staplerRed);
    half(-1, C(0.16, 0.36, 0.78));
    K.add(M.metal, lathe([[-0.007, 0.0], [-0.007, 0.0085], [-0.004, 0.0105], [0.008, 0.0105], [0.011, 0.0085], [0.011, 0.0]], { axis: 'y', segs: 10 }), S.steel2);
    K.add(M.matte, cbox(-0.006, 0.011, -0.0012, 0.006, 0.0116, 0.0012, 0.0002), S.black);
    return { tip: new THREE.Vector3(0, 0, 0.32), length: 0.48 };
  },

  // ---------------------------------------------------------------------------------------------- the cardboard shield
  // A riot shield cut from a packing case: two layers of corrugated board, the flutes showing at its cut edges, taped
  // across and stapled round, a slot to look through with a strip of clear film behind it, the shipper's marks still
  // on its face; behind, a strap for the forearm and a grip for the hand. (Its face is the +x side.)
  shield(K, M) {
    const S = INK;
    const body = rounded([[-0.3, -0.4], [0.3, -0.4], [0.3, 0.36], [0.26, 0.4], [-0.26, 0.4], [-0.3, 0.36]], 0.03, 4);
    const slot = rounded([[-0.14, 0.2], [0.14, 0.2], [0.14, 0.26], [-0.14, 0.26]], 0.012, 3);
    K.add(M.round, plate(body, -0.012, 0.012, { bevel: 0.002, holes: [slot] }), S.kraft);
    K.add(M.round, plate(rounded([[-0.27, -0.37], [0.27, -0.37], [0.27, 0.34], [0.24, 0.37], [-0.24, 0.37], [-0.27, 0.34]], 0.026, 4), 0.012, 0.018, { bevel: 0.002, holes: [slot] }), S.kraft);
    K.add(M.glass, cbox(-0.004, 0.19, -0.15, -0.001, 0.27, 0.15, 0.0005), S.glassc);
    // (the flutes at its edges)
    for (let i = 0; i < 28; i++) {
      K.add(M.matte, cbox(-0.0122, -0.4005, -0.27 + i * 0.02, 0.0122, -0.398, -0.262 + i * 0.02, 0.0004), S.kraft2);
      K.add(M.matte, cbox(-0.0122, 0.398, -0.25 + i * 0.0185, 0.0122, 0.4005, -0.242 + i * 0.0185, 0.0004), S.kraft2);
    }
    // (tape: across the middle, down it; a torn end)
    K.add(M.matte, cbox(0.018, -0.04, -0.3, 0.0192, 0.04, 0.3, 0.0004), S.tape);
    K.add(M.matte, cbox(0.0192, -0.39, -0.035, 0.0202, 0.2, 0.035, 0.0004), S.tape);
    K.add(M.matte, plate([[0.2, 0.3], [0.27, 0.3], [0.27, 0.34], [0.215, 0.345], [0.2, 0.33]], 0.018, 0.0192, { bevel: 0.0003 }), S.tape);
    // (staples round it; the shipper's marks: a glass, two arrows, a stencilled number)
    for (let i = 0; i < 9; i++) for (const y of [-0.36, 0.33]) K.add(M.metal, cbox(0.018, y, -0.24 + i * 0.06, 0.0195, y + 0.004, -0.22 + i * 0.06, 0.0004), S.bright);
    for (let i = 0; i < 8; i++) for (const z of [-0.262, 0.258]) K.add(M.metal, cbox(0.018, -0.3 + i * 0.085, z, 0.0195, -0.28 + i * 0.085, z + 0.004, 0.0004), S.bright);
    K.add(M.matte, plate([[-0.2, -0.3], [-0.12, -0.3], [-0.14, -0.22], [-0.11, -0.16], [-0.21, -0.16], [-0.18, -0.22]], 0.018, 0.0188, { bevel: 0.0002 }), S.staplerRed);
    for (const z of [0.1, 0.18]) {
      K.add(M.matte, plate([[z, -0.3], [z + 0.02, -0.3], [z + 0.02, -0.22], [z + 0.036, -0.22], [z + 0.01, -0.17], [z - 0.016, -0.22], [z, -0.22]], 0.018, 0.0188, { bevel: 0.0002 }), S.lead);
    }
    for (let i = 0; i < 5; i++) K.add(M.matte, cbox(0.018, 0.1, -0.2 + i * 0.03, 0.0188, 0.14, -0.182 + i * 0.03, 0.0003), S.lead);
    // --- behind: the strap for the forearm, the grip
    K.add(M.matte, pipe([[-0.012, 0.1, -0.12], [-0.07, 0.09, -0.11], [-0.07, -0.03, -0.11], [-0.012, -0.04, -0.12]], 0.008, { steps: 16, tension: 0.2, segs: 6 }), S.polymer);
    K.add(M.matte, pipe([[-0.012, 0.06, 0.0], [-0.06, 0.05, 0.0], [-0.06, -0.05, 0.0], [-0.012, -0.06, 0.0]], 0.012, { steps: 16, tension: 0.2, segs: 8 }), S.polymer);
    for (const [y, z] of [[0.1, -0.12], [-0.04, -0.12], [0.06, 0.0], [-0.06, 0.0]]) K.add(M.metal, cbox(-0.0145, y - 0.016, z - 0.016, -0.012, y + 0.016, z + 0.016, 0.002), S.steel3);
    return { tip: new THREE.Vector3(0.1, 0, 0), length: 0.6 };
  },

  // ---------------------------------------------------------------------------------------------- the giant school eraser
  // The two-colour eraser of the police: pink for pencil, blue for ink, the edge between them cut on a slant; a paper
  // sleeve round its middle with the maker's band printed on it; its corners rubbed round with use.
  bigEraser(K, M) {
    const S = INK;
    const w = 0.075;
    const h = 0.045;
    K.add(M.round, plate(rounded([[-0.02, -h], [0.19, -h], [0.15, h], [-0.02, h]], 0.012, 3), -w, w, { bevel: 0.012, bs: 2 }), S.eraser);
    K.add(M.round, plate(rounded([[0.19, -h], [0.34, -h], [0.34, h], [0.15, h]], 0.012, 3), -w, w, { bevel: 0.012, bs: 2 }), S.blueRubber);
    K.add(M.matte, plate(rounded([[0.08, -h - 0.003], [0.24, -h - 0.003], [0.24, h + 0.003], [0.08, h + 0.003]], 0.006, 3), -w - 0.003, w + 0.003, { bevel: 0.008, bs: 2 }), S.paper);
    for (const s of [1, -1]) {
      K.add(M.matte, plate([[0.092, -0.026], [0.228, -0.026], [0.228, 0.026], [0.092, 0.026]], s * (w + 0.003), s * (w + 0.0036), { bevel: 0.0003, r: 0.004 }), S.tin);
      K.add(M.matte, plate([[0.106, -0.008], [0.214, -0.008], [0.214, 0.008], [0.106, 0.008]], s * (w + 0.0036), s * (w + 0.004), { bevel: 0.0002 }), S.paper);
    }
    K.add(M.matte, cbox(-0.05, h + 0.003, 0.092, 0.05, h + 0.0036, 0.228, 0.0003), S.tin);
    for (let i = 0; i < 5; i++) K.add(M.matte, cbox(-0.04, h + 0.0036, 0.104 + i * 0.024, 0.04, h + 0.004, 0.112 + i * 0.024, 0.0002), S.paper);
    return { tip: new THREE.Vector3(0, 0, 0.34), length: 0.38 };
  },

  // ---------------------------------------------------------------------------------------------- the pencil
  // The pencil it all starts with: six lacquered sides and the maker's band stamped in gold near its end, a ferrule
  // crimped on with two rings, a rubber that has seen use; cut to a point - the paint's edge left in scallops by the
  // sharpener, pale cedar, the lead. (The rubber is its +z end; it is held near the point.)
  pencil(K, M) {
    const S = INK;
    const r = 0.05;
    K.add(M.paint, hexbar(-0.16, 0.78, r, r), S.yellow);
    K.add(M.matte, hexbar(0.58, 0.72, r * 1.006, r * 1.006), S.staplerRed);
    for (const z of [0.585, 0.71]) K.add(M.matte, hexbar(z, z + 0.004, r * 1.012, r * 1.012), S.gold);
    for (let i = 0; i < 7; i++) K.add(M.matte, cbox(-0.004, r * 0.866 * 1.006, 0.6 + i * 0.015, 0.004, r * 0.866 * 1.006 + 0.0008, 0.608 + i * 0.015, 0.0003), S.gold);
    for (let i = 0; i < 12; i++) K.add(M.matte, cbox(-0.006, r * 0.866, 0.2 + i * 0.022, 0.006, r * 0.866 + 0.0008, 0.212 + i * 0.022, 0.0003), S.gold);
    // (the point: a round cone through the six sides - scallops where they meet)
    K.add(M.round, lathe([[-0.176, r * 0.985], [-0.32, 0.016]], { segs: 18 }), S.tipwood);
    K.add(M.round, lathe([[-0.32, 0.016], [-0.362, 0.002], [-0.362, 0.0]], { segs: 12 }), S.lead);
    // (the ferrule, its two crimped rings, the knurl between them; the rubber, rounded off)
    K.add(M.metal, lathe([[0.78, 0.0], [0.78, r * 1.06], [0.872, r * 1.06], [0.872, 0.0]], { segs: 18 }), S.brass);
    for (const z of [0.794, 0.85]) K.add(M.metal, lathe([[z, r * 1.06], [z + 0.003, r * 1.1], [z + 0.009, r * 1.1], [z + 0.012, r * 1.06]], { segs: 18 }), S.steel3);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      K.add(M.metal, rod([Math.cos(a) * r * 1.065, Math.sin(a) * r * 1.065, 0.812], [Math.cos(a) * r * 1.065, Math.sin(a) * r * 1.065, 0.844], 0.0022, 0.0022, 4), S.steel3);
    }
    K.add(M.round, lathe([[0.872, r * 0.98], [0.96, r * 0.98], [0.984, r * 0.86], [0.996, r * 0.6], [1.0, 0.0]], { segs: 16 }), S.eraser);
    return { tip: new THREE.Vector3(0, 0, 1.0), length: 1.1 };
  },
};
