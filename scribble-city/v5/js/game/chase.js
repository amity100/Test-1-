import { AVES, STREETS, NORTH_EDGE, SOUTH_EDGE, WEST_EDGE, BLVD, groundHeight } from '../world/layout.js';
import { angleDiff, damp, dampAngle } from '../core/util.js';

// (ROADMAP 6.1, not with ?classic) Real chases. With you in a car and the police after you:
//   - the car behind you calls on you to pull over first
//   - their cars come at you, not to where you were: up behind you, then beside your back wheel,
//     and in (the PIT: your car spins round and loses its speed; off a motorbike you fly); faster
//     with more stars, and round the cars and the people in their way
//   - one in front of you going your way gets into your lane and brakes; one coming the other
//     way stops across the road and its officers get out
//   - at two stars and more, a roadblock ahead of you on your road, out of sight: police cars
//     across it, officers behind them (round it on the pavement, or through the gap)
//   - slow down or stop and they pull up round you and get out (the old way, game/traffic.js)
// Every police car keeps its own few seconds between one shove and the next.

// how fast a police car goes after you, by stars (m/s)
const TOP = [0, 25, 28, 30, 32, 34];
const PIT_GAP = 3; // seconds between two shoves by the same car
const ROADBLOCK_EVERY = 22;
const PULL_OVER = ['Pull over! Now!', 'Stop the vehicle!', 'Pull over to the side!', 'Police! Stop the car!'];
const _way = { d: 0, side: 0, car: null, c: null, fx: 0, fz: 0, best: 0, found: false };

// (one thing in front of the police car _way.c: the nearest so far is kept)
function wayTest(x, z, w, car) {
  const W = _way;
  const dx = x - W.c.pos.x;
  const dz = z - W.c.pos.z;
  const a = dx * W.fx + dz * W.fz;
  if (a < 1.5 || a > W.best) return;
  const s = dx * W.fz - dz * W.fx;
  if (Math.abs(s) > w) return;
  W.best = a;
  W.found = true;
  W.d = a;
  W.side = s;
  W.car = car;
}

export class Chase {
  constructor(game) {
    this.game = game;
    this.blocks = []; // the roadblocks: { cars, officers, x, z, fx, fz }
    this.blockT = 8;
    this.fling = null;
    this.stats = { pits: 0, blocks: 0, rolling: 0, roadblocks: 0, calls: 0 };
    this.pitTold = false;
  }

  // the player's car while it is worth chasing like a car (moving, on the ground)
  quarry() {
    const v = this.game.player.inVehicle;
    if (!v || v.flies || v.kind === 'boat' || v.kind === 'tank' || v.dead) return null;
    return Math.abs(v.speed || 0) > 4 ? v : null;
  }

  // how fast a police car on its way to you goes, while you drive (game/traffic.js); 0: the old way
  pathSpeed() {
    return this.quarry() ? TOP[Math.min(this.game.police.level, TOP.length - 1)] : 0;
  }

