import * as THREE from 'three';
import { FEEL } from '../config';
import { CollisionWorld } from '../world/collision';
import { NavGrid } from '../world/nav';
import { GuardDef } from '../world/harbor';
import { Character } from './characters';
import { dampAngle } from './player';

export type GuardState = 'patrol' | 'suspicious' | 'investigate' | 'search' | 'alert' | 'dead';

export interface Stimulus {
  kind: 'player' | 'noise' | 'body' | 'rift' | 'radio' | 'alarm';
  pos: THREE.Vector3;
}

export interface PlayerPerception {
  chest: THREE.Vector3;
  feet: THREE.Vector3;
  light: number;
  crouched: boolean;
  speed: number;
  alive: boolean;
}

export interface GuardHooks {
  bark(g: Guard, key: 'heardSomething' | 'alarmBark' | 'searchBark' | 'lostBark' | 'bodyFound'): void;
  shoot(g: Guard, hit: boolean, target: THREE.Vector3): void;
  alarmRaised(g: Guard, at: THREE.Vector3): void;
  bodyDiscovered(body: Body, by: Guard): void;
  becameSuspicious(g: Guard): void;
  becameAlert(g: Guard): void;
}

const NAMES = ['Bravo-1', 'Bravo-2', 'Bravo-3', 'Bravo-4', 'Delta-1', 'Delta-2', 'Delta-3', 'Echo-1', 'Echo-2', 'Echo-3'];

export class Body {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  state: 'lying' | 'carried' | 'flying' = 'lying';
  discovered = false;
  constructor(public guard: Guard) {}
  get char() {
    return this.guard.char;
  }
}

export class Guard {
  pos = new THREE.Vector3();
  yaw = 0;
  state: GuardState = 'patrol';
  suspicion = 0;
  alertLevel = 0;
  char: Character;
  name: string;
  hasKeycard: boolean;
  routeIdx = 0;
  waitT = 0;
  path: THREE.Vector3[] = [];
  pathIdx = 0;
  target = new THREE.Vector3();
  lastKnown = new THREE.Vector3();
  lookT = 0;
  lookBase = 0;
  searchPoints = 0;
  stateT = 0;
  fireT = 0;
  seesPlayer = false;
  unseenT = 0;
  speed = 0;
  investigateBody: Body | null = null;
  fan: THREE.Mesh;
  deadT = 0;
  radioT = -1;
  radioCalled = false;
  stuckT = 0;
  lastPos = new THREE.Vector3();
  heardRiftT = 0;
  post: THREE.Vector3;

