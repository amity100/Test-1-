import * as THREE from 'three';
import { shared } from '../../core/Shared';
import type { ViewSpec } from '../../core/Engine';
import type { Shot, ShotFrame } from '../../gameplay/CameraRig';
import { SkySystem } from '../../world/Sky';
import { loadTextures, type TextureSet } from '../../world/Textures';
import { cloudShared, GLSL_CLOUD_WEATHER, landAtmo } from './landAtmo';
import { LandClouds } from './landClouds';
import { GEO, landAssetUrl, LandHeight, loadLandcover, loadTile, PLACES, shadeTexture, type HeightTile } from './landData';
import { buildJudahDressing, loadDressMask, type JudahDressInput } from './landJudah';
import { buildArmyPlaceholders, buildDust, buildRamahGate, mannequinGeometry, roadGlslFor, type Mark } from './landSites';
import { buildAshdod } from './landCoast';
import { buildFlora, grove, scatter } from './landFlora';
import { landMaterial, polarSampler, polarTerrain, type LandTier } from './landTerrain';
import { waterMesh } from './landWater';

export type { Mark } from './landSites';
export { GEO, PLACES } from './landData';

/** The prologue locations (docs/intro-script.md shots 2, 4, 5). Shot 3 (Rachel's tomb) is filmed in the game world. */
export type LandLocation = 'judah' | 'coast' | 'ramah';

export interface LandSetOptions {
  renderer: THREE.WebGLRenderer;
  quality: { name: 'low' | 'medium' | 'high'; shadowSize?: number; texMax?: number; anisotropy?: number };
  location: LandLocation;
  /** engine.tex (world textures, for the ground-level sets); loaded when absent and needed */
  tex?: TextureSet;
  onProgress?: (f: number, label: string) => void;
}

/** Sun (SkySystem degrees: elevation, azimuth from +Z (south) toward +X (east)) and exposure per location. */
export const LAND_LIGHT: Record<LandLocation, { elevation: number; azimuth: number; exposure: number }> = {
  // dawn (visual-bible 3.11 / §4: rising behind Moab): the sun just clear of the plateau, a little north of the
  // camera's axis so the hills get raking side light (terraces, olive shadows) and the Dead Sea its glitter path
  judah: { elevation: 4.2, azimuth: 93, exposure: 0.5 },
  // early morning (visual-bible §4 shot 4): the sun in the east BEHIND the camera, which faces west over the host
  // toward Ashdod, the dunes and the sea — frontal warm light on the Philistines, bronze glints toward the lens
  coast: { elevation: 10, azimuth: 72, exposure: 0.52 },
  // morning at the gate of Ramah
  ramah: { elevation: 15, azimuth: 105, exposure: 0.56 },
};

/**
 * The end of the Judah flight (orchestrator p4): the photographers' dawn view from the east edge of the Bethlehem
 * ridge — a low, long-lens look ESE over the layered ridgelines of the Judean desert, valley fog lying between
 * them, the Dead Sea a molten strip and the level Moab wall under the rising sun. Local metres (x east, z south).
 * az: heading in SkySystem degrees (from +Z toward +X); pitch in degrees; `above` = height over the ridge (m).
 */
export const JUDAH_FINAL = { x: 300, z: -500, above: 118, az: 80, pitch: -4.2, fov: 24 };

/** a point `ahead` m along the final heading and `right` m to its right (local x, z) */
export function judahAhead(ahead: number, right: number): { x: number; z: number } {
  const a = THREE.MathUtils.degToRad(JUDAH_FINAL.az), dx = Math.sin(a), dz = Math.cos(a);
  return { x: JUDAH_FINAL.x + dx * ahead - dz * right, z: JUDAH_FINAL.z + dz * ahead + dx * right };
}

/** valley fog of the dawn inversion (landTerrain TerrainLook.valleyFog), per tier */
const JUDAH_FOG: Record<LandTier, { offset: number; jitter: number; density: number; xMax: number; near: number }> = {
  high: { offset: 16, jitter: 30, density: 1 / 160, xMax: 21000, near: 300 },
  medium: { offset: 16, jitter: 30, density: 1 / 160, xMax: 21000, near: 300 },
  low: { offset: 16, jitter: 30, density: 1 / 160, xMax: 21000, near: 300 },
};

const HAZE_WARM0 = landAtmo.uHazeWarm.value.clone();
const HAZE_COOL0 = landAtmo.uHazeCool.value.clone();

export interface JudahAnchors { focus: THREE.Vector3; bethlehem: THREE.Vector3; deadSea: THREE.Vector3; moab: THREE.Vector3; sea: THREE.Vector3 }
export interface CoastAnchors {
  /** the road polyline (ground points, SW -> NE: the column marches toward the Shephelah) */
  route: THREE.Vector3[];
  /** marching direction (unit, horizontal) and the column's width in metres */
  heading: THREE.Vector3; columnWidth: number;
  /** where the head of the column is at the start of the shots */
  columnHead: THREE.Vector3;
  camera: THREE.Vector3;
  /** Ashdod: top of its tell (centre) and the east gate the column leaves from */
  town: THREE.Vector3; townGate: THREE.Vector3;
}
export interface RamahAnchors { gate: THREE.Vector3; gateYaw: number; samuel: Mark; elders: Mark[]; plazaY: number; altar: THREE.Vector3 }

export interface LandStats { drawCalls: number; triangles: number; terrainTris: number; textures: number; buildMs: number }

