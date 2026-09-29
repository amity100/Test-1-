import * as THREE from 'three';
import { shared } from '../core/Shared';
import { PostFX, type PostQuality } from '../fx/PostFX';
import { SkySystem } from '../world/Sky';
import { loadTextures, type TextureSet } from '../world/Textures';
import { buildArchitecture, type Architecture } from './palaceArchitecture';
import { Flames, fxCounts, HallDust, LightShafts, Smoke } from './palaceFx';
import { FORT, GATE, HALL, SUN, TAMARISK } from './palaceLayout';
import { createPalaceMaterials, loadPalaceTextures, palaceUniforms, type PalaceMaterials, type PalaceTextures, type PalaceTier } from './palaceMaterials';
import { buildInteriorProps, type InteriorProps } from './palaceProps';
import { buildPalaceShots, type PalaceShots } from './palaceShots';
import { gibeahHeight, terrainGeometry, terrainMaterial } from './palaceTerrain';
import { buildVegetation, type Vegetation } from './palaceVegetation';

export { FORT, GATE, HALL, TAMARISK, SUN } from './palaceLayout';
export { gibeahHeight } from './palaceTerrain';
export type { PalaceShots } from './palaceShots';

/**
 * A place mark for a character: `pos` on the floor / ground (feet), `yaw` = facing, with the game's convention
 * forward = (sin(yaw), 0, cos(yaw)) (the player's `heading`). Seated marks give the seat surface instead.
 */
export interface Mark {
  pos: THREE.Vector3;
  yaw: number;
  /** what the mark is for (debug labels / casting) */
  role: string;
}

export interface PalaceAnchors {
  /** top-centre of the seat cushion by the north wall (where a seated king's pelvis rests), world space */
  thronePos: THREE.Vector3;
  /** yaw the seated king faces (toward the doorway, +Z) */
  throneFacing: number;
  /** top of the footstool in front of the seat (heels / soles of a seated 2 m man) */
  throneFootstool: THREE.Vector3;
  /** floor of the dais under the seat */
  daisTopY: number;
  hallFloorY: number;
  /** the king's own spear leaning at his right hand; hide `object` when a character holds the spear */
  spearRest: { butt: THREE.Vector3; tip: THREE.Vector3; object: THREE.Object3D };
  /** servants, runners and guards standing about the king in the hall (1 Sam 22:6, 22:17) */
  standMarks: Mark[];
  /** Abner son of Ner, commander of the army, at the king's side (1 Sam 20:25) */
  abnerPos: Mark;
  /** Jonathan, standing at the king's right */
  jonathanPos: Mark;
  /** the stone seat under the tamarisk on the height (1 Sam 22:6): top-centre of the seat, and facing */
  tamariskSeat: Mark;
  /** servants standing about the king under the tamarisk */
  tamariskStandMarks: Mark[];
  /** guards at the gate: two outside flanking the passage, two inside */
  gateGuardMarks: Mark[];
  /** crown centre of the tamarisk (camera target) */
  tamariskCrown: THREE.Vector3;
  /** detail-insert targets */
  detailTargets: { lamp: THREE.Vector3; hanging: THREE.Vector3 };
}

export interface PalaceSetOptions {
  renderer: THREE.WebGLRenderer;
  /** engine.quality (or a subset): name keys the content tier; shadowSize / texMax / anisotropy are honoured */
  quality: { name: 'low' | 'medium' | 'high'; shadowSize?: number; texMax?: number; anisotropy?: number };
  /** the engine's world TextureSet (engine.tex) to share; loaded on demand when absent */
  tex?: TextureSet;
  /** progress callback during create() */
  onProgress?: (f: number, label: string) => void;
  /** 'morning' (default: the chapter's sun, elevation 13 deg, azimuth 100 deg) or 'evening' (the 'saul-hall' beat:
   * low sun in the west-north-west through the west windows, the lamps and brazier dominate). See setTimeOfDay(). */
  timeOfDay?: PalaceTimeOfDay;
}

export type PalaceTimeOfDay = 'morning' | 'evening';

