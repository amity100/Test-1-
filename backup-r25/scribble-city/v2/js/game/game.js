import * as THREE from 'three';
import { shared } from '../render/materials.js';
import { Person, LOOKS } from './people.js';
import { Input } from './input.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

// The little game around the drawing: walk the boulevard at sunset and look around.
export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.time = 0;
    this.state = 'title';
    this.clock = new THREE.Clock();
    // the outlines redrawn a few times a second: lively on a big screen, calm on a phone
    this.boilOn = !this.touch;
    this.input = new Input(this.renderer.domElement, this.touch);
    this.input.onEscape = () => this.toggleMenu();
    this.input.onUnlock = () => {
      if (this.state === 'play') this.toggleMenu(true);
    };
    // the hero: white tee, cargo pants, a cap; walking up the boulevard into the sunset
    const W = this.world;
    this.hero = new Person(this.scene, LOOKS.hero);
    this.hero.root.position.copy(W.spawn || new THREE.Vector3(-6, 0.15, 2));
    this.hero.heading = Math.PI;
    this.hero.root.rotation.y = Math.PI;
    this.vel = new THREE.Vector2();
    // the camera follows a little behind and to the right of the shoulder
    this.yaw = Math.PI; // looking north (-z)
    this.pitch = -0.04;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.first = true;
    // people out for an evening walk
    this.walkers = [];
    const paths = W.paths || [];
    if (paths.length) {
      LOOKS.crowd.forEach((look, i) => {
        const p = new Person(this.scene, look);
        const path = paths[i % paths.length];
        const lane = path.x0 + ((i * 0.37) % 1) * (path.x1 - path.x0);
        const z = path.z1 - ((i * 0.618) % 1) * (path.z1 - path.z0);
        const dir = i % 2 ? 1 : -1;
        p.root.position.set(lane, 0.15, z);
        const w = { p, path, lane, dir, speed: (look.height < 1.4 ? 1.25 : 1.05) + ((i * 0.31) % 1) * 0.4, pause: 0, side: 0 };
        this.walkers.push(w);
      });
    }
    this.bindUI();
  }

  bindUI() {
    $('resume').addEventListener('click', () => this.toggleMenu(false));
    $('menu-btn').addEventListener('click', () => this.toggleMenu(true));
    $('opt-boil').checked = this.boilOn;
    $('opt-boil').addEventListener('change', (e) => (this.boilOn = e.target.checked));
    $('opt-hq').checked = shared.uQuality.value > 0.5;
    $('opt-hq').addEventListener('change', (e) => (shared.uQuality.value = e.target.checked ? 1 : 0));
    $('opt-hud').addEventListener('change', (e) => $('hud').classList.toggle('hidden', !e.target.checked));
  }

  start() {
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.state = 'play';
    this.input.enabled = true;
    if (!this.touch) this.input.lock();
    else {
      try {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      } catch (e) {
        // optional
      }
    }
  }

  toggleMenu(open) {
    const m = $('menu');
    const show = open !== undefined ? open : m.classList.contains('hidden');
    if (this.state === 'title') return;
    m.classList.toggle('hidden', !show);
    this.state = show ? 'menu' : 'play';
    this.input.enabled = !show;
    if (!show && !this.touch) this.input.lock();
  }

  loop() {
    if (this.params.has('test')) {
      window.__frame = (n = 1, dt = 1 / 30) => {
        for (let i = 0; i < n; i++) this.update(dt);
        this.render();
        return true;
      };
      window.__frame(1);
      return;
    }
    // the drawing keeps its pace: its own resolution follows how long the frames take (with
    // some patience both ways, so it does not keep changing its mind)
    const pipe = this.pipe;
    let acc = 0;
    let n = 0;
    let slow = 0;
    let fast = 0;
    const tick = () => {
      const raw = this.clock.getDelta();
      const dt = Math.min(raw, 0.05);
      this.update(dt);
      this.render();
      if (this.state === 'play') {
        acc += raw;
        n++;
      }
      if (acc > 1.0) {
        const ms = (acc / n) * 1000;
        slow = ms > 26 ? slow + 1 : 0;
        fast = ms < 14 ? fast + 1 : 0;
        if (slow >= 2 && pipe.scale > pipe.minScale) {
          pipe.scale = Math.max(pipe.minScale, pipe.scale - 0.1);
          slow = 0;
        } else if (fast >= 3 && pipe.scale < pipe.maxScale) {
          pipe.scale = Math.min(pipe.maxScale, pipe.scale + 0.05);
          fast = 0;
        }
        acc = 0;
        n = 0;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // keep a point out of the shops, the palms, the parked cars and the water
  collide(pos, r = 0.32) {
    const W = this.world;
    const b = W.bounds;
    if (b) {
      pos.x = Math.min(b.x1, Math.max(b.x0, pos.x));
      pos.z = Math.min(b.z1, Math.max(b.z0, pos.z));
    }
    for (const c of W.colliders || []) {
      if (c.type === 'circle') {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const d = Math.hypot(dx, dz);
        const m = c.r + r;
        if (d < m && d > 1e-4) {
          pos.x = c.x + (dx / d) * m;
          pos.z = c.z + (dz / d) * m;
        }
      } else if (c.type === 'box') {
        if (pos.x > c.x0 - r && pos.x < c.x1 + r && pos.z > c.z0 - r && pos.z < c.z1 + r) {
          const ox = Math.min(pos.x - (c.x0 - r), c.x1 + r - pos.x);
          const oz = Math.min(pos.z - (c.z0 - r), c.z1 + r - pos.z);
          if (ox < oz) pos.x = pos.x - (c.x0 - r) < c.x1 + r - pos.x ? c.x0 - r : c.x1 + r;
          else pos.z = pos.z - (c.z0 - r) < c.z1 + r - pos.z ? c.z0 - r : c.z1 + r;
        }
      }
    }
  }

  groundY(x) {
    return x < -3 || x > 13 ? 0.15 : 0;
  }

  update(dt) {
    const playing = this.state === 'play';
    if (this.state !== 'menu') {
      this.time += dt;
      shared.uTime.value = this.time;
      if (this.boilOn) shared.uBoil.value = Math.floor(this.time * 5);
      if (this.world.update) this.world.update(dt, this.time);
    } else dt = 0;
    // look
    const look = this.input.consumeLook();
    if (playing) {
      this.yaw -= look.x * 0.0026;
      this.pitch = Math.max(-0.75, Math.min(0.5, this.pitch - look.y * 0.0022));
    }
    // walk
    const hero = this.hero;
    const mv = playing ? this.input.move() : { x: 0, y: 0, run: false };
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const want = new THREE.Vector2(fx * mv.y - fz * mv.x, fz * mv.y + fx * mv.x);
    const speed = (mv.run ? 5.2 : 2.0) * Math.min(1, Math.hypot(mv.x, mv.y));
    if (want.lengthSq() > 1e-4) want.normalize().multiplyScalar(speed);
    this.vel.lerp(want, 1 - Math.exp(-dt * 9));
    const pos = hero.root.position;
    pos.x += this.vel.x * dt;
    pos.z += this.vel.y * dt;
    this.collide(pos);
    pos.y += (this.groundY(pos.x) - pos.y) * Math.min(1, dt * 14);
    const sp = this.vel.length();
    if (sp > 0.15) {
      const target = Math.atan2(this.vel.x, this.vel.y);
      let d = target - hero.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      hero.heading += d * Math.min(1, dt * 10);
      hero.root.rotation.y = hero.heading;
    }
    hero.animate(dt, sp);
    // the walkers
    for (const w of this.walkers) {
      const p = w.p.root.position;
      if (dt > 0) {
        // step aside for the hero
        const dx = p.x - pos.x;
        const dz = p.z - pos.z;
        const near = Math.hypot(dx, dz);
        w.side += ((near < 2.2 ? Math.sign(dx || 1) * (2.2 - near) : 0) - w.side) * Math.min(1, dt * 3);
        p.z += w.dir * w.speed * dt;
        const x = Math.min(w.path.x1, Math.max(w.path.x0, w.lane + w.side));
        p.x += (x - p.x) * Math.min(1, dt * 4);
        if (p.z < w.path.z0) w.dir = 1;
        if (p.z > w.path.z1) w.dir = -1;
        w.p.heading = w.dir > 0 ? 0 : Math.PI;
        w.p.root.rotation.y += (w.p.heading - w.p.root.rotation.y) * Math.min(1, dt * 4);
        p.y = this.groundY(p.x);
      }
      w.p.animate(dt, w.speed);
    }
    // the camera: behind the shoulder, kept out of the walls
    const cam = this.camera;
    const dist = 3.3;
    const cy = Math.cos(this.pitch);
    const fwd = _v.set(Math.sin(this.yaw) * cy, Math.sin(this.pitch), Math.cos(this.yaw) * cy);
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const head = new THREE.Vector3(pos.x, pos.y + 1.62, pos.z).addScaledVector(right, 0.45);
    const want2 = head.clone().addScaledVector(fwd, -dist);
    want2.y = Math.max(want2.y, pos.y + 0.5);
    if (want2.x < -8.7) want2.x = -8.7;
    if (this.first) {
      this.camPos.copy(want2);
      this.first = false;
    } else this.camPos.lerp(want2, 1 - Math.exp(-dt * 10));
    cam.position.copy(this.camPos);
    this.camLook.copy(head).addScaledVector(fwd, 10);
    cam.lookAt(this.camLook);
    const o = window.__cam;
    if (o) {
      cam.position.set(o.pos[0], o.pos[1], o.pos[2]);
      cam.lookAt(o.look[0], o.look[1], o.look[2]);
    }
    cam.updateMatrixWorld();
  }

  render() {
    // the sun's box follows a point ahead of the camera
    const c = this.camera.position;
    const f = this.camera.getWorldDirection(_v);
    this.pipe.render(new THREE.Vector3(c.x + f.x * 35, 0, c.z + f.z * 35));
  }
}
