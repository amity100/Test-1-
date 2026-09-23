import * as THREE from 'three';
import { FEEL } from '../config';
import { LAW } from '../core/contracts';
import type { BodyKind, DynBody, ImpactInfo, PhysicsAPI, PhysicsEvents, RiftEnd, RiftQuery, Team, V3 } from '../core/contracts';
import type { Collider, CollisionWorld } from '../world/collision';
import { frameUp, passRotation } from '../game/portalMath';

export interface PhysicsOptions {
  seaY: number;
  isSea: (p: V3) => boolean;
  /** Below this a body is lost (fellOut). Gets the body too (its peakY says which floor it fell from). */
  killYAt: (p: V3, b?: DynBody) => number;
}

const DEFAULT_BOUNCE: Record<BodyKind, number> = { player: 0, enemy: 0, corpse: 0, prop: 0.15, grenade: LAW.grenade.bounce };
const DEFAULT_FRICTION: Record<BodyKind, number> = { player: 0, enemy: 0.9, corpse: 0.9, prop: 0.6, grenade: 0.35 };
const DEFAULT_TEAM: Record<BodyKind, Team> = { player: 'player', enemy: 'kessler', corpse: 'neutral', prop: 'neutral', grenade: 'neutral' };

/** Speed into a surface below this makes no impact event. */
const IMPACT_MIN = 1.5;
/** A body that crossed keeps at least this much charge while it flies (or slides, for props). */
const CHARGE_FLOOR = 0.25;
const LOOP_WINDOW = 1.5;
const TOUCH_SPEED = 3;
const TOUCH_REPEAT = 0.3;

let nextBodyId = 1;

/** A DynBody plus the bookkeeping the solver needs. */
export class Body implements DynBody {
  readonly id = nextBodyId++;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  radius = 0.3;
  height = 1.8;
  onGround = false;
  groundCollider: Collider | null = null;
  charge = 0;
  crossings = 0;
  loops = 0;
  peakY = 0;
  lastEnd: RiftEnd | null = null;
  lastCrossT = -1e9;
  bounce = 0;
  friction = 0;
  enabled = true;
  simulate = true;
  quat = new THREE.Quaternion();
  spin = new THREE.Vector3();
  team: Team = 'neutral';
  userData: Record<string, unknown> = {};
  /** The end it went INTO on its last crossing (lastEnd is the one it came out of). */
  lastFrom: RiftEnd | null = null;
  /** Crossed and hasn't landed (player) / come to rest (others) since. */
  live = false;
  restT = 0;
  landedSinceCross = true;
  wallContact = false;
  wet = false;
  gone = false;

  constructor(public kind: BodyKind) {}
}

const _prevC = new THREE.Vector3();
const _curC = new THREE.Vector3();
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _n = new THREE.Vector3();
const _before = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

function samePair(a: RiftEnd, b: RiftEnd) {
  return a === b || a.linked === b || b.linked === a || a.linked === b.linked;
}

/**
 * Bodies as vertical cylinders (pos = feet): gravity, world collision with
 * step-up, bounce/friction, rift crossings that keep momentum, charge,
 * impacts, sea / void and body-body touches. Substeps keep every move under
 * 0.25 m, so nothing tunnels, and the hot loop allocates nothing.
 */
export class Physics implements PhysicsAPI {
  readonly bodies: DynBody[] = [];
  killYAt: (p: V3, b?: DynBody) => number;
  private touchT = new Map<number, number>();
  private work: DynBody[] = [];
  // resolveCircle skip callback, bound once (the body being solved is stashed here)
  private skipPos = new THREE.Vector3();
  private skipR = 0;
  private readonly skip = (c: Collider) => this.rifts.hostPassable(c, this.skipPos, this.skipR);

  constructor(private world: CollisionWorld, private rifts: RiftQuery, private opts: PhysicsOptions) {
    this.killYAt = opts.killYAt;
  }

  createBody(kind: BodyKind, o: { pos: V3; radius: number; height: number; bounce?: number; friction?: number; team?: Team; simulate?: boolean }): DynBody {
    const b = new Body(kind);
    b.pos.copy(o.pos);
    b.radius = o.radius;
    b.height = o.height;
    b.bounce = o.bounce ?? DEFAULT_BOUNCE[kind];
    b.friction = o.friction ?? DEFAULT_FRICTION[kind];
    b.team = o.team ?? DEFAULT_TEAM[kind];
    b.simulate = o.simulate ?? true;
    b.peakY = b.pos.y;
    this.bodies.push(b);
    return b;
  }

