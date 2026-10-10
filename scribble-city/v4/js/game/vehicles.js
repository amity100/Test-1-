import * as THREE from 'three';
import { BLUEPRINTS } from './blueprints.js';
import { Kit, itemMats, warpFor, linC } from './items.js';
import { groundHeight } from '../world/layout.js';
import { drawWipers, wiperSweep, KINDS, sidePoint } from '../render/cars.js';
import { MODELS, RIDES, PEDAL, seatOn, updateBoat, updatePlane, drawWake } from './rides.js';
import { clamp, damp, dampAngle, angleDiff } from '../core/util.js';

// The things you drive: the city's own cars (taken from the traffic or from the curb), and the
// ones you drew - the scribble car, the crazy tank, the motorbike, the paper helicopter. They are
// made like everything else in the city (glossy paint full of the sunset), and how well you drew
// them shows: a wonky drawing pulls to one side, a bad one barely runs.

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _stripe = new THREE.Matrix4();
// (ROADMAP 4.6) the car's own frame this frame (render/cars.js), for what is drawn on it
const _cm = new THREE.Matrix4();
const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();
const MUD = [0.42, 0.33, 0.24];
const MUD_INK = [0.36, 0.27, 0.2];
const SHINE = [3.2, 3.2, 3.0];
const RIM_UP = [null, [0.86, 0.86, 0.9], [0.2, 0.2, 0.24], [1.0, 0.78, 0.3]];
const SIDES = [1, -1];
const SIDE_L = [1];
const SIDE_R = [-1];
const UP = new THREE.Vector3(0, 1, 0);

const VEH = {
  car: { width: 1.95, hp: 170, len: 2.26 },
  tank: { width: 3.2, hp: 520, len: 3.3 },
  bike: { width: 0.6, hp: 120, len: 1.1 },
  copter: { width: 1.6, hp: 320, len: 3.0 },
  // (ROADMAP 4.8: a jet ski's and a boat's, a light plane's)
  boat: { width: 1.9, hp: 160, len: 2.6 },
  plane: { width: 9.6, hp: 170, len: 3.8 },
};

const QUALITY = {
  perfect: { speed: 1.15, accel: 1.2, pull: 0, stall: 0, wobble: 0, hp: 1.3, reload: 0.8 },
  good: { speed: 1, accel: 1, pull: 0, stall: 0, wobble: 0, hp: 1, reload: 1 },
  wonky: { speed: 0.7, accel: 0.7, pull: 0.28, stall: 0.05, wobble: 0.5, hp: 0.8, reload: 1.6 },
  fail: { speed: 0.22, accel: 0.35, pull: 0.6, stall: 0.2, wobble: 1.4, hp: 0.5, reload: 3 },
};

// ------------------------------------------------------------------ the drawn ones' models
// (a car's own frame: x right, y up, z forward; on the ground at y = 0)
function tankModel(grade) {
  const M = itemMats();
  const hull = new Kit();
  const olive = linC(0.62, 0.7, 0.44);
  const dark = linC(0.32, 0.32, 0.36);
  // the tracks, each a long rounded band with five wheels showing
  for (const sx of [-1, 1]) {
    hull.box(M.matte, sx * 1.6 - 0.32, 0.18, -2.8, sx * 1.6 + 0.32, 0.95, 2.8, dark);
    hull.cyl(M.matte, 0.39, 0.39, sx * 1.6 - 0.32, sx * 1.6 + 0.32, dark, { axis: 'z', segs: 14 });
    for (let k = 0; k < 5; k++) {
      const z = -2.2 + k * 1.1;
      const g = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 14).rotateZ(Math.PI / 2);
      g.translate(sx * (1.6 + 0.33), 0.5, z);
      hull.add(M.metal, g, linC(0.6, 0.6, 0.64));
    }
    for (const z of [-2.8, 2.8]) {
      const g = new THREE.CylinderGeometry(0.39, 0.39, 0.64, 14).rotateZ(Math.PI / 2);
      g.translate(sx * 1.6, 0.57, z);
      hull.add(M.matte, g, dark);
    }
  }
  // the hull, sloping at the front, a plough like a big eraser blade
  hull.box(M.paint, -1.3, 0.75, -2.7, 1.3, 1.55, 2.4, olive);
  const nose = new THREE.BoxGeometry(2.6, 0.7, 0.9);
  nose.rotateX(-0.6);
  nose.translate(0, 1.1, 2.7);
  hull.add(M.paint, nose, olive);
  hull.box(M.round, -1.9, 0.12, 3.25, 1.9, 0.75, 3.45, linC(0.93, 0.55, 0.6));
  hull.box(M.matte, -1.3, 1.55, -2.7, 1.3, 1.62, -1.8, linC(0.45, 0.5, 0.36));
  const body = hull.build({ warp: warpFor(grade, 3) });
  // the turret, its long barrel, the hatch, the antenna and its little flag
  const tur = new Kit();
  tur.cyl(M.paint, 1.15, 1.0, 0, 0.8, linC(0.56, 0.66, 0.4), { axis: 'y', segs: 18 });
  tur.cyl(M.metal, 0.2, 0.18, 0.6, 4.2, linC(0.42, 0.46, 0.36), { y: 0.45, segs: 12 });
  tur.cyl(M.metal, 0.26, 0.26, 4.0, 4.35, linC(0.3, 0.32, 0.3), { y: 0.45, segs: 12 });
  tur.cyl(M.matte, 0.38, 0.38, 0.8, 0.95, linC(0.45, 0.5, 0.36), { axis: 'y', x: -0.35, segs: 12 });
  tur.cyl(M.metal, 0.02, 0.02, 0.8, 2.6, linC(0.3, 0.3, 0.34), { axis: 'y', x: 0.6, z: -0.5, segs: 5 });
  const flag = new THREE.BoxGeometry(0.03, 0.4, 0.6);
  flag.translate(0.6, 2.35, -0.8);
  tur.add(M.paint, flag, linC(0.98, 0.45, 0.5));
  const turret = tur.build({ warp: warpFor(grade, 4) });
  turret.matrixAutoUpdate = true;
  turret.position.set(0, 1.55, -0.2);
  body.add(turret);
  return { body, turret, muzzle: new THREE.Vector3(0, 0.45, 4.4), wheelsZ: [] };
}

function bikeModel(grade) {
  const M = itemMats();
  const K = new Kit();
  const red = linC(0.88, 0.25, 0.22);
  const dark = linC(0.18, 0.18, 0.22);
  // the frame, the tank and the fairing in glossy red, the seat, the exhaust
  K.box(M.paint, -0.2, 0.55, -0.45, 0.2, 0.95, 0.55, red);
  const fair = new THREE.BoxGeometry(0.42, 0.55, 0.5);
  fair.rotateX(0.5);
  fair.translate(0, 1.0, 0.72);
  K.add(M.paint, fair, red);
  K.box(M.matte, -0.17, 0.95, -0.75, 0.17, 1.05, 0.1, dark);
  K.cyl(M.metal, 0.06, 0.05, -1.05, -0.2, linC(0.8, 0.8, 0.84), { x: 0.24, y: 0.42 });
  K.box(M.metal, -0.08, 0.35, -0.2, 0.08, 0.6, 0.35, linC(0.55, 0.55, 0.6));
  // the forks and the bars, the light
  for (const sx of [-1, 1]) {
    const f = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6);
    f.rotateX(-0.42);
    f.translate(sx * 0.12, 0.85, 1.05);
    K.add(M.metal, f, linC(0.8, 0.8, 0.84));
  }
  K.cyl(M.metal, 0.025, 0.025, -0.38, 0.38, dark, { axis: 'z', y: 1.38, segs: 6, rot: Math.PI / 2 });
  const bars = new THREE.CylinderGeometry(0.025, 0.025, 0.76, 6).rotateZ(Math.PI / 2);
  bars.translate(0, 1.38, 0.82);
  K.add(M.metal, bars, dark);
  K.sphere(M.glow, 0.09, 0, 1.15, 1.02, linC(1.0, 0.95, 0.75), 1, 1, 0.6, 10);
  K.box(M.glow, -0.12, 0.72, -0.82, 0.12, 0.78, -0.78, linC(1.0, 0.2, 0.25));
  const body = K.build({ warp: warpFor(grade, 5) });
  // the wheels (they roll)
  const wheels = [];
  for (const z of [-0.72, 1.28]) {
    const W = new Kit();
    const tyre = new THREE.TorusGeometry(0.34, 0.09, 8, 20).rotateY(Math.PI / 2);
    W.add(M.matte, tyre, dark);
    const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10).rotateZ(Math.PI / 2);
    W.add(M.metal, hub, linC(0.75, 0.75, 0.8));
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.BoxGeometry(0.02, 0.6, 0.03);
      sp.rotateX((k / 5) * Math.PI);
      W.add(M.metal, sp, linC(0.75, 0.75, 0.8));
    }
    const w = W.build();
    w.matrixAutoUpdate = true;
    w.position.set(0, 0.43, z);
    body.add(w);
    wheels.push(w);
  }
  return { body, wheels, seat: [0, 1.0, -0.3], bar: [0, 1.38, 0.82] };
}

