import * as THREE from 'three';
import { tr } from '../core/lang.js';
import { groundHeight } from '../world/layout.js';
import { cityLook, roleLook } from './looks.js';
import { Bout, BoxAI, PROFILES, LADDER, MOVES, comboMoves, Rand } from './boxsim.js';
import { newBox } from './boxrig.js';
import { BoxingHud } from '../ui/boxinghud.js';

// (ROADMAP 29.5) The boxing gym's ring: a bout you really fight. The numbers of it are game/boxsim.js (the frame data, the
// rounds, the count, the man on the other side); the bodies game/boxrig.js (through game/doodle.js); the screen ui/boxinghud.js.
// Here it is put into the city: you and him on the canvas, your stick and your buttons into your fighter, the camera from the
// side, the hits felt - a stop of the picture as long as the blow is heavy, the camera shaken, a flash, the sweat, the head
// snapped, a deep punch never twice the same; the crowd on its feet at the big moments, the picture slowed for a counter and
// for the blow that puts him down. No police, no crimes, nothing of your health in the city: the bout has its own, and losing
// it costs nothing but the bout. And the gym's work (training): the mitts with a coach calling the combos (it teaches the
// buttons), the heavy bag (power), the speed bag (rhythm) - what you train kept in the browser and brought into every bout.
//
// For game/game.js (the gym calls startBout / startTraining):
//   construct:  this.boxing = this.classic ? null : new Boxing(this);
//   time:       if (this.boxing) dt *= this.boxing.timeK(this.realDt);          (with the other timeK lines)
//   update:     if (this.boxing) this.boxing.update(dt);                        (just before player.update)
//   camera:     ... || (this.boxing && this.boxing.camOpts())                   (in the `ro` line)
//   draw:       if (this.boxing) this.boxing.draw();                            (after this.civilians.draw)

const KEY = 'scribble-city-v5-boxing';
// (the keys a bout keeps to itself - core/input.js grab: nothing else in the game is pressed by them while it lasts)
const GRAB = new Set(['KeyJ', 'KeyK', 'KeyL', 'KeyI', 'KeyQ', 'KeyE', 'KeyC', 'KeyF', 'KeyG', 'KeyT', 'KeyM', 'KeyP', 'KeyH', 'KeyX', 'KeyV', 'KeyR', 'KeyB', 'Space', 'Backspace', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'BoxJab', 'BoxCross', 'BoxHook', 'BoxUpper', 'BoxSlipL', 'BoxSlipR', 'BoxDuck', 'BoxQuit', 'BoxTap']);
// (the pad: X jab, Y cross, A hook, B uppercut, RT the guard, LB / RB slips, LT the duck - core/gamepad.js's numbering)
const PAD = { jab: 2, cross: 3, hook: 0, upper: 1, guard: 7, slipL: 4, slipR: 5, duck: 6, quit: 8 };
const GLOVE_YOU = [0.78, 0.09, 0.1];
const CUFF = [0.93, 0.92, 0.88];
const PAD_COL = [0.12, 0.12, 0.15];
const PAD_RED = [0.8, 0.14, 0.12];
const SWEAT = [[0.82, 0.92, 1.0], [0.95, 0.98, 1.0], [0.7, 0.85, 0.95]];
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// (a glove lit a step at a time - the colours made once each, the renderer keeps each colour's own: render/people.js linC)
const LIT = [1, 0.95, 0.72];
const TINTS = new Map();
function tints(col) {
  let t = TINTS.get(col);
  if (!t) {
    t = [0, 1, 2, 3].map((i) => col.map((v, k) => v + (LIT[k] - v) * i * 0.22));
    TINTS.set(col, t);
  }
  return t;
}

// what you have trained: power, speed, stamina, defence (0..10 each), your record, who you have beaten
export function loadStats() {
  const d = { power: 0, speed: 0, stamina: 0, defence: 0, record: { w: 0, l: 0, d: 0 }, beaten: [] };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') return { ...d, ...s, record: { ...d.record, ...(s.record || {}) }, beaten: Array.isArray(s.beaten) ? s.beaten : [] };
  } catch (e) {
    // (none kept, or not readable: from nothing)
  }
  return d;
}

