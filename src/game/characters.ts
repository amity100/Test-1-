/**
 * Characters: the Soldier.glb model driven by the retargeted CC0 animation
 * library (public/assets/anims.json, built by scripts/extract-anims.mjs).
 *
 * - `parseCharacterAsset(buf)` / `loadCharacterAsset(url)` load Soldier.glb
 *   (textures decoded through data: URLs for CSP-sandboxed hosts).
 * - `loadAnimLibrary(json, asset)` decodes anims.json once into shared
 *   THREE.AnimationClips plus dense sample buffers.
 * - `new Character(asset, anims, look)` implements `CharacterAPI`.
 *
 * The rendered pose is a pure function of the state returned by `getPose()`
 * (locomotion values, one clock, one overlay clip, tumble, death). Every
 * frame the bones are written from scratch: locomotion blend (phase-synced
 * cycles, stride matched to speed) -> weapon-up hold -> overlay clip (masked
 * to the upper body while moving) -> procedural layers (gauntlet aim,
 * shield carry, flail, limp) -> attachments. No THREE.AnimationMixer: its
 * change detection and hidden fade state would make setPose() inexact.
 *
 * Loading (main.ts):
 *   const soldier = await parseCharacterAsset(await assetBytes(dir, 'Soldier.glb', 'glTF'));
 *   const anims = loadAnimLibrary(await (await fetch(dir + 'anims.json')).json(), soldier);
 *   const guard = new Character(soldier, anims, 'rifleman');
 * Regenerate anims.json with `node scripts/extract-anims.mjs`; preview with
 * `npx vite` + /tools/anim-preview.html.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterAPI, CharacterPose, ClipName, DeathKind, LocomotionInput, Tuple4 } from '../core/contracts';

// ---------------------------------------------------------------------------
// Soldier.glb loading
// ---------------------------------------------------------------------------

export interface CharacterAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export async function loadCharacterAsset(url: string, onProgress?: (p: number) => void): Promise<CharacterAsset> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url, (e) => {
    if (e.total) onProgress?.(e.loaded / e.total);
  });
  return { scene: gltf.scene as THREE.Group, animations: gltf.animations };
}

/**
 * Decodes embedded glTF images through data: URLs on <img>, instead of the
 * loader's default blob: fetch, which sandboxed hosts (CSP) refuse.
 */
function dataUrlTextures(parser: any) {
  return {
    name: 'data-url-textures',
    loadTexture(index: number) {
      const json = parser.json;
      const texDef = json.textures[index];
      const img = json.images[texDef.source];
      if (img.bufferView === undefined) return null;
      return parser.getDependency('bufferView', img.bufferView).then(
        (view: ArrayBuffer) =>
          new Promise<THREE.Texture>((resolve, reject) => {
            const bytes = new Uint8Array(view);
            let bin = '';
            for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            const url = `data:${img.mimeType || 'image/png'};base64,${btoa(bin)}`;
            new THREE.TextureLoader().load(
              url,
              (tex) => {
                tex.flipY = false;
                const sampler = texDef.sampler !== undefined ? json.samplers?.[texDef.sampler] ?? {} : {};
                const wrap = (w?: number) => (w === 33071 ? THREE.ClampToEdgeWrapping : w === 33648 ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping);
                tex.wrapS = wrap(sampler.wrapS);
                tex.wrapT = wrap(sampler.wrapT);
                tex.needsUpdate = true;
                resolve(tex);
              },
              undefined,
              reject,
            );
          }),
      );
    },
  };
}

export async function parseCharacterAsset(buf: ArrayBuffer): Promise<CharacterAsset> {
  const loader = new GLTFLoader();
  loader.register(dataUrlTextures as any);
  const gltf = await loader.parseAsync(buf, '');
  return { scene: gltf.scene as THREE.Group, animations: gltf.animations };
}

// ---------------------------------------------------------------------------
// Animation library
// ---------------------------------------------------------------------------

export const CLIP_NAMES = [
  'idle', 'walk', 'run', 'sprint', 'crouchIdle', 'crouchWalk',
  'jumpStart', 'jumpLoop', 'jumpLand', 'roll',
  'strike', 'punch', 'push', 'hitChest', 'hitHead', 'death',
  'aim', 'shoot', 'reload', 'swimIdle', 'swim', 'interact', 'pickUp',
] as const satisfies readonly ClipName[];
// compile-time: CLIP_NAMES covers every ClipName
type _MissingClip = Exclude<ClipName, (typeof CLIP_NAMES)[number]>;
const _clipCheck: [_MissingClip] extends [never] ? true : false = true;
void _clipCheck;

export interface ClipInfo {
  name: ClipName;
  /** Source clip in the Quaternius library. */
  src: string;
  duration: number;
  frames: number;
  loop: boolean;
  /** Natural ground speed (m/s at scale 1) of a locomotion cycle played at 1x; 0 otherwise. */
  speed: number;
  /** Metres travelled per cycle (speed x duration). */
  stride: number;
  /**
   * Gaits that always keep a foot down: cumulative ground travel per frame
   * (0..1). Cycles are sampled by distance through it, so lurching gaits
   * keep their feet planted at a constant ground speed.
   */
  warp: Float32Array | null;
}

/** Dense samples: every animated bone at every frame. */
interface ClipData {
  frames: number;
  /** frames * bones * 4 */
  q: Float32Array;
  /** frames * 3 (Hips position, Soldier local units) */
  p: Float32Array;
}

export interface AnimLibrary {
  /** Real THREE clips (tracks named after the Soldier bones), shared by every character. */
  readonly clips: Record<ClipName, THREE.AnimationClip>;
  readonly info: Record<ClipName, ClipInfo>;
  /** Animated bones, short Mixamo names ('Hips', 'LeftArm', ...), in sample order. */
  readonly bones: readonly string[];
  /** The same bones' node names in the Soldier scene (e.g. 'mixamorigHips'). */
  readonly boneNodes: readonly string[];
  readonly fps: number;
  /** @internal dense sample buffers */
  readonly data: Record<ClipName, ClipData>;
  /** @internal rest (bind) quaternions, bones * 4 */
  readonly rest: Float32Array;
  /** @internal rest Hips position */
  readonly restHips: THREE.Vector3;
  /** @internal per-look attachment calibration cache */
  readonly calib: Map<string, THREE.Matrix4>;
}

interface AnimJsonTrack {
  b: number;
  p: 'q' | 'p';
  k: number[];
  v: number[];
}
interface AnimJsonClip {
  src: string;
  duration: number;
  frames: number;
  loop: boolean;
  speed: number;
  warp?: number[];
  tracks: AnimJsonTrack[];
}
interface AnimJson {
  version: number;
  fps: number;
  qScale: number;
  pScale: number;
  bones: string[];
  clips: Record<string, AnimJsonClip>;
}

/** 'mixamorig:Hips' / 'mixamorigHips' / 'Hips' -> 'Hips' */
export function shortBoneName(name: string): string {
  return name.replace(/^mixamorig[:_]?/, '');
}

function isAnimJson(j: unknown): j is AnimJson {
  const o = j as AnimJson;
  return !!o && typeof o === 'object' && typeof o.fps === 'number' && Array.isArray(o.bones) && !!o.clips && typeof o.clips === 'object';
}

/**
 * Decodes anims.json (see scripts/extract-anims.mjs) against the Soldier
 * skeleton. Call once; the result is shared by every Character.
 */
