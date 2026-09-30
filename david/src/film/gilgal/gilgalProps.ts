import * as THREE from 'three';
import { mulberry32, Simplex2 } from '../../core/noise';
import type { TextureSet } from '../../world/Textures';
import { armySlot, type ActorState, type ArmyState } from './gilgalBlocking';
import { ARMY, STONES } from './gilgalLayout';
import type { GilgalGround, GilgalTier } from './gilgalTerrain';

// =====================================================================================================
// The twelve stones (Josh 4:20)
// =====================================================================================================
/**
 * "And those twelve stones, which they took out of the Jordan, did Joshua set up in Gilgal" (Josh 4:20): river
 * boulders from the bed of the Jordan (4:3, 4:8), each carried on a man's shoulder (4:5; Sotah 34a has the sages'
 * tradition that each weighed forty se'ah, i.e. very large), set up (הֵקִים) as standing stones. Water-worn, rounded
 * pale limestone and flint-grey stones, ~1.2-1.7 m tall, in a ring on a low knoll by the road. Unhewn, uninscribed.
 */
export function buildStones(ground: GilgalGround, world: TextureSet) {
  const group = new THREE.Group();
  group.name = 'gilgal:stones';
  const rand = mulberry32(1220);
  const noise = new Simplex2(1221);
  const mat = new THREE.MeshStandardMaterial({ map: world.rock, normalMap: world.rockN, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.86, metalness: 0, vertexColors: true });
  const tops: THREE.Vector3[] = [];
  for (let i = 0; i < STONES.count; i++) {
    const g = new THREE.IcosahedronGeometry(1, 4);
    const p = g.getAttribute('position');
    // visual-bible 3.6: rounded river boulders ~70-100 cm, upright, half-buried at the base
    const h = 1.05 + rand() * 0.35, w = 0.5 + rand() * 0.2, d = 0.4 + rand() * 0.15;
    const sd = rand() * 100;
    const uv: number[] = [];
    const col: number[] = [];
    const dark = i % 4 === 1 ? 1 : 0; // a few darker flint / basalt-grey river stones among the pale limestone
    const base = dark ? new THREE.Color(0.36, 0.34, 0.31) : new THREE.Color(0.66, 0.61, 0.54).multiplyScalar(0.85 + rand() * 0.2);
    for (let k = 0; k < p.count; k++) {
      let x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      // water-worn: low-frequency lumps only, flattened faces, a slightly narrower top
      const n = noise.noise(x * 1.1 + sd, y * 1.1 + z * 0.7) * 0.16 + noise.noise(x * 2.3 - sd, z * 2.3 + y) * 0.07 + noise.noise(x * 5.1 + sd, y * 5.3 - z) * 0.025;
      const r = 1 + n;
      x *= r; y *= r; z *= r;
      const top = (y + 1) / 2;
      x *= w * (1 - 0.18 * top * top); z *= d * (1 - 0.12 * top);
      y = (y + 1) / 2 * h - 0.28; // sunk ~0.28 m into the ground
      p.setXYZ(k, x, y, z);
      // box-projected UVs
      const ax = Math.abs(p.getX(k)), az = Math.abs(p.getZ(k));
      uv.push(ax > az ? z * 0.6 : x * 0.6, y * 0.6);
      const ao = THREE.MathUtils.smoothstep(y, -0.28, 0.3);
      col.push(base.r * (0.72 + 0.28 * ao), base.g * (0.72 + 0.28 * ao), base.b * (0.7 + 0.3 * ao));
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    const a = (i / STONES.count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const rr = STONES.radius * (0.95 + rand() * 0.1);
    const x = STONES.center.x + Math.cos(a) * rr, z = STONES.center.z + Math.sin(a) * rr;
    m.position.set(x, ground.height(x, z), z);
    m.rotation.set((rand() - 0.5) * 0.12, -a + Math.PI / 2 + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.1);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `gilgal:stone${i}`;
    group.add(m);
    tops.push(m.position.clone().setY(m.position.y + h - 0.28));
  }
  return { group, tops };
}

/** stones and pebbles of the plain (flint and limestone, long shadows in the low sun) near the stage */
export function buildPebbles(ground: GilgalGround, world: TextureSet, tier: GilgalTier, clear: (x: number, z: number) => boolean) {
  const count = tier === 'high' ? 2600 : tier === 'medium' ? 1500 : 600;
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.getAttribute('position');
  const nz = new Simplex2(77);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = 1 + nz.noise(x * 1.7, y * 1.7 + z) * 0.25;
    p.setXYZ(i, x * r, y * r * 0.6, z * r);
  }
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: world.rock, roughness: 0.9, metalness: 0, color: 0xb8ab98 });
  const mesh = new THREE.InstancedMesh(g, mat, count);
  mesh.name = 'gilgal:pebbles';
  const rand = mulberry32(4242);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  let n = 0;
  for (let t = 0; n < count && t < count * 6; t++) {
    const a = rand() * 6.283, r = 3 + Math.pow(rand(), 1.8) * 160;
    const x = Math.cos(a) * r - 60 + (rand() - 0.5) * 60, z = Math.sin(a) * r * 0.7;
    const onStage = x > -60 && x < 40 && Math.abs(z) < 6;
    if (onStage && rand() < 0.8) continue;
    const s = 0.04 + Math.pow(rand(), 3) * 0.32;
    e.set(rand() * 0.6, rand() * 6.28, rand() * 0.6);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, ground.height(x, z) - s * 0.25, z), q, new THREE.Vector3(s * (0.8 + rand() * 0.5), s, s * (0.8 + rand() * 0.5)));
    mesh.setMatrixAt(n, m);
    c.setRGB(0.95, 0.9, 0.82).multiplyScalar(0.7 + rand() * 0.4);
    if (rand() < 0.25) c.setRGB(0.5, 0.46, 0.42);
    mesh.setColorAt(n, c);
    n++;
  }
  void clear;
  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// =====================================================================================================
