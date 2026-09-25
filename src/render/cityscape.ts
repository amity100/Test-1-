import * as THREE from 'three';
import type { SkyStyle } from './fx';

// Halcyon's scenery beyond the level: art-deco towers with setbacks, spires
// and lit windows, glass domes, the tower under construction, snow-capped
// mountains. All procedural in one shader per mesh (one draw call each):
// windows, trims and snow are drawn per pixel, sun light and aerial haze are
// computed in the shader (no scene fog) so the far city fades into the sky's
// own horizon.

/** Surface kinds (the shader's `kind`). */
const TOWER = 0, MOUNTAIN = 1, METAL = 2, GLASS = 3, BLOCK = 4, ROOF = 5, LIGHT = 6, TRIM = 7;

type RGB = [number, number, number];

/** Flat-shaded faces tagged per vertex with (seed, kind, y0, y1): y0..y1 is the tier the face belongs to. */
class DecoGeo {
  pos: number[] = [];
  nrm: number[] = [];
  info: number[] = [];
  idx: number[] = [];

  private face(p: THREE.Vector3[], kind: number, seed: number, y0: number, y1: number) {
    const n = new THREE.Vector3().subVectors(p[1], p[0]).cross(new THREE.Vector3().subVectors(p[p.length - 1], p[0]));
    // (a degenerate face would feed a NaN normal to the shader)
    if (n.lengthSq() < 1e-10) return;
    n.normalize();
    const base = this.pos.length / 3;
    for (const q of p) {
      this.pos.push(q.x, q.y, q.z);
      this.nrm.push(n.x, n.y, n.z);
      this.info.push(seed, kind, y0, y1);
    }
    for (let i = 1; i < p.length - 1; i++) this.idx.push(base, base + i, base + i + 1);
  }

