import * as THREE from 'three';
import type { TextureSet } from '../../world/Textures';
import type { LandTier } from './landTerrain';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fortA from '../../assets/palace/fortstone_a.webp?url';
import fortN from '../../assets/palace/fortstone_n.webp?url';

/** rough unhewn fieldstone masonry (the palace teammate's generated texture, 4.8 m per tile) */
function fieldstoneMaterial(tint: THREE.ColorRepresentation, anisotropy = 4) {
  const L = new THREE.TextureLoader();
  const a = L.load(fortA); a.colorSpace = THREE.SRGBColorSpace; a.wrapS = a.wrapT = THREE.RepeatWrapping; a.anisotropy = anisotropy;
  const n = L.load(fortN); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.anisotropy = anisotropy;
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.93, map: a, normalMap: n });
  m.normalScale.set(1.3, 1.3);
  m.userData.ownTextures = [a, n];
  return m;
}

/** A place mark for a character: feet (or seat top when `seated`), yaw with forward = (sin yaw, 0, cos yaw). */
export interface Mark { pos: THREE.Vector3; yaw: number; role: string; seated?: boolean }

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

/** Box with UVs in metres / tile (so tiling textures keep their real scale on every face). */
export function meterBox(w: number, h: number, d: number, tile = 2.2, rough = 0) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / 1.2)), Math.max(1, Math.round(h / 1.2)), Math.max(1, Math.round(d / 1.2)));
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ax > 0.5) uv.setXY(i, z / tile, y / tile);
    else if (ay > 0.5) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, x / tile, y / tile);
    if (rough > 0) {
      const k = Math.sin(x * 3.1 + y * 5.7) * Math.sin(z * 4.3 - y * 2.9);
      p.setXYZ(i, x + n.getX(i) * k * rough, y + n.getY(i) * k * rough * 0.3, z + n.getZ(i) * k * rough);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function stoneMaterial(tex: TextureSet, map: 'wall' | 'masonry' | 'rock', tint: THREE.ColorRepresentation) {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.92, metalness: 0 });
  m.map = map === 'wall' ? tex.wall : map === 'masonry' ? tex.masonry : tex.rock;
  m.normalMap = map === 'wall' ? tex.wallN : map === 'masonry' ? tex.masonryN : tex.rockN;
  m.normalScale.set(1.1, 1.1);
  return m;
}

/** Grey scale mannequins (placeholders for the cast / crowd teammates' figures). */
export function mannequinGeometry(height = 1.74, seated = false): THREE.BufferGeometry {
  const s = height / 1.74;
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.CylinderGeometry(0.17 * s, 0.26 * s, (seated ? 0.62 : 1.45) * s, 10);
  body.translate(0, seated ? 0.62 * s : 0.725 * s, 0);
  if (seated) body.translate(0, 0.18 * s, 0);
  parts.push(body);
  const head = new THREE.SphereGeometry(0.11 * s, 10, 8);
  head.translate(0, (seated ? 1.2 : 1.56) * s, 0);
  parts.push(head);
  if (seated) {
    const legs = new THREE.BoxGeometry(0.34 * s, 0.14 * s, 0.5 * s);
    legs.translate(0, 0.06 * s, 0.22 * s);
    parts.push(legs);
    const shins = new THREE.BoxGeometry(0.3 * s, 0.46 * s, 0.14 * s);
    shins.translate(0, -0.2 * s, 0.44 * s);
    parts.push(shins);
  }
  const merged = mergeSimple(parts);
  return merged;
}

