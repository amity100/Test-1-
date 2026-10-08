import * as THREE from 'three';
import { MeshBuilder } from '../render/MeshBuilder.js';
import { StrokeList } from '../render/LineBatch.js';
import { carShape } from '../world/props.js';
import { blockRect } from '../world/layout.js';
import { COL } from '../world/buildings.js';
import { Doodle } from './doodle.js';
import { civilianLook, copLook, swatLook } from './looks.js';
import { damp, dampAngle, angleDiff } from '../core/util.js';
import { BLACK_INK } from '../render/LineBatch.js';

const LANE = 3.6;
export const CAR_VARIANTS = [
  { color: COL.yellow, taxi: true },
  { color: COL.yellow, taxi: true },
  { color: COL.blue, taxi: false },
  { color: COL.red, taxi: false },
  { color: COL.gray, taxi: false },
  { color: COL.green, taxi: false },
  { color: COL.white, taxi: false, police: true },
];
const CIVIL_VARIANTS = 6;
export const POLICE_VARIANT = 6;

// Model of a city car (body, see-through windows, ink), built along +x like the parked ones.
export function buildCarModel(mats, color, taxi, police = false) {
  const ch = { mb: new MeshBuilder(), sl: new StrokeList(), glass: new MeshBuilder() };
  carShape(null, ch, 0, 0, true, color, taxi, false);
  if (police) policeDress(ch);
  return { geo: ch.mb.build(), glass: ch.glass.build(), lines: ch.sl.toBatch(mats.line) };
}

// light bar, a blue stripe and hand-lettered SCPD on both doors
const LETTERS = {
  S: [[1, 1], [0, 1], [0, 0.5], [1, 0.5], [1, 0], [0, 0]],
  C: [[1, 1], [0, 1], [0, 0], [1, 0]],
  P: [[0, 0], [0, 1], [1, 1], [1, 0.5], [0, 0.5]],
  D: [[0, 0], [0, 1], [0.65, 1], [1, 0.7], [1, 0.3], [0.65, 0], [0, 0]],
};
const SIREN_RED = [0.92, 0.2, 0.22];
const SIREN_BLUE = [0.25, 0.4, 0.95];

function policeDress(ch) {
  const ink = { width: 1.6, overshoot: 0.02, wobble: 0.01 };
  ch.mb.box([-0.3, 1.45, -0.55], [0.12, 1.6, 0], { color: SIREN_RED, bottom: true });
  ch.mb.box([-0.3, 1.45, 0], [0.12, 1.6, 0.55], { color: SIREN_BLUE, bottom: true });
  ch.sl.boxEdges([-0.3, 1.45, -0.55], [0.12, 1.6, 0.55], ink);
  ch.mb.box([-2.2, 0.32, -0.9], [2.2, 0.5, 0.9], { color: [0.18, 0.2, 0.3], skipTop: false });
  for (const s of [-1, 1]) {
    const zz = s * 0.895;
    ch.sl.seg([-2.15, 0.82, zz], [2.15, 0.82, zz], { width: 4, overshoot: 0, color: [0.2, 0.32, 0.72] });
    // letters read left-to-right from either side
    const word = 'SCPD';
    const h = 0.2;
    const w = 0.15;
    const gap = 0.07;
    const total = word.length * w + (word.length - 1) * gap;
    for (let k = 0; k < word.length; k++) {
      const pts = LETTERS[word[k]];
      const u0 = -0.45 + (s > 0 ? total / 2 - k * (w + gap) : -total / 2 + k * (w + gap));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const ua = s > 0 ? u0 - a[0] * w : u0 + a[0] * w;
        const ub = s > 0 ? u0 - b[0] * w : u0 + b[0] * w;
        ch.sl.seg([ua, 0.48 + a[1] * h, zz * 1.003], [ub, 0.48 + b[1] * h, zz * 1.003], { width: 2.2, overshoot: 0, wobble: 0.01, color: BLACK_INK });
      }
    }
  }
}

