import * as THREE from 'three';
import { Kit, itemMats, linC } from '../items.js';
import { Pursuer } from './chase.js';
import { PARK } from './carpark.js';

// (v5, ROADMAP 18.9 round 11, the player's word) The car park fought through, not only driven up:
// the gang's cars come at Danny out of it - one after him from the street, others waiting in the dark
// on the floors above (at the end of the bays, in a corner of a turn, at the top of the ramp he is
// about to take, nose down it), each starting up as he comes onto its floor - and from every one a man
// leaning out of its window with a paint rifle. The paint is slow enough to see coming: driven fast
// and swerving, it goes wide and spatters the floor; dawdled, it hits - the car spattered where it
// lands, the screen too now and then, the car's strength going (the HUD's bar). Too much of it and
// they have him: back to where he came onto the floor (game/prologue/director.js caught).

// (the paint: a bright pink, a green, an orange, a blue - the gang's colours)
const PAINT = [[0.98, 0.18, 0.55], [0.22, 0.86, 0.32], [1, 0.6, 0.08], [0.24, 0.58, 1]];
const PAINT_CSS = ['#fb2e8c', '#38dc52', '#ff9914', '#3d94ff'];
// how fast the paint flies; how much of the car each hit takes; how much left when they have him
const SPEED = 34;
const DMG = 0.025;
const CAUGHT = 0.1;
// how many of each at once
const BALLS = 36;
const FLOOR_SPLATS = 70;
const CAR_SPLATS = 22;

const _v = new THREE.Vector3();
const _q = new THREE.Vector3();

function protoBall(color) {
  const K = new Kit();
  const M = itemMats();
  K.sphere(M.glow, 0.13, 0, 0, 0, linC(...color), 1, 1, 1, 8);
  K.sphere(M.paint, 0.09, -0.02, 0.05, -0.16, linC(...color), 1, 1, 1.6, 6);
  return K.build({ seed: 0.5 });
}
// a splat of paint: a blob and the drops round it (flat, on y = 0)
function protoSplat(color, seed) {
  const K = new Kit();
  const M = itemMats();
  let s = seed;
  const R = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const c = linC(...color);
  K.cyl(M.paint, 0.42, 0.42, 0, 0.012, c, { axis: 'y', segs: 9 });
  for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2;
    const d = 0.38 + R() * 0.45;
    const r = 0.05 + R() * 0.13;
    K.cyl(M.paint, r, r, 0, 0.012, c, { axis: 'y', x: Math.cos(a) * d, z: Math.sin(a) * d, segs: 6 });
  }
  return K.build({ seed: 0.6 });
}
const prep = (g) => {
  for (const m of g.children) {
    m.userData.noShadow = true;
    m.frustumCulled = false;
  }
  return g;
};

export class PaintFight {
  constructor(P) {
    this.P = P;
    this.g = P.game;
    this.enemies = [];
    this.balls = [];
    this.floorSplats = [];
    this.carSplats = [];
    this.on = true;
    this.hits = 0;
    this.ballProto = PAINT.map((c) => protoBall(c));
    this.splatProto = PAINT.map((c, i) => protoSplat(c, 11 + i * 7));
    this.warn = protoBall([1, 0.12, 0.1]);
    this.root = new THREE.Group();
    this.root.name = 'paintfight';
    this.g.scene.add(this.root);
    this.css();
  }

  // ------------------------------------------------------------------ the cars
  // a car of theirs: mode 'chase' (after him along his way), or 'wait' (still, dark, until he comes
  // within wake metres on its floor - then out at him); o.seed: the way they come in after him
  add(car, o = {}) {
    const g = this.g;
    const Q = new Pursuer(g, car, g.player.inVehicle);
    // (shoved aside by his car, not stopping it: game/vehicles.js)
    car.yields = true;
    Q.keep = o.keep !== undefined ? o.keep : 7;
    Q.catchUp = !!o.catchUp;
    Q.paused = o.mode === 'wait';
    if (o.seed) Q.seed(o.seed);
    const e = {
      car,
      Q,
      mode: o.mode || 'chase',
      color: o.color !== undefined ? o.color : Math.floor(Math.random() * PAINT.length),
      wake: o.wake || 30,
      wakeAt: o.wakeAt || null,
      lv: o.lv,
      gun: o.gun !== false,
      fireT: o.fireT !== undefined ? o.fireT : 1.2 + Math.random(),
      aimT: 0,
      burst: 0,
      burstT: 0,
      own: !!o.own,
      warn: null,
      label: o.label || '',
    };
    this.enemies.push(e);
    const L = this.P.pursuers || (this.P.pursuers = []);
    if (!L.includes(Q)) L.push(Q);
    return e;
  }

