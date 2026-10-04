/*
 * dev/crowd-export.html — OFFLINE step of the crowd pipeline (tools/crowd/export.mjs drives it headless).
 *
 * Dresses the MakeHuman `man` body with the wardrobe's real garments (the same fitting code the hero characters use)
 * and dumps every mesh in the bind pose — positions, 8 skin weights, uv, bone names, the rest sockets — as JSON
 * (window.__out). tools/crowd/bake_crowd.py decimates it into the instanced crowd meshes (src/assets/crowd/*.binz).
 */
import * as THREE from 'three';
import { HumanModel } from '../src/characters/human/HumanModel';
import { beginFit, fittedTunic, beltBand, headRing, sandals, hangFromBelt, legCapsules } from '../src/characters/wardrobe/common';
import { makeSpear, makeShield, makeDagger, makeSword } from '../src/characters/wardrobe/props';
import { texPair, solidMaterial, clothMaterial } from '../src/characters/wardrobe/materials';

declare global {
  interface Window { __out?: unknown; __ready?: boolean; __error?: string }
}

function b64(a: ArrayBufferView) {
  const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
function attrF32(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: number) {
  const out = new Float32Array(a.count * size);
  for (let i = 0; i < a.count; i++) {
    out[i * size] = a.getX(i);
    if (size > 1) out[i * size + 1] = a.getY(i);
    if (size > 2) out[i * size + 2] = a.getZ(i);
    if (size > 3) out[i * size + 3] = a.getW(i);
  }
  return out;
}
function matName(m: THREE.Material | THREE.Material[]) {
  return Array.isArray(m) ? m.map((x) => x.name || x.type) : [m.name || m.type];
}
function nearestBone(o: THREE.Object3D): string {
  let p: THREE.Object3D | null = o.parent;
  while (p) {
    if ((p as THREE.Bone).isBone) return p.name;
    p = p.parent;
  }
  return 'root';
}

interface Part {
  name: string; mats: string[]; groups: { start: number; count: number; materialIndex: number }[]; kind: 'skinned' | 'rigid' | 'prop';
  bone?: string; pos: string; nrm?: string; uv?: string; idx: string; si?: string; sw?: string; si2?: string; sw2?: string; bones?: string[]; colors?: number[];
}

function dumpGeometry(g: THREE.BufferGeometry, mat: THREE.Matrix4 | null): Partial<Part> {
  let pos = attrF32(g.attributes.position, 3);
  let nrm = g.attributes.normal ? attrF32(g.attributes.normal, 3) : null;
  if (mat) {
    const v = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(mat);
    for (let i = 0; i < pos.length; i += 3) {
      v.fromArray(pos, i).applyMatrix4(mat).toArray(pos, i);
      if (nrm) v.fromArray(nrm, i).applyMatrix3(nm).normalize().toArray(nrm, i);
    }
  }
  const idx = g.index ? Uint32Array.from(g.index.array as ArrayLike<number>) : Uint32Array.from({ length: g.attributes.position.count }, (_, i) => i);
  const r: Partial<Part> = { pos: b64(pos), idx: b64(idx), groups: g.groups.map((x) => ({ start: x.start, count: x.count, materialIndex: x.materialIndex ?? 0 })) };
  if (nrm) r.nrm = b64(nrm);
  if (g.attributes.uv) r.uv = b64(attrF32(g.attributes.uv, 2));
  return r;
}

function dumpHuman(human: HumanModel, extra: Record<string, { obj: THREE.Object3D; grip?: THREE.Object3D }>) {
  human.rig.toRest();
  human.root.updateMatrixWorld(true);
  const parts: Part[] = [];
  let bindErr = 0;
  human.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const sk = (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh) : null;
    const colors: number[] = [];
    for (const mm of Array.isArray(m.material) ? m.material : [m.material]) {
      const c = (mm as THREE.MeshStandardMaterial).color;
      colors.push(c ? c.getHex() : 0xffffff);
    }
    if (sk) {
      const g = sk.geometry;
      const skel = sk.skeleton;
      skel.bones.forEach((b, i) => {
        const e = new THREE.Matrix4().multiplyMatrices(b.matrixWorld, skel.boneInverses[i]).elements;
        for (let k = 0; k < 16; k++) bindErr = Math.max(bindErr, Math.abs(e[k] - (k % 5 === 0 ? 1 : 0)));
      });
      const p: Part = {
        name: sk.name || 'skinned', mats: matName(sk.material), kind: 'skinned', colors,
        ...(dumpGeometry(g, null) as Pick<Part, 'pos' | 'idx' | 'groups'>),
        bones: skel.bones.map((b) => b.name),
      };
      p.si = b64(attrF32(g.attributes.skinIndex, 4));
      p.sw = b64(attrF32(g.attributes.skinWeight, 4));
      if (g.attributes.skinIndex2) {
        p.si2 = b64(attrF32(g.attributes.skinIndex2, 4));
        p.sw2 = b64(attrF32(g.attributes.skinWeight2, 4));
      }
      parts.push(p);
    } else {
      parts.push({
        name: m.name || 'rigid', mats: matName(m.material), kind: 'rigid', bone: nearestBone(m), colors,
        ...(dumpGeometry(m.geometry, m.matrixWorld) as Pick<Part, 'pos' | 'idx' | 'groups'>),
      });
    }
  });
  // props (not attached): geometry in the prop's own frame (spear: its grip frame, +Y along the shaft)
  const propInfo: Record<string, number[]> = {};
  for (const [name, { obj, grip }] of Object.entries(extra)) {
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    obj.updateMatrixWorld(true);
    const hg = obj.getObjectByName('grip');
    if (hg) propInfo[name + 'Handle'] = hg.matrixWorld.toArray();
    const inv = grip ? new THREE.Matrix4().copy(grip.matrixWorld).invert() : new THREE.Matrix4();
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const colors: number[] = [];
      for (const mm of Array.isArray(m.material) ? m.material : [m.material]) colors.push((mm as THREE.MeshStandardMaterial).color?.getHex() ?? 0xffffff);
      parts.push({
        name: `${name}:${m.name}`, mats: matName(m.material), kind: 'prop', bone: name, colors,
        ...(dumpGeometry(m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)) as Pick<Part, 'pos' | 'idx' | 'groups'>),
      });
    });
  }
  const sockets: Record<string, number[]> = {};
  for (const [k, s] of Object.entries(human.sockets)) sockets[k] = (s as THREE.Object3D).matrixWorld.toArray();
  const bonesRest: Record<string, number[]> = {};
  for (const [k, b] of Object.entries(human.rig.bones)) bonesRest[k] = b.matrixWorld.toArray();
  return { parts, sockets, bonesRest, bindErr, metrics: human.metrics, propInfo };
}

