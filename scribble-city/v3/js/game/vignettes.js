import * as THREE from 'three';
import { civilianLook, kidLook, elderLook, painterLook } from './looks.js';
import { HAIR_SKETCH } from './airsketch.js';
import { blockRect, groundHeight } from '../world/layout.js';

// Little scenes that could only happen in a drawn city: a mum draws her daughter the hairdo she
// wants, a grandma draws grandpa a cane, a painter draws a door on a wall and somebody walks out
// of it, a rain cloud follows a man until he draws himself an umbrella...
// Each scene is a script (a generator): yield a number to wait that many seconds, or a function
// to wait until it returns true.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const HAIR_COLORS = [[0.95, 0.55, 0.7], [0.62, 0.32, 0.72], [0.25, 0.62, 0.65], [0.95, 0.8, 0.3], [0.85, 0.3, 0.25], [0.2, 0.15, 0.12], [0.3, 0.45, 0.85]];

export class Vignettes {
  constructor(game) {
    this.game = game;
    this.defs = sceneDefs(game.world);
    this.active = new Map();
    this.cool = new Map();
    this.scanT = 0;
    this.momentT = 6;
    this.moments = [];
  }

  get budget() {
    return this.game.touch ? 2 : 4;
  }

  update(dt) {
    const game = this.game;
    if (game.inBar) return;
    const p = game.anchorPos();
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.5;
      const near = this.defs
        .map((d) => [Math.hypot(d.x - p.x, d.z - p.z), d])
        .filter(([dist, d]) => dist < 55 && !(this.cool.get(d.id) > game.time))
        .sort((a, b) => a[0] - b[0])
        .slice(0, this.budget)
        .map((n) => n[1]);
      const want = new Set(near.map((d) => d.id));
      for (const [id, sc] of this.active) {
        const d = Math.hypot(sc.def.x - p.x, sc.def.z - p.z);
        // over, far away, or a nearer scene needs the slot (and this one is out of sight anyway)
        const crowded = !want.has(id) && d > 32 && near.some((n) => !this.active.has(n.id));
        if (sc.finished || d > 80 || crowded) {
          sc.dispose();
          this.active.delete(id);
          this.cool.set(id, game.time + (sc.finished ? 45 : 5));
        }
      }
      // new actors only appear where you aren't looking (or far off), so nobody pops into view
      const cam = game.camera;
      _w.set(0, 0, -1).applyQuaternion(cam.quaternion);
      for (const d of near) {
        if (this.active.has(d.id) || this.active.size >= this.budget || this.cool.get(d.id) > game.time) continue;
        const dx = d.x - cam.position.x;
        const dz = d.z - cam.position.z;
        const dist = Math.hypot(dx, dz);
        const inView = (dx * _w.x + dz * _w.z) / (dist || 1) > 0.2;
        if (game.time > 3 && inView && dist < 38) continue;
        this.active.set(d.id, new Scene(this, d));
      }
    }
    for (const sc of this.active.values()) sc.update(dt);
    this.updateMoments(dt);
  }

  draw(fr) {
    for (const sc of this.active.values()) sc.draw(fr);
  }

  clear() {
    for (const sc of this.active.values()) sc.dispose();
    this.active.clear();
  }

  // ------------------------------------------------------------------ everyday magic
  // now and then somebody on the street stops and draws themselves something
  updateMoments(dt) {
    const game = this.game;
    this.momentT -= dt;
    if (this.momentT > 0) return;
    this.momentT = 7 + Math.random() * 8;
    const p = game.player.pos;
    const cam = game.camera;
    _w.set(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null;
    for (const c of game.civilians.list) {
      if (c.scripted || c.ctrl || !c.alive || c.panicT > 0 || c.headless || c.inside) continue;
      const dx = c.pos.x - p.x;
      const dz = c.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 6 || d > 26) continue;
      // somebody you can see
      if ((dx * _w.x + dz * _w.z) / d < 0.5) continue;
      best = c;
      break;
    }
    if (!best) return;
    const L = best.fig.look;
    const options = [];
    if (!L.hat) options.push(['hat', 'hat', () => (L.hat = { kind: pick(['fedora', 'beanie', 'cap', 'beret']), color: pick(HAIR_COLORS) }), ['Nice hat, me.', 'Much better.']]);
    if (L.face.glasses !== 'shades') options.push(['shades', 'sunglasses', () => (L.face.glasses = 'shades'), ['Too bright today.', 'Cool.']]);
    if (!best.fig.carry) options.push(['coffee', 'cup', () => (best.fig.carry = 'coffee'), ['Ahh, coffee.', 'Needed that.']]);
    if (!best.fig.carry) options.push(['ice', 'cone', () => (best.fig.carry = 'icecream'), ['Mmm!', 'Hot day.']]);
    if (!best.fig.carryL) options.push(['flower', 'flower', () => (best.fig.carryL = 'flower'), ['For later.', 'Pretty.']]);
    if (!options.length) return;
    const [, shape, apply, lines] = pick(options);
    let t = 0;
    let sk = null;
    best.ctrl = (civ) => {
      t += 1 / 30;
      if (!sk) {
        civ.faceYaw = Math.atan2(game.camera.position.x - civ.pos.x, game.camera.position.z - civ.pos.z);
        if (t > 0.5) {
          const head = civ.fig.j.headC;
          const at = new THREE.Vector3(head.x, head.y + 0.25, head.z);
          at.x += civ.fig.forward.x * 0.45;
          at.z += civ.fig.forward.z * 0.45;
          sk = game.airsketch.draw({
            shape,
            at,
            size: 0.38,
            author: civ,
            target: shape === 'hat' || shape === 'sunglasses' ? head.clone() : civ.fig.j.handR.clone(),
            targetScale: 0.5,
            dur: 1.1,
            onPlop: () => {
              apply();
              if (Math.random() < 0.6) game.bubbles.say(civ, pick(lines));
              civ.ctrl = null;
              civ.faceYaw = null;
            },
          });
        }
      } else if (sk.phase === 'gone' && civ.ctrl) {
        civ.ctrl = null;
        civ.faceYaw = null;
      }
      return null;
    };
  }
}