export function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g0 of parts) {
    const g = g0.index ? g0 : g0;
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
    g0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

// ============================================================================================ RAMAH
/**
 * The gateway of Ramah (הָרָמָתָה, 1 Sam 7:17, 8:4) — a hill village of the central highlands ≈1030 BCE
 * (docs/visual-bible.md 3.8, after Khirbet Raddana / Ai / Tell en-Nasbeh Iron I): the outer houses form a
 * continuous perimeter of rough fieldstone walls; a MODEST gateway (a narrow passage between two wall stubs, flat
 * timber lintel — no arch, no towers, no crenellation), stone benches outside where the elders sit (Ruth 4:1-2);
 * flat roofs of beams and packed clay; Samuel's altar of unhewn stones on the high point (7:17).
 * Local frame of the gate: origin = centre of the outer threshold, +Z out of the town (the gate faces south),
 * +X along the wall. Returned marks are in set (world) coordinates.
 */
export function buildRamahGate(tex: TextureSet, tier: LandTier, frame: { origin: THREE.Vector3; yaw: number }, ground: (x: number, z: number) => number, rnd: () => number) {
  const group = new THREE.Group();
  group.name = 'land:ramah-gate';
  const toWorld = (lx: number, ly: number, lz: number, out = new THREE.Vector3()) => {
    const c = Math.cos(frame.yaw), s = Math.sin(frame.yaw);
    // yaw: local +Z maps to (sin yaw, 0, cos yaw)
    return out.set(frame.origin.x + lx * c + lz * s, frame.origin.y + ly, frame.origin.z - lx * s + lz * c);
  };
  const wallM = fieldstoneMaterial(0xf0e6d6);
  const houseM = fieldstoneMaterial(0xd9c9ae);
  const benchM = stoneMaterial(tex, 'rock', 0xefe6d6);
  const woodM = new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 0.85, map: tex.bark, normalMap: tex.barkN });
  const roofM = new THREE.MeshStandardMaterial({ color: 0xc2b294, roughness: 1, map: tex.rock, normalMap: tex.rockN });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, lx: number, ly: number, lz: number, ry = 0, sink = true) => {
    const mesh = new THREE.Mesh(g, m);
    const w = toWorld(lx, ly, lz);
    if (sink) w.y = frame.origin.y + ly;
    mesh.position.copy(w);
    mesh.rotation.y = frame.yaw + ry;
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const H = 3.2; // house wall height (one storey + parapet)
  const passW = 3.0, stubW = 5.5, stubD = 4.2;
  // ---- merged geometry per material (a few draw calls for the whole village)
  const parts: Record<'wall' | 'roof' | 'wood' | 'bench', THREE.BufferGeometry[]> = { wall: [], roof: [], wood: [], bench: [] };
  const tmpC = new THREE.Color();
  const piece = (kind: keyof typeof parts, g: THREE.BufferGeometry, lx: number, ly: number, lz: number, ry: number, tint: THREE.Color) => {
    const w = toWorld(lx, ly, lz);
    const m = new THREE.Matrix4().compose(w, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), frame.yaw + ry), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    const uvA = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (uvA) {
      // every piece gets its own window into the 4.8 m fieldstone tile (+ a quarter turn now and then): no two walls
      // repeat the same stones side by side
      const ou = rnd() * 7.3, ov = rnd() * 5.1, rot = rnd() < 0.35;
      for (let i = 0; i < uvA.count; i++) { const u0 = uvA.getX(i), v0 = uvA.getY(i); uvA.setXY(i, (rot ? v0 : u0) + ou, (rot ? -u0 : v0) + ov); }
    }
    const n = g.getAttribute('position').count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = tint.r; c[i * 3 + 1] = tint.g; c[i * 3 + 2] = tint.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts[kind].push(g.index ? g.toNonIndexed() : g);
  };
  /**
   * A pillared four-room house (Iron I, Raddana / Ai / Tell en-Nasbeh): rough fieldstone walls, entrance in the
   * short front wall, two rows of monolithic stone pillars dividing a central space from the side rooms, a broad
   * room across the back; flat roofs of beams, branches and packed clay with a low parapet (Deut 22:8) over the
   * side and back rooms; a clay oven (tannur) in the court. Local house frame: (hx, hz) centre, `ry` yaw, the
   * front (door) toward +Z of the house.
   */
  const house = (hx: number, hz: number, ry: number, W: number, D: number, big = false) => {
    const c = Math.cos(ry), sn = Math.sin(ry);
    const L = (x: number, z: number): [number, number] => [hx + x * c + z * sn, hz - x * sn + z * c];
    const wp = toWorld(hx, 0, hz);
    const gy = ground(wp.x, wp.z) - frame.origin.y;
    const tint = tmpC.setHSL(0.08 + rnd() * 0.04, 0.14 + rnd() * 0.14, 0.66 + rnd() * 0.18).clone();
    const t = 0.75, h = H - 0.4 + (big ? 0.6 : 0) + rnd() * 1.1, sink = 1.6;
    const wall = (x: number, z: number, w: number, d: number, hh = h) => { const [px, pz] = L(x, z); piece('wall', meterBox(w, hh + sink, d, 4.8, 0.04), px, gy + (hh + sink) / 2 - sink, pz, ry, tint); };
    wall(0, -D / 2 + t / 2, W, t); // back
    wall(-W / 2 + t / 2, 0, t, D); wall(W / 2 - t / 2, 0, t, D); // sides
    const door = 1.1;
    wall(-(W / 2 + door / 2) / 2 - 0.1, D / 2 - t / 2, W / 2 - door / 2 + 0.2, t);
    wall((W / 2 + door / 2) / 2 + 0.1, D / 2 - t / 2, W / 2 - door / 2 + 0.2, t);
    { const [px, pz] = L(0, D / 2 - t / 2); piece('wood', meterBox(door + 0.6, 0.22, t + 0.1, 1.5), px, gy + 1.95, pz, ry, tmpC.setRGB(0.6, 0.5, 0.4)); piece('wall', meterBox(door + 0.4, h - 2.06, t, 4.8), px, gy + 2.06 + (h - 2.06) / 2, pz, ry, tint); }
    // pillar rows (the side rooms), the broad room across the back
    const side = W * 0.27, back = D * 0.28;
    for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) {
      const [px, pz] = L(sg * (W / 2 - t - side), D / 2 - t - 1.2 - i * ((D - t * 2 - back - 1.2) / 2.2));
      piece('bench', meterBox(0.42, 2.3, 0.42, 1.2, 0.03), px, gy + 1.15, pz, ry + rnd() * 0.2, tmpC.setRGB(0.9, 0.87, 0.8));
    }
    { const [px, pz] = L(0, -D / 2 + t + back); piece('wall', meterBox(W - t * 2, 2.4 + sink, 0.5, 4.8, 0.03), px, gy + (2.4 + sink) / 2 - sink, pz, ry, tint); }
    // roofs: side rooms + back room (beams + packed clay), low parapet on the edge
    const rt = tmpC.setHSL(0.08, 0.22, 0.6 + rnd() * 0.08).clone();
    for (const sg of [-1, 1]) { const [px, pz] = L(sg * (W / 2 - (side + t) / 2), 0.2); piece('roof', meterBox(side + t + 0.1, 0.32, D - 0.3, 3.0), px, gy + h - 0.3, pz, ry, rt); }
    { const [px, pz] = L(0, -D / 2 + (back + t) / 2); piece('roof', meterBox(W - 0.2, 0.32, back + t, 3.0), px, gy + h - 0.3, pz, ry, rt); }
    // the low parapet round the roof (Deut 22:8 "וְעָשִׂיתָ מַעֲקֶה לְגַגֶּךָ"), uneven fieldstone courses
    const pH = 0.45 + rnd() * 0.25;
    { const [px, pz] = L(0, -D / 2 + t / 2); piece('wall', meterBox(W, pH, 0.45, 4.8, 0.05), px, gy + h + pH / 2, pz, ry, tint); }
    for (const sg of [-1, 1]) { const [px, pz] = L(sg * (W / 2 - 0.22), 0); piece('wall', meterBox(0.45, pH, D, 4.8, 0.05), px, gy + h + pH / 2, pz, ry, tint); }
    // an upper room on some roofs (the עֲלִיָּה of 1 Kings 17:19 / 2 Kings 4:10), reached by a ladder: breaks the
    // skyline so the ring reads as houses, not as a town wall
    if (rnd() < (big ? 1 : 0.32)) {
      const uw = side + t + 0.4, ud = Math.min(D * 0.45, 4.2), uh = 2.2 + rnd() * 0.3, sg = rnd() < 0.5 ? -1 : 1;
      const [px, pz] = L(sg * (W / 2 - uw / 2), -D / 2 + ud / 2 + 0.2);
      piece('wall', meterBox(uw, uh, ud, 4.8, 0.04), px, gy + h + uh / 2, pz, ry, tint);
      piece('roof', meterBox(uw + 0.2, 0.28, ud + 0.2, 3.0), px, gy + h + uh + 0.1, pz, ry, rt);
      const [lx2, lz2] = L(sg * (W / 2 - uw - 0.4), -D / 2 + ud + 0.6);
      piece('wood', meterBox(0.5, h + 0.4, 0.08, 1.0), lx2, gy + (h + 0.4) / 2, lz2, ry + 0.25, tmpC.setRGB(0.55, 0.45, 0.35));
    }
    // flax / figs drying on a roof, a stack of brushwood (roof life seen from the plaza)
    if (rnd() < 0.45) { const [px, pz] = L((rnd() - 0.5) * W * 0.5, -D / 2 + back * 0.5 + 0.4); piece('wood', meterBox(1.6 + rnd(), 0.35, 1.1, 1.0, 0.1), px, gy + h + 0.12, pz, ry + rnd(), tmpC.setRGB(0.66, 0.58, 0.4)); }
    // beam ends under the roofs (timber)
    for (let i = 0; i < 5; i++) { const [px, pz] = L(-W / 2 + side + t + 0.05, D / 2 - 1.5 - i * (D - 3) / 4); piece('wood', meterBox(0.24, 0.2, 0.24, 1.0), px, gy + h - 0.52, pz, ry, tmpC.setRGB(0.55, 0.45, 0.36)); }
    // tannur (clay oven) in the court
    if (rnd() < 0.7) { const [px, pz] = L((rnd() - 0.5) * 1.2, D / 2 - 2.6); const ov = new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); ov.scale(1, 1.2, 1); piece('roof', ov, px, gy, pz, 0, tmpC.setRGB(0.72, 0.52, 0.38)); }
    // collared-rim jars by the door
    if (rnd() < 0.6) { const [px, pz] = L(door * 0.9, D / 2 + 0.5); const jar = new THREE.CylinderGeometry(0.2, 0.26, 0.9, 8); piece('roof', jar, px, gy + 0.45, pz, 0, tmpC.setRGB(0.78, 0.6, 0.45)); }
  };
  // ---- the ring of houses: their back walls make the continuous perimeter (Raddana / Ai / Nasbeh); the gateway is
  // a narrow passage between two of them with short wall stubs, a flat timber lintel (no arch, no towers)
  const ringR = 58, ringC = { x: 0, z: -ringR };
  const nRing = tier === 'low' ? 14 : tier === 'medium' ? 22 : 30;
  let ang = 0.21;
  for (let k = 0; k < nRing; k++) {
    for (const sg of [-1, 1]) {
      if (k * 2 + (sg > 0 ? 1 : 0) >= nRing) continue;
      const W = 9 + rnd() * 2.5, D = 11 + rnd() * 2.5;
      const a = sg * (ang + (k === 0 ? 0 : 0)) ;
      const r = ringR - D / 2 + 0.5 + (rnd() - 0.5) * 2.4;
      const hx = ringC.x + Math.sin(a) * r, hz = ringC.z + Math.cos(a) * r;
      // front faces into the village (toward the centre): house +Z = inward
      house(hx, hz, a + Math.PI, W, D, false);
      if (sg > 0) ang += (W + 0.6) / ringR;
    }
  }
  // inner houses; Samuel's house (slightly larger) near the high point, by the altar
  const nIn = tier === 'low' ? 5 : tier === 'medium' ? 9 : 14;
  for (let i = 0; i < nIn; i++) {
    const a = rnd() * Math.PI * 2, r = 14 + rnd() * 20;
    house(ringC.x + Math.sin(a) * r, ringC.z + Math.cos(a) * r, rnd() * Math.PI * 2, 8.5 + rnd() * 2, 10 + rnd() * 2);
  }
  house(-8, -34, 0.3, 12.5, 14, true);
  // gate: short wall stubs flanking the passage + benches on the outer face (the elders sit here, Ruth 4:1-2)
  for (const sgn of [-1, 1]) {
    const cx = sgn * (passW / 2 + stubW / 2);
    piece('wall', meterBox(stubW, H + 0.6 + 1.6, stubD, 4.8, 0.05), cx, (H + 0.6 + 1.6) / 2 - 1.6, -stubD / 2 + 0.6, 0, tmpC.setRGB(0.95, 0.91, 0.84));
    piece('bench', meterBox(stubW - 0.4, 0.46, 0.55, 1.4, 0.02), cx, 0.23, 0.9, 0, tmpC.setRGB(0.95, 0.92, 0.86));
    piece('bench', meterBox(6.5, 0.46, 0.55, 1.4, 0.02), sgn * (passW / 2 + stubW + 3.6), 0.23, 0.4, 0, tmpC.setRGB(0.93, 0.9, 0.84));
    // wall between the stubs and the first houses of the ring
    piece('wall', meterBox(9, H + 1.6, 1.1, 4.8, 0.05), sgn * (passW / 2 + stubW + 4.2), (H + 1.6) / 2 - 1.6, -1.6, 0, tmpC.setRGB(0.92, 0.88, 0.8));
  }
  // the lintel: a heavy timber beam (cut4: lighter, weathered, its grain readable — it read as a black frame), a second
  // one inside, the wall carried over them
  piece('wood', meterBox(passW + 1.7, 0.44, 0.52, 1.1), 0, 2.93, 0.38, 0, tmpC.setRGB(1.0, 0.86, 0.68));
  piece('wood', meterBox(passW + 1.5, 0.38, 0.45, 1.1), 0, 2.9, -1.0, 0, tmpC.setRGB(0.74, 0.62, 0.48));
  piece('wall', meterBox(passW + 0.6, 0.9, 1.9, 4.8, 0.04), 0, 3.07 + 0.45, -0.35, 0, tmpC.setRGB(0.95, 0.91, 0.84));
  // the passage roofed through the depth of the gate (beams and packed clay): the passage lies in shade
  piece('roof', meterBox(passW + 0.4, 0.32, 4.1, 2.2), 0, 3.12, -1.55, 0, tmpC.setRGB(0.5, 0.45, 0.39));
  // the two door leaves standing OPEN, swung inward ~70° from their hinges at the outer face (planked, dark with age)
  for (const sgn of [-1, 1]) {
    const th = 1.22; // 70°
    const hx = sgn * (passW / 2 - 0.08), hz = -0.18, w = 1.42;
    piece('wood', meterBox(w, 2.62, 0.1, 0.9), hx - sgn * (w / 2) * Math.cos(th), 1.31, hz - (w / 2) * Math.sin(th), sgn < 0 ? th : -th, tmpC.setRGB(0.55, 0.44, 0.33));
    // the door posts against the stubs
    piece('wood', meterBox(0.24, 2.75, 0.3, 1.0), sgn * (passW / 2 + 0.02), 1.37, 0.32, 0, tmpC.setRGB(0.7, 0.58, 0.45));
  }
  piece('bench', meterBox(passW, 0.18, 1.0, 1.4), 0, 0.02, 0.4, 0, tmpC.setRGB(0.9, 0.87, 0.8));
  // terraces on the slope below the gate (dry-stone risers following the contour), olives planted on them
  const terraceOlives: { x: number; z: number; s: number; yaw: number }[] = [];
  for (let i = 0; i < (tier === 'low' ? 3 : 5); i++) {
    const R = ringR + 16 + i * 11;
    for (let a = -1.25; a < 1.25; a += 0.07) {
      const lx = Math.sin(a) * R, lz = ringC.z + Math.cos(a) * R;
      if (Math.abs(lx) < 16 && lz < 30) continue; // the plaza and the road out of the gate
      const w = toWorld(lx, 0, lz);
      const gy = ground(w.x, w.z) - frame.origin.y;
      piece('wall', meterBox(R * 0.072, 1.9, 0.9, 4.8, 0.06), lx, gy - 0.25, lz, -a, tmpC.setRGB(0.86, 0.83, 0.76));
      if (rnd() < 0.55) { const o = toWorld(Math.sin(a) * (R + 5), 0, ringC.z + Math.cos(a) * (R + 5)); terraceOlives.push({ x: o.x, z: o.z, s: 0.85 + rnd() * 0.35, yaw: rnd() * 6.28 }); }
    }
  }
  const mats: Record<keyof typeof parts, THREE.Material> = { wall: houseM, roof: roofM, wood: woodM, bench: benchM };
  for (const m of [houseM, roofM, woodM, benchM]) (m as THREE.MeshStandardMaterial).vertexColors = true;
  for (const k of Object.keys(parts) as (keyof typeof parts)[]) {
    if (!parts[k].length) continue;
    const g = mergeGeometries(parts[k].map((x) => { x.deleteAttribute('uv1'); return x; }), false);
    for (const x of parts[k]) x.dispose();
    if (!g) continue;
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mats[k]);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  void wallM; void add;
  // "וַיִּתְקַבְּצוּ כֹּל זִקְנֵי יִשְׂרָאֵל וַיָּבֹאוּ אֶל־שְׁמוּאֵל הָרָמָתָה" (8:4) — cut4 (P5, director-notes-v5): the elders gathered
  // in a LOOSE ARC before Samuel in the gateway, in the order the film casts them (FilmStage takes the first N per tier):
  //   0 the speaker, seated on the bench left of the passage (he rises and demands, RamahPerformance's lead: the
  //     seated elder nearest Samuel) · 1 seated on the right bench · 2-5 the arc 3-4 m before Samuel (backs and
  //     profiles to the lens) · 6-7 the near pair the lens dollies in past (heads and shoulders in the foreground,
  //     turned toward each other) · 8-10 the outer ring
  // Local gate frame (x along the wall, z out of the gate); `turn` = extra yaw off "facing Samuel" (rad).
  const elders: Mark[] = [];
  const benchY = 0.46;
  const ARC: [number, number, boolean, number][] = [
    [-2.1, 0.95, true, -0.25], [3.0, 0.95, true, 0.2],
    [-1.3, 3.6, false, 0.15], [1.6, 3.9, false, -0.2], [-2.6, 2.7, false, 0.1], [2.7, 2.9, false, -0.1],
    [-0.85, 7.6, false, 0.55], [1.25, 7.2, false, -0.6],
    [-4.2, 4.8, false, 0.05], [4.0, 5.2, false, -0.1], [-2.4, 6.0, false, 0.3],
  ];
  for (const [lx, lz, seated, turn] of ARC) {
    const p = toWorld(lx, seated ? benchY : 0, lz);
    if (!seated) p.y = ground(p.x, p.z);
    const toSamuel = Math.atan2(-lx, 1.4 - lz);
    elders.push({ pos: p, yaw: frame.yaw + toSamuel + turn, role: seated ? 'elder-seated' : 'elder', seated });
  }
  void rnd;
  const samuelP = toWorld(0, 0, 1.4);
  samuelP.y = ground(samuelP.x, samuelP.z);
  const samuel: Mark = { pos: samuelP, yaw: frame.yaw, role: 'samuel' };
  // Samuel's altar of unhewn stones on the high point (7:17; Ex 20:22 — no hewn stone), a thin smoke line is optional
  const altarAt = toWorld(6, 0, -38);
  const ay = ground(altarAt.x, altarAt.z) - frame.origin.y;
  for (let i = 0; i < 9; i++) {
    const s0 = 0.55 + rnd() * 0.35;
    add(meterBox(s0 * 1.3, s0, s0, 1.2, 0.08), benchM, 6 + (i % 3 - 1) * 0.7 + (rnd() - 0.5) * 0.2, ay + s0 / 2 + Math.floor(i / 3) * 0.5, -38 + (Math.floor(i / 3) % 2) * 0.3 + (rnd() - 0.5) * 0.4, rnd());
  }
  return { group, elders, samuel, toWorld, altar: altarAt.setY(frame.origin.y + ay + 1.5), materials: [wallM, houseM, benchM, woodM, roofM], terraceOlives };
}

