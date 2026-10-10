import * as THREE from 'three';
import { civilianLook } from './looks.js';
import { sidewalkLoop } from './civilians.js';
import { groundHeight, BLOCK_TYPES, NORTH_EDGE, SOUTH_EDGE, PIER } from '../world/layout.js';

// The crowd further down the street (ROADMAP 3.6). Past about 45 m the walkers on the sidewalks
// are cheap ones: a position along the walk round their block, a step, a look, drawn by
// PersonRenderer.drawCheap (the body, the head, the swinging limbs: no face, no rig, no
// collisions) in the same batches as everybody else. One coming nearer than 42 m becomes a whole
// person (the same look, the same step, going the same way); a whole one walking off past 50 m
// (out of view, or far enough not to tell) becomes a cheap one again. So the street is full as
// far as you can see, and only the people near you cost what a person costs.
// (?classic: no far crowd)

const IN = 42;
const OUT = 50;
const FAR = 160;
const PROM_LINES = [15.2, 17.6, 19.4];
const _fwd = new THREE.Vector3();

export class FarCrowd {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.t = 0;
    // (counted for the tests)
    this.stats = { handedIn: 0, takenOut: 0, born: 0 };
  }

  get most() {
    const R = this.game.rhythm;
    return Math.round((this.game.touch ? 36 : 90) * (R ? R.people : 1));
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    // (?nofar: without it, to measure what it costs)
    if (game.classic || game.inBar || game.params.has('nofar')) {
      if (this.list.length) this.list = [];
      return;
    }
    for (const w of this.list) this.walk(w, dt);
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.4;
    const cam = game.camera.position;
    const fwd = game.camera.getWorldDirection(_fwd);
    const civs = game.civilians;
    // near enough to be a whole person (when the street has room for one): else turn back
    for (const w of this.list) {
      const dx = w.x - cam.x;
      const dz = w.z - cam.z;
      const d = Math.hypot(dx, dz);
      if (d > FAR + 20) w.gone = true;
      else if (d < IN) {
        if (civs.fromFar(w)) {
          w.gone = true;
          this.stats.handedIn++;
        } else if (!w.turned) {
          w.dir = -w.dir;
          w.turned = true;
        }
      } else if (d > IN + 6) w.turned = false;
    }
    // whole people walking off: cheap ones from now on
    for (const c of civs.list) {
      if (!civs.plain(c)) continue;
      const dx = c.pos.x - cam.x;
      const dz = c.pos.z - cam.z;
      const d = Math.hypot(dx, dz);
      if (d < OUT) continue;
      const ahead = (dx * fwd.x + dz * fwd.z) / (d || 1);
      if (ahead > 0.3 && d < OUT + 10) continue;
      const w = this.fromWhole(c);
      if (w) {
        this.list.push(w);
        civs.remove(c);
        this.stats.takenOut++;
      }
    }
    if (this.list.some((w) => w.gone)) this.list = this.list.filter((w) => !w.gone);
    // and enough of them out there
    let tries = this.list.length < 10 ? 40 : 6;
    while (this.list.length < this.most && tries-- > 0) {
      const w = this.born(cam);
      if (w) {
        this.list.push(w);
        this.stats.born++;
      }
    }
  }

  // along the walk round the block (round and round; the promenade's, up and back)
  walk(w, dt) {
    const L = w.loop;
    const n = L.length;
    let left = w.speed * dt;
    for (let guard = 0; guard < 4 && left > 0; guard++) {
      const a = L[w.leg];
      const b = L[(w.leg + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if (w.dir > 0) {
        const room = len - w.u;
        if (left < room) {
          w.u += left;
          left = 0;
        } else {
          left -= room;
          if (n === 2) {
            w.u = len;
            w.dir = -1;
          } else {
            w.leg = (w.leg + 1) % n;
            w.u = 0;
          }
        }
      } else {
        if (left < w.u) {
          w.u -= left;
          left = 0;
        } else {
          left -= w.u;
          if (n === 2) {
            w.u = 0;
            w.dir = 1;
          } else {
            w.leg = (w.leg + n - 1) % n;
            const a2 = L[w.leg];
            const b2 = L[(w.leg + 1) % n];
            w.u = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
          }
        }
      }
    }
    const a = L[w.leg];
    const b = L[(w.leg + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    w.x = a[0] + ux * w.u - uz * w.side;
    w.z = a[1] + uz * w.u + ux * w.side;
    w.yaw = Math.atan2(ux * w.dir, uz * w.dir);
    w.phase += (w.speed * dt * Math.PI * 2) / 1.5;
    w.y = groundHeight(w.x, w.z);
  }

  // somebody new out there (on a walk that passes through the ring between IN+8 and FAR)
  born(cam) {
    const prom = cam.x > -40 && Math.random() < 0.25;
    let loop;
    let col = 0;
    let row = 0;
    if (prom) {
      const x = PROM_LINES[Math.floor(Math.random() * PROM_LINES.length)];
      const z0 = Math.max(NORTH_EDGE + 4, cam.z - FAR);
      const z1 = Math.min(SOUTH_EDGE + 20, cam.z + FAR);
      if (z1 - z0 < 20) return null;
      loop = [[x, z0], [x, z1]];
      col = 'prom';
    } else {
      col = -1 + Math.floor(Math.random() * 4);
      row = Math.floor(Math.random() * 5);
      loop = sidewalkLoop(col, row);
    }
    const n = loop.length;
    const leg = Math.floor(Math.random() * (n === 2 ? 1 : n));
    const a = loop[leg];
    const b = loop[(leg + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = Math.random() * len;
    const x = a[0] + ((b[0] - a[0]) * u) / len;
    const z = a[1] + ((b[1] - a[1]) * u) / len;
    const d = Math.hypot(x - cam.x, z - cam.z);
    if (d < IN + 8 || d > FAR) return null;
    // (not on the pier's walk)
    if (prom && z > PIER.z0 - 4 && z < PIER.z1 + 4) return null;
    const R = this.game.rhythm;
    let look = null;
    if (!this.game.classic && this.game.crowds) look = this.game.crowds.lookFor(prom ? 'prom' : col < 0 ? 'west' : BLOCK_TYPES[row][col]);
    if (!look) look = civilianLook();
    const w = { loop, col, row, prom, leg, u, dir: Math.random() < 0.5 ? 1 : -1, side: (Math.random() - 0.5) * 1.6, speed: (1.2 + Math.random() * 0.5) * (R && R.commute > 0 ? 1 + 0.3 * R.commute : 1), look, seed: Math.random() * 100, phase: Math.random() * 6, scale: look.build.height, x, z, y: 0, yaw: 0 };
    this.walk(w, 0);
    return w;
  }

  // a whole person walking off, as a cheap one: on the same walk, the same way
  fromWhole(c) {
    const L = c.loop;
    if (!L) return null;
    const n = L.length;
    let leg = 0;
    let bd = Infinity;
    let bu = 0;
    let bs = 0;
    for (let i = 0; i < (n === 2 ? 1 : n); i++) {
      const a = L[i];
      const b = L[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / len;
      const uz = (b[1] - a[1]) / len;
      const rx = c.pos.x - a[0];
      const rz = c.pos.z - a[1];
      const u = Math.max(0, Math.min(len, rx * ux + rz * uz));
      const s = -rx * uz + rz * ux;
      const d = Math.hypot(rx - ux * u, rz - uz * u);
      if (d < bd) {
        bd = d;
        leg = i;
        bu = u;
        bs = s;
      }
    }
    if (bd > 3) return null;
    // which way along that side: towards the corner they were heading for
    let dir = c.dir > 0 ? 1 : -1;
    if (n === 2) dir = c.target === 1 ? 1 : -1;
    const w = { loop: L, col: c.prom ? 'prom' : c.col, row: c.row, prom: c.prom, leg, u: bu, dir, side: Math.max(-0.9, Math.min(0.9, bs)), speed: c.speed, look: c.fig.look, seed: c.fig.seed, phase: c.fig.phase, scale: c.fig.scale, x: c.pos.x, z: c.pos.z, y: c.pos.y, yaw: c.yaw };
    this.walk(w, 0);
    return w;
  }

  // ------------------------------------------------------------------ drawing
  draw(camPos) {
    if (this.game.classic) return;
    const bodies = this.game.figures.bodies;
    const fwd = this.game.camera.getWorldDirection(_fwd);
    for (const w of this.list) {
      const dx = w.x - camPos.x;
      const dz = w.z - camPos.z;
      const d = Math.hypot(dx, dz);
      if (d > FAR || (dx * fwd.x + dz * fwd.z) / (d || 1) < -0.35) continue;
      bodies.drawCheap(w);
    }
  }
}