// ------------------------------------------------------------------ where the scenes are
// All around the start: the alley you wake up in, the sidewalk out to the avenue, the bar's
// window, and the far sidewalk by the paint-blaster billboard.
function sceneDefs(world) {
  const r = blockRect(0, 4); // the start block (the hideout's block)
  const r2 = blockRect(1, 4); // across the avenue
  const bar = world.bar || { x: -175, z: 94 };
  const zm = (r.z0 + 4.5 + r.z1 - 4.5) / 2;
  const col = world.collision;
  const ex = r2.x0 + 3.4; // the walkway between the trees and the houses
  return [
    { id: 'painter', x: r.x1 - 11, z: zm - 2.5, script: painterScene, wall: { x: r.x1 - 11, z: zm - 2.5 }, exit: { x: r.x1 - 1.5, z: zm } },
    { id: 'cane', x: r.x1 - 2.35, z: r.z0 + 10, script: caneScene, path: { x: r.x1 - 2.35, z0: r.z0 + 5, z1: r.z0 + 30 } },
    { id: 'hairdo', ...freeSpot(col, bar.x - 3, r.z0 + 3.3, 1, 0, 0.9), script: hairScene },
    { id: 'balloon', ...freeSpot(col, ex, r2.z0 + 29, 0, 1, 0.5), script: balloonScene },
    { id: 'dog', x: ex, z: r2.z0 + 9, script: dogScene, path: { x: ex, z0: r2.z0 + 6, z1: r2.z0 + 18 } },
    { id: 'rain', x: ex, z: r2.z0 + 38, script: rainScene, path: { x: ex, z0: r2.z0 + 32, z1: r2.z0 + 42 } },
  ];
}

// the nearest spot along (ax, az) where a person (and a friend r metres further on) can stand
function freeSpot(col, x, z, ax, az, r) {
  const v = new THREE.Vector3();
  const ok = (px, pz) => {
    for (const k of [0, r]) {
      v.set(px + ax * k, 0.15, pz + az * k);
      const x0 = v.x;
      const z0 = v.z;
      col.resolveCylinder(v, 0.45, 1.7, 0.3);
      if (Math.hypot(v.x - x0, v.z - z0) > 0.02) return false;
    }
    return true;
  };
  for (let i = 0; i < 24; i++) {
    const o = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5;
    if (ok(x + ax * o, z + az * o)) return { x: x + ax * o, z: z + az * o };
  }
  return { x, z };
}

// ------------------------------------------------------------------ a running scene
class Scene {
  constructor(dir, def) {
    this.dir = dir;
    this.game = dir.game;
    this.def = def;
    this.actors = [];
    this.props = {}; // things the scene draws itself (balloons, a cloud, a dog, a door)
    this.wait = 0;
    this.waitFn = null;
    this.finished = false;
    this.broken = false;
    this.t = 0;
    this.gen = def.script(this, def);
  }

  // a scripted person; walk(), face() and pose fields drive them
  spawn(look, x, z, yaw = 0, figOpts = null) {
    const c = this.game.civilians.spawnScripted(x, z, look, this, figOpts);
    c.yaw = yaw;
    c.goal = null;
    c.ctrl = (civ) => civ.goal;
    this.actors.push(c);
    return c;
  }

  update(dt) {
    this.t += dt;
    if (this.finished) return;
    // anyone scared off (or rubbed out)? the scene is over, the people run like everybody else
    for (const a of this.actors) {
      if (a.owner === this && (!a.alive || a.panicT > 0 || a.headless)) {
        this.broken = true;
        break;
      }
    }
    if (this.broken) {
      this.letGo();
      this.finished = true;
      return;
    }
    if (this.onTick) this.onTick(dt);
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    if (this.waitFn) {
      if (!this.waitFn()) return;
      this.waitFn = null;
    }
    for (let guard = 0; guard < 20; guard++) {
      const r = this.gen.next();
      if (r.done) {
        this.letGo();
        this.finished = true;
        return;
      }
      const v = r.value;
      if (typeof v === 'number') {
        if (v > 0) {
          this.wait = v;
          return;
        }
      } else if (typeof v === 'function') {
        if (!v()) {
          this.waitFn = v;
          return;
        }
      }
    }
  }

  letGo() {
    const civs = this.game.civilians;
    for (const a of this.actors) {
      if (a.owner !== this) continue;
      a.fig.hunch = 0;
      a.fig.stagger = 0;
      civs.release(a);
    }
  }

  dispose() {
    const civs = this.game.civilians;
    for (const a of this.actors) if (a.owner === this) civs.remove(a);
    this.actors = [];
    if (this.onDispose) this.onDispose();
  }

  // ---- script helpers (use with yield*)
  *walk(a, x, z, speed = 1.2, near = 0.35) {
    a.goal = { x, z, speed };
    let t = 0;
    while (Math.hypot(a.pos.x - x, a.pos.z - z) > near && t < 40) {
      t += 0.1;
      yield 0.1;
    }
    a.goal = null;
  }

  face(a, yawOrActor) {
    a.faceYaw = typeof yawOrActor === 'number' ? yawOrActor : Math.atan2(yawOrActor.pos.x - a.pos.x, yawOrActor.pos.z - a.pos.z);
  }

  faceCam(a) {
    const c = this.game.camera.position;
    a.faceYaw = Math.atan2(c.x - a.pos.x, c.z - a.pos.z);
  }

