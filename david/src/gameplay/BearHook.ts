import * as THREE from 'three';
import type { Engine } from '../core/Engine';
import { shared } from '../core/Shared';
import type { Flock } from '../characters/Flock';
import type { BearActor } from './BearActor';
import type { Shot, ShotFrame } from './CameraRig';
import { hideTreesNear } from '../film/land/rachel';
import { lambAtEdge, bearInThicket } from '../film/filmAnimals';
import { applyHandheld } from '../film/FilmCams';

/**
 * THE BEAR'S HOOK (cut6, CUT v4 — docs/intro-script-v4.md "The bear in gameplay"): the opening film's thicket and eyes
 * (CUT v3 H1-H2, formerly src/film/FilmWorld.ts) now open the bear's attack in play (Story.bearAttack), ≈5 s before the
 * stalk / charge / grab shots:
 *   H1 (3.0 s)  low in the grass behind the lamb: it has strayed to the edge of the scrub toward the thicket and grazes;
 *               small birds fly up out of the bushes and fall silent; the light goes out of the scene in the bushes'
 *               shade; the lamb's head comes up, the ears turning (src/film/filmAnimals.ts lambAtEdge)
 *   H2 (2.2 s)  over the lamb's back into the dark between the bushes: a slow creep; two faint amber eyes open (the
 *               bear's eye-shine, its body unseen: BearModel.darkness / eyeShine; visual-bible 3.15: never red)
 * then the bear comes out of those bushes and the existing sequence runs. Everything is put back by end() (the light,
 * the near bushes, the darkness and the eye-shine, the cleared trees, the grass pushers); the bushes of the edge itself
 * stay through the attack's shots (the bear comes out of them) and leave in dispose() — called when the chase begins.
 *
 * Where: there is no thicket within a lamb's stray of the pasture (the oaks and terebinths stand ~100 m east), so the
 * hook stages the edge of the scrub on the way to it — `edgeAt` m from the flock toward the thicket — with bushes made
 * from the world's own bush meshes (shared geometry and material: nothing compiles mid-game). Sounds (score5's): the
 * caller fires them on onCue ('birds' -> sfx('birdsScatter'), 'hush' -> music('hush', 1.2), 'eyes' -> sfx('eyesSting')).
 */
export interface BearHookHost {
  engine: Engine;
  flock: Flock;
  bear: BearActor;
}

export type HookCue = 'birds' | 'hush' | 'bleat' | 'eyes';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (u: number) => u * u * (3 - 2 * u);
const ss = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const drift = (u: number) => 0.4 * clamp01(u) + 0.6 * smooth(clamp01(u));

/** Tunable numbers of the hook (window.__bearHook under ?test=1). Times in hook seconds. */
export const HOOK = {
  // the two shots and their beats (CUT v3's H1 / H2 contract, kept as the hook's own)
  h1: 3.0, h2: 2.2, birds: 0.5, hush: 1.0, lambHead: 1.8, bleat: 0.25, eyesOpen: 0.9,
  // the edge of the scrub: metres from the flock's centre toward the thicket; the lamb grazes `lambOut` m in front of
  // it (walking in at `lambSpeed` m/s until `walkUntil`); the bear waits `bearIn` m inside it
  edgeAt: 32, lambOut: 3.1, lambSpeed: 0.55, walkUntil: 1.3, bearIn: 3.6,
  // H1: the lens ~4.1 -> 3.6 m behind and beside the lamb, 0.95 m up, looking a little down over the grass
  camBack0: 3.9, camBack1: 3.5, camSide0: 1.3, camSide1: 1.0, camH: 0.95, lookIn: 1.4, lookH: 0.32, fov0: 34, fov1: 31,
  // H2: over the lamb's back into the dark (the lens framed for the bear's head ~`h2Frame` m wide)
  h2H: 1.02, h2Frame0: 4.8, h2Frame1: 3.6,
  // the light: down across H1 (×exp1), down to ×exp2 in H2; the bear's body dark, its eyes a faint amber glow
  exp1: 0.62, exp2: 0.17, dark: 0.85, eye: 0.16, shine: 2.4,
};