/**
 * Film sets of the prologue built on REAL elevation data (NASA SRTM 1", see tools/land/build_dem.py):
 *  - 'judah'  shots 1-2: above a winter dawn cloud deck, descent through it, dawn over the mountains of Judah,
 *             mist in the valleys, the Dead Sea glinting in the east, the mountains of Moab beyond.
 *  - 'coast'  shot 4: the Philistine coastal plain west of Ashdod: road, dust, army placeholders, the sea.
 *  - 'ramah'  shot 5: the modest gateway of Ramah (a hill village of the central highlands; its location is debated —
 *             the set stands on er-Ram's summit), elders' benches, Samuel's altar, marks for Samuel and ~20 elders.
 * Each set owns its THREE.Scene + SkySystem; render it through the game's PostFX via `landView(set, {camera})`.
 */
// small CPU value noise (height mods)
const hsh = (x: number, y: number) => { const t = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return t - Math.floor(t); };
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hsh(xi, yi), b = hsh(xi + 1, yi), c = hsh(xi, yi + 1), d = hsh(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export class LandSet {
  readonly scene = new THREE.Scene();
  readonly sky: SkySystem;
  readonly location: LandLocation;
  readonly tier: LandTier;
  readonly height: LandHeight;
  readonly shots: Record<string, Shot>;
  /** shots in the order of the script */
  readonly sequence: Shot[];
  readonly anchors: { judah?: JudahAnchors; coast?: CoastAnchors; ramah?: RamahAnchors };
  readonly placeholders = new THREE.Group();
  exposure: number;
  /** PostFX atmosphere for the view (the aerial set hazes its own materials: density 0) */
  readonly atmosphere: { density: number; heightFalloff: number; baseHeight: number; godRays: number };
  readonly near: number;
  readonly far: number;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly clouds: LandClouds | null = null;
  private readonly waters: THREE.Mesh[] = [];
  private readonly dust: { material: THREE.ShaderMaterial } | null = null;
  private readonly gameSun = { dir: new THREE.Vector3(), color: new THREE.Color() };
  private readonly focus = new THREE.Vector3();
  private time = 0;
  private terrainTris = 0;
  /** height of the rendered terrain mesh (exact, incl. the curvature drop): put props on it with this */
  meshHeight: (x: number, z: number) => number = () => 0;
  /** judah: haze tints applied while the set is on screen (landAtmo is shared; restored on leave) */
  private hazeTint: { warm: THREE.Color; cool: THREE.Color; lobe: THREE.Vector3 } | null = null;
  private deck: THREE.Vector4 | null = null;
  /** judah: instanced dressing counts (olives, terrace walls, houses) */
  dressCounts: { olives: number; walls: number; houses: number } | null = null;
  private floraTris = 0;
  buildMs = 0;

  static async create(o: LandSetOptions): Promise<LandSet> {
    const t0 = performance.now();
    const prog = o.onProgress ?? (() => {});
    prog(0.05, 'land');
    const localName = o.location;
    const needTex = o.location !== 'judah';
    const [region, local, regLC, locLC, tex, dress] = await Promise.all([
      loadTile('region'),
      loadTile(localName),
      loadLandcover('region', o.quality.anisotropy ?? 4),
      loadLandcover(localName, o.quality.anisotropy ?? 4),
      needTex ? (o.tex ? Promise.resolve(o.tex) : loadTextures(o.renderer, () => {}, o.quality as never)) : Promise.resolve(null),
      o.location === 'judah' ? loadTile('judah').then((t) => loadDressMask(landAssetUrl('judah_dress.webp'), t)).catch(() => null) : Promise.resolve(null),
    ]);
    prog(0.6, 'land');
    const set = new LandSet(o, region, local, regLC, locLC, tex, dress);
    set.buildMs = performance.now() - t0;
    prog(1, 'land');
    return set;
  }

  private constructor(o: LandSetOptions, region: HeightTile, local: HeightTile, regLC: THREE.Texture, locLC: THREE.Texture, tex: TextureSet | null, dress: JudahDressInput['mask'] | null = null) {
    const tier: LandTier = o.quality.name;
    this.tier = tier;
    this.location = o.location;
    const L = LAND_LIGHT[o.location];
    this.exposure = L.exposure;
    this.gameSun.dir.copy(shared.uSunDir.value);
    this.gameSun.color.copy(shared.uSunColor.value);
    const scene = this.scene;
    scene.name = 'land:' + o.location;
    this.disposables.push(regLC, locLC);
    const ground = o.location !== 'judah';
    this.sky = new SkySystem(o.renderer, ground ? (o.quality.shadowSize ?? 2048) : 512);
    scene.add(this.sky.group);
    if (o.location === 'judah') gradeDawnSky(this.sky);
    const mods: ((x: number, z: number, h: number) => number)[] = [];
    this.height = new LandHeight(region, local, mods);
    const anchors: LandSet['anchors'] = {};
    this.anchors = anchors;
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    // ------------------------------------------------------------------ per-location layout
    let focus: THREE.Vector3;
    let roadGlsl: string | undefined;
    let route: THREE.Vector3[] = [];
    if (o.location === 'judah') {
      // the terrain mesh is finest under the final pose of the flight (the polar mesh is foveated round it)
      focus = new THREE.Vector3(JUDAH_FINAL.x, 0, JUDAH_FINAL.z);
      // Herodion's cone is Herod's work (1st c. BCE, heaped on a lower natural hill): take the modern cone off
      const hx = PLACES.herodionHill.x, hz = PLACES.herodionHill.z;
      mods.push((x, z, h) => { const d = Math.hypot(x - hx, z - hz); return d > 420 ? h : h - 48 * Math.pow(1 - THREE.MathUtils.smoothstep(d, 0, 420), 1.6); });
      // bedding steps of the limestone under the near ridge (the 30 m DEM is smooth): 1.85 m risers along the
      // contours in patches, real geometry so the ridge's own silhouette is stepped, not a dune
      mods.push((x, z, h) => {
        const d = Math.hypot(x - JUDAH_FINAL.x, z - JUDAH_FINAL.z);
        if (d > 1600) return h;
        const w = 1 - THREE.MathUtils.smoothstep(d, 700, 1600);
        const ph = h / 1.85 + (vnoise(x * 0.019, z * 0.019) - 0.5) * 1.3;
        const f = ph - Math.floor(ph);
        const step = (Math.floor(ph) + THREE.MathUtils.smoothstep(f, 0.62, 0.97)) * 1.85 - (ph - h / 1.85) * 1.85;
        const on = THREE.MathUtils.smoothstep(vnoise(x * 0.011 + 40, z * 0.011 + 7), 0.35, 0.6);
        return h + (step - h) * 0.75 * on * w + (vnoise(x * 0.07, z * 0.07) - 0.5) * 1.2 * w;
      });
      // rocky knolls and scarps on the crests (sub-DEM relief, 60-160 m): the ridgelines break into ledges and
      // knobs instead of smooth dune crests; fades out by 6 km (the mesh can't carry it farther)
      mods.push((x, z, h) => {
        const d = Math.hypot(x - JUDAH_FINAL.x, z - JUDAH_FINAL.z);
        if (d > 6500) return h;
        const w = 1 - THREE.MathUtils.smoothstep(d, 3500, 6500);
        const r1 = 1 - Math.abs(vnoise(x * 0.0085, z * 0.0085) * 2 - 1), r2 = 1 - Math.abs(vnoise(x * 0.019 + 3, z * 0.019 + 9) * 2 - 1);
        return h + ((r1 * r1 - 0.45) * 7 + (r2 * r2 - 0.45) * 3) * w;
      });
    } else if (o.location === 'coast') {
      // the plain east of Ashdod (the city on its tell, the dune belt and the sea behind it to the west): the host
      // leaves the city's east gate and marches ESE toward the Shephelah (1 Sam 17:1, 13:5)
      const A = PLACES.ashdod;
      focus = new THREE.Vector3(A.x + 2200, 0, A.z + 720);
      const pts2 = [new THREE.Vector2(A.x + 230, A.z + 80), new THREE.Vector2(A.x + 700, A.z + 230), new THREE.Vector2(A.x + 1250, A.z + 390), new THREE.Vector2(A.x + 1750, A.z + 560), new THREE.Vector2(A.x + 2200, A.z + 720), new THREE.Vector2(A.x + 2800, A.z + 950), new THREE.Vector2(A.x + 3600, A.z + 1300), new THREE.Vector2(A.x + 4800, A.z + 1850), new THREE.Vector2(A.x + 6400, A.z + 2400)];
      roadGlsl = roadGlslFor(pts2, 7);
      mods.push((x, z, h) => {
        // road bed: slightly levelled across its width
        let d = 1e9;
        for (let i = 0; i < pts2.length - 1; i++) {
          const a = pts2[i], b = pts2[i + 1];
          const bx = b.x - a.x, bz = b.y - a.y, px = x - a.x, pz = z - a.y;
          const t = Math.max(0, Math.min(1, (px * bx + pz * bz) / (bx * bx + bz * bz)));
          d = Math.min(d, Math.hypot(px - bx * t, pz - bz * t));
        }
        return h - Math.max(0, 1 - d / 12) * 0.25;
      });
      route = pts2.map((p) => new THREE.Vector3(p.x, 0, p.y));
    } else {
      // Ramah: the summit of er-Ram; the gate on its south side, a levelled plaza before it
      let best = { x: PLACES.ramah.x, z: PLACES.ramah.z, h: -1e9 };
      for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
        const x = PLACES.ramah.x + i * 40, z = PLACES.ramah.z + j * 40;
        const h = local.height(x, z);
        if (h > best.h) best = { x, z, h };
      }
      const gx = best.x + 10, gz = best.z + 62;
      const gy = local.height(gx, gz) - 0.4;
      focus = new THREE.Vector3(gx, gy, gz);
      mods.push((x, z, h) => {
        const d = Math.hypot(x - gx, (z - gz) * 1.2);
        const w = 1 - THREE.MathUtils.smoothstep(d, 14, 42);
        // the town mound behind the gate rises a little (the tell)
        const dz = z - gz;
        const inside = dz < -4 ? THREE.MathUtils.smoothstep(-dz, 4, 30) * (1 - THREE.MathUtils.smoothstep(Math.hypot(x - best.x, z - best.z), 70, 120)) : 0;
        return h + (gy - h) * w + inside * 1.5;
      });
    }
    this.focus.copy(focus);
    focus.y = this.height.height(focus.x, focus.z);
    let villageLook: { plaza: THREE.Vector3; center: THREE.Vector2; rIn: number; rOut: number } | undefined;
    if (o.location === 'ramah') {
      // the village sits round the summit, 58 m ring north of the gate (landSites buildRamahGate)
      const yaw = 0.25, cx = focus.x - Math.sin(yaw) * 58, cz = focus.z - Math.cos(yaw) * 58;
      villageLook = { plaza: new THREE.Vector3(focus.x + Math.sin(yaw) * 9, focus.z + Math.cos(yaw) * 9, 24), center: new THREE.Vector2(cx, cz), rIn: 95, rOut: 190 };
    }

    // ------------------------------------------------------------------ sun / sky
    this.sky.setSun(L.elevation, L.azimuth, scene);
    landAtmo.tSkyCube.value = this.sky.cubeTarget.texture;
    landAtmo.uSunDirA.value.copy(shared.uSunDir.value);
    landAtmo.uSunColA.value.copy(shared.uSunColor.value);
    if (!ground) {
      this.sky.sun.castShadow = false;
      this.sky.clouds.visible = false;
    } else {
      this.sky.sun.shadow.bias = -0.0003;
      this.sky.sun.shadow.normalBias = 0.03;
    }
    const sunDir = shared.uSunDir.value.clone();
    // cooler sky fill than the chapter's golden-hour preset: the land in shade reads blue-violet at dawn
    this.sky.hemi.color.setRGB(0.62, 0.72, 1.0);
    this.sky.hemi.groundColor.setRGB(0.32, 0.25, 0.2);
    this.sky.hemi.intensity = ground ? 0.5 : 0.62;
    scene.environmentIntensity = ground ? 1.0 : 0.7;
    if (o.location === 'judah') {
      // backlit dawn: the slopes facing the lens are in shade and read blue-violet (the env capture of the dawn sky
      // is dominated by the orange horizon, so it is turned down; the blue sky dome carries the fill)
      this.sky.hemi.color.setRGB(0.42, 0.5, 1.0);
      this.sky.hemi.groundColor.setRGB(0.26, 0.2, 0.24);
      this.sky.hemi.intensity = 0.78;
      scene.environmentIntensity = 0.15;
      // rose-gold first light on the crests (the physical sun at 4 deg is a deep orange)
      this.sky.sun.color.multiply(new THREE.Color(1.0, 0.84, 0.9));
    }

    // ------------------------------------------------------------------ terrain
    const regShade = shadeTexture(region, new LandHeight(region, null), sunDir, { maxDist: 45000 });
    const locShade = shadeTexture(local, this.height, sunDir, { maxDist: 30000, useMods: true });
    this.disposables.push(regShade, locShade);
    const nTheta = tier === 'high' ? 448 : tier === 'medium' ? 320 : 200;
    const polarOpts = { nTheta, r0: ground ? 0.8 : 20, rMax: 150000 };
    const geo = polarTerrain(this.height, focus.x, focus.z, {
      ...polarOpts,
      underwater: (x) => (x < -30000 ? 0 : x > 12000 && x < 60000 ? GEO.deadSea : null),
    });
    this.meshHeight = polarSampler(geo, focus.x, focus.z, polarOpts);
    this.terrainTris = (geo.index?.count ?? 0) / 3;
    const tmat = landMaterial({ regTile: region, regShade, regLC, locTile: local, locShade, locLC }, {
      mist: o.location === 'judah' ? 1 : 0,
      mistColor: new THREE.Color(0.95, 0.82, 0.74),
      mistTop: 650,
      cloudShadowGlsl: o.location === 'judah' ? GLSL_CLOUD_WEATHER : undefined,
      near: ground ? tex : null,
      roadGlsl,
      haze: !ground,
      terraces: o.location === 'judah',
      nearHills: o.location === 'judah',
      valleyFog: o.location === 'judah' ? JUDAH_FOG[tier] : undefined,
      village: villageLook,
    }, tier);
    const terrain = new THREE.Mesh(geo, tmat);
    terrain.name = 'land:terrain';
    terrain.frustumCulled = false;
    terrain.receiveShadow = ground;
    scene.add(terrain);
    this.disposables.push(geo, tmat);
    landAtmo.uHaze.value.w = ground ? 0 : 1;

    // ------------------------------------------------------------------ water: the Mediterranean and the Dead Sea
    const sea = waterMesh({ x0: -140000, x1: -30000, z0: -150000, z1: 150000, level: 0, cx: focus.x, cz: focus.z, deep: new THREE.Color(0.012, 0.045, 0.075), glitter: 1, name: 'sea' });
    const ds = waterMesh({ x0: 14000, x1: 48000, z0: -20000, z1: 60000, level: GEO.deadSea, cx: focus.x, cz: focus.z, deep: new THREE.Color(0.02, 0.07, 0.075), glitter: 1.2, name: 'deadsea' });
    for (const w of [sea, ds]) { scene.add(w); this.waters.push(w); this.disposables.push(w.geometry, w.material as THREE.Material); }

    // ------------------------------------------------------------------ location content
    const q = (x: number, z: number) => this.height.height(x, z);
    if (o.location === 'judah') {
      this.clouds = new LandClouds(tier, { x0: -75000, x1: 70000, z0: -70000, z1: 80000 });
      // dawn cloud sea: rose-gold sunlit tops, blue-violet shade in the troughs, lavender underside
      const cu = this.clouds.uniforms;
      (cu.uSunTint.value as THREE.Color).setRGB(1.0, 0.8, 0.66);
      (cu.uAmbTop.value as THREE.Color).setRGB(0.27, 0.31, 0.62);
      (cu.uAmbBottom.value as THREE.Color).setRGB(0.24, 0.2, 0.3);
      cu.uSunI.value = 9.5;
      // aerial perspective: bluer away from the sun, so the Moab wall reads as a blue-violet silhouette
      this.hazeTint = { warm: new THREE.Color(1.0, 0.72, 0.6), cool: new THREE.Color(0.44, 0.52, 1.05), lobe: new THREE.Vector3(30, 2.2, 0.82) };
      // the deck ends over the ridge east of Bethlehem: the flight comes out from under it into the open dawn
      this.deck = new THREE.Vector4(1850, 2450, -1400, 1.0);
      // stronger, lower aerial perspective: each farther ridge bluer and paler; the ray to Moab's top passes above
      // most of it (the wall stays a sharp dark silhouette), the rift below is filled with glowing haze
      landAtmo.uHaze.value.x = 6.2e-5;
      landAtmo.uHaze.value.y = 1 / 820;
      scene.add(this.clouds.mesh);
      this.disposables.push(this.clouds);
      const bl = new THREE.Vector3(PLACES.bethlehem.x, 0, PLACES.bethlehem.z); bl.y = q(bl.x, bl.z);
      anchors.judah = {
        focus: focus.clone(), bethlehem: bl,
        deadSea: new THREE.Vector3(PLACES.deadSeaNorth.x, GEO.deadSea, PLACES.deadSeaNorth.z + 6000),
        moab: new THREE.Vector3(PLACES.nebo.x, q(PLACES.nebo.x, PLACES.nebo.z), PLACES.nebo.z),
        sea: new THREE.Vector3(-60000, 0, 0),
      };
    } else if (o.location === 'coast') {
      for (const p of route) p.y = q(p.x, p.z);
      const heading = new THREE.Vector3().subVectors(route[route.length - 1], route[0]).setY(0).normalize();
      const count = tier === 'high' ? 900 : tier === 'medium' ? 560 : 300;
      const headAt = focus.clone(); headAt.y = q(headAt.x, headAt.z);
      // the column trails back from its head toward the city gate
      const trail = [headAt, ...route.slice().reverse().filter((p) => p.x < headAt.x - 1)];
      const army = buildArmyPlaceholders(trail, count, q);
      this.placeholders.add(army.group);
      this.disposables.push(army);
      const dust = buildDust(trail, tier === 'low' ? 70 : 190, shared.uSunDir.value, shared.uSunColor.value, 900);
      scene.add(dust.mesh);
      this.dust = dust;
      this.disposables.push(dust);
      // Ashdod on its tell, behind the host
      const town = buildAshdod(tex!, tier, new THREE.Vector3(PLACES.ashdod.x, 0, PLACES.ashdod.z), q, rnd);
      scene.add(town.group);
      this.disposables.push(town);
      // the plain: scrub along the balks and the road, olive groves, sycamore figs (1 Kings 10:27) near the fields
      const onRoad = (x: number, z: number) => {
        let d = 1e9;
        for (let i = 0; i < route.length - 1; i++) {
          const a = route[i], b = route[i + 1];
          const bx = b.x - a.x, bz = b.z - a.z, px = x - a.x, pz = z - a.z;
          const t = Math.max(0, Math.min(1, (px * bx + pz * bz) / (bx * bx + bz * bz)));
          d = Math.min(d, Math.hypot(px - bx * t, pz - bz * t));
        }
        return d;
      };
      const offTown = (x: number, z: number) => Math.hypot(x - PLACES.ashdod.x, z - PLACES.ashdod.z) > 360;
      const k = tier === 'high' ? 1 : tier === 'medium' ? 0.6 : 0.3;
      const camC = new THREE.Vector3(headAt.x + heading.x * 250, 0, headAt.z + heading.z * 250);
      const lists = {
        bush: [
          // (land p4: slimmed ~45 % so the set + the PhilistineHost (~1.3 M) stay under the 8 M desktop-high budget)
          ...scatter(Math.round(380 * k), camC.x, camC.z, 700, 700, rnd, [0.7, 1.5], (x, z) => onRoad(x, z) > 9),
          ...scatter(Math.round(260 * k), camC.x, camC.z, 200, 200, rnd, [0.8, 1.7], (x, z) => onRoad(x, z) > 7),
          ...scatter(Math.round(480 * k), headAt.x - 900, headAt.z - 300, 1800, 1100, rnd, [0.8, 1.6], (x, z) => onRoad(x, z) > 9 && offTown(x, z)),
        ],
        olive: [
          ...grove(headAt.x - 500, headAt.z + 420, 260, 140, 9, 0.35, rnd, [0.9, 1.2], (x, z) => onRoad(x, z) > 14),
          ...grove(headAt.x + 380, headAt.z - 380, 200, 120, 9, 0.3, rnd, [0.9, 1.15], (x, z) => onRoad(x, z) > 14),
          ...grove(headAt.x - 1600, headAt.z - 650, 300, 160, 10, 0.4, rnd, [0.9, 1.2], (x, z) => onRoad(x, z) > 14 && offTown(x, z)),
        ].filter((_, i) => i % Math.round(1 / k) === 0),
        oak: scatter(Math.round(40 * k), headAt.x - 600, headAt.z, 1500, 900, rnd, [1.3, 1.8], (x, z) => onRoad(x, z) > 16 && offTown(x, z)),
      };
      const flora = buildFlora(tex!, tier, q, lists, { center: camC, radius: 400 });
      scene.add(flora.group);
      this.disposables.push(flora);
      this.floraTris = flora.triangles;
      const cam = camC.clone(); cam.y = q(cam.x, cam.z);
      anchors.coast = { route, heading, columnWidth: 6.3, columnHead: headAt.clone(), camera: cam, town: new THREE.Vector3(PLACES.ashdod.x, town.top, PLACES.ashdod.z), townGate: town.gate.setY(q(town.gate.x, town.gate.z)) };
    } else if (o.location === 'ramah') {
      const gate = buildRamahGate(tex!, tier, { origin: focus.clone(), yaw: 0.25 }, q, rnd);
      scene.add(gate.group);
      this.disposables.push(...gate.materials);
      for (const m of gate.materials) for (const t of ((m.userData.ownTextures ?? []) as THREE.Texture[])) this.disposables.push(t);
      gate.group.traverse((c) => { if ((c as THREE.Mesh).isMesh) this.disposables.push((c as THREE.Mesh).geometry); });
      // olives on the terraces below the gate, a few figs / terebinths about the village; the beaten-earth plaza
      const fl = buildFlora(tex!, tier, q, {
        olive: gate.terraceOlives.filter((_, i) => tier !== 'low' || i % 2 === 0),
        oak: scatter(tier === 'low' ? 3 : 7, focus.x, focus.z - 40, 70, 60, rnd, [0.9, 1.2], (x, z) => Math.hypot(x - focus.x, z - focus.z) > 22),
      }, { center: focus, radius: 90 });
      scene.add(fl.group);
      this.disposables.push(fl);
      this.floraTris = fl.triangles;
      if (tier === ('never' as LandTier)) {
        // (kept for reference) the old paved disc: the terrain shader paints the plaza now (LAND_VILLAGE)
        const pg = new THREE.CircleGeometry(24, 48);
        pg.rotateX(-Math.PI / 2);
        const pp = pg.getAttribute('position') as THREE.BufferAttribute;
        const uv = pg.getAttribute('uv') as THREE.BufferAttribute;
        for (let i = 0; i < pp.count; i++) {
          const x = focus.x + pp.getX(i), z = focus.z + pp.getZ(i);
          pp.setY(i, q(x, z) + 0.04);
          uv.setXY(i, x / 7, z / 7);
        }
        pg.computeVertexNormals();
        const pm = new THREE.MeshStandardMaterial({ color: 0xcfc2ad, roughness: 1, map: tex!.rock, normalMap: tex!.rockN, polygonOffset: true, polygonOffsetFactor: -2 });
        const plaza = new THREE.Mesh(pg, pm);
        plaza.position.set(focus.x, 0, focus.z);
        plaza.receiveShadow = true;
        scene.add(plaza);
        this.disposables.push(pg, pm);
      }
      // placeholders
      const standG = mannequinGeometry(1.72), seatG = mannequinGeometry(1.72, true), samG = mannequinGeometry(1.76);
      const pm = new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.9 });
      const sm = new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.9 });
      for (const e of gate.elders) {
        const m = new THREE.Mesh(e.seated ? seatG : standG, pm);
        m.position.copy(e.pos); if (e.seated) m.position.y -= 0.02; m.rotation.y = e.yaw; m.castShadow = true;
        this.placeholders.add(m);
      }
      const sam = new THREE.Mesh(samG, sm); sam.position.copy(gate.samuel.pos); sam.rotation.y = gate.samuel.yaw; sam.castShadow = true;
      this.placeholders.add(sam);
      this.disposables.push(standG, seatG, samG, pm, sm);
      anchors.ramah = { gate: focus.clone(), gateYaw: 0.25, samuel: gate.samuel, elders: gate.elders, plazaY: focus.y, altar: gate.altar };
    }
    scene.add(this.placeholders);

    // ------------------------------------------------------------------ view parameters and shots
    this.near = ground ? 0.25 : 6;
    this.far = 210000;
    this.atmosphere = ground
      ? { density: o.location === 'coast' ? 0.00009 : 0.00011, heightFalloff: 1 / 900, baseHeight: o.location === 'coast' ? -20 : 500, godRays: o.location === 'coast' ? 0.38 : 0.3 }
      : { density: 0, heightFalloff: 1 / 1800, baseHeight: -400, godRays: 0.35 };
    const { shots, sequence } = this.buildShots();
    this.shots = shots;
    this.sequence = sequence;

    // the inhabited hill country seen at the end of the flight: terrace walls, olive groves, hamlets (landJudah.ts)
    if (o.location === 'judah' && dress) {
      const views: { pos: THREE.Vector3; look: THREE.Vector3 }[] = [];
      for (const e of [0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.97]) { const f = shots.flight.at(e, 0); views.push({ pos: f.pos, look: f.look }); }
      for (const e of [0.2, 0.6, 1]) { const f = shots.judahDawn.at(e, 0); views.push({ pos: f.pos, look: f.look }); }
      const shadeImg = locShade.image as unknown as { data: Uint8Array };
      const dz = buildJudahDressing({
        tier, ground: this.meshHeight, dem: (x, z) => this.height.height(x, z),
        shade: { tile: local, data: shadeImg.data }, mask: dress, sunDir, views,
        mist: { color: new THREE.Color(0.95, 0.82, 0.74), top: 650 },
        fog: JUDAH_FOG[tier],
        // the near ridge of the final pose: hamlets on the visible hilltops right of the axis (1.1 / 1.5 km, found by
        // line of sight on the DEM), olive groves on the slopes
        hamlets: [{ x: 1330, z: -60, r: 46 }, { x: 1780, z: 20, r: 36 }],
        groves: [{ ...judahAhead(330, -140), r: 280 }, { ...judahAhead(820, 90), r: 320 }, { ...judahAhead(520, 260), r: 200 }],
      });
      scene.add(dz.group);
      this.disposables.push(dz);
      this.floraTris = dz.triangles;
      this.dressCounts = dz.counts;
    }
    this.restoreSharedSun();
  }

  // ====================================================================================== shots
  private buildShots(): { shots: Record<string, Shot>; sequence: Shot[] } {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const path = (pts: THREE.Vector3[], looks: THREE.Vector3[], fov: [number, number], duration: number, ease = true): Shot => {
      const pc = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const lc = new THREE.CatmullRomCurve3(looks, false, 'centripetal');
      return { duration, ease, at: (u: number): ShotFrame => ({ pos: pc.getPoint(u), look: lc.getPoint(u), fov: fov[0] + (fov[1] - fov[0]) * u }) };
    };
    const shots: Record<string, Shot> = {};
    let sequence: Shot[] = [];
    if (this.location === 'judah') {
      // THE FLIGHT (orchestrator p4): above the sunlit cloud sea, the sun just over the Moab wall -> dive through the
      // deck -> sink out from under it toward the east edge of the Bethlehem ridge while the lens lengthens ->
      // a low, long-lens tableau: layered ridgelines of the desert receding toward the rift, valley fog between
      // them, the Dead Sea a molten strip, Moab a level wall; the near ridge (terraces, ledges, olives, a hamlet).
      // Keyed on the eased parameter e (CameraRig smoothstep): 7 points = e 0, 1/6, ... 1. The film plays u 0.1-0.78
      // (e 0.03-0.88): above the deck to film s ~4, through it at s ~5-6, the tableau from s ~9.
      const J = JUDAH_FINAL;
      const a = THREE.MathUtils.degToRad(J.az);
      const dx = Math.sin(a), dz = Math.cos(a);
      const g0 = this.height.height(J.x, J.z);
      const C = (back: number, y: number) => V(J.x + dx * back, y, J.z + dz * back);
      const Cg = (back: number, above: number) => { const p = C(back, 0); p.y = Math.max(this.height.height(p.x, p.z), g0 - 40) + above; return p; };
      const tp = Math.tan(THREE.MathUtils.degToRad(-J.pitch));
      const eyeF = g0 + J.above;
      const FP = [C(-13000, 3400), C(-10400, 3180), C(-7400, 2330), C(-4300, 1480), C(-1650, 1010), Cg(-330, J.above + 22), C(110, eyeF - 4)];
      const FL = [
        C(30000, 1500), C(30000, 1250), C(28000, 150), C(20000, -350), C(14000, -380),
        C(10000, eyeF + 16 - 10330 * tp), C(10000, eyeF - 4 - 9890 * tp),
      ];
      const fovK = [46, 45, 43, 36, 28, 23, J.fov];
      const pc = new THREE.CatmullRomCurve3(FP, false, 'centripetal');
      const lc = new THREE.CatmullRomCurve3(FL, false, 'centripetal');
      const fovAt = (e: number) => { const k = Math.min(5.999, Math.max(0, e * 6)); const i = Math.floor(k); const f = k - i; const w = f * f * (3 - 2 * f); return fovK[i] + (fovK[i + 1] - fovK[i]) * w; };
      const sub = (e0: number, e1: number, d: number, ease = true): Shot => ({ duration: d, ease, at: (u: number): ShotFrame => { const e = e0 + (e1 - e0) * u; return { pos: pc.getPoint(e), look: lc.getPoint(e), fov: fovAt(e) }; } });
      shots.cloudSea = sub(0, 0.3, 7);
      shots.descent = sub(0.3, 0.62, 6);
      shots.judahDawn = sub(0.62, 1, 9);
      shots.flight = sub(0, 1, 22);
      shots.panorama = path([V(-3000, 2600, 26000), V(-1500, 2600, 25000)], [V(-3000, 0, -30000), V(-1500, 0, -30000)], [62, 60], 8);
      sequence = [shots.cloudSea, shots.descent, shots.judahDawn];
    } else if (this.location === 'coast') {
      const c = this.anchors.coast!;
      const cam = c.camera;
      const head = c.columnHead;
      const hd = c.heading;
      const side = V(-hd.z, 0, hd.x);
      // wide: from the rise ahead of the column, looking back SW down the road toward the sea and the low sun
      // low, in front of the head of the column, looking back down the road into the dust and the low sun
      const T = (back: number, lat: number, up: number) => { const x = head.x + hd.x * back + side.x * lat, z = head.z + hd.z * back + side.z * lat; return V(x, this.height.height(x, z) + up, z); };
      // THREAT — the establishing wide from a crane ~170 m over the plain, 1 km ahead of the host, looking WNW with the
      //          morning sun behind the camera: the column a long bristling line coming on down the road out of its
      //          dust, Ashdod on its tell behind it, the dune belt, and the sea as a pale band on the horizon
      //          (visual-bible 3.9 MUST: "the Mediterranean as a pale band on the western horizon").
      shots.threat = path([T(1150, 300, 175), T(1020, 270, 160)], [T(-1100, 40, 36), T(-1100, 30, 30)], [21, 19], 8);
      // VISTA — higher and wider, from the south-east: the plain of fields, the host, the city, the dunes, the sea
      shots.vista = path([T(1900, 950, 340), T(1750, 880, 310)], [T(-2600, -250, 0), T(-2600, -220, 0)], [34, 31], 7);
      // COLUMN — low lateral track along the ranks at 24 m, the dust lit from behind
      shots.column = path([T(-10, 26, 1.5), T(-50, 24, 1.6)], [T(-30, 0, 1.8), T(-72, 0, 1.9)], [30, 29], 6);
      // GLINT — long lens on the front ranks: helmets, shields and spear points catching the low sun
      shots.glint = path([T(110, 4, 1.8), T(104, 3.5, 1.8)], [T(-4, 0, 1.5), T(-6, 0, 1.5)], [9, 8.5], 4);
      void cam;
      sequence = [shots.vista, shots.threat, shots.glint];
    } else {
      const r = this.anchors.ramah!;
      const g = r.gate, yaw = r.gateYaw;
      const f = V(Math.sin(yaw), 0, Math.cos(yaw)); // out of the gate
      const s = V(Math.cos(yaw), 0, -Math.sin(yaw)); // along the wall
      const P = (along: number, out: number, up: number) => V(g.x + s.x * along + f.x * out, g.y + up, g.z + s.z * along + f.z * out);
      // (starts looking down on the roofs — the far horizon stays out of the top of frame — and settles level on the gate)
      shots.gateWide = path([P(-14, 34, 16), P(-9, 26, 7), P(-6, 21, 3.2)], [P(0, 2, 0.2), P(0, 3, 1.6), P(0, 4, 1.8)], [44, 40], 7);
      shots.elders = path([P(-13, 8.5, 1.3), P(-6, 9.5, 1.3)], [P(-3, 3.5, 1.1), P(1.5, 3.2, 1.4)], [34, 32], 5);
      shots.samuel = path([P(3.5, 12, 1.55), P(3.0, 11, 1.6)], [P(0, 3.2, 1.55), P(0, 3.2, 1.6)], [26, 24], 4);
      sequence = [shots.gateWide, shots.elders, shots.samuel];
    }
    return { shots, sequence };
  }

  /** frame of a shot at normalised time u (CameraRig easing applied when the shot eases) */
  frame(shot: Shot, u: number): ShotFrame {
    const e = shot.ease !== false ? u * u * (3 - 2 * u) : u;
    return shot.at(e, u * shot.duration);
  }

  showPlaceholders(on: boolean) { this.placeholders.visible = on; }

  /** per frame: sky dome follow, shadow framing around the action, water / cloud / dust time */
  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.time += dt;
    shared.uSunDir.value.copy(landAtmo.uSunDirA.value);
    shared.uSunColor.value.copy(landAtmo.uSunColA.value);
    landAtmo.tSkyCube.value = this.sky.cubeTarget.texture;
    landAtmo.uHaze.value.w = this.location === 'judah' ? 1 : 0;
    if (this.hazeTint) { landAtmo.uHazeWarm.value.copy(this.hazeTint.warm); landAtmo.uHazeCool.value.copy(this.hazeTint.cool); landAtmo.uHazeLobe.value.copy(this.hazeTint.lobe); }
    if (this.deck) { cloudShared.uDeck.value.copy(this.deck); cloudShared.uPuffs.value = 0; }
    cloudShared.uCloudTime.value = this.time;
    for (const w of this.waters) (w.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    if (this.dust) this.dust.material.uniforms.uTime.value = this.time;
    // shadows centred ahead of the camera (ground sets)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
    const f = this.location === 'judah' ? this.focus : new THREE.Vector3().copy(camera.position).addScaledVector(fwd, 30);
    f.y = this.height.height(f.x, f.z);
    this.sky.update(camera, f);
  }

  /** put the game's sun back into the shared uniforms (call when leaving the set: landView does it) */
  restoreSharedSun() {
    shared.uSunDir.value.copy(this.gameSun.dir);
    shared.uSunColor.value.copy(this.gameSun.color);
    landAtmo.uHazeWarm.value.copy(HAZE_WARM0);
    landAtmo.uHazeCool.value.copy(HAZE_COOL0);
    landAtmo.uHazeLobe.value.set(6, 1, 0.92);
    if (this.deck) { cloudShared.uDeck.value.set(1850, 2450, 5500, 1.0); cloudShared.uPuffs.value = 0.8; }
  }

  stats(renderer: THREE.WebGLRenderer): LandStats {
    return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, terrainTris: this.terrainTris, textures: renderer.info.memory.textures, buildMs: Math.round(this.buildMs) };
  }

  /** frees GPU resources (terrain, shading textures, clouds, water, placeholders, sky targets) */
  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.sky.cubeTarget.dispose();
    this.sky.lut.dispose();
    this.sky.sun.shadow.map?.dispose();
    this.scene.environment?.dispose();
    this.scene.clear();
  }
}

