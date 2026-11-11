import * as THREE from 'three';
import { Kit, itemMats, linC, ERASER_PINK } from '../items.js';
import { makeSurface, canvasTexture, surfaceVariant, sortDefines, srgb } from '../../render/materials.js';
import { Sketcher, makeCanvas, FONT_UI, FONT_SIGN, BLACK2D } from '../../render/sketch2d.js';
import { letter } from '../../world/letters.js';
import { kidLook, civilianLook } from '../looks.js';
import { CarPark } from './carpark.js';

// (5th Street Garage and Bayshore Parking across the street from it: the chase's car park, the one
// the director is moving to - game/prologue/carpark.js)
export { PARK } from './carpark.js';

// (v5, ROADMAP 18) The prologue's own pieces of the city, set up for its last sunset and taken
// down after it:
//  - the Sunset Wheel at the pier, the biggest wheel the city ever had (48 m across, its hub 29 m
//    up), turning slowly with its lights on, every gondola full: mostly kids, at the windows,
//    waving; their parents with them, teenagers filming; more parents down on the pier, waving
//    back. Until it is rubbed out (erase(): an eraser over it, row by row, two and a half seconds -
//    the paper coming through, crumbs flying - and then the sky where it was);
//  - Sunset Scoops, the ice cream stand at the pier's gate, where Lily waits;
//  - Michael Cruz's campaign boards (his face from his sheet, his name, his slogan);
//  - 5th Street Garage, inland in the middle of the city, and Bayshore Parking across 5th Street
//    from it (carpark.js): the chase goes up the one and the car flies across to the roof of the
//    other. (The two smaller car parks out at the island's southern tip it replaced are gone.)
//
// The wheel stands across the pier at an angle (its axle pointing east-north-east), so that its
// face is seen from the promenade and the pier's gate, and from the beach south of the pier with
// the sunset behind it (the evening sun is low in the north, a little east: game/daynight.js).

export const WHEEL = { x: 128, z: 243, deck: 0.35, R: 26, hubUp: 32.5, yaw: Math.asin(0.6), n: 26, spin: 0.028 };
export const STAND = { x: 36.5, z: 228.5 };
const FLOOR = 3.4; // a gondola's floor under its pivot

const GOND_C = [
  [0.98, 0.42, 0.55], [0.2, 0.74, 0.76], [1.0, 0.8, 0.26], [0.6, 0.42, 0.9], [0.4, 0.78, 0.38], [0.99, 0.56, 0.2],
  [0.92, 0.26, 0.3], [0.3, 0.52, 0.95],
].map(([r, g, b]) => linC(r, g, b));
const RIM_C = [linC(1, 0.35, 0.6), linC(0.3, 0.85, 1), linC(1, 0.85, 0.3)];

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UPV = new THREE.Vector3(0, 1, 0);
const _w2 = new THREE.Vector3();
const _w3 = new THREE.Vector3();
// the eraser: its mask's pixels and how many metres it covers either side of the hub; its grid for
// the riders; how wide it is (metres), how long it takes, how many rows, how quick its rubbing
// and how much one going-over of it takes off (the colours go at ~0.3, the lines at ~0.75+)
// (ROADMAP 18.9: five seconds, a row a second - long enough to be seen happening, with the pencil
// whose eraser does it)
const ERASE = { px: 256, half: 35, grid: 64, w: 15, T: 7, rows: 6, hz: 4.2, pass: 0.5 };
// (the giant pencil: its eraser end's radius, how far in front of the wheel - the city's side - its
// tip rubs, how long it takes to come down out of the sky and to go back up into it)
const PENCIL = { r: 4, front: 5.5, down: 1.8, up: 1.1 };
// (the pencil not shown for now - the erasing alone, made plain on the wheel itself: ?pencil=1 to see it)
const PENCIL_SHOWN = typeof location !== 'undefined' && new URLSearchParams(location.search).get('pencil') === '1';
const HUB = new THREE.Vector3();
// (crumbs: the eraser's grey and pink, the paper's white, a bit of the wheel's own colours)
const CRUMB = [[0.62, 0.6, 0.62], [0.85, 0.62, 0.66], [0.96, 0.95, 0.92], [0.5, 0.48, 0.52], [0.98, 0.45, 0.62], [0.35, 0.72, 0.8]];

// a round beam from a to b (in the Kit's frame)
function beam(K, mat, a, b, r, color, segs = 8) {
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _v.length();
  const g = new THREE.CylinderGeometry(r, r, len, segs, 1);
  _q.setFromUnitVectors(UPV, _v.normalize());
  g.applyQuaternion(_q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return K.add(mat, g, color);
}

// a ring round the x axis (the wheel's axle) at x = s
function ring(K, mat, R, r, s, color, segs = 120) {
  const g = new THREE.TorusGeometry(R, r, 6, segs);
  g.rotateY(Math.PI / 2);
  g.translate(s, 0, 0);
  return K.add(mat, g, color);
}

// a drum along the x axis (the axle) from x0 (radius r0) to x1 (radius r1)
function drum(K, mat, r0, r1, x0, x1, color, segs = 20) {
  const g = new THREE.CylinderGeometry(r1, r0, Math.abs(x1 - x0), segs, 1);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return K.add(mat, g, color);
}

// the neon of the wheel: pens of its own, so that its lights can chase round it
function neon(k = 2.2) {
  return makeSurface({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.95, 0.9), emissive: new THREE.Color(k, k, k), line: 0.4 });
}

export class PrologueSet {
  constructor(game) {
    this.game = game;
    this.built = false;
    this.cols = [];
    this.objs = [];
    this.t = 0;
    this.angle = 0;
    this.riders = [];
    this.below = [];
    this.erasing = null;
    this.wheelGone = false;
    this.wheelCols = [];
    // (the old car parks at the southern tip: gone, 5th Street Garage in their place)
    this.garages = [];
    this.park = new CarPark(game);
  }

  // ------------------------------------------------------------------ all of it
  // (the wheel only until the prologue has rubbed it out: after that, never again)
  build(o = {}) {
    if (this.built) return;
    this.built = true;
    const g = this.game;
    const col = g.world.collision;
    if (o.wheel !== false) this.buildWheel();
    else this.wheelGone = true;
    this.buildStand();
    this.buildBoards();
    this.buildBoats();
    // the car parks, and the street between them
    const M = itemMats();
    const K = new Kit();
    for (const gar of this.garages) gar.build(K, M, col);
    const grp = K.build({ seed: 0.43 });
    grp.updateMatrix();
    g.scene.add(grp);
    this.objs.push(grp);
    this.park.build();
  }

  add(obj) {
    obj.updateMatrix();
    this.game.scene.add(obj);
    this.objs.push(obj);
    return obj;
  }

  addCol(...a) {
    this.cols.push(this.game.world.collision.addBox(...a));
  }