function copterModel(grade) {
  const M = itemMats();
  const K = new Kit();
  const paper = linC(0.97, 0.95, 0.9);
  const lines = linC(0.62, 0.72, 0.9);
  // a cabin folded from a notebook page: a faceted egg, a bubble window, a long tail, skids
  const cab = new THREE.IcosahedronGeometry(1.0, 1);
  cab.scale(1.0, 0.9, 1.45);
  cab.translate(0, 1.6, 0.2);
  K.add(M.matte, cab, paper);
  K.sphere(M.glass, 0.72, 0, 1.75, 0.95, linC(0.6, 0.78, 0.95), 1, 0.85, 0.75, 12);
  const tail = new THREE.CylinderGeometry(0.18, 0.4, 3.4, 6).rotateX(Math.PI / 2);
  tail.translate(0, 1.75, -2.5);
  K.add(M.matte, tail, paper);
  const fin = new THREE.BoxGeometry(0.06, 1.0, 0.6);
  fin.translate(0, 2.2, -4.0);
  K.add(M.matte, fin, paper);
  // the blue rules of the page, round the cabin
  for (const y of [1.25, 1.55, 1.85]) K.cyl(M.matte, 0.985 * Math.sqrt(1 - ((y - 1.6) / 0.9) ** 2), 0.985 * Math.sqrt(1 - ((y - 1.6) / 0.9) ** 2), y, y + 0.02, lines, { axis: 'y', z: 0.2, segs: 20 });
  for (const sx of [-1, 1]) {
    K.cyl(M.metal, 0.04, 0.04, -0.9, 1.1, linC(0.35, 0.35, 0.4), { x: sx * 0.75, y: 0.15, segs: 6 });
    for (const z of [-0.5, 0.7]) K.cyl(M.metal, 0.03, 0.03, 0.15, 0.75, linC(0.35, 0.35, 0.4), { axis: 'y', x: sx * 0.68, z, segs: 5 });
  }
  K.cyl(M.metal, 0.07, 0.07, 2.4, 2.9, linC(0.4, 0.4, 0.45), { axis: 'y', z: 0.2, segs: 8 });
  const body = K.build({ warp: warpFor(grade, 6) });
  const rot = (len, wid) => {
    const R = new Kit();
    for (const a of [0, Math.PI / 2]) {
      const b = new THREE.BoxGeometry(len * 2, 0.02, wid);
      b.rotateY(a);
      R.add(M.matte, b, paper);
    }
    const g = R.build();
    g.matrixAutoUpdate = true;
    return g;
  };
  const rotor = rot(3.6, 0.32);
  rotor.position.set(0, 2.92, 0.2);
  body.add(rotor);
  const tailRotor = rot(0.6, 0.12);
  tailRotor.rotation.z = Math.PI / 2;
  tailRotor.position.set(0.12, 2.25, -4.0);
  body.add(tailRotor);
  return { body, rotor, tailRotor };
}

// The city's own helicopters (the evening news over downtown, the police when it gets hot): a
// real one's size and shape, so even far over the towers it reads as a helicopter. livery:
// 'news' (white, an orange band) or 'police' (navy, white).
function cityCopterModel(livery = 'news') {
  const M = itemMats();
  const K = new Kit();
  const police = livery === 'police';
  const top = police ? linC(0.13, 0.17, 0.4) : linC(0.96, 0.95, 0.96);
  const belly = police ? linC(0.94, 0.94, 0.97) : linC(0.18, 0.2, 0.34);
  const band = police ? linC(0.35, 0.62, 0.98) : linC(1.0, 0.5, 0.14);
  const dark = linC(0.12, 0.12, 0.15);
  const glass = linC(0.34, 0.5, 0.72);
  // the cabin: a long egg, darker underneath, a band along its side, the glass nose
  K.sphere(M.paint, 1, 0, 1.6, 0.5, top, 1.22, 1.18, 2.3, 16);
  K.sphere(M.paint, 1, 0, 1.22, 0.5, belly, 1.26, 0.62, 2.34, 16);
  K.sphere(M.paint, 1, 0, 1.55, 0.35, band, 1.245, 0.16, 2.18, 16);
  K.sphere(M.glass, 1, 0, 1.92, 1.75, glass, 1.0, 0.82, 1.2, 14);
  for (const sx of [-1, 1]) K.sphere(M.glass, 0.5, sx * 0.98, 1.85, 0.05, glass, 0.32, 0.75, 1.15, 10);
  // the engine on its back, the mast, the hub
  K.cyl(M.paint, 0.55, 0.42, -1.5, 1.0, top, { y: 2.72, segs: 12 });
  K.cyl(M.metal, 0.11, 0.11, 2.9, 3.45, dark, { axis: 'y', z: 0.1, segs: 8 });
  K.sphere(M.metal, 0.24, 0, 3.45, 0.1, dark, 1, 0.6, 1, 10);
  // the tail boom, the fin, the little wings at the back
  K.cyl(M.paint, 0.17, 0.44, -7.5, -1.4, top, { y: 1.95, segs: 10 });
  const fin = new THREE.BoxGeometry(0.1, 1.6, 0.9);
  fin.rotateX(-0.35);
  fin.translate(0, 2.55, -7.35);
  K.add(M.paint, fin, police ? band : belly);
  K.box(M.paint, -1.15, 1.88, -6.4, 1.15, 1.98, -5.8, police ? band : belly);
  // the skids
  for (const sx of [-1, 1]) {
    K.cyl(M.metal, 0.07, 0.07, -1.9, 2.4, dark, { x: sx * 1.15, y: 0.1, segs: 6 });
    const tip = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6);
    tip.rotateX(Math.PI / 2 - 0.7);
    tip.translate(sx * 1.15, 0.28, 2.6);
    K.add(M.metal, tip, dark);
    for (const z of [-1.0, 1.4]) {
      const st = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5);
      st.rotateZ(sx * 0.45);
      st.translate(sx * 0.98, 0.5, z);
      K.add(M.metal, st, dark);
    }
  }
  // the camera ball under the nose, the lights (red to the left, green to the right, a beacon)
  K.sphere(M.metal, 0.26, 0, 0.62, 2.35, dark, 1, 1, 1, 10);
  K.sphere(M.glow, 0.09, 1.15, 1.93, -6.1, linC(1.0, 0.2, 0.2), 1, 1, 1, 8);
  K.sphere(M.glow, 0.09, -1.15, 1.93, -6.1, linC(0.3, 1.0, 0.4), 1, 1, 1, 8);
  K.sphere(M.glow, 0.1, 0, 3.05, -1.3, linC(1.0, 0.25, 0.2), 1, 1, 1, 8);
  if (police) K.box(M.glow, -0.5, 3.0, 0.6, 0.5, 3.1, 0.9, linC(0.4, 0.6, 1.0));
  const body = K.build({ seed: 0.31 });
  // four long blades, and two at the tail
  const R = new Kit();
  for (let k = 0; k < 4; k++) {
    const b = new THREE.BoxGeometry(0.34, 0.05, 5.6);
    b.translate(0, 0, 2.95);
    b.rotateY((k * Math.PI) / 2);
    R.add(M.metal, b, dark);
  }
  const rotor = R.build();
  rotor.matrixAutoUpdate = true;
  rotor.position.set(0, 3.5, 0.1);
  body.add(rotor);
  const T = new Kit();
  for (const a of [0, Math.PI]) {
    const b = new THREE.BoxGeometry(0.04, 0.85, 0.18);
    b.translate(0, 0.45, 0);
    b.rotateX(a);
    T.add(M.metal, b, dark);
  }
  const tailRotor = T.build();
  tailRotor.matrixAutoUpdate = true;
  tailRotor.position.set(0.18, 2.55, -7.45);
  body.add(tailRotor);
  return { body, rotor, tailRotor };
}