// ============================================================================================ COAST
/**
 * The Philistine road on the coastal plain: a beaten road (the "way of the land of the Philistines", Ex 13:17)
 * as a world-space polyline, placeholder ranks of infantry (the crowd teammate replaces them), bronze shields and
 * spear points that glint, and a backlit dust cloud.
 */
export function roadGlslFor(pts: THREE.Vector2[], width: number): string {
  const segs = pts.slice(0, -1).map((p, i) => `d = min(d, sdSeg(xz, vec2(${p.x.toFixed(1)}, ${p.y.toFixed(1)}), vec2(${pts[i + 1].x.toFixed(1)}, ${pts[i + 1].y.toFixed(1)})));`).join('\n');
  return /* glsl */ `
    float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
    float roadMask(vec2 xz){ float d = 1e9; ${segs}
      float w = ${width.toFixed(1)} * (0.85 + 0.3 * dNoise(xz * 0.05));
      return (1.0 - smoothstep(w * 0.5, w * 0.5 + 2.5, d)) * (0.75 + 0.25 * dNoise(xz * 0.7)); }`;
}

export function buildArmyPlaceholders(route: THREE.Vector3[], count: number, ground: (x: number, z: number) => number) {
  const group = new THREE.Group();
  group.name = 'land:army-placeholders';
  const body = mannequinGeometry(1.72);
  const bodyM = new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.9 });
  const shieldG = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16);
  shieldG.rotateX(Math.PI / 2);
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb07a3c, metalness: 1, roughness: 0.32 });
  const spearG = new THREE.CylinderGeometry(0.015, 0.02, 2.6, 5);
  const bodies = new THREE.InstancedMesh(body, bodyM, count);
  const shields = new THREE.InstancedMesh(shieldG, bronze, count);
  const spears = new THREE.InstancedMesh(spearG, bronze, count);
  const helmetG = new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const helmets = new THREE.InstancedMesh(helmetG, bronze, count);
  // walk along the route: ranks of 6
  const lens: number[] = [0];
  for (let i = 1; i < route.length; i++) lens.push(lens[i - 1] + route[i].distanceTo(route[i - 1]));
  const at = (s: number, out: THREE.Vector3, dir: THREE.Vector3) => {
    let i = 1;
    while (i < route.length - 1 && lens[i] < s) i++;
    const f = (s - lens[i - 1]) / Math.max(1e-3, lens[i] - lens[i - 1]);
    out.lerpVectors(route[i - 1], route[i], Math.min(1, Math.max(0, f)));
    dir.subVectors(route[i], route[i - 1]).normalize();
  };
  const p = new THREE.Vector3(), d = new THREE.Vector3();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < count; k++) {
    const rank = Math.floor(k / 6), file = k % 6;
    at(2 + rank * 1.5 + rnd() * 0.3, p, d);
    const side = new THREE.Vector3(-d.z, 0, d.x);
    const x = p.x + side.x * (file - 2.5) * 1.05 + (rnd() - 0.5) * 0.25, z = p.z + side.z * (file - 2.5) * 1.05 + (rnd() - 0.5) * 0.25;
    const y = ground(x, z);
    const yaw = Math.atan2(d.x, d.z);
    tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    tmpS.set(1, 0.95 + rnd() * 0.1, 1);
    tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS);
    bodies.setMatrixAt(k, tmpM);
    tmpM.compose(tmpP.set(x + side.x * 0.3 + d.x * 0.2, y + 1.05, z + side.z * 0.3 + d.z * 0.2), tmpQ, tmpS.set(1, 1, 1));
    shields.setMatrixAt(k, tmpM);
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, yaw, 0, 'YXZ'));
    tmpM.compose(tmpP.set(x - side.x * 0.28, y + 1.45, z - side.z * 0.28), tilt, tmpS.set(1, 1, 1));
    spears.setMatrixAt(k, tmpM);
    tmpM.compose(tmpP.set(x, y + 1.66, z), tmpQ, tmpS.set(1, 1, 1));
    helmets.setMatrixAt(k, tmpM);
  }
  for (const m of [bodies, shields, spears, helmets]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
  return { group, dispose: () => { for (const m of [bodies, shields, spears, helmets]) m.geometry.dispose(); bodyM.dispose(); bronze.dispose(); } };
}

