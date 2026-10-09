import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { civilianLook } from './looks.js';
import { holeRadius } from './enemies.js';
import { AVES, STREETS, groundHeight, blockRect, westRect, PIER, NORTH_EDGE, SOUTH_EDGE } from '../world/layout.js';
import { NODES, CYCLE } from '../world/roads.js';
import { newDog, steerDog, dogCollar, drawDog } from './dogs.js';
import { damp, dampAngle, clamp } from '../core/util.js';

const REMOVE_AT = { head: 0.45, armL: 0.45, armR: 0.45, legL: 0.42, legR: 0.42, torso: 0.36 };
const _ro = new THREE.Vector3();
const _rd = new THREE.Vector3();

// The walk round a block: the middle of the sidewalks around it (col -1: the houses west of Coral
// Ave, walked up and down along the avenue). Corners: NW, NE, SE, SW.
export function sidewalkLoop(col, row) {
  if (col < 0) {
    const R = westRect(row);
    const x = R.x1 + 2.5;
    return [[x, R.z0 - 2.5], [x, R.z1 + 2.5]];
  }
  const R = blockRect(col, row);
  const x1 = col === 2 ? R.x1 + 3.0 : R.x1 + 2.5;
  return [[R.x0 - 2.5, R.z0 - 2.5], [x1, R.z0 - 2.5], [x1, R.z1 + 2.5], [R.x0 - 2.5, R.z1 + 2.5]];
}

// the promenade: up and down along the bay
const PROM_LINES = [15.2, 17.6, 19.4];

// beyond this far from the camera a walker steps every other frame (see Civilians.update)
const FAR_STEP = 40;
/**
 * Pedestrians walking the sidewalks round their block (now and then crossing to the next one at
 * the zebra), or strolling on the promenade. They panic and run when shooting starts.
 */
