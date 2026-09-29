import * as THREE from 'three';
import { noise1, rng, TAU } from './loft';
import { solidMaterial, type TexPair, type Tier } from './materials';
import type { Prop } from './Outfit';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merge the rigid child meshes of a prop that share a material into one mesh each (fewer draw calls on phones).
 * Non-mesh children (grip / tip / butt frames, cord anchors) are kept as they are.
 */
export function mergeStatic<T extends THREE.Object3D>(group: T): T {
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  for (const c of [...group.children]) {
    const m = c as THREE.Mesh;
    if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || m.children.length || Array.isArray(m.material)) continue;
    const l = byMat.get(m.material) ?? [];
    l.push(m);
    byMat.set(m.material, l);
  }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      m.updateMatrix();
      let g = m.geometry.clone().applyMatrix4(m.matrix);
      if (!g.index) g = g.toNonIndexed();
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
      return g.index ? g : g;
    });
    const indexed = geos.every((g) => g.index);
    const merged = mergeGeometries(indexed ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = list[0].name;
    mesh.castShadow = list.some((m) => m.castShadow);
    mesh.receiveShadow = list.some((m) => m.receiveShadow);
    for (const m of list) {
      group.remove(m);
      m.geometry.dispose();
    }
    group.add(mesh);
  }
  return group;
}

/*
 * Hand props and weapons, all procedural (rest frame: +Y along the shaft / blade, origin at the butt / hilt).
 * Iron Age Levant references (docs/sources.md 4.4): socketed leaf-shaped spear heads with a midrib, butt spikes
 * (1 Sam 26:7 "stuck in the ground"), straight double-edged swords with a flat pommel in leather scabbards with
 * a metal chape, round / oval leather shields on a wooden rim with a boss, slings of braided cord with a leather
 * cradle, a gnarled shepherd's staff (maqel).
 */

