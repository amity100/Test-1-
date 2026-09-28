import * as THREE from 'three';
import { mulberry32 } from '../core/noise';
import type { Terrain } from '../world/Terrain';
import type { TextureSet } from '../world/Textures';
import type { Colliders } from '../core/Colliders';
import { boulderGeometry, rockMaterial } from '../world/Rocks';
import { LAYOUT } from '../world/Layout';

/** A clay jar (כַּד) for sling practice. Shatters into terracotta shards. */
export class Jar {
  readonly group = new THREE.Group();
  alive = true;
  readonly center = new THREE.Vector3();
  private shards: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
  private t = 0;
  constructor(private mat: THREE.Material, private ground: (x: number, z: number) => number, pos: THREE.Vector3, scale: number) {
    const prof: THREE.Vector2[] = [];
    const pts: [number, number][] = [[0.0, 0], [0.09, 0.0], [0.15, 0.08], [0.18, 0.2], [0.17, 0.32], [0.12, 0.42], [0.075, 0.47], [0.07, 0.53], [0.09, 0.56], [0.075, 0.57]];
    for (const [r, y] of pts) prof.push(new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(prof, 24);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    // handles
    for (const s of [1, -1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), mat);
      h.position.set(0.12 * s, 0.4, 0);
      h.rotation.set(0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      m.add(h);
    }
    this.group.add(m);
    this.group.position.copy(pos);
    this.group.scale.setScalar(scale);
    this.center.copy(pos).add(new THREE.Vector3(0, 0.28 * scale, 0));
  }

  shatter(vel: THREE.Vector3) {
    if (!this.alive) return;
    this.alive = false;
    const body = this.group.children[0];
    body.visible = false;
    const rnd = mulberry32(Math.floor(Math.random() * 1e6));
    for (let i = 0; i < 16; i++) {
      const g = new THREE.BufferGeometry();
      const s = 0.05 + rnd() * 0.06;
      const v = new Float32Array([0, 0, 0, s, rnd() * 0.02, rnd() * s * 0.4, rnd() * s * 0.5, s * 0.9, rnd() * 0.02]);
      g.setAttribute('position', new THREE.BufferAttribute(v, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, this.mat);
      (m.material as THREE.Material).side = THREE.DoubleSide;
      m.castShadow = true;
      m.position.set((rnd() - 0.5) * 0.25, 0.1 + rnd() * 0.4, (rnd() - 0.5) * 0.25);
      this.group.add(m);
      const dir = new THREE.Vector3(rnd() - 0.5, rnd() * 0.8 + 0.3, rnd() - 0.5).normalize();
      this.shards.push({ m, v: dir.multiplyScalar(1.5 + rnd() * 2.5).addScaledVector(vel.clone().normalize(), 1.2), w: new THREE.Vector3(rnd() * 12, rnd() * 12, rnd() * 12) });
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

/** A smooth stream-bed stone to collect (חַלּוּק). */
export class SmoothStone {
  readonly mesh: THREE.Mesh;
  readonly glint: THREE.Mesh;
  taken = false;
  constructor(pos: THREE.Vector3, mat: THREE.Material, glintMat: THREE.Material) {
    const g = new THREE.SphereGeometry(0.05, 16, 12);
    g.scale(1.25, 0.6, 0.95);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.position.copy(pos).add(new THREE.Vector3(0, 0.025, 0));
    this.mesh.rotation.y = Math.random() * 6;
    this.mesh.castShadow = true;
    this.glint = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 32), glintMat);
    this.glint.rotation.x = -Math.PI / 2;
    this.glint.position.copy(pos).add(new THREE.Vector3(0, 0.04, 0));
  }
}

export class Props {
  readonly group = new THREE.Group();
  readonly jars: Jar[] = [];
  readonly stones: SmoothStone[] = [];
  private glintMat: THREE.MeshBasicMaterial;

  constructor(terrain: Terrain, tex: TextureSet, colliders: Colliders) {
    const ground = (x: number, z: number) => terrain.heightAt(x, z);
    const T = LAYOUT.targets;
    // a low field wall of stacked fieldstones for the jars
    const wallMat = rockMaterial(tex, 0xe6dccb);
    const rg = boulderGeometry(12, 2);
    const wall = new THREE.InstancedMesh(rg, wallMat, 26);
    const m4 = new THREE.Matrix4();
    const dir = new THREE.Vector3(1, 0, 0.35).normalize();
    const rnd = mulberry32(88);
    let k = 0;
    for (let i = 0; i < 13; i++) {
      for (let row = 0; row < 2; row++) {
        const t = (i - 6) * 0.42 + (row ? 0.2 : 0);
        const x = T.x + dir.x * t, z = T.z + dir.z * t;
        const y = ground(x, z) + row * 0.32 + 0.12;
        const s = 0.26 + rnd() * 0.08;
        m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd() * 0.3)), new THREE.Vector3(s * 1.3, s, s));
        wall.setMatrixAt(k++, m4);
      }
    }
    wall.castShadow = wall.receiveShadow = true;
    this.group.add(wall);
    for (let i = -5; i <= 5; i += 2) colliders.add({ x: T.x + dir.x * i * 0.42, z: T.z + dir.z * i * 0.42, r: 0.45, tag: 'wall' });
    // terracotta jars on top of the wall
    const clay = new THREE.MeshStandardMaterial({ color: 0xb4643a, roughness: 0.82 });
    for (const t of [-1.9, 0, 1.9]) {
      const x = T.x + dir.x * t, z = T.z + dir.z * t;
      const y = ground(x, z) + 0.66;
      const jar = new Jar(clay, ground, new THREE.Vector3(x, y, z), 0.9 + Math.random() * 0.2);
      this.jars.push(jar);
      this.group.add(jar.group);
    }
    // smooth stones in the wadi bed
    const S = LAYOUT.stones;
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe2dccd, roughness: 0.32 });
    this.glintMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.0, depthWrite: false });
    const spots = [[0, 0], [3.5, -1.2], [-2.8, 1.6], [6.5, 1.8], [-5.8, -0.8]];
    for (const [dx, dz] of spots) {
      const x = S.x + dx, z = S.z + dz;
      const st = new SmoothStone(new THREE.Vector3(x, ground(x, z), z), stoneMat, this.glintMat);
      this.stones.push(st);
      this.group.add(st.mesh, st.glint);
    }
  }

  reset() {
    for (const j of this.jars) j.reset();
    for (const s of this.stones) {
      s.taken = false;
      s.mesh.visible = true;
      s.glint.visible = true;
    }
  }

  setStoneGlint(on: boolean, time: number) {
    this.glintMat.opacity = on ? 0.35 + 0.25 * Math.sin(time * 4) : 0;
  }

  update(dt: number) {
    for (const j of this.jars) j.update(dt);
  }
}