  // ------------------------------------------------------------------ the Sunset Wheel
  buildWheel() {
    const W = WHEEL;
    const M = itemMats();
    const hubY = W.deck + W.hubUp;
    const R = W.R;
    const N = W.n;
    // (its own neon pens: three strings of lights that take turns, the rims' bulbs)
    this.neon = [neon(), neon(), neon()];
    const root = new THREE.Group();
    root.position.set(W.x, hubY, W.z);
    root.rotation.y = W.yaw;
    this.root = root;
    // ---- what turns: the two rims and their inner rings, the trusses between, the spokes, the hub
    const K = new Kit();
    const STEEL = linC(0.96, 0.95, 0.97);
    const STEEL_D = linC(0.62, 0.6, 0.68);
    const PINK = linC(0.98, 0.42, 0.62);
    const S = 2.3;
    for (const s of [-S, S]) {
      ring(K, M.metal, R, 0.3, s, STEEL);
      ring(K, M.metal, R - 1.7, 0.18, s, STEEL);
      ring(K, M.paint, 3.4, 0.32, s * 1.35, PINK, 40);
      // the truss between the rim and the inner ring: a zigzag
      for (let k = 0; k < N * 2; k++) {
        const a0 = (k / (N * 2)) * Math.PI * 2;
        const a1 = ((k + 1) / (N * 2)) * Math.PI * 2;
        const rA = k % 2 ? R : R - 1.7;
        const rB = k % 2 ? R - 1.7 : R;
        beam(K, M.metal, [s, Math.cos(a0) * rA, Math.sin(a0) * rA], [s, Math.cos(a1) * rB, Math.sin(a1) * rB], 0.07, STEEL, 5);
      }
      // the spokes, hub to the inner ring, crossing a little (a wheel of cables)
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2;
        const b = a + 0.12;
        beam(K, M.metal, [s * 1.35, Math.cos(a) * 3.4, Math.sin(a) * 3.4], [s, Math.cos(b) * (R - 1.7), Math.sin(b) * (R - 1.7)], 0.06, STEEL, 5);
      }
    }
    // the bars the gondolas hang from, rim to rim
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2;
      const y = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      beam(K, M.metal, [-S, y, z], [S, y, z], 0.12, STEEL_D, 8);
    }
    // the hub: a drum, its caps in the wheel's colours
    drum(K, M.paint, 2.1, 2.1, -1.6, 1.6, PINK, 24);
    for (const s of [-1, 1]) drum(K, M.paint, 2.3, 1.2, s * 1.6, s * 2.9, linC(1, 0.84, 0.3), 24);
    const hubG = K.build({ seed: 0.29 });
    // the lights: bulbs round both rims in three strings, tubes of light along the spokes
    const KL = new Kit();
    for (const s of [-S - 0.32, S + 0.32]) {
      const nb = 160;
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * Math.PI * 2;
        const y = Math.cos(a) * R;
        const z = Math.sin(a) * R;
        KL.box(this.neon[i % 3], s - 0.15, y - 0.15, z - 0.15, s + 0.15, y + 0.15, z + 0.15, RIM_C[i % 3]);
      }
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2;
        const b = a + 0.12;
        const ss = s > 0 ? s - 0.25 : s + 0.25;
        beam(KL, this.neon[k % 3], [ss * 1.3, Math.cos(a) * 3.8, Math.sin(a) * 3.8], [ss, Math.cos(b) * (R - 2.0), Math.sin(b) * (R - 2.0)], 0.09, RIM_C[(k + 1) % 3], 4);
      }
      // the hub's ring of light
      const hr = new THREE.TorusGeometry(3.4, 0.12, 5, 40).rotateY(Math.PI / 2).translate(Math.sign(s) * 3.25, 0, 0);
      KL.add(this.neon[2], hr, linC(1, 0.9, 0.6));
    }
    // the hub's face: a star of light on each side, turning with it
    for (const sx of [-1, 1]) {
      const hx = sx * 3.0;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        beam(KL, this.neon[k % 3], [hx, Math.cos(a) * 0.4, Math.sin(a) * 0.4], [hx, Math.cos(a) * (k % 2 ? 1.6 : 2.6), Math.sin(a) * (k % 2 ? 1.6 : 2.6)], 0.06, RIM_C[k % 3], 4);
      }
      KL.sphere(this.neon[1], 0.32, hx * 1.02, 0, 0, linC(1, 0.95, 0.7), 0.4, 1, 1, 10);
    }
    const lights = KL.build({ seed: 0.71 });
    const spin = new THREE.Group();
    spin.add(hubG);
    spin.add(lights);
    root.add(spin);
    this.spin = spin;
    // ---- what stands: two A-frames, their feet on footings in the water beside the pier, the axle
    const KS = new Kit();
    const footY = W.deck - hubY;
    const LEG = linC(0.9, 0.9, 0.94);
    for (const s of [-3.9, 3.9]) {
      for (const f of [-10.5, 10.5]) {
        beam(KS, M.metal, [s * 0.87, 0, 0], [s, footY, f], 0.45, LEG, 10);
        // (a footing, down into the sea or onto the deck)
        KS.cyl(M.matte, 1.0, 1.1, footY - 3.5, footY + 0.5, linC(0.7, 0.68, 0.66), { axis: 'y', x: s, z: f, segs: 14 });
      }
      // the cross braces of the frame
      beam(KS, M.metal, [s * 0.93, footY * 0.55, -5.8], [s * 0.93, footY * 0.55, 5.8], 0.22, LEG, 8);
      beam(KS, M.metal, [s * 0.97, footY * 0.82, -8.6], [s * 0.97, footY * 0.82, 8.6], 0.2, LEG, 8);
    }
    drum(KS, M.metal, 0.75, 0.75, -3.9, 3.9, STEEL_D, 16);
    const stand = KS.build({ seed: 0.37 });
    root.add(stand);
    // the boarding platform under the wheel's foot (on the pier, square to it), its steps, its
    // booth and the name in lights over the gate
    const KP = new Kit();
    const PL = { x0: 121.5, x1: 134.5, z0: 237.6, z1: 248.4, top: 2.4 };
    this.platform = PL;
    KP.box(M.matte, PL.x0, W.deck, PL.z0, PL.x1, PL.top, PL.z1, linC(0.86, 0.84, 0.8));
    KP.box(M.paint, PL.x0 - 0.05, PL.top - 0.3, PL.z0 - 0.05, PL.x1 + 0.05, PL.top - 0.1, PL.z1 + 0.05, linC(0.98, 0.42, 0.62));
    for (let i = 0; i < 6; i++) KP.box(M.matte, PL.x0 - 0.42 * (i + 1), W.deck, 239.5, PL.x0 - 0.42 * i, PL.top - ((PL.top - W.deck) / 6) * (i + 1) + 0.02, 246.5, linC(0.8, 0.78, 0.74));
    // rails round it (not on the steps)
    for (const z of [PL.z0 + 0.1, PL.z1 - 0.1]) KP.box(M.metal, PL.x0, PL.top, z - 0.04, PL.x1, PL.top + 1.0, z + 0.04, linC(0.95, 0.95, 0.97));
    KP.box(M.metal, PL.x1 - 0.14, PL.top, PL.z0, PL.x1 - 0.06, PL.top + 1.0, PL.z1, linC(0.95, 0.95, 0.97));
    // the queue's rails on the pier before the steps
    for (const z of [238.6, 241.2, 244.8, 247.4]) {
      KP.box(M.metal, 109, W.deck + 0.95, z - 0.03, 119.5, W.deck + 1.0, z + 0.03, linC(0.92, 0.3, 0.42));
      for (let x = 109; x <= 119.5; x += 3.5) KP.cyl(M.metal, 0.04, 0.04, W.deck, W.deck + 1.0, linC(0.85, 0.85, 0.9), { axis: 'y', x, z, segs: 6 });
    }
    // the ticket booth
    KP.box(M.paint, 113.5, W.deck, 248.5 - 2.4, 116.5, W.deck + 2.6, 249.6, linC(0.2, 0.74, 0.76));
    KP.box(M.glass, 113.7, W.deck + 1.2, 246.05, 116.3, W.deck + 2.2, 246.1, linC(0.6, 0.75, 0.85));
    KP.box(M.paint, 113.2, W.deck + 2.6, 245.8, 116.8, W.deck + 2.9, 249.8, linC(0.98, 0.42, 0.62));
    // the gate: two posts and the name over the way to the steps
    const gx = 107.6;
    for (const z of [237.6, 248.4]) KP.box(M.paint, gx - 0.25, W.deck, z - 0.25, gx + 0.25, W.deck + 6.2, z + 0.25, linC(0.98, 0.42, 0.62));
    KP.box(M.paint, gx - 0.3, W.deck + 5.2, 237.6, gx + 0.3, W.deck + 6.6, 248.4, linC(0.16, 0.14, 0.32));
    const sgH = 0.95;
    letter('SUNSET WHEEL', sgH, (a0, b0, a1, b1) => KP.box(this.neon[1], gx - 0.38, W.deck + 5.42 + b0, 243 + a0, gx - 0.31, W.deck + 5.42 + b1, 243 + a1, linC(1, 0.8, 0.4)));
    // a canopy over the boarding platform on slim posts (striped, lit along its edge), the
    // turnstiles at the top of the steps, the RIDE sign, the operator's console
    {
      const CAN = [linC(0.98, 0.42, 0.62), linC(0.98, 0.95, 0.9)];
      const cy = PL.top + 3.3;
      for (const px of [PL.x0 + 0.3, (PL.x0 + PL.x1) / 2, PL.x1 - 0.3]) {
        for (const pz of [PL.z0 + 0.3, PL.z1 - 0.3]) KP.cyl(M.metal, 0.07, 0.07, PL.top, cy, linC(0.92, 0.92, 0.95), { axis: 'y', x: px, z: pz, segs: 8 });
      }
      for (let i = 0; i < 10; i++) {
        const xa = PL.x0 + (i * (PL.x1 - PL.x0)) / 10;
        const xb = xa + (PL.x1 - PL.x0) / 10;
        for (const [za, zb, tilt] of [[PL.z0, 243, 1], [243, PL.z1, -1]]) {
          const g = new THREE.BoxGeometry(xb - xa, 0.06, zb - za + 0.4);
          g.rotateX(tilt * 0.16);
          g.translate((xa + xb) / 2, cy + 0.42, (za + zb) / 2);
          KP.add(M.paint, g, CAN[i % 2]);
        }
      }
      for (let x = PL.x0 + 0.3; x < PL.x1; x += 0.5) {
        for (const z of [PL.z0 - 0.15, PL.z1 + 0.15]) KP.sphere(this.neon[x % 1.5 < 0.5 ? 0 : 2], 0.06, x, cy - 0.05, z, RIM_C[Math.floor(x * 2) % 3], 1, 1, 1, 6);
      }
      // turnstiles
      for (const tz of [241.0, 245.0]) {
        KP.box(M.metal, PL.x0 + 0.3, PL.top, tz - 0.3, PL.x0 + 0.55, PL.top + 1.0, tz + 0.3, linC(0.75, 0.77, 0.8));
        for (let a = 0; a < 3; a++) {
          const arm = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6).rotateZ(Math.PI / 2);
          arm.rotateX((a * Math.PI * 2) / 3);
          arm.translate(PL.x0 + 0.72, PL.top + 0.85, tz);
          KP.add(M.metal, arm, linC(0.85, 0.85, 0.88));
        }
      }
      // the operator's console with its lit buttons
      KP.box(M.paint, PL.x1 - 1.6, PL.top, PL.z0 + 0.4, PL.x1 - 0.6, PL.top + 1.05, PL.z0 + 1.1, linC(0.18, 0.2, 0.3));
      for (let b = 0; b < 4; b++) KP.box(M.glow, PL.x1 - 1.5 + b * 0.22, PL.top + 1.05, PL.z0 + 0.6, PL.x1 - 1.38 + b * 0.22, PL.top + 1.1, PL.z0 + 0.72, RIM_C[b % 3]);
      // RIDE over the turnstiles, a board of prices by the booth
      letter('RIDE', 0.6, (a0, b0, a1, b1) => KP.box(this.neon[0], PL.x0 + 0.05, cy - 0.95 + b0, 243 + a0, PL.x0 + 0.12, cy - 0.95 + b1, 243 + a1, linC(1, 0.6, 0.75)));
      KP.box(M.paint, 112.4, W.deck + 0.4, 246.2, 113.4, W.deck + 2.2, 246.3, linC(0.98, 0.95, 0.88));
      letter('$6', 0.4, (a0, b0, a1, b1) => KP.box(M.paint, 112.9 + a0, W.deck + 1.6 + b0, 246.15, 112.9 + a1, W.deck + 1.6 + b1, 246.2, linC(0.86, 0.2, 0.3)));
      letter('KIDS $4', 0.2, (a0, b0, a1, b1) => KP.box(M.paint, 112.9 + a0, W.deck + 1.1 + b0, 246.15, 112.9 + a1, W.deck + 1.1 + b1, 246.2, linC(0.2, 0.3, 0.6)));
      // flags on the gate, a little bunting from it to the booth
      for (const z of [237.6, 248.4]) {
        KP.cyl(M.metal, 0.03, 0.03, W.deck + 6.6, W.deck + 8.2, linC(0.9, 0.9, 0.92), { axis: 'y', x: gx, z, segs: 6 });
        const fl = new THREE.BufferGeometry();
        fl.setAttribute('position', new THREE.Float32BufferAttribute([gx, W.deck + 8.1, z, gx, W.deck + 7.5, z, gx - 0.9, W.deck + 7.8, z, gx, W.deck + 8.1, z, gx - 0.9, W.deck + 7.8, z, gx, W.deck + 7.5, z], 3));
        fl.computeVertexNormals();
        fl.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0.5, 0, 0, 1, 0.5, 0, 1], 2));
        KP.add(M.paint, fl, z < 243 ? linC(0.98, 0.42, 0.62) : linC(0.2, 0.74, 0.76));
      }
    }
    const plat = KP.build({ seed: 0.53 });
    this.add(plat);
    this.platG = plat;
    // collision: the platform (its top too high to step onto from the pier, but its steps), the
    // booth, the frames' feet that stand on the pier
    const col = this.game.world.collision;
    this.wheelCols = [col.addBox(PL.x0, PL.z0, PL.x1, PL.z1, -1, PL.top, 'wall'), col.addBox(113.5, 246.1, 116.5, 249.6, -1, W.deck + 2.9, 'wall')];
    for (const z of [237.6, 248.4]) this.wheelCols.push(col.addBox(gx - 0.3, z - 0.3, gx + 0.3, z + 0.3, -1, W.deck + 6.6, 'pole'));
    // (the frames' feet)
    const f = new THREE.Vector3();
    for (const s of [-3.9, 3.9]) {
      for (const fz of [-10.5, 10.5]) {
        f.set(s, 0, fz).applyAxisAngle(UPV, W.yaw);
        this.wheelCols.push(col.addCircle(W.x + f.x, W.z + f.z, 1.1, -3, W.deck + 3, 'pole'));
      }
    }
    // ---- the gondolas: all of them in a few meshes, moved round every frame (they hang level)
    this.buildGondolas(M);
    root.add(this.gond);
    this.add(root);
    root.matrixAutoUpdate = true;
    // ---- the people in them, and the people on the pier waiting and waving
    this.makeRiders();
    this.placeGondolas();
    this.prepErase();
    if (PENCIL_SHOWN) this.buildPencil();
  }

  // one gondola, round its pivot (its own frame: the wheel's, x along the axle): open above the
  // waist, so that who rides in it is seen - the front wall (towards the city) a little lower, the
  // kids lean on it
  gondolaParts(K, M, c, ranges) {
    const mark = () => {
      const m = new Map();
      for (const [mat, list] of K.parts) {
        let n = 0;
        for (const it of list) n += it.g.attributes.position.count;
        m.set(mat, n);
      }
      return m;
    };
    const before = mark();
    const WHITE = linC(0.97, 0.96, 0.94);
    const fl = -FLOOR;
    const H = 1.5;
    // the hangers
    beam(K, M.metal, [-1.3, 0, 0], [-1.3, -0.72, 0], 0.06, linC(0.7, 0.7, 0.76), 5);
    beam(K, M.metal, [1.3, 0, 0], [1.3, -0.72, 0], 0.06, linC(0.7, 0.7, 0.76), 5);
    // the roof (a little dome), a lamp on it, its band in the gondola's colour
    const roof = new THREE.CylinderGeometry(0.42, 1.8, 0.62, 12, 1);
    roof.translate(0, -1.02, 0);
    K.add(M.paint, roof, WHITE);
    K.box(M.paint, -1.62, -1.48, -1.62, 1.62, -1.32, 1.62, c);
    K.sphere(this.neon[0], 0.2, 0, -0.66, 0, linC(1, 0.9, 0.6), 1, 1, 1, 8);
    // the band of little lights under the roof's edge
    for (const [x0, z0, x1, z1] of [[-1.6, -1.66, 1.6, -1.6], [-1.6, 1.6, 1.6, 1.66], [-1.66, -1.6, -1.6, 1.6], [1.6, -1.6, 1.66, 1.6]]) K.box(this.neon[2], x0, -1.56, z0, x1, -1.48, z1, linC(1, 0.85, 0.5));
    // the posts at the corners
    for (const [x, z] of [[-H + 0.06, -H + 0.06], [H - 0.06, -H + 0.06], [-H + 0.06, H - 0.06], [H - 0.06, H - 0.06]]) K.box(M.metal, x - 0.07, fl, z - 0.07, x + 0.07, -1.48, z + 0.07, WHITE);
    // the floor, the round bottom under it
    K.box(M.paint, -H, fl - 0.12, -H, H, fl, H, c);
    const bot = new THREE.CylinderGeometry(H, 0.7, 0.36, 12, 1);
    bot.translate(0, fl - 0.3, 0);
    K.add(M.paint, bot, c);
    // the walls to the waist (the front one lower)
    const wy = fl + 0.92;
    const fy = fl + 0.72;
    K.box(M.paint, -H, fl, -H, -H + 0.08, fy, H, c);
    K.box(M.paint, H - 0.08, fl, -H, H, wy, H, c);
    K.box(M.paint, -H, fl, -H, H, wy, -H + 0.08, c);
    K.box(M.paint, -H, fl, H - 0.08, H, wy, H, c);
    // the sills, white
    K.box(M.paint, -H - 0.06, fy, -H - 0.06, -H + 0.12, fy + 0.08, H + 0.06, WHITE);
    K.box(M.paint, H - 0.12, wy, -H - 0.06, H + 0.06, wy + 0.08, H + 0.06, WHITE);
    K.box(M.paint, -H - 0.06, wy, -H - 0.06, H + 0.06, wy + 0.08, -H + 0.12, WHITE);
    K.box(M.paint, -H - 0.06, wy, H - 0.12, H + 0.06, wy + 0.08, H + 0.06, WHITE);
    // the bench at the back, its cushions
    K.box(M.matte, 0.72, fl, -1.25, 1.42, fl + 0.45, 1.25, linC(0.42, 0.3, 0.22));
    K.box(M.paint, 0.74, fl + 0.45, -1.2, 1.38, fl + 0.55, 1.2, linC(0.95, 0.85, 0.6));
    K.box(M.paint, 1.3, fl + 0.55, -1.2, 1.4, fl + 1.0, 1.2, linC(0.95, 0.85, 0.6));
    // the windows: their frames over the sills (open - who rides is seen and can lean out), a bar
    // across each one
    const fy0 = wy + 0.08;
    const fy1 = -1.48;
    for (const zz of [-0.5, 0.5]) {
      for (const xx of [-H, H]) K.box(M.metal, xx - 0.04, xx === -H ? fy - 0.0 + 0.08 : fy0, zz - 0.035, xx + 0.04, fy1, zz + 0.035, WHITE);
    }
    for (const xx of [-0.5, 0.5]) {
      for (const zz of [-H, H]) K.box(M.metal, xx - 0.035, fy0, zz - 0.04, xx + 0.035, fy1, zz + 0.04, WHITE);
    }
    for (const zz of [-H, H]) K.box(M.metal, -H, fy0 + 0.55, zz - 0.03, H, fy0 + 0.6, zz + 0.03, WHITE);
    K.box(M.metal, H - 0.03, fy0 + 0.55, -H, H + 0.03, fy0 + 0.6, H, WHITE);
    // the door on its side: hinges, a handle, the gondola's number plate over it
    K.box(M.metal, -0.75, fl + 0.05, H + 0.01, -0.7, wy, H + 0.05, linC(0.3, 0.3, 0.34));
    K.box(M.metal, 0.55, fl + 0.5, H + 0.02, 0.75, fl + 0.56, H + 0.07, linC(0.85, 0.85, 0.88));
    K.box(M.paint, -0.3, fl + 0.6, H + 0.01, 0.3, fl + 0.85, H + 0.03, WHITE);
    const after = mark();
    for (const [mat, n] of after) ranges.push({ mat, a: before.get(mat) || 0, b: n });
  }

  buildGondolas(M) {
    const K = new Kit();
    const N = WHEEL.n;
    this.gRanges = [];
    for (let i = 0; i < N; i++) {
      const r = [];
      this.gondolaParts(K, M, GOND_C[i % GOND_C.length], r);
      this.gRanges.push(r);
    }
    const grp = K.build({ seed: 0.19 });
    grp.matrixAutoUpdate = true;
    // each pen's mesh, its positions as built (every gondola round the origin)
    this.gMesh = new Map();
    for (const m of grp.children) {
      const a = m.geometry.attributes.position;
      this.gMesh.set(m.material, { mesh: m, attr: a, base: Float32Array.from(a.array) });
    }
    this.gond = grp;
    this.gPos = [];
    for (let i = 0; i < N; i++) this.gPos.push(new THREE.Vector3());
  }

  // where gondola i hangs now (in the wheel's own frame: x along the axle)
  pivot(i, out) {
    const a = (i / WHEEL.n) * Math.PI * 2 + this.angle;
    return out.set(0, Math.cos(a) * WHEEL.R, Math.sin(a) * WHEEL.R);
  }

  placeGondolas() {
    for (let i = 0; i < WHEEL.n; i++) this.pivot(i, this.gPos[i]);
    for (const [mat, G] of this.gMesh) {
      const arr = G.attr.array;
      const base = G.base;
      for (let i = 0; i < WHEEL.n; i++) {
        const r = this.gRanges[i].find((q) => q.mat === mat);
        if (!r) continue;
        const o = this.gPos[i];
        for (let v = r.a; v < r.b; v++) {
          const j = v * 3;
          arr[j] = base[j] + o.x;
          arr[j + 1] = base[j + 1] + o.y;
          arr[j + 2] = base[j + 2] + o.z;
        }
      }
      G.attr.needsUpdate = true;
    }
  }

  // a point in the wheel's frame -> the world
  toWorld(p, out) {
    return out.copy(p).applyAxisAngle(UPV, WHEEL.yaw).add(this.root.position);
  }

  // ---- who rides: kids at the front sill, waving; their parents on the bench; teenagers filming
  makeRiders() {
    const N = WHEEL.n;
    const rnd = mulberry(4711);
    // the city side of a gondola: -x in the wheel's frame
    const face = Math.atan2(-Math.cos(WHEEL.yaw), Math.sin(WHEEL.yaw));
    for (let i = 0; i < N; i++) {
      // (one gondola in six empty, between rides; one with teenagers)
      if (i % 6 === 3) continue;
      const teens = i % 7 === 5;
      const list = [];
      const kids = teens ? 0 : 1 + Math.floor(rnd() * 2.2);
      for (let k = 0; k < kids; k++) {
        const look = kidLook();
        list.push({ look, kid: true, lx: -1.0, lz: kids === 1 ? (rnd() - 0.5) * 0.8 : k ? 0.6 : -0.6, sit: 0, wave: rnd() < 0.8 ? 1 : 0, cheer: 0, film: 0 });
      }
      const grown = teens ? 2 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 1.6);
      for (let k = 0; k < grown; k++) {
        const look = civilianLook({ kind: teens ? 'casual' : undefined });
        const lz = grown === 1 ? 0 : -0.75 + (1.5 * k) / (grown - 1);
        const film = teens ? (k === 0 ? 1 : rnd() < 0.4 ? 1 : 0) : rnd() < 0.25 ? 1 : 0;
        list.push({ look, kid: false, lx: teens ? -0.85 : 0.95, lz, sit: teens ? 0 : 1, wave: teens && !film ? 1 : 0, cheer: 0, film });
      }
      for (const r of list) {
        const S = r.look.build.height || (r.kid ? 0.62 : 1);
        this.riders.push({
          gi: i, lx: r.lx, lz: r.lz, x: 0, y: 0, z: 0, y0: 0, look: r.look, scale: S, yaw: face + (r.sit ? 0 : (rnd() - 0.5) * 0.5), speed: 0,
          phase: rnd() * 6, seed: rnd() * 100, cheer: 0, sit: r.sit, wave: r.wave, film: r.film, pump: rnd() * 6, feel: 1, kid: r.kid,
        });
      }
    }
    // down on the pier: the queue to the steps, parents by the gate waving up at their kids
    for (let k = 0; k < 9; k++) {
      const look = k % 3 === 0 ? kidLook() : civilianLook();
      const z = k % 2 ? 239.9 : 246.1;
      const x = 110.5 + k * 1.05;
      this.below.push({ x, z, y: WHEEL.deck, y0: WHEEL.deck, look, scale: look.build.height || 1, yaw: Math.PI / 2 + (rnd() - 0.5) * 0.6, speed: 0, phase: rnd() * 6, seed: rnd() * 100, cheer: 0, sit: 0, wave: 0, film: 0, pump: 0, feel: 1, queue: true });
    }
    const spots = [[100.5, 238.4], [102.2, 240.2], [99.4, 245.8], [101.6, 247.6], [104.2, 237.6], [97.8, 242.4], [103.6, 249.0]];
    spots.forEach(([x, z], k) => {
      const look = civilianLook();
      // (looking up at the wheel)
      const yaw = Math.atan2(WHEEL.x - x, WHEEL.z - z);
      this.below.push({ x, z, y: WHEEL.deck, y0: WHEEL.deck, look, scale: look.build.height || 1, yaw, speed: 0, phase: rnd() * 6, seed: rnd() * 100, cheer: 0, sit: 0, wave: k % 3 === 2 ? 0 : 1, film: k % 3 === 2 ? 1 : 0, pump: rnd() * 6, feel: 1, parent: true });
    });
  }

  // ------------------------------------------------------------------ Sunset Scoops
  buildStand() {
    const M = itemMats();
    const K = new Kit();
    const { x, z } = STAND;
    const y0 = 0.15;
    const PINK = linC(0.98, 0.56, 0.7);
    const MINT = linC(0.56, 0.9, 0.78);
    const CREAM = linC(1, 0.95, 0.84);
    const CHOC = linC(0.42, 0.26, 0.18);
    const WAFFLE = linC(0.88, 0.64, 0.34);
    // the kiosk: 6 m long (along x), its counter facing the way to the pier (south, +z)
    const x0 = x - 3;
    const x1 = x + 3;
    const z0 = z - 2;
    const z1 = z + 1.6;
    K.box(M.paint, x0, y0, z0, x1, y0 + 1.05, z1, CREAM);
    // stripes on its front, pink and white
    for (let i = 0; i < 12; i++) K.box(M.paint, x0 + i * 0.5, y0 + 0.08, z1, x0 + i * 0.5 + 0.25, y0 + 1.0, z1 + 0.03, i % 2 ? PINK : CREAM);
    // the counter top, the glass case of tubs on it
    K.box(M.paint, x0 - 0.1, y0 + 1.05, z1 - 0.9, x1 + 0.1, y0 + 1.12, z1 + 0.15, MINT);
    K.box(M.glass, x0 + 0.4, y0 + 1.12, z1 - 0.8, x1 - 0.4, y0 + 1.45, z1 - 0.1, linC(0.75, 0.88, 0.95));
    const TUBS = [PINK, MINT, CHOC, linC(1, 0.88, 0.45), linC(0.7, 0.55, 0.9), linC(0.95, 0.4, 0.35), CREAM, linC(0.6, 0.85, 0.4)];
    for (let i = 0; i < 8; i++) K.box(M.paint, x0 + 0.55 + i * 0.62, y0 + 1.13, z1 - 0.7, x0 + 1.05 + i * 0.62, y0 + 1.3, z1 - 0.2, TUBS[i]);
    // the back wall and the sides, up to the roof; the menu over the counter
    K.box(M.paint, x0, y0 + 1.05, z0, x1, y0 + 3.0, z0 + 0.15, CREAM);
    K.box(M.paint, x0, y0 + 1.05, z0, x0 + 0.15, y0 + 3.0, z1 - 0.9, PINK);
    K.box(M.paint, x1 - 0.15, y0 + 1.05, z0, x1, y0 + 3.0, z1 - 0.9, PINK);
    // posts at the front corners, the awning (striped, scalloped)
    for (const xx of [x0 + 0.1, x1 - 0.1]) K.box(M.metal, xx - 0.06, y0 + 1.1, z1 - 0.06, xx + 0.06, y0 + 3.0, z1 + 0.06, CREAM);
    K.box(M.paint, x0 - 0.2, y0 + 3.0, z0 - 0.1, x1 + 0.2, y0 + 3.25, z1 + 0.1, MINT);
    for (let i = 0; i < 12; i++) {
      const xa = x0 - 0.2 + i * 0.533;
      const g = new THREE.BoxGeometry(0.533, 0.08, 1.6);
      g.rotateX(-0.42);
      g.translate(xa + 0.27, y0 + 2.95, z1 + 0.7);
      K.add(M.paint, g, i % 2 ? PINK : CREAM);
      K.sphere(M.paint, 0.2, xa + 0.27, y0 + 2.58, z1 + 1.42, i % 2 ? PINK : CREAM, 1, 0.55, 0.5, 8);
    }
    // the big cone on the roof: a waffle cone, three scoops, a cherry
    const cx = x;
    const cz = z - 0.4;
    const cone = new THREE.ConeGeometry(0.75, 2.3, 12, 1);
    cone.rotateX(Math.PI);
    cone.translate(cx, y0 + 3.25 + 1.15, cz);
    K.add(M.paint, cone, WAFFLE);
    K.sphere(M.paint, 0.82, cx, y0 + 5.0, cz, PINK, 1, 0.9, 1, 14);
    K.sphere(M.paint, 0.72, cx, y0 + 5.75, cz, MINT, 1, 0.9, 1, 14);
    K.sphere(M.paint, 0.6, cx, y0 + 6.4, cz, CHOC, 1, 0.9, 1, 14);
    K.sphere(M.paint, 0.2, cx, y0 + 6.98, cz, linC(0.9, 0.12, 0.2), 1, 1, 1, 8);
    // the name over the awning in lights, and strings of bulbs from the posts
    const nm = 'SUNSET SCOOPS';
    const h = 0.5;
    letter(nm, h, (a0, b0, a1, b1) => K.box(M.glow, x + a0, y0 + 3.4 + b0, z1 + 0.12, x + a1, y0 + 3.4 + b1, z1 + 0.18, linC(1, 0.62, 0.76)));
    K.box(M.paint, x - 3.4, y0 + 3.3, z1 + 0.06, x + 3.4, y0 + 4.05, z1 + 0.1, linC(0.18, 0.12, 0.3));
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const bx = x0 - 0.1 + t * 6.2;
      const by = y0 + 2.75 - Math.sin(t * Math.PI) * 0.35;
      K.sphere(M.glow, 0.06, bx, by, z1 + 1.55, RIM_C[i % 3], 1, 1, 1, 6);
    }
    // the tables out front (round, an umbrella over each), stools
    const tables = [[x - 4.2, z + 4.2], [x + 0.2, z + 5.0], [x + 4.4, z + 4.0]];
    this.tables = tables;
    tables.forEach(([tx, tz], i) => {
      K.cyl(M.metal, 0.05, 0.05, y0, y0 + 0.75, linC(0.3, 0.3, 0.34), { axis: 'y', x: tx, z: tz, segs: 6 });
      K.cyl(M.paint, 0.5, 0.5, y0 + 0.75, y0 + 0.8, CREAM, { axis: 'y', x: tx, z: tz, segs: 16 });
      K.cyl(M.metal, 0.03, 0.03, y0 + 0.8, y0 + 2.45, CREAM, { axis: 'y', x: tx, z: tz, segs: 6 });
      const um = new THREE.ConeGeometry(1.25, 0.5, 8, 1, true);
      um.translate(tx, y0 + 2.45, tz);
      K.add(M.paint, um, [PINK, MINT, linC(1, 0.85, 0.4)][i]);
      for (const a of [0.4, 2.5, 4.4]) {
        const sx = tx + Math.cos(a) * 0.85;
        const sz = tz + Math.sin(a) * 0.85;
        K.cyl(M.metal, 0.04, 0.04, y0, y0 + 0.45, linC(0.3, 0.3, 0.34), { axis: 'y', x: sx, z: sz, segs: 6 });
        K.cyl(M.paint, 0.2, 0.2, y0 + 0.45, y0 + 0.5, MINT, { axis: 'y', x: sx, z: sz, segs: 10 });
      }
    });
    // behind the counter: the chest freezer, the dipping cabinet's lids, the register, the cones
    // stacked in their dispenser, a tip jar, the napkins; the menu over it all
    const WHITE = linC(0.97, 0.97, 0.95);
    const STEEL = linC(0.72, 0.74, 0.78);
    K.box(M.paint, x0 + 0.4, y0, z0 + 0.3, x0 + 2.2, y0 + 0.9, z0 + 1.1, WHITE);
    K.box(M.metal, x0 + 0.42, y0 + 0.9, z0 + 0.32, x0 + 2.18, y0 + 0.95, z0 + 1.08, STEEL);
    K.box(M.paint, x1 - 1.4, y0 + 1.12, z1 - 0.75, x1 - 0.9, y0 + 1.42, z1 - 0.4, linC(0.16, 0.16, 0.2));
    K.box(M.glow, x1 - 1.35, y0 + 1.36, z1 - 0.74, x1 - 0.95, y0 + 1.4, z1 - 0.62, linC(0.5, 1, 0.7));
    for (let i = 0; i < 6; i++) {
      const cone = new THREE.ConeGeometry(0.05, 0.16, 8, 1, true);
      cone.rotateX(Math.PI);
      cone.translate(x0 + 0.5, y0 + 1.25 + i * 0.03, z1 - 0.35);
      K.add(M.paint, cone, WAFFLE);
    }
    K.cyl(M.metal, 0.07, 0.07, y0 + 1.12, y0 + 1.25, STEEL, { axis: 'y', x: x0 + 0.5, z: z1 - 0.35, segs: 10 });
    K.cyl(M.glass, 0.08, 0.08, y0 + 1.12, y0 + 1.32, linC(0.8, 0.9, 0.95), { axis: 'y', x: x0 + 0.85, z: z1 - 0.3, segs: 12 });
    K.box(M.paint, x0 + 0.78, y0 + 1.13, z1 - 0.33, x0 + 0.92, y0 + 1.18, z1 - 0.27, linC(0.4, 0.75, 0.4));
    K.box(M.metal, x1 - 0.6, y0 + 1.12, z1 - 0.4, x1 - 0.4, y0 + 1.27, z1 - 0.25, STEEL);
    K.box(M.paint, x1 - 0.58, y0 + 1.2, z1 - 0.38, x1 - 0.42, y0 + 1.3, z1 - 0.27, WHITE);
    // the menu: a board of its own (flavours, prices, the cones drawn), lit from above
    const menu = this.menuBoard();
    const mx = x;
    const mz = z0 + 0.17;
    const mq = new THREE.PlaneGeometry(4.6, 1.15);
    mq.translate(mx, y0 + 2.35, mz);
    K.add(menu, mq, linC(1, 1, 1));
    K.box(M.paint, mx - 2.38, y0 + 1.72, mz - 0.03, mx + 2.38, y0 + 2.98, mz - 0.005, linC(0.18, 0.12, 0.26));
    for (const lx of [mx - 1.6, mx, mx + 1.6]) {
      K.box(M.metal, lx - 0.03, y0 + 2.92, mz, lx + 0.03, y0 + 2.98, mz + 0.35, STEEL);
      K.box(M.glow, lx - 0.18, y0 + 2.88, mz + 0.3, lx + 0.18, y0 + 2.93, mz + 0.4, linC(1, 0.95, 0.85));
    }
    // the A-board out front (TODAY'S SPECIAL), a bin, two little palms in pots
    const special = this.menuBoard('special');
    const ax = x + 4.3;
    const az = z + 1.9;
    for (const s2 of [-1, 1]) {
      const leg = new THREE.BoxGeometry(0.05, 1.2, 0.05);
      leg.rotateX(s2 * 0.2);
      leg.translate(ax - 0.33, y0 + 0.58, az + s2 * 0.12);
      K.add(M.matte, leg, linC(0.4, 0.28, 0.2));
      const leg2 = leg.clone();
      leg2.translate(0.66, 0, 0);
      K.add(M.matte, leg2, linC(0.4, 0.28, 0.2));
    }
    const ab = new THREE.PlaneGeometry(0.62, 0.9);
    ab.rotateY(Math.PI);
    ab.rotateX(0.2);
    ab.translate(ax, y0 + 0.62, az - 0.13);
    K.add(special, ab, linC(1, 1, 1));
    const ab2 = new THREE.PlaneGeometry(0.62, 0.9);
    ab2.rotateX(-0.2);
    ab2.translate(ax, y0 + 0.62, az + 0.13);
    K.add(special, ab2, linC(1, 1, 1));
    K.cyl(M.paint, 0.26, 0.24, y0, y0 + 0.9, linC(0.2, 0.5, 0.45), { axis: 'y', x: x - 4.6, z: z + 1.2, segs: 12 });
    K.cyl(M.metal, 0.27, 0.27, y0 + 0.9, y0 + 0.95, STEEL, { axis: 'y', x: x - 4.6, z: z + 1.2, segs: 12 });
    for (const [px, pz] of [[x0 - 0.6, z1 + 0.4], [x1 + 0.6, z1 + 0.4]]) {
      K.cyl(M.paint, 0.32, 0.24, y0, y0 + 0.55, linC(0.85, 0.45, 0.3), { axis: 'y', x: px, z: pz, segs: 12 });
      K.cyl(M.matte, 0.06, 0.08, y0 + 0.55, y0 + 2.1, linC(0.5, 0.36, 0.22), { axis: 'y', x: px, z: pz, segs: 8 });
      for (let f = 0; f < 7; f++) {
        const a = (f / 7) * Math.PI * 2;
        const fr = new THREE.BoxGeometry(0.9, 0.02, 0.16);
        fr.translate(0.45, 0, 0);
        fr.rotateZ(-0.5);
        fr.rotateY(a);
        fr.translate(px, y0 + 2.1, pz);
        K.add(M.paint, fr, linC(0.2, 0.55, 0.3));
      }
    }
    const grp = K.build({ seed: 0.83 });
    this.add(grp);
    this.addCol(x0, z0, x1, z1 + 0.15, -1, y0 + 3.3, 'wall');
    for (const [tx, tz] of tables) this.cols.push(this.game.world.collision.addCircle(tx, tz, 0.5, y0, y0 + 0.8, 'prop'));
    // the one behind the counter
    const look = civilianLook();
    this.staff = [{ x: x - 0.6, z: z - 0.4, y: y0, y0, look, scale: look.build.height || 1, yaw: 0, speed: 0, phase: 0, seed: 3.3, cheer: 0, sit: 0, wave: 0, film: 0, pump: 0, feel: 1 }];
  }

  // the stand's menu (or its A-board's special), drawn the way the city's boards are
  menuBoard(kind = 'menu') {
    const W = kind === 'menu' ? 1024 : 256;
    const H = kind === 'menu' ? 256 : 372;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const sk = new Sketcher(g, kind === 'menu' ? 41 : 77);
    const text = (str, x, y, size, color, font = FONT_UI, weight = 800, align = 'center') => sk.text(str, x, y, { size, color, font, weight, dir: 'ltr', align, passes: 1 });
    if (kind === 'menu') {
      g.fillStyle = '#2a1d3a';
      g.fillRect(0, 0, W, H);
      sk.fill([[0, 0], [W, 0], [W, H], [0, H]], '#ffffff', { spacing: 5, alpha: 0.04, overshoot: 0, angle: -0.6 });
      text('SUNSET SCOOPS', W / 2, 34, 38, '#ffb3cf', FONT_SIGN, 400);
      const rows = [['1 SCOOP', '$3.50'], ['2 SCOOPS', '$5.50'], ['3 SCOOPS', '$7.00'], ['WAFFLE CONE', '+$1.00'], ['SPRINKLES', '+50¢']];
      rows.forEach(([a, b], i) => {
        text(a, 40, 88 + i * 34, 25, '#fff4e0', FONT_UI, 700, 'left');
        text(b, 470, 88 + i * 34, 25, '#ffd23f', FONT_UI, 800, 'right');
      });
      const flav = ['STRAWBERRY', 'MINT CHIP', 'CHOCOLATE', 'MANGO', 'BLUEBERRY', 'CHERRY', 'VANILLA', 'PISTACHIO'];
      const fc = ['#ff8fab', '#9ff0c9', '#a0715a', '#ffc24a', '#8fa8ff', '#ff5a6a', '#fff3d6', '#b6e08a'];
      flav.forEach((f, i) => {
        const x = 560 + (i % 2) * 230;
        const y = 82 + Math.floor(i / 2) * 42;
        g.fillStyle = fc[i];
        g.beginPath();
        g.arc(x, y, 12, 0, Math.PI * 2);
        g.fill();
        text(f, x + 22, y + 1, 22, '#fff4e0', FONT_UI, 700, 'left');
      });
      sk.poly([[6, 6], [W - 6, 6], [W - 6, H - 6], [6, H - 6]], true, { width: 4, color: '#ffb3cf' });
    } else {
      g.fillStyle = '#1f2a22';
      g.fillRect(0, 0, W, H);
      sk.fill([[0, 0], [W, 0], [W, H], [0, H]], '#ffffff', { spacing: 4, alpha: 0.08, overshoot: 0, angle: 0.4 });
      text("TODAY'S", W / 2, 40, 30, '#fff4e0', FONT_SIGN, 400);
      text('SPECIAL', W / 2, 78, 34, '#ffd23f', FONT_SIGN, 400);
      text('MANGO', W / 2, 150, 40, '#ffc24a', FONT_SIGN, 400);
      text('SUNSET', W / 2, 196, 40, '#ff8fab', FONT_SIGN, 400);
      text('SWIRL', W / 2, 242, 40, '#ff8fab', FONT_SIGN, 400);
      text('$4.50', W / 2, 310, 38, '#fff4e0', FONT_UI, 800);
      sk.poly([[8, 8], [W - 8, 8], [W - 8, H - 8], [8, H - 8]], true, { width: 5, color: '#c8a070' });
    }
    const tex = canvasTexture(c);
    return makeSurface({ kind: 'box', map: tex, emMap: tex, emissive: new THREE.Color(kind === 'menu' ? 0.55 : 0.25, kind === 'menu' ? 0.55 : 0.25, kind === 'menu' ? 0.55 : 0.25), ang: 1.45, wash: 0.9, line: 0.4 });
  }

  // ------------------------------------------------------------------ MICHAEL CRUZ - A BETTER CITY FOR EVERYONE
  boardTexture(kind) {
    const W = 1024;
    const H = 512;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const sk = new Sketcher(ctx, kind === 'b' ? 913 : 377);
    // a deep blue field, a band of red under it, stars
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1b2a6b');
    g.addColorStop(1, '#0f1a48');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#c8283c';
    ctx.fillRect(0, H - 70, W, 70);
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(0, H - 82, W, 12);
    for (let i = 0; i < 26; i++) {
      const sx = 470 + ((i * 197) % 540);
      const sy = 24 + ((i * 89) % 120);
      sk.star(sx, sy, 7 + (i % 3) * 2, 5, { fill: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.25)', width: 1 });
    }
    sk.fill([[0, 0], [W, 0], [W, H], [0, H]], '#ffffff', { spacing: 5, alpha: 0.05, overshoot: 0, angle: -0.6 });
    const text = (str, x, y, size, color, font = FONT_UI, weight = 800, o = {}) => sk.text(str, x, y, { size, color, font, weight, dir: 'ltr', align: o.align || 'left', maxWidth: o.maxWidth, outline: o.outline, outlineWidth: o.outlineWidth, passes: 1 });
    const right = kind === 'b';
    // (what he is running for, read first and from far off: FOR MAYOR, the biggest thing on it;
    // then who, then the promise; the day to vote along the red band)
    const tx = right ? 34 : 482;
    const tw = 508;
    text('MICHAEL CRUZ', tx, 84, 64, '#ffffff', FONT_UI, 900, { maxWidth: tw });
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(tx, 104, tw, 6);
    text('FOR', tx, 186, 70, '#ffd23f', FONT_UI, 900, { maxWidth: tw });
    text('MAYOR', tx, 300, 132, '#ffd23f', FONT_UI, 900, { maxWidth: tw, outline: '#0b1236', outlineWidth: 10 });
    text('"A better city', tx + 2, 360, 44, '#f4efe2', FONT_SIGN, 400, { maxWidth: tw });
    text('for everyone"', tx + 2, 410, 44, '#f4efe2', FONT_SIGN, 400, { maxWidth: tw });
    text('VOTE NOV 7  ★  CRUZ FOR MAYOR  ★  VOTE NOV 7', W / 2, H - 22, 32, '#ffffff', FONT_UI, 800, { align: 'center' });
    const tex = canvasTexture(c);
    // his face, from his sheet, as the game draws (tools/illustrate_portrait.py): in when the
    // picture is in
    const img = new Image();
    img.onload = () => {
      const px = right ? W - 466 : 16;
      const pw = 450;
      const ph = H - 98;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, 14, pw, ph);
      ctx.clip();
      const s = Math.max(pw / img.width, ph / img.height);
      const iw = img.width * s;
      const ih = img.height * s;
      ctx.drawImage(img, px + (pw - iw) / 2, 14 + (ph - ih) * 0.35, iw, ih);
      ctx.restore();
      sk.poly([[px, 14], [px + pw, 14], [px + pw, 14 + ph], [px, 14 + ph]], true, { width: 7, color: '#f4efe2' });
      tex.needsUpdate = true;
    };
    img.src = new URL(`${window.__gameBase ? '' : '../../../'}img/prologue/michael_${right ? 'smile' : 'look'}_ill.jpg`, window.__gameBase || import.meta.url).href;
    return tex;
  }

  buildBoards() {
    const K = new Kit();
    const M = itemMats();
    const texA = this.boardTexture('a');
    const texB = this.boardTexture('b');
    const mat = (tex) => makeSurface({ kind: 'box', map: tex, emMap: tex, emissive: new THREE.Color(0.3, 0.3, 0.29), ang: 1.45, wash: 0.95, line: 0.25, gloss: 0.1 });
    const mA = mat(texA);
    const mB = mat(texB);
    const STEEL = linC(0.95, 0.94, 0.92);
    // (x, z) its foot, (nx, nz) the way it faces, w wide, legs high
    const boards = [
      // up the promenade from where Danny starts, facing him (the first thing at the end of his look)
      { x: 25, z: -58, nx: -0.25, nz: 0.97, w: 11, leg: 4.6, m: mB },
      // on the park's edge by Ocean Drive, facing the first boulevard's people coming south
      { x: 24.5, z: 60, nx: 0, nz: -1, w: 10, leg: 4.2, m: mA },
      // by the promenade near 7th, facing north
      { x: 24.5, z: 178, nx: -0.6, nz: -0.8, w: 10, leg: 4.2, m: mB },
      // on the way out onto the pier (the one Lily sees), facing the gate - a little along from the
      // beach walk's lamp post, so that nothing stands between it and whoever looks up at it
      { x: 44.4, z: 257.1, nx: -0.45, nz: -0.89, w: 9, leg: 3.4, m: mA },
      // at the end of Ocean Drive by the car parks
      { x: 18, z: 306, nx: -0.8, nz: -0.6, w: 10, leg: 4.6, m: mB },
    ];
    this.boards = boards;
    for (const b of boards) {
      const n = Math.hypot(b.nx, b.nz);
      const nx = b.nx / n;
      const nz = b.nz / n;
      const rx = nz;
      const rz = -nx;
      const h = b.w / 2;
      const y0 = 0.15;
      for (const s of [-0.32, 0.32]) {
        const lx = b.x + rx * b.w * s - nx * 0.35;
        const lz = b.z + rz * b.w * s - nz * 0.35;
        K.cyl(M.metal, 0.15, 0.12, y0, y0 + b.leg + h * 0.7, STEEL, { axis: 'y', x: lx, z: lz, segs: 8 });
        this.cols.push(this.game.world.collision.addCircle(lx, lz, 0.2, y0, y0 + b.leg + h, 'pole'));
      }
      const cy = y0 + b.leg + h / 2;
      const yawF = Math.atan2(nx, nz);
      const frame = new THREE.BoxGeometry(b.w + 0.3, h + 0.3, 0.25);
      frame.rotateY(yawF);
      frame.translate(b.x - nx * 0.15, cy, b.z - nz * 0.15);
      K.add(M.paint, frame, STEEL);
      const walk = new THREE.BoxGeometry(b.w, 0.08, 0.9);
      walk.rotateY(yawF);
      walk.translate(b.x + nx * 0.4, y0 + b.leg - 0.12, b.z + nz * 0.4);
      K.add(M.metal, walk, linC(0.45, 0.44, 0.5));
      for (const s of [-0.3, 0.3]) {
        const lamp = new THREE.BoxGeometry(0.4, 0.14, 0.24);
        lamp.rotateY(yawF);
        lamp.translate(b.x + rx * b.w * s + nx * 0.9, y0 + b.leg + h + 0.35, b.z + rz * b.w * s + nz * 0.9);
        K.add(M.glow, lamp, linC(1, 0.95, 0.85));
      }
      // the poster: a quad facing (nx, nz), the picture the right way round
      const hw = b.w / 2;
      const hh = h / 2;
      const px = b.x + nx * 0.02;
      const pz = b.z + nz * 0.02;
      const a = [px - rx * hw, cy - hh, pz - rz * hw];
      const bb = [px + rx * hw, cy - hh, pz + rz * hw];
      const c = [px + rx * hw, cy + hh, pz + rz * hw];
      const d = [px - rx * hw, cy + hh, pz - rz * hw];
      const q = new THREE.BufferGeometry();
      q.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...bb, ...c, ...a, ...c, ...d], 3));
      q.setAttribute('normal', new THREE.Float32BufferAttribute([nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz], 3));
      // (seen from the front, its left is +r: the picture's left edge there)
      q.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
      K.add(b.m, q, linC(1, 1, 1));
    }
    const grp = K.build({ seed: 0.11 });
    this.add(grp);
  }

  // ------------------------------------------------------------------ boats on the water
  // yachts at anchor off the pier, a sailboat or two, a speedboat running along the shore with its
  // wake behind it: the evening on the water the opening flies over. Each a little set of its own,
  // bobbing on the swell
  buildBoats() {
    const M = itemMats();
    const WHITE = linC(0.97, 0.97, 0.95);
    const NAVY = linC(0.14, 0.18, 0.36);
    const TEAK = linC(0.62, 0.42, 0.26);
    const GLASS = linC(0.2, 0.28, 0.4);
    this.boats = [];
    const hull = (K, L, B, H, col) => {
      // a hull: wide at the deck, narrowing to the keel, a pointed bow
      const sh = new THREE.Shape();
      sh.moveTo(-L / 2, -B / 2);
      sh.lineTo(L / 2 - B * 0.9, -B / 2);
      sh.quadraticCurveTo(L / 2, -B * 0.25, L / 2 + 0.2, 0);
      sh.quadraticCurveTo(L / 2, B * 0.25, L / 2 - B * 0.9, B / 2);
      sh.lineTo(-L / 2, B / 2);
      sh.lineTo(-L / 2, -B / 2);
      const g = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false, curveSegments: 6 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, -0.5, 0);
      // narrower below the water line
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) < 0) p.setZ(i, p.getZ(i) * 0.6);
      }
      g.computeVertexNormals();
      K.add(M.paint, g, col);
    };
    const yacht = (x, z, yaw, L, col) => {
      const K = new Kit();
      const B = L * 0.27;
      hull(K, L, B, 1.6, WHITE);
      K.box(M.paint, -L / 2, 0.15, -B / 2 - 0.02, L / 2 - B * 0.9, 0.35, B / 2 + 0.02, col);
      K.box(M.matte, -L / 2 + 0.3, 1.05, -B / 2 + 0.25, L / 2 - B * 1.1, 1.1, B / 2 - 0.25, TEAK);
      // the cabins, two decks, dark glass all round
      K.box(M.paint, -L * 0.3, 1.1, -B * 0.36, L * 0.18, 2.3, B * 0.36, WHITE);
      K.box(M.glass, -L * 0.28, 1.5, -B * 0.37, L * 0.16, 2.1, B * 0.37, GLASS);
      K.box(M.paint, -L * 0.22, 2.3, -B * 0.3, L * 0.06, 3.2, B * 0.3, WHITE);
      K.box(M.glass, -L * 0.2, 2.55, -B * 0.31, L * 0.05, 3.05, B * 0.31, GLASS);
      K.box(M.metal, -L * 0.1, 3.2, -0.05, -L * 0.08, 4.6, 0.05, linC(0.85, 0.85, 0.9));
      K.sphere(M.glow, 0.12, -L * 0.09, 4.65, 0, linC(1, 0.95, 0.8), 1, 1, 1, 6);
      // lights along the rail
      for (let i = 0; i < 8; i++) K.sphere(M.glow, 0.07, -L / 2 + 0.5 + (i * (L * 0.8)) / 8, 1.25, B / 2 - 0.1, linC(1, 0.9, 0.7), 1, 1, 1, 5);
      return { K, x, z, yaw, bob: Math.random() * 6, speed: 0 };
    };
    const sail = (x, z, yaw, L, col) => {
      const K = new Kit();
      const B = L * 0.3;
      hull(K, L, B, 1.1, WHITE);
      K.box(M.paint, -L / 2, 0.2, -B / 2 - 0.02, L / 2 - B * 0.9, 0.32, B / 2 + 0.02, col);
      K.box(M.metal, -0.08, 0.5, -0.08, 0.08, L * 1.25, 0.08, linC(0.85, 0.85, 0.88));
      // the mainsail and the jib: triangles, a little full
      const tri = (a, b, c2, colr) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c2, ...a, ...c2, ...b], 3));
        g.computeVertexNormals();
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0], 2));
        K.add(M.paint, g, colr);
      };
      tri([0, 1.0, 0.1], [-L * 0.42, 1.0, 0.25], [0, L * 1.2, 0.1], linC(0.98, 0.96, 0.92));
      tri([0.15, 1.0, 0.1], [L * 0.45, 0.6, 0.1], [0.1, L * 1.05, 0.1], linC(0.96, 0.9, 0.86));
      return { K, x, z, yaw, bob: Math.random() * 6, speed: 0 };
    };
    const speed = (x, z, yaw) => {
      const K = new Kit();
      const L = 7.5;
      const B = 2.4;
      hull(K, L, B, 1.0, linC(0.9, 0.18, 0.22));
      K.box(M.paint, -L / 2, 0.3, -B / 2 - 0.02, L / 2 - 2.1, 0.42, B / 2 + 0.02, WHITE);
      K.box(M.glass, -0.4, 0.5, -B * 0.4, 0.6, 1.1, B * 0.4, GLASS);
      K.box(M.matte, -L / 2 + 0.6, 0.5, -0.8, -0.6, 0.9, 0.8, linC(0.95, 0.92, 0.85));
      return { K, x, z, yaw, bob: Math.random() * 6, speed: 13, wake: true };
    };
    const list = [
      yacht(262, 286, 0.4, 24, NAVY),
      yacht(300, 214, 2.2, 30, linC(0.1, 0.1, 0.12)),
      yacht(196, 300, -0.3, 18, linC(0.16, 0.5, 0.62)),
      sail(240, 196, 1.2, 9, linC(0.86, 0.2, 0.26)),
      sail(330, 248, -0.6, 11, NAVY),
      sail(176, 330, 0.9, 8, linC(0.98, 0.72, 0.18)),
      yacht(170, 168, 1.9, 21, linC(0.55, 0.12, 0.16)),
      speed(150, 300, 0),
    ];
    for (const b of list) {
      const grp = b.K.build({ seed: Math.random() });
      grp.matrixAutoUpdate = true;
      const holder = new THREE.Group();
      holder.add(grp);
      holder.position.set(b.x, 0, b.z);
      holder.rotation.y = b.yaw;
      this.game.scene.add(holder);
      this.objs.push(holder);
      b.g = holder;
      b.K = null;
      b.x0 = b.x;
      b.z0 = b.z;
      this.boats.push(b);
    }
  }

  moveBoats(dt) {
    const t = this.t;
    for (const b of this.boats || []) {
      if (b.speed) {
        // the speedboat: up and down the shore, out past the pier and back
        b.x = b.x0 + Math.sin(t * 0.045) * 6;
        b.z = b.z0 - ((t * b.speed) % 260);
        b.g.rotation.y = Math.PI;
      }
      b.g.position.set(b.x, Math.sin(t * 0.9 + b.bob) * 0.12 - 0.05, b.z);
      b.g.rotation.z = Math.sin(t * 0.7 + b.bob) * 0.025;
      b.g.rotation.x = Math.sin(t * 0.55 + b.bob * 2) * 0.02;
      if (b.wake && this.game.fx && Math.random() < dt * 10) this.game.fx.splash(b.x + (Math.random() - 0.5) * 1.6, 0.1, b.z + 4.2, 3, 2.4);
    }
  }

  // ------------------------------------------------------------------ every frame
  floorAt(x, z, y) {
    let best = -Infinity;
    for (const gar of this.garages) {
      const h = gar.floorAt(x, z, y);
      if (h > best) best = h;
    }
    const hp = this.park.floorAt(x, z, y);
    return hp > best ? hp : best;
  }

  // the underside of the deck over (x, z), for the camera (Infinity in the open)
  ceilingAt(x, z, y) {
    let c = Infinity;
    for (const gar of this.garages) c = Math.min(c, gar.ceilingAt(x, z, y));
    return Math.min(c, this.park.ceilingAt(x, z, y));
  }

  update(dt) {
    if (!this.built) return;
    this.t += dt;
    this.park.update();
    this.moveBoats(dt);
    this.walkBelow(dt);
    this.moveBag();
    if (!this.wheelGone && this.root) {
      this.angle += dt * WHEEL.spin;
      this.spin.rotation.x = this.angle;
      this.placeGondolas();
      // the lights: three strings taking turns, slowly, and all of them bright on the beat
      const t = this.t;
      for (let k = 0; k < 3; k++) {
        const u = this.neon[k].uniforms.uEmissive.value;
        const v = 1.2 + 1.6 * Math.max(0, Math.sin(t * 1.6 - (k * Math.PI * 2) / 3));
        u.setRGB(v, v, v);
      }
      // the riders: the kids wave, everybody bobs a little
      const _p = new THREE.Vector3();
      const _w = new THREE.Vector3();
      for (const r of this.riders) {
        const o = this.gPos[r.gi];
        _p.set(o.x + r.lx, o.y - FLOOR, o.z + r.lz);
        this.toWorld(_p, _w);
        r.x = _w.x;
        r.z = _w.z;
        r.y = _w.y + (r.sit ? 0.48 - 0.47 * r.scale : 0);
        r.pump += dt * (r.kid ? 7 : 5);
      }
      for (const b of this.below) b.pump += dt * 5;
    }
    if (this.erasing) this.stepErase(dt);
    if (this.pencil && this.pencil.mode !== 'off') this.tickPencil(dt);
  }

  // the cars parked in the car parks' bays, the city's own (from game.js, with the other cars)
  drawCars(cars) {
    if (!this.built || !cars) return;
    const cam = this.game.camera;
    const cp = cam.position;
    const fwd = cam.getWorldDirection(_v);
    const o = this.carOpts || (this.carOpts = { spin: 0, steer: 0, extra: 'plain', siren: undefined, dmg: null, signal: 0, busy: false, scale: 1, squash: 1, noWheels: false });
    const far = this.game.touch ? 60 : 95;
    // (the nearest of them, as many as the city's cars leave room for)
    const near = this.nearCars || (this.nearCars = []);
    near.length = 0;
    for (const gar of [...this.garages, ...this.park.parts]) {
      const s = gar.s;
      // (the whole car park out of sight or far off: none of them)
      const mx = Math.max(s.x0 - cp.x, 0, cp.x - s.x1);
      const mz = Math.max(s.z0 - cp.z, 0, cp.z - s.z1);
      if (Math.hypot(mx, mz) > far) continue;
      for (const c of gar.parked) {
        const dx = c.x - cp.x;
        const dz = c.z - cp.z;
        const d = Math.hypot(dx, dz);
        if (d > far || (d > 12 && (dx * fwd.x + dz * fwd.z) / d < 0.2)) continue;
        c.d = d + Math.abs(c.y - cp.y) * 3;
        near.push(c);
      }
    }
    if (near.length > 26) near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < Math.min(26, near.length); i++) {
      const c = near[i];
      // (one parked on a sloping floor sits on it)
      o.tilt = c.tilt || 0;
      o.roll = c.roll || 0;
      cars.draw(c.spec.kind, c.spec.color, c.x, c.y, c.z, c.yaw, o);
    }
    o.tilt = 0;
    o.roll = 0;
  }

  // (a gondola whose riders are real people for a close look: the director's)
  hideRiders(gi, on) {
    for (const r of this.riders) if (r.gi === gi) r.hidden = on;
  }

  // the cheap figures: in the gondolas, and on the pier under them
  draw() {
    if (!this.built) return;
    const g = this.game;
    const cam = g.camera.position;
    const bodies = g.figures.bodies;
    const fwd = g.camera.getWorldDirection(_v);
    const far = g.touch ? 190 : 300;
    const one = (w) => {
      const dx = w.x - cam.x;
      const dz = w.z - cam.z;
      const dy = w.y - cam.y;
      const d = Math.hypot(dx, dz, dy);
      if (d > far || (d > 6 && (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d < -0.2)) return;
      bodies.drawCheap(w);
    };
    if (!this.wheelGone) for (const r of this.riders) if (!r.hidden && !r.gone) one(r);
    for (const b of this.below) one(b);
    for (const b of this.staff || []) one(b);
  }

  // ------------------------------------------------------------------ nobody remembers
  // after it: the parents down there lower their hands and go on their way, chatting; the one who
  // filmed it puts the phone away; the queue for a ride that is not there wanders off
  forget() {
    const rnd = mulberry(99);
    for (const b of this.below) {
      b.wave = 0;
      b.film = 0;
      b.cheer = 0;
      // (off along the pier, back towards the beach, at their ease)
      b.walkTo = { x: 46 + rnd() * 30, z: 238 + rnd() * 10 };
      b.walkDelay = 0.5 + rnd() * 3.5;
    }
  }

  walkBelow(dt) {
    for (const b of this.below) {
      if (!b.walkTo) continue;
      if (b.walkDelay > 0) {
        b.walkDelay -= dt;
        continue;
      }
      const dx = b.walkTo.x - b.x;
      const dz = b.walkTo.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) {
        b.speed = 0;
        continue;
      }
      const sp = 1.15;
      b.x += (dx / d) * sp * dt;
      b.z += (dz / d) * sp * dt;
      b.yaw = Math.atan2(dx, dz);
      b.speed = sp;
      b.phase += dt * sp * 4.2;
    }
  }

  // (ROADMAP 18.9) the mark on a stranger's shirt, over his heart - the same as the one on the bag:
  // something like an eraser and not one, a hole through it with lines going out of it, as if
  // something had been rubbed out from inside. On a patch of his shirt's own dark, a hand wide
  markShirt(c) {
    // (ROADMAP 18.9: printed on his black sweatshirt - the mark alone, nothing round it: no square of
    // its own colour over the cloth, no ink line round a square)
    const cv = this.markCanvas(null);
    const tex = canvasTexture(cv);
    const M = itemMats();
    const K = new Kit();
    const face = makeSurface({ kind: 'box', map: tex, emMap: tex, emissive: new THREE.Color(0.14, 0.14, 0.14), ang: 1.45, wash: 0.9, line: 0, alphaTest: 0.5 });
    const q = new THREE.PlaneGeometry(0.17, 0.17);
    K.add(face, q, linC(1, 1, 1));
    void M;
    const grp = K.build({ seed: 0.6 });
    grp.matrixAutoUpdate = true;
    this.game.scene.add(grp);
    this.objs.push(grp);
    this.shirt = { c, grp };
    return this.shirt;
  }

  // the mark itself, on a ground of col
  markCanvas(col) {
    const W = 256;
    const cv = makeCanvas(W, W);
    const g = cv.getContext('2d');
    // (col null: nothing round it - see through to whatever it is printed on)
    if (col) {
      g.fillStyle = col;
      g.fillRect(0, 0, W, W);
    }
    g.save();
    g.translate(W / 2, W / 2);
    g.rotate(-0.38);
    // an eraser's two colours, split - its corners too sharp on one side
    g.beginPath();
    g.moveTo(-86, -40);
    g.lineTo(70, -40);
    g.lineTo(96, 0);
    g.lineTo(70, 40);
    g.lineTo(-86, 40);
    g.quadraticCurveTo(-104, 0, -86, -40);
    g.fillStyle = '#e8869a';
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = '#5b7bd6';
    g.fillRect(18, -60, 120, 120);
    g.restore();
    // a hole through it, and the lines going out of it, as if something had been rubbed out from inside
    g.fillStyle = '#101014';
    g.beginPath();
    g.arc(-6, 0, 24, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#101014';
    g.lineWidth = 4;
    for (const a of [-2.4, -0.4, 1.3, 2.6]) {
      g.beginPath();
      g.moveTo(-6 + Math.cos(a) * 26, Math.sin(a) * 26);
      g.lineTo(-6 + Math.cos(a) * 64, Math.sin(a) * 64);
      g.stroke();
    }
    g.fillStyle = '#f4efe2';
    g.beginPath();
    g.arc(-6, 0, 6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return cv;
  }

  // the mark on a stranger's bag: something like an eraser, and not one - seen for half a second
  // (ROADMAP 18.9) a bench on the pier where Lily sits to draw: wooden slats on two cast-iron ends, its
  // back to the boards' far side - its seat 0.44 m over the deck at y, facing yaw. Made once; moved if
  // asked again
  bench(x, y, z, yaw) {
    if (!this.benchGrp) {
      const M = itemMats();
      const K = new Kit();
      const WOOD = linC(0.52, 0.34, 0.2);
      const WOOD2 = linC(0.44, 0.28, 0.16);
      const IRON = linC(0.16, 0.16, 0.18);
      // (the seat's slats, then the back's - along x, its front to +z)
      for (let i = 0; i < 4; i++) K.box(M.matte, -0.78, 0.4, -0.2 + i * 0.105, 0.78, 0.44, -0.12 + i * 0.105, i % 2 ? WOOD : WOOD2);
      for (let i = 0; i < 3; i++) K.box(M.matte, -0.78, 0.55 + i * 0.12, -0.27 - i * 0.025, 0.78, 0.63 + i * 0.12, -0.24 - i * 0.025, i % 2 ? WOOD2 : WOOD);
      // (the two iron ends: a leg front and back, an arm)
      for (const sx of [-0.7, 0.7]) {
        K.box(M.matte, sx - 0.03, 0, 0.1, sx + 0.03, 0.4, 0.15, IRON);
        K.box(M.matte, sx - 0.03, 0, -0.26, sx + 0.03, 0.9, -0.2, IRON);
        K.box(M.matte, sx - 0.03, 0.6, -0.24, sx + 0.03, 0.64, 0.14, IRON);
      }
      // (round 15: her tin of coloured pencils, open on the seat at her right hand - what the drawing
      // is coloured with: each of its colours)
      K.box(M.metal, -0.53, 0.44, -0.1, -0.37, 0.458, 0.1, linC(0.2, 0.32, 0.62));
      ['#9b7be0', '#f45d9c', '#ffb24a', '#ffd23f', '#3fa7d6', '#2a7fc0', '#e8457c', '#5cc45a', '#ff8a3a'].forEach((h, i) => {
        const n = parseInt(h.slice(1), 16);
        K.cyl(M.paint, 0.0065, 0.0065, -0.088, 0.088, linC(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255), { x: -0.515 + i * 0.0165, y: 0.466, segs: 6 });
      });
      const grp = K.build({ seed: 0.31 });
      grp.matrixAutoUpdate = true;
      this.game.scene.add(grp);
      this.objs.push(grp);
      this.benchGrp = grp;
    }
    this.benchGrp.position.set(x, y, z);
    this.benchGrp.rotation.set(0, yaw, 0);
    this.benchGrp.visible = true;
    return this.benchGrp;
  }

  markBag(c) {
    const cv = this.markCanvas('#2a2622');
    const tex = canvasTexture(cv);
    const M = itemMats();
    const K = new Kit();
    const BAG = linC(0.22, 0.2, 0.19);
    K.box(M.matte, -0.17, -0.14, -0.05, 0.17, 0.14, 0.05, BAG);
    K.box(M.matte, -0.17, 0.04, 0.05, 0.17, 0.15, 0.07, linC(0.16, 0.15, 0.14));
    const face = makeSurface({ kind: 'box', map: tex, emMap: tex, emissive: new THREE.Color(0.25, 0.25, 0.25), ang: 1.45, wash: 0.9, line: 0.4 });
    const q = new THREE.PlaneGeometry(0.2, 0.2);
    q.translate(0, -0.02, 0.071);
    K.add(face, q, linC(1, 1, 1));
    const grp = K.build({ seed: 0.5 });
    grp.matrixAutoUpdate = true;
    this.game.scene.add(grp);
    this.objs.push(grp);
    this.bag = { c, grp };
  }

  moveBag() {
    // (the mark on the shirt: on his chest, facing out from it; gone with him)
    const sh = this.shirt;
    if (sh) {
      const c = sh.c;
      const j = c.fig && c.fig.j;
      if (!c.alive || !j || !j.neck || c.fig.dissolve > 0.55 || !c.fig.visible) sh.grp.visible = false;
      else {
        const fx = Math.sin(c.yaw);
        const fz = Math.cos(c.yaw);
        const S = c.fig.scale || 1;
        sh.grp.visible = true;
        sh.grp.position.set(j.neck.x + (j.hip.x - j.neck.x) * 0.32 + fx * 0.165 * S, j.neck.y + (j.hip.y - j.neck.y) * 0.32, j.neck.z + (j.hip.z - j.neck.z) * 0.32 + fz * 0.165 * S);
        sh.grp.rotation.set(0, c.yaw, 0);
      }
    }
    const b = this.bag;
    if (!b) return;
    const c = b.c;
    if (!c.alive || !c.fig.j || !c.fig.j.hip) {
      b.grp.visible = false;
      return;
    }
    const h = c.fig.j.hip;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    // (on his left hip, its face out to the side)
    b.grp.position.set(h.x + fz * 0.27, h.y - 0.05, h.z - fx * 0.27);
    b.grp.rotation.set(0, c.yaw + Math.PI / 2, 0);
  }

  // ------------------------------------------------------------------ rubbed out
  // (v5, ROADMAP 18) as a pencil drawing is rubbed out: an eraser going over it in strokes, back and
  // forth, row after row from its top down - wherever it has been once the colours are gone and the
  // paper shows through, its lines all that is left; where it has been again, those go too. Crumbs of
  // it falling; whoever rides it gone as the eraser comes over them. Two and a half seconds, and then
  // the evening where it stood.
  //
  // The mask the eraser leaves (a picture of where it has been, in the wheel's own upright plane - its
  // axle's way flattened out of it) is in the wheel's pens from the moment it is built
  // (render/glsl.js USE_ERASEMASK), so that nothing new has to be made ready for the graphics card
  // the moment it is rubbed out: on a phone that would stop the picture for a moment, right then.
  prepErase() {
    const S = ERASE.px;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    // the world -> the wheel's frame (its turn undone, the hub at the origin) -> (u, v): its z across,
    // its y up, ERASE.half metres either side of the hub
    const hubY = WHEEL.deck + WHEEL.hubUp;
    const H = ERASE.half;
    const toLocal = new THREE.Matrix4().makeRotationY(-WHEEL.yaw).multiply(new THREE.Matrix4().makeTranslation(-WHEEL.x, -hubY, -WHEEL.z));
    const toUv = new THREE.Matrix4().set(0, 0, 1 / (2 * H), 0.5, 0, 1 / (2 * H), 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 1);
    const U = { uEraseMask: { value: tex }, uEraseMat: { value: toUv.multiply(toLocal) }, uEraserAt: { value: new THREE.Vector3(0, 0, 0) } };
    const copies = new Map();
    for (const p of [this.root, this.platG]) {
      p.traverse((m) => {
        if (!m.isMesh || !m.material || !m.material.uniforms || !m.material.uniforms.uMatOn) return;
        let v = copies.get(m.material);
        if (!v) {
          v = surfaceVariant(m.material, U);
          delete v.defines.SOLID;
          v.defines.USE_ERASEMASK = '';
          sortDefines(v);
          // (its shadow as it was, until it is gone)
          v.userData.depth = m.material.userData.depth || null;
          copies.set(m.material, v);
        }
        m.material = v;
      });
    }
    // (where the eraser has been, coarsely, for the riders: rubbed or not)
    const G = ERASE.grid;
    this.eraseMask = { c, ctx, tex, U, grid: new Float32Array(G * G), mats: [...copies.values()] };
    // (ROADMAP 18.9) where the eraser is in the world, which way it rubs there, and whether it is
    // rubbing: for the eyes of whoever watches it and for the comic's rubbing marks (game/prologue/
    // comic.js rub)
    HUB.set(WHEEL.x, WHEEL.deck + WHEEL.hubUp, WHEEL.z);
    this.eraser = { pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0.83, 0.55).normalize().applyAxisAngle(UPV, WHEEL.yaw), along: new THREE.Vector3(0, 0, 1).applyAxisAngle(UPV, WHEEL.yaw), on: false, rub: 0, w: ERASE.w };
    const p0 = this.eraserAt(0, { z: 0, y: 0, rub: 0 });
    this.eraser.pos.set(-1, p0.y, p0.z).applyAxisAngle(UPV, WHEEL.yaw).add(HUB);
  }

  erase() {
    if (this.wheelGone || this.erasing || !this.eraseMask) return;
    this.erasing = { t: 0, last: null, rubT: 0, rubs: 0, gone: 0, total: this.riders.length };
    // (the giant pencil only when asked for, ?pencil=1: otherwise it was made visible here, never
    // moved - its tick waits for the same - and hung in the sky over where the wheel had been)
    if (this.pencil && PENCIL_SHOWN) {
      this.pencil.mode = 'rub';
      this.pencil.grp.visible = true;
    }
    if (this.eraser) this.eraser.on = true;
  }

  // (ROADMAP 18.9) what rubs it out, seen: a giant pencil out of the sky, its eraser end down on the
  // wheel - whoever watches knows at once what is happening to it. Along +y from the eraser's tip: the
  // eraser, worn round at its end; the tin band and its ridges; the yellow six-sided pencil up out of
  // the picture. Built hidden with the wheel, in the pens the city's things already have
  buildPencil() {
    const M = itemMats();
    const K = new Kit();
    const R = PENCIL.r;
    const PINK = linC(ERASER_PINK[0], ERASER_PINK[1], ERASER_PINK[2]);
    const ROSE = linC(0.78, 0.4, 0.46);
    const TIN = linC(0.84, 0.84, 0.88);
    const TIN_D = linC(0.5, 0.5, 0.56);
    const YEL = linC(0.99, 0.76, 0.14);
    K.cyl(M.round, R * 0.78, R, 0, R * 0.3, ROSE, { axis: 'y', segs: 22 });
    K.cyl(M.round, R, R, R * 0.3, R * 1.5, PINK, { axis: 'y', segs: 22 });
    K.cyl(M.metal, R * 1.04, R * 1.04, R * 1.5, R * 2.55, TIN, { axis: 'y', segs: 22 });
    for (const y of [1.72, 2.02, 2.32]) K.torus(M.metal, R * 1.05, R * 0.045, 0, R * y, 0, TIN_D, Math.PI / 2);
    K.cyl(M.paint, R, R, R * 2.55, R * 30, YEL, { axis: 'y', segs: 6 });
    const grp = K.build({ seed: 0.77 });
    grp.matrixAutoUpdate = true;
    grp.visible = false;
    this.game.scene.add(grp);
    this.objs.push(grp);
    HUB.set(WHEEL.x, WHEEL.deck + WHEEL.hubUp, WHEEL.z);
    this.pencil = { grp, mode: 'off', t: 0, tip: new THREE.Vector3(), from: new THREE.Vector3(), lean: 0.6, lz: 0 };
    this.placePencil(0, 120, 0.6);
  }

  // the pencil's eraser at (z, y) of the wheel's frame (just in front of it), leaning back up into the
  // sky - towards the city, and away from where it is going (lean)
  placePencil(z, y, lean) {
    const P = this.pencil;
    P.tip.set(-PENCIL.front, y, z).applyAxisAngle(UPV, WHEEL.yaw).add(HUB);
    _v.set(-0.38, 1, lean).normalize().applyAxisAngle(UPV, WHEEL.yaw);
    _q.setFromUnitVectors(UPV, _v);
    P.grp.position.copy(P.tip);
    P.grp.quaternion.copy(_q);
  }

  // (the director, the moment before) it comes down out of the sky to the top of the wheel
  pencilIn(dur = PENCIL.down) {
    const P = this.pencil;
    if (!P || this.wheelGone || !PENCIL_SHOWN) return;
    P.mode = 'down';
    P.t = 0;
    P.dur = dur;
    P.grp.visible = true;
  }

  tickPencil(dt) {
    const P = this.pencil;
    P.t += dt;
    const p = { z: 0, y: 0, rub: 0 };
    if (P.mode === 'down') {
      // (eased in, slowing as it comes to the paper)
      const k = Math.min(1, P.t / P.dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.eraserAt(0, p);
      this.placePencil(p.z, p.y + 95 * (1 - e), 0.55 * (1 - e) - 0.1);
      P.lz = p.z;
      P.ly = p.y;
      if (k >= 1 && !this.erasing) P.mode = 'wait';
    } else if (P.mode === 'rub') {
      const e = this.erasing;
      if (!e || e.t > ERASE.T) {
        P.mode = 'up';
        P.t = 0;
        return;
      }
      this.eraserAt(e.t, p);
      // (dragged a little behind where it is going, rocking with the rubbing)
      const vz = (p.z - (P.lz || p.z)) / Math.max(dt, 1e-3);
      P.lean += (Math.max(-0.45, Math.min(0.45, -vz * 0.012)) - P.lean) * (1 - Math.exp(-dt * 8));
      this.placePencil(p.z, p.y, P.lean + p.rub * 0.06);
      P.lz = p.z;
      P.ly = p.y;
    } else if (P.mode === 'up') {
      // (lifted off and away, up into the sky it came from)
      const k = Math.min(1, P.t / PENCIL.up);
      const e = k * k;
      this.placePencil(P.lz, P.ly + 110 * e, P.lean * (1 - k) - 0.3 * e);
      if (k >= 1) {
        P.mode = 'off';
        P.grp.visible = false;
      }
    }
  }

  // how rubbed the wheel is at (z, y) in its own frame (0 untouched; more than 0.45 its colours gone)
  rubbed(z, y) {
    const E = this.eraseMask;
    if (!E) return 0;
    const G = ERASE.grid;
    const i = Math.floor((z / (2 * ERASE.half) + 0.5) * G);
    const j = Math.floor((y / (2 * ERASE.half) + 0.5) * G);
    if (i < 0 || j < 0 || i >= G || j >= G) return 0;
    return E.grid[j * G + i];
  }

  // a point of the world -> how rubbed it is there
  rubbedAt(p) {
    if (!this.root) return 1;
    _v.copy(p).sub(this.root.position).applyAxisAngle(UPV, -WHEEL.yaw);
    return this.rubbed(_v.z, _v.y);
  }

  // where the eraser is at time t of its two and a half seconds (the wheel's frame: z across, y up)
  eraserAt(t, out) {
    const T = ERASE.T;
    const rows = ERASE.rows;
    const k = Math.min(1, t / T);
    const row = Math.min(rows - 1, Math.floor(k * rows));
    const f = k * rows - row;
    const top = 25;
    const bot = -31;
    const y = top + ((bot - top) * row) / (rows - 1);
    const span = 33;
    const dir = row % 2 === 0 ? 1 : -1;
    // (across the row and back again: once over it the colours go - the paper comes through, the
    // lines all that is left - and on the way back the lines go too. Eased at each turn, as a hand
    // turns)
    const gf = f < 0.5 ? f * 2 : 2 - f * 2;
    const ff = gf * gf * (3 - 2 * gf);
    const z = dir * (-span + 2 * span * ff);
    // rubbing: back and forth along a slant, quick, as a hand rubs
    const rub = Math.sin(t * Math.PI * 2 * ERASE.hz);
    out.z = z + rub * 4.2 * 0.55;
    out.y = y + rub * 4.2 * 0.83 + Math.sin(t * 3.1) * 1.5;
    out.rub = rub;
    return out;
  }

  stepErase(dt) {
    const e = this.erasing;
    const E = this.eraseMask;
    e.t += dt;
    const g = this.game;
    if (e.t <= ERASE.T + 0.05) {
      // its way since the last frame, in a few short steps (the strokes stay round at fast rubbing)
      const steps = 4;
      const p = { z: 0, y: 0, rub: 0 };
      if (!e.last) e.last = { ...this.eraserAt(Math.max(0, e.t - dt), p) };
      for (let s = 1; s <= steps; s++) {
        this.eraserAt(Math.max(0, e.t - dt + (dt * s) / steps), p);
        this.rubStroke(e.last, p);
        e.last.z = p.z;
        e.last.y = p.y;
      }
      E.tex.needsUpdate = true;
      // (where it is: its glow on the wheel, the eyes on it, the comic's marks round it)
      const X = this.eraser;
      if (X) {
        X.pos.set(-1, p.y, p.z).applyAxisAngle(UPV, WHEEL.yaw).add(HUB);
        X.rub = p.rub;
        E.U.uEraserAt.value.set(p.z / (2 * ERASE.half) + 0.5, p.y / (2 * ERASE.half) + 0.5, (ERASE.w * 0.62) / (2 * ERASE.half));
      }
      // a stroke's turn: its sound, its crumbs
      const turn = Math.sign(p.rub) !== Math.sign(e.lastRub || 0);
      e.lastRub = p.rub;
      if (turn) {
        // (ROADMAP 18.9: loud enough to be heard over the evening as what it is)
        g.audio.play('rub', 1.1 + Math.random() * 0.4);
        e.rubs++;
      }
      if (this.root && g.fx) {
        const w = this.toWorld(_w2.set(0, p.y, p.z), _w3);
        // (a few crumbs of eraser and of the drawing it takes: grey, pink, a little of its colours)
        g.fx.spray(w.x, w.y, w.z, (Math.random() - 0.5) * 0.4, -0.2, (Math.random() - 0.5) * 0.4, 10, 7, CRUMB, { bits: true, len: 1.1, life: 1.5, cone: 1.1 });
      }
    } else if (e.t > ERASE.T + 0.4) {
      if (this.eraser) this.eraser.on = false;
      this.removeWheel();
      this.erasing = null;
      return;
    } else {
      // what is left of it (a line or two the eraser missed): rubbed away with the last of it
      const S = ERASE.px;
      E.ctx.save();
      E.ctx.globalCompositeOperation = 'lighter';
      E.ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, dt * 2.6).toFixed(3)})`;
      E.ctx.fillRect(0, 0, S, S);
      E.ctx.restore();
      E.tex.needsUpdate = true;
      for (let i = 0; i < E.grid.length; i++) E.grid[i] += dt * 2.6;
    }
    // whoever rides: gone as the eraser comes over them
    let gone = 0;
    for (const r of this.riders) {
      if (!r.gone) {
        const o = this.gPos[r.gi];
        if (this.rubbed(o.z + r.lz, o.y - FLOOR + 1) > 0.6) r.gone = true;
      }
      if (r.gone) gone++;
    }
    e.gone = gone;
    e.k = e.total ? gone / e.total : 1;
  }

  // the eraser from a to b (the wheel's frame): into the mask, and into the coarse grid
  rubStroke(a, b) {
    const E = this.eraseMask;
    const ctx = E.ctx;
    const S = ERASE.px;
    const H = ERASE.half;
    const cx = (z) => (z / (2 * H) + 0.5) * S;
    const cy = (y) => (0.5 - y / (2 * H)) * S;
    const w = (ERASE.w / (2 * H)) * S;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // (an eraser's stroke: streaked along its way, rubbed harder in the middle)
    const dx = b.z - a.z;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    // (how much one going-over takes off, whatever the frame rate: a point under the eraser is under
    // about w / l of these steps as it goes by - so each gives l / w of ERASE.pass)
    const per = Math.min(0.3, (ERASE.pass * Math.hypot(dx, dy)) / ERASE.w);
    for (let k = -2; k <= 2; k++) {
      const o = (k / 2) * ERASE.w * 0.32;
      ctx.strokeStyle = `rgba(255,255,255,${(per * (k === 0 ? 0.62 : 0.4)).toFixed(4)})`;
      ctx.lineWidth = w * (k === 0 ? 1 : 0.55);
      ctx.beginPath();
      ctx.moveTo(cx(a.z + nx * o), cy(a.y + ny * o));
      ctx.lineTo(cx(b.z + nx * o), cy(b.y + ny * o));
      ctx.stroke();
    }
    ctx.restore();
    // the grid: the same, roughly (its middle)
    const G = ERASE.grid;
    const hw = ERASE.w * 0.5;
    const cell = (2 * H) / G;
    const i0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - hw + H) / cell));
    const i1 = Math.min(G - 1, Math.floor((Math.max(a.z, b.z) + hw + H) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - hw + H) / cell));
    const j1 = Math.min(G - 1, Math.floor((Math.max(a.y, b.y) + hw + H) / cell));
    for (let j = j0; j <= j1; j++) {
      const y = -H + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const z = -H + (i + 0.5) * cell;
        // distance to the segment
        const t = Math.max(0, Math.min(1, ((z - a.z) * dx + (y - a.y) * dy) / (l * l)));
        const d = Math.hypot(z - (a.z + dx * t), y - (a.y + dy * t));
        if (d < hw) E.grid[j * G + i] += per * (1 - (d / hw) * 0.5);
      }
    }
  }

  // the wheel, its platform, its booth and gate, gone - as if they had never been
  removeWheel() {
    const g = this.game;
    for (const o of [this.root, this.platG]) {
      if (!o) continue;
      g.scene.remove(o);
      o.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
      this.objs = this.objs.filter((q) => q !== o);
    }
    this.root = null;
    this.platG = null;
    this.wheelGone = true;
    this.riders = [];
    if (this.pencil) this.pencil.grp.visible = false;
    // (the eraser's mask and the pens that read it)
    if (this.eraseMask) {
      for (const m of this.eraseMask.mats) m.dispose();
      this.eraseMask.tex.dispose();
      this.eraseMask = null;
    }
    // (what was solid of it)
    const col = g.world.collision;
    for (const id of this.wheelCols || []) col.remove(id);
    this.wheelCols = [];
  }

  dispose() {
    const g = this.game;
    for (const o of this.objs) {
      g.scene.remove(o);
      o.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
    }
    this.objs = [];
    const col = g.world.collision;
    for (const id of this.cols) col.remove(id);
    for (const id of this.wheelCols || []) col.remove(id);
    this.cols = [];
    this.wheelCols = [];
    for (const gar of this.garages) gar.dispose(col);
    this.park.dispose();
    this.built = false;
  }
}

// a little repeatable dice
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

void BLACK2D;
