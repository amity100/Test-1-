import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, Simplex2, clamp, damp } from '../core/noise';
import type { TextureSet } from '../world/Textures';
import { gnarlyTube } from '../world/Vegetation';
import { Clip, PoseMixer, pose, type Pose, UPPER_L, UPPER_R, TORSO, LEGS } from './Rig';
import { Rope } from './Rope';

/*
 * Young David — "וְהוּא אַדְמוֹנִי עִם יְפֵה עֵינַיִם וְטוֹב רֹאִי" (1 Samuel 16:12):
 * ruddy, with beautiful eyes, handsome. A shepherd youth in a coarse undyed wool/linen tunic
 * (כֻּתֹּנֶת), leather belt, shepherd's bag (כְּלִי הָרֹעִים / יַלְקוּט), sandals, his staff (מַקֵּל)
 * and his sling (קֶלַע) — cf. 1 Samuel 17:40.
 *
 * Procedural geometry on a joint hierarchy. Character faces +Z; character's left is +X.
 */

const NZ = new Simplex2(4040);

function limb(len: number, r0: number, r1: number, bulge = 0, bulgeAt = 0.35, radial = 14) {
  const pts: THREE.Vector2[] = [];
  const cap0 = r0 * 0.9;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * r0, Math.cos(a) * cap0 * 0.6));
  }
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const r = THREE.MathUtils.lerp(r0, r1, t) + bulge * Math.exp(-((t - bulgeAt) ** 2) / 0.03);
    pts.push(new THREE.Vector2(r, -len * t));
  }
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r1, -len - Math.sin(a) * r1 * 0.6));
  }
  pts[pts.length - 1].x = 0.0001;
  pts[0].x = 0.0001;
  return new THREE.LatheGeometry(pts, radial);
}

function ellipsoid(rx: number, ry: number, rz: number, x = 0, y = 0, z = 0, w = 16, h = 12) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}

function tint(g: THREE.BufferGeometry, c: THREE.Color | ((p: THREE.Vector3) => THREE.Color)) {
  const pos = g.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos as THREE.BufferAttribute, i);
    const col = typeof c === 'function' ? c(p) : c;
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function merge(list: THREE.BufferGeometry[]) {
  const norm = list.map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    if (!x.getAttribute('uv')) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.getAttribute('position').count * 2), 2));
    if (!x.getAttribute('color')) tint(x, new THREE.Color(1, 1, 1));
    for (const name of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) x.deleteAttribute(name);
    return x;
  });
  return mergeGeometries(norm)!;
}

// ------------------------------------------------------------------------------------------ clips
const IDLE = pose({
  hips: [0, 0, 0.03],
  spine: [0.0, 0, 0],
  chest: [0.02, 0, 0],
  neck: [0, 0, 0],
  head: [-0.04, 0.08, 0],
  uaL: [-0.42, 0, 0.2], faL: [-1.2, 0, 0], hdL: [0.15, 0, 0],
  uaR: [0.04, 0, -0.1], faR: [-0.25, 0, 0], hdR: [0.0, 0, 0],
  thL: [-0.06, 0, 0.03], shinL: [0.08, 0, 0], ftL: [-0.02, 0, 0],
  thR: [0.09, 0, -0.04], shinR: [0.05, 0, 0], ftR: [-0.12, 0, 0],
});

const SPIN = pose({
  spine: [0, -0.12, 0], chest: [0.02, -0.3, 0], head: [0, 0.32, 0], neck: [0, 0.05, 0],
  uaR: [-2.75, 0, -0.35], faR: [-0.35, 0, 0], hdR: [0, 0, 0],
  uaL: [-1.25, 0, 0.3], faL: [-0.25, 0, 0], hdL: [0.1, 0, 0],
  thL: [-0.2, 0, 0.08], shinL: [0.15, 0, 0], ftL: [0.05, 0, 0],
  thR: [0.25, 0, -0.08], shinR: [0.1, 0, 0], ftR: [-0.3, 0, 0],
});

const THROW = new Clip([
  { t: 0, p: SPIN },
  { t: 0.1, p: pose({ spine: [0, -0.2, 0], chest: [-0.05, -0.55, 0], head: [0, 0.45, 0], uaR: [-2.3, 0.3, -1.1], faR: [-0.6, 0, 0], uaL: [-1.4, 0, 0.3], faL: [-0.2, 0, 0], thL: [-0.25, 0, 0.08], thR: [0.3, 0, -0.08], shinL: [0.2, 0, 0], shinR: [0.1, 0, 0] }) },
  { t: 0.22, p: pose({ spine: [0.12, 0.2, 0], chest: [0.15, 0.45, 0], head: [0.05, -0.3, 0], uaR: [-1.2, 0, -0.25], faR: [-0.1, 0, 0], uaL: [-0.4, 0, 0.4], faL: [-0.4, 0, 0], thL: [-0.35, 0, 0.08], thR: [0.3, 0, -0.08], shinL: [0.25, 0, 0], shinR: [0.2, 0, 0] }, -0.04) },
  { t: 0.55, p: pose({ spine: [0.05, 0.1, 0], chest: [0.1, 0.25, 0], head: [0, -0.2, 0], uaR: [-0.5, 0, -0.15], faR: [-0.3, 0, 0], uaL: [-0.35, 0, 0.2], faL: [-0.9, 0, 0], thL: [-0.2, 0, 0.05], thR: [0.2, 0, -0.05], shinL: [0.15, 0, 0], shinR: [0.1, 0, 0] }) },
]);

const STRIKE = new Clip([
  { t: 0, p: pose({ uaR: [-0.7, 0, -0.2], faR: [-1.0, 0, 0], hdR: [0.6, 0, 0], uaL: [-0.6, 0, 0.2], faL: [-1.1, 0, 0], chest: [0.05, 0, 0], spine: [0, 0, 0], thL: [-0.25, 0, 0.05], shinL: [0.2, 0, 0], thR: [0.2, 0, -0.05], shinR: [0.1, 0, 0] }) },
  { t: 0.14, p: pose({ uaR: [-2.9, 0, -0.15], faR: [-0.5, 0, 0], hdR: [-0.3, 0, 0], uaL: [-2.8, 0, 0.1], faL: [-0.6, 0, 0], chest: [-0.2, -0.2, 0], spine: [-0.1, 0, 0], head: [-0.15, 0, 0], thL: [-0.3, 0, 0.05], shinL: [0.25, 0, 0], thR: [0.3, 0, -0.05], shinR: [0.15, 0, 0] }) },
  { t: 0.26, p: pose({ uaR: [-1.35, 0, -0.05], faR: [-0.15, 0, 0], hdR: [1.3, 0, 0], uaL: [-1.3, 0, 0.05], faL: [-0.2, 0, 0], chest: [0.35, 0.1, 0], spine: [0.2, 0, 0], head: [-0.2, 0, 0], thL: [-0.5, 0, 0.05], shinL: [0.45, 0, 0], thR: [0.4, 0, -0.05], shinR: [0.2, 0, 0], ftR: [-0.3, 0, 0] }, -0.07) },
  { t: 0.6, p: pose({ uaR: [-0.7, 0, -0.2], faR: [-1.0, 0, 0], hdR: [0.6, 0, 0], uaL: [-0.6, 0, 0.2], faL: [-1.1, 0, 0], chest: [0.05, 0, 0], spine: [0, 0, 0], head: [0, 0, 0], thL: [-0.25, 0, 0.05], shinL: [0.2, 0, 0], thR: [0.2, 0, -0.05], shinR: [0.1, 0, 0] }) },
]);

