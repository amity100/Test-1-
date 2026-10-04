import * as THREE from 'three';
import type { ViewSpec } from '../../core/Engine';
import type { ShotFrame } from '../../gameplay/CameraRig';
import type { FilmFocus, FilmSetBuildContext, FilmSetHandle } from '../FilmStage';
import { INTRO_SHOTS } from '../../content/introScript';

/*
 * THE MACRO SET (cut7, CUT v6) — the cold open C0: "a man's fist (no face) closes on dark wool at the corner of a
 * mantle (its tzitzit); the pull; the weave stretches and the threads snap one by one along the weft; the last thread
 * at `snap` — and the smash to black" (docs/intro-script-v6.md). The film's FIRST set: built in a fraction of a second
 * (no Gilgal, no crowd, no land), so the film can start at once.
 *
 * What is in it (all at a macro distance, ~30 cm from the lens, a 15-20 cm wide frame):
 *  - the corner of Samuel's me'il (dressSamuel: dark undyed wool #6a5a4a, a dark and a light woven band above the hem,
 *    tzitzit with one tekhelet thread at the corner — Num 15:38): two pieces of a procedural PLAIN WEAVE (warp and weft
 *    threads ~1.6 mm apart, hand-spun unevenness, fibre streaks, the bands in the weft), split along one weft row (wool
 *    tears along the weave — the same corner and tear as G5b, src/characters/wardrobe/tear.ts); the weave opens under
 *    strain and the low sun shines through it from behind (backlight through the weave);
 *  - the warp threads crossing the tear line: each stretches across the opening, glows in the backlight and snaps when
 *    the opening passes its limit, the two ends recoiling and curling, frayed fibres at the ends — one by one along the
 *    line, the last (in the plane of focus) exactly at `snap`;
 *  - Saul's right fist (HumanModel 'saul' — the same hand as G5b; only the forearm and the hand are kept, hideSkin): it
 *    closes on the wool at `grip`, pulls from `pull`, and jerks the corner away after `snap`. Saul's costume has short
 *    crimson sleeves and a bare forearm (dressSaulGilgal), so no sleeve is in the frame;
 *  - a warm out-of-focus ground (the road at Gilgal in the late sun: a soft painted backdrop, intrinsically defocused so
 *    tiers without depth of field show it the same) and dust motes drifting in the backlight.
 * Every motion is a closed-form function of shot time (seek-safe, frame-rate independent); the action is the contract's
 * slow motion (slowmo 0.25: a high-speed camera), the lens moves in real time.
 */

const shot = INTRO_SHOTS.find((s) => s.take === 'tear:macro');
const B = { grip: 0.8, pull: 1.8, rip: 2.7, snap: 4.2, ...(shot?.beats ?? {}) };
const DUR = shot?.dur ?? 5;

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ------------------------------------------------------------------------------------------------ layout (metres)
/** material coordinates: a along the weft (+ = toward the side slit / Saul), b along the warp (+ = up; the tear at 0) */
const SLIT = 0.105; // the side opening's edge (the cloth ends here)
const LEFT = -0.3;
const TOP = 0.2;
const HEM = -0.13;
/** thread pitch of the heavy me'il wool (~1.8 mm hand-spun yarn and the gap between) */
const PITCH = 0.0022;
/** the tear's stepped line: one weft row, jumping a row here and there (b of the line at a) */
const lineB = (a: number) => PITCH * Math.round(1.2 * Math.sin(a * 23 + 0.6) + 0.7 * Math.sin(a * 61 + 2.1));
/** the cloth's frame in the set: tilted so the tear runs down toward Saul's fist (frame right) */
const TILT = -0.2;
const AX = new THREE.Vector3(Math.cos(TILT), Math.sin(TILT), 0);
const AY = new THREE.Vector3(-Math.sin(TILT), Math.cos(TILT), 0);
const AZ = new THREE.Vector3(0, 0, 1);
/** the hang of the heavy wool: long vertical folds (warp-wise) and a slow wave */
const drape = (a: number, b: number) => 0.0065 * Math.sin(a * 36 + 0.7) * (0.65 + 0.35 * Math.sin(b * 8 + 1.3)) + 0.0025 * Math.sin(a * 95 + b * 14);
/** where the fist takes the corner (material) */
const GRIP = new THREE.Vector2(0.068, -0.058);
/** the corner's hole of the tzitzit (material) */
const CORNER = new THREE.Vector2(0.099, -0.127);
/** the direction of the pull (set space): toward Saul — right, down, toward the lens */
const PULL = new THREE.Vector3(0.62, -0.42, 0.66).normalize();

const set3 = (o: THREE.Vector3, a: number, b: number, z: number) =>
  o.set(AX.x * a + AY.x * b + AZ.x * z, AX.y * a + AY.y * b + AZ.y * z, AX.z * a + AY.z * b + AZ.z * z);

// ------------------------------------------------------------------------------------------------ the action
/** the fist's closing 0..1 */
const closure = (t: number) => ss(B.grip - 0.5, B.grip + 0.35, t);
/** the pull's tension before the tear 0..1 */
const tension = (t: number) => ss(B.grip + 0.2, B.pull + 0.5, t);
/** how far the fist has pulled the corner (m) */
function pullDist(t: number) {
  return 0.0035 * tension(t) + 0.004 * ss(B.pull, B.rip, t) + 0.034 * Math.pow(ss(B.rip, B.snap, t), 1.25) + 0.16 * Math.pow(ss(B.snap, B.snap + 0.85, t), 1.6);
}

interface Thread {
  a: number;
  /** shot time it snaps */
  t: number;
  /** recoil curl direction / amount, fibre seeds */
  curl: number;
  len: number;
  seed: number;
  hero: boolean;
}

