import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/util.js';
import { WATER_X, PROM_X1, PIER, CURB } from '../world/layout.js';
import { srgb, makeSurface } from '../render/materials.js';
import { Batch } from '../world/kit.js';
import { isWater } from './rides.js';

// (ROADMAP 5.2; never with ?classic) Swimming in the bay, and under it.
//
// Into the water over the promenade's railing, off the pier, out of a boat or a plane: you swim
// (WASD, Shift faster), C dives, Space comes up. At the surface you swim the crawl, or tread water
// with your head out; under it you swim on, as long as your breath lasts (the bar under your
// life), over the bay's sandy floor, its rocks and weed, with the fish. E at the sea wall or the
// pier climbs out (over the railing, onto the deck); E by a boat gets you into it.

export const SURF = -0.8;
const FLOOR = -7.5;
const AIR = 25;
// as far out as you can swim (the current takes you back)
const FAR_X = WATER_X + 240;

const FISH = [[1.0, 0.55, 0.2], [1.0, 0.82, 0.25], [0.35, 0.6, 0.95], [0.95, 0.4, 0.55], [0.6, 0.85, 0.75]];
const _c = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3(0, 1, 0);
const _f = new THREE.Vector3();
const RIPPLE = [0.9, 0.97, 1];

function hash(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export class Swim {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.air = AIR;
    // where your head is (the body hangs under it, upright treading water or along the water)
    this.head = SURF;
    this.v = new THREE.Vector3();
    this.strokeT = 0;
    this.bubbleT = 0;
    this.hurtT = 0;
    this.scene = null;
    this.fish = [];
    this.wasUnder = false;
    this.ui = {
      overlay: document.getElementById('underwater'),
      breath: document.getElementById('breath'),
      fill: document.querySelector('#breath .fill'),
    };
  }

  // ---------------------------------------------------------------- in and out
  // a fall (or a step) into the water: you are swimming
  enter() {
    const g = this.game;
    const p = g.player;
    if (p.mode !== 'foot') return;
    const fall = -p.vel.y;
    p.mode = 'swim';
    this.on = true;
    // (in deeper the faster you came: then up again)
    this.head = SURF - Math.min(2.6, 0.3 + fall * 0.12);
    this.v.set(p.vel.x * 0.4, 0, p.vel.z * 0.4);
    p.vel.set(0, 0, 0);
    p.onGround = false;
    // the splash: bigger the higher you came from
    g.fx.splash(p.pos.x, SURF + 0.05, p.pos.z, 10 + Math.min(30, fall * 2), 2 + Math.min(6, fall * 0.3), [0.88, 0.95, 1]);
    g.audio.play('splat', Math.min(1, 0.3 + fall * 0.05));
    if (this.firstTime === undefined) {
      this.firstTime = false;
      g.hud.toast(g.touch && !g.pad.active ? 'שוחים! ▼ צולל, ▲ עולה. ליד הקיר או המזח — יוצאים' : 'שוחים! C — לצלול, רווח — לעלות. E ליד הקיר או המזח — לצאת', 'info', 3.4);
    }
    this.buttons(true);
  }

  // out of the water (onto the land, into a boat, or the end of it all)
  leave() {
    if (!this.on) return;
    this.on = false;
    const fig = this.game.player.fig;
    fig.crawl = 0;
    this.buttons(false);
    this.ui.breath.classList.add('hidden');
    this.air = AIR;
  }

  buttons(on) {
    if (!this.game.touch) return;
    document.getElementById('btn-up').classList.toggle('hidden', !on);
    document.getElementById('btn-down').classList.toggle('hidden', !on);
  }

  // where you climb out from here, if you can: { x, y, z, edge, fx, fz }
  shore() {
    const p = this.game.player.pos;
    if (this.depth() > 0.5) return null;
    // the sea wall, the promenade over it (over the railing)
    const pierSide = p.z > PIER.z0 - 1 && p.z < PIER.z1 + 1;
    if (!pierSide && p.x - WATER_X < 1.2) return { x: PROM_X1 - 1.0, y: CURB, z: p.z, edge: { x: PROM_X1 - 0.2, y: CURB + 1.2, z: p.z }, fx: -1, fz: 0 };
    // the pier's sides and its end
    if (p.x > PIER.x0 && p.x < PIER.x1 + 1.5) {
      if (Math.abs(p.z - PIER.z0) < 1.5 && p.x < PIER.x1 - 0.5) return { x: p.x, y: 0.35, z: PIER.z0 + 1.0, edge: { x: p.x, y: 0.35, z: PIER.z0 }, fx: 0, fz: 1 };
      if (Math.abs(p.z - PIER.z1) < 1.5 && p.x < PIER.x1 - 0.5) return { x: p.x, y: 0.35, z: PIER.z1 - 1.0, edge: { x: p.x, y: 0.35, z: PIER.z1 }, fx: 0, fz: -1 };
      if (p.x > PIER.x1 - 0.2 && p.z > PIER.z0 && p.z < PIER.z1 && p.x < PIER.x1 + 1.5) return { x: PIER.x1 - 1.0, y: 0.35, z: p.z, edge: { x: PIER.x1, y: 0.35, z: p.z }, fx: -1, fz: 0 };
    }
    return null;
  }

  // a boat to climb into, near you
  boat() {
    const g = this.game;
    const v = g.vehicles.nearest(g.player.pos, 2.4);
    return v && v.kind === 'boat' && !v.dead ? v : null;
  }

  interact() {
    const g = this.game;
    const b = this.boat();
    if (b) {
      this.leave();
      g.player.mode = 'foot';
      g.enterVehicle(b);
      return true;
    }
    const s = this.shore();
    if (!s) return false;
    // up the wall (or the pier's side) and over: the climbing's own pull-up (game/climb.js)
    const p = g.player;
    const c = g.climb;
    this.leave();
    c.mantle = {
      t: 0,
      dur: 1.1,
      from: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
      a: { x: s.edge.x - s.fx * 0.45, y: s.edge.y - 1.0, z: s.edge.z - s.fz * 0.45 },
      edge: s.edge,
      to: { x: s.x, y: s.y, z: s.z },
      vault: false,
      fx: s.fx,
      fz: s.fz,
    };
    p.mode = 'climb';
    p.yaw = Math.atan2(s.fx, s.fz);
    g.audio.play('splat', 0.4);
    return true;
  }

  get prompt() {
    if (!this.on) return null;
    const g = this.game;
    const touch = g.touch && !g.pad.active;
    const b = this.boat();
    if (b) return touch ? `לעלות על ${b.label}` : `E — לעלות על ${b.label}`;
    if (this.shore()) return touch ? 'לצאת מהמים' : 'E — לצאת מהמים';
    if (touch) return '';
    return this.depth() > 0.6 ? 'רווח — לעלות · C — עמוק יותר' : 'C — לצלול · Shift — מהר';
  }

  // how far under the surface your head is
  depth() {
    return SURF - this.head;
  }

  // the camera: behind you and a little over your head
  get camOpts() {
    const p = this.game.player;
    const o = this._cam || (this._cam = { height: 0, dist: 3.8, shoulder: 0, minY: 0, maxY: undefined });
    o.height = this.head + 0.6 - p.pos.y;
    // (down there, it stays down there with you; at the surface, over it)
    if (this.head + 0.6 < SURF - 0.2) {
      o.minY = FLOOR + 0.3;
      o.maxY = SURF - 0.2;
    } else {
      o.minY = SURF + 0.3;
      o.maxY = undefined;
    }
    return o;
  }

  // ---------------------------------------------------------------- each frame, in the water
  update(dt, input) {
    const g = this.game;
    const p = g.player;
    const fig = p.fig;
    if (!this.on) {
      p.mode = 'foot';
      return;
    }
    const talking = g.dialog && g.dialog.open;
    const mv = talking ? { x: 0, y: 0, sprint: false } : input.readMove();
    const cy = g.camRig.yaw;
    const fx = Math.sin(cy);
    const fz = Math.cos(cy);
    let wx = fx * mv.y - fz * mv.x;
    let wz = fz * mv.y + fx * mv.x;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }
    const under = this.depth() > 0.25;
    const sp = (under ? 2.6 : 2.1) * (mv.sprint ? 1.5 : 1) * Math.min(1, wl);
    this.v.x = damp(this.v.x, wx * sp, 2.2, dt);
    this.v.z = damp(this.v.z, wz * sp, 2.2, dt);
    // down with C (or the button), up with Space; you float back up when you let go
    const down = !talking && (input.keys.has('KeyC') || input.keys.has('ControlLeft') || input.flyDown);
    const up = !talking && (input.keys.has('Space') || input.flyUp);
    // (the head just out of the water, bobbing on the swell)
    const top = SURF + 0.12 + Math.sin(g.time * 1.8) * 0.04;
    let vy = 0;
    if (down) vy = -1.8;
    else if (up) vy = 2.6;
    else if (this.head < top) vy = 1.4;
    this.v.y = damp(this.v.y, vy, 3, dt);
    const nx = p.pos.x + this.v.x * dt;
    const nz = p.pos.z + this.v.z * dt;
    // (only where the water is: the wall, the pier and the far current hold you back)
    const ok = (x, z) => isWater(x, z) && isWater(x + 0.35, z) && isWater(x - 0.35, z) && isWater(x, z + 0.35) && isWater(x, z - 0.35) && x < FAR_X;
    if (ok(nx, nz)) {
      p.pos.x = nx;
      p.pos.z = nz;
    } else if (ok(nx, p.pos.z)) {
      p.pos.x = nx;
      this.v.z *= 0.5;
    } else if (ok(p.pos.x, nz)) {
      p.pos.z = nz;
      this.v.x *= 0.5;
    } else {
      this.v.x *= -0.2;
      this.v.z *= -0.2;
    }
    if (p.pos.x > FAR_X - 6 && !this.saidFar) {
      this.saidFar = true;
      g.hud.toast('הזרם חזק מדי כאן — חזרה לכיוון החוף', 'info', 2.4);
    }
    this.head = clamp(this.head + this.v.y * dt, FLOOR + 0.5, Math.max(top, this.head - 0.02));
    if (this.head > top) this.head = damp(this.head, top, 6, dt);
    if (this.head >= top - 0.02 && this.v.y > 0) this.v.y = 0;
    // the body: the crawl along the surface (or under it) when you go, treading water when not
    const moving = Math.hypot(this.v.x, this.v.z) > 0.4;
    const deep = this.depth() > 0.6;
    fig.crawl = damp(fig.crawl || 0, moving || deep ? 1 : 0, 4, dt);
    if (moving) p.yaw = dampAngle(p.yaw, Math.atan2(this.v.x, this.v.z), 6, dt);
    // (upright, the head is 1.6 over the feet; along the water, the crawl's head is low)
    p.pos.y = this.head - (1.6 - 1.15 * fig.crawl);
    fig.yaw = p.yaw;
    fig.speed = moving ? Math.hypot(this.v.x, this.v.z) * 1.6 : 0.6;
    fig.air = false;
    fig.sit = 0;
    fig.reachR = null;
    fig.reachL = null;
    fig.update(dt);
    // the strokes splash at the surface; ripples round you
    this.strokeT -= dt;
    if (!deep && moving && this.strokeT <= 0) {
      this.strokeT = 0.42;
      g.fx.splash(p.pos.x + Math.sin(p.yaw) * 0.6, SURF + 0.02, p.pos.z + Math.cos(p.yaw) * 0.6, 3, 1.4, [0.88, 0.95, 1]);
      g.audio.play('splat', 0.12);
    }
    // breath: it runs out under the water, back in a moment at the surface
    const headUnder = this.depth() > 0.05;
    this.air = headUnder ? Math.max(0, this.air - dt) : Math.min(AIR, this.air + dt * 9);
    if (this.air <= 0) {
      this.hurtT -= dt;
      if (this.hurtT <= 0) {
        this.hurtT = 1;
        p.hurt(9, p.pos.x, p.pos.z, null, 'drown');
      }
    }
    if (headUnder) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 0.35 + Math.random() * 0.4;
        g.fx.sprite('smoke0', p.pos.x + Math.sin(p.yaw) * 0.4, this.head, p.pos.z + Math.cos(p.yaw) * 0.4, { size: 0.14, grow: 0.3, life: 1.6, vy: 1.4, alpha: 0.75, tint: [0.85, 0.95, 1] });
      }
    }
    const show = this.air < AIR - 0.05;
    this.ui.breath.classList.toggle('hidden', !show);
    if (show) {
      this.ui.fill.style.width = `${(this.air / AIR) * 100}%`;
      this.ui.breath.classList.toggle('low', this.air < 6);
    }
  }

  // ---------------------------------------------------------------- the world under the surface
  // (built the first time you go under: nobody else ever sees it)
  build() {
    const g = this.game;
    const M = g.world.ctx.M;
    const group = new THREE.Group();
    group.name = 'underwater';
    // the surface seen from under it: bright, the sky's light through it
    const sm = makeSurface({ kind: 'neon', color: srgb(0.55, 0.85, 0.9), emissive: new THREE.Color(0.55, 0.95, 1.05), line: 0.25, noShadow: true });
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1600).rotateX(Math.PI / 2), sm);
    surf.position.set(WATER_X + 600, SURF - 0.02, -50);
    surf.userData.noShadow = true;
    group.add(surf);
    // the floor: sand, dark rocks along the wall, weed swaying up from it
    const B = new Batch();
    const sand = new THREE.PlaneGeometry(600, 900).rotateX(-Math.PI / 2);
    sand.translate(WATER_X + 300, FLOOR, -50);
    B.add(M.sand, sand, null, 0.31);
    for (let z = -440; z < 400; z += 3.1) {
      for (let x = WATER_X + 1.5; x < WATER_X + 60; x += 3.4) {
        const h = hash(x, z);
        if (h < 0.08) {
          const r = 0.4 + hash(z, x) * 0.9;
          const rock = new THREE.SphereGeometry(r, 7, 5);
          rock.scale(1, 0.6, 1.2);
          rock.translate(x + (h - 0.04) * 20, FLOOR + r * 0.3, z);
          B.add(M.steel, rock, null, 0.4 + h, { color: srgb(0.32, 0.34, 0.4) });
        } else if (h < 0.3) {
          const hh = 1.4 + hash(x * 2, z) * 2.8;
          const weed = new THREE.ConeGeometry(0.2, hh, 5);
          weed.translate(x + (h - 0.2) * 10, FLOOR + hh / 2, z + (h - 0.2) * 6);
          B.add(M.leaf, weed, null, 0.5 + h, { color: srgb(0.35, 0.72, 0.4) });
        }
      }
    }
    B.flush(group, { dynamic: true });
    group.visible = false;
    g.scene.add(group);
    this.scene = group;
    // a few schools of fish
    for (let s = 0; s < 4; s++) {
      const col = FISH[s % FISH.length];
      const n = 5 + s * 2;
      const school = { x: 0, y: -4, z: 0, a: Math.random() * 6.28, r: 4 + Math.random() * 5, w: 0.25 + Math.random() * 0.25, fish: [] };
      for (let i = 0; i < n; i++) school.fish.push({ ox: (Math.random() - 0.5) * 2.4, oy: (Math.random() - 0.5) * 1.2, oz: (Math.random() - 0.5) * 2.4, col, size: 0.13 + Math.random() * 0.09, ph: Math.random() * 6 });
      this.fish.push(school);
    }
  }

  // the camera under the water? the world down there, and the bay's light over everything
  frame(dt) {
    const g = this.game;
    const cam = g.camera.position;
    const p = g.player;
    // (a swim that ended some other way: out of it)
    if (this.on && p.mode !== 'swim') this.leave();
    const under = cam.y < SURF - 0.05 && isWater(cam.x, cam.z);
    if (under && !this.scene) this.build();
    if (this.scene) this.scene.visible = under;
    if (under !== this.wasUnder) {
      this.wasUnder = under;
      this.ui.overlay.classList.toggle('hidden', !under);
      g.audio.muffle(under);
    }
    // the fish go round where you are
    if (under) {
      for (const s of this.fish) {
        s.a += s.w * dt;
        if (!s.home || Math.hypot(s.home.x - cam.x, s.home.z - cam.z) > 30) {
          const a = Math.random() * Math.PI * 2;
          const d = 9 + Math.random() * 9;
          s.home = { x: cam.x + Math.cos(a) * d, z: cam.z + Math.sin(a) * d };
        }
        s.x = s.home.x + Math.cos(s.a) * s.r;
        s.z = s.home.z + Math.sin(s.a) * s.r;
        // (they keep a few metres off you)
        const dx = s.x - cam.x;
        const dz = s.z - cam.z;
        const d = Math.hypot(dx, dz);
        if (d < 4) {
          s.x = cam.x + (dx / (d || 1)) * 4;
          s.z = cam.z + (dz / (d || 1)) * 4;
        }
        s.y = clamp(cam.y + Math.sin(s.a * 0.7) * 1.5, FLOOR + 0.8, SURF - 0.6);
      }
    }
  }

  // drawn with the pen like the pigeons (game/ambient.js): only when you are down there
  draw() {
    if (!this.wasUnder) return;
    const bodies = this.game.figures.bodies;
    const t = this.game.time;
    for (const s of this.fish) {
      const yaw = s.a + (s.w > 0 ? Math.PI / 2 : -Math.PI / 2);
      _f.set(Math.sin(yaw), 0, Math.cos(yaw));
      _r.set(_f.z, 0, -_f.x);
      for (const f of s.fish) {
        const wig = Math.sin(t * 9 + f.ph) * 0.06;
        _c.set(s.x + f.ox, s.y + f.oy, s.z + f.oz);
        bodies.blob(_c, _r, _u, _f, f.size * 0.45, f.size * 0.6, f.size, f.col);
        _c.set(s.x + f.ox - _f.x * f.size * 1.1 + _r.x * wig, s.y + f.oy, s.z + f.oz - _f.z * f.size * 1.1 + _r.z * wig);
        bodies.blob(_c, _r, _u, _f, f.size * 0.12, f.size * 0.5, f.size * 0.35, f.col);
      }
    }
  }

  // rings on the surface round a swimmer's head (drawn with the city's pen)
  ripples(fr) {
    if (!this.on || this.depth() > 0.3) return;
    const p = this.game.player.pos;
    const t = this.game.time;
    for (let k = 0; k < 2; k++) {
      const age = (t * 0.8 + k * 0.5) % 1;
      const r = 0.45 + age * 1.6;
      const a = (1 - age) * 0.7;
      let px = p.x + r;
      let pz = p.z;
      for (let i = 1; i <= 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const x = p.x + Math.cos(ang) * r;
        const z = p.z + Math.sin(ang) * r;
        fr.lineXYZ(px, SURF + 0.03, pz, x, SURF + 0.03, z, RIPPLE, 1.6, 6100 + k * 13 + i, a, 0.02, 0);
        px = x;
        pz = z;
      }
    }
  }
}