export class BearHook {
  /** the edge of the scrub, the unit direction out of it (toward the flock), where the lamb starts / stops, the bear */
  readonly edge = new THREE.Vector3();
  readonly out = new THREE.Vector3();
  readonly lamb0 = new THREE.Vector3();
  readonly lambStop = new THREE.Vector3();
  readonly bearAt = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly ground: (x: number, z: number) => number;
  private props: { h1: THREE.InstancedMesh[]; h2: THREE.InstancedMesh[] } | null = null;
  private restoreTrees: (() => void) | null = null;
  private restoreRun: (() => void) | null = null;
  private birds: { group: THREE.Group; mat: THREE.SpriteMaterial; tex: THREE.Texture; list: { s: THREE.Sprite; ph: number; k: number }[] } | null = null;
  private eyes: THREE.Group | null = null;
  private eyeMat: THREE.SpriteMaterial | null = null;
  private eyeTex: THREE.Texture | null = null;
  private exposure0 = -1;
  private readonly fired = new Set<HookCue>();
  private readonly tmp = new THREE.Vector3();
  private readonly f1: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 34, roll: 0 };
  private readonly f2: ShotFrame = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 20, roll: 0 };
  /** hook seconds (advanced by tick) */
  t = 0;
  onCue: ((c: HookCue) => void) | null = null;

  constructor(private readonly h: BearHookHost) {
    const g = h.engine.terrain;
    this.ground = (x, z) => g.heightAt(x, z);
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1') {
      (window as unknown as Record<string, unknown>).__bearHook = HOOK;
    }
  }

  get length() {
    return HOOK.h1 + HOOK.h2;
  }

  /** Stage the hook from the flock's centre toward the thicket: the edge, the bushes, the lamb at it, the bear hidden. */
  stage(flockCenter: THREE.Vector3, toThicket: THREE.Vector3) {
    const c = HOOK;
    this.out.copy(toThicket).setY(0).normalize().negate();
    this.side.set(-this.out.z, 0, this.out.x);
    this.edge.copy(flockCenter).addScaledVector(this.out, -c.edgeAt);
    this.edge.y = this.ground(this.edge.x, this.edge.z);
    this.lamb0.copy(this.edge).addScaledVector(this.out, c.lambOut);
    this.lamb0.y = this.ground(this.lamb0.x, this.lamb0.z);
    this.lambStop.copy(this.lamb0).addScaledVector(this.out, -c.lambSpeed * c.walkUntil);
    this.lambStop.y = this.ground(this.lambStop.x, this.lambStop.z);
    this.bearAt.copy(this.edge).addScaledVector(this.out, -c.bearIn);
    this.bearAt.y = this.ground(this.bearAt.x, this.bearAt.z);
    // the lamb has strayed from the flock to the edge (the hook cuts in on it there)
    const lamb = this.h.flock.lamb;
    lamb.position.copy(this.lamb0);
    lamb.heading = Math.atan2(-this.out.x, -this.out.z);
    lamb.aiEnabled = false;
    lamb.state = 'walk';
    lamb.manualSpeed = c.lambSpeed;
    // the bear waits in the bushes, facing out (hidden until H2)
    const bear = this.h.bear;
    bear.place(this.bearAt.x, this.bearAt.z, Math.atan2(this.out.x, this.out.z));
    bear.visible = false;
    bear.speed = 0;
    bear.model.hold = 'none';
    bear.model.roar = 0;
    this.buildProps();
    this.showProps(1);
    try {
      this.frame1(0.5, 1.5, this.f1);
      this.restoreTrees = hideTreesNear(this.h.engine.scene, this.f1.pos, 3.2, ['oak', 'terebinth', 'carob', 'olive']);
    } catch (e) {
      console.warn('[hook] trees', e);
    }
    try {
      this.buildBirds();
      this.buildEyes();
      // compile their programs now, on the cut into the hook (not on the frame the birds fly up)
      const { renderer, camera, scene } = this.h.engine;
      for (const g of [this.birds?.group, this.eyes]) {
        if (!g) continue;
        const was = g.visible;
        g.visible = true;
        renderer.compile(g, camera, scene);
        g.visible = was;
      }
    } catch (e) {
      console.warn('[hook] birds / eyes', e);
    }
    this.t = 0;
    this.fired.clear();
  }

  /** the hook's two shots for CameraRig.playShots (the per-frame staging runs in tick) */
  shots(): Shot[] {
    return [
      { duration: HOOK.h1, ease: false, at: (u, t) => this.frame1(u, t, this.f1) },
      { duration: HOOK.h2, ease: false, at: (u, t) => this.frame2(u, t, this.f2) },
    ];
  }

  /** H1 — low in the grass behind and beside the lamb, following it to the dark edge of the scrub */
  private frame1(u: number, t: number, out: ShotFrame) {
    const c = HOOK;
    const e = drift(u);
    const lamb = this.h.flock.lamb.position;
    out.pos.copy(lamb).addScaledVector(this.out, lerp(c.camBack0, c.camBack1, e)).addScaledVector(this.side, lerp(c.camSide0, c.camSide1, e));
    out.pos.y = this.ground(out.pos.x, out.pos.z) + c.camH + 0.05 * e;
    out.look.copy(lamb).addScaledVector(this.out, -c.lookIn);
    out.look.y = this.ground(out.look.x, out.look.z) + c.lookH + 0.06 * e;
    out.fov = lerp(c.fov0, c.fov1, e);
    out.roll = 0;
    applyHandheld('thicket', t, t, out);
    return out;
  }

  /** H2 — over the lamb's back into the dark between the bushes: a slow creep; the eyes open */
  private frame2(u: number, t: number, out: ShotFrame) {
    const c = HOOK;
    const e = drift(u);
    out.pos.copy(this.lambStop).addScaledVector(this.out, 1.35 - 0.55 * e).addScaledVector(this.side, 0.38);
    out.pos.y = this.ground(out.pos.x, out.pos.z) + c.h2H;
    out.look.copy(this.bearAt).add(V(0, 0.85, 0));
    // a long lens on the bear's head (the two eyes ~12 cm apart must read as a PAIR on a phone)
    const d = Math.max(2, out.pos.distanceTo(out.look));
    const w = lerp(c.h2Frame0, c.h2Frame1, e);
    out.fov = THREE.MathUtils.radToDeg(2 * Math.atan(w / 2 / 1.78 / d));
    out.roll = 0;
    applyHandheld('lamb', t, HOOK.h1 + t, out);
    return out;
  }

  /** Per frame while the hook plays (dt = game seconds): the lamb, the birds, the bear in the dark, the light, the cues. */
  tick(dt: number) {
    const c = HOOK;
    this.t += dt;
    const t = this.t;
    const inH2 = t >= c.h1;
    const lamb = this.h.flock.lamb;
    const cue = (k: HookCue, at: number) => {
      if (t >= at && !this.fired.has(k)) {
        this.fired.add(k);
        try {
          this.onCue?.(k);
        } catch {
          /* sound never breaks the game */
        }
      }
    };
    cue('birds', c.birds - 0.05);
    cue('hush', c.hush);
    cue('bleat', c.h1 + c.bleat);
    cue('eyes', c.h1 + c.eyesOpen);
    this.showProps(inH2 ? 2 : 1);
    // the lamb: it walks in, grazes, its head comes up toward the bushes and it stands listening (H2: the same clock)
    lambAtEdge(lamb, t, { lift: c.lambHead, toward: this.bearAt, walkUntil: c.walkUntil, speed: c.lambSpeed });
    // H1: the grass between the lens and the lamb pressed down (spare pushers 3-5; play uses 0-2)
    const pu = shared.uPushers.value as THREE.Vector4[];
    if (!inH2 && pu.length >= 6) {
      const cp = this.h.engine.camera.position;
      const F = [1.0, 0.72, 0.42], R = [1.9, 1.7, 1.6];
      for (let k = 0; k < 3; k++) {
        const x = lerp(cp.x, lamb.position.x, F[k]), z = lerp(cp.z, lamb.position.z, F[k]);
        pu[3 + k].set(x, this.ground(x, z), z, R[k]);
      }
    } else this.clearPushers();
    this.tickBirds(t);
    this.tickBear(inH2, inH2 ? t - c.h1 : t);
    // the light goes out of the scene: down across H1, darker still in the bushes' shade (H2)
    this.setExposure(inH2 ? lerp(c.exp1 * 0.55, c.exp2, ss(0, 0.6, t - c.h1)) : lerp(1, c.exp1, ss(0.2, c.h1, t)));
  }

  /** the bear in the dark: hidden in H1 (its breath only, in the score), in H2 a body darker than the dark and two eyes */
  private tickBear(inH2: boolean, t: number) {
    const { bear } = this.h;
    bear.visible = inH2;
    bear.heading = Math.atan2(this.out.x, this.out.z) + 0.1 * Math.sin((inH2 ? HOOK.h1 + t : t) * 0.7);
    bear.speed = 0;
    bear.model.lookTarget = this.h.flock.lamb.position;
    try {
      bearInThicket(bear.model, inH2 ? 'lamb' : 'thicket', t);
    } catch {
      /* cosmetic */
    }
    const open = inH2 ? smooth(clamp01((t - HOOK.eyesOpen) / 0.28)) : 0;
    bear.model.eyeShine = HOOK.shine * open;
    bear.model.darkness = HOOK.dark;
    const eyes = this.eyes;
    if (!eyes) return;
    const hc = bear.model.headCenter;
    hc.updateWorldMatrix(true, false);
    eyes.visible = open > 0.01;
    eyes.children.forEach((ch, i) => {
      // eyeL / eyeR of the bear rig relative to its headCenter socket (rest frame of the head bone), a hair in front
      ch.position.set(i === 0 ? 0.06185 : -0.06185, 0.0074, 0.0626);
      hc.localToWorld(ch.position);
      ch.scale.set(HOOK.eye, HOOK.eye * Math.max(0.04, open), 1);
    });
    if (this.eyeMat) this.eyeMat.opacity = Math.min(0.95, open);
  }

  /** H1: five small birds fly up out of the bushes and away over the lens' shoulder at `birds` */
  private tickBirds(t: number) {
    const b = this.birds;
    if (!b) return;
    b.group.visible = t < HOOK.h1;
    if (!b.group.visible) return;
    for (const { s, ph, k } of b.list) {
      const flap = 0.5 + 0.5 * Math.sin((t * 9.5 + ph * 6.28) * (1 + k * 0.07));
      const go = Math.max(0, t - HOOK.birds - k * 0.07);
      const O = this.out, S = this.side;
      // out of the front of the bushes, up over the lamb and away over the lens' shoulders: the H1 frame's top edge is
      // only ~2.4 m up at the bush wall, so they climb slowly and come toward the lens (larger) — in the picture for ~1 s
      s.position.copy(this.edge).addScaledVector(O, 0.3 + go * (2.2 + k * 0.3)).addScaledVector(S, -2.0 + k * 0.85 + go * (k % 2 ? 1.1 : -0.9));
      s.position.y = this.edge.y + 0.7 + (k % 3) * 0.18 + go * (1.0 + (k % 2) * 0.3) + go * go * 0.45;
      const sz = go > 0 ? 0.32 : 0.0001;
      s.scale.set(sz, sz * (0.3 + 0.7 * flap) * 0.5, 1);
      s.visible = go > 0 && k < 5;
    }
  }

  /**
   * The bear comes out (the hook is over): the light, the near bushes of H2, the bear's darkness and eye-shine, the
   * cleared trees and the grass pushers go back; the lamb is the flock's again (it stays alert where it stands). The
   * bushes of the edge stay (the bear comes out of them) until dispose().
   */
  end() {
    this.restoreExposure();
    this.clearPushers();
    this.showProps(1);
    const { bear, flock } = this.h;
    bear.model.eyeShine = 0;
    bear.model.darkness = 0;
    bear.model.lookTarget = null;
    bearInThicket(bear.model, null, 0);
    bear.visible = true;
    if (this.eyes) this.eyes.visible = false;
    if (this.birds) this.birds.group.visible = false;
    // the lamb stands frozen where it is, its head up toward the bushes, until the bear has it (the caller gives it back
    // to the flock's AI after the grab — or dispose() does)
    const lamb = flock.lamb;
    lamb.aiEnabled = false;
    lamb.manualSpeed = 0;
    if (lamb.state !== 'carried') lamb.state = 'graze';
    const r = this.restoreTrees;
    this.restoreTrees = null;
    try {
      r?.();
    } catch (e) {
      console.warn('[hook] restore trees', e);
    }
  }

  /** Remove everything the hook added to the scene (the edge's bushes, the birds, the eyes); the lamb is the flock's
   *  again. Idempotent (also on a restart of the chapter in the middle of the hook). */
  dispose() {
    this.restoreExposure();
    this.clearPushers();
    this.restoreRunNow();
    const lamb = this.h.flock.lamb;
    lamb.aiEnabled = true;
    (lamb as unknown as { alert: number }).alert = 0;
    const bm = this.h.bear.model;
    bm.eyeShine = 0;
    bm.darkness = 0;
    bearInThicket(bm, null, 0);
    const r = this.restoreTrees;
    this.restoreTrees = null;
    try {
      r?.();
    } catch {
      /* ignore */
    }
    if (this.props) {
      for (const m of [...this.props.h1, ...this.props.h2]) {
        m.removeFromParent();
        m.dispose(); // the instance buffers only: the geometry and material belong to the world's bushes
      }
      this.props = null;
    }
    if (this.birds) {
      this.birds.group.removeFromParent();
      this.birds.mat.dispose();
      this.birds.tex.dispose();
      this.birds = null;
    }
    if (this.eyes) {
      this.eyes.removeFromParent();
      this.eyes = null;
    }
    this.eyeMat?.dispose();
    this.eyeTex?.dispose();
    this.eyeMat = null;
    this.eyeTex = null;
  }

  // ------------------------------------------------------------------------------------------------ set dressing
  /**
   * The bushes (cut4's film props, director-notes-v5 H1/H2): the edge — a dense dark wall of bushes BEHIND the lamb (not
   * flat grass cards); H2 — foliage silhouettes near the lens and round the bear, one gap onto its head on the lens'
   * line, a low bush in front of its body. Instanced copies of the world's own bush meshes.
   */
  private buildProps() {
    if (this.props) {
      for (const m of [...this.props.h1, ...this.props.h2]) {
        m.removeFromParent();
        m.dispose();
      }
      this.props = null;
    }
    const leaves: THREE.InstancedMesh[] = [], stems: THREE.InstancedMesh[] = [];
    const seen = new Set<string>();
    this.h.engine.vegetation?.group.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || !o.name.startsWith('tree-bush') || seen.has(m.geometry.uuid)) return;
      seen.add(m.geometry.uuid);
      (m.geometry.getAttribute('position').count >= 60 ? leaves : stems).push(m);
    });
    const O = this.out, Sx = this.side;
    const at = (b: THREE.Vector3, f: number, l: number) => b.clone().addScaledVector(O, f).addScaledVector(Sx, l);
    const E = this.edge, Ls = this.lambStop, Bp = this.bearAt;
    // [position, scale, yaw]; f = metres out of the scrub toward the flock, l = lateral (the H1 lens sits at +1.0..1.3)
    const H1: [THREE.Vector3, number, number][] = [
      [at(E, 0.55, -1.5), 1.45, 0.4], [at(E, 0.15, 0.3), 1.75, 2.1], [at(E, 0.85, 1.9), 1.3, 1.2], [at(E, -0.9, -0.4), 2.1, 3.3],
      [at(E, -0.6, 1.4), 1.9, 5.0], [at(E, 0.35, -3.1), 1.6, 0.9], [at(E, -1.4, -2.3), 2.3, 4.2], [at(E, -1.2, 3.0), 2.2, 1.7],
      [at(E, 1.1, 3.6), 1.2, 2.6], [at(E, -2.6, 0.9), 2.4, 2.9], [at(E, -2.9, -1.6), 2.2, 0.3], [at(E, -3.6, 2.6), 2.3, 1.1],
    ];
    const H2: [THREE.Vector3, number, number][] = [
      // near silhouettes at the frame's sides (2-4 m from the lens)
      [at(Ls, -1.0, -2.2), 1.15, 0.7], [at(Ls, -1.6, 2.5), 1.3, 2.4], [at(Ls, -0.4, 3.2), 1.0, 4.4], [at(Ls, -0.7, -3.1), 1.2, 5.6],
      // round the bear: a clear gap onto its head on the lens' line, a low bush in front of its body, a dark mass behind
      [at(Bp, 1.3, 0.25), 0.62, 0.2], [at(Bp, -1.8, 0.3), 2.2, 2.2], [at(Bp, -0.6, -2.0), 1.8, 4.9], [at(Bp, 0.1, 2.1), 1.9, 0.5],
    ];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = V(0, 1, 0);
    const make = (list: [THREE.Vector3, number, number][], name: string) => {
      const out: THREE.InstancedMesh[] = [];
      const add = (src: THREE.InstancedMesh[]) => src.forEach((m, v) => {
        const mine = list.filter((_, i) => i % src.length === v);
        if (!mine.length) return;
        const im = new THREE.InstancedMesh(m.geometry, m.material, mine.length);
        mine.forEach(([p, s, yaw], k) => {
          const y = this.ground(p.x, p.z) - 0.08;
          m4.compose(V(p.x, y, p.z), q.setFromAxisAngle(up, yaw), sc.set(s * 1.05, s * 0.95, s * 1.05));
          im.setMatrixAt(k, m4);
        });
        im.castShadow = true;
        im.receiveShadow = true;
        im.name = name;
        im.visible = false;
        im.computeBoundingSphere();
        this.h.engine.scene.add(im);
        out.push(im);
      });
      add(leaves);
      add(stems);
      return out;
    };
    this.props = { h1: make(H1, 'hook:edge-bushes'), h2: make(H2, 'hook:h2-bushes') };
  }

  /** The attack's later angles (from the side of the bear, behind it) are cut in without the edge's bushes — a cheat
   *  between angles, as H1 / H2 do: the bear runs back through where they stood, and a lens beside it would be in them. */
  hideBushes() {
    this.showProps(0);
  }

  /**
   * The attack's lenses follow the bear as it runs off toward the thicket (Story.bearAttack: beside it, behind it): the
   * world's bushes and trees in that corridor — `from` along `dir` for `length` m, `left`..`right` m to the side (the
   * side = dir turned right, the lenses' side) — are cleared for the shots and put back by dispose() (the lens is on
   * David's face by then). One pass over the vegetation's instances.
   */
  clearRun(from: THREE.Vector3, dir: THREE.Vector3, length: number, left: number, right: number) {
    this.restoreRunNow();
    const saved: { mesh: THREE.InstancedMesh; i: number; m: THREE.Matrix4 }[] = [];
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const d = this.tmp.copy(dir).setY(0).normalize(), sx = -d.z, sz = d.x;
    const kinds = new Set(['tree-bush', 'tree-oak', 'tree-terebinth', 'tree-carob', 'tree-olive']);
    this.h.engine.scene.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (!im.isInstancedMesh || !kinds.has(im.name.split('#')[0])) return;
      let touched = false;
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m4);
        p.setFromMatrixPosition(m4).applyMatrix4(im.matrixWorld);
        const rx = p.x - from.x, rz = p.z - from.z;
        const along = rx * d.x + rz * d.z, across = rx * sx + rz * sz;
        if (along < -4 || along > length || across < left || across > right) continue;
        saved.push({ mesh: im, i, m: m4.clone() });
        im.setMatrixAt(i, zero);
        touched = true;
      }
      if (touched) im.instanceMatrix.needsUpdate = true;
    });
    this.restoreRun = () => {
      for (const sv of saved) {
        sv.mesh.setMatrixAt(sv.i, sv.m);
        sv.mesh.instanceMatrix.needsUpdate = true;
      }
      saved.length = 0;
    };
  }

  private restoreRunNow() {
    const r = this.restoreRun;
    this.restoreRun = null;
    try {
      r?.();
    } catch (e) {
      console.warn('[hook] restore run', e);
    }
  }

  /** 1 = the edge's bushes (H1, the attack's first shot); 2 = H2's silhouettes instead (the two angles are cut together:
   *  a cheat — the edge's wall would stand between the H2 lens and the eyes); 0 = none */
  private showProps(level: 0 | 1 | 2) {
    if (!this.props) return;
    for (const m of this.props.h1) m.visible = level === 1;
    for (const m of this.props.h2) m.visible = level === 2;
  }

  private buildBirds() {
    if (this.birds) return;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const x = c.getContext('2d')!;
    // a small bird in flight seen from below / the side: two swept wings and a body (a white silhouette, tinted by the
    // material: a mid sunlit brown that reads against the dark bushes AND the bright sky)
    x.fillStyle = 'rgba(255,255,255,1)';
    x.beginPath();
    x.moveTo(2, 9);
    x.quadraticCurveTo(18, 6, 30, 17);
    x.quadraticCurveTo(32, 21, 34, 17);
    x.quadraticCurveTo(46, 6, 62, 9);
    x.quadraticCurveTo(46, 12, 35, 22);
    x.quadraticCurveTo(32, 27, 29, 22);
    x.quadraticCurveTo(18, 12, 2, 9);
    x.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, color: 0x9c8466, transparent: true, depthWrite: false, fog: false });
    const group = new THREE.Group();
    group.name = 'hook:birds';
    const list: { s: THREE.Sprite; ph: number; k: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.0001, 0.0001, 1);
      sp.position.copy(this.edge);
      group.add(sp);
      list.push({ s: sp, ph: (i * 0.37) % 1, k: i });
    }
    this.h.engine.scene.add(group);
    this.birds = { group, mat, tex, list };
  }

  private buildEyes() {
    if (this.eyes) return;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,244,214,1)');
    gr.addColorStop(0.22, 'rgba(255,206,120,0.8)');
    gr.addColorStop(0.55, 'rgba(160,90,20,0.25)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    this.eyeTex = new THREE.CanvasTexture(c);
    this.eyeTex.colorSpace = THREE.SRGBColorSpace;
    // visual-bible 3.15: a FAINT amber eyeshine (tapetum), never red, never a demon glow; no depth test — the glow sits
    // exactly on the rig's eye sockets and must read THROUGH the leaves in front of it
    this.eyeMat = new THREE.SpriteMaterial({ map: this.eyeTex, color: new THREE.Color(1.4, 1.2, 0.72), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false, fog: false });
    const g = new THREE.Group();
    g.name = 'hook:bear-eyes';
    for (let i = 0; i < 2; i++) {
      const sp = new THREE.Sprite(this.eyeMat);
      sp.renderOrder = 10;
      g.add(sp);
    }
    g.visible = false;
    this.h.engine.scene.add(g);
    this.eyes = g;
  }

  private clearPushers() {
    const pu = shared.uPushers.value as THREE.Vector4[];
    for (let k = 3; k < Math.min(6, pu.length); k++) pu[k].set(0, -999, 0, 0);
  }

  /** the world's exposure × k for the hook's shots only (the game's own exposure is put back by end / dispose) */
  private setExposure(k: number) {
    const r = this.h.engine.renderer;
    if (this.exposure0 < 0) this.exposure0 = r.toneMappingExposure;
    r.toneMappingExposure = this.exposure0 * k;
  }

  private restoreExposure() {
    if (this.exposure0 < 0) return;
    this.h.engine.renderer.toneMappingExposure = this.exposure0;
    this.exposure0 = -1;
  }

  /** where the hook's lens is now (tests) */
  lens(out = this.tmp) {
    return out.copy(this.t < HOOK.h1 ? this.f1.pos : this.f2.pos);
  }
}