export class Boxing {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.mode = null;
    this.bout = null;
    this.stats = loadStats();
    this.hud = null;
    this.boxA = newBox();
    this.boxB = newBox();
    this.opp = null;
    this.oppOwn = false;
    this.oppWas = null;
    this.ringY = 0;
    this.camFocus = new THREE.Vector3();
    this.camSide = 1;
    this.co = { dist: 3.4, height: 1.2, shoulder: 0, fovMul: 1, minY: 0.4 };
    this.punchIn = 0;
    this.punchInT = 0;
    this.hsT = 0;
    this.hsRun = 0;
    this.hsGap = 1;
    this.slowT = 0;
    this.slowK = 1;
    this.overT = 0;
    this.roarT = 3;
    this.lookA = new THREE.Vector3();
    this.lookB = new THREE.Vector3();
    this.oppT = { x: 0, z: 0, yaw: 0 };
    this.ctrl = (c) => this.ctrlOpp(c);
    this.refCtrl = (c) => this.ctrlRef(c);
    this.ref = null;
    this.refArm = new THREE.Vector3();
    this.refArmL = new THREE.Vector3();
    this.coachCtrl = (c) => this.ctrlCoach(c);
    this.drill = null;
    this.saved = null;
    // (the coach's pads: where each is held, and its knock back from a punch)
    this.padR = new THREE.Vector3();
    this.padL = new THREE.Vector3();
    this.padKick = [0, 0];
  }

  // ------------------------------------------------------------------ the API the gym calls
  // a bout: o = { ring: { x, z, y, half, yaw }, opponent: { name, look (a function giving a look, or null), profile (an id of
  // game/boxsim.js PROFILES or a profile of its own), civ (one of the city's people to take into the ring, optional) },
  // player: { name }, rounds, roundLen, restLen, seed, onEnd(result) }. Returns false when it cannot start (not on foot).
  startBout(o = {}) {
    const g = this.game;
    const P = g.player;
    if (this.active) this.stop('replaced');
    if (!P || P.mode !== 'foot' || P.inVehicle) return false;
    const opp = o.opponent || {};
    const prof = typeof opp.profile === 'string' ? PROFILES[opp.profile] || PROFILES.rookie : opp.profile || PROFILES.rookie;
    const ring = this.ringOf(o.ring);
    const seed = o.seed || (Math.random() * 1e9) | 0;
    const S = this.statMul();
    const b = new Bout({
      ring,
      rounds: o.rounds || 3,
      roundLen: o.roundLen || 60,
      restLen: o.restLen === undefined ? 8 : o.restLen,
      seed,
      a: { name: (o.player && o.player.name) || tr('דני', 'Danny'), m: 1, ...S },
      b: { name: opp.name || prof.name, profile: prof },
    });
    b.ctl[1] = new BoxAI(b, 1, prof, seed + 11);
    this.bout = b;
    this.prof = prof;
    this.mode = 'bout';
    this.onEnd = o.onEnd || null;
    this.overT = 0;
    this.result = null;
    this.begin(ring, opp, prof);
    this.spawnRef(ring);
    this.hud.show({ a: b.f[0].name, b: b.f[1].name, mode: 'bout', rounds: b.rounds, touch: g.touch });
    this.audio('crowd');
    return true;
  }

  // the gym's work: kind 'mitts' (a coach calls the combos: o.coach { look, name }), 'heavybag' or 'speedbag' (o.bag { x, z, y }:
  // the bag; o.onHit(move, power) for the gym to swing it); o.at { x, z, y, yaw }: where you stand; o.onEnd(result)
  startTraining(kind, o = {}) {
    const g = this.game;
    const P = g.player;
    if (this.active) this.stop('replaced');
    if (!P || P.mode !== 'foot' || P.inVehicle) return false;
    const at = o.at || { x: P.pos.x, z: P.pos.z, y: P.pos.y, yaw: P.yaw };
    const fx = Math.sin(at.yaw || 0);
    const fz = Math.cos(at.yaw || 0);
    const dist = kind === 'mitts' ? 0.98 : kind === 'speedbag' ? 0.52 : 0.82;
    const bag = o.bag || { x: at.x + fx * dist, z: at.z + fz * dist, y: (at.y || 0) + 1.35 };
    const ring = { x: (at.x + bag.x) / 2, z: (at.z + bag.z) / 2, y: at.y, half: 3.2, yaw: 0 };
    const S = this.statMul();
    const b = new Bout({ ring, rounds: 1, roundLen: 9999, restLen: 0, introLen: 0.4, a: { name: tr('דני', 'Danny'), m: 1, ...S }, b: { name: kind, hp: 1e7, profile: { spd: 1, pow: 0.3 } } });
    b.training = kind;
    // (the two where they stand: you on your mark, the coach or the bag in front of you)
    b.f[0].x = at.x;
    b.f[0].z = at.z;
    b.f[1].x = bag.x;
    b.f[1].z = bag.z;
    b.face(1);
    this.bout = b;
    this.mode = kind;
    this.onEnd = o.onEnd || null;
    this.onHit = o.onHit || null;
    this.bagAt = bag;
    this.overT = 0;
    this.result = null;
    this.prof = null;
    this.begin(ring, kind === 'mitts' ? { look: (o.coach && o.coach.look) || null, coach: true, name: o.coach && o.coach.name } : null, null);
    this.drill = kind === 'mitts' ? new Mitts(this, o) : new BagDrill(this, kind, o);
    this.hud.show({ a: b.f[0].name, b: kind === 'mitts' ? (o.coach && o.coach.name) || tr('המאמן', 'Coach') : '', mode: kind, touch: g.touch });
    return true;
  }

  // out of the ring now (you walked out, the gym closed, a test): over, as it stands
  stopBout() {
    if (this.active) this.stop('stopped');
  }

  // your numbers, from what you have trained: into your fighter in every bout
  statMul() {
    const s = this.stats;
    const c = (v) => Math.max(0, Math.min(10, v || 0));
    return { pow: 1 + 0.03 * c(s.power), spd: 1 + 0.016 * c(s.speed), stam: 1 + 0.035 * c(s.stamina), def: 1 + 0.025 * c(s.defence), hp: 100 + 2.5 * c(s.stamina) };
  }

  train(gain) {
    const s = this.stats;
    for (const k of ['power', 'speed', 'stamina', 'defence']) if (gain[k]) s[k] = Math.min(10, (s[k] || 0) + gain[k]);
    this.save();
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.stats));
    } catch (e) {
      // (not kept: this time only)
    }
  }

  // ------------------------------------------------------------------ in and out
  ringOf(r) {
    const P = this.game.player;
    const x = r && r.x !== undefined ? r.x : P.pos.x;
    const z = r && r.z !== undefined ? r.z : P.pos.z;
    return { x, z, y: r && r.y !== undefined ? r.y : groundHeight(x, z), half: (r && r.half) || 3, yaw: (r && r.yaw) || 0 };
  }

  begin(ring, opp, prof) {
    const g = this.game;
    const P = g.player;
    const b = this.bout;
    this.ringY = ring.y;
    this.ring = ring;
    const fig = P.fig;
    // (what he had in his hands, and the gun: put away for the bout, given back after)
    const W = g.weapons;
    this.saved = { carry: fig.carry, carryL: fig.carryL, index: W ? W.index : 0, seat: P.seat };
    fig.carry = null;
    fig.carryL = null;
    if (W) {
      const i = W.slots.findIndex((s) => s.def.bare);
      if (i >= 0 && W.index !== i) {
        W.fistsTold = true;
        W.index = i;
        if (g.hud && g.hud.updateWeapon) g.hud.updateWeapon();
      }
    }
    if (P.crouched && P.setCrouch) P.setCrouch(false);
    const A = b.f[0];
    P.seat = { x: A.x, z: A.z, y: ring.y, yaw: A.yaw, lock: true, stand: true, walk: 0, box: true };
    P.yaw = A.yaw;
    P.vel.set(0, 0, 0);
    this.boxA = newBox();
    this.boxA.m = 1;
    fig.box = this.boxA;
    if (fig.unrag) fig.unrag(0.3);
    // the man on the other side (or the coach)
    this.opp = null;
    if (opp) {
      const B = b.f[1];
      let c = opp.civ || null;
      if (c) {
        this.oppOwn = false;
        this.oppWas = { ctrl: c.ctrl, owner: c.owner, brave: c.brave, noCollide: c.noCollide, baseY: c.baseY, lodFar: c.fig.lodFar };
      } else {
        const look = typeof opp.look === 'function' ? opp.look() : opp.look || (opp.coach ? cityLook({ fem: false, kind: 'street', old: true }) : cityLook({ fem: false, kind: 'street' }));
        c = g.civilians.spawnScripted(B.x, B.z, look, this);
        this.oppOwn = true;
        this.oppWas = null;
      }
      c.brave = true;
      c.noCollide = true;
      c.baseY = ring.y - groundHeight(B.x, B.z);
      c.pos.set(B.x, ring.y, B.z);
      c.yaw = B.yaw;
      if (c.fig) c.fig.lodFar = 85;
      c.ctrl = opp.coach ? this.coachCtrl : this.ctrl;
      this.oppT.x = B.x;
      this.oppT.z = B.z;
      this.oppT.yaw = B.yaw;
      this.opp = c;
      if (!opp.coach) {
        this.boxB = newBox();
        this.boxB.m = B.m;
        this.boxB.bounce = prof ? prof.bounce || 1 : 1;
        c.fig.box = this.boxB;
        if (c.fig.unrag) c.fig.unrag(0.3);
      }
    }
    const inp = g.input;
    inp.grab = GRAB;
    document.body.classList.add('boxing');
    if (!this.hud) this.hud = new BoxingHud(g);
    // the camera: round the middle of the two of you, from your side
    this.camFocus.set((b.f[0].x + b.f[1].x) / 2, ring.y, (b.f[0].z + b.f[1].z) / 2);
    g.camRig.focus = this.camFocus;
    this.camYaw = null;
    this.quit = false;
    this.hsT = 0;
    this.slowT = 0;
    this.punchIn = 0;
    this.punchInT = 0;
    this.active = true;
  }

  stop(why) {
    if (!this.active) return;
    const g = this.game;
    const P = g.player;
    const fig = P.fig;
    this.active = false;
    if (P.seat && P.seat.box) P.seat = this.saved && this.saved.seat && !this.saved.seat.box ? this.saved.seat : null;
    fig.box = null;
    fig.handF[0] = fig.handF[1] = null;
    fig.handN[0] = fig.handN[1] = null;
    fig.handGrip[0] = fig.handGrip[1] = 0;
    fig.lookAt = null;
    if (fig.unrag) fig.unrag(0.35);
    if (this.saved) {
      fig.carry = this.saved.carry;
      fig.carryL = this.saved.carryL;
    }
    const c = this.opp;
    if (c) {
      const cf = c.fig;
      if (cf) {
        cf.box = null;
        cf.handF[0] = cf.handF[1] = null;
        cf.handN[0] = cf.handN[1] = null;
        cf.handGrip[0] = cf.handGrip[1] = 0;
        cf.lookAt = null;
        cf.reachR = null;
        cf.reachL = null;
        cf.poleR = null;
        cf.poleL = null;
      }
      if (this.oppOwn) {
        if (g.civilians.list.includes(c)) g.civilians.remove(c);
      } else if (this.oppWas) {
        const w = this.oppWas;
        c.ctrl = w.ctrl;
        c.owner = w.owner;
        c.brave = w.brave;
        c.noCollide = w.noCollide;
        c.baseY = w.baseY;
        if (cf) cf.lodFar = w.lodFar;
      }
    }
    this.opp = null;
    if (this.ref) {
      const rf = this.ref.fig;
      if (rf) {
        rf.reachR = null;
        rf.reachL = null;
      }
      if (g.civilians.list.includes(this.ref)) g.civilians.remove(this.ref);
      this.ref = null;
    }
    g.input.grab = null;
    document.body.classList.remove('boxing');
    if (g.camRig.focus === this.camFocus) g.camRig.focus = null;
    if (this.hud) this.hud.hide();
    this.hsT = 0;
    this.slowT = 0;
    const res = this.result || { aborted: true, why, mode: this.mode };
    const cb = this.onEnd;
    this.onEnd = null;
    this.drill = null;
    this.mode = null;
    if (cb) {
      try {
        cb(res);
      } catch (e) {
        console.error('[boxing] onEnd', e);
      }
    }
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const P = g.player;
    // (out of it: a car, the water, a rope - over, as it stands)
    if (P.mode !== 'foot' || P.inVehicle) {
      this.stop('left');
      return;
    }
    const rdt = Math.min(0.1, g.realDt || dt);
    if (dt <= 0) return;
    const b = this.bout;
    this.readInput();
    if (this.drill) this.drill.update(dt, rdt);
    b.step(dt);
    if (b.training) this.pinTarget();
    this.events();
    this.sync(dt);
    if (this.hud) this.hud.frame(this, rdt);
    // the crowd's murmur, now and then
    if (this.mode === 'bout') {
      this.roarT -= rdt;
      if (this.roarT <= 0) {
        this.roarT = 2.5 + Math.random() * 4;
        this.audio('murmur');
      }
    }
    // the end: the result a while on the screen, then out (at once, for the quit button at the gym's work)
    if (this.quit) {
      this.quit = false;
      this.stop('quit');
      return;
    }
    if (b.result || (this.drill && this.drill.done)) {
      this.overT += rdt;
      if (this.overT > (this.mode === 'bout' ? 6.5 : 4)) this.stop('over');
    }
    // (the keys and the wheel the bout keeps: nothing else swaps the weapon in its hands)
    g.input.wheel = 0;
  }

  // the stick (camera-relative: toward him on the screen is in) and the buttons, into your fighter's intent
  readInput() {
    const g = this.game;
    const inp = g.input;
    const b = this.bout;
    const it = b.intent[0];
    const f = b.f[0];
    // the stick, as the screen has it (no new object: core/input.js readMove makes one)
    let sx = 0;
    let sy = 0;
    const pad = inp.pad;
    if (pad && (pad.x || pad.y)) {
      sx = pad.x;
      sy = pad.y;
    } else if (inp.touch) {
      sx = inp.move.x;
      sy = inp.move.y;
    } else {
      const k = inp.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) sy += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) sy -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) sx += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) sx -= 1;
    }
    const cy = g.camRig.yaw;
    const wx = Math.sin(cy) * sy - Math.cos(cy) * sx;
    const wz = Math.cos(cy) * sy + Math.sin(cy) * sx;
    const fx = Math.sin(f.yaw);
    const fz = Math.cos(f.yaw);
    it.mz = wx * fx + wz * fz;
    it.mx = wx * -fz + wz * fx;
    const P = inp.pressed;
    const held = inp.keys;
    const gp = g.pad && g.pad.active ? g.pad : null;
    this.gp = gp;
    it.guard = held.has('ShiftLeft') || held.has('ShiftRight') || held.has('BoxGuard') || inp.aim || (!!gp && gp.rt > 0.4);
    // (the stick pulled back, a punch: to the body)
    const body = it.mz < -0.45;
    let press = null;
    if (P.has('KeyJ') || P.has('BoxJab') || inp.firePressed || this.gpP(PAD.jab)) press = 'jab';
    if (P.has('KeyK') || P.has('BoxCross') || this.gpP(PAD.cross)) press = 'cross';
    if (P.has('KeyL') || P.has('BoxHook') || this.gpP(PAD.hook)) press = 'hook';
    if (P.has('KeyI') || P.has('BoxUpper') || this.gpP(PAD.upper)) press = 'upper';
    if (press) {
      it.press = body ? 'b' + press : press;
      it.tap += 1;
      this.lastPress = press;
    }
    if (P.has('Space') || P.has('BoxTap')) it.tap += 1;
    if (P.has('KeyQ') || P.has('BoxSlipL') || this.gpP(PAD.slipL)) it.slip = -1;
    if (P.has('KeyE') || P.has('BoxSlipR') || this.gpP(PAD.slipR)) it.slip = 1;
    if (P.has('KeyC') || P.has('BoxDuck') || (!!gp && gp.lt > 0.4 && !(this.ltWas))) it.duck = true;
    this.ltWas = !!gp && gp.lt > 0.4;
    // (out of the ring: the quit button, Backspace, the pad's View)
    if (P.has('BoxQuit') || P.has('Backspace') || this.gpP(PAD.quit)) {
      if (this.mode === 'bout' && !b.result) {
        b.finish(1, 'RET');
        this.overT = 5;
      } else this.quit = true;
    }
  }

  // (a pad's button just pressed)
  gpP(i) {
    const gp = this.gp;
    return !!gp && !!gp.down[i] && !gp.was[i];
  }

  // (the bag stays where it hangs: only you move; the coach takes it all on the pads)
  pinTarget() {
    const f = this.bout.f[1];
    f.hp = f.hpMax;
    if (this.mode === 'mitts') {
      if (f.state === 'stun' || f.state === 'stagger' || f.state === 'bstun') f.state = 'idle';
      f.hitT = -1;
      return;
    }
    f.x = this.bagAt.x;
    f.z = this.bagAt.z;
    f.vx = 0;
    f.vz = 0;
    f.hp = f.hpMax;
    f.state = 'idle';
  }

  // the bodies, from the bout: where each stands and which way, and fig.box for the rig
  sync(dt) {
    const g = this.game;
    const b = this.bout;
    const P = g.player;
    const A = b.f[0];
    const B = b.f[1];
    const seat = P.seat;
    if (seat && seat.box) {
      seat.x = A.x;
      seat.z = A.z;
      seat.y = this.ringY;
      seat.yaw = A.yaw;
      P.yaw = A.yaw;
    }
    this.oppT.x = B.x;
    this.oppT.z = B.z;
    this.oppT.yaw = B.yaw;
    const c = this.opp;
    if (c) {
      // (nothing of the city's: no fright, no chat, no turning to look)
      c.panicT = 0;
      c.cowerT = 0;
      c.coverT = 0;
      c.noticeT = 0;
      c.callT = 0;
      c.confrontT = 0;
      c.avoidT = 0;
    }
    const d = b.dist();
    const figA = P.fig;
    const figB = c && c.fig;
    this.fill(this.boxA, A, figA, figB, d, dt);
    if (figB && figB.box) this.fill(this.boxB, B, figB, figA, d, dt);
    // (the head on the other's head; down, nothing)
    if (figB) {
      figA.lookAt = A.state === 'down' || A.state === 'out' ? null : this.lookA.copy(figB.j.headC);
      figB.lookAt = B.state === 'down' || B.state === 'out' ? null : this.lookB.copy(figA.j.headC);
    } else if (this.bagAt) {
      figA.lookAt = this.lookA.set(this.bagAt.x, this.bagAt.y + 0.1, this.bagAt.z);
    }
  }

  fill(X, f, fig, other, d, dt) {
    const b = this.bout;
    const k = Math.min(1, dt * 8);
    X.m = f.m;
    X.vx = f.lx;
    X.vz = f.lz;
    X.guard = f.guardK;
    X.tired += (f.tiredK * 0.8 + (f.hp < f.hpMax * 0.25 ? 0.25 : 0) - X.tired) * Math.min(1, dt * 2);
    const resting = b.phase === 'rest' || (b.phase === 'over' && !f.cheer) || (b.phase === 'count' && b.downed !== f.i);
    X.rest += ((resting ? 1 : 0) - X.rest) * k;
    X.cheer += ((f.cheer ? 1 : 0) - X.cheer) * k;
    const was = X.move;
    const fresh = f.state === 'punch' && f.move && f.punchId !== X.pid;
    if (f.state === 'punch' && f.move) {
      // (one punch out of another: eased from where the last one was)
      if (fresh && was && fig.unrag) fig.unrag(0.07);
      X.pid = f.punchId;
      X.move = f.move.id;
      X.body = f.move.body;
      X.mt = f.mt;
      X.tell = f.tell;
      X.su = f.move.su * f.suK;
      X.act = f.move.act;
      X.rec = f.move.rec * f.recK + (f.whiff && f.move.power ? 0.08 : 0);
      X.whiff = f.whiff;
    } else X.move = 0;
    // (a punch cut short - a blow, a feint pulled - eased out of, not snapped)
    if (was && !X.move && fig.unrag && (f.state !== 'idle' || (f.move === null && f.mt < (f.suK || 1) * 0.3 + f.tell))) fig.unrag(0.1);
    X.aimD = d;
    if (other) {
      const oj = other.j;
      const y = X.body ? oj.hip.y + (oj.neck.y - oj.hip.y) * 0.62 : oj.headC.y;
      X.aimY = (y - fig.pos.y) / fig.scale;
    } else if (this.bagAt) X.aimY = (this.bagAt.y - fig.pos.y) / fig.scale;
    X.slipT = f.state === 'slip' ? f.st : -1;
    X.slipDir = f.slipDir * f.m;
    X.duckT = f.state === 'duck' ? f.st : -1;
    X.blockT = f.blockT;
    X.blockK = f.blockK;
    X.hitT = f.hitT;
    X.hitKind = f.hitKind;
    X.hitSide = f.hitSide * f.m;
    X.hitK = f.hitK;
    X.stagger = f.staggerK;
    X.downT = f.state === 'down' || f.state === 'out' ? Math.max(0, f.downT) : -1;
    X.downKind = f.downKind;
    X.getupT = f.state === 'getup' ? f.getupT : -1;
  }

  // the man on the other side, each frame of the city's (game/civilians.js): held where the bout has him
  ctrlOpp(c) {
    const t = this.oppT;
    c.vel.set(0, 0, 0);
    if (c.dodgeV) c.dodgeV.set(0, 0, 0);
    c.pos.x = t.x;
    c.pos.z = t.z;
    c.yaw = t.yaw;
    c.faceYaw = t.yaw;
    c.fig.yaw = t.yaw;
    c.talkUntil = 0;
    c.glanceUntil = 0;
    c.listenTo = null;
    c.stepSp = 0;
    return null;
  }

  // ------------------------------------------------------------------ the referee
  // (ROADMAP 29.5) in a white shirt, out of the camera's way on the far side of the two; over the man on the canvas for the
  // count, his arm coming down with each number (and saying it); waving it off at ten
  spawnRef(ring) {
    const g = this.game;
    const b = this.bout;
    let look = null;
    try {
      look = roleLook('staff', { fem: false, variants: [0] });
    } catch (e) {
      look = null;
    }
    if (!look) look = cityLook({ fem: false, kind: 'smart' });
    const x = ring.x + (b.f[0].z - b.f[1].z) * 0.6;
    const z = ring.z + (b.f[1].x - b.f[0].x) * 0.6;
    const c = g.civilians.spawnScripted(x, z, look, this);
    c.brave = true;
    c.noCollide = true;
    c.baseY = ring.y - groundHeight(x, z);
    c.pos.y = ring.y;
    if (c.fig) c.fig.lodFar = 85;
    c.ctrl = this.refCtrl;
    this.ref = c;
  }

  ctrlRef(c) {
    const b = this.bout;
    const fig = c.fig;
    c.talkUntil = 0;
    c.glanceUntil = 0;
    c.listenTo = null;
    c.panicT = 0;
    c.noticeT = 0;
    if (c.dodgeV) c.dodgeV.set(0, 0, 0);
    if (!b) return null;
    const A = b.f[0];
    const B = b.f[1];
    let tx;
    let tz;
    let face;
    fig.reachR = null;
    fig.reachL = null;
    // (the camera's way into the picture, flat: he keeps beyond whoever it is on - never between it and them)
    const cy = this.camYaw === null ? this.game.camRig.yaw : this.camYaw;
    const vx = Math.sin(cy);
    const vz = Math.cos(cy);
    if (b.phase === 'count' && b.downed >= 0) {
      // over him, beyond him from the camera, a step off to the side his head is
      const D = b.f[b.downed];
      const hx = -Math.sin(D.yaw);
      const hz = -Math.cos(D.yaw);
      tx = D.x + vx * 0.85 + hx * 0.35;
      tz = D.z + vz * 0.85 + hz * 0.35;
      face = Math.atan2(D.x - tx, D.z - tz);
      // (the arm: up through the second, down on the number)
      const j = fig.j;
      if (j && j.shoulderR) {
        const u = b.count > 0 ? b.countT : 0;
        const h = u < 0.12 ? 0.32 - 0.6 * (u / 0.12) : -0.28 + 0.6 * ((u - 0.12) / 0.88);
        const f = fig.forward;
        const r = fig.right;
        this.refArm.copy(j.shoulderR).addScaledVector(f, 0.34).addScaledVector(r, 0.08);
        this.refArm.y += h;
        fig.reachR = this.refArm;
      }
    } else {
      // out of the way: off the line between them, on the side away from the camera
      const mx = (A.x + B.x) / 2;
      const mz = (A.z + B.z) / 2;
      const d = b.dist() || 1;
      // (beyond the two of them, and toward his end - clear of both, in the picture's corner)
      tx = mx + vx * 2.0 + ((B.x - A.x) / d) * 0.95;
      tz = mz + vz * 2.0 + ((B.z - A.z) / d) * 0.95;
      face = Math.atan2(mx - tx, mz - tz);
      // (it is over: the winner's arm up - his own up in the air for him)
      if (b.result && this.overT > 0.6 && fig.j && fig.j.shoulderR) {
        this.refArm.copy(fig.j.shoulderR);
        this.refArm.y += 0.55;
        fig.reachR = this.refArm;
      }
    }
    // (inside the ropes)
    const q = this._rq || (this._rq = { u: 0, v: 0 });
    b.toRing(tx, tz, q);
    const lim = b.ring.half - 0.35;
    const u = Math.max(-lim, Math.min(lim, q.u));
    const v = Math.max(-lim, Math.min(lim, q.v));
    const pt = this._rp || (this._rp = { x: 0, z: 0 });
    b.fromRing(u, v, pt);
    c.faceYaw = face;
    const dd = Math.hypot(pt.x - c.pos.x, pt.z - c.pos.z);
    if (dd < 0.22) return null;
    const m = this._rm || (this._rm = { x: 0, z: 0, speed: 0 });
    m.x = pt.x;
    m.z = pt.z;
    m.speed = Math.min(2.6, 0.7 + dd * 1.6);
    return m;
  }

  ctrlCoach(c) {
    this.ctrlOpp(c);
    if (this.drill && this.drill.pose) this.drill.pose(c);
    return null;
  }

  // ------------------------------------------------------------------ what happened: felt
  events() {
    const b = this.bout;
    const ev = b.ev;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (this.drill) this.drill.event(e);
      this.react(e);
    }
    ev.length = 0;
  }

  figOf(i) {
    return i === 0 ? this.game.player.fig : this.opp ? this.opp.fig : null;
  }

  react(e) {
    const g = this.game;
    const b = this.bout;
    const H = this.hud;
    const you = (i) => i === 0;
    switch (e.type) {
      case 'throw': {
        const m = MOVES[e.move];
        this.audio('swing', m.power ? 1 : 0.6);
        break;
      }
      case 'hit':
      case 'stagger':
      case 'kd': {
        const m = MOVES[e.move];
        const D = this.figOf(e.d);
        const power = m.kind === 0 && !m.power ? 0 : m.kind === 0 ? 1 : 2;
        // the stop: as long as the blow is heavy (jab 40 ms, cross 70, hook and uppercut 100), more for a counter
        this.hitstop(e.hs);
        g.camRig.addShake((you(e.d) ? 0.16 : 0.1) * (0.5 + power * 0.35) * (e.counter ? 1.5 : 1) * (e.body ? 0.8 : 1));
        if (b.training) {
          this.audio('pad', 0.7 + power * 0.2);
        } else this.audio(e.body ? 'body' : 'punch', 0.7 + power * 0.25 + (e.counter ? 0.3 : 0));
        if (b.training) {
          // (on the pad: a pop of ink there)
          if (e.d === 1 && this.mode === 'mitts' && g.weapons && g.weapons.fists) {
            const pd = MOVES[e.move].hand === 'lead' ? this.padR : this.padL;
            g.weapons.fists.burst(pd.x, pd.y, pd.z, 0.7 + power * 0.2);
          } else if (D) this.impact(D, e, m, power);
          break;
        }
        if (D) this.impact(D, e, m, power);
        if (e.counter) {
          this.slow(0.32, 0.3);
          this.punchInT = 0.75;
          if (H) H.flashMsg(tr('נגד!', 'COUNTER!'), 'counter');
          this.audio('roar', 0.55);
        }
        if (e.type === 'stagger') {
          if (H) H.flashMsg(you(e.d) ? tr('אתם מטושטשים!', 'YOU\'RE HURT!') : tr('הוא מטושטש!', 'HE\'S HURT!'), 'hurt');
          this.audio('roar', 0.7);
        }
        if (e.type === 'kd') {
          // (the blow that puts him down: the picture slowed, the camera in on it, the hall up)
          this.slow(1.05, 0.22);
          this.punchInT = 1.6;
          this.audio('roar', 1.1);
          if (H) H.flashMsg(tr('נפל!', 'KNOCKDOWN!'), 'kd');
        }
        break;
      }
      case 'block': {
        const D = this.figOf(e.d);
        this.audio('block', 0.8);
        this.hitstop(0.025);
        g.camRig.addShake(you(e.d) ? 0.05 : 0.03);
        if (D && g.weapons && g.weapons.fists) {
          const h = D.j.headC;
          const f = D.forward;
          g.weapons.fists.burst(h.x + f.x * 0.2, h.y - 0.08, h.z + f.z * 0.2, 0.55);
        }
        break;
      }
      case 'guardbreak':
        this.audio('block', 1.1);
        if (H) H.flashMsg(tr('ההגנה נשברה', 'GUARD BROKEN'), 'hurt');
        break;
      case 'evade':
        this.audio('whoosh', 0.8);
        if (you(e.d) && H && !b.training) H.flashMsg(e.kind === 'duck' ? tr('התחמקות!', 'DUCKED!') : tr('התחמקות!', 'SLIPPED!'), 'slip');
        break;
      case 'bell':
        this.audio(e.start ? 'bell2' : 'bell3');
        if (e.start && this.ref && g.bubbles) g.bubbles.say(this.ref, tr('בוקס!', 'BOX!'), 'plain', 1.1);
        if (!e.start && H && !b.result) H.cards(b.cards);
        break;
      case 'round':
        if (H) H.bigMsg(tr(`סיבוב ${e.round}`, `ROUND ${e.round}`), b.round === b.rounds ? tr('הסיבוב האחרון', 'FINAL ROUND') : '');
        break;
      case 'down':
        this.punchInT = 2.2;
        break;
      case 'count':
        this.audio('count', e.n);
        if (H) H.count(e.n);
        if (this.ref && g.bubbles) g.bubbles.say(this.ref, e.n >= 10 ? tr('בחוץ!', 'OUT!') : String(e.n), 'plain', 0.9);
        break;
      case 'rise':
        this.audio('roar', 0.8);
        if (H) H.count(0);
        break;
      case 'over':
        this.result = this.resultOf(e.result);
        this.recordResult(this.result);
        if (H) H.result(this.result);
        this.audio('bell3');
        this.audio('roar', 1.2);
        break;
      default:
        break;
    }
  }

  // where it lands: a flash, an ink burst, the sweat off him the way the blow goes
  impact(D, e, m, power) {
    const g = this.game;
    const fx = g.fx;
    const j = D.j;
    const at = e.body ? _a.lerpVectors(j.hip, j.neck, 0.62) : _a.copy(j.headC);
    const f = D.forward;
    // (from the side he was hit on, toward his back)
    const r = D.right;
    const side = e.body ? 0 : MOVES[e.move].kind === 1 ? 1 : 0;
    const hs = this.bout.f[e.d].hitSide;
    _b.set(-f.x + r.x * side * hs * 0.8, MOVES[e.move].kind === 2 ? 0.8 : 0.15, -f.z + r.z * side * hs * 0.8).normalize();
    const px = at.x + f.x * 0.14;
    const py = at.y - (e.body ? 0 : 0.02);
    const pz = at.z + f.z * 0.14;
    if (fx) {
      fx.flash(px, py, pz, 0.38 + power * 0.14 + (e.counter ? 0.2 : 0), [1.9, 1.85, 1.6]);
      if (!this.bout.training) fx.spray(at.x, at.y + 0.03, at.z, _b.x, _b.y, _b.z, e.body ? 5 : 7 + power * 4, 2.6 + power * 0.8, SWEAT, { cone: 0.55, len: 0.07, wide: 2.2, life: 0.5 });
      if (e.kd || e.counter) fx.burst(px, py, pz, 10, 3.2, [1.15, 0.95, 0.42], 0.5, 0.25);
    }
    if (g.weapons && g.weapons.fists) g.weapons.fists.burst(px, py, pz, 0.8 + power * 0.25 + (e.counter ? 0.35 : 0));
    if (e.d === 0 && this.hud) this.hud.hurtFlash(e.kd ? 1 : e.counter ? 0.8 : 0.35 + power * 0.15);
  }

  // ------------------------------------------------------------------ the clock: the stop of a blow, the slow motion
  // (game/game.js: dt *= timeK(realDt) - each blow a stop of its own length, never added to the last into a freeze)
  timeK(rdt) {
    if (!this.active) return 1;
    this.hsGap += rdt;
    if (this.hsGap > 0.2) this.hsRun = 0;
    if (this.hsT > 0) {
      // (the part of this frame the stop still covers: stopped that long, and on for the rest of it)
      const f = Math.min(this.hsT, rdt);
      this.hsT -= rdt;
      this.hsRun += f;
      this.hsGap = 0;
      return rdt > 0 ? (f * 0.03 + (rdt - f)) / rdt : 1;
    }
    if (this.slowT > 0) {
      this.slowT -= rdt;
      return this.slowT < 0.2 ? this.slowK + (1 - this.slowK) * (1 - this.slowT / 0.2) : this.slowK;
    }
    return 1;
  }

  hitstop(s) {
    const room = Math.max(0, 0.1 - this.hsRun);
    this.hsT = Math.max(this.hsT, Math.min(s, room));
  }

  slow(t, k) {
    if (this.slowT > 0 && this.slowK <= k) {
      this.slowT = Math.max(this.slowT, t);
      return;
    }
    this.slowT = t;
    this.slowK = k;
  }

  // ------------------------------------------------------------------ the camera
  // (game/game.js gives these to camRig.update; the focus - the middle of the two - is set on it. Side on, a little behind
  // you, the two of you in the picture; in close for a counter and for a knockdown; on the man on the canvas during the count;
  // further back between the rounds)
  camOpts() {
    if (!this.active) return null;
    const g = this.game;
    const R = g.camRig;
    const rdt = Math.min(0.1, g.realDt || 1 / 30);
    const b = this.bout;
    const A = b.f[0];
    const B = b.f[1];
    let tx = (A.x + B.x) / 2;
    let tz = (A.z + B.z) / 2;
    const d = b.dist();
    const counting = b.phase === 'count' && b.downed >= 0;
    if (counting) {
      const D = b.f[b.downed];
      tx += (D.x - tx) * 0.55;
      tz += (D.z - tz) * 0.55;
    }
    const ke = 1 - Math.exp(-rdt * 7);
    this.camFocus.x += (tx - this.camFocus.x) * ke;
    this.camFocus.z += (tz - this.camFocus.z) * ke;
    this.camFocus.y = this.ringY;
    // (the line from you to him; the camera at its side, you on the left of the picture)
    const th = Math.atan2(B.x - A.x, B.z - A.z);
    const train = !!b.training;
    const want = th + (Math.PI / 2 - (train ? 0.62 : 0.42));
    // (the camera's own: the mouse or the look pad do not turn it in the ring)
    if (this.camYaw === null) {
      this.camYaw = R.yaw;
      this.camPitch = R.pitch;
    }
    const dy = wrap(want - this.camYaw);
    this.camYaw += dy * (1 - Math.exp(-rdt * (Math.abs(dy) > 1.2 ? 2.5 : 4.5)));
    const pw = counting ? -0.22 : -0.14;
    this.camPitch += (pw - this.camPitch) * (1 - Math.exp(-rdt * 4));
    R.yaw = this.camYaw;
    R.pitch = this.camPitch;
    // (in close: eased in and out)
    this.punchInT = Math.max(0, this.punchInT - rdt);
    const pi = this.punchInT > 0 ? 1 : 0;
    this.punchIn += (pi - this.punchIn) * (1 - Math.exp(-rdt * (pi ? 9 : 2.5)));
    const wide = b.phase === 'rest' || b.phase === 'intro' || (b.phase === 'over' && this.overT > 1.5) ? 1 : 0;
    this.wide = (this.wide || 0) + (wide - (this.wide || 0)) * (1 - Math.exp(-rdt * 1.5));
    const co = this.co;
    co.dist = (2.25 + Math.min(1.6, d) * 0.8) * (1 - 0.33 * this.punchIn) + 1.6 * this.wide + (counting ? 0.3 : 0);
    co.height = 1.22 - 0.12 * this.punchIn + 0.35 * this.wide - (counting ? 0.25 : 0);
    co.fovMul = 1 - 0.1 * this.punchIn;
    co.minY = this.ringY + 0.35;
    co.shoulder = 0;
    // (under the gym's ceiling, as the game's own camera keeps under a room's: game/game.js player.indoor)
    const IR = g.player.indoor;
    co.maxY = IR && IR.height ? IR.floor + IR.height - 0.3 : undefined;
    return co;
  }

  // ------------------------------------------------------------------ the picture: the gloves (and the coach's pads)
  // (game/game.js, after the people are drawn: the rig has put the hands this frame)
  draw() {
    if (!this.active) return;
    const g = this.game;
    const bodies = g.figures && g.figures.bodies;
    if (!bodies || !bodies.blob) return;
    // (your gloves lit while a slipped punch has the counter open; his punching glove lit through its wind-up - the tell, easy
    // to miss on a phone's small picture otherwise)
    const b = this.bout;
    const A = b.f[0];
    const B = b.f[1];
    this.gloves(bodies, g.player.fig, GLOVE_YOU, 0, A.counterT > 0 ? Math.min(3, 1 + Math.round(A.counterT * 6)) : 0);
    const c = this.opp;
    if (c && c.fig && c.fig.box) {
      let lit = 0;
      let hand = 0;
      if (B.state === 'punch' && B.move && B.tell > 0 && B.mt < B.tell + 0.04) {
        lit = Math.min(3, Math.round((B.mt / B.tell) * 3));
        // (which of his hands: the lead is his left, an orthodox man's)
        hand = (B.move.hand === 'lead') === (B.m === 1) ? 2 : 1;
      }
      this.gloves(bodies, c.fig, (this.prof && this.prof.glove) || PAD_RED, hand, lit);
    }
    if (this.drill && this.drill.drawPads && c && c.fig) this.drill.drawPads(bodies, c.fig);
  }

  // hand: which is lit (0 both, 1 the right, 2 the left), lit: how much (0..3)
  gloves(bodies, fig, col, hand = 0, lit = 0) {
    const S = fig.scale;
    const B = fig.box;
    if (!B || !fig.visible) return;
    const T = tints(col);
    for (let i = 0; i < 2; i++) {
      const R = i === 0;
      const gc = lit && (hand === 0 || hand === (R ? 1 : 2)) ? T[lit] : col;
      const hd = R ? fig.j.handR : fig.j.handL;
      const F = R ? B._fR : B._fL;
      const N = R ? B._nR : B._nL;
      // (the glove over the fist: a round mitt along the forearm, its palm side flatter; a cuff at the wrist)
      _r.crossVectors(F, N).normalize();
      _c.copy(hd).addScaledVector(F, 0.05 * S).addScaledVector(N, -0.008 * S);
      bodies.blob(_c, _r, N, F, 0.06 * S, 0.052 * S, 0.072 * S, gc);
      _c.copy(hd).addScaledVector(F, -0.03 * S);
      bodies.blob(_c, _r, N, F, 0.047 * S, 0.045 * S, 0.04 * S, CUFF);
    }
  }

  // ------------------------------------------------------------------ the end
  resultOf(r) {
    if (!r) return null;
    const you = r.winner === 0;
    return { ...r, mode: 'bout', won: you, lost: r.winner === 1, draw: r.winner === -1, opponent: this.prof ? this.prof.id : null, name: r.names[1] };
  }

  recordResult(res) {
    if (!res || this.mode !== 'bout') return;
    const s = this.stats;
    if (res.won) s.record.w++;
    else if (res.lost) s.record.l++;
    else s.record.d++;
    if (res.won && res.opponent && !s.beaten.includes(res.opponent)) s.beaten.push(res.opponent);
    // (a bout fought is work too: a little of everything, more for a win)
    const k = res.won ? 0.2 : 0.08;
    this.train({ stamina: k, defence: k * 0.5, power: k * 0.5 });
    this.save();
  }

  // the next on the gym's ladder: who you have not beaten yet
  nextOpponent() {
    for (const id of LADDER) if (!this.stats.beaten.includes(id)) return id;
    return 'champion';
  }

  // ------------------------------------------------------------------ the sounds (core/audio.js's own voices)
  audio(kind, v = 1) {
    const a = this.game.audio;
    if (!a || !a.ctx || !a.enabled) return;
    const p = 0.9 + Math.random() * 0.2;
    switch (kind) {
      case 'punch':
        // a glove on a face: the slap of the leather, the deep thump under it
        a.hiss(0.08, 0.42 * v, 700 * p, 0.9, 'lowpass');
        a.hiss(0.03, 0.18 * v, 2600 * p, 1.2, 'bandpass');
        a.tone('sine', 150 * p, 48, 0.16, 0.5 * v);
        a.tone('triangle', 420 * p, 160, 0.05, 0.12 * v);
        if (v > 1) a.tone('sine', 85 * p, 38, 0.26, 0.4 * (v - 0.7));
        break;
      case 'body':
        a.hiss(0.12, 0.5 * v, 380 * p, 0.8, 'lowpass');
        a.tone('sine', 100 * p, 42, 0.2, 0.55 * v);
        break;
      case 'block':
        a.hiss(0.06, 0.32 * v, 1150 * p, 1.2, 'bandpass');
        a.tone('sine', 230 * p, 120, 0.06, 0.2 * v);
        break;
      case 'pad':
        // a mitt: a sharp pop
        a.hiss(0.045, 0.5 * v, 2300 * p, 1, 'bandpass');
        a.tone('sine', 320 * p, 150, 0.05, 0.25 * v);
        break;
      case 'bag':
        a.hiss(0.14, 0.45 * v, 300 * p, 0.7, 'lowpass');
        a.tone('sine', 80 * p, 40, 0.22, 0.5 * v);
        break;
      case 'swing':
        a.hiss(0.1 + 0.06 * v, 0.07 + 0.07 * v, 1500 * p, 1.4, 'bandpass', 0, 650);
        break;
      case 'whoosh':
        a.hiss(0.18, 0.14 * v, 1100 * p, 1.1, 'bandpass', 0, 420);
        break;
      case 'bell2':
      case 'bell3': {
        // the ring's bell: two rings to start, three to stop
        const n = kind === 'bell2' ? 2 : 3;
        for (let i = 0; i < n; i++) {
          const at = i * 0.3;
          a.tone('sine', 1460, 1450, 1.0, 0.11, at);
          a.tone('sine', 2930, 2900, 0.6, 0.035, at);
          a.tone('triangle', 732, 730, 0.8, 0.05, at);
        }
        break;
      }
      case 'count':
        a.tone('square', 300, 290, 0.07, 0.045);
        a.tone('sine', 150, 140, 0.12, 0.08);
        break;
      case 'crowd':
        a.play('roar', 0.5);
        break;
      case 'murmur':
        a.play('roar', 0.12 + Math.random() * 0.06);
        break;
      case 'roar':
        a.play('roar', v);
        break;
      case 'call':
        a.tone('triangle', 520, 500, 0.08, 0.05);
        break;
      default:
        break;
    }
  }
}

