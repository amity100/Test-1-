import * as THREE from 'three';
import { buildPencilModel, PEN_BLUE } from './items.js';
import { BLACK_INK, RED_INK } from '../render/LineBatch.js';
import { groundHeight } from '../world/layout.js';
import { blendMatrix } from './materialize.js';
import { Fists, FISTS } from './fists.js';
import { clamp } from '../core/util.js';

// kind: melee (swung), gun (fires projectiles), throw (the thing itself flies), beam (a ray while
// the trigger is held). The first ones are the original arsenal; the rest are drawn from the new
// blueprints on the billboards around the city.
export const WEAPON_DEFS = {
  pencil: { id: 'pencil', name: 'עיפרון-מחק', kind: 'melee', damage: 34, rate: 2.4, range: 2.7 },
  paint: { id: 'paint', name: 'אקדח צבע', kind: 'gun', projectile: 'paint', damage: 10, rate: 7.5, speed: 46, gravity: 6, spread: 0.016, ammo: 90, hands: 1 },
  rifle: { id: 'rifle', name: 'רובה עפרונות', kind: 'gun', projectile: 'pencil', damage: 27, rate: 3.4, speed: 92, gravity: 2.5, spread: 0.005, ammo: 40, hands: 2 },
  bazooka: { id: 'bazooka', name: 'בזוקת מחקים', kind: 'gun', projectile: 'eraser', damage: 150, radius: 6.5, rate: 0.8, speed: 36, gravity: 4, spread: 0.004, ammo: 8, hands: 2 },
  // police gear you can pick up
  pen: { id: 'pen', name: 'עט-אקדח', kind: 'gun', projectile: 'ink', damage: 15, rate: 4, speed: 78, gravity: 3, spread: 0.008, ammo: 24, hands: 1, gear: true },
  m4: { id: 'm4', name: 'רובה צבע M4', kind: 'gun', projectile: 'paint', damage: 8, rate: 10, speed: 64, gravity: 4, spread: 0.02, ammo: 60, hands: 2, gear: true },
  bigEraser: { id: 'bigEraser', name: 'מחק בית-ספר ענק', kind: 'melee', damage: 62, rate: 1.7, range: 2.8, uses: 30, gear: true },
  // the new arsenal
  shotgun: { id: 'shotgun', name: 'רובה ציד צבעוני', kind: 'gun', projectile: 'crayon', pellets: 8, damage: 11, rate: 1.3, speed: 72, gravity: 3, spread: 0.07, ammo: 30, hands: 2, kick: 0.22, sound: 'shotgun' },
  stapler: { id: 'stapler', name: 'אקדח שדכן', kind: 'gun', projectile: 'staple', damage: 8, rate: 9, speed: 88, gravity: 1.2, spread: 0.02, ammo: 160, hands: 1, pin: 0.45, sound: 'staple' },
  katana: { id: 'katana', name: 'חרב סרגל', kind: 'melee', damage: 78, rate: 2.6, range: 3.3, arc: 1.5, slash: true },
  planes: { id: 'planes', name: 'משגר מטוסי נייר', kind: 'gun', projectile: 'plane', damage: 70, radius: 3.4, rate: 1.6, speed: 21, gravity: 0, spread: 0.03, ammo: 18, hands: 2, homing: 3.4, sound: 'whoosh' },
  inkbomb: { id: 'inkbomb', name: 'רימון דיו', kind: 'throw', projectile: 'inkbomb', damage: 125, radius: 5.5, rate: 1.1, speed: 17, gravity: 16, ammo: 6, hands: 1, fuse: 1.6 },
  glue: { id: 'glue', name: 'אקדח דבק', kind: 'gun', projectile: 'glue', damage: 6, rate: 3.2, speed: 40, gravity: 8, spread: 0.012, ammo: 40, hands: 1, stick: 4.5, sound: 'glue' },
  laser: { id: 'laser', name: 'לייזר מרקר זוהר', kind: 'beam', damage: 95, range: 90, ammo: 14, hands: 2 },
  boomerang: { id: 'boomerang', name: 'מספריים בומרנג', kind: 'throw', projectile: 'scissors', damage: 58, rate: 1.4, speed: 27, gravity: 0, range: 22, hands: 1 },
  minigun: { id: 'minigun', name: 'מיניגאן מחדדים', kind: 'gun', projectile: 'shaving', damage: 9, rate: 20, speed: 96, gravity: 2, spread: 0.04, ammo: 450, hands: 2, spin: true, sound: 'mini' },
  shield: { id: 'shield', name: 'מגן קרטון', kind: 'melee', damage: 24, rate: 1.5, range: 2.1, block: 0.85, uses: 80 },
  // the machine guns that rub the city out: correction fluid, little erasers, paint
  tippex: { id: 'tippex', name: 'מקלע טיפקס', kind: 'gun', projectile: 'tippex', damage: 13, rate: 11, speed: 64, gravity: 5, spread: 0.026, ammo: 280, hands: 2, sound: 'tippex' },
  erasermg: { id: 'erasermg', name: 'מקלע מחקים', kind: 'gun', projectile: 'rubber', damage: 15, rate: 12, speed: 82, gravity: 3, spread: 0.03, ammo: 320, hands: 2, sound: 'rubber' },
  paintmg: { id: 'paintmg', name: 'מקלע צבע', kind: 'gun', projectile: 'paintmg', damage: 11, rate: 14, speed: 58, gravity: 5, spread: 0.034, ammo: 380, hands: 2, sound: 'paint' },
};

export const GRADE = {
  perfect: { dmg: 1.3, ammo: 1.5, spread: 0.5, jam: 0, speed: 1.1, label: 'מושלם' },
  good: { dmg: 1, ammo: 1, spread: 1, jam: 0, speed: 1, label: 'טוב' },
  wonky: { dmg: 0.75, ammo: 0.9, spread: 3.2, jam: 0.12, speed: 0.85, label: 'עקום' },
  fail: { dmg: 0.25, ammo: 0.6, spread: 6, jam: 0.3, speed: 0.32, label: 'גרוע' },
};

const PAINT_COLORS = [[0.85, 0.35, 0.3], [0.3, 0.5, 0.85], [0.35, 0.7, 0.4], [0.9, 0.72, 0.25], [0.6, 0.4, 0.75]];
const CRAYONS = [[0.92, 0.3, 0.28], [0.98, 0.75, 0.18], [0.25, 0.55, 0.92], [0.35, 0.75, 0.38], [0.95, 0.5, 0.75], [0.6, 0.38, 0.85], [0.98, 0.55, 0.2]];
const GLUE = [0.97, 0.97, 0.94];
// correction fluid: whiter than the paper
const WHITE_OUT = [1.0, 1.0, 0.98];
const WHITE_TINT = [1.15, 1.15, 1.12];
const STEEL = [0.78, 0.8, 0.86];
const HIGHLIGHT = [2.6, 3.2, 0.55]; // brighter than white: the beam glows
const HIGHLIGHT_CORE = [3.4, 3.6, 2.4];
// (ROADMAP 11.11, parts 2) what a drawn thing's ink is, as it flies and where it lands
// (game/handparts.js): fire, a little blast, a shock, glue, water, a cloud of ink, a bouncing
// ball, correction fluid, light
const EL_COL = {
  fire: [1.0, 0.55, 0.12],
  blast: [1.0, 0.62, 0.22],
  shock: [1.0, 0.92, 0.3],
  glue: GLUE,
  water: [0.36, 0.7, 1.0],
  ink: [0.42, 0.3, 0.86],
  bounce: [1.0, 0.48, 0.78],
  tippex: WHITE_OUT,
  light: HIGHLIGHT,
};
const FLAME = [1.0, 0.62, 0.2];
// (the flames' own colours, as game/fire.js draws them)
const FLAMES = [[1.0, 0.86, 0.3], [1.0, 0.55, 0.12], [0.95, 0.3, 0.08], [1.0, 0.95, 0.6]];
const FLAME_HOT = [2.2, 1.3, 0.35];
const BOLT = [2.4, 2.2, 0.7];
const SCORCH = [0.08, 0.07, 0.08];
const WIND = [0.9, 0.94, 1.0];
// (what the people it hits take it as: correction fluid and little erasers rub out like a
// pencil's eraser, the paint machine gun's paint is paint)
const hurtOf = (kind) => (kind === 'tippex' || kind === 'rubber' ? 'pencil' : kind === 'paintmg' ? 'paint' : kind);
// (soft inks: no window breaks for them)
const SOFT_INK = new Set(['water', 'glue', 'ink', 'bounce']);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _u = new THREE.Vector3();
const _sm = new THREE.Matrix4();
const _om = new THREE.Matrix4();
const _UP = new THREE.Vector3(0, 1, 0);
const _hp = new THREE.Vector3();
const _hd = new THREE.Vector3();

/**
 * The hero's arsenal (pencil + weapons he drew), firing logic, projectiles of everyone.
 */
// (what does not break glass: paint, ink, glue, rubber... ROADMAP 8.3)
const SOFT_SHOTS = new Set(['ink', 'paintball', 'paint', 'crayon', 'glue', 'tippex', 'rubber', 'paintmg']);

export class Weapons {
  constructor(game) {
    this.game = game;
    const pencil = buildPencilModel();
    game.scene.add(pencil.group);
    this.slots = [{ def: WEAPON_DEFS.pencil, grade: 'good', ammo: Infinity, model: pencil }];
    this.index = 0;
    this.cooldown = 0;
    this.jam = 0;
    this.swingT = -1;
    this.swingHit = false;
    this.lastFire = -10;
    this.projectiles = [];
    this.aimPoint = new THREE.Vector3();
    this.aimHitEnemy = null;
    this.beam = null; // the highlighter's ray this frame: { a, b, hit }
    // the slots that are always there (not with ?classic: the pencil and the bare fists)
    this.keep = 1;
    this.fists = null;
    // (ROADMAP 11.11, parts 2) what drawn inks leave behind them: people alight, glue on the
    // ground, a bolt from one to the next, a gust's streaks
    this.burning = [];
    this.puddles = [];
    this.streaks = [];
    this.stab = false;
    this.chuteOpen = false;
    this.popT = -1;
    this.patchT = -1;
    this.cloudT = -9;
    this.gustT = -1;
    this._near = [];
  }

  // (ROADMAP 5.4, not with ?classic) the bare fists: second in the list, always there
  addFists() {
    this.fists = new Fists(this.game);
    this.slots.splice(1, 0, { def: FISTS, grade: 'good', ammo: Infinity, model: null });
    this.keep = 2;
  }

  // (the fists: where the strike turns you, and the guard; game/fists.js)
  get faceYaw() {
    return this.fists ? this.fists.faceYaw : null;
  }

  get guarding() {
    return this.fists !== null && this.fists.guarding;
  }

  get current() {
    return this.slots[this.index];
  }

  isAiming() {
    const c = this.current;
    if (c.def.kind !== 'gun' && c.def.kind !== 'beam') return false;
    const input = this.game.input;
    return input.fire || input.aim || this.game.time - this.lastFire < 1.0;
  }

  swinging() {
    return this.swingT >= 0 || (this.fists !== null && this.fists.busy);
  }

  add(def, grade, model, drawingScore) {
    const g = GRADE[grade];
    const slot = { def, grade, ammo: def.ammo ? Math.round(def.ammo * g.ammo) : Infinity, uses: def.uses, model, score: drawingScore, spin: 0 };
    // (a full magazine: ROADMAP 6.6)
    if (this.game.arsenal) this.game.arsenal.arm(slot);
    // replace an existing weapon of the same type
    const i = this.slots.findIndex((s) => s.def.id === def.id);
    if (i > 0) {
      this.removeModel(this.slots[i]);
      this.slots[i] = slot;
      this.select(i);
    } else {
      this.slots.push(slot);
      this.select(this.slots.length - 1);
    }
    this.game.scene.add(model.group);
    this.game.hud.updateWeapon();
  }

  removeModel(slot) {
    if (slot.model && slot.model.group) this.game.scene.remove(slot.model.group);
  }

  // a weapon used up: gone from the hands
  drop(slot, text) {
    this.game.hud.toast(text, 'info');
    this.removeModel(slot);
    const i = this.slots.indexOf(slot);
    if (i > 0) this.slots.splice(i, 1);
    this.select(0);
  }

  select(i) {
    if (i < 0 || i >= this.slots.length) return;
    this.index = i;
    this.jam = 0;
    this.game.hud.updateWeapon();
    this.game.audio.play('switch');
    // (the first time the fists come out: how a fight goes, ROADMAP 5.4)
    if (this.slots[i].def.bare && !this.fistsTold) {
      this.fistsTold = true;
      const touch = this.game.touch;
      this.game.hud.toast(touch ? 'אגרופים! לחיצה — מכה, שלוש ברצף — בעיטה · כפתור המגן — הגנה' : 'אגרופים! קליק — מכה, שלוש ברצף — בעיטה · קליק ימני — הגנה', 'info', 3.4);
    }
  }

  cycle(d = 1) {
    this.select((this.index + d + this.slots.length) % this.slots.length);
  }

