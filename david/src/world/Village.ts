import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise';
import type { Colliders } from '../core/Colliders';
import type { Terrain } from './Terrain';
import type { TextureSet } from './Textures';
import { LAYOUT } from './Layout';
import { boulderGeometry, rockMaterial } from './Rocks';

/** World-space triplanar masonry (fieldstone + mud plaster) — no UVs needed for merged buildings. */
function masonryMaterial(tex: TextureSet, map: THREE.Texture, normal: THREE.Texture, scale: number, tint: number, key: string) {
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.93, vertexColors: true });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tMap = { value: map };
    s.uniforms.tNor = { value: normal };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vMWPos; varying vec3 vMWN;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vMWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vMWN = normalize(mat3(modelMatrix) * objectNormal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tMap; uniform sampler2D tNor; varying vec3 vMWPos; varying vec3 vMWN; vec3 mWN;`)
      .replace(
        '#include <map_fragment>',
        `{
  vec3 Nw = normalize(vMWN);
  vec3 bw = pow(abs(Nw), vec3(6.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = vMWPos / ${scale.toFixed(2)};
  vec3 c = texture2D(tMap, p.zy).rgb * bw.x + texture2D(tMap, p.xz).rgb * bw.y + texture2D(tMap, p.xy).rgb * bw.z;
  diffuseColor.rgb *= c;
  vec3 nx = texture2D(tNor, p.zy).xyz * 2.0 - 1.0, ny = texture2D(tNor, p.xz).xyz * 2.0 - 1.0, nz = texture2D(tNor, p.xy).xyz * 2.0 - 1.0;
  mWN = normalize(bw.x * normalize(vec3(0.0, nx.y, nx.x * sign(Nw.x)) + Nw) + bw.y * normalize(vec3(ny.x, 0.0, -ny.y) + Nw) + bw.z * normalize(vec3(nz.x * sign(Nw.z), nz.y, 0.0) + Nw));
}`,
      )
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(mWN, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'masonry-' + key;
  void tex;
  return mat;
}

function colorize(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.index) return g.toNonIndexed();
  return g;
}

export class Village {
  readonly group = new THREE.Group();
  readonly smokeSources: THREE.Vector3[] = [];
  readonly gate = new THREE.Vector3();
  readonly rachelPillar = new THREE.Vector3();

  constructor(private terrain: Terrain, private tex: TextureSet, private colliders: Colliders) {}

  build() {
    const rnd = mulberry32(1004);
    const L = LAYOUT.bethlehem;
    const walls: THREE.BufferGeometry[] = [];
    const roofs: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const cloth: THREE.BufferGeometry[] = [];
    const baseY = this.terrain.heightAt(L.x, L.z);
    const houses: { x: number; z: number; w: number; d: number; rot: number }[] = [];
    const tint = new THREE.Color();

    const wood: THREE.BufferGeometry[] = [];
    const townWall: THREE.BufferGeometry[] = [];
    const clay: THREE.BufferGeometry[] = [];
    // part: a geometry in house-local space (x along the width, z along the depth), optionally tilted about the
    // local X axis, then turned by `rot` and moved to the house centre
    const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, rot: number, cx: number, cz: number, col: THREE.Color, tiltX = 0) => {
      if (tiltX) g.rotateX(tiltX);
      g.translate(x, y, z);
      g.rotateY(rot);
      g.translate(cx, 0, cz);
      return colorize(g, col);
    };
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, rot: number, cx: number, cz: number, col: THREE.Color) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(0, h / 2, 0);
      return place(g, x, y, z, rot, cx, cz, col);
    };
    // fieldstone walls are never plumb: a subdivided box whose faces bulge and lean a few cm (world-space noise,
    // so shared corners move together), with a slight batter toward the top
    const roughBox = (w: number, h: number, d: number, y: number, rot: number, cx: number, cz: number, col: THREE.Color, amp = 0.07) => {
      const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / 1.4)), Math.max(1, Math.round(h / 1.2)), Math.max(1, Math.round(d / 1.4)));
      g.translate(0, h / 2, 0);
      const pp = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), yy = pp.getY(i), z = pp.getZ(i);
        const batter = 1 - (yy / h) * 0.025;
        pp.setXYZ(i, x * batter, yy, z * batter);
      }
      g.rotateY(rot);
      g.translate(cx, y, cz);
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), yy = pp.getY(i), z = pp.getZ(i);
        const n1 = Math.sin(x * 1.37 + z * 2.11 + yy * 1.9) + Math.sin(x * 3.3 - yy * 2.2 + z * 0.7) * 0.5;
        const n2 = Math.sin(z * 1.53 - x * 1.91 + yy * 2.3) + Math.sin(z * 2.9 + yy * 1.7 - x * 0.9) * 0.5;
        const k = yy - y < 0.05 ? 0.4 : 1;
        pp.setXYZ(i, x + n1 * amp * k, yy, z + n2 * amp * k);
      }
      g.computeVertexNormals();
      return colorize(g, col);
    };
    const woodCol = new THREE.Color(0x5b4632);
    const woodDark = new THREE.Color(0x3a2c20);

    // Houses clustered on the crest, oriented loosely along lanes (Iron Age pillared / four-room houses:
    // fieldstone walls on a stone socle, mud plaster, flat roofs of beams, brushwood and rolled clay)
    for (let tries = 0; tries < 900 && houses.length < 58; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (L.r - 6);
      const x = L.x + Math.cos(a) * r;
      const z = L.z + Math.sin(a) * r;
      const w = 6 + rnd() * 5;
      const d = 7 + rnd() * 5;
      const rot = Math.round(rnd() * 4) * (Math.PI / 2) + (rnd() - 0.5) * 0.25 + 0.3;
      let ok = true;
      for (const h of houses) if (Math.hypot(h.x - x, h.z - z) < (Math.max(w, d) + Math.max(h.w, h.d)) * 0.62) ok = false;
      if (!ok) continue;
      houses.push({ x, z, w, d, rot });
    }
    for (const h of houses) {
      const y = Math.min(
        this.terrain.heightAt(h.x - h.w / 2, h.z - h.d / 2), this.terrain.heightAt(h.x + h.w / 2, h.z - h.d / 2),
        this.terrain.heightAt(h.x - h.w / 2, h.z + h.d / 2), this.terrain.heightAt(h.x + h.w / 2, h.z + h.d / 2),
      ) - 0.4;
      const storeys = rnd() < 0.22 ? 2 : 1;
      const H = (storeys === 2 ? 5.2 : 2.9) + rnd() * 0.4;
      tint.setHSL(0.09 + rnd() * 0.03, 0.06 + rnd() * 0.08, 0.7 + rnd() * 0.12);
      walls.push(roughBox(h.w, H, h.d, y, h.rot, h.x, h.z, tint));
      // parapet on all four sides of the roof ("make a parapet for your roof", Deuteronomy 22:8)
      const pc = tint.clone().multiplyScalar(0.95);
      const ph = 0.5 + rnd() * 0.15;
      walls.push(box(h.w, ph, 0.3, 0, y + H, h.d / 2 - 0.15, h.rot, h.x, h.z, pc));
      walls.push(box(h.w, ph, 0.3, 0, y + H, -h.d / 2 + 0.15, h.rot, h.x, h.z, pc));
      walls.push(box(0.3, ph, h.d - 0.6, h.w / 2 - 0.15, y + H, 0, h.rot, h.x, h.z, pc));
      walls.push(box(0.3, ph, h.d - 0.6, -h.w / 2 + 0.15, y + H, 0, h.rot, h.x, h.z, pc));
      // flat roof: rolled clay over brushwood, on beams whose ends show below the parapet
      const rc = new THREE.Color().setHSL(0.07, 0.25, 0.42 + rnd() * 0.1);
      roofs.push(box(h.w - 0.4, 0.22, h.d - 0.4, 0, y + H - 0.02, 0, h.rot, h.x, h.z, rc));
      const nb = Math.floor(h.w / 0.85);
      for (let bi = 0; bi < nb; bi++) {
        const bx = (bi + 0.5 - nb / 2) * (h.w - 0.6) / nb;
        for (const side of [-1, 1]) wood.push(box(0.17, 0.17, 0.32, bx + (rnd() - 0.5) * 0.08, y + H - 0.32, side * (h.d / 2 + 0.1), h.rot, h.x, h.z, woodDark));
      }
      // stone roof roller (for re-packing the clay after rain) on some roofs
      if (rnd() < 0.3) {
        const g = new THREE.CylinderGeometry(0.2, 0.2, 0.7, 10);
        g.rotateZ(Math.PI / 2);
        walls.push(place(g, (rnd() - 0.5) * h.w * 0.4, y + H + 0.4, (rnd() - 0.5) * h.d * 0.4, h.rot + rnd(), h.x, h.z, new THREE.Color(0xd9d0c0)));
      }
      // doorway: dark recess, timber lintel, threshold stone
      const dc = new THREE.Color(0x1a1410);
      const doorX = (rnd() - 0.5) * h.w * 0.4;
      dark.push(box(1.05, 1.85, 0.14, doorX, y + 0.35, h.d / 2 + 0.02, h.rot, h.x, h.z, dc));
      wood.push(box(1.6, 0.22, 0.3, doorX, y + 2.2, h.d / 2 + 0.06, h.rot, h.x, h.z, woodCol));
      walls.push(box(1.3, 0.14, 0.45, doorX, y + 0.3, h.d / 2 + 0.12, h.rot, h.x, h.z, new THREE.Color(0xd8cfbf)));
      // small high windows with a wooden frame
      for (let wi = 0; wi < 2; wi++) {
        dark.push(box(0.42, 0.38, 0.1, (wi - 0.5) * h.w * 0.5, y + H - 1.0, -h.d / 2 - 0.03, h.rot, h.x, h.z, dc));
        wood.push(box(0.62, 0.08, 0.14, (wi - 0.5) * h.w * 0.5, y + H - 0.6, -h.d / 2 - 0.05, h.rot, h.x, h.z, woodCol));
      }
      // ladder to the roof
      if (rnd() < 0.45) {
        const lx = h.w / 2 - 0.9 - rnd() * (h.w - 2.5), len = H + 0.9, tilt = -0.28;
        const lz = h.d / 2 + Math.sin(-tilt) * len * 0.5 + 0.12;
        for (const side of [-0.23, 0.23]) wood.push(place(new THREE.BoxGeometry(0.07, len, 0.07), lx + side, y + Math.cos(tilt) * len * 0.5, lz, h.rot, h.x, h.z, woodCol, tilt));
        const rungs = Math.floor(len / 0.4);
        for (let ri = 1; ri < rungs; ri++) {
          const t = ri / rungs - 0.5;
          wood.push(place(new THREE.BoxGeometry(0.5, 0.045, 0.045), lx, y + Math.cos(tilt) * len * (t + 0.5), h.d / 2 + 0.12 + Math.sin(-tilt) * len * (0.5 - t), h.rot, h.x, h.z, woodCol));
        }
      }
      // courtyard wall, tabun oven, goat-hair awning
      if (rnd() < 0.6) {
        const cd = 4 + rnd() * 3;
        const cc = tint.clone().multiplyScalar(0.9);
        const [cx0, cz0] = [Math.cos(h.rot), -Math.sin(h.rot)];
        const wpos = (lx: number, lz: number) => [h.x + cx0 * lx + Math.sin(h.rot) * lz, h.z + cz0 * lx + Math.cos(h.rot) * lz];
        const [ax, az] = wpos(h.w / 2 - 0.25, h.d / 2 + cd / 2);
        walls.push(roughBox(0.55, 1.6, cd, y, h.rot, ax, az, cc, 0.05));
        const [bx2, bz2] = wpos(-h.w / 2 + 0.25, h.d / 2 + cd / 2);
        walls.push(roughBox(0.55, 1.6, cd, y, h.rot, bx2, bz2, cc, 0.05));
        const [fx, fz] = wpos(h.w * 0.32, h.d / 2 + cd);
        walls.push(roughBox(h.w * 0.35, 1.6, 0.55, y, h.rot, fx, fz, cc, 0.05));
        if (rnd() < 0.55) {
          // tabun: a beehive clay bread oven with a vent on top
          const prof = [[0, 0], [0.62, 0], [0.66, 0.22], [0.58, 0.5], [0.38, 0.72], [0.16, 0.8], [0.14, 0.72]].map(([px, py]) => new THREE.Vector2(px, py));
          const og = new THREE.LatheGeometry(prof, 12);
          const ox = -h.w / 2 + 1.3, oz = h.d / 2 + 1.3 + rnd() * (cd - 2.6);
          clay.push(place(og, ox, y + 0.35, oz, h.rot, h.x, h.z, new THREE.Color(0xb88a62)));
          const [sx, sz] = wpos(ox, oz);
          if (rnd() < 0.5) this.smokeSources.push(new THREE.Vector3(sx, y + 1.2, sz));
        }
        if (rnd() < 0.5) {
          // black goat-hair awning on four poles, sagging in the middle
          const aw = 2.6 + rnd() * 1.2, ad = 2.0 + rnd() * 0.8, ah = 2.1;
          const ag = new THREE.PlaneGeometry(aw, ad, 4, 3);
          ag.rotateX(-Math.PI / 2);
          const ap = ag.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < ap.count; i++) {
            const u = ap.getX(i) / aw, v = ap.getZ(i) / ad;
            ap.setY(i, -(1 - 4 * u * u) * (1 - 4 * v * v) * 0.22 + v * 0.25);
          }
          ag.computeVertexNormals();
          const ax2 = h.w / 2 - aw / 2 - 0.6, az2 = h.d / 2 + ad / 2 + 0.3;
          cloth.push(place(ag, ax2, y + ah, az2, h.rot, h.x, h.z, new THREE.Color(rnd() < 0.7 ? 0x2c2520 : 0x6b5a45)));
          for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) wood.push(box(0.07, ah + qz * 0.12, 0.07, ax2 + qx * (aw / 2 - 0.1), y, az2 + qz * (ad / 2 - 0.1), h.rot, h.x, h.z, woodDark));
        }
      } else if (rnd() < 0.3) {
        // drying cloths on a line (madder red, indigo, undyed)
        const g = new THREE.PlaneGeometry(1.8 + rnd(), 1.1 + rnd() * 0.5);
        const hues = [new THREE.Color(0x8e2f23), new THREE.Color(0x2e3f6b), new THREE.Color(0xd9ccb0), new THREE.Color(0xa0662a)];
        cloth.push(place(g, 0, y + H + 1.2, 0, h.rot, h.x, h.z, hues[Math.floor(rnd() * hues.length)]));
        for (const qx of [-1, 1]) wood.push(box(0.06, 1.8, 0.06, qx * 1.3, y + H, 0, h.rot, h.x, h.z, woodDark));
      }
      // colliders: a few circles along the long axis
      const steps = 3;
      for (let s = 0; s < steps; s++) {
        const t = (s / (steps - 1) - 0.5) * (Math.max(h.w, h.d) - Math.min(h.w, h.d));
        const along = h.w > h.d ? new THREE.Vector3(t, 0, 0) : new THREE.Vector3(0, 0, t);
        along.applyAxisAngle(new THREE.Vector3(0, 1, 0), h.rot);
        this.colliders.add({ x: h.x + along.x, z: h.z + along.z, r: Math.min(h.w, h.d) * 0.55, tag: 'house' });
      }
    }
    // Town wall ring with a gate facing the shepherds' path (east)
    const gateAngle = Math.atan2(LAYOUT.path[LAYOUT.path.length - 1][1] - L.z, LAYOUT.path[LAYOUT.path.length - 1][0] - L.x);
    this.gate.set(L.x + Math.cos(gateAngle) * (L.r + 2), 0, L.z + Math.sin(gateAngle) * (L.r + 2));
    this.gate.y = this.terrain.heightAt(this.gate.x, this.gate.z);
    const segs = 64;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      let da = Math.abs(am - gateAngle);
      da = Math.min(da, Math.PI * 2 - da);
      if (da < 0.07) continue; // gate opening
      const rr = L.r + 2 + Math.sin(i * 1.7) * 1.2;
      const x0 = L.x + Math.cos(a0) * rr, z0 = L.z + Math.sin(a0) * rr;
      const x1 = L.x + Math.cos(a1) * rr, z1 = L.z + Math.sin(a1) * rr;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const y = this.terrain.heightAt(mx, mz) - 0.8;
      // battered fieldstone wall: 2.4 m thick at the foot, 1.7 m at the top
      const g = new THREE.BoxGeometry(len + 0.3, 4.2, 2.4, Math.max(1, Math.round(len / 2)), 3, 1);
      {
        const pp = g.getAttribute('position') as THREE.BufferAttribute;
        for (let k = 0; k < pp.count; k++) {
          const yy = pp.getY(k);
          const t = (yy + 2.1) / 4.2;
          pp.setZ(k, pp.getZ(k) * (1 - 0.3 * t));
          pp.setY(k, yy + Math.sin(pp.getX(k) * 0.9 + i) * 0.12 * t);
        }
        g.computeVertexNormals();
      }
      g.translate(0, y + 2.1, 0);
      g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      g.translate(mx, 0, mz);
      tint.setHSL(0.09, 0.07, 0.68 + Math.sin(i * 3.1) * 0.05);
      townWall.push(colorize(g, tint));
      this.colliders.add({ x: mx, z: mz, r: len * 0.55, tag: 'wall' });
    }
    // gate towers
    for (const side of [-1, 1]) {
      const a = gateAngle + side * 0.095;
      const x = L.x + Math.cos(a) * (L.r + 2), z = L.z + Math.sin(a) * (L.r + 2);
      const y = this.terrain.heightAt(x, z) - 0.8;
      townWall.push(roughBox(4.2, 6.0, 4.2, y, -a, x, z, new THREE.Color().setHSL(0.09, 0.07, 0.7), 0.08));
      townWall.push(box(4.4, 0.6, 4.4, 0, y + 6.0, 0, -a, x, z, new THREE.Color().setHSL(0.09, 0.06, 0.66)));
    }
    // gate: a flat timber-and-stone lintel between the towers (no arches in Iron Age Judah) and two plank
    // door leaves standing open inward
    {
      const gx = L.x + Math.cos(gateAngle) * (L.r + 2), gz = L.z + Math.sin(gateAngle) * (L.r + 2);
      const gy = this.terrain.heightAt(gx, gz) - 0.8;
      const tang = -gateAngle - Math.PI / 2; // local X along the wall line
      townWall.push(box(9.0, 1.3, 2.6, 0, gy + 4.2, 0, tang, gx, gz, new THREE.Color().setHSL(0.09, 0.07, 0.68)));
      wood.push(box(9.2, 0.35, 0.4, 0, gy + 3.9, 1.0, tang, gx, gz, woodDark));
      wood.push(box(9.2, 0.35, 0.4, 0, gy + 3.9, -1.0, tang, gx, gz, woodDark));
      for (const side of [-1, 1]) {
        const leaf = new THREE.BoxGeometry(2.1, 3.2, 0.14);
        leaf.translate(-side * 1.05, 1.6, 0);
        leaf.rotateY(side * 1.25);
        wood.push(place(leaf, side * 2.1, gy + 0.8, -0.9, tang, gx, gz, woodCol));
      }
    }
    void baseY;

    const wallMat = masonryMaterial(this.tex, this.tex.masonry, this.tex.masonryN, 3.4, 0xece6da, 'wall');
    const townWallMat = masonryMaterial(this.tex, this.tex.wall, this.tex.wallN, 3.2, 0xeae4d8, 'townwall');
    const roofMat = masonryMaterial(this.tex, this.tex.soil, this.tex.soilN, 3.0, 0xc8b8a4, 'roof');
    const woodMat = masonryMaterial(this.tex, this.tex.bark, this.tex.barkN, 0.6, 0xb8a894, 'wood');
    const clayMat = masonryMaterial(this.tex, this.tex.soil, this.tex.soilN, 1.2, 0xe0c8a8, 'clay');
    const merge = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
    const wallMesh = new THREE.Mesh(merge(walls), wallMat);
    const roofMesh = new THREE.Mesh(merge(roofs), roofMat);
    const darkMesh = new THREE.Mesh(merge(dark), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    const extra: THREE.Mesh[] = [];
    if (wood.length) extra.push(new THREE.Mesh(merge(wood), woodMat));
    if (townWall.length) extra.push(new THREE.Mesh(merge(townWall), townWallMat));
    if (clay.length) extra.push(new THREE.Mesh(merge(clay), clayMat));
    for (const m of [wallMesh, roofMesh, darkMesh, ...extra]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
    if (cloth.length) {
      const clothMesh = new THREE.Mesh(merge(cloth), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
      clothMesh.castShadow = true;
      this.group.add(clothMesh);
    }

    // Well / cistern by the gate (2 Samuel 23:15 — "the well of Bethlehem that is by the gate")
    const wx = this.gate.x + Math.cos(gateAngle) * 9 + 4, wz = this.gate.z + Math.sin(gateAngle) * 9 - 3;
    const wy = this.terrain.heightAt(wx, wz);
    const well = new THREE.Mesh(colorize(new THREE.CylinderGeometry(1.1, 1.25, 0.8, 18, 1, true), new THREE.Color(1, 1, 1)), masonryMaterial(this.tex, this.tex.wall, this.tex.wallN, 1.2, 0xe8dcc8, 'well'));
    well.position.set(wx, wy + 0.3, wz);
    well.castShadow = true;
    const wellHole = new THREE.Mesh(new THREE.CircleGeometry(1.05, 18), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
    wellHole.rotation.x = -Math.PI / 2;
    wellHole.position.set(wx, wy + 0.55, wz);
    this.group.add(well, wellHole);
    this.colliders.add({ x: wx, z: wz, r: 1.4, tag: 'well' });

    // Rachel's pillar (Genesis 35:20): a tall rough standing stone on a heap of fieldstones
    const R = LAYOUT.rachel;
    const ry = this.terrain.heightAt(R.x, R.z);
    this.rachelPillar.set(R.x, ry, R.z);
    const rmat = rockMaterial(this.tex, 0xf0e8da);
    const pillarGeo = new THREE.BoxGeometry(0.62, 2.7, 0.4, 4, 12, 3);
    {
      const pp = pillarGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
        const taper = 1 - (y + 1.35) * 0.06;
        const n = Math.sin(y * 7.1 + x * 9) * 0.012 + Math.sin(z * 13 + y * 3) * 0.01;
        pp.setXYZ(i, x * taper + n, y + (y > 1.3 ? Math.sin(x * 5) * 0.06 : 0), z * taper + n);
      }
      pillarGeo.computeVertexNormals();
    }
    const pillar = new THREE.Mesh(pillarGeo, rmat);
    pillar.position.set(R.x, ry + 1.2, R.z);
    pillar.rotation.set(0.03, 0.6, -0.02);
    pillar.castShadow = pillar.receiveShadow = true;
    this.group.add(pillar);
    const heap = new THREE.InstancedMesh(boulderGeometry(3, 2), rmat, 22);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, r = 0.5 + rnd() * 1.4;
      const s = 0.25 + rnd() * 0.35;
      m4.compose(new THREE.Vector3(R.x + Math.cos(a) * r, ry + s * 0.2 + (r < 1 ? 0.2 : 0), R.z + Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())), new THREE.Vector3(s, s, s));
      heap.setMatrixAt(i, m4);
    }
    heap.castShadow = heap.receiveShadow = true;
    this.group.add(heap);
    this.colliders.add({ x: R.x, z: R.z, r: 1.6, tag: 'pillar' });

    // Threshing floor (גֹּרֶן): a circle of beaten earth with a straw heap
    const T = LAYOUT.threshing;
    const ty = this.terrain.heightAt(T.x, T.z);
    const floorGeo = new THREE.CircleGeometry(9, 40);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    floor.position.set(T.x, ty + 0.06, T.z);
    floor.receiveShadow = true;
    const heapGeo = new THREE.SphereGeometry(2.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    heapGeo.scale(1, 0.55, 1);
    const straw = new THREE.Mesh(heapGeo, new THREE.MeshStandardMaterial({ color: 0xd8bb72, roughness: 1 }));
    straw.position.set(T.x + 3, ty, T.z - 2);
    straw.castShadow = straw.receiveShadow = true;
    this.group.add(floor, straw);
  }
}