async function main() {
  const tier = 'low' as const;
  const [medium, leather, metal, wood] = await Promise.all([texPair('weave_medium', tier), texPair('leather', tier), texPair('metal', tier), texPair('wood', tier)]);
  const out: Record<string, unknown> = {};

  // ---------------------------------------------------------------- Israelite soldier (1 Sam 15; visual bible 3.4)
  {
    const human = await HumanModel.load({ preset: 'man', quality: tier });
    const fit = await beginFit(human, 'crowd:israel', tier, 11);
    const S = fit.lm.height / 1.75;
    fit.outfit.capsules.push(...legCapsules(fit, 0.014, 0.05));
    const t = await fittedTunic(fit, { tex: medium, tile: 0.14, dye: 0xcdbf9f, hem: -0.08, sleeve: 0.55, neck: 'slit', flare: 0.14, seed: 11, name: 'tunic', fray: 0.3, dust: 0.5 });
    const belt = solidMaterial({ tier, tex: leather, color: 0x4a2f1d, roughness: 0.6, repeat: [1, 12], normal: 1.2 });
    belt.name = 'belt';
    await beltBand(fit, t, { width: 0.045 * S, thickness: 0.006, material: belt, name: 'belt' });
    const jerk = await fittedTunic(fit, { tex: leather, tile: 0.3, dye: 0x6b4a30, hem: -1.6, sleeve: 0, sleeveless: true, neck: 'round', offset: 0.007, flare: 0.05, folds: 0.3, seed: 14, name: 'jerkin', hide: false, fray: 0, sheen: 0.3, roughness: 0.62, inner: t.restPos });
    void jerk;
    const band = clothMaterial({ tier, tex: medium, tile: 0.08, dye: 0x8e3f2c, hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
    band.name = 'headband';
    headRing(fit, { height: 0.02, thickness: 0.004, material: band, extra: 0.011 });
    const cloth = clothMaterial({ tier, tex: medium, tile: 0.1, dye: 0xe0d4b8, hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0.3 });
    cloth.name = 'headcloth';
    headRing(fit, { height: 0.05, thickness: 0.012, material: cloth, extra: 0.024, lift: 0.006, tilt: 0.012 });
    const dagger = makeDagger(tier, leather, metal, wood);
    hangFromBelt(fit, t, dagger, { th: -1.0, out: 0.02, drop: 0.005, forward: -0.3, bone: 'pelvis.R', name: 'wardrobeDagger' });
    await sandals(fit, leather, { wraps: 1.5, height: 0.07 });
    fit.outfit.finish(performance.now());
    const spear = makeSpear(tier, wood, metal, leather, { length: 2.3, head: 0.26, gripAt: 1.1, seed: 3 });
    const shield = makeShield(tier, leather, metal, wood, { radius: 0.29, oval: 1, boss: 'leather', seed: 3 });
    out.israel = dumpHuman(human, { spear: { obj: spear.object, grip: spear.grip }, shield: { obj: shield } });
  }
  // ---------------------------------------------------------------- Philistine (Medinet Habu; 1 Sam 17:5-7; bible 3.9)
  {
    const human = await HumanModel.load({ preset: 'man', quality: tier });
    const fit = await beginFit(human, 'crowd:philistine', tier, 21);
    const S = fit.lm.height / 1.75;
    fit.outfit.capsules.push(...legCapsules(fit, 0.014, 0.05));
    // kilt + ribbed corselet: a short sleeveless tunic (the bands are painted per instance in the crowd shader)
    const t = await fittedTunic(fit, { tex: medium, tile: 0.14, dye: 0xd9cba8, hem: -0.45, sleeve: 0, sleeveless: true, neck: 'round', flare: 0.2, seed: 21, name: 'tunic', fray: 0.1, dust: 0.3 });
    const belt = solidMaterial({ tier, tex: leather, color: 0x4a2f1d, roughness: 0.6, repeat: [1, 12], normal: 1.2 });
    belt.name = 'belt';
    await beltBand(fit, t, { width: 0.07 * S, thickness: 0.008, material: belt, name: 'belt' });
    const band = clothMaterial({ tier, tex: medium, tile: 0.08, dye: 0x8e3f2c, hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
    band.name = 'headband';
    headRing(fit, { height: 0.03, thickness: 0.006, material: band, extra: 0.011 });
    const sword = makeSword(tier, leather, metal, wood);
    hangFromBelt(fit, t, sword, { th: 1.45, out: 0.026, drop: 0.01, forward: 0.42, bone: 'pelvis.L', name: 'wardrobeSword' });
    fit.outfit.finish(performance.now());
    const spear = makeSpear(tier, wood, metal, leather, { length: 2.4, head: 0.3, gripAt: 1.15, seed: 5 });
    const shield = makeShield(tier, leather, metal, wood, { radius: 0.36, oval: 1, boss: 'bronze', seed: 5 });
    out.philistine = dumpHuman(human, { spear: { obj: spear.object, grip: spear.grip }, shield: { obj: shield } });
  }
  window.__out = out;
  window.__ready = true;
}
main().catch((e) => {
  console.error(e);
  window.__error = String(e?.stack ?? e);
});
