import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { gangLook, copLook, swatLook } from './looks.js';
import { PEN_BLUE, ERASER_PINK, ERASER_BLUE } from './items.js';
import { BLACK_INK } from '../render/LineBatch.js';
import { groundHeight } from '../world/layout.js';
import { clamp, damp, dampAngle, angleDiff, RNG } from '../core/util.js';
import { CoverMap, PathFinder, PERSONAS, LINES, pick, pickPersona } from './tactics.js';

// armor: how much of an eraser hit actually rubs out (bigger guys take more rubbing)
// mag / reload: shots before they have to duck and reload
// personas: how likely each personality is for this kind of fighter
const TYPES = {
  thug: { look: 'street', walk: 2.0, run: 5.0, range: 34, dmg: 7, interval: 1.15, burst: 2, mag: 8, reload: 2.0, sight: 40, scale: 1, armor: 1, personas: { standard: 3, coward: 2, hothead: 2, lookout: 1 } },
  mask: { look: 'mask', walk: 2.2, run: 5.4, range: 28, dmg: 4, interval: 0.16, burst: 4, pause: 1.7, mag: 16, reload: 2.3, sight: 40, scale: 1, armor: 1, personas: { hothead: 2, standard: 2, veteran: 1 } },
  mob: { look: 'mob', walk: 1.9, run: 4.6, range: 40, dmg: 11, interval: 1.4, burst: 1, mag: 6, reload: 2.4, sight: 44, scale: 1, armor: 1.2, personas: { veteran: 3, standard: 1, lookout: 1 } },
  brute: { look: 'biker', walk: 1.8, run: 4.6, range: 2.4, dmg: 22, interval: 1.1, melee: true, sight: 34, scale: 1.06, armor: 1.6, personas: { hothead: 3, standard: 1 } },
  // Scribble City Police: pen-pistols, the big school eraser, and paint M4s for the riot unit
  cop: { look: 'cop', walk: 2.0, run: 5.2, range: 30, dmg: 8, interval: 0.5, burst: 3, pause: 1.6, mag: 12, reload: 1.8, sight: 42, scale: 1, armor: 1.1, personas: { standard: 3, veteran: 2, hothead: 1 }, faction: 'police', gun: 'pen' },
  copEraser: { look: 'cop', walk: 2.0, run: 5.0, range: 2.5, dmg: 18, interval: 1.0, melee: true, sight: 38, scale: 1.03, armor: 1.3, personas: { hothead: 2, standard: 1 }, faction: 'police', club: 'eraser' },
  swat: { look: 'swat', walk: 2.0, run: 5.2, range: 38, dmg: 6, interval: 0.11, burst: 5, pause: 1.3, mag: 30, reload: 2.4, sight: 46, scale: 1.02, armor: 1.5, personas: { veteran: 3, standard: 1 }, faction: 'police', gun: 'm4' },
  // a driver you pulled out of their car, coming after you with bare fists
  driver: { walk: 2.2, run: 5.4, range: 1.9, dmg: 6, interval: 0.85, melee: true, unarmed: true, sight: 32, scale: 1, armor: 0.85, personas: { hothead: 1 }, faction: 'civ' },
  scrib: { monster: 'scrib', hp: 120, walk: 2.4, run: 6.2, range: 2.6, dmg: 14, interval: 0.9, sight: 30, radius: 0.95 },
  stalk: { monster: 'stalk', hp: 150, walk: 1.8, run: 4.8, range: 3.2, dmg: 20, interval: 1.3, sight: 36, radius: 0.7 },
  spike: { monster: 'spike', hp: 90, walk: 3.0, run: 7.2, range: 2.4, dmg: 12, interval: 0.8, sight: 28, radius: 0.85 },
};

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();
const _ro = new THREE.Vector3();
const _rd = new THREE.Vector3();
const _sp = new THREE.Vector3();
let nextId = 1;

// how big a hole each kind of hit rubs out (metres)
export function holeRadius(kind, amount) {
  if (kind === 'paint') return 0.045 + amount * 0.0018;
  if (kind === 'pencil') return 0.07 + amount * 0.0011;
  if (kind === 'melee') return 0.095 + amount * 0.001; // the big school eraser rubs a wider patch
  if (kind === 'beam') return 0.09;
  if (kind === 'crayon') return 0.06 + amount * 0.002;
  if (kind === 'staple' || kind === 'shaving' || kind === 'glue') return 0.04 + amount * 0.0012;
  if (kind === 'slash') return 0.13 + amount * 0.0011; // the ruler's edge cuts deep
  if (kind === 'scissors') return 0.1 + amount * 0.0012;
  return 0.06 + amount * 0.001;
}
const REMOVE_AT = { head: 0.5, armL: 0.5, armR: 0.5, legL: 0.45, legR: 0.45, torso: 0.4 };
const INK_WEIGHT = { head: 0.7, torso: 1.2, armL: 0.35, armR: 0.35, legL: 0.45, legR: 0.45 };

/**
 * A crew that works together: shares what it knows about you, splits roles
 * (one flanks while the others hold cover), searches as a group and calls for backup.
 */
class Squad {
  constructor(mgr, home, territory) {
    this.mgr = mgr;
    this.members = [];
    this.home = home;
    this.territory = territory;
    this.lastKnown = new THREE.Vector3();
    this.lastVel = new THREE.Vector3();
    this.knowT = -100; // newest info about where you are
    this.seenT = -100; // newest time someone actually saw you
    this.flanker = null;
    this.flankFailT = -100;
    this.backupCalls = 0;
    this.backupT = -100;
    this.sayT = 0;
    this.search = null; // { pts, t, until }
  }

  get time() {
    return this.mgr.game.time;
  }

  fighters() {
    return this.members.filter((m) => m.alive && m.state === 'combat');
  }

  // somebody saw or heard you: everyone within shouting distance learns it a moment later
  report(from, pos, firsthand, vel = null) {
    const t = this.time;
    this.lastKnown.copy(pos);
    if (vel) this.lastVel.copy(vel);
    this.knowT = t;
    if (firsthand) this.seenT = t;
    this.search = null;
    for (const m of this.members) {
      if (m === from || !m.alive || m.headless || m.state === 'flee') continue;
      const d = Math.hypot(m.pos.x - from.pos.x, m.pos.z - from.pos.z);
      if (d > 55) continue;
      if (m.state !== 'combat' && m.joinT < 0) m.joinT = t + 0.35 + Math.random() * 0.7 + d * 0.01;
    }
  }

  // pick who flanks: a brave gunman, not the one closest to you
  assignRoles() {
    const f = this.fighters().filter((m) => !m.cfg.melee && !m.isMonster && !m.armless && !m.headless);
    if (this.flanker && (!this.flanker.alive || this.flanker.state !== 'combat')) this.flanker = null;
    if (this.flanker || f.length < 3 || this.time - this.seenT > 6 || this.time - this.flankFailT < 8) return;
    let best = null;
    let bestS = -1e9;
    for (const m of f) {
      if (m.persona.courage < 0.4) continue;
      const s = (m.persona.flanker ? 3 : 0) + m.persona.aggro * 2 + Math.hypot(m.pos.x - this.lastKnown.x, m.pos.z - this.lastKnown.z) * 0.05 + Math.random();
      if (s > bestS) {
        bestS = s;
        best = m;
      }
    }
    if (best) {
      this.flanker = best;
      best.startFlank();
    }
  }

  beginSearch() {
    if (this.search) return this.search;
    const lk = this.lastKnown;
    const nav = this.mgr.game.world.nav;
    const pts = [[lk.x, lk.z]];
    // where you were heading
    const vl = Math.hypot(this.lastVel.x, this.lastVel.z);
    if (vl > 1) pts.push([lk.x + (this.lastVel.x / vl) * 9, lk.z + (this.lastVel.z / vl) * 9]);
    // hiding places near the last sighting
    const spots = this.mgr.game.world.hideSpots
      .filter((h) => !h.gone)
      .map((h) => ({ h, d: Math.hypot(h.x - lk.x, h.z - lk.z) }))
      .filter((o) => o.d < 16)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const o of spots) pts.push([o.h.x, o.h.z, true]);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 7;
      const x = lk.x + Math.cos(a) * r;
      const z = lk.z + Math.sin(a) * r;
      if (nav.walkable(x, z)) pts.push([x, z]);
    }
    this.search = { pts: pts.map((p) => ({ x: p[0], z: p[1], hide: !!p[2], taken: null, done: false })), until: this.time + 16 + Math.random() * 6 };
    return this.search;
  }

  nextSearchPoint(m) {
    const s = this.search;
    if (!s) return null;
    let best = null;
    let bd = 1e9;
    for (const p of s.pts) {
      if (p.done || (p.taken && p.taken !== m && p.taken.alive && p.taken.state === 'search')) continue;
      const d = Math.hypot(p.x - m.pos.x, p.z - m.pos.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) best.taken = m;
    return best;
  }

  say(m, kind, tone) {
    if (this.sayT > this.time) return false;
    if (m.say(kind, tone)) {
      this.sayT = this.time + 1.1;
      return true;
    }
    return false;
  }
}