  // a police car in pursuit (game/traffic.js updatePolice): driven here while you drive; false:
  // the old way (the path finder's, and pulling up when it gets to you)
  drive(c, dt) {
    if (c.blockYaw !== undefined) return this.block(c, dt);
    const v = this.quarry();
    if (!v) return false;
    const game = this.game;
    const dx = v.pos.x - c.pos.x;
    const dz = v.pos.z - c.pos.z;
    const d = Math.hypot(dx, dz);
    // far, or round a corner: the old way
    if (d > 40 || !game.world.collision.lineOfSight(c.pos.x, 1.2, c.pos.z, v.pos.x, 1.2, v.pos.z)) return false;
    c.siren = true;
    c.path = null;
    const sp = Math.abs(v.speed);
    const sg = Math.sign(v.speed) || 1;
    // which way you are going, where it is from you (in front, across) and which way it faces
    const fx = Math.sin(v.yaw) * sg;
    const fz = Math.cos(v.yaw) * sg;
    const along = -(dx * fx + dz * fz);
    const across = Math.abs(dx * fz - dz * fx);
    const facing = Math.sin(c.yaw) * fx + Math.cos(c.yaw) * fz;
    const hl = v.halfLen || 2;
    // coming the other way in front of you: it stops across the road (turning towards your side
    // of it, so it ends up in your way)
    if (along > 12 && across < 7 && facing < -0.6 && sp > 8) {
      const a = Math.atan2(fx, fz);
      c.blockYaw = dz * fx - dx * fz > 0 ? a - Math.PI / 2 : a + Math.PI / 2;
      c.blockLine = { x: v.pos.x, z: v.pos.z, fx, fz };
      this.stats.blocks++;
      return this.block(c, dt);
    }
    let tx;
    let tz;
    let goal;
    const lv = this.game.police.level;
    const top = TOP[Math.min(lv, TOP.length - 1)];
    if (along > hl && facing > 0.3) {
      // in front of you, going your way: into your lane, braking (a rolling block)
      if (!c.rolling) {
        c.rolling = true;
        this.stats.rolling++;
      }
      tx = v.pos.x + fx * (along + 10);
      tz = v.pos.z + fz * (along + 10);
      goal = Math.max(4, sp - 3);
    } else {
      // behind you or beside you: where you will be while far, then your back wheel
      if (!c.pitSide) c.pitSide = Math.random() < 0.5 ? 1 : -1;
      const rx = -fz * c.pitSide;
      const rz = fx * c.pitSide;
      if (d > 12) {
        tx = v.pos.x + fx * sp * 0.5;
        tz = v.pos.z + fz * sp * 0.5;
      } else {
        tx = v.pos.x - fx * hl * 0.55 + rx * 1.1;
        tz = v.pos.z - fz * hl * 0.55 + rz * 1.1;
      }
      goal = Math.min(top, sp + (d > 10 ? 7 : 2.5));
      // "pull over!" (once a car)
      if (!c.called && d < 25) {
        c.called = true;
        this.stats.calls++;
        game.bubbles.say(c, PULL_OVER[Math.floor(Math.random() * PULL_OVER.length)], 'cop');
      }
    }
    let want = Math.hypot(tx - c.pos.x, tz - c.pos.z) < 3 ? Math.atan2(fx, fz) : Math.atan2(tx - c.pos.x, tz - c.pos.z);
    // a car or somebody in the way: round it, slowing (for people: braking)
    const w = this.inWay(c);
    if (w) {
      want -= Math.sign(w.side || 1) * 0.5;
      if (w.car) {
        if (w.d < 8) goal = Math.min(goal, Math.max(4, Math.abs(w.car.speed || 0) + 3));
      } else if (w.d < 10) goal = Math.min(goal, 2);
    }
    const turn = Math.abs(angleDiff(c.yaw, want));
    const before = c.yaw;
    c.yaw = dampAngle(c.yaw, want, 3.6, dt);
    c.steer = damp(c.steer || 0, (angleDiff(before, c.yaw) / Math.max(dt, 1e-3)) * 0.3, 8, dt);
    goal *= turn > 1 ? 0.45 : turn > 0.5 ? 0.75 : 1;
    c.speed = damp(c.speed, goal, goal > c.speed ? 1.6 : 4, dt);
    // a wall in front: it brakes (and goes round it on the path the next time)
    const look = 2.4 + c.speed * 0.2;
    if (game.world.collision.pointInside(c.pos.x + Math.sin(c.yaw) * look, 0.8, c.pos.z + Math.cos(c.yaw) * look, 0.3)) c.speed = damp(c.speed, 2, 8, dt);
    return true;
  }

  // the nearest car or person in front of a police car, and on which side of its nose
  inWay(c) {
    const game = this.game;
    const W = _way;
    W.c = c;
    W.fx = Math.sin(c.yaw);
    W.fz = Math.cos(c.yaw);
    W.best = 5 + c.speed * 0.45;
    W.found = false;
    const T = game.traffic.list;
    for (let i = 0; i < T.length; i++) if (T[i] !== c && T[i].poofT === undefined) wayTest(T[i].pos.x, T[i].pos.z, 2.6, T[i]);
    const H = game.civilians.list;
    for (let i = 0; i < H.length; i++) if (!H[i].inside && H[i].alive !== false) wayTest(H[i].pos.x, H[i].pos.z, 1.6, null);
    const E = game.enemies.list;
    for (let i = 0; i < E.length; i++) if (E[i].alive) wayTest(E[i].pos.x, E[i].pos.z, 1.6, null);
    W.c = null;
    return W.found ? W : null;
  }

  // across the road in front of you: a skid on the way it was going, swinging round across it
  // and over onto your line; stopped, its officers get out
  block(c, dt) {
    const game = this.game;
    c.siren = true;
    c.path = null;
    if (c.slideX === undefined) {
      c.slideX = Math.sin(c.yaw) * c.speed;
      c.slideZ = Math.cos(c.yaw) * c.speed;
    }
    const k = Math.exp(-3.2 * dt);
    c.slideX *= k;
    c.slideZ *= k;
    const L = c.blockLine;
    const off = (c.pos.x - L.x) * L.fz - (c.pos.z - L.z) * L.fx;
    const swing = Math.max(-5, Math.min(5, -off * 2.5)) * dt;
    c.pos.x += c.slideX * dt + L.fz * swing;
    c.pos.z += c.slideZ * dt - L.fx * swing;
    c.yaw = dampAngle(c.yaw, c.blockYaw, 4.5, dt);
    c.steer = 0;
    // (its speed is the skid's: game/traffic.js moves it no further)
    c.speed = 0;
    if (Math.hypot(c.slideX, c.slideZ) < 1.2) {
      c.blockYaw = undefined;
      c.blockLine = undefined;
      c.slideX = undefined;
      c.slideZ = undefined;
      game.traffic.park(c);
      game.police.deploy(c);
    }
    return true;
  }

