import * as THREE from 'three';
import type { ViewSpec } from '../../core/Engine';
import type { ShotFrame } from '../../gameplay/CameraRig';
import type { FilmSetHandle } from '../FilmStage';
import { MAP_NAMES, PHILISTINE_CITIES, type MapNameId } from '../../content/mapNames';
import { slice } from '../../core/slice';
import { MAP, MapHeights, bitmapTexture, edgeFade, geoBasis, geoToWorld, loadBitmap, worldToGeo } from './mapData';
import { FLOCK_FRAG, FLOCK_VERT, GLOBE_FRAG, GLOBE_VERT, GLOW_FRAG, GLOW_VERT, ROUTE_FRAG, ROUTE_VERT, SKY_FRAG, SKY_VERT, TERRAIN_FRAG, TERRAIN_VERT } from './mapShaders';
import { labelPlan, mapBeats, mapCamPath, routeKeys, scatterHomes, type MapPose } from './mapPlan';
import { MapLabels, type LabelSpec } from './mapLabels';

/**
 * THE REALISTIC 3D MAP of the opening film (CUT v6.1 — P4 'map-exodus', take 'exodus', 10.5 s; docs/intro-script-v6-1.md):
 * the real land from the Nile delta and the Gulf of Suez to the Galilee and the Bashan seen like a satellite view at
 * first light — real elevation and natural colour restored to ~1000 BCE (tools/map/build_map.py, src/assets/map), the
 * relief exaggerated x2.6, the morning sun low in the east baked into soft long shadows, the sea with its depth colour
 * and a soft glint, the aerial perspective of a real atmosphere, the Earth's curvature and the atmosphere's limb. On it
 * the road out of Egypt is walked by a FLOCK OF LIGHT (Ps 78:52; mapPlan.ts): a leading light and many small warm lights
 * behind it, spreading and gathering like sheep, across the wilderness and the Jordan to Gilgal; at `land` they scatter
 * over the land, at `noKing` the leading light goes out (Judg 21:25), and the lens sinks and turns WNW toward the coast
 * where the five Philistine cities kindle — the dissolve lands on P6. Two names orient: Egypt and the Jordan.
 * CUT v6.1 — the two transitions: IN by a MATCH dissolve out of P1 (the map's first second is P1's own view — the hills
 * of Judah from low, looking WNW, the same lens, bank and turn, in P1's rose dawn light; then the lens soars up and back
 * into the region), OUT by a dissolve into P6 (the lens comes down low over the western hills toward the coast, the
 * horizon where P6's is, the cities' glows swelling in a warm, dusty cream-gold light like P6's).
 *
 *   const handle = await createMapSet(engine, { onProgress });   // a FilmSetHandle ('map'); async, yielding steps
 *   handle.frame('exodus', u, t, out) / enter / tick / focus (null: deep focus) / dispose()
 *
 * Its own scene and camera; no shadow maps, no lights (the light is baked + analytic), one draw per part: sky, globe,
 * terrain, trace, flock (one Points draw), 7 glows (~25 draw calls with the post chain). The terrain mesh: 769 x 721
 * vertices (1.1 M triangles) on desktop, 385 x 361 (0.28 M) on phones; the flock 84 / 70 / 56 / 42 lights per tier.
 * Textures per tier: desktop all 'hi' (2048 px map + 2048 px inset of ~56 m texels + 2048 px globe: ~1.77 MB to
 * download); mobile-high the 2048 px map with the 1024 px inset and globe (~1.08 MB); mobile-low all 'lo' (~0.50 MB).
 * Decoded with createImageBitmap (off the main thread where supported).
 */
export interface MapSetOptions {
  onProgress?: (f: number) => void;
  /** await between heavy steps (FilmStage's context: the film may be playing while the set builds) */
  yieldFrame?: () => Promise<void>;
}

/** what the set reads from the engine (the dev harness passes the same three things) */
export interface MapEngine {
  readonly quality: { readonly tier: string };
  readonly renderer: THREE.WebGLRenderer;
  readonly post: { readonly letterboxBars: number };
}

const smooth01 = (x: number) => {
  const u = Math.max(0, Math.min(1, x));
  return u * u * (3 - 2 * u);
};
const ramp = (t: number, t0: number, d: number) => smooth01((t - t0) / d);