  /** Box standing on y0 (turned `rot` about its centre), no bottom. */
  box(cx: number, cz: number, y0: number, w: number, h: number, d: number, kind: number, seed: number, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx: number, y: number, lz: number) => new THREE.Vector3(cx + lx * c + lz * s, y, cz - lx * s + lz * c);
    const x = w / 2, z = d / 2, y1 = y0 + h;
    this.face([P(x, y0, z), P(x, y0, -z), P(x, y1, -z), P(x, y1, z)], kind, seed, y0, y1);
    this.face([P(-x, y0, -z), P(-x, y0, z), P(-x, y1, z), P(-x, y1, -z)], kind, seed, y0, y1);
    this.face([P(-x, y0, z), P(x, y0, z), P(x, y1, z), P(-x, y1, z)], kind, seed, y0, y1);
    this.face([P(x, y0, -z), P(-x, y0, -z), P(-x, y1, -z), P(x, y1, -z)], kind, seed, y0, y1);
    this.face([P(-x, y1, z), P(x, y1, z), P(x, y1, -z), P(-x, y1, -z)], kind === TOWER || kind === BLOCK ? TRIM : kind, seed, y0, y1);
  }

  /** Upright prism of `sides` round (cx, cz), radius r, with a flat top. */
  prism(cx: number, cz: number, y0: number, r: number, h: number, sides: number, kind: number, seed: number, rot = 0) {
    const y1 = y0 + h;
    const P = (k: number, y: number) => {
      const a = rot + (k / sides) * Math.PI * 2;
      return new THREE.Vector3(cx + Math.sin(a) * r, y, cz + Math.cos(a) * r);
    };
    const top: THREE.Vector3[] = [];
    for (let k = 0; k < sides; k++) {
      this.face([P(k, y0), P(k + 1, y0), P(k + 1, y1), P(k, y1)], kind, seed, y0, y1);
      top.push(P(sides - k, y1));
    }
    this.face(top.reverse(), kind === TOWER || kind === BLOCK ? TRIM : kind, seed, y0, y1);
  }

  /** Pointed roof or spire: `sides` faces from a base of radius r up to an apex h above y0. */
  spire(cx: number, cz: number, y0: number, r: number, h: number, sides: number, kind: number, seed: number, rot = Math.PI / 4) {
    const apex = new THREE.Vector3(cx, y0 + h, cz);
    for (let k = 0; k < sides; k++) {
      const a0 = rot + (k / sides) * Math.PI * 2, a1 = rot + ((k + 1) / sides) * Math.PI * 2;
      this.face([new THREE.Vector3(cx + Math.sin(a0) * r, y0, cz + Math.cos(a0) * r), new THREE.Vector3(cx + Math.sin(a1) * r, y0, cz + Math.cos(a1) * r), apex], kind, seed, y0, y0 + h);
    }
  }

  /** A dome (latitude bands of `seg` facets) of radius r and height h on y0. */
  dome(cx: number, cz: number, y0: number, r: number, h: number, seg: number, rings: number, kind: number, seed: number) {
    const P = (k: number, j: number) => {
      const a = (k / seg) * Math.PI * 2, t = (j / rings) * (Math.PI / 2);
      return new THREE.Vector3(cx + Math.sin(a) * Math.cos(t) * r, y0 + Math.sin(t) * h, cz + Math.cos(a) * Math.cos(t) * r);
    };
    for (let j = 0; j < rings; j++) {
      for (let k = 0; k < seg; k++) {
        if (j === rings - 1) this.face([P(k, j), P(k + 1, j), P(k, j + 1)], kind, seed, y0, y0 + h);
        else this.face([P(k, j), P(k + 1, j), P(k + 1, j + 1), P(k, j + 1)], kind, seed, y0, y0 + h);
      }
    }
  }

  /** A ridge line (mountains): a strip from the ground at `near` up to the crest points (x, y, z). */
  ridge(crest: THREE.Vector3[], foot: THREE.Vector3[], snow: number) {
    // (the crest runs round to the right, so the face turns back toward the city)
    for (let i = 0; i < crest.length - 1; i++) this.face([foot[i + 1], foot[i], crest[i], crest[i + 1]], MOUNTAIN, i * 0.37, foot[i].y, snow);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.info, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const NOISE = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

/**
 * The deco shader: pale limestone and blue-grey towers with vertical window
 * bays (some lit warm), spandrels, gilt trims at each setback, metal spires,
 * glass domes, near blocks with arched windows, slate and copper roofs,
 * snow on the mountains. Sun and sky light, then haze toward the sky's own
 * horizon colour (warmer toward the sun).
 */
function decoMaterial(o: { sunDir: THREE.Vector3; sky?: SkyStyle; haze: number; floor: number }) {
  const hz: RGB = o.sky?.haze ?? [0.56, 0.64, 0.73];
  const away = o.sky?.horizonAway ?? [0.5, 0.63, 0.8];
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uSunDir: { value: o.sunDir.clone().normalize() },
      uSunColor: { value: new THREE.Color(1.1, 0.85, 0.6) },
      uSky: { value: new THREE.Color(0.22, 0.3, 0.44) },
      // (away from the sun a little darker and bluer than the sky's horizon, toward it a golden haze:
      // the towers stand out from both as blue-grey silhouettes)
      uHazeAway: { value: new THREE.Color(hz[0] * 0.5 + away[0] * 0.3, hz[1] * 0.5 + away[1] * 0.32, hz[2] * 0.5 + away[2] * 0.4) },
      uHazeSun: { value: new THREE.Color(hz[0] * 1.4, hz[1] * 1.06, hz[2] * 0.75) },
      uHazeDensity: { value: o.haze },
      uHazeFloor: { value: o.floor },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo;
      varying vec3 vW, vL, vN;
      varying vec4 vInfo;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vL = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vInfo = aInfo;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunColor, uSky, uHazeAway, uHazeSun;
      uniform float uHazeDensity, uHazeFloor;
      varying vec3 vW, vL, vN;
      varying vec4 vInfo;
      ${NOISE}
      void main() {
        vec3 n = normalize(vN);
        vec3 sun = normalize(uSunDir);
        vec3 toCam = cameraPosition - vW;
        float dist = length(toCam);
        vec3 v = toCam / max(dist, 1e-3);
        float seed = vInfo.x, kind = vInfo.y, y0 = vInfo.z, y1 = vInfo.w;
        float ndl = max(dot(n, sun), 0.0);
        float skyL = 0.55 + 0.45 * clamp(n.y, 0.0, 1.0);
        vec3 r = reflect(-v, n);
        float glint = max(dot(r, sun), 0.0);
        glint *= glint; glint *= glint; glint *= glint; glint *= glint;
        vec3 base = vec3(0.7);
        vec3 emit = vec3(0.0);
        float spec = 0.0;
        // the face's own horizontal axis (pattern in the object's frame: the far city moves with the camera)
        vec2 tg = vec2(n.z, -n.x);
        tg /= max(length(tg), 1e-4);
        float u = dot(vL.xz, tg);
        float hy = vL.y - y0;
        bool wall = abs(n.y) < 0.5;
        if (kind < 0.5) {
          // deco tower, by seed: limestone, blue-grey steel, blue glass curtain walls, pale cream
          // (mostly blue-steel and glass: the concept's needles read blue against the pale sky)
          float t = fract(seed * 7.13);
          float glassy = step(0.55, t) * step(t, 0.85);
          base = t < 0.2 ? vec3(0.72, 0.64, 0.52) : t < 0.55 ? vec3(0.46, 0.53, 0.64) : t < 0.85 ? vec3(0.24, 0.34, 0.5) : vec3(0.8, 0.74, 0.64);
          if (wall) {
            // bays: a pier, a tall window column, spandrels between floors; every fifth pier a fin
            vec2 cell = vec2(u / 2.4, hy / 3.9);
            vec2 f = fract(cell);
            float col = step(0.26 - 0.18 * glassy, f.x) * step(f.x, 0.74 + 0.18 * glassy);
            float glass = col * step(0.14, f.y) * step(f.y, 0.92);
            float fin = 1.0 - step(0.06, fract(cell.x * 0.2 + 0.03));
            float h = hash12(floor(cell) + seed * 91.7);
            // (daylight: a few lit windows, dark blue glass between pale piers, not a grid of cream dots)
            float lit = step(1.0 - (0.03 + 0.06 * fract(seed * 3.7)), h);
            vec3 sky = mix(uSky * 1.1, vec3(0.62, 0.72, 0.86), clamp(r.y, 0.0, 1.0));
            vec3 g = mix(sky * (0.3 + 0.2 * h), uSunColor * 1.4, glint);
            base = mix(base, base * 0.72, col * (1.0 - glass));
            base = mix(base, g, glass * (1.0 - lit));
            emit += glass * lit * vec3(1.1, 0.66, 0.32) * (0.7 + 0.5 * h);
            base = mix(base, base * 1.4, fin);
            spec = glass * (1.0 - lit) * 0.5;
            // the ground floors: a darker base, shopfronts lit
            float gf = 1.0 - step(7.0, vL.y - (y0 < 1.0 ? y0 : -1e4));
            base = mix(base, base * 0.8, gf);
            // a solid band and a gilt line under each setback
            float band = step(y1 - 2.6, vL.y);
            base = mix(base, vec3(0.8, 0.74, 0.62), band);
            float gilt = step(y1 - 1.4, vL.y) * step(vL.y, y1 - 0.9);
            base = mix(base, vec3(0.86, 0.62, 0.26), gilt);
            spec = mix(spec, 1.0, gilt);
            emit *= 1.0 - band;
          }
        } else if (kind < 1.5) {
          // mountains: blue-grey rock, snow above a ragged line and on the gentler slopes
          float nz = vnoise(vW.xz * 0.012) * 0.6 + vnoise(vW.xz * 0.05) * 0.4;
          base = mix(vec3(0.28, 0.33, 0.42), vec3(0.4, 0.44, 0.5), nz);
          float snow = smoothstep(y1 - 12.0, y1 + 8.0, vL.y + (nz - 0.5) * 60.0);
          base = mix(base, vec3(0.92, 0.94, 0.97), snow);
        } else if (kind < 2.5) {
          // metal: gilt spires, verdigris copper, dark bronze
          float t = fract(seed * 5.31);
          base = t < 0.5 ? vec3(0.8, 0.6, 0.28) : t < 0.8 ? vec3(0.34, 0.54, 0.47) : vec3(0.22, 0.2, 0.2);
          spec = t < 0.5 ? 1.0 : 0.4;
        } else if (kind < 3.5) {
          // glass dome: the sky mirrored, a warm glow inside, lattice lines
          vec3 sky = mix(uSky * 1.2, vec3(0.62, 0.74, 0.9), clamp(r.y, 0.0, 1.0));
          float lat = step(0.9, fract(hy * 0.35));
          base = sky * 0.7;
          emit += vec3(0.55, 0.36, 0.2) * (0.4 + 0.6 * clamp(hy / max(y1 - y0, 1.0), 0.0, 1.0));
          base = mix(base, vec3(0.7, 0.55, 0.3), lat);
          spec = 1.0;
        } else if (kind < 4.5) {
          // near blocks: cream limestone, arched windows, a rusticated ground floor
          float t = fract(seed * 7.13);
          base = t < 0.5 ? vec3(0.8, 0.7, 0.55) : t < 0.8 ? vec3(0.84, 0.76, 0.62) : vec3(0.72, 0.62, 0.5);
          if (wall) {
            vec2 cell = vec2(u / 3.2, hy / 4.2);
            vec2 f = fract(cell);
            vec2 q = vec2(f.x - 0.5, f.y - 0.62);
            float win = step(abs(q.x), 0.19) * step(0.16, f.y) * step(f.y, 0.62);
            win = max(win, step(length(q / vec2(0.19, 0.19)), 1.0) * step(0.62, f.y));
            float h = hash12(floor(cell) + seed * 57.3);
            float lit = step(1.0 - (0.06 + 0.1 * fract(seed * 2.9)), h);
            vec3 sky = mix(uSky, vec3(0.6, 0.7, 0.84), clamp(r.y, 0.0, 1.0));
            base = mix(base, mix(sky * 0.35, uSunColor * 1.2, glint), win * (1.0 - lit));
            emit += win * lit * vec3(1.1, 0.68, 0.34) * (0.7 + 0.5 * h);
            float rust = (1.0 - step(5.0, hy)) * (1.0 - step(0.9, fract(hy / 0.75)) * 0.3);
            base = mix(base, base * 0.85, rust);
            float cor = step(y1 - 1.0, vL.y);
            base = mix(base, vec3(0.9, 0.84, 0.72), cor);
          }
        } else if (kind < 5.5) {
          // roofs: slate or verdigris copper
          base = fract(seed * 3.3) < 0.55 ? vec3(0.24, 0.27, 0.33) : vec3(0.33, 0.52, 0.45);
          spec = 0.3;
        } else if (kind < 6.5) {
          emit = vec3(1.6, 0.9, 0.45);
          base = vec3(0.0);
        } else {
          // plain stone: roofs of towers, cornices
          base = vec3(0.8, 0.74, 0.64);
        }
        vec3 col = base * (uSky * skyL + uSunColor * ndl) + emit + uSunColor * spec * glint * 1.5;
        // aerial haze: denser near the ground, the sky's horizon colour (warmer toward the sun)
        vec2 dh = -v.xz / max(length(v.xz), 1e-4);
        vec2 sh = sun.xz / max(length(sun.xz), 1e-4);
        float sunSide = smoothstep(-0.6, 1.0, dot(dh, sh));
        vec3 haze = mix(uHazeAway, uHazeSun, sunSide);
        float hf = exp(-max(vW.y, 0.0) * 0.004);
        float k = 1.0 - exp(-dist * uHazeDensity * (0.5 + 0.5 * hf));
        col = mix(col, haze, clamp(uHazeFloor + k, 0.0, 0.96));
        gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
      }`,
  });
}

/** Deterministic random numbers. */
function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** An art-deco tower: two to four setbacks, fins, a crown (spire, stepped crown with a mast, or a small dome). */
function decoTower(g: DecoGeo, x: number, z: number, w: number, d: number, h: number, r: () => number, rot: number, y0 = -2) {
  const seed = r();
  const tiers = h > 110 ? 4 : h > 60 ? 3 : 2;
  const split = tiers === 4 ? [0.55, 0.22, 0.13, 0.1] : tiers === 3 ? [0.62, 0.24, 0.14] : [0.75, 0.25];
  let y = y0, ww = w, dd = d;
  const round = r() < 0.22;
  for (let i = 0; i < tiers; i++) {
    const th = h * split[i];
    if (round) g.prism(x, z, y, Math.min(ww, dd) / 2, th, 8, TOWER, seed, rot + Math.PI / 8);
    else g.box(x, z, y, ww, th, dd, TOWER, seed, rot);
    y += th;
    ww *= 0.72 + r() * 0.1;
    dd *= 0.72 + r() * 0.1;
  }
  const crown = r();
  if (crown < 0.45) {
    g.spire(x, z, y, Math.min(ww, dd) * 0.45, h * (0.18 + r() * 0.2), round ? 8 : 4, METAL, r() * 0.49, rot + Math.PI / 4);
  } else if (crown < 0.8) {
    g.box(x, z, y, ww * 0.6, h * 0.05, dd * 0.6, TOWER, seed, rot);
    g.box(x, z, y + h * 0.05, 0.9, h * 0.16, 0.9, METAL, r(), rot);
    g.box(x, z, y + h * 0.21, 1.4, 1.4, 1.4, LIGHT, 0, rot);
  } else {
    g.dome(x, z, y, Math.min(ww, dd) * 0.45, Math.min(ww, dd) * 0.4, 8, 3, METAL, 0.55 + r() * 0.3);
  }
}

/**
 * Halcyon's distant city (the level's `skyline: 'deco'`), for the game's 0.9
 * camera parallax: a downtown of deco towers across the river behind the
 * statue, lower districts all round, glass domes, the Kessler Threshold Tower
 * rising in its cranes to the right (mission 2), and snow-capped mountains.
 * Centred on the square. One draw.
 */
export function createDecoSkyline(opts: { mobile?: boolean; sunDir?: THREE.Vector3; sky?: SkyStyle } = {}): THREE.Object3D {
  const mobile = !!opts.mobile;
  const r = rnd(9091);
  const g = new DecoGeo();
  const c0 = new THREE.Vector3(0, 0, 60);
  const polar = (azDeg: number, dist: number): [number, number] => {
    const a = (azDeg * Math.PI) / 180;
    return [c0.x + Math.sin(a) * dist, c0.z + Math.cos(a) * dist];
  };
  // downtown behind the statue (the start looks toward azimuth -11), a second cluster to the left
  const hero = mobile ? 30 : 52;
  for (let i = 0; i < hero; i++) {
    const cl = r() < 0.7;
    const az = cl ? -12 + (r() + r() + r() - 1.5) * 36 : 28 + (r() + r() - 1) * 26;
    // (nearer and taller than a skyline: the concept's needles fill the upper half of the frame behind her;
    // the Kessler Spire's corridor stays clear)
    let dist = 440 + r() * 400;
    if (dist < 560 && Math.abs(az + 9.5) < 6) dist += 140;
    const peak = cl ? Math.exp(-(((az + 12) / 22) ** 2)) : 0.5;
    const h = (60 + r() * 60 + peak * (50 + r() * 120)) * 1.35;
    const [x, z] = polar(az, dist);
    // (slender: the concept's towers are tall needles with sky between them)
    const w = 15 + r() * 12, d = 15 + r() * 12;
    decoTower(g, x, z, w, d, h, r, ((az * Math.PI) / 180) * (0.8 + r() * 0.4));
  }
  // lower districts all round
  const low = mobile ? 70 : 120;
  for (let i = 0; i < low; i++) {
    const az = -130 + r() * 260;
    const dist = 520 + r() * 480;
    const back = Math.abs(az) > 100;
    const h = back ? 16 + r() * 26 : 16 + r() * 34;
    const [x, z] = polar(az, dist);
    const w = 20 + r() * 28, d = 18 + r() * 26;
    const rot = ((az * Math.PI) / 180) * (0.85 + r() * 0.3);
    if (h > 40) decoTower(g, x, z, w, d, h, r, rot);
    else {
      g.box(x, z, -2, w, h, d, BLOCK, r(), rot);
      if (r() < 0.5) g.box(x, z, h - 2, w * 0.8, 3, d * 0.8, ROOF, r(), rot);
    }
  }
  // behind the terminals (from the square looking back)
  for (let i = 0; i < (mobile ? 24 : 44); i++) {
    const az = 140 + r() * 80;
    const [x, z] = polar(az, 440 + r() * 300);
    const h = 18 + r() * 40;
    if (h > 44) decoTower(g, x, z, 24, 22, h, r, (az * Math.PI) / 180);
    else g.box(x, z, -2, 26 + r() * 20, h, 22 + r() * 16, BLOCK, r(), (az * Math.PI) / 180);
  }
  // glass domes among the towers
  for (const [az, dist, R] of [[18, 620, 34], [-44, 700, 26], [62, 560, 22]] as [number, number, number][]) {
    const [x, z] = polar(az, dist);
    g.prism(x, z, -2, R, R * 0.55, 16, BLOCK, 0.31);
    g.dome(x, z, R * 0.55 - 2, R, R * 0.9, mobile ? 12 : 20, mobile ? 4 : 6, GLASS, 0.5);
    g.box(x, z, R * 1.45 - 2, R * 0.12, R * 0.3, R * 0.12, METAL, 0.2);
  }
  // the Kessler Threshold Tower under construction, far to the right: a dark core, a steel frame, two cranes
  {
    const [x, z] = polar(-42, 1000);
    g.box(x, z, -2, 34, 150, 34, TOWER, 0.93);
    for (let k = 0; k < 7; k++) g.box(x, z, 148 + k * 9, 36, 0.8, 36, METAL, 0.9);
    for (const [dx, dz] of [[-17, -17], [17, -17], [-17, 17], [17, 17]]) g.box(x + dx, z + dz, 148, 1.2, 64, 1.2, METAL, 0.9);
    for (const s of [-1, 1]) {
      g.box(x + s * 8, z, 148, 2, 90, 2, METAL, 0.86);
      g.box(x + s * 8 + s * 14, z, 236, 44, 2, 1.6, METAL, 0.86, 0);
      g.box(x + s * 8, z, 238, 1.4, 1.4, 1.4, LIGHT, 0);
    }
  }
  // mountains: two ridge lines far behind the city, snow on the higher one
  const ridge = (dist: number, lo: number, hi: number, seg: number, seedA: number, snow: number) => {
    const crest: THREE.Vector3[] = [], foot: THREE.Vector3[] = [];
    for (let i = 0; i <= seg; i++) {
      const az = -120 + (i / seg) * 240;
      const a = (az * Math.PI) / 180;
      const nse = 0.5 + 0.28 * Math.sin(a * 3.1 + seedA) + 0.14 * Math.sin(a * 7.7 + seedA * 2) + 0.08 * Math.sin(a * 17.3 + seedA * 3);
      const peaks = Math.max(0, Math.sin(a * 5.3 + seedA * 1.7)) ** 3 * 0.5;
      const h = lo + (hi - lo) * Math.min(1, nse * 0.8 + peaks);
      const [x, z] = polar(az, dist + 60);
      const [fx, fz] = polar(az, dist);
      crest.push(new THREE.Vector3(x, h, z));
      foot.push(new THREE.Vector3(fx, -10, fz));
    }
    g.ridge(crest, foot, snow);
  };
  ridge(1480, 70, 260, mobile ? 60 : 120, 1.3, 150);
  ridge(1260, 30, 120, mobile ? 50 : 100, 4.1, 400);
  const mesh = new THREE.Mesh(g.build(), decoMaterial({ sunDir: opts.sunDir ?? new THREE.Vector3(0.7, 0.41, 0.59), sky: opts.sky, haze: 0.0005, floor: 0.015 }));
  mesh.name = 'skyline';
  mesh.frustumCulled = false;
  // after the opaque world, before the sky (depth-tested: the same pixels, fewer shaded)
  mesh.renderOrder = 900;
  const group = new THREE.Group();
  group.name = 'skyline';
  group.add(mesh);
  return group;
}

/**
 * The city just beyond the level (no parallax: it stands where it is): the
 * far bank of the river behind the square, the far bank of the side arm, the
 * blocks right of the Banner Tower and behind the terminals. Cream limestone
 * blocks with arched windows (some lit), slate and copper roofs, a few deco
 * towers with gilt crowns. `avoid` keeps them off other scenery (the
 * viaducts). One draw.
 */
export function createNearBackdrop(opts: { mobile?: boolean; sunDir: THREE.Vector3; sky?: SkyStyle; avoid?: (x: number, z: number, r: number) => boolean; spire?: { x: number; z: number; h: number } }): THREE.Mesh {
  const mobile = !!opts.mobile;
  const r = rnd(4177);
  const g = new DecoGeo();
  const thin = mobile ? 1.6 : 1;
  const block = (x0: number, z0: number, x1: number, z1: number, h: number, y0: number) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    // (keep clear of the viaducts)
    if (opts.avoid?.(cx, cz, Math.hypot(w, d) / 2)) return;
    if (h > 34 && r() < 0.5) {
      decoTower(g, cx, cz, w, d, h * 1.5, r, 0, y0);
      return;
    }
    const seed = r();
    g.box(cx, cz, y0, w, h, d, BLOCK, seed);
    // a cornice, then a slate or copper mansard
    g.box(cx, cz, y0 + h, w + 0.8, 0.6, d + 0.8, TRIM, seed);
    if (r() < 0.7) {
      const rs = r();
      g.box(cx, cz, y0 + h + 0.6, w - 1.2, 2.2, d - 1.2, ROOF, rs);
      g.box(cx, cz, y0 + h + 2.8, w - 3, 1.4, d - 3, ROOF, rs);
    }
    if (r() < 0.12) g.dome(cx, cz, y0 + h + 0.6, Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, 8, 3, METAL, 0.6);
  };
  for (let x = -300; x < 300; x += (22 + r() * 10) * thin) block(x, 196 + r() * 10, x + 14 + r() * 8, 222 + r() * 20, 18 + r() * 30, 2);
  for (let x = -260; x < 260; x += (26 + r() * 12) * thin) block(x, 236 + r() * 10, x + 16 + r() * 8, 262 + r() * 16, 30 + r() * 30, 2);
  for (let z = -120; z < 180; z += (22 + r() * 10) * thin) block(166 + r() * 10, z, 190 + r() * 20, z + 14 + r() * 8, 15 + r() * 18, 2);
  for (let z = -80; z < 60; z += (20 + r() * 8) * thin) block(-140 + r() * 20, z, -74 - r() * 16, z + 14 + r() * 6, 18 + r() * 22, 0);
  for (let x = -120; x < 58; x += (24 + r() * 8) * thin) block(x, -150 + r() * 10, x + 16 + r() * 6, -96, 16 + r() * 20, -8);
  if (opts.spire) {
    // the city's tallest: four setbacks with gilt fins at their corners, a gilt needle, a beacon
    const { x, z, h } = opts.spire;
    const tiers: [number, number, number][] = [[20, -2, h * 0.52], [15, h * 0.52, h * 0.8], [10, h * 0.8, h * 0.95], [6.5, h * 0.95, h]];
    for (const [hw, y0, y1] of tiers) {
      g.box(x, z, y0, hw * 2, y1 - y0, hw * 2, TOWER, 0.07);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box(x + dx * hw, z + dz * hw, y0, 1.6, y1 - y0 + 3, 1.6, METAL, 0.1);
    }
    g.spire(x, z, h, 5, h * 0.22, 8, METAL, 0.1, Math.PI / 8);
    g.box(x, z, h * 1.22, 1.2, 1.2, 1.2, LIGHT, 0);
  }
  const mesh = new THREE.Mesh(g.build(), decoMaterial({ sunDir: opts.sunDir, sky: opts.sky, haze: 0.0008, floor: 0.02 }));
  mesh.name = 'halcyon:backdrop';
  return mesh;
}