export function loadAnimLibrary(json: unknown, soldier: CharacterAsset): AnimLibrary {
  if (!isAnimJson(json)) throw new Error('anims.json: unexpected format');
  const nodes = new Map<string, THREE.Object3D>();
  soldier.scene.traverse((o) => {
    if ((o as THREE.Bone).isBone) nodes.set(shortBoneName(o.name), o);
  });
  const bones = json.bones;
  const nb = bones.length;
  const boneNodes = bones.map((b) => {
    const n = nodes.get(b);
    if (!n) throw new Error(`anims.json: bone ${b} not in Soldier.glb`);
    return n.name;
  });
  const hipsI = bones.indexOf('Hips');
  if (hipsI < 0) throw new Error('anims.json: no Hips bone');
  const rest = new Float32Array(nb * 4);
  bones.forEach((b, i) => nodes.get(b)!.quaternion.toArray(rest, i * 4));
  const restHips = nodes.get('Hips')!.position.clone();
  const fps = json.fps;
  const qs = 1 / json.qScale;
  const ps = 1 / json.pScale;

  const clips = {} as Record<ClipName, THREE.AnimationClip>;
  const info = {} as Record<ClipName, ClipInfo>;
  const data = {} as Record<ClipName, ClipData>;
  for (const name of CLIP_NAMES) {
    const c = json.clips[name];
    if (!c) throw new Error(`anims.json: clip ${name} missing`);
    const F = Math.max(1, c.frames | 0);
    const q = new Float32Array(F * nb * 4);
    const p = new Float32Array(F * 3);
    for (let f = 0; f < F; f++) {
      q.set(rest, f * nb * 4);
      restHips.toArray(p, f * 3);
    }
    const tracked = new Set<number>();
    for (const t of c.tracks) {
      const n = t.p === 'q' ? 4 : 3;
      const s = t.p === 'q' ? qs : ps;
      const keys = t.k;
      if (!keys.length || t.v.length !== keys.length * n) throw new Error(`anims.json: bad track in ${name}`);
      if (t.b < 0 || t.b >= nb) throw new Error(`anims.json: bad bone index in ${name}`);
      if (t.p === 'q') tracked.add(t.b);
      for (let f = 0; f < F; f++) {
        // keys are frame indices, ascending; hold outside the range
        let j = 0;
        while (j < keys.length - 1 && keys[j + 1] <= f) j++;
        const k0 = keys[j];
        const k1 = j + 1 < keys.length ? keys[j + 1] : k0;
        const a = k1 > k0 ? Math.min(1, Math.max(0, (f - k0) / (k1 - k0))) : 0;
        const dst = t.p === 'q' ? q : p;
        const off = t.p === 'q' ? (f * nb + t.b) * 4 : f * 3;
        for (let i = 0; i < n; i++) dst[off + i] = (t.v[j * n + i] * (1 - a) + t.v[Math.min(keys.length - 1, j + 1) * n + i] * a) * s;
        if (t.p === 'q') {
          const l = Math.hypot(q[off], q[off + 1], q[off + 2], q[off + 3]) || 1;
          for (let i = 0; i < 4; i++) q[off + i] /= l;
        }
      }
    }
    data[name] = { frames: F, q, p };
    const duration = F > 1 ? (F - 1) / fps : 0;
    let warp: Float32Array | null = null;
    if (Array.isArray(c.warp) && c.warp.length === F && F > 1) {
      const last = c.warp[F - 1] || 1;
      warp = Float32Array.from(c.warp, (x) => x / last);
    }
    info[name] = { name, src: c.src, duration, frames: F, loop: !!c.loop, speed: c.speed || 0, stride: (c.speed || 0) * duration, warp };
    // THREE clip (uniform keys; a static pose gets two identical keys)
    const times = new Float32Array(Math.max(2, F));
    for (let f = 0; f < times.length; f++) times[f] = f / fps;
    const tracks: THREE.KeyframeTrack[] = [];
    for (let b = 0; b < nb; b++) {
      if (!tracked.has(b)) continue;
      const v = new Float32Array(times.length * 4);
      for (let f = 0; f < times.length; f++) v.set(q.subarray((Math.min(f, F - 1) * nb + b) * 4, (Math.min(f, F - 1) * nb + b) * 4 + 4), f * 4);
      tracks.push(new THREE.QuaternionKeyframeTrack(`${boneNodes[b]}.quaternion`, times, v));
    }
    const pv = new Float32Array(times.length * 3);
    for (let f = 0; f < times.length; f++) pv.set(p.subarray(Math.min(f, F - 1) * 3, Math.min(f, F - 1) * 3 + 3), f * 3);
    tracks.push(new THREE.VectorKeyframeTrack(`${boneNodes[hipsI]}.position`, times, pv));
    clips[name] = new THREE.AnimationClip(name, times[times.length - 1], tracks);
  }
  return { clips, info, bones, boneNodes, fps, data, rest, restHips, calib: new Map() };
}

// ---------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------

export type Look = 'hero' | 'rifleman' | 'grenadier' | 'warden' | 'brute' | 'sniper' | 'boss' | 'hologram';

interface LookDef {
  body: number;
  rough: number;
  metal: number;
  visor: number;
  visorGlow: number;
  scale: number;
}

const LOOKS: Record<Exclude<Look, 'hologram'>, LookDef> = {
  hero: { body: 0x2c2f35, rough: 0.5, metal: 0.35, visor: 0x19f0ff, visorGlow: 2.0, scale: 1.0 },
  rifleman: { body: 0x2a3752, rough: 0.75, metal: 0.15, visor: 0xff4a1a, visorGlow: 2.0, scale: 1.0 },
  grenadier: { body: 0x363c48, rough: 0.75, metal: 0.15, visor: 0xff6a1a, visorGlow: 2.0, scale: 1.0 },
  warden: { body: 0x222a3a, rough: 0.6, metal: 0.35, visor: 0xff3a10, visorGlow: 2.4, scale: 1.08 },
  brute: { body: 0x3a3c42, rough: 0.55, metal: 0.45, visor: 0xff2010, visorGlow: 2.8, scale: 1.25 },
  sniper: { body: 0x2b3038, rough: 0.8, metal: 0.1, visor: 0xff2a2a, visorGlow: 2.2, scale: 1.0 },
  boss: { body: 0xe6e2d6, rough: 0.45, metal: 0.2, visor: 0xb44bff, visorGlow: 2.6, scale: 1.05 },
};

const sharedMats = new Map<string, THREE.Material>();
function sharedMat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = sharedMats.get(key);
  if (!m) sharedMats.set(key, (m = make()));
  return m as T;
}
const metalMat = () => sharedMat('metal', () => new THREE.MeshStandardMaterial({ color: 0x1c1f24, metalness: 0.75, roughness: 0.38 }));
const glowMat = (color: number, intensity: number) =>
  sharedMat(`glow:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0.2 }));
const paintMat = (color: number, rough = 0.6, metal = 0.3, side: THREE.Side = THREE.FrontSide) =>
  sharedMat(`paint:${color}:${rough}:${metal}:${side}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side }));

/** Uses only the luminance of the colour map (detail) under the material colour. */
function lumMap(m: THREE.Material) {
  m.userData.lumMap = true;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        float lum = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
        diffuseColor.rgb *= clamp( lum * 2.6, 0.0, 1.5 );
      #endif`,
    );
  };
  m.customProgramCacheKey = () => 'threshold-lum-map';
}

const bodyMatCache = new WeakMap<THREE.Material, Map<string, THREE.Material>>();
function lookMaterial(src: THREE.Material, look: Exclude<Look, 'hologram'>): THREE.Material {
  let m = bodyMatCache.get(src);
  if (!m) bodyMatCache.set(src, (m = new Map()));
  let mat = m.get(look);
  if (!mat) {
    const L = LOOKS[look];
    const s = (src as THREE.MeshStandardMaterial).clone();
    if (src.name.toLowerCase().includes('visor')) {
      s.color.set(0x050505);
      s.emissive = new THREE.Color(L.visor);
      s.emissiveIntensity = L.visorGlow;
      s.roughness = 0.2;
      s.metalness = 0.6;
    } else {
      // the Soldier texture is brown camo: use only its luminance as detail under the look colour
      s.color.set(L.body);
      s.roughness = L.rough;
      s.metalness = L.metal;
      lumMap(s);
    }
    m.set(look, (mat = s));
  }
  return mat;
}

