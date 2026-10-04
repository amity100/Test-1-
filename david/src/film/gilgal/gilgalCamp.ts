import * as THREE from 'three';
import { mulberry32, Simplex2 } from '../../core/noise';
import { runSync } from '../../core/slice';
import { Smoke } from '../../palace/palaceFx';
import type { TextureSet } from '../../world/Textures';
import { mergeSimple } from './gilgalFlora';
import { ALTAR, CAMP, roadZ, STONES } from './gilgalLayout';
import type { GilgalGround, GilgalTier } from './gilgalTerrain';

/**
 * Gilgal as a place of assembly and sacrifice (1 Sam 11:15; 15:21; Radak 15:12: "the altar was there"):
 *  - the altar: unhewn fieldstones and earth (Exod 20:22; Deut 27:6), ~2.5 m square, ~1.2 m high, no steps, no
 *    horns, the top blackened by fire; a thin smoke
 *  - the camp of the returning army: low black goat-hair tents (Song 1:5 "כְּאָהֳלֵי קֵדָר"), fire pits with smoke
 *  - acacia (shittah, flat-topped) trees of the plain
 * (docs/visual-bible.md 3.6: MUST altar, camp traces, acacia; MUST-NOT Tabernacle / Ark / monument.)
 */
export function buildCamp(ground: GilgalGround, world: TextureSet, tier: GilgalTier) {
  return runSync(buildCampSteps(ground, world, tier));
}

/** (load1, wave 4b) the same camp as steps (GilgalSet's sliced build, core/slice): the same parts in the same order */
export function* buildCampSteps(ground: GilgalGround, world: TextureSet, tier: GilgalTier) {
  const group = new THREE.Group();
  group.name = 'gilgal:camp';
  const rand = mulberry32(3131);
  const noise = new Simplex2(3132);
  // ---------------------------------------------------------------- the altar
  const stoneMat = new THREE.MeshStandardMaterial({ map: world.rock, normalMap: world.rockN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.92, vertexColors: true });
  const parts: THREE.BufferGeometry[] = [];
  const ay = ground.height(ALTAR.x, ALTAR.z);
  const half = ALTAR.size / 2;
  // earth-and-rubble core
  const core = new THREE.BoxGeometry(ALTAR.size - 0.3, ALTAR.height - 0.1, ALTAR.size - 0.3, 4, 2, 4);
  core.translate(0, (ALTAR.height - 0.1) / 2, 0);
  parts.push(core);
  // facing of unhewn fieldstones, course by course, a little battered
  const courses = 5;
  for (let c = 0; c < courses; c++) {
    const y = (c + 0.5) * (ALTAR.height / courses);
    const inset = c * 0.04;
    for (let side = 0; side < 4; side++) {
      yield;
      const n = 7;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5 + (rand() - 0.5) * 0.3) / n * 2 - 1;
        const s = 0.16 + rand() * 0.1;
        const g = new THREE.IcosahedronGeometry(1, 1);
        g.scale(s * (1.1 + rand() * 0.5), s * (0.8 + rand() * 0.3), s * (0.9 + rand() * 0.3));
        g.rotateY(rand() * 6.28);
        const along = t * (half - 0.1), out = half - inset;
        const x = side % 2 === 0 ? along : (side === 1 ? out : -out);
        const z = side % 2 === 0 ? (side === 0 ? out : -out) : along;
        g.translate(x, y, z);
        parts.push(g);
      }
    }
  }
  // top: flat stones with ash
  for (let k = 0; k < 16; k++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const s = 0.2 + rand() * 0.12;
    g.scale(s * 1.3, s * 0.35, s);
    g.translate((rand() - 0.5) * (ALTAR.size - 0.5), ALTAR.height - 0.02, (rand() - 0.5) * (ALTAR.size - 0.5));
    parts.push(g);
  }
  yield;
  const altarGeo = mergeSimple(parts.map((g) => (g.index ? g : g)));
  yield;
  {
    const p = altarGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // soot toward the top, dust toward the foot
      const soot = THREE.MathUtils.smoothstep(y, ALTAR.height - 0.35, ALTAR.height + 0.05);
      const v = 0.72 + noise.noise(p.getX(i) * 3, p.getZ(i) * 3 + y * 2) * 0.12;
      col[i * 3] = v * (1 - soot * 0.85) * 1.0;
      col[i * 3 + 1] = v * (1 - soot * 0.86) * 0.95;
      col[i * 3 + 2] = v * (1 - soot * 0.87) * 0.87;
    }
    altarGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    yield;
    altarGeo.computeVertexNormals();
  }
  yield;
  const altar = new THREE.Mesh(altarGeo, stoneMat);
  altar.position.set(ALTAR.x, ay - 0.05, ALTAR.z);
  altar.rotation.y = 0.2;
  altar.castShadow = altar.receiveShadow = true;
  altar.name = 'gilgal:altar';
  group.add(altar);
  // ---------------------------------------------------------------- black goat-hair tents
  const tentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.055, 0.047, 0.04), roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const tentGeo = (() => {
    const g = new THREE.PlaneGeometry(7, 4.4, 14, 8);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // two rows of poles (1.9 m middle, 1.3 m front, low back wall), cloth sagging between them
      const u = (z + 2.2) / 4.4; // 0 back .. 1 front
      const prof = u < 0.5 ? THREE.MathUtils.lerp(0.9, 1.9, Math.sin(u * Math.PI)) : THREE.MathUtils.lerp(1.9, 1.35, (u - 0.5) * 2);
      const poles = Math.abs(Math.sin((x / 7) * Math.PI * 3));
      // side curtains and the back wall hang to the ground; the front (toward the road) stays open
      const side = 1 - THREE.MathUtils.smoothstep(Math.abs(x), 2.9, 3.5);
      const back = THREE.MathUtils.smoothstep(u, 0.0, 0.14);
      p.setY(i, Math.max(0.02, (prof - (1 - poles) * 0.22 + noise.noise(x * 0.8, z * 0.8) * 0.05) * Math.min(side, back)));
    }
    g.computeVertexNormals();
    return g;
  })();
  const tentCount = tier === 'low' ? 7 : 14;
  const tents = new THREE.InstancedMesh(tentGeo, tentMat, tentCount);
  tents.name = 'gilgal:tents';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  const fires: THREE.Vector3[] = [];
  for (let i = 0; i < tentCount; i++) {
    const a = rand() * 6.283, r = Math.sqrt(rand()) * CAMP.r;
    const x = CAMP.x + Math.cos(a) * r * 1.4, z = CAMP.z + Math.sin(a) * r;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI + (rand() - 0.5) * 0.8); // open side toward the road (north)
    s1.set(0.8 + rand() * 0.5, 0.9 + rand() * 0.2, 0.9 + rand() * 0.3);
    m.compose(new THREE.Vector3(x, ground.height(x, z), z), q, s1);
    tents.setMatrixAt(i, m);
    if (i % 4 === 0) fires.push(new THREE.Vector3(x + 5, ground.height(x + 5, z - 3) + 0.3, z - 3));
  }
  tents.castShadow = tents.receiveShadow = true;
  tents.computeBoundingSphere();
  group.add(tents);
  yield;
  // ---------------------------------------------------------------- smoke: the altar (thin) and the camp fires
  const smoke = new Smoke([
    { pos: new THREE.Vector3(ALTAR.x, ay + ALTAR.height + 0.1, ALTAR.z), rate: 1, size: 1.4, height: 18, dark: 0.15 },
    ...fires.map((p) => ({ pos: p, rate: 1, size: 1.8, height: 16, dark: 0.1 })),
  ], tier === 'low' ? 14 : 28);
  group.add(smoke.points);
  yield;
  // ---------------------------------------------------------------- acacias: flat-topped umbrella crowns
  const acacia = buildAcacias(ground, world, tier, rand);
  group.add(acacia);
  return { group, smoke, altarTop: new THREE.Vector3(ALTAR.x, ay + ALTAR.height, ALTAR.z) };
}