  say(a, text, tone) {
    if (!a.alive || a.owner !== this) return;
    const p = this.game.player.pos;
    if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 40) this.game.bubbles.say(a, text, tone);
  }

  // draw something in the air; resolves when it has plopped
  *sketch(o) {
    let done = false;
    const user = o.onPlop;
    this.game.airsketch.draw({
      ...o,
      onPlop: (sk) => {
        done = true;
        if (user) user(sk);
      },
    });
    const author = o.author;
    let t = 0;
    while (!done && t < 12) {
      t += 0.1;
      if (author && author.owner !== this) return;
      yield 0.1;
    }
  }

  near(r = 30) {
    const p = this.game.player.pos;
    return Math.hypot(this.def.x - p.x, this.def.z - p.z) < r;
  }

  hop(a, dur = 1.2, height = 0.22) {
    const t0 = this.t;
    const prev = this.onTick;
    this.onTick = (dt) => {
      if (prev) prev(dt);
      const k = this.t - t0;
      a.hopY = k < dur ? Math.abs(Math.sin(k * 8)) * height : 0;
      a.fig.armsUp = k < dur ? 1 : 0;
    };
  }

  draw(fr) {
    for (const k in this.props) {
      const pr = this.props[k];
      if (pr && pr.draw) pr.draw(fr, this);
    }
  }
}

// ------------------------------------------------------------------ 1. the painter's door
function* painterScene(sc, def) {
  const g = sc.game;
  const wallZ = def.wall.z; // the alley side of the north row (faces +z)
  let x = def.wall.x;
  const painter = sc.spawn(painterLook(), x + 1.5, wallZ + 1.3, Math.PI);
  const wall = { rx: -1, rz: 0, nx: 0, nz: 1 };
  for (let round = 0; round < 6; round++) {
    yield* sc.walk(painter, x + 0.35, wallZ + 1.05, 1.0, 0.2);
    sc.face(painter, Math.PI);
    yield 0.6;
    // the outline of a door, right on the bricks
    const door = { x, z: wallZ, open: 0, filled: 0, sk: null };
    sc.props.door = { draw: drawWallDoor, door };
    let drawn = false;
    door.sk = g.airsketch.draw({ shape: 'door', at: new THREE.Vector3(x, groundHeight(x, wallZ + 1) + 1.12, wallZ + 0.02), size: 2.2, author: painter, wall, keep: true, dur: 3.2, width: 3.6, onDone: () => (drawn = true) });
    yield () => drawn || painter.owner !== sc;
    if (painter.owner !== sc) return;
    // it fills in and becomes a real door
    g.audio.play('plop', sc.near(25) ? 0.6 : 0);
    g.fx.crumbs(x, 1.2, wallZ + 0.3, 14, 2);
    for (let i = 0; i <= 10; i++) {
      door.filled = i / 10;
      yield 0.04;
    }
    yield* sc.walk(painter, x + 1.6, wallZ + 1.6, 1.0, 0.25);
    sc.face(painter, Math.atan2(x - painter.pos.x, wallZ - painter.pos.z));
    sc.say(painter, pick(['Voila.', 'Now that\'s a door.', 'Perfect.']));
    yield 1.2;
    // ...and somebody opens it from the other side
    for (let i = 0; i <= 12; i++) {
      door.open = i / 12;
      yield 0.04;
    }
    const look = civilianLook();
    const guest = g.civilians.spawnAt(x, wallZ + 0.45, look);
    guest.yaw = 0;
    let leg = 0;
    guest.ctrl = (civ) => {
      if (leg === 0 && civ.pos.z > wallZ + 2.2) leg = 1;
      if (leg === 1 && Math.hypot(civ.pos.x - def.exit.x, civ.pos.z - def.exit.z) < 1) civ.ctrl = null;
      return leg === 0 ? { x, z: wallZ + 2.6, speed: 1.1 } : { x: def.exit.x, z: def.exit.z, speed: 1.2 };
    };
    yield 0.9;
    sc.say(guest, pick(['Finally! Fresh air!', 'Thanks for the door!', 'Where am I?', 'Is this Sketch Ave?', 'Huh. Nice alley.']));
    yield 1.4;
    sc.say(painter, pick(['You\'re welcome!', 'Mind the paint!', 'Next!']));
    for (let i = 12; i >= 0; i--) {
      door.open = i / 12;
      yield 0.05;
    }
    yield 1.5;
    // rub it out and start another one further along
    yield* sc.walk(painter, x + 0.35, wallZ + 1.05, 1.0, 0.2);
    sc.face(painter, Math.PI);
    painter.fig.reachR = new THREE.Vector3(x, 1.3, wallZ + 0.1);
    for (let i = 0; i < 8; i++) {
      painter.fig.reachR.set(x + Math.sin(i * 1.7) * 0.4, 0.6 + (i % 4) * 0.45, wallZ + 0.1);
      g.fx.crumbs(painter.fig.reachR.x, painter.fig.reachR.y, wallZ + 0.15, 3, 1.4);
      if (i % 3 === 0 && sc.near(20)) g.audio.play('erase', 0.35);
      yield 0.18;
    }
    painter.fig.reachR = null;
    g.airsketch.erase(door.sk);
    sc.props.door = null;
    yield 2;
    x += round % 2 ? 7 : -7;
  }
}

