import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import type { RedPortal } from '../actors/reachai';
import { AIMP, spotFrame, type Spot } from './aimportal';

/** Yours: the rift cyan; the near twin's orange; theirs: Kessler red-magenta; the shield: violet. */
export const AIM_CYAN = new THREE.Color(0.25, 1.6, 2.4);
export const AIM_RED = new THREE.Color(2.8, 0.18, 0.55);
/** The chain's links past the pair: a warm gold, apart from the pair's cyan and orange, their red and the shield's violet. */
export const AIM_CHAIN = new THREE.Color(2.3, 1.7, 0.3);
const SHIELD = new THREE.Color(1.1, 0.35, 1.9);
const GHOST_OK = new THREE.Color(0.35, 1, 1);
const GHOST_SNAP = new THREE.Color(1, 0.55, 1);
const GHOST_BAD = new THREE.Color(1, 0.2, 0.25);

const add = (c: THREE.Color, opacity = 1) => new THREE.MeshBasicMaterial({ color: c.clone(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
const solid = (c: THREE.Color, opacity = 1) => new THREE.MeshBasicMaterial({ color: c.clone(), transparent: true, opacity, depthWrite: false, toneMapped: false });

function ellipse(rx: number, ry: number, n = 40) {
  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push(Math.cos(a) * rx, Math.sin(a) * ry, 0);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
}

const TRACER = new THREE.BoxGeometry(0.03, 0.03, 1).translate(0, 0, 0.5);
const RING = new THREE.TorusGeometry(1, 0.07, 6, 40);
const DISC = new THREE.CircleGeometry(1, 32);
const FLOOR = new THREE.RingGeometry(0.62, 0.78, 40).rotateX(-Math.PI / 2);
const Z = new THREE.Vector3(0, 0, 1);

/** A swirling face (dark at the heart, lit at the rim), for the red portals. */
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

/** A portal-shield: a vertical panel of violet hexes with a lit rim; it flares when a round hits it. */
function shieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: SHIELD.clone() }, uT: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uCol; uniform float uT; uniform float uFlash;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float e = max(abs(p.x), abs(p.y));
        float rim = smoothstep(0.82, 1.0, e);
        vec2 g = vec2(vUv.x * 6.0, vUv.y * 9.0 + uT * 0.6);
        float hex = 0.5 + 0.5 * sin(g.x * 3.14159) * sin(g.y * 3.14159);
        float scan = 0.5 + 0.5 * sin(vUv.y * 24.0 - uT * 5.0);
        vec3 c = uCol * (0.22 + 0.18 * hex + 0.12 * scan + rim * 0.9 + uFlash * 1.2);
        gl_FragColor = vec4(c, 0.32 + rim * 0.5 + uFlash * 0.4);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

class ShieldView {
  readonly mesh: THREE.Mesh;
  readonly mat = shieldMaterial();
  flash = 0;
  constructor() {
    const M = AIMP.enemy.mirror;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(M.shieldW, M.shieldH), this.mat);
    this.mesh.renderOrder = 8;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
}

class RedView {
  readonly g = new THREE.Group();
  readonly ends: { oval: THREE.Group; floor: THREE.Mesh; face: THREE.ShaderMaterial; ring: THREE.MeshBasicMaterial; floorMat: THREE.MeshBasicMaterial }[] = [];
  constructor() {
    for (let i = 0; i < 2; i++) {
      const ringMat = add(AIM_RED);
      const face = faceMaterial(AIM_RED);
      const ring = new THREE.Mesh(RING, ringMat);
      const disc = new THREE.Mesh(DISC, face);
      disc.renderOrder = 2;
      ring.renderOrder = 3;
      const oval = new THREE.Group();
      oval.add(disc, ring);
      const floorMat = add(AIM_RED);
      const floor = new THREE.Mesh(FLOOR, floorMat);
      this.g.add(oval, floor);
      this.ends.push({ oval, floor, face, ring: ringMat, floorMat });
    }
    this.g.visible = false;
  }
}

/** What this frame draws. */
export interface AimFxState {
  /** The ghost (a held PORTAL, or SNAP): where it would open; `kind` colours it. */
  ghost: { spot: Spot; kind: 'ok' | 'snap' | 'bad' } | null;
  /** The mirrors' shields: facing `yaw`, where they stand. */
  shields: { id: number; pos: V3; yaw: number }[];
  red: readonly RedPortal[];
  /** The chain's links past the pair (CHAIN). */
  chain?: readonly Spot[];
  /** The man the crosshair is on (a ring at his feet; brighter while his side is being picked). */
  target?: { pos: V3; radius: number; picking: boolean } | null;
}

const _v = new THREE.Vector3();

/**
 * AIM PORTAL's own drawing: the ghost of a portal you are placing, tracers
 * (through the pair, in two pieces), the mirrors' shields, their red portals,
 * a red flash where a sealed panel refuses you. The pair itself is the rift
 * system's (real see-through portals).
 */
export class AimFx {
  readonly group = new THREE.Group();
  private ghost: THREE.Group;
  private ghostLine: THREE.LineLoop;
  private ghostLineMat: THREE.LineBasicMaterial;
  private ghostFill: THREE.Mesh;
  private ghostFillMat: THREE.MeshBasicMaterial;
  private ghostArrow: THREE.Mesh;
  private tracers: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private shields = new Map<number, ShieldView>();
  private reds: RedView[] = [];
  private flashes: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private mark: THREE.Mesh;
  private markMat: THREE.MeshBasicMaterial;
  private links: { g: THREE.Group; face: THREE.ShaderMaterial; ring: THREE.MeshBasicMaterial }[] = [];
  private t = 0;

  constructor() {
    this.group.name = 'aimportal';
    this.ghost = new THREE.Group();
    this.ghostLineMat = new THREE.LineBasicMaterial({ color: GHOST_OK, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
    this.ghostLine = new THREE.LineLoop(ellipse(AIMP.w / 2, AIMP.h / 2), this.ghostLineMat);
    this.ghostLine.renderOrder = 6;
    this.ghostFillMat = new THREE.MeshBasicMaterial({ color: GHOST_OK, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.ghostFill = new THREE.Mesh(DISC, this.ghostFillMat);
    this.ghostFill.scale.set(AIMP.w / 2, AIMP.h / 2, 1);
    // an arrow out of its front (the way things come out)
    const sh = new THREE.Shape();
    sh.moveTo(-0.16, 0);
    sh.lineTo(0, 0.3);
    sh.lineTo(0.16, 0);
    sh.lineTo(0.06, 0);
    sh.lineTo(0.06, -0.2);
    sh.lineTo(-0.06, -0.2);
    sh.lineTo(-0.06, 0);
    sh.closePath();
    this.ghostArrow = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), this.ghostFillMat.clone());
    (this.ghostArrow.material as THREE.MeshBasicMaterial).opacity = 0.85;
    this.ghostArrow.position.z = 0.35;
    this.ghost.add(this.ghostLine, this.ghostFill, this.ghostArrow);
    this.ghost.visible = false;
    this.group.add(this.ghost);
    // the ring at the feet of the man the crosshair is on
    this.markMat = add(GHOST_SNAP, 0.9);
    this.mark = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40).rotateX(-Math.PI / 2), this.markMat);
    this.mark.renderOrder = 7;
    this.mark.frustumCulled = false;
    this.mark.visible = false;
    this.group.add(this.mark);
    // the chain's links past the pair (two at most)
    for (let i = 0; i < 2; i++) {
      const ringMat = add(AIM_CHAIN);
      const face = faceMaterial(AIM_CHAIN);
      const ring = new THREE.Mesh(RING, ringMat);
      const disc = new THREE.Mesh(DISC, face);
      disc.renderOrder = 2;
      ring.renderOrder = 3;
      const g = new THREE.Group();
      g.add(disc, ring);
      g.visible = false;
      this.group.add(g);
      this.links.push({ g, face, ring: ringMat });
    }
    for (let i = 0; i < 8; i++) {
      const mat = add(AIM_CYAN);
      const m = new THREE.Mesh(TRACER, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.group.add(m);
      this.tracers.push({ m, mat, t: 1 });
    }
    for (let i = 0; i < 3; i++) {
      const mat = add(AIM_RED);
      const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.26, 28), mat);
      m.visible = false;
      m.frustumCulled = false;
      this.group.add(m);
      this.flashes.push({ m, mat, t: 1 });
    }
  }

  /** One of everything drawn (at `at`) so the shader programs compile with the world's; `warm(null)` hides them. */
  warm(at: V3 | null) {
    this.ghost.visible = !!at;
    if (at) this.ghost.position.copy(at);
    const sv = this.shield(-1);
    sv.mesh.visible = !!at;
    if (at) sv.mesh.position.copy(at);
    for (const l of this.links) {
      l.g.visible = !!at;
      if (at) l.g.position.copy(at);
    }
    const rv = this.red(0);
    rv.g.visible = !!at;
    if (at) rv.g.position.copy(at);
    for (const e of rv.ends) e.oval.position.set(0, 1, 0);
    if (!at) {
      for (const l of this.links) l.g.visible = false;
      this.shields.delete(-1);
      this.group.remove(sv.mesh);
      rv.g.visible = false;
    }
  }

  private shield(id: number): ShieldView {
    let s = this.shields.get(id);
    if (!s) {
      s = new ShieldView();
      this.shields.set(id, s);
      this.group.add(s.mesh);
    }
    return s;
  }

  private red(i: number): RedView {
    while (this.reds.length <= i) {
      const r = new RedView();
      this.reds.push(r);
      this.group.add(r.g);
    }
    return this.reds[i];
  }

  /** A round (yours) from `from` to `to`. */
  tracer(from: V3, to: V3, col: THREE.Color = AIM_CYAN) {
    let best = this.tracers[0];
    for (const tr of this.tracers) if (tr.t > best.t) best = tr;
    best.t = 0;
    best.mat.color.copy(col);
    const m = best.m;
    m.position.copy(from);
    _v.subVectors(to, from);
    const len = _v.length();
    m.quaternion.setFromUnitVectors(Z, _v.multiplyScalar(1 / Math.max(len, 1e-6)));
    m.scale.set(1, 1, len);
    m.visible = true;
  }

  /** A shield took a round (it flares). */
  shieldHit(id: number) {
    this.shield(id).flash = 1;
  }

  /** A red flash on the surface that refused you (at `at`, facing `n`). */
  refused(at: V3, n: V3) {
    let best = this.flashes[0];
    for (const f of this.flashes) if (f.t > best.t) best = f;
    best.t = 0;
    best.m.position.copy(at).addScaledVector(n, 0.03);
    best.m.quaternion.setFromUnitVectors(Z, n);
    best.m.visible = true;
  }

  clear() {
    for (const tr of this.tracers) tr.m.visible = false;
    for (const f of this.flashes) f.m.visible = false;
    for (const s of this.shields.values()) s.mesh.visible = false;
    for (const r of this.reds) r.g.visible = false;
    for (const l of this.links) l.g.visible = false;
    this.ghost.visible = false;
    this.mark.visible = false;
  }

  update(dt: number, s: AimFxState) {
    this.t += dt;
    for (const tr of this.tracers) {
      if (!tr.m.visible) continue;
      tr.t += dt / 0.12;
      if (tr.t >= 1) tr.m.visible = false;
      else tr.mat.opacity = 1 - tr.t;
    }
    for (const f of this.flashes) {
      if (!f.m.visible) continue;
      f.t += dt / 0.4;
      if (f.t >= 1) f.m.visible = false;
      else {
        f.mat.opacity = 1 - f.t;
        f.m.scale.setScalar(1 + f.t * 2.2);
      }
    }
    // the ghost
    const g = s.ghost;
    this.ghost.visible = !!g;
    if (g) {
      const sp = g.spot;
      this.ghost.position.copy(sp.pos);
      this.ghost.quaternion.copy(spotFrame(sp).quaternion);
      const col = g.kind === 'bad' ? GHOST_BAD : g.kind === 'snap' ? GHOST_SNAP : GHOST_OK;
      this.ghostLineMat.color.copy(col);
      this.ghostFillMat.color.copy(col);
      (this.ghostArrow.material as THREE.MeshBasicMaterial).color.copy(col);
      const sx = sp.w / AIMP.w, sy = sp.h / AIMP.h;
      this.ghostLine.scale.set(sx, sy, 1);
      this.ghostFill.scale.set(sp.w / 2, sp.h / 2, 1);
      this.ghostArrow.visible = g.kind !== 'bad';
      this.ghostFillMat.opacity = 0.1 + 0.05 * Math.sin(this.t * 14);
    }
    // the man the crosshair is on
    const tg = s.target;
    this.mark.visible = !!tg;
    if (tg) {
      this.mark.position.set(tg.pos.x, tg.pos.y + 0.05, tg.pos.z);
      this.mark.scale.setScalar((tg.radius + 0.25) / 0.56 * (1 + 0.06 * Math.sin(this.t * 10)));
      this.markMat.opacity = tg.picking ? 1 : 0.75;
    }
    // the shields
    const seen = new Set<number>();
    for (const sh of s.shields) {
      const v = this.shield(sh.id);
      seen.add(sh.id);
      v.mesh.visible = true;
      const M = AIMP.enemy.mirror;
      v.mesh.position.set(sh.pos.x + Math.sin(sh.yaw) * M.shieldDist, sh.pos.y + M.shieldH / 2, sh.pos.z + Math.cos(sh.yaw) * M.shieldDist);
      v.mesh.rotation.set(0, sh.yaw, 0);
      v.flash = Math.max(0, v.flash - dt * 5);
      v.mat.uniforms.uFlash.value = v.flash;
      v.mat.uniforms.uT.value = this.t;
    }
    for (const [id, v] of this.shields) if (!seen.has(id) && id >= 0) v.mesh.visible = false;
    // the chain's links: a gold ring with a swirling face, on the surface, facing out of it
    const cs = s.chain ?? [];
    for (let i = 0; i < this.links.length; i++) {
      const l = this.links[i], sp = cs[i];
      l.g.visible = !!sp;
      if (!sp) continue;
      l.g.position.copy(sp.pos);
      l.g.quaternion.copy(spotFrame(sp).quaternion);
      l.g.scale.set(sp.w / 2, sp.h / 2, 1);
      l.face.uniforms.uT.value = this.t;
      l.face.uniforms.uA.value = 0.85;
      l.ring.opacity = 0.85 + 0.15 * Math.sin(this.t * 8 + i);
    }
    // their red portals
    for (let i = 0; i < s.red.length || i < this.reds.length; i++) {
      const p = s.red[i];
      const v = i < this.reds.length || p ? this.red(i) : null;
      if (!v) continue;
      v.g.visible = !!p;
      if (!p) continue;
      const k = Math.min(1, p.t / 0.35);
      const pulse = p.t < 0.5 ? 0.5 + 0.5 * Math.sin(p.t * 40) : 1;
      for (let e = 0; e < 2; e++) {
        const at = e === 0 ? p.a : p.b;
        const yaw = e === 0 ? p.ay : p.by;
        const end = v.ends[e];
        end.oval.position.set(at.x, at.y + 1.15, at.z);
        end.oval.rotation.y = yaw + Math.PI;
        end.oval.scale.set(0.62 * k, 1.1 * k, 1);
        end.face.uniforms.uT.value = this.t;
        end.face.uniforms.uA.value = 0.85 * pulse;
        end.ring.opacity = pulse;
        end.floor.position.set(at.x, at.y + 0.04, at.z);
        end.floor.scale.setScalar(1.1 + 0.15 * Math.sin(this.t * 6));
        end.floorMat.opacity = 0.9 * pulse;
      }
    }
  }

  dispose() {
    this.clear();
  }
}