// Placeholder figures (scale / blocking stand-ins for renders; the cast and crowd teammates replace them)
// =====================================================================================================
function part(g: THREE.BufferGeometry, color: THREE.Color) {
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g.index ? g.toNonIndexed() : g;
}
function merge(parts: THREE.BufferGeometry[]) {
  let n = 0;
  for (const p of parts) n += p.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    const c = p.getAttribute('position').count;
    pos.set(p.getAttribute('position').array as Float32Array, o * 3);
    nor.set(p.getAttribute('normal').array as Float32Array, o * 3);
    col.set(p.getAttribute('color').array as Float32Array, o * 3);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

/** a standing man of height h (feet at 0, facing +Z), rough proportions; `robe` = long mantle to the ankles */
function manGeometry(h: number, o: { tunic: THREE.Color; skin: THREE.Color; hair: THREE.Color; robe?: boolean; shield?: boolean; armour?: THREE.Color; beard?: THREE.Color; band?: boolean }) {
  const k = h / 1.75;
  const P: THREE.BufferGeometry[] = [];
  const leg = (s: number) => part(new THREE.CylinderGeometry(0.065 * k, 0.05 * k, 0.86 * k, 6).translate(s * 0.1 * k, 0.43 * k, 0), o.skin);
  if (!o.robe) P.push(leg(-1), leg(1));
  // tunic / robe
  const tl = o.robe ? 1.45 : 0.78;
  P.push(part(new THREE.CylinderGeometry(0.19 * k, o.robe ? 0.3 * k : 0.25 * k, tl * k, 10, 1).translate(0, (1.42 - tl / 2) * k, 0), o.tunic));
  P.push(part(new THREE.CapsuleGeometry(0.18 * k, 0.28 * k, 4, 10).scale(1.15, 1, 0.75).translate(0, 1.3 * k, 0), o.armour ?? o.tunic));
  // arms
  for (const s of [-1, 1]) P.push(part(new THREE.CapsuleGeometry(0.05 * k, 0.5 * k, 3, 6).translate(s * 0.25 * k, 1.12 * k, 0.02), o.robe ? o.tunic : o.skin));
  P.push(part(new THREE.SphereGeometry(0.105 * k, 12, 10).scale(0.92, 1.1, 1).translate(0, 1.64 * k, 0.01), o.skin));
  P.push(part(new THREE.SphereGeometry(0.11 * k, 10, 8).scale(0.97, 1.0, 1.0).translate(0, 1.68 * k, -0.02 * k), o.hair));
  if (o.beard) P.push(part(new THREE.ConeGeometry(0.075 * k, 0.26 * k, 8).rotateX(Math.PI).translate(0, 1.5 * k, 0.07 * k), o.beard));
  if (o.band) P.push(part(new THREE.TorusGeometry(0.1 * k, 0.012 * k, 6, 20).rotateX(Math.PI / 2).translate(0, 1.7 * k, 0), new THREE.Color(1.0, 0.72, 0.25)));
  if (o.shield) P.push(part(new THREE.CylinderGeometry(0.3 * k, 0.3 * k, 0.04, 14).rotateZ(Math.PI / 2).translate(-0.33 * k, 1.12 * k, 0.05), new THREE.Color(0.36, 0.24, 0.14)));
  return merge(P);
}

function spearGeometry(len: number) {
  const P = [
    part(new THREE.CylinderGeometry(0.014, 0.017, len, 5).translate(0, len / 2, 0), new THREE.Color(0.45, 0.33, 0.2)),
    part(new THREE.ConeGeometry(0.028, 0.26, 5).translate(0, len + 0.12, 0), new THREE.Color(0.75, 0.55, 0.3)),
  ];
  return merge(P);
}

export interface Placeholders {
  group: THREE.Group;
  saul: THREE.Group;
  saulSpear: THREE.Object3D;
  samuel: THREE.Group;
  /** update the placeholders from the blocking (feet snapped to the ground) */
  pose(saul: ActorState, samuel: ActorState, army: ArmyState, time: number): void;
  soldiers: number;
}

export function buildPlaceholders(ground: GilgalGround, tier: GilgalTier): Placeholders {
  const group = new THREE.Group();
  group.name = 'gilgal:placeholders';
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const skin = new THREE.Color(0.55, 0.36, 0.25);
  // ---------------------------------------------------------------- Saul (1.98 m) and Samuel (1.70 m)
  const saul = new THREE.Group();
  saul.name = 'placeholder:saul';
  saul.add(new THREE.Mesh(manGeometry(1.98, { tunic: new THREE.Color(0.26, 0.015, 0.02), skin, hair: new THREE.Color(0.1, 0.08, 0.06), beard: new THREE.Color(0.12, 0.09, 0.07), armour: new THREE.Color(0.48, 0.18, 0.05), band: true }), mat));
  const saulSpear = new THREE.Group();
  const sp = new THREE.Mesh(spearGeometry(2.6), mat);
  sp.position.y = -0.95;
  saulSpear.add(sp);
  saulSpear.position.set(0.3, 1.05, 0.12);
  saul.add(saulSpear);
  const samuel = new THREE.Group();
  samuel.name = 'placeholder:samuel';
  samuel.add(new THREE.Mesh(manGeometry(1.65, { tunic: new THREE.Color(0.11, 0.083, 0.057), skin: new THREE.Color(0.5, 0.36, 0.28), hair: new THREE.Color(0.72, 0.7, 0.66), beard: new THREE.Color(0.78, 0.76, 0.72), robe: true }), mat));
  for (const g of [saul, samuel]) g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  group.add(saul, samuel);
  // ---------------------------------------------------------------- the army (instanced)
  const ranks = tier === 'high' ? ARMY.ranks : tier === 'medium' ? 34 : 20;
  const n = ranks * ARMY.files;
  const variants = [
    manGeometry(1.72, { tunic: new THREE.Color(0.6, 0.52, 0.4), skin, hair: new THREE.Color(0.1, 0.08, 0.06), beard: new THREE.Color(0.1, 0.08, 0.06), shield: true }),
    manGeometry(1.7, { tunic: new THREE.Color(0.38, 0.3, 0.22), skin, hair: new THREE.Color(0.1, 0.08, 0.06), beard: new THREE.Color(0.12, 0.09, 0.06) }),
  ];
  const bodies = variants.map((g) => new THREE.InstancedMesh(g, mat, n));
  const spears = new THREE.InstancedMesh(spearGeometry(2.4), mat, n);
  const rand = mulberry32(99);
  const info: { file: number; rank: number; v: number; idx: number; phase: number; s: number; hasSpear: boolean }[] = [];
  const counts = [0, 0];
  const col = new THREE.Color();
  for (let r = 0; r < ranks; r++) for (let f = 0; f < ARMY.files; f++) {
    const v = rand() < 0.55 ? 0 : 1;
    const idx = counts[v]++;
    col.setScalar(0.8 + rand() * 0.35);
    bodies[v].setColorAt(idx, col);
    info.push({ file: f, rank: r, v, idx, phase: rand() * 6.28, s: 0.95 + rand() * 0.1, hasSpear: rand() < 0.8 });
  }
  bodies.forEach((b, i) => {
    b.count = counts[i];
    b.castShadow = true;
    b.receiveShadow = true;
    b.frustumCulled = false;
    b.name = `placeholder:soldiers${i}`;
    group.add(b);
  });
  spears.castShadow = true;
  spears.frustumCulled = false;
  spears.name = 'placeholder:spears';
  group.add(spears);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const pose = (s: ActorState, sm: ActorState, army: ArmyState, time: number) => {
    const bob = (walk: number, ph: number) => (walk > 0 ? Math.abs(Math.sin(time * 5.2 + ph)) * 0.035 : 0);
    saul.position.set(s.pos.x, ground.height(s.pos.x, s.pos.z) + bob(s.walk, 0), s.pos.z);
    saul.rotation.y = s.yaw;
    // spear: carried upright, raised high and forward on cue
    saulSpear.position.set(0.3, 1.05 + s.cue * 0.95, 0.12 + s.cue * 0.05);
    saulSpear.rotation.x = s.cue * 0.25;
    samuel.position.set(sm.pos.x, ground.height(sm.pos.x, sm.pos.z), sm.pos.z);
    samuel.rotation.y = sm.yaw;
    let si = 0;
    for (const it of info) {
      armySlot(it.file, it.rank, army.frontX, army.part, 0.2, v3);
      v3.y = ground.height(v3.x, v3.z) + bob(army.walk, it.phase);
      e.set(0, Math.PI / 2 + Math.sin(it.phase * 3) * 0.12, 0);
      q.setFromEuler(e);
      sc.setScalar(it.s);
      m.compose(v3, q, sc);
      bodies[it.v].setMatrixAt(it.idx, m);
      if (it.hasSpear) {
        const rr = Math.min(1, Math.max(0, (army.raise * (1 + it.rank * 0.035 * 2) - it.rank * 0.035 * 2)));
        // right hand: lateral offset to the soldier's right (facing +X => right = +Z)
        v3.z += 0.26;
        v3.x += 0.05;
        v3.y += 0.25 + rr * 0.9;
        e.set(0, 0, -0.12 - rr * 0.25 + Math.sin(it.phase) * 0.05);
        q.setFromEuler(e);
        m.compose(v3, q, sc);
        spears.setMatrixAt(si++, m);
      }
    }
    spears.count = si;
    for (const b of bodies) b.instanceMatrix.needsUpdate = true;
    spears.instanceMatrix.needsUpdate = true;
  };
  return { group, saul, saulSpear, samuel, pose, soldiers: n };
}