// a filled, hinged door on the wall (opens toward the alley)
function drawWallDoor(fr, sc) {
  const d = this.door;
  if (!d.filled) return;
  const y0 = groundHeight(d.x, d.z + 1);
  const w = 1.05;
  const h = 2.2;
  const x0 = d.x + w / 2; // the hinge (the knob of the drawing is on the other side)
  const z = d.z + 0.03;
  // warm light inside when open
  if (d.open > 0) {
    for (let i = 0; i < 5; i++) {
      const u = d.x - w / 2 + 0.1 + (i / 4) * (w - 0.2);
      fr.lineXYZ(u, y0 + 0.05, z + 0.005, u, y0 + h - 0.08, z + 0.005, [0.98, 0.82, 0.5], 22, 700 + i, 0.95, 0.002, 0);
    }
  }
  // the panel, swinging out around its hinge
  const a = d.open * 1.35;
  const ex = x0 - Math.cos(a) * w;
  const ez = z + Math.sin(a) * w;
  const col = [0.55, 0.36, 0.2];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const px = x0 + (ex - x0) * t;
    const pz = z + (ez - z) * t + 0.01;
    fr.lineXYZ(px, y0 + 0.06, pz, px, y0 + h - 0.06, pz, col, 24 * d.filled, 720 + i, 0.92, 0.002, 0);
  }
  const ink = [0.1, 0.1, 0.14];
  fr.lineXYZ(x0, y0, z + 0.012, x0, y0 + h, z + 0.012, ink, 2.4, 740, 1, 0.01, 0.01);
  fr.lineXYZ(ex, y0, ez + 0.012, ex, y0 + h, ez + 0.012, ink, 2.4, 741, 1, 0.01, 0.01);
  fr.lineXYZ(x0, y0 + h, z + 0.012, ex, y0 + h, ez + 0.012, ink, 2.4, 742, 1, 0.01, 0.01);
  fr.lineXYZ(x0 + (ex - x0) * 0.85, y0 + 1.0, z + (ez - z) * 0.85 + 0.03, x0 + (ex - x0) * 0.87, y0 + 1.0, z + (ez - z) * 0.87 + 0.03, [0.95, 0.8, 0.3], 7, 743, 1, 0.002, 0.02);
}

// ------------------------------------------------------------------ 2. grandma draws grandpa a cane
function* caneScene(sc, def) {
  const g = sc.game;
  const P = def.path;
  const gp = sc.spawn(elderLook(false), P.x, P.z0, 0);
  const gm = sc.spawn(elderLook(true), P.x - 0.75, P.z0 - 0.3, 0);
  gp.fig.hunch = 1;
  gp.fig.stagger = 0.5;
  // grandpa shuffles, grandma keeps pace beside him
  sc.onTick = () => {
    if (gm.goalFollow) gm.goal = { x: gp.pos.x - 0.75, z: gp.pos.z - 0.2, speed: Math.max(0.3, Math.hypot(gp.vel.x, gp.vel.z) * 1.2 + 0.1) };
  };
  gm.goalFollow = true;
  yield* sc.walk(gp, P.x, P.z0 + 3.5, 0.6);
  gm.goalFollow = false;
  gm.goal = null;
  sc.face(gp, gm);
  sc.face(gm, gp);
  sc.say(gp, pick(['Oh... my aching back.', 'Oy. These legs...', 'Hold on, Martha...']));
  yield 2.2;
  sc.say(gm, pick(['Hold still, Harold.', 'I\'ve got just the thing.']));
  yield 1;
  // a cane drawn in the air beside him, plop: in his hand
  const hand = gp.fig.j.handR;
  const at = new THREE.Vector3(hand.x + gp.fig.right.x * 0.35, gp.pos.y + 0.75, hand.z + gp.fig.right.z * 0.35);
  yield* sc.sketch({ shape: 'cane', at, size: 1.15, author: gm, target: hand.clone(), targetScale: 0.85, dur: 1.6 });
  gp.fig.carry = 'cane';
  gp.fig.stagger = 0;
  for (let i = 0; i < 10; i++) {
    gp.fig.hunch = 1 - (i / 10) * 0.75;
    yield 0.05;
  }
  gp.fig.dance = 1;
  sc.say(gp, pick(['Like new!', 'Look at me go!', 'Ha HA!']));
  yield 1.6;
  gp.fig.dance = 0;
  sc.say(gm, pick(['Show-off.', 'Don\'t overdo it.']));
  yield 0.8;
  gm.goalFollow = true;
  yield* sc.walk(gp, P.x, P.z0 + 14, 0.85);
  gm.goalFollow = false;
  gm.goal = null;
  // the menu in the cafe window is too small to read...
  sc.face(gp, Math.PI / 2 + Math.PI);
  sc.say(gp, pick(['I can\'t read a thing...', 'Is that a P or an R?']));
  yield 2;
  sc.face(gm, gp);
  const head = gp.fig.j.headC;
  const at2 = new THREE.Vector3(head.x + gp.fig.forward.x * 0.5, head.y + 0.15, head.z + gp.fig.forward.z * 0.5);
  yield* sc.sketch({ shape: 'glasses', at: at2, size: 0.32, author: gm, target: head.clone(), targetScale: 0.6, dur: 1.2 });
  gp.fig.look.face.glasses = 'round';
  sc.face(gp, gm);
  yield 0.5;
  sc.say(gp, pick(['Oh! Hello, gorgeous.', 'Martha! You look wonderful!', 'Much better.']));
  yield 1.8;
  sc.say(gm, '<3');
  yield 1.2;
  gm.goalFollow = true;
  yield* sc.walk(gp, P.x, P.z1, 0.85);
  gm.goalFollow = false;
}