  // a car of theirs made for the fight (dark, its own), set down at (x, y, z) facing yaw
  spawn(x, y, z, yaw, o = {}) {
    const g = this.g;
    const DARKS = [[0.08, 0.08, 0.1], [0.16, 0.05, 0.06], [0.06, 0.07, 0.12], [0.12, 0.12, 0.13]];
    const car = g.vehicles.spawnStock({ kind: o.kind || (Math.random() < 0.5 ? 'sedan' : 'muscle'), color: DARKS[Math.floor(Math.random() * DARKS.length)] }, { x, z }, yaw);
    car.kept = true;
    car.pos.y = y + 0.05;
    return this.add(car, { ...o, own: true });
  }

  remove(e) {
    const g = this.g;
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    if (this.P.pursuers) this.P.pursuers = this.P.pursuers.filter((q) => q !== e.Q);
    e.Q.dispose();
    if (e.warn) this.root.remove(e.warn);
    if (e.own && e.car && !e.car.dead) {
      g.vehicles.list = g.vehicles.list.filter((v) => v !== e.car);
      e.car.dispose();
    }
  }

  // which floor (x, y, z) is on (a ramp: between two), -1 off it
  level(p) {
    const lv = PARK.levelAt(p.x, p.z, p.y + 0.3);
    return lv === null || lv >= 10 ? -1 : lv;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    if (!dt) return;
    const g = this.g;
    const me = g.player.inVehicle;
    const lvMe = me ? this.level(me.pos) : -1;
    // (worn down by anything - their paint, the walls hit hard - they have him)
    if (me && this.on && me.hp <= me.maxHp * CAUGHT && !this.P.caughtNow && !this.P.resetting && this.P.caught) this.P.caught();
    for (const e of this.enemies.slice()) {
      const c = e.car;
      if (!c || c.dead) {
        if (e.own) this.remove(e);
        continue;
      }
      e.Q.prey = me || e.Q.prey;
      if (!me) continue;
      const lv = this.level(c.pos);
      const d = Math.hypot(me.pos.x - c.pos.x, me.pos.z - c.pos.z);
      const dy = Math.abs(me.pos.y - c.pos.y);
      // (waiting: woken when he comes near on its floor)
      if (e.mode === 'wait') {
        const w = e.wakeAt;
        const near = (d < e.wake && dy < 3.2) || (w && Math.hypot(me.pos.x - w.x, me.pos.z - w.z) < w.r && Math.abs(me.pos.y - w.y) < 2.5);
        if (near && !this.P.holdCam) this.wakeUp(e);
        continue;
      }
      // (left two floors behind and out of the picture: gone - more of them up there)
      if (e.own && lvMe >= 0 && lv >= 0 && lvMe - lv > 1.6 && !e.Q.seen(c.pos)) {
        this.remove(e);
        continue;
      }
      e.d = d;
      e.dy = dy;
    }
    // (round 11: two of them at a time with the gun out - the nearest; none in the breath after he is
    // back from being caught)
    this.grace = Math.max(0, (this.grace || 0) - dt);
    if (me && this.on && !this.P.holdCam && this.grace === 0) {
      const live = this.enemies.filter((e) => e.mode === 'chase' && e.gun && e.car && !e.car.dead && e.d !== undefined).sort((a, b) => a.d - b.d);
      for (let i = 0; i < live.length; i++) {
        const e = live[i];
        if (i < 2) this.shoot(e, me, e.d, e.dy, dt);
        else this.glint(e, false);
      }
    }
    this.fly(dt, me);
  }