/** ViewSpec for engine.setView (see src/fx/views.ts palaceView): give it its own camera. */
export function landView(set: LandSet, opts: { camera?: THREE.PerspectiveCamera } = {}): ViewSpec {
  return {
    scene: set.scene,
    camera: opts.camera,
    sky: set.sky,
    exposure: () => set.exposure,
    atmosphere: { density: set.atmosphere.density, heightFalloff: set.atmosphere.heightFalloff, baseHeight: set.atmosphere.baseHeight, godRays: set.atmosphere.godRays },
    update: (dt, cam) => set.update(dt, cam),
    near: set.near,
    far: set.far,
    onLeave: () => set.restoreSharedSun(),
  };
}

/**
 * Dawn grade of the set's physical sky (visual-bible 3.11: "the sky gold -> rose -> blue above" Moab): re-hues the
 * LUT sky by elevation (gold at the horizon near the sun, a rose band above it, blue-violet overhead, the pink
 * belt over the anti-solar horizon) keeping its luminance. It changes this SkySystem's own material only (the
 * capture / haze / reflections follow, since they sample the same sky).
 */
export function gradeDawnSky(sky: SkySystem, amount = 0.62) {
  const mat = sky.sky.material as THREE.ShaderMaterial;
  mat.uniforms.uGrade = { value: amount };
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('uniform float uGlow;', 'uniform float uGlow; uniform float uGrade;')
      .replace('void main(){', `vec3 dawnGrade(vec3 col, vec3 d){
          float el = max(d.y, 0.0);
          vec2 a = normalize(d.xz + vec2(1e-5)), s = normalize(uSunDir.xz + vec2(1e-5));
          float mu = dot(a, s) * 0.5 + 0.5;
          float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          vec3 gold = vec3(1.0, 0.60, 0.28), rose = vec3(0.98, 0.56, 0.60), blue = vec3(0.34, 0.44, 0.86), violet = vec3(0.62, 0.52, 0.86);
          float hs = smoothstep(0.0, 0.14, el), hb = smoothstep(0.08, 0.5, el);
          vec3 t = mix(mix(gold, rose, hs), blue, hb);
          vec3 anti = mix(mix(vec3(0.86, 0.62, 0.74), violet, smoothstep(0.02, 0.2, el)), blue, hb);
          t = mix(anti, t, smoothstep(0.1, 0.75, mu));
          t /= dot(t, vec3(0.2126, 0.7152, 0.0722));
          return mix(col, t * lum, uGrade * (1.0 - smoothstep(0.9993, 0.99995, dot(d, uSunDir))));
        }
        void main(){`)
      .replace('gl_FragColor = vec4(col, 1.0);', 'col = dawnGrade(col, d);\n          gl_FragColor = vec4(col, 1.0);');
  };
  mat.customProgramCacheKey = () => 'land-dawn-sky-1';
  mat.needsUpdate = true;
}