/** Lighting presets per time of day (sun in SkySystem degrees: azimuth from +Z toward +X, i.e. -90 = west). */
export const PALACE_TIMES: Record<PalaceTimeOfDay, { elevation: number; azimuth: number; exposure: { exterior: number; interior: number }; lamp: number; brazier: number; skyVis: number; doorVis: number; shaft: number }> = {
  morning: { elevation: SUN.elevation, azimuth: SUN.azimuth, exposure: { exterior: 0.58, interior: 1.3 }, lamp: 1, brazier: 1, skyVis: 0.055, doorVis: 0.45, shaft: 0.07 },
  // dusk: at a sun this low the 6.6 m west curtain wall (5 m from the hall) shadows the west windows, so no shafts;
  // the hall is lit by the lamps and the brazier, the sky glows through the door and windows
  evening: { elevation: 4.0, azimuth: -104, exposure: { exterior: 0.72, interior: 1.45 }, lamp: 1.9, brazier: 1.5, skyVis: 0.03, doorVis: 0.3, shaft: 0 },
};

export interface PalaceStats {
  drawCalls: number;
  triangles: number;
  meshes: number;
  instances: number;
  textures: { name: string; size: string }[];
  houses: number;
  vegetation: Record<string, number>;
}

/**
 * Saul's house at Gibeah (גִּבְעַת שָׁאוּל): a self-contained film set with its own THREE.Scene, sky, sun and
 * lights, for the intro scenes where the camera visits the king while David tends his sheep.
 *
 * Rendering: through the game's PostFX (see `createPost`), i.e. standard / physical materials, HDR lights,
 * sun shadows. The sky / sun come from SkySystem (it drives the shared sun uniforms: morning, elevation 13 deg,
 * azimuth 100 deg, the same sun as chapter 1, so swapping scenes does not disturb the game world).
 *
 * Use:
 *   const palace = await PalaceSet.create({ renderer, quality: engine.quality, tex: engine.tex });
 *   const post = palace.createPost(camera, postQuality);           // or swap scene+camera into your own PostFX
 *   cameraRig.playShots(palace.shots.all, done);
 *   each frame: palace.update(dt, camera); palace.applyExposure(renderer); post.render(dt);
 *   palace.dispose() when the intro is over.
 */
export class PalaceSet {
  readonly scene = new THREE.Scene();
  readonly sky: SkySystem;
  readonly tier: PalaceTier;
  readonly anchors: PalaceAnchors;
  readonly shots: PalaceShots;
  /** recommended renderer.toneMappingExposure for the current camera (interior = brighter, like a film stop) */
  exposure = 0.58;
  /** 0 = camera outside, 1 = inside the hall (smoothed) */
  interior = 0;
  /** exterior / interior exposure pair (tunable) */
  exposureRange = { exterior: 0.58, interior: 1.3 };
  /** placeholder figures (grey mannequins) at the anchors; toggle with showPlaceholders() */
  readonly placeholders = new THREE.Group();
  readonly architecture: Architecture;
  readonly props: InteriorProps;
  readonly vegetation: Vegetation;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly mats: PalaceMaterials;
  private readonly ptex: PalaceTextures;
  private readonly ownsWorldTex: TextureSet | null;
  private readonly flames: Flames;
  private shafts: LightShafts;
  private dust: HallDust;
  private dustCount = 0;
  private dustLamps: THREE.Vector3[] = [];
  /** current time-of-day preset */
  timeOfDay: PalaceTimeOfDay = 'morning';
  /** shared sun uniforms as they were before this set touched them (the game's sun), see restoreSharedSun() */
  private readonly gameSun = { dir: new THREE.Vector3(), color: new THREE.Color() };
  private readonly setSun = { dir: new THREE.Vector3(), color: new THREE.Color() };
  private readonly smoke: Smoke;
  private readonly lights: { light: THREE.PointLight; base: number; base0: number; seed: number; kind: 'brazier' | 'lamp' | 'bounce' }[] = [];
  private readonly terrain: THREE.Mesh;
  private readonly focus = new THREE.Vector3();
  private time = 0;
  private shadowMode: 'ext' | 'int' | '' = '';
  /** content invisible from inside the hall (village, groves, rocks, tamarisk): hidden while the camera is inside */
  private readonly exteriorOnly: THREE.Object3D[] = [];