const STRIKE_HIGH = new Clip([
  { t: 0, p: pose({ uaR: [-1.6, 0, -0.5], faR: [-1.0, 0, 0], hdR: [0.4, 0, 0], chest: [0, 0, 0] }) },
  { t: 0.16, p: pose({ uaR: [-2.95, 0, -0.55], faR: [-1.1, 0, 0], hdR: [-0.3, 0, 0], chest: [-0.2, -0.3, 0], spine: [-0.05, -0.1, 0] }) },
  { t: 0.27, p: pose({ uaR: [-2.0, 0, -0.2], faR: [-0.1, 0, 0], hdR: [1.6, 0, 0], chest: [0.25, 0.25, 0], spine: [0.1, 0.1, 0] }) },
  { t: 0.55, p: pose({ uaR: [-1.6, 0, -0.5], faR: [-1.0, 0, 0], hdR: [0.4, 0, 0], chest: [0, 0, 0], spine: [0, 0, 0] }) },
]);

const GRAB_BEARD = pose({
  uaL: [-2.25, 0, 0.05], faL: [-0.25, 0, 0], hdL: [0, 0, 0],
  chest: [0.05, 0, 0], head: [-0.3, 0, 0], neck: [-0.1, 0, 0],
  thL: [-0.35, 0, 0.05], shinL: [0.35, 0, 0], thR: [0.35, 0, -0.05], shinR: [0.25, 0, 0], ftR: [-0.35, 0, 0],
}, -0.05);

const PULL = new Clip([
  { t: 0, p: pose({ spine: [0.45, 0, 0], chest: [0.2, 0, 0], head: [-0.1, 0, 0], uaL: [-1.0, 0, 0.15], faL: [-0.35, 0, 0], uaR: [-1.0, 0, -0.15], faR: [-0.35, 0, 0], thL: [-0.7, 0, 0.05], shinL: [1.1, 0, 0], ftL: [-0.4, 0, 0], thR: [0.1, 0, -0.05], shinR: [0.9, 0, 0], ftR: [-0.2, 0, 0] }, -0.22) },
  { t: 0.3, p: pose({ spine: [0.25, 0, 0], chest: [0.05, 0, 0], head: [-0.2, 0, 0], uaL: [-0.8, 0, 0.1], faL: [-0.9, 0, 0], uaR: [-0.8, 0, -0.1], faR: [-0.9, 0, 0], thL: [-0.6, 0, 0.05], shinL: [0.8, 0, 0], ftL: [-0.2, 0, 0], thR: [0.25, 0, -0.05], shinR: [0.7, 0, 0], ftR: [-0.3, 0, 0] }, -0.18, -0.05) },
  { t: 0.6, p: pose({ spine: [0.45, 0, 0], chest: [0.2, 0, 0], head: [-0.1, 0, 0], uaL: [-1.0, 0, 0.15], faL: [-0.35, 0, 0], uaR: [-1.0, 0, -0.15], faR: [-0.35, 0, 0], thL: [-0.7, 0, 0.05], shinL: [1.1, 0, 0], ftL: [-0.4, 0, 0], thR: [0.1, 0, -0.05], shinR: [0.9, 0, 0], ftR: [-0.2, 0, 0] }, -0.22) },
], true);

const CARRY = pose({ uaL: [-0.75, 0, 0.8], faL: [-2.0, 0, 0], hdL: [0.2, 0, 0], uaR: [-0.75, 0, -0.8], faR: [-2.0, 0, 0], hdR: [0.2, 0, 0], chest: [0.1, 0, 0], head: [0.05, 0, 0] });

const NEUTRAL = pose({});
const PICK = new Clip([
  { t: 0, p: NEUTRAL },
  { t: 0.35, p: pose({ spine: [0.7, 0, 0], chest: [0.3, 0, 0], head: [0.2, 0, 0], uaR: [-1.0, 0, -0.1], faR: [-0.2, 0, 0], thL: [-1.0, 0, 0.05], shinL: [1.5, 0, 0], ftL: [-0.5, 0, 0], thR: [-0.4, 0, -0.05], shinR: [1.3, 0, 0], ftR: [-0.9, 0, 0] }, -0.38) },
  { t: 0.6, p: pose({ spine: [0.7, 0, 0], chest: [0.3, 0, 0], head: [0.2, 0, 0], uaR: [-1.1, 0, -0.1], faR: [-0.5, 0, 0], thL: [-1.0, 0, 0.05], shinL: [1.5, 0, 0], ftL: [-0.5, 0, 0], thR: [-0.4, 0, -0.05], shinR: [1.3, 0, 0], ftR: [-0.9, 0, 0] }, -0.38) },
  { t: 0.95, p: NEUTRAL },
]);

const CALL = new Clip([
  { t: 0, p: NEUTRAL },
  { t: 0.25, p: pose({ uaR: [-1.35, 0, -0.55], faR: [-2.35, 0, 0], hdR: [0.3, 0, 0], head: [-0.25, 0, 0], chest: [-0.1, 0, 0] }) },
  { t: 1.15, p: pose({ uaR: [-1.35, 0, -0.55], faR: [-2.35, 0, 0], hdR: [0.3, 0, 0], head: [-0.3, 0, 0], chest: [-0.12, 0, 0] }) },
  { t: 1.45, p: NEUTRAL },
]);

const DODGE = new Clip([
  { t: 0, p: NEUTRAL },
  { t: 0.12, p: pose({ spine: [0.4, 0, 0], chest: [0.2, 0, 0], thL: [-0.9, 0, 0.1], shinL: [1.3, 0, 0], thR: [-0.4, 0, -0.1], shinR: [1.2, 0, 0], uaL: [-0.8, 0, 0.5], uaR: [-0.8, 0, -0.5], faL: [-1.2, 0, 0], faR: [-1.2, 0, 0] }, -0.28) },
  { t: 0.38, p: pose({ spine: [0.3, 0, 0], chest: [0.15, 0, 0], thL: [-0.6, 0, 0.1], shinL: [0.9, 0, 0], thR: [-0.2, 0, -0.1], shinR: [0.8, 0, 0], uaL: [-0.7, 0, 0.4], uaR: [-0.7, 0, -0.4], faL: [-1.1, 0, 0], faR: [-1.1, 0, 0] }, -0.18) },
  { t: 0.55, p: NEUTRAL },
]);

const HURT = new Clip([
  { t: 0, p: NEUTRAL },
  { t: 0.08, p: pose({ chest: [-0.35, 0.2, 0], spine: [-0.15, 0, 0], head: [-0.3, 0, 0], uaL: [-0.5, 0, 0.6], uaR: [-0.5, 0, -0.6], faL: [-0.8, 0, 0], faR: [-0.8, 0, 0] }, -0.05) },
  { t: 0.45, p: NEUTRAL },
]);

const KNEEL = pose({ thL: [-1.45, 0, 0.1], shinL: [1.6, 0, 0], ftL: [-0.1, 0, 0], thR: [0.35, 0, -0.1], shinR: [2.3, 0, 0], ftR: [0.7, 0, 0], spine: [0.35, 0, 0], chest: [0.1, 0, 0], head: [0.3, 0, 0], uaL: [-0.6, 0, 0.2], faL: [-0.6, 0, 0], uaR: [-0.3, 0, -0.2], faR: [-0.4, 0, 0] }, -0.46);

