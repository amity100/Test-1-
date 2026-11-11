import * as THREE from 'three';
import { shared, makeLineMaterial } from '../render/materials.js';
import { COMMON } from '../render/shaders.js';
import { LineBatch } from '../render/LineBatch.js';
import { AVES, STREETS, AVE_W, ST_W, CURB } from '../world/layout.js';
import { mulberry32 } from '../core/util.js';

// Small life in the drawn city (the magic world): pigeons pecking on the sidewalks that burst up
// when you run through them or a shot goes off, cats watching from the fire escapes (their eyes
// glow at night), paper planes gliding down from the windows, laundry swaying over the back
// alleys, fireflies in the park after dark, flocks of birds crossing the sky. People open their
// umbrellas when it rains.

const PIGEON = [0.26, 0.28, 0.36];
const PIGEON_W = [0.5, 0.5, 0.56];
const PIGEON_FILL = [0.62, 0.64, 0.7];
const CAT_INK = [[0.09, 0.09, 0.11], [0.2, 0.2, 0.24], [0.62, 0.36, 0.16]];
const PLANE = [0.16, 0.2, 0.36];
const UMBRELLAS = [[0.82, 0.22, 0.24], [0.2, 0.3, 0.6], [0.95, 0.75, 0.2], [0.15, 0.15, 0.18], [0.3, 0.55, 0.35], [0.85, 0.45, 0.6]];

const _r = new THREE.Vector3();
const _f = new THREE.Vector3();

// ------------------------------------------------------------------ laundry on the lines
const CLOTH_VERT = /* glsl */ `
attribute vec4 iHang; // x, y, z of the peg point, seed
attribute vec4 iCloth; // width, height, kind, rope direction angle
varying vec2 vQ;
varying float vKind;
varying float vSeed;
varying float vDist;
varying vec3 vWP;
void main() {
  float sd = iHang.w;
  vec2 rope = vec2(cos(iCloth.w), sin(iCloth.w));
  vec2 across = vec2(-rope.y, rope.x);
  // swings about the rope in the wind, a little flutter
  float wind = uWind.z * dot(vec2(uWind.x, uWind.y), across);
  float swing = (0.12 + 0.55 * abs(uWind.z)) * sin(uTime * (1.4 + hash11(sd) * 0.8) + sd * 7.0) * 0.5 + wind * 0.5;
  float hang = 1.0 - position.y; // 0 at the pegs, 1 at the hem
  float a = swing * hang;
  vec3 P = vec3(iHang.x, iHang.y, iHang.z);
  vec3 W = P + vec3(rope.x, 0.0, rope.y) * position.x * iCloth.x;
  W += vec3(across.x, 0.0, across.y) * sin(a) * iCloth.y * hang;
  W.y -= cos(a) * iCloth.y * hang;
  W += vec3(across.x, 0.0, across.y) * sin(uTime * 5.0 + position.x * 4.0 + sd) * 0.03 * hang * uWind.z;
  vQ = vec2(position.x, position.y);
  vKind = iCloth.z;
  vSeed = sd;
  vWP = W;
  vec4 mv = viewMatrix * vec4(W, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const CLOTH_FRAG = /* glsl */ `