  wakeUp(e) {
    const g = this.g;
    const me = g.player.inVehicle;
    // (four of them after him at most: the one furthest behind, out of the picture, let go)
    const after = this.enemies.filter((q) => q.mode === 'chase' && q.own);
    if (after.length >= 3) {
      const far = after.filter((q) => !q.Q.seen(q.car.pos)).sort((a, b) => (b.d || 0) - (a.d || 0))[0];
      if (far) this.remove(far);
    }
    e.mode = 'chase';
    const Q = e.Q;
    Q.paused = false;
    Q.trail.length = 0;
    Q.i = 0;
    const c = e.car;
    // (out at him: from where it is to where he is going to be, then after him along his way)
    const lead = 0.9;
    Q.seed([[c.pos.x, c.pos.y, c.pos.z], [me.pos.x + (me.vx || 0) * lead, me.pos.y, me.pos.z + (me.vz || 0) * lead]]);
    e.fireT = 0.7 + Math.random() * 0.5;
    // (the first of it a warning, wide)
    e.warned = false;
    g.audio.play('roar', 0.55);
    const C = this.P.comic;
    if (C && C.word) C.word('VROOM!', new THREE.Vector3(c.pos.x, c.pos.y + 1.6, c.pos.z), { fill: PAINT_CSS[e.color], burst: '#1b1430', size: 0.075, life: 0.9 });
  }

  // the man at its window: he takes aim (a red glint at the window - long enough to see), then a burst
  shoot(e, me, d, dy, dt) {
    const c = e.car;
    const can = d > 4 && d < 46 && dy < 2.6;
    if (e.burst > 0) {
      e.burstT -= dt;
      if (e.burstT <= 0) {
        this.fire(e, me, d);
        e.burst--;
        e.burstT = 0.12;
        if (e.burst === 0) {
          e.fireT = 3 + Math.random() * 1.2;
          e.warned = true;
        }
      }
      return;
    }
    if (e.aimT > 0) {
      e.aimT -= dt;
      this.glint(e, true);
      if (e.aimT <= 0) {
        this.glint(e, false);
        if (can) {
          e.burst = 3;
          e.burstT = 0;
        } else e.fireT = 0.4;
      }
      return;
    }
    e.fireT -= dt;
    if (e.fireT <= 0 && can) {
      e.aimT = 0.5;
      this.g.audio.play('click', 0.35);
    }
    void c;
  }

  // the gun's window: the side of the car towards him
  muzzle(e, me) {
    const c = e.car;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const rx = fz;
    const rz = -fx;
    const side = (me.pos.x - c.pos.x) * rx + (me.pos.z - c.pos.z) * rz > 0 ? 1 : -1;
    return _q.set(c.pos.x + rx * side * 1.05 + fx * 0.2, c.pos.y + 1.25, c.pos.z + rz * side * 1.05 + fz * 0.2);
  }

  glint(e, on) {
    const me = this.g.player.inVehicle;
    if (on && me) {
      if (!e.warn) {
        e.warn = prep(this.warn.clone());
        this.root.add(e.warn);
      }
      const m = this.muzzle(e, me);
      e.warn.position.copy(m);
      const s = 0.8 + Math.sin(performance.now() / 40) * 0.35;
      e.warn.scale.setScalar(s);
      e.warn.visible = true;
    } else if (e.warn) e.warn.visible = false;
  }