class Enemy {
  constructor(mgr, type, x, z, territory, look = null) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.id = nextId++;
    this.type = type;
    this.cfg = TYPES[type];
    this.territory = territory;
    this.isMonster = !!this.cfg.monster;
    if (this.isMonster) {
      // (no monsters in this city: a monster kind becomes a thug)
      this.cfg = TYPES.thug;
      this.isMonster = false;
    }
    if (this.isMonster) {
      this.hp = this.cfg.hp;
      this.maxHp = this.cfg.hp;
      this.radius = this.cfg.radius;
      this.height = this.fig.cfg.cy + this.fig.cfg.h * 0.5;
    } else {
      const L = look || (this.cfg.look === 'cop' ? copLook() : this.cfg.look === 'swat' ? swatLook() : gangLook(this.cfg.look));
      this.fig = new Doodle(mgr.game.figures, L, { seed: this.id * 3.7, scale: this.cfg.scale });
      this.radius = 0.4 * this.fig.bulk;
      this.height = 1.85 * this.fig.scale;
    }
    this.pos = this.fig.pos;
    this.pos.set(x, groundHeight(x, z), z);
    this.home = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.state = 'patrol';
    this.stateT = 0;
    this.target = new THREE.Vector3(x, 0, z);
    this.lastSeen = new THREE.Vector3();
    this.seeT = -100;
    this.sees = false;
    this.fireT = Math.random() * 1.5;
    this.burstLeft = 0;
    this.dying = -1;
    this.flinch = 0;
    this.knockV = new THREE.Vector3();
    this.paintT = 0;
    this.thinkT = Math.random() * 0.3;
    this.wanderT = 0;
    this.attackT = -1;
    this.pause = 0;
    // brains
    this.personaName = this.isMonster ? 'standard' : pickPersona(this.cfg.personas || { standard: 1 });
    this.persona = PERSONAS[this.personaName];
    this.faction = this.cfg.faction || (this.isMonster ? 'monster' : 'gang');
    this.lines = LINES[this.faction === 'monster' ? 'gang' : this.faction];
    this.awareness = 0;
    this.onEdge = 0; // stays jumpy for a while after a fight
    this.maxMorale = 0.45 + this.persona.courage * 0.7;
    this.morale = this.maxMorale;
    this.mag = this.cfg.mag || 99;
    this.reloadT = 0;
    this.tactic = '';
    this.decideT = 0;
    this.cover = null;
    this.coverPhase = 'hide';
    this.phaseT = 0;
    this.phaseLen = 1;
    this.checkT = 0;
    this.path = null;
    this.pathI = 0;
    this.pathGoal = new THREE.Vector3(1e9, 0, 1e9);
    this.pathT = -10;
    this.progT = 0;
    this.progPos = new THREE.Vector3(x, 0, z);
    this.aimT = 0; // seconds with you in sight: the aim settles
    this.tokenT = -1;
    this.sayT = Math.random() * 2;
    this.joinT = -1;
    this.dodgeT = 0;
    this.dodgeX = 0;
    this.dodgeZ = 0;
    this.strafeT = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.searchPt = null;
    this.lookT = 0;
    this.hurtT = -10;
    this.squad = mgr.squadFor(territory, x, z, this.faction);
    this.squad.members.push(this);
  }

  get alive() {
    return this.dying < 0;
  }

  get hostile() {
    return this.alive && this.state === 'combat';
  }

  get headless() {
    return !this.isMonster && this.fig.parts.head < 0.5;
  }

  // both legs gone: crawls
  get legless() {
    return !this.isMonster && this.fig.parts.legL < 0.5 && this.fig.parts.legR < 0.5;
  }

  // one leg gone: limps
  get limping() {
    return !this.isMonster && (this.fig.parts.legL < 0.5) !== (this.fig.parts.legR < 0.5);
  }

  // the gun hand is gone
  get armless() {
    return !this.isMonster && this.fig.parts.armR < 0.5;
  }

  get gunman() {
    return !this.isMonster && !this.cfg.melee && !this.armless;
  }

  get doneDying() {
    return this.isMonster ? this.dying >= 1.2 : this.fig.dissolve >= 1;
  }

  knock(x, z) {
    this.knockV.set(x, 0, z);
  }

  paint(color) {
    this.paintT = 2.5;
    if (!this.isMonster) this.fig.paint(color);
  }

  dispose() {
    this.leaveCover();
    const i = this.squad.members.indexOf(this);
    if (i >= 0) this.squad.members.splice(i, 1);
    this.fig.dispose();
  }

  setState(s) {
    if (this.state === s) return;
    const was = this.state;
    this.state = s;
    this.stateT = 0;
    const head = _v.copy(this.pos);
    head.y += this.height + 0.5;
    if (s === 'combat' && was !== 'combat' && !this.headless) this.game.fx.mark('fx_alert', head.x, head.y, head.z, 0.8, 1.1);
    if (s === 'suspicious' && !this.headless) this.game.fx.mark('fx_question', head.x, head.y, head.z, 0.8, 1.4);
    if (s !== 'combat') {
      this.leaveCover();
      this.tactic = '';
      if (this.squad.flanker === this) this.squad.flanker = null;
    }
  }

  note(msg) {
    if (this.mgr.debug) this.mgr.debug.push(`${this.game.time.toFixed(1)} ${this.type}#${this.id} ${msg}`);
  }

  // shout something (no head, no voice)
  say(kind, tone = 'plain') {
    if (this.isMonster || this.headless || this.sayT > this.game.time) return false;
    const list = this.lines[kind];
    if (!list) return false;
    const cam = this.game.camera.position;
    if (Math.hypot(cam.x - this.pos.x, cam.z - this.pos.z) > 60) return false;
    this.game.bubbles.say(this, pick(list), this.faction === 'police' && tone === 'plain' ? 'cop' : tone);
    this.sayT = this.game.time + 3.2 + Math.random() * 2.5;
    return true;
  }

  targetPos() {
    const p = this.game.player;
    return p.inVehicle ? p.inVehicle.pos : p.pos;
  }

  canSeePlayer() {
    const game = this.game;
    const p = game.player;
    if (p.mode === 'dead' || this.headless || game.inBar) return false;
    const tp = this.targetPos();
    const dx = tp.x - this.pos.x;
    const dz = tp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > this.cfg.sight * (1 + this.onEdge * 0.2)) return false;
    if (p.hidden && d > 3.2 && !p.inVehicle) return false;
    if (d > 6) {
      // they only notice what is in front of them unless they are already fighting
      const a = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
      const cone = this.state === 'combat' ? 2.4 : this.state === 'patrol' || this.state === 'return' ? 1.2 : 1.6;
      if (a > cone) return false;
    }
    const ey = this.pos.y + this.height * (this.fig.crouch > 0.5 ? 0.62 : 0.9);
    const ty = p.inVehicle ? p.inVehicle.pos.y + 1.2 : tp.y + 1.3;
    const col = game.world.collision;
    if (col.lineOfSight(this.pos.x, ey, this.pos.z, tp.x, ty, tp.z)) return true;
    // just the head showing over something
    return !p.inVehicle && col.lineOfSight(this.pos.x, ey, this.pos.z, tp.x, tp.y + 1.65, tp.z);
  }

  // ------------------------------------------------------------------ main update
  update(dt) {
    const game = this.game;
    const fig = this.fig;
    if (this.dying >= 0) {
      this.updateDying(dt);
      return;
    }
    this.stateT += dt;
    this.thinkT -= dt;
    this.decideT -= dt;
    if (this.paintT > 0) this.paintT -= dt;
    if (this.onEdge > 0) this.onEdge = Math.max(0, this.onEdge - dt / 40);
    if (this.morale < this.maxMorale && game.time - this.hurtT > 5) this.morale = Math.min(this.maxMorale, this.morale + dt * 0.03);
    if (this.headless) {
      this.blindT = (this.blindT || 0) + dt;
      // a headless body keeps going for a while and then folds
      if (this.blindT > 14) {
        this.mgr.kill(this);
        return;
      }
    }
    const tp = this.targetPos();
    const dx = tp.x - this.pos.x;
    const dz = tp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    // perception (a few times per second)
    if (this.thinkT <= 0) {
      const step = 0.16 + Math.random() * 0.1;
      this.thinkT = step;
      this.perceive(step, tp, dist);
    }
    if (this.sees) this.aimT += dt;
    else this.aimT = Math.max(0, this.aimT - dt * (this.inCover ? 0.4 : 2));
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.mag = this.cfg.mag || 99;
    } else if (this.mag <= 0 && this.state !== 'combat') this.reloadT = this.cfg.reload || 2;
    // word from the squad
    if (this.joinT >= 0 && game.time >= this.joinT) {
      this.joinT = -1;
      if (this.state !== 'combat' && this.state !== 'flee' && !this.headless) {
        this.lastSeen.copy(this.squad.lastKnown);
        this.awareness = 1;
        this.enterCombat(false);
      }
    }
    this.checkVehicle(tp, dist);

    const mv = this.isMonster ? this.monsterBrain(dt, tp, dist) : this.brain(dt, tp, dist);
    let { x: moveX, z: moveZ, speed } = mv;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      moveX = this.dodgeX;
      moveZ = this.dodgeZ;
      speed = 7.5;
      fig.air = this.dodgeT > 0.12;
    } else if (!this.isMonster) fig.air = false;
    if (this.legless) speed = Math.min(speed, 0.9);
    else if (this.limping) speed = Math.min(speed * 0.45, 1.8);
    if (this.flinch > 0) {
      this.flinch -= dt;
      speed *= 0.3;
    }
    // stapled for a moment, or glued to the pavement
    if (this.pinT > 0) {
      this.pinT -= dt;
      speed *= 0.12;
    }
    if (this.glueT > 0) {
      this.glueT -= dt;
      speed = 0;
      moveX = 0;
      moveZ = 0;
      this.dodgeT = 0;
    }
    // integrate
    const tvx = moveX * speed;
    const tvz = moveZ * speed;
    this.vel.x = damp(this.vel.x, tvx, 8, dt) + this.knockV.x;
    this.vel.z = damp(this.vel.z, tvz, 8, dt) + this.knockV.z;
    this.knockV.multiplyScalar(Math.exp(-6 * dt));
    if (this.knockV.lengthSq() < 0.01) this.knockV.set(0, 0, 0);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    game.world.collision.resolveCylinder(this.pos, this.radius, this.height, 0.5);
    game.vehicles.pushOut(this.pos, this.radius);
    const g = groundHeight(this.pos.x, this.pos.z);
    this.pos.y = damp(this.pos.y, g, 20, dt);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    // stuck on something: try another way
    if (speed > 0.5) {
      this.progT += dt;
      if (this.progT > 1.4) {
        if (Math.hypot(this.pos.x - this.progPos.x, this.pos.z - this.progPos.z) < 0.5) this.onStuck();
        this.progT = 0;
        this.progPos.copy(this.pos);
      }
    } else {
      this.progT = 0;
      this.progPos.copy(this.pos);
    }
    if (mv.face !== undefined) this.yaw = dampAngle(this.yaw, mv.face, mv.faceRate || 9, dt);
    else if (speed > 0.1) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 7, dt);
    fig.yaw = this.yaw;
    fig.speed = sp;
    if (!this.isMonster) {
      fig.crawl = damp(fig.crawl, this.legless ? 1 : 0, 6, dt);
      fig.crouch = damp(fig.crouch, mv.crouch && !this.legless ? 1 : 0, 9, dt);
      if (!this.headless) {
        fig.aim = mv.aim && this.gunman ? 1 : 0;
        fig.aimYaw = mv.aimYaw || 0;
        const aimY = mv.aimAt ? mv.aimAt.y : tp.y + 1.2;
        const ax = mv.aimAt ? mv.aimAt.x : tp.x;
        const az = mv.aimAt ? mv.aimAt.z : tp.z;
        const ady = aimY - (this.pos.y + (fig.crouch > 0.5 ? 1.0 : 1.4));
        fig.aimPitch = Math.atan2(ady, Math.max(1, Math.hypot(ax - this.pos.x, az - this.pos.z)));
        fig.armsUp = 0;
        fig.stagger = this.limping ? 0.6 : 0;
        if (!this.armless) fig.flail = 0;
      }
    }
    this.updateMelee(dt);
    fig.update(dt);
  }

  updateDying(dt) {
    const fig = this.fig;
    if (this.isMonster) {
      this.dying += dt * 1.6;
      fig.dead = Math.min(1, this.dying);
      fig.speed = 0;
    } else {
      this.dying += dt;
      fig.crouch = Math.max(0, fig.crouch - dt * 3);
      if (fig.split >= 0) {
        // the legs stumble on for a moment after the waist is gone
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
        fig.dissolve = clamp((this.dying - 0.9) / 0.9, 0, 1);
      }
    }
    fig.update(dt);
  }

  updateMelee(dt) {
    const game = this.game;
    const fig = this.fig;
    if (this.pendingHit) {
      this.pendingHit.t -= dt;
      if (this.pendingHit.t <= 0) {
        const ph = this.pendingHit;
        this.pendingHit = null;
        const pl = game.player;
        const pp = pl.inVehicle ? pl.inVehicle.pos : pl.pos;
        if (Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z) < ph.range + 0.8 + (pl.inVehicle ? 1.6 : 0)) {
          pl.hurt(ph.dmg, this.pos.x, this.pos.z, this.fig.j ? this.fig.j.handR : null);
          game.audio.play(this.isMonster ? 'bite' : 'punch');
        }
      }
    }
    if (this.attackT >= 0) {
      this.attackT += dt * 2.2;
      if (this.isMonster) fig.attack = this.attackT;
      else fig.melee = this.attackT;
      if (this.attackT >= 1) {
        this.attackT = -1;
        if (this.isMonster) fig.attack = -1;
        else fig.melee = -1;
      }
    }
  }

  // ------------------------------------------------------------------ senses
  perceive(step, tp, dist) {
    const game = this.game;
    const p = game.player;
    this.sees = this.canSeePlayer();
    if (!this.sees) {
      if (this.state === 'patrol' || this.state === 'return') this.awareness = Math.max(0, this.awareness - step * 0.12);
      return;
    }
    if (this.faction === 'police' && !game.police.hostile) return; // just a witness
    this.lastSeen.copy(tp);
    this.seeT = game.time;
    if (this.state === 'combat') {
      this.squad.report(this, tp, true, p.inVehicle ? p.inVehicle.vel || null : p.vel);
      return;
    }
    if (this.state === 'flee') return;
    if (this.state === 'suspicious') this.target.copy(tp);
    // suspicion builds up: fast when you are close, sprinting, shooting or driving
    const moving = p.inVehicle ? 1.6 : Math.hypot(p.vel.x, p.vel.z) > 6 ? 1.4 : 1;
    const loud = game.time - game.weapons.lastFire < 1.5 ? 2.5 : 1;
    const rate = (2.4 / (0.45 + dist / 9)) * moving * loud * (1 + this.onEdge) * (this.isMonster ? 3 : 1) * (this.state === 'search' ? 4 : 1);
    this.awareness += rate * step;
    if (this.awareness >= 1 || dist < 2.5) {
      this.awareness = 1;
      this.enterCombat(true);
    } else if (this.awareness > 0.3 && (this.state === 'patrol' || this.state === 'return')) {
      this.setState('suspicious');
      this.target.copy(tp);
      if (Math.random() < 0.5) this.say('huh');
    }
  }

  enterCombat(firsthand) {
    if (this.state === 'combat' || this.headless) return;
    const sq = this.squad;
    const fresh = this.game.time - sq.knowT > 8;
    this.setState('combat');
    this.decideT = 0;
    this.aimT = 0;
    this.fireT = Math.max(this.fireT, this.persona.react * (0.8 + Math.random() * 0.5));
    if (firsthand) {
      sq.report(this, this.lastSeen, true, this.game.player.vel);
      if (!sq.say(this, 'spot', 'alarm')) this.say('spot', 'alarm');
      if (this.persona.caller || (fresh && sq.members.length <= 2 && Math.random() < 0.5)) this.callBackup();
    } else {
      this.lastSeen.copy(sq.lastKnown);
    }
  }

  callBackup() {
    const sq = this.squad;
    const t = this.game.time;
    if (this.faction === 'police') {
      if (t - sq.backupT > 20) {
        sq.backupT = t;
        this.say('backup', 'alarm');
        this.game.police.requestBackup();
      }
      return;
    }
    if (this.isMonster || this.faction === 'civ' || sq.backupCalls >= 2 || t - sq.backupT < 25 || this.headless) return;
    sq.backupCalls++;
    sq.backupT = t;
    this.say('backup', 'alarm');
    this.mgr.backup(this, sq.lastKnown);
  }

  // A car (yours) coming straight at them: dive out of the way.
  checkVehicle(tp, dist) {
    const v = this.game.player.inVehicle;
    if (!v || this.dodgeT > 0 || this.isMonster || this.legless || dist > 25) return;
    const sp = v.speed || 0;
    if (Math.abs(sp) < 6 || v.flies) return;
    const f = v.fwd;
    const sign = sp > 0 ? 1 : -1;
    const rx = this.pos.x - v.pos.x;
    const rz = this.pos.z - v.pos.z;
    const along = (rx * f.x + rz * f.z) * sign;
    const side = rx * f.z - rz * f.x;
    const tHit = along / Math.abs(sp);
    if (along > 0 && tHit < 0.9 && Math.abs(side) < (v.halfWid || 1) + 1.3) {
      if (this.awareness < 0.4 && Math.random() < 0.6) return;
      const brave = this.cfg.melee ? 0.35 : 0.85;
      if (Math.random() > brave) return;
      const s = side >= 0 ? 1 : -1;
      this.dodgeX = f.z * s;
      this.dodgeZ = -f.x * s;
      this.dodgeT = 0.45;
      this.say('car', 'alarm');
    }
  }

  // ------------------------------------------------------------------ the gangster brain
  brain(dt, tp, dist) {
    const cfg = this.cfg;
    const mv = { x: 0, z: 0, speed: 0 };
    if (this.headless) return this.headlessBrain(dt, mv);
    if (this.armless && !cfg.melee) {
      // lost the gun hand: runs from you
      if (this.state !== 'flee') this.startFlee();
    }
    switch (this.state) {
      case 'patrol':
      case 'return':
        return this.patrolBrain(dt, mv);
      case 'suspicious':
        return this.suspiciousBrain(dt, mv, tp);
      case 'search':
        return this.searchBrain(dt, mv);
      case 'flee':
        return this.fleeBrain(dt, mv, tp, dist);
      default:
        return this.combatBrain(dt, mv, tp, dist);
    }
  }

  headlessBrain(dt, mv) {
    // wander aimlessly, bumping into things
    const fig = this.fig;
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 1 + Math.random() * 2;
      this.yawTarget = this.yaw + (Math.random() - 0.5) * 2.5;
    }
    this.yaw = dampAngle(this.yaw, this.yawTarget || this.yaw, 2, dt);
    mv.x = Math.sin(this.yaw);
    mv.z = Math.cos(this.yaw);
    mv.speed = this.cfg.walk * 0.8;
    mv.face = this.yaw;
    fig.stagger = 1;
    if (this.gunman) {
      mv.aim = true;
      fig.aim = 1;
      fig.aimYaw = Math.sin(this.blindT * 1.9) * 1.4;
      fig.aimPitch = Math.sin(this.blindT * 1.3) * 0.5;
      mv.aimYaw = fig.aimYaw;
      mv.aimAt = _t.set(this.pos.x + Math.sin(this.yaw) * 5, this.pos.y + 1.4 + Math.sin(this.blindT * 1.3) * 2.5, this.pos.z + Math.cos(this.yaw) * 5);
      fig.flail = 0;
    } else {
      fig.flail = 1;
      fig.aim = 0;
    }
    return mv;
  }

  patrolBrain(dt, mv) {
    const tdx = this.target.x - this.pos.x;
    const tdz = this.target.z - this.pos.z;
    const td = Math.hypot(tdx, tdz);
    if (td < 1.2 || this.stateT > 14) {
      this.pickPatrolTarget();
      this.stateT = 0;
      this.pause = Math.random() * 2.5;
      if (this.state === 'return') this.setState('patrol');
    }
    if (this.pause > 0) {
      this.pause -= dt;
      // look around while standing
      mv.face = this.yaw + Math.sin(this.game.time * 0.7 + this.id) * 0.02;
      return mv;
    }
    const dir = this.mgr.steerTo(this, this.target);
    mv.x = dir[0];
    mv.z = dir[1];
    mv.speed = this.cfg.walk * (this.onEdge > 0.3 ? 1.15 : 1);
    if (this.onEdge > 0.3) mv.aim = true;
    return mv;
  }

  // something caught the eye: stop, look, step closer carefully
  suspiciousBrain(dt, mv, tp) {
    const dx = this.target.x - this.pos.x;
    const dz = this.target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    mv.face = Math.atan2(dx, dz);
    mv.faceRate = 5;
    mv.aim = true;
    mv.aimAt = _t.set(this.target.x, this.target.y + 1.2, this.target.z);
    if (this.stateT > 0.8 && d > 3) {
      const dir = this.walkTo(this.target.x, this.target.z, 'investigate');
      if (dir) {
        mv.x = dir[0];
        mv.z = dir[1];
        mv.speed = this.cfg.walk * 0.85;
      }
    }
    if (this.awareness <= 0.05 || this.stateT > 9) {
      this.setState('return');
      this.target.copy(this.home);
      if (Math.random() < 0.4) this.say('giveup');
    }
    return mv;
  }

  searchBrain(dt, mv) {
    const sq = this.squad;
    const s = sq.search;
    const t = this.game.time;
    if (!s && this.joinT >= 0) return mv; // somebody spotted you: about to join the fight
    if ((!s || t > s.until) && this.faction === 'police' && this.game.police.hostile) {
      // the police don't give up while you're wanted: comb the area around the last report
      sq.search = null;
      sq.lastKnown.copy(this.game.police.lastSeen);
      sq.beginSearch();
      this.searchPt = null;
      return mv;
    }
    if (!s || t > s.until) {
      if (s && sq.search === s) {
        sq.search = null;
        sq.say(this, 'giveup');
      }
      this.onEdge = 1;
      this.setState('return');
      this.target.copy(this.home);
      return mv;
    }
    mv.aim = true;
    if (!this.searchPt || this.searchPt.done) {
      this.searchPt = sq.nextSearchPoint(this);
      this.lookT = 0;
      if (!this.searchPt) {
        // nothing left to check: wander around the last sighting
        this.searchPt = { x: sq.lastKnown.x + (Math.random() - 0.5) * 12, z: sq.lastKnown.z + (Math.random() - 0.5) * 12, done: false };
      }
      if (this.searchPt.hide && Math.random() < 0.6) sq.say(this, 'check');
    }
    const p = this.searchPt;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (d > (p.hide ? 1.4 : 1.8) && this.lookT === 0) {
      const dir = this.walkTo(p.x, p.z, 'search');
      if (dir) {
        mv.x = dir[0];
        mv.z = dir[1];
        mv.speed = this.cfg.walk * 1.3;
      } else p.done = true;
      mv.aimAt = _t.set(p.x, this.pos.y + 1.2, p.z);
    } else {
      // look around, gun up
      this.lookT += dt;
      mv.face = this.yaw + dt * 1.6 * (this.id % 2 ? 1 : -1) * 6;
      mv.faceRate = 2;
      mv.aimAt = _t.set(this.pos.x + Math.sin(this.yaw) * 6, this.pos.y + 1.2, this.pos.z + Math.cos(this.yaw) * 6);
      if (this.lookT > 1.8 + Math.random() * 1.5) {
        p.done = true;
        this.lookT = 0;
      }
    }
    return mv;
  }

  fleeBrain(dt, mv, tp, dist) {
    // away from you, toward somewhere you are not
    if (!this.path || this.stateT > 6) {
      const a = Math.atan2(this.pos.x - tp.x, this.pos.z - tp.z) + (Math.random() - 0.5) * 1.2;
      this.fleeGoal = this.fleeGoal || new THREE.Vector3();
      this.fleeGoal.set(this.pos.x + Math.sin(a) * 30, 0, this.pos.z + Math.cos(a) * 30);
      for (let i = 0; i < 6; i++) {
        const r = 40 + Math.random() * 25;
        const x = this.pos.x + Math.sin(a + i * 0.4) * r;
        const z = this.pos.z + Math.cos(a + i * 0.4) * r;
        if (this.game.world.nav.walkable(x, z)) {
          this.fleeGoal.set(x, 0, z);
          break;
        }
      }
      this.path = null;
      this.stateT = 0;
    }
    const dir = this.walkTo(this.fleeGoal.x, this.fleeGoal.z, 'flee');
    if (dir) {
      mv.x = dir[0];
      mv.z = dir[1];
    } else {
      mv.x = (this.pos.x - tp.x) / (dist || 1);
      mv.z = (this.pos.z - tp.z) / (dist || 1);
    }
    mv.speed = this.cfg.run * 1.05;
    this.fig.flail = this.armless ? 0.6 : 0;
    // gone for good once well away and out of sight
    if (dist > 60 && !this.sees) this.despawn = true;
    return mv;
  }

  startFlee() {
    this.setState('flee');
    this.path = null;
    this.say('flee', 'alarm');
  }

  startSearch() {
    const sq = this.squad;
    const first = !sq.search;
    sq.beginSearch();
    this.setState('search');
    this.searchPt = null;
    if (first) sq.say(this, 'lost');
  }

  startFlank() {
    this.tactic = 'flank';
    this.flankT = this.game.time;
    this.leaveCover();
    this.flankGoal = this.findFlank();
    this.note(`flank ${this.flankGoal ? this.flankGoal.x.toFixed(0) + ',' + this.flankGoal.z.toFixed(0) : 'none'}`);
    if (this.flankGoal) this.squad.say(this, 'flank');
    else {
      this.tactic = '';
      this.squad.flanker = null;
      this.squad.flankFailT = this.game.time;
    }
  }

  // ------------------------------------------------------------------ fighting
  combatBrain(dt, mv, tp, dist) {
    const cfg = this.cfg;
    const t = this.game.time;
    const sq = this.squad;
    const lostFor = t - sq.knowT;
    const T = this.sees ? tp : sq.lastKnown;
    // nobody has a clue where you went: go looking
    if (!this.sees && lostFor > 4.5 && t - this.seeT > 3.5) {
      this.startSearch();
      return mv;
    }
    if (this.morale < 0.1 && !cfg.melee) {
      this.startFlee();
      return mv;
    }
    if (this.decideT <= 0) this.decide(T, dist);
    if (cfg.melee) return this.rushBrain(dt, mv, tp, dist, T);
    switch (this.tactic) {
      case 'flank':
        return this.flankBrain(dt, mv, tp, dist, T);
      case 'cover':
      case 'retreat':
        return this.coverBrain(dt, mv, tp, dist, T);
      default:
        return this.standBrain(dt, mv, tp, dist, T);
    }
  }

  decide(T, dist) {
    const p = this.persona;
    this.decideT = 0.45 + Math.random() * 0.4;
    if (this.cfg.melee) {
      this.tactic = 'rush';
      return;
    }
    this.squad.assignRoles();
    if (this.tactic === 'flank') return;
    if (this.morale < 0.35 && this.tactic !== 'retreat') {
      // hurt and shaken: fall back to cover further away
      const c = this.findCover(T, 'retreat');
      if (c) {
        this.takeCover(c, 'retreat');
        this.say('hit');
        return;
      }
    }
    if (this.tactic === 'retreat' && this.morale > 0.55) this.tactic = 'cover';
    if (this.cover) {
      // stay put unless the spot is no good anymore or it is time to push
      const t = this.game.time;
      if (this.compromised(T)) {
        const c = this.findCover(T, 'engage');
        if (c) this.takeCover(c, 'cover');
        else {
          this.leaveCover();
          this.tactic = 'stand';
        }
        return;
      }
      const tooFar = Math.hypot(T.x - this.pos.x, T.z - this.pos.z) > this.prefRange() + 9;
      const restless = t - this.coverSince > 7 + p.patience * 10 && Math.random() < p.aggro * 0.5;
      if ((tooFar || restless) && this.inCover && this.tactic === 'cover' && t - this.squad.seenT < 10) {
        const c = this.findCover(T, 'advance');
        if (c) {
          this.takeCover(c, 'cover');
          if (p.taunts && Math.random() < 0.5) this.say('taunt');
        }
      }
      return;
    }
    const c = this.findCover(T, 'engage');
    if (c) {
      this.takeCover(c, 'cover');
      if (Math.random() < 0.35) this.squad.say(this, 'cover');
    } else this.tactic = 'stand';
  }

  // brutes: straight at you, weaving a little so you can't line up a clean shot
  rushBrain(dt, mv, tp, dist, T) {
    const cfg = this.cfg;
    const close = cfg.range * 0.8;
    if (this.sees && dist < close) {
      mv.face = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
    } else {
      const goal = this.sees ? tp : T;
      const dir = this.mgr.steerTo(this, goal, this.sees && dist < 14);
      const weave = this.sees && dist > 5 ? Math.sin(this.game.time * 2.3 + this.id) * 0.45 : 0;
      mv.x = dir[0] + dir[1] * weave;
      mv.z = dir[1] - dir[0] * weave;
      const l = Math.hypot(mv.x, mv.z) || 1;
      mv.x /= l;
      mv.z /= l;
      mv.speed = cfg.run;
      if (this.sees) mv.face = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
    }
    if (this.persona.taunts && this.sees && Math.random() < dt * 0.15) this.say('taunt');
    this.attack(dt, dist, tp);
    return mv;
  }

  // no cover around: hold ground, sidestep, shoot
  standBrain(dt, mv, tp, dist, T) {
    const cfg = this.cfg;
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = 0.8 + Math.random() * 1.6;
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      this.strafeOn = Math.random() < 0.6;
    }
    const fx = (T.x - this.pos.x) / (dist || 1);
    const fz = (T.z - this.pos.z) / (dist || 1);
    const d = Math.hypot(T.x - this.pos.x, T.z - this.pos.z);
    if (d > cfg.range * 0.7 || !this.sees) {
      const dir = this.walkTo(T.x, T.z, 'approach');
      if (dir) {
        mv.x = dir[0];
        mv.z = dir[1];
        mv.speed = this.sees ? cfg.walk * 1.2 : cfg.run * 0.8;
      }
    } else if (this.strafeOn) {
      mv.x = -fz * this.strafeDir;
      mv.z = fx * this.strafeDir;
      mv.speed = cfg.walk;
    }
    if (d < 5) {
      // too close for comfort: back off
      mv.x = -fx;
      mv.z = -fz;
      mv.speed = cfg.walk * 1.3;
    }
    mv.face = Math.atan2(T.x - this.pos.x, T.z - this.pos.z);
    mv.aim = true;
    mv.aimAt = this.aimPoint(T);
    if (this.sees) this.shoot(dt, tp, dist, 'aimed');
    else if (this.game.time - this.squad.seenT < 3) this.shoot(dt, T, d, 'suppress');
    this.reloadIfEmpty();
    return mv;
  }

  flankBrain(dt, mv, tp, dist, T) {
    const g = this.flankGoal;
    const cfg = this.cfg;
    if (!g) {
      this.tactic = '';
      return mv;
    }
    const d = Math.hypot(g.x - this.pos.x, g.z - this.pos.z);
    // arrived, or already has a clean shot from the side
    const angleOk = this.sees && this.flankAngle(tp) > 0.9 && dist < cfg.range * 0.85;
    if (d < 2 || angleOk || this.game.time - this.flankT > 20) {
      if (this.squad.flanker === this) this.squad.flanker = null;
      const c = this.findCover(T, 'engage', 10);
      this.note(`flank done (${d < 2 ? 'arrived' : angleOk ? 'angle' : 'timeout'})`);
      if (c) this.takeCover(c, 'cover');
      else this.tactic = 'stand';
      return mv;
    }
    const dir = this.walkTo(g.x, g.z, 'flank');
    if (!dir) {
      this.note('flank: no path');
      this.tactic = '';
      if (this.squad.flanker === this) this.squad.flanker = null;
      return mv;
    }
    mv.x = dir[0];
    mv.z = dir[1];
    mv.speed = cfg.run;
    return mv;
  }

  // angle (rad) between this guy and the rest of the squad, seen from you
  flankAngle(T) {
    const f = this.squad.fighters();
    let cx = 0;
    let cz = 0;
    let n = 0;
    for (const m of f) {
      if (m === this) continue;
      cx += m.pos.x;
      cz += m.pos.z;
      n++;
    }
    if (!n) return Math.PI;
    const a1 = Math.atan2(cx / n - T.x, cz / n - T.z);
    const a2 = Math.atan2(this.pos.x - T.x, this.pos.z - T.z);
    return Math.abs(angleDiff(a1, a2));
  }

  coverBrain(dt, mv, tp, dist, T) {
    const c = this.cover;
    const cfg = this.cfg;
    const t = this.game.time;
    if (!c) {
      this.tactic = '';
      this.decideT = 0;
      return mv;
    }
    const d = Math.hypot(c.x - this.pos.x, c.z - this.pos.z);
    if (!this.inCover) {
      // run for it (hotheads shoot on the move)
      if (d < 0.6) {
        this.inCover = true;
        this.coverSince = t;
        this.setPhase('hide');
      } else {
        const dir = this.walkTo(c.x, c.z, 'cover');
        if (!dir) {
          this.note('cover unreachable');
          c.badUntil = t + 12;
          this.leaveCover();
          this.decideT = 0.2;
          return mv;
        }
        mv.x = dir[0];
        mv.z = dir[1];
        mv.speed = cfg.run;
        if (this.persona.aggro > 0.8 && this.sees && dist < cfg.range) {
          mv.face = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
          mv.aim = true;
          mv.aimAt = this.aimPoint(tp);
          this.shoot(dt, tp, dist, 'moving');
        }
        return mv;
      }
    }
    // in cover: hide, pop out, shoot, duck back
    this.phaseT += dt;
    mv.face = Math.atan2(T.x - this.pos.x, T.z - this.pos.z);
    const peekX = c.low ? c.x : c.px;
    const peekZ = c.low ? c.z : c.pz;
    const at = this.coverPhase === 'peek' ? [peekX, peekZ] : [c.x, c.z];
    const ddx = at[0] - this.pos.x;
    const ddz = at[1] - this.pos.z;
    const dd = Math.hypot(ddx, ddz);
    if (dd > 0.15) {
      mv.x = ddx / dd;
      mv.z = ddz / dd;
      mv.speed = Math.min(cfg.walk * 1.4, dd * 6);
    }
    const knowRecent = t - this.squad.knowT < 5;
    if (this.coverPhase === 'hide') {
      mv.crouch = c.low;
      this.reloadIfEmpty();
      // cowards fire blind over the top now and then
      if (this.persona.blindfire && c.low && this.reloadT <= 0 && knowRecent && Math.random() < dt * 0.25) {
        this.shoot(dt, T, dist, 'blind', true);
      }
      if (this.phaseT > this.phaseLen && this.reloadT <= 0 && (knowRecent || this.sees) && this.tactic !== 'retreat') {
        if (this.mgr.takeToken(this)) this.setPhase('peek');
        else this.phaseT = this.phaseLen - 0.3;
      }
      if (this.tactic === 'retreat' && this.phaseT > 4 + this.persona.patience * 4) {
        this.tactic = 'cover';
        this.setPhase('hide');
      }
    } else {
      // peeking
      mv.aim = true;
      mv.crouch = false;
      mv.aimAt = this.aimPoint(this.sees ? tp : T);
      if (dd < 0.35) {
        if (this.sees) this.shoot(dt, tp, dist, 'aimed');
        else if (t - this.squad.seenT < 4 && this.persona.aggro > 0.3) this.shoot(dt, T, Math.hypot(T.x - this.pos.x, T.z - this.pos.z), 'suppress');
      }
      if (this.phaseT > this.phaseLen || this.mag <= 0 || (!this.sees && this.phaseT > 0.9 && t - this.squad.seenT > 4)) {
        this.setPhase('hide');
        this.tokenT = -1;
        this.tokenCoolT = t + 1.2;
      }
    }
    return mv;
  }

  setPhase(ph) {
    const p = this.persona;
    this.coverPhase = ph;
    this.phaseT = 0;
    if (ph === 'hide') this.phaseLen = 0.6 + p.patience * 2.2 + Math.random() * 1.2;
    else this.phaseLen = 1.4 + (1 - p.patience) * 1.6 + Math.random() * 0.8;
  }

  reloadIfEmpty() {
    if (this.mag > 0 || this.reloadT > 0) return;
    this.reloadT = this.cfg.reload || 2;
    if (Math.random() < 0.45) this.say('reload');
  }

  // where they like to fight from
  prefRange() {
    return clamp(this.cfg.range * 0.42, 9, 17) * (1.25 - this.persona.aggro * 0.5);
  }

  aimPoint(T) {
    const p = this.game.player;
    return _t.set(T.x, T.y + (p.inVehicle ? 1.0 : 1.2), T.z);
  }

  takeCover(c, tactic) {
    this.note(`${tactic} -> ${c.low ? 'low' : 'tall'} ${c.box.tag} @${c.x.toFixed(0)},${c.z.toFixed(0)}`);
    if (this.cover !== c) {
      this.leaveCover();
      this.cover = c;
      c.owner = this;
      this.inCover = false;
      this.path = null;
    }
    this.tactic = tactic;
    this.coverSince = this.game.time;
  }

  leaveCover() {
    if (this.cover && this.cover.owner === this) this.cover.owner = null;
    this.cover = null;
    this.inCover = false;
  }

  // is this spot still safe from where you are now?
  compromised(T) {
    const c = this.cover;
    if (!c) return true;
    if (this.game.time < this.checkT) return false;
    this.checkT = this.game.time + 0.5;
    const d = Math.hypot(T.x - c.x, T.z - c.z);
    if (d < 4) return true;
    if (!this.sees && this.game.time - this.squad.seenT > 1) return false;
    const p = this.game.player;
    const ty = p.inVehicle ? p.inVehicle.pos.y + 1.5 : T.y + 1.5;
    return !this.mgr.cover.shields(c, T.x, ty, T.z);
  }

  // Best cover point against a threat at T.
  //  engage:  hidden from T but with a clean shot when popping out, at a good range
  //  advance: like engage but closer than now
  //  retreat: hidden and further away
  findCover(T, mode, radius = 0) {
    const cm = this.mgr.cover;
    const R = radius || (mode === 'retreat' ? 24 : 17);
    const cands = cm.near(this.pos.x, this.pos.z, R, this.mgr._cands);
    const ex = this.pos.x;
    const ez = this.pos.z;
    const dT = Math.hypot(T.x - ex, T.z - ez) || 1;
    const pref = this.prefRange();
    const tx = (T.x - ex) / dT;
    const tz = (T.z - ez) / dT;
    const scored = this.mgr._scored;
    scored.length = 0;
    const now = this.game.time;
    for (const p of cands) {
      if (p.owner && p.owner !== this && p.owner.alive) continue;
      if (p.badUntil > now) continue;
      const dp = Math.hypot(p.x - T.x, p.z - T.z);
      if (dp < 4.5) continue;
      // facing: the point must have its obstacle between it and you
      if (((p.x - T.x) * p.nx + (p.z - T.z) * p.nz) / dp < 0.3) continue;
      const de = Math.hypot(p.x - ex, p.z - ez);
      let s = -de * 0.55 - Math.abs(dp - pref) * 0.45;
      if (mode === 'advance') {
        if (dp > dT - 3) continue;
        s += (dT - dp) * 0.6;
      } else if (mode === 'retreat') {
        if (dp < dT + 3) continue;
        s += (dp - dT) * 0.5;
      } else if (de > 3) {
        // don't run toward you to reach it
        const ux = (p.x - ex) / de;
        const uz = (p.z - ez) / de;
        if (ux * tx + uz * tz > 0.75) s -= 5;
      }
      if (!p.low) s += 1.5; // corners are safer than crouching behind a car
      p._s = s;
      scored.push(p);
    }
    scored.sort((a, b) => b._s - a._s);
    const p = this.game.player;
    const ty = p.inVehicle ? p.inVehicle.pos.y + 1.5 : T.y + 1.5;
    let best = null;
    let bestS = -1e9;
    const n = Math.min(scored.length, 10);
    for (let i = 0; i < n; i++) {
      const c = scored[i];
      if (!cm.shields(c, T.x, ty, T.z)) continue;
      let s = c._s;
      if (mode !== 'retreat') {
        if (cm.canShoot(c, T.x, ty - 0.3, T.z)) s += 7;
        else s -= 3;
      }
      if (s > bestS) {
        bestS = s;
        best = c;
      }
    }
    return best;
  }

  // A spot off to your side, well away from the line the rest of the crew is shooting along.
  findFlank() {
    const sq = this.squad;
    const T = sq.lastKnown;
    const nav = this.game.world.nav;
    const f = sq.fighters();
    let cx = 0;
    let cz = 0;
    for (const m of f) {
      cx += m.pos.x;
      cz += m.pos.z;
    }
    cx /= f.length || 1;
    cz /= f.length || 1;
    const a0 = Math.atan2(cx - T.x, cz - T.z);
    const col = this.game.world.collision;
    let best = null;
    let bestS = -1e9;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const off = Math.abs(angleDiff(a, a0));
      if (off < 0.85 || off > 2.3) continue;
      for (const r of [9, 13, 17]) {
        const x = T.x + Math.sin(a) * r;
        const z = T.z + Math.cos(a) * r;
        if (!nav.walkable(x, z)) continue;
        // must be able to see you from there
        if (!col.lineOfSight(x, 1.6, z, T.x, T.y + 1.3, T.z)) continue;
        const d = Math.hypot(x - this.pos.x, z - this.pos.z);
        if (d > 45) continue;
        const s = -d * 0.4 - Math.abs(off - 1.5) * 4 - Math.abs(r - 12) * 0.3;
        if (s > bestS) {
          bestS = s;
          best = [x, z];
        }
      }
    }
    if (!best) return null;
    // the walk there must not be a trek around the block
    const path = this.mgr.pf.find(this.pos.x, this.pos.z, best[0], best[1], 1800);
    if (!path) return null;
    let len = 0;
    let px = this.pos.x;
    let pz = this.pos.z;
    for (const w of path) {
      len += Math.hypot(w[0] - px, w[1] - pz);
      px = w[0];
      pz = w[1];
    }
    if (len > 55) return null;
    this.path = path;
    this.pathI = 0;
    this.pathGoal.set(best[0], 0, best[1]);
    this.pathT = this.game.time;
    return new THREE.Vector3(best[0], 0, best[1]);
  }

  // ------------------------------------------------------------------ moving around
  // Direction to walk toward (x, z) along a nav path, or null when there is no way.
  walkTo(x, z, kind) {
    const t = this.game.time;
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) return [0, 0];
    const pf = this.mgr.pf;
    const goalMoved = Math.hypot(this.pathGoal.x - x, this.pathGoal.z - z) > 1.5;
    if (!this.path || goalMoved || t - this.pathT > 6) {
      if (d < 6 && pf.clearWalk(this.pos.x, this.pos.z, x, z)) {
        this.path = [[x, z]];
      } else {
        const p = pf.find(this.pos.x, this.pos.z, x, z, kind === 'flee' ? 1800 : 2500);
        if (p === false) return [dx / d, dz / d]; // ask again next frame
        if (!p) {
          this.path = null;
          this.pathGoal.set(x, 0, z);
          this.pathT = t;
          return null;
        }
        this.path = p;
      }
      this.pathI = 0;
      this.pathGoal.set(x, 0, z);
      this.pathT = t;
    }
    const path = this.path;
    while (this.pathI < path.length - 1) {
      const w = path[this.pathI];
      if (Math.hypot(w[0] - this.pos.x, w[1] - this.pos.z) < 1.1) this.pathI++;
      else break;
    }
    const w = path[Math.min(this.pathI, path.length - 1)];
    const wx = w[0] - this.pos.x;
    const wz = w[1] - this.pos.z;
    const wl = Math.hypot(wx, wz) || 1;
    return [wx / wl, wz / wl];
  }

  onStuck() {
    this.note(`stuck (${this.state}/${this.tactic})`);
    this.path = null;
    this.pathT = -10;
    if (this.state === 'combat' && this.cover && !this.inCover) {
      this.cover.badUntil = this.game.time + 12;
      this.leaveCover();
      this.decideT = 0;
    } else if (this.state === 'search' && this.searchPt) this.searchPt.done = true;
    else if (this.state === 'patrol' || this.state === 'return') this.pickPatrolTarget();
  }

  pickPatrolTarget() {
    const t = this.territory;
    const nav = this.game.world.nav;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (t ? t.r : 20);
      const x = (t ? t.x : this.home.x) + Math.cos(a) * r;
      const z = (t ? t.z : this.home.z) + Math.sin(a) * r;
      if (nav.walkable(x, z)) {
        this.target.set(x, 0, z);
        return;
      }
    }
    this.target.copy(this.home);
  }

  // ------------------------------------------------------------------ attacks
  attack(dt, dist, tp) {
    const cfg = this.cfg;
    const game = this.game;
    if (!this.sees || this.headless) return;
    this.fireT -= dt;
    const range = this.armless ? 1.8 : cfg.range;
    if (dist < range + (game.player.inVehicle ? 1.6 : 0) && this.fireT <= 0) {
      this.fireT = cfg.interval;
      this.attackT = 0;
      this.pendingHit = { t: 0.16, dmg: this.armless ? 5 : cfg.dmg, range };
    }
  }

  // mode: aimed (clean shot) | moving | suppress (at where you were) | blind (over the top)
  shoot(dt, T, dist, mode, force = false) {
    const cfg = this.cfg;
    const game = this.game;
    if (!this.gunman || this.reloadT > 0) return;
    this.fireT -= dt;
    if (this.fireT > 0 && !force) return;
    if (this.mag <= 0) return;
    if (dist > cfg.range * (mode === 'suppress' ? 1.3 : 1.15)) return;
    if (mode === 'aimed' && this.aimT < this.persona.react) return;
    if (!force && !this.mgr.takeToken(this)) return;
    const hand = this.fig.j.handR;
    const p = game.player;
    const tgt = _v.set(T.x, T.y + (p.inVehicle ? 1.0 : 1.2), T.z);
    // a buddy in the line of fire: hold it and shuffle sideways
    if (mode !== 'blind' && this.mgr.allyInLine(this, hand, tgt)) {
      this.fireT = 0.3;
      this.strafeT = 0;
      return;
    }
    // inaccuracy: distance, your speed, how long they have been aiming, their skill, the situation
    const pv = p.inVehicle ? p.inVehicle.speedAbs || 0 : Math.hypot(p.vel.x, p.vel.z);
    const settle = 1 + 1.3 * Math.max(0, 1 - this.aimT / 1.6);
    const modeMul = mode === 'moving' ? 1.8 : mode === 'suppress' ? 2.6 : mode === 'blind' ? 6 : 1;
    const miss = (0.022 + dist * 0.0035 + pv * 0.012 + (this.legless ? 0.05 : 0)) * this.persona.aim * settle * modeMul;
    const dxx = tgt.x - hand.x;
    const dyy = tgt.y - hand.y + (mode === 'blind' ? 1.5 : 0);
    const dzz = tgt.z - hand.z;
    const l = Math.hypot(dxx, dyy, dzz) || 1;
    const dirx = dxx / l + (Math.random() - 0.5) * miss * 2;
    const diry = dyy / l + (Math.random() - 0.5) * miss * 2;
    const dirz = dzz / l + (Math.random() - 0.5) * miss * 2;
    const dl = Math.hypot(dirx, diry, dirz);
    const shotKind = cfg.gun === 'pen' ? 'ink' : cfg.gun === 'm4' ? 'paintball' : 'enemy';
    game.weapons.spawnEnemyShot(hand.x, hand.y, hand.z, dirx / dl, diry / dl, dirz / dl, cfg.dmg, cfg.gun === 'm4' ? 50 : 42, this.inCover && this.cover ? this.cover.box : null, shotKind);
    this.shots = (this.shots || 0) + 1;
    game.fx.muzzle(hand.x, hand.y, hand.z, 0.6);
    game.audio.play('enemyShot', clamp(1 - dist / 60, 0.15, 0.7));
    this.mag--;
    if (this.burstLeft <= 0) this.burstLeft = cfg.burst || 1;
    this.burstLeft--;
    this.fireT = this.burstLeft > 0 ? (cfg.burst > 2 ? cfg.interval : 0.28) : (cfg.pause || cfg.interval) * (0.8 + Math.random() * 0.5);
    if (mode === 'suppress' && Math.random() < 0.08) this.squad.say(this, 'suppress');
  }

  // ------------------------------------------------------------------ monsters (simple hunters)
  monsterBrain(dt, tp, dist) {
    const mv = { x: 0, z: 0, speed: 0 };
    const cfg = this.cfg;
    if (this.state === 'patrol' || this.state === 'return' || this.state === 'suspicious') return this.patrolBrain(dt, mv);
    if (this.state === 'search') {
      const d = Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z);
      if (d > 1.5) {
        const dir = this.mgr.steerTo(this, this.target);
        mv.x = dir[0];
        mv.z = dir[1];
        mv.speed = cfg.walk * 1.4;
      } else mv.face = this.yaw + dt * 1.2 * 8;
      if (this.stateT > 9) {
        this.setState('return');
        this.target.copy(this.home);
      }
      return mv;
    }
    // combat: hunt
    if (!this.sees && this.game.time - this.seeT > 2.5) {
      this.setState('search');
      this.target.copy(this.lastSeen);
      return mv;
    }
    const close = cfg.range * 0.8;
    if (!(this.sees && dist < close)) {
      const goal = this.sees ? tp : this.lastSeen;
      const dir = this.mgr.steerTo(this, goal, this.sees && dist < 14);
      mv.x = dir[0];
      mv.z = dir[1];
      mv.speed = cfg.run;
    }
    mv.face = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
    this.attack(dt, dist, tp);
    return mv;
  }

  // ------------------------------------------------------------------ getting hurt
  onHurt(lostPart) {
    const t = this.game.time;
    this.hurtT = t;
    this.morale -= lostPart ? 0.32 : 0.14 * (1.2 - this.persona.courage * 0.5);
    if (lostPart === 'armR' || lostPart === 'armL') this.say('arm', 'alarm');
    else if (lostPart === 'legL' || lostPart === 'legR') this.say('leg', 'alarm');
    else if (Math.random() < 0.4) this.say('hit', 'alarm');
    // being hit in the open sends you looking for cover right away
    if (this.state === 'combat' && !this.inCover && !this.cfg.melee) this.decideT = 0;
    if (this.inCover && this.coverPhase === 'peek' && this.persona.courage < 0.7) {
      this.setPhase('hide');
      this.tokenT = -1;
    }
  }

  draw(camPos) {
    this.fig.draw(camPos);
    if (this.glueT > 0 && this.dying < 0) {
      // a puddle of hot glue around the feet, strings of it up the legs
      const fr = this.game.figures;
      const p = this.pos;
      const a = Math.min(1, this.glueT);
      for (let i = 0; i < 5; i++) {
        const an = i * 1.256 + this.id;
        const r = 0.42 + 0.12 * Math.sin(i * 2.1);
        fr.lineXYZ(p.x + Math.cos(an) * r, p.y + 0.04, p.z + Math.sin(an) * r, p.x + Math.cos(an + 1.3) * r, p.y + 0.04, p.z + Math.sin(an + 1.3) * r, [0.96, 0.96, 0.93], 9, this.id + i, 0.9 * a, 0.02, 0);
      }
      const j = this.fig.j;
      for (const k of [j.kneeL, j.kneeR]) fr.lineXYZ(k.x, k.y, k.z, k.x + 0.05, p.y + 0.05, k.z, [0.96, 0.96, 0.93], 4, this.id + 7, 0.7 * a, 0.03, 0);
    }
    if (this.isMonster || this.dying >= 0) return;
    // held weapon
    const fr = this.game.figures;
    const j = this.fig.j;
    if (this.fig.parts.armR < 0.5) return;
    const h = j.handR;
    if (this.cfg.unarmed) return;
    if (this.cfg.club === 'eraser') {
      // the big two-tone school eraser
      const d = _v.copy(j.handR).sub(j.elbowR).normalize();
      fr.lineXYZ(h.x, h.y, h.z, h.x + d.x * 0.16, h.y + d.y * 0.16, h.z + d.z * 0.16, ERASER_PINK, 15, this.id, 1, 0.004, 0);
      fr.lineXYZ(h.x + d.x * 0.16, h.y + d.y * 0.16, h.z + d.z * 0.16, h.x + d.x * 0.32, h.y + d.y * 0.32, h.z + d.z * 0.32, ERASER_BLUE, 15, this.id + 1, 1, 0.004, 0);
      fr.lineXYZ(h.x + d.x * 0.13, h.y + d.y * 0.13, h.z + d.z * 0.13, h.x + d.x * 0.19, h.y + d.y * 0.19, h.z + d.z * 0.19, [0.96, 0.95, 0.9], 16, this.id + 2, 1, 0.004, 0);
      return;
    }
    if (this.cfg.gun === 'pen') {
      const d = this.fig.aim ? this.fig.aimDir : _v.copy(j.handR).sub(j.elbowR).normalize();
      fr.lineXYZ(h.x - d.x * 0.06, h.y - d.y * 0.06 + 0.03, h.z - d.z * 0.06, h.x + d.x * 0.26, h.y + d.y * 0.26 + 0.03, h.z + d.z * 0.26, [0.8, 0.86, 0.94], 6.5, this.id, 1, 0.006, 0);
      fr.lineXYZ(h.x - d.x * 0.04, h.y - d.y * 0.04 + 0.03, h.z - d.z * 0.04, h.x + d.x * 0.22, h.y + d.y * 0.22 + 0.03, h.z + d.z * 0.22, PEN_BLUE, 2.2, this.id + 1, 1, 0.006, 0);
      fr.lineXYZ(h.x, h.y, h.z, h.x, h.y - 0.1, h.z, [0.16, 0.18, 0.24], 5, this.id + 2, 1, 0.01, 0);
      return;
    }
    if (this.cfg.gun === 'm4') {
      const d = this.fig.aim ? this.fig.aimDir : _v.copy(j.handR).sub(j.elbowR).normalize();
      fr.lineXYZ(h.x - d.x * 0.3, h.y - d.y * 0.3, h.z - d.z * 0.3, h.x + d.x * 0.42, h.y + d.y * 0.42, h.z + d.z * 0.42, [0.26, 0.27, 0.31], 6, this.id, 1, 0.006, 0);
      fr.lineXYZ(h.x + d.x * 0.42, h.y + d.y * 0.42, h.z + d.z * 0.42, h.x + d.x * 0.62, h.y + d.y * 0.62, h.z + d.z * 0.62, [0.26, 0.27, 0.31], 2.4, this.id + 1, 1, 0.006, 0);
      fr.lineXYZ(h.x + d.x * 0.08, h.y + d.y * 0.08, h.z + d.z * 0.08, h.x + d.x * 0.1, h.y + d.y * 0.1 - 0.12, h.z + d.z * 0.1, [0.95, 0.35, 0.6], 6, this.id + 2, 1, 0.006, 0);
      return;
    }
    if (this.cfg.melee) {
      const d = _v.copy(j.handR).sub(j.elbowR).normalize();
      fr.lineXYZ(h.x - d.x * 0.1, h.y - d.y * 0.1, h.z - d.z * 0.1, h.x + d.x * 0.85, h.y + d.y * 0.85, h.z + d.z * 0.85, [0.35, 0.25, 0.2], 7, this.id, 1, 0.02, 0);
    } else {
      const d = this.fig.aim ? this.fig.aimDir : _v.copy(j.handR).sub(j.elbowR).normalize();
      fr.lineXYZ(h.x, h.y, h.z, h.x + d.x * 0.32, h.y + d.y * 0.32, h.z + d.z * 0.32, BLACK_INK, 5.5, this.id, 1, 0.01, 0);
      fr.lineXYZ(h.x, h.y, h.z, h.x, h.y - 0.13, h.z, BLACK_INK, 4.5, this.id + 1, 1, 0.01, 0);
    }
  }
}

