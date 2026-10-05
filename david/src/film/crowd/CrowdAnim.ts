/*
 * CrowdAnim — bakes motion-capture clips (src/characters/mocap) into ONE float texture of skinning matrices for the
 * GPU crowd (src/film/crowd/Crowd.ts).
 *
 * The bake runs the real MakeHuman rig (HumanRig on the `man` preset's rig.json, no mesh, no textures): fingers in a
 * grip, then every clip frame is written onto the body bones exactly like MocapPlayer.applyToBones does (bone =
 * P · c · Q, pelvis relative to the root-motion frame, in place), and the 36 MOCAP_BONES skinning matrices
 * (world · bind⁻¹, 3 rows of 4) are stored per frame. Per clip it can also bake
 *   - `mirror`: the left/right mirrored take (variety: no two neighbours move alike),
 *   - `carry`: the right arm held in a spear-carrying pose (elbow bent, hand at the belt, 25 % of the clip's own arm
 *     motion kept) so a spear-bearer's shaft does not swing like a pendulum while he marches.
 * Layout: texel (frame * 108 + bone * 3 + row) in a W = 1080 wide RGBA32F texture (10 frames per texture row).
 */
import * as THREE from 'three';
import { HumanRig } from '../../characters/human/HumanRig';
import type { RigJson } from '../../characters/human/HumanData';
import { humanAssetUrl } from '../../characters/human/assets';
import { MocapLibrary, MOCAP_BONES } from '../../characters/mocap';
import { MocapPose, type MocapClip } from '../../characters/mocap/MocapClip';
import { slice } from '../../core/slice';

export const CROWD_BONES = MOCAP_BONES.length; // 36
export const TEX_PER_FRAME = CROWD_BONES * 3; // 108
export const ANIM_TEX_W = TEX_PER_FRAME * 10; // 1080

export interface CrowdClipSpec {
  /** mocap clip name */
  clip: string;
  mirror?: boolean;
  /**
   * the right arm in a spear-carry pose. true = the hand at the belt (Saul's army); (host1, wave 5) 'side' = the fist at
   * the right hip with the forearm forward, so an upright shaft rises BESIDE the shoulder and not across the face
   */
  carry?: boolean | 'side';
  /** only this part of the clip (seconds) */
  range?: [number, number];
  /** force looping on/off (default: the clip's own flag) */
  loop?: boolean;
  /** end the clip where this bone is highest (a one-shot that then HOLDS its peak, e.g. 'wrist.R' for a raised spear) */
  peak?: string;
}

export interface BakedClip {
  key: string;
  clip: string;
  start: number;
  frames: number;
  fps: number;
  duration: number;
  loop: boolean;
  /** m/s of the take along its trajectory (march playback rate = pace / speed) */
  speed: number;
  mirror: boolean;
  carry: boolean;
  /**
   * (host1, wave 6) the capture's foot contacts per baked frame (bits: heelL 1, ballL 2, heelR 4, ballR 8; mirrored with
   * the take) — a crowd can end a walk when both feet are down (the walk -> stand blend then slides least)
   */
  contacts: Uint8Array;
}