// ------------------------------------------------------------------ 3. mum draws her daughter's hair
function* hairScene(sc, def) {
  const g = sc.game;
  const mx = def.x;
  const mz = def.z;
  const mum = sc.spawn(civilianLook({ fem: true, kind: pick(['casual', 'dress', 'artsy']) }), mx, mz, Math.PI / 2);
  const kid = sc.spawn(kidLook(true), mx + 1.0, mz + 0.1, -Math.PI / 2, { scale: 0.62 });
  sc.face(mum, kid);
  sc.face(kid, mum);
  const styles = ['pigtails', 'spacebuns', 'braids', 'afro', 'beehive', 'ponytail', 'long', 'bun'];
  const names = { pigtails: 'pigtails', spacebuns: 'space buns', braids: 'braids', afro: 'a big afro', beehive: 'a beehive', ponytail: 'a ponytail', long: 'long hair', bun: 'a bun' };
  let n = 0;
  while (n < 8) {
    const style = styles[(n + Math.floor(Math.random() * 3)) % styles.length];
    const color = pick(HAIR_COLORS);
    sc.face(mum, kid);
    sc.face(kid, mum);
    sc.say(kid, pick([`Mom! I want ${names[style]}!`, `${names[style]}! Pleeease!`, `Can I have ${names[style]}?`]));
    yield 2;
    sc.say(mum, pick(['Hold still, sweetie.', 'Okay, okay.', 'Let me see...']));
    yield 0.8;
    const head = () => kid.fig.j.headC;
    const prank = n % 3 === 2;
    const draw = prank ? 'mohawk' : style;
    yield* sc.sketch({ shape: HAIR_SKETCH[draw](prank ? [0.3, 0.75, 0.3] : color), at: head().clone().setY(head().y + 0.04), size: 0.42 * 0.62 * 1.45, author: mum, target: head().clone(), targetScale: 0.85, dur: 1.5 });
    kid.fig.look.hair = { style: draw, color: prank ? [0.3, 0.75, 0.3] : color };
    if (prank) {
      // oops
      kid.fig.stagger = 0.8;
      sc.say(kid, pick(['MOM! NO!', 'MOOOM!', 'Ewww!']));
      yield 1.6;
      kid.fig.stagger = 0;
      sc.say(mum, pick(['Oops. Wrong page.', 'Sorry! Sorry!']));
      // the eraser end
      mum.fig.reachR = head().clone();
      for (let i = 0; i < 6; i++) {
        mum.fig.reachR.set(head().x + Math.sin(i * 2) * 0.08, head().y + 0.12, head().z + Math.cos(i * 2) * 0.08);
        g.fx.crumbs(head().x, head().y + 0.15, head().z, 3, 1.2);
        yield 0.15;
      }
      mum.fig.reachR = null;
      kid.fig.look.hair = { style: 'none', color: kid.fig.look.skin };
      sc.say(kid, 'Waaah!');
      yield 1.4;
      yield* sc.sketch({ shape: HAIR_SKETCH[style](color), at: head().clone().setY(head().y + 0.04), size: 0.42 * 0.62 * 1.45, author: mum, target: head().clone(), targetScale: 0.85, dur: 1.4 });
      kid.fig.look.hair = { style, color };
    }
    // she loves it
    sc.hop(kid, 1.4, 0.24);
    if (sc.near(25)) g.audio.play('cheer', 0.7);
    sc.say(kid, pick(['I LOVE IT!!', 'Yesss!', 'Best mom ever!', 'So pretty!']));
    yield 1.5;
    kid.fig.armsUp = 0;
    sc.say(mum, pick(['Beautiful!', 'Gorgeous.', 'There you go.']));
    yield 5 + Math.random() * 4;
    n++;
  }
}

// ------------------------------------------------------------------ 4. a balloon that gets away
function* balloonScene(sc, def) {
  const g = sc.game;
  const kid = sc.spawn(kidLook(false), def.x, def.z, Math.PI, { scale: 0.62 });
  const balloons = [];
  sc.props.balloons = { draw: drawBalloons, list: balloons };
  sc.onTick = (dt) => {
    for (const b of balloons) {
      b.t += dt;
      if (b.held && kid.alive && kid.owner === sc) {
        const h = kid.fig.j.handR;
        const tx = h.x + Math.sin(b.t * 1.3 + b.s) * 0.12 + b.ox;
        const tz = h.z + Math.cos(b.t * 1.1 + b.s) * 0.12;
        b.x += (tx - b.x) * Math.min(1, dt * 4);
        b.z += (tz - b.z) * Math.min(1, dt * 4);
        b.y += (h.y + b.len - b.y) * Math.min(1, dt * 4);
        b.hx = h.x;
        b.hy = h.y;
        b.hz = h.z;
      } else {
        b.held = false;
        b.vy = Math.min(1.6, (b.vy || 0.2) + dt * 0.6);
        b.y += b.vy * dt;
        b.x += Math.sin(b.t * 0.7 + b.s) * dt * 0.5;
        b.z += Math.cos(b.t * 0.5 + b.s) * dt * 0.3;
        b.hx = b.x;
        b.hy = b.y - b.len;
        b.hz = b.z;
        if (b.y > 75 && !b.popped) {
          b.popped = true;
          g.fx.crumbs(b.x, b.y, b.z, 10, 2);
        }
      }
    }
    for (let i = balloons.length - 1; i >= 0; i--) if (balloons[i].popped) balloons.splice(i, 1);
  };
  const make = (col, ox = 0) => {
    const h = kid.fig.j.handR;
    const b = { x: h.x, y: h.y + 1.0, z: h.z, t: 0, s: Math.random() * 6, held: true, col, len: 1.05 + Math.random() * 0.2, ox };
    balloons.push(b);
    return b;
  };
  for (let round = 0; round < 4; round++) {
    sc.faceCam(kid);
    yield 0.8;
    const h = kid.fig.j.handR;
    const col = pick([[0.88, 0.2, 0.22], [0.25, 0.5, 0.9], [0.95, 0.75, 0.2], [0.55, 0.3, 0.8]]);
    const shape = [{ pts: [...Array(15)].map((_, i) => [Math.cos((i / 14) * Math.PI * 2) * 0.17, 0.2 + Math.sin((i / 14) * Math.PI * 2) * 0.22]), col, w: 2 }, { pts: [[0, -0.02], [0.04, -0.15], [-0.03, -0.27], [0.03, -0.39], [0, -0.5]], col: [0.1, 0.1, 0.12], w: 0.8 }];
    yield* sc.sketch({ shape, at: new THREE.Vector3(h.x, h.y + 0.75, h.z), size: 1.0, author: kid, target: new THREE.Vector3(h.x, h.y + 0.95, h.z), targetScale: 1, dur: 1.3 });
    kid.fig.carry = 'balloon';
    make(col);
    sc.hop(kid, 1.0, 0.18);
    sc.say(kid, pick(['Yay!', 'A balloon!', 'Look, look!']));
    yield 3.5 + Math.random() * 2;
    // a wave to somebody across the street... and the string slips
    for (const b of balloons) b.held = false;
    kid.fig.carry = null;
    kid.fig.armsUp = 1;
    sc.say(kid, pick(['No! My balloon!', 'Come back!', 'Nooo!']));
    yield 1.6;
    kid.fig.armsUp = 0;
    kid.fig.hunch = 0.6;
    sc.say(kid, 'Waaah!');
    yield 2.2;
    kid.fig.hunch = 0;
    yield 0.6;
    // this time: two, with a knot
    if (round % 2 === 1) {
      sc.say(kid, pick(['This time with a knot.', 'Double knot!']));
      yield 1.2;
    }
  }
}