/** Soft dust billboards along the road, lit by the sun with strong forward scattering (backlit glow). */
export function buildDust(route: THREE.Vector3[], count: number, sunDir: THREE.Vector3, sunColor: THREE.Color, spread = 420) {
  const g = new THREE.PlaneGeometry(1, 1);
  const inst = new THREE.InstancedBufferGeometry();
  inst.index = g.index; inst.setAttribute('position', g.getAttribute('position')); inst.setAttribute('uv', g.getAttribute('uv'));
  const offs = new Float32Array(count * 4);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const lens: number[] = [0];
  for (let i = 1; i < route.length; i++) lens.push(lens[i - 1] + route[i].distanceTo(route[i - 1]));
  const total = lens[lens.length - 1];
  for (let k = 0; k < count; k++) {
    const s = 25 + rnd() * Math.min(total - 25, spread);
    let i = 1;
    while (i < route.length - 1 && lens[i] < s) i++;
    const f = (s - lens[i - 1]) / Math.max(1e-3, lens[i] - lens[i - 1]);
    const p = new THREE.Vector3().lerpVectors(route[i - 1], route[i], f);
    offs[k * 4] = p.x + (rnd() - 0.5) * 14; offs[k * 4 + 1] = p.y + 0.5 + rnd() * rnd() * 7; offs[k * 4 + 2] = p.z + (rnd() - 0.5) * 14;
    offs[k * 4 + 3] = 6 + rnd() * 12;
  }
  inst.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 4));
  inst.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    name: 'LandDust',
    transparent: true, depthWrite: false,
    uniforms: { uSunDir: { value: sunDir }, uSunCol: { value: sunColor }, uTime: { value: 0 }, uAmb: { value: new THREE.Color(0.35, 0.3, 0.26) } },
    vertexShader: /* glsl */ `
      attribute vec4 aOff; varying vec2 vUv; varying vec3 vW; varying float vSeed;
      uniform float uTime;
      void main(){
        vUv = uv; vSeed = fract(aOff.x * 0.13 + aOff.z * 0.071);
        vec3 c = aOff.xyz + vec3(sin(uTime * 0.2 + vSeed * 6.0), 0.15 * uTime * (0.5 + vSeed), cos(uTime * 0.17 + vSeed * 5.0)) * 1.5;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 w = c + (right * position.x + up * position.y) * aOff.w;
        vW = w; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uSunCol, uAmb; varying vec2 vUv; varying vec3 vW; varying float vSeed;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 q = vUv - 0.5; float r = length(q) * 2.0;
        float a = (1.0 - smoothstep(0.2, 1.0, r)) * (0.55 + 0.45 * n2(vUv * 4.0 + vSeed * 17.0));
        vec3 rd = normalize(vW - cameraPosition);
        float mu = max(dot(rd, normalize(uSunDir)), 0.0);
        float ph = 0.3 + 1.1 * pow(mu, 5.0) + 1.2 * pow(mu, 30.0);
        vec3 col = uSunCol * ph * 0.9 + uAmb;
        float al = a * 0.075;
        gl_FragColor = vec4(col * al, al);
      }`,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(inst, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.name = 'land:dust';
  return { mesh, material: mat, dispose: () => { inst.dispose(); g.dispose(); mat.dispose(); } };
}
