import * as THREE from 'three';
import { BLUEPRINTS } from './blueprints.js';
import { Kit, itemMats, warpFor, linC } from './items.js';
import { groundHeight } from '../world/layout.js';
import { clamp, damp, dampAngle, angleDiff } from '../core/util.js';

// The things you drive: the city's own cars (taken from the traffic or from the curb), and the
// ones you drew - the scribble car, the crazy tank, the motorbike, the paper helicopter. They are
// made like everything else in the city (glossy paint full of the sunset), and how well you drew
// them shows: a wonky drawing pulls to one side, a bad one barely runs.

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

const VEH = {
  car: { width: 1.95, hp: 170, len: 2.26 },
  tank: { width: 3.2, hp: 520, len: 3.3 },
  bike: { width: 0.6, hp: 120, len: 1.1 },
  copter: { width: 1.6, hp: 320, len: 3.0 },
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

// ------------------------------------------------------------------ one vehicle
class Vehicle {
  constructor(mgr, kind, grade, score, stock = null) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.kind = kind;
    this.grade = grade;
    this.score = score;
    this.q = QUALITY[grade];
    this.bp = BLUEPRINTS[kind];
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

  // forward unit vector
  get fwd() {
    return _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  update(dt) {
    this.time += dt;
    let pop = 1;
    if (this.reveal < 1) {
      // freshly drawn: it plops into the world with a little overshoot
      this.reveal = Math.min(1, this.reveal + dt / 0.8);
      const k = Math.min(1, this.reveal * 1.6) - 1;
      pop = Math.max(0.1, 1 + 2.70158 * k * k * k + 1.70158 * k * k);
    }
    this.pop = pop;
    const input = this.driver ? this.game.input : null;
    if (this.kind === 'car' || this.kind === 'bike') this.updateCar(dt, input);
    else if (this.kind === 'tank') this.updateTank(dt, input);
    else this.updateCopter(dt, input);
    this.wheelSpin += (this.speed * dt) / 0.36;
    if (this.kind === 'car') return;
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.yaw, 0);
    this.group.scale.setScalar(pop);
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
    cars.draw(this.carKind, this.color, this.pos.x, this.pos.y, this.pos.z, this.yaw, {
      spin: this.wheelSpin, steer: clamp((this.turn || 0) * 0.35, -0.45, 0.45), extra: this.extra || (this.racing ? 'plain' : null), siren, scale: this.pop || 1,
      lift: wob, roll: this.grade === 'fail' ? Math.sin(this.time * 7) * 0.03 : 0,
    });
    if (this.racing) {
      // the drawn car has racing stripes over the bonnet and the roof
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const rx = -fz;
      const rz = fx;
      for (const s of [-0.22, 0.22]) {
        const x = this.pos.x + rx * s;
        const z = this.pos.z + rz * s;
        cars.box(cars.trimBox, new THREE.Matrix4().makeRotationY(this.yaw).setPosition(x, this.pos.y, z), 0, 0.98, 1.0, 0.18, 0.05, 2.0, [0.98, 0.95, 0.88]);
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
    if (this.grade === 'fail') {
      dir.set(Math.sin(this.yaw + this.turretYaw), 0.3, Math.cos(this.yaw + this.turretYaw)).normalize();
      game.weapons.spawnShell(mw.x, mw.y, mw.z, dir.x, dir.y, dir.z, 'player', 60, 3, 9);
    } else {
      const spread = this.grade === 'wonky' ? 0.06 : 0.008;
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
      game.weapons.spawnShell(mw.x, mw.y, mw.z, dir.x, dir.y, dir.z, 'player', this.grade === 'perfect' ? 260 : 200, this.grade === 'perfect' ? 8.5 : 7, 48);
    }
    game.fx.muzzle(mw.x, mw.y, mw.z, 3);
    game.fx.smoke(mw.x, mw.y, mw.z, 2);
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
    fig.reachR = fig.wheel;
    fig.update(dt);
  }
}

export class Vehicles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  // a city car the player takes (no drawing needed)
  spawnStock(stock, pos, yaw) {
    const v = new Vehicle(this, 'car', 'good', 100, stock);
    v.pos.set(pos.x, 0, pos.z);
    v.yaw = yaw;
    this.list.push(v);
    return v;
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
      const left = v.stock && !v.driver && Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z) > 140;
      if ((v.dead && this.game.time > v.removeAt) || left) {
        v.dispose();
        continue;
      }
      keep.push(v);
    }
    this.list = keep;
  }

  draw(cars) {
    for (const v of this.list) v.draw(cars);
  }

  nearest(pos, maxD) {
    let best = null;
    let bd = maxD;
    for (const v of this.list) {
      if (v.dead) continue;
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

export { angleDiff, _q, UP };
