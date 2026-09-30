import * as THREE from 'three';
import { shared } from '../../core/Shared';
import type { ViewSpec } from '../../core/Engine';
import type { Shot, ShotFrame } from '../../gameplay/CameraRig';
import { SkySystem } from '../../world/Sky';
import { loadTextures, type TextureSet } from '../../world/Textures';
import { cloudShared, GLSL_CLOUD_WEATHER, landAtmo } from './landAtmo';
import { LandClouds } from './landClouds';
import { GEO, LandHeight, loadLandcover, loadTile, PLACES, shadeTexture, type HeightTile } from './landData';
import { buildArmyPlaceholders, buildDust, buildRamahGate, mannequinGeometry, roadGlslFor, type Mark } from './landSites';
import { landMaterial, polarTerrain, type LandTier } from './landTerrain';
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
  // winter dawn: the sun just risen over the Moab plateau, slightly south of east
  judah: { elevation: 6.0, azimuth: 78, exposure: 0.5 },
  // late afternoon over the sea: the column marches toward the camera out of the backlit dust
  coast: { elevation: 9, azimuth: -112, exposure: 0.55 },
  // morning at the gate of Ramah
  ramah: { elevation: 15, azimuth: 105, exposure: 0.56 },
};

export interface JudahAnchors { focus: THREE.Vector3; bethlehem: THREE.Vector3; deadSea: THREE.Vector3; moab: THREE.Vector3; sea: THREE.Vector3 }
export interface CoastAnchors {
  /** the road polyline (ground points, SW -> NE: the column marches toward the Shephelah) */
  route: THREE.Vector3[];
  /** marching direction (unit, horizontal) and the column's width in metres */
  heading: THREE.Vector3; columnWidth: number;
  /** where the head of the column is at the start of the shots */
  columnHead: THREE.Vector3;
  camera: THREE.Vector3;
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
  buildMs = 0;

  static async create(o: LandSetOptions): Promise<LandSet> {
    const t0 = performance.now();
    const prog = o.onProgress ?? (() => {});
    prog(0.05, 'land');
    const localName = o.location;
    const needTex = o.location !== 'judah';
    const [region, local, regLC, locLC, tex] = await Promise.all([
      loadTile('region'),
      loadTile(localName),
      loadLandcover('region', o.quality.anisotropy ?? 4),
      loadLandcover(localName, o.quality.anisotropy ?? 4),
      needTex ? (o.tex ? Promise.resolve(o.tex) : loadTextures(o.renderer, () => {}, o.quality as never)) : Promise.resolve(null),
    ]);
    prog(0.6, 'land');
    const set = new LandSet(o, region, local, regLC, locLC, tex);
    set.buildMs = performance.now() - t0;
    prog(1, 'land');
    return set;
  }