const THANKS = pose({ uaL: [-0.55, 0, 0.65], faL: [-0.9, 0.0, 0], hdL: [-0.2, 0, 0], uaR: [-0.55, 0, -0.65], faR: [-0.9, 0, 0], hdR: [-0.2, 0, 0], head: [-0.42, 0, 0], neck: [-0.12, 0, 0], chest: [-0.1, 0, 0] });

export type HoldPose = 'none' | 'spin' | 'grab' | 'carry' | 'kneel' | 'thanks' | 'pull';
export type StaffMode = 'plant' | 'strike' | 'back';
type ActionName = 'throw' | 'strike' | 'strikeHigh' | 'pick' | 'call' | 'dodge' | 'hurt';

interface ActiveAction { clip: Clip; t: number; mask?: readonly string[]; events: { t: number; fn: () => void; fired: boolean }[] }

const ACTIONS: Record<ActionName, { clip: Clip; mask?: readonly string[] }> = {
  throw: { clip: THROW },
  strike: { clip: STRIKE },
  strikeHigh: { clip: STRIKE_HIGH, mask: [...UPPER_R, 'chest', 'spine'] },
  pick: { clip: PICK },
  call: { clip: CALL, mask: [...UPPER_R, 'head', 'chest'] },
  dodge: { clip: DODGE },
  hurt: { clip: HURT, mask: [...UPPER_L, ...UPPER_R, ...TORSO, 'hips'] },
};

// ------------------------------------------------------------------------------------------ model
export class DavidModel {
  readonly root = new THREE.Group();
  readonly j: Record<string, THREE.Object3D> = {};
  readonly mixer: PoseMixer;
  readonly staff = new THREE.Group();
  readonly shoulderSocket = new THREE.Object3D(); // for carrying the lamb across the shoulders
  readonly handSocketR = new THREE.Object3D();
  readonly handSocketL = new THREE.Object3D();
  private skirtUniforms = { uLegL: { value: 0 }, uLegR: { value: 0 }, uSway: { value: new THREE.Vector2() } };
  private hairGroup = new THREE.Group();

  // animation state
  speed = 0; // m/s (for locomotion)
  private phase = 0;
  private locoW = 0;
  private runW = 0;
  private time = 0;
  hold: HoldPose = 'none';
  private holdW: Record<HoldPose, number> = { none: 0, spin: 0, grab: 0, carry: 0, kneel: 0, thanks: 0, pull: 0 };
  private action: ActiveAction | null = null;
  private actionW = 0;
  private pullT = 0;
  spinPhase = 0;
  spinPower = 0;
  staffMode: StaffMode = 'plant';
  private staffBlend = 0; // 0 plant, 1 strike
  private staffBack = 0;
  lookTarget: THREE.Vector3 | null = null;
  private lookYaw = 0;
  private lookPitch = 0;
  onFootstep?: (side: 'L' | 'R', run: boolean) => void;
  private lastStepSign = 0;
  ground?: (x: number, z: number) => number;

  // sling
  readonly sling = { state: 'idle' as 'idle' | 'spin' | 'release' | 'stowed', pouch: new THREE.Vector3(), prev: new THREE.Vector3(), releaseT: 0, loaded: true };
  private cordA!: Rope;
  private cordB!: Rope;
  private pouchMesh!: THREE.Mesh;
  private stoneMesh!: THREE.Mesh;
  private slingInit = false;

  constructor(private tex: TextureSet) {
    this.build();
    this.mixer = new PoseMixer(this.j);
  }