export function carGroup(mats, m) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(m.geo, mats.surface));
  const gl = new THREE.Mesh(m.glass, mats.glass);
  gl.renderOrder = 9;
  group.add(gl);
  const lm = new THREE.Mesh(m.lines.geometry, mats.line);
  lm.frustumCulled = false;
  lm.renderOrder = 10;
  group.add(lm);
  return group;
}

// where the driver sits, in car-local (x forward, z to the right)
export const DRIVER_SEAT = { u: -0.32, s: -0.42 };

/**
 * Ambient traffic: taxis and cars circling blocks clockwise in the right-hand lane, each
 * with somebody at the wheel. They brake for anything in front of them and honk at the
 * player, who can pull a driver out and take the car.
 */
export class Traffic {
  constructor(game) {
    this.game = game;
    this.models = CAR_VARIANTS.map((v) => buildCarModel(game.mats, v.color, v.taxi, v.police));
    this.list = [];
    this.t = 0;
  }

  reset() {
    for (const c of this.list) this.removeCar(c);
    this.list = [];
  }

  removeCar(c) {
    this.game.scene.remove(c.group);
    if (c.driver) {
      c.driver.fig.dispose();
      c.driver = null;
    }
    if (c.crew) {
      for (const m of c.crew) m.fig.dispose();
      c.crew = null;
    }
    this.unpark(c);
  }

  route(bx, bz) {
    const r = blockRect(bx, bz);
    return [
      [r.x0 - LANE, r.z1 + LANE],
      [r.x0 - LANE, r.z0 - LANE],
      [r.x1 + LANE, r.z0 - LANE],
      [r.x1 + LANE, r.z1 + LANE],
    ];
  }

  spawn(bx, bz) {
    const game = this.game;
    const route = this.route(bx, bz);
    const leg = Math.floor(Math.random() * 4);
    const a = route[leg];
    const b = route[(leg + 1) % 4];
    const t = 0.15 + Math.random() * 0.7;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    // don't spawn on top of another car
    for (const c of this.list) if (Math.hypot(c.pos.x - x, c.pos.z - z) < 9) return null;
    const variant = Math.floor(Math.random() * CIVIL_VARIANTS);
    const group = carGroup(game.mats, this.models[variant]);
    game.scene.add(group);
    const car = {
      group,
      variant,
      route,
      target: (leg + 1) % 4,
      pos: new THREE.Vector3(x, 0, z),
      yaw: Math.atan2(b[0] - a[0], b[1] - a[1]),
      speed: 0,
      maxSpeed: 9 + Math.random() * 4,
      blockedT: 0,
      wrecked: false,
      halfLen: 2.2,
      halfWid: 0.95,
      ink: 120,
      driver: null,
    };
    car.driver = { look: civilianLook(), fig: null };
    car.driver.fig = new Doodle(game.figures, car.driver.look, { seed: Math.random() * 100 });
    car.driver.fig.sit = 1;
    this.list.push(car);
    return car;
  }