  removeBody(b: DynBody) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    b.enabled = false;
    for (const k of this.touchT.keys()) {
      const lo = k % 1048576, hi = Math.floor(k / 1048576);
      if (lo === b.id || hi === b.id) this.touchT.delete(k);
    }
  }

  step(dt: number, ev: PhysicsEvents, time: number) {
    // a stable copy: event handlers may add / remove bodies
    const list = this.work;
    list.length = 0;
    for (let i = 0; i < this.bodies.length; i++) list.push(this.bodies[i]);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.enabled || b.userData.manual === true) continue;
      this.stepBody(b, dt, ev, time);
    }
    this.touches(dt, ev, time);
  }

  stepBody(b: DynBody, dt: number, ev: PhysicsEvents, time: number) {
    if (!b.enabled || !(dt > 0)) return;
    const body = b as Body;
    const maxS = LAW.maxSpeed;
    const s2 = b.vel.lengthSq();
    if (s2 > maxS * maxS) b.vel.multiplyScalar(maxS / Math.sqrt(s2));
    const travel = b.vel.length() * dt + (b.simulate ? 0.5 * LAW.gravity * dt * dt : 0);
    const maxStep = Math.min(0.25, Math.max(0.1, b.radius * 1.2));
    const n = Math.min(64, Math.max(1, Math.ceil(travel / maxStep)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.substep(body, h, ev, time - dt + (i + 1) * h);

    // charge
    const speed = b.vel.length();
    let floor = 0;
    if (body.live) {
      if (!b.onGround) floor = CHARGE_FLOOR;
      else if (!b.simulate) body.live = false; // a walking body just plainly decays
      else if (b.kind === 'player') {
        // rift slide: charged while it still skids at knock speed
        if (Math.hypot(b.vel.x, b.vel.z) >= LAW.knockSpeed) floor = CHARGE_FLOOR;
        else {
          body.live = false;
          b.charge = 0;
        }
      } else {
        if (speed < 1) {
          body.restT += dt;
          if (body.restT >= 0.3) {
            body.live = false;
            b.charge = 0;
          }
        } else {
          body.restT = 0;
          floor = CHARGE_FLOOR;
        }
      }
    }
    b.charge = Math.max(0, b.charge - dt);
    if (body.live) b.charge = Math.max(b.charge, floor);

    // spin (props, grenades, tumbling bodies)
    const w = b.spin.length();
    if (w > 1e-4) {
      _d.copy(b.spin).divideScalar(w);
      _q.setFromAxisAngle(_d, w * dt);
      b.quat.premultiply(_q).normalize();
      if (b.onGround) b.spin.multiplyScalar(Math.exp(-(2 + 8 * b.friction) * dt));
    }

    // sea / void
    const o = this.opts;
    if (b.pos.y < o.seaY && o.isSea(b.pos)) {
      if (!body.wet) {
        body.wet = true;
        ev.splash(b);
      }
    } else if (b.pos.y >= o.seaY) body.wet = false;
    if (b.pos.y < this.killYAt(b.pos, b)) {
      if (!body.gone) {
        body.gone = true;
        ev.fellOut(b);
      }
    } else body.gone = false;
  }

  private substep(b: Body, h: number, ev: PhysicsEvents, time: number) {
    if (b.simulate) b.vel.y -= LAW.gravity * h;
    const maxS = LAW.maxSpeed;
    const s2 = b.vel.lengthSq();
    if (s2 > maxS * maxS) b.vel.multiplyScalar(maxS / Math.sqrt(s2));

    const half = b.height * 0.5;
    _prevC.set(b.pos.x, b.pos.y + half, b.pos.z);
    let prevFeet = b.pos.y;
    b.pos.addScaledVector(b.vel, h);

    // rift crossing: the body's centre going through an open end's front
    _curC.set(b.pos.x, b.pos.y + half, b.pos.z);
    const end = this.rifts.findCrossing(_prevC, _curC, b.radius * 0.5);
    if (end) {
      this.cross(b, end, ev, time);
      prevFeet = b.pos.y;
    }
    this.collide(b, prevFeet, h, ev);
    if (b.pos.y > b.peakY) b.peakY = b.pos.y;
  }

  private cross(b: Body, from: RiftEnd, ev: PhysicsEvents, time: number) {
    const to = from.linked;
    const rifts = this.rifts;
    rifts.transformPoint(from, _curC, _p);
    rifts.transformDir(from, b.vel, _d);
    b.vel.copy(_d);
    rifts.transformDir(from, b.spin, _d);
    b.spin.copy(_d);
    b.quat.premultiply(passRotation(from, to, _q)).normalize();
    b.pos.set(_p.x, _p.y - b.height * 0.5, _p.z).addScaledVector(to.normal, 0.05);
    // something taller than the door out of a floor-level door: feet on the floor, not under it
    if (Math.abs(to.normal.y) < 0.5) {
      const g = this.world.groundAt(b.pos.x, b.pos.z, b.radius * 0.65, _p.y);
      if (g > b.pos.y) b.pos.y = g + 0.005;
    }

    // slow things out of an up-facing end pop clear and land beside the hole
    if (to.normal.y > 0.5) {
      const vn = b.vel.dot(to.normal);
      if (vn < FEEL.floorPopSpeed) {
        b.vel.addScaledVector(to.normal, FEEL.floorPopSpeed - vn);
        frameUp(to, _up);
        _up.y = 0;
        if (_up.lengthSq() < 1e-6) _up.set(1, 0, 0);
        _up.normalize();
        const along = b.vel.x * _up.x + b.vel.z * _up.z;
        if (along < FEEL.floorPopNudge) b.vel.addScaledVector(_up, FEEL.floorPopNudge - along);
      }
    }

    // a vertical loop (up-facing end under a down-facing one): steer it over the end it
    // falls back into (staying inside this one) so the loop holds
    if (from.normal.y > 0.9 && to.normal.y < -0.9 && Math.hypot(to.position.x - from.position.x, to.position.z - from.position.z) < FEEL.loopSnap) {
      const tx = to.position.x + THREE.MathUtils.clamp(from.position.x - to.position.x, -0.6, 0.6);
      const tz = to.position.z + THREE.MathUtils.clamp(from.position.z - to.position.z, -0.6, 0.6);
      b.pos.x += (tx - b.pos.x) * 0.6;
      b.pos.z += (tz - b.pos.z) * 0.6;
      b.vel.x *= 0.5;
      b.vel.z *= 0.5;
    }

    b.charge = LAW.chargeTime;
    b.live = true;
    b.restT = 0;
    b.crossings++;
    const looping = b.lastEnd !== null && !b.landedSinceCross && time - b.lastCrossT < LOOP_WINDOW && samePair(from, b.lastEnd);
    b.loops = looping ? b.loops + 1 : 1;
    b.peakY = b.pos.y;
    b.lastEnd = to;
    b.lastFrom = from;
    b.lastCrossT = time;
    b.landedSinceCross = false;
    b.onGround = false;
    b.groundCollider = null;
    b.wallContact = false;
    rifts.notePass(from, b.kind);
    ev.crossed(b, from, to, b.vel.length());
  }

  private collide(b: Body, prevFeet: number, h: number, ev: PhysicsEvents) {
    const w = this.world;
    const r = b.radius;
    const stepUp = b.kind === 'player' || !b.simulate ? FEEL.stepUp : 0.05;

    // ceiling (skipped where an open down-facing end is cut into it)
    const ceil = w.ceilingAt(b.pos.x, b.pos.z, r * 0.7, Math.min(prevFeet, b.pos.y) + b.height * 0.5);
    if (b.pos.y + b.height > ceil && b.vel.y > 0) {
      const cc = w.lastCeiling;
      this.skipPos.copy(b.pos);
      if (!(cc && this.rifts.hostPassable(cc, this.skipPos, r))) {
        const into = b.vel.y;
        b.pos.y = ceil - b.height;
        if (into >= IMPACT_MIN) {
          _p.set(b.pos.x, ceil, b.pos.z);
          this.impact(b, ev, into, DOWN, 'ceiling', cc, _p);
        }
        b.vel.y = -into * b.bounce;
      }
    }

    // ground (absent over an open floor end: things fall in)
    const wasGround = b.onGround;
    let g = w.groundAt(b.pos.x, b.pos.z, r * 0.65, Math.max(prevFeet, b.pos.y) + stepUp);
    let gc = w.lastGround;
    if (g > -Infinity && this.rifts.holeAt(b.pos.x, b.pos.z, g)) {
      g = -Infinity;
      gc = null;
    }
    if (g > -Infinity && b.pos.y <= g + 1e-3 && b.vel.y <= 0) {
      const into = -b.vel.y;
      b.pos.y = g;
      if (!wasGround) {
        if (into >= IMPACT_MIN) {
          _p.set(b.pos.x, g, b.pos.z);
          this.impact(b, ev, into, UP, 'ground', gc, _p);
        }
        // landed: loops / crossings end (after the event, which reads them)
        b.landedSinceCross = true;
        b.crossings = 0;
        b.loops = 0;
        if (b.kind === 'player' && !(b.charge > 0 && Math.hypot(b.vel.x, b.vel.z) >= LAW.knockSpeed)) {
          // (a charged landing this fast turns into a rift slide: the charge rides the skid)
          b.charge = 0;
          b.live = false;
        }
      }
      if (b.simulate && b.bounce > 0 && into > 2) {
        b.vel.y = into * b.bounce;
        const k = 1 - 0.3 * b.friction;
        b.vel.x *= k;
        b.vel.z *= k;
        b.onGround = false;
        b.groundCollider = null;
      } else {
        b.vel.y = 0;
        b.onGround = true;
        b.groundCollider = gc;
      }
    } else if (wasGround && stepUp > 0.1 && g > -Infinity && b.pos.y - g < 0.38 && b.vel.y <= 0) {
      // stick to the ground walking down steps
      b.pos.y = g;
      b.vel.y = 0;
      b.onGround = true;
      b.groundCollider = gc;
    } else {
      b.onGround = false;
      b.groundCollider = null;
    }
    // walls (after the ground: a floor passed through this substep is landed on, not pushed out of)
    this.skipPos.copy(b.pos);
    this.skipR = r;
    _before.copy(b.pos);
    if (w.resolveCircle(b.pos, r, b.pos.y, b.pos.y + b.height, stepUp, this.skip)) {
      _n.set(b.pos.x - _before.x, 0, b.pos.z - _before.z);
      const len = _n.length();
      if (len > 1e-7) {
        _n.divideScalar(len);
        const vn = b.vel.x * _n.x + b.vel.z * _n.z;
        if (vn < 0) {
          if (!b.wallContact && -vn >= IMPACT_MIN) {
            _p.set(b.pos.x - _n.x * r, b.pos.y + b.height * 0.5, b.pos.z - _n.z * r);
            this.impact(b, ev, -vn, _n, 'wall', w.lastPush, _p);
          }
          const k = -vn * (1 + b.bounce);
          b.vel.x += _n.x * k;
          b.vel.z += _n.z * k;
        }
        b.wallContact = true;
      }
    } else b.wallContact = false;

    if (b.onGround) {
      b.peakY = b.pos.y;
      if (b.simulate && b.kind !== 'player') {
        const f = b.friction >= 1 ? 0 : Math.pow(1 - b.friction, h * 10);
        b.vel.x *= f;
        b.vel.z *= f;
      }
    }
  }

  private impact(b: Body, ev: PhysicsEvents, speed: number, normal: V3, surface: ImpactInfo['surface'], collider: Collider | null, point: V3) {
    // a fresh object: listeners may keep it (events are rare, not per frame)
    ev.impact(b, { speed, normal: normal.clone(), surface, collider, charged: b.charge > 0, point: point.clone() });
  }

  /** Body-body touches (events) and gentle separation of overlapping simulated bodies. */
  private touches(dt: number, ev: PhysicsEvents, time: number) {
    const list = this.work;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (!a.enabled) continue;
      for (let j = i + 1; j < n; j++) {
        if (!a.enabled) break;
        const b = list[j];
        if (!b.enabled) continue;
        if (a.pos.y >= b.pos.y + b.height || b.pos.y >= a.pos.y + a.height) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);

        if (a.vel.lengthSq() >= TOUCH_SPEED * TOUCH_SPEED || b.vel.lengthSq() >= TOUCH_SPEED * TOUCH_SPEED || a.charge > 0 || b.charge > 0) {
          const key = a.id < b.id ? a.id * 1048576 + b.id : b.id * 1048576 + a.id;
          const last = this.touchT.get(key);
          if (last === undefined || time - last >= TOUCH_REPEAT || time < last) {
            this.touchT.set(key, time);
            // relative speed along the centre-to-centre line
            const sy = b.pos.y + b.height * 0.5 - (a.pos.y + a.height * 0.5);
            const sl = Math.sqrt(d2 + sy * sy);
            let rel: number;
            if (sl > 1e-6) rel = Math.abs(((a.vel.x - b.vel.x) * dx + (a.vel.y - b.vel.y) * sy + (a.vel.z - b.vel.z) * dz) / sl);
            else rel = _d.subVectors(a.vel, b.vel).length();
            ev.touch(a, b, rel);
          }
        }

        if (a.kind === 'grenade' || b.kind === 'grenade') continue;
        const aw = a.simulate ? 1 : 0, bw = b.simulate ? 1 : 0;
        if (aw + bw === 0) continue;
        const pen = rr - d;
        const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
        const push = Math.min(pen * 0.5, 4 * dt + 0.01) / (aw + bw);
        a.pos.x -= nx * push * aw;
        a.pos.z -= nz * push * aw;
        b.pos.x += nx * push * bw;
        b.pos.z += nz * push * bw;
      }
    }
    if (this.touchT.size > 512) for (const [k, t] of this.touchT) if (time - t > 1) this.touchT.delete(k);
  }
}