  fire(e, me, d) {
    const g = this.g;
    const from = this.muzzle(e, me).clone();
    // (where he will be when it gets there, if he keeps on as he is going - and a hand that shakes)
    const t = d / SPEED;
    // (the faster he goes the wider it flies: crawling, it hits; flat out and swerving, mostly not)
    const sp = Math.hypot(me.vx || 0, me.vz || 0);
    let spread = sp < 6 ? 0.5 : sp < 14 ? 1.5 : 2.4;
    if (!e.warned) spread = 3.2;
    // (the film playing itself - the admin's autopilot: they shoot wide)
    if (this.P.autopilot) spread *= 4;
    const tx = me.pos.x + (me.vx || 0) * t * 0.92 + (Math.random() - 0.5) * 2 * spread;
    const tz = me.pos.z + (me.vz || 0) * t * 0.92 + (Math.random() - 0.5) * 2 * spread;
    const ty = me.pos.y + 0.75 + (Math.random() - 0.5) * 0.5;
    _v.set(tx - from.x, ty - from.y, tz - from.z);
    const L = _v.length() || 1;
    _v.multiplyScalar(SPEED / L);
    // (a little up, for the fall over the way)
    _v.y += 1.5 * t;
    let b = this.balls.find((q) => !q.live);
    if (!b) {
      if (this.balls.length >= BALLS) b = this.balls[0];
      else {
        b = { mesh: null, color: -1 };
        this.balls.push(b);
      }
    }
    if (b.color !== e.color) {
      if (b.mesh) this.root.remove(b.mesh);
      b.mesh = prep(this.ballProto[e.color].clone());
      b.color = e.color;
      this.root.add(b.mesh);
    }
    b.live = true;
    b.life = 1.7;
    b.p = from;
    b.v = _v.clone();
    b.mesh.position.copy(from);
    b.mesh.visible = true;
    g.audio.play('paint', 0.35);
  }

  fly(dt, me) {
    for (const b of this.balls) {
      if (!b.live) continue;
      b.life -= dt;
      b.v.y -= 3 * dt;
      b.p.addScaledVector(b.v, dt);
      b.mesh.position.copy(b.p);
      if (me && this.hitCar(me, b)) {
        b.live = false;
        b.mesh.visible = false;
        continue;
      }
      const f = PARK.floorAt(b.p.x, b.p.z, b.p.y + 0.4);
      if (b.p.y < f + 0.05) {
        this.floorSplat(b.p.x, f, b.p.z, b.color);
        b.live = false;
        b.mesh.visible = false;
        continue;
      }
      if (b.life <= 0) {
        b.live = false;
        b.mesh.visible = false;
      }
    }
  }

