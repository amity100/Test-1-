import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import { weaponMesh } from './characters';
import { Hands, REACH, type HandWindow, type WindowSpot } from './reach';
import type { RedPortal } from '../actors/reachai';
import { Armory, type Weapon } from './weapons';

/** The hero's colour (his windows, his targets): the rift cyan. */
export const REACH_CYAN = new THREE.Color(0.25, 1.6, 2.4);
/** Theirs: Kessler red-magenta. */
export const REACH_RED = new THREE.Color(2.8, 0.18, 0.55);
/**
 * Floor weapons' marks (solid colours: the lab's floor is pale, an additive
 * glow washes out on it): rifles amber, knives ice blue; yours to take cyan,
 * spoken for (their hand is on its way) red.
 */
const MARK_RIFLE = new THREE.Color(1, 0.5, 0.06);
const MARK_KNIFE = new THREE.Color(0.35, 0.75, 1);
const MARK_AIM = new THREE.Color(0.1, 0.95, 1);
const MARK_THEIRS = new THREE.Color(1, 0.1, 0.32);
/** The weapons' lit strips (sRGB hex for the shared emissive materials). */
export const STRIP_HERO = 0x19f0ff;
export const STRIP_KESSLER = 0xff2a5a;
const STRIP_FLOOR = { rifle: 0xffa236, knife: 0xcfe8ff };

const solid = (c: THREE.Color, opacity = 1) => new THREE.MeshBasicMaterial({ color: c.clone(), transparent: true, opacity, depthWrite: false, toneMapped: false });
/** Their hand windows: an oval this wide and tall (radii, m) — readable at 30 m. */
const RED_WINDOW = { w: 0.75, h: 1.12 };
/** The ghost: cyan where it can open, amber where a man would see it, red where it can't. */
const GHOST_OK = new THREE.Color(0.35, 1, 1);
const GHOST_SEEN = new THREE.Color(1, 0.72, 0.15);
const GHOST_BAD = new THREE.Color(1, 0.2, 0.25);

/** A w x h rectangle's edges (centred, in its XY plane). */
function frameEdges(w: number, h: number) {
  const x = w / 2, y = h / 2;
  const v = [-x, -y, 0, x, -y, 0, x, -y, 0, x, y, 0, x, y, 0, -x, y, 0, -x, y, 0, -x, -y, 0];
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
}

/** A flat chevron on the floor pointing +Z (the way a window looks). */
const CHEVRON = (() => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.32, -0.1);
  sh.lineTo(0, 0.22);
  sh.lineTo(0.32, -0.1);
  sh.lineTo(0.2, -0.1);
  sh.lineTo(0, 0.1);
  sh.lineTo(-0.2, -0.1);
  sh.closePath();
  return new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2).scale(1, 1, -1);
})();

const add = (c: THREE.Color) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });

/** A swirling window face (dark at the heart, lit at the rim). */
function faceMaterial(col: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: col.clone() }, uT: { value: 0 }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uCol; uniform float uT; uniform float uA;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float sw = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uT * 7.0);
        float rim = smoothstep(0.55, 1.0, r);
        vec3 c = mix(vec3(0.015, 0.02, 0.035), uCol * 0.55, rim * 0.85 + sw * 0.22 * r);
        gl_FragColor = vec4(c, uA * (0.5 + 0.45 * rim));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

