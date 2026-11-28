import * as THREE from 'three';
import { shared } from '../render/materials.js';
import { COMMON } from '../render/shaders.js';

// Weather drawn on the page: rain in slanted pencil strokes with little crowns where the drops
// land (and rings in the puddles), wind that blows leaves and newspaper pages down the street,
// fog like a smudged pencil, storms with gel-pen lightning, and a wax-crayon rainbow when the
// rain stops. All of it moves on the GPU in a box around the camera; the CPU sets a few numbers.

const KINDS = {
  clear: { over: 0, rain: 0, mist: 0, wind: 0.15, dur: [110, 180] },
  cloudy: { over: 0.5, rain: 0, mist: 0, wind: 0.35, dur: [40, 70] },
  rain: { over: 0.74, rain: 0.65, mist: 0.12, wind: 0.3, dur: [55, 85] },
  storm: { over: 0.92, rain: 1, mist: 0.18, wind: 0.85, dur: [40, 60] },
  fog: { over: 0.3, rain: 0, mist: 1, wind: 0.05, dur: [45, 70] },
  windy: { over: 0.18, rain: 0, mist: 0, wind: 1, dur: [35, 55] },
  rainbow: { over: 0.06, rain: 0, mist: 0, wind: 0.2, dur: [30, 40] },
};
const NEXT = {
  clear: [['cloudy', 3], ['fog', 1], ['windy', 1.3]],
  cloudy: [['rain', 2.2], ['clear', 1], ['storm', 0.8]],
  rain: [['rainbow', 2.4], ['cloudy', 1], ['storm', 0.6]],
  storm: [['rain', 1], ['rainbow', 1.4]],
  fog: [['clear', 1], ['cloudy', 0.6]],
  windy: [['clear', 1], ['cloudy', 1]],
  rainbow: [['clear', 1]],
};
const SAY = {
  clear: 'השמיים מתבהרים',
  cloudy: 'השמיים מתמלאים בעיפרון אפור',
  rain: 'מתחיל לרדת גשם של קווי עיפרון',
  storm: 'סערה! ברקים בעט ג\'ל',
  fog: 'ערפל של עיפרון מרוח',
  windy: 'רוח חזקה, הדפים עפים',
  rainbow: 'קשת בצבעי שעווה!',
};

const RAIN_N = 2400;
const SPLASH_N = 460;
const LEAF_N = 130;

// ground height under xz: sidewalks inside the blocks sit on a curb, the streets are at 0
const GROUND = /* glsl */ `
float groundAt(vec2 xz) {
  float bx = floor((xz.x + 210.0) / 84.0);
  float bz = floor((xz.y + 145.0) / 58.0);
  if (bx < 0.0 || bx > 4.0 || bz < 0.0 || bz > 4.0) return 0.0;
  float lx = xz.x + 210.0 - bx * 84.0;
  float lz = xz.y + 145.0 - bz * 58.0;
  return (lx > 7.0 && lx < 77.0 && lz > 5.0 && lz < 53.0) ? 0.15 : 0.0;
}
vec3 rainInk() { return mix(vec3(0.17, 0.22, 0.38), vec3(0.72, 0.82, 1.0), uNight); }
`;