  // a police car against your car (game/traffic.js collideVehicle); true: it is handled here
  // (no wreck). From behind or the side, at speed, it spins you round; else they only bump.
  contact(v, c) {
    const game = this.game;
    if (!c.police || c.mode !== 'pursuit' || !this.quarry()) return false;
    const vx = v.vx !== undefined ? v.vx : Math.sin(v.yaw) * v.speed;
    const vz = v.vz !== undefined ? v.vz : Math.cos(v.yaw) * v.speed;
    // (much faster into each other than that: a real crash, game/traffic.js)
    if (Math.hypot(vx - Math.sin(c.yaw) * c.speed, vz - Math.cos(c.yaw) * c.speed) > 12) return false;
    if (game.time < (c.pitT || 0) || c.speed < 5) return true;
    const sg = Math.sign(v.speed) || 1;
    const fx = Math.sin(v.yaw) * sg;
    const fz = Math.cos(v.yaw) * sg;
    const ox = c.pos.x - v.pos.x;
    const oz = c.pos.z - v.pos.z;
    if (ox * fx + oz * fz > (v.halfLen || 2) * 0.4) return true;
    c.pitT = game.time + PIT_GAP;
    // which way round: the nose towards the side it came in from, the back shoved away from it
    const side = Math.sign(ox * fz - oz * fx) || 1;
    const mx = (v.pos.x + c.pos.x) / 2;
    const mz = (v.pos.z + c.pos.z) / 2;
    if (v.kind === 'bike') {
      // off a motorbike you fly (after the bike's step: Chase.update)
      this.fling = { vx: vx * 0.75 - fz * side * 3, vz: vz * 0.75 + fx * side * 3, fx, fz, x: c.pos.x, z: c.pos.z };
    } else {
      v.spinT = 0.75;
      v.yawRate = (v.yawRate || 0) + side * (2.6 + Math.min(1.6, c.speed * 0.06));
      v.vx = vx * 0.85 - fz * side * 2.5;
      v.vz = vz * 0.85 + fx * side * 2.5;
      v.hurt(4);
    }
    c.speed *= 0.8;
    game.camRig.addShake(0.35);
    game.audio.play('crash', 0.7);
    if (game.damage) {
      game.damage.hit(v, mx, 0.7, mz, 8, true);
      game.damage.hit(c, mx, 0.7, mz, 6);
    }
    this.stats.pits++;
    if (!this.pitTold) {
      this.pitTold = true;
      game.hud.toast('ניידת סובבה אתכם! לא לתת להן להיצמד לגלגל האחורי', 'bad', 2.6);
    }
    return true;
  }

  // ------------------------------------------------------------------ every frame (game/police.js)
  update(dt) {
    const game = this.game;
    const P = game.police;
    const p = game.player;
    if (this.fling) {
      const f = this.fling;
      this.fling = null;
      if (p.inVehicle && p.inVehicle.kind === 'bike') {
        game.exitVehicle(true);
        p.hurt(10, f.x, f.z);
        if (game.ragdolls && p.mode === 'foot') {
          game.ragdolls.throw(p, f.vx, 3.4, f.vz, f.fz * 5, (Math.random() - 0.5) * 4, -f.fx * 5);
          p.thrown();
        }
      }
    }
    // the roadblocks go when the chase is over, or far behind you
    const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
    for (const b of this.blocks) {
      const d = Math.hypot(b.x - pp.x, b.z - pp.z);
      const past = (b.x - pp.x) * b.fx + (b.z - pp.z) * b.fz < -80;
      if (!P.hostile || d > 200 || past) this.lift(b);
    }
    if (this.blocks.some((b) => b.gone)) this.blocks = this.blocks.filter((b) => !b.gone);
    this.blockT -= dt;
    if (this.blockT > 0 || P.level < 2 || this.blocks.length) return;
    const v = this.quarry();
    if (!v || Math.abs(v.speed) < 8) return;
    // (if there is nowhere to put it, the next try is soon)
    this.blockT = this.roadblock(v) ? ROADBLOCK_EVERY : 3;
  }