export async function createMapSet(engine: MapEngine, o: MapSetOptions = {}): Promise<FilmSetHandle> {
  const t0 = performance.now();
  const prog = o.onProgress ?? (() => {});
  const yield0 = o.yieldFrame ?? (() => new Promise<void>((r) => setTimeout(r, 0)));
  // build cost per synchronous step (between two yields): the report / the loading wave (window.__map.steps)
  const steps: { step: string; ms: number }[] = [];
  let mark = performance.now();
  const yieldFrame = async (step: string) => {
    steps.push({ step, ms: Math.round((performance.now() - mark) * 10) / 10 });
    await yield0();
    mark = performance.now();
  };
  const tier = engine.quality.tier;
  // desktop: everything 'hi' (~1.77 MB); mobile-high: the 2048 px map with the 1024 px inset and globe (~1.07 MB);
  // mobile-low: all 'lo' (~0.50 MB). The mesh: 769 x 721 vertices on desktop, 385 x 361 on phones.
  const texTier = tier === 'mobile-low' ? 'lo' : 'hi';
  const meshTier = tier.startsWith('mobile') ? 'lo' : 'hi';
  const insetTier = tier.startsWith('mobile') ? 'lo' : 'hi';
  const globeName = tier.startsWith('mobile') ? 'map_globe_lo.webp' : 'map_globe.webp';

  // ---- 1. the assets (fetched and decoded in parallel; createImageBitmap decodes off the main thread)
  const [colorImg, shadeImg, heightImg, globeImg, iColorImg, iShadeImg] = await Promise.all([
    loadBitmap(`map_color_${texTier}.webp`),
    loadBitmap(`map_shade_${texTier}.webp`),
    loadBitmap(`map_height_${meshTier}.webp`),
    loadBitmap(globeName),
    loadBitmap(`map_inset_color_${insetTier}.webp`),
    loadBitmap(`map_inset_shade_${insetTier}.webp`),
  ]);
  prog(0.3);
  steps.push({ step: 'fetch+decode (async, off-thread)', ms: Math.round(performance.now() - t0) });
  await yield0();
  mark = performance.now();
  const heights = await MapHeights.create(heightImg, () => yieldFrame('heights (strip)'));
  if ('close' in heightImg) heightImg.close();
  const ground = (lon: number, lat: number) => Math.max(heights.at(lon, lat), 0) * edgeFade(lon, lat) + Math.min(heights.at(lon, lat), 0);
  prog(0.38);

  const scene = new THREE.Scene();
  scene.matrixWorldAutoUpdate = true;
  const camera = new THREE.PerspectiveCamera(30, 1, 100, 4e6);
  const earthC = new THREE.Vector3(0, -MAP.R, 0);

  // the morning sun (a fixed world direction: the bake's azimuth / elevation at the region's centre)
  const az = THREE.MathUtils.degToRad(MAP.sunAz), el = THREE.MathUtils.degToRad(MAP.sunEl);
  const sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
  const common = {
    uCamPos: { value: new THREE.Vector3() },
    uEarthC: { value: earthC },
    uR: { value: MAP.R },
    uSunDir: { value: sunDir },
    uSunCol: { value: new THREE.Color(1.0, 0.84, 0.65) },
    uSkyCol: { value: new THREE.Color(0.42, 0.52, 0.72) },
    // the light's balance (shared by the terrain and the far globe: the box never shows against it)
    uSunK: { value: 3.55 },
    uAmbK: { value: 0.46 },
    uSat: { value: 1.14 },
    uHazeK: { value: 2.1e-5 },
    uHazeH: { value: 8000 },
    uHazeTint: { value: new THREE.Vector3(0.5, 0.74, 1.2) },
    uHazeCol: { value: new THREE.Color(0.37, 0.48, 0.67) },
    uHazeSun: { value: new THREE.Color(1.18, 0.86, 0.58) },
  };

  // ---- 2. the terrain mesh (lon / lat grid on the sphere, exaggerated relief; built in yielding row bands)
  const W = heights.w, H = heights.h;
  const pos = new Float32Array(W * H * 3);
  const uv = new Float32Array(W * H * 2);
  const b = MAP.bbox;
  const v = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const lat = b.lat1 - (j / (H - 1)) * (b.lat1 - b.lat0);
    for (let i = 0; i < W; i++) {
      const lon = b.lon0 + (i / (W - 1)) * (b.lon1 - b.lon0);
      const h = heights.data[j * W + i];
      const hh = h > 0 ? h * edgeFade(lon, lat) : h;
      geoToWorld(lon, lat, hh, v);
      const k = j * W + i;
      pos[k * 3] = v.x;
      pos[k * 3 + 1] = v.y;
      pos[k * 3 + 2] = v.z;
      uv[k * 2] = (lon - b.lon0) / (b.lon1 - b.lon0);
      uv[k * 2 + 1] = (b.lat1 - lat) / (b.lat1 - b.lat0);
    }
    if (slice.due()) await slice.pause();
    // (small bands while the code is still cold, then 64 rows)
    if ((j < 128 && (j & 15) === 15) || (j & 63) === 63) {
      prog(0.38 + 0.3 * (j / H));
      await yieldFrame('mesh rows');
    }
  }
  const idx = new Uint32Array((W - 1) * (H - 1) * 6);
  let n = 0;
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, c = a + W;
      idx[n++] = a;
      idx[n++] = c;
      idx[n++] = a + 1;
      idx[n++] = a + 1;
      idx[n++] = c;
      idx[n++] = c + 1;
    }
    if ((j & 127) === 127) await yieldFrame('mesh index');
    else if (slice.due()) await slice.pause();
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  // (no bounding sphere: the terrain is never frustum-culled — it would cost a pass over 0.55 M vertices)
  prog(0.72);
  await yieldFrame('mesh index');

  const tColor = bitmapTexture(colorImg, true);
  const tShade = bitmapTexture(shadeImg, false);
  const tGlobe = bitmapTexture(globeImg, true);
  const tIColor = bitmapTexture(iColorImg, true);
  const tIShade = bitmapTexture(iShadeImg, false);
  const ib = MAP.inset;
  const terrainMat = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: {
      ...common,
      tColor: { value: tColor },
      tShade: { value: tShade },
      uTime: { value: 0 },
      uTexel: { value: new THREE.Vector2(1 / colorImg.width, 1 / colorImg.height) },
      tIColor: { value: tIColor },
      tIShade: { value: tIShade },
      uInset: {
        value: new THREE.Vector4(
          (ib.lon0 - b.lon0) / (b.lon1 - b.lon0), (b.lat1 - ib.lat1) / (b.lat1 - b.lat0),
          (ib.lon1 - b.lon0) / (b.lon1 - b.lon0), (b.lat1 - ib.lat0) / (b.lat1 - b.lat0),
        ),
      },
      uITexel: { value: new THREE.Vector2(1 / iColorImg.width, 1 / iColorImg.height) },
      uBoxDeg: { value: new THREE.Vector2(b.lon1 - b.lon0, b.lat1 - b.lat0) },
    },
  });
  const terrain = new THREE.Mesh(tGeo, terrainMat);
  terrain.frustumCulled = false;
  scene.add(terrain);

  // ---- 3. the far globe (relief-free; the map box is cut out of it) and the sky with the limb
  const toEcef = (() => {
    // world (tangent frame at C0, relative to the Earth's centre) -> ECEF
    const lo = THREE.MathUtils.degToRad(MAP.center.lon), la = THREE.MathUtils.degToRad(MAP.center.lat);
    const up = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la));
    const east = new THREE.Vector3(-Math.sin(lo), Math.cos(lo), 0);
    const north = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la));
    // world x = east, y = up, z = -north  =>  ecef = east * x + up * y - north * z
    return new THREE.Matrix3().set(east.x, up.x, -north.x, east.y, up.y, -north.y, east.z, up.z, -north.z);
  })();
  const g = MAP.globe;
  const globeMat = new THREE.ShaderMaterial({
    vertexShader: GLOBE_VERT,
    fragmentShader: GLOBE_FRAG,
    uniforms: {
      ...common,
      tGlobe: { value: tGlobe },
      uToEcef: { value: toEcef },
      uGlobeBox: { value: new THREE.Vector4(g.lon0, g.lon1, g.lat0, g.lat1) },
      uHole: { value: new THREE.Vector4(b.lon0 + 0.03, b.lon1 - 0.03, b.lat0 + 0.03, b.lat1 - 0.03) },
    },
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(MAP.R - 300, 192, 96), globeMat);
  globe.position.copy(earthC);
  globe.frustumCulled = false;
  scene.add(globe);

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      ...common,
      uZenith: { value: new THREE.Color(0.1, 0.24, 0.58) },
      uHorizon: { value: new THREE.Color(0.78, 0.8, 0.86) },
      uSkyH: { value: 9000 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  prog(0.78);
  await yieldFrame('materials');

  // ---- 4. the road: a smooth curve draped over the land; the leading light walks it on the beats, the flock follows
  const keys = routeKeys();
  const BT = mapBeats();
  const SAMPLES = meshTier === 'hi' ? 900 : 520;
  const curve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(k.lon, k.lat, 0)), false, 'centripetal', 0.5);
  const geoPts = curve.getSpacedPoints(SAMPLES - 1);
  const rPos: THREE.Vector3[] = geoPts.map((p) => geoToWorld(p.x, p.y, ground(p.x, p.y) + 450 / MAP.exag));
  const along = new Float32Array(SAMPLES);
  for (let i = 1; i < SAMPLES; i++) along[i] = along[i - 1] + rPos[i].distanceTo(rPos[i - 1]);
  const total = along[SAMPLES - 1];
  for (let i = 0; i < SAMPLES; i++) along[i] /= total;
  // the time each sample is reached (timed keys; arc length between them; the rest at Kadesh)
  const keyIdx = keys.map((k) => {
    let best = 0, bd = 1e9;
    for (let i = 0; i < SAMPLES; i++) {
      const d = (geoPts[i].x - k.lon) ** 2 + (geoPts[i].y - k.lat) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  });
  const timed = keys.map((k, i) => ({ i: keyIdx[i], t: k.t, hold: k.hold ?? 0 })).filter((k) => k.t !== undefined) as { i: number; t: number; hold: number }[];
  const sTime = new Float32Array(SAMPLES);
  for (let s = 0; s < timed.length - 1; s++) {
    const A = timed[s], Bk = timed[s + 1];
    const tA = A.t + A.hold, tB = Bk.t;
    const la = along[A.i], lb = along[Bk.i];
    for (let i = A.i; i <= Bk.i; i++) sTime[i] = tA + ((along[i] - la) / Math.max(1e-6, lb - la)) * (tB - tA);
  }
  for (let i = 0; i < timed[0].i; i++) sTime[i] = timed[0].t;
  for (let i = timed[timed.length - 1].i; i < SAMPLES; i++) sTime[i] = timed[timed.length - 1].t;
  /** the route fraction the leading light has reached at shot time t */
  const headAt = (t: number): number => {
    if (t <= sTime[0]) return 0;
    if (t >= sTime[SAMPLES - 1]) return 1;
    let lo = 0, hi = SAMPLES - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (sTime[m] <= t) lo = m;
      else hi = m;
    }
    const f = (t - sTime[lo]) / Math.max(1e-6, sTime[hi] - sTime[lo]);
    return along[lo] + (along[hi] - along[lo]) * f;
  };
  /** the point (and the ground's tangent / side directions) at route fraction f */
  const tng = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3();
  const posOnRoute = (f: number, out: THREE.Vector3, withSide = false) => {
    const ff = Math.max(0, Math.min(1, f));
    let lo = 0, hi = SAMPLES - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (along[m] <= ff) lo = m;
      else hi = m;
    }
    const k = (ff - along[lo]) / Math.max(1e-9, along[hi] - along[lo]);
    out.copy(rPos[lo]).lerp(rPos[hi], Math.max(0, Math.min(1, k)));
    if (withSide) {
      tng.copy(rPos[hi]).sub(rPos[lo]).normalize();
      upv.copy(out).sub(earthC).normalize();
      side.crossVectors(tng, upv).normalize();
    }
    return out;
  };
  // a faint trace of the road behind the flock (where the people walked), never brighter than the lights
  const rv = SAMPLES * 2;
  const rp = new Float32Array(rv * 3), rprev = new Float32Array(rv * 3), rnext = new Float32Array(rv * 3);
  const rside = new Float32Array(rv), ralong = new Float32Array(rv);
  for (let i = 0; i < SAMPLES; i++) {
    const p = rPos[i], pp = rPos[Math.max(0, i - 1)], pn = rPos[Math.min(SAMPLES - 1, i + 1)];
    for (let s = 0; s < 2; s++) {
      const k = i * 2 + s;
      rp.set([p.x, p.y, p.z], k * 3);
      rprev.set([pp.x, pp.y, pp.z], k * 3);
      rnext.set([pn.x, pn.y, pn.z], k * 3);
      rside[k] = s === 0 ? -1 : 1;
      ralong[k] = along[i];
    }
  }
  const ridx: number[] = [];
  for (let i = 0; i < SAMPLES - 1; i++) {
    const a = i * 2;
    ridx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rGeo.setAttribute('aPrev', new THREE.BufferAttribute(rprev, 3));
  rGeo.setAttribute('aNext', new THREE.BufferAttribute(rnext, 3));
  rGeo.setAttribute('aSide', new THREE.BufferAttribute(rside, 1));
  rGeo.setAttribute('aAlong', new THREE.BufferAttribute(ralong, 1));
  rGeo.setIndex(ridx);
  const res = new THREE.Vector2(640, 360);
  const routeMat = new THREE.ShaderMaterial({
    vertexShader: ROUTE_VERT,
    fragmentShader: ROUTE_FRAG,
    uniforms: {
      uRes: { value: res },
      uWidth: { value: 1.6 },
      uHead: { value: 0 },
      uTail: { value: 0.05 },
      uDim: { value: 0.3 },
      uFade: { value: 1 },
      uCol: { value: new THREE.Color(1.0, 0.62, 0.3).multiplyScalar(0.55) },
      uHeadCol: { value: new THREE.Color(1.0, 0.86, 0.6).multiplyScalar(0.5) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const route = new THREE.Mesh(rGeo, routeMat);
  route.frustumCulled = false;
  route.renderOrder = 5;
  scene.add(route);

  // ---- 5. the flock of light (Ps 78:52): a leader and its followers — point sprites, positions per frame on the CPU
  // (one Points draw; ~150 lights cost a few microseconds of CPU per frame)
  const NF = tier === 'desktop-high' ? 150 : tier === 'desktop-medium' ? 124 : tier === 'mobile-high' ? 104 : 80;
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  /** per follower: how far behind the leader it walks (SECONDS of the leader's road: where the leader rests, the flock
   *  closes up behind it; where it moves on, the flock strings out), its place across the flock and along it at a rest,
   *  wobble phases, size, warmth, brightness, and when it leaves Gilgal for its inheritance */
  const fol = Array.from({ length: NF }, () => ({
    lagT: 0.03 + 0.3 * Math.pow(rnd(), 1.3),
    side: gauss(),
    fwd: gauss(),
    ph1: rnd() * 6.283, ph2: rnd() * 6.283, f1: 0.5 + rnd() * 0.7, f2: 0.7 + rnd() * 1.1,
    size: 6.0 + rnd() * 4.0,
    warm: 0.55 + rnd() * 0.45,
    bright: 0.6 + rnd() * 0.4,
    delay: rnd(),
  }));
  const homes = scatterHomes(NF).map((h) => geoToWorld(h.lon, h.lat, ground(h.lon, h.lat) + 450 / MAP.exag));
  const gilgalP = posOnRoute(1, new THREE.Vector3());
  const NP = NF + 1; // + the leader
  const fPos = new Float32Array(NP * 3), fSize = new Float32Array(NP), fAlpha = new Float32Array(NP), fWarm = new Float32Array(NP);
  const fGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(fAlpha, 1).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(fSize, 1).setUsage(THREE.DynamicDrawUsage);
  fGeo.setAttribute('position', posAttr);
  fGeo.setAttribute('aSize', sizeAttr);
  fGeo.setAttribute('aAlpha', alphaAttr);
  fGeo.setAttribute('aWarm', new THREE.BufferAttribute(fWarm, 1));
  for (let i = 0; i < NF; i++) fWarm[i] = fol[i].warm;
  fWarm[NF] = 0.08;
  const flockMat = new THREE.ShaderMaterial({
    vertexShader: FLOCK_VERT,
    fragmentShader: FLOCK_FRAG,
    uniforms: {
      uPx: { value: 1 },
      uCore: { value: new THREE.Color(1.0, 0.95, 0.84).multiplyScalar(3.0) },
      uWarmCol: { value: new THREE.Color(1.0, 0.66, 0.3).multiplyScalar(2.6) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const flock = new THREE.Points(fGeo, flockMat);
  flock.frustumCulled = false;
  flock.renderOrder = 7;
  scene.add(flock);

  // glows: the leader's halo, Gilgal at the end of the road, the five Philistine cities
  const quad = new THREE.PlaneGeometry(2, 2);
  const glow = (col: THREE.Color, size: number) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uRes: { value: res }, uSizePx: { value: size }, uCol: { value: col }, uAlpha: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const me = new THREE.Mesh(quad, m);
    me.frustumCulled = false;
    me.renderOrder = 6;
    scene.add(me);
    return { mesh: me, mat: m };
  };
  const head = glow(new THREE.Color(1.0, 0.88, 0.64).multiplyScalar(1.6), 26);
  const gilgalGlow = glow(new THREE.Color(1.0, 0.82, 0.52).multiplyScalar(1.5), 30);
  gilgalGlow.mesh.position.copy(gilgalP);
  const N = MAP_NAMES;
  const at = (id: MapNameId, lift = 600) => geoToWorld(N[id].lon, N[id].lat, ground(N[id].lon, N[id].lat) + lift / MAP.exag);
  const cityGlows = PHILISTINE_CITIES.map((id) => {
    const gl = glow(new THREE.Color(1.0, 0.42, 0.18).multiplyScalar(2.4), 22);
    gl.mesh.position.copy(at(id));
    return { id, ...gl };
  });
  prog(0.86);
  await yieldFrame('route + flock');

  // ---- 6. the names that orient (DOM, the film's typography): Egypt, the Jordan
  const LP = labelPlan();
  // (Egypt's name a little east of the delta's centre: a phone held upright sees only the delta's eastern half)
  const egyptAt = geoToWorld(31.3, 30.5, ground(31.3, 30.5) + 800 / MAP.exag);
  const specs: LabelSpec[] = LP.map((l) => ({ id: l.id, pos: l.id === 'egypt' ? egyptAt : at(l.id, 800), at: l.id === 'jordan' ? 'e' : undefined, dot: false }));
  const canvas = engine.renderer.domElement;
  const labels = new MapLabels(canvas.parentElement ?? document.body, specs);
  prog(0.92);

  // ---- 7. the shot logic (pure functions of the shot time: seek-safe)
  const DUR = BT.dur;
  const path = mapCamPath();
  const pose: MapPose = { lon: 0, lat: 0, range: 1, heading: 0, pitch: 45, fov: 30, roll: 0 };
  const E = new THREE.Vector3(), Nn = new THREE.Vector3(), U = new THREE.Vector3(), T = new THREE.Vector3(), F = new THREE.Vector3();
  const Lup = new THREE.Vector3(), Rr = new THREE.Vector3(), Uc = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const tanMatchMax = Math.tan(THREE.MathUtils.degToRad(39));
  let curT = 0;
  let time = 0;
  /**
   * The camera at shot time t. Phones held upright see the taller region from further and higher (the player's
   * portraitLens widens a portrait lens by k afterwards — pre-divided here so the result is this lens) — except at the
   * two matches: the first seconds are P1's own lens and pose (in portrait the same widening the player gives P1) and
   * the last are the low view across the plain (P6's horizon). Under a low lens the horizon is levelled to the local
   * vertical (the map's world up is the region centre's).
   */
  const camAt = (take: string, t: number, out: ShotFrame) => {
    path.pose(take, t, pose);
    const aspect = camera.aspect || 16 / 9;
    const s = Math.max(0, Math.min(1, (1.2 - aspect) / (1.2 - 0.46)));
    const wFix = Math.max(1 - ramp(t, 0.9, 1.3), ramp(t, DUR - 2.6, 2.2));
    const k = aspect < 0.95 ? Math.min(2.6, Math.max(1, (0.45 * 2.39) / aspect)) : 1;
    const tan0 = Math.tan(THREE.MathUtils.degToRad(pose.fov) / 2);
    const tanMap = tan0 * (1 + 0.9 * s);
    const tanMatch = Math.min(tanMatchMax, tan0 * k);
    const tanP = tanMap + (tanMatch - tanMap) * wFix;
    const close = 0.85 * ramp(t, BT.land - 0.6, 2.6);
    const rangeK = 1 + s * (1 - close) * Math.max(0, (0.62 * 2.39) / (1.9 * Math.max(aspect, 0.3)) - 1);
    const range = pose.range * (1 + (rangeK - 1) * (1 - wFix));
    const pitch = Math.min(84, pose.pitch + 9 * s * (1 - wFix));
    geoBasis(pose.lon, pose.lat, E, Nn, U);
    T.copy(geoToWorld(pose.lon, pose.lat, 0, T));
    const hd = THREE.MathUtils.degToRad(pose.heading), pt = THREE.MathUtils.degToRad(pitch);
    F.copy(E).multiplyScalar(Math.sin(hd)).addScaledVector(Nn, Math.cos(hd)).multiplyScalar(Math.cos(pt)).addScaledVector(U, -Math.sin(pt)).normalize();
    out.pos.copy(T).addScaledVector(F, -range);
    out.look.copy(T);
    out.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanP / k));
    let roll = THREE.MathUtils.degToRad(pose.roll);
    const alt = out.pos.distanceTo(earthC) - MAP.R;
    const wl = Math.max(0, Math.min(1, (300_000 - alt) / 250_000));
    if (wl > 0) {
      const g = worldToGeo(out.pos);
      geoBasis(g.lon, g.lat, Rr, Uc, Lup);
      Rr.crossVectors(F, WORLD_UP).normalize();
      Uc.crossVectors(Rr, F);
      Lup.addScaledVector(F, -Lup.dot(F));
      roll -= Math.atan2(Lup.dot(Rr), Lup.dot(Uc)) * wl;
    }
    out.roll = roll;
    return range;
  };

  // ---- the light: the land at first light. Over the wilderness the sun is not yet up — the land lies in the blue of
  // the dawn and the flock's lights read on it; as the flock crosses the Jordan the sun comes up over the land (the
  // forty years compressed: this is a map, not a day) and the coast is in P6's morning light at the dissolve
  const L0 = {
    sunK: common.uSunK.value, ambK: common.uAmbK.value,
    sunCol: common.uSunCol.value.clone(), hazeCol: common.uHazeCol.value.clone(), hazeSun: common.uHazeSun.value.clone(),
    zen: (skyMat.uniforms.uZenith.value as THREE.Color).clone(), hor: (skyMat.uniforms.uHorizon.value as THREE.Color).clone(),
  };
  const dawnSun = new THREE.Color(1.0, 0.58, 0.36);
  const hazeK0 = common.uHazeK.value, skyH0 = skyMat.uniforms.uSkyH.value as number;
  // IN: P1's last frame (a pale rose-cream dawn sky, warm red-brown ridges under a low sun behind the lens, a lavender-
  // rose haze toward the horizon); OUT: P6's first (a bright cream-gold sky, the horizon band glowing with dust)
  const sat0 = common.uSat.value;
  const OPEN = {
    sunK: L0.sunK * 0.95, ambK: L0.ambK * 0.45, sunCol: new THREE.Color(1.0, 0.6, 0.4), hazeCol: new THREE.Color(1.0, 0.8, 0.7),
    hazeSun: new THREE.Color(1.1, 0.74, 0.55), hazeK: hazeK0 * 1.0, zen: new THREE.Color(0.75, 0.66, 0.72), hor: new THREE.Color(1.7, 1.42, 1.18), skyH: 45000, exp: 0.9, sat: 1.45,
  };
  const SHUT = {
    sunK: L0.sunK, ambK: L0.ambK * 0.8, sunCol: new THREE.Color(1.0, 0.8, 0.56), hazeCol: new THREE.Color(0.98, 0.8, 0.5),
    hazeSun: new THREE.Color(1.25, 0.98, 0.6), hazeK: hazeK0 * 1.5, zen: new THREE.Color(0.8, 0.74, 0.56), hor: new THREE.Color(1.5, 1.28, 0.84), skyH: 45000, exp: 1.0, sat: sat0,
  };
  const zen = skyMat.uniforms.uZenith.value as THREE.Color, hor = skyMat.uniforms.uHorizon.value as THREE.Color;
  const mixIn = (g: typeof OPEN, w: number) => {
    if (w <= 0) return;
    common.uSunK.value += (g.sunK - common.uSunK.value) * w;
    common.uAmbK.value += (g.ambK - common.uAmbK.value) * w;
    common.uSunCol.value.lerp(g.sunCol, w);
    common.uHazeCol.value.lerp(g.hazeCol, w);
    common.uHazeSun.value.lerp(g.hazeSun, w);
    common.uHazeK.value += (g.hazeK - common.uHazeK.value) * w;
    zen.lerp(g.zen, w);
    hor.lerp(g.hor, w);
    skyMat.uniforms.uSkyH.value += (g.skyH - (skyMat.uniforms.uSkyH.value as number)) * w;
    common.uSat.value += (g.sat - common.uSat.value) * w;
  };
  /** the light at shot time t (uniforms); returns the exposure factor */
  const lightAt = (t: number) => {
    const d = 0.3 + 0.7 * ramp(t, BT.jordan - 0.5, 2.8);
    common.uSunK.value = L0.sunK * (0.14 + 0.86 * d);
    common.uAmbK.value = L0.ambK * (0.55 + 0.45 * d);
    common.uSunCol.value.copy(dawnSun).lerp(L0.sunCol, d);
    common.uHazeCol.value.copy(L0.hazeCol).multiplyScalar(0.45 + 0.55 * d);
    common.uHazeSun.value.copy(L0.hazeSun).multiplyScalar(0.5 + 0.5 * d);
    common.uHazeK.value = hazeK0;
    zen.copy(L0.zen).multiplyScalar(0.5 + 0.5 * d);
    hor.copy(L0.hor).multiplyScalar(0.5 + 0.5 * d);
    skyMat.uniforms.uSkyH.value = skyH0;
    common.uSat.value = sat0;
    // the matches: P1's light under the dissolve in, eased into the dawn of the map as the lens soars; P6's at the end
    const wo = 1 - ramp(t, 0.8, 1.4), we = ramp(t, DUR - 3.0, 2.6);
    mixIn(OPEN, wo);
    mixIn(SHUT, we);
    let x = 0.8 + 0.2 * d;
    x += (OPEN.exp - x) * wo;
    x += (SHUT.exp - x) * we;
    return { d, x };
  };

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  /** per frame: the light, the flock, its leader, the trace, the glows and the names for the shot time t */
  const shotState = (t: number, camRange: number) => {
    const dawn = lightAt(t).d;
    const hf = headAt(t);
    const ru = routeMat.uniforms;
    ru.uHead.value = hf;
    ru.uFade.value = 0.6 * ramp(t, BT.flock, 0.4) * (1 - ramp(t, BT.land, 1.2));
    // the flock's width (metres): wide in the open wilderness, narrow through the isthmus and at the crossing; it keeps
    // about the same size in the picture while the lens comes down
    const vk = Math.max(0.3, Math.min(1.5, camRange / 800_000));
    const spreadAt = (f: number) => {
      const narrow = Math.min(1, Math.abs(f - along[keyIdx[3]]) / 0.035) * Math.min(1, Math.abs(f - along[keyIdx[keyIdx.length - 3]]) / 0.03);
      return (8_000 + 20_000 * narrow) * vk;
    };
    const started = ramp(t, BT.flock - 0.15, 0.45);
    const scatterT = BT.land;
    const settledAll = ramp(t, scatterT + 1.0, 1.6);
    for (let i = 0; i < NF; i++) {
      const L = fol[i];
      const tw = time;
      // where it walks: the leader's road `lagT` seconds ago (the lag breathes a little: the flock stretches and closes)
      const tl = t - L.lagT * (1 + 0.14 * Math.sin(tw * L.f1 + L.ph1));
      const f = headAt(tl);
      // resting (at Kadesh, at Gilgal): the lights spread round their leader instead of along the road
      const fA = headAt(tl - 0.08);
      const rest = 1 - Math.min(1, Math.abs(f - fA) / 0.006);
      posOnRoute(f, tmpA, true);
      const restR = 27_000 * vk;
      const sp = (spreadAt(f) * (1 - rest) + restR * rest) * (0.45 + 0.55 * started);
      const lat = L.side + 0.25 * Math.sin(tw * L.f2 + L.ph2);
      tmpA.addScaledVector(side, lat * sp).addScaledVector(tng, (L.fwd * 0.8 + 0.15 * Math.sin(tw * L.f2 * 0.7 + L.ph1)) * sp * rest);
      // from `land`: each light leaves for its inheritance (an ease over ~1.5-2.3 s, some a little later)
      const sc = ramp(t, scatterT + L.delay * 0.5, 1.5 + L.delay * 0.8);
      if (sc > 0) tmpA.lerp(homes[i], sc);
      fPos[i * 3] = tmpA.x;
      fPos[i * 3 + 1] = tmpA.y;
      fPos[i * 3 + 2] = tmpA.z;
      // each comes out of Rameses as the line pays out, twinkling; once settled they burn low and unsteady, each on
      // its own (Judg 21:25), and a little dimmer as the sun comes up
      const born = ramp(t, BT.flock - 0.1 + L.lagT * 0.8, 0.25);
      const tw2 = 0.8 + 0.2 * Math.sin(tw * 2.3 + L.ph1) * (1 - settledAll) + settledAll * 0.28 * Math.sin(tw * (3.1 + L.f2 * 2) + L.ph2);
      fAlpha[i] = born * L.bright * tw2 * (1.2 - 0.3 * dawn) * (1 - 0.45 * rest * (1 - sc));
      fSize[i] = L.size * (1 + 0.35 * settledAll);
    }
    // the leader: walks the road ahead of them, rests at Gilgal; at `noKing` it goes out
    posOnRoute(hf, tmpB);
    fPos[NF * 3] = tmpB.x;
    fPos[NF * 3 + 1] = tmpB.y;
    fPos[NF * 3 + 2] = tmpB.z;
    const leader = started * (1 - ramp(t, BT.noKing - 0.1, 0.9));
    fAlpha[NF] = leader * 1.7;
    fSize[NF] = 15;
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    head.mesh.position.copy(tmpB);
    head.mat.uniforms.uAlpha.value = leader * 0.42 * (1 - 0.5 * ramp(t, BT.gilgal - 0.2, 0.4));
    head.mat.uniforms.uSizePx.value = 34 * pxScale;
    // Gilgal: a soft swell as the flock gathers there, gone as it scatters
    const gl = ramp(t, BT.gilgal - 0.15, 0.5) * (1 - ramp(t, BT.land + 0.2, 1.2));
    gilgalGlow.mat.uniforms.uAlpha.value = gl * 0.45 * (0.85 + 0.15 * Math.sin(time * 2.1));
    gilgalGlow.mat.uniforms.uSizePx.value = 40 * pxScale;
    // the five Philistine cities: they kindle on the coast (1 Sam 6:17's order) as the lens turns toward them
    // (CUT v6.1) as the lens comes down toward them they swell into the warm haze of the horizon — where P6's dust and
    // light will be when the dissolve lands
    const near = ramp(t, DUR - 2.6, 2.4);
    cityGlows.forEach((c, i) => {
      const a = ramp(t, BT.noKing + 1.0 + i * 0.2, 0.6);
      c.mat.uniforms.uAlpha.value = a * (0.8 + 0.2 * Math.sin(time * 2.6 + i * 1.3)) * (1 + 0.35 * near);
      c.mat.uniforms.uSizePx.value = 22 * (1 + 1.1 * near) * pxScale;
    });
    // the names
    for (const l of LP) labels.set(l.id, ramp(t, l.t0, 0.5) * (1 - ramp(t, l.t1 - 0.6, 0.6)));
  };

  // ---- 8. the view
  let near = 100, far = 4e6;
  let pxScale = 1;
  const view: ViewSpec = {
    scene,
    camera,
    sky: null,
    // the dawn: a little lower over the wilderness, P6's morning at the end (lightAt)
    exposure: () => 0.52 * lightAt(curT).x,
    atmosphere: { density: 0, godRays: 0 },
    update: (dt, cam) => {
      time += dt;
      // clip planes from the lens' height over the ground under it and the horizon's distance (a pure function of the
      // camera: frame() stays free of side effects — the moving dissolve samples it)
      const alt = Math.max(50, cam.position.distanceTo(earthC) - MAP.R);
      const gg = worldToGeo(cam.position);
      const agl = Math.max(50, alt - Math.max(0, ground(gg.lon, gg.lat)) * MAP.exag);
      const horizon = Math.sqrt(2 * MAP.R * alt + alt * alt);
      near = Math.max(20, agl * 0.3);
      far = Math.max(near * 50, horizon * 1.25 + 300_000);
      if (Math.abs(cam.near - near) > 1e-3 || Math.abs(cam.far - far) > 1e-3) {
        cam.near = near;
        cam.far = far;
        cam.updateProjectionMatrix();
      }
      common.uCamPos.value.copy(cam.position);
      sky.position.copy(cam.position);
      sky.scale.setScalar(far * 0.8);
      sky.updateMatrixWorld();
      terrainMat.uniforms.uTime.value = time;
      const c = engine.renderer.domElement;
      res.set(Math.max(1, c.width) / 2, Math.max(1, c.height) / 2);
      // line widths, light and glow sizes are given in CSS pixels
      const dpr = c.width / Math.max(1, c.clientWidth || c.width);
      routeMat.uniforms.uWidth.value = 1.6 * dpr;
      flockMat.uniforms.uPx.value = dpr * Math.min(1.25, Math.max(0.8, c.clientHeight / 620));
      pxScale = dpr;
      shotState(curT, cam.position.distanceTo(T.copy(geoToWorld(pose.lon, pose.lat, 0, T))));
      labels.show(true);
      labels.update(cam, c, engine.post.letterboxBars, 0.24);
    },
    onLeave: () => labels.show(false),
  };

  steps.push({ step: 'labels + view', ms: Math.round((performance.now() - mark) * 10) / 10 });
  prog(1);
  const buildMs = performance.now() - t0;
  const longest = steps.filter((x) => !x.step.startsWith('fetch')).reduce((m, x) => Math.max(m, x.ms), 0);
  const tris = idx.length / 3 + 192 * 96 * 2 + 48 * 24 * 2 + ridx.length / 3;
  const status = [`map: real terrain ${W}x${H} (${(tris / 1e6).toFixed(2)} M tris), ${texTier} textures, the road + a flock of ${NF} lights, ${specs.length} names; built in ${buildMs.toFixed(0)} ms (longest step ${longest} ms)`];
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1') {
    (window as unknown as Record<string, unknown>).__map = { camAt, headAt, labels, view, camera, scene, buildMs, tris, heights, sTime, steps, longest, NF, fPos, fAlpha };
  }

  const _g = new THREE.Vector3();
  const poseList: { pos: THREE.Vector3; look: THREE.Vector3 }[] = [];
  for (const t of [0.3, BT.flock + 1.5, BT.land, DUR - 0.2]) {
    const f: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30, roll: 0 };
    camAt('exodus', t, f);
    poseList.push({ pos: f.pos, look: f.look });
  }

  return {
    name: 'map',
    view,
    camera,
    status,
    disposed: false,
    precompilePoses: poseList,
    ground(x, z) {
      const gg = worldToGeo(_g.set(x, 0, z));
      return geoToWorld(gg.lon, gg.lat, ground(gg.lon, gg.lat), _g).y;
    },
    frame(take, _u, t, out) {
      camAt(take, t, out);
      return true;
    },
    enter() {
      /* every state is a function of the shot time */
    },
    tick(_take, t, dt) {
      void dt;
      curT = t;
    },
    focus() {
      return null;
    },
    dispose() {
      labels.dispose();
      for (const o2 of [tGeo, globe.geometry, sky.geometry, rGeo, quad, fGeo]) o2.dispose();
      for (const m of [terrainMat, globeMat, skyMat, routeMat, flockMat, head.mat, gilgalGlow.mat, ...cityGlows.map((c) => c.mat)]) m.dispose();
      for (const tx of [tColor, tShade, tGlobe, tIColor, tIShade]) tx.dispose();
      for (const im of [colorImg, shadeImg, globeImg, iColorImg, iShadeImg]) if ('close' in im) im.close();
      scene.clear();
    },
  };
}