function buildAcacias(ground: GilgalGround, world: TextureSet, tier: GilgalTier, rand: () => number) {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ map: world.bark, normalMap: world.barkN, roughness: 0.95, color: 0x8a7a6a });
  const leaf = new THREE.MeshStandardMaterial({ map: world.shrub, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: 0x9aa47c });
  // trunk forking into 3 limbs, crown: a flat dome of horizontal-ish cards
  const trunkParts: THREE.BufferGeometry[] = [];
  const main = new THREE.CylinderGeometry(0.12, 0.17, 1.6, 6);
  main.translate(0, 0.8, 0);
  trunkParts.push(main);
  for (let k = 0; k < 3; k++) {
    const l = new THREE.CylinderGeometry(0.06, 0.1, 2.4, 5);
    l.translate(0, 1.2, 0);
    l.rotateZ(0.55);
    l.rotateY((k / 3) * Math.PI * 2 + 0.3);
    l.translate(0, 1.5, 0);
    trunkParts.push(l);
  }
  const trunk = mergeSimple(trunkParts);
  const cards: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) {
    const c = new THREE.PlaneGeometry(2.6, 2.6);
    c.rotateX(-Math.PI / 2 + (Math.random() - 0.5) * 0.3);
    const a = (k / 9) * Math.PI * 2, r = k === 0 ? 0 : 1.5;
    c.translate(Math.cos(a) * r, 3.3 + (k === 0 ? 0.25 : 0) + (k % 2) * 0.12, Math.sin(a) * r);
    cards.push(c);
  }
  for (let k = 0; k < 6; k++) {
    const c = new THREE.PlaneGeometry(2.2, 0.8);
    c.rotateY((k / 6) * Math.PI);
    c.translate(0, 3.2, 0);
    cards.push(c);
  }
  const crown = mergeSimple(cards);
  const n = tier === 'low' ? 14 : 30;
  const tm = new THREE.InstancedMesh(trunk, bark, n), cm = new THREE.InstancedMesh(crown, leaf, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let i = 0;
  for (let t = 0; i < n && t < 400; t++) {
    const a = rand() * 6.283, r = 70 + rand() * 520;
    const x = Math.cos(a) * r - 40, z = Math.sin(a) * r;
    if (Math.abs(z - roadZ(x)) < 12 || Math.hypot(x - STONES.center.x, z - STONES.center.z) < 20) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    const k = 0.8 + rand() * 0.6;
    s.set(k, k * (0.85 + rand() * 0.3), k);
    m.compose(new THREE.Vector3(x, ground.height(x, z) - 0.1, z), q, s);
    tm.setMatrixAt(i, m);
    cm.setMatrixAt(i, m);
    i++;
  }
  tm.count = cm.count = i;
  for (const im of [tm, cm]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    g.add(im);
  }
  g.name = 'gilgal:acacias';
  return g;
}