  // ahead of you on the road you are on, where you can't see it yet: two cars across it (three
  // on the boulevard) and the officers behind them
  roadblock(v) {
    const game = this.game;
    const sg = Math.sign(v.speed) || 1;
    const fx = Math.sin(v.yaw) * sg;
    const fz = Math.cos(v.yaw) * sg;
    let road = null;
    if (Math.abs(fz) > 0.8) for (const a of AVES) if (Math.abs(v.pos.x - a.x) < a.half) road = { along: 'z', x: a.x, half: a.half };
    if (Math.abs(fx) > 0.8) for (const s of STREETS) if (Math.abs(v.pos.z - s.z) < s.half) road = { along: 'x', z: s.z, half: s.half };
    if (!road) return null;
    const dir = road.along === 'z' ? Math.sign(fz) : Math.sign(fx);
    const cam = game.camera.position;
    const col = game.world.collision;
    for (const D of [110, 95, 125, 80, 140]) {
      let x;
      let z;
      if (road.along === 'z') {
        x = road.x;
        z = v.pos.z + dir * D;
        // (not in a crossing, nor off the map)
        if (STREETS.some((s) => Math.abs(z - s.z) < s.half + 6) || z < NORTH_EDGE + 8 || z > SOUTH_EDGE - 8) continue;
      } else {
        z = road.z;
        x = v.pos.x + dir * D;
        if (AVES.some((a) => Math.abs(x - a.x) < a.half + 6) || x < WEST_EDGE + 8 || x > BLVD.x + BLVD.half) continue;
      }
      if (groundHeight(x, z) > 0.05) continue;
      if (Math.hypot(cam.x - x, cam.z - z) < 100 && col.lineOfSight(cam.x, cam.y, cam.z, x, 1.2, z)) continue;
      if (game.traffic.list.some((o) => Math.abs(o.pos.x - x) < 9 && Math.abs(o.pos.z - z) < 9)) continue;
      return this.place(road, x, z, dir);
    }
    return null;
  }

  place(road, x, z, dir) {
    const game = this.game;
    const T = game.traffic;
    const n = road.half > 7.5 ? 3 : 2;
    const across = road.along === 'z' ? Math.PI / 2 : 0;
    const b = { cars: [], officers: [], x, z, fx: road.along === 'z' ? 0 : dir, fz: road.along === 'z' ? dir : 0 };
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * ((road.half * 2) / n) * 0.95;
      // (a little V, nose to nose)
      const c = T.policeCar(road.along === 'z' ? x + off : x, road.along === 'z' ? z : z + off, across + (i - (n - 1) / 2) * 0.22, [], 'parked');
      c.siren = true;
      c.roadblock = true;
      T.park(c);
      b.cars.push(c);
    }
    // the officers behind the cars (on the side away from you), facing you, guns out
    const lv = game.police.level;
    const types = lv >= 4 ? ['swat', 'swat', 'swat'] : lv >= 3 ? ['swat', 'cop', 'cop'] : ['cop', 'cop', 'copEraser'];
    const target = game.police.target();
    types.forEach((type, i) => {
      const off = (i - 1) * road.half * 0.6;
      const ox = road.along === 'z' ? x + off : x + dir * 3.2;
      const oz = road.along === 'z' ? z + dir * 3.2 : z + off;
      const e = game.enemies.spawnOfficer(type, ox, oz, null, target);
      if (!e) return;
      e.yaw = road.along === 'z' ? (dir > 0 ? Math.PI : 0) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      b.officers.push(e);
    });
    // (ROADMAP 8.3) a row of cones across the road on your side of the cars: they fly
    if (game.knock) {
      const nc = road.half > 7.5 ? 6 : 4;
      for (let i = 0; i < nc; i++) {
        const off = (i / (nc - 1) - 0.5) * road.half * 1.45;
        const cx = road.along === 'z' ? x + off : x - dir * 5.5;
        const cz = road.along === 'z' ? z - dir * 5.5 : z + off;
        game.knock.cone(cx, cz, b);
      }
    }
    this.blocks.push(b);
    this.stats.roadblocks++;
    game.hud.toast('מחסום משטרה לפניכם!', 'bad', 2.4);
    return b;
  }

  // the cars drive off (game/traffic.js lets empty police cars go when nobody is looking); the
  // officers far behind you and not seeing you go too
  lift(b) {
    const game = this.game;
    const pp = game.player.inVehicle ? game.player.inVehicle.pos : game.player.pos;
    for (const c of b.cars) {
      if (c.gone) continue;
      c.mode = 'leave';
      c.siren = false;
    }
    for (const e of b.officers) if (e.alive && !e.sees && Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z) > 90) e.despawn = true;
    b.gone = true;
  }
}