/** the warp threads crossing the tear line inside (and a little beyond) the frame, and when each one snaps */
function makeThreads(): Thread[] {
  const out: Thread[] = [];
  const a0 = -0.16, a1 = SLIT - 0.002;
  const step = PITCH * 1.6;
  const n = Math.floor((a1 - a0) / step);
  // the hero: in the plane of focus left of the frame's centre, the last to go (exactly at `snap`)
  const heroA = -0.045;
  for (let i = 0; i <= n; i++) {
    const a = a1 - i * step;
    const k = (a1 - a) / (a1 - a0); // 0 at the slit .. 1 at the left
    const r = hash(i * 1.37 + 0.5);
    // the tear front travels from the slit leftward; each thread holds a little longer or shorter (its own strength):
    // a ragged front with some long threads still spanning the opening
    let t = B.rip + 0.05 + k * (B.snap - B.rip - 0.32) + (r - 0.35) * 0.34 + (r > 0.9 ? 0.3 : 0);
    const hero = Math.abs(a - heroA) < step * 0.5;
    if (hero) t = B.snap;
    else t = Math.min(t, B.snap - 0.04 - 0.02 * hash(i * 3.1));
    out.push({ a, t, curl: (hash(i * 7.7) - 0.5) * 2, len: 0.35 + 0.3 * hash(i * 5.3), seed: hash(i * 11.9), hero });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ materials
const WEAVE_PARS = /* glsl */ `
uniform float uPitch;
uniform vec3 uWarp, uWeft, uBandDark, uBandLight, uTrans;
uniform float uHem, uTransmit;
varying vec2 vMat;
varying float vStrain;
float mh1(float n){ return fract(sin(n * 127.1 + 1.7) * 43758.5453); }
float mh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mh2(i), mh2(i + vec2(1.0, 0.0)), f.x), mix(mh2(i + vec2(0.0, 1.0)), mh2(i + vec2(1.0, 1.0)), f.x), f.y); }
// a plain (tabby) weave of hand-spun wool: returns the height of the visible thread, its colour, the gap between threads
void weave(vec2 m, float strain, out float h, out vec3 col, out float gap, out float rim){
  vec2 q = m / uPitch;
  vec2 ci = floor(q);
  vec2 f = fract(q) - 0.5;
  // hand-spun: every thread its own thickness and tone; fibre streaks along it
  // hand-spun yarn: thick and thin along its length (slubs), wandering a little off its line
  float slubW = mvn(vec2(ci.x * 3.1, q.y * 0.45)), slubF = mvn(vec2(q.x * 0.45, ci.y * 3.1 + 40.0));
  float wwid = 0.47 - 0.14 * strain + 0.1 * (slubW - 0.5) + 0.04 * (mh1(ci.x) - 0.5);
  float fwid = 0.47 - 0.14 * strain + 0.1 * (slubF - 0.5) + 0.04 * (mh1(ci.y + 71.0) - 0.5);
  float fibW = mvn(vec2(q.x * 7.0, q.y * 0.9));
  float fibF = mvn(vec2(q.x * 0.9 + 17.0, q.y * 7.0));
  float wanderW = 0.12 * (mvn(vec2(ci.x * 1.7 + 3.0, q.y * 0.21)) - 0.5);
  float wanderF = 0.12 * (mvn(vec2(q.x * 0.21, ci.y * 1.7 + 9.0)) - 0.5);
  float dx = abs(f.x - wanderW) + 0.07 * (fibW - 0.5);
  float dy = abs(f.y - wanderF) + 0.07 * (fibF - 0.5);
  float inW = smoothstep(wwid, wwid - 0.09, dx);
  float inF = smoothstep(fwid, fwid - 0.09, dy);
  float sgn = mod(ci.x + ci.y, 2.0) * 2.0 - 1.0; // +1: the warp over the weft at this crossing
  float pw = sqrt(max(0.0, 1.0 - (dx / wwid) * (dx / wwid)));
  float pf = sqrt(max(0.0, 1.0 - (dy / fwid) * (dy / fwid)));
  float hw = inW * pw * (0.55 + 0.45 * sgn * cos(6.2832 * f.y));
  float hf = inF * pf * (0.55 - 0.45 * sgn * cos(6.2832 * f.x));
  h = max(hw, hf) + 0.08 * (fibW + fibF);
  // the bands are woven in the weft (dyed weft rows) above the hem
  float bb = m.y - uHem;
  vec3 weftC = uWeft;
  float rowB = (ci.y + 0.5) * uPitch - uHem;
  if (rowB > 0.05 && rowB < 0.075) weftC = uBandDark;
  else if (rowB > 0.08 && rowB < 0.088) weftC = uBandLight;
  vec3 warpC = uWarp * (0.82 + 0.36 * mh1(ci.x * 1.3 + 5.0));
  weftC *= 0.84 + 0.32 * mh1(ci.y * 1.7 + 9.0);
  float onW = step(hf, hw);
  col = mix(weftC * (0.8 + 0.4 * fibF), warpC * (0.8 + 0.4 * fibW), onW);
  // crevices darker
  col *= 0.6 + 0.4 * smoothstep(0.0, 0.7, max(hw, hf));
  // the felted wool closes many of the gaps (more of them open as the weave is pulled)
  // (and the felting is uneven: denser patches, a few wider gaps)
  float felt = mvn(m * 38.0) * 0.6 + mvn(m * 9.0) * 0.4;
  gap = (1.0 - inW) * (1.0 - inF) * max(step(0.45 + 0.35 * felt, mh2(ci + 3.3)) * (0.35 + 0.65 * mh2(ci * 1.31 + 7.0)), smoothstep(0.15, 0.6, strain));
  // the yarns' fuzzy rims (they catch the backlight)
  rim = (1.0 - smoothstep(0.0, 0.35, max(hw, hf))) * max(inW, inF);
  // a rolled hem: the last 4 mm denser and a shade darker
  col *= mix(0.78, 1.0, smoothstep(0.0, 0.004, bb));
}
`;

/** the me'il's wool at macro scale: MeshPhysicalMaterial (sheen = the wool's fuzz) + a procedural weave + light through it */
function weaveMaterial(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.55, 0.45, 0.36), side: THREE.DoubleSide });
  const lin = (hex: number) => new THREE.Color(hex);
  const u = {
    uPitch: { value: PITCH },
    // dressSamuel: the me'il DARK #6a5a4a; its bands #4e4236 / #8a7a60; the weft a shade lighter than the warp
    uWarp: { value: lin(0x5e4f41) },
    uWeft: { value: lin(0x6f604f) },
    uBandDark: { value: lin(0x3e342b) },
    uBandLight: { value: lin(0x8a7a60) },
    uTrans: { value: new THREE.Color(1.0, 0.62, 0.34) },
    uHem: { value: HEM },
    uTransmit: { value: 0.9 },
  };
  m.userData.weave = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aMat;\nattribute float aStrain;\nvarying vec2 vMat;\nvarying float vStrain;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;\nvStrain = aStrain;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + WEAVE_PARS)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wH; vec3 wCol; float wGap; float wRim;
        weave(vMat, vStrain, wH, wCol, wGap, wRim);
        diffuseColor.rgb = wCol;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // the yarns' relief (surface-gradient bump of the weave's height: ~0.45 mm)
          float bh = wH * 0.00045;
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          vec3 grad = sign(det) * (dFdx(bh) * r1 + dFdy(bh) * r2);
          normal = normalize(abs(det) * normal - grad);
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
        {
          // backlight through the weave: the low sun behind the cloth shines through the gaps between the yarns (more as
          // the weave opens under strain) and glows through the thin wool itself; strongest along the view line
          vec3 Ld = directionalLights[0].direction;
          float behind = max(0.0, -dot(geometryNormal, Ld));
          float along = pow(max(0.0, dot(-geometryViewDir, Ld)), 3.0);
          // heavy wool: the yarns themselves pass little light (their fuzzy rims a little); the gaps pass it
          float thin = 0.02 + wGap * (0.2 + 2.6 * vStrain) + 0.08 * wRim;
          reflectedLight.directDiffuse += directionalLights[0].color * uTrans * uTransmit * thin * (0.3 * behind + 1.4 * along * behind + 0.35 * along);
        }
        #endif`);
  };
  m.customProgramCacheKey = () => 'macroWeave1';
  return m;
}