// ------------------------------------------------------------------ the mitts
// (ROADMAP 29.5) A coach with pads: he calls a combo ("1-2!", "1-2-3!", "slip!") and holds the pads up for it; you throw it.
// Each punch rated by how it came: the first by how soon after the call, the rest by how close to the moment the one before
// let it out (its cancel window - too early and it is gone from the buffer, too late and it is two punches, not a combo);
// "slip" / "duck": he swings a pad at your head, wound up so you see it - slip it, or duck it. It teaches the buttons.
const MITT_CALLS = ['1-2', '1-1', '1-2-3', 'slip', '1-1-2', '2-3', 'duck', '1-2-3', 'b1-2', '2-3-2', 'slip', '1-2-3-4', '3-b3', 'duck', '1-1-2-3'];
class Mitts {
  constructor(X, o) {
    this.X = X;
    this.n = o.calls || 10;
    this.calls = MITT_CALLS.slice(0, this.n);
    this.i = -1;
    this.st = 'start';
    this.t = 0;
    this.score = 0;
    this.max = 0;
    this.done = false;
    this.log = [];
    this.want = [];
    this.got = [];
    this.lastThrow = 0;
    this.lastMin = 0;
    this.kick = [0, 0];
    this.swing = 0;
  }

  update(dt, rdt) {
    const X = this.X;
    const b = X.bout;
    this.t += rdt;
    this.kick[0] = Math.max(0, this.kick[0] - rdt * 6);
    this.kick[1] = Math.max(0, this.kick[1] - rdt * 6);
    // (the coach keeps his distance from you)
    const C = b.f[1];
    const A = b.f[0];
    const d = b.dist();
    const nm = this.want[this.got.length] || this.want[0];
    const want = this.dodge ? (this.st === 'go' ? 0.8 : 0.95) : nm ? Math.max(0.72, Math.min(0.98, MOVES[nm].reach - 0.06)) : 0.95;
    if (Math.abs(d - want) > 0.03) {
      const ux = (C.x - A.x) / (d || 1);
      const uz = (C.z - A.z) / (d || 1);
      const k = Math.min(1, dt * (this.dodge ? 9 : 4)) * (d - want);
      C.x -= ux * k;
      C.z -= uz * k;
    }
    X.bagAt.x = C.x;
    X.bagAt.z = C.z;
    if (this.st === 'start' && this.t > 1.2) this.next();
    else if (this.st === 'call' && this.t > 0.45) {
      this.st = 'go';
      this.t = 0;
      // (a slip / duck: his swing now, wound up)
      if (this.dodge) {
        const it = b.intent[1];
        it.press = 'hook';
        it.tell = 0.38;
      }
    } else if (this.st === 'go') {
      const late = this.dodge ? this.t > 1.4 : this.t > 2.6 + this.want.length * 0.5;
      if (late) this.finishCall(true);
    } else if (this.st === 'rate' && this.t > 0.9) this.next();
  }

