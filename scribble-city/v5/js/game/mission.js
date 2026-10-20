import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { clamp } from '../core/util.js';

// (ROADMAP 11.23) The broken bridge: the lab's first mission, for drawing on your car.
//
// The bridge out to the island at the end of 9th Street is broken off over the sea, and the police
// are after you: get across. No menu to pick from - whatever you draw on the car that gets it over
// is the answer: wings big enough to glide the gap, a rotor, a balloon, floats down the beach and up
// the slipway, a spring at the very edge, wings and a flame... Into the sea and you are back on the
// bridge to try again, what you drew still on the car (and in the sketchbook). Across, it names how
// you did it - and the ways you have not found yet.

// 9th Street, out to the sea (world/layout.js STREETS)
const Z = 29;
const HALF = 3.1;
// where it starts: on Ocean Drive at 9th, a yellow ring
const START = { x: 6, z: Z };
// the bridge: up off the sand, the deck, its broken end tipped up
const RAMP0 = 82;
const DECK0 = 94;
const KICK0 = 106;
const EDGE = 111;
const DECK_Y = 2.2;
const KICK_Y = 2.85;
// the other half of it, broken off on to the island; the island; the slipway up out of the water
const FAR0 = 136;
const FAR_Y = 1.35;
const ISLE = { x0: 151, x1: 180, z0: 13, z1: 45 };
const SLIP = { x0: 137, x1: 151, z0: 14, z1: 22 };
// a try again starts here, on the sand
const BACK = { x: 60, z: Z, yaw: Math.PI / 2 };
// again, from the island
const AGAIN = { x: 168, z: Z };
const WAYS = { wings: 'כנפיים', rotor: 'רוטור', balloon: 'בלון', floats: 'מצופים', spring: 'קפיץ', plane: 'מטוס (כנפיים + סילון)', chute: 'מצנח', jump: 'קפיצה' };
const ALL_WAYS = ['wings', 'rotor', 'balloon', 'floats', 'spring', 'plane'];
const KEY = 'scribble-city-v5-bridge';
const RING_C = [1, 0.82, 0.16];

