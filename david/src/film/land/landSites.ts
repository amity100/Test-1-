import * as THREE from 'three';
import type { TextureSet } from '../../world/Textures';
import type { LandTier } from './landTerrain';
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
  const body = new THREE.CylinderGeometry(0.17 * s, 0.26 * s, (seated ? 0.62 : 1.18) * s, 10);
  body.translate(0, seated ? 0.62 * s : 0.62 * s + 0.0, 0);
  if (seated) body.translate(0, 0.18 * s, 0);
  parts.push(body);
  const head = new THREE.SphereGeometry(0.11 * s, 10, 8);
  head.translate(0, (seated ? 1.28 : 1.62) * s, 0);
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
  const H = 3.6; // perimeter (outer house) wall height
  const passW = 3.0, towerW = 5.5, towerD = 4.2, towerH = 4.0; // wall stubs flanking the passage (not towers)
  // towers flanking the entrance (project 3 m outside the wall face)
  for (const sgn of [-1, 1]) {
    const cx = sgn * (passW / 2 + towerW / 2);
    add(meterBox(towerW, towerH + 3, towerD, 4.8, 0.05), wallM, cx, (towerH + 3) / 2 - 3, -towerD / 2 + 0.6);
    // parapet stones on the tower top (irregular, no crenellation pattern)
    // inner chamber walls (one pair of chambers along the passage)
    add(meterBox(0.9, H + 3, 8.5, 4.8, 0.04), wallM, sgn * (passW / 2 + 0.45), (H + 3) / 2 - 3, -4.25 - 3.5);
    add(meterBox(4.2, H + 3, 0.9, 4.8, 0.04), wallM, sgn * (passW / 2 + 2.1), (H + 3) / 2 - 3, -12.0);
    // town wall running off from the tower, 4 m thick, following the ground
    const segs = tier === 'low' ? 5 : 8;
    for (let i = 0; i < segs; i++) {
      const lx = sgn * (passW / 2 + towerW + 4 + i * 8);
      const lz = -2 - i * i * 0.55;
      const wp = toWorld(lx, 0, lz);
      const gy = ground(wp.x, wp.z) - frame.origin.y;
      add(meterBox(8.4, H + 4, 4, 4.8, 0.05), wallM, lx, gy + (H + 4) / 2 - 4, lz, sgn * i * 0.07);
    }
    // benches along the outer wall face, both sides of the entrance (elders' seats)
    add(meterBox(towerW - 0.4, 0.46, 0.55, 1.4, 0.02), benchM, cx, 0.23, 0.6 + 0.3);
    add(meterBox(6.5, 0.46, 0.55, 1.4, 0.02), benchM, sgn * (passW / 2 + towerW + 3.6), 0.23, 0.3 + 0.1);
  }
  // flat timber lintel beams over the entrance + wall above (no arch)
  add(meterBox(passW + 1.4, 0.35, 0.45, 1.5), woodM, 0, 2.9, 0.35);
  add(meterBox(passW + 1.4, 0.35, 0.45, 1.5), woodM, 0, 2.9, -1.0);
  add(meterBox(passW + 0.6, 1.1, 1.9, 4.8, 0.04), wallM, 0, 3.07 + 0.55, -0.35);
  // open gate leaves (planks) against the passage walls
  for (const sgn of [-1, 1]) {
    const leaf = add(meterBox(1.9, 2.7, 0.12, 1.0), woodM, sgn * (passW / 2 - 0.1), 1.35, -1.4, sgn * Math.PI / 2);
    leaf.position.add(new THREE.Vector3(0, 0, 0));
  }
  // threshold stone and a beaten-earth passage floor
  add(meterBox(passW, 0.18, 1.0, 1.4), benchM, 0, 0.02, 0.4);
  // houses of the town behind the wall (flat roofs of beams + packed earth)
  const nh = tier === 'low' ? 14 : tier === 'medium' ? 26 : 38;
  for (let i = 0; i < nh; i++) {
    const a = (rnd() - 0.5) * Math.PI * 1.1;
    const r = 18 + rnd() * 55;
    const lx = Math.sin(a) * r * 1.1, lz = -17 - Math.cos(a) * r * 0.8;
    const wp = toWorld(lx, 0, lz);
    const gy = ground(wp.x, wp.z) - frame.origin.y;
    const w = 5 + rnd() * 4, d = 6 + rnd() * 5, h = 3.0 + rnd() * 1.6;
    const ry = (rnd() - 0.5) * 0.5;
    add(meterBox(w, h + 2, d, 4.8, 0.03), houseM, lx, gy + (h + 2) / 2 - 2, lz, ry);
    add(meterBox(w + 0.4, 0.35, d + 0.4, 3.0), roofM, lx, gy + h + 0.15, lz, ry);
  }
  // the elders on the benches and before the gate; Samuel stands in the gateway facing them
  const elders: Mark[] = [];
  const benchY = 0.46;
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const lx = sgn * (passW / 2 + 1.0 + i * 1.6);
      const p = toWorld(lx, benchY, 0.95);
      elders.push({ pos: p, yaw: frame.yaw + sgn * 0.35, role: 'elder-seated', seated: true });
    }
  }
  const standing = tier === 'low' ? 8 : 12;
  for (let i = 0; i < standing; i++) {
    const a = -1.1 + (i / (standing - 1)) * 2.2;
    const r = 9 + (i % 2) * 1.6 + rnd() * 0.6;
    const lx = Math.sin(a) * r, lz = 1.0 + Math.cos(a) * r * 0.75 + 1.5;
    const p = toWorld(lx, 0, lz);
    p.y = ground(p.x, p.z);
    const toGate = Math.atan2(-(lx), -(lz - 2.5));
    elders.push({ pos: p, yaw: frame.yaw + toGate, role: 'elder' });
  }
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
  return { group, elders, samuel, toWorld, altar: altarAt.setY(frame.origin.y + ay + 1.5), materials: [wallM, houseM, benchM, woodM, roofM] };
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
export function buildDust(route: THREE.Vector3[], count: number, sunDir: THREE.Vector3, sunColor: THREE.Color) {
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
    const s = 30 + rnd() * Math.min(total - 30, 420);
    let i = 1;
    while (i < route.length - 1 && lens[i] < s) i++;
    const f = (s - lens[i - 1]) / Math.max(1e-3, lens[i] - lens[i - 1]);
    const p = new THREE.Vector3().lerpVectors(route[i - 1], route[i], f);
    offs[k * 4] = p.x + (rnd() - 0.5) * 14; offs[k * 4 + 1] = p.y + 0.5 + rnd() * rnd() * 7; offs[k * 4 + 2] = p.z + (rnd() - 0.5) * 14;
    offs[k * 4 + 3] = 5 + rnd() * 9;
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
        float ph = 0.35 + 2.8 * pow(mu, 6.0) + 6.0 * pow(mu, 40.0);
        vec3 col = uSunCol * ph * 1.4 + uAmb;
        gl_FragColor = vec4(col * a * 0.16, a * 0.16);
      }`,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(inst, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.name = 'land:dust';
  return { mesh, material: mat, dispose: () => { inst.dispose(); g.dispose(); mat.dispose(); } };
}