  next() {
    const X = this.X;
    this.i++;
    if (this.i >= this.calls.length) {
      this.end();
      return;
    }
    const c = this.calls[this.i];
    this.dodge = c === 'slip' || c === 'duck' ? c : null;
    this.want = this.dodge ? [] : comboMoves(c);
    this.got = [];
    this.st = 'call';
    this.t = 0;
    this.max += this.dodge ? 3 : this.want.length * 3;
    const say = this.dodge ? (c === 'slip' ? tr('תתחמק!', 'SLIP!') : tr('תתכופף!', 'DUCK!')) : c.replace(/b(\d)/g, (m, n) => tr(`${n} לגוף`, `${n} body`));
    if (X.hud) X.hud.drill({ call: say, i: this.i, n: this.calls.length, score: this.score });
    if (X.opp && X.game.bubbles) X.game.bubbles.say(X.opp, this.dodge ? say : `${say}!`, 'plain', 1.4);
    X.audio('call');
  }

  event(e) {
    if (this.st !== 'go' && this.st !== 'call') return;
    const X = this.X;
    const b = X.bout;
    if (this.dodge) {
      if (e.type === 'evade' && e.d === 0) this.rateDodge(3);
      else if ((e.type === 'hit' || e.type === 'stagger') && e.d === 0) this.rateDodge(0);
      else if (e.type === 'block' && e.d === 0) this.rateDodge(1);
      return;
    }
    if (e.type === 'throw' && e.f === 0) {
      const k = this.got.length;
      const name = e.move;
      if (k >= this.want.length) return;
      if (name !== this.want[k]) {
        this.got.push({ m: name, r: 0, wrong: true });
        this.finishCall(false);
        return;
      }
      let r;
      if (k === 0) {
        const rt = this.t;
        r = rt < 0.7 ? 3 : rt < 1.2 ? 2 : 1;
      } else {
        // (how close to the moment the one before let it out)
        const gap = e.t - this.lastThrow - this.lastMin;
        r = gap < 0.09 ? 3 : gap < 0.28 ? 2 : 1;
      }
      const m = MOVES[name];
      const f = b.f[0];
      this.lastThrow = e.t;
      this.lastMin = m.su * f.suK + m.act + m.cHit;
      this.got.push({ m: name, r, landed: null });
      return;
    }
    if ((e.type === 'hit' || e.type === 'stagger') && e.a === 0) {
      const g = this.got[this.got.length - 1];
      if (g && g.landed === null) g.landed = true;
      // (the pad knocked back)
      const L = MOVES[e.move].hand === 'lead';
      this.kick[L ? 0 : 1] = 1;
      if (this.got.length >= this.want.length && this.got.every((x) => x.landed !== null)) this.finishCall(false);
      return;
    }
    if (e.type === 'whiff' && e.f === 0) {
      const g = this.got[this.got.length - 1];
      if (g && g.landed === null) {
        g.landed = false;
        g.r = 0;
      }
      if (this.got.length >= this.want.length && this.got.every((x) => x.landed !== null)) this.finishCall(false);
    }
  }