const RAIN_VERT = /* glsl */ `
attribute vec4 iDrop; // x, z in the box (0..1), phase, length
uniform float uSpan;
uniform float uHeight;
uniform float uSpeed;
varying float vSide;
varying float vHalfW;
varying float vT;
varying float vFade;
varying float vSeed;
void main() {
  vec2 rel = fract((iDrop.xy * uSpan - cameraPosition.xz) / uSpan + 0.5) - 0.5;
  vec2 xz = cameraPosition.xz + rel * uSpan;
  float fall = fract(iDrop.z + uTime * uSpeed / uHeight);
  vec3 wdir = vec3(uWind.x, 0.0, uWind.y) * uWind.z * 0.45;
  vec3 dir = normalize(vec3(wdir.x, -1.0, wdir.z));
  vec3 P0 = vec3(xz.x, cameraPosition.y + uHeight * 0.55, xz.y) - wdir * uHeight * 0.5;
  vec3 head = P0 + dir * (fall * uHeight / -dir.y);
  float len = (1.0 + 1.3 * iDrop.w) * (0.75 + 0.4 * uRain);
  vec3 tail = head - dir * len;
  vec4 cA = projectionMatrix * viewMatrix * vec4(tail, 1.0);
  vec4 cB = projectionMatrix * viewMatrix * vec4(head, 1.0);
  if (cA.w < 0.15 || cB.w < 0.15 || uRain < 0.01) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec3 W = mix(tail, head, position.x);
  vec4 cP = projectionMatrix * viewMatrix * vec4(W, 1.0);
  vec2 sd = cB.xy / cB.w * uResolution * 0.5 - cA.xy / cA.w * uResolution * 0.5;
  float sl = length(sd);
  vec2 sdir = sl > 1e-4 ? sd / sl : vec2(0.0, 1.0);
  vec2 nrm = vec2(-sdir.y, sdir.x);
  float dist = length((viewMatrix * vec4(W, 1.0)).xyz);
  float wpx = mix(2.4, 1.2, smoothstep(2.0, 20.0, dist)) * uPR;
  float hw = wpx * 0.5 + 0.8;
  cP.xy += nrm * position.y * hw / (uResolution * 0.5) * cP.w;
  gl_Position = cP;
  vSide = position.y * hw;
  vHalfW = wpx * 0.5;
  vT = position.x;
  // the near ones would be big smears; the far edge of the box fades out
  vFade = (1.0 - smoothstep(uSpan * 0.3, uSpan * 0.5, length(rel * uSpan))) * smoothstep(0.8, 3.0, dist);
  vSeed = iDrop.w * 31.0 + iDrop.z * 7.0;
}`;

const RAIN_FRAG = /* glsl */ `
varying float vSide;
varying float vHalfW;
varying float vT;
varying float vFade;
varying float vSeed;
void main() {
  float a = clamp(vHalfW + 0.5 - abs(vSide), 0.0, 1.0);
  a *= smoothstep(0.0, 0.3, vT) * (0.5 + 0.5 * vT);
  a *= 0.7 + 0.3 * n2(gl_FragCoord.xy / uPR * 0.9 + vSeed);
  a *= vFade * uRain * 0.9;
  if (a < 0.01) discard;
  gl_FragColor = vec4(rainInk(), a);
}`;

const SPLASH_VERT = /* glsl */ `
attribute vec4 iSplash; // x, z (0..1), phase, size
uniform float uSpan;
varying vec2 vQ;
varying float vPh;
varying float vFade;
void main() {
  float rate = 1.6;
  float cyc = floor(uTime * rate + iSplash.z);
  vec2 p = fract(iSplash.xy + vec2(hash11(cyc * 1.31 + iSplash.w * 17.0), hash11(cyc * 2.17 + iSplash.z * 9.0)));
  vec2 rel = fract((p * uSpan - cameraPosition.xz) / uSpan + 0.5) - 0.5;
  vec2 xz = cameraPosition.xz + rel * uSpan;
  vPh = fract(uTime * rate + iSplash.z);
  float s = (0.16 + 0.14 * iSplash.w) * (0.7 + 0.4 * uRain);
  vec3 base = vec3(xz.x, groundAt(xz) + 0.01, xz.y);
  vec2 tc = normalize(cameraPosition.xz - xz + vec2(1e-4));
  vec3 right = vec3(tc.y, 0.0, -tc.x);
  vec3 W = base + right * position.x * s + vec3(0.0, position.y * s, 0.0);
  vQ = position.xy;
  vFade = 1.0 - smoothstep(uSpan * 0.3, uSpan * 0.5, length(rel * uSpan));
  gl_Position = uRain < 0.01 || vPh > 0.26 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(W, 1.0);
}`;