const RING = new THREE.TorusGeometry(1, 0.075, 6, 40);
const DISC = new THREE.CircleGeometry(1, 32);
const HALO = new THREE.RingGeometry(0.5, 0.64, 40).rotateX(-Math.PI / 2);
const PAD = new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2);
const TIP = new THREE.OctahedronGeometry(0.11, 0).scale(1, 1.6, 1);
const MARK = new THREE.RingGeometry(0.62, 0.78, 40).rotateX(-Math.PI / 2);
const BEAM = new THREE.CylinderGeometry(0.018, 0.018, 1, 6).translate(0, 0.5, 0);
const TRACER = new THREE.BoxGeometry(0.035, 0.035, 1).translate(0, 0, 0.5);
// a stylised arm: the forearm along +Z (0..1, scaled to length), a hand at its end
const FOREARM = new THREE.CylinderGeometry(0.05, 0.06, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const CUFF = new THREE.TorusGeometry(0.075, 0.018, 6, 16);
const PALM = new THREE.BoxGeometry(0.1, 0.04, 0.11).translate(0, 0, 0.055);
const FINGERS = new THREE.BoxGeometry(0.095, 0.03, 0.08).rotateX(0.55).translate(0, -0.02, 0.13);
const THUMB = new THREE.BoxGeometry(0.03, 0.03, 0.07).rotateY(-0.6).translate(0.06, -0.005, 0.05);

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

/** One window: its rim and face (turned to you, so it always reads as a window), and an arm that comes out of it at what it's after. */
class WindowView {
  readonly g = new THREE.Group();
  readonly disc = new THREE.Group();
  readonly ring: THREE.Mesh;
  readonly face: THREE.Mesh;
  readonly faceMat: THREE.ShaderMaterial;
  readonly arm = new THREE.Group();
  readonly forearm: THREE.Mesh;
  readonly hand = new THREE.Group();
  readonly knife: THREE.Object3D;
  readonly ringMat: THREE.MeshBasicMaterial;
  /** Theirs: a light pillar over it (a race you can see from across the deck). */
  readonly beam: THREE.Mesh | null = null;
  constructor(col: THREE.Color, skin: THREE.Material, cuff: THREE.Material, red = false) {
    this.ringMat = add(col);
    this.ring = new THREE.Mesh(RING, this.ringMat);
    this.faceMat = faceMaterial(col);
    this.face = new THREE.Mesh(DISC, this.faceMat);
    this.face.renderOrder = 2;
    this.ring.renderOrder = 3;
    this.forearm = new THREE.Mesh(FOREARM, skin);
    const c = new THREE.Mesh(CUFF, cuff);
    this.hand.add(new THREE.Mesh(PALM, skin), new THREE.Mesh(FINGERS, skin), new THREE.Mesh(THUMB, skin));
    this.knife = weaponMesh('knife', STRIP_HERO, 3);
    this.knife.position.set(0, -0.01, 0.06);
    this.hand.add(this.knife);
    this.arm.add(this.forearm, c, this.hand);
    this.disc.add(this.face, this.ring);
    this.g.add(this.disc, this.arm);
    if (red) {
      this.beam = new THREE.Mesh(BEAM, solid(new THREE.Color(1, 0.15, 0.35), 0.6));
      this.beam.position.y = RED_WINDOW.h;
      this.g.add(this.beam);
    }
    this.g.visible = false;
  }
}

/** A red portal: a standing oval and a ring on the floor. */
class PortalView {
  readonly g = new THREE.Group();
  readonly ringMat = add(REACH_RED);
  readonly faceMat = faceMaterial(REACH_RED);
  readonly floorMat = add(REACH_RED);
  readonly oval = new THREE.Group();
  readonly floor: THREE.Mesh;
  readonly beam: THREE.Mesh;
  constructor() {
    const ring = new THREE.Mesh(RING, this.ringMat);
    const face = new THREE.Mesh(DISC, this.faceMat);
    face.renderOrder = 2;
    ring.renderOrder = 3;
    this.oval.add(face, ring);
    this.floor = new THREE.Mesh(MARK, this.floorMat);
    this.floor.scale.setScalar(1.2);
    this.beam = new THREE.Mesh(BEAM, solid(new THREE.Color(1, 0.12, 0.35), 0.55));
    this.beam.position.y = REACH.enemy.portal.height;
    this.beam.scale.set(2, 7, 2);
    this.g.add(this.oval, this.floor, this.beam);
    this.g.visible = false;
  }
}


class FloorView {
  readonly g = new THREE.Group();
  readonly mesh: THREE.Object3D;
  readonly haloMat: THREE.MeshBasicMaterial;
  readonly beamMat: THREE.MeshBasicMaterial;
  readonly padMat: THREE.MeshBasicMaterial;
  readonly halo: THREE.Mesh;
  readonly beam: THREE.Mesh;
  readonly pad: THREE.Mesh;
  readonly tip: THREE.Mesh;
  constructor(readonly kind: Weapon['kind']) {
    this.mesh = weaponMesh(kind, STRIP_FLOOR[kind], 3.2);
    // lying on its side, big enough to read from across the deck
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.scale.setScalar(kind === 'knife' ? 2.4 : 1.45);
    if (kind === 'knife') this.mesh.position.z = -0.2;
    const col = kind === 'rifle' ? MARK_RIFLE : MARK_KNIFE;
    this.haloMat = solid(col, 0.95);
    this.beamMat = solid(col, 0.55);
    // a dark pad under it: the weapon stands out on the pale floor
    this.padMat = solid(new THREE.Color(0.04, 0.05, 0.08), 0.42);
    this.halo = new THREE.Mesh(HALO, this.haloMat);
    this.pad = new THREE.Mesh(PAD, this.padMat);
    this.beam = new THREE.Mesh(BEAM, this.beamMat);
    this.beam.scale.set(1.3, 2.1, 1.3);
    this.tip = new THREE.Mesh(TIP, this.haloMat);
    this.tip.position.y = 2.25;
    for (const m of [this.halo, this.pad]) m.renderOrder = 1;
    const spin = new THREE.Group();
    spin.add(this.mesh);
    spin.name = 'spin';
    this.g.add(this.pad, this.halo, spin, this.beam, this.tip);
  }
}

/** What REACH's view draws this frame. */
export interface ReachFxState {
  armory: Armory;
  hands: Hands;
  portals: readonly RedPortal[];
  /** Where an owner's hand is (your gauntlet; his right hand). */
  handOf(owner: 'player' | number, out: THREE.Vector3): THREE.Vector3 | null;
  /** Where whatever a window is after is now (a man's chest, a weapon). */
  targetOf(w: HandWindow, out: THREE.Vector3): THREE.Vector3 | null;
  /** The WINDOW key's ghost (null: not aiming). */
  ghost: (WindowSpot & { seen: boolean; behind?: boolean }) | null;
  /** The open pair: `k` how open (0..1), `left` its time left (s). */
  win: { far: { pos: V3; look: V3 }; near: { pos: V3; look: V3 }; k: number; left: number } | null;
  /** What the hand would take at the far window (red: he sees it coming). */
  mark: { at: V3; bad: boolean } | null;
  /** The red portal in your hand (its exit is drawn cyan). */
  heldPortal: number;
  /** How far over the floor the ghost's bottom is (m; the drop line). */
  groundGap?: number;
  /** Where a weapon flying to a hand is (null: not flying). */
  flying(w: Weapon, out: THREE.Vector3): THREE.Vector3 | null;
  camera: THREE.Camera;
}

/**
 * REACH's look: weapons on the floor (glowing, a light pillar to find them
 * from afar), hand windows and the arms out of them (yours cyan, theirs red),
 * their red portals, your rifle's tracers, the mark on what your hand would take.
 */
export class ReachFx {
  readonly group = new THREE.Group();
  private floor = new Map<number, FloorView>();
  private windows: WindowView[] = [];
  private redWindows: WindowView[] = [];
  private portals: PortalView[] = [];
  /** The ghost: the window's outline where it would open, a chevron the way it looks, a line to the floor. */
  private ghost: THREE.Group;
  private ghostMat: THREE.LineBasicMaterial;
  private ghostFill: THREE.MeshBasicMaterial;
  private ghostArrow: THREE.Mesh;
  private ghostDrop: THREE.Line;
  /** The far window's marker (a diamond over it, readable from afar) and its frame. */
  private farMark: THREE.Group;
  private farMat: THREE.MeshBasicMaterial;
  private farFrame: THREE.LineSegments;
  private farFrameMat: THREE.LineBasicMaterial;
  private tracers: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private mark: THREE.Mesh;
  private markMat: THREE.MeshBasicMaterial;
  private flyers = new Map<number, THREE.Object3D>();
  private t = 0;
  private heroSkin = new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.5, metalness: 0.35 });
  private heroCuff = new THREE.MeshBasicMaterial({ color: REACH_CYAN, toneMapped: false });
  private redSkin = new THREE.MeshStandardMaterial({ color: 0x2a3752, roughness: 0.75, metalness: 0.15 });
  private redCuff = new THREE.MeshBasicMaterial({ color: REACH_RED, toneMapped: false });

  constructor() {
    this.group.name = 'reach';
    const W = REACH.window;
    // the ghost
    this.ghostMat = new THREE.LineBasicMaterial({ color: GHOST_OK, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
    this.ghostFill = new THREE.MeshBasicMaterial({ color: GHOST_OK, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.ghost = new THREE.Group();
    const rect = new THREE.LineSegments(frameEdges(W.width, W.height), this.ghostMat);
    rect.renderOrder = 6;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(W.width, W.height), this.ghostFill);
    this.ghostArrow = new THREE.Mesh(CHEVRON, this.ghostFill.clone());
    (this.ghostArrow.material as THREE.MeshBasicMaterial).opacity = 0.85;
    this.ghostArrow.position.set(0, -W.height / 2 + 0.03, 0.55);
    this.ghost.add(rect, fill, this.ghostArrow);
    this.ghostDrop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -1, 0)]), this.ghostMat);
    this.ghostDrop.frustumCulled = false;
    this.ghost.visible = this.ghostDrop.visible = false;
    // the far window's marker and frame
    this.farMat = solid(new THREE.Color(0.2, 1, 1));
    this.farMark = new THREE.Group();
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0).scale(0.8, 1.3, 0.8), this.farMat);
    dia.renderOrder = 7;
    this.farMark.add(dia);
    this.farFrameMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.3, 1, 1), transparent: true, opacity: 1, toneMapped: false });
    this.farFrame = new THREE.LineSegments(frameEdges(W.width + 0.12, W.height + 0.12), this.farFrameMat);
    this.farMark.visible = this.farFrame.visible = false;
    this.markMat = add(REACH_CYAN);
    this.mark = new THREE.Mesh(MARK, this.markMat);
    this.mark.visible = false;
    this.mark.renderOrder = 4;
    this.group.add(this.ghost, this.ghostDrop, this.farMark, this.farFrame, this.mark);
    for (let i = 0; i < 6; i++) {
      const m = add(REACH_CYAN);
      const mesh = new THREE.Mesh(TRACER, m);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.tracers.push({ m: mesh, mat: m, t: 1 });
    }
  }

  /**
   * One of everything drawn (at `at`) so the shader programs compile with the
   * world's; `warm(null)` hides them again.
   */
  warm(at: V3 | null) {
    const pick = [this.win(0, false), this.win(0, true), this.portal(0), this.floorView(-1, 'rifle'), this.floorView(-2, 'knife')];
    for (const o of pick) {
      o.visible = !!at;
      if (at) o.position.copy(at);
    }
    if (at) for (const w of [...this.windows, ...this.redWindows]) w.disc.scale.setScalar(0.4);
    if (!at) {
      for (const k of [-1, -2]) {
        const v = this.floor.get(k);
        if (v) this.group.remove(v.g);
        this.floor.delete(k);
      }
    }
    this.mark.visible = !!at;
    if (at) this.mark.position.copy(at);
  }

  private win(i: number, red: boolean): THREE.Group {
    const pool = red ? this.redWindows : this.windows;
    while (pool.length <= i) {
      const w = red ? new WindowView(REACH_RED, this.redSkin, this.redCuff, true) : new WindowView(REACH_CYAN, this.heroSkin, this.heroCuff);
      pool.push(w);
      this.group.add(w.g);
    }
    return pool[i].g;
  }

  private portal(i: number): THREE.Group {
    while (this.portals.length <= i) {
      const p = new PortalView();
      this.portals.push(p);
      this.group.add(p.g);
    }
    return this.portals[i].g;
  }

  private floorView(id: number, kind: Weapon['kind']): THREE.Group {
    let v = this.floor.get(id);
    if (!v || v.kind !== kind) {
      if (v) this.group.remove(v.g);
      v = new FloorView(kind);
      this.floor.set(id, v);
      this.group.add(v.g);
    }
    return v.g;
  }

  /** A round from `from` to `to` (your rifle). */
  tracer(from: V3, to: V3) {
    let best = this.tracers[0];
    for (const tr of this.tracers) if (tr.t > best.t) best = tr;
    best.t = 0;
    const m = best.m;
    m.position.copy(from);
    _v.subVectors(to, from);
    const len = _v.length();
    m.quaternion.setFromUnitVectors(Z, _v.multiplyScalar(1 / Math.max(len, 1e-6)));
    m.scale.set(1, 1, len);
    m.visible = true;
  }

  clear() {
    for (const v of this.floor.values()) this.group.remove(v.g);
    this.floor.clear();
    for (const f of this.flyers.values()) this.group.remove(f);
    this.flyers.clear();
    for (const w of [...this.windows, ...this.redWindows]) w.g.visible = false;
    for (const p of this.portals) p.g.visible = false;
    for (const tr of this.tracers) tr.m.visible = false;
    this.mark.visible = false;
    this.ghost.visible = this.ghostDrop.visible = false;
    this.farMark.visible = this.farFrame.visible = false;
  }

  update(dt: number, s: ReachFxState) {
    this.t += dt;
    const t = this.t;
    // ----- weapons on the floor (and on their way to a hand) -----
    const seen = new Set<number>();
    for (const w of s.armory.list) {
      const fly = s.flying(w, _v);
      if (fly) {
        let f = this.flyers.get(w.id);
        if (!f) {
          f = weaponMesh(w.kind, w.holder === 'player' ? STRIP_HERO : STRIP_KESSLER, 4);
          this.flyers.set(w.id, f);
          this.group.add(f);
        }
        f.position.copy(fly);
        f.rotation.y += dt * 30;
        continue;
      }
      const f = this.flyers.get(w.id);
      if (f) {
        this.group.remove(f);
        this.flyers.delete(w.id);
      }
      if (w.gone || w.holder !== null) continue;
      seen.add(w.id);
      const g = this.floorView(w.id, w.kind);
      const v = this.floor.get(w.id)!;
      g.visible = true;
      g.position.copy(w.pos);
      (g.getObjectByName('spin') as THREE.Object3D).rotation.y = w.yaw;
      const spent = Armory.spent(w);
      const aimed = w.claim === 'player';
      const theirs = w.claim !== null && w.claim !== 'player';
      const col = aimed ? MARK_AIM : theirs ? MARK_THEIRS : w.kind === 'rifle' ? MARK_RIFLE : MARK_KNIFE;
      v.haloMat.color.copy(col);
      v.beamMat.color.copy(col);
      const pulse = 0.5 + 0.5 * Math.sin(t * (aimed || theirs ? 10 : 2.6) + w.id);
      v.haloMat.opacity = spent ? 0 : 0.75 + 0.25 * pulse;
      v.beamMat.opacity = spent ? 0 : aimed ? 0.75 : 0.35 + 0.15 * pulse;
      v.padMat.opacity = spent ? 0.15 : 0.42;
      v.halo.position.y = v.pad.position.y = -0.06;
      v.halo.scale.setScalar(aimed ? 1.25 + 0.12 * pulse : 1);
      v.beam.visible = v.tip.visible = !spent && w.resting;
      v.tip.position.y = 2.25 + 0.08 * pulse;
      v.tip.rotation.y = t * 1.5;
      v.mesh.position.y = w.resting && !spent ? 0.06 + 0.05 * pulse : 0;
    }
    for (const [id, v] of this.floor) {
      if (id < 0 || seen.has(id)) continue;
      this.group.remove(v.g);
      this.floor.delete(id);
    }

    // ----- hands: yours out of the far window, theirs out of big red windows -----
    let ni = 0, ri = 0;
    for (const w of s.hands.list) {
      const red = w.owner !== 'player';
      const g = this.win(red ? ri++ : ni++, red);
      const view = (red ? this.redWindows : this.windows)[(red ? ri : ni) - 1];
      g.visible = true;
      g.position.copy(w.at);
      view.disc.quaternion.copy(s.camera.quaternion);
      view.arm.quaternion.setFromUnitVectors(Z, w.dir);
      const life = Hands.life(w);
      // (yours: the far window is the window; theirs: a red one, big enough to read across the deck)
      view.disc.visible = !w.far;
      if (!w.far) {
        const openK = w.tele > 0 && w.t < w.tele ? (0.35 + 0.65 * (w.t / w.tele)) * (0.85 + 0.15 * Math.sin(t * 40)) : Math.min(1, w.t / 0.06);
        const shut = Math.min(1, Math.max(0, (life - w.t) / 0.08));
        const k = Math.max(0.001, openK * shut);
        view.disc.scale.set(RED_WINDOW.w * k, RED_WINDOW.h * k, 1);
        view.faceMat.uniforms.uT.value = t;
        view.ringMat.opacity = w.tele > 0 && w.t < w.tele ? 0.6 + 0.4 * Math.sin(t * 30) : 1;
        if (view.beam) {
          view.beam.visible = true;
          view.beam.scale.set(1, 6 * k, 1);
        }
      } else if (view.beam) view.beam.visible = false;
      const tgt = s.targetOf(w, _v2);
      const reach = tgt ? Math.max(0.3, tgt.distanceTo(w.at) - 0.08) : 0.8;
      const k = Hands.extent(w);
      const len = Math.max(0.02, k * reach);
      view.arm.visible = w.t >= w.tele && k > 0.01;
      view.forearm.scale.set(1, 1, Math.max(0.02, len - 0.1));
      view.hand.position.set(0, 0, Math.max(0, len - 0.1));
      view.knife.visible = w.kind === 'stab' || (w.kind === 'whiff' && w.far && w.out < REACH.hand.out - 1e-3);
      view.hand.rotation.z = w.result ? 0.6 : 0;
      // (a whiff: the hand opens and closes on nothing)
      view.hand.rotation.x = w.kind === 'whiff' ? Math.sin(t * 30) * 0.3 * k : 0;
      view.arm.scale.setScalar(w.far ? 1.6 : 1.3);
      if (w.far) view.hand.position.z /= 1.6;
      if (w.far) view.forearm.scale.z /= 1.6;
      if (!w.far) {
        view.hand.position.z /= 1.3;
        view.forearm.scale.z /= 1.3;
      }
    }
    for (let i = ni; i < this.windows.length; i++) this.windows[i].g.visible = false;
    for (let i = ri; i < this.redWindows.length; i++) this.redWindows[i].g.visible = false;

    // ----- the ghost -----
    const gh = s.ghost;
    this.ghost.visible = this.ghostDrop.visible = !!gh;
    if (gh) {
      const col = !gh.ok ? GHOST_BAD : gh.seen ? GHOST_SEEN : GHOST_OK;
      this.ghostMat.color.copy(col);
      this.ghostFill.color.copy(col);
      (this.ghostArrow.material as THREE.MeshBasicMaterial).color.copy(col);
      this.ghost.position.copy(gh.pos);
      this.ghost.rotation.set(0, Math.atan2(gh.look.x, gh.look.z), 0);
      this.ghostFill.opacity = 0.1 + 0.06 * Math.sin(t * 8);
      // (to the floor under it: where it is in depth)
      const H2 = REACH.window.height / 2;
      this.ghostDrop.position.set(gh.pos.x, gh.pos.y - H2, gh.pos.z);
      this.ghostDrop.scale.set(1, Math.max(0.01, s.groundGap ?? 0), 1);
      this.ghostDrop.visible = (s.groundGap ?? 0) > 0.2;
    }

    // ----- the far window: a frame and a marker you can find from anywhere -----
    const wn = s.win;
    this.farMark.visible = this.farFrame.visible = !!wn;
    if (wn) {
      const f = wn.far;
      this.farFrame.position.copy(f.pos);
      this.farFrame.rotation.set(0, Math.atan2(f.look.x, f.look.z), 0);
      this.farFrame.scale.setScalar(Math.max(0.01, wn.k));
      // (it blinks in its last second)
      this.farFrameMat.opacity = wn.left < 1 ? 0.4 + 0.6 * (Math.sin(t * 25) > 0 ? 1 : 0) : 1;
      this.farMark.position.set(f.pos.x, f.pos.y + REACH.window.height / 2 + 0.45, f.pos.z);
      const dcam = s.camera.position.distanceTo(this.farMark.position);
      this.farMark.scale.setScalar(Math.max(1, dcam * 0.045));
      // (right by it — you went through — it needs no finding)
      if (s.camera.position.distanceTo(f.pos as THREE.Vector3) < 5) this.farMark.visible = this.farFrame.visible = false;
      this.farMark.rotation.y = t * 2;
    }

    // ----- their portals -----
    let pi = 0;
    const P = REACH.enemy.portal;
    for (const p of s.portals) {
      for (const end of [0, 1] as const) {
        const g = this.portal(pi++);
        const view = this.portals[pi - 1];
        g.visible = true;
        const at = end === 0 ? p.a : p.b;
        const yaw = end === 0 ? p.ay + Math.PI : p.by;
        g.position.copy(at);
        g.rotation.set(0, yaw, 0);
        const open = Math.min(1, p.t / P.telegraph);
        const closing = p.crossedT >= 0 ? Math.max(0, 1 - (p.t - p.crossedT) / P.after) : 1;
        // opening: a slit that widens over the telegraph (it throbs), full once open
        const sx = (P.width / 2) * (0.08 + 0.92 * open) * closing;
        const sy = (P.height / 2) * (0.3 + 0.7 * Math.sqrt(open)) * closing;
        view.oval.position.y = P.height / 2;
        view.oval.scale.set(Math.max(0.001, sx), Math.max(0.001, sy), 1);
        view.faceMat.uniforms.uT.value = t;
        const mine = p.held || (p.redirected && end === 1);
        const col = mine && end === 1 ? REACH_CYAN : REACH_RED;
        view.ringMat.color.copy(col);
        view.floorMat.color.copy(col);
        (view.faceMat.uniforms.uCol.value as THREE.Color).copy(col);
        view.ringMat.opacity = open < 1 ? 0.55 + 0.45 * Math.sin(t * 28) : 1;
        view.floorMat.opacity = 0.6 * closing;
        view.floor.scale.setScalar(1.2 + 0.15 * Math.sin(t * 6));
        view.beam.visible = open < 1 || p.crossedT < 0;
      }
    }
    for (let i = pi; i < this.portals.length; i++) this.portals[i].g.visible = false;

    // ----- tracers -----
    for (const tr of this.tracers) {
      if (!tr.m.visible) continue;
      tr.t += dt;
      tr.mat.opacity = Math.max(0, 1 - tr.t / 0.08);
      if (tr.t > 0.08) tr.m.visible = false;
    }

    // ----- what the hand would take at the far window -----
    const mk = s.mark;
    this.mark.visible = !!mk;
    if (mk) {
      this.mark.position.set(mk.at.x, mk.at.y + 0.05, mk.at.z);
      this.mark.rotation.set(0, 0, 0);
      this.mark.scale.setScalar(0.8 + 0.08 * Math.sin(t * 10));
      this.markMat.color.copy(mk.bad ? REACH_RED : REACH_CYAN);
      this.markMat.opacity = 0.95;
    }
  }
}