  rateDodge(r) {
    this.score += r;
    this.log.push({ call: this.calls[this.i], r: [r] });
    this.rated(r === 3 ? 'perfect' : r === 1 ? 'good' : 'miss', r === 1 ? tr('חסמת — עכשיו תתחמק', 'Blocked — now slip it') : '');
  }

  finishCall(timeout) {
    if (this.st === 'rate') return;
    const rs = this.want.map((m, k) => {
      const g = this.got[k];
      return g && !g.wrong && g.landed !== false ? g.r : 0;
    });
    const s = rs.reduce((a, v) => a + v, 0);
    this.score += s;
    this.log.push({ call: this.calls[this.i], r: rs, timeout });
    const all = rs.length ? s / (rs.length * 3) : 0;
    const wrong = this.got.some((g) => g.wrong);
    this.rated(all > 0.95 ? 'perfect' : all > 0.6 ? 'good' : all > 0.3 ? 'late' : 'miss', wrong ? tr('אגרוף לא נכון', 'Wrong punch') : timeout && this.got.length < this.want.length ? tr('לא סיימת את הקומבו', 'Combo not finished') : '');
  }

  rated(kind, note) {
    const X = this.X;
    this.st = 'rate';
    this.t = 0;
    const word = { perfect: tr('מושלם', 'PERFECT'), good: tr('טוב', 'GOOD'), late: tr('איטי', 'LATE'), miss: tr('פספוס', 'MISS') }[kind];
    if (X.hud) X.hud.drill({ rating: word, kind, note, i: this.i, n: this.calls.length, score: this.score });
    if (kind === 'perfect') X.audio('call');
  }

