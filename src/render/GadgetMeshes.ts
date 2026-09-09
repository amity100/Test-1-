import * as THREE from 'three';
import type { GadgetSystem } from '../sim/Gadgets';
import type { Entity } from '../sim/Entities';
import { PRIM } from './PartBuilder';

/**
 * Renders deployed gadgets: zipline cables with anchor pucks, jump pads with a pulsing ring, stuck
 * breach charges with a blinking arming LED, and the dirt mound that follows a burrowed player.
 */
export class GadgetMeshes {
  readonly group = new THREE.Group();
  private zips = new Map<number, THREE.Group>();
  private pads = new Map<number, { root: THREE.Group; burst: THREE.Mesh; ring: THREE.Mesh }>();
  private charges = new Map<number, { root: THREE.Group; led: THREE.Mesh }>();
  private mounds = new Map<number, THREE.Mesh>();

  private cableMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.85, roughness: 0.35 });
  private glowMat = new THREE.LineBasicMaterial({ color: 0x9ad7ff, transparent: true, opacity: 0.45 });
  private anchorMat = new THREE.MeshStandardMaterial({ color: 0x14181e, metalness: 0.6, roughness: 0.5, emissive: 0x00e5ff, emissiveIntensity: 0.6 });
  private padMat = new THREE.MeshStandardMaterial({ color: 0x1a1f27, metalness: 0.5, roughness: 0.6 });
  private ringMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.6, roughness: 0.4 });
  private burstMat = new THREE.MeshBasicMaterial({ color: 0x8ff3ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  private chargeMat = new THREE.MeshStandardMaterial({ color: 0x3b3f2c, metalness: 0.3, roughness: 0.7 });
  private ledMat = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff2030, emissiveIntensity: 2 });
  private moundMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1, metalness: 0 });
  private ringGeo = new THREE.TorusGeometry(0.82, 0.06, 8, 32);
  private burstGeo = new THREE.CylinderGeometry(0.9, 0.7, 0.9, 24, 1, true);

  constructor(
    private gadgets: GadgetSystem,
    private entities: () => Entity[],
  ) {
    this.group.name = 'gadgets';
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
      const cable = new THREE.Mesh(PRIM.cyl8, this.cableMat);
      cable.position.copy(mid);
      cable.quaternion.copy(q);
      cable.scale.set(0.06, len, 0.06);
      cable.castShadow = true;
      g.add(cable);
      const glow = new THREE.Line(new THREE.BufferGeometry().setFromPoints([line.a, line.b]), this.glowMat);
      glow.frustumCulled = false;
      g.add(glow);
      for (const p of [line.a, line.b]) {
        const puck = new THREE.Mesh(PRIM.sphereLo, this.anchorMat);
        puck.position.copy(p);
        puck.scale.setScalar(0.34);
        g.add(puck);
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
        const base = new THREE.Mesh(PRIM.cyl, this.padMat);
        base.scale.set(2.2, 0.12, 2.2);
        base.position.y = 0.06;
        base.castShadow = true;
        base.receiveShadow = true;
        root.add(base);
        const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.13;
        root.add(ring);
        const chevron = new THREE.Mesh(PRIM.cone, this.ringMat);
        chevron.scale.set(0.5, 0.5, 0.5);
        chevron.position.y = 0.42;
        root.add(chevron);
        const burst = new THREE.Mesh(this.burstGeo, this.burstMat);
        burst.position.y = 0.5;
        burst.visible = false;
        root.add(burst);
        this.group.add(root);
        m = { root, burst, ring };
        this.pads.set(pad.id, m);
      }
      const idle = 1 + Math.sin(time * 4 + pad.id) * 0.04;
      m.ring.scale.set(idle, idle, 1);
      if (pad.pulse < 0.45) {
        const k = pad.pulse / 0.45;
        m.burst.visible = true;
        m.burst.scale.set(1 + k * 0.8, 1 + k * 3.5, 1 + k * 0.8);
        m.burst.position.y = 0.5 + k * 1.6;
        (m.burst.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
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
        const root = new THREE.Group();
        const body = new THREE.Mesh(PRIM.box, this.chargeMat);
        body.scale.set(0.28, 0.12, 0.2);
        body.position.y = 0.06;
        body.castShadow = true;
        root.add(body);
        const strap = new THREE.Mesh(PRIM.box, this.cableMat);
        strap.scale.set(0.3, 0.03, 0.06);
        strap.position.y = 0.12;
        root.add(strap);
        const led = new THREE.Mesh(PRIM.sphereLo, this.ledMat.clone());
        led.scale.setScalar(0.06);
        led.position.set(0.09, 0.14, 0.05);
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
      const blink = c.stuck ? (Math.sin(time * (10 + (1.5 - c.fuse) * 14)) > 0 ? 2.5 : 0.15) : 1;
      (m.led.material as THREE.MeshStandardMaterial).emissiveIntensity = blink;
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