// Attachment geometry (built once, shared)
let GEO: Record<string, THREE.BufferGeometry> | null = null;
function box(w: number, h: number, d: number, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}
function tube(r0: number, r1: number, len: number, x = 0, y = 0, z = 0, seg = 10) {
  // cylinder along +Z
  return new THREE.CylinderGeometry(r1, r0, len, seg).rotateX(Math.PI / 2).translate(x, y, z);
}
function geo(): Record<string, THREE.BufferGeometry> {
  if (GEO) return GEO;
  const merge = (g: THREE.BufferGeometry[]) => {
    const nonIndexed = g.map((x) => (x.index ? x.toNonIndexed() : x));
    for (const x of nonIndexed) for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k);
    const m = mergeGeometries(nonIndexed)!;
    m.computeBoundingSphere();
    return m;
  };
  // weapons: grip at the origin, barrel along +Z, up +Y
  const rifle = merge([
    box(0.06, 0.1, 0.42, 0, 0.05, 0.08),
    tube(0.017, 0.017, 0.24, 0, 0.07, 0.4),
    box(0.045, 0.15, 0.07, 0, -0.05, 0.16),
    box(0.05, 0.09, 0.2, 0, 0.035, -0.22),
    box(0.04, 0.11, 0.05, 0, -0.04, 0),
  ]);
  const rifleGlow = box(0.064, 0.014, 0.28, 0, 0.1, 0.1);
  const launcher = merge([
    tube(0.055, 0.055, 0.46, 0, 0.08, 0.16, 12),
    tube(0.075, 0.075, 0.14, 0, 0.03, 0.02, 8),
    box(0.05, 0.09, 0.22, 0, 0.04, -0.2),
    box(0.04, 0.11, 0.05, 0, -0.04, 0),
  ]);
  const launcherGlow = new THREE.TorusGeometry(0.058, 0.01, 6, 14).translate(0, 0.08, 0.39);
  const sniper = merge([
    box(0.055, 0.1, 0.58, 0, 0.05, 0.1),
    tube(0.015, 0.013, 0.72, 0, 0.07, 0.74),
    tube(0.026, 0.026, 0.3, 0, 0.14, 0.12),
    box(0.05, 0.1, 0.26, 0, 0.03, -0.3),
    box(0.04, 0.11, 0.05, 0, -0.04, 0),
  ]);
  const sniperGlow = new THREE.SphereGeometry(0.022, 8, 6).translate(0, 0.14, 0.28);
  // riot shield: curved panel, convex toward +Z, centred on the origin
  const shield = new THREE.CylinderGeometry(0.75, 0.75, 1.05, 12, 1, true, -0.4, 0.8).translate(0, 0, -0.75);
  const shieldRim = merge([box(0.04, 1.07, 0.05, 0.29, 0, -0.06), box(0.04, 1.07, 0.05, -0.29, 0, -0.06), box(0.6, 0.04, 0.07, 0, 0.52, -0.03), box(0.6, 0.04, 0.07, 0, -0.52, -0.03)]);
  const shieldGlow = box(0.42, 0.035, 0.02, 0, 0.3, 0.01);
  const dome = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const plate = box(0.34, 0.24, 0.08);
  // long coat, open at the front (the gap faces +Z)
  const coat = new THREE.CylinderGeometry(0.2, 0.36, 0.84, 18, 1, true, 0.5, Math.PI * 2 - 1.0);
  const hem = new THREE.TorusGeometry(0.36, 0.016, 6, 24, Math.PI * 2 - 1.0).rotateX(Math.PI / 2).rotateY(Math.PI / 2 - 0.5);
  const collar = new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12, 1, true);
  const bracer = new THREE.CylinderGeometry(0.062, 0.052, 0.21, 12);
  const ring = new THREE.TorusGeometry(0.058, 0.014, 8, 20).rotateX(Math.PI / 2);
  const core = new THREE.SphereGeometry(0.03, 10, 8);
  const satchel = box(0.2, 0.16, 0.1);
  // hidden blade: a slim housing along the forearm; the edge grows out of it along +Y
  const sheath = box(0.028, 0.15, 0.022);
  const edge = box(0.006, 0.3, 0.026, 0, 0.15, 0);
  GEO = { rifle, rifleGlow, launcher, launcherGlow, sniper, sniperGlow, shield, shieldRim, shieldGlow, dome, plate, coat, hem, collar, bracer, ring, core, satchel, sheath, edge };
  return GEO;
}

/** Reference pose an attachment is calibrated in. */
type RefPose = 'rest' | 'aim' | 'carry';

interface AttachDef {
  id: string;
  bone: string;
  pose: RefPose;
  mesh: () => THREE.Object3D;
  /** Desired transform in body space (metres, +Z forward, +X = character's left) in the reference pose. */
  place: (p: (bone: string) => THREE.Vector3, out: THREE.Matrix4) => void;
  /** Pulses with time (scaled per frame). */
  pulse?: boolean;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);

function meshOf(g: THREE.BufferGeometry, m: THREE.Material, scale?: THREE.Vector3) {
  const o = new THREE.Mesh(g, m);
  if (scale) o.scale.copy(scale);
  return o;
}

function gauntlet(color: number, core: number): AttachDef[] {
  return [
    {
      id: 'bracer',
      bone: 'LeftForeArm',
      pose: 'rest',
      mesh: () => {
        const g = new THREE.Group();
        g.add(meshOf(geo().bracer, metalMat()));
        const r = meshOf(geo().ring, glowMat(color, 3.2));
        r.position.y = 0.09;
        g.add(r);
        return g;
      },
      place: (p, out) => {
        // along the forearm (T-pose: +X), 60% toward the wrist
        const a = p('LeftForeArm');
        const b = p('LeftHand');
        _v.lerpVectors(a, b, 0.62);
        _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v2.subVectors(b, a).normalize());
        out.compose(_v, _q, _one);
      },
    },
    {
      id: 'core',
      bone: 'LeftHand',
      pose: 'rest',
      pulse: true,
      mesh: () => meshOf(geo().core, glowMat(core, 4.5)),
      place: (p, out) => {
        // back of the hand (palms face down in the T-pose)
        _v.lerpVectors(p('LeftHand'), p('LeftHandMiddle1'), 0.45);
        _v.y += 0.045;
        out.compose(_v, _q.identity(), _one);
      },
    },
  ];
}

/** The hero's hidden blade: under the right wrist (the strike swings the right arm). */
function hiddenBlade(glow: number): AttachDef {
  return {
    id: 'blade',
    bone: 'RightForeArm',
    pose: 'rest',
    mesh: () => {
      const g = new THREE.Group();
      g.add(meshOf(geo().sheath, metalMat()));
      const edge = meshOf(geo().edge, glowMat(glow, 2.2));
      edge.name = 'edge';
      edge.position.y = 0.04;
      edge.visible = false;
      g.add(edge);
      return g;
    },
    place: (p, out) => {
      // along the forearm near the wrist, on the palm side (palms face down in the T-pose)
      const a = p('RightForeArm');
      const b = p('RightHand');
      _v.lerpVectors(a, b, 0.8);
      _v.y -= 0.045;
      _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v2.subVectors(b, a).normalize());
      out.compose(_v, _q, _one);
    },
  };
}

function handWeapon(kind: 'rifle' | 'launcher' | 'sniper', glow: number): AttachDef {
  return {
    id: kind,
    bone: 'RightHand',
    pose: 'aim',
    mesh: () => {
      const g = new THREE.Group();
      const G = geo();
      g.add(meshOf(G[kind], metalMat()));
      g.add(meshOf(G[`${kind}Glow`], glowMat(glow, 2.5)));
      return g;
    },
    place: (p, out) => {
      // grip in the palm, barrel straight ahead in the aim pose
      _v.lerpVectors(p('RightHand'), p('RightHandMiddle1'), 0.55);
      _v.y -= 0.02;
      out.compose(_v, _q.identity(), _one);
    },
  };
}