class Civilian {
  constructor(mgr, bx, bz, look = null, figOpts = null) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.fig = new Doodle(mgr.game.figures, look || civilianLook(), { seed: Math.random() * 100, scale: look ? 1 : 0.93 + Math.random() * 0.1, ...(figOpts || {}) });
    // scripted people (shopkeepers, the little scenes on the street) are driven by ctrl(civ, dt),
    // which returns where to walk ({ x, z, speed }) or null to stand; they still panic and bleed ink
    this.ctrl = null;
    this.scripted = false;
    this.faceYaw = null;
    this.hopY = 0;
    this.inside = false; // gone into a shop for a moment
    this.pos = this.fig.pos;
    this.radius = 0.33;
    this.dying = -1;
    this.headlessT = 0;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    if (bx === 'prom') this.setProm(bz);
    else this.setBlock(bx, bz, true);
    this.speed = 1.2 + Math.random() * 0.5;
    this.panicT = 0;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.stopT = 0;
    this.dodgeV = new THREE.Vector3();
    // time not yet walked (far away they step every other frame)
    this.owed = 0;
  }

  // walk round block (col, row); fresh: start somewhere along it
  setBlock(col, row, fresh) {
    this.col = col;
    this.row = row;
    this.prom = false;
    this.loop = sidewalkLoop(col, row);
    const n = this.loop.length;
    if (fresh) {
      this.leg = Math.floor(Math.random() * n);
      const a = this.loop[this.leg];
      const b = this.loop[(this.leg + 1) % n];
      const t = Math.random();
      this.pos.set(a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * 1.2, groundHeight(a[0], a[1]), a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 1.2);
      this.target = this.dir > 0 ? (this.leg + 1) % n : this.leg;
    }
  }

  // somewhere along the walk between minD and maxD from p (false if the walk never comes that close)
  placeNear(p, minD, maxD) {
    const L = this.loop;
    const n = L.length;
    for (let tries = 0; tries < 12; tries++) {
      const leg = Math.floor(Math.random() * n);
      const a = L[leg];
      const b = L[(leg + 1) % n];
      const t = Math.random();
      const x = a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * 1.2;
      const z = a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 1.2;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < minD || d > maxD) continue;
      this.pos.set(x, groundHeight(x, z), z);
      if (!this.prom) this.target = this.dir > 0 ? (leg + 1) % n : leg;
      else this.target = this.dir > 0 ? 1 : 0;
      return true;
    }
    return false;
  }

  setProm(z) {
    this.prom = true;
    const x = PROM_LINES[Math.floor(Math.random() * PROM_LINES.length)];
    const za = Math.max(NORTH_EDGE + 4, z - 60 - Math.random() * 80);
    const zb = Math.min(SOUTH_EDGE + 20, z + 60 + Math.random() * 80);
    this.loop = [[x, za], [x, zb]];
    this.pos.set(x + (Math.random() - 0.5) * 1.5, groundHeight(x, z), z);
    this.target = this.dir > 0 ? 1 : 0;
  }

  // at a corner of the block: on round it, or across the road to the next block
  nextCorner() {
    const n = this.loop.length;
    if (this.prom || n === 2) {
      this.target = this.target ? 0 : 1;
      return;
    }
    const k = this.target;
    if (Math.random() < 0.28) {
      // the corners: 0 NW, 1 NE, 2 SE, 3 SW; across the street (north/south) or the avenue
      const north = k < 2;
      const west = k === 0 || k === 3;
      const opts = [];
      if (north && this.row > 0) opts.push([this.col, this.row - 1, west ? 3 : 2]);
      if (!north && this.row < 4) opts.push([this.col, this.row + 1, west ? 0 : 1]);
      if (west && this.col > 0) opts.push([this.col - 1, this.row, north ? 1 : 2]);
      if (west && this.col === 0) opts.push([-1, this.row, north ? 0 : 1]);
      if (!west && this.col < 2) opts.push([this.col + 1, this.row, north ? 0 : 3]);
      if (opts.length) {
        const [c, r, corner] = opts[Math.floor(Math.random() * opts.length)];
        this.setBlock(c, r, false);
        this.target = corner;
        this.crossing = true;
        return;
      }
    }
    this.crossing = false;
    this.target = (this.target + this.dir + n) % n;
  }

  get alive() {
    return this.dying < 0;
  }

  get headless() {
    return this.fig.parts.head < 0.5;
  }

  update(dt) {
    const game = this.game;
    const fig = this.fig;
    if (this.inside) {
      // shopping: nobody sees you, the errand brings you back out
      if (this.ctrl) this.ctrl(this, dt);
      return;
    }
    if (this.dying >= 0) {
      this.dying += dt;
      if (fig.split >= 0) {
        fig.split += dt;
        fig.speed = Math.max(0, fig.speed - dt * 2.5);
        if (fig.split < 1) {
          this.pos.x += Math.sin(this.yaw) * fig.speed * dt;
          this.pos.z += Math.cos(this.yaw) * fig.speed * dt;
        }
        fig.dissolve = clamp((this.dying - 1.8) / 0.9, 0, 1);
      } else {
        fig.dead = Math.min(1, this.dying * 2.2);
        fig.speed = 0;
        fig.dissolve = clamp((this.dying - 1.2) / 0.9, 0, 1);
      }
      fig.update(dt);
      return;
    }
    let tx;
    let tz;
    let speed = this.speed;
    const legless = fig.parts.legL < 0.5 && fig.parts.legR < 0.5;
    const limping = (fig.parts.legL < 0.5) !== (fig.parts.legR < 0.5);
    if (this.headless) {
      // runs blind in a panic, arms flailing, zig-zagging until the body gives up
      this.headlessT += dt;
      if (this.headlessT > 11) {
        this.mgr.kill(this);
        return;
      }
      if (!this.blindDir || Math.random() < dt * 0.8) this.blindDir = this.yaw + (Math.random() - 0.5) * 2.4;
      tx = this.pos.x + Math.sin(this.blindDir) * 5;
      tz = this.pos.z + Math.cos(this.blindDir) * 5;
      speed = 5.2;
      fig.flail = 1;
      fig.stagger = 1;
      fig.armsUp = 0;
    } else if (this.panicT > 0) {
      this.panicT -= dt;
      // inside a shop: out of the door first (round the counter, not through the wall)
      const ex = this.exitRoom && !this.ctrl ? this.exitTarget() : null;
      if (ex) {
        tx = ex.x;
        tz = ex.z;
      } else {
        const fx = this.pos.x - this.fearX;
        const fz = this.pos.z - this.fearZ;
        const l = Math.hypot(fx, fz) || 1;
        tx = this.pos.x + (fx / l) * 5;
        tz = this.pos.z + (fz / l) * 5;
      }
      speed = ex ? 4.4 : 5.8;
      fig.armsUp = 1;
    } else if (this.ctrl) {
      fig.flail = 0;
      const m = this.ctrl(this, dt);
      if (this.inside) return;
      if (m) {
        tx = m.x;
        tz = m.z;
        speed = m.speed;
      } else {
        tx = this.pos.x;
        tz = this.pos.z;
        speed = 0;
      }
    } else if (this.exitRoom && this.exitTarget()) {
      // let go inside a shop: out onto the sidewalk before the usual walk
      fig.armsUp = 0;
      fig.flail = 0;
      const ex = this.exitTarget();
      tx = ex.x;
      tz = ex.z;
    } else {
      fig.armsUp = 0;
      fig.flail = 0;
      const t = this.loop[this.target];
      tx = t[0];
      tz = t[1];
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.8) {
        this.nextCorner();
        this.crossOK = false;
        if (!this.crossing && Math.random() < (this.chatty ? 0.4 : 0.15)) this.stopT = 1 + Math.random() * (this.chatty ? 6 : 3);
      }
      if (this.crossing && !this.crossOK) {
        // at the curb: across only when the cars of that road have the red light
        const t2 = this.loop[this.target];
        if (this.mayCross(t2[0], t2[1])) this.crossOK = true;
        else {
          speed = 0;
          this.faceYaw = Math.atan2(t2[0] - this.pos.x, t2[1] - this.pos.z);
          this.yaw = dampAngle(this.yaw, this.faceYaw, 4, dt);
        }
      }
      // hurry across the road
      if (this.crossing && this.crossOK) speed *= this.jog ? 1 : 1.35;
      if (this.stopT > 0) {
        this.stopT -= dt;
        speed = 0;
      }
    }
    if (legless) speed = Math.min(speed, 0.8);
    else if (limping) speed = Math.min(speed * 0.45, 1.8);
    fig.crawl = damp(fig.crawl, legless ? 1 : 0, 6, dt);
    if (!this.headless) fig.stagger = limping ? 0.6 : 0;
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    // slow down on arrival instead of overshooting (scripted people stop on their marks)
    if (this.ctrl && l < 0.6) speed *= l / 0.6;
    this.vel.x = damp(this.vel.x, (dx / l) * speed, 6, dt) + this.dodgeV.x;
    this.vel.z = damp(this.vel.z, (dz / l) * speed, 6, dt) + this.dodgeV.z;
    this.dodgeV.multiplyScalar(Math.exp(-5 * dt));
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (!this.noCollide) game.world.collision.resolveCylinder(this.pos, 0.33, 1.7, 0.5);
    game.vehicles.pushOut(this.pos, 0.33);
    const gy = groundHeight(this.pos.x, this.pos.z) + (this.baseY || 0);
    this.pos.y = this.hopY > 0 ? gy + this.hopY : damp(this.pos.y, gy, 20, dt);
    fig.air = this.hopY > 0.04;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.2) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    else if (this.faceYaw !== null && this.ctrl) this.yaw = dampAngle(this.yaw, this.faceYaw, 6, dt);
    fig.yaw = this.yaw;
    fig.speed = sp;
    fig.update(dt);
  }

  // may they step off the curb towards (tx, tz)? Across an avenue when its cars wait at the red
  // light, across a street when its cars do (with time enough left to reach the other side)
  mayCross(tx, tz) {
    const mx = (this.pos.x + tx) / 2;
    const mz = (this.pos.z + tz) / 2;
    let n = null;
    let bd = 30;
    for (const m of NODES) {
      const d = Math.hypot(m.x - mx, m.z - mz);
      if (d < bd) {
        bd = d;
        n = m;
      }
    }
    if (!n || !n.signal) return true;
    const time = this.game.traffic ? this.game.traffic.time : 0;
    const ph = (((time + n.offset) % CYCLE) + CYCLE) % CYCLE;
    const acrossAve = Math.abs(tx - this.pos.x) > Math.abs(tz - this.pos.z);
    // the avenue's cars: green 0..11, yellow ..13.5, red 13.5..26; the street's: green 14.5..23
    const left = acrossAve ? (ph >= 13.5 ? CYCLE - ph : -1) : ph < 14.5 ? 14.5 - ph : ph >= 25.5 ? CYCLE - ph + 14.5 : -1;
    return left > 6;
  }

  // the next step out of the shop they are in: round the furniture, out of the door, a step onto
  // the sidewalk (null once outside)
  exitTarget() {
    const R = this.exitRoom;
    const s = this.exitShop;
    if (!this.exitPts) {
      this.exitPts = [];
      if (R && s && R.door && R.inside(this.pos.x, this.pos.z, 0.3)) {
        this.exitPts = [...R.path(this.pos.x, this.pos.z, R.door.x, R.door.z), { x: s.door[0], z: s.door[2] }, { x: s.door[0] + s.nx * 1.8, z: s.door[2] + s.nz * 1.8 }];
        this.noCollide = true;
      }
    }
    const pts = this.exitPts;
    while (pts.length && Math.hypot(pts[0].x - this.pos.x, pts[0].z - this.pos.z) < 0.45) pts.shift();
    if (pts.length <= 1) this.noCollide = false;
    if (!pts.length) {
      this.exitRoom = null;
      this.exitShop = null;
      this.exitPts = null;
      return null;
    }
    return pts[0];
  }

  dispose() {
    this.fig.dispose();
  }
}