  // ------------------------------------------------------------------ hit
  hitCar(car, b) {
    const dx = b.p.x - car.pos.x;
    const dz = b.p.z - car.pos.z;
    const s = Math.sin(car.yaw);
    const c = Math.cos(car.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const ly = b.p.y - car.pos.y;
    const hw = (car.halfWid || 0.98) + 0.1;
    const hl = (car.halfLen || 2.3) + 0.1;
    if (Math.abs(lx) > hw || Math.abs(lz) > hl || ly < 0 || ly > (car.heightM || 1.45) + 0.15) return false;
    this.hit(car, b, lx, ly, lz, hw, hl);
    return true;
  }

  hit(car, b, lx, ly, lz, hw, hl) {
    const g = this.g;
    // (already theirs: nothing more till he is back)
    if (this.P.caughtNow || this.P.resetting) return;
    this.hits++;
    car.hp = Math.max(car.maxHp * CAUGHT * 0.5, car.hp - car.maxHp * DMG * (this.P.autopilot ? 0.35 : 1));
    if (g.hud && g.hud.hurtFlash) g.hud.hurtFlash();
    g.audio.play('splat', 0.8);
    if (g.camRig && g.camRig.addShake) g.camRig.addShake(0.12);
    // (on the car where it landed: on its side, its end or its roof, whichever it is nearest)
    const H = car.heightM || 1.45;
    const ax = Math.abs(lx) / hw;
    const az = Math.abs(lz) / hl;
    const ay = ly / H;
    const s = prep(this.splatProto[b.color].clone());
    s.scale.setScalar(0.55);
    if (ay > ax && ay > az) s.position.set(lx, H + 0.01, lz);
    else if (ax > az) {
      s.position.set(Math.sign(lx) * (hw - 0.05), Math.min(ly, H - 0.3), lz);
      s.rotation.z = Math.sign(lx) * -Math.PI / 2;
    } else {
      s.position.set(lx, Math.min(ly, H - 0.3), Math.sign(lz) * (hl - 0.05));
      s.rotation.x = Math.sign(lz) * Math.PI / 2;
    }
    car.group.add(s);
    this.carSplats.push({ s, car });
    if (this.carSplats.length > CAR_SPLATS) {
      const o = this.carSplats.shift();
      o.car.group.remove(o.s);
    }
    // (now and then on the screen: the glass of the camera hit)
    if (Math.random() < 0.3) this.screenSplat(b.color);
    const C = this.P.comic;
    if (C && C.word && (!this.wordT || performance.now() - this.wordT > 2500)) {
      this.wordT = performance.now();
      C.word('SPLAT!', new THREE.Vector3(b.p.x, b.p.y + 0.4, b.p.z), { fill: PAINT_CSS[b.color], burst: '#ffffff', size: 0.07, life: 0.7 });
    }
    if (car.hp <= car.maxHp * CAUGHT && this.P.caught) this.P.caught();
  }

  floorSplat(x, y, z, color) {
    const s = prep(this.splatProto[color].clone());
    s.position.set(x, y + 0.025, z);
    s.rotation.y = Math.random() * Math.PI * 2;
    s.scale.setScalar(0.7 + Math.random() * 0.6);
    this.root.add(s);
    this.floorSplats.push(s);
    if (this.floorSplats.length > FLOOR_SPLATS) this.root.remove(this.floorSplats.shift());
  }

  // a splat on the screen: a blob of the colour, its drops, running a little, gone in a second
  screenSplat(color) {
    const d = document.createElement('div');
    d.className = 'pf-splat';
    const x = 12 + Math.random() * 76;
    const y = 12 + Math.random() * 60;
    const r = 70 + Math.random() * 90;
    d.style.cssText = `left:${x}%;top:${y}%;width:${r}px;height:${r}px;--c:${PAINT_CSS[color]};transform:translate(-50%,-50%) rotate(${Math.floor(Math.random() * 360)}deg)`;
    d.innerHTML = `<svg viewBox="-50 -50 100 100"><path d="${blob()}"/></svg>`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  css() {
    if (document.getElementById('pf-css')) return;
    const st = document.createElement('style');
    st.id = 'pf-css';
    st.textContent = `.pf-splat{position:fixed;z-index:40;pointer-events:none;animation:pfSplat 1.25s ease-in forwards}
.pf-splat svg{width:100%;height:100%;overflow:visible}.pf-splat path{fill:var(--c);stroke:#1b1430;stroke-width:3;opacity:.92}
@keyframes pfSplat{0%{opacity:0;scale:.4}8%{opacity:1;scale:1.08}16%{scale:1}70%{opacity:.9;translate:0 6px}100%{opacity:0;translate:0 18px}}`;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------ after a reset
  // (caught, or the car wrecked: everything of theirs on this floor sent back to where it waited -
  // or, coming after him, a little way back along his way)
  reset() {
    this.grace = 3;
    for (const b of this.balls) {
      b.live = false;
      if (b.mesh) b.mesh.visible = false;
    }
    for (const e of this.enemies) {
      e.burst = 0;
      e.aimT = 0;
      e.fireT = 1.6 + Math.random();
      this.glint(e, false);
    }
    for (const o of this.carSplats) o.car.group.remove(o.s);
    this.carSplats = [];
  }

  // (the fight over - the roof: theirs stopped where they are, the first car of them apart)
  halt() {
    this.on = false;
    for (const e of this.enemies) {
      if (!e.own) continue;
      e.mode = 'wait';
      e.wake = 0;
      e.wakeAt = null;
      e.Q.paused = true;
      this.glint(e, false);
    }
  }

  dispose() {
    for (const e of this.enemies.slice()) this.remove(e);
    for (const o of this.carSplats) o.car.group.remove(o.s);
    this.carSplats = [];
    this.g.scene.remove(this.root);
    this.balls = [];
    this.floorSplats = [];
  }
}

// a blob's outline: a circle pushed out and in, with drops
function blob() {
  let d = '';
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 30 + Math.random() * 14 + (i % 3 === 0 ? 8 : 0);
    d += `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }
  d += 'Z';
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 44 + Math.random() * 6;
    const s = 3 + Math.random() * 4;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    d += `M${(x - s).toFixed(1)} ${y.toFixed(1)}a${s} ${s} 0 1 0 ${(2 * s).toFixed(1)} 0a${s} ${s} 0 1 0 ${(-2 * s).toFixed(1)} 0`;
  }
  return d;
}

export { PAINT };