// ------------------------------------------------------------------ one vehicle
class Vehicle {
  constructor(mgr, kind, grade, score, stock = null) {
    this.mgr = mgr;
    this.game = mgr.game;
    // (ROADMAP 4.8: the new drawings ride as one of the kinds - a bicycle as a bike, a jet ski
    // as a boat - with a model of their own)
    this.model = RIDES[kind] ? kind : null;
    if (this.model) kind = RIDES[kind];
    this.kind = kind;
    this.grade = grade;
    this.score = score;
    this.q = QUALITY[grade];
    this.bp = BLUEPRINTS[this.model || kind];
    this.cfg = VEH[kind];
    this.maxHp = Math.round(this.cfg.hp * this.q.hp);
    this.hp = this.maxHp;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.speedAbs = 0;
    this.vy = 0;
    this.alt = 0;
    this.turretYaw = 0;
    this.reload = 0;
    this.wheelSpin = 0;
    this.time = 0;
    this.reveal = 0;
    this.dead = false;
    this.driver = null;
    this.steer = 0;
    this.radius = kind === 'tank' ? 2.6 : kind === 'copter' ? 2.6 : kind === 'bike' ? 0.9 : 1.6;
    this.flies = kind === 'copter';
    this.stock = stock;
    this.group = new THREE.Group();
    if (kind === 'car') {
      // a car: drawn by the city's car batches every frame (see draw)
      this.carKind = stock ? stock.kind || 'sedan' : 'sports';
      this.color = stock ? stock.color : [0.98, 0.42, 0.36];
      this.extra = stock ? (stock.police ? 'police' : stock.taxi ? 'taxi' : null) : null;
      this.halfLen = 2.3;
      this.halfWid = 0.98;
      this.heightM = this.carKind === 'van' ? 2.15 : 1.45;
      this.seat = true;
      this.label = stock ? (stock.police ? 'ניידת' : stock.taxi ? 'מונית' : 'מכונית') : BLUEPRINTS.car.name;
      if (!stock) this.racing = true;
      this.reveal = stock ? 1 : 0;
    } else if (this.model) {
      const m = MODELS[this.model](grade);
      Object.assign(this, m);
      this.body.matrixAutoUpdate = true;
      this.group.add(this.body);
      this.seat = true;
      this.label = this.bp.name;
      this.flies = kind === 'plane';
      if (kind === 'boat') this.pos.y = -0.8;
      mgr.game.scene.add(this.group);
    } else {
      const m = kind === 'tank' ? tankModel(grade) : kind === 'bike' ? bikeModel(grade) : copterModel(grade);
      Object.assign(this, m);
      this.body.matrixAutoUpdate = true;
      this.group.add(this.body);
      this.halfLen = kind === 'tank' ? 3.3 : kind === 'bike' ? 1.2 : 2.6;
      this.halfWid = kind === 'tank' ? 2.0 : kind === 'bike' ? 0.4 : 1.2;
      this.heightM = kind === 'tank' ? 2.6 : kind === 'bike' ? 1.4 : 3.0;
      if (kind === 'bike') this.seat = true;
      this.muzzleLocal = this.muzzle;
      mgr.game.scene.add(this.group);
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
  }

  hurt(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.game.hud.hurtFlash();
    this.game.audio.play('clang', 0.5);
    if (this.hp <= 0) this.destroy();
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    const game = this.game;
    game.fx.boom(this.pos.x, this.pos.y + 1, this.pos.z, 6);
    game.audio.play('boom');
    game.camRig.addShake(0.6);
    if (this.driver) {
      game.exitVehicle(true);
      game.player.hurt(20, this.pos.x, this.pos.z);
    }
    this.removeAt = game.time + 0.2;
  }

  // (a car: its kind's seats, render/cars.js K.seat; ROADMAP 4.5)
  seatOf() {
    return (KINDS[this.carKind] || KINDS.sedan).seat;
  }

  // forward unit vector
  get fwd() {
    return _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  update(dt) {
    this.time += dt;
    if (this.materializing) {
      // (still turning from the drawing into the thing: it stands still where it was drawn)
      if (this.kind !== 'car') {
        this.group.position.copy(this.pos);
        this.group.rotation.set(0, this.yaw, 0);
      }
      return;
    }
    let pop = 1;
    if (this.reveal < 1) {
      // freshly drawn: it plops into the world with a little overshoot
      this.reveal = Math.min(1, this.reveal + dt / 0.8);
      const k = Math.min(1, this.reveal * 1.6) - 1;
      pop = Math.max(0.1, 1 + 2.70158 * k * k * k + 1.70158 * k * k);
    }
    this.pop = pop;
    const input = this.driver ? this.game.input : null;
    if ((this.kind === 'car' || this.kind === 'bike') && !this.game.classic) this.drive(dt, input);
    else if (this.kind === 'car' || this.kind === 'bike') this.updateCar(dt, input);
    else if (this.kind === 'tank') this.updateTank(dt, input);
    else if (this.kind === 'boat') updateBoat(this, dt, input);
    else if (this.kind === 'plane') {
      updatePlane(this, dt, input);
      if (this.dead) return;
    } else this.updateCopter(dt, input);
    this.wheelSpin += (this.speed * dt) / 0.36;
    if (this.kind === 'car') return;
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.yaw, 0);
    this.group.scale.setScalar(pop);
    if (this.model) {
      // (ROADMAP 4.8) the pedals going round, the boat on the waves, the plane pitched and banked
      if (this.crank) {
        this.crankA = (this.crankA || 0) + (this.speed * dt) / (0.34 * 2.4);
        this.crank.rotation.x = this.crankA;
      }
      if (this.kind === 'boat') {
        this.body.rotation.x = this.pitchV || 0;
        this.body.rotation.z = this.rollV || 0;
      } else if (this.kind === 'plane') {
        this.body.rotation.x = -(this.pitch || 0);
        this.body.rotation.z = -(this.roll || 0);
        this.prop.rotation.z += dt * (4 + (this.thr || 0) * 60);
        for (const w of this.wheels) w.rotation.x = this.flying ? w.rotation.x : this.wheelSpin;
        return;
      }
    }
    if (this.kind === 'copter') {
      // the rotor whirls (fast when someone flies it), the body leans into where it goes
      const spin = this.driver ? 26 : this.alt > 1.2 ? 14 : 2;
      this.rotor.rotation.y += dt * spin;
      this.tailRotor.rotation.x += dt * spin * 1.6;
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const fwdV = (this.vx || 0) * fx + (this.vz || 0) * fz;
      const sideV = (this.vx || 0) * fz - (this.vz || 0) * fx;
      this.body.rotation.x = damp(this.body.rotation.x, clamp(fwdV * 0.018, -0.3, 0.3), 3, dt);
      this.body.rotation.z = damp(this.body.rotation.z, clamp(sideV * 0.02, -0.35, 0.35), 3, dt) + Math.sin(this.time * 4.1) * 0.03 * this.q.wobble;
    } else if (this.kind === 'bike') {
      for (const w of this.wheels) w.rotation.x = this.wheelSpin * (this.grade === 'fail' ? 0.6 : 1);
      // leaning into the turns
      this.body.rotation.z = damp(this.body.rotation.z, clamp(-(this.turn || 0) * Math.min(1, this.speedAbs / 10) * 0.35, -0.5, 0.5), 6, dt);
    }
    if ((this.grade === 'fail' || this.grade === 'wonky') && this.kind !== 'copter') {
      this.body.position.y = Math.abs(Math.sin(this.wheelSpin * 2)) * 0.06 * this.q.wobble * Math.min(1, this.speedAbs / 3);
    }
  }

  // the cars are drawn with the city's car batches
  draw(cars) {
    if (this.kind !== 'car' || this.dead) return;
    const wob = this.grade === 'fail' || this.grade === 'wonky' ? Math.abs(Math.sin(this.wheelSpin * 2)) * 0.06 * this.q.wobble * Math.min(1, this.speedAbs / 3) : 0;
    const siren = this.extra === 'police' && this.driver ? Math.floor(this.game.time * 5) % 2 : -1;
    // (just drawn: still turning from the drawing into the car)
    const rv = this.mat ? this.mat.carRV : null;
    const U = this.up;
    cars.draw(this.carKind, this.dirt > 0.05 ? this.dustyColor() : this.color, this.pos.x, this.pos.y, this.pos.z, this.yaw, {
      spin: this.wheelSpin, steer: clamp((this.turn || 0) * 0.35, -0.45, 0.45), extra: this.extra || (this.racing ? 'plain' : null), siren, scale: this.pop || 1,
      lift: wob, roll: (this.grade === 'fail' ? Math.sin(this.time * 7) * 0.03 : 0) + (this.bodyRoll || 0), tilt: this.bodyPitch || 0, reveal: rv, dmg: this.dmg || null, signal: this.signal || 0,
      // (yours: the side windows down, you and whoever rides with you seen through them)
      open: !this.game.classic && !rv,
      // (the garage's work: ROADMAP 4.6)
      mods: U && !rv ? U : null, rim: U && U.tires ? RIM_UP[U.tires] : null, matrixOut: (this.design || this.dirt > 0.2 || this.shineT) && !rv ? _cm : null,
    });
    if (!rv && (this.design || this.dirt > 0.2 || this.shineT)) this.drawOn(_cm);
    // in the rain the wipers go (once somebody is at the wheel)
    const w = this.game.weather;
    if (w && w.cur.rain > 0.15 && this.driver && !rv) drawWipers(this.game.figures, this.carKind, this.pos.x, this.pos.y, this.pos.z, this.yaw, wiperSweep(this.game.time, w.cur.rain, 0.3), 991);
    if (this.racing) {
      // the drawn car has racing stripes over the bonnet and the roof
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const rx = -fz;
      const rz = fx;
      for (const s of [-0.22, 0.22]) {
        const x = this.pos.x + rx * s;
        const z = this.pos.z + rz * s;
        const base = _stripe.makeRotationY(this.yaw).setPosition(x, this.pos.y, z);
        if (rv) base.premultiply(rv.pre);
        cars.box(cars.trimBox, base, 0, 0.98, 1.0, 0.18, 0.05, 2.0, [0.98, 0.95, 0.88], rv);
      }
    }
  }

  // (ROADMAP 4.6) the dust on it: its colour gone a little brown (a step at a time, so the city's
  // cache of colours stays small)
  dustyColor() {
    const q = Math.round(Math.min(1, this.dirt) * 8) / 8;
    if (this._dq !== q || this._dc0 !== this.color) {
      this._dq = q;
      this._dc0 = this.color;
      const k = q * 0.38;
      this._dcol = this.color.map((c, i) => c + (MUD[i] - c) * k);
    }
    return this._dcol;
  }

  // what is drawn on the car (render/cars.js gave its frame, m): the design you drew in the paint
  // shop, on both its sides; mud splashed behind the wheels; the sparkle of a fresh wash
  drawOn(m) {
    const game = this.game;
    const fr = game.figures;
    const cam = game.camera.position;
    const d = Math.hypot(this.pos.x - cam.x, this.pos.z - cam.z);
    if (d > 80) return;
    // (a design keeps its size on the car: a little thinner from far away)
    const wk = clamp(9 / Math.max(1, d), 0.4, 1.25);
    // only the side that faces you (the other is behind the car), in fewer, longer strokes as it
    // gets further away
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const camSide = (cam.x - this.pos.x) * fz - (cam.z - this.pos.z) * fx;
    const along = Math.abs((cam.x - this.pos.x) * fx + (cam.z - this.pos.z) * fz);
    const one = Math.abs(camSide) > along * 0.25;
    const sides = one ? (camSide > 0 ? SIDE_L : SIDE_R) : SIDES;
    // (seen from behind or in front, both sides are thin slivers: coarser still)
    const step = (d < 18 ? 1 : d < 36 ? 2 : 3) * (one ? 3 : 6);
    const D = this.design;
    if (D) {
      let seed = 3100;
      for (const st of D.strokes) {
        const P = st.p;
        for (const side of sides) {
          // (each point put in the world once: the end of one stroke is the start of the next)
          let have = false;
          for (let i = 0; i + step < P.length; i += step) {
            seed++;
            // (a break in the line: it went over a window or a wheel)
            let j = i + step;
            for (let k = i + 3; k <= j; k += 3) if (P[k] === null) j = -1;
            if (j < 0 || P[i] === null) {
              have = false;
              continue;
            }
            if (!have) _pa.set(P[i] * side, P[i + 1], P[i + 2]).applyMatrix4(m);
            _pb.set(P[j] * side, P[j + 1], P[j + 2]).applyMatrix4(m);
            fr.lineXYZ(_pa.x, _pa.y, _pa.z, _pb.x, _pb.y, _pb.z, st.c, st.w * wk, seed, 1, 0.002, 0.01);
            _pa.copy(_pb);
            have = true;
          }
        }
      }
    }
    if (this.dirt > 0.2) {
      const K = KINDS[this.carKind] || KINDS.sedan;
      if (!this._mud || this._mudKind !== this.carKind) {
        // (behind each wheel, low down: the same splashes every time)
        this._mudKind = this.carKind;
        this._mud = [];
        let r = 0.37;
        const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
        for (const tw of K.wheels) {
          const zw = tw * K.len - K.len / 2;
          for (let k = 0; k < 5; k++) {
            const z0 = zw - K.r * (1.25 + rnd() * 0.5);
            const y0 = K.clear + 0.08 + rnd() * 0.3;
            const a = sidePoint(this.carKind, z0, y0, 1);
            const b = sidePoint(this.carKind, z0 - 0.15 - rnd() * 0.3, y0 + (rnd() - 0.6) * 0.18, 1);
            if (a && b) this._mud.push(a, b);
          }
        }
      }
      const a = Math.min(1, (this.dirt - 0.2) * 1.6);
      const M = this._mud;
      for (const side of sides) {
        for (let i = 0; i < M.length; i += 2) {
          _pa.set(M[i][0] * side, M[i][1], M[i][2]).applyMatrix4(m);
          _pb.set(M[i + 1][0] * side, M[i + 1][1], M[i + 1][2]).applyMatrix4(m);
          fr.lineXYZ(_pa.x, _pa.y, _pa.z, _pb.x, _pb.y, _pb.z, i % 4 ? MUD : MUD_INK, 3.2 * wk, 4400 + i, a, 0.01, 0.02);
        }
      }
    }
    if (this.shineT) {
      // (just washed: a few glints running over it)
      const t = game.time - this.shineT;
      if (t > 3) this.shineT = 0;
      else {
        const K = KINDS[this.carKind] || KINDS.sedan;
        for (let k = 0; k < 4; k++) {
          const ph = (t * 0.9 + k * 0.27) % 1;
          const p = sidePoint(this.carKind, (k / 3 - 0.5) * K.len * 0.7, (K.clear + K.roofY) * 0.4, k % 2 ? 1 : -1);
          if (!p) continue;
          const s = Math.sin(ph * Math.PI) * 0.16;
          _pa.set(p[0], p[1], p[2]).applyMatrix4(m);
          fr.lineXYZ(_pa.x - s, _pa.y, _pa.z, _pa.x + s, _pa.y, _pa.z, SHINE, 2.2, 4600 + k, 1, 0, 0);
          fr.lineXYZ(_pa.x, _pa.y - s, _pa.z, _pa.x, _pa.y + s, _pa.z, SHINE, 2.2, 4610 + k, 1, 0, 0);
        }
      }
    }
  }

  collideWorld(dt) {
    // three circles along the body
    const col = this.game.world.collision;
    const f = this.fwd.clone();
    let hit = false;
    let impact = 0;
    const offs = this.kind === 'tank' ? [-2, 0, 2] : this.kind === 'bike' ? [-0.7, 0, 0.7] : [-1.2, 0, 1.2];
    const r = this.kind === 'tank' ? 1.7 : this.kind === 'bike' ? 0.55 : 1.0;
    for (const o of offs) {
      const p = new THREE.Vector3(this.pos.x + f.x * o, this.pos.y + 0.2, this.pos.z + f.z * o);
      const before = p.clone();
      const res = col.resolveCylinder(p, r, 1.5, 0.45);
      if (res.hitWall) {
        hit = true;
        this.pos.x += p.x - before.x;
        this.pos.z += p.z - before.z;
        const along = Math.abs(f.x * res.nx + f.z * res.nz);
        impact = Math.max(impact, Math.abs(this.speed) * along);
      }
    }
    if (hit) {
      if (impact > 7) {
        this.hurt(impact * 1.6);
        // (the front, or the back, dented: game/damage.js)
        if (this.game.damage && !this.game.classic) this.game.damage.wall(this, impact);
        this.game.fx.sprite('fx_crash', this.pos.x + f.x * this.halfLen, this.pos.y + 1, this.pos.z + f.z * this.halfLen, { size: 2.2, life: 0.4 });
        this.game.camRig.addShake(Math.min(0.6, impact * 0.03));
        this.game.audio.play('crash', Math.min(1, impact / 20));
      }
      this.speed *= impact > 4 ? -0.25 : 0.85;
    }
    for (const v of this.mgr.list) {
      if (v === this || v.dead) continue;
      const dx = this.pos.x - v.pos.x;
      const dz = this.pos.z - v.pos.z;
      const d = Math.hypot(dx, dz);
      const rr = this.radius + v.radius - 0.6;
      if (d < rr && d > 1e-3) {
        this.pos.x += (dx / d) * (rr - d) * 0.5;
        this.pos.z += (dz / d) * (rr - d) * 0.5;
        this.speed *= 0.7;
      }
    }
    this.game.traffic.collideVehicle(this);
  }

  runOver() {
    if (Math.abs(this.speed) < 3 && !(this.kind === 'tank' && Math.abs(this.speed) > 1)) return;
    const game = this.game;
    const f = this.fwd;
    for (const e of game.enemies.list) {
      if (!e.alive) continue;
      const dx = e.pos.x - this.pos.x;
      const dz = e.pos.z - this.pos.z;
      const along = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (Math.abs(along) < this.halfLen + 0.4 && side < this.halfWid + 0.4) {
        game.enemies.damage(e, 'torso', 999, e.pos.clone().setY(e.pos.y + 1), f.clone(), 'run');
        game.fx.sprite('fx_crash', e.pos.x, e.pos.y + 1, e.pos.z, { size: 1.6, life: 0.35 });
        if (this.kind === 'car' || this.kind === 'bike') this.hurt(this.kind === 'bike' ? 6 : 4);
      }
    }
    game.civilians.dodge(this.pos, f, this.halfLen + 1.5, this.halfWid + 1.2, this.speed);
  }

  updateCar(dt, input) {
    const q = this.q;
    let throttle = 0;
    let steer = 0;
    let brake = false;
    if (input) {
      const mv = input.readMove();
      throttle = mv.y;
      steer = -mv.x;
      brake = input.keys.has('Space');
      if (q.stall && Math.random() < q.stall * dt * 3) this.stall = 0.6 + Math.random();
    }
    if (this.stall > 0) {
      this.stall -= dt;
      throttle *= 0.1;
      if (Math.random() < dt * 4) this.game.fx.smoke(this.pos.x - Math.sin(this.yaw) * 2, this.pos.y + 0.6, this.pos.z - Math.cos(this.yaw) * 2, 0.8);
    }
    const bike = this.kind === 'bike';
    const maxF = (bike ? 36 : this.racing ? 32 : 27) * q.speed;
    const maxR = (bike ? 6 : 9) * q.speed;
    const acc = (bike ? 21 : 15) * q.accel;
    if (throttle > 0) this.speed += acc * throttle * dt * (this.speed < 0 ? 2.2 : 1);
    else if (throttle < 0) this.speed += acc * throttle * dt * (this.speed > 0 ? 2.2 : 0.8);
    else this.speed = damp(this.speed, 0, 0.9, dt);
    if (brake) this.speed = damp(this.speed, 0, 4, dt);
    this.speed = clamp(this.speed, -maxR, maxF);
    const turn = (steer + (input ? q.pull * Math.sign(this.speed || 1) * 0.5 : 0)) * clamp(Math.abs(this.speed) / 6, 0, 1) * (brake ? 2.0 : bike ? 1.8 : 1.35) * Math.sign(this.speed || 1);
    this.turn = turn;
    this.yaw += turn * dt;
    const f = this.fwd;
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.pos.y = damp(this.pos.y, groundHeight(this.pos.x, this.pos.z) * 0.5, 12, dt);
    this.speedAbs = Math.abs(this.speed);
    this.collideWorld(dt);
    this.runOver();
    if (input) this.game.audio.engine(this.speedAbs / maxF, bike ? 'bike' : 'car');
  }

  // ------------------------------------------------------------------ driving (ROADMAP 4.3)
  // The tyres grip: the car's speed along where it points pushed by the engine and slowed by the
  // brakes, its sideways slip dying away (slowly with the handbrake on: it drifts); it turns as
  // quick as its weight lets it; its body pitches when it speeds up or brakes and rolls in the
  // turns; off a ramp (or a drop) it flies, and lands on its springs.
  drive(dt, input) {
    const q = this.q;
    const bike = this.kind === 'bike';
    const H = HANDLING[bike ? this.model || 'bike' : this.carKind] || HANDLING.sedan;
    // (the garage's upgrades, and the tank: game/garage.js, ROADMAP 4.6)
    const U = this.up;
    const dry = this.fuel === 0 ? 1 : 0;
    const top = (this.racing ? 33 : H.top) * q.speed * (U ? 1 + 0.06 * U.engine : 1) * (dry ? 0.35 : 1);
    const power = H.power * q.accel * (U ? 1 + 0.12 * U.engine : 1) * (dry ? 0.3 : 1);
    const brakeK = U ? 1 + 0.18 * U.brakes : 1;
    const gripK = U ? 1 + 0.08 * U.tires : 1;
    let throttle = 0;
    let steer = 0;
    let hand = false;
    if (input) {
      const mv = input.readMove();
      throttle = mv.y;
      steer = -mv.x;
      hand = input.keys.has('Space');
      if (q.stall && Math.random() < q.stall * dt * 3) this.stall = 0.6 + Math.random();
    }
    if (this.stall > 0) {
      this.stall -= dt;
      throttle *= 0.1;
      if (Math.random() < dt * 4) this.game.fx.smoke(this.pos.x - Math.sin(this.yaw) * 2, this.pos.y + 0.6, this.pos.z - Math.cos(this.yaw) * 2, 0.8);
    }
    if (this.vx === undefined || this.physT === undefined || this.game.time - this.physT > 1) {
      // (from where it is: its speed along where it points)
      this.vx = Math.sin(this.yaw) * this.speed;
      this.vz = Math.cos(this.yaw) * this.speed;
      this.yawRate = 0;
      this.vy = 0;
      this.air = false;
      this.bodyPitch = this.bodyPitch || 0;
      this.pitchV = 0;
      this.bodyRoll = this.bodyRoll || 0;
      this.rollV = 0;
      this.climb = 0;
    }
    this.physT = this.game.time;
    // the steering: how quick it turns (less as it goes faster; more with the handbrake on)
    const fx0 = Math.sin(this.yaw);
    const fz0 = Math.cos(this.yaw);
    let vL = this.vx * fx0 + this.vz * fz0;
    if (!this.air) {
      const k = Math.min(1, Math.abs(vL) / 5) * (1 - 0.45 * Math.min(1, Math.abs(vL) / top)) * (hand ? 1.55 : 1);
      const pull = input ? q.pull * 0.5 : 0;
      const want = (steer + pull) * H.steer * k * Math.sign(vL || 1);
      this.yawRate = damp(this.yawRate, want, 9 / H.mass, dt);
    } else this.yawRate *= Math.exp(-0.8 * dt);
    this.yaw += this.yawRate * dt;
    // its speed along where it now points, and across
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    vL = this.vx * fx + this.vz * fz;
    let vS = -this.vx * fz + this.vz * fx;
    const v0 = vL;
    if (!this.air) {
      // the engine, the brakes, the reverse
      if (throttle > 0) {
        if (vL < -0.5) vL = Math.min(0, vL + 22 * throttle * dt);
        else vL += power * throttle * dt * Math.pow(Math.max(0, 1 - Math.max(0, vL) / top), 0.6);
      } else if (throttle < 0) {
        if (vL > 0.5) vL = Math.max(0, vL + 24 * brakeK * throttle * dt);
        else vL = Math.max(-9 * q.speed, vL + power * 0.6 * throttle * dt);
      } else vL -= vL * (0.35 + 0.002 * Math.abs(vL)) * dt;
      // (an empty tank: the engine coughs, the car slows to a crawl)
      if (dry && vL > top) vL = Math.max(top, vL - 5 * dt);
      // the handbrake: the back wheels locked
      if (hand) vL -= vL * 0.6 * dt;
      // the tyres' grip across: the slip dies away (hardly, with the handbrake on)
      const grip = (hand ? H.slide : H.grip * (1 - 0.25 * Math.min(1, (Math.abs(steer) * Math.abs(vL)) / top))) * gripK;
      vS *= Math.exp(-grip * dt);
    }
    this.vx = fx * vL - fz * vS;
    this.vz = fz * vL + fx * vS;
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    // up and down: on the ground (and up the ramps), or flying
    const g = Math.max(groundHeight(this.pos.x, this.pos.z) * 0.5, rampAt(this.pos.x, this.pos.z));
    if (this.air) {
      this.vy -= 20 * dt;
      this.pos.y += this.vy * dt;
      this.bodyPitch = damp(this.bodyPitch, 0.12, 1.2, dt);
      if (this.pos.y <= g) {
        const hit = -this.vy;
        this.pos.y = g;
        this.air = false;
        this.vy = 0;
        this.pitchV -= hit * 0.04 * H.pitch;
        if (hit > 3) {
          this.game.audio.play('crash', Math.min(0.6, hit / 20));
          this.game.camRig.addShake(Math.min(0.5, hit * 0.035));
        }
        if (hit > 10) this.hurt((hit - 10) * 2);
      }
    } else if (g < this.pos.y - 0.3) {
      // off the edge: flying, as fast upwards as it was climbing
      this.air = true;
      this.vy = Math.max(0, this.climb);
    } else {
      const y0 = this.pos.y;
      this.pos.y = g > y0 ? g : damp(y0, g, 14, dt);
      this.climb = THREE.MathUtils.damp(this.climb, (this.pos.y - y0) / Math.max(dt, 1e-3), 20, dt);
    }
    this.speed = vL;
    this.speedAbs = Math.abs(vL);
    this.turn = this.yawRate;
    this.slip = vS;
    // the body on its springs: the nose down braking, up speeding up; leaning out of the turn
    if (!bike) {
      const aL = (vL - v0) / Math.max(dt, 1e-3);
      const aS = this.yawRate * vL;
      const pw = clamp(-aL * 0.006 * H.pitch, -0.07, 0.07);
      const rw = clamp(-aS * 0.005 * H.roll, -0.09, 0.09);
      this.pitchV += ((pw - this.bodyPitch) * 60 - this.pitchV * 9) * dt;
      this.bodyPitch += this.pitchV * dt;
      this.rollV += ((rw - this.bodyRoll) * 50 - this.rollV * 8) * dt;
      this.bodyRoll += this.rollV * dt;
    }
    // the turn signals (slow, the wheel over), the skids, the tyres' screech
    this.signal = input && Math.abs(steer) > 0.5 && this.speedAbs > 0.5 && this.speedAbs < 9 ? Math.sign(steer) : 0;
    const sliding = !this.air && (Math.abs(vS) > 2.2 || (hand && this.speedAbs > 4) || (throttle < 0 && vL > 9));
    this.skids(dt, sliding);
    this.collideWorld(dt);
    // (a wall or a car stopped it, or threw it back)
    if (this.speed !== vL) {
      this.vx = fx * this.speed - fz * vS * 0.3;
      this.vz = fz * this.speed + fx * vS * 0.3;
    }
    this.runOver();
    // (a bicycle's, a scooter's: no engine; a bicycle's bell on H)
    if (input) this.game.audio.engine(this.speedAbs / top, PEDAL.has(this.model) ? 'pedal' : bike ? 'bike' : 'car');
    if (input && this.model === 'bicycle' && input.wasPressed('KeyH')) this.game.audio.play('bikebell', 0.7);
  }

  // dark marks behind the back wheels while it slides (a long trail the city keeps a while)
  skids(dt, on) {
    const S = this.mgr.skidList || (this.mgr.skidList = []);
    if (!on) {
      this.skidPrev = null;
      return;
    }
    this.skidT = (this.skidT || 0) - dt;
    if (this.skidT > 0) return;
    this.skidT = 0.05;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const back = this.kind === 'bike' ? 0.62 : (this.halfLen || 2.3) * 0.62;
    const half = this.kind === 'bike' ? 0 : (this.halfWid || 0.98) * 0.78;
    const pts = [];
    for (const s of this.kind === 'bike' ? [0] : [-1, 1]) pts.push([this.pos.x - fx * back - fz * half * s, this.pos.z - fz * back + fx * half * s]);
    if (this.skidPrev) {
      for (let i = 0; i < pts.length; i++) S.push({ a: this.skidPrev[i], b: pts[i], y: this.pos.y + 0.02, t: this.game.time });
      while (S.length > 500) S.shift();
    }
    // and the tyres' smoke
    if (Math.random() < 0.6) {
      const p = pts[Math.floor(Math.random() * pts.length)];
      this.game.fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', p[0], this.pos.y + 0.35, p[1], { size: 0.9 + Math.random() * 0.6, grow: 1.6, life: 0.9, vy: 0.5, alpha: 0.5, tint: TYRE_SMOKE });
    }
    this.skidPrev = pts;
    this.screechT = (this.screechT || 0) - 0.05;
    if (this.screechT <= 0 && this.driver) {
      this.screechT = 0.22;
      this.game.audio.play('skid', Math.min(1, Math.abs(this.slip || 0) / 6 + 0.35));
    }
  }

  updateTank(dt, input) {
    const q = this.q;
    let throttle = 0;
    let turn = 0;
    if (input) {
      const mv = input.readMove();
      throttle = mv.y;
      turn = -mv.x;
    }
    const maxF = 11 * q.speed;
    this.speed = damp(this.speed, throttle * maxF, 1.6 * q.accel, dt);
    this.yaw += turn * 1.05 * dt * (this.grade === 'fail' ? 0.4 : 1) + (input ? q.pull * 0.2 * dt : 0);
    const f = this.fwd;
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.pos.y = damp(this.pos.y, groundHeight(this.pos.x, this.pos.z) * 0.5, 12, dt);
    this.speedAbs = Math.abs(this.speed);
    this.collideWorld(dt);
    this.runOver();
    // the turret follows the camera
    if (input) {
      let want = this.game.camRig.yaw - this.yaw;
      if (this.grade === 'fail') want = Math.sin(this.time * 0.7) * 2.5;
      else if (this.grade === 'wonky') want += Math.sin(this.time * 2.3) * 0.25;
      this.turretYaw = dampAngle(this.turretYaw, want, this.grade === 'wonky' ? 2 : 4, dt);
      this.turret.rotation.y = this.turretYaw;
      this.reload -= dt;
      if ((input.fire || input.firePressed) && this.reload <= 0) this.fireCannon();
      this.game.audio.engine(0.3 + this.speedAbs / 12, 'tank');
    }
  }

  fireCannon() {
    const game = this.game;
    this.reload = 1.6 * this.q.reload;
    this.group.updateMatrixWorld(true);
    const mw = this.muzzleLocal.clone();
    this.turret.localToWorld(mw);
    const aim = game.weapons.aimPoint;
    const dir = aim.clone().sub(mw).normalize();
    // the tank fires correction fluid: what the glob splashes over is wiped off the page
    if (this.grade === 'fail') {
      dir.set(Math.sin(this.yaw + this.turretYaw), 0.3, Math.cos(this.yaw + this.turretYaw)).normalize();
      game.weapons.spawnShell(mw.x, mw.y, mw.z, dir.x, dir.y, dir.z, 'player', 60, 3, 9, 'whiteShell');
    } else {
      const spread = this.grade === 'wonky' ? 0.06 : 0.008;
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
      game.weapons.spawnShell(mw.x, mw.y, mw.z, dir.x, dir.y, dir.z, 'player', this.grade === 'perfect' ? 260 : 200, this.grade === 'perfect' ? 8.5 : 7, 48, 'whiteShell');
    }
    game.fx.muzzle(mw.x, mw.y, mw.z, 3);
    game.fx.splash(mw.x, mw.y, mw.z, 8, 3, [1, 1, 0.98]);
    game.audio.play('cannon');
    game.camRig.addShake(0.45);
    game.enemies.noise(this.pos, 60, 'boom');
    this.speed -= 1.5;
  }

  updateCopter(dt, input) {
    const q = this.q;
    const game = this.game;
    let ax = 0;
    let az = 0;
    let up = 0;
    if (input) {
      const mv = input.readMove();
      const cy = game.camRig.yaw;
      const fx = Math.sin(cy);
      const fz = Math.cos(cy);
      ax = fx * mv.y - fz * mv.x;
      az = fz * mv.y + fx * mv.x;
      if (input.keys.has('Space')) up += 1;
      if (input.keys.has('KeyC') || input.keys.has('ControlLeft') || input.keys.has('ShiftLeft')) up -= 1;
      if (input.flyUp) up += 1;
      if (input.flyDown) up -= 1;
      this.yaw = dampAngle(this.yaw, cy, 1.5, dt);
    }
    const maxS = 24 * q.speed;
    this.vx = damp(this.vx || 0, ax * maxS, 1.6 * q.accel, dt);
    this.vz = damp(this.vz || 0, az * maxS, 1.6 * q.accel, dt);
    const maxAlt = this.grade === 'fail' ? 1.2 : 70;
    this.vy = damp(this.vy, up * 9, 3, dt);
    if (!this.driver) this.vy = damp(this.vy, (1.05 - this.alt) * 0.8, 1, dt);
    this.alt = clamp(this.alt + this.vy * dt, 1.0, maxAlt);
    if (q.wobble) {
      this.vx += Math.sin(this.time * 1.3) * q.wobble * 1.5 * dt;
      this.vz += Math.cos(this.time * 1.1) * q.wobble * 1.5 * dt;
      if (this.grade === 'fail') this.alt = 1 + Math.abs(Math.sin(this.time * 3)) * 1.2;
    }
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    const g = Math.max(0, groundHeight(this.pos.x, this.pos.z));
    this.pos.y = g + this.alt - 1.0;
    this.speedAbs = Math.hypot(this.vx, this.vz);
    const col = game.world.collision;
    const p = new THREE.Vector3(this.pos.x, this.pos.y + 0.3, this.pos.z);
    const res = col.resolveCylinder(p, 2.8, 2.6, 0);
    if (res.hitWall) {
      this.pos.x = p.x;
      this.pos.z = p.z;
      this.vx *= 0.3;
      this.vz *= 0.3;
    }
    // paper planes from the doors, at whatever you aim
    this.reload -= dt;
    if (input && input.fire && this.reload <= 0) {
      this.reload = this.grade === 'perfect' ? 0.45 : this.grade === 'good' ? 0.6 : this.grade === 'wonky' ? 0.9 : 2;
      this.dropPlane();
    }
    if (input) game.audio.engine(0.45 + this.speedAbs / 30, 'ufo');
  }

  dropPlane() {
    const game = this.game;
    const w = game.weapons;
    const side = (this.planeSide = -(this.planeSide || 1));
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const x = this.pos.x + fz * side * 1.2;
    const y = this.pos.y + 1.0;
    const z = this.pos.z - fx * side * 1.2;
    const a = w.aimPoint;
    const d = new THREE.Vector3(a.x - x, a.y - y, a.z - z).normalize();
    const sp = 22;
    const q = this.q;
    w.projectiles.push({
      kind: 'plane', owner: 'player', x, y, z, vx: d.x * sp, vy: d.y * sp, vz: d.z * sp, gravity: 0,
      damage: 60 * q.hp, radius: 3.2, life: 6, t: 0, seed: Math.random() * 100, wobble: this.grade === 'fail' ? 2 : 0,
      homing: 3.2, cruise: sp,
    });
    game.audio.play('whoosh', 0.8);
    game.enemies.noise(this.pos, 40);
    game.onCrime('shoot', this.pos.x, this.pos.z);
  }

  // the bike's rider: astride the seat, hands on the bars
  seatRider(fig, dt) {
    // (ROADMAP 4.8: on the saddle, the deck, at the helm, in the cockpit: game/rides.js)
    if (this.model) {
      seatOn(this, fig, dt);
      return;
    }
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const s = this.seat === true ? [0, 1.0, -0.3] : this.seatPos || [0, 1.0, -0.3];
    const b = this.bar || [0, 1.38, 0.82];
    fig.pos.set(this.pos.x + fx * s[2], this.pos.y + s[1] - 0.48, this.pos.z + fz * s[2]);
    fig.yaw = this.yaw;
    fig.sit = 1;
    fig.speed = 0;
    if (!fig.wheel) fig.wheel = new THREE.Vector3();
    fig.wheel.set(this.pos.x + fx * b[2], this.pos.y + b[1], this.pos.z + fz * b[2]);
    // (shooting off the bike: one hand on the bars, ROADMAP 4.7)
    fig.reachR = fig.shootOut ? null : fig.wheel;
    if (fig.shootOut) fig.reachL = fig.wheel;
    fig.update(dt);
  }
}

// the traffic's bigger cars (game/fleet.js), taken
const BIG_STOCK = new Set(['truck', 'garbage', 'limo', 'classic', 'ambulance', 'firetruck']);

// How each kind handles (ROADMAP 4.3; not with ?classic): how heavy (slow to start turning, slow
// to stop turning), how strong, how fast, how much the tyres grip sideways (and with the
// handbrake on: a drift), how quick the steering, how much the body rolls and pitches
const HANDLING = {
  sports: { mass: 1.0, power: 16, top: 33, grip: 9.5, slide: 1.12, steer: 1.6, roll: 0.45, pitch: 0.35 },
  sedan: { mass: 1.25, power: 14, top: 28, grip: 8, slide: 1.01, steer: 1.4, roll: 0.75, pitch: 0.5 },
  suv: { mass: 1.6, power: 13.5, top: 28, grip: 7, slide: 0.94, steer: 1.25, roll: 1.05, pitch: 0.6 },
  van: { mass: 1.8, power: 11.5, top: 25, grip: 6.5, slide: 0.9, steer: 1.15, roll: 1.15, pitch: 0.65 },
  ambulance: { mass: 1.9, power: 13, top: 29, grip: 6.5, slide: 0.9, steer: 1.15, roll: 1.15, pitch: 0.65 },
  limo: { mass: 2.1, power: 12, top: 27, grip: 7, slide: 0.9, steer: 0.95, roll: 0.8, pitch: 0.45 },
  classic: { mass: 1.5, power: 12.5, top: 28, grip: 5.8, slide: 0.98, steer: 1.3, roll: 1.4, pitch: 0.9 },
  truck: { mass: 3.0, power: 8.5, top: 22, grip: 5.5, slide: 0.83, steer: 0.85, roll: 1.2, pitch: 0.55 },
  garbage: { mass: 3.4, power: 7.5, top: 20, grip: 5.5, slide: 0.83, steer: 0.8, roll: 1.2, pitch: 0.55 },
  firetruck: { mass: 3.6, power: 9, top: 25, grip: 5.5, slide: 0.83, steer: 0.8, roll: 1.1, pitch: 0.5 },
  bike: { mass: 0.6, power: 20, top: 36, grip: 11, slide: 1.8, steer: 1.9, roll: 0, pitch: 0.4 },
  // (ROADMAP 4.8: pedalled, kicked)
  bicycle: { mass: 0.45, power: 4.2, top: 9.5, grip: 10, slide: 1.6, steer: 2.1, roll: 0, pitch: 0.2 },
  scooter: { mass: 0.35, power: 3.0, top: 6.5, grip: 9, slide: 1.4, steer: 2.3, roll: 0, pitch: 0.15 },
};

// the stunt ramps in the alleys (with their wooden planks, drawn by the car batches)
export const RAMPS = [
  { x: -31.5, z: 70, yaw: 0, len: 5.5, w: 3.2, h: 1.35 },
  { x: -100.5, z: 125, yaw: Math.PI, len: 5.5, w: 3.2, h: 1.35 },
  { x: -31.5, z: 215, yaw: 0, len: 6.5, w: 3.2, h: 1.7 },
];

// how high a ramp's top is at (x, z), coming up it from its low end (0: not on one)
export function rampAt(x, z) {
  for (const r of RAMPS) {
    const dx = x - r.x;
    const dz = z - r.z;
    const fx = Math.sin(r.yaw);
    const fz = Math.cos(r.yaw);
    const along = dx * fx + dz * fz;
    const across = -dx * fz + dz * fx;
    if (along >= 0 && along <= r.len && Math.abs(across) <= r.w / 2) return (along / r.len) * r.h;
  }
  return 0;
}

// (the dark pen comes out as the road's own ink: the marks are drawn grey, rubbed in)
const SKID = [0.44, 0.43, 0.5];
const TYRE_SMOKE = [0.9, 0.9, 0.93];
const RAMP_WOOD = [0.8, 0.64, 0.42];
const RAMP_STRIPE = [0.98, 0.8, 0.12];
const RAMP_LEG = [0.24, 0.24, 0.27];
const _rm = new THREE.Matrix4();
const _rq = new THREE.Quaternion();
const _re = new THREE.Euler();
const _rp = new THREE.Vector3();
const _rs = new THREE.Vector3();

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  // a city car the player takes (no drawing needed)
  spawnStock(stock, pos, yaw) {
    // (a motorbike out of the traffic rides like the drawn one: game/fleet.js)
    if (stock && stock.kind === 'moto') {
      const b = new Vehicle(this, 'bike', 'good', 100);
      b.pos.set(pos.x, 0, pos.z);
      b.yaw = yaw;
      b.reveal = 1;
      b.stock = stock;
      return this.add(b);
    }
    const v = new Vehicle(this, 'car', 'good', 100, stock);
    // (a truck, a limousine...: as big as it is)
    const K = BIG_STOCK.has(v.carKind) ? KINDS[v.carKind] : null;
    if (K) {
      v.halfLen = K.len / 2;
      v.halfWid = K.W / 2;
      v.heightM = K.glass.R;
    }
    v.pos.set(pos.x, 0, pos.z);
    v.yaw = yaw;
    this.list.push(v);
    return v;
  }