function attachmentsFor(look: Look): AttachDef[] {
  const kesslerGlow = 0xff5a1f;
  switch (look) {
    case 'hero':
      return [...gauntlet(0x19f0ff, 0xff8a1f), hiddenBlade(0xbff8ff)];
    case 'rifleman':
      return [handWeapon('rifle', kesslerGlow)];
    case 'grenadier':
      return [
        handWeapon('launcher', kesslerGlow),
        {
          id: 'satchel',
          bone: 'Hips',
          pose: 'rest',
          mesh: () => meshOf(geo().satchel, paintMat(0x2b2f26, 0.9, 0.05)),
          place: (p, out) => {
            _v.copy(p('RightUpLeg'));
            _v.x -= 0.12;
            _v.y += 0.02;
            _v.z -= 0.02;
            out.compose(_v, _q.identity(), _one);
          },
        },
      ];
    case 'warden':
      return [
        {
          id: 'shield',
          bone: 'LeftForeArm',
          pose: 'carry',
          mesh: () => {
            const g = new THREE.Group();
            g.add(meshOf(geo().shield, sharedMat('shield', () => new THREE.MeshStandardMaterial({ color: 0x3a4a60, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }))));
            g.add(meshOf(geo().shieldRim, metalMat()));
            g.add(meshOf(geo().shieldGlow, glowMat(kesslerGlow, 2.6)));
            return g;
          },
          place: (p, out) => {
            // upright, facing forward, in front of the carrying forearm
            _v.lerpVectors(p('LeftForeArm'), p('LeftHand'), 0.5);
            _v.z += 0.1;
            _v.y -= 0.14;
            out.compose(_v, _q.identity(), _one);
          },
        },
        ...pauldrons(0.75),
      ];
    case 'brute':
      return [
        ...pauldrons(1),
        {
          id: 'plate',
          bone: 'Spine2',
          pose: 'rest',
          mesh: () => meshOf(geo().plate, paintMat(0x2a2c30, 0.5, 0.6)),
          place: (p, out) => {
            _v.copy(p('Spine2'));
            _v.z += 0.14;
            _v.y -= 0.04;
            out.compose(_v, _q.identity(), _one);
          },
        },
      ];
    case 'sniper':
      return [handWeapon('sniper', 0xff2a2a)];
    case 'boss':
      return [
        ...gauntlet(0xb44bff, 0xe060ff),
        {
          id: 'coat',
          bone: 'Hips',
          pose: 'rest',
          mesh: () => {
            const g = new THREE.Group();
            g.add(meshOf(geo().coat, paintMat(0xece8dc, 0.55, 0.05, THREE.DoubleSide)));
            const h = meshOf(geo().hem, paintMat(0xd4a93a, 0.3, 0.9));
            h.position.y = -0.41;
            g.add(h);
            return g;
          },
          place: (p, out) => {
            _v.copy(p('Hips'));
            _v.y -= 0.36;
            out.compose(_v, _q.identity(), _one);
          },
        },
        {
          id: 'collar',
          bone: 'Neck',
          pose: 'rest',
          mesh: () => meshOf(geo().collar, paintMat(0xd4a93a, 0.3, 0.9, THREE.DoubleSide)),
          place: (p, out) => {
            _v.copy(p('Neck'));
            _v.y += 0.02;
            out.compose(_v, _q.identity(), _one);
          },
        },
      ];
    default:
      return [];
  }
}

function pauldrons(size: number): AttachDef[] {
  const s = new THREE.Vector3(0.13 * size, 0.075 * size, 0.14 * size);
  return (['Left', 'Right'] as const).map((side) => ({
    id: `pauldron${side}`,
    bone: `${side}Shoulder`,
    pose: 'rest' as const,
    mesh: () => meshOf(geo().dome, paintMat(0x3a3e46, 0.45, 0.65), s),
    place: (p: (b: string) => THREE.Vector3, out: THREE.Matrix4) => {
      _v.copy(p(`${side}Arm`));
      _v.x += side === 'Left' ? -0.01 : 0.01;
      _v.y += 0.05;
      out.compose(_v, _q.identity(), _one);
    },
  }));
}

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

/**
 * While swimming, the water surface sits this far above the character root
 * (metres at scale 1; multiply by `character.scale`): put the root at
 * `waterY - SWIM_WATERLINE * scale`.
 */
export const SWIM_WATERLINE = 1.4;

/** getPose() also returns these (setPose uses them when present). */
export interface CharacterPoseExt extends CharacterPose {
  /** Smoothed airborne blend 0..1. */
  air: number;
  /** Smoothed swimming blend 0..1. */
  swim: number;
}

/** Locomotion clips (base layer). */
const BASE: readonly ClipName[] = ['idle', 'walk', 'run', 'sprint', 'crouchIdle', 'crouchWalk', 'jumpLoop', 'swimIdle', 'swim'];
/** Base clips sampled by the shared cycle phase (stride-matched) rather than by time. */
const CYCLE = new Set<ClipName>(['walk', 'run', 'sprint', 'crouchWalk', 'swim']);
/** Overlays that always drive the legs too; the others hand the legs back to locomotion while moving. */
const FULL_BODY = new Set<ClipName>(['roll', 'jumpStart', 'death', 'pickUp', 'swimIdle', 'swim']);

type OverlayMode = 'play' | 'downed' | 'getup' | 'death';

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Exponential smoothing factor. */
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const smooth01 = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

// scratch (single-threaded, shared)
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _pos2 = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _invBody = new THREE.Matrix4();
const _chest = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

export class Character implements CharacterAPI {
  readonly root = new THREE.Group();
  readonly look: Look;
  /** The skinned Soldier clone (rotated to face +Z). */
  readonly model: THREE.Object3D;
  /** Bones by short Mixamo name ('Hips', 'LeftHand', ...). */
  readonly bones: Record<string, THREE.Bone> = {};
  /** Visual scale of this look. */
  readonly scale: number;
  readonly anims: AnimLibrary;
  /** Named attachments (weapon, shield, gauntlet parts...). */
  readonly attachments: Record<string, THREE.Object3D> = {};

  /** Pivot of the whole-body tumble (at hips height). */
  private tumbleGroup = new THREE.Group();
  private body = new THREE.Group();
  private list: THREE.Bone[];
  private hipsI: number;
  private spineI: number;
  private spineFix = new Float32Array(4);
  private upper: Float32Array;
  private acc: Float32Array;
  private smp: Float32Array;
  private pAcc = new THREE.Vector3();
  private pSmp = new THREE.Vector3();
  private baseW = new Float32Array(BASE.length);
  private meshes: THREE.Mesh[] = [];
  private ownMats: THREE.Material[] = [];
  private faded = false;
  private pulses: THREE.Object3D[] = [];
  private bladeEdge: THREE.Object3D | null = null;
  private restChestQ = new THREE.Quaternion();

  // --- state (everything getPose() returns) ---
  private mixerT = 0;
  private loco = { speed: 0, grounded: true, vy: 0, crouch: 0, aim: 0, downed: false, weaponUp: 0 };
  private air = 0;
  private swim = 0;
  private ov = { clip: null as ClipName | null, t: 0, w: 0, speed: 1, hold: false, fadeIn: 0.15, fadeOut: 0.2, fading: false, mode: 'play' as OverlayMode };
  private tumble: THREE.Quaternion | null = null;
  dead = false;
  deathKind: DeathKind | null = null;
  // --- continuation-only state (not needed to render a frame) ---
  private airTimer = 0;
  private frozen = false;