varying vec2 vQ;
varying float vKind;
varying float vSeed;
varying float vDist;
varying vec3 vWP;
float boxD(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return max(d.x, d.y); }
void main() {
  // q: x -0.5..0.5 along the rope, y 1 at the pegs .. 0 at the hem
  vec2 q = vQ;
  float d;
  if (vKind < 1.0) {
    // a shirt: body and two sleeves
    d = min(boxD(q, vec2(0.0, 0.45), vec2(0.28, 0.45)), boxD(q, vec2(0.0, 0.8), vec2(0.5, 0.15)));
  } else if (vKind < 2.0) {
    // trousers: two legs from a waistband
    d = min(boxD(q, vec2(-0.2, 0.5), vec2(0.17, 0.5)), boxD(q, vec2(0.2, 0.5), vec2(0.17, 0.5)));
    d = min(d, boxD(q, vec2(0.0, 0.88), vec2(0.37, 0.12)));
  } else if (vKind < 3.0) {
    // a sock
    d = min(boxD(q, vec2(-0.1, 0.62), vec2(0.18, 0.38)), boxD(q, vec2(0.1, 0.16), vec2(0.3, 0.14)));
  } else {
    // a towel or a sheet, striped
    d = boxD(q, vec2(0.0, 0.5), vec2(0.48, 0.5));
  }
  float w = max(fwidth(q.y), fwidth(q.x)) * 1.3;
  if (d > w) discard;
  float h = fract(vSeed * 7.31);
  vec3 col = h < 0.2 ? vec3(0.92, 0.9, 0.86) : h < 0.4 ? vec3(0.55, 0.68, 0.88) : h < 0.55 ? vec3(0.86, 0.38, 0.34) : h < 0.7 ? vec3(0.96, 0.82, 0.4) : h < 0.85 ? vec3(0.5, 0.72, 0.5) : vec3(0.82, 0.6, 0.78);
  if (vKind >= 3.0) col = mix(col, vec3(0.97, 0.96, 0.92), step(0.5, fract(q.x * 4.0 + 0.25)) * 0.8);
  float shade = n2(vWP.xz * 3.0 + q * 9.0) * 0.12;
  col *= 0.9 + shade;
  vec3 ink = vec3(0.12, 0.14, 0.24);
  // pegs on the rope
  float peg = (1.0 - step(0.06, abs(abs(q.x) - 0.32))) * step(0.9, q.y);
  col = mix(col, vec3(0.62, 0.45, 0.3), peg);
  col = mix(col, ink, smoothstep(-w * 1.6, -w * 0.3, d));
  if (uMagic > 0.5 && uNight > 0.001) {
    vec3 nc = nightFlip(col, uPaper, ink, vec3(0.86, 0.89, 1.0));
    col = mix(col, poolLight(nc, col, lampLight(vWP)), uNight);
  }
  col = mix(col, paperAt(gl_FragCoord.xy), fogFactor(vDist));
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ fireflies over the park
const FLY_VERT = /* glsl */ `
attribute vec4 iFly; // x, z, y, seed
varying vec2 vQ;
varying float vA;
void main() {
  float sd = iFly.w;
  vec3 P = vec3(iFly.x, iFly.z, iFly.y);
  P += vec3(sin(uTime * 0.31 + sd * 5.0) * 1.6, sin(uTime * 0.47 + sd * 3.0) * 0.5, cos(uTime * 0.27 + sd * 7.0) * 1.6);
  float blink = smoothstep(0.55, 0.95, sin(uTime * (0.9 + hash11(sd) * 0.8) + sd * 13.0));
  vA = blink * smoothstep(0.35, 0.8, uNight) * (1.0 - uRain);
  vec4 mv = viewMatrix * vec4(P, 1.0);
  float size = 0.11;
  mv.xy += position.xy * size;
  vQ = position.xy;
  gl_Position = vA < 0.01 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * mv;
}`;

const FLY_FRAG = /* glsl */ `
varying vec2 vQ;
varying float vA;
void main() {
  float r = length(vQ);
  float a = (exp(-r * r * 9.0) * 0.9 + (1.0 - smoothstep(0.12, 0.2, r))) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.82, 1.0, 0.4, a);
}`;

function quadGeo(x0, x1, y0, y1) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export class Ambient {
  constructor(game) {
    this.game = game;
    const world = game.world;
    const rnd = mulberry32(4242);
    this.time = 0;
    this.on = false;
    this.lastP = new THREE.Vector3();
    this.pSpeed = 0;
    // ---- pigeons: a few flocks on the plaza, in the park, on sidewalks around the city
    this.flocks = [];
    const addFlock = (x, z, n) => {
      const birds = [];
      for (let i = 0; i < n; i++) {
        birds.push({ ox: (rnd() - 0.5) * 3.2, oz: (rnd() - 0.5) * 2.6, x, y: 0, z, vx: 0, vy: 0, vz: 0, dir: rnd() * 6.28, peck: rnd() * 6, flap: rnd() * 6, walkT: rnd() * 3, white: rnd() < 0.15 });
      }
      for (const b of birds) {
        b.x = x + b.ox;
        b.z = z + b.oz;
        b.y = this.groundY(b.x, b.z);
      }
      this.flocks.push({ x, z, birds, state: 'ground', t: 0, away: 0 });
    };
    addFlock(-6, 6, 9);
    addFlock(12, -8, 7);
    addFlock(-14, -14, 6);
    addFlock(4, -52, 7);
    addFlock(-20, -66, 6);
    addFlock(-150, 110, 6);
    for (let i = 0; i < 22; i++) {
      const bx = Math.floor(rnd() * 5);
      const bz = Math.floor(rnd() * 5);
      const x0 = AVES[bx] + AVE_W / 2;
      const x1 = AVES[bx + 1] - AVE_W / 2;
      const z0 = STREETS[bz] + ST_W / 2;
      const z1 = STREETS[bz + 1] - ST_W / 2;
      // the middle of a sidewalk, along one side of the block
      const side = Math.floor(rnd() * 4);
      let x;
      let z;
      if (side < 2) {
        x = x0 + 8 + rnd() * (x1 - x0 - 16);
        z = side === 0 ? z0 + 2.3 : z1 - 2.3;
      } else {
        z = z0 + 8 + rnd() * (z1 - z0 - 16);
        x = side === 2 ? x0 + 2.3 : x1 - 2.3;
      }
      addFlock(x, z, 4 + Math.floor(rnd() * 4));
    }
    // ---- cats on some fire escape landings
    this.cats = [];
    for (const fe of world.fireEscapes || []) {
      if (rnd() > 0.16) continue;
      const t = 0.15 + rnd() * 0.7;
      this.cats.push({
        x: fe.x0 + (fe.x1 - fe.x0) * t, y: fe.y, z: fe.z0 + (fe.z1 - fe.z0) * t, nx: fe.nx, nz: fe.nz,
        ink: CAT_INK[Math.floor(rnd() * CAT_INK.length)], seed: rnd() * 100, lie: rnd() < 0.3,
      });
    }
    // ---- paper planes
    this.planes = [];
    this.planeT = 6;
    // ---- birds crossing the sky
    this.vflock = null;
    this.vT = 20;
    // ---- laundry over the back alleys of the houses
    const ropes = new LineBatch(2400, makeLineMaterial({ widthScale: 1 }));
    const hang = [];
    const cloth = [];
    for (const a of world.alleys || []) {
      if (a.type !== 'brown' && a.type !== 'start' && a.type !== 'loft') continue;
      const n = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const x = a.x0 + 5 + rnd() * (a.x1 - a.x0 - 10);
        const y = 5.2 + rnd() * 3.6;
        const za = a.z - 2.5;
        const zb = a.z + 2.5;
        const sag = 0.35 + rnd() * 0.25;
        // the rope, sagging between the two back walls
        const N = 8;
        let prev = null;
        for (let k = 0; k <= N; k++) {
          const t = k / N;
          const p = [x + (rnd() - 0.5) * 0.02, y - Math.sin(t * Math.PI) * sag, za + (zb - za) * t];
          if (prev) ropes.push(prev[0], prev[1], prev[2], p[0], p[1], p[2], 0.2, 0.18, 0.16, 0.9, 1.3, x + k, 0.02, 0.01);
          prev = p;
        }
        // things pegged on it
        let t = 0.12 + rnd() * 0.1;
        while (t < 0.88) {
          const kind = Math.floor(rnd() * 4);
          const w = kind === 2 ? 0.28 : kind === 3 ? 0.7 + rnd() * 0.4 : 0.55 + rnd() * 0.2;
          const h = kind === 2 ? 0.42 : kind === 1 ? 0.95 : kind === 3 ? 0.6 + rnd() * 0.5 : 0.7;
          const wt = w / 5; // as a fraction of the rope
          const tc = t + wt / 2;
          if (tc > 0.9) break;
          hang.push(x, y - Math.sin(tc * Math.PI) * sag, za + (zb - za) * tc, rnd() * 100);
          cloth.push(w, h, kind + 0.5, Math.PI / 2);
          t += wt + 0.04 + rnd() * 0.08;
        }
      }
    }
    ropes.commit();
    this.ropes = ropes;
    game.scene.add(ropes.mesh);
    const cg = quadGeo(-0.5, 0.5, 0, 1);
    cg.setAttribute('iHang', new THREE.InstancedBufferAttribute(new Float32Array(hang), 4));
    cg.setAttribute('iCloth', new THREE.InstancedBufferAttribute(new Float32Array(cloth), 4));
    cg.instanceCount = hang.length / 4;
    this.clothes = new THREE.Mesh(cg, new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: COMMON + CLOTH_VERT,
      fragmentShader: COMMON + CLOTH_FRAG,
      side: THREE.DoubleSide,
    }));
    this.clothes.frustumCulled = false;
    game.scene.add(this.clothes);
    // ---- fireflies over the park lawns
    const flies = [];
    for (let i = 0; i < 140; i++) flies.push(-30 + rnd() * 60, -77 + rnd() * 38, 0.4 + rnd() * 2.2, rnd() * 100);
    const fg = quadGeo(-1, 1, -1, 1);
    fg.setAttribute('iFly', new THREE.InstancedBufferAttribute(new Float32Array(flies), 4));
    fg.instanceCount = flies.length / 4;
    this.flies = new THREE.Mesh(fg, new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: COMMON + FLY_VERT,
      fragmentShader: COMMON + FLY_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.flies.frustumCulled = false;
    this.flies.renderOrder = 6;
    game.scene.add(this.flies);
    this.setVisible(false);
  }

  setVisible(v) {
    this.ropes.mesh.visible = v;
    this.clothes.visible = v;
    this.flies.visible = v;
  }

  groundY(x, z) {
    const bx = Math.floor((x + 210) / 84);
    const bz = Math.floor((z + 145) / 58);
    if (bx < 0 || bx > 4 || bz < 0 || bz > 4) return 0;
    const lx = x + 210 - bx * 84;
    const lz = z + 145 - bz * 58;
    return lx > 7 && lx < 77 && lz > 5 && lz < 53 ? CURB : 0;
  }

  // a shot, a bang, a car horn: the pigeons nearby take off
  scare(pos, r) {
    for (const f of this.flocks) {
      if (f.state !== 'ground') continue;
      if (Math.hypot(f.x - pos.x, f.z - pos.z) < r) this.takeOff(f, pos);
    }
  }

  takeOff(f, from) {
    f.state = 'fly';
    f.t = 0;
    for (const b of f.birds) {
      let ax = b.x - from.x;
      let az = b.z - from.z;
      const l = Math.hypot(ax, az) || 1;
      ax = ax / l + (Math.random() - 0.5) * 0.9;
      az = az / l + (Math.random() - 0.5) * 0.9;
      const sp = 4 + Math.random() * 3;
      b.vx = ax * sp;
      b.vz = az * sp;
      b.vy = 3.5 + Math.random() * 2.5;
      b.dir = Math.atan2(b.vz, b.vx);
      b.delay = Math.random() * 0.25;
    }
    if (this.game.audio.ctx && Math.hypot(f.x - this.game.camera.position.x, f.z - this.game.camera.position.z) < 30) {
      // the clatter of wings
      for (let i = 0; i < 3; i++) this.game.audio.hiss(0.18, 0.05, 1400 + i * 300, 1.2, 'bandpass', i * 0.07);
    }
  }

  update(dt) {
    const game = this.game;
    const on = game.daynight.on && !game.inBar;
    if (!on) {
      if (this.on) {
        this.setVisible(false);
        this.dropUmbrellas();
      }
      this.on = false;
      return;
    }
    if (!this.on) this.setVisible(true);
    this.on = true;
    this.time += dt;
    const night = shared.uNight.value;
    const p = game.anchorPos();
    if (dt > 0) {
      this.pSpeed = this.lastP.distanceTo(p) / dt;
      this.lastP.copy(p);
    }
    // ---- pigeons
    const cars = game.traffic.list;
    for (const f of this.flocks) {
      const dx = f.x - p.x;
      const dz = f.z - p.z;
      const d = Math.hypot(dx, dz);
      if (f.state === 'ground') {
        if (night > 0.6) continue; // asleep
        if (d > 70) continue;
        let threat = null;
        if ((d < 4.2 && this.pSpeed > 3.2) || d < 1.7) threat = p;
        if (!threat) {
          for (const c of cars) {
            if (Math.abs(c.pos.x - f.x) < 5 && Math.abs(c.pos.z - f.z) < 5 && c.speed > 2) {
              threat = c.pos;
              break;
            }
          }
        }
        if (threat) {
          this.takeOff(f, threat);
          continue;
        }
        for (const b of f.birds) {
          b.peck += dt;
          b.walkT -= dt;
          if (b.walkT <= 0) {
            b.walkT = 1.5 + Math.random() * 4;
            b.tx = f.x + (Math.random() - 0.5) * 3.4;
            b.tz = f.z + (Math.random() - 0.5) * 2.8;
          }
          if (b.tx !== undefined) {
            const ex = b.tx - b.x;
            const ez = b.tz - b.z;
            const el = Math.hypot(ex, ez);
            if (el > 0.05) {
              const s = Math.min(el, 0.45 * dt);
              b.x += (ex / el) * s;
              b.z += (ez / el) * s;
              b.dir = Math.atan2(ez, ex);
              b.walking = true;
            } else b.walking = false;
          }
          b.y = this.groundY(b.x, b.z);
        }
      } else if (f.state === 'fly') {
        f.t += dt;
        for (const b of f.birds) {
          if (b.delay > 0) {
            b.delay -= dt;
            continue;
          }
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.z += b.vz * dt;
          b.vy = Math.max(0.6, b.vy - dt * 0.6);
          b.flap += dt * 18;
        }
        if (f.t > 7) {
          f.state = 'away';
          f.away = 20 + Math.random() * 20;
        }
      } else if (f.state === 'away') {
        f.away -= dt;
        if (f.away <= 0 && d > 28) {
          // they come back while nobody is looking
          for (const b of f.birds) {
            b.x = f.x + b.ox;
            b.z = f.z + b.oz;
            b.y = this.groundY(b.x, b.z);
            b.tx = undefined;
          }
          f.state = 'ground';
        }
      }
    }
    // ---- paper planes from the windows
    this.planeT -= dt;
    if (this.planeT <= 0 && night < 0.8 && shared.uRain.value < 0.3) {
      this.planeT = 9 + Math.random() * 14;
      this.launchPlane();
    }
    for (const pl of this.planes) {
      pl.t += dt;
      if (pl.landed) {
        pl.life -= dt;
        continue;
      }
      // a glider: dives, pulls up, banks into gentle turns
      pl.yaw += Math.sin(pl.t * 0.9 + pl.seed) * 0.5 * dt;
      pl.pitch = -0.18 + Math.sin(pl.t * 1.7 + pl.seed) * 0.16;
      const v = 5.5;
      pl.x += Math.cos(pl.yaw) * Math.cos(pl.pitch) * v * dt + shared.uWind.value.x * shared.uWind.value.z * 1.5 * dt;
      pl.z += Math.sin(pl.yaw) * Math.cos(pl.pitch) * v * dt + shared.uWind.value.y * shared.uWind.value.z * 1.5 * dt;
      pl.y += Math.sin(pl.pitch) * v * dt;
      const gy = this.groundY(pl.x, pl.z);
      if (pl.y <= gy + 0.05) {
        pl.y = gy + 0.05;
        pl.landed = true;
        pl.pitch = 0;
        pl.life = 10;
      }
      // into a wall: it drops where it hit
      if (game.world.collision.pointInside(pl.x, pl.y, pl.z, 0.1)) {
        pl.x -= Math.cos(pl.yaw) * 0.4;
        pl.z -= Math.sin(pl.yaw) * 0.4;
        pl.yaw += Math.PI * (0.6 + Math.random() * 0.8);
      }
    }
    this.planes = this.planes.filter((pl) => !pl.landed || pl.life > 0);
    // ---- a flock crossing the sky
    this.vT -= dt;
    if (!this.vflock && this.vT <= 0 && night < 0.5) {
      this.vT = 35 + Math.random() * 40;
      const cam = game.camera;
      const fw = cam.getWorldDirection(_f);
      const side = Math.random() < 0.5 ? 1 : -1;
      const ang = Math.atan2(fw.z, fw.x) + side * (0.6 + Math.random() * 0.5);
      const dist = 160;
      const sx = cam.position.x + Math.cos(ang) * dist;
      const sz = cam.position.z + Math.sin(ang) * dist;
      const tx = cam.position.x - Math.cos(ang) * dist + (Math.random() - 0.5) * 60;
      const tz = cam.position.z - Math.sin(ang) * dist + (Math.random() - 0.5) * 60;
      const l = Math.hypot(tx - sx, tz - sz);
      const n = 7 + Math.floor(Math.random() * 5);
      this.vflock = { x: sx, z: sz, y: 46 + Math.random() * 22, dx: (tx - sx) / l, dz: (tz - sz) / l, left: l, n, seed: Math.random() * 10 };
    }
    if (this.vflock) {
      const v = this.vflock;
      v.x += v.dx * 13 * dt;
      v.z += v.dz * 13 * dt;
      v.left -= 13 * dt;
      if (v.left <= 0) this.vflock = null;
    }
    // ---- umbrellas up when it rains
    this.umbT = (this.umbT || 0) - dt;
    if (this.umbT <= 0) {
      this.umbT = 0.7;
      const rain = shared.uRain.value;
      for (const c of game.civilians.list) {
        if (!c.alive || c.scripted || !c.fig) continue;
        if (rain > 0.35 && !c.fig.carry && !c.rainUmb && !c.headless && Math.random() < 0.6) {
          c.fig.carry = 'umbrella';
          c.fig.umbrellaColor = UMBRELLAS[Math.floor(Math.random() * UMBRELLAS.length)];
          c.rainUmb = true;
        } else if (rain < 0.12 && c.rainUmb) {
          if (c.fig.carry === 'umbrella') c.fig.carry = null;
          c.rainUmb = false;
        }
      }
    }
  }

  dropUmbrellas() {
    for (const c of this.game.civilians.list) {
      if (c.rainUmb && c.fig && c.fig.carry === 'umbrella') c.fig.carry = null;
      c.rainUmb = false;
    }
  }

  launchPlane() {
    const game = this.game;
    const cam = game.camera;
    const fw = cam.getWorldDirection(_f);
    // somewhere ahead of you, out of a window on the nearest block
    const a = Math.atan2(fw.z, fw.x) + (Math.random() - 0.5) * 0.9;
    const d = 14 + Math.random() * 18;
    let x = cam.position.x + Math.cos(a) * d;
    let z = cam.position.z + Math.sin(a) * d;
    const bx = Math.floor((x + 210) / 84);
    const bz = Math.floor((z + 145) / 58);
    if (bx < 0 || bx > 4 || bz < 0 || bz > 4) return;
    // the facade line: 4.5 m in from the curb, on the side of the block facing you
    const x0 = AVES[bx] + AVE_W / 2 + 4.5;
    const x1 = AVES[bx + 1] - AVE_W / 2 - 4.5;
    const z0 = STREETS[bz] + ST_W / 2 + 4.5;
    const z1 = STREETS[bz + 1] - ST_W / 2 - 4.5;
    const cx = cam.position.x;
    const cz = cam.position.z;
    let yaw;
    if (cz < z0 && cx > x0 && cx < x1) {
      z = z0;
      x = Math.min(x1 - 2, Math.max(x0 + 2, x));
      yaw = -Math.PI / 2;
    } else if (cz > z1 && cx > x0 && cx < x1) {
      z = z1;
      x = Math.min(x1 - 2, Math.max(x0 + 2, x));
      yaw = Math.PI / 2;
    } else if (cx < x0) {
      x = x0;
      z = Math.min(z1 - 2, Math.max(z0 + 2, z));
      yaw = Math.PI;
    } else if (cx > x1) {
      x = x1;
      z = Math.min(z1 - 2, Math.max(z0 + 2, z));
      yaw = 0;
    } else return;
    if (this.planes.length > 4) return;
    this.planes.push({ x: x + Math.cos(yaw) * 0.6, y: 7 + Math.random() * 9, z: z + Math.sin(yaw) * 0.6, yaw: yaw + (Math.random() - 0.5) * 0.8, pitch: 0, t: 0, seed: Math.random() * 6, landed: false, life: 0 });
  }

  // ------------------------------------------------------------------ drawing (dynamic ink)
  draw(fr) {
    if (!this.on) return;
    const game = this.game;
    const cam = game.camera.position;
    const night = shared.uNight.value;
    // the camera-facing side vector for flat little drawings
    const side = (x, z) => {
      const dx = cam.x - x;
      const dz = cam.z - z;
      const l = Math.hypot(dx, dz) || 1;
      return _r.set(dz / l, 0, -dx / l);
    };
    for (const f of this.flocks) {
      if (f.state === 'away' || (f.state === 'ground' && night > 0.6)) continue;
      if (Math.abs(f.x - cam.x) > 80 || Math.abs(f.z - cam.z) > 80) continue;
      for (const b of f.birds) this.drawPigeon(fr, b, side(b.x, b.z), f.state === 'fly' && !(b.delay > 0));
    }
    for (const c of this.cats) {
      if (Math.abs(c.x - cam.x) > 60 || Math.abs(c.z - cam.z) > 60) continue;
      this.drawCat(fr, c, side(c.x, c.z), night);
    }
    for (const pl of this.planes) this.drawPlane(fr, pl);
    if (this.vflock) this.drawVFlock(fr, this.vflock);
  }

  drawPigeon(fr, b, r, flying) {
    // facing left or right on the page
    const fx = Math.cos(b.dir);
    const fz = Math.sin(b.dir);
    const s = fx * r.x + fz * r.z >= 0 ? 1 : -1;
    const S = 1.7;
    const P = (u, v) => [b.x + r.x * u * s * S, b.y + v * S, b.z + r.z * u * s * S];
    const col = b.white ? PIGEON_W : PIGEON;
    const L = (a, c, w = 1.9) => fr.lineXYZ(a[0], a[1], a[2], c[0], c[1], c[2], col, w, b.peck * 0.1, 1, 0.01, 0.005);
    // body: a plump oval, coloured in with a few broad strokes
    const by = flying ? 0.0 : 0.12;
    const fc = b.white ? [0.9, 0.9, 0.9] : PIGEON_FILL;
    for (const k of [-0.035, 0, 0.035]) {
      const hw = 0.13 * Math.sqrt(1 - (k / 0.075) ** 2);
      const a = P(-hw, by + k);
      const c = P(hw, by + k);
      fr.lineXYZ(a[0], a[1], a[2], c[0], c[1], c[2], fc, 3.2, b.flap, 0.9, 0.0, 0.0);
    }
    let prev = null;
    for (let i = 0; i <= 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const q = P(Math.cos(a) * 0.15, by + Math.sin(a) * 0.075);
      if (prev) L(prev, q);
      prev = q;
    }
    // head: bobbing as it walks, down when it pecks
    const pk = !flying && !b.walking ? Math.max(0, Math.sin(b.peck * 3.1)) : 0;
    const bob = b.walking ? Math.sin(b.peck * 14) * 0.02 : 0;
    const hx = 0.15 + pk * 0.04 + bob;
    const hy = by + 0.1 - pk * 0.13;
    const h0 = P(hx - 0.04, hy);
    const h1 = P(hx, hy + 0.04);
    const h2 = P(hx + 0.04, hy);
    const h3 = P(hx, hy - 0.035);
    L(h0, h1);
    L(h1, h2);
    L(h2, h3);
    L(h3, h0);
    L(P(0.1, by + 0.05), h0, 1.3);
    L(h2, P(hx + 0.08, hy - 0.012), 1.6);
    // tail
    L(P(-0.14, by + 0.01), P(-0.25, by + 0.05), 1.4);
    L(P(-0.14, by - 0.02), P(-0.24, by + 0.0), 1.4);
    if (flying) {
      const fl = Math.sin(b.flap);
      L(P(0.02, by + 0.05), P(-0.06, by + 0.05 + fl * 0.3), 1.8);
      L(P(0.0, by + 0.04), P(-0.1, by + 0.03 + fl * 0.26), 1.4);
    } else {
      L(P(0.0, by - 0.07), P(0.0, by - 0.12), 1.2);
      L(P(0.04, by - 0.07), P(0.05, by - 0.12), 1.2);
      // a folded wing line
      L(P(-0.08, by + 0.03), P(0.06, by + 0.02), 1.1);
    }
  }

  drawCat(fr, c, r, night) {
    const t = this.time + c.seed;
    const ink = c.ink;
    const S = 2.0;
    const P = (u, v) => [c.x + r.x * u * S, c.y + v * S, c.z + r.z * u * S];
    const L = (a, b, w = 1.7, col = ink, al = 1) => fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], col, w, c.seed, al, 0.01, 0.006);
    const poly = (pts, w) => {
      for (let i = 0; i < pts.length - 1; i++) L(P(pts[i][0], pts[i][1]), P(pts[i + 1][0], pts[i + 1][1]), w);
    };
    if (c.lie) {
      // stretched out along the railing
      poly([[-0.2, 0], [-0.22, 0.07], [-0.12, 0.12], [0.1, 0.12], [0.18, 0.08], [0.2, 0]], 1.8);
      poly([[0.14, 0.08], [0.16, 0.2], [0.26, 0.2], [0.29, 0.1], [0.2, 0.06]], 1.6);
      poly([[0.17, 0.19], [0.18, 0.25], [0.21, 0.21]], 1.4);
      poly([[0.24, 0.2], [0.26, 0.26], [0.28, 0.2]], 1.4);
      const tw = Math.sin(t * 1.3) * 0.05;
      poly([[-0.2, 0.03], [-0.3, 0.02 + tw], [-0.38, 0.05 + tw * 1.5]], 1.5);
      this.catEyes(fr, P(0.215, 0.15), P(0.255, 0.15), night, t, c);
      return;
    }
    // sitting up: a pear of a body (scribbled in), round head, two ears, the tail curling
    poly([[-0.1, 0], [-0.12, 0.1], [-0.08, 0.2], [0, 0.24], [0.08, 0.2], [0.12, 0.1], [0.1, 0], [-0.1, 0]], 2.2);
    for (const [y, hw] of [[0.03, 0.1], [0.08, 0.115], [0.13, 0.105], [0.18, 0.08], [0.22, 0.04]]) L(P(-hw, y), P(hw, y), 3.4, ink, 0.85);
    const look = Math.sin(t * 0.37) * 0.025;
    const hx = look;
    const hy = 0.32;
    for (const [y, hw] of [[hy - 0.035, 0.05], [hy, 0.065], [hy + 0.035, 0.05]]) L(P(hx - hw, y), P(hx + hw, y), 3.0, ink, 0.85);
    const head = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      head.push([hx + Math.cos(a) * 0.075, hy + Math.sin(a) * 0.066]);
    }
    poly(head, 1.7);
    poly([[hx - 0.065, hy + 0.03], [hx - 0.06, hy + 0.12], [hx - 0.02, hy + 0.06]], 1.5);
    poly([[hx + 0.065, hy + 0.03], [hx + 0.06, hy + 0.12], [hx + 0.02, hy + 0.06]], 1.5);
    const sw = Math.sin(t * 1.7) * 0.04 + Math.sin(t * 0.43) * 0.03;
    poly([[0.1, 0.02], [0.18, 0.03], [0.23 + sw, 0.1], [0.2 + sw * 1.5, 0.18]], 1.6);
    // whiskers
    L(P(hx + 0.03, hy - 0.02), P(hx + 0.12, hy - 0.01), 0.9, ink, 0.7);
    L(P(hx - 0.03, hy - 0.02), P(hx - 0.12, hy - 0.01), 0.9, ink, 0.7);
    this.catEyes(fr, P(hx - 0.028, hy + 0.005), P(hx + 0.028, hy + 0.005), night, t, c);
  }

  catEyes(fr, a, b, night, t, c) {
    // a slow blink now and then
    const blink = Math.sin(t * 0.8) > 0.97;
    if (blink) return;
    const glow = night > 0.25;
    const col = glow ? [0.85, 1.0, 0.32] : [0.75, 0.68, 0.2];
    const w = glow ? 4.6 : 2.6;
    fr.lineXYZ(a[0], a[1], a[2], a[0], a[1] + 0.012, a[2], col, w, c.seed + 1, 1, 0, 0);
    fr.lineXYZ(b[0], b[1], b[2], b[0], b[1] + 0.012, b[2], col, w, c.seed + 2, 1, 0, 0);
  }

  drawPlane(fr, pl) {
    const cy = Math.cos(pl.yaw);
    const sy = Math.sin(pl.yaw);
    const cp = Math.cos(pl.pitch);
    const sp = Math.sin(pl.pitch);
    const bank = pl.landed ? 0 : Math.sin(pl.t * 0.9 + pl.seed) * 0.5;
    // plane space: x forward, y up, z right
    const P = (fx, uy, rz) => {
      const yb = uy * Math.cos(bank) - rz * Math.sin(bank);
      const zb = uy * Math.sin(bank) + rz * Math.cos(bank);
      const x1 = fx * cp - yb * sp;
      const y1 = fx * sp + yb * cp;
      return [pl.x + cy * x1 - sy * zb, pl.y + y1, pl.z + sy * x1 + cy * zb];
    };
    const alpha = pl.landed ? Math.min(1, pl.life / 2) : 1;
    const L = (a, b, w = 1.5) => fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], PLANE, w, pl.seed, alpha, 0.01, 0.01);
    const nose = P(0.22, 0, 0);
    const tl = P(-0.18, 0.02, -0.17);
    const tr = P(-0.18, 0.02, 0.17);
    const keelT = P(-0.18, -0.06, 0);
    const mid = P(-0.18, 0.0, 0);
    L(nose, tl);
    L(nose, tr);
    L(tl, mid, 1.2);
    L(tr, mid, 1.2);
    L(nose, keelT, 1.2);
    L(keelT, mid, 1.0);
    L(nose, mid, 1.0);
  }

  drawVFlock(fr, v) {
    const col = [0.16, 0.16, 0.22];
    const px = -v.dz;
    const pz = v.dx;
    for (let i = 0; i < v.n; i++) {
      const row = Math.ceil(i / 2);
      const sd = i % 2 === 0 ? 1 : -1;
      const x = v.x - v.dx * row * 3.2 + px * sd * row * 2.6;
      const z = v.z - v.dz * row * 3.2 + pz * sd * row * 2.6;
      const y = v.y + Math.sin(this.time * 0.8 + i) * 0.6;
      const fl = Math.sin(this.time * 6 + i * 0.9 + v.seed) * 0.7;
      const s = 1.2;
      fr.lineXYZ(x, y, z, x + px * s - v.dx * 0.5, y + 0.3 + fl, z + pz * s - v.dz * 0.5, col, 2.2, i + v.seed, 0.9, 0.02, 0.05);
      fr.lineXYZ(x, y, z, x - px * s - v.dx * 0.5, y + 0.3 + fl, z - pz * s - v.dz * 0.5, col, 2.2, i + v.seed + 0.5, 0.9, 0.02, 0.05);
    }
  }
}