  static async create(opts: PalaceSetOptions): Promise<PalaceSet> {
    const q = opts.quality;
    const tier: PalaceTier = q.name;
    const prog = opts.onProgress ?? (() => {});
    prog(0.05, 'גִּבְעַת שָׁאוּל');
    const world = opts.tex ?? (await loadTextures(opts.renderer, (f) => prog(0.05 + f * 0.4, 'גִּבְעַת שָׁאוּל'), q));
    const { tex, ready } = loadPalaceTextures(opts.renderer, tier, q.texMax ?? 2048, q.anisotropy ?? 8);
    await ready;
    prog(0.6, 'גִּבְעַת שָׁאוּל');
    const set = new PalaceSet(opts, world, tex, !opts.tex);
    if (opts.timeOfDay && opts.timeOfDay !== 'morning') set.setTimeOfDay(opts.timeOfDay);
    prog(1, 'גִּבְעַת שָׁאוּל');
    return set;
  }

  private constructor(opts: PalaceSetOptions, world: TextureSet, tex: PalaceTextures, ownsWorld: boolean) {
    const q = opts.quality;
    this.renderer = opts.renderer;
    this.tier = q.name;
    this.ptex = tex;
    this.ownsWorldTex = ownsWorld ? world : null;
    const tier = this.tier;
    const scene = this.scene;
    scene.name = 'palace';
    // ---------------------------------------------------------------- sky, sun, ambient
    this.gameSun.dir.copy(shared.uSunDir.value);
    this.gameSun.color.copy(shared.uSunColor.value);
    this.sky = new SkySystem(this.renderer, q.shadowSize ?? (tier === 'low' ? 1024 : tier === 'medium' ? 2048 : 4096));
    scene.add(this.sky.group);
    this.sky.setSun(SUN.elevation, SUN.azimuth, scene);
    this.sky.sun.shadow.bias = -0.0002;
    this.sky.sun.shadow.normalBias = 0.02;
    this.setSun.dir.copy(shared.uSunDir.value);
    this.setSun.color.copy(shared.uSunColor.value);
    // ---------------------------------------------------------------- content
    this.mats = createPalaceMaterials(tex, world, tier);
    this.terrain = new THREE.Mesh(terrainGeometry(tier), terrainMaterial(world));
    this.terrain.name = 'palace:terrain';
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = false;
    scene.add(this.terrain);
    this.architecture = buildArchitecture(this.mats, tier);
    scene.add(this.architecture.group);
    this.props = buildInteriorProps(this.mats, tier, world);
    scene.add(this.props.group);
    this.vegetation = buildVegetation(world, tex, tier, this.architecture.houseSpots);
    scene.add(this.vegetation.group);
    palaceUniforms.uDoorPos.value.copy(this.architecture.doorCenter);
    palaceUniforms.uFloorY.value = HALL.y0;

    // ---------------------------------------------------------------- fire, lamps, sunbeams, dust, smoke
    const fx = fxCounts(tier);
    this.flames = new Flames(this.props.flames);
    scene.add(this.flames.mesh, this.flames.glow);
    const sunDir = shared.uSunDir.value.clone();
    this.shafts = new LightShafts(this.architecture.windows, sunDir);
    scene.add(this.shafts.mesh);
    const brazier = this.props.flames.find((f) => f.kind === 'brazier')!;
    const lampsNear = this.props.flames.filter((f) => f.kind === 'lamp');
    this.dustCount = fx.dust;
    this.dustLamps = [brazier.pos, ...lampsNear.slice(0, 3).map((l) => l.pos)];
    this.dust = new HallDust(fx.dust, this.architecture.windows, sunDir, this.dustLamps);
    scene.add(this.dust.points);
    const ovens = [new THREE.Vector3(60, 0, 70), new THREE.Vector3(-40, 0, 95), new THREE.Vector3(95, 0, 20), new THREE.Vector3(10, 0, 120)].map((p) => p.setY(gibeahHeight(p.x, p.z) + 1.0));
    this.smoke = new Smoke([
      { pos: brazier.pos.clone().add(new THREE.Vector3(0, 0.1, 0)), rate: 1, size: 0.5, height: 3.2, dark: 0.85 },
      ...ovens.map((p) => ({ pos: p, rate: 1, size: 3.5, height: 26, dark: 0 })),
      { pos: new THREE.Vector3(8, 1.2, 10.5), rate: 1, size: 1.6, height: 12, dark: 0.1 },
    ], fx.smokePer);
    scene.add(this.smoke.points);
    // lights: the brazier (always) + the lamps nearest the seat (tiered); no point-light shadows (cost)
    const warm = new THREE.Color(1.0, 0.56, 0.24);
    const bl = new THREE.PointLight(warm, 3.2, 11, 2);
    bl.position.copy(brazier.pos).add(new THREE.Vector3(0, 0.35, 0));
    scene.add(bl);
    this.lights.push({ light: bl, base: 3.2, base0: 3.2, seed: 1, kind: 'brazier' });
    const seatLamps = lampsNear.slice().sort((a, b) => a.pos.distanceTo(this.props.seatTop) - b.pos.distanceTo(this.props.seatTop)).slice(0, fx.lampLights);
    for (const [i, l] of seatLamps.entries()) {
      const pl = new THREE.PointLight(new THREE.Color(1.0, 0.62, 0.3), 0.7, 6, 2);
      // just in front of the niche / lamp so the niche itself is not blown out
      const out = new THREE.Vector3((HALL.x0 + HALL.x1) / 2 - l.pos.x, 0, (HALL.z0 + HALL.z1) / 2 - l.pos.z).normalize();
      pl.position.copy(l.pos).add(new THREE.Vector3(0, 0.1, 0)).addScaledVector(out, 0.3);
      scene.add(pl);
      this.lights.push({ light: pl, base: 0.7, base0: 0.7, seed: 10 + i * 7, kind: 'lamp' });
    }
    // sun bounce inside: warm fill where the beams land on the floor / west wall (medium / high)
    if (tier !== 'low') {
      const bounce = new THREE.PointLight(new THREE.Color(1.0, 0.78, 0.55), 1.2, 9, 2);
      bounce.position.set(HALL.x0 + 1.6, HALL.y0 + 1.2, -8.5);
      scene.add(bounce);
      this.lights.push({ light: bounce, base: 1.2, base0: 1.2, seed: -1, kind: 'bounce' });
    }

    // ---------------------------------------------------------------- anchors
    const D = HALL.dais;
    const dTop = HALL.y0 + D.h;
    const seat = this.props.seatTop.clone();
    const facing = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(to.x - from.x, to.z - from.z);
    const mark = (x: number, y: number, z: number, yaw: number, role: string): Mark => ({ pos: new THREE.Vector3(x, y, z), yaw, role });
    const toSeat = (x: number, z: number, role: string) => mark(x, HALL.y0, z, facing(new THREE.Vector3(x, 0, z), seat), role);
    const ts = this.vegetation.tamariskSeat;
    const tYaw = this.vegetation.tamariskSeatYaw;
    const tf = new THREE.Vector3(Math.sin(tYaw), 0, Math.cos(tYaw));
    const tside = new THREE.Vector3(tf.z, 0, -tf.x);
    const gy = (x: number, z: number) => gibeahHeight(x, z);
    const tMark = (f: number, s: number, role: string) => {
      const p = ts.clone().addScaledVector(tf, f).addScaledVector(tside, s);
      p.y = gy(p.x, p.z);
      return mark(p.x, p.y, p.z, facing(p, ts), role);
    };
    const gz = (GATE.z0 + GATE.z1) / 2;
    const lampTarget = lampsNear.find((l) => l.pos.z < HALL.z0 && l.pos.x > HALL.cx)?.pos ?? lampsNear[0].pos;
    this.anchors = {
      thronePos: seat,
      throneFacing: 0,
      throneFootstool: new THREE.Vector3(HALL.cx, dTop + 0.14, D.z0 + 0.95 + 0.62),
      daisTopY: dTop,
      hallFloorY: HALL.y0,
      spearRest: { butt: this.props.kingSpearButt.clone(), tip: this.props.kingSpearTip.clone(), object: this.props.kingSpear },
      standMarks: [
        mark(HALL.cx - 2.0, HALL.y0, D.z1 + 0.55, 0.12, 'guard (right of the dais)'),
        mark(HALL.cx + 2.0, HALL.y0, D.z1 + 0.55, -0.12, 'guard (left of the dais)'),
        toSeat(HALL.cx - 1.55, -9.6, 'servant'),
        toSeat(HALL.cx + 1.55, -9.2, 'servant'),
        toSeat(HALL.cx - 1.6, -6.2, 'servant'),
        toSeat(HALL.cx + 1.6, -5.8, 'servant'),
        mark(HALL.cx - 1.25, HALL.y0, HALL.z1 - 0.8, Math.PI, 'runner at the door'),
        mark(HALL.cx + 1.25, HALL.y0, HALL.z1 - 0.8, Math.PI, 'runner at the door'),
      ],
      abnerPos: mark(HALL.cx + 1.3, dTop, D.z0 + 1.05, -0.25, 'Abner son of Ner'),
      jonathanPos: mark(HALL.cx - 1.35, dTop, D.z0 + 1.15, 0.25, 'Jonathan'),
      tamariskSeat: { pos: ts.clone(), yaw: tYaw, role: 'Saul under the tamarisk (seat top)' },
      tamariskStandMarks: [tMark(2.2, 2.1, 'servant'), tMark(2.6, -2.2, 'servant'), tMark(3.8, 3.4, 'runner'), tMark(4.2, -3.2, 'runner'), tMark(0.3, 1.5, 'armour-bearer'), tMark(5.2, 0.6, 'servant')],
      gateGuardMarks: [
        mark(GATE.towerX1 + 1.3, gy(GATE.towerX1 + 1.3, GATE.z0 - 0.9), GATE.z0 - 0.9, Math.PI / 2, 'gate guard (outside)'),
        mark(GATE.towerX1 + 1.3, gy(GATE.towerX1 + 1.3, GATE.z1 + 0.9), GATE.z1 + 0.9, Math.PI / 2, 'gate guard (outside)'),
        mark(GATE.towerX0 - 1.2, gy(GATE.towerX0 - 1.2, GATE.z0 - 1.0), GATE.z0 - 1.0, -Math.PI / 2 + 0.3, 'gate guard (inside)'),
        mark(GATE.towerX0 - 1.2, gy(GATE.towerX0 - 1.2, GATE.z1 + 1.0), GATE.z1 + 1.0, -Math.PI / 2 - 0.3, 'gate guard (inside)'),
      ],
      tamariskCrown: this.vegetation.tamariskCrown.clone(),
      detailTargets: { lamp: lampTarget.clone(), hanging: new THREE.Vector3(HALL.cx, HALL.y0 + 2.9, HALL.z0 + 0.05) },
    };
    void gz;
    this.shots = buildPalaceShots(this.anchors);
    this.buildPlaceholders();
    this.placeholders.visible = false;
    scene.add(this.placeholders);
    this.exteriorOnly.push(this.vegetation.group);
    this.architecture.group.traverse((o) => {
      if (/^palace:(village|roofs|doorways)$/.test(o.name)) this.exteriorOnly.push(o);
    });
    // static scenery: world matrices once
    for (const g of [this.architecture.group, this.props.group, this.vegetation.group]) g.updateMatrixWorld(true);
  }