function drawBalloons(fr) {
  for (const b of this.list) {
    const r = 0.3;
    let px = b.x + r;
    let py = b.y;
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = b.x + Math.cos(a) * r;
      const y = b.y + Math.sin(a) * r * 1.2;
      fr.lineXYZ(px, py, b.z, x, y, b.z, b.col, 3.2, 600 + i, 1, 0.01, 0.01);
      px = x;
      py = y;
    }
    // crayon fill
    for (let i = 0; i < 4; i++) {
      const yy = b.y + (i - 1.5) * 0.1;
      const hw = Math.sqrt(Math.max(0, 1 - ((yy - b.y) / (r * 1.2)) ** 2)) * r * 0.85;
      fr.lineXYZ(b.x - hw, yy, b.z, b.x + hw, yy + 0.04, b.z, b.col, 14, 620 + i, 0.75, 0.004, 0);
    }
    // the string
    const by = b.y - r * 1.2;
    fr.lineXYZ(b.x, by, b.z, (b.x + b.hx) / 2 + 0.04, (by + b.hy) / 2, (b.z + b.hz) / 2, [0.12, 0.12, 0.14], 1.2, 640, 1, 0.02, 0);
    fr.lineXYZ((b.x + b.hx) / 2 + 0.04, (by + b.hy) / 2, (b.z + b.hz) / 2, b.hx, b.hy, b.hz, [0.12, 0.12, 0.14], 1.2, 641, 1, 0.02, 0);
  }
}

// ------------------------------------------------------------------ 5. a dog drawn on a leash
function* dogScene(sc, def) {
  const g = sc.game;
  const P = def.path;
  const man = sc.spawn(civilianLook({ fem: Math.random() < 0.4, kind: pick(['casual', 'sporty', 'office']) }), P.x, P.z0, 0);
  yield 0.6;
  const dog = { x: 0, z: 0, y: 0, yaw: 0, speed: 0, t: 0, wag: 0, mode: 'none', col: pick([[0.55, 0.36, 0.2], [0.85, 0.75, 0.55], [0.25, 0.22, 0.2], [0.95, 0.95, 0.92]]) };
  sc.props.dog = { draw: drawDog, dog };
  const at = new THREE.Vector3(man.pos.x + man.fig.forward.x * 1.4, man.pos.y + 0.6, man.pos.z + man.fig.forward.z * 1.4);
  sc.face(man, Math.atan2(at.x - man.pos.x, at.z - man.pos.z));
  yield* sc.sketch({ shape: 'dog', at, size: 1.0, author: man, target: new THREE.Vector3(at.x, man.pos.y + 0.35, at.z), targetScale: 0.85, dur: 2.2 });
  dog.x = at.x;
  dog.z = at.z;
  dog.y = man.pos.y;
  dog.mode = 'zoom';
  man.fig.carryL = 'leash';
  man.fig.leashTo = new THREE.Vector3();
  if (sc.near(25)) g.audio.play('bark', 0.8);
  sc.say(man, pick(['Who\'s a good boy?', 'Aww, look at you!']));
  // the dog goes wild, running circles and pulling him around
  let barkT = 0;
  sc.onTick = (dt) => {
    dog.t += dt;
    const cx = man.pos.x;
    const cz = man.pos.z;
    if (dog.mode === 'zoom') {
      const a = dog.t * 2.4;
      const tx = cx + Math.cos(a) * 0.9;
      const tz = cz + Math.sin(a) * 2.0;
      dog.speed = 4.3;
      steerDog(dog, tx, tz, dt);
      man.faceYaw = Math.atan2(dog.x - cx, dog.z - cz);
      // dragged along
      man.pos.x += (dog.x - cx) * dt * 0.5;
      man.pos.z += (dog.z - cz) * dt * 0.5;
      man.fig.stagger = 0.7;
      barkT -= dt;
      if (barkT < 0) {
        barkT = 0.9 + Math.random();
        if (sc.near(22)) g.audio.play('bark', 0.6);
      }
    } else if (dog.mode === 'fetch') {
      dog.speed = 4.5;
      steerDog(dog, dog.bx, dog.bz, dt);
      if (Math.hypot(dog.x - dog.bx, dog.z - dog.bz) < 0.3) dog.mode = 'sit';
    } else if (dog.mode === 'sit') {
      dog.speed = 0;
      dog.wag = 1;
    } else if (dog.mode === 'heel') {
      // trots a little ahead of the man
      const f = man.fig.forward;
      dog.speed = Math.max(1.2, Math.hypot(man.vel.x, man.vel.z) + 0.3);
      steerDog(dog, man.pos.x + f.x * 1.3 + man.fig.right.x * 0.4, man.pos.z + f.z * 1.3 + man.fig.right.z * 0.4, dt);
    }
    dog.y = groundHeight(dog.x, dog.z);
    man.fig.leashTo.set(dog.x + Math.sin(dog.yaw) * 0.22, dog.y + 0.42, dog.z + Math.cos(dog.yaw) * 0.22);
  };
  yield 2;
  sc.say(man, pick(['Whoa! WHOA!', 'Heel! HEEL!', 'Easy, boy!']));
  yield 2.6;
  // a bone: the only language a drawn dog understands
  man.fig.stagger = 0;
  dog.mode = 'zoomSlow';
  dog.speed = 0;
  const bAt = new THREE.Vector3(man.pos.x + man.fig.right.x * 0.6, man.pos.y + 1.3, man.pos.z + man.fig.right.z * 0.6);
  const bx = P.x;
  const bz = Math.min(P.z1, man.pos.z + 3.5);
  yield* sc.sketch({ shape: 'bone', at: bAt, size: 0.5, author: man, target: new THREE.Vector3(bx, man.pos.y + 0.08, bz), targetScale: 0.6, dur: 1.0 });
  dog.bx = bx;
  dog.bz = bz;
  dog.mode = 'fetch';
  dog.bone = true;
  yield () => dog.mode === 'sit';
  sc.say(man, pick(['Good boy.', 'Phew.', 'That\'s better.']));
  yield 2;
  dog.bone = false;
  dog.mode = 'heel';
  for (let i = 0; i < 3; i++) {
    yield* sc.walk(man, P.x, P.z1, 1.1);
    yield* sc.walk(man, P.x, P.z0, 1.1);
  }
}

