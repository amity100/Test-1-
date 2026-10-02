import * as THREE from 'three';
import type { ViewSpec } from '../../core/Engine';
import type { ShotFrame } from '../../gameplay/CameraRig';
import type { FilmSetHandle } from '../FilmStage';
import { MAP_NAMES, PHILISTINE_CITIES, TRIBE_ORDER, type MapNameId } from '../../content/mapNames';
import { takeBeat, takeDur } from '../FilmCams';
import { MAP, MapHeights, bitmapTexture, edgeFade, geoBasis, geoToWorld, loadBitmap, worldToGeo } from './mapData';
import { GLOBE_FRAG, GLOBE_VERT, GLOW_FRAG, GLOW_VERT, ROUTE_FRAG, ROUTE_VERT, SKY_FRAG, SKY_VERT, TERRAIN_FRAG, TERRAIN_VERT } from './mapShaders';
import { labelTimes, mapCamPath, routeKeys, type MapPose } from './mapPlan';
import { MapLabels, type LabelSpec } from './mapLabels';

/**
 * THE REALISTIC 3D MAP of the opening film (CUT v5 — P4 'map-exodus' take 'exodus' 13 s, P5 'map-tribes' take 'tribes'
 * 9 s; docs/intro-script-v5.md): the real land from the Nile delta and the Gulf of Suez to the Galilee and the Bashan
 * seen like a satellite view at first light — real elevation and natural colour restored to ~1000 BCE
 * (tools/map/build_map.py, src/assets/map), the relief exaggerated x2.6, the morning sun low in the east baked into
 * soft long shadows, the sea with its depth colour and a soft glint, the aerial perspective of a real atmosphere, the
 * Earth's curvature and the atmosphere's limb at the highest point. On it the road out of Egypt draws itself as a
 * glowing ribbon (mapPlan.ts), the biblical names come up as it reaches them (mapLabels.ts, src/content/mapNames.ts),
 * then the tribes over their land and the five Philistine cities glowing on the coast, and the lens comes down toward
 * Ashdod for P6.
 *
 *   const handle = await createMapSet(engine, { onProgress });   // a FilmSetHandle ('map'); async, yielding steps
 *   handle.frame('exodus' | 'tribes', u, t, out) / enter / tick / focus (null: deep focus) / dispose()
 *
 * Its own scene and camera; no shadow maps, no lights (the light is baked + analytic), one draw per part:
 * sky, globe, terrain, route, 7 glows. Per tier: 'hi' textures (2048 px) everywhere but mobile-low ('lo', 1024 px);
 * the terrain mesh 769 x 587 vertices on desktop, 385 x 294 on phones.
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
  const yieldFrame = o.yieldFrame ?? (() => new Promise<void>((r) => setTimeout(r, 0)));
  const tier = engine.quality.tier;
  const texTier = tier === 'mobile-low' ? 'lo' : 'hi';
  const meshTier = tier.startsWith('mobile') ? 'lo' : 'hi';

  // ---- 1. the assets (fetched and decoded in parallel; createImageBitmap decodes off the main thread)
  const [colorImg, shadeImg, heightImg, globeImg, iColorImg, iShadeImg] = await Promise.all([
    loadBitmap(`map_color_${texTier}.webp`),
    loadBitmap(`map_shade_${texTier}.webp`),
    loadBitmap(`map_height_${meshTier}.webp`),
    loadBitmap('map_globe.webp'),
    loadBitmap(`map_inset_color_${texTier}.webp`),
    loadBitmap(`map_inset_shade_${texTier}.webp`),
  ]);
  prog(0.3);
  await yieldFrame();
  const heights = new MapHeights(heightImg);
  if ('close' in heightImg) heightImg.close();
  const ground = (lon: number, lat: number) => Math.max(heights.at(lon, lat), 0) * edgeFade(lon, lat) + Math.min(heights.at(lon, lat), 0);
  prog(0.38);
  await yieldFrame();

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
    uSunCol: { value: new THREE.Color(1.0, 0.8, 0.6) },
    uSkyCol: { value: new THREE.Color(0.42, 0.52, 0.72) },
    uHazeK: { value: 3.0e-5 },
    uHazeH: { value: 8000 },
    uHazeTint: { value: new THREE.Vector3(0.5, 0.74, 1.2) },
    uHazeCol: { value: new THREE.Color(0.44, 0.55, 0.74) },
    uHazeSun: { value: new THREE.Color(1.3, 0.92, 0.6) },
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
    if ((j & 63) === 63) {
      prog(0.38 + 0.3 * (j / H));
      await yieldFrame();
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
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  tGeo.computeBoundingSphere();
  prog(0.72);
  await yieldFrame();

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
      uSunK: { value: 3.3 },
      uAmbK: { value: 0.62 },
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
      uSunK: { value: 3.3 },
      uAmbK: { value: 0.62 },
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
  await yieldFrame();

  // ---- 4. the route: a sampled smooth curve draped over the land, drawn as a screen-space ribbon
  const keys = routeKeys();
  const SAMPLES = meshTier === 'hi' ? 900 : 520;
  const curve = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(k.lon, k.lat, 0)), false, 'centripetal', 0.5);
  const geoPts = curve.getSpacedPoints(SAMPLES - 1);
  const rPos: THREE.Vector3[] = geoPts.map((p) => geoToWorld(p.x, p.y, ground(p.x, p.y) + 450 / MAP.exag));
  const along = new Float32Array(SAMPLES);
  for (let i = 1; i < SAMPLES; i++) along[i] = along[i - 1] + rPos[i].distanceTo(rPos[i - 1]);
  const total = along[SAMPLES - 1];
  for (let i = 0; i < SAMPLES; i++) along[i] /= total;
  // the time each sample is reached (timed keys; arc length between them; holds)
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
  /** the route fraction drawn at P4 shot time t (eased within each timed span) */
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
  const posOnRoute = (f: number, out: THREE.Vector3) => {
    let lo = 0, hi = SAMPLES - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (along[m] <= f) lo = m;
      else hi = m;
    }
    const k = (f - along[lo]) / Math.max(1e-9, along[hi] - along[lo]);
    return out.copy(rPos[lo]).lerp(rPos[hi], Math.max(0, Math.min(1, k)));
  };
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
      uWidth: { value: 3.2 },
      uHead: { value: 0 },
      uTail: { value: 0.08 },
      uDim: { value: 0.42 },
      uFade: { value: 1 },
      uCol: { value: new THREE.Color(1.0, 0.62, 0.26).multiplyScalar(1.7) },
      uHeadCol: { value: new THREE.Color(1.0, 0.88, 0.62).multiplyScalar(2.4) },
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

  // glows: the route's head, Gilgal at the end, the five Philistine cities
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
  const head = glow(new THREE.Color(1.0, 0.86, 0.6).multiplyScalar(2.4), 15);
  const gilgalGlow = glow(new THREE.Color(1.0, 0.82, 0.52).multiplyScalar(2.2), 26);
  const N = MAP_NAMES;
  const at = (id: MapNameId, lift = 600) => geoToWorld(N[id].lon, N[id].lat, ground(N[id].lon, N[id].lat) + lift / MAP.exag);
  gilgalGlow.mesh.position.copy(at('gilgal'));
  const cityGlows = PHILISTINE_CITIES.map((id) => {
    const gl = glow(new THREE.Color(1.0, 0.62, 0.32).multiplyScalar(2.2), 17);
    gl.mesh.position.copy(at(id));
    return { id, ...gl };
  });
  prog(0.86);
  await yieldFrame();

  // ---- 5. the labels (DOM, the film's typography)
  const LT = labelTimes();
  const p4Ids = Object.keys(LT) as MapNameId[];
  // the crowded corner at the end of the road: Jericho west of its point, Gilgal below, the plains of Moab east
  const PLACE: Partial<Record<MapNameId, LabelSpec['at']>> = { jericho: 'w', gilgal: 's', moabPlains: 'e', ashkelon: 'w', gaza: 'w', gath: 'e', ekron: 'e' };
  const specs: LabelSpec[] = [...p4Ids, ...TRIBE_ORDER, ...PHILISTINE_CITIES].map((id) => ({ id, pos: at(id, N[id].kind === 'sea' ? 0 : 800), at: PLACE[id], dot: id !== 'jericho' }));
  const canvas = engine.renderer.domElement;
  const labels = new MapLabels(canvas.parentElement ?? document.body, specs);
  prog(0.92);

  // ---- 6. the shot logic (pure functions of the take and the shot time: seek-safe)
  const DUR4 = takeDur('exodus', 13);
  const DUR5 = takeDur('tribes', 9);
  const TB = takeBeat('tribes', 'tribes', 0.4), CI = takeBeat('tribes', 'cities', 6.2), V5 = takeBeat('tribes', 'verse', 2.6);
  const GG = takeBeat('exodus', 'gilgal', 10.2);
  const path = mapCamPath();
  const pose: MapPose = { lon: 0, lat: 0, range: 1, heading: 0, pitch: 45, fov: 30 };
  const E = new THREE.Vector3(), Nn = new THREE.Vector3(), U = new THREE.Vector3(), T = new THREE.Vector3(), F = new THREE.Vector3();
  let curTake = 'exodus';
  let curT = 0;
  let time = 0;
  /** the camera of a take at shot time t (aspect-aware: portrait phones see the taller region from further and higher) */
  const camAt = (take: string, t: number, out: ShotFrame) => {
    path.pose(take, t, pose);
    const aspect = camera.aspect || 16 / 9;
    // portrait: a taller lens, further away and a little steeper (the region is taller than wide); the player's
    // portraitLens widens a portrait lens by k afterwards — pre-divided here so the result is this lens
    // (P4's first seconds: the portrait framing eases in after the dissolve — at the cut the lens is P3's own, widened
    //  by the player's portraitLens exactly like P3's last frame)
    const ease = take === 'exodus' ? ramp(t, 0.9, 1.6) : 1;
    const s = Math.max(0, Math.min(1, (1.2 - aspect) / (1.2 - 0.46))) * ease;
    const tan0 = Math.tan(THREE.MathUtils.degToRad(pose.fov) / 2);
    const tanP = tan0 * (1 + 0.9 * s);
    const range = pose.range * (1 + s * Math.max(0, (0.62 * 2.39) / (1.9 * Math.max(aspect, 0.3)) - 1));
    const pitch = Math.min(84, pose.pitch + 9 * s);
    const k = aspect < 0.95 ? 1 + (Math.min(2.6, Math.max(1, (0.45 * 2.39) / aspect)) - 1) * ease : 1;
    geoBasis(pose.lon, pose.lat, E, Nn, U);
    T.copy(geoToWorld(pose.lon, pose.lat, ground(pose.lon, pose.lat), T));
    const hd = THREE.MathUtils.degToRad(pose.heading), pt = THREE.MathUtils.degToRad(pitch);
    F.copy(E).multiplyScalar(Math.sin(hd)).addScaledVector(Nn, Math.cos(hd)).multiplyScalar(Math.cos(pt)).addScaledVector(U, -Math.sin(pt)).normalize();
    out.pos.copy(T).addScaledVector(F, -range);
    out.look.copy(T);
    out.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanP / k));
    out.roll = 0;
    return range;
  };

  /** per frame: the route, the glows and the labels for the take's time */
  const shotState = (take: string, t: number) => {
    const p5 = take === 'tribes';
    const t4 = p5 ? DUR4 + t : t; // the P4 clock continues under P5 (the route is finished by then)
    const hf = headAt(t4);
    const ru = routeMat.uniforms;
    ru.uHead.value = hf;
    ru.uFade.value = p5 ? 1 - ramp(t, TB, 1.6) : 1;
    ru.uTail.value = 0.07;
    // the head: visible while drawing, it melts into the Gilgal glow at the end
    const drawing = t4 > sTime[0] - 0.05 && t4 < GG + 0.4;
    head.mat.uniforms.uAlpha.value = drawing ? ramp(t4, sTime[0] - 0.05, 0.25) * (1 - ramp(t4, GG - 0.05, 0.45)) : 0;
    posOnRoute(hf, head.mesh.position);
    // Gilgal's glow: a soft swell at the end of the road, a slow breath, fading as the tribes come up
    const gl = ramp(t4, GG - 0.15, 0.6) * (1 - (p5 ? ramp(t, TB + 0.6, 1.6) : 0));
    gilgalGlow.mat.uniforms.uAlpha.value = gl * (0.85 + 0.15 * Math.sin(time * 2.1));
    gilgalGlow.mat.uniforms.uSizePx.value = (22 + 10 * ramp(t4, GG - 0.15, 0.9) * (1 - ramp(t4, GG + 0.75, 1.5) * 0.4)) * pxScale;
    head.mat.uniforms.uSizePx.value = 15 * pxScale;
    for (const cg of cityGlows) cg.mat.uniforms.uSizePx.value = 17 * pxScale;
    // the Philistine cities: glowing at `cities`, one after another (1 Sam 6:17's order)
    cityGlows.forEach((c, i) => {
      const a = p5 ? ramp(t, CI + i * 0.16, 0.5) : 0;
      c.mat.uniforms.uAlpha.value = a * (0.82 + 0.18 * Math.sin(time * 2.6 + i * 1.3));
    });
    // labels
    const out5 = p5 ? 1 - ramp(t, DUR5 - 0.75, 0.6) : 1;
    for (const id of p4Ids) {
      const t0l = LT[id];
      let a = ramp(t4, t0l, 0.55);
      // the plains of Moab give way to Jericho and Gilgal once the road has crossed (one corner, three names)
      if (id === 'moabPlains') a *= 1 - 0.75 * ramp(t4, LT.jericho - 0.1, 0.6);
      if (p5) a *= id === 'greatSea' ? 1 - ramp(t, CI + 1.2, 0.8) : 1 - ramp(t, TB - 0.3, 0.8);
      labels.set(id, a * out5);
    }
    TRIBE_ORDER.forEach((id, i) => {
      const a = p5 ? ramp(t, TB + 0.25 + i * 0.11, 0.6) * (1 - 0.55 * ramp(t, CI, 0.7)) : 0;
      labels.set(id, a * out5);
    });
    PHILISTINE_CITIES.forEach((id, i) => {
      labels.set(id, p5 ? ramp(t, CI + 0.15 + i * 0.16, 0.5) * out5 : 0);
    });
    void V5;
  };

  // ---- 7. the view
  let near = 100, far = 4e6;
  let pxScale = 1;
  const tmpRange = { v: 1000 };
  const view: ViewSpec = {
    scene,
    camera,
    sky: null,
    exposure: 0.5,
    atmosphere: { density: 0, godRays: 0 },
    update: (dt, cam) => {
      time += dt;
      // clip planes from the lens' distance to its ground point and the horizon's distance
      const alt = Math.max(50, cam.position.distanceTo(earthC) - MAP.R);
      const horizon = Math.sqrt(2 * MAP.R * alt + alt * alt);
      near = Math.max(20, Math.min(tmpRange.v * 0.22, alt * 0.35));
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
      // line widths and glow sizes are given in CSS pixels
      const dpr = c.width / Math.max(1, c.clientWidth || c.width);
      routeMat.uniforms.uWidth.value = 3.2 * dpr;
      pxScale = dpr;
      shotState(curTake, curT);
      labels.show(true);
      labels.update(cam, c, engine.post.letterboxBars, 0.24);
    },
    onLeave: () => labels.show(false),
  };

  prog(1);
  const buildMs = performance.now() - t0;
  const tris = idx.length / 3 + 192 * 96 * 2 + 48 * 24 * 2 + ridx.length / 3;
  const status = [`map: real terrain ${W}x${H} (${(tris / 1e6).toFixed(2)} M tris), ${texTier} textures, route + ${specs.length} labels; built in ${buildMs.toFixed(0)} ms`];
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1') {
    (window as unknown as Record<string, unknown>).__map = { camAt, headAt, labels, view, camera, scene, buildMs, tris, heights, sTime };
  }

  const _g = new THREE.Vector3();
  const poseList: { pos: THREE.Vector3; look: THREE.Vector3 }[] = [];
  for (const [take, t] of [['exodus', 0.3], ['exodus', 3.0], ['exodus', 9.0], ['tribes', 4.0], ['tribes', DUR5 - 0.2]] as [string, number][]) {
    const f: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 30, roll: 0 };
    camAt(take, t, f);
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
      tmpRange.v = camAt(take, t, out);
      return true;
    },
    enter(take) {
      curTake = take;
    },
    tick(take, t, dt) {
      void dt;
      curTake = take;
      curT = t;
    },
    focus() {
      return null;
    },
    dispose() {
      labels.dispose();
      for (const o2 of [tGeo, globe.geometry, sky.geometry, rGeo, quad]) o2.dispose();
      for (const m of [terrainMat, globeMat, skyMat, routeMat, head.mat, gilgalGlow.mat, ...cityGlows.map((c) => c.mat)]) m.dispose();
      for (const tx of [tColor, tShade, tGlobe, tIColor, tIShade]) tx.dispose();
      for (const im of [colorImg, shadeImg, globeImg, iColorImg, iShadeImg]) if ('close' in im) im.close();
      scene.clear();
    },
  };
}
