import * as THREE from 'three';
import { mulberry32 } from '../core/noise';
import type { Terrain } from '../world/Terrain';
import type { TextureSet } from '../world/Textures';
import type { Colliders } from '../core/Colliders';
import { LAYOUT } from '../world/Layout';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A clay jar (כַּד) for sling practice. Shatters into terracotta sherds (and the water in it sprays out). */
export class Jar {
  readonly group = new THREE.Group();
  alive = true;
  readonly center = new THREE.Vector3();
  /** height of the jar's centre above its base (scaled) */
  readonly midH: number;
  private shards: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
  private t = 0;
  constructor(private mat: THREE.Material, private ground: (x: number, z: number) => number, pos: THREE.Vector3, scale: number, geo?: THREE.BufferGeometry) {
    const m = new THREE.Mesh(geo ?? jarGeometry(), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    this.group.position.copy(pos);
    this.group.scale.setScalar(scale);
    this.midH = 0.28 * scale;
    this.center.copy(pos).add(new THREE.Vector3(0, this.midH, 0));
  }

  /** move the jar (a moving target): its centre follows */
  setPosition(p: THREE.Vector3) {
    this.group.position.copy(p);
    this.center.copy(p).add(new THREE.Vector3(0, this.midH, 0));
  }

  shatter(vel: THREE.Vector3) {
    if (!this.alive) return;
    this.alive = false;
    const body = this.group.children[0];
    body.visible = false;
    const rnd = mulberry32(Math.floor(Math.random() * 1e6));
    const dirV = vel.clone().normalize();
    for (let i = 0; i < 18; i++) {
      const g = new THREE.BufferGeometry();
      const s = 0.05 + rnd() * 0.07;
      // a curved sherd: two triangles bent a little (the jar's wall)
      const v = new Float32Array([0, 0, 0, s, rnd() * 0.02, rnd() * s * 0.35, rnd() * s * 0.5, s * 0.9, rnd() * 0.02, s * 0.85, s * 0.8, s * 0.12]);
      g.setAttribute('position', new THREE.BufferAttribute(v, 3));
      g.setIndex([0, 1, 2, 1, 3, 2]);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, this.mat);
      m.castShadow = true;
      m.position.set((rnd() - 0.5) * 0.25, 0.1 + rnd() * 0.4, (rnd() - 0.5) * 0.25);
      this.group.add(m);
      const dir = new THREE.Vector3(rnd() - 0.5, rnd() * 0.8 + 0.3, rnd() - 0.5).normalize();
      this.shards.push({ m, v: dir.multiplyScalar(1.5 + rnd() * 2.8).addScaledVector(dirV, 1.6 + rnd()), w: new THREE.Vector3(rnd() * 14, rnd() * 14, rnd() * 14) });
    }
  }

  reset() {
    this.alive = true;
    this.group.children[0].visible = true;
    for (const s of this.shards) {
      this.group.remove(s.m);
      s.m.geometry.dispose();
    }
    this.shards = [];
    this.t = 0;
  }

  update(dt: number) {
    if (this.alive) return;
    this.t += dt;
    const base = this.group.position;
    const sc = this.group.scale.x;
    for (const s of this.shards) {
      if (s.v.lengthSq() < 0.001) continue;
      s.v.y -= 9.8 * dt;
      s.m.position.addScaledVector(s.v, dt / sc);
      s.m.rotation.x += s.w.x * dt;
      s.m.rotation.y += s.w.y * dt;
      const wy = base.y + s.m.position.y * sc;
      const gy = this.ground(base.x + s.m.position.x * sc, base.z + s.m.position.z * sc);
      if (wy < gy + 0.01) {
        s.m.position.y = (gy + 0.01 - base.y) / sc;
        s.v.multiplyScalar(0.3);
        s.v.y = Math.abs(s.v.y) * 0.3;
        s.w.multiplyScalar(0.5);
        if (Math.abs(s.v.y) < 0.2) s.v.set(0, 0, 0);
      }
    }
  }
}