function steerDog(dog, tx, tz, dt) {
  const dx = tx - dog.x;
  const dz = tz - dog.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  const want = Math.atan2(dx, dz);
  let da = want - dog.yaw;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  dog.yaw += da * Math.min(1, dt * 8);
  const v = Math.min(dog.speed, d * 4);
  dog.x += Math.sin(dog.yaw) * v * dt;
  dog.z += Math.cos(dog.yaw) * v * dt;
  dog.moving = v;
}

// a scribbled dog: an ink body, a round head, four trotting legs and a wagging tail
function drawDog(fr) {
  const d = this.dog;
  if (d.mode === 'none') return;
  const fx = Math.sin(d.yaw);
  const fz = Math.cos(d.yaw);
  const rx = -fz;
  const rz = fx;
  const y = d.y;
  const P = (f, r, h, out) => out.set(d.x + fx * f + rx * r, y + h, d.z + fz * f + rz * r);
  const col = d.col;
  const ink = [0.1, 0.1, 0.12];
  const run = (d.moving || 0) > 0.3 ? d.t * 14 : 0;
  // body
  P(-0.28, 0, 0.42, _v);
  P(0.22, 0, 0.44, _w);
  fr.lineXYZ(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, col, 30, 800, 1, 0.006, 0.02);
  fr.lineXYZ(_v.x, _v.y + 0.09, _v.z, _w.x, _w.y + 0.09, _w.z, ink, 2.2, 801, 1, 0.01, 0.03);
  fr.lineXYZ(_v.x, _v.y - 0.08, _v.z, _w.x, _w.y - 0.08, _w.z, ink, 2.2, 802, 1, 0.01, 0.03);
  // head
  const sit = d.mode === 'sit' ? 1 : 0;
  P(0.36, 0, 0.62 + sit * 0.04, _v);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    fr.lineXYZ(_v.x + Math.cos(a0) * 0.12 * rx, _v.y + Math.sin(a0) * 0.12, _v.z + Math.cos(a0) * 0.12 * rz, _v.x + Math.cos(a1) * 0.12 * rx, _v.y + Math.sin(a1) * 0.12, _v.z + Math.cos(a1) * 0.12 * rz, ink, 2.2, 810 + i, 1, 0.01, 0.01);
  }
  fr.lineXYZ(_v.x - rx * 0.08, _v.y, _v.z - rz * 0.08, _v.x + rx * 0.08, _v.y + 0.01, _v.z + rz * 0.08, col, 22, 820, 1, 0.004, 0);
  // snout, ear, eye
  P(0.47, 0, 0.6 + sit * 0.04, _w);
  fr.lineXYZ(_v.x, _v.y - 0.02, _v.z, _w.x + fx * 0.04, _w.y - 0.03, _w.z + fz * 0.04, col, 12, 821, 1, 0.004, 0);
  fr.lineXYZ(_w.x + fx * 0.04, _w.y - 0.02, _w.z + fz * 0.04, _w.x + fx * 0.06, _w.y - 0.02, _w.z + fz * 0.06, ink, 7, 822, 1, 0.002, 0);
  fr.lineXYZ(_v.x - fx * 0.05, _v.y + 0.08, _v.z - fz * 0.05, _v.x - fx * 0.1, _v.y - 0.06 + Math.sin(d.t * 9) * 0.02, _v.z - fz * 0.1, ink, 5, 823, 1, 0.006, 0);
  if (d.bone) {
    P(0.55, 0, 0.56, _w);
    fr.lineXYZ(_w.x - rx * 0.12, _w.y, _w.z - rz * 0.12, _w.x + rx * 0.12, _w.y, _w.z + rz * 0.12, [0.95, 0.94, 0.88], 8, 824, 1, 0.003, 0);
  }
  // legs
  const legs = [[0.16, 0.08, 0], [0.16, -0.08, Math.PI], [-0.22, 0.08, Math.PI], [-0.22, -0.08, 0]];
  legs.forEach(([f, r, ph], i) => {
    const sw = Math.sin(run + ph) * 0.12;
    const back = i >= 2 && sit ? 1 : 0;
    P(f, r, 0.36, _v);
    P(f + sw - back * 0.12, r, back ? 0.12 : 0.02, _w);
    fr.lineXYZ(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, col, 7, 830 + i, 1, 0.006, 0);
    fr.lineXYZ(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, ink, 1.4, 840 + i, 0.9, 0.01, 0);
  });
  // tail
  const wag = Math.sin(d.t * (d.wag || run ? 16 : 4)) * 0.12;
  P(-0.3, 0, 0.46, _v);
  P(-0.42, wag, 0.62, _w);
  fr.lineXYZ(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, col, 6, 850, 1, 0.01, 0);
  fr.shadow(d.x, d.y, d.z, 0.35, 860, 0.3);
}

