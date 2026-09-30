import * as THREE from 'three';
import { mulberry32 } from '../../core/noise';
import { shared } from '../../core/Shared';
import type { TextureSet } from '../../world/Textures';
import features from '../../assets/gilgal/gilgal_features.json';
import { roadZ, STONES, SAMUEL, SAUL_HALT } from './gilgalLayout';
import type { GilgalGround, GilgalTier } from './gilgalTerrain';

/**
 * Date palms (Phoenix dactylifera): "the plain of the valley of Jericho, the city of palm trees" (Deut 34:3).
 * Tall, slender trunks armoured with old leaf bases, a crown of 20-30 stiff, glaucous pinnate fronds (3.5-4.5 m),
 * the oldest hanging dry below the crown. Plus the scrub of the plain: saltbush and jujube (sidr) bushes.
 */

export interface PalmTextures { frond: THREE.Texture; trunk: THREE.Texture; trunkN: THREE.Texture }

interface PalmVariant { height: number; lean: number; fronds: number; seed: number }
const VARIANTS: PalmVariant[] = [
  { height: 9.5, lean: 0.05, fronds: 24, seed: 11 },
  { height: 13, lean: 0.09, fronds: 26, seed: 23 },
  { height: 16.5, lean: 0.14, fronds: 22, seed: 37 },
];

function trunkCurve(v: PalmVariant) {
  // gentle bow away from vertical (palms lean toward the light and bend back up)
  return (t: number) => new THREE.Vector3(v.lean * v.height * (t * t * 0.9 + t * 0.1) - v.lean * v.height * 0.25 * Math.sin(t * Math.PI) * 0.3, t * v.height, 0);
}