/** threads, frayed fibres and the tzitzit: camera-facing ribbons, lit from behind (they glow) */
function threadMaterial(sunDir: THREE.Vector3, sunCol: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'MacroThread',
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: { uSunDir: { value: sunDir }, uSunCol: { value: sunCol }, uAmb: { value: new THREE.Color(0.2, 0.16, 0.12) } },
    vertexShader: /* glsl */ `
      attribute vec3 color; attribute vec2 aRib; varying vec3 vCol; varying vec2 vRib; varying vec3 vW;
      void main(){ vCol = color; vRib = aRib; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunCol, uAmb; varying vec3 vCol; varying vec2 vRib; varying vec3 vW;
      float h1(float n){ return fract(sin(n * 91.7) * 43758.5453); }
      void main(){
        // across the ribbon: a round yarn (soft edge, a few stray fibres); along it: the twist of the spun yarn
        float x = vRib.x;
        float fib = 0.5 + 0.5 * sin(vRib.y * 2600.0 + x * 9.0);
        float a = smoothstep(1.0, 0.55, abs(x)) * (0.75 + 0.25 * fib);
        if (a < 0.02) discard;
        vec3 V = normalize(cameraPosition - vW);
        float along = pow(max(0.0, dot(-V, normalize(uSunDir))), 2.5);
        float core = 1.0 - abs(x);
        float halo = pow(abs(x), 1.5);
        // a dark wool core; the fibres at its edges light up against the sun (the halo of backlit wool)
        vec3 c = vCol * (uAmb + 0.3 * uSunCol * core) + uSunCol * along * (0.08 + 1.5 * halo) * vec3(1.0, 0.7, 0.42) * (0.45 + 0.55 * fib);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** the warm out-of-focus ground and low sun behind the cloth (painted soft: every tier shows it defocused) */
function backdropTexture(): THREE.Texture {
  const W = 512, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  // haze above, the sunlit road below, the sun's glow upper left (behind the cloth)
  const lin = g.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, '#d9b98a');
  lin.addColorStop(0.42, '#e6c48e');
  lin.addColorStop(0.55, '#b7915f');
  lin.addColorStop(1, '#6e5236');
  g.fillStyle = lin;
  g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.3, H * 0.3, W * 0.55);
  sun.addColorStop(0, 'rgba(255,236,196,0.95)');
  sun.addColorStop(0.25, 'rgba(255,214,150,0.55)');
  sun.addColorStop(1, 'rgba(255,200,140,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, W, H);
  // soft bokeh: sunlit dust and the glints of the ground far out of focus
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = H * (0.25 + 0.7 * rnd()), r = 8 + rnd() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const al = 0.08 + 0.18 * rnd();
    gr.addColorStop(0, `rgba(255,232,190,${al})`);
    gr.addColorStop(0.75, `rgba(255,226,180,${al * 0.8})`);
    gr.addColorStop(1, 'rgba(255,220,170,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

// ------------------------------------------------------------------------------------------------ the set
export interface MacroSetStats {
  buildMs: number;
  handMs: number;
  triangles: number;
}

export async function createMacroSet(c: FilmSetBuildContext): Promise<FilmSetHandle> {
  const t0 = performance.now();
  const engine = c.engine;
  const q = engine.quality;
  const mobile = q.mobile;
  const scene = new THREE.Scene();
  scene.name = 'film:macro';
  scene.background = new THREE.Color(0x3a2a1c);
  const camera = new THREE.PerspectiveCamera(18, 16 / 9, 0.02, 30);
  const disposables: { dispose(): void }[] = [];

  // ---- light: the low sun BEHIND the cloth (upper left, toward the lens), a warm bounce from the sunlit road in front
  const sunDir = new THREE.Vector3(-0.42, 0.34, -0.84).normalize(); // toward the sun
  const sunCol = new THREE.Color(1.0, 0.8, 0.58);
  const sun = new THREE.DirectionalLight(sunCol, 3.4);
  sun.position.copy(sunDir).multiplyScalar(2);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -0.32;
  sc.right = 0.32;
  sc.top = 0.32;
  sc.bottom = -0.32;
  sc.near = 0.5;
  sc.far = 3.5;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xd8c3a2, 0x6b4c30, 0.35);
  scene.add(hemi);
  // the sunlit road bouncing warm light up into the fist and the front of the wool (a reflector's fill)
  const bounce = new THREE.DirectionalLight(0xffbf86, 2.1);
  bounce.position.set(-0.3, -0.45, 1.0);
  scene.add(bounce);
  // a kicker from behind (the sun's side, unshadowed): the rim along the knuckles and the forearm's top edge
  const kick = new THREE.DirectionalLight(0xffd8a8, 3.0);
  kick.position.set(-0.55, 0.6, -0.45);
  scene.add(kick);
  await c.yieldFrame();

  // ---- the backdrop: a soft painted plane far behind the cloth (the road and the sun's glow, out of focus)
  const bdTex = backdropTexture();
  const bdMat = new THREE.MeshBasicMaterial({ map: bdTex, color: new THREE.Color(1.5, 1.3, 1.1), toneMapped: true, fog: false });
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), bdMat);
  bd.position.set(-0.4, 0.1, -2.2);
  scene.add(bd);
  disposables.push(bdTex, bdMat, bd.geometry);

  // ---- the cloth: two pieces of one weave meeting along the tear line
  const weaveMat = weaveMaterial();
  disposables.push(weaveMat);
  const mkPiece = (upper: boolean) => {
    const cols = 112, rows = upper ? 46 : 36;
    const n = (cols + 1) * (rows + 1);
    const pos = new Float32Array(n * 3), mat = new Float32Array(n * 2), strain = new Float32Array(n);
    const idx: number[] = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const a = LEFT + ((SLIT - LEFT) * i) / cols;
        const l = lineB(a);
        const f = j / rows;
        // rows packed toward the tear line (where the camera looks and the cloth bends)
        const ff = upper ? Math.pow(f, 1.6) : Math.pow(f, 1.5);
        const b = upper ? l + (TOP - l) * ff : l - (l - HEM) * ff;
        const k = j * (cols + 1) + i;
        mat[k * 2] = a;
        mat[k * 2 + 1] = b;
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i, b = a + 1, c2 = a + cols + 1, d = c2 + 1;
        if (upper) idx.push(a, b, d, a, d, c2);
        else idx.push(a, d, b, a, c2, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aMat', new THREE.BufferAttribute(mat, 2));
    g.setAttribute('aStrain', new THREE.BufferAttribute(strain, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, weaveMat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.name = upper ? 'macro:meil' : 'macro:corner';
    scene.add(m);
    disposables.push(g);
    return { mesh: m, geo: g, pos, mat, strain, cols, rows };
  };
  const upperP = mkPiece(true);
  const lowerP = mkPiece(false);
  c.progress(0.15);
  await c.yieldFrame();

  // ---- threads, frayed fibres, tzitzit, lint: one dynamic ribbon mesh
  const threads = makeThreads();
  const thrMat = threadMaterial(sunDir, sunCol);
  disposables.push(thrMat);
  const SEG = 10; // points per strand
  const TZ = 8; // tzitzit strands (4 doubled), one of them tekhelet
  const TZSEG = 18;
  const FIB = 3; // frayed fibres per snapped end
  // the wool's fuzz: loose fibres standing off the surface near the lens' focus and along the torn edges (they catch the
  // backlight — the halo of wool at macro scale); anchored at material points, they move with the cloth
  const FUZZ_EDGE = mobile ? 220 : 520, FUZZ_SURF = mobile ? 260 : 640;
  const fuzz: { a: number; b: number; edge: number; len: number; dx: number; dy: number; dz: number; curl: number }[] = [];
  for (let i = 0; i < FUZZ_EDGE + FUZZ_SURF; i++) {
    const r = (k: number) => hash(i * 3.17 + k * 11.3 + 0.7);
    const edge = i < FUZZ_EDGE ? (r(1) < 0.5 ? 1 : -1) : 0;
    const a = edge ? -0.16 + (SLIT - 0.002 + 0.16) * r(2) : -0.16 + 0.27 * r(2);
    const b = edge ? 0 : -0.1 + 0.17 * r(3);
    fuzz.push({ a, b, edge, len: edge ? 0.0018 + 0.004 * r(4) : 0.0012 + 0.003 * r(4) * r(4), dx: r(5) - 0.5, dy: r(6) - 0.5, dz: 0.4 + r(7), curl: (r(8) - 0.5) * 2 });
  }
  const strandsMax = threads.length * 2 + threads.length * 2 * FIB + TZ + fuzz.length;
  const vMax = strandsMax * TZSEG * 2;
  const rPos = new Float32Array(vMax * 3), rCol = new Float32Array(vMax * 3), rRib = new Float32Array(vMax * 2);
  const rIdx = new Uint32Array(strandsMax * (TZSEG - 1) * 6);
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3).setUsage(THREE.DynamicDrawUsage));
  rGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3).setUsage(THREE.DynamicDrawUsage));
  rGeo.setAttribute('aRib', new THREE.BufferAttribute(rRib, 2).setUsage(THREE.DynamicDrawUsage));
  rGeo.setIndex(new THREE.BufferAttribute(rIdx, 1).setUsage(THREE.DynamicDrawUsage));
  const ribbons = new THREE.Mesh(rGeo, thrMat);
  ribbons.frustumCulled = false;
  ribbons.renderOrder = 2;
  ribbons.name = 'macro:threads';
  scene.add(ribbons);
  disposables.push(rGeo);

  // ---- dust motes in the backlight (soft discs: their size grows with the distance from the plane of focus)
  const MOTES = mobile ? 40 : 90;
  const mPos = new Float32Array(MOTES * 3), mSeed = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    mPos[i * 3] = -0.35 + 0.6 * hash(i * 2.1);
    mPos[i * 3 + 1] = -0.2 + 0.4 * hash(i * 3.7);
    mPos[i * 3 + 2] = -0.5 + 0.75 * hash(i * 5.9);
    mSeed[i] = hash(i * 9.3);
  }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeo.setAttribute('aSeed', new THREE.BufferAttribute(mSeed, 1));
  const mMat = new THREE.ShaderMaterial({
    name: 'MacroMotes',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFocus: { value: 0.3 }, uScale: { value: 400 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uFocus, uScale; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime * 0.11 + aSeed * 30.0) * 0.012, uTime * (0.002 + 0.004 * aSeed), cos(uTime * 0.09 + aSeed * 17.0) * 0.01);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float z = -mv.z;
        float defocus = abs(z - uFocus) / max(z, 0.05);
        float size = (0.00035 + 0.012 * defocus) * uScale / z;
        gl_PointSize = clamp(size, 1.5, 90.0);
        vA = (0.5 + 0.5 * aSeed) * clamp(2.5 / max(gl_PointSize, 1.0), 0.03, 0.9);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
        float a = vA * smoothstep(1.0, 0.75, r) * (0.75 + 0.25 * smoothstep(0.6, 0.95, r));
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a * 1.6, a); }`,
  });
  const motes = new THREE.Points(mGeo, mMat);
  motes.frustumCulled = false;
  motes.renderOrder = 3;
  scene.add(motes);
  disposables.push(mGeo, mMat);
  c.progress(0.3);
  await c.yieldFrame();

  // ---- Saul's right fist (the forearm and the hand of the 'saul' preset; the rest of the body is not drawn)
  let hand: import('../../characters/human/HumanModel').HumanModel | null = null;
  const th0 = performance.now();
  if (c.cast) {
    try {
      const { HumanModel } = await import('../../characters/human/HumanModel');
      hand = await HumanModel.load({ preset: 'saul', quality: q.name, ...(mobile ? { textureSize: 1024 as const } : {}) });
      hand.hideSkin((_p, bone) => !/^(lowerarm0[12]|wrist|finger\d-\d|metacarpal\d)\.R$/.test(bone));
      for (const m of [hand.brows, hand.lashes, hand.tearLines, hand.teeth]) if (m) m.visible = false;
      for (const s of ['L', 'R'] as const) hand.eyes[s].group.visible = false;
      hand.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = false;
          o.receiveShadow = true;
        }
      });
      hand.setGripRadius(0.014);
      hand.setHero(1);
      hand.rig.breathe = 0;
      hand.rig.blinkEnabled = false;
      scene.add(hand.root);
    } catch (e) {
      console.warn('[film] macro: the hand failed (the cloth plays alone)', e);
      hand = null;
    }
  }
  const handMs = performance.now() - th0;
  c.progress(0.9);
  await c.yieldFrame();

  // ------------------------------------------------------------------------------------------------ per frame
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _g = new THREE.Vector3(), _n = new THREE.Vector3();
  const _m = new THREE.Matrix4(), _s = new THREE.Matrix4(), _q = new THREE.Quaternion();
  /** the snapped fraction of the threads around a (smoothed over ±6 mm and 0.12 s) */
  const releaseAt = (a: number, t: number) => {
    let s = 0, w = 0;
    for (const th of threads) {
      const d = Math.abs(th.a - a);
      if (d > 0.008) continue;
      const k = 1 - d / 0.008;
      s += k * ss(th.t - 0.02, th.t + 0.12, t);
      w += k;
    }
    // beyond the threads' span (the slit side is open from the first snap; the left tears last)
    if (w <= 0) return a > SLIT - 0.004 ? ss(B.rip, B.rip + 0.2, t) : ss(B.snap - 0.1, B.snap + 0.05, t);
    return s / w;
  };
  // the grip point (set space) at shot time t: the fist reaches the wool, closes, pulls, then yanks the corner free
  const gripAt = (t: number, out: THREE.Vector3) => {
    // the hand comes in open, the palm onto the wool; closing, the fist draws a bunch of it out toward the lens
    set3(out, GRIP.x, GRIP.y, drape(GRIP.x, GRIP.y) + 0.024 + 0.022 * closure(t) + 0.03 * (1 - ss(0, B.grip - 0.15, t)));
    return out.addScaledVector(PULL, pullDist(t));
  };
  // the deformed position of a lower-piece point (material a, b) at shot time t
  const fistG = new THREE.Vector3();
  const lowerPoint = (a: number, b: number, t: number, rel: number, out: THREE.Vector3) => {
    const l = lineB(a);
    set3(out, a, b, drape(a, b) * (1 - 0.6 * tension(t) * Math.exp(-(((a - GRIP.x) ** 2 + (b - GRIP.y) ** 2) / 0.004))));
    const dg = Math.hypot(a - GRIP.x, b - GRIP.y);
    const near = Math.exp(-(dg * dg) / (2 * 0.045 * 0.045));
    const below = clamp01((l - b) / 0.12);
    const prof = 0.4 + 0.6 * ss(0, 0.09, l - b);
    const free = ss(B.snap - 0.05, B.snap + 0.4, t);
    // torn here: the piece follows the fist; still held: only the cloth between the line and the fist stretches
    let w = near + (1 - near) * (rel * prof + (1 - rel) * below * 0.22);
    w = w + (1 - w) * free;
    out.addScaledVector(PULL, pullDist(t) * w);
    // the fist gathers the wool round its grip: the cloth near it converges into the fist, folds radiate from it
    const cl = closure(t);
    if (dg < 0.07 && cl > 0) {
      // a tent of wool drawn into the fist (the fingers wrap its tip)
      const k = cl * (1 - ss(0.008, 0.07, dg));
      out.lerp(fistG, k * k * 0.92);
    }
    if (dg < 0.11) {
      const ang = Math.atan2(b - GRIP.y, a - GRIP.x);
      const fold = Math.sin(ang * 7 + 0.4) * ss(0.012, 0.03, dg) * (1 - ss(0.04, 0.11, dg));
      out.addScaledVector(AZ, 0.0045 * fold * (0.35 * cl + 0.65 * tension(t)));
    }
    // the torn edge curls a little toward the lens and flutters (slow motion: the air of the pull)
    const edge = Math.exp(-(l - b) / 0.006) * rel;
    out.addScaledVector(AZ, edge * (0.0025 + 0.0012 * Math.sin(t * 2.1 + a * 160)));
    return out;
  };
  const upperPoint = (a: number, b: number, t: number, rel: number, out: THREE.Vector3) => {
    set3(out, a, b, drape(a, b));
    const l = lineB(a);
    const edge = Math.exp(-(b - l) / 0.01) * rel;
    // freed from the corner's weight the torn edge springs up and back, then flutters
    out.addScaledVector(AY, 0.0022 * edge).addScaledVector(AZ, -0.0035 * edge + 0.0012 * edge * Math.sin(t * 1.7 + a * 120));
    out.addScaledVector(AZ, 0.0007 * Math.sin(t * 0.6 + a * 9 + b * 4));
    return out;
  };
  const relCache = new Float32Array(upperP.cols + 1);
  const updateCloth = (t: number) => {
    gripAt(t, fistG);
    for (let i = 0; i <= upperP.cols; i++) relCache[i] = releaseAt(upperP.mat[i * 2], t);
    const tn = tension(t);
    for (const P of [upperP, lowerP]) {
      const up = P === upperP;
      const N = (P.cols + 1) * (P.rows + 1);
      for (let k = 0; k < N; k++) {
        const a = P.mat[k * 2], b = P.mat[k * 2 + 1];
        const rel = relCache[k % (P.cols + 1)];
        if (up) upperPoint(a, b, t, rel, _v);
        else lowerPoint(a, b, t, rel, _v);
        P.pos[k * 3] = _v.x;
        P.pos[k * 3 + 1] = _v.y;
        P.pos[k * 3 + 2] = _v.z;
        // the weave opens near the line where it still holds (the strain before each thread goes)
        const l = lineB(a);
        P.strain[k] = tn * Math.exp(-(((b - l) / 0.01) ** 2)) * (1 - rel) * (0.6 + 0.4 * ss(-0.1, SLIT, a));
      }
      (P.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (P.geo.getAttribute('aStrain') as THREE.BufferAttribute).needsUpdate = true;
      P.geo.computeVertexNormals();
    }
  };

  // ---- ribbons
  let rv = 0, ri = 0;
  const camPos = new THREE.Vector3();
  const strand = (pts: THREE.Vector3[], n: number, width: number, col: THREE.Color, taper = 0.4) => {
    if (n < 2) return;
    const base = rv;
    let along = 0;
    for (let k = 0; k < n; k++) {
      const p = pts[k];
      const tgt = _w.subVectors(pts[Math.min(n - 1, k + 1)], pts[Math.max(0, k - 1)]);
      if (tgt.lengthSq() < 1e-12) tgt.set(1, 0, 0);
      const side = _n.subVectors(camPos, p).cross(tgt).normalize();
      const wd = width * (1 - taper * (k / (n - 1))) * 0.5;
      if (k > 0) along += pts[k].distanceTo(pts[k - 1]);
      for (const sg of [-1, 1]) {
        rPos[rv * 3] = p.x + side.x * wd * sg;
        rPos[rv * 3 + 1] = p.y + side.y * wd * sg;
        rPos[rv * 3 + 2] = p.z + side.z * wd * sg;
        rCol[rv * 3] = col.r;
        rCol[rv * 3 + 1] = col.g;
        rCol[rv * 3 + 2] = col.b;
        rRib[rv * 2] = sg;
        rRib[rv * 2 + 1] = along;
        rv++;
      }
    }
    for (let k = 0; k < n - 1; k++) {
      const a = base + k * 2;
      rIdx[ri++] = a;
      rIdx[ri++] = a + 1;
      rIdx[ri++] = a + 3;
      rIdx[ri++] = a;
      rIdx[ri++] = a + 3;
      rIdx[ri++] = a + 2;
    }
  };
  const P: THREE.Vector3[] = Array.from({ length: TZSEG }, () => new THREE.Vector3());
  const WOOL = new THREE.Color(0x6a5a4a), FIBRE = new THREE.Color(0x8b7b62), WHITE = new THREE.Color(0xe9e2d0), TEKHELET = new THREE.Color(0x2f4c8f);
  const GRAV = new THREE.Vector3(0, -1, 0);
  const _u = new THREE.Vector3(), _l = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
  const updateRibbons = (t: number, cam: THREE.Camera) => {
    rv = 0;
    ri = 0;
    cam.getWorldPosition(camPos);
    for (const th of threads) {
      const rel = releaseAt(th.a, t);
      const l = lineB(th.a);
      upperPoint(th.a, l + 0.0004, t, rel, _u);
      lowerPoint(th.a, l - 0.0004, t, rel, _l);
      const gap = _u.distanceTo(_l);
      if (t < th.t) {
        // still holding: a taut yarn across the opening (thinner as it stretches)
        if (gap < 0.0006) continue;
        const sag = 0.0004 * Math.sin(t * 9 + th.seed * 20) * (th.hero ? 2 : 1);
        for (let k = 0; k < SEG; k++) {
          const f = k / (SEG - 1);
          P[k].lerpVectors(_u, _l, f).addScaledVector(AZ, sag * Math.sin(Math.PI * f));
        }
        strand(P, SEG, Math.max(0.0006, 0.0012 + 0.0004 * th.seed - gap * 0.012), WOOL, 0);
        continue;
      }
      // snapped: two ends recoil (an elastic yarn), curl and hang, frayed fibres splaying from each — their length is the
      // opening's at the snap (they do not grow with it), shrinking a little as the wool relaxes
      const te = t - th.t;
      const relS = releaseAt(th.a, th.t);
      const gap0 = Math.max(0.002, upperPoint(th.a, l + 0.0004, th.t, relS, _w).distanceTo(lowerPoint(th.a, l - 0.0004, th.t, relS, _v)));
      upperPoint(th.a, l + 0.0004, t, rel, _u);
      lowerPoint(th.a, l - 0.0004, t, rel, _l);
      for (const end of [0, 1]) {
        const A = end === 0 ? _u : _l;
        const toward = _d.subVectors(end === 0 ? _l : _u, A).normalize();
        const len = gap0 * (end === 0 ? th.len : 1 - th.len) * (0.72 + 0.28 * Math.exp(-te / 0.12) * Math.cos(te * 22)) + 0.0012;
        const droop = clamp01(te / 0.6) * 0.6;
        const curl = th.curl * (0.6 + 0.6 * Math.exp(-te / 0.2)) * (end ? -1 : 1);
        P[0].copy(A);
        _e.copy(toward);
        for (let k = 1; k < SEG; k++) {
          const f = k / (SEG - 1);
          _e.lerp(GRAV, droop * f * 0.5).addScaledVector(AZ, curl * 0.25 * f).normalize();
          P[k].copy(P[k - 1]).addScaledVector(_e, len / (SEG - 1));
        }
        strand(P, SEG, 0.0011 + 0.0004 * th.seed, WOOL, 0.55);
        // frayed fibres at the free end
        const tip = P[SEG - 1];
        for (let fi = 0; fi < FIB; fi++) {
          const sd = th.seed * 13 + fi * 3.7 + end;
          const fl = 0.0015 + 0.0025 * hash(sd);
          _e.copy(toward).add(_v.set(hash(sd + 1) - 0.5, hash(sd + 2) - 0.5, hash(sd + 3) - 0.5).multiplyScalar(1.6)).normalize();
          for (let k = 0; k < 4; k++) P[k].copy(tip).addScaledVector(_e, (fl * k) / 3).addScaledVector(GRAV, 0.0004 * k * droop);
          strand(P, 4, 0.00022, FIBRE, 0.6);
        }
      }
    }
    // the fuzz
    for (const fz of fuzz) {
      const l = lineB(fz.a);
      let len = fz.len, rel = 1;
      if (fz.edge) {
        // edge fibres are freed as the edge tears (inside the weave before)
        rel = releaseAt(fz.a, t);
        if (rel < 0.05) continue;
        len *= rel;
        const bb = l + fz.edge * (0.0006 + 0.0025 * Math.abs(fz.dy));
        if (fz.edge > 0) upperPoint(fz.a, bb, t, rel, _u);
        else lowerPoint(fz.a, bb, t, rel, _u);
        // pointing out of the edge into the opening, and toward the lens a little
        _e.copy(AY).multiplyScalar(-fz.edge).addScaledVector(AX, fz.dx * 1.2).addScaledVector(AZ, fz.dz * 0.5).normalize();
      } else {
        const up = fz.b > l;
        const relA = releaseAt(fz.a, t);
        if (up) upperPoint(fz.a, fz.b, t, relA, _u);
        else lowerPoint(fz.a, fz.b, t, relA, _u);
        _e.copy(AZ).multiplyScalar(fz.dz).addScaledVector(AX, fz.dx).addScaledVector(AY, fz.dy).normalize();
      }
      P[0].copy(_u);
      for (let k = 1; k < 4; k++) {
        _e.addScaledVector(GRAV, 0.12).addScaledVector(AX, fz.curl * 0.15).normalize();
        P[k].copy(P[k - 1]).addScaledVector(_e, len / 3);
      }
      strand(P, 4, 0.00016, FIBRE, 0.5);
    }
    // the tzitzit from the corner's hole: the wound knot, then the loose strings swinging with the corner
    lowerPoint(CORNER.x, CORNER.y, t, 1, _g);
    const back = lowerPoint(CORNER.x, CORNER.y, Math.max(0, t - 0.35), 1, _w).clone();
    const vel = _v.subVectors(_g, back);
    for (let s = 0; s < TZ; s++) {
      const ph = s * 1.37;
      const seg = 0.011;
      P[0].copy(_g).addScaledVector(AX, (s - TZ / 2) * 0.0009);
      for (let k = 1; k < TZSEG; k++) {
        const f = k / (TZSEG - 1);
        const knot = k < 4 ? 0.25 : 1; // the wound section stays together
        P[k].copy(P[k - 1]).addScaledVector(GRAV, seg)
          .addScaledVector(vel, -0.5 * f * knot)
          .addScaledVector(AX, 0.0012 * Math.sin(t * 0.9 + ph + f * 2) * f * knot)
          .addScaledVector(AZ, 0.001 * Math.cos(t * 0.7 + ph) * f * knot);
      }
      strand(P, TZSEG, 0.0013, s === 3 ? TEKHELET : WHITE, 0.15);
    }
    rGeo.setDrawRange(0, ri);
    for (const n of ['position', 'color', 'aRib'] as const) {
      const at = rGeo.getAttribute(n) as THREE.BufferAttribute;
      at.needsUpdate = true;
      at.clearUpdateRanges();
      at.addUpdateRange(0, rv * at.itemSize);
    }
    const ix = rGeo.getIndex()!;
    ix.needsUpdate = true;
    ix.clearUpdateRanges();
    ix.addUpdateRange(0, ri);
  };

  // ---- the fist: the hand's pose (open -> grip), its grip socket placed on the grip point, the forearm toward Saul
  const handFrame = new THREE.Matrix4();
  // the rig's fist leaves the thumb sticking out (its wrap is solved for a staff): fold it across the fingers — the
  // thumb's chain turned toward the middle finger's middle joint (world rotation applied in each bone's parent frame)
  const bones = hand ? (hand.bones as Record<string, THREE.Bone>) : null;
  const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qp = new THREE.Quaternion();
  const foldThumb = (w: number) => {
    if (!bones || w <= 0.001) return;
    const b1 = bones['finger1-1.R'], b3 = bones['finger1-3.R'], m2 = bones['finger3-2.R'], i1 = bones['finger2-1.R'];
    if (!b1 || !b3 || !m2 || !i1) return;
    hand!.root.updateMatrixWorld(true);
    b1.getWorldPosition(_p);
    b3.getWorldPosition(_t).sub(_p).normalize();
    // the target: over the index and middle fingers' middle joints
    m2.getWorldPosition(_v);
    i1.getWorldPosition(_w);
    _v.lerp(_w, 0.35).sub(_p).normalize();
    _qa.setFromUnitVectors(_t, _v);
    _qa.slerp(_q.identity(), 1 - 0.85 * w);
    // world rotation -> b1's local: q_local' = inv(parentWorld) * qa * parentWorld * q_local
    b1.parent!.getWorldQuaternion(_qp);
    const inv = _q.copy(_qp).invert();
    b1.quaternion.premultiply(_qp).premultiply(_qa).premultiply(inv);
    b1.updateMatrixWorld(true);
  };
  const updateHand = (t: number) => {
    if (!hand) return;
    const rig = hand.rig;
    const cl = closure(t);
    const fp = rig.fingerPose.R;
    fp.pose = 'fist';
    fp.cur.clear();
    if (cl < 0.999) fp.cur.set('relaxed', 1 - cl);
    if (cl > 0.001) fp.cur.set('fist', cl);
    // the forearm proxies: the elbow a little bent, the wrist extending as he pulls
    hand.root.position.set(0, 0, 0);
    hand.root.quaternion.identity();
    hand.root.updateMatrix();
    hand.update(0);
    foldThumb(cl);
    const sock = hand.sockets.handGripR;
    sock.updateWorldMatrix(true, false);
    _s.copy(sock.matrixWorld).invert();
    // the grip frame in the set: +X (out of the palm) into the cloth, +Y (thumb side of the grip hole) along the
    // bunched wool (up the cloth), the back of the hand and the knuckles to the lens; it turns with the pull
    gripAt(t, _g);
    // the forearm comes toward the lens from the right (yaw), a little from below (pitch); the wrist rolls as he pulls
    const twist = ss(B.pull, B.snap + 0.6, t);
    const yaw = -0.5 - 0.12 * ss(B.rip, B.snap + 0.6, t);
    _q.setFromEuler(new THREE.Euler(0.18 + 0.12 * twist, yaw, TILT * 0.6 - 0.22 * twist, 'YXZ'));
    handFrame.compose(_g, _q, _v.set(1, 1, 1));
    // (a right hand taking a hanging cloth from the right side: the palm on the wool, the thumb below, the forearm right)
    const into = new THREE.Vector3(0, 0, -1), upY = new THREE.Vector3(0, -1, 0);
    const Z = new THREE.Vector3().crossVectors(into, upY);
    _m.makeBasis(into, upY, Z);
    handFrame.multiply(_m);
    // root = desired grip frame * (grip socket in root space)^-1
    _m.multiplyMatrices(handFrame, _s);
    _m.decompose(hand.root.position, hand.root.quaternion, hand.root.scale);
    hand.root.updateMatrixWorld(true);
  };

  // ---- camera: a slow push from the fist toward the tear line (real time, against the slow-motion action): it opens on
  // the fist closing on the wool (~17 cm of frame) and ends close on the last threads (~10 cm), drifting left with the
  // tear front; a hint of roll
  const camAt = (t: number, out: ShotFrame) => {
    const u = clamp01(t / DUR);
    const e = u * u * (3 - 2 * u);
    const la = 0.04 - 0.085 * e, lb = -0.036 + 0.034 * e;
    set3(out.look, la, lb, 0);
    const d = 0.3 - 0.125 * Math.pow(e, 1.15);
    set3(out.pos, la + 0.018 - 0.01 * e, lb - 0.022 + 0.01 * e, d);
    out.fov = 20 - 2.5 * e;
    out.roll = 0.03 - 0.025 * e;
    return out;
  };
  /** the plane of focus: the knuckles while the fist closes, then the threads at the tear front (the hero last) */
  const focusAt = (t: number, out: THREE.Vector3) => {
    gripAt(t, _g);
    const hero = threads.find((h) => h.hero) ?? threads[Math.floor(threads.length / 2)];
    const rel = releaseAt(hero.a, t);
    upperPoint(hero.a, lineB(hero.a), t, rel, _u);
    lowerPoint(hero.a, lineB(hero.a), t, rel, _l);
    out.lerpVectors(_u, _l, 0.5);
    // the front's thread before the hero is at it
    const k = ss(B.grip + 0.3, B.pull + 0.4, t);
    return out.lerpVectors(_g.addScaledVector(AZ, 0.012), out, k);
  };

  const view: ViewSpec = {
    scene,
    camera,
    sky: null,
    exposure: () => 0.95,
    atmosphere: { density: 0, godRays: 0 },
    near: 0.02,
    far: 30,
    update: (_dt, cam) => {
      void cam;
    },
  };
  let lastT = -1;
  const stats: MacroSetStats = { buildMs: 0, handMs: Math.round(handMs), triangles: 0 };
  const run = (t: number, cam: THREE.Camera) => {
    updateHand(t);
    updateCloth(t);
    updateRibbons(t, cam);
    mMat.uniforms.uTime.value = t;
    lastT = t;
  };
  // the first pose (precompile / the first frame)
  const f0: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 18, roll: 0 };
  camAt(0, f0);
  camera.position.copy(f0.pos);
  camera.lookAt(f0.look);
  camera.updateMatrixWorld();
  run(0, camera);
  stats.buildMs = Math.round(performance.now() - t0);
  const testMode = typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1';
  if (testMode) Object.assign(window as unknown as Record<string, unknown>, { __macroStats: stats, __macroHand: hand });
  c.progress(1);

  const tmpF = new THREE.Vector3();
  const handle: FilmSetHandle = {
    name: 'macro',
    view,
    camera,
    status: [hand ? "Saul's fist: HumanModel (forearm + hand); the me'il's corner: procedural weave; threads; tzitzit" : "the me'il's corner (no hand: cast off or failed)"],
    disposed: false,
    precompilePoses: [{ pos: f0.pos.clone(), look: f0.look.clone() }],
    ground: () => -10,
    frame(_take, _u, t, out) {
      camAt(t, out);
      // test only: a debug lens (window.__macroCam = { pos: [x, y, z], look: [x, y, z], fov })
      const dbg = testMode ? ((window as unknown as Record<string, unknown>).__macroCam as { pos: number[]; look: number[]; fov: number } | undefined) : undefined;
      if (dbg) {
        out.pos.fromArray(dbg.pos);
        out.look.fromArray(dbg.look);
        out.fov = dbg.fov;
        out.roll = 0;
      }
      return true;
    },
    enter() {
      lastT = -1;
    },
    tick(_take, t) {
      // the action is a function of shot time: a seek, a slow frame or a pre-compile land on the same pose
      camera.updateMatrixWorld();
      if (t !== lastT) run(t, camera);
      if (testMode) {
        const hide = !!(window as unknown as Record<string, unknown>).__macroHideCloth;
        upperP.mesh.visible = lowerP.mesh.visible = ribbons.visible = !hide;
      }
      const fp = focusAt(t, tmpF);
      mMat.uniforms.uFocus.value = camera.position.distanceTo(fp);
      mMat.uniforms.uScale.value = engine.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
    focus(_take, t): FilmFocus {
      const dbg = testMode && (window as unknown as Record<string, unknown>).__macroCam;
      return { point: focusAt(t, new THREE.Vector3()), fStop: dbg ? 64 : 5.6, maxBlur: 0.026 };
    },
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      hand?.dispose();
      for (const d of disposables) d.dispose();
      scene.clear();
    },
  };
  return handle;
}
