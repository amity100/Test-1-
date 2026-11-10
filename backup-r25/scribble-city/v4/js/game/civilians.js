import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { civilianLook } from './looks.js';
import { holeRadius } from './enemies.js';
import { AVES, STREETS, BLOCK_TYPES, groundHeight, blockRect, westRect, PIER, NORTH_EDGE, SOUTH_EDGE } from '../world/layout.js';
import { NODES, CYCLE } from '../world/roads.js';
import { newDog, steerDog, dogCollar, drawDog } from './dogs.js';
import { damp, dampAngle, clamp } from '../core/util.js';
import { WORK_CLOTHES, NIGHT_CLOTHES } from './rhythm.js';
import { downStep, drawStars, CIV_KO } from './fists.js';

const REMOVE_AT = { head: 0.45, armL: 0.45, armR: 0.45, legL: 0.42, legR: 0.42, torso: 0.36 };
// what somebody punched in the street says (ROADMAP 5.4)
const STRUCK_LINES = ['Ow!', 'Hey!!', 'What was that for?!', 'Help!', 'Are you crazy?!', 'Ouch!'];
// (ROADMAP 5.5) thrown and fallen: how long they lie before getting up, and the getting up
const LIE = 0.9;
const RISE = 0.85;
// the umbrellas of the city (sRGB): red, navy, yellow, black, green, plum, pink
const UMBRELLAS = [[0.82, 0.22, 0.24], [0.2, 0.3, 0.6], [0.95, 0.75, 0.2], [0.15, 0.15, 0.18], [0.3, 0.6, 0.45], [0.55, 0.3, 0.6], [0.92, 0.45, 0.6]];
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
    // (quicker in the rain: game/weather.js, Civilians.rainCheck)
    this.rush = 1;
    this.panicT = 0;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.stopT = 0;
    this.dodgeV = new THREE.Vector3();
    // time not yet walked (far away they step every other frame)
    this.owed = 0;
    // a fist fight (ROADMAP 5.4, game/fists.js): how dazed, reeling from a blow, on the ground (out
    // cold: ko), getting up
    this.daze = 0;
    this.reelT = 0;
    this.downT = 0;
    this.upT = 0;
    this.ko = false;
    // thrown by a car or a blast (ROADMAP 5.5, game/ragdoll.js): lying still this long; killed by
    // it (fades later)
    this.lieT = 0;
    this.ragKill = false;
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
        // (thrown and dead: the flight first, ROADMAP 5.5)
        fig.dissolve = this.ragKill ? clamp((this.dying - 3.5) / 1.2, 0, 1) : clamp((this.dying - 1.2) / 0.9, 0, 1);
      }
      fig.update(dt);
      return;
    }
    // (thrown by a car or a blast: the body falls as it will, lies a moment, gets up and runs;
    // ROADMAP 5.5)
    if (fig.rag) {
      fig.update(dt);
      if (fig.rag.done) {
        this.lieT += dt;
        if (this.lieT > LIE) this.game.ragdolls.release(this, RISE);
      } else this.lieT = 0;
      return;
    }
    // (knocked down in a fist fight - or out cold, seeing stars - then up and away: ROADMAP 5.4)
    if ((this.downT > 0 || this.upT > 0) && this.updateDown(dt)) return;
    let tx;
    let tz;
    let speed = this.speed * this.rush;
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
    // (rocked by a punch: a stagger before the run, ROADMAP 5.4)
    if (this.reelT > 0) {
      this.reelT -= dt;
      speed *= 0.2;
    }
    fig.crawl = damp(fig.crawl, legless ? 1 : 0, 6, dt);
    if (!this.headless) fig.stagger = this.reelT > 0 ? 0.8 : limping ? 0.6 : 0;
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
    // (the friend riding with you is in the car on purpose: ROADMAP 4.5)
    if (!this.riding) game.vehicles.pushOut(this.pos, 0.33);
    const gy = groundHeight(this.pos.x, this.pos.z) + (this.baseY || 0);
    // (riding: the seat holds her, over a ramp too)
    if (!this.riding) this.pos.y = this.hopY > 0 ? gy + this.hopY : damp(this.pos.y, gy, 20, dt);
    fig.air = this.hopY > 0.04;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.2) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    else if (this.faceYaw !== null && this.ctrl) this.yaw = dampAngle(this.yaw, this.faceYaw, 6, dt);
    fig.yaw = this.yaw;
    fig.speed = sp;
    fig.update(dt);
  }

  // on the ground after a punch or a kick (game/fists.js), and back up; then off, away from you
  updateDown(dt) {
    const fig = this.fig;
    if (!downStep(this, dt)) {
      this.ko = false;
      this.daze = 0;
      const p = this.game.player.pos;
      this.panicT = this.brave ? 0 : 8;
      this.fearX = p.x;
      this.fearZ = p.z;
      return false;
    }
    // the blow slides the body along the ground
    const v = this.dodgeV;
    this.pos.x += v.x * dt;
    this.pos.z += v.z * dt;
    v.multiplyScalar(Math.exp(-5 * dt));
    this.game.world.collision.resolveCylinder(this.pos, 0.33, 1.7, 0.5);
    this.pos.y = damp(this.pos.y, groundHeight(this.pos.x, this.pos.z), 20, dt);
    this.vel.set(0, 0, 0);
    fig.yaw = this.yaw;
    fig.armsUp = 0;
    fig.flail = 0;
    fig.stagger = 0;
    fig.update(dt);
    return true;
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
      // a busy city: more people on the sidewalks around you (fewer late at night: game/rhythm.js)
      const R = game.rhythm;
      const max = Math.round((game.touch ? 16 : 32) * (R ? R.people : 1));
      // despawn far ones (scripted people belong to their scene, unless it let them go)
      for (const c of this.list) if ((!c.scripted || !c.owner) && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 110) c.gone = true;
      this.list = this.list.filter((c) => {
        if (c.gone) c.dispose();
        return !c.gone;
      });
      let free = 0;
      for (const c of this.list) if (!c.scripted) free++;
      if (free > max + 1) {
        // (fewer people are out at this hour than there were: some of those out of sight go home)
        const cp = game.camera.position;
        const fw = game.camera.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
        for (const c of this.list) {
          if (free <= max) break;
          if (c.scripted || c.ctrl || c.buddy || c.buddyOf || c.dog || !c.alive) continue;
          const dx = c.pos.x - cp.x;
          const dz = c.pos.z - cp.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d < 30 || (dx * fw.x + dz * fw.z) / d > 0) continue;
          c.gone = true;
          free--;
        }
        this.list = this.list.filter((c) => {
          if (c.gone) c.dispose();
          return !c.gone;
        });
      }
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
        // (a jogger is dressed for it; in the morning many are out running, and the others are
        // dressed for work; late at night for going out)
        const jog = Math.random() < (R ? R.jog : 0.07);
        let look = jog ? civilianLook({ kind: 'sporty' }) : null;
        const dress = R ? Math.max(R.commute, R.night) * 0.6 : 0;
        if (!look && dress > 0 && Math.random() < dress) {
          const kinds = R.commute > R.night ? WORK_CLOTHES : NIGHT_CLOTHES;
          look = civilianLook({ kind: kinds[Math.floor(Math.random() * kinds.length)] });
        }
        if (p.x > -40 && (Math.random() < 0.3 || !near.length) && prom < max * 0.35) {
          const z = Math.max(NORTH_EDGE + 10, Math.min(SOUTH_EDGE, p.z + (Math.random() - 0.5) * 160));
          if (z > PIER.z0 - 4 && z < PIER.z1 + 4) continue;
          // (who walks here: game/crowds.js; ?classic: anybody, as before)
          if (!look && !game.classic) look = game.crowds.lookFor('prom');
          c = new Civilian(this, 'prom', z, look);
        } else if (near.length) {
          const [col, row] = near[Math.floor(Math.random() * near.length)];
          if (!look && !game.classic) look = game.crowds.lookFor(col < 0 ? 'west' : BLOCK_TYPES[row][col]);
          c = new Civilian(this, col, row, look);
        } else continue;
        if (jog) {
          c.jog = true;
          c.speed = 3.1 + Math.random() * 0.8;
        }
        // (on the way to work: in a hurry)
        else if (R && R.commute > 0) c.speed *= 1 + 0.3 * R.commute;
        // most of them close by (the street you are on is full of people; with the far crowd,
        // game/farcrowd.js, everybody whole is close by and the rest are its)
        const far = Math.random() < 0.3;
        const lo = first ? 3 : game.classic ? (far ? 45 : 16) : 16;
        const hi = game.classic ? (far ? 100 : 60) : 42;
        if (!c.placeNear(p, lo, hi)) {
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
          if (!game.classic && c.fig.look.role) {
            game.crowds.dress(c);
            if (c.buddy) free++;
          } else if (!c.dog && !c.jog && Math.random() < 0.14 && free < max) {
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
      } else if (c.still && c.dying < 0 && !(c.panicT > 0)) {
        // somebody sitting or waiting (game/routines.js): beyond a few metres their small moves
        // are drawn in steps of three frames
        const dx = c.pos.x - cam.x;
        const dz = c.pos.z - cam.z;
        if (dx * dx + dz * dz > 18 * 18 && (this.frameN + i) % 3) {
          c.owed = step;
          continue;
        }
      }
      c.owed = 0;
      c.update(step);
      if (c.dog) this.walkDog(c, step);
    }
    // the rain: umbrellas open, people hurry, some wait under an awning for it to stop
    this.rainT = (this.rainT || 0) - dt;
    if (this.rainT <= 0) {
      this.rainT = 0.5;
      this.rainCheck();
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

  // somebody let go where they stand (a bench, a shop's door, the bus): on along the side of the
  // block they are on, not across it to wherever their walk last pointed
  rejoin(c) {
    if (!c || c.prom) return;
    const L = c.loop;
    const n = L.length;
    let leg = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const a = L[i];
      const b = L[(i + 1) % n];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((c.pos.x - a[0]) * dx + (c.pos.z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(a[0] + dx * t - c.pos.x, a[1] + dz * t - c.pos.z);
      if (d < bd) {
        bd = d;
        leg = i;
      }
    }
    c.target = c.dir > 0 ? (leg + 1) % n : leg;
    c.crossing = false;
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

  // a walker nobody has a use for (the far crowd may take them over: game/farcrowd.js)
  plain(c) {
    if (c.scripted || c.ctrl || c.owner || !c.alive || c.headless || c.panicT > 0 || c.inside || c.dog || c.buddy || c.buddyOf || c.crossing || c.photo || c.exitRoom) return false;
    const P = c.fig.parts;
    return P.legL > 0.5 && P.legR > 0.5 && P.armL > 0.5 && P.armR > 0.5 && P.torso > 0.5;
  }

  // one of the far crowd coming near (game/farcrowd.js): a whole person, the same look, step and
  // way, if the street near you has room for one more
  fromFar(w) {
    const R = this.game.rhythm;
    const max = Math.round((this.game.touch ? 16 : 32) * (R ? R.people : 1));
    let free = 0;
    for (const c of this.list) if (!c.scripted) free++;
    if (free >= max) return null;
    const c = new Civilian(this, w.prom ? 'prom' : w.col, w.prom ? w.z : w.row, w.look);
    c.loop = w.loop;
    const n = w.loop.length;
    c.dir = w.dir;
    c.target = n === 2 ? (w.dir > 0 ? 1 : 0) : w.dir > 0 ? (w.leg + 1) % n : w.leg;
    c.pos.set(w.x, w.y, w.z);
    c.yaw = w.yaw;
    c.fig.yaw = w.yaw;
    c.fig.phase = w.phase;
    c.speed = w.speed;
    if (this.game.crowds && w.look.role) this.game.crowds.dress(c);
    this.list.push(c);
    return c;
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

  // (ROADMAP 5.4, not with ?classic: game/fists.js) a punch or a kick: no ink rubbed out - they
  // reel back, a kick (or enough of it) puts them down, more leaves them out cold a while; up
  // again, they run. Somebody busy (at work, at a table) only reels. Returns 'hit', 'down' or 'ko'
  struck(c, s, dir, power = 1) {
    if (!c.alive) return null;
    const game = this.game;
    const fig = c.fig;
    game.hud.hitMarker();
    fig.recoil = 1;
    fig.recoilSide = s.limb === 'L' ? 1 : s.limb === 'R' ? -1 : 0;
    c.daze += s.dmg * power;
    c.reelT = 0.7;
    this.panic(c.pos, 30);
    c.panicT = c.brave ? 0 : 8;
    c.fearX = game.player.pos.x;
    c.fearZ = game.player.pos.z;
    if (game.onCivilianHurt) game.onCivilianHurt(c);
    if (Math.random() < 0.45 && game.bubbles) game.bubbles.say(c, STRUCK_LINES[Math.floor(Math.random() * STRUCK_LINES.length)], 'alarm');
    const free = !c.scripted && !c.ctrl && !c.riding && !c.noCollide && fig.sit < 0.3;
    // shoved back a step (knocked down or out: slid along the ground, Civilian.updateDown)
    const k = s.push * (free ? 1 : 0.4);
    c.vel.x += dir.x * k;
    c.vel.z += dir.z * k;
    if (!free) return 'hit';
    if (c.downT <= 0 && c.upT <= 0) c.yaw = Math.atan2(-dir.x, -dir.z);
    const slide = () => c.dodgeV.set(dir.x * s.push * 0.7, 0, dir.z * s.push * 0.7);
    if (c.daze >= 60 && !c.ko) {
      c.ko = true;
      c.downT = CIV_KO;
      c.upT = 0;
      slide();
      if (!c.criminal) game.onCrime('koCiv', c.pos.x, c.pos.z);
      return 'ko';
    }
    if (s.down || c.daze >= 40) {
      c.downT = Math.max(c.downT, 1.6 + Math.random() * 0.6);
      c.upT = 0;
      slide();
      return 'down';
    }
    return 'hit';
  }

  explosion(x, y, z, radius) {
    const at = new THREE.Vector3();
    const R = this.game.ragdolls;
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
      // (not with ?classic: thrown by it, ROADMAP 5.5)
      if (R && f > 0.3 && this.throwable(c)) {
        R.blast(c, x, z, f);
        if (!c.alive) c.ragKill = true;
      }
    }
  }

  // (ROADMAP 5.5) who can be thrown about: not one riding along, inside, held in a scene
  throwable(c) {
    return !c.riding && !c.inside && !c.noCollide && !(c.brave && !c.criminal) && c.fig.sit < 0.3;
  }

  // (ROADMAP 5.5, not with ?classic: game/ragdoll.js) the hero's car at speed, and somebody right at
  // its bumper with no time to jump clear: thrown over the bonnet. Fast, for good; slower, hurt,
  // and up and running after
  runOver(v) {
    const game = this.game;
    const sp = Math.abs(v.speed);
    const sg = Math.sign(v.speed) || 1;
    const fx = Math.sin(v.yaw) * sg;
    const fz = Math.cos(v.yaw) * sg;
    for (const c of this.list) {
      if (!c.alive || c.fig.rag || !this.throwable(c)) continue;
      const dx = c.pos.x - v.pos.x;
      const dz = c.pos.z - v.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along < 0 || along > v.halfLen + 0.35 || side > v.halfWid + 0.3) continue;
      game.ragdolls.carHit(c, v, v.speed);
      game.fx.sprite('fx_crash', c.pos.x, c.pos.y + 1, c.pos.z, { size: 1.4, life: 0.3 });
      game.audio.play('crash', 0.5);
      if (v.kind === 'car' || v.kind === 'bike') v.hurt(3);
      this.panic(c.pos, 30);
      c.panicT = 8;
      c.fearX = v.pos.x;
      c.fearZ = v.pos.z;
      if (sp > 15) {
        c.ragKill = true;
        this.kill(c);
      } else if (game.onCivilianHurt) game.onCivilianHurt(c);
    }
  }

  kill(c, how) {
    if (!c.alive) return;
    c.dying = 0;
    // (out of a getting-up or a lying-down of a fist fight: ROADMAP 5.4)
    c.downT = 0;
    c.upT = 0;
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
    // (the cats and the birds round there are off too; the drivers react: ROADMAP 4.4)
    if (!this.game.classic && this.game.animals) this.game.animals.scare(pos, radius);
    if (!this.game.classic && this.game.traffic) this.game.traffic.scare(pos, radius);
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
      // (not the one riding in it)
      if (c.riding) continue;
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
        // ("Slow down!": game/voices.js)
        if (!this.game.classic) this.game.voices.dodged(c);
      }
    }
  }

  draw(camPos) {
    const bodies = this.game.figures.bodies;
    const fwd = this.game.camera.getWorldDirection(this._cf || (this._cf = new THREE.Vector3()));
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
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
      // (out cold: ROADMAP 5.4)
      if (c.ko && c.downT > 0) drawStars(this.game, c.fig.j.headC, this.game.time, Math.min(1, c.downT * 2, (CIV_KO - c.downT) * 2), i);
    }
  }

  // ------------------------------------------------------------------ in the rain
  // Once it rains, everyone out walking decides once what to do about it: open an umbrella (if a
  // hand is free), hurry, or wait under a shop's awning nearby; a few just walk on. When it
  // stops, the umbrellas close one by one and the waiting come out again.
  rainCheck() {
    const game = this.game;
    const rain = game.weather ? game.weather.cur.rain : 0;
    const raining = this.raining ? rain > 0.12 : rain > 0.22;
    if (!raining && !this.raining) return;
    this.raining = raining;
    for (const c of this.list) {
      if (c.scripted || !c.alive || c.headless || c.inside) continue;
      if (!raining) {
        if (c.rainMood === 'umbrella' && c.fig.carry === 'umbrella' && Math.random() < 0.25) {
          c.fig.carry = null;
          c.rainMood = null;
        } else if (c.rainMood && c.rainMood !== 'umbrella') {
          c.rush = 1;
          c.rainMood = null;
        }
        continue;
      }
      if (c.rainMood || c.ctrl || c.panicT > 0) continue;
      const r = Math.random();
      if (c.jog) c.rainMood = 'brave';
      else if (!c.fig.carry && r < 0.55) {
        c.rainMood = 'umbrella';
        c.fig.carry = 'umbrella';
        c.fig.umbrellaColor = UMBRELLAS[Math.floor(Math.random() * UMBRELLAS.length)];
      } else if (r < 0.75 && !c.dog && !c.buddy && !c.buddyOf && this.shelter(c)) c.rainMood = 'shelter';
      else if (r < 0.93) {
        c.rainMood = 'hurry';
        c.rush = 1.45 + Math.random() * 0.3;
      } else c.rainMood = 'brave';
    }
  }

  // somewhere dry to wait: under the awning of a shop front on this side of the street
  shelter(c) {
    const shops = this.game.world.shops || [];
    let best = null;
    let bd = 26;
    for (const s of shops) {
      if (!s.room || s.stand) continue;
      const dx = c.pos.x - s.door[0];
      const dz = c.pos.z - s.door[2];
      // (in front of that shop front, not behind its building)
      if (dx * s.nx + dz * s.nz < -0.2) continue;
      if (Math.abs(dx) > bd || Math.abs(dz) > bd) continue;
      if (!s.shelter) {
        // four places to stand, either side of the door, under the canvas
        s.shelter = [-2.4, -1.5, 1.5, 2.4].map((u) => ({ x: s.door[0] + s.rx * u - s.nx * 0.45, z: s.door[2] + s.rz * u - s.nz * 0.45, yaw: s.face, by: null }));
      }
      for (const sp of s.shelter) {
        if (sp.by && !sp.by.gone && sp.by.alive && sp.by.shelterAt === sp) continue;
        const d = Math.hypot(sp.x - c.pos.x, sp.z - c.pos.z);
        if (d < bd) {
          bd = d;
          best = sp;
        }
      }
    }
    if (!best) return false;
    const sp = best;
    sp.by = c;
    c.shelterAt = sp;
    c.ctrl = (me) => {
      const rain = this.game.weather ? this.game.weather.cur.rain : 0;
      if (rain < 0.12) {
        // dry again: back to the walk
        me.ctrl = null;
        me.faceYaw = null;
        me.shelterAt = null;
        sp.by = null;
        return null;
      }
      if (Math.hypot(sp.x - me.pos.x, sp.z - me.pos.z) < 0.3) {
        // under the awning, looking out at the rain
        me.faceYaw = sp.yaw;
        return null;
      }
      return { x: sp.x, z: sp.z, speed: me.speed * 1.6 };
    };
    return true;
  }

  // ------------------------------------------------------------------ the life of the sidewalk
  // A new face on the street is somebody: out walking the dog, jogging, on the phone, back from
  // the shops with a bag, with a coffee, or two friends walking and talking.
  dressUp(c) {
    const r = Math.random();
    // (on the way to work, a coffee or a bag in hand)
    const m = this.game.rhythm ? this.game.rhythm.commute : 0;
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
    } else if (r < 0.33 + 0.17 * m) {
      c.fig.carry = 'coffee';
    } else if (r < 0.42 + 0.25 * m) {
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
        if (Math.hypot(who.pos.x - p.x, who.pos.z - p.z) < 18) {
          // (and the other one answers: game/voices.js)
          if (!this.game.classic) {
            if (this.game.voices.chat([who, who === me ? L : me])) talkT += 6;
          } else this.game.bubbles.say(who, lines[Math.floor(Math.random() * lines.length)]);
        }
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