const SPLASH_FRAG = /* glsl */ `
varying vec2 vQ;
varying float vPh;
varying float vFade;
float segD(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  float k = vPh / 0.26;
  vec2 p = vQ;
  float w = max(fwidth(p.x), 1e-4);
  float d = 9.0;
  // a crown of drops flying up and out
  for (int i = 0; i < 4; i++) {
    float an = (float(i) - 1.5) * 0.5;
    vec2 dir = vec2(sin(an), cos(an));
    d = min(d, segD(p, dir * (0.12 + 0.4 * k), dir * (0.3 + 0.62 * k)));
  }
  // and a flat ring spreading on the ground
  d = min(d, abs(length(vec2(p.x, p.y * 4.5)) - (0.15 + 0.75 * k)) * 0.45);
  float a = (1.0 - smoothstep(w * 0.7, w * 1.6, d)) * (1.0 - k) * vFade * uRain;
  if (a < 0.03) discard;
  gl_FragColor = vec4(rainInk(), a * 0.85);
}`;

const LEAF_VERT = /* glsl */ `
attribute vec4 iLeaf; // x, z (0..1), seed, kind
uniform float uSpan;
uniform vec2 uWindRun;
varying vec2 vQ;
varying float vKind;
varying float vSeed;
varying float vFade;
varying float vDist;
void main() {
  float sd = iLeaf.z;
  vec2 p = iLeaf.xy * uSpan + uWindRun * (0.55 + 0.9 * hash11(sd * 7.1));
  vec2 side = vec2(-uWind.y, uWind.x);
  p += side * sin(uTime * (1.1 + hash11(sd * 1.7)) + sd * 6.0) * 1.3;
  vec2 rel = fract((p - cameraPosition.xz) / uSpan + 0.5) - 0.5;
  vec2 xz = cameraPosition.xz + rel * uSpan;
  float hop = abs(sin(uTime * (1.3 + 1.6 * hash11(sd * 3.3)) + sd * 11.0));
  float y = groundAt(xz) + 0.06 + hop * (0.25 + 1.7 * uWind.z) * (0.35 + 0.65 * hash11(sd * 5.0));
  float spin = uTime * (2.5 + 4.0 * hash11(sd * 9.0)) * (hash11(sd * 2.9) > 0.5 ? 1.0 : -1.0) + sd * 20.0;
  float size = iLeaf.w < 0.62 ? 0.2 : 0.4;
  vec3 P = vec3(xz.x, y, xz.y);
  vec3 toCam = normalize(cameraPosition - P);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam) + vec3(1e-4, 0.0, 0.0));
  vec3 up = cross(toCam, right);
  // spinning in its plane and flipping over (squashed) so it seems to tumble
  vec2 q = vec2(position.x * (0.25 + 0.75 * abs(cos(spin * 0.63))), position.y);
  float c = cos(spin);
  float s = sin(spin);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y) * size;
  vec3 W = P + right * q.x + up * q.y;
  vQ = position.xy;
  vKind = iLeaf.w;
  vSeed = sd;
  vFade = (1.0 - smoothstep(uSpan * 0.32, uSpan * 0.5, length(rel * uSpan))) * smoothstep(0.25, 0.55, uWind.z);
  vec4 mv = viewMatrix * vec4(W, 1.0);
  vDist = length(mv.xyz);
  gl_Position = vFade < 0.01 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * mv;
}`;