  // ----------------------------------------------------------------------------------- building
  private build() {
    const tex = this.tex;
    const skin = new THREE.MeshPhysicalMaterial({
      color: 0xa27a60, roughness: 0.5, metalness: 0, sheen: 0.2, sheenColor: new THREE.Color(0xffb090), sheenRoughness: 0.55, vertexColors: true,
    });
    // subtle subsurface-like warmth where light wraps around
    skin.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.10, 0.025, 0.01);`,
      );
    };
    skin.customProgramCacheKey = () => 'skin';
    const linenMap = tex.linen.clone();
    linenMap.repeat.set(7, 5);
    linenMap.needsUpdate = true;
    const linenN = tex.linenN.clone();
    linenN.repeat.set(7, 5);
    linenN.needsUpdate = true;
    const tunicMat = new THREE.MeshStandardMaterial({ map: linenMap, normalMap: linenN, color: 0xf1e7d2, roughness: 0.97, side: THREE.DoubleSide });
    tunicMat.normalScale.set(0.9, 0.9);
    const leather = new THREE.MeshStandardMaterial({ map: tex.leather, normalMap: tex.leatherN, color: 0xc49a78, roughness: 0.72 });
    const darkLeather = new THREE.MeshStandardMaterial({ map: tex.leather, normalMap: tex.leatherN, color: 0x8a6a52, roughness: 0.75 });
    const hairMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.62, sheen: 1.0, sheenColor: new THREE.Color(0xb86a3a), sheenRoughness: 0.4 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xe9e2d6, roughness: 0.18 });
    const irisMat = new THREE.MeshPhysicalMaterial({ color: 0x4a2e17, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050302, roughness: 0.05 });
    const woodMat = new THREE.MeshStandardMaterial({ normalMap: tex.barkN, color: 0x7a5534, roughness: 0.62 });
    woodMat.normalScale.set(0.6, 0.6);

    const J = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const o = new THREE.Group();
      o.name = name;
      o.position.set(x, y, z);
      parent.add(o);
      this.j[name] = o;
      return o;
    };
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    const hips = J('hips', this.root, 0, 0.97, 0);
    const spine = J('spine', hips, 0, 0.08, 0);
    const chest = J('chest', spine, 0, 0.2, 0);
    const neck = J('neck', chest, 0, 0.23, 0.0);
    const head = J('head', neck, 0, 0.075, 0.01);
    const uaL = J('uaL', chest, 0.178, 0.17, -0.01);
    const faL = J('faL', uaL, 0, -0.29, 0);
    const hdL = J('hdL', faL, 0, -0.255, 0);
    const uaR = J('uaR', chest, -0.178, 0.17, -0.01);
    const faR = J('faR', uaR, 0, -0.29, 0);
    const hdR = J('hdR', faR, 0, -0.255, 0);
    const thL = J('thL', hips, 0.092, -0.04, 0);
    const shinL = J('shinL', thL, 0, -0.44, 0);
    const ftL = J('ftL', shinL, 0, -0.42, 0);
    const thR = J('thR', hips, -0.092, -0.04, 0);
    const shinR = J('shinR', thR, 0, -0.44, 0);
    const ftR = J('ftR', shinR, 0, -0.42, 0);

    // --- legs (skin) + sandals
    for (const [th, sh, ft, side] of [[thL, shinL, ftL, 1], [thR, shinR, ftR, -1]] as const) {
      add(th, tint(limb(0.44, 0.078, 0.056, 0.008, 0.3), new THREE.Color(1, 1, 1)), skin);
      add(sh, tint(limb(0.42, 0.05, 0.034, 0.012, 0.28), new THREE.Color(1, 1, 1)), skin);
      // foot: rounded wedge pointing +Z
      const foot = ellipsoid(0.045, 0.034, 0.12, 0, -0.03, 0.06, 14, 10);
      const fp = foot.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < fp.count; i++) {
        const y = fp.getY(i);
        if (y < -0.045) fp.setY(i, -0.045 + (y + 0.045) * 0.2); // flat sole
        const z = fp.getZ(i);
        if (z > 0.1) fp.setX(i, fp.getX(i) * 1.12); // wider toes
      }
      foot.computeVertexNormals();
      add(ft, tint(foot, new THREE.Color(1, 1, 1)), skin);
      // sandal sole
      const sole = new THREE.BoxGeometry(0.1, 0.018, 0.27);
      sole.translate(0, -0.058, 0.055);
      add(ft, sole, darkLeather);
      // straps wrapping foot + climbing the shin (as in the reference)
      for (let k = 0; k < 3; k++) {
        const s = new THREE.TorusGeometry(0.047 + k * 0.002, 0.006, 5, 18);
        s.rotateX(Math.PI / 2 + 0.3 - k * 0.15);
        s.translate(0, -0.03 + k * 0.006, 0.03 + k * 0.05);
        s.scale(1, 0.75, 1);
        add(ft, s, leather);
      }
      for (let k = 0; k < 5; k++) {
        const y = -0.4 + k * 0.045;
        const r = 0.036 + k * 0.003;
        const s = new THREE.TorusGeometry(r, 0.0055, 5, 18);
        s.rotateX(Math.PI / 2 + (k % 2 ? 0.35 : -0.35));
        s.translate(0, y, 0.004);
        add(sh, s, leather);
      }
      void side;
    }

    // --- torso (skin under tunic, visible at the V neckline)
    add(chest, tint(ellipsoid(0.145, 0.2, 0.098, 0, 0.06, 0.0), new THREE.Color(1, 1, 1)), skin);
    add(spine, tint(ellipsoid(0.13, 0.14, 0.09, 0, 0.05, 0), new THREE.Color(1, 1, 1)), skin);
    add(neck, tint(limb(0.1, 0.056, 0.058, 0, 0.5, 12).rotateX(Math.PI).translate(0, 0.02, 0), new THREE.Color(1, 1, 1)), skin);

    // --- tunic (upper, rigid with chest): lathe profile with V-neck
    const upperProfile: [number, number][] = [
      [0.074, 0.25], [0.105, 0.232], [0.155, 0.207], [0.185, 0.17], [0.178, 0.1], [0.168, 0.02], [0.158, -0.08], [0.152, -0.16], [0.152, -0.24],
    ];
    const upper = new THREE.LatheGeometry(upperProfile.map(([r, y]) => new THREE.Vector2(r, y)), 36);
    {
      const p = upper.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const ang = Math.atan2(x, z); // 0 = front
        z *= 0.7;
        const shoulder = THREE.MathUtils.smoothstep(y, 0.05, 0.19);
        x *= 1 + 0.12 * shoulder;
        // V-neck: pull the front of the collar down
        const front = Math.max(0, Math.cos(ang));
        const v = Math.pow(front, 8) * THREE.MathUtils.smoothstep(y, 0.14, 0.25);
        y -= v * 0.05;
        z += v * 0.006;
        // folds
        const n = NZ.noise(ang * 2.5, y * 9) * 0.006;
        const len = Math.hypot(x, z);
        x += (x / len) * n;
        z += (z / len) * n;
        p.setXYZ(i, x, y, z);
      }
      upper.computeVertexNormals();
    }
    add(chest, upper, tunicMat);
    // shoulder caps + short sleeves
    for (const [ua, s] of [[uaL, 1], [uaR, -1]] as const) {
      void s;
      const sleeve = new THREE.LatheGeometry([
        new THREE.Vector2(0.03, 0.075), new THREE.Vector2(0.062, 0.05), new THREE.Vector2(0.072, -0.02), new THREE.Vector2(0.075, -0.1), new THREE.Vector2(0.082, -0.19),
      ], 20);
      add(ua, sleeve, tunicMat);
    }

    // --- tunic skirt (rigid to hips, deformed by the legs in the vertex shader)
    const skirtProfile: [number, number][] = [
      [0.152, 0.12], [0.162, 0.03], [0.176, -0.06], [0.197, -0.17], [0.218, -0.3], [0.236, -0.42], [0.25, -0.53], [0.252, -0.55],
    ];
    const skirt = new THREE.LatheGeometry(skirtProfile.map(([r, y]) => new THREE.Vector2(r, y)), 40, 0, Math.PI * 2);
    {
      const p = skirt.getAttribute('position') as THREE.BufferAttribute;
      const uv = skirt.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const ang = Math.atan2(x, z);
        z *= 0.8;
        // vertical folds deepen toward the hem, uneven hem line
        const depth = THREE.MathUtils.smoothstep(-y, 0.0, 0.5);
        const fold = Math.sin(ang * 9 + NZ.noise(ang, 0.3) * 2) * 0.012 * depth + NZ.noise(ang * 3, y * 4) * 0.008;
        const len = Math.hypot(x, z) || 1;
        x += (x / len) * fold;
        z += (z / len) * fold;
        if (y < -0.5) y += NZ.noise(ang * 4, 1.7) * 0.025;
        p.setXYZ(i, x, y, z);
        uv.setY(i, THREE.MathUtils.clamp((y + 0.56) / 0.68, 0, 1));
      }
      skirt.computeVertexNormals();
    }
    const skirtMat = tunicMat.clone();
    skirtMat.map = linenMap;
    skirtMat.normalMap = linenN;
    const su = this.skirtUniforms;
    skirtMat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, su);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uLegL; uniform float uLegR; uniform vec2 uSway; varying float vHem;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
{
  float below = max(0.0, -position.y - 0.02);
  float wl = smoothstep(-0.06, 0.12, position.x);
  float wr = smoothstep(0.06, -0.12, position.x);
  float dzl = -sin(uLegL) * below;
  float dzr = -sin(uLegR) * below;
  transformed.z += (dzl * wl + dzr * wr) * 0.95;
  transformed.y += (abs(dzl) * wl + abs(dzr) * wr) * 0.22;
  transformed.xz += uSway * below * below * 1.6;
  vHem = uv.y;
}`,
        );
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
varying float vHem;`)
        .replace(
          '#include <alphatest_fragment>',
          `if (vHem < 0.045) { float f = fract(vMapUv.x * 9.0 * 16.0); if (f < 0.42 + (0.045 - vHem) * 8.0) discard; }`,
        );
    };
    skirtMat.customProgramCacheKey = () => 'skirt';
    add(hips, skirt, skirtMat);

    // --- belt: wrapped leather thong with a knot and hanging fringed ends
    const belt = new THREE.LatheGeometry([new THREE.Vector2(0.157, 0.1), new THREE.Vector2(0.162, 0.065), new THREE.Vector2(0.161, 0.03), new THREE.Vector2(0.155, 0.0)], 36);
    belt.scale(1, 1, 0.81);
    add(hips, belt, leather);
    for (let k = 0; k < 3; k++) {
      const band = new THREE.TorusGeometry(0.162, 0.006, 5, 36);
      band.rotateX(Math.PI / 2);
      band.scale(1, 1, 0.81);
      band.translate(0, 0.015 + k * 0.035, 0);
      add(hips, band, darkLeather);
    }
    const knot = ellipsoid(0.03, 0.025, 0.02, 0.07, 0.05, 0.135);
    add(hips, knot, darkLeather);
    for (let k = 0; k < 4; k++) {
      const tail = new THREE.BoxGeometry(0.014, 0.28 + k * 0.03, 0.006);
      tail.translate(0, -(0.14 + k * 0.015), 0);
      tail.rotateZ(0.08 * (k - 1.5));
      tail.translate(0.06 + k * 0.012, 0.04, 0.14 - k * 0.004);
      add(hips, tail, leather);
    }

    // --- shepherd's bag on the left hip, strap across the chest from the right shoulder
    const bag = merge([
      ellipsoid(0.075, 0.1, 0.045, 0, 0, 0, 16, 12),
      new THREE.BoxGeometry(0.13, 0.07, 0.02).translate(0, 0.05, 0.035),
    ]);
    const bagMesh = add(hips, bag, leather);
    bagMesh.position.set(0.2, -0.13, 0.03);
    bagMesh.rotation.set(0.05, 0.9, 0.12);
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.19, -0.33, 0.1), new THREE.Vector3(0.12, -0.14, 0.125), new THREE.Vector3(0.0, 0.02, 0.13),
      new THREE.Vector3(-0.11, 0.14, 0.115), new THREE.Vector3(-0.16, 0.22, 0.04), new THREE.Vector3(-0.14, 0.2, -0.07),
      new THREE.Vector3(-0.03, 0.06, -0.12), new THREE.Vector3(0.12, -0.14, -0.115), new THREE.Vector3(0.2, -0.33, -0.06),
    ]);
    const strap = new THREE.TubeGeometry(strapCurve, 48, 0.011, 5, false);
    strap.scale(1, 1, 1);
    add(chest, strap, leather);

    // --- arms + hands
    for (const [ua, fa, hd, s] of [[uaL, faL, hdL, 1], [uaR, faR, hdR, -1]] as const) {
      add(ua, tint(limb(0.29, 0.056, 0.044, 0.01, 0.4), new THREE.Color(1, 1, 1)), skin);
      add(fa, tint(limb(0.255, 0.046, 0.031, 0.009, 0.22), new THREE.Color(1, 1, 1)), skin);
      const hand = merge([
        ellipsoid(0.026, 0.045, 0.036, 0, -0.045, 0.004),
        ellipsoid(0.028, 0.022, 0.036, 0, -0.088, 0.012),
        ellipsoid(0.011, 0.028, 0.012, 0.022 * s, -0.05, 0.03),
      ]);
      add(hd, tint(hand, new THREE.Color(1, 1, 1)), skin);
    }
    this.handSocketL.position.set(0, -0.075, 0.02);
    this.handSocketR.position.set(0, -0.075, 0.02);
    hdL.add(this.handSocketL);
    hdR.add(this.handSocketR);

    // --- head
    this.buildHead(head, skin, hairMat, eyeWhite, irisMat, pupilMat);

    // --- staff (rod): straight, knotted, worn smooth where held. Grip at y = 0.
    const staffGeo = gnarlyTube(
      [new THREE.Vector3(0, -1.06, 0), new THREE.Vector3(0.01, -0.5, 0.005), new THREE.Vector3(-0.005, 0.1, 0), new THREE.Vector3(0.012, 0.74, -0.004)],
      0.022, 0.018, 24, 7, 0.1, 7,
    );
    const staffMesh = new THREE.Mesh(staffGeo, woodMat);
    staffMesh.castShadow = true;
    this.staff.add(staffMesh);
    this.root.add(this.staff);

    // --- sling: two cords + leather pouch + stone
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x9a7a55, roughness: 0.9 });
    this.cordA = new Rope(6, 0.0035, cordMat);
    this.cordB = new Rope(6, 0.0035, cordMat);
    const pouchGeo = new THREE.SphereGeometry(0.045, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
    pouchGeo.scale(1.3, 0.8, 0.8);
    this.pouchMesh = new THREE.Mesh(pouchGeo, new THREE.MeshStandardMaterial({ map: tex.leather, color: 0xa07a58, roughness: 0.8, side: THREE.DoubleSide }));
    this.pouchMesh.castShadow = true;
    this.stoneMesh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.6 }));
    this.stoneMesh.castShadow = true;

    // --- shoulder socket (lamb across the shoulders, body along the character's X axis)
    this.shoulderSocket.position.set(0, 0.25, -0.06);
    this.shoulderSocket.rotation.set(0, Math.PI / 2, 0);
    chest.add(this.shoulderSocket);

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  /** Adds sling meshes to the given world-space container (they are simulated in world space). */
  attachSling(container: THREE.Object3D) {
    container.add(this.cordA.mesh, this.cordB.mesh, this.pouchMesh, this.stoneMesh);
  }

  private buildHead(head: THREE.Object3D, skin: THREE.Material, hairMat: THREE.Material, eyeWhite: THREE.Material, irisMat: THREE.Material, pupilMat: THREE.Material) {
    const HX = 0.074, HY = 0.112, HZ = 0.094;
    const cy = 0.1;
    const skull = new THREE.SphereGeometry(1, 48, 36);
    const p = skull.getAttribute('position') as THREE.BufferAttribute;
    const g = (x: number, y: number, z: number, cx: number, cyy: number, cz: number, s: number) =>
      Math.exp(-((x - cx) ** 2 + (y - cyy) ** 2 + (z - cz) ** 2) / (2 * s * s));
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const ox = x, oy = y, oz = z;
      // jaw taper + chin
      const low = THREE.MathUtils.smoothstep(-y, 0.05, 0.95);
      x *= 1 - 0.24 * low;
      if (z > 0) z *= 1 + 0.06 * THREE.MathUtils.smoothstep(-y, 0.5, 0.9) - 0.1 * low * THREE.MathUtils.smoothstep(Math.abs(ox), 0.2, 0.6);
      // temples slightly flatter, fuller occiput
      x *= 1 - 0.05 * THREE.MathUtils.smoothstep(y, 0.2, 0.7);
      if (z < 0 && y > -0.2) z *= 1.07;
      // face plane: flatten the front a little
      if (z > 0.6) z = 0.6 + (z - 0.6) * 0.75;
      // eye sockets, brow ridge, cheekbones
      let r = 1;
      r -= 0.07 * g(Math.abs(ox), oy, oz, 0.4, 0.12, 0.86, 0.13);
      r += 0.035 * g(Math.abs(ox), oy, oz, 0.35, 0.3, 0.88, 0.18);
      r += 0.03 * g(Math.abs(ox), oy, oz, 0.62, -0.08, 0.72, 0.17);
      // mouth region slightly forward, philtrum
      r += 0.02 * g(ox, oy, oz, 0, -0.52, 0.85, 0.16);
      x *= r; y *= r; z *= r;
      p.setXYZ(i, x * HX, y * HY + cy, z * HZ);
    }
    skull.computeVertexNormals();
    const blush = (pt: THREE.Vector3) => {
      const c = new THREE.Color(1, 1, 1);
      const cheek = Math.max(
        Math.exp(-((pt.x - 0.045) ** 2 + (pt.y - cy + 0.022) ** 2 + (pt.z - 0.07) ** 2) / (2 * 0.02 * 0.02)),
        Math.exp(-((pt.x + 0.045) ** 2 + (pt.y - cy + 0.022) ** 2 + (pt.z - 0.07) ** 2) / (2 * 0.02 * 0.02)),
      );
      const nose = Math.exp(-((pt.x) ** 2 + (pt.y - cy + 0.03) ** 2 + (pt.z - 0.1) ** 2) / (2 * 0.015 * 0.015));
      const k = Math.max(cheek * 0.8, nose * 0.5);
      c.setRGB(1, 1 - 0.14 * k, 1 - 0.16 * k);
      return c;
    };
    const parts: THREE.BufferGeometry[] = [tint(skull, blush)];
    // nose: bridge + tip + alae
    const bridge = ellipsoid(0.0075, 0.026, 0.011, 0, 0, 0, 12, 10);
    bridge.rotateX(-0.32);
    bridge.translate(0, cy - 0.016, 0.089);
    parts.push(tint(bridge, blush));
    parts.push(tint(ellipsoid(0.0095, 0.0085, 0.0095, 0, cy - 0.038, 0.1, 12, 10), blush));
    parts.push(tint(ellipsoid(0.0068, 0.0058, 0.0068, 0.0095, cy - 0.041, 0.094, 10, 8), blush));
    parts.push(tint(ellipsoid(0.0068, 0.0058, 0.0068, -0.0095, cy - 0.041, 0.094, 10, 8), blush));
    // lips
    const lipC = new THREE.Color(0.8, 0.58, 0.54);
    parts.push(tint(ellipsoid(0.0165, 0.0038, 0.0065, 0, cy - 0.061, 0.0905, 14, 8), lipC));
    parts.push(tint(ellipsoid(0.0145, 0.0045, 0.0068, 0, cy - 0.0685, 0.0895, 14, 8), lipC));
    // ears
    for (const s of [1, -1]) {
      const ear = ellipsoid(0.011, 0.028, 0.02, 0, 0, 0, 12, 10);
      ear.rotateY(-0.35 * s);
      ear.translate(0.073 * s, cy - 0.005, -0.005);
      parts.push(tint(ear, new THREE.Color(1, 0.93, 0.9)));
    }
    head.scale.setScalar(1.07);
    const headMesh = new THREE.Mesh(merge(parts), skin);
    headMesh.castShadow = true;
    head.add(headMesh);

    // eyes — "יְפֵה עֵינַיִם"
    for (const s of [1, -1]) {
      const ex = 0.0295 * s, ey = cy + 0.014, ez = 0.07;
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.0118, 16, 12), eyeWhite);
      white.position.set(ex, ey, ez);
      head.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 14, 10), irisMat);
      iris.scale.set(1, 1, 0.45);
      iris.position.set(ex, ey - 0.0005, ez + 0.0098);
      head.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 10, 8), pupilMat);
      pupil.scale.set(1, 1, 0.4);
      pupil.position.set(ex, ey - 0.0005, ez + 0.0124);
      head.add(pupil);
      // upper lid
      const lid = new THREE.Mesh(tint(new THREE.SphereGeometry(0.0128, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), new THREE.Color(0.92, 0.8, 0.76)), skin);
      lid.position.set(ex, ey, ez);
      lid.rotation.x = 0.28;
      const lower = new THREE.Mesh(tint(new THREE.SphereGeometry(0.0126, 16, 6, 0, Math.PI * 2, Math.PI * 0.78, Math.PI * 0.22), new THREE.Color(0.95, 0.85, 0.8)), skin);
      lower.position.set(ex, ey, ez);
      lower.rotation.x = -0.2;
      head.add(lower);
      head.add(lid);
      // brow
      const browGeo = ellipsoid(0.017, 0.0036, 0.006, 0, 0, 0, 12, 6);
      const brow = new THREE.Mesh(tint(browGeo, new THREE.Color(0.1, 0.035, 0.012)), hairMat);
      brow.position.set(ex + 0.003 * s, ey + 0.0175, ez + 0.0125);
      brow.rotation.set(0.25, 0.22 * s, -0.1 * s);
      head.add(brow);
    }

    // hair — thick auburn curls (אַדְמוֹנִי)
    const rnd = mulberry32(77);
    const curls: THREE.BufferGeometry[] = [];
    const cap = new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62);
    {
      const cp = cap.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < cp.count; i++) {
        let x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
        // hairline: pull the cap back from the face
        if (z > 0.3 && y < 0.7) {
          const k = THREE.MathUtils.smoothstep(z, 0.3, 0.75) * THREE.MathUtils.smoothstep(0.7 - y, 0.0, 0.22);
          z -= k * 0.35;
          y += k * 0.12;
        }
        cp.setXYZ(i, x * HX * 1.06, y * HY * 1.04 + cy + 0.004, z * HZ * 1.05);
      }
      cap.computeVertexNormals();
    }
    curls.push(tint(cap, new THREE.Color(0.06, 0.018, 0.006)));
    const dir = new THREE.Vector3();
    for (let i = 0; i < 420; i++) {
      dir.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) { i--; continue; }
      dir.normalize();
      if (dir.y < -0.25 && dir.z > -0.2) continue; // no curls on the jaw/cheeks
      if (dir.y < -0.62) continue;
      if (dir.z > 0.3 && dir.y < 0.6) continue; // keep the face clear
      if (dir.z > 0.5 && dir.y < 0.74) continue;
      const size = 0.011 + rnd() * 0.011;
      const curl = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv'));
      const cpos = curl.getAttribute('position') as THREE.BufferAttribute;
      const seed = rnd() * 100;
      for (let k = 0; k < cpos.count; k++) {
        const vx = cpos.getX(k), vy = cpos.getY(k), vz = cpos.getZ(k);
        const n = 1 + NZ.noise(vx * 2 + seed, vy * 2 + vz) * 0.35;
        cpos.setXYZ(k, vx * n, vy * n * 0.8, vz * n);
      }
      curl.computeVertexNormals();
      curl.scale(size, size * (1 + rnd() * 0.5), size);
      curl.rotateX(rnd() * 6);
      curl.rotateY(rnd() * 6);
      const lift = 1.02 + rnd() * 0.12 + (dir.y > 0.5 ? 0.06 : 0);
      curl.translate(dir.x * HX * lift * 1.08, dir.y * HY * lift + cy + 0.008, dir.z * HZ * lift * 1.05);
      const light = rnd();
      curls.push(tint(curl, new THREE.Color().setRGB(0.085 + light * 0.08, 0.026 + light * 0.024, 0.009 + light * 0.007)));
    }
    // a few locks falling over the forehead and nape
    for (let i = 0; i < 22; i++) {
      const a = (rnd() - 0.5) * 1.8;
      const front = i < 9;
      const size = 0.014 + rnd() * 0.009;
      const curl = mergeVertices(new THREE.IcosahedronGeometry(size, 2).deleteAttribute('normal').deleteAttribute('uv'));
      curl.computeVertexNormals();
      curl.scale(1, 1.3, 1);
      if (front) curl.translate(Math.sin(a) * 0.05, cy + 0.083 + rnd() * 0.01, 0.066 + Math.cos(a) * 0.01);
      else curl.translate(Math.sin(a * 1.6) * 0.06, cy - 0.06 - rnd() * 0.04, -0.075 - rnd() * 0.012);
      const light = rnd();
      curls.push(tint(curl, new THREE.Color().setRGB(0.09 + light * 0.07, 0.028 + light * 0.02, 0.009)));
    }
    const hair = new THREE.Mesh(merge(curls), hairMat);
    hair.castShadow = true;
    this.hairGroup.add(hair);
    head.add(this.hairGroup);
  }

  // ----------------------------------------------------------------------------------- control
  play(name: ActionName, events: { t: number; fn: () => void }[] = []) {
    const a = ACTIONS[name];
    this.action = { clip: a.clip, t: 0, mask: a.mask, events: events.map((e) => ({ ...e, fired: false })) };
  }
  get busy() {
    return !!this.action;
  }
  get actionName() {
    if (!this.action) return null;
    for (const [k, v] of Object.entries(ACTIONS)) if (v.clip === this.action.clip) return k as ActionName;
    return null;
  }

  worldOf(o: THREE.Object3D, out = new THREE.Vector3()) {
    return o.getWorldPosition(out);
  }

  // ----------------------------------------------------------------------------------- update
  update(dt: number) {
    this.time += dt;
    const m = this.mixer;
    m.reset();

    // ---------- locomotion
    const v = this.speed;
    this.locoW = damp(this.locoW, clamp(v / 1.2, 0, 1), 8, dt);
    this.runW = damp(this.runW, clamp((v - 2.2) / 2.5, 0, 1), 6, dt);
    const cycleLen = THREE.MathUtils.lerp(1.45, 2.7, this.runW);
    this.phase += (Math.PI * 2 * v * dt) / cycleLen;
    const ph = this.phase;
    const s = Math.sin(ph), c = Math.cos(ph);
    const A = THREE.MathUtils.lerp(0.42, 0.85, this.runW) * this.locoW;

    // idle base
    m.layer(IDLE, 1);
    const breathe = Math.sin(this.time * 1.4);
    m.add('chest', breathe * 0.015);
    m.add('spine', 0, 0, Math.sin(this.time * 0.45) * 0.012);
    m.add('head', Math.sin(this.time * 0.37) * 0.03, Math.sin(this.time * 0.23) * 0.12 * (1 - this.locoW), 0);

    if (this.locoW > 0.001) {
      const W = this.locoW;
      const kneeL = Math.max(0, c) * THREE.MathUtils.lerp(0.95, 1.6, this.runW) + 0.12;
      const kneeR = Math.max(0, -c) * THREE.MathUtils.lerp(0.95, 1.6, this.runW) + 0.12;
      const walk = pose({
        thL: [-s * A, 0, 0.02], shinL: [kneeL, 0, 0], ftL: [-(-s * A + kneeL) * 0.55 + Math.max(0, -s) * 0.25 * W, 0, 0],
        thR: [s * A, 0, -0.02], shinR: [kneeR, 0, 0], ftR: [-(s * A + kneeR) * 0.55 + Math.max(0, s) * 0.25 * W, 0, 0],
        uaR: [s * THREE.MathUtils.lerp(0.35, 0.9, this.runW), 0, -0.1], faR: [THREE.MathUtils.lerp(-0.3, -1.4, this.runW), 0, 0],
        uaL: [-0.42 - s * THREE.MathUtils.lerp(0.12, 0.6, this.runW), 0, 0.2], faL: [THREE.MathUtils.lerp(-1.2, -1.5, this.runW), 0, 0],
        hips: [0, s * 0.1 * W, 0],
        spine: [THREE.MathUtils.lerp(0.03, 0.18, this.runW), -s * 0.06, 0],
        chest: [THREE.MathUtils.lerp(0.02, 0.1, this.runW), -s * 0.1, 0],
        head: [THREE.MathUtils.lerp(-0.02, -0.08, this.runW), s * 0.05, 0],
        neck: [0, 0, 0],
        hdL: [0.15, 0, 0], hdR: [0, 0, 0],
      }, -Math.abs(c) * THREE.MathUtils.lerp(0.025, 0.06, this.runW) - this.runW * 0.04);
      m.layer(walk, W);
      // footsteps on contact
      const sign = Math.sign(s);
      if (sign !== this.lastStepSign && W > 0.5) {
        this.onFootstep?.(sign > 0 ? 'L' : 'R', this.runW > 0.5);
      }
      this.lastStepSign = sign;
    }

    // ---------- holds
    for (const k of Object.keys(this.holdW) as HoldPose[]) {
      this.holdW[k] = damp(this.holdW[k], this.hold === k ? 1 : 0, k === 'spin' ? 12 : 6, dt);
    }
    if (this.holdW.spin > 0.001) {
      const a = this.spinPhase;
      const sp = pose({ ...SPIN.r });
      sp.r.uaR = [SPIN.r.uaR[0] + Math.sin(a) * 0.14, 0, SPIN.r.uaR[2] + Math.cos(a) * 0.14];
      sp.r.faR = [SPIN.r.faR[0] + Math.sin(a + 0.8) * 0.12, 0, 0];
      const mask = this.locoW > 0.3 ? [...UPPER_R, ...UPPER_L, ...TORSO] : undefined;
      m.layer(sp, this.holdW.spin, mask);
    }
    if (this.holdW.grab > 0.001) m.layer(GRAB_BEARD, this.holdW.grab);
    if (this.holdW.carry > 0.001) m.layer(CARRY, this.holdW.carry, [...UPPER_L, ...UPPER_R, 'chest', 'head']);
    if (this.holdW.kneel > 0.001) m.layer(KNEEL, this.holdW.kneel);
    if (this.holdW.thanks > 0.001) m.layer(THANKS, this.holdW.thanks, [...UPPER_L, ...UPPER_R, ...TORSO]);
    if (this.holdW.pull > 0.001) {
      this.pullT += dt;
      m.layer(PULL.sample(this.pullT, { r: {} }), this.holdW.pull);
    }

    // ---------- one-shot action
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const dur = a.clip.duration;
      const fadeIn = Math.min(1, a.t / 0.06);
      const fadeOut = Math.min(1, (dur - a.t) / 0.12);
      this.actionW = Math.max(0, Math.min(fadeIn, fadeOut));
      const p = a.clip.sample(a.t, { r: {} });
      m.layer(p, this.actionW, a.mask);
      for (const e of a.events) if (!e.fired && a.t >= e.t) { e.fired = true; e.fn(); }
      if (a.t >= dur) this.action = null;
    }

    // ---------- head look-at
    if (this.lookTarget) {
      const headW = this.j.neck.getWorldPosition(tmpA);
      const local = this.root.worldToLocal(tmpB.copy(this.lookTarget));
      const hl = this.root.worldToLocal(tmpC.copy(headW));
      const d = local.sub(hl);
      const yaw = clamp(Math.atan2(d.x, d.z), -1.0, 1.0);
      const pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.6, 0.5);
      this.lookYaw = damp(this.lookYaw, yaw, 5, dt);
      this.lookPitch = damp(this.lookPitch, pitch, 5, dt);
    } else {
      this.lookYaw = damp(this.lookYaw, 0, 3, dt);
      this.lookPitch = damp(this.lookPitch, 0, 3, dt);
    }
    m.add('head', this.lookPitch * 0.6, this.lookYaw * 0.6, 0);
    m.add('neck', this.lookPitch * 0.3, this.lookYaw * 0.35, 0);

    m.apply();
    this.j.hips.position.y = 0.97 + (m.cur.hipsY ?? 0);
    this.j.hips.position.z = m.cur.hipsZ ?? 0;

    // ---------- foot IK on uneven ground
    this.root.updateMatrixWorld(true);
    if (this.ground && this.holdW.kneel < 0.5) this.footIK();

    // ---------- skirt follows the thighs
    this.skirtUniforms.uLegL.value = this.j.thL.rotation.x;
    this.skirtUniforms.uLegR.value = this.j.thR.rotation.x;
    const sway = this.skirtUniforms.uSway.value;
    sway.x = damp(sway.x, Math.sin(this.phase) * 0.03 * this.locoW, 6, dt);
    sway.y = damp(sway.y, -0.05 * this.runW - 0.02 * this.locoW, 4, dt);

    this.updateStaff(dt);
    this.root.updateMatrixWorld(true);
  }

  private footIK() {
    const a = 0.44, b = 0.42;
    const rootY = this.root.position.y;
    const res: { th: THREE.Object3D; sh: THREE.Object3D; ft: THREE.Object3D; delta: number }[] = [];
    for (const side of ['L', 'R']) {
      const ft = this.j['ft' + side];
      const w = ft.getWorldPosition(tmpA);
      const g = this.ground!(w.x, w.z);
      res.push({ th: this.j['th' + side], sh: this.j['shin' + side], ft, delta: g - rootY });
    }
    const drop = Math.min(0, res[0].delta, res[1].delta);
    const dropC = Math.max(drop, -0.35);
    this.j.hips.position.y += dropC;
    for (const r of res) {
      const raise = clamp(r.delta - dropC, 0, 0.4);
      if (raise < 0.002) continue;
      const tt = r.th.rotation.x, tk = r.sh.rotation.x;
      const y0 = -a * Math.cos(tt) - b * Math.cos(tt + tk);
      const z0 = -a * Math.sin(tt) - b * Math.sin(tt + tk);
      const y1 = y0 + raise, z1 = z0;
      const d1 = clamp(Math.hypot(y1, z1), 0.3, a + b - 0.001);
      const knee = Math.PI - Math.acos(clamp((a * a + b * b - d1 * d1) / (2 * a * b), -1, 1));
      const phi = Math.atan2(-z1, -y1);
      const alpha = Math.acos(clamp((a * a + d1 * d1 - b * b) / (2 * a * d1), -1, 1));
      const nt = phi - alpha;
      r.ft.rotation.x += tt + tk - (nt + knee);
      r.th.rotation.x = nt;
      r.sh.rotation.x = knee;
    }
  }

  private updateStaff(dt: number) {
    const target = this.staffMode === 'strike' ? 1 : 0;
    this.staffBlend = damp(this.staffBlend, target, 14, dt);
    this.staffBack = damp(this.staffBack, this.staffMode === 'back' ? 1 : 0, 8, dt);
    this.root.updateMatrixWorld(true);
    // grip positions in root space
    const gripL = this.root.worldToLocal(this.handSocketL.getWorldPosition(tmpA));
    const gripR = this.root.worldToLocal(this.handSocketR.getWorldPosition(tmpB));
    // plant mode: vertical in left hand, slight tilt with motion
    const qPlant = tmpQ1.setFromEuler(tmpE.set(0.06 * this.locoW + 0.04, 0, -0.05));
    // strike mode: long end forward along the right hand's +Z axis
    const handQ = this.j.hdR.getWorldQuaternion(tmpQ2);
    const rootQInv = this.root.getWorldQuaternion(tmpQ3).invert();
    const handLocal = rootQInv.multiply(handQ); // hand orientation in root space
    const fwd = tmpD.set(0, 0, 1).applyQuaternion(handLocal);
    const qStrike = tmpQ4.setFromUnitVectors(tmpF.set(0, -1, 0), fwd);
    // back mode: slung diagonally across the back
    const qBack = tmpQ5.setFromEuler(tmpE.set(0, 0, 0.9));
    const pBack = tmpC.set(0.02, 1.25, -0.16);
    this.staff.quaternion.copy(qPlant).slerp(qStrike, this.staffBlend).slerp(qBack, this.staffBack);
    this.staff.position.copy(gripL).lerp(gripR, this.staffBlend).lerp(pBack, this.staffBack);
  }

  /** World position of the staff's striking end. */
  staffTip(out = new THREE.Vector3()) {
    return this.staff.localToWorld(out.set(0, -1.02, 0));
  }

  // ----------------------------------------------------------------------------------- sling
  /** Simulate the sling in world space. `aimDir` is the horizontal throwing direction (world). */
  updateSling(dt: number, aimDir: THREE.Vector3) {
    const S = this.sling;
    const hand = this.handSocketR.getWorldPosition(tmpA);
    if (!this.slingInit) {
      S.pouch.copy(hand).add(tmpB.set(0, -0.5, 0));
      S.prev.copy(S.pouch);
      this.slingInit = true;
    }
    const visible = S.state !== 'stowed';
    this.cordA.mesh.visible = this.cordB.mesh.visible = this.pouchMesh.visible = visible;
    this.stoneMesh.visible = visible && S.loaded && S.state !== 'release';
    if (!visible) return;
    const L = 0.52;
    if (S.state === 'spin') {
      // circle above the head in a plane tilted toward the target
      this.spinPhase += dt * (Math.PI * 2) * (1.8 + this.spinPower * 5.2);
      const up = tmpC.set(0, 1, 0).addScaledVector(aimDir, -0.35).normalize();
      const u = tmpD.crossVectors(up, aimDir).normalize();
      const w = tmpF.crossVectors(u, up).normalize();
      const ang = this.spinPhase;
      const target = tmpB.copy(hand).addScaledVector(u, Math.cos(ang) * L).addScaledVector(w, Math.sin(ang) * L).addScaledVector(up, -0.05);
      S.prev.copy(S.pouch);
      S.pouch.lerp(target, 1 - Math.exp(-30 * dt));
    } else {
      // pendulum (verlet) hanging from the hand
      const vel = tmpB.subVectors(S.pouch, S.prev).multiplyScalar(0.985);
      S.prev.copy(S.pouch);
      S.pouch.add(vel).add(tmpC.set(0, -9.8 * dt * dt, 0));
      const d = tmpD.subVectors(S.pouch, hand);
      const len = d.length();
      const maxL = S.state === 'release' ? L * 1.05 : L;
      if (len > maxL) S.pouch.copy(hand).addScaledVector(d, maxL / len);
      if (S.state === 'release') {
        S.releaseT += dt;
        if (S.releaseT > 0.5) S.state = 'idle';
      }
    }
    // cords: from hand to the two edges of the pouch
    const toHand = tmpD.subVectors(hand, S.pouch).normalize();
    const side = tmpF.crossVectors(toHand, tmpC.set(0, 1, 0.3).normalize()).normalize().multiplyScalar(0.035);
    const endA = tmpE2.copy(S.pouch).add(side);
    const endB = tmpE3.copy(S.pouch).sub(side);
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const sag = Math.sin(t * Math.PI) * (S.state === 'spin' ? 0.0 : 0.012);
      this.cordA.points[i].copy(hand).lerp(endA, t).y -= sag;
      this.cordB.points[i].copy(hand).lerp(endB, t).y -= sag;
    }
    if (S.state === 'release') {
      // released cord flies free
      for (let i = 1; i < 6; i++) this.cordB.points[i].copy(hand).lerp(endB, i / 5 * 0.5).addScaledVector(toHand, -0.04 * i);
    }
    this.cordA.update();
    this.cordB.update();
    this.pouchMesh.position.copy(S.pouch);
    this.pouchMesh.lookAt(hand);
    this.pouchMesh.rotateX(Math.PI / 2);
    this.stoneMesh.position.copy(S.pouch).addScaledVector(toHand, -0.012);
  }

  releaseSling(): { pos: THREE.Vector3; vel: THREE.Vector3 } {
    const S = this.sling;
    const pos = S.pouch.clone();
    const vel = S.pouch.clone().sub(S.prev);
    S.state = 'release';
    S.releaseT = 0;
    S.loaded = false;
    return { pos, vel };
  }
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const tmpF = new THREE.Vector3();
const tmpE2 = new THREE.Vector3();
const tmpE3 = new THREE.Vector3();
const tmpE = new THREE.Euler();
const tmpQ1 = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpQ3 = new THREE.Quaternion();
const tmpQ4 = new THREE.Quaternion();
const tmpQ5 = new THREE.Quaternion();
export { LEGS };