  constructor(asset: CharacterAsset, anims: AnimLibrary, look: Look, hologramMat?: THREE.Material) {
    this.look = look;
    this.anims = anims;
    this.scale = look === 'hologram' ? 1 : LOOKS[look].scale;
    this.model = SkeletonUtils.clone(asset.scene);
    const holo =
      look === 'hologram'
        ? hologramMat ?? sharedMat('holo', () => new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.35, depthWrite: false }))
        : null;
    this.model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones[shortBoneName(o.name)] = o as THREE.Bone;
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.castShadow = !holo;
      m.receiveShadow = !holo;
      // culled against a padded bind-pose sphere (roomy enough for any pose or tumble), so
      // off-screen characters aren't skinned and drawn in every pass
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      if (m.isSkinnedMesh && m.geometry.boundingSphere) {
        const bs = m.geometry.boundingSphere.clone();
        bs.radius = bs.radius * 2 + 20;
        m.boundingSphere = bs;
      }
      m.frustumCulled = !holo;
      m.material = holo ?? lookMaterial(m.material as THREE.Material, look as Exclude<Look, 'hologram'>);
      this.meshes.push(m);
    });
    // the rig is authored facing -Z; gameplay forward is +Z
    this.model.rotation.y = Math.PI;
    this.body.scale.setScalar(this.scale);
    this.body.add(this.model);
    this.tumbleGroup.add(this.body);
    this.root.add(this.tumbleGroup);
    const pivot = anims.restHips.z * 0.01 * this.scale; // Hips height (Soldier units are cm, Z-up under the scaled root node)
    this.tumbleGroup.position.y = pivot;
    this.body.position.y = -pivot;

    const nb = anims.bones.length;
    this.list = anims.bones.map((b) => {
      const bone = this.bones[b];
      if (!bone) throw new Error(`Character: bone ${b} missing`);
      return bone;
    });
    this.hipsI = anims.bones.indexOf('Hips');
    this.spineI = anims.bones.indexOf('Spine');
    this.upper = new Float32Array(nb);
    anims.bones.forEach((b, i) => {
      this.upper[i] = b === 'Spine' ? 0.75 : b === 'Spine1' ? 0.9 : /^(Spine2|Neck|Head|Left(Shoulder|Arm|ForeArm|Hand)|Right(Shoulder|Arm|ForeArm|Hand))/.test(b) ? 1 : 0;
    });
    this.acc = new Float32Array(nb * 4);
    this.smp = new Float32Array(nb * 4);

    // chest rest orientation (body space) for chest-relative procedural poses
    this.writePose(anims.rest, anims.restHips);
    this.body.updateMatrixWorld(true);
    _invBody.copy(this.body.matrixWorld).invert();
    this.bodyQ(this.bones.Spine2, this.restChestQ);

    if (!holo) this.attach(attachmentsFor(look));
    this.bladeEdge = this.attachments.blade?.getObjectByName('edge') ?? null;
    this.mixerT = 0;
    this.evaluate();
  }

  // -------------------------------------------------------------------------
  // CharacterAPI
  // -------------------------------------------------------------------------

  update(dt: number, s: LocomotionInput): void {
    dt = Math.max(0, Math.min(dt, 0.25));
    const L = this.loco;
    const k = damp;
    L.grounded = s.grounded;
    L.vy = s.vy;
    L.speed += (Math.max(0, s.speed || 0) - L.speed) * k(10, dt);
    L.crouch += (clamp01(s.crouch || 0) - L.crouch) * k(10, dt);
    L.aim += (clamp01(s.aim || 0) - L.aim) * k(14, dt);
    L.weaponUp += (clamp01(s.weaponUp ?? 0) - L.weaponUp) * k(8, dt);
    this.airTimer = s.grounded && !this.tumble ? 0 : this.airTimer + dt;
    const airT = this.tumble || (!s.grounded && this.airTimer > 0.1) ? 1 : 0;
    this.air += (airT - this.air) * k(airT > this.air ? 9 : 18, dt);
    this.swim += ((s.swimming ? 1 : 0) - this.swim) * k(5, dt);
    const downed = !!s.downed;
    if (downed !== L.downed) {
      L.downed = downed;
      if (!this.dead) {
        if (downed) this.beginDowned();
        else this.beginGetUp();
      }
    }
    this.advanceOverlay(dt);
    this.mixerT += dt * this.clockRate();
    if (this.frozen) {
      this.applyTumble();
      return;
    }
    this.evaluate();
    // a finished death is a still frame: stop re-evaluating it
    const ov = this.ov;
    if (this.dead && this.deathKind !== 'drown' && ov.clip === 'death' && ov.w >= 1 && ov.t >= this.anims.info.death.duration) this.frozen = true;
  }

  play(name: ClipName, opts?: { fade?: number; speed?: number; hold?: boolean }): void {
    if (this.dead || this.ov.mode === 'downed' || this.ov.mode === 'getup') return;
    const ov = this.ov;
    const info = this.anims.info[name];
    if (ov.clip === name && info.loop && !ov.fading) return; // already looping
    const fade = Math.max(0, opts?.fade ?? 0.15);
    // continue the current overlay weight: clip poses meet instead of dipping to locomotion
    ov.w = ov.clip ? ov.w : 0;
    ov.clip = name;
    ov.t = 0;
    ov.speed = opts?.speed ?? 1;
    ov.hold = !!opts?.hold;
    ov.fadeIn = fade;
    ov.fadeOut = Math.max(fade, 0.12);
    ov.fading = false;
    ov.mode = 'play';
    this.frozen = false;
  }

  stop(name?: ClipName): void {
    const ov = this.ov;
    if (!ov.clip || this.dead || ov.mode !== 'play') return;
    if (name && name !== ov.clip) return;
    ov.fading = true;
  }

  setTumble(q: THREE.Quaternion | null): void {
    if (q) (this.tumble ??= new THREE.Quaternion()).copy(q);
    else this.tumble = null;
    if (!this.dead) this.frozen = false;
    this.applyTumble();
  }

  die(kind: DeathKind): void {
    if (this.dead) return;
    this.dead = true;
    this.deathKind = kind;
    this.frozen = false;
    const ov = this.ov;
    if (kind === 'drown') {
      ov.w = ov.clip ? ov.w : 0;
      ov.clip = 'swimIdle';
      ov.t = 0;
      ov.speed = 0.55;
      ov.hold = false;
      ov.fadeIn = 0.5;
    } else {
      // already lying (downed): keep going from there
      const from = ov.clip === 'death' ? ov.t : 0;
      ov.w = ov.clip ? ov.w : 0;
      ov.clip = 'death';
      ov.t = from;
      ov.speed = kind === 'cut' ? 1.5 : kind === 'blast' ? 1.7 : kind === 'fall' ? 1.4 : 1.15;
      ov.hold = true;
      ov.fadeIn = 0.1;
    }
    ov.fading = false;
    ov.mode = 'death';
  }

  revive(): void {
    this.dead = false;
    this.deathKind = null;
    this.frozen = false;
    Object.assign(this.loco, { speed: 0, grounded: true, vy: 0, crouch: 0, aim: 0, downed: false, weaponUp: 0 });
    this.air = 0;
    this.swim = 0;
    this.airTimer = 0;
    Object.assign(this.ov, { clip: null, t: 0, w: 0, speed: 1, hold: false, fading: false, mode: 'play' });
    this.tumble = null;
    this.applyTumble();
    this.evaluate();
  }

  getPose(): CharacterPoseExt {
    const L = this.loco;
    const q = this.tumble;
    return {
      loco: { speed: L.speed, grounded: L.grounded, vy: L.vy, crouch: L.crouch, aim: L.aim, downed: L.downed, weaponUp: L.weaponUp },
      clip: this.ov.clip,
      clipT: this.ov.t,
      clipW: this.ov.w,
      tumble: q ? ([q.x, q.y, q.z, q.w] as Tuple4) : null,
      dead: this.dead,
      deathKind: this.deathKind,
      mixerT: this.mixerT,
      air: this.air,
      swim: this.swim,
    };
  }

  setPose(p: CharacterPose): void {
    const x = p as Partial<CharacterPoseExt>;
    Object.assign(this.loco, p.loco);
    this.air = typeof x.air === 'number' ? x.air : p.loco.grounded ? 0 : 1;
    this.swim = typeof x.swim === 'number' ? x.swim : 0;
    const ov = this.ov;
    ov.clip = p.clip;
    ov.t = p.clipT;
    ov.w = p.clip ? p.clipW : 0;
    ov.fading = false;
    ov.mode = p.dead ? 'death' : p.clip === 'death' && p.loco.downed ? 'downed' : 'play';
    ov.hold = p.clip === 'death';
    if (p.tumble) (this.tumble ??= new THREE.Quaternion()).fromArray(p.tumble);
    else this.tumble = null;
    this.dead = p.dead;
    this.deathKind = p.deathKind;
    this.mixerT = p.mixerT;
    this.frozen = false;
    this.applyTumble();
    this.evaluate();
  }

  setOpacity(o: number): void {
    if (o >= 1 && !this.faded) return;
    if (!this.faded) {
      // per-instance copies so shared look materials stay untouched
      this.faded = true;
      this.root.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        const src = m.material as THREE.Material;
        const c = src.clone();
        if (c.userData.lumMap) lumMap(c);
        c.userData.base = { opacity: src.opacity, transparent: src.transparent, depthWrite: src.depthWrite };
        this.ownMats.push(c);
        m.material = c;
      });
    }
    for (const m of this.ownMats) {
      const b = m.userData.base as { opacity: number; transparent: boolean; depthWrite: boolean };
      m.opacity = b.opacity * o;
      m.transparent = b.transparent || o < 1;
      m.depthWrite = b.depthWrite && o >= 1;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const m of this.ownMats) m.dispose();
    this.ownMats.length = 0;
    for (const m of this.meshes) (m as THREE.SkinnedMesh).skeleton?.dispose();
  }

  // -------------------------------------------------------------------------
  // Extras
  // -------------------------------------------------------------------------

  /** World position of a bone (short name), e.g. 'Head', 'LeftHand'. */
  bonePos(name: string, out = new THREE.Vector3()): THREE.Vector3 {
    const b = this.bones[name];
    return b ? b.getWorldPosition(out) : this.root.getWorldPosition(out);
  }

  /** Rift gauntlet emitter (hero / boss), else the left hand. */
  gauntletPos(out = new THREE.Vector3()): THREE.Vector3 {
    const c = this.attachments.core;
    return c ? c.getWorldPosition(out) : this.bonePos('LeftHand', out);
  }

  /** The hero's hidden blade out of the wrist: 0 sheathed .. 1 all the way out. */
  setBlade(k: number) {
    const e = this.bladeEdge;
    if (!e) return;
    e.visible = k > 0.01;
    e.scale.y = Math.max(0.01, k);
  }

  /** Weapon muzzle (rifleman / grenadier / sniper), else the right hand. */
  muzzlePos(out = new THREE.Vector3()): THREE.Vector3 {
    const w = this.attachments.rifle ?? this.attachments.launcher ?? this.attachments.sniper;
    if (!w) return this.bonePos('RightHand', out);
    const z = this.attachments.sniper ? 1.1 : this.attachments.launcher ? 0.4 : 0.52;
    return w.localToWorld(out.set(0, 0.07, z));
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private beginDowned() {
    const ov = this.ov;
    ov.t = ov.clip === 'death' ? ov.t : 0;
    ov.w = ov.clip ? ov.w : 0;
    ov.clip = 'death';
    ov.speed = 1.4;
    ov.hold = true;
    ov.fadeIn = 0.12;
    ov.fadeOut = 0.3;
    ov.fading = false;
    ov.mode = 'downed';
    this.frozen = false;
  }

  private beginGetUp() {
    const ov = this.ov;
    if (ov.clip !== 'death') return;
    // get up: the fall, reversed and quicker, then hand back to locomotion
    ov.t = Math.min(ov.t, 1.15);
    ov.speed = 1.6;
    ov.mode = 'getup';
    ov.fadeOut = 0.3;
    this.frozen = false;
  }

  private advanceOverlay(dt: number) {
    const ov = this.ov;
    if (!ov.clip) return;
    const info = this.anims.info[ov.clip];
    const d = info.duration;
    if (ov.mode === 'getup') {
      ov.t -= dt * ov.speed;
      if (ov.t <= 0) {
        ov.t = 0;
        ov.fading = true;
      }
    } else {
      ov.t += dt * ov.speed;
      if (info.loop) {
        if (d > 0 && ov.t > d * 64) ov.t %= d;
      } else if (ov.t >= d) {
        ov.t = d;
      }
    }
    if (ov.fading) {
      ov.w -= ov.fadeOut > 0 ? dt / ov.fadeOut : 1;
    } else {
      ov.w = ov.fadeIn > 0 ? Math.min(1, ov.w + dt / ov.fadeIn) : 1;
      if (ov.mode === 'play' && !info.loop && !ov.hold) ov.w = Math.min(ov.w, ov.fadeOut > 0 ? (d - ov.t) / ov.fadeOut : d > ov.t ? 1 : 0);
    }
    if (ov.w <= 0) {
      ov.w = 0;
      ov.clip = null;
      ov.fading = false;
      ov.mode = 'play';
    }
  }

  /** Base-layer weights (pure function of the smoothed locomotion values). */
  private computeBase() {
    const I = this.anims.info;
    const L = this.loco;
    const v = L.speed;
    const W = this.baseW;
    // standing: idle -> walk (0..0.6 m/s), walk -> run -> sprint between natural speeds
    const vW = Math.max(0.7, I.walk.speed);
    const vR = Math.max(vW + 0.5, I.run.speed);
    const vS = Math.max(vR + 0.5, I.sprint.speed);
    let idle = 0, walk = 0, run = 0, sprint = 0;
    if (v <= 0.6) {
      walk = v / 0.6;
      idle = 1 - walk;
    } else if (v <= vW) walk = 1;
    else if (v <= vR) {
      run = (v - vW) / (vR - vW);
      walk = 1 - run;
    } else if (v <= vS) {
      sprint = (v - vR) / (vS - vR);
      run = 1 - sprint;
    } else sprint = 1;
    const cw = clamp01(v / 0.45);
    const sw = clamp01(v / 0.6);
    const c = clamp01(L.crouch);
    const a = clamp01(this.air);
    const s = clamp01(this.swim);
    const g = (1 - s) * (1 - a);
    W[0] = g * (1 - c) * idle;
    W[1] = g * (1 - c) * walk;
    W[2] = g * (1 - c) * run;
    W[3] = g * (1 - c) * sprint;
    W[4] = g * c * (1 - cw);
    W[5] = g * c * cw;
    W[6] = (1 - s) * a;
    W[7] = s * (1 - sw);
    W[8] = s * sw;
  }

  /** mixerT advance per second: 1 for time-based loops, the stride-matched cycle rate for gaits. */
  private clockRate(): number {
    this.computeBase();
    const I = this.anims.info;
    let wt = 0, wm = 0, stride = 0;
    for (let i = 0; i < BASE.length; i++) {
      const w = this.baseW[i];
      if (w <= 0) continue;
      const name = BASE[i];
      if (CYCLE.has(name)) {
        wm += w;
        stride += w * Math.max(0.2, I[name].stride);
      } else wt += w;
    }
    if (wm <= 1e-6) return 1;
    const cycles = Math.min(2.4, this.loco.speed / (stride / wm));
    return (wt + wm * cycles) / (wt + wm);
  }

  private baseTime(name: ClipName): number {
    const info = this.anims.info[name];
    const d = info.duration;
    if (d <= 0) return 0;
    if (!CYCLE.has(name)) return this.mixerT - Math.floor(this.mixerT / d) * d;
    const phase = this.mixerT - Math.floor(this.mixerT);
    const w = info.warp;
    if (!w) return phase * d;
    // distance phase -> clip time
    let i = 0;
    while (i < w.length - 2 && w[i + 1] <= phase) i++;
    const span = w[i + 1] - w[i];
    return (i + (span > 0 ? Math.min(1, (phase - w[i]) / span) : 0)) / this.anims.fps;
  }

  private overlayTime(): number {
    const ov = this.ov;
    const info = this.anims.info[ov.clip!];
    const d = info.duration;
    if (d <= 0) return 0;
    if (info.loop) return ov.t - Math.floor(ov.t / d) * d;
    return Math.min(d, Math.max(0, ov.t));
  }

  /** Dense sample of a clip into this.smp / this.pSmp. */
  private sample(name: ClipName, t: number) {
    const lib = this.anims;
    const D = lib.data[name];
    const nb4 = lib.bones.length * 4;
    const F = D.frames;
    let x = t * lib.fps;
    if (x < 0) x = 0;
    let i0 = Math.floor(x);
    let a = x - i0;
    if (i0 >= F - 1) {
      i0 = F - 1;
      a = 0;
    }
    const i1 = a > 0 ? i0 + 1 : i0;
    const q = D.q;
    const o0 = i0 * nb4;
    const o1 = i1 * nb4;
    const out = this.smp;
    for (let j = 0; j < nb4; j += 4) {
      let x0 = q[o0 + j], y0 = q[o0 + j + 1], z0 = q[o0 + j + 2], w0 = q[o0 + j + 3];
      if (a > 0) {
        let x1 = q[o1 + j], y1 = q[o1 + j + 1], z1 = q[o1 + j + 2], w1 = q[o1 + j + 3];
        if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) {
          x1 = -x1;
          y1 = -y1;
          z1 = -z1;
          w1 = -w1;
        }
        x0 += (x1 - x0) * a;
        y0 += (y1 - y0) * a;
        z0 += (z1 - z0) * a;
        w0 += (w1 - w0) * a;
        const l = 1 / (Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0) || 1);
        x0 *= l;
        y0 *= l;
        z0 *= l;
        w0 *= l;
      }
      out[j] = x0;
      out[j + 1] = y0;
      out[j + 2] = z0;
      out[j + 3] = w0;
    }
    const p = D.p;
    this.pSmp.set(p[i0 * 3] + (p[i1 * 3] - p[i0 * 3]) * a, p[i0 * 3 + 1] + (p[i1 * 3 + 1] - p[i0 * 3 + 1]) * a, p[i0 * 3 + 2] + (p[i1 * 3 + 2] - p[i0 * 3 + 2]) * a);
  }

  /** acc = nlerp(acc, src, w_i) per bone, w_i = w * (mask ? upper_i + (1 - upper_i) * legs : 1). */
  private blendInto(src: Float32Array, w: number, masked: boolean, legs: number) {
    const acc = this.acc;
    const up = this.upper;
    const h = this.hipsI * 4;
    const sp = this.spineI * 4;
    if (masked && legs < 1 && sp >= 0) {
      // upper-body layer over different hips: keep the layer's torso orientation
      // in body space (spine' = inverse(finalHips) * layerHips * layerSpine)
      const wh = w * legs;
      _qa.fromArray(acc, h);
      _qb.fromArray(src, h);
      if (wh > 0) _qa.slerp(_qb, wh);
      _qc.fromArray(src, sp);
      _qa.invert().multiply(_qb).multiply(_qc).normalize();
      _qa.toArray(this.spineFix);
    }
    for (let i = 0, j = 0; j < acc.length; i++, j += 4) {
      const wi = masked ? w * (up[i] + (1 - up[i]) * legs) : w;
      if (wi <= 0) continue;
      const s = masked && legs < 1 && j === sp ? this.spineFix : src;
      const o = s === src ? j : 0;
      let x = s[o], y = s[o + 1], z = s[o + 2], ww = s[o + 3];
      if (acc[j] * x + acc[j + 1] * y + acc[j + 2] * z + acc[j + 3] * ww < 0) {
        x = -x;
        y = -y;
        z = -z;
        ww = -ww;
      }
      const ax = acc[j] + (x - acc[j]) * wi;
      const ay = acc[j + 1] + (y - acc[j + 1]) * wi;
      const az = acc[j + 2] + (z - acc[j + 2]) * wi;
      const aw = acc[j + 3] + (ww - acc[j + 3]) * wi;
      const l = 1 / (Math.sqrt(ax * ax + ay * ay + az * az + aw * aw) || 1);
      acc[j] = ax * l;
      acc[j + 1] = ay * l;
      acc[j + 2] = az * l;
      acc[j + 3] = aw * l;
    }
  }

  private writePose(q: Float32Array, hips: THREE.Vector3) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) list[i].quaternion.fromArray(q, i * 4);
    list[this.hipsI].position.copy(hips);
  }

  /** Recomputes every bone from the pose state. */
  private evaluate() {
    const lib = this.anims;
    const acc = this.acc;
    const L = this.loco;
    const ov = this.ov;
    const deadFull = this.dead && ov.clip !== null && ov.w >= 1;
    // 1. locomotion (weighted running nlerp, sign-aligned)
    acc.set(lib.rest);
    this.pAcc.copy(lib.restHips);
    if (!deadFull) {
      this.computeBase();
      let total = 0;
      for (let i = 0; i < BASE.length; i++) {
        const w = this.baseW[i];
        if (w <= 1e-4) continue;
        const name = BASE[i];
        this.sample(name, this.baseTime(name));
        total += w;
        const f = w / total;
        this.blendInto(this.smp, f, false, 1);
        this.pAcc.lerp(this.pSmp, f);
      }
      // 2. rifle held up (upper body only)
      if (L.weaponUp > 1e-3 && !this.dead) {
        this.sample('aim', 0);
        this.blendInto(this.smp, L.weaponUp, true, 0);
      }
    }
    // 3. overlay clip
    if (ov.clip && ov.w > 1e-4) {
      this.sample(ov.clip, this.overlayTime());
      const full = this.dead || ov.mode !== 'play' || FULL_BODY.has(ov.clip);
      const moving = Math.max(clamp01((L.speed - 0.5) / 1.2), this.air, this.swim);
      const legs = full ? 1 : 1 - moving;
      this.blendInto(this.smp, ov.w, !full, legs);
      this.pAcc.lerp(this.pSmp, ov.w * legs);
    }
    this.writePose(acc, this.pAcc);
    this.applyTumble();
    // 4. procedural layers (body space)
    this.procedural();
  }

  private applyTumble() {
    if (this.tumble) this.tumbleGroup.quaternion.copy(this.tumble);
    else this.tumbleGroup.quaternion.identity();
  }

  /** Body-space rotation of a bone (needs fresh matrices + _invBody). */
  private bodyQ(o: THREE.Object3D, out: THREE.Quaternion) {
    _m.multiplyMatrices(_invBody, o.matrixWorld).decompose(_pos2, out, _scl);
    return out;
  }

  private bodyP(o: THREE.Object3D, out: THREE.Vector3) {
    return out.setFromMatrixPosition(_m.multiplyMatrices(_invBody, o.matrixWorld));
  }

  /** Set a bone's body-space rotation. */
  private setBodyQ(bone: THREE.Bone, q: THREE.Quaternion) {
    this.bodyQ(bone.parent!, _qc);
    bone.quaternion.copy(_qc.invert().multiply(q)).normalize();
    bone.updateMatrixWorld(true);
  }

  /** Rotate a bone about a body-space axis (through its joint). */
  private turn(name: string, axis: THREE.Vector3, angle: number) {
    if (Math.abs(angle) < 1e-5) return;
    const b = this.bones[name];
    this.bodyQ(b, _qa);
    _qb.setFromAxisAngle(axis, angle).multiply(_qa);
    this.setBodyQ(b, _qb);
  }

  /** Swing a bone so it points (towards `child`) along a body-space direction, by weight w. */
  private point(name: string, child: string, dir: THREE.Vector3, w: number) {
    if (w <= 1e-4) return;
    const b = this.bones[name];
    this.bodyP(b, _pos);
    this.bodyP(this.bones[child], _dir).sub(_pos).normalize();
    _qb.setFromUnitVectors(_dir, _axis.copy(dir).normalize());
    _qa.identity().slerp(_qb, w);
    this.bodyQ(b, _qc);
    _qa.multiply(_qc);
    this.setBodyQ(b, _qa);
  }

  /** Chest frame: rest-body vector -> current body vector. */
  private chestVec(x: number, y: number, z: number, out: THREE.Vector3) {
    return out.set(x, y, z).applyQuaternion(_chest);
  }

  private procedural() {
    const L = this.loco;
    const look = this.look;
    const dead = this.dead;
    const kind = this.deathKind;
    const aim = dead ? 0 : L.aim;
    const carry = look === 'warden' && !dead ? 1 - this.swim : 0;
    const tumbling = this.tumble && !dead ? 1 : 0;
    const fall = dead ? 0 : clamp01((-L.vy - 7) / 8) * this.air * (1 - this.swim);
    const flail = Math.max(tumbling, fall);
    const deathT = dead && this.ov.clip ? this.ov.t : 0;
    const dd = this.anims.info.death.duration;
    const limp = dead && (kind === 'fall' || kind === 'blast') && this.ov.clip === 'death' ? smooth01((deathT / dd - 0.25) / 0.5) : 0;
    // cut: a quick buckle while he drops, gone once he lies flat
    const crumple = dead && kind === 'cut' && this.ov.clip === 'death' ? smooth01(deathT / (dd * 0.14)) * (1 - smooth01((deathT / dd - 0.3) / 0.12)) : 0;
    const drown = dead && kind === 'drown' ? smooth01(deathT / 2.5) : 0;
    const t = this.mixerT;
    // the gauntlet core breathes, and swells while aiming
    const k = 1 + 0.12 * Math.sin(t * 5) + 0.45 * aim;
    for (const p of this.pulses) p.scale.setScalar(k);
    if (!(aim > 1e-3 || carry > 0 || flail > 1e-3 || limp > 0 || crumple > 0 || drown > 0)) return;

    this.body.updateMatrixWorld(true);
    _invBody.copy(this.body.matrixWorld).invert();
    this.bodyQ(this.bones.Spine2, _chest).multiply(_qa.copy(this.restChestQ).invert());

    if (crumple > 0) {
      // buckle forward at the waist and knees as he drops
      const side = this.chestVec(-1, 0, 0, _v);
      this.turn('Spine1', side, -0.35 * crumple);
      this.turn('Spine2', side, -0.25 * crumple);
      this.turn('Neck', side, -0.35 * crumple);
      this.turn('LeftArm', this.chestVec(0, 0, 1, _v), -0.5 * crumple);
      this.turn('RightArm', this.chestVec(0, 0, 1, _v), 0.5 * crumple);
    }
    if (limp > 0) {
      // arms flung wide, head lolled, a knee bent
      const fwd = this.chestVec(0, 0, 1, _v2);
      this.turn('LeftArm', fwd, 0.55 * limp);
      this.turn('RightArm', fwd, -0.7 * limp);
      this.turn('LeftForeArm', fwd, 0.4 * limp);
      this.turn('Head', this.chestVec(0, 1, 0, _v), 0.55 * limp);
      this.turn('RightUpLeg', this.chestVec(-1, 0, 0, _v), -0.35 * limp);
      this.turn('RightLeg', this.chestVec(-1, 0, 0, _v), 0.7 * limp);
      this.turn('LeftUpLeg', fwd, 0.18 * limp);
    }
    if (drown > 0) {
      // limp float: arms drift up, head drops back
      const fwd = this.chestVec(0, 0, 1, _v2);
      this.turn('LeftArm', fwd, 0.7 * drown);
      this.turn('RightArm', fwd, -0.7 * drown);
      this.turn('Head', this.chestVec(-1, 0, 0, _v), 0.45 * drown);
    }
    if (carry > 0) {
      // warden: shield arm across the front of the body
      this.point('LeftArm', 'LeftForeArm', this.chestVec(0.1, -0.78, 0.6, _v), carry);
      this.point('LeftForeArm', 'LeftHand', this.chestVec(-0.8, 0.12, 0.58, _v), carry);
    }
    if (aim > 1e-3) {
      // rift gauntlet raised: chest turns, left arm straight ahead
      this.turn('Spine2', Y, -0.28 * aim);
      this.point('LeftArm', 'LeftForeArm', _v.set(0.12, 0.08, 1), aim);
      this.point('LeftForeArm', 'LeftHand', _v.set(0.02, 0.06, 1), aim);
      this.point('LeftHand', 'LeftHandMiddle1', _v.set(0, 0.02, 1), aim * 0.8);
    }
    if (flail > 1e-3) {
      const fwd = this.chestVec(0, 0, 1, _v2);
      const side = this.chestVec(-1, 0, 0, _v);
      const up = 0.9 * fall;
      this.turn('LeftArm', fwd, flail * (0.55 * Math.sin(t * 9.1) + 0.3) + up);
      this.turn('RightArm', fwd, -flail * (0.55 * Math.sin(t * 8.3 + 1.7) + 0.3) - up);
      this.turn('LeftArm', side, flail * 0.5 * Math.sin(t * 6.7 + 0.5));
      this.turn('RightArm', side, flail * 0.5 * Math.sin(t * 7.3 + 2.2));
      this.turn('LeftUpLeg', side, flail * 0.45 * Math.sin(t * 7.9));
      this.turn('RightUpLeg', side, flail * 0.45 * Math.sin(t * 7.9 + Math.PI));
      this.turn('LeftLeg', side, -flail * (0.35 + 0.3 * Math.sin(t * 6.1)));
      this.turn('RightLeg', side, -flail * (0.35 + 0.3 * Math.sin(t * 5.3 + 1)));
    }
  }

  /** Builds this look's attachments, calibrated once per look in their reference poses. */
  private attach(defs: AttachDef[]) {
    if (!defs.length) return;
    const lib = this.anims;
    const need = defs.filter((d) => !lib.calib.has(`${this.look}:${d.id}`));
    if (need.length) {
      for (const pose of ['rest', 'aim', 'carry'] as RefPose[]) {
        const list = need.filter((d) => d.pose === pose);
        if (!list.length) continue;
        // pose the skeleton
        if (pose === 'rest') this.writePose(lib.rest, lib.restHips);
        else {
          this.sample(pose === 'aim' ? 'aim' : 'idle', 0);
          this.writePose(this.smp, this.pSmp);
        }
        this.body.updateMatrixWorld(true);
        _invBody.copy(this.body.matrixWorld).invert();
        if (pose === 'carry') {
          this.bodyQ(this.bones.Spine2, _chest).multiply(_qa.copy(this.restChestQ).invert());
          this.point('LeftArm', 'LeftForeArm', this.chestVec(0.1, -0.78, 0.6, _v), 1);
          this.point('LeftForeArm', 'LeftHand', this.chestVec(-0.8, 0.12, 0.58, _v), 1);
        }
        // body space excludes the look scale: placements are in metres at scale 1
        const P = (b: string) => this.bodyP(this.bones[b], new THREE.Vector3());
        for (const d of list) {
          const want = new THREE.Matrix4();
          d.place(P, want);
          // local = inverse(boneInBody) * want
          const boneInBody = _m2.multiplyMatrices(_invBody, this.bones[d.bone].matrixWorld);
          lib.calib.set(`${this.look}:${d.id}`, boneInBody.clone().invert().multiply(want));
        }
      }
    }
    for (const d of defs) {
      // holder carries the calibrated bone-local transform (incl. the rig's cm scale);
      // the content keeps its own transform (and pulses)
      const holder = new THREE.Group();
      holder.name = d.id;
      const o = d.mesh();
      o.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      holder.add(o);
      lib.calib.get(`${this.look}:${d.id}`)!.decompose(holder.position, holder.quaternion, holder.scale);
      this.bones[d.bone].add(holder);
      this.attachments[d.id] = holder;
      if (d.pulse) this.pulses.push(o);
    }
  }
}