  private constructor(o: LandSetOptions, region: HeightTile, local: HeightTile, regLC: THREE.Texture, locLC: THREE.Texture, tex: TextureSet | null) {
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
      focus = new THREE.Vector3(-1500, 0, 700);
    } else if (o.location === 'coast') {
      // a low kurkar rise on the plain SE of Ashdod; the road runs SW -> NE toward the Shephelah
      focus = new THREE.Vector3(-46800, 0, 1800);
      const pts2 = [new THREE.Vector2(-50400, 5600), new THREE.Vector2(-49200, 4300), new THREE.Vector2(-48100, 3050), new THREE.Vector2(-47150, 2200), new THREE.Vector2(-46350, 1650), new THREE.Vector2(-45200, 900), new THREE.Vector2(-43600, -300)];
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

    // ------------------------------------------------------------------ terrain
    const regShade = shadeTexture(region, new LandHeight(region, null), sunDir, { maxDist: 45000 });
    const locShade = shadeTexture(local, this.height, sunDir, { maxDist: 30000, useMods: true });
    this.disposables.push(regShade, locShade);
    const nTheta = tier === 'high' ? 448 : tier === 'medium' ? 320 : 200;
    const geo = polarTerrain(this.height, focus.x, focus.z, {
      nTheta, r0: ground ? 0.8 : 20, rMax: 150000,
      underwater: (x) => (x < -30000 ? 0 : x > 12000 && x < 60000 ? GEO.deadSea : null),
    });
    this.terrainTris = (geo.index?.count ?? 0) / 3;
    const tmat = landMaterial({ regTile: region, regShade, regLC, locTile: local, locShade, locLC }, {
      mist: o.location === 'judah' ? 1 : 0,
      mistColor: new THREE.Color(0.95, 0.82, 0.74),
      mistTop: 650,
      cloudShadowGlsl: o.location === 'judah' ? GLSL_CLOUD_WEATHER : undefined,
      near: ground ? tex : null,
      roadGlsl,
      haze: !ground,
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
      const count = tier === 'high' ? 1200 : tier === 'medium' ? 720 : 360;
      // the column's head is near the camera; ranks trail back toward the sea (reverse the route for placement)
      const back = route.slice().reverse().filter((p) => p.distanceTo(focus) < 4200);
      const headAt = new THREE.Vector3(-46350, 0, 1650); headAt.y = q(headAt.x, headAt.z);
      const trail = [headAt, ...back.filter((p) => p.x < headAt.x)];
      const army = buildArmyPlaceholders(trail, count, q);
      this.placeholders.add(army.group);
      this.disposables.push(army);
      const dust = buildDust(trail, tier === 'low' ? 60 : 160, shared.uSunDir.value, shared.uSunColor.value);
      scene.add(dust.mesh);
      this.dust = dust;
      this.disposables.push(dust);
      const cam = new THREE.Vector3(-46180, 0, 1540); cam.y = q(cam.x, cam.z);
      anchors.coast = { route, heading, columnWidth: 6.3, columnHead: headAt.clone(), camera: cam };
    } else if (o.location === 'ramah') {
      const gate = buildRamahGate(tex!, tier, { origin: focus.clone(), yaw: 0.25 }, q, rnd);
      scene.add(gate.group);
      this.disposables.push(...gate.materials);
      for (const m of gate.materials) for (const t of ((m.userData.ownTextures ?? []) as THREE.Texture[])) this.disposables.push(t);
      gate.group.traverse((c) => { if ((c as THREE.Mesh).isMesh) this.disposables.push((c as THREE.Mesh).geometry); });
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
      ? { density: 0.00011, heightFalloff: 1 / 900, baseHeight: o.location === 'coast' ? -20 : 500, godRays: 0.3 }
      : { density: 0, heightFalloff: 1 / 1800, baseHeight: -400, godRays: 0.35 };
    const { shots, sequence } = this.buildShots();
    this.shots = shots;
    this.sequence = sequence;
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
      const e = (x: number, z: number, above: number) => V(x, this.height.height(x, z) + above, z);
      void e;
      shots.cloudSea = path([V(-11500, 3350, 2600), V(-9800, 3200, 2200), V(-8200, 3000, 1900)], [V(40000, 1500, -2000), V(40000, 1300, 2000), V(40000, 1000, 5000)], [48, 46], 7);
      shots.descent = path([V(-8200, 3000, 1900), V(-6600, 2300, 1500), V(-5200, 1650, 1200), V(-4200, 1320, 1000)], [V(40000, 1000, 5000), V(36000, 300, 6000), V(32000, -200, 7000), V(30000, -350, 7500)], [46, 42], 6);
      shots.judahDawn = path([V(-4200, 1320, 1000), V(-2200, 1240, 1100), V(200, 1200, 1300)], [V(30000, -900, 7500), V(30000, -1000, 8200), V(30500, -1000, 9000)], [42, 36], 9);
      shots.flight = path([V(-11500, 3350, 2600), V(-8200, 3000, 1900), V(-5800, 1950, 1350), V(-3600, 1300, 1050), V(-1000, 1230, 1200), V(600, 1200, 1350)],
        [V(40000, 1500, -2000), V(40000, 1000, 5000), V(34000, 0, 6500), V(30000, -350, 7500), V(30000, -380, 8400), V(30500, -390, 9000)], [48, 36], 22);
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
      shots.threat = path([T(46, 9, 1.9), T(38, 7.5, 2.3)], [T(-60, 1, 2.6), T(-70, 0, 2.2)], [34, 30], 8);
      // lateral track along the ranks, low angle
      shots.column = path([T(-10, 16, 1.3), T(-45, 15, 1.4)], [T(-20, 0, 1.7), T(-60, 0, 1.8)], [30, 30], 6);
      // tele: shields and spear points glinting in the dust
      shots.glint = path([T(95, 3, 1.7), T(90, 2.5, 1.7)], [T(-6, 0, 1.4), T(-8, 0, 1.4)], [11, 10], 4);
      void cam;
      sequence = [shots.threat, shots.column, shots.glint];
    } else {
      const r = this.anchors.ramah!;
      const g = r.gate, yaw = r.gateYaw;
      const f = V(Math.sin(yaw), 0, Math.cos(yaw)); // out of the gate
      const s = V(Math.cos(yaw), 0, -Math.sin(yaw)); // along the wall
      const P = (along: number, out: number, up: number) => V(g.x + s.x * along + f.x * out, g.y + up, g.z + s.z * along + f.z * out);
      shots.gateWide = path([P(-14, 34, 16), P(-9, 26, 7), P(-6, 21, 3.2)], [P(0, 2, 3), P(0, 3, 2.2), P(0, 4, 1.8)], [44, 40], 7);
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