  /**
   * Switch the lighting preset: 'morning' (the chapter's sun) or 'evening' (low sun through the west windows, lamps
   * dominant; for the 'saul-hall' beat). Re-runs the sky (LUT + environment capture, a few ms) and rebuilds the
   * window light shafts and dust for the new sun. Writes the shared sun uniforms; call restoreSharedSun() before the
   * game world renders again.
   */
  setTimeOfDay(t: PalaceTimeOfDay) {
    const P = PALACE_TIMES[t];
    this.timeOfDay = t;
    this.sky.setSun(P.elevation, P.azimuth, this.scene);
    this.setSun.dir.copy(shared.uSunDir.value);
    this.setSun.color.copy(shared.uSunColor.value);
    const sunDir = shared.uSunDir.value.clone();
    this.scene.remove(this.shafts.mesh, this.dust.points);
    for (const o of [this.shafts.mesh, this.dust.points]) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
    this.shafts = new LightShafts(this.architecture.windows, sunDir);
    this.shafts.uniforms.uStrength.value = P.shaft;
    this.shafts.mesh.visible = P.shaft > 0;
    this.dust = new HallDust(this.dustCount, this.architecture.windows, sunDir, this.dustLamps);
    this.scene.add(this.shafts.mesh, this.dust.points);
    this.exposureRange = { ...P.exposure };
    for (const l of this.lights) l.base = l.base0 * (l.kind === 'lamp' ? P.lamp : l.kind === 'brazier' ? P.brazier : t === 'evening' ? 0.35 : 1);
    for (const l of this.lights) if (l.seed < 0) l.light.intensity = l.base;
    palaceUniforms.uSkyVis.value = P.skyVis;
    palaceUniforms.uDoorVis.value = P.doorVis;
    this.shadowMode = '';
  }

