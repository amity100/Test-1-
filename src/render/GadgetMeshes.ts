import * as THREE from 'three';
import type { GadgetSystem } from '../sim/Gadgets';
import type { Entity } from '../sim/Entities';
import { PRIM } from './PartBuilder';
import { woodMaps } from './DetailTextures';

/**
 * Renders deployed gadgets in the siege era: hemp rope lines with iron anchor weights, spring boards
 * (an oak platform on coil springs with an iron rim), powder kegs with a sparking slow-match, and
 * the dirt mound that follows a burrowing sapper.
 */
export class GadgetMeshes {
  readonly group = new THREE.Group();
  private zips = new Map<number, THREE.Group>();
  private pads = new Map<number, { root: THREE.Group; burst: THREE.Mesh; ring: THREE.Mesh }>();
  private charges = new Map<number, { root: THREE.Group; led: THREE.Mesh }>();
  private mounds = new Map<number, THREE.Mesh>();

  private ropeMat = new THREE.MeshStandardMaterial({ color: 0x9c8a5c, metalness: 0, roughness: 1 });
  private glowMat = new THREE.LineBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: 0.35 });
  private ironMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.8, roughness: 0.6 });
  private woodMat: THREE.MeshStandardMaterial;
  private burstMat = new THREE.MeshBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  private emberMat = new THREE.MeshStandardMaterial({ color: 0x3a1a08, emissive: 0xff7a20, emissiveIntensity: 2 });
  private moundMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1, metalness: 0 });
  private ringGeo = new THREE.TorusGeometry(0.82, 0.06, 8, 32);
  private springGeo = new THREE.TorusGeometry(0.16, 0.025, 6, 20);
  private hoopGeo = new THREE.TorusGeometry(0.12, 0.012, 6, 20);
  private burstGeo = new THREE.CylinderGeometry(0.9, 0.7, 0.9, 24, 1, true);

  constructor(
    private gadgets: GadgetSystem,
    private entities: () => Entity[],
  ) {
    this.group.name = 'gadgets';
    const wm = woodMaps();
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a30, metalness: 0, roughness: 1, map: wm.map, normalMap: wm.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: wm.roughnessMap });
  }

  update(dt: number, time: number): void {
    void dt;
    this.syncZips();
    this.syncPads(time);
    this.syncCharges(time);
    this.syncMounds(time);
  }

  private syncZips(): void {
    const live = new Set<number>();
    for (const line of this.gadgets.ziplines) {
      live.add(line.id);
      if (this.zips.has(line.id)) continue;
      const g = new THREE.Group();
      const dir = line.b.clone().sub(line.a);
      const len = dir.length();
      const mid = line.a.clone().add(line.b).multiplyScalar(0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const rope = new THREE.Mesh(PRIM.cyl8, this.ropeMat);
      rope.position.copy(mid);
      rope.quaternion.copy(q);
      rope.scale.set(0.06, len, 0.06);
      rope.castShadow = true;
      g.add(rope);
      const glow = new THREE.Line(new THREE.BufferGeometry().setFromPoints([line.a, line.b]), this.glowMat);
      glow.frustumCulled = false;
      g.add(glow);
      // Iron anchor weights with a ring at either end.
      for (const p of [line.a, line.b]) {
        const weight = new THREE.Mesh(PRIM.sphereLo, this.ironMat);
        weight.position.copy(p);
        weight.scale.setScalar(0.26);
        g.add(weight);
        const ring = new THREE.Mesh(this.hoopGeo, this.ironMat);
        ring.position.copy(p);
        ring.quaternion.copy(q);
        ring.rotation.x += Math.PI / 2;
        g.add(ring);
      }
      this.group.add(g);
      this.zips.set(line.id, g);
    }
    for (const [id, g] of this.zips) {
      if (live.has(id)) continue;
      this.group.remove(g);
      g.traverse((o) => {
        if (o instanceof THREE.Line) o.geometry.dispose();
      });
      this.zips.delete(id);
    }
  }

  private syncPads(time: number): void {
    const live = new Set<number>();
    for (const pad of this.gadgets.pads) {
      live.add(pad.id);
      let m = this.pads.get(pad.id);
      if (!m) {
        const root = new THREE.Group();
        root.position.copy(pad.pos);
        // Oak platform on four coil springs, an iron rim around the deck.
        const base = new THREE.Mesh(PRIM.cyl8, this.woodMat);
        base.scale.set(2.2, 0.12, 2.2);
        base.position.y = 0.06;
        base.castShadow = true;
        base.receiveShadow = true;
        root.add(base);
        for (const [sx, sz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
          for (let i = 0; i < 3; i++) {
            const coil = new THREE.Mesh(this.springGeo, this.ironMat);
            coil.rotation.x = Math.PI / 2;
            coil.position.set(sx, 0.17 + i * 0.07, sz);
            root.add(coil);
          }
        }
        const deck = new THREE.Mesh(PRIM.cyl8, this.woodMat);
        deck.scale.set(1.9, 0.1, 1.9);
        deck.position.y = 0.42;
        deck.castShadow = true;
        root.add(deck);
        const ring = new THREE.Mesh(this.ringGeo, this.ironMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.47;
        root.add(ring);
        const burst = new THREE.Mesh(this.burstGeo, this.burstMat);
        burst.position.y = 0.5;
        burst.visible = false;
        root.add(burst);
        this.group.add(root);
        m = { root, burst, ring };
        this.pads.set(pad.id, m);
      }
      const idle = 1 + Math.sin(time * 4 + pad.id) * 0.02;
      m.ring.scale.set(idle, idle, 1);
      if (pad.pulse < 0.45) {
        const k = pad.pulse / 0.45;
        m.burst.visible = true;
        m.burst.scale.set(1 + k * 0.8, 1 + k * 3.5, 1 + k * 0.8);
        m.burst.position.y = 0.5 + k * 1.6;
        (m.burst.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k);
      } else m.burst.visible = false;
    }
    for (const [id, m] of this.pads) {
      if (live.has(id)) continue;
      this.group.remove(m.root);
      this.pads.delete(id);
    }
  }

  private syncCharges(time: number): void {
    const live = new Set<number>();
    for (const c of this.gadgets.charges) {
      live.add(c.id);
      let m = this.charges.get(c.id);
      if (!m) {
        // A small powder keg with two hoops and a slow-match that sparks faster as the fuse runs out.
        const root = new THREE.Group();
        const body = new THREE.Mesh(PRIM.cyl12, this.woodMat);
        body.scale.set(0.24, 0.26, 0.24);
        body.position.y = 0.13;
        body.castShadow = true;
        root.add(body);
        for (const y of [0.06, 0.2]) {
          const hoop = new THREE.Mesh(this.hoopGeo, this.ironMat);
          hoop.rotation.x = Math.PI / 2;
          hoop.position.y = y;
          root.add(hoop);
        }
        const cord = new THREE.Mesh(PRIM.cyl8, this.ropeMat);
        cord.scale.set(0.02, 0.14, 0.02);
        cord.position.set(0.04, 0.32, 0.03);
        cord.rotation.z = -0.4;
        root.add(cord);
        const led = new THREE.Mesh(PRIM.sphereLo, this.emberMat.clone());
        led.scale.setScalar(0.05);
        led.position.set(0.07, 0.38, 0.03);
        root.add(led);
        this.group.add(root);
        m = { root, led };
        this.charges.set(c.id, m);
      }
      m.root.position.copy(c.pos);
      if (c.stuck) m.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.normal);
      else {
        m.root.rotation.x += 0.25;
        m.root.rotation.z += 0.17;
      }
      const spark = c.stuck ? (Math.sin(time * (10 + (1.5 - c.fuse) * 14)) > 0 ? 3 : 0.6) : 1.2;
      (m.led.material as THREE.MeshStandardMaterial).emissiveIntensity = spark;
    }
    for (const [id, m] of this.charges) {
      if (live.has(id)) continue;
      this.group.remove(m.root);
      (m.led.material as THREE.Material).dispose();
      this.charges.delete(id);
    }
  }

  private syncMounds(time: number): void {
    const live = new Set<number>();
    for (const e of this.entities()) {
      if (!e.alive || !e.burrowed) continue;
      live.add(e.id);
      let m = this.mounds.get(e.id);
      if (!m) {
        m = new THREE.Mesh(PRIM.sphere, this.moundMat);
        m.castShadow = true;
        m.receiveShadow = true;
        this.group.add(m);
        this.mounds.set(e.id, m);
      }
      const y = this.gadgets.surfaceYAt(e.pos.x, e.pos.z);
      m.position.set(e.pos.x, y + 0.02, e.pos.z);
      const w = 1.5 + Math.sin(time * 9 + e.id) * 0.08;
      m.scale.set(w, 0.42 + Math.sin(time * 13 + e.id) * 0.04, w);
    }
    for (const [id, m] of this.mounds) {
      if (live.has(id)) continue;
      this.group.remove(m);
      this.mounds.delete(id);
    }
  }

  clear(): void {
    for (const g of this.zips.values()) this.group.remove(g);
    for (const m of this.pads.values()) this.group.remove(m.root);
    for (const m of this.charges.values()) this.group.remove(m.root);
    for (const m of this.mounds.values()) this.group.remove(m);
    this.zips.clear();
    this.pads.clear();
    this.charges.clear();
    this.mounds.clear();
  }
}