  update(dt) {
    const game = this.game;
    const p = game.anchorPos();
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1.2;
      for (const c of this.list) {
        const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
        // empty police cars go when the chase is over and you are gone
        const done = c.police && !game.police.hostile && (c.mode === 'parked' || c.mode === 'leave') && d > 60;
        if (d > 150 || done) {
          this.removeCar(c);
          c.gone = true;
        }
      }
      this.list = this.list.filter((c) => !c.gone);
      const max = game.touch ? 7 : 11;
      let tries = 4;
      while (this.list.filter((c) => !c.police).length < max && tries-- > 0) {
        const bx = Math.floor(Math.random() * 5);
        const bz = Math.floor(Math.random() * 5);
        const r = blockRect(bx, bz);
        const d = Math.hypot((r.x0 + r.x1) / 2 - p.x, (r.z0 + r.z1) / 2 - p.z);
        if (d > 110) continue;
        const c = this.spawn(bx, bz);
        if (c && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 25) {
          this.removeCar(c);
          this.list.pop();
        }
      }
    }
    for (const c of this.list) this.updateCar(c, dt);
    if (this.list.some((c) => c.poofT !== undefined && c.poofT > 0.45)) {
      this.list = this.list.filter((c) => {
        if (c.poofT === undefined || c.poofT <= 0.45) return true;
        this.removeCar(c);
        return false;
      });
    }
  }

  blocked(c) {
    const game = this.game;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const test = (x, z, r) => {
      const dx = x - c.pos.x;
      const dz = z - c.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      return along > 0.5 && along < 8.5 && side < 1.6 + r;
    };
    const pl = game.player;
    if (!pl.inVehicle && pl.mode !== 'dead' && test(pl.pos.x, pl.pos.z, 0.3)) return 'player';
    for (const v of game.vehicles.list) if (!v.dead && test(v.pos.x, v.pos.z, v.radius * 0.6)) return v.driver ? 'player' : 'car';
    for (const o of this.list) if (o !== c && test(o.pos.x, o.pos.z, 0.8)) return 'car';
    for (const e of game.enemies.list) if (e.alive && test(e.pos.x, e.pos.z, 0.4)) return 'other';
    for (const h of game.civilians.list) if (test(h.pos.x, h.pos.z, 0.3)) return 'other';
    return null;
  }

  updateCar(c, dt) {
    if (c.police && c.mode !== 'patrol' && c.poofT === undefined && !c.wrecked) {
      this.updatePolice(c, dt);
    } else if (c.poofT !== undefined) {
      // rubbed out: shrinks into a puff of eraser crumbs
      c.poofT += dt;
      const k = Math.max(0.01, 1 - c.poofT / 0.45);
      c.group.scale.set(k, k * k, k);
      c.speed = damp(c.speed, 0, 6, dt);
    } else if (c.wrecked || c.stopped) {
      c.speed = damp(c.speed, 0, c.stopped ? 8 : 3, dt);
      if (c.wrecked && Math.random() < dt * 2) this.game.fx.smoke(c.pos.x, 1.6, c.pos.z, 1.2);
    } else {
      const t = c.route[c.target];
      const dx = t[0] - c.pos.x;
      const dz = t[1] - c.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 5) c.target = (c.target + 1) % 4;
      c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), d < 9 ? 3.2 : 6, dt);
      const why = this.blocked(c);
      const want = why ? 0 : c.maxSpeed * (d < 9 ? 0.55 : 1);
      c.speed = damp(c.speed, want, why ? 5 : 1.2, dt);
      if (why === 'player') {
        c.blockedT += dt;
        if (c.blockedT > 1.2) {
          c.blockedT = -2.5;
          this.game.audio.play('honk', 0.6);
          if (c.driver && Math.random() < 0.5) this.game.bubbles.say(c.driver, pick(['Move it!', 'Hey, buddy!', 'C\'mon!', 'Get outta the road!']));
        }
      } else c.blockedT = Math.min(c.blockedT, 0);
    }
    c.pos.x += Math.sin(c.yaw) * c.speed * dt;
    c.pos.z += Math.cos(c.yaw) * c.speed * dt;
    c.group.position.copy(c.pos);
    c.group.rotation.set(0, c.yaw - Math.PI / 2, 0);
    if (c.driver) this.seat(c.driver.fig, c.pos, c.yaw, dt);
    if (c.crew) c.crew.forEach((m, i) => this.seat(m.fig, c.pos, c.yaw, dt, i === 0 ? 1 : -1));
  }

  // put a seated figure in a car at pos/yaw: side 1 = driver (left), -1 = passenger
  seat(fig, pos, yaw, dt, side = 1) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = -fz;
    const rz = fx;
    const u = DRIVER_SEAT.u;
    const s = -DRIVER_SEAT.s * side; // "right" points away from the driver's seat
    fig.pos.set(pos.x + fx * u - rx * s, pos.y + 0.02, pos.z + fz * u - rz * s);
    fig.yaw = yaw;
    fig.sit = 1;
    fig.speed = 0;
    if (!fig.wheel) fig.wheel = new THREE.Vector3();
    fig.wheel.set(pos.x + fx * (u + 0.55) - rx * s, pos.y + 1.0, pos.z + fz * (u + 0.55) - rz * s);
    fig.reachR = side > 0 ? fig.wheel : null;
    fig.update(dt);
  }

  // ------------------------------------------------------------------ police cars
  makeCrew(types) {
    return types.map((type) => {
      const look = type === 'swat' ? swatLook() : copLook();
      const fig = new Doodle(this.game.figures, look, { seed: Math.random() * 100 });
      fig.sit = 1;
      return { type, look, fig };
    });
  }

  policeCar(x, z, yaw, crewTypes, mode) {
    const game = this.game;
    const group = carGroup(game.mats, this.models[POLICE_VARIANT]);
    game.scene.add(group);
    // the block loop nearest to where it is, for when it goes back on patrol
    let bx = 0;
    let bz = 0;
    let bd = Infinity;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const r = blockRect(i, j);
        const d = Math.hypot((r.x0 + r.x1) / 2 - x, (r.z0 + r.z1) / 2 - z);
        if (d < bd) {
          bd = d;
          bx = i;
          bz = j;
        }
      }
    }
    const car = {
      group, variant: POLICE_VARIANT, police: true, mode,
      route: this.route(bx, bz), target: 0,
      pos: new THREE.Vector3(x, 0, z), yaw, speed: mode === 'pursuit' ? 10 : 0, maxSpeed: 10,
      blockedT: 0, wrecked: false, halfLen: 2.2, halfWid: 0.95, ink: 200,
      driver: null, crew: this.makeCrew(crewTypes), siren: mode === 'pursuit',
      path: null, pathI: 0, pathT: 0,
    };
    this.list.push(car);
    return car;
  }

  spawnPolice(x, z, yaw, crewTypes) {
    for (const c of this.list) if (Math.hypot(c.pos.x - x, c.pos.z - z) < 7) return null;
    return this.policeCar(x, z, yaw, crewTypes, 'pursuit');
  }

  // a patrol car doing its rounds on a block near (but not right next to) you
  spawnPatrol() {
    const p = this.game.player.inVehicle ? this.game.player.inVehicle.pos : this.game.player.pos;
    for (let tries = 0; tries < 8; tries++) {
      const bx = Math.floor(Math.random() * 5);
      const bz = Math.floor(Math.random() * 5);
      const r = blockRect(bx, bz);
      const d = Math.hypot((r.x0 + r.x1) / 2 - p.x, (r.z0 + r.z1) / 2 - p.z);
      if (d > 110 || d < 45) continue;
      const route = this.route(bx, bz);
      const leg = Math.floor(Math.random() * 4);
      const a = route[leg];
      const b = route[(leg + 1) % 4];
      const t = 0.3 + Math.random() * 0.4;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      if (this.list.some((c) => Math.hypot(c.pos.x - x, c.pos.z - z) < 9)) continue;
      const car = this.policeCar(x, z, Math.atan2(b[0] - a[0], b[1] - a[1]), ['cop', 'cop'], 'patrol');
      car.route = route;
      car.target = (leg + 1) % 4;
      return car;
    }
    return null;
  }

  // chase: follow a path to where the police think you are, pull up and let them out
  updatePolice(c, dt) {
    const game = this.game;
    const P = game.police;
    if (c.mode === 'pursuit') {
      c.siren = true;
      const T = P.target();
      const d = Math.hypot(T.x - c.pos.x, T.z - c.pos.z);
      c.pathT -= dt;
      if (!c.path || c.pathT <= 0) {
        c.pathT = 1.4;
        const path = game.enemies.pf.find(c.pos.x, c.pos.z, T.x, T.z, 3000);
        if (path) {
          c.path = path;
          c.pathI = 0;
        }
      }
      let wx = T.x;
      let wz = T.z;
      if (c.path) {
        while (c.pathI < c.path.length - 1 && Math.hypot(c.path[c.pathI][0] - c.pos.x, c.path[c.pathI][1] - c.pos.z) < 4) c.pathI++;
        wx = c.path[c.pathI][0];
        wz = c.path[c.pathI][1];
      }
      const want = Math.atan2(wx - c.pos.x, wz - c.pos.z);
      const turn = Math.abs(angleDiff(c.yaw, want));
      c.yaw = dampAngle(c.yaw, want, 3.2, dt);
      const why = this.blocked(c);
      const p = game.player;
      const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
      const sees = d < 30 && game.world.collision.lineOfSight(c.pos.x, 1.4, c.pos.z, pp.x, pp.y + 1.2, pp.z);
      if (d < 14 || (sees && d < 24) || why === 'player') {
        c.speed = damp(c.speed, 0, 5, dt);
        if (c.speed < 2) {
          this.park(c);
          P.deploy(c);
        }
      } else {
        const vmax = d < 35 ? 9 : 17;
        c.speed = damp(c.speed, vmax * (turn > 0.9 ? 0.3 : turn > 0.4 ? 0.65 : 1), why ? 6 : 1.4, dt);
        if (why === 'car' || why === 'other') c.speed = Math.min(c.speed, 3);
      }
    } else {
      // parked with the lights on while the chase lasts, or leaving
      c.siren = c.mode === 'parked' && P.hostile;
      c.speed = damp(c.speed, 0, 6, dt);
    }
  }

  // a stopped police car is real cover: bullets hit it and officers crouch behind it
  park(c) {
    if (c.box !== undefined) return;
    const game = this.game;
    const fx = Math.abs(Math.sin(c.yaw));
    const fz = Math.abs(Math.cos(c.yaw));
    const hx = fx * c.halfLen + fz * c.halfWid;
    const hz = fz * c.halfLen + fx * c.halfWid;
    c.box = game.world.collision.addBox(c.pos.x - hx, c.pos.z - hz, c.pos.x + hx, c.pos.z + hz, 0, 1.45, 'car');
    game.enemies.cover.addBox(game.world.collision.boxes[c.box]);
    game.world.nav.refresh(c.pos.x - hx - 1, c.pos.z - hz - 1, c.pos.x + hx + 1, c.pos.z + hz + 1);
  }

  unpark(c) {
    if (c.box === undefined) return;
    const game = this.game;
    const b = game.world.collision.boxes[c.box];
    game.world.collision.remove(c.box);
    game.world.nav.refresh(b.x0 - 1, b.z0 - 1, b.x1 + 1, b.z1 + 1);
    c.box = undefined;
  }

  draw(camPos) {
    const fr = this.game.figures;
    const blink = Math.floor(this.game.time * 5) % 2;
    for (const c of this.list) {
      if (c.poofT !== undefined) continue;
      const d = Math.hypot(c.pos.x - camPos.x, c.pos.z - camPos.z);
      const people = c.driver ? [c.driver] : c.crew || [];
      for (const m of people) {
        m.fig.setVisible(d < 70);
        if (d < 70) m.fig.draw(camPos);
      }
      if (c.siren && d < 160) {
        // flashing light bar
        const fx = Math.sin(c.yaw);
        const fz = Math.cos(c.yaw);
        const rx = -fz;
        const rz = fx;
        const cx = c.pos.x - fx * 0.09;
        const cz = c.pos.z - fz * 0.09;
        const s0 = blink ? -1 : 1;
        const col = blink ? SIREN_RED : SIREN_BLUE;
        fr.lineXYZ(cx + rx * 0.05 * s0, 1.66, cz + rz * 0.05 * s0, cx + rx * 0.5 * s0, 1.66, cz + rz * 0.5 * s0, col, 16, 3, 1, 0.01, 0);
        fr.lineXYZ(cx + rx * 0.2 * s0, 1.75, cz + rz * 0.2 * s0, cx + rx * 0.35 * s0, 1.95, cz + rz * 0.35 * s0, col, 3, 4, 0.8, 0.02, 0);
      }
    }
  }

  // ------------------------------------------------------------------ the player and cars
  // a car whose door the player is standing at
  nearestDoor(pos, maxD = 1.6) {
    let best = null;
    let bd = maxD;
    for (const c of this.list) {
      if (c.poofT !== undefined) continue;
      const d = this.boxDist(c, pos.x, pos.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  boxDist(c, x, z) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const dx = x - c.pos.x;
    const dz = z - c.pos.z;
    const along = Math.abs(dx * fx + dz * fz) - c.halfLen;
    const side = Math.abs(dx * fz - dz * fx) - c.halfWid;
    return Math.hypot(Math.max(0, along), Math.max(0, side));
  }

  // pull the car out of traffic for the player to drive (the caller makes the vehicle)
  take(c) {
    const i = this.list.indexOf(c);
    if (i >= 0) this.list.splice(i, 1);
    this.game.scene.remove(c.group);
    this.unpark(c);
    const driver = c.driver;
    const crew = c.crew;
    c.driver = null;
    c.crew = null;
    return { variant: c.variant, pos: c.pos.clone(), yaw: c.yaw, driver, crew, police: !!c.police };
  }

  // in front of the swinging eraser
  inArc(pos, fwd, reach) {
    let best = null;
    let bd = reach;
    for (const c of this.list) {
      if (c.poofT !== undefined) continue;
      const d = this.boxDist(c, pos.x, pos.z);
      if (d > bd) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      if ((dx * fwd.x + dz * fwd.z) / (Math.hypot(dx, dz) || 1) < 0.2 && d > 0.5) continue;
      bd = d;
      best = c;
    }
    return best;
  }

  // the eraser rubs at a car; when it runs out of ink it is gone (the driver jumps out first)
  rub(c, amount, at) {
    c.ink -= amount;
    c.stopped = true;
    this.game.world.objects.addSpot(at.x, at.y, at.z, 0.4);
    this.game.fx.crumbs(at.x, at.y, at.z, 12, 2.6);
    if (c.driver && !c.driverOut) {
      c.driverOut = true;
      this.game.ejectDriver(c.driver, c.pos, c.yaw, false);
      c.driver = null;
    }
    if (c.ink <= 0 && c.poofT === undefined) {
      c.poofT = 0;
      this.game.fx.crumbs(c.pos.x, 1, c.pos.z, 50, 4);
      this.game.fx.smoke(c.pos.x, 1, c.pos.z, 2.4);
      this.game.audio.play('erase', 1);
      if (this.game.onCrime) this.game.onCrime('vandal', c.pos.x, c.pos.z);
    }
  }

  // keep the player's vehicles out of traffic cars
  collideVehicle(v) {
    for (const c of this.list) {
      if (c.poofT !== undefined) continue;
      const dx = v.pos.x - c.pos.x;
      const dz = v.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      const r = v.radius + 1.5;
      if (d < r && d > 1e-3) {
        const push = r - d;
        v.pos.x += (dx / d) * push * 0.7;
        v.pos.z += (dz / d) * push * 0.7;
        c.pos.x -= (dx / d) * push * 0.3;
        c.pos.z -= (dz / d) * push * 0.3;
        if (Math.abs(v.speed) > 6) {
          if (v.kind === 'tank' && !c.wrecked) {
            c.wrecked = true;
            this.game.fx.sprite('fx_crash', c.pos.x, 1.2, c.pos.z, { size: 2.4, life: 0.4 });
            this.game.audio.play('crash', 0.8);
          } else {
            this.game.audio.play('crash', 0.5);
            v.hurt(Math.abs(v.speed) * 0.8);
          }
          v.speed *= 0.4;
        }
      }
    }
  }

  // walkers bump into traffic like into parked cars
  pushOut(p, r) {
    for (const c of this.list) {
      if (c.poofT !== undefined) continue;
      const dx = p.x - c.pos.x;
      const dz = p.z - c.pos.z;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const along = dx * fx + dz * fz;
      const side = dx * fz - dz * fx;
      const hl = c.halfLen + r;
      const hw = c.halfWid + r;
      if (Math.abs(along) < hl && Math.abs(side) < hw && p.y < 1.5) {
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

  explosion(x, z, radius) {
    for (const c of this.list) {
      if (Math.hypot(c.pos.x - x, c.pos.z - z) < radius + 1.5) c.wrecked = true;
    }
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