  end() {
    const X = this.X;
    this.done = true;
    this.st = 'end';
    const k = this.max ? this.score / this.max : 0;
    const gain = { speed: 0.35 * k, defence: 0.25 * k, power: 0.05 * k };
    X.train(gain);
    X.result = { mode: 'mitts', score: this.score, max: this.max, k, gain, log: this.log };
    if (X.hud) X.hud.drill({ end: true, score: this.score, max: this.max, k, gain });
    X.audio('bell3');
  }

  // the coach's arms: the pads up for the punch that is wanted (in front of his face for the straights, turned in at the side
  // for a hook, down for the uppercut), knocked back when hit; his swing for a slip / duck
  pose(c) {
    const X = this.X;
    const b = X.bout;
    const fig = c.fig;
    const S = fig.scale;
    const f = fig.forward;
    const r = fig.right;
    const hy = fig.j.neck.y + 0.06 * S;
    const nextM = this.want[this.got.length] || this.want[0] || 'jab';
    const m = MOVES[nextM];
    // (your lead hand - the jab, the hook - goes to his right pad; your rear hand to his left)
    const lead = m.hand === 'lead';
    const C = b.f[1];
    for (let i = 0; i < 2; i++) {
      const R = i === 0;
      const pad = R ? X.padR : X.padL;
      const mine = R === lead;
      const side = R ? 1 : -1;
      let ax = side * 0.15;
      let ay = hy;
      let az = 0.3;
      if (mine && m.kind === 1) {
        ax = side * 0.3;
        az = 0.22;
      } else if (mine && m.kind === 2) {
        ay = hy - 0.28;
        az = 0.28;
        ax = side * 0.06;
      }
      if (mine && m.body) ay = fig.j.hip.y + (fig.j.neck.y - fig.j.hip.y) * 0.55;
      if (!mine) {
        ay -= 0.06;
        az -= 0.06;
      }
      const kk = this.kick[R ? 0 : 1];
      az -= kk * 0.09;
      // (the swing at you: his right pad round at your head, as his hook goes in the bout)
      if (R && C.state === 'punch' && C.move) {
        const t = C.mt;
        const su = C.activeAt;
        const u = t < C.tell ? -0.3 * (t / Math.max(0.01, C.tell)) : Math.min(1, (t - C.tell) / Math.max(0.05, su - C.tell));
        const back = t > su + C.move.act ? Math.min(1, (t - su - C.move.act) / 0.3) : 0;
        const k = Math.max(-0.3, u) * (1 - back);
        const an = (1 - Math.max(0, k)) * 1.4 + (k < 0 ? -k * 1.2 : 0);
        ax = Math.sin(an) * 0.55 * side;
        az = Math.cos(an) * 0.62;
        ay = hy;
      }
      pad.set(fig.pos.x + (r.x * ax + f.x * az) * S, ay, fig.pos.z + (r.z * ax + f.z * az) * S);
    }
    fig.reachR = X.padR;
    fig.reachL = X.padL;
    fig.lookAt = X.lookB.copy(X.game.player.fig.j.headC);
  }

