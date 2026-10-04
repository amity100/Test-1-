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
/** one smooth stone he can pick up (gameplay v2.1: every one of them is a good one) */
export interface Candidate {
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
}

/** a soft four-pointed star of light (the sun on a wet, polished stone) */
let _glintTex: THREE.Texture | null = null;
function glintTexture() {
  if (_glintTex) return _glintTex;
  // (w4) built from numbers (no 2D canvas: a first canvas context can cost tens of ms on some devices): a soft round
  // core and four thin rays, white with the alpha carrying the shape
  const n = 32, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = ((x + 0.5) / n) * 2 - 1, dy = ((y + 0.5) / n) * 2 - 1, r = Math.hypot(dx, dy);
      let a = r < 0.24 ? 1 - (r / 0.24) * 0.08 : r < 0.46 ? 0.92 - ((r - 0.24) / 0.22) * 0.56 : Math.max(0, 0.36 * (1 - (r - 0.46) / 0.54));
      const ray = Math.max(0, 1 - (Math.abs(dx) * n) / 2.2, 1 - (Math.abs(dy) * n) / 2.2) * Math.max(0, 1 - r);
      a = Math.min(1, a + ray * 0.75);
      const k = (y * n + x) * 4;
      d[k] = 255;
      d[k + 1] = 250;
      d[k + 2] = 236;
      d[k + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  _glintTex = t;
  return t;
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
 * of pebbles of every shape along the wadi (instanced scenery), a thin trickle down its middle, and on it ten smooth,
 * polished sling stones spread along the whole stretch (gameplay v2.1: every stone he can take is a good one), the
 * ones at the water's edge wet and glossy. No beacons: the sun glints softly on the nearest ones.
 */
export class StreamBed {
  readonly group = new THREE.Group();
  readonly candidates: Candidate[] = [];
  /** the bed's axis (world): centre, along, across */
  readonly center = new THREE.Vector3();
  private glint: { c: Candidate; base: THREE.Color } | null = null;
  private glints: THREE.Sprite[] = [];
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
      // water-worn limestone / flint pebbles: pale, polished, a soft sheen
      smooth: new THREE.MeshStandardMaterial({ color: 0xf8f3e8, roughness: 0.2, metalness: 0, emissive: 0x2e2a22, emissiveIntensity: 0.4 }),
      // wet: at the water's edge, a little darker and glossy
      wet: new THREE.MeshStandardMaterial({ color: 0xe2d8c4, roughness: 0.08, metalness: 0.02, emissive: 0x2a261e, emissiveIntensity: 0.35 }),
      rough: new THREE.MeshStandardMaterial({ color: 0xd2c6b0, roughness: 0.9, metalness: 0 }),
    };
  }

  /** pebbles in the field: 1 on desktop, fewer on phones */
  density = 1;
  /** main-thread ms of each build step */
  readonly stepMs: number[] = [];
  /** build in small steps (a frame between them): ~1-3 ms each */
  async build(yieldFrame0: () => Promise<void>) {
    if (this.built) return;
    this.built = true;
    let t0 = performance.now();
    const yieldFrame = async () => {
      this.stepMs.push(+(performance.now() - t0).toFixed(1));
      await yieldFrame0();
      t0 = performance.now();
    };
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
    const at = (u: number, v: number, out: THREE.Vector3) => {
      const x = S.x + ax * u + cx * v, z = S.z + az * u + cz * v;
      return out.set(x, T.heightAt(x, z), z);
    };
    // (w4) the wadi's floor — the grass-free band of gravel (the terrain's wadi mask) — wanders a few metres off the
    // polyline (its noise) and lies ≈7 m south of the layout's point: find its middle every metre along the bed (the
    // median of the clear cells across it), smoothed; the trickle and the stones lie on it, clear of the bank's grass
    const floor: number[] = [];
    for (let k = 0; k <= 32; k++) {
      const u = k - 16, ok: number[] = [];
      for (let v = -8; v <= 22; v += 0.5) {
        const m = T.maskAt(S.x + ax * u + cx * v, S.z + az * u + cz * v);
        if (m.wadi > 0.85 && m.grass < 0.08) ok.push(v);
      }
      floor.push(ok.length ? ok[ok.length >> 1] : NaN);
    }
    const valid = floor.map((f, k) => (Number.isNaN(f) ? -1 : k)).filter((k) => k >= 0);
    for (let k = 0; k < floor.length; k++) {
      if (!Number.isNaN(floor[k])) continue;
      let best = -1;
      for (const j of valid) if (best < 0 || Math.abs(j - k) < Math.abs(best - k)) best = j;
      floor[k] = best >= 0 ? floor[best] : 0;
    }
    const sm = floor.map((_, k) => {
      let sum = 0, w = 0;
      for (let j = -3; j <= 3; j++) {
        const i = Math.min(floor.length - 1, Math.max(0, k + j)), ww = 4 - Math.abs(j);
        sum += floor[i] * ww;
        w += ww;
      }
      return sum / w;
    });
    const floorV = (u: number) => {
      const f = Math.min(31.999, Math.max(0, u + 16)), k = Math.floor(f), t = f - k;
      return sm[k] * (1 - t) + sm[k + 1] * t;
    };
    const trickleV = (u: number) => floorV(u) + Math.sin(u * 0.45 + 1.2) * 0.9 + Math.sin(u * 1.3) * 0.25;
    at(0, floorV(0), this.center);
    // ---- the trickle: a narrow glossy ribbon of water winding down the bed's middle
    {
      const N = 48, L = 26;
      const pos: number[] = [], idx: number[] = [];
      const p = new THREE.Vector3();
      for (let i = 0; i <= N; i++) {
        const u = -L / 2 + (i / N) * L;
        const wv = trickleV(u);
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
    // ---- the pebble field: every shape and size, many more angular / flat ones than worn round ones
    const shapes: { geo: THREE.BufferGeometry; mat: THREE.Material; n: number }[] = [
      { geo: pebbleShape(11, 0.1, 0.55, 1.2), mat: this.materials.rough, n: 160 },
      { geo: pebbleShape(23, 0.2, 0.35, 1.3), mat: this.materials.rough, n: 140 },
      { geo: pebbleShape(37, 0.45, 0.7, 1.05), mat: this.materials.rough, n: 120 },
      { geo: pebbleShape(51, 0.85, 0.62, 1.15), mat: this.materials.rough, n: 70 },
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
        const s = 0.01 + Math.pow(rnd(), 2.4) * 0.024;
        e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
        q.setFromEuler(e);
        sc.set(s, s, s);
        p.y += s * 0.25;
        m4.compose(p, q, sc);
        im.setMatrixAt(i, m4);
        this.tmpC.setHSL(0.08 + rnd() * 0.04, 0.14 + rnd() * 0.12, 0.5 + rnd() * 0.2);
        im.setColorAt(i, this.tmpC);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.group.add(im);
      this.meshes.push(im);
      await yieldFrame();
    }
    // ---- the stones he can take (gameplay v2.1): EVERY one a good one — ten smooth, water-worn sling stones (≈8-11 cm,
    // a little larger, paler and more polished than the gravel), spread along the whole stretch of the bed and its
    // edges, a few metres apart, on top of the gravel, at the water's edge (wet and glossy) or up at the bed's edge
    const geos = [pebbleShape(101, 1, 0.66, 1.18, 2), pebbleShape(113, 1, 0.74, 1.1, 2), pebbleShape(127, 1, 0.6, 1.25, 2)];
    this.goodGeo.push(...geos);
    await yieldFrame();
    // [along the bed (m), side of the water (-1 / 1), where: 0 the water's edge, 1 the gravel, 2 the bed's edge]
    const spots: [number, number, number][] = [
      [-11.4, 1, 1], [-9.2, -1, 0], [-6.9, 1, 2], [-4.6, -1, 1], [-2.3, 1, 0], [0.1, -1, 2], [2.4, 1, 1], [4.8, -1, 0], [7.2, 1, 2], [9.6, -1, 1],
    ];
    const used: THREE.Vector3[] = [];
    const placed: { pp: THREE.Vector3; g: number; wet: boolean; s: number; q: THREE.Quaternion }[] = [];
    for (let i = 0; i < spots.length; i++) {
      const [u0, side, where] = spots[i];
      const off = where === 0 ? 0.42 : where === 1 ? 1.25 : 2.6;
      let pp: THREE.Vector3 | null = null;
      for (let tries = 0; tries < 30 && !pp; tries++) {
        const u = u0 + (rnd() - 0.5) * 1.2;
        const v = trickleV(u) + side * (off + (rnd() - 0.5) * (where === 0 ? 0.12 : 0.5));
        at(u, v, p);
        // the cheap tests first (the colliders' query is the dear one)
        if (T.maskAt(p.x, p.z).grass > 0.06) continue; // never hidden in the bank's grass
        if (T.slopeAt(p.x, p.z) > 0.5) continue;
        if (used.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 1.4)) continue;
        if (!this.colliders.free(p.x, p.z, 0.5)) continue;
        pp = p.clone();
      }
      if (!pp) pp = at(u0, trickleV(u0) + side * off, new THREE.Vector3());
      used.push(pp);
      const s = 0.039 + rnd() * 0.005;
      e.set((rnd() - 0.5) * 0.25, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.25);
      placed.push({ pp, g: i % geos.length, wet: where === 0, s, q: new THREE.Quaternion().setFromEuler(e) });
      if (i % 3 === 2) await yieldFrame(); // the spot search in small steps (the terrain's tests are not free)
    }
    await yieldFrame();
    for (const wet of [false, true]) {
      for (let g = 0; g < geos.length; g++) {
        const here = placed.filter((x) => x.wet === wet && x.g === g);
        if (!here.length) continue;
        const im = new THREE.InstancedMesh(geos[g], wet ? this.materials.wet : this.materials.smooth, here.length);
        im.castShadow = true;
        im.receiveShadow = true;
        here.forEach((x, i) => {
          // lying on the gravel, a good part of it showing
          const y = x.pp.y + x.s * 0.5;
          m4.compose(p.set(x.pp.x, y, x.pp.z), x.q, sc.set(x.s, x.s, x.s));
          im.setMatrixAt(i, m4);
          this.tmpC.setHSL(0.1 + rnd() * 0.025, 0.08, wet ? 0.8 : 0.9);
          im.setColorAt(i, this.tmpC);
          this.candidates.push({ pos: new THREE.Vector3(x.pp.x, y, x.pp.z), taken: false, mesh: im, index: i, wet, home: new THREE.Vector3(x.pp.x, y, x.pp.z), homeQ: x.q.clone(), homeS: x.s });
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        this.group.add(im);
        this.meshes.push(im);
      }
    }
    // the sun's glint on the nearest ones (a soft star that comes and goes; never a beacon)
    this.glints = Array.from({ length: 3 }, () => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color: 0xfff6e0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      sp.scale.setScalar(0.11);
      sp.visible = false;
      this.group.add(sp);
      return sp;
    });
    await yieldFrame();
  }

  /** the stone he would take: the nearest one within `reach` of `at`, in any facing (gameplay v2.1: ≈1.8 m) */
  nearest(at: THREE.Vector3, reach = 1.8): Candidate | null {
    let best: Candidate | null = null, bd = reach;
    for (const c of this.candidates) {
      if (c.taken) continue;
      const d = Math.hypot(c.pos.x - at.x, c.pos.z - at.z);
      if (d <= bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /** the nearest stone still in the bed, at any distance (the gentle pointer, the glints) */
  nearestStone(at: THREE.Vector3): Candidate | null {
    let best: Candidate | null = null, bd = Infinity;
    for (const c of this.candidates) {
      if (c.taken) continue;
      const d = Math.hypot(c.pos.x - at.x, c.pos.z - at.z);
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
      if (!c.taken) continue;
      c.taken = false;
      c.pos.copy(c.home);
      this.tmpM.compose(c.home, c.homeQ, new THREE.Vector3(c.homeS, c.homeS, c.homeS));
      c.mesh.setMatrixAt(c.index, this.tmpM);
      c.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** hide a picked stone */
  take(c: Candidate) {
    c.taken = true;
    this.tmpM.makeScale(0, 0, 0);
    c.mesh.setMatrixAt(c.index, this.tmpM);
    c.mesh.instanceMatrix.needsUpdate = true;
    if (this.glint?.c === c) this.glint = null;
  }

  /** the geometry / material of a candidate (the stone in his hand) */
  look(c: Candidate) {
    return { geo: c.mesh.geometry, mat: c.mesh.material as THREE.Material, scale: c.homeS };
  }

  /**
   * The soft cues: the sun glints on the three stones nearest to him within 14 m (a small star that comes and goes, each
   * at its own pace; its size grows a little with the distance from the eye so it still reads from 8-12 m on a small
   * screen); the very nearest within 2.6 m brightens a little with a slow pulse.
   */
  update(near: THREE.Vector3 | null, time: number, eye: THREE.Vector3 | null = null) {
    let target: Candidate | null = null;
    if (near) {
      const g = this.nearestStone(near);
      if (g && Math.hypot(g.pos.x - near.x, g.pos.z - near.z) < 2.6) target = g;
    }
    if (this.glints.length) {
      const free = near ? this.candidates.filter((c) => !c.taken && Math.hypot(c.pos.x - near.x, c.pos.z - near.z) < 14) : [];
      if (near) free.sort((a, b) => Math.hypot(a.pos.x - near.x, a.pos.z - near.z) - Math.hypot(b.pos.x - near.x, b.pos.z - near.z));
      this.glints.forEach((sp, i) => {
        const c = free[i];
        sp.visible = !!c;
        if (!c) return;
        sp.position.set(c.pos.x, c.pos.y + c.homeS * 0.6, c.pos.z);
        const ph = time * (1.3 + i * 0.37) + c.index * 2.1 + i * 1.7;
        // a slow swell with a quicker sparkle on top: never quite gone, never a steady beacon
        const tw = Math.pow(0.5 + 0.5 * Math.sin(ph), 2) * (0.75 + 0.25 * Math.sin(ph * 3.1 + 0.6));
        const d = eye ? eye.distanceTo(sp.position) : Math.hypot(c.pos.x - near!.x, c.pos.z - near!.z) + 3;
        // a little toward the eye, so the gravel round the stone does not clip the star's lower half
        if (eye) sp.position.lerp(eye, Math.min(0.2, 0.25 / Math.max(d, 0.5)));
        (sp.material as THREE.SpriteMaterial).opacity = 0.4 + 0.6 * tw;
        sp.scale.setScalar(THREE.MathUtils.clamp(d * 0.026, 0.12, 0.42) * (0.7 + 0.45 * tw));
      });
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

/**
 * The chapter's small props: the stream bed of the five smooth stones (built lazily when the stones objective starts)
 * and the warm-up jars of the sling range (filled by the Range, src/gameplay/Range.ts). Nothing is built at boot.
 */
export class Props {
  readonly group = new THREE.Group();
  /** the range's clay jars (Range fills it; Story's staff can break them too) */
  readonly jars: Jar[] = [];
  readonly bed: StreamBed;

  constructor(private terrain: Terrain, tex: TextureSet, colliders: Colliders) {
    this.bed = new StreamBed(terrain, tex, colliders);
    this.group.add(this.bed.group);
  }

  /** build the stream bed in small steps (call when the stones objective begins; idempotent) */
  buildBed(density = 1) {
    this.bed.density = density;
    return this.bed.build(nextFrame);
  }

  reset() {
    for (const j of this.jars) j.reset();
    this.bed.resetAll();
  }

  update(dt: number) {
    for (const j of this.jars) j.update(dt);
  }
}