/**
 * Spawns gangs and monsters around the player from district territories, runs their AI,
 * resolves hits against body parts and handles erasing.
 */
export class Enemies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.territories = game.world.territories.map((t) => ({ ...t, alive: 0, cooldown: 0, squad: null }));
    this.flow = null;
    this.flowT = 0;
    this.flowDist = new Float32Array(game.world.nav.w * game.world.nav.h);
    this.rng = new RNG(1337);
    this.kills = 0;
    this.spawnT = 0;
    this.cover = new CoverMap(game.world.collision);
    this.pf = new PathFinder(game.world.nav);
    this.squads = [];
    this._cands = [];
    this._scored = [];
  }

  reset() {
    for (const e of this.list) e.dispose();
    this.list = [];
    for (const t of this.territories) {
      t.alive = 0;
      t.cooldown = 0;
      t.squad = null;
    }
    this.squads = [];
  }

  squadFor(territory, x, z, faction = 'gang') {
    if (territory) {
      if (!territory.squad) {
        territory.squad = new Squad(this, new THREE.Vector3(territory.x, 0, territory.z), territory);
        this.squads.push(territory.squad);
      }
      return territory.squad;
    }
    // loose guys join whoever is close, or start their own crew
    for (const s of this.squads) {
      if (!s.territory && s.faction === faction && Math.hypot(s.home.x - x, s.home.z - z) < 30) return s;
    }
    const s = new Squad(this, new THREE.Vector3(x, 0, z), null);
    s.faction = faction;
    this.squads.push(s);
    return s;
  }

  typeFor(kind) {
    if (kind === 'crim') return this.rng.pick(['thug', 'thug', 'mask', 'mob']);
    if (kind === 'brute') return 'brute';
    return this.rng.pick(['scrib', 'scrib', 'stalk', 'spike']);
  }

  spawnIn(t) {
    const game = this.game;
    const nav = game.world.nav;
    const p = game.player.pos;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * t.r;
      const x = t.x + Math.cos(a) * r;
      const z = t.z + Math.sin(a) * r;
      if (!nav.walkable(x, z)) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < 24) continue;
      if (d < 45 && game.world.collision.lineOfSight(p.x, p.y + 1.6, p.z, x, 1.5, z)) continue;
      const kind = t.kinds[Math.floor(Math.random() * t.kinds.length)];
      const e = new Enemy(this, this.typeFor(kind), x, z, t);
      e.pickPatrolTarget();
      this.list.push(e);
      t.alive++;
      return e;
    }
    return null;
  }

  // an officer getting out of a patrol car, already after you
  spawnOfficer(type, x, z, look, where) {
    const e = new Enemy(this, type, x, z, null, look);
    e.home.set(x, 0, z);
    e.lastSeen.copy(where);
    e.squad.lastKnown.copy(where);
    e.squad.knowT = this.game.time;
    e.awareness = 1;
    this.list.push(e);
    e.enterCombat(false);
    if (Math.random() < 0.6) e.say('spot', 'cop');
    return e;
  }

  // the driver you just pulled out of the car wants it back
  spawnAngry(x, z, look) {
    const e = new Enemy(this, 'driver', x, z, null, look);
    e.home.set(x, 0, z);
    e.lastSeen.copy(this.game.player.pos);
    e.squad.lastKnown.copy(this.game.player.pos);
    e.squad.knowT = this.game.time;
    e.awareness = 1;
    this.list.push(e);
    e.enterCombat(true);
    return e;
  }

  debugSpawn(type, x, z, yaw = 0) {
    const e = new Enemy(this, type, x, z, null);
    e.yaw = yaw;
    e.pickPatrolTarget();
    this.list.push(e);
    return e;
  }

  // Reinforcements answer a call: they show up out of sight and come in already fighting.
  backup(caller, where) {
    const game = this.game;
    const nav = game.world.nav;
    const sq = caller.squad;
    const p = game.player.pos;
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    let made = 0;
    const alive = this.list.filter((e) => e.alive).length;
    for (let tries = 0; tries < 30 && made < n && alive + made < 24; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 18;
      const x = caller.pos.x + Math.cos(a) * r;
      const z = caller.pos.z + Math.sin(a) * r;
      if (!nav.walkable(x, z)) continue;
      if (Math.hypot(x - p.x, z - p.z) < 26) continue;
      if (game.world.collision.lineOfSight(p.x, p.y + 1.6, p.z, x, 1.5, z)) continue;
      const kinds = sq.territory ? sq.territory.kinds.filter((k) => k !== 'monster') : ['crim'];
      const e = new Enemy(this, this.typeFor(kinds.length ? kinds[Math.floor(Math.random() * kinds.length)] : 'crim'), x, z, sq.territory);
      e.home.copy(sq.home);
      e.lastSeen.copy(where);
      e.awareness = 1;
      e.joinT = game.time + 0.2;
      this.list.push(e);
      made++;
    }
    // crews nearby hear the shouting too and come to look
    for (const other of this.squads) {
      if (other === sq || Math.hypot(other.home.x - where.x, other.home.z - where.z) > 90) continue;
      other.lastKnown.copy(where);
      other.knowT = game.time;
      for (const m of other.members) {
        if (m.alive && !m.headless && (m.state === 'patrol' || m.state === 'return')) {
          m.awareness = Math.max(m.awareness, 0.6);
          m.target.copy(where);
          m.setState('suspicious');
          m.stateT = -4; // keeps going longer than a casual look
        }
      }
    }
  }

  // At most a few of them shoot at you at the same time; the rest move, hide or reload.
  takeToken(e) {
    const t = this.game.time;
    if (e.tokenT > t) return true;
    if (e.tokenCoolT > t) return false;
    let held = 0;
    let fighting = 0;
    for (const o of this.list) {
      if (!o.alive) continue;
      if (o.state === 'combat') fighting++;
      if (o !== e && o.tokenT > t) held++;
    }
    const max = fighting >= 6 ? 3 : 2;
    if (held >= max) return false;
    e.tokenT = t + 2.4;
    e.tokenCoolT = t + 2.4 + 1.2; // then let somebody else have a go
    return true;
  }

  allyInLine(e, from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const L2 = dx * dx + dz * dz || 1;
    for (const o of this.list) {
      if (o === e || !o.alive || o.isMonster) continue;
      const t = ((o.pos.x - from.x) * dx + (o.pos.z - from.z) * dz) / L2;
      if (t <= 0.02 || t >= 0.98) continue;
      const px = from.x + dx * t - o.pos.x;
      const pz = from.z + dz * t - o.pos.z;
      if (px * px + pz * pz < 0.7 * 0.7) return true;
    }
    return false;
  }

  // a shot, a crash, an explosion: whoever hears it reacts
  noise(pos, radius, kind = 'shot') {
    const t = this.game.time;
    if (this.game.ambient) this.game.ambient.scare(pos, radius * 0.6);
    for (const e of this.list) {
      if (!e.alive || e.headless || e.state === 'flee') continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d > radius) continue;
      const err = d * 0.08;
      if (e.state === 'combat') {
        // they hear where the shots come from
        if (!e.sees && kind === 'shot') {
          e.squad.lastKnown.set(pos.x + (Math.random() - 0.5) * err, pos.y, pos.z + (Math.random() - 0.5) * err);
          e.squad.knowT = t;
        }
        continue;
      }
      e.awareness = Math.min(1, e.awareness + (kind === 'boom' ? 0.8 : 0.45) * (1 - d / radius) + 0.2);
      e.lastSeen.set(pos.x + (Math.random() - 0.5) * err, pos.y, pos.z + (Math.random() - 0.5) * err);
      if (e.awareness >= 1 && d < radius * 0.5) {
        e.squad.lastKnown.copy(e.lastSeen);
        e.squad.knowT = t;
        e.enterCombat(false);
      } else {
        e.target.copy(e.lastSeen);
        e.setState('suspicious');
        e.stateT = 0;
      }
    }
  }

  // your shot flew past their ear
  whiz(ox, oy, oz, dx, dy, dz) {
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1e-6) return;
    const p = this.game.player;
    for (const e of this.list) {
      if (!e.alive || e.isMonster || e.headless) continue;
      const cy = e.pos.y + 1.3;
      const t = clamp(((e.pos.x - ox) * dx + (cy - oy) * dy + (e.pos.z - oz) * dz) / len2, 0, 1);
      const px = ox + dx * t - e.pos.x;
      const py = oy + dy * t - cy;
      const pz = oz + dz * t - e.pos.z;
      if (px * px + py * py + pz * pz > 2.2 * 2.2) continue;
      if (e.state !== 'combat') {
        e.awareness = 1;
        e.lastSeen.copy(p.pos);
        e.squad.lastKnown.copy(p.pos);
        e.squad.knowT = this.game.time;
        e.enterCombat(false);
        if (!e.squad.say(e, 'cover', 'alarm')) e.say('cover', 'alarm');
      } else if (!e.inCover && !e.cfg.melee) e.decideT = 0;
      e.morale -= 0.025;
    }
  }

  allyDown(dead) {
    let told = false;
    for (const m of dead.squad.members) {
      if (m === dead || !m.alive) continue;
      const d = Math.hypot(m.pos.x - dead.pos.x, m.pos.z - dead.pos.z);
      if (d > 30) continue;
      m.morale -= 0.2 * (1.2 - m.persona.courage);
      if (!told && !m.headless && m.say('down', 'alarm')) told = true;
      if (m.state !== 'combat' && m.state !== 'flee') {
        m.lastSeen.copy(this.game.player.pos);
        m.squad.lastKnown.copy(this.game.player.pos);
        m.squad.knowT = this.game.time;
        m.enterCombat(false);
      }
    }
  }

  steerTo(e, goal, direct = false) {
    const dx = goal.x - e.pos.x;
    const dz = goal.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    if (direct || d < 4) return [dx / d, dz / d];
    // follow the flow field toward the player when chasing, else local A-less greedy steering
    const nav = this.game.world.nav;
    if (this.flow && this.flowGoalNear(goal)) {
      const dir = nav.descend(this.flowDist, e.pos.x, e.pos.z);
      if (dir) return dir;
    }
    // greedy with a probe: if blocked straight ahead, try rotated directions
    const probes = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
    for (const a of probes) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const ux = (dx / d) * c - (dz / d) * s;
      const uz = (dx / d) * s + (dz / d) * c;
      if (nav.walkable(e.pos.x + ux * 2.5, e.pos.z + uz * 2.5)) return [ux, uz];
    }
    return [dx / d, dz / d];
  }

  flowGoalNear(goal) {
    return this.flowGoal && Math.hypot(goal.x - this.flowGoal.x, goal.z - this.flowGoal.z) < 6;
  }

  update(dt) {
    const game = this.game;
    const p = game.anchorPos();
    this.pf.resetBudget();
    // flow field toward the player for the ones charging straight in
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = 0.4;
      const chasing = this.list.some((e) => e.alive && e.state === 'combat' && (e.isMonster || e.cfg.melee));
      if (chasing) {
        game.world.nav.flowFrom(p.x, p.z, 80, this.flowDist);
        this.flow = true;
        this.flowGoal = p.clone();
      } else this.flow = null;
    }
    // spawning / despawning
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.7;
      let active = this.list.filter((e) => e.alive).length;
      const maxActive = game.touch ? 14 : 20;
      for (const t of this.territories) {
        if (t.cooldown > 0) t.cooldown -= 0.7;
        const d = Math.hypot(t.x - p.x, t.z - p.z);
        if (d < 120 && t.alive < t.count && t.cooldown <= 0 && active < maxActive) {
          if (this.spawnIn(t)) {
            active++;
            t.cooldown = 1.5;
          }
        }
      }
      for (const e of this.list) {
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
        if (d > 170 && e.state !== 'combat') e.despawn = true;
        // bystanders who calmed down go about their day; officers when the chase is off
        if ((e.faction === 'civ' || (e.faction === 'police' && !game.police.hostile)) && e.state !== 'combat' && d > 45) e.despawn = true;
      }
    }
    // separation
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive) continue;
      for (let k = i + 1; k < L.length; k++) {
        const b = L[k];
        if (!b.alive) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const r = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (r - d) * 0.5;
          a.pos.x -= (dx / d) * push;
          a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push;
          b.pos.z += (dz / d) * push;
        }
      }
    }
    const keep = [];
    for (const e of L) {
      e.update(dt);
      if (e.doneDying || e.despawn) {
        if (e.territory) {
          e.territory.alive = Math.max(0, e.territory.alive - 1);
          if (!e.despawn) e.territory.cooldown = 45 + Math.random() * 40;
        }
        e.dispose();
        continue;
      }
      keep.push(e);
    }
    this.list = keep;
    // forget crews with nobody left
    if (this.squads.length > 40) this.squads = this.squads.filter((s) => s.members.length || s.territory);
  }

  draw(camPos) {
    for (const e of this.list) {
      const d = Math.hypot(e.pos.x - camPos.x, e.pos.z - camPos.z);
      e.fig.setVisible(d < 200);
      if (d < 200) e.draw(camPos);
    }
  }

  // ------------------------------------------------------------------ hit tests
  segmentHit(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return null;
    const len2 = dx * dx + dz * dz;
    const ro = _ro.set(ox, oy, oz);
    const rd = _rd.set(dx / len, dy / len, dz / len);
    for (const e of this.list) {
      if (!e.alive) continue;
      const ex = e.pos.x;
      const ez = e.pos.z;
      const cx = ox + dx * 0.5;
      const cz = oz + dz * 0.5;
      const reach = Math.sqrt(len2) * 0.5 + 3;
      if (Math.abs(ex - cx) > reach || Math.abs(ez - cz) > reach) continue;
      let t = len2 > 1e-8 ? ((ex - ox) * dx + (ez - oz) * dz) / len2 : 0;
      t = Math.max(0, Math.min(maxT, t));
      const px = ox + dx * t;
      const py = oy + dy * t;
      const pz = oz + dz * t;
      if (e.isMonster) {
        const c = e.fig.center;
        const r = e.radius;
        const ddx = px - c.x;
        const ddy = (py - c.y) * 0.8;
        const ddz = pz - c.z;
        if (ddx * ddx + ddy * ddy + ddz * ddz < r * r) {
          if (!best || t < best.t) best = { t, enemy: e, part: 'body' };
        }
        continue;
      }
      if (Math.hypot(px - ex, pz - ez) > e.radius + 0.9) continue;
      // exact hit on the drawn body (shots pass through erased holes)
      const h = e.fig.raycast(ro, rd, maxT * len);
      if (h && (!best || h.t / len < best.t)) best = { t: h.t / len, enemy: e, part: h.part, point: h.point };
    }
    return best;
  }

  rayHit(o, dir, maxT) {
    const h = this.segmentHit(o.x, o.y, o.z, dir.x * maxT, dir.y * maxT, dir.z * maxT, 1);
    if (!h) return null;
    return { t: h.t * maxT, enemy: h.enemy };
  }

  inArc(pos, fwd, range, halfAngle) {
    const out = [];
    for (const e of this.list) {
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x;
      const dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.radius) continue;
      const a = Math.acos(clamp((dx * fwd.x + dz * fwd.z) / (d || 1), -1, 1));
      if (a < halfAngle || d < 0.9) out.push(e);
    }
    return out;
  }

  // ------------------------------------------------------------------ damage
  damage(e, part, amount, point, dir, kind) {
    if (!e.alive) return;
    const game = this.game;
    const fx = game.fx;
    game.hud.hitMarker();
    if (e.faction === 'police') game.onCrime('hurtCop', e.pos.x, e.pos.z);
    else if (e.faction === 'civ') game.onCrime('hurtCiv', e.pos.x, e.pos.z);
    if (e.state !== 'combat' && e.state !== 'flee') {
      // they know roughly where that came from
      e.lastSeen.copy(game.player.pos);
      e.seeT = game.time;
      e.awareness = 1;
      e.squad.lastKnown.copy(game.player.pos);
      e.squad.knowT = game.time;
      e.enterCombat(false);
    }
    e.flinch = 0.25;
    if (dir) e.knock(dir.x * (kind === 'melee' ? 4 : 1.2), dir.z * (kind === 'melee' ? 4 : 1.2));
    fx.crumbs(point.x, point.y, point.z, kind === 'paint' ? 4 : 9, 2.5);
    if (e.isMonster) {
      e.hp -= amount;
      // punch an eraser hole into the scribble at the hit point
      const c = e.fig.center;
      const cam = game.camera;
      const right = _v.set(1, 0, 0).applyQuaternion(cam.quaternion);
      const u = 0.5 + ((point.x - c.x) * right.x + (point.z - c.z) * right.z) / e.fig.cfg.w;
      const v = 0.5 + (point.y - c.y) / e.fig.cfg.h;
      e.fig.addHole(clamp(u, 0.1, 0.9), clamp(v, 0.1, 0.9), 0.08 + Math.min(0.2, amount / 220));
      game.audio.play('erase', 0.5);
      if (e.hp <= 0) this.kill(e);
      return;
    }
    const fig = e.fig;
    const r = holeRadius(kind, amount) / Math.cbrt(e.cfg.armor || 1);
    const at = point || fig.center;
    const res = fig.erase(at, r);
    game.audio.play('erase', 0.55);
    const lost = res ? this.checkParts(e, res.part, at) : null;
    if (e.alive) e.onHurt(lost);
  }

  // parts that lost enough ink disappear; the body reacts to what is missing
  checkParts(e, part, at) {
    const game = this.game;
    const fx = game.fx;
    const fig = e.fig;
    let lost = null;
    if (fig.parts[part] > 0.5 && fig.erased[part] >= REMOVE_AT[part]) {
      fig.removePart(part);
      lost = part;
      const j = fig.j;
      const c = part === 'head' ? j.headC : part === 'armR' ? j.elbowR : part === 'armL' ? j.elbowL : part === 'legR' ? j.kneeR : part === 'legL' ? j.kneeL : fig.center;
      fx.crumbs(c.x, c.y, c.z, 24, 3.4);
      fx.smoke(c.x, c.y, c.z, 0.7);
      game.audio.play('erase', 1);
      if (part === 'head') {
        if (!this.headlessShown) game.hud.toast('נמחק לו הראש! עכשיו הוא לא רואה כלום', 'good', 1.6);
        this.headlessShown = true;
        e.leaveCover();
        e.tactic = '';
      }
      if (part === 'armR' && !e.cfg.melee) {
        game.dropWeapon && game.dropWeapon(e);
      }
      if (part === 'torso') {
        this.kill(e, 'split');
        return lost;
      }
    }
    let inkLost = 0;
    for (const k in INK_WEIGHT) inkLost += (fig.parts[k] < 0.5 ? 1 : fig.erased[k]) * INK_WEIGHT[k];
    const P = fig.parts;
    if (inkLost >= 1.7 || (P.legL + P.legR + P.armL + P.armR < 0.5) || (e.headless && fig.erased.torso > 0.3)) this.kill(e);
    return lost;
  }

  kill(e, how) {
    if (!e.alive) return;
    e.dying = 0;
    e.leaveCover();
    if (e.squad.flanker === e) e.squad.flanker = null;
    if (!e.isMonster && how === 'split') {
      e.fig.split = 0;
      e.fig.splitDir = Math.random() < 0.5 ? 1 : -1;
      e.fig.parts.torso = 0;
      e.fig.speed = Math.max(e.fig.speed, 1.5);
    }
    this.kills++;
    const fx = this.game.fx;
    fx.crumbs(e.pos.x, e.pos.y + 1.1, e.pos.z, 34, 3.5);
    fx.smoke(e.pos.x, e.pos.y + 1.0, e.pos.z, 1.6);
    this.game.audio.play('erase', 1);
    if (!e.isMonster) this.allyDown(e);
    const crime = e.faction === 'police' ? 'killCop' : e.faction === 'civ' ? 'killCiv' : e.faction === 'gang' ? 'killGang' : null;
    if (crime) this.game.onCrime(crime, e.pos.x, e.pos.z);
    this.game.onEnemyKilled(e);
  }

  explosion(x, y, z, radius, damage) {
    for (const e of this.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.y + 1 - y, e.pos.z - z);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const dmg = damage * (0.35 + 0.65 * f);
      const dir = new THREE.Vector3(e.pos.x - x, 0, e.pos.z - z).normalize();
      if (e.isMonster) {
        this.damage(e, 'body', dmg, new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z), dir, 'blast');
      } else {
        // a blast rubs out big chunks on the side facing it
        const fig = e.fig;
        const n = 2 + Math.round(f * 3);
        let lost = null;
        for (let i = 0; i < n && e.alive; i++) {
          fig.ensureShapes();
          const s2 = fig.shapes[Math.floor(Math.random() * fig.shapes.length)];
          if (!s2) break;
          _sp.set(x, y, z).lerp(s2.c, 0.92);
          fig.closestSurfacePoint(_sp, _sp);
          const res = fig.erase(_sp, 0.12 + 0.2 * f + Math.random() * 0.08);
          if (res) lost = this.checkParts(e, res.part, _sp) || lost;
        }
        if (e.alive) {
          this.game.hud.hitMarker();
          if (e.state !== 'combat') {
            e.awareness = 1;
            e.lastSeen.copy(this.game.player.pos);
            e.squad.lastKnown.copy(this.game.player.pos);
            e.squad.knowT = this.game.time;
            e.enterCombat(false);
          }
          e.onHurt(lost);
          e.morale -= 0.15;
        }
      }
      e.knock(dir.x * 9 * f, dir.z * 9 * f);
    }
  }
}

export { TYPES };