  // a drawn vehicle about to land (see game/materialize.js): made now, out of sight until add()
  create(kind, grade, score) {
    const v = new Vehicle(this, kind, grade, score);
    v.reveal = 1;
    v.group.visible = false;
    return v;
  }

  add(v) {
    // (in place from its first frame: its update only runs next frame)
    v.group.position.copy(v.pos);
    v.group.rotation.set(0, v.yaw, 0);
    v.group.visible = true;
    this.list.push(v);
    // keep at most 3 drawn vehicles around
    while (this.list.filter((o) => !o.stock).length > 3) {
      const old = this.list.find((o) => !o.driver && !o.stock && o !== v);
      if (!old) break;
      old.dispose();
      this.list.splice(this.list.indexOf(old), 1);
    }
    return v;
  }

  // in front of the player, on free ground (or just in front, if nothing is free)
  placeNear(v) {
    const game = this.game;
    const p = game.player.pos;
    const f = game.player.fig.forward;
    for (const d of [4.5, 6, 3.5, 8]) {
      for (const side of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5]) {
        const ang = Math.atan2(f.x, f.z) + side * 0.6;
        const x = p.x + Math.sin(ang) * d;
        const z = p.z + Math.cos(ang) * d;
        if (groundHeight(x, z) >= 0 && !game.world.collision.pointInside(x, 1.0, z, v.radius * 0.8)) {
          v.pos.set(x, v.flies ? 0 : groundHeight(x, z) * 0.5, z);
          return;
        }
      }
    }
    v.pos.set(p.x + f.x * 4, 0, p.z + f.z * 4);
  }

  spawn(kind, grade, score) {
    const game = this.game;
    const v = new Vehicle(this, kind, grade, score);
    // in front of the player, on free ground
    const p = game.player.pos;
    const f = game.player.fig.forward;
    const tries = [4.5, 6, 3.5, 8];
    let placed = false;
    for (const d of tries) {
      for (const side of [0, 1, -1, 2, -2]) {
        const ang = Math.atan2(f.x, f.z) + side * 0.6;
        const x = p.x + Math.sin(ang) * d;
        const z = p.z + Math.cos(ang) * d;
        const hit = game.world.collision.pointInside(x, 1.0, z, v.radius * 0.8);
        if (!hit) {
          v.pos.set(x, v.flies ? 0 : groundHeight(x, z) * 0.5, z);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) v.pos.set(p.x + f.x * 4, 0, p.z + f.z * 4);
    v.yaw = game.player.yaw;
    if (kind === 'copter') v.alt = 1.05;
    this.list.push(v);
    // keep at most 3 drawn vehicles around
    while (this.list.filter((o) => !o.stock).length > 3) {
      const old = this.list.find((o) => !o.driver && !o.stock);
      if (!old) break;
      old.dispose();
      this.list.splice(this.list.indexOf(old), 1);
    }
    game.fx.smoke(v.pos.x, v.pos.y + 1, v.pos.z, 3);
    game.fx.crumbs(v.pos.x, v.pos.y + 1, v.pos.z, 20, 4);
    return v;
  }

  update(dt) {
    const keep = [];
    const pp = this.game.anchorPos();
    for (const v of this.list) {
      v.update(dt);
      // (a car in your parking stays: game/garage.js)
      const left = v.stock && !v.driver && !v.kept && Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z) > 140;
      if ((v.dead && this.game.time > v.removeAt) || left) {
        v.dispose();
        continue;
      }
      keep.push(v);
    }
    this.list = keep;
  }

  // (its colour changed: the dusty copy made again)
  dirty(v) {
    v._dq = -1;
  }

  draw(cars) {
    for (const v of this.list) v.draw(cars);
    if (!this.game.classic) this.drawExtras(cars);
  }

  // (ROADMAP 4.3) the skid marks, fading; the stunt ramps in the alleys
  drawExtras(cars) {
    const game = this.game;
    // (the boats' wakes: game/rides.js)
    for (const v of this.list) if (v.kind === 'boat' && v.wake) drawWake(v, game.figures, game.time);
    const cam = game.camera.position;
    const S = this.skidList;
    if (S && S.length) {
      const fr = game.figures;
      const t = game.time;
      for (let i = 0; i < S.length; i++) {
        const k = S[i];
        const age = t - k.t;
        if (age > 40) continue;
        const d = Math.hypot(k.a[0] - cam.x, k.a[1] - cam.z);
        if (d > 70) continue;
        fr.lineXYZ(k.a[0], k.y, k.a[1], k.b[0], k.y, k.b[1], SKID, Math.max(1.4, Math.min(8, 120 / Math.max(1, d))), 4000 + (i & 63), 0.6 * (1 - age / 40), 0.005, 0);
      }
    }
    for (const r of RAMPS) {
      if (Math.hypot(r.x - cam.x, r.z - cam.z) > 160) continue;
      const slope = Math.atan2(r.h, r.len);
      const plank = Math.hypot(r.h, r.len);
      // the plank (tilted up its length), two stripes across it, the trestle under its high end
      _rq.setFromEuler(_re.set(-slope, r.yaw, 0, 'YXZ'));
      const fx = Math.sin(r.yaw);
      const fz = Math.cos(r.yaw);
      const mid = (r.len / 2);
      _rm.compose(_rp.set(r.x + fx * mid, r.h / 2 + 0.06, r.z + fz * mid), _rq, _rs.set(r.w, 0.12, plank));
      cars.trimBox.push(_rm, RAMP_WOOD, 0);
      for (const u of [0.3, 0.62, 0.9]) {
        _rm.compose(_rp.set(r.x + fx * r.len * u, r.h * u + 0.13, r.z + fz * r.len * u), _rq, _rs.set(r.w * 0.96, 0.02, 0.22));
        cars.trimBox.push(_rm, RAMP_STRIPE, 0);
      }
      _rq.setFromEuler(_re.set(0, r.yaw, 0, 'YXZ'));
      for (const s of [-1, 1]) {
        _rm.compose(_rp.set(r.x + fx * (r.len - 0.2) - fz * s * (r.w / 2 - 0.2), r.h / 2, r.z + fz * (r.len - 0.2) + fx * s * (r.w / 2 - 0.2)), _rq, _rs.set(0.16, r.h, 0.16));
        cars.trimBox.push(_rm, RAMP_LEG, 0);
      }
    }
  }

  nearest(pos, maxD) {
    let best = null;
    let bd = maxD;
    for (const v of this.list) {
      if (v.dead || v.materializing) continue;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) - v.radius;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  // push walkers out of vehicle footprints (oriented boxes)
  pushOut(p, r) {
    this.game.traffic.pushOut(p, r);
    for (const v of this.list) {
      if (v.dead || (v.flies && v.alt > 2)) continue;
      const dx = p.x - v.pos.x;
      const dz = p.z - v.pos.z;
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      const along = dx * fx + dz * fz;
      const side = dx * fz - dz * fx;
      const hl = v.halfLen + r;
      const hw = v.halfWid + r;
      if (Math.abs(along) < hl && Math.abs(side) < hw && p.y < v.pos.y + v.heightM) {
        const pa = hl - Math.abs(along);
        const ps = hw - Math.abs(side);
        if (pa < ps) {
          const s = Math.sign(along) || 1;
          p.x += fx * pa * s;
          p.z += fz * pa * s;
        } else {
          const s = Math.sign(side) || 1;
          p.x += fz * ps * s;
          p.z -= fx * ps * s;
        }
      }
    }
  }
}

export { angleDiff, _q, UP, copterModel, cityCopterModel };