  /** Put the game's sun back into the shared uniforms (after the palace beats, before engine.render()). */
  restoreSharedSun() {
    shared.uSunDir.value.copy(this.gameSun.dir);
    shared.uSunColor.value.copy(this.gameSun.color);
  }

  /** A PostFX for this set (the game's post chain with the palace sky cube for the aerial perspective). */
  createPost(camera: THREE.PerspectiveCamera, q: PostQuality) {
    const post = new PostFX(this.renderer, this.scene, camera, this.sky.cubeTarget.texture, q);
    this.configurePost(post);
    return post;
  }

  /** Atmosphere settings of this set (clear morning air over Benjamin; call on a shared PostFX when swapping in). */
  configurePost(post: PostFX) {
    post.atmosphere.uniforms.uDensity.value = PalaceSet.HAZE_DENSITY;
    post.atmosphere.uniforms.uGodRays.value = 0.2;
  }

  /** aerial-perspective density used for this set (the game's default is 0.00042) */
  static HAZE_DENSITY = 0.0003;

  /** Grey mannequins at every anchor (scale check: the king is 1.98 m, others 1.72-1.8 m). */
  showPlaceholders(on: boolean) {
    this.placeholders.visible = on;
  }

  private buildPlaceholders() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.8, metalness: 0 });
    const figure = (h: number, seated: boolean) => {
      const g = new THREE.Group();
      const k = h / 1.8;
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17 * k, 0.5 * k, 6, 12), mat);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.115 * k, 16, 12), mat);
      if (seated) {
        // pelvis at the origin (seat top), thighs forward, shins down
        torso.position.set(0, 0.42 * k, -0.04);
        head.position.set(0, 0.98 * k, -0.03);
        const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * k, 0.4 * k, 4, 8), mat);
        for (const s of [-1, 1]) {
          const t = thigh.clone();
          t.rotation.x = Math.PI / 2;
          t.position.set(s * 0.1 * k, 0.07, 0.24 * k);
          g.add(t);
          const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * k, 0.38 * k, 4, 8), mat);
          shin.position.set(s * 0.1 * k, -0.2 * k, 0.48 * k);
          g.add(shin);
        }
      } else {
        torso.position.y = 1.2 * k;
        head.position.y = 1.68 * k;
        for (const s of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * k, 0.72 * k, 4, 8), mat);
          leg.position.set(s * 0.1 * k, 0.45 * k, 0);
          g.add(leg);
        }
      }
      g.add(torso, head);
      g.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      return g;
    };
    const put = (m: Mark, h: number, seated = false) => {
      const f = figure(h, seated);
      f.position.copy(m.pos);
      f.rotation.y = m.yaw;
      this.placeholders.add(f);
    };
    const a = this.anchors;
    put({ pos: a.thronePos, yaw: a.throneFacing, role: 'king' }, 1.98, true);
    for (const m of a.standMarks) put(m, 1.74);
    put(a.abnerPos, 1.8);
    put(a.jonathanPos, 1.84);
    put(a.tamariskSeat, 1.98, true);
    for (const m of a.tamariskStandMarks) put(m, 1.74);
    for (const m of a.gateGuardMarks) put(m, 1.76);
  }

  /** Per-frame: flames, light flicker, cloth / dust (shader time), sun shadow framing, exposure. */
  update(dt: number, camera: THREE.PerspectiveCamera, opts: { advanceTime?: boolean } = {}) {
    if (opts.advanceTime) shared.uTime.value += dt;
    // this set's sun drives the shared uniforms while it renders (the game restores its own via restoreSharedSun)
    shared.uSunDir.value.copy(this.setSun.dir);
    shared.uSunColor.value.copy(this.setSun.color);
    this.time += dt;
    const t = this.time;
    for (const l of this.lights) {
      if (l.seed < 0) continue;
      const f = 1 + 0.12 * Math.sin(t * 11.3 + l.seed) + 0.07 * Math.sin(t * 23.7 + l.seed * 2.3) + 0.05 * Math.sin(t * 5.1 + l.seed * 0.7);
      l.light.intensity = l.base * f;
    }
    // interior blend: inside the hall box, smooth across the doorway
    const p = camera.position;
    const H = HALL;
    const inX = THREE.MathUtils.smoothstep(p.x, H.x0 - 0.5, H.x0 + 0.5) * (1 - THREE.MathUtils.smoothstep(p.x, H.x1 - 0.5, H.x1 + 0.5));
    const inZ = THREE.MathUtils.smoothstep(p.z, H.z0 - 1, H.z0) * (1 - THREE.MathUtils.smoothstep(p.z, H.z1 - 1.2, H.z1 + H.wall + 1.8));
    const inY = 1 - THREE.MathUtils.smoothstep(p.y, H.ceil, H.roofTop + 0.5);
    const target = inX * inZ * inY;
    this.interior = dt > 0 ? THREE.MathUtils.damp(this.interior, target, 3.0, dt) : target;
    const e = this.exposureRange;
    this.exposure = THREE.MathUtils.lerp(e.exterior, e.interior, this.interior);
    // sun shadow framing: whole citadel from outside, tight around the hall inside (sharper window patches)
    const mode = this.interior > 0.5 ? 'int' : 'ext';
    if (mode !== this.shadowMode) {
      this.shadowMode = mode;
      const sc = this.sky.sun.shadow.camera;
      const half = mode === 'int' ? 13 : 62;
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
    const deepInside = this.interior > 0.97;
    for (const o of this.exteriorOnly) o.visible = !deepInside;
    if (mode === 'int') this.focus.set(H.cx, H.y0 + 2, (H.z0 + H.z1) / 2);
    else this.focus.set(0, 0, -2);
    this.sky.update(camera, this.focus);
    // point sprites: keep their size in pixels right
    const size = this.renderer.getDrawingBufferSize(tmpV2);
    this.dust.setPixelScale(size.y, camera.fov);
    this.smoke.setPixelScale(size.y, camera.fov);
  }

  /** Apply the recommended exposure (call before post.render). */
  applyExposure(renderer: THREE.WebGLRenderer = this.renderer) {
    renderer.toneMappingExposure = this.exposure;
  }

  /** Draw calls / triangles of the last rendered frame plus content totals. */
  stats(): PalaceStats {
    let meshes = 0, instances = 0, triangles = 0;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      const g = m.geometry;
      const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
      instances += inst;
      triangles += n * inst;
    });
    const textures: { name: string; size: string }[] = [];
    for (const [k, t] of Object.entries(this.ptex)) {
      const img = (t as THREE.Texture).image as { width?: number; height?: number } | undefined;
      textures.push({ name: k, size: img ? `${img.width}x${img.height}` : '?' });
    }
    return { drawCalls: this.renderer.info.render.calls, triangles: Math.round(triangles), meshes, instances, textures, houses: this.architecture.stats.houses, vegetation: this.vegetation.stats };
  }

  dispose() {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) geos.add(m.geometry);
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mm)) mm.forEach((x) => mats.add(x));
      else if (mm) mats.add(mm);
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    for (const t of Object.values(this.ptex)) (t as THREE.Texture).dispose();
    if (this.ownsWorldTex) for (const t of Object.values(this.ownsWorldTex)) (t as THREE.Texture).dispose();
    this.sky.cubeTarget.dispose();
    this.sky.lut.dispose();
    (this.scene.environment as THREE.Texture | null)?.dispose();
    this.sky.sun.shadow.map?.dispose();
    this.scene.clear();
  }
}

const tmpV2 = new THREE.Vector2();