export class BrokenBridge {
  constructor(game) {
    this.game = game;
    // idle (its ring), on (to the bridge and over), down (in the sea), won
    this.state = 'idle';
    this.tries = 0;
    this.used = new Set();
    this.saved = null;
    this.solved = new Set();
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && Array.isArray(o.solved)) this.solved = new Set(o.solved);
    } catch (err) {
      // (none kept)
    }
    this.group = null;
    this.gpsOn = false;
    this.build();
  }

  // ------------------------------------------------------------------ the place
  // how high the bridge's deck is along it (x)
  deckY(x) {
    if (x < DECK0) return clamp((x - RAMP0) / (DECK0 - RAMP0), 0, 1) * DECK_Y;
    if (x < KICK0) return DECK_Y;
    return DECK_Y + clamp((x - KICK0) / (EDGE - KICK0), 0, 1) * (KICK_Y - DECK_Y);
  }

  // what a car stands on here (game/vehicles.js drive; y: how high it is now) - -Infinity: nothing
  // of the mission's. The decks are stood on from above: under one, in the water, it is no floor
  floorAt(x, z, y = 99) {
    if (x < RAMP0 - 1 || x > ISLE.x1 + 1) return -Infinity;
    const over = (h) => (y > h - 0.7 ? h : -Infinity);
    if (Math.abs(z - Z) <= HALF && x >= RAMP0 && x <= EDGE) return x < DECK0 ? this.deckY(x) : over(this.deckY(x));
    if (Math.abs(z - Z) <= HALF && x >= FAR0 && x < ISLE.x0) return over(FAR_Y);
    if (x >= ISLE.x0 && x <= ISLE.x1 && z >= ISLE.z0 && z <= ISLE.z1) return over(FAR_Y);
    if (x >= SLIP.x0 && x < SLIP.x1 && z >= SLIP.z0 && z <= SLIP.z1) return -1.05 + ((x - SLIP.x0) / (SLIP.x1 - SLIP.x0)) * (FAR_Y + 1.05);
    return -Infinity;
  }

  // the sinking car is the mission's to deal with (game/fuse.js sea): no swimming out of it
  holds(v) {
    return (this.state === 'on' || this.state === 'down') && v === this.game.player.inVehicle;
  }

  build() {
    const g = this.game;
    if (!g.scene) return;
    const M = itemMats();
    const K = new Kit();
    const WOOD = linC(0.66, 0.46, 0.27);
    const WOOD_L = linC(0.8, 0.62, 0.4);
    const WOOD_D = linC(0.42, 0.28, 0.16);
    const CON = linC(0.74, 0.73, 0.7);
    const RED = linC(0.86, 0.18, 0.16);
    const WHITE = linC(0.95, 0.94, 0.9);
    const ORANGE = linC(1, 0.5, 0.12);
    // a box turned about z (up the slope)
    const slab = (cx, cy, cz, sx, sy, sz, rz, col, rx = 0) => {
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      if (rx) geo.rotateX(rx);
      if (rz) geo.rotateZ(rz);
      geo.translate(cx, cy, cz);
      K.add(M.matte, geo, col);
    };
    const hash = (n) => {
      const s = Math.sin(n * 127.1) * 43758.5453;
      return s - Math.floor(s);
    };
    // ---- the bridge: its planks across, up off the sand and out over the sea
    let i = 0;
    for (let x = RAMP0 + 0.3; x < EDGE - 0.2; x += 0.62) {
      i++;
      const y = this.deckY(x);
      const sl = Math.atan2(this.deckY(x + 0.3) - this.deckY(x - 0.3), 0.6);
      const c = hash(i) * 0.12;
      slab(x, y - 0.07, Z, 0.56, 0.12, HALF * 2, sl, linC(0.72 - c, 0.52 - c, 0.31 - c * 0.6));
    }
    // (its beams under it, either side, and the piles down into the water)
    for (const s of [-1, 1]) {
      for (let x = RAMP0; x < EDGE; x += 2) {
        const y0 = this.deckY(x);
        const y1 = this.deckY(Math.min(EDGE, x + 2));
        slab(x + 1, (y0 + y1) / 2 - 0.25, Z + s * (HALF - 0.3), 2.02, 0.3, 0.3, Math.atan2(y1 - y0, 2), WOOD_D);
      }
      for (const x of [90, 98, 106]) K.box(M.matte, x - 0.3, -3, Z + s * (HALF - 0.3) - 0.3, x + 0.3, this.deckY(x) - 0.3, Z + s * (HALF - 0.3) + 0.3, CON);
      // (its rails, posts and two bars - up to where it broke)
      for (let x = DECK0 - 6; x <= EDGE - 1.5; x += 1.8) {
        const y = this.deckY(x);
        const top = x > EDGE - 3 ? 0.55 : 1.05;
        K.box(M.matte, x - 0.06, y - 0.05, Z + s * HALF - 0.06, x + 0.06, y + top, Z + s * HALF + 0.06, WOOD_D);
      }
      for (const h of [0.55, 1.0]) {
        for (let x = DECK0 - 6; x < EDGE - 3; x += 1.8) {
          const y0 = this.deckY(x) + h;
          const y1 = this.deckY(x + 1.8) + h;
          slab(x + 0.9, (y0 + y1) / 2, Z + s * HALF, 1.85, 0.07, 0.08, Math.atan2(y1 - y0, 1.8), WOOD);
        }
      }
    }
    // (the break: planks snapped off and hanging, a stump of a pile in the gap)
    for (let k = 0; k < 6; k++) {
      const z = Z - HALF + 0.6 + hash(k + 40) * (HALF * 2 - 1.2);
      const len = 1.2 + hash(k + 50) * 1.4;
      const a = 0.5 + hash(k + 60) * 0.9;
      slab(EDGE + Math.cos(a) * len * 0.5, KICK_Y - 0.1 - Math.sin(a) * len * 0.5, z, len, 0.1, 0.5, -a, WOOD_L);
    }
    for (const x of [118, 127]) {
      for (const s of [-1, 1]) K.box(M.matte, x - 0.28, -3, Z + s * (HALF - 0.3) - 0.28, x + 0.28, -0.2 + hash(x + s) * 0.9, Z + s * (HALF - 0.3) + 0.28, CON);
    }
    // ---- the other half, broken off: on to the island
    for (let x = FAR0 + 0.3; x < ISLE.x0; x += 0.62) {
      i++;
      const c = hash(i) * 0.12;
      slab(x, FAR_Y - 0.07, Z, 0.56, 0.12, HALF * 2, 0, linC(0.72 - c, 0.52 - c, 0.31 - c * 0.6));
    }
    for (let k = 0; k < 5; k++) {
      const z = Z - HALF + 0.6 + hash(k + 70) * (HALF * 2 - 1.2);
      const len = 1 + hash(k + 80) * 1.3;
      const a = 0.6 + hash(k + 90) * 0.8;
      slab(FAR0 - Math.cos(a) * len * 0.5, FAR_Y - 0.1 - Math.sin(a) * len * 0.5, z, len, 0.1, 0.5, a, WOOD_L);
    }
    for (const s of [-1, 1]) for (const x of [140, 146]) K.box(M.matte, x - 0.3, -3, Z + s * (HALF - 0.3) - 0.3, x + 0.3, FAR_Y - 0.3, Z + s * (HALF - 0.3) + 0.3, CON);
    // ---- the island: a deck of planks on piles, a flag at the far end, crates
    for (let z = ISLE.z0 + 0.3; z < ISLE.z1; z += 0.66) {
      i++;
      const c = hash(i) * 0.1;
      K.box(M.matte, ISLE.x0, FAR_Y - 0.14, z - 0.3, ISLE.x1, FAR_Y, z + 0.3, linC(0.7 - c, 0.5 - c, 0.3 - c * 0.6));
    }
    for (let x = ISLE.x0 + 1; x < ISLE.x1; x += 5) for (let z = ISLE.z0 + 1; z < ISLE.z1; z += 6) K.box(M.matte, x - 0.3, -3, z - 0.3, x + 0.3, FAR_Y - 0.14, z + 0.3, WOOD_D);
    const fx = ISLE.x1 - 4;
    K.cyl(M.metal, 0.08, 0.08, FAR_Y, FAR_Y + 7, WHITE, { axis: 'y', x: fx, z: Z });
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) K.box(M.matte, fx + 0.1 + a * 0.5, FAR_Y + 5.4 + b * 0.5, Z - 0.03, fx + 0.6 + a * 0.5, FAR_Y + 5.9 + b * 0.5, Z + 0.03, (a + b) % 2 ? WHITE : linC(0.1, 0.1, 0.12));
    for (const [x, z, s] of [[158, 18, 1.1], [159.3, 18.4, 0.9], [172, 41, 1.2], [165, 40, 0.8]]) K.box(M.matte, x - s / 2, FAR_Y, z - s / 2, x + s / 2, FAR_Y + s, z + s / 2, WOOD_L);
    // (the slipway up out of the water, buoys along it)
    for (let x = SLIP.x0 + 0.3; x < SLIP.x1; x += 0.62) {
      const y = this.floorAt(x, (SLIP.z0 + SLIP.z1) / 2);
      const sl = Math.atan2(FAR_Y + 1.05, SLIP.x1 - SLIP.x0);
      slab(x, y - 0.07, (SLIP.z0 + SLIP.z1) / 2, 0.56, 0.12, SLIP.z1 - SLIP.z0, sl, CON);
    }
    for (let k = 0; k < 5; k++) {
      for (const z of [SLIP.z0 - 0.8, SLIP.z1 + 0.8]) K.sphere(M.paint, 0.32, SLIP.x0 - 4 - k * 6, -0.72, z, k % 2 ? ORANGE : WHITE);
    }
    // ---- on the sand: a barrier knocked aside, a striped board
    for (let k = 0; k < 6; k++) K.box(M.matte, RAMP0 - 3.2 + k * 0.4, 0.55, Z + HALF + 1.2, RAMP0 - 2.8 + k * 0.4, 0.8, Z + HALF + 1.4, k % 2 ? RED : WHITE);
    for (const dx of [-3.3, -0.9]) K.box(M.matte, RAMP0 + dx, -0.6, Z + HALF + 1.25, RAMP0 + dx + 0.1, 0.55, Z + HALF + 1.35, WOOD_D);
    const group = K.build({ seed: 0.47 });
    group.matrixAutoUpdate = false;
    group.updateMatrix();
    g.scene.add(group);
    this.group = group;
  }

  // ------------------------------------------------------------------ it
  update(dt) {
    const g = this.game;
    const p = g.player;
    const v = p.inVehicle;
    const pos = v ? v.pos : p.pos;
    const S = g.fuse && g.fuse.sheets;
    if (this.state === 'idle' || this.state === 'won') {
      if (S && S.hint) S.hint = null;
      // (the way to it, once)
      if (this.state === 'idle' && !this.gpsOn && g.gps && g.time > 1) {
        this.gpsOn = true;
        if (Math.hypot(pos.x - START.x, pos.z - START.z) > 20) g.gps.set(START.x, START.z, 'הגשר השבור');
      }
      if (this.state === 'won' && this.tellAt && g.time > this.tellAt) {
        this.tellAt = 0;
        const left = ALL_WAYS.filter((k) => !this.solved.has(k));
        const n = ALL_WAYS.length - left.length;
        g.hud.toast(left.length ? `מצאתם ${n} מתוך ${ALL_WAYS.length} דרכים — נסו גם: ${left.slice(0, 3).map((k) => WAYS[k]).join(', ')} (העיגול הצהוב — שוב)` : 'מצאתם את כל הדרכים!', 'good', 5);
      }
      const at = this.state === 'won' ? AGAIN : START;
      const ok = p.mode === 'foot' || (v && !v.air && (v.kind === 'car' || v.kind === 'bike'));
      if (ok && Math.hypot(pos.x - at.x, pos.z - at.z) < 3.4 && g.state === 'play') this.start();
      return;
    }
    if (this.state === 'down') {
      this.downT -= g.realDt || dt;
      if (this.downT <= 0) this.retry();
      return;
    }
    // ---- on the way
    if (!v) {
      // (out of the car: swimming in the sea is the end of this try)
      if (p.mode === 'swim' && p.pos.x > 100) this.fail();
      else if (S) S.hint = null;
      return;
    }
    if (Math.hypot(pos.x - 120, pos.z - Z) > 460) {
      this.quit();
      return;
    }
    if (pos.x > EDGE - 3) this.watch(v);
    if (v.fzSink > 1.2) {
      this.fail();
      return;
    }
    // (over: on the island or its half of the bridge, on its wheels)
    if (!v.air && pos.x > FAR0 && this.floorAt(pos.x, pos.z) > 0 && (v.pos.y || 0) > 0.6) {
      this.win(v);
      return;
    }
    // (the way: to the bridge, then over to the island)
    if (g.gps && !this.gpsIsle && pos.x > RAMP0 - 30) {
      this.gpsIsle = true;
      g.gps.set((ISLE.x0 + ISLE.x1) / 2, Z, 'האי');
    }
    // (by the bridge with nothing on the car that would get it over: what to draw, dashed on it)
    const near = pos.x > 36 && pos.x < EDGE + 2 && Math.abs(pos.z - Z) < 40;
    if (S) S.hint = near && !canCross(v) ? { v, type: this.tries % 2 ? 'float' : 'wing' } : null;
    if (near && !this.toldPen && !this.toldOnce && pos.x > 48) {
      this.toldPen = true;
      this.toldOnce = true;
      g.hud.radio(g.touch ? 'הגשר שבור באמצע! ✎ — ציירו על המכונית משהו שיעביר אתכם' : 'הגשר שבור באמצע! Q — ציירו על המכונית משהו שיעביר אתכם');
      this.radioT = g.time + 6;
    }
    if (this.radioT && g.time > this.radioT) {
      this.radioT = 0;
      g.hud.radio(null);
    }
    // (going off its end: what is on it now, to try again with)
    if (pos.x > KICK0 && pos.x < EDGE + 1 && Math.abs(pos.z - Z) < HALF + 1 && g.fuse) this.saved = g.fuse.saveVeh(v) || null;
  }

  // how it is getting over (from the broken end on)
  watch(v) {
    const fz = v.fz || {};
    const g = this.game;
    if (v.air) {
      if (fz.rotor >= 1 && v.fzLifting) this.used.add('rotor');
      if (fz.balloon >= 1 && v.fzLifting) this.used.add('balloon');
      if (fz.plane && v.fzLifting) this.used.add('plane');
      if (v.fzChute) this.used.add('chute');
      if ((v.glide || 0) >= 0.45) this.used.add('wings');
      if (v.fzSpringT && g.time - v.fzSpringT < 3) this.used.add('spring');
    } else if (fz.float && fz.float.k >= 1 && v.fzWet) this.used.add('floats');
  }

  how() {
    for (const k of ['plane', 'rotor', 'balloon', 'floats', 'spring', 'chute', 'wings']) if (this.used.has(k)) return k;
    return 'jump';
  }

  start() {
    const g = this.game;
    const p = g.player;
    let v = p.inVehicle;
    const again = this.state === 'won';
    if (!v) {
      v = g.vehicles.spawnStock({ kind: 'sedan', color: [0.96, 0.8, 0.22] }, { x: again ? BACK.x : START.x, z: again ? BACK.z : START.z }, Math.PI / 2);
      g.enterVehicle(v);
    } else if (again) {
      v.pos.set(BACK.x, 0, BACK.z);
      v.yaw = BACK.yaw;
      v.vx = v.vz = v.vy = 0;
      v.speed = 0;
      v.air = false;
      g.camRig.yaw = BACK.yaw;
    }
    this.state = 'on';
    this.used.clear();
    this.saved = null;
    this.toldPen = false;
    this.gpsIsle = false;
    g.hud.big('הגשר השבור', 2000);
    g.audio.play('alarm', 0.5);
    g.hud.toast('המשטרה בדרך! הגשר לאי נשבר באמצע — תמצאו דרך לעבור את המים', 'bad', 4);
    if (g.police) g.police.addHeat(1.8, v.pos.x, v.pos.z, true);
    if (g.gps) g.gps.set(RAMP0 - 4, Z, 'הגשר השבור');
    g.updateGoals();
  }

  // into the sea: back on the bridge in a moment
  fail() {
    const g = this.game;
    if (this.state !== 'on') return;
    this.state = 'down';
    this.downT = 2.4;
    this.tries++;
    g.hud.big('נפלתם למים!', 1700);
    const S = g.fuse && g.fuse.sheets;
    if (S) S.hint = null;
  }

  retry() {
    const g = this.game;
    const p = g.player;
    const old = p.inVehicle;
    if (old) {
      g.exitVehicle(true);
      old.dead = true;
      old.removeAt = g.time + 0.5;
    }
    if (g.swim && g.swim.on) g.swim.leave();
    p.mode = 'foot';
    p.pos.set(BACK.x, 0.3, BACK.z);
    const v = g.vehicles.spawnStock({ kind: 'sedan', color: [0.96, 0.8, 0.22] }, { x: BACK.x, z: BACK.z }, BACK.yaw);
    g.enterVehicle(v);
    g.camRig.yaw = BACK.yaw;
    if (this.saved && g.fuse) g.fuse.loadVeh(v, this.saved);
    this.state = 'on';
    this.used.clear();
    this.gpsIsle = false;
    g.hud.toast(this.tries % 2 ? 'שוב! אולי מצופים — צורה ארוכה ונמוכה לאורך המכונית, ולשוט לרציף שמימין' : 'שוב! כנפיים גדולות יותר גולשות רחוק יותר — המספר ליד העט אומר כמה', 'info', 4.5);
  }

  win(v) {
    const g = this.game;
    const how = this.how();
    this.state = 'won';
    this.solved.add(how);
    try {
      localStorage.setItem(KEY, JSON.stringify({ solved: [...this.solved] }));
    } catch (err) {
      // (not kept)
    }
    g.hud.big('עברתם את הגשר!', 2400);
    g.audio.play('cheer', 0.7);
    g.hud.toast(`הדרך שלכם: ${WAYS[how]}`, 'good', 4.5);
    if (g.police) g.police.clear();
    if (g.money) g.money.earn(how === 'jump' ? 200 : 400, 'הגשר השבור');
    if (g.gps) g.gps.clear();
    this.tellAt = g.time + 3;
    const S = g.fuse && g.fuse.sheets;
    if (S) S.hint = null;
    g.updateGoals();
  }

  // gone far away: it waits at its ring
  quit() {
    const g = this.game;
    this.state = 'idle';
    const S = g.fuse && g.fuse.sheets;
    if (S) S.hint = null;
    if (g.gps) g.gps.clear();
    g.updateGoals();
  }

  // what the goals say meanwhile (game/game.js updateGoals) - null: the game's own
  goals() {
    const g = this.game;
    if (this.state === 'on' || this.state === 'down') {
      const v = g.player.inVehicle;
      return [
        { text: 'לעבור לאי — הגשר שבור באמצע', done: false },
        { text: g.touch ? 'לצייר על המכונית (✎) משהו שיעביר אותה' : 'לצייר על המכונית (Q) משהו שיעביר אותה', done: !!(v && canCross(v)) },
      ];
    }
    if (this.state === 'idle') return [{ text: 'משימה: הגשר השבור — העיגול הצהוב בקצה רחוב 9', done: false }];
    return null;
  }

  // ------------------------------------------------------------------ drawn
  // its ring: a yellow circle on the ground and a column of light over it (to it, or to go again)
  draw(fr) {
    const g = this.game;
    if (this.state !== 'idle' && this.state !== 'won') return;
    const at = this.state === 'won' ? AGAIN : START;
    const y = this.state === 'won' ? FAR_Y + 0.05 : 0.08;
    const t = g.time;
    const R = 2.6 + Math.sin(t * 3) * 0.12;
    const n = 32;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2 + t * 0.4;
      const a1 = ((k + 0.6) / n) * Math.PI * 2 + t * 0.4;
      fr.lineXYZ(at.x + Math.cos(a0) * R, y, at.z + Math.sin(a0) * R, at.x + Math.cos(a1) * R, y, at.z + Math.sin(a1) * R, RING_C, 4, 9700 + k, 0.95, 0.01, 0);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + t * 0.7;
      const r = 1.2;
      fr.lineXYZ(at.x + Math.cos(a) * r, y, at.z + Math.sin(a) * r, at.x + Math.cos(a) * r * 0.6, y + 9, at.z + Math.sin(a) * r * 0.6, RING_C, 2.2, 9750 + k, 0.35, 0.02, 0);
    }
  }
}

// does it have something on it that would get it over the gap
function canCross(v) {
  const fz = v.fz;
  if (!fz) return false;
  return (v.glide || 0) >= 0.5 || fz.rotor >= 1 || fz.balloon >= 1 || !!(fz.float && fz.float.k >= 1) || (fz.jump || 0) >= 10 || !!fz.chute || !!fz.plane;
}