export function clipKey(s: CrowdClipSpec) {
  return `${s.clip}${s.mirror ? ':m' : ''}${s.carry ? ':c' : ''}${s.peak ? ':p' : ''}`;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _e = new THREE.Euler();

export class CrowdAnim {
  readonly texture: THREE.DataTexture;
  readonly clips = new Map<string, BakedClip>();
  readonly totalFrames: number;
  readonly bakeMs: number;
  /**
   * (host1, wave 5) the baked body's leg length / the clips' reference leg length: a take covers clip.speed x legScale
   * metres per second at rate 1 (x the agent's height scale) — a crowd matching its feet to its ground speed needs it
   */
  readonly legScale: number;

  private constructor(tex: THREE.DataTexture, clips: BakedClip[], frames: number, ms: number, legScale = 1) {
    this.texture = tex;
    for (const c of clips) this.clips.set(c.key, c);
    this.totalFrames = frames;
    this.bakeMs = ms;
    this.legScale = legScale;
  }

  get(key: string): BakedClip {
    const c = this.clips.get(key);
    if (!c) throw new Error(`crowd clip not baked: ${key}`);
    return c;
  }
  has(key: string) {
    return this.clips.has(key);
  }

  /** load the clips (MocapLibrary.shared, cached) and bake them */
  static async bake(specs: CrowdClipSpec[], lib = MocapLibrary.shared): Promise<CrowdAnim> {
    const t0 = performance.now();
    const [rigJson, clips] = await Promise.all([
      humanAssetUrl('man/rig.json').then((u) => fetch(u)).then((r) => r.json() as Promise<RigJson>),
      lib.preload([...new Set(specs.map((s) => s.clip))]),
    ]);
    const byName = new Map(clips.map((c) => [c.meta.name, c] as [string, MocapClip]));
    const root = new THREE.Object3D();
    const rig = new HumanRig(rigJson, root);
    rig.breathe = 0;
    rig.blinkEnabled = false;
    rig.setFingers('R', 'grip');
    rig.setFingers('L', 'fist');
    rig.solveGrip(0.018);
    for (let i = 0; i < 20; i++) rig.update(0.1);
    // bone table: MOCAP bone -> rig bones driven (toes: all five) and the bone whose matrix is stored
    const rigIdx: number[][] = [];
    const store: THREE.Bone[] = [];
    const bindInv: THREE.Matrix4[] = [];
    for (const b of MOCAP_BONES) {
      if (b === 'toes.L' || b === 'toes.R') {
        const s = b.slice(-1);
        rigIdx.push([1, 2, 3, 4, 5].map((i) => rig.boneIndex(`toe${i}-1.${s}`)).filter((i) => i >= 0));
        store.push(rig.bones[`toe3-1.${s}`]);
      } else {
        rigIdx.push([rig.boneIndex(b)]);
        store.push(rig.bones[b]);
      }
      const h = rigJson.bones[rig.boneIndex(store[store.length - 1].name)].h;
      bindInv.push(new THREE.Matrix4().makeTranslation(-h[0], -h[1], -h[2]));
    }
    const rest = rig.rest;
    const pelvisRest = rig.pelvis.clone();
    const rootBind = rest[0].bindPos.clone();
    const scale = (rig.thighLength + rig.shinLength) / 0.8969;
    // spear-carry pose for the right arm (control rotations, character axes; x < 0 swings forward)
    const carry: Record<string, THREE.Quaternion> = {
      'upperarm01.R': new THREE.Quaternion().setFromEuler(_e.set(-0.12, 0, -0.1)),
      'upperarm02.R': new THREE.Quaternion(),
      'lowerarm01.R': new THREE.Quaternion().setFromEuler(_e.set(-1.05, 0.25, 0)),
      'lowerarm02.R': new THREE.Quaternion().setFromEuler(_e.set(0, -0.5, 0)),
      'wrist.R': new THREE.Quaternion().setFromEuler(_e.set(0.15, 0, 0.2)),
    };
    const carryIdx = new Map<number, THREE.Quaternion>();
    MOCAP_BONES.forEach((b, i) => { if (carry[b]) carryIdx.set(i, carry[b]); });
    // (wave 5) the side carry: the upper arm hanging a little out and back, the forearm forward, the fist turned so its
    // grip hole stands upright at the hip
    const side: Record<string, THREE.Quaternion> = {
      'upperarm01.R': new THREE.Quaternion().setFromEuler(_e.set(0.06, 0, -0.2)),
      'upperarm02.R': new THREE.Quaternion(),
      'lowerarm01.R': new THREE.Quaternion().setFromEuler(_e.set(-1.3, -0.1, 0)),
      'lowerarm02.R': new THREE.Quaternion().setFromEuler(_e.set(0, -0.35, 0)),
      'wrist.R': new THREE.Quaternion().setFromEuler(_e.set(0.3, 0, 0.1)),
      // the shield arm: the forearm forward at the left side (the shield's weight damps the swing: see sideW)
      'upperarm01.L': new THREE.Quaternion().setFromEuler(_e.set(-0.12, 0, 0.12)),
      'lowerarm01.L': new THREE.Quaternion().setFromEuler(_e.set(-0.95, 0.1, 0)),
    };
    const sideIdx = new Map<number, THREE.Quaternion>();
    MOCAP_BONES.forEach((b, i) => { if (side[b]) sideIdx.set(i, side[b]); });
    // how much of the side pose replaces the capture per bone (the spear arm firmly, the shield arm half: it still swings)
    const sideW = (b: number) => (MOCAP_BONES[b].endsWith('.L') ? 0.5 : 0.82);

    // frame count
    const plan = specs.map((s) => {
      const c = byName.get(s.clip)!;
      const r0 = s.range?.[0] ?? 0;
      const r1 = Math.min(c.duration, s.range?.[1] ?? c.duration);
      const frames = Math.max(2, Math.round((r1 - r0) * c.fps) + (c.loop && !s.range ? 0 : 1));
      return { s, c, r0, frames };
    });
    const total = plan.reduce((a, p) => a + p.frames, 0);
    const rows = Math.ceil((total * TEX_PER_FRAME) / ANIM_TEX_W);
    const data = new Float32Array(ANIM_TEX_W * rows * 4);
    const pose = new MocapPose();
    const baked: BakedClip[] = [];
    let frame = 0;
    for (const { s, c, r0, frames } of plan) {
      const loop = s.loop ?? (c.loop && !s.range && !s.peak);
      const bc: BakedClip = { key: clipKey(s), clip: s.clip, start: frame, frames, fps: c.fps, duration: frames / c.fps, loop, speed: c.meta.speed, mirror: !!s.mirror, carry: !!s.carry, contacts: new Uint8Array(frames) };
      baked.push(bc);
      const pk = s.peak ? (MOCAP_BONES as readonly string[]).indexOf(s.peak) : -1;
      let best = -1e9, bestF = frames - 1;
      for (let f = 0; f < frames; f++, frame++) {
        // (wave 4b) a pause between frames when the film's builder slice is used up (core/slice); same frames, same order
        if (slice.due()) await slice.pause();
        c.sample(r0 + f / c.fps, pose, !!s.mirror);
        bc.contacts[f] = pose.contacts;
        rig.update(0);
        const q = pose.q;
        for (let b = 1; b < CROWD_BONES; b++) {
          _q.set(q[b * 4], q[b * 4 + 1], q[b * 4 + 2], q[b * 4 + 3]);
          const cq = s.carry === 'side' ? sideIdx.get(b) : s.carry ? carryIdx.get(b) : undefined;
          if (cq) _q.slerp(cq, s.carry === 'side' ? sideW(b) : 0.75);
          for (const ri of rigIdx[b]) {
            const r = rest[ri];
            r.bone.quaternion.copy(r.P).multiply(_q2.copy(_q)).multiply(r.Q);
          }
        }
        const r = rest[0];
        _q.set(q[0], q[1], q[2], q[3]);
        r.bone.quaternion.copy(_q).multiply(r.Q);
        _v.set(pose.hx, pose.hy, pose.hz).multiplyScalar(scale);
        r.bone.position.copy(rootBind).sub(pelvisRest).applyQuaternion(_q).add(_v);
        root.updateMatrixWorld(true);
        const base = frame * TEX_PER_FRAME * 4;
        for (let b = 0; b < CROWD_BONES; b++) {
          _m.multiplyMatrices(store[b].matrixWorld, bindInv[b]);
          const e = _m.elements; // column-major
          const o = base + b * 12;
          for (let row = 0; row < 3; row++) {
            data[o + row * 4] = e[row];
            data[o + row * 4 + 1] = e[4 + row];
            data[o + row * 4 + 2] = e[8 + row];
            data[o + row * 4 + 3] = e[12 + row];
          }
        }
        if (pk >= 0) {
          const hb = store[pk].getWorldPosition(_v).y;
          if (hb > best + 1e-4) { best = hb; bestF = f; }
        }
      }
      if (pk >= 0) {
        bc.frames = bestF + 1;
        bc.duration = bc.frames / c.fps;
      }
    }
    const tex = new THREE.DataTexture(data, ANIM_TEX_W, rows, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    tex.name = 'crowd.anim';
    return new CrowdAnim(tex, baked, total, performance.now() - t0, scale);
  }

  dispose() {
    this.texture.dispose();
  }
}