/** an Iron Age water jar (כַּד): a lathed body with a short neck, a rim and two loop handles, one geometry */
export function jarGeometry() {
  const pts: [number, number][] = [[0.0, 0], [0.09, 0.0], [0.15, 0.08], [0.18, 0.2], [0.17, 0.32], [0.12, 0.42], [0.075, 0.47], [0.07, 0.53], [0.09, 0.56], [0.075, 0.57]];
  const body = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 22);
  const parts: THREE.BufferGeometry[] = [body.toNonIndexed()];
  for (const s of [1, -1]) {
    const h = new THREE.TorusGeometry(0.05, 0.012, 6, 10, Math.PI);
    h.rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    h.translate(0.12 * s, 0.4, 0);
    parts.push(h.toNonIndexed());
  }
  for (const g of parts) for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
  const merged = mergeSimple(parts);
  merged.computeVertexNormals();
  return merged;
}

function mergeSimple(gs: THREE.BufferGeometry[]) {
  let n = 0;
  for (const g of gs) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    pos.set(p.array as Float32Array, o);
    o += p.count * 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return out;
}

/** wait for the next frame (or 60 ms when frames are throttled): builders yield with it between heavy steps */
export function nextFrame() {
  return new Promise<void>((r) => {
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        r();
      }
    };
    requestAnimationFrame(go);
    setTimeout(go, 60);
  });
}

// ------------------------------------------------------------------------------------------ the stream bed
/** what a pebble in the bed is like (gameplay v2 §2): only 'smooth' ones are worth the bag */
export type PebbleKind = 'smooth' | 'flat' | 'rough' | 'angular';

/** one stone he can pick up and examine */
export interface Candidate {
  kind: PebbleKind;
  pos: THREE.Vector3;
  taken: boolean;
  /** the instanced mesh it lives in and its index (hidden when picked) */
  mesh: THREE.InstancedMesh;
  index: number;
  /** in / beside the trickle (a wet sheen) */
  wet: boolean;
  /** where it lay at first (restarts) */
  home: THREE.Vector3;
  homeQ: THREE.Quaternion;
  homeS: number;
  moved: boolean;
}

/**
 * a wadi pebble geometry: `round` 0..1 (angular .. water-worn), `flat` (thickness ratio), `seed` — low-poly, the
 * lumps of an unworn stone vs. the even ellipsoid of a polished one
 */
