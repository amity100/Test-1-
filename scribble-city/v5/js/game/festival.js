import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { Band, makeSong } from '../core/music.js';
import { civilianLook } from './looks.js';
import { groundHeight } from '../world/layout.js';
import { letter } from '../world/letters.js';
import { flashLight } from '../render/materials.js';
import { DanceGame } from './minigames/dance.js';
import { worldAt } from '../ui/minigame.js';

// (v5, ROADMAP 12.4) INK FEST: the festival on the water. On its nights (game/calendar.js) a stage
// stands on a floating deck off the island's beach, south of the pier: its trusses and roof, a wall
// of LED tiles playing to the beat, moving heads on the truss throwing their beams into the night,
// stacks of speakers, the name over it all in light. On the sand a crowd dances, the more the
// nearer you are to the stage; food trucks; and the music, from the band in the computer
// (core/music.js), louder and clearer as you come. In the crowd you can dance (Ink Beat, the
// dance floor's own game); at midnight, fireworks over the sea.
//
// Built when its night comes and you are near, taken down when it is over and you are far (it is
// a set of its own, game/items.js Kit, its collision boxes with it).

const STAGE = { x0: 103, x1: 119, z0: 260, z1: 288, deck: 0.9 };
const CX = 92;
const CZ = 274;
const NEAR = 380;
const STYLES = ['disco', 'synth', 'disco', 'rock'];
const LED_C = [linC(1, 0.3, 0.62), linC(0.2, 0.85, 0.95), linC(1, 0.85, 0.25), linC(0.45, 1, 0.55), linC(0.6, 0.4, 1)];
const BEAM_C = [[1, 0.35, 0.75], [0.3, 0.9, 1], [1, 0.9, 0.35], [0.55, 1, 0.6], [0.75, 0.5, 1]];
// (a remainder that never goes negative: the beat is below zero before the first song starts)
const pm = (a, n) => ((Math.floor(a) % n) + n) % n;
const FIRE_C = [[1, 0.35, 0.6], [0.35, 0.85, 1], [1, 0.85, 0.3], [0.5, 1, 0.5], [1, 0.55, 0.25], [0.8, 0.5, 1]];

export class Festival {
  constructor(game) {
    this.game = game;
    this.set = null;
    this.crowd = [];
    this.rockets = [];
    this.cols = [];
    this.t = 0;
    this.beat = 0;
    this.spoke = new Set();
    this.cheer = 0;
    this.nightKey = -1;
  }

  get on() {
    const C = this.game.calendar;
    return !!C && C.active('inkfest');
  }