  drawPads(bodies, fig) {
    const P = this.X.game.player.fig;
    for (let i = 0; i < 2; i++) {
      const hd = i === 0 ? fig.j.handR : fig.j.handL;
      // (the pad's face to you)
      _u.subVectors(P.j.neck, hd);
      _u.y = 0;
      if (_u.lengthSq() < 1e-6) _u.copy(fig.forward);
      _u.normalize();
      _r.crossVectors(UP, _u).normalize();
      _c.copy(hd).addScaledVector(_u, 0.05);
      bodies.blob(_c, _r, UP, _u, 0.11, 0.13, 0.045, PAD_COL);
      _c.addScaledVector(_u, 0.035);
      bodies.blob(_c, _r, UP, _u, 0.055, 0.065, 0.02, PAD_RED);
    }
  }
}

// ------------------------------------------------------------------ the bags
// (ROADMAP 29.5) The heavy bag: thirty seconds, everything you have - how hard each lands, the best of them, the total (your
// power). The speed bag: a beat to keep, hand after hand (your speed). Each a target the bout's punches land on.
class BagDrill {
  constructor(X, kind, o) {
    this.X = X;
    this.kind = kind;
    this.len = o.time || (kind === 'speedbag' ? 25 : 30);
    this.t = -1.2;
    this.total = 0;
    this.best = 0;
    this.n = 0;
    this.beat = 0.36;
    this.on = 0;
    this.done = false;
  }