  constructor(public def: GuardDef, char: Character, index: number) {
    this.char = char;
    this.name = NAMES[index % NAMES.length];
    this.hasKeycard = def.kind === 'officer';
    this.pos.copy(def.route[0]);
    this.post = def.route[0].clone();
    this.yaw = def.facing ?? 0;
    this.lookBase = this.yaw;
    const fanGeo = new THREE.BufferGeometry();
    const segs = 20;
    fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((segs + 2) * 3), 3));
    fanGeo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(segs + 2), 1));
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) idx.push(0, i + 1, i + 2);
    fanGeo.setIndex(idx);
    this.fan = new THREE.Mesh(
      fanGeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 0 } },
        vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor * 1.5, vA * uOpacity); }`,
      }),
    );
    this.fan.frustumCulled = false;
    this.fan.renderOrder = 5;
    this.fan.userData.helper = true;
  }

  get alive() {
    return this.state !== 'dead';
  }

  get aware() {
    return this.state === 'alert' || (this.state === 'suspicious' && this.suspicion > 0.6);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  eye(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + 1.65 * (this.def.kind === 'heavy' ? 1.1 : 1), this.pos.z);
  }

  /** Vision range scaled by alertness. */
  viewDistance() {
    return (this.def.range ?? FEEL.guardViewDistance) * (1 + this.alertLevel * 0.2) * (this.state === 'alert' ? 1.3 : 1);
  }
}

const _v = new THREE.Vector3();
const _e = new THREE.Vector3();

export class GuardSystem {
  guards: Guard[] = [];
  bodies: Body[] = [];
  group = new THREE.Group();
  fansVisible = 0;
  /** Where the player is; vision cones are only built near them. */
  viewer = new THREE.Vector3();
  globalAlarm = 0;

  constructor(private world: CollisionWorld, private nav: NavGrid, private hooks: GuardHooks) {}

  add(g: Guard) {
    this.guards.push(g);
    this.group.add(g.char.root, g.fan);
    g.char.root.position.copy(g.pos);
    g.char.root.rotation.y = g.yaw;
  }

  /**
   * How visible a point is to one guard (0..1 "detection potential").
   * Used both for real detection and for the rift preview's exposure tint.
   */
  sightFactor(g: Guard, p: THREE.Vector3, light: number, crouched: boolean) {
    if (!g.alive) return 0;
    const eye = g.eye(_e);
    _v.subVectors(p, eye);
    const d = _v.length();
    // a searchlight sniper lights what he looks at
    if (g.def.kind === 'sniper') light = Math.max(light, 0.9);
    const range = g.viewDistance() * (0.28 + 0.72 * light) * (crouched ? 0.8 : 1);
    if (d > range && d > 2.2) return 0;
    const f = g.forward();
    const flat = Math.hypot(_v.x, _v.z) || 1;
    const cos = (f.x * _v.x + f.z * _v.z) / flat;
    const ang = Math.acos(THREE.MathUtils.clamp(cos, -1, 1));
    // vertical cone limit
    if (Math.abs(Math.atan2(_v.y, flat)) > (g.def.kind === 'sniper' ? 1.0 : 0.9)) return 0;
    let cone = 0;
    const fov = g.def.fov ?? FEEL.guardFovHalf;
    if (ang < fov) cone = 1;
    else if (ang < (g.def.fov ? fov * 1.3 : FEEL.guardPeripheralHalf)) cone = 0.3;
    else if (d < 1.4) cone = 0.25; // someone breathing down your neck
    if (cone === 0) return 0;
    if (!this.world.lineOfSight(eye, p)) return 0;
    const closeness = Math.pow(Math.max(0, 1 - d / Math.max(range, 0.01)), 0.6);
    return cone * (closeness + (d < 3 ? 0.9 * (1 - d / 3) : 0));
  }

  /** Max detection potential of all guards on a point. */
  exposureAt(p: THREE.Vector3, light: number) {
    let m = 0;
    for (const g of this.guards) m = Math.max(m, this.sightFactor(g, p, light, false));
    return Math.min(1, m);
  }

  private goTo(g: Guard, target: THREE.Vector3) {
    g.target.copy(target);
    const path = this.nav.findPath(g.pos, target);
    g.path = path ?? [target.clone()];
    g.pathIdx = 0;
  }

  private setState(g: Guard, s: GuardState) {
    if (g.state === s) return;
    g.state = s;
    g.stateT = 0;
  }

  /** Something made noise at `pos` audible within `radius`. */
  noise(pos: THREE.Vector3, radius: number, strength = 0.5) {
    for (const g of this.guards) {
      if (!g.alive || g.state === 'alert') continue;
      const d = g.pos.distanceTo(pos);
      if (d > radius) continue;
      g.suspicion = Math.min(1, g.suspicion + strength * (1 - d / radius) + 0.1);
      g.lastKnown.copy(pos);
      if (g.state === 'patrol' || g.state === 'search' || g.state === 'investigate') {
        if (g.suspicion > FEEL.suspicionThreshold) {
          if (g.state === 'patrol') this.hooks.bark(g, 'heardSomething');
          this.setState(g, 'suspicious');
          this.hooks.becameSuspicious(g);
        }
      }
    }
  }

  /** Raise the alarm: everyone searches `pos`. */
  alarm(pos: THREE.Vector3, source: Guard | null) {
    this.globalAlarm = Math.max(this.globalAlarm, 1);
    for (const g of this.guards) {
      if (!g.alive || g === source) continue;
      g.alertLevel = Math.max(g.alertLevel, 2);
      if (g.state !== 'alert') {
        g.lastKnown.copy(pos);
        this.startSearch(g);
      }
    }
  }

  private startSearch(g: Guard) {
    this.setState(g, 'search');
    g.searchPoints = 3;
    const p = g.lastKnown.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
    this.goTo(g, p);
  }

  kill(g: Guard) {
    g.state = 'dead';
    g.suspicion = 0;
    g.deadT = 0;
    g.fan.visible = false;
    g.char.die();
    const b = new Body(g);
    b.pos.copy(g.pos);
    b.yaw = g.yaw;
    this.bodies.push(b);
    g.radioT = FEEL.radioCheckDelay * (0.8 + Math.random() * 0.4);
    return b;
  }

  update(dt: number, player: PlayerPerception, openRifts: { position: THREE.Vector3; normal: THREE.Vector3 }[], t: number) {
    let tension = 0;
    let alertCount = 0;
    for (const g of this.guards) {
      if (!g.alive) {
        this.updateDead(g, dt);
        continue;
      }
      g.stateT += dt;
      // ---------- perception ----------
      const f = player.alive ? this.sightFactor(g, player.chest, player.light, player.crouched) : 0;
      g.seesPlayer = f > 0;
      if (f > 0) {
        const moving = player.speed > 4 ? 1.6 : player.speed > 0.5 ? 1.0 : 0.65;
        const rate = FEEL.detectBaseRate * f * moving * (1 + g.alertLevel * 0.35);
        g.suspicion = Math.min(1, g.suspicion + rate * dt);
        g.lastKnown.copy(player.feet);
        g.unseenT = 0;
      } else {
        g.unseenT += dt;
        if (g.state === 'patrol' || g.state === 'investigate') g.suspicion = Math.max(0, g.suspicion - FEEL.suspicionDecay * dt * (g.unseenT > 2 ? 1 : 0));
      }
      // bodies
      if (g.state !== 'alert') {
        for (const b of this.bodies) {
          if (b.discovered || b.state === 'carried') continue;
          const d = g.pos.distanceTo(b.pos);
          if (d > FEEL.bodySightDistance) continue;
          const p = b.pos.clone().setY(b.pos.y + 0.3);
          if (this.sightFactor(g, p, 0.7, false) > 0.02) {
            if (g.investigateBody !== b) {
              g.investigateBody = b;
              g.suspicion = Math.max(g.suspicion, 0.5);
              this.hooks.bark(g, 'heardSomething');
              this.setState(g, 'investigate');
              this.goTo(g, b.pos);
            }
          }
        }
      }

      // ---------- state machine ----------
      switch (g.state) {
        case 'patrol': {
          if (g.suspicion > FEEL.suspicionThreshold) {
            this.setState(g, 'suspicious');
            this.hooks.becameSuspicious(g);
            this.hooks.bark(g, 'heardSomething');
            break;
          }
          this.patrol(g, dt);
          break;
        }
        case 'suspicious': {
          // stop and stare at the stimulus
          g.speed = 0;
          const want = Math.atan2(g.lastKnown.x - g.pos.x, g.lastKnown.z - g.pos.z);
          g.yaw = dampAngle(g.yaw, want, g.stateT < 0.5 ? 1.5 : 3.5, dt);
          // human reaction time: a startled guard needs a beat before raising the alarm
          if (g.suspicion >= 1 && g.stateT > 1.1) this.becomeAlert(g);
          else if (g.stateT > 1.3 && !g.seesPlayer) {
            this.setState(g, 'investigate');
            this.goTo(g, g.lastKnown);
          }
          break;
        }
        case 'investigate': {
          if (g.suspicion >= 1) {
            this.becomeAlert(g);
            break;
          }
          if (g.seesPlayer && g.suspicion > 0.5) {
            this.setState(g, 'suspicious');
            break;
          }
          const arrived = this.follow(g, dt, g.alertLevel > 0 ? 2.2 : FEEL.guardWalk);
          if (g.investigateBody && g.pos.distanceTo(g.investigateBody.pos) < 2.2) {
            const b = g.investigateBody;
            g.investigateBody = null;
            if (!b.discovered && b.state === 'lying') {
              b.discovered = true;
              this.hooks.bodyDiscovered(b, g);
              this.hooks.bark(g, 'bodyFound');
              g.lastKnown.copy(b.pos);
              this.alarm(b.pos, g);
              g.alertLevel = 2;
              this.startSearch(g);
            }
            break;
          }
          if (arrived) {
            if (g.stateT > 0 && this.lookAround(g, dt, 4)) {
              g.suspicion = Math.max(0, g.suspicion - 0.25);
              if (g.radioCalled) {
                // came to check a silent colleague and found nothing: stay sharp
                g.radioCalled = false;
                g.alertLevel = Math.max(g.alertLevel, 1);
                this.startSearch(g);
              } else {
                this.hooks.bark(g, 'lostBark');
                this.returnToPatrol(g);
              }
            }
          }
          break;
        }
        case 'search': {
          if (g.suspicion >= 1 && g.seesPlayer) {
            this.becomeAlert(g);
            break;
          }
          if (g.seesPlayer && g.suspicion > 0.55) {
            this.becomeAlert(g);
            break;
          }
          const arrived = this.follow(g, dt, g.stateT < 8 ? FEEL.guardRun * 0.7 : 2.0);
          if (arrived && this.lookAround(g, dt, 2.5)) {
            g.searchPoints--;
            if (g.searchPoints <= 0 || g.stateT > 45) {
              g.suspicion = 0.15;
              this.hooks.bark(g, 'lostBark');
              this.returnToPatrol(g);
            } else {
              const p = g.lastKnown.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14));
              this.goTo(g, p);
            }
          }
          break;
        }
        case 'alert': {
          alertCount++;
          if (!player.alive) {
            this.returnToPatrol(g);
            break;
          }
          const want = Math.atan2(g.lastKnown.x - g.pos.x, g.lastKnown.z - g.pos.z);
          if (g.seesPlayer) {
            g.yaw = dampAngle(g.yaw, want, 8, dt);
            const d = g.pos.distanceTo(player.feet);
            if (d > 11) {
              if (g.path.length === 0 || g.target.distanceTo(g.lastKnown) > 3) this.goTo(g, g.lastKnown);
              this.follow(g, dt, FEEL.guardRun * 0.6, true);
            } else g.speed = 0;
            g.fireT -= dt;
            if (g.fireT <= 0 && d < 38) {
              g.fireT = FEEL.guardFireInterval * (0.8 + Math.random() * 0.5);
              const moving = player.speed > 3 ? 0.18 : player.speed > 0.5 ? 0.08 : 0;
              const chance = THREE.MathUtils.clamp(0.8 - d / 45 - moving - (player.crouched ? 0.08 : 0), 0.15, 0.85);
              this.hooks.shoot(g, Math.random() < chance, player.chest);
            }
          } else {
            if (g.path.length === 0 || g.target.distanceTo(g.lastKnown) > 2) this.goTo(g, g.lastKnown);
            const arrived = this.follow(g, dt, FEEL.guardRun * 0.8);
            if (g.unseenT > 6 || arrived) {
              g.suspicion = 0.7;
              this.hooks.bark(g, 'searchBark');
              this.alarm(g.lastKnown, null);
              this.startSearch(g);
            }
          }
          break;
        }
      }

      if (g.state !== 'patrol') tension = Math.max(tension, Math.min(1, g.suspicion + 0.2));
      else tension = Math.max(tension, g.suspicion);

      // ---------- movement integration ----------
      this.world.resolveCircle(g.pos, 0.38, g.pos.y, g.pos.y + 1.8, 0.45);
      const gy = this.world.groundAt(g.pos.x, g.pos.z, 0.2, g.pos.y + 0.5);
      if (gy > -5) g.pos.y = gy;
      // stuck detection → repath
      if (g.speed > 0.5) {
        if (g.pos.distanceTo(g.lastPos) < g.speed * dt * 0.2) g.stuckT += dt;
        else g.stuckT = 0;
        if (g.stuckT > 1.2) {
          g.stuckT = 0;
          this.goTo(g, g.target);
        }
      }
      g.lastPos.copy(g.pos);
      g.char.root.position.copy(g.pos);
      g.char.root.rotation.y = g.yaw;
      g.char.update(dt, g.speed);
    }
    this.globalAlarm = alertCount > 0 ? 1 : Math.max(0, this.globalAlarm - dt * 0.05);
    this.updateFans(dt);
    this.updateBodies(dt);
    return { tension, alarm: alertCount > 0 ? 1 : 0 };
  }

  private becomeAlert(g: Guard) {
    this.setState(g, 'alert');
    g.suspicion = 1;
    g.alertLevel = 2;
    g.fireT = 0.6;
    this.hooks.becameAlert(g);
    this.hooks.bark(g, 'alarmBark');
    this.hooks.alarmRaised(g, g.lastKnown);
    // shout: nearby guards join
    for (const o of this.guards) {
      if (o === g || !o.alive || o.state === 'alert') continue;
      if (o.pos.distanceTo(g.pos) < 30) {
        o.lastKnown.copy(g.lastKnown);
        o.alertLevel = 2;
        o.suspicion = Math.max(o.suspicion, 0.75);
        this.startSearch(o);
      }
    }
  }

  private returnToPatrol(g: Guard) {
    this.setState(g, 'patrol');
    g.investigateBody = null;
    g.suspicion = Math.min(g.suspicion, 0.2);
    // go back to nearest route point
    let best = 0, bd = Infinity;
    g.def.route.forEach((p, i) => {
      const d = p.distanceTo(g.pos);
      if (d < bd) { bd = d; best = i; }
    });
    g.routeIdx = best;
    this.goTo(g, g.def.route[best]);
    g.waitT = 0;
  }

  private patrol(g: Guard, dt: number) {
    const route = g.def.route;
    if (route.length === 1) {
      // sentry: return to post, then idle and glance around
      if (g.def.sweep) {
        g.speed = 0;
        g.lookT += dt;
        g.yaw = dampAngle(g.yaw, (g.def.facing ?? 0) + Math.sin(g.lookT * 0.24) * g.def.sweep, 4, dt);
        return;
      }
      if (!g.def.static && g.pos.distanceTo(route[0]) > 0.6) {
        if (g.path.length === 0 || g.target.distanceTo(route[0]) > 0.5) this.goTo(g, route[0]);
        this.follow(g, dt, FEEL.guardWalk);
      } else {
        g.speed = 0;
        g.lookT += dt;
        const base = g.def.facing ?? 0;
        g.yaw = dampAngle(g.yaw, base + Math.sin(g.lookT * 0.35) * 0.9, 2, dt);
      }
      return;
    }
    if (g.waitT > 0) {
      g.waitT -= dt;
      g.speed = 0;
      g.lookT += dt;
      g.yaw = dampAngle(g.yaw, g.lookBase + Math.sin(g.lookT * 0.9) * 0.7, 2.5, dt);
      if (g.waitT <= 0) {
        g.routeIdx = (g.routeIdx + 1) % route.length;
        this.goTo(g, route[g.routeIdx]);
      }
      return;
    }
    if (g.path.length === 0 || g.target.distanceTo(route[g.routeIdx]) > 0.5) this.goTo(g, route[g.routeIdx]);
    if (this.follow(g, dt, FEEL.guardWalk * (1 + g.alertLevel * 0.1))) {
      g.waitT = g.def.wait[g.routeIdx] ?? 2;
      g.lookBase = g.yaw;
      g.lookT = 0;
    }
  }

  /** Walk along the current path. Returns true when arrived. */
  private follow(g: Guard, dt: number, speed: number, faceTarget = false) {
    if (g.def.static) {
      // posted on a tower or deck: never walks off it, only turns
      g.speed = 0;
      if (g.state !== 'patrol') g.yaw = dampAngle(g.yaw, Math.atan2(g.lastKnown.x - g.pos.x, g.lastKnown.z - g.pos.z), 3, dt);
      return true;
    }
    if (g.pathIdx >= g.path.length) {
      g.speed = THREE.MathUtils.damp(g.speed, 0, 10, dt);
      return true;
    }
    const wp = g.path[g.pathIdx];
    _v.set(wp.x - g.pos.x, 0, wp.z - g.pos.z);
    const d = _v.length();
    if (d < 0.35) {
      g.pathIdx++;
      return g.pathIdx >= g.path.length;
    }
    g.speed = THREE.MathUtils.damp(g.speed, speed, 6, dt);
    const step = Math.min(d, g.speed * dt);
    g.pos.x += (_v.x / d) * step;
    g.pos.z += (_v.z / d) * step;
    if (!faceTarget) g.yaw = dampAngle(g.yaw, Math.atan2(_v.x, _v.z), 7, dt);
    return false;
  }

  private lookAround(g: Guard, dt: number, dur: number) {
    g.speed = 0;
    g.lookT += dt;
    if (g.lookT < dt * 1.5) g.lookBase = g.yaw;
    g.yaw = dampAngle(g.yaw, g.lookBase + Math.sin(g.lookT * 1.6) * 1.2, 4, dt);
    if (g.lookT > dur) {
      g.lookT = 0;
      return true;
    }
    return false;
  }

  private updateDead(g: Guard, dt: number) {
    g.deadT += dt;
    // collapse animation
    const k = Math.min(1, g.deadT / 0.45);
    const e = k * k * (3 - 2 * k);
    const body = this.bodies.find((b) => b.guard === g);
    if (body && body.state !== 'carried') {
      g.char.root.position.set(body.pos.x, body.pos.y + 0.12 * e, body.pos.z);
      g.char.root.rotation.set(0, body.yaw, 0);
      g.char.root.rotateX(-Math.PI / 2 * e);
    }
    // radio check on silent guards
    if (g.radioT > 0) {
      g.radioT -= dt;
      if (g.radioT <= 0) this.radioCheck(g);
    }
  }

  radioCheck: (g: Guard) => void = () => {};

  /** Nearest living guard is sent to check on the silent one's post. */
  dispatchCheck(dead: Guard) {
    let best: Guard | null = null, bd = Infinity;
    for (const g of this.guards) {
      if (!g.alive || g.state === 'alert') continue;
      const d = g.pos.distanceTo(dead.post);
      if (d < bd) { bd = d; best = g; }
    }
    if (!best) return;
    best.radioCalled = true;
    best.alertLevel = Math.max(best.alertLevel, 1);
    best.lastKnown.copy(dead.post);
    best.suspicion = Math.max(best.suspicion, 0.35);
    this.setState(best, 'investigate');
    this.goTo(best, dead.post);
  }

  private updateBodies(dt: number) {
    for (const b of this.bodies) {
      if (b.state !== 'flying') continue;
      // handled by game (needs rifts)
    }
  }

  setFanVisibility(v: number) {
    this.fansVisible = v;
  }

  private updateFans(dt: number) {
    const vis = this.fansVisible;
    for (const g of this.guards) {
      const m = g.fan.material as THREE.ShaderMaterial;
      m.uniforms.uOpacity.value = vis * 0.32;
      g.fan.visible = vis > 0.01 && g.alive && g.pos.distanceTo(this.viewer) < 70;
      if (!g.fan.visible) continue;
      const col = g.state === 'alert' ? [1, 0.15, 0.1] : g.suspicion > 0.3 ? [1, 0.75, 0.1] : [0.85, 0.9, 1];
      m.uniforms.uColor.value.setRGB(col[0], col[1], col[2]);
      const pos = g.fan.geometry.getAttribute('position') as THREE.BufferAttribute;
      const alpha = g.fan.geometry.getAttribute('alpha') as THREE.BufferAttribute;
      const segs = pos.count - 2;
      const eye = g.eye(new THREE.Vector3());
      const y = g.def.kind === 'sniper' ? 0.06 : g.pos.y + 0.06;
      const fovHalf = g.def.fov ?? FEEL.guardFovHalf;
      pos.setXYZ(0, g.pos.x, y, g.pos.z);
      alpha.setX(0, 0.9);
      const range = g.viewDistance() * (g.def.kind === 'sniper' ? 0.9 : 0.55);
      for (let i = 0; i <= segs; i++) {
        const a = g.yaw - fovHalf + (i / segs) * fovHalf * 2;
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const from = new THREE.Vector3(g.pos.x, eye.y - 0.4, g.pos.z);
        const hit = this.world.raycast(from, dir, range, { sight: true });
        const r = hit ? hit.distance : range;
        pos.setXYZ(i + 1, g.pos.x + dir.x * r, y, g.pos.z + dir.z * r);
        alpha.setX(i + 1, 0.05);
      }
      pos.needsUpdate = true;
      alpha.needsUpdate = true;
    }
  }
}