  // where the crosshair points (world), using the camera ray
  computeAim() {
    const cam = this.game.camera;
    const dir = _v.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const o = cam.position;
    const world = this.game.world.collision.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, 400);
    let t = world ? world.t : 400;
    this.aimWorld = world;
    // ground plane
    if (dir.y < -1e-3) {
      const tg = (0.15 - o.y) / dir.y;
      if (tg > 0 && tg < t) {
        t = tg;
        this.aimWorld = null;
      }
    }
    const e = this.game.enemies.rayHit(o, dir, t);
    this.aimHitEnemy = null;
    if (e) {
      t = e.t;
      this.aimHitEnemy = e.enemy;
    }
    // never aim behind the player (in a car: where he sits)
    const P = this.game.player;
    const p = P.mode === 'vehicle' ? P.fig.pos : P.pos;
    const along = (p.x - o.x) * dir.x + (p.y + 1.4 - o.y) * dir.y + (p.z - o.z) * dir.z;
    if (t < along + 1.5) t = along + 1.5;
    this.aimPoint.set(o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t);
    return this.aimPoint;
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    const player = game.player;
    this.cooldown -= dt;
    if (this.jam > 0) this.jam -= dt;
    const slot = this.current;
    const def = slot.def;
    // (a thing just drawn is still turning real in the air: it is not in the hand yet)
    // (hands up, or cuffed: nothing in them, ROADMAP 6.3)
    const onFoot = player.mode === 'foot' && !game.inBar && !game.dialog.open && !slot.present && !(game.arrest && game.arrest.frozen);
    // (ROADMAP 4.7; not with ?classic) in a car or on a bike: a gun out of the window
    const v = player.inVehicle;
    const seated = !game.classic && player.mode === 'vehicle' && v && (v.kind === 'car' || v.kind === 'bike') && !v.dead && !game.dialog.open && !(game.garage && game.garage.state) && !(game.paintshop && game.paintshop.open);
    // (not from one with a cannon drawn on it: the click is the cannon's, ROADMAP 11.6)
    const driveBy = seated && def.kind === 'gun' && !slot.present && !v.turret;
    const canAct = onFoot || driveBy;
    this.beam = null;
    // weapon switching (1..9, 0 for the tenth; in a car the wheel is the camera's)
    if (onFoot || seated) {
      for (let k = 1; k <= 9; k++) if (input.wasPressed(`Digit${k}`)) this.select(k - 1);
      if (input.wasPressed('Digit0')) this.select(9);
      if (input.wheel && onFoot) this.cycle(input.wheel > 0 ? 1 : -1);
      if (input.wasPressed('KeyX')) this.cycle(1);
    }
    this.computeAim();
    // out of the window: the arm out to where you aim (the other hand stays on the wheel)
    this.shootOut = driveBy && (input.fire || input.aim || game.time - this.lastFire < 1.2);
    const fig = player.fig;
    if (this.shootOut) {
      const n = fig.j.neck;
      const a = this.aimPoint;
      let dy = Math.atan2(a.x - n.x, a.z - n.z) - fig.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      fig.aimYaw = dy;
      fig.aimPitch = Math.atan2(a.y - n.y, Math.hypot(a.x - n.x, a.z - n.z));
    } else if (fig.shootOut) fig.aimYaw = 0;
    fig.shootOut = this.shootOut;
    // the minigun's barrels spin up while the trigger is held, and wind down after
    if (def.spin) {
      const want = canAct && input.fire ? 1 : 0;
      slot.spin = Math.max(0, Math.min(1, slot.spin + (want ? dt * 1.5 : -dt * 0.9)));
      if (want && slot.spin < 0.4 && Math.random() < dt * 14) game.audio.play('click', 0.4);
    }
    if (canAct && def.kind === 'melee') {
      if ((input.firePressed || input.fire) && this.cooldown <= 0) {
        this.swingT = 0;
        this.swingHit = false;
        this.cooldown = 1 / def.rate;
        game.audio.play(def.slash ? 'slash' : 'swing');
      }
    } else if (canAct && (def.kind === 'gun' || def.kind === 'throw')) {
      const ready = !def.spin || slot.spin > 0.4;
      const out = def.projectile === 'scissors' && slot.out;
      // (ROADMAP 11.11, parts 2) a blade drawn on its mouth: someone right in front of you - a
      // stab, not a shot
      if (def.bayonet && onFoot && input.fire && this.cooldown <= 0 && this.swingT < 0 && this.within(def.bayonet.range)) {
        this.swingT = 0;
        this.swingHit = false;
        this.stab = true;
        this.cooldown = 0.6;
        game.audio.play('slash');
      // (not while it reloads, nor with its magazine empty: ROADMAP 6.6)
      } else if (input.fire && this.cooldown <= 0 && ready && !out && (!game.arsenal || game.arsenal.ready(slot))) {
        if (this.jam > 0) {
          // still jammed
        } else if (Math.random() < GRADE[slot.grade].jam) {
          this.jam = 1.3;
          this.cooldown = 0.4;
          const h = player.fig.j.handR;
          game.fx.mark('fx_jam', h.x, h.y + 0.6, h.z, 1.2, 1.3);
          game.audio.play('jam');
        } else if (def.kind === 'throw') this.throwItem(slot);
        else this.fireGun(slot);
      }
    } else if (canAct && def.kind === 'beam') {
      if (input.fire && slot.ammo > 0) this.fireBeam(slot, dt);
    }
    if (this.fists) {
      if (onFoot && def.bare) this.fists.update(dt, input);
      else this.fists.idle(player.fig, dt);
    }
    if (this.swingT >= 0) {
      this.swingT += dt / (def.slash || this.stab ? 0.3 : 0.36);
      if (!this.swingHit && this.swingT > 0.45) {
        this.swingHit = true;
        if (def.kind === 'melee') this.meleeHit(slot);
        else if (this.stab && def.bayonet) this.meleeHit(slot, { damage: def.bayonet.damage, range: def.bayonet.range, arc: 0.9, slash: true, element: def.element });
      }
      if (def.slash && this.swingT > 0.25 && this.swingT < 0.75) this.drawSlash(this.swingT, def.arc || 0);
      if (this.swingT >= 1) {
        this.swingT = -1;
        this.stab = false;
      }
    }
    player.fig.melee = this.swingT;
    player.fig.aim = this.shootOut ? 1 : (def.kind === 'gun' || def.kind === 'beam') && this.isAiming() && canAct ? def.hands : 0;
    this.updateProjectiles(dt);
  }

  // a projectile leaving the muzzle (or the hand)
  launch(slot, x, y, z, vx, vy, vz, extra = {}) {
    const def = slot.def;
    const g = GRADE[slot.grade];
    const sad = slot.grade === 'fail';
    const pr = {
      kind: def.projectile,
      owner: 'player',
      slot,
      x, y, z, vx, vy, vz,
      gravity: (def.gravity || 0) * (sad ? 5 : 1),
      damage: def.damage * g.dmg,
      radius: def.radius ? def.radius * (slot.grade === 'perfect' ? 1.2 : slot.grade === 'fail' ? 0.5 : 1) : 0,
      life: sad ? 1.5 : 4,
      // (a gun drawn freehand in colour fires its own colours: game/freeform.js)
      color: def.colors ? def.colors[Math.floor(Math.random() * def.colors.length)] : def.projectile === 'ink' ? PEN_BLUE : def.projectile === 'crayon' || def.projectile === 'paintmg' ? CRAYONS[Math.floor(Math.random() * CRAYONS.length)] : def.projectile === 'tippex' ? WHITE_OUT : PAINT_COLORS[Math.floor(Math.random() * PAINT_COLORS.length)],
      wobble: slot.grade === 'wonky' ? 1 : slot.grade === 'fail' ? 2 : 0,
      seed: Math.random() * 100,
      t: 0,
      // (a thing drawn freehand to throw flies as its own drawing)
      shape: slot.model && slot.model.shape ? slot.model.shape : null,
      bounce: def.bounce || 0,
      ...extra,
    };
    this.projectiles.push(pr);
    return pr;
  }

  fireGun(slot) {
    const game = this.game;
    const def = slot.def;
    const g = GRADE[slot.grade];
    const player = game.player;
    this.cooldown = 1 / (def.rate * (def.spin ? 0.3 + 0.7 * slot.spin : 1));
    this.lastFire = game.time;
    const sp = def.speed * g.speed;
    const sad = slot.grade === 'fail';
    const n = def.pellets || 1;
    // (ROADMAP 11.11, parts 2) its barrels as drawn: two fire together, three or more turn and
    // fire one after the other - each what its own ink is (game/handparts.js)
    const m = slot.model;
    const ms = m && m.muzzles && m.muzzles.length > 1 && m.group ? m.muzzles : null;
    const shots = def.volley || 1;
    // (a bent barrel: its shots bend after whoever is aimed at)
    const target = def.curve ? this.aimTarget() : null;
    let muzzle = null;
    for (let b = 0; b < shots; b++) {
      const k = def.volley ? b : (slot.shot = (slot.shot || 0) + 1);
      muzzle = ms ? _w.copy(ms[k % ms.length]).applyMatrix4(m.group.matrixWorld) : this.muzzleWorld(slot, _w);
      // (no barrel of its own in the model: side by side all the same)
      if (!ms && shots > 1) muzzle.y += (b - (shots - 1) / 2) * 0.07;
      const el = def.elements ? def.elements[k % def.elements.length] : def.element || null;
      const spe = el === 'light' ? sp * 1.4 : el === 'water' ? sp * 0.75 : sp;
      for (let i = 0; i < n; i++) {
        const dir = _v.copy(this.aimPoint).sub(muzzle).normalize();
        // (the shooting skill: ROADMAP 5.6, not with ?classic)
        const spread = def.spread * g.spread * (game.skills ? game.skills.spreadMul : 1);
        dir.x += (Math.random() - 0.5) * spread * 2;
        dir.y += (Math.random() - 0.5) * spread * 2;
        dir.z += (Math.random() - 0.5) * spread * 2;
        dir.normalize();
        const extra = {};
        if (def.projectile === 'plane') {
          // the planes leave a little up and to the side, then find their way
          _u.set((Math.random() - 0.5) * 0.3, 0.22, (Math.random() - 0.5) * 0.3);
          dir.add(_u).normalize();
          extra.homing = def.homing;
          extra.life = 6;
          extra.cruise = sp;
        }
        if (def.projectile === 'glue') extra.stick = def.stick;
        if (def.projectile === 'staple') extra.pin = def.pin;
        if (el) {
          extra.el = el;
          // (light flies straight and through a wall or two; water arcs down sooner)
          if (el === 'light') {
            extra.gravity = 0;
            extra.pierce = 2;
          } else if (el === 'water') extra.gravity = (def.gravity || 0) + 7;
        }
        if (target) {
          extra.curve = def.curve;
          extra.target = target;
        }
        // (out of a car's window: not into the car itself)
        if (player.inVehicle) extra.ignoreCar = player.inVehicle;
        // (risen from behind cover, ROADMAP 5.3: over its top, not into it)
        if (player.coverBox && player.coverPop > 0.3) extra.ignore = player.coverBox;
        this.launch(slot, muzzle.x, muzzle.y, muzzle.z, dir.x * spe, dir.y * spe + (sad ? 1 : 0), dir.z * spe, extra);
      }
      game.fx.muzzle(muzzle.x, muzzle.y, muzzle.z, def.quiet ? 0.35 : def.projectile === 'eraser' ? 1.8 : def.pellets ? 1.5 : 1);
    }
    slot.ammo--;
    if (game.arsenal) game.arsenal.fired(slot);
    // (a propeller on it: a gust out of its mouth too - the quicker it fires, the less each)
    if (def.wind) this.gust(muzzle, def.wind * Math.min(1, 2.5 / def.rate));
    // (a silencer on it: a soft click, and nobody further off hears it - no panic, no police)
    if (def.quiet) game.audio.play('staple', 0.4);
    else game.audio.play(def.sound || (def.projectile === 'paint' ? 'paint' : def.projectile === 'pencil' ? 'pencilShot' : 'bazooka'));
    game.camRig.addShake((def.kick || (def.projectile === 'eraser' ? 0.35 : 0.04)) * (game.skills ? game.skills.kickMul : 1));
    const at = player.inVehicle ? player.inVehicle.pos : player.pos;
    if (def.quiet) game.enemies.noise(at, 5);
    else {
      game.enemies.noise(at, 32);
      game.civilians.panic(at, 40);
      game.onCrime('shoot', at.x, at.z);
    }
    if (slot.ammo <= 0) this.drop(slot, `ה${def.name} נגמר — אפשר לצייר אותו שוב`);
    game.hud.updateWeapon();
  }

  // thrown things: an ink bottle lobbed onto the spot you aim at, the scissors sent spinning
  throwItem(slot) {
    const game = this.game;
    const def = slot.def;
    const g = GRADE[slot.grade];
    const player = game.player;
    this.cooldown = 1 / def.rate;
    this.lastFire = game.time;
    this.swingT = 0;
    this.swingHit = true;
    const h = player.fig.j.handR;
    const from = _w.set(h.x, h.y + 0.15, h.z);
    const to = this.aimPoint;
    if (def.projectile === 'inkbomb') {
      // a lob that lands where you aim (not too near, not too far)
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const dh = Math.min(38, Math.max(4, Math.hypot(dx, dz)));
      const hx = dx / (Math.hypot(dx, dz) || 1);
      const hz = dz / (Math.hypot(dx, dz) || 1);
      const sh = def.speed * g.speed;
      const T = dh / sh;
      const G = def.gravity;
      const ty = Math.max(to.y, groundHeight(from.x + hx * dh, from.z + hz * dh));
      const vy = (ty - from.y + 0.5 * G * T * T) / T;
      this.launch(slot, from.x, from.y, from.z, hx * sh, vy, hz * sh, { fuse: def.fuse, life: def.fuse + 0.3, spin: 0, el: def.element || null });
      slot.ammo--;
      game.audio.play('swing');
      if (slot.ammo <= 0) this.drop(slot, 'נגמרו בקבוקי הדיו — אפשר לצייר עוד');
    } else {
      // the scissors: straight out to the aim (or as far as they go), then home
      const dir = _v.copy(to).sub(from).normalize();
      const sp = def.speed * g.speed;
      const range = Math.min(def.range * (slot.grade === 'perfect' ? 1.25 : 1), Math.max(6, from.distanceTo(to) + 2));
      this.launch(slot, from.x, from.y, from.z, dir.x * sp, dir.y * sp, dir.z * sp, { outT: range / sp, back: false, hits: new Set(), life: 9, spin: 0, gravity: 0, el: def.element || null });
      slot.out = true;
      game.audio.play('scissors');
    }
    game.hud.updateWeapon();
  }

  // the highlighter: a ray of neon light from the tip to wherever you aim, rubbing out whatever
  // it rests on
  fireBeam(slot, dt) {
    const game = this.game;
    const def = slot.def;
    const g = GRADE[slot.grade];
    const player = game.player;
    this.lastFire = game.time;
    slot.ammo = Math.max(0, slot.ammo - dt);
    const a = this.muzzleWorld(slot, new THREE.Vector3());
    const b = this.aimPoint.clone();
    const len = a.distanceTo(b);
    if (len > def.range) b.sub(a).setLength(def.range).add(a);
    // wonky drawings shake their beam about
    if (slot.grade === 'wonky' || slot.grade === 'fail') {
      const w = slot.grade === 'fail' ? 1.6 : 0.6;
      b.x += Math.sin(game.time * 13) * w;
      b.y += Math.sin(game.time * 17 + 1) * w * 0.5;
      b.z += Math.cos(game.time * 11) * w;
    }
    const d = _v.copy(b).sub(a);
    const L = d.length();
    let hitEnemy = null;
    let hitCiv = null;
    let tHit = 1;
    const eh = game.enemies.segmentHit(a.x, a.y, a.z, d.x, d.y, d.z, 1);
    if (eh) {
      hitEnemy = eh;
      tHit = eh.t;
    }
    const ch = game.civilians.segmentHit(a.x, a.y, a.z, d.x, d.y, d.z, tHit);
    if (ch) {
      hitCiv = ch;
      hitEnemy = null;
      tHit = ch.t;
    }
    b.copy(a).addScaledVector(d, tHit);
    this.beam = { a, b, slot };
    slot.beamAcc = (slot.beamAcc || 0) + dt;
    if (slot.beamAcc >= 0.08) {
      const k = slot.beamAcc;
      slot.beamAcc = 0;
      const dmg = def.damage * g.dmg * k;
      if (hitEnemy) {
        game.enemies.damage(hitEnemy.enemy, hitEnemy.part, dmg, b.clone(), d.clone().normalize(), 'beam');
      } else if (hitCiv) {
        game.civilians.damage(hitCiv.civ, b.clone(), 'beam', dmg);
      } else if (L < def.range - 0.5) {
        // a wall or the street: the light rubs a hole into it, bit by bit
        const w = this.aimWorld;
        game.eraseWorld(b.x, b.y, b.z, 0.32, dmg * 0.8, w ? w.box : null, w || null);
        game.fx.sparks(b.x, b.y, b.z, 2, [0.95, 1, 0.3]);
      }
      game.enemies.noise(player.pos, 20);
      game.civilians.panic(player.pos, 25);
      game.onCrime('shoot', player.pos.x, player.pos.z);
      game.audio.play('laser', 0.6);
    }
    if (slot.ammo <= 0) this.drop(slot, 'המרקר הזוהר התייבש — אפשר לצייר חדש');
    game.hud.updateWeapon();
  }

  muzzleWorld(slot, out) {
    const m = slot.model;
    if (m && m.muzzle && m.group) return out.copy(m.muzzle).applyMatrix4(m.group.matrixWorld);
    const h = this.game.player.fig.j.handR;
    return out.copy(h);
  }

  // over: what strikes instead of the weapon itself (a bayonet on a gun's mouth: ROADMAP 11.11)
  meleeHit(slot, over = null) {
    const game = this.game;
    const p = game.player;
    const def = over || slot.def;
    const f = p.fig.forward;
    const reach = def.range;
    // the eraser end rubs out the bit of body nearest to it
    const tipL = over && slot.model.muzzle ? slot.model.muzzle : slot.model.tip;
    const tip = tipL ? _v.copy(tipL).applyMatrix4(slot.model.group.matrixWorld) : _v.copy(p.fig.j.handR);
    const half = def.arc ? def.arc / 2 + 0.45 : 1.25;
    const hits = game.enemies.inArc(p.pos, f, reach, half);
    let any = false;
    const kind = def.slash ? 'slash' : 'melee';
    // (ROADMAP 11.11, parts 2) what its ink does (a blade drawn in red sets them alight...)
    const el = def.element || null;
    for (const e of hits) {
      if (e.isMonster) game.enemies.damage(e, 'body', def.damage, e.fig.center.clone(), f, kind);
      else {
        game.enemies.damage(e, null, def.damage, e.fig.closestSurfacePoint(tip, new THREE.Vector3()), f, kind);
        if (def.slash && e.alive) {
          // the edge goes on through: a second cut a little lower
          const c = e.fig.center.clone().addScaledVector(f, -0.1);
          c.y -= 0.25;
          game.enemies.damage(e, null, def.damage * 0.6, e.fig.closestSurfacePoint(c, new THREE.Vector3()), f, kind);
        }
      }
      // (a heavy head drawn on a hammer sends them further: game/freeform.js)
      const kn = def.knock || (def.slash ? 3 : 5);
      // (all round: away from you, wherever they stood)
      if (def.arc >= 6) {
        const dx = e.pos.x - p.pos.x;
        const dz = e.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        e.knock((dx / d) * kn, (dz / d) * kn);
      } else e.knock(f.x * kn, f.z * kn);
      if (el && e.alive) this.inkOn(el, e, false, e.fig.center, f, def.damage);
      any = true;
    }
    for (const c of game.civilians.inArc(p.pos, f, reach, half)) {
      game.civilians.damage(c, c.fig.closestSurfacePoint(tip, new THREE.Vector3()), kind, def.damage);
      if (el && c.alive) this.inkOn(el, c, true, c.fig.center, f, def.damage);
      any = true;
    }
    if (!any) {
      // nobody there: the eraser rubs out whatever is in front (cars, lamps, walls, the street)
      // (a toothed blade saws: more of it, ROADMAP 11.11)
      const saw = def.saw ? 1.6 : 1;
      const c = game.traffic.inArc(p.pos, f, reach + 1.2);
      if (c) {
        game.traffic.rub(c, def.damage * saw, tip);
        if (el === 'fire' && game.damage && Math.random() < 0.35) game.damage.ignite(c, 1 + Math.random() * 2);
        any = true;
      } else {
        const col = game.world.collision;
        for (const hy of [1.25, 0.6]) {
          const h = col.raycast(p.pos.x, p.pos.y + hy, p.pos.z, f.x, 0, f.z, reach + 0.4, 'bound');
          if (h) {
            game.eraseWorld(h.x, h.y, h.z, (def.slash ? 0.55 : 0.42) * saw, def.damage * saw, h.box, h);
            if (def.slash) game.eraseWorld(h.x, h.y + 0.55, h.z, 0.45 * saw, def.damage * 0.7 * saw, h.box, h);
            if (def.saw) game.eraseWorld(h.x, h.y - 0.5, h.z, 0.45 * saw, def.damage * 0.7 * saw, h.box, h);
            if (el) this.inkAt(el, h, def.damage);
            any = true;
            break;
          }
        }
        if (!any && game.camRig.pitch < -0.35) {
          // looking down: rub out the ground in front of your feet
          const gx = p.pos.x + f.x * 1.3;
          const gz = p.pos.z + f.z * 1.3;
          const gy = groundHeight(gx, gz);
          game.eraseWorld(gx, gy, gz, 0.5 * saw, def.damage * saw, null, null);
          if (el) this.inkAt(el, { x: gx, y: gy, z: gz, nx: 0, ny: 1, nz: 0, box: null }, def.damage);
          any = true;
        }
      }
    }
    if (any) {
      game.audio.play(def.slash ? 'snip' : 'erase');
      game.camRig.addShake(def.id === 'bigEraser' ? 0.2 : def.slash ? 0.16 : 0.12);
      game.fx.crumbs(tip.x, tip.y, tip.z, def.id === 'bigEraser' ? 26 : 14, 3);
      if (!over && slot.uses !== undefined) {
        // a real eraser wears down as you use it
        slot.uses--;
        if (slot.uses <= 0) this.drop(slot, `ה${def.name} נשחק עד הסוף`);
        game.hud.updateWeapon();
      }
    }
  }

  // the cardboard shield: a hit from the front is mostly stopped by it (returns what gets through);
  // kind: 'melee' for a blow (the fists' guard takes only those), src: who swung it
  block(amount, fromX, fromZ, kind = null, src = null) {
    const slot = this.current;
    if (slot.def.bare && this.fists && !this.off) return this.fists.block(amount, fromX, fromZ, kind, src);
    const p = this.game.player;
    // (the shield in the hand - or a drawn one in the other hand, whatever this one is: ROADMAP 11.8)
    const S = slot.def.block ? slot : this.off;
    // (ROADMAP 11.11, parts 2) a guard drawn across a blade: a blow from the front, turned a little
    if (!S && slot.def.parry && p.mode === 'foot' && this.swingT < 0) {
      const dx = fromX - p.pos.x;
      const dz = fromZ - p.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const f = p.fig.forward;
      if ((dx * f.x + dz * f.z) / d < 0.3) return amount;
      const h = p.fig.j.handR;
      this.game.fx.sparks(h.x + f.x * 0.3, h.y + 0.2, h.z + f.z * 0.3, 4, STEEL);
      this.game.audio.play('clang', 0.4);
      return amount * (1 - slot.def.parry);
    }
    if (!S || p.mode !== 'foot' || (S === slot && this.swingT >= 0)) return amount;
    const dx = fromX - p.pos.x;
    const dz = fromZ - p.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const f = p.fig.forward;
    if ((dx * f.x + dz * f.z) / d < 0.3) return amount;
    const game = this.game;
    const h = S === slot ? p.fig.j.handR : p.fig.j.handL;
    game.fx.sparks(h.x + f.x * 0.3, h.y + 0.2, h.z + f.z * 0.3, 5, [0.62, 0.45, 0.25]);
    game.audio.play('block');
    // (a shield wears down; one drawn on a weapon, its knack, lasts as long as the weapon does)
    if (S.uses !== undefined) {
      S.uses--;
      if (S.uses <= 0) {
        if (S === this.off) {
          this.clearOff();
          game.hud.toast('המגן נקרע — אפשר לצייר חדש', 'info');
        } else this.drop(slot, 'המגן נקרע — אפשר לצייר חדש');
      }
      game.hud.updateWeapon();
    }
    return amount * (1 - S.def.block * (S.grade === 'fail' ? 0.5 : 1));
  }

  // (ROADMAP 11.8) a shield drawn together with a weapon (game/freeform.js readArmed): in the other
  // hand, whatever is in this one - held up in front of you, it stops most of a hit from the front
  setOff(def, grade, model, free = null) {
    this.clearOff();
    this.off = { def, grade, uses: def.uses, model, free };
    model.group.matrixAutoUpdate = false;
    this.game.scene.add(model.group);
  }

  clearOff() {
    if (!this.off) return;
    this.game.scene.remove(this.off.model.group);
    const fig = this.game.player.fig;
    if (fig && fig.carryL === 'dshield') fig.carryL = null;
    this.off = null;
  }

  // the shield in the other hand: up in front of the chest on the left, its face to the front
  // (game/carry.js puts the hand there)
  offModel(p, drawing) {
    const fig = p.fig;
    const g = this.off.model.group;
    const on = !drawing && p.mode === 'foot' && !p.inVehicle && !this.game.inBar;
    g.visible = on;
    if (on && (!fig.carryL || fig.carryL === 'dshield')) fig.carryL = 'dshield';
    else if (!on && fig.carryL === 'dshield') fig.carryL = null;
    if (!on) return;
    const f = _u.copy(fig.forward).setY(0).normalize();
    const side = _w.set(0, 1, 0).cross(f).negate();
    const h = fig.j.handL;
    _om.makeBasis(f, _UP, side);
    _om.setPosition(h.x + f.x * 0.16 - fig.right.x * 0.04, h.y + 0.1, h.z + f.z * 0.16 - fig.right.z * 0.04);
    g.matrix.copy(_om);
    g.matrixWorldNeedsUpdate = true;
    g.updateMatrixWorld(true);
  }

  // the ruler's edge leaves a bright arc in the air (arc: a blade at each end of its grip spins,
  // all the way round - ROADMAP 11.11)
  drawSlash(t, arc = 0) {
    const fr = this.game.figures;
    const p = this.game.player;
    const f = p.fig.forward;
    const r = p.fig.right;
    const k = (t - 0.25) / 0.5;
    const cx = p.pos.x;
    const cy = p.pos.y + 1.2;
    const cz = p.pos.z;
    const full = arc >= 6;
    const from = full ? -Math.PI : -1.1;
    const span = full ? Math.PI * 2 : 2.2;
    const n = full ? 16 : 7;
    for (let i = 0; i < n; i++) {
      const a0 = from + (i / n) * span;
      const a1 = from + ((i + 1) / n) * span;
      const R = 2.1;
      const y0 = full ? 0.15 : 0.5 - (i / n) * 0.9;
      const y1 = full ? 0.15 : 0.5 - ((i + 1) / n) * 0.9;
      const fade = (1 - k) * Math.max(0, 1 - Math.abs(i / n - k) * 2.2);
      if (fade < 0.05) continue;
      fr.lineXYZ(
        cx + (f.x * Math.cos(a0) + r.x * Math.sin(a0)) * R, cy + y0, cz + (f.z * Math.cos(a0) + r.z * Math.sin(a0)) * R,
        cx + (f.x * Math.cos(a1) + r.x * Math.sin(a1)) * R, cy + y1, cz + (f.z * Math.cos(a1) + r.z * Math.sin(a1)) * R,
        [1.6, 1.5, 1.1], 6, 40 + i, fade, 0.01, 0,
      );
    }
  }

  // Position held models each frame (called after the figure pose is updated).
  updateModels() {
    const p = this.game.player;
    const drawing = p.mode === 'draw';
    if (this.off) this.offModel(p, drawing);
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.model || !s.model.group) continue;
      s.model.group.visible = drawing ? i === 0 : i === this.index && (p.mode === 'foot' || this.shootOut) && !this.game.inBar && !s.out;
    }
    const fig = p.fig;
    const j = fig.j;
    if (drawing) {
      // the graphite tip points at the line being drawn in the air
      const pencil = this.slots[0];
      const dir = fig.reachR ? _v.copy(j.handR).sub(fig.reachR) : _v.copy(fig.forward).negate();
      pencil.model.group.matrix.copy(p.holdMatrix(dir));
      pencil.model.group.matrixWorldNeedsUpdate = true;
      pencil.model.group.updateMatrixWorld(true);
      return;
    }
    const slot = this.current;
    if (!slot.model || (p.mode !== 'foot' && !this.shootOut)) return;
    let m;
    const def = slot.def;
    if (def.kind === 'melee' || def.kind === 'throw') {
      const dir = _v.copy(j.handR).sub(j.elbowR);
      if (this.swingT >= 0) dir.copy(j.handR).sub(j.shoulder);
      dir.normalize();
      // idle: rests diagonally, the business end up and out
      if (this.swingT < 0) dir.lerp(_w.set(fig.forward.x * 0.35, 0.85, fig.forward.z * 0.35).addScaledVector(fig.right, 0.25), 0.7).normalize();
      m = p.holdMatrix(dir);
      if (def.block && !def.knack) {
        // the shield: held up in front of the chest, its face to the front (pushed out for a bash)
        const f = _u.copy(fig.forward).setY(0).normalize();
        const up = _w.set(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(f, up);
        const bash = this.swingT >= 0 ? Math.sin(Math.min(1, this.swingT) * Math.PI) * 0.45 : 0;
        const h = j.handR;
        m.makeBasis(f, up, side);
        m.setPosition(h.x + f.x * (0.22 + bash) - fig.right.x * 0.12, h.y + 0.18, h.z + f.z * (0.22 + bash) - fig.right.z * 0.12);
      }
    } else {
      const dir = fig.aim ? _v.copy(this.aimPoint).sub(j.handR).normalize() : _v.copy(fig.forward).multiplyScalar(0.6).add(_w.set(0, -0.8, 0)).normalize();
      m = p.holdMatrix(dir);
      if (def.spin && slot.model.barrel) {
        // the ring of pencils spins up
        slot.model.barrel.rotation.z = (slot.barrelA = (slot.barrelA || 0) + slot.spin * 0.9);
        m.multiply(_sm.makeTranslation(0, Math.sin(this.game.time * 70) * 0.002 * slot.spin, 0));
      }
    }
    if (slot.present) {
      // just drawn: it hangs in the air where it was drawn (turning real), then into the hand
      blendMatrix(slot.present.matrix, m, slot.present.k, m, 0.3);
    } else if (slot.popAt !== undefined) {
      // freshly drawn: plops into the hand with a little overshoot
      const t = (this.game.time - slot.popAt) / 0.45;
      if (t < 1) {
        const k = t - 1;
        m.multiply(_sm.makeScale(...Array(3).fill(Math.max(0.05, 1 + 2.70158 * k * k * k + 1.70158 * k * k))));
      } else slot.popAt = undefined;
    }
    slot.model.group.matrix.copy(m);
    slot.model.group.matrixWorldNeedsUpdate = true;
    slot.model.group.updateMatrixWorld(true);
  }

  // ------------------------------------------------------------------ projectiles
  // ignore: the box the shooter is crouched behind (shots go over its hood)
  // kind: 'enemy' (scribble bullet), 'ink' (police pen-pistol), 'paintball' (paint M4)
  // (from: who fired it, ROADMAP 6.3 - the police would rather take you alive)
  spawnEnemyShot(x, y, z, dx, dy, dz, damage, speed = 40, ignore = null, kind = 'enemy', from = null) {
    const color = kind === 'paintball' ? PAINT_COLORS[Math.floor(Math.random() * PAINT_COLORS.length)] : kind === 'ink' ? PEN_BLUE : null;
    this.projectiles.push({ kind, owner: 'enemy', x, y, z, vx: dx * speed, vy: dy * speed, vz: dz * speed, gravity: 0.5, damage, radius: 0, life: 2.5, t: 0, seed: Math.random() * 100, wobble: 0, ignore, color, from });
  }

  spawnShell(x, y, z, dx, dy, dz, owner, damage, radius, speed = 45, kind = 'shell') {
    this.projectiles.push({ kind, owner, x, y, z, vx: dx * speed, vy: dy * speed, vz: dz * speed, gravity: 3, damage, radius, life: 4, t: 0, seed: Math.random() * 100, wobble: 0 });
  }

  // a paper plane looks for someone to fly at (a little ahead of it, not behind)
  steerPlane(pr, dt) {
    const game = this.game;
    pr.lookT = (pr.lookT || 0) - dt;
    if (pr.lookT <= 0) {
      pr.lookT = 0.25;
      let best = null;
      let bs = -Infinity;
      const sp = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
      for (const e of game.enemies.list) {
        if (!e.alive) continue;
        const dx = e.pos.x - pr.x;
        const dy = e.pos.y + 1.1 - pr.y;
        const dz = e.pos.z - pr.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > 55) continue;
        const cos = (dx * pr.vx + dy * pr.vy + dz * pr.vz) / (d * sp);
        if (cos < 0.2) continue;
        const sc = cos * 2 - d / 30;
        if (sc > bs) {
          bs = sc;
          best = e;
        }
      }
      pr.target = best;
    }
    const cruise = pr.cruise || 20;
    if (pr.target && pr.target.alive && pr.t > 0.18) {
      const e = pr.target;
      const want = _u.set(e.pos.x - pr.x, e.pos.y + 1.1 - pr.y, e.pos.z - pr.z).normalize().multiplyScalar(cruise);
      const k = 1 - Math.exp(-pr.homing * dt);
      pr.vx += (want.x - pr.vx) * k;
      pr.vy += (want.y - pr.vy) * k;
      pr.vz += (want.z - pr.vz) * k;
    } else {
      // nobody to chase: it glides on, slowly losing height
      pr.vy -= 1.2 * dt;
    }
    const s = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
    const sc = cruise / s;
    pr.vx *= sc;
    pr.vy *= sc;
    pr.vz *= sc;
  }

  // the scissors fly out, then come back to the hand
  steerScissors(pr, dt) {
    const p = this.game.player;
    pr.spin += dt * 22;
    if (!pr.back && pr.t > pr.outT) pr.back = true;
    if (pr.back) {
      const h = p.fig.j.handR;
      const want = _u.set(h.x - pr.x, h.y - pr.y, h.z - pr.z);
      const d = want.length();
      if (d < 0.9 || pr.t > 8.5) {
        // caught
        pr.caught = true;
        if (pr.slot) pr.slot.out = false;
        this.game.audio.play('snip', 0.6);
        return;
      }
      const sp = Math.min(34, 14 + pr.t * 8);
      want.multiplyScalar(sp / d);
      const k = 1 - Math.exp(-6 * dt);
      pr.vx += (want.x - pr.vx) * k;
      pr.vy += (want.y - pr.vy) * k;
      pr.vz += (want.z - pr.vz) * k;
    }
  }

  updateProjectiles(dt) {
    const game = this.game;
    const col = game.world.collision;
    const fr = game.figures;
    const keep = [];
    for (const pr of this.projectiles) {
      pr.t += dt;
      if (pr.kind === 'scissors') {
        this.steerScissors(pr, dt);
        if (pr.caught) continue;
      } else if (pr.t > pr.life) {
        if (pr.kind === 'inkbomb') this.inkBurst(pr, pr.x, pr.y, pr.z);
        else if (pr.kind === 'plane') this.planeBurst(pr, pr.x, pr.y, pr.z);
        continue;
      }
      if (pr.kind === 'inkbomb' && pr.t > pr.fuse) {
        this.inkBurst(pr, pr.x, pr.y, pr.z);
        continue;
      }
      if (pr.kind === 'plane') this.steerPlane(pr, dt);
      else if (pr.curve && pr.target) this.steerCurve(pr, dt);
      if (pr.wobble) {
        const w = pr.wobble * 6;
        pr.vx += Math.sin(pr.t * 13 + pr.seed) * w * dt * 3;
        pr.vz += Math.cos(pr.t * 11 + pr.seed) * w * dt * 3;
      }
      pr.vy -= pr.gravity * dt;
      const ox = pr.x;
      const oy = pr.y;
      const oz = pr.z;
      const nx = ox + pr.vx * dt;
      const ny = oy + pr.vy * dt;
      const nz = oz + pr.vz * dt;
      const dx = nx - ox;
      const dy = ny - oy;
      const dz = nz - oz;
      const len = Math.hypot(dx, dy, dz) || 1e-6;
      let hitT = 1;
      let hit = null;
      const wh = col.raycast(ox, oy, oz, dx, dy, dz, len, pr.ignore || null);
      if (wh) {
        hitT = wh.t / len;
        hit = { type: 'world', x: wh.x, y: wh.y, z: wh.z, nx: wh.nx, ny: wh.ny, nz: wh.nz, box: wh.box };
      }
      const gy = groundHeight(nx, nz);
      if (ny < gy) {
        const tg = (oy - gy) / Math.max(1e-4, oy - ny);
        if (tg >= 0 && tg < hitT) {
          hitT = tg;
          hit = { type: 'world', x: ox + dx * tg, y: gy, z: oz + dz * tg, nx: 0, ny: 1, nz: 0 };
        }
      }
      if (pr.owner === 'player') {
        const eh = game.enemies.segmentHit(ox, oy, oz, dx, dy, dz, hitT);
        if (eh) {
          hitT = eh.t;
          hit = { type: 'enemy', enemy: eh.enemy, part: eh.part, x: ox + dx * eh.t, y: oy + dy * eh.t, z: oz + dz * eh.t };
        }
        const ch = game.civilians.segmentHit(ox, oy, oz, dx, dy, dz, hitT);
        if (ch) {
          hitT = ch.t;
          hit = { type: 'civ', civ: ch.civ, x: ox + dx * ch.t, y: oy + dy * ch.t, z: oz + dz * ch.t };
        }
      } else {
        const ph = game.playerSegmentHit(ox, oy, oz, dx, dy, dz, hitT);
        if (ph) {
          hitT = ph.t;
          hit = { type: 'player', x: ox + dx * ph.t, y: oy + dy * ph.t, z: oz + dz * ph.t };
        }
      }
      // (ROADMAP 4.7) the cars going by stop shots too, and take them (not the one shot from)
      if (!game.classic && pr.kind !== 'scissors') {
        const vh = game.traffic.segmentHit(ox, oy, oz, dx, dy, dz, hitT, pr.ignoreCar || null);
        if (vh) {
          hitT = vh.t;
          hit = { type: 'car', car: vh.car, own: vh.own, x: ox + dx * vh.t, y: oy + dy * vh.t, z: oz + dz * vh.t, nx: vh.nx, ny: vh.ny, nz: vh.nz };
        }
      }
      if (hit && pr.kind === 'scissors') {
        // they cut through people and fly on; a wall sends them straight back
        if (hit.type === 'enemy' || hit.type === 'civ') {
          const who = hit.enemy || hit.civ;
          if (!pr.hits.has(who)) {
            pr.hits.add(who);
            this.onHit(pr, hit, dx / len, dy / len, dz / len);
          }
          hit = null;
        } else if (hit.type === 'world') {
          if (!pr.back) {
            pr.back = true;
            game.fx.sparks(hit.x, hit.y, hit.z, 5, STEEL);
            game.audio.play('clang', 0.7);
            if (hit.box) game.eraseWorld(hit.x, hit.y, hit.z, 0.3, pr.damage * 0.5, hit.box, hit);
          }
          pr.vx *= -0.3;
          pr.vy *= -0.3;
          pr.vz *= -0.3;
          hit = null;
          keep.push(pr);
          this.drawProjectile(fr, pr);
          continue;
        }
      }
      // (ROADMAP 11.11, parts 2) a shot of light: on through a wall or two, a hole where it went
      if (hit && hit.type === 'world' && pr.pierce > 0 && hit.box && Math.abs(hit.ny || 0) < 0.6) {
        game.eraseWorld(hit.x, hit.y, hit.z, 0.22, pr.damage, hit.box, hit);
        game.fx.sparks(hit.x, hit.y, hit.z, 4, EL_COL.light);
        pr.pierce--;
        pr.damage *= 0.75;
        pr.ignore = hit.box;
        pr.x = hit.x + (dx / len) * 0.4;
        pr.y = hit.y + (dy / len) * 0.4;
        pr.z = hit.z + (dz / len) * 0.4;
        keep.push(pr);
        this.drawProjectile(fr, pr);
        continue;
      }
      // (ROADMAP 11.8) a gun drawn on a spring: its shots bounce off the walls and the ground
      if (hit && hit.type === 'world' && pr.bounce > 0) {
        const n = _u.set(hit.nx || 0, hit.ny || 0, hit.nz || 0);
        if (n.lengthSq() > 0.5) {
          const vn = pr.vx * n.x + pr.vy * n.y + pr.vz * n.z;
          pr.vx = (pr.vx - 2 * vn * n.x) * 0.85;
          pr.vy = (pr.vy - 2 * vn * n.y) * 0.85;
          pr.vz = (pr.vz - 2 * vn * n.z) * 0.85;
          pr.x = hit.x + n.x * 0.06;
          pr.y = hit.y + n.y * 0.06;
          pr.z = hit.z + n.z * 0.06;
          pr.bounce--;
          game.fx.sparks(hit.x, hit.y, hit.z, 3, [1, 0.9, 0.6]);
          keep.push(pr);
          this.drawProjectile(fr, pr);
          continue;
        }
      }
      if (hit && pr.kind === 'inkbomb' && hit.type === 'world') {
        // the bottle bounces and rolls until its fuse burns down
        const n = _u.set(hit.nx || 0, hit.ny || 1, hit.nz || 0);
        const vn = pr.vx * n.x + pr.vy * n.y + pr.vz * n.z;
        pr.vx = (pr.vx - 2 * vn * n.x) * 0.45;
        pr.vy = (pr.vy - 2 * vn * n.y) * 0.4;
        pr.vz = (pr.vz - 2 * vn * n.z) * 0.45;
        pr.x = hit.x + n.x * 0.12;
        pr.y = hit.y + n.y * 0.12;
        pr.z = hit.z + n.z * 0.12;
        if (Math.abs(vn) > 2) game.audio.play('clang', 0.35);
        keep.push(pr);
        this.drawProjectile(fr, pr);
        continue;
      }
      if (hit) {
        this.onHit(pr, hit, dx / len, dy / len, dz / len);
        continue;
      }
      // a near miss makes them duck
      if (pr.owner === 'player') game.enemies.whiz(ox, oy, oz, dx, dy, dz);
      pr.x = nx;
      pr.y = ny;
      pr.z = nz;
      keep.push(pr);
      this.drawProjectile(fr, pr);
    }
    this.projectiles = keep;
    if (this.beam) this.drawBeam(fr, this.beam);
    if (this.burning.length || this.puddles.length || this.streaks.length) this.updateInks(dt, fr);
  }

  // the ink bottle goes off: a huge blot that rubs out everyone around it
  inkBurst(pr, x, y, z) {
    const game = this.game;
    game.explosion(x, y, z, pr.radius || 5, pr.damage, pr.owner);
    // (a bomb drawn in colour: its ink all round, ROADMAP 11.11)
    if (pr.el) this.inkRound(pr.el, x, y, z, pr.radius || 5, pr.damage);
    const gy = groundHeight(x, z) + 0.02;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (pr.radius || 5) * 0.35;
      game.fx.decal(Math.random() < 0.5 ? 'splat0' : 'splat1', x + Math.cos(a) * r, gy + 0.01 * i, z + Math.sin(a) * r, (pr.radius || 5) * (1.2 - i * 0.25), [0.12, 0.16, 0.42], 0.95, [1, 0, 0], [0, 0, -1]);
    }
    game.fx.crumbs(x, y + 0.5, z, 30, 6, true);
  }

  // a paper plane bursts into a cloud of confetti and rubs out what is near
  planeBurst(pr, x, y, z) {
    const game = this.game;
    game.fx.confetti(x, y, z, 46, 6);
    game.enemies.explosion(x, y, z, pr.radius || 3, pr.damage);
    game.civilians.explosion(x, y, z, pr.radius || 3);
    game.eraseBlast(x, y, z, (pr.radius || 3) * 0.8, pr.damage * 0.6);
    game.audio.play('pop', 1);
    game.audio.play('boom', 0.35);
    game.camRig.addShake(0.12);
    game.enemies.noise(new THREE.Vector3(x, y, z), 40, 'boom');
    game.civilians.panic(new THREE.Vector3(x, y, z), 40);
  }

  drawBeam(fr, beam) {
    const { a, b } = beam;
    const t = this.game.time;
    // a glowing core with a halo of neon strokes that shiver along it
    fr.lineXYZ(a.x, a.y, a.z, b.x, b.y, b.z, HIGHLIGHT, 9, 3, 0.55, 0.002, 0);
    fr.lineXYZ(a.x, a.y, a.z, b.x, b.y, b.z, HIGHLIGHT_CORE, 3.4, 4, 1, 0.001, 0);
    const d = _u.copy(b).sub(a);
    const L = d.length();
    const n = Math.min(10, Math.ceil(L / 3));
    for (let i = 0; i < n; i++) {
      const s0 = Math.random();
      const s1 = Math.min(1, s0 + 0.08 + Math.random() * 0.1);
      const off = Math.sin(t * 40 + i * 2.3) * 0.06;
      fr.lineXYZ(a.x + d.x * s0, a.y + d.y * s0 + off, a.z + d.z * s0, a.x + d.x * s1, a.y + d.y * s1 - off, a.z + d.z * s1, HIGHLIGHT, 4, 10 + i, 0.7, 0.01, 0);
    }
    // where it lands: a hot white spot and sparks
    for (let i = 0; i < 4; i++) {
      const an = t * 20 + i * 1.57;
      fr.lineXYZ(b.x, b.y, b.z, b.x + Math.cos(an) * 0.22, b.y + Math.sin(an * 1.3) * 0.22, b.z + Math.sin(an) * 0.22, HIGHLIGHT_CORE, 3, 20 + i, 0.9, 0.01, 0);
    }
  }

  // a thing drawn freehand, thrown (game/freeform.js): its own lines, the boomerang spinning flat,
  // the bomb tumbling over and over
  drawShape(fr, pr) {
    const sh = pr.shape;
    const flat = pr.kind === 'scissors';
    const a = flat ? pr.spin || 0 : pr.t * 9;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let ux;
    let uy;
    let uz;
    let wx;
    let wy;
    let wz;
    if (flat) {
      ux = ca;
      uy = 0;
      uz = sa;
      wx = -sa;
      wy = 0;
      wz = ca;
    } else {
      let hx = pr.vx;
      let hz = pr.vz;
      const hl = Math.hypot(hx, hz) || 1;
      hx /= hl;
      hz /= hl;
      ux = hx * ca;
      uy = sa;
      uz = hz * ca;
      wx = -hx * sa;
      wy = ca;
      wz = -hz * sa;
    }
    const S = sh.segs;
    const w = flat ? 3.4 : 4.2;
    if (!flat) fr.lineXYZ(pr.x - ux * sh.size * 0.12, pr.y - uy * sh.size * 0.12, pr.z - uz * sh.size * 0.12, pr.x + ux * sh.size * 0.12, pr.y + uy * sh.size * 0.12, pr.z + uz * sh.size * 0.12, sh.cols[0] || BLACK_INK, 18, pr.seed, 1, 0.01, 0);
    for (let i = 0, k = 0; i < S.length; i += 4, k++) {
      const z0 = S[i];
      const y0 = S[i + 1];
      const z1 = S[i + 2];
      const y1 = S[i + 3];
      fr.lineXYZ(pr.x + ux * z0 + wx * y0, pr.y + uy * z0 + wy * y0, pr.z + uz * z0 + wz * y0, pr.x + ux * z1 + wx * y1, pr.y + uy * z1 + wy * y1, pr.z + uz * z1 + wz * y1, sh.cols[k] || BLACK_INK, w, pr.seed + k, 1, 0.004, 0);
    }
    // (the bomb's fuse spits sparks as ever)
    if (!flat && pr.fuse && Math.sin(pr.t * 50) > -0.3) fr.lineXYZ(pr.x + wx * sh.size * 0.55, pr.y + wy * sh.size * 0.55, pr.z + wz * sh.size * 0.55, pr.x + wx * sh.size * 0.7 + (Math.random() - 0.5) * 0.12, pr.y + wy * sh.size * 0.7 + 0.1, pr.z + wz * sh.size * 0.7 + (Math.random() - 0.5) * 0.12, [2.4, 1.6, 0.4], 3, pr.seed + 99, 1, 0.01, 0);
  }

  drawProjectile(fr, pr) {
    if (pr.shape) {
      this.drawShape(fr, pr);
      return;
    }
    const l = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
    const ux = pr.vx / l;
    const uy = pr.vy / l;
    const uz = pr.vz / l;
    if (pr.el && pr.kind !== 'plane') {
      this.drawInk(fr, pr, ux, uy, uz);
      return;
    }
    if (pr.kind === 'paint') {
      const c = pr.color;
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.12, pr.y - uy * 0.12, pr.z - uz * 0.12, c, 9, pr.seed, 1, 0.1, 0);
      fr.lineXYZ(pr.x - ux * 0.1, pr.y - uy * 0.1, pr.z - uz * 0.1, pr.x - ux * 0.7, pr.y - uy * 0.7, pr.z - uz * 0.7, c, 1.6, pr.seed + 1, 0.5, 0.05, 0);
    } else if (pr.kind === 'pencil') {
      // flies eraser first
      const L = 0.55;
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.08, pr.y - uy * 0.08, pr.z - uz * 0.08, [0.9, 0.55, 0.62], 6, pr.seed, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * 0.08, pr.y - uy * 0.08, pr.z - uz * 0.08, pr.x - ux * L, pr.y - uy * L, pr.z - uz * L, [0.86, 0.72, 0.3], 5, pr.seed + 1, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * L, pr.y - uy * L, pr.z - uz * L, pr.x - ux * (L + 0.1), pr.y - uy * (L + 0.1), pr.z - uz * (L + 0.1), BLACK_INK, 3, pr.seed + 2, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * 0.7, pr.y - uy * 0.7, pr.z - uz * 0.7, pr.x - ux * 1.6, pr.y - uy * 1.6, pr.z - uz * 1.6, BLACK_INK, 1, pr.seed + 3, 0.35, 0.02, 0);
    } else if (pr.kind === 'crayon') {
      // a stub of wax crayon, its paper sleeve and a coloured streak behind it
      const c = pr.color;
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.16, pr.y - uy * 0.16, pr.z - uz * 0.16, c, 7, pr.seed, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * 0.05, pr.y - uy * 0.05, pr.z - uz * 0.05, pr.x - ux * 0.12, pr.y - uy * 0.12, pr.z - uz * 0.12, [0.95, 0.93, 0.86], 7.6, pr.seed + 1, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * 0.16, pr.y - uy * 0.16, pr.z - uz * 0.16, pr.x - ux * 0.9, pr.y - uy * 0.9, pr.z - uz * 0.9, c, 2, pr.seed + 2, 0.45, 0.04, 0);
    } else if (pr.kind === 'staple') {
      // a little steel staple, tumbling
      const s = 0.05;
      const a = pr.t * 30 + pr.seed;
      const px = -uz;
      const pz = ux;
      const ca = Math.cos(a) * s;
      const sa = Math.sin(a) * s;
      fr.lineXYZ(pr.x - px * ca, pr.y - sa, pr.z - pz * ca, pr.x + px * ca, pr.y + sa, pr.z + pz * ca, STEEL, 2.4, pr.seed, 1, 0.001, 0);
      fr.lineXYZ(pr.x - ux * 0.5, pr.y - uy * 0.5, pr.z - uz * 0.5, pr.x, pr.y, pr.z, STEEL, 1, pr.seed + 1, 0.35, 0.01, 0);
    } else if (pr.kind === 'shaving') {
      // a freshly sharpened stub: a curl of wood and a dark point
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.07, pr.y - uy * 0.07, pr.z - uz * 0.07, BLACK_INK, 3, pr.seed, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * 0.07, pr.y - uy * 0.07, pr.z - uz * 0.07, pr.x - ux * 0.3, pr.y - uy * 0.3, pr.z - uz * 0.3, [0.9, 0.62, 0.3], 4, pr.seed + 1, 1, 0.01, 0);
      fr.lineXYZ(pr.x - ux * 0.3, pr.y - uy * 0.3, pr.z - uz * 0.3, pr.x - ux * 1.1, pr.y - uy * 1.1, pr.z - uz * 1.1, [0.9, 0.62, 0.3], 1.2, pr.seed + 2, 0.4, 0.04, 0);
    } else if (pr.kind === 'plane') {
      // a folded paper plane, nose first, banking a little; a dotted trail behind
      const px = -uz;
      const pz = ux;
      const L = 0.55;
      const W2 = 0.28;
      const bank = Math.sin(pr.t * 5 + pr.seed) * 0.08;
      const tx = pr.x - ux * L;
      const ty = pr.y - uy * L;
      const tz = pr.z - uz * L;
      const paper = [1.0, 0.98, 0.92];
      fr.lineXYZ(pr.x, pr.y, pr.z, tx + px * W2, ty + bank, tz + pz * W2, paper, 6, pr.seed, 1, 0.005, 0);
      fr.lineXYZ(pr.x, pr.y, pr.z, tx - px * W2, ty - bank, tz - pz * W2, paper, 6, pr.seed + 1, 1, 0.005, 0);
      fr.lineXYZ(pr.x, pr.y, pr.z, tx, ty - 0.08, tz, [0.62, 0.66, 0.78], 2.6, pr.seed + 2, 1, 0.005, 0);
      for (let i = 1; i <= 4; i++) {
        const o = L + i * 0.35;
        fr.lineXYZ(pr.x - ux * o, pr.y - uy * o, pr.z - uz * o, pr.x - ux * (o + 0.12), pr.y - uy * (o + 0.12), pr.z - uz * (o + 0.12), [0.62, 0.66, 0.78], 1.4, pr.seed + 3 + i, 0.6 - i * 0.12, 0.01, 0);
      }
    } else if (pr.kind === 'inkbomb') {
      // the ink bottle tumbling end over end, its fuse spitting sparks
      const a = pr.t * 9;
      const ax = Math.cos(a) * 0.14;
      const ay = Math.sin(a) * 0.14;
      fr.lineXYZ(pr.x - ax, pr.y - ay, pr.z, pr.x + ax, pr.y + ay, pr.z, [0.14, 0.2, 0.5], 16, pr.seed, 1, 0.005, 0);
      const fx = pr.x + ax * 1.6;
      const fy = pr.y + ay * 1.6;
      const k = Math.min(1, (pr.fuse - pr.t) / pr.fuse);
      fr.lineXYZ(pr.x + ax, pr.y + ay, pr.z, fx, fy, pr.z, [0.85, 0.75, 0.55], 2, pr.seed + 1, 1, 0.01, 0);
      if (Math.sin(pr.t * 50) > -0.3) fr.lineXYZ(fx, fy, pr.z, fx + (Math.random() - 0.5) * 0.15, fy + 0.12, pr.z + (Math.random() - 0.5) * 0.15, [2.4, 1.6, 0.4], 3, pr.seed + 2, 1, 0.01, 0);
      if (k < 0.35 && Math.sin(pr.t * 30) > 0) fr.lineXYZ(pr.x - 0.05, pr.y + 0.3, pr.z, pr.x + 0.05, pr.y + 0.3, pr.z, RED_INK, 6, pr.seed + 3, 1, 0, 0);
    } else if (pr.kind === 'scissors') {
      // spinning open scissors: two steel blades and their red rings
      const a = pr.spin;
      const r = 0.36;
      for (let i = 0; i < 2; i++) {
        const b = a + i * 2.2;
        const cx = Math.cos(b);
        const sz = Math.sin(b);
        fr.lineXYZ(pr.x, pr.y, pr.z, pr.x + cx * r, pr.y + 0.04 * (i ? 1 : -1), pr.z + sz * r, STEEL, 4, pr.seed + i, 1, 0.003, 0);
        fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - cx * r * 0.45, pr.y, pr.z - sz * r * 0.45, [0.85, 0.26, 0.3], 7, pr.seed + 2 + i, 1, 0.01, 0);
      }
    } else if (pr.kind === 'glue') {
      // a blob of hot glue with a string trailing behind it
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.08, pr.y - uy * 0.08, pr.z - uz * 0.08, GLUE, 12, pr.seed, 0.95, 0.06, 0);
      fr.lineXYZ(pr.x - ux * 0.08, pr.y - uy * 0.08, pr.z - uz * 0.08, pr.x - ux * 0.6, pr.y - uy * 0.6 + 0.05, pr.z - uz * 0.6, GLUE, 2, pr.seed + 1, 0.7, 0.08, 0);
    } else if (pr.kind === 'tippex') {
      // a blob of correction fluid, a thin white string behind it
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.1, pr.y - uy * 0.1, pr.z - uz * 0.1, WHITE_OUT, 10, pr.seed, 1, 0.08, 0);
      fr.lineXYZ(pr.x - ux * 0.1, pr.y - uy * 0.1, pr.z - uz * 0.1, pr.x - ux * 0.75, pr.y - uy * 0.75, pr.z - uz * 0.75, WHITE_OUT, 2, pr.seed + 1, 0.7, 0.05, 0);
    } else if (pr.kind === 'rubber') {
      // a little two-tone eraser, tumbling
      const a = pr.t * 22 + pr.seed;
      const px = -uz * Math.cos(a) * 0.05;
      const py = Math.sin(a) * 0.05;
      const pz = ux * Math.cos(a) * 0.05;
      fr.lineXYZ(pr.x - px, pr.y - py, pr.z - pz, pr.x, pr.y, pr.z, [0.93, 0.5, 0.56], 7, pr.seed, 1, 0.005, 0);
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x + px, pr.y + py, pr.z + pz, [0.36, 0.48, 0.82], 7, pr.seed + 1, 1, 0.005, 0);
      fr.lineXYZ(pr.x - ux * 0.2, pr.y - uy * 0.2, pr.z - uz * 0.2, pr.x - ux * 0.8, pr.y - uy * 0.8, pr.z - uz * 0.8, [0.93, 0.5, 0.56], 1.1, pr.seed + 2, 0.45, 0.03, 0);
    } else if (pr.kind === 'paintmg') {
      const c = pr.color;
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.1, pr.y - uy * 0.1, pr.z - uz * 0.1, c, 9, pr.seed, 1, 0.1, 0);
      fr.lineXYZ(pr.x - ux * 0.1, pr.y - uy * 0.1, pr.z - uz * 0.1, pr.x - ux * 0.6, pr.y - uy * 0.6, pr.z - uz * 0.6, c, 1.6, pr.seed + 1, 0.5, 0.05, 0);
    } else if (pr.kind === 'whiteShell') {
      // the tank's round: a big wobbling glob of correction fluid
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.3, pr.y - uy * 0.3, pr.z - uz * 0.3, WHITE_OUT, 26, pr.seed, 1, 0.12, 0);
      fr.lineXYZ(pr.x - ux * 0.3, pr.y - uy * 0.3, pr.z - uz * 0.3, pr.x - ux * 2.2, pr.y - uy * 2.2, pr.z - uz * 2.2, WHITE_OUT, 5, pr.seed + 1, 0.6, 0.08, 0);
    } else if (pr.kind === 'eraser' || pr.kind === 'shell') {
      const s = pr.kind === 'shell' ? 0.5 : 0.35;
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * s, pr.y - uy * s, pr.z - uz * s, [0.9, 0.58, 0.64], 16, pr.seed, 1, 0.02, 0);
      fr.lineXYZ(pr.x - ux * s, pr.y - uy * s, pr.z - uz * s, pr.x - ux * 2.4, pr.y - uy * 2.4, pr.z - uz * 2.4, BLACK_INK, 1.4, pr.seed + 1, 0.4, 0.05, 0);
      if (Math.random() < 0.3) this.game.fx.smoke(pr.x - ux, pr.y - uy, pr.z - uz, 0.6);
    } else if (pr.kind === 'ink') {
      // a blot of ballpoint ink
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.1, pr.y - uy * 0.1, pr.z - uz * 0.1, PEN_BLUE, 8, pr.seed, 1, 0.05, 0);
      fr.lineXYZ(pr.x - ux * 0.1, pr.y - uy * 0.1, pr.z - uz * 0.1, pr.x - ux * 0.9, pr.y - uy * 0.9, pr.z - uz * 0.9, PEN_BLUE, 1.4, pr.seed + 1, 0.55, 0.04, 0);
    } else if (pr.kind === 'paintball') {
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.07, pr.y - uy * 0.07, pr.z - uz * 0.07, pr.color, 7, pr.seed, 1, 0.08, 0);
      fr.lineXYZ(pr.x - ux * 0.08, pr.y - uy * 0.08, pr.z - uz * 0.08, pr.x - ux * 0.5, pr.y - uy * 0.5, pr.z - uz * 0.5, pr.color, 1.2, pr.seed + 1, 0.5, 0.04, 0);
    } else {
      // enemy scribble bullet
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.45, pr.y - uy * 0.45, pr.z - uz * 0.45, BLACK_INK, 3.4, pr.seed, 1, 0.02, 0);
      fr.lineXYZ(pr.x - ux * 0.5, pr.y - uy * 0.5, pr.z - uz * 0.5, pr.x - ux * 1.3, pr.y - uy * 1.3, pr.z - uz * 1.3, RED_INK, 1.2, pr.seed + 1, 0.5, 0.03, 0);
    }
  }

  onHit(pr, hit, ux, uy, uz) {
    const game = this.game;
    const fx = game.fx;
    if (pr.kind === 'plane') {
      this.planeBurst(pr, hit.x, hit.y, hit.z);
      if (pr.el) this.inkRound(pr.el, hit.x, hit.y, hit.z, pr.radius || 3, pr.damage);
      return;
    }
    if (pr.kind === 'inkbomb') {
      this.inkBurst(pr, hit.x, hit.y, hit.z);
      return;
    }
    if (pr.kind === 'whiteShell') {
      game.whiteOut(hit.x, hit.y, hit.z, pr.radius || 6, pr.damage, pr.owner, hit);
      return;
    }
    if (pr.radius > 0) {
      game.explosion(hit.x, hit.y, hit.z, pr.radius, pr.damage, pr.owner);
      // (ROADMAP 11.11) a rocket drawn in colour: what its ink does, all round where it went off
      if (pr.el) this.inkRound(pr.el, hit.x, hit.y, hit.z, pr.radius, pr.damage);
      return;
    }
    // (ROADMAP 11.11, parts 2) a shot out of a barrel drawn in colour: what its ink does
    if (pr.el && this.inkHit(pr, hit, ux, uy, uz)) return;
    const kind = pr.kind;
    const hurtKind = hurtOf(kind);
    if (hit.type === 'civ') {
      game.civilians.damage(hit.civ, new THREE.Vector3(hit.x, hit.y, hit.z), hurtKind, pr.damage);
      if (kind === 'paint' || kind === 'crayon' || kind === 'paintmg' || kind === 'tippex') hit.civ.fig.paint(pr.color);
      if (kind === 'glue') hit.civ.glueT = pr.stick;
      fx.impact(hit.x, hit.y, hit.z, 0.6);
      return;
    }
    if (hit.type === 'enemy') {
      const e = hit.enemy;
      // (a hit of yours: the shooting skill, ROADMAP 5.6)
      if (game.skills && pr.owner === 'player' && e.alive) game.skills.add('shoot', Math.min(1.5, pr.damage / 25));
      game.enemies.damage(e, hit.part, pr.damage, new THREE.Vector3(hit.x, hit.y, hit.z), new THREE.Vector3(ux, uy, uz), hurtKind);
      if (kind === 'paint' || kind === 'ink' || kind === 'crayon' || kind === 'paintmg' || kind === 'tippex') e.paint(kind === 'ink' ? PEN_BLUE : pr.color);
      if (kind === 'staple') e.pinT = Math.max(e.pinT || 0, pr.pin || 0.4);
      if (kind === 'glue') {
        e.glueT = pr.stick || 4;
        e.paint(GLUE);
        game.audio.play('splat', 0.5);
      }
      if (kind === 'scissors') {
        fx.sparks(hit.x, hit.y, hit.z, 4, STEEL);
        game.audio.play('snip', 0.8);
      }
      fx.impact(hit.x, hit.y, hit.z, kind === 'staple' || kind === 'shaving' ? 0.4 : 0.7);
      return;
    }
    if (hit.type === 'car') {
      // a car hit: dented, its glass, a tyre... (game/damage.js); yours keep their own count
      const c = hit.car;
      if (hit.own) {
        // (yours: the one you sit in takes what was meant for you)
        c.hurt(pr.owner === 'player' ? pr.damage * 0.5 : pr.damage);
        game.damage.hit(c, hit.x, hit.y, hit.z, pr.damage * 0.6, true);
      } else {
        game.damage.hit(c, hit.x, hit.y, hit.z, pr.damage * 0.7);
        game.traffic.shotAt(c, pr.owner);
      }
      fx.sparks(hit.x, hit.y, hit.z, 4, STEEL);
      fx.impact(hit.x, hit.y, hit.z, 0.45);
      if (Math.hypot(hit.x - game.camera.position.x, hit.z - game.camera.position.z) < 45) game.audio.play('clang', 0.35);
      return;
    }
    if (hit.type === 'player') {
      const p = game.player;
      const hp0 = p.hp;
      p.hurt(pr.damage, pr.x - ux * 5, pr.z - uz * 5, new THREE.Vector3(hit.x, hit.y, hit.z), null, pr.from);
      fx.impact(hit.x, hit.y, hit.z, 0.6);
      if (pr.color && !p.inVehicle && hp0 - p.hp > pr.damage * 0.5) game.hud.splat(pr.color);
      return;
    }
    // world (a parked car's box: dented, its glass, its tyres... game/damage.js)
    if (hit.box && hit.box.tag === 'car' && game.damage && !game.classic) game.damage.shot(hit.box, hit, pr.damage);
    // (a shop window: a hard shot breaks it, ROADMAP 8.3, game/knock.js)
    if (game.knock && hit.box && hit.box.tag === 'roomwall' && !SOFT_SHOTS.has(kind)) game.knock.glassHit(hit.x, hit.y, hit.z);
    if (kind === 'ink' || kind === 'paintball') {
      fx.splatAt(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, kind === 'ink' ? 0.45 : 0.5 + Math.random() * 0.3, pr.color);
      return;
    }
    if (kind === 'tippex') {
      // a splash of correction fluid: what it covers is gone from the page
      fx.splatAt(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 0.5 + Math.random() * 0.3, WHITE_TINT);
      game.eraseWorld(hit.x, hit.y, hit.z, 0.42, pr.damage * 1.5, hit.box, hit);
      game.audio.play('splat', 0.3);
    } else if (kind === 'rubber') {
      // (a gang war's rubber leaves the city as it is: ROADMAP 6.5)
      if (!pr.soft) game.eraseWorld(hit.x, hit.y, hit.z, 0.36, pr.damage * 1.3, hit.box, hit);
      fx.impact(hit.x, hit.y, hit.z, 0.35);
    } else if (kind === 'paintmg') {
      // drenched in paint, a thing runs off the page
      fx.splatAt(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 0.55 + Math.random() * 0.4, pr.color);
      game.eraseWorld(hit.x, hit.y, hit.z, 0.2, pr.damage * 1.1, hit.box, hit);
      game.audio.play('splat', 0.25);
    } else if (kind === 'paint' || kind === 'crayon') {
      fx.splatAt(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, (kind === 'crayon' ? 0.35 : 0.7) + Math.random() * 0.4, pr.color);
      if (kind === 'crayon') game.eraseWorld(hit.x, hit.y, hit.z, 0.12, pr.damage * 0.3, hit.box, hit);
      game.audio.play('splat', 0.4);
    } else if (kind === 'glue') {
      fx.splatAt(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, 0.55 + Math.random() * 0.2, GLUE);
      game.audio.play('splat', 0.4);
    } else if (kind === 'pencil' || kind === 'shaving') {
      // eraser first: a little blank patch where it lands
      game.eraseWorld(hit.x, hit.y, hit.z, kind === 'shaving' ? 0.16 : 0.28, pr.damage * 0.6, hit.box, hit);
      if (kind === 'pencil' || Math.random() < 0.15) game.stuckPencil(hit.x, hit.y, hit.z, ux, uy, uz);
      fx.impact(hit.x, hit.y, hit.z, kind === 'shaving' ? 0.3 : 0.5);
    } else if (kind === 'staple') {
      fx.sparks(hit.x, hit.y, hit.z, 2, STEEL);
    } else {
      fx.impact(hit.x, hit.y, hit.z, 0.4);
      fx.sparks(hit.x, hit.y, hit.z, 4);
    }
  }

  // ------------------------------------------------------------------ (ROADMAP 11.11, parts 2) inks
  // A gun's barrels drawn in colour, a blade, a hammer's head: what each ink does where it lands
  // (game/handparts.js reads which). Red sets alight, orange goes off, yellow jolts (and jumps on
  // to the next one), green glues them where they stand, blue throws them back and puts fires
  // out, purple leaves a cloud nobody sees through, pink bounces, white rubs out, neon goes
  // through walls.

  // a shot of it lands: the hurt as ever, and what its ink does (false: the rest as any shot)
  inkHit(pr, hit, ux, uy, uz) {
    const game = this.game;
    const el = pr.el;
    const dir = _hd.set(ux, 0, uz);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    if (el === 'blast') this.pop(hit.x, hit.y, hit.z, clamp(1.3 + pr.damage / 30, 1.5, 3.2), pr.damage);
    if (hit.type === 'enemy' || hit.type === 'civ') {
      const civ = hit.type === 'civ';
      const who = civ ? hit.civ : hit.enemy;
      const at = new THREE.Vector3(hit.x, hit.y, hit.z);
      if (civ) game.civilians.damage(who, at, hurtOf(pr.kind), pr.damage);
      else {
        if (game.skills && pr.owner === 'player' && who.alive) game.skills.add('shoot', Math.min(1.5, pr.damage / 25));
        game.enemies.damage(who, hit.part, pr.damage, at, new THREE.Vector3(ux, uy, uz), hurtOf(pr.kind));
      }
      if (who.alive) this.inkOn(el, who, civ, at, dir, pr.damage);
      game.fx.impact(hit.x, hit.y, hit.z, 0.6);
      return true;
    }
    if (hit.type === 'car') {
      if (el === 'fire' && game.damage && Math.random() < 0.2) game.damage.ignite(hit.car, 1 + Math.random() * 2);
      return false;
    }
    if (hit.type !== 'world') return false;
    // (a parked car's box: dented as by any shot; a shop window: a hard one breaks it)
    if (hit.box && hit.box.tag === 'car' && game.damage && !game.classic) game.damage.shot(hit.box, hit, pr.damage);
    if (game.knock && hit.box && hit.box.tag === 'roomwall' && !SOFT_INK.has(el)) game.knock.glassHit(hit.x, hit.y, hit.z);
    this.inkAt(el, hit, pr.damage);
    return true;
  }

  // what it does to whoever it hits (civ: a passer-by, else one of those after you), from dir
  // (level), as hard as dmg
  inkOn(el, who, civ, at, dir, dmg) {
    const game = this.game;
    const fx = game.fx;
    switch (el) {
      case 'fire':
        // alight: it burns a while, and they run
        this.ignitePerson(who, civ, dmg);
        break;
      case 'shock':
        // a jolt: stuck where they stand a moment - and on to the next one near
        if (civ) who.reelT = Math.max(who.reelT || 0, 1.4);
        else {
          who.pinT = Math.max(who.pinT || 0, 1.6);
          who.flinch = 0.6;
          this.arcOn(who, at, dmg);
        }
        fx.sparks(at.x, at.y, at.z, 8, EL_COL.shock);
        game.audio.play('laser', 0.3);
        break;
      case 'glue':
        // glued where they stand
        who.glueT = Math.max(who.glueT || 0, 3.5);
        if (civ) who.fig.paint(GLUE);
        else who.paint(GLUE);
        game.audio.play('glue', 0.4);
        break;
      case 'water':
        // a jet of it: thrown back, and put out if alight
        if (civ) {
          who.vel.x += dir.x * 6;
          who.vel.z += dir.z * 6;
          who.reelT = Math.max(who.reelT || 0, 0.6);
        } else {
          who.knock(dir.x * 10, dir.z * 10);
          who.flinch = 0.5;
        }
        this.unburn(who);
        fx.splash(at.x, at.y, at.z, 10, 3, EL_COL.water);
        break;
      case 'ink':
        // a cloud of ink round them: they see nothing, nobody sees you through it
        this.inkCloud(who.pos.x, who.pos.z, 2.6);
        if (!civ) {
          who.paint(EL_COL.ink);
          who.sees = false;
          who.aimT = 0;
        }
        break;
      case 'tippex':
        // rubbed out more: a wider hole where it lands
        if (civ) game.civilians.damage(who, at.clone(), 'slash', dmg * 0.5);
        else game.enemies.damage(who, null, dmg * 0.5, at.clone(), null, 'slash');
        if (who.alive) {
          if (civ) who.fig.paint(WHITE_TINT);
          else who.paint(WHITE_TINT);
        }
        break;
      case 'bounce':
        // knocked back as off a spring
        if (civ) {
          who.vel.x += dir.x * 5;
          who.vel.z += dir.z * 5;
        } else who.knock(dir.x * 12, dir.z * 12);
        fx.sparks(at.x, at.y, at.z, 4, EL_COL.bounce);
        break;
      case 'light':
        // dazzled: they lose you a moment
        if (!civ) {
          who.sees = false;
          who.aimT = 0;
          who.flinch = 0.8;
        }
        fx.sparks(at.x, at.y, at.z, 6, HIGHLIGHT);
        break;
      default:
        break;
    }
  }

  // where it lands on the world (hit: the wall's or the street's, with its normal and box)
  inkAt(el, hit, dmg) {
    const game = this.game;
    const fx = game.fx;
    const { x, y, z } = hit;
    const nx = hit.nx || 0;
    const ny = hit.ny === undefined ? 1 : hit.ny;
    const nz = hit.nz || 0;
    switch (el) {
      case 'fire':
        // what burns there catches; on the street, a little fire a while (game/fire.js)
        if (game.fire) {
          for (const o of game.world.objects.within(x, z, 1.2, this._near)) game.fire.ignite(o);
          if (ny > 0.6 && game.time - this.patchT > 0.5) {
            this.patchT = game.time;
            game.fire.patch(x, z, 3.5);
          }
        }
        fx.sprite('smoke1', x, y + 0.15, z, { size: 0.8, grow: 0.7, life: 0.4, vy: 2, alpha: 0.9, tint: FLAME });
        // (a flamethrower's many: a scorch now and then)
        if (Math.random() < 0.35) fx.splatAt(x, y, z, nx, ny, nz, 0.35 + Math.random() * 0.2, SCORCH);
        break;
      case 'water':
        if (game.fire) game.fire.douse(x, z, 1.8);
        fx.splash(x, y, z, 12, 3, EL_COL.water);
        fx.splatAt(x, y, z, nx, ny, nz, 0.5 + Math.random() * 0.3, EL_COL.water);
        game.audio.play('splat', 0.3);
        break;
      case 'glue':
        // on the street, a puddle of it: whoever walks into it is stuck there
        fx.splatAt(x, y, z, nx, ny, nz, 0.6 + Math.random() * 0.2, GLUE);
        if (ny > 0.6) this.puddle(x, z, 0.9);
        game.audio.play('splat', 0.35);
        break;
      case 'ink':
        this.inkCloud(x, z, 2.4);
        fx.splatAt(x, y, z, nx, ny, nz, 0.5, EL_COL.ink);
        break;
      case 'tippex':
        fx.splatAt(x, y, z, nx, ny, nz, 0.55 + Math.random() * 0.3, WHITE_TINT);
        game.eraseWorld(x, y, z, 0.5, dmg * 1.8, hit.box, hit);
        game.audio.play('splat', 0.3);
        break;
      case 'shock':
        fx.sparks(x, y, z, 10, EL_COL.shock);
        game.audio.play('laser', 0.2);
        break;
      case 'light':
        fx.sparks(x, y, z, 6, HIGHLIGHT);
        game.eraseWorld(x, y, z, 0.16, dmg * 0.6, hit.box, hit);
        break;
      case 'bounce':
        fx.splatAt(x, y, z, nx, ny, nz, 0.3, EL_COL.bounce);
        break;
      default:
        fx.impact(x, y, z, 0.4);
        break;
    }
  }

  // (a rocket drawn in colour) its ink all round where it went off
  inkRound(el, x, y, z, r, dmg) {
    const game = this.game;
    if (el === 'water' && game.fire) game.fire.douse(x, z, r * 1.5);
    else if (el === 'ink') this.inkCloud(x, z, r);
    else if (el === 'tippex') game.eraseBlast(x, y, z, r * 0.7, dmg * 0.6);
    else if (el === 'shock' || el === 'glue') {
      if (el === 'glue') this.puddle(x, z, Math.min(2.4, r * 0.5));
      for (const e of game.enemies.list) {
        if (!e.alive || Math.hypot(e.pos.x - x, e.pos.z - z) > r * 1.2) continue;
        if (el === 'shock') e.pinT = Math.max(e.pinT || 0, 2);
        else e.glueT = Math.max(e.glueT || 0, 4);
      }
    }
  }

  // (orange) a little blast where it lands: whoever is round it thrown and rubbed out a little,
  // the glass broken (game/game.js explosion, smaller: no fire, the street stays)
  pop(x, y, z, r, dmg) {
    const game = this.game;
    // (a gun that fires fast: one burst at a time)
    if (game.time - this.popT < 0.12) {
      game.fx.sparks(x, y, z, 6, EL_COL.blast);
      return;
    }
    this.popT = game.time;
    game.fx.boom(x, y, z, r * 0.7);
    if (game.knock) game.knock.blast(x, y, z, r * 1.1);
    game.enemies.explosion(x, y, z, r, dmg);
    game.civilians.explosion(x, y, z, r);
    game.eraseBlast(x, y, z, r * 0.75, dmg * 0.7);
    game.audio.play('boom', 0.4);
    const p = game.player;
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    const d = Math.hypot(pp.x - x, pp.z - z);
    game.camRig.addShake(clamp(0.35 - d / 60, 0.03, 0.3));
    if (d < r && !p.inVehicle) p.hurt(0.25 * dmg * 0.35 * (1 - d / r), x, z);
    game.enemies.noise(new THREE.Vector3(x, y, z), 40, 'boom');
    game.civilians.panic(new THREE.Vector3(x, y, z), 40);
  }

  // (yellow) the jolt jumps on to the nearest one near, a bolt between them
  arcOn(from, at, dmg) {
    const game = this.game;
    let best = null;
    let bd = 6;
    for (const e of game.enemies.list) {
      if (!e.alive || e === from) continue;
      const d = Math.hypot(e.pos.x - from.pos.x, e.pos.z - from.pos.z);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) return;
    const c = best.fig.center;
    game.enemies.damage(best, null, dmg * 0.5, c.clone(), null, 'beam');
    best.pinT = Math.max(best.pinT || 0, 1.1);
    this.streaks.push({ k: 'bolt', a: [at.x, at.y, at.z], b: [c.x, c.y, c.z], t: 0, life: 0.25, seed: Math.random() * 100 });
    game.fx.sparks(c.x, c.y, c.z, 6, EL_COL.shock);
  }

  // (purple) a cloud of ink there: nobody sees through it (game/signs.js's clouds)
  inkCloud(x, z, r) {
    const game = this.game;
    if (game.time - this.cloudT < 0.7) return;
    this.cloudT = game.time;
    if (game.signs) {
      game.signs.puff(x, z, r, 6);
      return;
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r * 0.8;
      game.fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + Math.cos(a) * d, 0.6 + Math.random() * 2, z + Math.sin(a) * d, { size: 2.2, grow: 0.25, life: 5, vy: 0.04, alpha: 0.9, tint: [0.13, 0.1, 0.22], fadeIn: 0.15 });
    }
  }

  // (green) glue on the street: a puddle that holds whoever walks into it, a while
  puddle(x, z, r) {
    for (const q of this.puddles) {
      if (Math.hypot(q.x - x, q.z - z) > q.r) continue;
      q.t = 0;
      q.r = Math.min(2.4, q.r + 0.12);
      return;
    }
    if (this.puddles.length >= 10) this.puddles.shift();
    this.puddles.push({ x, z, r, t: 0, life: 10 });
  }

  // (red) alight: it burns them a while (they run), and what burns near them catches
  ignitePerson(who, civ, dmg) {
    const b = this.burning.find((o) => o.who === who);
    if (b) {
      b.t = 0;
      return;
    }
    if (this.burning.length >= 12) return;
    this.burning.push({ who, civ, t: 0, life: 3.6, dps: clamp(dmg * 0.45, 6, 28), tick: 0 });
    if (civ) {
      who.panicT = 10;
      this.game.civilians.panic(who.pos, 12);
    } else if (who.state !== 'flee' && Math.random() < 0.5 && who.startFlee) who.startFlee();
    this.game.audio.play('whoosh', 0.35);
  }

  unburn(who) {
    const i = this.burning.findIndex((o) => o.who === who);
    if (i >= 0) this.burning.splice(i, 1);
  }

  // (a propeller on it) a gust out of its mouth: whoever is in front, thrown back
  gust(from, power) {
    const game = this.game;
    const fx = from.x;
    const fy = from.y;
    const fz = from.z;
    const f = _hd.set(this.aimPoint.x - fx, 0, this.aimPoint.z - fz);
    if (f.lengthSq() < 1e-6) return;
    f.normalize();
    const reach = 6 + power * 0.5;
    const at = _hp.set(fx, fy, fz);
    for (const e of game.enemies.inArc(at, f, reach, 0.5)) {
      const k = power * (1 - (Math.hypot(e.pos.x - fx, e.pos.z - fz) / reach) * 0.6);
      e.knock(f.x * k, f.z * k);
      e.flinch = 0.4;
    }
    for (const c of game.civilians.inArc(at, f, reach, 0.5)) {
      const k = power * (1 - (Math.hypot(c.pos.x - fx, c.pos.z - fz) / reach) * 0.6) * 0.5;
      c.vel.x += f.x * k;
      c.vel.z += f.z * k;
      c.reelT = Math.max(c.reelT || 0, 0.5);
    }
    // (and a little fire before it goes out)
    if (game.fire) game.fire.douse(fx + f.x * reach * 0.5, fz + f.z * reach * 0.5, 1.2);
    // its streaks in the air
    if (game.time - this.gustT < 0.12 || this.streaks.length > 40) return;
    this.gustT = game.time;
    for (let i = 0; i < 5; i++) {
      const sx = (Math.random() - 0.5) * 0.7;
      const sy = (Math.random() - 0.5) * 0.6;
      this.streaks.push({ k: 'wind', a: [fx - f.z * sx, fy + sy, fz + f.x * sx], d: [f.x, 0, f.z], t: -i * 0.03, life: 0.42, len: 0.9 + Math.random() * 0.8, sp: reach * 2.2, seed: Math.random() * 100 });
    }
  }

  // each frame: people alight, glue on the ground, bolts and gusts
  updateInks(dt, fr) {
    const game = this.game;
    const fx = game.fx;
    const rain = game.weather && game.weather.cur ? game.weather.cur.rain || 0 : 0;
    for (let i = this.burning.length - 1; i >= 0; i--) {
      const b = this.burning[i];
      const w = b.who;
      b.t += dt * (1 + rain * 1.5);
      if (!w.alive || b.t > b.life || w.inside) {
        this.burning.splice(i, 1);
        continue;
      }
      const c = w.fig.center;
      // its flames, licking up off them (drawn as game/fire.js draws a fire), its puffs and smoke
      const cam = game.camera.position;
      const wd = Math.max(3, Math.min(16, 260 / Math.max(1, Math.hypot(c.x - cam.x, c.z - cam.z))));
      const t = game.time;
      const fade = Math.min(1, (b.life - b.t) / 0.8);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + k * 0.37;
        const bx = c.x + Math.cos(a) * 0.2;
        const bz = c.z + Math.sin(a) * 0.2;
        const by = c.y - 0.55 + ((k * 0.43) % 1) * 0.9;
        const h = (0.45 + 0.5 * Math.abs(Math.sin(t * (7 + (k % 5)) + k * 1.7))) * fade;
        const sway = Math.sin(t * 9 + k * 2.3) * 0.12;
        fr.lineXYZ(bx, by, bz, bx + sway * 0.5, by + h * 0.55, bz - sway * 0.3, FLAMES[k % 4], wd * 1.2, 8300 + k, 0.95, 0.03, 0.02);
        fr.lineXYZ(bx + sway * 0.5, by + h * 0.55, bz - sway * 0.3, bx + sway, by + h, bz + sway * 0.4, FLAMES[(k + 1) % 4], wd * 0.75, 8320 + k, 0.9, 0.03, 0.02);
      }
      if (Math.random() < dt * 8) fx.sprite('smoke1', c.x + (Math.random() - 0.5) * 0.4, c.y - 0.3 + Math.random() * 0.8, c.z + (Math.random() - 0.5) * 0.4, { size: 0.5 + Math.random() * 0.3, grow: 0.6, life: 0.4, vy: 2.4, alpha: 0.9, tint: FLAME });
      if (Math.random() < dt * 3) fx.sprite('smoke0', c.x, c.y + 0.7, c.z, { size: 0.9, grow: 1.2, life: 1.2, vy: 1.4, alpha: 0.6, tint: SCORCH });
      b.tick -= dt;
      if (b.tick <= 0) {
        b.tick = 0.4;
        const amt = b.dps * 0.4;
        const at = new THREE.Vector3(c.x + (Math.random() - 0.5) * 0.3, c.y + (Math.random() - 0.5) * 0.6, c.z);
        if (b.civ) game.civilians.damage(w, at, 'fire', amt);
        else game.enemies.damage(w, null, amt, at, null, 'fire');
        // (what burns by them catches)
        if (game.fire && Math.random() < 0.3) for (const o of game.world.objects.within(w.pos.x, w.pos.z, 1.2, this._near)) game.fire.ignite(o);
      }
    }
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const q = this.puddles[i];
      q.t += dt;
      if (q.t > q.life) {
        this.puddles.splice(i, 1);
        continue;
      }
      for (const e of game.enemies.list) if (e.alive && Math.abs(e.pos.x - q.x) < q.r && Math.hypot(e.pos.x - q.x, e.pos.z - q.z) < q.r) e.glueT = Math.max(e.glueT || 0, 0.5);
      for (const c of game.civilians.list) if (c.alive && !c.inside && Math.abs(c.pos.x - q.x) < q.r && Math.hypot(c.pos.x - q.x, c.pos.z - q.z) < q.r) c.glueT = Math.max(c.glueT || 0, 0.5);
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      s.t += dt;
      if (s.t > s.life) {
        this.streaks.splice(i, 1);
        continue;
      }
      if (s.t < 0) continue;
      const k = s.t / s.life;
      if (s.k === 'bolt') {
        // a jagged bolt from the one hit to the next
        const [ax, ay, az] = s.a;
        const [bx, by, bz] = s.b;
        const n = 6;
        let px = ax;
        let py = ay;
        let pz = az;
        for (let j = 1; j <= n; j++) {
          const u = j / n;
          const off = j < n ? 0.35 : 0;
          const qx = ax + (bx - ax) * u + (Math.sin(s.seed + j * 7.1 + game.time * 40) * off);
          const qy = ay + (by - ay) * u + (Math.sin(s.seed + j * 3.3 + game.time * 33) * off);
          const qz = az + (bz - az) * u + (Math.cos(s.seed + j * 5.7 + game.time * 37) * off);
          fr.lineXYZ(px, py, pz, qx, qy, qz, BOLT, 4, s.seed + j, 1 - k * 0.7, 0.002, 0);
          px = qx;
          py = qy;
          pz = qz;
        }
      } else {
        // a streak of wind running out ahead
        const [ax, ay, az] = s.a;
        const [dx, , dz] = s.d;
        const o = s.t * s.sp;
        fr.lineXYZ(ax + dx * o, ay, az + dz * o, ax + dx * (o + s.len), ay + Math.sin(s.seed + o) * 0.05, az + dz * (o + s.len), WIND, 2, s.seed, 0.7 * (1 - k), 0.02, 0);
      }
    }
  }

  // a shot out of a barrel drawn in colour, as it flies: fire, a drop of water, a spark...
  drawInk(fr, pr, ux, uy, uz) {
    const c = EL_COL[pr.el] || pr.color;
    // (a cannon's: a big one - ROADMAP 11.11, game/vehicles.js fireTurret)
    if (pr.big) {
      fr.lineXYZ(pr.x, pr.y, pr.z, pr.x - ux * 0.35, pr.y - uy * 0.35, pr.z - uz * 0.35, pr.el === 'fire' || pr.el === 'blast' ? FLAME_HOT : c, 22, pr.seed, 1, 0.1, 0);
      fr.lineXYZ(pr.x - ux * 0.3, pr.y - uy * 0.3, pr.z - uz * 0.3, pr.x - ux * 2, pr.y - uy * 2, pr.z - uz * 2, c, 5, pr.seed + 1, 0.6, 0.08, 0);
      return;
    }
    const x = pr.x;
    const y = pr.y;
    const z = pr.z;
    switch (pr.el) {
      case 'fire': {
        // a ball of flame and its tongue behind, flickering
        const f = 0.8 + Math.sin(pr.t * 60 + pr.seed) * 0.2;
        fr.lineXYZ(x, y, z, x - ux * 0.14, y - uy * 0.14, z - uz * 0.14, FLAME_HOT, 11 * f, pr.seed, 1, 0.08, 0);
        fr.lineXYZ(x - ux * 0.1, y - uy * 0.1, z - uz * 0.1, x - ux * 0.75, y - uy * 0.75 + 0.06, z - uz * 0.75, FLAME, 4 * f, pr.seed + 1, 0.75, 0.1, 0);
        if (Math.random() < 0.25) this.game.fx.sprite('smoke1', x - ux * 0.4, y, z - uz * 0.4, { size: 0.35, grow: 0.6, life: 0.3, vy: 1.6, alpha: 0.8, tint: FLAME });
        break;
      }
      case 'water':
        fr.lineXYZ(x, y, z, x - ux * 0.1, y - uy * 0.1, z - uz * 0.1, c, 8, pr.seed, 0.95, 0.06, 0);
        fr.lineXYZ(x - ux * 0.1, y - uy * 0.1, z - uz * 0.1, x - ux * 0.9, y - uy * 0.9, z - uz * 0.9, c, 2.4, pr.seed + 1, 0.55, 0.05, 0);
        break;
      case 'shock': {
        // a crackle of a spark
        const j = 0.07;
        const mx = x - ux * 0.25 + (Math.random() - 0.5) * j;
        const my = y - uy * 0.25 + (Math.random() - 0.5) * j;
        const mz = z - uz * 0.25 + (Math.random() - 0.5) * j;
        fr.lineXYZ(x, y, z, mx, my, mz, BOLT, 4, pr.seed, 1, 0.002, 0);
        fr.lineXYZ(mx, my, mz, x - ux * 0.55, y - uy * 0.55, z - uz * 0.55, BOLT, 3, pr.seed + 1, 0.8, 0.002, 0);
        break;
      }
      case 'light':
        // a line of light, its glow round it
        fr.lineXYZ(x, y, z, x - ux * 1.4, y - uy * 1.4, z - uz * 1.4, HIGHLIGHT, 7, pr.seed, 0.55, 0.002, 0);
        fr.lineXYZ(x, y, z, x - ux * 1.2, y - uy * 1.2, z - uz * 1.2, HIGHLIGHT_CORE, 2.6, pr.seed + 1, 1, 0.001, 0);
        break;
      case 'blast':
        fr.lineXYZ(x, y, z, x - ux * 0.16, y - uy * 0.16, z - uz * 0.16, FLAME_HOT, 10, pr.seed, 1, 0.04, 0);
        fr.lineXYZ(x - ux * 0.16, y - uy * 0.16, z - uz * 0.16, x - ux * 0.8, y - uy * 0.8, z - uz * 0.8, SCORCH, 2, pr.seed + 1, 0.5, 0.05, 0);
        break;
      case 'bounce':
        // a little rubber ball
        fr.lineXYZ(x, y, z, x - ux * 0.06, y - uy * 0.06, z - uz * 0.06, c, 12, pr.seed, 1, 0.02, 0);
        break;
      default:
        // glue, ink, correction fluid: a blob of it, a string behind
        fr.lineXYZ(x, y, z, x - ux * 0.1, y - uy * 0.1, z - uz * 0.1, c, 10, pr.seed, 1, 0.07, 0);
        fr.lineXYZ(x - ux * 0.1, y - uy * 0.1, z - uz * 0.1, x - ux * 0.65, y - uy * 0.65, z - uz * 0.65, c, 2, pr.seed + 1, 0.7, 0.06, 0);
    }
  }

  // (a bent barrel) its shot bends after whoever it was aimed at, as fast as ever
  steerCurve(pr, dt) {
    const e = pr.target;
    if (!e.alive) {
      pr.target = null;
      return;
    }
    const c = e.fig.center;
    const sp = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
    const want = _u.set(c.x - pr.x, c.y - pr.y, c.z - pr.z);
    const d = want.length();
    if (d < 0.3) return;
    want.multiplyScalar(sp / d);
    const k = 1 - Math.exp(-pr.curve * dt);
    pr.vx += (want.x - pr.vx) * k;
    pr.vy += (want.y - pr.vy) * k;
    pr.vz += (want.z - pr.vz) * k;
    const s = sp / (Math.hypot(pr.vx, pr.vy, pr.vz) || 1);
    pr.vx *= s;
    pr.vy *= s;
    pr.vz *= s;
  }

  // whoever the crosshair is on - or the nearest to it (a bent barrel's shots go after them)
  aimTarget() {
    if (this.aimHitEnemy && this.aimHitEnemy.alive) return this.aimHitEnemy;
    const cam = this.game.camera;
    const o = cam.position;
    const dir = _u.set(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null;
    let bs = 0.3;
    for (const e of this.game.enemies.list) {
      if (!e.alive) continue;
      const c = e.fig.center;
      const dx = c.x - o.x;
      const dy = c.y - o.y;
      const dz = c.z - o.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 120 || d < 1) continue;
      const a = Math.acos(clamp((dx * dir.x + dy * dir.y + dz * dir.z) / d, -1, 1));
      if (a < bs) {
        bs = a;
        best = e;
      }
    }
    return best;
  }

  // (a bayonet) someone right in front of you, within its reach
  within(range) {
    const game = this.game;
    const p = game.player;
    const f = p.fig.forward;
    return game.enemies.inArc(p.pos, f, range, 0.7).length > 0 || game.civilians.inArc(p.pos, f, range, 0.5).length > 0;
  }

  // (a parachute drawn on what you hold) falling, it holds you: down slowly (game/player.js; null:
  // not under it)
  chuteFall(P) {
    const def = this.current.def;
    if (!def.chute || P.onGround || P.mode !== 'foot' || P.inVehicle) {
      this.chuteOpen = false;
      return null;
    }
    if (!this.chuteOpen) {
      const g = this.game;
      const below = g.climb ? g.climb.floorAt(P.pos.x, P.pos.z, P.pos.y + 0.05) : groundHeight(P.pos.x, P.pos.z);
      if (!(P.vel.y < -5 && P.pos.y - below > 2.2)) return null;
      this.chuteOpen = true;
      g.audio.play('chute', 0.4);
    }
    return 3;
  }
}