function lathe(profile: (t: number) => number, path: (t: number, out: THREE.Vector3) => THREE.Vector3, rows: number, radial: number, opts: { uLen?: number; bumps?: (t: number, a: number) => number; capTop?: boolean; capBottom?: boolean } = {}) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3(), t3 = new THREE.Vector3(), u = new THREE.Vector3(1, 0, 0), v = new THREE.Vector3();
  let along = 0;
  const prev = new THREE.Vector3();
  const ring = radial + 1;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    path(t, p);
    path(Math.min(1, t + 1e-3), q);
    path(Math.max(0, t - 1e-3), t3);
    const tan = q.clone().sub(t3).normalize();
    u.addScaledVector(tan, -u.dot(tan));
    if (u.lengthSq() < 1e-6) u.set(0, 0, 1).addScaledVector(tan, -tan.z);
    u.normalize();
    v.crossVectors(tan, u);
    if (i > 0) along += p.distanceTo(prev);
    prev.copy(p);
    const r0 = profile(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const r = r0 + (opts.bumps ? opts.bumps(t, a) : 0);
      const c = Math.cos(a), s = Math.sin(a);
      pos.push(p.x + (u.x * c + v.x * s) * r, p.y + (u.y * c + v.y * s) * r, p.z + (u.z * c + v.z * s) * r);
      uv.push(j / radial, along);
      if (i < rows && j < radial) {
        const k = i * ring + j;
        idx.push(k, k + 1, k + ring, k + 1, k + ring + 1, k + ring);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function frameAt(parent: THREE.Object3D, name: string, pos: THREE.Vector3, dir: THREE.Vector3) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.copy(pos);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  parent.add(o);
  return o;
}

// ------------------------------------------------------------------------------------------ staff (maqel)
export function makeStaff(tier: Tier, wood: TexPair, bark: TexPair, o: { length?: number; gripAt?: number; seed?: number } = {}): Prop {
  const L = o.length ?? 1.75;
  const gripAt = o.gripAt ?? 1.18;
  const seed = o.seed ?? 5;
  const nx = noise1(seed), nz = noise1(seed + 1), nr = noise1(seed + 2);
  const r = rng(seed + 3);
  // crooked, but straighter around the grip (the hand has worn it true)
  const path = (t: number, out: THREE.Vector3) => {
    const y = t * L;
    const g = 1 - 0.6 * Math.exp(-(((y - gripAt) / 0.25) ** 2));
    const x = ((nx(t * 3.2) - 0.5) * 0.07 + (nx(t * 11 + 7) - 0.5) * 0.014) * g + Math.sin(t * 2.4 + 0.5) * 0.012;
    const z = ((nz(t * 2.7) - 0.5) * 0.06 + (nz(t * 13 + 3) - 0.5) * 0.012) * g;
    return out.set(x, y, z);
  };
  const knots = Array.from({ length: 9 }, () => ({ t: 0.05 + r() * 0.9, a: r() * TAU, s: 0.004 + r() * 0.005, w: 0.012 + r() * 0.012 }));
  const profile = (t: number) => {
    const y = t * L;
    let rad = 0.0165 + 0.0035 * t + (nr(t * 7) - 0.5) * 0.003;
    // rounded, worn ends; a gnarled knob at the top
    rad += 0.006 * Math.exp(-(((L - y) / 0.05) ** 2));
    const endT = Math.min(y, L - y) / 0.02;
    if (endT < 1) rad *= Math.sqrt(Math.max(0.05, 1 - (1 - endT) ** 2));
    return rad;
  };
  const bumps = (t: number, a: number) => {
    let b = 0;
    for (const k of knots) {
      const d = (t - k.t) * L;
      const ang = Math.cos(a - k.a);
      b += k.s * Math.exp(-((d / k.w) ** 2)) * (0.35 + 0.65 * Math.max(0, ang) ** 2);
    }
    // fine gnarl ridges along the length
    b += 0.0009 * Math.sin(a * 5 + t * 40) * (1 - Math.exp(-(((t * L - gripAt) / 0.12) ** 2)));
    return b;
  };
  const rows = tier === 'low' ? 90 : 180, radial = tier === 'low' ? 8 : 14;
  const geo = lathe(profile, path, rows, radial, { bumps });
  const mat = solidMaterial({
    tier, tex: wood, color: 0xa88a6a, roughness: 0.62, repeat: [1, 1 / 0.3], normal: 0.8, sheen: tier === 'low' ? 0 : 0.15,
    bark: { tex: bark, amount: 0.85, smooth: [gripAt - 0.14, gripAt + 0.12] },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'staff';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // a few branch stubs at knots
  const stubs: THREE.BufferGeometry[] = [];
  for (const k of knots.slice(0, 3)) {
    const p = path(k.t, new THREE.Vector3());
    const dir = new THREE.Vector3(Math.cos(k.a), 0.6, Math.sin(k.a)).normalize();
    const cone = new THREE.CylinderGeometry(0.004, 0.009, 0.03, 7, 1);
    cone.translate(0, 0.012, 0);
    cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    cone.translate(p.x + dir.x * 0.012, p.y, p.z + dir.z * 0.012);
    stubs.push(cone);
  }
  const group = new THREE.Group();
  group.name = 'staff';
  group.add(mesh);
  for (const s of stubs) {
    const m = new THREE.Mesh(s, mat);
    m.castShadow = true;
    group.add(m);
  }
  const P = (t: number) => path(t, new THREE.Vector3());
  const tg = gripAt / L;
  const dirAt = (t: number) => P(Math.min(1, t + 0.01)).sub(P(Math.max(0, t - 0.01))).normalize();
  const grip = frameAt(group, 'grip', P(tg), dirAt(tg));
  const tip = frameAt(group, 'tip', P(1), dirAt(1));
  const butt = frameAt(group, 'butt', P(0), dirAt(0));
  group.userData.radiusAtGrip = profile(tg);
  mergeStatic(group);
  return { object: group, grip, tip, butt };
}

// ------------------------------------------------------------------------------------------ sling (qela')
/** Leather cradle; children 'cordA' / 'cordB' = where the two cords attach (x = ∓half length). Cupped toward -Y. */
export function makeSlingPouch(tier: Tier, leather: TexPair): THREE.Object3D {
  const Lh = 0.045, Wh = 0.027;
  const nu = tier === 'low' ? 10 : 18, nv = tier === 'low' ? 6 : 10;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nu; i++) {
    const s = (i / nu) * 2 - 1; // along
    const halfW = Wh * Math.sqrt(Math.max(0, 1 - s * s)) * (0.55 + 0.45 * Math.cos(s * 1.2)) + 0.004;
    for (let j = 0; j <= nv; j++) {
      const w = (j / nv) * 2 - 1;
      const x = s * Lh, z = w * halfW;
      const cup = -0.014 * (1 - s * s) * (1 - w * w * 0.8);
      pos.push(x, cup, z);
      uv.push(x * 6 + 0.5, z * 6 + 0.5);
      if (i < nu && j < nv) {
        const k = i * (nv + 1) + j;
        idx.push(k, k + 1, k + nv + 1, k + 1, k + nv + 2, k + nv + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = solidMaterial({ tier, tex: leather, color: 0x6e4a2e, roughness: 0.7, repeat: [1, 1], normal: 1.2 });
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.name = 'slingPouch';
  // thickness: a second, slightly offset layer
  const back = new THREE.Mesh(g.clone(), mat);
  back.position.y = -0.0025;
  const grp = new THREE.Group();
  grp.name = 'slingPouch';
  grp.add(m, back);
  mergeStatic(grp);
  for (const [n, x] of [['cordA', -Lh - 0.002], ['cordB', Lh + 0.002]] as const) {
    const o = new THREE.Object3D();
    o.name = n;
    o.position.set(x, 0.002, 0);
    grp.add(o);
  }
  return grp;
}

/** Braided cord material for Rope.ts tubes (uv.x around 0..1, uv.y 0..1 along): repeat 60 along ≈ 0.75 m cord. */
export function slingCordMaterial(tier: Tier, braid: TexPair) {
  return solidMaterial({ tier, tex: braid, color: 0x6a4a2c, roughness: 0.82, repeat: [1, 60], normal: 1.4, sheen: tier === 'low' ? 0 : 0.3 });
}

// ------------------------------------------------------------------------------------------ spear (hanit)
export function makeSpear(tier: Tier, wood: TexPair, metal: TexPair, leather: TexPair, o: { length?: number; head?: number; gripAt?: number; bronzeButt?: boolean; seed?: number; shaftColor?: number } = {}): Prop {
  const L = o.length ?? 2.45;
  const headL = o.head ?? 0.3;
  const buttL = 0.12;
  const gripAt = o.gripAt ?? 1.25;
  const group = new THREE.Group();
  group.name = 'spear';
  const radial = tier === 'low' ? 8 : 12;
  // shaft (ash/oak), slightly tapered, from the butt socket to the head socket
  const shaftL = L - headL - buttL + 0.08;
  const shaft = lathe(
    (t) => 0.0145 - 0.0025 * t,
    (t, out) => out.set(0, buttL - 0.04 + t * shaftL, 0),
    tier === 'low' ? 12 : 30,
    radial,
  );
  const woodMat = solidMaterial({ tier, tex: wood, color: o.shaftColor ?? 0xb09070, roughness: 0.55, repeat: [1, 1 / 0.35], normal: 0.5 });
  const sm = new THREE.Mesh(shaft, woodMat);
  sm.castShadow = true;
  group.add(sm);
  // leather grip binding
  const bind = lathe((t) => 0.0158 + 0.0006 * Math.sin(t * 60), (t, out) => out.set(0, gripAt - 0.1 + t * 0.2, 0), 24, radial);
  const leatherMat = solidMaterial({ tier, tex: leather, color: 0x4d3322, roughness: 0.7, repeat: [2, 8] });
  const bm = new THREE.Mesh(bind, leatherMat);
  bm.castShadow = true;
  group.add(bm);
  // iron head: socket + leaf blade with a midrib (lozenge section)
  const iron = solidMaterial({ tier, tex: metal, color: 0x5c5a57, roughness: 0.45, metalness: 1, repeat: [1, 3], metalWear: { patina: 0x4a3526, amount: 0.55, edgeBright: 0.8 } });
  const y0 = L - headL;
  const sock = lathe((t) => 0.0135 - 0.004 * t + 0.0015 * Math.exp(-((t / 0.08) ** 2)), (t, out) => out.set(0, y0 - 0.02 + t * 0.1, 0), 10, radial);
  const skm = new THREE.Mesh(sock, iron);
  skm.castShadow = true;
  group.add(skm);
  const blade = new THREE.BufferGeometry();
  {
    const n = tier === 'low' ? 10 : 22;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const bl = headL - 0.07;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = 0.028 * Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 - 0.15 * t) + 0.0015; // leaf shape, widest ~1/3
      const th = 0.0055 * (1 - t * 0.85) + 0.0008; // midrib thickness
      const y = y0 + 0.07 + t * bl;
      // lozenge section: left edge, front rib, right edge, back rib
      pos.push(-w, y, 0, 0, y, th, w, y, 0, 0, y, -th);
      uv.push(0, t, 0.5, t, 1, t, 0.5, t);
      if (i < n) {
        const k = i * 4;
        for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) idx.push(k + a, k + b, k + 4 + a, k + b, k + 4 + b, k + 4 + a);
      }
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blade.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    blade.setIndex(idx);
    blade.computeVertexNormals();
  }
  const blm = new THREE.Mesh(blade, iron);
  blm.castShadow = true;
  group.add(blm);
  // butt spike (so it can be stuck upright in the ground, 1 Sam 26:7)
  const buttMat = o.bronzeButt ? solidMaterial({ tier, tex: metal, color: 0xa87a45, roughness: 0.4, metalness: 1, repeat: [1, 2], metalWear: { patina: 0x3f5a48, amount: 0.5, edgeBright: 0.6 } }) : iron;
  const butt = lathe((t) => 0.0025 + 0.0115 * Math.pow(t, 0.7), (t, out) => out.set(0, t * buttL, 0), 12, radial);
  const bum = new THREE.Mesh(butt, buttMat);
  bum.castShadow = true;
  group.add(bum);
  const grip = frameAt(group, 'grip', new THREE.Vector3(0, gripAt, 0), new THREE.Vector3(0, 1, 0));
  const tip = frameAt(group, 'tip', new THREE.Vector3(0, L, 0), new THREE.Vector3(0, 1, 0));
  const buttF = frameAt(group, 'butt', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
  group.userData.radiusAtGrip = 0.0158;
  mergeStatic(group);
  return { object: group, grip, tip, butt: buttF };
}

// ------------------------------------------------------------------------------------------ sword (herev) in scabbard
/** Straight double-edged sword in a leather scabbard with a bronze chape. +Y = toward the hilt, origin = scabbard mouth. */
export function makeSword(tier: Tier, leather: TexPair, metal: TexPair, wood: TexPair, o: { blade?: number; gold?: boolean } = {}): THREE.Object3D {
  const bl = o.blade ?? 0.62;
  const g = new THREE.Group();
  g.name = 'sword';
  const radial = tier === 'low' ? 8 : 12;
  const leatherMat = solidMaterial({ tier, tex: leather, color: 0x3b2618, roughness: 0.6, repeat: [1, 4], normal: 1 });
  // scabbard: flattened lathe (lens section) from the mouth (y=0) down to the tip
  const scab = lathe((t) => 0.026 * (1 - 0.55 * t * t) + 0.004, (t, out) => out.set(0, -t * (bl + 0.02), 0), tier === 'low' ? 10 : 24, radial);
  scab.scale(1, 1, 0.32);
  const sm = new THREE.Mesh(scab, leatherMat);
  sm.castShadow = true;
  g.add(sm);
  const bronze = solidMaterial({ tier, tex: metal, color: o.gold ? 0xd4a64a : 0xa8783f, roughness: 0.35, metalness: 1, repeat: [1, 2], metalWear: { patina: o.gold ? 0x7a5a2a : 0x3e5646, amount: o.gold ? 0.2 : 0.45, edgeBright: 0.7 } });
  // chape + mouth locket
  const chape = lathe((t) => 0.0125 * (1 - t * 0.8) + 0.002, (t, out) => out.set(0, -(bl + 0.02) + 0.09 - t * 0.09, 0), 8, radial);
  chape.scale(1.25, 1, 0.45);
  const cm = new THREE.Mesh(chape, bronze);
  g.add(cm);
  const lock = lathe(() => 0.031, (t, out) => out.set(0, -0.035 + t * 0.035, 0), 2, radial);
  lock.scale(1, 1, 0.35);
  g.add(new THREE.Mesh(lock, bronze));
  // hilt: guard, wooden grip, crescent pommel
  const guard = new THREE.BoxGeometry(0.075, 0.016, 0.022, 1, 1, 1);
  guard.translate(0, 0.008, 0);
  g.add(new THREE.Mesh(guard, bronze));
  const woodMat = solidMaterial({ tier, tex: wood, color: 0x6b4a33, roughness: 0.5, repeat: [1, 4] });
  const grip = lathe((t) => 0.0135 + 0.002 * Math.sin(t * Math.PI), (t, out) => out.set(0, 0.016 + t * 0.095, 0), 8, radial);
  grip.scale(1, 1, 0.8);
  g.add(new THREE.Mesh(grip, woodMat));
  const pommel = new THREE.SphereGeometry(0.022, radial, 6, 0, TAU, 0, Math.PI / 2);
  pommel.scale(1.3, 0.6, 0.7);
  pommel.translate(0, 0.111, 0);
  g.add(new THREE.Mesh(pommel, bronze));
  g.traverse((c) => ((c as THREE.Mesh).isMesh ? ((c as THREE.Mesh).castShadow = true) : null));
  mergeStatic(g);
  return g;
}

/** Short dagger in a sheath (same conventions as makeSword). */
export function makeDagger(tier: Tier, leather: TexPair, metal: TexPair, wood: TexPair) {
  const d = makeSword(tier, leather, metal, wood, { blade: 0.24 });
  d.name = 'dagger';
  return d;
}

// ------------------------------------------------------------------------------------------ shield (magen)
/** Round (or oval) leather shield on a wooden rim with a central boss; origin = grip, +Z = face (outward). */
export function makeShield(tier: Tier, leather: TexPair, metal: TexPair, wood: TexPair, o: { radius?: number; oval?: number; boss?: 'bronze' | 'leather'; seed?: number } = {}): THREE.Object3D {
  const R = o.radius ?? 0.3;
  const oval = o.oval ?? 1;
  const g = new THREE.Group();
  g.name = 'shield';
  const seg = tier === 'low' ? 24 : 48;
  const rings = tier === 'low' ? 5 : 10;
  // slightly domed disc (+Z convex)
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const nr = noise1(o.seed ?? 3);
  for (let i = 0; i <= rings; i++) {
    const rr = (i / rings) * R;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      const wob = 1 + (nr(a * 3) - 0.5) * 0.02 * (i / rings);
      const x = Math.cos(a) * rr * wob, y = Math.sin(a) * rr * oval * wob;
      const z = 0.05 * (1 - (rr / R) ** 2);
      pos.push(x, y, z);
      uv.push(x / (2 * R) + 0.5, y / (2 * R) + 0.5);
      if (i < rings && j < seg) {
        const k = i * (seg + 1) + j;
        idx.push(k, k + seg + 1, k + 1, k + 1, k + seg + 1, k + seg + 2);
      }
    }
  }
  const disc = new THREE.BufferGeometry();
  disc.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  disc.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  disc.setIndex(idx);
  disc.computeVertexNormals();
  const hide = solidMaterial({ tier, tex: leather, color: 0x8a6440, roughness: 0.5, repeat: [2.5, 2.5], normal: 1.3, sheen: tier === 'low' ? 0 : 0.2 }); // oiled hide (2 Sam 1:21)
  hide.side = THREE.DoubleSide;
  g.add(new THREE.Mesh(disc, hide));
  // wooden / wicker rim
  const woodMat = solidMaterial({ tier, tex: wood, color: 0x7a5a3c, roughness: 0.6, repeat: [1, 6] });
  const rimPts: THREE.Vector3[] = [];
  for (let j = 0; j < seg; j++) {
    const a = (j / seg) * TAU;
    const wob = 1 + (nr(a * 3) - 0.5) * 0.02;
    rimPts.push(new THREE.Vector3(Math.cos(a) * R * wob, Math.sin(a) * R * oval * wob, 0.002));
  }
  const rimCurve = new THREE.CatmullRomCurve3(rimPts, true);
  const rim = new THREE.TubeGeometry(rimCurve, seg, 0.012, tier === 'low' ? 5 : 8, true);
  g.add(new THREE.Mesh(rim, woodMat));
  // lacing stitches around the rim (hide sewn to the frame)
  // boss
  const bossMat = o.boss === 'leather' ? hide : solidMaterial({ tier, tex: metal, color: 0xa87a45, roughness: 0.38, metalness: 1, repeat: [1, 1], metalWear: { patina: 0x3e5646, amount: 0.5, edgeBright: 0.6 } });
  const boss = new THREE.SphereGeometry(0.055, tier === 'low' ? 12 : 20, 8, 0, TAU, 0, Math.PI / 2);
  boss.scale(1, 1, 0.55);
  boss.rotateX(Math.PI / 2);
  boss.translate(0, 0, 0.048);
  g.add(new THREE.Mesh(boss, bossMat));
  // handle bar on the back
  const bar = new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8);
  bar.translate(0, 0, -0.03);
  g.add(new THREE.Mesh(bar, woodMat));
  g.traverse((c) => ((c as THREE.Mesh).isMesh ? ((c as THREE.Mesh).castShadow = true) : null));
  mergeStatic(g);
  const grip = new THREE.Object3D();
  grip.name = 'grip';
  grip.position.set(0, 0, -0.03);
  g.add(grip);
  return g;
}