export function pebbleShape(seed: number, round: number, flat: number, elong = 1, detail = 1) {
  // indexed (shared vertices): water-worn stones shade smooth; the fracture planes of angular ones stay crisp enough
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const rnd = mulberry32(seed);
  const facets = Array.from({ length: 7 }, () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize());
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    // angular stones: planes cut into the ellipsoid (fracture faces); water-worn ones keep the smooth ellipsoid
    let r = 1;
    for (const f of facets) {
      const d = v.dot(f);
      if (d > 0.55) r -= (d - 0.55) * 0.9 * (1 - round);
    }
    r *= 1 + (rnd() - 0.5) * 0.18 * (1 - round);
    p.setXYZ(i, v.x * r * elong, v.y * r * flat, v.z * r);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * The stream bed of the five smooth stones (1 Sam 17:40 "וַיִּבְחַר־לוֹ חֲמִשָּׁה חַלֻּקֵי־אֲבָנִים מִן־הַנַּחַל"): a field
 * of pebbles of every shape along the wadi (instanced), a thin trickle down its middle, and among them stones the
 * right size for a sling — most of them flat, rough or broken; the smooth, round, polished ones are fewer, with a
 * wet sheen where the trickle runs. No beacons: a near good stone only catches the light a little.
 */
export class StreamBed {
  readonly group = new THREE.Group();
  readonly candidates: Candidate[] = [];
  /** the bed's axis (world): centre, along, across */
  readonly center = new THREE.Vector3();
  private glint: { c: Candidate; base: THREE.Color } | null = null;
  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpC = new THREE.Color();
  readonly goodGeo: THREE.BufferGeometry[] = [];
  readonly materials: Record<'smooth' | 'wet' | 'rough', THREE.MeshStandardMaterial>;
  private meshes: THREE.InstancedMesh[] = [];
  built = false;

  constructor(private terrain: Terrain, private tex: TextureSet, private colliders: Colliders) {
    const stoneMap = tex.gravel ?? null;
    void stoneMap;
    this.materials = {
      // water-worn limestone / flint pebbles: pale, smooth, a soft sheen
      smooth: new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.34, metalness: 0 }),
      // wet: darker, glossy (the trickle)
      wet: new THREE.MeshStandardMaterial({ color: 0xb8ad98, roughness: 0.12, metalness: 0.02 }),
      rough: new THREE.MeshStandardMaterial({ color: 0xd2c6b0, roughness: 0.9, metalness: 0 }),
    };
  }

  /** pebbles in the field: 1 on desktop, fewer on phones */
  density = 1;
  /** build in small steps (a frame between them): ~1-3 ms each */
  async build(yieldFrame: () => Promise<void>) {
    if (this.built) return;
    this.built = true;
    const T = this.terrain;
    const S = LAYOUT.stones;
    const rnd = mulberry32(1740);
    // the bed's axis from the wadi polyline near the stones
    const W = LAYOUT.wadi;
    let ax = 1, az = 0;
    for (let i = 0; i < W.length - 1; i++) {
      if (S.x >= W[i][0] && S.x <= W[i + 1][0]) {
        ax = W[i + 1][0] - W[i][0];
        az = W[i + 1][1] - W[i][1];
      }
    }
    const al = Math.hypot(ax, az);
    ax /= al;
    az /= al;
    const cx = -az, cz = ax; // across
    this.center.set(S.x, T.heightAt(S.x, S.z), S.z);
    const at = (u: number, v: number, out: THREE.Vector3) => {
      const x = S.x + ax * u + cx * v, z = S.z + az * u + cz * v;
      return out.set(x, T.heightAt(x, z), z);
    };
    // ---- the trickle: a narrow glossy ribbon of water winding down the bed's middle
    {
      const N = 48, L = 26;
      const pos: number[] = [], idx: number[] = [];
      const p = new THREE.Vector3();
      for (let i = 0; i <= N; i++) {
        const u = -L / 2 + (i / N) * L;
        const wv = Math.sin(u * 0.45 + 1.2) * 0.9 + Math.sin(u * 1.3) * 0.25;
        const w = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(u * 0.7 + 0.4));
        for (const s of [-1, 1]) {
          at(u, wv + s * w, p);
          pos.push(p.x, p.y + 0.012, p.z);
        }
        if (i < N) {
          const k = i * 2;
          idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const water = new THREE.MeshStandardMaterial({ color: 0x4d5a52, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.72, depthWrite: false });
      const m = new THREE.Mesh(g, water);
      m.renderOrder = 2;
      m.receiveShadow = true;
      m.name = 'trickle';
      this.group.add(m);
    }
    await yieldFrame();
    const trickleV = (u: number) => Math.sin(u * 0.45 + 1.2) * 0.9 + Math.sin(u * 1.3) * 0.25;
    // ---- the pebble field: every shape and size, many more angular / flat ones than worn round ones
    const shapes: { geo: THREE.BufferGeometry; mat: THREE.Material; n: number }[] = [
      { geo: pebbleShape(11, 0.1, 0.55, 1.2), mat: this.materials.rough, n: 160 },
      { geo: pebbleShape(23, 0.2, 0.35, 1.3), mat: this.materials.rough, n: 140 },
      { geo: pebbleShape(37, 0.45, 0.7, 1.05), mat: this.materials.rough, n: 120 },
      { geo: pebbleShape(51, 0.85, 0.62, 1.15), mat: this.materials.smooth, n: 70 },
    ];
    const m4 = this.tmpM;
    const q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (const sh of shapes) {
      sh.n = Math.max(20, Math.round(sh.n * this.density));
      const im = new THREE.InstancedMesh(sh.geo, sh.mat, sh.n);
      im.castShadow = false;
      im.receiveShadow = true;
      for (let i = 0; i < sh.n; i++) {
        const u = (rnd() - 0.5) * 26, v = trickleV(u) + (rnd() - 0.5) * 2 * (1.2 + rnd() * 2.6);
        at(u, v, p);
        const s = 0.012 + Math.pow(rnd(), 2.2) * 0.07;
        e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
        q.setFromEuler(e);
        sc.set(s, s, s);
        p.y += s * 0.25;
        m4.compose(p, q, sc);
        im.setMatrixAt(i, m4);
        this.tmpC.setHSL(0.09 + rnd() * 0.04, 0.12 + rnd() * 0.12, 0.62 + rnd() * 0.2);
        im.setColorAt(i, this.tmpC);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.group.add(im);
      this.meshes.push(im);
      await yieldFrame();
    }
    // ---- the candidates: sling-sized stones (5-7 cm), most of them not good enough
    const kinds: { kind: PebbleKind; n: number; geo: THREE.BufferGeometry[] }[] = [
      { kind: 'smooth', n: 9, geo: [pebbleShape(101, 1, 0.66, 1.18, 2), pebbleShape(113, 1, 0.74, 1.1, 2), pebbleShape(127, 1, 0.6, 1.25, 2)] },
      { kind: 'flat', n: 8, geo: [pebbleShape(203, 0.75, 0.3, 1.25, 2), pebbleShape(211, 0.6, 0.26, 1.35, 2)] },
      { kind: 'rough', n: 8, geo: [pebbleShape(307, 0.35, 0.7, 1.1, 2), pebbleShape(311, 0.3, 0.62, 1.15, 2)] },
      { kind: 'angular', n: 7, geo: [pebbleShape(401, 0.0, 0.6, 1.2, 2), pebbleShape(419, 0.05, 0.55, 1.05, 2)] },
    ];
    this.goodGeo.push(...kinds[0].geo);
    const used: THREE.Vector3[] = [];
    let wetN = 0;
    for (const k of kinds) {
      for (let gi = 0; gi < k.geo.length; gi++) {
        const n = Math.ceil(k.n / k.geo.length) - (gi === k.geo.length - 1 ? Math.ceil(k.n / k.geo.length) * k.geo.length - k.n : 0);
        if (n <= 0) continue;
        const wet = k.kind === 'smooth' && gi === 0;
        const mat = k.kind === 'smooth' ? (wet ? this.materials.wet : this.materials.smooth) : this.materials.rough;
        const im = new THREE.InstancedMesh(k.geo[gi], mat, n);
        im.castShadow = true;
        im.receiveShadow = true;
        for (let i = 0; i < n; i++) {
          // spread over the bed; the smooth ones mostly where the water has worked them (near the trickle)
          let pp: THREE.Vector3 | null = null;
          for (let tries = 0; tries < 40 && !pp; tries++) {
            const u = (rnd() - 0.5) * 22;
            const near = k.kind === 'smooth' ? (wet ? 0.25 : 1.2) : 3.2;
            const v = trickleV(u) + (rnd() - 0.5) * 2 * near + (wet ? 0 : (rnd() - 0.5) * 0.6);
            at(u, v, p);
            if (!this.colliders.free(p.x, p.z, 0.6)) continue;
            if (T.slopeAt(p.x, p.z) > 0.45) continue;
            if (used.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 0.75)) continue;
            pp = p.clone();
          }
          if (!pp) pp = at((rnd() - 0.5) * 18, (rnd() - 0.5) * 3, new THREE.Vector3());
          used.push(pp);
          const s = 0.028 + rnd() * 0.006; // ≈ 5.6-6.8 cm long
          e.set((rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.3);
          q.setFromEuler(e);
          sc.set(s, s, s);
          const y = pp.y + s * 0.42;
          m4.compose(p.set(pp.x, y, pp.z), q, sc);
          im.setMatrixAt(i, m4);
          this.tmpC.setHSL(0.09 + rnd() * 0.03, k.kind === 'smooth' ? 0.1 : 0.16, k.kind === 'smooth' ? 0.86 : 0.66 + rnd() * 0.12);
          im.setColorAt(i, this.tmpC);
          this.candidates.push({ kind: k.kind, pos: new THREE.Vector3(pp.x, y, pp.z), taken: false, mesh: im, index: i, wet, home: new THREE.Vector3(pp.x, y, pp.z), homeQ: q.clone(), homeS: s, moved: false });
          if (wet) wetN++;
        }
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.userData.kind = k.kind;
        this.group.add(im);
        this.meshes.push(im);
      }
      await yieldFrame();
    }
    void wetN;
  }

  /** the candidate he would examine: the nearest one within `reach` of `at`, preferring the one in front */
  nearest(at: THREE.Vector3, fwd: THREE.Vector3, reach = 1.5): Candidate | null {
    let best: Candidate | null = null, bs = Infinity;
    for (const c of this.candidates) {
      if (c.taken) continue;
      const dx = c.pos.x - at.x, dz = c.pos.z - at.z;
      const d = Math.hypot(dx, dz);
      if (d > reach) continue;
      const front = (dx * fwd.x + dz * fwd.z) / Math.max(1e-3, d);
      const score = d * (1.6 - 0.6 * front);
      if (score < bs) {
        bs = score;
        best = c;
      }
    }
    return best;
  }

  /** the nearest good stone still in the bed (the gentle hint) */
  nearestGood(at: THREE.Vector3): Candidate | null {
    let best: Candidate | null = null, bd = Infinity;
    for (const c of this.candidates) {
      if (c.taken || c.kind !== 'smooth') continue;
      const d = c.pos.distanceTo(at);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /** every stone back where it was (a restart of the chapter) */
  resetAll() {
    for (const c of this.candidates) {
      if (!c.taken && !c.moved) continue;
      c.taken = false;
      c.pos.copy(c.home);
      c.moved = false;
      this.tmpM.compose(c.home, c.homeQ, new THREE.Vector3(c.homeS, c.homeS, c.homeS));
      c.mesh.setMatrixAt(c.index, this.tmpM);
      c.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** hide a picked (or tossed) candidate */
  take(c: Candidate) {
    c.taken = true;
    this.tmpM.makeScale(0, 0, 0);
    c.mesh.setMatrixAt(c.index, this.tmpM);
    c.mesh.instanceMatrix.needsUpdate = true;
    if (this.glint?.c === c) this.glint = null;
  }

  /** put a tossed stone back down at p (it lies in the bed again; it can be examined again) */
  putBack(c: Candidate, p: THREE.Vector3) {
    c.taken = false;
    c.moved = true;
    c.pos.copy(p);
    const s = 0.03;
    this.tmpM.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 0.3, Math.random() * 6, 0)), new THREE.Vector3(s, s, s));
    c.mesh.setMatrixAt(c.index, this.tmpM);
    c.mesh.instanceMatrix.needsUpdate = true;
  }

  /** the geometry / material of a candidate (the stone in his hand) */
  look(c: Candidate) {
    return { geo: c.mesh.geometry, mat: c.mesh.material as THREE.Material, scale: 0.03 };
  }

  /** the subtle cue: a good stone within ~2.6 m catches the light (its colour brightens a little with a slow pulse) */
  update(near: THREE.Vector3 | null, time: number) {
    let target: Candidate | null = null;
    if (near) {
      const g = this.nearestGood(near);
      if (g && Math.hypot(g.pos.x - near.x, g.pos.z - near.z) < 2.6) target = g;
    }
    if (this.glint && this.glint.c !== target) {
      this.glint.c.mesh.setColorAt(this.glint.c.index, this.glint.base);
      if (this.glint.c.mesh.instanceColor) this.glint.c.mesh.instanceColor.needsUpdate = true;
      this.glint = null;
    }
    if (target) {
      if (!this.glint) {
        const base = new THREE.Color();
        target.mesh.getColorAt(target.index, base);
        this.glint = { c: target, base };
      }
      const k = 1.08 + 0.1 * (0.5 + 0.5 * Math.sin(time * 2.3));
      this.tmpC.copy(this.glint.base).multiplyScalar(k);
      target.mesh.setColorAt(target.index, this.tmpC);
      if (target.mesh.instanceColor) target.mesh.instanceColor.needsUpdate = true;
    }
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }
}

/** A tossed-back stone in flight (the rejected pebble): a few bounces, then it lies in the bed again */
export class TossedStone {
  readonly mesh: THREE.Mesh;
  private vel = new THREE.Vector3();
  private t = 0;
  done = false;
  onLand?: (p: THREE.Vector3) => void;
  private landed = false;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, from: THREE.Vector3, vel: THREE.Vector3, private ground: (x: number, z: number) => number) {
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.scale.setScalar(0.03);
    this.mesh.position.copy(from);
    this.vel.copy(vel);
    this.mesh.castShadow = true;
  }
  update(dt: number) {
    if (this.done) return;
    this.t += dt;
    this.vel.y -= 9.81 * dt;
    this.mesh.position.addScaledVector(this.vel, dt);
    this.mesh.rotation.x += dt * 9;
    this.mesh.rotation.z += dt * 6;
    const gy = this.ground(this.mesh.position.x, this.mesh.position.z) + 0.02;
    if (this.mesh.position.y < gy) {
      this.mesh.position.y = gy;
      if (!this.landed) {
        this.landed = true;
        this.onLand?.(this.mesh.position);
      }
      this.vel.multiplyScalar(0.3);
      this.vel.y = Math.abs(this.vel.y) * 0.35;
      if (this.vel.length() < 0.3 || this.t > 2) this.done = true;
    }
  }
}

/**
 * The chapter's small props: the stream bed of the five smooth stones (built lazily when the stones objective starts)
 * and the warm-up jars of the sling range (filled by the Range, src/gameplay/Range.ts). Nothing is built at boot.
 */
export class Props {
  readonly group = new THREE.Group();
  /** the range's clay jars (Range fills it; Story's staff can break them too) */
  readonly jars: Jar[] = [];
  readonly bed: StreamBed;
  private tossed: TossedStone[] = [];

  constructor(private terrain: Terrain, tex: TextureSet, colliders: Colliders) {
    this.bed = new StreamBed(terrain, tex, colliders);
    this.group.add(this.bed.group);
  }

  /** build the stream bed in small steps (call when the stones objective begins; idempotent) */
  buildBed(density = 1) {
    this.bed.density = density;
    return this.bed.build(nextFrame);
  }

  /** toss a rejected stone back into the bed */
  toss(geo: THREE.BufferGeometry, mat: THREE.Material, from: THREE.Vector3, vel: THREE.Vector3, onLand?: (p: THREE.Vector3) => void) {
    const t = new TossedStone(geo, mat, from, vel, (x, z) => this.terrain.heightAt(x, z));
    t.onLand = onLand;
    this.group.add(t.mesh);
    this.tossed.push(t);
    return t;
  }

  reset() {
    for (const j of this.jars) j.reset();
    this.bed.resetAll();
  }

  update(dt: number) {
    for (const j of this.jars) j.update(dt);
    for (let i = this.tossed.length - 1; i >= 0; i--) {
      const t = this.tossed[i];
      t.update(dt);
      if (t.done) {
        this.group.remove(t.mesh);
        this.tossed.splice(i, 1);
      }
    }
  }
}