  update(dt, rdt) {
    if (this.done) return;
    const X = this.X;
    this.t += dt;
    if (this.t >= this.len) this.end();
    if (X.hud) X.hud.drill({ bag: this.kind, t: Math.max(0, this.len - Math.max(0, this.t)), total: this.total, best: this.best, n: this.n, on: this.on, wait: this.t < 0 });
  }

  event(e) {
    if (this.done || this.t < 0) return;
    const X = this.X;
    if ((e.type === 'hit' || e.type === 'stagger') && e.a === 0) {
      const m = MOVES[e.move];
      const p = e.dmg * 10;
      this.n++;
      if (this.kind === 'speedbag') {
        // (on the beat: each hit close to a beat of its clock)
        const ph = (this.t / this.beat) % 1;
        const off = Math.min(ph, 1 - ph) * this.beat;
        if (off < 0.06) this.on++;
        this.total += off < 0.06 ? 3 : off < 0.12 ? 2 : 1;
      } else {
        this.total += Math.round(p);
        this.best = Math.max(this.best, Math.round(p));
        X.audio('bag', 0.6 + p / 120);
      }
      if (X.onHit) {
        try {
          X.onHit(m.name, p);
        } catch (er) {
          // (the gym's own)
        }
      }
    }
  }

  end() {
    const X = this.X;
    this.done = true;
    const k = this.kind === 'speedbag' ? Math.min(1, this.total / (this.len * 6)) : Math.min(1, this.total / 2600);
    const gain = this.kind === 'speedbag' ? { speed: 0.4 * k } : { power: 0.4 * k, stamina: 0.2 * k };
    X.train(gain);
    X.result = { mode: this.kind, total: this.total, best: this.best, n: this.n, on: this.on, k, gain };
    if (X.hud) X.hud.drill({ bag: this.kind, end: true, total: this.total, best: this.best, n: this.n, k, gain });
    X.audio('bell3');
  }
}

export { PROFILES, LADDER, Rand };