function palmGeometry(v: PalmVariant, lod: 0 | 1) {
  const rand = mulberry32(v.seed * 7 + lod);
  const curve = trunkCurve(v);
  // ------------------------------------------------------------------ trunk
  const sides = lod === 0 ? 9 : 5;
  const segs = lod === 0 ? 10 : 3;
  const tp: number[] = [], tn: number[] = [], tuv: number[] = [], ti: number[] = [];
  for (let j = 0; j <= segs; j++) {
    const t = j / segs;
    const c = curve(t);
    const r = (0.36 - 0.1 * t + 0.14 * Math.pow(1 - t, 10)) * (1 + (t > 0.92 ? (t - 0.92) * 3 : 0));
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const nx = Math.cos(a), nz = Math.sin(a);
      tp.push(c.x + nx * r, c.y, c.z + nz * r);
      tn.push(nx, 0, nz);
      tuv.push(k / sides * 2, t * v.height / 1.35);
    }
  }
  for (let j = 0; j < segs; j++) for (let k = 0; k < sides; k++) {
    const a = j * (sides + 1) + k, b = a + sides + 1;
    ti.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const trunk = new THREE.BufferGeometry();
  trunk.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  trunk.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3));
  trunk.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
  trunk.setIndex(ti);
  // ------------------------------------------------------------------ crown: fronds as V-folded strips
  const top = curve(1);
  const n = lod === 0 ? v.fronds : 13;
  const S = lod === 0 ? 7 : 3;
  const fp: number[] = [], fn: number[] = [], fuv: number[] = [], fd: number[] = [], fi: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let f = 0; f < n; f++) {
    const age = f / (n - 1); // 0 = youngest (top), 1 = oldest (hanging)
    const az = f * 2.39996 + rand() * 0.3;
    const dead = age > 0.86 ? 1 : 0;
    const elev = THREE.MathUtils.lerp(1.15, -0.55, Math.pow(age, 0.85)) + (rand() - 0.5) * 0.18 - dead * 0.5;
    const L = (lod === 0 ? 1 : 1.05) * (3.3 + 1.1 * Math.sin(Math.min(1, age * 1.4) * Math.PI * 0.5) - dead * 0.4) * (0.92 + rand() * 0.16);
    const droop = (0.35 + 0.75 * age + dead * 0.6) * (0.85 + rand() * 0.3);
    const W = L * (dead ? 0.2 : 0.3);
    const fold = dead ? 0.15 : 0.42; // V between the two rows of leaflets
    const hdir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const lat = new THREE.Vector3().crossVectors(up, hdir).normalize();
    const base = top.clone().addScaledVector(hdir, 0.18).add(new THREE.Vector3(0, -0.15 - age * 0.55, 0));
    const p = base.clone();
    const i0 = fp.length / 3;
    for (let s = 0; s <= S; s++) {
      const u = s / S;
      const ang = elev - droop * Math.pow(u, 1.6);
      const tan = hdir.clone().multiplyScalar(Math.cos(ang)).addScaledVector(up, Math.sin(ang));
      if (s > 0) p.addScaledVector(tan, L / S);
      const nrm = new THREE.Vector3().crossVectors(tan, lat).normalize(); // "up" of the frond plane
      if (nrm.y < 0) nrm.negate();
      const w = W * 0.5 * (s === 0 ? 0.25 : 1);
      // twist toward the tip: the leaflet plane turns a little
      const tw = u * 0.25 * (f % 2 ? 1 : -1);
      const latT = lat.clone().multiplyScalar(Math.cos(tw)).addScaledVector(nrm, Math.sin(tw));
      const nrmT = nrm.clone().multiplyScalar(Math.cos(tw)).addScaledVector(lat, -Math.sin(tw));
      const lft = p.clone().addScaledVector(latT, -w * Math.cos(fold)).addScaledVector(nrmT, w * Math.sin(fold));
      const rgt = p.clone().addScaledVector(latT, w * Math.cos(fold)).addScaledVector(nrmT, w * Math.sin(fold));
      fp.push(lft.x, lft.y, lft.z, p.x, p.y, p.z, rgt.x, rgt.y, rgt.z);
      const nl = nrmT.clone().addScaledVector(latT, 0.35).normalize();
      const nr = nrmT.clone().addScaledVector(latT, -0.35).normalize();
      fn.push(nl.x, nl.y, nl.z, nrmT.x, nrmT.y, nrmT.z, nr.x, nr.y, nr.z);
      const vv = 1 - u;
      fuv.push(0, vv, 0.5, vv, 1, vv);
      const d = dead ? 0.85 + rand() * 0.15 : age > 0.7 ? (age - 0.7) * 1.2 : 0;
      fd.push(d, d, d);
    }
    for (let s = 0; s < S; s++) {
      const a = i0 + s * 3;
      fi.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  crown.setAttribute('normal', new THREE.Float32BufferAttribute(fn, 3));
  crown.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  crown.setAttribute('aDry', new THREE.Float32BufferAttribute(fd, 1));
  crown.setIndex(fi);
  crown.computeBoundingSphere();
  trunk.computeBoundingSphere();
  return { trunk, crown, top };
}

function frondMaterial(tex: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.72, metalness: 0 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uSunC = shared.uSunColor;
    s.uniforms.uSunP = shared.uSunDir;
    s.uniforms.uTimeW = shared.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aDry; varying float vDry; varying vec3 vWP; uniform float uTimeW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vDry = aDry;
{
  // wind: fronds sway from the crown outward (stronger toward the tips)
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz;
  #endif
  float tip = 1.0 - uv.y;
  float ph = dot(ip.xz, vec2(0.13, 0.07)) + position.x * 0.4 + position.z * 0.3;
  transformed += vec3(0.07, 0.04, 0.05) * sin(uTimeW * 1.7 + ph) * tip * tip * 1.4;
}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
vec4 wpp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
wpp = instanceMatrix * wpp;
#endif
vWP = (modelMatrix * wpp).xyz;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vDry; varying vec3 vWP; uniform vec3 uSunC, uSunP;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * vec3(1.9, 1.5, 1.0), vDry);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  // thin leaflets glow when the low sun is behind them (translucency)
  vec3 vdir = normalize(vWP - cameraPosition);
  float back = pow(max(dot(vdir, normalize(uSunP)), 0.0), 5.0);
  totalEmissiveRadiance += diffuseColor.rgb * uSunC * back * 1.3 * mix(vec3(0.9, 1.1, 0.55), vec3(1.0, 0.8, 0.45), vDry);
}`);
  };
  m.customProgramCacheKey = () => 'gilgal-frond-v1';
  return m;
}

export interface PalmPlacement { x: number; z: number; variant: number; scale: number; yaw: number }

export interface Flora {
  group: THREE.Group;
  palms: PalmPlacement[];
  stats: { palmsNear: number; palmsFar: number; bushes: number };
}

export function buildFlora(ground: GilgalGround, ptex: PalmTextures, world: TextureSet, tier: GilgalTier): Flora {
  const group = new THREE.Group();
  group.name = 'gilgal:flora';
  const rand = mulberry32(5150);
  const trunkMat = new THREE.MeshStandardMaterial({ map: ptex.trunk, normalMap: ptex.trunkN, roughness: 0.92, metalness: 0, color: 0xd8ccb8 });
  const frondMat = frondMaterial(ptex.frond);
  // ---------------------------------------------------------------- near palms (the set)
  const near: PalmPlacement[] = [];
  const clear = (x: number, z: number) => {
    if (Math.abs(z - roadZ(x)) < 9) return false;
    if (Math.hypot(x - STONES.center.x, z - STONES.center.z) < STONES.radius + 6) return false;
    if (x > SAUL_HALT.x - 106 && x < 40 && Math.abs(z) < 22) return false; // the stage of the march and the face-off
    if (x > -140 && x < -110 && z > -4 && z < 30) return false; // the lens of shot 6
    return true;
  };
  const groves: [number, number, number, number][] = [
    // x, z, radius, count: west (silhouettes against the sun beside the dust), south-west, north-east behind the stones, east
    [-150, 55, 55, 22], [-250, -65, 70, 30], [-95, -48, 30, 9], [55, -45, 38, 14], [80, 38, 40, 14], [-40, 70, 30, 8], [170, -20, 60, 18], [-420, 30, 90, 30],
    [30, -70, 30, 8], [-20, -40, 14, 3],
  ];
  const scaleN = tier === 'low' ? 0.55 : tier === 'medium' ? 0.8 : 1;
  for (const [gx, gz, gr, cnt] of groves) {
    const count = Math.max(2, Math.round(cnt * scaleN));
    let tries = 0;
    for (let i = 0; i < count && tries < 400; tries++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * gr;
      const x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r;
      if (!clear(x, z)) continue;
      if (near.some((p) => Math.hypot(p.x - x, p.z - z) < 3.2)) continue;
      near.push({ x, z, variant: Math.floor(rand() * 3), scale: 0.85 + rand() * 0.3, yaw: rand() * Math.PI * 2 });
      i++;
    }
  }
  // a lone palm near Samuel's mark for the backgrounds of the close-ups (east side, off the road)
  near.push({ x: SAMUEL.pos.x + 26, z: SAMUEL.pos.z + 11, variant: 2, scale: 1.05, yaw: 0.6 });
  near.push({ x: SAMUEL.pos.x + 33, z: SAMUEL.pos.z - 8, variant: 1, scale: 0.95, yaw: 2.1 });
  // ---------------------------------------------------------------- far palms (the oasis of Jericho)
  const far: PalmPlacement[] = [];
  const fp = features.palms as number[];
  const farMax = tier === 'high' ? 2600 : tier === 'medium' ? 1500 : 650;
  for (let i = 0; i < fp.length / 2 && far.length < farMax; i++) {
    if (tier !== 'high' && rand() > farMax / (fp.length / 2)) continue;
    far.push({ x: fp[i * 2], z: fp[i * 2 + 1], variant: Math.floor(rand() * 3), scale: 0.85 + rand() * 0.3, yaw: rand() * Math.PI * 2 });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const put = (list: PalmPlacement[], lod: 0 | 1, shadow: boolean) => {
    for (let v = 0; v < VARIANTS.length; v++) {
      const items = list.filter((p) => p.variant === v);
      if (!items.length) continue;
      const geo = palmGeometry(VARIANTS[v], lod);
      const tm = new THREE.InstancedMesh(geo.trunk, trunkMat, items.length);
      const cm = new THREE.InstancedMesh(geo.crown, frondMat, items.length);
      tm.name = `gilgal:palmTrunk${lod}.${v}`;
      cm.name = `gilgal:palmCrown${lod}.${v}`;
      items.forEach((p, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
        m.compose(new THREE.Vector3(p.x, ground.height(p.x, p.z) - 0.15, p.z), q, new THREE.Vector3(p.scale, p.scale, p.scale));
        tm.setMatrixAt(i, m);
        cm.setMatrixAt(i, m);
      });
      for (const im of [tm, cm]) {
        im.castShadow = shadow;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        group.add(im);
      }
    }
  };
  put(near, 0, true);
  put(far, 1, false);
  // ---------------------------------------------------------------- scrub: saltbush and jujube (sidr) bushes
  const bushes = buildBushes(ground, world, tier, rand, clear);
  group.add(bushes.mesh);
  return { group, palms: [...near, ...far], stats: { palmsNear: near.length, palmsFar: far.length, bushes: bushes.count } };
}

function buildBushes(ground: GilgalGround, world: TextureSet, tier: GilgalTier, rand: () => number, clear: (x: number, z: number) => boolean) {
  // three crossed vertical cards + a domed top card, using the world's shrub foliage atlas
  const cards: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.PlaneGeometry(1.6, 1.1, 1, 1);
    g.translate(0, 0.5, 0);
    g.rotateY((k / 3) * Math.PI);
    cards.push(g);
  }
  const topC = new THREE.PlaneGeometry(1.5, 1.5, 1, 1);
  topC.rotateX(-Math.PI / 2);
  topC.translate(0, 0.85, 0);
  cards.push(topC);
  const geo = mergeSimple(cards);
  const mat = new THREE.MeshStandardMaterial({ map: world.shrub, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: 0x9a9a82 });
  const count = tier === 'high' ? 900 : tier === 'medium' ? 550 : 260;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'gilgal:bushes';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 20; tries++) {
    const a = rand() * Math.PI * 2, r = 12 + Math.pow(rand(), 1.6) * 520;
    const x = Math.cos(a) * r - 60, z = Math.sin(a) * r;
    if (!clear(x, z)) continue;
    const s = 0.6 + rand() * 1.2;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    m.compose(new THREE.Vector3(x, ground.height(x, z) - 0.1, z), q, new THREE.Vector3(s * (0.9 + rand() * 0.4), s * (0.7 + rand() * 0.5), s));
    mesh.setMatrixAt(n, m);
    // saltbush: silvery grey-green; sidr: darker green
    col.setRGB(0.8, 0.85, 0.75).lerp(new THREE.Color(0.55, 0.62, 0.45), rand());
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return { mesh, count: n };
}

export function mergeSimple(geos: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of geos) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