  // ------------------------------------------------------------------ the set
  build() {
    const g = this.game;
    const M = itemMats();
    const K = new Kit();
    const S = STAGE;
    const D = S.deck;
    const DARK = linC(0.09, 0.09, 0.12);
    const STEEL = linC(0.72, 0.74, 0.78);
    const BLACK = linC(0.04, 0.04, 0.05);
    // the floating deck: pontoons in the water, the deck, a line of light along its edge
    K.box(M.matte, S.x0, -1.6, S.z0, S.x1, D - 0.4, S.z1, linC(0.12, 0.16, 0.3));
    K.box(M.matte, S.x0 - 0.1, D - 0.4, S.z0 - 0.1, S.x1 + 0.1, D, S.z1 + 0.1, DARK);
    for (let z = S.z0; z < S.z1 - 0.1; z += 2) K.box(M.glow, S.x0 - 0.16, D - 0.32, z + 0.1, S.x0 - 0.1, D - 0.12, z + 1.9, LED_C[Math.floor((z - S.z0) / 2) % LED_C.length]);
    // the trusses: four towers, the beams over the stage, a roof
    const tower = (x, z) => {
      for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) K.box(M.metal, x + dx - 0.04, D, z + dz - 0.04, x + dx + 0.04, 11, z + dz + 0.04, STEEL);
      for (let y = D + 0.6; y < 11; y += 1) {
        K.box(M.metal, x - 0.25, y, z - 0.27, x + 0.25, y + 0.05, z - 0.23, STEEL);
        K.box(M.metal, x - 0.25, y, z + 0.23, x + 0.25, y + 0.05, z + 0.27, STEEL);
        K.box(M.metal, x - 0.27, y + 0.5, z - 0.25, x - 0.23, y + 0.55, z + 0.25, STEEL);
        K.box(M.metal, x + 0.23, y + 0.5, z - 0.25, x + 0.27, y + 0.55, z + 0.25, STEEL);
      }
    };
    for (const x of [S.x0 + 0.6, S.x1 - 0.6]) for (const z of [S.z0 + 0.6, S.z1 - 0.6]) tower(x, z);
    for (const x of [S.x0 + 0.6, S.x1 - 0.6]) {
      K.box(M.metal, x - 0.3, 10.4, S.z0 + 0.3, x + 0.3, 10.5, S.z1 - 0.3, STEEL);
      K.box(M.metal, x - 0.3, 11, S.z0 + 0.3, x + 0.3, 11.1, S.z1 - 0.3, STEEL);
      for (let z = S.z0 + 1; z < S.z1 - 1; z += 1.2) K.box(M.metal, x - 0.04, 10.5, z, x + 0.04, 11, z + 0.08, STEEL);
    }
    for (const z of [S.z0 + 0.6, S.z1 - 0.6]) K.box(M.metal, S.x0 + 0.3, 10.7, z - 0.3, S.x1 - 0.3, 10.8, z + 0.3, STEEL);
    K.box(M.matte, S.x0 + 0.2, 11.1, S.z0 + 0.2, S.x1 - 0.2, 11.45, S.z1 - 0.2, BLACK);
    // the back of the stage behind the LED wall, the wings either side of it
    K.box(M.matte, S.x1 - 1.5, D, S.z0 + 1, S.x1 - 1.1, 10.4, S.z1 - 1, BLACK);
    // the speakers: a stack either side at the front, a line array hanging from the front truss
    for (const z of [S.z0 + 0.4, S.z1 - 2.6]) {
      for (let k = 0; k < 4; k++) {
        const y = D + k * 1.25;
        K.box(M.matte, S.x0 + 0.3, y, z, S.x0 + 2.1, y + 1.2, z + 2.2, BLACK);
        K.box(M.round, S.x0 + 0.24, y + 0.6, z + 0.6, S.x0 + 0.3, y + 0.6, z + 1.6, linC(0.15, 0.15, 0.18));
      }
      for (let k = 0; k < 6; k++) K.box(M.matte, S.x0 + 0.6, 9.6 - k * 0.55, z + 0.3, S.x0 + 1.6, 10.1 - k * 0.55, z + 1.9, BLACK);
    }
    // the DJ's table, its front lit
    K.box(M.matte, S.x0 + 5, D, CZ - 2, S.x0 + 6.2, D + 1.1, CZ + 2, DARK);
    K.box(M.glow, S.x0 + 4.93, D + 0.2, CZ - 1.8, S.x0 + 4.98, D + 0.9, CZ + 1.8, LED_C[1]);
    for (const dz of [-1.2, 1.2]) K.cyl(M.round, 0.32, 0.32, D + 1.1, D + 1.16, linC(0.2, 0.2, 0.22), { axis: 'y', x: S.x0 + 5.6, z: CZ + dz });
    // the moving heads on the front truss (their beams: drawn each frame, below)
    this.heads = [];
    for (let i = 0; i < 8; i++) {
      const z = S.z0 + 2.5 + (i * (S.z1 - S.z0 - 5)) / 7;
      K.box(M.matte, S.x0 + 0.35, 10.0, z - 0.2, S.x0 + 0.85, 10.4, z + 0.2, BLACK);
      K.sphere(M.glow, 0.16, S.x0 + 0.35, 10.1, z, LED_C[i % LED_C.length]);
      this.heads.push({ x: S.x0 + 0.3, y: 10.1, z, i });
    }
    // the name over the stage, in light (facing the beach)
    const sign = (txt, y, h, col) => {
      letter(txt, h, (a0, b0, a1, b1) => K.box(M.glow, S.x0 - 0.34, y + b0, CZ + a0, S.x0 - 0.24, y + b1, CZ + a1, col));
    };
    K.box(M.matte, S.x0 - 0.2, 11.5, CZ - 9, S.x0 + 0.1, 13.9, CZ + 9, BLACK);
    sign('INK FEST', 11.8, 1.8, LED_C[0]);
    // on the sand: the barrier before the stage, the food trucks, the flags along the back
    const sand = (x, z) => groundHeight(x, z);
    for (let z = S.z0; z < S.z1; z += 2) K.box(M.metal, 99.4, sand(99.5, z), z + 0.05, 99.6, sand(99.5, z) + 1.1, z + 1.95, STEEL);
    this.trucks = [];
    const truck = (x, z, body, name, kind) => {
      const y = sand(x, z);
      K.box(M.paint, x - 1.2, y + 0.5, z - 3, x + 1.2, y + 3, z + 3, body);
      K.box(M.matte, x - 1.2, y, z - 2.4, x + 1.2, y + 0.5, z + 2.4, BLACK);
      for (const dz of [-2, 2]) for (const sx of [-1, 1]) K.sphere(M.round, 0.45, x + sx * 1.18, y + 0.45, z + dz, BLACK, 0.35, 1, 1);
      // the serving window towards the crowd, its awning, its lit menu
      K.box(M.glow, x + 1.18, y + 1.6, z - 1.8, x + 1.24, y + 2.5, z + 1.8, linC(1, 0.92, 0.7));
      K.box(M.paint, x + 1.2, y + 2.6, z - 2.2, x + 2.4, y + 2.7, z + 2.2, LED_C[kind === 'bar' ? 1 : 0]);
      letter(name, 0.42, (a0, b0, a1, b1) => K.box(M.glow, x + 1.25, y + 2.95 + b0, z - a1, x + 1.3, y + 2.95 + b1, z - a0, LED_C[kind === 'bar' ? 4 : 2]));
      this.trucks.push({ x: x + 2.2, z, kind, name });
      return [x - 1.2, z - 3, x + 1.2, z + 3, y + 3.2];
    };
    const tb = [truck(64, 258, linC(0.95, 0.45, 0.2), 'TACO LOCO', 'food'), truck(64, 290, linC(0.25, 0.3, 0.75), 'NEON BAR', 'bar')];
    for (let z = 256; z <= 292; z += 9) {
      const x = 58;
      const y = sand(x, z);
      K.cyl(M.round, 0.05, 0.05, y, y + 6, STEEL, { axis: 'y', x, z });
      K.box(M.paint, x - 0.02, y + 4.2, z, x + 0.02, y + 5.8, z + 1.6, LED_C[pm(z / 9, LED_C.length)]);
    }
    const group = K.build({ seed: 0.61 });
    // (the wall of light: tiles of their own, coloured anew on the beat)
    this.led = this.ledWall(M.glow);
    group.add(this.led);
    group.updateMatrix();
    g.scene.add(group);
    this.set = group;
    // what is solid of it: the deck (too high to climb from the water), the speakers, the trucks,
    // the barrier
    const col = g.world.collision;
    this.cols = [col.addBox(S.x0, S.z0, S.x1, S.z1, -2, D, 'wall')];
    this.cols.push(col.addBox(99.3, S.z0, 99.7, S.z1, -1, 1.2, 'wall'));
    for (const [x0, z0, x1, z1, y1] of tb) this.cols.push(col.addBox(x0, z0, x1, z1, -1, y1, 'wall'));
    this.makeCrowd();
  }

  ledWall(mat) {
    const S = STAGE;
    const x = S.x1 - 1.55;
    const NZ = 12;
    const NY = 5;
    const z0 = S.z0 + 2;
    const z1 = S.z1 - 2;
    const y0 = S.deck + 1.6;
    const y1 = 9.6;
    const n = NZ * NY * 6;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const ids = new Float32Array(n);
    let k = 0;
    const dz = (z1 - z0) / NZ;
    const dy = (y1 - y0) / NY;
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NZ; i++) {
        const za = z0 + i * dz + 0.06;
        const zb = za + dz - 0.12;
        const ya = y0 + j * dy + 0.06;
        const yb = ya + dy - 0.12;
        // (wound to face the beach)
        const q = [[x, ya, za], [x, ya, zb], [x, yb, zb], [x, ya, za], [x, yb, zb], [x, yb, za]];
        for (const p of q) {
          pos.set(p, k * 3);
          nor.set([-1, 0, 0], k * 3);
          ids[k] = ((i * 7 + j * 13) % 97) / 97;
          k++;
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.userData.dynamic = true;
    m.userData.grid = [NZ, NY];
    return m;
  }

  // the wall's picture on this beat: patterns that change every bar (rings, sweeps, a checker,
  // the name's colours chasing), brighter on the beat
  paintWall(beat) {
    const m = this.led;
    if (!m) return;
    const [NZ, NY] = m.userData.grid;
    const col = m.geometry.attributes.color;
    const a = col.array;
    beat = Math.max(0, beat);
    const bar = Math.floor(beat / 4);
    const ph = beat - Math.floor(beat);
    const pulse = 0.35 + 0.65 * Math.pow(1 - ph, 2);
    const mode = pm(bar, 4);
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NZ; i++) {
        let c;
        let k = pulse;
        if (mode === 0) {
          const r = Math.hypot(i - NZ / 2 + 0.5, (j - NY / 2 + 0.5) * 1.6);
          c = LED_C[pm(r - beat * 2 + 100, LED_C.length)];
        } else if (mode === 1) {
          c = LED_C[pm(i / 2 + beat, LED_C.length)];
          k *= (i + Math.floor(beat * 2)) % 3 === 0 ? 1 : 0.35;
        } else if (mode === 2) {
          c = LED_C[pm(i + j + beat, 2) ? 0 : 1];
        } else {
          c = LED_C[pm(j + beat, LED_C.length)];
          k *= Math.abs(i - ((beat * 3) % NZ)) < 2 ? 1.2 : 0.4;
        }
        const base = (j * NZ + i) * 6 * 3;
        for (let v = 0; v < 6; v++) {
          a[base + v * 3] = c[0] * k;
          a[base + v * 3 + 1] = c[1] * k;
          a[base + v * 3 + 2] = c[2] * k;
        }
      }
    }
    col.needsUpdate = true;
  }

  teardown() {
    const g = this.game;
    if (this.set) {
      g.scene.remove(this.set);
      this.set.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
    }
    for (const id of this.cols) g.world.collision.remove(id);
    this.cols = [];
    this.set = null;
    this.led = null;
    this.crowd = [];
    this.stopMusic();
  }

  // the crowd on the sand: thickest at the barrier, thinning out towards the dunes, all facing the
  // stage (cheap figures: render/people.js drawCheap)
  makeCrowd() {
    const g = this.game;
    const n = g.touch ? 60 : 150;
    const list = [];
    let tries = 0;
    while (list.length < n && tries++ < n * 8) {
      const r = 3 + Math.pow(Math.random(), 1.6) * 30;
      const a = (Math.random() - 0.5) * 2.3;
      const x = 98.5 - Math.cos(a) * r;
      const z = CZ + Math.sin(a) * r * 1.15;
      if (x > 98.6 || x < 60 || z < 257 || z > 292) continue;
      // (room by the trucks' windows, and a lane down the middle to walk to the front)
      if (this.trucks.some((t) => Math.hypot(t.x + 1 - x, t.z - z) < 4)) continue;
      if (Math.abs(z - CZ) < 1.1 && x < 96) continue;
      if (list.some((w) => Math.hypot(w.x - x, w.z - z) < 0.75)) continue;
      const look = civilianLook();
      const y = groundHeight(x, z);
      list.push({ x, z, y, y0: y, look, scale: look.build.height, yaw: Math.atan2(STAGE.x0 + 6 - x, CZ - z), speed: 0, phase: Math.random() * 6, seed: Math.random() * 100, cheer: 0, sit: 0, hop: Math.random(), feel: 0.5 + Math.random() * 0.5 });
    }
    // the DJ, on the stage at the table
    list.push({ x: STAGE.x0 + 6.6, z: CZ, y: STAGE.deck, y0: STAGE.deck, look: civilianLook(), scale: 1, yaw: -Math.PI / 2, speed: 0, phase: 0, seed: 7, cheer: 0, sit: 0, hop: 0, feel: 1, dj: true });
    this.crowd = list;
  }

  // ------------------------------------------------------------------ the music
  startMusic() {
    const a = this.game.audio;
    const c = a && a.ctx;
    if (!c || this.band) return;
    this.mix = c.createGain();
    this.mix.gain.value = 0;
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 900;
    this.mix.connect(this.lp).connect(a.musicBus || a.fx);
    this.band = new Band(c, this.mix, a.noise);
    this.songN = 0;
    this.nextSong(c.currentTime + 0.2);
    // the crowd, a roar of voices under it
    const s = c.createBufferSource();
    s.buffer = a.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 0.6;
    this.roar = c.createGain();
    this.roar.gain.value = 0;
    s.connect(f).connect(this.roar).connect(a.fx);
    s.start();
    this.roarSrc = s;
  }

  nextSong(t) {
    const style = STYLES[this.songN % STYLES.length];
    this.song = makeSong(style, 300 + this.songN * 17);
    this.songT0 = t;
    this.songEnd = t + Band.length(this.song, 32);
    this.spb = 60 / this.song.bpm / 4;
    this.band.play(this.song, t, 0);
    this.songN++;
  }

  stopMusic() {
    if (this.band) this.band.stop();
    const c = this.game.audio && this.game.audio.ctx;
    for (const n of [this.mix, this.roar]) {
      if (!n || !c) continue;
      n.gain.setTargetAtTime(0, c.currentTime, 0.2);
      setTimeout(() => n.disconnect(), 1500);
    }
    if (this.roarSrc) this.roarSrc.stop(c ? c.currentTime + 1.4 : 0);
    this.band = null;
    this.mix = null;
    this.roar = null;
    this.roarSrc = null;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const g = this.game;
    this.t += dt;
    const p = g.player;
    const d = Math.hypot(p.pos.x - CX, p.pos.z - CZ);
    const on = this.on;
    if (on && !this.set && d < NEAR) this.build();
    if (this.set && (!on ? d > 120 || this.idle > 30 : d > NEAR + 60)) this.teardown();
    if (!this.set) return;
    this.idle = on ? 0 : (this.idle || 0) + dt;
    const c = g.audio && g.audio.ctx;
    if (on && !this.band) this.startMusic();
    if (this.band && c) {
      const now = c.currentTime;
      if (now > this.songEnd - 0.05) this.nextSong(this.songEnd);
      this.band.update(now);
      // louder and clearer as you come; muffled from far off
      const near = Math.max(0, Math.min(1, 1 - (d - 18) / 170));
      this.mix.gain.setTargetAtTime(on ? 0.95 * Math.pow(near, 1.4) : 0, now, 0.3);
      this.lp.frequency.setTargetAtTime(700 + 17000 * Math.pow(near, 3), now, 0.3);
      this.roar.gain.setTargetAtTime(on ? 0.05 * Math.pow(Math.max(0, 1 - d / 60), 2) * (1 + this.cheer) : 0, now, 0.4);
      this.beat = (now - this.songT0) / (this.spb * 4);
    } else this.beat = this.t * 2;
    if (this.cheer > 0) this.cheer = Math.max(0, this.cheer - dt * 0.4);
    // the crowd on the beat: a bounce, hands up on the strong beats (all of them, cheering)
    const ph = this.beat - Math.floor(this.beat);
    const bounce = Math.pow(1 - ph, 3);
    for (const w of this.crowd) {
      const k = w.feel;
      w.y = w.y0 + bounce * 0.14 * k * (0.6 + w.hop * 0.8) + (this.cheer > 0.5 ? 0.12 : 0);
      w.phase += dt * 2;
      w.cheer = Math.max(this.cheer, w.dj ? 0.6 + 0.4 * bounce : (Math.floor(this.beat + w.hop * 4) % 4 === 0 ? 1 : 0) * k * 0.9);
    }
    this.paintWall(this.beat);
    // arriving: the name, once a night
    const D = g.daynight;
    const key = D ? D.day : 0;
    if (on && d < 70 && this.nightKey !== key) {
      this.nightKey = key;
      g.hud.big('INK FEST', 2600);
      g.audio.play('cheer', 0.6);
    }
    this.fireworks(dt, on);
  }

  // midnight: the show (and a rocket now and then from eleven): up from the deck and the sea,
  // bursting in the festival's colours
  fireworks(dt, on) {
    const g = this.game;
    const D = g.daynight;
    const h = D ? D.hour : 0;
    const show = on && (h >= 23.98 || h < 0.35);
    const rate = show ? 3.2 : on && h >= 23 ? 0.15 : 0;
    if (g.calendar && g.calendar.forced && on) this.demo = (this.demo || 0) + dt;
    const forcedShow = this.demo && this.demo % 60 > 45;
    if (Math.random() < (forcedShow ? 3.2 : rate) * dt) {
      const x = STAGE.x1 + 6 + Math.random() * 40;
      const z = CZ + (Math.random() - 0.5) * 70;
      this.rockets.push({ x, y: 1, z, vy: 30 + Math.random() * 12, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, fuse: 1.3 + Math.random() * 0.7, t: 0, c: FIRE_C[Math.floor(Math.random() * FIRE_C.length)] });
      g.audio.play('whoosh', 0.25);
    }
    for (const r of this.rockets) {
      r.t += dt;
      r.px = r.x;
      r.py = r.y;
      r.pz = r.z;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      r.vy -= 9 * dt;
      if (r.t > r.fuse && !r.done) {
        r.done = true;
        if (g.fx) {
          g.fx.burst(r.x, r.y, r.z, 64, 30, r.c, 4.5, 1.1);
          g.fx.burst(r.x, r.y, r.z, 36, 17, FIRE_C[(FIRE_C.indexOf(r.c) + 2) % FIRE_C.length], 2.6, 0.9);
        }
        r.flash = 0.35;
        const pd = Math.hypot(g.player.pos.x - r.x, g.player.pos.z - r.z);
        g.audio.play('boom', Math.max(0.05, 0.5 - pd / 400));
        this.cheer = Math.min(1, this.cheer + 0.25);
      }
      if (r.flash) r.flash = Math.max(0, r.flash - dt);
    }
    this.rockets = this.rockets.filter((r) => !r.done || r.flash > 0);
  }

  // ------------------------------------------------------------------ drawing (game/game.js)
  draw(fr) {
    if (!this.set) return;
    const g = this.game;
    const cam = g.camera.position;
    const bodies = g.figures.bodies;
    const fwd = g.camera.getWorldDirection(_v);
    const far = g.touch ? 110 : 170;
    for (const w of this.crowd) {
      const dx = w.x - cam.x;
      const dz = w.z - cam.z;
      const d = Math.hypot(dx, dz);
      if (d > far || (d > 4 && (dx * fwd.x + dz * fwd.z) / d < -0.3)) continue;
      bodies.drawCheap(w);
    }
    // the moving heads' beams: fans of light strokes sweeping the sky, on the beat
    const night = g.daynight ? g.daynight.night : 1;
    if (!this.on || night < 0.15) return;
    const b = this.beat;
    const ph = b - Math.floor(b);
    for (const h of this.heads) {
      const sw = Math.sin(this.t * 0.7 + h.i * 0.9) * 0.9;
      const up = 0.55 + 0.35 * Math.sin(this.t * 0.5 + h.i * 1.7);
      const len = 70;
      const c = BEAM_C[pm(h.i + b / 4, BEAM_C.length)];
      const al = (0.18 + 0.32 * Math.pow(1 - ph, 2)) * night;
      for (let k = -1; k <= 1; k++) {
        const s = sw + k * 0.035;
        const ex = h.x - Math.cos(up) * len;
        const ey = h.y + Math.sin(up) * len;
        const ez = h.z + Math.sin(s) * len;
        fr.lineXYZ(h.x, h.y, h.z, ex, ey, ez, c, 5 - Math.abs(k) * 1.5, 8800 + h.i * 7 + k, al * (k ? 0.5 : 1), 0.002, 0);
      }
      // (where it falls on the crowd, a pool of its colour)
      if (h.i % 2 === 0) flashLight(h.x - 14, 2.5, h.z + Math.sin(sw) * 10, 14, new THREE.Color(c[0], c[1], c[2]), 1.4 * night);
    }
    for (const r of this.rockets) {
      if (!r.done) fr.lineXYZ(r.px, r.py - 1.2, r.pz, r.x, r.y, r.z, [1, 0.8, 0.4], 3, 9100 + (r.t * 10) | 0, 0.9, 0.01, 0);
      if (r.flash > 0) flashLight(r.x, r.y, r.z, 90, new THREE.Color(r.c[0], r.c[1], r.c[2]), 6 * r.flash);
    }
  }

  // ------------------------------------------------------------------ what you can do there
  target() {
    if (!this.set || !this.on) return null;
    const p = this.game.player;
    for (const t of this.trucks) if (Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < 3.2) return { kind: t.kind, label: t.kind === 'bar' ? 'E — NEON BAR: מוקטיילים' : 'E — TACO LOCO: טאקו וצ׳ורוס', t };
    const dx = p.pos.x - 92;
    const dz = p.pos.z - CZ;
    if (p.pos.x < 99 && p.pos.x > 70 && Math.hypot(dx * 0.8, dz) < 18) return { kind: 'dance', label: 'E — לרקוד בקהל (Ink Beat)' };
    return null;
  }

  interact() {
    const tg = this.target();
    if (!tg) return false;
    const g = this.game;
    if (tg.kind === 'dance') {
      if (!g.minigames) return false;
      g.player.fig.dance = 1;
      const style = this.song ? this.song.style : 'disco';
      // (ROADMAP 12.6: the arrows on a screen let down from the front truss, you in the front row
      // dancing, the camera behind you)
      const z = Math.max(STAGE.z0 + 5, Math.min(STAGE.z1 - 5, g.player.pos.z));
      const world = worldAt({ at: [STAGE.x0 + 0.3, 5.7, z], n: [-1, 0], w: 9.6, stand: 5.1, side: 1.2, y0: groundHeight(98.2, z), back: 5.2, up: 2.9, exit: [97.4, z + 1.2, Math.PI / 2] });
      g.minigames.play(new DanceGame({ venue: 'INK FEST', style, tips: true }), (r) => {
        g.player.fig.dance = 0;
        if (r && (r.grade === 'S' || r.grade === 'A')) {
          this.cheer = 1;
          g.hud.toast('הקהל סביבכם השתגע! מחיאות כפיים מכל הכיוונים', 'good', 3);
        } else if (r && r.grade) g.hud.toast('רקדתם עם כל החוף', 'good', 2.4);
      }, { world });
      return true;
    }
    const menu = tg.kind === 'bar'
      ? [['מוקטייל ניאון', 7, 20, [0.4, 0.9, 1]], ['לימונדה קפואה', 4, 10, [1, 0.9, 0.4]]]
      : [['טאקו כפול', 9, 35, [0.95, 0.6, 0.25]], ['צ׳ורוס בשוקולד', 5, 15, [0.6, 0.35, 0.2]]];
    g.dialog.show(tg.t.name, tg.kind === 'bar' ? 'הכי קר בפסטיבל! מה לשים לכם?' : 'טאקו חם, ישר מהגריל! מה בא לכם?', menu.map(([label, price, hp, colr]) => ({
      label: `${label} (+${hp} חיים) · $${price}`,
      fn: () => {
        if (!g.money || g.money.pay(price, label)) {
          const p = g.player;
          p.hp = Math.min(p.maxHp, p.hp + hp);
          p.fig.belly = Math.min(1, p.fig.belly + 0.3);
          p.fig.bellyColor = colr;
          g.audio.play('coins', 0.5);
          g.hud.toast(`${label}! +${hp} חיים`, 'good', 2);
        } else g.money.refuse(tg.t.name, price);
      },
    })));
    return true;
  }
}

const _v = new THREE.Vector3();