const LEAF_FRAG = /* glsl */ `
varying vec2 vQ;
varying float vKind;
varying float vSeed;
varying float vFade;
varying float vDist;
void main() {
  vec2 p = vQ;
  float w = max(fwidth(p.x), 1e-4) * 1.2;
  vec3 ink = mix(vec3(0.12, 0.13, 0.2), vec3(0.85, 0.88, 1.0), uNight);
  vec3 col;
  float inside;
  float line;
  if (vKind < 0.62) {
    // a leaf: pointed oval in autumn colours, a rib down the middle
    float d = length(vec2(p.x * 1.7, p.y)) - 0.9 + 0.25 * abs(p.y);
    inside = 1.0 - smoothstep(-w, w, d);
    line = 1.0 - smoothstep(w * 0.6, w * 1.6, abs(d));
    line = max(line, (1.0 - smoothstep(w * 0.4, w * 1.2, abs(p.x))) * step(abs(p.y), 0.85) * 0.8);
    float h = fract(vSeed * 3.7);
    col = h < 0.3 ? vec3(0.9, 0.55, 0.2) : h < 0.55 ? vec3(0.86, 0.7, 0.26) : h < 0.8 ? vec3(0.78, 0.3, 0.2) : vec3(0.58, 0.4, 0.22);
  } else {
    // a page torn from a notebook or a newspaper: lines of writing on it
    vec2 b = abs(p) - vec2(0.72, 0.9);
    float d = max(b.x, b.y) + 0.06 * n2(p * 3.0 + vSeed * 9.0);
    inside = 1.0 - smoothstep(-w, w, d);
    line = 1.0 - smoothstep(w * 0.6, w * 1.6, abs(d));
    float rows = abs(fract(p.y * 3.2 + 0.5) - 0.5) / 3.2;
    float txt = (1.0 - smoothstep(w * 0.3, w * 1.1, rows)) * step(abs(p.x), 0.55) * step(abs(p.y), 0.75);
    txt *= step(0.3, n2(vec2(p.x * 6.0, floor(p.y * 3.2) + vSeed * 13.0)));
    col = mix(vec3(0.97, 0.96, 0.92), fract(vSeed * 5.3) < 0.5 ? vec3(0.62, 0.74, 0.9) : ink, txt * 0.7);
  }
  if (inside < 0.5 && line < 0.5) discard;
  col = mix(col, col * 0.12 + uSkyPaper * 1.3, uNight * 0.9);
  col = mix(col, ink, line * mix(0.9, 0.6, uNight));
  col = mix(col, paperAt(gl_FragCoord.xy), fogFactor(vDist));
  gl_FragColor = vec4(col, 1.0);
}`;

const quad = (x0, x1, y0, y1) => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

const randAttr = (n, fill) => {
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) fill(a, i * 4);
  return new THREE.InstancedBufferAttribute(a, 4);
};