export class Civilians {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.t = 0;
  }

  reset() {
    for (const c of this.list) c.dispose();
    this.list = [];
  }

  update(dt) {
    const game = this.game;
    const p = game.anchorPos();
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1;
      // a busy city: more people on the sidewalks around you
      const max = game.touch ? 16 : 32;
      // despawn far ones (scripted people belong to their scene, unless it let them go)
      for (const c of this.list) if ((!c.scripted || !c.owner) && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 110) c.gone = true;
      this.list = this.list.filter((c) => {
        if (c.gone) c.dispose();
        return !c.gone;
      });
      let free = 0;
      for (const c of this.list) if (!c.scripted) free++;
      const first = !this.filled;
      this.filled = true;
      let tries = first ? 60 : 8;
      // the walks that pass near you
      const near = [];
      for (let col = -1; col < 3; col++) {
        for (let row = 0; row < 5; row++) {
          const L = sidewalkLoop(col, row);
          let d = Infinity;
          for (let i = 0; i < L.length; i++) {
            const a = L[i];
            const b = L[(i + 1) % L.length];
            const dx = b[0] - a[0];
            const dz = b[1] - a[1];
            const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
            d = Math.min(d, Math.hypot(a[0] + dx * t - p.x, a[1] + dz * t - p.z));
          }
          if (d < 80) near.push([col, row]);
        }
      }
      let prom = 0;
      for (const c of this.list) if (c.prom && !c.scripted) prom++;
      const cam = game.camera;
      const fwd = cam.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
      while (free < max && tries-- > 0) {
        // the promenade (when you are near the bay), or a block round you
        let c;
        // (a jogger is dressed for it)
        const jog = Math.random() < 0.07;
        const look = jog ? civilianLook({ kind: 'sporty' }) : null;
        if (p.x > -40 && (Math.random() < 0.3 || !near.length) && prom < max * 0.35) {
          const z = Math.max(NORTH_EDGE + 10, Math.min(SOUTH_EDGE, p.z + (Math.random() - 0.5) * 160));
          if (z > PIER.z0 - 4 && z < PIER.z1 + 4) continue;
          c = new Civilian(this, 'prom', z, look);
        } else if (near.length) {
          const [col, row] = near[Math.floor(Math.random() * near.length)];
          c = new Civilian(this, col, row, look);
        } else continue;
        if (jog) {
          c.jog = true;
          c.speed = 3.1 + Math.random() * 0.8;
        }
        // most of them close by (the street you are on is full of people)
        const far = Math.random() < 0.3;
        if (!c.placeNear(p, first ? 3 : far ? 45 : 16, far ? 100 : 60)) {
          c.dispose();
          continue;
        }
        // nobody pops up in plain sight
        const vx = c.pos.x - cam.position.x;
        const vz = c.pos.z - cam.position.z;
        const vd = Math.hypot(vx, vz) || 1;
        if (!first && vd < 50 && (vx * fwd.x + vz * fwd.z) / vd > 0.25) {
          c.dispose();
          continue;
        }
        if (c.prom) prom++;
        this.list.push(c);
        free++;
        // who they are out there: a dog walker, a jogger, on the phone, with friends...
        if (!c.jog) {
          this.dressUp(c);
          if (!c.dog && !c.jog && Math.random() < 0.14 && free < max) {
            if (this.addBuddy(c)) free++;
          }
        }
      }
    }
    // far from the camera a plain walker takes its steps every other frame, twice as long (from
    // there nobody can tell; it halves their share of the work). Half of them move on even
    // frames, half on odd ones.
    const cam = game.camera.position;
    this.frameN = (this.frameN || 0) + 1;
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      let step = dt + c.owed;
      if (!c.ctrl && !c.scripted && c.dying < 0 && !(c.panicT > 0) && !c.headless && !c.inside) {
        const dx = c.pos.x - cam.x;
        const dz = c.pos.z - cam.z;
        if (dx * dx + dz * dz > FAR_STEP * FAR_STEP && ((this.frameN + i) & 1)) {
          c.owed = step;
          continue;
        }
      }
      c.owed = 0;
      c.update(step);
      if (c.dog) this.walkDog(c, step);
    }
    if (this.list.some((c) => c.fig.dissolve >= 1)) {
      this.list = this.list.filter((c) => {
        if (c.fig.dissolve < 1) return true;
        c.dispose();
        return false;
      });
    }
  }

  // a scripted person for a shop or a street scene; owner is told when it is gone
  spawnScripted(x, z, look, owner, figOpts = null) {
    const [bx, bz] = this.nearestBlock(x, z);
    const c = new Civilian(this, bx, bz, look, figOpts);
    c.pos.set(x, groundHeight(x, z), z);
    c.scripted = true;
    c.owner = owner;
    c.speed = 1.25;
    this.list.push(c);
    return c;
  }

  // hand a scripted person back to the city: from now on they just walk their block
  release(c) {
    if (!c) return;
    c.ctrl = null;
    c.owner = null;
    c.faceYaw = null;
    c.hopY = 0;
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.lookAt = null;
    c.fig.sit = 0;
    c.fig.dance = 0;
    c.fig.armsUp = 0;
    c.noCollide = false;
    c.baseY = 0;
    if (c.inside) {
      c.inside = false;
      c.fig.setVisible(true);
    }
  }

  remove(c) {
    if (!c) return;
    const i = this.list.indexOf(c);
    if (i >= 0) this.list.splice(i, 1);
    c.dispose();
  }

  // the block whose sidewalk loop passes nearest (x, z) (or the promenade)
  nearestBlock(x, z) {
    if (x > 12) return ['prom', z];
    let best = [0, 0];
    let bd = Infinity;
    for (let col = -1; col < 3; col++) {
      for (let row = 0; row < 5; row++) {
        const L = sidewalkLoop(col, row);
        for (let i = 0; i < L.length; i++) {
          const a = L[i];
          const b = L[(i + 1) % L.length];
          const dx = b[0] - a[0];
          const dz = b[1] - a[1];
          const l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
          const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
          if (d < bd) {
            bd = d;
            best = [col, row];
          }
        }
      }
    }
    return best;
  }

  // somebody who just got out of a car at (x, z): walks the sidewalk of the nearest block
  spawnAt(x, z, look) {
    const [bx, bz] = this.nearestBlock(x, z);
    const c = new Civilian(this, bx, bz, look);
    c.pos.set(x, groundHeight(x, z), z);
    this.list.push(c);
    return c;
  }

  // ------------------------------------------------------------------ getting hit
  segmentHit(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return null;
    const ro = _ro.set(ox, oy, oz);
    const rd = _rd.set(dx / len, dy / len, dz / len);
    const len2 = dx * dx + dz * dz;
    for (const c of this.list) {
      if (!c.alive || c.inside) continue;
      let t = len2 > 1e-8 ? ((c.pos.x - ox) * dx + (c.pos.z - oz) * dz) / len2 : 0;
      t = Math.max(0, Math.min(maxT, t));
      if (Math.hypot(ox + dx * t - c.pos.x, oz + dz * t - c.pos.z) > 1.2) continue;
      const h = c.fig.raycast(ro, rd, maxT * len);
      if (h && (!best || h.t / len < best.t)) best = { t: h.t / len, civ: c, part: h.part, point: h.point };
    }
    return best;
  }

  inArc(pos, fwd, range, halfAngle) {
    const out = [];
    for (const c of this.list) {
      if (!c.alive || c.inside) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + 0.4) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dz * fwd.z) / (d || 1))));
      if (a < halfAngle || d < 0.8) out.push(c);
    }
    return out;
  }

  damage(c, point, kind, amount) {
    if (!c.alive) return;
    const game = this.game;
    const fig = c.fig;
    const res = fig.erase(point, holeRadius(kind, amount));
    game.fx.crumbs(point.x, point.y, point.z, 8, 2.5);
    game.audio.play('erase', 0.5);
    this.panic(c.pos, 30);
    c.panicT = c.brave ? 0 : 8;
    if (game.onCivilianHurt) game.onCivilianHurt(c);
    if (!res) return;
    const part = res.part;
    if (fig.parts[part] > 0.5 && fig.erased[part] >= REMOVE_AT[part]) {
      fig.removePart(part);
      const j = fig.j;
      const at = part === 'head' ? j.headC : fig.center;
      game.fx.crumbs(at.x, at.y, at.z, 22, 3.2);
      game.fx.smoke(at.x, at.y, at.z, 0.6);
      game.audio.play('erase', 1);
      if (part === 'torso') {
        this.kill(c, 'split');
        return;
      }
    }
    let lost = 0;
    for (const k of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) lost += fig.parts[k] < 0.5 ? 0.5 : fig.erased[k] * 0.5;
    if (lost >= 1.4 || (c.headless && fig.erased.torso > 0.25)) this.kill(c);
  }

  explosion(x, y, z, radius) {
    const at = new THREE.Vector3();
    for (const c of this.list) {
      if (!c.alive || c.inside) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.y + 1 - y, c.pos.z - z);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const n = 2 + Math.round(f * 3);
      for (let i = 0; i < n && c.alive; i++) {
        c.fig.ensureShapes();
        const s = c.fig.shapes[Math.floor(Math.random() * c.fig.shapes.length)];
        if (!s) break;
        at.set(x, y, z).lerp(s.c, 0.92);
        c.fig.closestSurfacePoint(at, at);
        this.damage(c, at, 'blast', 60 + 140 * f);
      }
    }
  }

  kill(c, how) {
    if (!c.alive) return;
    c.dying = 0;
    if (how === 'split') {
      c.fig.split = 0;
      c.fig.splitDir = Math.random() < 0.5 ? 1 : -1;
      c.fig.parts.torso = 0;
      c.fig.speed = Math.max(c.fig.speed, 1.5);
    }
    this.game.fx.crumbs(c.pos.x, c.pos.y + 1, c.pos.z, 26, 3.2);
    if (this.game.onCivilianKilled) this.game.onCivilianKilled(c);
  }

  panic(pos, radius) {
    for (const c of this.list) {
      if (c.inside) continue;
      // (the friend you drew stays by your side)
      if (c.brave) continue;
      if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < radius) {
        if (c.panicT <= 0 && Math.random() < 0.3) this.game.fx.mark('fx_alert', c.pos.x, c.pos.y + 2.4, c.pos.z, 0.6, 0.8);
        c.panicT = 6 + Math.random() * 3;
        c.fearX = pos.x;
        c.fearZ = pos.z;
      }
    }
  }

  dodge(pos, f, halfLen, halfWid, speed) {
    if (Math.abs(speed) < 2) return;
    for (const c of this.list) {
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const along = dx * f.x + dz * f.z;
      const side = dx * f.z - dz * f.x;
      if (along > -halfLen && along < halfLen + Math.abs(speed) * 0.5 && Math.abs(side) < halfWid + 0.6) {
        const s = Math.sign(side) || 1;
        c.dodgeV.set(f.z * s * 7, 0, -f.x * s * 7);
        c.panicT = 4;
        c.fearX = pos.x;
        c.fearZ = pos.z;
      }
    }
  }

  draw(camPos) {
    const bodies = this.game.figures.bodies;
    const fwd = this.game.camera.getWorldDirection(this._cf || (this._cf = new THREE.Vector3()));
    for (const c of this.list) {
      if (c.inside) continue;
      const dx = c.pos.x - camPos.x;
      const dz = c.pos.z - camPos.z;
      const d = Math.hypot(dx, dz);
      // (nobody behind the camera is drawn, beyond a step or two: their shadows fall away from
      // the low sun anyway)
      const seen = d < 130 && (d < 8 || (dx * fwd.x + dz * fwd.z) / d > -0.35);
      c.fig.setVisible(seen);
      if (!seen) continue;
      c.fig.draw(camPos);
      if (c.dog && d < 90) drawDog(bodies, c.dog);
    }
  }

  // ------------------------------------------------------------------ the life of the sidewalk
  // A new face on the street is somebody: out walking the dog, jogging, on the phone, back from
  // the shops with a bag, with a coffee, or two friends walking and talking.
  dressUp(c) {
    const r = Math.random();
    if (c.jog) return;
    c.jog = false;
    if (r < 0.08) {
      c.dog = newDog(c.pos.x + 1, c.pos.z);
      c.dog.y = c.pos.y;
      c.fig.carryL = 'leash';
      c.fig.leashTo = new THREE.Vector3();
      c.speed = 1.05;
    } else if (r < 0.18) {
      c.fig.carry = 'phone';
      c.speed = 0.95 + Math.random() * 0.3;
      c.chatty = true;
    } else if (r < 0.33) {
      c.fig.carry = 'coffee';
    } else if (r < 0.42) {
      c.fig.carry = 'bag';
    }
  }

  // a friend walking alongside c (and stopping with them to talk)
  addBuddy(c) {
    if (c.prom || c.loop.length < 4) return null;
    const b = new Civilian(this, c.col, c.row);
    b.pos.set(c.pos.x + 0.8, c.pos.y, c.pos.z);
    b.scripted = false;
    b.buddyOf = c;
    c.chatty = true;
    c.buddy = b;
    const lines = ['No way!', 'Ha ha ha!', 'Seriously?', 'I know, right?', 'Let\'s get pizza.', 'Did you see that?', 'Tell me more!'];
    let talkT = 2 + Math.random() * 4;
    b.ctrl = (me, dt) => {
      const L = me.buddyOf;
      if (!L || !L.alive || L.gone || L.panicT > 0) {
        me.ctrl = null;
        me.buddyOf = null;
        return null;
      }
      const f = L.fig.forward;
      const side = L.fig.right;
      const tx = L.pos.x + side.x * 0.85 - f.x * 0.1;
      const tz = L.pos.z + side.z * 0.85 - f.z * 0.1;
      const d = Math.hypot(tx - me.pos.x, tz - me.pos.z);
      const lsp = Math.hypot(L.vel.x, L.vel.z);
      talkT -= dt;
      if (talkT < 0) {
        talkT = 3 + Math.random() * 5;
        const p = this.game.player.pos;
        const who = Math.random() < 0.5 ? me : L;
        if (Math.hypot(who.pos.x - p.x, who.pos.z - p.z) < 18) this.game.bubbles.say(who, lines[Math.floor(Math.random() * lines.length)]);
      }
      if (lsp < 0.2 && d < 1.4) {
        // stopped: turned to each other, talking
        me.faceYaw = Math.atan2(L.pos.x - me.pos.x, L.pos.z - me.pos.z);
        return null;
      }
      return { x: tx, z: tz, speed: Math.min(4, lsp + d * 1.2) };
    };
    this.list.push(b);
    return b;
  }

  walkDog(c, dt) {
    const dog = c.dog;
    const f = c.fig.forward;
    const rt = c.fig.right;
    const moving = Math.hypot(c.vel.x, c.vel.z) > 0.25;
    // trotting a little ahead and to the side; sniffing about when they stop
    const tx = c.pos.x + (moving ? f.x * 1.3 : f.x * 0.9) + rt.x * 0.45;
    const tz = c.pos.z + (moving ? f.z * 1.3 : f.z * 0.9) + rt.z * 0.45;
    steerDog(dog, tx, tz, c.panicT > 0 ? 6 : Math.max(1.4, Math.hypot(c.vel.x, c.vel.z) + 0.5), dt);
    dog.y = groundHeight(dog.x, dog.z);
    if (c.fig.leashTo) dogCollar(dog, c.fig.leashTo);
  }
}

export { AVES, STREETS };