// ------------------------------------------------------------------ 6. the rain cloud
function* rainScene(sc, def) {
  const g = sc.game;
  const P = def.path;
  const man = sc.spawn(civilianLook({ fem: false, kind: pick(['office', 'casual']) }), P.x, P.z0, 0);
  const cloud = { x: man.pos.x, y: 4, z: man.pos.z, size: 0, follow: man, drops: [], t: 0, alpha: 1, umbrellaOver: null };
  sc.props.cloud = { draw: drawCloud, cloud };
  sc.onTick = (dt) => {
    cloud.t += dt;
    const f = cloud.follow;
    if (f) {
      const fp = f.pos || f;
      const k = Math.min(1, dt * (cloud.chase ? 1.4 : 3));
      cloud.x += (fp.x - cloud.x) * k;
      cloud.z += (fp.z - cloud.z) * k;
      cloud.y += (fp.y + 3.1 - cloud.y) * k;
    }
    // the rain: short blue lines falling from the cloud; they stop on an umbrella
    if (cloud.size > 0.5 && cloud.alpha > 0.2) {
      while (cloud.drops.length < 18) cloud.drops.push({ x: cloud.x + (Math.random() - 0.5) * 1.4 * cloud.size, y: cloud.y - 0.3, z: cloud.z + (Math.random() - 0.5) * 1.0 * cloud.size, v: 7 + Math.random() * 2 });
    }
    const stopY = cloud.umbrellaOver ? cloud.umbrellaOver.fig.j.handR.y + 1.15 : -1;
    for (const dr of cloud.drops) {
      dr.y -= dr.v * dt;
      const ground = groundHeight(dr.x, dr.z);
      if (dr.y < Math.max(ground, stopY) + 0.05) dr.dead = true;
    }
    cloud.drops = cloud.drops.filter((d) => !d.dead);
  };
  for (let round = 0; round < 4; round++) {
    // a cloud scribbles itself into the sky right over him
    cloud.follow = man;
    cloud.chase = false;
    cloud.alpha = 1;
    for (let i = 0; i <= 10; i++) {
      cloud.size = i / 10;
      yield 0.08;
    }
    man.fig.hunch = 0.3;
    yield* sc.walk(man, P.x, (P.z0 + P.z1) / 2, 1.0);
    man.fig.lookAt = new THREE.Vector3(cloud.x, cloud.y, cloud.z);
    sc.faceCam(man);
    sc.say(man, pick(['Not again...', 'Seriously?', 'Every. Single. Day.']));
    yield 1.8;
    man.fig.lookAt = null;
    man.fig.hunch = 0;
    const h = man.fig.j.handR;
    yield* sc.sketch({ shape: 'umbrella', at: new THREE.Vector3(man.pos.x + man.fig.forward.x * 0.5, man.pos.y + 2.1, man.pos.z + man.fig.forward.z * 0.5), size: 1.1, author: man, target: new THREE.Vector3(h.x, h.y + 0.9, h.z), targetScale: 1.1, dur: 1.5 });
    man.fig.carry = 'umbrella';
    man.fig.umbrellaColor = pick([[0.82, 0.22, 0.24], [0.2, 0.3, 0.6], [0.95, 0.75, 0.2], [0.15, 0.15, 0.18]]);
    cloud.umbrellaOver = man;
    sc.say(man, pick(['Ha!', 'Not today, cloud.', 'Ha. HA.']));
    yield 2.5;
    // the cloud gets bored and goes looking for somebody else... you, if you're around
    cloud.umbrellaOver = null;
    const p = g.player;
    if (Math.hypot(p.pos.x - cloud.x, p.pos.z - cloud.z) < 24 && p.mode === 'foot') {
      cloud.follow = p.pos;
      cloud.chase = true;
      g.hud.toast('ענן גשם נטפל אליך! תצייר מטריה או תברח', 'info', 3);
      yield 13;
    } else {
      cloud.follow = null;
      yield 1.5;
    }
    for (let i = 10; i >= 0; i--) {
      cloud.alpha = i / 10;
      yield 0.08;
    }
    cloud.size = 0;
    cloud.follow = null;
    yield* sc.walk(man, P.x, P.z1, 1.1);
    man.fig.carry = null;
    yield 2;
    yield* sc.walk(man, P.x, P.z0, 1.1);
    yield 1;
  }
}

function drawCloud(fr) {
  const c = this.cloud;
  if (c.size <= 0.01 || c.alpha <= 0.01) return;
  const s = c.size;
  const a = c.alpha;
  const ink = [0.32, 0.33, 0.4];
  // a scribbled cloud: loops over loops
  const loops = [[0, 0, 0.55], [-0.55, -0.08, 0.38], [0.55, -0.06, 0.42], [-0.22, 0.25, 0.4], [0.3, 0.22, 0.36]];
  loops.forEach(([ox, oy, r], k) => {
    const wob = Math.sin(c.t * 2 + k) * 0.03;
    let px = 0;
    let py = 0;
    let pz = 0;
    for (let i = 0; i <= 10; i++) {
      const t = (i / 10) * Math.PI * 2;
      const x = c.x + (ox + Math.cos(t) * (r + wob)) * s;
      const y = c.y + (oy + Math.sin(t) * (r + wob) * 0.7) * s;
      const z = c.z + Math.sin(t * 2 + k) * 0.08 * s;
      if (i) fr.lineXYZ(px, py, pz, x, y, z, ink, 3, 1000 + k * 12 + i, a, 0.02, 0.01);
      px = x;
      py = y;
      pz = z;
    }
  });
  // grey crayon in the middle
  for (let i = 0; i < 4; i++) {
    const y = c.y + (i - 1.5) * 0.14 * s;
    fr.lineXYZ(c.x - 0.7 * s, y, c.z, c.x + 0.7 * s, y + 0.05, c.z, [0.55, 0.57, 0.65], 26 * s, 1080 + i, 0.55 * a, 0.01, 0);
  }
  for (const d of c.drops) fr.lineXYZ(d.x, d.y, d.z, d.x - 0.03, d.y - 0.22, d.z, [0.35, 0.55, 0.9], 1.8, 1100 + (d.v * 10) % 50, 0.85 * a, 0.002, 0);
}