export class Weather {
  constructor(game) {
    this.game = game;
    this.kind = 'clear';
    this.mode = 'auto';
    this.left = 140; // seconds of this weather left
    this.cur = { over: 0, rain: 0, mist: 0, wind: 0.15 };
    this.wet = 0;
    this.rainbow = 0;
    this.windDir = new THREE.Vector2(0.86, 0.5).normalize();
    this.windAng = Math.atan2(0.5, 0.86);
    this.gust = 0;
    this.run = new THREE.Vector2();
    this.flash = 0;
    this.bolt = null;
    this.boltT = 6;
    this.thunderAt = -1;
    this.wasOn = false;
    const scene = game.scene;
    const mk = (vert, frag, uniforms, o = {}) =>
      new THREE.ShaderMaterial({
        uniforms: { ...shared, ...uniforms },
        vertexShader: COMMON + GROUND + vert,
        fragmentShader: COMMON + GROUND + frag,
        ...o,
      });
    // rain: a strip per drop (along 0..1, side -1..1)
    const rg = quad(0, 1, -1, 1);
    rg.setAttribute('iDrop', randAttr(RAIN_N, (a, o) => a.set([Math.random(), Math.random(), Math.random(), Math.random()], o)));
    rg.instanceCount = RAIN_N;
    this.rain = new THREE.Mesh(rg, mk(RAIN_VERT, RAIN_FRAG, { uSpan: { value: 38 }, uHeight: { value: 22 }, uSpeed: { value: 15 } }, { transparent: true, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 30;
    scene.add(this.rain);
    // splashes: little cards standing on the ground
    const sg = quad(-1, 1, -0.3, 1);
    sg.setAttribute('iSplash', randAttr(SPLASH_N, (a, o) => a.set([Math.random(), Math.random(), Math.random(), Math.random()], o)));
    sg.instanceCount = SPLASH_N;
    this.splash = new THREE.Mesh(sg, mk(SPLASH_VERT, SPLASH_FRAG, { uSpan: { value: 30 } }, { transparent: true, depthWrite: false }));
    this.splash.frustumCulled = false;
    this.splash.renderOrder = 29;
    scene.add(this.splash);
    // leaves and pages in the wind
    const lg = quad(-1, 1, -1, 1);
    lg.setAttribute('iLeaf', randAttr(LEAF_N, (a, o) => a.set([Math.random(), Math.random(), Math.random() * 100, Math.random()], o)));
    lg.instanceCount = LEAF_N;
    this.leafMat = mk(LEAF_VERT, LEAF_FRAG, { uSpan: { value: 46 }, uWindRun: { value: this.run } }, { side: THREE.DoubleSide });
    this.leaves = new THREE.Mesh(lg, this.leafMat);
    this.leaves.frustumCulled = false;
    this.leaves.renderOrder = 12;
    scene.add(this.leaves);
    this.setVisible(false);
  }

  setVisible(v) {
    this.rain.visible = v;
    this.splash.visible = v;
    this.leaves.visible = v;
  }

  // the pause menu: let the sky decide, or keep one weather
  setMode(mode) {
    this.mode = mode;
    if (mode !== 'auto' && KINDS[mode]) this.go(mode, true);
    else this.left = Math.min(this.left, 30);
  }

  // jump straight to the target weather (tests, the menu at the start)
  snap() {
    const K = KINDS[this.kind];
    Object.assign(this.cur, { over: K.over, rain: K.rain, mist: K.mist, wind: K.wind });
    this.wet = K.rain > 0 ? 1 : 0;
    this.rainbow = this.kind === 'rainbow' ? 1 : 0;
    if (this.windAngTo !== undefined) this.windAng = this.windAngTo;
  }

  go(kind, quiet = false) {
    if (this.kind === kind) return;
    this.kind = kind;
    const d = KINDS[kind].dur;
    this.left = d[0] + Math.random() * (d[1] - d[0]);
    // a new wind for the new weather
    if (kind !== 'rainbow') this.windAngTo = Math.random() * Math.PI * 2;
    const game = this.game;
    if (!quiet && game.state === 'play' && !game.inBar) game.hud.toast(SAY[kind], 'info', 2.4);
  }

  pickNext() {
    const opts = NEXT[this.kind];
    let sum = 0;
    for (const o of opts) sum += o[1];
    let r = Math.random() * sum;
    for (const o of opts) {
      r -= o[1];
      if (r <= 0) return o[0];
    }
    return opts[0][0];
  }

  // a bolt of lightning somewhere in front of you, the thunder after it
  strike() {
    const game = this.game;
    const cam = game.camera;
    const f = cam.getWorldDirection(new THREE.Vector3());
    const az = Math.atan2(f.z, f.x) + (Math.random() - 0.5) * 1.4;
    const d = 120 + Math.random() * 80;
    let x = cam.position.x + Math.cos(az) * d;
    let z = cam.position.z + Math.sin(az) * d;
    let y = 150 + Math.random() * 30;
    const segs = [];
    const branch = (x0, y0, z0, n, w) => {
      let px = x0;
      let py = y0;
      let pz = z0;
      for (let i = 0; i < n && py > 0; i++) {
        const nx = px + (Math.random() - 0.5) * 14;
        const nz = pz + (Math.random() - 0.5) * 14;
        const ny = py - 9 - Math.random() * 9;
        segs.push([px, py, pz, nx, Math.max(0, ny), nz, w]);
        px = nx;
        py = ny;
        pz = nz;
      }
    };
    let px = x;
    let pz = z;
    while (y > 0) {
      const nx = px + (Math.random() - 0.5) * 16;
      const nz = pz + (Math.random() - 0.5) * 16;
      const ny = y - 8 - Math.random() * 10;
      segs.push([px, y, pz, nx, Math.max(0, ny), nz, 5.5]);
      if (Math.random() < 0.28 && y > 40) branch(nx, ny, nz, 2 + Math.floor(Math.random() * 4), 2.6);
      px = nx;
      pz = nz;
      y = ny;
    }
    this.bolt = { segs, t: 0 };
    this.flash = 1;
    this.thunderAt = game.time + d / 340 + 0.15;
    this.thunderVol = 1 - (d - 120) / 160;
  }

  update(dt) {
    const game = this.game;
    const dn = game.daynight;
    const on = dn.on && !game.inBar;
    if (!on) {
      if (this.wasOn) {
        // back to the plain page: no weather at all
        shared.uOvercast.value = 0;
        shared.uRain.value = 0;
        shared.uWet.value = 0;
        shared.uMist.value = 0;
        shared.uRainbow.value = 0;
        shared.uLightning.value = 0;
        shared.uWind.value.set(1, 0, 0);
        shared.uFogNear.value = 150;
        shared.uFogFar.value = 560;
        this.setVisible(false);
        game.audio.weather(0, 0);
        this.wasOn = false;
      }
      return;
    }
    this.wasOn = true;
    this.setVisible(true);
    // the sky changes its mind now and then
    if (this.mode === 'auto') {
      this.left -= dt;
      if (this.left <= 0) this.go(this.pickNext());
    }
    const K = KINDS[this.kind];
    const k = 1 - Math.exp(-dt / 6);
    const c = this.cur;
    c.over += (K.over - c.over) * k;
    c.rain += (K.rain - c.rain) * (1 - Math.exp(-dt / 4));
    c.mist += (K.mist - c.mist) * k;
    c.wind += (K.wind - c.wind) * k;
    // gusts
    this.gust += ((Math.sin(game.time * 0.37) * 0.5 + Math.sin(game.time * 1.13) * 0.3) * 0.25 - this.gust) * Math.min(1, dt * 2);
    const wind = Math.max(0, Math.min(1.2, c.wind + this.gust * c.wind));
    if (this.windAngTo !== undefined) {
      let da = this.windAngTo - this.windAng;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.windAng += da * Math.min(1, dt * 0.08);
    }
    this.windDir.set(Math.cos(this.windAng), Math.sin(this.windAng));
    this.run.x += this.windDir.x * wind * 7 * dt;
    this.run.y += this.windDir.y * wind * 7 * dt;
    // puddles fill while it rains and dry slowly after
    if (c.rain > 0.2) this.wet = Math.min(1, this.wet + dt * c.rain / 22);
    else this.wet = Math.max(0, this.wet - dt / 70);
    const wantBow = this.kind === 'rainbow' ? 1 - dn.night : 0;
    this.rainbow += (wantBow - this.rainbow) * (1 - Math.exp(-dt / 5));
    // lightning in a storm
    if (this.kind === 'storm' && c.rain > 0.6) {
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.strike();
        this.boltT = 4 + Math.random() * 8;
      }
    }
    if (this.thunderAt > 0 && game.time >= this.thunderAt) {
      game.audio.thunder(this.thunderVol);
      this.thunderAt = -1;
    }
    let fl = 0;
    if (this.bolt) {
      const b = this.bolt;
      b.t += dt;
      // the bolt flickers on and off a couple of times
      b.vis = b.t < 0.09 || (b.t > 0.15 && b.t < 0.24) || (b.t > 0.3 && b.t < 0.4);
      if (b.vis) fl = 1;
      if (b.t > 0.45) this.bolt = null;
    }
    this.flash = Math.max(fl * 0.85, this.flash * Math.exp(-dt * 7));
    // the numbers the shaders read
    shared.uOvercast.value = c.over;
    shared.uRain.value = c.rain;
    shared.uWet.value = this.wet;
    shared.uMist.value = c.mist;
    shared.uRainbow.value = this.rainbow;
    shared.uLightning.value = this.flash;
    shared.uWind.value.set(this.windDir.x, this.windDir.y, wind);
    // the page fogs over: drawn things fade much closer in the mist and the rain
    const near = 150 - c.mist * 142 - c.rain * 60;
    const far = 560 - c.mist * 470 - c.rain * 210;
    shared.uFogNear.value = Math.max(6, near);
    shared.uFogFar.value = Math.max(near + 70, far);
    game.audio.weather(c.rain, wind);
  }

  // the lightning goes into the frame's dynamic ink
  draw(fr) {
    const b = this.bolt;
    if (!b || !b.vis || !this.wasOn) return;
    for (const s of b.segs) {
      fr.lineXYZ(s[0], s[1], s[2], s[3], s[4], s[5], [0.72, 0.82, 1.0], s[6] * 2.6, 3.1, 0.35, 0.01, 0.4);
      fr.lineXYZ(s[0], s[1], s[2], s[3], s[4], s[5], [1.0, 0.98, 0.84], s[6], 7.7, 1, 0.01, 0.4);
    }
  }
}
